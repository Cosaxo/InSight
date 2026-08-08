// sentry.ts — error + crash reporting, lazily loaded.
//
// Two layers once loaded:
//   - @sentry/capacitor wraps the native iOS / Android crash
//     reporting (its underlying SDK is sentry-cocoa / sentry-android
//     loaded by the Capacitor plugin) AND the JS-layer Sentry.
//   - @sentry/react provides the JS error boundary, route
//     instrumentation, and component-aware breadcrumbs.
//
// The SDKs are imported DYNAMICALLY: the ~100 KB of Sentry JS stays
// out of the main bundle and off the first-paint path, loading async
// after boot. This module stays tiny and synchronous; the heavy
// modules load only when the DSN + the telemetry flag line up. Errors
// reported while the SDK is still loading are queued (bounded) and
// flushed.
//
// Configuration is via env vars — set VITE_SENTRY_DSN to enable.
// Dev builds without the env var skip Sentry entirely.
//
// User choice: reporting is ON by default (D76), and the local
// `insight.telemetry.v1` flag records an opt-out. The switch lives in
// the account panel (LivePrivacyPanel); an explicit "false" is
// honoured at every send site, not just at init.

type SentryCapacitor = typeof import("@sentry/capacitor");

const TELEMETRY_KEY = "insight.telemetry.v1";

let sdk: SentryCapacitor | null = null;
let loading = false;
let pendingUid: string | null | undefined; // undefined = never set
const queued: Array<[unknown, Record<string, unknown> | undefined]> = [];
const QUEUE_CAP = 20;

export function telemetryEnabled(): boolean {
  // On unless explicitly "false" (D76) — only a recorded opt-out turns
  // reporting off. Unreadable storage also reads as off, deliberately: a
  // store that cannot be read is one that could not have recorded an
  // opt-out either, and silence is the only side that cannot betray a
  // recorded choice.
  try {
    return localStorage.getItem(TELEMETRY_KEY) !== "false";
  } catch {
    return false;
  }
}

export function setTelemetryEnabled(on: boolean): void {
  try {
    localStorage.setItem(TELEMETRY_KEY, on ? "true" : "false");
  } catch {
    // Best-effort; private mode blocks localStorage.
  }
  if (on) {
    sentryInit();
  } else if (sdk) {
    // Already-initialised Sentry cannot be cleanly torn down at runtime, so
    // OFF is enforced at the two send sites (reportError, setSentryUser)
    // rather than trusted to teardown — they gate on consent, not on `sdk`
    // being non-null. Nulling the user and closing the client is the
    // best-effort half; the gates are the half that holds.
    //
    // The panel used to say "Off — nothing is reported" while this ran, and
    // that was false for the rest of the session: ~30 reportError sites, all
    // unhandled exceptions, and 5% of traces kept transmitting, and
    // setSentryUser (reached from wake()) re-attached the uid afterwards, so
    // the residual was uid-linked.
    try {
      sdk.setUser(null);
      sdk.getClient?.()?.close?.();
    } catch {
      // ignore
    }
  }
}

export function sentryInit(): void {
  if (sdk || loading) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  // Honour the recorded opt-out — the LivePrivacyPanel toggle calls
  // sentryInit() again if the flag is flipped back on.
  if (!telemetryEnabled()) return;
  loading = true;
  void (async () => {
    try {
      const [cap, react] = await Promise.all([
        import("@sentry/capacitor"),
        import("@sentry/react"),
      ]);
      cap.init(
        {
          dsn,
          // Tag this build with its env + release so the dashboard can
          // separate dev from production and per-release issues
          // surface separately.
          environment: import.meta.env.MODE,
          release: import.meta.env.VITE_RELEASE_TAG ?? "dev",
          // 1.0 = capture every error. PII default-off — Sentry strips
          // IPs and emails unless we explicitly enable. Keep it off.
          sendDefaultPii: false,
          // Performance monitoring — small sample rate to start.
          tracesSampleRate: 0.05,
          // Session replay stays un-wired on purpose: recording the
          // screen would defeat the privacy contract.
        },
        // The second argument is the JS init invoked from within the
        // Capacitor SDK; for web builds the Capacitor side no-ops and
        // only this React init runs.
        react.init,
      );
      sdk = cap;
      if (pendingUid !== undefined) {
        cap.setUser(pendingUid ? { id: pendingUid } : null);
      }
      for (const [err, ctx] of queued.splice(0)) {
        cap.captureException(err, { extra: ctx });
      }
    } catch (err) {
      console.warn("[sentry] SDK load failed:", err);
    } finally {
      loading = false;
    }
  })();
}

// Manually record a caught exception that the app handled but
// still wants visibility on (e.g. a Firestore write that failed
// after retries). Unhandled errors are captured by Sentry's global
// handlers once the SDK is up.
export function reportError(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  // The opt-out flag, not `sdk`. An SDK initialised before the user opted
  // out is still up, and dispatching on its presence is what made the
  // panel's absolute claim false. Console mirroring below is unaffected:
  // it never leaves the device.
  if (!telemetryEnabled()) {
    if (import.meta.env.DEV || !import.meta.env.VITE_SENTRY_DSN) {
      console.error("[reportError]", err, context);
    }
    return;
  }
  if (sdk) {
    sdk.captureException(err, { extra: context });
    return;
  }
  if (loading && queued.length < QUEUE_CAP) {
    queued.push([err, context]);
  }
  // Mirror to console where it is the ONLY record: dev, or a build with
  // no DSN configured. Once a DSN is set the error is already captured
  // (or queued above), and logging every handled error again is noise in
  // a production console — the reconnect retries make it a stream.
  if (import.meta.env.DEV || !import.meta.env.VITE_SENTRY_DSN) {
    console.error("[reportError]", err, context);
  }
}

// Identify the current user so error reports tie back to their
// account in the dashboard. We send only the uid — never email or
// name — so PII stays out of the reporting pipeline. Safe to call
// before init: the value applies when the SDK comes up.
export function setSentryUser(uid: string | null): void {
  // Same gate. wake() calls this on every foreground, so without it an
  // opted-out session re-attached its uid to a live client — turning the
  // residual from anonymous into identified.
  if (uid && !telemetryEnabled()) return;
  pendingUid = uid;
  if (!sdk) return;
  if (uid) {
    sdk.setUser({ id: uid });
  } else {
    sdk.setUser(null);
  }
}

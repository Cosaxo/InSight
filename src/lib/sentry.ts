// sentry.ts — error + crash reporting, lazily loaded.
//
// Two layers once loaded:
//   - @sentry/capacitor wraps the native iOS / Android crash
//     reporting (its underlying SDK is sentry-cocoa / sentry-android
//     loaded by the Capacitor plugin) AND the JS-layer Sentry.
//   - @sentry/browser provides the JS-layer init the Capacitor SDK
//     wraps. It used to be @sentry/react, and the swap (D101) was worth
//     28 KB of the shipping bundle for nothing given up: the only thing
//     this file ever used from it was `init`, and @sentry/capacitor
//     depends on @sentry/browser DIRECTLY (@sentry/react is merely one
//     of its three framework peers). The React package's actual
//     additions — Sentry's own ErrorBoundary, the Profiler, React Router
//     instrumentation — were never wired: the app boundary is
//     app-shell's own, there is no router, and breadcrumbs need the
//     Profiler nobody mounted. The old comment here listed all three as
//     though they were in use, which is how 28 KB of unreferenced
//     framework code rode along unnoticed.
//
//     @sentry/react stays in package.json on purpose: it satisfies
//     @sentry/capacitor's framework peer alongside angular and vue, and
//     dropping it trades 0 shipped bytes for an install warning. It is
//     no longer imported, so rolldown leaves it out of the bundle —
//     which is the whole win.
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
// Reporting is ON by default (D76) and the account panel's off switch
// is gone (D211) — the owner's call: a release build has no toggle. The
// local `insight.telemetry.v1` flag survives as a READ-ONLY record of
// opt-outs recorded by older builds: nothing writes it any more, but an
// explicit "false" is still honoured at every send site, not just at
// init, because removing a switch must not flip anyone's recorded
// choice.

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

// `setTelemetryEnabled` stood here and left with the panel's switch
// (D211). The OFF half of its job — send-site gating, because an
// initialised SDK cannot be cleanly torn down — is unchanged below:
// reportError and setSentryUser gate on telemetryEnabled(), not on `sdk`
// being non-null, so a recorded opt-out still holds for the whole
// session.

export function sentryInit(): void {
  if (sdk || loading) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  // Honour a recorded opt-out from an older build.
  if (!telemetryEnabled()) return;
  loading = true;
  void (async () => {
    try {
      const [cap, react] = await Promise.all([
        import("@sentry/capacitor"),
        import("@sentry/browser"),
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

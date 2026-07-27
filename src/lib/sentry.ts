// sentry.ts — error + crash reporting init.
//
// Two layers:
//   - @sentry/capacitor wraps the native iOS / Android crash
//     reporting (its underlying SDK is sentry-cocoa / sentry-android
//     loaded by the Capacitor plugin) AND the JS-layer Sentry.
//   - @sentry/react provides the JS error boundary, route
//     instrumentation, and component-aware breadcrumbs.
//
// On web builds the native side is a no-op and only the React init
// runs. On native, both run and unhandled JS errors propagate up
// into the native crash report alongside the stack trace.
//
// Configuration is opt-in via env vars — set VITE_SENTRY_DSN to
// enable. Dev builds without the env var skip Sentry entirely
// (sentryInit returns early), so local dev doesn't spam the
// production project.
//
// User consent: even when a DSN is configured, we honour the local
// `insight.telemetry.v1` flag. The default is "off" — telemetry
// only starts after the user explicitly opts in from Profile.

import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";

const TELEMETRY_KEY = "insight.telemetry.v1";

export function telemetryEnabled(): boolean {
  try {
    return localStorage.getItem(TELEMETRY_KEY) === "true";
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
  } else {
    // Already-initialised Sentry can't be cleanly torn down at runtime;
    // the closest we can do is null the user and stop sending events
    // via the global client. Future events from this session still
    // go out — the toggle takes full effect on the next launch.
    if (initialized) {
      try {
        Sentry.setUser(null);
      } catch {
        // ignore
      }
    }
  }
}

let initialized = false;

export function sentryInit(): void {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  // Gate on user consent. The toggle in ProfileOverlay calls
  // sentryInit() again after flipping the flag on.
  if (!telemetryEnabled()) return;
  Sentry.init(
    {
      dsn,
      // Tag this build with its env + release so the dashboard can
      // separate dev from production and per-release issues
      // surface separately. The release tag matches package.json
      // version at build time; falls back to "dev" when missing.
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_RELEASE_TAG ?? "dev",
      // 1.0 = capture every error. PII default-off — Sentry strips
      // IPs and emails unless we explicitly enable. Keep it off.
      sendDefaultPii: false,
      // Performance monitoring — small sample rate to start. Bump
      // for low-traffic apps wanting better visibility.
      tracesSampleRate: 0.05,
      // Note: session replay isn't wired here. It's available via
      // @sentry/react integrations but inappropriate for a private
      // journal app — recording the screen would defeat the
      // privacy contract. If we ever want it for crash-only
      // diagnostics, add `Sentry.replayIntegration({...})` to
      // integrations[] with explicit user consent.
    },
    // The second argument is the JS init invoked from within the
    // Capacitor SDK; for web builds the Capacitor side no-ops and
    // only this React init runs.
    SentryReact.init,
  );
  initialized = true;
}

// Manually record a caught exception that the app handled but
// still wants visibility on (e.g. a Firestore write that failed
// after retries). The default behaviour for unhandled errors is
// already captured by Sentry's global handlers.
export function reportError(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  if (!initialized) {
    // Fall back to console so dev / unconfigured builds still surface.
    console.error("[reportError]", err, context);
    return;
  }
  Sentry.captureException(err, { extra: context });
}

// Identify the current user. Called from useAuth when the user
// signs in / out so error reports tie back to their account in
// the dashboard. We send only the uid — never email or name — so
// PII stays out of the reporting pipeline.
export function setSentryUser(uid: string | null): void {
  if (!initialized) return;
  if (uid) {
    Sentry.setUser({ id: uid });
  } else {
    Sentry.setUser(null);
  }
}

// Re-export the ErrorBoundary so callers can wrap a tree with it.
// The React component knows how to talk to Sentry's globals when
// init has run; when it hasn't, it falls back to a no-op boundary
// that just re-throws.
export const SentryErrorBoundary = SentryReact.ErrorBoundary;

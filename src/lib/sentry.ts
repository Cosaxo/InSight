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

import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";

let initialized = false;

export function sentryInit(): void {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
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

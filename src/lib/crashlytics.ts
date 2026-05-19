// crashlytics.ts — Firebase Crashlytics bridge for native builds.
//
// Crashlytics complements Sentry at the native crash layer:
//   - Sentry: better JS-side dashboarding + source maps + breadcrumbs.
//   - Crashlytics: deeper iOS / Android crash detection (ANR
//     reporting, native-side crashes the JS layer can't see).
//
// Capacitor plugin auto-collects native crashes once linked into
// the iOS / Android projects. Beyond that, this module exposes a
// small helper for the app to push explicit breadcrumbs / handled
// exceptions when something fails gracefully.
//
// Web builds: every call is a no-op. The plugin lazily resolves
// to web stubs that don't fail but don't transmit either.

import { Capacitor } from "@capacitor/core";
import { FirebaseCrashlytics } from "@capacitor-firebase/crashlytics";

const isNative = Capacitor.isNativePlatform();

// Set the current user id on Crashlytics so reports tie to an
// account. Only the uid — no email or name.
export async function setCrashlyticsUser(uid: string | null): Promise<void> {
  if (!isNative) return;
  try {
    await FirebaseCrashlytics.setUserId({ userId: uid ?? "" });
  } catch (err) {
    // Crashlytics isn't configured (e.g. GoogleService-Info.plist
    // missing in the iOS project). Don't bubble.
    console.warn("[crashlytics] setUserId failed:", err);
  }
}

// Record a handled exception. Use this for errors the app caught
// and recovered from but still wants visibility on.
export async function recordHandledError(
  err: unknown,
  context?: Record<string, string | number | boolean>,
): Promise<void> {
  if (!isNative) return;
  try {
    if (context) {
      // Crashlytics custom keys are typed; coerce to strings for
      // any non-primitive context fields.
      for (const [k, v] of Object.entries(context)) {
        await FirebaseCrashlytics.setCustomKey({
          key: k,
          value: typeof v === "boolean" || typeof v === "number"
            ? v
            : String(v),
          type:
            typeof v === "number" ? "double"
            : typeof v === "boolean" ? "boolean"
            : "string",
        });
      }
    }
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error && err.stack ? err.stack : undefined;
    await FirebaseCrashlytics.recordException({
      message,
      ...(stack && { stacktrace: stack.split("\n").map((line) => ({
        fileName: "",
        lineNumber: 0,
        methodName: line.trim(),
      })) }),
    });
  } catch (innerErr) {
    console.warn("[crashlytics] recordException failed:", innerErr);
  }
}

// Push a log breadcrumb that appears in the crash report timeline.
// Cheap; safe to call frequently.
export async function crashlyticsLog(message: string): Promise<void> {
  if (!isNative) return;
  try {
    await FirebaseCrashlytics.log({ message });
  } catch {
    // ignore
  }
}

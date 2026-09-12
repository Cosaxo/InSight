// localWrite.ts — the guarded `localStorage.setItem`, and the sensor on it.
//
// EXTRACTED FROM live.ts (D-2026-09-09h), which is the first slice of that
// file to move and is here as much to prove the method as to shrink the
// number. `live.ts` was 8,682 lines and took one commit in ten in the whole
// repository; the safety net for taking pieces out of it already existed
// and nobody had used it — `src/v2/test/live-surface.ts` pins all 95
// exported members and 57 suites mock the module rather than its
// internals, so a slice whose seam is inside the module cannot change the
// facade. This one is the cleanest such seam in the file: the two
// functions below touch exactly one thing outside themselves, a counter,
// and it is passed in.
//
// ── the instrument itself (docs/ANSWER-SCALE.md §2.1) ────────────────
//
// Every `insight.*` write in this tree is guarded-and-swallowed, which is
// the right degradation and a terrible sensor: the quota is per-origin, so
// the day it fills EVERY store silently stops persisting at once — and the
// caches that fill it grow with what the account has ANSWERED, which no
// static gate can see (question-quality.mjs's bank budget watches the
// bank's half and assumes the rest stays small). This is the sensor, not a
// fix: count every swallowed write, and report the first QUOTA-shaped
// failure once per session with the key and the size that failed, so the
// deadline for moving the caches off localStorage arrives as dated reports
// from real devices instead of as users whose app stopped remembering.
//
// Detection only, deliberately — the write stays best-effort and the
// in-memory state stays correct, exactly as before. Quota is told apart
// from a merely absent storage (private mode, disabled) because the two
// mean different things: absence is an environment, quota is the box
// filling, and only the second is the condition ANSWER-SCALE exists for.
import { reportError } from "../../lib/sentry";

export function isQuotaError(err: unknown): boolean {
  const e = err as { name?: string; code?: number } | null | undefined;
  // The spec'd name, plus the legacy spellings that still reach real
  // devices: old WebKit throws code 22, old Firefox NS_ERROR_DOM_QUOTA_
  // REACHED / code 1014.
  return !!e && (e.name === "QuotaExceededError"
    || e.name === "NS_ERROR_DOM_QUOTA_REACHED"
    || e.code === 22 || e.code === 1014);
}

/**
 * Build the guarded writer, with the store's failure counter passed in.
 *
 * A FACTORY rather than a function taking a callback per call, for two
 * reasons that are both about the nine call sites in live.ts. They keep
 * their exact spelling — `lsSet(key, value)` — so the extraction moves no
 * behaviour and reads as a pure move in a diff. And `quotaReported` is
 * per-writer rather than per-module, so a test can build a fresh one and
 * get the first-report-only behaviour again without reaching into module
 * state to reset a flag; the old version's `let quotaReported = false` at
 * module scope was exactly the thing that made that awkward.
 */
export function makeLsSet(onFailure: () => void): (key: string, value: string) => void {
  let quotaReported = false;
  return function lsSet(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      onFailure();
      if (isQuotaError(err) && !quotaReported) {
        quotaReported = true;
        reportError(
          new Error(`localStorage quota exceeded writing ${key} (${value.length} chars)`),
          { where: "quota" },
        );
      }
    }
  };
}

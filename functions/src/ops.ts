// ops.ts — shared operator-gating + App Check enforcement knobs.
//
// Operator gate: the full-scan rebuild/seed callables walk entire
// collections. They are ops hooks, not user features — the scheduled
// variants keep production fresh — so leaving them open to any
// signed-in (even anonymous) account is a free cost-amplification
// lever. The emulator is always allowed so local dev and the e2e
// loop keep working; in production the caller must be listed in
// SEED_ADMIN_UIDS (same contract seedContentV2 has used all along).

import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";

export function seedAdmins(): string[] {
  return (process.env.SEED_ADMIN_UIDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function assertOperator(request: CallableRequest): void {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "must be signed in");
  }
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  if (!isEmulator && !seedAdmins().includes(request.auth.uid)) {
    throw new HttpsError("permission-denied", "operator-only");
  }
}

// App Check enforcement for user-facing callables. Evaluated at load
// time (the CLI bakes it into each function's config at deploy):
//   - emulator: always OFF, so the local e2e loop and dev clients
//     (which skip App Check init entirely) keep working;
//   - production: ON by default. Deploy with APPCHECK_ENFORCE=false
//     to soft-disable if client attestation is ever misconfigured —
//     flipping a deploy env var beats shipping a code change during
//     an incident.
// The client side is already wired (src/lib/appcheck.ts): reCAPTCHA
// v3 on web via VITE_APPCHECK_RECAPTCHA_SITE_KEY, DeviceCheck / Play
// Integrity on native. Debug builds register a debug token.
export const ENFORCE_APP_CHECK =
  process.env.FUNCTIONS_EMULATOR !== "true" &&
  process.env.APPCHECK_ENFORCE !== "false";

// ── Runtime options ─────────────────────────────────────────────
//
// Set GLOBALLY rather than per-function so that "no function is left on
// the defaults" is structural: a new export inherits these instead of
// silently shipping at 256 MiB / 60 s, which is what every function here
// used to do. The full-scan aggregators read whole collections into
// memory and would hit that 60 s wall long before any of their in-code
// tripwires fired; deleteAccount, a store requirement, died there on any
// account with real history.
//
// concurrency: the gen-2 default is 80 requests per instance, so one
// instance could run 80 simultaneous full-collection scans in 256 MiB.
// These jobs are memory-heavy and not IO-bound, so 1 per instance is the
// honest setting — but note it is NOT a global mutex: see the per-function
// overrides below, and DECISIONS.md D7.
//
// NOTE: the emulator ignores memory, timeout and concurrency entirely.
// The only real verification is post-deploy:
//   gcloud functions describe <name> --gen2 --region us-central1 \
//     --format="value(serviceConfig.timeoutSeconds,serviceConfig.availableMemory)"
setGlobalOptions({
  region: "us-central1",
  memory: "512MiB",
  // 8 minutes. Deliberately not 540 (the gen-2 max): the scheduler's
  // attemptDeadline should not be exactly equal to the function's own wall
  // clock, or a retry can start while the first attempt is still finishing.
  timeoutSeconds: 480,
  concurrency: 1,
  maxInstances: 10,
});

// Why HERE and not in index.ts: `export { x } from "./v2"` is a hoisted
// re-export, so v2.ts and v2social.ts are fully evaluated — defining their
// functions — BEFORE any statement in index.ts's body runs. setGlobalOptions
// placed there would apply to index.ts's own functions and silently miss
// every v2 one. ops.ts is imported by all three and imports none of them,
// so it is evaluated first in every case.

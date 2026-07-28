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

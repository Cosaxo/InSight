// deviceBind.ts — D29: one counted account per physical device per month.
//
//   activateDeviceV2    the silent activation gate. The client sends a
//                       platform attestation token; this verifies it with
//                       Apple (DeviceCheck two bits) or Google (Play
//                       Integrity Device Recall), applies the month rule,
//                       and stamps the `db` custom claim that
//                       firestore.rules requires on aggregate-feeding
//                       answer writes once deviceBindEnforced() is true.
//
// What this closes: on a single genuine device, clear app storage → fresh
// anonymous uid → vote again. App Check passes (real app, real device),
// rules pass (new uid), and the loop repeats forever. The per-device bits
// bound it to one counted account per device per calendar month.
//
// The privacy property that makes this the on-brand control: the bits live
// with Apple/Google keyed to the DEVICE; the claim lives on the auth user
// carrying nothing about the device. This server sees allow/deny and
// stores no device identifier — there is nothing here to erase, leak, or
// subpoena, which is why deleteAccount needs no new phase for it (D29).
//
// Endpoint shapes below are from D29's verify-before-build list. The pure
// decision logic is unit-tested (deviceBind.test.ts); the Apple/Google
// round trips cannot run in the emulator and are exercised by the staging
// probe in docs/DEVICE-BIND.md — which also carries the native token
// bridges and the console steps this callable needs before it can succeed
// in production. Until those land, activation fails loud and soft-enforce
// (rules) means no vote is refused.

import { createPrivateKey, randomUUID, sign as cryptoSign } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { GoogleAuth } from "google-auth-library";
import { ENFORCE_APP_CHECK, LIGHT_CALLABLE, FUNCTIONS_REGION } from "./ops";

const REGION = FUNCTIONS_REGION;

// ── pure decision logic (unit-tested) ───────────────────────────

// UTC calendar month, "YYYY-MM". The cooldown clock for both platforms:
// chosen because it is DeviceCheck's native last_update_time granularity,
// so iOS needs no encoding tricks at all (D29).
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface TwoBits {
  bit0: boolean;
  bit1: boolean;
  // Apple returns "YYYY-MM". Absent on some responses; treated as
  // "not this month", which fails open by at most one activation.
  last_update_time?: string;
}

// iOS rule: allow unless this device already activated this calendar
// month. bit0 = "an account was activated from this device"; the write
// refreshes Apple's month stamp, so bit0 + current month = cooldown.
// bits === null is the never-seen device (Apple's "Failed to find bit
// state") — always allowed.
export function decideDeviceCheck(bits: TwoBits | null, now: Date): boolean {
  if (!bits || !bits.bit0) return true;
  // Normalize BOTH sides — comparing a normalized stamp against the raw
  // "YYYY-MM" key can never match, which silently disables the cooldown.
  // The unit test for separator differences exists because this exact bug
  // shipped in the first draft of this function.
  return normalizeMonth(bits.last_update_time) !== normalizeMonth(monthKey(now));
}

// Play's recall write dates and Apple's last_update_time are recorded in
// D29 as "YYYYMM"-ish and "YYYY-MM" respectively — normalize both to
// digits-only prefix comparison so a separator difference cannot silently
// disable the cooldown (fail direction: a format surprise makes months
// never match, which allows rather than blocks — wrong but recoverable,
// and logged at the call sites).
function normalizeMonth(raw: string | undefined): string {
  return (raw || "").replace(/[^0-9]/g, "").slice(0, 6);
}

export interface RecallValues {
  bitFirst: boolean;
  bitSecond: boolean;
  bitThird: boolean;
}
export interface RecallWriteDates {
  bitFirstWriteDate?: string;
  bitSecondWriteDate?: string;
  bitThirdWriteDate?: string;
}

// Android epoch fallback (D29): when the verdict carries recall values but
// no usable write dates, encode the month in the three bits as
// (monthIndex mod 7) + 1 — seven non-zero states, so a returning device
// only collides with the current stamp after an absence that is an exact
// multiple of 7 months, and then waits out at most that month.
export function recallEpoch(now: Date): number {
  const months = now.getUTCFullYear() * 12 + now.getUTCMonth();
  return (months % 7) + 1;
}

export function encodeRecall(state: number): RecallValues {
  return {
    bitFirst: (state & 1) !== 0,
    bitSecond: (state & 2) !== 0,
    bitThird: (state & 4) !== 0,
  };
}

export function decodeRecall(v: RecallValues): number {
  return (v.bitFirst ? 1 : 0) | (v.bitSecond ? 2 : 0) | (v.bitThird ? 4 : 0);
}

// The Android decision. Write dates, when present, give the month-exact
// rule (mirror of iOS); otherwise the epoch encoding decides. The value
// written on allow is ALWAYS the epoch encoding — it round-trips under
// both read paths, so mixed histories (a device first seen before write
// dates existed, or vice versa) stay decidable.
export function decideRecall(
  values: RecallValues | null | undefined,
  writeDates: RecallWriteDates | null | undefined,
  now: Date,
): { allow: boolean; next: RecallValues } {
  const next = encodeRecall(recallEpoch(now));
  if (!values || decodeRecall(values) === 0) return { allow: true, next };
  const dates = [
    values.bitFirst ? writeDates?.bitFirstWriteDate : undefined,
    values.bitSecond ? writeDates?.bitSecondWriteDate : undefined,
    values.bitThird ? writeDates?.bitThirdWriteDate : undefined,
  ].filter((d): d is string => typeof d === "string" && d.length > 0);
  if (dates.length > 0) {
    const nowMonth = normalizeMonth(monthKey(now));
    return { allow: !dates.some((d) => normalizeMonth(d) === nowMonth), next };
  }
  return { allow: decodeRecall(values) !== recallEpoch(now), next };
}

// Apple's server API wants an ES256 JWT (iss = team id, kid = key id).
// Hand-rolled on node:crypto rather than a JWT dependency: the compact
// form is three base64url segments and ES256 needs the raw r||s signature,
// which `dsaEncoding: "ieee-p1363"` produces. Verified round-trip in
// deviceBind.test.ts against crypto.verify.
export function buildAppleJwt(
  teamId: string,
  keyId: string,
  privateKeyPem: string,
  now: Date,
): string {
  const b64u = (b: Buffer) => b.toString("base64url");
  const header = b64u(Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })));
  const payload = b64u(
    Buffer.from(JSON.stringify({ iss: teamId, iat: Math.floor(now.getTime() / 1000) })),
  );
  const signingInput = `${header}.${payload}`;
  const key = createPrivateKey(privateKeyPem);
  const sig = cryptoSign("sha256", Buffer.from(signingInput), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${signingInput}.${b64u(sig)}`;
}

// ── platform round trips (staging-probed, not emulator-testable) ─

// Secrets arrive as env vars (the SEED_ADMIN_UIDS pattern —
// docs/DEPLOYMENT.md lists them). The PEM commonly lands with literal \n
// in env storage; normalize.
function appleConfig(): { teamId: string; keyId: string; pem: string; host: string } | null {
  const teamId = process.env.DC_TEAM_ID;
  const keyId = process.env.DC_KEY_ID;
  const pemRaw = process.env.DC_PRIVATE_KEY;
  if (!teamId || !keyId || !pemRaw) return null;
  return {
    teamId,
    keyId,
    pem: pemRaw.replace(/\\n/g, "\n"),
    host:
      process.env.DC_ENV === "development"
        ? "https://api.development.devicecheck.apple.com"
        : "https://api.devicecheck.apple.com",
  };
}

async function appleCall(
  cfg: { teamId: string; keyId: string; pem: string; host: string },
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${cfg.host}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${buildAppleJwt(cfg.teamId, cfg.keyId, cfg.pem, new Date())}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
}

async function iosActivate(deviceToken: string, now: Date): Promise<boolean> {
  const cfg = appleConfig();
  if (!cfg) {
    // Fail loud, not open: an unconfigured verifier that granted claims
    // would make the whole gate decorative. Soft-enforce (rules) is what
    // keeps this from hurting users before the console steps land.
    throw new HttpsError("failed-precondition", "DeviceCheck not configured");
  }
  const query = await appleCall(cfg, "/v1/query_two_bits", {
    device_token: deviceToken,
    transaction_id: randomUUID(),
    timestamp: Date.now(),
  });
  let bits: TwoBits | null = null;
  if (query.ok) {
    // A device Apple has never stored bits for answers 200 with the
    // literal string "Failed to find bit state" instead of JSON.
    const text = await query.text();
    try {
      bits = JSON.parse(text) as TwoBits;
    } catch {
      bits = null;
    }
  } else if (query.status === 401 || query.status === 403) {
    logger.error(`[deviceBind] DeviceCheck auth rejected (${query.status}) — key misconfigured?`);
    throw new HttpsError("failed-precondition", "DeviceCheck credentials rejected");
  } else {
    logger.warn(`[deviceBind] DeviceCheck query failed: ${query.status}`);
    throw new HttpsError("unavailable", "attestation service unreachable");
  }
  if (!decideDeviceCheck(bits, now)) return false;
  const update = await appleCall(cfg, "/v1/update_two_bits", {
    device_token: deviceToken,
    transaction_id: randomUUID(),
    timestamp: Date.now(),
    bit0: true,
    bit1: bits?.bit1 ?? false,
  });
  if (!update.ok) {
    // The claim must not outrun the bits: granting after a failed write
    // would let one device activate freely until the write recovers.
    logger.warn(`[deviceBind] DeviceCheck update failed: ${update.status}`);
    throw new HttpsError("unavailable", "attestation service unreachable");
  }
  return true;
}

async function androidActivate(integrityToken: string, now: Date): Promise<boolean> {
  const pkg = process.env.PLAY_PACKAGE_NAME || "com.cosaxo.insight";
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/playintegrity"] });
  const client = await auth.getClient();
  let payload: {
    requestDetails?: { requestPackageName?: string };
    deviceIntegrity?: { deviceRecognitionVerdict?: string[] };
    deviceRecall?: { values?: RecallValues; writeDates?: RecallWriteDates };
  };
  try {
    const res = await client.request<{ tokenPayloadExternal?: typeof payload }>({
      url: `https://playintegrity.googleapis.com/v1/${pkg}:decodeIntegrityToken`,
      method: "POST",
      data: { integrityToken },
    });
    payload = res.data?.tokenPayloadExternal ?? {};
  } catch (err) {
    logger.warn("[deviceBind] Play Integrity decode failed:", err);
    throw new HttpsError("unavailable", "attestation service unreachable");
  }
  if (payload.requestDetails?.requestPackageName !== pkg) {
    throw new HttpsError("failed-precondition", "token is for a different app");
  }
  const verdict = payload.deviceIntegrity?.deviceRecognitionVerdict || [];
  if (!verdict.includes("MEETS_DEVICE_INTEGRITY")) {
    // Rooted / emulated / tampered. Not a cooldown — this device cannot
    // activate at all, same population App Check enforcement excludes.
    throw new HttpsError("failed-precondition", "device integrity not met");
  }
  const recall = payload.deviceRecall;
  if (!recall) {
    // Recall unavailable (not opted in yet, or an integrity-passing device
    // the API cannot recall). D29 records the policy: the integrity verdict
    // still gates, the month bound does not — logged so the rate of these
    // is visible before enforcement flips.
    logger.warn(`[deviceBind] verdict without deviceRecall for ${pkg} — allowing on integrity alone`);
    return true;
  }
  const { allow, next } = decideRecall(recall.values, recall.writeDates, now);
  if (!allow) return false;
  try {
    await client.request({
      url: `https://playintegrity.googleapis.com/v1/${pkg}:writeDeviceRecall`,
      method: "POST",
      data: { integrityToken, values: next },
    });
  } catch (err) {
    // Same rule as iOS: no write, no claim.
    logger.warn("[deviceBind] Play Integrity recall write failed:", err);
    throw new HttpsError("unavailable", "attestation service unreachable");
  }
  return true;
}

// ── the callable ────────────────────────────────────────────────

async function grant(uid: string): Promise<void> {
  const user = await getAuth().getUser(uid);
  // Merge, not replace: setCustomUserClaims overwrites the whole map, and
  // a future claim added elsewhere must survive activation re-runs.
  await getAuth().setCustomUserClaims(uid, { ...(user.customClaims || {}), db: 1 });
}

export const activateDeviceV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
    const uid = request.auth.uid;
    const platform = request.data?.platform;
    if (platform !== "ios" && platform !== "android" && platform !== "web") {
      throw new HttpsError("invalid-argument", "platform must be ios|android|web");
    }
    // Emulator: grant unconditionally, so the e2e loop, the rules claim
    // path, and dev-in-a-browser all work without Apple/Google — the
    // seedContentV2 gating pattern.
    if (process.env.FUNCTIONS_EMULATOR === "true") {
      await grant(uid);
      return { ok: true };
    }
    if (platform === "web") {
      // Production has no web build (hosting serves only the legal pages
      // and the join fallback), so a production web caller is a script.
      throw new HttpsError("failed-precondition", "no web activation path");
    }
    const token = request.data?.token;
    if (typeof token !== "string" || !token || token.length > 65536) {
      throw new HttpsError("invalid-argument", "missing attestation token");
    }
    const now = new Date();
    const allow =
      platform === "ios" ? await iosActivate(token, now) : await androidActivate(token, now);
    if (!allow) {
      // Expected outcome, not an error: this device already bought its
      // account this month. The client memoizes and retries next month.
      logger.info(`[deviceBind] cooldown for uid=${uid} platform=${platform}`);
      return { ok: false, reason: "cooldown" };
    }
    await grant(uid);
    logger.info(`[deviceBind] activated uid=${uid} platform=${platform}`);
    return { ok: true };
  },
);

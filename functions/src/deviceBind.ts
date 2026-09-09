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
import { levelFor, levelDef } from "./accountLevel";

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

/**
 * What Apple's 200 actually said.
 *
 * A DEVICE APPLE HAS NEVER SEEN answers 200 with the literal string
 * "Failed to find bit state" rather than JSON — one documented body, and
 * the only one that means "never seen". The caller used to `JSON.parse`
 * the body and fold EVERY failure into `bits = null`, which
 * `decideDeviceCheck` reads as never-seen and allows. So a captive portal
 * page, or a changed Apple error format, or anything else that comes back
 * 200 and is not JSON, published the fact "this device has not activated
 * this month" and opened the monthly cooldown (D29).
 *
 * `JSON.parse("123")` reached the same place by a second route: it
 * succeeds, `bits.bit0` is undefined, and `!bits.bit0` allows.
 *
 * Exported and pure for the reason `volumeFlagged` in velocity.ts is: the
 * decision lived inline in a callable no test reaches, so both halves
 * could be reverted with every suite green.
 *
 * A failed READ is not a fact about the device — the 401/403 arm beside
 * the call site already throws rather than granting, and this is the same
 * rule for the body.
 */
export type TwoBitsRead =
  | { kind: "never-seen" }
  | { kind: "bits"; bits: TwoBits }
  | { kind: "unreadable" };

export function readTwoBits(text: string): TwoBitsRead {
  if (/Failed to find bit state/i.test(text)) return { kind: "never-seen" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: "unreadable" };
  }
  // A number, a string, a bare `null` and an array are all valid JSON and
  // none of them is a bit state.
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { kind: "unreadable" };
  }
  return { kind: "bits", bits: parsed as TwoBits };
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
/**
 * Play's own write-date shape, confirmed against the live discovery
 * document and not invented.
 *
 * This declared `bitFirstWriteDate?: string` and friends. Google sends
 * `yyyymmFirst` / `yyyymmSecond` / `yyyymmThird` as int32 — "Write time in
 * YYYYMM format (in UTC, e.g. 202402) … won't be set if the bit is false".
 * Different keys AND a different type, so the old `typeof d === "string"`
 * filter emptied the list on every real verdict and `decideRecall` always
 * fell through to the epoch fallback, while its docstring said write
 * dates give the month-exact rule. The test built the invented shape
 * itself and called it "Google's date format", so nothing could notice.
 *
 * A numeric string is accepted alongside the number: this shape has been
 * guessed wrong once already, and the normaliser below strips non-digits
 * either way.
 */
export interface RecallWriteDates {
  yyyymmFirst?: number | string;
  yyyymmSecond?: number | string;
  yyyymmThird?: number | string;
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
    values.bitFirst ? writeDates?.yyyymmFirst : undefined,
    values.bitSecond ? writeDates?.yyyymmSecond : undefined,
    values.bitThird ? writeDates?.yyyymmThird : undefined,
  ]
    .map((d) => normalizeMonth(typeof d === "number" ? String(d) : d))
    .filter((d) => d.length === 6);
  if (dates.length > 0) {
    const nowMonth = normalizeMonth(monthKey(now));
    return { allow: !dates.some((d) => d === nowMonth), next };
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
    // `readTwoBits` has the argument: only Apple's one documented
    // non-JSON body means "never seen", and everything else unreadable is
    // a failed read rather than a fact about the device.
    const read = readTwoBits(await query.text());
    if (read.kind === "unreadable") {
      logger.warn("[deviceBind] DeviceCheck answered 200 with a body that is not a bit state");
      throw new HttpsError("unavailable", "attestation service unreadable");
    }
    bits = read.kind === "bits" ? read.bits : null;
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

/**
 * What the signed payload has to say about the request before any verdict
 * in it is worth reading. Pure and exported so the two refusals are pinned
 * by unit tests — neither can be reached from the emulator, and both are
 * the kind of check that is easy to write inverted.
 *
 * The nonce arm is REQUIRED on Android rather than best-effort. Play
 * refuses to build a request without a nonce, so a token that carries none
 * did not come from this app's bridge; treating that as acceptable would
 * make the check decorative, which is the failure mode this whole area
 * already had once (D342).
 */
export function requestDetailsProblem(
  details: { requestPackageName?: string; nonce?: string } | undefined,
  pkg: string,
  nonce: string | undefined,
): string | null {
  if (details?.requestPackageName !== pkg) return "token is for a different app";
  if (!nonce) return "missing integrity nonce";
  if (details?.nonce !== nonce) return "integrity nonce does not match";
  return null;
}

async function androidActivate(
  integrityToken: string,
  nonce: string | undefined,
  now: Date,
): Promise<boolean> {
  const pkg = process.env.PLAY_PACKAGE_NAME || "com.cosaxo.insight";
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/playintegrity"] });
  const client = await auth.getClient();
  let payload: {
    requestDetails?: { requestPackageName?: string; nonce?: string };
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
  const problem = requestDetailsProblem(payload.requestDetails, pkg, nonce);
  if (problem) {
    logger.warn(`[deviceBind] Play Integrity request rejected: ${problem}`);
    throw new HttpsError("failed-precondition", problem);
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
    // THE ENDPOINT AND THE FIELD NAME, both confirmed against Google's
    // live discovery document and on the wire.
    //
    // This posted to `v1/{pkg}:writeDeviceRecall` with `{ values }`. The
    // method is `deviceRecall:write` under `v1/{+packageName}`, and the
    // request field is `newValues`. Measured: the old URL answers 404 and
    // this one answers 401 (auth required), while the decode call beside
    // it — which is correct — also answers 401, so the difference is the
    // path and not the sandbox.
    //
    // What that cost: every Android activation reaching a device with
    // recall bits threw, the catch below turned it into `unavailable`, and
    // no Android account ever earned the device rung. Enforcement is off
    // (`deviceBindEnforced()` is false), so nobody was refused — but D29's
    // month bound was inert on Android, and the readiness metric could not
    // see it, because that log line fires on the OTHER branch. Turning
    // enforcement on with the old call would have locked Android out.
    //
    // docs/DEVICE-BIND.md asks for exactly this confirmation before
    // relying on staging results.
    await client.request({
      url: `https://playintegrity.googleapis.com/v1/${pkg}/deviceRecall:write`,
      method: "POST",
      data: { integrityToken, newValues: next },
    });
  } catch (err) {
    // Same rule as iOS: no write, no claim.
    logger.warn("[deviceBind] Play Integrity recall write failed:", err);
    throw new HttpsError("unavailable", "attestation service unreachable");
  }
  return true;
}

// ── the callable ────────────────────────────────────────────────

/**
 * Compute this account's level from what is true NOW, and ratchet the claim
 * to it. Returns the resulting level.
 *
 * ONE FETCH. The user record carries both halves — the prior claim and
 * `providerData`, which firebase-admin documents as "providers linked to
 * the user". That is the authoritative source for the identity rung, and
 * the reason this does not read the token's `sign_in_provider`: that field
 * is the provider used to SIGN IN, and this app links rather than signs in
 * (D134), so it says "anonymous" for the life of a linked account.
 *
 * `deviceBoundNow` is false on a cooldown, and the `|| prior >= 1` below is
 * what makes the identity rung reachable at all. Activation runs once, at
 * boot; linking happens later, from settings. Without this, an account that
 * links after activating could never be re-graded — every later call is a
 * cooldown, and a cooldown that refused to look would freeze the account at
 * level 1 forever.
 *
 * A cooldown for an account with prior 0 is a DIFFERENT account on a device
 * that already spent its month, and it gets nothing: the device rung is
 * earned per account, and `prior >= 1` is the record that THIS account
 * earned it.
 *
 * NEVER LOWERS. An account whose providerData momentarily reads empty must
 * not be demoted, because a demotion silently stops that person's votes
 * counting with nothing on screen to explain it. Levels ratchet up.
 */
/** The auth surface `regrade` needs, so its arithmetic can be tested
 *  without an emulator. `regrade` below is the one-line binding to the
 *  real thing; `regradeWith` is what every case drives. */
export interface RegradeAuth {
  getUser(uid: string): Promise<{
    customClaims?: Record<string, unknown> | undefined;
    providerData: Array<{ providerId: string }>;
  }>;
  setCustomUserClaims(uid: string, claims: Record<string, unknown>): Promise<void>;
}

/**
 * EXPORTED and seam-taking, because nothing reached this.
 *
 * Both invariants in the docblock above could be inverted with the whole
 * functions suite green: dropping the `Math.max` ratchet, and dropping
 * `prior >= 1` so a cooldown re-grade can no longer see the device rung —
 * which makes level 2 unreachable, the exact bug D343 records fixing. The
 * e2e calls the callable once on a fresh account and asserts only that it
 * returned ok, so it reaches neither arm either.
 *
 * This is the code that decides whether a real person's votes count once
 * `deviceBindEnforced()` flips. It should not be the untested part.
 */
export async function regradeWith(
  auth: RegradeAuth, uid: string, deviceBoundNow: boolean,
): Promise<number> {
  const user = await auth.getUser(uid);
  const raw = user.customClaims?.db;
  // An integer only, matching what firestore.rules accepts — its `>=`
  // errors on a string or a boolean and denies. Coercing would read
  // `db: true` as level 1.
  const prior = typeof raw === "number" && Number.isInteger(raw) ? raw : 0;
  const level = levelFor({
    deviceBound: deviceBoundNow || prior >= 1,
    linkedProviders: user.providerData.map((p) => p.providerId),
  });
  const next = Math.max(prior, level);
  if (next === prior) return prior;
  // Merge, not replace: setCustomUserClaims overwrites the whole map, and
  // a future claim added elsewhere must survive activation re-runs.
  await auth.setCustomUserClaims(uid, { ...(user.customClaims || {}), db: next });
  return next;
}

async function regrade(uid: string, deviceBoundNow: boolean): Promise<number> {
  return regradeWith(getAuth() as unknown as RegradeAuth, uid, deviceBoundNow);
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
      const level = await regrade(uid, true);
      return { ok: true, level };
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
    // Android's Play Integrity nonce, echoed back by the platform inside
    // the signed payload. Length-bounded like the token for the same
    // reason: this is an unauthenticated-shaped input on an App
    // Check-enforced callable, and neither field is ever long.
    const nonce = request.data?.nonce;
    if (nonce !== undefined && (typeof nonce !== "string" || nonce.length > 1024)) {
      throw new HttpsError("invalid-argument", "bad nonce");
    }
    const now = new Date();
    const allow =
      platform === "ios" ? await iosActivate(token, now) : await androidActivate(token, nonce, now);
    if (!allow) {
      // Expected outcome, not an error: this device already bought its
      // account this month. The client memoizes and retries next month.
      //
      // STILL RE-GRADE. For the account that bought it, a cooldown carries
      // no new device fact but the IDENTITY fact may have moved since —
      // this is the only path by which an account that links after
      // activating ever reaches level 2. For any other account on this
      // device, prior is 0 and regrade returns 0.
      const level = await regrade(uid, false);
      logger.info(`[deviceBind] cooldown for uid=${uid} platform=${platform} level=${level}`);
      return { ok: false, reason: "cooldown", level };
    }
    const level = await regrade(uid, true);
    logger.info(
      `[deviceBind] activated uid=${uid} platform=${platform} level=${level} (${levelDef(level).key})`,
      { metric: "device_activated", platform, level },
    );
    return { ok: true, level };
  },
);

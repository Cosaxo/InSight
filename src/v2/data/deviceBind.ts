// Client half of D29 device binding: one silent activation per account,
// fire-and-forget from the live boot (the push.ts pattern).
//
// The exchange: obtain a platform attestation token (DeviceCheck on iOS,
// Play Integrity on Android — via the tiny native bridge documented in
// docs/DEVICE-BIND.md), send it to activateDeviceV2, which checks the
// per-device bits Apple/Google hold and stamps the `db` custom claim the
// answer rules require once deviceBindEnforced() flips. No UI, no prompt;
// every failure path is "try again on a later boot", because until the
// rules flip nothing is gated, and after it the claim is the difference
// between counting and not counting — never between using the app and not.
//
// What is stored on the device: one localStorage memo so a settled account
// does not re-run attestation every boot. What is stored about the device:
// nothing, anywhere — the server receives allow/deny from the platform and
// keeps no device identifier (D29's privacy shape).
import { Capacitor, registerPlugin } from "@capacitor/core";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth } from "firebase/auth";
import { getDb } from "../../lib/firebase";
import { reportError } from "../../lib/sentry";
import { FUNCTIONS_REGION } from "../../lib/region";

const KEY = "insight.deviceBind.v1";

// UTC calendar month, "YYYY-MM" — must agree with the server's monthKey
// (functions/src/deviceBind.ts): the memo's cooldown expiry is the same
// month boundary the server's bits enforce.
export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface BindMemo {
  uid: string;
  // Present only while cooling down: the month the cooldown was observed.
  // A memo with no `until` means this uid is activated — permanent.
  until?: string;
}

export function parseBindMemo(raw: string | null): BindMemo | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as BindMemo;
    if (v && typeof v.uid === "string" && v.uid) return v;
  } catch {
    /* corrupt memo → re-attempt, which is always safe */
  }
  return null;
}

export function activationPlan(
  memo: BindMemo | null,
  uid: string,
  now: Date,
): "skip" | "attempt" {
  if (!memo || memo.uid !== uid) return "attempt"; // new or switched account
  if (!memo.until) return "skip"; // activated
  // Cooldown memo: spare the attestation round trip only within the month
  // it was observed. Not load-bearing — the server re-checks regardless —
  // just polite to the platform APIs and the battery.
  return memo.until === monthKey(now) ? "skip" : "attempt";
}

/**
 * Drop the activation memo so the NEXT BOOT re-runs activation.
 *
 * WHY THIS IS NEEDED AT ALL. Activation runs once, at boot, and memoizes —
 * `activationPlan` returns "skip" for a settled account forever after.
 * Linking happens later, from the account panel. Without this, an account
 * that links after activating would keep the level it was graded at, and
 * the identity rung (accountLevel.ts level 2) would be unreachable by the
 * only path the app actually offers.
 *
 * NEXT BOOT rather than immediately, deliberately: re-running now would
 * mean a DeviceCheck / Play Integrity round trip inside a settings tap,
 * whose answer is a foregone `cooldown` — this device already activated
 * this month. The server re-grades on that cooldown (deviceBind.ts
 * `regrade`), so the level lands on the next launch, which is soon enough
 * for a claim that only matters when the bar moves.
 */
export function forgetDeviceBind(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
  } catch {
    /* best-effort: a boot that cannot read the memo re-attempts anyway */
  }
}

export function memoAfter(
  uid: string,
  res: { ok?: boolean; reason?: string } | null,
  now: Date,
): BindMemo | null {
  if (res?.ok) return { uid };
  if (res?.reason === "cooldown") return { uid, until: monthKey(now) };
  return null; // errors memoize nothing: retry on a later boot
}

interface DeviceBindPlugin {
  // iOS: DCDevice.generateToken() — the ephemeral token Apple's two-bits
  // API consumes. Android: a Play Integrity token.
  generateToken(): Promise<{ token: string }>;
  // `nonce` is the value the native side put in the Play Integrity
  // request; Play echoes it inside the signed payload, so the server can
  // refuse a token minted for some other request. Optional in the type
  // because the iOS arm never produces one.
  requestIntegrityToken(options?: { cloudProjectNumber?: string }): Promise<{ token: string; nonce?: string }>;
}

let plugin: DeviceBindPlugin | null = null;
let warnedMissingBridge = false;

export async function ensureDeviceBound(uid: string): Promise<void> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (activationPlan(parseBindMemo(raw), uid, new Date()) === "skip") return;

    const platform = Capacitor.getPlatform(); // 'web' | 'ios' | 'android'
    let token: string | null = null;
    // Android only. Carried alongside the token rather than derived from
    // it: the server compares this against the nonce Play signed into the
    // payload, and a token whose two copies disagree is one minted for a
    // different request.
    let nonce: string | undefined;
    if (platform !== "web") {
      // The bridge is ~30 lines of native code per platform, added by hand
      // in Xcode / Android Studio (docs/DEVICE-BIND.md). Until it lands,
      // native activation simply waits — logged once per session so the
      // gap is visible in dev, silent for users either way.
      if (!Capacitor.isPluginAvailable("DeviceBind")) {
        if (!warnedMissingBridge) {
          warnedMissingBridge = true;
          console.warn("[deviceBind] native bridge missing — activation deferred (docs/DEVICE-BIND.md)");
        }
        return;
      }
      plugin = plugin || registerPlugin<DeviceBindPlugin>("DeviceBind");
      if (platform === "ios") {
        token = (await plugin.generateToken()).token;
      } else {
        const res = await plugin.requestIntegrityToken();
        token = res.token;
        nonce = res.nonce;
      }
    }
    // On web this sends no token: the emulator grants (dev loop), and
    // production refuses — production has no web build, so a web caller
    // there is not a user we are locking out.
    const db = await getDb();
    const fns = getFunctions(db.app, FUNCTIONS_REGION);
    const res = (
      await httpsCallable(fns, "activateDeviceV2")({
        platform,
        ...(token ? { token } : {}),
        ...(nonce ? { nonce } : {}),
      })
    ).data as { ok?: boolean; reason?: string } | null;
    if (res?.ok) {
      // The claim was just set server-side; rules read it from the ID
      // token, so force one refresh now — otherwise the first vote after
      // the enforcement flip races a token minted before activation.
      await getAuth(db.app).currentUser?.getIdToken(true);
    }
    const memo = memoAfter(uid, res, new Date());
    if (memo && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(KEY, JSON.stringify(memo));
      } catch {
        /* best-effort */
      }
    }
  } catch (err) {
    // Soft everywhere by design: pre-flip nothing is gated; post-flip the
    // failure is "this vote doesn't count yet", which the next boot's
    // retry resolves. Never a dialog.
    reportError(err, { where: "deviceBind" });
  }
}

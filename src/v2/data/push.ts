// Push registration (Phase 5) — native platforms only, and only the one
// notification the product earns: "your reveal is out" (sent by
// revealGroupDay in functions/src/v2social.ts). On web this module is a
// no-op. Requires the platform Firebase config files
// (google-services.json / GoogleService-Info.plist) to actually deliver.
import { Capacitor } from "@capacitor/core";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDb } from "../../lib/firebase";
import { reportError } from "../../lib/sentry";
import { FUNCTIONS_REGION } from "../../lib/region";

export async function registerPushForReveals(uid: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let perm = await PushNotifications.checkPermissions();
    // Android 13+ reports "prompt-with-rationale" after a first
    // dismissal — still promptable, so ask in both states.
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return;
    // Android 8+ drops any notification posted to a channel that does not
    // exist. The manifest names "reveals" as the default channel for
    // incoming messages, so it has to exist before the first one arrives —
    // and the failure only shows when the app is BACKGROUNDED, since a
    // foregrounded app renders the payload itself.
    // Creating an existing channel is a no-op, so this is safe every boot.
    if (Capacitor.getPlatform() === "android") {
      try {
        await PushNotifications.createChannel({
          id: "reveals",
          name: "Reveals",
          description: "When a group or duo day is revealed.",
          importance: 4, // heads-up: the reveal is the thing you opened the app for
          visibility: 1, // public — the text names no answers, only that a day is out
          vibration: true,
        });
      } catch (err) {
        // A missing channel degrades delivery; it must not stop registration.
        reportError(err, { where: "push.createChannel" });
      }
    }
    await PushNotifications.addListener("registration", (token) => {
      void (async () => {
        try {
          // one write per NEW (uid, token) pair — uid-scoped so a fresh
          // account on the same device still registers
          const KEY = "insight.pushToken.v1";
          let staleToken: string | null = null;
          try {
            const prev = JSON.parse(localStorage.getItem(KEY) || "null");
            if (prev && prev.uid === uid && prev.token === token.value) return;
            // FCM rotated this device's token — drop the old one from
            // the doc, or fcmTokens grows one dead entry per rotation
            // forever (the reveal sender would fan out to ghosts).
            if (prev && prev.uid === uid && prev.token) staleToken = prev.token;
          } catch {
            /* fall through to write */
          }
          // The token write happens SERVER-SIDE (registerPushToken,
          // functions/src/v2social.ts): the ruleset refuses fcmTokens from
          // clients, because the array is the reveal sender's fan-out list
          // and a client-writable one could carry a stolen token. The
          // callable also drops the rotated predecessor in the same step.
          const db = await getDb();
          const fns = getFunctions(db.app, FUNCTIONS_REGION);
          await httpsCallable(fns, "registerPushToken")({
            token: token.value,
            prev: staleToken,
          });
          try {
            localStorage.setItem(KEY, JSON.stringify({ uid, token: token.value }));
          } catch {
            /* best-effort */
          }
        } catch (err) {
          reportError(err, { where: "pushTokenSave" });
        }
      })();
    });
    await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const data = (action.notification && action.notification.data) || {};
      if (data.kind === "reveal" && data.gid) {
        try {
          sessionStorage.setItem("insight.pendingReveal", String(data.gid));
        } catch {
          /* best-effort */
        }
        // land on the daily tab; DailySplit consumes the pending gid
        const w = window as unknown as { goTab?: (t: string) => void };
        if (w.goTab) w.goTab("track");
        window.dispatchEvent(new Event("insight-live-update"));
      }
    });
    await PushNotifications.register();
  } catch (err) {
    reportError(err, { where: "pushRegister" });
  }
}

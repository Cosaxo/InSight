// Push registration (Phase 5) — native platforms only, and only the one
// notification the product earns: "your reveal is out" (sent by
// revealGroupDay in functions/src/v2social.ts). On web this module is a
// no-op. Requires the platform Firebase config files
// (google-services.json / GoogleService-Info.plist) to actually deliver.
import { Capacitor } from "@capacitor/core";
import { arrayUnion, doc, setDoc } from "firebase/firestore";
import { getDb } from "../../lib/firebase";

export async function registerPushForReveals(uid: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt") perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;
    await PushNotifications.addListener("registration", (token) => {
      void (async () => {
        try {
          const db = await getDb();
          await setDoc(
            doc(db, "v2_users", uid),
            { fcmTokens: arrayUnion(token.value) },
            { merge: true },
          );
        } catch (err) {
          console.warn("[push] token save failed:", err);
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
    console.warn("[push] registration unavailable:", err);
  }
}

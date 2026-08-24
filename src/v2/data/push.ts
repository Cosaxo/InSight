// Push registration (Phase 5) — native platforms only. On web this module
// is a no-op. Requires the platform Firebase config files
// (google-services.json / GoogleService-Info.plist) to actually deliver.
//
// TWO CLASSES since D236, each on its own Android channel, both sent by
// functions/src/v2social.ts through one fan-out (sendPushToUids):
//
//   · "yesterday is revealed"  — revealGroupDay,   channel "reveals"
//   · "someone invited you"    — inviteToGroupV2,  channel "invites"
//   · "someone wants to join"  — requestJoinV2,    channel "invites"  (D240)
//   · "you're in"              — approveJoinV2,    channel "invites"  (D240)
//
// It was one class for a long time and this comment said so. The second is
// what turned D122's invitation — consent, an inbox, a handle registry —
// from a note left in an empty room into something that reaches the person
// it is addressed to.
import { Capacitor } from "@capacitor/core";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDb } from "../../lib/firebase";
import { reportError } from "../../lib/sentry";
import { FUNCTIONS_REGION } from "../../lib/region";
import NAV from "./nav";
import { note } from "./engagement";

/**
 * Register this device for reveal notifications.
 *
 * `ask` decides whether the OS PROMPT may be shown, and the split is the
 * whole point of the parameter.
 *
 * WHY. This used to prompt from `initLive`, during boot, before first
 * render — so the first thing a new install did was ask for notification
 * permission, for a notification class ("your reveal is out") that cannot
 * fire until the user has joined a circle or started a 1v1. On iOS the
 * decline is PERMANENT: there is no second prompt, and the shipped reveal
 * push then dies for everyone who tapped Not Now at a moment when nothing
 * had earned it. Contrast locate.ts, which is gated behind an explicit tap
 * with an Info.plist string saying what happens.
 *
 * So boot calls this with `ask: false` — which registers a device that has
 * ALREADY granted permission (the returning user, every launch) and is
 * otherwise a no-op — and the moments that make a reveal possible call it
 * with `ask: true`.
 */
export async function registerPush(
  uid: string,
  { ask = false }: { ask?: boolean } = {},
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let perm = await PushNotifications.checkPermissions();
    // Android 13+ reports "prompt-with-rationale" after a first
    // dismissal — still promptable, so ask in both states.
    if (ask && (perm.receive === "prompt" || perm.receive === "prompt-with-rationale")) {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return;
    // Android 8+ drops any notification posted to a channel that does not
    // exist. The manifest names "reveals" as the default channel for
    // incoming messages, so it has to exist before the first one arrives —
    // and the failure only shows when the app is BACKGROUNDED, since a
    // foregrounded app renders the payload itself.
    // Creating an existing channel is a no-op, so this is safe every boot.
    //
    // TWO CHANNELS SINCE D236, and the split is not decoration. A channel
    // carries a name and a description into Android's own settings, and
    // it is what a person switches off when they want less. Posting an
    // invitation to "reveals" would put it under a description that says
    // "When a group or duo day is revealed" — a false label on the one
    // screen the OS gives the user to control this — and would make
    // muting invitations cost them the reveal they actually opened the
    // app for. The server names the channel explicitly on every send
    // (sendPushToUids), so neither class rides the manifest default.
    if (Capacitor.getPlatform() === "android") {
      for (const ch of [
        {
          id: "reveals",
          name: "Reveals",
          description: "When a group or duo day is revealed.",
          // `as const` on both: an inline object infers the literal, but
          // these live in an array now and would widen to `number`,
          // which is not the plugin's Importance/Visibility union.
          importance: 4 as const, // heads-up: the reveal is what you opened the app for
          visibility: 1 as const, // public — names no answers, only that a day is out
          vibration: true,
        },
        {
          id: "invites",
          name: "Invitations",
          // Covers BOTH directions since D240: an invitation to you,
          // and somebody asking to join a circle you are in. One
          // channel because they are one concern — who is joining
          // what — and a person muting one would mean to mute both.
          description: "When someone invites you, or asks to join your circle.",
          // 4, same as reveals: an invitation is a person waiting on an
          // answer from you, and one that arrives silently is the thing
          // D236 exists to fix.
          importance: 4 as const,
          // Public, and it costs nothing to say so: the text carries a
          // display name and a circle's name, both of which D98 already
          // publishes to any signed-in account.
          visibility: 1 as const,
          vibration: true,
        },
      ]) {
        try {
          await PushNotifications.createChannel(ch);
        } catch (err) {
          // A missing channel degrades delivery; it must not stop registration.
          reportError(err, { where: "push.createChannel" });
        }
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
      // land on the daily tab; DailySplit consumes whatever was stashed.
      // The registry since D248, not a `window as unknown as {…}` cast:
      // NAV.goTab owns the not-yet-mounted case, so the `if (w.goTab)`
      // this replaced has no caller-side remnant.
      const land = () => {
        // R2/D270: the sent→opened half of the notification funnel —
        // delivery counts were always server-side, the tap never was.
        note("notifOpen");
        NAV.goTab("track");
        window.dispatchEvent(new Event("insight-live-update"));
      };
      if (data.kind === "reveal" && data.gid) {
        try {
          sessionStorage.setItem("insight.pendingReveal", String(data.gid));
        } catch {
          /* best-effort */
        }
        land();
        return;
      }
      // A join request, or an approval of yours (D240). BOTH name a
      // circle this account is in — you are a member of the one somebody
      // is asking to join, and you have just become a member of the one
      // that let you in — so the gid resolves and the tap can land on
      // that circle's own mode.
      if ((data.kind === "join-request" || data.kind === "join-approved") && data.gid) {
        try {
          sessionStorage.setItem("insight.pendingCircle", String(data.gid));
        } catch {
          /* best-effort */
        }
        land();
        return;
      }
      // An invitation (D236). The gid is deliberately NOT stashed the way a
      // reveal's is: a reveal lands on a circle you are already in, and
      // DailySplit resolves it through LIVE.social.groups(). An invitee is
      // by definition not a member yet, so that lookup finds nothing and
      // the tap would go nowhere at all. The MODE is what routes — Circle
      // or 1v1, where LdInvites already draws the row waiting for them.
      if (data.kind === "invite") {
        try {
          sessionStorage.setItem("insight.pendingInvite", data.mode === "duo" ? "duo" : "group");
        } catch {
          /* best-effort */
        }
        land();
      }
    });
    await PushNotifications.register();
  } catch (err) {
    reportError(err, { where: "pushRegister" });
  }
}

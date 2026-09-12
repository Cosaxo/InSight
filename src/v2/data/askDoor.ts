// askDoor.ts — the one in-app door to the web ask page, and the platform
// rule that decides whether it is drawn (D472).
//
// D368 took the purchase funnel out of the binary: a call to action inside
// an app that leads to a purchase outside it is what Apple's guideline
// 3.1.1 polices, and Norway — EEA, not EU — is under Apple's standard
// terms, where that rule stands (D368 checked EFTA's listing). Google has
// never made ad-type spend go through Play Billing, and STORE-CUT-PLAN.md
// §3 priced that difference as shape B: door on Android, none on iOS.
//
// This is shape B at its cheapest. The button opens the WEB door in the
// system browser — the page that already carries the menu, the audience,
// the quote and the pay tap (D369–D378, D455) — so there is no second
// composer, no billing code and no product change in the app. What the
// old in-app door cost (757 lines and a store review it could not pass) is
// not paid again; what it gave, one tap from anywhere, is.
//
// ANDROID ONLY, BY ASKING THE PLATFORM. The build is one bundle for both
// stores, so the door cannot be left out of the iOS build at build time;
// it is left out at render time, and ask-door-platform.test.jsx mounts
// the whole App as iOS and proves no such control exists, which is the
// property App Review reads the binary for (D368's inverted smoke cases
// pin the same thing for a build with no platform at all). "web" — the
// dev server, the test runner — draws no door either: the rule is one
// platform in, not one platform out, so a platform nobody has thought
// about is safe by default.
//
// The residual is Play's, not Apple's, and PLAY-RELEASE.md §3.4 names it:
// the thing bought is served inside the app, which makes Google's
// "consumed outside the app" exemption a read in the Play Console policy
// flow rather than an engineer's conclusion. That read is the owner's
// (OWNER-LIST.md), and this module is one boolean from off.
//
// window.Capacitor rather than an import, for engagement.ts's reason: the
// runtime injects the global on native, and a global read keeps this
// module import-free for node-environment tests and lets a mount test set
// the platform with one assignment.
import { SITE_ORIGIN } from "./siteOrigin";

/** The web door's address. Absolute, because it leaves the app. */
export const ASK_URL = `${SITE_ORIGIN}/ask`;

type Platform = "ios" | "android" | "web";

function platformName(): Platform {
  try {
    const cap = (globalThis as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    const p = cap?.getPlatform?.();
    if (p === "ios" || p === "android") return p;
  } catch { /* best-effort — no platform is "web" */ }
  return "web";
}

/** Whether this build draws the door at all. One platform in. */
export const askDoorOffered = (): boolean => platformName() === "android";

/**
 * Leave the app for the web door. The system browser, the same hop the
 * pre-D368 pay tap made to Stripe (`window.open(url, '_blank')`) — the
 * page signs the buyer in itself, and the app never learns of the
 * purchase from here (the webhook is the truth; Asked by you reads it).
 */
export function openAskDoor(): void {
  window.open(ASK_URL, "_blank", "noopener,noreferrer");
}

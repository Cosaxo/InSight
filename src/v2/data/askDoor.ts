// askDoor.ts — the one in-app door to the web ask page, and the platform
// rule that decides whether it is drawn (D473).
//
// D368 took the purchase funnel out of the binary: a call to action inside
// an app that leads to a purchase outside it is what Apple's guideline
// 3.1.1 polices, and Norway — EEA, not EU — is under Apple's standard
// terms, where that rule stands (D368 checked EFTA's listing). Google has
// never made ad-type spend go through Play Billing, and STORE-CUT-PLAN.md
// §3 priced that difference as shape B: door on Android, none on iOS.
//
// This is shape B at its cheapest. The button (ui/AskDoorButton.tsx)
// opens the WEB door in the system browser — the page that already
// carries the menu, the audience, the quote and the pay tap (D369–D378,
// D455) — so there is no second composer, no billing code and no product
// change in the app. What the old in-app door cost (757 lines and a store
// review it could not pass) is not paid again; what it gave, one tap from
// anywhere, is.
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
// TWO MODULES, NOT ONE, FOR 484 BYTES. This file is in the entry chunk
// because the shell has to ask it before first paint; the button's body,
// its address and its click are a React.lazy chunk the shell fetches only
// when the answer is yes. Measured on 2026-09-12 against origin/main's
// shipping build: the eager graph sat 484 bytes under check:bundle's
// ceiling and the door as one eager module was 619, so the merge failed
// the gate by 135 bytes; split with a same-size hidden Suspense fallback
// it was still 38 over. The gate's own text says defer rather than
// raise, and this repo ratchets that ceiling down, not up — so this
// module is the rule and nothing else, the Suspense fallback is null
// (on native, Capacitor serves the chunk from the app's own bundle, so
// the lazy import resolves within a tick and there is no gap to hold a
// slot for), and the SVG, the address and the hop go where iOS never
// fetches them at all.
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
/** Whether this build draws the door at all. One platform in. A bridge
 * that is missing, has no getPlatform, or throws reads as "web". */
export function askDoorOffered(): boolean {
  try {
    const cap = (globalThis as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    return cap?.getPlatform?.() === "android";
  } catch { return false; }
}

// IS THE V2 LIVE PATH IN THIS BUNDLE? Asked of the bundle.
//
// Two release-path gates need this answer and both used to read
// `process.env.VITE_V2_LIVE` — the environment of the process running the
// CHECK, not of the one that ran the BUILD. check-web-firebase's own header
// says why that is not enough, in the paragraph above the line that did it:
// "It is not enough to assert the variables are SET in the environment: the
// question is whether the build that exists on disk was produced with them."
//
// It lives in its own file rather than in either gate because a list copied
// into two scripts is a list that will disagree with itself. That is not a
// hypothesis here — D197 found one bank parser in three copies, and the copy
// that had drifted reported an invented number instead of failing.
//
// WHY THE ANSWER IS FINDABLE AT ALL. `import.meta.env.VITE_V2_LIVE` is a
// build-time replacement, so in a demo build it folds to `false` and
// rolldown shakes out everything behind `LIVE.enabled`. That also means the
// flag's own string survives in neither build, so the marker has to be
// something the live path REACHES.
//
// Firestore collection ids, and deliberately: each one has a `match` block
// in firestore.rules, which `check:data-inventory` then forces to be either
// a row in docs/data-inventory.md (`v2_attention`) or an exemption carrying
// its reason (`v2_meta`, `v2_questions` — content and config, not user
// data). Neither can be renamed quietly, and renaming a live collection is a
// migration rather than a rename.
//
// Measured 2026-08-26 on one tree, the same command with the flag the only
// difference, and again with VITE_SENTRY_DSN removed to confirm the two axes
// are independent:
//
//                   chunks LIVE   chunks DEMO
//   v2_meta              1             0
//   v2_questions         1             0
//   v2_attention         1             0
//
// The obvious markers are the ones that do NOT work: `v2_users` and
// `v2_answers` are in 3 chunks of both builds, because circle.ts and
// cohort.ts reach them from code no flag folds away.
export const LIVE_MARKERS = ["v2_meta", "v2_questions", "v2_attention"];

/**
 * Which markers are NOT in this JavaScript. Empty means the live path is in.
 *
 * ALL of them, not any. The direction that must not happen is a demo bundle
 * treated as the shipping one, and requiring every marker means a demo build
 * would have to retain all three by accident. The other direction — a live
 * build refused because somebody renamed a collection — costs a rebuild and
 * the caller names the missing marker, which is the failure these gates are
 * supposed to have.
 */
export function missingLiveMarkers(js) {
  return LIVE_MARKERS.filter((m) => !js.includes(m));
}

// ── AND: WAS THIS BUNDLE BUILT AGAINST THE EMULATOR? ────────────────────
//
// The same question as above, pointed the other way, and it was asked of
// the wrong thing in the same file for the same reason. check-web-firebase
// refuses `VITE_USE_EMULATOR=true` by reading `process.env` — the
// environment of the process running the CHECK, not of the one that ran the
// BUILD — while its own header says that is not enough, and §2 already does
// it properly for the four Firebase values and for VITE_V2_LIVE.
//
// The gap is not theoretical and does not need a mistake to reach. Vite
// reads `.env`; `process.env` does not. `docs/LOCAL-TESTING.md` prescribes
// `cp .env.emulator .env`, so a developer following the documented local
// flow has a tree where every BUILD is an emulator build and every CHECK
// sees nothing set. Measured 2026-09-12: with such a `.env`, a build put
// `127.0.0.1` into the Firebase implementation chunk and
// `connectFirestoreEmulator` into the SDK chunk, and the gate printed
// "live config inlined into 140 chunk(s)" and exited 0.
//
// WHY THESE THREE. `useEmulator` is `import.meta.env.VITE_USE_EMULATOR ===
// "true"`, a build-time replacement, so in an ordinary build it folds to
// false and rolldown shakes out the whole block — taking the SDK's connect
// functions and the host literal with it. Measured on a shipping build of
// this tree: all three appear in ZERO chunks. In an emulator build they are
// all present, because the branch survives and the imports are retained.
//
// The port numbers are NOT markers: `9099` turns up once in a shipping
// bundle already, and a number that common cannot carry a refusal.
export const EMULATOR_MARKERS = [
  "connectFirestoreEmulator",
  "connectAuthEmulator",
  "127.0.0.1",
];

/**
 * Which emulator markers ARE in this JavaScript. Empty means the bundle was
 * not built against the emulator.
 *
 * ANY of them, not all — the opposite quantifier to `missingLiveMarkers`,
 * and deliberately. There, the direction that must not happen is a demo
 * bundle mistaken for the shipping one, so every marker has to be present
 * before the build is believed. Here the direction that must not happen is
 * an emulator bundle reaching a user's phone, where every SDK would be
 * pointed at their own device — so one marker is enough to refuse, and a
 * tree-shake that left only one behind still gets caught.
 */
export function emulatorMarkersIn(js) {
  return EMULATOR_MARKERS.filter((m) => js.includes(m));
}

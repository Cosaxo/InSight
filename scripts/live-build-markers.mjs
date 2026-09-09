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

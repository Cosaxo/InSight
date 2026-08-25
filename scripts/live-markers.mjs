// Is a built bundle the LIVE one, asked of the bundle?
//
// Shared by the two gates that both have to answer it — check-bundle.mjs
// (which grades the shipping bundle and must refuse to grade any other)
// and check-web-firebase.mjs (which stands on the release path and whose
// whole argument is that the environment's answer is not the artifact's).
// It lives in one file rather than two copies because a copy kept in sync
// by a comment is the thing check:logic-sync and check:calls exist to
// stop being.
//
// ── WHY MARKERS AT ALL ───────────────────────────────────────────────
//
// `import.meta.env.VITE_V2_LIVE === "true"` is inlined at build time
// (src/v2/data/live.ts:4272 and :5408). With the flag unset the whole
// comparison folds to false, rolldown drops the live read path, and its
// vocabulary goes with it. So the flag itself is not in the output — the
// code it kept is, and that is the only thing a built artifact can be
// asked about.
//
// ── WHY THESE THREE ──────────────────────────────────────────────────
//
// Not chunk names. `deviceBind` and `engagement` are emitted as their own
// chunks in a live build and in no other, which makes them tempting and
// wrong for D198's reason: a rolldown output name is not a promise. These
// are the app's own vocabulary, and each is pinned elsewhere in the tree
// too — the two collection names by firestore.rules, docs/SCHEMA-V2.md and
// the functions; the cache key by check:purge — so none of them can be
// renamed here alone and quietly.
//
// Measured on this tree across four builds, the flag and the Firebase
// config varied independently. The Firebase column is the one that had to
// be checked rather than assumed: `ci.yml` builds with VITE_V2_LIVE and NO
// Firebase config, so a marker that rode on `firebaseEnabled` would have
// failed every PR and passed every release.
//
//                          demo    LIVE     demo    LIVE
//                          no fb   no fb    +fb     +fb
//                                  (ci.yml)         (release)
//   v2_questions             0       1        0       1
//   v2_meta                  0       1        0       1
//   insight.bankCache.v2     0       1        0       1
//   ~~patternsBasis~~        1       1        1       1
//
// The last row is kept as the warning it is: the patterns vocabulary
// survives dead-code elimination, so a live-SOUNDING string can sit in
// every build. Any marker added here gets the same four-way measurement
// before it is trusted — scripts/live-markers.test.mjs pins the shape of
// the answer, not the measurement, which only a build can give.
export const LIVE_MARKERS = ["v2_questions", "v2_meta", "insight.bankCache.v2"];

/**
 * Which markers are ABSENT from a build, given a way to look one up.
 *
 * `has` is `(marker) => boolean`, so a caller can answer it however its
 * own reading of dist/ is shaped — one concatenated string, or a scan
 * across chunks. An empty result means the live path is in.
 *
 * ALL of them are required, and the direction is deliberate. A missing
 * marker refuses to grade and names itself: loud, and recoverable by
 * reading this file. Requiring only SOME would let one leaked string
 * grade a demo bundle and announce it as the shipping one, which is the
 * failure both callers exist to refuse.
 */
export function missingLiveMarkers(has) {
  return LIVE_MARKERS.filter((m) => !has(m));
}

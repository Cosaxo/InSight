// The `window.LIVE` member surface, checked in verbatim.
//
// This list is the contract between `data/live.ts` and the ~19.8k lines of
// spec-layer JSX that look its members up BY NAME at render time. Renaming a
// member there passes `tsc -b` (the consumers are .jsx), passes eslint,
// passes `check:globals` — and then blanks a Map on a device.
//
// It lives in its own module because two guards need the same list and they
// catch different halves of the same mistake:
//
//   data/vote.test.ts   asserts the REAL LIVE object has exactly these keys,
//                       in both directions — a removed member breaks a
//                       consumer, and an added one nobody listed means the
//                       contract stopped being reviewed.
//   test/live-fixture   builds a stand-in with exactly these keys, so the
//                       live-mode mount tests exercise the same surface the
//                       app does. Without sharing the list, the fixture
//                       would quietly fall behind and the live tests would
//                       keep passing against a shape that no longer exists.
//
// Update ONLY together with the spec-layer call sites that read the changed
// member. That is the whole point.

export const LIVE_MEMBERS = [
  "aggFor",
  // D100: the deck plus every answered question that has an aggregate —
  // what the Mirror's Answers and Scores lenses read. Distinct from
  // `deck()`, which is strictly the seven-day pager.
  "aggregated",
  "anchors", "appBuild",
  // Named who-voted (D98) — the app's only cross-user read, and the
  // reason the reversal was worth doing. On LIVE rather than LIVE.social
  // deliberately: `social` is groups, duos and their takes, while a
  // question's voters are a WORLD surface with no circle in it.
  // `loadVoters` fetches on demand; `voters` returns null while unfetched
  // or failed and an array (possibly empty) once known, because "could
  // not ask" and "nobody answered" must not render the same.
  "loadVoters", "voters", "votersByOption", "votersLoading",
  // The same cached list joined to the parsed cross-user scores D112
  // already fetched — the input to the who-voted sheet's type cut
  // (data/typeSplit.ts). Listed here rather than reached for directly:
  // the pin is what makes a new cross-user surface reviewed.
  "voterScores",
  // The shared uid → name cache the same read fills. `nameFor` is a
  // synchronous best-effort read; `loadNames` is the batched fetch that
  // fills it for a surface that has uids but no names (world takes).
  "nameFor", "loadNames",
  // Kindred (D99) — the People lens's ranking, derived on read from the
  // cached voter lists plus the viewer's own votes.
  "loadKindred", "kindred", "kindredLoading", "kindredDepth",
  // Similarity (D112) — the constellation fields. `loadSimilarity` tops up
  // the bank's test-item aggregates (once per session) and runs
  // loadKindred; `kindredPeople` is kindred() plus frozen city and parsed
  // scores; `testFeedItems` and `myTestResults` are the fold's other two
  // ingredients, exposed so the typed layer never needs a bridge read.
  "loadSimilarity", "similarityLoading", "kindredPeople",
  "testFeedItems", "myTestResults",
  // The follow graph and the Circle stop (D101). `circle` returns null
  // while unfetched or failed and an array once known — same rule as
  // `voters`, because "could not ask" and "you follow nobody" are
  // different sentences the stop renders differently.
  "loadCircle", "circle", "circleLoading", "isFollowing", "setFollowing",
  // The same graph one query deep (D149): the follow SET, without the
  // per-member answer fan-out `circle` pays for. The who-voted sheet's
  // Friends cut intersects it with a voter list it already holds, so a
  // friend's answer costs one read rather than up to FOLLOW_CAP of them.
  // Same null/[] convention as `circle`, and kept in step with it — the
  // fold fills this cache and setFollowing clears both.
  "loadFollows", "follows", "followsLoading",
  // Foresight (D126). The store holds the LOG; the score, the streak and
  // the per-dimension accuracy are pure folds the lens runs on it, so no
  // derived number lives here to disagree with its own rows.
  "loadForesight", "foresightLog", "foresightLoading", "scoreForesight",
  // The reason boot did not attach, rendered under the "Sample questions ·
  // reconnecting…" pill when it is tapped. It exists because that label
  // said a real user was on demo content without saying why, and an
  // iPhone has no console to ask — the first device this app ran on
  // failed exactly there.
  "bootError",
  "confirmedVotes", "dailyBank", "deck",
  "deleteAccount", "demoInProd", "displayName", "handle",
  // D86: the one repeatable answer write — moves an existing daily/feed/
  // test answer to a different option. Returns false without writing when
  // there is nothing to move or the 60s cooldown holds.
  "editVote",
  "enabled", "feedReady",
  // `learnAgg` is a read-through cache whose first call for a card always
  // returns null, and its only caller runs at the instant of the tap — so
  // until D125 every learn reveal drew the authored estimate whatever the
  // crowd had answered. `loadLearnAggs` is the warm-up the feed runs when
  // it PLANS the sitting's learn cards, which is the one moment guaranteed
  // to precede every tap in it. `learnMine` is the other half of the same
  // timing problem (D157): the write lands, the trigger has not folded it
  // yet, and without this the reveal counts the crowd minus the reader.
  "latestBuild", "learnAgg", "learnAnswer", "learnMine", "loadLearnAggs",
  // D91: the live half of a lens card — counts for a seeded lens question,
  // null when the bank carries none (the selfOnly fallback's cue).
  "lensAgg",
  "linkGoogle", "linked", "myCity",
  "myVotes",
  // Near-by-radius presence (D84): opt-in, foreground beats, and a count
  // that is the only thing the server ever returns about anyone.
  "near",
  // The daily pulse (D139): the day-keyed create and the derived
  // day → optionIdx view over the hydrated vote mirror.
  "pulseVotes",
  // Crossroads' stories with their folded ending counts (D136). A story is
  // an ordinary bank question — real options, real fold, the ordinary vote
  // path — but NOT an ordinary feed card, because its reveal is a tree
  // rather than a split; buildFeedGlobals holds it out of WORLD_FEED_QS and
  // spec/paths-card.jsx reads it here instead. Empty in a demo build, which
  // is the signal the card falls back to its authored pool on.
  "pathQs",
  "ready", "saveAnchors",
  "saveDisplayName",
  // Operator-only, and the one member here no spec-layer JSX reads — it is
  // typed into a browser console by hand (SHIP-CHECKLIST §1). It is listed
  // anyway because this file is what both guards check the real object
  // against, so an unlisted member fails the pin whatever its caller is.
  "saveTestResult", "seedContent", "social", "stats", "subscribe", "uid",
  "updateAvailable", "updateRequired", "updateUrl", "vote", "votePulse",
];

export const LIVE_SOCIAL_MEMBERS = [
  "bankQ", "createGroup", "groups", "joinGroup", "leaveGroup",
  "loadRevealHistory", "myDuelVote", "revealFor", "revealHistory",
  "romanticPoolReady", "setDuoMode", "todayKey", "todayQ", "voteDuel",
  // Handles and invitations (D122) — the uid-addressed way into a circle.
  // Listed here before any consumer reads them, for the reason the block
  // below states: the pin is what makes the surface reviewed.
  "acceptInvite", "claimHandle", "declineInvite", "inviteToGroup",
  "invites", "invitesLoading", "loadInvites", "whoIs",
  // Circle takes and the report control (D1, docs/MODERATION.md). Listed
  // here before any JSX reads them: the pin is what makes the surface
  // reviewed, and a member added straight into a consumer is a member
  // nobody checked against the rules it has to satisfy.
  "deleteTake", "flagTake", "flagged", "loadTakes", "postTake", "takes",
];

// LIVE.near's own members (D84), pinned like social's for the same reason.
export const LIVE_NEAR_MEMBERS = [
  "count", "disable", "enable", "lastError", "on", "refresh", "supported",
  "tooFew", "updatedAt",
];

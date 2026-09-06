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
  // The core feed questions with aggregates, same view models — the
  // Patterns pool's other half (v28 §2). Core only, D161's sample-bias
  // rule; two-option only, the fit's own encoding.
  "coreFeedAggregated",
  // The unanswered place questions for a scope (D307) — the Scores
  // lens's ask rows. From the bank, not the aggregates: an unanswered
  // rates question usually has no counts yet, which is the point.
  "placeAsks",
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
  "nameFor", "loadNames", "scoresFor",
  // The profile photo (D178) — the read half of the same cache, and the
  // one place a hidden face is filtered out for every surface at once.
  "faceFor", "setAvatar", "removeAvatar", "myFace",
  // The report control on a face, through the SAME flag collection takes
  // use — which is what gives it the anonymity deny, the threshold and
  // the verdict log rather than a second set of all three.
  "flagAvatar", "flaggedAvatar",
  // Kindred (D99) — the People lens's ranking, derived on read from the
  // cached voter lists plus the viewer's own votes.
  "loadKindred", "kindred", "kindredLoading", "kindredDepth",
  // D278 — the city-scoped half of the same pool. A second fan-out rather
  // than a wider cap: the unscoped query returns the newest 200 answers
  // from anywhere and the City ring then filters them to one city, so at
  // any real population it discards nearly everything it paid for.
  "loadCityKindred",
  // Similarity (D112) — the constellation fields. `loadSimilarity` tops up
  // the bank's test-item aggregates (once per session) and runs
  // loadKindred; `kindredPeople` is kindred() plus frozen city and parsed
  // scores; `testFeedItems` and `myTestResults` are the fold's other two
  // ingredients, exposed so the typed layer never needs a bridge read.
  "loadSimilarity", "similarityLoading", "testAggsState", "kindredState", "kindredPeople",
  "testFeedItems", "myTestResults",
  // D277 — the passive fold, persisted. Listed here rather than beside
  // saveTestResult because it is what makes the D112 score tier able to
  // fire at all: without a writer for the four core keys, every
  // candidate's parsed scores are null and the ranking silently falls
  // back to answer agreement.
  "syncPassiveResults",
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
  // D356 — the warm paint split "there is a deck on screen" (`ready`)
  // from "the server has been heard from" (`attached`); `stale` is the
  // gap between them, and the daily's banner reads it beside bootError.
  "attached",
  "bootError",
  // The read breaker (D332): true while v2_meta/app.budgetMode pauses the
  // D98 social loaders above (loadVoters, loadKindred, loadCircle, takes).
  // The gated panels' paused branches read it, so a crowd that was
  // withheld is never rendered as one that is absent.
  "budgetPaused",
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
  // `learnAggLoading` is the third state the cache used to swallow: its
  // first call for a card returns null both while the read is in the air
  // and once it has come back empty, and two surfaces printed "Nobody
  // else has answered this one yet" for the first of those.
  "latestBuild", "learnAgg", "learnAggLoading", "learnAnswer", "learnMine",
  "loadLearnAggs",
  // D91: the live half of a lens card — counts for a seeded lens question,
  // null when the bank carries none (the selfOnly fallback's cue).
  "lensAgg",
  "linkGoogle", "linked", "myCity",
  "myVotes",
  // Near-by-radius presence (D84): opt-in, foreground beats, and a count
  // that is the only thing the server ever returns about anyone.
  "near",
  // The Patterns tab's mount gate (D265): the fit's published pool count
  // off `v2_meta/app`, plus the viewer's answers among the questions it
  // folds. Read by app-shell.jsx to decide whether the third tab exists —
  // so a rename here does not blank a screen, it silently hides a tab.
  "patternsSignal",
  // The daily pulse (D139): the day-keyed create and the derived
  // day → optionIdx view over the hydrated vote mirror.
  "pulseQs",
  // Today's pulse answer while the fold has not counted it yet, so the
  // card can report a crowd the reader is actually in.
  "pulsePending",
  "pulseVotes",
  // Crossroads' stories with their folded ending counts (D136). A story is
  // an ordinary bank question — real options, real fold, the ordinary vote
  // path — but NOT an ordinary feed card, because its reveal is a tree
  // rather than a split; buildFeedGlobals holds it out of WORLD_FEED_QS and
  // spec/paths-card.jsx reads it here instead. Empty in a demo build, which
  // is the signal the card falls back to its authored pool on.
  "pathQs",
  // Catalogue picks (D14 gone live): the create-only entity write, and the
  // three reads that hand the live pick card its board in exactly the demo
  // store's shapes (spec/pick-data.js PICKS.canon/segs/canonSeg) — the
  // canon with your unfolded pick joined at read time, the segment chips
  // flattened from the published `by`, and one segment's ordering of the
  // global board (D17).
  "votePick", "pickCanon", "pickSegs", "pickSeg",
  // Rank answers (D233): the create-only order write. The crowd order is
  // not a member — buildFeedGlobals derives it onto the card (`crowd`)
  // from the published position sums, so the spec layer reads it off the
  // pool exactly as the demo authored it.
  "voteRank",
  // Foresight CALL, tier A (D194): the bank's calls with their folded
  // counts, the published grades (null per call = fetched-and-ungraded,
  // the whole map null = nothing read yet — the card draws different
  // things for those two), and the one bounded fetch that fills them.
  "callQs", "callOutcomes", "loadCallOutcomes",
  // Feed ads (D197) — path 3, and NOT path 2's sponsored questions. Their
  // own pool because an ad takes no answer and folds into no aggregate;
  // null while unread, an array once known.
  "feedAds", "loadAds",
  // The political consent pair (D331). `politicalConsented` is the account
  // row's read and `setPoliticalConsent` is the only writer — listed here
  // because a toggle that silently lost its writer would leave the compass
  // published with a switch that says otherwise, which is the failure the
  // whole record is about.
  // `politicalAnswered` is the third: consented, DECLINED, and not asked
  // are three states, and the setup screen needs to tell the middle one
  // from the last. Seeding from `politicalConsented` alone made a decline
  // look like a fresh account and re-asked it.
  "politicalConsented", "politicalAnswered", "setPoliticalConsent",
  "ready", "saveAnchors",
  "stale",
  "saveDisplayName",
  // Operator-only, and the one member here no spec-layer JSX reads — it is
  // typed into a browser console by hand (SHIP-CHECKLIST §1). It is listed
  // anyway because this file is what both guards check the real object
  // against, so an unlisted member fails the pin whatever its caller is.
  "saveTestResult", "seedContent", "social", "stats", "subscribe", "uid",
  "updateAvailable", "updateRequired", "updateUrl", "vote", "votePulse",
];

export const LIVE_SOCIAL_MEMBERS = [
  "bankQ", "createGroup", "groups", "leaveGroup",
  "loadRevealHistory", "myDuelVote", "revealFor", "revealHistory",
  "revealHistoryLoading",
  "romanticPoolReady", "setDuoMode", "todayKey", "todayQ", "voteDuel",
  // The in-flight flag beside `takes` — listed here because the pin is
  // what makes the surface reviewed, and this one existed in state for a
  // long time without it.
  "takesLoading",
  // Handles and invitations (D122) — the uid-addressed way into a circle.
  // Listed here before any consumer reads them, for the reason the block
  // below states: the pin is what makes the surface reviewed.
  "acceptInvite", "claimHandle", "declineInvite", "inviteToGroup",
  // Asking to join, and the circle's answer (D240). `joinGroup` is
  // gone with the admit-by-code path it named.
  "requestJoin", "approveJoin", "declineJoin",
  "invites", "invitesLoading", "loadInvites", "whoIs",
  // The name half of finding somebody (D239). `whoIs` answers an
  // exact address; this answers a prefix over the people directory.
  "searchPeople",
  // Circle takes and the report control (D1, docs/MODERATION.md). Listed
  // here before any JSX reads them: the pin is what makes the surface
  // reviewed, and a member added straight into a consumer is a member
  // nobody checked against the rules it has to satisfy.
  "deleteTake", "flagTake", "flagged", "loadTakes", "postTake", "takes",
];

// LIVE.near's own members (D84), pinned like social's for the same reason.
export const LIVE_NEAR_MEMBERS = [
  "count", "disable", "enable", "lastError", "loadRoom", "mix", "mode", "on",
  "refresh", "room", "roomLoading", "supported", "tooFew", "until", "updatedAt",
];

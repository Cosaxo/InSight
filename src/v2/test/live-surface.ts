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
  "aggFor", "anchors", "appBuild",
  // Named who-voted (D98) — the app's only cross-user read, and the
  // reason the reversal was worth doing. On LIVE rather than LIVE.social
  // deliberately: `social` is groups, duos and their takes, while a
  // question's voters are a WORLD surface with no circle in it.
  // `loadVoters` fetches on demand; `voters` returns null while unfetched
  // or failed and an array (possibly empty) once known, because "could
  // not ask" and "nobody answered" must not render the same.
  "loadVoters", "voters", "votersByOption", "votersLoading",
  // The shared uid → name cache the same read fills. `nameFor` is a
  // synchronous best-effort read; `loadNames` is the batched fetch that
  // fills it for a surface that has uids but no names (world takes).
  "nameFor", "loadNames",
  // Kindred (D99) — the People lens's ranking, derived on read from the
  // cached voter lists plus the viewer's own votes.
  "loadKindred", "kindred", "kindredLoading", "kindredDepth",
  // The reason boot did not attach, rendered under the "Sample questions ·
  // reconnecting…" pill when it is tapped. It exists because that label
  // said a real user was on demo content without saying why, and an
  // iPhone has no console to ask — the first device this app ran on
  // failed exactly there.
  "bootError",
  "confirmedVotes", "dailyBank", "deck",
  "deleteAccount", "demoInProd", "displayName",
  // D86: the one repeatable answer write — moves an existing daily/feed/
  // test answer to a different option. Returns false without writing when
  // there is nothing to move or the 60s cooldown holds.
  "editVote",
  "enabled", "feedReady",
  "latestBuild", "learnAgg", "learnAnswer",
  // D91: the live half of a lens card — counts for a seeded lens question,
  // null when the bank carries none (the selfOnly fallback's cue).
  "lensAgg",
  "linkGoogle", "linked", "myCity",
  "myVotes",
  // Near-by-radius presence (D84): opt-in, foreground beats, and a count
  // that is the only thing the server ever returns about anyone.
  "near",
  "ready", "saveAnchors",
  "saveDisplayName",
  // Operator-only, and the one member here no spec-layer JSX reads — it is
  // typed into a browser console by hand (SHIP-CHECKLIST §1). It is listed
  // anyway because this file is what both guards check the real object
  // against, so an unlisted member fails the pin whatever its caller is.
  "saveTestResult", "seedContent", "social", "stats", "subscribe", "uid",
  "updateAvailable", "updateRequired", "updateUrl", "vote",
];

export const LIVE_SOCIAL_MEMBERS = [
  "bankQ", "createGroup", "groups", "joinGroup", "leaveGroup",
  "loadRevealHistory", "myDuelVote", "revealFor", "revealHistory",
  "romanticPoolReady", "setDuoMode", "todayKey", "todayQ", "voteDuel",
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

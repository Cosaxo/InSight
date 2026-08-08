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
  // The reason boot did not attach, rendered under the "Sample questions ·
  // reconnecting…" pill when it is tapped. It exists because that label
  // said a real user was on demo content without saying why, and an
  // iPhone has no console to ask — the first device this app ran on
  // failed exactly there.
  "bootError",
  "confirmedVotes", "dailyBank", "deck",
  "deleteAccount", "demoInProd", "displayName", "enabled", "feedReady",
  "latestBuild", "learnAgg", "learnAnswer", "linkGoogle", "linked", "myCity",
  "myVotes", "ready", "saveAnchors",
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
];

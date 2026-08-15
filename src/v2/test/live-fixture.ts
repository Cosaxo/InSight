// A stand-in `window.LIVE` for mount tests, plus the feed globals live.ts
// publishes alongside it.
//
// WHY THIS EXISTS. The `test/smoke-*.test.jsx` suites mount the whole app and
// prove the screens paint — but only in DEMO mode. `window.LIVE` is undefined
// throughout it, so every `if (window.LIVE && window.LIVE.enabled)` branch in
// the spec layer is dead code as far as the test suite is concerned. Those
// branches are not incidental: they are where D9 drops the Mirror's City
// stop and where D11 keeps named takes, counter-arguments and friend dots off
// world-scale cards. The tree's evidence that they work was a browser probe
// run by hand once, recorded in D11. This turns that into a standing test.
//
// WHY IT IS A HAND-BUILT OBJECT AND NOT THE REAL STORE. Booting `live.ts`
// needs Firebase; `vote.test.ts` already does that with hoisted module mocks
// and it costs 400ms and ~90 lines of mock per case. What the spec layer
// actually consumes is a plain object looked up by name, so the honest
// stand-in for a RENDER test is a plain object. The risk that carries — a
// fixture drifting from the real surface — is closed by building it from the
// same checked-in list `vote.test.ts` asserts the real store against
// (test/live-surface.ts), and by asserting the key sets match.
//
// WHAT IT DELIBERATELY DOES NOT DO. No network, no timers, no fake data that
// a test then asserts on as if it were behaviour — the same rule setup-dom.ts
// states. The counts below exist so cards have something to lay out; the
// assertions in the live tests are about which ELEMENTS appear, which is a
// property of the gates, not of the numbers.
//
// WHY IT INSTALLS ONTO THE REAL SINGLETON rather than beside it. live.ts ends
// with `window.LIVE = LIVE` — the global and the module's default export are
// ONE object in the app. This fixture used to assign a second object to the
// global and leave the export alone, which was invisible while every consumer
// read `window.LIVE`, and stopped being invisible the moment a converted
// module imported the binding instead (map-anchors.js). A spec module would
// then see `enabled: false` while the rendered tab beside it saw the fixture.
// Two objects that have to agree is the exact bug this fixture exists to
// catch, so it does not create one: the hand-built members below are defined
// onto the imported singleton, and restore() puts its own descriptors back.
// Importing live.ts is not booting it — the un-booted singleton is inert
// (`enabled: false`, no network), which is what the paragraph above rules out.

import realLive from "../data/live";
import { LIVE_MEMBERS, LIVE_NEAR_MEMBERS, LIVE_SOCIAL_MEMBERS } from "./live-surface";

type Dict = Record<string, unknown>;

export interface LiveFixtureOptions {
  /** Cards below the k-floor render no share numeral and no fill (D11). */
  tooSmall?: boolean;
  /** A live build that fell back to mock data — suppresses everything (D11). */
  demoInProd?: boolean;
  /** The viewer's city anchor, "" for a profile that has not picked one. */
  myCity?: string;
  /**
   * The viewer's anchors (D8), as `LIVE.anchors()` returns them. Defaults
   * to `{}` — a real account that has not filled the Basics card in, which
   * is the state the Map's anchor ring used to paper over with the sample
   * persona's age, job and education.
   */
  anchors?: Record<string, string>;
  /**
   * How many live world cards WORLD_FEED_QS carries (default 1). The feed
   * weaves one LENS card in after every 9th world card, so a case that needs
   * a lens card on screen asks for at least 9 (D50/D91).
   */
  feedCards?: number;
  /**
   * Whether the seeded bank carries the lens items (D91). True by default —
   * lensAgg answers with counts and lens cards take the live path. False
   * models a pre-D91 backend: lensAgg answers null and the cards fall back
   * to D50's selfOnly acknowledgment.
   */
  lensBank?: boolean;
}

const OPTION_COLORS = ["var(--c-around)", "var(--c-today)", "var(--c-likeness)"];

// The feed card's prompt and options, exported so a test can target the feed
// rather than the daily deck card sharing the screen with it. Strings chosen
// to appear nowhere else in the spec layer's demo data.
export const FEED_PROMPT = "Fixture feed card: does the gate hold?";
export const FEED_OPTIONS = ["Gate holds", "Gate leaks"];
/** The fixture Crossroads story's title — unique, so a query binds to the card. */
export const PATH_TITLE = "Fixture Crossroads: the forked road";

function liveQuestion(
  id: string,
  prompt: string,
  tooSmall: boolean,
  // D100's bank fields. Defaulted rather than required so the two
  // existing call sites stay readable, but supplied by both — a fixture
  // where every question shares one branch and no ordinal type would
  // render the Answers lens's chips and Scores as their empty states,
  // which is the one shape a mount test must not silently accept.
  branch = "Mind",
  type = "binary",
) {
  return {
    id,
    cat: "culture",
    branch,
    sub: null,
    type,
    text: prompt,
    dayLabel: "Today",
    // What buildS resolves for every real question that a cohort reading
    // is allowed to fold (D161). A fixture without it is a TAIL question,
    // and the Mirror's place panels would render their empty state — which
    // is the one shape a mount test must not silently accept.
    coreCorpus: true,
    options: ["Yes", "No", "Both"].map((label, i) => ({
      id: String(i),
      label,
      count: tooSmall ? 0 : [12, 8, 5][i],
      color: OPTION_COLORS[i % OPTION_COLORS.length],
    })),
    comments: [],
    friends: [],
    live: true,
    tooSmall,
    test: null,
  };
}

export interface LiveHandle {
  LIVE: Dict;
  /**
   * The members this fixture actually stubs. `LIVE` above is the REAL store
   * with these redefined on top, so its key list is the real surface and
   * says nothing about what the fixture covers — which is the one thing
   * fixtureSurfaceMismatch needs to know.
   */
  fixtureKeys: string[];
  /** Votes the fixture recorded, so a test can assert a click reached the store. */
  votes: Record<string, string>;
  restore(): void;
}

export function installLive(opts: LiveFixtureOptions = {}): LiveHandle {
  const tooSmall = !!opts.tooSmall;
  const votes: Record<string, string> = {};
  const listeners = new Set<() => void>();
  const deck = [
    liveQuestion("daily-000", "Would you rather know, or be known?", tooSmall),
    // A second branch and an ordinal type, so the archive the Mirror
    // reads exercises the branch filter and the Scores lens rather than
    // only their "nothing here" arms.
    liveQuestion("daily-001", "Is a promise still binding if nobody remembers it?", tooSmall, "Morals", "rating"),
  ];

  const social: Dict = {
    todayKey: () => "2026-07-30",
    bankQ: () => null,
    // No groups: the Groups portrait's own empty state is a live-mode
    // surface too, and inventing a reveal history here would be sample
    // data wearing a live badge — the exact thing D9 removed.
    groups: () => [],
    todayQ: () => null,
    myDuelVote: () => null,
    revealFor: () => null,
    revealHistory: () => [],
    loadRevealHistory: async () => {},
    createGroup: async () => ({ gid: "g_test", inviteCode: "ABCD2345" }),
    joinGroup: async () => ({ gid: "g_test", name: "Test" }),
    leaveGroup: async () => ({ gid: "g_test", deleted: false }),
    // Handles and invitations (D122). Empty and inert for the same reason
    // the groups and takes below are: a seeded invitation would be sample
    // data wearing a live badge, and "nobody has invited you" IS the live
    // surface a new account opens on.
    whoIs: async () => null,
    claimHandle: async (handle: string) => ({ handle }),
    inviteToGroup: async () => ({ ok: true }),
    acceptInvite: async () => ({ gid: "g_test", name: "Test" }),
    declineInvite: async () => ({ ok: true }),
    invites: () => [],
    invitesLoading: () => false,
    loadInvites: async () => {},
    voteDuel: async () => {},
    setDuoMode: async () => {},
    romanticPoolReady: () => false,
    // No takes, for the same reason there are no groups above: a circle
    // with seeded comments in it would be sample data wearing a live
    // badge. The empty list IS the live-mode surface a circle with nothing
    // written in it shows.
    takes: () => [],
    loadTakes: async () => {},
    postTake: async () => null,
    deleteTake: async () => {},
    flagTake: async () => {},
    flagged: () => false,
  };

  // Presence (D84), opted OUT: the stand-in's Near card shows the pitch
  // state, and no test can accidentally depend on a count nobody wrote.
  const near: Dict = {
    supported: () => true,
    on: () => false,
    count: () => null,
    tooFew: () => false,
    updatedAt: () => 0,
    lastError: () => null,
    enable: async () => ({ ok: true }),
    disable: async () => {},
    refresh: () => {},
  };

  const LIVE: Dict = {
    enabled: true,
    ready: true,
    feedReady: true,
    demoInProd: !!opts.demoInProd,
    // Non-empty only in the demoInProd case, matching the real store: the
    // label is what a failed boot leaves behind, and a fixture that always
    // carried one would let a test assert the reason is shown while live.
    bootError: opts.demoInProd ? "auth/network-request-failed — fixture" : "",
    uid: "u_fixture",
    displayName: "Tester",
    // No handle: an account that has not claimed one is the state a new
    // install opens on, and it is the state the claim row has to render
    // (D122).
    handle: "",
    myCity: opts.myCity ?? "Oslo, NO",
    appBuild: 1,
    latestBuild: 1,
    updateAvailable: false,
    updateRequired: false,
    updateUrl: "",
    stats: { bankSource: "fixture", aggsFetched: 2, answersFetched: 0 },
    social,
    near,
    deck: () => deck,
    // D100: the Mirror reads the archive rather than the pager. The
    // fixture serves the same questions through both — a mount test's
    // question is whether the panel renders, and giving the two sources
    // different content would only make it ambiguous which one it used.
    // The archive entries carry the bank fields the pager's do not, so
    // the Answers lens's branch chips and Scores have something to read.
    aggregated: () => deck,
    dailyBank: () => deck.map((q) => ({ id: q.id, prompt: q.text })),
    // Below the floor the server publishes `{ tooSmall: true }` and nothing
    // else — no counts, no total. Returning a full document with a flag set
    // would let a card read numbers the real k-floor never sends.
    aggFor: () => (tooSmall
      ? { tooSmall: true }
      : {
        counts: { 0: 12, 1: 8, 2: 5 }, total: 25, tooSmall: false,
        // A real breakdown, not `{}`. It was empty for as long as
        // nothing rendered from it, and that made the Mirror's
        // geographic stops paint ZERO answer rows under the fixture —
        // every cohort lookup missed, so the mount tests were proving
        // the panel's empty state and reading as if they proved the
        // panel. The city key is the anchor's own format (name, ISO)
        // and the country key its ISO half, which is what
        // LiveCohortBody looks up.
        by: {
          city: { "Oslo, NO": { 0: 7, 1: 4, 2: 2 } },
          country: { NO: { 0: 9, 1: 6, 2: 3 } },
          ageBand: { "25-34": { 0: 8, 1: 3, 2: 1 }, "35-44": { 0: 4, 1: 5, 2: 4 } },
        },
      }),
    // D91: counts for a seeded lens question, null when the bank carries
    // none — which is the cue for D50's selfOnly fallback. Five entries to
    // match the lens scale; zeros below the floor, same rule as aggFor.
    // Named who-voted (D98). The fixture serves one named voter and one
    // unnamed, on opposite options, so a live-mode mount exercises both
    // label paths rather than only the happy one.
    // The follow graph (D101). A circle of one, mutual and named, so a
    // live mount renders the member row, the "follows you" mark and the
    // circle-split section rather than three empty states. Its answers
    // overlap the fixture deck on purpose — an empty overlap would make
    // the likeness line read "nothing in common yet" everywhere.
    // Foresight (D126). An empty-but-loaded log: the lens then renders
    // its first card rather than the "couldn't load" arm, which is what
    // a mount test needs to walk.
    loadForesight: async () => {},
    foresightLog: () => ({}) as Record<string, unknown>,
    foresightLoading: () => false,
    scoreForesight: async () => {},
    loadCircle: async () => {},
    circle: () => [
      {
        uid: "u_other", name: "Ada", mutual: true,
        like: { shared: 2, same: 1, pct: 50 },
        // Scored, so the mount walks the PRIMARY basis rather than only
        // the fallback — the member row prints "across 1 test · 78%" here
        // and would print "1/2 the same · 50%" for a member with none.
        score: { match: 78, axes: 5, tests: 1 },
      },
    ],
    circleLoading: () => false,
    // Answers already loaded in the fixture, so the mount reaches the
    // splits section rather than stopping at its cost gate. The gated
    // state is the DEFAULT in the app and has its own case.
    loadCircleAnswers: async () => {},
    circleAnswers: () => ({ u_other: { "daily-000": 1, "daily-001": 0 } }),
    circleAnswersLoaded: () => true,
    circleAnswersLoading: () => false,
    isFollowing: (u: string) => u === "u_other",
    setFollowing: async () => {},
    // The follow SET (D149) — the same graph the fold above describes, so
    // it names the same account. A mount that disagreed with itself about
    // who your friends are would make the Friends cut untestable here.
    loadFollows: async () => {},
    follows: () => ["u_other"],
    followsLoading: () => false,
    loadVoters: async () => {},
    voters: () => [
      { uid: "u_fixture", optionIdx: 0, anchors: { ageBand: "25-34", city: "Oslo, NO" }, name: "Tester", isMe: true },
      { uid: "u_other", optionIdx: 1, anchors: {}, name: "", isMe: false },
    ],
    votersByOption: () => [
      [{ uid: "u_fixture", optionIdx: 0, anchors: { ageBand: "25-34", city: "Oslo, NO" }, name: "Tester", isMe: true }],
      [{ uid: "u_other", optionIdx: 1, anchors: {}, name: "", isMe: false }],
    ],
    votersLoading: () => false,
    // The Friends cut's own read. Returns only `u_other` — the account
    // `follows` above names — because that is what the real loader does:
    // it asks your follows directly rather than filtering the sample in
    // `voters`, so the viewer's own row is not in it to be filtered out.
    // A fixture that returned the `voters` list here would let the panel
    // go back to filtering and still pass.
    loadFriendVoters: async () => {},
    friendVoters: () => [
      { uid: "u_other", optionIdx: 1, anchors: {}, name: "", isMe: false },
    ],
    friendVotersLoading: () => false,
    // The who-voted sheet's type cut (data/typeSplit.ts). Both branches
    // reachable from one list: `u_fixture` carries a readable Big Five and
    // types, `u_other` has none and lands in the gap between `sampleN` and
    // `typedN` that the card's basis line exists to state.
    voterScores: () => [
      { uid: "u_fixture", optionIdx: 0, results: { big5: { O: 72, C: 55, E: 15, A: 58, N: 50 } } },
      { uid: "u_other", optionIdx: 1, results: null },
    ],
    // The world-takes author name path (D98). One known author so a live
    // mount renders a real name, and anything else falls back to
    // "Someone" — both branches reachable from the fixture.
    nameFor: (uid: string) => (uid === "u_fixture" ? "Tester" : ""),
    loadNames: async () => {},
    // Kindred (D99): one overlapping person, so a live mount renders a
    // ranked row rather than only the empty state.
    loadKindred: async () => {},
    kindred: () => [
      { uid: "u_other", name: "Ada", like: { shared: 6, same: 5, pct: 83 } },
    ],
    kindredLoading: () => false,
    kindredDepth: () => 6,
    // Similarity (D112): Ada again, in the viewer's own city and with a
    // stored Big Five, and the viewer scored too — so a live mount of the
    // City field renders a POSITIONED, score-matched person rather than
    // only the empty state. testFeedItems stays empty: the place fields'
    // arithmetic has its own unit tests, and here an empty bank renders
    // their honest "no scored answers yet" state, which is what a mount
    // test should see from a fixture with no test-item aggregates.
    loadSimilarity: async () => {},
    similarityLoading: () => false,
    testFeedItems: () => [],
    myTestResults: () => ({
      big5: { title: "Big Five", dims: [
        { id: "O", label: "Openness", value: 70 },
        { id: "C", label: "Conscientiousness", value: 55 },
        { id: "E", label: "Extraversion", value: 40 },
        { id: "A", label: "Agreeableness", value: 65 },
        { id: "N", label: "Sensitivity", value: 45 },
      ] },
    }),
    kindredPeople: () => [
      {
        uid: "u_other", name: "Ada", city: opts.myCity ?? "Oslo, NO",
        like: { shared: 6, same: 5, pct: 83 },
        results: { big5: { O: 80, C: 50, E: 45, A: 60, N: 50 } },
      },
    ],
    lensAgg: () => ((opts.lensBank ?? true)
      ? { counts: tooSmall ? [0, 0, 0, 0, 0] : [9, 6, 4, 3, 3], tooSmall }
      : null),
    myVotes: () => ({ ...votes }),
    confirmedVotes: () => ({ ...votes }),
    // The daily pulse (D139): the fixture mirrors the real pair — the
    // day-keyed create into the same votes map, and the derived
    // day → optionIdx view over it.
    votePulse: (baseQid: string, optionIdx: number) => {
      const aid = `${baseQid}_${new Date().toISOString().slice(0, 10)}`;
      if (!votes[aid]) votes[aid] = String(optionIdx);
      return Promise.resolve();
    },
    pulseVotes: (baseQid: string) => {
      const out: Record<string, number> = {};
      for (const [aid, v] of Object.entries(votes)) {
        if (aid.startsWith(`${baseQid}_`)) out[aid.slice(baseQid.length + 1)] = Number(v);
      }
      return out;
    },
    // One Crossroads story (D136), shaped exactly as buildFeedGlobals emits
    // it: eight per-ending counts in PATH_ENDINGS order, and a total. The
    // counts are lopsided on purpose — a flat eight would make every branch
    // the same width, so a card that ignored `counts` entirely and drew a
    // uniform tree would look correct.
    //
    // `tooSmall` empties them, which is this fixture's way of asking for the
    // nobody-has-finished-this-yet arm: total 0, no tree, no share chips.
    pathQs: () => [{
      id: "feed-fixture-path",
      title: PATH_TITLE,
      intro: "A fixture story, three forks deep.",
      hue: 20,
      nodes: Object.fromEntries(
        ["_", "A", "B", "AA", "AB", "BA", "BB"].map((k) => [
          k, { q: `Fork ${k === "_" ? "opening" : k}`, a: [{ t: `${k} left` }, { t: `${k} right` }] },
        ]),
      ),
      endings: Object.fromEntries(
        ["A", "B"].flatMap((a) => ["A", "B"].flatMap((b) => ["A", "B"].map((c) => a + b + c)))
          .map((k) => [k, { name: `Ending ${k}`, line: `The ${k} road ends here.` }]),
      ),
      counts: tooSmall ? [0, 0, 0, 0, 0, 0, 0, 0] : [40, 5, 10, 5, 20, 5, 10, 5],
      total: tooSmall ? 0 : 100,
      live: true as const,
    }],
    // (qid, optionId) — both strings. The spec layer calls this as
    // `window.LIVE.vote(id, String(val))`, and the first draft of this
    // fixture took a question OBJECT: the surface pin cannot catch that,
    // because it compares key names and not signatures, so the tests would
    // have recorded votes under `undefined` and still passed.
    vote: (qid: string, optionId: string) => {
      if (votes[qid]) return;              // one answer per question, as rules enforce
      votes[qid] = optionId;
      listeners.forEach((fn) => fn());
    },
    // D86 edit path, same contract as the real store: false when there is
    // nothing to move, so tests can drive both branches of an affordance.
    editVote: (qid: string, optionId: string) => {
      if (!votes[qid] || votes[qid] === optionId) return false;
      votes[qid] = optionId;
      listeners.forEach((fn) => fn());
      return true;
    },
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    anchors: () => ({ ...(opts.anchors ?? {}) }),
    saveDisplayName: async () => {},
    saveAnchors: () => {},
    saveTestResult: () => {},
    // Learn (D32): the fixture answers nothing and has no aggregates, so
    // every learn reveal renders the ESTIMATE path with its label — which
    // is exactly the honest cold-start state the live tests should see.
    learnAnswer: () => {},
    learnAgg: () => null,
    // Nothing written this session, so nothing pending — the fixture's
    // reveals read exactly what `learnAgg` gives them.
    learnMine: () => null,
    // The D125 warm-up. A no-op here for the same reason learnAgg returns
    // null: the fixture has no aggregates, so the honest state it renders
    // is the labelled estimate.
    loadLearnAggs: async () => {},
    linkGoogle: async () => {},
    // Anonymous-first (D3) is the default state, so that is what the fixture
    // renders — the branch the privacy panel and profile overlay both
    // describe in copy.
    linked: false,
    // Operator-only and never rendered; present so the fixture's key set
    // still matches the real surface (fixtureSurfaceMismatch checks both
    // directions).
    seedContent: async () => ({ written: 0, skipped: 0 }),
    deleteAccount: async () => {},
  };

  // The same globals buildFeedGlobals() publishes. WORLD_FEED_COMMENTS is
  // {} in live mode on purpose (D11's second layer: even if the render gate
  // were removed there would be no take data to draw), so the fixture sets
  // it to {} for the same reason rather than leaving the demo seed in place.
  const w = window as unknown as Dict;
  const saved: Dict = {
    LIVE: w.LIVE,
    WORLD_FEED_QS: w.WORLD_FEED_QS,
    TEST_FEED_QS: w.TEST_FEED_QS,
    WORLD_FEED_COMMENTS: w.WORLD_FEED_COMMENTS,
  };

  // defineProperty, not Object.assign: four real members (stats, appBuild,
  // updateAvailable, updateRequired) are getters with no setter, and an
  // assignment to one of those throws in a module's strict mode.
  const target = realLive as unknown as Dict;
  // What the fixture actually overrides. Captured because the drift check
  // below cannot otherwise see it: `target` IS the real store with these
  // keys redefined on top, so Object.keys(target) reports the real
  // object's surface whether the fixture stubbed a member or not. Without
  // this the guard silently degraded into a second copy of vote.test.ts's
  // check, and a member the fixture forgot would reach real Firebase from
  // a jsdom test — which fails as a caught error and renders an honest
  // empty state, i.e. invisibly.
  const fixtureKeys = Object.keys(LIVE);
  const savedDescriptors = new Map<string, PropertyDescriptor | undefined>();
  for (const [k, v] of Object.entries(LIVE)) {
    savedDescriptors.set(k, Object.getOwnPropertyDescriptor(target, k));
    Object.defineProperty(target, k, {
      value: v, writable: true, configurable: true, enumerable: true,
    });
  }
  const restoreLive = () => {
    for (const [k, d] of savedDescriptors) {
      if (d) Object.defineProperty(target, k, d);
      else delete target[k];
    }
    savedDescriptors.clear();
    if (saved.LIVE === undefined) delete w.LIVE;
    else w.LIVE = saved.LIVE;
  };
  w.LIVE = target;

  // demoInProd is a real user in a LIVE build whose boot did not attach, so
  // the feed falls back to the spec layer's own mock data — demo cards, with
  // their seeded takes and fake named people, in front of someone who is not
  // in a demo. That is the situation renderEngage's demoInProd check exists
  // for, and it is the ONLY thing suppressing the engage row there, because
  // `q.live` is false on every one of those cards.
  //
  // So the fixture must leave the demo feed globals alone in this mode.
  // Overriding them with live cards (which the first draft did) tests the
  // q.live gate a second time and leaves the demoInProd check unexercised —
  // confirmed by deleting that check and watching the suite stay green.
  if (opts.demoInProd) {
    return { LIVE: target, fixtureKeys, votes, restore: restoreLive };
  }

  // Deliberately NOT the deck's questions. The daily tab renders the deck
  // card and the feed on the same screen, so reusing the prompts put every
  // string on it twice and left a test unable to say which card it had hold
  // of. FEED_PROMPT and FEED_OPTIONS below are unique to the feed card —
  // card 0 keeps them verbatim so existing exact-match queries still bind
  // to exactly one card; the extras a feedCards case asks for carry a
  // numbered suffix.
  w.WORLD_FEED_QS = Array.from(
    { length: Math.max(1, opts.feedCards ?? 1) },
    (_, i) => ({
      id: `feed-fixture-${i}`,
      cat: "culture",
      type: "vote",
      prompt: i === 0 ? FEED_PROMPT : `${FEED_PROMPT} (${i + 1})`,
      options: FEED_OPTIONS.map((label, j) => ({
        label,
        count: tooSmall ? 0 : [14, 9][j],
      })),
      live: true,
      tooSmall,
    }),
  );
  w.TEST_FEED_QS = [];
  w.WORLD_FEED_COMMENTS = {};

  return {
    LIVE: target,
    fixtureKeys,
    votes,
    restore() {
      restoreLive();
      for (const [k, v] of Object.entries(saved)) {
        if (k === "LIVE") continue;          // restoreLive owns that one
        if (v === undefined) delete w[k];
        else w[k] = v;
      }
    },
  };
}

// Both directions, same argument as the real surface pin: a member the spec
// layer reads but the fixture lacks makes a live test pass against `undefined`
// rather than against behaviour, and a member the fixture invents is one no
// consumer will ever look up.
export function fixtureSurfaceMismatch(handle: LiveHandle): {
  live: string[]; social: string[]; near: string[];
} {
  const diff = (actual: string[], expected: string[]) => [
    ...actual.filter((k) => !expected.includes(k)).map((k) => `+${k}`),
    ...expected.filter((k) => !actual.includes(k)).map((k) => `-${k}`),
  ];
  return {
    // handle.fixtureKeys, NOT Object.keys(handle.LIVE): the fixture
    // redefines members on the real store, so the latter answers with the
    // real surface and can never report a member the fixture skipped.
    live: diff(handle.fixtureKeys, LIVE_MEMBERS),
    social: diff(Object.keys(handle.LIVE.social as Dict), LIVE_SOCIAL_MEMBERS),
    near: diff(Object.keys(handle.LIVE.near as Dict), LIVE_NEAR_MEMBERS),
  };
}

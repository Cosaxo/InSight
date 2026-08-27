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
import { publishTestFeed, resetTestFeed } from "../data/testFeed";
import { publishLearnBank, resetLearnBank } from "../data/learnBank";
import { LIVE_MEMBERS, LIVE_NEAR_MEMBERS, LIVE_SOCIAL_MEMBERS } from "./live-surface";
import { agreementOf } from "../data/cohort";

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
  /**
   * Mark the LAST world card as sponsored (D195). Off by default and
   * opt-in for a reason: the shipped bank carries no sponsored question,
   * so a fixture that always did would be the only place in the tree
   * where a paid card exists — and every other live case would be
   * asserting against a feed nobody serves.
   */
  sponsored?: boolean;
  /**
   * Put one ad in the pool (D197). Off by default and opt-in for the same
   * reason `sponsored` is: `content/ads.json` ships empty, so a fixture
   * that always carried one would be the only place in the tree where an
   * ad exists — and every other live case would assert against a feed
   * nobody is served.
   */
  adCard?: boolean;
  /**
   * Append one live catalogue-pick card (D14 gone live) after the vote
   * cards. Opt-in, but for feedCards' reason rather than sponsored's —
   * the shipped bank DOES carry pick cards now; appending one to every
   * case would just shift the card counts existing assertions hold.
   * pickCanon/pickSegs/pickSeg above serve its board.
   */
  pickCard?: boolean;
  /**
   * Append one live rank card (D233), shaped as buildFeedGlobals emits
   * it: items, a DERIVED crowd (1-based rank per item), votes from the
   * agg total. Opt-in for pickCard's reason. `tooSmall` empties the
   * crowd to null — the first-voter state, where the card must render
   * your order without a crowd column.
   */
  rankCard?: boolean;
  /**
   * Publish one live TEST item into the feed's test stream (D280), shaped
   * as buildFeedGlobals emits it: a bank id, the instrument key the
   * progress row folds on, and counts from the aggregate.
   *
   * Opt-in for pickCard's reason and one more. The pool this replaces is
   * the DEMO one — a hundred-odd cards whose counts are a hash of the
   * question id — and until D280 it reached a live feed whatever this
   * fixture did, because the store published onto `window` and the feed
   * had been converted to import the demo array. Off, the live feed
   * carries no test cards at all, which is what every case in this suite
   * has always claimed to be asserting against.
   */
  testCard?: boolean;
  /**
   * Publish one live LEARN card (D284), in the engine's own vocabulary —
   * the shape `buildLearnBank` translates a bank document into.
   *
   * Opt-in, and the DEFAULT is the case that matters: with this off the
   * fixture publishes an EMPTY live bank, which is what a live build with
   * no seeded learn documents actually has. Before D284 the bundle carried
   * the whole card bank, so a live build served 146 demo cards whatever the
   * backend held — the same class of thing D280 fixed for test cards.
   */
  learnCard?: boolean;
  /**
   * Give the LAST world card a background (D281) — the paragraph the
   * card's `i` opens. Opt-in like the rest: most of the bank carries
   * none, and a fixture that always did would have the "About this
   * question" arm of that button untested everywhere.
   */
  background?: boolean;
  /**
   * Give the DAILY (daily-000) a background (D306) — the same slot the
   * feed's `i` got at D281, read through buildS's bg carry. Opt-in so the
   * default mount keeps pinning the daily sheet's no-background arm.
   */
  dailyBg?: boolean;
  /**
   * Give the LAST world card a current-events window (D231). Opt-in for
   * the same reason `sponsored` is — a window is a property of one topic,
   * and a fixture that always carried one would have every other live case
   * asserting against a card the feed only serves for a week.
   *
   * The dates are computed from the run's own clock so the assertion is
   * the same on any day: opens today, closes in three, which is four days
   * left and a full ring.
   *
   * The card keeps the fixture's `culture` topic rather than taking `now`,
   * and that is the test environment rather than a shortcut: these suites
   * mount a DEMO build, whose channel list is the prototype's fixed six
   * (world-feed-data.js reads the build flag at module scope, which is why
   * world-channels.test.js re-imports to test the other side). A `now`
   * card matches no demo channel and never reaches the pool. What is being
   * pinned here is the ring, and a window is a property of the CARD — the
   * topic that may carry one is check:quality's rule, held in the bank.
   */
  windowed?: boolean;
  /**
   * The Patterns tab's mount gate as the fit would have published it
   * (D265) — `{ pool, basis, mine }`, straight through to
   * `patternsSignal()`. Absent by default, which is the state every other
   * live case was written against: no fit has run, so the bar is two tabs
   * and the third one is not there to be found.
   *
   * Opt-in rather than always-on for `sponsored`'s reason: an app whose
   * gate is open is one particular app, and every case that is not about
   * the gate should be asserting against the one the fit has not reached
   * yet.
   */
  patterns?: { pool?: number; basis?: number; mine?: number };
}

const OPTION_COLORS = ["var(--c-around)", "var(--c-today)", "var(--c-likeness)"];

/** A UTC day key `n` days from now — live.ts's own arithmetic (D231). */
const dayKey = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// The feed card's prompt and options, exported so a test can target the feed
// rather than the daily deck card sharing the screen with it. Strings chosen
// to appear nowhere else in the spec layer's demo data.
export const FEED_PROMPT = "Fixture feed card: does the gate hold?";
export const FEED_OPTIONS = ["Gate holds", "Gate leaks"];
/** The fixture Crossroads story's title — unique, so a query binds to the card. */
export const PATH_TITLE = "Fixture Crossroads: the forked road";

// The pick card's prompt (D14) — unique for FEED_PROMPT's reason: a test
// must be able to say which card it has hold of.
export const PICK_PROMPT = "Fixture pick card: your favourite fixture?";

// The rank card's prompt (D233), same rule.
export const RANK_PROMPT = "Fixture rank card: order the fixtures";

// The live TEST item's prompt and options (D280), same rule again — and
// here the uniqueness is load-bearing rather than convenient: the whole
// point of the case is telling a bank item apart from a demo one, and the
// demo pool's prompts are the real instruments' wording.
export const TEST_ITEM_PROMPT = "Fixture test item: the bank's own, not the demo pool's.";

// The live LEARN card (D284), unique for the same reason and with the same
// weight: the demo sample's prompts are the real cards' wording, so the
// prompt is what tells a bank card apart from a compiled-in one.
export const LEARN_CARD_PROMPT = "Fixture learn card: which bank is this from?";
export const LEARN_CARD_OPTIONS = ["The seeded bank", "The bundle", "Neither", "Both"];
export const TEST_ITEM_OPTIONS = [
  "Strongly agree", "Agree", "Neutral", "Disagree", "Strongly disagree",
];

// The background paragraph (D281), unique for FEED_PROMPT's reason — and
// long enough to be one: the gate's own floor is 90 characters, so a
// three-word fixture string would pin a shape the bank cannot contain.
export const BG_TEXT =
  "Fixture background: the durable facts this question cannot be answered without, "
  + "stated plainly and taking no side between the options on the card.";

// The daily's own background (D306) — distinct from BG_TEXT so a test can
// tell which sheet it is reading, same 90-character floor for the same
// reason.
export const DAILY_BG_TEXT =
  "Fixture daily background: who or what this question names, stated plainly "
  + "for a reader meeting the subject for the first time.";

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
    {
      ...liveQuestion("daily-000", "Would you rather know, or be known?", tooSmall),
      // D306: the daily's About sheet leads with a background when the
      // question carries one — opt-in, so the default mount keeps the
      // no-background arm honest.
      ...(opts.dailyBg ? { bg: DAILY_BG_TEXT } : {}),
    },
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
    requestJoin: async () => ({ gid: "g_test", name: "Test", status: "requested" as const }),
    approveJoin: async () => ({ ok: true }),
    declineJoin: async () => ({ ok: true }),
    leaveGroup: async () => ({ gid: "g_test", deleted: false }),
    // Handles and invitations (D122). Empty and inert for the same reason
    // the groups and takes below are: a seeded invitation would be sample
    // data wearing a live badge, and "nobody has invited you" IS the live
    // surface a new account opens on.
    whoIs: async () => null,
    // The name half of finding somebody (D239). Empty, like every
    // other read here — a fixture that returned people would put
    // invented names in a live-mode smoke test.
    searchPeople: async () => [],
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
    // D174's three states. `session` is what enable() lands on, so a
    // fixture that flips `on` gets the shape a real opt-in produces.
    mode: () => "session",
    until: () => Date.now() + 90 * 60_000,
    count: () => null,
    // D176's room mix — null by default, which is the quiet-street case.
    mix: () => null as { top: string[]; n: number; capped?: boolean } | null,
    tooFew: () => false,
    updatedAt: () => 0,
    lastError: () => null,
    // D177's room. Null rather than an empty roster, which is the
    // never-asked state — the tabs load it on a tap, so a smoke test that
    // never opens one should see exactly this.
    room: () => null as { people: Array<{ uid: string; type?: string }>; qs: Dict } | null,
    roomLoading: () => false,
    loadRoom: async () => {},
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
    // The Patterns pool's feed half. Empty rather than invented: the tab's
    // live mount is asserted on its honest empty state (no loadings doc in
    // jsdom), so fixture feed questions here would be furniture nothing
    // reads.
    coreFeedAggregated: () => [],
    // The Scores lens's ask rows (D307). Empty by default: the fixture
    // deck's one rating question already carries a vote in most cases,
    // and the ask arm has its own unit suite (LiveMirrorLenses.test.tsx).
    placeAsks: () => [],
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
        like: agreementOf(1, 2),
        answers: { "daily-000": 1, "daily-001": 0 },
      },
    ],
    circleLoading: () => false,
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
    // D177's read half of the same profile cache — the room roster has
    // uids and nothing else, so it is the first consumer to need it.
    scoresFor: () => null,
    // The profile photo (D178). No face in the fixture: initials are the
    // permanent fallback, so this is the shape every mount test should see
    // unless it is specifically about a photo.
    faceFor: () => "",
    myFace: () => "",
    setAvatar: async () => ({ ok: true }),
    removeAvatar: async () => {},
    flagAvatar: async () => {},
    flaggedAvatar: () => false,
    loadNames: async () => {},
    // Kindred (D99): one overlapping person, so a live mount renders a
    // ranked row rather than only the empty state.
    loadKindred: async () => {},
    kindred: () => [
      { uid: "u_other", name: "Ada", like: agreementOf(5, 6) },
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
        like: agreementOf(5, 6),
        results: { big5: { O: 80, C: 50, E: 45, A: 60, N: 50 } },
      },
    ],
    lensAgg: () => ((opts.lensBank ?? true)
      ? { counts: tooSmall ? [0, 0, 0, 0, 0] : [9, 6, 4, 3, 3], tooSmall }
      : null),
    // The mount gate's two numbers (D265). Absent unless a case asks:
    // `{}` is "no fit has published", which reads as a closed gate through
    // patternsReady's own defaults rather than through a second branch.
    patternsSignal: () => ({ ...(opts.patterns ?? {}) }),
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
    // The roster as the bank hands it over (D203). Two pulses on purpose:
    // one on the default daily cadence and one that is not, so a fixture
    // mount exercises the "not scheduled today" absence rather than only
    // the answered/missed pair.
    pulseQs: () => ([
      { id: "pulse-pace", prompt: "What pace was today?", options: ["Crawling", "Dragging", "Steady", "Brisk", "Flying"] },
      { id: "pulse-sleep", prompt: "How did you sleep?", options: ["Badly", "Patchy", "OK", "Well", "Deeply"] },
    ]),
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
    // Catalogue picks (D14 gone live). The fixture mirrors the real
    // quartet: a create-only entity write into the shared votes map, and
    // the three board reads in the demo store's shapes. One two-row board
    // so the reveal has something to lay out; `tooSmall` empties it, the
    // freshly-live state where the viewer's own pick is the whole crowd.
    votePick: (qid: string, entity: number) => {
      if (!votes[qid]) votes[qid] = String(entity);
    },
    pickCanon: () => (tooSmall
      ? { top: [], rest: 0, total: 0, restEntities: 0, restBelowFloor: false }
      : {
          top: [{ entity: 128514, count: 9 }, { entity: 10084, count: 4 }],
          rest: 3, total: 16, restEntities: 0, restBelowFloor: false,
        }),
    pickSegs: () => (tooSmall ? [] : [{ dim: "ageBand", bucket: "18-24" }]),
    pickSeg: (_qid: string, dim: string, bucket: string) => (
      !tooSmall && dim === "ageBand" && bucket === "18-24"
        ? { rows: [{ entity: 128514, count: 5 }, { entity: 10084, count: 2 }], cohort: 7 }
        : null),
    // Rank answers (D233): the create-only order write, into the shared
    // votes map in the store's own joined form.
    voteRank: (qid: string, order: number[]) => {
      if (!votes[qid]) votes[qid] = order.join(",");
    },
    // Foresight CALL, tier A (D194). One open call, ungraded — the state
    // the feed head shows most of the time, and the one the mount tests
    // care about (the card renders, and it renders REAL bank shape rather
    // than a demo cast). The grades map is present-but-empty-valued rather
    // than null: null means "nothing read yet", in which state the card
    // deliberately draws nothing, and a fixture that left it there would
    // make every live mount test pass against an absent card.
    callQs: () => [{
      id: "call-fixture",
      surface: "call",
      seq: 0,
      type: "call",
      prompt: "Will the fixture question end up lopsided?",
      options: ["It will", "It stays close"],
      topic: null,
      test: null,
      active: true,
      tier: "A",
      resolvesAt: "2099-01-01",
      rubric: { kind: "agg" as const, qid: "feed-fixture", test: "topShareAtLeast" as const, threshold: 60 },
      counts: tooSmall ? [0, 0] : [61, 39],
    }],
    callOutcomes: () => ({ "call-fixture": null }),
    loadCallOutcomes: () => Promise.resolve(),
    // Feed ads (D197). Empty by default, exactly like the shipped pool —
    // `adCard` opts one in, so every other live case keeps asserting
    // against the feed real users actually get.
    feedAds: (): unknown[] => (opts.adCard
      ? [{
        id: "ad-fixture", seq: 0, advertiser: "Fixture Transit",
        headline: "Night buses now run until three.",
        body: "Every Friday and Saturday, on the four city lines.",
        until: "2099-01-01", audience: { city: "Oslo, NO" },
      }]
      : []),
    loadAds: () => Promise.resolve(),
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
    // D331. Defaults to CONSENTED in the fixture, deliberately: every
    // mount test that draws a political surface should exercise the path
    // that publishes, and the refusal path has its own cases in
    // political-consent.test.ts. A fixture defaulting to off would make
    // the compass silently absent everywhere and read as a broken fold.
    politicalConsented: () => true,
    setPoliticalConsent: () => Promise.resolve(),
    syncPassiveResults: () => {},
    loadCityKindred: async () => {},
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
    WORLD_FEED_COMMENTS: w.WORLD_FEED_COMMENTS,
    // TEST_FEED_QS is NOT here any more: since D280 the test pool travels
    // through data/testFeed.ts rather than the window, and `restore()`
    // hands it back with resetTestFeed(). A saved window key would have
    // restored a value nothing reads.
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
      // D195: the disclosure travels ON the card, so world-feed's dispatch
      // reads the same field buildFeedGlobals emits.
      ...(opts.sponsored && i === Math.max(1, opts.feedCards ?? 1) - 1
        ? { sponsor: { buyer: "Fixture Transit", audience: { city: "Oslo, NO" } }, until: "2099-01-01" }
        : {}),
      // D231: the ask window travels ON the card too, for the same reason
      // — world-feed reads the fields buildFeedGlobals emits.
      ...(opts.windowed && i === Math.max(1, opts.feedCards ?? 1) - 1
        ? { from: dayKey(0), until: dayKey(3) }
        : {}),
      // D281: the background rides ON the card too — same rule again, the
      // feed reads the field buildFeedGlobals emits.
      ...(opts.background && i === Math.max(1, opts.feedCards ?? 1) - 1
        ? { bg: BG_TEXT }
        : {}),
    }),
  );
  // The live pick card, shaped exactly as buildFeedGlobals emits it: no
  // options (the catalogue is the answer space), `n` from the agg total,
  // and the domain one of the committed catalogues — emoji, matching the
  // entities pickCanon above answers with.
  if (opts.pickCard) {
    (w.WORLD_FEED_QS as Dict[]).push({
      id: "pick-fixture",
      cat: "fav",
      type: "pick",
      domain: "emoji",
      prompt: PICK_PROMPT,
      n: tooSmall ? 0 : 16,
      live: true,
      noCountsYet: !!tooSmall,
    });
  }
  // The live rank card (D233), buildFeedGlobals' own shape. The crowd is
  // pre-derived (the store does that, not the card) — null in the
  // tooSmall/first-voter arm, where renderRank must show your order and
  // no crowd column rather than crashing on q.crowd[it].
  if (opts.rankCard) {
    (w.WORLD_FEED_QS as Dict[]).push({
      id: "rank-fixture",
      cat: "culture",
      type: "rank",
      prompt: RANK_PROMPT,
      items: ["Alpha", "Beta", "Gamma", "Delta"],
      crowd: tooSmall ? null : [1, 3, 2, 4],
      votes: tooSmall ? 0 : 9,
      live: true,
      noCountsYet: !!tooSmall,
    });
  }
  // The live test pool, through the publisher the store itself uses
  // (D280). This used to be `w.TEST_FEED_QS = []`, which asserted nothing
  // once D249 pointed the feed at the demo import instead — the fixture
  // said "no demo test cards here" and the mounted app served a hundred of
  // them, with hash-invented counts, through every case in this suite.
  // Empty by default so a live feed holds exactly the cards a case asked
  // for; `testCard` adds one bank item, shaped as buildFeedGlobals emits
  // it, for the cases that need a real one to bind on.
  publishTestFeed(
    opts.testCard
      ? [{
        id: "test-political-99",
        cat: "test",
        type: "vote",
        test: "political",
        prompt: TEST_ITEM_PROMPT,
        options: TEST_ITEM_OPTIONS.map((label, j) => ({
          label,
          count: tooSmall ? 0 : [11, 7, 5, 3, 2][j],
        })),
        live: true,
        noCountsYet: !!tooSmall,
      }]
      : [],
  );
  // The live learn bank. Empty by default — see `learnCard` — and that
  // default is the assertion: a live build serves the cards its backend
  // holds, never the sample compiled in for the demo build.
  //
  // SIX cards, not one, and the number is the scheduler's rather than a
  // taste call: `learn-progress.js`'s GAP is 4, so a case that walks a
  // card's spacing has to be able to plan four others without repeating.
  // A one-card bank is a degenerate pool no real backend has.
  publishLearnBank(
    opts.learnCard
      ? Array.from({ length: 6 }, (_, i) => ({
        id: `fixlearn${i + 1}`,
        f: "cell",
        q: i === 0 ? LEARN_CARD_PROMPT : `${LEARN_CARD_PROMPT} (${i + 1})`,
        // Distinct labels per card, which is what the bank has and what a
        // test needs: the reveal cases find a row by its option's
        // accessible name, and six cards sharing one option set puts four
        // identical buttons on screen at once.
        a: i === 0 ? LEARN_CARD_OPTIONS : LEARN_CARD_OPTIONS.map((o) => `${o} ${i + 1}`),
        // Varied, like the bank's own: `LEARN_ORDER` permutes at render,
        // so an authored index is invisible to a reader either way — but
        // a fixture whose answer is always index 0 would pass a test that
        // reads the first button and calls it correct.
        c: i % LEARN_CARD_OPTIONS.length,
        t: (i + 1) % LEARN_CARD_OPTIONS.length,
        p: 50 + i * 4,
        k: `The bank, not the bundle (${i + 1})`,
      }))
      : [],
  );
  w.WORLD_FEED_COMMENTS = {};

  return {
    LIVE: target,
    fixtureKeys,
    votes,
    restore() {
      restoreLive();
      resetTestFeed();
      resetLearnBank();
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

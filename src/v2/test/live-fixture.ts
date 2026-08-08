// A stand-in `window.LIVE` for mount tests, plus the feed globals live.ts
// publishes alongside it.
//
// WHY THIS EXISTS. `test/smoke.test.jsx` mounts the whole app and proves the
// screens paint — but only in DEMO mode. `window.LIVE` is undefined
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
import { LIVE_MEMBERS, LIVE_SOCIAL_MEMBERS } from "./live-surface";

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
   * a lens card on screen asks for at least 9 (D50).
   */
  feedCards?: number;
}

const OPTION_COLORS = ["var(--c-around)", "var(--c-today)", "var(--c-likeness)"];

// The feed card's prompt and options, exported so a test can target the feed
// rather than the daily deck card sharing the screen with it. Strings chosen
// to appear nowhere else in the spec layer's demo data.
export const FEED_PROMPT = "Fixture feed card: does the gate hold?";
export const FEED_OPTIONS = ["Gate holds", "Gate leaks"];

function liveQuestion(id: string, prompt: string, tooSmall: boolean) {
  return {
    id,
    cat: "culture",
    text: prompt,
    dayLabel: "Today",
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
    liveQuestion("daily-001", "Is a promise still binding if nobody remembers it?", tooSmall),
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
    myCity: opts.myCity ?? "Oslo, NO",
    appBuild: 1,
    latestBuild: 1,
    updateAvailable: false,
    updateRequired: false,
    updateUrl: "",
    stats: { bankSource: "fixture", aggsFetched: 2, answersFetched: 0 },
    social,
    deck: () => deck,
    dailyBank: () => deck.map((q) => ({ id: q.id, prompt: q.text })),
    // Below the floor the server publishes `{ tooSmall: true }` and nothing
    // else — no counts, no total. Returning a full document with a flag set
    // would let a card read numbers the real k-floor never sends.
    aggFor: () => (tooSmall
      ? { tooSmall: true }
      : { counts: { 0: 12, 1: 8, 2: 5 }, total: 25, tooSmall: false, by: {} }),
    myVotes: () => ({ ...votes }),
    confirmedVotes: () => ({ ...votes }),
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
    return { LIVE: target, votes, restore: restoreLive };
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
  live: string[]; social: string[];
} {
  const diff = (actual: string[], expected: string[]) => [
    ...actual.filter((k) => !expected.includes(k)).map((k) => `+${k}`),
    ...expected.filter((k) => !actual.includes(k)).map((k) => `-${k}`),
  ];
  return {
    live: diff(Object.keys(handle.LIVE), LIVE_MEMBERS),
    social: diff(Object.keys(handle.LIVE.social as Dict), LIVE_SOCIAL_MEMBERS),
  };
}

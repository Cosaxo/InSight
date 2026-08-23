// @vitest-environment jsdom
//
// The lens store and its feed pool, in LIVE mode — the branches the demo
// suite structurally cannot reach because LIVE.enabled is false there.
//
// WHY THIS EXISTS. LENS_FEED_QS used to be built once at module scope, and
// LIVE.enabled flips only after the async boot — so the pool a live session
// wove into its feed was always the DEMO pool, which excludes each lens's
// seeded prefix as "already answered". Live mode starts every lens at zero,
// so those questions (about 20 of the 50) were simply unreachable from the
// feed: a feed-only user could never take `moral` past 4 of 8, while the
// blank state promised "this fills in as its questions come round in the
// feed". Nothing failed — tsc, eslint, check:globals and both smoke suites
// were green throughout, which is exactly the failure shape this repo keeps
// writing tests for.
//
// Since D91 a live pool has two shapes, and both are pinned here: against a
// seeded bank (LIVE.lensAgg answers counts) the cards are ordinary live
// cards — measured counts, no selfOnly; against a bank with no lens rows
// (lensAgg answers null — an unseeded or pre-D91 backend) D50's selfOnly
// acknowledgment stays, because the authored counts on those cards are the
// fabrication D1 forbids.
//
// Expectations are re-derived from IS_LENSES here (seed arithmetic and all)
// rather than read back from the store, for the same reason logic-gen's
// family tests re-derive rules from the cells: an expectation computed by
// the code under test is not an expectation.
//
// LIVE is flipped on the real singleton, not via a second object on
// `window`: lens-defs.js imports the binding (map-anchors precedent), so a
// `window.LIVE` stand-in would leave the module under test reading
// `enabled: false` while the test believed otherwise — the exact
// two-objects-that-must-agree bug live-fixture.ts documents.
import { afterEach, describe, expect, it } from "vitest";
import realLive from "../data/live";
// LENS_FEED_QS is imported by name since D232 — world-feed.jsx was its only
// consumer, so it no longer publishes to window. LENSES and IS_LENSES still
// mirror, for lens-cards.jsx and profile-general.jsx.
// @ts-expect-error TS7016 — untyped spec module, the house pattern
import { LENS_FEED_QS as lensFeedQsUntyped } from "../spec/lens-defs.js";

interface LensQuestion {
  q: string;
  d: string;
  invert?: boolean;
}
interface LensDef {
  id: string;
  tier: 1 | 2;
  seed?: number;
  questions: LensQuestion[];
}
interface FeedCard {
  id: string;
  lens: string;
  qi: number;
  tier: 1 | 2;
  cat: string;
  type: string;
  prompt: string;
  selfOnly?: boolean;
  live?: boolean;
  noCountsYet?: boolean;
  options: { label: string; count: number }[];
}
/** The untyped spec export, given back the shape `W` used to declare. */
const LENS_FEED_QS = lensFeedQsUntyped as () => FeedCard[];

const W = window as unknown as {
  IS_LENSES: LensDef[];
  LENSES: {
    liveOn(): boolean;
    reset(): void;
    answer(id: string, i: number, val: number): void;
    done(id: string): number;
    subscribe(fn: () => void): () => void;
  };
};

const LS_KEY = "insight.lenses.v1";

// The five labels a lens card renders, agree-FIRST — the seeded bank's lens
// rows carry the same five in the same order (content/lenses.json →
// LENS_SCALE, drift-gated by check:content), and world-feed's `4 - val`
// store inversion depends on it.
const SCALE = ["Strongly agree", "Agree", "Neutral", "Disagree", "Strongly disagree"];

// Counts lensAgg hands back in the seeded-bank cases below. Descending on
// purpose, so asserting the rendered order equals SCALE also proves the
// counts were taken by index rather than re-sorted.
const AGG_COUNTS = [9, 6, 4, 3, 3];

const target = realLive as unknown as Record<string, unknown>;
const savedDescriptors = new Map<string, PropertyDescriptor | undefined>();
function setLive(members: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(members)) {
    if (!savedDescriptors.has(k)) {
      savedDescriptors.set(k, Object.getOwnPropertyDescriptor(target, k));
    }
    Object.defineProperty(target, k, {
      value: v, writable: true, configurable: true, enumerable: true,
    });
  }
}
function restoreLive(): void {
  for (const [k, d] of savedDescriptors) {
    if (d) Object.defineProperty(target, k, d);
    else delete target[k];
  }
  savedDescriptors.clear();
}
const liveSeeded = () =>
  setLive({ enabled: true, lensAgg: () => ({ counts: [...AGG_COUNTS], noCountsYet: false }) });
const liveUnseeded = () => setLive({ enabled: true, lensAgg: () => null });

const byId = (l: LensDef) => l.id;
// The demo pool's exclusion rule, re-derived: Math.round(seed × questions)
// items are pre-answered in demo mode and never enter the feed.
const demoSeedCount = (l: LensDef) => Math.round((l.seed || 0) * l.questions.length);
const idsFrom = (from: (l: LensDef) => number) =>
  W.IS_LENSES.flatMap((l) =>
    l.questions.slice(from(l)).map((_, i) => `lq-${l.id}-${from(l) + i}`),
  ).sort();

afterEach(() => {
  restoreLive();
  W.LENSES.reset();
  localStorage.clear();
});

describe("LENS_FEED_QS follows liveness", () => {
  it("demo pool excludes exactly the seeded prefix", () => {
    expect(W.LENSES.liveOn()).toBe(false);
    const ids = LENS_FEED_QS().map((c) => c.id).sort();
    expect(ids).toEqual(idsFrom(demoSeedCount));
    // …and the exclusion is real: at least one lens seeds a nonzero prefix,
    // or this case would pass with the seed arithmetic deleted.
    expect(W.IS_LENSES.some((l) => demoSeedCount(l) > 0)).toBe(true);
  });

  it("live pool carries every question — the seeded prefix included", () => {
    liveSeeded();
    expect(W.LENSES.liveOn()).toBe(true);
    const ids = LENS_FEED_QS().map((c) => c.id).sort();
    expect(ids).toEqual(idsFrom(() => 0));
    // The specific card the frozen snapshot could never serve: moral's
    // first question, inside the demo seed prefix.
    expect(ids).toContain("lq-moral-0");
    expect(idsFrom(demoSeedCount)).not.toContain("lq-moral-0");
  });

  it("every card's qi round-trips to the question its prompt shows", () => {
    liveSeeded();
    const defs = new Map(W.IS_LENSES.map((l) => [byId(l), l]));
    for (const card of LENS_FEED_QS()) {
      const def = defs.get(card.lens);
      expect(def, card.id).toBeTruthy();
      expect(card.prompt, card.id).toBe(def!.questions[card.qi].q);
      expect(card.tier, card.id).toBe(def!.tier);
    }
  });

  it("against a seeded bank, live cards are ordinary live cards (D91)", () => {
    liveSeeded();
    for (const card of LENS_FEED_QS()) {
      // The live flag is what routes world-feed's setVote through
      // LIVE.vote and renderEngage into takes + who-voted; selfOnly would
      // suppress all of it.
      expect(card.live, card.id).toBe(true);
      expect(card.selfOnly, card.id).toBeUndefined();
      expect(card.noCountsYet, card.id).toBe(false);
      // Measured counts by index, under the agree-first labels — not the
      // authored demo numbers (~180..2080 per option), and not re-sorted.
      expect(card.options.map((o) => o.label), card.id).toEqual(SCALE);
      expect(card.options.map((o) => o.count), card.id).toEqual(AGG_COUNTS);
    }
  });

  it("against a bank with no lens rows, D50's selfOnly stays", () => {
    // The pre-D91 backend: rules would refuse the answer write (no
    // question doc) and no aggregate exists, so the card must acknowledge
    // the local record rather than render its authored counts as a crowd.
    liveUnseeded();
    for (const card of LENS_FEED_QS()) {
      expect(card.selfOnly, card.id).toBe(true);
      expect(card.live, card.id).toBeUndefined();
    }
  });

  it("demo pool is memoised; a live pool is rebuilt per call", () => {
    const demoA = LENS_FEED_QS();
    expect(LENS_FEED_QS()).toBe(demoA); // static content → cached array
    let count = 0;
    setLive({ enabled: true, lensAgg: () => ({ counts: [count++, 0, 0, 0, 0], noCountsYet: false }) });
    const liveA = LENS_FEED_QS();
    expect(liveA).not.toBe(demoA);
    expect(liveA.length).toBeGreaterThan(demoA.length);
    // Live counts move with every vote and agg refresh, so the pool must
    // not be a snapshot: two calls see two different measurements.
    const first = liveA[0].options[0].count;
    expect(LENS_FEED_QS()[0].options[0].count).toBeGreaterThan(first);
    restoreLive();
    // flipping back rebuilds the demo pool — contents, not identity, are
    // the contract
    expect(LENS_FEED_QS().map((c) => c.id).sort()).toEqual(
      demoA.map((c) => c.id).sort(),
    );
  });
});

describe("the local purge drops the in-memory store (D50)", () => {
  // live.ts's purgeLocalTrace() removes every insight.* key on account
  // deletion and uid change, then dispatches insight:local-purge — the
  // uid-change path has no reload behind it, so the store must drop its
  // in-memory copy too. Before the listener existed, the copy survived
  // and the NEXT answer()'s save() wrote the previous account's lens
  // answers straight back under the new uid. vote.test.ts pins that the
  // announcement fires; these pin what the store does with it.
  const announcePurge = () => {
    localStorage.removeItem(LS_KEY); // what purgeLocalTrace just did…
    window.dispatchEvent(new Event("insight:local-purge")); // …and then says
  };

  it("empties the store without re-creating the purged key", () => {
    liveSeeded();
    W.LENSES.answer("moral", 0, 4);
    expect(W.LENSES.done("moral")).toBe(1);
    expect(JSON.parse(localStorage.getItem(LS_KEY)!).ans.moral).toBeTruthy();
    announcePurge();
    expect(W.LENSES.done("moral")).toBe(0);
    // no save() in the listener: writing the key back, even empty, works
    // against "remove every local trace"
    expect(localStorage.getItem(LS_KEY)).toBeNull();
  });

  it("the next answer starts a fresh record — the resurrection bug", () => {
    liveSeeded();
    W.LENSES.answer("moral", 0, 4);
    announcePurge();
    // the new account answers ONE risk question; before the listener, this
    // save() brought the old account's moral answers back beside it
    W.LENSES.answer("risk", 0, 2);
    expect(JSON.parse(localStorage.getItem(LS_KEY)!).ans).toEqual({ risk: { 0: 2 } });
    expect(W.LENSES.done("moral")).toBe(0);
  });

  it("notifies subscribers, so mounted lens UI re-renders empty", () => {
    let calls = 0;
    const unsub = W.LENSES.subscribe(() => { calls += 1; });
    try {
      announcePurge();
      expect(calls).toBe(1);
    } finally {
      unsub();
    }
  });
});

// The feed interleaves three streams: the world questions, the core tests'
// questions, and the minor lenses' questions. The cadences are arithmetic,
// and the arithmetic went wrong in a way nothing else could catch.
//
// It shipped as:
//
//   if ((i + 1) % 4 === 0 && ti < tqs.length) push(tqs[ti++]);
//   else if ((i + 1) % 8 === 0 && li < lqs.length) push(lqs[li++]);
//
// Every multiple of 8 is a multiple of 4, so the `else` could never be
// reached — not one lens question entered the feed, ever. Nothing failed:
// tsc was happy, eslint was happy, check:globals was happy, the feed
// rendered a perfectly good list of cards. The only symptom was five
// missing cards out of sixty-three, which is what a human is worst at
// spotting and a test is best at.
//
// So this pins the property rather than the constants: BOTH streams must
// drain, and the lens cadence must not be a multiple of the test cadence.
import { describe, expect, it } from "vitest";
import { interleaveFeed, partitionAnswered, roundRobinBy, TEST_EVERY, LENS_EVERY } from "./feed-interleave";

// THE SHIPPED FUNCTION, imported. This file used to redeclare the cadences
// and the loop, so every assertion below exercised the test file itself —
// D11 claimed "the regression cannot come back quietly" and D42 cited an
// extraction that had never happened, while the real loop grew a third
// stream this copy did not model.
function interleave(
  world: string[],
  tests: string[],
  lenses: string[],
  testEvery = TEST_EVERY,
  lensEvery = LENS_EVERY,
): string[] {
  return interleaveFeed(world, { tests, lenses, testEvery, lensEvery });
}

const world = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`);
const tests = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);
const lenses = (n: number) => Array.from({ length: n }, (_, i) => `l${i}`);

describe("feed interleave", () => {
  it("emits lens questions at all — the bug that shipped", () => {
    const out = interleave(world(73), tests(19), lenses(28));
    expect(out.filter((x) => x.startsWith("l")).length).toBeGreaterThan(0);
  });

  it("would have caught the shipped bug: an else-if at cadence 8 starves lenses", () => {
    // the old shape, reproduced — `else if` with a cadence that is a
    // multiple of the test cadence
    const out: string[] = [];
    let ti = 0;
    let li = 0;
    const t = tests(19);
    const l = lenses(28);
    world(73).forEach((q, i) => {
      out.push(q);
      if ((i + 1) % 4 === 0 && ti < t.length) out.push(t[ti++]);
      else if ((i + 1) % 8 === 0 && li < l.length) out.push(l[li++]);
    });
    expect(out.filter((x) => x.startsWith("l"))).toHaveLength(0);
  });

  it("keeps the lens cadence coprime with the test cadence", () => {
    // If someone "tidies" 9 back to 8 (or 12, or 16), the two cadences
    // collide on every lens slot and the drift that separates them is gone.
    expect(LENS_EVERY % TEST_EVERY).not.toBe(0);
  });

  it("drains both streams over a long enough feed", () => {
    const out = interleave(world(400), tests(19), lenses(28));
    expect(out.filter((x) => x.startsWith("t"))).toHaveLength(19);
    expect(out.filter((x) => x.startsWith("l"))).toHaveLength(28);
  });

  it("never drops or duplicates a world question", () => {
    const w = world(73);
    const out = interleave(w, tests(19), lenses(28));
    expect(out.filter((x) => x.startsWith("w"))).toEqual(w);
  });

  it("keeps each inserted stream in its own order", () => {
    // 400 world questions, not 200: at one lens every 9 a 200-card feed only
    // reaches 22 of the 28 lenses, so the shorter run compares a full list
    // against a truncated one and fails for the wrong reason.
    const out = interleave(world(400), tests(19), lenses(28));
    expect(out.filter((x) => x.startsWith("t"))).toEqual(tests(19));
    expect(out.filter((x) => x.startsWith("l"))).toEqual(lenses(28));
  });

  it("inserts a lens only where the cadence says, and only once each", () => {
    const out = interleave(world(73), tests(19), lenses(28));
    const got = out.filter((x) => x.startsWith("l"));
    expect(got).toEqual(new Array(Math.floor(73 / LENS_EVERY)).fill(0).map((_, i) => `l${i}`));
  });

  it("tolerates empty insert streams", () => {
    const w = world(20);
    expect(interleave(w, [], [])).toEqual(w);
  });

  it("lens cards stay rare — tests own the feed, lenses trickle", () => {
    const out = interleave(world(73), tests(19), lenses(28));
    const nTests = out.filter((x) => x.startsWith("t")).length;
    const nLenses = out.filter((x) => x.startsWith("l")).length;
    expect(nLenses).toBeLessThan(nTests);
  });
});

describe("the knowledge stream the copy never modelled (D32)", () => {
  // The third stream. It exists in the shipped loop and did not exist in
  // this file's private copy — which is the concrete cost of testing a copy.
  it("keeps its own cadence alongside the other two", () => {
    const out = interleaveFeed(world(12), {
      tests: tests(9), lenses: lenses(9), know: ["k0", "k1", "k2"], knowEvery: 5,
    });
    expect(out.filter((x) => x.startsWith("k"))).toEqual(["k0", "k1"]);
    // w0 w1 w2 w3 t0 w4 k0 — the test slot at i=3 lands before the
    // knowledge slot at i=4, which is the push order the feed has always
    // used and what a returning user's eye is calibrated to.
    expect(out.slice(0, 7)).toEqual(["w0", "w1", "w2", "w3", "t0", "w4", "k0"]);
  });

  it("drains even when there are fewer world questions than its cadence", () => {
    // Mute every opinion topic and the knowledge stream must still be there:
    // it is a subscription of its own, not a garnish on the others.
    const out = interleaveFeed([], {
      tests: [], lenses: [], know: ["k0", "k1"], knowEvery: 6,
    });
    expect(out).toEqual(["k0", "k1"]);
  });

  it("is off entirely when its cadence is 0", () => {
    const out = interleaveFeed(world(10), {
      tests: [], lenses: [], know: ["k0"], knowEvery: 0,
    });
    expect(out).toEqual(world(10));
  });
});

describe("the pulse roster's turn (v28 §3, D166 §3)", () => {
  it("takes its turn one card in four, ahead of the slot's other streams", () => {
    const out = interleaveFeed(world(8), {
      tests: tests(2), lenses: [], pulses: ["p0", "p1"],
    });
    // slot after w3: pulse then test; same again after w7 — a clump, not
    // a starvation (independent ifs, own counters)
    expect(out).toEqual(["w0", "w1", "w2", "w3", "p0", "t0", "w4", "w5", "w6", "w7", "p1", "t1"]);
  });

  it("places every due pulse even when the feed is too short to host its turn", () => {
    // A due pulse silently dropped is a miss the user cannot see — the
    // schedule owes today's questions whatever the feed's length.
    const out = interleaveFeed(world(2), { tests: [], lenses: [], pulses: ["p0", "p1"] });
    expect(out).toEqual(["w0", "w1", "p0", "p1"]);
  });

  it("does not disturb the other streams' positions", () => {
    const without = interleaveFeed(world(20), { tests: tests(3), lenses: lenses(2) });
    const withPulses = interleaveFeed(world(20), { tests: tests(3), lenses: lenses(2), pulses: ["p0"] });
    expect(withPulses.filter((c) => c !== "p0")).toEqual(without);
  });

  it("asks nothing when nothing is due", () => {
    const out = interleaveFeed(world(8), { tests: [], lenses: [], pulses: [] });
    expect(out).toEqual(world(8));
  });
});

describe("partitionAnswered — the finite bank stops serving your own past", () => {
  // The release feedback came twice: "I keep seeing things I have
  // answered", then "answered questions shouldn't appear in the feed at
  // all". The bank is served in a stable order, so the head of every
  // session's feed was exactly the head of the last one — answered, as a
  // wall of results. The feed renders `fresh` alone and parks `done`
  // behind the answered expander; the partition must be STABLE (within
  // each half, the incoming order — the sort lens the user picked —
  // survives untouched) and LOSSLESS (every card lands in exactly one
  // half; the done cards are the record, not discards).

  const answered = new Set(["a", "c"]);
  const isDone = (q: string) => answered.has(q);

  it("splits answered cards out of the fresh list", () => {
    expect(partitionAnswered(["a", "b", "c", "d"], isDone))
      .toEqual({ fresh: ["b", "d"], done: ["a", "c"] });
  });

  it("keeps each half's incoming order — a partition, not a sort", () => {
    // The incoming order encodes the topic round-robin / the chosen sort
    // lens; reordering within a half would quietly replace that with
    // insertion noise.
    expect(partitionAnswered(["d", "c", "b", "a"], isDone))
      .toEqual({ fresh: ["d", "b"], done: ["c", "a"] });
  });

  it("loses nothing at either extreme", () => {
    expect(partitionAnswered(["x", "y"], () => false))
      .toEqual({ fresh: ["x", "y"], done: [] });
    // Fully answered: everything is still HELD, behind the expander —
    // the caught-up state has an empty fresh list, never missing cards.
    expect(partitionAnswered(["a", "c"], isDone))
      .toEqual({ fresh: [], done: ["a", "c"] });
    expect(partitionAnswered([], isDone)).toEqual({ fresh: [], done: [] });
  });
});

// ── the passive tests' round-robin (D155) ────────────────────────────
//
// The reported symptom was one filled bar and three empty ones on the
// profile sheet, after answering steadily for days. Not a rendering bug:
// `content/tests.json` is keyed BY instrument, so the generated bank runs
// 25 Big Five, then 30 Politics, then 30 Values, then 25 Social — and the
// live pool was served in exactly that order. Twenty-five marked cards in,
// three of the four instruments had never been offered a single question.
describe("roundRobinBy", () => {
  const item = (test: string, n: number) => ({ id: `${test}-${n}`, test });
  // The shape the generator actually emits: grouped, not interleaved.
  const banked = [
    ...Array.from({ length: 3 }, (_, i) => item("big5", i)),
    ...Array.from({ length: 3 }, (_, i) => item("political", i)),
    ...Array.from({ length: 2 }, (_, i) => item("values", i)),
  ];

  it("offers every instrument before offering any one of them twice", () => {
    // The whole point. Before this, the first three cards were three Big
    // Five questions and Politics was 25 cards away.
    const out = roundRobinBy(banked, (q) => q.test);
    expect(out.slice(0, 3).map((q) => q.test)).toEqual(["big5", "political", "values"]);
    expect(out.map((q) => q.id)).toEqual([
      "big5-0", "political-0", "values-0",
      "big5-1", "political-1", "values-1",
      "big5-2", "political-2",
    ]);
  });

  it("keeps every item, and keeps each instrument's own order", () => {
    // A round-robin that reordered within an instrument would shuffle the
    // bank's own sequencing for no reason; one that dropped an item would
    // silently shorten a test.
    const out = roundRobinBy(banked, (q) => q.test);
    expect(out).toHaveLength(banked.length);
    for (const t of ["big5", "political", "values"]) {
      expect(out.filter((q) => q.test === t).map((q) => q.id))
        .toEqual(banked.filter((q) => q.test === t).map((q) => q.id));
    }
  });

  it("drains the long lists after the short ones run out", () => {
    // Uneven pools are the real case — 25/30/30/25 — and the tail must not
    // stall when the shortest list is spent.
    const out = roundRobinBy(
      [...Array.from({ length: 4 }, (_, i) => item("a", i)), item("b", 0)],
      (q) => q.test,
    );
    expect(out.map((q) => q.id)).toEqual(["a-0", "b-0", "a-1", "a-2", "a-3"]);
  });

  it("leads with the bank's own first card", () => {
    // Insertion order, so a fresh account still opens on the question the
    // bank puts first — only what follows it changes.
    expect(roundRobinBy(banked, (q) => q.test)[0].id).toBe(banked[0].id);
  });

  it("carries unclassified items rather than dropping them", () => {
    // The pool is content, and content nobody classified is still content.
    const out = roundRobinBy([item("big5", 0), { id: "loose", test: "" }], (q) => q.test);
    expect(out.map((q) => q.id).sort()).toEqual(["big5-0", "loose"]);
  });
});

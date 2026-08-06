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
import { interleaveFeed, TEST_EVERY, LENS_EVERY } from "./feed-interleave";

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

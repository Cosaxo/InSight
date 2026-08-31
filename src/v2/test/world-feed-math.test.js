// The World feed's arithmetic, which had no test at all while it was buried
// in a 2,500-line component.
//
// WHAT EARNS A TEST HERE. Not the gradient helpers' exact CSS — that is
// presentation, and pinning the string would just make a restyle fail a
// suite. What is pinned is the two properties those helpers are relied on
// FOR (a valid background-image layer, and determinism per seed), plus every
// function that produces a number a user reads as fact.
//
// `wfPcts` is the reason this file exists. It is the split on every feed
// card and it does two non-obvious things:
//
//   1. It ADDS the viewer's own vote. data/live.ts deliberately excludes it
//      from the stored counts ("the UI adds its own +1 for you, so including
//      it here would double-count"), so the +1 here is the other half of
//      that contract. Breaking either half silently shifts every percentage.
//   2. It forces the rounded parts to sum to exactly 100 — because three-way
//      splits round to 99 or 101 more often than not, and a split that does
//      not sum to 100 reads as a bug in the product's central claim. The
//      rounding itself is data/pct.ts now, shared with the Mirror's pctFor;
//      it used to push the whole residue onto the largest bucket, and this
//      file's own "maximal bucket stays maximal" case asserted a property
//      that rule did not have.

import { describe, expect, it } from "vitest";

import {
  wfCatArt, wfFmt, wfHash, wfKnowBias, wfKnowRate, wfPcts, wfPickGroup,
  wfRateAvg, wfRateBg, wfTileArt, wfTint,
  wfVotesOf,
  wfAnsweredOf,
} from "../spec/world-feed-math.js";
import { pctFor } from "../data/cohort";

// WHOSE SIDE WON is a question about counts, and it was answered off the
// drawn percentages.
//
// `sharePcts` guarantees no INVERSION — a smaller count never draws
// larger — and that is the property the rest of the app leans on. It does
// NOT guarantee distinctness: two different counts can print the same
// integer. So `p[mine] === Math.max(...p)` said "with the majority" to a
// voter whose option had strictly fewer votes.
//
// Measured with the shipped rule over 400,000 random 2-5 option vectors
// with counts 0-299: 3.07% of cards carried at least one wrong reading,
// and 0.91% of individual readings claimed a majority that was not one.
// The reverse ("you picked the underdog" on a genuine top count) is
// almost absent — 3 in 1.38 million — because sharePcts breaks ties
// toward the lower index, so the true leader usually keeps the drawn one.
// That asymmetry is why this reads as flattery rather than as a bug.
//
// It was also written into the permanent per-device read log, which feeds
// the Mirror's with-the-crowd rate — recorded, not just drawn.
describe("wfPcts returns the counts, because the majority is a count question", () => {
  it("hands back the count vector it actually used, viewer's +1 included", () => {
    const { c } = wfPcts([3, 4], 0);
    expect(c).toEqual([4, 4]);
    expect(wfPcts([3, 4], -1).c).toEqual([3, 4]);
  });

  it("the counts disagree with the percentages exactly where the claim was wrong", () => {
    // 449 vs 451 both draw 45%. Reading the winner off `p` tells the
    // voter on 449 they are with the majority; reading it off `c` does
    // not. (mineIdx -1 so the +1 does not move either side.)
    const { p, c } = wfPcts([449, 451, 100], -1);
    expect(p).toEqual([45, 45, 10]);
    expect(p[0] === Math.max(...p)).toBe(true);   // what it used to ask
    expect(c[0] === Math.max(...c)).toBe(false);  // what it asks now
  });

  it("a genuine tie in COUNTS is still with the majority, on both sides", () => {
    // The fix must not swing the other way: equal counts are equal, and
    // neither voter picked an underdog.
    const { c } = wfPcts([5, 5], -1);
    expect(c[0] === Math.max(...c)).toBe(true);
    expect(c[1] === Math.max(...c)).toBe(true);
  });

  it("your own vote can make you the majority, and that is not a rounding artefact", () => {
    // [5, 5, 3] draws [39, 38, 23] — the percentages already disagree with
    // each other on a genuine tie. With your vote on the second option the
    // counts become [5, 6, 3] and you are the majority in fact.
    expect(wfPcts([5, 5, 3], -1).p).toEqual([39, 38, 23]);
    const { c } = wfPcts([5, 5, 3], 1);
    expect(c).toEqual([5, 6, 3]);
    expect(c[1] === Math.max(...c)).toBe(true);
  });
});

describe("wfPcts — the split a user reads", () => {
  it("counts the viewer's own vote, which the store leaves out", () => {
    // live.ts hands over counts EXCLUDING you; mineIdx is where you go.
    expect(wfPcts([3, 3], 0).total).toBe(7);
    expect(wfPcts([3, 3], -1).total).toBe(6); // no vote yet — nothing added
    // and it lands in the right bucket
    expect(wfPcts([0, 0], 0).p).toEqual([100, 0]);
    expect(wfPcts([0, 0], 1).p).toEqual([0, 100]);
  });

  it("always sums to exactly 100, including the thirds that do not divide", () => {
    const cases = [
      [[1, 1, 1], -1],   // 33.3 each → 99 before correction
      [[1, 1, 1], 0],
      [[2, 1], -1],      // 66.67 / 33.33
      [[1, 1, 1, 1, 1, 1], -1],
      [[7, 11, 13, 17], 2],
      [[999, 1], 1],
      [[1], 0],
    ];
    for (const [counts, mine] of cases) {
      const { p } = wfPcts(counts, mine);
      expect(p.reduce((a, b) => a + b, 0), `${JSON.stringify(counts)} @${mine}`).toBe(100);
    }
  });

  it("hands the residue to the largest remainders, and never past the winner", () => {
    // This case USED TO READ "puts the rounding residue on the LARGEST
    // bucket", and pinned [1,1,1,3] as [17,17,17,49]. That rule is retired:
    // it pushed the WHOLE residue onto one bucket, and with enough options
    // the residue is several points, so it could push that bucket below one
    // with fewer votes. data/pct.ts has the measurement and the reasoning;
    // the sweep in data/pct.test.ts is the exhaustive half. Here: the cases
    // that distinguish the two rules at this surface.
    expect(wfPcts([1, 1, 4], -1).p).toEqual([17, 17, 66]);
    expect(wfPcts([1, 4, 4], -1).p).toEqual([11, 45, 44]);
    // The one the old rule answered differently — [17,17,17,49] then. Both
    // distort somebody: the old one shaved a full point off the winner to
    // keep the three ones equal, this one leaves the winner exact and puts
    // the three ones a point apart. Pinned so a revert is visible.
    expect(wfPcts([1, 1, 1, 3], -1).p).toEqual([17, 17, 16, 50]);

    // …and the general property, which the previous draft ASSERTED and did
    // not hold: a maximal bucket stays maximal, so rounding never hands the
    // card's headline to a side that did not win. It checked four
    // hand-picked vectors, all of which passed under the broken rule.
    // [5,7,1,9,1,7,10] did not: it printed the 10-vote winner at 22% and a
    // 9-vote option at 23%.
    for (const counts of [
      [1, 1, 4], [1, 4, 4], [10, 3, 3], [7, 11, 13, 17],
      [5, 7, 1, 9, 1, 7, 10],
    ]) {
      const { p } = wfPcts(counts, -1);
      const winner = counts.indexOf(Math.max(...counts));
      expect(p[winner], JSON.stringify(counts)).toBe(Math.max(...p));
    }
  });

  it("never draws a smaller count wider than a bigger one", () => {
    // The feed's live shapes are what make this reachable: a dial is 12
    // buckets and a field is 4x3, so a card's split routinely has ten or
    // more parts and the residue grows with them. A vote count is the one
    // thing a bar is claiming to represent, and drawing 3 votes above 4 is
    // the split contradicting itself on screen.
    const cases = [
      [3, 3, 4, 4, 4, 4, 4, 4, 4, 4],       // the k=10 case, [8,8,7,11,…] before
      [5, 7, 1, 9, 1, 7, 10],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
    ];
    for (const counts of cases) {
      for (const mine of [-1, 0, 3]) {
        const { p } = wfPcts(counts, mine);
        const c = counts.map((n, i) => n + (mine === i ? 1 : 0));
        for (let i = 0; i < c.length; i++) {
          for (let j = 0; j < c.length; j++) {
            if (c[i] > c[j]) {
              expect(p[i], `${JSON.stringify(counts)}@${mine}: ${c[i]} votes drew ${p[i]}%, ${c[j]} drew ${p[j]}%`)
                .toBeGreaterThanOrEqual(p[j]);
            }
          }
        }
      }
    }
  });

  it("rounds identically to the Mirror's pctFor, because it is the same rule", () => {
    // The cross-surface half, and the reason data/pct.ts exists at all.
    // pctFor's own comment has always said that two surfaces rounding
    // differently on the same numbers is how a 51/49 becomes a 51/48 one
    // screen over — and until that module the two agreed only by carrying
    // the same four lines each. Now there is one implementation and this
    // says so out loud.
    //
    // Asserted from THIS side rather than from cohort.test.ts: `data/` is
    // typed and world-feed-math.js is not, so importing it there costs a
    // @ts-expect-error and crosses the boundary DECISIONS.md:3337 rests the
    // no-allowJs argument on. This file is plain JS and is the feed's own.
    //
    // mineIdx -1 is the comparable call: adding the viewer's vote is this
    // surface's convention, not the rounding's.
    for (const counts of [[1, 1, 1], [1, 5, 2], [1, 1, 1, 3], [3, 3, 4, 4, 4, 4, 4, 4, 4, 4]]) {
      expect(wfPcts(counts, -1).p, JSON.stringify(counts)).toEqual(pctFor(counts));
    }
  });

  it("returns the raw total alongside, since cards print it", () => {
    expect(wfPcts([4, 5, 6], -1).total).toBe(15);
  });
});

describe("wfHash — the determinism everything else leans on", () => {
  it("is stable for a given string and lands in [0,1)", () => {
    for (const s of ["", "q-1", "q-1|age|x", "é中", "a".repeat(300)]) {
      const v = wfHash(s);
      expect(v, s).toBeGreaterThanOrEqual(0);
      expect(v, s).toBeLessThan(1);
      expect(wfHash(s), s).toBe(v); // same input, same answer, always
    }
  });

  it("separates neighbouring seeds", () => {
    // Not a distribution claim — just that one-character differences do not
    // collide, which is what the per-card texture and per-group drift need.
    const seen = new Set(Array.from({ length: 200 }, (_, i) => wfHash(`q-${i}`)));
    expect(seen.size).toBe(200);
  });
});

describe("wfFmt — vote counts", () => {
  it("abbreviates at a thousand and not before", () => {
    expect(wfFmt(0)).toBe("0");
    expect(wfFmt(999)).toBe("999");
    expect(wfFmt(1000)).toBe("1K");
    expect(wfFmt(1100)).toBe("1.1K");
    expect(wfFmt(12345)).toBe("12.3K");
    expect(wfFmt(2000)).toBe("2K"); // the .0 is trimmed, not printed
  });
});

describe("the deterministic drifts stay inside their stated bounds", () => {
  it("wfKnowRate clamps to 4..97 whatever the input", () => {
    for (const p of [-50, 0, 1, 50, 99, 150]) {
      for (const key of ["a", "b", "c", "d", "e"]) {
        const v = wfKnowRate("q", key, p, 0);
        expect(v).toBeGreaterThanOrEqual(4);
        expect(v).toBeLessThanOrEqual(97);
        expect(Number.isInteger(v)).toBe(true);
      }
    }
  });

  it("wfRateAvg clamps to 1.2..9.9, the 1-10 scale's usable range", () => {
    for (const avg of [-5, 0, 1, 5.5, 10, 99]) {
      for (const key of ["a", "b", "c"]) {
        const v = wfRateAvg("q", key, avg);
        expect(v).toBeGreaterThanOrEqual(1.2);
        expect(v).toBeLessThanOrEqual(9.9);
      }
    }
  });

  it("wfKnowBias applies a direction to education only, and centres on zero", () => {
    // The whole point of the exception: pure noise produced headlines like
    // "Trade school beats Doctorate", so edu gets a monotonic ramp.
    const ramp = [0, 1, 2, 3, 4].map((i) => wfKnowBias("edu", null, 5, i));
    expect(ramp).toEqual([...ramp].sort((a, b) => a - b));
    expect(ramp[0]).toBeLessThan(0);
    expect(ramp[4]).toBeGreaterThan(0);
    expect(ramp.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 10);

    // every other dimension, and edu-with-an-axis, stay unbiased
    expect(wfKnowBias("age", null, 5, 0)).toBe(0);
    expect(wfKnowBias("edu", "some-axis", 5, 0)).toBe(0);
    expect(wfKnowBias("edu", null, 1, 0)).toBe(0); // n === 1 would divide by zero
  });
});

describe("wfPickGroup — a group's ranking of the same counts", () => {
  const ranked = [
    { id: "a", count: 100 }, { id: "b", count: 40 },
    { id: "c", count: 38 }, { id: "d", count: 5 },
  ];

  it("returns shares in descending order that never exceed the head share", () => {
    const out = wfPickGroup("q1", "age:25-34", ranked, 0.62);
    expect(out.map((r) => r.share)).toEqual([...out.map((r) => r.share)].sort((a, b) => b - a));
    expect(out.reduce((a, r) => a + r.share, 0)).toBeCloseTo(0.62, 10);
    expect(out).toHaveLength(ranked.length);
  });

  it("is deterministic per (question, group) and differs between groups", () => {
    const a1 = wfPickGroup("q1", "g1", ranked, 0.6).map((r) => r.it.id);
    const a2 = wfPickGroup("q1", "g1", ranked, 0.6).map((r) => r.it.id);
    expect(a2).toEqual(a1);
    // Different groups reweight differently — that difference IS the feature.
    const groups = ["g1", "g2", "g3", "g4", "g5", "g6"].map(
      (g) => wfPickGroup("q1", g, ranked, 0.6).map((r) => r.it.id).join(","),
    );
    expect(new Set(groups).size).toBeGreaterThan(1);
  });

  it("survives an empty ranking rather than dividing by zero", () => {
    expect(wfPickGroup("q1", "g1", [], 0.6)).toEqual([]);
  });
});

describe("the texture helpers", () => {
  // Deliberately NOT pinning the exact gradient strings — that is styling.
  // Pinned instead: they are valid background-image layers (a bare colour
  // computes to `none`, which the comment in wfTileArt records as a real
  // bug once), and they are stable per seed.
  it("always produce a gradient layer, never a bare colour", () => {
    for (let i = 0; i < 40; i++) {
      for (const fn of [wfTileArt, wfCatArt]) {
        const css = fn("oklch(0.52 0.14 40)", `seed-${i}`);
        expect(css, `${fn.name}(seed-${i})`).toMatch(/gradient\(/);
      }
    }
  });

  it("are stable for a seed", () => {
    expect(wfTileArt("red", "s")).toBe(wfTileArt("red", "s"));
    expect(wfCatArt("red", "s")).toBe(wfCatArt("red", "s"));
  });

  it("wfTint weakens monotonically with rank and never inverts", () => {
    const pct = (css) => Number(/\s([\d.]+)%/.exec(css)[1]);
    const strengths = [0, 1, 2, 3].map((r) => pct(wfTint("red", r, 4)));
    expect(strengths).toEqual([...strengths].sort((a, b) => b - a));
    expect(strengths[0]).toBeGreaterThan(strengths[3]);
    // a rank past the end clamps rather than going negative
    expect(pct(wfTint("red", 99, 4))).toBe(strengths[3]);
  });

  it("wfRateBg strengthens with the score", () => {
    const pct = (css) => Number(/\s([\d.]+)%/.exec(css)[1]);
    expect(pct(wfRateBg("red", 1))).toBeLessThan(pct(wfRateBg("red", 9)));
  });
});

describe("wfVotesOf — one counter for every question shape", () => {
  // The search overlay carried a FORK of this that knew `rank` and `rate`
  // and then fell through to summing `q.options`. Continuum and catalogue
  // questions carry no options, so dial, field and pick all scored 0 — in
  // both of the overlay's orderings. These are the three that were zero.
  it("counts the continuum and catalogue types off `n`", () => {
    expect(wfVotesOf({ type: "dial", n: 5200 })).toBe(5200);
    expect(wfVotesOf({ type: "field", n: 6800 })).toBe(6800);
    expect(wfVotesOf({ type: "pick", n: 91 })).toBe(91);
  });

  it("falls back to the catalogue's own tally for a pick with no `n`", () => {
    expect(wfVotesOf({ type: "pick" }, 44)).toBe(44);
    // …and to zero where the caller has no table to consult, rather than
    // to NaN or undefined.
    expect(wfVotesOf({ type: "pick" })).toBe(0);
  });

  it("keeps the shapes that already worked", () => {
    expect(wfVotesOf({ type: "rank", votes: 12 })).toBe(12);
    expect(wfVotesOf({ type: "rate", n: 7 })).toBe(7);
    expect(wfVotesOf({ type: "vote", options: [{ count: 10 }, { count: 20 }] })).toBe(30);
    expect(wfVotesOf({ type: "vote" })).toBe(0);
  });

  it("treats an option row with no count as zero, not as NaN", () => {
    // The fork omitted the `|| 0`, so one row missing `count` turned the
    // whole total into NaN — which sorts unpredictably rather than low.
    expect(wfVotesOf({ type: "vote", options: [{ count: 10 }, {}] })).toBe(10);
  });
});

describe("wfAnsweredOf — an answer that exists only on the server", () => {
  // The search overlay carried the feed's TAIL with the live branch cut
  // off, so a continuum or catalogue answer given on another device — or
  // on a page fetched after boot, which the local mirror never sees — read
  // as UNANSWERED. It then went into the "five open questions"
  // round-robin, sorted as unanswered in the result tiebreak, and its row
  // offered the question again instead of the share meter.
  const server = () => ({ d1: 2 });

  it("counts a continuum answer held only server-side", () => {
    for (const type of ["dial", "field", "pick", "rank"]) {
      expect(wfAnsweredOf({ id: "d1", type, live: true }, {}, server),
        `${type} answered only on the server read as unanswered`).toBe(true);
    }
  });

  it("does not consult the server for an ordinary vote question", () => {
    // The branch is deliberately narrow: a vote question's local value is
    // the whole truth, and asking the store for one would be a read the
    // feed never made.
    let asked = 0;
    const spy = () => { asked++; return { v1: 1 }; };
    expect(wfAnsweredOf({ id: "v1", type: "vote", live: true }, {}, spy)).toBe(false);
    expect(asked, "the server was consulted for a vote question").toBe(0);
  });

  it("prefers the local value when there is one", () => {
    let asked = 0;
    const spy = () => { asked++; return {}; };
    expect(wfAnsweredOf({ id: "d1", type: "dial", live: true }, { d1: 3 }, spy)).toBe(true);
    expect(asked, "the server was consulted over a local answer").toBe(0);
  });

  it("asks nobody on a demo card, or with no server read to make", () => {
    expect(wfAnsweredOf({ id: "d1", type: "dial" }, {}, server)).toBe(false);
    expect(wfAnsweredOf({ id: "d1", type: "dial", live: true }, {}, null)).toBe(false);
  });

  it("keeps rank's own shape: an order, not merely a value", () => {
    expect(wfAnsweredOf({ id: "r1", type: "rank" }, { r1: { order: [1, 0] } }, null)).toBe(true);
    expect(wfAnsweredOf({ id: "r1", type: "rank" }, { r1: {} }, null)).toBe(false);
    expect(wfAnsweredOf({ id: "q1", type: "vote" }, { q1: "0" }, null)).toBe(true);
  });
});

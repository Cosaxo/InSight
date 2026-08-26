// The arithmetic behind four Mirror surfaces (D99). All of it is a fold
// over `v2_question_aggs.by`, and all of it is silent when wrong — a
// divergence ranked by the wrong number still renders a plausible screen,
// which is why these cases assert the ORDERING and the edges rather than
// only the happy path.

import { describe, expect, it } from "vitest";
import {
  agreement, agreementOf, byOf, cellFor, divergence, divergenceFor, divisiveness, headlineFor,
  likenessRate, MAP_ANCHOR_DIM, meanScore, mixFor, pctFor, sliceSplit, standingIn, typicality,
  vocabMix,
} from "./cohort";

// Two age bands and two genders over a 2-option question. Overall 12/8.
const BY = {
  ageBand: {
    "25-34": { "0": 9, "1": 1 },   // strongly option 0
    "35-44": { "0": 3, "1": 7 },   // leans option 1
  },
  gender: {
    Woman: { "0": 6, "1": 4 },
    Man: { "0": 6, "1": 4 },       // identical to Woman — zero divergence
  },
};
const OVERALL = [12, 8];

describe("pctFor", () => {
  it("sums to exactly 100, sharing the drift by largest remainder", () => {
    // Three thirds round to 33/33/33 and lose a point. A split that does
    // not sum to 100 is visible on a stacked bar as a gap.
    expect(pctFor([1, 1, 1])).toEqual([34, 33, 33]);
    expect(pctFor([12, 8]).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("is all zeroes for an empty cell rather than NaN", () => {
    expect(pctFor([0, 0])).toEqual([0, 0]);
    expect(pctFor([])).toEqual([]);
  });
});

describe("cellFor", () => {
  it("is dense to the option count, filling absent options with zero", () => {
    // An option nobody picked has no key in the map. Sparse output would
    // render as a missing column rather than an empty one.
    expect(cellFor(BY, "ageBand", "25-34", 3)).toEqual([9, 1, 0]);
  });

  it("is null for a cell that is not there at all", () => {
    // Null, not [] — since D98 an absent cell means nobody, and the
    // caller must be able to say "nobody" rather than draw a flat bar.
    expect(cellFor(BY, "ageBand", "45-54", 2)).toBeNull();
    expect(cellFor(BY, "profession", "Carpenter", 2)).toBeNull();
    expect(cellFor(undefined, "ageBand", "25-34", 2)).toBeNull();
  });
});

describe("mixFor", () => {
  it("orders buckets biggest first and drops empty ones", () => {
    const mix = mixFor({ ageBand: { a: { "0": 2 }, b: { "0": 9 }, c: {} } }, "ageBand", 2);
    expect(mix.map((m) => m.bucket)).toEqual(["b", "a"]);
    expect(mix[0].n).toBe(9);
  });

  it("is empty for a dimension nobody has filled in", () => {
    expect(mixFor(BY, "education", 2)).toEqual([]);
  });
});

describe("vocabMix (D300)", () => {
  const VOCAB = ["Under 18", "18-24", "25-34", "35-44", "Prefer not to say"];

  it("returns the whole vocabulary in its own order, zeros included", () => {
    const mix = vocabMix(BY, "ageBand", 2, VOCAB);
    // 25-34 outnumbers 35-44 and still sits where the scale puts it, and
    // the bands nobody answered from are drawn as dense zero cells rather
    // than dropped — a scale with silent gaps is not a scale.
    expect(mix.map((m) => m.bucket)).toEqual(["Under 18", "18-24", "25-34", "35-44"]);
    expect(mix[0]).toEqual({ bucket: "Under 18", n: 0, counts: [0, 0] });
    expect(mix[2].n).toBe(10);
  });

  it("includes an opt-out only once somebody has picked it", () => {
    // "Prefer not to say" at zero reads as an ask; with an answer behind
    // it, it is a cohort like any other.
    const by = { gender: { "Woman": { "0": 2 }, "Prefer not to say": { "0": 1 } } };
    const withIt = vocabMix(by, "gender", 1, ["Woman", "Man", "Prefer not to say"]);
    expect(withIt.map((m) => m.bucket)).toEqual(["Woman", "Man", "Prefer not to say"]);
    const without = vocabMix(BY, "gender", 2, ["Woman", "Man", "Prefer not to say"]);
    expect(without.map((m) => m.bucket)).toEqual(["Woman", "Man"]);
  });

  it("appends buckets the vocabulary does not know, biggest first", () => {
    // Answers folded under an old spelling are still answers; a
    // vocabulary edit must never hide them.
    const by = { gender: { "Woman": { "0": 1 }, "Femme": { "0": 2 }, "X": { "0": 5 } } };
    const mix = vocabMix(by, "gender", 1, ["Woman", "Man"]);
    expect(mix.map((m) => m.bucket)).toEqual(["Woman", "Man", "X", "Femme"]);
  });

  it("is the whole scale at zero for a dimension nobody has filled in", () => {
    const mix = vocabMix(BY, "education", 2, ["School", "Degree"]);
    expect(mix).toEqual([
      { bucket: "School", n: 0, counts: [0, 0] },
      { bucket: "Degree", n: 0, counts: [0, 0] },
    ]);
  });
});

describe("sliceSplit", () => {
  it("gives one slice's percentages", () => {
    expect(sliceSplit(BY, "ageBand", "25-34", 2)).toEqual([90, 10]);
  });

  it("is null for a slice with no answers, not a row of zeroes", () => {
    expect(sliceSplit(BY, "ageBand", "45-54", 2)).toBeNull();
  });
});

describe("divergence", () => {
  it("ranks slices by their single largest gap from everyone", () => {
    // Overall is 60/40. 25-34 sits at 90/10 (gap 30); 35-44 at 30/70
    // (gap 30) — a tie broken by size, both n=10, then by insertion.
    const d = divergence(BY, "ageBand", OVERALL, 2);
    expect(d[0].gap).toBe(30);
    expect(d.map((x) => x.bucket).sort()).toEqual(["25-34", "35-44"]);
  });

  it("scores a slice that matches everyone at zero", () => {
    const d = divergence(BY, "gender", OVERALL, 2);
    expect(d.every((x) => x.gap === 0)).toBe(true);
  });

  it("ranks by the LARGEST single gap, not the summed distance", () => {
    // The reason this matters: a slice that is +20 on one option is one
    // disagreement. Summing |diff| would score it 40 (it must come back
    // somewhere) and rank it above a slice that is +25 on one option —
    // exactly backwards for a lens whose job is "where do they differ".
    const by = {
      d: {
        wide: { "0": 25, "1": 75 },   // vs 50/50 → gap 25
        split: { "0": 30, "1": 70 },  // vs 50/50 → gap 20
      },
    };
    const d = divergence(by, "d", [50, 50], 2);
    expect(d.map((x) => x.bucket)).toEqual(["wide", "split"]);
  });

  it("honours minN, and defaults to keeping everything", () => {
    // The floor here is about LEGIBILITY, not disclosure: a one-answer
    // bucket is always 100/0 and would top every ranking forever.
    const by = { d: { tiny: { "0": 1 }, big: { "0": 6, "1": 4 } } };
    expect(divergence(by, "d", [7, 4], 2).length).toBe(2);
    expect(divergence(by, "d", [7, 4], 2, 5).map((x) => x.bucket)).toEqual(["big"]);
  });
});

describe("divergenceFor — one slice, without folding the rest", () => {
  // The helper exists to remove work, so what has to be pinned is that it
  // removed NOTHING ELSE. Every case below states the expectation as the
  // expression it replaced, evaluated live: if either implementation
  // drifts, these fail rather than the Mirror and the breakdown sheet
  // quietly disagreeing about which option a group is unusual on.
  const asFind = (
    by: Parameters<typeof divergence>[0], dim: string, bucket: string,
    overall: readonly number[], k: number, minN?: number,
  ) => divergence(by, dim, overall, k, minN).find((d) => d.bucket === bucket) ?? null;

  it("agrees with divergence().find() on every bucket of every dim", () => {
    for (const dim of ["ageBand", "gender"]) {
      for (const bucket of Object.keys(BY[dim as keyof typeof BY] || {})) {
        expect(divergenceFor(BY, dim, bucket, OVERALL, 2), `${dim}/${bucket}`)
          .toEqual(asFind(BY, dim, bucket, OVERALL, 2));
      }
    }
  });

  it("is null exactly where find() is undefined — unknown dim, unknown bucket, empty cell", () => {
    const by = { d: { real: { "0": 3, "1": 1 }, empty: { "0": 0, "1": 0 } } };
    expect(divergenceFor(by, "nope", "real", [4, 4], 2)).toBeNull();
    expect(divergenceFor(by, "d", "nope", [4, 4], 2)).toBeNull();
    expect(divergenceFor(by, "d", "empty", [4, 4], 2)).toBeNull();
    expect(asFind(by, "d", "empty", [4, 4], 2)).toBeNull();
  });

  it("goes null below minN, where find() also drops the bucket", () => {
    const by = { d: { tiny: { "0": 1 }, big: { "0": 6, "1": 4 } } };
    expect(divergenceFor(by, "d", "tiny", [7, 4], 2, 5)).toBeNull();
    expect(asFind(by, "d", "tiny", [7, 4], 2, 5)).toBeNull();
    expect(divergenceFor(by, "d", "big", [7, 4], 2, 5)).toEqual(asFind(by, "d", "big", [7, 4], 2, 5));
  });

  it("its pct IS sliceSplit — which is why Explore stopped calling both", () => {
    // The two used to run side by side on the same cell, one for the
    // split and one for the gap. They have to be the same array, and they
    // have to go null together.
    for (const bucket of ["25-34", "35-44", "45-54"]) {
      const d = divergenceFor(BY, "ageBand", bucket, OVERALL, 2);
      expect(d ? d.pct : null).toEqual(sliceSplit(BY, "ageBand", bucket, 2));
    }
  });
});

describe("divisiveness — the Answers lens's sort key", () => {
  it("is 1 for a dead-even split and 0 for a unanimous one", () => {
    expect(divisiveness([5, 5])).toBe(1);
    expect(divisiveness([25, 25, 25, 25])).toBe(1);
    expect(divisiveness([9, 0])).toBe(0);
  });

  it("puts a binary and a four-way on the SAME axis", () => {
    // The reason this is a function and not `1 - leadingShare`. A 30/70
    // binary is one side winning comfortably; a 30/25/25/20 four-way is a
    // genuinely divided room. Raw leading share scores them 0.30 and 0.70
    // and ranks the binary as more divided — exactly backwards.
    const binary = divisiveness([30, 70]);
    const fourWay = divisiveness([30, 25, 25, 20]);
    expect(fourWay).toBeGreaterThan(binary);
    expect(binary).toBeCloseTo(0.6, 5);
  });

  it("is zero for a question nobody answered — not maximally divisive", () => {
    // An empty room is not a disagreement, and 0/0 sorted to the top would
    // fill the "most divisive" view with questions that have no answers.
    expect(divisiveness([0, 0])).toBe(0);
    expect(divisiveness([])).toBe(0);
    expect(divisiveness([7])).toBe(0);
  });
});

describe("meanScore — the arithmetic behind Scores", () => {
  it("scores 1..k so the number matches the option label", () => {
    // Two answers of "1" and two of "10" average 5.5, not 4.5. A rating
    // card shows "7"; a mean that called it 6 would disagree with the
    // card the user just tapped.
    expect(meanScore([2, 0, 0, 0, 0, 0, 0, 0, 0, 2])).toEqual({ mean: 5.5, max: 10, n: 4 });
    expect(meanScore([0, 1])).toEqual({ mean: 2, max: 2, n: 1 });
  });

  it("rounds to one decimal", () => {
    expect(meanScore([1, 1, 1])!.mean).toBe(2);
    expect(meanScore([2, 1])!.mean).toBeCloseTo(1.3, 5);
  });

  it("is null with no answers, never a zero", () => {
    // A zero would render as the worst possible score for a question
    // nobody has rated — the same lie `typicality` refuses to tell.
    expect(meanScore([0, 0, 0])).toBeNull();
    expect(meanScore([])).toBeNull();
  });

  it("carries the scale's top so a caller never has to assume 10", () => {
    // A 5-point Likert and a 1-10 rating both come through here, and
    // "6.2" means opposite things on the two. The max ships with the mean.
    expect(meanScore([1, 1, 1, 1, 1])!.max).toBe(5);
    expect(meanScore(new Array(10).fill(1))!.max).toBe(10);
  });
});

describe("typicality — the Map's headline claim", () => {
  it("says how many of your cohort answered as you did", () => {
    const t = typicality(BY, "ageBand", "25-34", 0, 2);
    expect(t).toEqual({ share: 90, mode: 0, withMajority: true, n: 10 });
  });

  it("knows when you went against your own cohort", () => {
    const t = typicality(BY, "ageBand", "35-44", 0, 2);
    expect(t!.withMajority).toBe(false);
    expect(t!.mode).toBe(1);
    expect(t!.share).toBe(30);
  });

  it("counts YOU in your own cohort", () => {
    // Deliberate, and the reason is consistency rather than convenience:
    // the aggregate folded your answer like everyone else's, so
    // subtracting yourself here would make the Map disagree with the
    // who-voted sheet beside it about the same group.
    const t = typicality({ d: { b: { "0": 1 } } }, "d", "b", 0, 2);
    expect(t).toEqual({ share: 100, mode: 0, withMajority: true, n: 1 });
  });

  it("is null when the cohort has no answers — never a zero", () => {
    // "Nobody your age has answered this" and "0% of people your age
    // agreed" are different sentences and only one is true.
    expect(typicality(BY, "ageBand", "45-54", 0, 2)).toBeNull();
    expect(typicality({ d: { b: {} } }, "d", "b", 0, 2)).toBeNull();
  });

  it("reports the cohort's mode even when you did not answer", () => {
    const t = typicality(BY, "ageBand", "35-44", -1, 2);
    expect(t!.mode).toBe(1);
    expect(t!.share).toBe(0);
    expect(t!.withMajority).toBe(false);
  });
});

describe("MAP_ANCHOR_DIM", () => {
  it("maps exactly the two anchors that ARE breakdown dims", () => {
    // The other six cannot be answered at all: `job` is profession, kept
    // out of the dims on purpose (D8), and the five test anchors are
    // results with no cohort aggregate anywhere. A key appearing here for
    // one of those would make MapStats fabricate again.
    expect(Object.keys(MAP_ANCHOR_DIM).sort()).toEqual(["age", "edu"]);
    expect(MAP_ANCHOR_DIM.job).toBeUndefined();
    expect(MAP_ANCHOR_DIM.big5).toBeUndefined();
  });
});

describe("agreement — the likeness behind Kindred", () => {
  it("counts only questions both answered", () => {
    const mine = { q1: 0, q2: 1, q3: 0 };
    const theirs = { q1: 0, q2: 0, q4: 1 };
    expect(agreement(mine, theirs)).toEqual(agreementOf(1, 2));
  });

  it("is zero rather than NaN with no overlap", () => {
    expect(agreement({ q1: 0 }, { q2: 0 })).toEqual({ shared: 0, same: 0, pct: 0, rate: 0 });
    expect(agreement({}, {})).toEqual({ shared: 0, same: 0, pct: 0, rate: 0 });
  });

  it("is symmetric", () => {
    const a = { q1: 0, q2: 1 };
    const b = { q1: 0, q2: 0 };
    expect(agreement(a, b)).toEqual(agreement(b, a));
  });
});

describe("byOf", () => {
  it("unwraps the breakdown and tolerates every absent shape", () => {
    expect(byOf({ by: BY })).toBe(BY);
    expect(byOf({ counts: {} })).toBeUndefined();
    expect(byOf(null)).toBeUndefined();
    expect(byOf(undefined)).toBeUndefined();
  });
});

// ── the row's two readings (D120) ─────────────────────────────────────
//
// Both were inline in the prototype's mirror-answers.jsx, over rounded
// percentages, with no test of their own. They are folds, so they get one
// here — and the arithmetic is the half most worth pinning, because both
// return CONFIDENT numbers and a wrong one looks exactly like a right one.

describe("headlineFor — three kinds of question, three readings", () => {
  it("averages a rating and carries the top of its scale", () => {
    // Two 3s and two 9s on a 1-10: mean 6, and the /10 rides along
    // because 6 out of 10 and 6 out of 5 are opposite readings.
    const counts = [0, 0, 2, 0, 0, 0, 0, 0, 2, 0];
    expect(headlineFor(counts, "rating")).toEqual({ kind: "average", mean: 6, max: 10 });
  });

  it("reads a scale as the share on its top two points", () => {
    // 5-point Likert, 2+6 of 20 at the agree end.
    expect(headlineFor([4, 4, 4, 2, 6], "scale")).toEqual({ kind: "agree", pct: 40 });
  });

  it("takes the top two points off the END, not off fixed indices", () => {
    // The prototype hardcodes d[3] + d[4] because its scales are always
    // five long. The bank does not promise that, and a 7-point item read
    // at 3 and 4 would report its MIDDLE as agreement.
    expect(headlineFor([0, 0, 0, 9, 0, 1, 3], "scale")).toEqual({ kind: "agree", pct: 31 });
  });

  it("prints an agree share the bars beneath it actually add up to", () => {
    // The regression, exhaustively. The scale branch used to divide
    // locally — `Math.round((agree / n) * 100)` — which is the same
    // mistake as the "62, not 63" case below, one branch over, and more
    // visible: the headline sits directly above the bars it summarizes.
    //
    // Every 5-option vector with counts 0..12. 95,368 of them disagreed.
    const bad: string[] = [];
    const rec = (v: number[]): void => {
      if (v.length === 5) {
        const n = v.reduce((a, b) => a + b, 0);
        if (!n) return;
        const h = headlineFor(v, "scale");
        if (h?.kind !== "agree") return;
        const bars = pctFor(v).slice(-2).reduce((a, b) => a + b, 0);
        if (h.pct !== bars) bad.push(`[${v}] headline ${h.pct}% vs bars ${bars}%`);
        return;
      }
      for (let c = 0; c <= 12; c++) rec([...v, c]);
    };
    rec([]);
    expect(bad.slice(0, 3)).toEqual([]);
    expect(bad.length).toBe(0);
  });

  it("names the leading option for anything categorical", () => {
    expect(headlineFor([12, 8], "binary")).toEqual({ kind: "top", pct: 60, optionIdx: 0 });
    // No type at all is categorical too — the fold must not guess ordinal
    // from the shape of the counts.
    //
    // 62, not 63: 5/8 rounds to 63 but 13+63+25 is 101, and pctFor's rule
    // is that the LARGEST share absorbs the drift. The headline therefore
    // matches the bar beside it rather than the naive division — which is
    // the whole reason it goes through pctFor instead of rounding here.
    expect(headlineFor([1, 5, 2])).toEqual({ kind: "top", pct: 62, optionIdx: 1 });
  });

  it("is null for a question nobody answered, never a confident zero", () => {
    // Every branch divides by the total. A 0% or a 0.0 here would render
    // as a real reading of an empty room.
    expect(headlineFor([0, 0], "binary")).toBeNull();
    expect(headlineFor([0, 0, 0, 0, 0], "scale")).toBeNull();
    expect(headlineFor([], "rating")).toBeNull();
  });
});

describe("standingIn — where you sit in the split", () => {
  it("counts the room below you on an ordinal, when that is the bigger side", () => {
    // 1-10, you at index 7 (a score of 8): 15 below, 5 above.
    const counts = [5, 5, 5, 0, 0, 0, 0, 0, 5, 0];
    expect(standingIn(counts, 8, "rating")).toEqual({ kind: "below", pct: 75 });
  });

  it("switches to the room above you when THAT is the bigger side", () => {
    const counts = [0, 1, 0, 0, 0, 0, 0, 0, 0, 9];
    expect(standingIn(counts, 1, "rating")).toEqual({ kind: "above", pct: 90 });
  });

  it("counts only the people who picked the same option on a categorical", () => {
    // "More than 40% of Oslo" is meaningless when the options are merely
    // different from each other, so this side of the fold refuses to
    // order them.
    expect(standingIn([12, 8], 1, "binary")).toEqual({ kind: "with", pct: 40 });
  });

  it("agrees with the bar it is printed under, to the point", () => {
    // The sentence sits directly beneath the row's own bar, and the bar is
    // drawn from pctFor. Dividing locally is the mistake headlineFor's
    // scale branch already carries a paragraph about ("the exact mistake
    // the categorical branch's 62-not-63 case exists to prevent") — it was
    // still here, one function over, under the same bar.
    //
    // [1,7]: pctFor floors to [12,87] and hands the odd point to the lower
    // index on a tie, so the bar reads 87. Math.round(7/8*100) is 88.
    expect(pctFor([1, 7])).toEqual([13, 87]);
    expect(standingIn([1, 7], 1, "binary")).toEqual({ kind: "with", pct: 87 });

    // Ordinal, same rule: a prefix of pctFor's shares rather than a share
    // of the prefix. [3,4,5] with you on the last: the bar draws 25/33/42
    // and "further along than" must say 58, not Math.round(7/12*100) = 58
    // — equal here — so take a case where they differ: [1,1,4] at index 2
    // draws [17,17,66] and the room below you is 34, not Math.round(2/6*
    // 100) = 33.
    expect(pctFor([1, 1, 4])).toEqual([17, 17, 66]);
    expect(standingIn([1, 1, 4], 2, "rating")).toEqual({ kind: "below", pct: 34 });
  });

  it("is null when you have not answered, or the room is empty", () => {
    expect(standingIn([12, 8], -1, "binary")).toBeNull();
    expect(standingIn([0, 0], 1, "binary")).toBeNull();
    // An index past the end is a bug upstream, not a reading — say null
    // rather than compute a share of a bucket that does not exist.
    expect(standingIn([12, 8], 5, "binary")).toBeNull();
  });
});

// ── the ordering nobody was pinning (D277 §2) ────────────────────────
//
// circle.ts carried a comment describing this exact failure and asserting
// that a secondary sort key prevented it. It did not, and no test said so:
// every case in this suite passes ONE pair of answer maps and checks the
// number that comes back, so a comparator over a whole list had nothing
// holding it. These are the first cases here about ORDER.
describe("likenessRate — the sort key, not the printed number", () => {
  const rank = (pairs: Array<[number, number]>) =>
    pairs
      .map(([same, shared]) => agreementOf(same, shared))
      .sort((a, b) => b.rate - a.rate || b.shared - a.shared)
      .map((a) => `${a.same}/${a.shared}`);

  it("puts 45 of 50 above a perfect 2 of 2 — the case circle.ts described", () => {
    expect(rank([[2, 2], [45, 50]])).toEqual(["45/50", "2/2"]);
    // …which the percentage alone gets backwards, both being sorted on the
    // same data. This is the assertion the old comment believed it had.
    const byPct = [agreementOf(2, 2), agreementOf(45, 50)]
      .sort((a, b) => b.pct - a.pct || b.shared - a.shared)
      .map((a) => `${a.same}/${a.shared}`);
    expect(byPct).toEqual(["2/2", "45/50"]);
  });

  it("puts a 67% over twelve above a perfect 1 of 1", () => {
    expect(rank([[1, 1], [8, 12]])).toEqual(["8/12", "1/1"]);
  });

  it("still lets a perfect twelve beat a 90% of fifty", () => {
    // The bound must discount thin samples without inverting the metric:
    // twelve for twelve is a stronger claim than forty-five of fifty, and
    // a fix that lost that would have traded one wrong order for another.
    expect(rank([[45, 50], [12, 12]])).toEqual(["12/12", "45/50"]);
  });

  it("is monotone in agreement at a fixed overlap", () => {
    // Nothing above pins the obvious half, so it is pinned here: at the
    // same denominator, more matches must never rank lower.
    for (let same = 0; same < 12; same++) {
      expect(likenessRate(same + 1, 12)).toBeGreaterThan(likenessRate(same, 12));
    }
  });

  it("is monotone in overlap at a fixed rate", () => {
    // The property the whole change is for: the same percentage measured
    // over more questions is the better-evidenced claim.
    expect(likenessRate(1, 1)).toBeLessThan(likenessRate(2, 2));
    expect(likenessRate(2, 2)).toBeLessThan(likenessRate(10, 10));
    expect(likenessRate(4, 8)).toBeLessThan(likenessRate(40, 80));
  });

  it("is zero on no overlap, and never NaN or negative", () => {
    expect(likenessRate(0, 0)).toBe(0);
    expect(likenessRate(0, 5)).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(likenessRate(0, 5))).toBe(true);
  });

  it("leaves the printed number alone", () => {
    // D99 chose `pct` for being explainable to the person it names, and
    // this changes only which of two people goes first. A regression here
    // would be a reader seeing a different number, which is the one thing
    // this change is not allowed to do.
    expect(agreementOf(45, 50).pct).toBe(90);
    expect(agreementOf(2, 2).pct).toBe(100);
  });
});

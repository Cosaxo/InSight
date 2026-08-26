// Pins the split-quality arithmetic (scorecard-metrics.mjs; D33 as
// amended 2026-08-06). The ordinal cases each encode a failure the
// categorical formula measured wrong — every "vs the old number"
// assertion here fails if someone routes scale/rating back through
// evennessOf.
import { describe, it, expect } from "vitest";
import {
  evennessOf, ordinalSplit, splitQualityOf, rollupProduction, creditShares, HOME_SHARES,
  attentionFromTrail, ATTENTION_WARNING, isScoredAgg, isMeasured,
} from "./scorecard-metrics.mjs";

describe("categorical evenness (unchanged bar)", () => {
  it("scores the canonical cases", () => {
    expect(evennessOf([0.5, 0.5], 2)).toBe(1);
    expect(evennessOf([0.52, 0.48], 2)).toBeCloseTo(0.96, 5);
    expect(evennessOf([1, 0], 2)).toBe(0);
    expect(evennessOf([0.25, 0.25, 0.25, 0.25], 4)).toBe(1);
  });

  it("routes every non-ordinal type, present and future, through evennessOf", () => {
    const sh = [0.7, 0.3];
    for (const type of ["binary", "choice", "dilemma", "vote", "duel", "somenewtype"]) {
      expect(splitQualityOf(type, sh, 2)).toBe(evennessOf(sh, 2));
    }
  });
});

describe("ordinal split (scale/rating)", () => {
  it("calls the motivating consensus what it is: everyone answering 5–8", () => {
    // The amendment's headline case. Categorical evenness reads this
    // rating as a 0.778 "strong split"; it is a consensus just above
    // the middle, and the axis-aware score says so.
    const sh = [0, 0, 0, 0, 0.2, 0.3, 0.3, 0.2, 0, 0];
    expect(evennessOf(sh, 10)).toBeCloseTo(0.778, 3); // the old, wrong read
    expect(ordinalSplit(sh)).toBeCloseTo(0.213, 3);
    expect(splitQualityOf("rating", sh, 10)).toBeCloseTo(0.213, 3);
  });

  it("scores a one-sided scale by its axis, not its slot spread", () => {
    // 65% agree / 15% disagree — the UI headline calls this "65% agree",
    // the categorical formula called it 0.75.
    const sh = [0.05, 0.1, 0.2, 0.4, 0.25];
    expect(evennessOf(sh, 5)).toBeCloseTo(0.75, 5);
    expect(splitQualityOf("scale", sh, 5)).toBeCloseTo(0.375, 5);
  });

  it("gives a genuinely polarized scale full marks", () => {
    expect(ordinalSplit([0.3, 0.15, 0.1, 0.15, 0.3])).toBe(1);
  });

  it("treats uniform as fully split on both ordinal sizes", () => {
    expect(ordinalSplit(Array(5).fill(0.2))).toBe(1);
    expect(ordinalSplit(Array(10).fill(0.1))).toBe(1);
  });

  it("scores unanimity at zero — including unanimity on the middle", () => {
    expect(ordinalSplit([0, 0, 1, 0, 0])).toBe(0); // all Neutral
    expect(ordinalSplit([0, 0, 0, 0, 1])).toBe(0); // all Strongly agree
    expect(ordinalSplit([1, 0, 0, 0, 0])).toBe(0); // all Strongly disagree
  });

  it("keeps a tight straddle of the midpoint low: balanced but not spread", () => {
    // Everyone answers 5 or 6 on a 10-point rating — perfectly balanced
    // sides, no dispersion: a consensus on "middle", not a split.
    const sh = [0, 0, 0, 0, 0.5, 0.5, 0, 0, 0, 0];
    expect(ordinalSplit(sh)).toBeCloseTo(0.222, 3);
  });
});

describe("demand credit (docs/TAGS-PLAN.md §3)", () => {
  it("a doorless question credits its home in full", () => {
    expect(creditShares(["sport"])).toEqual([{ topic: "sport", share: 1 }]);
  });

  it("holds the home:door ratio at HOME_SHARES:1", () => {
    const [home, door] = creditShares(["sport", "tech"]);
    expect(home.share / door.share).toBeCloseTo(HOME_SHARES, 10);
  });

  it("CONSERVATION: a question's shares sum to exactly one, at every door count", () => {
    // The property the whole demand design rests on: a door redistributes
    // credit and never mints it, so the generator that assigns doors — and
    // whose future budget the demand lanes steer — cannot manufacture
    // demand by tagging broadly. If this stops holding, the rollup's
    // credited answers stop equalling the bank's real answers and the
    // popularity signal quietly inflates.
    for (const topics of [["a"], ["a", "b"], ["a", "b", "c"]]) {
      const sum = creditShares(topics).reduce((s, c) => s + c.share, 0);
      expect(sum).toBeCloseTo(1, 12);
    }
  });

  it("summing credited answers across topics equals summing answers across questions", () => {
    // The rollup-level statement of the same property, over a bank shaped
    // like the real one (mixed door counts).
    const bank = [
      { topics: ["sport", "tech"], total: 31 },
      { topics: ["food"], total: 17 },
      { topics: ["culture", "event", "bigq"], total: 5 },
    ];
    const perTopic = {};
    for (const q of bank) {
      for (const { topic, share } of creditShares(q.topics)) {
        perTopic[topic] = (perTopic[topic] || 0) + q.total * share;
      }
    }
    const credited = Object.values(perTopic).reduce((a, b) => a + b, 0);
    const answered = bank.reduce((a, q) => a + q.total, 0);
    expect(credited).toBeCloseTo(answered, 9);
  });
});

describe("production rollup (D97)", () => {
  const row = (qid, over = {}) => ({
    qid, served: true, signal: "scored", total: 40, evenness: 0.6, grade: "strong", ...over,
  });
  const prov = {
    daily: {
      "000": { source: "editorial", batch: "prototype" },
      "090": { source: "farm", batch: "2026-08-12" },
      "091": { source: "farm", batch: "2026-08-12" },
    },
    feed: { f01: { source: "editorial", batch: "prototype" } },
  };

  it("cuts scored rows by source and by vintage", () => {
    const out = rollupProduction(
      [
        row("daily-000", { evenness: 0.4, grade: "middling" }),
        row("daily-090"),
        row("daily-091", { evenness: 0.1, grade: "landslide", total: 25 }),
        row("feed-f01"),
      ],
      prov,
    );
    expect(out.bySource.editorial).toMatchObject({ questions: 2, scored: 2, strong: 1 });
    expect(out.bySource.farm).toMatchObject({ questions: 2, scored: 2, strong: 1, landslides: 1 });
    expect(out.bySource.farm.avgEvenness).toBeCloseTo(0.35, 5);
    expect(out.byVintage["farm:2026-08-12"].questions).toBe(2);
    expect(out.byVintage["editorial:prototype"].questions).toBe(2);
  });

  it("keeps unserved rows out of the scored figures but in the counts", () => {
    const out = rollupProduction(
      [row("daily-000", { served: false, signal: "unserved", total: 0, evenness: null })],
      prov,
    );
    expect(out.bySource.editorial).toMatchObject({ questions: 1, served: 0, scored: 0, answers: 0 });
    expect(out.bySource.editorial.avgEvenness).toBeNull();
  });

  it("lands a missing row under `unknown` rather than dropping it", () => {
    // Visible, not silent — check:quality holds the join exact, so a row
    // here means the gate is red too; the rollup still tells the truth.
    const out = rollupProduction([row("daily-999")], prov);
    expect(out.bySource.unknown.questions).toBe(1);
    expect(out.byVintage["unknown:unbatched"].questions).toBe(1);
  });

  it("ignores qids from surfaces provenance does not cover", () => {
    const out = rollupProduction([row("learn-cell1"), row("duel-duo-000")], prov);
    expect(Object.keys(out.bySource)).toEqual([]);
  });
});

describe("attentionFromTrail (R4/D271)", () => {
  const day = (q, qOther = 0) => ({ day: "2026-08-22", attn: { devices: 5, q, qOther } });

  it("sums estimates per kind and rates against the seen denominator", () => {
    const att = attentionFromTrail([
      day({ "feed-001": { s: { reach: 4, est: 10 }, a: { reach: 2, est: 4 }, p: { reach: 1, est: 1.5 } } }),
      day({ "feed-001": { s: { reach: 2, est: 10 }, a: { reach: 1, est: 1 } } }),
    ]);
    expect(att.daysWithQ).toBe(2);
    expect(att.qids["feed-001"]).toMatchObject({
      seen: 20, answered: 5, passed: 1.5, conv: 0.25, passRate: 0.08,
    });
  });

  it("refuses a rate under the basis floor rather than printing noise", () => {
    const att = attentionFromTrail([
      day({ "feed-002": { s: { reach: 1, est: 1.5 }, a: { reach: 1, est: 1.5 } } }),
    ]);
    expect(att.qids["feed-002"].conv).toBeNull();
    expect(att.qids["feed-002"].passRate).toBeNull();
  });

  it("carries the truncation count and tolerates attn-less days", () => {
    const att = attentionFromTrail([
      { day: "2026-08-20", actives: 3 },
      day({}, 4),
    ]);
    expect(att.truncatedDevices).toBe(4);
    expect(Object.keys(att.qids)).toHaveLength(0);
  });

  it("the warning names the discipline, because the dashboard doubles the temptation", () => {
    expect(ATTENTION_WARNING).toMatch(/skip is not dislike/);
    expect(ATTENTION_WARNING).toMatch(/D33/);
  });
});

describe("isScoredAgg — the predicate that reads a production aggregate", () => {
  // THE SHAPES ARE REAL. Read live from prvfire33's v2_question_aggs on
  // 2026-08-25 (anonymous sign-in, the public read D98 opened): 104
  // documents, every one of them `{counts|pos, total, by}` with NO
  // `tooSmall` field. These four literals are transcribed from that read.
  const voteAgg = { counts: { 0: 3, 1: 2 }, total: 5, by: { ageBand: {} } };
  const rankAgg = { pos: [3, 1, 2], total: 1 };
  const single = { counts: { 0: 1 }, total: 1, by: {} };

  it("scores a post-D98 document, which carries no tooSmall at all", () => {
    // The whole bug in one assertion. The retired predicate was
    // `agg.tooSmall === false`, and `undefined === false` is false — so
    // this document, and all 104 like it in production, read as unscored.
    expect("tooSmall" in voteAgg).toBe(false);
    expect(isScoredAgg(voteAgg)).toBe(true);
    expect(isScoredAgg(rankAgg)).toBe(true);
    expect(isScoredAgg(single)).toBe(true);
  });

  it("refuses only ABSENCE — a question nobody has answered has no document", () => {
    // v2_question_aggs is `allow write: if false`; the trigger is its only
    // writer and it writes on an answer. So absence is the one honest
    // negative, and there is no floor above it.
    expect(isScoredAgg(undefined)).toBe(false);
    expect(isScoredAgg(null)).toBe(false);
  });

  it("does not resurrect the floor if a legacy document still carries the flag", () => {
    // Pre-D98 documents may still exist for questions retired before the
    // sweep. They were published, so they count; the flag is data the
    // reader no longer interprets rather than a verdict it must obey.
    expect(isScoredAgg({ counts: { 0: 4 }, total: 4, tooSmall: false })).toBe(true);
    expect(isScoredAgg({ counts: {}, total: 0, tooSmall: true })).toBe(true);
  });
});

describe("isMeasured — a scored row is not automatically a measurable one", () => {
  // Sixteen feed questions (11 dial, 3 field, 2 path) declare neither
  // `options` nor `items`. The scorecard computes n = 0 for them,
  // optionShares returns null, and evenness is null however many people
  // answered. They were invisible to the rollups for the wrong reason until
  // D294 — the retired tooSmall predicate marked every aggregate
  // below-floor — and arrived the moment that was fixed.
  const measurable = { signal: "scored", total: 40, evenness: 0.82, qid: "feed-f57", surface: "feed", type: "vote", topic: "music", topics: ["music"] };
  const dial = { signal: "scored", total: 40, evenness: null, qid: "feed-dl5", surface: "feed", type: "dial", topic: "event", topics: ["event"] };

  it("separates 'somebody answered it' from 'the split can be computed'", () => {
    expect(isMeasured(measurable)).toBe(true);
    expect(isMeasured(dial)).toBe(false);
    expect(isMeasured({ evenness: 0 })).toBe(true);   // a real unanimous split
    expect(isMeasured({ evenness: undefined })).toBe(false);
    expect(isMeasured(undefined)).toBe(false);
  });

  it("keeps an unmeasurable row out of the MEAN while keeping it in `scored`", () => {
    const prov = { feed: { f57: { source: "farm", batch: "b1" }, dl5: { source: "farm", batch: "b1" } } };
    const out = rollupProduction([measurable, dial], prov);
    // Both answered, so both are scored…
    expect(out.bySource.farm.scored).toBe(2);
    // …but the average is the one row that HAS a split, not that row
    // halved by a null the fold counted as unanimity.
    expect(out.bySource.farm.avgEvenness).toBeCloseTo(0.82, 3);
  });

  it("reports null rather than 0 for a cell where NOTHING was measurable", () => {
    // The shape the first artifact published with the bug:
    // `types.feed.dial {scored: 7, avgEvenness: 0}` over seven dials. A
    // dial whose crowd is perfectly uniform scored the same 0 as one where
    // everybody picked the same number — and the reader already renders a
    // null average as "no reading yet".
    const prov = { feed: { dl5: { source: "farm", batch: "b1" }, dl6: { source: "farm", batch: "b1" } } };
    const out = rollupProduction([dial, { ...dial, qid: "feed-dl6" }], prov);
    expect(out.bySource.farm.scored).toBe(2);
    expect(out.bySource.farm.avgEvenness).toBeNull();
  });
});

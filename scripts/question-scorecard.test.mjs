// Pins the scorecard's fold over the question banks — `score()` in
// scripts/question-scorecard.mjs, the function that turns published
// aggregates into content/scorecard.json, which is the only thing the farm's
// lanes read about how questions are doing.
//
// It exists because a predicate inside that fold went stale and nothing could
// go red. The feed loop opened with
//
//     if (q.type === "rank") return; // not live-servable (D12)
//
// which was true until D233 shipped rank on 2026-08-23 and closed D12. For
// the five days after, every rank question in the bank — and every answer it
// drew in production — was silently absent from the artifact: no row, no
// draw, no topic credit, nothing for the retirement or demand lanes to see.
// The bug was the line; the reason it survived is that `score()` was not
// exported and had no test, so the only way to exercise it was to run the
// whole program against production and read the output by eye. That is the
// D275 setup (a read tripwire counting `tx.get(` after the code had moved to
// `tx.getAll(`, so it counted zero and called it a win) and the D296 setup (a
// fail-closed test against a field the server stopped writing).
//
// So the first test here is deliberately NOT about rank: it asserts that the
// fold emits one row per bank question whatever its form. That is the
// assertion a type-shaped skip fails — including the next one, added for a
// reason as good as D12's was.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { score } from "./question-scorecard.mjs";
import { evennessOf, creditShares } from "./scorecard-metrics.mjs";

const bank = (name) =>
  JSON.parse(readFileSync(new URL(`../content/${name}`, import.meta.url), "utf8"));
const daily = bank("daily-questions.json");
const feed = bank("feed-questions.json");

const feedRows = (card) => card.perQuestion.filter((r) => r.surface === "feed");
const firstOfType = (type) => {
  const q = feed.questions.find((x) => x.type === type);
  // A bank with none of a form makes its test vacuous, which is how a pin
  // stops pinning without failing. Say so instead.
  if (!q) throw new Error(`content/feed-questions.json has no ${type} question`);
  return q;
};

describe("bank coverage — one row per question, whatever its form", () => {
  it("emits a row for every feed question, by id", () => {
    const card = score({});
    expect(feedRows(card).map((r) => r.qid).sort()).toEqual(
      feed.questions.map((q) => `feed-${q.id}`).sort(),
    );
  });

  it("emits a row for every daily question, and counts both banks in coverage", () => {
    const card = score({});
    expect(card.perQuestion.filter((r) => r.surface === "daily")).toHaveLength(daily.length);
    expect(card.coverage.questions).toBe(daily.length + feed.questions.length);
  });

  it("carries every form the bank holds, in the bank's own proportions", () => {
    // The per-type reading of the same fact, so a failure names the form that
    // went missing rather than just an id. Rank is the one this was written
    // for: the bank holds eight and the artifact held none.
    const card = score({});
    const tally = (rows, key) =>
      rows.reduce((m, r) => ({ ...m, [r[key]]: (m[r[key]] || 0) + 1 }), {});
    expect(tally(feedRows(card), "type")).toEqual(tally(feed.questions, "type"));
    expect(feedRows(card).filter((r) => r.type === "rank").length).toBeGreaterThan(0);
  });
});

describe("rank rows are scored, not measured (D233 shipped it; D298 named the category)", () => {
  const q = firstOfType("rank");
  const qid = `feed-${q.id}`;
  // What the trigger actually publishes for a rank answer: per-item POSITION
  // SUMS and a total, no counts map (functions/src/v2.ts, the `order` branch).
  const card = score({ [qid]: { total: 42, pos: [64, 71, 120, 165] } });
  const row = card.perQuestion.find((r) => r.qid === qid);

  it("counts the draw", () => {
    expect(row.signal).toBe("scored");
    expect(row.total).toBe(42);
    expect(row.type).toBe("rank");
  });

  it("refuses to invent a split it cannot compute", () => {
    // `optionShares` reads an absent counts map and returns null. Null, not
    // zero: zero is unanimity, and a crowd that ordered four items has not
    // agreed on anything the categorical bar can read.
    expect(row.evenness).toBeNull();
    expect(row.optionShares).toBeNull();
    // …so it can never be proposed for retirement on a landslide it does not
    // have, and never lands in the slot diagnostics.
    expect(card.retireProposals.map((r) => r.qid)).not.toContain(qid);
    expect(Object.keys(card.optionSlots.feed)).toHaveLength(0);
  });

  it("credits its answers to the demand signal and its form's rollup", () => {
    // The half of the finding that is not the row: the lanes read these.
    const [home] = creditShares([q.cat, ...(q.also || [])]);
    expect(card.topics[q.cat].answers).toBeCloseTo(42 * home.share, 1);
    expect(card.types.feed.rank.answers).toBe(42);
    expect(card.types.feed.rank.scored).toBe(1);
    expect(card.types.feed.rank.questions).toBe(
      feed.questions.filter((x) => x.type === "rank").length,
    );
  });

  it("stays out of every mean — measured, not scored, is the denominator", () => {
    expect(card.types.feed.rank.measured).toBe(0);
    expect(card.types.feed.rank.avgEvenness).toBeNull();
    expect(card.topics[q.cat].measured).toBe(0);
    expect(card.topics[q.cat].avgEvenness).toBeNull();
    expect(card.production.bySource.editorial.measured).toBe(0);
    expect(card.production.bySource.editorial.avgEvenness).toBeNull();
  });
});

describe("regression pins — what the fold produced before rank joined it", () => {
  it("scores a vote question exactly as it did", () => {
    const q = feed.questions.find((x) => x.type === "vote" && (x.options || []).length === 4);
    if (!q) throw new Error("content/feed-questions.json has no 4-option vote question");
    const qid = `feed-${q.id}`;
    const card = score({ [qid]: { counts: { 0: 50, 1: 30, 2: 15, 3: 5 }, total: 100 } });
    const row = card.perQuestion.find((r) => r.qid === qid);

    expect(row.signal).toBe("scored");
    expect(row.total).toBe(100);
    expect(row.optionShares).toEqual([0.5, 0.3, 0.15, 0.05]);
    expect(row.evenness).toBeCloseTo(evennessOf([0.5, 0.3, 0.15, 0.05], 4), 10);
    expect(row.evenness).toBeCloseTo(2 / 3, 10);
    // Sole scored row, so it IS the median: a real split at or above the
    // median draw is "strong".
    expect(row.grade).toBe("strong");

    expect(card.types.feed.vote.measured).toBe(1);
    expect(card.types.feed.vote.avgEvenness).toBeCloseTo(0.667, 3);
    expect(card.types.feed.vote.strong).toBe(1);
    // The weakest slot's share is the "does this option earn its place"
    // number, and a scored vote row is what feeds it.
    expect(card.optionSlots.feed["vote/4"].avgMinShare).toBe(0.05);
  });

  it("still reads a dial as scored but not measured", () => {
    // The category rank JOINS rather than invents: a dial declares neither
    // `options` nor `items`, so `n` is 0 and there is no split however many
    // people answered (D298).
    const q = firstOfType("dial");
    const qid = `feed-${q.id}`;
    const card = score({ [qid]: { counts: { 0: 7, 1: 9 }, total: 16 } });
    const row = card.perQuestion.find((r) => r.qid === qid);

    expect(row.signal).toBe("scored");
    expect(row.total).toBe(16);
    expect(row.evenness).toBeNull();
    expect(row.optionShares).toBeNull();
    expect(card.types.feed.dial.measured).toBe(0);
    expect(card.types.feed.dial.avgEvenness).toBeNull();
  });

  it("calls a question with no aggregate document what it is", () => {
    const card = score({});
    const q = firstOfType("rank");
    expect(card.perQuestion.find((r) => r.qid === `feed-${q.id}`).signal).toBe("no-answers");
    expect(card.coverage.scored).toBe(0);
  });
});

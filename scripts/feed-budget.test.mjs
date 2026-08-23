// feed-budget.test.mjs — pins the feed regulator's arithmetic.
//
// The property that matters most here is the one the lane is being switched on
// for: it must be able to return work against the bank as it actually ships.
// The learn lane's flat rule could not (every field sat exactly on the floor it
// was measured against), and that bug was invisible for as long as nothing
// fired the lane. This lane gets a Routine in the same change, so the test that
// would have caught it comes first.
//
// The second is the departure from learn-budget's shape: no MIN_CHUNK. Breadth
// across the ten topics is this lane's stated job, so a full budget spread one
// question into each of six thin topics is correct here and would be wrong
// there. A future edit that "fixes the inconsistency" by adding chunking should
// fail a test rather than pass review.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  feedBudget,
  feedSignal,
  loadFeedTopics,
  RUN_CAP,
  TOPIC_TARGET,
  OPEN_MAX,
  SERVABLE_TYPES,
} from "./feed-budget.mjs";

const level = (n, questions) =>
  Array.from({ length: n }, (_, i) => ({ id: `t${String(i).padStart(2, "0")}`, questions }));

describe("feedBudget", () => {
  it("finds work in the bank as it actually ships", () => {
    const { budget, allocation } = feedBudget({ topics: loadFeedTopics() });
    expect(budget).toBeGreaterThan(0);
    expect(allocation.length).toBeGreaterThan(0);
  });

  it("grants the full cap to a bank far from target", () => {
    expect(feedBudget({ topics: level(10, 0) }).budget).toBe(RUN_CAP);
  });

  it("throttles to zero once every topic is at target", () => {
    expect(feedBudget({ topics: level(10, TOPIC_TARGET) }).budget).toBe(0);
    expect(feedBudget({ topics: level(10, TOPIC_TARGET + 9) }).budget).toBe(0);
  });

  it("writes only the gap when one topic is nearly full", () => {
    const topics = [...level(9, TOPIC_TARGET), { id: "thin", questions: TOPIC_TARGET - 2 }];
    expect(feedBudget({ topics }).budget).toBe(2);
  });

  it("subtracts the open PR from the budget, not just from a ceiling", () => {
    // The single-gate posture, learn's rather than the daily lane's: with
    // questions already unreviewed, a run tops up one batch instead of
    // granting a fresh one.
    expect(feedBudget({ topics: level(10, 0), open: 2 }).budget).toBe(OPEN_MAX - 2);
    expect(feedBudget({ topics: level(10, 0), open: OPEN_MAX - 1 }).budget).toBe(1);
  });

  it("stops entirely when the open PR is unreviewable", () => {
    // Even against an empty bank: OPEN_MAX is about the reviewer, not the bank.
    expect(feedBudget({ topics: level(10, 0), open: OPEN_MAX }).budget).toBe(0);
    expect(feedBudget({ topics: level(10, 0), open: OPEN_MAX + 3 }).budget).toBe(0);
  });

  it("spreads across thin topics rather than chunking into one", () => {
    // The deliberate difference from learn-budget: breadth IS the job here.
    const { allocation } = feedBudget({ topics: level(10, 0) });
    expect(allocation).toHaveLength(RUN_CAP);
    expect(allocation.every((a) => a.write === 1)).toBe(true);
  });

  it("fills the thinnest topics first", () => {
    const topics = [
      { id: "fat", questions: TOPIC_TARGET - 1 },
      { id: "thin", questions: 0 },
      { id: "mid", questions: TOPIC_TARGET - 4 },
    ];
    const { allocation } = feedBudget({ topics });
    expect(allocation.map((a) => a.topic)).toEqual(["thin", "mid", "fat"]);
    expect(allocation[0].write).toBeGreaterThanOrEqual(allocation[2].write);
  });

  it("never allocates a topic past the target", () => {
    // Water-filling must respect each topic's own room: the budget moves on
    // rather than overfilling whatever it started on.
    const topics = [{ id: "a", questions: TOPIC_TARGET - 1 }, { id: "b", questions: 0 }];
    const { allocation } = feedBudget({ topics });
    for (const a of allocation) expect(a.questions + a.write).toBeLessThanOrEqual(TOPIC_TARGET);
  });

  it("reaches the target in a bounded number of runs at a steady gate", () => {
    // The regulator's steady state, the property farm-budget.test.mjs pins for
    // the daily lane: with the reviewer keeping up, generation converges on the
    // target and then stops — it does not idle at a cap forever.
    let topics = loadFeedTopics();
    let runs = 0;
    for (; runs < 100; runs++) {
      const { budget, allocation } = feedBudget({ topics });
      if (budget === 0) break;
      const written = new Map(allocation.map((a) => [a.topic, a.write]));
      topics = topics.map((t) => ({ ...t, questions: t.questions + (written.get(t.id) ?? 0) }));
    }
    expect(runs).toBeLessThan(100);
    expect(topics.every((t) => t.questions >= TOPIC_TARGET)).toBe(true);
  });
});

describe("loadFeedTopics", () => {
  it("counts only servable forms, once per carried topic", () => {
    // duel-type feed cards are prototype legacy; a topic must not read as
    // covered on questions nobody can meet. rank joined the servable set
    // at D233 — an answer carries an order now — so its exclusion pin
    // flipped to an inclusion pin the same day.
    expect(SERVABLE_TYPES.has("rank")).toBe(true);
    expect(SERVABLE_TYPES.has("duel")).toBe(false);
    expect(SERVABLE_TYPES.has("path")).toBe(true);

    const topics = loadFeedTopics();
    const counted = topics.reduce((n, t) => n + t.questions, 0);
    const raw = JSON.parse(
      readFileSync(new URL("../content/feed-questions.json", import.meta.url), "utf8"),
    );
    // MEMBERSHIP, not a partition (docs/TAGS-PLAN.md §3): a straddler covers
    // every topic it carries, so the per-topic column sums to servable
    // questions PLUS their servable in-taxonomy doors. This test asserted
    // `< bank size` until doors existed — that inequality was the
    // single-topic premise itself, worn as a test.
    const inTaxonomy = new Set(raw.topics.map((t) => t.id));
    const servable = raw.questions.filter((q) => SERVABLE_TYPES.has(q.type));
    const doorCount = servable.reduce(
      (n, q) => n + (q.also || []).filter((t) => inTaxonomy.has(t)).length,
      0,
    );
    expect(doorCount).toBeGreaterThan(0); // the retro-tag is real, not vestigial
    expect(counted).toBe(servable.length + doorCount);
  });

  it("covers every topic in the taxonomy, thin ones included", () => {
    // THE SECOND ASSERTION HERE USED TO BE
    // `topics.some((t) => t.questions < TOPIC_TARGET)`, which is not the
    // coverage property in this test's name — it is the DEFICIT'S CURRENT
    // EXISTENCE, and this lane exists to remove it. The day the lane
    // finishes levelling the topics it would have gone red for the lane
    // having worked. `feed-budget.mjs` already writes the message for that
    // state ("every topic is at the target"), so the script and its own
    // test disagreed about whether it was reachable — the D208 shape, one
    // lane over, found by sweeping for it after that one.
    //
    // What the fold actually promises: a row per taxonomy id, in the
    // taxonomy's own order, whatever the level. It builds its counter from
    // `feed.topics` and reads back with `?? 0`, so a topic nothing serves
    // yet gets a ZERO row rather than vanishing — which is exactly the case
    // the deficit arithmetic needs and the one the tree cannot demonstrate,
    // because every committed topic currently has questions in it.
    const raw = JSON.parse(
      readFileSync(new URL("../content/feed-questions.json", import.meta.url), "utf8"),
    );
    const topics = loadFeedTopics();
    expect(topics).toHaveLength(10);
    expect(topics.map((t) => t.id)).toEqual(raw.topics.map((t) => t.id));
    for (const t of topics) {
      expect(Number.isInteger(t.questions)).toBe(true);
      expect(t.questions).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("feedSignal", () => {
  it("names the blind mode when the scorecard scores nothing", () => {
    const s = feedSignal({ generatedAt: new Date().toISOString(), topics: {} }, loadFeedTopics());
    expect(s.mode).toBe("blind");
  });

  it("names the blind mode when there is no scorecard at all", () => {
    expect(feedSignal(null, loadFeedTopics()).mode).toBe("blind");
  });

  it("switches to signal once feed questions are scored", () => {
    const topics = loadFeedTopics();
    const rows = Object.fromEntries(topics.map((t) => [t.id, { scored: 2, answers: 400 }]));
    const s = feedSignal({ generatedAt: new Date().toISOString(), topics: rows }, topics);
    expect(s.mode).toBe("signal");
    expect(s.note).toContain("20 feed questions");
  });
});

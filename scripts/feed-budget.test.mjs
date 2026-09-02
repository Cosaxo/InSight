// feed-budget.test.mjs — pins the feed regulator's arithmetic.
//
// The property that matters most here is the one D350 turned the regulator
// around on: it must NEVER stop for stock. The lane used to throttle to zero
// at a per-topic target, and the test that pinned that ("throttles to zero
// once every topic is at target") was the bounded-bank premise worn as a
// test — the same shape D316 retired on the read path. A future edit that
// re-adds a stock ceiling should fail here rather than pass review.
//
// The second is the departure from learn-budget's shape: no MIN_CHUNK on the
// floor. Breadth across the ten topics is what the floor is FOR, so a budget
// spread one question into each of ten thin topics is correct here and would
// be wrong there.
//
// The third is the demand share: above the floor the budget follows where
// the crowd answers, weighted popularity × depth, and never past the
// batch-mix gate's own ceiling — so the regulator cannot print a batch the
// pre-flight refuses.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  feedBudget,
  feedSignal,
  loadFeedTopics,
  RUN_CAP,
  TOPIC_FLOOR,
  OPEN_MAX,
  DEMAND_MIN_ANSWERS,
  DEMAND_STALE_DAYS,
  BATCH_TOPIC_SHARE,
  SERVABLE_TYPES,
  LANE_EXCLUDED,
} from "./feed-budget.mjs";

const level = (n, questions) =>
  Array.from({ length: n }, (_, i) => ({ id: `t${String(i).padStart(2, "0")}`, questions }));

const total = (allocation) => allocation.reduce((n, a) => n + a.write, 0);

describe("feedBudget", () => {
  it("finds work in the bank as it actually ships", () => {
    const { budget, allocation } = feedBudget({ topics: loadFeedTopics() });
    expect(budget).toBeGreaterThan(0);
    expect(allocation.length).toBeGreaterThan(0);
  });

  it("grants the full cap to a bank far from the floor", () => {
    expect(feedBudget({ topics: level(10, 0) }).budget).toBe(RUN_CAP);
  });

  it("never stops for stock — a levelled bank still gets the full cap (D316/D350)", () => {
    // The stop that used to live here was the bounded-bank premise. There
    // is no question limit: a bank at the floor, or far past it, is a bank
    // the lane keeps growing.
    expect(feedBudget({ topics: level(10, TOPIC_FLOOR) }).budget).toBe(RUN_CAP);
    expect(feedBudget({ topics: level(10, TOPIC_FLOOR * 10) }).budget).toBe(RUN_CAP);
    const { split } = feedBudget({ topics: level(10, TOPIC_FLOOR * 10) });
    expect(split.floor).toBe(0);
    expect(split.level).toBe(RUN_CAP);
  });

  it("subtracts the open PR from the budget, not just from a ceiling", () => {
    // The single-gate posture, learn's rather than the daily lane's: with
    // questions already unreviewed, a run tops up one batch instead of
    // granting a fresh one.
    expect(feedBudget({ topics: level(10, 0), open: 2 }).budget).toBe(OPEN_MAX - 2);
    expect(feedBudget({ topics: level(10, 0), open: OPEN_MAX - 1 }).budget).toBe(1);
  });

  it("stops entirely when the open PR is unreviewable — the one stop left", () => {
    // Even against an empty bank: OPEN_MAX is about the gate, not the bank.
    expect(feedBudget({ topics: level(10, 0), open: OPEN_MAX }).budget).toBe(0);
    expect(feedBudget({ topics: level(10, 0), open: OPEN_MAX + 3 }).budget).toBe(0);
  });

  it("spreads the floor across thin topics rather than chunking into one", () => {
    // The deliberate difference from learn-budget: breadth IS the floor's job.
    const { allocation, split } = feedBudget({ topics: level(10, 0) });
    expect(split.floor).toBe(RUN_CAP);
    expect(allocation).toHaveLength(10);
    expect(Math.max(...allocation.map((a) => a.write)) - Math.min(...allocation.map((a) => a.write))).toBeLessThanOrEqual(1);
  });

  it("fills the thinnest topics first", () => {
    const topics = [
      { id: "fat", questions: TOPIC_FLOOR - 1 },
      { id: "thin", questions: 0 },
      { id: "mid", questions: TOPIC_FLOOR - 4 },
    ];
    const { allocation } = feedBudget({ topics });
    expect(allocation.slice(0, 3).map((a) => a.topic)).toEqual(["thin", "mid", "fat"]);
    expect(allocation[0].write).toBeGreaterThanOrEqual(allocation[2].write);
  });

  it("the floor never overfills a topic; what is left levels above it", () => {
    // A topic takes at most its own room under the floor from the floor
    // share; the remainder is still granted, as levelling, so the budget
    // is spent in full.
    const topics = [{ id: "a", questions: TOPIC_FLOOR - 1 }, { id: "b", questions: TOPIC_FLOOR - 2 }];
    const { allocation, split, budget } = feedBudget({ topics });
    expect(budget).toBe(RUN_CAP);
    for (const a of allocation) expect(a.floor).toBe(TOPIC_FLOOR - a.questions);
    expect(split.floor).toBe(3);
    expect(split.level).toBe(RUN_CAP - 3);
  });

  it("clears the floor in a bounded number of runs and keeps going", () => {
    // The floor is reachable — the levelling property farm-budget.test.mjs
    // pins for the daily pen — and once every topic clears it the lane does
    // NOT go quiet: the next run's budget is still the cap.
    let topics = loadFeedTopics();
    let runs = 0;
    for (; runs < 100 && !topics.every((t) => t.questions >= TOPIC_FLOOR); runs++) {
      const { allocation } = feedBudget({ topics });
      const written = new Map(allocation.map((a) => [a.topic, a.write]));
      topics = topics.map((t) => ({ ...t, questions: t.questions + (written.get(t.id) ?? 0) }));
    }
    expect(runs).toBeLessThan(100);
    expect(topics.every((t) => t.questions >= TOPIC_FLOOR)).toBe(true);
    expect(feedBudget({ topics }).budget).toBe(RUN_CAP);
  });

  it("levels evenly above the floor when there is no demand signal", () => {
    const { allocation, split } = feedBudget({ topics: level(10, TOPIC_FLOOR + 5) });
    expect(split.level).toBe(RUN_CAP);
    // Every topic touched, none more than one ahead of another.
    expect(allocation).toHaveLength(10);
    const writes = allocation.map((a) => a.write);
    expect(Math.max(...writes) - Math.min(...writes)).toBeLessThanOrEqual(1);
    expect(total(allocation)).toBe(RUN_CAP);
  });

  it("sends everything above the floor to the demand share, proportionally", () => {
    const topics = level(4, TOPIC_FLOOR);
    const demand = { t00: 0.6, t01: 0.3, t02: 0.1, t03: 0 };
    const { allocation, split } = feedBudget({ topics, demand });
    expect(split.demand).toBe(RUN_CAP);
    expect(split.level).toBe(0);
    const by = Object.fromEntries(allocation.map((a) => [a.topic, a.write]));
    // D'Hondt over 12 at 6:3:1 — the leader takes the most, the zero-weight
    // topic takes nothing.
    expect(by.t00).toBeGreaterThan(by.t01);
    expect(by.t01).toBeGreaterThan(by.t02 ?? 0);
    expect(by.t03).toBeUndefined();
    expect(total(allocation)).toBe(RUN_CAP);
  });

  it("the floor comes before demand", () => {
    // A topic under the floor is filled first even when the crowd is
    // elsewhere: breadth is the bound, popularity is what the rest follows.
    const topics = [
      { id: "hot", questions: TOPIC_FLOOR },
      { id: "cold", questions: TOPIC_FLOOR - 3 },
    ];
    const { allocation, split } = feedBudget({ topics, demand: { hot: 1, cold: 0 } });
    const by = Object.fromEntries(allocation.map((a) => [a.topic, a]));
    expect(by.cold.floor).toBe(3);
    expect(split.floor).toBe(3);
    expect(by.hot.demand).toBe(Math.ceil(RUN_CAP * BATCH_TOPIC_SHARE));
    expect(split.level).toBe(RUN_CAP - 3 - by.hot.demand);
  });

  it("never lets one topic take more of a batch than the batch-mix gate allows", () => {
    // check:quality fails a feed batch where one topic holds more than
    // ⌈0.75 × batch⌉; the allocation must not print one.
    const topics = level(3, TOPIC_FLOOR);
    const { allocation } = feedBudget({ topics, demand: { t00: 1, t01: 0.0001, t02: 0 } });
    for (const a of allocation) expect(a.write).toBeLessThanOrEqual(Math.ceil(RUN_CAP * BATCH_TOPIC_SHARE));
    expect(total(allocation)).toBe(RUN_CAP);
  });

  it("is reproducible — the same inputs print the same allocation", () => {
    const topics = level(10, TOPIC_FLOOR + 2);
    const demand = Object.fromEntries(topics.map((t, i) => [t.id, (i + 1) / 55]));
    const a = feedBudget({ topics, demand });
    const b = feedBudget({ topics, demand });
    expect(a).toEqual(b);
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
    //
    // Allocatable topics only (D231): the fold does not report `now`, so a
    // current-events question contributes nothing to this column — neither
    // through its home topic nor through a door onto one. Summing the whole
    // bank was the same "every topic is allocatable" premise worn as a
    // test, one layer further out.
    const inTaxonomy = new Set(
      raw.topics.filter((t) => !LANE_EXCLUDED.has(t.id)).map((t) => t.id),
    );
    const servable = raw.questions.filter((q) => SERVABLE_TYPES.has(q.type));
    const homeCount = servable.filter((q) => inTaxonomy.has(q.cat)).length;
    const doorCount = servable.reduce(
      (n, q) => n + (q.also || []).filter((t) => inTaxonomy.has(t)).length,
      0,
    );
    expect(doorCount).toBeGreaterThan(0); // the retro-tag is real, not vestigial
    expect(homeCount).toBeLessThan(servable.length); // the exclusion is doing work
    expect(counted).toBe(homeCount + doorCount);
  });

  it("covers every topic in the taxonomy, thin ones included", () => {
    // What the fold promises: a row per taxonomy id, in the taxonomy's own
    // order, whatever the level. It builds its counter from `feed.topics`
    // and reads back with `?? 0`, so a topic nothing serves yet gets a ZERO
    // row rather than vanishing — the case the floor arithmetic needs and
    // the one the tree cannot demonstrate, because every committed topic
    // currently has questions in it.
    const raw = JSON.parse(
      readFileSync(new URL("../content/feed-questions.json", import.meta.url), "utf8"),
    );
    const topics = loadFeedTopics();
    const allocatable = raw.topics.filter((t) => !LANE_EXCLUDED.has(t.id));
    expect(topics).toHaveLength(10);
    expect(topics.map((t) => t.id)).toEqual(allocatable.map((t) => t.id));
    // …and the exclusion is the point of the filter, not a side effect of
    // it (D231). `now` is the editorial current-events lane; a brand-new
    // topic is the largest deficit in the taxonomy, so thinnest-first
    // would point every farm run straight at the one topic a farm run may
    // not write — and once it had answers, demand would. The rule has to
    // hold in the allocator, because a rule the allocator argues against
    // every run eventually loses.
    expect(raw.topics.map((t) => t.id)).toContain("now");
    expect(topics.map((t) => t.id)).not.toContain("now");
    for (const t of topics) {
      expect(Number.isInteger(t.questions)).toBe(true);
      expect(t.questions).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("feedSignal", () => {
  const fresh = () => new Date().toISOString();
  const rowsFor = (topics, answers, scored = 2) =>
    Object.fromEntries(topics.map((t) => [t.id, { scored, answers: answers(t) }]));

  it("is blind with no scorecard at all", () => {
    const s = feedSignal(null, loadFeedTopics());
    expect(s.mode).toBe("blind");
    expect(s.weights).toBeNull();
  });

  it("is blind while the crowd is under DEMAND_MIN_ANSWERS", () => {
    const topics = loadFeedTopics();
    const rows = rowsFor(topics, () => (DEMAND_MIN_ANSWERS - 1) / topics.length);
    const s = feedSignal({ generatedAt: fresh(), topics: rows }, topics);
    expect(s.mode).toBe("blind");
    expect(s.note).toContain(`under ${DEMAND_MIN_ANSWERS}`);
  });

  it("is blind against the committed scorecard as it stands today, and says why", () => {
    // The tree's own scorecard credits a few dozen feed answers; the lane
    // must level rather than read a ranking off that. When this fails
    // because the crowd grew, the assertion has done its job — move it.
    const scorecard = JSON.parse(readFileSync(new URL("../content/scorecard.json", import.meta.url), "utf8"));
    const topics = loadFeedTopics();
    const credited = topics.reduce((n, t) => n + (scorecard.topics[t.id]?.answers ?? 0), 0);
    const s = feedSignal(scorecard, topics, Date.parse(scorecard.generatedAt));
    expect(s.mode).toBe(credited >= DEMAND_MIN_ANSWERS ? "demand" : "blind");
  });

  it("is blind past DEMAND_STALE_DAYS, however loud the crowd", () => {
    const topics = loadFeedTopics();
    const rows = rowsFor(topics, () => 1000);
    const at = new Date("2026-01-01T00:00:00Z");
    const later = at.getTime() + (DEMAND_STALE_DAYS + 1) * 86400000;
    const s = feedSignal({ generatedAt: at.toISOString(), topics: rows }, topics, later);
    expect(s.mode).toBe("blind");
    expect(s.note).toContain("stale");
    const inTime = feedSignal({ generatedAt: at.toISOString(), topics: rows }, topics, at.getTime() + DEMAND_STALE_DAYS * 86400000);
    expect(inTime.mode).toBe("demand");
  });

  it("weights popularity × depth once the crowd is real", () => {
    // Three topics, same stock: answers 600 / 300 / 100. Popularity share
    // 0.6 / 0.3 / 0.1; depth 1 / 0.5 / 0.167 → weights fall 9:2.25:0.25.
    const topics = [
      { id: "big", questions: 20 },
      { id: "mid", questions: 20 },
      { id: "small", questions: 20 },
    ];
    const rows = rowsFor(topics, (t) => ({ big: 600, mid: 300, small: 100 })[t.id]);
    const s = feedSignal({ generatedAt: fresh(), topics: rows }, topics);
    expect(s.mode).toBe("demand");
    expect(s.weights.big).toBeGreaterThan(s.weights.mid);
    expect(s.weights.mid).toBeGreaterThan(s.weights.small);
    expect(s.weights.big / s.weights.mid).toBeCloseTo(4, 1);
    expect(s.note).toContain("demand leads big");
  });

  it("lets a small devoted topic earn content beside a big diluted one", () => {
    // The depth factor: 120 answers over 4 questions (30 each) against
    // 200 over 40 (5 each). Popularity alone says 200 > 120; depth says the
    // small topic's stock is being used six times harder. The product
    // ranks the small one ahead — the daily lane's "small-but-devoted
    // topics earn content alongside big ones", as arithmetic.
    const topics = [
      { id: "wide", questions: 40 },
      { id: "devoted", questions: 4 },
    ];
    const rows = rowsFor(topics, (t) => ({ wide: 200, devoted: 120 })[t.id]);
    const s = feedSignal({ generatedAt: fresh(), topics: rows }, topics);
    expect(s.mode).toBe("demand");
    expect(s.weights.devoted).toBeGreaterThan(s.weights.wide);
  });

  it("gives a topic nobody answers no weight, and a topic with no stock no depth", () => {
    const topics = [
      { id: "answered", questions: 10 },
      { id: "silent", questions: 10 },
      { id: "empty", questions: 0 },
    ];
    const rows = rowsFor(topics, (t) => ({ answered: 500, silent: 0, empty: 0 })[t.id]);
    const s = feedSignal({ generatedAt: fresh(), topics: rows }, topics);
    expect(s.weights.silent).toBe(0);
    expect(s.weights.empty).toBe(0);
    expect(s.weights.answered).toBeGreaterThan(0);
  });
});

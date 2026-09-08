// topic-budget.test.mjs — pins the D421 taxonomy regulator.
//
// The property under test is the reversal's whole safety argument: the lanes
// may create categories now, and the four blockers are what stands where the
// human used to. Each one is pinned separately, because a blocker that stops
// firing is invisible — the regulator would simply start saying yes, which
// looks exactly like evidence arriving.
import { describe, it, expect } from "vitest";
import {
  topicVerdict, runDays, hueFor, hueRing, loadSurfaces, loadLedger, feedPageCost,
  EVIDENCE_MIN, RUNS_MIN, SURFACES,
} from "./topic-budget.mjs";
import { TOP_FLOOR } from "./farm-budget.mjs";
import { TOPIC_FLOOR } from "./feed-budget.mjs";
import { FIELD_FLOOR } from "./learn-budget.mjs";

// A proposal with every blocker clear, so each test breaks exactly one thing.
const clear = {
  surface: "feed",
  parked: EVIDENCE_MIN,
  days: RUNS_MIN,
  deficit: 0,
  budget: TOPIC_FLOOR,
  settling: null,
};

describe("topicVerdict", () => {
  it("creates when evidence, breadth and settling are all clear", () => {
    const v = topicVerdict(clear);
    expect(v.create).toBe(true);
    expect(v.blockers).toEqual([]);
    // Owed is what the floor still wants; with a full budget the room
    // opens finished.
    expect(clear.parked + v.owed).toBe(TOPIC_FLOOR);
    expect(v.write).toBe(v.owed);
  });

  it("blocks one run's opinion however many questions it parked", () => {
    // D145's sentence is about RUNS, not questions — a single firing cannot
    // manufacture recurrence by writing more.
    const v = topicVerdict({ ...clear, parked: 50, days: 1, budget: TOPIC_FLOOR });
    expect(v.create).toBe(false);
    expect(v.blockers[0]).toMatch(/anecdote/);
  });

  it("blocks while the surface owes breadth to the categories it already has", () => {
    const v = topicVerdict({ ...clear, deficit: 1 });
    expect(v.create).toBe(false);
    expect(v.blockers.some((b) => /breadth debt/.test(b))).toBe(true);
  });

  it("never blocks on capacity — the budget sizes the write", () => {
    // The first cut of D421 had capacity as a fourth blocker, and the
    // arithmetic locked learn out for good: cap 10, floor 24, 3 parked ->
    // 21 owed > 10 granted, every run, forever. A rule the owner had just
    // reversed would have stood on one surface by accident.
    const v = topicVerdict({ ...clear, budget: 5 });
    expect(v.create).toBe(true);
    expect(v.write).toBe(5);
    expect(v.owed).toBe(TOPIC_FLOOR - EVIDENCE_MIN);
    expect(v.reason).toMatch(/floor-first levelling writes the other/);
  });

  it("writes the whole room when the budget covers it, and says the room is full", () => {
    const v = topicVerdict({ ...clear, budget: TOPIC_FLOOR });
    expect(v.write).toBe(TOPIC_FLOOR - EVIDENCE_MIN);
    expect(v.reason).toContain(`${TOPIC_FLOOR} of ${TOPIC_FLOOR}`);
    expect(v.reason).not.toMatch(/floor-first levelling/);
  });

  it("lets learn create a field — the surface the blocker version locked out", () => {
    const v = topicVerdict({ surface: "learn", parked: EVIDENCE_MIN, days: RUNS_MIN,
      deficit: 0, budget: SURFACES.learn.cap, settling: null });
    expect(SURFACES.learn.cap).toBeLessThan(FIELD_FLOOR - EVIDENCE_MIN); // the lockout, as arithmetic
    expect(v.create).toBe(true);
    expect(v.write).toBe(SURFACES.learn.cap);
  });

  it("blocks a second room while the last one created is still thin", () => {
    const v = topicVerdict({ ...clear, settling: TOPIC_FLOOR - 1 });
    expect(v.create).toBe(false);
    expect(v.blockers.some((b) => /one room at a time/.test(b))).toBe(true);
    expect(topicVerdict({ ...clear, settling: TOPIC_FLOOR }).create).toBe(true);
  });

  it("names every site a creating run must write", () => {
    // The half-creation check:taxonomy exists to catch: the feed's topic
    // lives in two files, and the verdict has to say so out loud.
    expect(topicVerdict(clear).reason).toContain("world-feed-topics.js");
    expect(topicVerdict(clear).reason).toContain("feed-questions.json");
  });

  it("refuses an unknown surface rather than defaulting one", () => {
    expect(() => topicVerdict({ ...clear, surface: "pick" })).toThrow(/unknown surface/);
  });
});

describe("the floors are the lanes' own", () => {
  // D197's one-copy rule: if these ever drift, the regulator would be
  // holding a category to a standard its own lane does not enforce.
  it("imports rather than restates each floor", () => {
    expect(SURFACES.daily.floor).toBe(TOP_FLOOR);
    expect(SURFACES.feed.floor).toBe(TOPIC_FLOOR);
    expect(SURFACES.learn.floor).toBe(FIELD_FLOOR);
  });
});

describe("runDays", () => {
  it("counts distinct days, not questions", () => {
    expect(runDays([{ run: "2026-09-01" }, { run: "2026-09-01" }, { run: "2026-09-02" }])).toBe(2);
  });
  it("ignores an entry with no run date", () => {
    expect(runDays([{ run: "2026-09-01" }, {}])).toBe(1);
  });
  it("reads a date out of a timestamp", () => {
    expect(runDays([{ run: "2026-09-01T07:00:00Z" }, { run: "2026-09-01" }])).toBe(1);
  });
});

describe("hueFor", () => {
  it("reproduces D231's own pick", () => {
    // The twelve hues the feed carried before `now`, and the record's
    // reasoning: "Hue 115 is the widest gap left in the row (85 -> 145),
    // picked for distance from its neighbours rather than for a meaning."
    // The algorithm is that sentence; this pins that it agrees with the
    // owner's hand.
    const before = [145, 40, 310, 355, 235, 200, 25, 260, 85, 290, 60, 170];
    expect(hueFor(before)).toBe(115);
  });

  it("takes the widest gap's midpoint on the ring that ships today", () => {
    const ring = hueRing("feed", [
      { color: "oklch(0.52 0.14 25)" }, { color: "oklch(0.52 0.14 40)" },
      { color: "oklch(0.52 0.14 200)" },
    ]);
    // Arcs: 25->40 is 15, 40->200 is 160, and the wrap 200->25 is 185 —
    // the widest, so the midpoint wraps too: 200 + 92.5 = 292.5 -> 293.
    expect(hueFor(ring)).toBe(293);
  });

  it("wraps across 360 rather than treating the ring as a line", () => {
    expect(hueFor([350, 10])).toBe(180);
  });

  it("answers for a ring with one hue and for none", () => {
    expect(hueFor([90])).toBe(270);
    expect(hueFor([])).toBe(0);
  });
});

describe("the tree it actually runs on", () => {
  it("reads every surface's stock through the lanes' own loaders", async () => {
    const s = await loadSurfaces();
    for (const name of Object.keys(SURFACES)) {
      expect(s[name].rows.length).toBeGreaterThan(0);
      expect(s[name].deficit).toBeGreaterThanOrEqual(0);
    }
  });

  it("reads the per-topic install cost off the pager rather than restating it", () => {
    // D96 always-on topics: a new install pays a page per topic. If the
    // constant moves or is renamed, the line goes silent (null), never wrong.
    expect(feedPageCost()).toBeGreaterThan(0);
  });

  it("ships an empty ledger with both arrays present", () => {
    // Empty is the correct state; the shape is what topic-budget and
    // check:taxonomy both read, so a hand-edit that drops an array should
    // fail here rather than at 07:00 in a lane.
    const l = loadLedger();
    expect(Array.isArray(l.proposals)).toBe(true);
    expect(Array.isArray(l.created)).toBe(true);
  });
});

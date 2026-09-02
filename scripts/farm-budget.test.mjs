// farm-budget.test.mjs — pins the D97 budget regulator's arithmetic.
//
// The property under test is the design claim QUESTION-FARM.md and D97 make
// in prose: with the pen at target, sustained generation EQUALS measured
// promotion throughput — the cap only binds during catch-up. If someone
// retunes a constant or reshapes the formula, the simulation below says
// what the farm will actually do at steady state, which is the number the
// review-capacity argument rests on.
import { describe, it, expect } from "vitest";
import {
  laneBudget,
  farmAllocation,
  farmSignal,
  loadDailyTops,
  RUN_CAP,
  PEN_TARGET,
  OPEN_MAX,
  PROMOTE_PACE,
  TOP_FLOOR,
  DEMAND_MIN_ANSWERS,
} from "./farm-budget.mjs";
import { loadCorpus } from "./question-quality.mjs";

describe("laneBudget", () => {
  it("grants the full cap to an empty pen", () => {
    expect(laneBudget({ unpromoted: 0 }).budget).toBe(RUN_CAP);
  });

  it("throttles to zero at the pen target", () => {
    expect(laneBudget({ unpromoted: PEN_TARGET }).budget).toBe(0);
    expect(laneBudget({ unpromoted: PEN_TARGET + 10 }).budget).toBe(0);
  });

  it("writes only the gap when the pen is nearly full", () => {
    expect(laneBudget({ unpromoted: PEN_TARGET - 3 }).budget).toBe(3);
  });

  it("counts open-PR questions as supply", () => {
    expect(laneBudget({ unpromoted: PEN_TARGET - 10, open: 10 }).budget).toBe(0);
    expect(laneBudget({ unpromoted: PEN_TARGET - 10, open: 4 }).budget).toBe(6);
  });

  it("stops entirely when the open PR is unreviewable", () => {
    // Even with an empty pen: OPEN_MAX is about the reviewer, not the pen.
    expect(laneBudget({ unpromoted: 0, open: OPEN_MAX }).budget).toBe(0);
    expect(laneBudget({ unpromoted: 0, open: OPEN_MAX + 5 }).budget).toBe(0);
  });

  it("never exceeds the cap and never goes negative", () => {
    for (let unpromoted = 0; unpromoted <= PEN_TARGET + 5; unpromoted++) {
      for (let open = 0; open <= OPEN_MAX + 2; open++) {
        const { budget } = laneBudget({ unpromoted, open });
        expect(budget).toBeGreaterThanOrEqual(0);
        expect(budget).toBeLessThanOrEqual(RUN_CAP);
      }
    }
  });

  it("steady state: generation equals promotion throughput, pen stays bounded", () => {
    // Simulate a year of daily runs against a human promoting 14/week (the
    // D97 target cadence): every run writes its budget into the pen, twice
    // a week the human promotes 7 out. The claims: the pen never exceeds
    // PEN_TARGET + RUN_CAP, and total generation tracks total promotion
    // (plus the one-time pen fill) — i.e. the regulator, not the cap, sets
    // sustained output.
    let pen = 0;
    let generated = 0;
    let promoted = 0;
    for (let day = 0; day < 365; day++) {
      const { budget } = laneBudget({ unpromoted: pen });
      pen += budget;
      generated += budget;
      if (day % 7 === 0 || day % 7 === 3) {
        const take = Math.min(7, pen);
        pen -= take;
        promoted += take;
      }
      expect(pen).toBeLessThanOrEqual(PEN_TARGET + RUN_CAP);
    }
    expect(generated).toBe(promoted + pen);
    // 14/week promotion for a year ≈ 728; generation must sit beside it,
    // nowhere near the 8×365 = 2920 the cap alone would permit.
    expect(generated).toBeLessThan(promoted + PEN_TARGET + RUN_CAP + 1);
    expect(generated).toBeGreaterThan(700);
  });

  it("constants hold their documented relationships", () => {
    // PEN_TARGET is eight weeks of D30's ≥7/week promotion floor; RUN_CAP
    // refills a drained pen inside a week. These are the two sentences
    // QUESTION-FARM.md § budget derives the numbers from — if a retune
    // breaks the sentence, the doc and check:figures must move with it.
    expect(PEN_TARGET).toBe(8 * 7);
    expect(RUN_CAP * 7).toBeGreaterThanOrEqual(PEN_TARGET);
    expect(OPEN_MAX).toBeGreaterThan(RUN_CAP);
    // D212: the run promotes its own batch at a pace that is D97's ≥14/week
    // target at the daily cadence, and sits below RUN_CAP so the pen fills
    // before it drains — the buffer survives the automation.
    expect(PROMOTE_PACE * 7).toBe(14);
    expect(PROMOTE_PACE).toBeLessThan(RUN_CAP);
  });
});

// D349: where a granted budget GOES is arithmetic now. The property that
// matters is the one the run log measured the absence of — eighteen straight
// no-ops against an empty pen because "no lane has work" — so the first
// claim is that a granted budget always lands somewhere.
describe("farmAllocation", () => {
  const tops = (n, questions) =>
    Array.from({ length: n }, (_, i) => ({ id: `T${String(i).padStart(2, "0")}`, questions }));
  const total = (a) => a.reduce((n, r) => n + r.write, 0);

  it("spends every granted question, whatever the tops hold", () => {
    for (const q of [0, TOP_FLOOR, TOP_FLOOR * 5]) {
      const { allocation } = farmAllocation({ tops: tops(14, q), budget: RUN_CAP });
      expect(total(allocation)).toBe(RUN_CAP);
    }
  });

  it("fills the floor first, then levels thinnest-first with no ceiling", () => {
    const t = [...tops(11, TOP_FLOOR + 2), { id: "thin", questions: TOP_FLOOR - 2 }];
    const { allocation, split } = farmAllocation({ tops: t, budget: RUN_CAP });
    expect(allocation[0].top).toBe("thin");
    expect(split.floor).toBe(2);
    expect(split.level).toBe(RUN_CAP - 2);
  });

  it("follows demand above the floor when there is a signal", () => {
    const t = tops(3, TOP_FLOOR);
    const { allocation, split } = farmAllocation({ tops: t, budget: RUN_CAP, demand: { T00: 0.7, T01: 0.3, T02: 0 } });
    expect(split.demand).toBe(RUN_CAP);
    expect(allocation[0].top).toBe("T00");
    expect(allocation.find((r) => r.top === "T02")).toBeUndefined();
  });

  it("finds work in the archive as it actually ships", async () => {
    const t = await loadDailyTops();
    const { allocation } = farmAllocation({ tops: t, budget: RUN_CAP });
    expect(total(allocation)).toBe(RUN_CAP);
  });
});

describe("loadDailyTops", () => {
  it("counts every archive entry once, by its top, over every CAT_META top", async () => {
    const t = await loadDailyTops();
    const { specQ, catMeta } = loadCorpus();
    expect(t.map((x) => x.id)).toEqual(Object.keys(catMeta));
    expect(t.reduce((n, x) => n + x.questions, 0)).toBe(specQ.length);
  });
});

describe("farmSignal", () => {
  it("reads the capitalised daily rows and is blind until the crowd is real", async () => {
    const t = await loadDailyTops();
    expect(farmSignal(null, t).mode).toBe("blind");
    const few = { generatedAt: new Date().toISOString(), topics: { Sport: { answers: DEMAND_MIN_ANSWERS - 1 } } };
    expect(farmSignal(few, t).mode).toBe("blind");
    const loud = { generatedAt: new Date().toISOString(), topics: { Sport: { answers: 900 }, Film: { answers: 300 } } };
    const s = farmSignal(loud, t);
    expect(s.mode).toBe("demand");
    expect(s.weights.Sport).toBeGreaterThan(s.weights.Film);
    expect(s.weights.Home).toBe(0);
  });
});

// @vitest-environment jsdom
//
// jsdom for typeSplit.test.ts's reason: the floors imported from
// typeSplit arrive through typeMix, whose module init publishes onto
// `window` via live.ts.
//
// The per-band reading of one question (D227) — typeSplit's twin, so the
// cases mirror that suite's: mostly HONESTY rather than arithmetic,
// because this fold is a bounded sample sitting beside exact published
// cells and every property keeping the two apart is what gets pinned.
import { describe, expect, it } from "vitest";
import {
  LOGIC_BANDS, LOGIC_SPLIT_SMALL, LOGIC_THIN,
  logicBandOf, logicDivergence, logicSplitFor, parseLogicPct,
  type LogicVoter,
} from "./logicSplit";
import { TYPE_SPLIT_SMALL, TYPE_THIN } from "./typeSplit";

/** n scored voters in one band's territory, all on one option. */
const many = (pct: number | null, optionIdx: number, n: number, tag = "u"): LogicVoter[] =>
  Array.from({ length: n }, (_, i) => ({ uid: `${tag}${i}`, optionIdx, logic: pct }));

describe("parseLogicPct — the defensive read", () => {
  it("reads the verified percentile, rounded and clamped", () => {
    expect(parseLogicPct({ logic: { pctile: 63 } })).toBe(63);
    expect(parseLogicPct({ logic: { pctile: 63.6 } })).toBe(64);
    expect(parseLogicPct({ logic: { pctile: 400 } })).toBe(100);
    expect(parseLogicPct({ logic: { pctile: -3 } })).toBe(0);
  });

  it("returns null for every shape that is not a result", () => {
    expect(parseLogicPct(null)).toBeNull();
    expect(parseLogicPct("logic")).toBeNull();
    expect(parseLogicPct({})).toBeNull();
    expect(parseLogicPct({ logic: null })).toBeNull();
    expect(parseLogicPct({ logic: { pctile: "high" } })).toBeNull();
    expect(parseLogicPct({ logic: { pctile: NaN } })).toBeNull();
    // The four instruments beside it are not a logic result.
    expect(parseLogicPct({ big5: { dims: [{ id: "O", value: 80 }] } })).toBeNull();
  });
});

describe("logicBandOf — quarters, and the untested are not a band", () => {
  it("cuts at the quartile boundaries, lo inclusive", () => {
    expect(logicBandOf(100)).toBe("top");
    expect(logicBandOf(75)).toBe("top");
    expect(logicBandOf(74)).toBe("upper");
    expect(logicBandOf(50)).toBe("upper");
    expect(logicBandOf(49)).toBe("lower");
    expect(logicBandOf(25)).toBe("lower");
    expect(logicBandOf(24)).toBe("bottom");
    expect(logicBandOf(0)).toBe("bottom");
  });

  it("reads null AND a missing field as untested, never as bottom", () => {
    // A row that never carried the field (a caller predating D227) must
    // thin the basis, not file its person in the bottom quarter.
    expect(logicBandOf(null)).toBeNull();
    expect(logicBandOf(undefined as unknown as number)).toBeNull();
    expect(logicBandOf(NaN)).toBeNull();
  });
});

describe("the floors are the type cut's, literally", () => {
  it("shares one number with typeSplit rather than a tuned-apart copy", () => {
    expect(LOGIC_THIN).toBe(TYPE_THIN);
    expect(LOGIC_SPLIT_SMALL).toBe(TYPE_SPLIT_SMALL);
  });
});

describe("logicSplitFor — the honesty properties", () => {
  it("keeps bands in scale order however popular each is", () => {
    // Bottom quarter outnumbers top — a popularity sort would lead with
    // it, and the chips would stop reading as a scale.
    const split = logicSplitFor(
      [...many(90, 0, LOGIC_THIN, "t"), ...many(10, 1, LOGIC_THIN + 5, "b")],
      2,
    );
    expect(split.ranked.map((r) => r.band)).toEqual(["top", "bottom"]);
  });

  it("counts the untested into sampleN and never into a band", () => {
    const split = logicSplitFor(
      [...many(80, 0, 3, "s"), ...many(null, 1, 4, "n")],
      2,
    );
    expect(split.sampleN).toBe(7);
    expect(split.scoredN).toBe(3);
    // No fifth band appeared to hold them.
    const bandIds = LOGIC_BANDS.map((b) => b.id);
    for (const r of [...split.ranked, ...split.thin]) {
      expect(bandIds).toContain(r.band);
    }
  });

  it("ranks at LOGIC_THIN, lists thinner bands with counts, names the absent", () => {
    const split = logicSplitFor(
      [...many(90, 0, LOGIC_THIN, "r"), ...many(60, 0, LOGIC_THIN - 1, "t")],
      2,
    );
    expect(split.ranked.map((r) => r.band)).toEqual(["top"]);
    expect(split.thin.map((r) => r.band)).toEqual(["upper"]);
    expect(split.absent).toEqual(["lower", "bottom"]);
  });

  it("n is the column sum — a scored voter in no column is not claimed", () => {
    const rows: LogicVoter[] = [...many(90, 0, LOGIC_THIN, "a"), { uid: "x", optionIdx: 99, logic: 90 }];
    const split = logicSplitFor(rows, 2);
    // scoredN counts the person; the band's n counts what the bars show.
    expect(split.scoredN).toBe(LOGIC_THIN + 1);
    expect(split.ranked[0].n).toBe(LOGIC_THIN);
  });

  it("withholds shares under LOGIC_SPLIT_SMALL and grants them at it", () => {
    expect(logicSplitFor(many(80, 0, LOGIC_SPLIT_SMALL - 1), 2).enough).toBe(false);
    expect(logicSplitFor(many(80, 0, LOGIC_SPLIT_SMALL), 2).enough).toBe(true);
  });

  it("marks the viewer's band from their own percentile", () => {
    expect(logicSplitFor([], 2, 88).mine).toBe("top");
    expect(logicSplitFor([], 2, null).mine).toBeNull();
  });
});

describe("logicDivergence — the type cut's arithmetic, reused", () => {
  it("refuses a thin band and reads a divergent one", () => {
    const split = logicSplitFor(
      [...many(90, 0, 30, "t"), ...many(10, 1, 30, "b")],
      2,
    );
    const top = split.ranked.find((r) => r.band === "top")!;
    const d = logicDivergence(top, split.overall);
    // Top quarter went all-in on option 0 against a 50/50 scored sample.
    expect(d).toEqual({ optionIdx: 0, gap: 50, higher: true });
    expect(logicDivergence({ band: "upper", label: "Upper middle", n: 2, counts: [2, 0] }, split.overall)).toBeNull();
  });
});

// The report builder's pure half (D229) — every section's arithmetic and
// the rendered document's honesty sentences, tested without a credential
// anywhere near them. The I/O shell (build-report.mjs) is deliberately
// thin enough to have nothing worth mocking: what it fetches is decided
// by firestore.rules, and what it computes is decided here.
import { describe, expect, it } from "vitest";
import {
  bucketByDay, cramersV, cosineNeighbors, csv, decodeDoc, dimRows,
  flowRows, logicBandsFor, logicBandOf, MIN_SHARED, renderReport,
} from "./report-lib.mjs";

describe("decodeDoc — the REST wire, same shape the scorecard reads", () => {
  it("decodes nested maps, numbers and arrays", () => {
    expect(decodeDoc({
      total: { integerValue: "11" },
      counts: { mapValue: { fields: { 0: { integerValue: "9" } } } },
      tags: { arrayValue: { values: [{ stringValue: "a" }] } },
    })).toEqual({ total: 11, counts: { 0: 9 }, tags: ["a"] });
  });
});

describe("bucketByDay — gaps are real, never zero-filled", () => {
  it("buckets by UTC day and sorts ascending", () => {
    const days = bucketByDay([
      "2026-08-20T23:59:00Z", "2026-08-22T01:00:00Z", "2026-08-20T04:00:00Z",
    ]);
    expect(days).toEqual([
      { day: "2026-08-20", n: 2 },
      { day: "2026-08-22", n: 1 },
    ]);
    // 2026-08-21 is ABSENT, not zero — the renderer draws the gap.
    expect(days.some((d) => d.day === "2026-08-21")).toBe(false);
  });

  it("drops junk stamps rather than minting junk days", () => {
    expect(bucketByDay(["not a date", null, "", "2026-08-20T00:00:00Z"]))
      .toEqual([{ day: "2026-08-20", n: 1 }]);
  });
});

describe("flowRows — the D226 matrix, biggest move first", () => {
  it("flattens and labels the from→to cells", () => {
    const rows = flowRows({ 1: { 0: 3, 2: 1 }, 0: { 1: 5 } }, ["A", "B", "C"]);
    expect(rows.map((r) => [r.fromLabel, r.toLabel, r.n])).toEqual([
      ["A", "B", 5], ["B", "A", 3], ["B", "C", 1],
    ]);
  });

  it("is empty for a question nobody rethought", () => {
    expect(flowRows(undefined, ["A", "B"])).toEqual([]);
  });
});

describe("dimRows — exact cells, absent means zero", () => {
  it("densifies each bucket to the option count", () => {
    const rows = dimRows(
      { ageBand: { "25-34": { 0: 4 }, "35-44": { 0: 1, 1: 2 } } },
      "ageBand", 2,
    );
    expect(rows).toEqual([
      { bucket: "25-34", n: 4, counts: [4, 0] },
      { bucket: "35-44", n: 3, counts: [1, 2] },
    ]);
  });
});

describe("the logic quarters — the D227 twin, same boundaries", () => {
  it("bands at the same quartile lines as data/logicSplit.ts", () => {
    expect(logicBandOf(75)).toBe("top");
    expect(logicBandOf(74)).toBe("upper");
    expect(logicBandOf(50)).toBe("upper");
    expect(logicBandOf(25)).toBe("lower");
    expect(logicBandOf(24)).toBe("bottom");
    expect(logicBandOf(null)).toBeNull();
    expect(logicBandOf(undefined)).toBeNull();
  });

  it("the untested thin the basis and are never a band", () => {
    const split = logicBandsFor(
      [{ optionIdx: 0, logic: 90 }, { optionIdx: 1, logic: null }, { optionIdx: 1, logic: 10 }],
      2,
    );
    expect(split.sampleN).toBe(3);
    expect(split.scoredN).toBe(2);
    expect(split.bands.map((b) => b.band)).toEqual(["top", "bottom"]);
  });
});

describe("cosineNeighbors — the fit's own structure", () => {
  const q = {
    target: { v: [1, 0], n: 40 },
    same: { v: [2, 0], n: 30 },     // same direction, cos 1
    ortho: { v: [0, 3], n: 20 },    // orthogonal, cos 0
    against: { v: [-1, 0], n: 10 }, // opposite, cos -1
  };
  it("ranks by cosine and never returns the question itself", () => {
    const near = cosineNeighbors(q, "target", 2);
    expect(near.map((n) => n.qid)).toEqual(["same", "ortho"]);
    expect(near[0].cos).toBeCloseTo(1);
  });
  it("returns null for a question the fit never folded", () => {
    expect(cosineNeighbors(q, "unknown")).toBeNull();
  });
});

describe("cramersV — association that refuses thin bases", () => {
  const votes = (pairs) => {
    const a = new Map();
    const b = new Map();
    pairs.forEach(([x, y], i) => { a.set(`u${i}`, x); b.set(`u${i}`, y); });
    return [a, b];
  };

  it("reads perfect association as 1", () => {
    const [a, b] = votes(Array.from({ length: MIN_SHARED }, (_, i) => [i % 2, i % 2]));
    expect(cramersV(a, b)?.v).toBeCloseTo(1);
  });

  it("reads independence as ~0", () => {
    // Every combination equally often — no association by construction.
    const [a, b] = votes(Array.from({ length: MIN_SHARED * 4 }, (_, i) => [i % 2, Math.floor(i / 2) % 2]));
    expect(cramersV(a, b)?.v).toBeCloseTo(0, 5);
  });

  it("refuses under MIN_SHARED rather than scoring noise", () => {
    const [a, b] = votes(Array.from({ length: MIN_SHARED - 1 }, (_, i) => [i % 2, i % 2]));
    expect(cramersV(a, b)).toBeNull();
  });

  it("refuses a constant column — nothing to associate against", () => {
    const [a, b] = votes(Array.from({ length: MIN_SHARED }, (_, i) => [i % 2, 0]));
    expect(cramersV(a, b)).toBeNull();
  });

  it("only counts SHARED voters", () => {
    const a = new Map([["u1", 0], ["u2", 1], ["lonely", 0]]);
    const b = new Map([["u1", 0], ["u2", 1]]);
    // Under the floor either way, but the shared set is what gets sized.
    expect(cramersV(a, b)).toBeNull();
  });
});

describe("csv — escaping that survives a spreadsheet", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csv([["a,b", 'say "hi"', "line\nbreak"]]))
      .toBe('"a,b","say ""hi""","line\nbreak"\n');
  });
});

describe("renderReport — a self-contained document that states its bases", () => {
  const MODEL = {
    qid: "q_test", prompt: "Cats or dogs?", options: ["Cats", "Dogs"],
    generatedOn: "2026-08-22",
    counts: [9, 2], total: 11,
    series: [{ day: "2026-08-20", n: 11 }],
    flows: [{ from: 1, to: 0, n: 1, fromLabel: "Dogs", toLabel: "Cats" }],
    dims: [{ dim: "ageBand", rows: [{ bucket: "25-34", n: 6, counts: [6, 0] }] }],
    dimLabels: { ageBand: "Age" },
    logic: { bands: [{ band: "top", label: "Top quarter", n: 3, counts: [3, 0] }], sampleN: 11, scoredN: 3 },
    neighbors: [{ qid: "q_core", prompt: "Tea or coffee?", cos: 0.8, n: 40 }],
    associations: { scored: [{ qid: "q_core", prompt: "Tea or coffee?", v: 0.5, n: 44 }], thin: 2 },
    voterRows: 11, capNote: "",
  };

  it("carries every section, its numbers and its basis sentences", () => {
    const html = renderReport(MODEL);
    expect(html).toContain("Cats or dogs?");
    expect(html).toContain("The split");
    expect(html).toContain("Second thoughts");
    expect(html).toContain("moves, not people");
    expect(html).toContain("quarters of its percentile");
    expect(html).toContain("Of 11 voters read, 3 carry a verified score");
    expect(html).toContain("Tea or coffee?");
    expect(html).toContain("2 pair(s) had fewer than");
    expect(html).toContain("derivable from data any signed-in user");
  });

  it("says why an empty section is empty instead of hiding it", () => {
    const html = renderReport({
      ...MODEL, counts: [0, 0], total: 0, series: [], flows: [],
      dims: [{ dim: "ageBand", rows: [] }], dimLabels: { ageBand: "Age" },
      logic: { bands: [], sampleN: 0, scoredN: 0 },
      neighbors: null, associations: null, voterRows: 0,
    });
    expect(html).toContain("Nobody has answered this question yet");
    expect(html).toContain("Nobody has changed their answer");
    expect(html).toContain("No voter here carries a verified logic score");
    expect(html).toContain("fills in as the question collects answers");
  });

  it("is self-contained — no external URL anywhere in the document", () => {
    const html = renderReport(MODEL);
    expect(html).not.toMatch(/src=|href=|https?:\/\//);
  });

  it("escapes hostile prompts rather than rendering them", () => {
    const html = renderReport({ ...MODEL, prompt: '<script>alert("x")</script>' });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});

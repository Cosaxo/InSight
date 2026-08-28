// report.test.mjs — the report builder's gates (PAID-PLAN §2, §9.2 v1).
//
// Three kinds of assertion, each holding a different failure shut:
//
//   1. TWIN PINS. report-lib duplicates three client definitions whose
//      owning modules cannot load under node (their import chains touch
//      window/live.ts): voters.ts' surface list, traitDims.ts' bands,
//      similarity.ts' parseLogicPct. The first two are pinned by reading
//      the SOURCE (the pulse.test.mjs pattern); the parse is compared
//      against the real function, imported directly — similarity.ts is
//      pure, so here it CAN load.
//   2. THE READ-SET GUARD — the §2 rule as a test: a collection outside
//      REPORT_READ_SET throws by name before any request is made. The
//      e2e's §7g asserts the same property over a real build.
//   3. THE FOLDS AND THE PAGE — the arithmetic on fixtures, and the
//      honesty states the design mandates rendered verbatim (an empty
//      bucket "none yet — still listed", a thin cell "shown exactly",
//      edits counted as MOVES, not people).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseLogicPct as realParseLogicPct, parseTestResults as realParseTestResults } from "../src/v2/data/similarity";
import {
  LOGIC_BANDS, NEIGHBOUR_MIN_SHARED, REPORT_READ_SET, WORLD_ANSWER_SURFACES,
  assertReadable, buildReportData, condModes, cramersV, dimRowsFromBy,
  axisBandIndex, axisBandLabels, axisCut, dimRowsFromRoll, editNet,
  editPairs, logicBandOf, logicCut, makeReader, parseLogicPct,
  parseTestDims, renderCsvs, renderReportHtml, seriesFromRoll, toCsv,
  totalMoves,
} from "./report-lib.mjs";

const srcOf = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

describe("twin pins — the client sources the builder mirrors", () => {
  it("WORLD_ANSWER_SURFACES matches voters.ts", () => {
    const m = srcOf("src/v2/data/voters.ts")
      .match(/export const WORLD_ANSWER_SURFACES = \[([^\]]+)\]/);
    expect(m, "voters.ts no longer exports the surface list where this pin looks").toBeTruthy();
    const theirs = [...m[1].matchAll(/"([a-z]+)"/g)].map((x) => x[1]);
    expect(WORLD_ANSWER_SURFACES).toEqual(theirs);
  });

  // Repointed at D330: `data/logicSplit.ts` was deleted with the sampled
  // cut it served, and `data/traitDims.ts` is the client's single source
  // for the quarters now. Same pin, same shape, one file over — the
  // report still runs under plain node and still cannot import
  // TypeScript, so a source pin remains the only twin available.
  it("LOGIC_BANDS matches traitDims.ts, ids, labels and floors", () => {
    const m = srcOf("src/v2/data/traitDims.ts")
      .match(/export const LOGIC_BANDS = \[([\s\S]*?)\] as const;/);
    expect(m, "traitDims.ts no longer defines LOGIC_BANDS where this pin looks").toBeTruthy();
    const theirs = [...m[1].matchAll(/\{ id: "(\w+)", label: "([^"]+)", lo: (\d+) \}/g)]
      .map((x) => ({ id: x[1], label: x[2], lo: Number(x[3]) }));
    expect(theirs.length).toBe(4);
    expect(LOGIC_BANDS).toEqual(theirs);
  });

  it("logicBandOf keeps the type-test guard: junk is untested, never bottom", () => {
    expect(logicBandOf(null)).toBe(null);
    expect(logicBandOf(undefined)).toBe(null);
    expect(logicBandOf(NaN)).toBe(null);
    expect(logicBandOf("80")).toBe(null);
    expect(logicBandOf(100)).toBe("top");
    expect(logicBandOf(75)).toBe("top");
    expect(logicBandOf(74.9)).toBe("upper");
    expect(logicBandOf(50)).toBe("upper");
    expect(logicBandOf(25)).toBe("lower");
    expect(logicBandOf(0)).toBe("bottom");
    expect(logicBandOf(-5)).toBe("bottom");
  });

  it("parseLogicPct agrees with similarity.ts on every shape", () => {
    const cases = [
      null, undefined, 0, "x", {}, { logic: null }, { logic: 7 },
      { logic: { pctile: 61.4 } }, { logic: { pctile: "88" } },
      { logic: { pctile: "junk" } }, { logic: { pctile: -3 } },
      { logic: { pctile: 250 } }, { logic: { pctile: Infinity } },
      { logic: { pct: 50 } },
    ];
    for (const c of cases) expect(parseLogicPct(c), JSON.stringify(c)).toBe(realParseLogicPct(c));
  });
});

describe("the read-set guard", () => {
  it("refuses the collections a report must never see, by name", () => {
    // The private half of the aggregate pipeline and the ledger are the
    // sharpest cases: readable to nobody, and exactly where a "just read
    // the working state" shortcut would reach.
    expect(() => assertReadable("v2_aggs_private")).toThrow(/refused collection "v2_aggs_private"/);
    expect(() => assertReadable("v2_agg_events")).toThrow(/REPORT_READ_SET/);
    expect(() => assertReadable("v2_logic_attempts")).toThrow();
    for (const name of REPORT_READ_SET) expect(() => assertReadable(name)).not.toThrow();
  });

  it("every collection literal in report-lib is in the set — no quiet extra read", () => {
    // The §2 sentence made structural: a new reader method naming a new
    // collection fails here until the set (and the decision that widens
    // it) moves too.
    const src = srcOf("scripts/report-lib.mjs");
    const literals = [...src.matchAll(/"(v2_[a-z_]+|answers)"/g)].map((m) => m[1]);
    expect(literals.length).toBeGreaterThan(0);
    for (const name of literals) {
      if (name === "v2_users") continue; // path segment of the answers group too
      expect(REPORT_READ_SET, `"${name}" is read but not declared`).toContain(name);
    }
  });

  it("counts what it touched, so §7g can hold a real build to the list", async () => {
    const reader = makeReader({
      db: {},
      doc: () => ({}),
      getDoc: async () => ({ exists: () => true, id: "q", data: () => ({}) }),
    });
    await reader.getQuestion("q");
    expect(reader.stats).toEqual({ reads: { v2_questions: 1 }, queries: 1 });
  });
});

describe("the folds", () => {
  const edits = { 1: { 0: 3 }, 0: { 2: 1, 1: 2 } };

  it("editPairs lists every nonzero cell, biggest move first", () => {
    expect(editPairs(edits)).toEqual([
      { from: 1, to: 0, n: 3 },
      { from: 0, to: 1, n: 2 },
      { from: 0, to: 2, n: 1 },
    ]);
    expect(editPairs(undefined)).toEqual([]);
    expect(editPairs({ 1: { 0: 0 } })).toEqual([]);
  });

  it("editNet is inflow minus outflow per option, and moves total", () => {
    expect(editNet(edits, 3)).toEqual([3 - 3, 2 - 3, 1]);
    expect(totalMoves(edits)).toBe(6);
  });

  it("seriesFromRoll buckets by UTC day, oldest first, split by current option", () => {
    const roll = [
      { optionIdx: 0, answeredAt: new Date("2026-08-21T23:59:00Z") },
      { optionIdx: 1, answeredAt: new Date("2026-08-22T00:01:00Z") },
      { optionIdx: 0, answeredAt: new Date("2026-08-22T12:00:00Z") },
      { optionIdx: 0, answeredAt: null },
    ];
    expect(seriesFromRoll(roll, 2)).toEqual([
      { day: "2026-08-21", counts: [1, 0], t: 1 },
      { day: "2026-08-22", counts: [1, 1], t: 2 },
    ]);
  });

  it("dimRowsFromBy lists the closed vocab's empty buckets and appends strays", () => {
    const d = dimRowsFromBy({ "25-34": { 0: 4, 1: 1 }, odd: { 0: 1 } }, 2, 9, ["18-24", "25-34"]);
    expect(d.rows).toEqual([
      { label: "18-24", counts: [0, 0], t: 0 },
      { label: "25-34", counts: [4, 1], t: 5 },
      { label: "odd", counts: [1, 0], t: 1 },
    ]);
    expect(d.shared).toBe(6);
    expect(d.notShared).toBe(3);
  });

  it("dimRowsFromBy without a vocab sorts observed buckets by size", () => {
    const d = dimRowsFromBy({ "Oslo, NO": { 0: 1 }, "Bergen, NO": { 0: 3 } }, 2, 4, undefined);
    expect(d.rows.map((r) => r.label)).toEqual(["Bergen, NO", "Oslo, NO"]);
  });

  it("dimRowsFromRoll folds a snapshot anchor the server publishes no cells for", () => {
    const roll = [
      { optionIdx: 0, anchors: { profession: "Tech" } },
      { optionIdx: 1, anchors: { profession: "Tech" } },
      { optionIdx: 0, anchors: {} },
    ];
    const d = dimRowsFromRoll(roll, "profession", 2);
    expect(d.rows).toEqual([{ label: "Tech", counts: [1, 1], t: 2 }]);
    expect(d.notShared).toBe(1);
  });

  it("logicCut keeps every band listed, untested last, never dropped", () => {
    const roll = [{ uid: "a", optionIdx: 0 }, { uid: "b", optionIdx: 1 }, { uid: "c", optionIdx: 0 }];
    const cut = logicCut(roll, { a: { logic: 80 }, b: { logic: 10 }, c: { logic: null } }, 2);
    expect(cut.verified).toBe(2);
    expect(cut.rows.map((r) => [r.label, r.t])).toEqual([
      ["Top quarter", 1], ["Upper middle", 0], ["Lower middle", 0],
      ["Bottom quarter", 1], ["Untested", 1],
    ]);
  });

  it("cramersV reads 1 on a perfect 2×2 and ~0 on independence", () => {
    const perfect = [[0, 0], [0, 0], [1, 1], [1, 1]];
    expect(cramersV(perfect, 2, 2)).toBeCloseTo(1);
    const indep = [[0, 0], [0, 1], [1, 0], [1, 1]];
    expect(cramersV(indep, 2, 2)).toBeCloseTo(0);
  });

  it("condModes states each side's mode with its own n, null when nobody joins", () => {
    const pairs = [[0, 1], [0, 1], [0, 0], [1, 0]];
    expect(condModes(pairs, 2, ["L", "R"])).toEqual([
      { label: "R", pct: 67, n: 3 },
      { label: "L", pct: 100, n: 1 },
    ]);
    expect(condModes([], 2, ["L", "R"])).toEqual([null, null]);
  });

  it("toCsv escapes commas, quotes and newlines, CRLF rows, BOM for Excel", () => {
    expect(toCsv([["a,b", 'say "hi"', "two\nlines"], [1, 2, 3]]))
      .toBe('﻿"a,b","say ""hi""","two\nlines"\r\n1,2,3\r\n');
  });

  it("toCsv neutralises formula-injection openers in user-controlled cells", () => {
    // A display name is any 60-char string; a cell opening with = + - @
    // executes in Excel/Sheets on the buyer's machine.
    const out = toCsv([["=HYPERLINK(\"http://evil\")", "+SUM(A1)", "-2+3", "@cmd", "safe"]]);
    expect(out).toContain("'=HYPERLINK");
    expect(out).toContain("'+SUM(A1)");
    expect(out).toContain("'-2+3");
    expect(out).toContain("'@cmd");
    expect(out).toContain(",safe");
    expect(out).not.toMatch(/(^|,)=/m);
  });
});

// A reader-shaped fixture: buildReportData never touches Firebase, only
// this interface — the real wiring is e2e §7g's half.
const fakeReader = (over = {}) => ({
  stats: { reads: {}, queries: 0 },
  getQuestion: async () => ({
    prompt: "Night buses all night?", options: ["All night", "As now"],
    sponsor: { buyer: "Ruter" }, until: "2026-08-30",
  }),
  getAgg: async () => ({ counts: { 0: 5, 1: 2 }, total: 7, by: { ageBand: { "25-34": { 0: 5, 1: 2 } } }, edits: { 1: { 0: 1 } } }),
  walkRoll: async () => [
    { uid: "u1", optionIdx: 0, anchors: { profession: "Tech" }, answeredAt: new Date("2026-08-20T10:00:00Z"), editedAt: null },
    { uid: "u2", optionIdx: 1, anchors: {}, answeredAt: new Date("2026-08-21T10:00:00Z"), editedAt: new Date("2026-08-21T11:00:00Z") },
  ],
  getProfiles: async () => ({
    u1: {
      name: "Åse", logic: 91,
      // The Enthusiast's own signature — the matcher must land on it.
      tests: { big5: { dims: [{ id: "O", value: 88 }, { id: "C", value: 40 }, { id: "E", value: 75 }, { id: "A", value: 55 }, { id: "N", value: 45 }] } },
    },
    u2: { name: "", logic: null, tests: null },
  }),
  getAnswersFor: async () => ({}),
  listPatternCandidates: async () => [{ id: "daily-001", prompt: "Early bird?", options: ["Yes", "No"] }],
  ...over,
});
const VOCAB = { dims: ["ageBand"], byDim: { ageBand: ["18-24", "25-34"] } };

describe("assembly and the page", () => {
  it("assembles totals, the roll, the matrix and the floors", async () => {
    const data = await buildReportData(fakeReader(), { qid: "pd01", vocab: VOCAB, now: new Date("2026-08-22T12:00:00Z") });
    expect(data.total).toBe(7);
    expect(data.roll[0]).toMatchObject({ name: "Åse", optionIdx: 0, logicBand: "top" });
    expect(data.edits).toMatchObject({ moves: 1, net: [1, -1] });
    // one candidate, zero joined answers — under the floor, so absent
    expect(data.neighbours).toEqual([]);
    expect(data.series.map((d) => d.t)).toEqual([1, 1]);
  });

  it("renders the design's honesty states verbatim", async () => {
    const data = await buildReportData(fakeReader(), { qid: "pd01", vocab: VOCAB, now: new Date("2026-08-22T12:00:00Z") });
    const html = renderReportHtml(data);
    expect(html).toContain("none yet — still listed"); // 18-24, empty but listed
    expect(html).toContain("people — shown exactly"); // 7 answers is thin
    expect(html).toContain("asked by Ruter"); // the PAID band
    expect(html).toContain("moves, not people"); // D226's semantics, not the mock's
    expect(html).toContain(`${NEIGHBOUR_MIN_SHARED}-shared-voter floor`); // absence stated
    expect(html).not.toMatch(/src="http|href="http/); // self-contained
  });

  it("keeps the PAID band off an unsponsored question's report", async () => {
    const reader = fakeReader({
      getQuestion: async () => ({ prompt: "Early bird?", options: ["Yes", "No"] }),
    });
    const html = renderReportHtml(await buildReportData(reader, { qid: "daily-001", vocab: VOCAB }));
    expect(html).not.toContain(">PAID<");
    expect(html).toContain("a question from the public bank");
  });

  it("writes the bundle's three CSVs with the roll's own columns", async () => {
    const data = await buildReportData(fakeReader(), { qid: "pd01", vocab: VOCAB });
    const csvs = renderCsvs(data);
    expect(csvs.roll.split("\r\n")[0]).toBe(
      "﻿name,option,profession,answeredAt,editedAt,logicBand,Big Five type,Politics type,Values type,Social type",
    );
    expect(csvs.roll).toContain("Åse,All night,Tech");
    expect(csvs.roll).toContain("The Enthusiast,untested,untested,untested");
    expect(csvs.edits.trim().split("\r\n")).toEqual(["from,to,moves", "As now,All night,1"]);
    expect(csvs.series.trim().split("\r\n")[0]).toBe("day,All night,As now,total");
  });

  it("cuts the roll by the app's own matcher, untested listed as a row", async () => {
    const data = await buildReportData(fakeReader(), { qid: "pd01", vocab: VOCAB });
    const big5 = data.typeCuts.find((c) => c.kind === "big5");
    expect(big5.tested).toBe(1);
    const hit = big5.rows.find((r) => r.label === "The Enthusiast");
    expect(hit).toMatchObject({ counts: [1, 0], t: 1 });
    expect(big5.rows[big5.rows.length - 1]).toMatchObject({ label: "Untested", t: 1 });
    // every named type stays listed, the empty ones at zero
    expect(big5.rows.length).toBeGreaterThan(5);
    const html = renderReportHtml(data);
    expect(html).toContain("Big Five — type");
    expect(html).toContain("Politics — type");
    expect(html).toContain("tested 1");
  });

  it("axis bands mirror the result card's own thresholds, centred on the baseline", () => {
    // avg 60 (big5 O's authored baseline): the |dev| >= 18 / >= 8 reading.
    expect(axisBandIndex(42, 60)).toBe(0); // dev −18 — a defining lean
    expect(axisBandIndex(43, 60)).toBe(1); // −17 — a lean
    expect(axisBandIndex(52, 60)).toBe(1); // −8 — still a lean
    expect(axisBandIndex(53, 60)).toBe(2); // −7 — Between
    expect(axisBandIndex(67, 60)).toBe(2);
    expect(axisBandIndex(68, 60)).toBe(3); // +8
    expect(axisBandIndex(78, 60)).toBe(4); // +18
    // a missing baseline centres on 50, the matcher's own fallback
    expect(axisBandIndex(58, undefined)).toBe(3);
    expect(axisBandIndex(68, undefined)).toBe(4);
    // a skewed baseline moves the bands with it (A averages 65)
    expect(axisBandIndex(65, 65)).toBe(2);
    expect(axisBandIndex(47, 65)).toBe(0);
    expect(axisBandLabels("practical", "curious")).toEqual(
      ["Practical", "Leans practical", "Between", "Leans curious", "Curious"],
    );
  });

  it("axisCut files each voter by their own axis, untested as a full row", async () => {
    const data = await buildReportData(fakeReader(), { qid: "pd01", vocab: VOCAB });
    const cut = axisCut(
      (await fakeReader().walkRoll()), await fakeReader().getProfiles(), "big5", "O", 2,
    );
    // Åse's O = 88 against the authored 60 is a defining lean high
    expect(cut.tested).toBe(1);
    expect(cut.rows[4]).toMatchObject({ label: "Curious", counts: [1, 0], t: 1 });
    expect(cut.rows[5]).toMatchObject({ label: "Untested", t: 1 });
    expect(cut.rows.reduce((a, r) => a + r.t, 0)).toBe(2);
    // and the page draws every big5 axis under the type dim
    const big5 = data.typeCuts.find((c) => c.kind === "big5");
    expect(big5.axes.map((a) => a.label)).toEqual(
      ["Openness", "Conscientiousness", "Extraversion", "Agreeableness", "Sensitivity"],
    );
    const html = renderReportHtml(data);
    expect(html).toContain("Big Five · Openness");
    expect(html).toContain("Leans practical");
  });

  it("parseTestDims mirrors similarity.parseTestResults, shape for shape", () => {
    const cases = [
      null, 7, {}, { big5: null }, { big5: { dims: "x" } },
      { big5: { dims: [{ id: "O", value: 88.6 }, { id: "", value: 4 }, { id: "C", value: "41" }, { id: "N", value: "junk" }, null] } },
      { political: { dims: [{ id: "econ", value: -5 }, { id: "auth", value: 250 }] } },
      { big5: { dims: Array.from({ length: 20 }, (_, i) => ({ id: "d" + i, value: i })) } },
      // a duplicated dim id must collapse LAST-WINS on both sides — fed
      // twice to the matcher it would double-weight the dim and could
      // type a crafted profile differently here than in the app
      { big5: { dims: [{ id: "O", value: 100 }, { id: "C", value: 50 }, { id: "O", value: 0 }] } },
    ];
    for (const raw of cases) {
      for (const kind of ["big5", "political"]) {
        const mine = parseTestDims(raw, kind);
        const theirs = realParseTestResults(raw, [kind]);
        const mineMap = mine ? Object.fromEntries(mine.map((d) => [d.id, d.value])) : null;
        const theirsMap = theirs ? theirs[kind] ?? null : null;
        expect(mineMap, JSON.stringify({ raw, kind })).toEqual(theirsMap);
        // …and the ORDER, which fromEntries would erase: the matcher
        // sees an array, so first-seen position matters on both sides.
        if (mine) expect(mine.map((d) => d.id), JSON.stringify({ raw, kind })).toEqual(Object.keys(theirsMap));
      }
    }
  });
});

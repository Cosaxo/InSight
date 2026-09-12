// The generated state page.
//
// A page that nobody maintains is only worth having if its parsers are
// right, and each one below has a way of going quietly wrong: a checkbox
// regex that stops matching reports an empty queue, a decision counter
// that miscounts amendments inflates the record total, and a gate counter
// that reads the wrong prefix reports a tree that is watching more than it
// is. All three failures LOOK like good news on the page, which is the
// argument for testing them rather than reading them.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildState, checkboxes, decisionCounts, gateCount } from "./state.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

describe("checkboxes", () => {
  it("counts open and ticked rows apart", () => {
    const md = "- [ ] a\n- [x] b\n- [X] c\n- [ ] d\n";
    expect(checkboxes(md)).toEqual({ open: 2, done: 2, total: 4 });
  });

  it("ignores a checkbox that is not at the start of a line", () => {
    // The lists carry prose between rows, and a sentence mentioning
    // "- [ ]" inside a paragraph is not an outstanding item.
    expect(checkboxes("some prose - [ ] not a row\n- [ ] a row\n").open).toBe(1);
  });

  it("reads the real lists as non-empty", () => {
    // The vacuity floor, and the one that matters: a regex that stops
    // matching would report a cleared queue, which is the most flattering
    // possible failure. Asserted against the real files, so a format
    // change to either list fails here rather than on the page.
    expect(checkboxes(read("docs/OWNER-LIST.md")).total).toBeGreaterThan(50);
    expect(checkboxes(read("docs/MERGE-LIST.md")).total).toBeGreaterThan(0);
  });
});

describe("decisionCounts", () => {
  it("separates records, amendments and dated ids", () => {
    const md = [
      "## D1 · a",
      "## D7 amendment (2026-08-03) · b",
      "## D437 · c",
      "## D-2026-09-09a · d",
      "## D-2026-09-09b adoption (2026-09-09) · e",
    ].join("\n");
    // Three records (D1, D437, D-2026-09-09a), two follow-ons.
    expect(decisionCounts(md)).toEqual({ records: 3, amendments: 2, dated: 2 });
  });

  it("counts the real file, and finds the dated records that exist", () => {
    const d = decisionCounts(read("docs/DECISIONS.md"));
    expect(d.records).toBeGreaterThan(400);
    // D-2026-09-09e introduced the dated scheme and is one of its own
    // first users; if this is 0 the parser has stopped seeing them.
    expect(d.dated).toBeGreaterThan(0);
  });
});

describe("gateCount", () => {
  it("counts only check: scripts", () => {
    const pkg = JSON.stringify({ scripts: { "check:a": "", "check:b": "", "build:c": "", test: "" } });
    expect(gateCount(pkg)).toBe(2);
  });

  it("agrees with the real package.json at a plausible size", () => {
    expect(gateCount(read("package.json"))).toBeGreaterThan(30);
  });
});

describe("buildState", () => {
  const args = () => ({
    pulse: {
      guard: { state: "ok", burnUsd: 28.25, allowanceUsd: 50, measuredActives: 2, measuredOn: "2026-08-25" },
      program: { state: "ok", usdPerDay: 390, allowanceUsdPerDay: 450, measuredOn: "2026-09-03", ageDays: 6 },
      pipeline: { archive: { total: 1298, unpromoted: 32 }, deck: { runwayDays: 99 }, scorecard: { totalAnswers: 107 } },
      instrumentation: { functionCount: 42, alertedCount: 4 },
      cost: { seededBankDocs: 1298 },
    },
    ownerMd: "- [ ] a\n- [x] b\n",
    mergeMd: "- [ ] c\n",
    worklistMd: "- [x] d\n",
    decisionsMd: "## D1 · a\n## D-2026-09-09a · b\n",
    pkg: JSON.stringify({ scripts: { "check:x": "" } }),
    today: "2026-09-09",
  });

  it("puts both bills on the page, in the same table", () => {
    // The whole point of the page: the two numbers are ~410x apart and
    // were never printed together. A version that drops either is the
    // status quo with extra steps.
    const md = buildState(args());
    expect(md).toMatch(/Running the app.*\$28\.25 \/ month/);
    expect(md).toMatch(/Building the app.*\$390 \/ day/);
  });

  it("prints answers counted, which is what the cost is relative to", () => {
    expect(buildState(args())).toMatch(/Answers counted \| 107/);
  });

  it("draws a missing figure as a gap, never as a zero", () => {
    // D1's rule applied to a generated page: an absent measurement must
    // not render as 0, which reads as a measurement that came back empty.
    const a = args();
    a.pulse.pipeline.scorecard.totalAnswers = null;
    a.pulse.program = { state: "unmeasured", allowanceUsdPerDay: 450 };
    const md = buildState(a);
    expect(md).toMatch(/Answers counted \| —/);
    expect(md).toMatch(/Building the app.*—.*not measured/);
    expect(md).not.toMatch(/Building the app.*\$0/);
  });

  it("stamps the day it was generated", () => {
    // The page cannot go stale in content — every figure is read at
    // generation — but it can be OLD, and the stamp is the only thing that
    // says which.
    expect(buildState(args())).toContain("Generated **2026-09-09**");
  });

  it("says it is generated and must not be hand-edited", () => {
    expect(buildState(args())).toMatch(/generated, do not hand-edit/i);
  });
});

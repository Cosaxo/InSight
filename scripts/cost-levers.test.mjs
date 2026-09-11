// cost-levers.test.mjs — the suite this printer never had.
//
// `npm run costs:levers` was DEAD ON MAIN from 580f388 (2026-09-09) until
// 2026-09-11: that commit removed the "Circle reads 100 answers/member"
// lever from LEVERS — correctly, because runbook 3.5 shipped the change it
// proposed — and left three PATHS entries still asking for it by name. The
// bare `LEVERS.find(...).opts` turned that into a TypeError two sections in,
// AFTER the run had printed two tables that looked perfectly fine. Nothing
// went red, because this file did not exist and the script's own header says
// what it is: "a printer, not a gate. It asserts nothing and is not wired
// into CI."
//
// That is the D179/D197/D275 class — a script that CHECKS something breaking
// while nothing else notices — one step further along, in a script that
// REPORTS something. The cost is the same and slower to find: the plan in
// docs/COST-REDUCTION.md could not be re-printed, so it stopped tracking the
// model and became the folklore this script's header exists to prevent.
//
// Two rules, and the second is the one worth having.
//
//   1. The script runs to completion. Child process, not an import: it is a
//      top-level printer with no exports, so "does it run" IS the assertion
//      and there is no way to ask it without running it.
//
//   2. Every UNMARKED lever moves the bill somewhere. A lever whose `opts`
//      the model has stopped reading does not fail — it prints -0.0% across
//      the row, which is indistinguishable from a measured nothing. That is
//      how restoring the Circle cap "correctly" would have been worse than
//      the crash: a lever that silently saves zero is a plan with a dead
//      entry in it, and the reader cannot tell. A lever that is genuinely
//      worth nothing today declares `supersededBy` and says why (the mirror
//      publish batch, against a baseline that stopped streaming at D129).
//
// Run by `npm run test:scripts`, which is CI's lint job — see CLAUDE.md §2 on
// why that runner hides and what it has cost three times.
import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const script = join(here, "cost-levers.mjs");
const source = readFileSync(script, "utf8");

let out = "";
let status = null;

beforeAll(() => {
  try {
    out = execFileSync("node", [script], {
      cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000,
    });
    status = 0;
  } catch (e) {
    // Keep BOTH streams: the TypeError this suite exists for arrived on
    // stderr while stdout held two healthy-looking tables, and a failure
    // message showing only one of them explains nothing.
    out = `${e.stdout || ""}${e.stderr || ""}`;
    status = e.status ?? "killed";
  }
});

describe("the printer runs", () => {
  it("exits 0 and prints all five sections", () => {
    expect(status, `costs:levers exited ${status}:\n${out.slice(-2000)}`).toBe(0);
    for (const section of [
      "1 · Each lever on its own",
      "2 · Why there is no single answer",
      "3 · Stacked:",
      "4 · Did it fix the SLOPE?",
      "5 · Bounded by arithmetic",
    ]) expect(out, `section missing: ${section}`).toContain(section);
  });

  it("prints a row for every lever and a block for every path", () => {
    for (const name of names(/^\s*name: "([^"]+)",$/gm, sliceBetween("const LEVERS", "const PATHS"))) {
      expect(out, `no section-1 row for lever "${name}"`).toContain(name);
    }
    for (const name of names(/^\s*name: "([^"]+)",$/gm, sliceBetween("const PATHS", "\nconsole.log"))) {
      expect(out, `no section-3 block for path "${name}"`).toContain(name);
    }
  });
});

describe("every path asks for a lever that exists", () => {
  // The actual regression, asserted on the source rather than the output:
  // a PATHS entry naming a removed lever is the defect, and reading it here
  // names the missing lever even when the script is too broken to run.
  it("no PATHS entry names a lever LEVERS does not define", () => {
    const defined = new Set(names(/^\s*name: "([^"]+)",$/gm, sliceBetween("const LEVERS", "const PATHS")));
    const asked = new Set();
    for (const call of source.matchAll(/\bpick\(([\s\S]*?)\)/g)) {
      for (const m of call[1].matchAll(/"([^"]+)"/g)) asked.add(m[1]);
    }
    expect(asked.size, "pick() is never called — has the file been restructured?").toBeGreaterThan(0);
    expect([...asked].filter((n) => !defined.has(n))).toEqual([]);
  });

  it("pick() names the missing lever instead of throwing on undefined", () => {
    // The message is the deliverable. A `TypeError: Cannot read properties
    // of undefined (reading 'opts')` sends the next reader to the stack
    // trace; naming the lever sends them to the two-line fix.
    expect(source).toMatch(/PATHS asks for the lever/);
    expect(source).not.toMatch(/LEVERS\.find\(\(L\) => L\.name === n\)\.opts/);
  });
});

describe("the slope paragraph is about the path it names", () => {
  // It was about PATHS[0] — "R · Region only" — while every sentence in it
  // said "path A". The four figures were computed rather than typed, which
  // is what the note above them promises, and computed off the wrong row,
  // which the note could not see. So the cross-check is against section 3's
  // own table for path A: two places printing the same two numbers cannot
  // disagree silently.
  const savedAt = (path, dau) => {
    const block = out.slice(out.indexOf(path));
    const row = new RegExp(`^\\s*${dau.replace(/,/g, ",")}\\s.*$`, "m").exec(block);
    expect(row, `no ${dau} row under "${path}"`).toBeTruthy();
    // The table writes the cut as "-10%" and the paragraph strips the sign
    // (`cut(...).slice(1)`), so compare the magnitudes.
    return /-?([\d.]+)%/.exec(row[0])?.[1];
  };

  it("quotes path A's own cuts, not the first path's", () => {
    const para = /Path A cuts every absolute figure — (-?[\d.]+)% at 500 DAU, (-?[\d.]+)% at 500,000/.exec(out);
    expect(para, `the slope paragraph did not print its two cuts:\n${out.slice(-1500)}`).toBeTruthy();
    expect(para[1], "the 500-DAU cut is not path A's").toBe(savedAt("A · Keep it live", "500"));
    expect(para[2], "the 500,000-DAU cut is not path A's").toBe(savedAt("A · Keep it live", "500,000"));
  });

  it("says the slope got worse only when the two figures it prints say so", () => {
    const m = /SLOPE (worse|where it was) \(([\d.]+)x -> ([\d.]+)x\)|flattens the curve with it \(([\d.]+)x -> ([\d.]+)x\)/.exec(out);
    expect(m, `no slope sentence in the output:\n${out.slice(-1500)}`).toBeTruthy();
    const [a, b] = m[1] ? [Number(m[2]), Number(m[3])] : [Number(m[4]), Number(m[5])];
    if (m[1] === "worse") expect(b).toBeGreaterThan(a);
    else if (m[1] === "where it was") expect(b).toBe(a);
    else expect(b).toBeLessThan(a);
  });

  it("does not round the slope column until every path says the same thing", () => {
    // Whole numbers put "1x" on all six rows, including the rows that
    // differ from each other — a column that cannot disagree with itself
    // is not a reading.
    const col = [...out.matchAll(/^\S.*?\s([\d.]+)x\s*$/gm)].map((x) => x[1]);
    expect(col.length, "the 500->500k column disappeared").toBeGreaterThan(3);
    for (const v of col) expect(v, `a whole-number multiple: ${v}x`).toMatch(/\./);
  });
});

describe("no lever is quietly worth nothing", () => {
  it("every unmarked lever moves the bill at some modelled size", () => {
    const marked = new Set();
    for (const block of source.split(/\n {2}\{\n/).slice(1)) {
      const n = /^\s*(?:band: "[^"]+",\n\s*)?name: "([^"]+)",/m.exec(block);
      if (n && /supersededBy:/.test(block)) marked.add(n[1]);
    }
    const rows = out.split("\n").filter((l) => /^\[[CPA]\] /.test(l));
    expect(rows.length, "section 1 printed no lever rows").toBeGreaterThan(0);
    const dead = [];
    for (const row of rows) {
      const pcts = [...row.matchAll(/-([\d.]+)%/g)].map((m) => Number(m[1]));
      if (!pcts.length || pcts.some((v) => v > 0.05)) continue;
      const name = row.replace(/^\[[CPA]\] /, "").replace(/\s*†?\s+-.*$/, "").trim();
      if (!marked.has(name)) dead.push(name);
    }
    expect(
      dead,
      "these levers save ~nothing at every size and say nothing about why.\n"
      + "  Either the model stopped reading their `opts` — check what consumes them in\n"
      + "  cost-arith.mjs — or the change shipped and the baseline moved. Declare\n"
      + "  `supersededBy` with the reason, or remove the lever from BOTH lists.",
    ).toEqual([]);
  });

  it("a marked lever says what superseded it", () => {
    for (const block of source.split(/\n {2}\{\n/).slice(1)) {
      const m = /supersededBy: "([^"]*)"/.exec(block);
      if (m) expect(m[1].length, "supersededBy must carry a reason").toBeGreaterThan(10);
    }
  });
});

/** The source between two markers, so LEVERS' names never pick up PATHS'. */
function sliceBetween(from, to) {
  const a = source.indexOf(from);
  const b = source.indexOf(to, a + 1);
  expect(a, `marker not found: ${from}`).toBeGreaterThan(-1);
  expect(b, `marker not found after ${from}: ${to}`).toBeGreaterThan(a);
  return source.slice(a, b);
}

function names(re, text) {
  return [...text.matchAll(re)].map((m) => m[1]);
}

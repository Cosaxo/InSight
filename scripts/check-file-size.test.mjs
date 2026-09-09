// The file-size ratchet.
//
// A ratchet is only worth having if it fails in BOTH directions and cannot
// go quietly vacuous, and this one has a third failure mode the others do
// not: a watched file that is renamed or deleted. A size check that reads
// a missing path as "0 lines, well under the ceiling" would congratulate
// the tree for the one event that stops it watching anything — the D275
// class wearing a new hat.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SIZE_BASELINE, lineCount, sizeReport } from "./check-file-size.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("lineCount", () => {
  it("agrees with wc -l — a trailing newline does not make a line", () => {
    // A baseline that disagrees with the tool a reader will reach for is a
    // baseline they will assume is wrong.
    expect(lineCount("a\nb\n")).toBe(2);
    expect(lineCount("a\nb")).toBe(2);
    expect(lineCount("")).toBe(0);
  });
});

describe("sizeReport", () => {
  const base = { "a.ts": 100, "b.ts": 50 };

  it("is clean when every file sits exactly at its ceiling", () => {
    const r = sizeReport({ "a.ts": 100, "b.ts": 50 }, base);
    expect(r.over).toEqual([]);
    expect(r.under).toEqual([]);
  });

  it("fails when a file grows", () => {
    const r = sizeReport({ "a.ts": 101, "b.ts": 50 }, base);
    expect(r.over).toEqual([{ file: "a.ts", now: 101, max: 100, kind: "grew" }]);
  });

  it("ALSO fails when a file shrinks, asking for the ceiling to come down", () => {
    // The half that makes it a ratchet rather than a limit — `check:globals`
    // rule 4's shape. Without it the number drifts upward relative to
    // reality and the gate stops biting long before anyone notices.
    const r = sizeReport({ "a.ts": 90, "b.ts": 50 }, base);
    expect(r.under).toEqual([{ file: "a.ts", now: 90, max: 100 }]);
  });

  it("treats a MISSING file as a failure, not as zero lines", () => {
    // The vacuity case, and the one specific to this gate: a renamed or
    // deleted watched file must not read as "comfortably under the
    // ceiling", because that is the exact moment the ratchet stops
    // watching it.
    const r = sizeReport({ "b.ts": 50 }, base);
    expect(r.over).toEqual([{ file: "a.ts", now: null, max: 100, kind: "missing" }]);
  });
});

describe("the baseline describes the real tree", () => {
  it("watches every file it names, and each one exists", () => {
    // If this ever fails, the answer is to fix the path — not to drop the
    // row, which is how a concentration stops being watched.
    for (const file of Object.keys(SIZE_BASELINE)) {
      expect(() => readFileSync(join(ROOT, file), "utf8"), file).not.toThrow();
    }
  });

  it("is seeded at the real sizes, so the gate is green and every later line is a decision", () => {
    const sizes = {};
    for (const file of Object.keys(SIZE_BASELINE)) {
      sizes[file] = lineCount(readFileSync(join(ROOT, file), "utf8"));
    }
    const r = sizeReport(sizes);
    expect(r.over, JSON.stringify(r.over)).toEqual([]);
    expect(r.under, JSON.stringify(r.under)).toEqual([]);
  });

  it("watches the files the review named as concentrations", () => {
    // Named rather than counted: the point of the gate is these specific
    // files, and a baseline that quietly lost one of them would pass a
    // count check.
    expect(Object.keys(SIZE_BASELINE)).toEqual(expect.arrayContaining([
      "src/v2/data/live.ts",
      "src/v2/spec/world-feed.jsx",
      "functions/src/v2content.ts",
    ]));
  });
});

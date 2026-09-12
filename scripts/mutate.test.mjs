// The mutation lane's own pure half.
//
// The lane's value rests entirely on two properties, and both are testable
// without spawning a single test run: a mutant must be a defect a person
// could plausibly write (not a mangled comment), and the sample must be
// REPRODUCIBLE — a survivor nobody can re-plant is an anecdote, not a bug
// report. The half that actually runs vitest is not tested here for the
// obvious reason; it is exercised every night, and its first real run
// found a live gap in typeMix.test.ts's scope coverage.
import { describe, expect, it } from "vitest";
import { OPERATORS, applyMutant, arg, hash, mutableLine, planRun, sitesIn } from "./mutate.mjs";

describe("mutableLine", () => {
  it("refuses comments — a mutated comment is not a defect", () => {
    // The failure this prevents is a lane that reports high kill rates
    // while planting its mutants in prose. This repo comments more than
    // most, so the majority of `&&` and `>=` occurrences in a file like
    // live.ts are inside explanations of why the code is what it is.
    expect(mutableLine("  // if a >= b then …")).toBe(false);
    expect(mutableLine("   * a && b holds here")).toBe(false);
    expect(mutableLine("  /* a >= b */")).toBe(false);
  });

  it("refuses imports and blank lines", () => {
    expect(mutableLine('import { a } from "./b";')).toBe(false);
    expect(mutableLine("} from \"./patternsFit\";")).toBe(false);
    expect(mutableLine("   ")).toBe(false);
  });

  it("admits ordinary code", () => {
    expect(mutableLine("  if (n >= 8) return true;")).toBe(true);
  });
});

describe("sitesIn", () => {
  it("finds every application of every operator, in a stable order", () => {
    const src = [
      "// a >= b in a comment",
      "const x = n >= 1 && m >= 2;",
      "const y = Math.min(a, b);",
    ].join("\n");
    const sites = sitesIn(src);
    // The comment line contributes nothing; line 1 has two >= and one &&.
    expect(sites.every((s) => s.line > 0)).toBe(true);
    expect(sites.filter((s) => s.op === "gte-to-gt")).toHaveLength(2);
    expect(sites.filter((s) => s.op === "and-to-or")).toHaveLength(1);
    expect(sites.filter((s) => s.op === "min-to-max")).toHaveLength(1);
  });

  it("is deterministic — the same source gives the same sites", () => {
    const src = "const x = a >= b && c <= d;";
    expect(sitesIn(src)).toEqual(sitesIn(src));
  });
});

describe("applyMutant", () => {
  it("changes exactly the one occurrence it names", () => {
    const src = "const x = a >= b;\nconst y = c >= d;";
    const sites = sitesIn(src);
    const out = applyMutant(src, sites[1]);
    expect(out).toBe("const x = a >= b;\nconst y = c > d;");
  });

  it("refuses a site that no longer matches, instead of corrupting the file", () => {
    // The lane writes into the real source and restores it in a finally.
    // A stale plan silently rewriting the wrong characters is the one
    // failure mode that could lose work, so it throws.
    const sites = sitesIn("const x = a >= b;");
    expect(() => applyMutant("const x = a < b;", sites[0])).toThrow(/no longer matches/);
  });

  it("every operator produces something different from its input", () => {
    for (const op of OPERATORS) {
      const src = `const x = 1;\nconst y = q${op.find}r;`;
      const sites = sitesIn(src).filter((s) => s.op === op.id);
      expect(sites.length, op.id).toBeGreaterThan(0);
      expect(applyMutant(src, sites[0]), op.id).not.toBe(src);
    }
  });

  it("carries a reason with every operator", () => {
    // A survivor is reported as "this defect went unnoticed"; without the
    // reason it reads as "mutant 7 survived", which nobody acts on.
    for (const op of OPERATORS) expect(op.why?.length ?? 0, op.id).toBeGreaterThan(20);
  });
});

describe("hash and planRun", () => {
  it("is stable across runs, so a night's sample can be re-planted", () => {
    expect(hash("2026-09-09:0")).toBe(hash("2026-09-09:0"));
    expect(hash("2026-09-09:0")).not.toBe(hash("2026-09-09:1"));
  });

  it("plans the same run for the same seed and a different one otherwise", () => {
    const targets = [
      { source: "a.ts", suite: "a.test.ts" },
      { source: "b.ts", suite: "b.test.ts" },
      { source: "c.ts", suite: "c.test.ts" },
    ];
    const readSource = () => "const x = p >= q && r <= s;\nconst y = Math.min(1, 2);";
    const one = planRun({ targets, seed: "S", count: 4, readSource });
    expect(planRun({ targets, seed: "S", count: 4, readSource })).toEqual(one);
    expect(planRun({ targets, seed: "T", count: 4, readSource })).not.toEqual(one);
  });

  it("plans nothing from a source with no mutable site, rather than throwing", () => {
    const plan = planRun({
      targets: [{ source: "a.ts", suite: "a.test.ts" }],
      seed: "S", count: 3,
      readSource: () => "// nothing but a comment >= here\n",
    });
    expect(plan).toEqual([]);
  });

  it("spreads across targets rather than drilling into one", () => {
    // The question the lane answers is "which suites are asleep"; four
    // mutants in one file answers it for one file.
    const targets = Array.from({ length: 20 }, (_, i) => ({ source: `f${i}.ts`, suite: `f${i}.test.ts` }));
    const plan = planRun({
      targets, seed: "spread", count: 8,
      readSource: () => "const x = a >= b;",
    });
    expect(new Set(plan.map((p) => p.source)).size).toBeGreaterThan(1);
  });
});

describe("arg — an empty value is not a boolean flag", () => {
  // THE ONE THAT FROZE THE LANE. mutate.yml writes
  // `--seed "${{ inputs.seed || '' }}"`, so every scheduled run passed an
  // empty string. The old parser tested the next argv for truthiness, ""
  // is falsy, so it answered `true` — and `String(true)` made the seed the
  // literal word "true". The pool never rotated: the same four mutants,
  // every night, over ~164 suited files, reported as "0 survivors".
  const argv = (...rest) => ["node", "mutate.mjs", ...rest];

  it("an empty value takes the fallback, so the schedule seeds by date", () => {
    expect(arg("seed", "2026-09-12", argv("--seed", ""))).toBe("2026-09-12");
  });

  it("a real value still wins", () => {
    expect(arg("seed", "2026-09-12", argv("--seed", "abc"))).toBe("abc");
  });

  it("a bare boolean flag is still true — undefined is not empty", () => {
    // The distinction the fix turns on: `--dry` has no next argv at all,
    // which genuinely means "present, no value"; `--seed ""` has one and
    // it is empty, which means "the caller offered nothing".
    expect(arg("dry", false, argv("--dry"))).toBe(true);
    expect(arg("dry", false, argv("--dry", "--count", "5"))).toBe(true);
  });

  it("an absent flag takes the fallback", () => {
    expect(arg("seed", "2026-09-12", argv("--count", "5"))).toBe("2026-09-12");
  });
});

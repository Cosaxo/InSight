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
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { OPERATORS, applyMutant, hash, mutableLine, planRun, sitesIn } from "./mutate.mjs";

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

// ── the entry path, which is where the lane actually lived ────────────
//
// The pure half above was correct all along and the lane was still doing
// nothing: the scheduled workflow passes `--seed "${{ inputs.seed || '' }}"`
// and a cron run has no inputs, so the seed arrived as an empty string,
// fell through `arg`'s falsy check to the bare-flag branch, and came back
// as the BOOLEAN true — stringified to "true" and used as the seed every
// night. `planRun` is reproducible, which is exactly why that was
// invisible: the same seed plans the same sample, forever, and the run
// prints a clean "0 survivors" about four sites it has already proved.
//
// Driven as a subprocess because `arg` reads process.argv and the floors
// live in the entry block — the thing that broke is the entry path, so
// that is what these run.
describe("the command line", () => {
  const run = (args) => {
    const r = spawnSync(process.execPath, [fileURLToPath(new URL("./mutate.mjs", import.meta.url)), ...args],
      { encoding: "utf8", cwd: fileURLToPath(new URL("..", import.meta.url)) });
    return { out: `${r.stdout}${r.stderr}`, code: r.status };
  };

  it("takes an EMPTY --seed as no seed at all, not as the word true", () => {
    const { out, code } = run(["--dry", "--seed", "", "--count", "3"]);
    expect(code, out).toBe(0);
    expect(out, "the empty seed came back as a flag and became the literal seed \"true\"")
      .not.toMatch(/seed true/);
    // …and what it falls back to is the date, which is what makes the
    // sample rotate. Matched as a shape rather than as today's value, so
    // this case does not expire at midnight.
    expect(out).toMatch(/seed \d{4}-\d{2}-\d{2}/);
  });

  it("still takes a seed that was given", () => {
    const { out } = run(["--dry", "--seed", "2026-01-02", "--count", "3"]);
    expect(out).toMatch(/seed 2026-01-02/);
  });

  it("refuses an empty plan rather than reporting a clean night", () => {
    // The vacuity floor. A count of zero is the reachable shape of it;
    // the other is a moved source root, which cannot be produced from
    // here without moving one.
    const { out, code } = run(["--dry", "--count", "0"]);
    expect(code, "an empty plan exited 0, which reads as a night that found nothing wrong").toBe(2);
    expect(out).toMatch(/REFUSES to run/);
  });
});

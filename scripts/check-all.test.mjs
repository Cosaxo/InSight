// The parser behind `npm run check:all`, and the tripwire under it.
//
// What is actually at risk here is not a wrong list but a SHORT one.
// check-all derives its work from ci.yml's lint job, so a parser that
// silently matches less than the whole job produces a command that reports
// "42/42 green" over thirty gates and is believed — the D179/D197/D275 class
// exactly, and the reason CLAUDE.md §2 says the fifth runner hides. So these
// cases lean on truncation and on the shapes that cause it, rather than on
// the happy path.
//
// The pure half is imported; check-all.mjs itself is never imported, because
// it reads ci.yml, spawns forty-odd subprocesses and exits at import — which
// is the reason lint-steps.mjs exists as its own file (gate-placement.mjs's
// precedent, and its comment says why).
import { describe, it, expect } from "vitest";
import { lintSteps, isSetup, FLOOR } from "./lint-steps.mjs";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CI = readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8");

describe("lintSteps, against the real ci.yml", () => {
  const steps = lintSteps(CI);

  it("reads the whole lint job, comfortably above the floor", () => {
    expect(steps.length).toBeGreaterThanOrEqual(FLOOR);
    // The first and last steps of the job, so a truncation at either end
    // fails here rather than shrinking the list quietly.
    expect(steps[0]).toBe("npm ci");
    expect(steps).toContain("npm run lint");
    expect(steps.at(-1)).toBe("npm run check:devicebind");
  });

  it("includes `test:scripts` — the runner this whole command exists for", () => {
    // CLAUDE.md §2: it is wired into CI's lint job and nothing else, so
    // `npm run lint` locally says nothing about it. If it ever stops being
    // in this list, check:all has lost the one gate it was written to carry.
    expect(steps).toContain("npm run test:scripts");
  });

  it("stops at the job boundary and takes nothing from its neighbours", () => {
    // Each of these is a real step in a DIFFERENT job of the same file. A
    // greedy block match would swallow them, and check:all would start
    // building Android and running the unit suite on every invocation.
    const joined = steps.join("\n");
    expect(joined).not.toContain("gradlew");          // android-build
    expect(joined).not.toContain("cap sync");         // native-sync-drift
    expect(joined).not.toContain("check:bundle");     // typecheck-build
    expect(joined).not.toContain("test:unit");        // unit-tests
  });

  it("separates CI's setup from its gates", () => {
    expect(steps.filter(isSetup)).toEqual(["npm ci", "npm ci --prefix functions"]);
    expect(steps.filter((c) => !isSetup(c)).every((c) => !c.startsWith("npm ci"))).toBe(true);
  });
});

describe("the shapes that truncate it", () => {
  it("refuses a lint job with a multi-line `run:` rather than dropping it", () => {
    // THE FAILURE THIS GUARDS. The single-line match cannot see a `run: |`
    // body, so a gate moved into one would vanish from check:all's list with
    // nothing going red — a runner quietly carrying one gate fewer, which is
    // the whole class. Refusing is the only safe answer; the parser cannot
    // know what it did not match.
    const inline = CI.replace("      - run: npm run check:globals\n", "      - run: |\n          npm run check:globals\n");
    expect(() => lintSteps(inline)).toThrow(/multi-line/);
    // And the other spelling, which follows a `name:`. The guard was written
    // catching only this one and its own first run proved it: `- run: |` is
    // the commoner shape and went straight through.
    const named = CI.replace(
      "      - run: npm run check:globals\n",
      "      - name: Globals\n        run: |\n          npm run check:globals\n",
    );
    expect(() => lintSteps(named)).toThrow(/multi-line/);
  });

  it("throws when there is no lint job at all", () => {
    expect(() => lintSteps("jobs:\n  other:\n    runs-on: ubuntu-latest\n")).toThrow(/no `lint:` job/);
  });

  it("does not count a gate merely NAMED in a comment", () => {
    // gate-placement.mjs learned this the expensive way: these workflows
    // explain themselves at length, so the gates most likely to appear in a
    // comment are the ones a raw match gets wrong. Here the cost would be
    // check:all trying to run a line of prose.
    const src = [
      "jobs:",
      "  lint:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      "      # - run: npm run check:invented",
      "      # check:also-invented explains the one below",
      "      - run: npm run check:real",
      "",
      "  next:",
      "    runs-on: ubuntu-latest",
      "",
    ].join("\n");
    expect(lintSteps(src)).toEqual(["npm run check:real"]);
  });

  it("reads a lint job that is the file's last", () => {
    // No trailing job to terminate the block — the `end < 0` branch, which
    // is otherwise never exercised by the real file.
    const src = "jobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm run check:one\n";
    expect(lintSteps(src)).toEqual(["npm run check:one"]);
  });
});

describe("the floor", () => {
  it("sits below the real job but far above a broken parse", () => {
    // A floor at or above the real count fails the tree on ordinary pruning;
    // a floor of 1 never fires. Both directions pinned.
    expect(FLOOR).toBeLessThan(lintSteps(CI).length);
    expect(FLOOR).toBeGreaterThan(10);
  });
});

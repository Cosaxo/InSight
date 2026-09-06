// The one figure in check:figures that the tree cannot answer.
//
// Every entry in that gate recomputes its number off the tree — that is the
// whole idea, because a hand-kept figure goes stale. One entry is different:
// CLAUDE.md §1 records how far the old hand-listed figure had DRIFTED before
// anything measured it (seven in the prose against 32 in the tree). That is a
// fact about a past state. Written as `convertedSpecModules - 7` it looked
// like the same recomputation as its neighbour and behaved like a trap: the
// next person to convert a spec module — the "convert on touch" work CLAUDE.md
// asks for — would have been met by a red gate instructing them to write a
// drift that never happened.
//
// Run against a real copy of the tree rather than by reading the source,
// because the claim is about what the gate DEMANDS, and the demand is the
// message it prints.
import { describe, it, expect, beforeAll } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Run the gate inside `dir`, returning its status and combined output. */
function runGate(dir) {
  try {
    const out = execFileSync("node", [join(dir, "scripts", "check-figures.mjs")], {
      cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

let tree;
beforeAll(() => {
  // The working tree's tracked files, not HEAD's: the subject of this test is
  // the script as it stands right now, uncommitted edits included.
  tree = mkdtempSync(join(tmpdir(), "check-figures-"));
  execFileSync("bash", ["-c",
    `cd ${JSON.stringify(root)} && git ls-files -z | tar --null -T - -cf - | tar -xf - -C ${JSON.stringify(tree)}`,
  ], { stdio: ["ignore", "ignore", "pipe"] });
}, 60_000);

/**
 * The live bridge count, asked of the gate itself rather than written down.
 *
 * Both cases below used to hardcode it — `33` and `26` — in the test suite
 * of the gate whose entire subject is that a hand-maintained figure rots.
 * The first spec-module conversion CLAUDE.md's own "convert on touch" rule
 * asks for turned all three cases red, with a message pointing at the
 * wrong thing.
 *
 * So: break the prose figure to something no tree can match, and read the
 * number the gate demands back out of its own complaint.
 */
function liveBridgeFigure(t) {
  const md = join(t, "CLAUDE.md");
  const before = readFileSync(md, "utf8");
  try {
    writeFileSync(md, before.replace(
      /^\d+ modules are already off the bridge/m,
      "999999 modules are already off the bridge",
    ));
    const m = /Correct the sentence to: "(\d+) modules are already off the bridge"/.exec(runGate(t).out);
    expect(m, "the gate stopped naming the live bridge figure").toBeTruthy();
    return Number(m[1]);
  } finally {
    writeFileSync(md, before);
  }
}

/** One converted spec module, planted and swept by the case that needs it. */
function withProbe(t, fn) {
  const probe = join(t, "src/v2/spec/zzz-figures-probe.jsx");
  writeFileSync(probe, "export const zzzFiguresProbe = 1;\n");
  try { return fn(); } finally { rmSync(probe, { force: true }); }
}

describe("check:figures and the drift figure", () => {
  it("passes on an unmodified copy of the tree", () => {
    // Vacuity guard for the two cases below: if the copy were incomplete the
    // gate would fail here for its own reasons and every assertion about WHAT
    // it complains about would be meaningless.
    const r = runGate(tree);
    expect(r.out).toContain("check-figures OK");
    expect(r.code).toBe(0);
  });

  it("asks for the live bridge figure, and says nothing about the drift, when a module converts", () => {
    // A spec module that exports and publishes nothing is one off the
    // bridge, so the live figure moves by exactly one — asserted as that
    // RELATIONSHIP rather than as a number, which is the whole lesson of
    // the gate under test.
    const live = liveBridgeFigure(tree);
    withProbe(tree, () => {
      const r = runGate(tree);
      expect(r.code).toBe(1);
      expect(r.out).toContain(`${live + 1} modules are already off the bridge`);
      expect(r.out).not.toMatch(/understate the migration/);
    });
  });

  it("would have demanded a drift that never happened, before the figure was pinned", () => {
    // The mutant is the shape this entry actually shipped in. Without this
    // case the one above passes just as well against a gate that has no
    // opinion on the sentence at all.
    //
    // PLANTS ITS OWN PROBE. It used to inherit the one the case above
    // wrote into the shared tree, and on a clean tree
    // `convertedSpecModules - 7` equals SPEC_MIGRATION_DRIFT exactly — so
    // without that leak the mutant is indistinguishable from the real gate
    // and this case passes on a passing run. Any `-t` filter, an `it.only`
    // or a shuffled sequence removed the property it claims to hold.
    const live = liveBridgeFigure(tree);
    const p = join(tree, "scripts/check-figures.mjs");
    const src = readFileSync(p, "utf8");
    const pinned = "actual: String(SPEC_MIGRATION_DRIFT),";
    expect(src.split(pinned).length - 1).toBe(1);
    try {
      writeFileSync(p, src.replace(pinned, "actual: String(convertedSpecModules - 7),"));
      withProbe(tree, () => {
        const r = runGate(tree);
        expect(r.code).toBe(1);
        expect(r.out).toContain(`understate the migration by ${live + 1 - 7} modules`);
      });
    } finally {
      writeFileSync(p, src);
    }
  });
});

describe("the cold-boot row is computed, not copied", () => {
  // COSTS.md's cold-boot row said "+913 reads — the whole question bank"
  // long after daily, feed and learn started paging, and this gate kept
  // that number CURRENT as the bank grew: a gate faithfully maintaining a
  // false sentence, which is worse than a sentence nobody holds. Someone
  // reading the docs — including the session that eventually found it —
  // saw "a phone downloads every question" and believed it, months after
  // the work that stopped it.
  //
  // The fix computes the row from `BANK_SURFACES` in live.ts. These two
  // cases are the two ways that can go wrong.

  it("moves with the code when a surface leaves the boot", () => {
    const live = join(tree, "src/v2/data/live.ts");
    const before = readFileSync(live, "utf8");
    try {
      writeFileSync(live, before.replace(
        /const BANK_SURFACES = \["test", "group", "duo", "pulse", "call"\];/,
        'const BANK_SURFACES = ["test", "group", "duo", "pulse"];',
      ));
      const r = runGate(tree);
      expect(r.code, "dropping a surface left the documented boot cost unchanged").toBe(1);
      expect(r.out).toMatch(/what a cold boot fetches/);
      // Both halves move, and in opposite directions — fewer fetched is
      // more not fetched. A row that moved only one way would be arithmetic
      // nobody checked.
      expect(r.out).toMatch(/never ride the boot/);
    } finally {
      writeFileSync(live, before);
    }
  });

  it("REFUSES rather than guesses when the list is renamed", () => {
    // The D197 shape: one bank parser in three copies, and the copy with a
    // try/catch reported an invented wire size instead of failing. A gate
    // that cannot find its input must say so — silently computing zero
    // would report a boot that fetches nothing, which is a number, looks
    // like an answer, and is worse than red.
    const live = join(tree, "src/v2/data/live.ts");
    const before = readFileSync(live, "utf8");
    try {
      writeFileSync(live, before.replace("const BANK_SURFACES = ", "const RENAMED = "));
      const r = runGate(tree);
      expect(r.code).toBe(1);
      expect(r.out).toMatch(/could not find BANK_SURFACES/);
    } finally {
      writeFileSync(live, before);
    }
  });
});

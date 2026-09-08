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
import { FIGURES } from "./check-figures.mjs";
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

// THE COLD-BOOT ROW'S CASES CAME BACK, pointed at main's design instead of
// this branch's. They were deleted in the merge that took main's fix — the
// better one, since `coldBootBankDocs` counts the feed's CORE questions the
// boot really does fetch and this branch's 250 missed — and the deletion
// left a note saying what had gone unheld: main's gate reads only
// v2content.ts, so CHANGING `BANK_SURFACES` in live.ts moves what a boot
// fetches and the gate does not notice, keeping the row green at the wrong
// number. The same shape as the bug the row is famous for, one input over.
//
// That note called the fix "new work, not a merge resolution". It is done
// now: main's list stays written out, for its own good reason — "a regex
// over a source array would silently agree with itself if the array were
// renamed" — and is held EQUAL to live.ts's, so a divergence fails loudly
// instead of never. Copied, and proved still equal.
//
// Measured before it was written: dropping "call" from BANK_SURFACES left
// check:figures green. These two cases are that probe, kept.

describe("the cold-boot list is copied, and held equal to the code", () => {
  it("FAILS when live.ts's list and the gate's copy diverge", () => {
    const live = join(tree, "src/v2/data/live.ts");
    const before = readFileSync(live, "utf8");
    try {
      writeFileSync(live, before.replace(
        /const BANK_SURFACES = \["test", "group", "duo", "pulse", "call"\];/,
        'const BANK_SURFACES = ["test", "group", "duo", "pulse"];',
      ));
      const r = runGate(tree);
      expect(r.code, "a surface left the boot and the gate stayed green").toBe(1);
      expect(r.out).toMatch(/no longer matches BANK_SURFACES/);
      // The message names BOTH lists, because the fix is to reconcile them
      // and a message naming one sends the reader to the wrong file.
      expect(r.out).toMatch(/test, group, duo, pulse, call/);
    } finally {
      writeFileSync(live, before);
    }
  });

  it("REFUSES rather than passing by default when the list is renamed", () => {
    // The D197 shape: a second copy whose check cannot find its counterpart
    // must say so. Passing by default is how a copy stops being checked at
    // all while still looking guarded.
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

// ── the remedy this gate prints ───────────────────────────────────────
//
// A mismatch prints `Correct the sentence to: "<sentence>"`, and a
// maintainer types that in. So the remedy has to be a sentence the entry's
// own pattern will then MATCH — otherwise the second run reports the figure
// is no longer quoted anywhere and says to delete the entry from FIGURES.
//
// That is not hypothetical. The cold-boot row's hint still quoted "the
// whole question bank", the wording D383 retired and that entry was
// explicitly retargeted away from, while its pattern matched "five whole
// surfaces plus the feed's core". Following the printed remedy verbatim
// restored a claim the gate's own comment calls false, and the next run
// then told the reader to remove the gate that had just caught the drift —
// a caught drift walked to a deleted gate in two steps.
//
// ONE ENTRY, driven end to end, because that is what this file can do
// honestly: `FIGURES` is not exported and the module runs the gate at
// import, so the general property — every `fix(actual)` matches its own
// `re` — needs an entry guard on check-figures.mjs first. That is a change
// to a deploy-path gate and belongs in its own commit, not this one; the
// loop below is the same property, measured rather than asserted.
describe("the printed remedy closes the loop it opened", () => {
  const ROW = /\*\*\+(\d+) reads\*\* — five whole surfaces plus the feed's core/;

  it("EVERY hint quotes a sentence its own pattern matches", () => {
    // The general property the end-to-end case below can only demonstrate
    // for one entry, and it is importable now: check-figures.mjs guards its
    // report behind an entry check, so importing FIGURES computes and
    // prints nothing.
    //
    // Eleven of the hundred-and-two failed this when it was first run, all
    // the same shape as the cold-boot row: a remedy that drops the
    // backticks, the leading table pipe, the clause the pattern anchors on,
    // or replaces the sentence's other number with "...". Each one walks a
    // maintainer from a caught drift to "delete its entry from FIGURES" in
    // two steps. Two of the eleven were the PATTERN's fault instead — it
    // demanded a line break the one-line remedy cannot reproduce — and were
    // relaxed rather than the hint faked.
    const bad = [];
    for (const fig of FIGURES) {
      expect(typeof fig.fix, `${fig.file} :: ${fig.what} has no fix hint`).toBe("function");
      expect(fig.re instanceof RegExp, `${fig.file} :: ${fig.what} has no pattern`).toBe(true);
      // The hints quote themselves; the gate prints them inside its own
      // quotes, and a maintainer types what is between them.
      const said = String(fig.fix(fig.actual)).replace(/^"|"$/g, "");
      if (!fig.re.test(said)) bad.push(`${fig.file} :: ${fig.what}\n     hint: ${said}\n     re:   ${fig.re}`);
    }
    expect(
      bad,
      "a fix hint quotes a sentence its own pattern will not match — typing it in leaves the figure unquoted, "
        + "and the next run says to delete the entry rather than restore the number",
    ).toEqual([]);
  });

  it("finds the entries — vacuous otherwise", () => {
    expect(FIGURES.length, "FIGURES came back empty — the import stopped working").toBeGreaterThan(50);
  });

  it("a corrected sentence makes the gate green again", () => {
    const costs = join(tree, "docs/COSTS.md");
    const before = readFileSync(costs, "utf8");
    try {
      const m = ROW.exec(before);
      expect(m, "docs/COSTS.md no longer carries the cold-boot row this case drives").toBeTruthy();
      // Step one: drift it by one and read back what the gate demands.
      writeFileSync(costs, before.replace(m[0], m[0].replace(m[1], String(Number(m[1]) + 1))));
      const first = runGate(tree);
      expect(first.code, "the gate did not notice a one-off cold-boot figure").toBe(1);
      const said = /Correct the sentence to: "([^"]+)"/.exec(first.out);
      expect(said, "the gate stopped printing a remedy for the cold-boot row").toBeTruthy();

      // Step two: do exactly what it said, on the sentence it is about.
      const drifted = readFileSync(costs, "utf8");
      const hit = ROW.exec(drifted);
      writeFileSync(costs, drifted.replace(hit[0], said[1].replace(/^"|"$/g, "")));
      const second = runGate(tree);
      expect(
        second.out,
        "following the gate's own remedy leaves it complaining — the hint quotes a sentence its pattern does not match, "
          + "so the next message tells the maintainer to delete the entry instead",
      ).not.toMatch(/could not find the sentence/);
      expect(second.out).toContain("check-figures OK");
      expect(second.code).toBe(0);
    } finally {
      writeFileSync(costs, before);
    }
  });
});

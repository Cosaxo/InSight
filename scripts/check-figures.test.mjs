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
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

describe("check:figures and the drift figure", () => {
  it("passes on an unmodified copy of the tree", () => {
    // Vacuity guard for the two cases below: if the copy were incomplete the
    // gate would fail here for its own reasons and every assertion about WHAT
    // it complains about would be meaningless.
    const r = runGate(tree);
    expect(r.out).toContain("check-figures OK");
    expect(r.code).toBe(0);
  });

  // The live figure, read off the copy's CLAUDE.md rather than written here:
  // the first case proves the copy passes, so the prose equals the tree. This
  // test used to hard-code 32 → 33, and D345's sweep took the tree to 53 in
  // one commit — a hand-kept figure inside the test of hand-kept figures.
  const bridgeFigure = () =>
    Number(/^(\d+) modules are already off the bridge/m.exec(readFileSync(join(tree, "CLAUDE.md"), "utf8"))[1]);

  it("asks for the live bridge figure, and says nothing about the drift, when a module converts", () => {
    // A spec module that exports and publishes nothing is one off the bridge,
    // so the live figure moves up by one.
    const before = bridgeFigure();
    writeFileSync(
      join(tree, "src/v2/spec/zzz-figures-probe.jsx"),
      "export const zzzFiguresProbe = 1;\n",
    );
    const r = runGate(tree);
    expect(r.code).toBe(1);
    expect(r.out).toContain(`${before + 1} modules are already off the bridge`);
    expect(r.out).not.toMatch(/understate the migration/);
  });

  it("would have demanded a drift that never happened, before the figure was pinned", () => {
    // The mutant is the shape this entry actually shipped in. Without this
    // case the one above passes just as well against a gate that has no
    // opinion on the sentence at all.
    const p = join(tree, "scripts/check-figures.mjs");
    const src = readFileSync(p, "utf8");
    const pinned = "actual: String(SPEC_MIGRATION_DRIFT),";
    expect(src.split(pinned).length - 1).toBe(1);
    writeFileSync(p, src.replace(pinned, "actual: String(convertedSpecModules - 7),"));

    const r = runGate(tree);
    expect(r.code).toBe(1);
    // The probe module from the case above is still in the copy, hence +1;
    // the seven is the hand-listed figure the drift was measured against.
    expect(r.out).toContain(`understate the migration by ${bridgeFigure() + 1 - 7} modules`);
  });
});

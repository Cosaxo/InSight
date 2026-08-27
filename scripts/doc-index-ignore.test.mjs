// Whether a gate may be turned red by a file that is not in the repo.
//
// doc-index's rule 5 asks that docs/ORIENTATION.md name every markdown
// document, root ones included — and the root is also where a person
// keeps a scratch note. The skip set was read from .gitignore, exactly so
// a hand-kept list could not go stale, but it was applied to DIRECTORIES
// only: `NIGHT_TASKS.md` is in .gitignore and rule 5 demanded the map
// name it anyway.
//
// Loud rather than silent, which is the good direction for a gate — but a
// file .gitignore has already declared not part of the repo is not the
// map's to name, and a gate that fails on the contents of somebody's
// working tree is a gate people learn to ignore.
//
// Driven as a SUBPROCESS: doc-index.mjs is a script, so importing it runs
// the whole gate and exits.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const run = () => {
  try {
    execFileSync("node", ["scripts/doc-index.mjs"], { cwd: root, stdio: "pipe" });
    return { code: 0, out: "" };
  } catch (err) {
    return { code: err.status ?? 1, out: String(err.stdout || "") + String(err.stderr || "") };
  }
};

describe("doc-index and the working tree", () => {
  it("is green on the tree as committed", () => {
    // The baseline every case below is measured against. If this fails,
    // the tree is red for its own reasons and the rest proves nothing.
    expect(run().code, "doc-index is already failing — fix that before reading the cases below").toBe(0);
  });

  it("ignores a root document .gitignore has taken out of the repo", () => {
    // The night shift's own working file is the live instance, and it is
    // in .gitignore — so it must not be able to fail this gate.
    const ignore = readFileSync(join(root, ".gitignore"), "utf8");
    expect(ignore, "NIGHT_TASKS.md is no longer gitignored — this case is about the wrong file")
      .toMatch(/^NIGHT_TASKS\.md$/m);
    const p = join(root, "NIGHT_TASKS.md");
    const had = existsSync(p);
    const before = had ? readFileSync(p, "utf8") : null;
    try {
      writeFileSync(p, "# scratch\n");
      expect(run().code, "a gitignored root document turned the gate red").toBe(0);
    } finally {
      if (had) writeFileSync(p, before);
      else rmSync(p, { force: true });
    }
  });

  it("still fails for a root document that IS in the repo", () => {
    // The other half: making the gate ignore what .gitignore ignores must
    // not make it ignore a real document the map has no row for.
    const p = join(root, "ZZ_DOC_INDEX_PROBE.md");
    expect(existsSync(p), "the probe name is taken — pick another").toBe(false);
    try {
      writeFileSync(p, "# probe\n");
      const r = run();
      expect(r.code, "rule 5 no longer notices an unmapped root document").toBe(1);
      expect(r.out).toContain("ZZ_DOC_INDEX_PROBE.md");
    } finally {
      rmSync(p, { force: true });
    }
  });
});

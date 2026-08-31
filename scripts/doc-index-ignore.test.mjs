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
import { gatePlacement } from "./gate-placement.mjs";
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

  it("sees a gate a workflow invokes BY PATH, not only by npm run", () => {
    // The gate that could not fail. Placement was decided by searching the
    // workflows for `npm run <name>` — and a gate that takes an argument is
    // invoked as `node scripts/<file>.mjs --flag` instead. One is: the
    // store-copy gate, run on every iOS archive. It classified as "manual",
    // the map recorded that, the release gate could have been deleted from
    // its workflow with nothing going red, and anyone correcting the row
    // was failed by CI until they put the false value back.
    //
    // Tested on the pure classifier rather than by editing a workflow. The
    // first version of this case deleted the invocation from the tracked
    // release workflow and restored it in a `finally` — which does not
    // survive a SIGKILL or a cancelled job, so its crash left the release
    // gate missing from the release workflow. That is the very failure the
    // gate exists to prevent, produced by the test for it.
    const npmRun = new Map([["some-release.yml", "  run: npm run check:thing\n"]]);
    const byPath = new Map([["some-release.yml", "  run: node scripts/check-thing.mjs --ios\n"]]);
    const neither = new Map([["some-release.yml", "  run: echo hello\n"]]);
    const cmd = "node scripts/check-thing.mjs";
    expect(gatePlacement("check:thing", cmd, npmRun)).toBe("release");
    expect(gatePlacement("check:thing", cmd, byPath)).toBe("release");
    expect(gatePlacement("check:thing", cmd, neither)).toBe("manual");
    // The priority order is part of the answer, not an accident of it.
    expect(gatePlacement("check:thing", cmd, new Map([
      ["backend-checks.yml", "node scripts/check-thing.mjs"],
      ["ci.yml", "npm run check:thing"],
    ]))).toBe("deploy");
    expect(gatePlacement("check:thing", cmd, new Map([
      ["ci.yml", "node scripts/check-thing.mjs"],
      ["other.yml", "npm run check:thing"],
    ]))).toBe("ci");

    // A COMMENT IS NOT AN INVOCATION, and this is the half that made the
    // classifier defend the error rather than catch it. These workflows
    // explain themselves in prose, so the gates most likely to be NAMED in
    // a comment are exactly the ones whose placement matters — and the
    // match ran over the raw file. Measured on the real tree: delete the
    // `npm run check:web-firebase` line from both workflows that carry it,
    // leave the header comment naming it, and check:docs stays green while
    // the gate that refuses an iOS archive built against the demo config
    // runs nowhere at all.
    expect(gatePlacement("check:thing", cmd, new Map([
      ["some-release.yml", "  # what check:thing does: npm run check:thing\n  run: echo hello\n"],
    ])), "a comment naming the gate counted as running it").toBe("manual");
    expect(gatePlacement("check:thing", cmd, new Map([
      ["some-release.yml", "  # see node scripts/check-thing.mjs\n  run: echo hello\n"],
    ])), "a comment naming the script path counted as running it").toBe("manual");
    // …and a `#` INSIDE a run line is a shell comment: the command before
    // it is real, so only whole comment lines are dropped.
    expect(gatePlacement("check:thing", cmd, new Map([
      ["ci.yml", "  run: |\n    npm run check:thing  # the one that matters\n"],
    ]))).toBe("ci");
  });

  it("and the real store-copy gate is still invoked, by path, on the release path", () => {
    // The other half, without touching anything: the classifier above is
    // only useful if the workflow really still runs it. If that line goes,
    // the tree-is-green case at the top of this file goes red, because the
    // map row says "release" and the workflows would say "manual".
    const wf = readFileSync(join(root, ".github/workflows/ios-release.yml"), "utf8");
    expect(wf).toMatch(/node scripts\/check-store-copy\.mjs/);
    const orientation = readFileSync(join(root, "docs/ORIENTATION.md"), "utf8");
    expect(orientation).toMatch(/`check:store-copy` \| release \|/);
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

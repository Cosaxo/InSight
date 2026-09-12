// The boot-graph gate's judgement, fed synthetic module lists.
//
// Driven through the pure module rather than by editing an import in
// functions/src and rebuilding — see fn-boot-rules.mjs's header for why a
// test that mutated tracked source here would be the wrong shape: what a
// crash mid-test would leave behind is the barrel import whose absence is
// the thing under test.
//
// The last block is the one with a long life: it holds the real gate's
// denylist to the same standard check-appcheck holds its exemptions — an
// entry is documentation, so it must say what it is and how it got in.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DENY as REAL_DENY, evaluateBootGraph, packagesOf } from "./fn-boot-rules.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GATE = "scripts/check-fn-boot.mjs";

const DENY = [
  { match: "@firebase/database-compat", why: "RTDB client; app is Firestore-only" },
  { match: "firebase-functions/lib/v1/", why: "v1 API; every function here is v2" },
];
const clean = ["lib/index.js", "lib/v2.js", "node_modules/firebase-admin/lib/firestore/index.js"];

describe("evaluateBootGraph", () => {
  it("passes a graph at its ceiling with nothing denied", () => {
    expect(evaluateBootGraph(clean, { maxModules: clean.length, deny: DENY })).toEqual([]);
  });

  it("names a denied package and every file of it", () => {
    // The real regression: one root-barrel import puts the Realtime
    // Database client in all 49 functions of a Firestore-only app.
    const graph = [...clean, "node_modules/@firebase/database-compat/dist/index.standalone.js"];
    const out = evaluateBootGraph(graph, { maxModules: graph.length, deny: DENY });
    const denied = out.filter((p) => p.rule === "deny");
    expect(denied).toHaveLength(1);
    expect(denied[0].match).toBe("@firebase/database-compat");
    expect(denied[0].hits).toEqual(["node_modules/@firebase/database-compat/dist/index.standalone.js"]);
  });

  it("catches a denied PATH inside a package the app does use", () => {
    // firebase-functions is a real dependency; its v1 half is not used.
    // A package-name test could not express that, which is why the rule
    // matches on substring.
    const graph = [...clean, "node_modules/firebase-functions/lib/v1/config.js"];
    const out = evaluateBootGraph(graph, { maxModules: graph.length, deny: DENY });
    expect(out.map((p) => p.match)).toContain("firebase-functions/lib/v1/");
  });

  it("reports several denied packages at once, not just the first", () => {
    // A single barrel import reintroduces both; a gate that stopped at one
    // would send the reader back for a second round.
    const graph = [
      ...clean,
      "node_modules/@firebase/database-compat/dist/index.standalone.js",
      "node_modules/firebase-functions/lib/v1/config.js",
    ];
    const denied = evaluateBootGraph(graph, { maxModules: graph.length, deny: DENY })
      .filter((p) => p.rule === "deny");
    expect(denied).toHaveLength(2);
  });

  it("fails on growth", () => {
    const out = evaluateBootGraph(clean, { maxModules: clean.length - 1, deny: DENY });
    expect(out).toEqual([{ rule: "grew", count: clean.length }]);
  });

  it("fails on a SHRINK too — check:globals rule 4's shape", () => {
    // The direction people forget. A ratchet that only notices growth lets
    // the number drift back up to an old ceiling for free.
    const out = evaluateBootGraph(clean, { maxModules: clean.length + 5, deny: DENY });
    expect(out).toEqual([{ rule: "shrank", count: clean.length }]);
  });

  it("reports a denied package AND the count in one pass", () => {
    const graph = [...clean, "node_modules/@firebase/database-compat/x.js"];
    const out = evaluateBootGraph(graph, { maxModules: clean.length, deny: DENY });
    expect(out.map((p) => p.rule).sort()).toEqual(["deny", "grew"]);
  });
});

describe("packagesOf", () => {
  it("collapses files to packages, scoped names kept whole", () => {
    expect([...packagesOf([
      "lib/index.js",
      "node_modules/firebase-admin/lib/firestore/index.js",
      "node_modules/firebase-admin/lib/auth/index.js",
      "node_modules/@grpc/grpc-js/build/src/index.js",
    ])].sort()).toEqual(["@grpc/grpc-js", "firebase-admin"]);
  });
});

describe("the real gate's denylist", () => {
  it("every entry says what it is and how it got in", () => {
    // check-appcheck's rule, applied here: the list is documentation, so an
    // entry with no reason is one the next reader can neither act on nor
    // safely delete. Asserted on the exported data rather than on the
    // script's source text, so a reformat cannot make this pass vacuously.
    expect(REAL_DENY.length).toBeGreaterThan(0);
    for (const entry of REAL_DENY) {
      expect(typeof entry.match, JSON.stringify(entry)).toBe("string");
      expect(entry.match.length).toBeGreaterThan(0);
      expect(entry.why.length, `${entry.match} needs a reason`).toBeGreaterThan(60);
    }
  });

  it("denies the two packages the 2026-09-12 barrel sweep removed", () => {
    // Named rather than counted: if a later cleanup drops one of these, the
    // diff has to say so out loud.
    expect(REAL_DENY.map((d) => d.match)).toEqual([
      "@firebase/database-compat",
      "firebase-functions/lib/v1/",
    ]);
  });

  it("carries a numeric baseline the script can rewrite", () => {
    // --pin edits this line with a regex; a reformatted declaration would
    // make the pin silently no-op and the gate unsatisfiable.
    const src = readFileSync(join(root, GATE), "utf8");
    expect(/^const MAX_MODULES = \d+;$/m.test(src)).toBe(true);
  });

  it("no module imports the root firebase-functions barrel", () => {
    // The live case, and the cheap half of the gate: check:fn-boot needs
    // functions/lib compiled, which the lint job builds on purpose — but the
    // CAUSE is visible in the source with no build at all, so a barrel
    // import that comes back fails test:scripts too, seconds after it lands
    // rather than after a tsc.
    //
    // Every logger member is the identical function object on both
    // specifiers, so nothing else in the tree can tell the difference —
    // which is exactly why this needs asserting rather than noticing.
    const dir = join(root, "functions/src");
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => /from\s+"firebase-functions";/.test(readFileSync(join(dir, f), "utf8")));
    expect(offenders, "import from firebase-functions/logger (or a v2 subpath) instead")
      .toEqual([]);
  });
});

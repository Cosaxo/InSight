// check-appcheck.test.mjs — the gate that stands between the public
// callable surface and the open internet, executed rather than trusted.
//
// WHY THIS FILE EXISTS. `enforceAppCheck` is a per-function option, so
// omitting it is SILENT: the function builds, deploys, passes every test
// and serves any caller. This script is the only thing that notices — and
// it had no test at all, in a repo where a gate that stopped working has
// already shipped four times (D179, D197, D275, and two of the three
// fixed on this branch).
//
// Every rule here fails silently by construction, because each one
// narrows a list and an empty list is exactly what "nothing wrong" looks
// like. That is the whole argument for driving them on fixtures.
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanCallables, appCheckProblems } from "./check-appcheck.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SRC = `
export const good = onCall(
  { ...LIGHT_CALLABLE, enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => { return 1; },
);
export const looksRight = onCall(
  { ...LIGHT_CALLABLE, enforceAppCheck: false },
  async (request) => { return 2; },
);
export const bare = onCall(
  { ...LIGHT_CALLABLE },
  async (request) => { assertOperator(request); return 3; },
);
`;

describe("scanCallables", () => {
  const scan = scanCallables(SRC, "x.ts");

  it("separates the enforcing from the unattested", () => {
    expect(scan.enforcing.map((c) => c.name)).toEqual(["good"]);
    expect(scan.missing.map((c) => c.name)).toEqual(["looksRight", "bare"]);
  });

  it("treats `enforceAppCheck: false` as unattested, not as attested", () => {
    // The one shape that LOOKS right and does the opposite. A presence
    // check would clear it; the gate demands the shared constant.
    const it_ = scan.missing.find((c) => c.name === "looksRight");
    expect(it_.note).toMatch(/other than ENFORCE_APP_CHECK/);
  });

  it("counts every onCall site, so an unparseable one cannot be skipped", () => {
    // The vacuity guard. A callable written in a form the pattern cannot
    // read must make the totals disagree — check-a11y.mjs shipped the
    // other behaviour: a file it could not parse scored zero and reported
    // clean.
    expect(scan.onCallSites).toBe(3);
    const odd = scanCallables(`${SRC}\nexport const weird = onCall(OPTS, async () => 4);\n`, "x.ts");
    expect(odd.onCallSites, "the extra onCall site was not counted").toBe(4);
    expect(
      odd.enforcing.length + odd.missing.length,
      "a callable this pattern cannot read was parsed anyway, so this proves nothing",
    ).toBe(3);
  });

  it("captures each callable's own body, ending at the next declaration", () => {
    expect(scan.bodies.get("bare")).toMatch(/assertOperator\(request\)/);
    expect(scan.bodies.get("good"), "one callable's body swallowed the next").not.toMatch(
      /assertOperator/,
    );
  });
});

describe("appCheckProblems", () => {
  const scan = scanCallables(SRC, "x.ts");
  const withGate = { bare: { gate: "assertOperator", reason: "operator-only" } };

  it("is silent when every unattested callable is exempt and calls its gate", () => {
    const only = scanCallables(
      SRC.replace(/export const looksRight[\s\S]*?\n\);\n/, ""),
      "x.ts",
    );
    expect(appCheckProblems(only, withGate)).toEqual([]);
  });

  it("names a callable that neither enforces nor is exempt", () => {
    expect(appCheckProblems(scan, withGate).join("\n")).toMatch(/looksRight/);
  });

  it("names an exemption whose callable does NOT call the gate it claims", () => {
    // The exemption's own claim, checked rather than printed. Before this
    // rule existed, removing the allowlist call from the callable that
    // rewrites the whole question bank left every gate in the repo green.
    const lying = scanCallables(SRC.replace("assertOperator(request); ", ""), "x.ts");
    expect(appCheckProblems(lying, withGate).join("\n")).toMatch(/do not call the gate/);
  });

  it("names an exemption for a callable that no longer exists", () => {
    const out = appCheckProblems(scan, { ...withGate, ghostFn: { gate: "assertOperator" } });
    expect(out.join("\n")).toMatch(/no longer exist.*ghostFn/s);
  });

  it("names an exemption that has outlived its reason", () => {
    // The ratchet's other direction: a callable that started enforcing
    // must leave the list, or the exemption stands as a template for the
    // next one.
    const out = appCheckProblems(scan, { ...withGate, good: { gate: "assertOperator" } });
    expect(out.join("\n")).toMatch(/still listed as exempt/);
  });

  it("fails when the parse did not reach every onCall site", () => {
    const out = appCheckProblems({ ...scan, onCallSites: scan.onCallSites + 1 }, withGate);
    expect(out.join("\n")).toMatch(/cannot parse|option blocks/);
  });
});

// ── the scan's REACH, driven as a subprocess ────────────────────────
//
// Everything above tests the two pure functions. The gap that shipped was
// in neither of them: the gate's census reads functions/src RECURSIVELY,
// while the scan that checks nobody has declared their own
// ENFORCE_APP_CHECK read the top level only. So a callable in a
// subdirectory was scanned, listed as attested, and never opened by the
// one check that would have noticed its local `= false`. Measured before
// the fix: the gate printed "29 callables, 21 enforcing App Check" and
// exited 0 with an unattested callable in the tree.
//
// Driven against a COPY of the real tree, because the reach is a property
// of the script's own body — there is nothing to import — and the claim is
// about what the gate does when a file is somewhere it did not look.
describe("the provenance scan reaches a subdirectory", () => {
  const run = (dir) => {
    try {
      return { code: 0, out: execFileSync("node", [join(dir, "scripts", "check-appcheck.mjs")],
        { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
    } catch (e) {
      return { code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
    }
  };
  const OPT_OUT = [
    "const ENFORCE_APP_CHECK = false;",
    "export const zzProbeV2 = onCall(",
    "  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },",
    "  async (request) => { return 1; },",
    ");",
    "",
  ].join("\n");

  /** The tracked tree, plus one planted callable at `rel`. */
  const treeWith = (rel) => {
    const dir = mkdtempSync(join(tmpdir(), "check-appcheck-"));
    execFileSync("bash", ["-c",
      `cd ${JSON.stringify(ROOT)} && git ls-files -z | tar --null -T - -cf - | tar -xf - -C ${JSON.stringify(dir)}`,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    const at = join(dir, rel);
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, OPT_OUT);
    return dir;
  };

  it("catches a callable that opts out from a subdirectory", () => {
    const dir = treeWith("functions/src/zzprobe/zz.ts");
    try {
      const r = run(dir);
      expect(r.code, `the gate passed an unattested callable:\n${r.out}`).toBe(1);
      expect(r.out).toMatch(/declared in more than one module[\s\S]*zzprobe\/zz\.ts/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  // THE CONTROL, and it is the one that says the case above is about REACH
  // rather than about the plant being malformed: the byte-identical file at
  // the top level was always caught, which is exactly why the gap survived.
  it("caught the byte-identical file at the top level all along", () => {
    const dir = treeWith("functions/src/zz.ts");
    try {
      expect(run(dir).code).toBe(1);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

// ── the two walks over functions/src must agree ──────────────────────
//
// The rules above are driven on fixtures, which is right for them and is
// exactly why this one has to be different: the defect was not in a rule,
// it was in the FILE LIST one rule was handed.
//
// The callable walk recurses, with a comment saying why. The provenance
// walk beside it did not. So a callable in a subdirectory was found by
// the first — counting toward "enforcing" — while the file declaring its
// own `ENFORCE_APP_CHECK = false` was invisible to the second. That is
// the scenario the provenance rule's own docblock describes, reached by a
// directory instead of by an import. Measured 2026-09-06: the same probe
// file at `functions/src/sub/zzprobe.ts` left the gate exit 0 with the
// enforcing count going UP; flat at `functions/src/`, exit 1.
//
// Latent while `functions/src` is flat — which is what
// `check-deploy-targets.mjs` says about this same shape, in those words,
// before the moderation.ts miss made it real there.
//
// A source assertion rather than a fixture run, deliberately: what is
// being pinned is that the two walks do not drift apart again, and that
// is a property of the file rather than of any tree it could be run on.
describe("the file walks", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "check-appcheck.mjs"), "utf8");

  it("both walks over functions/src are recursive", () => {
    const walks = [...src.matchAll(/readdirSync\(\s*SRC\s*(,[^)]*)?\)/g)];
    // The floor: if the walks are renamed or restructured this must fail
    // loudly rather than pass over an empty list.
    expect(walks.length, "the walks over SRC moved — re-read this rule before changing it").toBe(2);
    for (const w of walks) {
      expect(w[0], "a walk over functions/src stopped recursing").toContain("recursive: true");
    }
  });
});

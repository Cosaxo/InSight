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
import { scanCallables, appCheckProblems } from "./check-appcheck.mjs";

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

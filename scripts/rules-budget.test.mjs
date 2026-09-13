// rules-budget.test.mjs — the instrument's pure parts, without an emulator.
//
// The transforms are what make a measurement mean something: a filler that
// lands nowhere measures nothing and reports headroom for it, which is the
// D197 shape (a parser with a try/catch reporting an invented size). So the
// cases here are mostly about the transforms REFUSING — the anchor missing,
// the anchor doubled, a helper that does not exist — because those are the
// failures that would otherwise print a number.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CREATE_TAIL, PROBES, UPDATE_TAIL, ablate, bisect, classify, delta, evalCounts, judge, planGate, unchanged, withCalibrateBlock, withFillers } from "./rules-budget.mjs";

const RULE = [
  // The profile's create rule ends with the SAME line as the answer's —
  // that is not a contrivance, it is the tree, and it is what the first
  // run of the instrument tripped on. Kept here so scoping stays pinned.
  "    match /v2_users/{uid} {",
  "      allow create: if request.auth != null",
  `        ${CREATE_TAIL}`,
  "    match /answers/{aid} {",
  "        function isWorldAnswer() {",
  "          return request.resource.data.surface in [\"daily\"]",
  "            && request.resource.data.qid == aid;",
  "        }",
  "        function isDuelAnswer() {",
  "          let open = get(/databases/$(database)/documents/v2_groups/$(request.resource.data.gid)).data.get(\"round\", 1);",
  "          return request.resource.data.surface in [\"group\", \"duo\"]",
  "            && request.resource.data.round >= open;",
  "        }",
  "        allow create: if request.auth != null",
  "          && (isWorldAnswer() || isDuelAnswer())",
  `          ${CREATE_TAIL}`,
  "        allow update: if request.auth != null",
  "          && (!(\"editedAt\" in resource.data)",
  `            ${UPDATE_TAIL}`,
  "    }",
].join("\n");

describe("withFillers", () => {
  it("appends n fillers before the ANSWER create rule's terminating semicolon, and only there", () => {
    const out = withFillers(RULE, 3);
    expect(out).toContain('zzfill0');
    expect(out).toContain('zzfill2');
    expect(out).not.toContain('zzfill3');
    // Still one statement: the semicolon moved to the end of the fillers.
    expect(out).toMatch(/zzfill2";\n/);
    // The update arm is untouched.
    expect(out.split(UPDATE_TAIL).length - 1).toBe(1);
    // THE SCOPING. The profile's identical tail, above the answers block,
    // is untouched — a filler landing there would measure the wrong rule.
    const profileHalf = out.slice(0, out.indexOf("match /answers/{aid}"));
    expect(profileHalf).toContain(CREATE_TAIL);
    expect(profileHalf).not.toContain("zzfill");
  });

  it("refuses when the answers block itself is missing", () => {
    expect(() => withFillers(RULE.replace("match /answers/{aid}", "match /replies/{rid}"), 1))
      .toThrow(/no `match \/answers\/\{aid\}` block/);
  });

  it("can target the update arm instead", () => {
    const out = withFillers(RULE, 2, "update");
    expect(out).toMatch(/duration\.value\(60, 's'\)\)\n\s+&& request\.resource\.data\.surface != "zzfill0"/);
    expect(out).toContain(CREATE_TAIL);
  });

  it("n = 0 is the identity", () => {
    expect(withFillers(RULE, 0)).toBe(RULE);
  });

  // THE CASE THAT MATTERS. If the create rule's last conjunct is ever
  // reworded, a transform that fell back to the input unchanged would run
  // every bisection against unmodified rules and report the maximum as
  // headroom — a green number about nothing.
  it("REFUSES when the anchor is absent, rather than returning the input", () => {
    const moved = RULE.replaceAll(CREATE_TAIL, "&& isValidV2Anchors(request.resource.data.anchors);");
    expect(() => withFillers(moved, 1)).toThrow(/found 0 times in its block, expected 1/);
  });

  it("REFUSES when the anchor is doubled", () => {
    const doubled = `${RULE}\n${CREATE_TAIL}`;
    expect(() => withFillers(doubled, 1)).toThrow(/found 2 times/);
  });
});

describe("withCalibrateBlock", () => {
  const DOCS = [
    "rules_version = '2';",
    "service cloud.firestore {",
    "  match /databases/{database}/documents {",
    "    match /x/{id} { allow read: if true; }",
    "  }",
    "}",
  ].join("\n");

  it("inserts ONE block at the top of the documents match, with n heavy fillers of `weight` compares each", () => {
    const out = withCalibrateBlock(DOCS, 2, 3);
    expect(out.split("match /zz_calibrate/{id}").length - 1).toBe(1);
    expect(out.indexOf("match /zz_calibrate/{id}")).toBeLessThan(out.indexOf("match /x/{id}"));
    // 2 fillers × 3 compares, every literal distinct so none can fold.
    expect(new Set(out.match(/zzcal\d+_\d+/g)).size).toBe(6);
    expect(out).toMatch(/allow create: if request\.auth != null\n\s+&& \(request\.resource\.data\.surface != "zzcal0_0" && request\.resource\.data\.surface != "zzcal0_1" && request\.resource\.data\.surface != "zzcal0_2"\)\n\s+&& \(/);
    // The rest of the file is untouched.
    expect(out).toContain("    match /x/{id} { allow read: if true; }");
  });

  it("n = 0 is the bare block — the cost the bracket allows for", () => {
    expect(withCalibrateBlock(DOCS, 0, 5)).toContain("allow create: if request.auth != null;");
  });

  // The same refusal as withFillers, for the same reason: a block that
  // landed nowhere would bisect an unmodified file and call the compile
  // ceiling a unit.
  it("refuses when the documents match is absent or doubled", () => {
    expect(() => withCalibrateBlock("service x {}", 1, 5)).toThrow(/found 0 times, expected 1/);
    expect(() => withCalibrateBlock(`${DOCS}\n${DOCS}`, 1, 5)).toThrow(/found 2 times/);
  });
});

describe("ablate", () => {
  it("replaces exactly the named helper's body, at its own indent", () => {
    const out = ablate(RULE, "isDuelAnswer", "false");
    expect(out).toContain("function isDuelAnswer() {\n          return false;\n        }");
    // The `let` is gone with the body — that is the point of ablating an
    // arm to false: it must cost nothing on the way past.
    expect(out).not.toContain("let open");
    // Its neighbour is intact.
    expect(out).toContain("function isWorldAnswer() {\n          return request.resource.data.surface");
  });

  it("keeps the parameter list", () => {
    const withArgs = RULE.replace("function isWorldAnswer()", "function isWorldAnswer(d, q)");
    expect(ablate(withArgs, "isWorldAnswer", "true")).toContain("function isWorldAnswer(d, q) {\n          return true;");
  });

  it("refuses a helper that does not exist", () => {
    expect(() => ablate(RULE, "isNothing", "true")).toThrow(/no helper named isNothing/);
  });
});

describe("classify", () => {
  it("tells the two kinds of no apart, and no error is allowed", () => {
    expect(classify(null)).toBe("allowed");
    expect(classify(new Error("PERMISSION_DENIED: false for 'create' @ L1210"))).toBe("refused");
    expect(classify(new Error(
      "Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached.",
    ))).toBe("budget");
    // The emulator sometimes hands a string.
    expect(classify("7 PERMISSION_DENIED: maximum of 1000 expressions to evaluate")).toBe("budget");
  });
});

describe("evalCounts and delta", () => {
  const node = (line, counts, children = []) => ({
    sourcePosition: { line },
    values: counts.map((count) => ({ count, value: { boolValue: true } })),
    children,
  });
  const report = (...nodes) => ({ report: nodes });

  it("sums every node's counts, attributed to its line", () => {
    const c = evalCounts(report(node(10, [3], [node(11, [2, 1]), node(12, [4], [node(12, [1])])])));
    expect(c.total).toBe(11);
    expect(c.byLine.get(10)).toBe(3);
    expect(c.byLine.get(11)).toBe(3);
    expect(c.byLine.get(12)).toBe(5);
  });

  it("an empty report is zero, not an error", () => {
    expect(evalCounts({}).total).toBe(0);
    expect(evalCounts({ report: [] }).byLine.size).toBe(0);
  });

  it("delta drops the lines that did not move", () => {
    const before = evalCounts(report(node(10, [3]), node(11, [5])));
    const after = evalCounts(report(node(10, [3]), node(11, [9]), node(12, [1])));
    const d = delta(before, after);
    expect(d.total).toBe(5);
    expect(d.byLine.has(10)).toBe(false);
    expect(d.byLine.get(11)).toBe(4);
    expect(d.byLine.get(12)).toBe(1);
  });
});

describe("bisect", () => {
  const monotone = (limit) => async (n) => n <= limit;

  it("finds the largest passing n", async () => {
    expect(await bisect(monotone(42), 0, 300)).toBe(42);
    expect(await bisect(monotone(0), 0, 300)).toBe(0);
  });

  it("reports lo - 1 when even the floor fails, and hi when the ceiling passes", async () => {
    expect(await bisect(monotone(-1), 0, 300)).toBe(-1);
    expect(await bisect(monotone(1000), 0, 300)).toBe(300);
  });

  it("does not call more than ~log2(hi) times past the two endpoints", async () => {
    let calls = 0;
    const ok = async (n) => { calls += 1; return n <= 137; };
    await bisect(ok, 0, 400);
    expect(calls).toBeLessThanOrEqual(2 + 10);
  });
});

// ── the gate (D438): what it asserts is decided without an emulator ────

describe("planGate", () => {
  const PROBES = [
    { name: "legal", expect: "allowed" },
    { name: "refusal", expect: "refused" },
    { name: "edit", expect: "allowed", update: true },
  ];
  const baseline = (over = {}) => ({
    fillersOn: "create",
    floorFillers: 50,
    compileFloorFillers: 80,
    probes: [
      { name: "legal", fillers: 58, bounded: false },
      { name: "refusal", fillers: 94, bounded: true },
      { name: "edit", fillers: null, bounded: false },
    ],
    ...over,
  });

  it("pins a flippable probe on BOTH sides and holds a compile-bounded one at the floor", () => {
    const g = planGate(baseline(), PROBES);
    expect(g.floor).toBe(50);
    expect(g.compileFloor).toBe(80);
    expect(g.checks.map((c) => [c.probe.name, c.n, c.want])).toEqual([
      ["legal", 58, "unchanged"],
      ["legal", 59, "budget"],
      ["refusal", 50, "unchanged"],
    ]);
    // The update probe carries no create-arm pin and asks for nothing.
    expect(g.checks.some((c) => c.probe.name === "edit")).toBe(false);
  });

  // THE CASES THAT MATTER: every way the baseline could stop describing
  // the probes is a refusal to run, not a pass. A gate that measured the
  // old shape and said OK is the D197 failure with an emulator in it.
  it("refuses a probe with no row, and a row with no probe", () => {
    expect(() => planGate(baseline({ probes: baseline().probes.slice(1) }), PROBES)).toThrow(/no baseline row for the probe "legal"/);
    expect(() => planGate(baseline({ probes: [...baseline().probes, { name: "ghost", fillers: 10 }] }), PROBES)).toThrow(/rows with no probe behind them: ghost/);
  });

  it("refuses a pin under the floor — that is the change to argue, not the number to edit", () => {
    const b = baseline();
    b.probes[0].fillers = 49;
    expect(() => planGate(b, PROBES)).toThrow(/pinned at 49 fillers, under the floor of 50/);
  });

  it("refuses a pin that is not a headroom, a baseline without floors, and fillers on the wrong arm", () => {
    const b = baseline();
    b.probes[0].fillers = -1;
    expect(() => planGate(b, PROBES)).toThrow(/not a headroom/);
    expect(() => planGate(baseline({ floorFillers: undefined }), PROBES)).toThrow(/needs integer floorFillers/);
    expect(() => planGate(baseline({ compileFloorFillers: 50 }), PROBES)).toThrow(/compile floor above the runtime one/);
    expect(() => planGate(baseline({ fillersOn: "update" }), PROBES)).toThrow(/fillers are on the update arm/);
    expect(() => planGate(null, PROBES)).toThrow(/needs integer floorFillers/);
  });
});

describe("judge and unchanged", () => {
  const legal = { name: "legal", expect: "allowed" };
  const refusal = { name: "refusal", expect: "refused" };

  it("unchanged means allowed-still-allowed, or refused FOR A REASON", () => {
    expect(unchanged(legal, "allowed")).toBe(true);
    expect(unchanged(legal, "budget")).toBe(false);
    expect(unchanged(refusal, "refused")).toBe(true);
    // A refusal by budget is the thing the whole gate exists to catch.
    expect(unchanged(refusal, "budget")).toBe(false);
    expect(unchanged(refusal, "compile")).toBe(false);
  });

  it("the far side of a pin wants BUDGET specifically — a variant that did not load is not a flip", () => {
    expect(judge({ probe: legal, n: 59, want: "budget" }, "budget").ok).toBe(true);
    expect(judge({ probe: legal, n: 59, want: "budget" }, "compile").ok).toBe(false);
    expect(judge({ probe: legal, n: 59, want: "budget" }, "allowed").ok).toBe(false);
    expect(judge({ probe: legal, n: 58, want: "unchanged" }, "allowed")).toMatchObject({ n: 58, verdict: "allowed", ok: true });
  });
});

// ── a probe may not carry a date ──────────────────────────────────────
//
// `isPulseAnswer` bounds a pulse answer's `day` to (now - 4d, now + 2d),
// because a pulse answer is about a day. The pulse probe carried the
// literal date it was written on, so four days later it fell out of that
// window: the probe was refused at every filler count, the gate reported
// a moved pin, and `npm run test:rules` went red on main — on the path
// backend-checks.yml guards for production — and would have stayed red
// every day after. Nothing about the rule or the app had changed, and
// re-pinning would have recorded a fiction.
//
// The class is the one this repo keeps meeting: a fixture that expires.
// It is cheap to refuse outright, so this refuses it outright — a probe
// that needs a date computes it.
describe("no probe carries a frozen date", () => {
  it("has no literal YYYY-MM-DD in the probe table's own source", () => {
    // Read off the SOURCE, not off the value: a computed date is a date
    // string by the time the table is built, so only the text can tell a
    // frozen one from a live one. Comment lines are stripped first —
    // naming the day this went wrong is exactly what a comment is for.
    const src = readFileSync(fileURLToPath(new URL("./rules-budget.mjs", import.meta.url)), "utf8");
    const table = src.slice(src.indexOf("export const PROBES = ["));
    const body = table.slice(0, table.indexOf("\n];"))
      .split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");
    expect(body.match(/\d{4}-\d{2}-\d{2}/g),
      "a probe pins a date, and a rule that bounds a date window will age it out").toBeNull();
  });

  it("…and the pulse probe's day is today, so the window it is measured in is the live one", () => {
    const pulse = PROBES.find((p) => p.name === "pulse");
    expect(pulse, "the pulse probe is gone — this case is pinning nothing").toBeTruthy();
    expect(pulse.data.day).toBe(new Date().toISOString().slice(0, 10));
    expect(pulse.aid).toBe(`${pulse.data.baseQid}_${pulse.data.day}`);
  });
});

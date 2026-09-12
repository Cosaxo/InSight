// rules-coverage.test.mjs — the coverage ratchet's own tripwires.
//
// This gate reads a 145 MB report from a live emulator, so its parts are
// pure and driven from fixtures here. What matters is that it cannot pass
// vacuously: a walker that stopped finding predicates, or a verdict that
// shrugged at a rise, would report "OK" over exactly the situation it
// exists to catch.
import { describe, it, expect } from "vitest";
import { booleanAtoms, neverFalse, verdict } from "./rules-coverage.mjs";

/** One node as the emulator emits it. */
const node = (line, offset, values, children = []) => ({
  sourcePosition: { line, column: 1, currentOffset: offset, endOffset: offset + 10 },
  values,
  children,
});
const B = (v, count) => ({ value: { boolValue: v }, count });
const S = (v, count) => ({ value: { stringValue: v }, count });

describe("booleanAtoms — what counts as an atom", () => {
  it("keeps a boolean leaf", () => {
    const atoms = booleanAtoms({ report: [node(10, 100, [B(true, 5), B(false, 2)])] });
    expect(atoms.size).toBe(1);
    expect(atoms.get("100:110")).toEqual({ line: 10, t: 5, f: 2, e: 0 });
  });

  it("DROPS a composite whose children are booleans", () => {
    // `a && b` evaluates to a boolean too. Counting it counts the same
    // conjunct twice: this walker read 681 atoms before the rule was
    // narrowed, against 353 once it was — the whole &&/|| chain doubled.
    // The chain spans BOTH children, so its own range differs from either.
    // Written with the same range as child `a` first, which made the two
    // merge in the output map and the assertion pass with the rule
    // deleted — verified by mutation. A case standing for the 681-vs-353
    // double count has to be able to see the double count.
    const a = node(10, 100, [B(true, 5), B(false, 1)]);
    const b = node(10, 120, [B(true, 5)]);
    const chain = { ...node(10, 100, [B(true, 5), B(false, 1)], [a, b]) };
    chain.sourcePosition = { line: 10, column: 1, currentOffset: 100, endOffset: 130 };
    const atoms = booleanAtoms({ report: [chain] });
    expect([...atoms.keys()].sort()).toEqual(["100:110", "120:130"]);
  });

  it("drops a boolean node with a boolean GRANDchild", () => {
    const leaf = node(10, 130, [B(true, 1)]);
    const mid = node(10, 120, [], [leaf]);
    const top = node(10, 100, [B(true, 1)], [mid]);
    expect([...booleanAtoms({ report: [top] }).keys()]).toEqual(["130:140"]);
  });

  it("ignores non-boolean values — those are operands, not predicates", () => {
    const atoms = booleanAtoms({ report: [node(10, 100, [S("Oslo", 3), S("Mira", 2)])] });
    expect(atoms.size).toBe(0);
  });

  it("counts one expression once however many paths reach it", () => {
    const atoms = booleanAtoms({
      report: [node(10, 100, [B(true, 3)]), node(10, 100, [B(false, 4)])],
    });
    expect(atoms.size).toBe(1);
    expect(atoms.get("100:110")).toEqual({ line: 10, t: 3, f: 4, e: 0 });
  });

  it("counts a non-boolean value on a boolean node as an EVALUATION, not as nothing", () => {
    // Rules short-circuit on an ERROR as well as on false — `x is int` on
    // a document with no `x` errors rather than returning false — and the
    // emulator reports that evaluation with a non-boolean value on the
    // same node. It was dropped, so the predicate read `true N×, false 0`
    // and landed on a list meaning "nothing tests this". Measured on
    // firestore.rules:1251, the guard keeping rank answers out of the D86
    // edit arm: reported never-false, and deleting it turns the suite red.
    const atoms = booleanAtoms({ report: [node(10, 100, [B(true, 6), S("err", 3)])] });
    expect(atoms.get("100:110")).toEqual({ line: 10, t: 6, f: 0, e: 3 });
    expect(neverFalse(atoms), "an errored negative case still read as untested").toEqual([]);
    // …and one with neither a false nor an error is still named.
    const bare = booleanAtoms({ report: [node(11, 200, [B(true, 6)])] });
    expect(neverFalse(bare).map((n) => n.line)).toEqual([11]);
  });

  it("survives a report with no nodes rather than throwing", () => {
    expect(booleanAtoms({ report: [] }).size).toBe(0);
    expect(booleanAtoms({}).size).toBe(0);
  });
});

describe("neverFalse — the ones a deletion would hide", () => {
  it("names only the predicates with no false evaluation, in source order", () => {
    const atoms = booleanAtoms({
      report: [
        node(30, 300, [B(true, 9)]),
        node(10, 100, [B(true, 5), B(false, 1)]),
        node(20, 200, [B(true, 7)]),
      ],
    });
    expect(neverFalse(atoms).map((n) => n.line)).toEqual([20, 30]);
  });

  it("counts a predicate that ONLY evaluated false as covered", () => {
    // Never true is a different problem (dead rule), not this one.
    const atoms = booleanAtoms({ report: [node(10, 100, [B(false, 4)])] });
    expect(neverFalse(atoms)).toEqual([]);
  });
});

describe("verdict — the ratchet, in both directions", () => {
  it("passes on the baseline", () => {
    expect(verdict(96, 353, 96).ok).toBe(true);
    expect(verdict(96, 353, 96).message).toMatch(/96 of 353/);
    // …AND THE HALF IT DID NOT SEE. `rules.test.ts` runs a second
    // environment over a patched ruleset (`insight-rules-enforced`), and
    // this gate reads only the first — so a predicate whose only FALSE
    // lives there counts as never-false and the number overstates. That is
    // a stated gap rather than a closed one, and a success line that reads
    // as the suite's whole coverage is how a stated gap becomes a
    // forgotten one.
    expect(
      verdict(96, 353, 96).message,
      "the success line no longer says it read one environment of two",
    ).toMatch(/ONE of the suite's two rule environments/);
  });

  it("FAILS when the count rises — a new rule with no negative test", () => {
    // Measured on the real tree: adding one conjunct that no test makes
    // false left all 179 rules tests green and moved this to 97.
    const v = verdict(97, 354, 96);
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/97 atomic predicates never evaluate FALSE, baseline 96/);
    expect(v.message).toMatch(/delete one and it stays green/);
  });

  it("FAILS when the count falls, asking for the baseline to come down", () => {
    // check:globals rule 4's discipline: a ratchet that is not tightened
    // only ever loosens.
    const v = verdict(95, 353, 96);
    expect(v.ok).toBe(false);
    expect(v.message).toMatch(/went DOWN/);
    expect(v.message).toMatch(/test:rules:baseline/);
  });
});

// ── a baseline the ratchet cannot read is not a pass ───────────────────
//
// Both comparisons in `verdict` are `>` and `<`, and both are false
// against `undefined` or `NaN`, so an unreadable baseline fell through to
// the OK arm — printing "(baseline undefined)" inside a line that says
// the ratchet held. Every other way this gate can lose its subject
// already refuses loudly; this was the one that did not.
describe("the baseline itself", () => {
  it("refuses anything that is not a count, rather than passing", () => {
    for (const bad of [undefined, NaN, null, "7", -1, 1.5]) {
      const r = verdict(7, 300, bad);
      expect(r.ok, `a baseline of ${JSON.stringify(bad)} was read as a pass`).toBe(false);
      expect(r.message).toMatch(/is not a count/);
    }
  });

  it("still passes on a real one, and still ratchets in both directions", () => {
    // The control: a guard that refused everything would satisfy the case
    // above and delete the gate.
    expect(verdict(7, 300, 7).ok).toBe(true);
    expect(verdict(8, 300, 7).ok, "a predicate that stopped refusing was let through").toBe(false);
    expect(verdict(6, 300, 7).ok, "the ratchet was not asked to tighten").toBe(false);
    expect(verdict(0, 300, 0).ok, "a zero baseline is a real one").toBe(true);
  });
});

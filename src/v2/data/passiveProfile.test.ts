// The passive fold's THRESHOLD (D121).
//
// The arithmetic underneath is similarity.ts's and has its own suite; what
// these cases hold is the decision this module exists to make — when a
// partial fold has earned the right to be called a result. That matters
// more than it sounds: the card it feeds draws an archetype, a rarity
// percentile and a "textbook fit" badge, and every one of those is a
// confident claim about a person that two answers can produce.

import { describe, expect, it } from "vitest";
import { MIN_AXIS_ITEMS, passiveProfile, passiveResult, passiveTest } from "./passiveProfile";
import { parseTestResults } from "./similarity";
import type { TestBankItem, TestDefs } from "./similarity";

// One instrument, two axes, three items each. Prompts are the join key —
// the bank carries no dim and no invert flag, which is the whole reason
// testItemMeta matches on text (similarity.ts).
const DEFS: TestDefs = {
  mini: {
    title: "Mini",
    dims: [{ id: "a", label: "Axis A" }, { id: "b", label: "Axis B" }],
    questions: [
      { q: "a one", d: "a" },
      { q: "a two", d: "a" },
      { q: "a three", d: "a", invert: true },
      { q: "b one", d: "b" },
      { q: "b two", d: "b" },
      { q: "b three", d: "b" },
    ],
  },
};

const LIKERT = ["1", "2", "3", "4", "5"];
const BANK: TestBankItem[] = DEFS.mini.questions.map((q, i) => ({
  id: `q${i}`, prompt: q.q, test: "mini", options: LIKERT,
}));

const fold = (votes: Record<string, number>) => passiveTest("mini", DEFS.mini, BANK, DEFS, votes);

describe("passiveTest — what the fold knows", () => {
  it("counts only this instrument's own answered items", () => {
    // q0/q3 answered; a world question the viewer also answered is not in
    // the bank slice and must not inflate the denominator OR the count.
    const t = fold({ q0: 4, q3: 1, world_1: 2 });
    expect(t!.answered).toBe(2);
    expect(t!.total).toBe(6);
  });

  it("ignores a vote that is not a point on the 5-point scale", () => {
    // The scale is 0..4. A continuum card's bucket index or a corrupt
    // localStorage entry must not score as agreement.
    const t = fold({ q0: 9, q1: -1, q2: 1.5 as number, q3: 2 });
    expect(t!.answered).toBe(1);
  });

  it("is not ready on one answer per axis — that is a coin flip with a number", () => {
    const t = fold({ q0: 4, q3: 0 });
    expect(t!.ready).toBe(false);
    // Both axes named, because both are under the floor.
    expect(t!.thin).toEqual(["Axis A", "Axis B"]);
  });

  it("names an axis nobody has touched, not just the thin ones", () => {
    // Axis A is finished, B has nothing. A fold that only listed axes it
    // had SEEN would report this instrument as ready with half of it
    // missing — the failure the `ready` flag exists to prevent.
    const t = fold({ q0: 4, q1: 4, q2: 0 });
    expect(t!.ready).toBe(false);
    expect(t!.thin).toEqual(["Axis B"]);
  });

  it("is ready once every axis clears the floor", () => {
    const t = fold({ q0: 4, q1: 3, q3: 1, q4: 0 });
    expect(MIN_AXIS_ITEMS).toBe(2);
    expect(t!.ready).toBe(true);
    expect(t!.thin).toEqual([]);
  });

  it("returns null for an instrument the bank carries nothing for", () => {
    // Not an empty fold — null. A test with no items in the bank is a
    // different state from one nobody has answered, and a surface that
    // drew "0 of 0 answered" for it would be describing a bug as progress.
    expect(passiveTest("ghost", DEFS.mini, [], DEFS, {})).toBeNull();
    expect(passiveTest("mini", undefined, BANK, DEFS, {})).toBeNull();
  });
});

describe("passiveResult — the shape the profile renders", () => {
  it("refuses a fold that is not ready", () => {
    expect(passiveResult(fold({ q0: 4 }), "Mini")).toBeNull();
    expect(passiveResult(null, "Mini")).toBeNull();
  });

  it("hands back dims in the stored-result shape, marked as a fold", () => {
    const r = passiveResult(fold({ q0: 4, q1: 4, q3: 0, q4: 0 }), "Mini")!;
    expect(r.passive).toBe(true);
    expect(r.dims.map((d) => d.id)).toEqual(["a", "b"]);
    // 4/4 on both A items → 100; 0/4 on both B items → 0. Same
    // normalisation the sit-down flow used, so the rose and the archetype
    // match read a passive result exactly as they read a taken one.
    expect(r.dims.map((d) => d.value)).toEqual([100, 0]);
    expect(r.answered).toBe(4);
    expect(r.total).toBe(6);
  });

  it("says where the numbers came from instead of when it was taken", () => {
    // The sit-down flow wrote "just now" and the field means "when you sat
    // down for it" — which a fold over answers given across weeks does not
    // have. Naming the answers is the true version of the same line.
    const r = passiveResult(fold({ q0: 4, q1: 4, q3: 0, q4: 0 }), "Mini")!;
    expect(r.taken).toMatch(/4 of your answers/);
    expect(r.taken).not.toMatch(/just now|ago/);
  });

  it("honours an inverted item rather than scoring it as-keyed", () => {
    // q2 is `invert`. Agreeing with it must pull the axis DOWN — the one
    // mistake that poisons an axis silently instead of thinning it.
    const straight = passiveResult(fold({ q0: 4, q1: 4, q3: 2, q4: 2 }), "Mini")!;
    const withInvert = passiveResult(fold({ q0: 4, q1: 4, q2: 4, q3: 2, q4: 2 }), "Mini")!;
    expect(withInvert.dims[0].value).toBeLessThan(straight.dims[0].value);
  });
});

describe("passiveProfile — every instrument at once", () => {
  it("folds each key and drops the ones with no bank items", () => {
    const defs: TestDefs = { ...DEFS, other: { title: "Other", dims: [], questions: [] } };
    const out = passiveProfile(defs, BANK, { q0: 4, q3: 1 });
    expect(Object.keys(out)).toEqual(["mini"]);
  });
});

// ── the round trip that makes the score tier able to fire (D277) ─────
//
// WHY THIS SUITE GAINED A SECTION. The fold above was always correct and
// was never written down anywhere another person could read it. D121
// deleted the sit-down flow — the only thing that had ever written
// `testResults` — so from that commit until D277 the four core keys were
// absent on every live profile, `parseTestResults` returned null for every
// candidate, `rankKindred`'s score tier could not fire, and the City ring
// that D112 specified as "ranked primarily by test scores" ranked entirely
// on answer agreement. Nothing failed. Every gate stayed green, because
// the two halves — what the fold emits, and what a stranger's client reads
// back — had no test that put them in the same sentence.
//
// These cases are that sentence. They are deliberately about the SHAPE
// CONTRACT rather than the arithmetic: the arithmetic has its suite above
// and in similarity.test.ts, and it was never what broke.
describe("passiveResult → parseTestResults — what one device writes, another reads", () => {
  it("parses back to the axis values it was built from", () => {
    const r = passiveResult(fold({ q0: 4, q1: 4, q3: 0, q4: 0 }), "Mini")!;
    // The store writes it under the instrument key; a reader on another
    // device parses the whole `testResults` map back through the same
    // defensive read every stranger profile goes through.
    const parsed = parseTestResults({ mini: r }, ["mini"]);
    expect(parsed).not.toBeNull();
    expect(parsed!.mini).toEqual({
      a: r.dims.find((d) => d.id === "a")!.value,
      b: r.dims.find((d) => d.id === "b")!.value,
    });
  });

  it("survives the JSON round trip a Firestore write actually makes", () => {
    // saveTestResult setDocs the object and hydrate reads it back off the
    // wire, so the contract is over the SERIALISED form, not the in-memory
    // one. A field that does not survive JSON would fail here and nowhere
    // else.
    const r = passiveResult(fold({ q0: 3, q1: 3, q3: 1, q4: 1 }), "Mini")!;
    const overTheWire = JSON.parse(JSON.stringify({ mini: r }));
    expect(parseTestResults(overTheWire, ["mini"])).toEqual(parseTestResults({ mini: r }, ["mini"]));
  });

  it("carries the `passive` marker that keeps a sit-down result from being overwritten", () => {
    // live.ts's syncPassiveResults only ever moves a key that is absent or
    // that this fold wrote. `passive: true` is the whole basis for that
    // second half, so it is a contract and not a decoration.
    const r = passiveResult(fold({ q0: 4, q1: 4, q3: 0, q4: 0 }), "Mini")!;
    expect(r.passive).toBe(true);
  });

  it("an unready fold publishes nothing at all, rather than a thin result", () => {
    // The threshold is the point. One answer per axis parses to a perfectly
    // well-formed pair of extremes, which is exactly the confident claim
    // D121 refused — so the refusal has to happen before the write, not
    // after the read.
    expect(passiveResult(fold({ q0: 4, q3: 0 }), "Mini")).toBeNull();
  });
});

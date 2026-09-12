// The comparison-gate library, tested for the two things it exists to
// guarantee: that a comparison is cheap to write, and that a scan which
// found nothing CANNOT report success.
//
// That second property is the whole point and it is the one a gate
// library can actually enforce. D179, D197 and D275 are three separate
// occasions in this repository where a check went silently vacuous — a
// stale parser, a swallowed error, a tripwire counting a call shape the
// code had moved past — and in all three the gate stayed green while the
// thing it guarded drifted. Every entry point here refuses that state
// unless the caller declares, in the call, that empty is legitimate and
// says why.
import { describe, expect, it } from "vitest";
import { compareSets, compareValues, findingsOf, refuseVacuous, Vacuous } from "./compare.mjs";

const side = (name, items) => ({ name, items });

describe("refuseVacuous", () => {
  it("throws on an empty scan rather than letting it pass", () => {
    expect(() => refuseVacuous(0, { side: "firestore.rules" })).toThrow(Vacuous);
    // …and the message has to name the artifact, because the reader's
    // first question is always "which side found nothing".
    expect(() => refuseVacuous(0, { side: "firestore.rules" })).toThrow(/firestore\.rules/);
  });

  it("names the D275 class in the failure, so the fix is not 'lower the floor'", () => {
    expect(() => refuseVacuous(0, { side: "x" })).toThrow(/do not\s+lower/);
  });

  it("allows an empty side only with a stated reason, and prints it", () => {
    // A boolean would let "0 is fine" be asserted without an argument,
    // which is how a stale scan shape survives a review. The reason is
    // returned as a note so an empty pass is visible in the gate output
    // rather than silent.
    const note = refuseVacuous(0, { side: "web/catalog-art", emptyIsLegal: "empty until an operator runs the builder" });
    expect(note).toMatch(/web\/catalog-art/);
    expect(note).toMatch(/until an operator/);
  });

  it("passes silently once the floor is met", () => {
    expect(refuseVacuous(3, { side: "x", floor: 3 })).toBeNull();
  });
});

describe("compareSets", () => {
  it("reports the two directions apart, because they are different bugs", () => {
    // "declared but not written down" and "written down but not declared"
    // have different fixes and different risk. A gate that says only
    // "these differ" makes the reader work that out again every time.
    const r = compareSets(side("A", ["x", "y"]), side("B", ["y", "z"]));
    expect(r.onlyLeft).toEqual(["x"]);
    expect(r.onlyRight).toEqual(["z"]);
  });

  it("is clean when the two agree", () => {
    const r = compareSets(side("A", ["x", "y"]), side("B", ["y", "x"]));
    expect(r.onlyLeft).toEqual([]);
    expect(r.onlyRight).toEqual([]);
  });

  it("refuses a comparison where either side scanned nothing", () => {
    expect(() => compareSets(side("A", []), side("B", ["x"]))).toThrow(Vacuous);
    expect(() => compareSets(side("A", ["x"]), side("B", []))).toThrow(Vacuous);
  });

  it("refuses a nameless side", () => {
    // The output names both artifacts on every line; a side with no name
    // produces a failure nobody can act on.
    expect(() => compareSets({ items: ["x"] }, side("B", ["x"]))).toThrow(/name/);
  });
});

describe("compareValues", () => {
  it("separates a missing key from a disagreeing one", () => {
    const r = compareValues(
      { name: "A", values: { a: 1, b: 2, c: 3 } },
      { name: "B", values: { a: 1, b: 99, d: 4 } },
    );
    expect(r.differ).toEqual([{ key: "b", left: 2, right: 99 }]);
    expect(r.onlyLeft).toEqual(["c"]);
    expect(r.onlyRight).toEqual(["d"]);
  });

  it("takes a custom equality, so a gate can compare shapes rather than strings", () => {
    const r = compareValues(
      { name: "A", values: { a: { n: 1 } } },
      { name: "B", values: { a: { n: 1 } } },
      { same: (x, y) => x.n === y.n },
    );
    expect(r.differ).toEqual([]);
  });

  it("accepts a Map as well as an object", () => {
    const r = compareValues(
      { name: "A", values: new Map([["a", 1]]) },
      { name: "B", values: new Map([["a", 2]]) },
    );
    expect(r.differ).toHaveLength(1);
  });

  it("refuses an empty side, like compareSets", () => {
    expect(() => compareValues({ name: "A", values: {} }, { name: "B", values: { a: 1 } })).toThrow(Vacuous);
  });
});

describe("findingsOf", () => {
  it("names BOTH artifacts on every line", () => {
    // A failure that names one file makes the reader open two to find out
    // which is wrong.
    const r = compareSets(side("app-privacy.json", ["HEALTH"]), side("play-data-safety.json", ["GENDER"]));
    const lines = findingsOf(r);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).toContain("app-privacy.json");
      expect(line).toContain("play-data-safety.json");
    }
  });

  it("lets the gate say what each direction MEANS in its own domain", () => {
    const r = compareSets(side("Apple", ["HEALTH"]), side("Play", []), { rightMayBeEmpty: "test" });
    const [line] = findingsOf(r, { onlyLeft: "declared to %L but not to %R" });
    expect(line).toBe("declared to Apple but not to Play: HEALTH");
  });

  it("renders a value disagreement with both sides' values", () => {
    const r = compareValues({ name: "A", values: { k: "yes" } }, { name: "B", values: { k: "no" } });
    const [line] = findingsOf(r);
    expect(line).toContain('A says "yes"');
    expect(line).toContain('B says "no"');
  });
});

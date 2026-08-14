// @vitest-environment jsdom
//
// The test this module shipped without (D141), written because its
// absence cost the whole card.
//
// `typeOfPerson` read `results[TYPE_TEST].dims` — the RAW profile shape —
// off a `KindredPerson.results`, which has been through
// `parseTestResults` and is a FLAT axes map with no `dims` key. So it
// returned null for every person who ever had a result, `typeMixFor`
// filtered its entire sample away, and the type-mix card drew "nothing
// typed here" on every population in live mode. Nothing caught it: both
// shapes are `Record`s so the `as Dim[]` cast satisfied tsc, the module
// had no test, and the failure mode is a legitimate empty state the card
// was designed to draw.
//
// jsdom because archetype-data.js publishes its matcher onto `window`.
import { describe, expect, it } from "vitest";
import { CORE_TEST_KINDS, parseTestResults, type KindredPerson } from "./similarity";
import { TYPE_TEST, typeLine, typeNames, typeOfParsed, typeOfPerson } from "./typeMix";

/** A profile's `testResults` as the owner's client writes it. */
const rawBig5 = (dims: Record<string, number>) => ({
  big5: {
    title: "Big Five",
    taken: "2026-08-01",
    dims: Object.entries(dims).map(([id, value]) => ({ id, label: id, value })),
  },
});

const parsed = (dims: Record<string, number>) =>
  parseTestResults(rawBig5(dims), CORE_TEST_KINDS);

const person = (dims: Record<string, number>): KindredPerson => ({
  uid: "u1",
  name: "A",
  city: "",
  like: { pct: 0, shared: 0, same: 0 },
  results: parsed(dims),
});

describe("the parsed shape", () => {
  // The regression's root fact, pinned on its own so a future change to
  // parseTestResults that re-introduces `dims` cannot silently make the
  // cases below pass for the wrong reason.
  it("is a flat axes map, with no dims array", () => {
    const p = parsed({ O: 88, C: 40, E: 75, A: 55, N: 45 });
    expect(p).toEqual({ big5: { O: 88, C: 40, E: 75, A: 55, N: 45 } });
    expect((p as unknown as Record<string, { dims?: unknown }>).big5.dims).toBeUndefined();
  });
});

describe("typeOfParsed", () => {
  it("types a parsed result rather than returning null for it", () => {
    expect(typeOfParsed(parsed({ O: 88, C: 40, E: 75, A: 55, N: 45 }))).not.toBeNull();
  });

  it("returns a name the archetype system actually defines", () => {
    const t = typeOfParsed(parsed({ O: 88, C: 40, E: 75, A: 55, N: 45 }));
    expect(typeNames()).toContain(t);
    // A name that matches nothing would still be truthy and would still
    // render — it would just never line up with a chip or a definition.
    expect(typeLine(t as string)).not.toBe("");
  });

  it("separates two clearly different profiles", () => {
    // The Quiet One's signature is E 15; The Live Wire's is E 90. If these
    // collapse to one name the matcher is not reading the axes at all,
    // which is the failure the null bug was hiding.
    const introvert = typeOfParsed(parsed({ O: 72, C: 55, E: 15, A: 58, N: 50 }));
    const extravert = typeOfParsed(parsed({ O: 60, C: 32, E: 90, A: 58, N: 45 }));
    expect(introvert).not.toBe(extravert);
  });

  it("refuses absence rather than inventing a type", () => {
    expect(typeOfParsed(null)).toBeNull();
    expect(typeOfParsed(undefined)).toBeNull();
    expect(typeOfParsed({})).toBeNull();
    // A result for a different instrument is not a Big Five.
    expect(typeOfParsed({ political: { econ: 50 } })).toBeNull();
  });

  it("survives a hostile profile without throwing", () => {
    // testResults is client-written and shape-unvalidated by the rules, so
    // the parse is the defence and this is the caller proving it holds.
    expect(typeOfParsed(parseTestResults({ big5: { dims: "nope" } }, CORE_TEST_KINDS))).toBeNull();
    expect(typeOfParsed(parseTestResults("nope", CORE_TEST_KINDS))).toBeNull();
  });
});

describe("typeOfPerson", () => {
  it("types a person built the way the store builds them", () => {
    expect(typeOfPerson(person({ O: 88, C: 40, E: 75, A: 55, N: 45 }))).not.toBeNull();
  });

  it("agrees with typeOfParsed — one matcher, not two", () => {
    const dims = { O: 42, C: 85, E: 42, A: 80, N: 28 };
    expect(typeOfPerson(person(dims))).toBe(typeOfParsed(parsed(dims)));
  });

  it("returns null for a person with no scores", () => {
    expect(typeOfPerson({ ...person({ O: 1 }), results: null })).toBeNull();
  });
});

describe("the type system itself", () => {
  it("names every type exactly once", () => {
    const names = typeNames();
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });

  it("is the Big Five, deliberately", () => {
    // The politics result is Art. 9 data and is kept off every population
    // surface (docs/data-inventory.md). A change here is a decision, not a
    // refactor.
    expect(TYPE_TEST).toBe("big5");
  });
});

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
import { afterEach, describe, expect, it } from "vitest";
import LIVE from "./live";
import { CORE_TEST_KINDS, parseTestResults, type KindredPerson } from "./similarity";
import { TYPE_SYSTEMS, TYPE_TEST, typeLine, typeNames, typeOfParsed, typeOfPerson, typeSharesOn } from "./typeMix";

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

  it("defaults to the Big Five", () => {
    // Until D199 this constant was the ENFORCEMENT of a scope promise and
    // this case said so. D199 reversed D157 §4 on the owner's call, so the
    // constant is now only the instrument a reader who has not chosen one
    // gets. Changing THAT is still a decision rather than a refactor — it
    // moves which system every first-time reader sees.
    expect(TYPE_TEST).toBe("big5");
  });
});

// ── how common a type is, measured (D157) ───────────────────────────
//
// The profile's type-index sheet drew `IS_ARCHETYPES[].share` under the
// heading "bar = how common": authored percentages, on the sheet you open
// from a card that has just told you which one is yours. These cases pin
// the replacement's two halves — it measures, and it refuses.
describe("typeSharesOn", () => {
  const store = LIVE as typeof LIVE & { enabled: boolean; kindredPeople: () => unknown[] };
  const real = { enabled: store.enabled, kindredPeople: store.kindredPeople };
  afterEach(() => { Object.assign(store, real); });

  const crowd = (dims: Record<string, number>, n: number, tag: string) =>
    Array.from({ length: n }, (_, i) => ({ ...person(dims), uid: `${tag}${i}` }));

  it("is null in a demo build — the authored share is the content there", () => {
    store.enabled = false;
    store.kindredPeople = () => crowd({ O: 72, C: 55, E: 15, A: 58, N: 50 }, 20, "q");
    expect(typeSharesOn(TYPE_TEST)).toBeNull();
  });

  it("answers for every instrument the archetype module defines (D199)", () => {
    // This case is the inverse of the one it replaces. It used to assert
    // that politics, values and attachment each returned null — the Art. 9
    // scope D141 enforced and D157 §4 declined to widen. D199 reversed
    // that, so all four now answer, and the case stays to pin the reversal
    // rather than being deleted: a silent return to null would be a
    // promise moving back without a record.
    store.enabled = true;
    store.kindredPeople = () => [];
    for (const { kind } of TYPE_SYSTEMS) expect(typeSharesOn(kind)).not.toBeNull();
  });

  it("still refuses a key the archetype module does not define", () => {
    // The D72 posture survives the widening: null rather than an empty
    // system folded into a card of zeroes, so a caller that forgets the
    // check fails a test instead of drawing a fabricated population.
    store.enabled = true;
    store.kindredPeople = () => [];
    expect(typeSharesOn("logic")).toBeNull();
    expect(typeSharesOn("nonesuch")).toBeNull();
  });

  it("counts the sample and divides by the people it could type", () => {
    const quiet = { O: 72, C: 55, E: 15, A: 58, N: 50 };
    const loud = { O: 60, C: 32, E: 90, A: 58, N: 45 };
    store.enabled = true;
    store.kindredPeople = () => [
      ...crowd(quiet, 6, "q"),
      ...crowd(loud, 2, "l"),
      // Two people in the sample with no result at all: they count toward
      // the sample, never toward the shares.
      { ...person(quiet), uid: "n1", results: null },
      { ...person(quiet), uid: "n2", results: null },
    ];
    const shares = typeSharesOn(TYPE_TEST)!;
    expect(shares.sampleN).toBe(10);
    expect(shares.typedN).toBe(8);
    const quietType = typeOfParsed(parsed(quiet)) as string;
    const row = shares.rows.find((r) => r.name === quietType)!;
    expect(row.n).toBe(6);
    expect(row.pct).toBe(75);
  });

  it("names every type, zeroes included", () => {
    // A type nobody carries is a measured zero. Dropping the empty rows
    // would let a sample of eight look like a map of the population.
    store.enabled = true;
    store.kindredPeople = () => crowd({ O: 72, C: 55, E: 15, A: 58, N: 50 }, 3, "q");
    const shares = typeSharesOn(TYPE_TEST)!;
    expect(shares.rows.map((r) => r.name).sort()).toEqual(typeNames().sort());
    expect(shares.rows.filter((r) => r.n === 0).length).toBeGreaterThan(0);
  });

  it("reports an empty sample as zero rather than as an average", () => {
    store.enabled = true;
    store.kindredPeople = () => [];
    const shares = typeSharesOn(TYPE_TEST)!;
    expect(shares.typedN).toBe(0);
    expect(shares.rows.every((r) => r.n === 0 && r.pct === 0)).toBe(true);
  });
});

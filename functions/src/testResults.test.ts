// testResults.test.ts — the bound that could not be written in rules.
//
// WHY THIS FILE EXISTS. `v2_users/{uid}` is world-readable (D98) and
// `voters.ts` fetches thirty of them WHOLE per query, with no field mask. So
// the size of `testResults` is a cost every reader of a person pays, and
// until 2026-09-09 nothing bounded it: D429 bounded which KEYS may appear
// and said in its own words that the size inside a legitimate kind "needs
// per-kind shape checks and is its own increment".
//
// Those checks cannot live in `firestore.rules` — rules have no quantifier
// over a list, so `dims[i].label` is unreachable to any `allow` clause and a
// megabyte fits under a perfectly legal key. `validatePassiveResult` is the
// loop the rules could not write, and this file is what executes it.
//
// The cases are the attack and the ordinary result, side by side: every
// bound has a case that crosses it by one, because a bound nothing tests is
// a bound that can be widened to 6000 or deleted with the suite still green
// (the lesson `firestore-tests/rules.test.ts` records about `displayName`).

import { describe, expect, it } from "vitest";
import {
  CLIENT_TEST_KINDS,
  REMOVABLE_TEST_KINDS,
  validatePassiveResult,
} from "./testResults";

/** A result in exactly the shape `passiveResult` emits, at Big Five width. */
function ok(over: Record<string, unknown> = {}) {
  return {
    title: "Big Five",
    taken: "from 40 of your answers",
    dims: [
      { id: "O", label: "Openness", value: 72 },
      { id: "C", label: "Conscientiousness", value: 51 },
      { id: "E", label: "Extraversion", value: 48 },
      { id: "A", label: "Agreeableness", value: 66 },
      { id: "N", label: "Sensitivity", value: 30 },
    ],
    passive: true,
    answered: 40,
    total: 25,
    ...over,
  };
}

describe("validatePassiveResult", () => {
  it("accepts what the fold actually emits, and returns it rebuilt", () => {
    const out = validatePassiveResult(ok());
    expect(out).toEqual(ok());
  });

  // THE WHOLE POINT OF THE FILE. A legal key, a legal shape, and one string
  // inside it carrying a megabyte — the exact payload the rules accepted
  // before this existed and could never have refused.
  it("refuses a megabyte hidden in a dim label, which no rules clause could reach", () => {
    expect(() => validatePassiveResult(ok({
      dims: [{ id: "O", label: "x".repeat(1_000_000), value: 50 }],
    }))).toThrow(/dim label/);
  });

  it("refuses a megabyte in the title or the taken line", () => {
    expect(() => validatePassiveResult(ok({ title: "x".repeat(400_000) }))).toThrow(/title/);
    expect(() => validatePassiveResult(ok({ taken: "x".repeat(400_000) }))).toThrow(/taken/);
  });

  // Each bound crossed by ONE, so a widened constant reddens this file.
  it("holds each bound at its edge", () => {
    expect(() => validatePassiveResult(ok({ title: "x".repeat(60) }))).not.toThrow();
    expect(() => validatePassiveResult(ok({ title: "x".repeat(61) }))).toThrow(/title/);
    expect(() => validatePassiveResult(ok({ taken: "x".repeat(60) }))).not.toThrow();
    expect(() => validatePassiveResult(ok({ taken: "x".repeat(61) }))).toThrow(/taken/);

    const dim = (label: string) => ({ id: "O", label, value: 1 });
    expect(() => validatePassiveResult(ok({ dims: [dim("x".repeat(40))] }))).not.toThrow();
    expect(() => validatePassiveResult(ok({ dims: [dim("x".repeat(41))] }))).toThrow(/dim label/);
    expect(() => validatePassiveResult(ok({
      dims: [{ id: "x".repeat(16), label: "L", value: 1 }],
    }))).not.toThrow();
    expect(() => validatePassiveResult(ok({
      dims: [{ id: "x".repeat(17), label: "L", value: 1 }],
    }))).toThrow(/dim id/);

    const many = (n: number) => Array.from({ length: n }, () => dim("L"));
    expect(() => validatePassiveResult(ok({ dims: many(8) }))).not.toThrow();
    expect(() => validatePassiveResult(ok({ dims: many(9) }))).toThrow(/dims/);
  });

  // REBUILT, NOT PASSED THROUGH: an unknown key cannot ride along onto a
  // document everyone downloads. This is the difference between checking a
  // payload and accepting one, and it is why the function returns a value
  // instead of a boolean.
  it("drops an unknown key rather than storing it", () => {
    const out = validatePassiveResult(ok({ blob: "x".repeat(100_000) }));
    expect(out).not.toHaveProperty("blob");
    expect(JSON.stringify(out).length).toBeLessThan(1000);
    // …and inside a dim, too, which is the nested version of the same hole.
    const nested = validatePassiveResult(ok({
      dims: [{ id: "O", label: "Openness", value: 50, blob: "x".repeat(100_000) }],
    }));
    expect((nested.dims as Record<string, unknown>[])[0]).toEqual({
      id: "O", label: "Openness", value: 50,
    });
  });

  it("refuses values that are not numbers in range, and non-integer counts", () => {
    for (const value of [NaN, Infinity, -1, 101, "50", null]) {
      expect(() => validatePassiveResult(ok({
        dims: [{ id: "O", label: "L", value }],
      }))).toThrow(/dim value/);
    }
    expect(() => validatePassiveResult(ok({ answered: 1.5 }))).toThrow(/answered/);
    expect(() => validatePassiveResult(ok({ total: -1 }))).toThrow(/total/);
  });

  it("refuses a result that does not declare itself a fold", () => {
    // `passive: true` is what every reader keys the "where did this come
    // from" line on, so a stored result that omits it would draw as a
    // sit-down score the person never took.
    expect(() => validatePassiveResult(ok({ passive: false }))).toThrow(/passive/);
    expect(() => validatePassiveResult(ok({ passive: undefined }))).toThrow(/passive/);
  });

  it("refuses a non-object, including the shapes an attacker sends", () => {
    for (const bad of [null, undefined, "hacked", 7, [], [{ id: "O" }]]) {
      expect(() => validatePassiveResult(bad)).toThrow();
    }
  });

  // The total, stated as a number rather than implied by the bounds above:
  // this is what replaces "roughly 1 MiB per free anonymous account".
  it("caps a stored result well under a kilobyte", () => {
    const widest = validatePassiveResult(ok({
      title: "x".repeat(60),
      taken: "y".repeat(60),
      dims: Array.from({ length: 8 }, () => ({
        id: "i".repeat(16), label: "l".repeat(40), value: 100,
      })),
    }));
    expect(JSON.stringify(widest).length).toBeLessThan(1000);
  });
});

describe("the kind lists", () => {
  // The asymmetry is the design: writing a verified score is forgery (D57),
  // deleting your own is not. The rules used to allow exactly that delete
  // and this is where the capability went when the write path moved.
  it("lets a client remove logic but never write it", () => {
    expect(CLIENT_TEST_KINDS).not.toContain("logic");
    expect(REMOVABLE_TEST_KINDS).toContain("logic");
  });

  it("writes exactly the four the device folds", () => {
    // Kept in step with CORE_TEST_KINDS (src/v2/data/similarity.ts) and
    // IS_TESTS' own keys — `syncPassiveResults` iterates that constant, so a
    // fifth folded instrument has to be added here or its result silently
    // stops reaching the profile.
    expect([...CLIENT_TEST_KINDS].sort()).toEqual(
      ["attachment", "big5", "political", "values"],
    );
  });

  it("removes the five the rules admit, and nothing else", () => {
    expect([...REMOVABLE_TEST_KINDS].sort()).toEqual(
      ["attachment", "big5", "logic", "political", "values"],
    );
  });
});

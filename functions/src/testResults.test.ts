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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { FieldValue } from "firebase-admin/firestore";

// Firestore's PLUMBING, not its semantics. The callable issues exactly one
// `set` and reads nothing back, so what is worth recording is the CALL — the
// path, the payload and the options — and a fake store would only
// re-implement merge, which no case below is about.
type Doc = Record<string, unknown>;
const sets: { path: string; data: Doc; merge: boolean }[] = [];
const fakeDb = {
  collection: (name: string) => ({
    doc: (id: string) => ({
      set: async (data: Doc, opts?: { merge?: boolean }) => {
        sets.push({ path: `${name}/${id}`, data, merge: opts?.merge === true });
      },
    }),
  }),
};
vi.mock("./db", () => ({ db: () => fakeDb, FIRESTORE_DB_ID: "insight" }));

// Imported after the fake exists: `vi.mock` is hoisted above every statement
// in the file, so a static import would run the factory while `fakeDb` is
// still in its temporal dead zone.
const {
  CLIENT_TEST_KINDS,
  REMOVABLE_TEST_KINDS,
  saveTestResultV2,
  validatePassiveResult,
} = await import("./testResults");

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

// ── THE CALLABLE ITSELF ──
//
// Everything above executes the validator; nothing above — and until
// 2026-09-09 nothing anywhere — executed the function that CALLS it.
// Replacing the whole consent guard with `if (false)` left the backend
// suite green at 47 files, which is how the hole below survived being
// written into the same change that closed its twin.
//
// The hole: `politicalConsent` was handed to `set` verbatim. This runs on
// the admin SDK, which does not evaluate `firestore.rules` — so
// `consent.political.keys().hasOnly(["v", "at", "off"])`, the bound that
// holds the shape on the client path, applies to every writer of that
// field EXCEPT this one. Measured against the callable the same day: a
// consent object carrying two extra keys was written whole, 300,075 bytes
// of it, onto `v2_users/{uid}` — the world-readable document (D98) that
// `voters.ts` fetches thirty at a time with no field mask, and the exact
// document this file exists to keep at roughly seven hundred bytes.
const UID = "u_me";

// `null`, not `undefined`, for the signed-out case: a default parameter is
// applied to an explicit `undefined` too, so the signed-out case would have
// run as `u_me` and passed while proving nothing. It did, once.
const run = (data: Record<string, unknown>, auth: { uid: string } | null = { uid: UID }) =>
  (saveTestResultV2 as unknown as { run: (r: unknown) => Promise<unknown> })
    .run({ auth: auth ?? undefined, data });

/** A withdrawal record in the shape the client path is bounded to. */
const withdrawal = (over: Record<string, unknown> = {}) => ({
  v: 1, at: 1_757_000_000_000, off: 1_757_000_009_999, ...over,
});

describe("saveTestResultV2 — the write the rules do not see", () => {
  beforeEach(() => { sets.length = 0; });

  it("stores the rebuilt result under its kind, merged into the profile", async () => {
    await run({ kind: "big5", result: ok({ blob: "x".repeat(100_000) }) });
    expect(sets).toHaveLength(1);
    expect(sets[0].path).toBe(`v2_users/${UID}`);
    // `merge: false` here would take every anchor on the profile with it.
    expect(sets[0].merge).toBe(true);
    expect(sets[0].data.testResults).toEqual({ big5: ok() });
    expect(sets[0].data).not.toHaveProperty("consent");
  });

  // THE ONE THIS FILE WAS EXTENDED FOR. Same rebuild, same reason, one
  // field over: a validated payload is not an accepted one.
  it("rebuilds the consent record, so no extra key rides onto a world-readable doc", async () => {
    await run({
      kind: "political",
      result: null,
      politicalConsent: withdrawal({ blob: "x".repeat(300_000), evil: { deeper: true } }),
    });
    expect(sets).toHaveLength(1);
    expect(sets[0].data.consent).toEqual({ political: withdrawal() });
    expect(JSON.stringify(sets[0].data.consent).length).toBeLessThan(200);
  });

  it("removes the result with a delete sentinel, in the same write as the record", async () => {
    await run({ kind: "political", result: null, politicalConsent: withdrawal() });
    // ONE `set`, both halves. The state this rules out is a profile still
    // publishing a six-axis coordinate behind a switch reading "off",
    // which is worse than no switch because it is a claim.
    expect(sets).toHaveLength(1);
    // A stored `null` would be a value, not a removal — the coordinate
    // would still be there, and readable.
    expect((sets[0].data.testResults as Doc).political).toBe(FieldValue.delete());
  });

  it("refuses a grant-shaped consent record on the withdrawal path", async () => {
    // No `off` is a GRANT. Accepting one would take the coordinate down and
    // leave consent reading ON, so the next fold republishes it.
    await expect(run({ kind: "political", result: null, politicalConsent: { v: 1, at: 1 } }))
      .rejects.toThrow(/withdrawal record/);
    expect(sets).toHaveLength(0);
  });

  it("refuses consent riding along with anything but a political removal", async () => {
    await expect(run({ kind: "big5", result: null, politicalConsent: withdrawal() }))
      .rejects.toThrow(/may only ride along/);
    await expect(run({ kind: "political", result: ok(), politicalConsent: withdrawal() }))
      .rejects.toThrow(/may only ride along/);
    expect(sets).toHaveLength(0);
  });

  // The kind lists are pinned by name above; this is the branch that READS
  // them, which is direction-dependent and therefore its own case.
  it("will not write a logic result but will remove one", async () => {
    await expect(run({ kind: "logic", result: ok() })).rejects.toThrow(/logicSubmitV2 only/);
    expect(sets).toHaveLength(0);
    await run({ kind: "logic", result: null });
    expect(sets).toHaveLength(1);
  });

  it("refuses an unauthenticated caller before it validates anything", async () => {
    await expect(run({ kind: "big5", result: ok() }, null)).rejects.toThrow(/sign-in/);
    expect(sets).toHaveLength(0);
  });
});

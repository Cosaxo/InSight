// account-levels.test.mjs — the bucketing, which decides what an operator
// believes before raising the bar.
//
// The claim is read three times in this system, by three different readers
// in three languages: firestore.rules (`get("db", 0)`), the nightly scan
// (velocity.ts), and this script. They must agree on what a MISSING or
// MALFORMED claim means, because that is the case every account is in
// today — activation has never run. All three answer 0.
import { describe, it, expect } from "vitest";
import { tally } from "./account-levels.mjs";

describe("tally", () => {
  it("buckets accounts by their claim", () => {
    const out = tally([
      { uid: "a", customClaims: { db: 1 } },
      { uid: "b", customClaims: { db: 1 } },
      { uid: "c", customClaims: { db: 2 } },
    ]);
    expect(out.byLevel.get(1)).toBe(2);
    expect(out.byLevel.get(2)).toBe(1);
  });

  it("reads an absent claim as level 0, matching the rules", () => {
    // `request.auth.token.get("db", 0)` — the default IS the semantics, and
    // a report that guessed differently would say accounts qualify while
    // production refuses them.
    const out = tally([{ uid: "a" }, { uid: "b", customClaims: {} }]);
    expect(out.byLevel.get(0)).toBe(2);
  });

  it("reads a MALFORMED claim as level 0, not as 'has a claim'", () => {
    // Fail closed. A string, a boolean or a null must not read as
    // qualifying — the rules compare types strictly and would refuse these,
    // so anything else here overstates who qualifies.
    const out = tally([
      { uid: "a", customClaims: { db: "2" } },
      { uid: "b", customClaims: { db: true } },
      { uid: "c", customClaims: { db: null } },
    ]);
    // ALL THREE are level 0, because all three are what production
    // refuses. The first draft coerced with Number(), which read `db: true`
    // as level 1 — a malformed claim reported as a qualifying account, on
    // exactly the day the report is trusted. The test caught it.
    expect(out.byLevel.get(0)).toBe(3);
    expect(out.byLevel.get(2)).toBeUndefined();
  });

  it("returns a row per account so --below can filter them", () => {
    const out = tally([{ uid: "a" }, { uid: "b", customClaims: { db: 2 } }]);
    expect(out.rows).toEqual([{ uid: "a", level: 0 }, { uid: "b", level: 2 }]);
  });

  it("handles an empty page without inventing a bucket", () => {
    const out = tally([]);
    expect(out.byLevel.size).toBe(0);
    expect(out.rows).toEqual([]);
  });
});

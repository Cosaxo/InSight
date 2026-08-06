// D44: political items never fold into the demographic breakdown.
//
// What this pins is the decision, not the plumbing. The trigger's fold is a
// transaction against Firestore and its own test would be a mock of the SDK;
// the leg in e2e-v2-loop.mjs answers a political question past the k-floor
// under the real emulator and asserts the published doc carries no `by`.
// This file holds the half that leg cannot: that the SET matches the bank.
//
// The non-vacuity guard matters more than usual here. `slicesDemographics`
// returns true for everything if POLITICAL_QIDS is empty, and POLITICAL_QIDS
// is derived — a rename of the `test` field, a regenerated bank that drops
// the marker, or a filter typo all empty it silently and leave the trigger
// slicing political answers again with every test still green. So the first
// assertion is that the bank ships political items at all.
import { describe, expect, it } from "vitest";
import { POLITICAL_QIDS, slicesDemographics } from "./v2";
import { V2_QUESTIONS } from "./v2content";

// Both markers (D44, D52): the political test's own items, and ordinary
// opinion cards carrying `political: true` — the flag a feed question uses
// because reusing `test` would count it toward the test's progress rings.
const political = V2_QUESTIONS.filter(
  (q) => q.test === "political" || q.political === true,
);

describe("D44 · political items never slice", () => {
  it("the shipped bank actually contains political items", () => {
    // Without this, every assertion below passes against an empty set.
    expect(political.length).toBeGreaterThan(0);
    expect(POLITICAL_QIDS.size).toBe(political.length);
  });

  it("refuses to slice every political item the bank ships", () => {
    for (const q of political) {
      expect(slicesDemographics(q.id), `${q.id} must not slice`).toBe(false);
    }
  });

  it("still slices the non-political items that share their surface", () => {
    // The political items are surface "test", and deck.ts routes that whole
    // surface into the live feed. A guard keyed on the surface instead of
    // the marker would silently stop slicing the Big Five, values and social
    // items too — which D8 does not ask for and the Mirror's cohort views
    // are built on.
    const otherTests = V2_QUESTIONS.filter(
      (q) => q.surface === "test" && q.test !== "political",
    );
    expect(otherTests.length).toBeGreaterThan(0);
    for (const q of otherTests) {
      expect(slicesDemographics(q.id), `${q.id} should still slice`).toBe(true);
    }
  });

  it("slices ordinary daily and feed questions — the flagged ones excepted", () => {
    const ordinary = V2_QUESTIONS.filter(
      (q) =>
        (q.surface === "daily" || q.surface === "feed") && q.political !== true,
    );
    expect(ordinary.length).toBeGreaterThan(0);
    for (const q of ordinary) {
      expect(slicesDemographics(q.id), `${q.id} should still slice`).toBe(true);
    }
  });

  it("the flag reaches feed/daily opinion items, not only the test", () => {
    // The non-vacuity guard for D52's half of the set: if the generator
    // stopped passing `political` through, the flagged civic items would
    // quietly rejoin the sliceable pool with every other assertion green.
    const flagged = V2_QUESTIONS.filter((q) => q.political === true);
    expect(flagged.map((q) => q.id)).toEqual(
      expect.arrayContaining(["feed-f45", "feed-f47", "daily-014"]),
    );
    for (const q of flagged) {
      expect(slicesDemographics(q.id), `${q.id} must not slice`).toBe(false);
    }
  });

  it("says nothing about a qid the bank has never heard of", () => {
    // The trigger fires on whatever id the answer doc carries. An unknown id
    // is not a political item, so it slices — the fail-open direction is
    // correct here because the alternative (suppress everything unknown)
    // would blank the breakdown for any question added ahead of a redeploy.
    expect(slicesDemographics("daily-does-not-exist")).toBe(true);
  });
});

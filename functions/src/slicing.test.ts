// D44: political items never fold into the demographic breakdown.
//
// What this pins is the SET — that POLITICAL_QIDS matches the bank. The
// ENFORCEMENT point, where the trigger decides whether to fold anchors at
// all, is `breakdownFor` in v2.ts, and its cases are at the foot of this
// file.
//
// This header used to claim, in the present indicative, that "the leg in
// e2e-v2-loop.mjs answers a political question past the k-floor under the
// real emulator and asserts the published doc carries no `by`". No such leg
// was ever written — grep for it — and with the set pinned here and nothing
// covering the enforcement, mutating v2.ts's `slices` to a literal `true`
// left all four runners green while the trigger published a per-anchor
// breakdown of all eighteen Art. 9 political items to any signed-in reader.
// A coverage claim in the present tense for a test that does not exist is
// the one thing this repo can least afford.
//
// The non-vacuity guard matters more than usual here. `slicesDemographics`
// returns true for everything if POLITICAL_QIDS is empty, and POLITICAL_QIDS
// is derived — a rename of the `test` field, a regenerated bank that drops
// the marker, or a filter typo all empty it silently and leave the trigger
// slicing political answers again with every test still green. So the first
// assertion is that the bank ships political items at all.
import { describe, expect, it } from "vitest";
import { POLITICAL_QIDS, breakdownFor, slicesDemographics } from "./v2";
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
    //
    // BOTH markers are excluded here, not just the test key: since D91 the
    // lens items share this surface with `test: null`, and two of them
    // (lq-trust-2/3) carry `political: true` — the flag half of the set,
    // which this filter used to be able to ignore only because no
    // test-surface item had ever carried it.
    const otherTests = V2_QUESTIONS.filter(
      (q) => q.surface === "test" && q.test !== "political" && q.political !== true,
    );
    expect(otherTests.length).toBeGreaterThan(0);
    // …and the lens items are really in the sliceable pool: an instrument
    // item in the values/big5 class slices like one (D91).
    expect(otherTests.some((q) => q.id.startsWith("lq-"))).toBe(true);
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
    // The two zero-sum trade propositions are the lens items D91 judged
    // into this class — economic-policy opinions, not instrument items.
    const flagged = V2_QUESTIONS.filter((q) => q.political === true);
    expect(flagged.map((q) => q.id)).toEqual(
      expect.arrayContaining(["feed-f45", "feed-f47", "daily-014", "lq-trust-2", "lq-trust-3"]),
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

// ── the enforcement point ───────────────────────────────────────
//
// The set above says WHICH questions are political. These say what the
// trigger does about it. Mutating v2.ts's `slices` to a literal `true` used
// to leave all four runners green.
describe("breakdownFor — D44 at the point it is enforced", () => {
  const POLITICAL = [...POLITICAL_QIDS][0];
  const anchors = { ageBand: "25-34", gender: "Woman", country: "NO" };

  it("folds nothing for a political item, whatever the anchors say", () => {
    expect(breakdownFor(POLITICAL, null, anchors, 1, 5)).toEqual({});
  });

  it("ERASES a breakdown folded before the guard existed", () => {
    // privRef is written with merge:false, so returning `{}` rather than
    // merely skipping the fold is what cleans up the pre-D44 documents.
    // Skipping would carry them forward untouched forever.
    const stored = { gender: { Woman: { "0": 40 }, Man: { "0": 40 } } };
    expect(breakdownFor(POLITICAL, stored, anchors, 1, 5)).toEqual({});
  });

  it("still folds for a non-political item", () => {
    // The other half: a guard that withheld everything would also pass the
    // two cases above.
    const out = breakdownFor("daily-000", null, anchors, 1, 5);
    expect(Object.keys(out).sort()).toEqual(["ageBand", "country", "gender"]);
    expect(out.gender.Woman).toEqual({ "1": 1 });
  });

  it("carries a non-political item's stored breakdown forward", () => {
    const stored = { gender: { Woman: { "0": 3 } } };
    const out = breakdownFor("daily-000", stored, { gender: "Woman" }, 0, 5);
    expect(out.gender.Woman).toEqual({ "0": 4 });
  });
});

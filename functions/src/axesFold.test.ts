// The trait fold's arithmetic (axes step 1.1) — pure, so it tests the way
// patternsFit.test.ts does: no store, no Firestore, fixtures in.
//
// The one test here that reaches OUTSIDE the module is the invert parity
// pin: the compiled bank's `invert` flags against content/tests.json
// itself. The flag is the sign bit of every reverse-scored item and it
// travels generator → v2content → traitItems; a regeneration that dropped
// it would leave every downstream gate green (nothing else reads it) while
// this fold quietly scored 44 items backwards — exactly the "stays green
// while being wrong" shape D276 catalogues.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { foldTraitDay, traitAxisScores, type TraitVotes } from "./axesFold";
import { AXES_TRAIT_ITEMS } from "./patterns";
import { V2_QUESTIONS } from "./v2content";

describe("traitItems over the compiled bank", () => {
  it("keeps exactly the instruments' items — no lens, no daily, no feed", () => {
    for (const q of V2_QUESTIONS) {
      const expected =
        q.surface === "test" && typeof q.test === "string" && !!q.test &&
        typeof q.axis === "string" && !!q.axis &&
        Array.isArray(q.options) && q.options.length === 5;
      expect(AXES_TRAIT_ITEMS.some((i) => i.qid === q.id), q.id).toBe(expected);
    }
    // non-trivial, so a bank change that empties the fold fails loudly
    expect(AXES_TRAIT_ITEMS.length).toBeGreaterThan(50);
  });

  it("carries the same invert flags content/tests.json declares, item for item", () => {
    const tests = JSON.parse(
      readFileSync(new URL("../../content/tests.json", import.meta.url), "utf8"),
    ) as Record<string, { questions: Array<{ id: string; d: string; invert?: boolean }> }>;
    const byQid = new Map(AXES_TRAIT_ITEMS.map((i) => [i.qid, i]));
    let inverted = 0;
    for (const [key, t] of Object.entries(tests)) {
      for (const q of t.questions) {
        const item = byQid.get(`test-${key}-${q.id}`);
        expect(item, `test-${key}-${q.id} missing from the compiled fold set`).toBeTruthy();
        expect(item?.test).toBe(key);
        expect(item?.dim).toBe(q.d);
        expect(item?.invert, `invert drift on test-${key}-${q.id}`).toBe(q.invert === true);
        if (q.invert === true) inverted += 1;
      }
    }
    // …and the banks really do carry reversed items, so this pin is not
    // vacuously comparing false to false
    expect(inverted).toBeGreaterThan(0);
  });
});

describe("foldTraitDay", () => {
  const ELIGIBLE = new Set(["qa", "qb"]);

  it("applies votes last-wins and refuses what is not an instrument answer", () => {
    const votes: TraitVotes = {};
    const applied = foldTraitDay(votes, [
      { qid: "qa", optionIdx: 1 },
      { qid: "qa", optionIdx: 3 },        // same-day edit — last wins
      { qid: "qb", optionIdx: 0 },
      { qid: "not-a-trait", optionIdx: 2 }, // wiring leak — must not persist
      { qid: "qa" },                        // pre-optionIdx ledger row
      { qid: "qb", optionIdx: 7 },          // out of the 0..4 scale
    ], ELIGIBLE);
    expect(votes).toEqual({ qa: 3, qb: 0 });
    expect(applied).toBe(3);
  });

  it("is idempotent — re-folding a day lands the same votes", () => {
    const day = [{ qid: "qa", optionIdx: 2 }, { qid: "qb", optionIdx: 4 }];
    const votes: TraitVotes = {};
    foldTraitDay(votes, day, ELIGIBLE);
    const once = { ...votes };
    foldTraitDay(votes, day, ELIGIBLE);
    expect(votes).toEqual(once);
  });

  it("an edit on a later day replaces the vote without any create in sight", () => {
    // The case patternsFit needs a clamp and three paragraphs for: an edit
    // whose create was never folded (it predates the deploy, or fell
    // outside the catch-up window). Votes make it trivial — the entry
    // carries the person's current answer and that is the whole truth.
    const votes: TraitVotes = {};
    foldTraitDay(votes, [{ qid: "qa", optionIdx: 0 }], ELIGIBLE);
    foldTraitDay(votes, [{ qid: "qa", optionIdx: 4 }], ELIGIBLE);
    expect(votes).toEqual({ qa: 4 });
  });
});

describe("traitAxisScores", () => {
  const ITEMS = [
    { qid: "o1", test: "big5", dim: "O", invert: false },
    { qid: "o2", test: "big5", dim: "O", invert: true },
    { qid: "c1", test: "big5", dim: "C", invert: false },
    { qid: "p1", test: "political", dim: "E", invert: false },
  ];

  it("scores the instruments' own normalisation, invert flipped before the mean", () => {
    // o1 = 4 (strong agree), o2 = 0 reversed → 4: mean 4 → 100.
    const scores = traitAxisScores({ o1: 4, o2: 0, c1: 2 }, ITEMS);
    expect(scores).toEqual([
      { test: "big5", dim: "O", value: 100, n: 2 },
      { test: "big5", dim: "C", value: 50, n: 1 },
    ]);
  });

  it("omits an axis with nothing behind it rather than inventing a 50", () => {
    const scores = traitAxisScores({ p1: 1 }, ITEMS);
    expect(scores).toEqual([{ test: "political", dim: "E", value: 25, n: 1 }]);
    expect(scores.some((s) => s.test === "big5")).toBe(false);
  });

  it("matches the client fold's arithmetic on a worked example", () => {
    // passiveProfile's fold (myAxisScores): value = round(mean(scored)/4 ×
    // 100). Scored: 3 and (invert) 4-1=3 → mean 3 → 75. The figure is
    // hand-derived from the same formula the client documents, so a drift
    // in EITHER normalisation shows up as a disagreement here.
    const scores = traitAxisScores({ o1: 3, o2: 1 }, ITEMS);
    expect(scores).toEqual([{ test: "big5", dim: "O", value: 75, n: 2 }]);
  });

  it("ignores a stored vote for an item the bank no longer scores", () => {
    // A retired item's vote may persist in a state doc; scoring reads the
    // CURRENT item list, so it simply stops counting — the D72 posture:
    // fail toward absence, never toward a fabricated number.
    const scores = traitAxisScores({ gone: 4 }, ITEMS);
    expect(scores).toEqual([]);
  });
});

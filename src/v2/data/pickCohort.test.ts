// The catalogue board's cohort folds (pickCohort.ts).
//
// Pinned here rather than through the panel because these are the claims
// the panel prints as sentences: which entity a cohort puts first, where
// everyone puts it, and which cut is worth offering as the finding. A fold
// that gets any of those wrong prints a true-sounding sentence about the
// wrong people, which no render test would catch.
import { describe, expect, it } from "vitest";
import type { ByMap } from "./cohort";
import {
  bestPickTilt, pickMix, pickRank, pickRowsFor, pickTilt, pickTilts, pickVocabMix,
} from "./pickCohort";

describe("where an entity stands on a board", () => {
  it("is 1-based, and 0 for one the board does not carry", () => {
    const rows = [{ entity: 132, count: 9 }, { entity: 25, count: 5 }];
    expect(pickRank(rows, 132)).toBe(1);
    expect(pickRank(rows, 25)).toBe(2);
    // The ordinary case, not an edge: the board is the top ten of a
    // catalogue of a thousand, so most picks are off it.
    expect(pickRank(rows, 386)).toBe(0);
  });
});

// Ditto 132 leads overall; 25-34 lead with Deoxys 386, which is everyone's
// #3. Women lead with Ditto, which is everyone's #1 — the cohort that
// agrees, and therefore has nothing to say.
const BY: ByMap = {
  ageBand: {
    "25-34": { "386": 4, "132": 1 },
    "35-44": { "132": 3, "25": 2 },
    "18-24": { "25": 1 },
  },
  gender: {
    Woman: { "132": 5, "386": 1 },
  },
};

const OVERALL = [
  { entity: 132, count: 9 },
  { entity: 25, count: 5 },
  { entity: 386, count: 5 },
];

describe("one cohort's board", () => {
  it("reads the published cell, biggest first, ties by catalogue key", () => {
    expect(pickRowsFor(BY, "ageBand", "25-34")).toEqual([
      { entity: 386, count: 4 }, { entity: 132, count: 1 },
    ]);
    // The tiebreak is the board's own (LIVE.pickCanon) — two entities on
    // one answer each must not list in one order here and another there.
    expect(pickRowsFor({ x: { y: { "9": 1, "4": 1 } } }, "x", "y"))
      .toEqual([{ entity: 4, count: 1 }, { entity: 9, count: 1 }]);
  });

  it("is empty, not null, where the cell was never published", () => {
    expect(pickRowsFor(BY, "ageBand", "65+")).toEqual([]);
    expect(pickRowsFor(undefined, "ageBand", "25-34")).toEqual([]);
  });

  it("counts the cohort's own answers, never the question's", () => {
    const mix = pickMix(BY, "ageBand");
    expect(mix.map((b) => [b.bucket, b.n])).toEqual([["25-34", 5], ["35-44", 5], ["18-24", 1]]);
  });
});

describe("the whole scale, zeros included (D304)", () => {
  const VOCAB = ["18-24", "25-34", "35-44", "45-54", "Prefer not to say"];
  const TAIL = new Set(["Prefer not to say"]);

  it("draws every canonical band in vocabulary order, empty ones included", () => {
    const rows = pickVocabMix(BY, "ageBand", VOCAB, TAIL);
    expect(rows.map((b) => b.bucket)).toEqual(["18-24", "25-34", "35-44", "45-54"]);
    expect(rows.find((b) => b.bucket === "45-54")).toEqual({ bucket: "45-54", n: 0, rows: [] });
  });

  it("keeps an opt-out out until somebody picks it", () => {
    const with_ = pickVocabMix(
      { ageBand: { ...BY.ageBand, "Prefer not to say": { "132": 2 } } },
      "ageBand", VOCAB, TAIL,
    );
    expect(with_.map((b) => b.bucket)).toContain("Prefer not to say");
  });

  it("appends a bucket the vocabulary has never heard of rather than hiding it", () => {
    const rows = pickVocabMix({ ageBand: { "99-120": { "1": 3 } } }, "ageBand", VOCAB, TAIL);
    expect(rows[rows.length - 1].bucket, "an answer folded under an older spelling vanished")
      .toBe("99-120");
  });
});

describe("what a cohort puts first, and where everyone puts it", () => {
  it("names the leader and its standing on everyone's board", () => {
    const cell = { bucket: "25-34", n: 5, rows: pickRowsFor(BY, "ageBand", "25-34") };
    expect(pickTilt(cell, OVERALL)).toEqual({
      bucket: "25-34", n: 5, entity: 386, here: 4, rank: 3,
    });
  });

  it("says nothing about a cohort that agrees with the room", () => {
    const cell = { bucket: "Woman", n: 6, rows: pickRowsFor(BY, "gender", "Woman") };
    expect(pickTilt(cell, OVERALL), "a cut that repeats the room was offered as a finding")
      .toBeNull();
  });

  it("holds an empty cohort and a thin one below the caller's floor", () => {
    expect(pickTilt({ bucket: "45-54", n: 0, rows: [] }, OVERALL)).toBeNull();
    const thin = { bucket: "18-24", n: 1, rows: pickRowsFor(BY, "ageBand", "18-24") };
    expect(pickTilt(thin, OVERALL, 2)).toBeNull();
    expect(pickTilt(thin, OVERALL, 1)?.entity).toBe(25);
  });

  it("ranks the furthest-from-the-top first, and an off-board pick above all of them", () => {
    expect(pickTilts(BY, "ageBand", OVERALL).map((t) => [t.bucket, t.rank]))
      .toEqual([["25-34", 3], ["18-24", 2]]);
    const off: ByMap = { ageBand: { "45-54": { "700": 2 }, "25-34": { "386": 4 } } };
    expect(pickTilts(off, "ageBand", OVERALL)[0].bucket, "a pick nobody else has is the finding")
      .toBe("45-54");
  });

  it("picks one dim's cut for the card's door, and it is the sheet's own", () => {
    const best = bestPickTilt(BY, ["ageBand", "gender"], OVERALL);
    expect(best?.dim).toBe("ageBand");
    expect(best?.tilt.bucket).toBe("25-34");
    // The gender cut agrees with the room, so it is not a candidate at all
    // — the door must never open on "Women also say Ditto".
    expect(bestPickTilt(BY, ["gender"], OVERALL)).toBeNull();
  });
});

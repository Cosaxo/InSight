// Foresight's read engine (D125). Every case here is about FAIRNESS or
// about a fold that is silently wrong — a game that marks you wrong on a
// coin toss, or a streak that reads differently on two devices, both
// render a perfectly convincing screen.

import { describe, expect, it } from "vitest";
import {
  READ_MIN_LEAD, READ_MIN_N, byDim, readId, readsFrom, recordOf, scoreRead,
  unplayed, type ForesightSource, type Verdict,
} from "./foresight";

// One question. 25-34 goes hard the other way from everyone; 35-44
// agrees with the crowd; 45-54 is a near-tie; "tiny" has almost nobody.
const Q: ForesightSource = {
  id: "q1",
  text: "Pineapple on pizza?",
  options: ["Yes", "No"],
  counts: [30, 70], // overall: No
  by: {
    ageBand: {
      "25-34": { "0": 18, "1": 2 },   // Yes, hard — a surprise, n=20
      "35-44": { "0": 2, "1": 18 },   // No — agrees with everyone
      "45-54": { "0": 9, "1": 8 },    // 53/47 — unreadable
      tiny: { "0": 3, "1": 0 },       // unanimous but n=3
    },
  },
};

const DIMS = ["ageBand", "education"];

describe("readsFrom — which reads are fair to ask", () => {
  it("finds the slices that can be read, and names the answer", () => {
    const reads = readsFrom([Q], DIMS);
    expect(reads.map((r) => r.bucket)).toEqual(["25-34", "35-44"]);
    expect(reads[0].answerIdx).toBe(0);
    expect(reads[0].slicePct).toEqual([90, 10]);
    expect(reads[0].n).toBe(20);
  });

  it("refuses a slice too thin to be a fair question", () => {
    // n=3 and unanimous. Not withheld — Explore draws this cell at any
    // size since D98 — but one more answer could flip its "most picked",
    // so scoring a guess against it is scoring a coin toss.
    expect(readsFrom([Q], DIMS).some((r) => r.bucket === "tiny")).toBe(false);
    // …and it comes back once the slice is big enough.
    const big = { ...Q, by: { ageBand: { tiny: { "0": READ_MIN_N, "1": 0 } } } };
    expect(readsFrom([big], DIMS).map((r) => r.bucket)).toEqual(["tiny"]);
  });

  it("refuses a near-tie even when the slice is large", () => {
    // 45-54 is 53/47 over 17 answers. There IS a correct answer and
    // nobody could read it; marking a player wrong teaches them the game
    // is arbitrary.
    expect(readsFrom([Q], DIMS).some((r) => r.bucket === "45-54")).toBe(false);
    const lead = readsFrom([Q], DIMS, 2, 0).find((r) => r.bucket === "45-54");
    expect(lead).toBeTruthy();
    expect(lead!.slicePct[0] - lead!.slicePct[1]).toBeLessThan(READ_MIN_LEAD);
  });

  it("marks a slice that disagrees with everyone, and offers it first", () => {
    const reads = readsFrom([Q], DIMS);
    // Overall says No; 25-34 says Yes.
    expect(reads[0].bucket).toBe("25-34");
    expect(reads[0].surprise).toBe(true);
    // 35-44 agrees with the crowd, so it is answerable without knowing
    // anything about 35-44 — kept, but ranked below.
    expect(reads[1].surprise).toBe(false);
  });

  it("skips a dimension nobody carries, and a question with no answers", () => {
    expect(readsFrom([Q], ["education"])).toEqual([]);
    expect(readsFrom([{ ...Q, counts: [0, 0], by: Q.by }], DIMS).length).toBe(0);
  });

  it("gives a read the same id every time, so it cannot be re-rolled", () => {
    expect(readsFrom([Q], DIMS)[0].id).toBe(readId("q1", "ageBand", "25-34"));
  });
});

describe("scoreRead", () => {
  const read = readsFrom([Q], DIMS)[0]; // answer is 0 ("Yes")

  it("scores a hit and a miss", () => {
    expect(scoreRead(read, 0, 100).correct).toBe(true);
    expect(scoreRead(read, 1, 100).correct).toBe(false);
  });

  it("counts a timeout as a MISS, not a skip", () => {
    // The clock is the game. A card you can let expire for free makes
    // waiting the best play whenever you are unsure.
    const v = scoreRead(read, -1, 100);
    expect(v.correct).toBe(false);
    expect(v.guess).toBe(-1);
  });

  it("carries the slice so a verdict can be read back without the question", () => {
    expect(scoreRead(read, 0, 7)).toMatchObject({ qid: "q1", dim: "ageBand", bucket: "25-34", at: 7 });
  });
});

describe("recordOf", () => {
  const v = (id: string, correct: boolean, at: number): Verdict =>
    ({ id, qid: "q", dim: "ageBand", bucket: "b", guess: correct ? 0 : 1, correct, at });

  it("counts hits and the current streak", () => {
    expect(recordOf([v("a", true, 1), v("b", false, 2), v("c", true, 3), v("d", true, 4)]))
      .toEqual({ played: 4, hits: 3, pct: 75, streak: 2, best: 2 });
  });

  it("keeps the BEST run even after it is broken", () => {
    const r = recordOf([v("a", true, 1), v("b", true, 2), v("c", true, 3), v("d", false, 4)]);
    expect(r.best).toBe(3);
    expect(r.streak).toBe(0);
  });

  it("sorts by time — the store hands back a map, not a sequence", () => {
    // Object key order is not history. Without the sort, the same log
    // produces a different streak on a different device.
    const shuffled = [v("c", false, 3), v("a", true, 1), v("b", true, 2)];
    expect(recordOf(shuffled).streak).toBe(0);
    expect(recordOf([v("a", false, 1), v("b", true, 2), v("c", true, 3)]).streak).toBe(2);
  });

  it("is all zeroes on an empty log, and never NaN", () => {
    expect(recordOf([])).toEqual({ played: 0, hits: 0, pct: 0, streak: 0, best: 0 });
  });
});

describe("byDim — the reading this feature exists for", () => {
  const v = (dim: string, correct: boolean, i: number): Verdict =>
    ({ id: dim + i, qid: "q" + i, dim, bucket: "b", guess: 0, correct, at: i });

  it("says which cuts of the population you read well", () => {
    const out = byDim([
      v("ageBand", true, 1), v("ageBand", true, 2), v("ageBand", false, 3),
      v("education", false, 4), v("education", false, 5),
    ]);
    expect(out).toEqual([
      { dim: "ageBand", played: 3, hits: 2, pct: 67 },
      { dim: "education", played: 2, hits: 0, pct: 0 },
    ]);
  });

  it("omits a dimension with nothing played rather than scoring it zero", () => {
    // 0% and "you have not tried this one" are different claims, and
    // only one of them is about you.
    expect(byDim([v("ageBand", true, 1)]).map((r) => r.dim)).toEqual(["ageBand"]);
  });
});

describe("unplayed", () => {
  it("drops reads already in the log, keeping offer order", () => {
    const reads = readsFrom([Q], DIMS);
    const log = { [reads[0].id]: {} };
    expect(unplayed(reads, log).map((r) => r.bucket)).toEqual(["35-44"]);
    expect(unplayed(reads, {}).length).toBe(2);
  });
});

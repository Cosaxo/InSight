// overflow.test.ts — the client half of the tail (D388): the same hash as
// the server, the same cap, and the two decisions the read path makes.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { OVERFLOW_HOT_CAP, OVERFLOW_SHARDS, overflowShard, overflowDocId, overflowWanted, withOverflowCell } from "./overflow";
import type { AggDoc } from "./deck";

const pureSrc = readFileSync(resolve(__dirname, "../../../functions/src/pure.ts"), "utf8");
const intConst = (name: string): number => {
  const m = new RegExp(`export const ${name} = (\\d+);`).exec(pureSrc);
  expect(m, `${name} is no longer a plain integer constant in functions/src/pure.ts`).toBeTruthy();
  return Number(m![1]);
};

describe("the mirrored constants", () => {
  it("match functions/src/pure.ts — the two packages share no build, so the source is the pin", () => {
    expect(OVERFLOW_SHARDS).toBe(intConst("OVERFLOW_SHARDS"));
    expect(OVERFLOW_HOT_CAP).toBe(intConst("BREAKDOWN_MAX_BUCKETS"));
  });
});

describe("overflowShard", () => {
  it("hashes exactly as the server does — the vectors functions/src/pure.test.ts pins", () => {
    expect(["Oslo, NO", "Bergen, NO", "Trondheim, NO", "NO", "PT", "Tail01, NO", "São Paulo, BR"].map(overflowShard))
      .toEqual([5, 7, 4, 2, 1, 3, 7]);
    expect(overflowDocId("daily-000", "Oslo, NO")).toBe("daily-000-5");
  });
});

describe("overflowWanted", () => {
  const capped = (): Record<string, Record<string, number>> => {
    const m: Record<string, Record<string, number>> = {};
    for (let i = 0; i < OVERFLOW_HOT_CAP; i++) m[`C${i}, NO`] = { "0": 1 };
    return m;
  };
  const aggs: Record<string, AggDoc> = {
    under: { counts: { "0": 3 }, total: 3, by: { city: { "Oslo, NO": { "0": 3 } } } },
    atCapHolding: { counts: {}, total: 24, by: { city: { ...capped(), "Oslo, NO": { "1": 2 } } } },
    atCapLacking: { counts: {}, total: 24, by: { city: capped() } },
    noBy: { counts: { "0": 1 }, total: 1 },
  };

  it("names only the questions whose hot map is at the cap AND lacks the viewer's key", () => {
    expect(overflowWanted(aggs, Object.keys(aggs), "city", "Oslo, NO")).toEqual(["atCapLacking"]);
    // under the cap, absent is zero — no read, cohort.ts's rule holds
    expect(overflowWanted(aggs, ["under"], "city", "Bergen, NO")).toEqual([]);
    // a dimension the document does not carry is under the cap by definition
    expect(overflowWanted(aggs, ["noBy", "under"], "country", "PT")).toEqual([]);
    // an aggregate the device does not hold contributes nothing
    expect(overflowWanted(aggs, ["missing"], "city", "Oslo, NO")).toEqual([]);
  });
});

describe("withOverflowCell", () => {
  it("returns a new document with the cell in place and leaves the cached one untouched", () => {
    const agg: AggDoc = { counts: { "0": 1 }, total: 1, by: { city: { "Oslo, NO": { "0": 1 } }, country: { NO: { "0": 1 } } } };
    const merged = withOverflowCell(agg, "city", "Tail01, NO", { "1": 2 });
    expect(merged.by!.city["Tail01, NO"]).toEqual({ "1": 2 });
    expect(merged.by!.city["Oslo, NO"]).toEqual({ "0": 1 });
    expect(merged.by!.country).toEqual({ NO: { "0": 1 } });
    expect(agg.by!.city["Tail01, NO"]).toBeUndefined();
    expect(merged).not.toBe(agg);
    // a document with no breakdown at all gains one
    expect(withOverflowCell({ counts: {}, total: 0 }, "country", "PT", { "0": 1 }).by).toEqual({ country: { PT: { "0": 1 } } });
  });
});

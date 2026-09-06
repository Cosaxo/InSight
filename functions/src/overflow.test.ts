// overflow.test.ts — the trigger's half of the tail (D400): the increments
// it writes and the shards it reads. The fold itself is pure.test.ts's.
import { describe, expect, it } from "vitest";
import { FieldValue } from "firebase-admin/firestore";
import { overflowIncrements, readOverflowShards } from "./v2";

describe("overflowIncrements", () => {
  it("turns every count into an increment, nested as the shard document is, so the write is a blind merge", () => {
    const out = overflowIncrements({ city: { "Junk0, NO": { "0": 1, "1": 2 } }, country: { PT: { "1": -1, "0": 1 } } });
    expect(Object.keys(out).sort()).toEqual(["city", "country"]);
    expect(out.city["Junk0, NO"]["0"].isEqual(FieldValue.increment(1))).toBe(true);
    expect(out.city["Junk0, NO"]["1"].isEqual(FieldValue.increment(2))).toBe(true);
    // a -1 rides the same shape: the edit path's -old/+new (retargetTail)
    expect(out.country.PT["1"].isEqual(FieldValue.increment(-1))).toBe(true);
  });
});

describe("readOverflowShards", () => {
  const fakeTx = (present: Record<string, Record<string, unknown>>) => {
    const asked: string[] = [];
    const tx = {
      getAll: async (...refs: Array<{ id: string }>) => {
        asked.push(...refs.map((r) => r.id));
        return refs.map((r) => ({ exists: r.id in present, data: () => present[r.id] }));
      },
    };
    const db = { collection: () => ({ doc: (id: string) => ({ id }) }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { tx: tx as any, db: db as any, asked };
  };

  it("reads nothing when no shard is wanted — the ordinary answer's path", async () => {
    const { tx, db, asked } = fakeTx({});
    expect((await readOverflowShards(tx, db, "daily-000", [])).size).toBe(0);
    expect(asked).toEqual([]);
  });

  it("reads exactly the wanted shards in one getAll, and an absent shard reads as empty", async () => {
    const { tx, db, asked } = fakeTx({ "daily-000-3": { city: { "Tail01, NO": { "0": 1 } } } });
    const shards = await readOverflowShards(tx, db, "daily-000", [3, 5]);
    expect(asked).toEqual(["daily-000-3", "daily-000-5"]);
    expect(shards.get(3)).toEqual({ city: { "Tail01, NO": { "0": 1 } } });
    expect(shards.get(5)).toEqual({});
  });
});

// overflow.reads.test.ts — the tail's one query (D399): the ids it asks
// for, how it chunks them, and what it keeps of what comes back. The
// circle.reads pattern: a firebase/firestore double that records queries
// and serves only the documents whose ids were named, because a fake that
// returned everything would pass a read that asked for the wrong shard.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  queries: [] as Array<{ path?: string; ids: string[] }>,
  docs: {} as Record<string, Record<string, unknown>>,
}));

// The module binds the SDK off `getFirestoreApi()` (D122's first-paint
// rule); the lib mock hands it this file's firestore double.
vi.mock("../../lib/firebase", () => ({ getFirestoreApi: () => import("firebase/firestore") }));

vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...p: string[]) => ({ __k: "collection", path: p.join("/") }),
  documentId: () => "__name__",
  where: (field: unknown, op: unknown, val: unknown) => ({ __k: "where", field, op, val }),
  query: (src: { path?: string }, ...parts: Array<Record<string, unknown>>) => {
    const idIn = parts.find((p) => p.__k === "where" && p.field === "__name__" && p.op === "in");
    const q = { path: src?.path, ids: (idIn?.val as string[]) ?? [] };
    h.queries.push(q);
    return q;
  },
  getDocs: (q: { ids: string[] }) => {
    const hits = q.ids.filter((id) => id in h.docs);
    return Promise.resolve({
      size: hits.length,
      docs: hits.map((id) => ({ id, data: () => h.docs[id] })),
    });
  },
}));

import { fetchOverflowCells, overflowDocId } from "./overflow";

beforeEach(() => {
  h.queries.length = 0;
  h.docs = {};
});

const db = {} as never;

describe("fetchOverflowCells", () => {
  it("asks for exactly the shards the viewer's key hashes to, on v2_agg_overflow, and keeps only that key's cell", async () => {
    const me = "Tail01, NO";
    h.docs[overflowDocId("daily-000", me)] = { city: { [me]: { "0": 1 }, "Other, NO": { "1": 4 } } };
    h.docs[overflowDocId("daily-001", me)] = { city: { "Other, NO": { "1": 4 } } }; // shard exists, no cell for me
    const { cells, read } = await fetchOverflowCells(db, ["daily-000", "daily-001", "daily-002"], "city", me);
    expect(h.queries).toHaveLength(1);
    expect(h.queries[0].path).toBe("v2_agg_overflow");
    expect(h.queries[0].ids).toEqual(["daily-000", "daily-001", "daily-002"].map((q) => overflowDocId(q, me)));
    expect(cells).toEqual([{ qid: "daily-000", dim: "city", key: me, cell: { "0": 1 } }]);
    // two shards came back (daily-002's does not exist) — that is the read tally
    expect(read).toBe(2);
    // the cell is a copy, not the fake's object
    expect(cells[0].cell).not.toBe((h.docs[overflowDocId("daily-000", me)].city as Record<string, unknown>)[me]);
  });

  it("chunks by Firestore's in-limit of 30 and asks nothing for an empty list", async () => {
    const qids = Array.from({ length: 31 }, (_, i) => `q${i}`);
    await fetchOverflowCells(db, qids, "country", "PT");
    expect(h.queries.map((q) => q.ids.length)).toEqual([30, 1]);
    h.queries.length = 0;
    expect(await fetchOverflowCells(db, [], "country", "PT")).toEqual({ cells: [], read: 0 });
    expect(h.queries).toHaveLength(0);
  });
});

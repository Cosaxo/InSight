// profileFanout.test.ts — a changed stamp reaches the rows, and only the
// rows, that exist (DATA-EFFICIENCY-RUNBOOK 2.1).
//
// The fake below is the shape restampSamples touches: an answers
// subcollection paged by id with a projection, a getAll over the sample
// documents, and batches of dotted-path updates. Every write is recorded,
// because the whole claim is WHICH documents were written and WHAT paths.
import { describe, expect, it } from "vitest";
import { restampSamples, sampleIdsFor } from "./profileFanout";
import { PATTERNS_QIDS } from "./patterns";
import { citySampleId, worldSampleId } from "./patternsSamples";

const [CORE_A, CORE_B] = [...PATTERNS_QIDS];

describe("sampleIdsFor", () => {
  it("names the world sample per corpus question and the city sample per frozen city, deduped and sorted", () => {
    const eligible = new Set([CORE_A, CORE_B]);
    const ids = sampleIdsFor([
      { qid: CORE_A, city: "Oslo, NO" },
      { qid: CORE_A, city: "Oslo, NO" },
      { qid: CORE_B },
      { qid: CORE_B, city: "  " },
      { qid: "feed-tail-x", city: "Oslo, NO" }, // no sample exists for the tail
      { qid: "" },
    ], eligible);
    expect(ids).toEqual([
      citySampleId(CORE_A, "Oslo, NO"),
      worldSampleId(CORE_A),
      worldSampleId(CORE_B),
    ].sort());
  });

  it("defaults to the fit's own corpus", () => {
    expect(sampleIdsFor([{ qid: CORE_A }, { qid: "not-a-question" }])).toEqual([worldSampleId(CORE_A)]);
  });
});

describe("restampSamples", () => {
  type Row = Record<string, unknown>;
  function fakeDb(answers: Row[], docs: Record<string, Row>) {
    const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
    const gotIds: string[] = [];
    let projection: string[] = [];
    let from = 0;
    const answersQuery = {
      orderBy: () => answersQuery,
      select: (...f: string[]) => { projection = f; return answersQuery; },
      limit: () => answersQuery,
      startAfter: () => { from = answers.length; return answersQuery; },
      async get() {
        const slice = answers.slice(from);
        return { size: slice.length, docs: slice.map((r) => ({ get: (f: string) => (projection.includes(f) ? r[f] : undefined) })) };
      },
    };
    const db = {
      collection: (name: string) => ({
        doc: (id: string) => (name === "v2_users"
          ? { collection: () => answersQuery }
          : { __id: id }),
      }),
      async getAll(...refs: Array<{ __id: string }>) {
        return refs.map((r) => {
          gotIds.push(r.__id);
          const data = docs[r.__id];
          return { exists: !!data, ref: r, get: (f: string) => data?.[f] };
        });
      },
      batch: () => {
        const pending: typeof updates = [];
        return {
          update: (ref: { __id: string }, data: Record<string, unknown>) => { pending.push({ id: ref.__id, data }); },
          async commit() { updates.push(...pending); },
        };
      },
    };
    return { db: db as unknown as Parameters<typeof restampSamples>[0], updates, gotIds, projection: () => projection };
  }

  const stamp = { n: "Olaf", s: { big5: { O: 70 } }, l: 55 };

  it("rewrites the three stamp fields under the account's row, in every sample that holds one", async () => {
    const world = worldSampleId(CORE_A);
    const city = citySampleId(CORE_A, "Oslo, NO");
    const { db, updates, gotIds, projection } = fakeDb(
      [{ qid: CORE_A, anchors: { city: "Oslo, NO" } }, { qid: CORE_B }],
      {
        [world]: { rows: { u1: { o: 0, a: {}, d: "2026-09-01", n: "old" }, u2: { o: 1, a: {}, d: "2026-09-01" } } },
        [city]: { rows: { u1: { o: 0, a: { city: "Oslo, NO" }, d: "2026-09-01" } } },
        // CORE_B's sample exists but this account has no row in it
        [worldSampleId(CORE_B)]: { rows: { u2: { o: 1, a: {}, d: "2026-09-01" } } },
      },
    );
    const touched = await restampSamples(db, "u1", stamp);
    expect(touched).toBe(2);
    expect(projection(), "the answers read carries more than the two fields it needs").toEqual(["qid", "anchors"]);
    expect(gotIds.sort()).toEqual([city, world, worldSampleId(CORE_B)].sort());
    expect(updates.map((u) => u.id).sort()).toEqual([city, world].sort());
    for (const u of updates) {
      expect(u.data).toEqual({ "rows.u1.n": "Olaf", "rows.u1.s": { big5: { O: 70 } }, "rows.u1.l": 55 });
    }
  });

  it("writes nothing for a row that is not there — a partial row would be minted otherwise", async () => {
    const { db, updates } = fakeDb(
      [{ qid: CORE_A }],
      { [worldSampleId(CORE_A)]: { rows: { u2: { o: 1, a: {}, d: "2026-09-01" } } } },
    );
    expect(await restampSamples(db, "u1", stamp)).toBe(0);
    expect(updates).toEqual([]);
  });

  it("reads nothing at all for an account with no corpus answers", async () => {
    const { db, gotIds } = fakeDb([{ qid: "learn-cell1" }], {});
    expect(await restampSamples(db, "u1", stamp)).toBe(0);
    expect(gotIds).toEqual([]);
  });
});

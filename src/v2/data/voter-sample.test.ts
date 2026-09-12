// The nightly voter sample's reader, and the distinctions it makes:
// absent versus empty, and — since DATA-EFFICIENCY-RUNBOOK 2.3 — a row
// that can name its person versus one that cannot.
//
// `fetchVoterSample` is the D397 read that stands in for a 200-document
// collection-group query, and BOTH its callers key their fallback on it
// returning null — `sayRows` (data/patterns.ts) with `?? fetchVoterPicks`,
// and `LIVE.loadVoterSample` with an `if (!rows)` flag. An existing
// document with no usable rows used to return `[]`, which is truthy for
// `??` and takes the else branch of the `if`, so both callers reported a
// crowd of nobody and neither ever asked the live query.
//
// Reachable rather than theoretical: `deleteAccount`'s scrub (index.ts
// § 1a') field-deletes one uid's row and leaves the document standing, so
// a sample whose only voter erases their account is `rows: {}` on disk.
//
// The rest of this reader (chunking, grouping, ordering) is voters.test.ts';
// what is pinned here is the absent/empty rule the docstring promises, the
// cache fill the stamps buy, the tail query's shape and the union's order.
import { describe, expect, it, vi } from "vitest";

const getDoc = vi.fn();
const getDocs = vi.fn();
const queries: Array<{ src: string; wheres: Array<{ field: string; op: string; value: unknown }>; limit?: number }> = [];
vi.mock("../../lib/firebase", () => ({
  getDb: () => Promise.resolve({ __db: true }),
  getFirestoreApi: () => Promise.resolve({
    doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
    getDoc,
    collectionGroup: (_db: unknown, name: string) => ({ src: name }),
    query: (src: { src: string }, ...parts: Array<Record<string, unknown>>) => {
      const q = {
        src: src.src,
        wheres: parts.filter((p) => p.__kind === "where") as Array<{ field: string; op: string; value: unknown }>,
        limit: (parts.find((p) => p.__kind === "limit") as { n?: number } | undefined)?.n,
      };
      queries.push(q);
      return q;
    },
    where: (field: string, op: string, value: unknown) => ({ __kind: "where", field, op, value }),
    orderBy: (field: string, dir: string) => ({ __kind: "orderBy", field, dir }),
    limit: (n: number) => ({ __kind: "limit", n }),
    Timestamp: { fromMillis: (ms: number) => ({ ms }) },
    getDocs,
  }),
}));

// The reads moved to votersFetch.ts at D482; the pure half kept the name.
const {
  citySampleId, unionVoters, VOTER_FETCH_CAP, VOTER_TAIL_CAP, worldSampleId,
} = await import("./voters");
const {
  fetchSampleDoc, fetchVoterSample, fetchVoterTail,
} = await import("./votersFetch");

/** A snapshot the reader will accept, or `null` for a document that is not there. */
const snap = (rows: Record<string, unknown> | null) => ({
  exists: () => rows !== null,
  get: (k: string) => (k === "rows" ? rows ?? undefined : undefined),
});

describe("fetchVoterSample: absent and empty are the same answer", () => {
  it("returns null when no sample document exists", () => {
    getDoc.mockResolvedValueOnce(snap(null));
    return expect(fetchVoterSample({} as never, "q1")).resolves.toBeNull();
  });

  it("returns null for a document whose rows are empty", async () => {
    // The erasure case. `[]` here is what made both callers cache
    // "nobody answered" for a question the live query would have answered.
    getDoc.mockResolvedValueOnce(snap({}));
    expect(await fetchVoterSample({} as never, "q1")).toBeNull();
  });

  it("returns null when every row is unusable", async () => {
    // Same fact through the other door: rows present, none of them a
    // voter. The filter drops anything without a numeric option, so a
    // catalogue row or a half-written document lands here.
    getDoc.mockResolvedValueOnce(snap({ ua: { o: "3", d: "2026-09-05" }, ub: {} }));
    expect(await fetchVoterSample({} as never, "q1")).toBeNull();
  });

  it("still returns the rows when there are any — the control", async () => {
    // Or every case above would pass on a reader that returned null
    // always. Newest day first, then uid; `isMe` marks the viewer.
    getDoc.mockResolvedValueOnce(snap({
      ub: { o: 1, a: { ageBand: "25-34" }, d: "2026-09-04" },
      ua: { o: 0, a: {}, d: "2026-09-05" },
    }));
    const out = await fetchVoterSample({} as never, "q1", "ua");
    expect(out?.map((v) => v.uid)).toEqual(["ua", "ub"]);
    expect(out?.[0].isMe).toBe(true);
    expect(out?.[1].anchors).toEqual({ ageBand: "25-34" });
  });

  it("one usable row among unusable ones is still a sample", async () => {
    // The boundary the empty rule must not overshoot: a single real
    // voter is a crowd of one, not an absent sample.
    getDoc.mockResolvedValueOnce(snap({ ua: { o: 0, d: "2026-09-05" }, ub: { o: null } }));
    expect((await fetchVoterSample({} as never, "q1"))?.map((v) => v.uid)).toEqual(["ua"]);
  });
});

describe("the stamps on the rows fill the session's caches (DATA-EFFICIENCY-RUNBOOK 2.3)", () => {
  it("names, scores and logic land for a stamped row; an unstamped row leaves its person to resolveNames", async () => {
    getDoc.mockResolvedValueOnce(snap({
      ua: { o: 0, a: {}, d: "2026-09-05", n: "  Ada ", s: { big5: { O: 70.4, C: "12" }, hostile: { x: 1 } }, l: 55.5 },
      ub: { o: 1, a: {}, d: "2026-09-04" },
      uc: { o: 1, a: {}, d: "2026-09-03", n: "", s: null, l: null },
    }));
    const caches = { names: {} as Record<string, string>, scores: {} as Record<string, unknown>, logic: {} as Record<string, unknown> };
    const read = await fetchSampleDoc({} as never, "q1", null, caches as never);
    expect(read?.newestDay).toBe("2026-09-05");
    expect(caches.names).toEqual({ ua: "Ada", uc: "" });
    expect(caches.scores).toEqual({ ua: { big5: { O: 70, C: 12 } }, uc: null });
    expect(caches.logic).toEqual({ ua: 56, uc: null });
    expect("ub" in caches.names, "an unstamped row minted a name").toBe(false);
    // …and the rows carry what the cache now holds
    expect(read?.rows.map((r) => [r.uid, r.name])).toEqual([["ua", "Ada"], ["ub", ""], ["uc", ""]]);
  });

  it("never overwrites what the session already read live", async () => {
    getDoc.mockResolvedValueOnce(snap({ ua: { o: 0, a: {}, d: "2026-09-05", n: "Old", s: null, l: 1 } }));
    const caches = { names: { ua: "Fresh" }, scores: { ua: { big5: { O: 9 } } }, logic: { ua: 99 } };
    await fetchSampleDoc({} as never, "q1", null, caches as never);
    expect(caches).toEqual({ names: { ua: "Fresh" }, scores: { ua: { big5: { O: 9 } } }, logic: { ua: 99 } });
  });

  it("reads the city's document when a city is given, under the id the server writes (runbook 2.5)", async () => {
    // The two packages do not share a build, so the id is pinned as the
    // literal functions/src/patternsSamples.test.ts pins too.
    expect(worldSampleId("daily-000")).toBe("sample-daily-000");
    expect(citySampleId("daily-000", "Oslo, NO")).toBe("city-daily-000~Oslo%2C%20NO");
    getDoc.mockResolvedValueOnce(snap({ ua: { o: 0, a: { city: "Oslo, NO" }, d: "2026-09-05" } }));
    const rows = await fetchVoterSample({} as never, "daily-000", null, undefined, "Oslo, NO");
    expect(rows?.map((r) => r.uid)).toEqual(["ua"]);
    const target = getDoc.mock.calls[getDoc.mock.calls.length - 1][0] as { path: string };
    expect(target.path).toBe("v2_patterns/city-daily-000~Oslo%2C%20NO");
  });
});

describe("the live tail (runbook 2.4)", () => {
  it("asks for answers from the day after the sample's newest, newest first, capped, with the surface clause intact", async () => {
    queries.length = 0;
    getDocs.mockResolvedValueOnce({ docs: [] });
    await fetchVoterTail({} as never, "q1", null, "2026-09-05");
    expect(queries).toHaveLength(1);
    const q = queries[0];
    expect(q.src).toBe("answers");
    expect(q.limit).toBe(VOTER_TAIL_CAP);
    const range = q.wheres.find((w) => w.field === "answeredAt");
    expect(range?.op).toBe(">=");
    expect((range?.value as { ms: number }).ms).toBe(Date.UTC(2026, 8, 6));
    // not optional: the rule grants the read as a value test on `surface`
    expect(q.wheres.find((w) => w.field === "surface")?.op).toBe("in");
    expect(q.wheres.find((w) => w.field === "qid")?.value).toBe("q1");
    expect(VOTER_TAIL_CAP).toBeLessThan(VOTER_FETCH_CAP);
  });

  it("unions newest first, one row per person, and cuts at the cap", () => {
    const v = (uid: string, optionIdx: number, isMe = false) => ({ uid, optionIdx, anchors: {}, name: "", isMe });
    const out = unionVoters([v("a", 1), v("b", 1)], [v("b", 0), v("c", 0), v("a", 0)]);
    expect(out.map((r) => [r.uid, r.optionIdx])).toEqual([["a", 1], ["b", 1], ["c", 0]]);
    const many = Array.from({ length: VOTER_FETCH_CAP + 10 }, (_, i) => v(`u${i}`, 0));
    expect(unionVoters([v("me", 1, true)], many)).toHaveLength(VOTER_FETCH_CAP);
    expect(unionVoters([v("me", 1, true)], many)[0].isMe).toBe(true);
  });
});

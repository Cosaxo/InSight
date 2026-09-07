// The nightly voter sample's reader, and the one distinction it makes:
// absent versus empty.
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
// what is pinned here is the absent/empty rule the docstring promises.
import { describe, expect, it, vi } from "vitest";

const getDoc = vi.fn();
vi.mock("../../lib/firebase", () => ({
  getDb: () => Promise.resolve({ __db: true }),
  getFirestoreApi: () => Promise.resolve({
    doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
    getDoc,
  }),
}));

const { fetchVoterSample } = await import("./voters");

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

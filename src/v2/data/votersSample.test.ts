// The nightly sample's reader (D397), on the rows a document can hold:
// a vote's row carries its option, a catalogue pick's carries the entity
// instead (D453), and a row with neither is not a voter. Pinned here
// rather than in voters.test.ts because that file has no Firestore mock
// and this reader needs one document.
import { describe, expect, it, vi } from "vitest";

const remote = vi.hoisted(() => ({ rows: null as null | Record<string, unknown> }));
vi.mock("../../lib/firebase", () => ({
  getDb: async () => ({}),
  getFirestoreApi: async () => ({
    doc: (_db: unknown, col: string, id: string) => ({ col, id }),
    getDoc: async () => ({
      exists: () => remote.rows != null,
      get: (k: string) => (k === "rows" ? remote.rows : undefined),
    }),
  }),
}));

import { fetchVoterSample } from "./voters";

describe("fetchVoterSample", () => {
  it("returns a vote's row with its option and a pick's row with its entity, newest first", async () => {
    remote.rows = {
      u1: { o: 1, a: { city: "Oslo, NO" }, d: "2026-09-08" },
      u2: { e: "25", a: {}, d: "2026-09-09" },
      u3: { a: {}, d: "2026-09-09" },           // neither: not a voter
      u4: { e: "", d: "2026-09-09" },           // an empty key is no pick
    };
    const rows = (await fetchVoterSample({} as never, "pick-x", "u1"))!;
    expect(rows.map((r) => r.uid)).toEqual(["u2", "u1"]);
    expect(rows[0]).toEqual({ uid: "u2", optionIdx: -1, entity: "25", anchors: {}, name: "", isMe: false });
    expect(rows[1]).toEqual({ uid: "u1", optionIdx: 1, anchors: { city: "Oslo, NO" }, name: "", isMe: true });
  });

  it("reads a document with no usable rows as absent", async () => {
    remote.rows = { u3: { a: {}, d: "2026-09-09" } };
    expect(await fetchVoterSample({} as never, "qa")).toBeNull();
    remote.rows = null;
    expect(await fetchVoterSample({} as never, "qa")).toBeNull();
  });
});

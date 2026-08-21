// The Circle's READ half, which had 25% statement coverage and no
// executing test — `circle.test.ts` covers the pure helpers, and
// `LiveCircleBody.test.tsx` stubs this end out.
//
// WHY THESE THREE. Each returns something a screen states as fact about
// another person, and each fails silently:
//
//   fetchFollowing   — the follow cap is applied to a SORTED page. Flip
//   the comparator and a user over the cap loses their OLDEST follows
//   instead of their newest, which is the opposite of the stability the
//   sort exists for.
//
//   fetchFollowersOf — the follower is the uid that OWNS the row, two
//   levels up the path. Read `d.id` instead and every "follows you back"
//   badge in the app is wrong.
//
//   fetchAnswersOf   — the `surface` filter is not a nicety: firestore
//   .rules grants the cross-user read as a VALUE test on that field, so a
//   query without a matching `where` is refused WHOLESALE (D65). It is
//   also what keeps sealed duel answers out of a Circle reading.

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  /** Every query this module issued, as the plain shape a test can read. */
  queries: [] as Array<Record<string, unknown>>,
  docs: [] as Array<{ id: string; path: string; data: Record<string, unknown> }>,
}));

vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...p: string[]) => ({ __k: "collection", path: p.join("/") }),
  collectionGroup: (_db: unknown, name: string) => ({ __k: "group", path: name }),
  query: (src: { path?: string }, ...parts: Array<Record<string, unknown>>) => {
    const q = {
      path: src?.path,
      wheres: parts.filter((p) => p.__k === "where").map((p) => [p.field, p.op, p.val]),
      limit: (parts.find((p) => p.__k === "limit") || {}).n ?? null,
    };
    h.queries.push(q);
    return q;
  },
  where: (field: unknown, op: unknown, val: unknown) => ({ __k: "where", field, op, val }),
  limit: (n: number) => ({ __k: "limit", n }),
  orderBy: () => ({ __k: "orderBy" }),
  getDocs: () => Promise.resolve({
    size: h.docs.length,
    docs: h.docs.map((d) => ({
      id: d.id,
      data: () => d.data,
      get: (k: string) => d.data[k],
      // v2_users/{uid}/following/{to} — parent is the subcollection, its
      // parent is the owner's document. The shape the real SDK hands back,
      // and the reason `d.id` is the tempting wrong answer.
      ref: {
        path: d.path,
        parent: { parent: { id: d.path.split("/")[1] } },
      },
    })),
  }),
}));

beforeEach(() => { h.queries = []; h.docs = []; });

const following = (owner: string, to: string, atSeconds: number) => ({
  id: to,
  path: `v2_users/${owner}/following/${to}`,
  data: { to, at: { seconds: atSeconds } },
});

describe("fetchFollowing", () => {
  it("returns oldest first, so the cap is stable across sessions", async () => {
    const { fetchFollowing } = await import("./circle");
    h.docs = [
      following("me", "u_new", 300),
      following("me", "u_old", 100),
      following("me", "u_mid", 200),
    ];
    expect(await fetchFollowing({} as never, "me")).toEqual(["u_old", "u_mid", "u_new"]);
  });

  it("breaks ties on the uid, so two sessions agree", async () => {
    // The server page arrives in whatever order it likes and the sort runs
    // on the client, so equal timestamps must not leave the order to the
    // page. A cap applied to an unstable list drops a different person
    // each open.
    const { fetchFollowing } = await import("./circle");
    h.docs = [following("me", "u_b", 100), following("me", "u_a", 100)];
    expect(await fetchFollowing({} as never, "me")).toEqual(["u_a", "u_b"]);
  });

  it("treats a row with no timestamp as the oldest rather than dropping it", async () => {
    // Rows written before `at` existed. Sorting them to the front is the
    // conservative read — they ARE the oldest — and the thing that must
    // not happen is a follow vanishing from the list because a field is
    // missing.
    const { fetchFollowing } = await import("./circle");
    h.docs = [
      following("me", "u_timed", 500),
      { id: "u_untimed", path: "v2_users/me/following/u_untimed", data: {} },
    ];
    expect(await fetchFollowing({} as never, "me")).toEqual(["u_untimed", "u_timed"]);
  });

  it("asks the server for at most FOLLOW_CAP rows", async () => {
    const { fetchFollowing, FOLLOW_CAP } = await import("./circle");
    await fetchFollowing({} as never, "me");
    expect(h.queries[0].path).toBe("v2_users/me/following");
    expect(h.queries[0].limit, "the read was unbounded").toBe(FOLLOW_CAP);
  });
});

describe("fetchFollowersOf", () => {
  it("reads the follower off the path, not off the document id", async () => {
    // v2_users/{follower}/following/{me}: the document is named after the
    // person being followed, so `d.id` is ME on every row. Reading it
    // would make the mutual set a set of one — my own uid — and every
    // "follows you back" badge in the app wrong at once.
    const { fetchFollowersOf } = await import("./circle");
    h.docs = [
      following("u_ada", "me", 1),
      following("u_alan", "me", 2),
    ];
    const back = await fetchFollowersOf({} as never, "me", ["u_ada", "u_grace"]);
    expect([...back]).toEqual(["u_ada"]);
    // u_alan follows me but was not among the candidates asked about, and
    // u_grace was asked about but does not follow back.
    expect(back.has("u_alan")).toBe(false);
    expect(back.has("u_grace")).toBe(false);
  });

  it("queries the collection group on `to`, which is the index that exists", async () => {
    const { fetchFollowersOf } = await import("./circle");
    await fetchFollowersOf({} as never, "me", ["u_ada"]);
    expect(h.queries[0].path).toBe("following");
    expect(h.queries[0].wheres).toEqual([["to", "==", "me"]]);
  });

  it("issues no query at all for an empty candidate list", async () => {
    // A read with nothing to answer is a billed read for nothing, and the
    // `in`-style filter would be empty anyway.
    const { fetchFollowersOf } = await import("./circle");
    expect([...await fetchFollowersOf({} as never, "me", [])]).toEqual([]);
    expect(h.queries).toEqual([]);
  });
});

describe("fetchAnswersOf", () => {
  it("carries the surface filter the rules grant the read on", async () => {
    // NOT a nicety. firestore.rules grants this cross-user read as a value
    // test on `surface`, so a query without a matching `where` is refused
    // wholesale rather than filtered down (D65) — and the same clause is
    // what keeps sealed duel answers out of a Circle reading.
    const { fetchAnswersOf } = await import("./circle");
    await fetchAnswersOf({} as never, "u_ada");
    const q = h.queries[0];
    expect(q.path).toBe("v2_users/u_ada/answers");
    expect(
      (q.wheres as unknown[][]).some((w) => w[0] === "surface"),
      "the cross-user answer read went out without its surface filter — rules refuse it wholesale",
    ).toBe(true);
  });
});

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
      orderBys: parts.filter((p) => p.__k === "orderBy").map((p) => p.field),
    };
    h.queries.push(q);
    return q;
  },
  where: (field: unknown, op: unknown, val: unknown) => ({ __k: "where", field, op, val }),
  // The two the exact follower read needs. `documentId()` is a sentinel in
  // the real SDK too — a marker the query builder recognises — so a string
  // stands in for it here without weakening anything.
  documentId: () => "__name__",
  doc: (_db: unknown, ...p: string[]) => ({ __k: "doc", path: p.join("/") }),
  limit: (n: number) => ({ __k: "limit", n }),
  orderBy: (field: string) => ({ __k: "orderBy", field }),
  // THE FAKE FILTERS, because the code under test stopped filtering on the
  // device. `fetchFollowersOf` now names the exact rows it wants and lets
  // the server return only those; a fake that handed back everything
  // regardless would be more permissive than Firestore and would pass a
  // query that asked for the wrong documents.
  getDocs: (q: { wheres?: Array<[unknown, unknown, unknown]> }) => {
    const idIn = (q?.wheres || []).find((w) => w[0] === "__name__" && w[1] === "in");
    const want = idIn
      ? new Set((idIn[2] as Array<{ path: string }>).map((r) => r.path))
      : null;
    const docs = want ? h.docs.filter((d) => want.has(d.path)) : h.docs;
    return Promise.resolve({
    size: docs.length,
    docs: docs.map((d) => ({
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
    });
  },
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

  it("orders BEFORE the cap, so the fifty kept are the oldest fifty", async () => {
    // The cap is documented as "oldest first so it is stable across
    // sessions", and the sort that delivered that ran on the page AFTER
    // Firestore had already chosen it. An unordered `limit` takes
    // documents by NAME, so an account over the cap kept the
    // alphabetically-first fifty target uids and lost the rest of its
    // circle silently — the client sort only reordered what had already
    // been picked.
    const { fetchFollowing } = await import("./circle");
    await fetchFollowing({} as never, "me");
    expect(h.queries[0].orderBys, "the cap is applied to an unordered read")
      .toEqual(["at"]);
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

  it("keeps the `to` equality AND names the exact rows it wants", async () => {
    // Two filters, and both are load-bearing. `to == me` is what
    // firestore.rules gates the collection group on, and D65's measured
    // lesson is that a collection-group read must carry the matching
    // `where` or Firestore refuses the whole query. The id filter is the
    // fix: it asks for the candidates' own rows instead of fetching a page
    // of everyone's and intersecting on the device.
    const { fetchFollowersOf } = await import("./circle");
    await fetchFollowersOf({} as never, "me", ["u_ada"]);
    expect(h.queries[0].path).toBe("following");
    expect(h.queries[0].wheres).toEqual([
      ["to", "==", "me"],
      ["__name__", "in", [{ __k: "doc", path: "v2_users/u_ada/following/me" }]],
    ]);
    // …and no row cap, because the id list IS the bound.
    expect(h.queries[0].limit).toBeNull();
  });

  it("finds a mutual however many OTHER followers there are", async () => {
    // The defect this replaced. The read used to fetch one page of
    // "everyone who follows me" — 100 rows, no ordering — and intersect it
    // here. Firestore's implicit order is by path, so past 100 followers
    // the page was the lexicographically-first hundred, picked without
    // reference to the people being asked about: a mutual outside it read
    // as false, the Circle printed "N follow you back" too low, and at
    // zero it told someone whose circle does follow them back that
    // following is one-way.
    //
    // 200 other followers sort before the candidate, so any page-and-
    // intersect shape misses them.
    const { fetchFollowersOf } = await import("./circle");
    h.docs = [
      ...Array.from({ length: 200 }, (_, i) =>
        following(`u_aaa${String(i).padStart(3, "0")}`, "me", i)),
      following("u_zoe", "me", 999),
    ];
    const back = await fetchFollowersOf({} as never, "me", ["u_zoe"]);
    expect([...back]).toEqual(["u_zoe"]);
  });

  it("splits a candidate list past Firestore's `in` limit into whole chunks", async () => {
    // 30 is the limit on `in`. A list of 50 — the follow cap — is two
    // queries, and every candidate must appear in one of them or the
    // people in the tail silently lose their badge.
    const { fetchFollowersOf } = await import("./circle");
    const among = Array.from({ length: 50 }, (_, i) => `u_${String(i).padStart(3, "0")}`);
    h.docs = among.map((u, i) => following(u, "me", i));
    const back = await fetchFollowersOf({} as never, "me", among);
    expect(h.queries).toHaveLength(2);
    for (const q of h.queries) {
      const ids = (q.wheres as Array<[string, string, unknown[]]>)[1];
      expect(ids[0]).toBe("__name__");
      expect(ids[2].length).toBeLessThanOrEqual(30);
    }
    expect(back.size).toBe(50);
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

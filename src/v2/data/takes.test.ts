// Unit tests for the circle-takes surface in live.ts — the client half of
// the moderation chain (D1, docs/MODERATION.md).
//
// The load-bearing case here is the LIST QUERY's constraint set, and it is
// worth saying why it earns a test of its own. The `v2_takes` read rule is
// an equality on `hidden`, and Firestore can only hold a list operation to
// a rule it can compare against the query's own constraints — so a query
// that drops `where("hidden", "==", false)` does not return MORE takes, it
// returns permission-denied for every member of every circle (D65). That
// failure is invisible to every other guard in this repo: `tsc -b` sees a
// well-typed query, eslint sees nothing, `check:globals` sees no name, and
// firestore-tests exercise the RULE rather than the client that has to
// match it. This file is the only thing standing between a dropped filter
// and a takes list that is empty on every device.
//
// Same module-rebuild harness as vote.test.ts: live.ts holds module-level
// state, so each test re-imports it against hoisted mocks.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeSnapshotDoc {
  id: string;
  data: Record<string, unknown>;
}

interface Constraint {
  kind: string;
  field?: string;
  op?: string;
  value?: unknown;
  dir?: string;
  /** The cap, carried so a retune has to come through these assertions. */
  n?: number;
}

const h = vi.hoisted(() => ({
  reportError: vi.fn(),
  setDocImpl: null as null | (() => Promise<void>),
  setDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  deleteCalls: [] as string[],
  takeDocs: [] as FakeSnapshotDoc[],
  // Boot needs a daily bank or LIVE.ready never flips — the takes surface
  // hangs off a booted store, so this is setup, not subject.
  bankDocs: [] as FakeSnapshotDoc[],
  // Every query() built this session, with the constraints it carried.
  queries: [] as Array<{ path?: string; constraints: Constraint[] }>,
  authCb: null as null | ((u: { uid: string } | null) => void),
  autoId: 0,
}));

vi.mock("../../lib/firebase", () => ({
  firebaseEnabled: true,
  anonSignIn: () => Promise.resolve("uid_test"),
  getDb: () => Promise.resolve({ __db: true }),
  // The API surfaces live.ts binds off the same promise as getDb (D110).
  // `vi.mock("firebase/firestore")` in this file already replaced the real
  // module (vi.mock hoists, so its position below is immaterial), so importing
  // it here hands the store exactly the doubles this file asserts on — and
  // every case in it now also exercises the bind step.
  getFirestoreApi: () => import("firebase/firestore"),
  getFunctionsApi: () => import("firebase/functions"),
  linkGoogle: () => Promise.resolve(),
  googleSignOut: () => Promise.resolve(),
  subscribeToAuth: (cb: (u: { uid: string } | null) => void) => {
    h.authCb = cb;
    return () => { h.authCb = null; };
  },
}));

vi.mock("../../lib/sentry", () => ({
  reportError: h.reportError,
  setSentryUser: vi.fn(),
}));

vi.mock("./push", () => ({
  registerPush: () => Promise.resolve(),
}));

vi.mock("firebase/functions", () => ({
  getFunctions: vi.fn(),
  httpsCallable: vi.fn(),
}));

vi.mock("firebase/firestore", () => {
  const ref = (kind: string, path: string[]) => ({ __kind: kind, path: path.join("/") });
  const snapOf = (docs: FakeSnapshotDoc[]) => ({
    size: docs.length,
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d.data,
      get: (k: string) => d.data[k],
    })),
  });
  return {
    collection: (_db: unknown, ...path: string[]) => ref("collection", path),
    // Two call shapes, and the difference matters: `doc(db, "col", "id")`
    // addresses a known document, while `doc(collection(db, "v2_takes"))`
    // MINTS an id client-side — which is the shape postTake needs, because
    // the moderation queue keys on the take id.
    doc: (first: unknown, ...path: string[]) => {
      const c = first as { __kind?: string; path?: string };
      if (path.length === 0 && c?.__kind === "collection") {
        h.autoId += 1;
        const id = `auto_${h.autoId}`;
        return { __kind: "doc", path: `${c.path}/${id}`, id };
      }
      return { ...ref("doc", path), id: path[path.length - 1] };
    },
    query: (src: { path?: string }, ...constraints: Constraint[]) => {
      h.queries.push({ path: src?.path, constraints });
      return { __kind: "query", path: src?.path, constraints };
    },
    where: (field: string, op: string, value: unknown): Constraint =>
      ({ kind: "where", field, op, value }),
    orderBy: (field: string, dir?: string): Constraint => ({ kind: "orderBy", field, dir }),
    // D161: live.ts destructures the whole surface, so this must exist even
    // though the bank fetch is not what this file exercises.
    startAfter: (): Constraint => ({ kind: "startAfter" }),
    limit: (n: number): Constraint => ({ kind: "limit", n }),
    documentId: (): Constraint => ({ kind: "documentId" }),
    serverTimestamp: () => ({ __kind: "serverTimestamp" }),
    Timestamp: { fromMillis: (ms: number) => ({ ms }) },
    getDoc: () =>
      Promise.resolve({ exists: () => false, get: () => undefined, data: () => ({}) }),
    getDocs: (q: { path?: string }) => {
      if (q?.path === "v2_takes") return Promise.resolve(snapOf(h.takeDocs));
      if (q?.path === "v2_questions") return Promise.resolve(snapOf(h.bankDocs));
      return Promise.resolve(snapOf([]));
    },
    onSnapshot: () => vi.fn(),
    setDoc: (target: { path: string }, data: Record<string, unknown>) => {
      h.setDocCalls.push({ path: target.path, data });
      return h.setDocImpl ? h.setDocImpl() : Promise.resolve();
    },
    // D331 — the fsApi surface is destructured whole at boot, so a member
    // missing here fails every test in the file at getDb rather than at
    // the call. Sentinel: nothing in takes writes one.
    deleteField: () => "__delete__",
    deleteDoc: (target: { path: string }) => {
      h.deleteCalls.push(target.path);
      return Promise.resolve();
    },
    updateDoc: () => Promise.resolve(),
    terminate: () => Promise.resolve(),
    clearIndexedDbPersistence: () => Promise.resolve(),
  };
});

// ── harness ─────────────────────────────────────────────────────────

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  clear(): void {
    this.m.clear();
  }
  key(i: number): string | null {
    return [...this.m.keys()][i] ?? null;
  }
  get length(): number {
    return this.m.size;
  }
}

const GID = "g_circle";

// A take as Firestore hands it back: createdAt is a Timestamp, not a
// number, which is exactly the conversion takeFromDoc exists for.
const takeDoc = (id: string, ms: number, over: Record<string, unknown> = {}): FakeSnapshotDoc => ({
  id,
  data: {
    gid: GID,
    authorUid: "uid_other",
    qid: "q_1",
    text: `take ${id}`,
    createdAt: { toMillis: () => ms },
    hidden: false,
    ...over,
  },
});

async function bootLive() {
  const mod = await import("./live");
  const LIVE = mod.default;
  await mod.initLive(1);
  await vi.waitFor(() => {
    expect(LIVE.ready).toBe(true);
  });
  return LIVE;
}

// The one v2_takes query of the session.
const takesQuery = () => h.queries.find((q) => q.path === "v2_takes");

beforeEach(() => {
  vi.resetModules();
  h.reportError.mockClear();
  h.setDocImpl = null;
  h.setDocCalls.length = 0;
  h.deleteCalls.length = 0;
  h.queries.length = 0;
  h.takeDocs.length = 0;
  h.authCb = null;
  h.autoId = 0;
  h.bankDocs = [
    {
      id: "q_1",
      data: {
        surface: "daily",
        seq: 1,
        type: "vote",
        prompt: "Prompt q_1",
        options: ["A", "B"],
        topic: null,
        test: null,
        active: true,
      },
    },
  ];
  vi.stubGlobal("localStorage", new MemoryStorage());
  vi.stubGlobal("window", {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal("document", {
    hidden: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubEnv("VITE_V2_LIVE", "true");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// ── the query shape the read rule holds the client to ────────────────

describe("loadTakes query shape (D65)", () => {
  it("carries where(hidden == false) — without it the rule denies the LIST", async () => {
    const LIVE = await bootLive();
    await LIVE.social.loadTakes(GID);

    const q = takesQuery();
    expect(q).toBeDefined();
    // The assertion is on the literal triple, not on "a constraint
    // mentioning hidden": `where("hidden", "!=", true)` reads as the same
    // intent and is a different query, which the rule would refuse.
    expect(q?.constraints).toContainEqual({
      kind: "where",
      field: "hidden",
      op: "==",
      value: false,
    });
  });

  it("matches the committed composite index (gid, hidden, createdAt DESC)", async () => {
    const LIVE = await bootLive();
    await LIVE.social.loadTakes(GID);

    // firestore.indexes.json holds two v2_takes indexes: this circle one
    // and the world one (gid, qid, hidden, createdAt — the suite below).
    // A query that stops matching its index fails on its first production
    // run, and nothing else in the tree compares the two.
    expect(takesQuery()?.constraints).toEqual([
      { kind: "where", field: "gid", op: "==", value: GID },
      { kind: "where", field: "hidden", op: "==", value: false },
      { kind: "orderBy", field: "createdAt", dir: "desc" },
      // A ceiling, not a display cap — this branch filters by qid in
      // memory, so a tight limit would hide an old question's takes behind
      // newer chatter. Pinned by value so a retune passes through here.
      { kind: "limit", n: 500 },
    ]);
  });

  it("filters by question in memory rather than as a fourth where", async () => {
    h.takeDocs.push(takeDoc("t1", 3000), takeDoc("t2", 2000, { qid: "q_2" }));
    const LIVE = await bootLive();
    await LIVE.social.loadTakes(GID);

    expect(LIVE.social.takes(GID).map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(LIVE.social.takes(GID, "q_2").map((t) => t.id)).toEqual(["t2"]);
    // A qid equality would need a second composite index for a list one
    // circle big — so the WHERE count must stay at two. Counted by kind
    // rather than by array length, which is what this always meant: the
    // limit() added for the read bound is not a filter and does not change
    // which index serves the query.
    expect(takesQuery()?.constraints.filter((c) => c.kind === "where")).toHaveLength(2);
  });

  it("leaves the list absent after a failed fetch rather than caching empty", async () => {
    const LIVE = await bootLive();
    const mod = await import("firebase/firestore");
    vi.spyOn(mod, "getDocs").mockRejectedValueOnce(new Error("offline"));

    await LIVE.social.loadTakes(GID);

    expect(h.reportError).toHaveBeenCalled();
    // A cached empty list reads exactly like a circle that never wrote a
    // take; absence lets the next open retry.
    expect(LIVE.social.takes(GID)).toEqual([]);
    h.queries.length = 0;
    h.takeDocs.push(takeDoc("t1", 1000));
    await LIVE.social.loadTakes(GID);
    expect(LIVE.social.takes(GID).map((t) => t.id)).toEqual(["t1"]);
  });
});

// ── the world scope (D83) ────────────────────────────────────────────
//
// Same five members, sentinel gid "world". The load-bearing differences:
// the query carries qid (the cache and the second composite index are
// per-question — "every world take ever" is unbounded), and the post id
// is `qid_uid`, which is the one-take-per-person-per-question bound the
// create rule checks literally.

describe("world takes", () => {
  it("queries with qid — matching the (gid, qid, hidden, createdAt) index", async () => {
    const LIVE = await bootLive();
    await LIVE.social.loadTakes("world", "q_1");

    expect(takesQuery()?.constraints).toEqual([
      { kind: "where", field: "gid", op: "==", value: "world" },
      { kind: "where", field: "qid", op: "==", value: "q_1" },
      { kind: "where", field: "hidden", op: "==", value: false },
      { kind: "orderBy", field: "createdAt", dir: "desc" },
      // The world question is globally shared, so this crowd is ~DAU and
      // the query returned all of it until the cap. A screen of talk.
      { kind: "limit", n: 100 },
    ]);
  });

  it("refuses a world load with no question rather than minting a phantom key", async () => {
    const LIVE = await bootLive();
    await LIVE.social.loadTakes("world");
    expect(takesQuery()).toBeUndefined();
    expect(LIVE.social.takes("world")).toEqual([]);
  });

  it("caches per question, so two questions' lists never bleed", async () => {
    h.takeDocs.push(takeDoc("w1", 3000, { gid: "world", qid: "q_1" }));
    const LIVE = await bootLive();
    await LIVE.social.loadTakes("world", "q_1");
    h.takeDocs.length = 0;
    h.takeDocs.push(takeDoc("w2", 2000, { gid: "world", qid: "q_2" }));
    await LIVE.social.loadTakes("world", "q_2");

    expect(LIVE.social.takes("world", "q_1").map((t) => t.id)).toEqual(["w1"]);
    expect(LIVE.social.takes("world", "q_2").map((t) => t.id)).toEqual(["w2"]);
  });

  it("posts under the deterministic id qid_uid — the one-take bound", async () => {
    const LIVE = await bootLive();
    await LIVE.social.postTake("world", "q_1", "my world take");

    const write = h.setDocCalls.find((c) => c.path.startsWith("v2_takes/"));
    expect(write?.path).toBe("v2_takes/q_1_uid_test");
    // Still exactly the six keys hasOnly permits — world changes the id,
    // never the shape.
    expect(Object.keys(write?.data ?? {}).sort()).toEqual(
      ["authorUid", "createdAt", "gid", "hidden", "qid", "text"],
    );
    expect(write?.data.gid).toBe("world");
  });

  it("deleteTake clears the take from the per-question world cache", async () => {
    h.takeDocs.push(takeDoc("q_1_uid_test", 3000, { gid: "world", qid: "q_1", authorUid: "uid_test" }));
    const LIVE = await bootLive();
    await LIVE.social.loadTakes("world", "q_1");
    expect(LIVE.social.takes("world", "q_1")).toHaveLength(1);

    await LIVE.social.deleteTake("world", "q_1_uid_test");
    expect(h.deleteCalls).toContain("v2_takes/q_1_uid_test");
    expect(LIVE.social.takes("world", "q_1")).toEqual([]);
  });
});

// ── the create rule's shape ──────────────────────────────────────────

describe("loadTakes caches for the session (the read bound)", () => {
  // The declaration for `state.takes` has always said "fetched on demand
  // and held for the session". Only the in-flight guard existed, so the
  // second half was an intention rather than a behaviour — and
  // LiveTakesPanel loads on a `[gid, qid]` effect, which means once per
  // OPEN, not once per session. These pin the cache so the claim and the
  // code cannot drift apart again.
  const takesQueries = () => h.queries.filter((q) => q.path === "v2_takes");

  it("a second open does not re-query", async () => {
    h.takeDocs.push(takeDoc("t1", 3000));
    const LIVE = await bootLive();

    await LIVE.social.loadTakes(GID);
    expect(takesQueries()).toHaveLength(1);

    await LIVE.social.loadTakes(GID);
    await LIVE.social.loadTakes(GID);
    expect(takesQueries()).toHaveLength(1);
    expect(LIVE.social.takes(GID).map((t) => t.id)).toEqual(["t1"]);
  });

  it("caches an EMPTY result too — 'nobody wrote one' is an answer", async () => {
    const LIVE = await bootLive();
    await LIVE.social.loadTakes(GID);
    await LIVE.social.loadTakes(GID);
    expect(takesQueries()).toHaveLength(1);
  });

  it("still retries after a FAILURE, because absence is not emptiness", async () => {
    const LIVE = await bootLive();
    const mod = await import("firebase/firestore");
    vi.spyOn(mod, "getDocs").mockRejectedValueOnce(new Error("offline"));

    await LIVE.social.loadTakes(GID);
    expect(LIVE.social.takes(GID)).toEqual([]);

    h.takeDocs.push(takeDoc("t1", 1000));
    await LIVE.social.loadTakes(GID);
    // Two queries, not one: the cache guard keys on the list being
    // PRESENT, and the error path leaves it absent on purpose.
    expect(takesQueries()).toHaveLength(2);
    expect(LIVE.social.takes(GID).map((t) => t.id)).toEqual(["t1"]);
  });

  it("keys per question in world scope, so a different qid still fetches", async () => {
    const LIVE = await bootLive();
    await LIVE.social.loadTakes("world", "q_1");
    await LIVE.social.loadTakes("world", "q_1");
    expect(takesQueries()).toHaveLength(1);
    await LIVE.social.loadTakes("world", "q_2");
    expect(takesQueries()).toHaveLength(2);
  });
});

describe("postTake", () => {
  it("writes exactly the six keys hasOnly permits, with hidden false", async () => {
    const LIVE = await bootLive();
    await LIVE.social.postTake(GID, "q_1", "  a take  ");

    const write = h.setDocCalls.find((c) => c.path.startsWith("v2_takes/"));
    expect(write).toBeDefined();
    expect(Object.keys(write?.data ?? {}).sort()).toEqual(
      ["authorUid", "createdAt", "gid", "hidden", "qid", "text"],
    );
    expect(write?.data.authorUid).toBe("uid_test");
    expect(write?.data.text).toBe("a take");
    // Required AND required to be false: a take created without the field
    // could never be read back, by the circle or by its own author.
    expect(write?.data.hidden).toBe(false);
    expect(write?.data.createdAt).toEqual({ __kind: "serverTimestamp" });
  });

  it("caps text at the rule's 280 rather than letting the write be refused", async () => {
    const LIVE = await bootLive();
    await LIVE.social.postTake(GID, "q_1", "x".repeat(400));

    const write = h.setDocCalls.find((c) => c.path.startsWith("v2_takes/"));
    expect(String(write?.data.text)).toHaveLength(280);
  });

  it("echoes the take immediately and rolls it back when the write is refused", async () => {
    const LIVE = await bootLive();
    h.setDocImpl = () => Promise.reject(new Error("permission-denied"));

    await expect(LIVE.social.postTake(GID, "q_1", "refused")).rejects.toThrow();

    // A take left on screen that the circle never received is the failure
    // mode the rollback exists for.
    expect(LIVE.social.takes(GID)).toEqual([]);
    expect(h.reportError).toHaveBeenCalled();
  });

  it("mints the id client-side, because the moderation queue keys on it", async () => {
    const LIVE = await bootLive();
    const id = await LIVE.social.postTake(GID, "q_1", "mine");

    expect(id).toBeTruthy();
    expect(h.setDocCalls.some((c) => c.path === `v2_takes/${id}`)).toBe(true);
    expect(LIVE.social.takes(GID).map((t) => t.id)).toEqual([id]);
  });

  it("refuses an empty take without touching the network", async () => {
    const LIVE = await bootLive();
    expect(await LIVE.social.postTake(GID, "q_1", "   ")).toBeNull();
    expect(h.setDocCalls.some((c) => c.path.startsWith("v2_takes/"))).toBe(false);
  });
});

// ── the report control's write half ──────────────────────────────────

describe("flagTake", () => {
  it("writes v2_flags/{takeId}_{uid} with the four keys the rule allows", async () => {
    const LIVE = await bootLive();
    await LIVE.social.flagTake(GID, "t1");

    const write = h.setDocCalls.find((c) => c.path.startsWith("v2_flags/"));
    // The rule checks this id literally: flagId == takeId + "_" + uid.
    expect(write?.path).toBe("v2_flags/t1_uid_test");
    expect(Object.keys(write?.data ?? {}).sort()).toEqual(["at", "gid", "takeId", "uid"]);
    expect(write?.data.uid).toBe("uid_test");
    expect(LIVE.social.flagged("t1")).toBe(true);
  });

  it("does not re-send a flag the same account already cast", async () => {
    const LIVE = await bootLive();
    await LIVE.social.flagTake(GID, "t1");
    await LIVE.social.flagTake(GID, "t1");

    // The rules deny the second write anyway (create-only, id-pinned); not
    // sending it keeps a refused write out of the error reporter.
    expect(h.setDocCalls.filter((c) => c.path.startsWith("v2_flags/"))).toHaveLength(1);
  });

  it("clears the local mark when the flag write is refused", async () => {
    const LIVE = await bootLive();
    h.setDocImpl = () => Promise.reject(new Error("permission-denied"));

    await expect(LIVE.social.flagTake(GID, "t1")).rejects.toThrow();

    // "Reported" against a flag the server never took is a claim the
    // client cannot re-read to correct — flags are unreadable by design.
    expect(LIVE.social.flagged("t1")).toBe(false);
  });
});

// ── the account switch ───────────────────────────────────────────────

describe("resetForNewUid", () => {
  it("carries no previous account's takes or flags past a uid change", async () => {
    h.takeDocs.push(takeDoc("t1", 2000));
    const LIVE = await bootLive();
    await LIVE.social.loadTakes(GID);
    await LIVE.social.flagTake(GID, "t1");
    expect(LIVE.social.takes(GID)).toHaveLength(1);
    expect(LIVE.social.flagged("t1")).toBe(true);

    // A different account signs in on the same device.
    h.authCb?.({ uid: "uid_other_account" });
    await vi.waitFor(() => {
      expect(LIVE.uid).toBe("uid_other_account");
    });

    // Takes are member-gated: a cached list belongs to a circle the new
    // account may not be in. And "Reported" for a flag it never cast is a
    // claim nothing can re-read to correct — flags are unreadable by
    // design, so the stale mark would simply persist for the session.
    expect(LIVE.social.takes(GID)).toEqual([]);
    expect(LIVE.social.flagged("t1")).toBe(false);
  });

  it("carries no previous account's follow list past a uid change", async () => {
    // The follow cache is the outgoing account's answer to "who are my
    // friends", and it is what puts the Friends chip on a who-voted sheet.
    // loadFollows() early-returns on a non-null cache — `if (state.follows)
    // return` — so a survivor is not corrected by the next load; it stands
    // for the rest of the session, marking strangers as the new account's
    // friends.
    //
    // The null/[] distinction is the assertion, not the contents: null is
    // "not asked or failed", [] is "you follow nobody", and only the reset
    // can put it back to the first. An empty list from the mock is enough
    // to tell the two apart.
    const LIVE = await bootLive();
    await LIVE.loadFollows();
    expect(LIVE.follows()).not.toBeNull();

    h.authCb?.({ uid: "uid_follows_other" });
    await vi.waitFor(() => { expect(LIVE.uid).toBe("uid_follows_other"); });

    expect(LIVE.follows()).toBeNull();
    expect(LIVE.followsLoading()).toBe(false);
  });
});

describe("deleteTake", () => {
  it("deletes by take id and drops it from the cached list", async () => {
    h.takeDocs.push(takeDoc("t1", 2000), takeDoc("t2", 1000));
    const LIVE = await bootLive();
    await LIVE.social.loadTakes(GID);

    await LIVE.social.deleteTake(GID, "t1");

    expect(h.deleteCalls).toEqual(["v2_takes/t1"]);
    expect(LIVE.social.takes(GID).map((t) => t.id)).toEqual(["t2"]);
  });
});

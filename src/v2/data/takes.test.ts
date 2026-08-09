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
  registerPushForReveals: () => Promise.resolve(),
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
    limit: (): Constraint => ({ kind: "limit" }),
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

    // firestore.indexes.json holds exactly one v2_takes index. A query
    // that stops matching it fails on its first production run, and
    // nothing else in the tree compares the two.
    expect(takesQuery()?.constraints).toEqual([
      { kind: "where", field: "gid", op: "==", value: GID },
      { kind: "where", field: "hidden", op: "==", value: false },
      { kind: "orderBy", field: "createdAt", dir: "desc" },
    ]);
  });

  it("filters by question in memory rather than as a fourth where", async () => {
    h.takeDocs.push(takeDoc("t1", 3000), takeDoc("t2", 2000, { qid: "q_2" }));
    const LIVE = await bootLive();
    await LIVE.social.loadTakes(GID);

    expect(LIVE.social.takes(GID).map((t) => t.id)).toEqual(["t1", "t2"]);
    expect(LIVE.social.takes(GID, "q_2").map((t) => t.id)).toEqual(["t2"]);
    // A qid equality would need a second composite index for a list one
    // circle big — so the constraint count must stay at three.
    expect(takesQuery()?.constraints).toHaveLength(3);
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

// ── the create rule's shape ──────────────────────────────────────────

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

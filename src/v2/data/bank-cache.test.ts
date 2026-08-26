// Unit tests for hydrate()'s question-bank cache in live.ts.
//
// Why this file exists: the bank fetch is the single largest read cost in
// the system (docs/COSTS.md). A returning device used to re-read all 369
// question documents on every reseed, because `contentRev` moved on every
// seed run and keyed the whole cache. The seed now moves `updatedAt` only
// on documents it actually rewrote, and this path pages the delta in.
//
// The failure mode is silent in both directions — a broken delta serves a
// stale bank with no error anywhere, and a delta that quietly degrades to
// a full fetch costs money with no symptom — so both are asserted on the
// QUERY the module actually issues, not on its output.
//
// Same harness shape as vote.test.ts: live.ts holds module-level state, so
// every test rebuilds it (vi.resetModules + dynamic import) against hoisted
// mocks. The firestore mock here is richer than vote.test.ts's on purpose —
// it records `where` constraints, which is the only way to tell a full
// fetch from a delta fetch.

import { beforeEach, describe, expect, it, vi } from "vitest";
// The cache store is IndexedDB since D315. fake-indexeddb gives these
// node-environment tests a real IDB implementation, and a fresh factory
// per test is the storage-reset localStorage got from a new MemoryStorage.
import { IDBFactory } from "fake-indexeddb";

interface FakeDoc {
  id: string;
  data: Record<string, unknown>;
}
interface Constraint {
  kind: string;
  field?: string;
  op?: string;
  value?: unknown;
}
interface RecordedQuery {
  path: string | undefined;
  cons: Constraint[];
}

const h = vi.hoisted(() => ({
  reportError: vi.fn(),
  bankDocs: [] as FakeDoc[],
  // Queries issued against v2_questions, in order.
  bankQueries: [] as RecordedQuery[],
  // Lets a test fail just the delta fetch.
  deltaError: null as null | (() => Error),
  // Simulates a cursor that never advances — the one way the paging loop
  // could spin forever. The guard's job is to report and stop.
  stuckCursor: false,
  // The published serving orders (D316) the pagers read, keyed by
  // surface. Empty = no fold has run, which is every pre-D316 test's
  // world.
  rankOrders: {} as Record<string, { topics: Record<string, { qids: string[]; total: number }> }>,
  // The owner's interest profile (D319), served at their own taste path.
  tasteProfile: null as null | { t: Record<string, number>; n: number },
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
    cb({ uid: "uid_test" });
    return () => {};
  },
}));

vi.mock("../../lib/sentry", () => ({
  reportError: h.reportError,
  setSentryUser: vi.fn(),
}));

vi.mock("./push", () => ({ registerPush: () => Promise.resolve() }));
vi.mock("firebase/functions", () => ({ getFunctions: vi.fn(), httpsCallable: vi.fn() }));

vi.mock("firebase/firestore", () => {
  const ref = (kind: string, path: string[]) => ({ __kind: kind, path: path.join("/") });
  const snapOf = (docs: FakeDoc[]) => ({
    size: docs.length,
    docs: docs.map((d) => ({
      id: d.id,
      data: () => ({ ...d.data }),
      get: (k: string) => d.data[k],
    })),
  });
  return {
    collection: (_db: unknown, ...path: string[]) => ref("collection", path),
    doc: (_db: unknown, ...path: string[]) => ref("doc", path),
    query: (src: { path?: string }, ...cons: Constraint[]) => ({
      __kind: "query",
      path: src?.path,
      cons,
    }),
    where: (field: string, op: string, value: unknown) => ({ kind: "where", field, op, value }),
    orderBy: () => ({ kind: "orderBy" }),
    limit: (n: number) => ({ kind: "limit", value: n }),
    startAfter: (cur: unknown) => ({ kind: "startAfter", value: cur }),
    documentId: () => ({ kind: "documentId" }),
    serverTimestamp: () => ({ __kind: "serverTimestamp" }),
    Timestamp: { fromMillis: (ms: number) => ({ ms, toMillis: () => ms }) },
    getDoc: (ref: { path?: string }) => {
      const rank = ref?.path?.match(/^v2_rank\/(\w+)$/);
      const order = rank ? h.rankOrders[rank[1]] : undefined;
      if (order) {
        return Promise.resolve({ exists: () => true, get: () => undefined, data: () => ({ ...order }) });
      }
      if (ref?.path === "v2_users/uid_test/taste/profile" && h.tasteProfile) {
        const p = h.tasteProfile;
        return Promise.resolve({ exists: () => true, get: () => undefined, data: () => ({ ...p }) });
      }
      return Promise.resolve({ exists: () => false, get: () => undefined, data: () => ({}) });
    },
    getDocs: (q: { path?: string; cons?: Constraint[] }) => {
      if (q?.path !== "v2_questions") return Promise.resolve(snapOf([]));
      const cons = q.cons || [];
      h.bankQueries.push({ path: q.path, cons });
      // The pager's fetch-by-id (D317): where(documentId(), "in", [...]).
      const byId = cons.find(
        (c) => c.kind === "where" && typeof c.field === "object"
          && (c.field as unknown as Constraint).kind === "documentId",
      );
      if (byId) {
        const ids = byId.value as string[];
        return Promise.resolve(snapOf(h.bankDocs.filter((d) => ids.includes(d.id))));
      }
      const lim = (cons.find((c) => c.kind === "limit")?.value as number) ?? Infinity;
      const delta = cons.find((c) => c.kind === "where" && c.field === "updatedAt");
      if (!delta) {
        // Real Firestore semantics for the full fetch: ordered by document
        // id, advanced past the cursor, capped at the limit, and — since
        // D318 splits the boot into two queries — FILTERED by the query's
        // own surface/core constraints. Without the filters the core-feed
        // query would hand back the whole bank and the tests could not
        // tell the two queries' results apart, which is the bug, not the
        // fix.
        const surfaceIn = cons.find((c) => c.kind === "where" && c.field === "surface" && c.op === "in");
        const surfaceEq = cons.find((c) => c.kind === "where" && c.field === "surface" && c.op === "==");
        const coreEq = cons.find((c) => c.kind === "where" && c.field === "core" && c.op === "==");
        let docs = [...h.bankDocs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        if (surfaceIn) docs = docs.filter((d) => (surfaceIn.value as string[]).includes(d.data.surface as string));
        if (surfaceEq) docs = docs.filter((d) => d.data.surface === surfaceEq.value);
        if (coreEq) docs = docs.filter((d) => d.data.core === coreEq.value);
        const after = cons.find((c) => c.kind === "startAfter")?.value as { id: string } | undefined;
        if (after && !h.stuckCursor) {
          docs = docs.slice(docs.findIndex((d) => d.id === after.id) + 1);
        }
        return Promise.resolve(snapOf(docs.slice(0, lim)));
      }
      if (h.deltaError) return Promise.reject(h.deltaError());
      const since = (delta.value as { ms: number }).ms;
      const at = (d: FakeDoc) => (d.data.updatedAt as { toMillis(): number }).toMillis();
      return Promise.resolve(snapOf(h.bankDocs.filter((d) => at(d) > since)));
    },
    onSnapshot: () => vi.fn(),
    setDoc: () => Promise.resolve(),
    // None of these four is exercised here; all four are required since D110,
    // because live.ts destructures its whole Firestore surface off one object
    // and a missing member throws at boot rather than at the unused call.
    updateDoc: () => Promise.resolve(),
    deleteDoc: () => Promise.resolve(),
    terminate: () => Promise.resolve(),
    clearIndexedDbPersistence: () => Promise.resolve(),
  };
});

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void { this.m.set(k, String(v)); }
  removeItem(k: string): void { this.m.delete(k); }
  clear(): void { this.m.clear(); }
  key(i: number): string | null { return [...this.m.keys()][i] ?? null; }
  get length(): number { return this.m.size; }
}

let storage: MemoryStorage;

const BANK_LS = "insight.bankCache.v2";

const q = (id: string, updatedAt: number, over: Record<string, unknown> = {}): FakeDoc => ({
  id,
  data: {
    surface: "daily",
    seq: Number(id.replace(/\D/g, "")) || 0,
    type: "vote",
    prompt: `Prompt ${id}`,
    options: ["A", "B"],
    topic: null,
    test: null,
    active: true,
    // A real Firestore Timestamp, near enough: live.ts reads the cursor
    // through toMillis(), and a plain number would silently read as 0.
    updatedAt: { toMillis: () => updatedAt },
    ...over,
  },
});

async function bootLive() {
  const mod = await import("./live");
  await mod.initLive(1);
  await vi.waitFor(() => { expect(mod.default.ready).toBe(true); });
  return mod.default;
}

// Through the module under test on purpose: bankStore IS the cache's
// public surface now, and a test that peeked at raw IDB rows would keep
// passing if live.ts stopped using the store. vi.resetModules hands back
// a fresh module instance, but the stubbed indexedDB global underneath is
// the same one, so reads and writes see the same database the boot did.
interface CachedBank {
  rev: number;
  cursor: number;
  questions: Array<{ id: string } & Record<string, unknown>>;
}
// Typed non-null because every caller asserts on the payload: a missing
// row surfaces as a failed expectation on the very next line, which is
// the failure a cache test wants to show anyway.
const readCache = async (): Promise<CachedBank> => {
  const { bankGet } = await import("./bankStore");
  return (await bankGet()) as CachedBank;
};
const writeCache = async (payload: unknown): Promise<void> => {
  const { bankPut } = await import("./bankStore");
  await bankPut(payload);
};
const bankFetches = () => h.bankQueries.length;
const isDelta = (i: number) =>
  (h.bankQueries[i]?.cons || []).some((c) => c.kind === "where" && c.field === "updatedAt");

beforeEach(() => {
  vi.resetModules();
  h.reportError.mockClear();
  h.bankQueries.length = 0;
  h.deltaError = null;
  h.stuckCursor = false;
  h.rankOrders = {};
  h.tasteProfile = null;
  h.bankDocs = [q("q_1", 1000), q("q_2", 1000)];
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
  // A brand-new IDB universe per test — no databases survive between
  // cases, same as the fresh MemoryStorage above.
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("window", {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal("document", {
    hidden: false, addEventListener: () => {}, removeEventListener: () => {},
  });
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubEnv("VITE_V2_LIVE", "true");
});

describe("question-bank cache", () => {
  it("fetches the whole bank on a cold boot and records the cursor", async () => {
    await bootLive();
    // Two since D318: the boot surfaces, then the feed's core.
    expect(bankFetches()).toBe(2);
    expect(isDelta(0)).toBe(false);
    const cached = await readCache();
    expect(cached.questions).toHaveLength(2);
    // The cursor is the newest updatedAt seen, so the next boot can ask
    // for "what changed since" instead of "everything".
    expect(cached.cursor).toBe(1000);
    // updatedAt is transport, not content: it must not survive into the
    // cached row, or the cache and network paths hand back different shapes.
    expect(cached.questions[0]).not.toHaveProperty("updatedAt");
  });

  it("asks only for the delta on a warm boot", async () => {
    await bootLive();
    const first = await readCache();
    vi.resetModules();
    h.bankQueries.length = 0;
    await writeCache(first);

    await bootLive();
    expect(bankFetches()).toBe(1);
    expect(isDelta(0)).toBe(true);
    // Nothing changed, so the delta is empty and the bank still stands.
    expect((await readCache())!.questions).toHaveLength(2);
  });

  it("pages a promoted question in without re-reading the bank", async () => {
    await bootLive();
    const first = await readCache();
    vi.resetModules();
    h.bankQueries.length = 0;
    await writeCache(first);
    // One week later: the farm promoted a question (D30).
    h.bankDocs = [...h.bankDocs, q("q_3", 9000)];

    const LIVE = await bootLive();
    expect(bankFetches()).toBe(1);
    expect(isDelta(0)).toBe(true);
    const cached = await readCache();
    expect(cached.questions.map((x: { id: string }) => x.id).sort()).toEqual(["q_1", "q_2", "q_3"]);
    expect(cached.cursor).toBe(9000);
    expect(LIVE.ready).toBe(true);
  });

  it("replaces an edited question rather than duplicating it", async () => {
    await bootLive();
    const first = await readCache();
    vi.resetModules();
    h.bankQueries.length = 0;
    await writeCache(first);
    h.bankDocs = [q("q_1", 5000, { prompt: "Reworded q_1" }), q("q_2", 1000)];

    await bootLive();
    const cached = await readCache();
    expect(cached.questions).toHaveLength(2);
    expect(cached.questions.find((x: { id: string }) => x.id === "q_1")!.prompt)
      .toBe("Reworded q_1");
  });

  it("rewinds the cursor so a same-instant batch commit is not stepped over", async () => {
    // A batch stamps every document in it with one server timestamp, so a
    // strict `>` against the highest cursor we hold can skip a document
    // committed in the same instant by a later batch. The delta query must
    // therefore ask from slightly BEFORE the cursor.
    await bootLive();
    const first = await readCache();
    vi.resetModules();
    h.bankQueries.length = 0;
    await writeCache(first);

    await bootLive();
    const where = (h.bankQueries[0].cons || []).find((c) => c.field === "updatedAt");
    expect((where?.value as { ms: number }).ms).toBeLessThan(first.cursor);
  });

  it("falls back to a full fetch when contentRev invalidates the cache", async () => {
    await bootLive();
    const first = await readCache();
    vi.resetModules();
    h.bankQueries.length = 0;
    // What an operator's `bumpRev` looks like from here: the cached rev no
    // longer matches, so the cursor is not trusted either.
    await writeCache({ ...first, rev: first.rev + 1 });

    await bootLive();
    // Both boot queries re-run — the cursor is not trusted either.
    expect(bankFetches()).toBe(2);
    expect(isDelta(0)).toBe(false);
  });

  it("keeps the session alive when the delta query fails", async () => {
    await bootLive();
    const first = await readCache();
    vi.resetModules();
    h.bankQueries.length = 0;
    await writeCache(first);
    h.deltaError = () => new Error("network");

    // One promotion behind is invisible; a dead boot is not. The cached
    // bank carries the session and the next boot retries.
    const LIVE = await bootLive();
    expect(LIVE.ready).toBe(true);
    expect(h.reportError).toHaveBeenCalled();
    expect((await readCache())!.questions).toHaveLength(2);
  });

  // ── pagination (D161) ──
  //
  // The bug these exist to prevent is the one the old `limit(1500)` had:
  // Firestore returns a short page and NO error when a query hits its
  // limit, so an over-sized bank served a truncated corpus with nothing
  // failing anywhere. Every assertion here is therefore on COMPLETENESS —
  // "all of them arrived" — because a partial result is what success used
  // to look like.
  //
  // BANK_PAGE is 1000 in live.ts. These tests know that number, which is
  // the one thing about them that can go stale; they fail loudly if it
  // moves, rather than silently testing a single page.
  const bulk = (n: number, from = 0) =>
    Array.from({ length: n }, (_, i) => q(`q_${String(from + i).padStart(6, "0")}`, 1000));

  it("pages a bank larger than one page, and every question arrives", async () => {
    h.bankDocs = bulk(2500);
    await bootLive();
    // 1000 + 1000 + 500 — the third page is short, which is what ends it
    // — plus the core-feed query's one empty page (D318).
    expect(bankFetches()).toBe(4);
    expect((await readCache())!.questions).toHaveLength(2500);
  });

  it("does not stop one page early when the bank is an exact multiple of the page", async () => {
    // The off-by-one that a count-based loop gets wrong: after two full
    // pages there is no way to know the bank is finished without asking
    // again. A loop that stopped here would drop everything after doc 2000
    // in the real world and look perfectly healthy doing it.
    h.bankDocs = bulk(2000);
    await bootLive();
    // Three pages for the boot surfaces plus the core-feed query (D318).
    expect(bankFetches()).toBe(4);
    expect(h.bankQueries[2].cons.some((c) => c.kind === "startAfter")).toBe(true);
    expect((await readCache())!.questions).toHaveLength(2000);
  });

  it("reports rather than truncates silently when the cursor stops advancing", async () => {
    // The one way an unbounded loop could hang the boot path. BANK_MAX_PAGES
    // stops it — and the stop is LOUD, because a quiet truncation is
    // precisely the failure paging was introduced to remove.
    h.bankDocs = bulk(1000);
    h.stuckCursor = true;
    const LIVE = await bootLive();
    expect(LIVE.ready).toBe(true);
    expect(h.reportError).toHaveBeenCalled();
    expect(String(h.reportError.mock.calls[0][0])).toMatch(/BANK_MAX_PAGES/);
  });

  it("ignores a v1 cache payload and re-reads once", async () => {
    storage.setItem(
      "insight.bankCache.v1",
      JSON.stringify({ rev: 0, questions: [q("q_9", 0).data] }),
    );
    await bootLive();
    expect(bankFetches()).toBe(2);
    expect(isDelta(0)).toBe(false);
    expect((await readCache())!.questions.map((x: { id: string }) => x.id)).toEqual(["q_1", "q_2"]);
  });

  // ── the localStorage era's payload migrates (D315) ────────────────
  //
  // A device updating across the store move holds a good cache in the
  // old box and nothing in the new one. The migration's promise is
  // threefold and each third has its own assertion: the old payload is
  // USED (the boot pays a delta, not a refetch), the small box is FREED
  // (the whole point of the move), and the new store holds the bank
  // afterwards (so the next boot never touches localStorage at all).
  it("migrates the v2 localStorage payload: delta fetch, key freed, store filled", async () => {
    await bootLive();
    const first = await readCache();
    vi.resetModules();
    h.bankQueries.length = 0;
    // The updating device: empty IDB universe, old cache still in the box.
    vi.stubGlobal("indexedDB", new IDBFactory());
    storage.setItem(BANK_LS, JSON.stringify(first));

    await bootLive();
    expect(bankFetches()).toBe(1);
    expect(isDelta(0)).toBe(true);
    expect(storage.getItem(BANK_LS)).toBeNull();
    expect((await readCache())!.questions).toHaveLength(2);
  });

  // ── every surface splitBanks can return has to reach it ──────────────
  //
  // BANK_SURFACES is the one place that decides what the bank IS, and it
  // is spelled twice — as the `in` constraint on the full fetch and as the
  // client-side filter the delta path shares. splitBanks returns six
  // lanes; the constant listed four of them plus the two duel surfaces,
  // and `pulse` and `call` were simply absent, so LIVE.pulseQs() and
  // LIVE.callQs() were empty for every live device while the demo build
  // drew both from its own fixtures.
  //
  // Asserted on the QUERY as well as the output, for the same reason the
  // delta cases are: a surface dropped by the server-side `in` and a
  // surface dropped by the client-side filter look identical from the
  // bank, and only one of them costs a read.
  it("fetches every boot surface, pulse and call included — and learn deliberately not", async () => {
    h.bankDocs = [
      q("q_1", 1000),
      q("pulse-pace", 1000, {
        surface: "pulse", type: "pulse",
        options: ["1", "2", "3", "4", "5"],
      }),
      q("call-c01", 1000, { surface: "call", type: "call" }),
    ];
    const LIVE = await bootLive();
    const asked = (h.bankQueries[0].cons.find((c) => c.field === "surface")?.value || []) as string[];
    for (const s of ["daily", "test", "group", "duo", "pulse", "call"]) {
      expect(asked, `the bank query does not ask for ${s}`).toContain(s);
    }
    // Learn and the feed PAGE against the published order since
    // D317/D318 — the boot `in` carrying either again would silently
    // re-inflate the install fetch the paging exists to remove. Learn's
    // reach guarantee moved to the pager cases below; the feed's CORE
    // rides the second query, asserted here on its constraints.
    expect(asked, "learn is back in the boot fetch").not.toContain("learn");
    expect(asked, "the feed is back in the boot `in` — core rides its own query").not.toContain("feed");
    const coreCons = h.bankQueries[1].cons.filter((c) => c.kind === "where");
    expect(coreCons).toEqual([
      { kind: "where", field: "surface", op: "==", value: "feed" },
      { kind: "where", field: "core", op: "==", value: true },
    ]);
    expect(LIVE.pulseQs().map((x) => x.id)).toEqual(["pulse-pace"]);
    expect(LIVE.callQs().map((x) => x.id)).toEqual(["call-c01"]);
  });

  // ── learn pages against the published order (D317) ─────────────────
  //
  // Learn's reach guarantee lives HERE now, not in the surface list: a
  // device meets learn cards through the pager — first page per followed
  // field of v2_rank/learn's order, minus what the cache already holds,
  // plus any card the device has history with. Asserted through the
  // engine-facing pool (learnCards) and the persisted cache, because
  // those are the two places a missing card actually hurts: a session
  // with nothing to serve, and a map that forgets a fact.
  const learnDoc = (id: string, field: string) =>
    q(id, 1000, {
      surface: "learn", type: "choice", topic: field,
      options: ["A", "B", "C", "D"], c: 0, t: 2, p: 60, k: `Fact ${id}`,
    });

  it("pages learn in from the published order, publishes the pool, persists the page", async () => {
    h.bankDocs = [
      q("q_1", 1000),
      learnDoc("learn-cell1", "cell"),
      learnDoc("learn-cell2", "cell"),
      learnDoc("learn-sol1", "solar"),
    ];
    h.rankOrders.learn = {
      topics: {
        cell: { qids: ["learn-cell2", "learn-cell1"], total: 9 },
        solar: { qids: ["learn-sol1"], total: 4 },
      },
    };
    await bootLive();
    const { learnCards, learnFieldTotal } = await import("./learnBank");
    await vi.waitFor(() => {
      expect(learnCards([]).map((c) => c.id).sort()).toEqual(["cell1", "cell2", "sol1"]);
    });
    // The sheet's denominator is the BANK's count off the order doc, not
    // the fetched page — the page-size lie is the D283 report again.
    expect(learnFieldTotal("cell")).toBe(2);
    // Persisted: the next boot serves these from the cache, no re-fetch.
    await vi.waitFor(async () => {
      expect((await readCache())!.questions.map((x) => x.id)).toContain("learn-cell1");
    });
  });

  it("heals an answered tail question back with no order published", async () => {
    // The feed's history is its answers: this device voted on a tail
    // question (the answers cache says so) and the bank cache lost the
    // doc. It must come back — served again AND persisted — without any
    // order doc, or the Mirror holds a vote it cannot name.
    storage.setItem("insight.answersCache.v1", JSON.stringify({
      uid: "uid_test", votes: { "feed-t9": "0" }, maxTs: 500, maxEditTs: 0,
    }));
    h.bankDocs = [
      q("q_1", 1000),
      q("feed-t9", 1000, { surface: "feed", topic: "food" }),
    ];
    await bootLive();
    await vi.waitFor(() => {
      const feed = (window as unknown as { WORLD_FEED_QS?: Array<{ id: string }> })
        .WORLD_FEED_QS || [];
      expect(feed.map((x) => x.id)).toContain("feed-t9");
    });
    expect((await readCache())!.questions.map((x) => x.id)).toContain("feed-t9");
  });

  it("pages an answered topic deeper than a cold one when the profile clears its floors", async () => {
    // D314 phase 1's whole serving effect, end to end: the device reads
    // ITS OWN profile — the one doc only its owner may read — and takes
    // the full page for the topic it answers, a smaller one for the
    // topic it never has. Both non-zero: a cold topic must stay
    // discoverable or the profile could never change.
    const tailDoc = (id: string, topic: string) =>
      q(id, 1000, { surface: "feed", topic });
    h.bankDocs = [
      q("q_1", 1000),
      ...Array.from({ length: 14 }, (_, i) => tailDoc(`feed-hot${String(i).padStart(2, "0")}`, "food")),
      ...Array.from({ length: 14 }, (_, i) => tailDoc(`feed-cold${String(i).padStart(2, "0")}`, "music")),
    ];
    h.rankOrders.feed = {
      topics: {
        food: { qids: h.bankDocs.filter((d) => d.id.startsWith("feed-hot")).map((d) => d.id), total: 14 },
        music: { qids: h.bankDocs.filter((d) => d.id.startsWith("feed-cold")).map((d) => d.id), total: 14 },
      },
    };
    h.tasteProfile = { t: { food: 12 }, n: 12 };
    await bootLive();
    await vi.waitFor(async () => {
      const cachedIds = (await readCache())!.questions.map((x) => x.id);
      expect(cachedIds.filter((id) => id.startsWith("feed-hot"))).toHaveLength(12);
    });
    const cachedIds = (await readCache())!.questions.map((x) => x.id);
    const cold = cachedIds.filter((id) => id.startsWith("feed-cold")).length;
    expect(cold).toBeGreaterThan(0);
    expect(cold).toBeLessThan(12);
  });

  it("heals a history card back into the pool even with no order published", async () => {
    // The mastery map says this device knows cell9; the cache lost it (a
    // contentRev bump refetches only the boot surfaces). No order doc —
    // the heal is by id and must not wait for a fold that may never have
    // run on a small project.
    storage.setItem("insight.learn.v3", JSON.stringify({
      c: { cell9: { s: "known", k: 3, seen: 1, miss: 0, pos: 0, at: 1 } },
      lvl: {}, pos: 1, order: ["cell9"],
    }));
    h.bankDocs = [q("q_1", 1000), learnDoc("learn-cell9", "cell")];
    await bootLive();
    const { learnCards } = await import("./learnBank");
    await vi.waitFor(() => {
      expect(learnCards([]).map((c) => c.id)).toContain("cell9");
    });
  });

  // ── the current-events serving window (D231) ─────────────────────
  //
  // `fresh()` is the whole promise of the `now` lane — "the lane's
  // promise is that it stops being asked", as check:quality puts it —
  // and until this case nothing executed it. Every other part of the
  // lane was pinned (the window bounds in question-quality.test.mjs, the
  // ring's arithmetic in askWindow.test.ts, the day-key shape in
  // check-content), and the one line that actually retires a card was
  // covered by none of them. Owner-reported on 2026-08-24 as a question
  // he could not tell would ever stop being shown, which is the honest
  // reading of a mechanism with no test: from the outside, "it works"
  // and "nobody checked" look the same.
  //
  // Asserted on the BANK rather than on a rendered card: the filter runs
  // in hydrate, before anything builds a card, so this is the layer
  // where the answer is either right or wrong for every surface at once.
  const dayKey = (n: number) =>
    new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

  it("stops serving a now question the day after its window closes", async () => {
    // `now` questions are TAIL by design (sold-inventory reasoning in
    // QUESTION-FARM; the corpus wants density, not current events), so
    // since D318 they reach a device through the pager — this case now
    // runs the window rule at PAGE ARRIVAL, which is where it lives for
    // everything the boot fetch no longer carries. The feed pool needs
    // one core question for buildFeedGlobals to build at all.
    const nowQ = (id: string, from: string, until: string) =>
      q(id, 1000, { surface: "feed", topic: "now", from, until });
    h.bankDocs = [
      q("q_1", 1000),
      q("feed-core1", 1000, { surface: "feed", topic: "food", core: true }),
      nowQ("n_open", dayKey(-2), dayKey(2)),
      // Both boundaries are INCLUSIVE, and both are the off-by-one worth
      // pinning: a window closing today still serves today, and one that
      // closed yesterday is gone.
      nowQ("n_closes_today", dayKey(-4), dayKey(0)),
      nowQ("n_closed", dayKey(-5), dayKey(-1)),
      // The other end: written ahead of time, not yet servable. This is
      // the half `from` exists for — an editor writing next week's card
      // this week rather than having to be awake on the day.
      nowQ("n_future", dayKey(1), dayKey(5)),
    ];
    h.rankOrders.feed = {
      // The nightly fold would exclude the closed and the future; the
      // hand-built order lists all four so the CLIENT's arrival filter
      // is what these assertions exercise — the fold's own exclusion is
      // rank.test.ts's, and a card can close between fold and fetch.
      topics: { now: { qids: ["n_open", "n_closes_today", "n_closed", "n_future"], total: 4 } },
    };
    const LIVE = await bootLive();
    await vi.waitFor(() => {
      const feed = (window as unknown as { WORLD_FEED_QS?: Array<{ id: string }> })
        .WORLD_FEED_QS || [];
      expect(feed.map((x) => x.id), "an open window stopped serving").toContain("n_open");
    });
    const feed = (window as unknown as { WORLD_FEED_QS?: Array<{ id: string }> })
      .WORLD_FEED_QS || [];
    const ids = feed.map((x) => x.id);
    expect(ids, "a window closing today must still serve today").toContain("n_closes_today");
    expect(ids, "a closed question is still being offered — the lane's whole promise").not.toContain("n_closed");
    expect(ids, "a question whose window has not opened is being offered early").not.toContain("n_future");
    // The archive is the product: the filter is a SERVING rule, so the
    // expired doc is still in the cache and its answers and aggregate are
    // untouched. `active: false` remains the hard kill.
    expect((await readCache())!.questions.map((x: { id: string }) => x.id)).toContain("n_closed");
    expect(LIVE.ready).toBe(true);
  });
});

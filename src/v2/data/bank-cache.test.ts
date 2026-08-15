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

vi.mock("./push", () => ({ registerPushForReveals: () => Promise.resolve() }));
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
    getDoc: () =>
      Promise.resolve({ exists: () => false, get: () => undefined, data: () => ({}) }),
    getDocs: (q: { path?: string; cons?: Constraint[] }) => {
      if (q?.path !== "v2_questions") return Promise.resolve(snapOf([]));
      const cons = q.cons || [];
      h.bankQueries.push({ path: q.path, cons });
      const lim = (cons.find((c) => c.kind === "limit")?.value as number) ?? Infinity;
      const delta = cons.find((c) => c.kind === "where" && c.field === "updatedAt");
      if (!delta) {
        // Real Firestore semantics for the full fetch: ordered by document
        // id, advanced past the cursor, capped at the limit. Without all
        // three the paging test would pass against a mock that hands back
        // everything in one go — which is the bug, not the fix.
        let docs = [...h.bankDocs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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

const readCache = () => JSON.parse(storage.getItem(BANK_LS) || "null");
const bankFetches = () => h.bankQueries.length;
const isDelta = (i: number) =>
  (h.bankQueries[i]?.cons || []).some((c) => c.kind === "where" && c.field === "updatedAt");

beforeEach(() => {
  vi.resetModules();
  h.reportError.mockClear();
  h.bankQueries.length = 0;
  h.deltaError = null;
  h.stuckCursor = false;
  h.bankDocs = [q("q_1", 1000), q("q_2", 1000)];
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
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
    expect(bankFetches()).toBe(1);
    expect(isDelta(0)).toBe(false);
    const cached = readCache();
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
    const first = readCache();
    vi.resetModules();
    h.bankQueries.length = 0;
    storage.setItem(BANK_LS, JSON.stringify(first));

    await bootLive();
    expect(bankFetches()).toBe(1);
    expect(isDelta(0)).toBe(true);
    // Nothing changed, so the delta is empty and the bank still stands.
    expect(readCache().questions).toHaveLength(2);
  });

  it("pages a promoted question in without re-reading the bank", async () => {
    await bootLive();
    const first = readCache();
    vi.resetModules();
    h.bankQueries.length = 0;
    storage.setItem(BANK_LS, JSON.stringify(first));
    // One week later: the farm promoted a question (D30).
    h.bankDocs = [...h.bankDocs, q("q_3", 9000)];

    const LIVE = await bootLive();
    expect(bankFetches()).toBe(1);
    expect(isDelta(0)).toBe(true);
    const cached = readCache();
    expect(cached.questions.map((x: { id: string }) => x.id).sort()).toEqual(["q_1", "q_2", "q_3"]);
    expect(cached.cursor).toBe(9000);
    expect(LIVE.ready).toBe(true);
  });

  it("replaces an edited question rather than duplicating it", async () => {
    await bootLive();
    const first = readCache();
    vi.resetModules();
    h.bankQueries.length = 0;
    storage.setItem(BANK_LS, JSON.stringify(first));
    h.bankDocs = [q("q_1", 5000, { prompt: "Reworded q_1" }), q("q_2", 1000)];

    await bootLive();
    const cached = readCache();
    expect(cached.questions).toHaveLength(2);
    expect(cached.questions.find((x: { id: string }) => x.id === "q_1").prompt)
      .toBe("Reworded q_1");
  });

  it("rewinds the cursor so a same-instant batch commit is not stepped over", async () => {
    // A batch stamps every document in it with one server timestamp, so a
    // strict `>` against the highest cursor we hold can skip a document
    // committed in the same instant by a later batch. The delta query must
    // therefore ask from slightly BEFORE the cursor.
    await bootLive();
    const first = readCache();
    vi.resetModules();
    h.bankQueries.length = 0;
    storage.setItem(BANK_LS, JSON.stringify(first));

    await bootLive();
    const where = (h.bankQueries[0].cons || []).find((c) => c.field === "updatedAt");
    expect((where?.value as { ms: number }).ms).toBeLessThan(first.cursor);
  });

  it("falls back to a full fetch when contentRev invalidates the cache", async () => {
    await bootLive();
    const first = readCache();
    vi.resetModules();
    h.bankQueries.length = 0;
    // What an operator's `bumpRev` looks like from here: the cached rev no
    // longer matches, so the cursor is not trusted either.
    storage.setItem(BANK_LS, JSON.stringify({ ...first, rev: first.rev + 1 }));

    await bootLive();
    expect(bankFetches()).toBe(1);
    expect(isDelta(0)).toBe(false);
  });

  it("keeps the session alive when the delta query fails", async () => {
    await bootLive();
    const first = readCache();
    vi.resetModules();
    h.bankQueries.length = 0;
    storage.setItem(BANK_LS, JSON.stringify(first));
    h.deltaError = () => new Error("network");

    // One promotion behind is invisible; a dead boot is not. The cached
    // bank carries the session and the next boot retries.
    const LIVE = await bootLive();
    expect(LIVE.ready).toBe(true);
    expect(h.reportError).toHaveBeenCalled();
    expect(readCache().questions).toHaveLength(2);
  });

  // ── pagination (D153) ──
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
    // 1000 + 1000 + 500: the third page is short, which is what ends it.
    expect(bankFetches()).toBe(3);
    expect(readCache().questions).toHaveLength(2500);
  });

  it("does not stop one page early when the bank is an exact multiple of the page", async () => {
    // The off-by-one that a count-based loop gets wrong: after two full
    // pages there is no way to know the bank is finished without asking
    // again. A loop that stopped here would drop everything after doc 2000
    // in the real world and look perfectly healthy doing it.
    h.bankDocs = bulk(2000);
    await bootLive();
    expect(bankFetches()).toBe(3);
    expect(h.bankQueries[2].cons.some((c) => c.kind === "startAfter")).toBe(true);
    expect(readCache().questions).toHaveLength(2000);
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
    expect(bankFetches()).toBe(1);
    expect(isDelta(0)).toBe(false);
    expect(readCache().questions.map((x: { id: string }) => x.id)).toEqual(["q_1", "q_2"]);
  });
});

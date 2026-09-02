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

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
// The bank cache lives in IndexedDB since D312 (docs/ANSWER-SCALE.md
// §2.2) — rows per question plus a meta row carrying {rev, cursor}. The
// factory is a suite variable so a mid-test resetModules simulates "next
// boot, same device": the module state resets, the disk does not.
import { IDBFactory } from "fake-indexeddb";

interface FakeDoc {
  id: string;
  data: Record<string, unknown>;
}
interface Constraint {
  kind: string;
  field?: unknown;
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
  // The published serving orders (D319) the pagers read, keyed by
  // surface. Empty = no fold has run, which is every pre-D319 test's
  // world.
  rankOrders: {} as Record<string, { topics: Record<string, { qids: string[]; total: number }> }>,
  // The owner's interest profile (D322), served at their own taste path.
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
    orderBy: (field: unknown) => ({ kind: "orderBy", field }),
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
      // Firestore's ordering rule, enforced because the fake is the only
      // Firestore these tests ever see. If a query names an inequality AND
      // states an explicit ordering, the FIRST ordering must be the field
      // it ranges over — an implicit one (no orderBy at all, as the delta
      // query does) is fine, a `__name__`-first one is not. The real
      // backend rejects the violation at getDocs with this exact message,
      // which means a fake that shrugs lets a query ship that throws on
      // every device and is caught by nothing: the boot's paged fetch is
      // outside every try in hydrate(), so the throw strands the app on
      // "loading questions" for good. That shipped.
      const ineq = cons.find(
        (c) => c.kind === "where" && typeof c.field === "string"
          && [">", ">=", "<", "<="].includes(c.op as string),
      );
      const firstOrder = cons.find((c) => c.kind === "orderBy");
      if (ineq && firstOrder && firstOrder.field !== ineq.field) {
        return Promise.reject(Object.assign(
          new Error("order by clause cannot contain more fields after the key"),
          { code: "invalid-argument" },
        ));
      }
      // The pagers' fetch-by-id (D320/D321): where(documentId(), "in", ids).
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
        // D321 splits the boot into two queries — FILTERED by the query's
        // own surface/core constraints. Without the filters the core-feed
        // query would hand back the whole bank and the tests could not
        // tell the two queries' results apart, which is the bug, not the
        // fix.
        const surfaceIn = cons.find((c) => c.kind === "where" && c.field === "surface" && c.op === "in");
        const surfaceEq = cons.find((c) => c.kind === "where" && c.field === "surface" && c.op === "==");
        const coreEq = cons.find((c) => c.kind === "where" && c.field === "core" && c.op === "==");
        // …and the THIRD boot query's pair (D313's bought reach): `paid ==
        // true` with the window still open. Both are applied here for the
        // reason the paragraph above gives — a fake that ignores a
        // constraint hands the query the whole bank, and the test then
        // passes on a query that in production returns nothing.
        const paidEq = cons.find((c) => c.kind === "where" && c.field === "paid" && c.op === "==");
        const untilGte = cons.find((c) => c.kind === "where" && c.field === "until" && c.op === ">=");
        let docs = [...h.bankDocs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        if (surfaceIn) docs = docs.filter((d) => (surfaceIn.value as string[]).includes(d.data.surface as string));
        if (surfaceEq) docs = docs.filter((d) => d.data.surface === surfaceEq.value);
        if (coreEq) docs = docs.filter((d) => d.data.core === coreEq.value);
        if (paidEq) docs = docs.filter((d) => d.data.paid === paidEq.value);
        // Firestore drops a document that does not carry the field an
        // inequality names — which is what keeps the seeded bank out of
        // this query, so the fake has to do it too.
        if (untilGte) {
          docs = docs.filter((d) => typeof d.data.until === "string"
            && (d.data.until as string) >= (untilGte.value as string));
        }
        const after = cons.find((c) => c.kind === "startAfter")?.value as { id: string } | undefined;
        if (after && !h.stuckCursor) {
          docs = docs.slice(docs.findIndex((d) => d.id === after.id) + 1);
        }
        return Promise.resolve(snapOf(docs.slice(0, lim)));
      }
      if (h.deltaError) return Promise.reject(h.deltaError());
      const since = (delta.value as { ms: number }).ms;
      const at = (d: FakeDoc) => (d.data.updatedAt as { toMillis(): number }).toMillis();
      // ORDERED and LIMITED, the way Firestore serves it. A query with an
      // inequality and no explicit ordering is implicitly ordered by the
      // inequality's own field, ascending — so a capped delta returns the
      // OLDEST page past the cursor, not an arbitrary one. The fake used
      // to hand back every match: that makes the overflow branch reachable
      // (which is how the loop below was found) but makes the cursor the
      // caller derives from the page meaningless, and the cursor is the
      // whole subject of that branch.
      return Promise.resolve(snapOf(
        h.bankDocs
          .filter((d) => at(d) > since)
          .sort((a, b) => at(a) - at(b))
          .slice(0, lim),
      ));
    },
    onSnapshot: () => vi.fn(),
    setDoc: () => Promise.resolve(),
    // None of these four is exercised here; all four are required since D110,
    // because live.ts destructures its whole Firestore surface off one object
    // and a missing member throws at boot rather than at the unused call.
    updateDoc: () => Promise.resolve(),
    deleteDoc: () => Promise.resolve(),
    // D331: setPoliticalConsent removes the published compass with the
    // consent record, in one merge — a sentinel here, asserted in
    // political-consent.test.ts rather than in these boot fixtures.
    deleteField: () => "__delete__",
    terminate: () => Promise.resolve(),
    clearIndexedDbPersistence: () => Promise.resolve(),
    // D353: the queue-drained signal settlePending awaits — required
    // here like every other member live.ts binds, whether or not a case
    // reaches it (vitest throws on a member the factory does not define).
    waitForPendingWrites: () => Promise.resolve(),
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
let idb: IDBFactory;

const BANK_LS = "insight.bankCache.v2";

// Read and seed the IndexedDB cache in the old blob's vocabulary
// ({rev, cursor, questions}) so the assertions keep their shape while the
// storage is rows + meta. Rows come back sorted by id for determinism —
// the store's own key order.
const readCache = async () => {
  const cs = await import("./cacheStore");
  const meta = await cs.readMeta<{ rev: number; cursor: number }>("bank");
  const rows = await cs.readAll<Record<string, unknown> & { id: string }>("bank");
  return { rev: meta?.rev ?? 0, cursor: meta?.cursor ?? 0, questions: [...rows.values()] };
};
const seedCache = async (payload: {
  rev: number; cursor: number; questions: Array<{ id: string }>;
}) => {
  const cs = await import("./cacheStore");
  await cs.write("bank", payload.questions.map((q) => [q.id, q]), {
    meta: [["bank", { rev: payload.rev, cursor: payload.cursor }]],
    clearFirst: true,
  });
};

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
  // 5 s, not the 1 s default: the stuck-cursor case below writes 100
  // duplicate pages (100k rows) through the cache store, and
  // fake-indexeddb structured-clones every one of them.
  //
  // `attached`, not `ready` (D352): every case below asserts on what the
  // NETWORK phase did — which queries went out, what the cache holds after
  // — and a device with a seeded cache is `ready` off disk before the
  // first of those queries is issued.
  await vi.waitFor(() => { expect(mod.default.attached).toBe(true); }, { timeout: 5000 });
  return mod.default;
}

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
  idb = new IDBFactory();
  vi.stubGlobal("indexedDB", idb);
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("question-bank cache", () => {
  it("fetches the whole bank on a cold boot and records the cursor", async () => {
    await bootLive();
    // Three: the boot surfaces, the feed's core (D321), and the bought
    // questions no published order can carry (D313).
    expect(bankFetches()).toBe(3);
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
    vi.resetModules();
    h.bankQueries.length = 0;

    await bootLive();
    expect(bankFetches()).toBe(1);
    expect(isDelta(0)).toBe(true);
    // Nothing changed, so the delta is empty and the bank still stands.
    expect((await readCache()).questions).toHaveLength(2);
  });

  it("pages a promoted question in without re-reading the bank", async () => {
    await bootLive();
    vi.resetModules();
    h.bankQueries.length = 0;
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
    vi.resetModules();
    h.bankQueries.length = 0;
    h.bankDocs = [q("q_1", 5000, { prompt: "Reworded q_1" }), q("q_2", 1000)];

    await bootLive();
    const cached = await readCache();
    expect(cached.questions).toHaveLength(2);
    expect(cached.questions.find((x: { id: string }) => x.id === "q_1")?.prompt)
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
    await seedCache({ ...first, rev: first.rev + 1 });

    await bootLive();
    // All three boot queries re-run — the cursor is not trusted either.
    expect(bankFetches()).toBe(3);
    expect(isDelta(0)).toBe(false);
  });

  it("keeps the session alive when the delta query fails", async () => {
    await bootLive();
    vi.resetModules();
    h.bankQueries.length = 0;
    h.deltaError = () => new Error("network");

    // One promotion behind is invisible; a dead boot is not. The cached
    // bank carries the session and the next boot retries.
    const LIVE = await bootLive();
    expect(LIVE.ready).toBe(true);
    expect(h.reportError).toHaveBeenCalled();
    expect((await readCache()).questions).toHaveLength(2);
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
    // 1000 + 1000 + 500: the third page is short, which is what ends it.
    // Plus one empty page each for the core-feed and bought-question
    // queries.
    expect(bankFetches()).toBe(5);
    expect((await readCache()).questions).toHaveLength(2500);
  });

  it("never settles into re-fetching the whole bank on every boot", async () => {
    // THE LOOP. The full fetch takes its cursor from the three BOOT
    // queries — boot surfaces, core feed, bought — so a `learn` or tail
    // `feed` document's updatedAt never reaches it. Let a page's worth of
    // those be newer than everything the boot queries can see, and the
    // next boot's delta fills its page, is correctly refused as "not a
    // delta", falls through to a full fetch… which sets the cursor right
    // back to the boot-only maximum. Every boot after that re-reads the
    // entire bank, forever, and nothing ever says so — the bank is served
    // correctly the whole time, just at full price.
    h.bankDocs = [
      q("q_1", 1000),
      q("q_2", 1000),
      // `learn` is not a boot surface and a non-core feed row is not in
      // the core query, so neither is visible to the fetch that sets the
      // cursor.
      // A page's worth of paged rows (BANK_PAGE is 1000 in live.ts — the
      // sibling block below keeps that same literal), all newer, spread
      // over ~10s the way a reseed writes them. The spread matters: the
      // delta deliberately rewinds 5s off the cursor to catch a
      // same-instant batch, so a page of documents sharing ONE timestamp
      // is re-read forever by construction and would prove nothing about
      // the cursor.
      ...Array.from({ length: 1000 }, (_, i) =>
        q(`learn_${String(i).padStart(6, "0")}`, 9000 + i * 10, { surface: "learn", core: false })),
    ];
    await bootLive();
    const first = (await readCache()).cursor;

    vi.resetModules();
    h.bankQueries.length = 0;
    await bootLive();
    const second = (await readCache()).cursor;

    // The cursor must MOVE. If it comes back the same, the next boot
    // repeats this boot exactly.
    expect(second, "the cursor did not advance past the paged rows — every "
      + "boot from here re-reads the whole bank").toBeGreaterThan(first);

    // …and the boot after that is a delta again, not a third full fetch.
    vi.resetModules();
    h.bankQueries.length = 0;
    await bootLive();
    expect(isDelta(0), "still full-fetching on the third boot").toBe(true);
    expect(bankFetches()).toBe(1);
  });

  it("does not stop one page early when the bank is an exact multiple of the page", async () => {
    // The off-by-one that a count-based loop gets wrong: after two full
    // pages there is no way to know the bank is finished without asking
    // again. A loop that stopped here would drop everything after doc 2000
    // in the real world and look perfectly healthy doing it.
    h.bankDocs = bulk(2000);
    await bootLive();
    // Three pages for the boot surfaces, plus one each for the core-feed
    // (D321) and bought-question (D313) queries. Counted rather than
    // indexed: since D352 the three cold queries go out together, so the
    // boot's second page is issued AFTER the core and paid queries' first
    // pages, and its position in the log depends on that interleaving.
    // What the off-by-one would change is the NUMBER of cursor-carrying
    // pages, and that is what is pinned.
    expect(bankFetches()).toBe(5);
    const paged = h.bankQueries.filter((q) => q.cons.some((c) => c.kind === "startAfter"));
    expect(paged).toHaveLength(2);
    expect(paged.every((q) => q.cons.some((c) => c.kind === "where" && c.field === "surface" && c.op === "in"))).toBe(true);
    expect((await readCache()).questions).toHaveLength(2000);
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
    // The three boot queries (D321's core split, D313's bought reach).
    expect(bankFetches()).toBe(3);
    expect(isDelta(0)).toBe(false);
    expect((await readCache()).questions.map((x: { id: string }) => x.id)).toEqual(["q_1", "q_2"]);
  });

  // ── the localStorage → IndexedDB migration (D312) ─────────────────
  //
  // An upgrading device holds the blob and no rows. The blob must be
  // USED (a warm delta boot, not a cold refetch — the whole point of the
  // migration path is that the upgrade costs nothing), the rows must land
  // in IndexedDB, and the blob must be gone — removed AFTER the write
  // commits, so a device killed mid-upgrade still holds one complete
  // copy. The next boot is then an ordinary IndexedDB warm boot.
  it("migrates a legacy localStorage cache into IndexedDB and retires the key", async () => {
    await bootLive();
    const first = await readCache();
    // Rewind the device to the localStorage era: blob present, rows absent.
    vi.resetModules();
    h.bankQueries.length = 0;
    idb = new IDBFactory();
    vi.stubGlobal("indexedDB", idb);
    storage.setItem(BANK_LS, JSON.stringify(first));

    await bootLive();
    expect(bankFetches()).toBe(1);
    expect(isDelta(0), "a legacy cache must warm-boot, not refetch").toBe(true);
    expect((await readCache()).questions).toHaveLength(2);
    expect(storage.getItem(BANK_LS), "the blob outlived its migration").toBeNull();

    // …and the boot after that reads IndexedDB alone, still as a delta.
    vi.resetModules();
    h.bankQueries.length = 0;
    await bootLive();
    expect(bankFetches()).toBe(1);
    expect(isDelta(0)).toBe(true);
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
  it("fetches every boot surface, pulse and call included — and the paged two deliberately not", async () => {
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
    // D320/D321 — the boot `in` carrying either again would silently
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

  // ── bought reach has to reach somebody (D313 against D316/D321) ────
  //
  // A bought question is written into `v2_questions` by the paying
  // webhook, at runtime. The boot fetch above asks for the boot surfaces
  // and for `feed && core`; the rest of the feed pages behind the order
  // `rankBankV2` publishes — and that order is built from the COMPILED
  // bank, which a runtime document can never be in. Both halves landed on
  // the same day in that sequence, and between them a paid question was
  // in no query and no order: the buyer paid, the question reached zero
  // devices, and the closer refunded the cap 29 days later.
  //
  // Asserted on the QUERY as well as the bank, for the reason the surface
  // case gives: a document the server never returned and one the client
  // filtered away look identical from the bank, and only one of them is a
  // read nobody paid for.
  it("fetches a bought question, which is neither a boot surface nor core", async () => {
    h.bankDocs = [
      q("q_1", 1000),
      q("paidq-b1", 1000, {
        surface: "feed", topic: "culture",
        paid: true, from: dayKey(-1), until: dayKey(27),
      }),
      // The tail it must not drag in with it: a feed question that is
      // neither core nor paid still pages behind the order.
      q("feed-t9", 1000, { surface: "feed", topic: "culture" }),
    ];
    const LIVE = await bootLive();
    const paidCons = h.bankQueries[2].cons.filter((c) => c.kind === "where");
    expect(paidCons.map((c) => [c.field, c.op])).toEqual([["paid", "=="], ["until", ">="]]);
    expect(
      paidCons.find((c) => c.field === "paid")!.value,
      "the third boot query does not ask for bought questions",
    ).toBe(true);
    void LIVE;
    const ids = (await readCache()).questions.map((x: { id: string }) => x.id);
    expect(ids, "a paid question reached no device — the buyer paid for nothing").toContain("paidq-b1");
    expect(ids, "the paged tail came in with it, un-paging the feed").not.toContain("feed-t9");
  });

  it("keeps a bought question that arrives in the DELTA", async () => {
    // Mid-session is the ordinary case: a campaign goes live when its
    // payment clears, not when a device happens to boot. The delta drops
    // an unheld non-core feed row on purpose (that is the pager's
    // decision), so without its own clause the question waits for the
    // next cold boot — or, if the device never rewrites its cache, longer.
    h.bankDocs = [q("q_1", 1000)];
    await bootLive();
    vi.resetModules();
    h.bankQueries.length = 0;
    h.bankDocs = [...h.bankDocs, q("paidq-b2", 9000, {
      surface: "feed", topic: "culture",
      paid: true, from: dayKey(-1), until: dayKey(27),
    })];
    await bootLive();
    // The delta, not a re-fetch: this is the cheap path, and the clause
    // has to live in its keep-filter rather than being covered by a full
    // read the next boot might not do.
    expect(isDelta(0), "the boot re-fetched instead of taking the delta").toBe(true);
    expect(
      (await readCache()).questions.map((x: { id: string }) => x.id),
      "a campaign that went live mid-session never reached the device",
    ).toContain("paidq-b2");
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
    // since D321 they reach a device through the pager — this case runs
    // the window rule at PAGE ARRIVAL, which is where it lives for
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
    expect((await readCache()).questions.map((x: { id: string }) => x.id)).toContain("n_closed");
    expect(LIVE.ready).toBe(true);
  });

  // ── the paged surfaces (D320 learn, D321 feed tail, D322 profile) ──
  //
  // Reach guarantees live HERE now, not in the surface list: a device
  // meets paged cards through the pager — first page per field/topic of
  // the published order, minus what the cache holds, plus everything the
  // device has history with. Asserted through the engine-facing pool and
  // the persisted cache, because those are the two places a missing card
  // actually hurts: a session with nothing to serve, and a map or a
  // Mirror that forgets.
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
      expect((await readCache()).questions.map((x) => x.id)).toContain("learn-cell1");
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
    expect((await readCache()).questions.map((x) => x.id)).toContain("feed-t9");
  });

  it("heals an answered CATALOGUE PICK back — the feed's other id lane", async () => {
    // The lane list is pinned against the generator in
    // scripts/feed-lanes.test.mjs, and that is the half that catches a
    // NEW lane. This is the half that catches the CALLER: the heal
    // filtered the answered set on `startsWith("feed-")`, which is the
    // feed's own lane and not the surface, so all 24 catalogue picks were
    // excluded. Reverting `isFeedQid` back to that prefix left every test
    // green, because the two heal cases either side of this one use a
    // `feed-` id and a `learn-` id and no test used a `pick-` one.
    storage.setItem("insight.answersCache.v1", JSON.stringify({
      uid: "uid_test", votes: { "pick-pk04": "0" }, maxTs: 500, maxEditTs: 0,
    }));
    h.bankDocs = [
      q("q_1", 1000),
      q("pick-pk04", 1000, { surface: "feed", topic: "culture" }),
    ];
    await bootLive();
    await vi.waitFor(() => {
      const feed = (window as unknown as { WORLD_FEED_QS?: Array<{ id: string }> })
        .WORLD_FEED_QS || [];
      expect(
        feed.map((x) => x.id),
        "a catalogue pick you answered never came back — it shares the feed "
        + "surface but not the feed's id prefix",
      ).toContain("pick-pk04");
    });
    expect((await readCache()).questions.map((x) => x.id)).toContain("pick-pk04");
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

  it("pages an answered topic deeper than a cold one when the profile clears its floors", async () => {
    // D317 phase 1's whole serving effect, end to end: the device reads
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
      const cachedIds = (await readCache()).questions.map((x) => x.id);
      expect(cachedIds.filter((id) => id.startsWith("feed-hot"))).toHaveLength(12);
    });
    const cachedIds = (await readCache()).questions.map((x) => x.id);
    const cold = cachedIds.filter((id) => id.startsWith("feed-cold")).length;
    expect(cold).toBeGreaterThan(0);
    expect(cold).toBeLessThan(12);
  });
});

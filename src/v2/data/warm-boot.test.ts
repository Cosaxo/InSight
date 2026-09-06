// The warm paint (D356): a returning device draws its real deck off its
// own caches before the first network read is answered, and the network
// phase reconciles behind the screen.
//
// Why this file exists. `initLive` releases the render when its race
// settles, and until D356 the only runners were the whole network boot
// and a 2.5 s deadline — so a returning device with the bank, its
// answers, its aggregates and (now) its own profile all on disk still
// waited on five or six serial round trips, and on a phone it lost the
// race often enough to earn an engagement counter (`slowBoots`) and a
// "still connecting" label. Every property below is one the network
// mock can lie about in a way no gate would see: the race is timing, and
// the fixtures elsewhere answer every read in a microtask.
//
// So the network here is GATED. Every `getDoc`/`getDocs` parks its answer
// in `h.pending` until the test releases it, which makes "the render was
// released while the server had answered nothing" a plain assertion
// rather than a timing claim — `initLive` either resolves with the gate
// closed or it does not. The same gate pins the round-trip shape the
// network phase now has (the three cold bank queries in one trip, the
// two answer deltas and the deck aggregates in one trip), because a
// serial chain and a parallel one issue the same queries in the same
// order and differ only in what is pending at once.
//
// Same harness shape as bank-cache.test.ts: live.ts holds module-level
// state, so every test rebuilds it (vi.resetModules + dynamic import)
// against hoisted mocks; the disk is fake-indexeddb plus an in-memory
// localStorage, and both survive a resetModules on purpose — that is
// what "the next boot on the same device" means.

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";

interface Constraint {
  kind: string;
  field?: unknown;
  op?: string;
  value?: unknown;
}
interface FakeDoc {
  id: string;
  data: Record<string, unknown>;
  pending?: boolean;
}
interface Call {
  path: string;
  cons: Constraint[];
}
interface Pending extends Call {
  release: () => void;
  fail: (err: Error) => void;
}

const h = vi.hoisted(() => ({
  reportError: vi.fn(),
  // The gate. Closed: every read parks in `pending` until released.
  gated: false,
  pending: [] as Pending[],
  // Every read issued, in order, gated or not.
  calls: [] as Call[],
  // The server's side of the world.
  contentRev: 1000,
  bankDocs: [] as FakeDoc[],
  answerDocs: [] as FakeDoc[],
  aggDocs: [] as FakeDoc[],
  profile: null as null | Record<string, unknown>,
  // Which uid the sign-in mock hands back.
  uid: "uid_test",
  // Captured window listeners, by event — and DISPATCHED, unlike the
  // sibling harnesses' stubs: purgeLocalTrace's `insight:local-purge`
  // has to reach cacheStore's listener here, because what the account
  // switch leaves on disk is one of the things these cases are about.
  listeners: {} as Record<string, Array<(ev?: unknown) => void>>,
  // The auth observer's callback, so a test can switch accounts.
  authCb: null as null | ((u: { uid: string } | null) => void),
  // Every setDoc/updateDoc handed to the SDK, by path — and, held, the
  // writes park like the reads do: an offline device's mutation queue.
  writes: [] as string[],
  holdWrites: false,
  parkedWrites: [] as Array<() => void>,
  // waitForPendingWrites: the SDK's queue-drained signal (D357). Parked
  // until `drainQueue` — offline, it never resolves.
  drainWaiters: [] as Array<() => void>,
  // Whether subscribing fires the observer at once with `uid` (the SDK
  // does, asynchronously, once the session is restored). Off, a test
  // fires `authCb` itself to choose the ordering.
  autoAuth: true,
  // The sign-in gate: held, anonSignIn parks until `releaseSignIn` — the
  // SDK import and the auth restore, made as slow as a test needs.
  holdSignIn: false,
  releaseSignIn: null as null | (() => void),
  failSignIn: null as null | ((err: Error) => void),
  // Set, anonSignIn rejects at once with it — a lost session that cannot
  // be re-minted offline.
  signInError: null as null | Error,
  signIns: 0,
  // The document's visibility, and its captured listeners — so a case can
  // hide and foreground the app.
  hidden: false,
  docListeners: {} as Record<string, Array<() => void>>,
}));

vi.mock("../../lib/firebase", () => ({
  firebaseEnabled: true,
  anonSignIn: () => {
    h.signIns += 1;
    if (h.signInError) return Promise.reject(h.signInError);
    if (!h.holdSignIn) return Promise.resolve(h.uid);
    return new Promise<string>((resolve, reject) => {
      h.releaseSignIn = () => resolve(h.uid);
      h.failSignIn = (err) => reject(err);
    });
  },
  getDb: () => Promise.resolve({ __db: true }),
  getFirestoreApi: () => import("firebase/firestore"),
  getFunctionsApi: () => import("firebase/functions"),
  linkGoogle: () => Promise.resolve(),
  googleSignOut: () => Promise.resolve(),
  subscribeToAuth: (cb: (u: { uid: string } | null) => void) => {
    h.authCb = cb;
    if (h.autoAuth) cb({ uid: h.uid });
    return () => {};
  },
}));

vi.mock("../../lib/sentry", () => ({
  reportError: h.reportError,
  setSentryUser: vi.fn(),
}));

vi.mock("./push", () => ({ registerPush: () => Promise.resolve() }));
vi.mock("./deviceBind", () => ({ ensureDeviceBound: () => Promise.resolve() }));
vi.mock("./socialFetch", () => ({ writeDirectoryRow: () => Promise.resolve() }));
vi.mock("firebase/functions", () => ({ getFunctions: vi.fn(), httpsCallable: vi.fn() }));

vi.mock("firebase/firestore", () => {
  const ref = (kind: string, path: string[]) => ({ __kind: kind, path: path.join("/") });
  const snapOf = (docs: FakeDoc[]) => ({
    size: docs.length,
    docs: docs.map((d) => ({
      id: d.id,
      data: () => ({ ...d.data }),
      get: (k: string) => d.data[k],
      // The SDK's per-document flag for a local mutation laid over the
      // server's copy (D357's second review) — a fake doc sets it with
      // `pending: true`.
      metadata: { hasPendingWrites: !!d.pending },
    })),
  });
  const docSnap = (data: Record<string, unknown> | null) => ({
    exists: () => data !== null,
    get: (k: string) => (data ? data[k] : undefined),
    data: () => ({ ...(data || {}) }),
  });
  // The one door every read goes through: log it, then answer now or park.
  const net = <T>(path: string, cons: Constraint[], answer: () => T): Promise<T> => {
    h.calls.push({ path, cons });
    if (!h.gated) return Promise.resolve(answer());
    return new Promise<T>((resolve, reject) => {
      h.pending.push({
        path,
        cons,
        release: () => resolve(answer()),
        fail: (err) => reject(err),
      });
    });
  };
  const ms = (v: unknown) => (v as { ms: number }).ms;
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
    Timestamp: { fromMillis: (v: number) => ({ ms: v, toMillis: () => v }) },
    getDoc: (r: { path: string }) => net(r.path, [], () => {
      if (r.path === "v2_meta/app") {
        return docSnap({ contentRev: { toMillis: () => h.contentRev } });
      }
      if (r.path === `v2_users/${h.uid}`) return docSnap(h.profile);
      return docSnap(null);
    }),
    getDocs: (q: { path: string; cons?: Constraint[] }) => {
      const cons = q.cons || [];
      return net(q.path, cons, () => {
        const w = (field: string, op?: string) =>
          cons.find((c) => c.kind === "where" && c.field === field && (!op || c.op === op));
        const lim = (cons.find((c) => c.kind === "limit")?.value as number) ?? Infinity;
        if (q.path === "v2_questions") {
          const byId = cons.find((c) => c.kind === "where" && typeof c.field === "object");
          if (byId) return snapOf(h.bankDocs.filter((d) => (byId.value as string[]).includes(d.id)));
          const delta = w("updatedAt", ">");
          if (delta) {
            const since = ms(delta.value);
            return snapOf(h.bankDocs
              .filter((d) => (d.data.updatedAt as { toMillis(): number }).toMillis() > since)
              .slice(0, lim));
          }
          let docs = [...h.bankDocs].sort((a, b) => (a.id < b.id ? -1 : 1));
          const sIn = w("surface", "in");
          const sEq = w("surface", "==");
          const core = w("core", "==");
          const paid = w("paid", "==");
          if (sIn) docs = docs.filter((d) => (sIn.value as string[]).includes(d.data.surface as string));
          if (sEq) docs = docs.filter((d) => d.data.surface === sEq.value);
          if (core) docs = docs.filter((d) => d.data.core === core.value);
          if (paid) docs = docs.filter((d) => d.data.paid === paid.value);
          if (w("until", ">=")) docs = docs.filter((d) => typeof d.data.until === "string");
          return snapOf(docs.slice(0, lim));
        }
        if (q.path === `v2_users/${h.uid}/answers`) {
          const created = w("answeredAt", ">");
          const edited = w("editedAt", ">");
          const at = (d: FakeDoc, k: string) => (d.data[k] as { toMillis(): number } | undefined)?.toMillis() ?? 0;
          if (created) return snapOf(h.answerDocs.filter((d) => at(d, "answeredAt") > ms(created.value)).slice(0, lim));
          if (edited) return snapOf(h.answerDocs.filter((d) => at(d, "editedAt") > ms(edited.value)).slice(0, lim));
          return snapOf([...h.answerDocs].sort((a, b) => (a.id < b.id ? -1 : 1)).slice(0, lim));
        }
        if (q.path === "v2_question_aggs") {
          const ids = (cons.find((c) => c.kind === "where")?.value as string[]) || [];
          return snapOf(h.aggDocs.filter((d) => ids.includes(d.id)));
        }
        return snapOf([]);
      });
    },
    onSnapshot: () => () => {},
    setDoc: (r: { path: string }) => {
      h.writes.push(r.path);
      if (!h.holdWrites) return Promise.resolve();
      return new Promise<void>((resolve) => { h.parkedWrites.push(resolve); });
    },
    updateDoc: (r: { path: string }) => {
      h.writes.push(r.path);
      if (!h.holdWrites) return Promise.resolve();
      return new Promise<void>((resolve) => { h.parkedWrites.push(resolve); });
    },
    waitForPendingWrites: () => new Promise<void>((resolve) => { h.drainWaiters.push(resolve); }),
    deleteDoc: () => Promise.resolve(),
    deleteField: () => "__delete__",
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
  setItem(k: string, v: string): void { this.m.set(k, String(v)); }
  removeItem(k: string): void { this.m.delete(k); }
  clear(): void { this.m.clear(); }
  key(i: number): string | null { return [...this.m.keys()][i] ?? null; }
  get length(): number { return this.m.size; }
}

let storage: MemoryStorage;
let idb: IDBFactory;

// The mirror's key, as live.ts spells it. A literal rather than an import
// so that renaming the key in one place and not the other fails here.
const OWN_PROFILE_LS = "insight.ownProfile.v1";

const ts = (v: number) => ({ toMillis: () => v });
const q = (id: string, seq: number, over: Record<string, unknown> = {}): FakeDoc => ({
  id,
  data: {
    surface: "daily", seq, type: "vote", prompt: `Prompt ${id}`, options: ["A", "B"],
    topic: null, test: null, active: true, updatedAt: ts(1000), ...over,
  },
});
// The cache row shape: what the boot stores (no updatedAt — a transport
// field, dropped on the way in).
const row = (id: string, seq: number) => ({
  id, surface: "daily", seq, type: "vote", prompt: `Prompt ${id}`, options: ["A", "B"],
  topic: null, test: null, active: true,
});

async function seedBank(rows: Array<{ id: string }>, rev: number, cursor: number) {
  const cs = await import("./cacheStore");
  await cs.write("bank", rows.map((r) => [r.id, r]), {
    meta: [["bank", { rev, cursor }]],
    clearFirst: true,
  });
}
async function seedAnswers(uid: string, votes: Record<string, string>, maxTs: number) {
  const cs = await import("./cacheStore");
  await cs.write("answers", Object.entries(votes), {
    meta: [["answers", { uid, maxTs, maxEditTs: 0 }]],
    clearFirst: true,
  });
}
async function seedAggs(rows: Record<string, unknown>) {
  const cs = await import("./cacheStore");
  await cs.write("aggs", Object.entries(rows), { clearFirst: true });
}
function seedProfile(uid: string, over: Record<string, unknown> = {}) {
  storage.setItem(OWN_PROFILE_LS, JSON.stringify({
    uid, displayName: "Ada", handle: "", testResults: {},
    anchors: { city: "Oslo, NO", age: "30s" }, consent: {}, ...over,
  }));
}
// A device that has been through one full boot since D356: every store
// holds something, and the profile mirror names this account.
async function seedWarmDevice() {
  await seedBank([row("q_1", 1)], h.contentRev, 1000);
  await seedAnswers("uid_test", { q_1: "1" }, 500);
  await seedAggs({ q_1: { total: 3, counts: { 0: 1, 1: 2 } } });
  seedProfile("uid_test");
}

const pendingPaths = () => h.pending.map((p) => p.path);
// Release everything parked right now, in issue order, and let the
// microtasks behind each answer run before the next assertion.
async function release() {
  const batch = h.pending.splice(0);
  batch.forEach((p) => p.release());
  await new Promise<void>((r) => setTimeout(r, 0));
}
// Open the gate for good and drain it until the boot attaches.
async function releaseAll(LIVE: { attached: boolean }) {
  h.gated = false;
  await vi.waitFor(async () => {
    await release();
    expect(LIVE.attached).toBe(true);
  }, { timeout: 5000 });
}
const flush = () => new Promise<void>((r) => setTimeout(r, 0));
// Fire every listener registered for a window event (`online`, mostly).
const fire = (ev: string) => { for (const fn of h.listeners[ev] || []) fn(); };
// …and for a document event (`visibilitychange`).
const fireDoc = (ev: string) => { for (const fn of h.docListeners[ev] || []) fn(); };
// The SDK reports its queue drained (D357).
const drainQueue = async () => {
  h.drainWaiters.splice(0).forEach((r) => r());
  await flush();
};
// The mirror's key, as live.ts spells it — a literal for the same reason
// OWN_PROFILE_LS is.
const PENDING_LS = "insight.pendingAnswers.v1";
const pendingFile = () => JSON.parse(storage.getItem(PENDING_LS) || "null");
// "Kill the app": the process is gone, the disk is not.
const relaunch = () => {
  vi.resetModules();
  h.calls.length = 0;
  h.pending.length = 0;
  h.writes.length = 0;
  h.parkedWrites.length = 0;
  h.drainWaiters.length = 0;
};
// Wait until exactly these reads are parked. The paint no longer waits
// for the sign-in, so the reads that follow it can still be a few
// microtasks away when initLive returns.
const expectParked = (paths: string[]) =>
  vi.waitFor(() => { expect(pendingPaths().sort()).toEqual([...paths].sort()); });

beforeEach(() => {
  vi.resetModules();
  h.reportError.mockClear();
  h.gated = false;
  h.pending.length = 0;
  h.calls.length = 0;
  h.contentRev = 1000;
  h.uid = "uid_test";
  h.bankDocs = [q("q_1", 1)];
  h.answerDocs = [];
  h.aggDocs = [];
  h.profile = { displayName: "Ada", anchors: { city: "Oslo, NO", age: "30s" } };
  h.listeners = {};
  h.authCb = null;
  h.writes.length = 0;
  h.holdWrites = false;
  h.parkedWrites.length = 0;
  h.drainWaiters.length = 0;
  h.autoAuth = true;
  h.holdSignIn = false;
  h.releaseSignIn = null;
  h.failSignIn = null;
  h.signInError = null;
  h.signIns = 0;
  h.hidden = false;
  h.docListeners = {};
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
  idb = new IDBFactory();
  vi.stubGlobal("indexedDB", idb);
  vi.stubGlobal("window", {
    dispatchEvent: (ev: { type: string }) => {
      for (const fn of h.listeners[ev.type] || []) {
        try {
          fn(ev);
        } catch {
          /* a spec-layer listener with no DOM to act on — not this file's subject */
        }
      }
      return true;
    },
    addEventListener: (ev: string, fn: (e?: unknown) => void) => {
      (h.listeners[ev] ||= []).push(fn);
    },
    removeEventListener: () => {},
  });
  vi.stubGlobal("document", {
    get hidden() { return h.hidden; },
    addEventListener: (ev: string, fn: () => void) => { (h.docListeners[ev] ||= []).push(fn); },
    removeEventListener: () => {},
  });
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubEnv("VITE_V2_LIVE", "true");
});

afterEach(async () => {
  // The case's instance is torn down before the next case's is built:
  // its 2.5 s aggregate re-read and any boot still parked on a gate would
  // otherwise fire into a later case's exact-set pins as reads nobody
  // issued. Same instance the case used — resetModules runs in the NEXT
  // beforeEach.
  (await import("./live"))._teardownForTest();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("the warm paint", () => {
  it("releases the render off the device's caches before any network read is answered", async () => {
    await seedWarmDevice();
    h.gated = true;
    // A NEW daily question on the server, one the cache has not seen —
    // the delta must bring it in behind the paint.
    h.bankDocs = [q("q_1", 1), q("q_2", 2, { updatedAt: ts(2000) })];
    // …and an answer this account gave on another device since.
    h.answerDocs = [{ id: "q_2", data: { optionIdx: 0, answeredAt: ts(900) } }];

    // …and the sign-in is held too: the paint waits for neither the SDK
    // nor the auth restore, so with both parked the render is released
    // on the disk alone.
    h.holdSignIn = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    // A generous budget, so the only thing that can settle this is the
    // warm paint: the network is gated shut and the deadline is far off.
    await mod.initLive(30_000);

    // The store is on screen, off disk, and says so — for the account the
    // mirror names, held provisionally until auth confirms it.
    expect(LIVE.ready).toBe(true);
    expect(LIVE.uid).toBe("uid_test");
    expect(LIVE.enabled).toBe(true);
    expect(LIVE.attached).toBe(false);
    expect(LIVE.stale).toBe(true);
    expect(LIVE.demoInProd).toBe(false);
    expect(LIVE.bootError).toBe("");
    expect(LIVE.stats.bankSource).toBe("cache");
    expect(LIVE.deck().map((x) => x.id)).toEqual(["q_1"]);
    expect(LIVE.myVotes()).toEqual({ q_1: "1" });
    expect(LIVE.aggFor("q_1")?.total).toBe(3);
    // The anchors an answer would snapshot are the mirror's — the whole
    // reason the mirror is a condition of the paint.
    expect(LIVE.anchors()).toEqual({ city: "Oslo, NO", age: "30s" });
    expect(LIVE.displayName).toBe("Ada");
    // And nothing has been asked of the server — not one read, because
    // the boot is still waiting on the sign-in.
    expect(h.calls).toHaveLength(0);

    // Auth confirms the account; the network phase issues its reads and
    // they park — the server has still answered nothing.
    h.releaseSignIn?.();
    await expectParked(["v2_meta/app", "v2_users/uid_test"]);
    expect(LIVE.ready).toBe(true);
    expect(LIVE.attached).toBe(false);

    // The network phase reconciles in place.
    await releaseAll(LIVE);
    expect(LIVE.stale).toBe(false);
    expect(LIVE.attached).toBe(true);
    expect(LIVE.dailyBank().map((x) => x.id)).toEqual(["q_1", "q_2"]);
    expect(LIVE.myVotes()).toEqual({ q_1: "1", q_2: "0" });
    expect(LIVE.stats.bankSource).toBe("delta");
    // The bank query was a DELTA — the warm paint did not cost the cache
    // its cursor.
    const bankQs = h.calls.filter((c) => c.path === "v2_questions");
    expect(bankQs).toHaveLength(1);
    expect(bankQs[0].cons.some((c) => c.kind === "where" && c.field === "updatedAt")).toBe(true);
  });

  it("a first boot still waits for the network, and labels the wait", async () => {
    // Nothing on disk: the pre-D356 boot, unchanged. The deadline is what
    // releases the render, and the honest demo deck is what it shows.
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30);
    expect(LIVE.ready).toBe(false);
    expect(LIVE.enabled).toBe(false);
    expect(LIVE.demoInProd).toBe(true);
    await vi.waitFor(() => { expect(LIVE.bootError).toBe("still connecting — loading questions"); });

    await releaseAll(LIVE);
    expect(LIVE.ready).toBe(true);
    expect(LIVE.enabled).toBe(true);
    expect(LIVE.stale).toBe(false);
    // The label goes with the attach: a session that has been heard from
    // is not "still connecting", however the race went.
    expect(LIVE.bootError).toBe("");
    // …and this boot wrote the mirror, so the NEXT boot on this device is
    // a warm one.
    expect(JSON.parse(storage.getItem(OWN_PROFILE_LS) || "null")).toMatchObject({
      uid: "uid_test", displayName: "Ada", anchors: { city: "Oslo, NO", age: "30s" },
    });
  });

  it("a cached bank without the profile mirror waits — an answer must never snapshot empty anchors", async () => {
    await seedBank([row("q_1", 1)], h.contentRev, 1000);
    await seedAnswers("uid_test", { q_1: "1" }, 500);
    // No mirror: a device on its first boot since D356.
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30);
    expect(LIVE.ready).toBe(false);
    expect(LIVE.enabled).toBe(false);
    // The disk answers are still this boot's starting point — folded in
    // memory, and the answers query is the DELTA, not a cold pull.
    await releaseAll(LIVE);
    expect(LIVE.myVotes()).toEqual({ q_1: "1" });
    const ansQs = h.calls.filter((c) => c.path === "v2_users/uid_test/answers");
    expect(ansQs.some((c) => c.cons.some((k) => k.kind === "where" && k.field === "answeredAt"))).toBe(true);
    expect(ansQs.some((c) => c.cons.some((k) => k.kind === "orderBy"))).toBe(false);
  });

  it("another account's answers and profile never reach a warm paint", async () => {
    await seedBank([row("q_1", 1)], h.contentRev, 1000);
    await seedAnswers("uid_other", { q_1: "0" }, 500);
    await seedAggs({ q_1: { total: 3, counts: { 0: 1, 1: 2 } } });
    seedProfile("uid_other", { anchors: { city: "Bergen, NO" } });
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30);
    // The mirror is not this account's, so there is no paint at all…
    expect(LIVE.ready).toBe(false);
    expect(LIVE.myVotes()).toEqual({});
    expect(LIVE.anchors()).toEqual({});
    // …and after the attach nothing of the other account survived: the
    // answers were a cold pull for THIS uid, and the profile is the
    // server's.
    h.answerDocs = [{ id: "q_1", data: { optionIdx: 1, answeredAt: ts(700) } }];
    await releaseAll(LIVE);
    expect(LIVE.myVotes()).toEqual({ q_1: "1" });
    expect(LIVE.anchors()).toEqual({ city: "Oslo, NO", age: "30s" });
  });

  it("a changed contentRev replaces the warm deck with the server's bank", async () => {
    await seedWarmDevice();
    h.contentRev = 2000;
    h.bankDocs = [q("q_1", 1), q("q_2", 2)];
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    // Painted off the OLD rev's rows — a deck one reseed old for as long
    // as the full fetch takes, which is the trade D356 makes on purpose.
    expect(LIVE.ready).toBe(true);
    expect(LIVE.dailyBank().map((x) => x.id)).toEqual(["q_1"]);

    await releaseAll(LIVE);
    expect(LIVE.dailyBank().map((x) => x.id)).toEqual(["q_1", "q_2"]);
    expect(LIVE.stats.bankSource).toBe("network");
    // A full fetch, not a delta: FOUR boot queries since D382 — the three
    // surface queries plus the daily's own, none by cursor.
    const bankQs = h.calls.filter((c) => c.path === "v2_questions");
    expect(bankQs).toHaveLength(4);
    expect(bankQs.some((c) => c.cons.some((k) => k.kind === "where" && k.field === "updatedAt"))).toBe(false);
    // …and the cache now carries the new rev, so the next boot is warm
    // AND current.
    const cs = await import("./cacheStore");
    expect((await cs.readMeta<{ rev: number }>("bank"))?.rev).toBe(2000);
    expect([...(await cs.readAll("bank")).keys()]).toEqual(["q_1", "q_2"]);
  });

  it("a failed reconcile keeps the warm deck, says so, and a wake retries it", async () => {
    await seedWarmDevice();
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    expect(LIVE.ready).toBe(true);

    // The server fails every read it is asked. The meta and profile reads
    // are best-effort and a failed bank delta falls back to the cache, so
    // the failure that ends the boot is the answers delta's — the one
    // read hydrate deliberately leaves unguarded (a partial vote set
    // re-offers answered questions).
    await vi.waitFor(() => {
      h.pending.splice(0).forEach((p) => p.fail(new Error("offline")));
      expect(LIVE.bootError).toContain("offline");
    });
    // The deck stays — real, this device's last sync — and the store
    // says exactly that: enabled, stale, not attached.
    expect(LIVE.enabled).toBe(true);
    expect(LIVE.ready).toBe(true);
    expect(LIVE.stale).toBe(true);
    expect(LIVE.attached).toBe(false);
    expect(LIVE.deck().map((x) => x.id)).toEqual(["q_1"]);
    // No sample-questions banner for a real deck.
    expect(LIVE.demoInProd).toBe(false);

    // The network returns. wake() keys on `attached`, not `ready` — a
    // warm session is ready and must still get the full refresh here.
    expect(h.listeners.online?.length).toBeGreaterThan(0);
    h.gated = false;
    fire("online");
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    expect(LIVE.stale).toBe(false);
  });

  it("labels a warm session whose server stays silent past the budget, and clears it on the attach", async () => {
    await seedWarmDevice();
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(20);
    // Released by the paint, long before the deadline…
    expect(LIVE.ready).toBe(true);
    expect(LIVE.bootError).toBe("");
    // …and the deadline still asks its question when it expires.
    await vi.waitFor(() => { expect(LIVE.bootError).toBe("still connecting — loading questions"); });
    expect(LIVE.stale).toBe(true);
    await releaseAll(LIVE);
    expect(LIVE.bootError).toBe("");
    expect(LIVE.stale).toBe(false);
  });

  it("an account switch on the device wipes the mirror, so the next paint is the new account's", async () => {
    await seedWarmDevice();
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    expect(JSON.parse(storage.getItem(OWN_PROFILE_LS) || "null")?.uid).toBe("uid_test");

    // The auth observer reports a different account — a Google sign-in
    // resolving to an existing one (D3). resetForNewUid purges every
    // insight.* key synchronously, the mirror among them.
    h.uid = "uid_new";
    h.profile = { displayName: "Bea", anchors: { city: "Bergen, NO" } };
    h.authCb?.({ uid: "uid_new" });
    expect(storage.getItem(OWN_PROFILE_LS)).toBeNull();
    expect(LIVE.anchors()).toEqual({});
    expect(LIVE.myVotes()).toEqual({});
    expect(LIVE.attached).toBe(false);

    // The re-boot for the new account cannot warm-paint (no mirror, and
    // the answers store's owner is the old uid) and attaches the old way;
    // what it leaves on disk is the new account's.
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    expect(LIVE.uid).toBe("uid_new");
    expect(LIVE.anchors()).toEqual({ city: "Bergen, NO" });
    expect(JSON.parse(storage.getItem(OWN_PROFILE_LS) || "null")).toMatchObject({
      uid: "uid_new", displayName: "Bea",
    });
    // The purge took every store, the public bank and aggregates included
    // (D51: which rows a device cached is itself a trace of what the
    // previous account did), so the new account's boot was the cold
    // fetch — the priced cost of a lost session, not a delta.
    const cs = await import("./cacheStore");
    expect(await cs.readMeta("answers")).toMatchObject({ uid: "uid_new" });
    const bankQs = h.calls.filter((c) => c.path === "v2_questions");
    expect(bankQs.some((c) => c.cons.some((k) => k.kind === "where" && k.field === "surface" && k.op === "in"))).toBe(true);
  });

  it("a profile edit made on the warm-painted screen survives the profile read in flight", async () => {
    // The read went out at the top of hydrate; the person picks a city
    // before it comes back. The read's copy is older than the edit, and
    // applying it reverted the city on screen and wrote the old anchors
    // back over the mirror — so every later answer would have snapshotted
    // the old city.
    await seedWarmDevice();
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    await expectParked(["v2_meta/app", "v2_users/uid_test"]);
    LIVE.saveAnchors({ city: "Bergen, NO", age: "30s" });
    expect(LIVE.anchors()).toEqual({ city: "Bergen, NO", age: "30s" });
    // The read returns the server's older copy (Oslo).
    await releaseAll(LIVE);
    expect(LIVE.anchors()).toEqual({ city: "Bergen, NO", age: "30s" });
    expect(JSON.parse(storage.getItem(OWN_PROFILE_LS) || "null")?.anchors).toEqual({ city: "Bergen, NO", age: "30s" });
    // …and the edit's own write went out.
    expect(h.writes).toContain("v2_users/uid_test");
  });

  it("a hide during the boot's deck read still leaves the poll armed after the attach", async () => {
    // The hide handler stops the poll (and bumps its generation) while the
    // boot's own deck read is in flight, so that read cannot arm it; a
    // foreground before the attach joins the running boot instead of
    // resubscribing. Without the re-arm at the attach the session came up
    // with its counts frozen.
    await seedWarmDevice();
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    await expectParked(["v2_meta/app", "v2_users/uid_test"]);
    await release();
    await expectParked(["v2_questions", "v2_rank/daily"]);
    await release();
    await vi.waitFor(() => { expect(h.pending.length).toBe(3); });
    h.hidden = true;
    fireDoc("visibilitychange");
    h.hidden = false;
    fireDoc("visibilitychange");
    await releaseAll(LIVE);
    await vi.waitFor(() => { expect(mod._aggPollForTest().running).toBe(true); });
  });

  it("a wake during the running boot joins it rather than starting the poll twice", async () => {
    await seedWarmDevice();
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    expect(LIVE.ready).toBe(true);
    // The boot is parked on its first reads.
    await expectParked(["v2_meta/app", "v2_users/uid_test"]);
    const before = h.calls.length;
    // A foreground while the boot is in flight. With `ready` as the key
    // this would run resubscribeForToday → startAggPoll and issue a
    // second deck-aggregate read; with `attached` it joins the boot.
    fire("online");
    await flush();
    expect(h.calls.length).toBe(before);
    await releaseAll(LIVE);
  });
});

describe("the provisional account", () => {
  // The warm paint runs before auth has restored the session, for the
  // account the profile mirror names. These pin the three ways that can
  // end: confirmed (the first case above), contradicted in either order,
  // and a null state that is merely "not restored yet".

  it("auth naming a different account — observer first — leaves nothing of the mirror's on screen or on disk", async () => {
    await seedWarmDevice();
    // The device's last confirmed account was uid_test; the session that
    // restores is a different one (a lost session re-minted, D3).
    h.uid = "uid_new";
    h.profile = { displayName: "Bea", anchors: { city: "Bergen, NO" } };
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    // The observer fires inside initLive, before the disk read finishes:
    // the reset lands mid-read, and the read must fold into nothing.
    await mod.initLive(30);
    expect(LIVE.uid).toBe("uid_new");
    expect(LIVE.ready).toBe(false);
    expect(LIVE.myVotes()).toEqual({});
    expect(LIVE.anchors()).toEqual({});
    expect(storage.getItem(OWN_PROFILE_LS)).toBeNull();
    // One boot, not two: the reset's refreshLive joined the running one.
    expect(h.signIns).toBe(1);
    await releaseAll(LIVE);
    expect(h.calls.filter((c) => c.path === "v2_meta/app")).toHaveLength(1);
    expect(LIVE.anchors()).toEqual({ city: "Bergen, NO" });
    expect(JSON.parse(storage.getItem(OWN_PROFILE_LS) || "null")).toMatchObject({ uid: "uid_new" });
  });

  it("auth naming a different account — sign-in first — un-paints and purges the same way", async () => {
    await seedWarmDevice();
    h.autoAuth = false;
    h.holdSignIn = true;
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    // Painted for the mirror's account…
    expect(LIVE.ready).toBe(true);
    expect(LIVE.uid).toBe("uid_test");
    expect(LIVE.myVotes()).toEqual({ q_1: "1" });
    // …then the sign-in resolves to another one before the observer has
    // said a word. refreshLive's own check is the belt for this order.
    h.uid = "uid_new";
    h.profile = { displayName: "Bea", anchors: { city: "Bergen, NO" } };
    h.releaseSignIn?.();
    await vi.waitFor(() => { expect(LIVE.uid).toBe("uid_new"); });
    expect(LIVE.ready).toBe(false);
    expect(LIVE.myVotes()).toEqual({});
    expect(LIVE.anchors()).toEqual({});
    expect(storage.getItem(OWN_PROFILE_LS)).toBeNull();
    // The observer catching up changes nothing further.
    h.authCb?.({ uid: "uid_new" });
    expect(h.signIns).toBe(1);
    await releaseAll(LIVE);
    expect(LIVE.anchors()).toEqual({ city: "Bergen, NO" });
    expect(JSON.parse(storage.getItem(OWN_PROFILE_LS) || "null")).toMatchObject({ uid: "uid_new" });
  });

  it("a vote on the warm deck waits for the session before it reaches the SDK", async () => {
    // A write handed to Firestore before Auth has restored the session is
    // filed under the UNAUTHENTICATED user's mutation queue, and when the
    // real user arrives the SDK swaps queues rather than re-signing what
    // was pending — the promise never settles, the vote stays inflight
    // for the session, the server never sees it. So every mutator's
    // getDb() holds while the uid is the mirror's.
    await seedBank([row("q_1", 1), row("q_2", 2)], h.contentRev, 1000);
    await seedAnswers("uid_test", { q_1: "1" }, 500);
    seedProfile("uid_test");
    h.holdSignIn = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    expect(LIVE.ready).toBe(true);
    // The tap lands on the optimistic state at once…
    LIVE.vote("q_2", "0");
    expect(LIVE.myVotes()).toEqual({ q_1: "1", q_2: "0" });
    await flush();
    await flush();
    // …and nothing has been handed to the SDK.
    expect(h.writes).toEqual([]);
    // The session restores; the write goes out under it.
    h.releaseSignIn?.();
    await vi.waitFor(() => { expect(h.writes).toContain("v2_users/uid_test/answers/q_2"); });
    await releaseAll(LIVE);
    expect(LIVE.myVotes()).toEqual({ q_1: "1", q_2: "0" });
  });

  it("a boot that fails past the deck poll's start does not leave the poll armed", async () => {
    // The poll starts the moment there is a deck (beside the answers
    // reads, D356) and the answers reads are the unguarded ones — so a
    // failure there used to strand a read-per-minute on a session that
    // never attached.
    await seedWarmDevice();
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    // meta + profile, then the delta, then the answers ‖ aggregates trip:
    // fail that one.
    await expectParked(["v2_meta/app", "v2_users/uid_test"]);
    await release();
    await expectParked(["v2_questions", "v2_rank/daily"]);
    await release();
    await vi.waitFor(() => { expect(h.pending.length).toBe(3); });
    // The poll arms only once the deck's read has returned, so it is not
    // running yet — and after the failure it must not be running either,
    // whichever of the two rejections' chains ran first (the read's,
    // which arms; the answers', which stops).
    h.pending.splice(0).forEach((p) => p.fail(new Error("offline")));
    await vi.waitFor(() => { expect(LIVE.bootError).toContain("offline"); });
    await flush();
    expect(LIVE.attached).toBe(false);
    expect(mod._aggPollForTest().running).toBe(false);
    // …and the next successful boot re-arms it.
    fire("online");
    await releaseAll(LIVE);
    expect(mod._aggPollForTest().running).toBe(true);
  });

  it("a sign-in that rejects while the disk is still being read fails the boot cleanly", async () => {
    // A lost session that cannot be re-minted offline: the rejection
    // lands while refreshLive is parked on the IndexedDB reads. Unobserved
    // it would surface as an unhandled rejection (vitest fails the file
    // on one); observed, it is the boot's own failure, once.
    await seedWarmDevice();
    h.signInError = new Error("auth/network-request-failed");
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    // The paint still happened — the deck is the device's — and the boot
    // says what it hit.
    expect(LIVE.ready).toBe(true);
    await vi.waitFor(() => { expect(LIVE.bootError).toContain("auth/network-request-failed"); });
    expect(LIVE.stale).toBe(true);
    expect(h.signIns).toBe(1);
    expect(h.reportError.mock.calls.filter((c) => c[1]?.where === "boot")).toHaveLength(1);
  });

  it("a write parked behind the gate fails loudly when the sign-in fails, and the next wake retries", async () => {
    // A write parked here lives only in this process — there is no
    // session to hand it to the SDK under — so holding it past a failed
    // sign-in would be a promise the next launch cannot keep. It fails
    // into its own catch instead: the vote rolls back on screen the way a
    // refused write does.
    await seedBank([row("q_1", 1), row("q_2", 2)], h.contentRev, 1000);
    await seedAnswers("uid_test", { q_1: "1" }, 500);
    seedProfile("uid_test");
    h.holdSignIn = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    LIVE.vote("q_2", "0");
    await flush();
    expect(LIVE.myVotes()).toEqual({ q_1: "1", q_2: "0" });
    expect(h.writes).toEqual([]);
    h.failSignIn?.(new Error("auth/network-request-failed"));
    await vi.waitFor(() => { expect(LIVE.myVotes()).toEqual({ q_1: "1" }); });
    expect(h.writes).toEqual([]);
    expect(pendingFile()).toBeNull();
    await vi.waitFor(() => { expect(LIVE.bootError).toContain("auth/network-request-failed"); });
    // The network returns: the wake signs in again, and the session
    // attaches for the account the mirror named.
    h.holdSignIn = false;
    fire("online");
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    expect(h.signIns).toBe(2);
    expect(LIVE.uid).toBe("uid_test");
  });

  it("an optimistic report parked behind the gate rolls back when the sign-in fails", async () => {
    // flagAvatar sets its flag before its write like every optimistic
    // path; its getDb() moved inside the try so a gate failure rolls the
    // flag back and reports, instead of escaping the method unrolled.
    await seedWarmDevice();
    h.holdSignIn = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    const report = LIVE.flagAvatar("u_other").catch(() => "refused");
    await flush();
    expect(LIVE.flaggedAvatar("u_other")).toBe(true);
    h.failSignIn?.(new Error("auth/network-request-failed"));
    expect(await report).toBe("refused");
    expect(LIVE.flaggedAvatar("u_other")).toBe(false);
    expect(h.reportError.mock.calls.some((c) => c[1]?.where === "flagAvatar")).toBe(true);
  });

  it("a null auth state while the uid is provisional starts no second sign-in", async () => {
    await seedWarmDevice();
    h.autoAuth = false;
    h.holdSignIn = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    expect(LIVE.ready).toBe(true);
    // The SDK reports "no session" on its way to the sign-in refreshLive
    // already started. Before D356 state.uid was null here and the branch
    // could not fire; with a provisional uid it would have minted a
    // second anonymous account beside the first.
    h.authCb?.(null);
    await flush();
    expect(h.signIns).toBe(1);
    expect(LIVE.ready).toBe(true);
    expect(LIVE.uid).toBe("uid_test");
    // The sign-in lands on the same account: nothing to reset.
    h.releaseSignIn?.();
    h.authCb?.({ uid: "uid_test" });
    await releaseAll(LIVE);
    expect(LIVE.uid).toBe("uid_test");
    expect(LIVE.myVotes()).toEqual({ q_1: "1" });
    expect(h.signIns).toBe(1);
  });
});

describe("answers the server has not acknowledged (D357)", () => {
  // Before D356 an offline relaunch showed the demo deck, which hid this
  // gap by showing nothing. Now that the real deck comes back, an answer
  // that only the SDK's persisted queue holds must come back with it —
  // or the deck re-offers it and the second tap is refused.

  // A warm, attached device with q_1 answered and q_2 open; then the
  // network goes away and the person answers q_2.
  async function answerOffline() {
    await seedBank([row("q_1", 1), row("q_2", 2)], h.contentRev, 1000);
    await seedAnswers("uid_test", { q_1: "1" }, 500);
    seedProfile("uid_test");
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    h.holdWrites = true;
    LIVE.vote("q_2", "0");
    await flush();
    // Handed to the SDK, unacknowledged: the mirror holds it, the cache
    // does not.
    expect(h.writes).toEqual(["v2_users/uid_test/answers/q_2"]);
    expect(pendingFile()).toEqual({ uid: "uid_test", e: { q_2: { v: "0" } } });
    const cs = await import("./cacheStore");
    expect((await cs.readAll("answers")).has("q_2")).toBe(false);
    return LIVE;
  }

  it("survives a relaunch as a vote that is still unconfirmed, and is not re-offered", async () => {
    await answerOffline();
    relaunch();
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    expect(LIVE.ready).toBe(true);
    // Voted — the deck will not re-offer q_2 — and unconfirmed, exactly
    // the state the process died in.
    expect(LIVE.myVotes()).toEqual({ q_1: "1", q_2: "0" });
    expect(LIVE.confirmedVotes()).toEqual({ q_1: "1" });
    // …and the deck still carries the card — the daily reads myVotes()
    // to draw it answered, which is the line above.
    expect(LIVE.deck().map((q) => q.id)).toContain("q_2");
  });

  it("is confirmed by the answers delta once the queue delivered it", async () => {
    await answerOffline();
    relaunch();
    // The queue flushed on reconnect, before this boot's delta ran.
    h.answerDocs = [{ id: "q_2", data: { optionIdx: 0, answeredAt: ts(900) } }];
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    await vi.waitFor(() => { expect(LIVE.confirmedVotes()).toEqual({ q_1: "1", q_2: "0" }); });
    expect(pendingFile()).toBeNull();
    // …and it is in the acked cache now, so the next boot needs no mirror.
    const cs = await import("./cacheStore");
    expect((await cs.readAll<string>("answers")).get("q_2")).toBe("0");
    // No extra read: the delta was the proof.
    expect(h.calls.filter((c) => c.path === "v2_users/uid_test/answers")).toHaveLength(2);
  });

  it("is confirmed by one read of its own document once the SDK reports the queue drained", async () => {
    await answerOffline();
    relaunch();
    // The delta runs before the queue has flushed…
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    await flush();
    expect(LIVE.confirmedVotes()).toEqual({ q_1: "1" });
    expect(LIVE.myVotes()).toEqual({ q_1: "1", q_2: "0" });
    // …then the queue delivers, and the SDK says so.
    h.answerDocs = [{ id: "q_2", data: { optionIdx: 0, answeredAt: ts(900) } }];
    await drainQueue();
    await vi.waitFor(() => { expect(LIVE.confirmedVotes()).toEqual({ q_1: "1", q_2: "0" }); });
    expect(pendingFile()).toBeNull();
    const byId = h.calls.filter((c) => c.path === "v2_users/uid_test/answers"
      && c.cons.some((k) => k.kind === "where" && typeof k.field === "object"));
    expect(byId).toHaveLength(1);
    expect((byId[0].cons.find((k) => k.kind === "where")?.value as string[])).toEqual(["q_2"]);
  });

  it("is rolled back when the queue drained and the server holds no such document", async () => {
    // A create the rules refused after the relaunch — the in-process
    // catch would have rolled it back; nobody was there to catch it.
    await answerOffline();
    relaunch();
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    await drainQueue();
    await vi.waitFor(() => { expect(LIVE.myVotes()).toEqual({ q_1: "1" }); });
    expect(pendingFile()).toBeNull();
    // Re-offered, honestly: nothing on the server says it was answered,
    // and the feed's own mirror of the vote went with it.
    expect(JSON.parse(storage.getItem("insight.feedVotes.v1") || "{}")).not.toHaveProperty("q_2");
  });

  it("stays pending across an offline relaunch — the queue never reports draining", async () => {
    await answerOffline();
    relaunch();
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    expect(LIVE.myVotes()).toEqual({ q_1: "1", q_2: "0" });
    // The server fails every read: the boot fails, the deck stays, and
    // so does the unconfirmed answer — for the next boot to settle.
    await vi.waitFor(() => {
      h.pending.splice(0).forEach((p) => p.fail(new Error("offline")));
      expect(LIVE.bootError).toContain("offline");
    });
    expect(LIVE.myVotes()).toEqual({ q_1: "1", q_2: "0" });
    expect(LIVE.confirmedVotes()).toEqual({ q_1: "1" });
    expect(pendingFile()).toEqual({ uid: "uid_test", e: { q_2: { v: "0" } } });
  });

  it("a pending edit keeps the newer option on screen until the server agrees, and yields if it refuses", async () => {
    await seedBank([row("q_1", 1)], h.contentRev, 1000);
    await seedAnswers("uid_test", { q_1: "1" }, 500);
    seedProfile("uid_test");
    let mod = await import("./live");
    let LIVE = mod.default;
    await mod.initLive(30_000);
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    h.holdWrites = true;
    expect(LIVE.editVote("q_1", "0")).toBe(true);
    await flush();
    expect(pendingFile()).toEqual({ uid: "uid_test", e: { q_1: { v: "0", edit: true } } });

    relaunch();
    // The server still holds the OLD option: the edit is in the queue.
    h.answerDocs = [{ id: "q_1", data: { optionIdx: 1, answeredAt: ts(400), editedAt: ts(450) } }];
    mod = await import("./live");
    LIVE = mod.default;
    await mod.initLive(30_000);
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    await flush();
    // The newer intent wins the screen; the document's value did not
    // overwrite it.
    expect(LIVE.myVotes()).toEqual({ q_1: "0" });
    expect(LIVE.confirmedVotes()).toEqual({});
    // The queue drains and the rules refused the edit (another device's
    // edit won the cooldown): the document stands at 1, and so does the
    // screen.
    await drainQueue();
    await vi.waitFor(() => { expect(LIVE.myVotes()).toEqual({ q_1: "1" }); });
    expect(LIVE.confirmedVotes()).toEqual({ q_1: "1" });
    expect(pendingFile()).toBeNull();
  });

  it("a create another device won is settled to THAT device's answer, on screen and in the cache", async () => {
    // The document exists with a different value: the create-only rule
    // refused this device's write because the other one landed first.
    // Confirming with the pending value would cache an answer the server
    // never held — the second review executed exactly that.
    await answerOffline();
    relaunch();
    h.answerDocs = [{ id: "q_2", data: { optionIdx: 1, answeredAt: ts(900) } }];
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    await vi.waitFor(() => { expect(LIVE.confirmedVotes()).toEqual({ q_1: "1", q_2: "1" }); });
    expect(LIVE.myVotes()).toEqual({ q_1: "1", q_2: "1" });
    expect(pendingFile()).toBeNull();
    const cs = await import("./cacheStore");
    expect((await cs.readAll<string>("answers")).get("q_2")).toBe("1");
  });

  it("a document echoing this device's own unacknowledged write is not the server's word", async () => {
    // Under the persistent cache a query result carries the local
    // mutation laid over the document, flagged hasPendingWrites. The
    // shape that reaches a delta is an EDIT: the document's answeredAt
    // is real (the create was acknowledged), so the edit delta returns
    // it — with this device's new option laid over the old one. That
    // echo proves nothing until the queue has drained.
    await seedBank([row("q_1", 1)], h.contentRev, 1000);
    await seedAnswers("uid_test", { q_1: "1" }, 500);
    seedProfile("uid_test");
    let mod = await import("./live");
    let LIVE = mod.default;
    await mod.initLive(30_000);
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    h.holdWrites = true;
    expect(LIVE.editVote("q_1", "0")).toBe(true);
    await flush();
    relaunch();
    h.answerDocs = [{
      id: "q_1",
      data: { optionIdx: 0, answeredAt: ts(400), editedAt: ts(450) },
      pending: true,
    }];
    mod = await import("./live");
    LIVE = mod.default;
    await mod.initLive(30_000);
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    await flush();
    // On screen, unconfirmed, still in the mirror — the echo did not
    // settle it.
    expect(LIVE.myVotes()).toEqual({ q_1: "0" });
    expect(LIVE.confirmedVotes()).toEqual({});
    expect(pendingFile()).toEqual({ uid: "uid_test", e: { q_1: { v: "0", edit: true } } });
    // The queue drains and the rules refused the edit: the document
    // stands at its old option, and so — now — does the screen. Taking
    // the echo as the server's word would have cached 0 for good.
    h.answerDocs = [{ id: "q_1", data: { optionIdx: 1, answeredAt: ts(400), editedAt: ts(450) } }];
    await drainQueue();
    await vi.waitFor(() => { expect(LIVE.myVotes()).toEqual({ q_1: "1" }); });
    expect(LIVE.confirmedVotes()).toEqual({ q_1: "1" });
    expect(pendingFile()).toBeNull();
  });

  it("a cold pull never files a still-pending answer into the acknowledged cache", async () => {
    // A relaunch whose answers cache is gone (the boot before it failed
    // its answers read) takes the cold pull, which rewrites the cache
    // from state.votes — and state.votes now holds the restored pending
    // answer. Filed there, a refused create would be a confirmed phantom
    // on every later boot with nothing left to reconcile it.
    await answerOffline();
    relaunch();
    const cs = await import("./cacheStore");
    await cs.clearAll();
    // The server holds the acknowledged answer the cache no longer does.
    h.answerDocs = [{ id: "q_1", data: { optionIdx: 1, answeredAt: ts(500) } }];
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    await flush();
    expect(LIVE.myVotes()).toEqual({ q_1: "1", q_2: "0" });
    expect((await cs.readAll<string>("answers")).has("q_2")).toBe(false);
    // …and once refused, it is gone from memory too, with nothing on disk
    // to bring it back.
    await drainQueue();
    await vi.waitFor(() => { expect(LIVE.myVotes()).toEqual({ q_1: "1" }); });
    expect((await cs.readAll<string>("answers")).has("q_2")).toBe(false);
  });

  it("a settled answer takes the ack's own path: the aggregate re-read is scheduled", async () => {
    await answerOffline();
    relaunch();
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    h.answerDocs = [{ id: "q_2", data: { optionIdx: 0, answeredAt: ts(900) } }];
    await drainQueue();
    await vi.waitFor(() => { expect(LIVE.confirmedVotes()).toEqual({ q_1: "1", q_2: "0" }); });
    // The delayed re-read that clears `unaggregated` is armed for it,
    // exactly as vote()'s ack arms it.
    expect(mod._aggRefreshForTest().pending).toContain("q_2");
  });

  it("an answer tapped during the drain wait is left to its own promise", async () => {
    // The settle may rule only on what the restore brought back. A tap
    // made in this process has its own promise; the queue-drained signal
    // does not cover a write made after it was requested, so the settle's
    // read would find that document absent — and a settle that ruled on
    // it would roll back a write still on its way.
    await seedBank([row("q_1", 1), row("q_2", 2), row("q_3", 3)], h.contentRev, 1000);
    await seedAnswers("uid_test", { q_1: "1" }, 500);
    seedProfile("uid_test");
    let mod = await import("./live");
    let LIVE = mod.default;
    await mod.initLive(30_000);
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    h.holdWrites = true;
    LIVE.vote("q_2", "0");
    await flush();
    relaunch();
    mod = await import("./live");
    LIVE = mod.default;
    await mod.initLive(30_000);
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    // The settle is parked on the drain; the person answers q_3 meanwhile.
    h.holdWrites = true;
    LIVE.vote("q_3", "1");
    await flush();
    expect(pendingFile()?.e).toEqual({ q_2: { v: "0" }, q_3: { v: "1" } });
    // The queue delivered q_2; q_3 is still on its way.
    h.answerDocs = [{ id: "q_2", data: { optionIdx: 0, answeredAt: ts(900) } }];
    await drainQueue();
    await vi.waitFor(() => { expect(LIVE.confirmedVotes()).toEqual({ q_1: "1", q_2: "0" }); });
    // q_3: untouched — on screen, still pending, its own write parked.
    expect(LIVE.myVotes()).toEqual({ q_1: "1", q_2: "0", q_3: "1" });
    expect(pendingFile()?.e).toEqual({ q_3: { v: "1" } });
    const byId = h.calls.filter((c) => c.path === "v2_users/uid_test/answers"
      && c.cons.some((k) => k.kind === "where" && typeof k.field === "object"));
    expect(byId).toHaveLength(1);
    expect(byId[0].cons.find((k) => k.kind === "where")?.value).toEqual(["q_2"]);
  });

  it("the boot's deck read keeps a restored answer's own-vote bump while it is unconfirmed", async () => {
    // deck() hands the UI counts that EXCLUDE the viewer's own vote once
    // the aggregate holds it (the UI adds its own +1). A restored pending
    // answer is not in the aggregate yet; the boot's deck read used to
    // clear the flag anyway, and the card read one voter short.
    await answerOffline();
    relaunch();
    h.aggDocs = [{ id: "q_2", data: { counts: { "0": 1, "1": 2 }, total: 3, tooSmall: false } }];
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    await flush();
    const card = LIVE.deck().find((q) => q.id === "q_2");
    expect(card?.options[0].count).toBe(1);
  });

  it("a re-run boot does not adopt this process's own taps into the settle", async () => {
    // A wake after a failed boot re-runs hydrate, and the pending file
    // now also holds taps made in THIS process — inflight, with a live
    // promise of their own. Restoring those would let the settle confirm
    // them off the delta and count their ack a second time.
    await seedBank([row("q_1", 1), row("q_2", 2)], h.contentRev, 1000);
    await seedAnswers("uid_test", { q_1: "1" }, 500);
    seedProfile("uid_test");
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    await expectParked(["v2_meta/app", "v2_users/uid_test"]);
    await release();
    await expectParked(["v2_questions", "v2_rank/daily"]);
    await release();
    await vi.waitFor(() => { expect(h.pending.length).toBe(3); });
    await vi.waitFor(() => {
      h.pending.splice(0).forEach((p) => p.fail(new Error("offline")));
      expect(LIVE.bootError).toContain("offline");
    });
    // The person answers q_2 on the warm deck; the write is in the queue.
    h.holdWrites = true;
    LIVE.vote("q_2", "0");
    await flush();
    expect(pendingFile()?.e).toEqual({ q_2: { v: "0" } });
    // The network returns: the queue flushes and the delta returns q_2
    // acknowledged before the tap's own ack callback has run.
    h.gated = false;
    h.answerDocs = [{ id: "q_2", data: { optionIdx: 0, answeredAt: ts(900) } }];
    fire("online");
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
    await flush();
    // Not the settle's: still unconfirmed, still in the file.
    expect(LIVE.confirmedVotes()).toEqual({ q_1: "1" });
    expect(pendingFile()?.e).toEqual({ q_2: { v: "0" } });
    // Its own ack lands, once.
    h.parkedWrites.splice(0).forEach((r) => r());
    await vi.waitFor(() => { expect(LIVE.confirmedVotes()).toEqual({ q_1: "1", q_2: "0" }); });
    expect(pendingFile()).toBeNull();
  });

  it("an account switch mid-boot still applies the new account's profile after an edit", async () => {
    // The edit counter is read beside whichever read is USED. An edit
    // made under the old account before the switch is not an edit made
    // over the fresh read the new account gets.
    await seedWarmDevice();
    h.autoAuth = false;
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    await expectParked(["v2_meta/app", "v2_users/uid_test"]);
    LIVE.saveAnchors({ city: "Bergen, NO", age: "30s" });
    h.uid = "uid_new";
    h.profile = { displayName: "Bea", anchors: { city: "Tromsø, NO" } };
    h.authCb?.({ uid: "uid_new" });
    expect(LIVE.anchors()).toEqual({});
    await releaseAll(LIVE);
    expect(LIVE.uid).toBe("uid_new");
    expect(LIVE.anchors()).toEqual({ city: "Tromsø, NO" });
    expect(JSON.parse(storage.getItem(OWN_PROFILE_LS) || "null")).toMatchObject({ uid: "uid_new", anchors: { city: "Tromsø, NO" } });
  });

  it("a test result written while the profile read is in flight does not discard the read", async () => {
    // The passive fold writes results on its own schedule; only the
    // person's own edits — anchors, name, handle, consent — may make the
    // boot keep the screen over the read.
    await seedWarmDevice();
    h.gated = true;
    h.profile = { displayName: "Ada B.", anchors: { city: "Oslo, NO", age: "30s" } };
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    await expectParked(["v2_meta/app", "v2_users/uid_test"]);
    LIVE.saveTestResult("big5", { dims: [] });
    await releaseAll(LIVE);
    expect(LIVE.displayName).toBe("Ada B.");
  });

  it("the mirror is the account's: a switch takes it with everything else", async () => {
    const LIVE = await answerOffline();
    expect(pendingFile()?.uid).toBe("uid_test");
    h.uid = "uid_new";
    h.profile = { displayName: "Bea", anchors: {} };
    h.authCb?.({ uid: "uid_new" });
    expect(pendingFile()).toBeNull();
    // Let the new account's boot finish before the case ends: its reads
    // go through the same hoisted mock as the next case's, and an
    // in-flight boot from here would park them in that case's gate.
    await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
  });
});

describe("the network phase's round trips", () => {
  // The queries a boot issues are unchanged; what D356 changed is which
  // of them are in flight AT ONCE. A serial chain has one read pending
  // at every step; each release below counts what the next step parks.

  it("a warm boot: meta, then the delta, then the answers and the deck's aggregates together", async () => {
    await seedWarmDevice();
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    // Step 1: the meta read and the early profile read, nothing else.
    await expectParked(["v2_meta/app", "v2_users/uid_test"]);
    await release();
    // Step 2: the bank delta AND the daily's shape, in one trip. The
    // shape is one small document that depends on nothing (D382), so it
    // rides out with the delta rather than opening a trip of its own —
    // the same argument D356 made for the cold boot's three queries.
    // Sorted, because they are issued together and the order between two
    // reads in one trip is not a property worth pinning.
    expect(pendingPaths().sort()).toEqual(["v2_questions", "v2_rank/daily"]);
    await release();
    // Step 3: the two answer deltas AND the deck aggregates, in one trip.
    // Before D356 this was three trips — answered, then edited, then the
    // aggregates after the profile await. Waited for, not read at once:
    // the delta's rows are written back to the cache first, and that is
    // a few macrotasks of IndexedDB.
    await expectParked(["v2_question_aggs", "v2_users/uid_test/answers", "v2_users/uid_test/answers"]);
    await releaseAll(LIVE);
  });

  it("a cold boot: the three bank queries and the daily's shape in one trip", async () => {
    h.gated = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30);
    await expectParked(["v2_meta/app", "v2_users/uid_test"]);
    await release();
    // The boot surfaces, the core feed, the bought reach — and, since
    // D382, the daily's shape — at once. The daily's ROWS are a dependent
    // trip after this one (they need the length to know which positions
    // to ask for), which is the one round trip the paging costs; what it
    // buys is the whole daily surface not being fetched at all.
    await expectParked([
      "v2_questions", "v2_questions", "v2_questions", "v2_rank/daily",
    ]);
    await releaseAll(LIVE);
    expect(LIVE.dailyBank().map((x) => x.id)).toEqual(["q_1"]);
  });
});

// ── a retired daily stays in the array as a tombstone ───────────────────
//
// publishBank splits the daily lane from the UNFILTERED bank and every
// other lane from the active one, because the daily deck is POSITIONAL:
// computeDeckIds indexes `ids[(today - epoch - back) % n]`, so dropping
// any element renumbers every visible day — today's card swaps and six
// answered history cards render as unanswered.
//
// deck.test.ts names this rule and cannot see it: its case compares
// `computeDeckIds(ids, today)` with `computeDeckIds(ids, today)` — the
// same call twice, green for any implementation, and it never touches
// live.ts, where the invariant actually lives. Measured: rebuilding the
// daily lane from the ACTIVE bank instead leaves the whole unit run green.
//
// Two assertions, because the tombstone is only half the rule. The array
// keeps the retired question; the DISPLAY is what must never offer it.
// Pin one alone and the cheapest way to satisfy it is to break the other.
describe("retiring a served daily", () => {
  const bank = () =>
    Array.from({ length: 10 }, (_, i) => q(`q_${i}`, i, i === 3 ? { active: false } : {}));

  it("keeps it in the daily array, and never offers it", async () => {
    h.bankDocs = bank();
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(30_000);
    await releaseAll(LIVE);

    // Every id, in seq order, the retired one INCLUDED and in place.
    expect(
      LIVE.dailyBank().map((x) => x.id),
      "the retired daily was dropped from the array, which renumbers every visible day",
    ).toEqual(["q_0", "q_1", "q_2", "q_3", "q_4", "q_5", "q_6", "q_7", "q_8", "q_9"]);

    // …and the kill switch still kills, one layer up. The deck is a
    // rolling seven-day window, so WHICH ids it holds depends on the date;
    // that it excludes this one does not.
    const offered = LIVE.deck().map((x) => x.id);
    expect(offered, "the deck offered a retired question").not.toContain("q_3");
    expect(offered.length, "the deck came up empty, so the line above proves nothing")
      .toBeGreaterThan(0);
  });
});

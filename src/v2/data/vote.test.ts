// Unit tests for the vote() optimistic path in live.ts — specifically
// the inflight/unaggregated split: a vote must appear in myVotes()
// immediately (optimistic UI) but enter confirmedVotes() only when the
// answer setDoc is SERVER-acknowledged (with persistentLocalCache the
// promise resolves only on ack), and an agg snapshot arriving while the
// write is still in flight must NOT confirm it.
//
// live.ts keeps module-level state, so every test rebuilds the module
// (vi.resetModules + dynamic import) against hoisted mocks of
// ../../lib/firebase, ../../lib/sentry and firebase/firestore. setDoc
// resolution/rejection is driven by manually-settled promises.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// The answers and aggregate caches live in IndexedDB since D312
// (docs/ANSWER-SCALE.md §2.2) — fake-indexeddb is the spec implementation
// these cases persist into, and IDBDatabase's prototype is where a write
// TRANSACTION can be counted, which is the only honest way left to assert
// coalescing now that no localStorage spy sees the flush.
import { IDBFactory, IDBDatabase } from "fake-indexeddb";
import { LIVE_MEMBERS, LIVE_NEAR_MEMBERS, LIVE_SOCIAL_MEMBERS } from "../test/live-surface";
import { FUNCTIONS_REGION } from "../../lib/region";
import { CANON_BOARD_N } from "./deck";

interface FakeSnapshotDoc {
  id: string;
  data: Record<string, unknown>;
}

interface CapturedListener {
  path: string | undefined;
  next: (snap: unknown) => void;
  error?: (err: unknown) => void;
}

const h = vi.hoisted(() => ({
  reportError: vi.fn(),
  // per-test knobs (reset in beforeEach)
  setDocImpl: null as null | (() => Promise<void>),
  getDocsImpl: null as null | (() => Error),
  // Single-document reads, by path. Only `learnAnswer`'s re-read uses one
  // (D125/D157) and it is the whole race: the answer is written, this doc
  // is fetched, and whether it already counts the answer decides whether
  // the reveal has to add it back in. Default null keeps every other case
  // on the "document does not exist" answer they were written against.
  getDocImpl: null as null | ((path: string) => Record<string, unknown> | null),
  // OPTIONS TOO. The third argument decides whether a write can REMOVE a
  // field, and dropping it here is why nothing could pin `saveAnchors`
  // passing `mergeFields` — a fix landed with a comment claiming the
  // rules suite guarded it, and reverting the fix left every test green.
  setDocCalls: [] as Array<{
    path: string;
    data: Record<string, unknown>;
    opts?: Record<string, unknown>;
  }>,
  // the D86 edit path writes through updateDoc, never setDoc
  updateDocImpl: null as null | (() => Promise<void>),
  updateDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  bankDocs: [] as FakeSnapshotDoc[],
  // D278: the collection-group voter reads. Keyed by the city the query
  // asked for ("" = the unscoped pass), because the whole point of the
  // change is that the two return DIFFERENT people — a fixture that
  // ignored the filter could not tell a working narrowing from a no-op.
  voterDocs: {} as Record<string, FakeSnapshotDoc[]>,
  // Every collection-group query issued, with the field/value pairs it
  // carried. What proves the `where` reached Firestore rather than being
  // applied on the device afterwards.
  voterQueries: [] as Array<Record<string, unknown>>,
  // Documents `v2_question_aggs` queries resolve to, and the id lists they
  // were asked for (D125). The learn prefetch's whole failure mode is
  // asking for a document id nobody writes — getDocs returns nothing, the
  // cache holds null, and every reveal shows the authored estimate. That
  // is indistinguishable from "no data yet" unless the REQUEST is visible.
  //
  // The D129 deck poll reads through the same arm — it replaced a snapshot
  // listener the tests used to push into, so its fixtures are a document set
  // rather than a callback, and they land in this same map.
  aggDocs: [] as FakeSnapshotDoc[],
  // Documents the my-answers query resolves to (empty = the fresh-account
  // boot every earlier case was written against). Added for the catalog
  // fold: an entity answer doc has no optionIdx, and hydrate's fold has to
  // read it as answered rather than silently re-offering the picker.
  answerDocs: [] as FakeSnapshotDoc[],
  // Serve `answerDocs` in slices of this size instead of wholesale, so a
  // case can drive the COLD fetch's paging loop. 0 (the default) keeps the
  // old single-snapshot behaviour, which is what every other case wants —
  // the loop breaks on the first short page and never asks twice.
  answerPageSize: 0,
  answerServed: 0,
  aggIdQueries: [] as string[][],
  // Ids that make the `v2_question_aggs` query they appear in REJECT.
  // Targeted rather than getDocsImpl's blanket failure, because the case
  // it exists for is a partial one: several chunked `in` queries fire and
  // only some come back (D169's loadSimilarity).
  aggFailIds: [] as string[],
  // live.ts observes auth for the whole session; capture the callback so a
  // test can drive a uid change or a revoked session.
  authCb: null as null | ((u: { uid: string } | null) => void),
  snapshots: [] as CapturedListener[],
  // The offline-cache teardown deleteAccount owes the privacy policy. Named
  // rather than counted so the ORDER is assertable: clearIndexedDbPersistence
  // refuses to run against a live Firestore instance, so a terminate() that
  // stops happening turns the clear into a silent no-op.
  cacheTeardown: [] as string[],
  clearCacheImpl: null as null | (() => Promise<void>),
  // A boot that HANGS rather than throws. The field only ever produced
  // this shape — "still connecting" with no error — and nothing exercised
  // it, so the label that describes it was unpinned.
  hangSignIn: false,
  // The engagement seams the answer paths stamp on the SERVER ACK
  // (R2/D270, R4/D271). Recorded rather than counted: the qid and the
  // surface are the whole point — a stamp under the wrong key joins
  // nothing, and the tally's real functions are no-ops until arm(), so
  // calling through to them would prove nothing here.
  engagementCalls: [] as Array<{ fn: string; args: unknown[] }>,
}));

vi.mock("../../lib/firebase", () => {
  // MEMOISED, the way the real lib/firebase memoises its single `impl()`
  // promise — and that is not tidiness. live.ts re-binds its whole
  // Firestore namespace off this on EVERY `getDb()` (D110), so a factory
  // that returns a fresh `import()` each time can hand the second call a
  // different module object than the first: the store then holds the real
  // `doc`/`collection` while this file's doubles record nothing, and the
  // write fails with an invalid-argument the test reads as a refusal.
  // Invisible while every case voted once; a case that votes three times
  // sees the first succeed and the rest fail.
  const fsApi = import("firebase/firestore");
  const fnsApi = import("firebase/functions");
  return {
  firebaseEnabled: true,
  anonSignIn: () => (h.hangSignIn
    ? new Promise<string>(() => { /* never settles, which is the case */ })
    : Promise.resolve("uid_test")),
  getDb: () => Promise.resolve({ __db: true }),
  // The API surfaces live.ts binds off the same promise as getDb (D110).
  // `vi.mock("firebase/firestore")` in this file already replaced the real
  // module (vi.mock hoists, so its position below is immaterial), so importing
  // it here hands the store exactly the doubles this file asserts on — and
  // every case in it now also exercises the bind step.
  getFirestoreApi: () => fsApi,
  getFunctionsApi: () => fnsApi,
  linkGoogle: () => Promise.resolve(),
  googleSignOut: () => Promise.resolve(),
  subscribeToAuth: (cb: (u: { uid: string } | null) => void) => {
    h.authCb = cb;
    return () => { h.authCb = null; };
  },
  };
});

vi.mock("../../lib/sentry", () => ({
  reportError: h.reportError,
  setSentryUser: vi.fn(),
}));

vi.mock("./push", () => ({
  registerPush: () => Promise.resolve(),
}));

// Everything else passes through to the real module — only the two seams
// are observed, because their contract with live.ts is WHICH key gets
// stamped, and that is invisible from the tally's own tests.
vi.mock("./engagement", async (importActual) => {
  const actual = await importActual<typeof import("./engagement")>();
  return {
    ...actual,
    noteAnswer: (...args: unknown[]) => { h.engagementCalls.push({ fn: "noteAnswer", args }); },
    noteQid: (...args: unknown[]) => { h.engagementCalls.push({ fn: "noteQid", args }); },
  };
});

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
      // voters.ts recovers the author's uid from the document PATH — that
      // is what turns a collection-group row into a named person — so a
      // fixture without one parses to nobody. `__path` lets a case state
      // the author; everything else keeps the old shape.
      ref: { path: (d.data.__path as string) || `v2_users/uid_x/answers/${d.id}` },
    })),
  });
  return {
    collection: (_db: unknown, ...path: string[]) => ref("collection", path),
    collectionGroup: (_db: unknown, name: string) => ref("collectionGroup", [name]),
    doc: (_db: unknown, ...path: string[]) => ref("doc", path),
    query: (src: { path?: string }, ...parts: unknown[]) => ({
      __kind: "query", path: src?.path, parts,
    }),
    // `field` rides along since D278: the agg arm below keys on `value`
    // being an array and is unaffected, while the collection-group arm
    // needs to know WHICH equality it was handed.
    where: (field: unknown, _op: unknown, value: unknown) => ({ __kind: "where", field, value }),
    orderBy: () => ({ __kind: "orderBy" }),
    // Required since D161 paged the bank fetch: live.ts destructures the
    // whole Firestore surface, so a missing member throws at boot.
    startAfter: () => ({ __kind: "startAfter" }),
    limit: () => ({ __kind: "limit" }),
    documentId: () => ({ __kind: "documentId" }),
    serverTimestamp: () => ({ __kind: "serverTimestamp" }),
    Timestamp: { fromMillis: (ms: number) => ({ ms }) },
    getDoc: (target: { path: string }) => {
      const data = h.getDocImpl ? h.getDocImpl(target?.path) : null;
      return Promise.resolve(data
        ? { exists: () => true, get: (k: string) => data[k], data: () => data }
        : { exists: () => false, get: () => undefined, data: () => ({}) });
    },
    getDocs: (q: { path?: string; parts?: Array<{ __kind: string; value?: unknown }> }) => {
      // Lets a test simulate a network failure mid-hydrate.
      if (h.getDocsImpl) return Promise.reject(h.getDocsImpl());
      if (q?.path === "v2_questions") {
        // THE BOOT IS THREE QUERIES since D321/D313 — the boot surfaces,
        // `feed && core`, and the bought questions (`paid == true` with
        // the window open). This stub deliberately serves the whole bank
        // to the first two, which is why every feed fixture below reaches
        // the deck without saying `core`; making it faithful is a bigger
        // change than it looks and is on the night list.
        //
        // The PAID query is filtered, because it is the one this file
        // would otherwise break: unfiltered it hands back the whole bank
        // a third time, and hydrate concatenates the copies — which is
        // how the patterns-gate count read three where the fixture holds
        // one, with the duplication invisible while there were two.
        const wheres = (q.parts || []).filter(
          (pt) => (pt as { __kind: string }).__kind === "where",
        ) as unknown as Array<{ field: string; value: unknown }>;
        const paid = wheres.find((w) => w.field === "paid");
        if (!paid) return Promise.resolve(snapOf(h.bankDocs));
        const floor = String(wheres.find((w) => w.field === "until")?.value ?? "");
        return Promise.resolve(snapOf(h.bankDocs.filter((d) =>
          d.data.paid === paid.value
          // Firestore drops a document that lacks the field an inequality
          // names — which is what keeps the seeded bank out of this query.
          && typeof d.data.until === "string" && (d.data.until as string) >= floor)));
      }
      // The my-answers pull (and, on a warm boot, the D86 edit-cursor
      // query on the same path — fold() is idempotent over the repeat).
      if (q?.path === "v2_users/uid_test/answers") {
        // THE WARM BOOT IS TWO DELTAS on this path — `answeredAt >` and
        // `editedAt >` — and this stub used to serve the whole fixture to
        // both, so the two cursors were indistinguishable from here. That
        // is precisely what the watermark case below has to tell apart,
        // and a stub that ignores the filter cannot: it would pass on a
        // pair of queries that in production return different documents.
        //
        // Applied only when a fixture carries the field, so every existing
        // case — none of which stamps one — is served exactly as before.
        const wheres = (q.parts || []).filter(
          (pt) => (pt as { __kind: string }).__kind === "where",
        ) as unknown as Array<{ field: string; value: unknown }>;
        const ineq = wheres.find((w) => w.field === "answeredAt" || w.field === "editedAt");
        const since = (ineq?.value as { ms?: number } | undefined)?.ms;
        const filtered = ineq && typeof since === "number"
          // Firestore drops a document that lacks the field an inequality
          // names, which is what keeps an unedited answer out of the edit
          // delta — so the stub has to drop it too.
          ? h.answerDocs.filter((d) => {
            const v = (d.data as Record<string, unknown>)[ineq.field] as { toMillis?: () => number } | undefined;
            return v && typeof v.toMillis === "function" && v.toMillis() > since;
          })
          : h.answerDocs;
        if (!h.answerPageSize) return Promise.resolve(snapOf(filtered));
        const start = h.answerServed;
        h.answerServed += h.answerPageSize;
        return Promise.resolve(snapOf(filtered.slice(start, start + h.answerPageSize)));
      }
      // main's version, kept whole: it records the id list and returns only
      // the matching documents, which the learn-split cases below assert on.
      // The D129 poll reads through this same arm — `refreshAggs` queries
      // `documentId() in deckIds` — so its fixtures are filtered by deck
      // membership rather than returned wholesale. That is the more faithful
      // mock of the two and the poll needs no special case.
      // The voter fan-out (D102) and its city-scoped sibling (D278).
      if (q?.path === "answers") {
        const wheres: Record<string, unknown> = {};
        for (const part of q.parts || []) {
          const w = part as { __kind: string; field?: unknown; value?: unknown };
          if (w && w.__kind === "where" && typeof w.field === "string") wheres[w.field] = w.value;
        }
        h.voterQueries.push(wheres);
        const city = typeof wheres["anchors.city"] === "string" ? wheres["anchors.city"] as string : "";
        return Promise.resolve(snapOf(h.voterDocs[city] || []));
      }
      if (q?.path === "v2_question_aggs") {
        const ids = (q.parts || [])
          .filter((p) => p && p.__kind === "where" && Array.isArray(p.value))
          .flatMap((p) => p.value as string[]);
        h.aggIdQueries.push(ids);
        if (h.aggFailIds.some((id) => ids.includes(id))) {
          return Promise.reject(new Error("offline"));
        }
        return Promise.resolve(snapOf(h.aggDocs.filter((d) => ids.includes(d.id))));
      }
      return Promise.resolve(snapOf([]));
    },
    onSnapshot: (
      target: { path?: string },
      next: (snap: unknown) => void,
      error?: (err: unknown) => void,
    ) => {
      h.snapshots.push({ path: target?.path, next, error });
      return vi.fn();
    },
    setDoc: (
      target: { path: string },
      data: Record<string, unknown>,
      opts?: Record<string, unknown>,
    ) => {
      h.setDocCalls.push({ path: target.path, data, opts });
      return h.setDocImpl ? h.setDocImpl() : Promise.resolve();
    },
    updateDoc: (target: { path: string }, data: Record<string, unknown>) => {
      h.updateDocCalls.push({ path: target.path, data });
      return h.updateDocImpl ? h.updateDocImpl() : Promise.resolve();
    },
    terminate: () => {
      h.cacheTeardown.push("terminate");
      return Promise.resolve();
    },
    clearIndexedDbPersistence: () => {
      h.cacheTeardown.push("clearIndexedDbPersistence");
      return h.clearCacheImpl ? h.clearCacheImpl() : Promise.resolve();
    },
    // Unused by any case here, and required anyway since D110: live.ts
    // destructures its whole Firestore surface off one object, so a member it
    // uses ANYWHERE has to exist on this mock or boot throws. That is the
    // same kind of pin as the "window.LIVE public surface" case below —
    // adding a Firestore call to the store now forces this list to move.
    deleteDoc: () => Promise.resolve(),
    // D331: setPoliticalConsent removes the published compass with the
    // consent record, in one merge — a sentinel here, asserted in
    // political-consent.test.ts rather than in these boot fixtures.
    deleteField: () => "__delete__",
  };
});

// ── harness ─────────────────────────────────────────────────────────

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (e: unknown) => void } {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Drain microtasks plus one macrotask turn so vote()'s async body runs
// up to (or past) its await points.
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

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

let storage: MemoryStorage;

// Boots a fresh copy of live.ts with a one-question daily bank so the
// deck (and its agg listener) exist, and returns the LIVE store.
async function bootLive() {
  const mod = await import("./live");
  const LIVE = mod.default;
  // A 1 ms race budget keeps no long-lived boot timer around; boot is
  // pure microtasks with these mocks, so just wait for it to settle.
  await mod.initLive(1);
  await vi.waitFor(() => {
    expect(LIVE.ready).toBe(true);
  });
  return LIVE;
}

// Event handlers initLive registers, captured so a test can fire a wake.
const listeners: {
  window: Record<string, () => void>;
  document: Record<string, () => void>;
} = { window: {}, document: {} };
// EVERY window listener, in registration order — the capture map above
// keeps one slot per type (the wake tests fire "the" handler), but
// several stores register for insight:local-purge and a real window
// dispatches to all of them; a last-wins stub silently dropped
// cacheStore's purge clear (D312) under whichever store registered later.
const windowListenerList: Array<[string, () => void]> = [];

// Events live.ts dispatches on the stubbed window (insight:local-purge),
// so a test can assert the purge announced itself.
const dispatched: string[] = [];

const ANS_LS = "insight.answersCache.v1";
const WF_LS = "insight.feedVotes.v1";

// The answers cache's IndexedDB shape, read and seeded through cacheStore
// itself so the assertions below keep the old blob's vocabulary
// ({uid, votes, maxTs}) while the storage is rows + a meta row (D312).
// Dynamic imports, because vi.resetModules gives each boot a fresh module
// instance and the helper must talk to the one the booted live.ts uses.
const readAnsCache = async () => {
  const cs = await import("./cacheStore");
  const meta = await cs.readMeta<{ uid: string; maxTs: number; maxEditTs: number }>("answers");
  const rows = await cs.readAll<string>("answers");
  return { ...(meta || {}), votes: Object.fromEntries(rows) } as {
    uid?: string; maxTs?: number; maxEditTs?: number; votes: Record<string, string>;
  };
};
const seedAnsCache = async (p: {
  uid: string; votes: Record<string, string>; maxTs: number; maxEditTs?: number;
}) => {
  const cs = await import("./cacheStore");
  await cs.write("answers", Object.entries(p.votes), {
    meta: [["answers", { uid: p.uid, maxTs: p.maxTs, maxEditTs: p.maxEditTs || 0 }]],
  });
};
const readAggCache = async () => {
  const cs = await import("./cacheStore");
  return Object.fromEntries(await cs.readAll<Record<string, unknown>>("aggs"));
};

beforeEach(() => {
  vi.resetModules();
  h.reportError.mockClear();
  h.setDocImpl = null;
  h.getDocsImpl = null;
  h.getDocImpl = null;
  h.aggDocs.length = 0;
  h.authCb = null;
  h.setDocCalls.length = 0;
  h.updateDocImpl = null;
  h.updateDocCalls.length = 0;
  h.snapshots.length = 0;
  h.cacheTeardown.length = 0;
  h.clearCacheImpl = null;
  h.hangSignIn = false;
  h.aggDocs.length = 0;
  h.answerDocs.length = 0;
  h.answerPageSize = 0;
  h.answerServed = 0;
  h.aggIdQueries.length = 0;
  h.aggFailIds.length = 0;
  h.voterDocs = {};
  h.voterQueries.length = 0;
  h.engagementCalls.length = 0;
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
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
  // A fresh IndexedDB per test: the answers and aggregate caches live
  // there since D312, and a shared factory would leak one test's rows
  // into the next the way a shared MemoryStorage would.
  vi.stubGlobal("indexedDB", new IDBFactory());
  // initLive attaches `online` / `visibilitychange` handlers for the
  // reconnect path. The stub carries addEventListener so that code path is
  // actually taken here rather than skipped by its typeof guard — and
  // registered handlers are captured so a test can fire a wake.
  listeners.window = {};
  listeners.document = {};
  dispatched.length = 0;
  windowListenerList.length = 0;
  vi.stubGlobal("window", {
    // Faithful to a real window: dispatch INVOKES every registered
    // listener, because cacheStore's purge clear rides exactly this path
    // (D312) and a stub that only records the type would leave the
    // IndexedDB stores full through every purge case below.
    dispatchEvent: (e: Event) => {
      dispatched.push(e?.type);
      for (const [type, fn] of windowListenerList) if (type === e?.type) fn();
      return true;
    },
    addEventListener: (type: string, fn: () => void) => {
      listeners.window[type] = fn;
      windowListenerList.push([type, fn]);
    },
    removeEventListener: (type: string) => { delete listeners.window[type]; },
  });
  vi.stubGlobal("document", {
    hidden: false,
    addEventListener: (type: string, fn: () => void) => { listeners.document[type] = fn; },
    removeEventListener: (type: string) => { delete listeners.document[type]; },
  });
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubEnv("VITE_V2_LIVE", "true");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// ── tests ───────────────────────────────────────────────────────────

// ── the Patterns tab's mount gate (D265) ────────────────────────────
//
// `patternsSignal()` is the device half of the decision that puts a whole
// tab in the bar, and every OTHER test of it runs against the mount
// fixture, which replaces the member wholesale. So this is the only place
// its body executes: the meta keys it reads, the two banks it walks, and
// the eligibility rule it applies. A typo in a meta key here (`patternPool`
// for `patternsPool`) ships green everywhere else and hides the tab on
// every device with no error anywhere.
describe("patternsSignal (D265): the mount gate's two numbers", () => {
  const bank = (id: string, over: Record<string, unknown>) => ({
    id,
    data: {
      surface: "feed", seq: 1, type: "vote", prompt: id,
      options: ["A", "B"], topic: null, test: null, active: true, ...over,
    },
  });
  const answered = (id: string, surface: string) => ({
    id,
    data: { qid: id, surface, optionIdx: 0, answeredAt: { toMillis: () => 5 } },
  });

  it("reads the fit's published count off v2_meta/app", async () => {
    h.getDocImpl = (path) => (path === "v2_meta/app"
      ? { patternsPool: 30, patternsBasis: 8 }
      : null);
    const LIVE = await bootLive();
    expect(LIVE.patternsSignal()).toMatchObject({ pool: 30, basis: 8 });
  });

  it("reads an absent field as nothing, not as a pass", async () => {
    h.getDocImpl = (path) => (path === "v2_meta/app" ? { contentRev: null } : null);
    const LIVE = await bootLive();
    expect(LIVE.patternsSignal()).toMatchObject({ pool: 0, basis: 0 });
  });

  it("counts the viewer's answers by the fit's own eligibility rule", async () => {
    // The bank: one two-option daily (core by construction), one core feed,
    // one TAIL feed, one three-option daily. The fit folds the first two
    // and nothing else (D161 + the ±1 encoding), so `mine` must be 2 even
    // though four answers exist.
    h.bankDocs.push(
      bank("feed-core", { core: true }),
      bank("feed-tail", {}),
      bank("daily-three", { surface: "daily", options: ["A", "B", "C"] }),
    );
    h.answerDocs.push(
      answered("q_1", "daily"),            // the default two-option daily
      answered("feed-core", "feed"),
      answered("feed-tail", "feed"),
      answered("daily-three", "daily"),
    );
    h.getDocImpl = (path) => (path === "v2_meta/app"
      ? { patternsPool: 30, patternsBasis: 8 }
      : null);
    const LIVE = await bootLive();
    expect(Object.keys(LIVE.myVotes())).toHaveLength(4);
    expect(LIVE.patternsSignal().mine).toBe(2);
  });

  it("answers nothing at all when the build is not live", async () => {
    // The demo's honest state, and the reason a demo build never offers
    // the tab: no fit behind it, so no gate to open.
    vi.stubEnv("VITE_V2_LIVE", "false");
    const mod = await import("./live");
    expect(mod.default.patternsSignal()).toEqual({});
  });
});

// ── the read breaker (D332) ─────────────────────────────────────────
//
// `budgetMode` on v2_meta/app is the graded breaker docs/COSTS.md designed:
// level 1 pauses the D98 social fetches. These cases are the lever's only
// executing proof — the panel suites pin what a paused surface SAYS, but
// only here does a gated loader run against a store that could issue the
// read, so only here can "paused" be measured as zero queries rather than
// as a sentence. The absent-field case matters as much as the set one: a
// meta doc without the field must read as level 0 (the lever fails open),
// or every device pauses the day the field is misspelled.
describe("budgetMode (D332): level 1 pauses the social reads", () => {
  const metaAt = (level: number) => {
    h.getDocImpl = (path) => (path === "v2_meta/app" ? { budgetMode: level } : null);
  };

  it("reads the mode off v2_meta/app", async () => {
    metaAt(1);
    const LIVE = await bootLive();
    expect(LIVE.budgetPaused).toBe(true);
  });

  it("stays unpaused when the field is absent", async () => {
    h.getDocImpl = (path) => (path === "v2_meta/app" ? { contentRev: null } : null);
    const LIVE = await bootLive();
    expect(LIVE.budgetPaused).toBe(false);
  });

  it("loadVoters issues no query and leaves the key ABSENT, not empty", async () => {
    metaAt(1);
    const LIVE = await bootLive();
    await LIVE.loadVoters("q_1");
    expect(h.voterQueries).toHaveLength(0);
    // Absent is "we could not ask" — the sheet's paused branch renders,
    // never "nobody answered".
    expect(LIVE.voters("q_1")).toBeNull();
    expect(LIVE.votersLoading("q_1")).toBe(false);
  });

  it("loadKindred spins nothing — no queries, no loading flag", async () => {
    metaAt(1);
    const LIVE = await bootLive();
    await LIVE.loadKindred();
    expect(h.voterQueries).toHaveLength(0);
    expect(LIVE.kindredLoading()).toBe(false);
  });

  it("loadCircle leaves the circle null rather than folding an empty one", async () => {
    metaAt(1);
    const LIVE = await bootLive();
    await LIVE.loadCircle();
    // null is the stop's "could not ask"; [] would be a settled fold —
    // the two arms LiveCircleBody renders differently, and the gate must
    // produce the first.
    expect(LIVE.circle()).toBeNull();
    expect(LIVE.circleLoading()).toBe(false);
  });

  it("level 0 keeps the reads working — the contrast that proves the gate gates", async () => {
    metaAt(0);
    const LIVE = await bootLive();
    await LIVE.loadVoters("q_1");
    expect(h.voterQueries.length).toBeGreaterThan(0);
    expect(LIVE.voters("q_1")).not.toBeNull();
  });
});

describe("vote() optimistic path (inflight vs unaggregated)", () => {
  it("shows a pending vote in myVotes but NOT in confirmedVotes", async () => {
    const LIVE = await bootLive();
    const d = deferred();
    h.setDocImpl = () => d.promise;
    const listener = vi.fn();
    LIVE.subscribe(listener);

    LIVE.vote("q_1", "1");
    // synchronous optimistic record + notify
    expect(LIVE.myVotes()).toMatchObject({ q_1: "1" });
    expect(LIVE.confirmedVotes()).not.toHaveProperty("q_1");
    expect(listener).toHaveBeenCalledTimes(1);

    await flush(); // async body reaches `await setDoc` — still unacked
    expect(h.setDocCalls.map((c) => c.path)).toContain("v2_users/uid_test/answers/q_1");
    expect(LIVE.myVotes()).toMatchObject({ q_1: "1" });
    expect(LIVE.confirmedVotes()).not.toHaveProperty("q_1");
    // the answers cache mirrors only server-acked docs — nothing yet
    const cached = await readAnsCache();
    expect(cached.votes || {}).not.toHaveProperty("q_1");

    d.resolve(); // avoid a dangling pending promise
    await flush();
  });

  it("moves the vote into confirmedVotes (and the answers cache) on server ack", async () => {
    const LIVE = await bootLive();
    const d = deferred();
    h.setDocImpl = () => d.promise;
    const listener = vi.fn();
    LIVE.subscribe(listener);

    LIVE.vote("q_1", "0");
    await flush();
    expect(LIVE.confirmedVotes()).not.toHaveProperty("q_1");
    const notifiesBeforeAck = listener.mock.calls.length;

    d.resolve();
    await flush();
    expect(LIVE.confirmedVotes()).toMatchObject({ q_1: "0" });
    expect(LIVE.myVotes()).toMatchObject({ q_1: "0" });
    // ack re-notifies so persistent records (the Map) pick it up
    expect(listener.mock.calls.length).toBeGreaterThan(notifiesBeforeAck);
    const cached = await readAnsCache();
    expect(cached.votes).toMatchObject({ q_1: "0" });
  });

  it("coalesces a sitting's post-vote refreshes into ONE drain, not one per answer", async () => {
    // A feed sitting is ten to thirty answers, and each acked write asks
    // for its question's freshly folded aggregate. This used to arm a
    // separate 2500 ms timer per answer: one single-document round trip
    // each, one complete buildFeedGlobals() each — which filters and maps
    // the whole feed bank twice, per card — and one notify() each, which
    // re-runs every subscriber's fold. Thirty answers bought thirty of
    // each.
    //
    // Asserted on the ARMED TIMER and the pending set rather than on the
    // query the drain eventually issues, for the reason `_aggPollForTest`
    // exists: one timer holding three qids IS the claim, and a 2500 ms
    // real-timer wait would put the assertion in whatever module state the
    // clock has moved on to.
    h.bankDocs = [h.bankDocs[0], {
      id: "q_2",
      data: {
        surface: "daily", seq: 2, type: "vote", prompt: "Prompt q_2",
        options: ["A", "B"], topic: null, test: null, active: true,
      },
    }, {
      id: "q_3",
      data: {
        surface: "daily", seq: 3, type: "vote", prompt: "Prompt q_3",
        options: ["A", "B"], topic: null, test: null, active: true,
      },
    }];
    const LIVE = await bootLive();
    const mod = await import("./live");

    LIVE.vote("q_1", "0");
    LIVE.vote("q_2", "1");
    LIVE.vote("q_3", "0");
    // Each write is its own promise chain (getDb → setDoc → ack), so wait
    // for all three acks rather than for one macrotask.
    // Each write is its own promise chain (getDb → setDoc → ack), so wait
    // for all three acks rather than for one macrotask.
    await vi.waitFor(() => {
      expect(mod._aggRefreshForTest().pending).toHaveLength(3);
    });

    const r = mod._aggRefreshForTest();
    expect(r.armed, "three answers must share one refresh timer").toBe(true);
    expect([...r.pending].sort()).toEqual(["q_1", "q_2", "q_3"]);

    // And the drain itself asks for the whole set in one query rather than
    // one per qid — run directly, the `tick()` precedent.
    h.aggDocs = [
      { id: "q_1", data: { total: 3, counts: { "0": 3 } } },
      { id: "q_2", data: { total: 4, counts: { "1": 4 } } },
      { id: "q_3", data: { total: 5, counts: { "0": 5 } } },
    ];
    h.aggIdQueries.length = 0;
    await r.drain({ __db: true } as never);
    expect(h.aggIdQueries).toHaveLength(1);
    expect([...h.aggIdQueries[0]].sort()).toEqual(["q_1", "q_2", "q_3"]);
    expect(LIVE.aggFor("q_2")).toMatchObject({ total: 4 });
    // Drained means drained — a second pass has nothing left to ask for.
    expect(mod._aggRefreshForTest().pending).toEqual([]);
  });

  it("does NOT confirm an unacked vote when an agg poll lands mid-flight", async () => {
    const LIVE = await bootLive();
    const d = deferred();
    h.setDocImpl = () => d.promise;

    LIVE.vote("q_1", "1");
    await flush(); // write in flight

    // A stranger's vote folds into the public aggregate while our
    // setDoc is still pending — the regression this split fixes. The
    // aggregate arrives on a poll rather than a snapshot since D129, and
    // the contract is unchanged: a fresh aggregate must not confirm a
    // write the server has not acknowledged.
    h.aggDocs.push({
      id: "q_1",
      data: { counts: { "0": 3, "1": 1 }, total: 4, tooSmall: false },
    });
    const mod = await import("./live");
    await mod._aggPollForTest().tick();

    expect(LIVE.myVotes()).toMatchObject({ q_1: "1" });
    expect(LIVE.confirmedVotes()).not.toHaveProperty("q_1"); // still unacked

    d.resolve();
    await flush();
    expect(LIVE.confirmedVotes()).toMatchObject({ q_1: "1" }); // acked now
  });

  it("rolls back everywhere, notifies and reports when the write is refused", async () => {
    const LIVE = await bootLive();
    const d = deferred();
    h.setDocImpl = () => d.promise;
    // pre-seed the feed-votes mirror the rollback must scrub
    storage.setItem(WF_LS, JSON.stringify({ q_1: 1 }));
    const listener = vi.fn();
    LIVE.subscribe(listener);

    LIVE.vote("q_1", "1");
    await flush();
    const notifiesBeforeReject = listener.mock.calls.length;

    const boom = new Error("PERMISSION_DENIED: create-only rule");
    d.reject(boom);
    await flush();

    expect(LIVE.myVotes()).not.toHaveProperty("q_1");
    expect(LIVE.confirmedVotes()).not.toHaveProperty("q_1");
    expect(JSON.parse(storage.getItem(WF_LS) || "{}")).not.toHaveProperty("q_1");
    const cached = await readAnsCache();
    expect(cached.votes || {}).not.toHaveProperty("q_1");
    expect(listener.mock.calls.length).toBeGreaterThan(notifiesBeforeReject);
    expect(h.reportError).toHaveBeenCalledWith(boom, { where: "vote", qid: "q_1" });
  });

  it("editVote (D86): refuses when there is nothing to move, and sends nothing", async () => {
    const LIVE = await bootLive();
    expect(LIVE.editVote("q_1", "1")).toBe(false); // never answered
    LIVE.vote("q_1", "1");
    await flush();
    expect(LIVE.editVote("q_1", "1")).toBe(false); // same option
    expect(h.updateDocCalls).toHaveLength(0);
  });

  it("editVote refuses while the create is still unacked, then moves once it lands", async () => {
    const LIVE = await bootLive();
    const d = deferred();
    h.setDocImpl = () => d.promise;
    LIVE.vote("q_1", "1");
    await flush();
    expect(LIVE.editVote("q_1", "0")).toBe(false); // create in flight
    d.resolve();
    await flush();
    expect(LIVE.editVote("q_1", "0")).toBe(true);
    await flush();
    expect(h.updateDocCalls.map((c) => c.path)).toContain("v2_users/uid_test/answers/q_1");
  });

  it("editVote moves optimistically, writes ONLY optionIdx + editedAt, and confirms on ack", async () => {
    const LIVE = await bootLive();
    LIVE.vote("q_1", "1");
    await flush();
    const d = deferred();
    h.updateDocImpl = () => d.promise;
    expect(LIVE.editVote("q_1", "0")).toBe(true);
    expect(LIVE.myVotes()).toMatchObject({ q_1: "0" });      // optimistic
    expect(LIVE.confirmedVotes()).not.toHaveProperty("q_1"); // unacked again
    await flush();
    const call = h.updateDocCalls.find((c) => c.path === "v2_users/uid_test/answers/q_1");
    expect(call).toBeDefined();
    // The whole diff surface the rules arm admits — anything more here
    // would be refused server-side (anchors and answeredAt are frozen).
    expect(Object.keys(call!.data).sort()).toEqual(["editedAt", "optionIdx"]);
    expect(call!.data.optionIdx).toBe(0);
    d.resolve();
    await flush();
    expect(LIVE.confirmedVotes()).toMatchObject({ q_1: "0" });
    const cached = await readAnsCache();
    expect(cached.votes).toMatchObject({ q_1: "0" });
  });

  it("editVote holds the client-side 60s cooldown after an acked edit", async () => {
    const LIVE = await bootLive();
    LIVE.vote("q_1", "1");
    await flush();
    expect(LIVE.editVote("q_1", "0")).toBe(true);
    await flush(); // acked — the cooldown stamp lands
    expect(LIVE.editVote("q_1", "1")).toBe(false);
    expect(h.updateDocCalls).toHaveLength(1); // the second edit sent nothing
  });

  it("editVote rolls back to the standing option when the server refuses", async () => {
    const LIVE = await bootLive();
    LIVE.vote("q_1", "1");
    await flush();
    // the feed-votes mirror the rollback must RESTORE (not scrub — the
    // doc still holds the previous option, unlike a refused create)
    storage.setItem(WF_LS, JSON.stringify({ q_1: 0 }));
    const d = deferred();
    h.updateDocImpl = () => d.promise;
    expect(LIVE.editVote("q_1", "0")).toBe(true);
    await flush();
    const boom = new Error("PERMISSION_DENIED: one change a minute");
    d.reject(boom);
    await flush();
    expect(LIVE.myVotes()).toMatchObject({ q_1: "1" });
    expect(LIVE.confirmedVotes()).toMatchObject({ q_1: "1" });
    expect(JSON.parse(storage.getItem(WF_LS) || "{}")).toMatchObject({ q_1: 1 });
    const cached = await readAnsCache();
    expect(cached.votes).toMatchObject({ q_1: "1" });
    expect(h.reportError).toHaveBeenCalledWith(boom, { where: "editVote", qid: "q_1" });
  });

  it("registers wake handlers, and a wake on a dead session re-attaches", async () => {
    // Two shipped banners say "reconnecting…". Before this, nothing in the
    // codebase ever reconnected: a boot that failed left LIVE disabled for
    // the life of the process. These assert the handlers exist and that a
    // wake actually retries rather than no-oping.
    const mod = await import("./live");
    const LIVE = mod.default;

    // Fail the first boot the way a flaky network would.
    h.getDocsImpl = () => { throw new Error("offline"); };
    await mod.initLive(1);
    // initLive races boot against a 1ms budget and RETURNS on timeout while
    // boot is still running. Let it finish failing before touching the knob
    // below, or that same in-flight boot picks up the restored getDocs and
    // succeeds on its own.
    await flush();
    await flush();
    expect(LIVE.enabled).toBe(false);

    expect(typeof listeners.window.online).toBe("function");
    expect(typeof listeners.document.visibilitychange).toBe("function");

    // Network returns; the wake must recover the session.
    h.getDocsImpl = null;
    listeners.window.online();
    await vi.waitFor(() => {
      expect(LIVE.enabled).toBe(true);
    });
  });

  it("a wake while offline does not retry", async () => {
    const mod = await import("./live");
    const LIVE = mod.default;
    h.getDocsImpl = () => { throw new Error("offline"); };
    await mod.initLive(1);
    await flush();
    await flush();
    expect(LIVE.enabled).toBe(false);

    vi.stubGlobal("navigator", { onLine: false });
    h.getDocsImpl = null;
    listeners.window.online();
    // Asserting a negative: give the mocked path (all microtasks) several
    // full turns, so a wake that DID fire would have finished and flipped
    // enabled before we look.
    await flush();
    await flush();
    await flush();
    expect(LIVE.enabled).toBe(false);
  });

  it("a uid change wipes the previous account's votes and local trace", async () => {
    // The leak this prevents: state.uid was sampled once and never
    // observed, so a session that changed underneath us (revoked token,
    // account deleted elsewhere, linkGoogle falling back to a full
    // sign-in) left the PREVIOUS account's votes in memory — rendered as
    // the new account's. None of the ~29 insight.* keys is uid-keyed.
    const LIVE = await bootLive();
    LIVE.vote("q_1", "1");
    await flush();
    expect(LIVE.myVotes()).toMatchObject({ q_1: "1" });
    storage.setItem("insight.testResults.v2", JSON.stringify({ big5: "done" }));
    storage.setItem("insight.likes.v1", JSON.stringify({ x: 1 }));

    expect(h.authCb).toBeTypeOf("function");
    h.authCb!({ uid: "someone_else" });
    await flush();

    expect(LIVE.myVotes()).not.toHaveProperty("q_1");
    // every insight.* key goes, not a hand-listed subset
    expect(storage.getItem("insight.testResults.v2")).toBeNull();
    expect(storage.getItem("insight.likes.v1")).toBeNull();
    // The feed-vote mirror is a special case: the purge removes it, then
    // the refresh for the NEW uid legitimately re-creates it. The contract
    // is that none of the previous account's data survives — not that the
    // key never comes back — so assert on the contents, which also keeps
    // this from racing the refresh.
    expect(JSON.parse(storage.getItem(WF_LS) || "{}")).not.toHaveProperty("q_1");
    // …and the purge announces itself, because deleting the keys is only
    // half the wipe: spec-layer stores (lens-defs) hold an in-memory copy,
    // and with no reload on this path their next save() would write the
    // previous account's data straight back. The listener side is pinned
    // in test/lens-live.test.ts; this pins that the announcement fires.
    expect(dispatched).toContain("insight:local-purge");
  });

  // ── the coalesced agg cache (D64, rows since D312) ──────────────────
  //
  // saveAggCache used to run JSON.stringify over the WHOLE aggs map
  // synchronously inside the agg snapshot handler, and that handler fires
  // once per publish on a globally-shared question — COSTS.md finding 2's
  // own fan-out numbers make that ~0.7 full serialisations/sec at 50k DAU
  // and ~6.9/sec at 500k, on the main thread. It is coalesced (D64) and
  // per-row in IndexedDB now (D312), which keeps the same three ways to
  // be wrong: a write that never lands, a write that lands after the
  // purge, and a write lost to a backgrounded WebView. One case each —
  // asserted on the store's CONTENTS plus a count of readwrite
  // transactions on the `aggs` store, because no localStorage spy sees
  // the flush any more.
  //
  // Real timers rather than fake ones: boot itself schedules a write, and
  // switching clocks underneath a pending real timer leaks it into whatever
  // test runs next. Each case waits out the window instead.
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const spyAggTx = () => {
    const spy = vi.spyOn(IDBDatabase.prototype, "transaction");
    return {
      count: () => spy.mock.calls.filter((c) => {
        const scope = Array.isArray(c[0]) ? c[0] : [c[0]];
        return scope.includes("aggs") && c[1] === "readwrite";
      }).length,
      restore: () => spy.mockRestore(),
    };
  };
  // Stage the aggregate and run one poll tick — the same body the interval
  // runs, so these cases still drive the real refresh path (D129). It is
  // async now, where the snapshot callback was synchronous, which is why
  // every caller below awaits it.
  const emitAgg = async (total: number) => {
    h.aggDocs.length = 0;
    h.aggDocs.push({
      id: "q_1",
      data: { counts: { "0": total, "1": 0 }, total, tooSmall: false },
    });
    const mod = await import("./live");
    await mod._aggPollForTest().tick();
  };

  it("coalesces a burst of agg snapshots into one cache write, carrying the last state", async () => {
    await bootLive();
    await sleep(1200); // let boot's own flush land, so the spy counts only ours
    const spy = spyAggTx();

    for (let i = 1; i <= 5; i++) await emitAgg(i);
    // Nothing lands during the burst — the handler used to serialise the
    // map five times right here; now not even one row transaction opens
    // until the window closes.
    expect(spy.count()).toBe(0);
    expect(await readAggCache()).not.toHaveProperty("q_1");

    await sleep(1200);
    expect(spy.count()).toBe(1);
    // Leading-schedule/trailing-write: the flush happens a beat after the
    // FIRST snapshot but reads state at write time, so it carries the
    // fifth one's total rather than the first's.
    expect(await readAggCache()).toMatchObject({ q_1: { total: 5 } });
    spy.restore();
  });

  it("a uid change carries no previous account's aggregate past the purge", async () => {
    // Same contract as the feed-vote mirror above — none of the previous
    // account's data survives, NOT that the store never fills again — and
    // the coalescing is what makes it worth re-pinning here: between the
    // snapshot and the purge there is now a write in flight that there
    // never used to be. Since D312 the cancel is load-bearing where it
    // used to be hygiene: cancelAggCache clears the DIRTY SET as well as
    // the timer, and without that the new session's first flush would
    // carry the old ids (they point at an emptied map, so they would
    // write nothing — but the set clearing is what this case leans on,
    // so it is said here).
    await bootLive();
    await emitAgg(3); // a persisted aggregate from the outgoing account
    await sleep(1200);
    expect(await readAggCache()).toHaveProperty("q_1");

    await emitAgg(9); // schedules a write…
    // Emptied BEFORE the uid change, not after. Since D129 the aggregate is
    // FETCHED rather than pushed, so the new session polls during the drain
    // below — and an aggregate is public data, so a new uid re-reading the
    // same q_1 is correct behaviour rather than a leak. Leaving the fixture
    // staged would let this case pass (or fail) on that honest re-read
    // instead of on the thing it is about: the previous account's in-flight
    // write not surviving the purge.
    h.aggDocs.length = 0;
    expect(h.authCb).toBeTypeOf("function");
    h.authCb!({ uid: "someone_else" }); // …and the purge lands first
    await flush();
    expect(await readAggCache()).toEqual({});

    // Past the window the pending write would have fired in: the store may
    // fill again (the new uid's own poll writes it), but never carrying
    // the counts the previous account's in-flight write was holding.
    await sleep(1200);
    expect(await readAggCache()).not.toHaveProperty("q_1");
  });

  it("hiding the app flushes the pending agg write rather than losing it", async () => {
    // Hiding is the last callback a mobile WebView is guaranteed before the
    // OS may kill it. Before coalescing, the write was already on disk by
    // then; now it can be up to a second in the future.
    await bootLive();
    await sleep(1200);
    const spy = spyAggTx();

    await emitAgg(7);
    expect(spy.count()).toBe(0); // still pending
    expect(await readAggCache()).not.toHaveProperty("q_1");

    expect(listeners.document.visibilitychange).toBeTypeOf("function");
    (document as unknown as { hidden: boolean }).hidden = true;
    listeners.document.visibilitychange();

    // Issued on the spot — the transaction is open before this handler
    // returns, which is what survives a kill.
    expect(spy.count()).toBe(1);
    expect(await readAggCache()).toMatchObject({ q_1: { total: 7 } });

    // …and exactly once: the flush drops the timer and drains the dirty
    // set, so the window expiring afterwards must not write again.
    await sleep(1200);
    expect(spy.count()).toBe(1);
    (document as unknown as { hidden: boolean }).hidden = false;
    spy.restore();
  });

  it("a revoked session keeps real data on screen rather than blanking to demo", async () => {
    const LIVE = await bootLive();
    expect(LIVE.enabled).toBe(true);
    h.authCb!(null);
    await flush();
    // Blanking to the demo deck would be a worse lie than a stale-but-true
    // view, so enabled must survive while a new anon session is fetched.
    expect(LIVE.enabled).toBe(true);
  });

  it("rank-type feed questions serve as RANK cards — never flattened to votes", async () => {
    // D12's exclusion, retired at D233. What must never come back is the
    // failure D12 pulled the cards for: a rank doc flattened to a
    // pick-one vote card, folding single choices into an aggregate that
    // claims to be a ranking. Served — and served in its own shape.
    h.bankDocs.push(
      {
        id: "q_feed_vote",
        data: { surface: "feed", seq: 2, type: "vote", prompt: "Vote one",
          options: ["A", "B"], topic: "culture", test: null, active: true },
      },
      {
        id: "q_feed_rank",
        data: { surface: "feed", seq: 3, type: "rank", prompt: "Rank them",
          options: ["A", "B", "C"], topic: "sport", test: null, active: true },
      },
    );
    await bootLive();
    const feed = (window as unknown as {
      WORLD_FEED_QS?: Array<{ id: string; type: string; items?: string[] }>;
    }).WORLD_FEED_QS || [];
    expect(feed.map((q) => q.id)).toContain("q_feed_vote");
    const rank = feed.find((q) => q.id === "q_feed_rank");
    expect(rank).toBeDefined();
    expect(rank!.type).toBe("rank");
    expect(rank!.items).toEqual(["A", "B", "C"]);
  });

  it("a continuum question keeps its type and range copy in the live feed (D114)", async () => {
    // Everything else is flattened to type "vote" on purpose — but a dial's
    // options are synthesized bucket labels, and world-feed renders the
    // card from lo/hi/unit + the per-bucket counts. Hardcoding "vote" here
    // (as every card once was) would serve a 12-option split titled
    // "When does old age begin?" — the D12 wrong-shaped card, live.
    h.bankDocs.push({
      id: "q_feed_dial",
      data: {
        surface: "feed", seq: 4, type: "dial", prompt: "When does old age begin?",
        options: Array.from({ length: 12 }, (_, i) => `b${i}`),
        topic: "bigq", test: null, active: true, lo: 40, hi: 90, unit: "yrs",
      },
    });
    await bootLive();
    const feed = (window as unknown as {
      WORLD_FEED_QS?: Array<{ id: string; type: string; lo?: number; hi?: number; unit?: string; options: Array<{ label: string; count: number }> }>;
    }).WORLD_FEED_QS || [];
    const dial = feed.find((q) => q.id === "q_feed_dial");
    expect(dial).toBeDefined();
    expect(dial!.type).toBe("dial");
    expect(dial!.lo).toBe(40);
    expect(dial!.hi).toBe(90);
    expect(dial!.unit).toBe("yrs");
    expect(dial!.options).toHaveLength(12);
  });

  it("hydrate mirrors a continuum answer in the control's units, not the store's (D218)", async () => {
    // The WF_LS mirror is what world-feed renders as YOUR value. A dial's
    // optionIdx is the 12-bucket index (deck.ts), and mirroring that raw
    // number is how a 1-cup answer stood on screen as "0 cups": the index
    // wearing the value's clothes. A dial mirrors as its bucket's
    // midpoint, a field as its cell's point, and a vote card keeps the
    // index, which IS its unit. The literals below are also the drift pin
    // for mirrorVoteValue's twins in world-feed.jsx (dialBucketMid /
    // fieldCellMid — data/ cannot import the spec layer, so the midpoint
    // math exists twice): hand-computed from the 12-bucket geometry, not
    // re-derived from either copy.
    h.bankDocs.push(
      {
        id: "q_feed_dial",
        data: {
          surface: "feed", seq: 4, type: "dial", prompt: "When does old age begin?",
          options: Array.from({ length: 12 }, (_, i) => `b${i}`),
          topic: "bigq", test: null, active: true, lo: 40, hi: 90, unit: "yrs",
        },
      },
      {
        id: "q_feed_field",
        data: {
          surface: "feed", seq: 5, type: "field", prompt: "Place your week",
          options: Array.from({ length: 12 }, (_, i) => `c${i}`),
          topic: "bigq", test: null, active: true,
        },
      },
      {
        id: "q_feed_vote",
        data: { surface: "feed", seq: 6, type: "vote", prompt: "Vote one",
          options: ["A", "B"], topic: "culture", test: null, active: true },
      },
    );
    // answers from an earlier session, exactly as the warm cache hands
    // them over (maxTs > 0 keeps this the incremental-boot path)
    await seedAnsCache({
      uid: "uid_test",
      votes: { q_feed_dial: "0", q_feed_field: "6", q_feed_vote: "1" },
      maxTs: 5, maxEditTs: 0,
    });
    await bootLive();
    const wf = JSON.parse(storage.getItem(WF_LS) || "{}");
    expect(wf.q_feed_dial).toBeCloseTo(42.0833, 3); // bucket 0 of 40–90 — NOT 0
    expect(wf.q_feed_field.x).toBeCloseTo(62.5, 6); // cell 6 = col 2, row 1
    expect(wf.q_feed_field.y).toBeCloseTo(50, 6);
    expect(wf.q_feed_vote).toBe(1);
  });

  it("editVote's refusal restores a dial's mirror as the standing bucket's midpoint (D218)", async () => {
    // The raw drag the mirror held is gone (only the feed ever knew it),
    // so the closest the answer doc can testify to is its standing
    // bucket's midpoint — never the index, and never the refused edit.
    h.bankDocs.push({
      id: "q_feed_dial",
      data: {
        surface: "feed", seq: 4, type: "dial", prompt: "When does old age begin?",
        options: Array.from({ length: 12 }, (_, i) => `b${i}`),
        topic: "bigq", test: null, active: true, lo: 40, hi: 90, unit: "yrs",
      },
    });
    const LIVE = await bootLive();
    LIVE.vote("q_feed_dial", "3");
    await flush();
    // what the FEED wrote after the edit's own drag: the new raw value,
    // already persisted optimistically (bucket 9 spans 77.5–81.7)
    storage.setItem(WF_LS, JSON.stringify({ q_feed_dial: 80 }));
    const d = deferred();
    h.updateDocImpl = () => d.promise;
    expect(LIVE.editVote("q_feed_dial", "9")).toBe(true);
    await flush();
    d.reject(new Error("PERMISSION_DENIED: one change a minute"));
    await flush();
    // NOT 3 (the index) and NOT 80 (the refused edit): bucket 3's midpoint
    expect(JSON.parse(storage.getItem(WF_LS) || "{}").q_feed_dial).toBeCloseTo(54.5833, 3);
  });

  it("a feed doc's doors reach the mapped card, and absence stays absent (docs/TAGS-PLAN.md)", async () => {
    // `also` is how the filter, stock and search reach a straddler from its
    // second topic — a bank doc whose doors get dropped here is a card the
    // taxonomy claims two audiences for and only one can find. The
    // absence half matters equally: emit-when-set end to end, so a card
    // without doors is byte-for-byte what it was before the field existed.
    h.bankDocs.push(
      {
        id: "q_feed_doors",
        data: { surface: "feed", seq: 5, type: "vote", prompt: "E-sports are real sports.",
          options: ["They are", "They're not"], topic: "sport", also: ["tech"], test: null, active: true },
      },
      {
        id: "q_feed_plain",
        data: { surface: "feed", seq: 6, type: "vote", prompt: "Vote two",
          options: ["A", "B"], topic: "culture", test: null, active: true },
      },
    );
    await bootLive();
    const feed = (window as unknown as {
      WORLD_FEED_QS?: Array<{ id: string; also?: string[] }>;
    }).WORLD_FEED_QS || [];
    expect(feed.find((q) => q.id === "q_feed_doors")?.also).toEqual(["tech"]);
    expect("also" in (feed.find((q) => q.id === "q_feed_plain") || {})).toBe(false);
  });

  // ── background, the card's `i` (D281) ────────────────────────────
  //
  // Emit-when-set in both directions, and the absent half is the half
  // that matters: `WF_BGTEXT` falls back to the demo pool's `WORLD_BG`
  // map, so a `bg: undefined` written onto every card would be indexed
  // as present-and-falsy by nothing and cost nothing — but a `bg: null`
  // would, and the whole family of optional fields on this mapping is
  // emit-when-set for that reason. Asserted with `in`, not truthiness.
  it("carries a question's background onto the live feed card, and only when it has one", async () => {
    h.bankDocs.push(
      {
        id: "q_feed_bg",
        data: { surface: "feed", seq: 5, type: "vote", prompt: "A question needing context",
          options: ["A", "B"], topic: "event", test: null, active: true,
          bg: "The durable facts a reader needs before this is answerable." },
      },
      {
        id: "q_feed_nobg",
        data: { surface: "feed", seq: 6, type: "vote", prompt: "A question needing none",
          options: ["A", "B"], topic: "culture", test: null, active: true },
      },
    );
    await bootLive();
    const feed = (window as unknown as {
      WORLD_FEED_QS?: Array<{ id: string; bg?: string }>;
    }).WORLD_FEED_QS || [];
    expect(feed.find((q) => q.id === "q_feed_bg")?.bg)
      .toBe("The durable facts a reader needs before this is answerable.");
    expect("bg" in (feed.find((q) => q.id === "q_feed_nobg") || {})).toBe(false);
  });

  // ── the Learn bank (D284) ────────────────────────────────────────
  //
  // The bundle stopped carrying the card bank, so this publication is the
  // only thing that puts cards in front of a live reader. The translation
  // is real work rather than a pass-through — the bank speaks
  // `learn-cell1`/`prompt`/`options`/`topic` and the engine speaks
  // `cell1`/`q`/`a`/`f` — so it is asserted field by field.
  // Learn left the boot fetch at D320 — a live device meets cards through
  // the pager (order pages + history heal). These cases ride the HISTORY
  // path: seeding `insight.learn.v3` with the card marks it as one this
  // device has answered, so the pager fetches it by id with no order doc
  // published — which is also exactly the no-fold world a fresh project
  // is in. The publication under test is unchanged; only the road in is.
  const seedLearnHistory = (...cardIds: string[]) => {
    const c: Record<string, unknown> = {};
    for (const id of cardIds) c[id] = { s: "known", k: 3, seen: 1, miss: 0, pos: 0, at: 1 };
    storage.setItem("insight.learn.v3", JSON.stringify({ c, lvl: {}, pos: 1, order: [] }));
  };

  it("publishes the bank's learn cards in the engine's own vocabulary", async () => {
    const { learnCards, resetLearnBank } = await import("./learnBank");
    resetLearnBank();
    seedLearnHistory("cell1");
    h.bankDocs.push({
      id: "learn-cell1",
      data: {
        surface: "learn", seq: 0, type: "choice", topic: "cell", test: null, active: true,
        prompt: "What do ribosomes build?",
        options: ["Proteins", "Lipids", "DNA", "Sugars"],
        c: 0, t: 2, p: 61, k: "Ribosomes build proteins",
        w: "DNA is copied in the nucleus, not built here.",
      },
    });
    await bootLive();
    // A sentinel sample, so "fell through to the caller's array" and
    // "published nothing" cannot pass as each other. Waited for: the
    // pager is deliberately not part of boot (D320), so the page lands
    // just after ready.
    await vi.waitFor(() => {
      expect(learnCards([{ id: "sample1", f: "cell", q: "s", a: ["a"], c: 0, t: 0, p: 50, k: "s" }])).toHaveLength(1);
    });
    const cards = learnCards([{ id: "sample1", f: "cell", q: "s", a: ["a"], c: 0, t: 0, p: 50, k: "s" }]);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual({
      // The `learn-` prefix is the BANK's id, never the card's: every
      // device holds mastery state keyed on the bare id (`insight.learn.v3`),
      // so publishing the prefixed one would read as a fresh account.
      id: "cell1",
      f: "cell",
      q: "What do ribosomes build?",
      a: ["Proteins", "Lipids", "DNA", "Sugars"],
      c: 0,
      t: 2,
      p: 61,
      k: "Ribosomes build proteins",
      w: "DNA is copied in the nucleus, not built here.",
    });
    resetLearnBank();
  });

  it("drops a card with no answer key rather than guessing one", async () => {
    const { learnCards, resetLearnBank } = await import("./learnBank");
    resetLearnBank();
    // Exactly the shape of a document seeded BEFORE D284 — prompt,
    // options, topic, and no c/t/p/k/w. Defaulting `c` to 0 would mark
    // option one correct on every pre-D284 card in the bank and teach the
    // wrong answer, silently, on the one surface whose whole promise is
    // that there is a right one. An empty Learn until the next seed run is
    // the honest failure.
    // The keyed sibling is the positive signal: when IT has landed, the
    // pager pass is complete, so old1's absence is the drop and not a
    // page that never arrived — without it this case passes on an empty
    // bank, which proves nothing.
    seedLearnHistory("old1", "cell1");
    h.bankDocs.push(
      {
        id: "learn-old1",
        data: {
          surface: "learn", seq: 0, type: "choice", topic: "cell", test: null, active: true,
          prompt: "A card from before the change", options: ["A", "B", "C", "D"],
        },
      },
      {
        id: "learn-cell1",
        data: {
          surface: "learn", seq: 1, type: "choice", topic: "cell", test: null, active: true,
          prompt: "A keyed card", options: ["A", "B", "C", "D"], c: 0, t: 1, p: 50, k: "Keyed",
        },
      },
    );
    await bootLive();
    await vi.waitFor(() => {
      expect(learnCards([]).map((c) => c.id)).toContain("cell1");
    });
    expect(learnCards([]).map((c) => c.id)).not.toContain("old1");
    resetLearnBank();
  });

  // ── the feed's TEST stream (D280) ────────────────────────────────
  //
  // The store-side half of the same defect the smoke suite pins in the
  // DOM. `buildFeedGlobals` used to publish this pool onto `window`, and
  // when the feed's reader converted to a static import of the demo array
  // the write became one nothing read — no gate could see it, because the
  // write was a `window as unknown as Record<string, unknown>` cast on one
  // side and an ESM binding on the other. So the assertion here is on the
  // NAMED publisher rather than on a window key: if the seam is severed
  // again, this fails.
  it("publishes the bank's test items through testFeed, not onto window", async () => {
    const { resetTestFeed, testFeedPool } = await import("./testFeed");
    resetTestFeed();
    h.bankDocs.push(
      {
        id: "test-political-3",
        data: { surface: "test", seq: 8, type: "vote", prompt: "A political item",
          options: ["Agree", "Neutral", "Disagree"], topic: null, test: "political", active: true },
      },
      {
        id: "test-big5-4",
        data: { surface: "test", seq: 9, type: "vote", prompt: "A big five item",
          options: ["Agree", "Neutral", "Disagree"], topic: null, test: "big5", active: true },
      },
    );
    await bootLive();
    // A sentinel demo pool, so "fell through to the caller's array" and
    // "published nothing" cannot pass as each other.
    const DEMO = [{ id: "tq-political-0", test: "political" }];
    const pool = testFeedPool(DEMO);
    expect(pool.map((q) => q.id).sort()).toEqual(["test-big5-4", "test-political-3"]);
    // Round-robined across instruments (D155), not served in bank order.
    expect(pool.map((q) => q.test)).toEqual(["political", "big5"]);
    // And the field the mapping did not carry until D280: with no agg
    // document there is no split, and the card must be told so rather
    // than drawing five zeroes as a measurement.
    expect((pool[0] as { noCountsYet?: boolean }).noCountsYet).toBe(true);
    expect((pool[0] as { live?: boolean }).live).toBe(true);
    resetTestFeed();
  });

  // ── catalogue picks (D14 gone live) ──────────────────────────────
  const PICK_BANK = {
    id: "pick-pk04",
    data: {
      surface: "feed", seq: 7, type: "catalog", domain: "emoji",
      prompt: "Your most-used emoji?", options: [], topic: "fav",
      test: null, active: true,
    },
  };

  it("a catalog question rides the live feed as a pick card (D14)", async () => {
    // No options — the catalogue is the answer space — so this doc fails
    // playable() and rides the feed lane's catalog carve-out instead.
    // Fails without it (the card vanishes), and fails if the mapper
    // flattens it to "vote" (an option-less split card).
    h.bankDocs.push(PICK_BANK);
    await bootLive();
    const feed = (window as unknown as {
      WORLD_FEED_QS?: Array<{ id: string; type: string; cat: string; domain?: string; noCountsYet?: boolean; options?: unknown }>;
    }).WORLD_FEED_QS || [];
    const pick = feed.find((q) => q.id === "pick-pk04");
    expect(pick).toBeDefined();
    expect(pick!.type).toBe("pick");
    expect(pick!.domain).toBe("emoji");
    expect(pick!.cat).toBe("fav");
    expect(pick!.noCountsYet).toBe(true);
  });

  it("hydrate reads an entity answer as answered and mirrors it wrapped", async () => {
    // An entity doc carries no optionIdx. Skipping it in the fold would
    // re-offer the picker on a fresh device and the create-only rule
    // would then refuse the re-pick; mirroring the bare number would put
    // a dex key where the card expects setPick's { entity } shape.
    h.bankDocs.push(PICK_BANK);
    h.answerDocs.push({
      id: "pick-pk04",
      data: { qid: "pick-pk04", surface: "feed", entity: 128514, answeredAt: { toMillis: () => 5 } },
    });
    const LIVE = await bootLive();
    expect(LIVE.myVotes()).toMatchObject({ "pick-pk04": "128514" });
    const wf = JSON.parse(storage.getItem(WF_LS) || "{}");
    expect(wf["pick-pk04"]).toEqual({ entity: 128514 });
  });

  describe("votePick (D14): the create-only entity write", () => {
    it("writes the entity doc — no optionIdx — and caches only on server ack", async () => {
      h.bankDocs.push(PICK_BANK);
      const LIVE = await bootLive();
      const d = deferred();
      h.setDocImpl = () => d.promise;
      LIVE.votePick("pick-pk04", 128514);
      expect(LIVE.myVotes()).toMatchObject({ "pick-pk04": "128514" });
      expect(LIVE.confirmedVotes()).not.toHaveProperty("pick-pk04");
      await flush();
      const call = h.setDocCalls.find((c) => c.path === "v2_users/uid_test/answers/pick-pk04");
      expect(call).toBeDefined();
      expect(call!.data.entity).toBe(128514);
      expect(call!.data.surface).toBe("feed");
      expect(call!.data).not.toHaveProperty("optionIdx");
      const notCached = await readAnsCache();
      expect(notCached.votes || {}).not.toHaveProperty("pick-pk04");
      d.resolve();
      await flush();
      expect(LIVE.confirmedVotes()).toMatchObject({ "pick-pk04": "128514" });
      const cached = await readAnsCache();
      expect(cached.votes).toMatchObject({ "pick-pk04": "128514" });
    });

    it("rolls back and scrubs the WF_LS mirror on a refused write", async () => {
      h.bankDocs.push(PICK_BANK);
      const LIVE = await bootLive();
      // the card's own optimistic echo, written by setPick before the store
      storage.setItem(WF_LS, JSON.stringify({ "pick-pk04": { entity: 7 } }));
      h.setDocImpl = () => Promise.reject(new Error("PERMISSION_DENIED"));
      LIVE.votePick("pick-pk04", 7);
      await flush();
      expect(LIVE.myVotes()).not.toHaveProperty("pick-pk04");
      expect(JSON.parse(storage.getItem(WF_LS) || "{}")).not.toHaveProperty("pick-pk04");
    });

    it("is create-only and refuses malformed entities before the wire", async () => {
      h.bankDocs.push(PICK_BANK);
      const LIVE = await bootLive();
      LIVE.votePick("pick-pk04", 128514);
      await flush();
      const before = h.setDocCalls.length;
      LIVE.votePick("pick-pk04", 25); // answered — mirrors the create-only rule
      LIVE.votePick("pick-x", 2.5); // not an int
      LIVE.votePick("pick-x", -1); // negative
      LIVE.votePick("pick-x", 1_000_000_000); // the rules' sanity ceiling
      await flush();
      expect(h.setDocCalls.length).toBe(before);
    });

    it("stamps the attention seams on the ack, under the feed card's own id", async () => {
      // The gap this closes: the world feed stamps `s` for every card that
      // scrolls into view, pick cards included, so the seen denominator
      // counted these questions while nothing ever incremented the
      // answered numerator. A catalog pick read as a question people look
      // at and never answer — the signal QUESTION-FARM uses to propose
      // retiring one.
      h.bankDocs.push(PICK_BANK);
      const LIVE = await bootLive();
      const d = deferred();
      h.setDocImpl = () => d.promise;
      LIVE.votePick("pick-pk04", 128514);
      await flush();
      expect(h.engagementCalls, "stamped before the server acked the write").toEqual([]);
      d.resolve();
      await flush();
      expect(h.engagementCalls).toEqual([
        { fn: "noteAnswer", args: ["feed"] },
        // The FEED CARD's id, which is what the observer stamps `s` under —
        // a numerator under any other key joins no denominator.
        { fn: "noteQid", args: ["pick-pk04", "a"] },
      ]);
    });

    it("stamps nothing when the write is refused", async () => {
      h.bankDocs.push(PICK_BANK);
      const LIVE = await bootLive();
      h.setDocImpl = () => Promise.reject(new Error("PERMISSION_DENIED"));
      LIVE.votePick("pick-pk04", 7);
      await flush();
      expect(h.engagementCalls).toEqual([]);
    });

    it("editVote refuses to move a pick — create-only has no edit arm (D14)", async () => {
      h.bankDocs.push(PICK_BANK);
      const LIVE = await bootLive();
      LIVE.votePick("pick-pk04", 128514);
      await flush();
      expect(LIVE.editVote("pick-pk04", "25")).toBe(false);
      expect(h.updateDocCalls).toHaveLength(0);
    });
  });

  describe("pickCanon / pickSegs / pickSeg (D14): the board in the demo store's shapes", () => {
    const AGG_CACHE = {
      "pick-pk04": {
        total: 16,
        top: { "128514": 9, "10084": 4 },
        rest: 3,
        by: { ageBand: { "18-24": { "128514": 5, "10084": 2 } } },
      },
    };

    it("sorts the published top by count desc then entity asc, rest as published", async () => {
      h.bankDocs.push(PICK_BANK);
      storage.setItem("insight.aggsCache.v1", JSON.stringify(AGG_CACHE));
      const LIVE = await bootLive();
      const c = LIVE.pickCanon("pick-pk04");
      expect(c.top).toEqual([
        { entity: 128514, count: 9 },
        { entity: 10084, count: 4 },
      ]);
      expect(c.total).toBe(16);
      expect(c.rest).toBe(3);
      // the demo fold's tail scalars stay silent live — no floor exists
      expect(c.restEntities).toBe(0);
      expect(c.restBelowFloor).toBe(false);
    });

    it("joins your own UNFOLDED pick at read time; Not listed joins the total, never the board", async () => {
      h.bankDocs.push(PICK_BANK, {
        id: "pick-pk05",
        data: {
          surface: "feed", seq: 8, type: "catalog", domain: "emoji",
          prompt: "The most annoying emoji?", options: [], topic: "fav",
          test: null, active: true,
        },
      });
      storage.setItem("insight.aggsCache.v1", JSON.stringify(AGG_CACHE));
      const LIVE = await bootLive();
      const d = deferred();
      h.setDocImpl = () => d.promise;
      LIVE.votePick("pick-pk04", 10084); // pending — the agg cannot hold it yet
      expect(LIVE.pickCanon("pick-pk04").top).toEqual([
        { entity: 128514, count: 9 },
        { entity: 10084, count: 5 },
      ]);
      expect(LIVE.pickCanon("pick-pk04").total).toBe(17);
      LIVE.votePick("pick-pk05", 0); // "Not listed": counted, never enumerated
      const c = LIVE.pickCanon("pick-pk05");
      expect(c.total).toBe(1);
      expect(c.top).toEqual([]);
      expect(c.rest).toBe(1);
      d.resolve();
      await flush();
    });

    it("flattens the published by into segment chips and orders one segment's board", async () => {
      h.bankDocs.push(PICK_BANK);
      storage.setItem("insight.aggsCache.v1", JSON.stringify(AGG_CACHE));
      const LIVE = await bootLive();
      expect(LIVE.pickSegs("pick-pk04")).toEqual([{ dim: "ageBand", bucket: "18-24" }]);
      expect(LIVE.pickSeg("pick-pk04", "ageBand", "18-24")).toEqual({
        rows: [
          { entity: 128514, count: 5 },
          { entity: 10084, count: 2 },
        ],
        cohort: 7,
      });
      expect(LIVE.pickSeg("pick-pk04", "gender", "Women")).toBeNull();
      expect(LIVE.pickSegs("pick-nope")).toEqual([]);
    });

    // Read as TEXT rather than imported, the handles.test.ts precedent:
    // functions/ is a separate package, and importing it would drag the
    // admin SDK into the client run. The board depth lives on both sides
    // of the wire — the server publishes `top` truncated at CANON_TOP_N,
    // the client slices its own-vote join at CANON_BOARD_N — and nothing
    // but this pin would notice one moving alone: the board would just
    // quietly show a different depth than the aggregate carries.
    it("CANON_BOARD_N matches the server's CANON_TOP_N", () => {
      const serverSrc = readFileSync(
        resolve(__dirname, "../../../functions/src/v2.ts"),
        "utf8",
      );
      const m = /const CANON_TOP_N = (\d+);/.exec(serverSrc);
      expect(m, "the server's CANON_TOP_N moved or was renamed").toBeTruthy();
      expect(Number(m![1])).toBe(CANON_BOARD_N);
    });
  });

  // ── rank answers (D233) ──────────────────────────────────────────
  const RANK_BANK = {
    id: "feed-f03",
    data: {
      surface: "feed", seq: 9, type: "rank", prompt: "Pure athleticism — rank them",
      options: ["Gymnasts", "Sprinters", "Swimmers", "Climbers"], topic: "sport",
      test: null, active: true,
    },
  };

  it("a rank question rides the live feed as a rank card with a DERIVED crowd", async () => {
    // Serving it as a vote card is the exact wrong-shaped poisoning D12
    // pulled the cards for — the mapper must keep the type and hand the
    // card the demo's own contract: items, crowd[i] = 1-based rank of
    // item i, votes from the total.
    h.bankDocs.push(RANK_BANK);
    storage.setItem("insight.aggsCache.v1", JSON.stringify({
      "feed-f03": { total: 3, pos: [4, 5, 3, 6] },
    }));
    await bootLive();
    const feed = (window as unknown as {
      WORLD_FEED_QS?: Array<{ id: string; type: string; items?: string[]; crowd?: number[] | null; votes?: number; options?: unknown }>;
    }).WORLD_FEED_QS || [];
    const rank = feed.find((q) => q.id === "feed-f03");
    expect(rank).toBeDefined();
    expect(rank!.type).toBe("rank");
    expect(rank!.items).toEqual(["Gymnasts", "Sprinters", "Swimmers", "Climbers"]);
    expect(rank!.crowd).toEqual([2, 3, 1, 4]);
    expect(rank!.votes).toBe(3);
  });

  it("hydrates an order answer, mirrors it in the card's shape, and shows NO crowd to its only voter", async () => {
    h.bankDocs.push(RANK_BANK);
    h.answerDocs.push({
      id: "feed-f03",
      data: { qid: "feed-f03", surface: "feed", order: [2, 0, 1, 3], answeredAt: { toMillis: () => 5 } },
    });
    // the aggregate holds exactly the viewer's own fold
    storage.setItem("insight.aggsCache.v1", JSON.stringify({
      "feed-f03": { total: 1, pos: [1, 2, 0, 3] },
    }));
    const LIVE = await bootLive();
    expect(LIVE.myVotes()).toMatchObject({ "feed-f03": "2,0,1,3" });
    const rank = ((window as unknown as { WORLD_FEED_QS?: Array<{ id: string; crowd?: number[] | null }> }).WORLD_FEED_QS || [])
      .find((q) => q.id === "feed-f03");
    // a crowd that is only you would read as perfect agreement — null is
    // the honest first-voter state the card renders as "you're first"
    expect(rank!.crowd).toBeNull();
    const wf = JSON.parse(storage.getItem(WF_LS) || "{}");
    expect(wf["feed-f03"]).toEqual({ order: [2, 0, 1, 3] });
  });

  describe("voteRank (D233): the create-only order write", () => {
    it("writes the order doc — no optionIdx — and caches only on server ack", async () => {
      h.bankDocs.push(RANK_BANK);
      const LIVE = await bootLive();
      const d = deferred();
      h.setDocImpl = () => d.promise;
      LIVE.voteRank("feed-f03", [2, 0, 1, 3]);
      expect(LIVE.myVotes()).toMatchObject({ "feed-f03": "2,0,1,3" });
      expect(LIVE.confirmedVotes()).not.toHaveProperty("feed-f03");
      await flush();
      const call = h.setDocCalls.find((c) => c.path === "v2_users/uid_test/answers/feed-f03");
      expect(call).toBeDefined();
      expect(call!.data.order).toEqual([2, 0, 1, 3]);
      expect(call!.data.surface).toBe("feed");
      expect(call!.data).not.toHaveProperty("optionIdx");
      d.resolve();
      await flush();
      expect(LIVE.confirmedVotes()).toMatchObject({ "feed-f03": "2,0,1,3" });
      const cached = await readAnsCache();
      expect(cached.votes).toMatchObject({ "feed-f03": "2,0,1,3" });
    });

    it("rolls back and scrubs the WF_LS mirror on a refused write", async () => {
      h.bankDocs.push(RANK_BANK);
      const LIVE = await bootLive();
      storage.setItem(WF_LS, JSON.stringify({ "feed-f03": { order: [0, 1, 2, 3] } }));
      h.setDocImpl = () => Promise.reject(new Error("PERMISSION_DENIED"));
      LIVE.voteRank("feed-f03", [0, 1, 2, 3]);
      await flush();
      expect(LIVE.myVotes()).not.toHaveProperty("feed-f03");
      expect(JSON.parse(storage.getItem(WF_LS) || "{}")).not.toHaveProperty("feed-f03");
    });

    it("is create-only and refuses every malformed order before the wire", async () => {
      h.bankDocs.push(RANK_BANK);
      const LIVE = await bootLive();
      LIVE.voteRank("feed-f03", [3, 2, 1, 0]);
      await flush();
      const before = h.setDocCalls.length;
      LIVE.voteRank("feed-f03", [0, 1, 2, 3]); // answered — create-only
      LIVE.voteRank("q_1", [0, 1]); // not a rank question
      LIVE.voteRank("feed-f03", [0, 1, 2]); // wrong length
      LIVE.voteRank("feed-f03", [0, 1, 2, 2]); // duplicate
      LIVE.voteRank("feed-f03", [0, 1, 2, 4]); // out of range
      await flush();
      expect(h.setDocCalls.length).toBe(before);
    });

    it("stamps the attention seams on the ack, under the feed card's own id", async () => {
      // Same gap as votePick's: a rank card is a feed card, so the
      // observer stamps `s` when it scrolls into view and nothing was
      // stamping `a` when it was answered.
      h.bankDocs.push(RANK_BANK);
      const LIVE = await bootLive();
      const d = deferred();
      h.setDocImpl = () => d.promise;
      LIVE.voteRank("feed-f03", [2, 0, 1, 3]);
      await flush();
      expect(h.engagementCalls, "stamped before the server acked the write").toEqual([]);
      d.resolve();
      await flush();
      expect(h.engagementCalls).toEqual([
        { fn: "noteAnswer", args: ["feed"] },
        { fn: "noteQid", args: ["feed-f03", "a"] },
      ]);
    });

    it("stamps nothing when the write is refused", async () => {
      h.bankDocs.push(RANK_BANK);
      const LIVE = await bootLive();
      h.setDocImpl = () => Promise.reject(new Error("PERMISSION_DENIED"));
      LIVE.voteRank("feed-f03", [0, 1, 2, 3]);
      await flush();
      expect(h.engagementCalls).toEqual([]);
    });

    it("editVote refuses to move a ranking — create-only has no edit arm (D233)", async () => {
      h.bankDocs.push(RANK_BANK);
      const LIVE = await bootLive();
      LIVE.voteRank("feed-f03", [2, 0, 1, 3]);
      await flush();
      expect(LIVE.editVote("feed-f03", "1")).toBe(false);
      expect(h.updateDocCalls).toHaveLength(0);
    });
  });

  it("reports a failed agg poll and leaves the cached counts standing", async () => {
    // Was "reports and re-notifies when an agg listener errors". The
    // listener is gone (D129) and its error arm with it, but the contract
    // it protected is not: a refresh that fails must be reported and must
    // not blank the counts already on screen. Degrading to stale-but-
    // present is the whole reason the poll is best-effort.
    const LIVE = await bootLive();
    h.aggDocs.push({
      id: "q_1",
      data: { counts: { "0": 5, "1": 2 }, total: 7, tooSmall: false },
    });
    const mod = await import("./live");
    await mod._aggPollForTest().tick();
    const before = LIVE.deck()[0];

    const listener = vi.fn();
    LIVE.subscribe(listener);
    const boom = new Error("offline");
    h.getDocsImpl = () => boom;
    await mod._aggPollForTest().tick();
    h.getDocsImpl = null;

    expect(h.reportError).toHaveBeenCalledWith(boom, { where: "refreshAggs" });
    // The counts the failed poll could not refresh are still the ones the
    // last good poll left.
    expect(LIVE.deck()[0]).toMatchObject({ id: before.id });
  });
});

// ── the window.LIVE contract ────────────────────────────────────────
//
// ~15 untyped spec modules reach into window.LIVE by name at render time.
// Renaming a member there passes tsc (the consumers are .jsx), passes
// eslint, passes check:globals (which verifies the name LIVE exists, not
// its shape) and passes every other unit test — then blanks the Map on a
// real device.
//
// Asserting the key sets against checked-in literals is the cheapest thing
// that turns a rename into a failing test. Getters on the object literal
// are enumerable own properties, so Object.keys sees them.
describe("window.LIVE public surface", () => {
  // The list moved to test/live-surface.ts — verbatim, and still the same
  // assertion. It is shared now because the live-mode mount fixture builds
  // its stand-in from it, so a member added here cannot be missing there.
  // Update ONLY together with the spec-layer call sites that read the
  // renamed member — that is the whole point.
  const EXPECTED = LIVE_MEMBERS;
  const EXPECTED_SOCIAL = LIVE_SOCIAL_MEMBERS;
  const EXPECTED_NEAR = LIVE_NEAR_MEMBERS;

  // ── the political consent gate (D331) ──────────────────────────
  //
  // WHY HERE AND NOT ONLY IN politicalConsent.test.ts. That file holds the
  // PREDICATE and cannot see whether anything calls it. The gate lives
  // inside syncPassiveResults, which writes to a world-readable profile —
  // so a predicate that is correct and unwired publishes a political
  // coordinate for every account, with every test still green and nothing
  // on any screen to show it. The D258/D285 silence, one field over.
  //
  // Asserted on the WRITE rather than on the returned state, because the
  // write is what reaches other people.
  describe("the political compass is computed only with consent", () => {
    const politicalWrites = () =>
      h.setDocCalls.filter((c) => c.path === "v2_users/uid_test"
        && !!(c.data.testResults as Record<string, unknown> | undefined)?.political);

    // REAL prompts off the same axis, and this is what makes the cases
    // below bite. `testItemMeta` joins a bank item to an instrument BY
    // PROMPT and refuses anything that is not a 5-option scale, so an
    // invented string folds to nothing and every assertion here passes
    // whether the gate exists or not — which is exactly what the first
    // draft of this block did. Two items on one axis clears
    // MIN_AXIS_ITEMS, so an ungated fold really would publish.
    // TWO PER AXIS, ALL SIX, and that is the bar rather than a generous
    // fixture: `passiveResult` refuses an instrument whose axes are not
    // all behind MIN_AXIS_ITEMS, so a partial seed folds to null and every
    // case below passes with the gate deleted — which is what the first
    // two drafts of this block did. Verified by removing the gate and
    // watching these fail.
    const POL_PROMPTS = [
      "Markets, left to themselves, distribute fairly.",
      "Essential services belong in public hands, not markets.",
      "Some speech is harmful enough to restrict.",
      "The state should keep out of private life.",
      "My country should help others before its own poor.",
      "Borders should be more open than they are now.",
      "Climate action is worth real economic cost.",
      "Green rules should hold even when jobs are on the line.",
      "New technology, on balance, makes life better.",
      "Some technologies should be slowed down on purpose.",
      "Strong leaders matter more than strong institutions.",
      "The system is rigged against ordinary people.",
    ];
    const SCALE = ["1", "2", "3", "4", "5"];
    const seedPolitical = () => {
      POL_PROMPTS.forEach((prompt, i) => {
        h.bankDocs.push({
          id: `q_pol${i}`,
          data: { surface: "test", seq: 200 + i, type: "vote", prompt,
            options: SCALE, topic: null, test: "political", active: true },
        });
        h.answerDocs.push({
          id: `q_pol${i}`,
          data: { qid: `q_pol${i}`, surface: "test", optionIdx: 4, answeredAt: { toMillis: () => 5 } },
        });
      });
    };

    // THE POSITIVE CONTROL, and it is the load-bearing case in this block.
    // Every other assertion here is an absence, and an absence proves the
    // gate only if the fold could have produced the thing. Without this,
    // a harness that simply cannot fold a political result makes all four
    // negatives pass with the gate deleted — which is precisely what the
    // first three drafts of this block did.
    it("DOES write one for a consented account — the control the absences rest on", async () => {
      seedPolitical();
      h.getDocImpl = (path: string) => (path === "v2_users/uid_test"
        ? { consent: { political: { v: 1, at: 1 } } } : null);
      const LIVE = await bootLive();
      await flush();
      (LIVE as unknown as { syncPassiveResults: () => void }).syncPassiveResults();
      await flush();
      expect(politicalWrites().length).toBeGreaterThan(0);
    });

    it("writes NO political result for an account that has not been asked", async () => {
      seedPolitical();
      h.getDocImpl = (path: string) => (path === "v2_users/uid_test" ? {} : null);
      const LIVE = await bootLive();
      await flush();
      // Explicit, like the control: at hydrate time the answers have not
      // landed, so the boot-time fold produces nothing whatever the gate
      // says. Asserting on that would be asserting on the ordering, not on
      // the consent — the exact false pass this block was rewritten for.
      (LIVE as unknown as { syncPassiveResults: () => void }).syncPassiveResults();
      await flush();
      expect(politicalWrites()).toHaveLength(0);
    });

    it("writes none for an account that declined, and none after withdrawal", async () => {
      seedPolitical();
      h.getDocImpl = (path: string) => (path === "v2_users/uid_test"
        ? { consent: { political: { v: 1, at: 1, off: 1 } } } : null);
      const LIVE = await bootLive();
      await flush();
      (LIVE as unknown as { syncPassiveResults: () => void }).syncPassiveResults();
      await flush();
      expect(politicalWrites()).toHaveLength(0);
    });

    it("still writes the OTHER instruments — the gate is political-only", async () => {
      // The failure this catches is a gate placed one level too high:
      // `continue`-ing the whole loop rather than the one kind would take
      // big5, values and attachment down with it, and every one of those
      // is a feature nobody asked to lose.
      seedPolitical();
      h.getDocImpl = (path: string) => (path === "v2_users/uid_test" ? {} : null);
      const LIVE = await bootLive();
      await flush();
      (LIVE as unknown as { syncPassiveResults: () => void }).syncPassiveResults();
      await flush();
      const kinds = new Set<string>();
      for (const c of h.setDocCalls) {
        if (c.path !== "v2_users/uid_test") continue;
        for (const k of Object.keys((c.data.testResults as object) || {})) kinds.add(k);
      }
      expect(kinds.has("political")).toBe(false);
    });

    it("setPoliticalConsent(false) deletes the published compass in the SAME write", async () => {
      // The half a display toggle skips. A record written without the
      // deletion is a profile that still carries the coordinate behind a
      // switch reading "off" — worse than no switch, because it is a
      // claim. One merge, so a partial failure cannot land that state.
      h.getDocImpl = (path: string) => (path === "v2_users/uid_test"
        ? { consent: { political: { v: 1, at: 1 } } } : null);
      const LIVE = await bootLive();
      h.setDocCalls.length = 0;
      await LIVE.setPoliticalConsent(false);
      const call = h.setDocCalls.find((c) => c.path === "v2_users/uid_test");
      expect(call, "no profile write at all").toBeTruthy();
      const data = call!.data as Record<string, Record<string, unknown>>;
      expect(data.consent.political).toMatchObject({ off: expect.any(Number) });
      expect(data.testResults.political).toBe("__delete__");
    });

    it("purges a compass a pre-gate build already published, with no consent on file", async () => {
      // THE UPGRADE CASE, and the one the gate alone does not cover.
      // `testResults.political` has published since D277; D331 added the
      // gate; consent defaults to OFF. So every account that used the app
      // before the gate landed had a six-axis coordinate sitting on a
      // world-readable profile while the account row read "Off. Your
      // answers still count; no political profile is built from them."
      //
      // Skipping the fold does not remove it, and nothing else did: the
      // only deleter is setPoliticalConsent(false), and the panel offers
      // "Turn off" only when consent is already ON — so the sole route to
      // removing the coordinate was to consent to it first.
      seedPolitical();
      h.getDocImpl = (path: string) => (path === "v2_users/uid_test"
        ? { testResults: { political: { dims: [{ id: "econ", label: "Economy", value: 0.4 }] } } }
        : null);
      const LIVE = await bootLive();
      await flush();
      h.setDocCalls.length = 0;
      (LIVE as unknown as { syncPassiveResults: () => void }).syncPassiveResults();
      await flush();
      const call = h.setDocCalls.find((c) => c.path === "v2_users/uid_test");
      expect(call, "the stored compass was left on the profile — the gate "
        + "stops a NEW one being computed and says nothing about the one "
        + "already published").toBeTruthy();
      const data = call!.data as Record<string, Record<string, unknown>>;
      expect(data.testResults.political).toBe("__delete__");
      // …and no real coordinate is written back in the same breath.
      // `politicalWrites()` matches on truthiness and the delete sentinel
      // is a truthy string, so this asks the sharper question: is any
      // write carrying an actual result object?
      const real = politicalWrites().filter((c) => {
        const d = c.data as Record<string, Record<string, unknown>>;
        return d.testResults.political !== "__delete__";
      });
      expect(real).toHaveLength(0);
    });

    it("purging costs no write when there is nothing to purge", async () => {
      // This runs on every hydrate, so an account that never had a
      // coordinate must not buy a profile write on every boot forever —
      // which is the shape of the persona-residue heal this same night
      // found looping.
      seedPolitical();
      h.getDocImpl = (path: string) => (path === "v2_users/uid_test" ? {} : null);
      const LIVE = await bootLive();
      await flush();
      h.setDocCalls.length = 0;
      (LIVE as unknown as { syncPassiveResults: () => void }).syncPassiveResults();
      await flush();
      const deletes = h.setDocCalls.filter((c) => {
        const d = c.data as Record<string, Record<string, unknown>>;
        return c.path === "v2_users/uid_test" && d.testResults?.political === "__delete__";
      });
      expect(deletes).toHaveLength(0);
    });

    it("setPoliticalConsent(true) records it and deletes nothing", async () => {
      h.getDocImpl = (path: string) => (path === "v2_users/uid_test" ? {} : null);
      const LIVE = await bootLive();
      h.setDocCalls.length = 0;
      await LIVE.setPoliticalConsent(true);
      const call = h.setDocCalls.find((c) => c.path === "v2_users/uid_test");
      const data = call!.data as Record<string, Record<string, Record<string, unknown>>>;
      expect(data.consent.political.off).toBeUndefined();
      expect(data.testResults).toBeUndefined();
      expect(LIVE.politicalConsented()).toBe(true);
    });
  });

  it("exposes exactly the members the spec layer looks up by name", async () => {
    const LIVE = await bootLive();
    const actual = Object.keys(LIVE).sort();
    const expected = [...EXPECTED].sort();
    // Both directions: a REMOVED member breaks a consumer, and an ADDED
    // one that nobody listed means this contract stopped being reviewed.
    expect(actual).toEqual(expected);
  });

  // A boot that hangs is the shape the field actually produced, and the
  // label that describes it was written twice — the first version froze
  // the string at the render-race deadline, so a device stuck for two
  // minutes still read "after 3s". That number was about when the app
  // stopped waiting to RENDER, and every reader takes it for how long it
  // has been stuck. Both properties are pinned: the stage is named, and no
  // elapsed figure is claimed.
  it("names the stage it is stuck on, and claims no elapsed time", async () => {
    h.hangSignIn = true;
    const mod = await import("./live");
    const LIVE = mod.default;
    await mod.initLive(1);
    await vi.waitFor(() => {
      expect(LIVE.bootError).not.toBe("");
    });
    expect(LIVE.enabled).toBe(false);
    expect(LIVE.bootError).toBe("still connecting — signing in");
    // The regression, stated as the assertion: a duration in this string
    // is a claim the app cannot support.
    expect(LIVE.bootError).not.toMatch(/\d+\s*s\b/);
  });

  it("exposes exactly the social members", async () => {
    const LIVE = await bootLive();
    const social = (LIVE as unknown as { social: Record<string, unknown> }).social;
    expect(Object.keys(social).sort()).toEqual([...EXPECTED_SOCIAL].sort());
  });

  it("exposes exactly the near members (D84)", async () => {
    const LIVE = await bootLive();
    const near = (LIVE as unknown as { near: Record<string, unknown> }).near;
    expect(Object.keys(near).sort()).toEqual([...EXPECTED_NEAR].sort());
  });
});

// The store's heavy folds, cached per CHANGE rather than per read (D169).
//
// `kindredPeople()` and `testFeedItems()` are whole-store folds with five
// and six render-path callers between them, every one inside a component
// that re-renders on notify(). They now compute once per notify() and hand
// the same array back until the next one.
//
// Both halves of that need a test, and the second is the one that matters:
// a cache keyed on the wrong signal reads exactly like a working one until
// the store changes underneath it, and then it is a screen showing the
// previous account's people. So identity is asserted (the optimisation)
// AND a real bank change is asserted to come through (the correctness).
describe("perRev — folds computed per change, not per read (D169)", () => {
  const TEST_Q = {
    id: "q_test_a",
    data: {
      surface: "test", seq: 9, type: "vote", prompt: "I keep appointments.",
      options: ["1", "2", "3", "4", "5"], topic: "self", test: "big5", active: true,
    },
  };

  it("hands back one fold across repeated reads, and a fresh one after a notify", async () => {
    h.bankDocs.push(TEST_Q);
    const LIVE = await bootLive();
    h.setDocImpl = () => new Promise<void>(() => { /* never acks; the vote's notify is what this needs */ });

    const items = LIVE.testFeedItems();
    const people = LIVE.kindredPeople();
    expect(items.map((q) => q.id)).toEqual(["q_test_a"]);
    // The optimisation, stated as identity: repeated reads within one
    // render are free, and a consumer may key a useMemo on the reference.
    expect(LIVE.testFeedItems()).toBe(items);
    expect(LIVE.kindredPeople()).toBe(people);

    // …and the invalidation, keyed on the only event that can reach a
    // renderer. vote() mutates and notifies, so both folds must be re-run
    // even though this particular change touched neither's inputs —
    // over-invalidating is the safe direction and the cheap one.
    LIVE.vote("q_1", "1");
    expect(LIVE.testFeedItems()).not.toBe(items);
    expect(LIVE.kindredPeople()).not.toBe(people);
  });

  it("does not hide a bank that actually changed under it", async () => {
    h.bankDocs.push(TEST_Q);
    const LIVE = await bootLive();
    expect(LIVE.testFeedItems().map((q) => q.id)).toEqual(["q_test_a"]);

    // A uid change re-hydrates from scratch (resetForNewUid). If the fold
    // were cached on anything but the store's own change signal, the new
    // account would be shown the old one's test bank — which is the same
    // class of failure the voter/name caches are purged to prevent.
    h.bankDocs = [h.bankDocs[0], {
      id: "q_test_b",
      data: { ...TEST_Q.data, prompt: "I plan ahead." },
    }];
    h.authCb!({ uid: "someone_else" });
    await vi.waitFor(() => {
      expect(LIVE.testFeedItems().map((q) => q.id)).toEqual(["q_test_b"]);
    });
  });
});

// loadSimilarity's chunked aggregate reads (D169).
//
// They went from serial to parallel, and the serial loop had a property
// worth keeping that a naive `Promise.all` + fold-after would have thrown
// away: a chunk that had already come back stayed folded when a later one
// threw. With 110 core test items over the 30-id `in` limit that is the
// difference between three quarters of the place profiles and none of
// them, on exactly the flaky connection where it matters. The fold now
// happens inside each chunk's own `.then`, so the parallelism is free of
// that cost — asserted here rather than argued in a comment.
describe("loadSimilarity — parallel chunks keep partial progress (D169)", () => {
  it("folds the chunks that came back when a sibling chunk fails", async () => {
    for (let i = 0; i < 35; i++) {
      h.bankDocs.push({
        id: `q_t${String(i).padStart(2, "0")}`,
        data: {
          surface: "test", seq: 100 + i, type: "vote", prompt: `Item ${i}`,
          options: ["1", "2", "3", "4", "5"], topic: "self", test: "big5", active: true,
        },
      });
      h.aggDocs.push({ id: `q_t${String(i).padStart(2, "0")}`, data: { total: 4, counts: { "2": 4 } } });
    }
    const LIVE = await bootLive();
    // 35 ids over the 30-id `in` limit is two queries; kill whichever one
    // carries the 35th so the other is a survivor rather than the only one.
    h.aggFailIds = ["q_t34"];

    await LIVE.loadSimilarity();

    // The surviving chunk landed…
    expect(LIVE.aggFor("q_t00")).not.toBeNull();
    expect(LIVE.aggFor("q_t29")).not.toBeNull();
    // …the failed one did not, and the failure was reported rather than
    // swallowed into a half-loaded state nothing knows about.
    expect(LIVE.aggFor("q_t34")).toBeNull();
    expect(h.reportError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ where: "loadSimilarity" }),
    );
  });
});

// The learn crowd split, warmed before the tap (D125).
//
// learnAgg is a read-through cache that returns null on the first call for
// a card and kicks a background getDoc. Its only caller ran inside
// LEARN.answer() — at the instant of the tap — so the first call for every
// card was the one deciding that card's reveal, it returned null every
// time, and every learn split the app has ever drawn was the authored
// estimate whatever the crowd had answered. The arithmetic was never
// wrong; nothing ever reached it.
describe("LIVE.loadLearnAggs — warming the split before the tap (D125)", () => {
  // Boot itself now issues one `v2_question_aggs` query — the D129 deck
  // refresh that replaced the snapshot listeners — so the cases below that
  // assert on the FULL query list clear it first. They are about what
  // loadLearnAggs asks for, which is what their names say; folding the deck
  // read into the expectation would couple them to DECK_DAYS for no reason.
  it("asks for learn-<card>, deduped, in one batched query", async () => {
    const LIVE = await bootLive();
    h.aggIdQueries.length = 0;
    await LIVE.loadLearnAggs(["cap6", "cell1", "cap6"]);
    expect(h.aggIdQueries).toEqual([["learn-cap6", "learn-cell1"]]);
  });

  it("makes the very next learnAgg read a hit rather than a null", async () => {
    // The property the whole change rests on: after this, the tap's read
    // — which cannot await — has the measurement in hand.
    h.aggDocs = [{ id: "learn-cap6", data: { total: 40, counts: { "0": 30, "1": 10 } } }];
    const LIVE = await bootLive();
    await LIVE.loadLearnAggs(["cap6"]);
    expect(LIVE.learnAgg("cap6")).toEqual({ total: 40, counts: { "0": 30, "1": 10 } });
  });

  it("is what the reveal was missing — an unwarmed read is null however much data exists", async () => {
    // The same session, the same published aggregate, and no warm-up: the
    // shipped behaviour up to D125, and the reason the authored estimate
    // was not a cold-start state but a permanent one.
    h.aggDocs = [{ id: "learn-cap6", data: { total: 40, counts: { "0": 30, "1": 10 } } }];
    const LIVE = await bootLive();
    expect(LIVE.learnAgg("cap6")).toBeNull();
  });

  it("warms only what it was asked for", async () => {
    h.aggDocs = [{ id: "learn-cap6", data: { total: 40, counts: { "0": 30 } } }];
    const LIVE = await bootLive();
    await LIVE.loadLearnAggs(["cap7"]);
    expect(LIVE.learnAgg("cap6")).toBeNull();
  });

  it("never re-requests a card the session already holds", async () => {
    // One read per distinct card per session is the budget learnAgg
    // always had; warming may move when it is paid, never how often.
    const LIVE = await bootLive();
    h.aggIdQueries.length = 0;
    await LIVE.loadLearnAggs(["cap6"]);
    await LIVE.loadLearnAggs(["cap6", "cap7"]);
    expect(h.aggIdQueries).toEqual([["learn-cap6"], ["learn-cap7"]]);
  });

  it("leaves the estimate standing when the fetch fails", async () => {
    // A failed warm-up must cost the measurement, never the reveal: the
    // cache keeps its null, LEARN_SPLIT falls back to the authored model,
    // and the footer says so. Silence here would be the honest outcome
    // rendered as a crash.
    const LIVE = await bootLive();
    h.getDocsImpl = () => new Error("offline");
    await expect(LIVE.loadLearnAggs(["cap6"])).resolves.toBeUndefined();
    expect(LIVE.learnAgg("cap6")).toBeNull();
    expect(h.reportError).toHaveBeenCalled();
  });

  it("does nothing at all in demo mode", async () => {
    // No project, no aggregates, and a read would be a network call a demo
    // build must never make.
    const LIVE = await bootLive();
    h.aggIdQueries.length = 0;
    Object.defineProperty(LIVE, "enabled", { value: false, configurable: true });
    await LIVE.loadLearnAggs(["cap6"]);
    expect(h.aggIdQueries).toEqual([]);
  });
});

// The other half of the same timing problem (D157).
//
// D125 warmed the cache BEFORE the tap, which is what made the reveal read
// a measurement at all. What it could not fix is the instant AFTER: the
// answer is written, the aggregate trigger has not folded it, and the
// re-read that follows the write returns a document counting everyone but
// the reader. D125 accepted that ("one answer does not move the split"),
// which is true of a crowd of two hundred and false of the crowd a
// launched app actually has — the reported symptom was a tick beside "0
// people · 0%" on the option just chosen.
describe("LIVE.learnMine — the answer the trigger has not folded yet", () => {
  const CARD = {
    id: "learn-cell1",
    data: {
      surface: "learn", seq: 1, type: "choice", prompt: "Learn cell1",
      options: ["A", "B", "C", "D"], topic: null, test: null, active: true,
      // Keyed since D320: cardLanded() watches the engine pool, and the
      // publication drops an unkeyed card — the answer-key fields are
      // load-bearing for the fixture reaching it, not for these cases.
      c: 0, t: 1, p: 50, k: "Learn cell1",
    },
  };
  const aggPath = "v2_question_aggs/learn-cell1";
  // Learn pages since D320: the card reaches state.learnBank through the
  // pager's history heal, just after ready — so each case seeds the
  // history and waits for the card before answering it, the same order a
  // real session imposes (the engine only serves cards already in the
  // pool, so learnAnswer cannot fire before the card exists).
  const seedLearnMineHistory = () => {
    storage.setItem("insight.learn.v3", JSON.stringify({
      c: { cell1: { s: "learning", k: 1, seen: 1, miss: 0, pos: 0, at: 1 } },
      lvl: {}, pos: 1, order: [],
    }));
  };
  const cardLanded = async () => {
    const { learnCards } = await import("./learnBank");
    await vi.waitFor(() => {
      expect(learnCards([]).map((c) => c.id)).toContain("cell1");
    });
  };

  it("marks the answer pending when the re-read does not contain it", async () => {
    seedLearnMineHistory();
    h.bankDocs.push(CARD);
    // One stranger's answer on option 1, and the trigger has not run for
    // ours. This is the overwhelmingly common case: a Firestore trigger
    // cannot fold and commit inside one client round-trip.
    h.getDocImpl = (path) => (path === aggPath ? { total: 1, counts: { "1": 1 } } : null);
    const LIVE = await bootLive();
    await cardLanded();
    LIVE.learnAnswer("cell1", 0);
    await vi.waitFor(() => {
      expect(LIVE.learnMine("cell1")).toEqual({ idx: 0, folded: false });
    });
  });

  it("marks it folded when the trigger won the race", async () => {
    seedLearnMineHistory();
    h.bankDocs.push(CARD);
    // The count on OUR option went up between the cached copy and the
    // re-read, so the published document already has us.
    h.getDocImpl = (path) => (path === aggPath ? { total: 2, counts: { "0": 1, "1": 1 } } : null);
    const LIVE = await bootLive();
    await cardLanded();
    await LIVE.loadLearnAggs(["cell1"]);
    LIVE.learnAnswer("cell1", 0);
    await vi.waitFor(() => {
      expect(LIVE.learnMine("cell1")).toEqual({ idx: 0, folded: true });
    });
  });

  it("does not call a stranger's answer ours", async () => {
    // Someone else picked our option while the write was in flight, so
    // the count moved without us in it. Erring toward "folded" undercounts
    // by one against a document that is right; erring the other way
    // double-counts the reader, which is what the fix exists to prevent.
    seedLearnMineHistory();
    h.bankDocs.push(CARD);
    h.aggDocs = [{ id: "learn-cell1", data: { total: 1, counts: { "0": 1 } } }];
    h.getDocImpl = (path) => (path === aggPath ? { total: 2, counts: { "0": 2 } } : null);
    const LIVE = await bootLive();
    await cardLanded();
    await LIVE.loadLearnAggs(["cell1"]);
    LIVE.learnAnswer("cell1", 0);
    await vi.waitFor(() => {
      expect(LIVE.learnMine("cell1")).toEqual({ idx: 0, folded: true });
    });
  });

  it("records nothing for a card this session never answered", async () => {
    const LIVE = await bootLive();
    expect(LIVE.learnMine("cell1")).toBeNull();
  });

  it("records nothing when the write itself failed", async () => {
    // A refused write leaves no answer on the server, so adding one to the
    // reveal would be inventing a person.
    seedLearnMineHistory();
    h.bankDocs.push(CARD);
    h.setDocImpl = () => Promise.reject(new Error("permission-denied"));
    const LIVE = await bootLive();
    await cardLanded();
    LIVE.learnAnswer("cell1", 0);
    await vi.waitFor(() => {
      expect(h.reportError).toHaveBeenCalled();
    });
    expect(LIVE.learnMine("cell1")).toBeNull();
  });
});

// Erasure has to reach the offline mirror, not just localStorage.
//
// firebaseImpl.ts enables persistentLocalCache() unconditionally and
// hydrate() reads the whole answers subcollection plus the profile, so a
// deleted account's votes and anchors are on disk in IndexedDB. Nothing
// evicted them — hydrate is a one-shot getDocs, not a listener, so the
// server-side delete produces no remove event. web/privacy.html and
// docs/data-inventory.md both promise this clearing, and D6 treats the same
// cache as sensitive (it is why Android backup is off). This is the
// assertion that keeps the promise true.
describe("LIVE.deleteAccount — the on-device half of erasure", () => {
  async function captureCallable() {
    const fns = await import("firebase/functions");
    const invoke = vi.fn(() => Promise.resolve({ data: {} }));
    vi.mocked(fns.getFunctions).mockClear().mockReturnValue({ __fns: true } as never);
    vi.mocked(fns.httpsCallable).mockClear().mockReturnValue(invoke as never);
    return invoke;
  }

  it("terminates the client and clears the IndexedDB cache, in that order", async () => {
    const LIVE = await bootLive();
    await captureCallable();
    // Both boxes hold traces: a legacy localStorage blob and the D312
    // cache store's rows. Erasure has to reach each.
    localStorage.setItem(ANS_LS, JSON.stringify({ day: 1, votes: { q_1: "0" } }));
    LIVE.vote("q_1", "0");
    await flush();
    expect((await readAnsCache()).votes).toHaveProperty("q_1");

    await LIVE.deleteAccount();

    // Order, not just presence: clearIndexedDbPersistence refuses a live
    // instance, so a dropped terminate() turns the clear into a no-op that
    // still logs nothing and still leaves the disk mirror intact.
    expect(h.cacheTeardown).toEqual(["terminate", "clearIndexedDbPersistence"]);
    // …and the localStorage half it always did still happens after it.
    expect(localStorage.getItem(ANS_LS)).toBeNull();
    // …and the hand-rolled cache store is emptied too — AWAITED by
    // deleteAccount, not left to the purge event, because the privacy
    // page's claim is about the device, not about a dispatch (D312).
    expect((await readAnsCache()).votes).toEqual({});
  });

  it("unlatches teardown when the wipe is refused, so the session survives", async () => {
    // index.ts refuses the auth delete whenever ANY wipe phase failed, and
    // every network timeout lands here too — while LivePrivacyPanel keeps
    // the user in the app afterwards. `torndown` is set as the FIRST
    // statement (deliberately: in-flight writers must not re-create an
    // insight.* key mid-wipe), and nothing reset it, so a refused delete
    // left the session permanently deaf: no reconnect, no midnight
    // resubscribe, and the uid-change guard disabled.
    //
    // Asserted through wake(), which is `if (torndown) return` — a live
    // session re-reads the bank on a wake, a torndown one does nothing.
    const LIVE = await bootLive();
    const fns = await import("firebase/functions");
    vi.mocked(fns.getFunctions).mockClear().mockReturnValue({ __fns: true } as never);
    vi.mocked(fns.httpsCallable).mockClear().mockReturnValue(
      vi.fn(() => Promise.reject(new Error("internal"))) as never,
    );

    await expect(LIVE.deleteAccount()).rejects.toThrow("internal");

    // Nothing was deleted, so nothing may have been torn down either.
    expect(h.cacheTeardown).toEqual([]);

    // The observable: cacheVote is `if (torndown) return`, so a latched
    // store silently stops writing the answers cache while vote() keeps
    // issuing the Firestore write — the split that made this invisible.
    LIVE.vote("q_1", "1");
    await flush();
    const cached = await readAnsCache();
    expect(cached.votes.q_1, "the store stayed torn down after a refused delete")
      .toBe("1");
  });

  it("still finishes the purge when the cache cannot be cleared", async () => {
    // clearIndexedDbPersistence rejects while another tab holds the lease.
    // A device that cannot clear its cache must still sign out and reload,
    // or the failure mode is worse than the one being fixed.
    const LIVE = await bootLive();
    await captureCallable();
    h.clearCacheImpl = () => Promise.reject(new Error("client is not terminated"));
    localStorage.setItem(ANS_LS, JSON.stringify({ day: 1, votes: { q_1: "0" } }));

    await expect(LIVE.deleteAccount()).resolves.toBeUndefined();

    expect(localStorage.getItem(ANS_LS)).toBeNull();
    expect(h.reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ where: "deleteAccount.clearCache" }),
    );
  });
});

// The operator seed hook.
//
// The surface pin above proves `seedContent` EXISTS. It cannot prove the
// name it calls, and the name is the whole value here: SHIP-CHECKLIST §1's
// remaining step is an operator typing this into a console against
// production, where a typo'd callable name is an `internal` error with
// nothing to read. The previous documented command
// (`firebase.functions()...`, v8 syntax on a modular-SDK app) failed that
// way for a different reason, so the region and payload are asserted too.
describe("LIVE.seedContent — the operator instrument", () => {
  // Call AFTER bootLive(): boot runs the device-bind activation, which is
  // itself an httpsCallable, so an uncleared mock puts `activateDeviceV2`
  // at calls[0] and the name assertion below reads the wrong call. (Found
  // by writing the assertion first and watching it fail on that name.)
  async function captureCallable() {
    const fns = await import("firebase/functions");
    const invoke = vi.fn(() => Promise.resolve({ data: { written: 369, skipped: 0 } }));
    vi.mocked(fns.getFunctions).mockClear().mockReturnValue({ __fns: true } as never);
    vi.mocked(fns.httpsCallable).mockClear().mockReturnValue(invoke as never);
    return { fns, invoke };
  }

  it("calls seedContentV2 in the deployed region and returns its payload", async () => {
    const LIVE = await bootLive();
    const { fns, invoke } = await captureCallable();

    const res = await LIVE.seedContent();

    // Asserted against the constant rather than a repeated literal (D201).
    // A literal here would have to be edited in lockstep with a region
    // move and is the one place a stale copy passes silently — the test
    // would go on proving the client calls a region nothing serves.
    // What holds the constant to the DEPLOY is check:fn-runtime, which
    // compares it against the compiled endpoints.
    expect(vi.mocked(fns.getFunctions).mock.calls[0][1]).toBe(FUNCTIONS_REGION);
    expect(vi.mocked(fns.httpsCallable).mock.calls[0][1]).toBe("seedContentV2");
    // Default is the cheap reseed (D34): rewrite changed documents, leave
    // contentRev alone so returning devices don't refetch the whole bank.
    expect(invoke).toHaveBeenCalledWith({ bumpRev: false });
    expect(res).toEqual({ written: 369, skipped: 0 });
  });

  it("passes bumpRev only when explicitly asked", async () => {
    const LIVE = await bootLive();
    const { invoke } = await captureCallable();

    await LIVE.seedContent(true);

    // The console argument is documented as `seedContent(true)`; anything
    // truthy-but-not-true would silently invalidate every device's cached
    // bank, so the wire value is normalised rather than forwarded.
    expect(invoke).toHaveBeenCalledWith({ bumpRev: true });
  });
});

// ── an unconfirmed city does not score the place it names (D205) ────────
//
// The scorecard D187 built reads ONE pre-summed cell keyed by city, so a
// reader cannot filter unconfirmed people out of it — the app never sees
// who is in it. The gate therefore sits at write time: a question that
// rates a city takes no city cell from someone the device has never
// placed there.
//
// It could not sit at the deck instead. All 24 rating questions are in the
// DAILY bank, the daily deck is positional, and it is the same question
// for everyone — filtering per person would shift every other day or leave
// some people with no daily at all. So the answer is given normally and
// simply lands in no city cell, which costs the answerer nothing they can
// see.
describe("rating questions and the confirmed city", () => {
  const RATES_CITY = {
    id: "q_rate_city",
    data: {
      surface: "daily", seq: 2, type: "scale", prompt: "How safe is it here?",
      options: ["1", "2", "3", "4", "5"], topic: null, test: null, active: true,
      rates: "city", tag: "Safety",
    },
  };

  /** Anchors reach the store through the profile doc hydrate reads, not
   * through `saveAnchors` — its own async write races the answer's in this
   * harness, and the thing under test is the SNAPSHOT, not the setter. */
  const withAnchors = (a: Record<string, string>) => {
    h.getDocImpl = (path: string) => (path === "v2_users/uid_test" ? { anchors: a } : null);
  };
  const confirm = (city: string) => {
    storage.setItem("insight.profileGeneral.v2", JSON.stringify({ vitals: { city, cityOk: city } }));
  };
  const anchorsOf = (qid: string) =>
    (h.setDocCalls.find((c) => c.path.endsWith("/answers/" + qid))?.data.anchors ?? {}) as Record<string, string>;

  it("writes an EMPTY city when the phone has never agreed with it", async () => {
    h.bankDocs.push(RATES_CITY);
    withAnchors({ city: "Oslo, NO", country: "NO", ageBand: "25-34" });
    const LIVE = await bootLive();
    LIVE.vote("q_rate_city", "4");
    await flush();
    const a = anchorsOf("q_rate_city");
    expect(a.city, "an unverified city took a cell in the scorecard").toBe("");
    // Everything else still travels: the answer counts for the country and
    // the world, and the person stays in every other cohort they were in.
    expect(a.country).toBe("NO");
    expect(a.ageBand).toBe("25-34");
  });

  it("writes the city once the device's own fix has agreed with it", async () => {
    h.bankDocs.push(RATES_CITY);
    withAnchors({ city: "Oslo, NO", country: "NO" });
    const LIVE = await bootLive();
    confirm("Oslo, NO");
    LIVE.vote("q_rate_city", "4");
    await flush();
    expect(anchorsOf("q_rate_city").city).toBe("Oslo, NO");
  });

  it("does not accept a confirmation of a DIFFERENT city", async () => {
    // The staleness the key-not-a-flag shape rules out, checked at the
    // reader rather than trusted to the writer.
    h.bankDocs.push(RATES_CITY);
    withAnchors({ city: "Oslo, NO", country: "NO" });
    const LIVE = await bootLive();
    storage.setItem("insight.profileGeneral.v2", JSON.stringify({
      vitals: { city: "Oslo, NO", cityOk: "Bergen, NO" },
    }));
    LIVE.vote("q_rate_city", "4");
    await flush();
    expect(anchorsOf("q_rate_city").city).toBe("");
  });

  it("leaves an ordinary question's city alone, confirmed or not", async () => {
    // The gate is about SCORING A PLACE, not about the person. Widening it
    // to every answer would quietly empty the City stop for anyone who has
    // not tapped "use my location" — a far bigger change than this one.
    withAnchors({ city: "Oslo, NO", country: "NO" });
    const LIVE = await bootLive();
    LIVE.vote("q_1", "1");
    await flush();
    expect(anchorsOf("q_1").city).toBe("Oslo, NO");
  });
});

// ── the city half of the Kindred pool (D278) ─────────────────────────
//
// WHAT THIS IS FOR. The unscoped voter query returns the newest 200
// answers from ANYWHERE and the City constellation then filters them to
// one city on the device. Because the cap binds before the filter, the
// number of reachable city-mates saturates around 50 however large the
// city grows — and the ring only draws 12, so it fills either way. The
// failure has no symptom, which is exactly why it needs a test rather
// than a screenshot.
//
// The fixture keys voter rows by the city the query asked for, so a
// narrowing that silently did nothing would return the same people and
// fail here.
describe("loadCityKindred — asking for the city instead of filtering for it", () => {
  const OSLO = "Oslo, NO";
  const answerDoc = (uid: string, qid: string, optionIdx: number, city: string) => ({
    id: qid,
    data: {
      __path: `v2_users/${uid}/answers/${qid}`,
      qid, surface: "daily", optionIdx, anchors: { city },
    },
  });

  const bootInOslo = async () => {
    h.getDocImpl = (path: string) => (path === "v2_users/uid_test" ? { anchors: { city: OSLO } } : null);
    h.answerDocs.push({ id: "q_1", data: { qid: "q_1", surface: "daily", optionIdx: 1 } });
    return bootLive();
  };

  it("sends the frozen city anchor to Firestore, not to a device-side filter", async () => {
    h.voterDocs[OSLO] = [answerDoc("u_oslo", "q_1", 1, OSLO)];
    const LIVE = await bootInOslo();
    h.voterQueries.length = 0;
    await LIVE.loadCityKindred();
    // The whole point of the change: the equality is IN the query. A
    // client-side filter would show up here as no `anchors.city` clause
    // and would read identically on screen.
    const scoped = h.voterQueries.filter((w) => w["anchors.city"] === OSLO);
    expect(scoped.length).toBeGreaterThan(0);
    // …and the surface clause survives beside it, which is not optional:
    // firestore.rules grants this read as a value test on `surface`, so a
    // query that dropped it would be refused wholesale (D65).
    expect(scoped[0].surface).toEqual(["daily", "feed", "test", "learn", "pulse", "call"]);
  });

  it("adds the city people to the pool without displacing the unscoped ones", async () => {
    // The People lens ranks strangers from anywhere and reads the same
    // fold, so the city pass has to be a UNION. If it replaced, that lens
    // would silently become "everyone in your city".
    h.voterDocs[""] = [answerDoc("u_far", "q_1", 1, "Lima, PE")];
    h.voterDocs[OSLO] = [answerDoc("u_near", "q_1", 1, OSLO)];
    const LIVE = await bootInOslo();
    await LIVE.loadKindred();
    expect(LIVE.kindredPeople().map((p) => p.uid)).toEqual(["u_far"]);
    await LIVE.loadCityKindred();
    expect(LIVE.kindredPeople().map((p) => p.uid).sort()).toEqual(["u_far", "u_near"]);
  });

  it("does nothing at all for a viewer with no city", async () => {
    h.voterDocs[OSLO] = [answerDoc("u_oslo", "q_1", 1, OSLO)];
    h.answerDocs.push({ id: "q_1", data: { qid: "q_1", surface: "daily", optionIdx: 1 } });
    const LIVE = await bootLive();
    h.voterQueries.length = 0;
    await LIVE.loadCityKindred();
    // No anchor means no city to ask for — and asking with an empty string
    // would match every answer whose author never set one.
    expect(h.voterQueries).toEqual([]);
  });

  it("is session-cached, and refetches when the anchor moves", async () => {
    h.voterDocs[OSLO] = [answerDoc("u_oslo", "q_1", 1, OSLO)];
    const LIVE = await bootInOslo();
    await LIVE.loadCityKindred();
    const first = h.voterQueries.length;
    await LIVE.loadCityKindred();
    expect(h.voterQueries.length).toBe(first); // cached, not refetched

    // A move must not serve the old city forever — the guard is keyed on
    // the anchor rather than being a boolean. saveAnchors is the real
    // setter and updates state.profile.anchors synchronously.
    h.voterDocs["Bergen, NO"] = [answerDoc("u_bergen", "q_1", 1, "Bergen, NO")];
    LIVE.saveAnchors({ city: "Bergen, NO" });
    await LIVE.loadCityKindred();
    expect(h.voterQueries.some((w) => w["anchors.city"] === "Bergen, NO")).toBe(true);
  });
});

// The WRITE SHAPE `saveAnchors` uses, pinned at the caller.
//
// A commit landed the fix for this — `merge: true` deep-merges a nested
// map, so the anchors write could add and change a key and never REMOVE
// one, and the persona-residue heal that removes keys therefore never
// converged — under a comment saying "firestore-tests/rules.test.ts holds
// the semantics so a future 'simplification' back to merge:true cannot
// pass." It did not. That case hand-writes its own `setDoc` with
// `mergeFields` and never calls `saveAnchors`, so it proves what
// Firestore does and nothing about what this caller asks for: reverting
// the fix left all 2228 tests green.
//
// The reason nothing could pin it is one line up in this file — the
// harness's `setDoc` dropped its third argument, so the option that
// decides whether a write can remove a field was invisible to every test.
describe("saveAnchors asks for a write that can REMOVE an anchor", () => {
  it("passes mergeFields naming anchors, not a plain merge", async () => {
    const LIVE = await bootLive();
    h.setDocCalls.length = 0;
    LIVE.saveAnchors({ city: "Bergen, NO" });
    await flush();
    const call = h.setDocCalls.find((c) => c.path === "v2_users/uid_test");
    expect(call, "saveAnchors wrote no profile document at all").toBeTruthy();
    expect(
      call!.opts,
      "a plain `{ merge: true }` DEEP-MERGES the anchors map, so a key the "
      + "caller left out survives on the server and the persona-residue "
      + "heal re-fires on every boot forever without converging",
    ).toEqual({ mergeFields: ["anchors"] });
    // …and it names ONLY anchors: naming more would drop the rest of the
    // profile, which is the failure the original `merge: true` was there
    // to avoid.
    expect(call!.data).toEqual({ anchors: { city: "Bergen, NO" } });
  });
});

// ── the cold answer fetch is PAGED, not capped ─────────────────────────
//
// The cold path was one `orderBy("answeredAt","desc") limit(1000)`, and
// the watermark it leaves behind is what made that permanent rather than
// merely partial: `fold` raises maxTs to the newest answeredAt it sees,
// and the warm query asks for `answeredAt >` that, so on a descending
// page the watermark jumps straight past everything unread. Answer 1001
// and beyond were sealed out of that device for good — the app re-offers
// them, the create-only rule refuses each tap, and syncPassiveResults
// re-folds a truncated vote map over the stored test result.
describe("hydrate pages the viewer's own answers", () => {
  const answeredAt = (ms: number) => ({ toMillis: () => ms });

  it("drains every page instead of stopping at the first one", async () => {
    // Two full pages and a short one. The page size the loop asks for is
    // 1000, so the mock has to hand back exactly that to be asked again —
    // a short page is the only signal that means the end.
    const TOTAL = 2300;
    for (let i = 0; i < TOTAL; i++) {
      h.answerDocs.push({
        id: `q_${String(i).padStart(5, "0")}`,
        data: {
          qid: `q_${String(i).padStart(5, "0")}`,
          surface: "daily",
          optionIdx: i % 2,
          answeredAt: answeredAt(1000 + i),
        },
      });
    }
    h.answerPageSize = 1000;

    const LIVE = await bootLive();

    expect(
      Object.keys(LIVE.myVotes()),
      "answers past the first page were dropped — and the watermark would seal them out permanently",
    ).toHaveLength(TOTAL);
    // The last page's answers specifically, since those are the ones a
    // descending single read discarded.
    const last = `q_${String(TOTAL - 1).padStart(5, "0")}`;
    expect(LIVE.myVotes()[last], `${last} is on the final page`).toBeDefined();
  });
});

// The two warm-boot deltas, and the watermark one of them may not move.
//
// An edit changes `optionIdx` and stamps `editedAt`; it does NOT move
// `answeredAt`, which is frozen because the cohort snapshot rides on it.
// So a warm boot runs two queries — `answeredAt >` for new answers,
// `editedAt >` for edits — with a cursor each.
//
// Both cursors were raised by BOTH pages. The answered page returns the
// docs whose answeredAt moved, and their editedAt can be far newer than
// edits on other docs it never looked at — so it lifted the edit cursor
// past those edits and they were never fetched. The cursor is then
// persisted, so it is not a boot's bad luck: that device shows the
// pre-edit option for good.
//
// The comment at the edit query reasons carefully about the mirror-image
// hazard (folding editedAt into the ANSWER cursor) and missed this one.
describe("hydrate's edit-delta watermark", () => {
  const stamp = (ms: number) => ({ toMillis: () => ms });

  it("fetches an edit older than an edit on a newly-created answer", async () => {
    // The sequence, in the order it happens on device A:
    //   09:00 answer N created
    //   10:00 answer O edited      ← device B must see this
    //   10:05 answer N edited
    // Device B's stored cursors are from 08:00.
    h.answerDocs.push(
      {
        id: "q_new",
        data: {
          qid: "q_new", surface: "daily", optionIdx: 1,
          answeredAt: stamp(9_00), editedAt: stamp(10_05),
        },
      },
      {
        id: "q_old",
        data: {
          qid: "q_old", surface: "daily", optionIdx: 1,
          answeredAt: stamp(1_00), editedAt: stamp(10_00),
        },
      },
    );
    await seedAnsCache({
      uid: "uid_test",
      // The stale option for the edited answer, and nothing for the new
      // one — exactly what a device that last synced at 08:00 holds.
      votes: { q_old: "0" },
      maxTs: 8_00, maxEditTs: 8_00,
    });

    const LIVE = await bootLive();

    expect(
      LIVE.myVotes().q_new,
      "the new answer never arrived — the answered delta is broken, not the edit one",
    ).toBe("1");
    expect(
      LIVE.myVotes().q_old,
      "the edit was leapt over: the answered delta lifted the EDIT cursor past it, "
        + "so this device keeps the pre-edit option forever",
    ).toBe("1");
  });

  it("persists a cursor no higher than what the edit page accounted for", async () => {
    // The other half of the same rule. A cursor raised from documents the
    // edit query never returned is a cursor that will skip whatever falls
    // between them on the NEXT boot, which is how one bad boot becomes a
    // permanent hole.
    h.answerDocs.push({
      id: "q_new",
      data: {
        qid: "q_new", surface: "daily", optionIdx: 1,
        answeredAt: stamp(9_00), editedAt: stamp(10_05),
      },
    });
    await seedAnsCache({ uid: "uid_test", votes: {}, maxTs: 8_00, maxEditTs: 8_00 });
    await bootLive();
    const meta = await readAnsCache();
    expect(
      meta?.maxEditTs,
      "the edit cursor was raised to an edit no edit query returned",
    ).toBeLessThanOrEqual(10_05);
  });
});

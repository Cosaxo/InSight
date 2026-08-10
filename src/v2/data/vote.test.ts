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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIVE_MEMBERS, LIVE_NEAR_MEMBERS, LIVE_SOCIAL_MEMBERS } from "../test/live-surface";

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
  setDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  // the D85 edit path writes through updateDoc, never setDoc
  updateDocImpl: null as null | (() => Promise<void>),
  updateDocCalls: [] as Array<{ path: string; data: Record<string, unknown> }>,
  bankDocs: [] as FakeSnapshotDoc[],
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
}));

vi.mock("../../lib/firebase", () => ({
  firebaseEnabled: true,
  anonSignIn: () => (h.hangSignIn
    ? new Promise<string>(() => { /* never settles, which is the case */ })
    : Promise.resolve("uid_test")),
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
    doc: (_db: unknown, ...path: string[]) => ref("doc", path),
    query: (src: { path?: string }) => ({ __kind: "query", path: src?.path }),
    where: () => ({ __kind: "where" }),
    orderBy: () => ({ __kind: "orderBy" }),
    limit: () => ({ __kind: "limit" }),
    documentId: () => ({ __kind: "documentId" }),
    serverTimestamp: () => ({ __kind: "serverTimestamp" }),
    Timestamp: { fromMillis: (ms: number) => ({ ms }) },
    getDoc: () =>
      Promise.resolve({ exists: () => false, get: () => undefined, data: () => ({}) }),
    getDocs: (q: { path?: string }) => {
      // Lets a test simulate a network failure mid-hydrate.
      if (h.getDocsImpl) return Promise.reject(h.getDocsImpl());
      return Promise.resolve(q?.path === "v2_questions" ? snapOf(h.bankDocs) : snapOf([]));
    },
    onSnapshot: (
      target: { path?: string },
      next: (snap: unknown) => void,
      error?: (err: unknown) => void,
    ) => {
      h.snapshots.push({ path: target?.path, next, error });
      return vi.fn();
    },
    setDoc: (target: { path: string }, data: Record<string, unknown>) => {
      h.setDocCalls.push({ path: target.path, data });
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

// Events live.ts dispatches on the stubbed window (insight:local-purge),
// so a test can assert the purge announced itself.
const dispatched: string[] = [];

const ANS_LS = "insight.answersCache.v1";
const WF_LS = "insight.feedVotes.v1";

beforeEach(() => {
  vi.resetModules();
  h.reportError.mockClear();
  h.setDocImpl = null;
  h.getDocsImpl = null;
  h.authCb = null;
  h.setDocCalls.length = 0;
  h.updateDocImpl = null;
  h.updateDocCalls.length = 0;
  h.snapshots.length = 0;
  h.cacheTeardown.length = 0;
  h.clearCacheImpl = null;
  h.hangSignIn = false;
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
  // initLive attaches `online` / `visibilitychange` handlers for the
  // reconnect path. The stub carries addEventListener so that code path is
  // actually taken here rather than skipped by its typeof guard — and
  // registered handlers are captured so a test can fire a wake.
  listeners.window = {};
  listeners.document = {};
  dispatched.length = 0;
  vi.stubGlobal("window", {
    dispatchEvent: (e: Event) => { dispatched.push(e?.type); return true; },
    addEventListener: (type: string, fn: () => void) => { listeners.window[type] = fn; },
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
    const cached = JSON.parse(storage.getItem(ANS_LS) || "{}");
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
    const cached = JSON.parse(storage.getItem(ANS_LS) || "{}");
    expect(cached.votes).toMatchObject({ q_1: "0" });
  });

  it("does NOT confirm an unacked vote when an agg snapshot lands mid-flight", async () => {
    const LIVE = await bootLive();
    const d = deferred();
    h.setDocImpl = () => d.promise;

    LIVE.vote("q_1", "1");
    await flush(); // write in flight

    // A stranger's vote folds into the public aggregate while our
    // setDoc is still pending — the regression this split fixes.
    const aggListener = h.snapshots.find((s) => s.path === "v2_question_aggs/q_1");
    expect(aggListener).toBeDefined();
    aggListener!.next({
      exists: () => true,
      data: () => ({ counts: { "0": 3, "1": 1 }, total: 4, tooSmall: false }),
    });

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
    const cached = JSON.parse(storage.getItem(ANS_LS) || "{}");
    expect(cached.votes || {}).not.toHaveProperty("q_1");
    expect(listener.mock.calls.length).toBeGreaterThan(notifiesBeforeReject);
    expect(h.reportError).toHaveBeenCalledWith(boom, { where: "vote", qid: "q_1" });
  });

  it("editVote (D85): refuses when there is nothing to move, and sends nothing", async () => {
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
    const cached = JSON.parse(storage.getItem(ANS_LS) || "{}");
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
    const cached = JSON.parse(storage.getItem(ANS_LS) || "{}");
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

  // ── the coalesced agg cache (D64) ───────────────────────────────────
  //
  // saveAggCache used to run JSON.stringify over the WHOLE aggs map
  // synchronously inside the agg snapshot handler, and that handler fires
  // once per publish on a globally-shared question — COSTS.md finding 2's
  // own fan-out numbers make that ~0.7 full serialisations/sec at 50k DAU
  // and ~6.9/sec at 500k, on the main thread. It is coalesced now, which
  // buys the throughput and costs three new ways to be wrong: a write that
  // never lands, a write that lands after the purge, and a write lost to a
  // backgrounded WebView. One case each.
  //
  // Real timers rather than fake ones: boot itself schedules a write, and
  // switching clocks underneath a pending real timer leaks it into whatever
  // test runs next. Each case waits out the window instead.
  const AGG_LS = "insight.aggsCache.v1";
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const emitAgg = (total: number) => {
    const l = h.snapshots.find((s) => s.path === "v2_question_aggs/q_1");
    expect(l).toBeDefined();
    l!.next({
      exists: () => true,
      data: () => ({ counts: { "0": total, "1": 0 }, total, tooSmall: false }),
    });
  };
  const aggWrites = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.filter((c) => c[0] === AGG_LS).length;

  it("coalesces a burst of agg snapshots into one cache write, carrying the last state", async () => {
    await bootLive();
    await sleep(1200); // let boot's own write land, so the spy counts only ours
    const spy = vi.spyOn(storage, "setItem");

    for (let i = 1; i <= 5; i++) emitAgg(i);
    // Nothing synchronous — that is the whole point; the handler used to
    // stringify the map five times right here.
    expect(aggWrites(spy)).toBe(0);

    await sleep(1200);
    expect(aggWrites(spy)).toBe(1);
    // Leading-schedule/trailing-write: the write happens a beat after the
    // FIRST snapshot but serialises state at write time, so it carries the
    // fifth one's total rather than the first's.
    expect(JSON.parse(storage.getItem(AGG_LS) || "{}")).toMatchObject({
      q_1: { total: 5 },
    });
    spy.mockRestore();
  });

  it("a uid change carries no previous account's aggregate past the purge", async () => {
    // Same contract as the feed-vote mirror above — none of the previous
    // account's data survives, NOT that the key never comes back — and the
    // coalescing is what makes it worth re-pinning here: between the
    // snapshot and the purge there is now a write in flight that there
    // never used to be.
    //
    // Honest about what this does and does not prove. Removing the
    // cancelAggCache() call from purgeLocalTrace fails NOTHING in this
    // tree, this case included, and that is not a gap in the case: on this
    // path resetForNewUid empties state.aggs before it purges, so a
    // surviving timer can only write `{}`, and the new session re-creates
    // the key empty within the window regardless. The cancel is hygiene.
    // What is actually load-bearing here is the assertion below.
    await bootLive();
    await sleep(1200);
    expect(storage.getItem(AGG_LS)).not.toBeNull(); // boot wrote one

    emitAgg(9); // schedules a write…
    expect(h.authCb).toBeTypeOf("function");
    h.authCb!({ uid: "someone_else" }); // …and the purge lands first
    await flush();
    expect(storage.getItem(AGG_LS)).toBeNull();

    // Past the window the pending write would have fired in: the key may be
    // back (the new uid's own listener writes it), but never with the
    // previous account's counts in it.
    await sleep(1200);
    expect(JSON.parse(storage.getItem(AGG_LS) || "{}")).not.toHaveProperty("q_1");
  });

  it("hiding the app flushes the pending agg write rather than losing it", async () => {
    // Hiding is the last callback a mobile WebView is guaranteed before the
    // OS may kill it. Before coalescing, the write was already on disk by
    // then; now it can be up to a second in the future.
    await bootLive();
    await sleep(1200);
    const spy = vi.spyOn(storage, "setItem");

    emitAgg(7);
    expect(aggWrites(spy)).toBe(0); // still pending

    expect(listeners.document.visibilitychange).toBeTypeOf("function");
    (document as unknown as { hidden: boolean }).hidden = true;
    listeners.document.visibilitychange();

    // Synchronous — the flush is the point.
    expect(aggWrites(spy)).toBe(1);
    expect(JSON.parse(storage.getItem(AGG_LS) || "{}")).toMatchObject({
      q_1: { total: 7 },
    });

    // …and exactly once: the flush cancels the timer, so the window
    // expiring afterwards must not write the same map a second time.
    await sleep(1200);
    expect(aggWrites(spy)).toBe(1);
    (document as unknown as { hidden: boolean }).hidden = false;
    spy.mockRestore();
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

  it("rank-type feed questions stay out of the live feed", async () => {
    // The bank seeds rank questions, but no answer can carry an order yet —
    // served as vote cards they collect single choices against a "rank
    // them" prompt, which poisons the aggregate (D12). Fails without the
    // q.type !== "rank" filter in hydrate's feedBank predicate.
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
    const feed = (window as unknown as { WORLD_FEED_QS?: Array<{ id: string }> }).WORLD_FEED_QS || [];
    expect(feed.map((q) => q.id)).toContain("q_feed_vote");
    expect(feed.map((q) => q.id)).not.toContain("q_feed_rank");
  });

  it("reports and re-notifies when an agg listener errors", async () => {
    const LIVE = await bootLive();
    const listener = vi.fn();
    LIVE.subscribe(listener);

    const aggListener = h.snapshots.find((s) => s.path === "v2_question_aggs/q_1");
    expect(aggListener?.error).toBeDefined();
    const boom = new Error("listener torn down");
    aggListener!.error!(boom);

    expect(h.reportError).toHaveBeenCalledWith(boom, { where: "aggListener", qid: "q_1" });
    expect(listener).toHaveBeenCalled();
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
    localStorage.setItem(ANS_LS, JSON.stringify({ day: 1, votes: { q_1: "0" } }));

    await LIVE.deleteAccount();

    // Order, not just presence: clearIndexedDbPersistence refuses a live
    // instance, so a dropped terminate() turns the clear into a no-op that
    // still logs nothing and still leaves the disk mirror intact.
    expect(h.cacheTeardown).toEqual(["terminate", "clearIndexedDbPersistence"]);
    // …and the localStorage half it always did still happens after it.
    expect(localStorage.getItem(ANS_LS)).toBeNull();
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
    storage.removeItem(ANS_LS);
    LIVE.vote("q_1", "1");
    await flush();
    const cached = JSON.parse(storage.getItem(ANS_LS) || "null");
    expect(cached?.votes?.q_1, "the store stayed torn down after a refused delete")
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

  it("calls seedContentV2 in us-central1 and returns its payload", async () => {
    const LIVE = await bootLive();
    const { fns, invoke } = await captureCallable();

    const res = await LIVE.seedContent();

    expect(vi.mocked(fns.getFunctions).mock.calls[0][1]).toBe("us-central1");
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

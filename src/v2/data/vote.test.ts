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
  bankDocs: [] as FakeSnapshotDoc[],
  // live.ts observes auth for the whole session; capture the callback so a
  // test can drive a uid change or a revoked session.
  authCb: null as null | ((u: { uid: string } | null) => void),
  snapshots: [] as CapturedListener[],
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

const ANS_LS = "insight.answersCache.v1";
const WF_LS = "insight.feedVotes.v1";

beforeEach(() => {
  vi.resetModules();
  h.reportError.mockClear();
  h.setDocImpl = null;
  h.getDocsImpl = null;
  h.authCb = null;
  h.setDocCalls.length = 0;
  h.snapshots.length = 0;
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
  vi.stubGlobal("window", {
    dispatchEvent: () => true,
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
  // Checked in verbatim. Update ONLY together with the spec-layer call
  // sites that read the renamed member — that is the whole point.
  const EXPECTED = [
    "aggFor", "appBuild", "confirmedVotes", "dailyBank", "deck",
    "deleteAccount", "demoInProd", "displayName", "enabled", "feedReady",
    "latestBuild", "linkGoogle", "myCity", "myVotes", "ready", "saveAnchors",
    "saveDisplayName",
    "saveTestResult", "social", "stats", "subscribe", "uid",
    "updateAvailable", "updateRequired", "updateUrl", "vote",
  ];
  const EXPECTED_SOCIAL = [
    "bankQ", "createGroup", "groups", "joinGroup", "leaveGroup",
    "loadRevealHistory", "myDuelVote", "revealFor", "revealHistory",
    "todayKey", "todayQ", "voteDuel",
  ];

  it("exposes exactly the members the spec layer looks up by name", async () => {
    const LIVE = await bootLive();
    const actual = Object.keys(LIVE).sort();
    const expected = [...EXPECTED].sort();
    // Both directions: a REMOVED member breaks a consumer, and an ADDED
    // one that nobody listed means this contract stopped being reviewed.
    expect(actual).toEqual(expected);
  });

  it("exposes exactly the social members", async () => {
    const LIVE = await bootLive();
    const social = (LIVE as unknown as { social: Record<string, unknown> }).social;
    expect(Object.keys(social).sort()).toEqual([...EXPECTED_SOCIAL].sort());
  });
});

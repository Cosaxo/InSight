// @vitest-environment jsdom
//
// The idle detach, at the store — COSTS.md's listener fan-out, which is the
// one read source in the model that grows superlinearly in DAU.
//
// WHY THIS FILE EXISTS. Before it, nothing in this tree could tell an
// attached snapshot listener from a detached one. `vote.test.ts` pins the
// LIVE member surface by NAME, `near-presence.test.ts` drives beats, and
// the mount suites walk screens — none of them counts subscriptions, so a
// backgrounded app that keeps seven listeners alive for eight hours looks
// exactly like one that drops them, in every suite and on every device.
// It shows up only on the invoice, which is the worst place to find it and
// the reason this is measured rather than reasoned about.
//
// What the arithmetic says (scripts/cost-arith.mjs): `fanOut` is linear in
// `B.onlineMin`, which the model glosses as "minutes with the app actually
// open" and sets to 3. What Firestore bills is minutes with a listener
// ATTACHED. At 60 the modelled bill at 50 k DAU is $16,689/mo against
// $1,224, and the crossover where the fan-out overtakes every flat read
// source drops from ~30,800 DAU to ~1,540 — under D7's write-contention
// wall, which inverts the ordering COSTS.md calls the property worth
// keeping. The grace period is the other half of the design and is pinned
// here too: re-attaching costs a read per listener, so an immediate detach
// would charge the ten-second app swap `wake()` is written around.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface FakeSnapshotDoc {
  id: string;
  data: Record<string, unknown>;
}

const h = vi.hoisted(() => ({
  reportError: vi.fn(),
  bankDocs: [] as FakeSnapshotDoc[],
  // Every onSnapshot call, with the unsub it handed back. Counting live
  // subscriptions is the entire point of the file, so the unsub is a real
  // spy rather than the throwaway `vi.fn()` vote.test.ts returns.
  subs: [] as Array<{ path: string | undefined; unsub: ReturnType<typeof vi.fn> }>,
}));

vi.mock("../../lib/firebase", () => ({
  firebaseEnabled: true,
  anonSignIn: () => Promise.resolve("uid_test"),
  getDb: () => Promise.resolve({ __db: true }),
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
    getDocs: (q: { path?: string }) =>
      Promise.resolve(q?.path === "v2_questions" ? snapOf(h.bankDocs) : snapOf([])),
    onSnapshot: (target: { path?: string }) => {
      const unsub = vi.fn();
      h.subs.push({ path: target?.path, unsub });
      return unsub;
    },
    setDoc: () => Promise.resolve(),
    updateDoc: () => Promise.resolve(),
    deleteDoc: () => Promise.resolve(),
    terminate: () => Promise.resolve(),
    clearIndexedDbPersistence: () => Promise.resolve(),
  };
});

// ── harness ─────────────────────────────────────────────────────────

// jsdom's `document.hidden` is a getter with no setter, so the page
// lifecycle has to be faked at the property. Redefined per test and
// restored in afterEach, because leaving a permanently-hidden document
// behind would quietly change every later file in the same worker.
let hidden = false;
function setHidden(v: boolean): void {
  hidden = v;
  document.dispatchEvent(new Event("visibilitychange"));
}

const liveSubs = () => h.subs.filter((s) => !s.unsub.mock.calls.length);

// The two listeners the idle detach owns are the per-question aggregate
// ones and the per-group reveal ones — exactly the set
// `resubscribeForToday()` restores. Splitting them out here is not
// cosmetic: `groupsUnsub` is deliberately NOT dropped (nothing short of a
// full refreshLive() re-attaches it), so a test that counted every
// subscription would either fail or, worse, pass while hiding the fact
// that one listener is meant to survive.
const isDetachable = (p: string | undefined) =>
  !!p && (p.startsWith("v2_question_aggs") || p.startsWith("v2_reveals"));
const liveDetachable = () => liveSubs().filter((s) => isDetachable(s.path));
const liveSurviving = () => liveSubs().filter((s) => !isDetachable(s.path));

// A bank of one active daily question, which is the smallest thing that
// produces a deck and therefore an agg listener.
function bank(): FakeSnapshotDoc[] {
  return [{
    id: "q_daily_1",
    data: {
      active: true,
      surface: "daily",
      kind: "choice",
      text: "A question",
      options: ["a", "b"],
      updatedAt: { toMillis: () => 1 },
    },
  }];
}

async function bootLive() {
  const mod = await import("./live");
  await mod.initLive(1);
  await vi.waitFor(() => {
    expect(mod.default.ready).toBe(true);
  });
  return mod;
}

beforeEach(() => {
  vi.resetModules();
  h.reportError.mockClear();
  h.subs.length = 0;
  h.bankDocs = bank();
  hidden = false;
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  vi.stubEnv("VITE_V2_LIVE", "true");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  delete (document as unknown as Record<string, unknown>).hidden;
});

describe("idle detach — the listener fan-out's only bound", () => {
  it("attaches deck listeners on boot", async () => {
    await bootLive();
    // The exact count is DECK_DAYS-dependent and not what this file is
    // about; that at least one detachable subscription exists is the
    // premise every other case here rests on.
    expect(liveDetachable().length).toBeGreaterThan(0);
  });

  it("keeps listeners through a short app swap — the common case", async () => {
    vi.useFakeTimers();
    await bootLive();
    const before = liveDetachable().length;

    setHidden(true);
    vi.advanceTimersByTime(10_000); // ten seconds away
    setHidden(false);

    // Nothing was dropped, so nothing has to be re-read. An immediate
    // detach would have charged this swap a read per listener, which is
    // the whole reason IDLE_DETACH_MS is a minute and not zero.
    expect(liveDetachable().length).toBe(before);
  });

  it("detaches once the app has been hidden past the grace period", async () => {
    vi.useFakeTimers();
    await bootLive();
    expect(liveDetachable().length).toBeGreaterThan(0);
    const survivors = liveSurviving().length;

    setHidden(true);
    vi.advanceTimersByTime(60_000);

    // This is the assertion the bill cares about: a backgrounded phone
    // stops receiving (and paying for) publishes to the shared daily.
    expect(liveDetachable().length).toBe(0);
    // And the deliberate exclusion holds — the groups listener is not part
    // of the hot path and nothing re-attaches it short of refreshLive().
    expect(liveSurviving().length).toBe(survivors);
  });

  it("re-attaches when the app comes back", async () => {
    vi.useFakeTimers();
    const mod = await bootLive();
    setHidden(true);
    vi.advanceTimersByTime(60_000);
    expect(liveDetachable().length).toBe(0);

    setHidden(false);
    // wake() → resubscribeForToday() is async; drain it under fake timers.
    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => {
      expect(liveDetachable().length).toBeGreaterThan(0);
    });
    // And the store is still usable, not merely re-subscribed.
    expect(mod.default.ready).toBe(true);
  });

  it("cancels a pending detach when the app returns before it fires", async () => {
    vi.useFakeTimers();
    const mod = await bootLive();

    setHidden(true);
    vi.advanceTimersByTime(30_000); // half-way
    expect(mod._idleDetachForTest().pending).toBe(true);
    setHidden(false);
    expect(mod._idleDetachForTest().pending).toBe(false);

    // Past the original deadline, and nothing fires — a stale timer would
    // drop a foregrounded app's listeners with nothing to re-attach them
    // until the next visibility change.
    vi.advanceTimersByTime(60_000);
    expect(liveDetachable().length).toBeGreaterThan(0);
  });

  it("detaching twice is a no-op rather than a double-unsubscribe", async () => {
    vi.useFakeTimers();
    const mod = await bootLive();
    const attached = liveDetachable().length;
    expect(attached).toBeGreaterThan(0);

    mod._idleDetachForTest().run();
    const callsAfterFirst = h.subs.map((s) => s.unsub.mock.calls.length);
    mod._idleDetachForTest().run();

    // Each unsub was invoked exactly once. Firestore tolerates a repeat,
    // but a map that is not cleared is how the re-attach guard in
    // subscribeAggs ("if already subscribed, return") would block every
    // later re-attach for the life of the session.
    expect(h.subs.map((s) => s.unsub.mock.calls.length)).toEqual(callsAfterFirst);
    expect(liveDetachable().length).toBe(0);
  });
});

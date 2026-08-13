// @vitest-environment jsdom
//
// The presence loop, at the store (D84 — the "Near never connects" report).
//
// WHY THIS FILE. Everything about Near was pinned by NAME and nothing by
// BEHAVIOUR: vote.test.ts asserts LIVE.near's member list, NearLiveBody's
// suite asserts what the card draws for a given state, and nothing at all
// ran a beat. The two defects behind the report both lived in the gap —
// enable() resolving a location fix and then immediately throwing it away
// to resolve a second one, and lastError being cleared at the top of a beat
// that had not yet done the two things most likely to fail.
//
// The mocks are the narrowest set live.ts needs to boot and beat: auth,
// getDb, the two firestore writes it makes, the callable, and locate. No
// timers — every case drives the beat through enable()/refresh() directly,
// because the four-minute interval is not what any of this is about.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  // per-test knobs
  cellImpl: null as null | (() => Promise<{ ok: true; cell: string } | { ok: false; reason: string }>),
  countImpl: null as null | (() => Promise<{ n?: number }>),
  cellCalls: 0,
  countCalls: 0,
  presenceWrites: [] as Array<{ path: string; data: Record<string, unknown> }>,
  presenceDeletes: [] as string[],
}));

vi.mock("../../lib/firebase", () => ({
  firebaseEnabled: true,
  anonSignIn: () => Promise.resolve("uid_test"),
  getDb: () => Promise.resolve({ __db: true, app: {} }),
  getFirestoreApi: () => import("firebase/firestore"),
  getFunctionsApi: () => import("firebase/functions"),
  linkGoogle: () => Promise.resolve(),
  googleSignOut: () => Promise.resolve(),
  subscribeToAuth: (cb: (u: { uid: string } | null) => void) => { cb({ uid: "uid_test" }); return () => {}; },
}));

vi.mock("../../lib/sentry", () => ({ reportError: vi.fn(), setSentryUser: vi.fn() }));
vi.mock("./push", () => ({ registerPushForReveals: () => Promise.resolve() }));

vi.mock("./locate", () => ({
  locateSupported: () => true,
  locateCity: () => Promise.resolve({ ok: false, reason: "unavailable" }),
  locateCell: () => {
    h.cellCalls += 1;
    return (h.cellImpl || (() => Promise.resolve({ ok: true as const, cell: "0059_0106" })))();
  },
  default: {},
}));

vi.mock("firebase/functions", () => ({
  getFunctions: () => ({}),
  httpsCallable: (_fns: unknown, name: string) => (data: unknown) => {
    if (name !== "nearbyCountV2") return Promise.resolve({ data: {} });
    h.countCalls += 1;
    void data;
    return (h.countImpl || (() => Promise.resolve({ n: 2 })))().then((d) => ({ data: d }));
  },
}));

vi.mock("firebase/firestore", () => {
  const ref = (kind: string, path: string[]) => ({ __kind: kind, path: path.join("/") });
  return {
    doc: (_db: unknown, ...path: string[]) => ref("doc", path),
    collection: (_db: unknown, ...path: string[]) => ref("collection", path),
    // The store attaches listeners at boot; none of them matters here, so
    // they capture nothing and unsubscribe to nothing.
    onSnapshot: () => () => {},
    getDoc: () => Promise.resolve({ exists: () => false, data: () => ({}) }),
    // One daily question: hydrate() throws "live bank is empty" on a
    // completely unseeded project and boot then leaves LIVE disabled, which
    // would gate every beat below. Nothing here reads the question.
    getDocs: (q: { path?: string }) => {
      const data: Record<string, unknown> = { surface: "daily", seq: 1, type: "vote",
        prompt: "Prompt q_1", options: ["A", "B"], topic: "culture", test: null, active: true };
      const docs = q?.path === "v2_questions"
        ? [{ id: "q_1", data: () => data, get: (k: string) => data[k] }]
        : [];
      return Promise.resolve({ docs, forEach: (f: (d: unknown) => void) => docs.forEach(f), empty: !docs.length, size: docs.length });
    },
    setDoc: (r: { path: string }, data: Record<string, unknown>) => {
      if (r.path.startsWith("v2_presence/")) h.presenceWrites.push({ path: r.path, data });
      return Promise.resolve();
    },
    updateDoc: () => Promise.resolve(),
    deleteDoc: (r: { path: string }) => { h.presenceDeletes.push(r.path); return Promise.resolve(); },
    // The path has to survive query() — getDocs below routes on it.
    query: (src: { path?: string }) => ({ __kind: "query", path: src?.path }),
    where: () => ({ __kind: "where" }),
    orderBy: () => ({ __kind: "orderBy" }),
    limit: () => ({ __kind: "limit" }),
    documentId: () => "__name__",
    Timestamp: { fromMillis: (ms: number) => ({ toMillis: () => ms }), now: () => ({ toMillis: () => 0 }) },
    serverTimestamp: () => ({ __ts: true }),
    increment: (n: number) => ({ __inc: n }),
    writeBatch: () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: () => Promise.resolve() }),
    terminate: () => Promise.resolve(),
    clearIndexedDbPersistence: () => Promise.resolve(),
    deleteField: () => ({ __del: true }),
    arrayUnion: (...a: unknown[]) => ({ __union: a }),
    arrayRemove: (...a: unknown[]) => ({ __rm: a }),
  };
});

interface NearApi {
  on(): boolean;
  count(): number | null;
  updatedAt(): number;
  lastError(): string | null;
  enable(): Promise<{ ok: boolean; reason?: string }>;
  disable(): Promise<void>;
  refresh(): Promise<void> | void;
}

// A real boot, the same shape vote.test.ts uses: the presence loop is gated
// on LIVE.enabled and writes under state.uid, and both are set by
// refreshLive() rather than assignable from outside.
let booted: NearApi | null = null;

async function bootNear(): Promise<NearApi> {
  const mod = await import("./live");
  const LIVE = mod.default as unknown as { ready: boolean; near: NearApi };
  await mod.initLive(1);
  await vi.waitFor(() => { expect(LIVE.ready).toBe(true); });
  booted = LIVE.near;
  return LIVE.near;
}

beforeEach(() => {
  vi.resetModules();
  h.cellImpl = null;
  h.countImpl = null;
  h.cellCalls = 0;
  h.countCalls = 0;
  h.presenceWrites = [];
  h.presenceDeletes = [];
  try { localStorage.clear(); } catch { /* jsdom always has one */ }
  vi.stubEnv("VITE_V2_LIVE", "true");
});

afterEach(async () => {
  // Stop the four-minute interval this case opted into. vi.resetModules()
  // orphans the module but not its setInterval, and an orphaned beat firing
  // into the NEXT case's counters is the kind of cross-test leak that reads
  // as flakiness in CI rather than as the wiring mistake it is.
  if (booted?.on()) await booted.disable();
  booted = null;
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("enable() — the opt-in tap is also the first count", () => {
  it("takes exactly ONE location fix, not one to decide and another to use", async () => {
    // The bug behind "Near seems to never connect": enable() resolved a
    // cell to decide whether the opt-in could succeed, then dropped it and
    // let the first beat ask the OS again one tick later. On a phone that
    // second request is a second chance to time out — and when it did, the
    // switch stayed ON with no count behind it, which the card rendered as
    // "Counting…" for the rest of the session.
    const near = await bootNear();
    const res = await near.enable();
    expect(res.ok).toBe(true);
    expect(h.cellCalls, "enable() paid for a second location fix").toBe(1);
    expect(near.count()).toBe(2);
    expect(near.lastError()).toBeNull();
    expect(h.presenceWrites.map((w) => w.path)).toEqual(["v2_presence/uid_test"]);
  });

  it("a refused fix leaves the switch off and never writes a presence doc", async () => {
    h.cellImpl = () => Promise.resolve({ ok: false as const, reason: "denied" });
    const near = await bootNear();
    const res = await near.enable();
    expect(res).toEqual({ ok: false, reason: "denied" });
    expect(near.on()).toBe(false);
    expect(h.presenceWrites).toEqual([]);
    expect(h.countCalls).toBe(0);
  });
});

describe("a beat that fails leaves a reason behind", () => {
  it("a callable that throws records lastError and keeps the count null", async () => {
    h.countImpl = () => Promise.reject(new Error("unavailable"));
    const near = await bootNear();
    await near.enable();
    // The write happened — it is the READ that failed, which is exactly the
    // case that used to leave the card counting forever.
    expect(h.presenceWrites.length).toBe(1);
    expect(near.count()).toBeNull();
    expect(near.lastError()).toBe("unavailable");
  });

  it("a failed beat does not blank the count it already had, and dates it", async () => {
    const near = await bootNear();
    await near.enable();
    expect(near.count()).toBe(2);
    const firstAt = near.updatedAt();
    expect(firstAt).toBeGreaterThan(0);

    // Now the location goes away mid-run (walked indoors, permission pulled).
    h.cellImpl = () => Promise.resolve({ ok: false as const, reason: "timeout" });
    await near.refresh();
    expect(near.lastError()).toBe("timeout");
    expect(near.count(), "a failed beat threw away the last good count").toBe(2);
    expect(near.updatedAt(), "the stale count lost the timestamp that dates it").toBe(firstAt);
  });

  it("lastError survives until a beat actually produces a count", async () => {
    // It used to be cleared the moment the FIX succeeded — before the write
    // and the callable, the two steps most likely to fail. A beat that got
    // its cell and then failed at the network therefore reported success on
    // the way in and a fresh error on the way out, and anything reading
    // between the two saw a healthy stall.
    h.countImpl = () => Promise.reject(new Error("nope"));
    const near = await bootNear();
    await near.enable();
    expect(near.lastError()).toBe("unavailable");

    h.countImpl = () => Promise.resolve({ n: 7 });
    await near.refresh();
    expect(near.lastError()).toBeNull();
    expect(near.count()).toBe(7);
  });

  it("refresh() while a beat is in flight resolves with THAT beat, not before it", async () => {
    // The card's Try again awaits this promise to stop its pending state.
    // An overlapping call used to return immediately, so the button stopped
    // spinning a tick after the tap and the answer landed seconds later.
    const near = await bootNear();
    await near.enable();
    const before = h.countCalls;

    let release: (v: { n: number }) => void = () => {};
    h.countImpl = () => new Promise((r) => { release = r; });
    const first = Promise.resolve(near.refresh());
    // Same tick, second caller: it must be waiting on the same beat.
    const second = Promise.resolve(near.refresh());
    let secondDone = false;
    void second.then(() => { secondDone = true; });
    // Wait until the beat has actually reached the callable and parked
    // there. By this point a promise chained onto the in-flight beat still
    // cannot have resolved; one that took the old early return has.
    await vi.waitFor(() => { expect(h.countCalls - before).toBe(1); });
    expect(secondDone, "the second caller resolved before the beat did").toBe(false);
    release({ n: 5 });
    await first; await second;
    expect(near.count()).toBe(5);
    expect(h.countCalls - before, "the overlapping call ran a second beat").toBe(1);
  });
});

describe("disable() — stop sharing means stop, now", () => {
  it("clears the count, the error and the doc", async () => {
    const near = await bootNear();
    await near.enable();
    expect(near.count()).toBe(2);
    await near.disable();
    expect(near.on()).toBe(false);
    expect(near.count()).toBeNull();
    expect(near.lastError()).toBeNull();
    expect(h.presenceDeletes).toEqual(["v2_presence/uid_test"]);
  });
});

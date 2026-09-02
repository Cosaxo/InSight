// The quota instrument (docs/ANSWER-SCALE.md §2.1): every `insight.*`
// write is guarded-and-swallowed, so a full origin quota fails EVERY
// store's persistence at once with no symptom — the app just stops
// remembering. lsSet (live.ts) is the sensor: it counts every swallowed
// write and reports the first QUOTA-shaped failure once per session.
//
// What each case pins, and the mutation that fails it:
//   - the session survives a dead storage (drop lsSet's catch → boot dies);
//   - the report fires ONCE however many writes fail (drop the
//     `quotaReported` latch → the count climbs);
//   - a non-quota failure counts but never reports (drop isQuotaError →
//     private-mode devices file a "quota" report apiece, and the signal
//     ANSWER-SCALE reads deadlines from is noise).
//
// Same harness shape as bank-cache.test.ts: live.ts holds module-level
// state, so every test rebuilds it against hoisted mocks.

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  reportError: vi.fn(),
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

vi.mock("./push", () => ({ registerPush: () => Promise.resolve() }));
vi.mock("firebase/functions", () => ({ getFunctions: vi.fn(), httpsCallable: vi.fn() }));

vi.mock("firebase/firestore", () => {
  const snapOf = (docs: Array<{ id: string; data: Record<string, unknown> }>) => ({
    size: docs.length,
    docs: docs.map((d) => ({
      id: d.id,
      data: () => ({ ...d.data }),
      get: (k: string) => d.data[k],
    })),
  });
  const bank = [{
    id: "q_1",
    data: {
      surface: "daily", seq: 1, type: "vote", prompt: "Prompt q_1",
      options: ["A", "B"], topic: null, test: null, active: true,
      updatedAt: { toMillis: () => 1000 },
    },
  }];
  return {
    collection: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
    doc: (_db: unknown, ...path: string[]) => ({ path: path.join("/") }),
    query: (src: { path?: string }) => ({ path: src?.path }),
    where: () => ({}),
    orderBy: () => ({}),
    limit: () => ({}),
    startAfter: () => ({}),
    documentId: () => ({}),
    serverTimestamp: () => ({}),
    Timestamp: { fromMillis: (ms: number) => ({ ms, toMillis: () => ms }) },
    getDoc: () =>
      Promise.resolve({ exists: () => false, get: () => undefined, data: () => ({}) }),
    getDocs: (q: { path?: string }) =>
      Promise.resolve(snapOf(q?.path === "v2_questions" ? bank : [])),
    onSnapshot: () => vi.fn(),
    setDoc: () => Promise.resolve(),
    updateDoc: () => Promise.resolve(),
    deleteDoc: () => Promise.resolve(),
    // D331: setPoliticalConsent removes the published compass with the
    // consent record, in one merge — a sentinel here, asserted in
    // political-consent.test.ts rather than in these boot fixtures.
    deleteField: () => "__delete__",
    terminate: () => Promise.resolve(),
    clearIndexedDbPersistence: () => Promise.resolve(),
    // D355: the queue-drained signal settlePending awaits — required
    // here like every other member live.ts binds, whether or not a case
    // reaches it (vitest throws on a member the factory does not define).
    waitForPendingWrites: () => Promise.resolve(),
  };
});

// A storage whose reads work and whose WRITES fail the configured way —
// which is exactly what a full origin looks like: getItem still answers,
// setItem throws on anything that would grow the store.
class FailingStorage {
  failWith: Error | null = null;
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    if (this.failWith) throw this.failWith;
    this.m.set(k, String(v));
  }
  removeItem(k: string): void { this.m.delete(k); }
  clear(): void { this.m.clear(); }
  key(i: number): string | null { return [...this.m.keys()][i] ?? null; }
  get length(): number { return this.m.size; }
}

let storage: FailingStorage;

const quotaError = () => {
  const e = new Error("QuotaExceededError: the quota has been exceeded");
  e.name = "QuotaExceededError";
  return e;
};

const quotaReports = () =>
  h.reportError.mock.calls.filter((c) => c[1]?.where === "quota");

async function bootLive() {
  const mod = await import("./live");
  await mod.initLive(1);
  // `attached` (D354): boot complete, not merely a deck on screen.
  await vi.waitFor(() => { expect(mod.default.attached).toBe(true); });
  return mod.default;
}

beforeEach(() => {
  vi.resetModules();
  h.reportError.mockClear();
  storage = new FailingStorage();
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

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("the quota instrument (lsSet)", () => {
  it("keeps the session alive on a full quota, counts every swallowed write, reports once", async () => {
    storage.failWith = quotaError();
    const LIVE = await bootLive();
    // The degradation is unchanged: a device that cannot persist still
    // answers questions this session.
    expect(LIVE.ready).toBe(true);
    // The fat caches live in IndexedDB since D312, so what boot still
    // writes to localStorage is the small keys — the feed mirror at
    // least — and every such write failed. The counter is the running
    // measure of how much this device is losing.
    expect(LIVE.stats.cacheWriteFailures).toBeGreaterThanOrEqual(1);
    // …but the REPORT is one per session, or a quota'd device becomes a
    // firehose aimed at the error budget.
    expect(quotaReports()).toHaveLength(1);
    expect(String(quotaReports()[0][0])).toMatch(/quota exceeded writing insight\./);
  });

  it("recognises the legacy code-22 spelling as quota", async () => {
    const legacy = new Error("QUOTA_EXCEEDED_ERR");
    (legacy as Error & { code?: number }).code = 22;
    legacy.name = "Error";
    storage.failWith = legacy;
    await bootLive();
    expect(quotaReports()).toHaveLength(1);
  });

  it("counts a non-quota storage failure without filing a quota report", async () => {
    // Private mode / disabled storage: an environment, not the box
    // filling. It must not pollute the signal ANSWER-SCALE reads
    // deadlines from.
    storage.failWith = new Error("SecurityError: storage disabled");
    const LIVE = await bootLive();
    expect(LIVE.ready).toBe(true);
    expect(LIVE.stats.cacheWriteFailures).toBeGreaterThanOrEqual(1);
    expect(quotaReports()).toHaveLength(0);
    // …and nothing else reported either: the write stays best-effort.
    expect(h.reportError).not.toHaveBeenCalled();
  });

  it("reports nothing at all when storage works", async () => {
    const LIVE = await bootLive();
    expect(LIVE.stats.cacheWriteFailures).toBe(0);
    expect(quotaReports()).toHaveLength(0);
  });
});

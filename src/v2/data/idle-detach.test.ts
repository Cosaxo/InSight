// @vitest-environment jsdom
//
// The deck aggregates, at the store — COSTS.md's listener fan-out, which was
// the one read source in the model that grew superlinearly in DAU.
//
// REWRITTEN AT D129, and the premise inverted. This file used to prove the
// fan-out was BOUNDED: seven `onSnapshot` listeners existed and were torn
// down after a minute of being hidden. They do not exist any more — the deck
// is polled — so the claim worth pinning got stronger and the old cases got
// vacuous. What is measured now is that the deck attaches no aggregate
// listener at all, that the poll is armed only while the app is visible, and
// that a tick asks about TODAY rather than the whole deck, which is what
// makes the replacement genuinely cheap rather than merely cheaper.
//
// The idle detach itself survives, for the reveal listeners, and its timer
// cases stay here because they are the same timer.
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
// What the arithmetic said (scripts/cost-arith.mjs): `fanOut` was
// DAU²/80 reads per day — 94% of the bill at 500 k DAU, and the reason the
// modelled 500 k figure was six figures. Polling removes the term, and
// `pollAggs` in the model now charges what the timer below actually costs
// rather than charging zero. If the poll interval here changes, the model
// reads it from this file and moves with it.

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
  // Every `v2_question_aggs` read, as the id list it asked for. The poll's
  // cost is exactly (ticks x ids per tick), so both halves are counted.
  aggQueries: [] as string[][],
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
    query: (src: { path?: string }, ...parts: Array<{ __kind: string; ids?: unknown }>) => ({
      __kind: "query",
      path: src?.path,
      ids: parts.find((x) => x?.__kind === "where" && Array.isArray(x.ids))?.ids,
    }),
    where: (_f: unknown, _op: unknown, ids: unknown) => ({ __kind: "where", ids }),
    orderBy: () => ({ __kind: "orderBy" }),
    // Required since D153 paged the bank fetch: live.ts destructures the
    // whole Firestore surface, so a missing member throws at boot.
    startAfter: () => ({ __kind: "startAfter" }),
    limit: () => ({ __kind: "limit" }),
    documentId: () => ({ __kind: "documentId" }),
    serverTimestamp: () => ({ __kind: "serverTimestamp" }),
    Timestamp: { fromMillis: (ms: number) => ({ ms }) },
    getDoc: () =>
      Promise.resolve({ exists: () => false, get: () => undefined, data: () => ({}) }),
    getDocs: (q: { path?: string; ids?: string[] }) => {
      if (q?.path === "v2_question_aggs") h.aggQueries.push(q.ids ?? []);
      return Promise.resolve(q?.path === "v2_questions" ? snapOf(h.bankDocs) : snapOf([]));
    },
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

// Since D129 the only listeners the idle detach owns are the per-group
// reveal ones — the aggregate listeners it was built for do not exist any
// more. `groupsUnsub` is deliberately NOT dropped (nothing short of a full
// refreshLive() re-attaches it), which is why the cases below name the
// collection they mean rather than counting every subscription.

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
  h.aggQueries.length = 0;
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

describe("deck aggregates are polled, not streamed (D129)", () => {
  const aggSubs = () => h.subs.filter((x) => x.path?.startsWith("v2_question_aggs"));

  it("attaches NO snapshot listener to the deck aggregates", async () => {
    await bootLive();
    // The assertion the bill cares about, and the inverse of what this file
    // asserted before D129. Every one of these was a live subscription to a
    // globally-shared document, re-delivered on every stranger's answer.
    expect(aggSubs()).toHaveLength(0);
  });

  it("reads the deck once on boot instead", async () => {
    await bootLive();
    // Losing the listener must not mean losing the counts: the deck is
    // fetched, so a card renders with real numbers on first paint.
    expect(h.aggQueries.length).toBeGreaterThan(0);
  });

  it("arms the poll while visible", async () => {
    const mod = await bootLive();
    expect(mod._aggPollForTest().running).toBe(true);
  });

  it("a poll tick asks about today only, not the whole deck", async () => {
    // This is what keeps the replacement cheap. Polling seven documents a
    // minute would trade a quadratic term for a flat one seven times larger
    // than it needs to be — and only today's aggregate is hot, because only
    // today's question is being answered by the whole population at once.
    const mod = await bootLive();
    h.aggQueries.length = 0;
    await mod._aggPollForTest().tick();
    expect(h.aggQueries).toHaveLength(1);
    expect(h.aggQueries[0]).toHaveLength(1);
  });

  it("stops polling immediately when the app is hidden", async () => {
    vi.useFakeTimers();
    const mod = await bootLive();
    expect(mod._aggPollForTest().running).toBe(true);

    setHidden(true);
    // IMMEDIATELY — no grace period. The grace exists because re-attaching
    // an onSnapshot re-delivers the document; re-arming a setInterval reads
    // nothing until it fires, so there is no swap to protect here.
    expect(mod._aggPollForTest().running).toBe(false);
  });

  it("does not read while hidden even if a tick escapes", async () => {
    // Belt and braces, and not hypothetical: some WebViews resume from a
    // kill without firing visibilitychange, which would leave the interval
    // armed against a screen nobody is looking at.
    vi.useFakeTimers();
    await bootLive();
    hidden = true;
    h.aggQueries.length = 0;
    vi.advanceTimersByTime(60_000);
    await vi.advanceTimersByTimeAsync(0);
    expect(h.aggQueries).toHaveLength(0);
  });

  it("re-arms the poll when the app comes back", async () => {
    vi.useFakeTimers();
    const mod = await bootLive();
    setHidden(true);
    expect(mod._aggPollForTest().running).toBe(false);

    setHidden(false);
    // wake() → resubscribeForToday() → startAggPoll() is async; drain it.
    await vi.advanceTimersByTimeAsync(0);
    await vi.waitFor(() => {
      expect(mod._aggPollForTest().running).toBe(true);
    });
    expect(mod.default.ready).toBe(true);
  });
});

describe("the idle detach, which now owns the reveal listeners alone", () => {
  it("arms on hide and cancels when the app returns before it fires", async () => {
    vi.useFakeTimers();
    const mod = await bootLive();

    setHidden(true);
    vi.advanceTimersByTime(30_000); // half-way
    expect(mod._idleDetachForTest().pending).toBe(true);
    setHidden(false);
    expect(mod._idleDetachForTest().pending).toBe(false);

    // Past the original deadline, and nothing fires — a stale timer would
    // drop a foregrounded app's reveal listeners with nothing to re-attach
    // them until the next visibility change.
    vi.advanceTimersByTime(60_000);
    expect(mod._idleDetachForTest().pending).toBe(false);
  });

  it("running the detach twice is a no-op", async () => {
    // The re-attach guard this used to protect lived in `subscribeAggs`,
    // which is gone. What remains is `revealUnsubs`, and the fixture here
    // has no groups — so this proves the call is idempotent, not that a
    // reveal unsub is invoked once. Kept at that reduced strength rather
    // than deleted, because a throw here would still be a real crash on
    // the hide path.
    vi.useFakeTimers();
    const mod = await bootLive();
    expect(() => {
      mod._idleDetachForTest().run();
      mod._idleDetachForTest().run();
    }).not.toThrow();
    expect(h.subs.filter((x) => x.path?.startsWith("v2_reveals") && !x.unsub.mock.calls.length))
      .toHaveLength(0);
  });
});

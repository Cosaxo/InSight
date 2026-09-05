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
  // The auth callback live.ts registers for the session, captured so a case
  // can drive an account SWITCH — the one presence path that had no test.
  authCb: null as null | ((u: { uid: string } | null) => void),
}));

vi.mock("../../lib/firebase", () => ({
  firebaseEnabled: true,
  anonSignIn: () => Promise.resolve("uid_test"),
  getDb: () => Promise.resolve({ __db: true, app: {} }),
  getFirestoreApi: () => import("firebase/firestore"),
  getFunctionsApi: () => import("firebase/functions"),
  linkGoogle: () => Promise.resolve(),
  googleSignOut: () => Promise.resolve(),
  subscribeToAuth: (cb: (u: { uid: string } | null) => void) => {
    h.authCb = cb;
    cb({ uid: "uid_test" });
    return () => {};
  },
}));

vi.mock("../../lib/sentry", () => ({ reportError: vi.fn(), setSentryUser: vi.fn() }));
vi.mock("./push", () => ({ registerPush: () => Promise.resolve() }));

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
    // Required since D161 paged the bank fetch: live.ts destructures the
    // whole Firestore surface, so a missing member throws at boot.
    startAfter: () => ({ __kind: "startAfter" }),
    limit: () => ({ __kind: "limit" }),
    documentId: () => "__name__",
    Timestamp: { fromMillis: (ms: number) => ({ toMillis: () => ms }), now: () => ({ toMillis: () => 0 }) },
    serverTimestamp: () => ({ __ts: true }),
    increment: (n: number) => ({ __inc: n }),
    writeBatch: () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: () => Promise.resolve() }),
    terminate: () => Promise.resolve(),
    clearIndexedDbPersistence: () => Promise.resolve(),
    // D357: the queue-drained signal settlePending awaits — required
    // here like every other member live.ts binds, whether or not a case
    // reaches it (vitest throws on a member the factory does not define).
    waitForPendingWrites: () => Promise.resolve(),
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
  const LIVE = mod.default as unknown as { attached: boolean; near: NearApi };
  await mod.initLive(1);
  // `attached` (D356): boot complete, not merely a deck on screen.
  await vi.waitFor(() => { expect(LIVE.attached).toBe(true); });
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
  h.authCb = null;
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

  // An account SWITCH looks like the same situation as "stop sharing", and
  // this suite briefly asserted the same remedy — resetForNewUid deleting
  // v2_presence/{outgoing}. It does not work, and the test passed anyway
  // because this harness mocks Firestore: it records the call, never the
  // rules' answer.
  //
  // resetForNewUid runs from the subscribeToAuth callback, which fires
  // AFTER the SDK has switched currentUser to the incoming account, so the
  // delete is signed by the new uid — and /v2_presence/{uid} is
  // `allow delete: if request.auth.uid == uid`. Measured on the emulator:
  // the outgoing account deleting its own cell succeeds, the incoming one
  // deleting the outgoing account's is denied.
  //
  // So no write is issued, and this pins that. What bounds the exposure is
  // `until` (capped at PRESENCE_LINGER_MIN in the rules, honoured by
  // nearbyCountV2); account deletion — the case that matters — is swept
  // server-side by deleteAccount, not by this path.
  it("issues no presence delete on an account switch — the rules would refuse it", async () => {
    const near = await bootNear();
    await near.enable();
    expect(h.presenceWrites.length).toBeGreaterThan(0);

    h.authCb!({ uid: "uid_other" });
    await new Promise((r) => setTimeout(r, 20));
    expect(
      h.presenceDeletes,
      "a delete signed by the INCOMING uid is denied by /v2_presence/{uid}",
    ).toEqual([]);
  });
});

// ── off or on, and what "on" promises (D174 §2, D370) ─────────────────
//
// D174 put a timed state between off and on and pinned four cases on it
// here: the default landing on `session`, a session clamping `until` to
// its deadline, `always` getting the full linger, and an expired session
// reading as off with no timer having run. D370 retired the timed state
// on the owner's word, so three of those cases have no subject. What
// survives is the promise the on state makes — a bounded `until`, a real
// margin inside the rules fence — and one new case: the upgrade path, a
// phone that stored the timed state and comes back to a build without it.
describe("the visibility states", () => {
  const untilOf = (i = 0) => {
    const u = h.presenceWrites[i].data.until as Date;
    return u instanceof Date ? u.getTime() : Number(u);
  };

  it("turning it on is the whole choice — on, with the full linger and no deadline", async () => {
    const near = await bootNear();
    await near.enable();
    expect(near.on()).toBe(true);
    // Still bounded: "on" is a setting with no end, not a position that
    // never expires. The linger is what makes a pocketed phone keep
    // standing in the room, and the rules cap it (D174 §2–3).
    expect(untilOf()).toBeGreaterThan(Date.now() + 150 * 60_000);
    expect(untilOf()).toBeLessThanOrEqual(Date.now() + 181 * 60_000);
  });

  it("writes `until` a clear margin INSIDE the rules ceiling, not exactly on it", async () => {
    // THE TWO CLOCKS. firestore.rules caps `until` at `request.time + 180m`
    // — the SERVER's clock — and this value is computed from the DEVICE's.
    // With no session deadline to clamp against, writing exactly the
    // linger made the two 180s cancel and reduced the rule to
    // `deviceNow <= serverNow`: the only slack was network latency, and
    // any phone running a little fast had every beat refused, forever,
    // with a retry button that could not work. Recorded at D181 — for
    // D174's `always`, which since D370 is every opted-in phone.
    //
    // The device-clock condition cannot be reproduced here — the emulator
    // and this process share one clock — so what is asserted is the
    // property that makes it survivable: the written deadline sits a real
    // margin inside the fence rather than on it. The bound below is
    // deliberately looser than the margin, so this case is about there
    // BEING one, not about its exact size.
    const near = await bootNear();
    await near.enable();
    const ceiling = Date.now() + 180 * 60_000;
    expect(untilOf(), "the write sits on the fence, so any fast clock is refused")
      .toBeLessThan(ceiling - 30_000);
    // …and it is still nearly the whole linger: this costs a minute of the
    // three hours, not an hour.
    expect(untilOf(), "the margin ate into the linger").toBeGreaterThan(Date.now() + 178 * 60_000);
  });

  it("a phone that stored the timed state comes back OFF, and the keys are swept", async () => {
    // The upgrade path. A D174 build could leave `session` and a deadline
    // on disk; reading them as "on" would turn a two-hour promise into no
    // deadline without anyone choosing that. Off is the only honest
    // reading, and the presence doc that build wrote expires by its own
    // `until` on the server.
    localStorage.setItem("insight.nearPresence.v1", "session");
    localStorage.setItem("insight.nearPresence.until.v1", String(Date.now() + 60 * 60_000));
    const near = await bootNear();
    expect(near.on()).toBe(false);
    expect(localStorage.getItem("insight.nearPresence.v1")).toBeNull();
    expect(localStorage.getItem("insight.nearPresence.until.v1")).toBeNull();
    expect(h.presenceWrites, "an upgraded-off phone must not beat").toHaveLength(0);
  });

  it("a phone that stored D174's `always` — or D84's `1` — comes back ON", async () => {
    for (const raw of ["always", "1"]) {
      vi.resetModules();
      h.presenceWrites = [];
      localStorage.clear();
      localStorage.setItem("insight.nearPresence.v1", raw);
      const near = await bootNear();
      expect(near.on(), `stored ${JSON.stringify(raw)} should read as on`).toBe(true);
      await near.disable();
    }
    booted = null;
  });
});

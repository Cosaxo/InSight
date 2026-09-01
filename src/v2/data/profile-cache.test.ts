// @vitest-environment jsdom
//
// The profile cache on disk (D129) — names and test scores for OTHER people,
// kept between sessions so the same regulars are not re-read every cold boot.
//
// WHY THIS FILE EXISTS. `state.names` was session-scoped and its declaration
// said it should stay that way. Reversing that is cheap to get subtly wrong
// in two directions, and only one of them is visible without a test:
//
//   Too little — persist `names` but not `scores`, and NOTHING is saved.
//   `fetchVoters` passes both to `resolveNames`, whose `missing` filter
//   requires a uid in BOTH maps, so a names-only cache leaves every profile
//   read exactly where it was while looking like it works. That is the case
//   this file exists for above all others, because it fails silently: the
//   cache fills, the hit rate looks fine, and the bill does not move.
//
//   Too much — let the payload load under a different account. Names are
//   public (D98) so this is not a disclosure bug, but it is the property the
//   old session-scoped note was really protecting, and it is the kind of
//   thing that is true on the day it ships and false a year later.
//
// The TTL is here for a third reason: a display name is a snapshot, and an
// account that renames shows its old name to everyone else until the entry
// expires. That window is a deliberate trade and a test is where a trade
// stops being a comment.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PROFILE_LS = "insight.profileCache.v1";

interface FakeDoc { id: string; data: Record<string, unknown> }

const h = vi.hoisted(() => ({
  reportError: vi.fn(),
  bankDocs: [] as FakeDoc[],
  // Every v2_users read, as the uid list it asked for. The whole point of
  // the cache is that this list gets shorter, so it is the measurement.
  profileReads: [] as string[][],
  // …and the same measurement for the face query (D178), which is what
  // shows the split below asks for faces WITHOUT re-asking for names.
  avatarReads: [] as string[][],
  avatars: {} as Record<string, Record<string, unknown>>,
  profiles: {} as Record<string, Record<string, unknown>>,
  answerDocs: [] as Array<{ path: string; data: Record<string, unknown> }>,
  uid: "uid_me",
}));

vi.mock("../../lib/firebase", () => ({
  firebaseEnabled: true,
  anonSignIn: () => Promise.resolve(h.uid),
  getDb: () => Promise.resolve({ __db: true }),
  getFirestoreApi: () => import("firebase/firestore"),
  getFunctionsApi: () => import("firebase/functions"),
  linkGoogle: () => Promise.resolve(),
  googleSignOut: () => Promise.resolve(),
  subscribeToAuth: (cb: (u: { uid: string } | null) => void) => {
    cb({ uid: h.uid });
    return () => {};
  },
}));

vi.mock("../../lib/sentry", () => ({ reportError: h.reportError, setSentryUser: vi.fn() }));
vi.mock("./push", () => ({ registerPush: () => Promise.resolve() }));
vi.mock("firebase/functions", () => ({ getFunctions: vi.fn(), httpsCallable: vi.fn() }));

vi.mock("firebase/firestore", () => {
  const ref = (kind: string, path: string[]) => ({ __kind: kind, path: path.join("/") });
  return {
    collection: (_db: unknown, ...p: string[]) => ref("collection", p),
    collectionGroup: (_db: unknown, name: string) => ref("collectionGroup", [name]),
    doc: (_db: unknown, ...p: string[]) => ref("doc", p),
    query: (src: { path?: string }, ...parts: Array<{ __kind: string; ids?: unknown }>) => ({
      __kind: "query",
      path: src?.path,
      ids: parts.find((x) => x?.__kind === "where" && Array.isArray(x.ids))?.ids,
    }),
    where: (_f: unknown, _op: unknown, ids: unknown) => ({ __kind: "where", ids }),
    orderBy: () => ({ __kind: "orderBy" }),
    // Required since D161 paged the bank fetch: live.ts destructures the
    // whole Firestore surface, so a missing member throws at boot.
    startAfter: () => ({ __kind: "startAfter" }),
    limit: () => ({ __kind: "limit" }),
    documentId: () => ({ __kind: "documentId" }),
    serverTimestamp: () => ({ __kind: "serverTimestamp" }),
    Timestamp: { fromMillis: (ms: number) => ({ ms }) },
    getDoc: () => Promise.resolve({ exists: () => false, get: () => undefined, data: () => ({}) }),
    getDocs: (q: { path?: string; ids?: string[] }) => {
      const mk = (docs: Array<{ id: string; path?: string; data: Record<string, unknown> }>) => ({
        size: docs.length,
        docs: docs.map((d) => ({
          id: d.id,
          ref: { path: d.path ?? d.id },
          data: () => d.data,
          get: (k: string) => d.data[k],
        })),
      });
      if (q?.path === "v2_questions") return Promise.resolve(mk(h.bankDocs));
      if (q?.path === "v2_users") {
        const ids = q.ids ?? [];
        h.profileReads.push([...ids]);
        return Promise.resolve(mk(
          ids.filter((u) => h.profiles[u]).map((u) => ({ id: u, data: h.profiles[u] })),
        ));
      }
      if (q?.path === "v2_avatars") {
        const ids = q.ids ?? [];
        h.avatarReads.push([...ids]);
        return Promise.resolve(mk(
          ids.filter((u) => h.avatars[u]).map((u) => ({ id: u, data: h.avatars[u] })),
        ));
      }
      if (q?.path === "answers") {
        return Promise.resolve(mk(h.answerDocs.map((a, i) => ({
          id: "a" + i, path: a.path, data: a.data,
        }))));
      }
      return Promise.resolve(mk([]));
    },
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
    // D343: the queue-drained signal settlePending awaits — required
    // here like every other member live.ts binds, whether or not a case
    // reaches it (vitest throws on a member the factory does not define).
    waitForPendingWrites: () => Promise.resolve(),
  };
});

function bank(): FakeDoc[] {
  return [{
    id: "q_1",
    data: {
      active: true, surface: "daily", kind: "choice",
      text: "A question", options: ["a", "b"], updatedAt: { toMillis: () => 1 },
    },
  }];
}

async function bootLive() {
  const mod = await import("./live");
  await mod.initLive(1);
  // `attached` (D342): boot complete, not merely a deck on screen.
  await vi.waitFor(() => { expect(mod.default.attached).toBe(true); });
  return mod;
}

// Every write to the cache key, counted — see `settle` below for why.
let cacheWrites = 0;
const realSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function (k: string, v: string) {
  if (k === PROFILE_LS) cacheWrites++;
  return realSetItem.call(this, k, v);
};

beforeEach(() => {
  vi.resetModules();
  cacheWrites = 0;
  localStorage.clear();
  h.reportError.mockClear();
  h.bankDocs = bank();
  h.profileReads.length = 0;
  h.uid = "uid_me";
  h.profiles = {
    uid_a: { displayName: "Ada", testResults: {} },
    uid_b: { displayName: "Bo", testResults: {} },
  };
  h.answerDocs = [
    { path: "v2_users/uid_a/answers/x", data: { qid: "q_1", optionIdx: 0, anchors: {} } },
    { path: "v2_users/uid_b/answers/y", data: { qid: "q_1", optionIdx: 1, anchors: {} } },
  ];
  vi.stubEnv("VITE_V2_LIVE", "true");
});

afterEach(() => { vi.unstubAllEnvs(); });

// The write is coalesced (live.ts AGG_CACHE_MS), so every case that inspects
// disk has to wait for it rather than assume a synchronous write.
//
// WAIT FOR THE WRITE, NOT FOR A NUMBER. This was `setTimeout(1200)` against
// a 1000 ms window — a 200 ms margin on a runner where four workers share
// four cores, and the measured settle is 1011 ms, so the real slack was
// 189 ms. It was also a figure with nothing behind it: raise AGG_CACHE_MS in
// live.ts and all six start failing with nothing pointing back here.
//
// Measured both ways at AGG_CACHE_MS = 2500: the old sleep failed three
// cases, this fails none of them on the wait itself — the one case that
// still reds does so on vitest's 5 s per-test default, because it boots the
// store twice and so spends two windows. That is a per-test budget rather
// than a drifted constant, and it says so when it happens.
//
// FAKE TIMERS WERE THE OTHER OPTION AND ARE NOT USED, recorded so nobody
// re-derives it: the coalescer is scheduled during `bootLive()`, so the
// clock would have to be faked from before that — which puts `bootLive`'s
// own `vi.waitFor` under the fake clock and needs every await in the store's
// boot advanced by hand. That is a lot of machinery to save ~6 s of a ~120 s
// suite, and it buys accuracy this does not already have.
// `pred` is for the cases that need a PARTICULAR write rather than the next
// one. The store coalesces per window, so a case whose subject arrives on a
// later write (the logic percentile below is one) would otherwise resume on
// the first and read a cache that is correct but not yet complete — which
// the old fixed sleep hid by outlasting all of them.
const settle = async (pred?: (raw: { e: Record<string, { l?: number | null }> } | null) => boolean) => {
  const before = cacheWrites;
  await vi.waitFor(
    () => {
      expect(cacheWrites, "the coalesced cache write never landed").toBeGreaterThan(before);
      if (!pred) return;
      const raw = JSON.parse(localStorage.getItem(PROFILE_LS) || "null");
      expect(pred(raw), "a cache write landed, but not the one this case waits for").toBe(true);
    },
    { timeout: 5000, interval: 25 },
  );
};

describe("the profile cache survives a session", () => {
  it("writes names AND scores, because a names-only cache saves nothing", async () => {
    const mod = await bootLive();
    await mod.default.loadVoters("q_1");
    await settle();

    const raw = JSON.parse(localStorage.getItem(PROFILE_LS) || "null");
    expect(raw).not.toBeNull();
    expect(raw.owner).toBe("uid_me");
    expect(raw.e.uid_a.n).toBe("Ada");
    // The half that is easy to forget and impossible to notice: resolveNames
    // treats a uid as missing unless it is in BOTH maps, so an entry without
    // `s` would be re-fetched on the next boot and the cache would be inert.
    expect(raw.e.uid_a).toHaveProperty("s");
  });

  it("a second session reads no profiles at all", async () => {
    const first = await bootLive();
    await first.default.loadVoters("q_1");
    await settle();
    expect(h.profileReads.length).toBeGreaterThan(0);

    // Same account, fresh process.
    vi.resetModules();
    h.profileReads.length = 0;
    const second = await bootLive();
    await second.default.loadVoters("q_1");

    // The assertion the bill cares about.
    expect(h.profileReads).toHaveLength(0);
    expect(second.default.nameFor("uid_a")).toBe("Ada");
  });

  it("refuses to load under a different account", async () => {
    const first = await bootLive();
    await first.default.loadVoters("q_1");
    await settle();

    vi.resetModules();
    h.profileReads.length = 0;
    h.uid = "uid_someone_else";
    const second = await bootLive();
    // Nothing from the previous account is readable…
    expect(second.default.nameFor("uid_a")).toBe("");
    // …and the names it does show, it paid for itself.
    await second.default.loadVoters("q_1");
    expect(h.profileReads.length).toBeGreaterThan(0);
  });

  it("expires an entry past the TTL so a rename cannot stick forever", async () => {
    const first = await bootLive();
    await first.default.loadVoters("q_1");
    await settle();

    // Age every entry past the window, in place — the TTL is read at load
    // time, so this is the whole mechanism under test.
    const raw = JSON.parse(localStorage.getItem(PROFILE_LS) || "null");
    const EIGHT_DAYS = 8 * 24 * 60 * 60 * 1000;
    for (const v of Object.values(raw.e as Record<string, { t: number }>)) {
      v.t = Date.now() - EIGHT_DAYS;
    }
    localStorage.setItem(PROFILE_LS, JSON.stringify(raw));

    vi.resetModules();
    h.profileReads.length = 0;
    h.profiles.uid_a = { displayName: "Ada Renamed", testResults: {} };
    const second = await bootLive();
    await second.default.loadVoters("q_1");

    expect(h.profileReads.length).toBeGreaterThan(0);
    expect(second.default.nameFor("uid_a")).toBe("Ada Renamed");
  });

  it("survives a corrupt payload rather than taking the boot down", async () => {
    localStorage.setItem(PROFILE_LS, "{not json");
    const mod = await bootLive();
    expect(mod.default.ready).toBe(true);
    expect(mod.default.nameFor("uid_a")).toBe("");
  });

  it("the logic percentile rides the same entry, and heals a pre-D227 cache", async () => {
    h.profiles.uid_a = { displayName: "Ada", testResults: { logic: { pctile: 88 } } };
    const first = await bootLive();
    await first.default.loadVoters("q_1");
    await settle((raw) => raw?.e?.uid_a?.l === 88);

    const raw = JSON.parse(localStorage.getItem(PROFILE_LS) || "null");
    expect(raw.e.uid_a.l).toBe(88);
    // Untested persists as null, not as absence — absence means "never
    // fetched" and would put the uid back into the query every session.
    expect(raw.e.uid_b.l).toBeNull();

    // A cache written BEFORE D227 lacks the key entirely. The next session
    // must re-read those profiles once — the alternative is a sheet that
    // shows every cached regular as "untested" forever — and then hold
    // the answer like any other entry.
    for (const v of Object.values(raw.e as Record<string, { l?: number | null }>)) delete v.l;
    localStorage.setItem(PROFILE_LS, JSON.stringify(raw));
    vi.resetModules();
    h.profileReads.length = 0;
    const second = await bootLive();
    await second.default.loadVoters("q_1");
    expect(h.profileReads.length).toBeGreaterThan(0);
    await settle();
    const healed = JSON.parse(localStorage.getItem(PROFILE_LS) || "null");
    expect(healed.e.uid_a.l).toBe(88);
  });
});

describe("resolveNames asks for what is missing, not for the union", () => {
  beforeEach(() => {
    h.profileReads.length = 0;
    h.avatarReads.length = 0;
    h.profiles = {};
    h.avatars = {};
  });

  it("does not re-read a profile it already holds just because the face is wanted", () => {
    // THE regression, and the one D129's cache was silently losing to.
    // Names and scores persist across sessions; faces deliberately do not
    // (D178 — a token cached past a remove verdict is a removed face still
    // rendering). The `missing` filter used to be a union, so every uid
    // whose name and score were already in hand went back into the
    // v2_users query purely because its face was not — which is every uid,
    // on every surface that draws faces, on every open.
    return (async () => {
      const { resolveNames } = await import("./voters");
      h.profiles = { u1: { displayName: "Ada" } };
      h.avatars = { u1: { token: "tok1" } };
      // A warm cache: name and score known, face unknown.
      const names: Record<string, string> = { u1: "Ada" };
      const scores: Record<string, unknown> = { u1: null };
      const faces: Record<string, string> = {};
      await resolveNames(
        { __db: true } as never, ["u1"], names,
        scores as Record<string, never>, faces,
      );
      expect(h.profileReads, "a cached profile was re-read for want of a face").toEqual([]);
      expect(h.avatarReads).toEqual([["u1"]]);
      expect(faces.u1).toBe("tok1");
    })();
  });

  it("still reads the profile when the name is the missing half", () => {
    // The other direction, so the fix cannot be "never read profiles".
    return (async () => {
      const { resolveNames } = await import("./voters");
      h.profiles = { u2: { displayName: "Grace" } };
      const names: Record<string, string> = {};
      const faces: Record<string, string> = { u2: "" };
      await resolveNames({ __db: true } as never, ["u2"], names, undefined, faces);
      expect(h.profileReads).toEqual([["u2"]]);
      expect(h.avatarReads, "a cached face was re-read for want of a name").toEqual([]);
      expect(names.u2).toBe("Grace");
    })();
  });

  it("asks both when both are missing, in one round trip", () => {
    return (async () => {
      const { resolveNames } = await import("./voters");
      h.profiles = { u3: { displayName: "Alan" } };
      h.avatars = { u3: { token: "tok3" } };
      const names: Record<string, string> = {};
      const faces: Record<string, string> = {};
      await resolveNames({ __db: true } as never, ["u3"], names, undefined, faces);
      expect(h.profileReads).toEqual([["u3"]]);
      expect(h.avatarReads).toEqual([["u3"]]);
    })();
  });

  it("caches each absence against its own query, not the other's", () => {
    // The trap in splitting them: marking a face absent because the
    // PROFILE query covered that uid would cache "no photo" for someone
    // whose avatar was never asked about, and D178's convention is that a
    // cached "" is never re-fetched.
    return (async () => {
      const { resolveNames } = await import("./voters");
      const names: Record<string, string> = { u4: "Known" };
      const faces: Record<string, string> = {};
      await resolveNames({ __db: true } as never, ["u4"], names, undefined, faces);
      // The face query ran and found nothing, so "" is correct here.
      expect(faces.u4).toBe("");
      expect(h.profileReads).toEqual([]);
    })();
  });

  it("still reads the profile when the logic percentile is the missing half (D227)", () => {
    // The pre-D227 warm cache: name and score in hand, logic never asked.
    // Skipping the read would show the whole roster as "untested"; one
    // round fills it and the maps agree from then on.
    return (async () => {
      const { resolveNames } = await import("./voters");
      h.profiles = { u5: { displayName: "Ada", testResults: { logic: { pctile: 88 } } } };
      const names: Record<string, string> = { u5: "Ada" };
      const scores: Record<string, unknown> = { u5: null };
      const logic: Record<string, number | null> = {};
      await resolveNames(
        { __db: true } as never, ["u5"], names,
        scores as Record<string, never>, undefined, logic,
      );
      expect(h.profileReads).toEqual([["u5"]]);
      expect(logic.u5).toBe(88);

      h.profileReads.length = 0;
      await resolveNames(
        { __db: true } as never, ["u5"], names,
        scores as Record<string, never>, undefined, logic,
      );
      expect(h.profileReads, "a healed cache was re-read").toEqual([]);
    })();
  });

  it("caches 'untested' as null so absence is not re-fetched (D227)", () => {
    return (async () => {
      const { resolveNames } = await import("./voters");
      h.profiles = { u6: { displayName: "Lin" } };
      const names: Record<string, string> = {};
      const logic: Record<string, number | null> = {};
      await resolveNames({ __db: true } as never, ["u6"], names, undefined, undefined, logic);
      expect(logic.u6).toBeNull();

      h.profileReads.length = 0;
      await resolveNames({ __db: true } as never, ["u6"], names, undefined, undefined, logic);
      expect(h.profileReads).toEqual([]);
    })();
  });
});

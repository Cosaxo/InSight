// @vitest-environment jsdom
//
// The profile cache on disk (D125) — names and test scores for OTHER people,
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
vi.mock("./push", () => ({ registerPushForReveals: () => Promise.resolve() }));
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
    terminate: () => Promise.resolve(),
    clearIndexedDbPersistence: () => Promise.resolve(),
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
  await vi.waitFor(() => { expect(mod.default.ready).toBe(true); });
  return mod;
}

beforeEach(() => {
  vi.resetModules();
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

// The write is coalesced (AGG_CACHE_MS), so every case that inspects disk
// has to outlast the window rather than assume a synchronous write.
const settle = () => new Promise((r) => setTimeout(r, 1200));

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
});

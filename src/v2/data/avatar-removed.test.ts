// @vitest-environment jsdom
//
// A REMOVED FACE MUST NOT GO BACK IN THE BUCKET, and for a while the app
// itself was what put it there.
//
// Moderation removes a photo by freezing `v2_avatars/{uid}` (`hidden:
// true`) and deleting the object. `storage.rules` cannot see that freeze —
// Storage rules have no cross-database `firestore.get()` — so its grant on
// `avatars/{uid}` is ownership, size and type and nothing more. The ORDER
// inside `setAvatar` was therefore the only protection, and it ran the
// wrong way round: upload, then write. The upload SUCCEEDED, the document
// write was refused, the caller was told "removed" — and the image was
// live again under a path `allow read: if request.auth != null` serves to
// any signed-in caller BY PATH. No download token is needed for that, so
// the frozen document does not gate the bytes.
//
// What this pins is the order, which is the whole fix: on a removed face
// nothing is uploaded at all. The modified-client half cannot be closed in
// storage.rules and docs/MODERATION.md § Faces says so now rather than
// claiming the removal is durable.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type FakeDoc = { id: string; data: Record<string, unknown> };

const h = vi.hoisted(() => ({
  /** What `v2_avatars/{uid}` says when the app asks — the moderator's word. */
  hidden: false,
  exists: true,
  /** Every object write the run attempted. Empty is the property. */
  uploads: [] as string[],
  /** …and the document writes, so the healthy path is still proved to work. */
  avatarDocWrites: [] as Record<string, unknown>[],
  bankDocs: [] as FakeDoc[],
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
  subscribeToAuth: (cb: (u: { uid: string } | null) => void) => { cb({ uid: "uid_test" }); return () => {}; },
}));

vi.mock("../../lib/sentry", () => ({ reportError: h.reportError, setSentryUser: vi.fn() }));
vi.mock("./push", () => ({ registerPush: () => Promise.resolve() }));
vi.mock("firebase/functions", () => ({ getFunctions: vi.fn(), httpsCallable: vi.fn() }));

// The shrinker wants a real canvas and jsdom has none. Only that one
// function is replaced — `avatarPath` and the size cap stay real, so the
// path this asserts on is the path the rules grant.
// Declared outright rather than spread over the real module: live.ts
// imports `./avatar` at module scope, and an `importOriginal` round-trip
// inside its mock never settles here. These are the four names live.ts
// binds, and the two that matter are real values — the path the rules
// grant, and the cap they mirror.
vi.mock("./avatar", () => ({
  AVATAR_PX: 256,
  AVATAR_MAX_BYTES: 256 * 1024,
  avatarPath: (uid: string) => `avatars/${uid}`,
  avatarUrl: (uid: string, token: string) => `https://x/${uid}?token=${token}`,
  shrinkToSquare: async (b: Blob) => b,
  tokenFromUrl: (u: string) => (/token=([A-Za-z0-9_-]+)/.exec(u) || [])[1] || "",
}));

vi.mock("firebase/storage", () => ({
  getStorage: () => ({ __storage: true }),
  ref: (_s: unknown, path: string) => ({ __path: path }),
  uploadBytes: async (r: { __path: string }) => { h.uploads.push(r.__path); },
  getDownloadURL: async () => "https://x/o/avatars%2Fu?alt=media&token=tok_abcdefgh",
  deleteObject: async () => {},
}));

vi.mock("firebase/firestore", () => {
  const ref = (kind: string, path: string[]) => ({ __kind: kind, path: path.join("/") });
  const snapOf = (docs: FakeDoc[]) => ({
    size: docs.length,
    docs: docs.map((d) => ({ id: d.id, data: () => d.data, get: (k: string) => d.data[k] })),
  });
  return {
    collection: (_db: unknown, ...p: string[]) => ref("collection", p),
    doc: (_db: unknown, ...p: string[]) => ref("doc", p),
    query: (src: { path?: string }) => ({ __kind: "query", path: src?.path }),
    where: () => ({ __kind: "where" }),
    orderBy: () => ({ __kind: "orderBy" }),
    startAfter: () => ({ __kind: "startAfter" }),
    limit: () => ({ __kind: "limit" }),
    documentId: () => ({ __kind: "documentId" }),
    serverTimestamp: () => ({ __kind: "serverTimestamp" }),
    Timestamp: { fromMillis: (ms: number) => ({ ms }) },
    getDoc: (t: { path?: string }) => Promise.resolve(
      t?.path === "v2_avatars/uid_test"
        ? { exists: () => h.exists, get: (k: string) => (k === "hidden" ? h.hidden : undefined), data: () => ({ hidden: h.hidden }) }
        : { exists: () => false, get: () => undefined, data: () => ({}) },
    ),
    getDocs: (q: { path?: string }) => Promise.resolve(
      q?.path === "v2_questions" ? snapOf(h.bankDocs) : snapOf([]),
    ),
    onSnapshot: () => vi.fn(),
    setDoc: (t: { path?: string }, data: Record<string, unknown>) => {
      if (t?.path === "v2_avatars/uid_test") h.avatarDocWrites.push(data);
      return Promise.resolve();
    },
    updateDoc: () => Promise.resolve(),
    deleteDoc: () => Promise.resolve(),
    deleteField: () => "__delete__",
    terminate: () => Promise.resolve(),
    clearIndexedDbPersistence: () => Promise.resolve(),
    waitForPendingWrites: () => Promise.resolve(),
  };
});

async function bootLive() {
  // `initLive` returns immediately on anything but a live build — the
  // reason a jsdom mount and the demo never arm the store at all.
  vi.stubEnv("VITE_V2_LIVE", "true");
  const mod = await import("./live");
  await mod.initLive(1);
  // `attached` (D356): boot complete, not merely a deck on screen.
  // `attached` (D356): boot complete, not merely a deck on screen.
  await vi.waitFor(() => { expect(mod.default.attached).toBe(true); });
  return mod.default;
}

/** A blob the mocked shrinker passes straight through. */
const file = () => new Blob([new Uint8Array(64)], { type: "image/jpeg" });

beforeEach(() => {
  h.hidden = false; h.exists = true;
  h.uploads.length = 0; h.avatarDocWrites.length = 0;
  h.bankDocs = [{
    id: "q_1",
    data: {
      active: true, surface: "daily", kind: "choice",
      text: "A question", options: ["a", "b"], updatedAt: { toMillis: () => 1 },
    },
  }];
  h.reportError.mockClear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe("setAvatar on a face moderation removed", () => {
  it("uploads nothing when the document is frozen", async () => {
    h.hidden = true;
    const LIVE = await bootLive();

    const out = await LIVE.setAvatar(file());

    expect(out.ok, "a removed face was accepted").toBe(false);
    expect(out.reason).toBe("removed");
    expect(
      h.uploads,
      "the removed image went back in the bucket, which serves it to any signed-in caller by path",
    ).toEqual([]);
    expect(h.avatarDocWrites, "a frozen document was written to").toEqual([]);
  });

  it("still uploads for a face nobody has removed", async () => {
    // The control. Without it the case above would pass against a
    // `setAvatar` that had simply stopped working.
    const LIVE = await bootLive();

    const out = await LIVE.setAvatar(file());

    expect(out.ok, out.reason || "").toBe(true);
    expect(h.uploads, "the healthy path stopped uploading").toEqual(["avatars/uid_test"]);
    expect(h.avatarDocWrites.length).toBe(1);
  });

  it("uploads for an account that has no avatar document yet", async () => {
    // `exists() === false` is the first-photo case, and reading it as
    // frozen would lock every new account out of ever setting one.
    h.exists = false;
    const LIVE = await bootLive();

    const out = await LIVE.setAvatar(file());

    expect(out.ok, out.reason || "").toBe(true);
    expect(h.uploads).toEqual(["avatars/uid_test"]);
  });
});

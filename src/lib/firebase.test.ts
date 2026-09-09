// The memoised SDK loader, and the one thing it must NOT memoise.
//
// `impl()` caches its promise so the Firebase SDK is imported once however
// many call sites race for it. That is right for a resolved promise and
// catastrophic for a rejected one: `getDb()` and every surface in this file
// await the identical promise, so a chunk fetch that failed transiently —
// offline for a moment, or a deploy swapping the asset mid-session — would
// hand every later caller the same rejection for the life of the page, with
// nothing left in the system able to retry.
//
// Mocked at the module boundary rather than by reaching into the cache: the
// contract under test is "a second call after a failure tries again", which
// is observable from outside and would survive the memo being rewritten.
import { afterEach, describe, expect, it, vi } from "vitest";

const OK = { init: vi.fn(), fsApi: vi.fn(() => ({ __fs: true })), __ok: true };

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("./firebaseImpl");
  vi.unstubAllEnvs();
});

async function loadWithImpl(behaviours: Array<"throw" | "ok">) {
  let call = 0;
  vi.doMock("./firebaseImpl", () => {
    const mode = behaviours[Math.min(call++, behaviours.length - 1)];
    if (mode === "throw") throw new Error("chunk load failed");
    return OK;
  });
  // The four required keys, or `impl()` short-circuits before the import.
  vi.stubEnv("VITE_FIREBASE_API_KEY", "k");
  vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "d");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "p");
  vi.stubEnv("VITE_FIREBASE_APP_ID", "a");
  vi.resetModules();
  return { mod: await import("./firebase"), calls: () => call };
}

describe("the memoised SDK loader", () => {
  it("does not cache a failure: a later caller gets a fresh attempt", async () => {
    const { mod, calls } = await loadWithImpl(["throw", "ok"]);
    await expect(mod.getFirestoreApi()).rejects.toThrow();
    expect(calls(), "the first attempt did not reach the module").toBe(1);
    // The whole point. Before the fix this rejected again, forever, without
    // importing anything — the poisoned promise answering from the cache.
    await expect(
      mod.getFirestoreApi(),
      "a transient chunk failure poisoned Firebase for the life of the session",
    ).resolves.toBeTruthy();
    expect(calls(), "the retry did not re-import").toBe(2);
  });

  it("still caches SUCCESS — the memo is repaired, not deleted", async () => {
    const { mod, calls } = await loadWithImpl(["ok"]);
    await expect(mod.getFirestoreApi()).resolves.toBeTruthy();
    await expect(mod.getFirestoreApi()).resolves.toBeTruthy();
    expect(calls(), "the SDK was imported twice for two callers").toBe(1);
  });
});

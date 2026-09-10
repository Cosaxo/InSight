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

const OK = {
  init: vi.fn(), fsApi: vi.fn(() => ({ __fs: true })), __ok: true,
  subscribeToAuth: vi.fn(() => () => {}),
};
const REPORT = vi.fn();

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("./firebaseImpl");
  vi.doUnmock("./sentry");
  vi.unstubAllEnvs();
  OK.subscribeToAuth.mockClear();
  OK.init.mockClear();
  REPORT.mockClear();
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
  vi.doMock("./sentry", () => ({ reportError: REPORT, setSentryUser: vi.fn() }));
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
    // …AND IT INITIALISES FIREBASE, which is the one line in `impl()` that
    // nothing asked about. Deleting `m.init(config)` — the call that
    // constructs the app, Auth, Firestore and the App Check attestation
    // behind it — left every suite here, `tsc -b` and eslint green.
    expect(OK.init, "the SDK was imported and never initialised").toHaveBeenCalledTimes(1);
  });
});

// A SUBSCRIPTION HAS NO LATER CALLER. Everything else here reaches the SDK
// through `impl()` on demand, so the memo repairing itself is enough: the
// next `getDb()` tries again. The auth observer is wired ONCE per session
// behind a flag (live.ts's `authWired`, purchases.ts), so a rejection that
// is swallowed there is not a slow start — it is an app that never watches
// auth again, and live.ts says at its own call site what that costs: the
// store samples `uid` once, so signing into a different account leaves the
// previous account's votes in memory and draws them as the new account's.
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("the auth observer", () => {
  it("wires itself after a transient chunk failure", async () => {
    const { mod, calls } = await loadWithImpl(["throw", "ok"]);
    mod.subscribeToAuth(() => {});
    await flush();
    expect(calls(), "the retry did not re-import").toBe(2);
    expect(OK.subscribeToAuth, "the observer was never wired").toHaveBeenCalledTimes(1);
    expect(REPORT, "a failure that recovered was still reported").not.toHaveBeenCalled();
  });

  it("reports when it cannot wire, rather than swallowing it", async () => {
    const { mod } = await loadWithImpl(["throw", "throw"]);
    mod.subscribeToAuth(() => {});
    await flush();
    expect(OK.subscribeToAuth).not.toHaveBeenCalled();
    expect(REPORT, "the app lost its auth observer and said nothing").toHaveBeenCalledTimes(1);
    expect(REPORT.mock.calls[0]?.[1]).toEqual({ where: "subscribeToAuth" });
  });

  it("stays silent on a build with no Firebase — the case the old comment named", async () => {
    // No config keys stubbed, so `impl()` rejects before importing anything.
    vi.doMock("./sentry", () => ({ reportError: REPORT, setSentryUser: vi.fn() }));
    vi.resetModules();
    const mod = await import("./firebase");
    mod.subscribeToAuth(() => {});
    await flush();
    expect(REPORT, "the demo has no auth to watch; that is not an error").not.toHaveBeenCalled();
  });
});

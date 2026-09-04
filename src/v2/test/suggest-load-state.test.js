// @vitest-environment jsdom
//
// "Nothing from you yet — ask one above." — said to a buyer with a booking
// in review.
//
// `mine()` reads the two live row sets through `|| []`, and both are null
// until their queries answer and STAY null on a throw. So three states
// were one empty array: still reading, the read failed, and you have
// genuinely asked nothing. The door drew the third for all of them — on
// every first frame, and permanently when the read failed, because the
// catch swallowed it with a comment saying the empty state would do.
//
// purchases.ts already argues the distinction out ("settling the rows to []
// would trade the hang for a lie") and AskedByYouOverlay already draws all
// three from that shape. This door was the one that did not.
//
// Driven through the store rather than the overlay: the states are decided
// there, and the two data modules are dynamic imports the store resolves
// itself, which is exactly the seam a mock belongs on.
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("../data/suggestions");
  vi.doUnmock("../data/paidBookings");
  localStorage.clear();
  vi.unstubAllEnvs();
});

// The store in LIVE mode, with both row sources under our control.
// `asks`/`books` are what the accessors return: null = the query has not
// answered, [] = it answered with nothing.
async function liveStore({ asks = null, books = null, reject = false } = {}) {
  vi.stubEnv("VITE_V2_LIVE", "1");
  vi.doMock("../data/suggestions", () => ({
    myRows: () => asks,
    subscribeMine: () => () => {},
    loadMine: () => (reject ? Promise.reject(new Error("network")) : Promise.resolve(asks ?? [])),
  }));
  vi.doMock("../data/paidBookings", () => ({
    myBookings: () => books,
    subscribeBookings: () => () => {},
    loadBookings: () => (reject ? Promise.reject(new Error("network")) : Promise.resolve(books ?? [])),
  }));
  vi.doMock("../data/cohortLabels", () => ({ bucketLabel: (x) => String(x) }));
  // LIVE.enabled is what the store branches on, and it has to be true
  // BEFORE ensureLive runs or the whole method returns early.
  const LIVE = (await import("../data/live")).default;
  Object.defineProperty(LIVE, "enabled", { value: true, configurable: true, writable: true });
  const mod = await import("../spec/suggestions.js");
  return mod.SUGGESTIONS;
}

// Let ensureLive's chain settle. Microtask turns are NOT enough — it awaits
// three dynamic imports, which are real module loads and settle on the
// macrotask queue. Measured: with `await Promise.resolve()` alone every
// case still read 'loading', which would have made four of them pass for
// the wrong reason in the other direction.
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };

describe("what an empty paid door actually means", () => {
  it("says it is still reading before the queries answer", async () => {
    const S = await liveStore({ asks: null, books: null });
    S.ensureLive();
    await settle();
    expect(S.mine(), "fixture: the list must be empty for this to be the state in question").toEqual([]);
    expect(S.mineState(), "an unanswered query read as 'you have asked nothing'").toBe("loading");
  });

  it("says the read failed when it failed", async () => {
    const S = await liveStore({ reject: true });
    S.ensureLive();
    await settle();
    expect(S.mineState(), "a failed read read as 'you have asked nothing'").toBe("failed");
  });

  it("says nothing-yet only when both queries answered with nothing", async () => {
    // THE CONTROL. Without it every case above is satisfied by a store that
    // never reports 'ready', and the door would then never draw its real
    // empty state — the one case a first-time buyer is supposed to see.
    const S = await liveStore({ asks: [], books: [] });
    S.ensureLive();
    await settle();
    expect(S.mine()).toEqual([]);
    expect(S.mineState(), "a genuinely empty account was told the read was still running").toBe("ready");
  });

  it("is ready when one query answered with a row and the other with nothing", async () => {
    const S = await liveStore({
      asks: [{ id: "a", prompt: "p", type: "vote", options: [], status: "review", atMs: 1 }],
      books: [],
    });
    S.ensureLive();
    await settle();
    expect(S.mineState()).toBe("ready");
    expect(S.mine().length, "the row itself stopped reaching the list").toBe(1);
  });

  it("clears a previous failure when the door is reopened", async () => {
    // The catch records the failure; a reopen has to retry rather than
    // showing yesterday's error forever.
    const S = await liveStore({ reject: true });
    S.ensureLive();
    await settle();
    expect(S.mineState()).toBe("failed");
    S.ensureLive();
    expect(S.mineState(), "a reopen kept reporting the old failure").toBe("loading");
  });
});

describe("demo mode is unaffected", () => {
  it("is always ready — its rows are there at import", async () => {
    vi.stubEnv("VITE_V2_LIVE", "");
    vi.resetModules();
    const S = (await import("../spec/suggestions.js")).SUGGESTIONS;
    expect(S.mineState()).toBe("ready");
    expect(S.mine().length, "the demo table stopped reaching the list").toBeGreaterThan(0);
  });
});

// The buyer's room has THREE states behind one null, and only had copy
// for two.
//
// `mine()` answers null before the read lands and null after it fails,
// and `loadMine` assigned `rows` on the success path only. A throw from
// the query — offline, a rules refusal — left the cache null forever, so
// the room drew "Reading your contracts…" for the life of the session:
// a spinner with nothing behind it, no error and no way back. The call
// site's own comment said "the empty state stands", which it did not.
//
// Settling the cache to an empty list would have been smaller and worse:
// it trades the hang for a lie, telling a buyer whose read failed that
// nothing was ever bought from this account. So the failure is recorded
// as its own fact and the room says which one it is.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const S = vi.hoisted(() => ({ throws: false }));

vi.mock("../../lib/firebase", () => ({
  getDb: async () => ({}),
  getFirestoreApi: async () => ({
    collection: () => ({}),
    doc: () => ({}),
    getDoc: async () => ({ exists: () => false, data: () => ({}) }),
    getDocs: async () => {
      if (S.throws) throw new Error("permission-denied");
      return { docs: [] };
    },
    query: () => ({}),
    where: () => ({}),
  }),
  // A signed-in account, emitted synchronously: the loader's own
  // first-call microtask wait is for the opposite case and is not what
  // these cases are about.
  subscribeToAuth: (f: (u: { uid: string } | null) => void) => { f({ uid: "u1" }); return () => {}; },
}));

let purchases: typeof import("./purchases");

beforeEach(async () => {
  S.throws = false;
  vi.resetModules();
  purchases = await import("./purchases");
});

afterEach(() => { S.throws = false; });

describe("a read that fails", () => {
  it("is not left looking like a read still in flight", async () => {
    S.throws = true;
    await expect(purchases.loadMine()).rejects.toThrow(/permission-denied/);
    // Still null — there is nothing honest to show — but no longer
    // indistinguishable from "not started".
    expect(purchases.mine(), "a failed read must not invent an empty ledger").toBeNull();
    expect(purchases.mineFailed(), "the failure was swallowed").toBe(true);
  });

  it("tells the room, so it can stop saying it is reading", async () => {
    S.throws = true;
    // WIRE AUTH FIRST, and count only after. This case asserted on a
    // notification count from a bare subscribe and passed with the fix
    // reverted — `loadMine` calls `wireAuth`, whose auth emission fires
    // its own `notify()`, so the counter was reading the sign-in, not
    // the failure. Draining that here is the difference between a case
    // about this fix and a case about the mock.
    purchases.mine();
    let woke = 0;
    purchases.subscribePurchases(() => { woke += 1; });
    await expect(purchases.loadMine()).rejects.toThrow();
    expect(woke, "nothing was notified, so the room never re-rendered").toBeGreaterThan(0);
  });
});

describe("a read that succeeds", () => {
  // The control. Both assertions above are about a flag being SET, and a
  // flag that is simply always set would satisfy them.
  it("leaves no failure behind it", async () => {
    await expect(purchases.loadMine()).resolves.toEqual([]);
    expect(purchases.mine()).toEqual([]);
    expect(purchases.mineFailed()).toBe(false);
  });
});

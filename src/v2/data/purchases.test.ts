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

const S = vi.hoisted(() => ({
  throws: false,
  /** Rows the query answers with; empty unless a case wants them. */
  docs: [] as { id: string; data: () => Record<string, unknown> }[],
  /** How many times the query was actually issued. */
  queries: 0,
  /** Held open by a case that needs to switch accounts mid-flight. */
  gate: null as null | Promise<void>,
  openGate: null as null | (() => void),
  /** The auth callback, so a case can emit a second account. */
  emit: null as null | ((u: { uid: string } | null) => void),
}));

vi.mock("../../lib/firebase", () => ({
  getDb: async () => ({}),
  getFirestoreApi: async () => ({
    collection: () => ({}),
    doc: () => ({}),
    getDoc: async () => ({ exists: () => false, data: () => ({}) }),
    getDocs: async () => {
      S.queries += 1;
      // Captured at CALL time, so two flights can be held on two different
      // gates and released in either order.
      const g = S.gate;
      if (g) await g;
      if (S.throws) throw new Error("permission-denied");
      return { docs: S.docs };
    },
    query: () => ({}),
    where: () => ({}),
  }),
  // A signed-in account, emitted synchronously: the loader's own
  // first-call microtask wait is for the opposite case and is not what
  // these cases are about.
  subscribeToAuth: (f: (u: { uid: string } | null) => void) => { S.emit = f; f({ uid: "u1" }); return () => {}; },
}));

let purchases: typeof import("./purchases");

beforeEach(async () => {
  S.throws = false;
  S.docs = [];
  S.queries = 0;
  S.gate = null;
  S.openGate = null;
  S.emit = null;
  vi.resetModules();
  purchases = await import("./purchases");
});

afterEach(() => { S.throws = false; S.gate = null; });

/** One turn of the timer queue: the loader awaits getDb and the API module
 *  before it ever calls getDocs, so a case that counts queries has to let
 *  those settle first. A first draft asserted straight after `loadMine()`
 *  and read zero. */
const tick = () => new Promise((r) => setTimeout(r, 0));

/** Hold the NEXT query open, and hand back the key to release it. */
function holdQuery(): () => void {
  let open = () => {};
  S.gate = new Promise<void>((r) => { open = r; });
  S.openGate = open;
  return open;
}

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

// ── a read that belongs to the account that started it ──
//
// `rows` was cleared on an account change and the still-running closure
// then assigned the previous account's rows straight back over the top —
// unconditionally, on the success path. Nothing else clears `rows` and this
// store has no purge listener, so the wrong account's contracts stayed for
// the whole session: prompt text, price, budget cap, spend, window, report
// shelf. The account panel is itself the sign-out screen and starts this
// load on its own mount, so the window is one round trip after opening
// exactly the screen where the switch happens.
describe("an account change under a read in flight", () => {
  const ROW = { id: "p1", data: () => ({ uid: "u1", kind: "question", qid: "q1", headline: "A's contract" }) };

  it("does not commit the previous account's contracts to the new one", async () => {
    S.docs = [ROW];
    const release = holdQuery();
    const inFlight = purchases.loadMine();
    // …the account changes while the query is out.
    S.emit?.({ uid: "u2" });
    let woke = 0;
    purchases.subscribePurchases(() => { woke += 1; });
    release();
    await inFlight;

    expect(purchases.mine(), "the previous account's contracts landed under the new one").toBeNull();
    expect(purchases.mineFailed(), "a stale flight pinned a failure on the new account").toBe(false);
    expect(woke, "the room was told to re-render with the old account's rows").toBe(0);
  });

  it("still commits when nobody switched — the control", async () => {
    // Without this, a guard that never commits satisfies the case above
    // and the store simply stops working.
    S.docs = [ROW];
    await purchases.loadMine();
    expect(purchases.mine()?.length, "a read that owns its account did not commit").toBe(1);
    expect(purchases.mine()?.[0].headline).toBe("A's contract");
  });

  it("does not let a finished stale flight free the new account's slot", async () => {
    // The half the first draft of this fix got wrong, and the reason the
    // `finally` is guarded rather than plain. Clearing `loading` on the
    // switch is right; the OLD flight then finishing and clearing it again
    // is not — it wipes the new flight's promise out of the slot, so the
    // next caller starts a third concurrent query and the in-flight dedupe
    // is defeated for the rest of the session. On a store whose whole
    // posture is one bounded query, that is a billed-read regression.
    //
    // TWO GATES, released in the order that matters: the stale flight
    // finishes FIRST, while the fresh one is still out. Releasing both at
    // once cannot tell the two versions apart — measured, after a first
    // draft of this case passed with the guard removed.
    S.docs = [ROW];
    const releaseStale = holdQuery();
    const stale = purchases.loadMine();
    await tick();
    S.emit?.({ uid: "u2" });
    const releaseFresh = holdQuery();
    const fresh = purchases.loadMine();
    await tick();
    expect(fresh, "the new account joined the previous account's read").not.toBe(stale);
    expect(S.queries, "the new account did not issue its own query").toBe(2);

    releaseStale();
    await stale;
    // The fresh flight is STILL out. A third caller must join it, not
    // start a query of its own.
    const third = purchases.loadMine();
    await tick();
    expect(third, "the stale flight freed the slot the fresh one was holding").toBe(fresh);
    expect(S.queries, "a third query was issued while one was already in flight").toBe(2);

    releaseFresh();
    await fresh;
  });

  it("shares one query between two concurrent callers with no switch — the control", async () => {
    const release = holdQuery();
    const a = purchases.loadMine();
    const b = purchases.loadMine();
    expect(a, "the in-flight dedupe stopped working").toBe(b);
    release();
    await a;
    await tick();
    expect(S.queries).toBe(1);
  });
});

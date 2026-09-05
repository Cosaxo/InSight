// THE SAME DEFECT, IN THE SAME SHAPE, IN THE THIRD COPY OF ONE STORE.
//
// purchases.ts, suggestions.ts and paidBookings.ts are one account-scoped
// session cache written three times. All three cleared `rows` on an account
// change and left the still-running closure to assign the previous account's
// rows straight back over the top. `purchases.test.ts` carries the full
// argument and the in-flight-slot half; this file exists so the copy cannot
// quietly drift back — a store with no sibling test is how the shape decayed
// the first time.
import { beforeEach, describe, expect, it, vi } from "vitest";

const S = vi.hoisted(() => ({
  docs: [] as { id: string; data: () => Record<string, unknown> }[],
  queries: 0,
  gate: null as null | Promise<void>,
  emit: null as null | ((u: { uid: string } | null) => void),
}));

vi.mock("../../lib/firebase", () => ({
  getDb: async () => ({}),
  getFirestoreApi: async () => ({
    collection: () => ({}),
    getDocs: async () => {
      S.queries += 1;
      const g = S.gate;
      if (g) await g;
      return { docs: S.docs };
    },
    query: () => ({}),
    where: () => ({}),
  }),
  subscribeToAuth: (f: (u: { uid: string } | null) => void) => { S.emit = f; f({ uid: "u1" }); return () => {}; },
}));

let store: typeof import("./suggestions");
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  S.docs = [];
  S.queries = 0;
  S.gate = null;
  S.emit = null;
  vi.resetModules();
  store = await import("./suggestions");
});

describe("an account change under a read in flight", () => {
  const ROW = { id: "r1", data: () => ({ uid: "u1", text: "A's suggestion" }) };

  it("does not commit the previous account's rows to the new one", async () => {
    S.docs = [ROW];
    let open = () => {};
    S.gate = new Promise<void>((r) => { open = r; });
    const inFlight = store.loadMine();
    await tick();
    S.emit?.({ uid: "u2" });
    let woke = 0;
    store.subscribeMine(() => { woke += 1; });
    open();
    await inFlight;

    expect(store.myRows(), "the previous account's rows landed under the new one").toBeNull();
    expect(woke, "the room was told to re-render with the old account's rows").toBe(0);
  });

  it("still commits when nobody switched — the control", async () => {
    // Without this, a guard that never commits satisfies the case above and
    // the store simply stops working.
    S.docs = [ROW];
    await store.loadMine();
    expect(store.myRows()?.length, "a read that owns its account did not commit").toBe(1);
  });

  it("leaves the in-flight slot to the flight that owns it", async () => {
    // The guarded `finally`. purchases.test.ts has the full version with two
    // gates; this asserts the property that matters — a stale flight
    // finishing must not free the slot a live one is holding.
    S.docs = [ROW];
    let openStale = () => {};
    S.gate = new Promise<void>((r) => { openStale = r; });
    const stale = store.loadMine();
    await tick();
    S.emit?.({ uid: "u2" });
    let openFresh = () => {};
    S.gate = new Promise<void>((r) => { openFresh = r; });
    const fresh = store.loadMine();
    await tick();
    expect(fresh, "the new account joined the previous account's read").not.toBe(stale);
    openStale();
    await stale;
    const third = store.loadMine();
    await tick();
    expect(third, "the stale flight freed the slot the fresh one was holding").toBe(fresh);
    expect(S.queries, "a third query was issued while one was already in flight").toBe(2);
    openFresh();
    await fresh;
  });
});

// @vitest-environment jsdom
//
// `ensureToday`'s one caching decision (D234) — its own file because the
// question needs a LIVE store with a bank that changes underneath it, and
// `pulse.test.ts` mocks the store as `enabled: false`, which returns from
// the first line of this function. Vitest gives each file its own module
// registry, so the two mocks cannot see each other.
//
// THE PROPERTY: an empty roster is the bank not having arrived, not a day
// with no pulses. `roster()` reads `LIVE.pulseQs()`, which is empty until
// the bank hydrates, and the old `!ids.length` branch sat INSIDE the async
// IIFE with no `await` before it — so the whole body ran synchronously and
// `finally { loadingToday = null }` executed BEFORE the assignment that
// stores the promise. The assignment then put an already-SETTLED promise
// in the in-flight slot, and `if (loadingToday) return loadingToday`
// answered every later call instantly. The crowd was never fetched again
// for the life of the module, and the purge listener resets `todayAggs`
// and `loadedForKey` but not that slot, so nothing recovered it.
//
// Latent rather than live when it was found — `daily-split` builds its
// card list from `dueToday()`, which filters the same roster, so no card
// mounts to make the call. It is pinned anyway because the ONE caller is
// PulseCard's mount effect, and that effect is registered ABOVE the
// `if (!PULSE.ready()) return null` early return: it runs whenever a card
// mounts before the bank arrives, which is exactly the case the comment
// beside that return already promises is safe.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface DayAggDoc { counts: Record<string, number>; total: number }

const h = vi.hoisted(() => ({
  /** The bank, mutable per test — empty is "not arrived yet". */
  bank: [] as { id: string; prompt: string; options: string[] }[],
  /** Every id list `getDocs` was asked for. The property is a statement
   *  about exactly this: did a fetch happen at all. */
  queries: [] as string[][],
  aggs: {} as Record<string, DayAggDoc>,
}));

vi.mock("./live", () => ({
  default: {
    enabled: true,
    anchors: () => ({ city: "Oslo, NO", country: "NO" }),
    pulseQs: () => h.bank,
    pulseVotes: () => ({}),
    votePulse: () => Promise.resolve(),
    subscribe: () => () => {},
  },
}));

vi.mock("../../lib/firebase", () => ({
  getDb: () => Promise.resolve({}),
  getFirestoreApi: () => Promise.resolve({
    collection: (_db: unknown, path: string) => path,
    documentId: () => "__name__",
    where: (_f: unknown, _op: string, ids: string[]) => ids,
    query: (_c: unknown, ids: string[]) => ids,
    getDocs: (ids: string[]) => {
      h.queries.push(ids);
      return Promise.resolve({
        docs: ids.filter((id) => id in h.aggs).map((id) => ({ id, data: (): DayAggDoc => h.aggs[id] })),
      });
    },
  }),
}));

const PULSE = await import("./pulse");

const FIVE = ["Crawling", "Dragging", "Steady", "Brisk", "Flying"];
const pad = (n: number) => String(n).padStart(2, "0");
/** UTC, because every key the module writes and reads is UTC. */
const today = (): string => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

beforeEach(() => {
  h.bank = [];
  h.queries = [];
  h.aggs = {};
  // The module caches today's aggregates at module scope and the file
  // imports it once, so each case starts from the purge the store fires
  // on an account change — the same reset D51 gives a real device.
  window.dispatchEvent(new Event("insight:local-purge"));
});
afterEach(() => { window.dispatchEvent(new Event("insight:local-purge")); });

describe("ensureToday and a bank that has not arrived", () => {
  it("does not treat an empty roster as a loaded day", async () => {
    // The call that used to poison the module.
    await PULSE.ensureToday();
    expect(h.queries, "an empty roster should ask for nothing").toEqual([]);

    // …the bank arrives, exactly as it does on a real device a moment
    // after the first paint.
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    h.aggs[`pulse-pace_${today()}`] = { counts: { "3": 4 }, total: 4 };
    await PULSE.ensureToday();

    // THE WHOLE BUG, in one assertion: before the fix this was still `[]`,
    // because the first call had recorded today as loaded from nothing.
    expect(h.queries.length, "the crowd was never fetched once the bank arrived").toBe(1);
    expect(h.queries[0]).toEqual([`pulse-pace_${today()}`]);
    expect(PULSE.default.bins("pulse-pace", "world")).toEqual([0, 0, 0, 100, 0]);
  });

  it("still caches a real load, so arriving twice costs one query", async () => {
    // The other half, and the reason the guard exists at all: the fix must
    // not turn every mount into a fetch. Only the EMPTY case is uncached.
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    await PULSE.ensureToday();
    await PULSE.ensureToday();
    await PULSE.ensureToday();
    expect(h.queries.length).toBe(1);
  });

  it("re-fetches on force, which is what an answer uses", async () => {
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    await PULSE.ensureToday();
    await PULSE.ensureToday(true);
    expect(h.queries.length).toBe(2);
  });
});

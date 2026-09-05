// @vitest-environment jsdom
//
// `ensureToday`'s one caching decision (D243) — its own file because the
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
  /** pid → your own option index for today, still unfolded. */
  pending: {} as Record<string, number>,
  /** A reader who has never set a city — no bucket, so no city cohort. */
  noCity: false,
}));

vi.mock("./live", () => ({
  default: {
    enabled: true,
    anchors: () => (h.noCity ? { country: "NO" } : { city: "Oslo, NO", country: "NO" }),
    pulseQs: () => h.bank,
    pulseVotes: () => ({}),
    // Your own answer for today while the fold has not counted it — the
    // member `pulse.ts` joins into every crowd it states. Mocked here
    // rather than guarded there: a `LIVE.x ? LIVE.x() : null` in the
    // module would be dead against the real store (an imported binding
    // whose object literal always defines it) and would exist only to
    // paper over this mock being short of a member the surface list
    // pins.
    pulsePending: (pid: string): number | null => (pid in h.pending ? h.pending[pid] : null),
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
  h.pending = {};
  h.noCity = false;
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

  it("counts you into your own city's crowd before anyone else there has answered", async () => {
    // THE FIRST IN YOUR CITY TODAY, which is where the two halves of one
    // sentence disagreed. `todayN` counted a pending answer whenever one
    // existed; `bins` counted it only where the published cell already
    // did — and a city nobody has answered from today HAS no cell. So the
    // card read "0% of 1 answer today" under your own step: the share of
    // a crowd of one, which is you, drawn at the bar's minimum height.
    // The same wrong number the pending join was added to remove, one
    // cohort narrower.
    //
    // The world cut is the control in the same breath: five real answers
    // from elsewhere, none of them yours, so the two scopes must give
    // different numbers off one document.
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    h.aggs[`pulse-pace_${today()}`] = {
      counts: { "0": 2, "1": 3 },
      total: 5,
      by: { city: { "Bergen, NO": { "0": 2, "1": 3 } } },
    } as DayAggDoc;
    h.pending["pulse-pace"] = 3;
    await PULSE.ensureToday();

    expect(
      PULSE.default.todayN("pulse-pace", "city"),
      "your own unfolded answer left your city's crowd",
    ).toBe(1);
    expect(
      PULSE.default.bins("pulse-pace", "city"),
      "a crowd of one, and the one is you — 100% on your own step",
    ).toEqual([0, 0, 0, 100, 0]);

    // …and the world cut, which the same document does answer: five
    // published plus you.
    expect(PULSE.default.todayN("pulse-pace", "world")).toBe(6);
    expect(PULSE.default.bins("pulse-pace", "world")).toEqual([33, 50, 0, 17, 0]);
  });

  it("does not count you into a cohort you have no anchor for", async () => {
    // The other direction. `pendingIdx` decides membership from YOUR
    // anchor, so a reader with no city set is in no city cut — counting
    // them would state a crowd of one about a place the app cannot name.
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    h.aggs[`pulse-pace_${today()}`] = { counts: { "0": 2 }, total: 2 };
    h.pending["pulse-pace"] = 3;
    h.noCity = true;
    await PULSE.ensureToday();

    expect(PULSE.default.todayN("pulse-pace", "city")).toBe(0);
    expect(PULSE.default.bins("pulse-pace", "city")).toEqual([0, 0, 0, 0, 0]);
    // …while the world cut still counts you, which is what makes the
    // assertion above about membership rather than about the join.
    expect(PULSE.default.todayN("pulse-pace", "world")).toBe(3);
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

// ── trendReady: the distinction `aggFor` cannot make ──
//
// `aggFor` answers null for "fetched, nobody answered" and "never fetched"
// alike, and PulseTrends folded both into a confident zero — "20 days with
// no answers in Oslo", about a city that had answered every day. The panel
// now asks this instead, and these cases are what stop it becoming a
// synonym for `aggFor` again.
describe("trendReady — fetched-and-empty is not never-fetched", () => {
  it("is false before the window lands and true after", async () => {
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    expect(PULSE.default.trendReady("pulse-pace"), "a window nobody asked for read as landed")
      .toBe(false);
    await PULSE.ensureTrend("pulse-pace");
    expect(PULSE.default.trendReady("pulse-pace"), "the landed window did not read as landed")
      .toBe(true);
  });

  it("is TRUE for a window that landed with nothing in it", async () => {
    // The whole point, and the half a `!!aggFor(...)` implementation would
    // get wrong: `h.aggs` is empty, so all 21 days come back null. That is
    // a crowd that answered nothing — a real reading — and the panel is
    // entitled to say so. Only the unfetched case must stay silent.
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    await PULSE.ensureTrend("pulse-pace");
    expect(h.queries.length, "nothing was fetched — the case is vacuous").toBe(1);
    expect(PULSE.default.trendReady("pulse-pace")).toBe(true);
  });

  it("answers per pulse, not per module", async () => {
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    await PULSE.ensureTrend("pulse-pace");
    expect(PULSE.default.trendReady("pulse-mood"), "one landed window vouched for another")
      .toBe(false);
  });

  it("goes back to false on the purge, so the next account inherits nothing", async () => {
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    await PULSE.ensureTrend("pulse-pace");
    window.dispatchEvent(new Event("insight:local-purge"));
    expect(PULSE.default.trendReady("pulse-pace")).toBe(false);
  });
});

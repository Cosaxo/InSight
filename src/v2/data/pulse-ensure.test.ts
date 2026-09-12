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
  /** Every id `ensureTrend` reported as folded. */
  folded: [] as string[],
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
    // The store's clear for an aggregate it did not fetch. RECORDED, not
    // ignored: that this read tells the store its mark is spent is the
    // whole of the fix, and a stub that swallows it silently would let
    // the wiring be deleted with every case still green.
    noteFolded: (aid: string) => { h.folded.push(aid); },
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
describe("the trend read spends today's unfolded mark", () => {
  it("tells the store the day it just re-read", async () => {
    // The mark exists because the forced refetch after an answer
    // "reliably loses the race with the fold" — so it must stand until a
    // read that does not, and NOTHING cleared it: both of the store's
    // drains iterate aggregates live.ts fetched for the deck, and a pulse
    // id is never one of those. The trend is that later read. Without
    // this line the overlay is added on top of a fold that already holds
    // the vote, and the card's own crowd moves by one because the reader
    // opened the chart.
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    expect(h.folded, "something reported a fold before any read").toEqual([]);
    await PULSE.ensureTrend("pulse-pace");
    const today = new Date().toISOString().slice(0, 10);
    expect(h.folded, "the trend read did not spend today's mark")
      .toEqual([`pulse-pace_${today}`]);
  });

  it("…and names TODAY, not the oldest day in the window", async () => {
    // The control on the id: the window is twenty-one days and only the
    // last of them can carry a mark, since a mark is set on the answer
    // and cleared by the next read. Naming any other day would clear
    // nothing and hide the defect behind a green case.
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    await PULSE.ensureTrend("pulse-pace");
    const old = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
    expect(h.folded[0]).not.toContain(old);
  });
});

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

// ── the trend's last point and the card above it are one crowd ──
//
// D365 moved the pending join into `bins` and `todayN`. It did not reach
// `scope()`, which builds the 21-day series the trend draws — so the card
// said "of 6 answers today" over a line whose today read no answers, and
// being first in your city put your own answer in the count while the
// point for it was absent. The join now lives in `cutOf`, which is the one
// function both readings share; these cases are what stops it splitting
// again.
describe("scope() — the day series joins your unfolded answer, today only", () => {
  const last = (id: string) => PULSE.default.scope("pulse-pace", id).series[PULSE.DAYS - 1];

  it("counts you into today's point, exactly as the card beside it does", async () => {
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    h.aggs[`pulse-pace_${today()}`] = { counts: { "0": 2, "1": 3 }, total: 5 };
    h.pending["pulse-pace"] = 3;
    await PULSE.ensureToday();

    // Five published at steps 1 and 2, plus your own 4: (2 + 6 + 4) / 6.
    expect(last("world").n, "the trend's today point dropped your answer").toBe(6);
    expect(last("world").mean).toBeCloseTo(2, 6);
    // THE PROPERTY, not a second spelling of the numbers above: the two
    // readings are of one crowd, so they may not differ. Before the fix
    // this was 5 against 6.
    expect(last("world").n).toBe(PULSE.default.todayN("pulse-pace", "world"));
  });

  it("draws a point for a city where you are the first today", async () => {
    // The count said one and the trend said none — over the same word.
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    h.aggs[`pulse-pace_${today()}`] = {
      counts: { "0": 2, "1": 3 },
      total: 5,
      by: { city: { "Bergen, NO": { "0": 2, "1": 3 } } },
    } as DayAggDoc;
    h.pending["pulse-pace"] = 3;
    await PULSE.ensureToday();

    expect(last("city").n).toBe(1);
    expect(last("city").mean).toBe(4);
    expect(last("city").n).toBe(PULSE.default.todayN("pulse-pace", "city"));
    // Still under THIN, so counted and not placed — which is the honest
    // pair, and different from the absent point the bug drew.
    expect(last("city").placed).toBe(false);
    expect(last("city").thin).toBe(true);
  });

  it("agrees with the card on every scope at once", async () => {
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    h.aggs[`pulse-pace_${today()}`] = {
      counts: { "0": 2, "1": 3 },
      total: 5,
      by: { city: { "Oslo, NO": { "1": 1 } }, country: { NO: { "1": 1, "0": 1 } } },
    } as DayAggDoc;
    h.pending["pulse-pace"] = 2;
    await PULSE.ensureToday();

    for (const id of ["city", "country", "world"]) {
      expect(last(id).n, `${id}: the trend and the card state one crowd`)
        .toBe(PULSE.default.todayN("pulse-pace", id));
    }
    expect(last("city").n).toBe(2);
    expect(last("country").n).toBe(3);
    expect(last("world").n).toBe(6);
  });

  it("does not count you into a cohort you have no anchor for", async () => {
    // Membership is `pendingIdx`'s call, and it is the same call the card
    // makes — a reader with no city is in no city cut on either surface.
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    h.aggs[`pulse-pace_${today()}`] = { counts: { "0": 2 }, total: 2 };
    h.pending["pulse-pace"] = 3;
    h.noCity = true;
    await PULSE.ensureToday();

    expect(last("city").n).toBe(0);
    expect(last("city").mean).toBe(null);
    expect(last("world").n).toBe(3);
  });

  it("joins TODAY and no other day in the window", async () => {
    // The join is a statement about an answer written today. A pending
    // answer added to every point would raise a three-week line by one.
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    const y = new Date();
    y.setUTCDate(y.getUTCDate() - 1);
    const yKey = `${y.getUTCFullYear()}-${pad(y.getUTCMonth() + 1)}-${pad(y.getUTCDate())}`;
    h.aggs[`pulse-pace_${yKey}`] = { counts: { "0": 4 }, total: 4 };
    h.aggs[`pulse-pace_${today()}`] = { counts: { "0": 4 }, total: 4 };
    h.pending["pulse-pace"] = 3;
    await PULSE.ensureTrend("pulse-pace");
    await PULSE.ensureToday();

    const series = PULSE.default.scope("pulse-pace", "world").series;
    expect(series[PULSE.DAYS - 2].n, "yesterday must not carry today's answer").toBe(4);
    expect(series[PULSE.DAYS - 2].mean).toBe(1);
    expect(series[PULSE.DAYS - 1].n).toBe(5);
    // Every earlier day is empty, so nothing else moved either.
    expect(series.slice(0, PULSE.DAYS - 2).every((d) => d.n === 0)).toBe(true);
  });

  it("leaves a day with no document alone, as the card does", async () => {
    // `todayN` returns 0 for an absent reading on purpose — the card's
    // "first answer today" arm is about exactly that — and a lone trend
    // point drawn from your own vote would be a claim about a crowd
    // nobody has read.
    h.bank = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    h.pending["pulse-pace"] = 3;
    await PULSE.ensureToday();

    expect(last("world").n).toBe(0);
    expect(last("world").n).toBe(PULSE.default.todayN("pulse-pace", "world"));
  });
});

describe("the roster past Firestore's `in` cap (D481)", () => {
  // WHY THIS EXISTS. `fetchAggs` issued ONE `where(documentId(), "in",
  // ids)` for however many ids it was handed, and that was correct for
  // both callers by accident: `ensureTrend` asks for a fixed 21 and
  // `ensureToday` asked for one id per pulse, of which there were five.
  //
  // At THIRTY-ONE pulses the query is rejected outright — the crowd read
  // fails, `todayState()` goes to "failed", and every pulse card in the
  // feed says so, for every user, until the roster shrinks. A cliff, not
  // a slope, and the pulse lane adding one a week from five would have
  // reached it in about six months.
  //
  // The mock cannot reject an over-long `in` the way Firestore does, so
  // what these cases assert is the shape that keeps it from ever being
  // sent: no single query carries more than thirty ids, and the answers
  // still arrive whole across the chunks.
  const roster = (n: number) => Array.from({ length: n }, (_, i) => ({
    id: `pulse-${i}`, prompt: `Pulse ${i}?`, options: FIVE,
  }));

  it("never asks for more than thirty ids in one query", async () => {
    h.bank = roster(31);
    await PULSE.ensureToday();
    expect(h.queries.length, "thirty-one ids went out as one query").toBe(2);
    for (const q of h.queries) expect(q.length).toBeLessThanOrEqual(30);
    expect(h.queries.flat().length, "an id was dropped between the chunks").toBe(31);
  });

  it("still reads every pulse's crowd across the chunks", async () => {
    // The half a length check cannot see: chunking that loses the second
    // page would satisfy every assertion above.
    h.bank = roster(31);
    h.aggs[`pulse-0_${today()}`] = { counts: { "0": 4 }, total: 4 };
    h.aggs[`pulse-30_${today()}`] = { counts: { "4": 7 }, total: 7 };
    await PULSE.ensureToday();

    expect(PULSE.default.todayState()).toBe("ready");
    expect(PULSE.default.todayN("pulse-0", "world"), "the first chunk's crowd").toBe(4);
    expect(PULSE.default.todayN("pulse-30", "world"), "the second chunk's crowd").toBe(7);
  });

  it("leaves the roster that fits in one query as one query", async () => {
    // The cap is a ceiling, not a page size: a roster of thirty must not
    // suddenly cost two reads per feed open because the loop exists.
    h.bank = roster(30);
    await PULSE.ensureToday();
    expect(h.queries.length).toBe(1);
    expect(h.queries[0].length).toBe(30);
  });

  it("keeps the trend read at one query, whatever the roster", async () => {
    // `ensureTrend` asks for the 21-day window of ONE pulse, so it was
    // never near the cap and must not have been pushed over it either.
    h.bank = roster(31);
    h.queries = [];
    await PULSE.ensureTrend("pulse-0");
    expect(h.queries.length).toBe(1);
    expect(h.queries[0].length).toBe(PULSE.DAYS);
  });
});

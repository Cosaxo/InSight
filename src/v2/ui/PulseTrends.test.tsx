// @vitest-environment jsdom
//
// The pulse reading's five honesty rules, which are computed HERE.
//
// WHY THIS FILE EXISTS. PulseTrends is 277 lines, live on the Map's pulse
// leaf and inside the daily's pulse card, and no test imported it — 0% of
// every metric. What made that matter is where the rules live: `data/pulse`
// hands over days and scopes, and the DRAWING is what decides that a day
// with no answers has no mark, that a thin day is listed rather than
// placed, that a day the cadence never asked on is not a skip, and that
// every reading carries its n.
//
// Each of those is a sentence about the reader's own life, and each fails
// plausibly. A `?? 0` in the series read turns "nobody answered" into
// "everyone scored zero" and renders a perfectly convincing flat line.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

const DAYS = 21;

const h = vi.hoisted(() => ({
  days: [] as unknown[],
  series: [] as unknown[],
  trendCalls: [] as string[],
  trendReady: true,
  /** Set to a promise that never settles to hold the panel in "reading". */
  trendPromise: null as Promise<void> | null,
}));

const step = (v: number, label: string) => ({ v, label });

vi.mock("../data/pulse", () => ({
  default: {
    DAYS: 21,
    THIN: 20,
    SCOPES: ["city", "country", "world"],
    first: () => "pulse-pace",
    q: () => ({ id: "pulse-pace", kicker: "Pace", text: "How was today's pace?", steps: [] }),
    steps: () => [step(1, "Slow"), step(2, "Easy"), step(3, "Steady"), step(4, "Full"), step(5, "Frantic")],
    word: (_p: string, v: number) => ["", "Slow", "Easy", "Steady", "Full", "Frantic"][v] ?? "",
    days: () => h.days,
    scope: (_p: string, id: string) => ({ id, label: id === "city" ? "Oslo" : id, short: id, series: h.series }),
    streak: () => 0,
    fmtN: (n: number) => String(n),
    cadence: () => "daily",
    ensureTrend: (pid: string) => { h.trendCalls.push(pid); return h.trendPromise ?? Promise.resolve(); },
    // The mock is wholesale, so a new member has to be added here or every
    // case throws. Default true — these eight cases hand `scope()` a fully
    // populated window and are about what the panel DRAWS from one, not
    // about the read. `h.trendReady` is the one knob the unread case turns.
    trendReady: () => h.trendReady,
    subscribe: () => () => {},
  },
}));

vi.mock("../data/mapCue", () => ({ cueMap: vi.fn() }));

/** A full window, all absent, which every case then edits. */
function blank(): void {
  h.days = Array.from({ length: DAYS }, (_, i) => ({
    i, key: `d${i}`, date: new Date(2026, 6, 1 + i), label: String(i),
    today: i === DAYS - 1, weekStart: i % 7 === 0, v: null, scheduled: true,
  }));
  h.series = Array.from({ length: DAYS }, (_, i) => ({
    // `scheduled` since 2026-08-31: an unscheduled day comes back as n: 0
    // like a silent one, and the panel has to tell them apart.
    i, mean: null, n: 0, placed: false, thin: false, scheduled: true,
  }));
}

const setDay = (i: number, over: Record<string, unknown>) => {
  h.days[i] = { ...(h.days[i] as object), ...over };
};
const setScope = (i: number, over: Record<string, unknown>) => {
  h.series[i] = { ...(h.series[i] as object), ...over };
};

beforeEach(() => { blank(); h.trendCalls = []; h.trendReady = true; h.trendPromise = null; localStorage.clear(); });
afterEach(() => cleanup());

const mount = async () => {
  const { default: PulseTrends } = await import("./PulseTrends");
  return render(<PulseTrends />);
};

describe("PulseTrends · absent is not zero", () => {
  it("says a crowd day has no answers rather than reading it as a score", () => {
    // THE rule. `n: 0, mean: null` must reach the reader as "no answers",
    // never as a number — a `?? 0` here would draw the crowd flat at the
    // bottom of the scale and say nothing was wrong.
    return (async () => {
      setDay(DAYS - 1, { v: 3 });
      setScope(DAYS - 1, { mean: null, n: 0, placed: false });
      await mount();
      expect(document.body.textContent).toMatch(/no answers/);
      // …and it must not have invented a mean for that day.
      expect(document.body.textContent).not.toMatch(/0\.0/);
      // Asserted NEGATIVELY as well, and this is the half that catches a
      // regression: the notes row below also contains the words "no
      // answers" ("N days with no answers … not a zero"), so a per-day
      // detail that silently fell through to the thin-day branch still
      // satisfied the match above. A first draft of this case did exactly
      // that and passed against the mutation.
      expect(document.body.textContent, "an unanswered crowd day was reported as a thin one")
        .not.toMatch(/n 0 · too few/);
    })();
  });

  it("lists a thin day with its reason instead of placing it", () => {
    // Under THIN the day is counted and NOT positioned — the difference
    // between "few people answered" and "the crowd felt this way".
    return (async () => {
      // The last day: `sel` defaults to DAYS - 1, and the per-day detail
      // row is what carries the reason.
      setDay(DAYS - 1, { v: 4 });
      setScope(DAYS - 1, { mean: 3.2, n: 6, placed: false, thin: true });
      await mount();
      expect(document.body.textContent).toMatch(/too few/);
      expect(document.body.textContent, "a thin day printed its mean as if placed")
        .not.toMatch(/3\.2/);
    })();
  });

  it("carries n with a reading it does place", () => {
    return (async () => {
      setDay(DAYS - 1, { v: 4 });
      setScope(DAYS - 1, { mean: 3.4, n: 44, placed: true, thin: false });
      await mount();
      expect(document.body.textContent).toMatch(/3\.4/);
      expect(document.body.textContent, "a placed reading arrived without its n")
        .toMatch(/n\s*44/);
    })();
  });
});

describe("PulseTrends · a day nobody asked about is not a day you skipped", () => {
  it("counts only SCHEDULED days as skipped", () => {
    // D203's fourth rule, and the specific lie it exists to stop: a weekly
    // pulse answered every Sunday would otherwise report "you skipped 18
    // days" about a question nobody put.
    return (async () => {
      // Two answers, so a line exists; every other day unscheduled.
      for (let i = 0; i < DAYS; i++) setDay(i, { scheduled: false });
      setDay(0, { v: 3, scheduled: true });
      setDay(7, { v: 4, scheduled: true });
      await mount();
      expect(document.body.textContent, "unasked days were reported as skips")
        .not.toMatch(/didn’t answer on/);
    })();
  });

  it("does report the days it really did ask about", () => {
    return (async () => {
      setDay(0, { v: 3 });
      setDay(1, { v: 4 });
      // days 2 and 3 scheduled, unanswered, not today
      await mount();
      expect(document.body.textContent).toMatch(/didn’t answer on \d+ days?/);
    })();
  });
});

describe("PulseTrends · a day nobody was asked is not a day the crowd was silent", () => {
  it("counts only scheduled days as days with no answers", () => {
    // The crowd's half of D203's fourth rule. An unscheduled day is
    // returned as n: 0 — the store does not place the crowd on a day this
    // reading has no row for — and the panel read those as absence: on a
    // weekly cadence it said "18 days with no answers in Oslo" about days
    // nobody was asked anything.
    return (async () => {
      for (let i = 0; i < DAYS; i++) setScope(i, { scheduled: false });
      setScope(0, { scheduled: true, n: 12, mean: 3.2, placed: true });
      setScope(7, { scheduled: true, n: 0 });
      await mount();
      // One scheduled day really had nothing; the eighteen unscheduled
      // ones are not the crowd's silence.
      expect(document.body.textContent, "unasked days were reported as the crowd's silence")
        .toMatch(/1 day with no answers/);
      expect(document.body.textContent).not.toMatch(/1[0-9] days with no answers/);
    })();
  });

  it("counts the denominator in days it asked about", () => {
    return (async () => {
      for (let i = 0; i < DAYS; i++) setScope(i, { scheduled: false });
      setScope(0, { scheduled: true, n: 12, mean: 3.2, placed: true });
      setScope(7, { scheduled: true, n: 9, mean: 3.0, placed: true });
      await mount();
      expect(document.body.textContent, "the footer counted days nobody was asked")
        .toMatch(/across 2 of 2 days/);
    })();
  });
});

describe("PulseTrends · it asks for the window it draws", () => {
  it("fetches the trend for the pulse it is rendering", () => {
    return (async () => {
      await mount();
      expect(h.trendCalls, "the panel drew a window it never asked for")
        .toContain("pulse-pace");
    })();
  });
});

// ── the crowd's half may not speak before it has been read ──
//
// `aggFor` answers null for "fetched, nobody answered" and "never fetched"
// alike, and every case above hands `scope()` a window that HAS landed —
// which is why eight of them passed while the panel was telling a viewer in
// Oslo that nobody there had answered in three weeks. These two hold the
// window unread and assert the four sentences that were wrong, by the words
// a reader would see. Your own half is asserted present in both, because a
// latch that silences the whole panel is the other way to be useless.
describe("PulseTrends · an unread window is not an empty one", () => {
  const mine = () => { setDay(0, { v: 3 }); setDay(DAYS - 1, { v: 3 }); };

  it("says it is reading rather than reporting a silence it has not checked", () => {
    return (async () => {
      mine();
      h.trendReady = false;
      h.trendPromise = new Promise<void>(() => { /* never settles */ });
      await mount();
      const t = () => document.body.textContent || "";
      expect(t(), "the panel said it was reading nothing").toMatch(/Reading Oslo/);
      expect(t(), "reported days with no answers before reading any")
        .not.toMatch(/days with no answers in Oslo/);
      expect(t(), "counted placed days out of a window it had not read")
        .not.toMatch(/of 21 days/);
      expect(t(), "called an unread crowd 'not a trend yet'").not.toMatch(/not a trend yet/);
      expect(t(), "claimed every day had both sides").not.toMatch(/every day here has both sides/);
      // …and the half that IS in hand keeps drawing: your word for the
      // selected day, and your own count in the foot line.
      expect(t(), "your own line stopped drawing while the crowd loaded").toMatch(/Steady/);
      expect(t(), "your own count went missing").toMatch(/you: 2/);
    })();
  });

  it("says the read failed rather than falling back to a silence", () => {
    return (async () => {
      // `ensureTrend` settles and the window is STILL not in hand — offline,
      // or a refused read. The old effect had no path out of this at all:
      // its deps never change, so the false silence stood for the life of
      // the mount.
      mine();
      h.trendReady = false;
      await mount();
      const t = () => document.body.textContent || "";
      // The settle lands a microtask after the render, so the assertion has
      // to wait for it — asserting straight off `mount()` reads the
      // "reading" frame and passes for the wrong reason.
      await waitFor(() => expect(t(), "a failed read was reported as a crowd that said nothing")
        .toMatch(/Couldn\u2019t read Oslo/));
      expect(t()).not.toMatch(/days with no answers in Oslo/);
      expect(t()).not.toMatch(/of 21 days/);
      expect(t(), "your own count went missing").toMatch(/you: 2/);
    })();
  });
});

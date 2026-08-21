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
import { cleanup, render } from "@testing-library/react";

const DAYS = 21;

const h = vi.hoisted(() => ({
  days: [] as unknown[],
  series: [] as unknown[],
  trendCalls: [] as string[],
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
    ensureTrend: (pid: string) => { h.trendCalls.push(pid); return Promise.resolve(); },
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
    i, mean: null, n: 0, placed: false, thin: false,
  }));
}

const setDay = (i: number, over: Record<string, unknown>) => {
  h.days[i] = { ...(h.days[i] as object), ...over };
};
const setScope = (i: number, over: Record<string, unknown>) => {
  h.series[i] = { ...(h.series[i] as object), ...over };
};

beforeEach(() => { blank(); h.trendCalls = []; localStorage.clear(); });
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

describe("PulseTrends · it asks for the window it draws", () => {
  it("fetches the trend for the pulse it is rendering", () => {
    return (async () => {
      await mount();
      expect(h.trendCalls, "the panel drew a window it never asked for")
        .toContain("pulse-pace");
    })();
  });
});

// @vitest-environment jsdom
//
// The roster's contract (D166 §3), pinned:
//
//   1. Cadence is validated on read — a foreign stored value falls back to
//      the roster's authored default, never a fifth schedule.
//   2. The schedule is UTC and the calendar is exact: daily = 21 of 21
//      window days, often = Mon·Wed·Fri, weekly = Sunday, off = none.
//   3. The streak counts SCHEDULED days only — a weekly pulse answered
//      every Sunday is a perfect run (the fourth honesty clause).
//   4. The purge drops the remembered cadences without writing the key
//      back (check:purge's contract).
//   5. Demo mode asks only the first pulse — the other four have no
//      honest demo crowd, so they exist live-only.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const live = vi.hoisted(() => ({
  enabled: true,
  pulseVotes: vi.fn((): Record<string, number> => ({})),
  anchors: () => ({}),
  subscribe: () => () => {},
  votePulse: vi.fn(),
}));
vi.mock("./live", () => ({ default: live }));
vi.mock("../../lib/firebase", () => ({ getDb: vi.fn(), getFirestoreApi: vi.fn() }));

import { PULSE, ROSTER } from "./pulse";

const CKEY = "insight.pulse.cadence.v1";

beforeEach(() => {
  localStorage.removeItem(CKEY);
  // the in-memory cadence copy survives between tests otherwise — the
  // purge event is the store's own reset, so use it
  window.dispatchEvent(new Event("insight:local-purge"));
  live.enabled = true;
  live.pulseVotes.mockReturnValue({});
});
afterEach(() => vi.clearAllMocks());

describe("cadence", () => {
  it("defaults to the roster's authored schedule", () => {
    expect(PULSE.cadence("pulse-pace")).toBe("daily");
    expect(PULSE.cadence("pulse-energy")).toBe("weekly");
    expect(PULSE.cadence("pulse-sleep")).toBe("weekly");
    expect(PULSE.cadence("pulse-focus")).toBe("off");
    expect(PULSE.cadence("pulse-social")).toBe("off");
  });

  it("falls back to the default on a value no schedule owns", () => {
    localStorage.setItem(CKEY, JSON.stringify({ "pulse-energy": "hourly" }));
    expect(PULSE.cadence("pulse-energy")).toBe("weekly");
  });

  it("remembers a real choice and refuses a fake one", () => {
    PULSE.setCadence("pulse-focus", "daily");
    expect(PULSE.cadence("pulse-focus")).toBe("daily");
    expect(JSON.parse(localStorage.getItem(CKEY) || "{}")["pulse-focus"]).toBe("daily");
    PULSE.setCadence("pulse-focus", "hourly" as never);
    expect(PULSE.cadence("pulse-focus")).toBe("daily");
  });
});

describe("the calendar", () => {
  // 21 consecutive days hold exactly 3 of each weekday, whatever today
  // is — so the counts are deterministic without freezing the clock.
  const scheduledDays = (qid: string) => PULSE.days(qid).filter((d) => d.scheduled);

  it("daily asks every day, off asks none", () => {
    expect(scheduledDays("pulse-pace")).toHaveLength(21);
    expect(scheduledDays("pulse-focus")).toHaveLength(0);
  });

  it("weekly is Sunday, often is Mon·Wed·Fri — UTC", () => {
    const sundays = scheduledDays("pulse-sleep");
    expect(sundays).toHaveLength(3);
    for (const d of sundays) expect(d.date.getUTCDay()).toBe(0);
    PULSE.setCadence("pulse-sleep", "often");
    const mwf = scheduledDays("pulse-sleep");
    expect(mwf).toHaveLength(9);
    for (const d of mwf) expect([1, 3, 5]).toContain(d.date.getUTCDay());
  });

  it("dueToday lists exactly the pulses scheduled today, in roster order", () => {
    for (const p of ROSTER) PULSE.setCadence(p.qid, "daily");
    expect(PULSE.dueToday()).toEqual(ROSTER.map((p) => p.qid));
    for (const p of ROSTER) PULSE.setCadence(p.qid, "off");
    expect(PULSE.dueToday()).toEqual([]);
  });
});

describe("the streak", () => {
  it("counts scheduled days only — an unasked day cannot break a run", () => {
    // Answer the latest two Sundays and nothing else; a weekly pulse's
    // run is 2, however many weekdays sit unanswered in between.
    const sundayKeys = PULSE.days("pulse-sleep")
      .filter((d) => d.date.getUTCDay() === 0)
      .map((d) => d.key);
    const votes: Record<string, number> = {};
    for (const k of sundayKeys.slice(-2)) votes[k] = 2;
    live.pulseVotes.mockReturnValue(votes);
    expect(PULSE.streak("pulse-sleep").run).toBe(2);
  });

  it("breaks on a scheduled day that went unanswered", () => {
    const sundayKeys = PULSE.days("pulse-sleep")
      .filter((d) => d.date.getUTCDay() === 0)
      .map((d) => d.key);
    // only the OLDEST Sunday answered — the newer misses break the run
    live.pulseVotes.mockReturnValue({ [sundayKeys[0]]: 2 });
    expect(PULSE.streak("pulse-sleep").run).toBe(0);
  });
});

describe("the purge", () => {
  it("drops the remembered cadences and does not write the key back", () => {
    PULSE.setCadence("pulse-social", "daily");
    localStorage.removeItem(CKEY); // purgeLocalTrace has already swept it
    window.dispatchEvent(new Event("insight:local-purge"));
    expect(PULSE.cadence("pulse-social")).toBe("off");
    expect(localStorage.getItem(CKEY)).toBeNull();
  });
});

describe("demo mode", () => {
  it("asks only the first pulse — the rest are live-only", () => {
    live.enabled = false;
    expect(PULSE.dueToday()).toEqual(["pulse-pace"]);
  });
});

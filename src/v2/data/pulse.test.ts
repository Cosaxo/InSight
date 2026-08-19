// @vitest-environment jsdom
//
// The pulse roster and its cadences (D200).
//
// D139 shipped one pulse and said a roster would make it a parameter.
// These cases pin the two things that parameterisation is allowed to be
// wrong about, and the one it is not:
//
//   · WRONG-ABLE: which pulses exist, and how often each asks. Both are
//     data — a bank row and a device preference — and both are exercised
//     here rather than assumed.
//   · NOT WRONG-ABLE: what the app SAYS about a day it never asked on.
//     The design's honesty rules already forbade zero-filling an absent
//     day and bridging a gap; the roster adds "a day the pulse was not
//     scheduled is absent too, and is not a miss". The prototype gets
//     this wrong — `design/standalone-v28/pulse-data.js` still walks
//     calendar days — so a weekly pulse there reports a streak that can
//     never exceed 1 and eighteen skipped days about a question nobody
//     put. That is the specific lie these cases exist to prevent.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./live", () => ({
  default: {
    enabled: false,
    anchors: () => ({ city: "Oslo, NO", country: "NO" }),
    pulseQs: () => [],
    pulseVotes: () => ({}),
    votePulse: () => Promise.resolve(),
    subscribe: () => () => {},
  },
}));
vi.mock("../../lib/firebase", () => ({
  getDb: () => Promise.reject(new Error("no firebase in a unit test")),
  getFirestoreApi: () => Promise.reject(new Error("no firebase in a unit test")),
}));

import PULSE, { CADENCES, DAYS, dueOn, type Cadence } from "./pulse";

/** A date with a known UTC weekday. 2026-08-16 is a Sunday. */
const SUN = new Date(Date.UTC(2026, 7, 16));
const MON_ = new Date(Date.UTC(2026, 7, 17));
const TUE = new Date(Date.UTC(2026, 7, 18));
const WED = new Date(Date.UTC(2026, 7, 19));
const FRI = new Date(Date.UTC(2026, 7, 21));

beforeEach(() => { try { localStorage.clear(); } catch { /* jsdom has one */ } });
afterEach(() => { try { localStorage.clear(); } catch { /* … */ } });

describe("dueOn — the whole scheduling model, and it is pure", () => {
  it("asks every day on daily", () => {
    for (const d of [SUN, MON_, TUE, WED, FRI]) expect(dueOn("daily", d)).toBe(true);
  });

  it("asks Mon, Wed and Fri on often — and nothing else", () => {
    expect(dueOn("often", MON_)).toBe(true);
    expect(dueOn("often", WED)).toBe(true);
    expect(dueOn("often", FRI)).toBe(true);
    expect(dueOn("often", TUE)).toBe(false);
    expect(dueOn("often", SUN)).toBe(false);
  });

  it("asks on Sunday only on weekly", () => {
    expect(dueOn("weekly", SUN)).toBe(true);
    for (const d of [MON_, TUE, WED, FRI]) expect(dueOn("weekly", d)).toBe(false);
  });

  it("never asks when off — paused, not retired", () => {
    for (const d of [SUN, MON_, TUE, WED, FRI]) expect(dueOn("off", d)).toBe(false);
  });

  it("reads the UTC weekday, the same clock the day keys use", () => {
    // A late-evening local Saturday that is already Sunday in UTC is a
    // Sunday here, because that is the day its answer would be keyed to.
    const lateSat = new Date(Date.UTC(2026, 7, 16, 0, 30));
    expect(dueOn("weekly", lateSat)).toBe(true);
  });
});

describe("the roster", () => {
  it("carries five pulses, each with five steps", () => {
    const r = PULSE.roster();
    expect(r.length).toBe(5);
    for (const q of r) {
      expect(q.steps.length).toBe(5);
      expect(q.steps.map((s) => s.v)).toEqual([1, 2, 3, 4, 5]);
      expect(q.text.length).toBeGreaterThan(0);
    }
  });

  it("opens on the pace pulse — the one that shipped first and kept its options", () => {
    // D52 froze pulse-pace's option set. The roster appends around it.
    expect(PULSE.first()).toBe("pulse-pace");
  });

  it("gives every pulse a distinct id and prompt", () => {
    const r = PULSE.roster();
    expect(new Set(r.map((q) => q.id)).size).toBe(r.length);
    expect(new Set(r.map((q) => q.text)).size).toBe(r.length);
  });
});

describe("cadence", () => {
  it("defaults per pulse rather than globally", () => {
    // Asking about sleep as often as about the day's pace is a different
    // ask, so the roster's defaults are not uniform.
    expect(PULSE.cadence("pulse-pace")).toBe("daily");
    expect(PULSE.cadence("pulse-sleep")).toBe("weekly");
    expect(PULSE.cadence("pulse-focus")).toBe("off");
  });

  it("persists a change, per pulse, without touching its neighbours", () => {
    PULSE.setCadence("pulse-sleep", "daily");
    expect(PULSE.cadence("pulse-sleep")).toBe("daily");
    expect(PULSE.cadence("pulse-energy")).toBe("weekly");
  });

  it("refuses a cadence that is not one of the four", () => {
    PULSE.setCadence("pulse-pace", "hourly" as Cadence);
    expect(PULSE.cadence("pulse-pace")).toBe("daily");
  });

  it("survives a corrupt store rather than throwing on every render", () => {
    localStorage.setItem("insight.pulseCadence.v1", "{{not json");
    expect(PULSE.cadence("pulse-pace")).toBe("daily");
  });

  it("names all four for the control", () => {
    expect(CADENCES).toEqual(["daily", "often", "weekly", "off"]);
  });
});

describe("dueToday", () => {
  it("lists only the pulses whose cadence asks today", () => {
    const due = PULSE.dueToday();
    // pace is daily, so it is always due; focus and social are off.
    expect(due).toContain("pulse-pace");
    expect(due).not.toContain("pulse-focus");
    expect(due).not.toContain("pulse-social");
  });

  it("drops a pulse the moment it is paused", () => {
    expect(PULSE.dueToday()).toContain("pulse-pace");
    PULSE.setCadence("pulse-pace", "off");
    expect(PULSE.dueToday()).not.toContain("pulse-pace");
  });

  it("keeps a pulse you have already answered today", () => {
    // It is still due — the card draws its reveal. Dropping it would make
    // today's card vanish under your own tap.
    PULSE.answer("pulse-pace", 4);
    expect(PULSE.dueToday()).toContain("pulse-pace");
    expect(PULSE.mineToday("pulse-pace")).toBe(4);
  });

  it("returns them in roster order, so the feed does not reshuffle", () => {
    PULSE.setCadence("pulse-focus", "daily");
    PULSE.setCadence("pulse-social", "daily");
    const ids = PULSE.roster().map((q) => q.id);
    const due = PULSE.dueToday();
    expect(due).toEqual(ids.filter((id) => due.includes(id)));
  });
});

describe("a day the pulse never asked on is absent, not missed", () => {
  it("marks unscheduled days unscheduled, and holds no answer on them", () => {
    PULSE.setCadence("pulse-pace", "weekly");
    const days = PULSE.days("pulse-pace");
    expect(days.length).toBe(DAYS);
    const asked = days.filter((d) => d.scheduled);
    // Three weeks of Sundays.
    expect(asked.length).toBeGreaterThanOrEqual(3);
    expect(asked.length).toBeLessThanOrEqual(4);
    for (const d of days) {
      if (!d.scheduled) expect(d.v).toBeNull();
      expect(d.scheduled).toBe(dueOn("weekly", d.date));
    }
  });

  it("counts the streak in ASKS, so a weekly pulse can run more than 1", () => {
    // The prototype's calendar walk breaks on the first Monday and calls
    // a perfectly kept weekly pulse a streak of 1.
    PULSE.setCadence("pulse-pace", "weekly");
    const asked = PULSE.days("pulse-pace").filter((d) => d.scheduled);
    // answer() only ever writes today, so seed the whole run directly
    // through the same store the demo room uses.
    const saved: Record<string, Record<string, number>> = {};
    saved["pulse-pace"] = Object.fromEntries(asked.map((d) => [d.key, 4]));
    localStorage.setItem("insight.pulse.v1", JSON.stringify(saved));

    const st = PULSE.streak("pulse-pace");
    expect(st.run).toBe(asked.length);
    expect(st.run).toBeGreaterThan(1);
  });

  it("draws the last fourteen ASKS in the strip, not a fortnight of blanks", () => {
    PULSE.setCadence("pulse-pace", "weekly");
    const st = PULSE.streak("pulse-pace");
    expect(st.ticks.every((d) => d.scheduled)).toBe(true);
    expect(st.ticks.length).toBeLessThanOrEqual(14);
  });

  it("does not place a crowd point on a day this reading does not draw", () => {
    PULSE.setCadence("pulse-pace", "weekly");
    const sc = PULSE.scope("pulse-pace", "world");
    const days = PULSE.days("pulse-pace");
    sc.series.forEach((s, i) => {
      if (!days[i].scheduled) {
        expect(s.placed).toBe(false);
        expect(s.mean).toBeNull();
        expect(s.n).toBe(0);
      }
    });
  });

  it("reports an empty run for a paused pulse rather than a broken one", () => {
    PULSE.setCadence("pulse-pace", "off");
    const st = PULSE.streak("pulse-pace");
    expect(st.run).toBe(0);
    expect(st.ticks).toEqual([]);
    expect(st.live).toBe(false);
  });
});

describe("answers are per pulse", () => {
  it("keeps two pulses' answers apart on the same day", () => {
    PULSE.setCadence("pulse-sleep", "daily");
    PULSE.answer("pulse-pace", 2);
    PULSE.answer("pulse-sleep", 5);
    expect(PULSE.mineToday("pulse-pace")).toBe(2);
    expect(PULSE.mineToday("pulse-sleep")).toBe(5);
  });

  it("reads each pulse's own step labels", () => {
    expect(PULSE.word("pulse-pace", 1)).toBe("Crawling");
    expect(PULSE.word("pulse-sleep", 1)).toBe("Badly");
  });
});

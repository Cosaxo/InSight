// @vitest-environment jsdom
//
// The pulse roster, its pins and its window (D203; the cadence retired
// 2026-09-12).
//
// D139 shipped one pulse and said a roster would make it a parameter.
// These cases pin the two things that parameterisation is allowed to be
// wrong about, and the one it is not:
//
//   · WRONG-ABLE: which pulses exist, and which of them you are tracking.
//     Both are data — a bank row and a device preference — and both are
//     exercised here rather than assumed. "How often each asks" used to
//     be the second of those and is not any more: every pulse asks every
//     day, and the picker that made it a preference became the PIN.
//   · NOT WRONG-ABLE: what the app SAYS about a day it never asked on.
//     The design's honesty rules already forbade zero-filling an absent
//     day and bridging a gap; the roster adds "a day the pulse was not
//     scheduled is absent too, and is not a miss". The prototype gets
//     this wrong — `design/standalone-v28/pulse-data.js` still walks
//     calendar days — so a weekly pulse there reports a streak that can
//     never exceed 1 and eighteen skipped days about a question nobody
//     put. That is the specific lie these cases exist to prevent.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `enabled` is a getter so a case can flip the store live for the length of
// one assertion: the demo and live branches of `scope()` build their labels
// differently, and only the demo one had ever been read by a test.
let liveOn = false;
vi.mock("./live", () => ({
  default: {
    get enabled() { return liveOn; },
    anchors: () => ({ city: "Oslo, NO", country: "NO" }),
    // Overridable per case: the `since` cases need a roster the DEMO one
    // cannot express, because the demo furniture is a literal in the
    // module and no shipped pulse carries a window start.
    pulseQs: () => liveRoster,
    // Overridable per case, like `pulseQs`: the streak cases need a run
    // of answers, and in live mode this is where an answer lives.
    pulseVotes: () => liveVotes,
    // Never pending here: this file reads the roster, not crowds. Present
    // because the module calls it unconditionally, the way the real store
    // always defines it.
    pulsePending: () => null,
    votePulse: () => Promise.resolve(),
    subscribe: () => () => {},
  },
}));
vi.mock("../../lib/firebase", () => ({
  getDb: () => Promise.reject(new Error("no firebase in a unit test")),
  getFirestoreApi: () => Promise.reject(new Error("no firebase in a unit test")),
}));

import PULSE, { asksOn, DAYS, PIN_MAX } from "./pulse";

/** A date with a known UTC weekday. 2026-08-16 is a Sunday. */
const SUN = new Date(Date.UTC(2026, 7, 16));
const MON_ = new Date(Date.UTC(2026, 7, 17));
const TUE = new Date(Date.UTC(2026, 7, 18));
const WED = new Date(Date.UTC(2026, 7, 19));
const FRI = new Date(Date.UTC(2026, 7, 21));

/** What the mocked store hands back for the live roster. Empty by
 * default, which is the demo room; a case that needs a `since` fills it. */
let liveRoster: { id: string; prompt: string; options: string[]; since?: string }[] = [];
let liveVotes: Record<string, number> = {};
const FIVE = ["Crawling", "Dragging", "Steady", "Brisk", "Flying"];

// A fixed clock for the window cases. The 21-day window ends TODAY, so a
// `since` written as a literal only lands where the case means it to if
// today is a literal too — otherwise these pass in August and drift out of
// the window by September, which is the stale-fixture class D-something
// keeps re-finding in this tree. With today = 2026-08-29, `dayAt(0)` is
// 2026-08-09 and a window opening on 2026-08-19 leaves ten days before it
// and eleven from it.
const TODAY = new Date("2026-08-29T12:00:00Z");
const WINDOW_OPENS = "2026-08-19";
const BEFORE_WINDOW = 10;

/** The one-pulse live roster the window cases run against. */
const withWindow = (since = WINDOW_OPENS) => {
  liveOn = true;
  liveRoster = [{ id: "pulse-new", prompt: "How new was today?", options: FIVE, since }];
};

beforeEach(() => {
  liveOn = false;
  liveRoster = [];
  liveVotes = {};
  try { localStorage.clear(); } catch { /* jsdom has one */ }
});
afterEach(() => {
  vi.useRealTimers();
  try { localStorage.clear(); } catch { /* … */ }
});

describe("asksOn — the whole scheduling model, and it is pure", () => {
  it("asks every day, on every weekday, for every pulse", () => {
    // The owner's ruling, 2026-09-12: *"they should all be on everyday"*.
    // Every weekday, because the rule it replaced was a weekday rule —
    // `sleep` and `energy` asked on Sundays alone, so a case that checked
    // one day would have passed against the thing that was removed.
    for (const pid of PULSE.roster().map((q) => q.id)) {
      for (const d of [SUN, MON_, TUE, WED, FRI]) expect(asksOn(pid, d)).toBe(true);
    }
  });

  it("does not ask on a day before the pulse existed", () => {
    // The rule the cadence used to be the only instance of, and the
    // instance that replaces it: a pulse WRITTEN mid-history (the owner's
    // slow creation lane) has days in the window on which it did not
    // exist, and those are absent rather than eighteen misses.
    //
    // Driven through the live roster because no shipped pulse carries a
    // window start — which is the point: this is reachable the day the
    // bank states one, and unreachable until then.
    liveOn = true;
    liveRoster = [{ id: "pulse-new", prompt: "How new was today?", options: FIVE, since: "2026-08-19" }];
    expect(asksOn("pulse-new", MON_), "asked on a day before it was written").toBe(false);
    expect(asksOn("pulse-new", new Date(Date.UTC(2026, 7, 19)))).toBe(true);
    expect(asksOn("pulse-new", new Date(Date.UTC(2026, 7, 21)))).toBe(true);
  });

  it("ignores a window start the bank wrote badly, rather than refusing every day", () => {
    // A `since` that will not parse must not silently retire the pulse:
    // an unreadable field is a bank error, and answering "this pulse
    // never asks" to one would hide it behind a card that draws nothing.
    liveOn = true;
    liveRoster = [{ id: "pulse-new", prompt: "How new was today?", options: FIVE, since: "not a date" }];
    expect(asksOn("pulse-new", MON_)).toBe(true);
  });

  it("reads the UTC day, the same clock the day keys use", () => {
    // A late-evening local Saturday that is already Sunday in UTC belongs
    // to the Sunday, because that is the day its answer would be keyed to.
    liveOn = true;
    liveRoster = [{ id: "pulse-new", prompt: "How new was today?", options: FIVE, since: "2026-08-16" }];
    expect(asksOn("pulse-new", new Date(Date.UTC(2026, 7, 16, 0, 30)))).toBe(true);
    expect(asksOn("pulse-new", new Date(Date.UTC(2026, 7, 15, 23, 30)))).toBe(false);
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

describe("the pin — what you are tracking", () => {
  it("holds nothing by default, so nothing leads the feed unasked", () => {
    // The default IS the owner's report: the head of the feed belongs to
    // the mix until a person claims a place in it.
    expect(PULSE.pins()).toEqual([]);
    expect(PULSE.pinned("pulse-pace")).toBe(false);
  });

  it("persists a pin, per pulse, without touching its neighbours", () => {
    expect(PULSE.setPinned("pulse-sleep", true)).toBe(true);
    expect(PULSE.pinned("pulse-sleep")).toBe(true);
    expect(PULSE.pinned("pulse-energy")).toBe(false);
  });

  it("unpins, and unpinning is not a pin of everything else", () => {
    PULSE.setPinned("pulse-sleep", true);
    PULSE.setPinned("pulse-pace", true);
    expect(PULSE.setPinned("pulse-sleep", false)).toBe(true);
    expect(PULSE.pins()).toEqual(["pulse-pace"]);
  });

  it("keeps the pin order, oldest first — the head of a feed is a queue", () => {
    PULSE.setPinned("pulse-sleep", true);
    PULSE.setPinned("pulse-pace", true);
    expect(PULSE.pins()).toEqual(["pulse-sleep", "pulse-pace"]);
    // Re-pinning what is already pinned is a no-op, never a bump: a tap
    // that reordered the cards above it is the jump-under-the-thumb the
    // whole change is about.
    expect(PULSE.setPinned("pulse-sleep", true)).toBe(true);
    expect(PULSE.pins()).toEqual(["pulse-sleep", "pulse-pace"]);
  });

  it("refuses the fourth and SAYS so, rather than dropping it in silence", () => {
    const r = PULSE.roster().map((q) => q.id);
    for (const id of r.slice(0, PIN_MAX)) expect(PULSE.setPinned(id, true)).toBe(true);
    // The return value is the whole of the refusal's visibility: the card
    // reads it to say why nothing happened, and a cap the card cannot see
    // is a dead button.
    expect(PULSE.setPinned(r[PIN_MAX], true), "a fourth pin was accepted").toBe(false);
    expect(PULSE.pins().length).toBe(PIN_MAX);
    expect(PULSE.pinned(r[PIN_MAX])).toBe(false);
  });

  it("caps at three, because a head that is all pins is not a feed", () => {
    expect(PIN_MAX).toBe(3);
  });

  it("drops a pin for a pulse the bank retired, rather than holding its place", () => {
    // `active: false` takes a pulse out of the roster and the stale pin
    // would otherwise hold a place at the head of the feed for a card
    // that cannot render — the PASSIVE.testFor() failure, one surface over.
    PULSE.setPinned("pulse-sleep", true);
    liveOn = true;
    liveRoster = [{ id: "pulse-pace", prompt: "What pace was today?", options: FIVE }];
    expect(PULSE.pins()).toEqual([]);
  });

  it("survives a corrupt store rather than throwing on every render", () => {
    localStorage.setItem("insight.pulsePins.v1", "{{not json");
    expect(PULSE.pins()).toEqual([]);
    expect(PULSE.pinned("pulse-pace")).toBe(false);
  });

  it("survives a store holding something that is not a list of ids", () => {
    localStorage.setItem("insight.pulsePins.v1", JSON.stringify([1, null, "pulse-pace", { x: 1 }]));
    expect(PULSE.pins()).toEqual(["pulse-pace"]);
  });
});

describe("dueToday", () => {
  it("lists every pulse in the roster — all of them, every day", () => {
    expect(PULSE.dueToday()).toEqual(PULSE.roster().map((q) => q.id));
  });

  it("lists the ones a pin says nothing about, too", () => {
    // A pin moves a card; it does not gate whether the card is asked. The
    // four that are not pinned are still in the feed.
    PULSE.setPinned("pulse-sleep", true);
    const due = PULSE.dueToday();
    expect(due).toContain("pulse-sleep");
    expect(due).toContain("pulse-focus");
    expect(due.length).toBe(PULSE.roster().length);
  });

  it("keeps a pulse you have already answered today", () => {
    // It is still due — the card draws its reveal. Dropping it would make
    // today's card vanish under your own tap.
    PULSE.answer("pulse-pace", 4);
    expect(PULSE.dueToday()).toContain("pulse-pace");
    expect(PULSE.mineToday("pulse-pace")).toBe(4);
  });

  it("returns them in roster order, so the feed does not reshuffle", () => {
    const ids = PULSE.roster().map((q) => q.id);
    expect(PULSE.dueToday()).toEqual(ids);
  });

  it("drops a pulse whose window has not opened yet", () => {
    liveOn = true;
    liveRoster = [
      { id: "pulse-pace", prompt: "What pace was today?", options: FIVE },
      { id: "pulse-new", prompt: "How new was today?", options: FIVE, since: "2099-01-01" },
    ];
    expect(PULSE.dueToday()).toEqual(["pulse-pace"]);
  });
});

describe("a day the pulse never asked on is absent, not missed", () => {
  // THE DRIVER CHANGED, THE RULE DID NOT (2026-09-12). These four cases
  // used to set a WEEKLY cadence and read the eighteen Mondays-to-
  // Saturdays it left unasked. The cadence is gone — every pulse asks
  // every day — so the rule needs the other instance of an unasked day,
  // and there is exactly one: a day BEFORE THE PULSE EXISTED.
  //
  // That is not a contrivance for the suite's benefit. It is the case the
  // owner's slow creation lane produces on its first run, and it is the
  // reason `asksOn` is still a function rather than an inlined `true`: a
  // pulse written this week has twenty days of window behind it on which
  // nobody was asked anything, and calling those twenty misses is the
  // specific lie this whole section exists to prevent.
  it("marks days before the window unscheduled, and holds no answer on them", () => {
    vi.setSystemTime(TODAY);
    withWindow();
    const days = PULSE.days("pulse-new");
    expect(days.length).toBe(DAYS);
    expect(days.filter((d) => d.scheduled).length).toBe(DAYS - BEFORE_WINDOW);
    for (const d of days) {
      if (!d.scheduled) expect(d.v).toBeNull();
      expect(d.scheduled).toBe(asksOn("pulse-new", d.date));
    }
    // …and the boundary itself is IN, not out: the day it was written is
    // a day it asked.
    expect(days[BEFORE_WINDOW].key).toBe(WINDOW_OPENS);
    expect(days[BEFORE_WINDOW].scheduled).toBe(true);
    expect(days[BEFORE_WINDOW - 1].scheduled).toBe(false);
  });

  it("counts the streak in ASKS, so a pulse written mid-window can run past 1", () => {
    // The prototype's calendar walk breaks on the first day the pulse did
    // not exist and calls a perfectly kept run a streak of 1, with ten
    // misses about a question nobody could have been put.
    vi.setSystemTime(TODAY);
    withWindow();
    const asked = PULSE.days("pulse-new").filter((d) => d.scheduled);
    // In live mode an answer lives in the store, not in the demo file.
    // optionIdx is 0-based and the scale is 1..5, hence the 3 for a 4.
    liveVotes = Object.fromEntries(asked.map((d) => [d.key, 3]));

    const st = PULSE.streak("pulse-new");
    expect(st.run).toBe(asked.length);
    expect(st.run).toBeGreaterThan(1);
  });

  it("draws the last fourteen ASKS in the strip, not a fortnight of blanks", () => {
    vi.setSystemTime(TODAY);
    withWindow();
    const st = PULSE.streak("pulse-new");
    expect(st.ticks.every((d) => d.scheduled)).toBe(true);
    expect(st.ticks.length).toBeLessThanOrEqual(14);
  });

  it("does not place a crowd point on a day this reading does not draw", () => {
    vi.setSystemTime(TODAY);
    withWindow();
    const sc = PULSE.scope("pulse-new", "world");
    const days = PULSE.days("pulse-new");
    // The unscheduled half exists, or the assertion below is vacuous.
    expect(days.filter((d) => !d.scheduled).length).toBe(BEFORE_WINDOW);
    sc.series.forEach((x, i) => {
      if (!days[i].scheduled) {
        expect(x.scheduled).toBe(false);
        expect(x.placed).toBe(false);
        expect(x.mean).toBeNull();
        expect(x.n).toBe(0);
      }
    });
  });

  it("schedules every day of the window for a pulse with no window start", () => {
    // The five shipped pulses, and the other half of the rule: where
    // there is no day the pulse did not exist, there is no absent day to
    // report and the strip is a real fortnight.
    vi.setSystemTime(TODAY);
    const days = PULSE.days("pulse-pace");
    expect(days.every((d) => d.scheduled)).toBe(true);
    expect(PULSE.streak("pulse-pace").ticks.length).toBe(14);
  });
});

describe("the demo room's seeded history", () => {
  // The city and country scopes are named after the demo room's own place,
  // not after a placeholder. They drew "Your city" / "Your country" for as
  // long as the read was `window.IS_DATA?.me` — a cast, so check:globals
  // could not see it (D280) and sample-data.js had long since come off the
  // bridge, leaving the name unset on every build. Pinned to the strings
  // because that is the difference the fallback hides.
  it("names the demo scopes after the room's own city and country", () => {
    expect(PULSE.scope("pulse-pace", "city").label).toBe("Oslo");
    expect(PULSE.scope("pulse-pace", "country").label).toBe("Norway");
    expect(PULSE.scope("pulse-pace", "world").label).toBe("World");
  });

  // …AND THE LIVE ONES AFTER THE STORAGE KEY, which is not a name. Anchors
  // are stored canonically so one cohort is one cell worldwide — "NO" for a
  // country, "Oslo, NO" for a city — and the live branch printed those
  // straight at the reader: on the scope button, and inside sentences like
  // "3 days with no answers in NO". That is D125's failure exactly, on a
  // surface built after the resolver written to prevent it. The case above
  // could not see it: it runs the demo branch, which never touches an
  // anchor.
  it("names the live scopes after the place, not after the bucket key", () => {
    liveOn = true;
    try {
      expect(PULSE.scope("pulse-pace", "country").label).toBe("Norway");
      // The app's one name for that cell — the same string every cohort
      // chip shows for it. Longer than the demo room's bare "Oslo" above,
      // and deliberately the same conversion rather than a second one.
      expect(PULSE.scope("pulse-pace", "city").label).toBe("Oslo · Norway");
      expect(PULSE.scope("pulse-pace", "world").label).toBe("World");
    } finally {
      liveOn = false;
    }
  });

  it("reports an empty run for a pulse with no asks yet, rather than a broken one", () => {
    // This was "a paused pulse" until 2026-09-12 — a cadence of `off`
    // scheduled nothing, so `streak` had no asks to walk. Pausing is gone,
    // and the state that replaces it is a pulse whose window has not
    // opened: same empty `asked` list, same three answers, and the one the
    // case is really about is `live: false` — a run nobody could have
    // started must not read as a run that was broken.
    vi.setSystemTime(TODAY);
    withWindow("2099-01-01");
    const st = PULSE.streak("pulse-new");
    expect(st.run).toBe(0);
    expect(st.ticks).toEqual([]);
    expect(st.live).toBe(false);
  });
});

describe("answers are per pulse", () => {
  it("keeps two pulses' answers apart on the same day", () => {
    // No cadence line any more: `sleep` is asked every day like the rest,
    // so there is nothing to switch on before answering it.
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

// ── the demo arm of trendReady ──
//
// The live arm is pinned in pulse-ensure.test.ts, which needs a store that
// fetches. This is the half that file cannot reach: demo has no window to
// land, so the reading is complete the moment it renders, and a latch that
// forgot to say so would hold every demo build at "Reading the world…"
// forever — the panel's own guard turned into the bug it was added to fix.
describe("trendReady — demo has no window to wait for", () => {
  it("answers opposite ways for the same unfetched pulse, and the store's mode is the reason", () => {
    expect(liveOn, "the file's default flipped — this case proves nothing").toBe(false);
    expect(PULSE.trendReady("pulse-pace"), "a demo build was held at 'reading'").toBe(true);
    liveOn = true;
    try {
      expect(PULSE.trendReady("pulse-pace"), "an unfetched live window read as landed").toBe(false);
    } finally { liveOn = false; }
  });
});

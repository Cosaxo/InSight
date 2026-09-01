// now-budget.test.mjs — pins the now lane's arithmetic (D343): the budget
// never stops for stock (there is none — the topic empties itself), the
// live/pending split against a day, and the close dates a batch may use so
// it staggers against the bank and not only against itself.
import { describe, it, expect } from "vitest";
import {
  nowBudget,
  nowLive,
  suggestCloses,
  loadNowQuestions,
  NOW_CAP,
  OPEN_MAX,
  SOURCES_MIN,
  FRESH_DAYS,
} from "./now-budget.mjs";
import { NOW_TOPIC, WINDOW_MIN_DAYS, WINDOW_MAX_DAYS, WINDOW_SHORT_DAYS, windowDays } from "./question-quality.mjs";

describe("nowBudget", () => {
  it("grants the cap, less the open PR, and stops only at OPEN_MAX", () => {
    expect(nowBudget({}).budget).toBe(NOW_CAP);
    expect(nowBudget({ open: 2 }).budget).toBe(OPEN_MAX - 2);
    expect(nowBudget({ open: OPEN_MAX }).budget).toBe(0);
    expect(nowBudget({ open: OPEN_MAX + 3 }).budget).toBe(0);
  });

  it("constants hold their documented relationships", () => {
    expect(OPEN_MAX).toBe(NOW_CAP); // single-gate shape
    expect(SOURCES_MIN).toBeGreaterThanOrEqual(2); // one result is a headline, two are an event
    expect(FRESH_DAYS).toBeLessThanOrEqual(WINDOW_SHORT_DAYS); // "now" is at most a week old
  });
});

describe("nowLive", () => {
  const q = (id, from, until, active) => ({ id, from, until, ...(active === false ? { active } : {}) });
  const bank = [
    q("a", "2026-09-01", "2026-09-03"),
    q("b", "2026-08-20", "2026-08-25"),
    q("c", "2026-09-05", "2026-09-09"),
    q("d", "2026-09-01", "2026-09-03", false),
    { id: "e", prompt: "no window" },
  ];

  it("splits live, pending and expired against a day, and skips inactive or windowless rows", () => {
    const { live, pending, taken } = nowLive(bank, "2026-09-02");
    expect(live.map((x) => x.id)).toEqual(["a"]);
    expect(pending.map((x) => x.id)).toEqual(["c"]);
    expect(taken).toEqual({ "2026-09-03": 1, "2026-09-09": 1 });
  });

  it("counts a window live on both of its ends", () => {
    expect(nowLive(bank, "2026-09-01").live.map((x) => x.id)).toEqual(["a"]);
    expect(nowLive(bank, "2026-09-03").live.map((x) => x.id)).toEqual(["a"]);
    expect(nowLive(bank, "2026-09-04").live).toEqual([]);
  });
});

describe("suggestCloses", () => {
  it("starts at the short end, inside the gate's window bounds, and skips taken closes", () => {
    const closes = suggestCloses({ "2026-09-03": 1, "2026-09-05": 2 }, "2026-09-01", 6);
    expect(closes).toHaveLength(6);
    expect(closes.map((c) => c.until)).not.toContain("2026-09-03");
    expect(closes.map((c) => c.until)).not.toContain("2026-09-05");
    for (const c of closes) {
      expect(c.days).toBeGreaterThanOrEqual(WINDOW_MIN_DAYS);
      expect(c.days).toBeLessThanOrEqual(WINDOW_MAX_DAYS);
      expect(windowDays("2026-09-01", c.until)).toBe(c.days);
      expect(c.short).toBe(c.days <= WINDOW_SHORT_DAYS);
    }
    // Most of a full batch sits at the short end when nothing is taken —
    // the batch rule's "most" is satisfiable from the script's own list.
    const clean = suggestCloses({}, "2026-09-01", NOW_CAP);
    expect(clean.filter((c) => c.short).length * 2).toBeGreaterThanOrEqual(clean.length);
  });

  it("never proposes two closes on one day", () => {
    const closes = suggestCloses({}, "2026-09-01", NOW_CAP);
    expect(new Set(closes.map((c) => c.until)).size).toBe(closes.length);
  });
});

describe("loadNowQuestions", () => {
  it("reads the bank's now questions, every one windowed", () => {
    const rows = loadNowQuestions();
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.cat).toBe(NOW_TOPIC);
      expect(windowDays(r.from, r.until)).not.toBeNull();
      expect(r.core).not.toBe(true);
    }
  });
});

// D54's signal logic. Each signal's job is to separate one attack shape
// from the honest behaviour that most resembles it, so every case here
// pins a boundary where those two meet: the keen human binge vs the
// jittered script, the launch spike vs the minted ring, the promoted
// question's debut vs the stuffed old question. Thresholds are imported,
// not retyped — a tuned constant moves the tests with it.
import { describe, expect, it } from "vitest";
import {
  AGG_BANK_SIZE,
  BASELINE_MIN_DAYS,
  BURST_MIN,
  BURST_MULT,
  CADENCE_MIN_N,
  CLUSTER_MIN,
  CLUSTER_WINDOW_MS,
  birthClusters,
  burstSignal,
  cadenceSignal,
  emptyFold,
  foldInto,
  foldWindow,
  volumeFlagged,
  isAggregateSurface,
  PULSE_BANK_SIZE,
  VOLUME_CEILING,
  WINDOW_MAX_DAYS,
  mergeDays,
  pruneDays,
  type DayCounts,
  type LedgerRow,
} from "./velocity";
// One name, one meaning: the day-key helpers live in pure.ts now.
import { utcDayKeyOf } from "./pure";
import { V2_QUESTIONS } from "./v2content";

describe("utcDayKeyOf", () => {
  it("is the UTC calendar day, zero-padded", () => {
    expect(utcDayKeyOf(Date.parse("2026-08-06T00:00:01Z"))).toBe("2026-08-06");
    expect(utcDayKeyOf(Date.parse("2026-08-05T23:59:59Z"))).toBe("2026-08-05");
    // The trap: a local-time implementation shifts this one across the
    // year boundary in any western timezone.
    expect(utcDayKeyOf(Date.parse("2027-01-01T00:00:01Z"))).toBe("2027-01-01");
  });
});

describe("the impossible-volume ceiling", () => {
  // Derived from the trigger's own rule rather than from a hand-kept
  // list, which is how `pulse` and then `call` came to be missing while
  // this test stayed green: onV2AnswerCreated diverts group/duo and folds
  // everything else, so every other surface in the bank writes a ledger
  // entry and belongs in the ceiling.
  it("counts exactly the surfaces the aggregate trigger folds", () => {
    const inBank = [...new Set(V2_QUESTIONS.map((q) => q.surface))];
    expect(inBank.length).toBeGreaterThan(4);
    for (const s of inBank) {
      expect(isAggregateSurface(s), `${s} is in the bank`).toBe(s !== "group" && s !== "duo");
    }
    // Named as well as derived: duel answers never write ledger entries
    // (member reveals, not aggregates — D29), so duel-bank questions must
    // not raise the ceiling a fake account is measured against.
    expect(isAggregateSurface("group")).toBe(false);
    expect(isAggregateSurface("duo")).toBe(false);
  });
  it("derives a usable ceiling from the committed bank", () => {
    expect(AGG_BANK_SIZE).toBeGreaterThan(0);
  });
  it("budgets the pulse for the window it measures, not the ledger's TTL", () => {
    // The quantity compared against this is the per-uid entry count
    // INSIDE the scan window, and that window is capped at 72 hours. The
    // allowance was derived from the ledger's 90-day expireAt, which made
    // the ceiling roughly 1.7x the honest maximum — a detector for "2x a
    // uid's real count" that a doubled heavy day sat comfortably under.
    expect(WINDOW_MAX_DAYS).toBe(4);
    expect(VOLUME_CEILING).toBe(AGG_BANK_SIZE + PULSE_BANK_SIZE * WINDOW_MAX_DAYS);
    // The shape of the mistake, stated so a re-derivation from any
    // longer-lived constant fails here rather than in production.
    expect(VOLUME_CEILING).toBeLessThan(AGG_BANK_SIZE + PULSE_BANK_SIZE * 90);
  });

  it("counts CREATES, so an honest reviser is not flagged", () => {
    // D86 made an optionIdx edit write a SECOND ledger row, which broke
    // the invariant this ceiling rests on ("one entry per question, ever")
    // and left the bound sitting almost exactly at the honest maximum. A
    // heavy user who also revised answers inside the window crossed it —
    // a false WARN on the person using the app most.
    //
    // Every row still feeds cadence: an edit is an action, and an
    // edit-spam script's rhythm shows there.
    const rows: LedgerRow[] = [];
    for (let i = 0; i < VOLUME_CEILING; i++) {
      rows.push({ uid: "u_heavy", qid: `q${i}`, atMs: 1_000 + i });
    }
    // …and then revises a hundred of them.
    for (let i = 0; i < 100; i++) {
      rows.push({ uid: "u_heavy", qid: `q${i}`, atMs: 900_000 + i, isEdit: true });
    }
    const fold = foldWindow(rows);
    expect(fold.perUid.get("u_heavy")!.length,
      "cadence lost the edits — a script's rhythm hides in them").toBe(VOLUME_CEILING + 100);
    expect(fold.createsPerUid.get("u_heavy"),
      "edits counted toward a ceiling that is about creates").toBe(VOLUME_CEILING);
  });

  it("flags on creates, and only past the line", () => {
    // The DECISION, not just the counting. Both cases here proved the fold
    // and nothing proved what the number was used for — the comparison
    // lived inline in the scheduled handler, whose body no test reaches,
    // so either half of the D86 edit fix could be reverted with all 550
    // tests green.
    const rows: LedgerRow[] = [];
    for (let i = 0; i < VOLUME_CEILING; i++) {
      rows.push({ uid: "u_heavy", qid: `q${i}`, atMs: 1_000 + i });
    }
    for (let i = 0; i < 200; i++) {
      rows.push({ uid: "u_heavy", qid: `q${i}`, atMs: 900_000 + i, isEdit: true });
    }
    const heavy = foldWindow(rows);
    expect(volumeFlagged(heavy, "u_heavy"),
      "an honest reviser at the ceiling was flagged").toBe(false);
    expect(volumeFlagged(heavy, "u_nobody"), "an unknown uid was flagged").toBe(false);

    rows.push({ uid: "u_heavy", qid: "q_extra", atMs: 950_000 });
    expect(volumeFlagged(foldWindow(rows), "u_heavy"),
      "one create past the line was not flagged").toBe(true);
  });

  it("still counts a create past the ceiling", () => {
    // The control: excluding edits must not exclude everything. One create
    // over the line is over the line.
    const rows: LedgerRow[] = [];
    for (let i = 0; i <= VOLUME_CEILING; i++) {
      rows.push({ uid: "u_forged", qid: `q${i}`, atMs: 1_000 + i });
    }
    expect(foldWindow(rows).createsPerUid.get("u_forged")).toBe(VOLUME_CEILING + 1);
  });
});

describe("cadenceSignal", () => {
  const seriesFromGaps = (startMs: number, gaps: number[]): number[] => {
    const out = [startMs];
    for (const g of gaps) out.push(out[out.length - 1] + g);
    return out;
  };

  it("returns null below CADENCE_MIN_N — few answers cannot convict", () => {
    const times = seriesFromGaps(0, Array(CADENCE_MIN_N - 2).fill(5000));
    expect(times.length).toBe(CADENCE_MIN_N - 1);
    expect(cadenceSignal(times)).toBeNull();
  });

  it("flags a fixed-sleep script (cv ~ 0)", () => {
    const times = seriesFromGaps(0, Array(24).fill(5000));
    const stat = cadenceSignal(times);
    expect(stat?.flagged).toBe(true);
    expect(stat?.cv).toBeLessThan(0.01);
  });

  it("flags identical timestamps — a batch writer, not a person", () => {
    const stat = cadenceSignal(Array(CADENCE_MIN_N).fill(1_000_000));
    expect(stat?.flagged).toBe(true);
    expect(stat?.meanMs).toBe(0);
  });

  it("flags a sub-2s sustained mean even with human-looking variance", () => {
    // Varied gaps (cv well above the floor) but nobody reads a question
    // in under two seconds, twenty times running.
    const gaps = [800, 2500, 400, 1900, 600, 3000, 500, 1200, 900, 2800,
      450, 1600, 700, 2200, 550, 1400, 850, 2600, 480, 1100];
    const stat = cadenceSignal(seriesFromGaps(0, gaps));
    expect(stat?.flagged).toBe(true);
    expect(stat?.cv).toBeGreaterThan(0.25);
  });

  it("passes a human binge — fast but ragged", () => {
    // Answering the backlog in one sitting: seconds per card, but
    // reading time swings by the question. This is the honest case the
    // signal must not flag.
    const gaps = [4000, 9000, 5000, 31000, 12000, 4500, 60000, 7000,
      15000, 5500, 22000, 8000, 45000, 6000, 11000, 9500, 18000, 5000];
    const stat = cadenceSignal(seriesFromGaps(0, gaps));
    expect(stat?.flagged).toBe(false);
  });

  it("accepts timestamps in any order", () => {
    const times = seriesFromGaps(0, Array(24).fill(5000)).reverse();
    expect(cadenceSignal(times)?.flagged).toBe(true);
  });
});

describe("birthClusters", () => {
  const mk = (n: number, startMs: number, stepMs: number, prefix = "u") =>
    Array.from({ length: n }, (_, i) => ({
      uid: `${prefix}${i}`,
      createdMs: startMs + i * stepMs,
    }));

  it("needs CLUSTER_MIN inside the window", () => {
    expect(birthClusters(mk(CLUSTER_MIN - 1, 0, 1000))).toEqual([]);
    const [c] = birthClusters(mk(CLUSTER_MIN, 0, 1000));
    expect(c.uids).toHaveLength(CLUSTER_MIN);
  });

  it("ignores accounts spread wider than the window", () => {
    // One account every 3 minutes: any 10-minute window holds at most
    // four — the organic trickle shape.
    expect(birthClusters(mk(12, 0, 3 * 60_000))).toEqual([]);
  });

  it("merges overlapping windows into one maximal cluster", () => {
    // Fifteen accounts a minute apart span 14 minutes — wider than any
    // single window, but every consecutive window along the run
    // qualifies. One ring of fifteen, not a pile of overlapping fives;
    // the span proves the merge crossed the window width.
    const clusters = birthClusters(mk(15, 0, 60_000));
    expect(clusters).toHaveLength(1);
    expect(clusters[0].uids).toHaveLength(15);
    expect(clusters[0].spanMs).toBe(14 * 60_000);
    expect(clusters[0].spanMs).toBeGreaterThan(CLUSTER_WINDOW_MS);
  });

  it("keeps genuinely separate sittings separate", () => {
    const morning = mk(5, 0, 1000, "m");
    const evening = mk(5, 12 * 3600_000, 1000, "e");
    const clusters = birthClusters([...evening, ...morning]); // unsorted
    expect(clusters).toHaveLength(2);
    expect(clusters[0].uids.every((u) => u.startsWith("m"))).toBe(true);
    expect(clusters[1].uids.every((u) => u.startsWith("e"))).toBe(true);
  });

  it("finds the tight ring inside an organic day", () => {
    // Hourly organic signups, and a six-account ring minted 20 minutes
    // after one of them — far enough that no honest account shares the
    // ring's window, so the flag names exactly the ring.
    const trickle = mk(4, 0, 3600_000, "t");
    const ring = mk(6, 2 * 3600_000 + 20 * 60_000, 30_000, "r");
    const clusters = birthClusters([...trickle, ...ring]);
    expect(clusters).toHaveLength(1);
    expect([...clusters[0].uids].sort()).toEqual(ring.map((r) => r.uid).sort());
    expect(clusters[0].spanMs).toBeLessThanOrEqual(CLUSTER_WINDOW_MS);
  });
});

describe("burstSignal", () => {
  const quietWeek: DayCounts = {
    "2026-08-01": { "feed-001": 1 },
    "2026-08-02": { "feed-001": 2 },
    "2026-08-03": { "feed-001": 1 },
  };

  it("never flags without an established baseline — debuts are loud by design", () => {
    // A freshly promoted question's first day, or the daily question's
    // own day: huge count, no history. Must not flag.
    const b = burstSignal("feed-new", "2026-08-04", 500, {
      "2026-08-03": { "feed-other": 3 },
    });
    expect(b.baselineDays).toBeLessThan(BASELINE_MIN_DAYS);
    expect(b.flagged).toBe(false);
  });

  it("flags a jump on a settled question", () => {
    // The attack shape: an old question, quiet for days, suddenly
    // stuffed to flip its split.
    const b = burstSignal("feed-001", "2026-08-04", 12, quietWeek);
    expect(b.flagged).toBe(true);
    expect(b.baselineDays).toBe(3);
  });

  it("holds both jaws at the boundary", () => {
    // Below the absolute floor: too small to matter even at infinite
    // multiple (the k-floor already hides these sizes).
    expect(burstSignal("feed-001", "2026-08-04", BURST_MIN - 1, quietWeek).flagged).toBe(false);
    // Below the multiple: busy but proportionate.
    const busy: DayCounts = {
      "2026-08-01": { "feed-001": 20 },
      "2026-08-02": { "feed-001": 20 },
      "2026-08-03": { "feed-001": 20 },
    };
    expect(burstSignal("feed-001", "2026-08-04", BURST_MULT * 20 - 1, busy).flagged).toBe(false);
    expect(burstSignal("feed-001", "2026-08-04", BURST_MULT * 20, busy).flagged).toBe(true);
  });

  it("reads a recorded day with no entries for the qid as zero, and skips unrecorded days", () => {
    const b = burstSignal("feed-002", "2026-08-04", 12, quietWeek);
    // feed-002 never appears in the recorded days: baseline 0 across
    // three known days — flagged, because three days of genuine silence
    // followed by 12 votes is the stuffed-question shape.
    expect(b.baselineDays).toBe(3);
    expect(b.baselineMean).toBe(0);
    expect(b.flagged).toBe(true);
  });

  it("ignores days at or after the day under test", () => {
    const withFuture: DayCounts = {
      ...quietWeek,
      "2026-08-04": { "feed-001": 99 },
      "2026-08-05": { "feed-001": 99 },
    };
    const b = burstSignal("feed-001", "2026-08-04", 12, withFuture);
    expect(b.baselineDays).toBe(3);
    expect(b.flagged).toBe(true);
  });
});

describe("window fold and state", () => {
  it("folds rows into per-uid times and per-day question counts", () => {
    const t0 = Date.parse("2026-08-06T10:00:00Z");
    const fold = foldWindow([
      { uid: "a", qid: "q1", atMs: t0 },
      { uid: "a", qid: "q2", atMs: t0 + 1000 },
      { uid: "b", qid: "q1", atMs: t0 + 2000 },
      // Same uid across midnight lands in the next day's bucket.
      { uid: "a", qid: "q1", atMs: Date.parse("2026-08-07T00:00:01Z") },
    ]);
    expect(fold.entries).toBe(4);
    expect(fold.perUid.get("a")).toHaveLength(3);
    expect(fold.perDayQid["2026-08-06"]).toEqual({ q1: 2, q2: 1 });
    expect(fold.perDayQid["2026-08-07"]).toEqual({ q1: 1 });
  });

  // The scan folds page by page so it never holds the window in RAM
  // (velocity.ts). That is only safe if paging is invisible to the result:
  // a uid or a (day, qid) split across a page boundary has to land in the
  // same bucket it would have from one call. Split at 1 to force every
  // boundary that matters — both of "a"'s 2026-08-06 answers, and the two
  // sides of the midnight rollover, fall in different pages.
  it("folds page by page to the same result as folding the whole window", () => {
    const t0 = Date.parse("2026-08-06T10:00:00Z");
    const rows: LedgerRow[] = [
      { uid: "a", qid: "q1", atMs: t0 },
      { uid: "a", qid: "q2", atMs: t0 + 1000 },
      { uid: "b", qid: "q1", atMs: t0 + 2000 },
      { uid: "a", qid: "q1", atMs: Date.parse("2026-08-07T00:00:01Z") },
    ];
    const whole = foldWindow(rows);
    for (const size of [1, 2, 3, 4, 99]) {
      const paged = emptyFold();
      for (let i = 0; i < rows.length; i += size) {
        foldInto(paged, rows.slice(i, i + size));
      }
      expect(paged.entries).toBe(whole.entries);
      expect(paged.perDayQid).toEqual(whole.perDayQid);
      expect([...paged.perUid.entries()].sort()).toEqual(
        [...whole.perUid.entries()].sort(),
      );
    }
  });

  // An empty page must not create buckets — the scan calls foldInto for
  // every page including a final short one that can filter down to zero
  // rows (entries with no uid predate D28's attribution field).
  it("folding an empty page changes nothing", () => {
    const acc = emptyFold();
    foldInto(acc, []);
    expect(acc.entries).toBe(0);
    expect(acc.perUid.size).toBe(0);
    expect(acc.perDayQid).toEqual({});
  });

  it("merges window counts into state without losing either side", () => {
    const merged = mergeDays(
      { "2026-08-05": { q1: 3 }, "2026-08-06": { q1: 2 } },
      { "2026-08-06": { q1: 4, q2: 1 }, "2026-08-07": { q3: 5 } },
    );
    expect(merged).toEqual({
      "2026-08-05": { q1: 3 },
      "2026-08-06": { q1: 6, q2: 1 },
      "2026-08-07": { q3: 5 },
    });
  });

  it("prunes to the newest days by calendar order", () => {
    const days: DayCounts = {};
    for (let d = 1; d <= 12; d++) days[`2026-08-${String(d).padStart(2, "0")}`] = { q: d };
    const pruned = pruneDays(days, 7);
    expect(Object.keys(pruned)).toHaveLength(7);
    expect(Object.keys(pruned).sort()[0]).toBe("2026-08-06");
    expect(pruned["2026-08-12"]).toEqual({ q: 12 });
  });
});

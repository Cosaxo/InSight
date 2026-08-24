// learn-budget.test.mjs — pins the D115 learn regulator's arithmetic.
//
// The first property under test is the one the old rule failed: the lane must
// be able to return work. D32's "≤8 cards/run, thinnest fields first" could
// not — every field sits at the 8-card spacing floor, so nothing was ever
// thinnest and every run was a correctly-reasoned no-op. A budget function
// that returns zero against the shipped bank is the bug, not the safeguard.
//
// The second is the single-gate posture: a learn card merges straight into
// production, so unlike the daily lane the regulator subtracts the open PR's
// unreviewed cards from the budget rather than only comparing them to a
// ceiling. The simulation below says what that does over a year.
import { describe, it, expect } from "vitest";
import {
  learnBudget,
  learnRunway,
  loadLearnFields,
  RUN_CAP,
  FIELD_TARGET,
  OPEN_MAX,
  MIN_CHUNK,
} from "./learn-budget.mjs";

const level = (n, cards) =>
  Array.from({ length: n }, (_, i) => ({ id: `f${String(i).padStart(2, "0")}`, cards }));

describe("learnBudget", () => {
  it("finds work in the bank as it actually ships", () => {
    // The regression that motivated the whole change: not "is the number
    // right" but "is there a number at all".
    const { budget, allocation } = learnBudget({ fields: loadLearnFields() });
    expect(budget).toBeGreaterThan(0);
    expect(allocation.length).toBeGreaterThan(0);
  });

  it("grants the full cap to a bank far from target", () => {
    expect(learnBudget({ fields: level(12, 8) }).budget).toBe(RUN_CAP);
  });

  it("throttles to zero once every field is at target", () => {
    expect(learnBudget({ fields: level(12, FIELD_TARGET) }).budget).toBe(0);
    expect(learnBudget({ fields: level(12, FIELD_TARGET + 5) }).budget).toBe(0);
  });

  it("writes only the gap when one field is nearly full", () => {
    const fields = [...level(11, FIELD_TARGET), { id: "thin", cards: FIELD_TARGET - 3 }];
    expect(learnBudget({ fields }).budget).toBe(3);
  });

  it("subtracts the open PR from the budget, not just from a ceiling", () => {
    // The single-gate difference from farm-budget: with cards already
    // unreviewed, a run tops up to one batch rather than granting a fresh one.
    expect(learnBudget({ fields: level(12, 8), open: 4 }).budget).toBe(OPEN_MAX - 4);
    expect(learnBudget({ fields: level(12, 8), open: OPEN_MAX - 1 }).budget).toBe(1);
  });

  it("stops entirely when the open PR is unreviewable", () => {
    // Even with an empty bank: OPEN_MAX is about the reviewer, not the bank.
    expect(learnBudget({ fields: level(12, 0), open: OPEN_MAX }).budget).toBe(0);
    expect(learnBudget({ fields: level(12, 0), open: OPEN_MAX + 5 }).budget).toBe(0);
  });

  it("never exceeds the cap, never goes negative, never overfills a field", () => {
    for (const cards of [0, 4, 8, 20, FIELD_TARGET - 1, FIELD_TARGET]) {
      for (let open = 0; open <= OPEN_MAX + 2; open++) {
        const fields = level(12, cards);
        const { budget, allocation } = learnBudget({ fields, open });
        expect(budget).toBeGreaterThanOrEqual(0);
        expect(budget).toBeLessThanOrEqual(RUN_CAP);
        expect(allocation.reduce((n, a) => n + a.write, 0)).toBe(budget);
        for (const a of allocation) expect(a.cards + a.write).toBeLessThanOrEqual(FIELD_TARGET);
      }
    }
  });

  it("allocates in writable chunks, thinnest first", () => {
    // MIN_CHUNK is a shape rule, not a volume one: a run must not scatter one
    // card into ten fields, because the difficulty spread check:quality asks
    // for is a per-field property and a writer holding one subject writes
    // better cards than one hopping twelve.
    const fields = [
      { id: "deep", cards: 20 },
      { id: "thin", cards: 4 },
      { id: "middling", cards: 12 },
      ...level(9, FIELD_TARGET),
    ];
    const { allocation } = learnBudget({ fields });
    expect(allocation.length).toBeLessThanOrEqual(Math.floor(RUN_CAP / MIN_CHUNK));
    expect(allocation[0].field).toBe("thin");
    for (const a of allocation) expect(a.write).toBeGreaterThanOrEqual(MIN_CHUNK);
  });

  it("moves the remainder on rather than overfilling a nearly-full field", () => {
    const fields = [
      { id: "almost", cards: FIELD_TARGET - 2 },
      { id: "room", cards: 10 },
      ...level(10, FIELD_TARGET),
    ];
    const { allocation } = learnBudget({ fields });
    const almost = allocation.find((a) => a.field === "almost");
    expect(almost.write).toBe(2);
    expect(allocation.find((a) => a.field === "room").write).toBe(RUN_CAP - 2);
  });

  it("level fields come up in turn across runs rather than one absorbing every batch", () => {
    // Ties break on id, so a run is reproducible; the water-filling is what
    // makes reproducible not mean repetitive.
    const fields = level(12, 8);
    const touched = new Set();
    for (let run = 0; run < 6; run++) {
      const { allocation } = learnBudget({ fields });
      for (const a of allocation) {
        touched.add(a.field);
        fields.find((f) => f.id === a.field).cards += a.write;
      }
    }
    expect(touched.size).toBeGreaterThan(4);
  });

  it("steady state: the bank converges on the target and stops", () => {
    // A year of weekly runs against a reviewer who merges each batch before
    // the next. The claims: the bank reaches the target, no field overshoots
    // it, and generation stops there rather than running to the 52 × RUN_CAP
    // the cap alone would permit.
    const fields = level(12, 8);
    let generated = 0;
    for (let week = 0; week < 52; week++) {
      const { allocation } = learnBudget({ fields });
      for (const a of allocation) {
        fields.find((f) => f.id === a.field).cards += a.write;
        generated += a.write;
      }
    }
    expect(generated).toBe(12 * (FIELD_TARGET - 8));
    expect(generated).toBeLessThan(52 * RUN_CAP);
    for (const f of fields) expect(f.cards).toBe(FIELD_TARGET);
    expect(learnBudget({ fields }).budget).toBe(0);
  });

  it("constants hold their documented relationships", () => {
    // FIELD_TARGET is three times the scheduler's 8-card spacing floor;
    // OPEN_MAX EQUALS RUN_CAP, which is the single-gate posture and the one
    // relationship deliberately unlike the daily lane's (there OPEN_MAX is
    // the larger, because a second human gate still stands behind that PR).
    expect(FIELD_TARGET).toBe(3 * 8);
    expect(OPEN_MAX).toBe(RUN_CAP);
    expect(RUN_CAP).toBeGreaterThanOrEqual(MIN_CHUNK * 2);
  });
});

describe("learnRunway", () => {
  it("reports the runway over every followed field, from the serve rate", () => {
    // A fixture, not loadLearnFields(): the derivation is about the
    // constants, and pinning it to the live bank made every learn append
    // that lifts a thinnest field a test failure (first tripped 2026-08-24,
    // when gene and origins went 8 → 13 and the thinnest three summed 29).
    //
    // Twelve fields at 8, and the default denominator is now all twelve
    // (D279) rather than the three learn-progress.js used to seed. Same
    // method, different input — and the input is the whole of what D279
    // changed, so this case is where that shows.
    const r = learnRunway(level(12, 8));
    expect(r.fresh).toBe(96);
    expect(r.followed).toBe(12);
    expect(r.someDays).toBeGreaterThan(r.lotsDays);
  });

  it("still answers for a reader who has narrowed", () => {
    // The old default, kept reachable rather than deleted: unfollowing is
    // a real control (the topic sheet's Learn rows, D279), so "what has a
    // reader on three fields got left" stays a question worth asking — it
    // is just no longer the one a fresh install is in.
    const r = learnRunway(level(12, 8), { followed: 3 });
    expect(r.fresh).toBe(24);
    expect(r.followed).toBe(3);
  });

  it("scales with the target, which is the argument for raising it", () => {
    const atTarget = learnRunway(level(12, FIELD_TARGET), { followed: 3 });
    expect(atTarget.someDays).toBeGreaterThanOrEqual(25);
  });
});

// learn-budget.test.mjs — pins the learn regulator's arithmetic (D115,
// reshaped at D350).
//
// The first property under test is the one the old rule failed: the lane must
// be able to return work. D32's "≤8 cards/run, thinnest fields first" could
// not — every field sits at the 8-card spacing floor, so nothing was ever
// thinnest and every run was a correctly-reasoned no-op. A budget function
// that returns zero against the shipped bank is the bug, not the safeguard.
//
// The second, since D350, is that it must never stop for stock either: the
// D115 regulator granted zero at 24 cards per field, and the test that pinned
// that ("throttles to zero once every field is at target") was the
// bounded-bank premise worn as a test. 24 is a FLOOR now — reached first,
// never stopped at.
//
// The third is the single-gate posture: a learn card merges straight into
// production, so the regulator subtracts the open PR's unreviewed cards from
// the budget rather than only comparing them to a ceiling.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  learnBudget,
  learnRunway,
  learnSignal,
  loadLearnFields,
  RUN_CAP,
  FIELD_FLOOR,
  OPEN_MAX,
  MIN_CHUNK,
  DEMAND_MIN_ANSWERS,
  DEMAND_STALE_DAYS,
} from "./learn-budget.mjs";

const level = (n, cards) =>
  Array.from({ length: n }, (_, i) => ({ id: `f${String(i).padStart(2, "0")}`, cards }));
const total = (allocation) => allocation.reduce((n, a) => n + a.write, 0);

describe("learnBudget", () => {
  it("finds work in the bank as it actually ships", () => {
    // The regression that motivated the whole change: not "is the number
    // right" but "is there a number at all".
    const { budget, allocation } = learnBudget({ fields: loadLearnFields() });
    expect(budget).toBeGreaterThan(0);
    expect(allocation.length).toBeGreaterThan(0);
  });

  it("grants the full cap to a bank far from the floor", () => {
    expect(learnBudget({ fields: level(12, 8) }).budget).toBe(RUN_CAP);
  });

  it("never stops for stock — a levelled bank still gets the full cap (D316/D350)", () => {
    expect(learnBudget({ fields: level(12, FIELD_FLOOR) }).budget).toBe(RUN_CAP);
    const { budget, split } = learnBudget({ fields: level(12, FIELD_FLOOR * 10) });
    expect(budget).toBe(RUN_CAP);
    expect(split.floor).toBe(0);
    expect(split.level).toBe(RUN_CAP);
  });

  it("subtracts the open PR from the budget, not just from a ceiling", () => {
    // The single-gate difference from farm-budget: with cards already
    // unreviewed, a run tops up to one batch rather than granting a fresh one.
    expect(learnBudget({ fields: level(12, 8), open: 4 }).budget).toBe(OPEN_MAX - 4);
    expect(learnBudget({ fields: level(12, 8), open: OPEN_MAX - 1 }).budget).toBe(1);
  });

  it("stops entirely when the open PR is unreviewable — the one stop left", () => {
    // Even with an empty bank: OPEN_MAX is about the gate, not the bank.
    expect(learnBudget({ fields: level(12, 0), open: OPEN_MAX }).budget).toBe(0);
    expect(learnBudget({ fields: level(12, 0), open: OPEN_MAX + 5 }).budget).toBe(0);
  });

  it("never exceeds the cap, never goes negative, always spends what it grants", () => {
    for (const cards of [0, 4, 8, 20, FIELD_FLOOR - 1, FIELD_FLOOR, FIELD_FLOOR + 40]) {
      for (let open = 0; open <= OPEN_MAX + 2; open++) {
        const { budget, allocation } = learnBudget({ fields: level(12, cards), open });
        expect(budget).toBeGreaterThanOrEqual(0);
        expect(budget).toBeLessThanOrEqual(RUN_CAP);
        expect(total(allocation)).toBe(budget);
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
      ...level(9, FIELD_FLOOR),
    ];
    const { allocation } = learnBudget({ fields });
    expect(allocation.length).toBeLessThanOrEqual(Math.floor(RUN_CAP / MIN_CHUNK));
    expect(allocation[0].field).toBe("thin");
    for (const a of allocation) expect(a.write).toBeGreaterThanOrEqual(MIN_CHUNK);
  });

  it("a field near the floor still takes a full chunk — there is no ceiling to stop short of", () => {
    // The old regulator wrote 2 into a field two short and moved the rest
    // on; that was the target's rule. A floor has no room to respect.
    const fields = [
      { id: "almost", cards: FIELD_FLOOR - 2 },
      { id: "room", cards: 10 },
      ...level(10, FIELD_FLOOR),
    ];
    const { allocation } = learnBudget({ fields });
    expect(allocation.map((a) => a.field)).toEqual(["room", "almost"]);
    for (const a of allocation) expect(a.write).toBeGreaterThanOrEqual(MIN_CHUNK);
    expect(total(allocation)).toBe(RUN_CAP);
  });

  it("level fields come up in turn across runs rather than one absorbing every batch", () => {
    // Ties break on id, so a run is reproducible; thinnest-first is what
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

  it("clears the floor in a bounded number of runs and keeps going", () => {
    // The floor is reachable, and once every field clears it the lane does
    // NOT go quiet: generation continues at the cap, levelling.
    const fields = level(12, 8);
    let runs = 0;
    for (; runs < 100 && !fields.every((f) => f.cards >= FIELD_FLOOR); runs++) {
      const { allocation } = learnBudget({ fields });
      for (const a of allocation) fields.find((f) => f.id === a.field).cards += a.write;
    }
    expect(runs).toBeLessThan(100);
    expect(fields.every((f) => f.cards >= FIELD_FLOOR)).toBe(true);
    const next = learnBudget({ fields });
    expect(next.budget).toBe(RUN_CAP);
    expect(next.split.level).toBe(RUN_CAP);
  });

  it("above the floor, the demand share picks the fields the crowd reads fastest", () => {
    const fields = level(3, FIELD_FLOOR);
    const { allocation, split } = learnBudget({ fields, demand: { f00: 0.1, f01: 0.7, f02: 0.2 } });
    expect(allocation.map((a) => a.field)).toEqual(["f01", "f02"]);
    expect(split.demand).toBe(RUN_CAP);
  });

  it("constants hold their documented relationships", () => {
    // FIELD_FLOOR is three times the scheduler's 8-card spacing floor;
    // OPEN_MAX EQUALS RUN_CAP, the single-gate posture.
    expect(FIELD_FLOOR).toBe(3 * 8);
    expect(OPEN_MAX).toBe(RUN_CAP);
    expect(RUN_CAP).toBeGreaterThanOrEqual(MIN_CHUNK * 2);
  });
});

describe("learnSignal", () => {
  const fresh = () => new Date().toISOString();
  const scorecardOf = (fields, answers, generatedAt = fresh()) => ({
    generatedAt,
    learn: { fields: Object.fromEntries(fields.map((f) => [f.id, { cards: f.cards, scored: 1, answers: answers(f) }])) },
  });

  it("is blind with no scorecard, and under DEMAND_MIN_ANSWERS", () => {
    const fields = loadLearnFields();
    expect(learnSignal(null, fields).mode).toBe("blind");
    const s = learnSignal(scorecardOf(fields, () => (DEMAND_MIN_ANSWERS - 1) / fields.length), fields);
    expect(s.mode).toBe("blind");
    expect(s.note).toContain(`under ${DEMAND_MIN_ANSWERS}`);
  });

  it("is blind against the committed scorecard as it stands today, and says why", () => {
    const scorecard = JSON.parse(readFileSync(new URL("../content/scorecard.json", import.meta.url), "utf8"));
    const fields = loadLearnFields();
    const credited = fields.reduce((n, f) => n + (scorecard.learn?.fields?.[f.id]?.answers ?? 0), 0);
    const s = learnSignal(scorecard, fields, Date.parse(scorecard.generatedAt));
    expect(s.mode).toBe(credited >= DEMAND_MIN_ANSWERS ? "demand" : "blind");
  });

  it("is blind past DEMAND_STALE_DAYS, however loud the crowd", () => {
    const fields = loadLearnFields();
    const at = Date.parse("2026-01-01T00:00:00Z");
    const sc = scorecardOf(fields, () => 1000, new Date(at).toISOString());
    expect(learnSignal(sc, fields, at + (DEMAND_STALE_DAYS + 1) * 86400000).mode).toBe("blind");
    expect(learnSignal(sc, fields, at + DEMAND_STALE_DAYS * 86400000).mode).toBe("demand");
  });

  it("reads the learn section, not the daily/feed topic rows", () => {
    const fields = level(3, 20);
    const sc = { generatedAt: fresh(), topics: { f00: { answers: 9999 } }, learn: { fields: {} } };
    expect(learnSignal(sc, fields).mode).toBe("blind");
    const s = learnSignal(scorecardOf(fields, (f) => ({ f00: 600, f01: 300, f02: 100 })[f.id]), fields);
    expect(s.mode).toBe("demand");
    expect(s.weights.f00).toBeGreaterThan(s.weights.f01);
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
    // (D283) rather than the three learn-progress.js used to seed. Same
    // method, different input — and the input is the whole of what D283
    // changed, so this case is where that shows.
    const r = learnRunway(level(12, 8));
    expect(r.fresh).toBe(96);
    expect(r.followed).toBe(12);
    expect(r.someDays).toBeGreaterThan(r.lotsDays);
  });

  it("still answers for a reader who has narrowed", () => {
    // The old default, kept reachable rather than deleted: unfollowing is
    // a real control (the topic sheet's Learn rows, D283), so "what has a
    // reader on three fields got left" stays a question worth asking — it
    // is just no longer the one a fresh install is in.
    const r = learnRunway(level(12, 8), { followed: 3 });
    expect(r.fresh).toBe(24);
    expect(r.followed).toBe(3);
  });

  it("scales with the floor, which is the argument for it", () => {
    const atFloor = learnRunway(level(12, FIELD_FLOOR), { followed: 3 });
    expect(atFloor.someDays).toBeGreaterThanOrEqual(25);
  });
});

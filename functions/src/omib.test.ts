// omib.ts pinned — the form a seed names, the scoring rule, the folds and
// the two percentiles. Plain node, no emulator: everything decidable is
// decided here, the pure.ts discipline.
import { describe, it, expect } from "vitest";
import {
  OMIB_FORM_ITEMS, OMIB_MIN_A, OMIB_USABLE, OMIB_STRATA, OMIB_ERA, OMIB_BANK_VERSION, EMPTY_CELL,
  usableItems, omibForm, omibClientItems, validOmibPicks, scoreOmibPicks,
  thetaBin, THETA_BINS, foldThetaNorms, foldItemStats, measuredPctileTheta, modelPctileTheta, isOmibEra,
} from "./omib";
import { OMIB_ITEMS, OMIB_KEY } from "./omib-bank";

describe("the usable bank", () => {
  it("is 218 of 220: the floor drops the unparameterised item and the one under a = 0.5", () => {
    const u = usableItems();
    expect(u).toHaveLength(OMIB_USABLE);
    expect(OMIB_ITEMS).toHaveLength(220);
    expect(u.every((i) => i.a !== null && i.b !== null && (i.a as number) >= OMIB_MIN_A)).toBe(true);
    expect(OMIB_ITEMS.filter((i) => i.a === null)).toHaveLength(1);
    expect(OMIB_ITEMS.filter((i) => i.a !== null && i.a < OMIB_MIN_A)).toHaveLength(1);
  });

  it("no item's answer is the empty cell — a blank must never score as right", () => {
    for (const it of OMIB_ITEMS) expect(OMIB_KEY[it.n], `item ${it.n}`).not.toBe(EMPTY_CELL);
    expect(Object.keys(OMIB_KEY)).toHaveLength(220);
  });

  it("keeps the pyramid the strata draw from", () => {
    const byRules = (r: number) => usableItems().filter((i) => i.rules === r).length;
    for (const s of OMIB_STRATA) expect(byRules(s.rules)).toBeGreaterThanOrEqual(s.slots);
    expect(OMIB_STRATA.reduce((n, s) => n + s.slots, 0)).toBe(OMIB_FORM_ITEMS);
  });
});

describe("the form a seed names", () => {
  it("is 25 usable items, 2·6·9·6·2 by rule count, no repeats, easy → hard", () => {
    for (const seed of [1, 17, 0xdeadbeef, 4_000_000_000]) {
      const form = omibForm(seed);
      expect(form).toHaveLength(OMIB_FORM_ITEMS);
      expect(new Set(form.map((i) => i.n)).size).toBe(OMIB_FORM_ITEMS);
      for (const s of OMIB_STRATA) expect(form.filter((i) => i.rules === s.rules), `seed ${seed} rules ${s.rules}`).toHaveLength(s.slots);
      const bs = form.map((i) => i.b as number);
      for (let i = 1; i < bs.length; i++) expect(bs[i]).toBeGreaterThanOrEqual(bs[i - 1]);
      expect(form.every((i) => (i.a as number) >= OMIB_MIN_A)).toBe(true);
    }
  });

  it("is deterministic per seed and differs between seeds", () => {
    expect(omibForm(42).map((i) => i.n)).toEqual(omibForm(42).map((i) => i.n));
    const a = omibForm(42).map((i) => i.n).join(",");
    const b = omibForm(43).map((i) => i.n).join(",");
    expect(a).not.toBe(b);
  });

  it("spreads exposure: across many seeds every usable item is drawn at least once", () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 400; seed++) for (const i of omibForm(seed)) seen.add(i.n);
    expect(seen.size).toBe(OMIB_USABLE);
  });

  it("hands the client codes only, with the ninth cell empty and never the answer", () => {
    const items = omibClientItems(7);
    const form = omibForm(7);
    expect(items).toHaveLength(OMIB_FORM_ITEMS);
    items.forEach((it, i) => {
      expect(Object.keys(it)).toEqual(["code"]);
      const cells = it.code.split(",");
      expect(cells).toHaveLength(9);
      // The ninth cell is empty, and no answer is empty — so the served code
      // never carries the answer in the slot that asks for it. (A VISIBLE
      // cell may equal the answer — a carry rule does exactly that — which
      // is not a leak: the taker still has to know which cell it is.)
      expect(cells[8]).toBe(EMPTY_CELL);
      expect(cells[8]).not.toBe(OMIB_KEY[form[i].n]);
    });
  });
});

describe("picks and scoring", () => {
  const key = (seed: number) => omibForm(seed).map((i) => OMIB_KEY[i.n]);
  const blank = () => Array.from({ length: OMIB_FORM_ITEMS }, () => EMPTY_CELL);

  it("validates twenty-five 20-bit cells and nothing else", () => {
    expect(validOmibPicks(blank())).toBe(true);
    expect(validOmibPicks(key(3))).toBe(true);
    expect(validOmibPicks(blank().slice(1))).toBe(false);
    expect(validOmibPicks([...blank().slice(1), "0".repeat(19)])).toBe(false);
    expect(validOmibPicks([...blank().slice(1), "0".repeat(19) + "2"])).toBe(false);
    expect(validOmibPicks(Array(25).fill(0))).toBe(false);
    expect(validOmibPicks(null)).toBe(false);
  });

  it("scores an exact match right and anything else wrong — no partial credit", () => {
    const seed = 11;
    const perfect = scoreOmibPicks(seed, key(seed));
    expect(perfect.score).toBe(25);
    expect(perfect.marks.every(Boolean)).toBe(true);
    expect(perfect.attempted.every(Boolean)).toBe(true);
    expect(perfect.theta).toBeGreaterThan(1.5);
    expect(Number.isFinite(perfect.theta)).toBe(true);

    const none = scoreOmibPicks(seed, blank());
    expect(none.score).toBe(0);
    expect(none.attempted.every((a) => !a)).toBe(true);
    expect(none.theta).toBeLessThan(-1.5);

    // one bit off is wrong
    const k = key(seed);
    const flipped = k.map((c) => (c[0] === "0" ? "1" : "0") + c.slice(1));
    expect(scoreOmibPicks(seed, flipped).score).toBe(0);
  });

  it("solving the hard half beats solving the easy half at the same count", () => {
    const seed = 5;
    const k = key(seed);
    const easyHalf = k.map((c, i) => (i < 12 ? c : EMPTY_CELL));
    const hardHalf = k.map((c, i) => (i >= 13 ? c : EMPTY_CELL));
    const e = scoreOmibPicks(seed, easyHalf);
    const h = scoreOmibPicks(seed, hardHalf);
    expect(e.score).toBe(h.score);
    expect(h.theta).toBeGreaterThan(e.theta);
  });

  it("returns the item ids in form order, for the ledger", () => {
    expect(scoreOmibPicks(9, blank()).itemIds).toEqual(omibForm(9).map((i) => i.n));
  });
});

describe("the θ histogram", () => {
  it("bins 0.25 wide from −5, clamped at both ends", () => {
    expect(thetaBin(-5)).toBe(0);
    expect(thetaBin(-7)).toBe(0);
    expect(thetaBin(0)).toBe(20);
    expect(thetaBin(0.24)).toBe(20);
    expect(thetaBin(0.25)).toBe(21);
    expect(thetaBin(4.99)).toBe(THETA_BINS - 1);
    expect(thetaBin(5)).toBe(THETA_BINS - 1);
  });

  it("folds one reading into one bin and counts it", () => {
    const a = foldThetaNorms(null, 0.1);
    expect(a).toEqual({ n: 1, t20: 1 });
    const b = foldThetaNorms(a, -0.3);
    expect(b).toEqual({ n: 2, t20: 1, t18: 1 });
    expect(foldThetaNorms(b, 0.2).t20).toBe(2);
  });

  it("ranks by mid-rank, and only once the floor is met", () => {
    const norms = { n: 100, t18: 20, t19: 30, t20: 30, t21: 20 };
    expect(measuredPctileTheta(norms, 0.1, 100)).toEqual({ pctile: 65, n: 100 }); // (50 + 15)/100
    expect(measuredPctileTheta(norms, -0.2, 100)).toEqual({ pctile: 35, n: 100 }); // bin 19: (20 + 15)/100
    expect(measuredPctileTheta(norms, -0.3, 100)).toEqual({ pctile: 10, n: 100 }); // bin 18: (0 + 10)/100
    expect(measuredPctileTheta(norms, -4, 100)).toEqual({ pctile: 1, n: 100 }); // clamped
    expect(measuredPctileTheta(norms, 4, 100)).toEqual({ pctile: 99, n: 100 });
    expect(measuredPctileTheta({ n: 99, t20: 99 }, 0, 100)).toBeNull();
    expect(measuredPctileTheta(null, 0, 100)).toBeNull();
  });

  it("models Φ below the floor, clamped to 1..99", () => {
    expect(modelPctileTheta(0)).toBe(50);
    expect(modelPctileTheta(1)).toBe(84);
    expect(modelPctileTheta(-1)).toBe(16);
    expect(modelPctileTheta(4)).toBe(99);
    expect(modelPctileTheta(-4)).toBe(1);
  });
});

describe("the item ledger", () => {
  it("counts seen, solved and blank per item", () => {
    const s = foldItemStats(null, [3, 7], [true, false], [true, false]);
    expect(s).toEqual({ n: 1, i_3_seen: 1, i_3_solved: 1, i_7_seen: 1, i_7_blank: 1 });
    const t = foldItemStats(s, [3], [false], [true]);
    expect(t.i_3_seen).toBe(2);
    expect(t.i_3_solved).toBe(1);
    expect(t.n).toBe(2);
  });
});

describe("the era", () => {
  it("is the OMIB bank at 25 items, version 1 — and nothing without a bank is it", () => {
    expect(OMIB_ERA).toEqual({ bank: "omib", items: 25, gv: OMIB_BANK_VERSION });
    expect(isOmibEra({ ...OMIB_ERA, n: 5 })).toBe(true);
    expect(isOmibEra({ items: 25, gv: 4, n: 5 })).toBe(false); // the generator's era
    expect(isOmibEra({ bank: "omib", items: 25, gv: 2 })).toBe(false);
    expect(isOmibEra(null)).toBe(false);
  });
});

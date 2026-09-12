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
import {
  omibNextItem, replayAdaptive, scoreOmibAdaptive, scoreOmib, randomesqueK, validOmibCell, validOmibCells,
  OMIB_START_THETA, OMIB_RANDOMESQUE_MAX, OMIB_RANDOMESQUE_MIN, type OmibStep, type OmibItem,
} from "./omib";
import { eap, information, p2pl } from "./irt";
import { mulberry32 } from "./logic-gen";

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

// ── adaptive selection (D475, docs/OMIB-PLAN.md §3.3) ─────────────────────
describe("adaptive selection", () => {
  const params = (it: OmibItem) => ({ a: it.a as number, b: it.b as number });
  const ids = (items: readonly OmibItem[]) => items.map((i) => i.n);
  /** Walk a whole form under a policy, returning the picks it makes. */
  const walk = (seed: number, right: (it: OmibItem) => boolean): string[] => {
    const picks: string[] = [];
    const hist: OmibStep[] = [];
    for (let k = 0; k < OMIB_FORM_ITEMS; k++) {
      const it = omibNextItem(seed, hist);
      const r = right(it);
      picks.push(r ? OMIB_KEY[it.n] : EMPTY_CELL);
      hist.push({ n: it.n, right: r });
    }
    return picks;
  };
  const meanB = (items: readonly OmibItem[]) => items.reduce((s, i) => s + (i.b as number), 0) / items.length;

  it("serves 25 usable items with no repeat, in the same pyramid a stratified form has", () => {
    for (const seed of [1, 2, 3, 99]) {
      const { items, next } = replayAdaptive(seed, walk(seed, () => true));
      expect(items).toHaveLength(OMIB_FORM_ITEMS);
      expect(next).toBeNull();
      expect(new Set(ids(items)).size).toBe(OMIB_FORM_ITEMS);
      const by: Record<number, number> = {};
      for (const it of items) by[it.rules] = (by[it.rules] || 0) + 1;
      expect(by).toEqual(Object.fromEntries(OMIB_STRATA.map((s) => [s.rules, s.slots])));
      for (const it of items) expect(it.a as number).toBeGreaterThanOrEqual(OMIB_MIN_A);
    }
  });

  it("is deterministic in the seed and the picks, and the picks steer the path", () => {
    const up = walk(7, () => true);
    expect(ids(replayAdaptive(7, up).items)).toEqual(ids(replayAdaptive(7, up).items));
    const down = walk(7, () => false);
    // the first item is chosen before any answer, so it is the same on both paths
    expect(replayAdaptive(7, up).items[0].n).toBe(replayAdaptive(7, down).items[0].n);
    expect(ids(replayAdaptive(7, up).items)).not.toEqual(ids(replayAdaptive(7, down).items));
    expect(ids(replayAdaptive(8, up).items)).not.toEqual(ids(replayAdaptive(7, up).items));
  });

  it("climbs after right answers and descends after wrong ones — until the pyramid's quotas bind", () => {
    const up = replayAdaptive(7, walk(7, () => true)).items;
    const down = replayAdaptive(7, walk(7, () => false)).items;
    // The paths part after the shared opener and stay apart: over items
    // 2–10 the all-right path is served puzzles more than a unit harder.
    expect(meanB(up.slice(1, 10)) - meanB(down.slice(1, 10))).toBeGreaterThan(1.2);
    expect(meanB(up) - meanB(down)).toBeGreaterThan(0.9);
    expect(Math.max(...up.map((i) => i.b as number))).toBeGreaterThanOrEqual(1.4);
    expect(Math.min(...down.map((i) => i.b as number))).toBeLessThanOrEqual(-2);
    // The tail is the content balance's price, stated rather than hidden:
    // an all-wrong taker has spent the easy strata's slots by the middle of
    // the form, so its last items are the four- and five-rule ones the
    // pyramid still owes — served because every taker meets the same kind
    // of test, not because they are informative there. (An all-right
    // taker meets the mirror image, and also the bank's own ceiling: few
    // items sit above b = 1.5.)
    expect(down.slice(-7).every((i) => i.rules >= 4)).toBe(true);
  });

  it("draws each next item among the K most informative eligible ones — K wide at the start, five from step five", () => {
    expect(randomesqueK(0)).toBe(OMIB_RANDOMESQUE_MAX);
    expect(randomesqueK(2)).toBe(11);
    expect(randomesqueK(5)).toBe(OMIB_RANDOMESQUE_MIN);
    expect(randomesqueK(24)).toBe(OMIB_RANDOMESQUE_MIN);
    // Every taker's θ̂ is the same prior at step 0, so without the draw one
    // item would open every attempt. Over 200 seeds the opener takes at
    // least ten values, all from the fifteen most informative at the start.
    const firsts = new Set(Array.from({ length: 200 }, (_, s) => omibNextItem(s + 1, []).n));
    expect(firsts.size).toBeGreaterThanOrEqual(10);
    expect(firsts.size).toBeLessThanOrEqual(OMIB_RANDOMESQUE_MAX);
    const top = usableItems()
      .map((i) => ({ n: i.n, info: information([params(i)], OMIB_START_THETA) }))
      .sort((x, y) => y.info - x.info)
      .slice(0, OMIB_RANDOMESQUE_MAX)
      .map((x) => x.n);
    for (const n of firsts) expect(top).toContain(n);
    // and later, the pick is within the top five at the CURRENT θ̂ among what is still eligible
    const hist: OmibStep[] = [];
    for (let k = 0; k < 12; k++) {
      const it = omibNextItem(7, hist);
      hist.push({ n: it.n, right: k % 3 !== 0 });
    }
    const theta = eap(hist.map((h) => params(usableItems().find((i) => i.n === h.n) as OmibItem)), hist.map((h) => (h.right ? 1 : 0))).theta;
    const used = new Set(hist.map((h) => h.n));
    const quota: Record<number, number> = Object.fromEntries(OMIB_STRATA.map((s) => [s.rules, s.slots]));
    for (const h of hist) quota[(usableItems().find((i) => i.n === h.n) as OmibItem).rules]--;
    const eligible = usableItems().filter((i) => !used.has(i.n) && quota[i.rules] > 0)
      .map((i) => ({ n: i.n, info: information([params(i)], theta) }))
      .sort((x, y) => y.info - x.info)
      .slice(0, OMIB_RANDOMESQUE_MIN)
      .map((x) => x.n);
    expect(eligible).toContain(omibNextItem(7, hist).n);
  });

  it("scores the replayed form by the same θ arithmetic as a stratified one", () => {
    const picks = walk(7, (it) => (it.b as number) < 0);
    const s = scoreOmibAdaptive(7, picks);
    const { items, marks } = replayAdaptive(7, picks);
    expect(s.marks).toEqual(marks);
    expect(s.attempted).toEqual(picks.map((p) => p !== EMPTY_CELL));
    expect(s.itemIds).toEqual(ids(items));
    expect(s.diffs).toEqual(items.map((i) => i.b));
    expect({ theta: s.theta, se: s.se }).toEqual(eap(items.map(params), marks.map((m) => (m ? 1 : 0))));
    expect(scoreOmib("adaptive", 7, picks)).toEqual(s);
    expect(scoreOmib("stratified", 7, picks).itemIds).toEqual(ids(omibForm(7)));
  });

  it("refuses a form past its length, an unknown item in the history, and a short sheet", () => {
    expect(() => replayAdaptive(1, new Array(OMIB_FORM_ITEMS + 1).fill(EMPTY_CELL))).toThrow(/picks/);
    expect(() => omibNextItem(1, [{ n: 999999, right: true }])).toThrow(/usable/);
    expect(() => omibNextItem(1, walk(1, () => true).map((_, k) => ({ n: replayAdaptive(1, []).next?.n as number, right: k > 0 })))).toThrow();
    expect(() => scoreOmibAdaptive(1, new Array(OMIB_FORM_ITEMS - 1).fill(EMPTY_CELL))).toThrow(/24 picks/);
  });

  it("validates one cell, and any count of cells so far", () => {
    expect(validOmibCell(EMPTY_CELL)).toBe(true);
    expect(validOmibCell("0".repeat(19))).toBe(false);
    expect(validOmibCell("2".repeat(20))).toBe(false);
    expect(validOmibCells([], 0)).toBe(true);
    expect(validOmibCells([EMPTY_CELL], 1)).toBe(true);
    expect(validOmibCells([EMPTY_CELL], 2)).toBe(false);
    expect(validOmibCells([EMPTY_CELL, 5], 2)).toBe(false);
  });
});

// ── what adaptive selection buys (docs/OMIB-PLAN.md §2.4, D475) ───────────
// Simulated takers answer under the bank's own 2PL, each once on a
// stratified form and once adaptively, and the two estimates are compared
// against the ability that generated the answers. The seeded RNG makes
// the table below a fixed fact of the tree rather than a flaky one.
describe("what adaptive selection buys", () => {
  it("narrows the standard error at every ability and the error against the truth overall", { timeout: 60_000 }, () => {
    const params = (it: OmibItem) => ({ a: it.a as number, b: it.b as number });
    const levels = [-2, -1, 0, 1, 2];
    const takers = 60;
    const rows: string[] = [];
    let seAdaptiveAll = 0;
    let seStratAll = 0;
    let sqAdaptive = 0;
    let sqStrat = 0;
    let seed = 1000;
    for (const theta of levels) {
      let seA = 0;
      let seS = 0;
      let eA = 0;
      let eS = 0;
      for (let t = 0; t < takers; t++) {
        seed += 1;
        const rng = mulberry32(seed);
        const answer = (it: OmibItem) => rng() < p2pl(theta, it.a as number, it.b as number);
        // stratified: the seed's form, answered
        const form = omibForm(seed);
        const s = eap(form.map(params), form.map((it) => (answer(it) ? 1 : 0)));
        // adaptive: the same seed's path, answered as it is served
        const hist: OmibStep[] = [];
        const served: OmibItem[] = [];
        for (let k = 0; k < OMIB_FORM_ITEMS; k++) {
          const it = omibNextItem(seed, hist);
          served.push(it);
          hist.push({ n: it.n, right: answer(it) });
        }
        const a = eap(served.map(params), hist.map((h) => (h.right ? 1 : 0)));
        seS += s.se; seA += a.se;
        eS += (s.theta - theta) ** 2; eA += (a.theta - theta) ** 2;
      }
      rows.push(`θ=${String(theta).padStart(2)}  SE stratified ${(seS / takers).toFixed(3)}  adaptive ${(seA / takers).toFixed(3)}  ·  RMSE stratified ${Math.sqrt(eS / takers).toFixed(3)}  adaptive ${Math.sqrt(eA / takers).toFixed(3)}`);
      expect(seA / takers).toBeLessThan(seS / takers);
      seAdaptiveAll += seA; seStratAll += seS; sqAdaptive += eA; sqStrat += eS;
    }
    const n = levels.length * takers;
    rows.push(`all   SE stratified ${(seStratAll / n).toFixed(3)}  adaptive ${(seAdaptiveAll / n).toFixed(3)}  ·  RMSE stratified ${Math.sqrt(sqStrat / n).toFixed(3)}  adaptive ${Math.sqrt(sqAdaptive / n).toFixed(3)}`);
    console.log("adaptive vs stratified, 60 simulated takers per level:\n" + rows.join("\n"));
    expect(seAdaptiveAll / seStratAll).toBeLessThan(0.8);
    expect(Math.sqrt(sqAdaptive / n)).toBeLessThan(Math.sqrt(sqStrat / n));
  });
});

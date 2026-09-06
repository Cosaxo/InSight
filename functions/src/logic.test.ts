// Unit tests for the verified-logic pure layer (D57). Runs in plain node —
// the callables' Firestore glue stays thin; everything decidable is
// decided here, the pure.ts discipline.
import { describe, expect, it } from "vitest";
import {
  LOGIC_DEADLINE_MS,
  LOGIC_ITEMS,
  LOGIC_MAX_STARTS_PER_DAY,
  LOGIC_MIN_MS_PER_ITEM,
  LOGIC_NORMS_MIN_N,
  LOGIC_REVERIFY_DAYS,
  LOGIC_SEM_ITEMS,
  canStartLogic,
  clientItems,
  foldDifficultyStats,
  foldNorms,
  logicItemsFor,
  logicPctile,
  logicPctileFor,
  measuredPctile,
  rankAndFold,
  nextStartsToday,
  scoreLogicPicks,
  validLogicPicks,
  type LogicAttempt,
} from "./logic";
// One name, one meaning: the day-key helpers live in pure.ts now.
import { utcDayKeyOf } from "./pure";
import { generateForm, version as GEN_VERSION } from "./logic-gen";

const NOW = Date.UTC(2026, 7, 6, 12, 0, 0); // 2026-08-06T12:00Z
const DAY = 86_400_000;

const attempt = (over: Partial<LogicAttempt>): LogicAttempt => ({
  seed: 1,
  gv: GEN_VERSION,
  status: "open",
  startedAtMs: NOW - 1000,
  deadlineMs: NOW - 1000 + LOGIC_DEADLINE_MS,
  dayKey: utcDayKeyOf(NOW),
  startsToday: 1,
  ...over,
});

describe("the percentile curves match the client's, landmark for landmark", () => {
  it("12 items (D53): chance→4, half→30, midpoint→50, perfect→94, floor 1", () => {
    // The client copy (src/v2/data/logic-score.ts) pins these same values
    // in logic-score.test.ts — if either side moves alone, one suite fails.
    expect(logicPctile(2 / 12)).toBe(4);
    expect(logicPctile(6 / 12)).toBe(30);
    expect(logicPctile(0.62)).toBe(50);
    expect(logicPctile(1)).toBe(94);
    expect(logicPctile(0)).toBe(1);
  });

  it("25 items (D61): chance→4, half→42, midpoint→50, 20/25→90, perfect→98, floor 1", () => {
    expect(logicPctileFor(1 / 6, 25)).toBe(4); // chance with six options
    expect(logicPctileFor(0.5, 25)).toBe(42);
    expect(logicPctileFor(0.54, 25)).toBe(50);
    expect(logicPctileFor(20 / 25, 25)).toBe(90);
    expect(logicPctileFor(1, 25)).toBe(98); // the harder tail earns more model ceiling than D53's 94
    expect(logicPctileFor(0, 25)).toBe(1);
  });
});

describe("canStartLogic", () => {
  it("no prior attempt → start", () => {
    expect(canStartLogic(null, NOW)).toEqual({ ok: true });
  });

  it("an open attempt can be restarted (crash recovery) — it just costs a start", () => {
    expect(canStartLogic(attempt({ startsToday: 1 }), NOW).ok).toBe(true);
    expect(nextStartsToday(attempt({ startsToday: 1 }), NOW)).toBe(2);
  });

  it("keeps the start cap at the value whose reasoning is written down", () => {
    // The case below proves the cap BINDS — but it states the bound
    // relative to the constant, so it moves with it. Measured: this can be
    // set to a million with all 593 functions tests green, and no check
    // gate names it.
    //
    // logic.ts: "Starting an attempt previews a fresh form, so unfinished
    // restarts are a preview channel — bounded per UTC day rather than
    // closed, because a crashed app must be able to start again." That
    // preview channel is the surface the unscored answer key is one of
    // D98's three denies for, so the bound is what keeps a preview from
    // becoming a way to read the key by repetition.
    expect(LOGIC_MAX_STARTS_PER_DAY,
      "the per-day start cap moved — re-read logic.ts's reasoning and change this line deliberately").toBe(3);
    // …and it is a bound, not a closure: a crashed app must be able to
    // start again, which is the other half of the same sentence.
    expect(LOGIC_MAX_STARTS_PER_DAY,
      "the preview channel is closed, not bounded — a crashed app cannot start again").toBeGreaterThan(1);
  });

  it("the per-day start cap holds, and resets on the next UTC day", () => {
    const capped = attempt({ startsToday: LOGIC_MAX_STARTS_PER_DAY });
    const refused = canStartLogic(capped, NOW);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.code).toBe("rate-limited");
    // same doc, next day: the counter is stale, so it resets
    expect(canStartLogic(capped, NOW + DAY).ok).toBe(true);
    expect(nextStartsToday(capped, NOW + DAY)).toBe(1);
  });

  it("a recent verified score opens the cooldown; an old one does not", () => {
    const scored = attempt({ status: "scored", scoredAtMs: NOW - DAY, startsToday: 1 });
    const refused = canStartLogic(scored, NOW);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.code).toBe("cooldown");
    const old = attempt({
      status: "scored",
      scoredAtMs: NOW - (LOGIC_REVERIFY_DAYS + 1) * DAY,
      startsToday: 1,
      dayKey: utcDayKeyOf(NOW - (LOGIC_REVERIFY_DAYS + 1) * DAY),
    });
    expect(canStartLogic(old, NOW).ok).toBe(true);
  });
});

describe("validLogicPicks", () => {
  it("accepts LOGIC_ITEMS integers in -1..5 (-1 = expired), refuses everything else", () => {
    expect(validLogicPicks(Array.from({ length: 25 }, () => 0))).toBe(true);
    expect(validLogicPicks([...Array.from({ length: 24 }, () => 5), -1])).toBe(true);
    expect(validLogicPicks(Array.from({ length: 24 }, () => 0))).toBe(false);
    expect(validLogicPicks(Array.from({ length: 12 }, () => 0))).toBe(false); // the old era's length
    expect(validLogicPicks(Array.from({ length: 25 }, () => 6))).toBe(false);
    expect(validLogicPicks(Array.from({ length: 25 }, () => -2))).toBe(false);
    expect(validLogicPicks(Array.from({ length: 25 }, () => 1.5))).toBe(false);
    expect(validLogicPicks(Array.from({ length: 25 }, () => "1"))).toBe(false);
    expect(validLogicPicks(null)).toBe(false);
    expect(validLogicPicks({})).toBe(false);
  });

  it("validates against an attempt's own era: a gv2 attempt takes 12 picks (D61)", () => {
    expect(logicItemsFor(2)).toBe(12);
    expect(logicItemsFor(3)).toBe(25);
    expect(validLogicPicks(Array.from({ length: 12 }, () => 0), logicItemsFor(2))).toBe(true);
    expect(validLogicPicks(Array.from({ length: 25 }, () => 0), logicItemsFor(2))).toBe(false);
  });
});

describe("scoreLogicPicks", () => {
  it("all correct answers → a perfect score; each mark follows its pick", () => {
    const seed = 987654;
    const form = generateForm(seed);
    const right = form.items.map((it) => it.a);
    expect(scoreLogicPicks(seed, GEN_VERSION, right)).toEqual({
      marks: Array.from({ length: LOGIC_ITEMS }, () => true),
      score: LOGIC_ITEMS,
      families: generateForm(seed).items.map((it) => it.rules[0]),
    });
    const oneWrong = [...right];
    oneWrong[3] = (right[3] + 1) % 6;
    const scored = scoreLogicPicks(seed, GEN_VERSION, oneWrong);
    expect(scored.score).toBe(LOGIC_ITEMS - 1);
    expect(scored.marks[3]).toBe(false);
  });

  it("-1 (expired) never matches an answer", () => {
    const scored = scoreLogicPicks(42, GEN_VERSION, Array.from({ length: LOGIC_ITEMS }, () => -1));
    expect(scored.score).toBe(0);
  });
});

describe("clientItems — what the wire carries", () => {
  it("cells, opts and diff only: no answer index, no family names, no seed", () => {
    const items = clientItems(31337, GEN_VERSION);
    expect(items).toHaveLength(LOGIC_ITEMS);
    for (const it of items) {
      expect(Object.keys(it).sort()).toEqual(["cells", "diff", "opts"]);
      expect(it.cells).toHaveLength(8);
      expect(it.opts).toHaveLength(6);
    }
  });

  it("the withheld answer is still among the options (sanity)", () => {
    const seed = 31337;
    const form = generateForm(seed);
    const items = clientItems(seed, GEN_VERSION);
    form.items.forEach((it, i) => {
      expect(JSON.stringify(items[i].opts[it.a])).toBe(JSON.stringify(it.opts[it.a]));
    });
  });
});

describe("foldDifficultyStats (D62)", () => {
  it("counts family exposure and solves, and per-slot solves, from nothing", () => {
    const stats = foldDifficultyStats(null, ["sizeRamp", "dist2Xor"], [true, false]);
    expect(stats).toEqual({ n: 1, f_sizeRamp_seen: 1, f_sizeRamp_solved: 1, s_0_solved: 1, f_dist2Xor_seen: 1 });
  });

  it("accumulates over priors without touching untouched counters", () => {
    const prev = { n: 3, f_sizeRamp_seen: 3, f_sizeRamp_solved: 2, s_0_solved: 2, f_ringLatin_seen: 1 };
    const stats = foldDifficultyStats(prev, ["sizeRamp", "ringLatin"], [false, true]);
    expect(stats).toEqual({
      n: 4,
      f_sizeRamp_seen: 4, f_sizeRamp_solved: 2, s_0_solved: 2,
      f_ringLatin_seen: 2, f_ringLatin_solved: 1, s_1_solved: 1,
    });
  });

  it("a full form folds one seen per family and n slot-solve counters at most", () => {
    const { marks, families } = scoreLogicPicks(31337, GEN_VERSION, generateForm(31337).items.map((it) => it.a));
    const stats = foldDifficultyStats(null, families, marks);
    expect(stats.n).toBe(1);
    // 25 distinct families per form (the no-repeat rule), each seen once
    expect(Object.keys(stats).filter((k) => k.endsWith("_seen"))).toHaveLength(25);
    for (const fam of families) expect(stats[`f_${fam}_seen`]).toBe(1);
    // a perfect run solves every slot
    expect(Object.keys(stats).filter((k) => k.startsWith("s_"))).toHaveLength(25);
  });
});

describe("foldNorms", () => {
  it("counts n and the score bucket, from nothing and from priors", () => {
    expect(foldNorms(null, 7)).toEqual({ n: 1, b7: 1 });
    expect(foldNorms({ n: 4, b7: 2, b12: 1, b0: 1 }, 12)).toEqual({ n: 5, b7: 2, b12: 2, b0: 1 });
  });
});

describe("measuredPctile (D60)", () => {
  it("stays null below the floor — the model keeps the job", () => {
    expect(measuredPctile(null, 8)).toBeNull();
    expect(measuredPctile({ n: LOGIC_NORMS_MIN_N - 1, b0: LOGIC_NORMS_MIN_N - 1 }, 12)).toBeNull();
    // …and the floor itself, which this line cannot pin because it builds
    // its fixture from the constant. Measured: 100 -> 2 leaves all 617
    // functions tests green. Above this floor the app publishes
    // `source: "measured"` with an `n`, and the client says "sharper than
    // X% of N verified players" — at 2 that sentence is published from two
    // people. The constant's own docblock says "one constant; lowering it
    // is a recorded decision, not a tweak", which is the standard the
    // start-cap case in this same file already applies literally.
    expect(LOGIC_NORMS_MIN_N,
      "the norms floor moved — lowering it is a recorded decision, not a tweak").toBe(100);
  });

  it("at the floor: strictly-below share, ties not beaten", () => {
    const h = { n: 100, b5: 40, b7: 30, b9: 20, b12: 10 };
    expect(measuredPctile(h, 7)).toEqual({ pctile: 40, n: 100 }); // beats the fives, not the other sevens
    expect(measuredPctile(h, 8)).toEqual({ pctile: 70, n: 100 });
    // the measured ceiling is the data's, not the model's 94 (D53's cap
    // existed because a curve cannot rank perfect scores — a count can)
    expect(measuredPctile(h, 12)).toEqual({ pctile: 90, n: 100 });
    // clamp at the bottom: beats nobody, still never reads "top 100%"
    expect(measuredPctile(h, 0)).toEqual({ pctile: 1, n: 100 });
  });

  it("a perfect score among many perfects reads honestly low", () => {
    expect(measuredPctile({ n: 200, b12: 150, b11: 50 }, 12)).toEqual({ pctile: 25, n: 200 });
  });

  it("clamps the top: beating 995 of 1000 rounds to 99, never 100", () => {
    expect(measuredPctile({ n: 1000, b3: 995, b11: 5 }, 12)).toEqual({ pctile: 99, n: 1000 });
  });
});

describe("administration arithmetic", () => {
  it("the deadline covers 25 capped items plus one item of slack", () => {
    expect(LOGIC_DEADLINE_MS).toBe(26 * 90_000);
  });
});

// ── how a submitted score is ranked, and whether it counts ──────────────
//
// The four decisions behind every "sharper than X% of N verified players"
// sentence. They lived inside the callable, which only the emulator
// reaches and which the e2e drives by starting an attempt and submitting
// at once — so all four mutated GREEN across the functions suite and all
// three e2e suites.
describe("rankAndFold", () => {
  // A histogram of `n` players all scoring 10, stamped with an era: a form
  // length and (since D402) a generator version.
  const hist = (items: number, n: number, gv: number = GEN_VERSION) =>
    ({ items, gv, n, b10: n } as never);
  // A whole sitting's worth of effort — every case below is about ranking
  // or eras unless it says otherwise, so none may trip the effort floor.
  const SLOW = 20 * 60_000;
  const cur = { items: LOGIC_ITEMS, gv: GEN_VERSION, durationMs: SLOW };

  it("refuses a histogram from another form-length era, and starts the count fresh", () => {
    // A score out of 25 has no meaning against a distribution of scores
    // out of 12. Widening this makes the app rank a 25-item score against
    // a 12-item population and publish the result as measured.
    const out = rankAndFold({ ...cur, score: 20, stored: hist(12, 900), alreadyCounted: false });
    expect(out.source, "a foreign-era histogram was used to rank").toBe("model");
    expect(out.norms, "the fold must start fresh, not extend the old era").not.toBeNull();
    expect(out.norms!.items).toBe(LOGIC_ITEMS);
    expect(out.norms!.gv).toBe(GEN_VERSION);
    expect(out.norms!.n).toBe(1);
  });

  it("refuses a histogram from another GENERATOR era of the same length, and starts fresh (D402)", () => {
    // v3 and v4 forms are both 25 items, and a v4 score was earned on a
    // wider vocabulary than a v3 one — so a v3 population may no more rank
    // a v4 score than a 12-item one may. Same length, different era.
    const out = rankAndFold({ ...cur, score: 20, stored: hist(LOGIC_ITEMS, 900, GEN_VERSION - 1), alreadyCounted: false });
    expect(out.source, "a previous generator's histogram was used to rank").toBe("model");
    expect(out.norms!.n, "the fold must start fresh, not extend the old era").toBe(1);
    expect(out.norms!.gv).toBe(GEN_VERSION);
  });

  it("scores an attempt opened under the previous generator against its own form, and folds it nowhere", () => {
    // Opened just before a deploy, submitted just after: the deadline
    // bounds the window to minutes, and a refusal would swallow an honest
    // finisher — but its score belongs to no current population.
    const out = rankAndFold({ ...cur, gv: GEN_VERSION - 1, score: 20, stored: hist(LOGIC_ITEMS, 900), alreadyCounted: false });
    expect(out.source).toBe("model");
    expect(out.pctile).toBe(logicPctileFor(20 / LOGIC_ITEMS, LOGIC_ITEMS));
    expect(out.countsNorms, "a retired era's score was folded into the live histogram").toBe(false);
    expect(out.norms).toBeNull();
  });

  it("ranks against a same-era histogram, and says the reading is measured", () => {
    // THE CONTROL. Without it, refusing every histogram passes the case
    // above and the app never publishes a measured percentile at all.
    const out = rankAndFold({ ...cur, score: 20, stored: hist(LOGIC_ITEMS, 900), alreadyCounted: false });
    expect(out.source).toBe("measured");
    expect(out.norms!.n).toBe(901);
  });

  it("scores a form against ITS OWN length when there is no measured population", () => {
    // The model curve is length-aware (logic-score's 12- and 25-item
    // curves). Pinning it to 12 for a 25-item form scores a player on the
    // wrong distribution, silently — the D53 curve against the D61 form.
    const short = rankAndFold({ ...cur, items: 12, gv: 2, score: 6, stored: null, alreadyCounted: false });
    const long = rankAndFold({ ...cur, score: 12.5, stored: null, alreadyCounted: false });
    // Same fraction of the form, different curve, so different percentiles.
    expect(short.source).toBe("model");
    expect(long.source).toBe("model");
    expect(short.pctile).not.toBe(long.pctile);
  });

  it("does not fold a form from a retired era into the current histogram", () => {
    const out = rankAndFold({ ...cur, items: 12, gv: 2, score: 6, stored: hist(LOGIC_ITEMS, 900), alreadyCounted: false });
    expect(out.countsNorms, "a 12-item score was folded into the 25-item population").toBe(false);
    expect(out.norms).toBeNull();
  });

  it("carries the measured population's size beside the reading", () => {
    // The published sentence is "sharper than X% of N verified players",
    // so the N travels with the X — and the caller writes it onto the
    // result only when there IS a measured population. A model reading
    // rests on nobody and must carry no N at all.
    const measured = rankAndFold({ ...cur, score: 20, stored: hist(LOGIC_ITEMS, 900), alreadyCounted: false });
    expect(measured.n).toBe(900);
    const model = rankAndFold({ ...cur, score: 20, stored: null, alreadyCounted: false });
    expect(model.source).toBe("model");
    expect(model.n, "a model reading claimed a population").toBeNull();
  });

  it("measures a re-verification and never counts it — D32's rule", () => {
    // The population every published claim is measured against. Without
    // this gate an account can push it toward itself by taking the test
    // again, and the gate is carried on the attempt by logicStartV2.
    const again = rankAndFold({ ...cur, score: 20, stored: hist(LOGIC_ITEMS, 900), alreadyCounted: true });
    expect(again.source, "a re-verification stopped being measured").toBe("measured");
    expect(again.countsNorms).toBe(false);
    expect(again.norms).toBeNull();
    // …and a first attempt on the same data does count, or the case above
    // proves only that nothing ever folds.
    const first = rankAndFold({ ...cur, score: 20, stored: hist(LOGIC_ITEMS, 900), alreadyCounted: false });
    expect(first.countsNorms).toBe(true);
  });

  it("measures a click-through and never counts it — the effort floor (D402)", () => {
    // Twenty-five matrices in under two seconds each is nobody solving
    // anything. The score is still scored (it is the account's, and the
    // cooldown still applies), but a phantom low scorer must not lift
    // every later percentile.
    const rushed = rankAndFold({ ...cur, durationMs: LOGIC_ITEMS * LOGIC_MIN_MS_PER_ITEM - 1, score: 3, stored: hist(LOGIC_ITEMS, 900), alreadyCounted: false });
    expect(rushed.source, "a rushed attempt stopped being ranked").toBe("measured");
    expect(rushed.countsNorms, "a click-through was folded into the norms").toBe(false);
    expect(rushed.norms).toBeNull();
    // the floor is a floor: exactly at it counts
    const atFloor = rankAndFold({ ...cur, durationMs: LOGIC_ITEMS * LOGIC_MIN_MS_PER_ITEM, score: 3, stored: hist(LOGIC_ITEMS, 900), alreadyCounted: false });
    expect(atFloor.countsNorms).toBe(true);
    // …and the constant is the one whose reasoning is written down
    expect(LOGIC_MIN_MS_PER_ITEM, "the effort floor moved — re-read logic.ts's reasoning first").toBe(2_000);
  });

  it("carries the likely range, read the same way as the number (D402)", () => {
    // Modelled: the curve at score ± SEM items, clamped to the form.
    const model = rankAndFold({ ...cur, score: 13, stored: null, alreadyCounted: false });
    expect(model.band).toEqual([
      logicPctileFor((13 - LOGIC_SEM_ITEMS) / LOGIC_ITEMS, LOGIC_ITEMS),
      logicPctileFor((13 + LOGIC_SEM_ITEMS) / LOGIC_ITEMS, LOGIC_ITEMS),
    ]);
    expect(model.band[0]).toBeLessThan(model.pctile);
    expect(model.band[1]).toBeGreaterThan(model.pctile);
    // at the ceiling the top of the range is the ceiling itself
    const top = rankAndFold({ ...cur, score: LOGIC_ITEMS, stored: null, alreadyCounted: false });
    expect(top.band[1]).toBe(top.pctile);
    expect(top.band[0]).toBe(logicPctileFor((LOGIC_ITEMS - LOGIC_SEM_ITEMS) / LOGIC_ITEMS, LOGIC_ITEMS));
    // Measured: the count at score ± SEM — never the curve, so the range
    // and the number rest on the same population.
    const stored = { items: LOGIC_ITEMS, gv: GEN_VERSION, n: 200, b8: 50, b10: 50, b12: 50, b14: 50 } as never;
    const measured = rankAndFold({ ...cur, score: 11, stored, alreadyCounted: false });
    expect(measured.source).toBe("measured");
    expect(measured.pctile).toBe(50); // beats the 8s and 10s
    expect(measured.band).toEqual([25, 75]); // 9 beats the 8s; 13 beats 8s, 10s and 12s
    expect(LOGIC_SEM_ITEMS, "the range's width moved — the client pins the same constant").toBe(2);
  });
});

// Unit tests for the verified-logic pure layer (D57). Runs in plain node —
// the callables' Firestore glue stays thin; everything decidable is
// decided here, the pure.ts discipline.
import { describe, expect, it } from "vitest";
import {
  LOGIC_DEADLINE_MS,
  LOGIC_ITEMS,
  LOGIC_MAX_STARTS_PER_DAY,
  LOGIC_NORMS_MIN_N,
  LOGIC_REVERIFY_DAYS,
  canStartLogic,
  clientItems,
  foldNorms,
  logicItemsFor,
  logicPctile,
  logicPctileFor,
  measuredPctile,
  nextStartsToday,
  scoreLogicPicks,
  utcDayKey,
  validLogicPicks,
  type LogicAttempt,
} from "./logic";
import { generateForm, version as GEN_VERSION } from "./logic-gen";

const NOW = Date.UTC(2026, 7, 6, 12, 0, 0); // 2026-08-06T12:00Z
const DAY = 86_400_000;

const attempt = (over: Partial<LogicAttempt>): LogicAttempt => ({
  seed: 1,
  gv: GEN_VERSION,
  status: "open",
  startedAtMs: NOW - 1000,
  deadlineMs: NOW - 1000 + LOGIC_DEADLINE_MS,
  dayKey: utcDayKey(NOW),
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

  it("25 items (D59): chance→4, half→42, midpoint→50, 20/25→90, perfect→98, floor 1", () => {
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
      dayKey: utcDayKey(NOW - (LOGIC_REVERIFY_DAYS + 1) * DAY),
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

  it("validates against an attempt's own era: a gv2 attempt takes 12 picks (D59)", () => {
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

describe("foldNorms", () => {
  it("counts n and the score bucket, from nothing and from priors", () => {
    expect(foldNorms(null, 7)).toEqual({ n: 1, b7: 1 });
    expect(foldNorms({ n: 4, b7: 2, b12: 1, b0: 1 }, 12)).toEqual({ n: 5, b7: 2, b12: 2, b0: 1 });
  });
});

describe("measuredPctile (D58)", () => {
  it("stays null below the floor — the model keeps the job", () => {
    expect(measuredPctile(null, 8)).toBeNull();
    expect(measuredPctile({ n: LOGIC_NORMS_MIN_N - 1, b0: LOGIC_NORMS_MIN_N - 1 }, 12)).toBeNull();
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

// budget.test.ts — the budget's notification flips the read breaker at the
// line, releases only what it set and only in a new month, and leaves a
// hand-set level alone (COST-EXPOSURE.md §6 C4).
import { describe, expect, it } from "vitest";
import {
  BUDGET_ACT_AT, BUDGET_MODE_BY, applyBudgetMessage, budgetDecision, parseBudgetMessage,
  type BudgetMessage, type BudgetModeState, type BudgetModeStore,
} from "./budget";

const quiet = { info: () => {}, warn: () => {} };
const msg = (over: Partial<BudgetMessage> = {}): BudgetMessage => ({
  budgetDisplayName: "InSight", costAmount: 120, budgetAmount: 500, currencyCode: "NOK",
  costIntervalStart: "2026-09-01T00:00:00Z", alertThresholdExceeded: null, ...over,
});
const idle: BudgetModeState = { level: 0, by: null, interval: null };

describe("parseBudgetMessage", () => {
  it("reads the fields a Cloud Billing notification carries and refuses anything else", () => {
    const m = parseBudgetMessage({
      budgetDisplayName: "InSight", costAmount: 520.5, budgetAmount: 500, currencyCode: "NOK",
      costIntervalStart: "2026-09-01T07:00:00Z", alertThresholdExceeded: 1.0, budgetAmountType: "SPECIFIED_AMOUNT",
    });
    expect(m).toEqual({
      budgetDisplayName: "InSight", costAmount: 520.5, budgetAmount: 500, currencyCode: "NOK",
      costIntervalStart: "2026-09-01T07:00:00Z", alertThresholdExceeded: 1.0,
    });
    expect(parseBudgetMessage({ costAmount: 1 }), "no budget amount").toBeNull();
    expect(parseBudgetMessage({ costAmount: "1", budgetAmount: 500 }), "a stringy number is not a number").toBeNull();
    expect(parseBudgetMessage("hello")).toBeNull();
    expect(parseBudgetMessage(null)).toBeNull();
    expect(parseBudgetMessage([1, 2])).toBeNull();
  });
});

describe("budgetDecision", () => {
  it("pauses at the line, whether by ratio or by the threshold rule, and once only", () => {
    expect(budgetDecision(msg({ costAmount: 499.99 }), idle).action).toBe("none");
    expect(budgetDecision(msg({ costAmount: 500 }), idle).action).toBe("paused");
    expect(budgetDecision(msg({ costAmount: 900 }), idle).action).toBe("paused");
    // The rule can cross a beat before the ratio does (rounding on Google's
    // side); either is the line.
    expect(budgetDecision(msg({ costAmount: 499, alertThresholdExceeded: 1.0 }), idle).action).toBe("paused");
    expect(budgetDecision(msg({ costAmount: 900 }), { level: 1, by: BUDGET_MODE_BY, interval: "2026-09-01T00:00:00Z" }).action).toBe("none");
    expect(BUDGET_ACT_AT).toBe(1.0);
  });

  it("carries a reason a person can read", () => {
    const { reason } = budgetDecision(msg({ costAmount: 510 }), idle);
    expect(reason).toBe('budget "InSight": 510 of 500 NOK (102%), the interval from 2026-09-01T00:00:00Z');
  });

  it("releases only its own level, and only when the month has moved on", () => {
    const mine = { level: 1, by: BUDGET_MODE_BY, interval: "2026-09-01T00:00:00Z" };
    // Same month, spend under the line (it never is, but the rule must not
    // depend on that): nothing moves.
    expect(budgetDecision(msg({ costAmount: 10 }), mine).action).toBe("none");
    // A new month under the line releases.
    expect(budgetDecision(msg({ costAmount: 10, costIntervalStart: "2026-10-01T00:00:00Z" }), mine).action).toBe("released");
    // A new month already over the line stays paused.
    expect(budgetDecision(msg({ costAmount: 800, costIntervalStart: "2026-10-01T00:00:00Z" }), mine).action).toBe("none");
    // A level the operator set by hand is theirs to release.
    expect(budgetDecision(msg({ costAmount: 10, costIntervalStart: "2026-10-01T00:00:00Z" }), { level: 1, by: null, interval: null }).action).toBe("none");
    expect(budgetDecision(msg({ costAmount: 10, costIntervalStart: "2026-10-01T00:00:00Z" }), { level: 1, by: "budget-mode.mjs", interval: null }).action).toBe("none");
    // A message with no interval cannot prove a new month.
    expect(budgetDecision(msg({ costAmount: 10, costIntervalStart: null }), mine).action).toBe("none");
  });

  it("a zero budget never pauses on the ratio alone", () => {
    expect(budgetDecision(msg({ costAmount: 5, budgetAmount: 0 }), idle).action).toBe("none");
  });
});

describe("applyBudgetMessage", () => {
  function fakeStore(state: BudgetModeState) {
    const writes: Array<["pause", string, string | null] | ["release"]> = [];
    let reads = 0;
    const store: BudgetModeStore = {
      async read() { reads += 1; return state; },
      async pause(reason, interval) { writes.push(["pause", reason, interval]); },
      async release() { writes.push(["release"]); },
    };
    return { store, writes, reads: () => reads };
  }

  it("writes the level, the reason and the interval on a pause, and nothing when nothing moves", async () => {
    const { store, writes, reads } = fakeStore(idle);
    expect(await applyBudgetMessage(store, msg({ costAmount: 120 }), quiet)).toBe("none");
    expect(writes).toEqual([]);
    expect(await applyBudgetMessage(store, msg({ costAmount: 640 }), quiet)).toBe("paused");
    expect(writes).toEqual([["pause", 'budget "InSight": 640 of 500 NOK (128%), the interval from 2026-09-01T00:00:00Z', "2026-09-01T00:00:00Z"]]);
    expect(reads()).toBe(2);
  });

  it("releases its own level in a new month", async () => {
    const { store, writes } = fakeStore({ level: 1, by: BUDGET_MODE_BY, interval: "2026-09-01T00:00:00Z" });
    expect(await applyBudgetMessage(store, msg({ costAmount: 3, costIntervalStart: "2026-10-01T00:00:00Z" }), quiet)).toBe("released");
    expect(writes).toEqual([["release"]]);
  });
});

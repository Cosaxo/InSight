// budget.test.ts — the budget's notification flips the read breaker at the
// line, releases only what it set and only in a new month, and leaves a
// hand-set level alone (COST-EXPOSURE.md §6 C4) — and detaches billing at
// the second line, once per re-attach, with the latch written first and
// cleared on a refusal (D471).
import { describe, expect, it } from "vitest";
import {
  BUDGET_ACT_AT, BUDGET_DETACH_AT, BUDGET_MODE_BY, applyBudgetMessage, budgetDecision, detachLine,
  inertBillingPort, parseBudgetMessage,
  type BillingPort, type BudgetMessage, type BudgetModeState, type BudgetModeStore,
} from "./budget";

const quiet = { info: () => {}, warn: () => {}, error: () => {} };
const msg = (over: Partial<BudgetMessage> = {}): BudgetMessage => ({
  budgetDisplayName: "InSight", costAmount: 120, budgetAmount: 500, currencyCode: "NOK",
  costIntervalStart: "2026-09-01T00:00:00Z", alertThresholdExceeded: null, ...over,
});
const st = (over: Partial<BudgetModeState> = {}): BudgetModeState => ({
  level: 0, by: null, interval: null, detachedRatio: null, detachedInterval: null, ...over,
});
const idle = st();
const SEP = "2026-09-01T00:00:00Z";
const OCT = "2026-10-01T00:00:00Z";

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
    expect(budgetDecision(msg({ costAmount: 900 }), st({ level: 1, by: BUDGET_MODE_BY, interval: SEP })).action).toBe("none");
    expect(BUDGET_ACT_AT).toBe(1.0);
  });

  it("carries a reason a person can read", () => {
    const { reason } = budgetDecision(msg({ costAmount: 510 }), idle);
    expect(reason).toBe('budget "InSight": 510 of 500 NOK (102%), the interval from 2026-09-01T00:00:00Z');
  });

  it("releases only its own level, and only when the month has moved on", () => {
    const mine = st({ level: 1, by: BUDGET_MODE_BY, interval: SEP });
    // Same month, spend under the line (it never is, but the rule must not
    // depend on that): nothing moves.
    expect(budgetDecision(msg({ costAmount: 10 }), mine).action).toBe("none");
    // A new month under the line releases.
    expect(budgetDecision(msg({ costAmount: 10, costIntervalStart: OCT }), mine).action).toBe("released");
    // A new month already over the line stays paused.
    expect(budgetDecision(msg({ costAmount: 800, costIntervalStart: OCT }), mine).action).toBe("none");
    // A level the operator set by hand is theirs to release.
    expect(budgetDecision(msg({ costAmount: 10, costIntervalStart: OCT }), st({ level: 1 })).action).toBe("none");
    expect(budgetDecision(msg({ costAmount: 10, costIntervalStart: OCT }), st({ level: 1, by: "budget-mode.mjs" })).action).toBe("none");
    // A message with no interval cannot prove a new month.
    expect(budgetDecision(msg({ costAmount: 10, costIntervalStart: null }), mine).action).toBe("none");
  });

  it("a zero budget never pauses on the ratio alone — nor detaches", () => {
    expect(budgetDecision(msg({ costAmount: 5, budgetAmount: 0 }), idle).action).toBe("none");
    expect(budgetDecision(msg({ costAmount: 5000, budgetAmount: 0 }), idle).action).toBe("none");
  });

  it("detaches at three budgets — 1,500 on 500 — whatever the breaker's state, and never below", () => {
    // The owner's figure (2026-09-12): 1,500 NOK on the 500 NOK budget.
    expect(BUDGET_DETACH_AT).toBe(3.0);
    expect(BUDGET_DETACH_AT * 500).toBe(1500);
    expect(budgetDecision(msg({ costAmount: 1499.99 }), idle).action).toBe("paused");
    expect(budgetDecision(msg({ costAmount: 1499.99 }), st({ level: 1, by: BUDGET_MODE_BY, interval: SEP })).action).toBe("none");
    expect(budgetDecision(msg({ costAmount: 1500 }), idle).action).toBe("detached");
    expect(budgetDecision(msg({ costAmount: 1500 }), st({ level: 1, by: BUDGET_MODE_BY, interval: SEP })).action).toBe("detached");
    // A hand-set breaker is no shelter from the ceiling.
    expect(budgetDecision(msg({ costAmount: 4000 }), st({ level: 1, by: "budget-mode.mjs" })).action).toBe("detached");
    // The threshold rule alone never detaches: the ratio is the line. (A
    // budget carries no 300 % rule until apply-budget adds one, and a rule
    // is the mail's instrument, not this function's.)
    expect(budgetDecision(msg({ costAmount: 1200, alertThresholdExceeded: 3.0 }), idle).action).toBe("paused");
  });

  it("the ratchet: a latched detach moves the line one multiple past where it fired, for that month only", () => {
    const latched = st({ level: 1, by: BUDGET_MODE_BY, interval: SEP, detachedRatio: 3.02, detachedInterval: SEP });
    expect(detachLine(msg(), latched)).toBeCloseTo(6.02, 10);
    // Under the new line, the month is only "over" — the app stays up
    // after the owner's re-attach.
    expect(budgetDecision(msg({ costAmount: 2990 }), latched).action).toBe("none");
    // At it, the next 1,500 has been burned: down again.
    expect(budgetDecision(msg({ costAmount: 3010 }), latched).action).toBe("detached");
    // A message that cannot name its month keeps the latch — the reading
    // that keeps the app up.
    expect(detachLine(msg({ costIntervalStart: null }), latched)).toBeCloseTo(6.02, 10);
    expect(budgetDecision(msg({ costAmount: 1600, costIntervalStart: null }), latched).action).toBe("none");
    // A new month starts the count over: the line is three budgets again.
    expect(detachLine(msg({ costIntervalStart: OCT }), latched)).toBe(BUDGET_DETACH_AT);
    expect(budgetDecision(msg({ costAmount: 1500, costIntervalStart: OCT }), latched).action).toBe("detached");
    expect(budgetDecision(msg({ costAmount: 10, costIntervalStart: OCT }), latched).action).toBe("released");
  });
});

describe("applyBudgetMessage", () => {
  type Write =
    | ["pause", string, string | null]
    | ["release"]
    | ["detach", string, string | null, number, boolean]
    | ["forget"];
  function fakeStore(state: BudgetModeState, opts: { detachThrows?: boolean; forgetThrows?: boolean } = {}) {
    const writes: Write[] = [];
    let reads = 0;
    const store: BudgetModeStore = {
      async read() { reads += 1; return state; },
      async pause(reason, interval) { writes.push(["pause", reason, interval]); },
      async release() { writes.push(["release"]); },
      async recordDetach(reason, interval, ratio, setBreaker) {
        if (opts.detachThrows) throw new Error("firestore unavailable");
        writes.push(["detach", reason, interval, ratio, setBreaker]);
      },
      async forgetDetach() {
        if (opts.forgetThrows) throw new Error("firestore unavailable");
        writes.push(["forget"]);
      },
    };
    return { store, writes, reads: () => reads };
  }
  function fakeBilling(opts: { refuse?: unknown } = {}) {
    const calls: string[] = [];
    const port: BillingPort = {
      inert: false,
      async identity() { calls.push("identity"); return "123-compute@developer.gserviceaccount.com"; },
      async detach() {
        calls.push("detach");
        if (opts.refuse) throw opts.refuse;
      },
    };
    return { port, calls };
  }
  function capture() {
    const lines: Array<[string, string, Record<string, unknown>]> = [];
    const log = {
      info: (m: string, f?: Record<string, unknown>) => { lines.push(["info", m, f ?? {}]); },
      warn: (m: string, f?: Record<string, unknown>) => { lines.push(["warn", m, f ?? {}]); },
      error: (m: string, f?: Record<string, unknown>) => { lines.push(["error", m, f ?? {}]); },
    };
    return { log, lines, metrics: () => lines.map((l) => l[2].metric) };
  }
  const REASON_1500 = 'budget "InSight": 1500 of 500 NOK (300%), the interval from 2026-09-01T00:00:00Z';

  it("writes the level, the reason and the interval on a pause, and nothing when nothing moves", async () => {
    const { store, writes, reads } = fakeStore(idle);
    expect(await applyBudgetMessage(store, msg({ costAmount: 120 }), quiet)).toBe("none");
    expect(writes).toEqual([]);
    expect(await applyBudgetMessage(store, msg({ costAmount: 640 }), quiet)).toBe("paused");
    expect(writes).toEqual([["pause", 'budget "InSight": 640 of 500 NOK (128%), the interval from 2026-09-01T00:00:00Z', SEP]]);
    expect(reads()).toBe(2);
  });

  it("releases its own level in a new month", async () => {
    const { store, writes } = fakeStore(st({ level: 1, by: BUDGET_MODE_BY, interval: SEP }));
    expect(await applyBudgetMessage(store, msg({ costAmount: 3, costIntervalStart: OCT }), quiet)).toBe("released");
    expect(writes).toEqual([["release"]]);
  });

  it("detaches: the latch is written first, the breaker with it when it was down, then the API is called", async () => {
    const { store, writes } = fakeStore(idle);
    const { port, calls } = fakeBilling();
    const { log, metrics, lines } = capture();
    expect(await applyBudgetMessage(store, msg({ costAmount: 1500 }), log, port)).toBe("detached");
    expect(writes).toEqual([["detach", REASON_1500, SEP, 3, true]]);
    expect(calls).toEqual(["detach"]);
    // Said before the call — the metric the policy watches — and after it.
    expect(metrics()).toEqual(["budget_billing_detach", "budget_billing_detached"]);
    expect(lines[0][0]).toBe("error");
    expect(lines[0][1]).toMatch(/DETACHING BILLING at 300% — over the 300% line/);
    expect(lines[0][1]).toMatch(/raises the line to 600%/);
    expect(lines[0][1]).toMatch(/budget-mode\.mjs --level 0/);
  });

  it("leaves a breaker that is already up alone in the latch write", async () => {
    const { store, writes } = fakeStore(st({ level: 1, by: BUDGET_MODE_BY, interval: SEP }));
    const { port } = fakeBilling();
    expect(await applyBudgetMessage(store, msg({ costAmount: 1500 }), quiet, port)).toBe("detached");
    expect(writes).toEqual([["detach", REASON_1500, SEP, 3, false]]);
  });

  it("a refused detach clears the latch, names the role and the identity, and reports the failure", async () => {
    const { store, writes } = fakeStore(idle);
    const refusal = Object.assign(new Error("Request failed with status code 403"), {
      response: { status: 403, data: { error: { message: "The caller does not have permission" } } },
    });
    const { port, calls } = fakeBilling({ refuse: refusal });
    const { log, lines, metrics } = capture();
    expect(await applyBudgetMessage(store, msg({ costAmount: 1500 }), log, port)).toBe("detach_failed");
    expect(writes).toEqual([["detach", REASON_1500, SEP, 3, true], ["forget"]]);
    expect(calls).toEqual(["detach", "identity"]);
    expect(metrics()).toEqual(["budget_billing_detach", "budget_detach_failed"]);
    const refused = lines[1][1];
    expect(refused).toMatch(/REFUSED/);
    expect(refused).toMatch(/403: The caller does not have permission/);
    expect(refused).toMatch(/roles\/billing\.projectManager on the project to 123-compute@developer\.gserviceaccount\.com/);
    expect(refused).toMatch(/tries again/);
  });

  it("a latch that cannot be written does not stop the detach — the ceiling outranks the bookkeeping", async () => {
    const { store, writes } = fakeStore(idle, { detachThrows: true });
    const { port, calls } = fakeBilling();
    const { log, metrics } = capture();
    expect(await applyBudgetMessage(store, msg({ costAmount: 1500 }), log, port)).toBe("detached");
    expect(writes).toEqual([]);
    expect(calls).toEqual(["detach"]);
    expect(metrics()).toEqual(["budget_detach_latch_failed", "budget_billing_detach", "budget_billing_detached"]);
  });

  it("a refusal whose latch will not clear says so, and still reports the failure", async () => {
    const { store, writes } = fakeStore(idle, { forgetThrows: true });
    const { port } = fakeBilling({ refuse: new Error("boom") });
    const { log, metrics } = capture();
    expect(await applyBudgetMessage(store, msg({ costAmount: 1500 }), log, port)).toBe("detach_failed");
    expect(writes).toEqual([["detach", REASON_1500, SEP, 3, true]]);
    expect(metrics()).toEqual(["budget_billing_detach", "budget_detach_failed", "budget_detach_latch_stuck"]);
  });

  it("a runtime with no billing port cannot detach, and says so rather than pretending", async () => {
    const { store, writes } = fakeStore(idle);
    const { log, metrics, lines } = capture();
    expect(await applyBudgetMessage(store, msg({ costAmount: 1500 }), log)).toBe("detach_failed");
    expect(writes).toEqual([]);
    expect(metrics()).toEqual(["budget_detach_failed"]);
    expect(lines[0][1]).toMatch(/NOT detached/);
  });

  it("the inert port runs the whole flow and reaches nothing", async () => {
    const { store, writes } = fakeStore(idle);
    const { log, lines } = capture();
    const port = inertBillingPort("the emulator");
    expect(port.inert).toBe(true);
    expect(await port.identity()).toBeNull();
    expect(await applyBudgetMessage(store, msg({ costAmount: 1500 }), log, port)).toBe("detached");
    expect(writes).toEqual([["detach", REASON_1500, SEP, 3, true]]);
    expect(lines.at(-1)?.[1]).toMatch(/INERT port, nothing reached Cloud Billing/);
  });

  it("under the ratcheted line a re-attached month only pauses, and the store is not written again", async () => {
    const { store, writes } = fakeStore(st({ level: 1, by: BUDGET_MODE_BY, interval: SEP, detachedRatio: 3.02, detachedInterval: SEP }));
    const { port, calls } = fakeBilling();
    expect(await applyBudgetMessage(store, msg({ costAmount: 2000 }), quiet, port)).toBe("none");
    expect(writes).toEqual([]);
    expect(calls).toEqual([]);
  });
});

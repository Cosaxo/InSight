// budget.ts — the budget acts: a Cloud Billing budget notification that
// reaches 100 % flips the read breaker (COST-EXPOSURE.md §6 C4 — D332's
// recorded next joint, built 2026-09-09).
//
// WHY. A budget notifies; nothing in it caps (COSTS.md § The controls that
// are not in this repository). D332 built the read breaker — one field,
// `budgetMode` on `v2_meta/app`, which every device reads at boot and which
// sheds ~80 % of per-user reads at level 1 — and left it hand-pulled:
// `node scripts/budget-mode.mjs --level 1` from a terminal, after a mail
// Cloud Billing sends hours behind the spend. The hours between that mail
// and a person were the largest gap left on the exposure page once App
// Check enforcement closed the unattested-reads one. This closes it: the
// budget publishes its state to a Pub/Sub topic every twenty to thirty
// minutes (scripts/apply-budget.mjs attaches the topic; the owner grants
// the budget's service agent the right to publish — OWNER-LIST.md), and
// this function sets level 1 the first time the month's spend reaches the
// budget, in the same fields the script writes, so `--status` and
// `--level 0` read and release it exactly as before.
//
// WHAT IT DOES NOT DO. It never detaches billing. Google's documented hard
// stop — the same message calling projects.updateBillingInfo with an empty
// billing account — takes every paid service down with the spend, and for
// an app whose worst modelled month at launch size is a few dollars an
// outage is the more expensive failure (COSTS.md). That is the owner's
// call, on OWNER-LIST.md with the arithmetic; if made, it is one more
// branch of `budgetDecision` at a higher threshold and one IAM role, not a
// second function.
//
// WHAT IT RELEASES. Only what it set, and only when the month has moved
// on: a level this function raised is released by a notification for a
// NEW cost interval whose spend is under the line — a budget message
// never says the spend fell inside a month, so nothing else could mean
// that. A level an operator set by hand (`budgetModeBy` absent, or the
// script's) is never touched; the operator releases it, as before.
//
// COST. One read of v2_meta/app per message — about fifty a day — and a
// write only when the level moves. Nothing a device reads changes shape.
import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { FUNCTIONS_REGION, LIGHT_CALLABLE } from "./ops";
import { db as firestore } from "./db";

/** The topic the budget publishes to — scripts/apply-budget.mjs attaches
 *  `projects/{project}/topics/budget-alerts` to the budget, and the
 *  deploy creates the topic with this trigger. One name, pinned to the
 *  script's by apply-budget.test.mjs. */
export const BUDGET_TOPIC = "budget-alerts";
/** The share of the budget at which the breaker is set: the budget's own
 *  100 % rule. Not lower — below the line a mail is the right instrument,
 *  and the 500 NOK figure is sized so that reaching it means something is
 *  wrong (COSTS.md § control 1). */
export const BUDGET_ACT_AT = 1.0;
/** Written beside the level so a release knows the level was this
 *  function's to release. */
export const BUDGET_MODE_BY = "onBudgetAlert";

/** What a Cloud Billing budget notification carries, of what this reads. */
export interface BudgetMessage {
  budgetDisplayName: string | null;
  costAmount: number;
  budgetAmount: number;
  currencyCode: string | null;
  /** The start of the cost interval (the month), the release's key. */
  costIntervalStart: string | null;
  /** The highest CURRENT_SPEND threshold rule crossed, as a fraction
   *  (1.0 for 100 %); absent while none is. */
  alertThresholdExceeded: number | null;
}

/** A message off the topic, or null for anything that is not a budget
 *  notification — a test publish, a hand-typed body. */
export function parseBudgetMessage(raw: unknown): BudgetMessage | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
  const costAmount = num(o.costAmount);
  const budgetAmount = num(o.budgetAmount);
  if (costAmount === null || budgetAmount === null) return null;
  return {
    budgetDisplayName: str(o.budgetDisplayName),
    costAmount,
    budgetAmount,
    currencyCode: str(o.currencyCode),
    costIntervalStart: str(o.costIntervalStart),
    alertThresholdExceeded: num(o.alertThresholdExceeded),
  };
}

/** The breaker as it stands: the level, who set it, and for which month. */
export interface BudgetModeState {
  level: number;
  by: string | null;
  interval: string | null;
}

export interface BudgetModeStore {
  read(): Promise<BudgetModeState>;
  pause(reason: string, interval: string | null): Promise<void>;
  release(): Promise<void>;
}

export type BudgetAction = "paused" | "released" | "none";

/** Pure: what one message means against the breaker as it stands. */
export function budgetDecision(msg: BudgetMessage, state: BudgetModeState): { action: BudgetAction; reason: string } {
  const ratio = msg.budgetAmount > 0 ? msg.costAmount / msg.budgetAmount : 0;
  const over = ratio >= BUDGET_ACT_AT || (msg.alertThresholdExceeded ?? 0) >= BUDGET_ACT_AT;
  const reason = `budget "${msg.budgetDisplayName ?? "?"}": ${msg.costAmount} of ${msg.budgetAmount} ${msg.currencyCode ?? ""}`.trimEnd()
    + ` (${Math.round(ratio * 100)}%), the interval from ${msg.costIntervalStart ?? "?"}`;
  if (over) return { action: state.level >= 1 ? "none" : "paused", reason };
  const mine = state.level >= 1 && state.by === BUDGET_MODE_BY;
  const newMonth = state.interval !== null && msg.costIntervalStart !== null && msg.costIntervalStart !== state.interval;
  return { action: mine && newMonth ? "released" : "none", reason };
}

/** Read, decide, write only on a move; says what it did on the metric
 *  `budget_mode_set` (level 1 or 0) so a policy can watch it. */
export async function applyBudgetMessage(
  store: BudgetModeStore,
  msg: BudgetMessage,
  log: Pick<typeof logger, "info" | "warn"> = logger,
): Promise<BudgetAction> {
  const state = await store.read();
  const { action, reason } = budgetDecision(msg, state);
  if (action === "paused") {
    await store.pause(reason, msg.costIntervalStart);
    log.warn(`[budget] read breaker set to level 1 — ${reason}. Release: node scripts/budget-mode.mjs --level 0`, {
      metric: "budget_mode_set", level: 1, costAmount: msg.costAmount, budgetAmount: msg.budgetAmount,
    });
  } else if (action === "released") {
    await store.release();
    log.warn(`[budget] read breaker released — a new cost interval, ${reason}`, {
      metric: "budget_mode_set", level: 0, costAmount: msg.costAmount, budgetAmount: msg.budgetAmount,
    });
  } else {
    log.info(`[budget] ${reason} — breaker at level ${state.level}, nothing moved`, { metric: "budget_message", level: state.level });
  }
  return action;
}

/** The breaker's document, in the fields scripts/budget-mode.mjs reads and
 *  writes (`budgetMode`, `budgetModeAt`, `budgetModeReason`) plus the two
 *  the release rule needs. */
export function firestoreBudgetModeStore(db: Firestore): BudgetModeStore {
  const ref = db.collection("v2_meta").doc("app");
  return {
    async read() {
      const snap = await ref.get();
      return {
        level: Number(snap.get("budgetMode") || 0),
        by: (snap.get("budgetModeBy") as string | undefined) ?? null,
        interval: (snap.get("budgetModeInterval") as string | undefined) ?? null,
      };
    },
    async pause(reason, interval) {
      await ref.set({
        budgetMode: 1,
        budgetModeAt: FieldValue.serverTimestamp(),
        budgetModeReason: reason,
        budgetModeBy: BUDGET_MODE_BY,
        budgetModeInterval: interval ?? FieldValue.delete(),
      }, { merge: true });
    },
    async release() {
      await ref.set({
        budgetMode: 0,
        budgetModeAt: FieldValue.serverTimestamp(),
        budgetModeReason: FieldValue.delete(),
        budgetModeBy: FieldValue.delete(),
        budgetModeInterval: FieldValue.delete(),
      }, { merge: true });
    },
  };
}

export const onBudgetAlert = onMessagePublished(
  // LIGHT_CALLABLE's 256 MiB and a minute: one document read and at most
  // one write. No retry: the budget re-publishes every twenty to thirty
  // minutes, which is the retry.
  { topic: BUDGET_TOPIC, region: FUNCTIONS_REGION, ...LIGHT_CALLABLE, retry: false },
  async (event) => {
    let raw: unknown = null;
    try {
      raw = event.data.message.json;
    } catch {
      raw = null;
    }
    const msg = parseBudgetMessage(raw);
    if (!msg) {
      logger.warn("[budget] a message on the budget topic was not a budget notification — ignored", { metric: "budget_message_unreadable" });
      return;
    }
    await applyBudgetMessage(firestoreBudgetModeStore(firestore()), msg);
  },
);

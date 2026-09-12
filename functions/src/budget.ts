// budget.ts — the budget acts: a Cloud Billing budget notification that
// reaches 100 % flips the read breaker, and one that reaches 300 % detaches
// billing — the soft stop (COST-EXPOSURE.md §6 C4, built 2026-09-09) and
// the hard one (D471, the owner's ruling of 2026-09-12).
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
// THE HARD STOP (D471). Google has no spend limit for Firestore; its
// documented ceiling is this same notification calling
// projects.updateBillingInfo with an empty billing account, which stops
// every paid service with the spend — in Google's own words, billable
// activity stops and the application could stop functioning — so the app
// is down until the account is re-attached by hand. Until 2026-09-12 that
// was recorded as available and not built, because for an app whose worst
// modelled month is a few dollars an outage read as the more expensive
// failure. The owner ruled the other way, on the arithmetic (*"i want a
// celling on 1500nok as that should in theory not be issue for a long
// time unless something goes wrong"*): at THREE budgets — 1,500 NOK on
// the 500 NOK budget the tree arms — the month is ~140× the August
// invoice and far above the modelled bill at 5,000 daily users, so
// nothing legitimate reaches the line before the app has tens of
// thousands of people, and both figures are retuned long before. What it
// buys: the worst invoice is the line plus a few hours of whatever was
// burning, because Cloud Billing's data trails the spend. The line is a
// RATIO read off the same message — costAmount over budgetAmount — so it
// needs no threshold rule on the budget and no currency; apply-budget.mjs
// adds the 300 % rule anyway so Google's own mail says what this did.
//
// THE LATCH, and why the ceiling ratchets rather than repeats. A detach
// stops the functions with everything else, so nothing here runs again
// until the owner re-attaches the account — and the next notification,
// twenty minutes after that, still shows a month over the line. Detaching
// again would take the app down every half hour until the month ends,
// which is an un-restorable app, not a ceiling. So the detach is written
// to v2_meta/app first (the ratio it fired at, and the cost interval),
// and the line from then on is that ratio PLUS the multiple: a re-attach
// is the owner's deliberate act and buys one more 1,500 NOK of room, never
// unlimited room. A new cost interval starts the count over.
//
// ORDER OF OPERATIONS, because every step is a failure somebody lives
// with. The latch is written BEFORE the API call — a detach takes billing
// down within seconds and a write after it may never land, which would
// leave the re-attach trap armed. A write that fails does not stop the
// detach: the ceiling matters more than the bookkeeping. An API call that
// fails — a missing role, most likely — clears the latch it wrote and says
// the remedy at ERROR, so the next notification tries again instead of
// believing the account is gone. And the emulator never reaches Cloud
// Billing at all: its port is inert and says so.
//
// WHAT IT RELEASES. Only what it set, and only when the month has moved
// on: a level this function raised is released by a notification for a
// NEW cost interval whose spend is under the line — a budget message
// never says the spend fell inside a month, so nothing else could mean
// that. A level an operator set by hand (`budgetModeBy` absent, or the
// script's) is never touched; the operator releases it, as before. The
// latch goes with the release.
//
// COST. One read of v2_meta/app per message — about fifty a day — a write
// only when the level or the latch moves, and one PUT to the Cloud
// Billing API on the day it fires. Nothing a device reads changes shape.
import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/logger";
import { GoogleAuth } from "google-auth-library";
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
/** The share of the budget at which billing is DETACHED — the hard stop
 *  (D471). Three budgets: 1,500 NOK on the 500 NOK budget the tree arms,
 *  the owner's figure of 2026-09-12. A multiple rather than an amount so
 *  a retuned budget moves the ceiling with it — the same discipline that
 *  keeps the budget and the pulse guard on one figure (D332) — and pinned
 *  to apply-budget.mjs's top threshold rule by apply-budget.test.mjs, so
 *  Google's own mail at this line says what the function did. */
export const BUDGET_DETACH_AT = 3.0;
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
 *  notification — a test publish, a hand-typed body. A body that DOES
 *  parse is believed, detach line included: the topic is the budget's
 *  channel and publishing to it is an operator's act, so test the breaker
 *  with a ratio between the two lines, never at or above the second. */
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

/** The breaker as it stands: the level, who set it, and for which month —
 *  and the latch: the ratio billing was last detached at, in which cost
 *  interval. Both null when it never was. */
export interface BudgetModeState {
  level: number;
  by: string | null;
  interval: string | null;
  detachedRatio: number | null;
  detachedInterval: string | null;
}

export interface BudgetModeStore {
  read(): Promise<BudgetModeState>;
  pause(reason: string, interval: string | null): Promise<void>;
  release(): Promise<void>;
  /** Write the latch — and raise the breaker in the same write when it is
   *  not already up, because a detach implies every softer stop. */
  recordDetach(reason: string, interval: string | null, ratio: number, setBreaker: boolean): Promise<void>;
  /** Undo recordDetach after a refused API call, so the next notification
   *  tries the detach again rather than believing it happened. */
  forgetDetach(): Promise<void>;
}

/** The door to Cloud Billing. Production's calls the API; the emulator's
 *  is inert and says so; a test's records the call. */
export interface BillingPort {
  /** True where nothing reaches Cloud Billing on purpose (the emulator). */
  inert: boolean;
  /** Who the call runs as, for the remedy line — null when unknown. */
  identity(): Promise<string | null>;
  /** Detach the project's billing account. Throws on refusal. */
  detach(): Promise<void>;
}

export type BudgetAction = "paused" | "released" | "none" | "detached" | "detach_failed";

/** The ratio at which THIS message would detach billing: the multiple, or
 *  the multiple past the last detach when one is latched for the same
 *  cost interval. A message with no interval cannot prove a new month, so
 *  a latch stands against it — the reading that keeps the app up. */
export function detachLine(msg: BudgetMessage, state: BudgetModeState): number {
  const latched = state.detachedRatio !== null
    && (msg.costIntervalStart === null || msg.costIntervalStart === state.detachedInterval);
  return (latched ? state.detachedRatio ?? 0 : 0) + BUDGET_DETACH_AT;
}

/** Pure: what one message means against the breaker as it stands. */
export function budgetDecision(
  msg: BudgetMessage,
  state: BudgetModeState,
): { action: BudgetAction; reason: string; ratio: number; line: number } {
  const ratio = msg.budgetAmount > 0 ? msg.costAmount / msg.budgetAmount : 0;
  const line = detachLine(msg, state);
  const reason = `budget "${msg.budgetDisplayName ?? "?"}": ${msg.costAmount} of ${msg.budgetAmount} ${msg.currencyCode ?? ""}`.trimEnd()
    + ` (${Math.round(ratio * 100)}%), the interval from ${msg.costIntervalStart ?? "?"}`;
  // The hard stop reads the ratio alone — the threshold rules are the
  // mail's, and a rule can only say which of ITS lines was crossed.
  if (ratio >= line) return { action: "detached", reason, ratio, line };
  const over = ratio >= BUDGET_ACT_AT || (msg.alertThresholdExceeded ?? 0) >= BUDGET_ACT_AT;
  if (over) return { action: state.level >= 1 ? "none" : "paused", reason, ratio, line };
  const mine = state.level >= 1 && state.by === BUDGET_MODE_BY;
  const newMonth = state.interval !== null && msg.costIntervalStart !== null && msg.costIntervalStart !== state.interval;
  return { action: mine && newMonth ? "released" : "none", reason, ratio, line };
}

type BudgetLog = Pick<typeof logger, "info" | "warn" | "error">;

/** A refusal as an operator reads it: the API's own sentence where there is
 *  one, the status in front of it. */
function errText(err: unknown): string {
  const e = err as { message?: string; response?: { status?: number; data?: { error?: { message?: string } } } } | null;
  const api = e?.response?.data?.error?.message;
  const status = e?.response?.status;
  return `${status ? `${status}: ` : ""}${api ?? e?.message ?? String(err)}`;
}

const pct = (r: number) => `${Math.round(r * 100)}%`;

/** Read, decide, write only on a move; says what it did on the metric
 *  `budget_mode_set` (level 1 or 0) so a policy can watch it, and on
 *  `budget_billing_detach` / `budget_detach_failed` — at ERROR, because a
 *  detach is the loudest thing this backend can do — when the hard stop
 *  fires or is refused (monitoring/onBudgetAlert-acted.json). */
export async function applyBudgetMessage(
  store: BudgetModeStore,
  msg: BudgetMessage,
  log: BudgetLog = logger,
  billing: BillingPort | null = null,
): Promise<BudgetAction> {
  const state = await store.read();
  const { action, reason, ratio, line } = budgetDecision(msg, state);
  if (action === "detached") {
    const fields = { costAmount: msg.costAmount, budgetAmount: msg.budgetAmount, ratio, line };
    if (!billing) {
      log.error(
        `[budget] ${pct(ratio)} is over the detach line (${pct(line)}) and this runtime has no billing port — NOT detached — ${reason}`,
        { metric: "budget_detach_failed", ...fields },
      );
      return "detach_failed";
    }
    // The latch first — see ORDER OF OPERATIONS above.
    let latched = false;
    try {
      await store.recordDetach(reason, msg.costIntervalStart, ratio, state.level < 1);
      latched = true;
    } catch (err) {
      log.error(
        `[budget] could not record the detach before making it (${errText(err)}) — detaching anyway; if the account is`
          + ` re-attached this month, expect one more detach at ${pct(line)} rather than at ${pct(ratio + BUDGET_DETACH_AT)}`,
        { metric: "budget_detach_latch_failed", ...fields },
      );
    }
    // Said BEFORE the call, on the metric the policy watches: after it the
    // log line may be the first thing billing takes down.
    log.error(
      `[budget] DETACHING BILLING at ${pct(ratio)} — over the ${pct(line)} line — ${reason}. The app is down until the`
        + " account is re-attached (Console → Billing → Link a billing account; DEPLOYMENT.md § The budget's wire);"
        + ` a re-attach this month raises the line to ${pct(ratio + BUDGET_DETACH_AT)}. Release the breaker afterwards:`
        + " node scripts/budget-mode.mjs --level 0",
      { metric: "budget_billing_detach", level: 1, ...fields },
    );
    try {
      await billing.detach();
    } catch (err) {
      const who = await billing.identity().catch(() => null);
      log.error(
        `[budget] billing detach REFUSED — the ceiling did NOT hold: ${errText(err)} — ${reason}. Fix: grant`
          + ` roles/billing.projectManager on the project to ${who ?? "the functions' runtime service account"}`
          + " (DEPLOYMENT.md § The budget's wire); the next notification, in twenty to thirty minutes, tries again.",
        { metric: "budget_detach_failed", ...fields, identity: who },
      );
      if (latched) {
        try {
          await store.forgetDetach();
        } catch (err2) {
          log.error(
            `[budget] and the latch could not be cleared (${errText(err2)}) — the line this month reads`
              + ` ${pct(ratio + BUDGET_DETACH_AT)} until it is: node scripts/budget-mode.mjs --status shows it`,
            { metric: "budget_detach_latch_stuck", ...fields },
          );
        }
      }
      return "detach_failed";
    }
    log.error(
      `[budget] billing detached${billing.inert ? " — INERT port, nothing reached Cloud Billing" : ""} — ${reason}`,
      { metric: "budget_billing_detached", ...fields, inert: billing.inert },
    );
    return "detached";
  }
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
    log.info(`[budget] ${reason} — breaker at level ${state.level}, the detach line at ${pct(line)}, nothing moved`, {
      metric: "budget_message", level: state.level, ratio, line,
    });
  }
  return action;
}

/** The breaker's document, in the fields scripts/budget-mode.mjs reads and
 *  writes (`budgetMode`, `budgetModeAt`, `budgetModeReason`) plus the two
 *  the release rule needs — and the latch's five, which `--status` prints
 *  and nothing on a device reads. */
export function firestoreBudgetModeStore(db: Firestore): BudgetModeStore {
  const ref = db.collection("v2_meta").doc("app");
  const gone = () => FieldValue.delete();
  const latchCleared = () => ({
    billingDetachedAt: gone(),
    billingDetachedRatio: gone(),
    billingDetachedInterval: gone(),
    billingDetachedReason: gone(),
    billingDetachedBy: gone(),
  });
  return {
    async read() {
      const snap = await ref.get();
      const ratio: unknown = snap.get("billingDetachedRatio");
      return {
        level: Number(snap.get("budgetMode") || 0),
        by: (snap.get("budgetModeBy") as string | undefined) ?? null,
        interval: (snap.get("budgetModeInterval") as string | undefined) ?? null,
        detachedRatio: typeof ratio === "number" && Number.isFinite(ratio) ? ratio : null,
        detachedInterval: (snap.get("billingDetachedInterval") as string | undefined) ?? null,
      };
    },
    async pause(reason, interval) {
      await ref.set({
        budgetMode: 1,
        budgetModeAt: FieldValue.serverTimestamp(),
        budgetModeReason: reason,
        budgetModeBy: BUDGET_MODE_BY,
        budgetModeInterval: interval ?? gone(),
      }, { merge: true });
    },
    async release() {
      await ref.set({
        budgetMode: 0,
        budgetModeAt: FieldValue.serverTimestamp(),
        budgetModeReason: gone(),
        budgetModeBy: gone(),
        budgetModeInterval: gone(),
        ...latchCleared(),
      }, { merge: true });
    },
    async recordDetach(reason, interval, ratio, setBreaker) {
      await ref.set({
        ...(setBreaker ? {
          budgetMode: 1,
          budgetModeAt: FieldValue.serverTimestamp(),
          budgetModeReason: reason,
          budgetModeBy: BUDGET_MODE_BY,
          budgetModeInterval: interval ?? gone(),
        } : {}),
        billingDetachedAt: FieldValue.serverTimestamp(),
        billingDetachedRatio: ratio,
        billingDetachedInterval: interval ?? gone(),
        billingDetachedReason: reason,
        billingDetachedBy: BUDGET_MODE_BY,
      }, { merge: true });
    },
    async forgetDetach() {
      await ref.set(latchCleared(), { merge: true });
    },
  };
}

/** Production's door: the Cloud Billing API, as the functions' own runtime
 *  service account, which needs `roles/billing.projectManager` on the
 *  project (DEPLOYMENT.md § The budget's wire). `updateBillingInfo` with an
 *  empty account name is Google's documented way to disable billing. */
export function cloudBillingPort(projectId?: string): BillingPort {
  // cloud-platform rather than the billing scope, for google-api.mjs's
  // reason: the scope says what a token may ask for, the roles what it
  // gets, and a narrow scope only turns a 403 that names a role into an
  // opaque invalid_scope.
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
  return {
    inert: false,
    async identity() {
      const creds = await auth.getCredentials();
      return creds.client_email ?? null;
    },
    async detach() {
      const project = projectId ?? process.env.GCLOUD_PROJECT ?? (await auth.getProjectId());
      const client = await auth.getClient();
      await client.request({
        url: `https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`,
        method: "PUT",
        data: { billingAccountName: "" },
      });
    },
  };
}

/** The emulator's door: the whole flow runs, the latch is written, and
 *  nothing reaches Cloud Billing — a local test publish must never detach
 *  production's account through a developer's own credentials. */
export function inertBillingPort(why: string): BillingPort {
  return {
    inert: true,
    async identity() {
      return null;
    },
    async detach() {
      logger.warn(`[budget] billing NOT detached — ${why}`, { metric: "budget_detach_inert" });
    },
  };
}

export const onBudgetAlert = onMessagePublished(
  // LIGHT_CALLABLE's 256 MiB and a minute: one document read, at most one
  // write, and on one day one API call. No retry: the budget re-publishes
  // every twenty to thirty minutes, which is the retry.
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
    const billing = process.env.FUNCTIONS_EMULATOR === "true"
      ? inertBillingPort("the emulator never reaches Cloud Billing; the hard stop is exercised here, not made")
      : cloudBillingPort();
    await applyBudgetMessage(firestoreBudgetModeStore(firestore()), msg, logger, billing);
  },
);

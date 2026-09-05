// pricingFold.ts — the demand fold behind the rate card, as ONE pure
// function the server runs by machinery and the operator script runs by
// hand (D366).
//
// WHY THIS MOVED OUT OF scripts/build-pricing.mjs. PAID-PLAN §6 priced a
// cohort by size × desire, with desire "recomputed by a script from the
// order book", and D288 §3 shipped that script: run BY HAND in the same
// sitting as a hand-recorded contract, its output committed. D313 then
// took the human out of the sale — a buyer books, an automated review
// quotes, Stripe pays, the webhook writes the purchase — and left the
// index on the hand-run script. So from 2026-08-26 every sale the
// machinery made moved the demand index by exactly nothing: the door
// printed "×0.9 · quiet · 0 of 14 booked" over a ledger nobody had folded,
// and the server quoted off the same stale embed. "Not as dynamic as I
// would like" (the owner, 2026-09-05) is that gap measured. The fold now
// runs where the ledger changes — the payment webhook and the nightly
// closer (paid.ts) — and publishes onto `v2_meta/pricing`, which every
// signed-in user can read: the number is still public, it is just no
// longer waiting for a commit.
//
// What each field is, and where its honesty comes from:
//
//   idx        The demand multiplier per cohort: occupied ÷ available
//              slot-days, mapped LINEARLY into [floorX, ceilX] —
//              idx = floorX + ratio × (ceilX − floorX), rounded to 2dp.
//              The window the ratio is taken over is the trailing
//              `trailingDays` PLUS the next FORWARD_DAYS — the fortnight
//              the door already draws as its booked strip. The forward
//              half is D366's one amendment to §6's "trailing window":
//              a scope booked solid for the next two weeks is demand,
//              now, and a trailing-only index kept calling it "quiet"
//              until those days had passed. One slot per day per cohort
//              (SPONSOR_SLOT stays the unit of sale — questions share a
//              day by rotation, ads queue, either occupies it).
//   booked     The next FORWARD_DAYS as 0/1: day i is today+1+i, booked
//              when any RUNNING slot campaign of that scope covers it.
//              Real windows, nothing else — with an empty ledger the row
//              is all zeros, which is true.
//   nextOpen   The first uncovered day, ISO — or null when tomorrow is
//              open, so the door can say "tomorrow" without a stale date.
//              It CANNOT say "sold out": the shape is `null | day`, and
//              `booked` all ones is what carries that (the door reads it).
//   estimates  Per-answer-per-day expectations, WITHHELD until a cohort
//              has a campaign to measure from (D288 §3's honesty, one
//              step earlier since D367): a CLOSED question purchase
//              contributes the answer total the closer wrote on it
//              (`closed.answers`, off the public aggregate) over its
//              inclusive window, and a RUNNING one contributes what the
//              public aggregate says so far — attached by the caller as
//              `progress.answers` — over the days it has served, once
//              that is ESTIMATE_MIN_DAYS or more. The entry carries its
//              basis (campaigns, days, and how many are still running).
//              An empty ledger prints prices and open days — never a
//              forecast; a week of a real campaign is a real rate.
//
// The subscriptions kind is ignored here on purpose: a subscription buys
// a metric's continuity, not the daily slot (PAID-PLAN §5), so it moves
// no slot-day arithmetic.
//
// Pure: no clock, no Firestore. `today` arrives as a day key so the
// nightly closer, the webhook and a test all fold the same way.

import type { PricingCard, PricingCohort } from "./pricing";

/** The scopes the card prices — D164's three windows. */
export const PRICING_SCOPES = ["city", "country", "world"] as const;
export type PricingScope = (typeof PRICING_SCOPES)[number];

/** Days ahead the index counts and the door draws. `check-pricing`
 * holds the committed row to exactly this many ticks. */
export const FORWARD_DAYS = 14;

/** The fields of a purchase row the fold reads — a subset of what
 * paid.ts's paidPurchaseDoc / paidAdPurchaseDoc and record-purchase.mjs
 * write. Anything else on the row is not this function's business. */
export interface PurchaseRow {
  kind?: string;
  scope?: string;
  state?: string;
  qid?: string;
  window?: { start?: string; until?: string };
  closed?: { answers?: number };
  /** A RUNNING question campaign's answer total so far, off the public
   * aggregate — read and attached by the caller (paid.ts publishPricing,
   * scripts/build-pricing.mjs), because the fold is pure. Rows without
   * it contribute nothing to the estimate, whatever they have served. */
  progress?: { answers?: number };
}

/** Days a running campaign must have served before it is an estimate's
 * basis (D367). A week: enough that a weekend and a weekday are both in
 * it, short enough that a scope with one live campaign prints a figure
 * inside the campaign rather than after it. */
export const ESTIMATE_MIN_DAYS = 7;

/** Inclusive days a campaign has served up to `today` — 0 when it has
 * not started or has no window. Exported so a caller knows WHICH running
 * rows need an aggregate read before the fold. */
export function servedDays(row: PurchaseRow, today: string): number {
  const t = parseDay(today);
  const a = parseDay(row.window?.start);
  const b = parseDay(row.window?.until);
  if (t == null || a == null || b == null || a > t || b < a) return 0;
  const end = Math.min(t, b);
  return Math.round((end - a) / DAY) + 1;
}

/** What the fold publishes: the demand-derived half of the card. The
 * constants (base, floor, ceiling, caps, fx) stay in the committed file
 * and are never here — a deliberate re-pricing is a PR, not a fold. */
export interface PricingEstimate { perDay: number; campaigns: number; days: number; running?: number }
export interface PricingLive {
  generated: string;
  cohorts: Record<PricingScope, PricingCohort>;
  estimates: Partial<Record<PricingScope, PricingEstimate>>;
}

const DAY = 24 * 60 * 60 * 1000;
const dayISO = (t: number): string => new Date(t).toISOString().slice(0, 10);
const parseDay = (s: unknown): number | null => {
  if (typeof s !== "string") return null;
  const t = Date.parse(`${s}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
};
const covers = (p: PurchaseRow, t: number): boolean => {
  const a = parseDay(p.window?.start);
  const b = parseDay(p.window?.until);
  return a != null && b != null && a <= t && t <= b;
};

/**
 * Fold the ledger into the live half of the card.
 *
 * @param card   the committed card — its constants decide the clamps and
 *               the trailing window; its cohorts are NOT read
 * @param rows   purchase rows, any state, any kind (filtered here)
 * @param today  the day key the fold is FOR (UTC, YYYY-MM-DD)
 */
export function foldPricing(card: PricingCard, rows: PurchaseRow[], today: string): PricingLive {
  const todayUTC = parseDay(today);
  if (todayUTC == null) throw new Error(`foldPricing: today must be YYYY-MM-DD, got ${JSON.stringify(today)}`);
  const trailingDays = Number.isInteger(card.trailingDays) && card.trailingDays > 0 ? card.trailingDays : 28;
  const floorX = card.floorX;
  const ceilX = card.ceilX;

  const cohorts = {} as Record<PricingScope, PricingCohort>;
  const estimates: PricingLive["estimates"] = {};
  for (const scope of PRICING_SCOPES) {
    // Ads occupy the SAME slot-days the demand index prices (D315), so
    // they fold into occupied/booked with the questions. Estimates below
    // predict answers per day, and an ad has no answers to predict from.
    const slotRows = rows.filter((p) => (p.kind === "question" || p.kind === "ad") && p.scope === scope);

    // Occupied slot-days behind: any campaign that covered the day,
    // whatever its state now — a closed campaign still had that day.
    let sold = 0;
    for (let i = 1; i <= trailingDays; i++) {
      if (slotRows.some((p) => covers(p, todayUTC - i * DAY))) sold++;
    }
    // …and ahead: the fortnight as real windows, running campaigns only.
    const booked: number[] = [];
    let nextOpen: string | null = null;
    let ahead = 0;
    for (let i = 1; i <= FORWARD_DAYS; i++) {
      const t = todayUTC + i * DAY;
      const b = slotRows.some((p) => p.state === "running" && covers(p, t)) ? 1 : 0;
      booked.push(b);
      ahead += b;
      if (!b && nextOpen === null) nextOpen = i === 1 ? "tomorrow" : dayISO(t);
    }
    const ratio = (sold + ahead) / (trailingDays + FORWARD_DAYS);
    const idx = Math.round(Math.min(ceilX, Math.max(floorX, floorX + ratio * (ceilX - floorX))) * 100) / 100;

    cohorts[scope] = { idx, booked, nextOpen: nextOpen === "tomorrow" ? null : nextOpen };

    // estimates from campaigns with a measured rate (D288 §3, D367): a
    // closed one off the answer total the closer wrote, a running one off
    // the aggregate total the caller attached, once it has served a week.
    let answers = 0, days = 0, campaigns = 0, running = 0;
    for (const p of rows) {
      if (p.kind !== "question" || p.scope !== scope) continue;
      if (p.state === "closed") {
        const n = p.closed?.answers;
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0) continue;
        const a = parseDay(p.window?.start);
        const b = parseDay(p.window?.until);
        if (a == null || b == null || b < a) continue;
        answers += n;
        days += Math.round((b - a) / DAY) + 1; // inclusive of its last day, like the window
        campaigns++;
      } else if (p.state === "running") {
        const n = p.progress?.answers;
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0) continue;
        const served = servedDays(p, today);
        if (served < ESTIMATE_MIN_DAYS) continue;
        answers += n;
        days += served;
        campaigns++;
        running++;
      }
    }
    if (campaigns > 0 && days > 0) {
      estimates[scope] = { perDay: Math.round(answers / days), campaigns, days, ...(running ? { running } : {}) };
    }
  }

  return { generated: today, cohorts, estimates };
}

/**
 * The committed card with a published live half laid over it — what
 * the server prices off (paid.ts liveCard) and, by the same rules, what
 * the door prints (src/v2/data/pricing.ts applyLive; two copies of a
 * twenty-line shape check, each tested on its own side).
 *
 * Refuses, whole, anything not in shape: a live doc with a malformed
 * cohort is ignored rather than half-applied, and every idx is clamped
 * to the card's own floor and ceiling — the clamps are the mechanism,
 * and a published number outside them is a bug, not a price.
 */
export function mergeLivePricing(card: PricingCard, live: unknown): PricingCard {
  if (!live || typeof live !== "object") return card;
  const l = live as Record<string, unknown>;
  const generated = typeof l.generated === "string" && /^\d{4}-\d{2}-\d{2}$/.test(l.generated) ? l.generated : null;
  const rawCohorts = l.cohorts && typeof l.cohorts === "object" ? (l.cohorts as Record<string, unknown>) : null;
  if (!generated || !rawCohorts) return card;
  const cohorts = {} as Record<PricingScope, PricingCohort>;
  for (const scope of PRICING_SCOPES) {
    const c = rawCohorts[scope] as Record<string, unknown> | undefined;
    if (!c || typeof c !== "object") return card;
    const idx = typeof c.idx === "number" && Number.isFinite(c.idx) ? c.idx : NaN;
    const booked = Array.isArray(c.booked) ? c.booked : null;
    if (Number.isNaN(idx) || !booked || booked.length !== FORWARD_DAYS || booked.some((b) => b !== 0 && b !== 1)) return card;
    const nextOpen = c.nextOpen === null || c.nextOpen === undefined ? null
      : typeof c.nextOpen === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.nextOpen) ? c.nextOpen : undefined;
    if (nextOpen === undefined) return card;
    cohorts[scope] = {
      idx: Math.round(Math.min(card.ceilX, Math.max(card.floorX, idx)) * 100) / 100,
      booked: booked.map((b) => (b ? 1 : 0)),
      nextOpen,
    };
  }
  const estimates: PricingCard["estimates"] = {};
  const rawEst = l.estimates && typeof l.estimates === "object" ? (l.estimates as Record<string, unknown>) : {};
  for (const scope of PRICING_SCOPES) {
    const e = rawEst[scope] as Record<string, unknown> | undefined;
    if (!e || typeof e !== "object") continue;
    const { perDay, campaigns, days, running } = e;
    // The basis ships with the figure or the figure does not ship.
    if (!Number.isInteger(perDay) || (perDay as number) < 0) continue;
    if (!Number.isInteger(campaigns) || (campaigns as number) < 1) continue;
    if (!Number.isInteger(days) || (days as number) < 1) continue;
    const est: PricingEstimate = { perDay: perDay as number, campaigns: campaigns as number, days: days as number };
    if (Number.isInteger(running) && (running as number) > 0 && (running as number) <= (campaigns as number)) est.running = running as number;
    estimates[scope] = est;
  }
  return { ...card, generated, cohorts, estimates };
}

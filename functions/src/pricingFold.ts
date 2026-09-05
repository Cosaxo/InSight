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
//   idx        The demand multiplier per cohort, and since D368 it
//              measures CROWDING with no ceiling:
//                idx = floorX + crowdStep × (campaigns in rotation per
//                      day, averaged over the next FORWARD_DAYS)
//              rounded to 2dp. Nobody else asking that cohort: the floor
//              (base is the quiet price). One other campaign across the
//              fortnight: +crowdStep (×1.5 at the committed 0.5). Five:
//              ×3.5. There is no cap, because the thing being measured
//              has none. What it replaced: D366's ratio of BOOKED days
//              over the trailing month and the coming fortnight, mapped
//              into a floor and a ceiling — a signal that saturated at
//              "every day booked" and then stopped moving however many
//              buyers wanted the same cohort, which is what made the
//              ceiling look like a cap on desire rather than the end of
//              a scale (the owner, 2026-09-05). Questions share a day's
//              slot by rotation and ads queue, so a crowded day is fewer
//              answers per campaign — the price rises exactly when the
//              answers are scarce. Running campaigns only, and only the
//              days ahead: a campaign that ended last month is not in
//              anybody's rotation.
//   booked     The next FORWARD_DAYS as 0/1: day i is today+1+i, booked
//              when any RUNNING slot campaign of that scope covers it.
//              Real windows, nothing else — with an empty ledger the row
//              is all zeros, which is true.
//   crowd      The same fortnight as COUNTS — campaigns in rotation each
//              day — which is what the idx is folded from and what the
//              door's strip draws by height.
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
  const floorX = card.floorX;
  const crowdStep = typeof card.crowdStep === "number" && card.crowdStep >= 0 ? card.crowdStep : 0.5;

  const cohorts = {} as Record<PricingScope, PricingCohort>;
  const estimates: PricingLive["estimates"] = {};
  for (const scope of PRICING_SCOPES) {
    // Ads occupy the SAME slot-days the demand index prices (D315), so
    // they crowd the rotation with the questions. Estimates below predict
    // answers per day, and an ad has no answers to predict from.
    const slotRows = rows.filter((p) => (p.kind === "question" || p.kind === "ad") && p.scope === scope && p.state === "running");

    // The fortnight ahead as real windows: how many campaigns are in the
    // rotation each day, and from that the strip, the first open day and
    // the index.
    const booked: number[] = [];
    const crowd: number[] = [];
    let nextOpen: string | null = null;
    let sum = 0;
    for (let i = 1; i <= FORWARD_DAYS; i++) {
      const t = todayUTC + i * DAY;
      const n = slotRows.filter((p) => covers(p, t)).length;
      crowd.push(n);
      booked.push(n ? 1 : 0);
      sum += n;
      if (!n && nextOpen === null) nextOpen = i === 1 ? "tomorrow" : dayISO(t);
    }
    const others = sum / FORWARD_DAYS;
    const idx = Math.round((floorX + crowdStep * others) * 100) / 100;

    cohorts[scope] = { idx, booked, crowd, nextOpen: nextOpen === "tomorrow" ? null : nextOpen };

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
 * cohort is ignored rather than half-applied, and every idx is held to
 * the card's own floor — a published number under it is a bug, not a
 * price. No ceiling since D368: crowding has none.
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
    // The crowd strip is optional (a doc from before D368 lacks it) and,
    // when present, must be the fortnight as counts.
    const crowd = c.crowd === undefined ? booked.map((b) => (b ? 1 : 0)) : Array.isArray(c.crowd) ? c.crowd : null;
    if (!crowd || crowd.length !== FORWARD_DAYS || crowd.some((n) => !Number.isInteger(n) || (n as number) < 0)) return card;
    const nextOpen = c.nextOpen === null || c.nextOpen === undefined ? null
      : typeof c.nextOpen === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.nextOpen) ? c.nextOpen : undefined;
    if (nextOpen === undefined) return card;
    cohorts[scope] = {
      idx: Math.round(Math.max(card.floorX, idx) * 100) / 100,
      booked: booked.map((b) => (b ? 1 : 0)),
      crowd: crowd as number[],
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

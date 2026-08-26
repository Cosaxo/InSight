// pricing.ts — the committed rate card, typed, plus the one currency
// preference every printed price reads (PAID-PLAN §6, D288 §3; the
// runbook's phase 3).
//
// The card is content/pricing.json — recomputed by scripts/build-pricing
// from the purchase ledger, clamped by scripts/check-pricing on CI, and
// imported here the way duel and learn content already are. Nothing in
// this module invents a number: rate() is base × the committed idx, the
// estimates render only where the file carries one (each with its
// campaign basis), and display conversion uses the fx table the same
// committed, dated file publishes — which is why non-EUR figures print
// with an ≈: the conversion is a dated convenience, the EUR line is the
// contract.
import PRICING_JSON from "../../../content/pricing.json";

export type Scope = "city" | "country" | "world";
export interface CohortPricing { idx: number; booked: number[]; nextOpen: string | null }
export interface Estimate { perDay: number; campaigns: number; days: number }
interface PricingFile {
  generated: string;
  currency: string;
  base: number;
  floorX: number;
  ceilX: number;
  floorWeek: number;
  capEur: number;
  adBase: number;
  fx: Record<string, number>;
  trailingDays: number;
  cohorts: Record<Scope, CohortPricing>;
  estimates: Partial<Record<Scope, Estimate>>;
}

export const PRICING = PRICING_JSON as PricingFile;

/** The posted per-answer line for a cohort: base × its committed idx. */
export const rate = (scope: Scope): number =>
  Math.round(PRICING.base * PRICING.cohorts[scope].idx * 1000) / 1000;

/** The ad window's flat line (D306): adBase × the same committed idx —
 * one figure for the whole window, because an ad has nothing to meter. */
export const adFlat = (scope: Scope): number =>
  Math.round(PRICING.adBase * PRICING.cohorts[scope].idx * 100) / 100;

/** The demand word the door prints, mapped from the committed idx bands. */
export const demandWord = (scope: Scope): "quiet" | "steady" | "contested" => {
  const x = PRICING.cohorts[scope].idx;
  const span = PRICING.ceilX - PRICING.floorX || 1;
  const t = (x - PRICING.floorX) / span;
  return t < 1 / 3 ? "quiet" : t < 2 / 3 ? "steady" : "contested";
};

// ── the currency preference ─────────────────────────────────────────
// One choice, persisted, read everywhere a price prints. EUR is the rate
// card's own unit; the others format through the committed fx table.
export type Cur = "EUR" | string;
const CUR_KEY = "insight.currency.v1";
const SYMS: Record<string, { sym: string; pre: boolean }> = {
  EUR: { sym: "€", pre: true },
  NOK: { sym: "kr", pre: false },
  USD: { sym: "$", pre: true },
};

let curCache: string | null = null;
const subs = new Set<() => void>();

export const currencies = (): string[] => ["EUR", ...Object.keys(PRICING.fx || {})];

export const cur = (): string => {
  if (curCache == null) {
    try {
      const c = localStorage.getItem(CUR_KEY) || "EUR";
      curCache = currencies().includes(c) ? c : "EUR";
    } catch { curCache = "EUR"; }
  }
  return curCache;
};

export const setCur = (c: string): void => {
  if (!currencies().includes(c)) return;
  curCache = c;
  try { localStorage.setItem(CUR_KEY, c); } catch { /* best-effort — in-memory is right */ }
  subs.forEach((f) => f());
};

export const subscribeCur = (f: () => void): (() => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

// The purge (data/live.ts, D51): drop the preference with the account —
// a currency is small, but "the next account inherits nothing" is a rule,
// not a size threshold. Notify without re-creating the purged key. The
// typeof guard is for node importers (the pricing scripts' tests import
// this module's arithmetic; a browser always has window).
if (typeof window !== "undefined") {
  window.addEventListener("insight:local-purge", () => { curCache = null; subs.forEach((f) => f()); });
}

/**
 * Format a EUR figure in the chosen currency, rounded to a
 * rate-card-shaped number (never false precision), non-EUR marked ≈
 * because its conversion is the committed, dated fx table — a
 * convenience, not the contract.
 */
export const fmt = (eur: number): string => {
  const c = cur();
  const rateX = c === "EUR" ? 1 : (PRICING.fx || {})[c];
  const x = rateX && rateX > 0 ? rateX : 1;
  const code = rateX && rateX > 0 ? c : "EUR";
  let v = eur * x;
  if (v >= 1000) v = Math.round(v / 100) * 100;
  else if (v >= 100) v = Math.round(v / 10) * 10;
  else if (v >= 1) v = Math.round(v);
  else v = Math.round(v * 100) / 100;
  const s = v >= 1 ? v.toLocaleString("en-US").replace(/,/g, " ") : v.toFixed(2);
  const y = SYMS[code] || { sym: code, pre: true };
  const body = y.pre ? y.sym + s : `${s} ${y.sym}`;
  return code === "EUR" ? body : `≈ ${body}`;
};

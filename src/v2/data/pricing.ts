// pricing.ts — the rate card, typed, plus the one currency preference
// every printed price reads (PAID-PLAN §6, D288 §3; the runbook's phase 3).
//
// TWO HALVES SINCE D366. The CONSTANTS — base, floor, ceiling, the caps,
// the fx table, the trailing window — are content/pricing.json, committed,
// clamped by scripts/check-pricing on CI, and imported here the way duel
// and learn content already are; a deliberate re-pricing is still a PR.
// The DEMAND HALF — each cohort's idx, its booked fortnight, its next open
// day, the estimates, and the day they were folded for — is published by
// the server onto `v2_meta/pricing` where the ledger changes (the payment
// webhook, the nightly closer; functions/src/paid.ts publishPricing), and
// laid over the committed file here when the door opens. Until D366 that
// half moved only when an operator ran scripts/build-pricing.mjs by hand
// and committed the result, which after D313 automated the sale was
// never: every self-serve sale moved the index by exactly nothing. The
// committed values are the fallback — a demo build, a fresh deployment
// with nothing published yet, a read that fails — and the door says which
// day's card it is printing either way.
//
// Nothing in this module invents a number: rate() is base × the idx in
// force, the estimates render only where the card carries one (each with
// its campaign basis), and display conversion uses the fx table the
// committed, dated file publishes — which is why non-EUR figures print
// with an ≈: the conversion is a dated convenience, the EUR line is the
// contract.
import PRICING_JSON from "../../../content/pricing.json";
import { getDb, getFirestoreApi } from "../../lib/firebase";

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

const COMMITTED = PRICING_JSON as PricingFile;
const SCOPES: readonly Scope[] = ["city", "country", "world"];
/** The booked strip's length — the door draws exactly this many ticks,
 * and check-pricing holds the committed row to it. */
const FORWARD_DAYS = 14;

/**
 * The card in force. ONE object, mutated in place when the live half
 * lands, so every reader — the door's rows, the ruler, the contract
 * sheet — reads the same figures on its next render without threading a
 * store through the spec layer. Starts as the committed file.
 */
export const PRICING: PricingFile = { ...COMMITTED };

/** The posted per-answer line for a cohort: base × its idx in force. */
export const rate = (scope: Scope): number =>
  Math.round(PRICING.base * PRICING.cohorts[scope].idx * 1000) / 1000;

/** The ad window's flat line (D315): adBase × the same idx — one figure
 * for the whole window, because an ad has nothing to meter. */
export const adFlat = (scope: Scope): number =>
  Math.round(PRICING.adBase * PRICING.cohorts[scope].idx * 100) / 100;

/** The demand word the door prints, mapped from the idx bands. */
export const demandWord = (scope: Scope): "quiet" | "steady" | "contested" => {
  const x = PRICING.cohorts[scope].idx;
  const span = PRICING.ceilX - PRICING.floorX || 1;
  const t = (x - PRICING.floorX) / span;
  return t < 1 / 3 ? "quiet" : t < 2 / 3 ? "steady" : "contested";
};

// ── the live half ───────────────────────────────────────────────────
// The same shape check functions/src/pricingFold.ts mergeLivePricing
// makes server-side, kept short enough that two copies can be read
// against each other: refuse a doc not in shape WHOLE (never two cohorts
// live and one stale), clamp every idx into the committed floor and
// ceiling, and take an estimate only with its basis.

const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Parse a published live doc against the committed constants; null when
 * it is not in shape. Exported for its test — the door never calls it. */
export function parseLive(live: unknown): Pick<PricingFile, "generated" | "cohorts" | "estimates"> | null {
  if (!live || typeof live !== "object") return null;
  const l = live as Record<string, unknown>;
  if (!isDay(l.generated)) return null;
  const raw = l.cohorts && typeof l.cohorts === "object" ? (l.cohorts as Record<string, unknown>) : null;
  if (!raw) return null;
  const cohorts = {} as Record<Scope, CohortPricing>;
  for (const scope of SCOPES) {
    const c = raw[scope] as Record<string, unknown> | undefined;
    if (!c || typeof c !== "object") return null;
    const idx = typeof c.idx === "number" && Number.isFinite(c.idx) ? c.idx : NaN;
    const booked = Array.isArray(c.booked) ? c.booked : null;
    if (Number.isNaN(idx) || !booked || booked.length !== FORWARD_DAYS || booked.some((b) => b !== 0 && b !== 1)) return null;
    const nextOpen = c.nextOpen == null ? null : isDay(c.nextOpen) ? c.nextOpen : undefined;
    if (nextOpen === undefined) return null;
    cohorts[scope] = {
      idx: Math.round(Math.min(COMMITTED.ceilX, Math.max(COMMITTED.floorX, idx)) * 100) / 100,
      booked: booked.map((b) => (b ? 1 : 0)),
      nextOpen,
    };
  }
  const estimates: PricingFile["estimates"] = {};
  const rawEst = l.estimates && typeof l.estimates === "object" ? (l.estimates as Record<string, unknown>) : {};
  for (const scope of SCOPES) {
    const e = rawEst[scope] as Record<string, unknown> | undefined;
    if (!e || typeof e !== "object") continue;
    const { perDay, campaigns, days } = e;
    if (!Number.isInteger(perDay) || (perDay as number) < 0) continue;
    if (!Number.isInteger(campaigns) || (campaigns as number) < 1) continue;
    if (!Number.isInteger(days) || (days as number) < 1) continue;
    estimates[scope] = { perDay: perDay as number, campaigns: campaigns as number, days: days as number };
  }
  return { generated: l.generated, cohorts, estimates };
}

/** Lay a published live half over the card in force. Returns whether it
 * applied — false leaves the card exactly as it was. */
export function applyLive(live: unknown): boolean {
  const parsed = parseLive(live);
  if (!parsed) return false;
  // Ignore a doc older than the one in force: the only way that happens
  // is two reads racing, and the newer fold is the truer one.
  if (liveApplied && PRICING.generated > parsed.generated) return false;
  PRICING.generated = parsed.generated;
  PRICING.cohorts = parsed.cohorts;
  PRICING.estimates = parsed.estimates;
  liveApplied = true;
  notify();
  return true;
}

let liveApplied = false;
let liveLoading: Promise<boolean> | null = null;

/** Whether the figures in force are the published ones rather than the
 * committed fallback — the door says which. */
export const isLive = (): boolean => liveApplied;

/**
 * Read the published half once per session, when the door opens (live
 * builds only — the caller gates on LIVE.enabled, since this module must
 * not import the dispatcher). One getDoc, session-cached, never a
 * listener: the door is opened, not watched. A read that fails leaves
 * the committed card in force and says so through isLive().
 */
export function loadLiveCard(): Promise<boolean> {
  if (liveApplied) return Promise.resolve(true);
  if (liveLoading) return liveLoading;
  liveLoading = (async () => {
    try {
      const db = await getDb();
      const { doc, getDoc } = await getFirestoreApi();
      const snap = await getDoc(doc(db, "v2_meta", "pricing"));
      return snap.exists() ? applyLive(snap.data()) : false;
    } catch {
      return false;
    } finally {
      // A failed or empty read may be retried on the next open.
      liveLoading = null;
    }
  })();
  return liveLoading;
}

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
const notify = (): void => { subs.forEach((f) => f()); };

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
  notify();
};

/**
 * Re-render on anything a printed price depends on: the currency
 * preference, and since D366 the live half landing. One list, because
 * every subscriber is a component that prints a price and wants both.
 */
export const subscribeCur = (f: () => void): (() => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

// The purge (data/live.ts, D51): drop the preference with the account —
// a currency is small, but "the next account inherits nothing" is a rule,
// not a size threshold. Notify without re-creating the purged key. The
// published half is public and account-free, so it stays. The typeof
// guard is for node importers (the pricing scripts' tests import this
// module's arithmetic; a browser always has window).
if (typeof window !== "undefined") {
  window.addEventListener("insight:local-purge", () => { curCache = null; notify(); });
}

/**
 * The EXACT euro figure, for the one place a rounded one is a lie: the
 * control that charges it.
 *
 * `fmt` below rounds to a rate-card-shaped number on purpose — €288 reads
 * as €290 above one hundred — which is right for a price list and wrong
 * for the button. Stripe charges `Math.round(eur * 100)` cents in EUR
 * (functions/src/paid.ts), so an ad's flat price showed "Pay €290" over a
 * €288.00 debit, and at other legal index values the error runs the other
 * way: 1.01 quotes €323.20 and the button said €320, a buyer charged more
 * than the control they pressed.
 *
 * EUR always, and no `≈`: the charge is in euro whatever currency the
 * card elsewhere is showing, so converting here would put an
 * approximation on the one number that is exact.
 */
export const fmtExact = (eur: number): string => {
  const cents = Math.round(eur * 100);
  const whole = Math.trunc(cents / 100);
  const rest = Math.abs(cents % 100);
  const body = whole.toLocaleString("en-US").replace(/,/g, " ");
  return "€" + (rest ? `${body}.${String(rest).padStart(2, "0")}` : body);
};

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

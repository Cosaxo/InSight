// GENERATED from /content/pricing.json by scripts/gen-pricing-ts.mjs —
// do not hand-edit. Regenerate with `npm run build:pricing-ts`;
// `npm run check:pricing` compares this file against what /content
// generates, so a hand edit here (or a pricing change without a regen)
// fails the gate.
//
// The committed rate card (PAID-PLAN §6, D288 §3), embedded so the
// booking path can price server-side (D313). The client keeps reading
// content/pricing.json; this copy exists because a deployed function
// cannot reach that file and a price the server does not verify is a
// price the client picked.
export interface PricingCohort { idx: number; booked: number[]; crowd?: number[]; nextOpen: string | null }
export interface PricingCard {
  generated: string;
  currency: string;
  base: number;
  floorX: number;
  crowdStep: number;
  floorWeek: number;
  capEur: number;
  minEur: number;
  budgets: number[];
  fx: Record<string, number>;
  cohorts: Record<"city" | "country" | "world", PricingCohort>;
  estimates: Record<string, { perDay: number; campaigns: number; days: number; running?: number }>;
}
export const PRICING_CARD: PricingCard = {
 "generated": "2026-09-05",
 "currency": "EUR",
 "base": 0.02,
 "floorX": 1,
 "crowdStep": 0.5,
 "floorWeek": 500,
 "capEur": 50,
 "minEur": 5,
 "budgets": [
  5,
  10,
  20,
  50
 ],
 "fx": {
  "NOK": 11.6,
  "USD": 1.08
 },
 "cohorts": {
  "city": {
   "idx": 1,
   "booked": [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
   ],
   "crowd": [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
   ],
   "nextOpen": null
  },
  "country": {
   "idx": 1,
   "booked": [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
   ],
   "crowd": [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
   ],
   "nextOpen": null
  },
  "world": {
   "idx": 1,
   "booked": [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
   ],
   "crowd": [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0
   ],
   "nextOpen": null
  }
 },
 "estimates": {}
};

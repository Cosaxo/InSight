#!/usr/bin/env node
// build-ask-pricing.mjs — the adapter between the committed pricing card
// and the web ask door's page resource (D368 shape A).
//
//   node scripts/build-ask-pricing.mjs          # write web/ask-pricing.json
//   node scripts/build-ask-pricing.mjs --check  # fail if it is stale
//
// WHY AN ADAPTER AND NOT A RENAME. Claude Design's draft was fed a
// SHAPED pricing resource rather than `content/pricing.json`, so eight
// names and two structures differ (design/ask-2026-09-05/README.md has
// the table). The committed file is not the one to move: it is computed
// by `build-pricing.mjs` off the real purchase ledger and held by
// `check:pricing`, and renaming its fields to suit one page would break
// the fold that produces them and the gate that proves them. So the
// page gets its own resource, generated from the same numbers, and this
// file is where the two vocabularies meet.
//
// THE ONE FIELD THAT IS NOT A RENAME, and the reason this script exists
// as a script rather than as a paragraph telling somebody to be careful:
//
//   the design draws `refundDays` — 29 days
//   the pricing file's nearest field is `trailingDays` — 28
//
// They are different quantities. `trailingDays` is the demand-measurement
// lookback that `build-pricing.mjs` divides by; the 29 is `WINDOW_DAYS`
// in `functions/src/paid.ts`, the fixed serving window the closer
// actually refunds against. Wiring one to the other draws a page making
// a payment promise ONE DAY SHORTER than the money path keeps — a
// substitution that reads as correct in review, passes every type check,
// and is only visible to somebody who knows both meanings.
//
// So the window is read from the function's own constant, and the two
// are asserted to be different: if `trailingDays` is ever tuned to 29
// the equality would make this check vacuous, and the suite says so.
//
// The other direction matters too. `capEur`, `base`, `floorX`, `ceilX`
// and the cohort indices are the LEDGER's, refolded whenever a contract
// lands, so this file is generated rather than authored — a page quoting
// a price the ledger has moved past is the same class of error one
// document over.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE = "content/pricing.json";
export const TARGET = "web/ask-pricing.json";
export const WINDOW_SOURCE = "functions/src/paid.ts";

/**
 * The serving window, read from `paid.ts` rather than passed in.
 *
 * A regex over source is the weaker way to read a constant and it is the
 * right one here: the alternative is importing a module that pulls in
 * firebase-functions and a Stripe client to learn one integer. The
 * failure mode is the safe one — a rename or a reformat throws loudly
 * instead of returning a plausible number — and the suite pins that.
 */
export function windowDays(src) {
  const m = /export const WINDOW_DAYS\s*=\s*(\d+)\s*;/.exec(String(src ?? ""));
  if (!m) {
    throw new Error(
      `build-ask-pricing: could not read WINDOW_DAYS from ${WINDOW_SOURCE}. ` +
      "It is the refund promise the page prints; this script will not guess it " +
      "and must never fall back to pricing.json's trailingDays, which is a " +
      "different quantity one day shorter (see this file's header).",
    );
  }
  return Number(m[1]);
}

/**
 * The three scopes, in the order the ruler draws them, with the label a
 * buyer reads. `city` and `country` are the buyer's own — the profile
 * supplies the bucket and the booking validator refuses the ask without
 * it — so the page cannot print a place here and must not pretend to.
 */
export const SCOPES = [
  { key: "city", label: "Your city" },
  { key: "country", label: "Your country" },
  { key: "world", label: "Everyone" },
];

/**
 * Currency rows in the design's shape: symbol and placement, which
 * `content/pricing.json` does not carry because nothing else needs them.
 * EUR is absent there for a good reason — it is the base, so its rate is
 * 1 by definition rather than by measurement — and is added here.
 *
 * USD is deliberately NOT offered. The committed file carries a rate for
 * it, but the door prices in EUR and the buyer's own currency, and a
 * third option on a two-button switch is a control nobody asked for
 * (COPY.md: a word the reader does not need is a deletion).
 */
export const CURRENCIES = [
  { code: "EUR", sym: "€", pre: true, rate: 1 },
  { code: "NOK", sym: "kr", pre: false },
];

export function buildAskPricing(pricing, paidSrc) {
  const P = pricing || {};
  const days = windowDays(paidSrc);
  const trailing = Number(P.trailingDays);
  // Stated as a property rather than trusted: see the header. If these
  // ever coincide, the distinction this script exists to keep is no
  // longer observable and somebody has to look again.
  const windowEqualsTrailing = days === trailing;

  const cohorts = SCOPES.map(({ key, label }) => ({
    key,
    label,
    index: Number(P.cohorts?.[key]?.idx),
  }));
  for (const c of cohorts) {
    if (!Number.isFinite(c.index)) {
      throw new Error(`build-ask-pricing: ${SOURCE} has no demand index for the "${c.key}" cohort`);
    }
  }

  const fx = {};
  for (const { code, sym, pre, rate } of CURRENCIES) {
    const r = rate ?? Number(P.fx?.[code]);
    if (!Number.isFinite(r)) {
      throw new Error(`build-ask-pricing: ${SOURCE} has no fx rate for ${code}`);
    }
    fx[code] = { sym, rate: r, pre };
  }

  return {
    // Provenance first, because the page prints it: a buyer reading a
    // price is told which committed file it came from and when.
    source: SOURCE,
    committed: String(P.generated ?? ""),
    perAnswerBaseEur: Number(P.base),
    capEur: Number(P.capEur),
    adBaseEur: Number(P.adBase),
    floorIndex: Number(P.floorX),
    ceilingIndex: Number(P.ceilX),
    refundDays: days,
    windowEqualsTrailing,
    cohorts,
    fx,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = process.argv.includes("--check");
  const pricing = JSON.parse(readFileSync(join(ROOT, SOURCE), "utf8"));
  const paidSrc = readFileSync(join(ROOT, WINDOW_SOURCE), "utf8");
  const built = `${JSON.stringify(buildAskPricing(pricing, paidSrc), null, 1)}\n`;

  if (built.includes(`"windowEqualsTrailing": true`)) {
    console.error(
      `build-ask-pricing: WINDOW_DAYS and ${SOURCE}'s trailingDays are both ` +
      `${pricing.trailingDays}. They are different quantities that happen to ` +
      "agree, so the substitution this script guards against is currently " +
      "invisible. Read this file's header before changing either.",
    );
  }

  if (check) {
    let live = null;
    try {
      live = readFileSync(join(ROOT, TARGET), "utf8");
    } catch {
      /* absent is stale */
    }
    if (live !== built) {
      console.error(
        `check:ask-pricing — ${TARGET} does not match ${SOURCE} + ${WINDOW_SOURCE}.\n\n` +
        "  The web ask door reads this file for every price it prints, and it is\n" +
        "  generated rather than authored. Regenerate it:\n\n" +
        "    npm run build:ask-pricing\n\n" +
        "  and commit the result in the same change as whatever moved the card.",
      );
      process.exit(1);
    }
    console.log(`check:ask-pricing OK — ${TARGET} matches the committed card (window ${JSON.parse(built).refundDays}d, cap €${JSON.parse(built).capEur}).`);
  } else {
    writeFileSync(join(ROOT, TARGET), built);
    console.log(`build-ask-pricing: wrote ${TARGET} — window ${JSON.parse(built).refundDays}d, cap €${JSON.parse(built).capEur}, card of ${JSON.parse(built).committed}.`);
  }
}

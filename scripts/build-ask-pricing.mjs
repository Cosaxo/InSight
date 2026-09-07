#!/usr/bin/env node
// build-ask-pricing.mjs — the adapter between the committed pricing card
// and the web ask door's page resource (D368 shape A; D376–D378 moved the
// menu, the places and the link onto it).
//
//   node scripts/build-ask-pricing.mjs          # write web/ask-pricing.json
//   node scripts/build-ask-pricing.mjs --check  # fail if it is stale
//
// WHY AN ADAPTER AND NOT A RENAME. Claude Design's draft was fed a
// SHAPED pricing resource rather than `content/pricing.json`, so the
// names and two structures differ (design/ask-2026-09-05/README.md has
// the table). The committed file is not the one to move: it is computed
// by `build-pricing.mjs` and the server's own fold off the real purchase
// ledger (D371) and held by `check:pricing`, and renaming its fields to
// suit one page would break the fold that produces them and the gate
// that proves them. So the page gets its own resource, generated from
// the same numbers, and this file is where the two vocabularies meet.
//
// THE WINDOW IS ON THE CARD NOW. Until D376 this script read the refund
// window off `functions/src/paid.ts`'s `WINDOW_DAYS` by regex, because
// the card's nearest-looking field — `trailingDays`, the demand
// lookback — was a different quantity one day shorter, and wiring the
// page to it would have drawn a payment promise the money path does not
// keep. D373 retired the lookback and D376 put `windowDays` on the card
// as the one number the server's `WINDOW_DAYS` and every door read; the
// substitution this script guarded against has no field left to be made
// with. It still refuses a card without the number rather than guessing.
//
// THE DENSITY IS THE APP'S. `paidEvery` — a paid card after every this
// many world cards (D377) — is `SPONSOR_EVERY` in `src/v2/data/sponsored.ts`,
// where the feed places the cards. Read by regex over the source for the
// reason the window used to be: the alternative is importing a client
// module to learn one integer, and a rename throws loudly here rather
// than returning a plausible number.
//
// The rest — base, floor, step, the free places, budgets, the menu, the
// cohort indices and their crowd strips — is the LEDGER's, refolded on
// every sale, so this file is generated rather than authored: a page
// quoting a price the ledger has moved past is the same class of error
// one document over.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE = "content/pricing.json";
export const TARGET = "web/ask-pricing.json";
export const PLACES_SOURCE = "src/v2/data/sponsored.ts";

/** The feed's paid-card density, read from the module that places them. */
export function paidEvery(src) {
  const m = /export const SPONSOR_EVERY\s*=\s*(\d+)\s*;/.exec(String(src ?? ""));
  if (!m) {
    throw new Error(
      `build-ask-pricing: could not read SPONSOR_EVERY from ${PLACES_SOURCE}. ` +
      "It is the density the page prints beside the free places; this script " +
      "will not guess it.",
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

const wholeAtLeast = (v, min) => Number.isInteger(v) && v >= min;

export function buildAskPricing(pricing, sponsoredSrc) {
  const P = pricing || {};
  const days = P.windowDays;
  if (!wholeAtLeast(days, 1)) {
    throw new Error(
      `build-ask-pricing: ${SOURCE} carries no windowDays — the refund window the page ` +
      "prints is the card's (D376), and this script will not guess it.",
    );
  }
  const every = paidEvery(sponsoredSrc);

  const cohorts = SCOPES.map(({ key, label }) => {
    const c = P.cohorts?.[key] || {};
    const crowd = Array.isArray(c.crowd) ? c.crowd.map(Number) : Array.isArray(c.booked) ? c.booked.map((b) => (b ? 1 : 0)) : null;
    return { key, label, index: Number(c.idx), crowd };
  });
  for (const c of cohorts) {
    if (!Number.isFinite(c.index)) {
      throw new Error(`build-ask-pricing: ${SOURCE} has no demand index for the "${c.key}" cohort`);
    }
    if (!c.crowd || c.crowd.length !== 14 || c.crowd.some((n) => !Number.isInteger(n) || n < 0)) {
      throw new Error(`build-ask-pricing: ${SOURCE} has no fortnight crowd strip for the "${c.key}" cohort`);
    }
  }

  const budgets = Array.isArray(P.budgets) ? P.budgets.map(Number) : [];
  if (!budgets.length || budgets.some((b) => !wholeAtLeast(b, 1))) {
    throw new Error(`build-ask-pricing: ${SOURCE} has no budget presets`);
  }
  const menu = {};
  for (const { key } of SCOPES) {
    const m = Number(P.menu?.[key]);
    // The menu price is one of the chips, so a row opens the composer on
    // a budget the buyer can see pressed — check:pricing holds the card
    // to this and this holds the page to the card.
    if (!budgets.includes(m)) {
      throw new Error(`build-ask-pricing: ${SOURCE}'s menu price for "${key}" (${P.menu?.[key]}) is not one of its budget presets`);
    }
    menu[key] = m;
  }

  const fx = {};
  for (const { code, sym, pre, rate } of CURRENCIES) {
    const r = rate ?? Number(P.fx?.[code]);
    if (!Number.isFinite(r)) {
      throw new Error(`build-ask-pricing: ${SOURCE} has no fx rate for ${code}`);
    }
    fx[code] = { sym, rate: r, pre };
  }

  for (const [k, min] of [["base", 0], ["floorX", 0], ["crowdStep", 0], ["minEur", 1], ["capEur", 1]]) {
    if (!(Number(P[k]) >= min) || !Number.isFinite(Number(P[k]))) {
      throw new Error(`build-ask-pricing: ${SOURCE} has no usable ${k}`);
    }
  }
  if (!wholeAtLeast(P.crowdFree, 1)) throw new Error(`build-ask-pricing: ${SOURCE} has no crowdFree — the free places the page prints`);

  return {
    // Provenance first, because the page prints it: a buyer reading a
    // price is told which committed file it came from and when.
    source: SOURCE,
    committed: String(P.generated ?? ""),
    perAnswerBaseEur: Number(P.base),
    floorIndex: Number(P.floorX),
    crowdStep: Number(P.crowdStep),
    crowdFree: Number(P.crowdFree),
    minEur: Number(P.minEur),
    capEur: Number(P.capEur),
    budgets,
    menu,
    refundDays: days,
    paidEvery: every,
    cohorts,
    fx,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const pricing = JSON.parse(readFileSync(join(ROOT, SOURCE), "utf8"));
  const sponsoredSrc = readFileSync(join(ROOT, PLACES_SOURCE), "utf8");
  const out = buildAskPricing(pricing, sponsoredSrc);
  const built = `${JSON.stringify(out, null, 1)}\n`;

  if (check) {
    let live = null;
    try {
      live = readFileSync(join(ROOT, TARGET), "utf8");
    } catch {
      /* absent is stale */
    }
    if (live !== built) {
      console.error(
        `check:ask-pricing — ${TARGET} does not match ${SOURCE} + ${PLACES_SOURCE}.\n\n` +
        "  The web ask door reads this file for every price it prints, and it is\n" +
        "  generated rather than authored. Regenerate it:\n\n" +
        "    npm run build:ask-pricing\n\n" +
        "  and commit the result in the same change as whatever moved the card.",
      );
      process.exit(1);
    }
    console.log(`check:ask-pricing OK — ${TARGET} matches the committed card (window ${out.refundDays}d, menu €${out.menu.city} · €${out.menu.country} · €${out.menu.world}, ${out.crowdFree} free places, one card in ${out.paidEvery}).`);
  } else {
    writeFileSync(join(ROOT, TARGET), built);
    console.log(`build-ask-pricing: wrote ${TARGET} — window ${out.refundDays}d, menu €${out.menu.city} · €${out.menu.country} · €${out.menu.world}, card of ${out.committed}.`);
  }
}

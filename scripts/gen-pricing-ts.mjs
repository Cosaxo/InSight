#!/usr/bin/env node
// gen-pricing-ts.mjs — regenerates functions/src/pricing.ts from
// content/pricing.json, the same relationship gen-v2content.mjs keeps for
// the question bank: /content is the artifact people edit and diff, the
// functions copy is transport, and a gate (check:pricing, extended for
// this) compares them byte-for-byte so neither can drift from the other.
//
// Why the functions tree needs the rate card at all (D313): the booking
// path prices a paid question SERVER-SIDE — the client's figure is
// display, never the invoice — and a Cloud Function cannot read a repo
// file outside its own deploy bundle at runtime. Importing the JSON
// across the package boundary breaks the functions tsconfig rootDir, so
// the card is embedded as a generated module instead, exactly as the
// question bank is.
//
// Run: node scripts/gen-pricing-ts.mjs           (check mode — exits 1 on drift)
//      node scripts/gen-pricing-ts.mjs --write   (regenerate)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(root, "content", "pricing.json");
const OUT = resolve(root, "functions", "src", "pricing.ts");

export function generatePricingTs(json) {
  // Parse-and-restringify so the embedded copy is normalised the same way
  // however the JSON file happens to be formatted.
  const data = JSON.parse(json);
  return (
    "// GENERATED from /content/pricing.json by scripts/gen-pricing-ts.mjs —\n" +
    "// do not hand-edit. Regenerate with `npm run build:pricing-ts`;\n" +
    "// `npm run check:pricing` compares this file against what /content\n" +
    "// generates, so a hand edit here (or a pricing change without a regen)\n" +
    "// fails the gate.\n" +
    "//\n" +
    "// The committed rate card (PAID-PLAN §6, D288 §3), embedded so the\n" +
    "// booking path can price server-side (D313). The client keeps reading\n" +
    "// content/pricing.json; this copy exists because a deployed function\n" +
    "// cannot reach that file and a price the server does not verify is a\n" +
    "// price the client picked.\n" +
    "export interface PricingCohort { idx: number; booked: number[]; nextOpen: string | null }\n" +
    "export interface PricingCard {\n" +
    "  generated: string;\n" +
    "  currency: string;\n" +
    "  base: number;\n" +
    "  floorX: number;\n" +
    "  ceilX: number;\n" +
    "  floorWeek: number;\n" +
    "  capEur: number;\n" +
    "  minEur: number;\n" +
    "  budgets: number[];\n" +
    "  adBase: number;\n" +
    "  fx: Record<string, number>;\n" +
    "  trailingDays: number;\n" +
    "  cohorts: Record<\"city\" | \"country\" | \"world\", PricingCohort>;\n" +
    "  estimates: Record<string, { perDay: number; campaigns: number; days: number; running?: number }>;\n" +
    "}\n" +
    "export const PRICING_CARD: PricingCard = " +
    JSON.stringify(data, null, 1) +
    ";\n"
  );
}

const isEntry = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isEntry) {
  const json = readFileSync(SRC, "utf8");
  const generated = generatePricingTs(json);
  const write = process.argv.includes("--write");
  const current = existsSync(OUT) ? readFileSync(OUT, "utf8") : null;
  if (write) {
    if (current === generated) {
      console.log(`gen-pricing-ts: ${OUT} already up to date`);
    } else {
      writeFileSync(OUT, generated);
      console.log(`gen-pricing-ts: wrote ${OUT} (${generated.length} chars)`);
    }
  } else if (current !== generated) {
    console.error(
      "gen-pricing-ts: functions/src/pricing.ts is out of sync with content/pricing.json — " +
        "run `npm run build:pricing-ts` and commit the result.",
    );
    process.exit(1);
  } else {
    console.log(`gen-pricing-ts: ${OUT} in sync (${generated.length} chars)`);
  }
}

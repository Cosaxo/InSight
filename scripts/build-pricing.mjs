// build-pricing.mjs — fold the purchase ledger into the rate card BY HAND:
// publish the live half onto `v2_meta/pricing` and snapshot the whole card
// into content/pricing.json (PAID-PLAN §6, D288 §3, D366).
//
//   npm run build --prefix functions          # once — the fold is compiled from functions/src
//   node scripts/build-pricing.mjs --project prvfire33
//   node scripts/build-pricing.mjs --emulator
//
// Needs admin credentials (GOOGLE_APPLICATION_CREDENTIALS or `gcloud auth
// application-default login`), or --emulator with the Firestore emulator up.
//
// WHEN TO RUN IT. Since D366 the server folds the ledger itself — the
// payment webhook after every self-serve sale, the nightly closer every
// day — so the self-serve loop never needs this script. It exists for
// the sales the machinery does not carry: a contract recorded with
// scripts/record-purchase.mjs moves the index at the next nightly fold,
// or now, with this. And it is how the COMMITTED snapshot is refreshed:
// content/pricing.json is the fallback a demo build, a fresh deployment
// and a failed read print, and a snapshot from before the first sale is
// an honest fallback for exactly as long as nobody minds it being old.
//
// ONE ARITHMETIC. This script used to carry its own copy of the fold,
// which is how the index came to depend on somebody remembering to run
// it (D366's finding). It now imports the compiled fold the server runs
// — functions/lib/pricingFold.js, the same relationship the e2e harness
// and scripts/report-lib.mjs already have with functions/lib — so what an
// operator publishes by hand and what the webhook publishes at 03:00 are
// the same function over the same rows. The constants come FROM the
// committed file, so a deliberate re-pricing is an edit to pricing.json
// reviewed in a PR — this script only ever moves the demand-derived
// fields, and `npm run check:pricing` then asks for the functions embed
// to be regenerated (`npm run build:pricing-ts`) in the same commit.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { adminDb } from "./admin-db.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(root, "content/pricing.json");
const FOLD = resolve(root, "functions/lib/pricingFold.js");

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
};
const die = (msg) => { console.error(`build-pricing: ${msg}`); process.exit(1); };

const emulator = flag("emulator");
const projectId = opt("project") || (emulator ? "demo-insight" : undefined);
if (!projectId) die("--project is required (or --emulator)");
if (emulator && !process.env.FIRESTORE_EMULATOR_HOST) {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
}
if (!existsSync(FOLD)) die("functions/lib/pricingFold.js is not built — run `npm run build --prefix functions` first (the fold is the server's, compiled from functions/src/pricingFold.ts)");
const { foldPricing, PRICING_SCOPES } = await import(pathToFileURL(FOLD).href);

// NAMES THE DATABASE. `getFirestore()` binds to `(default)`, which this
// app does not use and which no longer exists — see scripts/admin-db.mjs.
const db = adminDb({ projectId, emulator });

const prev = JSON.parse(readFileSync(OUT, "utf8"));
const { base, floorX, ceilX, adBase } = prev;
if (!(base > 0) || !(floorX > 0) || !(ceilX >= floorX)) die("pricing.json constants are out of shape — fix the file first");
if (!(adBase > 0)) die("adBase must be a positive flat window figure (D315) — fix the file first");

const today = new Date().toISOString().slice(0, 10);
// The same bound the server's fold reads (paid.ts publishPricing): every
// row that ended inside the last year or has not ended yet.
const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - 366 * 86400000).toISOString().slice(0, 10);
const snap = await db.collection("v2_purchases").where("window.until", ">=", cutoff).limit(1000).get();
const rows = snap.docs.map((d) => d.data());
const live = foldPricing(prev, rows, today);

await db.collection("v2_meta").doc("pricing").set({ ...live, at: new Date() });

const out = {
  ...prev,
  generated: live.generated,
  cohorts: live.cohorts,
  estimates: live.estimates,
};
writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
console.log(`published v2_meta/pricing and wrote content/pricing.json — ${rows.length} purchase row(s) folded for ${today}`);
for (const scope of PRICING_SCOPES) {
  const c = live.cohorts[scope];
  const e = live.estimates[scope];
  console.log(`  ${scope}: idx ×${c.idx} · ${c.booked.filter(Boolean).length} of ${c.booked.length} days booked · next open ${c.nextOpen || "tomorrow"}${e ? ` · ≈${e.perDay}/day over ${e.campaigns} campaign(s)` : " · no completed campaign — no estimate"}`);
}
console.log("\nCommit the changed pricing.json and run `npm run build:pricing-ts` — the committed file is the fallback the door prints before the live card lands, and check:pricing holds the functions embed to it.");

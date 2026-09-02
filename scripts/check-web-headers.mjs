#!/usr/bin/env node
// check-web-headers.mjs — every page under web/ gets security headers.
//
// WHY THIS EXISTS, in the words of the commit that created the hole.
// 6bf8ee1e (2026-08-25) replaced a `**/*.@(html)` glob in firebase.json
// with two enumerated `source` lists, and said so plainly:
//
//   "The cost of enumerating is that a NEW page under web/ gets no headers
//    until it is added here. That wants a gate … and I have left it on the
//    night's list rather than half-wiring one."
//
// Four pages were added in the following week and none of them was added
// to the list: the GDPR erasure page privacy.html links to and Play
// requires, and the three Stripe return pages. Measured on the hosting
// emulator against the committed config, all four served with no nosniff,
// no Referrer-Policy and no CSP. This is that gate, a week late.
//
// WHAT IT DOES NOT DO. It does not evaluate Firebase's glob language —
// that would be a second implementation of somebody else's matcher, and
// wrong in a way nothing here could see. It reads the page NAMES out of
// the source patterns, which is all the enumerated form contains, and
// asks whether every file on disk is one of them. A future config that
// goes back to a real glob will fail this loudly rather than silently,
// and the fix then is to teach this script that shape on purpose.
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(join(root, "firebase.json"), "utf8"));
const hosting = Array.isArray(cfg.hosting) ? cfg.hosting[0] : cfg.hosting;
const publicDir = hosting?.public || "web";

const pages = readdirSync(join(root, publicDir)).filter((f) => f.endsWith(".html"));
if (!pages.length) {
  console.error(`check:web-headers: no .html under ${publicDir}/ — the public dir moved; fix this script.`);
  process.exit(1);
}

const rules = hosting?.headers || [];
if (!rules.length) {
  console.error("check:web-headers: firebase.json declares no hosting headers at all.");
  process.exit(1);
}

// Every page name any source pattern mentions. `/` is the site root, which
// the rewrite sends to a real page — read that rather than assuming
// home.html, so a site that re-roots does not quietly lose a header.
const rootTarget = (hosting.rewrites || [])
  .find((r) => r.source === "/")?.destination?.replace(/^\//, "");
const covered = new Set();
for (const rule of rules) {
  const src = String(rule.source || "");
  for (const m of src.matchAll(/([A-Za-z0-9_-]+)\.html/g)) covered.add(`${m[1]}.html`);
  // …and the split spelling, where the brace separates the name from its
  // extension: `/join{.html,/**}` names join.html and would otherwise read
  // as no page at all.
  for (const m of src.matchAll(/\/([A-Za-z0-9_-]+)\{\.html/g)) covered.add(`${m[1]}.html`);
  if (/(^|[{,])\/([},]|$)/.test(src) && rootTarget) covered.add(rootTarget);
}

const bare = pages.filter((p) => !covered.has(p));
if (bare.length) {
  console.error(
    "check:web-headers: page(s) under web/ carry no security headers:\n"
    + bare.map((p) => `  - ${p}`).join("\n")
    + "\n\n  Add each to a `source` list in firebase.json's hosting.headers."
    + "\n  A page with no CSP, no nosniff and no Referrer-Policy is served to"
    + "\n  real visitors — delete-account.html is the erasure route Play"
    + "\n  requires — and nothing about the page itself says so.",
  );
  process.exit(1);
}

console.log(
  `check:web-headers OK — ${pages.length} page(s) under ${publicDir}/, `
  + `all covered by a hosting headers rule.`,
);

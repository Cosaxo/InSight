// Are the store-facing pages actually fillable-in and filled in?
//
//   npm run check:store-copy
//
// Deliberately NOT in CI, and that is the whole design. The placeholders
// this catches are unfilled *today*, so wiring it into ci.yml would red
// the tree immediately and the first response would be to delete the
// check. It is a pre-submission gate instead: docs/SHIP-CHECKLIST.md runs
// it before a store upload, when the values are known.
//
// Why it exists at all: privacy.html routes GDPR erasure requests to "the
// support address listed on the terms of service page", and that address
// was `[support email — set before launch]`. A user exercising a legal
// right lands on a bracket. Nothing was watching, because a placeholder in
// shipped HTML looks exactly like prose to every other gate in this repo.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Bracketed markers of the form [... set before launch] / [TODO ...] etc.
const PLACEHOLDER = /\[[^\]\n]*\b(set before launch|TBD|TODO|FIXME|placeholder|your [a-z ]+ here)\b[^\]\n]*\]/gi;

const PAGES = ["public/terms.html", "public/privacy.html"];

let problems = 0;

for (const rel of PAGES) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    console.error(`check-store-copy: ${rel} is missing — the store listings link to it.`);
    problems++;
    continue;
  }
  const src = readFileSync(path, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    for (const m of line.matchAll(PLACEHOLDER)) {
      console.error(`check-store-copy: ${rel}:${i + 1} unfilled placeholder ${m[0]}`);
      problems++;
    }
  });
}

if (problems) {
  console.error(
    `\ncheck-store-copy: ${problems} placeholder(s) still in the store-facing pages.\n` +
    `These are legal facts — the operating entity, its jurisdiction and a\n` +
    `real monitored support address that GDPR erasure requests reach. They\n` +
    `cannot be guessed; fill them in public/terms.html before submitting.`,
  );
  process.exit(1);
}

console.log(`check-store-copy OK — no unfilled placeholders in ${PAGES.length} store-facing pages.`);

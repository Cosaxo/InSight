#!/usr/bin/env node
// check-csp-hashes.mjs — every `'sha256-…'` in firebase.json's CSP is the
// hash of a script that is actually in the page it covers.
//
// WHY THIS EXISTS. Two pages under web/ carry an inline <script> and are
// served under `script-src 'sha256-…'` with the digest written by hand
// into firebase.json. A hash and the file it covers are in different
// files, in different languages, and nothing joined them — so editing a
// page silently invalidated its own policy.
//
// AND THE FAILURE IS SILENT IN THE WORST WAY. A wrong hash does not warn,
// does not 500, and does not appear in any test: the browser refuses the
// script and the page renders as a form that does nothing. It looks like
// the page loaded. Every gate here would still be green — `check:docs`
// reads documents, `check:web-headers` deliberately reads header KEYS and
// not values ("a CSP is a policy, and this gate is not the place to hold
// one"), and no suite mounts a hosted page at all.
//
// A hash is the one part of a CSP that is not a policy: it is a checksum
// of a file in this repo, so it is a FIGURE, and this repo's rule for a
// figure is that a script computes it rather than a person maintaining it
// (`check:figures`, D39). Same rule, one file over.
//
// WHAT IT DOES NOT DO. It does not evaluate Firebase's glob language, for
// the reason check-web-headers.mjs gives at length: that would be a second
// implementation of somebody else's matcher, wrong in a way nothing here
// could see. It reads page names out of the `source` pattern the same way
// that gate does, and the two share the shape on purpose.

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Every inline <script> body in a page, in order. Scripts with a `src`
 *  are not inline and carry no hash, so they are skipped. */
export function inlineScripts(html) {
  const out = [];
  const re = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(String(html ?? "")))) out.push(m[1]);
  return out;
}

/** The CSP hash of one script body. Base64 of the sha256 of the bytes
 *  BETWEEN the tags, exactly as the browser computes it — no trimming,
 *  which is the mistake that makes a hand-computed hash wrong. */
export function cspHash(body) {
  return `sha256-${createHash("sha256").update(String(body), "utf8").digest("base64")}`;
}

/** The `'sha256-…'` tokens a rule's script-src names. */
export function hashesIn(rule) {
  const csp = (rule?.headers || []).find((h) => String(h?.key || "") === "Content-Security-Policy");
  const value = String(csp?.value ?? "");
  return [...value.matchAll(/'(sha256-[A-Za-z0-9+/=]+)'/g)].map((m) => m[1]);
}

/** Page names a rule's source pattern refers to — the two spellings
 *  firebase.json uses, kept identical to check-web-headers.mjs. */
export function pagesIn(source) {
  const src = String(source || "");
  const out = new Set();
  for (const m of src.matchAll(/\/?((?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+)\.html/g)) out.add(`${m[1]}.html`);
  for (const m of src.matchAll(/\/([A-Za-z0-9_-]+)\{\.html/g)) out.add(`${m[1]}.html`);
  return [...out];
}

/**
 * The whole check, pure so it can be executed: for every rule that pins a
 * hash, every hash must match some inline script in some page that rule
 * covers, and every inline script in those pages must be pinned.
 *
 * BOTH DIRECTIONS MATTER. A pinned hash nothing matches is a dead page.
 * An unpinned script is a page whose script the CSP refuses — the same
 * outage, arrived at from the other side, and the one an "is my hash
 * listed" check would miss.
 */
export function checkHashes({ rules, readPage, pageExists }) {
  const problems = [];
  for (const rule of rules) {
    const pinned = hashesIn(rule);
    const pages = pagesIn(rule.source).filter(pageExists);
    if (!pinned.length && !pages.length) continue;

    const actual = new Map();
    for (const page of pages) {
      for (const body of inlineScripts(readPage(page))) actual.set(cspHash(body), page);
    }
    if (!pinned.length && actual.size) {
      problems.push(
        `${pages.join(", ")} has an inline <script> and its CSP pins no hash, so the\n` +
        `  browser refuses it. Add to script-src: '${[...actual.keys()][0]}'`,
      );
      continue;
    }
    const orphaned = pinned.filter((h) => !actual.has(h));
    const unpinned = [...actual].filter(([h]) => !pinned.includes(h));

    // The ordinary case — a page was edited — makes BOTH lists non-empty
    // out of one fact, so it is reported once with the replacement in it.
    // Splitting it in two would print the same edit as two failures and
    // send the reader hunting for a second thing to fix.
    if (orphaned.length && unpinned.length) {
      problems.push(
        `${unpinned.map(([, p]) => p).join(", ")} was edited and its rule (${rule.source}) still pins the old hash.\n` +
        `  pinned:  '${orphaned.join("'\n           '")}'\n` +
        `  current: '${unpinned.map(([h]) => h).join("'\n           '")}'`,
      );
      continue;
    }
    for (const h of orphaned) {
      problems.push(
        `'${h}' in the rule for ${rule.source} matches no inline script in\n` +
        `  ${pages.length ? pages.join(", ") : "(no page this rule names exists)"}.\n` +
        "  That page has no inline script at all — the hash is left over.",
      );
    }
    for (const [h, page] of unpinned) {
      problems.push(`${page}'s inline script is not pinned by its own rule. Add to script-src: '${h}'`);
    }
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const cfg = JSON.parse(readFileSync(join(root, "firebase.json"), "utf8"));
  const hosting = Array.isArray(cfg.hosting) ? cfg.hosting[0] : cfg.hosting;
  const web = join(root, hosting.public || "web");

  const problems = checkHashes({
    rules: hosting.headers || [],
    readPage: (p) => readFileSync(join(web, p), "utf8"),
    pageExists: (p) => existsSync(join(web, p)),
  });

  if (problems.length) {
    console.error("check-csp-hashes — a pinned script hash does not match its page.\n");
    for (const p of problems) console.error(`  ${p}\n`);
    console.error(
      "  This does not fail loudly in a browser: the script is simply refused and\n" +
      "  the page renders as a form that does nothing. Fix the hash in firebase.json.\n",
    );
    process.exit(1);
  }

  const pinned = (hosting.headers || []).reduce((n, r) => n + hashesIn(r).length, 0);
  console.log(`check-csp-hashes OK — ${pinned} pinned script hash(es) match their pages.`);
}

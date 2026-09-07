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
//
// AND IT READS THE HEADERS, which it did not until tonight. "Covered"
// meant a page was NAMED in some rule's `source`, whatever that rule set:
// firebase.json has a third rule that sets only Content-Type (the
// apple-app-site-association route), so moving delete-account.html into
// it — Play's erasure route, then served with no CSP, no nosniff and no
// Referrer-Policy — passed, exit 0. So did renaming all three header keys
// at once, which takes every header off every page. Measured, both. A
// gate whose error text names nosniff has to look at whether nosniff is
// there.
//
// Values are not checked, only keys — a CSP is a policy, and this gate is
// not the place to hold one. `nosniff` is the exception and is asserted,
// because X-Content-Type-Options has exactly one valid value and the
// error text above promises it.
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The three headers a page under web/ has to carry, and the one value
 * worth asserting. Keys, not policies — see the header note.
 */
export const REQUIRED = ["X-Content-Type-Options", "Referrer-Policy", "Content-Security-Policy"];

/** Does this rule actually set all three, with nosniff spelled right? */
export function ruleIsSecure(rule) {
  const set = new Map((rule?.headers || []).map((h) => [String(h?.key || ""), String(h?.value ?? "")]));
  if (!REQUIRED.every((k) => set.has(k))) return false;
  return /(^|[\s,])nosniff(\s|,|$)/i.test(set.get("X-Content-Type-Options"));
}

/**
 * Page names covered by a rule that carries the security headers.
 *
 * EXPORTED and pure so it can be executed: this whole file used to be
 * top-level statements, so no test could reach any of it, and the hole
 * below was one `rule.source` read with `rule.headers` never opened.
 */
export function securedPages(rules, rootTarget) {
  const covered = new Set();
  for (const rule of rules) {
    if (!ruleIsSecure(rule)) continue;
    const src = String(rule.source || "");
    // Nested paths too, now that the walk is recursive: a page found as
    // `legal/tos.html` has to be matchable against a rule that names
    // `/legal/tos.html`, or the recursion would turn every nested page
    // into a false failure instead of a caught one.
    for (const m of src.matchAll(/\/?((?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+)\.html/g)) {
      covered.add(`${m[1]}.html`);
    }
    // …and the split spelling, where the brace separates the name from its
    // extension: `/join{.html,/**}` names join.html and would otherwise read
    // as no page at all.
    for (const m of src.matchAll(/\/([A-Za-z0-9_-]+)\{\.html/g)) covered.add(`${m[1]}.html`);
    if (/(^|[{,])\/([},]|$)/.test(src) && rootTarget) covered.add(rootTarget);
  }
  return covered;
}

// Only when RUN, so a test can import the two functions above without
// this reading firebase.json, walking web/ and calling process.exit.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const cfg = JSON.parse(readFileSync(join(root, "firebase.json"), "utf8"));
  const hosting = Array.isArray(cfg.hosting) ? cfg.hosting[0] : cfg.hosting;
  const publicDir = hosting?.public || "web";

  // RECURSIVE, because Hosting serves the whole tree. This read the top
  // level only, so a page in any subdirectory of web/ was served with no
  // CSP, no nosniff and no Referrer-Policy and the gate did not even
  // count it — this gate's own founding failure ("a NEW page under web/
  // gets no headers"), one directory down.
  //
  // LATENT, NOT SHIPPED, and the comment here said otherwise. It named
  // `web/legal/tos.html` as a page that "was served" without headers.
  // There is no such file and never has been — the measurement was made
  // by dropping a throwaway page at that path, watching the gate report 8
  // and stay green, and deleting it. web/ holds 8 pages today and all 8
  // are top level. Naming a probe as though it were the site is how a
  // reader goes looking for an incident that did not happen, and this
  // gate exists to stop exactly that kind of claim about headers.
  //
  // Paths are kept relative to the public dir and slash-separated, because
  // that is how a hosting `source` pattern names them.
  const pages = readdirSync(join(root, publicDir), { recursive: true })
    .map((f) => String(f).split(sep).join("/"))
    .filter((f) => f.endsWith(".html"));
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

  const bare = pages.filter((p) => !securedPages(rules, rootTarget).has(p));
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
    + `each named in a rule that sets ${REQUIRED.join(", ")}.`,
  );
}

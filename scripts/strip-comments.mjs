#!/usr/bin/env node
// strip-comments.mjs — blank JS/TS comments out of a source string.
//
// WHY IT IS ITS OWN MODULE. Four gates need it and each had its own copy:
// spec-globals.mjs, check-labels.mjs, check-purge-listeners.mjs and
// check-appcheck.mjs, byte-identical. Only one of them explained the copy,
// and its reason was real but narrower than the copy it justified:
// check-appcheck.mjs runs on backend-checks.yml, which firebase-deploy.yml
// calls, and importing spec-globals.mjs would have made a DEPLOY gate fail
// if src/v2/spec moved — that module scans the whole client spec layer at
// import time. The objection is to that module, not to importing.
//
// So this file does NO top-level work: it reads nothing, scans nothing, and
// touches no directory. Importing it cannot fail because a directory moved.
// That is the property the deploy path needs, and it is why the extraction
// is safe for all four.
//
// BLANKING, NOT DELETING, and that is the whole design. Every caller reports
// a line and column back to a human, and several index into the string after
// stripping. Replacing a comment with spaces of the same length keeps every
// offset and every line number pointing at the real file; deleting would
// shift them all and make each gate's output subtly wrong.
//
// What it is NOT: a parser. A `//` inside a string literal is left alone
// only when preceded by `:` (the `https://` case these gates actually hit).
// Every consumer is a static scanner over source it also greps by regex, so
// the trade is deliberate — an exact answer would need a tokenizer, and a
// tokenizer is a much larger thing to get wrong.

/**
 * The XML/HTML half of the same job, for the gates that read `Info.plist`,
 * `web/*.html` and the store forms.
 *
 * IT IS THE SAME DEFECT IN A SECOND SYNTAX, and this tree has now met it
 * on both sides. `check-policy-claims` records finding it in 2026 — "a
 * disclosure wrapped in `<!-- … -->` still counted as present" — and
 * `check-public-copy` strips for the same reason. The two gates that read
 * the iOS plist did not: `check-ios-location`'s `plistValue` scanned for
 * `<key>NAME</key>` with `indexOf` over raw bytes, so a key inside a
 * comment read exactly like a live one, and `check-store-forms` allowed a
 * comment BETWEEN key and value while reading the first `<key>` wherever
 * it was. Commenting out a location purpose string left both green — one
 * of them the gate that exists because omitting it returns ITMS-90683 by
 * email a build number later, the other a store attestation.
 *
 * Blanking rather than deleting, for the reason the JS stripper gives:
 * every caller reports an offset back to a human.
 *
 * Not a parser, same trade as its sibling. `<!--` inside a CDATA section or
 * an attribute value would be treated as a comment; neither occurs in the
 * files these gates read, and an exact answer needs a real XML parser.
 *
 * @param {string} src source text
 * @returns {string} the same text, same length, comments replaced by spaces
 */
export function stripXmlComments(src) {
  return src.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
}

/**
 * @param {string} src source text
 * @returns {string} the same text, same length, comments replaced by spaces
 */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

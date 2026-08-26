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
 * @param {string} src source text
 * @returns {string} the same text, same length, comments replaced by spaces
 */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

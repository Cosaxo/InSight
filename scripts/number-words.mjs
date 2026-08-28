// Small counts as English words, for check-figures.mjs's suggested fixes.
//
// WHY THIS IS GENERATED. check-figures kept a hand-written table: 1-12 and
// 114-136, with 115-119 missing. The daily bank was at 130 and the
// question farm promotes two per run, so at 137 the lookup would miss,
// the suggestion would fall back to the DIGITS, and the sentence it
// suggests writing into docs/MIRROR.md is matched by a pattern that
// accepts letters only. Apply that suggested fix and the gate fails
// DIFFERENTLY — telling you to delete the figure from coverage entirely.
//
// check-figures' own rule, a few entries from where that table sat: "a
// gate whose suggested fix fails the gate is worse than a gate that just
// says no." And a hand-maintained number table inside the gate against
// hand-maintained numbers was the joke writing itself.
//
// House style, reproduced exactly so no committed sentence churns: "a
// hundred and thirty", not "one hundred thirty", and tens hyphenated
// ("twenty-four"). Every entry the old table held is asserted identical in
// number-words.test.mjs, which is the only reason replacing it was safe.
//
// Its own module rather than a block in the gate, so the test can import
// the arithmetic without importing — and therefore running — the gate.

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy",
  "eighty", "ninety",
];

/** The English word for 0-999, or null outside it. */
export function numberWord(n) {
  if (!Number.isInteger(n) || n < 0 || n > 999) return null;
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)];
    return n % 10 ? `${t}-${ONES[n % 10]}` : t;
  }
  // "a hundred", not "one hundred" — the style every committed sentence
  // already uses.
  const head = n < 200 ? "a hundred" : `${ONES[Math.floor(n / 100)]} hundred`;
  const rest = n % 100;
  return rest ? `${head} and ${numberWord(rest)}` : head;
}

/** The word, or the digits when the value is outside what is worth
 * spelling. One helper rather than `numberWord(x) || String(x)` at fifteen
 * call sites, all of which wrote it identically. */
export function word(n) {
  return numberWord(n) ?? String(n);
}

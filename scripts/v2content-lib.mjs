// The one place `functions/src/v2content.ts` is parsed back into data.
//
// WHY THIS FILE EXISTS, and it is a bug report rather than a tidy-up.
// Three scripts each carried their own copy of the same four lines:
// find `V2_QUESTIONS: V2SeedQuestion[] = `, slice to the LAST `];`, parse.
// That worked for as long as the questions array was the only export in
// the file, and broke the moment a second one arrived (D197's `V2_ADS`) —
// the slice ran past its own terminator and swallowed the next
// declaration whole.
//
// The three failed three different ways, which is the argument for one
// copy:
//
//   · check-figures.mjs   died on a SyntaxError. The good outcome.
//   · cost-arith.mjs      died the same way, but two layers down inside
//                         pulse.test.mjs, so the failure named a cost
//                         model rather than a parser.
//   · question-quality.mjs had a try/catch and fell back to
//                         `bankSize * 250`. It did not fail at all — it
//                         quietly reported an invented wire size, which
//                         is the worst of the three and the one nobody
//                         would have noticed.
//
// A fourth export will arrive eventually. It will now break one function
// with a clear message, or none.
import { readFileSync } from "node:fs";

const HEAD = "V2_QUESTIONS: V2SeedQuestion[] = ";

/**
 * The seeded question bank, as an array.
 *
 * Terminates on the FIRST `];` after the declaration — the array's own —
 * rather than the last one in the file, which is whatever the last export
 * happens to end with.
 */
export function bankArray(src) {
  const at = src.indexOf(HEAD);
  if (at === -1) {
    throw new Error(
      "v2content.ts: no `V2_QUESTIONS: V2SeedQuestion[] = ` declaration. "
      + "The generated file's shape changed and every caller of this "
      + "helper is now reading it wrong — fix the helper, not the callers.",
    );
  }
  const body = src.slice(at + HEAD.length);
  const end = body.indexOf("];");
  if (end === -1) throw new Error("v2content.ts: the V2_QUESTIONS array has no terminator.");
  return JSON.parse(body.slice(0, end + 1));
}

/** Same, read from a path. */
export function bankArrayFrom(path) {
  return bankArray(readFileSync(path, "utf8"));
}

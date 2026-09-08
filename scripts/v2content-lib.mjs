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

// The bank is emitted as `const BANK_0`, `BANK_1`, … and then spread into
// one exported `V2_QUESTIONS`, because a single literal that big is over
// `tsc`'s union limit (gen-v2content.mjs says why, with the two measured
// sizes). So the DATA is in the slices and the export is JavaScript: it
// reads `[...BANK_0, ...BANK_1]`, which is not JSON and never was meant to
// be parsed. Read the slices and concatenate them in order.
const SLICE = /^const BANK_(\d+): V2SeedQuestion\[\] = /m;

/**
 * The seeded question bank, as an array.
 *
 * Each slice terminates on the FIRST `];` after its declaration — the
 * slice's own — rather than any later one in the file, which is whatever
 * the next declaration ends with.
 */
export function bankArray(src) {
  const out = [];
  let rest = src;
  let expect = 0;
  for (;;) {
    const m = SLICE.exec(rest);
    if (!m) break;
    if (Number(m[1]) !== expect) {
      throw new Error(
        `v2content.ts: bank slices are out of order — expected BANK_${expect}, `
        + `found BANK_${m[1]}. The generated file's shape changed.`,
      );
    }
    const body = rest.slice(m.index + m[0].length);
    const end = body.indexOf("];");
    if (end === -1) {
      throw new Error(`v2content.ts: bank slice BANK_${m[1]} has no terminator.`);
    }
    out.push(...JSON.parse(body.slice(0, end + 1)));
    rest = body.slice(end + 2);
    expect += 1;
  }
  if (expect === 0) {
    throw new Error(
      "v2content.ts: no `const BANK_0: V2SeedQuestion[] = ` declaration. "
      + "The generated file's shape changed and every caller of this "
      + "helper is now reading it wrong — fix the helper, not the callers.",
    );
  }
  return out;
}

/** Same, read from a path. */
export function bankArrayFrom(path) {
  return bankArray(readFileSync(path, "utf8"));
}

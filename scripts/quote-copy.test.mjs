// A struck quote is never printed through the rate card's formatter.
//
// `fmt` rounds anything over a hundred to the nearest ten — right for a
// price list, which is what it is for, and a lie about a figure that will
// be charged. `fmtExact` is the other form.
//
// The rule is easy to half-apply, and it was: the Pay button moved to the
// exact form while the sentence directly above it stayed on the rounded
// one, so an approved ad card read "Approved at €290 flat" over
// "Pay €288 →" — two prices for one purchase, a finger apart, which is
// worse than the single wrong price it replaced.
//
// So the rule is pinned here rather than at one call site: anything
// reading a figure off `quote` — the booking's OWN locked numbers — is
// printed exactly. The rate card in the composer is untouched, because a
// rate card is not a quote.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [
  "src/v2/ui/AskedByYouOverlay.tsx",
];

describe("the figures a buyer is charged", () => {
  for (const rel of FILES) {
    const src = readFileSync(join(root, rel), "utf8");

    it(`${rel} never prints a struck quote through the rounding formatter`, () => {
      // Every `fmt(` call whose argument reaches into a quote. Matched on
      // the argument rather than the line, so a rate-card `fmt` beside it
      // is untouched.
      const rounded = [...src.matchAll(/\bfmt\(([^)]*)\)/g)]
        .filter((m) => /\bquote\b|\bflatEur\b|\bcapEur\b|\bratePerAnswer\b|\bpriceEur\b|\bspentEur\b/.test(m[1]))
        // …but not the POSTED price. `PRICING.*`, `rate(scope)` and
        // `adFlat(scope)` are the rate card: what a booking would cost
        // today, before anything is struck, and the composer says so
        // ("locked at approval"). A rate card is exactly what `fmt` is
        // for. The line this draws is "already agreed" versus "on
        // offer", and the composer's own rows are on the night list.
        .filter((m) => !/\bPRICING\.|\brate\(|\badFlat\(/.test(m[1]))
        .map((m) => m[0]);
      expect(
        rounded,
        `${rel} prints a locked quote through fmt(), which rounds above a hundred `
          + "to the nearest ten — use fmtExact for a figure that will be charged",
      ).toEqual([]);
    });
  }

  it("the exact form is actually reached — this is not a vacuous rule", () => {
    // A file that stopped printing prices at all would satisfy the case
    // above by saying nothing, which is not the property wanted.
    // FILES[0] was suggestions.jsx until D365 took the paid door out of the
    // binary. AskedByYouOverlay is what still shows a buyer their own
    // figures, so it is what this non-vacuity case now guards.
    const sug = readFileSync(join(root, FILES[0]), "utf8");
    expect(sug, `${FILES[0]} no longer prints an exact figure anywhere`).toMatch(/fmtExact\(/);
    const uses = [...sug.matchAll(/\bfmtExact\(/g)].length;
    expect(uses, "the approved sentence and the Pay button are two call sites at least")
      .toBeGreaterThanOrEqual(2);
  });
});

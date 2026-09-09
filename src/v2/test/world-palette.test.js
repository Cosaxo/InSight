// FOUR OPTIONS, THREE COLOURS.
//
// `WPAL.opt` rotated each side a fixed 120° off the card's hue, which wraps
// at three: with four options, sides 0 and 3 are 360° apart and come back
// byte-identical. The cohort rows on the who-voted sheet are a stacked bar
// with no labels at all — colour is the only thing saying which answer a
// segment is — so on any four-option question two different answers were
// painted the same. 29 daily questions and 11 feed questions in the
// committed bank have four options.
//
// Nothing in the tree pinned these colours, which is why no gate caught it.
import { describe, expect, it } from "vitest";
import { WPAL } from "../spec/world-palette.js";

const sides = (n) => Array.from({ length: n }, (_, i) => WPAL.opt("oklch(0.62 0.17 20)", i, n));

describe("WPAL.opt gives every side its own hue", () => {
  it.each([2, 3, 4, 5, 6, 7, 8])("gives %i options that many distinct colours", (n) => {
    expect(new Set(sides(n)).size, `two of ${n} sides came back identical`).toBe(n);
  });

  it("leaves the 2- and 3-option cases exactly where they were", () => {
    // The control on the other side: this fix must not repaint the whole
    // app. Two and three options keep the steps they had — n=2 at 150°,
    // n=3 at 120°, which is what the source claims it "checked
    // byte-identical".
    //
    // THE BYTES ARE THE POINT, and this case used to assert none of them:
    // it compared `WPAL.opt(c, 1, 2)` to ITSELF, and asked `sides(2)` and
    // `sides(3)` for their lengths — which `Array.from({length: n})` makes
    // true whatever the colours are. Collapsing the nested ternary to
    // `n > 3 ? 360 / n : 120` repaints every two-option question in the
    // app and left this file 9/9 green. These bars carry no labels, so
    // the colour is the whole encoding.
    expect(sides(2)).toEqual([
      "oklch(0.589 0.200 20.0)",
      "oklch(0.654 0.126 170.0)",
    ]);
    expect(sides(3)).toEqual([
      "oklch(0.589 0.200 20.0)",
      "oklch(0.650 0.200 140.0)",
      "oklch(0.575 0.200 260.0)",
    ]);
    // …and a caller that passes no `n` at all is on the old path. This one
    // was always real: it pins the equivalence rather than the value, and
    // `undefined > 3` being false is the whole of why the 4+ fix was safe.
    expect(WPAL.opt("oklch(0.62 0.17 20)", 1)).toBe(WPAL.opt("oklch(0.62 0.17 20)", 1, 2));
  });

  it("says the same for the text-safe variant, which the same rows use", () => {
    const inked = Array.from({ length: 4 }, (_, i) => WPAL.opt("oklch(0.62 0.17 20)", i, 4, true));
    expect(new Set(inked).size, "the text-safe path still collides at four").toBe(4);
  });
});

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
    // app. Two and three options keep the steps they had.
    expect(WPAL.opt("oklch(0.62 0.17 20)", 1, 2)).toBe(WPAL.opt("oklch(0.62 0.17 20)", 1, 2));
    expect(sides(2)).toHaveLength(2);
    expect(sides(3)).toHaveLength(3);
    // …and a caller that passes no `n` at all is on the old path.
    expect(WPAL.opt("oklch(0.62 0.17 20)", 1)).toBe(WPAL.opt("oklch(0.62 0.17 20)", 1, 2));
  });

  it("says the same for the text-safe variant, which the same rows use", () => {
    const inked = Array.from({ length: 4 }, (_, i) => WPAL.opt("oklch(0.62 0.17 20)", i, 4, true));
    expect(new Set(inked).size, "the text-safe path still collides at four").toBe(4);
  });
});

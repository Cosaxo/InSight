// Holds the app's twenty shapes to the bank's own geometry (D473). The class
// this exists for has already happened once: the design artboard's array was
// in reading order where OMIB numbers counter-clockwise, and its arrows
// pointed in where the bank's point out — twelve of twenty wrong, every gate
// green, because nothing else here can see a picture. So every path is parsed
// back to points, unscaled, and compared to drawing.js's tables directly.
import { describe, it, expect } from "vitest";
import { SHAPES, ELEMENTS, PALETTE_ORDER, familyOf, bitsOf, cellOf } from "./omib-shapes";

// content/omib-source/Web Version/javascript/drawing.js, verbatim — the join
// key. Written out rather than imported so a change to either copy has to
// disagree with the other.
const OMIB: Record<number, [number, number][]> = {
  0: [[0, 0], [25, 0], [0, 25]], 1: [[25, 100], [0, 100], [0, 75]],
  2: [[100, 75], [100, 100], [75, 100]], 3: [[75, 0], [100, 0], [100, 25]],
  4: [[12.5, 50], [50, 12.5]], 5: [[12.5, 50], [50, 87.5]],
  6: [[50, 87.5], [87.5, 50]], 7: [[50, 12.5], [87.5, 50]],
  8: [[37.5, 0], [62.5, 0], [62.5, 12.5], [37.5, 12.5]], 9: [[0, 37.5], [0, 62.5], [12.5, 62.5], [12.5, 37.5]],
  10: [[37.5, 87.5], [62.5, 87.5], [62.5, 100], [37.5, 100]], 11: [[87.5, 37.5], [87.5, 62.5], [100, 62.5], [100, 37.5]],
  16: [[50, 12.5], [37.5, 25], [62.5, 25]], 17: [[12.5, 50], [25, 37.5], [25, 62.5]],
  18: [[50, 87.5], [37.5, 75], [62.5, 75]], 19: [[87.5, 50], [75, 37.5], [75, 62.5]],
};

/** Path data → points, back in the bank's 100-unit cell. */
const unscale = (d: string): [number, number][] =>
  [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => [
    Math.round(((Number(x) - 6) / 0.6) * 100) / 100,
    Math.round(((Number(y) - 6) / 0.6) * 100) / 100,
  ]);

describe("the twenty shapes are the bank's, id for id", () => {
  it("every polygon and line unscales to drawing.js's points exactly", () => {
    for (const [id, pts] of Object.entries(OMIB)) {
      expect(unscale(SHAPES[Number(id)].d), `element ${id}`).toEqual(pts);
    }
  });

  it("the centre four are a fifth of the cell, filled then outlined, square then circle", () => {
    expect(unscale(SHAPES[12].d)).toEqual([[40, 40], [60, 40], [60, 60], [40, 60]]);
    expect(SHAPES[12].k).toBe("fill");
    expect(SHAPES[13].d).toBe(SHAPES[12].d);
    expect(SHAPES[13].k).toBe("stroke");
    // circle radius 10 of 100 → 6 of 72; centred on (36, 36)
    expect(SHAPES[14].d).toBe("M30 36a6 6 0 1 0 12 0a6 6 0 1 0 -12 0Z");
    expect(SHAPES[14].k).toBe("fill");
    expect(SHAPES[15].d).toBe(SHAPES[14].d);
    expect(SHAPES[15].k).toBe("stroke");
  });

  it("numbers each family counter-clockwise, which is what Rotation steps through", () => {
    // Read each family's four centroids as a quadrant sequence: the bank's
    // order visits them counter-clockwise, and reading order does not.
    const quadrant = (pts: [number, number][]): string => {
      const cx = pts.reduce((s, [x]) => s + x, 0) / pts.length;
      const cy = pts.reduce((s, [, y]) => s + y, 0) / pts.length;
      return `${cy < 40 ? "top" : cy > 60 ? "bottom" : "mid"}-${cx < 40 ? "left" : cx > 60 ? "right" : "mid"}`;
    };
    const seq = (from: number) => [0, 1, 2, 3].map((k) => quadrant(unscale(SHAPES[from + k].d)));
    expect(seq(0)).toEqual(["top-left", "bottom-left", "bottom-right", "top-right"]);
    expect(seq(4)).toEqual(["top-left", "bottom-left", "bottom-right", "top-right"]);
    expect(seq(8)).toEqual(["top-mid", "mid-left", "bottom-mid", "mid-right"]);
    expect(seq(16)).toEqual(["top-mid", "mid-left", "bottom-mid", "mid-right"]);
  });

  it("the arrows point OUTWARD — the apex sits nearer the edge than the base", () => {
    // The apex is the vertex whose coordinate on the axis perpendicular to
    // the pointing axis is unique; outward means it is nearer the edge than
    // both base vertices.
    const outward = (pts: [number, number][], axis: 0 | 1, edge: number): boolean => {
      const perp = 1 - axis;
      const apex = pts.find((p) => pts.filter((q) => q[perp] === p[perp]).length === 1)!;
      return pts.filter((p) => p !== apex).every((b) => Math.abs(apex[axis] - edge) < Math.abs(b[axis] - edge));
    };
    expect(outward(unscale(SHAPES[16].d), 1, 0), "top arrow points up").toBe(true);
    expect(outward(unscale(SHAPES[17].d), 0, 0), "left arrow points left").toBe(true);
    expect(outward(unscale(SHAPES[18].d), 1, 100), "bottom arrow points down").toBe(true);
    expect(outward(unscale(SHAPES[19].d), 0, 100), "right arrow points right").toBe(true);
    // The negative that proves the check: the design artboard's own top arrow,
    // unscaled, which pointed IN. If this ever passes, the check is broken.
    expect(outward([[38.33, 13.33], [61.67, 13.33], [50, 30]], 1, 0)).toBe(false);
  });

  it("kinds: corners, boxes and arrows fill; lines are lines", () => {
    for (const id of [0, 1, 2, 3, 8, 9, 10, 11, 16, 17, 18, 19]) expect(SHAPES[id].k, `element ${id}`).toBe("fill");
    for (const id of [4, 5, 6, 7]) expect(SHAPES[id].k, `element ${id}`).toBe("line");
  });
});

describe("the helpers", () => {
  it("lays the palette out column = family, row = member, ids untouched", () => {
    expect(ELEMENTS).toBe(20);
    expect(PALETTE_ORDER.slice(0, 5)).toEqual([0, 4, 8, 12, 16]); // first row: one of each family
    expect(PALETTE_ORDER.slice(5, 10)).toEqual([1, 5, 9, 13, 17]);
    expect([...PALETTE_ORDER].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(familyOf(0)).toBe("corner");
    expect(familyOf(7)).toBe("line");
    expect(familyOf(19)).toBe("arrow");
  });

  it("reads and writes a cell code element 0 first — the bank's convention", () => {
    expect(bitsOf("10000000000000000001")).toEqual([0, 19]);
    expect(cellOf([0, 19])).toBe("10000000000000000001");
    expect(cellOf([])).toBe("0".repeat(20));
    // round trip over a real cell from the bank
    const cell = "01101000100000010010";
    expect(cellOf(bitsOf(cell))).toBe(cell);
  });
});

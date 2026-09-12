// The twenty construction elements of the Open Matrices Item Bank, as the
// app draws them (D472; design/logic-build-cell-2026-09-12/).
//
// INDEX IS OMIB'S ELEMENT ID. Not the design artboard's array order, and not
// reading order — the bank numbers every family COUNTER-CLOCKWISE (top-left,
// bottom-left, bottom-right, top-right; top, left, bottom, right), and that is
// load-bearing: `Rotation` is one of its six rules and works by stepping an
// element through its family's four ids. A table in any other order renders a
// rotation item as something that is not a rotation, with every gate green,
// because nothing downstream can see a picture. The design's own array was in
// reading order and twelve of twenty differed; omib-shapes.test.ts holds this
// table to the bank's geometry so that class of drift cannot come back.
//
// EVERY PATH IS DERIVED, NOT DRAWN. Each is the bank's `drawing.js` polygon
// scaled from its 100-unit cell into the design's 60-unit working area
// (6..66 inside the 72-frame the overlay's cells already use), so the shapes a
// solver sees are proportioned exactly as the shapes 2,572 people were
// calibrated on — arrows pointing OUTWARD, lines running edge-middle to
// edge-middle, the centre square a fifth of the cell. What is the design's and
// stays the design's: the 6-unit inset, the round caps, the stroke weights.
// The designer owns the screen; the bank owns the stimuli.
//
// A cell is a 20-bit string, element 0 first (content/omib.json's `code`);
// render bit i with SHAPES[i]. The palette lays them out column = family,
// row = member, which is the artboard's order — `PALETTE_ORDER` maps a tile
// position to an id, so the layout can be reading-order while the ids are not.

export type Kind = "fill" | "stroke" | "line";

export interface Shape {
  /** SVG path data in the 72-frame */
  d: string;
  /** filled silhouette · outlined figure · bare line */
  k: Kind;
}

// The bank's cell is 100 units; the design draws inside 6..66 of 72.
const S = 0.6;
const O = 6;
const u = (v: number): number => Math.round((O + v * S) * 100) / 100;
const poly = (...pts: [number, number][]): string =>
  pts.map(([x, y], i) => `${i ? "L" : "M"}${u(x)} ${u(y)}`).join("") + "Z";
const seg = ([x0, y0]: [number, number], [x1, y1]: [number, number]): string =>
  `M${u(x0)} ${u(y0)}L${u(x1)} ${u(y1)}`;
const circle = (cx: number, cy: number, r: number): string => {
  const [x, y, rr] = [u(cx), u(cy), Math.round(r * S * 100) / 100];
  return `M${x - rr} ${y}a${rr} ${rr} 0 1 0 ${2 * rr} 0a${rr} ${rr} 0 1 0 ${-2 * rr} 0Z`;
};

/** drawing.js's five tables, verbatim in the bank's own units, then scaled. */
export const SHAPES: readonly Shape[] = [
  // 0..3  corner — a filled triangle: top-left, bottom-left, bottom-right, top-right
  { d: poly([0, 0], [25, 0], [0, 25]), k: "fill" },
  { d: poly([25, 100], [0, 100], [0, 75]), k: "fill" },
  { d: poly([100, 75], [100, 100], [75, 100]), k: "fill" },
  { d: poly([75, 0], [100, 0], [100, 25]), k: "fill" },
  // 4..7  line — edge-middle to edge-middle: upper-left, lower-left, lower-right, upper-right
  { d: seg([12.5, 50], [50, 12.5]), k: "line" },
  { d: seg([12.5, 50], [50, 87.5]), k: "line" },
  { d: seg([50, 87.5], [87.5, 50]), k: "line" },
  { d: seg([50, 12.5], [87.5, 50]), k: "line" },
  // 8..11 box — a filled bar on the edge: top, left, bottom, right
  { d: poly([37.5, 0], [62.5, 0], [62.5, 12.5], [37.5, 12.5]), k: "fill" },
  { d: poly([0, 37.5], [0, 62.5], [12.5, 62.5], [12.5, 37.5]), k: "fill" },
  { d: poly([37.5, 87.5], [62.5, 87.5], [62.5, 100], [37.5, 100]), k: "fill" },
  { d: poly([87.5, 37.5], [87.5, 62.5], [100, 62.5], [100, 37.5]), k: "fill" },
  // 12..15 centre — filled square, outlined square, filled circle, outlined circle
  { d: poly([40, 40], [60, 40], [60, 60], [40, 60]), k: "fill" },
  { d: poly([40, 40], [60, 40], [60, 60], [40, 60]), k: "stroke" },
  { d: circle(50, 50, 10), k: "fill" },
  { d: circle(50, 50, 10), k: "stroke" },
  // 16..19 arrow — a filled triangle on the edge, pointing OUT: top, left, bottom, right
  { d: poly([50, 12.5], [37.5, 25], [62.5, 25]), k: "fill" },
  { d: poly([12.5, 50], [25, 37.5], [25, 62.5]), k: "fill" },
  { d: poly([50, 87.5], [37.5, 75], [62.5, 75]), k: "fill" },
  { d: poly([87.5, 50], [75, 37.5], [75, 62.5]), k: "fill" },
];

export const ELEMENTS = SHAPES.length;

/** The five families by id range — the unit a rule acts inside. */
export const FAMILIES = ["corner", "line", "box", "centre", "arrow"] as const;
export const familyOf = (id: number): (typeof FAMILIES)[number] => FAMILIES[Math.floor(id / 4)];

/**
 * Palette tile position → element id. The artboard lays the palette out as
 * column = family, row = member, read across: tile 0 is corner 0, tile 1 is
 * line 4, … tile 5 is corner 1. Reading order for the LAYOUT; the ids stay
 * the bank's, which is the whole point of this file.
 */
export const PALETTE_ORDER: readonly number[] = Array.from({ length: ELEMENTS }, (_, t) => (t % 5) * 4 + Math.floor(t / 5));

/** The stroke weights the design chose, in 72-frame units. Rendering, not geometry. */
export const STROKE = { line: 2.8, stroke: 2.2 } as const;

/** Which bits of a 20-character cell code are set. */
export const bitsOf = (cell: string): number[] => {
  const out: number[] = [];
  for (let i = 0; i < ELEMENTS; i++) if (cell.charCodeAt(i) === 49 /* "1" */) out.push(i);
  return out;
};

/** A 20-bit cell code from a set of element ids — the taker's answer, as the server expects it. */
export const cellOf = (ids: Iterable<number>): string => {
  const bits = Array<string>(ELEMENTS).fill("0");
  for (const i of ids) bits[i] = "1";
  return bits.join("");
};

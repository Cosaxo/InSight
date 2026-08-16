// @vitest-environment jsdom
//
// The instrument palette, held to the charts it colours (D182).
//
// There are three colour systems for the four core tests and they have
// twice drifted apart:
//
//   TEST_HUE[k]        one hue per instrument — the result card's banner,
//                      the progress sheet's rows, the feed's test tag
//   RP_TESTS[k].hues   one hue per AXIS — every rose petal on the same
//                      card, and (through typeColor/typeSplit) every type
//                      mark and progress dot
//   IS_TEST_RESULTS[k].accent   a fourth copy, on the demo seed only
//
// D121 unified the first against a second palette that no longer exists
// and never looked at the axis hues, which left Values wearing rose over
// petals that run 282–344 and Social wearing violet over petals that run
// 95–205 — a banner outside its own chart on half the instruments.
//
// So the rule this file holds is the one that was missing rather than the
// values D182 happened to pick: an instrument's hue is the CENTRE of its
// own axis family. That is what makes the banner read as the family
// rather than as one of its axes — the old Values rose (8°) sat inside
// the family's arc but on top of `hedonism` (6°), which is how it passed
// for a colour that belonged.
//
// The tokens are read out of styles.css rather than restated here: a hue
// that moves in the stylesheet has to move the test, and a test carrying
// its own copy of --c-city would be the fifth palette.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// @ts-expect-error TS7016 — untyped spec module (the testNorms.ts precedent:
// the instrument definitions are their own source, and pinning them to a
// hand-written .d.ts is a sixth copy of the same table).
import { TEST_HUE as HUE_ANY, IS_TEST_RESULTS as RESULTS_ANY } from "../spec/test-definitions.js";
// @ts-expect-error TS7016 — untyped spec module, as above.
import { RP_TESTS as RP_ANY } from "../spec/result-rose.jsx";

const TEST_HUE = HUE_ANY as Record<string, string>;
const IS_TEST_RESULTS = RESULTS_ANY as Record<string, object>;
const RP_TESTS = RP_ANY as Record<string, { banner: string; hues: Record<string, number> }>;

// `__dirname`, not `import.meta.url` — under the jsdom environment this
// docblock asks for, import.meta.url is the http URL vitest served the
// module from, and fileURLToPath refuses it (learn-split.test.ts reads
// spec sources the same way, for the same reason).
const CSS = readFileSync(resolve(__dirname, "../styles.css"), "utf8");

/** Every `--c-*: oklch(L C H)` in the stylesheet, by token name. */
function cssHues(): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const re = /(--c-[a-z0-9-]+)\s*:\s*oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)/g;
  for (let m = re.exec(CSS); m; m = re.exec(CSS)) {
    const list = out.get(m[1]) || [];
    list.push(Number(m[2]));
    out.set(m[1], list);
  }
  return out;
}

const HUES = cssHues();

/** Resolve a TEST_HUE entry — `var(--token)` or a literal oklch — to degrees. */
function angleOf(colour: string): number {
  const token = /var\((--c-[a-z0-9-]+)\)/.exec(colour);
  if (token) {
    const defs = HUES.get(token[1]);
    expect(defs, `${token[1]} is not defined in styles.css`).toBeTruthy();
    // Light and dark redefine L and C, never the angle — so one value.
    expect(new Set(defs)).toHaveProperty("size", 1);
    return defs![0];
  }
  const lit = /oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)/.exec(colour);
  expect(lit, `${colour} is neither a --c- token nor an oklch() literal`).toBeTruthy();
  return Number(lit![1]);
}

const deg = (a: number) => ((a % 360) + 360) % 360;
/** Shortest distance between two angles, in degrees (0–180). */
function apart(a: number, b: number): number {
  const d = Math.abs(deg(a) - deg(b));
  return Math.min(d, 360 - d);
}

/**
 * The arc an instrument's axes occupy: the circle minus its largest gap.
 * Values wraps through 0 (282 → 28), which is why this cannot be a plain
 * min/max — that would call its family 6°–344° and its centre 175, i.e.
 * teal, the one place none of its petals are.
 */
function family(hues: number[]): { start: number; span: number; centre: number } {
  const sorted = [...hues].map(deg).sort((a, b) => a - b);
  let gapAt = 0;
  let gap = -1;
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length];
    const d = deg(next - sorted[i]);
    if (d > gap) { gap = d; gapAt = (i + 1) % sorted.length; }
  }
  const start = sorted[gapAt];
  const span = 360 - gap;
  return { start, span, centre: deg(start + span / 2) };
}

// ±20°, which is looser than three of the four need (sienna is 7.5 off
// big5's centre, indigo 7.5 off politics', sage exactly on Social's) and
// tight enough to fail both colours D182 replaced: Values' rose was 33
// off, Social's violet 170.
const TOLERANCE = 20;

describe("TEST_HUE", () => {
  it("names exactly the instruments that have charts to colour", () => {
    expect(Object.keys(TEST_HUE).sort()).toEqual(Object.keys(RP_TESTS).sort());
  });

  for (const key of Object.keys(TEST_HUE)) {
    it(`${key} sits at the centre of its own axis family`, () => {
      const axes = Object.values(RP_TESTS[key].hues) as number[];
      expect(axes.length).toBeGreaterThan(1);
      const { centre, span } = family(axes);
      // A family wider than a half-circle has no centre worth the name —
      // if one ever gets there, this rule needs rethinking, not widening.
      expect(span).toBeLessThan(180);
      expect(apart(angleOf(TEST_HUE[key]), centre)).toBeLessThanOrEqual(TOLERANCE);
    });

    it(`${key}'s banner is TEST_HUE, not a second copy of it`, () => {
      expect(RP_TESTS[key].banner).toBe(TEST_HUE[key]);
    });
  }

  it("is the only palette a result can be drawn from", () => {
    // The demo seed carried `accent` and the live path never did, so every
    // reader of it drew nothing on a real account (D182). The seed is the
    // shape the live path writes, and this is what says so.
    for (const [key, result] of Object.entries(IS_TEST_RESULTS)) {
      expect(result, `${key} carries its own accent`).not.toHaveProperty("accent");
    }
  });
});

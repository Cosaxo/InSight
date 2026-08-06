// @vitest-environment jsdom
//
// Structural contract for the lens definitions (IS_LENSES) — the same
// item-design gate content-parity.test.jsx holds over the four core tests,
// sized to what a 4–9-item lens can actually promise.
//
// Every rule here is a silent-failure class, not style: a typo'd `d` means
// the question never scores and its dimension stays null forever (score()
// skips non-matching items without a sound); a dimension with no questions
// can never be read in live mode; and a lens with no reverse-keyed item
// lets an agree-with-everything response style score as a personality —
// the exact acquiescence hole the W2 expansion closed for big5/attachment,
// re-shipped by `moral` and `humor` until the 2026-08-06 content review.
//
// Per-LENS invert floor, not per-dimension: several dims carry a single
// item, which cannot be its own reverse. The core tests' stronger
// per-dimension rule stays theirs.
import { describe, expect, it } from "vitest";
import "../spec/lens-defs.js";

interface LensDim {
  id: string;
  label: string;
  demo: number;
  poles?: string[];
}
interface LensQuestion {
  q: string;
  d: string;
  invert?: boolean;
}
interface LensDef {
  id: string;
  tier: number;
  hue: number;
  title: string;
  viz: string;
  seed?: number;
  dims: LensDim[];
  questions: LensQuestion[];
}
const LENSES = (window as unknown as { IS_LENSES: LensDef[] }).IS_LENSES;

// The vizzes lens-cards.jsx actually implements (its VIZ map). An unknown
// key silently falls back to Mini there, which then reads dims[0].poles —
// so an invented viz name is a render-time surprise, not a style choice.
const KNOWN_VIZ = ["ranked", "columns", "spine", "curve", "mini"];

describe("lens definitions (structural contract)", () => {
  it("lens ids are unique", () => {
    const ids = LENSES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const lens of LENSES) {
    describe(lens.id, () => {
      it("declares a known viz, a valid tier and a seed in range", () => {
        expect(KNOWN_VIZ).toContain(lens.viz);
        expect([1, 2]).toContain(lens.tier);
        const seed = lens.seed || 0;
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThanOrEqual(1);
      });

      it("has unique dimension ids, each with poles of exactly two when present", () => {
        const ids = lens.dims.map((d) => d.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const d of lens.dims) {
          if (d.poles) expect(d.poles).toHaveLength(2);
          expect(d.demo).toBeGreaterThanOrEqual(0);
          expect(d.demo).toBeLessThanOrEqual(100);
        }
      });

      it("keys every question to a declared dimension", () => {
        const dims = new Set(lens.dims.map((d) => d.id));
        for (const q of lens.questions) {
          expect(dims.has(q.d), `"${q.q}" keys to undeclared dim "${q.d}"`).toBe(true);
        }
      });

      it("gives every dimension at least one question", () => {
        const covered = new Set(lens.questions.map((q) => q.d));
        for (const d of lens.dims) {
          expect(covered.has(d.id), `dim "${d.id}" has no questions — permanently null in live mode`).toBe(true);
        }
      });

      it("carries at least one reverse-keyed item", () => {
        expect(
          lens.questions.some((q) => q.invert),
          "no invert — acquiescence scores as a profile",
        ).toBe(true);
      });
    });
  }
});

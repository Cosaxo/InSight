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
// The seed source (D89): content/lenses.json is what gen-v2content.mjs
// mirrors into the deployed bank, so IS_LENSES and it must agree — the
// binding test at the bottom holds them together.
import SEEDED from "../../../content/lenses.json";

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

// D89: the lens items are seeded world questions now, generated into the
// bank from content/lenses.json — a SECOND copy of what IS_LENSES already
// says. Two copies drift, and each direction of drift fails silently
// somewhere else: a client-only edit ships cards whose prompt differs from
// the seeded doc the answers validate against, and a JSON-only edit ships a
// bank the client never renders. This suite is the binding; check:content
// binds the JSON to functions/src/v2content.ts from the other side.
describe("content/lenses.json mirrors IS_LENSES (D89)", () => {
  const seeded = SEEDED as unknown as Record<
    string,
    {
      title: string;
      dims: { id: string; label: string }[];
      questions: { id: string; q: string; d: string; invert?: boolean; political?: boolean }[];
    }
  >;

  it("carries exactly the client's lenses, in some order", () => {
    expect(Object.keys(seeded).sort()).toEqual(LENSES.map((l) => l.id).sort());
  });

  for (const lens of LENSES) {
    it(`${lens.id}: questions match by index — id, text, dimension, invert`, () => {
      const s = seeded[lens.id];
      expect(s, `${lens.id} missing from content/lenses.json`).toBeTruthy();
      expect(s.questions).toHaveLength(lens.questions.length);
      lens.questions.forEach((q, i) => {
        const row = s.questions[i];
        // The id is the qid's tail: lq-<lens>-<i>, unpadded — the ids the
        // client minted before the items had a backend. Positional drift
        // here re-keys live immutable answers to the wrong prompt.
        expect(row.id, `${lens.id}[${i}]`).toBe(String(i));
        expect(row.q, `${lens.id}[${i}]`).toBe(q.q);
        expect(row.d, `${lens.id}[${i}]`).toBe(q.d);
        expect(!!row.invert, `${lens.id}[${i}] invert`).toBe(!!q.invert);
      });
    });

    it(`${lens.id}: dims match the client's, id and label`, () => {
      const s = seeded[lens.id];
      expect(s.dims).toEqual(lens.dims.map((d) => ({ id: d.id, label: d.label })));
    });
  }

  it("the two zero-sum trade propositions carry the political flag (D44)", () => {
    // The D89 judgement: these two state economic-policy opinions — the
    // same class as the political test's own items — so they publish their
    // overall split and never slice by anchors. The rest of the lens items
    // are instrument items in the values/big5 class, which do slice.
    const flagged = Object.entries(seeded).flatMap(([key, l]) =>
      l.questions.filter((q) => q.political).map((q) => `lq-${key}-${q.id}`),
    );
    expect(flagged.sort()).toEqual(["lq-trust-2", "lq-trust-3"]);
  });
});

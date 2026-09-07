// @vitest-environment jsdom
//
// The four personality tests live in TWO places that must agree item for
// item: content/tests.json feeds the generator → functions/src/v2content.ts
// → the seeded bank (live mode builds its test cards from that bank), while
// src/v2/spec/test-definitions.js is what the client actually scores
// against and what passive progress counts denominators from. Nothing
// compiled them against each other — a divergence means the live card set
// and the scoring bank silently disagree, per-question in the worst case.
//
// This suite also pins the item-design contract from the W2 expansion
// (docs/LAUNCH-PLAN.md): exactly K items per dimension, and at least one
// reverse-keyed item per dimension — big5 and attachment shipped with zero
// inverts, which let an agree-with-everything response style score as a
// personality.
import { describe, expect, it } from "vitest";
import { IS_TESTS } from "../spec/test-definitions.js";
import contentTests from "../../../content/tests.json";

// Items per dimension. Raising it is a content change; this constant is
// the single place the gate learns it. W2 planned "3 now, possibly 4
// later"; it went to 5 on 2026-08-10, because 3 items leaves a dimension
// only 13 reachable scores — one careless tap moves a trait ~8 points,
// which is coarser than anything the Mirror reads off it claims to be.
const K = 5;

const spec = IS_TESTS;

describe("personality test banks (spec ≡ content)", () => {
  it("defines the same tests in the same order", () => {
    expect(Object.keys(spec)).toEqual(Object.keys(contentTests));
  });

  for (const key of Object.keys(contentTests)) {
    describe(key, () => {
      it("has identical items, order and keying in both layers", () => {
        // Normalise `invert` so `undefined` and absent compare equal —
        // what matters to scoreTest is truthiness.
        const norm = (qs) =>
          qs.map(({ q, d, invert }) => ({ q, d, invert: !!invert }));
        expect(norm(spec[key].questions)).toEqual(
          norm(contentTests[key].questions),
        );
      });

      it("declares identical dimensions", () => {
        const norm = (dims) =>
          dims.map(({ id, label, blurb }) => ({ id, label, blurb }));
        expect(norm(spec[key].dims)).toEqual(norm(contentTests[key].dims));
      });

      it(`carries exactly ${K} items per dimension, at least one reverse-keyed`, () => {
        for (const dim of contentTests[key].dims) {
          const items = contentTests[key].questions.filter(
            (q) => q.d === dim.id,
          );
          expect(items, `${key}/${dim.id}`).toHaveLength(K);
          expect(
            items.some((q) => q.invert),
            `${key}/${dim.id} has no reverse-keyed item`,
          ).toBe(true);
        }
      });

      it("tag copy states the real question count", () => {
        const n = contentTests[key].questions.length;
        expect(contentTests[key].tag).toContain(`${n} questions`);
        expect(spec[key].tag).toBe(contentTests[key].tag);
      });
    });
  }
});

// ── the deep items (D414): bank-only, by their own rules ────────────
//
// The facet and position items live in `deep` beside `questions` and NOT
// in IS_TESTS: the spec layer's definitions are compiled into first paint
// (check:eager-content names test-definitions.js as debt already), so the
// 156 new prompts ride the seeded document instead and join by id
// (data/similarity.ts testDeepMeta). What this pins is the item design the
// plan fixed (docs/VISION-2026-09-07.md §5.3, D414): the counts per facet
// that make the drawn scales true, the keying that makes an
// agree-with-everything style score as nothing, and the declarations the
// content gate and the fold both read.
const DEEP_K = { big5: 4, political: 2 };
// Two keyed each way is the Big Five rule (D414); the compass's positions
// are the design's own items, two per position with one reverse-keyed.
const DEEP_AGAINST = { big5: 2, political: 1 };

describe("deep items (facets and positions, bank-only)", () => {
  for (const key of Object.keys(DEEP_K)) {
    const T = contentTests[key];
    describe(key, () => {
      it("stays out of the spec layer's definitions", () => {
        expect(spec[key].deep).toBeUndefined();
        expect(spec[key].facets).toBeUndefined();
      });

      it("declares every facet once, under one of its own dimensions", () => {
        const dims = new Set(T.dims.map((d) => d.id));
        for (const f of T.facets) expect(dims.has(f.d), `${key}/${f.id} under ${f.d}`).toBe(true);
        expect(new Set(T.facets.map((f) => f.id)).size).toBe(T.facets.length);
      });

      it(`carries exactly ${DEEP_K[key]} items per facet, ${DEEP_AGAINST[key]} keyed against it`, () => {
        const byFacet = new Map(T.facets.map((f) => [f.id, f]));
        for (const q of T.deep) {
          const f = byFacet.get(q.facet);
          expect(f, `${key}/${q.id} names facet ${q.facet}`).toBeTruthy();
          expect(q.d, `${key}/${q.id} scores its facet's axis`).toBe(f.d);
        }
        for (const f of T.facets) {
          const items = T.deep.filter((q) => q.facet === f.id);
          expect(items, `${key}/${f.id}`).toHaveLength(DEEP_K[key]);
          const against = items.filter((q) => q.invert).length;
          if (key === "big5") expect(against, `${key}/${f.id} keyed against`).toBe(DEEP_AGAINST[key]);
          else expect(against, `${key}/${f.id} keyed against`).toBeGreaterThanOrEqual(DEEP_AGAINST[key]);
        }
      });

      it("never repeats a prompt, its own or a core item's, and keeps its ids apart", () => {
        const core = new Set(T.questions.map((q) => q.q));
        const seen = new Set();
        const ids = new Set(T.questions.map((q) => q.id));
        for (const q of T.deep) {
          expect(core.has(q.q), `${key}/${q.id} restates a core item`).toBe(false);
          expect(seen.has(q.q), `${key}/${q.id} repeats a deep item`).toBe(false);
          seen.add(q.q);
          expect(ids.has(q.id), `${key}/${q.id} collides with another id`).toBe(false);
          ids.add(q.id);
        }
      });

      it("keeps every prompt inside the bank's measured bounds", () => {
        // The farm's bounds for a prompt (question-quality.mjs: 14–97
        // chars, measured off the corpus), written as a statement.
        for (const q of T.deep) {
          expect(q.q.length, `${key}/${q.id}`).toBeGreaterThanOrEqual(14);
          expect(q.q.length, `${key}/${q.id}`).toBeLessThanOrEqual(97);
          expect(q.q.endsWith("."), `${key}/${q.id} ends with a stop`).toBe(true);
        }
      });
    });
  }

  it("the other two instruments carry no deep items yet", () => {
    for (const key of ["values", "attachment"]) {
      expect(contentTests[key].deep).toBeUndefined();
      expect(contentTests[key].facets).toBeUndefined();
    }
  });
});

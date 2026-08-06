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

// Items per dimension. Raising it (W2 planned 3 now, possibly 4 later) is
// a content change; this constant is the single place the gate learns it.
const K = 3;

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

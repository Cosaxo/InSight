// The trait cube's arithmetic (D330), and above all the DRIFT GUARD.
//
// Two matchers now exist in two runtimes — the client's
// `IS_matchArchetype` in `src/v2/spec/archetype-data.js` and this
// package's `matchArchetypeName` — and they type the same people over the
// same public results. If they ever disagree, the who-voted sheet, the
// result card and the sold report start naming different types for one
// person and a reader has to arbitrate. Nothing about that failure is
// loud: both sides keep working, the cohorts are simply wrong.
//
// `TRAIT_GOLDEN` is what sees it. `scripts/gen-traits.mjs` runs the CLIENT
// matcher over ~40 synthetic profiles at generation time and writes the
// answers into `traitsContent.ts`; the first case below replays them
// through the SERVER matcher. A change to either implementation that moves
// a single profile fails here.
import { describe, expect, it } from "vitest";
import {
  TRAIT_ARCH, TRAIT_AVG, TRAIT_AXES, TRAIT_GOLDEN, TRAIT_KINDS, UNTESTED,
  RULE_REAL, RULE_STRONG,
} from "./traitsContent";
import {
  TRAIT_DIMS, axisBandIndex, axisDim, foldTraits, logicBandOf, matchArchetypeName,
  newTraitCube, parseTestDims, publishableCube, traitBucketsFor,
} from "./traitsFit";

/** A `testResults` blob in the shape the profile actually stores. */
const results = (kind: string, dims: Array<{ id: string; value: number }>, logicPct?: number) => ({
  [kind]: { dims },
  ...(logicPct == null ? {} : { logic: { pctile: logicPct } }),
});

describe("the client and server matchers agree (the drift guard)", () => {
  it("types every golden profile exactly as the client matcher did", () => {
    expect(TRAIT_GOLDEN.length).toBeGreaterThan(20); // an empty fixture proves nothing
    for (const g of TRAIT_GOLDEN) {
      expect(
        matchArchetypeName(g.kind, g.dims),
        `${g.kind}: ${JSON.stringify(g.dims)}`,
      ).toBe(g.type);
    }
  });

  it("covers more than one type per instrument — a fixture that always answered the same would pass blind", () => {
    for (const kind of TRAIT_KINDS) {
      const seen = new Set(TRAIT_GOLDEN.filter((g) => g.kind === kind).map((g) => g.type));
      expect(seen.size, `${kind} golden profiles all matched one type`).toBeGreaterThan(1);
    }
  });
});

describe("the parse is defensive — the rules validate only the key set", () => {
  it("collapses a duplicated dim id LAST-WINS, like the app's axes map", () => {
    // Feeding the matcher both copies would double-weight the dim and
    // could type a crafted profile differently here than on the device.
    const parsed = parseTestDims({ big5: { dims: [
      { id: "O", value: 10 }, { id: "C", value: 50 }, { id: "O", value: 90 },
    ] } }, "big5");
    expect(parsed).toEqual([{ id: "O", value: 90 }, { id: "C", value: 50 }]);
  });

  it("clamps to 0..100, rounds, and caps at 12 dims", () => {
    const parsed = parseTestDims({ big5: { dims: [
      { id: "O", value: 4e9 }, { id: "C", value: -800 }, { id: "E", value: 61.6 },
    ] } }, "big5")!;
    expect(parsed.find((d) => d.id === "O")!.value).toBe(100);
    expect(parsed.find((d) => d.id === "C")!.value).toBe(0);
    expect(parsed.find((d) => d.id === "E")!.value).toBe(62);
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `d${i}`, value: 50 }));
    expect(parseTestDims({ big5: { dims: many } }, "big5")!.length).toBe(12);
  });

  it("reads hostile and absent shapes as no reading at all, never as NaN", () => {
    for (const raw of [null, undefined, 7, "x", {}, { big5: 3 }, { big5: {} },
      { big5: { dims: "no" } }, { big5: { dims: [] } },
      { big5: { dims: [{ id: 5, value: 5 }, { value: 5 }, { id: "O", value: "x" }] } }]) {
      expect(parseTestDims(raw, "big5")).toBeNull();
    }
    expect(matchArchetypeName("big5", null)).toBeNull();
  });
});

describe("the axis bands are D254's, centred on the population", () => {
  it("bands exactly at RULE_REAL and RULE_STRONG on both sides of the baseline", () => {
    const avg = 65; // big5.A's real baseline — the reason a midpoint cut fails
    expect(axisBandIndex(avg, avg)).toBe(2);
    expect(axisBandIndex(avg + RULE_REAL - 1, avg)).toBe(2);
    expect(axisBandIndex(avg + RULE_REAL, avg)).toBe(3);
    expect(axisBandIndex(avg + RULE_STRONG - 1, avg)).toBe(3);
    expect(axisBandIndex(avg + RULE_STRONG, avg)).toBe(4);
    expect(axisBandIndex(avg - RULE_REAL, avg)).toBe(1);
    expect(axisBandIndex(avg - RULE_STRONG, avg)).toBe(0);
  });

  it("falls back to the midpoint only when an axis has no authored baseline", () => {
    expect(axisBandIndex(50, undefined)).toBe(2);
    expect(axisBandIndex(50 + RULE_STRONG, undefined)).toBe(4);
  });
});

describe("the logic band reads a missing field as untested, never as the bottom", () => {
  it("bands a percentile and refuses a non-number", () => {
    expect(logicBandOf(90)).toBe("top");
    expect(logicBandOf(75)).toBe("top");
    expect(logicBandOf(74)).toBe("upper");
    expect(logicBandOf(25)).toBe("lower");
    expect(logicBandOf(0)).toBe("bottom");
    for (const bad of [null, undefined, "80", NaN, Infinity, {}]) {
      expect(logicBandOf(bad)).toBeNull();
    }
  });
});

describe("every dim always yields a bucket", () => {
  it("gives all 27 dims a bucket for a profile with nothing in it", () => {
    const b = traitBucketsFor({});
    expect(Object.keys(b).sort()).toEqual([...TRAIT_DIMS].sort());
    for (const dim of TRAIT_DIMS) expect(b[dim]).toBe(UNTESTED);
  });

  it("names the type and the bands for a profile that has them, and untested for the rest", () => {
    const kind = "big5" as const;
    const axes = TRAIT_AXES[kind];
    const dims = axes.map((id) => ({ id, value: (TRAIT_AVG[kind][id] ?? 50) + RULE_STRONG }));
    const b = traitBucketsFor(results(kind, dims, 88));
    expect(TRAIT_ARCH[kind].some((a) => a.name === b[kind])).toBe(true);
    for (const id of axes) expect(b[axisDim(kind, id)]).toBe("b4");
    expect(b.logic).toBe("top");
    // The other three instruments carry nothing, so they are untested —
    // which is what keeps every dim's buckets summing to the same total.
    expect(b.political).toBe(UNTESTED);
    expect(b[axisDim("values", TRAIT_AXES.values[0])]).toBe(UNTESTED);
  });

  it("has 27 dims, each keyed with `_` only and unique", () => {
    expect(TRAIT_DIMS.length).toBe(27);
    expect(new Set(TRAIT_DIMS).size).toBe(27);
    // Axis ids are the instrument's own (`O`, `C`, `econ`), so a key is
    // mixed case — what matters is that nothing in it is in
    // `breakdownBucket`'s rejected class and that `_` is the only
    // separator, so a dim key can never be mistaken for a path.
    for (const d of TRAIT_DIMS) expect(d).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
    for (const d of TRAIT_DIMS) expect(d).not.toMatch(/[./[\]*~]/);
  });
});

describe("the fold, and the identity the sheet's header bar rests on", () => {
  it("sums to the folded total on EVERY dim — the census property", () => {
    const cube = newTraitCube();
    const people = [
      traitBucketsFor(results("big5", [{ id: "O", value: 90 }, { id: "C", value: 20 }], 80)),
      traitBucketsFor(results("big5", [{ id: "O", value: 10 }, { id: "C", value: 90 }])),
      traitBucketsFor({}),
      traitBucketsFor({ political: { dims: [{ id: "econ", value: 90 }] } }),
    ];
    people.forEach((b, i) => foldTraits(cube, b, i % 2));
    const pub = publishableCube(cube);
    for (const dim of TRAIT_DIMS) {
      const byBucket = pub[dim] || {};
      let n = 0;
      for (const bucket of Object.keys(byBucket)) {
        for (const k of Object.keys(byBucket[bucket])) n += byBucket[bucket][k];
      }
      expect(n, `dim ${dim} does not sum to the total`).toBe(people.length);
    }
  });

  it("counts an out-of-range optionIdx toward nobody's column", () => {
    // typeSplit.ts's rule: the bucket's n stays the column sum, so a row
    // never claims people its bars do not show. With ONLY an out-of-range
    // answer the bucket has no columns at all and is dropped.
    const cube = newTraitCube();
    foldTraits(cube, traitBucketsFor({}), 99);
    expect(publishableCube(cube)).toEqual({});
    foldTraits(cube, traitBucketsFor({}), 0);
    const pub = publishableCube(cube);
    expect(pub.logic[UNTESTED]).toEqual({ "0": 1 });
  });

  it("drops a `__proto__` bucket instead of corrupting the document", () => {
    // Unreachable through the real vocabulary — every bucket key is
    // server-derived and check:traits refuses an Object.prototype key —
    // but the fold's maps are null-prototype and the published one is
    // not, so under that key a plain assignment would set the PROTOTYPE
    // rather than add a field. Dropped, and pinned so it stays dropped.
    const cube = newTraitCube();
    foldTraits(cube, { ...traitBucketsFor({}), big5: "__proto__" }, 0);
    const pub = publishableCube(cube);
    expect(pub.big5).toBeUndefined();
    expect(Object.getPrototypeOf(pub)).toBe(Object.prototype);
    // …and the other 26 dims still folded normally.
    expect(pub.logic[UNTESTED]).toEqual({ "0": 1 });
  });

  it("publishes plain objects — a null-prototype map does not serialise", () => {
    const cube = newTraitCube();
    foldTraits(cube, traitBucketsFor({}), 1);
    const pub = publishableCube(cube);
    expect(Object.getPrototypeOf(pub.logic)).toBe(Object.prototype);
    expect(JSON.parse(JSON.stringify(pub)).logic[UNTESTED]).toEqual({ "1": 1 });
  });
});

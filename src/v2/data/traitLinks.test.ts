// The trait web's contract (v28 §13, D393):
//
//   1. A row exists only when BOTH its dimensions resolve — one taken
//      test yields nothing, which is what lets the card refuse to render
//      under four rows instead of drawing a web with no threads.
//   2. The shared rail flips b when the usual pull is opposite, so
//      "following the pattern" always lands the dots together.
//   3. A break needs a wide gap AND a dimension away from the middle —
//      two mid-scale scores 24 apart are noise, not character.
//   4. Rows sort strongest tension first, because the headline is the
//      biggest break and the list should agree with it.
//   5. With a BASIS (the live build), the direction drawn is the MEASURED
//      one: a pair the sample cannot state is not drawn, the authored words
//      are used only where the measurement agrees with them, and the floor
//      is people AND separation from zero — thirty people of pure noise
//      state nothing.
import { describe, expect, it } from "vitest";
import {
  TRAIT_LINKS, TRAIT_MIN_PEOPLE, linkId, traitBasis, traitRows,
  type TraitDimRef, type TraitSamplePerson,
} from "./traitLinks";

const dim = (v: number): TraitDimRef => ({ v, label: "x", color: "#888" });

/** a dimOf over a values table keyed "test.dim" — absent means untaken */
const from = (vals: Record<string, number>) =>
  (test: string, d: string): TraitDimRef | null =>
    `${test}.${d}` in vals ? dim(vals[`${test}.${d}`]) : null;

// ── a deterministic crowd ────────────────────────────────────────────
//
// One latent trait per person and every dimension derived from it, so
// each authored link holds in the sample by construction: the dims a link
// says rise together follow x, the ones it says sink follow 100 − x. The
// generator is a fixed LCG — the same crowd on every run, no flake.
const POS = ["big5.O", "big5.C", "big5.E", "big5.A", "big5.N", "values.beauty", "political.foreign", "attachment.open", "attachment.warm", "attachment.play"];
const NEG = ["political.auth", "political.econ", "values.hedonism", "values.future", "attachment.easy"];
function crowd(n: number, opts: { flip?: string[]; noise?: number; seed?: number } = {}): TraitSamplePerson[] {
  let s = opts.seed ?? 7;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const noise = opts.noise ?? 12;
  const flip = new Set(opts.flip || []);
  const out: TraitSamplePerson[] = [];
  for (let i = 0; i < n; i++) {
    const x = 10 + rnd() * 80;
    const p: Record<string, Record<string, number>> = {};
    const put = (key: string, v: number) => {
      const [t, d] = key.split(".");
      (p[t] = p[t] || {})[d] = Math.max(0, Math.min(100, Math.round(v + (rnd() - 0.5) * 2 * noise)));
    };
    for (const k of POS) put(k, flip.has(k) ? 100 - x : x);
    for (const k of NEG) put(k, flip.has(k) ? x : 100 - x);
    out.push(p);
  }
  return out;
}

describe("traitRows", () => {
  it("yields a row only when both sides resolve", () => {
    // big5 alone: every link crosses tests, so nothing resolves
    const onlyBig5 = from({ "big5.O": 80, "big5.C": 60, "big5.E": 40, "big5.A": 70, "big5.N": 30 });
    expect(traitRows(onlyBig5)).toEqual([]);
    // add one attachment dim: exactly the links it completes appear
    const two = from({ "big5.E": 40, "big5.A": 70, "attachment.warm": 80 });
    expect(traitRows(two).map((r) => r.id).sort()).toEqual(["big5Aattachmentwarm", "big5Eattachmentwarm"]);
  });

  it("flips b on the rail when the usual pull is opposite", () => {
    // big5.O 80 vs political.auth 20, sign −1: following the pattern —
    // high openness, low authority — lands both dots at 80
    const rows = traitRows(from({ "big5.O": 80, "political.auth": 20 }));
    expect(rows).toHaveLength(1);
    expect(rows[0].pa).toBe(80);
    expect(rows[0].pb).toBe(80);
    expect(rows[0].gap).toBe(0);
    expect(rows[0].state).toBe("holds");
    // …and without a basis the direction is the authored one, unmeasured
    expect(rows[0].measured).toBe(false);
    expect(rows[0].n).toBe(0);
  });

  it("calls a break only past both thresholds", () => {
    // wide gap, both mid-scale: 62 vs 38 is 24 apart but neither is a
    // trait (max 12 off 50 — exactly at the line, not past it… 62 is 12
    // off, which MEETS ≥12, so push inside the line instead)
    const noise = traitRows(from({ "big5.O": 61, "political.foreign": 39 }));
    expect(noise[0].gap).toBe(22); // under the gap line — holds
    expect(noise[0].state).toBe("holds");
    // wide gap AND a real trait: breaks
    const real = traitRows(from({ "big5.O": 90, "political.foreign": 40 }));
    expect(real[0].state).toBe("break");
    // narrow gap, strong trait: holds — the pattern is being followed
    const held = traitRows(from({ "big5.O": 90, "political.foreign": 85 }));
    expect(held[0].state).toBe("holds");
  });

  it("sorts strongest tension first and carries the authored words", () => {
    const rows = traitRows(from({
      "big5.O": 90, "political.foreign": 40, // gap 50
      "big5.E": 55, "attachment.play": 50,   // gap 5
    }));
    expect(rows.map((r) => r.gap)).toEqual([50, 5]);
    const link = TRAIT_LINKS.find((l) => l[0] === "big5" && l[1] === "O" && l[2] === "political" && l[3] === "foreign")!;
    expect(rows[0].rule).toBe(link[5]);
    expect(rows[0].breakLine).toBe(link[6]);
  });
});

describe("traitBasis — the usual pattern, measured (D393)", () => {
  const O_AUTH = linkId(TRAIT_LINKS[0]);   // sign −1 authored
  const O_BEAUTY = linkId(TRAIT_LINKS[1]); // sign +1 authored

  it("computes Pearson r over the people holding both dimensions", () => {
    // three people, b = 2a: r is exactly 1; and −1 when b runs the other way
    const up = traitBasis([1, 2, 3].map((a) => ({ big5: { O: a * 10 }, values: { beauty: a * 20 } })));
    expect(up[O_BEAUTY].r).toBeCloseTo(1, 9);
    expect(up[O_BEAUTY].n).toBe(3);
    const down = traitBasis([1, 2, 3].map((a) => ({ big5: { O: a * 10 }, values: { beauty: 80 - a * 20 } })));
    expect(down[O_BEAUTY].r).toBeCloseTo(-1, 9);
    // a person missing one side is not in that pair's basis
    expect(traitBasis([{ big5: { O: 50 } }, null, undefined])[O_BEAUTY]).toEqual({ r: 0, n: 0, sign: null });
  });

  it("states no direction under the people floor, however clean the pattern", () => {
    const thin = traitBasis(crowd(TRAIT_MIN_PEOPLE - 1, { noise: 0 }));
    for (const L of TRAIT_LINKS) expect(thin[linkId(L)].sign, linkId(L)).toBeNull();
    expect(Math.abs(thin[O_BEAUTY].r)).toBeGreaterThan(0.99);
  });

  it("states the measured direction at the floor when it stands clear of zero", () => {
    const b = traitBasis(crowd(TRAIT_MIN_PEOPLE));
    for (const L of TRAIT_LINKS) {
      const m = b[linkId(L)];
      expect(m.n, linkId(L)).toBe(TRAIT_MIN_PEOPLE);
      // the crowd was built to follow every authored direction
      expect(m.sign, linkId(L)).toBe(L[4]);
    }
    // …and a flipped column measures the OTHER way — the sample decides,
    // not the table
    const flipped = traitBasis(crowd(TRAIT_MIN_PEOPLE, { flip: ["values.beauty"] }));
    expect(flipped[O_BEAUTY].sign).toBe(-1);
    expect(flipped[O_AUTH].sign).toBe(-1);
  });

  it("states nothing from noise, whatever the head count", () => {
    // every dimension independent of every other: a hundred people, no
    // pattern to break. A random r over 100 people sits within ±0.2 nearly
    // always, and the t line asks for ~0.2 — so noise is refused and a
    // genuine pattern of that size passes: the line sits where it does on
    // purpose. Seeded, so this is one fixed sample rather than a lottery.
    let s = 99;
    const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    const people: TraitSamplePerson[] = [];
    for (let i = 0; i < 100; i++) {
      const p: Record<string, Record<string, number>> = {};
      for (const k of [...POS, ...NEG]) {
        const [t, d] = k.split(".");
        (p[t] = p[t] || {})[d] = Math.round(rnd() * 100);
      }
      people.push(p);
    }
    const b = traitBasis(people);
    const stated = TRAIT_LINKS.filter((L) => b[linkId(L)].sign != null);
    expect(stated.map(linkId), "noise was stated as a usual pattern").toEqual([]);
  });

  it("never correlates a constant column", () => {
    const flat = traitBasis(Array.from({ length: 40 }, (_, i) => ({ big5: { O: 50 }, values: { beauty: i * 2 } })));
    expect(flat[O_BEAUTY]).toEqual({ r: 0, n: 40, sign: null });
  });
});

describe("traitRows with a basis — the live build", () => {
  const me = from({
    "big5.O": 90, "big5.C": 50, "big5.E": 30, "big5.A": 50, "big5.N": 50,
    "political.auth": 50, "political.foreign": 50, "political.econ": 50,
    "values.beauty": 30, "values.hedonism": 50, "values.future": 50,
    "attachment.warm": 50, "attachment.play": 50, "attachment.easy": 50, "attachment.open": 50,
  });

  it("draws only the pairs the sample can state, and says what over", () => {
    // the sample holds Big Five and values results only: the four pairs
    // that cross those two instruments are stated, nothing else is
    const people = crowd(40).map((p) => ({ big5: p.big5, values: p.values }));
    const rows = traitRows(me, traitBasis(people));
    expect(rows.map((r) => r.id).sort()).toEqual(
      TRAIT_LINKS.filter((L) => [L[0], L[2]].every((t) => t === "big5" || t === "values")).map(linkId).sort(),
    );
    for (const r of rows) {
      expect(r.measured).toBe(true);
      expect(r.n).toBe(40);
    }
    // an empty sample states nothing: no rows, so the card has nothing to
    // draw — which is the whole difference from the authored table
    expect(traitRows(me, traitBasis([]))).toEqual([]);
  });

  it("carries the authored words where the measurement agrees, neutral ones where it does not", () => {
    const agree = traitRows(me, traitBasis(crowd(40)));
    const beauty = agree.find((r) => r.id === linkId(TRAIT_LINKS[1]))!;
    expect(beauty.sign).toBe(1);
    expect(beauty.rule).toBe(TRAIT_LINKS[1][5]);
    expect(beauty.breakLine).toBe("openness without the eye for beauty");
    expect(beauty.state).toBe("break"); // O 90 vs beauty 30 on a rising rail
    // the same viewer against a crowd where beauty sinks with openness:
    // the rail flips (pb = 70), the gap closes to 20 and the words are
    // the neutral pair rather than a sentence written for the other sign
    const disagree = traitRows(me, traitBasis(crowd(40, { flip: ["values.beauty"] })));
    const flipped = disagree.find((r) => r.id === linkId(TRAIT_LINKS[1]))!;
    expect(flipped.sign).toBe(-1);
    expect(flipped.pb).toBe(70);
    expect(flipped.state).toBe("holds");
    expect(flipped.rule).toBe("x usually runs against x here");
    expect(flipped.rule).not.toBe(TRAIT_LINKS[1][5]);
    expect(flipped.breakLine).not.toBe(TRAIT_LINKS[1][6]);
  });

  it("words a neutral break from the viewer's own side of it", () => {
    const labelled = (vals: Record<string, [number, string]>) =>
      (test: string, d: string): TraitDimRef | null =>
        `${test}.${d}` in vals ? { v: vals[`${test}.${d}`][0], label: vals[`${test}.${d}`][1], color: "#888" } : null;
    // openness usually SINKS with beauty in this crowd (flipped), and the
    // viewer has both high: "both high"
    const both = traitRows(
      labelled({ "big5.O": [90, "Openness"], "values.beauty": [85, "Beauty"] }),
      traitBasis(crowd(40, { flip: ["values.beauty"] })),
    )[0];
    expect(both.state).toBe("break");
    expect(both.breakLine).toBe("Openness and Beauty, both high");
    // authority usually RISES with openness in this crowd (flipped), and
    // the viewer is open but not commanding: "Openness without Authority"
    const one = traitRows(
      labelled({ "big5.O": [90, "Openness"], "political.auth": [20, "Authority"] }),
      traitBasis(crowd(40, { flip: ["political.auth"] })),
    )[0];
    expect(one.sign).toBe(1);
    expect(one.state).toBe("break");
    expect(one.breakLine).toBe("Openness without Authority");
  });
});

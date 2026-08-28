// gen-traits.mjs — the trait cube's vocabulary and arithmetic constants,
// generated for the server (D330).
//
//   npm run build:traits     writes functions/src/traitsContent.ts
//   npm run check:traits     refuses a file that is not a fresh generation
//
// WHY A GENERATOR AND NOT A SECOND HAND-KEPT COPY.
//
// The nightly `foldTraitsV2` has to type a person exactly the way the app
// types them — same signatures, same weighting, same baselines, same band
// cut points — because the sheet, the result card and the sold report all
// name the same type over the same person and a disagreement between any
// two of them is a bug a reader would have to arbitrate. The client's copy
// is authored in `src/v2/spec/archetype-data.js` and
// `src/v2/spec/test-definitions.js`; the server runs in `functions/`,
// which cannot import across that boundary. So the numbers are COPIED, and
// a copy needs a gate — this is the `check:content` shape one feature over
// (`v2content.ts` is generated from `/content/*.json` for the same reason
// and guarded byte-for-byte on the deploy path).
//
// This is only possible because D253 took the matcher off the shared-global
// bridge: `scripts/report-lib.mjs` already imports these two modules under
// plain node to build the sold report, so the import below is proven rather
// than hoped for.
//
// WHAT IS EMITTED, AND WHAT IS DELIBERATELY NOT.
//
// Emitted: the DATA the matcher needs (archetype signatures with their
// shares, the population baselines, the axis ids, the four magnitude
// constants) plus a GOLDEN FIXTURE — synthetic profiles with the type the
// CLIENT matcher assigns them, computed here at generation time. The
// fixture is the whole drift guard: `functions/src/traitsFit.test.ts` runs
// the SERVER matcher over it and asserts the same answers, so the day the
// two implementations diverge a test fails rather than a cohort quietly
// moving.
//
// NOT emitted: display labels. The server only ever needs bucket KEYS —
// an archetype's name (which is its identity) and a band index `b0..b4`.
// Every label a person reads is drawn client-side from the client's own
// authored source, so a copy edit is never a data migration and the two
// sides cannot disagree about a word they do not share.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  IS_ARCHETYPES, IS_RULE_ADJ, IS_matchArchetype, RULE_REAL, RULE_STRONG,
} from "../src/v2/spec/archetype-data.js";
import { IS_TESTS, IS_TEST_AVG } from "../src/v2/spec/test-definitions.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const OUT = "functions/src/traitsContent.ts";

/** The four instruments, in the order the sheet shows them. Persisted keys
 *  (`similarity.CORE_TEST_KINDS`), never the render's `social`/`big5` label
 *  spelling — the three-way rename between persisted key, display label and
 *  the Circle map's own lens key is a trap, and the data layer takes the
 *  persisted one everywhere. */
export const KINDS = ["big5", "political", "values", "attachment"];

/** The archetype matcher's own tuning constants, read out of the client
 *  module's source rather than retyped: they are module-private there
 *  (`const ARCH_W_FLOOR = 6`), so an import cannot reach them and a
 *  hand-copied number could drift silently. Refuses on a failed match —
 *  an empty parse is how a gate like this stops meaning anything without
 *  ever failing (check-anchors' rule). */
function privateConst(src, name) {
  const m = new RegExp(`const\\s+${name}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)`).exec(src);
  if (!m) throw new Error(`gen-traits: could not read ${name} from archetype-data.js`);
  return Number(m[1]);
}

/** ~40 synthetic profiles spanning the space, deterministic (no RNG — a
 *  fixture that moved between generations would fail check:traits on a
 *  clean tree). Values are the authored baseline pushed by a rotating set
 *  of offsets, so every band and a wide spread of types get hit. */
function goldenProfiles() {
  const out = [];
  const OFFSETS = [0, 9, -9, 19, -19, 30, -30, 45, -45, 2];
  for (const kind of KINDS) {
    const ids = IS_TESTS[kind].dims.map((d) => d.id);
    const avg = IS_TEST_AVG[kind] || {};
    for (let k = 0; k < OFFSETS.length; k++) {
      const dims = ids.map((id, i) => {
        const base = typeof avg[id] === "number" ? avg[id] : 50;
        const off = OFFSETS[(k + i) % OFFSETS.length];
        return { id, value: Math.max(0, Math.min(100, Math.round(base + off))) };
      });
      const hit = IS_matchArchetype(kind, dims);
      out.push({ kind, dims, type: hit ? hit.list[hit.idx].name : null });
    }
  }
  return out;
}

export function generate() {
  const archSrc = readFileSync(resolve(root, "src/v2/spec/archetype-data.js"), "utf8");
  const wFloor = privateConst(archSrc, "ARCH_W_FLOOR");
  const sharePull = privateConst(archSrc, "ARCH_SHARE_PULL");

  const arch = {};
  const avg = {};
  const axes = {};
  for (const kind of KINDS) {
    const sys = IS_ARCHETYPES[kind];
    if (!sys || !sys.list || !sys.list.length) throw new Error(`gen-traits: no archetypes for ${kind}`);
    arch[kind] = sys.list.map((a) => ({ name: a.name, share: a.share || 1, sig: a.sig }));
    avg[kind] = IS_TEST_AVG[kind] || {};
    // Axis ids come from the INSTRUMENT (test-definitions), not from the
    // pole-adjective table: IS_RULE_ADJ is the label source and could in
    // principle lag a new dim, while the instrument is what a person
    // actually answered. Cross-checked below so a mismatch fails here
    // rather than folding an axis with no bands behind it.
    const ids = IS_TESTS[kind].dims.map((d) => d.id);
    const adj = IS_RULE_ADJ[kind] || {};
    for (const id of ids) {
      if (!adj[id]) throw new Error(`gen-traits: ${kind}.${id} has no pole adjectives in IS_RULE_ADJ`);
    }
    axes[kind] = ids;
  }

  const golden = goldenProfiles();
  const j = (v) => JSON.stringify(v, null, 2).split("\n").join("\n");

  return `// GENERATED from src/v2/spec/archetype-data.js and
// src/v2/spec/test-definitions.js by scripts/gen-traits.mjs — do not
// hand-edit. Regenerate with \`npm run build:traits\`; \`npm run
// check:traits\` compares this file byte-for-byte against what those two
// modules generate, on the deploy path, so a hand edit here (or a client
// change without a regen) fails the gate.
//
// The trait cube's vocabulary and arithmetic (D330). The nightly
// foldTraitsV2 types each person exactly the way the app does, and these
// are the numbers that make that true — the same signatures the result
// card matches on, the same baselines the matcher centres on, the same
// magnitude thresholds the sold report bands by (D254).
//
// LABELS ARE NOT HERE ON PURPOSE. A bucket key is an archetype's NAME
// (which is its identity) or a band INDEX b0..b4; every word a person
// reads is drawn client-side from the client's own source. So a copy edit
// is never a data migration, and the two sides cannot disagree about a
// word they do not share.

/** The four instruments, persisted keys, in the order the sheet shows. */
export const TRAIT_KINDS = ${JSON.stringify(KINDS)} as const;
export type TraitKind = (typeof TRAIT_KINDS)[number];

/** Every dim always yields a bucket; absence yields this one, so each
 *  dim's buckets sum to the question's own total and the sheet's header
 *  bar is the published census rather than a second denominator. */
export const UNTESTED = "untested";

/** One archetype: the bucket key is \`name\`, verbatim. */
export interface ArchSig {
  name: string;
  share: number;
  sig: Record<string, number>;
}

/** IS_ARCHETYPES, signatures only. */
export const TRAIT_ARCH: Record<TraitKind, ArchSig[]> = ${j(arch)};

/** IS_TEST_AVG — the population baseline the matcher centres on (rule 2)
 *  and the band cut points are measured from. */
export const TRAIT_AVG: Record<TraitKind, Record<string, number>> = ${j(avg)};

/** Each instrument's axis ids, from the instrument itself. */
export const TRAIT_AXES: Record<TraitKind, string[]> = ${j(axes)};

/** archetype-data.js's module-private matcher constants, read from source. */
export const ARCH_W_FLOOR = ${wFloor};
export const ARCH_SHARE_PULL = ${sharePull};

/** The band magnitudes (D254): a lean worth naming, and a defining lean. */
export const RULE_REAL = ${RULE_REAL};
export const RULE_STRONG = ${RULE_STRONG};

/** Synthetic profiles with the type the CLIENT matcher assigns them,
 *  computed at generation time. traitsFit.test.ts runs the SERVER matcher
 *  over these and asserts the same answers — the drift guard, and the only
 *  thing that can see two matchers in two runtimes disagreeing. */
export interface GoldenProfile {
  kind: TraitKind;
  dims: Array<{ id: string; value: number }>;
  type: string | null;
}
export const TRAIT_GOLDEN: GoldenProfile[] = ${j(golden)};
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const generated = generate();
  writeFileSync(resolve(root, OUT), generated);
  const dims = KINDS.length + KINDS.reduce((n, k) => n + IS_TESTS[k].dims.length, 0) + 1;
  console.log(`gen-traits: wrote ${OUT} — ${KINDS.length} instruments, ${dims} dims, `
    + `${goldenProfiles().length} golden profiles.`);
}

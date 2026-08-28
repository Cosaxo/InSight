// traitDims.ts — the client's half of the trait cube's vocabulary (D330).
//
// The server publishes `v2_question_traits/{qid}` keyed by dim and bucket;
// this is what turns those keys into a chip row and a set of row labels.
//
// THE SPLIT, AND WHY IT IS THIS WAY. The server holds only KEYS — an
// archetype's name (which is its identity) and a band index `b0..b4`. Every
// WORD a person reads is drawn here, from the client's own authored
// modules, so a copy edit to a band adjective is never a data migration and
// the two sides cannot disagree about a word they do not share.
//
// What they DO share is the dim list and its order, and that is exactly
// where a silent divergence would hurt: a client that thinks `big5_N` comes
// before `big5_A` draws the right rows under the wrong chip. `check:traits`
// rule 4 holds this file's `TRAIT_DIMS` equal to `functions/src/traitsFit.ts`'s
// in values AND order — the COHORT_DIMS ↔ BREAKDOWN_DIMS pair, finally with
// a script behind it.
//
// Reads the same two authored modules the generator reads, so the client
// cannot drift from the generated server copy without the gate seeing it.
// @ts-expect-error TS7016 — untyped spec module (the LiveSimilarityField pattern)
import { IS_ARCHETYPES, IS_RULE_ADJ } from "../spec/archetype-data.js";
// @ts-expect-error TS7016 — untyped spec module
import { IS_TESTS } from "../spec/test-definitions.js";

/** The four instruments, persisted keys, in the order the sheet shows. */
export const TRAIT_KINDS = ["big5", "political", "values", "attachment"] as const;
export type TraitKind = (typeof TRAIT_KINDS)[number];

/** The bucket every dim falls back to. Drawn as an ordinary row: "how the
 *  untested answered" is a real reading, and hiding it would make the
 *  other rows stop summing to the count above them. */
export const UNTESTED = "untested";

/** The chip label for each instrument — the render's own spelling, which
 *  is NOT the persisted key (`big5` shows as "Big 5", `attachment` as
 *  "Social"). Three-way rename, and the data layer takes the persisted
 *  one everywhere. */
export const TRAIT_KIND_LABEL: Record<TraitKind, string> = {
  big5: "Big 5",
  political: "Politics",
  values: "Values",
  attachment: "Social",
};

const AXES = IS_TESTS as Record<string, { dims: Array<{ id: string; label: string }> }>;
const ADJ = IS_RULE_ADJ as Record<string, Record<string, [string, string]>>;
const ARCH = IS_ARCHETYPES as Record<string, { list: Array<{ name: string }> }>;

/** The axis dim key — `traitsFit.axisDim`'s twin, held equal by the gate. */
export const axisDim = (kind: TraitKind, axis: string): string => `${kind}_${axis}`;

/** One instrument's chips: its type dim, then its axis dims. */
export interface TraitGroup {
  kind: TraitKind;
  label: string;
  typeDim: string;
  axisDims: Array<{ dim: string; label: string }>;
}

export const TRAIT_GROUPS: TraitGroup[] = TRAIT_KINDS.map((kind) => ({
  kind,
  label: TRAIT_KIND_LABEL[kind],
  typeDim: kind,
  axisDims: (AXES[kind]?.dims ?? []).map((d) => ({
    dim: axisDim(kind, d.id),
    label: d.label,
  })),
}));

/** The verified logic score (D227) — not an instrument, its own chip. */
export const LOGIC_DIM = "logic";
export const LOGIC_BUCKETS = ["top", "upper", "lower", "bottom"] as const;
export const LOGIC_LABEL: Record<string, string> = {
  top: "Top quarter",
  upper: "Upper middle",
  lower: "Lower middle",
  bottom: "Bottom quarter",
};

/**
 * All 27 dims in display order — each instrument's type dim followed by
 * its axis dims, then logic.
 *
 * Held equal to the server's list by `check:traits` rule 4.
 */
export const TRAIT_DIMS: readonly string[] = (() => {
  const out: string[] = [];
  for (const g of TRAIT_GROUPS) {
    out.push(g.typeDim);
    for (const a of g.axisDims) out.push(a.dim);
  }
  out.push(LOGIC_DIM);
  return out;
})();

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The five band labels for one axis, low pole first.
 *
 * `scripts/report-lib.axisBandLabels`' twin, and deliberately identical:
 * the sold report and the who-voted sheet band the same person on the same
 * axis, and two spellings of one band is the drift this repo gates against
 * everywhere else.
 */
export function axisBandLabels(low: string, high: string): string[] {
  return [cap(low), `Leans ${low}`, "Between", `Leans ${high}`, cap(high)];
}

/** Every bucket of one dim, in vocabulary order, `untested` last.
 *
 * Vocabulary order rather than popularity order, and zeros drawn — D304's
 * rule: a reader has to be able to see the scale their cohort sits on, and
 * a cohort nobody answered from must not be indistinguishable from one
 * that does not exist. */
export function traitBuckets(dim: string): string[] {
  if (dim === LOGIC_DIM) return [...LOGIC_BUCKETS, UNTESTED];
  const kind = TRAIT_KINDS.find((k) => k === dim);
  if (kind) return [...(ARCH[kind]?.list ?? []).map((a) => a.name), UNTESTED];
  return ["b0", "b1", "b2", "b3", "b4", UNTESTED];
}

/** What a bucket is called on screen. */
export function traitBucketLabel(dim: string, bucket: string): string {
  if (bucket === UNTESTED) return "Untested";
  if (dim === LOGIC_DIM) return LOGIC_LABEL[bucket] ?? bucket;
  // A type bucket IS its name — nothing to look up.
  if ((TRAIT_KINDS as readonly string[]).includes(dim)) return bucket;
  const sep = dim.indexOf("_");
  const kind = dim.slice(0, sep);
  const axis = dim.slice(sep + 1);
  const poles = (ADJ[kind] || {})[axis];
  if (!poles) return bucket;
  const i = Number(bucket.slice(1));
  const labels = axisBandLabels(poles[0], poles[1]);
  return labels[i] ?? bucket;
}

/** The chip label for a dim. */
export function traitDimLabel(dim: string): string {
  if (dim === LOGIC_DIM) return "Logic";
  const kind = TRAIT_KINDS.find((k) => k === dim);
  if (kind) return "Type";
  for (const g of TRAIT_GROUPS) {
    const hit = g.axisDims.find((a) => a.dim === dim);
    if (hit) return hit.label;
  }
  return dim;
}

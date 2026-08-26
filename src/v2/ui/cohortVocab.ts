// The canonical anchor vocabularies, dim-keyed, for the breakdown's
// full-scale rows (D300).
//
// ONE source: src/v2/spec/profile-vitals.js, the module `check:anchors`
// holds equal to the trigger's BREAKDOWN_DIM_VOCAB (functions/src/pure.ts).
// The aggregate buckets on those exact strings, so a list typed a third
// time here would be precisely the drift that gate exists to stop — this
// file only re-keys what profile-vitals already declares.
//
// `city` and `country` have no row on purpose: they are open vocabularies
// (a catalogue and its ISO derivation), so there is no canonical "every
// city" to draw at zero. The breakdown shows their observed buckets only.
// @ts-expect-error TS7016 — untyped spec module (the world-palette pattern)
import { AGE_BANDS, GENDER_OPTS, EDU_OPTS, REL_OPTS, HEIGHT_OPTS } from "../spec/profile-vitals.js";

export const DIM_VOCAB: Partial<Record<string, readonly string[]>> = {
  ageBand: (AGE_BANDS as Array<[number, number, string]>).map((b) => b[2]),
  gender: GENDER_OPTS as readonly string[],
  education: EDU_OPTS as readonly string[],
  relationship: REL_OPTS as readonly string[],
  heightBand: HEIGHT_OPTS as readonly string[],
};

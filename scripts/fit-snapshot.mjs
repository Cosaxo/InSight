// The fit's snapshot — the read half of D325's bridge crossing (D363).
//
// D325 gave the nightly Patterns fit its own scorecard and published it
// on the one doc the fit already writes (`v2_patterns/loadings`): the
// prequential series with its floor, and the publish-to-publish
// displacement summary. It ended with "nothing draws these fields yet;
// they are instruments". This module is the smallest reader that makes
// them quotable: a pure fold from the decoded doc to a block the
// scorecard commits, so a theory run can cite the fit's own numbers from
// `main` instead of from a console someone ran once.
//
// WHY derived numbers and never the raw vectors: the loading vectors are
// the map, and the map is drawn on the device off the live doc. Copying
// ~111 × 8 floats into a committed artifact would be a second, staler
// copy of the model that no reader needs — what a reader needs is what
// each vector SAYS. So each question contributes two numbers:
//
//   · disc — the L2 norm of its published loading. In the fitted
//     K-space that is how strongly the question's answer is predicted by
//     (and predicts) the rest, which is the fit's own hub-ness measure
//     (patternsFit.ts: "hub-ness is ‖L‖"). It is NOT an IRT
//     discrimination from a purpose-built calibration, and ITEMS_NOTE
//     says so on the artifact rather than in a comment only we read.
//   · mean — sum/n, the ±1-encoded marginal the fit centres by. 0 is an
//     even split; ±1 is unanimity.
//
// Pure and stdlib-only on purpose (the deploy-adjacent script contract):
// the caller does the one Firestore GET, this does the arithmetic, and
// the test can pin the block without a network.

/** The one document this block is a reading of (D325's publish). */
export const FIT_SOURCE = "v2_patterns/loadings";

/**
 * The honesty clause the block carries about its own item numbers. It
 * ships ON the artifact, beside the numbers, for the same reason D325
 * put `note` on the published quality block: a derived quantity read as
 * the thing it resembles is the failure, and a caveat that lives only in
 * a source comment never reaches the reader who quotes the number.
 */
export const ITEMS_NOTE =
  "model-derived discrimination in the fitted K-space (L2 norm of the" +
  " published loading), not an IRT estimate from a purpose-built" +
  " calibration; mean is the ±1-encoded marginal, 0 = an even split";

/**
 * Cross-read `PATTERNS_MIN_BASIS` out of the functions source text — the
 * DECK_EPOCH precedent in question-scorecard.mjs, for the same reason:
 * this script cannot import from `functions/` (separate package, TS), and
 * a hand-copied 8 that drifts would mis-count how many questions the fit
 * calls fitted. Loud on absence, never a default: a silent fallback here
 * would report a "ready" count against a floor nobody set.
 */
export function readMinBasis(src) {
  const m = /PATTERNS_MIN_BASIS = (\d+)/.exec(String(src ?? ""));
  if (!m) {
    throw new Error(
      "fit-snapshot: PATTERNS_MIN_BASIS not found in functions/src/patternsFit.ts",
    );
  }
  return Number(m[1]);
}

// The publication's own precision (publishableLoadings rounds to 4 dp),
// so a derived number never claims more digits than its input has.
const round4 = (x) => Math.round(x * 10000) / 10000;

/**
 * The committed block, or null when the fit has not published yet.
 *
 * `doc` is the DECODED loadings document (see question-scorecard.mjs's
 * decode()), `basis` the floor from readMinBasis. Everything is
 * zero-safe: an empty `q` and an n of 0 are states the fit really
 * publishes (a question seeded but not yet folded), and a NaN on the
 * artifact would be indistinguishable from a bug in this file.
 */
export function fitSnapshot(doc, { basis } = {}) {
  if (doc == null) return null;
  if (!Number.isFinite(basis)) {
    // Refusing beats guessing: `ready` is a count against this floor and
    // means nothing without it (the readMinBasis reasoning, one call on).
    throw new Error("fit-snapshot: fitSnapshot needs a numeric { basis }");
  }

  // A raw REST body (`{name, fields, …}`, what `curl` on the document
  // returns) has no `q` and would fold into a plausible "published,
  // nothing fitted" block — every field present, every one zero — which
  // is the D276 class exactly. The CLI decodes that shape before calling
  // here; this refuses it if the decode was skipped.
  if (doc.fields && typeof doc.fields === "object" && !doc.q) {
    throw new Error(
      "fit-snapshot: a raw Firestore document (`fields`) — decode it first" +
      " (question-scorecard.mjs decodeLoadings)",
    );
  }
  const q = doc.q && typeof doc.q === "object" ? doc.q : {};
  // Sorted so the committed diff moves only when a number moves — the
  // REST reader hands back whatever key order the wire had.
  const qids = Object.keys(q).sort();

  const perQ = {};
  const ns = [];
  for (const qid of qids) {
    const L = q[qid] || {};
    const v = Array.isArray(L.v) ? L.v : [];
    const n = Number(L.n || 0);
    const sum = Number(L.sum || 0);
    ns.push(n);
    perQ[qid] = {
      n,
      disc: round4(Math.sqrt(v.reduce((s, x) => s + Number(x) * Number(x), 0))),
      // Refuse on n rather than divide by it — the app's own idiom, and
      // the difference between "nobody has answered" and NaN.
      mean: n > 0 ? round4(sum / n) : null,
    };
  }

  const sorted = ns.slice().sort((a, b) => a - b);
  const ready = ns.filter((n) => n >= basis).length;

  const quality = doc.quality
    ? {
        day: doc.quality.day ?? null,
        // `?? null` throughout, never `?? 0`: the fit writes every one of
        // these fields on every publish (publishableQuality,
        // displacementSummary), so a missing one is a malformed doc, and
        // 0 there would be read as a measurement — "no drift", "no
        // surprisal" — where the honest statement is "no value".
        n: doc.quality.n ?? null,
        bits: doc.quality.bits ?? null,
        floor: doc.quality.floor ?? null,
        // How many questions cleared the per-question floor that day —
        // the perQ map is already floored by the fit (D325), so its size
        // IS the count, and the map itself passes through below.
        questionsAboveFloor: Object.keys(doc.quality.perQ || {}).length,
        // As published: the fit bounds the series to 90 rows
        // (PATTERNS_QUALITY_DAYS, the agg-events TTL), so truncating
        // again here would only hide rows the doc already fits.
        series: doc.quality.series ?? [],
        note: doc.quality.note ?? null,
      }
    : null;

  const displacement = doc.displacement
    ? {
        space: doc.displacement.space ?? null,
        // Same rule as the quality block: a first publish writes its own
        // honest zeros (n: 0, mean: 0 …); only a malformed doc reaches
        // these defaults, and null is the word for that.
        n: doc.displacement.n ?? null,
        moved: doc.displacement.moved ?? null,
        mean: doc.displacement.mean ?? null,
        p50: doc.displacement.p50 ?? null,
        p90: doc.displacement.p90 ?? null,
        max: doc.displacement.max ?? null,
        // Movers only, as published — bounded by the core corpus (D161).
        perQ: doc.displacement.perQ ?? {},
      }
    : null;

  return {
    source: FIT_SOURCE,
    publishedAt: doc.at ?? null,
    lastDay: doc.lastDay ?? null,
    k: doc.k ?? null,
    folded: doc.folded ?? null,
    questions: qids.length,
    basis: {
      floor: basis,
      ready,
      n: {
        min: sorted.length ? sorted[0] : 0,
        // Nearest-rank (ceil(0.5·len) − 1, the LOWER middle on an even
        // count) — displacementSummary's own `rank` in patternsFit.ts, so
        // the two p50 fields in this one block are the same operation.
        p50: sorted.length ? sorted[Math.max(0, Math.ceil(0.5 * sorted.length) - 1)] : 0,
        max: sorted.length ? sorted[sorted.length - 1] : 0,
      },
    },
    // null rather than an omitted key: a doc predating D325 (or a run
    // with nothing to score) is a STATE, and a missing key reads as a
    // reader that forgot to look.
    quality,
    displacement,
    items: { note: ITEMS_NOTE, perQ },
  };
}

# Requests — questions

The bridge queue (CHARTER §8): what this theory wants tracked,
gathered or computed in the real product. One entry per wish:
**what · why the theory needs it · what it would make measurable.**
Central writes verdicts to `bridge/VERDICTS.md`; this lane never
implements its own requests.

- 2026-08-27 · **what**: publish per-core-question item-information
  profiles from the nightly fit — for each fitted question, alongside
  the loading vector it already publishes, a discrimination summary
  (how strongly the answer predicts position in the fitted space) and
  its split evenness, as one committed artifact readable like the
  scorecards. · **why**: que-2 (cited) says the perfect bank estimates
  item parameters continuously and selects on them; the nightly fit
  already computes these in all but name, so this is exposure of an
  existing computation, not new measurement. · **measurable**: que-2's
  rung to *measured* (do live item parameters behave as IRT predicts —
  stability across refits, drift per Stocking's warning); que-5's spine
  claim (does the current core set look chosen for within-bank
  information or for joint-space identification); que-3's loop (do
  shape-level authoring rules predict measured discrimination).

- 2026-08-29 · **what**: publish refit-to-refit loading-vector drift
  per core question from the nightly fit — dissimilarity between
  consecutive fits' loading vectors after orthogonal-Procrustes
  alignment of the loading matrices, published alongside a refit-noise
  null (expected dissimilarity between refits with no true drift,
  e.g. from split-half or resampled refits), as a committed artifact
  readable like the scorecards. · **why**: que-8 prices the spine
  trade with a depreciation term per item-role branch; within-bank
  loading drift is the anchor/complementary branch's depreciation
  curve, and without the alignment step and the null the number
  conflates true drift with rotational indeterminacy and refit noise
  (cen-1/tst-7's indeterminacy warning). The linking branch's
  survival factor (cross-instrument map drift) is named in que-8 but
  not requestable until cross-instrument maps are estimated at all.
  · **measurable**: que-8's depreciation curve (one of its weight's
  three factors); que-2's rung toward *measured* — whether live
  calibration drifts as Stocking's warning predicts.

- 2026-09-01 · **what**: publish a per-core-question shape-feature
  table — one committed artifact keyed by question id, joinable to
  the first row's item-parameter artifact: the features already
  committed on the bank (`type`, option count, `tone`, `cat`, D187's
  `rates`) plus derived ones, each by a named method (length in words
  from the prompt; reading level by a named readability index;
  concreteness by a named published norm lexicon; moral-emotional and
  out-group language counts by Brady's and Rathje's own published
  dictionaries). · **why**: que-3 (cited) says the production loop
  closes through live calibration with a learned feature→parameter
  map as its prior; the explanatory regression that would learn that
  map (Fischer's LLTM through De Boeck & Wilson's covariate frame)
  needs the feature side as one table. Most raw features already
  exist on the committed bank — missing are the derived features and
  the single joinable publication. Cheap: annotation and derivation
  over the committed bank, no new measurement. · **measurable**:
  que-3's rung toward *measured* — whether shape features predict
  this bank's own measured discrimination and split evenness better
  than a predict-the-mean baseline, in BEA 2024's form; and the
  guardrail empirically — whether the bank's vintages (D97) drift on
  the moral-emotional / out-group features as measured splitting is
  optimized for.

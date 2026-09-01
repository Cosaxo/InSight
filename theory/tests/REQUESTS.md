# Requests — tests

The bridge queue (CHARTER §8): what this theory wants tracked,
gathered or computed in the real product. One entry per wish:
**what · why the theory needs it · what it would make measurable.**
Central writes verdicts to `bridge/VERDICTS.md`; this lane never
implements its own requests.

- 2026-08-27 · **what**: per-item repeat summaries from the pulse
  roster — the one shipped surface where the same person answers the
  same item on many separate days (`content/pulse-questions.json`):
  per-item repeat counts, within-person answer-change rates, and
  time-gap distributions, published as a committed aggregate artifact
  readable like the scorecards; aggregates only, no new collection.
  Alongside, and also derivable today: per-item D86 edit *rates* (a
  weak retest-instability proxy — the edit overwrites `optionIdx`, so
  only rates survive, never pairs). · **why**: tst-2 (cited) predicts
  single answers are noisy while each person's distribution is stable;
  tst-7 (cited) says within-person variance should run several times
  the between-person estimate; the pulse roster is the only shipped
  data that can show either on InSight's own numbers. · **measurable**:
  within-person spread as a stable individual difference (Fleeson's
  density-distribution claim, locally); first bounds on the
  within/between variance ratio; que-2's retest-calibration input.
- 2026-08-27 · **what**: era-scoped instrument item instances —
  re-serve instrument items as fresh instances per era so the same
  person yields genuinely repeated measurements. Honestly labelled:
  this is a NEW SERVING POLICY, a bridge decision, not an aggregate
  exposure — D5 is one-answer-per-item by doc id, and D86's edit
  overwrites rather than accumulates, so the data this theory needs
  cannot be derived from anything the store holds today. · **why**:
  tst-6 (argued) says the between-person audit layer carries
  within-person couplings only under an ergodicity assumption that
  must be tested, not assumed; tst-4 needs trajectories; without
  repeated instrument measurements neither has a route to *measured*.
  · **measurable**: within-person loadings against the published
  between-person loadings (tst-6's test); 'has your openness moved'
  reported with uncertainty (tst-4); retest effects per item (que-2).
- 2026-08-29 · **what**: per-instrument population density aggregates
  that carry JOINT structure — two artifacts, both committed and
  population-level only. (i) Coarse joint binned counts over each
  instrument's dimensions (4–5 bins per dimension), with a stated
  minimum-cell-count suppression floor and the total suppressed mass
  reported — marginals plus a covariance matrix alone are the
  sufficient statistics of a single Gaussian and are provably blind to
  the multimodality this row exists to find, so they serve only as the
  stated baseline, not the ask. (ii) A committed offline mixture-fit
  artifact: fitted component means, weights and covariances with
  BIC/held-out log-likelihood across candidate component counts, plus
  each authored signature's distance to the nearest fitted component
  mean and the fitted weights beside the authored `share` values.
  · **why**: tst-8 (argued) commits to regions derived from real
  population structure, and tst-5 (cited) shows both that cluster
  solutions are fragile and that the strongest contrary evidence says
  most people may sit in no distinct region at all — so the commitment
  must be tested, not assumed; the shipped archetypes
  (`archetype-data.js` on main) are authored signature vectors with
  hand-written shares, and nothing today says whether InSight's own
  population has density concentrations anywhere, let alone near those
  signatures. · **measurable**: whether real density peaks exist in
  instrument space (Gerlach's test, locally — including the negative
  outcome tst-5's contrary evidence predicts); the distance between
  authored signatures and real peaks; fitted weights versus authored
  shares; the fraction of the population inside any distinct region
  (Freudenstein's 42% question, locally) — the difference between a
  data-anchored region system and a grid that only looks like one.
- 2026-09-01 · **what**: a committed population-level cross-axis
  structure artifact over the observed test-score shelf: correlation
  AND covariance matrices over all flattened instrument axes (the
  `test:dim` coordinates the Kindred metric consumes — 22 axes over
  the four instruments), with per-axis means and SDs, per-pair n, the
  eigenspectrum and first-eigenvalue share; computed from the same
  published per-user results the similarity field already reads
  (D98), aggregates only, no new collection. Honest caveats stated up
  front: post-D121 most stored results are passive-fold estimates
  with axes resting on as few as 2 items (`MIN_AXIS_ITEMS = 2`), so
  attenuation is severe and coverage skewed — observed-score
  correlations are lower bounds (que-2's item parameters would
  disattenuate them), and they diagnose the OBSERVED shelf, not the
  latent couplings tst-6 reserves for the joint model. · **why**:
  tst-9 (cited) says correlated axes make separate and joint scoring
  non-interchangeable, and tst-1 (argued) argues the shipped Kindred
  ranking assumes axis independence at one load-bearing site (the
  λ=6 shrinkage calibration, whose zero-similarity simulation drew
  axes independently; the metric's equal weighting is the other,
  implicit, half) — but nothing today says how correlated InSight's
  own axes actually are, and that number is the SINGLE hinge for
  tst-1: near-zero local correlations defeat both its consumer
  argument and its precision argument; strong ones confirm both.
  · **measurable**: the empirical per-axis gap distribution and
  spread against the D277 prior's independence-calibrated constants
  (shipped numbers tested on shipped data — means and SDs against
  the assumed N(50,15), the width-spread against the λ=6
  simulation); the shared-variance fraction the equal-weight
  distance re-weights (first-eigenvalue share); tst-1's route from
  argued toward cited/measured on local numbers.

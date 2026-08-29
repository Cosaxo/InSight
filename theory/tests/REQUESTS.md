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

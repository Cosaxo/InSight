# Requests — pattern

The bridge queue (CHARTER §8): what this theory wants tracked,
gathered or computed in the real product. One entry per wish:
**what · why the theory needs it · what it would make measurable.**
Central writes verdicts to `bridge/VERDICTS.md`; this lane never
implements its own requests.

- **2026-08-26 · A standing prequential benchmark on the nightly fit.**
  **What:** each night, before folding day D's ledger, score the current
  model's one-step-ahead predictions on day D's (person, question)
  answers — held-out predictive log-loss (surprisal bits), per question
  and pooled — and publish it beside the loadings with the basis counts.
  Zero extra reads (the fit already folds exactly that ledger) and one
  dot product per observation of extra compute.
  **Why the theory needs it:** pat-6 (cited) makes engine choice an
  empirical measurement — a data-volume crossover exists where a learned
  sequence engine would beat the factor engine, and locating it needs a
  standing number any candidate engine must beat on the same log;
  pat-2/pat-7 need the audit layer's own predictive power on record for
  the faithfulness comparison to ever be computable.
  **What it makes measurable:** the factorization's real predictive
  value per question; the pat-6 crossover (any future engine judged on
  the same prequential log); and drift — a question whose surprisal
  rises is a question whose meaning is moving (pat-5).
  **CROSSED 2026-08-27 (recorded 2026-08-28):** ruled worth-building
  2026-08-26 (`bridge/VERDICTS.md`) with the reporting-floor condition,
  carried by the owner as **D325**, the bridge's first crossing: the
  nightly fit publishes a `quality` block on `v2_patterns/loadings` —
  prequential-ONLINE exactly as requested (the person-vector updates
  within the day as the fold proceeds), the newest day's pooled mean
  surprisal with its basis, a ≤90-day pooled `series`, per-question
  daily means floored at `PATTERNS_QUALITY_FLOOR = 8` (the verdict's
  condition, priced by the governed process at the repo's standing
  believable-basis figure), and the required note that it measures the
  fit, not the device Oracle's separate ridge solve. Code-verified
  first-party this run (`functions/src/patternsFit.ts`,
  `functions/src/patterns.ts`). The open half is reading its values
  from `main`: the map lane's 2026-08-28 row ("fit scorecard readable
  from `main`") asks exactly that, explicitly on behalf of pat-6 and
  cen-2 too — seconded, not duplicated.

- **2026-09-02 · A pairing ledger on the published aggregates.**
  **What:** for every pair of axes the product holds or is about to
  hold (daily answers, the four tests and nine lenses, the pulse
  roster, the follow graph and duel record, a genome import when it
  exists), publish nightly the count of people observed on BOTH — and,
  for any pair whose count is zero at a declared covariate set (the
  anchors), the conditional Fréchet interval that is all the two
  marginals can say about the pair's coupling, in place of a point.
  Zero extra billed reads in principle: every count is a fold over
  ledgers the nightly jobs already read, and the interval is
  arithmetic on published marginal cells.
  **Why the theory needs it:** pat-4 (cited this run) makes pairing the
  thing that IDENTIFIES a cross-axiom coupling, not merely what
  sharpens it — a pair with no joint observation is bounded, not
  estimated, and no crowd size changes that — and pat-12 makes the
  pairing a design variable whose marginal value is computable only
  against a standing count; cen-2's portfolio prices crowd value by
  pairing and today has no number to price it with.
  **What it makes measurable:** which couplings the product can
  publish as points at all; the width of what it can honestly say
  about the rest; and, over time, whether the serving policy is buying
  identification where the portfolio says it should — the first
  reading of pat-12's allocation arithmetic on the product's own
  numbers, and the value pat-4's path to `measured` would check
  against.

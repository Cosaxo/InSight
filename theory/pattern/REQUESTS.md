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

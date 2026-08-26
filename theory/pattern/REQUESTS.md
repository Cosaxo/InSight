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

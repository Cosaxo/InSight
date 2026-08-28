# Requests — database

The bridge queue (CHARTER §8): what this theory wants tracked,
gathered or computed in the real product. One entry per wish:
**what · why the theory needs it · what it would make measurable.**
Central writes verdicts to `bridge/VERDICTS.md`; this lane never
implements its own requests.

- 2026-08-28 · **A standing replay audit: recompute a sample of
  published aggregates from the answer documents and publish the match
  rate beside them.** The shipped repair tool already contains the fold
  (`functions/src/replay.ts` rebuilds any aggregate from the per-person
  answer docs and reports `cappedDims`, the dimensions where eviction
  makes the rebuild order-dependent); the wish is to run it as a
  scheduled sample — a few questions a night — and publish three
  numbers: aggregates compared, exact matches, and how often a compared
  aggregate had a saturated dimension. · Why the theory needs it: db-3
  (cited) claims the read side is a deterministic fold of the ledger and
  names the exact boundary where determinism fails (non-commutative
  eviction); today that boundary's incidence is unmeasured — the theory
  can say where replay is *a* fold rather than *the* fold, but not how
  often that case occurs in the real corpus. · What it would make
  measurable: fold determinism in practice (drift between incremental
  and batch folds, which would also catch trigger bugs early), the
  real-world frequency of the saturated-dimension case, and the first
  `measured`-rung evidence this lane's graph could carry.

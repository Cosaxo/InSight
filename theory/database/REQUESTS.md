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

- 2026-09-02 · **Every published aggregate names its serving design, and
  a tail aggregate carries a sampled seen-denominator.** What: one small
  field on every published aggregate document saying under which
  serving design its inputs arrived — `core` (served to everyone,
  unpersonalized, D161) or `tail` (personalized page sizing, D317) with
  the policy version — and, for tail questions, the per-question
  seen/answered/passed buckets the anonymous attention shards already
  collect (D271) folded into a published denominator beside the count.
  · Why the theory needs it: db-8 (cited) holds that an aggregate is a
  population claim only if its read model carries its sampling design,
  as recorded propensities or as a design that makes selection
  ignorable; the shipped app removes only the serving half for the
  Mirror (core only, D161) and cannot take the full propensity branch
  (serving is knowable server-side after D316/D317, but the response
  side stays device-local, D163/D317), so today a tail aggregate and a
  core aggregate look identical on the wire while meaning different
  things.
  · What it would make measurable: the gap between a question's
  served and answered populations per policy version — the first
  number that could say how much personalization bends a tail cell —
  and whether the core/tail split is doing the work SCALE-PLAN §1 says
  it does.
- 2026-09-02 · **A fold cursor on every read model: the ledger position
  each published number was folded through.** What: the aggregate,
  loadings and engagement documents each record the transaction-time
  pin of their inputs — the ledger day or event position and the fit
  timestamp already written on `v2_patterns/loadings` (`at`) and
  `v2_engagement_daily` (`meta` cursor), extended to `v2_question_aggs`
  — so any published number can be re-derived as-of its own pin. · Why
  the theory needs it: db-9 (cited) claims a per-read-model transaction
  time is what makes a published cross-source number reproducible, and
  marks that part as this lane's inference with no source either way;
  the shipped answer doc is uni-temporal (an edit moves `optionIdx` in
  place, D86), so a pre-edit aggregate is reproducible only inside the
  90-day ledger horizon. · What it would make measurable: as-of
  reproduction of a published aggregate against the standing replay
  audit (2026-08-28 row) — matching a number to the ledger position it
  was published from rather than to the ledger's current state — which
  separates fold drift from legitimate later edits, the two the replay
  audit alone cannot tell apart.

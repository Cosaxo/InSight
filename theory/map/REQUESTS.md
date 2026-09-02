# Requests — map

The bridge queue (CHARTER §8): what this theory wants tracked,
gathered or computed in the real product. One entry per wish:
**what · why the theory needs it · what it would make measurable.**
Central writes verdicts to `bridge/VERDICTS.md`; this lane never
implements its own requests.

- **2026-08-26 · inter-fit layout displacement** · What: retain each
  nightly `v2_patterns/loadings` publish (or publish beside it a
  per-question displacement summary against the previous fit, computed
  after rotation alignment). · Why: map-3 (`cited`) holds that layout
  stability is a measured trade-off and that per-update movement should
  be a published, budgeted quantity; today each fit overwrites the
  last, so the teleport magnitude a returning user actually experiences
  between fits is unmeasured, and map-3 cannot rise to `measured`
  against InSight's own numbers. · Measurable: the distribution of
  per-question position change between consecutive fits — the number
  that decides whether stability work (anchoring, incremental updates)
  is worth building, and the display-side analogue of pat-2's
  recomputability.
  **CROSSED 2026-08-27 (recorded 2026-08-28):** ruled worth-building
  2026-08-26 with the method corrected (no rotation alignment — the
  shipped fit is one persistent model folded forward, so a Procrustes
  step would subtract real movement; all fitted questions, not the
  gate's ~24), carried by the owner as **D325**, the bridge's first
  crossing: `displacementSummary` now publishes on
  `v2_patterns/loadings` — loading-space L2 over the published 4 dp
  vectors, publish-to-publish, `space: "loading"` stated on the doc,
  summary over every question present in both publishes, movers-only
  `perQ`. Code-verified first-party this run
  (`functions/src/patternsFit.ts`, `functions/src/patterns.ts`).
  Drawn-plane displacement deliberately stays unbuilt (the layout runs
  on the device). The open half is the row below.

- **2026-08-28 · fit scorecard readable from `main`** · What: expose
  the nightly fit's published `quality` and `displacement` summaries
  in a committed artifact — e.g. a few fields joined onto
  `content/scorecard.json`'s existing regeneration, or a small
  committed snapshot beside it; a weekly cadence would already
  suffice. · Why: D325 built the instruments this theory asked for,
  but their output lives only on the `v2_patterns/loadings` doc in
  Firestore, and §4's `measured` rung is defined against numbers
  readable from `main` — so map-3 (and the fit-quality baselines
  pat-6 and cen-2 are defined against) can see the instrument exist
  without ever seeing a number from it. · Measurable: map-3's
  structural-stability thesis against the real inter-publish
  displacement distribution (rises `cited`→`measured` the first time a
  committed value can be read and quoted); the same snapshot would
  give pattern's prequential benchmark and central's portfolio metric
  their first `main`-readable series.

- **2026-09-02 · binned crowd density over a declared plane, published
  beside the loadings** · What: nightly, beside `v2_patterns/loadings`,
  a per-cell count of person vectors θ̂ over a DECLARED, cohort-independent
  plane of the published loading basis — cells, never persons — with
  `plane` (the components used), cell size, `basis` (which persons
  counted, e.g. those at or above `PEOPLE_MIN_BASIS` answers on fitted
  questions), the total mass, and a **declared minimum cell count**
  below which cells are reported only as suppressed mass — a
  RELIABILITY floor in the tests lane's joint-density precedent (bridge
  item 3), stated as such; if central or the owner reads it as a privacy
  floor it is a D334 owner-ask and this row says so rather than
  deciding it. No retained per-night history unless a scrub rule for
  archived nights is stated. · Why: map-1 (argued) draws country and
  world as density over published bins at a fixed projection, map-13
  (argued) says a cohort is a density and never a centroid, and map-5
  (argued) says the world-scale view is one published artifact the
  phone only draws — none testable while the only crowd the map can
  draw is the viewer's recency-capped orbit. `docs/PEOPLE-MAP.md` §7
  deferred the whole-world map on a per-person positions doc for four
  reasons: size, erasure, rotation, and that a per-person derived
  summary is a new presentation of people and an owner call. Cells
  answer the first two by construction (the grid is the size; the fold
  re-runs, so no erasure arm) and meet the third on the fit's persistent
  basis (one model folded forward, D325 — the grid drifts with the
  basis exactly as the loadings do, D325's displacement number measuring
  it; no alignment step, and a versioned re-basis event if the fit is
  ever restarted). The fourth is NOT answered here and this row does not
  claim it is. Exposure arithmetic for central's verdict, stated
  honestly: this is a **bounded new exposure at cell grain, not none**.
  Any signed-in user can already solve a named person's θ̂ on the device
  from their public answers (PEOPLE-MAP §1), but only over a bounded
  recency-capped sample; a public grid adds population-scope facts the
  device cannot reach — a count-1 cell would say that exactly one person
  in the population sits there, and nightly unsuppressed grids under a
  drifting basis would compose toward reconstruction — which is exactly
  what the floor and the no-history rule bound, and why the per-person θ
  doc stays denied as today ("a summary nobody signed up to be read
  AS", the rules' own sentence, is answered by publishing no cell that
  is one person). cen-1's publication rule (population statistics,
  never per-person latent draws) is met at the floor and violated below
  it, which is the floor's second reason. · Measurable: whether the
  crowd's density at world zoom is drawable from aggregates alone
  (map-5's zero as a fact rather than a design choice); the crowd's
  THINNESS at world zoom — the empty-cell fraction, the suppressed mass
  and the count distribution, map-4's thin-data form and the open-front
  question map-1 was seeded with; a second D325-style series (cell-mass
  displacement publish to publish) beside the loadings' own — map-3's
  stability thesis on the crowd rather than the questions; and the
  population-density object the tests lane's joint-density request
  wants, here in the shared space rather than per instrument — the two
  requests fold naturally as one artifact family.

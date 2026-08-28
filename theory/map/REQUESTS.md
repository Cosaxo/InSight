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

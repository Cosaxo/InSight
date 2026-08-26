# The map axiom — current theory

*Regenerated from `graph.json` on 2026-08-26; the graph is the data,
this page is its readable face. Status counts: 3 cited · 1 argued ·
1 conjecture.*

Display theory: how everything the axioms measure should be drawn,
mapped and navigated — perfectly and most efficiently. This lane reads
the other theories; it never writes them.

## The shape of the theory

One geometry, honestly labeled, structurally stable, drawn from public
numbers. The five claims:

### map-1 · One geometry at every scale — `conjecture`

The perfect display is a single navigable space shared by every scale
(you, your city, the world) and every axiom — zooming changes cohort,
not metaphor; each axiom is a region or direction, not a separate
screen. InSight already runs one telescope (you→world) and one plane
(the patterns Map); this claim says they should be the same object. It
stays conjecture until the geometry is specified — what distance,
direction and size mean at every zoom without a metaphor switch — and
it depends on map-2's channel discipline to be specifiable at all.

### map-2 · Every channel means exactly one thing per view — `cited`

Distance means exactly one thing per view — and so does every other
channel the frame contains. The rule is normative; what the empirical
spatialization literature grounds (five sources, Fabrikant–Montello
line) is the premise it rests on: **every channel present gets read,
assigned or not.** Viewers default hard to straight-line distance —
instruction wording cannot move them off it (Fabrikant & Montello
2008) — yet the mapping from distance to *meaning* is not automatic,
and competing structure overrides distance when present: drawn regions
beat metric distance, clusters move similarity judgments, and the
information-landscape metaphor outright fails with lay users. Two
design inferences follow: the view's semantic table must cover every
channel the frame contains, and the perfect display omits channels it
has no meaning for. One carve-out, forced by map-4: a channel may
carry its one meaning plus a *declared* modifier of that meaning's
evidential weight (the value-suppressing-palette pattern) — composite
meaning declared, never meaning double-booked. InSight's live shadow:
the People lens states its distance out loud; the rest of any frame
owes the same sentence.

### map-3 · One persistent space; stability is structural and priced — `cited`

Authored anchors and learned embedding combine in one persistent space
that updates incrementally — never re-fit-then-realign. The mental-map
premise began as an assumption (Misue et al. 1995), and twenty years of
experiments made it conditional: stability demonstrably helps
*orientation and navigation* in an evolving layout — exactly the Map's
task class — while general-comprehension benefits remain unproven, and
the effect is non-monotonic: high or low preservation both beat the
middle ("Extremes Are Better"). Read by analogy (this lane's own
inference, recorded as such): half-pinning is the worst case, so
anchoring must be structural, not cosmetic. The projection literature
prices the mechanism — movement penalties trade fidelity for coherence
(dynamic t-SNE), the trade-off is now formally measurable (Vernier
2020), anchor-guided projections exist peer-reviewed (Vernier 2021) —
and two results push past the seed: post-hoc Procrustes alignment is
itself a documented noise source (Dubossarsky 2019, by analogy from
diachronic embeddings), and parametric maps embed new data online with
no re-fit (Sainburg 2021). Per-update movement should be a published,
budgeted quantity — the display-side analogue of pat-2's auditability
(the depends edge). Tooling note: AlignedUMAP has no method paper by
its author's own statement; cite 2-MAP and the Rauber/Vernier line
instead.

### map-4 · Uncertainty is geometry — `cited`, narrowed

The perfect display makes thin data look thin: **outcome** uncertainty,
encoded **frequency-framed in the mark itself**. The narrowing is the
finding, and it separates two questions. *How* to draw: bar+error-bar
actively misleads (within-the-bar bias); marks that carry their own
evidence change decisions (value-suppressing palettes; 50-quantile
dotplots +4.4 pp of optimal payoff vs a no-uncertainty control,
full-text-verified); discrete-draw framings beat static densities
(hypothetical outcome plots, quantile dotplots). *Which* to draw:
inferential uncertainty drawn correctly *inflates* perceived effects
(confidence vs prediction intervals) — so 'thin' means the spread of
outcomes, never the precision of a mean. The node records its own
counter-evidence so no later run re-inflates the seed: text intervals
outranked density displays on point estimates; ensembles over-weight
their members; intervals get re-read as deterministic bounds; one study
found mixed accuracy effects; and the field's methodologists warn the
experimental genre itself is noisy. Uncertainty shown is not honesty
achieved — the display states which uncertainty it drew. This extends
InSight's n=0-draws-nothing refusal continuously, and its suppressed
palettes enter map-2's table as declared modifiers.

### map-5 · Efficiency is a display property — `argued`

The perfect map is drawable from published aggregates on a phone, with
no per-view server work. A display needing a server render per
interaction is a different, worse product — slower, costlier,
structurally tempted toward per-user computation — and a device-drawn
map from public artifacts stays independently verifiable: anyone can
recompute the picture from the same numbers.

## Open front

map-1 is the unproved spine: the other four are constraints any
geometry must satisfy, but the geometry itself — one space, every
scale, every axiom — is still unspecified. The next runs' work: specify
it against map-2's channel table, map-3's persistence requirement, and
map-4's uncertainty encoding, and say what the crowd's thinness looks
like at world zoom. The lane's first bridge request (inter-fit layout
displacement) is what would let map-3 rise to `measured` against
InSight's own published fits.

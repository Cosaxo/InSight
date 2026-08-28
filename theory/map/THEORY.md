# The map axiom — current theory

*Regenerated from `graph.json` on 2026-08-28; the graph is the data,
this page is its readable face. Status counts: 4 cited · 1 argued ·
1 conjecture.*

Display theory: how everything the axioms measure should be drawn,
mapped and navigated — perfectly and most efficiently. This lane reads
the other theories; it never writes them.

## The shape of the theory

One geometry, honestly labeled, structurally stable, drawn from public
numbers — and every cross-axis connection drawn with its population,
its decomposition and its basis. The six claims:

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

**Product note (2026-08-28, code-verified first-party).** The shipped
nightly fit already implements this node's structural half *in loading
space*: one persistent model folded forward, idempotent, consecutive
publishes sharing one continuous basis. And this lane's displacement
request crossed the bridge 2026-08-27 as **D325 — the bridge's first
crossing**: the fit now publishes a per-publish displacement summary
(loading-space L2 over the published 4 dp vectors, publish-to-publish,
deliberately unaligned, `space` stated on the doc). "Published" is
therefore real; "budgeted" is not yet — nothing consumes the number as
a threshold — and the drawn plane a reader's spatial memory actually
attaches to is a nonlinear device-side function of the basis that
stays unmeasured. Path to `measured`: the numbers live only on the
Firestore doc; the 2026-08-28 REQUESTS row (committed fit-scorecard
snapshot) is what would let this node rise on a real distribution.

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

### map-6 · A drawn connection declares its population, decomposition and basis — `cited`

This lane's answer to the charter's cross-connection mandate, and the
display-side counterpart of what the siblings have each concluded at
their own rungs: an honest coupling is published with its
decomposition (gen-11, bod-8), exchanged as statistics carrying their
basis (db-6), and split by level because between-person structure does
not carry within-person structure (tst-6 on tst-7). The drawn
connection is the last mile — it either preserves those declarations
into the frame or undoes the axioms' honesty at the moment of reading.

Two cited premises. **The level divergence is well documented — in the
statistics and methodology literature, not the visualization
literature** (the node keeps that distinction): ecological and
individual correlations can reverse in sign (Robinson 1950 — cited for
aggregate-vs-constituent only); subgroup reversal is common enough in
psychology to need a practical guide (Kievit et al. 2013); results on
between-person variation generalize within persons only under rarely
met ergodicity conditions (Molenaar 2004, theoretical warrant), with
within-person variance running two to four times the group estimate
across six repeated-measures samples (Fisher et al. 2018 — carried
with its published PNAS rebuttal); within- and between-person effects
are distinct estimands (Curran & Bauer 2011). Scope note: which
decomposition applies is per-pair — a genotype has no within-person
half; its declaration is gen-11's direct/nurture/mating split instead.
**Reading a drawn connection is unreliable in both directions, and
form modulates it**: aggregating data into larger categories raises
perceived causality, with text and bar rated most causal in the raw
comparison (Xiong et al. 2020); yet against a Bayesian benchmark
people underweight sample size and weigh disconfirming evidence over
confirming — and no tested design beat plain text contingency tables
(Kale et al. 2022) — so over-reading is not the only failure and a
better mark is not automatically a better inference. The fused form
loses to the plain one (connected scatterplots misread more than line
graphs while engaging more — Haroz et al. 2016); mix-effects remedies
build the decomposition into the mark (comet charts — Armstrong &
Wattenberg 2014, a design paper); and the dual-axis folklore is held
at its honest weight: most common guideline violation among misleading
charts in the wild (Lisnic et al. 2023, observational), an active
peer-reviewed defense exists (Brath et al. 2020/2022), no strong
controlled two-measure experiment found, and Isenberg et al. 2011 is
recorded as the trap it is (dual-*scale*, not dual-measure).

What no verified source carries is recorded in-node: nothing shows
readers map an aggregate display onto themselves, and nothing tests
whether readers distinguish within- from between-person structure in a
display at all. That absence is load-bearing: the frame must carry the
population because reader competence at recovering it has never been
demonstrated. Design consequences (this lane's own inferences, marked):
population and basis enter map-2's semantic table as part of a
channel's one meaning; between-person and within-person couplings take
*different geometries* — crowd structure as a field over people, your
own coupling as a trajectory over time — never the same mark shape; an
undecomposed composite drawn as one clean connector asserts a
mechanism nobody measured, so the mark carries the decomposition where
it exists and draws explicitly composite where it does not (map-4's
thin-data discipline applied to edges); and language is a legitimate
channel for low-n within-person couplings (Health Mashups' deployed
precedent), with the tension held openly that text drew the highest
causality ratings in Xiong's comparison — a sentence can state
population and basis, which an unlabeled mark cannot, and that is
where its honesty must come from.

## Open front

map-1 is the unproved spine: the constraints are now five (channel
semantics, structural stability, outcome uncertainty, device
drawability, connection declarations), but the geometry itself — one
space, every scale, every axiom — is still unspecified. The next runs'
work: specify it against those constraints, and say what the crowd's
thinness looks like at world zoom. The lane's first bridge request
crossed as D325 (the displacement instrument now ships); the open
request is the committed fit-scorecard snapshot that would let map-3
rise to `measured` on a real displacement distribution. map-6's two
recorded negatives (no study of readers mapping aggregates onto
themselves; none on distinguishing the two populations in a display)
are re-check items for future runs — one lead is parked in-node.

# The tests axiom — current theory

*Regenerated from `graph.json` (the graph is the data; this page is its
readable face). Last regenerated 2026-09-01. Nine nodes: four `cited`,
four `argued`, one `conjecture`.*

The subject is the perfect form of InSight's test axis: the logic test,
the four core instruments (Big Five · Politics · Values · Social) and
the nine lenses, treated as one measurement system rather than a shelf
of separate scores.

## 1 · One joint model — bounded by the between/within fork

**tst-1 (argued)** holds that the perfect axiom is one joint latent
model over all instruments: each instrument's dimensions are loadings on
a shared person-space, cross-instrument links are geometry rather than
authored lists, and a new lens is a new set of loadings, not a new silo.
Raised conjecture→argued 2026-09-01: its named test — a concrete
consumer that gets a different answer from the joint model than from
the shelf — was run against the product's shipped code, and the
adversarial pass's corrections are carried in the node rather than
papered over. The Kindred/similarity field
(`src/v2/data/similarity.ts`, D112/D277) is a shelf consumer in its
primary tier: 22 flattened axes over the four instruments, exactly 5
items per axis in the sit-down bank (as few as 2 where the passive
fold publishes), the mean absolute gap printed as `match` and the
prior-shrunk version of the same quantity ranked on as `raw`; logic is
excluded from the distance by design. One real axis-independence
assumption ships in that file — not two, as this run's seed draft had
it: `TYPICAL_AXIS_GAP`'s closed form is a person-to-person marginal,
invariant to cross-axis correlation, but the λ=6 shrinkage calibration
drew its zero-similarity simulation with axes independent, so
correlated axes would change the spread it was tuned to flatten. The
lane's own argument, held at `argued`: the shelf metric weights each
latent dimension by how many observed axes load on it, where a joint
metric (equal-weight per latent dimension — itself a named choice, not
geometry) weights each once. That is a *relative re-weighting*, not a
k-fold amplification — the mean cancels amplification exactly in the
one-factor limit, uniform loadings null it, and 5-item axis
unreliability compresses it — but where factors are unevenly
represented across the 22 axes, rankings flip (worked three-axis
example in the node). Literature status, stated precisely: the
squared-distance/Mahalanobis version of this is textbook; no source
was found stating the mean-absolute, axis-profile, ranking-consequence
version — that composition is the lane's own, with Cronbach & Gleser
the one source genuinely in-register and Moshagen analogy only. The
single hinge, named as such: near-zero local correlations would defeat
*both* consumer arguments — the ranking one and the precision one,
whose entire mechanism is the correlations — so the 2026-09-01
REQUESTS row is the whole node's route upward. The precision consumer,
with the transfer caveat: Wang et al.'s less-than-half-the-items
figure holds under that study's simulated battery conditions and does
not transfer as a constant; what transfers is the regime — the gain is
largest for short, numerous, correlated tests, which at 5 items per
axis (2 in the passive fold) is exactly where this axiom lives, with
passive administration (tst-2) and per-era cadence (tst-4) making
items-per-reading scarcer still. A new lens as new loadings is de la
Torre & Patz's case exactly: it borrows the joint prior instead of
opening a silo from zero. Communality is honestly scoped: the cited
finding covers ability, personality and interests — nothing cited
covers politics, values or attachment inter-correlations, and logic,
the one ability member, is excluded from this very metric — so for
this battery the correlation premise is analogical until measured.
Two tensions are recorded open rather than settled: the perfect form
*breaks* D277's rank-monotonicity invariant (D277 split printed from
sort key while guaranteeing nobody ranks above a visibly better
printed number; a joint metric would rank a printed 84 above a printed
91 — the lane argues the break, since under correlated axes the
printed sentence itself explains a distortion, but records it open);
and a person-to-person ranking is a per-person output over latent
estimates tst-7 calls indeterminate, where tst-6 settles publication
to population-level sufficient statistics — so the perfect form's
ranking must carry indeterminacy through the model
(plausible-value-averaged ranks with rank uncertainty, never latent
coordinates), and whether an order over named people respects tst-6's
boundary at all stays an open problem. Bounds: "one model" means one
hierarchical model per tst-6's fork; tst-3's two item families remain
per-family link functions; embedding, not exhaustion, per tst-6.

**tst-9 (cited)** is the scaffolding under it, facts only (the tst-7
pattern): multidimensional IRT scoring that exploits cross-trait
correlations reaches the same precision with less than half the
comparable items of one-test-at-a-time scoring, the gain largest for
short tests in large batteries — a figure scoped to that study's own
simulated battery conditions, with the direction and regime being
what transfers (Wang, Chen & Cheng 2004) — and the real-data
application is most efficient for highly correlated abilities across
multiple short tests (de la Torre & Patz 2005 — no quantified gain
visible at this run's verification grade, so none claimed);
multifactorial item responses do not by themselves justify subscale
scoring — the settling questions include how much reliable variance
subscale scores provide after controlling for a general factor
(Reise, Bonifay & Haviland 2013), and the alternative structural
models for hierarchical constructs differ in model-based score
reliabilities and purpose (Brunner, Nagy & Wilhelm 2012); model
choice changes downstream covariate correlations up to reversing
their sign (Moshagen 2023, cited without pagination — DOI-grade
verification only); profile similarity decomposes into elevation,
scatter and shape, and reducing a configuration to one index loses
information (Cronbach & Gleser 1953); and ability, personality and
interest measures show cross-domain communality, organized as four
trait complexes — patterned, concentrated in complexes, not uniform,
a hedge the claim string itself now carries (Ackerman & Heggestad
1997; the commonly quoted meta-analytic r values are table-level
content unverifiable at this run's grade and are deliberately not
cited). Its three `supports` edges are argued in the node: to tst-1
(all five facts are its scaffolding), to tst-3 (cross-domain
communality puts ability and disposition in one person-space even as
their link functions stay apart), and to tst-6 (a sign that flips
with model choice is estimator-level evidence that a published
coupling cannot be model-free).

**tst-3 (argued)** splits the item side: ability (logic, scored against
a key — guessing and ceilings matter) and disposition (self-positioning
— desirability and reference-group effects matter) need different link
functions into the one shared space. Treating logic as just another
instrument, or the instruments as soft ability, are the two symmetric
mistakes.

**tst-7 (cited)** is the grounded scaffolding: two facts any joint
person-model must respect. First, between-person structure generalizes
to within-person structure only under strict ergodicity conditions
rarely met by real psychological processes (Molenaar 2004) — and
empirically, within-person variance runs two to four times larger than
group-level estimates even where central tendencies show some agreement
(Fisher et al. 2018); multilevel covariance structure analysis models
the two levels separately (Muthén 1994), and within- and between-person
effects are distinct estimands to disaggregate (Curran & Bauer 2011).
Second, person-level latent scores are indeterminate estimates (Grice
2001); population statistics over latent variables need the
plausible-values treatment rather than point-score arithmetic (Mislevy
1991; Mislevy et al. 1992).

**tst-6 (argued)** composes those facts into this lane's answer to
central's identity question — whether the instrument space and the
cross-axiom combination space are one object (cen-1's original
assumption). The answer is a partial fork:

- **Embedding, not exhaustion.** One instrument-grade model can carry
  both item families over one person-space, but the test items span a
  *subspace* of the combination space; dimensions other axioms measure
  (regulatory-system parameters, chronotype) are identified by those
  axioms' measurement models. The tests space embeds as a
  sub-coordinate-system; an embedding is precisely not an identity.
- **Model, not score table.** What identity holds, holds at the level
  of the latent model, never a published table of person point-scores
  (tst-7's second fact). Couplings must be computed through the joint
  model with uncertainty, never as correlations between score columns
  — and the §9 boundary settles the publication form: the model plus
  population-level sufficient statistics, never per-person latent
  draws.
- **The fork: between is not within.** An audit layer fitted on
  between-person covariance cannot double as the coordinate system for
  within-person change (tst-7's first fact); "one published coordinate
  system" is really two linked published geometries in one hierarchical
  model — a between-person coordinate system plus within-person state
  spaces with their own estimated loadings.

**Resolved 2026-08-29**, with the full edge accounting: cen-1's
2026-08-28 revision adopted the fork wholesale — hierarchical
two-geometry form, aggregate-sufficient-statistics publication — and a
clause-by-clause re-read of the revised claim found no component still
in conflict. So the program's first `contradicts` edge is retired by
target revision; the `refines` edge is *kept* (the
embedding-not-exhaustion bound lives in cen-1's detail, not its claim
string, so tst-6 still sharpens it); and a `supports` edge is added —
a third option beyond the two central offered, stated as such — since
cen-1 did not merely narrow but adopted, making tst-6 argument *for*
the revised claim. The resolution is traced in tst-6's detail and the
LOG so the health summary's contradiction count returning to zero reads
as a closed work item, not a recording failure. One residual tension
stays open on purpose, recorded at tst-5/tst-8 rather than on cen-1:
the types literature's strongest contrary evidence cuts against
deriving stable person-regions from population structure at all.

## 2 · Administration

**tst-2 (cited)** — passive administration, instruments filled by
ordinary answering in the flow of life *on state-worded items*, is a
measurement-theoretically distinct administration rather than a budget
compromise. Cited premises: momentary capture minimizes the recall bias
that limits global retrospective self-report (Shiffman–Stone–Hufford
2008; Trull & Ebner-Priemer 2013); aggregation over occasions is what
makes anything trait-like stable (Epstein 1979); states vary enormously
but each person's density distribution of states is stable — mean
almost perfectly, and its variability, skew and kurtosis as individual
differences in their own right (Fleeson 2001) — and global Big Five
scores predict the *centre* of those distributions well while their
associations with the other distribution parameters largely vanish once
the mean and squared mean are controlled, the maximum excepted
(Fleeson & Gallagher 2009), which is exactly why the spread is not
recoverable from a sit-down score. The condition the 2026-08-27
adversarial pass made load-bearing: the EMA advantage attaches to the
item's referent, not the answering context — a global dispositional
item answered in a feed is still a global retrospective self-report, so
InSight's current bank inherits the delivery half of this node only,
and the perfect form re-words instrument items from global-dispositional
to momentary-state. The residue the node states plainly: any
superiority claim stays argued — no cited source runs the head-to-head
against a single-sitting battery, and Fleeson & Gallagher themselves
show a single sitting already finds the distribution's centre, so
passive administration's incremental value concentrates in the spread
and the trajectory, not the mean.

## 3 · Trajectory

**tst-4 (conjecture)** — a test result is a trajectory, not a number:
re-measure on a cadence, report change with its uncertainty. Depends on
bod-5's within-person design-grain argument (not its sleep-scoped
ordering clause) and que-2's item parameters (retest calibration); the
bod-5 edge, typed `supports` since creation while the detail said
depends, was corrected to `depends` 2026-08-29. tst-2's spread finding
and tst-6's fork both feed it: the within-person distribution is the
trajectory's raw material, and tracking movement honestly requires
within-person measurement theory, not a between-person coordinate
re-read over time.

## 4 · Archetypes — evidence and design, fissioned

**tst-5 (cited)** carries the evidence: personality's normal-range
latent structure is predominantly dimensional rather than taxonic, so
any archetype can only be a density region of continuous trait space
with a drawn boundary — and the region solutions the literature reports
are real but sample-, method- and preprocessing-fragile.

- **Taxa are poorly supported as the default.** The taxometric
  literature's quantitative review (177 articles, 311 findings,
  N=533,377 — a cross-domain figure spanning personality and
  psychopathology) finds 38.9% of findings taxonic on their face,
  falling to an estimated ~14% true prevalence once confounds are
  controlled, with taxonic findings scarcer in stronger and more recent
  studies and normal-range personality specifically among the domains
  giving categorical models little support (Haslam, Holland & Kuppens
  2012); and the canonical authored type system shows no support for
  truly dichotomous preferences or qualitatively distinct types — the
  MBTI measures four relatively independent continuous dimensions
  tracking aspects of four of the five major factors (McCrae & Costa
  1989; a 1989 volunteer sample of 468, a historical anchor). A type is
  therefore a *region*, and every boundary is drawn, not discovered.
- **Regions are real but fragile — documented on both sides.**
  Clustering Big Five data from four large self-selected samples (more
  than 1.5M respondents), Gerlach et al. (2018) report robust evidence
  for at least four distinct types — reading those as *density regions
  rather than taxa is this lane's operationalization-level
  interpretation, not the authors' own framing*, which speaks of
  distinct types and floated assessment utility. The
  resilient/overcontrolled/undercontrolled prototypes replicate across
  ages and methods (Asendorpf et al. 2001, an affirmative paper cited
  for exactly that), and the ARC structure holds over 40 years as
  "fuzzy rather than discrete" — gradients of similarity to three
  prototype profiles, not partitions (Chapman & Goldberg 2011). The
  instability: none of the prior literature's person-factors replicated
  across random subsamples of 1,540 Q-sorts — the two that did
  replicate were mean-level artifacts, and what survives
  standardization aligns with the five-factor dimensions (McCrae,
  Terracciano, Costa & Ozer 2006); a published reanalysis of Gerlach's
  data concurs the four clusters exist but finds only ~42% of the
  sample associated with any of them (Freudenstein et al. 2019 — its
  robustness prong is characterized only by title and verified
  exhaustiveness finding; Gerlach et al.'s Reply 2019 maintains the
  findings while sharing the assessment concern). Stated as contrary,
  not absorbed: McCrae et al. 2006 and the 42% are evidence *against*
  deriving stable person-regions from population structure at all —
  the node records that tension rather than resolving it. The
  traditions also disagree with each other (three Q-sort prototypes
  versus at least four density clusters), which is itself part of the
  fragility record.

**tst-8 (argued)** carries the design composition, split out so no
design clause rides a cited badge (the tst-2 precedent):

- **Placement** — answers central's 2026-08-28 question: types live in
  the between-person geometry. The anchor coordinate is the person's
  density-distribution central tendency — Fleeson's near-perfectly
  stable parameter, with the hedge that his stability is across
  occasions within experience-sampling windows, while a type-name's
  promise is longitudinal over years: that longer horizon is an
  assumption tst-4's trajectories exist to test. A type read off
  momentary states would churn daily. Refinement: within-person spread
  parameters are themselves stable individual differences, so
  within-person data may *contribute* between-person coordinates (a
  steady/volatile dimension of the region space) — but the region
  space stays a between-person object.
- **Re-anchoring** — because solutions are fragile (tst-5), region
  anchors are versioned artifacts changed only by announced
  re-anchoring, never as a side effect of a fit re-running.
- **Reporting** — similarity-to-region, not forced nearest-type
  labels: "no distinct type; nearest is X at distance d" is a legal
  reading, and under tst-5's contrary evidence it may be the majority
  one.
- **Naming** — human-authored, a warmth act; pure design claim,
  offered without evidence and marked so.

The shipped system (`archetype-data.js` on main) is authored signature
vectors with hand-written shares and nearest-type matching — the
authored-grid form this composition replaces; whether InSight's own
population shows density structure near those signatures is what this
run's REQUESTS row would make measurable, and it is also the test that
could defeat tst-8's first clause.

## Open problems

- tst-1's route upward: the consumer test is argued on shipped code,
  but whether InSight's own axes are correlated enough for ANY of it
  to bite — the ranking argument and the precision argument fall
  together at zero correlation — waits on the 2026-09-01 REQUESTS
  row; and no source states the mean-absolute profile-ranking version
  of the over-weighting claim (the squared-distance/Mahalanobis
  version is textbook).
- tst-1's two recorded tensions: the perfect form breaks D277's
  rank-monotonicity invariant (argued for, not settled), and whether
  a person-to-person ranking — a per-person output over indeterminate
  latent estimates — can respect tst-6's population-level publication
  boundary even in plausible-value-averaged form.
- The within-person half of tst-6: what the perfect within-person state
  space for the instruments looks like (dimensionality, link to bod-5's
  bands) is unwritten — the fork names the object, not yet its form.
- The live tension at tst-5/tst-8: the strongest contrary evidence
  says most people may sit in no distinct region — whether InSight's
  population has density structure at all waits on the 2026-08-29
  REQUESTS row, and a negative answer defeats tst-8's first clause.

## Bridge queue

Four open requests (REQUESTS.md). New 2026-09-01: a committed
cross-axis structure artifact over the exact `test:dim` coordinates
the Kindred metric consumes (correlation and covariance matrices,
per-axis means and SDs, per-pair n, eigenspectrum; aggregates only,
derivable from what already publishes) — the single hinge for tst-1,
since near-zero local correlations defeat both its arguments, and a
direct test of the D277 shrinkage calibration's independence-drawn
simulation against shipped data. The earlier three:
pulse-roster repeat summaries
(aggregates only, derivable today — the only shipped surface with true
within-person repeats); era-scoped instrument item instances (honestly
labelled as a new serving policy, since D5/D86 make instrument repeat
pairs underivable from today's store); and per-instrument population
density aggregates carrying joint structure — coarse joint binned
counts under a stated suppression floor, plus a committed offline
mixture-fit artifact (marginals-plus-covariance is a single-Gaussian
summary, blind to the multimodality the row exists to find, so it is
only the baseline) — respectively the data that would let tst-6's fork
and tst-4's trajectories, tst-2's spread claim, and tst-5/tst-8's
region-anchoring be tested on InSight's own numbers.

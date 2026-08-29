# The body axiom — current theory

*Regenerated from `graph.json` each run; the graph is the data, this
page is its readable face. Last regenerated 2026-08-29.*

The perfect body axiom is one measurement theory of the body over
time — sensors, self-report and derived clinical values as channels of
a single timeline — plus a cross-connection layer that says how traits
measured by the other axioms map onto the body's systems. Nothing here
is bounded by what the app builds next; §9 of the charter (law,
ethics, honesty) bounds everything.

## 1 · The measurement core

**bod-1 · argued — One fused timeline, not disconnected trackers.**
Sleep, heart data, activity, nutrition and clinic-derived values are
one body described by channels of different noise and cadence, modeled
jointly on a person's timeline. The concrete case for fusion now
exists via bod-3: perceived and measured sleep each carry predictive
signal the other lacks, so a subjective-only axiom mislabels mood as
sleep and an objective-only axiom discards the channel that carries
the affect coupling. Only joint modeling attributes a night's signal
to the right construct — and the discrepancy term between channels
exists only in the joint representation, which is what makes this
fusion rather than parallel tracking.

**bod-2 · argued — Continuous streams stay at the body's edge.** The
raw stream (beat-by-beat HR, minute steps) has maximal
re-identification surface and near-zero marginal value for cross-axiom
coupling, which operates at the band grain. Fold at the device, cross
bands, leave the stream where the OS holds it. Mirrors gen-2.

**bod-3 · cited — Self-report is a sensor with a knowable bias model,
and the two channels are routed, not ranked.** Perception and
measurement dissociate hard (PSG explains only 11–17% of the variance
in next-morning subjective quality; Kaplan 2017, n=1,483), and the
dissociation is channel-specific prediction, not noise: subjective
reports track emotional state while objective measures predict
executive function and memory in the extreme sleep quartiles (Sci Rep
2024), and for cardiometabolic
risk the weight inverts to the objective channel — objectively short
but not subjectively short sleep carries a 3.59× hypertension risk in
insomnia (Bathgate 2016), a pattern replicated for incident outcomes.
The perfect axiom keeps both channels, models the bias explicitly, and
routes them: perception → affect/wellbeing couplings, measurement →
cognition/physiology couplings, with the discrepancy itself a modeled
quantity.

**bod-4 · argued — Meals and scans enter as derived values, not
artifacts.** A meal-photo stream and a DICOM file compress, at the
coupling grain, to derived values with provenance; artifact custody
stays with institutions built for it. On-device derivation would
satisfy this node, not contradict it.

**bod-5 · cited — Within-person change is the design-correct grain;
the demonstrated ordering is sleep's; the grain pays only as far as
the state instrument's reliability.** The direct within-vs-between
comparison exists for sleep: within-individual sleep→self-control
correlations (r = .35 quality, .20 duration) exceed the
between-individual ones (.26, .14) as point estimates, though the
confidence intervals overlap (Guarana 2021). The best-evidenced
single coupling is prior-night sleep → next-day affect: 118
intensive-longitudinal studies, small-to-moderate within-person
effects, asymmetric in favor of sleep→affect (Bourke 2026) — with the
caveat corrected this run to the paper's own wording: within-person
correlations are *generally* stronger when sleep is self-reported
rather than objectively measured. Nights of shorter-than-own-usual
sleep blunt next-day positive-affect responses in 1,982 adults with
no evidence of the reverse (Sin 2020); acute sleep loss → risk-taking
is explicitly NOT the anchor. Scope, corrected 2026-08-29: the
endocrine and metabolic fronts (bod-9, bod-10) show within-person
affect couplings that are small in absolute terms — which bounds the
payoff of the grain on those fronts but does not test the ordering,
since no within-vs-between comparison of one same coupling exists
there — and occasions pay only as far as the state instrument's
reliability (bod-7). Still the answer to central's 2026-08-26
portfolio question.

## 2 · The cross-connection layer

*The owner's question (2026-08-25): how do traits measured by the
other axioms map onto parts and systems of the body? The answer is
now six claims — the frame (bod-6, bod-7, bod-8), the scouted fronts
(bod-9, bod-10), and a candidate synthesis (bod-11).*

**bod-6 · cited — Cross-connections run through regulatory-system
parameters, not anatomy, and the honest between-person effects are
small.** What replicates is regulatory: HRV ↔ self-regulation at r ≈ .09
across 123 studies (Holzman & Bridgett 2017) — an upper bound, since
the sibling meta-analysis goes non-significant after publication-bias
adjustment (Zahn 2016); conscientiousness ↔ CRP across N=26,305 plus
meta-analysis (Luchetti 2014); depression ↔ inflammation as a
right-shift of the whole CRP distribution rather than an inflamed
subgroup (Osimo 2020) — exactly how a continuous regulatory parameter
behaves. Anatomy is not absent but is weaker in matched currency:
hippocampal volume in depression at d = −0.14 (ENIGMA-MDD) against
CRP at g = 0.71, and Big Five traits show no reliable structural-MRI
differences at all. Consequences: the cross-connection layer is a
state-parameter interface (a small vector of regulatory set-points
and reactivities per person-period), not a body map; every published
coupling declares its effect-size currency (case-control differences
and trait-level correlations are different quantities); and because
between-person couplings are this small, the real cross-axis power is
within-person (bod-5). Mirrors gen-9: systems, not organs — anatomy
is the substrate, the parameters carry the signal. Bounded this run
by bod-9: not every regulatory parameter carries trait signal.

**bod-7 · cited — The measurement-validity boundary.** A trait–body
channel exists only as far as its body-side instrument's construct
validity. Cardiac interoception is the cautionary case: heartbeat
counting scores are contaminated by time estimation and beliefs about
one's own heart rate, the founding critique is itself contested, and a
133-study meta-analysis (from the critics' own group — independence
noted) finds little relation to the predicted outcomes, while
counting and discrimination accuracy share only a small relation
(Hickman 2020). That channel is not small — it is unmeasured. General law:
instrument reliability caps every observable coupling (attenuation),
so the perfect axiom publishes each channel's instrument status with
its couplings — measured / attenuated / unmeasured. Twin of que-2.

**bod-8 · cited — An observed coupling does not fix its direction or
mechanism, and design-based decomposition is itself unreliable today;
publish the decomposition status, unknowns and unsearched limbs
declared.** The showcase is inflammation↔depression under Mendelian
randomization: CRP–symptom coheritability largely reassigns to
metabolic dysregulation, leaving IL-6 signaling associated with
suicidality only (Kappelmann 2021); two markers of one pathway carry
opposite MR signs in the same cohort (Ye 2021); HUNT's one-sample MR
finds no major causal role for CRP and explicitly rejects Ye's
protective direction (Bekkevold 2023, N=68,769); Lifelines points
CRP–anxiety the other way again (Slaney 2025); a 52-article review
reports substantial heterogeneity across depression MR (Ma 2023). So
"not reliably separated even by design" is the honest current state —
what remains publishable is which components a design has excluded
and how stable that verdict has proven. The behavior-mediation limb,
corrected: conscientiousness–CRP is unchanged by smoking adjustment
and only attenuated by BMI (Luchetti 2014); the named mediation study
mediates the achievement facet, not conscientiousness (Graham 2018).
The reverse limb for conscientiousness↔CRP was not searched to
completion this run — declared UNSEARCHED, not absent. Twin of gen-11.

**bod-9 · cited — The endocrine front: trait–cortisol near-null
between persons; the momentary coupling attenuated-small; most
cortisol instruments fail the gate.** Depression–HPA pools to d=0.60
for cortisol but is strongly sample-dependent (outpatient d=0.32 vs
inpatient d=0.74 — Stetler & Miller 2011), with sex-dependent
reactivity direction (Zorn 2017). Personality–cortisol is near-null:
no dedicated meta-analysis exists; three decades of urinary
measurements yield only a modest conscientiousness association
(Sutin 2022) — which bounds bod-6's positive half: cortisol, the
paradigm regulatory parameter, largely does not carry trait signal
between persons. Within persons the momentary affect–cortisol
coupling is r=.06 across 38,418 observations (Joseph 2021) — but
under bod-7's states that is ATTENUATED, not small-and-final: single
saliva samples of a pulsatile analyte are a weak state instrument, so
r=.06 is a lower bound, and no within-vs-between comparison of one
same coupling exists on this front — bod-5's ordering is untested
here, not refuted. What is firm is instrument-side: the cortisol
awakening response is too unreliable day-to-day for
individual-differences research (Norton 2023), a stable slope needs
~10 sampling days (Segerstrom 2014), and hair cortisol tracks ongoing
objective stressors (+43%) but not perceived stress (Stalder 2017,
N=10,289). Most cortisol channels sit at attenuated; single-timepoint
cortisol at unmeasured.

**bod-10 · cited — The metabolic front: small, partly adiposity-routed
between-person couplings; HbA1c excellent as a person parameter while
per-meal glucose responses fail test–retest; percept-dominated affect
coupling.** Conscientiousness is the only Big Five trait coupled to
incident diabetes (OR 0.87 per SD, attenuated by obesity adjustment —
Jokela 2014, N=34,913); depression→T2D shrinks from RR 1.60 (Mezuk
2008) to 1.18 in the modern meta (Graham 2020). Instrument currencies
kept apart: HbA1c has within-subject CV ≈1.7% in healthy adults — a
superb trait instrument — while duplicate meals under metabolic-ward
control reproduce at only ICC 0.14–0.31 (AJCN 2025), so a per-meal
response is not a stable personal parameter; free-living day-to-day
CGM reproducibility of ICC 0.30 (Matabuena 2023) mixes real
behavioral state variance with noise and is not by itself instrument
unreliability. No study found this run quantifies the CGM days needed
for stable nondiabetic estimates. Where within-person affect coupling
exists it runs through the percept: the only systematic review of
glucose-variability–mood finds no clear support (Muijs 2021);
perceived glucose variability dominates daily diabetes distress — a
disease-specific appraisal outcome — while CGM-measured variability
is non-significant (Ehrmann 2024, N=379); metabolic-state ratings
mediate glucose→mood in healthy adults (eBioMedicine 2025, N=90). The
measured channel's live within-person coupling is cognitive, at
excursions only diabetes produces: low and high glucose slow
processing speed within five minutes in T1D, non-monotonically
(GluCog 2024, N=200).

**bod-11 · argued — Channel routing recurs on the metabolic front; a
general law is open, with common-method variance the named rival.**
Sleep and metabolic evidence repeat bod-3's pattern: affect couples
to the perception channel, cognition to the measured channel. But
every perception→affect leg so far is same-instrument, same-moment
self-report while every measured leg is cross-method — common-method
variance predicts exactly this pattern with no routing law at all —
and the constructs are heterogeneous (diabetes distress is appraisal,
not affect proper; the endocrine front contributes only an adjacent
dissociation, not an instance). What survives either way: the
perception channel is a different sensor with a different referent,
not a degraded copy of the measured channel, so every published
cross-connection declares its channel (perceived vs measured) as part
of bod-7's instrument status. Rises to cited only on a design that
breaks the method confound — both channels predicting an affect
outcome assessed by a third method within one study.

## 3 · Open problems

- Raise bod-1 with a study directly demonstrating a
  fusion-vs-single-channel attribution reversal.
- Raise bod-11 with a method-confound-breaking channel-routing test;
  eBioMedicine 2025's mediation design is the closest shape but is
  same-method on the affect side.
- bod-8's reverse limb for conscientiousness↔CRP is UNSEARCHED (a
  disease→personality-change pooled analysis exists as a lead); a
  future run should search it properly.
- bod-2 and bod-4 remain argued; both need grounding in the
  re-identification and edge-computation literatures.
- Named literature gaps found this run: no study quantifies CGM days
  needed for stable nondiabetic estimates; no dedicated
  personality–cortisol meta-analysis exists.

*Verification depth this run: scholarly full texts were unreachable
from the container (egress-blocked); all `cited` sources were
corroborated against the public search index across independent
queries, by two separate agents (scout and adversary), and claims are
abstract-level with per-figure flags in the nodes where retrieval was
single or failed. §11 source-rot rule applies as usual.*

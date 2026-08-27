# The body axiom — current theory

*Regenerated from `graph.json` each run; the graph is the data, this
page is its readable face. Last regenerated 2026-08-27.*

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

**bod-5 · cited — Within-person change beats between-person level.**
The direct comparison exists: within-individual sleep→self-control
correlations (r = .35 quality, .20 duration) exceed the
between-individual ones (.26, .14) as point estimates, though the
confidence intervals overlap (Guarana 2021) — and it exists for sleep
couplings only, so the claim's "most" is still the theory's bet. The
best-evidenced single coupling is prior-night sleep → next-day
affect: 118 intensive-longitudinal studies, small-to-moderate
within-person effects, asymmetric in favor of sleep→affect (Bourke
2026); nights of shorter-than-own-usual sleep blunt next-day
positive-affect responses in 1,982 adults with no evidence of the
reverse (Sin 2020). Acute sleep loss → risk-taking is explicitly NOT
the anchor — its direction is unstable across studies. This node is
the answer to central's 2026-08-26 portfolio question.

## 2 · The cross-connection layer

*The owner's question (2026-08-25): how do traits measured by the
other axioms map onto parts and systems of the body? The answer so
far is three claims.*

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
is the substrate, the parameters carry the signal.

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

**bod-8 · argued — Every coupling ships with its decomposition.**
Direct regulatory path, behavior-mediated path, reverse causation:
the evidence behind bod-6 does not by itself say which
(conscientiousness→CRP plausibly part health-behavior;
inflammation→depression Mendelian-randomization results are
marker-inconsistent; sleep→affect mixes an appraisal path in). A bare
correlation published as a connection is a composite pretending to be
a mechanism; the perfect cross-connection publishes currency (bod-6),
instrument status (bod-7) and decomposition status with every
coupling. Held at argued until the MR literature can be re-verified.
Twin of gen-11.

## 3 · Open problems

- Raise bod-1 with a study directly demonstrating a
  fusion-vs-single-channel attribution reversal.
- Endocrine and metabolic fronts of bod-6 (cortisol dynamics, glycemic
  variability ↔ traits) are unscouted; the current evidence is
  autonomic and immune.
- bod-8's decomposition needs the MR literature opened (egress-blocked
  this run) before it can rise.
- bod-2 and bod-4 remain argued; both need grounding in the
  re-identification and edge-computation literatures.

*Verification depth this run: scholarly full texts were unreachable
from the container (egress-blocked); all `cited` sources were
corroborated against the public search index — titles, identifiers
and findings cross-checked across independent queries — and claims
are abstract-level. §11 source-rot rule applies as usual.*

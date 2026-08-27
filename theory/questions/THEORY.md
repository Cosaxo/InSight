# The questions axiom — current theory

*Regenerated from `graph.json` on 2026-08-27; the graph is the data,
this page is its readable face. Statuses follow CHARTER §4's ladder.*

The perfect question axiom is a theory of asking people things: what a
question **is** as an instrument, how the bank **chooses** what to ask
whom, how new questions are **made**, and where the answers may **not**
travel. Six claims, three now grounded in the measurement literature.

## What a question is

**A question is a measurement instrument with estimable parameters —
including which response-process family it obeys — and the perfect bank
calibrates those parameters continuously from live answers**
(`que-2`, **cited**). The classical frame: binary items carry
difficulty/discrimination-like parameters (Birnbaum's 2PL), ordinal
items graded thresholds (Samejima), recovered from response data by
marginal maximum likelihood (Bock & Aitkin — *marginal*, a correction
to this node's earlier "jointly"). The resharpening this run added:
that frame presupposes a *dominance* process (endorsement rising
monotonically with the trait), which is standard for ability items and
contested for opinion items — attitude statements often *unfold*
(single-peaked response around the person's position: GGUM; Stark et
al.; Drasgow et al.). "Ideal point" is two different things here: the
unfolding sense above, and the spatial-voting sense whose response
function stays monotone — Clinton–Jackman–Rivers' Bayesian roll-call
model reduces to a 2PL-equivalent form, so it proves large-scale
Bayesian estimation of binary opinion data while sitting on the
dominance side; the graph cites it as that contrast case. So the
perfect bank holds the response-process family per item as an
estimable property, not an assumption — knowing honestly that the
families are not always distinguishable from response data alone
(Fu–Tan–Kyllonen). "Continuously" is a real literature: online item
calibration in operational adaptive testing (van der Linden & Ren;
Ren–van der Linden–Diao), with Stocking's scale drift as the named
failure mode. InSight's nightly fit already publishes loading vectors
that are item parameters in all but name; the first bridge request
(REQUESTS.md) asks for that exposure.

## How the bank chooses

**The selection theorem** (`que-1`, argued): pure adaptivity destroys
comparability, pure uniformity wastes the answer budget; the optimum is
a shared spine plus an adaptively allocated tail. InSight's core/tail
split is its practical shadow.

**The spine is an anchor set** (`que-6`, **cited**): its linking role
is the same structure as the common-item nonequivalent-groups design
from equating theory (InSight's spine-plus-adaptive-tail being the
item-pool-linking generalization). The standard "mini-version"
prescription is partly relaxable, and only partly: holding content
coverage and mean item difficulty, anchors with a narrower difficulty
spread equate about as well (Sinharay & Holland) — nothing in the
cited evidence licenses relaxing content coverage itself.
Selection-as-information-maximization is standard optimal design
(van der Linden; Berger–King–Wong), with its known limit — such
designs are only locally optimal, the design-side face of calibration
drift — and minimax design as the standard remedy.

**The combination bends the spine** (`que-5`, argued — answers
central's 2026-08-26 question): composition is chosen to identify the
*joint* person-space (cen-1), not the bank's own — except in the
degenerate case, which the claim states, where the joint space is just
a nonsingular relabeling of what the bank measures and every
cross-instrument map is already known. The budget splits between
*linking* items (content-overlapping another axiom's construct, to
identify the cross-instrument map — coupling between distinct
constructs needs only jointly measured people, which spine membership
already supplies) and *complementary* items (adding joint information
the other axioms lack); the split is a continuum, and its direction of
drift over the program's life is an explicit prediction, not a derived
result. Spine *membership* is what carries intersection mass — adding
items does not raise any coupling's n — while spine *size* is floored
separately, through dimension coverage: each priced coupling names
question-side dimensions that must reach target reliability, so size
is f(population, bank size, coupling portfolio). que-1's open problem,
refined.

## How questions are made

**Production is a closed loop** (`que-3`, argued): every authored
question is a hypothesis about what will split people, live performance
is the experiment, and the generator learns shape-level rules from
measured outcomes — under the standing guardrail that warmth outranks
any score, because a bank optimized for maximal disagreement converges
on outrage. Grounding path queued: the automatic item generation and
item-quality-prediction literature.

## Where answers may not travel

**Portability is established, never assumed** (`que-4`, **cited**) —
and this run *weakened* the seed claim into its defensible form.
Translation and culture move item parameters (DIF grows with linguistic
distance across TIMSS's 43 languages), and the invariance literature
(Meredith; Byrne; Davidov et al.) says comparability precedes
comparison — but exact invariance rarely holds across many groups, and
partial, approximate and alignment methods exist precisely to define
what comparison remains legal beneath it. There is also a live,
citable controversy over whether invariance testing itself overstates
the problem (Welzel et al. vs. Meuleman et al.; Funder & Gardiner). The
perfect rule is therefore InSight's honesty grammar generalized:
establish the level of comparability per question and cohort by a named
method, license only the comparisons that level supports, state the
basis with the reading, and refuse outright only where even graded
comparability cannot be established.

## Open problems

- **The que-5↔que-6 budget tension** — que-6's anchor logic wants the
  spine to span what the bank measures; que-5 wants composition set on
  the joint space; under one fixed answer budget these compete for the
  same slots, and neither node yet prices the trade. The most valuable
  problem this run surfaced.
- The linking↔complementarity split's trajectory (que-5): its drift
  direction is a prediction, not a derivation — what observable
  statistic would test it?
- que-1's spine-size function now has its arguments; it still wants a
  closed or computational form.
- que-3 has no external grounding yet.
- Whether InSight's own published fit behaves as IRT predicts —
  blocked on the first REQUESTS row; would move que-2 toward
  *measured*.

*Verification note for all cited nodes: this container's egress policy
blocks publisher full-text; sources were corroborated at
search-index/metadata level against multiple independent records (each
node states its exact standard), and this run's adversarial pass
independently re-verified 22 of the 25. Kolen & Brennan is cited as
the field's standard text only — not read at first hand, with no
specific content claim resting on it.*

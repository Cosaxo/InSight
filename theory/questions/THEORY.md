# The questions axiom — current theory

*Regenerated from `graph.json` on 2026-08-29; the graph is the data,
this page is its readable face. Statuses follow CHARTER §4's ladder.*

The perfect question axiom is a theory of asking people things: what a
question **is** as an instrument, how the bank **chooses** what to ask
whom, how the choice is **priced**, how new questions are **made**, and
where the answers may **not** travel. Eight claims, four now grounded
in the measurement and design literature.

## What a question is

**A question is a measurement instrument with estimable parameters —
including which response-process family it obeys — and the perfect bank
calibrates those parameters continuously from live answers**
(`que-2`, **cited**). The classical frame: binary items carry
difficulty/discrimination-like parameters (Birnbaum's 2PL), ordinal
items graded thresholds (Samejima), recovered from response data by
marginal maximum likelihood (Bock & Aitkin — *marginal*, a correction
to this node's earlier "jointly"). The resharpening: that frame
presupposes a *dominance* process (endorsement rising monotonically
with the trait), which is standard for ability items and contested for
opinion items — attitude statements often *unfold* (single-peaked
response around the person's position: GGUM; Stark et al.; Drasgow et
al.). "Ideal point" is two different things here: the unfolding sense
above, and the spatial-voting sense whose response function stays
monotone — Clinton–Jackman–Rivers' Bayesian roll-call model reduces to
a 2PL-equivalent form, so it proves large-scale Bayesian estimation of
binary opinion data while sitting on the dominance side; the graph
cites it as that contrast case. So the perfect bank holds the
response-process family per item as an estimable property, not an
assumption — knowing honestly that the families are not always
distinguishable from response data alone (Fu–Tan–Kyllonen).
"Continuously" is a real literature: online item calibration in
operational adaptive testing (van der Linden & Ren;
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
identify the cross-instrument map) and *complementary* items (adding
joint information the other axioms lack); the split is a continuum,
and its drift over the program's life is an explicit prediction, not a
derived result. Spine *membership* is what carries intersection mass —
adding items does not raise any coupling's n — while spine *size* is
floored separately, through dimension coverage: size is f(population,
bank size, coupling portfolio).

## How the choice is priced

**Deferred and immediate information are one unit** (`que-7`,
**cited** — added this run as scaffolding). With a log-score utility,
expected information is a *special case* of expected utility (Bernardo,
on Lindley's measure — a licence to use bits as a utility where no
real utility is available, not proof that real utilities reduce to
bits); value-of-information theory prices uncertainty-resolution
through a subsequent decision as a present expected value (Howard —
within one decision problem, with no temporal structure of its own);
and sequential optimal experimental design prices an entire experiment
sequence in that single unit over a horizon, with greedy/myopic design
the suboptimal special case that drops the future term
(Chaloner–Verdinelli; Huan–Jagalur–Marzouk) — myopic suboptimality
*is* the statement that later bits carry present shadow value. Gittins
enters as a **disanalogy** that locates the difficulty: index
optimality needs arms frozen while unselected, and item and map
parameters drift regardless of selection, so the spine is a *restless*
bandit. Honest limits carried in the node: the horizon and weighting
are chosen, not estimated; log-loss compares only on a common
observable sequence, and the axiom set grows; misspecification spares
the yardstick but not the optimality theorems; a discounted sum of log
scores is no longer itself a proper score.

**The que-5↔que-6 tension is priced** (`que-8`, argued — answers
central's 2026-08-28 question): one *constrained* optimization in
cen-2's currency, and the felt two-currency standoff was the shadow of
the constraint. Comparability is a **graded validity floor** imported
from outside the currency — not a precondition of *scoring* (D325's
answer-only block computes surprisal today with no equating at all)
but of the objective's *meaning*: a bits-optimal bank whose
coordinates denote different constructs in different cohorts optimizes
a well-defined number over an estimand nobody wants. The floor is
rung-indexed per que-4 (which invariance level each comparison class
must clear), never a cliff. Above it, every slot — three roles on
que-5's continuum, located by two angles (to the bank's own content;
to the already-measured other-axiom subspace) — is priced by the same
integral of expected one-step-ahead surprisal reduction on the joint
stream. Payoff *shapes* differ: anchor and complementary items pay
front-loaded, near-certain, continuously depreciating bits; a linking
item's deferred bits carry a locally-valid weight of per-paired-person
prediction rate × pairing-arrival probability × map-estimate survival
(independence-approximate; a linearisation of a plausibly
non-submodular set function). Myopic selection systematically
*underbuys* linking items — their one-step term is positive but small —
which is what the non-myopic frame exists to correct, while also
pricing the option value of deferring. Central's scalar discount rate
is the weight's reduced form under exponential collapse, **and even
its sign is empirical**: rate and arrival grow while survival decays,
so future bits can be worth more than present ones. Reconciled with
cen-2 explicitly: pairing moves the *realisation timing* of a slot's
deferred bits, never the definitional value cen-2 protects.

## How questions are made

**Production is a closed loop** (`que-3`, argued): every authored
question is a hypothesis about what will split people, live performance
is the experiment, and the generator learns shape-level rules from
measured outcomes — under the standing guardrail that warmth outranks
any score, because a bank optimized for maximal disagreement converges
on outrage. que-8 records this guardrail as a second constraint
standing outside the bits currency. Grounding path queued: the
automatic item generation and item-quality-prediction literature.

## Where answers may not travel

**Portability is established, never assumed** (`que-4`, **cited**).
Translation and culture move item parameters (DIF grows with
linguistic distance across TIMSS's 43 languages), and the invariance
literature (Meredith; Byrne; Davidov et al.) says comparability
precedes comparison — but exact invariance rarely holds across many
groups, and partial, approximate and alignment methods exist precisely
to define what comparison remains legal beneath it. There is also a
live, citable controversy over whether invariance testing itself
overstates the problem (Welzel et al. vs. Meuleman et al.; Funder &
Gardiner). The perfect rule is InSight's honesty grammar generalized:
establish the level of comparability per question and cohort by a
named method, license only the comparisons that level supports, state
the basis with the reading, and refuse outright only where even graded
comparability cannot be established. que-8 leans on exactly this
gradedness: the ladder of rungs is what makes the spine's
comparability floor a graded constraint rather than a cliff.

## Open problems

- **The sign of que-8's composite rate** — whether future bits are
  discounted or *anti*-discounted is empirical, answered by four
  curves: the map learning curve (blocked on cross-axiom prequential
  logging, which is also the test of the single-currency
  specification itself), item-information profiles (first REQUESTS
  row), depreciation split by branch (second REQUESTS row), and
  pairing growth (pat-4).
- The linking↔complementarity split's trajectory (que-5): its drift
  direction is a prediction; que-8's composite rate is now the
  observable that would test it.
- The floor's required rungs and the horizon are governance inputs —
  the optimization is well-posed only relative to them; no data
  settles them.
- que-1's spine-size function has its arguments; it still wants a
  closed or computational form.
- que-3 has no external grounding yet.
- Whether InSight's own published fit behaves as IRT predicts —
  blocked on the first REQUESTS row; would move que-2 toward
  *measured*.

*Verification note for all cited nodes: this container's egress policy
blocks publisher full-text; sources were corroborated at
search-index/metadata level against multiple independent records (each
node states its exact standard), and each run's adversarial pass
independently re-verified that run's additions — this run's pass
re-verified all 7 new external sources, relabelled two page ranges as
with-discussion, and dropped one uncorroborated issue number. Kolen &
Brennan is cited as the field's standard text only — not read at first
hand, with no specific content claim resting on it.*

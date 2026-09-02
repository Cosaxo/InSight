# The pattern axiom — current theory

*Regenerated from `graph.json` (2026-09-02); the graph is the data, this
page is its readable face.*

The pattern axiom is calculation theory: how patterns in and across the
axioms should be found — the perfect successors to today's
factorization, including LLM-shaped representation learning. The shipped
baseline it theorizes past is the product's nightly fit
(`functions/src/patternsFit.ts` on `main`): a K=8 streaming
factorization over ±1 binary answers, deterministically seeded,
marginal-centred, published as per-question loading vectors with their
basis counts, solved back to a person-vector on the device by an
8-dimensional ridge — and, since D325 (2026-08-27, the bridge's first
crossing, on this lane's own 2026-08-26 request), publishing its own
prequential scorecard beside them.

## The engine

**pat-1 · cited — The perfect pattern engine is a learned
representation over raw answer/event sequences — the LLM-shaped move —
earned above a data-volume crossover it must prove against its own
classical factor layer, which is kept permanently as the auditable
layer.**
The 2026-08-26 scout grounded both halves, and the adversarial pass
forced the crossover condition into the claim itself — the evidence for
the learned half is industrial-scale only. In exactly this domain —
user action streams — generative sequential transduction beats the
factorization stack at industrial scale with power-law returns to
compute (Zhai et al., HSTU, ICML 2024), scaling laws transfer to
sequential recommendation and pay on the hard regimes (Zhang et al.,
RecSys 2024), and sequence models are proven production
user-representations whose dense all-action loss significantly narrows
the gap between nightly-batch and real-time embeddings (PinnerFormer,
KDD 2022 — directly the shape InSight's nightly fit would take). The
architecture-family transfer holds where the sequence is the causal
substrate — ESM-2 folds proteins from raw amino-acid sequence, monotone
in scale (Lin et al., Science 2023) — and fails where the sequence is a
noisy readout of state: transcriptome foundation models lose to trivial
baselines zero-shot (Kedzierska et al., Genome Biology 2025) and show
no data-scaling law (DenAdel et al., Nature Methods 2026). So the claim
is licensed by the behavioral-stream evidence itself, not by analogy to
biology — and it is scale-conditional (pat-6).

**pat-6 · cited — Below a data-volume crossover the tuned classical
baseline beats the learned sequence model — so engine choice is a
measurement, and the perfect engine proves its choice against its own
factor layer, out of sample, continuously.**
The negative results replicate across two fields: 11 of 12 reproducible
neural recommenders lost to simple tuned methods, and with tuned
linear/MF baselines only one survived, on one dataset (Ferrari Dacrema
et al., TOIS 2021 — the counts are the TOIS extension's; the RecSys
2019 original reported 18/7/6); the dot product is an inductive bias
an MLP must spend data re-learning, once both sides are properly tuned
(Rendle et al., RecSys 2020); trees still beat deep learning at ~10K
tabular samples for bias reasons (Grinsztajn et al., NeurIPS 2022); and
published sequence-model comparisons partly measure training budget,
not architecture — original BERT4Rec results reproduce only at up to
30x default training (Petrov & Macdonald, RecSys 2022). Biology replays
the law: logistic regression matches scBERT (Boiarsky et al., 2024),
additive baselines beat deep perturbation predictors (Ahlmann-Eltze et
al., 2025), and pretraining plateaus — no scaling law (DenAdel et al.,
2026: 400 models, 6,400 experiments). The transcriptomic evidence
refines gen-5's analogy but leaves its genotype-to-trait question open.
At InSight's current scale the K=8 factor layer is the presumptive
engine until the comparison is run — no cited source measures this
regime in either direction, which is why a standing prequential
benchmark was this lane's first bridge request. **Crossing note
(2026-08-28, code-verified):** that request shipped as **D325**
(2026-08-27) — the nightly fit publishes a prequential-online quality
block on `v2_patterns/loadings` (newest day's pooled surprisal bits
with basis, a ≤90-day pooled series, per-question daily means floored
at n=8, and the required clause that it scores the fit, not the device
Oracle's separate ridge solve), read first-hand in
`functions/src/patternsFit.ts` and `functions/src/patterns.ts`. The
crossover is thereby measurable in principle; this node's path to
`measured` waits on the scorecard's values becoming readable from
`main` — the map lane's 2026-08-28 REQUESTS row asks exactly that, and
is seconded rather than duplicated.

## The audit layer

**pat-2 · argued — An auditable layer is permanent: every published
pattern must be recomputable by a reader from public numbers.**
The honesty contract extended to methodology: a black-box coupling is
an assertion, and the app does not assert what cannot be recomputed.
The shipped fit already keeps this exactly (deterministic qid-hash
seeds, published vectors with basis n, reproducible from its own log).
Distillation quality — how much of a learned layer survives into the
auditable one — is a first-class metric; pat-7 shows that half is the
genuinely open problem, and pat-3 now adds that published artifacts are
level-labeled: a between-person loading and a within-person coupling
are different published objects.

**pat-7 · cited — Distillation from learned representation to auditable
factors is demonstrated technology whose faithfulness is unsolved — the
perfect audit layer is a psychometric instrument with measured
faithfulness, not an explanation extracted after the fact.**
The channel exists at every scale tried: soft-tree distillation (Frosst
& Hinton 2017), concept bottlenecks with test-time intervention (Koh et
al., ICML 2020), sparse autoencoders whose features are interpretable
and causally steerable (Bricken et al. 2023; Templeton et al. 2024;
Cunningham et al., ICLR 2024). Every documented failure mode attacks
faithfulness, not capability: concept leakage (Mahinpei et al. 2021),
ungrounded concepts (Margeloiu et al. 2021), the leakage/intervenability
tradeoff (Havasi et al., NeurIPS 2022), dictionary pathology — the
number of factors is chosen, not identified — and SAE probes losing to
logistic regression across 113 tasks on the mean across datasets
(Kantamneni et al., ICML 2025), with Makelov et al. (2024) an early
principled faithfulness evaluation against supervised ground truth. The
bar the audit layer needs already exists in psychometrics: calibration,
invariance testing, inspectable item parameters (Embretson & Reise
2000). The perfect audit layer is built as an IRT-grade instrument the
learned layer must agree with out of sample.

## Identification and honesty

**pat-3 · cited — Cross-axiom couplings carry level-specific referents
— between-person, plus temporal and contemporaneous within-person —
that need not agree in magnitude or sign; a level-blind estimator
conflates them, so the perfect engine keeps the person-period as its
native record and estimates and publishes both levels, matching each
published coupling to its level rather than promoting either.**
Raised 2026-08-28 — the 2026-08-25 form said couplings "graduate" to
within-person change, and the literature refuses the promotion
reading: the levels are different estimands, and the field's
recommendation is to match model to question (Orth et al. 2021).
Fissioned 2026-09-01 per central's 2026-08-28 question (go-7's budget
argument): the three machinery claims now stand at pat-9, pat-10 and
pat-11, each with its own sources and status; nothing was re-argued in
the move. What this node holds: sign discordance between levels is
empirically documented, not merely possible in principle — a
three-wave study where the between- and
within-person cross-lagged paths run in opposite directions, the
authors' own Simpson's-paradox construction (Dietvorst et al. 2018) —
and the divergence backdrop is the siblings', leaned on by edge
(tst-7's ergodicity and variance-excess facts; bod-5's meta-analytic
within-vs-between ordering with its caveats inherited — the adjacent
diary evidence there is nightly, nights not weeks; map-6's
stricter treatment carrying the published rebuttal to Fisher). The
design consequences, this lane's own inferences and marked so: the
person-period is the native record (aggregation to the person is lossy
and non-invertible); published artifacts are level-labeled, with
pat-10's three-network decomposition supplying the label set — the
engine-side half of map-6's display rule and of tst-6's
two-linked-geometries architecture; the published within-person object
is the population-average parameter, never a per-person coupling
(tst-6's §9 reading forecloses per-person latent publication, so
pat-8's person-specific estimands inform design without reaching the
published surface); gene-side couplings have no within-person half
(map-6's scope note); and the shipped corpus is nearly all T=1 per
(person, question) — the record-grain requirement cannot be
retrofitted onto person-aggregates, which is the point.

**pat-9 · cited — Level conflation is an estimator property — not one
more data fixes: where a construct's stability is at all trait-like, a
level-blind cross-lagged estimator returns an uninterpretable amalgam
of between- and within-person associations, with failure modes in the
presence, predominance and sign of inferred influences.**
Fissioned from pat-3 2026-09-01; the evidence is the 2026-08-28
scout's, moved intact with its grades. Where stability is to any
extent trait-like and time-invariant — the authors' own load-bearing
conditional — CLPM lagged parameters "do not represent the actual
within-person relationships over time", with presence, predominance
and sign the authors' own failure-mode list (Hamaker, Kuiper & Grasman
2015; their random-intercept fix is what the field later named the
RI-CLPM); a level-blind panel estimator returns an "uninterpretable
amalgam" of the levels (Berry & Willoughby 2017, on the ARCL model
specifically — the wider generalisation is this lane's inference,
marked); simulation shows both failure directions with the source's
asymmetry kept — spurious cross-lagged effects very likely found where
none exist, real ones sometimes underestimated (Lucas 2023) — and CLPM
bias under unmeasured stable confounding is independently confirmed
(Lüdtke & Robitzsch 2022). This lane's inference, marked so: where
Hamaker's conditional holds — the construct carries trait-like
between-person variance — the conflation happens inside the estimator,
and more persons do not discharge the problem; only level-aware
estimation does (pat-10).

**pat-10 · cited — Native person-period machinery exists — two-level
dynamic SEM, multilevel VAR's three separately-estimable networks
(temporal within-person, contemporaneous within-person,
between-person), group-pooled individual model recovery — so a
level-blind engine conflates three objects, not two.**
Fissioned from pat-3 2026-09-01; evidence moved intact with its
grades. Two-level DSEM carries person-specific dynamics under a
between-person structural model, Bayesian, at intensive-longitudinal
scale (Asparouhov, Hamaker & Muthén 2018; McNeish & Hamaker 2020 as
the operational primer); multilevel VAR separates coupling structure
into three separately-estimable networks that need not agree (Epskamp
et al. 2018), so the conflation pat-9 describes folds three objects,
not two — and the decomposition supplies the audit layer's level-label
set (this lane's inference, marked: between · within-temporal ·
within-contemporaneous); group-pooled model search recovers
individual-level directed models from the replicated group skeleton
(Gates & Molenaar 2012 — the qualitative recovery result; the
circulating 97%/95% figures are snippet-grade and not relied on),
which is the group-prior partial relief pat-8 names, never a
substitute for a person's own occasions. All of it is defined over
person-period records and none of it can be run on person-aggregates
(this lane's inference from the methods' own definitions, marked so) —
the operational content of pat-3's native-record consequence.

**pat-11 · cited — The level separation is not free or automatic:
centering and detrending policy change the disaggregated answer,
person-specific reliability is its own estimand, and the
random-intercept adjustment is parametric — with time-varying
confounding a standing residual this node does not claim away.**
Fissioned from pat-3 2026-09-01; evidence moved intact with its
grades. Three costs: centering and detrending policy change the
disaggregated answer — three centering by four detrending choices,
examined in the same journal issue as the CLPM critique (Wang &
Maxwell 2015) — so, this lane's gloss marked so, the within/between
split is an analytic decision, not a button; multilevel
autoregressive practice routinely assumes perfect reliability, and
person-specific reliability is its own estimand (Schuurman & Hamaker
2019) — and, this lane's inference marked so, an occasion is worth
what the state instrument's reliability says it is, the engine-side
analogue of the body lane's instrument-validity boundary (bod-7 — an
analogy between a reliability boundary and a validity boundary, not a
shared result); and the random-intercept
adjustment is parametric, not the design-based fixed-effects
difference-out — latent approaches "strongly depend on the specific
parametric assumptions" (Lüdtke & Robitzsch 2022) — with even the
design-based guarantee covering time-invariant confounding only, so
time-varying confounding remains a standing residual. Consequence,
this lane's inference and marked so: the level split is itself a
modeled, versioned analytic policy, published beside the coupling like
any other basis declaration (pat-2; map-6's declared-basis rule) —
two correct engines with different centering policies publish
different within-person numbers from the same records, and a reader
who cannot see the policy cannot recompute the number.

**pat-4 · cited — Coupling capacity is bounded by the paired population
because pairing is what identifies a cross-axiom coupling: two axes
never observed jointly on the same people pin their coupling down only
to a conditional Fréchet set, and a point needs further structure — the
conditional-independence assumption, an exclusion restriction, or a
sample holding the two jointly — so the paired count, never larger than
either population, buys identification first and precision second, and
the perfect engine budgets both explicitly.**
Raised 2026-09-02 from the seed's complete-case bookkeeping to the data-
combination literature's categorical statement. With X answered by
everyone, Y on one axis only and Z on another, the two files identify
P(X,Y) and P(X,Z) and not P(Y,Z|X): what they fix is the set of joints
with the right conditional margins — the conditional Fréchet bounds,
read first-hand in the StatMatch manual — and the conditional-
independence assumption that statistical matching uses to pick one point
is an assumption, not an estimate (D'Orazio, Di Zio & Scanu 2006).
Without further assumptions those bounds are "all that can be learned"
from two samples (Ridder & Moffitt 2007); the long regression from two
short ones has a sharp identification region that exclusion restrictions
shrink, sometimes to a point (Cross & Manski 2002); in a parametric
setup ranges "are the only estimable items" absent restrictive
assumptions on the non-jointly-observed pair (Conti, Marella & Scanu
2017); the problem is partially identified (Ahfock et al. 2016). This
lane's entailment, marked: at a fixed conditioning set the bounds are a
functional of population margins, so unpaired respondents shrink the
sampling error around them and never their width — volume narrows them
only by making a finer conditioning set estimable. Two nuances: shared
covariates narrow the set without closing it, and joint observation is
what buys identification — an auxiliary sample holding both variables
corrects the matched table, and the split-questionnaire design is the
constructive version (Raghunathan & Grizzle 1995; Ali & Kauermann 2021),
which pat-12 carries. The consequences are this lane's: conserved
density stands (db-8); the budget is two ledgers — identification (which
axis pairs have any joint observation, a pair with none publishing its
Fréchet interval under declared covariates and never a point) and
precision (the paired count per pair); and the marginal value of one
more paired person peaks at zero, a step from set to point — above zero
cen-2's "pairing governs precision, not definition" holds, at zero the
value is unidentified rather than imprecise, a boundary contradiction of
cen-2's "does not zero value" carried to central through this run's LOG
row.

**pat-12 · cited — Pairing is a design variable, not a given: the
conserved answer budget is allocated by planned-missing design — matrix
sampling for population estimands, the two-method design for expensive
axes — under full-information estimation, so the marginal value of one
more paired person on a declared target coupling is the quantity a
design criterion would have to compute — information per cost, not
taste; the design buys precision-not-bias only for the missingness the
engine itself assigns, pays in efficiency where the coupling is manifest
rather than latent, and buys a model-free coupling only by co-service.**
Added 2026-09-02 as pat-4's constructive half. Four grounded pieces:
matrix sampling is the operating principle under a conserved budget — a
pool no person finishes, forms given to random subgroups (Shoemaker
1973), population characteristics estimated with plausible values where
nobody answers enough to be scored (Mislevy, Beaton, Kaplan & Sheehan
1992; Mislevy 1991 — tst-7's machinery, here as design; PISA/TIMSS
practice, González & Rutkowski 2010); designer-assigned missingness is
MCAR by construction, so under full-information estimation (Arbuckle
1996; Little & Rubin; Enders) it costs precision, not bias (Rioux et al.
2020; Graham et al. 2006); the two-method design — gold standard on a
subset, a cheap same-construct indicator on everyone — beats a same-cost
complete-cases design on standard errors and effective n, most where the
cost differential is large and the effect small (Graham et al. 2006),
the shape of a genome or a sensor crossed with the daily stream; and
design is a decision problem solved by maximising expected utility
(Chaloner & Verdinelli 1995), with cost inside the utility and criteria
on the Fisher information matrix as textbook optimal-design practice
(Atkinson, Donev & Tobias 2007; Berger & Wong 2009 — existence verified,
content not read). Two boundaries the node carries: planned missingness
is not efficiency-neutral — at equal data points a reduced-n complete
design can win, manifest-variable regression coefficients markedly so,
latent models being where the design pays (Rhemtulla, Savalei & Little
2016) — so the advantage is claimed cost-matched only; and two items
never served together carry no model-free information about their own
coupling — nonparametrically they are pat-4's Fréchet case, while a
latent model with an everyone-block identifies the coupling through
shared loadings — so for an engine whose product is couplings co-service
is what buys a model-free coupling: the everyone-block is que-1's spine,
and a tail–tail coupling is model-free only at its co-service rate (this
lane's inference; que-5 agrees that adding spine items raises no
coupling's n). The MCAR guarantee covers only what the engine assigns —
genome upload or sensor wear is self-selected, pat-5's and db-8's
territory. The synthesis is this lane's own and marked: one more paired
person's marginal value is expected information gain on the declared
target coupling per its cost, defined only against a declared model and
target, which cen-2's currency supplies.

**pat-8 · cited — The information budget is two-dimensional — persons
and occasions-per-person — and the dimensions substitute only for
population-level estimands: a person-specific coupling is bounded by
that person's own occasions, which no crowd size can supply.**
For population-average dynamic parameters N and T compensate — the N/T
compensation effect (Hecht & Zitzmann 2021), with the DSEM simulation
literature reported (secondary-grade, carriers disagreeing on numbers)
to find large-N/small-T the stronger regime (Schultzberg & Muthén
2018, headline figures flagged for a primary read). For
person-specific estimands the compensation fails structurally: another
person's stream supplies only a group prior (what pat-10's group-pooled
machinery — GIMME — formalizes),
and the idiographic-network feasibility study prices the demand upward
— sensitivity was low even at the 75–100 timepoints feasible in
practice, and under short series the correctly specified VAR(1) lost
predictive accuracy to simpler models through overfitting (Mansueto et
al. 2023; the overfitting sentence flagged for a primary read). If it
holds at first hand, that is the node's teeth: an engine built for a
within-person estimand its data cannot pay for produces confidently
wrong personalized couplings — worse than conflation, because
personalized. When occasions bind, density is bought by design —
measurement bursts (Nesselroade 1991; Sliwinski 2008) — which for an
InSight-shaped system means within-person capacity concentrates where
an axis repeats by nature (sensors, daily self-report), while the
question axis buys occasions only by re-asking under pat-5's retest
discipline. Scope: db-8 owns the read side; this node is the
estimand-side refinement of its density law, inherited by cen-2's
portfolio through pat-4.

**pat-5 · argued — The perfect engine treats honesty failures as model
bugs: selection bias, retest effects and drift are modeled, not
footnoted.** An engine that ignores its own serving policy publishes
artifacts of it (→ pat-2, que-1). D325's per-question surprisal series
makes drift detectable in principle; attributing it still needs the
sampling model this node demands.

## Verification note

The 2026-09-02 run added 25 source strings across pat-4 and pat-12,
each carrying its own grade label. Container egress was blocked for
every publisher, index and repository host except github.com, and
WebSearch worked: sources were corroborated by search-index metadata
(publisher records, ERIC, RePEc, Project Euclid, PubMed, book-review
records naming pagination and ISBNs), with the one full-text-grade
exception being the StatMatch manual pages read as source on GitHub —
the Fréchet formulas, the conditional-independence factorisation and
the auxiliary-sample correction come from there. Quotes are
snippet-grade (appearing identically across independent searches) or
abstract-grade as labeled; the two-method-design and equal-data-points
efficiency claims carry no numeric magnitude because none was
verified. Two scout candidates were dropped for failing verification
(a paper title that does not exist under the venue guessed for it; a
power figure attributable to no table), "matching noise" was not used
because no definition was reached, and the adversarial pass removed
two more sources the text no longer leaned on and corrected the
Fréchet and conditional-independence formulas to the manual's own.

The 2026-09-01 run added no new sources: pat-9/pat-10/pat-11 hold
redistributed subsets of pat-3's 2026-08-28 source list (all twelve
strings preserved verbatim across the four nodes). Primary reads of
the two standing flagged items (Schultzberg & Muthén's N×T headline
figures; Mansueto's overfitting sentence) were attempted again and
remain egress-blocked (statmodel.com, PMC, tandfonline.com, and the
UvA institutional repository all refused at CONNECT); both items stay
below reliance, as labeled in pat-8.

Sources added 2026-08-26 and 2026-08-28 were verified by multi-index
bibliographic corroboration (publisher records, PubMed, Semantic
Scholar, DBLP, institutional repositories, authors' own pages); full
texts and most journal/arXiv pages were egress-blocked from the runs'
containers, so quoted figures are abstract/snippet/secondary-grade,
labeled per figure in the graph — secondary-grade means a figure
attributed to a paper only by a different paper, and nothing rises on
one. Each run's additions were re-checked by a separate adversarial
subagent before landing (2026-08-28: 17/17 sources corroborated, zero
fabricated; the pass forced a mis-routed attribution, an inverted
convergence reading, a dropped conditional and a floor misstatement
out of the text before it landed). Full citation strings live in
`graph.json`.

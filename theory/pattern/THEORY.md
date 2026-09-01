# The pattern axiom — current theory

*Regenerated from `graph.json` (2026-09-01); the graph is the data, this
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

**pat-4 · argued — Coupling capacity is bounded by the paired
population, and the perfect engine budgets it explicitly.** A
coupling's n is an intersection; answers per day are conserved. The
information budget turns "what should we collect next" into arithmetic
(→ cen-2). pat-8 adds its second dimension.

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

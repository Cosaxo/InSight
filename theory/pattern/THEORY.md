# The pattern axiom — current theory

*Regenerated from `graph.json` (2026-08-28); the graph is the data, this
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
Rewritten and raised 2026-08-28 — the 2026-08-25 form said couplings
"graduate" to within-person change, and the literature refuses the
promotion reading: the levels are different estimands, and the field's
recommendation is to match model to question (Orth et al. 2021). The
level-divergence facts are the siblings' and are leaned on by edge
(tst-7's ergodicity and variance-excess facts; bod-5's meta-analytic
within-vs-between ordering with its caveats inherited; map-6's stricter
treatment carrying the published rebuttal to Fisher). This lane's own
half is machinery: conflation is an estimator property — where
stability is at all trait-like, CLPM lagged parameters "do not
represent the actual within-person relationships over time", with
presence, predominance and sign as the authors' own failure-mode list
(Hamaker, Kuiper & Grasman 2015); a level-blind panel estimator returns
an "uninterpretable amalgam" of the levels (Berry & Willoughby 2017, on
the ARCL model — the wider generalisation is this lane's inference,
marked); simulation shows both failure directions (Lucas 2023; Lüdtke &
Robitzsch 2022); and sign discordance is empirically documented — a
three-wave study where the between- and within-person cross-lagged
paths run in opposite directions, the authors' own Simpson's-paradox
construction (Dietvorst et al. 2018). Native person-period machinery
exists (two-level DSEM: Asparouhov, Hamaker & Muthén 2018, McNeish &
Hamaker 2020; the three-network multilevel VAR decomposition: Epskamp
et al. 2018 — so a level-blind engine conflates three objects, not two;
group-pooled individual model recovery: Gates & Molenaar 2012), and the
separation is not free or automatic (centering/detrending policy
changes the answer: Wang & Maxwell 2015; person-specific reliability:
Schuurman & Hamaker 2019; the random-intercept adjustment is
parametric, not a design-based difference-out, and time-varying
confounding remains a standing residual: Lüdtke & Robitzsch 2022). The
published within-person object is the population-average within-person
parameter, never a per-person coupling (tst-6's §9 reading); gene-side
couplings have no within-person half (map-6's scope note); and the
shipped corpus is nearly all T=1 per (person, question) — the
record-grain requirement cannot be retrofitted onto person-aggregates,
which is the point.

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
person's stream supplies only a group prior (what GIMME formalizes),
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

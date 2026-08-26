# The pattern axiom — current theory

*Regenerated from `graph.json` (2026-08-26); the graph is the data, this
page is its readable face.*

The pattern axiom is calculation theory: how patterns in and across the
axioms should be found — the perfect successors to today's
factorization, including LLM-shaped representation learning. The shipped
baseline it theorizes past is the product's nightly fit
(`functions/src/patternsFit.ts` on `main`): a K=8 streaming
factorization over ±1 binary answers, deterministically seeded,
marginal-centred, published as per-question loading vectors with their
basis counts, solved back to a person-vector on the device by an
8-dimensional ridge.

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
KDD 2022 — directly the shape InSight's nightly fit would take). The architecture-family transfer holds where
the sequence is the causal substrate — ESM-2 folds proteins from raw
amino-acid sequence, monotone in scale (Lin et al., Science 2023) — and
fails where the sequence is a noisy readout of state: transcriptome
foundation models lose to trivial baselines zero-shot (Kedzierska et
al., Genome Biology 2025) and show no data-scaling law (DenAdel et al.,
Nature Methods 2026). So the claim is licensed by the behavioral-stream
evidence itself, not by analogy to biology — and it is scale-conditional
(pat-6).

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
(Rendle et al., RecSys 2020); trees
still beat deep learning at ~10K tabular samples for bias reasons
(Grinsztajn et al., NeurIPS 2022); and published sequence-model
comparisons partly measure training budget, not architecture — original
BERT4Rec results reproduce only at up to 30x default training (Petrov &
Macdonald, RecSys 2022). Biology replays the law: logistic regression
matches scBERT (Boiarsky et al., 2024), additive baselines beat deep
perturbation predictors (Ahlmann-Eltze et al., 2025), and pretraining
plateaus — no scaling law (DenAdel et al., 2026: 400 models, 6,400
experiments). The transcriptomic evidence refines gen-5's analogy but
leaves its genotype-to-trait question open. At InSight's current scale
the K=8 factor layer is the presumptive engine until the comparison is
run — no cited source measures this regime in either direction, which
is why a standing prequential benchmark (REQUESTS, 2026-08-26) is the
instrument.

## The audit layer

**pat-2 · argued — An auditable layer is permanent: every published
pattern must be recomputable by a reader from public numbers.**
The honesty contract extended to methodology: a black-box coupling is
an assertion, and the app does not assert what cannot be recomputed.
The shipped fit already keeps this exactly (deterministic qid-hash
seeds, published vectors with basis n, reproducible from its own log).
Distillation quality — how much of a learned layer survives into the
auditable one — is a first-class metric; pat-7 shows that half is the
genuinely open problem.

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
principled faithfulness evaluation against supervised ground truth. The bar the audit layer needs already exists in
psychometrics: calibration, invariance testing, inspectable item
parameters (Embretson & Reise 2000). The perfect audit layer is built
as an IRT-grade instrument the learned layer must agree with out of
sample.

## Identification and honesty

**pat-3 · argued — Cross-axiom couplings graduate from correlation to
within-person change, and the perfect engine is built for the second
from the start.** The time axis is the identification strategy, not
metadata; within-person designs difference away most confounding, and
longitudinal phenotype change is measurable in cohorts far smaller than
discovery genetics needs (→ bod-5, gen-4).

**pat-4 · argued — Coupling capacity is bounded by the paired
population, and the perfect engine budgets it explicitly.** A
coupling's n is an intersection; answers per day are conserved. The
information budget turns "what should we collect next" into arithmetic
(→ cen-2).

**pat-5 · argued — The perfect engine treats honesty failures as model
bugs: selection bias, retest effects and drift are modeled, not
footnoted.** An engine that ignores its own serving policy publishes
artifacts of it (→ pat-2, que-1).

## Verification note

All sources added 2026-08-26 were verified by multi-index bibliographic
corroboration (DBLP, ACM DL, PMLR, Semantic Scholar, publisher and lab
pages) and, where possible, by fetching the authors' own repository
citation blocks; journal and arXiv pages were egress-blocked from the
run's environment, so quoted figures are abstract/snippet/repo-table
grade, labeled per figure in the graph. A separate adversarial pass
re-checked every source and number and forced fixes before landing —
notably that DenAdel's widely-mirrored 375-model figure is the
preprint's; the published version reports 400 models over 6,400
experiments. Full citation strings live in `graph.json`.

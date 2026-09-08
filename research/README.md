# Theory research — the axiom paper series

**THIS DIRECTORY IS THEORY RESEARCH, NOT THE APP.** Nothing in it
describes InSight as it exists, nothing in it proposes a change to the
tree by itself, no gate reads it for truth, and nothing in the app may
cite it. It is the written half of a research programme: what each axis
the app measures could *become*, and above all what crossing one axis
with another makes knowable that neither makes alone. The other half of
the programme is the product, and the only path between the two is the
owner's tick, described below.

If you are a routine that arrived here looking for something to build,
leave: a paper is not a build request. If you are here to write theory,
read this page whole, then the papers in order.

## What an axiom paper is

An **axis** is a source of measurements about a person — the app has
seven: the profile anchors, the question bank, the server-scored logic
test, the four derived instruments, the nine lenses, interests, and ties
(the sealed duels, the group picks and the follow graph) — plus four it
does not have yet. The owner named those four on 2026-09-06: *"1.
genetics 2. body measurements 3. competitions arranged by us in
different things with people with the app 4. physical appearance
analysis from photo and in some cases in real life."* `docs/AXES-PLAN.md`
§1 is the table for the first two, which is where it stops; the last two
are new to the map and the series covers them from paper 8 on.

The owner added one more thing in the same breath, and it is a crossing
rather than an axis: the worn device of paper 6 is *also* the
verification the app has needed — proof that the person answering is
alive and that the genome on file is theirs — and it should be paid for
by the system so that it is cheap and more people supply it. Paper 7 is
that sentence taken seriously, which meant splitting "verification" into
five claims and finding that the worn device serves only two of them,
that the genome serves the hardest one better, and that the subsidy is
an instrument only in a shape the obvious design does not have.

An **axiom** is the theory of what one axis could become at
its perfect form and, above all, of what it makes the other axes worth.
The subject of every paper is *which data makes other data mean more*.

A paper is a research paper: an abstract, the problem as the world has
it, each axis alone and where it stops, the mechanism by which the
crossing knows more than the sum, what becomes knowable reading by
reading, the return path to every other axis, the conditions that
would have to hold, the requirements scale generates, the potential at
full population, and the open questions. Papers 0 and 0a are the
foundation and are written once; every crossing paper stands on them.

## The five rules, and why each exists

The first attempt at this theory ran twelve scheduled lanes for ten
days, produced 129 claims, and failed at the job. It failed because its
evidence ladder rewarded matching an existing paper or the current app,
so every claim was narrowed until it did. Each rule below is the
mechanism that failure would have needed to be prevented.

1. **Perfect form only.** Every paper carries the sentence *"If the app
   did not exist, this would still be worth saying because…"* and every
   claim in it must pass that test. A claim about the current bank, the
   current fit or the current database is an engineering item and goes
   to the worklist, never into a paper.
2. **Scale is not a constraint.** A paper assumes its axis fully
   populated: everyone who could supply it does, at whatever depth and
   cadence the perfect form asks for. Where a design needs scale, that
   is a requirement it generates and states, never a reason to want
   less.
3. **Cross-axis or it does not count.** Every paper names at least two
   axes and says what the crossing makes knowable that neither makes
   alone.
4. **A citation situates; it never substitutes.** Until 2026-09-08 this
   rule read *no citations, and no hedging toward one*, because the
   first attempt's evidence ladder rewarded matching an existing paper
   and narrowed every claim until it did. The owner opened the
   prior-art pass on that date (*"you are now allowed to use
   citations"*), and the rule is now the discipline pointed the other
   way. A claim about capability is still stated as what could be true
   and what would have to hold, never as what a literature found about
   data that does not exist yet. A claim about what *has* been done —
   what a method is, who stated a result, what a field already knows —
   carries a numbered marker `[n]` into a trailing `**References.**`
   block whose entry carries a DOI or a URL, so a reader can check it;
   a claim of that shape with no marker is the citation-shaped
   universal the sweep removed eleven of, and stays forbidden. The body
   carries no links, DOIs, bracketed years or *et al* — those live in
   the block — and every reference was resolved by whoever wrote it
   before it was written, because a reference nobody checked is the
   first attempt's failure with better clothes. Each paper's *prior
   art* section says what in it exists already and what is new, and
   "new" there is a claim about the references listed, not about the
   world.
5. **The machinery is theorized at its perfect form, never as it is.**
   How the data should be structured, how patterns should be found and
   what the structure is for are frontier research and are in scope
   (paper 0). How the tree stores, fits or draws today is not.

`check:theory` holds the form: the status line, the perfect-form
sentence, an abstract, at least two axes named, a conditions section, a
potential section, citations only as numbered markers that resolve to
entries in a References block that a reader can resolve, and none of
the things that pulled the last attempt back to the tree — a citation
shape in the body, a source path, a gate name, a decision number. It
holds form, never truth or worth. Worth is the owner's read.

## The series

Read in this order. Each file opens with its own status line.

| Paper | File | What it argues |
| --- | --- | --- |
| 0 | `research/axiom-theory/paper-00-joint-model.md` | The joint latent model *is* the data structure: three geometries, axes as measurement models with bias models, model-relative summaries as the currency — an expected sufficient statistic where the model admits one, a clipped gradient where it does not — so the per-person join runs where the private column lives, which paper 12 shows is the cheap half, the pairing ledger, one currency for everything, and the self-extending property |
| 0a | `research/axiom-theory/paper-00a-design-as-pattern-finder.md` | The serving policy is the experiment: when each person yields one observation a day, choosing what to observe dominates any estimator, and the policy is population-scale sequential design under a spine, repetition schedules, pairing allocation and a survival term |
| 1 | `research/axiom-theory/paper-01-genome-x-logic.md` | Measured ability meets the genome: the genetics of reasoning measured directly rather than through schooling, and the keyed score as what lets the bank, the trait scales and the guessing record be read with ability partialled out |
| 2 | `research/axiom-theory/paper-02-observers-x-self-report.md` | What the people who know you see: observers' sealed predictions and aggregate ratings as the bias corrector for every self-report axis, a prediction split into the population's answer, the category's answer and what only acquaintance supplies, legibility and perceptiveness as separate traits, meta-accuracy measured before the reveal, and the reveal as a randomizable event whose bundled treatments are pulled apart |
| 3 | `research/axiom-theory/paper-03-genome-x-bank.md` | The genetics of what was never asked: imported genomes against a bank of unbounded depth, an item-level map read across unrelated people and within families and cleared of reliability, scale, response-style and selection artefacts, the bank's recovered factors beside their genetic structure as two estimated correlations, the same variation tested for whether it produces the same answer across countries at fixed ancestry, discovery items served blind to the genome, and a privacy budget spent per budget composed over the whole release history against a bank with no end, a finite lifetime cap rather than a schedule, so the item map is releasable only to a prefix |
| 4 | `research/axiom-theory/paper-04-declared-difference.md` | The shape of a declared difference: a self-declared neurotype, per condition and with what travels with it, read across every axis as a joint distribution rather than a score, including whether reading others differs against the target's own group norm, whether low legibility is opacity or effort, day-to-day variability under a designed schedule, the bank's items that separate published as directions and never as weights, and the tests that could tell a region from a category, under a no-screening rule about what exists and with the declaration's custody put to the owner as three shapes |
| 5 | `research/axiom-theory/paper-05-body-x-repeated.md` | Which changes are the body: daily occasion reports of sleep, energy and illness crossed with every repeated measure, the state share defined and identified by a within-window replicate the design buys, timescales an irregular schedule can resolve, a cross-lagged asymmetry in both directions reported as an asymmetry and never as a cause, illness against the person's own matched days, body-sensitivity as a posterior, how far a between-person finding travels, and the bad-day reporting gap published as a sensitivity band |
| 6 | `research/axiom-theory/paper-06-genome-x-molecular-stream.md` | A stream from the body, beside the genome: a passive wearable's molecular channel as the body axis's measured one, with no single transfer model — one analyte scaled from the blood, one made by the gland the fluid comes from and so a reading of the skin, others too slow or too faint — and a stability horizon that forces every cross-epoch phenotype to be scale-free and the calibration anchor to run at twice the drift; resilience as a return on a challenge that must not perturb the sampler, and aging as its within-person slope, which the years buy and an age spread cannot; the genetics of response shapes, with the heritable transfer ratio as the confound the crossing itself invents and carriers priced as a burden design; the panel carries no proteins, so detection is rescoped from early injury to late decompensation and owes an alert rate, a predictive value and a named responder; power as overlap times reliability; two measurements that would decide the shape, and four decisions worth more than any sensor |
| 7 | `research/axiom-theory/paper-07-verified-personhood.md` | One living person, and whose genome it is: "verification" split into five claims with different instruments — uniqueness across accounts, which is a one-against-many problem needing tens of bits and therefore the sequence rather than a handful of physiological scalars; liveness, whose challenge has a latency that bounds what it can gate; continuity, the one-against-one check the worn stream is right for, provided the identifying features are chosen apart from the phenotypic ones and the discontinuity detector has a false-positive budget against the ruler movers; attribution, re-anchored at the recurring calibration draw the body paper already funds; and session binding, without which the other four verify a body and not an observation — paper 9's enrolled face is its instrument, under an enrolment to the device-and-genome chain this paper must carry. Attenuation from misattribution recovered by randomized rollout order, a validation subsample and known-rate corruption, so no population is left unverified to calibrate the rest; the subsidy's exclusion restriction fails for money and holds for offer logistics, randomized within stratum, returning a complier-restricted answer |
| 8 | `research/axiom-theory/paper-08-arranged-competition.md` | What a person does when it counts: competitions the system arranges, where difficulty, opponent and payoff are all set per encounter — and the cancellation that decides what such a design can measure, since a paired-comparison likelihood sees only the difference between two sides, so the common part of a stakes effect vanishes exactly and the level of "how much better people do when it matters" is invisible in principle rather than imprecise. What survives is the between-person contrast; the level returns only through asymmetric stakes, a graded score, or fixed-difficulty anchors outside the network, which are also the only thing that makes a learning rate absolute. Priced in encounters, since a binary result's information about a latent difference is at most a quarter; two arms that cannot be one, because assigned stakes forbid the after-loss behaviours that chosen stakes exist to show; the reported-against-enacted reading rebuilt as a discrepancy factor rather than the difference score papers 1 and 2 refuse; dropout caused by the outcome published as a non-ignorability band |
| 9 | `research/axiom-theory/paper-09-appearance.md` | What is seen first: appearance as two instruments kept apart — morphology, a physical measurement with a calibration and a drift problem, and perception, an observer rating with a face as its stimulus, whose readers agree with each other far more than the face agrees with the person. The step the subject always takes, scoring the readers' consensus against a criterion that never saw the face and calling it validity, is not available: a face predicts a person through two doors, shared biology and a lifetime of treatment, and every criterion the series holds is downstream of the second, so the estimand is the coupling with its doors named. The treatment door is identified per exposure by randomizing whether one person is displayed to another, as an interaction with appearance at the choice-set level against a placeholder; its lifetime integral by nothing; within-person appearance change is the one timing handle. Presentation as three acts, the visible state as a fourth instrument that is itself a perceived signal, two clocks as residuals validated against outcomes, one session-binding claim for paper 7 under an enrolment requirement, and two decisions stated as enumerated shapes for the owner |
| 10 | `research/axiom-theory/paper-10-reasoning-in-opinion.md` | Reasoning in the clothes of opinion: a key that lives in the relation between two items rather than in either — entailment as a triple conditional on the person's own bridging premise, exclusion at a stated scope, a bound only on explicit likelihood comparisons, equivalence as the weakest of the four because a frame carries information by having been chosen — so a bank authored to carry relations measures reasoning with the test situation removed. The centre is a bind: a relation is informative in proportion to how many violate it and defended in proportion to how few could have read it another way, and those are one quantity, so a key cannot be written and is earned from violations that track the keyed score after style and profile are removed and from violators who cannot supply a reinterpretation when asked, and is retired on failing either. A key error is common to everyone, so only contrasts are readable; the scoring is a constraint region that binds only for some positions; a randomized disclosed arm identifies the situation contrast, hosts every cover-breaking probe and measures the consent cost the draft asserted; motivated reasoning read with difficulty from neutral analogues and the stake from an unscored item, with topic-specific defence failure named as its twin; counts derived from the between-person spread and priced in shares of one observation a day |
| 11 | `research/axiom-theory/paper-11-learned-representation.md` | One geometry, learned: the representation trained to predict each person's next observation from their whole record across every axis, where the axes actually meet — so cross-axis transfer conditional on a person's history, which covariance cannot express, is its native product, and its map's entry is the fraction of a target axis's own code length a source saves at a stated grain. It is the instrument G4's value ledger runs on: the code-length saving per unit of attention, marginal to the portfolio, on one shared held-out target so the rows compare, with the coupling column priced in posterior information because code length is flat where structure lives. Every prediction's anchor share is an interval, not a guarantee, since the anchors are recoverable from proxies; the loop is two hazards, selection and performativity, corrected by importance weighting, the five-clause admission test, and randomized withholding; the representation is a release that memorizes, trained under paper 12's custody with its version sequence differenced and budgeted; and whether the volume has been reached at all is the measurement before every reading. Two releases are the owner's decision |
| 12 | `research/axiom-theory/paper-12-where-the-join-runs.md` | Where the join runs: the genome crossings as computations under a column that must not move — and a custody constraint does not forbid the joins the genome enters, it re-sorts them by cost, counter-intuitively. The per-person join runs on the device, because the device holds both the genome and the person's own copy of their public answers, so it is single-custodian and the learned representation ingests the genome as a budgeted federated gradient, not a fixed summary. What runs nowhere cheap is the cross-person structure a per-variant association needs — ancestry components over everyone's immovable genomes, linkage, cryptic relatedness — so the population GWAS that looks like the plain baseline is the expensive, budget-bound, confounded computation, which inverts the biobank's cost ordering. Attestation is integrity not authenticity, so authenticity routes to paper 7's supervised sample; the budget is a finite lifetime cap at family-scope unit, and small ancestry strata starve as a certainty; the join itself is a re-identification act. Ends with the releases the owner must ration, as forks |
| 13 | `research/axiom-theory/paper-13-what-follows-an-event.md` | What follows an event: the event as the one thing that gives every source's within-person series a common origin, so the response ordering across sources — which axis moves first, which follows, which never — becomes a reading no source makes alone and no cross-lagged asymmetry recovers. The first class is two families, occurrence-randomized with an unassigned arm and timing-randomized with an early-against-late estimand at a shrinking horizon, and for both the counterfactual is the concurrent arm at the same calendar position, never the person's own pre-series; under staggered timing the already-assigned are not controls and the estimator names its clean comparison; exposure runs on a graph per family and a clean baseline is a reserved block; post-event outcomes are read on the eligible-drawn stream because event-triggered serving changes what is served; the world's events carry named estimators, a calendar-position match, a one-sided negative control and the joint leaving hazard; behavioural resilience is defined only on a fixed, dose-controlled adverse challenge as a competing-risks quantity; offer designs are instruments with their restrictions stated, and the draft's third class is withdrawn; and the randomizations are a second budget the measurement budget cannot price. Every fork carries what is imposed on whom |
| 14 | `research/axiom-theory/paper-14-interests.md` | What a person turns toward: interests as the content of a propensity papers 5, 6 and 0a already model per occasion — consolidated into an axis and split into the part recorded pre-response state identifies, which is entered into between-person couplings, and the part that depends on the latent the item measures, which is missing-not-at-random through the trait and stays paper 5's band because entering it conditions on the outcome; selection on trait strength is between-person and biases no within-person reading. The cross-axis reading is with ties: who tie because they are alike against who become alike because they tied is not separable in a record and is separated by a randomized offer, read as an intention-to-treat and a complier effect under an exclusion restriction the paper states and doubts, two-sided for any direction, under an exposure mapping. Declared and revealed are not assumed one construct; the serving mechanism is named per sub-channel; drift is a prodrome on unpredictable-onset families with an independently ascertained denominator; avoidance is a timestamped act or an unobserved offer; the custody split is an assumption and where the attention record lives is the fork |

The planned list is spent: every one of the four unbuilt axes and all
four of the planned crossings — the logic test against the bank, the
learned representation, custody-preserving computation for the genome,
and causal patterns from within-unit events — has a paper, and paper 14
adds the one *built* axis that had none, interests. What comes next is
whatever the reviews surface as the largest gap, and the owner names it.

**Every paper has been adversarially reviewed and rewritten against the
findings, and on 2026-09-07 the whole series was read at once for the
seams that leaves.** A rewrite that reverses a thesis leaves earlier
papers citing the withdrawn version, one term naming several objects,
and a rule stated in one paper broken in another. The vocabulary that
sweep settled, which a new paper obeys: the two never-selected-on
streams are **anchor-drawn** and **eligible-drawn**, never "the uniform
stream", because only the eligible-drawn one prices a source that is
not an anchor; **anchors** are the shared item set and a person's
recorded categories are **profile facts**; G1 holds the
**co-observation graph**, G2 the **publication ledger**, G4 the **value
ledger**, and none of them is "the ledger"; a privacy constraint is a
fork with its arithmetic and never a flat refusal; a consent
requirement is met by building the consent; and a claim about what no
one has ever done is replaced by a claim about what a design measures.

## The general track

**The owner's pivot, 2026-09-05:** *"i want a pivot… design how to most
efficiently find data between axioms and how to design the best database
and pattern finding mechanisms, make it theoretical, not connected to our
specific axioms but general theory."* So beside the axiom series there is
a general track under `research/general-theory/`: a theory of any
population of units measured by many sources under an observation
budget, which names no product and none of this app's sources. Its
papers open with a **Setting.** paragraph that defines units, sources,
grains and budget abstractly, and `check:theory` holds them to that and
fails one that reaches for this app's sources as its example. The axiom
series' papers 0 and 0a are the instance of this track for the sources
this app has; the general track is now the foundation both stand on.

**The owner's second pivot, 2026-09-07:** *"axiom theory could be used
in other fields as well from psychology to economics to AI development
… focusing on only creating new data axis and seeing the patterns in the
most efficient way turns the focus from human bias and theory to a more
pure data optimization effort where the way to advance is to add a new
or better axis and or find a better way to find patterns between
them."* That is a thesis about research programmes rather than about
any one population, and G4 is it written as a general paper — the two
moves, where theory relocates rather than disappears, and why a mature
programme is source-driven.

**The owner's third pivot, 2026-09-07:** *"i really want to explore and
research how to find patterns and structure the data in ways to find
patterns, maybe we can take some inspiration from llms."* G1 said what
can be known, G2 how to hold it, G3 how to estimate it, and none says
how a single learner finds structure nobody specified. G5 is the
language-model recipe read against this setting — the record as a
sequence, tokenization as the data-structure decision, one predictive
objective that has to be factored before its loss is honest, scale as a
constrained frontier, and reading the representation — with the loop
named as its one non-transfer, and what the setting adds to it (the
honesty scaffolding, an interval on a text-pretrained prior, the limit
that a loss settles no structural claim) sorted apart from that. G6
follows it into the geometry every paper calls "one": what the space a
unit is placed in actually is, and what a distance in it licenses. G7 is
the grain every one of them deferred — the relation as an object of
measurement, what a directed observation on it decomposes into and the
design that identifies each part (which corrected a condition G1 and G3
had stated), the two populations a relational reading can be about, and
what the graph does to every unit-level number.

| Paper | File | What it argues |
| --- | --- | --- |
| G1 | `research/general-theory/paper-g1-discovery.md` | The discovery problem: a coupling between two sources is point-identified without assumption only from units observed on both, an interval fixed by the marginals otherwise, so the weighted co-observation graph is the map of what can be known and its connectivity is necessary but not sufficient; the choice of what to observe is the whole answer where it decides between a structural zero and a point, and elsewhere its advantage over estimation is measured against a named comparison; the objective as an explicit scalarization with a stated exploration rule, a hazard on the continuation term and a coverage preference written down as one; six honesty constraints; allocation as planned missingness over the per-unit source set; roles attached to observations rather than pairs; the value of a source relative to its portfolio on a stream the policy never chose |
| G2 | `research/general-theory/paper-g2-database.md` | The database as the model: the observation attempt with its decision, outcome, observed state and a reference to the estimate the policy used as the atom of an ordered ledger; three grains with the tensor as a view; a versioned model store with a participation record and a publication ledger in which every release, shipped model versions included, has a row; custody as physical layout with joins computed by the custodians of the columns they touch, summaries that are not private for being summaries, secure aggregation stated with its conditions, and an output-privacy budget on a named unit of protection composed across releases; time as version intervals over ledger cuts; folds whose incremental equality is an algebraic condition; erasure as an ordered event with its reach stated; the type a published number must carry; three readers, each a release |
| G3 | `research/general-theory/paper-g3-mechanisms.md` | Pattern-finding mechanisms: the estimand hierarchy with a time on every level and the pooled coefficient named as the marginal regression; one hierarchical joint model carrying two information sets, the full one for placement and the prior-free one for every published coupling, with a tripwire for a source whose model has gone wrong; level separation with the centre estimated jointly and a defined discrepancy net of each level's error; bias as model terms each with the design that identifies it; learned representations judged per estimand against the strongest classical floor, with faithfulness as an expected log-ratio that licenses substitution only; causal readings randomized under an exposure mapping and consent, or under sequential ignorability with the estimators it admits; a five-clause admission test with a published failure rate; evaluation on the non-adaptive stream for predictive claims with adequacy checked beside it; computation under custody with its errors measured and its two binding points named |
| G4 | `research/general-theory/paper-g4-two-moves.md` | Two levers: a frame in which a research programme's knowledge of a population's coupling structure moves with what the observations carry and what the mechanism extracts, stated as a frame rather than a theorem proved complete, since a programme is defined as making decisions of those two kinds. The measurable half is real — a source's value on the eligible-drawn evaluation stream is a number a belief cannot fake, so disagreement about what matters, given a fixed target, becomes disagreement about which source to fund and is settled by the value ledger — and the unmeasurable half is named: the target is a theory, the candidate set's omissions are as invisible as any, identification is a state the value ledger cannot see so the most valuable observation can register near zero, and Goodhart is the failure the evaluation stream does not catch. The source-driven asymmetry holds only for a fixed target and class and a growable budget. Theory relocates to four written objects rather than disappearing; the transfer is stated for programmes measuring persons, agents and learned systems |
| G5 | `research/general-theory/paper-g5-the-recipe.md` | The recipe: the sequence-learning recipe — a corpus, a cut into tokens, one predictive objective, scale, reading the representation — read against a population collected by a policy. A unit's sequence is a fold version over a ledger cut in G2's sense, and every decision in the cut (vocabulary under an invariance test, value, time's representation and resolution, refusals and expiries as tokens with a class, the fold window, the placement of fixed attributes, within-period order, context length, the event class, and the relational grain as its own sequence) is a versioned claim about what may be compared with what. The objective is honest only once it is factored into a serving factor and a response factor, with only the second scored; the propensity enters by import weighting toward a target stated first and never as a token, a masked objective is that reweighting and nothing else, and loss is reported per stream and per source on the two never-selected-on streams. The sequence is assembled only where one custodian holds every column, or from emitted summaries, and every learner version is a release with a row and a differencing budget. What the recipe supplies that no covariance model does is a per-unit, per-context map of which observations inform which, defined as an ablation quantity on the eligible-drawn stream with a routing weight demoted to a diagnostic — and it creates no co-observation, so it narrows a coupling only as far as G1's third-source conditioning licenses. Placement is amortized inference with its two errors, where the learner's edge is smallest; scaling is a constrained frontier with a loss form whose asymptote is noise plus response error plus class error, read against the replication that identifies noise, and the coupling target priced in posterior information; probes run under the floor's rotation convention, and representation-level intervention joins G3's input-level counterfactuals. One non-transfer — the loop, in which the learner chooses its own corpus — beside three things the setting adds: the honesty scaffolding with its channel named, an interval on the prior a text-pretrained shortcut imports (the one people-scoped claim), and the limit that a loss settles no structural claim |
| G6 | `research/general-theory/paper-g6-the-space-of-persons.md` | The space of persons: what "one geometry" names is two constructible spaces — the classical latent space with named coordinates under a recorded rotation convention, and the learner's representation, which has no metric until one is declared as an object with its own version row — and an outcome criterion neither of them is, two units alike if their predictive distributions on what comes next are alike under one stated divergence. Distance validity is that criterion's error stated as a statistic: over pairs co-observed on a held-out target on the eligible-drawn stream, the concordance between distance order and disagreement order in the target's own scale — invariant to monotone change of the metric, one half at no information, read beside the ceiling within-unit noise sets, with an interval from resampling units and not pairs, a pair count that thins quadratically in the number of sources and sizes the eligible-drawn share, a shrinkage correction because placements are posteriors, a period- or unit-holdout protocol on the deployed space, and the type a published number carries; the comparison between spaces gates the use of a distance per target and never the learner's place. A region is a mixture component that improves held-out prediction and passes the five clauses, not a rejection of unimodality, with a continuum as the default and membership a three-shape fork; intrinsic dimension is per level under the stated class, cut, capacity and scale, the two levels are two variance decompositions on one measurement scale, and trait and state are declared bands separable from response error only under the short-lag replicate; a direction is named by a probe read under the floor's rotation convention, an admission test and a representation-level intervention, and what is named is a decodable subspace; a placement survives a refit by predictive substitutability against a reference version under a stated tolerance, which preserves neither identity nor distance, while coordinates compare only in the classical space under its convention; a source's geometric worth is a state per target beside the value ledger, never a second column; a pair carries a relation-specific latent that degree, replication and both directions identify in three parts, so it is never a distance. Every pairwise read is placed against the custody rule and the binding point G3 names, and the uses are stated with their forks: neighbours only under a validity number for the implied target, proximity-driven pairing identified under an exposure mapping and consent, ranking and membership as forks with three shapes each, a coordinate as a release, and a display with its surviving validity |
| G7 | `research/general-theory/paper-g7-the-relational-grain.md` | The relational grain: "relation" names a recorded membership, an observation on a relation, and the latent a relation carries beyond its members, and a graph is a set of the first — a design object, not a population fact. A directed observation decomposes into mean, sender, receiver, relationship term and error with two reciprocities, and the design that identifies each term is a table — degree in each role separates the pair's term from the members', replication of the same pair inside its timescale separates it from error, both directions in separate sittings identify the dyadic covariance and only replication its correlation, a context shared by pairs identified from two pairs sharing it and no member or from units crossing contexts — which corrected the sentence G1 and G3 stated; a relational source's invariance across relation types is tested before pooling; projection is identified against a purchased unit-level source through G1's weaker link. A symmetric observation identifies a quotient under a stated model class — a comparison is blind to everything common, a joint outcome cannot attribute without an odd cycle — pinned by a unit-level source bought where the construct is not an anchor, an asymmetric condition, or a per-member outcome; the pairing rule is recorded and its propensity entered under G1's two-part steering rule, with a blind share for every coupling against a unit-level source. The recorded graph is two selections and two populations, formed relations and possible pairs, and only the assigned stream — prompted relations from a bounded partner pool, its uniform share the eligible-drawn stream at this grain — reaches the second; the pool's size, the floor, the weights and the standing charge are one decision, and whether the design may prompt a relation at all is the first fork. Formation is an offer randomized and an acceptance chosen, the asymmetry of a relation's effects on its members a contrast of two design-identified effects, separable from initiation only under offers in both directions; dissolution is informative exit with the members' later observations as a check; similarity among the related has four causes separated on the post-placement stratum net of the placements' error. The graph reaches every unit-level reading: a design effect whose form differs for a mean and a coupling and whose sign follows the correlation's, unit resampling invalidated, an unrecorded relation's bias bounded not signed, the budget composing at the graph's rate, and the second fork — whether a receiver may read what senders reported, in six shapes with the open shape's candour cost measured on the consenting population. A relational observation's layout follows the fork, a member's erasure reaches received observations in one of three shapes, G5's double-counting rule is stated, a relational source's worth is its saving on the uniform share with the pair's identification tracked beside the ledger, and the cost is derived as a line — about eighteen hundred pairs observed twice in each direction to tell a reciprocity of a tenth from zero once the terms' reliability is in it |

## The harness

`research/sim/` is the series' evidence for claims about its own
machinery, and it exists because the owner's rating question got the
honest answer — no data, no simulation, every number arithmetic from a
stated rule — and the owner chose to close that gap first. It has
three parts, zero dependencies, and a seed on every number:

- **Identification, exactly.** A variance component is identified on a
  design if and only if its covariance matrix is linearly independent
  of the others', so each row of G7 §3's table is a design whose null
  space says which combinations no estimator separates. There is no
  Monte Carlo noise to argue with, only a rank. The same machinery
  checks G7 §4's pairing-graph results for the fixed part of a
  difference-type and a sum-type observation.
- **Sizing, by Monte Carlo.** G7 §9's reciprocity line — pairs needed
  at a stated correlation, attenuated by the relationship terms'
  reliability — drawn and counted, with the extra cost of removing
  member terms by centring priced beside it.
- **G6 §3's statistic.** Distance validity as a concordance: its
  invariance to monotone change of the metric, its half at no
  information, the ceiling the target's noise sets, the interval that
  must resample units and not pairs (the pair-independent one is shown
  under-covering), the effect of posterior shrinkage on the distances,
  and the units a stated difference between two spaces takes.

`npm run test:sim` runs the small seeded cases (the sixth test runner;
it is in CI's lint job beside `test:scripts`); `npm run sim:write`
runs the report size and regenerates `research/sim/REPORT.md`, which
is what a paper may cite for a claim about its own statistic. The rule
is the one the papers already live by: where the report contradicts a
paper, the paper moves, and `docs/DECISIONS.md` says so. Its first run
moved three: G7's row on a context term shared by several pairs said
"identified only where units cross contexts", and the rank says a
context of four units identifies it with no crossing at all, because
two pairs with no member in common share the context and nothing else;
G6 said posterior shrinkage inflates distance validity, and the
statistic — which reads only the order of distances — is within a few
thousandths whether the placements are shrunk or not; and G6's
pair-independent interval is too tight in variance by a factor of
order n, not in width. Every sizing line reproduced.

## How a paper reaches the product

1. The paper's *what it would take* section names the collection,
   consent or nothing per axis. That is the build request. There is no
   separate request file and no verdict step.
2. The owner's tick on the paper's row, in the same grammar as
   `docs/MERGE-LIST.md`, is the approval.
3. The axiom builder (`docs/PROGRAM-RUNBOOK.md` § The axiom builder)
   decomposes a ticked paper into `docs/WORKLIST.md` items tagged by
   account, a `docs/VISUAL-REQUESTS.md` row where a new surface is
   needed, and `docs/OWNER-LIST.md` rows for anything that is a
   decision. It reads this directory, never a branch.
4. The list workers build the items; the merge list and the shepherd
   merge them. `docs/AXIOMS.md`'s status word stays the licence for
   user-facing surfaces on the axes it marks explored.

Nothing in the tree cites a paper. A paper that turns out to be wrong is
struck through with the reason. That is the only status change that
exists, and it only goes down, so there is nothing to trade ambition for.


### The decisions the papers put to the owner

Nine papers hand the owner enumerated shapes rather than deciding.
Each is stated in that paper's own section with what it exposes, to
whom, the smallest shape that still gets the value, and what each
option costs.

| Paper | The decision |
| --- | --- |
| 2 | What may be disclosed to a target about an observer set they could partition |
| 4 | Whether a per-person projection onto the declared signature exists at all; what the item map publishes |
| 9 | What a person is shown about readings of their own face; the custody of the image |
| 10 | The consent shape for a cover story, five shapes, with disclosure's cost measured first |
| 11 | Whether a per-person representation may be released, and to whom |
| 12 | Which couplings win the finite release prefix; the per-person genome embedding; within-family as product or pilot; whether an enclave may hold raw genomes; the small-stratum reserve; a minor's built consent |
| 13 | Which event families may be randomized; whether adverse events may be assigned; consent shape per family; unpredictable timing as experience |
| 14 | Whether the attention record may be pooled; whether avoidance may be read |
| 6 | Consent scope for the stream and its calibration draw |


## What came before

The twelve lanes' 129 claims are kept as an idea list on the evaluation
branch behind pull request #394, marked so that a paper may pick from
it and never extend it; the reasoning behind each is in the history of
the orphan `axiom-theory` branch, which is otherwise discarded. The
programme's product-side record, its bridge and the lanes' inventory are
`docs/AXIOM-THEORY.md`; the diagnosis of the drift is that page's
§ The drift on the same evaluation branch.

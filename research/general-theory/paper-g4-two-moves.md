# Two moves

*General paper G4: a research programme over a measured population as a sequence of exactly two moves — add or improve a source, or improve the mechanism that finds structure among sources — where theory relocates rather than disappears, and why the programme becomes source-driven in the long run.*

**Status: theory research.** Nothing here describes any product; `research/README.md` says what a general paper is and what holds it to its setting. G1 supplies the value of a source on the non-adaptive stream and the honesty constraints; G2 the ledger the moves are recorded in; G3 the mechanisms, the classical floor and the admission test.

**Perfect-form test.** If the app did not exist, this would still be worth saying because every research programme over a measured population advances by one of two moves and no third — observe something new or better, or extract more from what is observed — and a programme that says so, measures the value of each move, and lets the measurement rather than a prior belief choose the next one has not removed theory from the programme but has relocated it to the three places where it can be written down and priced, which is what makes the disagreements a field lives on resolvable by a number.

**Setting.** A population of units measured by K sources under an attention budget, as in G1: each source yields a response through a measurement model from a latent state, with a bias structure, a cost, a custody class and a grain; the object of discovery is the coupling structure among the sources' latent quantities, across units, within units over periods, and on relations. Add to that a *programme*: a sequence of decisions over time about which sources to add or improve and which mechanisms to use to find structure, made by people who begin with beliefs about what matters. Nothing in this paper depends on what the units, the sources, or the beliefs are.

**Abstract.** A research programme over a measured population can advance in exactly two ways: by observing something new or better — a source added, or an existing source made more reliable, cheaper, or finer in grain — or by extracting more from what is already observed — a better mechanism for finding structure among sources. This paper states that decomposition, argues it is complete in a precise sense, and develops the thesis that a programme organized as a sequence of those two moves, each chosen by its measured value rather than by prior belief, shifts the programme's centre of gravity from theory to data. The thesis is defended and then bounded. It is defended because the value of a source, measured in predictive information on a stream the programme did not choose, is a number no belief can fake, so a disagreement about what matters becomes a disagreement about which source to add next and is settled after the fact. It is bounded because theory does not disappear under the method; it relocates to three places — the set of candidate sources, which cannot contain a source nobody thought of; the objective the mechanism optimizes, which is a theory of what is worth knowing; and the choice of units and grains, which is a theory of what exists — and the method's actual advantage is that it forces those three to be written down, priced and measured, under the constraints that keep an information-seeking programme from fooling itself. The two moves are then shown to be asymmetric: what a mechanism can extract is bounded by what the observations carry, so as extraction approaches its bound the marginal value of a better mechanism goes to zero while the marginal value of a new source does not, and a mature programme is source-driven. What the method makes decidable follows — a value ledger per source, whether the programme is extraction-bound or information-bound, the path dependence of the order in which sources were added, and the failure modes that a data-first programme has and a theory-first one does not. The transfer to other populations is stated for three: a science of persons, where sources are instruments and the failure the method repairs is instruments without measured value; a science of agents and exchanges, where sources are records of choice and the method's value depends on the causal mechanisms it inherits; and the development of learned systems, where the two moves are what the field already does and the method's contribution is the constraint that matters most when the mechanism chooses its own data.

**1 · The two moves, and why there is no third**

Fix a population, a budget and a moment. What the programme knows about the coupling structure at that moment is a function of two things and only two: what has been observed, and how much of what the observations carry has been extracted from them. Observations carry a bounded amount of information about the structure — bounded by the sources' measurement models, the budget, and the design that allocated it — and a mechanism recovers some fraction of that bound. Knowledge is the product.

So a programme can raise what it knows in two ways. It can raise the bound: add a source, improve one so its measurement model is tighter or its grain finer or its cost lower, or allocate the budget better so the same sources carry more. Or it can raise the fraction: a mechanism that finds structure the previous one could not express, estimates it with less error, or judges it more honestly. There is no third way, because there is no third factor in the product. A new theory, in this frame, is not a move: it is either a proposal for a source, a proposal for a mechanism, or a claim about the structure that one of the two moves will test.

That last sentence is the thesis in its strongest form, and the rest of the paper is what has to be true for it to hold.

**2 · Theory-first and source-first, as two programmes**

A theory-first programme begins with a belief about the structure, derives a claim, and observes what tests the claim. Its hypothesis space is the space of claims its participants could derive, so it finds what it looked for and not what it did not; and its next move is chosen by which claim is most interesting, which is a judgement about beliefs.

A source-first programme begins with a portfolio of sources and a mechanism, measures the value of each source on a stream the programme did not choose, and chooses its next move by which source or which mechanism improvement is measured to be worth most. Its hypothesis space is whatever structure the sources carry and the mechanism can find, which includes structure nobody derived; and its next move is chosen by a number.

Neither programme is pure and the paper does not pretend the second one is. What section 3 establishes is where the beliefs live in each, and what section 4 establishes is why the second placement is better.

**3 · Where theory relocates**

The method does not remove theory. It moves it to three places, and a programme that believes it has become theory-free has stopped looking at them.

*The candidate set.* The value of a source can be measured only for a source someone proposed. A source nobody thought of has no value in the ledger and cannot be chosen by it, so the candidate set is a belief about what could matter, held by whoever writes it, and the programme's reach is bounded by that belief exactly as a theory-first programme's is bounded by what its participants can derive. The difference is that a candidate set is a list, it can be published, it can be extended by anyone, and each entry carries the reason it was proposed — which is a belief written down where a theory-first programme's beliefs are not.

*The objective.* The mechanism finds structure by optimizing something, and G1 is explicit that the objective is a scalarization: bits about population couplings, bits about each unit's placement, bits about within-unit dynamics, weighed against each other, with an exploration rule, a coverage preference and a survival term. Every weight in that scalarization is a claim about what is worth knowing, which is a theory, and a programme that calls itself data-driven while leaving its weights unstated has hidden its theory in a place harder to find than a hypothesis. The method's discipline is that the objective is published as one object, so the theory it encodes is readable and its changes are recorded as moves.

*The units and the grains.* What counts as a unit, what counts as a period, and whether a relation is an object are decisions that precede every source, and they are theories of what exists. A programme cannot measure the value of a grain it did not define.

So the method's claim is not that theory is gone. It is that theory is confined to three named places, each of which is a written object rather than a habit of mind, and that everything outside those places is chosen by measurement. That is a smaller claim than the thesis in its slogan form and it is the one that survives.

**4 · Why the relocation is an improvement**

*A measured value cannot be argued with, only re-measured.* G1 defines a source's value as the predictive information it adds, relative to the portfolio, on a stream the policy never selected on. That number has three properties a belief lacks. It is computed after the source is in place, so it cannot be inflated by hope. It is relative to the portfolio, so a source that duplicates another is worth what its duplication leaves. And it is measured on the non-adaptive stream, so a mechanism that chose its own data cannot credit itself with the choosing. Two people who disagree about what matters disagree, in this frame, about which candidate to fund next, and the disagreement is settled by the ledger a period later.

*The direction of the programme is set by a gradient rather than a debate.* At each moment the ledger says which source added the most and which mechanism improvement bought the most, and the next move is the one the ledger points at. A programme run this way still has arguments — about the candidate set, the objective and the units, per section 3 — but it has moved them off the path of the day-to-day decision, which is where a theory-first programme spends most of its disagreement.

*Failure is visible.* A theory-first programme that has been looking in the wrong place discovers it when a claim fails, which can take years. A source-first programme discovers it when the ledger stops moving — no candidate adds value and no mechanism improvement extracts more — which is a measurement taken every period and which points at the candidate set as the place to look.

*What the improvement is not.* It is not a reduction in bias in general. It is the replacement of one kind of bias, held in the heads of participants and expressed as which claims get tested, by another, held in three written objects and expressed as which sources get added. The second kind is measurable and the first is not, and that is the whole of the improvement.

**5 · The asymmetry, and why a mature programme is source-driven**

The two moves are not symmetric, and the asymmetry follows from the product of section 1.

Write the bound as the information the current observations carry about the structure, and the fraction as what the mechanism extracts of it. A better mechanism raises the fraction, and the fraction has a ceiling of one. So the marginal value of a mechanism improvement falls as extraction approaches the bound, and at the bound it is zero: no mechanism recovers what the observations do not carry. A new source raises the bound itself, and its marginal value is set by what it is coupled to in the population, which does not go to zero as the mechanism improves.

Two consequences. First, a programme has a state — how close its extraction is to its bound — and that state decides which move is worth making. Far below the bound, a new source is wasteful, because the programme is not extracting what it already holds; near the bound, a better mechanism is wasteful, because there is nothing left to extract. The method is therefore not "sources first" as a slogan; it is "measure the state, then move." Second, the bound is reached and stays reached, because mechanisms mature and observations do not run out of things to be coupled to, so a programme spends most of its life near its bound, and there the only productive move is a source. That is the structural basis for putting the sources first, and it is a statement about the long run rather than about every moment.

The state is not observed directly, since the bound is not known. Its proxy is the trend in the ledger: diminishing returns on successive mechanism improvements, measured on the non-adaptive stream against the classical floor, signal that the programme is information-bound; a mechanism improvement that buys a large gain signals that it was not. A programme that does not run its floor has no proxy and cannot know its state.

**6 · What the method makes decidable**

*The value ledger.* Each source's marginal value, per target — population couplings, unit placement, within-unit dynamics — on the non-adaptive stream, revised each period. This is the object a theory-first programme does not have and the source of every decision below.

*The state of the programme.* Extraction-bound or information-bound, from the ledger's trend, per target, which decides the next move.

*The order, and its path dependence.* A source's value is relative to the portfolio, so the order in which sources were added changes what each was measured to be worth, and two programmes that added the same sources in different orders hold different ledgers. The order is recorded as the programme's history; the path dependence is a measured property of the population, since a source whose value does not depend on the order is one that is coupled independently of the rest; and where the order matters the principled quantity is the value averaged over orders, which is expensive and is approximated by sampling orders rather than assumed away.

*The next-source question as an empirical one.* Which candidate to fund is answered by a pilot on the non-adaptive stream at a stated cost, and the answer is a number with an interval, not a case.

*The failure modes a data-first programme has that a theory-first one does not.* G1 and G3 already name them and the method inherits them as its own hazards: an information-seeking policy starves the units it finds least surprising, so the coverage term is a correction for a bias the pure objective has; structure found in residuals can be the missingness pattern the policy itself created, so the admission test is a correction for a bias the loop has; and a mechanism that chooses its own data can credit itself with the choosing, so the non-adaptive stream is a correction for a bias the evaluation has. A programme that adopts the two moves without these three constraints is more biased than a theory-first one, not less, because its biases are invisible to it.

**7 · The transfer**

The setting names no population, so the method applies wherever units are measured by sources under a budget. Three cases show what the two moves are and which constraint matters most.

*A science of persons.* The sources are instruments — questionnaires, tasks, ratings by others, records of behaviour, physiological channels. The failure the method repairs is that instruments multiply without a measured value: a new scale is published because it is new, and its worth relative to the portfolio is never a number. Under the method each instrument carries its marginal value in bits on the non-adaptive stream, an instrument that adds nothing beyond the portfolio is retired rather than defended, and the next instrument is chosen by the ledger. The constraint that matters most is the admission test, because a programme that keeps adding instruments to the same people manufactures factors out of its own missingness faster than any other kind.

*A science of agents and exchanges.* The sources are records — of choices, transactions, stated preferences, relations among agents, and interventions the programme itself makes. The theory-first tradition here is model-first: the structure is assumed and the data identify its parameters. The method inverts that — measure the value of each record type against the portfolio and let the ledger say which to collect — but its value in this population depends on the causal mechanisms it inherits from G3, because a coupling among records of choice is a marginal regression until a design identifies it, and the moves here include interventions, which are sources of the first class. The constraint that matters most is the log: every intervention the programme makes must be recorded with its propensity, or the programme's own actions become the confound it cannot see.

*The development of learned systems.* The sources are the data a system is trained and evaluated on; the mechanism is the system's architecture and objective. This population already runs on the two moves — more or better data, a better model — and has for as long as it has existed, so the method adds no move it lacks. What it adds is the state of section 5 and the constraint of section 6 that matters most here: a learned system that chooses or generates its own training data has closed the loop the admission test exists to police, and a programme that evaluates such a system on data the system influenced has lost the non-adaptive stream. In this population the method is not a proposal; it is a description of what the field does, with the three constraints it most often omits named as the difference between a programme that learns and one that confirms itself.

**8 · What would have to hold**

*The three relocations are written objects.* The candidate set, with each entry's reason; the objective, as one published scalarization; the units and grains, declared. A programme that cannot produce all three on request has theory it is not looking at.

*The value of a source is measured as G1 defines it* — marginal to the portfolio, on the non-adaptive stream, per target — and never as its correlation with anything, which is what a source's champion will offer instead.

*The three constraints are in force* — the coverage term, the admission test and the non-adaptive stream — as the price of the method rather than as options, because without them the method's biases are larger than the ones it replaced and invisible.

*The classical floor runs continuously*, because the programme's state is read from the ledger's trend against it, and a programme without a floor does not know whether to add a source or a mechanism.

*The order of additions is recorded and its path dependence estimated*, by sampled orders, and a value is published with the order it was measured under.

*A mechanism improvement is judged on the non-adaptive stream by code length, per G3*, never on data it chose, and never by a metric it defined.

*The candidate set is open.* Anyone may add an entry with a reason, because the set is the largest remaining place for belief and a closed set is a belief with a lock on it.

*A move is recorded as a move.* Each addition, improvement and mechanism change enters the ledger with its measured value before and after, so the programme's history is a sequence of moves with numbers and not a narrative.

**9 · What would test the thesis**

The thesis is a claim about programmes, and it is testable on programmes. Two programmes on one population at one budget over one span: one theory-first, its participants deriving and testing claims as they choose; one source-first, run under sections 4 through 8. The comparison is the predictive code length each achieves on a held-out non-adaptive stream at the end of the span, per target, and the number of couplings each has identified that the other did not. The test is expensive and it is the only one, since everything above is an argument until a programme has been run both ways. Its failure mode is that the two programmes converge, because a theory-first programme run well measures what its claims are worth and a source-first programme run well proposes candidates from beliefs — in which case the thesis reduces to section 3, which says the two differ only in where they keep their theory, and that reduction is itself a result.

**10 · The potential, and what remains open**

As a method, what the two moves offer any population is a way to turn the question "what should we study next" from an argument into a measurement, and to know from the ledger's trend whether the answer is a source or a mechanism. For a science of persons, that is a value per instrument and a retirement rule. For a science of agents, it is a value per record type under the identification the causal mechanisms supply. For the development of learned systems, it is a name for what is already done and the three constraints most often left out.

What remains open is research. Whether the state of a programme can be read from its ledger's trend with enough precision to decide a move, or whether the proxy of section 5 is too noisy near the bound. How to price a candidate whose value can only be measured by funding it, which is the pilot problem and has no free solution. How the path dependence of section 6 behaves on populations with many sources, where sampled orders may not converge. Whether the two-programme test of section 9 can be run at all on a population that is not itself the programme's own. And the largest: whether the three places theory relocates to are the only three, or whether a programme run long enough finds a fourth — which would be a finding about the method, and the method would record it as a move.

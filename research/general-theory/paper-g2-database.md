# The database as the model

*General theory, paper G2: a data structure for many-source, many-grain, adaptively collected, custody-partitioned measurements of a population.*

**Status: theory research.** General track: this paper is about any population measured by many sources, and it names no particular product or source. `research/README.md` says what a paper is and how the tracks relate. It stands on paper G1, whose design layer produces the data this structure holds.

**Perfect-form test.** If the app did not exist, this would still be worth saying because a database is normally designed to hold what was observed, and data chosen under a budget, at several grains, under several custodies, mean nothing without the record of why each observation was taken, what the unit's state was when it was taken, and which version of which model has read it since; the structure that holds all of that is a different object from a table of responses, and it has not been written down as one.

**Setting.** A population of units, standing in relations, measured across periods by K sources as paper G1 defines them: each with a measurement model, a bias structure, a cost, a custody class and a grain. The observations were chosen by a policy that logged its reasons and its realised probabilities. The system has three readers: the unit's own device, which holds that unit's raw values and computes on them; the population fit, which estimates the joint model; and a research and audit reader, which must be able to reproduce any published number as it stood on any date. Models are revised over time. Some sources' raw values may not leave the unit's device. Nothing in this paper depends on what the units or the sources are.

**Abstract.** A database is usually a schema over what was observed. For data chosen under a budget, at several grains, under several custodies, by a policy that decided what to observe, that is not enough: a response without the reason it was taken cannot be modelled honestly, a response without the unit's state when it was taken cannot be read for change, a statistic without the model version that defined it cannot be reproduced, and a value that may not leave its unit cannot be joined by moving it. This paper argues that the right structure is the joint model itself, held as its sufficient statistics, beside an immutable record from which every statistic can be re-derived and every published number audited. It states the atom of the record, the observation event with its state, its reason and its probability; the three grains and the derived tensor; the model store, including the co-observation ledger and the publication ledger; custody as physical layout, with the join running where the most private column lives, sufficient statistics as the currency across boundaries, first-order aggregation distinguished from pairwise primitives, and input privacy distinguished from output privacy; time held bitemporally, so that a number is reproducible as of any date; folds as deterministic functions whose determinism boundary is recorded; evolution and erasure as transactions; the type a published number must carry; and the three readers with the layouts each needs. It prices what custody costs in statistical efficiency, and it states the open problems, chief among them that sufficiency is relative to a model while custody forbids asking the past a new question.

**1 · What the discovery problem demands of storage**

Paper G1 shows that data chosen under a budget carry their meaning in the choosing. Seven demands follow for whatever holds them, and a schema over responses meets none of them by default.

It must store why. Every observation was taken for a reason, with a probability, and inference on chosen data is honest only conditional on that record. A store that holds what was observed and not why holds a dataset whose selection cannot be modelled.

It must store the state at the time. A response is read for change only against what was true of the unit when it was given, and the unit's slow attributes, recent occasions and estimated position all move. The state must be frozen with the response or it is lost.

It must hold several grains. Units, relations between units, and occasions are three kinds of thing, and an observation on a relation belongs to neither member. A store with one grain forces two of them into the third.

It must respect custody by construction. Some values may not leave the unit that produced them, and a join that moves them is not a join the system may make. The structure must make the join possible without the move.

It must version its statistics against the model that defined them. A sufficient statistic is sufficient for a model, and the model changes.

It must record what it published. Every release of an estimate spends something against a privacy budget and creates a differencing surface against the next release, so the history of publication is part of the data.

And it must reproduce. Any number the system ever published must be recomputable as it stood on the day it was published, from the record, or the system cannot be audited and its claims cannot be checked.

**2 · The atom: the observation event**

*Proposition 1.* The native record is the observation event: one unit or relation, one source, one time, one response, the unit's state as of that time, the reason the observation was taken with its realised probability, and the version of the instrument that took it. Anything smaller loses meaning; anything larger is a fold.

*Argument.* Remove the state and the response can no longer be read for change. Remove the reason and probability and the response can no longer be modelled as chosen. Remove the instrument version and a change in the instrument reads as a change in the unit. Remove the time and the response cannot be placed on any within-unit series. Each field is load-bearing for a class of reading, and the classes are the ones paper G1 says the design exists to support. Conversely, anything assembled from several events, a unit's mean, a coupling, a posterior, is a derived quantity: reproducible from the events and the model version, and therefore a fold rather than a record.

*The ledger.* Events are appended and never edited. A correction is a new event that refers to the old one. A late report, an observation supplied after the period it describes, is an event with two times, the period it describes and the moment it arrived, and both are kept, because the first is what the model reads and the second is what reproduction needs. The ledger is the only thing in the system that is not derived, and it is what everything else is derived from.

**3 · Three grains, and the tensor as a view**

The unit grain holds fixed and slow attributes as versioned facts: a value, the time it became true, the time it stopped. The relation grain holds pairs and groups keyed by their members and a period, with membership itself as events, so that a relation's history is recoverable and an observation on a relation is stored on the relation and not on a member. The occasion grain holds everything that varies per period, which is most of the ledger.

The tensor of units by sources by periods that paper G1 reasons about is a derived view over these three, never a stored object, because it is almost entirely empty and its emptiness is design rather than data. What is stored about the emptiness is the co-observation ledger: for every pair of sources, indexed by the covariates couplings are conditioned on, the count of units observed on both, and the current identification interval of their coupling. The count is a fold over events. The interval is a fold over the model store. Together they are the map paper G1's design acts on, and they are a first-class read model rather than a report someone assembles.

**4 · The model store**

The structure's second half is the model, held as data. It contains, each versioned against the model that produced it: a posterior over each unit's position in the shared latent space and over each unit's within-unit parameters; the measurement parameters of each source, including each item's invariance status across the groups the system compares; the couplings between every pair of sources at each level, with their intervals and the co-observation counts that identify them; the relationship terms of the relation grain; the residuals, kept rather than discarded, because paper G1's self-extension reads them; the two evaluation streams, uniform and adaptive, tagged on every event so that no number computed on one is ever averaged with the other; and the publication ledger, one row per released estimate, carrying its resolution, the noise or coarsening applied, the cohort it was computed on, the date, and the budget it spent.

*Proposition 2.* Holding the model as versioned data is what makes a published number reproducible and what makes the system auditable. A statistic without its model version is a number with no definition; a release without its ledger row is a privacy expenditure nobody recorded.

**5 · Custody as layout**

*Proposition 3.* Custody classes are physically separate stores, the join between them runs where the most private column lives, and what crosses a custody boundary is a sufficient statistic, never a row. Under that rule the deepest crossings are possible and their cost is stated rather than hidden.

*The rule.* A public value may travel anywhere and is fitted centrally. A value that may not leave its unit stays on the unit's device, and the device computes what the joint model needs from it: the unit's posterior contribution, its within-unit summary, and its contribution to each population statistic. The server aggregates contributions and never holds what produced them. The join is not a place. It is an aggregate of per-device contributions, and the layout is distributed by custody rather than centralised and then locked.

*First order and second order.* Composition by summation reaches first-order statistics: means, sums of products within a unit, gradients of a shared model on a unit's own data. It does not reach quantities defined on pairs of units, a relatedness between two units, a component of population structure, a within-pair contrast, because those need a product across two units' data that no sum of per-unit contributions contains. The structure names the pairwise primitive such quantities need, a two-party computation between the two devices or a bounded enclave that holds only the pairwise block, and treats its absence as a hole in the co-observation graph rather than assuming summation reaches it.

*Input privacy and output privacy.* Secure aggregation bounds what the server learns from any one contribution. It says nothing about what the published aggregate reveals, and an aggregate over a changing cohort published twice is a difference that names whoever joined or left. Output privacy is a separate mechanism with its own ledger: a stated noise budget per release over the whole publication history, cohorts frozen per release so that two releases cannot be differenced, and a refusal to release at any resolution from which one unit's contribution is recoverable. The publication ledger of section 4 is where this is enforced, because a budget that is not recorded is not a budget.

*What custody costs.* Sufficiency is relative to a model, so a model revision costs a round-trip to every device, and no question can be asked of the past that the previous model's statistics did not anticipate. Each aggregation round samples the devices that were online, which is a selection by time zone, power and connectivity that enters every estimate. Individual-level diagnostics, outlier inspection and record linkage are unavailable by construction on the custody side. And secure aggregation hides exactly the contributions one would inspect to detect a poisoned or faulty device, so robustness is bought with clipping and robust aggregation, which bias the estimate by a stated amount. The partition is therefore explicit: public columns are fitted centrally and are the diagnostic surface, and the cost above is paid only for the joins that cross into custody.

**6 · Time, held twice**

*Proposition 4.* Every event carries a valid time, the moment it describes and the unit's state as of that moment, and every derived quantity carries a transaction time, the moment each version of it ingested the event. A structure with only the first cannot be audited; with only the second it cannot read change.

*Argument.* Change is read against what was true then, so the state snapshot is frozen with the event and never updated when the unit's attributes later move; a unit that changes country does not have its past responses re-filed under the new one. Reproduction is a statement about what a derived quantity contained on a date, so each derived quantity records when each event entered it, and a late-arriving event enters the derived quantity with a transaction time after its valid time, which is exactly the fact an auditor needs to explain why a number published in one month differs from the same number recomputed in the next. Instrument versions are time-stamped changes to a source's measurement model, so that a vendor's update to a device, a reworded item or a rescaled response format is a boundary the model can see rather than a change in the population.

**7 · Folds, and where their determinism ends**

*Proposition 5.* Every read model is a deterministic function of a prefix of the ledger, a model version and a fold version. Replaying the prefix reproduces the read model; where an incremental fold and a batch fold could disagree, the boundary is recorded as a property of the fold rather than discovered as a discrepancy.

*Argument.* Determinism is what makes audit possible: a sampled replay from the ledger against the stored read model is a test the system can run on itself, and a mismatch is a defect in the fold or a corruption of the store, never an ambiguity. Incremental folds equal batch folds where the fold's operation is associative and commutative over events, which holds for counts, sums and their derived means and does not hold where a fold saturates, caps, or depends on the order of arrival. The structure records, per read model, which case it is in, so that a replay that disagrees on a saturating fold is read as the saturation it is and a replay that disagrees on a count is read as the corruption it is.

**8 · Evolution and erasure as transactions**

*Proposition 6.* A change to the model or the schema is a named, ordered version whose transition commits all or none, while the rewrite of derived data behind it may be eager, lazy or incremental; and the erasure of a unit is a transaction across the ledger, the folds, the model store and the publication ledger, with a stated outcome for each.

*Evolution.* A version that lands half-applied leaves two definitions of every statistic alive at once, and a reader cannot know which one a number carries. So the transition is atomic in its definition even where the rewrite is not, every prior version remains reproducible from the ledger, and a derived quantity carries the version it was computed under until it is recomputed.

*Erasure.* A unit's payloads are kept out of immutable structures wherever possible, so that erasing the unit is ordinary deletion of its events and a recomputation of the folds they entered. Where payloads must live in an immutable structure, erasure is destruction of the key that renders them readable, and the structure records that this is what erasure means there. Fitted estimates that a unit's contribution entered are recomputed where the fold is reproducible, or record that a contribution was withdrawn where it is not; published aggregates are unaffected by design, because they were released at a resolution and under a budget that never depended on any one unit. The publication ledger says which releases the unit's data entered, so the erasure can state what it did and did not undo.

**9 · The type of a published number**

*Proposition 7.* A published quantity is an object, not a scalar. It carries its level, between units or within a unit or on a relation; its population and basis, including the consent and participation model that shaped who is in it; its decomposition where one is known and a statement that none is where none is; the validity and invariance status of the instruments that produced it; its design, including whether it was computed on the adaptive stream with propensities, on the uniform stream, or on both reported separately, and whether its interval is likelihood-based conditional on the log or a coverage claim; and the date as of which it was true. The structure stores numbers in this shape and refuses to release one without it.

*Argument.* Every field names a way a bare number has misled a reader: a between-unit coupling read as a fact about one unit, a population read as everyone when it was the consenting or the persistent, a difference in level read as a difference in the quantity when the instrument was not invariant, an interval read as coverage when it was conditional, a number quoted a year after the cohort that produced it moved. Enforcing the shape as a type is cheaper than correcting each misreading afterwards, and it is the only way the correction reaches every downstream reader at once.

**10 · Three readers, three layouts**

The unit's device holds that unit's raw values for every source, whatever its custody, the unit's own posterior and within-unit summary, and the code to compute its contribution to any population statistic the current model version defines. It is the only place the unit's private raw values ever exist, and it is where the unit reads about itself.

The population fit holds the ledger of public events, the design log, the aggregated contributions from devices, and the model store. It is the diagnostic surface for everything public and a blind aggregator for everything private, and the boundary between the two is the partition of section 5.

The research and audit reader holds a bitemporal export of the public ledger and the model store with every propensity and every type field, and no private raw value at any resolution. From it any published number is reproducible as of any date, any fold can be replayed, and any claim the system makes can be checked by someone who did not build it.

These are three layouts of one record, not three systems. Each is a fold over the ledger and the model store at a resolution and a custody that suit its reader, and no layout is allowed to carry a value the ledger and the model store cannot re-derive.

**11 · Efficiency**

The efficiencies here are the ones that let the structure run at population scale without changing what it can know. Folds are incremental where their determinism allows, so that a new event updates the read models it enters rather than triggering a recomputation of everything. Read models are held at the resolution at which they will be read, aggregates at the resolution of the display or the analysis that consumes them, so that per-read work is bounded by resolution rather than by record count. The design log is small relative to the events it annotates and is never the cost that decides anything. Indexing follows the co-observation graph, so that the question the design asks most often, which units are observed on both of these sources, is the question the store answers fastest. None of these changes what is knowable; the discovery problem decides that. They decide whether the structure can hold it.

**12 · What would have to hold**

Devices compute. A unit's device can hold its raw values, compute a posterior and a contribution, and take part in a pairwise primitive where one is needed.

The ledger is appended by every writer and edited by none, including the system's own corrections, which are events.

The publication ledger is written before a release leaves the system, and a release without a row does not happen.

Model versions are named, transitions are atomic in definition, and every version remains reproducible from the ledger.

The uniform and adaptive streams are tagged at the event and never merged in any fold.

Consent is scoped to a use and recorded as an event with a valid time, so that the population of every statistic can be stated, and revocation is an event that the erasure transaction reads.

**13 · The potential, and what remains open**

Fully realised, this is a structure in which the model of a population is the database, every number it publishes carries what it means and can be rebuilt as of any date, the deepest joins run without any private value leaving the unit that owns it, and the design that chose the data is stored beside the data so that the choosing can be modelled. It is the structure paper G1's design needs and paper G3's mechanisms read from, and it is a different object from a table of responses.

What remains open is research. Sufficiency is relative to a model while custody forbids asking the past a new question, and the trade between storing more general statistics on devices and revising models less often has no general solution. The output-privacy budget is finite while the set of estimates a growing system could publish is not, and how to spend a finite budget across an unbounded publication surface is a design problem with no settled shape. Pairwise primitives at population scale are costly and their cost curve is not known. Erasure of a unit whose contribution entered a fitted estimate is exact only where the fold is reproducible, and how to state honestly what erasure did to an estimate that cannot be recomputed is a definition still owed. And the type of a published number is enforceable inside one system; how it survives the number's journey into prose, a reader's memory and another system's tables is not a database problem, and this paper claims no answer to it.

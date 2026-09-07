# Where the join runs

*Paper 12 of the axiom series: the genome crossings as computations, with the column that must not move, the summaries that may leave it, the rank each release costs, the aggregate that is public on the other side, and the budget an unbounded bank spends — and the join the learned representation cannot make.*

**Status: theory research.** Nothing here describes the app or proposes a change to it; `research/README.md` says what a paper is and how one reaches the product. Papers 1, 3 and 6 supply the genome crossings this paper computes; paper 11 the learned representation that is the largest of them and the one that does not fit; G2 the custody architecture, the sufficient statistic as currency, the publication ledger and the output-privacy budget; paper 7 the attestation without which a device-computed summary is a rumour, and the pairwise primitive kinship needs; paper 0a the policy that must choose which couplings to spend on; G4 the ledger that says which release is worth its cost.

**Perfect-form test.** If the app did not exist, this would still be worth saying because two data about a person can be coupled without ever being in the same place, and the design that keeps one of them from moving decides which couplings are computable at all — not how fast, but whether — so a genome that must stay on its owner's device and a phenotype that is public on the other side is not a privacy footnote to the crossing but its architecture, and the honest account of what such a pair can and cannot learn is a statement about computation under a custody constraint that holds wherever one column may not move.

**Abstract.** The genome is the column that must not move: a file its owner holds, on their device, which no design in this series uploads. Every crossing that needs it — the genetics of measured ability, of the bank's never-asked items, of the body's molecular stream — is therefore a computation in which the genome stays put and only a summary leaves, and this paper is the account of which summaries suffice, what each costs to release, and which crossings the constraint forbids outright. Four facts organize it. A coupling has a sufficient statistic, and where that statistic is a sum over people the device computes its own term and only the term leaves, which is the currency paper 0 already runs on; but a device that computes a summary over its own genome can lie about it, so the summary is trustworthy only under paper 7's attestation, and an unattested device-side statistic is a rumour the aggregate cannot use. The phenotype side is public by construction under this series' answer model, so the crossing is asymmetric in a way that helps: one side is a population aggregate anyone may read and the other never leaves the device, and the join runs on the public side's exact statistics against the private side's attested summaries. Every released coupling spends against an output-privacy budget, and a bank with no ceiling proposes couplings without end, so the budget — not the computation — is the binding resource, and which couplings to spend it on is the allocation paper 0a's policy makes and G4's ledger prices. And the join the learned representation needs is the one this architecture cannot make: a per-person sequence across the genome and every other axis is a row-level join across custody classes, and summation-based secure aggregation reaches first-order statistics and no per-person join, so the teacher of paper 11 cannot ingest a genome that never leaves the device — it can consume a device-computed, attested, budgeted summary, and what that costs the representation is stated rather than wished away. What kinship forces, what a differencing sequence of releases costs, and what an ancestry-structured population does to every budget are the conditions; two experiments decide whether the attested-summary channel carries enough to be worth building.

**1 · The problem, stated structurally**

A crossing in this series is a coupling between two data about a person. Most of the crossings assume the two are in one place: the joint model reads them together, the fit folds them into one cell. The genome breaks that assumption, not because it is sensitive in the abstract, but because the only posture under which it exists in this series at all is one where the file stays on its owner's device and never uploads. So a crossing that needs the genome cannot bring it to the phenotype; it must leave the genome where it is and carry something else across.

That "something else" is the whole design, and its size decides what is knowable. If the only thing that may leave a device is a number that is already a sum over everyone, then the crossings that are computable are exactly those whose sufficient statistic is such a sum, and the crossings that need a per-person join are not computable at all under the constraint — however much data exists, however long the programme runs. This is an identification limit of a different kind from G1's: G1's interval is narrowed by co-observation, and this one is not narrowed by any amount of data, because it is set by where the data may go rather than by how much of it there is.

The paper's subject is that limit. Which couplings survive it, what each surviving release costs, and which crossings — the learned representation's above all — it forbids.

**2 · The two axes alone, and the asymmetry between their custody**

*The genome is a column with a custody class that pins it.* It is the most identifying datum a person holds, it is unchangeable, and it describes relatives who never consented, so the posture that admits it at all is device-only: parsed where it lives, scored against shipped public weights where it lives, and never uploaded in any stage. Its ceiling alone is that it predicts nothing without a phenotype measured on the same people, and it cannot be brought to one.

*The phenotype is public on the other side.* The bank's answers, the keyed score, the occasion reports — under this series' model these are readable by anyone, and their population statistics are exact and publish from the first answer. So the phenotype side of a genome crossing is not a column that must be protected in the join; it is an aggregate already in the open.

*The asymmetry is the architecture.* One side of the crossing is a public population aggregate; the other never moves. That is not a difficulty to be overcome — it is the thing that makes the crossing computable, because the join does not need to protect the phenotype and does not need to move the genome. It needs the public side's exact statistics to meet the private side's summaries where the private side lives, and to let only a summary come back. A crossing between two private columns would be far harder; this series has, on the genome's most important crossings, one public column and one immovable one, which is the easy case wearing a hard case's reputation.

**3 · Four facts about the computation**

*3.1 A coupling has a sufficient statistic, and some of them are sums.* Paper 0 makes the sufficient statistic the currency: a coupling between two sources is estimated from a statistic that is enough for it, and where that statistic is a sum over people — a count, a cross-product, a per-stratum mean — the join runs by each device computing its own term against the public phenotype and contributing only the term. The genome never leaves; the term does; the sum is the coupling. This is exactly G2's composition by summation, and its reach is exactly what a sum can express: first-order and second-order statistics between the device's genome summary and a public phenotype, which is enough for a per-variant or per-score association and for the item-level map paper 3 wants, and not enough for anything defined on individuals jointly.

*3.2 An attested device is the only one whose summary counts.* A device computing a statistic over its own genome can compute the wrong one — inflate a term, replay another person's, fabricate a summary for a genome it does not hold. Under paper 7's attestation the computation is bound to code and to an enrolled holder, so the term the aggregate sums is the term the stated computation produced on an actual file; without it, a device-side sufficient statistic is a rumour, and an aggregate of rumours is a coupling anyone with a scriptable client can move, which paper 3's reviewer's concern about fabricated contributions is exactly. So attestation is not a hardening of this channel; it is its precondition, and a crossing whose devices cannot attest does not have the channel at all.

*3.3 Every release spends, and the bank has no ceiling.* A published coupling — a per-variant result above all — leaks about the people who contributed to it, and G2 budgets that leakage: each release carries a transformation, noise or coarsening with its parameter, and spends against an output-privacy budget composed over the release history. A bank with no ceiling proposes couplings without end — every item against every score, every stratum, every era — so the number of releases the crossing could make is unbounded and the budget is finite. The binding resource is therefore not the computation, which a sum makes cheap, but the budget, which every release depletes and no computation refills. Which couplings to spend it on is an allocation, and it is paper 0a's policy that makes it and G4's value ledger that prices it: a release is worth the information it publishes against the budget it costs, and an unbounded bank without a policy spends its budget on the first couplings anyone asks for rather than the couplings worth asking.

*3.4 The pairwise quantities need their own primitive, and kinship is one.* A sum over people reaches quantities defined on people one at a time. It does not reach a quantity defined on pairs — relatedness between two genomes, the kinship that a within-family design needs, the overlap of two people's contributions — because a pairwise quantity is not a sum of per-person terms, and G2 names this as the hole summation leaves. Paper 7's pairwise primitive is what a crossing that needs relatedness must run instead, at its stated cost and leakage, and a genome crossing that quietly assumes kinship is available over a summation channel has assumed a computation the channel cannot do. Within-family genetics, which papers 1 and 3 both want, lives here and not on the cheap channel.

**4 · What becomes knowable**

*4.1 The per-variant and per-score couplings, on the attested-summary channel.* The genetics of measured ability, of the bank's items, of the body's molecular functionals — each as a sufficient statistic that is a sum of attested per-device terms against the public phenotype, released under the budget. This is the half of papers 1, 3 and 6 that is computable without moving a genome, and it is most of their published couplings, because most of them are per-variant or per-score associations whose statistic is a sum.

*4.2 The item-level map paper 3 wanted, priced per release.* Paper 3's map of which of the bank's unbounded items are genetically structured is a large family of couplings, and this paper says what it costs: each item's release spends, so the map is not free once the channel exists, and the policy of 3.3 chooses which items to publish against the budget rather than publishing all of them. An unbounded bank cannot have its whole map released; it can have the couplings the policy judges worth the spend, with the rest computable and unreleased.

*4.3 What the within-family designs cost.* The kinship that papers 1 and 3 use to read genetics within families is a pairwise quantity, so it runs on the primitive of 3.4 rather than the sum of 3.1, at higher cost and higher leakage, and the paper prices the within-family readings as the expensive channel they are rather than folding them into the cheap one. A programme that budgeted its within-family genetics at the summation channel's price has underpriced it.

*4.4 The join the learned representation cannot make, stated as the finding it is.* Paper 11's teacher trains on a per-person sequence across every axis; a per-person sequence that includes the genome is a row-level join across custody classes, and 3.1 says the summation channel reaches no per-person join. So the teacher cannot ingest a genome that never leaves the device — not slowly, not expensively, but not at all on this channel. What it can ingest is a device-computed, attested, budgeted summary of the genome — a polygenic score, a set of them, a learned per-person embedding of the file computed on the device — which is a per-person value the device may emit under the budget, and the teacher consumes that value as one more axis. What this costs the representation is exact and is stated: the teacher sees a summary chosen in advance, not the genome, so any structure in the genome the summary did not capture is invisible to the teacher, and the summary's sufficiency for the teacher's predictions is itself a measurement — the code length the teacher loses by consuming the summary instead of the file, which cannot be measured without once holding both and is therefore measurable only in a supervised enclave on consenting people, never in the field. The honest statement is that the learned representation crosses the genome through a device-side summary whose adequacy is bounded and measured, and that a genome embedding is a per-person release spending against the budget like any other.

*4.5 The return: what the constraint gives back.* The device-side summary is not only a cost. Because it is computed where the genome lives, it can be richer than any statistic a privacy budget would let leave as raw data — a whole polygenic profile, an embedding — and only its released summary spends, so the constraint that forbids the upload also licenses a device-side computation over the full file that no upload-and-compute architecture could publish. The immovable column, computed on where it sits, is in one respect more usable than a column that moved.

**5 · The return path, and the ranking**

*The genome axis.* Every one of its crossings gains a computation that keeps the file on the device, a cost per release, and a clear line between the couplings the summation channel reaches and the pairwise ones it does not.

*The bank.* Its item-level genetic map gains a price per item and a policy that chooses which to release, rather than an assumption that the whole map publishes.

*The body.* Paper 6's molecular functionals cross the genome on the same attested-summary channel, and the stream's own custody — also device-side — makes the crossing a two-device computation the pairwise primitive governs where it needs both.

*The learned representation.* Paper 11's teacher gains the honest account of how it consumes a genome it cannot see, and the measurement of what the summary costs it.

*Verification.* Paper 7's attestation and pairwise primitive are the load-bearing parts of this paper, and the return is that the verification channel is what makes the whole summation channel trustworthy rather than a rumour mill.

*The design layer.* The budget is the binding resource, so paper 0a's policy allocates releases and G4's ledger prices them, and this paper is where the genome crossings enter that allocation.

*Ranked by what they make knowable.* First, the per-variant and per-score couplings on the attested channel, because they are most of papers 1, 3 and 6 and they are computable without moving anything. Second, the honest account of the learned representation's genome join, because it corrects a crossing the previous paper could not complete. Third, the item-map policy and the within-family pricing, which say what the unbounded bank's genetics costs. The pairwise designs are ranked by their cost, which is high.

**6 · What would have to hold**

*The genome does not move, in any crossing, at any stage.* The device computes; a summary leaves; the file does not. A crossing that cannot be expressed as a computation on the device with a summary output is not computed.

*Every device-side summary is attested.* Bound to code and to an enrolled holder per paper 7, because an unattested summary is a rumour and an aggregate of rumours is a coupling anyone can move; a crossing whose devices cannot attest does not have the channel.

*Every release spends against the budget, and the budget is composed over the whole history.* Per-variant results above all, with each release's transformation and parameter recorded, and the composition — not the single release — is what a coupling is checked against.

*The policy allocates the budget, because the bank is unbounded.* Which couplings to release is paper 0a's decision priced by G4's ledger, and an unbounded bank without a policy spends its budget on the first questions asked rather than the best.

*Pairwise quantities run on the pairwise primitive, priced as such.* Kinship, relatedness and within-family designs do not run on the summation channel, and a crossing that assumes they do has assumed a computation the channel cannot do.

*The learned representation consumes a summary, not the file, and the summary's adequacy is measured.* The teacher's loss from consuming a device-side genome summary instead of the genome is a measurement taken once in a consenting enclave, not assumed, and a genome embedding is a per-person release under the budget.

*Ancestry structures every budget and every coupling.* Published weights travel badly across ancestries, and a summation over an ancestry-structured population confounds the coupling with the structure, so ancestry enters every released coupling as a term and every budget as a stratification, since a per-stratum release spends per stratum.

*Consent is per crossing and at family scope for the genome*, which describes relatives who never consented, and no summary of a minor's file is ever computed.

*The differencing sequence is budgeted.* A coupling re-released as the cohort grows differences against its earlier releases, so the sequence of releases over a growing population is budgeted as a sequence and not as independent draws, which is the release surface an unbounded, ever-growing bank most easily forgets.

**7 · The requirements the design generates**

*An attestation channel on every contributing device*, since the summation channel is a rumour mill without it.

*A summation primitive with its trust assumptions and leakage stated*, and a separate pairwise primitive for kinship, priced apart.

*An output-privacy budget composed over the whole release history*, with per-variant, per-item, per-stratum and per-era releases all spending, and the differencing sequence budgeted as one.

*A release policy* that chooses couplings against the budget, since the bank proposes without end.

*A device-side computation capable of a rich genome summary* — a polygenic profile or an embedding — computed on the full file where it lives.

*A supervised enclave, once, on consenting people*, to measure what the device-side summary costs the learned representation against the file, which cannot be measured in the field.

*Ancestry entered as a term in every coupling and a stratification in every budget.*

*Family-scope consent, and no minor's summary.*

None is a reason to want less. Each is what the genome crossings look like when the genome does not move.

**8 · What would decide it**

*Does the attested-summary channel carry the couplings papers 1, 3 and 6 want, under a usable budget?* A computation of one per-score coupling as a sum of attested per-device terms against a public phenotype, released under a stated budget, with the released coupling's error and the budget it spent both reported. If a single coupling's release spends a large fraction of a reasonable budget, the unbounded map of 4.2 is unaffordable and the policy of 3.3 is the whole game; if it spends little, the map is a matter of allocation. This decides whether the genome crossings are budget-bound or computation-bound.

*How much does the device-side summary cost the learned representation?* In a consenting enclave holding both the genome and its device-side summary, the teacher's code length consuming the summary against the teacher's code length consuming the file, per target. If the gap is small, paper 11's genome axis is a summary and loses little; if it is large, the genome's structure is mostly invisible to a representation that cannot see the file, and that is a limit on paper 11 stated here rather than there.

*And the pairwise question that precedes the within-family designs.* Whether the pairwise primitive's cost and leakage let kinship be computed at the scale papers 1 and 3 need, or whether within-family genetics is affordable only for a small designed subcohort — which decides whether the within-family readings are a population product or a pilot.

**9 · The potential, priced with each release's own condition**

A ten is a dataset after which a field's standard design changes; a five answers questions the field already had. Every score is conditional on the attested channel carrying its couplings under a usable budget.

*The per-variant and per-score genetics without moving a genome.* Seven, conditional on a single coupling's release spending little enough that the map is affordable, because a device-only, attested, budgeted correlation surface between public phenotypes and private genomes is a computation architecture no biobank uses and it is most of papers 1, 3 and 6; three where the budget makes each release dear, since then only a handful of couplings are ever published.

*The honest genome join for the learned representation.* Six, conditional on the enclave measurement, because it converts paper 11's undefined genome axis into a summary with a measured adequacy, and a measured limit is worth more than an assumed capability.

*The within-family genetics on the pairwise primitive.* Four, conditional on the primitive's cost, rising if kinship is affordable at scale and staying a pilot if it is not.

*The differencing-budgeted release policy.* Five as a methods contribution, because a policy that allocates a finite privacy budget across an unbounded, growing family of releases is a problem any custody-constrained programme with a growing corpus has and few solve.

The value concentrates in the first two, and both are decided by the two measurements of section 8.

**10 · Open questions the data would have to answer**

Whether a single per-score coupling's release spends little or much of a reasonable budget, which decides whether the genome crossings are computation-bound or budget-bound and is the question under everything. How much a device-side genome summary costs the learned representation against the file, which sets whether paper 11's genome axis is nearly the file or a shadow of it. Whether the pairwise primitive lets within-family genetics run at population scale or only in a designed subcohort. How much of every released coupling is ancestry structure rather than genetics, and whether per-stratum release leaves any budget for the strata that are small. Whether the differencing sequence of an ever-growing bank can be budgeted without the budget exhausting in a few years of re-releases. Whether an attested device-side computation can be made rich enough to compute a useful embedding at genome scale on consumer hardware. And whether a genome that never moves is, on the balance of these, more usable computed where it sits than a genome that uploaded once and could never be taken back — which is the question the whole posture bets on.

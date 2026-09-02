# The database — current theory

*Regenerated from `graph.json` by each run; the graph is the data, this
page is its readable face. Last regenerated 2026-09-02. Statuses follow
CHARTER §4: conjecture → argued → cited → measured; sources live on the
nodes, with verification grades labeled inline (this container cannot
reach publisher pages — only github.com and a Microsoft Research PDF
store resolved this run — so most citations are corroborated at
search-index/abstract level and say so; four of db-8's were read in
full).*

**This is infrastructure theory, not an axiom** (the owner, 2026-08-26).
The axioms are the measured sources, each existing to create powerful,
useful data and connections or to strengthen another axiom's; this
theory is about where that data lives, joins and serves — the perfect,
most efficient and most useful database for all of it.

As the graph stands, nine claims: eight `cited`, one `argued`, none yet
`measured`.

## The unit of design

- **The join is the unit of design** (db-1, argued). The storage
  layer's success metric is the cost and expressiveness of axis-crossing
  reads — because the app's core function is connecting axes, the
  database's core function is making that connection cheap. The one
  seed claim still without external evidence; db-6 and db-9 now say what
  the join is made of and how it is keyed in time.
- **The join's currency is sufficient statistics with their basis, and
  sufficiency is relative to the join** (db-6, **cited**, restated this
  run with three clauses the evidence forces). Sufficiency is why a
  derived quantity can stand in for rows (Fisher; the factorization
  theorem), and the exchange is built practice — DataSHIELD's
  non-disclosive summary statistics reproduce individual-level GLM
  meta-analysis, GLORE matches centralized logistic regression to
  10⁻¹⁵, OHDSI runs queries locally and returns only aggregates, and
  Lin & Zeng prove no asymptotic efficiency loss under three named
  conditions. Clause one: sufficiency is join-relative — fixed-size
  sufficient statistics exist only inside exponential families, and
  aggregate correlations can invert individual ones (Robinson; Berlin
  et al.), so the cross-axis term is computed *jointly*, never recomposed
  from per-axis marginals: within a person by their own custody, across
  custodians by secure computation (the vertical-partition protocols of
  Sanil and Karr et al.), never by physically pooling two custody
  classes — which keeps db-2 intact. Clause two: the basis travels —
  unaccounted subject overlap inflates type I error (Lin & Sullivan),
  summary GWAS statistics read only against a declared reference, and
  GWAS-SSF pairs every statistics file with mandatory metadata. Clause
  three: derived is not automatically safe — allele frequencies
  re-identify (Homer et al.), gradients invert (Zhu et al.), too many
  accurate aggregates reconstruct the database (Dinur & Nissim; Dwork &
  Roth) — so publication passes disclosure control or secure
  aggregation first. Latent axes travel as plausible values. The shipped
  app joins in clause one's shape (anchors frozen onto each answer at
  write, joint question×anchor cells published rather than recomposed),
  though one anchor dimension at a time; what D98's exact publication
  costs under the reconstruction law is the open question this graph
  does not yet carry.

## The architecture

- **Custody is layout before it is policy** (db-2, **cited**). Custody
  classes live in physically distinct stores with distinct access
  machinery; a policy error cannot read what the layout never
  co-located. Shipped practice in clinical research infrastructure:
  i2b2's separate identity-management cell and honest-broker workflow
  (Murphy et al. 2010/2011), All of Us's separately versioned,
  separately gated tier CDRs, MIMIC-IV's irreversible date shift at the
  export boundary — and the product's own push-token rule: a path with
  no read grant is not one edit from being readable.
- **Two databases and a bridge** (db-3, **cited**). An append-only
  private ledger of events folds deterministically into exactly-shaped
  public read models; the bridge is the single place custody
  transitions happen. The pedigree runs Kreps's state-machine
  replication principle, Young's event store, Helland's immutability,
  Kleppmann's log-centric architecture; the formal spine is incremental
  view maintenance — self-maintainable views exist only under tight
  conditions (so "exactly-shaped" is load-bearing), DBSP proves
  automatic incrementalization with retractions first-class, and
  differential dataflow shows the ideal system must compact, so the
  ledger carries a compaction frontier that should coincide with the
  erasure boundary. Determinism is a designed property: it holds only
  where the fold's algebra is commutative or arrival order is retained
  — the shipped replay (`functions/src/replay.ts`) is exact for rank
  and unsaturated vote folds and yields *a* correct fold, not *the*
  fold, on a saturated dimension; and a projection whose source deltas
  are not retained (the edits matrix) is primary, not rebuildable.
- **Every ledger fact is bitemporal by contract** (db-9, **cited**, new
  this run). A fact carries the valid-time person-state snapshot in
  force when it was recorded — the anchors and the asking context, held
  as a determinate stand-in for an indeterminate reality — and a
  transaction time per published read model it entered, with
  corrections appended rather than snapshots mutated (erasure excepted:
  db-7's payloads are deleted, not corrected). The two-axis split is
  foundational, not this lane's (Snodgrass & Ahn 1985; the 1994
  consensus glossary; SQL:2011), and what is load-bearing is the
  lossiness — a rollback database sees "as of that time", a historical
  one "as of now", and only one carrying both records retroactive
  change, so a snapshot that froze a wrong anchor is repaired by a later
  record, never by mutation (Fowler's payroll case; XTDB; Datomic). The
  as-of join half is prior art and named as such: Kimball's Type 2
  dimension, and the feature stores' point-in-time joins (Feast
  reproduces "what the online store would have served at each event
  time"; Hopsworks). Reproducing a published number pins its inputs to
  a transaction time (Delta Lake time travel). The wrong axis is a
  named error: leakage, immortal time bias, time-varying confounding.
  Three parts are this lane's inference over that base, marked as such
  in the claim: transaction time is *per read model* (no source either
  way); the asking context belongs inside valid time, since answers
  co-vary with wording, order and mode (Tourangeau, Rips & Rasinski);
  and "as published" and "as best known" are two reproduction targets a
  read model must choose between. Limits carried: DBMS support for
  temporal data "is still in its infancy" (Kaufmann et al. 2014); valid
  time is formally indeterminate (Dyreson & Snodgrass). The shipped
  answer doc is the valid-time half (anchors frozen with `answeredAt`,
  an edit moving only `optionIdx` in place), and the loadings doc's
  server timestamp and the graded call's published inputs snapshot are
  per-read-model transaction pins in miniature; but the fact itself is
  uni-temporal, so a pre-edit aggregate is reproducible only inside the
  90-day ledger horizon.
- **Three readers, three materializations — layouts, not systems**
  (db-4, **cited**). No single physical layout is known to serve the
  device (small per-person documents), the population fit (columnar
  matrices) and the research export without a measured
  throughput-and-freshness cost; the industry's converged answer is one
  system over several shapes derived from one log (TiDB's
  Raft-log-derived columnar replica, F1 Lightning's CDC, Oracle's dual
  format, HANA's per-lifecycle formats). "Cannot" weakened honestly to
  a measured frontier (HyPer; the monolithic HTAP class; Milkai et al.'s
  throughput frontier). The export is a different axis: irreversible
  transformation, freezing, versioning and provenance (MIMIC, All of
  Us, FAIR) — not scan shape — and the count of shapes grows (feature
  stores already run row + column + vector). Prior art: OctopusDB's
  storage views over a logical event log (CIDR 2011, vision). Rival:
  BigDAWG-style federation — rejected here because the product's
  honesty contract requires every published number recomputable, which
  federation does not give.
- **Erasure is a transaction across all three parts** (db-7, **cited**).
  Key destruction counts as erasure only conditionally (the EDPB's
  blockchain guidelines accept destruction of a securely managed
  off-chain key where on-chain storage is unavoidable; CNIL: the
  workarounds "do not, strictly speaking, result in an erasure").
  The honest design: personal payloads outside the immutable structure
  (erasure is ordinary deletion), crypto-shredding scoped to backups
  and immutable media under verifiably irreversible key destruction
  (NIST SP 800-88 Rev. 2), each erasure recorded as a permanent
  auditable fact (Datomic's excision), only anonymous folds surviving.
  The failure modes are mechanical: shredding does not reach derived
  read models — the read side is where erasure actually fails — and
  compaction tombstones expire, after which a rebuild reconstructs the
  erased person; so the erasure marker must outlive every consumer's
  rebuild horizon. The shipped app is a fourth technique in miniature:
  person-partitioned sources, a TTL'd identifying ledger, anonymous
  surviving folds, and an honestly recorded residual (D293).
- **Schema evolution is first-class, and all-or-none binds the version
  transition, not the data rewrite** (db-5, **cited**, restated this
  run). Every change is a named, ordered version whose transition
  commits all-or-none and never lands half-applied; the rewrite behind
  it may be eager, lazy or incremental along a measured
  latency-versus-migration-cost frontier; and every prior shape stays
  readable, by reader/writer resolution or by intermediate states,
  until the last consumer has moved off it. Schemas do not stop
  changing (Wikipedia: 170+ versions in 4.5 years, 41.5% of attributes
  removed; Qiu, Li & Su over 160K revisions). F1's online schema change
  is the mechanism — delete-only and write-only intermediate states,
  safe "so long as all servers are no more than one schema version
  behind", a lease keeping at most two versions live (CockroachDB's
  RFC) — a sequence of atomic steps, never one global flip. Old shapes
  stay readable by the reader/writer split (Avro's schema resolution;
  Confluent's compatibility modes make the survival condition
  mechanical; Herrmann et al. push co-existing versions into the
  database itself; Kleppmann: data outlives code), through Ambler &
  Sadalage's transition period of "several quarters, if not years".
  The correction the literature forced: eager rewrite buys latency at a
  price in billed reads and writes, lazy pays on access and accumulates
  chains of pending operations on long-lived entities (Störl, Klettke,
  Hillenbrand et al.) — the longitudinal failure mode a personal store
  must cap. The shipped app's sharper lesson (D65): a read-time default
  is a claim about old data its writer never made, so a default is
  itself a migration and must be versioned like one.

## The read side's honesty conditions

- **The publishable grain is bounded by density and serving policy, not
  storage** (db-8, **cited**, restated this run with an "or" the
  evidence forces). The daily observation budget is conserved —
  population times a small, effort-bounded number of answers per
  person-day — however large the bank grows, so adding questions
  divides a fixed budget: the 2012 Xbox poll ran exactly this shape
  (three to five questions a day, one answer per person per day,
  750,148 interviews from 345,858 respondents — Wang, Rothschild, Goel &
  Gelman, full text); EMA studies average six assessments a day at 79%
  compliance; longer questionnaires degrade data while more prompts
  alone did not (Eisele et al.), so the budget is denominated in items
  and effort. And because a serving policy makes who answers a question
  policy-selected, an aggregate is a population claim only if its read
  model carries its sampling design — selection, not size, governs
  error (Meng's data-defect correlation; Bradley et al.'s 17-point
  vaccine overestimate), replay evaluation is unbiased only under a
  randomized logging policy (Li et al.), counterfactual estimates need
  "the values of all variables needed to evaluate the factors that do
  not cancel in the ratio" recorded per sample (Bottou et al.), and the
  Open Bandit Dataset logs true propensity scores per row. The
  contrary case is now in the claim: poststratification corrected the
  93%-male Xbox sample from respondent covariates alone, so the design
  travels either as recorded propensities or as covariates rich enough
  to render selection ignorable. The shipped app removes only the
  *serving* half of the selection (the Mirror folds core, served to
  everyone unpersonalized, D161) and leaves response self-selection,
  for which its frozen anchors are the poststratification covariates;
  after D316/D317 serving is knowable server-side but the response side
  stays device-local, so tail aggregates publish without a sampling
  design and are not population claims.

## Open

The next rungs, in order of value: db-1 is the last argued seed — the
join-as-unit claim wants the literature on join-centric physical design
(or a demotion, if none exists); db-3's `measured` rung and db-9's
per-read-model pin are the two standing REQUESTS (replay audit; fold
cursor); db-6's clause three names a claim this graph does not yet
carry — the disclosure budget as a schema-level, depletable resource
under the reconstruction law — and the scouts' strongest seeds are that
a published statistic is a (value, basis, estimand) triple whose
composition is a checkable constraint, and that cohort cells served
under different policies are non-composable without their
propensities.

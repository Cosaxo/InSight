# The database — current theory

*Regenerated from `graph.json` by each run; the graph is the data, this
page is its readable face. Last regenerated 2026-08-28. Statuses follow
CHARTER §4: conjecture → argued → cited → measured; sources live on the
nodes, with verification grades labeled inline (this container cannot
reach publisher pages, so most citations are corroborated at
search-index/abstract level and say so).*

**This is infrastructure theory, not an axiom** (the owner, 2026-08-26).
The axioms are the measured sources, each existing to create powerful,
useful data and connections or to strengthen another axiom's; this
theory is about where that data lives, joins and serves — the perfect,
most efficient and most useful database for all of it.

As the graph stands, eight claims: four `cited`, four `argued`, none yet
`measured`.

## The unit of design

- **The join is the unit of design** (db-1, argued). The storage
  layer's success metric is the cost and expressiveness of axis-crossing
  reads — because the app's core function is connecting axes, the
  database's core function is making that connection cheap.
- **The join's currency is sufficient statistics with their basis**
  (db-6, argued). Cross-axis connection composes derived quantities that
  name their n and provenance — not raw rows — which makes the join
  custody-preserving (central's cen-6) and recomputable (pattern's
  pat-2) at once, and statistically honest (tests' tst-7: latent point
  estimates cannot be consumed directly by secondary analysis). The
  join layer is a statistics exchange, not a row store with foreign
  keys.

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
- **Three readers, three materializations — layouts, not systems**
  (db-4, **cited**, restated from the seed's conjecture by this run's
  survey). No single physical layout is known to serve the device
  (small per-person documents), the population fit (columnar matrices)
  and the research export without a measured throughput-and-freshness
  cost; the industry's converged answer is one system over several
  shapes derived from one log (TiDB's Raft-log-derived columnar
  replica, F1 Lightning's CDC, Oracle's dual format, HANA's
  per-lifecycle formats). "Cannot" weakened honestly to a measured
  frontier (HyPer; the monolithic HTAP class; Milkai et al.'s
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

## The read side's honesty conditions

- **The publishable grain is bounded by density and serving policy, not
  storage** (db-8, argued). Observations per day are conserved
  regardless of corpus size, so cell publication is an admission
  decision against the data-generating rate; and the serving policy is
  part of the data-generating process, so every read model must know
  its own sampling design. The product reached both halves
  independently as the core/tail split (SCALE-PLAN §1).
- **Schema evolution is first-class** (db-5, argued). Versioned,
  all-or-none, old shapes readable until the last consumer moves.

## Open

The next rungs, in order of value: db-6 wants the distributed
sufficient-statistics literature (its claim is currently synthesis over
sibling graphs); db-8 wants the survey-sampling / design-based inference
literature for its serving-policy half; db-3's `measured` rung is the
standing replay-audit request in REQUESTS.md; and db-5 remains the
weakest argued node — the schema-evolution literature (versioning,
compatibility windows, lakehouse time travel) has not been scouted.

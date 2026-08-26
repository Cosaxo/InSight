# The graph-optimizer axiom — current theory

*Regenerated from `graph.json`, 2026-08-26. The graph is the data; this
page is its readable face. 9 nodes: 6 argued, 3 cited.*

## The substrate (go-1 · go-9)

**go-1 (cited)** — the claims-graph-with-evidence-ladder design is not
this program's invention: typed deliberation nodes go back to IBIS
(Kunz & Rittel 1970) and gIBIS (Conklin & Begeman 1988); contradictions
as first-class, computable structure to Dung 1995 and SWAN 2008; the
closest built precedent is micropublications (Clark, Ciccarese & Goble
2014 — claims, supports/challenges edges, and structural queries for
assertions with no support); the status ladder's precedent is GRADE
(Guyatt et al. 2008), whose real lesson is that a ladder is worthless
without **named criteria for movement**. One imported consequence from
Dung: a node under an unresolved `contradicts` edge is *challenged*
whatever its stamped rung says. The claim is deliberately narrow: the
structure is precedented; the benefit is a bet this program measures
on itself.

**go-9 (cited, refines go-1)** — the counter-evidence that forced that
narrowing: the argumentation literature that design rationale imported
its usefulness claims from had, by 1994, failed to substantiate them
(Buckingham Shum & Hammond — a mixed source, cited as one: it also
reports emerging indications of usefulness), and of Shipman &
Marshall's four formalization costs, two — premature structure,
situational structure — survive a machine author (that split is this
lane's own inference, marked as such). The edge landed as `refines`,
not `contradicts`, because go-1 conceded the point in the same run —
go-6 has the typing rule. Resolution is empirical: months of status
motion without padding substantiates the bet; stagnation-by-rewording
means the critique won.

## Health is measured (go-2 · go-5)

**go-2 (cited)** — accumulating knowledge bases decay measurably, and
the four health signals map one-for-one onto the peer-reviewed
linked-data quality vocabulary (staleness→timeliness, duplicates→
conciseness, contradictions→consistency, orphans→interlinking; Zaveri
et al. 2016). Decay numbers, cross-domain: 58.4% of obsolete Stack
Overflow answers were likely born obsolete and only 20.5% ever updated
(Zhang et al. 2021); one in five STM articles (1997–2012) suffers
reference rot and three of four web references drift (Klein et al.
2014; Jones et al. 2016). Pruning has documented second-order costs
(Halfaker et al. 2013) — hence every metric is descriptive, every
prune a judged act with a log row, never a gate. Transferring all this
to machine-written theory graphs is the program's own, still-unmeasured
bet — the claim says so.

**go-5 (argued)** — health is a committed instrument, `graph/health.mjs`:
status mix, stale conjectures (>14d), orphans (program-wide degree
zero), detail weight (>400w) per lane; unresolved contradictions and
near-duplicate claim pairs (Jaccard ≥ 0.5) program-wide. Thresholds are
named constants (a change is a diff, not drift); orphan degree is
program-wide because cross-edges are the combination (go-3); staleness
is a timestamp proxy and therefore a lower bound on rot.

## What the first measurement taught (go-6 · go-7 · go-8)

**go-6 (argued)** — the contradiction count measures *recording*, not
harmony. Three adversarial passes forced real corrections this week and
none became an edge; the one live cross-lane tension (pat-6's negative
results against gen-5's conjecture) was typed `refines`, the mildest
type. The count is a lower bound. The typing rule this lane now runs:
when evidence cuts against a claim another node **still asserts**, type
it `contradicts` and let the target lane resolve it; when the target
has already narrowed in response, `refines` is the honest type —
go-9→go-1 is the worked example of the second case.

**go-7 (argued)** — detail has a weight budget. Six of 43 pre-existing
nodes exceed 400 words, all born `cited` from scout runs — and three of
the six hand-label own-inference sub-claims inline (map-3, map-4,
gen-4; exact strings verified), which is an argued-rung claim living
inside a cited node: the lanes doing manually what node granularity
would do structurally. The fix is fission into nodes the ladder can
grip separately; splitting is the owning lane's act, the optimizer
flags weight and records the pattern.

**go-8 (argued)** — genetic, map and pattern independently invented
per-source verification grading, in three different vocabularies
("abstract-grade"/"vendor-grade"; "snippet/repo-table/index-grade";
per-node "Verification grade:" sentences). That is schema pressure
toward a v2 per-source `grade` field — absorbed only once the
convention stops moving (rule: after body/questions/tests have each
run a scout), because migration is all-graphs-or-nothing (§5) and a
premature enum forces a v3.

## Standing frame (go-3 · go-4)

Cross-graph ids and edges are load-bearing (go-3); self-optimization is
legitimate exactly when versioned, total and reversible, and never
touches another lane's content (go-4).

---

## Health summary — 2026-08-26 (for the digest)

*Measured post-rebase, after central's first run and the owner's
chartering of the database lane landed mid-run.*

`node graph/check.mjs --all`: **green**, schema v1, all 9 graphs.
`node graph/health.mjs`: 54 nodes, 84 edges (34 cross-graph).

| Lane | Nodes | Status mix (c/a/c/m) | Flags |
| --- | --- | --- | --- |
| genetic | 8 | 1/4/3/0 | gen-4 detail 476w |
| body | 5 | 2/3/0/0 | unscouted |
| questions | 4 | 2/2/0/0 | unscouted |
| tests | 5 | 3/2/0/0 | unscouted |
| map | 5 | 1/1/3/0 | map-3 559w, map-4 688w |
| pattern | 7 | 0/4/3/0 | pat-1/6/7 ≈415w |
| graph-optimizer | 9 | 0/6/3/0 | — |
| central | 6 | 1/5/0/0 | cen-1 484w, cen-2 511w |
| database | 5 | 1/4/0/0 | chartered today; unscouted |

Program reading: **11 conjecture · 31 argued · 12 cited · 0 measured**.
No orphans, no dangling cross-edges, no near-duplicate pairs at
threshold, no stale conjectures yet (program is 1 day old). The zero in
"measured" is the milestone to watch — map's displacement request and
pattern's prequential request both got worth-building verdicts today
and are each one product decision away from a first `measured` node.
The contradiction count (0) is a lower bound, not concord: this week's
adversarial passes forced real corrections that resolved into prose,
and the one live cross-lane tension (pat-6 vs gen-5) is typed
`refines` (go-6). Eight nodes now exceed the detail budget — six
scout-born plus central's cen-1/cen-2, which crossed it in an
argument-only run, so the pathology is not scout-specific — fission
offered (go-7). No merges or prunes were warranted this run: no
literal duplicates exist and every node has degree ≥ 1 program-wide.
Tooling note: health.mjs originally hardcoded the eight chartered
lanes and was blind to the database lane the hour it was born; it now
discovers lanes from `theory/` so a new lane is counted the run it
lands, while check.mjs remains the arbiter of what is chartered.

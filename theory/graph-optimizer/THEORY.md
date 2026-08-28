# The graph-optimizer axiom — current theory

*Regenerated from `graph.json`, 2026-08-28. The graph is the data; this
page is its readable face. 10 nodes: 7 argued, 3 cited.*

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
is a timestamp proxy and therefore a lower bound on rot. 2026-08-28:
the instrument gains a per-lane **graded-sources count** — verification
markers in source strings only, the one placement countable without
interpreting prose (the suffix is homonymous in prose; go-10). It
prices what a schema-defined grade field would inherit; it does not
push adoption.

## What the measurements taught (go-6 · go-7 · go-8 · go-10)

**go-6 (argued)** — the contradiction count measures *recording*, not
harmony, and is a lower bound on live tension. Since 2026-08-27 the
program has its first `contradicts` edge — tst-6→cen-1, recorded in
exactly the split-verdict shape this node offered: `contradicts` scoped
to the singular cen-1 still asserts, `refines` for the half tst-6
sharpens, the tests LOG naming both. Central inherits a visible work
item. The typing rule stands: evidence against a claim the target
**still asserts** is `contradicts`; after the target narrows, `refines`
is the honest type (go-9→go-1 is the worked example of the rule's
second branch).

**go-7 (argued)** — detail has a weight budget; fission into nodes the
ladder can grip separately is the fix, and splitting is the owning
lane's act. Second measurement (2026-08-28): 23 of 69 nodes over
budget — 33%, from 14% two days earlier; max more than doubled (map-6
at 1531 words); argument-only nodes cross it too, so it is not
scout-specific; **zero fissions have occurred**. The flag as published
changes no behavior — either no lane reads it where it lives, or
go-10's lesson generalizes: practice no artifact enforces does not
propagate. Not a gate, deliberately. This run's lever is naming the
worst offenders in the digest-facing summary below.

**go-8 (argued)** — three lanes independently invented per-source
verification grading, which is real schema pressure; but its original
decision rule — absorb once the convention stops moving — fired on
2026-08-28 and was answered **no**: the convention was never going to
settle on its own (go-10 carries the measurement and the decision).
What survives: the want is real, and unstructured grade strings
accumulate migration debt.

**go-10 (argued, new 2026-08-28)** — across fresh-session lanes, **a
convention lives only where a committed artifact enforces it**.
Measured: 18 distinct `-grade` tokens program-wide (16 excluding this
lane's own meta-prose), from 11 by the same census two days earlier;
the suffix went homonymous (verification labels vs domain adjectives
sharing it); placement split four ways (two source-string syntaxes
plus genetic's third, detail prose, free-form sentences) — genetic, a
co-inventor, at 5/98 barely uses its own convention — and zero of the
three newly scouted lanes adopted any. Propagation follows the
*receiving* lane's read path and nothing else: 'instrument-grade'
crossed lanes because central appended it to tests' QUESTIONS.md, a
file tests is chartered to read, while genetic's graded source
strings, readable by everyone, propagated nowhere. And read-path
carriage moves tokens, not conventions — tests absorbed the
homonymous adjective, not the grading practice — so only an enforced
artifact keeps a convention convergent: the one practice exercised
across lanes (electing `contradicts`) is the one SCHEMA.md documents.
Consequences: no v2 grade enum now; if grades are ever schematized,
the schema defines an enumerated vocabulary, lanes populate their own
sources, and the field lands optional-and-empty — the
migrate-all-in-one-run rule bounds mechanical migration to what a
script derives without reading, a general constraint on schema
evolution. Optionality enforces vocabulary, not adoption.

## Standing frame (go-3 · go-4)

Cross-graph ids and edges are load-bearing (go-3); self-optimization is
legitimate exactly when versioned, total and reversible, and never
touches another lane's content (go-4).

---

## Health summary — 2026-08-28 (for the digest)

`node graph/check.mjs --all`: **green**, schema v1, all 9 graphs.
`node graph/health.mjs`: 70 nodes, 137 edges (59 cross-graph).

| Lane | Nodes | Status mix (c/a/c/m) | Graded src | Flags |
| --- | --- | --- | --- | --- |
| genetic | 11 | 0/3/8/0 | 5/98 | 6 nodes over detail budget, gen-5 970w |
| body | 8 | 0/4/4/0 | 0/16 | — |
| questions | 6 | 0/3/3/0 | 0/26 | que-5 623w, que-2 474w |
| tests | 7 | 3/2/2/0 | 0/12 | tst-6 644w, tst-2 501w |
| map | 6 | 1/1/4/0 | 1/49 | **map-6 1531w** (3.8× budget), map-3 753w, map-4 688w |
| pattern | 8 | 0/3/5/0 | 0/43 | pat-3 899w, pat-8 505w, pat-6 549w +2 |
| graph-optimizer | 10 | 0/7/3/0 | 19/19 | — |
| central | 6 | 1/5/0/0 | 0/0 | cen-1 484w, cen-2 511w; no sources yet in any node |
| database | 8 | 0/4/4/0 | 20/45 | db-7 573w, db-3 495w, db-4 437w |

Program reading: **5 conjecture · 32 argued · 33 cited · 0 measured**.
Cited overtook argued this week; the zero in `measured` remains the
milestone to watch. No orphans, no dangling cross-edges, no
near-duplicate pairs at threshold, no stale conjectures. **The
program's first `contradicts` edge is live**: tst-6⇄cen-1 (tests,
2026-08-27) — a real, correctly scoped open problem now sitting in
central's path; how central resolves it is the first test of the
schema's contradiction machinery end to end. **Detail bloat is the
worsening signal**: 23 of 69 nodes over the 400-word budget (33%, from
14% on 08-26), zero fissions so far; worst offenders named per lane
above, fission offered per go-7 (per this run's LOG row, this lane
trimmed its own freshly over-budget nodes back under rather than ship
flags it preaches against). Cross-graph structural changes this run:
**none warranted** — no literal duplicates, no dangling edges, nothing
to prune. Schema verdict this run: **no v2** — go-8's grade-enum
decision rule fired and answered no (go-10 has the measurement:
18-token vocabulary, 11 two days earlier by the same census,
homonymous suffix, four-way placement split, zero adoption by the
newly scouted lanes).

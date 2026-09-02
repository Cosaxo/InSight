# The graph-optimizer axiom — current theory

*Regenerated from `graph.json`, 2026-09-02. The graph is the data; this
page is its readable face. 12 nodes: 9 argued, 3 cited.*

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
go-6 has the typing rule. Re-read 09-02 against go-8's restatement:
the support stands and sharpens — incremental formalization is the
argument for an *optional* grade field over an imposed enum.
Resolution is empirical: months of status motion without padding
substantiates the bet; stagnation-by-rewording means the critique won.

## Health is measured (go-2 · go-5 · go-11 · go-12)

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
near-duplicate claim pairs (Jaccard ≥ 0.5) program-wide; per-lane
graded-sources counts (source-string markers only; go-10); per-lane
run recency (last LOG.md row age, silence past 2 days; go-11); and,
since 09-02, **edge currency** — each node's last claim-change date
recovered from git, every edge older than its target's claim listed
under its owner — with prose rung-label drift, same-type mutual pairs
and per-lane inbound cross-edges beside it (go-12). Thresholds are
named constants (a change is a diff, not drift); orphan degree is
program-wide because cross-edges are the combination (go-3); staleness
is a timestamp proxy and therefore a lower bound on rot. The git
addition ends the tool's no-git posture, not its no-package one: the
checker already shells to git, the branch's only history *is* git,
and the tool says when it has none rather than guessing.

**go-11 (argued, refines go-5)** — run cadence is a health dimension no
content metric can see: every prior signal is a function of what the
graphs *say*, so a program that stops running reads as maximally
healthy. Measured 09-01: zero landings program-wide from 08-29 — both
date-groups missed a cycle, the weekly digest was unwritten — under a
green checker and a clean health report, with the account side unable
to say why (dispatcher-bound Routines record no run outcomes by
contract). Remedy: `health.mjs` reports each lane's last `LOG.md` row
age and flags silence past `SILENT_DAYS=2`; descriptive, never gating;
re-pacing stays the owner's dial. **Resolved 09-02**: the cause reached
the tree through central's 09-01 digest notes and LOG row — a
dispatcher backlog, drained ~12:53 UTC ("14 → 10 dispatched") with
every Routine healthy — a failure between schedule and run that only
the branch's timestamps could see. The drain shows in landing times
(four odd-date lanes in ten minutes on 09-01; the even group on
schedule so far 09-02, central's 12:02 slot still ahead). Silent lanes at this run: none. Consumers: the 09-01
digest reported the gap independently (its own health run plus the
account side — it read this lane's 08-28 summary, one landing before
the metric existed), and the review rubric's zero anchor cites this
node.

**go-12 (argued, new 2026-09-02, refines go-3)** — **edge resolution is
necessary, not sufficient.** An edge warrants against its target's
claim *as it read when the edge was made*; the checker proves the
target exists, not that the claim still says what the edge attached
to. Measured over 321 edges: 25 (8%; 19 cross-graph) are older than
their target's last claim change — six of them pointing at cen-1,
rewritten twice, five still warranted against its pre-fork singular
form; central's own nine flagged out-edges reach eight targets in
five graphs (its own cen-1 among them), because the lane with the
most cross-edges ages fastest. Two cheaper cousins of the same drift:
3 of 27 prose rung labels no longer match (cen-1 and cen-7 label map-6
*cited* — it demoted itself 09-01; map-6 labels db-6 *argued* — it
rose 09-02), and one same-type mutual pair, cen-1⇄tst-1 `supports`, a
support cycle (of the other 26, 23 are the depends/supports fission
shape and three mix `refines`). **The lanes saw all three first, and
their channel failed**: since 08-27 at least six LOG-row flags across
four lanes named these shapes for their owners; of the three whose
recipient has run since — genetic's pat-1→gen-5 (pattern ran 08-28,
09-01, 09-02; pat-1 still dated 08-26), map's and pattern's 09-01
flags to central (central ran 09-01; labels unchanged) — none was
acted on, and this lane itself landed twice past pattern's 08-28 flag
addressed to it by name. A LOG row is on no lane's read path but
central's digest read (go-10) — a passive channel. Remedy: the
instrument now measures all three and lists each finding under its
*owner* lane in the summary central reads, and `SCHEMA.md` states that
re-warranting an edge against a rewritten target is a real change to
the node — `updated` moves on a confirming re-read whose detail
records what survived, which is what clears a flag (this lane's three
cleared that way this run, all standing). Limits named: candidates to
read, not defects; trusts `updated`; needs git history and says so
without it; blind to a detail that moved under an unchanged claim; and
the 27 labels are the regex's population, not the prose's — possessive
forms go uncounted, and this node's own labels sit outside the regex
rather than disambiguated.

## What the measurements taught (go-6 · go-7 · go-8 · go-10)

**go-6 (argued)** — the contradiction count measures *recording*, not
harmony, and is a lower bound on live tension. The typing rule:
evidence against a claim the target **still asserts** is `contradicts`;
after the target narrows, `refines` is the honest type. The machinery
was exercised end-to-end with no optimizer involvement (tst-6→cen-1,
elected 08-27, resolved by revision 08-28, retired by the electing lane
08-29), so a reading of 0 is ambiguous between *never-elected* and
*elected-and-resolved*, and this summary narrates resolutions rather
than reading 0 as concord. Two further readings 09-02: pattern's LOG
row writes "pat-4 now contradicts cen-2 at the boundary" — the word,
in prose, no edge elected, so the count reads 0 while a lane has
written it down; and the review rubric now scores an opened
contradiction under Innovative and its resolution under Effective —
the first incentive pointing against under-recording; whether it
produces elected edges or performed ones is the next measurement.

**go-7 (argued)** — detail has a weight budget; fission into nodes the
ladder can grip separately is the fix, and splitting is the owning
lane's act. The series: 14% over budget (08-26) → 33% (08-28, zero
fissions, the flag changing no behaviour) → 35% (09-01, five parents
fissioned within days of central routing the measurement by name — the
lever worked — yet every fission left a parent or child over the line:
fission conserves words) → **40% (09-02, 48 of 120)**. The three lanes
seeded 09-01 are all under budget (maxima 200–241w) — nodes are born
light and grow heavy — while established lanes' scouts keep landing the
heaviest nodes the program has (tst-1 1271w, que-3 1195w, gen-14 882w,
bod-13 856w). Database's row records three nodes landing at 410–416w
"after four trims … recorded rather than sharded" — the first lane to
state the budget as a trade consciously taken. This lane's own answer
is not better: four of its twelve nodes now sit at exactly 400 words,
the threshold tuned to rather than met. Verdict, sharpened: the
budget binds at write time or not at all; the two channels that have
enforced it are the in-lane adversarial pass (tst-5) and a lane's own
trimming loop (database) — both authoring-time, neither the flag.

**go-8 (argued)** — three lanes independently invented per-source
verification grading, which is real schema pressure; but its original
decision rule — absorb once the convention stops moving — fired on
2026-08-28 and was answered **no**: the convention was never going to
settle on its own (go-10 carries the measurement and the decision).
What survives: the want is real, and unstructured grade strings
accumulate migration debt.

**go-10 (argued)** — across fresh-session lanes, **unschematized
conventions do not converge on their own** — they proliferate and
drift into homonymy; convergence happens only through an active
channel, and propagation follows the *receiving* lane's read path. The
08-28 census (18 `-grade` tokens, four-way placement split, zero
adoption by newly scouted lanes) and eight 09-01 observations (central's
QUESTIONS relay 5-for-5; tests' in-lane re-derivation) established it.
Three more 09-02: **negative** — five LOG-row flags across four lanes
produced zero uptake, because a LOG row is on nobody's read path but
central's; **null** — the two subject lanes seeded 09-01 carry no sources at
all, so seeding is not evidence either way;
**positive, and the first time this lane's theory shaped the charter**
— §12's feedback loop is built as an active channel (a file in the
lane's own directory, read in Orient by contract, answered in LOG by
contract, re-scored next review), and rev-4 cites this node as the
mechanism it rests on. The working channels: enforced artifacts,
central's QUESTIONS relay, the review's FEEDBACK loop, and in-lane
adversarial re-derivation; passive availability moves nothing.
Standing verdicts: no v2 grade enum; any future grade field is
schema-defined, lane-populated, optional-and-empty at migration.

## Standing frame (go-3 · go-4)

Cross-graph ids and edges are load-bearing (go-3) — and since go-12,
resolution is their floor, currency their measure; self-optimization
is legitimate exactly when versioned, total and reversible, and never
touches another lane's content (go-4). Both re-read 09-02 against their
rewritten targets; both stand.

---

## Health summary — 2026-09-02 (for the digest)

`node graph/check.mjs --all`: **green**, schema v1, all 12 graphs.
`node graph/health.mjs`: 120 nodes, 324 edges (138 cross-graph);
**7 conjecture · 54 argued · 59 cited · 0 measured**. Silent lanes:
**none** — the 08-30/08-31 gap is resolved (a dispatcher backlog,
drained 09-01 ~12:53 UTC per central's digest notes; every lane has landed
since, the even group on schedule so far 09-02). Three lanes joined
09-01 (review, ties, interests): all three graphs validate, all
under budget, none yet consumed by an inbound cross-edge.

**The headline is edge currency.** The checker has never found a
dangling edge, and it never will find this: **22 of 324 edges predate
their target's last claim change** (18 cross-graph), listed per owner
in the table. Five point at cen-1 (rewritten twice; a sixth, this
lane's own go-3, cleared this run); nine are central's own out-edges
to eight targets rewritten since 08-28, its own cen-1 among them.
Three prose
rung labels have drifted (cen-1, cen-7 on map-6; map-6 on db-6) and
one mutual pair is the same type both ways (cen-1⇄tst-1 `supports`).
Four lanes had already flagged these shapes in LOG rows over six days;
of the three flags whose recipient has run since, none was acted on
— a LOG row reaches nobody, this lane included (go-10, go-12). **What
clears a flag**: re-read the edge against the target's current claim
and move `updated` whether or not the edge changes (SCHEMA.md,
clarified 09-02). This lane's own three cleared that way this run.

| Lane | Nodes | Mix (c/a/c/m) | In-cross (edges→nodes) | Graded src | Last run | Flags |
| --- | --- | --- | --- | --- | --- | --- |
| genetic | 15 | 0/3/12/0 | 24→10 | 22/137 | 09-01 | 9 over budget (gen-14 882w, gen-15 808w, gen-10 739w); stale edges gen-3/gen-9/gen-11→cen-1 |
| body | 13 | 0/4/9/0 | 15→7 | 0/71 | 09-01 | 3 over budget (bod-13 856w, bod-12 734w); stale edges bod-6→bod-5, bod-6→cen-2 |
| questions | 8 | 0/3/5/0 | 13→4 | 0/52 | 09-01 | 6 over budget (que-3 1195w, que-8 976w); stale edges que-5/que-8→pat-4 |
| tests | 9 | 1/4/4/0 | 11→4 | 0/27 | 09-01 | 5 over budget (tst-1 1271w — the program's heaviest, landed 09-01); stale edge tst-7→bod-5 |
| ties | 7 | 2/5/0/0 | 0→0 | 0/0 | 09-01 | seed; two conjectures with empty detail |
| interests | 6 | 2/4/0/0 | 0→0 | 0/0 | 09-01 | seed; two conjectures with empty detail |
| database | 9 | 0/1/8/0 | 7→4 | 98/127 | 09-02 | 6 over budget (db-7 573w; db-6/8/9 at 410–416w, recorded as a conscious trade); stale edge db-1→cen-1 |
| map | 14 | 0/6/8/0 | 3→2 | 1/63 | 09-02 | 9 over budget (map-3 753w, map-6 705w); stale edges map-3→map-1, map-6→map-10, map-6→db-6; rung label map-6:db-6 |
| pattern | 12 | 0/2/10/0 | 32→8 | 25/69 | 09-02 | 5 over budget (pat-6 549w, pat-3 528w); stale edge pat-1→gen-5 (flagged by genetic 08-27, three pattern runs since) |
| graph-optimizer | 12 | 0/9/3/0 | 5→4 | 19/19 | 09-02 | — |
| central | 9 | 0/9/0/0 | 28→8 | 0/0 | 09-01 | 5 over budget (cen-9 647w, cen-8 504w); 9 stale out-edges (cen-2→pat-4/bod-5/map-6, cen-4→cen-1, cen-6→map-5, cen-7→map-6/bod-8/db-6/db-8); rung labels cen-1:map-6, cen-7:map-6; mutual same-type cen-1⇄tst-1 supports; still no sources in any node |
| review | 6 | 2/4/0/0 | 0→0 | 0/0 | 09-01 | seed; first review due 09-03 02:02 UTC; two conjectures with empty detail |

Program reading. No orphans, no dangling cross-edges, no near-duplicate
pairs at threshold, no stale conjectures (cen-3 and map-1 both moved
09-01/09-02, so nothing reaches the 14-day line before 09-15). The
contradiction count reads 0 and now means *resolved* for tst-6→cen-1
and *unrecorded* for pattern's prose "pat-4 now contradicts cen-2"
(go-6). Detail weight: **48 of 120 over budget (40%)**, up from 35%;
the new lanes are all under, the heaviest nodes are new scout landings
(go-7). Cross-graph structural changes this run: **none warranted** —
no literal duplicates, no dangling edges, nothing to prune. Schema
verdict: **v1 stands** — the chartering session's 09-01 prefix
additions (`rev`, `tie`, `int`) were additive and landed with the
checker in sync; this run's `updated` clarification changes no format
and no checker rule.

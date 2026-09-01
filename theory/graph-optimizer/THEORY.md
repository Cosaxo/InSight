# The graph-optimizer axiom — current theory

*Regenerated from `graph.json`, 2026-09-01. The graph is the data; this
page is its readable face. 11 nodes: 8 argued, 3 cited.*

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

## Health is measured (go-2 · go-5 · go-11)

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
graded-sources counts (verification markers in source strings only —
the one placement countable without interpreting prose; go-10); and,
since 09-01, per-lane run recency (last LOG.md row date and age,
silence flagged past 2 days; go-11). Thresholds are named constants (a change is a diff, not drift); orphan
degree is program-wide because cross-edges are the combination (go-3);
staleness is a timestamp proxy and therefore a lower bound on rot.

**go-11 (argued, new 2026-09-01, refines go-5)** — run cadence is a
health dimension no content metric can see: every prior signal is a
function of what the graphs *say*, so a program that stops running
reads as maximally healthy. Measured this run: zero landings
program-wide from 08-29 until this run — the even-date group missed
08-30 outright, the odd-date group 08-31 — and its 09-01 slots had
also passed landing nothing by this run's write — the weekly digest
due 08-30 is unwritten, and this run itself fired off its own
even-date schedule (recovery or manual dispatch; the tree cannot say).
The account side cannot see it either: all nine Routines read enabled
with no run-outcome record — dispatcher-bound Routines record none by
the platform's own contract, so those absences are uninformative by
construction. The gap sat under a green checker and a clean
health report until this run compared dates by hand — go-6's blindness
generalized (silence is the recording rate itself at zero). Remedy in
the same run: `health.mjs` now reports each lane's last `LOG.md` row
date and age and flags silence past `SILENT_DAYS=2` (LOG is
append-only, one row per run, and a nothing-advanced run still logs —
where `graph.updated` moves only on content). Descriptive, never
gating; re-pacing stays the owner's dial (§11). Named limit: the flag's
availability itself depends on some lane running — a measurement that
vanishes with the program it measures. Recovery began mid-run: map and
pattern landed off-schedule catch-ups at 13:11 (during this run's land
step), the odd group's own 09-01 slots still unfilled; six of nine
lanes flag silent at this run's close.

## What the measurements taught (go-6 · go-7 · go-8 · go-10)

**go-6 (argued)** — the contradiction count measures *recording*, not
harmony, and is a lower bound on live tension. The typing rule:
evidence against a claim the target **still asserts** is `contradicts`;
after the target narrows, `refines` is the honest type (go-9→go-1 is
the worked example of the second branch). **The machinery is now
exercised end-to-end, with no optimizer involvement**: tests elected
the program's first `contradicts` edge 08-27 in exactly the offered
split-verdict shape (tst-6→cen-1); central's next run revised cen-1 to
the hierarchical fork, naming the edge as what it resolved; tests then
retired the `contradicts` 08-29 with full accounting (refines kept,
supports added as a third option, residual tension re-homed at
tst-5/tst-8). Two days, election to resolution. New count semantics: a
reading of 0 is now ambiguous between *never-elected* and
*elected-and-resolved* — the point-in-time instrument cannot
distinguish them, so this summary narrates resolutions rather than
reading 0 as concord.

**go-7 (argued)** — detail has a weight budget; fission into nodes the
ladder can grip separately is the fix, and splitting is the owning
lane's act. Third measurement (2026-09-01): **fission adoption began**
— three parents split within two days of central routing the 08-28
measurement by name (cen-2→cen-8, central's own read of this graph;
gen-5→gen-12/13 per central's QUESTIONS append; tst-5→tst-8 forced by
tests' own adversarial pass) — the lever this node chose worked
wherever it was received. Yet the rate **rose**: 29 of the 80 nodes
standing at this run's measurement over budget (36%, from 33% —
itself from 14%, or 11% on the like-for-like nine-graph baseline),
because scout runs keep landing heavy nodes and fission children
themselves cross the budget (gen-12 710w; tst-5 still 789w after
fission). Mid-land, the last two flagged offenders confirmed the
verdict: map's and pattern's 09-01 catch-up runs fissioned exactly the
nodes central named — map-6 1531→705w with an honest cited→argued
demotion, pat-3 899→528w — and both parents plus two new children
(map-7 431w, map-8 575w) remain over budget, leaving the post-fission
rate at 31 of 88 (35%): fission barely moves it, because fission
conserves words. Verdict: fission restores statuses the ladder can
grip but does not by itself pay the budget — the budget binds at write
time or not at all; the in-lane adversarial pass is so far the only
channel that has independently enforced it.

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
channel, and propagation follows the *receiving* lane's read path and
nothing else. The 08-28 census: 18 distinct `-grade` tokens,
homonymous suffix, four-way placement split, zero adoption by newly
scouted lanes (one census example has since rotted in place: central
deleted its 'instrument-grade standard' in cen-1's 08-28 revision;
tests' 'instrument-grade model' still stands, re-verified 09-01).
Confirmed 2026-09-01 across eight further observations, every one
obeying a read path: central absorbed go-7 directly (it is chartered
to read all graphs) and fissioned cen-2 the same run; its QUESTIONS
appends carried fission to genetic, a pricing ask to questions and the
go-6-shaped retype ask to tests — all three adopted the receiving
lane's next run; the same appends to map and pattern moved nothing for
four days simply because those lanes did not run, then both adopted in
their 09-01 catch-up runs — the relay is 5-for-5, and a read path
propagates exactly when the reader runs; and tests' fission arrived
through no cross-lane carriage at all — its own adversarial pass
re-derived the discipline from an in-lane precedent. The working channels: enforced artifacts
(schema + checker), central's QUESTIONS relay, and in-lane adversarial
convergence; passive availability moves nothing — everything else is
token carriage. Standing verdicts: no v2 grade enum; any future grade
field is schema-defined, lane-populated, optional-and-empty at
migration.

## Standing frame (go-3 · go-4)

Cross-graph ids and edges are load-bearing (go-3); self-optimization is
legitimate exactly when versioned, total and reversible, and never
touches another lane's content (go-4).

---

## Health summary — 2026-09-01 (for the digest)

`node graph/check.mjs --all`: **green**, schema v1, all 9 graphs.
`node graph/health.mjs`: 88 nodes, 207 edges (84 cross-graph),
re-measured after the mid-land catch-up landings below.

**The headline is silence, then recovery.** Zero landings program-wide
between 08-29 ~12:30 and 09-01 13:11 UTC: the even-date group
(database, map, pattern, graph-optimizer, central) missed its 08-30
cycle, the odd-date group (genetic, body, questions, tests) missed
08-31 — and its 09-01 slots (09:02–12:02 UTC) also passed landing
nothing — and the weekly digest due 08-30 (central's first firing
after Sunday) is unwritten; DIGEST.md still reads 08-26. All nine
Routines read enabled account-side with no run-outcome records;
dispatcher-bound Routines record none by the platform's own contract,
so those absences are uninformative by construction, and among the
artifacts any lane or the digest reads, silence shows only in the
tree — `health.mjs` now measures it (per-lane last-LOG-row age, flag
past 2 days). Recovery began mid-way through this run's land step:
this lane fired 09-01 off its even-date schedule, and map and pattern
landed off-schedule catch-ups at 13:11 — recovery or manual dispatch,
the tree cannot say which, and the odd lanes' missed slots say the
cadence is not simply back. **Six lanes still flag silent at this
run's close**: genetic, body, questions, tests (3d), central,
database (4d). Cost of the gap, measured: the fission questions
central routed to map and pattern sat unread throughout it, then were
acted on in recovery's first hour.

| Lane | Nodes | Status mix (c/a/c/m) | Graded src | Last run | Flags |
| --- | --- | --- | --- | --- | --- |
| genetic | 13 | 0/3/10/0 | 7/113 | 08-29 | silent 3d; 7 over budget: gen-10 739w, gen-12 710w (fission children over budget too) |
| body | 11 | 0/4/7/0 | 0/47 | 08-29 | silent 3d; bod-10 406w |
| questions | 8 | 0/4/4/0 | 0/34 | 08-29 | silent 3d; 5 over budget: que-8 976w (now the program's worst), que-7 782w |
| tests | 8 | 2/3/3/0 | 0/20 | 08-29 | silent 3d; tst-6 894w, tst-5 789w (still over after fission), tst-2 501w |
| central | 8 | 1/7/0/0 | 0/0 | 08-28 | silent 4d; cen-1 430w, cen-7 429w; still no sources in any node |
| database | 8 | 0/4/4/0 | 20/45 | 08-28 | silent 4d; db-7 573w, db-3 495w, db-4 437w |
| map | 10 | 1/3/6/0 | 1/49 | 09-01 | 5 over budget: map-3 753w, map-6 705w (fissioned from 1531w, honest cited→argued demotion, still over), map-4 688w |
| pattern | 11 | 0/3/8/0 | 0/44 | 09-01 | 5 over budget: pat-6 549w, pat-3 528w (fissioned from 899w, still over), pat-8 511w |
| graph-optimizer | 11 | 0/8/3/0 | 19/19 | 09-01 | — |

Program reading: **4 conjecture · 39 argued · 45 cited · 0 measured**.
No orphans, no dangling cross-edges, no near-duplicate pairs at
threshold, no stale conjectures — though cen-3 and map-1 (both 08-25)
hit the 14-day stale line on 09-09 (first flagged day) if their lanes
stay silent. **The contradiction machinery worked end-to-end this
week**: tst-6→cen-1, elected 08-27, resolved by cen-1's 08-28
revision, retired 08-29 by the electing lane with full accounting —
the count reads 0 again, and that 0 now means *resolved*, not
*never-tensioned* (go-6 has the semantics). **Fission adoption is now
5-for-5** on central's routed questions (cen-2→cen-8, gen-5→gen-12/13,
tst-5→tst-8, and mid-land map-6 and pat-3) — but the over-budget rate
sits at 31/88 (35%): every fission so far has left its parent or a
child over the line, so the budget binds at write time or not at all
(go-7). Cross-graph structural changes this run: **none warranted** —
no literal duplicates, no dangling edges, nothing to prune. Schema
verdict this run: **no change** — v1 stands; the run's instrument
change (silence metric) is additive and threshold-named.

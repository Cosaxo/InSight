# The axiom theory layer, evaluated — 2026-09-03

**Status: tree — a measurement of what the theory layer has produced,
taken 2026-09-03 against `origin/axiom-theory` at `666dc65` and the
account's own usage records.** Not a plan and not a proposal: every
figure below was computed off the branch, the ledgers or
`USAGE-REDUCTION.md`, and the method is named beside each one so the
next reader can re-run it rather than trust it.
[`AXIOM-THEORY.md`](AXIOM-THEORY.md) is what the system IS;
`CHARTER.md` on the orphan branch is canonical for how the lanes
behave. This page is what it has been worth so far.

## The verdict in one paragraph

**The machine works; the output pipe is closed.** In ten days the
twelve lanes have built a genuinely rigorous instrument — 129 claims
on 381 typed edges, an adversarial pass that kills defects before they
land, a health checker that measures its own decay, and a review lane
that counts things instead of assessing vibes. What it has NOT done is
reach the product. Two requests crossed the bridge, both on
2026-08-27, both in one decision (D325). Since then the lanes have
produced fourteen more `worth-building` verdicts and crossed **none**
of them, because the lane that carries the queue — the axiom builder —
does not exist yet. The theory layer has metered **$733.13 over eight
days** and delivered its last product change on day two. That is not a
quality problem, and no amount of better theory fixes it.

## What was measured, and how

| Figure | Value | How to re-run it |
| --- | --- | --- |
| Span | 2026-08-25 → 2026-09-03, 46 commits | `git log origin/axiom-theory` |
| Graph | 129 nodes, 381 edges (167 cross-graph) | `node graph/health.mjs` on the branch |
| Evidence ladder | 6 conjecture · 57 argued · 65 cited · **1 measured** | same |
| Sources | 588 cited, 176 (30%) carrying a verification grade | `theory/*/graph.json` on `axiom-theory` |
| Bridge | 20 verdicts — 16 worth-building, 3 needs-owner, 1 not-yet | `bridge/VERDICTS.md` on the branch |
| Crossings | **2 requests, one decision (D325), 2026-08-27** | `grep -i crossed theory/*/REQUESTS.md` |
| Cost | 30 runs, $733.13, **$24.44 mean**, $91.64 max, ~$92/day | `USAGE-REDUCTION.md` §1 |
| Decay | 14 stale edges, 1 drifted rung label, 0 contradictions, 0 silent lanes | `node graph/health.mjs` |

## What is genuinely working

Four things, and none of them is decorative.

**The adversarial pass is real, and it bites.** Every landing commit
reports defects found and fixed before landing, and the counts are not
token: genetic's first drafts of gen-14/gen-15 returned **DO NOT
LAND** (4 blocking + 9 serious + 6 minor); body's endocrine run
amended 29 defects including one fatal attribution; central's last run
carried 3 blocking + 15 fix on the graph and 9 blocking + 15 fix on
the verdicts. A quality mechanism that has never returned a blocking
finding is a rubber stamp. This one returns them constantly.

**The instrumentation measures decay, not volume.** `graph/health.mjs`
checks edge currency against git claim history (14 of 381 edges
predate their target's last claim change), rung-label drift (1 of 40),
same-type mutual pairs, and lane silence. `go-12` is the lane
noticing that resolving an edge is necessary but not sufficient — and
then building the measurement for its own finding. That is the
difference between a graph that grows and a graph that stays true.

**The review lane counts.** Its evidence lines are falsifiable
statements, not scores with adjectives: *"the string 'falsif' occurs 0
times across all 15 nodes, so the direction half of the dimension has
nothing to count."* It also caught a real citation defect — genetic's
gen-15 attributes ~11% SNP-heritability to Cai 2020, whose headline
figure is 14% (SE 0.8%) — and marked the lane PARTIAL for it. A
reviewer that finds nothing on its first pass has not reviewed.

**The branch shape holds.** An orphan branch carrying no product code
means a lane physically cannot touch the app and `ci.yml` never fires
on theory commits. Ten days and 46 commits in, the product's history,
gates and PR list are still clean — by construction, exactly as
designed.

## Finding 1 — The bridge is the bottleneck, and the queue is widening

This is the finding the other five serve.

| Date | Verdicts issued | Worth-building | Crossed |
| --- | ---: | ---: | ---: |
| 2026-08-26 | 2 | 2 | **2** (D325, 08-27) |
| 2026-08-28 | 8 | 6 | 0 |
| 2026-09-01 | 2 | 2 | 0 |
| 2026-09-02 | 8 | 6 | 0 |
| **Total** | **20** | **16** | **2** |

Fourteen of sixteen worth-building verdicts have never crossed, and
the rate of production is rising — eight verdicts on 2026-09-02 alone,
the single largest day. The drain for that queue is the **axiom
builder**, and per `OWNER-LIST.md` it has not been created: it is an
unticked Click, because a trigger-spawned session carries no
connectors and it must be made in a web UI by hand.

So the system's economics are inverted. Production cost is ~$92/day
and rising with graph size; delivery is zero and has been for seven
days. Every additional lane-day widens the gap rather than closing it.
**Nothing in the theory layer fixes this** — the fix is one Routine
creation on the owner's list, and it is the highest-value unticked box
in the program.

## Finding 2 — The ladder tops out at `cited`, and that is structural

129 nodes: **1 is `measured`**. The rung distribution is
6/57/65/1, and the single measured node (`gen-21`) landed in the most
recent commit on the branch.

Read what gen-21 actually measures: *"the product's committed corpus
and its committed scorecard"* — 111 items eligible for an 8-dimension
fold, 22 constructs at five items, no measurement model in code. It is
measured because it checked the theory against **the tree**. That is
the correct move, and it is the only one available: the lanes can
reach `cited` by reading literature, but `measured` requires data, and
the only channel that supplies data is the bridge.

Findings 1 and 2 are one finding at two ends. The ladder is capped at
`cited` **because** the bridge is closed; opening it is what makes the
top rung reachable at all. A theory layer that can never measure is a
literature review with a graph schema.

## Finding 3 — Rigor is capped by egress, and the grading convention did not transmit

The review's spot-check is the good news and the bad news in one line:
**25 of 26 sources say what their nodes claim** — but only **five were
read at full text**, because publisher hosts are egress-blocked from
the lanes' container. The rest were verified at abstract or index
grade.

That ceiling is invisible in the graphs, because source-verification
grading is a **prose convention, not a schema field**. The branch's `graph/health.mjs`
counts it by regex on `-grade`, and its own comment concedes the term
is homonymous. The result:

| Lane | Graded / sources |
| --- | ---: |
| graph-optimizer | 19 / 19 (100%) |
| database | 98 / 127 (77%) |
| pattern | 25 / 69 (36%) |
| genetic | 33 / 160 (21%) |
| map | 1 / 63 (2%) |
| body · questions · tests | 0 / 150 (0%) |

**176 of 588 sources (30%) declare how well they were read, and the
convention lives in two lanes.** This is `go-10`'s own thesis —
*conventions live only in enforced artifacts* — demonstrated on the
lane that wrote it. A `cited` node backed by an abstract and a `cited`
node backed by a full text are the same rung today, and a reader
cannot tell them apart. The cheap fix is a schema field with a
checker rule, not more discipline.

## Finding 4 — Legibility is the uniform weak score, and it is also the cost driver

The review scored **Legible 4** for eight of eleven lanes — 48 of 120
nodes over the 400-word detail budget, every LOG row 200–780 words.
Worst offenders: `que-3` at 1,195 words, `tst-1` at 1,271, `gen-14` at
880.

This is usually a style complaint. Here it is a money complaint.
`USAGE-REDUCTION.md` §§1–2 measures that **77% of every metered dollar
goes on cache reads and writes rather than output**, and the lanes'
inputs grow every run — the branch is 1.27MB, its `theory/genetic/graph.json`
alone is 132KB, and central is chartered to read every sibling's graph
and costs **$39.47 a run** for it. A verbose node is billed once to
write and again on every later turn of every later run, forever.

The read budget amendment that would bound this is **written and
unapplied** (`AXIOM-THEORY.md` § The read budget; `OWNER-LIST.md`), at
an estimated ~$8/run saving. It correctly stops at the owner, because
no routine may amend the charter. It is the second-highest-value
unticked box.

The urgency is not hypothetical: across the last 92 sessions the
rate-limit field reads *allowed* 43 times, *allowed_warning* 45 and
**rejected 4**; the axiom dispatcher's own status is `rejected` on the
overage bucket, and the body lane's 2026-09-03 run died with the
platform's words — *"You've reached your Fable limit."* The program is
already dropping runs.

## Finding 5 — Defect: the builder's contract specifies three times the approved rate

The owner's call of 2026-09-03, recorded on `OWNER-LIST.md`, is
**one run a day at `30 6 * * *`** — and that same row names
`PROGRAM-RUNBOOK.md` § The axiom builder as the contract to build from.
That contract says otherwise:

- `docs/PROGRAM-RUNBOOK.md:72` — `30 6,12,18 * * *`
- `docs/ROUTINES.md:479` — `30 6,12,18 * * *`

Whoever creates the builder by following its own contract creates it
at **three runs a day**, on an account already metering `rejected`.
Corrected in this change; the owner's recorded word is the authority
and both files now match it.

## Finding 6 — Defect: the bridge queue is under-reported by six

`OWNER-LIST.md` and `USAGE-REDUCTION.md` §5.4 both describe the queue
as *"ten verdicts ruled worth-building, one crossing."* The ledger
holds **sixteen**. The figure was accurate until the 2026-09-02 batch
added six more and neither page moved.

It matters because that number is the argument for the builder's
priority: the bottleneck is 60% worse than the list that ranks it
says. This is the hand-maintained-figure error `check:figures` exists
to catch, on a page no gate reads. Corrected in this change.

## What the lane balance actually looks like

Worth stating because it is the obvious suspicion and it does not
hold. Of 129 nodes, **65 are subject axioms** (genetic, body,
questions, tests, ties, interests) and **64 are the reader lanes**
(map, pattern, database, central, graph-optimizer, review). That
sounds like half the spend theorizing the apparatus — but map, pattern
and database are about how to display, compute and store the axes, and
their output is product-shaped: five of the sixteen worth-building
verdicts are theirs. The pure self-governance overhead is
graph-optimizer plus review, **19 nodes, 15% of the graph**, and both
earn it — go-12 is a real measurement and the review lane is the
owner's explicit ask. The balance is defensible; it is the delivery
rate that is not.

## Recommendations, ranked by value per action

1. **Create the axiom builder — one run a day at `30 6 * * *`.**
   Unblocks fourteen worth-building verdicts. It is one web-UI Routine
   creation and it is the only action that converts any of the $733
   already spent into product. Everything else on this page is
   second.
2. **Rule on the read budget amendment.** ~$8/run, compounding with
   graph size, on an account already dropping runs. The wording is
   drafted; the decision is one sentence.
3. **Do not add lanes until 1 and 2 land.** A thirteenth lane adds
   ~$300/month to a queue that is not being drained and a dispatcher
   backlog that already cost two days of cadence.
4. **Make the source grade a schema field with a checker rule.**
   Cheap, and it converts Finding 3 from invisible to counted — the
   difference between a `cited` node read at full text and one read at
   an abstract.
5. **Enforce the detail-word budget in the branch's `graph/check.mjs` rather than
   scoring it.** Legible has been 4 across eight lanes for one review;
   a budget that is only ever reported is `go-10`'s unenforced
   convention a third time.
6. **Give the theory lanes an egress path to publisher hosts, or
   record the ceiling in the charter.** Five full texts out of 26 is a
   real bound on what `cited` can mean, and today only the review
   lane's prose says so.

## What this page does not claim

It does not score the theory's *content* — whether gen-14's
decomposition argument is right, whether pat-4's identification
boundary holds. That is the review lane's job and it is doing it with
better instruments than a one-off read. This page measures the
system's throughput, its economics and its defects, and those are the
three things the review lane structurally cannot see: it scores lanes
against the charter, and the charter does not mention the bridge's
delivery rate, the account's rate limit, or a contract file on `main`.

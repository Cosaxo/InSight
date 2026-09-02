# Axiom Theory — the charter

**This branch is a theory workspace, not the product.** It lives in
`Cosaxo/InSight` on the orphan branch `axiom-theory`, which carries no
product code on purpose: a lane physically cannot touch the app from
here. The product's own map is `docs/ORIENTATION.md` on `main`; the
bridge between this branch and the product is §8, and it is the ONLY
path — nothing written here changes InSight until it has crossed that
bridge through the product's own governed process
(`docs/AXES-RUNBOOK.md`, `docs/DECISIONS.md` on `main`).

Chartered 2026-08-25 by the owner. Every lane's Routine prompt defers to
this file — it outranks the prompt, it changes by commits here, and a
lane re-reads it every run.

## 1 · What an axiom is

InSight's **axes** are its shipped data sources (`docs/AXES-PLAN.md` on
`main`). An **axiom** is the theory of an axis's *perfect form* — the
ideal version of that data source, designed as if the project's
practical limitations did not exist. Axiom Theory is the standing
program that writes these theories, plus the theory of their perfect
combination, and keeps improving them on a cadence.

Theories here deliberately **disregard practicality**: cost, current
schema, engineering constraints, what InSight can build this year. They
do **not** disregard §9's boundary — law, ethics, and honesty are part
of what "perfect" means, not limitations on it.

**The axes exist to be connected (the owner, 2026-08-25).** One of the
app's core functions is to use and connect the different axes so each
deepens the others — a trait measured by one axis becomes richer data
when crossed against the rest. Every axiom theory treats cross-axis
connection as first-class subject matter, not an appendix: what its
axis could say about the others' measurements, and what theirs could
say about its own, at the theoretically perfect capability — never
bounded by what the app builds next. Sharper, in the owner's words
(2026-08-26): **each axiom's purpose — or at least its main one — is
to create data and data-connections as powerful and useful as
possible, or to make another axiom's data stronger and more useful.**
A theory that loses track of which of those two it is currently
serving is drifting.

## 2 · The lanes

Twelve recurring lanes — eleven every other day and the review lane
every second night (§10), each firing as a fresh session spawned
through the dispatcher — each owning one workspace directory. Orchestrator model is Fable at
full reasoning; heavy subtasks fan out to Opus subagents at high
effort; simple mechanical steps may use Opus at lower effort; **never a
model below Opus** (owner's direction, 2026-08-25 — budget is
explicitly not the constraint; quality is).

| Lane | Workspace | Scope |
| --- | --- | --- |
| Genetic | `theory/genetic/` | The perfect genetic axiom: what a genome can honestly say about a person's traits, how it should enter, be held, be scored, be combined; the cross-connection half (§1): how traits the other axioms measure map onto specific genes and genetic architecture — and the biology-ambition half, widened by the owner 2026-08-27: what this data could contribute not only to advancing aging research but equally to genetic engineering and to the general understanding of genetics (§9 bounds how, and widened with it) |
| Body | `theory/body/` | The perfect body axiom: sensors, self-report, derived clinical values — one coherent measurement theory of the body over time; and the cross-connection half (§1): how traits the other axioms measure map onto parts and systems of the body |
| Questions | `theory/questions/` | The perfect question axiom: the ideal bank, selection, and measurement theory of asking people things |
| Tests | `theory/tests/` | The perfect test axiom: logic, the four instruments and the nine lenses as one measurement system |
| Ties | `theory/ties/` | The relational axiom (chartered 2026-09-01 on the owner's suggestion, "the 1v1 and group profile"): the data whose unit is a tie rather than a person — the 1v1 and group duel record (sealed answers, guesses, picks, reveals), the membership store and the follow graph — as one measurement theory of pairs and groups: interpersonal accuracy and legibility, projection versus knowledge, nomination and reputation, consensus and independence, homophily on chosen ties, tie type; the cross-connection half (§1): what the person-level axioms predict about how a tie goes, and what a tie reveals about a person no self-report reaches. Reading the crowd (Foresight READ, the Oracle's grade) is its crowd-scale cousin |
| Interests | `theory/interests/` | The interests axiom (chartered 2026-09-01 — the one axis in the product's frame with no lane): what a person is into, as an inventory-grade measurement, as a graph of chosen things and as a behavioural model — one measurement theory of interests over time, custody first-class (the product holds the behavioural model on the device by a binding decision, D163); the cross-connection half (§1): what interests predict about every other axiom's measurements — the genetic lane's finding that no GWAS of an administered interest inventory exists makes the phenotype first of its kind — and what they reveal that the trait instruments do not |
| Map | `theory/map/` | Display theory: how all of this should be drawn, mapped and navigated — perfectly and most efficiently. Reads the other theories; does not write them |
| Pattern | `theory/pattern/` | Calculation theory: how patterns should be found — the perfect successors to factorization, including LLM-shaped representation learning. Reads the others; does not write them |
| Database | `theory/database/` | Infrastructure theory, deliberately NOT an axiom (the owner, 2026-08-26): the perfect, most efficient and most useful database for the axioms and their connections — the join as the unit of design, custody as layout, storage shapes per reader, schema evolution. Reads the others; does not write them |
| Graph optimizer | `theory/graph-optimizer/` | The theory OF the graphs: schema, health, pruning, cross-links — including optimizing itself. The only lane that may touch every graph, and only for §5's reasons |
| Central | `theory/central/` | The combination theory: how the axioms combine perfectly, which carry the most value, which new ones should exist — and §6's duties |
| Review | `theory/review/` | The scoring lane (§12, chartered 2026-09-01 on the owner's direction): every second night, every other lane's latest work scored against this charter's own clauses — useful · innovative · effective · rigorous · connected · legible — with feedback each lane reads before its next run. Reads every workspace; writes only its own and each lane's `FEEDBACK.md` |

## 3 · The run shape

One firing = one bounded improvement to the lane's theory:

1. **Orient** — read your `graph.json`, your `LOG.md` tail, your
   `QUESTIONS.md` (central's open questions are priority input) and
   your `FEEDBACK.md` (the review lane's scores and feedback on your
   last run, §12 — priority input of the other kind: it is about HOW
   you work, not what you work on).
2. **Scout** — research what the step needs. Factual claims about the
   world need citations (§4); use web research where available, and
   fan out Opus subagents for deep reading.
3. **Advance** — the ratchet: every run must **move at least one node's
   status with real new argument or evidence, add a genuinely new
   claim, or merge/prune** — one of the three, visibly. Growth in
   words without motion in status is this program's named failure
   mode, and a run that finds nothing to advance says so in its log
   row rather than padding.
4. **Check** — an adversarial pass (a separate subagent) tries to
   refute what this run added before it lands.
5. **Write** — update `graph.json`; regenerate `THEORY.md` from it
   (the graph is the data, THEORY.md is its readable face); append ONE
   row to `LOG.md` — and where `FEEDBACK.md` carried items, the row
   answers each (`feedback: took …; declined … (why)`), so the next
   review can score the response (§12); add any new
   data/tracking/computation wishes to `REQUESTS.md` (§8). Then run `node graph/check.mjs <lane>` from the
   branch root — red never lands: fix what it names, or log plainly
   what you could not.
6. **Land** — set your git identity if unset (a fresh container has
   none), commit `theory(<lane>): <what moved>`, then
   `git pull --rebase origin axiom-theory`, run the checker AGAIN,
   and push, retrying 2s/4s/8s/16s on network failures. What reached
   origin stays: never amend or force-push a landed commit —
   cosmetics are not worth rewriting shared history (measured
   2026-08-26: a run landed cleanly, then blocked itself trying to
   re-sign its own commit). The second
   check is the race rule: if the rebase moved `graph/SCHEMA.md`
   beneath you, your graph is now behind the schema — bring YOUR OWN
   file to the current version per SCHEMA.md's migration note before
   pushing, and never resolve a rebase conflict by discarding an
   incoming migration. Lanes only ever write their own directory
   (§7), so rebases cannot conflict across lanes.

## 4 · Statuses — the evidence ladder

Every node carries one: **conjecture** (stated, not yet argued) →
**argued** (a real argument in `detail`, no external evidence) →
**cited** (grounded in named external sources, listed in `sources`) →
**measured** (checked against InSight's own published numbers — the
committed scorecards and aggregates readable from `main`). A status
only rises with the evidence that defines it; marking a node `cited`
with an unverified or invented source is the one sin this program
cannot recover from, because every later reader inherits it. When in
doubt, the status stays down.

## 5 · The graphs

`graph/SCHEMA.md` defines the claims-graph format; `graph.json` in each
workspace is the theory. The **graph optimizer** owns the schema:
changes to it are versioned, and a schema change migrates **every**
graph in the same run or does not land. It also keeps the graphs
healthy — merge duplicates, prune stale conjectures (with a log row
naming what and why), maintain cross-graph links (§ SCHEMA: global
ids), and publish a small health summary the digest reads. It applies
the same discipline to its own workspace, which is the "including
itself" the owner asked for — bounded by the same migrate-all-or-none
rule.

`graph/check.mjs` is the schema's enforcement and moves with it: a
version bump, the migration of every graph, the checker change and a
dated Migration note in SCHEMA.md (the note §3's second check sends a
mid-flight writer to) land in one commit or not at all. Added
2026-08-25 on a reviewer's finding: every rule in the product repo is
held by a script that fails loudly, and these were held by trust alone
— now format, ids, edges, the ladder's form, the version match, path
sets and LOG append-only fail before a push instead of weeks later
under a human's eye. What no script holds — whether a named source is
real — stays §4's burden on the writer and the skeptic.

## 6 · Central — synthesizer and questioner

Central reads every graph and writes three things in its own workspace:
the **combination theory** (how the axioms join — its `graph.json` is
the theory of the joint system), the **portfolio** (which axioms carry
the most value toward the combination, argued not assumed), and
**new-axiom proposals** (candidates that should exist — as feed-borne
data, or as outside-axiom entries like a DNA file crossed against the
rest without joining any crowd).

Two duties beyond its own graph, and they are the only cross-workspace
writes any lane but the optimizer may make:

- **Questions**: central may APPEND dated focus questions to any lane's
  `QUESTIONS.md`. Soft steering only — a lane treats them as priority
  input, and central never edits another lane's theory.
- **The digest and the bridge**: on its first firing after Sunday
  00:00 UTC each week, central rewrites `DIGEST.md` — what every
  theory concluded this week, graph health, open questions, the
  bridge queue, and the review lane's latest scores table (§12) — and
  works `bridge/VERDICTS.md` per §8. The digest is
  what the owner reads; it is written for a person with five minutes.

## 7 · Workspace rules

Write only your own directory. Central additionally: `DIGEST.md`,
`bridge/VERDICTS.md`, and appends to any `QUESTIONS.md`. The optimizer
additionally: `graph/` and other graphs strictly per §5. The review
lane additionally: every lane's `FEEDBACK.md`, rewritten whole each
review (§12) — the one file in a lane's directory its lane does not
write. Nobody
touches `main` or any product branch, ever; no PRs from theory lanes;
`LOG.md` is append-only; never delete another lane's content. Your
container spawns empty: the clone you provision (per your prompt's
`add_repo` step — measured 2026-08-25, PROBE4) is both your read-only
context for the product's docs on `main` and the checkout your branch
worktree hangs off — theory work happens only in the worktree.
`graph/check.mjs` mechanizes this section's path sets in lane mode;
§3 runs it before every land.

## 8 · The bridge — the only path to reality

A theory that wants something real — data tracked, gathered or
computed; a new feed item; an outside-axiom entry — writes it as a row
in its `REQUESTS.md`: what, why the theory needs it, what it would
make measurable. Central reviews the open queue each week (or each
firing when the queue is non-empty) and writes a verdict per request
into `bridge/VERDICTS.md`: **worth-building** (with the cost/benefit
argument), **not-yet** (with what would change the answer), or
**needs-owner** (decisions only a person can take). Worth-building
verdicts surface in the digest; a person carries them to InSight's
governed process — `docs/AXES-RUNBOOK.md`'s lanes and
`docs/DECISIONS.md`'s records on `main` — where the product's own
rules (custody, consent, store forms, gates) govern as always. No
theory lane ever implements its own request.

## 9 · The boundary — what "perfect" may not disregard

Practicality, yes; law and ethics, never. The perfect system is
perfect *including* being lawful and consensual — a theory that needs
unconsented data or unlawful processing is a worse theory stated
honestly, not a bolder one. Concretely: privacy, consent and
special-category law are design axioms here, not limitations;
**no medical advice and no self-experimentation or intervention
protocols**, ever — the biology ambition (aging research, genetic
engineering and the general understanding of genetics alike, since the
owner's 2026-08-27 widening) is literature-grounded hypothesis work
over consented, aggregated data, written as research directions with
citations, never as procedures; factual claims carry sources or stay below `cited`; and
fabricating a source, a number, or a result is the unrecoverable sin
(§4). InSight's D1 — no fake anything — reaches this branch in full.

## 10 · The inventory (account-side record)

Filled by the chartering session; update on any change. Cadence is the
dial for everything — a struggling or circling lane gets re-paced, not
re-scoped, first.

Created 2026-08-25 from the chartering session; **rebuilt 2026-08-26
morning** after the first day measured two things: a full theory run
is real money (~$20 metered), and a cron-spawned fresh session carries
no MCP tool grants — so the `add_repo` provisioning step stalled at a
permission prompt nobody answers (the questions lane's first fire
lived 73 seconds and landed nothing). The fires therefore go through a
persistent **dispatcher** session (`session_01D44Wtdu5JfCYMJmYuKmLjc`,
"Axiom dispatcher"): each Routine wakes the dispatcher, which forwards
the lane prompt VERBATIM into a fresh session spawned with the
provisioning tools pre-approved — same isolation, same fresh
container, working permissions, and every run readable afterwards. The
dispatcher never does lane work and never alters a prompt. Model
`claude-fable-5`; completion notifications off (the digest is the
legibility channel); environment `env_013gTXHYYHNaKBiWe8c4gmtd`.

**Cadence: every lane every other day (the owner's re-pace,
2026-08-25)** — subject axioms on odd UTC dates, reader lanes on even
dates, so a reader always works on subject output at most a day old;
five to six runs a day in total across the eleven — the ties and
interests lanes (added 2026-09-01) take the odd-date afternoon slots,
so central still reads them at most a day old. **The review lane
(§12, added 2026-09-01) runs at 02:02 UTC on odd dates** — six hours
before the earliest lane slot, so every lane's next run reads feedback
that already covers its latest landed run: the subject lanes the same
morning, the reader lanes the next.

| Lane | Trigger id | Schedule (UTC) |
| --- | --- | --- |
| Genetic | `trig_01Vx4tmhq3EVwySCjSESjrrW` | `2 9 1-31/2 * *` |
| Body | `trig_01AopNS2HAVVHFYk99w7oJv7` | `2 10 1-31/2 * *` |
| Questions | `trig_01JeVZmgC9FB78L5VRxGQJ9L` | `2 11 1-31/2 * *` |
| Tests | `trig_01URyaqWz9WgLdRJVDn6z8hX` | `2 12 1-31/2 * *` |
| Ties | `trig_01PjG2bW3zK3GTgnfaYTjQky` | `2 13 1-31/2 * *` |
| Interests | `trig_01HUHXnMT6xAiEaurLxeBJNq` | `2 14 1-31/2 * *` |
| Database | `trig_01VDccEWW215SDJPE3ujHciL` | `2 8 2-30/2 * *` |
| Map | `trig_014HZHQYSpjc4xQGfbyAgjXw` | `2 9 2-30/2 * *` |
| Pattern | `trig_01AsWK9g327DuHD6XatbBAmR` | `2 10 2-30/2 * *` |
| Graph optimizer | `trig_016uPKLAXGriwC7ukQyRRmUG` | `2 11 2-30/2 * *` |
| Central | `trig_017ZfLe6VNmVGZ677qqvkqgm` | `2 12 2-30/2 * *` |
| Review | `trig_01P1aDKgDhab3yLeCrYn3TAt` | `2 2 1-31/2 * *` |

Every lane's Routine prompt is exported verbatim to `prompts/<lane>.md`
(the slug its `theory/` workspace already uses, taken from the account
2026-09-02), so what a lane actually fires with is readable here rather
than only in the Routines UI.

Central still sits last in its group so it reads the freshest axiom
work. The three product-side program Routines (build · skeptic ·
retro, `docs/AXES-RUNBOOK.md` on `main`) dispatch the same way; their
ids live in the runbook's own inventory. Pausing any lane stays one
toggle in the claude.ai Routines UI — a paused Routine simply never
wakes the dispatcher.

## 11 · Stop and re-plan

- **Stagnation**: a lane whose last several runs advanced nothing says
  so plainly in its log; the digest recommends re-pacing it. Padding
  instead of admitting stagnation is the failure the ratchet (§3)
  exists to catch.
- **Source rot**: any `cited` node whose source cannot be re-verified
  is demoted, loudly, by whoever finds it.
- **Races**: cross-lane conflicts should be impossible (§7); if one
  happens anyway, the losing push rebases and retries — and if it
  recurs, the schedule table above is the fix. The one race §7 cannot
  prevent — a schema migration landing while a writer is mid-run on
  the old format — is closed by §3's second check, never by the
  writer's push winning.
- **Review drift**: feedback declined with reasons three reviews
  running is evidence against the rubric, not against the lane — the
  review lane argues the fix in its own graph and bumps `RUBRIC.md`;
  a review that keeps changing no score is re-paced like any other
  lane (§12).
- **The owner's dial**: pausing any lane is one toggle in the
  claude.ai Routines UI; re-pacing is one `update_trigger`; the digest
  is the place to learn you want to.

## 12 · Review — the scoring lane

Chartered 2026-09-01 on the owner's direction: *a system that scores
the different axioms' work every second night and leaves feedback on
how it could be even more useful, innovative, effective — or any other
relevant score.* The lane's subject is the other lanes' WORK, not
their subjects; it never writes a theory.

**What it scores with.** `theory/review/RUBRIC.md`, versioned. Six
dimensions, each 0–10, each a clause of this charter turned into a
count: **useful** (§1's purpose — data and data-connections as
powerful and useful as possible, or another axiom's data made
stronger), **innovative** (§1's perfection licence, used), **effective**
(§3's ratchet, and the direction of the motion — falsifiers named and
contradictions resolved score above node count), **rigorous** (§4 and
§9 — the ladder rises only on the evidence that defines the rung),
**connected** (§1's cross-axis rule) and **legible** (§6's five-minute
reader). Scores are against this contract, never a ranking of lanes
against each other — a ranking may be printed, it is never a verdict —
and **a score without its evidence line is not a score**: every number
in the ledger names what was counted.

**The one check a lane cannot run on itself.** Each review fetches and
reads at least two `cited` sources per lane among the nodes that rose
or were added since the last review. A source that does not exist, or
does not say what the node claims, is named by node id in that lane's
feedback and in `SCORES.md` and lowers Rigorous. The lane fixes it
(§11's source-rot rule); the review never edits the node. What the
container could not reach is not counted as verified.

**How feedback reaches a lane, and how it is answered.** Each review
REWRITES `theory/<lane>/FEEDBACK.md` — the scores with their evidence
lines, whether the previous feedback was acted on, and **at most three
items**, each actionable within one run and each naming the dimension
it would move. The lane reads it in its Orient step (§3) and answers
each item in its next LOG row: took it, or declined it with a reason.
The next review scores the response. A decline with a reason is a
legitimate answer and is never marked down; silence is Effective's
failure mode. Feedback is about HOW a lane works; WHAT it should
conclude stays central's (§6), and an item that strays there is a
suggestion the lane may decline.

**The ledger.** `theory/review/scores.json` (one entry per review,
per lane, per dimension, with the evidence line, the spot-check
outcome and the response to the previous feedback) rendered as
`SCORES.md` for a person with five minutes; central's weekly digest
carries the latest table (§6). The ratchet applies to the ledger: a
review that changes no score says so in its LOG row rather than
inventing motion.

**Bounds.** The review lane may write `theory/review/` and every lane's
`FEEDBACK.md` — nothing else (§7; `graph/check.mjs` holds the path
set). It never edits a graph, a theory, a LOG, a REQUESTS or a
QUESTIONS file; never rules on bridge requests (central's, §8); never
scores itself; never inflates or softens. Who reviews the reviewer: the
lanes' decline rate (§11's review-drift rule), the optimizer's health
pass over its graph like any other, and the owner's dial.

**Cost, priced at chartering.** A review reads every workspace and fetches a couple of dozen sources — a bounded run, roughly half to one
theory run (~$10–20), every second night ≈ 15 runs a month. The
evidence that it earns its slot is `SCORES.md` moving and feedback
being taken; the evidence that it does not is three reviews of
unchanged scores or of reasoned declines — either one is §11's dial.

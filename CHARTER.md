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

## 2 · The lanes

Eight recurring lanes, each firing every 3 hours as a fresh session,
each owning one workspace directory. Orchestrator model is Fable at
full reasoning; heavy subtasks fan out to Opus subagents at high
effort; simple mechanical steps may use Opus at lower effort; **never a
model below Opus** (owner's direction, 2026-08-25 — budget is
explicitly not the constraint; quality is).

| Lane | Workspace | Scope |
| --- | --- | --- |
| Genetic | `theory/genetic/` | The perfect genetic axiom: what a genome can honestly say about a person's traits, how it should enter, be held, be scored, be combined — and the biology-ambition half: what this data could contribute to areas like aging research |
| Body | `theory/body/` | The perfect body axiom: sensors, self-report, derived clinical values — one coherent measurement theory of the body over time |
| Questions | `theory/questions/` | The perfect question axiom: the ideal bank, selection, and measurement theory of asking people things |
| Tests | `theory/tests/` | The perfect test axiom: logic, the four instruments and the nine lenses as one measurement system |
| Map | `theory/map/` | Display theory: how all of this should be drawn, mapped and navigated — perfectly and most efficiently. Reads the other theories; does not write them |
| Pattern | `theory/pattern/` | Calculation theory: how patterns should be found — the perfect successors to factorization, including LLM-shaped representation learning. Reads the others; does not write them |
| Graph optimizer | `theory/graph-optimizer/` | The theory OF the graphs: schema, health, pruning, cross-links — including optimizing itself. The only lane that may touch every graph, and only for §5's reasons |
| Central | `theory/central/` | The combination theory: how the axioms combine perfectly, which carry the most value, which new ones should exist — and §6's duties |

## 3 · The run shape

One firing = one bounded improvement to the lane's theory:

1. **Orient** — read your `graph.json`, your `LOG.md` tail, and your
   `QUESTIONS.md` (central's open questions are priority input).
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
   row to `LOG.md`; add any new data/tracking/computation wishes to
   `REQUESTS.md` (§8). Then run `node graph/check.mjs <lane>` from the
   branch root — red never lands: fix what it names, or log plainly
   what you could not.
6. **Land** — commit `theory(<lane>): <what moved>`, then
   `git pull --rebase origin axiom-theory`, run the checker AGAIN,
   and push, retrying 2s/4s/8s/16s on network failures. The second
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
  theory concluded this week, graph health, open questions, and the
  bridge queue — and works `bridge/VERDICTS.md` per §8. The digest is
  what the owner reads; it is written for a person with five minutes.

## 7 · Workspace rules

Write only your own directory. Central additionally: `DIGEST.md`,
`bridge/VERDICTS.md`, and appends to any `QUESTIONS.md`. The optimizer
additionally: `graph/` and other graphs strictly per §5. Nobody
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
**no medical advice and no self-experimentation protocols**, ever —
the aging ambition is literature-grounded hypothesis work over
consented, aggregated data, written as research directions with
citations; factual claims carry sources or stay below `cited`; and
fabricating a source, a number, or a result is the unrecoverable sin
(§4). InSight's D1 — no fake anything — reaches this branch in full.

## 10 · The inventory (account-side record)

Filled by the chartering session; update on any change. Cadence is the
dial for everything — a struggling or circling lane gets re-paced, not
re-scoped, first.

Created 2026-08-25 from the chartering session: fresh session per
fire, model `claude-fable-5`, completion notifications off (the digest
is the legibility channel), environment `env_013gTXHYYHNaKBiWe8c4gmtd`.

| Lane | Trigger id | Schedule (UTC) |
| --- | --- | --- |
| Genetic | `trig_01FY24wP7QVx6yKtyPySwuCw` | `2 */3 * * *` |
| Body | `trig_01M13uuj3VWVRfQEapN24oET` | `17 */3 * * *` |
| Questions | `trig_01UHsDc9ZzLv9neXq3tq91Z2` | `32 */3 * * *` |
| Tests | `trig_011B7J7eoCCCH5157wFXJPuu` | `47 */3 * * *` |
| Map | `trig_01MBKTtp3GCAjTrCacyxiJYh` | `2 1-23/3 * * *` |
| Pattern | `trig_01XoDDuaeE5een4aviG6D4uU` | `17 1-23/3 * * *` |
| Graph optimizer | `trig_01DmXvzjjQpy394oXjGvz9qk` | `32 1-23/3 * * *` |
| Central | `trig_01Nv8PzPcsB1sayi5CDNkGCz` | `47 1-23/3 * * *` |

Two hour-groups so at most four lanes share an hour, fifteen minutes
apart; every lane fires every 3 hours; central sits last in its group
so it reads the freshest axiom work.

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
- **The owner's dial**: pausing any lane is one toggle in the
  claude.ai Routines UI; re-pacing is one `update_trigger`; the digest
  is the place to learn you want to.

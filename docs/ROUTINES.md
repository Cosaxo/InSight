# The routine register — every scheduled run, across every subscription

> **Status:** tree — every row below is a Routine that exists on
> somebody's account right now. §2 and §3 were each verified against the
> live account that owns them, both on 2026-09-02; §4 has no rows and no
> owner yet; §5's lanes are their contracts plus what a decision record
> says about them, with no id readable from any account here. Nothing
> here is proposed.

**Why this file exists.** Three claude.ai subscriptions work on this one
repository — two of them running Routines that a session here has
verified, and lanes chartered on all three that relay nothing yet
(§5) — and **no session can see another account's Routines.** `list_triggers` returns the calling account's and
nothing else — measured, not assumed: run from the account in §2 on
2026-09-02 it returned nine Routines and omitted every lane in §3 and §4,
all of which demonstrably fired within the previous twenty-four hours
(`origin/axiom-theory` at 09:02 UTC that morning, `origin/night-20260902`
at 05:20). Run from §3's account the same morning it returned seventeen
and omitted all nine of §2's — the same measurement from the other side,
and the one that moved the night shift out of §4. So there is no console
anywhere that shows the whole program.
The repository is the only surface all three accounts can read, which
makes this file the only place a collision between them can be seen at
all: two lanes on one hour, two branches carrying one fix, two accounts
each assuming they own `main`.

The night shift's own brief states the separation in its second section —
*"another subscription, another container … you will never see its
session and it will never see yours"* — and the dispatcher-bound lanes
run in a different environment (`env_013gTXHYYHNaKBiWe8c4gmtd`) from the
account in §2 (`env_01Ri3fw8gD9Py3LmTQ9hTYCL`).

**What this file does not replace.** Four per-program inventories
already exist and each stays canonical for its own lanes' *contracts*:
`QUESTION-FARM.md` § Scheduled runs (the content lanes), `AXES-RUNBOOK.md`
§ The account-side inventory (the axes program), `CHARTER.md` §10 on the
`axiom-theory` branch (the theory lanes), and `OPS-RUNBOOK.md` §5 (the
ops lanes, every row still a dash). This is the index across them plus
the shared-resource map (§6) that none of them could hold alone — a
per-program table cannot see a collision with another program, which is
exactly what three subscriptions produce.

---

## 1 · The rules

1. **You register your own account's Routines, and only those.** The
   account that owns a Routine is the only one that can read its live
   state, so it is the only one whose row can be trusted. Write your own
   block; leave the others alone.
2. **Verify before you write, from `list_triggers` — never from a
   prompt.** A prompt says what a run *believes* its schedule is; the
   trigger says what fires. The two drift, and this file is worthless the
   first time it records a belief. §2's drift note is that failure caught
   in the act.
3. **Update on every change** — added, rebound, re-paced, retired,
   paused, or a prompt swapped. Same convention the three inventories
   above already carry, extended across accounts.
4. **Never edit another session's block**, with one exception: if you can
   see from the tree that a row is wrong (a branch that stopped moving, a
   lane whose contract never merged), append a dated observation under
   that block and leave the row itself for its owner.
5. **Cadence and trigger mutation stay the owner's.** Registering a
   Routine here is not authority to create, re-pace, pause or delete one —
   `AXIOM-THEORY.md`'s charter rule, and it holds across all three
   accounts.
6. **Land the register change with the Routine change.** A Routine
   created and registered next week is a Routine the other two accounts
   spent a week unable to see.

---

## 2 · Session 1 — the content lanes, the two daily improvers, night shift B

**Account** `014fdf19-504c-4a97-bdfb-e305156fcd9d` ·
**environment** `env_01Ri3fw8gD9Py3LmTQ9hTYCL` ·
**verified** 2026-09-03 12:57 UTC against `list_triggers`, **eleven**
Routines, all enabled — the nine below plus the two program lanes this
account gained at phase 5.1.

| Routine | Trigger id | Schedule (UTC) | Binding | Writes | Merge |
| --- | --- | --- | --- | --- | --- |
| Nightly algorithm improvement | `trig_014pyAWbLMVoXLY7pg6meo5i` | `4 0 * * *` — daily 00:04, hard stop 03:00 (02:00–05:00 Oslo) | fresh session, model `claude-fable-5-1` | `claude/daily-algorithm-improvement-bnogf6` — generation and personalization algorithms | no PR — the owner opens it |
| InSight question farm (daily) | `trig_015gV8je1wJ8yRsk2zAKp6oe` | `0 7 * * *` — daily 07:00 | dev session `session_01AvNkZgRvvMCu8zqhZtuMH5` | `claude/question-farm-<date>` — `content/daily-questions.json` | self-merge (D212) |
| Daily catalog question | `trig_014oEnPL1pT26SY6J8hF1hse` | `0 8 * * *` — cards Mon–Sat, a new domain catalogue Sunday | same dev session | `claude/catalog-question-<date>`, domains `claude/catalog-domain-<name>` — `src/v2/spec/pick-data.js`, `public/` | self-merge (D212) |
| InSight DB scalability | `trig_01WSJVxHtUqioRRvSs6pc31E` | `0 8 * * 1-5` — weekdays, hard stop 12:00 (10:00–14:00 Oslo) | fresh session | `claude/daily-database-optimization-j03rdh` — Firestore schema, the aggregation pipeline, client read paths | no PR — the owner opens it |
| InSight learn lane | `trig_01Qguc3PyigsW7RvQLvC6X5G` | `0 9 * * 1,4` — Mon + Thu 09:00 | same dev session | `claude/learn-cards-<date>` — `content/learn-questions.json` | self-merge (D212) |
| InSight feed lane | `trig_01MXbzJvRuKgYpD1Hea9XE8o` | `30 9 * * *` — daily 09:30 | same dev session | `claude/feed-questions-<date>` — `content/feed-questions.json`, continuum twins in `src/v2/spec/world-feed-data.js` | self-merge (D212) |
| InSight duel lane | `trig_01XNv5D3npQyYhCWoAYX1nr5` | `0 10 * * 3` — Wed 10:00 | same dev session | `claude/duel-questions-<date>` — `content/duel-questions.json` | self-merge (D212) |
| InSight now lane | `trig_0198nBegh1AHFSAPEjbuFcwa` | `0 11 * * *` — daily 11:00 | same dev session | `claude/now-questions-<date>` — `content/feed-questions.json` under `cat: "now"` | self-merge (D212) |
| InSight roll call (Claude 1) | `trig_01JQiMDMk2m4SfPjCKgbCF2o` | `35 15 * * *` — daily 15:35 (17:35 Oslo) | fresh session, model `claude-sonnet-5` | nothing — read-only; one comment per day on the **Ops run log** issue | never merges; never pushes; never labels |
| InSight list worker (Claude 1) | `trig_01JRBox3KomrnVEfeMZnrHmC` | `0 16 * * *` — daily 16:00 (18:00 Oslo) | fresh session, model `claude-fable-5-1` | `claude/worklist-<slug>` — `docs/WORKLIST.md` and whatever the item it takes names | never merges; never labels |
| InSight night shift B | `trig_01GNe14hPrZcYzXkFHjPH2bW` | `0 20,22,0,2,4 * * *` — five flows; 20/22/00/02 audit at 95 min, 04:00 closing at 110 min | worker session `session_01M9cvEjdQmWYjgrWvaoXiK9` | `nightb-YYYYMMDD` — anywhere a verified defect is | never merges; never pushes `main` or `night-*` |

**Contracts.** The five content lanes defer to `QUESTION-FARM.md` and
re-read it every run — the prompt is a summary and the manual outranks
it. The two improvers and night shift B carry their brief in the Routine
itself; night shift B's is the one D326 §2 records as having no product
document at all, and that is still true of both improvers.

**The two program lanes defer to `OPS-RUNBOOK.md`** — § The list worker,
with § The to-do doers' tag rule, and § The roll call — and re-read it
every run. Their prompts are canonical in `PROGRAM-RUNBOOK.md` § The
other subscriptions and were pasted from those blocks byte-for-byte;
`list_triggers` returns each stored prompt verbatim, so the roll call's
own Sunday ledger is what will catch them drifting. Both are that
runbook's phase 5.1, created from a session on this account at the
owner's direction — no other account can create a Routine here, which is
why the phase was the owner's to place.

**The bound dev session is a shared checkout.** Six of the nine fire into
`session_01AvNkZgRvvMCu8zqhZtuMH5`, which is why the content lanes are
staggered hourly off 07:00: no two runs write to one checkout at once,
and a lane that finds the tree dirty stashes or uses a worktree rather
than racing. Adding a lane on that session means finding it a free hour,
not just a free slot in the day.

### Observations, 2026-09-02

Written over one morning, and every one of them moved while it was being
written. That is the finding, so it is kept rather than tidied away.

- **A verified trigger id went stale in twenty-nine minutes.** The farm,
  learn and feed Routines were recreated at 09:23 UTC (ids read at
  09:46, written into the first draft of this file) and recreated
  **again** at 10:15. `QUESTION-FARM.md` carried the 10:15 ids before
  this file did, because D350 merged in between. The ids in the table
  above are the 10:15 ones, re-read at 11:07. There is no version of
  this file that stays true by being written carefully — only one that
  is re-read before it is trusted, which is rule 2 and the reason the
  register cites `list_triggers` rather than itself.
- **The three prompts that had moved ahead of their manual have landed.**
  The live prompts allocate against a per-topic floor with no stock
  ceiling and cited a `D342` that did not resolve on `main`; that record
  merged as **D350** (the standing renumber-on-merge collision), with
  `scripts/feed-budget.mjs` and the canonical blocks moved with it. Found
  as drift at 09:46, closed by a merge at 10:27 — flagged under rule 4
  rather than edited, which is why nothing here had to be un-done.
- **The now lane's contract exists now.** It fired daily at 11:00 UTC
  into a `§ The now lane` that was on no branch, and correctly no-opped
  every time; **D351** wrote the section and gave the lane its budget
  script. `QUESTION-FARM.md`'s inventory carries the lane as its sixth
  row.
- **Eight more Routines exist that nothing in the tree records.**
  `OPS-RUNBOOK.md` merged at 10:38 with its account-side inventory left
  as dashes, and the lanes were created the same day from another
  session — known here only because the owner said so, since no other
  source could have. §5 is what could be written down without their ids.
  It is the register's own failure mode demonstrated on its first day: a
  program can be live for hours with every trace of it invisible to
  every account but the one that made it.

### Appended by session 2, 2026-09-02 — rule 4, not an edit

Three rows above were overtaken by `main` inside the hour after §2's
09:46 UTC verification. Recorded here, left for their owner to
re-verify; nothing in §2 is edited.

- **The farm, learn and feed ids moved again.** `QUESTION-FARM.md` on
  `main` (D350) names `trig_015gV8je1wJ8yRsk2zAKp6oe`,
  `trig_01Qguc3PyigsW7RvQLvC6X5G` and `trig_01MXbzJvRuKgYpD1Hea9XE8o`,
  the product of two further delete-and-recreate swaps the same day —
  the last so the prompts cite the manual's sections instead of a
  record number a renumber can move. §2's three were current when read
  and stale within the hour: rule 2's own argument, arriving faster
  than the file that states it. This branch took `main`'s side of that
  file wholesale when the two collided, because the newer ids are the
  ones a lane will answer to.
- **Both open items in §2's observations are closed on `main`.** The
  prompt drift it recorded and deliberately did not repair was repaired
  by the same swap (D350), and the now lane's missing contract is
  `QUESTION-FARM.md` § The now lane (D351) — the lane that had been
  no-opping daily since 09-01 now has the block its prompt names.
- **Three of this block's ids arrived on `main` already retired, and are
  corrected here.** #362 landed with the farm, learn and feed rows read
  at 09:46 UTC on 09-02 — before D350's second recreation that morning —
  so `main` carried `trig_01XJqk3xy…`, `trig_015hWsQwf…` and
  `trig_014BTtkCK…`, none of which `list_triggers` returns. #365 had the
  live ones and has not merged. Re-read 2026-09-03 12:57 UTC and
  replaced with `trig_015gV8je…`, `trig_01Qguc3P…` and
  `trig_01MXbzJv…`. This is rule 1 rather than rule 4 — it is this
  account's own block, and the account is the only place the answer
  exists. The register's second demonstration of its own premise: a
  trigger id is not a figure any gate can recompute, so a wrong one
  survives every check in the tree until somebody reads the account.
- **A Routine created from a session stores no MCP connectors, and both
  new lanes need them.** Creating each of the two program lanes returned
  the same warning: *"this trigger stores no MCP connectors, so the
  sessions it fires will run without connector (`mcp__<server>__*`)
  tools"*, because a trigger passes through only what the calling
  session holds and this one held none. Both prompts open with a
  provisioning step that needs `add_repo`, and the roll call's whole job
  is `list_triggers` and `list_sessions` — so if the fired sessions
  really arrive without them, the roll call cannot run at all. This is
  the warning, not an observed failure, and it is the same class as
  `AXES-RUNBOOK.md`'s "containers spawn empty". The first fires
  (2026-09-03, 15:35 and 16:05 UTC) measure it; the fallback is the one
  `PROGRAM-RUNBOOK.md` § The other subscriptions already names —
  recreate in this account's Routines web UI with the repository
  attached, the path its two improvers use today. **[owner]** decides
  which, on that evidence.

---

## 3 · Session 2 — the axes program, the theory lanes, the doc sweep, the night shift

**Account** `a571fec5-de26-4cd4-96d6-6b39579609f1` ·
**environment** `env_013gTXHYYHNaKBiWe8c4gmtd` ·
**verified** 2026-09-02 10:18 UTC against `list_triggers`, **seventeen**
Routines, every one enabled, none suspended, none ended.

Sixteen of them are the ones this section carried as a transcription
until this block replaced it: every id it named and every slot it
summarised is confirmed below, unchanged. The seventeenth is the night
shift, which stood in §4 as a third subscription's Routine and is on
this account — the correction is under the tables, and it is why §4 now
has no rows.

### The axes program — three lanes, one run log (issue #290)

| Routine | Trigger id | Schedule (UTC) | Binding | Writes | Merge |
| --- | --- | --- | --- | --- | --- |
| InSight axes build lane | `trig_01Hzg91yafFVsa1HsXBcZY9X` | `0 11 * * 2` — Tue 11:00 | Axiom dispatcher `session_01D44Wtdu5JfCYMJmYuKmLjc` → fresh session | `claude/axes-<step>` — one runbook step, its checkbox ticked in the same PR | **never merges** — the skeptic reviews, the owner merges |
| InSight axes skeptic lane | `trig_01JkE1PGWeuGe9GykFnjg1Gh` | `0 11 * * 3` — Wed 11:00, the day after the build | same dispatcher | no branch — PR review comments and a per-PR verdict on #290 | never merges, never approves |
| InSight axes retro lane | `trig_01CT2yRRXZy7DbtUGPyNCB4J` | `0 12 * * 0` — Sun 12:00 | same dispatcher | `claude/axes-retro-<date>` — `docs/` only, and only when the week taught something | **never merges** — the owner, always |

### The theory lanes — twelve, on the orphan `axiom-theory` branch

**Re-paced 2026-09-04 to one run a week each** (D363, the owner:
*"reduce the theory production"*), from D359's four-day cycle and the
every-other-day scheme before that. Twelve runs a week is **1.71 a
day** against 3.0, and at the measured $24.44 a run that is $41.90 a
day against $73.32 — about **$940 a month**. Two things improve
besides the bill. The cycle is a **week**, so it is a weekday cron
(`* * 1` = Monday) rather than day-of-month arithmetic: D359's own
artefacts — a 31st followed by a 1st putting two subject days back to
back, February dropping the tail of the cycle — are gone rather than
halved. And the review lane lands on Sunday, after every lane it
scores has run exactly once, which is the alignment §12 was chartered
to have.

**What it costs.** The old invariant was *a reader works on subject
output at most a day old*; weekly cannot hold that, and the honest
version is what replaces it — **readers run after the subjects in the
same week**, so central on Saturday reads that week's six subject runs
and nothing is ever read a cycle late. Say it that way rather than
repeating the old sentence somewhere it is no longer true.

All twelve dispatch through the Axiom dispatcher into a fresh session,
write the `axiom-theory` branch and nothing else, and never touch
`main`. **The schedules below are the decision, not yet the account
state**: the twelve Routines are on the axiom dispatcher's
subscription, which no session here can reach (`list_triggers` returns
the caller's and nothing else), so applying them is the row on
`OWNER-LIST.md` § Clicks — twelve `update_trigger` calls, schedule
only, from a session on that account.

| Lane | Trigger id | Slot (UTC) | Cron | Day |
| --- | --- | --- | --- | --- |
| Genetic | `trig_01Vx4tmhq3EVwySCjSESjrrW` | 09:02 | `2 9 * * 1` | Monday — subject |
| Body | `trig_01AopNS2HAVVHFYk99w7oJv7` | 10:02 | `2 10 * * 1` | Monday — subject |
| Questions | `trig_01JeVZmgC9FB78L5VRxGQJ9L` | 11:02 | `2 11 * * 2` | Tuesday — subject |
| Tests | `trig_01URyaqWz9WgLdRJVDn6z8hX` | 12:02 | `2 12 * * 2` | Tuesday — subject |
| Ties | `trig_01PjG2bW3zK3GTgnfaYTjQky` | 13:02 | `2 13 * * 3` | Wednesday — subject |
| Interests | `trig_01HUHXnMT6xAiEaurLxeBJNq` | 14:02 | `2 14 * * 3` | Wednesday — subject |
| Database | `trig_01VDccEWW215SDJPE3ujHciL` | 08:02 | `2 8 * * 4` | Thursday — reader |
| Map | `trig_014HZHQYSpjc4xQGfbyAgjXw` | 09:02 | `2 9 * * 4` | Thursday — reader |
| Pattern | `trig_01AsWK9g327DuHD6XatbBAmR` | 10:02 | `2 10 * * 5` | Friday — reader |
| Graph optimizer | `trig_016uPKLAXGriwC7ukQyRRmUG` | 11:02 | `2 11 * * 5` | Friday — reader |
| Central | `trig_017ZfLe6VNmVGZ677qqvkqgm` | 12:02 | `2 12 * * 6` | Saturday — reader, last, so it reads the freshest of everything |
| Review | `trig_01P1aDKgDhab3yLeCrYn3TAt` | 02:02 | `2 2 * * 0` | Sunday — scores the week, feedback lands before Monday |

**The charter's §10 table is the canonical inventory and it has been
wrong since D359** — it still carries the every-other-day crons
(`2 9 1-31/2 * *` and their siblings) that were replaced on 2026-09-03,
because no product-side session may amend a contract on that branch.
`AXIOM-THEORY.md` § The corrections has the amendment to paste and why
it is the owner's to make.

### The doc sweep and the night shift

| Routine | Trigger id | Schedule (UTC) | Binding | Writes | Merge |
| --- | --- | --- | --- | --- | --- |
| InSight doc sweep — **disabled 2026-09-03** | `trig_01E2bBC1QmYbkkHj3V96k6L1` | `17 8 */2 * *` — 08:17, odd days of the month, 50-minute budget | its own dispatcher `session_01NeQGEZcneyKmf5Q4fi4PGj` ("Doc sweep dispatcher") | `claude/doc-sweep-<UTC date>` — only claims a command can recompute; everything else is reported | **never merges** — the owner, always · **held until `docs/DOC-SWEEP.md` is on `main`**: every firing since 2026-08-30 refused correctly and to no effect, which is a guaranteed no-op waking a dispatcher under `ultracode` (D359, `WORKLIST.md`) |
| InSight night shift | `trig_01WdCLF7zBNjqFmTVk15rWhE` | `0 21,23,1,3,5 * * *` — four audit flows at 95 min, the 05:00 firing is the closing flow at 50 | persistent worker `session_013UfS4opexyJsoD3K9NxqFF`, which is where the owner's push authorization lives | `night-YYYYMMDD` — anywhere a verified defect is | never merges, never opens a PR, never pushes `main`; the owner merges or cherry-picks in the morning |

**Contracts.** The axes lanes read `docs/AXES-RUNBOOK.md` on
`origin/main` every run and it outranks the prompt; the theory lanes
read `CHARTER.md` on `axiom-theory` (§10 is their inventory, §12 the
review lane); the doc sweep reads `docs/DOC-SWEEP.md`, which is not on
`main` — see the observation below. The night shift has no product
document at all: its brief is the Routine, and the only thing on `main`
about it is D326 §2, which records the closing flow's shape and not the
audit flows'. Its push authorization is a message the owner sent in the
worker session's own history and it covers exactly `night-*` branches —
never `main`, never a force-push, never a pull request.

**Every one of the seventeen wakes a persistent session — none of them
starts a fresh one directly**, and `list_triggers` shows this as
`persist_session: true` with the session id above. The axes and theory
lanes' dispatcher then forwards the prompt verbatim into a fresh session
with the provisioning tools pre-approved, because a cron-spawned session
carries no MCP tool grants and the `add_repo` provisioning step stalls
at a permission prompt nobody answers (`AXES-RUNBOOK.md` § The
account-side inventory has that measurement and its ~$65 of
diagnostics). The doc sweep was given a second dispatcher rather than a
slot on the first: the Axiom dispatcher was once found failed on its own
rate limit, and a shared dispatcher makes one lane's rate limit every
lane's outage — the reasoning §5's account budget picks up. The night
shift is the exception to the whole pattern. It does not dispatch; it
**is** the worker, woken five times a night in the same container so
each flow continues where the last one stopped, which is also why its
authorization can live in that session's history at all.

### The four ops lanes — created after this block's verification

Created 2026-09-02 19:55–20:05 UTC, so the seventeen above do not include
them, and re-created 2026-09-03 against a dispatcher that starts empty
(D359). Their contracts are `OPS-RUNBOOK.md` §§ The PR shepherd, The list
worker, The roll call, The production reader.

| Routine | Trigger id | Schedule (UTC) | Binding | State |
| --- | --- | --- | --- | --- |
| InSight PR shepherd (B) | `trig_01MuYGKG82KdEXnqNuXkdviz` | `55 */3 * * *` — eight a day, from twenty-four | ops dispatcher B `session_01XhD4kBN7fXgeBdFPZEyPY6` (`claude-haiku-4-5`) → fresh session | enabled |
| InSight list worker (B) | `trig_01VH8PvZCaqKciAwzpxmfMYW` | `0 17 * * *` | same dispatcher | enabled |
| InSight roll call (B) | `trig_017cQ4WECG5mHeFGFnmkVrYQ` | `30 15 * * *` | same dispatcher | **disabled** — § The roll call forbids a dispatcher binding and that is the only one a session can give it; the owner creates it in the web UI |
| InSight production reader (B) | `trig_01FD7t9MySRfZd19BD9YyEDQ` | `40 6 * * *` | same dispatcher | **retired** — the lane is `.github/workflows/production-reader.yml`, which needs no account bucket |

The four Routines these replace (`trig_01KZYMFk5gUQ1QSFbzhm71FD`,
`trig_019FC9GMebK5Afq3eQQaY2sG`, `trig_01NwV9t6Xh2f6oH5o36DJWGi`,
`trig_011oH9LvFvbcoBtsDooK6t2f`) are **disabled rather than deleted** and
renamed so the list says why; their old dispatcher,
`session_01GfASn8KdwPk3GDHWPtbZ9c`, had reached 564,090 tokens.

### Corrections and observations, 2026-09-03

- **This block's own sentence was the finding.** *"Every one of the
  seventeen wakes a persistent session — none of them starts a fresh one
  directly"* is true, and priced it is where the money went: against list
  pricing the account's 90 metered sessions split **54% cache read, 23%
  cache write, 8% fresh input, 16% output**. A cold 564k prefix costs
  564,090 × $5/MTok × 1.25 = **$3.53** to re-cache, against ~$4 measured
  per firing — so a relay that had adopted nothing and relayed nothing was
  the second most expensive thing on the account. `USAGE-REDUCTION.md` is
  the arithmetic; D359 is the record.
- **The night shift is the largest single line in the program.**
  `session_013UfS4opexyJsoD3K9NxqFF` has metered **$2,325.68** since
  2026-08-24 against 968.8M cache-read tokens — two thirds of everything
  routine-side on this account — precisely *because* it is the exception
  this block describes: the worker woken five times a night in the same
  container, so every flow re-reads every earlier flow. Rotating it is an
  `OWNER-LIST.md` decision and not a routine's, because the push
  authorization lives in that session's own history (D326 §2) and a new
  session does not inherit it.
- **Re-verified 2026-09-03 15:45 UTC against `list_triggers`:** **18
  enabled Routines firing 17.43 times a day**, down from 21 firing 38.98,
  plus five disabled and kept for their history. The counts moved by
  cadence and binding only; no lane's work changed.
- **A stored prompt cannot be edited from another session.**
  `update_trigger` refuses it — *"not your own"* includes a dispatcher the
  calling session created itself — so cadence, name and enabled state are
  editable from here and a prompt is not. That is why the list worker was
  delete-and-recreated to carry the cheap gate and the axes skeptic's
  prompt is an owner click. `OPS-RUNBOOK.md` § Platform measurements has
  the row.

### Corrections and observations, 2026-09-02

- **The night shift is this account's, not a third's — §4's premise was
  wrong.** All seventeen triggers carry creator account
  `a571fec5-de26-4cd4-96d6-6b39579609f1` and environment
  `env_013gTXHYYHNaKBiWe8c4gmtd`, the night shift among them, and the
  worker session it binds to stands in that same environment. §4 read it
  as a third subscription's on the strength of night shift B's brief
  calling it *"another subscription, another container"* — which is true
  from §2's side and one account too far: from there, this account **is**
  another subscription. Two accounts run Routines against this
  repository on today's evidence, not three.
- **`list_triggers` carries no model field — the model belongs to the
  bound session.** Every one of the seventeen binds to a persistent
  session, so the model is that session's and has to be read
  with `get_session` on the binding: the Axiom dispatcher records
  `configured_model: claude-fable-5` with `session_context.model:
  claude-fable-5-1` (switched, which is the move
  `claude/fable-5-to-5.1-routines-xwukwp` records), the doc sweep
  dispatcher `opus` at effort max, the night worker `claude-opus-5` at
  effort xhigh with ultracode on. `AXES-RUNBOOK.md` on `main` still reads
  `claude-fable-5`, which is the creation-time value; the correction —
  the owner's 2026-09-01 direction, the dispatcher switched that evening,
  the database lane of 2026-09-02 08:02 UTC the first run created on 5.1
  — is written and unmerged on `claude/fable-5-to-5.1-routines-xwukwp`,
  which is the doc sweep's own shape one document over. Rule 2 one field
  over: a model read off a runbook, a prompt or a creation is a belief,
  and the bound session is what runs.
- **The doc sweep has fired every other day since 2026-08-30 and
  correctly done nothing.** Its prompt sends it to `docs/DOC-SWEEP.md`
  on `origin/main` and forbids improvising a procedure if that file is
  missing — an unattended run inventing its own doc-editing rules being
  the failure the lane exists to avoid. The file is still only on
  `claude/doc-sweep-contract-2026-08-31` (PR #335, open). So this
  account carries §2's now-lane failure in its own shape: a Routine
  scheduled ahead of its contract, firing correctly into a no-op. Both
  verified accounts carry one.
- **`CHARTER.md` §10 matched `list_triggers` exactly** — twelve ids,
  twelve slots, no drift, against the three retired ids §2 found in
  `QUESTION-FARM.md`'s five-row table. The difference is not diligence:
  those three changed because the Routines were **recreated**, and a
  recreated Routine takes a new id where a re-paced one keeps it. An
  inventory is therefore only as current as the last recreation nobody
  wrote down — which is the whole of rule 2, and why every id on this
  page is quoted from the tool response rather than from the runbook
  that also holds it.
- **"Every other day" is true inside a month and not across one.**
  `1-31/2` and `*/2` are odd days of the month and `2-30/2` even ones,
  and both restart at the 1st: the odd-date lanes fired 2026-08-31 and
  again 2026-09-01, two days running, and the even-date lanes went from
  08-30 to 09-02 with three days between. Computed, not read off the
  cron. It matters for the clock in §5 — the theory lanes double up on
  the first of a month following a 31-day one, and the review lane
  doubles with them.

---

## 4 · Session 3 — the block nobody has claimed

The night shift stood here as a third subscription's Routine. It is
session 2's, measured against the account that owns it (§3's
corrections), so this section has no rows.

**That is not evidence the third subscription runs nothing.** No session
can read another account's Routines, so a Routine on a third account is
invisible to both verified blocks above exactly as §2's nine were
invisible to §3's account and §3's seventeen to §2's. What is measured
is narrower than it looks: every Routine either account can see belongs
to one of those two. **Whoever owns a third: write this block** — §2 and §3 are the
shape, and rule 2 is how you fill it.

**And a third account is now attested, though not by any reading either
verified block could do.** `docs/OPS-RUNBOOK.md`'s eight ops lanes were
written with every inventory row a dash, and its Status line still says
none of them exists — but the owner's word, 2026-09-02, is that they
were created from another Claude session, and `PROGRAM-RUNBOOK.md`
(D352) then chartered six more lanes on an account it calls **Claude
3**. §5 is what could be written down about them without their ids.
This section stays empty because it is an account block and no account
here can fill it; §5 is the contract-side record that stands in the
meantime. Whichever account owns them registers them here, in the same
PR that creates one (rule 6).

---

## 5 · The ops and program lanes — chartered, part-created, and relaying nothing

**Corrected 2026-09-02 evening, and the correction is the point.** This
section first read *"live on an account this one cannot see"* on the
owner's word that the ops Routines existed. D353 and PR #364 say what
that word actually covered: **four** ops lanes were created on Claude 2
— the roll call, the production reader, the release recorder and the
list worker — bound to an ops dispatcher session
(`session_01RQvTPyNEFgX5yNUPqkDPnS`). **The PR shepherd is not among
them.** So this section previously told a reader the shepherd was live
and gave its next fire time; that was wrong, and the label on PR #365
has had nothing to act on it from the first minute. PR #364 has since
filled four rows of `OPS-RUNBOOK.md`'s inventory with real ids and
written the reason into the rest: **three lanes could not be created
from a session at all** — the shepherd, the pulse responder and the
dependency shepherd were refused by the permission classifier, and are
the owner's to create in Claude 2's web UI.

The lesson is rule 2's, one rung up: **the owner's word establishes that
a Routine exists, not which one.** Only `list_triggers` from the owning
account settles that, and no account here can run it against Claude 2 or
Claude 3.

What follows is `OPS-RUNBOOK.md` §1 and `PROGRAM-RUNBOOK.md` § The lanes
reproduced — the contracts, not the account state — so a session that
meets one of these lanes knows what it has met.

Ids below are transcribed from `OPS-RUNBOOK.md`'s inventory, not read
from `list_triggers` — rule 2 is unsatisfiable from here, and a
transcribed id is a belief about the tree rather than about the account.

| Lane | Trigger id | Fires (UTC) | Merge authority |
| --- | --- | --- | --- |
| **PR shepherd** | **none — refused from a session; the owner's to create in the web UI** | `20 6,16 * * *`, plus GitHub `pull_request` events — opened, ready_for_review, reopened, **labeled**, closed-and-merged, base `main` | **the only lane in this register that may merge engineering** — squash, only on green, only a PR the owner approved, only while the grant is intact |
| Roll call | `trig_01PBouXe7Frg5FmrmPJQ2ZKj` | `30 15 * * *` | none — read-only |
| Production reader | `trig_01TPdViy5b8ZunttN4RUuHbX` | `40 6 * * *` | none — read-only |
| List worker | `trig_01USe4xEhJ57MRjgThykdRzM` | `0 17 * * *` | never |
| Release recorder | `trig_01Vr2QLmWAGBaBsnT6yTusnr` | API, from `ios-release.yml` — poke-only until its API trigger is added in the web UI | never |
| Dependency shepherd | none — same refusal | `30 8 * * 1` — Mondays | never, absent a dated grant in its own contract |
| Pulse responder | none — same refusal | API, from `pulse.yml` when the operator gate is red | never |
| Platform probe | none — the owner's, in the web UI | one-off, Run now | never |

Four exist and are bound to the ops dispatcher; four do not, and each of
those four says why in its own row rather than leaving a reader to
guess. That is the shape this register asks for, arriving in the runbook
first.

Six more were chartered on the same account the same day, by D352's
`PROGRAM-RUNBOOK.md` § The lanes, every inventory row a dash:

| Lane | Fires (UTC) | Model | Merge authority |
| --- | --- | --- | --- |
| The axiom builder | `30 6 * * *` (D363; `30 6,12,18 * * *` until then) | `claude-fable-5-1` orchestrating | never |
| The console keeper | `45 5 * * *`, `45 17 * * *` | `claude-sonnet-5` | n/a |
| The console improver | `0 14 * * 0` | `claude-fable-5-1` | never |
| The to-do doer (Claude 3) | `0 18 * * *` | the list worker's | never |
| Twelve theory lanes, second set | opposite days, once phase 4 lands | the charter's | lands on `axiom-theory` |

The console workflow is the one piece of the program with no account at
all — GitHub Actions running `scripts/console.mjs` — so it is the only
lane in this register any session can read the state of directly.

**How to tell whether the rest are firing**, since no session here can
read their trigger state. The ops program's run log is one issue titled
**Ops run log**, created by the first lane that needs it — the doc
sweep's precedent, issue #336. At **17:45 UTC on 2026-09-02** it still
does not exist, and neither does `no-shepherd`, the label
`OPS-RUNBOOK.md` §2.7 pairs with `merge-when-green`; the PR shepherd's
06:20 and 16:20 slots have both passed with no comment on either
labelled PR. On traces alone, no ops lane has completed a run.

**And the reason is written down rather than invisible**, which is the
whole point of the exercise. **Both dispatchers refused their charters
on the same day, independently, for the same reason** — a standing
instruction that arrives through automation is one the session cannot
verify, so it should refuse it (D353). Everything bound to either is
therefore a Routine that exists and has never run:

- **The ops dispatcher** (Claude 2) refused, and the roll call fired
  into it at 15:30 and was refused too. Four lanes bound, nothing
  relayed, and no run-log line saying so — because a lane that never
  starts writes nothing.
- **The program dispatcher** (Claude 3) refused the same shape the same
  day, so the **merge shift** and four siblings relayed nothing either
  (the shift itself was deleted at D363; the siblings were re-bound to a
  planning session on 2026-09-03).
- **The GitHub merge tool** has never been approved in the ops
  dispatcher's own history, so even once it relays, the shepherd could
  not merge (`OPS-RUNBOOK.md` §2.3) — and the shepherd has not been
  created at all.

D353's fix is structural rather than another instruction: the charter
moves into `OPS-RUNBOOK.md` § The ops dispatcher, where a session can
**verify it against the repository** instead of trusting a prompt. The
remaining clicks are on `OWNER-LIST.md`, one line each, plus one open
question — whether to retire the dispatcher hop entirely for the web-UI
path, where a Routine starts cloned and needs no relay.

So: chartered, part-created, correctly idle, and saying why. That last
part is the state the farm's issue #31 was created to make legible, and
it arrived here through the owner list rather than a run log. A reader
with only the traces would have concluded the opposite — and a reader
with only the owner's word, as this section shows, concluded something
wrong in the other direction.

**One measurement, taken while labelling PR #365.** Applying
`merge-when-green` through the GitHub API **created the label** — default
grey, no description. `OPS-RUNBOOK.md` §2.7's "GitHub applies only labels
that exist, and no lane creates one" is false for that path: a lane that
typos a label name creates the typo instead of failing. The sentence's
instruction (no lane applies a label) is untouched; its factual half is
not. It belongs as a row in that file's § Platform measurements, which is
its owner's table to write.

---

## 6 · The shared-resource map

Three things every account writes to and the rule that keeps them from
colliding, plus the one resource that does not cross an account line at
all.

### The clock (UTC)

```
00 ·  night B audit 00:00–01:35 · nightly algorithm improvement 00:04 → 03:00
01 ·  night shift A audit 01:00–02:35
02 ·  night B audit 02:00–03:35 · theory review 02:02 (odd)
03 ·  night shift A audit 03:00–04:35
04 ·  night B closing 04:00–05:50
05 ·  night shift A closing 05:00–05:50 · console keeper 05:45
06 ·  PR shepherd 06:20 · axiom builder 06:30 · production reader 06:40
07 ·  question farm 07:00
08 ·  catalog question · DB scalability 08:00 → 12:00 · theory database 08:02 (Thu) · doc sweep 08:17 (odd) · dependency shepherd 08:30 (Mon)
09 ·  learn lane (Mon/Thu) 09:00 · theory genetic (Mon) / map (Thu) 09:02 · feed lane 09:30
10 ·  duel lane (Wed) 10:00 · theory body (Mon) / pattern (Fri) 10:02
11 ·  now lane 11:00 · axes build (Tue) / skeptic (Wed) 11:00 · theory questions (Tue) / graph optimizer (Fri) 11:02
12 ·  axes retro (Sun) 12:00 · theory tests (Tue) / central (Sat) 12:02
13 ·  theory ties 13:02 (Wed)
14 ·  console improver 14:00 (Sun) · theory interests 14:02 (Wed)
15 ·  roll call 15:30
16 ·  PR shepherd 16:20
17 ·  list worker 17:00 · console keeper 17:45
18 ·  to-do doer (Claude 3) 18:00
20 ·  night B audit 20:00–21:35            ── main's busiest merge hour
21 ·  night shift A audit 21:00–22:35
22 ·  night B audit 22:00–23:35
23 ·  night shift A audit 23:00–00:35
```

Read the theory hours with § The theory lanes' week beside them: since
D363 each lane runs **once a week**, on the weekday named in brackets,
and the review lane takes Sunday 02:02. At most two theory runs land on
any day, against three under D359's four-day cycle and six under the
every-other-day scheme before it.

The two night shifts interleave on the hour by design — A on odd hours,
B on even — so neither is ever mid-flow alone with a stale view of the
other's work. Everything else is stacked rather than scheduled against
anything: the 08:00–09:30 window can carry eight firings across three
accounts, and the only ones that can see each other are the ones sharing
session 1's bound dev session. D352's merge shift added a firing every
second hour on top of that — the densest lane the page ever carried, and
the one most likely to meet another mid-push. D363 deleted it: the clock
above is what is left, and no hour now carries more than one Claude 3
lane.

### The account budget — the resource that does not cross

Rate limits are per **account**, not per session and not per Routine: the
seven-day window this session read on 2026-09-02 is the same window to
the second — same `resetsAt`, same `allowed_warning` — that the Axiom
dispatcher reports. One bucket behind seventeen Routines, a night worker
running at xhigh with ultracode on, and every interactive session on the
account. Session 1's nine draw on a different bucket, and neither account
can spend the other's.

The two consequences point opposite ways. **Inside** an account an
expensive lane throttles its siblings — the night worker's session record
carries $2,105 of cumulative metered work against the same limit the axes
program dispatches through, which is the argument that gave the doc sweep
a second dispatcher instead of a slot on the first. **Across** accounts
the budget is the one thing on this page that cannot collide: two
accounts firing into the same hour cost each other nothing but merge
conflicts, so the clock above is about `main`, never about capacity.

### Branch namespaces

| Prefix | Owner | Rule |
| --- | --- | --- |
| `claude/<lane>-<date>` | session 1 content lanes | one branch per lane per day; roll up onto the open one rather than stacking |
| `claude/daily-algorithm-improvement-bnogf6`, `claude/daily-database-optimization-j03rdh` | session 1 improvers | long-lived, one per Routine; restart from `origin/main` after their PR merges |
| `nightb-YYYYMMDD` | session 1 night shift B | never `night-*`, never `main` |
| `night-YYYYMMDD` | session 2 night shift | never `nightb-*`, never `main` |
| `claude/axes-*` | session 2 axes program | one per step; `claude/axes-retro-<date>` for the Sunday digest's amendments |
| `claude/doc-sweep-*` | session 2 doc sweep | one per run, dated UTC |
| `claude/*-diag-<date>` | session 2 axes, doc sweep | the report fallback when a GitHub write is refused — `AXES-DIAG.md`, `DOC-SWEEP-DIAG.md` |
| `axiom-theory` | session 2 theory lanes | orphan branch; never `main` |

`nightb-*` does not match the glob `night-*`, which is what keeps either
shift's branch enumeration from sweeping in the other's. `night-YYYYMMDD-b`
would have; `night-YYYYMMDD/b` is refused by the remote as a ref
conflict. Any new account picks a prefix that collides with neither.

### Merge authority

Four tiers, and they do not transfer between programs:

- **Self-merge**: the six content lanes — the farm's five plus the now
  lane (D212 — the gates are the review). Squash, only on green, never a re-run to outwait
  a real failure.
- **Never merges, owner opens the PR**: both session 1 improvers, and
  both night shifts — they push a branch and stop.
- **Never merges, a reviewer first**: the axes program (skeptic, then
  owner) and every theory lane (their branch is not `main` at all).
- **Opens its own PR, never merges**: the doc sweep — one branch, one PR
  a run, and the owner merges every time.

**The merge nobody here performs is the owner's, and since D363 it runs
through two hands rather than three.** D352 rewrote the door the same
afternoon `OPS-RUNBOOK.md` described it and put the merge shift in the
middle; D363 took the shift out again, so read the chain rather than any
file's older half:

1. **The owner ticks a row** in `docs/MERGE-LIST.md`. That tick is the
   decision, and it is the only step that is theirs.
2. **The console workflow** — GitHub Actions, no account — mirrors the
   tick to the label **`merge-when-green`**.
3. **The PR shepherd** squash-merges under its five steps, unchanged:
   armed at a named sha, every commit it makes on the branch prefixed
   `shepherd:`, and the grant spent the moment anyone else pushes after
   arming.

**The rule that a lane may never apply the label is retired**, in the
owner's words — *"this is wrong, the shepherd can"* — and what replaced
the shift's step is not a lane at all: a workflow mirroring a tick makes
no judgement. What did not move is that no lane decides: the tick is
upstream of every label, and a label applied without one is a lane
acting outside its contract.

`merge-when-green` on a PR predating D352 was the owner's own act under
the older rule and still means what it meant. Whoever creates the PR
shepherd inherits every PR already carrying one — a label is a standing
instruction, not an event.

### The three collision rules

1. **Read the other shift's branch before auditing anything.** Two
   branches carrying two different fixes for one bug is the failure this
   costs one command to prevent — night shift B's brief already carries
   it, and it is the rule that generalizes furthest across accounts.
2. **Cut from `origin/main`, and expect it to have moved.** 20:00 UTC is
   main's busiest merge hour, measured over the last 120 merges, and
   01:00–05:00 is dead. A base cut at 20:00 can be stale within minutes.
3. **Never push to a branch you did not create**, and never to `main`.
   The only shared write is a merge, and this section's merge-authority
   list says who may make one.

---

## 7 · Updating this file

Adding, rebinding, re-pacing or retiring a Routine is a change to your
own block, in the same PR as whatever else the change touches. Verify
with `list_triggers` first, and quote the id from the tool response
rather than from a prompt or from memory. If your Routine has a contract
document, this file cites it — it does not copy it, and a lane's
behaviour still changes by PR to its own contract.

`check:docs` holds this file to `ORIENTATION.md`'s map and its own status
declaration. Nothing gates the rows themselves: a Routine is account-side
state, so no command in this tree can recompute one, which is exactly why
rule 2 says verify and rule 4 says leave another account's rows alone.

---

## 7 · The overview — one sentence per routine

What each routine does and for whom, beside the rows above that say when
it fires and what it writes. `PROGRAM-RUNBOOK.md` phase 5.3 asks for this
section so the console's routine list has prose to draw rather than a
schedule to paraphrase. Every account extends it under the same rules as
the blocks: you write your own account's lines and leave the others
alone, and a line lands in the same PR as the Routine it describes. It is
seeded here with the two lanes this PR created; the rest are their
owners' to write.

**Session 1 — the program lanes (§2)**

- **InSight list worker (Claude 1)** — works the owner's to-do list for
  this subscription: each afternoon it takes the topmost item tagged
  `[claude-1]` in `docs/WORKLIST.md`, ships that one item as one pull
  request, and parks anything it would have to guess at as an ask in
  `docs/OWNER-LIST.md` rather than building it narrower. For the owner,
  who asked to work on lists instead of on the things in them.
- **InSight roll call (Claude 1)** — reports whether this account's
  Routines actually fired, how late they were, and what they cost, as one
  comment a day on the **Ops run log** issue, with a prompt-drift ledger
  on Sundays. It writes nothing else and changes nothing. For the other
  two subscriptions, which cannot see this account's Routines at all, and
  for the console that joins the three.

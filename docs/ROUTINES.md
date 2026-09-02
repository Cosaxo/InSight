# The routine register — every scheduled run, across every subscription

> **Status:** tree — every row below is a Routine that exists on
> somebody's account right now. All three blocks were verified against
> the live account that owns them on 2026-09-02: §2 nine Routines, §3
> seventeen, §4 none. Nothing here is proposed.

**Why this file exists.** Three claude.ai subscriptions work on this one
repository, two of them running scheduled Routines against it, and **no
session can see another account's Routines.** `list_triggers` returns the calling account's and
nothing else — measured, not assumed: run from the account in §2 on
2026-09-02 it returned nine Routines and omitted every lane in §3, all of
which demonstrably fired within the previous twenty-four hours
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

**What this file does not replace.** Three per-program inventories
already exist and each stays canonical for its own lanes' *contracts*:
`QUESTION-FARM.md` § Scheduled runs (the content lanes), `AXES-RUNBOOK.md`
§ The account-side inventory (the axes program), and `CHARTER.md` §10 on
the `axiom-theory` branch (the theory lanes). This is the index across
them plus the shared-resource map (§5) that none of them could hold
alone — a per-program table cannot see a collision with another program,
which is exactly what three subscriptions produce.

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
**verified** 2026-09-02 09:46 UTC against `list_triggers`, nine
Routines, all enabled.

| Routine | Trigger id | Schedule (UTC) | Binding | Writes | Merge |
| --- | --- | --- | --- | --- | --- |
| Nightly algorithm improvement | `trig_014pyAWbLMVoXLY7pg6meo5i` | `4 0 * * *` — daily 00:04, hard stop 03:00 (02:00–05:00 Oslo) | fresh session, model `claude-fable-5-1` | `claude/daily-algorithm-improvement-bnogf6` — generation and personalization algorithms | no PR — the owner opens it |
| InSight question farm (daily) | `trig_01XJqk3xyNicWH9uMG5kz8Lh` | `0 7 * * *` — daily 07:00 | dev session `session_01AvNkZgRvvMCu8zqhZtuMH5` | `claude/question-farm-<date>` — `content/daily-questions.json` | self-merge (D212) |
| Daily catalog question | `trig_014oEnPL1pT26SY6J8hF1hse` | `0 8 * * *` — cards Mon–Sat, a new domain catalogue Sunday | same dev session | `claude/catalog-question-<date>`, domains `claude/catalog-domain-<name>` — `src/v2/spec/pick-data.js`, `public/` | self-merge (D212) |
| InSight DB scalability | `trig_01WSJVxHtUqioRRvSs6pc31E` | `0 8 * * 1-5` — weekdays, hard stop 12:00 (10:00–14:00 Oslo) | fresh session | `claude/daily-database-optimization-j03rdh` — Firestore schema, the aggregation pipeline, client read paths | no PR — the owner opens it |
| InSight learn lane | `trig_015hWsQwfLz4evTeVkN3mtx8` | `0 9 * * 1,4` — Mon + Thu 09:00 | same dev session | `claude/learn-cards-<date>` — `content/learn-questions.json` | self-merge (D212) |
| InSight feed lane | `trig_014BTtkCKwkJqjVmSdnUGGXC` | `30 9 * * *` — daily 09:30 | same dev session | `claude/feed-questions-<date>` — `content/feed-questions.json`, continuum twins in `src/v2/spec/world-feed-data.js` | self-merge (D212) |
| InSight duel lane | `trig_01XNv5D3npQyYhCWoAYX1nr5` | `0 10 * * 3` — Wed 10:00 | same dev session | `claude/duel-questions-<date>` — `content/duel-questions.json` | self-merge (D212) |
| InSight now lane | `trig_0198nBegh1AHFSAPEjbuFcwa` | `0 11 * * *` — daily 11:00 | same dev session | `claude/now-questions-<date>` — `content/feed-questions.json` under `cat: "now"` | self-merge (D212) |
| InSight night shift B | `trig_01GNe14hPrZcYzXkFHjPH2bW` | `0 20,22,0,2,4 * * *` — five flows; 20/22/00/02 audit at 95 min, 04:00 closing at 110 min | worker session `session_01M9cvEjdQmWYjgrWvaoXiK9` | `nightb-YYYYMMDD` — anywhere a verified defect is | never merges; never pushes `main` or `night-*` |

**Contracts.** The five content lanes defer to `QUESTION-FARM.md` and
re-read it every run — the prompt is a summary and the manual outranks
it. The two improvers and night shift B carry their brief in the Routine
itself; night shift B's is the one D326 §2 records as having no product
document at all, and that is still true of both improvers.

**The bound dev session is a shared checkout.** Six of the nine fire into
`session_01AvNkZgRvvMCu8zqhZtuMH5`, which is why the content lanes are
staggered hourly off 07:00: no two runs write to one checkout at once,
and a lane that finds the tree dirty stashes or uses a worktree rather
than racing. Adding a lane on that session means finding it a free hour,
not just a free slot in the day.

### Observations, 2026-09-02

- **`QUESTION-FARM.md` § Scheduled runs was stale in three of its five
  rows.** The farm, learn and feed Routines were recreated 2026-09-02
  09:23–09:24 UTC and carry new ids; the table still named the retired
  ones (`trig_01STD1dK…`, `trig_01GtTNhR…`, `trig_011g1ZFh…`). Corrected
  in the same commit that created this file — the ids above are the
  verified ones. This is rule 2 in the act: nothing in the tree could see
  the drift, because a trigger id is not a figure `check:figures` can
  recompute.
- **The same three prompts have moved ahead of their canonical blocks,
  and that is NOT corrected here.** Diffing the live prompts against
  `QUESTION-FARM.md`'s fenced blocks: all three now allocate against a
  per-topic floor with no stock ceiling, citing a **D342** that on `main`
  is a different record (the fake-account chain), and `scripts/feed-budget.mjs`
  still implements the levelling the old blocks describe. So the swap is
  ahead of both the manual and the scripts. Reconciling it is a change to
  a lane's contract and belongs to whoever made the swap — flagged here
  under rule 4, not edited.
- **The now lane has no contract.** Its prompt sends it to
  `docs/QUESTION-FARM.md § The now lane` on `origin/main` and tells it to
  do nothing and report if that section is missing. The section does not
  exist — not on `main`, not on any branch on `origin`. So the Routine
  has fired daily at 11:00 UTC since 2026-09-01 and correctly no-ops
  every time. It is registered here as live because it is live; writing
  its contract is open work.

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

Six subject lanes on odd UTC dates, five reader lanes on even ones so a
reader always works on subject output at most a day old, and the review
lane six hours ahead of the earliest slot. All twelve dispatch through
the Axiom dispatcher into a fresh session, write the `axiom-theory`
branch and nothing else, and never touch `main`.

| Lane | Trigger id | Slot (UTC) | Dates |
| --- | --- | --- | --- |
| Review | `trig_01P1aDKgDhab3yLeCrYn3TAt` | `2 2 1-31/2 * *` — 02:02 | odd |
| Genetic | `trig_01Vx4tmhq3EVwySCjSESjrrW` | `2 9 1-31/2 * *` — 09:02 | odd |
| Body | `trig_01AopNS2HAVVHFYk99w7oJv7` | `2 10 1-31/2 * *` — 10:02 | odd |
| Questions | `trig_01JeVZmgC9FB78L5VRxGQJ9L` | `2 11 1-31/2 * *` — 11:02 | odd |
| Tests | `trig_01URyaqWz9WgLdRJVDn6z8hX` | `2 12 1-31/2 * *` — 12:02 | odd |
| Ties | `trig_01PjG2bW3zK3GTgnfaYTjQky` | `2 13 1-31/2 * *` — 13:02 | odd |
| Interests | `trig_01HUHXnMT6xAiEaurLxeBJNq` | `2 14 1-31/2 * *` — 14:02 | odd |
| Database | `trig_01VDccEWW215SDJPE3ujHciL` | `2 8 2-30/2 * *` — 08:02 | even |
| Map | `trig_014HZHQYSpjc4xQGfbyAgjXw` | `2 9 2-30/2 * *` — 09:02 | even |
| Pattern | `trig_01AsWK9g327DuHD6XatbBAmR` | `2 10 2-30/2 * *` — 10:02 | even |
| Graph optimizer | `trig_016uPKLAXGriwC7ukQyRRmUG` | `2 11 2-30/2 * *` — 11:02 | even |
| Central | `trig_017ZfLe6VNmVGZ677qqvkqgm` | `2 12 2-30/2 * *` — 12:02 | even |

### The doc sweep and the night shift

| Routine | Trigger id | Schedule (UTC) | Binding | Writes | Merge |
| --- | --- | --- | --- | --- | --- |
| InSight doc sweep | `trig_01E2bBC1QmYbkkHj3V96k6L1` | `17 8 */2 * *` — 08:17, odd days of the month, 50-minute budget | its own dispatcher `session_01NeQGEZcneyKmf5Q4fi4PGj` ("Doc sweep dispatcher") | `claude/doc-sweep-<UTC date>` — only claims a command can recompute; everything else is reported | **never merges** — the owner, always |
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

## 4 · Session 3 — a third subscription, verified, owning nothing

**Account** — not readable from here, see below · **environment**
`env_01LseXT8H9h61eXWkaLZeXxD` · **session**
`session_01TWU3ZeiowfWMqwwZo393Xo` · **verified** 2026-09-02 11:17 UTC
against `list_triggers`: **zero Routines**, none paused, none one-shot,
none ended.

This block is written from inside the third account §3 left it for, and
its answer is a measured null rather than an absence of evidence. Four
readings, all from this session:

- `list_triggers` returns `{"data":[],"has_more":false}`.
- `list_sessions` with `mine: true` returns exactly one session — this
  one, created 2026-09-02 11:15:04 UTC. Nothing has ever run here.
- `list_environments` returns two, both named "Default", both created
  2026-09-02 11:14 UTC: `env_01LseXT8H9h61eXWkaLZeXxD` (this session's)
  and `env_012qd7jiY8GesRC3HRdD5TU3`. **Neither §2's
  `env_01Ri3fw8gD9Py3LmTQ9hTYCL` nor §3's `env_013gTXHYYHNaKBiWe8c4gmtd`
  is in that list**, which is what makes this a third *account* rather
  than a third view of one of the two — an environment list is the
  calling account's own, and this one contains neither registered
  account's environment.
- The rate-limit window this session reports is `five_hour`, not in
  overage, resetting 16:10 UTC. A third bucket, unspent (§5).

**That the zero is worth a block at all** is the file's own argument
running the third way. §3 corrected §4's original premise from its own
side — all seventeen of its triggers carry its account, the night shift
among them. This is the same correction from the side that cannot be a
partial view: an account with no Routines cannot be running the night
shift, or anything else that has ever fired against this repository.
Two accounts run Routines against this repository; the third is this
one, and it runs none.

**The account id is the one field this block cannot fill.** §2 and §3
quote theirs off `list_triggers` rows — the creator account is a field on
a trigger — and a zero-row response has no row to carry it; `get_session`
does not return one either. It becomes quotable the moment this account
owns a Routine, and rule 2 says quote it from the tool response then
rather than assert it now.

### Observations, 2026-09-02

- **Four ops lanes exist as of today and are registered nowhere.** PR
  [#364](https://github.com/Cosaxo/InSight/pull/364), open, records the
  roll call (`trig_01PBouXe7Frg5FmrmPJQ2ZKj`), the production reader
  (`trig_01TPdViy5b8ZunttN4RUuHbX`), the release recorder
  (`trig_01Vr2QLmWAGBaBsnT6yTusnr`) and the list worker
  (`trig_01USe4xEhJ57MRjgThykdRzM`), all created 2026-09-02 and bound to
  an ops dispatcher `session_01RQvTPyNEFgX5yNUPqkDPnS`. **They are not on
  this account** — zero rows, one session, ever — so under rule 1 they
  are §2's or §3's to verify and register, in the block that owns them.
  Named here under rule 4, not transcribed: a row nobody can read the
  live state of is exactly what rule 2 forbids. It is also rule 6's first
  live test — the Routines were created in a PR that registers them in
  `OPS-RUNBOOK.md`'s own inventory and not here, so until that owner
  writes their rows, the register is one program behind the account.
- **The other four ops lanes could not be created from a session at
  all.** Same PR: the permission classifier refused the probe, the PR
  shepherd, the pulse responder and the dependency shepherd, and its
  instruction is to create them in the web UI. That is an owner action
  taken in some account's window, which makes *which account* a
  cross-account question rather than a scheduling one — the first item on
  this page that no single block can answer.
- **This account's capacity is the thing it has that the other two do
  not, and spending it is the owner's call (rule 5).** The arithmetic is
  §5's: a bucket is per account, §3's carries seventeen Routines plus a
  night worker at xhigh with ultracode on, §2's nine plus its own night
  shift, and this one carries nothing. So a lane created here costs no
  existing lane a slot, where the same lane created on §3's account
  competes with the seventeen it would be reading. That is an argument
  for where the four uncreated ops lanes go, not a decision: this file's
  Status is `tree`, registering is not authority to create, and nothing
  in this block creates a Routine.

---

## 5 · The shared-resource map

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
05 ·  night shift A closing 05:00–05:50   ── both morning branches due before 08:00 Oslo
07 ·  question farm
08 ·  catalog question · DB scalability 08:00 → 12:00 · doc sweep 08:17 (odd) · theory readers 08:02 (even)
09 ·  learn lane (Mon/Thu) · feed lane 09:30 · theory 09:02
10 ·  duel lane (Wed) · theory 10:02
11 ·  now lane · axes build (Tue) / skeptic (Wed) · theory 11:02
12 ·  axes retro (Sun) · theory 12:02
13 ·  theory ties 13:02 (odd)
14 ·  theory interests 14:02 (odd)
20 ·  night B audit 20:00–21:35            ── main's busiest merge hour
21 ·  night shift A audit 21:00–22:35
22 ·  night B audit 22:00–23:35
23 ·  night shift A audit 23:00–00:35
```

The two night shifts interleave on the hour by design — A on odd hours,
B on even — so neither is ever mid-flow alone with a stale view of the
other's work. Everything else is stacked rather than scheduled against
anything: the 08:00–09:30 window can carry six firings from two accounts,
and the only ones that can see each other are the three sharing session
1's bound dev session.

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

**The third bucket is unspent** (§4): session 3's account reports a
window of its own — `five_hour`, not in overage — and owns no Routine to
draw on it. An unspent bucket is not a saving, because it cannot be
lent: it is the only capacity on this page that can take a new lane
without slowing an existing one, which is why *which account* a lane is
created on is a question this file has to answer and a schedule cannot.

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
| `claude/<topic>-<slug>` | **any** account's interactive sessions | not a lane namespace and not owned: all three accounts' web sessions cut branches in this shape, and only the UI's random slug keeps them apart. A lane never uses it — a lane's branch says which lane and which day |

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

**The merge nobody here performs is the owner's, and since 2026-09-02 it
has a delegated form.** `OPS-RUNBOOK.md` § The PR shepherd records the
owner's direction: a PR labelled `merge-when-green` is squash-merged by
the PR shepherd once every check on its *current* head has concluded
green, under five steps that keep the decision the owner's — armed at a
named sha, every commit the shepherd makes on the branch prefixed
`shepherd:`, and the grant spent the moment anyone else pushes after
arming. The label is the merge click taken early, not a review waiver,
and the shepherd may never apply it to a PR itself. **Nothing acts on it
yet**: that runbook's § The account-side inventory has no trigger id in
the PR shepherd's row, so a labelled PR waits exactly as an unlabelled
one does until the Routine exists. A label is a standing instruction —
whoever creates that Routine inherits every PR already carrying one.

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

## 6 · Updating this file

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

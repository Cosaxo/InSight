# The routine register — every scheduled run, across every subscription

> **Status:** tree — every row below is a Routine that exists on
> somebody's account right now. §2 and §3 were each verified against the
> live account that owns them, both on 2026-09-02; §4 has no rows and no
> owner yet; §5's lanes are the owner's word plus their contracts, with
> no id readable from any account here. Nothing here is proposed.

**Why this file exists.** Three claude.ai subscriptions work on this one
repository — two of them running Routines that a session here has
verified, the third running the ops and program lanes on the owner's
word (§5) — and **no session can see another account's Routines.** `list_triggers` returns the calling account's and
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
**verified** 2026-09-02 11:07 UTC against `list_triggers`, nine
Routines, all enabled.

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

## 5 · The ops program — live on an account this one cannot see

**Not verified, and not verifiable from here.** The owner's word,
2026-09-02: the ops Routines exist and were created from another Claude
session. `list_triggers` from §2's account does not return them, and
`OPS-RUNBOOK.md` §5's inventory is still every row a dash — so **no
trigger id for any ops lane is recorded anywhere in the tree.** Filling
that table is the owning session's job under rule 1. Until it does, §1
of that file is the whole record, reproduced here so a session that
meets one of these lanes knows what it has met.

| Lane | Fires (UTC) | Model | Merge authority |
| --- | --- | --- | --- |
| **PR shepherd** | `20 6,16 * * *`, plus GitHub `pull_request` events — opened, ready_for_review, reopened, **labeled**, closed-and-merged, base `main` | `claude-opus-5` | **the only lane in this register that may merge engineering** — squash, only on green, only a PR the owner labelled `merge-when-green`, only while the grant is intact |
| Production reader | `40 6 * * *` | `claude-sonnet-5` | none — read-only |
| Dependency shepherd | `30 8 * * 1` — Mondays | `claude-opus-5` | never, absent a dated grant in its own contract |
| Roll call | `30 15 * * *` | `claude-sonnet-5` | none — read-only |
| List worker | `0 17 * * *` | `claude-fable-5-1` orchestrating subagents | never |
| Platform probe | one-off, Run now | `claude-sonnet-5` | never |
| Release recorder | API, from `ios-release.yml` after an upload | `claude-opus-5` | never |
| Pulse responder | API, from `pulse.yml` when the operator gate is red | `claude-opus-5` | never |

Six more were chartered on the same account the same day, by D352's
`PROGRAM-RUNBOOK.md` § The lanes, every inventory row a dash:

| Lane | Fires (UTC) | Model | Merge authority |
| --- | --- | --- | --- |
| **The merge shift** | `15 5,7,9,11,13,15,17,19 * * *` and `15 23 * * *` | `claude-opus-5`, high effort, ultracode | applies `merge-when-green` to a PR the owner approved; never merges |
| The axiom builder | `30 6,12,18 * * *` | `claude-fable-5-1` orchestrating | never |
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
sweep's precedent, issue #336. At **16:35 UTC on 2026-09-02** it still
does not exist, and neither does `no-shepherd`, the label
`OPS-RUNBOOK.md` §2.7 pairs with `merge-when-green`; the PR shepherd's
06:20 and 16:20 slots have both passed with no comment on either
labelled PR. On traces alone, no ops lane has completed a run. That is a
statement about traces and not about the Routines, and it is precisely
the ambiguity the run-log convention exists to remove — the farm's issue
#31 was created because two fires *finished* and left nothing behind,
which made correctly-idle and silently-broken identical from the
repository. Whoever owns these lanes can tell the two apart in one
`list_triggers` call; nobody else can.

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
05 ·  night shift A closing 05:00–05:50 · merge shift 05:15 · console keeper 05:45
06 ·  PR shepherd 06:20 · axiom builder 06:30 · production reader 06:40
07 ·  question farm 07:00 · merge shift 07:15
08 ·  catalog question · DB scalability 08:00 → 12:00 · theory readers 08:02 (even) · doc sweep 08:17 (odd) · dependency shepherd 08:30 (Mon)
09 ·  learn lane (Mon/Thu) 09:00 · theory 09:02 · merge shift 09:15 · feed lane 09:30
10 ·  duel lane (Wed) 10:00 · theory 10:02
11 ·  now lane 11:00 · axes build (Tue) / skeptic (Wed) 11:00 · theory 11:02 · merge shift 11:15
12 ·  axes retro (Sun) 12:00 · theory 12:02
13 ·  theory ties 13:02 (odd) · merge shift 13:15
14 ·  console improver 14:00 (Sun) · theory interests 14:02 (odd)
15 ·  merge shift 15:15 · roll call 15:30
16 ·  PR shepherd 16:20
17 ·  list worker 17:00 · merge shift 17:15 · console keeper 17:45
18 ·  to-do doer (Claude 3) 18:00 · axiom builder 18:30
19 ·  merge shift 19:15
20 ·  night B audit 20:00–21:35            ── main's busiest merge hour
21 ·  night shift A audit 21:00–22:35
22 ·  night B audit 22:00–23:35
23 ·  night shift A audit 23:00–00:35 · merge shift 23:15
```

The two night shifts interleave on the hour by design — A on odd hours,
B on even — so neither is ever mid-flow alone with a stale view of the
other's work. Everything else is stacked rather than scheduled against
anything: the 08:00–09:30 window can carry eight firings across three
accounts, and the only ones that can see each other are the ones sharing
session 1's bound dev session. Since D352 the merge shift adds a firing
every second hour on top, which is the densest lane on the page and the
one most likely to meet another mid-push.

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

**The merge nobody here performs is the owner's, and as of 2026-09-02 it
runs through three hands rather than one.** D352 rewrote the door the
same afternoon `OPS-RUNBOOK.md` described it, so read the chain rather
than either file's older half:

1. **The owner ticks a row** in `docs/MERGE-LIST.md`. That tick is the
   decision, and it is the only step that is theirs.
2. **The console workflow** — GitHub Actions, no account — mirrors the
   tick to the label **`approved`**.
3. **The merge shift** (Claude 3) applies **`merge-when-green`** once the
   PR is green on its current head and it has reviewed the diff as one
   unit.
4. **The PR shepherd** squash-merges under its five steps, unchanged:
   armed at a named sha, every commit it makes on the branch prefixed
   `shepherd:`, and the grant spent the moment anyone else pushes after
   arming.

**The rule that a lane may never apply the label is retired**, in the
owner's words — *"this is wrong, the shepherd can"* — which is why step
3 exists at all. What did not move is that no lane decides: the tick is
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

# The routine register — every scheduled run, across every subscription

> **Status:** tree — every row below is a Routine that exists on
> somebody's account right now. §2 was verified against the live account
> that owns it; §3 and §4 are transcribed from this repo's own records
> and each says which. Nothing here is proposed.

**Why this file exists.** Three claude.ai subscriptions now run scheduled
Routines against this one repository, and **no session can see another
account's Routines.** `list_triggers` returns the calling account's and
nothing else — measured, not assumed: run from the account in §2 on
2026-09-02 it returned nine Routines and omitted every lane in §3 and §4,
all of which demonstrably fired within the previous twenty-four hours
(`origin/axiom-theory` at 09:02 UTC that morning, `origin/night-20260902`
at 05:20). So there is no console anywhere that shows the whole program.
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

---

## 3 · Session 2 — the dispatcher-bound programs

**Not verified from the owning account.** Transcribed from this repo's
own inventories, which are the sessions' own records:
`AXES-RUNBOOK.md` § The account-side inventory, `CHARTER.md` §10 on the
`axiom-theory` branch, and `docs/DOC-SWEEP.md` §2 (which lives on
`claude/doc-sweep-contract-2026-08-31` and has not merged). Grouped here
because all sixteen dispatch the same way in the same environment
`env_013gTXHYYHNaKBiWe8c4gmtd` — evidence they share an account, not
proof. **Whoever owns them: replace this section with a verified block.**

| Group | Routines | Schedule (UTC) | Binding | Writes | Merge |
| --- | --- | --- | --- | --- | --- |
| Axes program | build `trig_01Hzg91yafFVsa1HsXBcZY9X`, skeptic `trig_01JkE1PGWeuGe9GykFnjg1Gh`, retro `trig_01CT2yRRXZy7DbtUGPyNCB4J` | Tue / Wed 11:00, Sun 12:00 | Axiom dispatcher `session_01D44Wtdu5JfCYMJmYuKmLjc` → fresh session | `claude/axes-*` — the step each one names | **never merges** — skeptic, then the owner |
| Theory lanes (twelve) | six subject lanes on odd dates 09:02–14:02, five reader lanes on even dates 08:02–12:02, review `trig_01P1aDKgDhab3yLeCrYn3TAt` at 02:02 on odd dates | ids and slots in `CHARTER.md` §10 | same dispatcher | the orphan `axiom-theory` branch only | lands on `axiom-theory`; never touches `main` |
| Doc sweep | `trig_01E2bBC1QmYbkkHj3V96k6L1` | `17 8 */2 * *` — 08:17, odd days of the month | its own dispatcher `session_01NeQGEZcneyKmf5Q4fi4PGj`, model `opus` | `docs/` claims a command can recompute; reports the rest | **never merges** — the owner, always |

The doc sweep has its own dispatcher deliberately: the Axiom dispatcher
was found failed on its own rate limit, and a shared dispatcher makes one
lane's rate limit every lane's outage. That argument generalizes across
accounts and is the reason §5's clock matters more than it looks.

---

## 4 · Session 3 — the night shift

**Not verified from the owning account.** From D326 §2 and from night
shift B's brief, which names it as another subscription and another
container. **Whoever owns it: replace this section with a verified
block.**

| Routine | Trigger id | Schedule (UTC) | Binding | Writes | Merge |
| --- | --- | --- | --- | --- | --- |
| InSight night shift | `trig_01WdCLF7zBNjqFmTVk15rWhE` | `21/23/01/03/05` — four audit flows at 95 min, a closing flow at 05:00 with a 50-minute budget | a persistent worker session (the owner's push authorization lives in its history) | `night-YYYYMMDD` | never merges — the branch waits for the morning review |

It has no product document; its brief is the Routine. D326 §2 is the
closest thing to a contract on `main`, and it records only the closing
flow's shape, not the audit flows'.

---

## 5 · The shared-resource map

Three things all three accounts write to, and the rule that keeps them
from colliding.

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

### Branch namespaces

| Prefix | Owner | Rule |
| --- | --- | --- |
| `claude/<lane>-<date>` | session 1 content lanes | one branch per lane per day; roll up onto the open one rather than stacking |
| `claude/daily-algorithm-improvement-bnogf6`, `claude/daily-database-optimization-j03rdh` | session 1 improvers | long-lived, one per Routine; restart from `origin/main` after their PR merges |
| `nightb-YYYYMMDD` | session 1 night shift B | never `night-*`, never `main` |
| `night-YYYYMMDD` | session 3 night shift | never `nightb-*`, never `main` |
| `claude/axes-*` | session 2 axes program | one per step |
| `axiom-theory` | session 2 theory lanes | orphan branch; never `main` |

`nightb-*` does not match the glob `night-*`, which is what keeps either
shift's branch enumeration from sweeping in the other's. `night-YYYYMMDD-b`
would have; `night-YYYYMMDD/b` is refused by the remote as a ref
conflict. Any new account picks a prefix that collides with neither.

### Merge authority

Three tiers, and they do not transfer between programs:

- **Self-merge**: the six content lanes — the farm's five plus the now
  lane (D212 — the gates are the review). Squash, only on green, never a re-run to outwait
  a real failure.
- **Never merges, owner opens the PR**: both session 1 improvers, and
  both night shifts — they push a branch and stop.
- **Never merges, a reviewer first**: the axes program (skeptic, then
  owner) and every theory lane (their branch is not `main` at all).

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

# Getting the routine usage down

> **Status: plan only — nothing here is applied.** Every lever below is a
> change to a live Routine's cadence, prompt or model, and
> the routine register's rule 5 is that **cadence and
> trigger mutation stay the owner's**. This file is the arithmetic and the
> ranked list; the owner rules on it, and the rows that need a decision
> are on [`OWNER-LIST.md`](OWNER-LIST.md).

[`COSTS.md`](COSTS.md) and [`COST-REDUCTION.md`](COST-REDUCTION.md) are
about the **bill** — what Firebase charges to serve the app. This is the
other budget: the **account usage** the routine program spends against
three claude.ai subscriptions, which is the resource
the routine register §6 calls *the one that does not cross* — one bucket per
account, shared by every Routine and every interactive session on it.

Written 2026-09-03 from the owner's sentence: *"seems like the routine
burns too much usage, let's plan what we can reduce."*

**`ROUTINES.md` is cited throughout and is not on `main` yet** — the
register of every Routine across the three subscriptions is open as PR
#365. Every row this page takes from it is a row that PR verified
against the account that owns it; where that matters, the sentence says
so.

## 1 · The measurement

**The account is in the warning band, a quarter of the way into its
window.** Read at 2026-09-03 12:08 UTC with `get_session` against this
session — `external_metadata.rate_limit_info`:

    rateLimitType  seven_day
    status         allowed_warning
    isUsingOverage false
    resetsAt       2026-09-08 17:00 UTC

The window it resets on opened 2026-09-01 17:00 UTC. Read at 12:08 on
the 3rd, **26% of the window had elapsed** and the account was already
warning. That is the owner's observation with a number under it, and it
is the only usage figure on this page that was read rather than derived:
this is session 1's account (`env_01Ri3fw8gD9Py3LmTQ9hTYCL` —
`ROUTINES.md` §2). **No session can read another account's limit**, the
same wall that makes the register necessary, so nothing here measures
session 2's bucket. Its shape is inferable from its lane list and is
almost certainly worse: seventeen Routines including a night worker
`ROUTINES.md` §6 records at `$2,105` of cumulative metered work.

**What this account runs.** Eleven recurring Routines, read from
`list_triggers` the same morning — the nine `ROUTINES.md` §2 verified,
plus the roll call and the list worker created since (PR #373). Their
daily arithmetic:

| Lane | Fires/day | Bounded minutes/day | Mode |
| --- | ---: | ---: | --- |
| Night shift B | 5 | **490** (4 × 95 audit + 110 closing) | ultracode fan-out |
| Nightly algorithm improvement | 1 | **176** (00:04 → 03:00 hard stop) | ultracode + Workflow, opus workers |
| DB scalability (weekdays) | 0.7 | **171** (08:00 → 12:00, no stated budget) | single session |
| List worker | 1 | 120 | fable orchestrating subagents |
| Roll call | 1 | 20 | sonnet, read-only |
| Six content lanes | 4.4 | no stated minutes; budget is in *questions* | single session |
| **Total** | **≈13** | **≈977 min = 16.3 h/day** | |

Two lanes — night shift B and the nightly improver — are **68% of the
bounded minutes** and are the only two that run in fan-out mode. One of
them carries the sentence *"token cost is not a constraint"* in its own
brief.

**Program-wide**, from `ROUTINES.md` §§2–5 rather than from any live
read: ≈13 fires/day on this account, ≈16 on session 2 (night shift A's
five, ~6 theory lanes a day, the doc sweep, the axes lanes, four ops
lanes), and ≈16 chartered on Claude 3 of which the merge shift alone is
9 — currently relaying nothing, because both dispatchers refused their
charters (D353). **Claude 3's usage today is approximately zero and its
charter is the largest single planned increase on the page.**

## 2 · Where the usage actually goes

Four shapes, and only the first is about how much work gets done.

### A · Re-auditing to refill a cap

Each night shift runs **four audit flows** and each flow opens with an
independent finder fan-out over the whole tree. The tree between flows
changes only by the night's own commits — later flows continue the
branch rather than re-cutting it — so the second, third and fourth
fan-outs sweep, in the main, the code the first one already swept.

What forces the repeat is written in the brief: **the open list is
capped at 8.** A flow works the list down and stops; the next flow finds
a short list and re-derives. The commits show it exactly. Both shifts on
the night of 2026-09-03, bucketed into their own flow windows:

    night-20260903  (shift A)   8 · 8 · 8 · 8 · 3     = 35 commits
    nightb-20260903 (shift B)   6 · 6 · 6 · 6 · 1     = 25 commits

Four flows, the same number each time. A tree being exhausted does not
produce a flat line; a cap does. **Eight fan-outs a night across two
accounts, to land what one fan-out could have listed.**

The lever is safe in both directions, which is why it leads §3. If the
flows are item-capped, auditing once and fixing four times gives the
same commits for a quarter of the audit cost. If they are time-capped,
the freed 95 minutes go into fixing and the commit count goes **up**.
There is no reading of that table where the fourth fan-out is the thing
producing the commits.

### B · Polling for work that is not there

The merge shift is chartered at `15 5,7,9,11,13,15,17,19,23 * * *` —
**nine firings a day, `claude-opus-5` at high effort with ultracode** —
to notice that the owner ticked a row. GitHub already pushes that fact:
`console.yml` runs on PR label events, and the PR shepherd's own trigger
lists `labeled`. Nine opus fan-out sessions a day are a poll for an
event that has a webhook.

Every polling lane pays the same fixed cost on a fire that finds
nothing: a container, an orientation read, a manual, and a run-log line
saying it did nothing. The doc sweep has been doing exactly this every
other day since 2026-08-30 (`ROUTINES.md` §3) — correctly, because its
contract is not on `main`, and expensively, because it reads its way
there each time.

### C · The per-fire fixed tax, and the copy nobody needed

Almost every canonical prompt opens with *"read `CLAUDE.md` and
`docs/ORIENTATION.md`"*. **`CLAUDE.md` is already in the session's
context** — the harness loads it as project instructions for every
session in this repository, measured in this one. Re-reading it buys a
second copy of ~31 KB, ~8k tokens, on every fire of every lane. At the
program's ~45 fires a day that is a third of a million tokens a day for
nothing at all.

`ORIENTATION.md` (33 KB) is a genuine read, and the manuals are bigger:
a content lane that opens `QUESTION-FARM.md` takes 133 KB — ~33k tokens
before it writes a question. Naming the **section** rather than the file
is the same fix D350 already applied to three prompts for a different
reason.

### D · Effort at the top of the curve, by default

`ROUTINES.md` §3 records night worker A as `claude-opus-5` at effort
**xhigh with ultracode on** — for the whole flow, finder sweep included.
Finding candidates in a codebase is pattern work; deciding whether a
candidate is real, and whether the fix is safe, is not. The Workflow API
takes a model per agent, so the split costs one clause in a prompt.

## 3 · The levers, ranked

Each is stated in the unit of the thing it changes, not as a saving, so
none of them can go stale against a constant that moved — the discipline
`COST-REDUCTION.md` keeps. **None reduces what the program produces**
unless its row says so.

| # | Lever | Unit changed | What it costs in product |
| --- | --- | --- | --- |
| **L1** | **Audit once, fix four times.** Raise the open-item cap to ~32; only the night's first flow runs the finder fan-out; later flows work the list and re-audit only if it empties. Both shifts. | fan-outs per night: **8 → 2** program-wide | none, or negative — see §2A |
| **L2** | **The merge shift stops polling.** Two scheduled sweeps plus a GitHub `labeled` trigger, the shape the PR shepherd already has. | opus+ultracode fires/day: **9 → 2** + events | none; an event beats a two-hour poll on latency |
| **L3** | **Cheap exit before orientation.** Every polling lane's first act is the one read that answers *is there work* — then a run-log line and stop. Merge shift, PR shepherd, list worker, to-do doers, dependency shepherd, pulse responder, doc sweep. | a no-op fire: **full orientation → one call** | none |
| **L4** | **Stop re-reading `CLAUDE.md`.** Replace the opening line with *"`CLAUDE.md` is already in your context; read `ORIENTATION.md` §N if you need the map"*, and name the manual's section rather than the manual. | ~8k tokens × ~45 fires/day | none |
| **L5** | **Finders on sonnet, judgement on opus.** In both night briefs and the nightly improver: sweep agents `{model:'sonnet'}`, verification and the fix on opus. | the fan-out half of every audit | a weaker first pass; the adversarial verify is unchanged and is what earns a line |
| **L6** | **Delete *"token cost is not a constraint"*** from night shift B's brief and state the fan-out width instead (n slices, one verification pass per candidate). | one sentence licensing unbounded spend | none |
| **L7** | **Give the DB scalability lane a budget.** It has a 08:00→12:00 hard stop and no stated minutes; every other lane on the account has one. | minutes/day: **240 → 90** | a shorter run; the lane keeps its slot |
| **L8** | **Stop the two heavy lanes overlapping.** 00:04–01:35 runs the nightly improver *and* night shift B's third audit on one bucket. Move the improver off the night-shift hours. | peak concurrent fan-outs on one account: **2 → 1** | none; same window, different hour |
| **L9** | **Do not double the theory lanes.** `PROGRAM-PLAN.md` §4.3 prices the second set at *twice the month as the twelve cost today*, on session 2's bucket — the one this page cannot read and has the most reason to worry about. | fires/day avoided: **+6 → 0** | the second set's output, which does not exist yet |
| **L10** | **Instrument it.** The roll call already runs daily and already calls `get_session`; one line in its report — `rateLimitType`, `status`, `resetsAt`, and the % of the window elapsed — turns this page's single reading into a series. | one line per day | none |

**Order to apply.** L4, L3, L6 and L10 are prompt text with no product
consequence at all — take them first and together. L1 is the big one and
needs one edit per night brief. L2 needs a trigger change and a workflow
step, so it lands with whoever creates the merge shift. L5, L7 and L8
are one clause each. L9 is a decision not to build.

## 4 · What is the owner's call

`CLAUDE.md`'s *axiom power first* rule (D352) is why this section
exists: **a limit does not get to shrink what the program does** without
the owner saying so. Usage is a limit like any other, so the levers
above are deliberately the ones that keep the output and drop the
repetition — and anything that would actually reduce production is here
instead, as an ask.

1. **Two night shifts, or one?** They audit the same tree on the same
   night from two accounts, and the machinery that keeps them from
   colliding — the branch-glob split, the pre-audit read of the other's
   branch, the closing flow's `merge-tree` probe — is a cost of running
   both. Dropping one frees ~430–490 minutes a day on one bucket. It is
   the largest single cut available and it is a product decision, not
   waste: the output is real (nine of the ten `night-*` branches on
   origin are merged into `main`; both of `nightb-*`'s closed ones are).
   **Recommendation: keep both, apply L1 first, and re-read the band
   after one window.** L1 costs nothing and may make the question moot.
2. **The merge shift's nine firings** — the charter is written and the
   lane relays nothing yet, so L2 is free to take now and expensive to
   take later.
3. **The theory lanes' second set** (L9).
4. **Whether any of this is applied at all**, since the register's rule 5
   puts cadence in the owner's hands and this file does not move it.

## 5 · What this page does not claim

- **It does not say the program is unproductive.** 9.2 PR-shaped merges
  a day landed on `main` over the last 30 days, and the night branches
  merge. The finding is repetition inside productive lanes, not lanes
  that produce nothing.
- **It measures one account.** The band, the eleven Routines and the
  minutes are session 1's. Sessions 2 and 3 are read from `ROUTINES.md`,
  which is a register of contracts and ids, not of spend.
- **It prices nothing in dollars.** The only metered figure anywhere in
  the tree is the `$2,105` `ROUTINES.md` §6 quotes from a session
  record, and one session's cumulative total does not divide into
  lanes.
- **Every minute figure here is a stated budget, not a measurement of
  what a run used.** A lane that stops early spends less; the register
  cannot see it either way. L10 is the fix for that, and until it has
  run for a window this whole page is arithmetic over intentions.

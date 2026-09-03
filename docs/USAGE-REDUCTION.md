# Getting the routine usage down

> **Status: mixed — L1 and L2 were applied on this account 2026-09-03, at
> the owner's word; everything else is proposed.** §6 is what changed,
> what it saves, and the one half a tool refused. The remaining levers
> touch accounts this session cannot reach or wait on a decision, and
> their rows are on [`OWNER-LIST.md`](OWNER-LIST.md). The routine
> register's rule 5 still holds: cadence is the owner's, and nothing here
> moved before they said so.

[`COSTS.md`](COSTS.md) and [`COST-REDUCTION.md`](COST-REDUCTION.md) are
about the **bill** — what Firebase charges to serve the app. This is the
other budget: the **account usage** the routine program spends against
three claude.ai subscriptions, which is the resource the routine
register §6 calls *the one that does not cross* — one bucket per
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
warning. This is session 1's account (`env_01Ri3fw8gD9Py3LmTQ9hTYCL` —
`ROUTINES.md` §2). **No session can read another account's limit**, the
same wall that makes the register necessary, so nothing here measures
session 2's bucket, whose seventeen Routines include a night worker the
register records at `$2,105` of cumulative metered work.

### What each lane actually costs

`get_session` on a lane's bound session returns
`external_metadata.usage` — `cost_usd`, output tokens, cache reads.
**That is the instrument this program has been missing**, and it is why
the table below replaced an earlier draft that ranked lanes by their
*stated budgets*. Two of the three lanes that draft called expensive
turned out to be nearly free, and the gap between the top row and the
bottom is a factor of sixty-five.

| Lane | Session | Measured `cost_usd` | Period | What reached the repo |
| --- | --- | ---: | --- | --- |
| **Night shift B** | `…M9cvEjdQ` (persistent worker) | **$594.66** | since 09-01 19:54 — **two nights, ten flows** | `nightb-*`; 25–35 commits a night, and they merge |
| Six content lanes | `…AvNkZgRv` (shared dev session) | **$160.70** | since **07-30** — 35 days | questions merged daily |
| Nightly algorithm improvement | `…NBfvGuFn` (fresh, per fire) | **$52.64** | **one run**, 09-03, 41 min | **nothing — no branch on origin, no PR ever** |
| DB scalability | `…JHNNtBVV` (fresh, per fire) | **$3.03** | **one run**, 09-03, 11 min | **nothing — no branch on origin, no PR ever** |

Divided out: **night shift B is ~$297 a night** (~$59 a flow), against
**~$4.60 a day for all six content lanes together**. The night shift
spent 3.7× in two nights what the content program spent in five weeks.

Two caveats, because a cumulative total is not a per-run reading. The
night worker's figure covers the whole session — the nights of 09-01
and 09-02, five flows each; per-night is division, not a measurement.
The content session's covers everything since 07-30, the owner's own
turns in it included. Both are `usage.cost_usd` on the session record:
metered work against the subscription's limit, not an invoice.

### The two silent lanes

The nightly improver and the DB scalability lane are the only two on
this account that fire into a **fresh session**, which is also why they
are the only two `list_triggers` records a `last_run` for. Both report
`SUCCEEDED`. Neither has left anything in the repository:

- `claude/daily-algorithm-improvement-bnogf6` — **not on origin.** No
  pull request from that head has ever existed (GitHub search, open and
  closed, `total_count: 0`). No commit on `main` carries the `Next
  night:` line its own brief makes mandatory. The lane was created
  2026-08-27.
- `claude/daily-database-optimization-j03rdh` — **not on origin**, same
  three checks, same answer. Created 2026-08-27.

The 09-03 improver run spent 41 minutes and 578k output tokens to get
there. Its brief does permit a night that ends in an investigation and
no push — but at $52.64 a run and a week without a branch, *permitted*
and *what is happening every night* are two different claims, and
nothing on `main` can tell them apart. What cannot be seen from here is
**why**: that needs the session's own transcript, or a rule that makes
the next run say so on the run log.

### The shape of the day

Eleven recurring Routines on this account (the nine `ROUTINES.md` §2
verified, plus the roll call and list worker from PR #373): ~13 firings
a day. Night shift B is 5 of them and, on the numbers above, the large
majority of the money. Program-wide, from `ROUTINES.md` §§2–5: ≈16
firings a day on session 2 (night shift A's five, ~6 theory lanes, the
doc sweep, the axes lanes, four ops lanes), and ≈16 chartered on Claude
3 of which the merge shift alone is 9 — **currently relaying nothing**,
because both dispatchers refused their charters (D353). Claude 3's usage
today is approximately zero and its charter is the largest planned
increase on the page.

## 2 · Where the usage goes

Four shapes. The first is where the money is.

### A · Re-auditing to refill a cap

Each night shift runs **four audit flows**, and each opens with an
independent finder fan-out over the whole tree. The tree between flows
changes only by the night's own commits — later flows continue the
branch rather than re-cutting it — so the second, third and fourth
fan-outs sweep, in the main, code the first one already swept.

What forces the repeat is written in the brief: **the open list is
capped at 8.** A flow works it down and stops; the next flow finds a
short list and re-derives. The commits show it. Both shifts on the night
of 2026-09-03, bucketed into their own flow windows:

    night-20260903  (shift A)   8 · 8 · 8 · 8 · 3     = 35 commits
    nightb-20260903 (shift B)   6 · 6 · 6 · 6 · 1     = 25 commits

Four flows, the same number each time. A tree being exhausted does not
produce a flat line; a cap does. **Eight fan-outs a night across two
accounts, to land what one fan-out could have listed** — at ~$59 a flow
on the one account that can be measured.

The lever is safe in both directions, which is why it leads §3. If the
flows are item-capped, auditing once and fixing four times gives the
same commits for a quarter of the audit cost. If they are time-capped,
the freed 95 minutes go into fixing and the commit count goes **up**.
There is no reading of that table where the fourth fan-out is the thing
producing the commits.

### B · Spending without delivering

The two silent lanes above. This is not usage that buys less than it
costs; it is usage that has bought nothing the repository can see, for a
week, at ~$1,600 a month for the pair. It is also the one reduction on
this page that cannot cost any product, because there is no product to
lose — only the possibility that the lane starts working later.

### C · Polling for work that is not there

The merge shift is chartered at `15 5,7,9,11,13,15,17,19,23 * * *` —
**nine firings a day, `claude-opus-5` at high effort with ultracode** —
to notice that the owner ticked a row. GitHub already pushes that fact:
`console.yml` runs on PR label events, and the PR shepherd's own trigger
lists `labeled`. Nine opus fan-out sessions a day are a poll for an
event that has a webhook. Every polling lane also pays a fixed cost on a
fire that finds nothing — the doc sweep has been doing exactly that
every other day since 2026-08-30 (`ROUTINES.md` §3), correctly, because
its contract is not on `main`, and expensively, because it reads its way
there each time.

### D · The per-fire fixed tax, and effort by default

Almost every canonical prompt opens with *"read `CLAUDE.md` and
`docs/ORIENTATION.md`"*. **`CLAUDE.md` is already in the session's
context** — the harness loads it as project instructions for every
session in this repository, measured in this one. Re-reading it buys a
second copy of ~31 KB on every fire of every lane, and on a long
session it is re-read through the cache on every turn: the night
worker's record shows **764 M cache-read tokens** across two nights, so
what sits in that context is not a rounding error. `ORIENTATION.md` (33
KB) is a real read; the manuals are bigger — a content lane that opens
`QUESTION-FARM.md` takes 133 KB. Naming the **section** rather than the
file is the fix D350 already applied to three prompts for a different
reason.

And the effort dial sits at the top by default: the night worker runs
`claude-opus-5` at **effort max**, its sibling on the other account at
xhigh with ultracode, for the whole flow — finder sweep included.
Finding candidates in a codebase is pattern work; deciding whether one
is real, and whether the fix is safe, is not. The Workflow API takes a
model per agent, so the split costs one clause in a prompt.

## 3 · The levers, ranked

Ranked by measured dollars saved per unit of product lost. **None of
them reduces what the program produces** unless its row says so.

| # | Lever | Measured effect | What it costs in product |
| --- | --- | --- | --- |
| **L1** | **Night shift B: audit once, fix four times.** Raise the open-item cap to ~32; only the night's first flow runs the finder fan-out; later flows work the list and re-audit only if it empties. Fold five flows into three — audit, fix, closing. | ~$297/night → **~$140** on the measured account; **~$4,700/month** | none, or negative — §2A |
| **L2** | **The two silent lanes: disable, or make them report.** Nothing has reached the repo from either since 2026-08-27. | **~$1,600/month**, at zero output | none that is visible; the risk is switching off a lane that was about to work — which the reporting rule answers instead |
| **L3** | **Same edit as L1 to night shift A** (session 2, the owner's). Its worker is the one the register prices at `$2,105` cumulative. | not readable from here; same shape | none |
| **L4** | **The merge shift stops polling.** Two scheduled sweeps plus a GitHub `labeled` trigger — the shape the PR shepherd already has. Free to take now: the lane relays nothing yet. | avoids 7 opus+ultracode fires/day before they start | none; an event beats a two-hour poll on latency |
| **L5** | **Finders on sonnet, judgement on opus**, in both night briefs. Sweep agents `{model:'sonnet'}`, verification and the fix on opus. | the fan-out half of every remaining audit | a weaker first pass; the adversarial verify is unchanged and is what earns a line |
| **L6** | **Stop re-reading `CLAUDE.md`**, and name the manual's section rather than the manual. | ~8k tokens per fire, and the cache read that follows it on every turn | none |
| **L7** | **Cheap exit before orientation.** Every polling lane's first act is the one read that answers *is there work* — then a run-log line and stop. | a no-op fire: full orientation → one call | none |
| **L8** | **Delete *"token cost is not a constraint"*** from night shift B's brief; state the fan-out width instead. | one sentence licensing unbounded spend | none |
| **L9** | **Do not double the theory lanes.** `PROGRAM-PLAN.md` §4.3 prices the second set at twice the month the twelve cost today, on session 2's bucket. | avoids +6 fires/day | the second set's output, which does not exist yet |
| **L10** | **Instrument it.** The roll call already runs daily and already calls `get_session`: have it record each lane session's `usage.cost_usd` and the account's `rate_limit_info`. This page exists because that reading was available and nobody was taking it. | one line per day | none |

**Order to apply.** L2 and L10 first — one stops a measured leak, the
other makes every later claim checkable. L1 next; it is the money. L6,
L7 and L8 are prompt text with no product consequence and can ride
along. L4 lands with whoever creates the merge shift. L3, L5 and L9 are
the other accounts'.

## 4 · What is the owner's call

`CLAUDE.md`'s *axiom power first* rule (D352) is why this section
exists: **a limit does not get to shrink what the program does** without
the owner saying so. Usage is a limit like any other, so §3 is
deliberately the levers that keep the output and drop the repetition —
and anything that would actually reduce production is here, as an ask.

1. **Two night shifts, or one?** They audit the same tree on the same
   night from two accounts, and the machinery that keeps them from
   colliding — the branch-glob split, the pre-audit read of the other's
   branch, the closing flow's `merge-tree` probe — is a cost of running
   both. On the measured side that is ~$297 a night; the other side is
   not readable from here but is chartered the same way. The output is
   real: nine of the ten `night-*` branches on origin are merged into
   `main`, and both of `nightb-*`'s closed ones are. So this is a
   product decision, not waste. **Recommendation: keep both, apply L1 to
   each, and re-read the band and the session costs after one window.**
2. **The two silent lanes** (L2) — disable now and re-enable behind a
   reporting rule, or leave them running while the rule is added?
   **Recommendation: disable now.** A week of $52-a-night with no branch
   is enough evidence to stop and ask, and re-enabling is one click.
3. **The merge shift's nine firings** (L4) — free to re-shape now,
   expensive later.
4. **The theory lanes' second set** (L9).
5. **Whether any of this is applied at all**, since the register's rule 5
   puts cadence in the owner's hands and this file does not move it.

## 5 · What this page does not claim

- **It does not say the program is unproductive.** 9.2 PR-shaped merges
  a day landed on `main` over the last 30 days; the night branches
  merge; the content lanes are the cheapest thing on the account and
  ship every day. The finding is repetition inside productive lanes, and
  two lanes that are not producing at all.
- **It measures one account.** The band, the eleven Routines and every
  dollar are session 1's. Sessions 2 and 3 are read from `ROUTINES.md`,
  which registers contracts and ids, not spend.
- **A cumulative session total is not a per-run cost.** The night
  worker's $594.66 and the content session's $160.70 are divided by
  nights and days respectively to get the figures in §1; the division is
  arithmetic, not a reading.
- **It cannot say why the two silent lanes are silent** — only that
  nothing they produced has reached origin, and that both report
  success. The transcript is on the account and outside what this page
  can read; L2's reporting rule is how the next run answers it.
- **Nothing here is applied.** Every figure was read on 2026-09-03 and
  the lanes are unchanged.

## 6 · What was applied, 2026-09-03

The owner read §3 and said *do that* to L1 and L2 on this account — the only
one a session here can edit. Three of the four changes landed; the fourth is a
tool refusal, recorded in `PERMISSIONS.md` and waiting on a paste.

| Change | Lever | State |
| --- | --- | --- |
| Night shift B fires **3× a night, not 5** — `0 20,22,0,2,4 * * *` → `0 20,0,4 * * *` | L1 | **applied**, `trig_01GNe14hPrZcYzXkFHjPH2bW` |
| Night shift B's brief: one fan-out, list cap 8 → 32, per-flow commit cap 8 → 16 | L1 | **refused** — `update_trigger` will not edit the prompt of a Routine bound to another session. Text on this branch at `design/night-shift-b-brief-2026-09-03.md`; the owner pastes it |
| Nightly algorithm improvement **disabled**, brief gains a reporting rule | L2 | **applied**, `trig_014pyAWbLMVoXLY7pg6meo5i` |
| DB scalability **disabled** | L2 | **applied**, `trig_01WSJVxHtUqioRRvSs6pc31E`. Its reporting-rule append was refused by the permission classifier minutes after the identical edit to the algorithm lane was allowed; paragraph staged in the same design file |

**What that saves, on the measured $59-a-flow figure.** Two fewer flows a night
is ~$119, and the two disabled lanes are ~$56 a day between them: **roughly
$175 a day, ~$5,200 a month**, against a night shift that measured ~$297 a
night and two lanes that had delivered nothing since 2026-08-27. The paste
takes the night from ~$178 to ~$140.

**The one thing the half-applied state costs.** The live brief still maps hour
`00` to an audit flow, so tonight runs two fan-outs rather than one, and its
per-flow commit cap is still 8 — two flows at 8 is a 16-commit ceiling where
five flows gave 25. Output dips until the brief is pasted; the new brief raises
the cap to 16 precisely so two flows carry the same 32 that four did.

**Not done, deliberately.** Delete-and-recreate is the documented workaround
for a bound-session prompt edit (`PERMISSIONS.md`, last row of § Open) and it
was not taken: night shift B's binding is the session holding the owner's
standing push authorization, and a recreated Routine that loses it would audit
every night and push nothing. That is a worse failure than a slow paste.

**What to read in a week.** `rate_limit_info.status` at the same point in the
window, and `get_session` on the night worker for a fresh `cost_usd`. If the
band has not moved, the next lever is L3 — the same edit to night shift A, on
the account this page cannot read.

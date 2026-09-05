# Getting the routine bill down — what the program costs, and what was cut

**Status: partly executed, 2026-09-03 (D359).** The owner read the
arithmetic below and chose *overhead plus cadence*: the dispatcher
overhead removed where a session may remove it, the PR shepherd
re-paced from twenty-four firings a day to eight, the twelve theory
lanes from every second day to every fourth. What a session cannot do
from inside a session is in § 5, as owner rows, with what each is
worth. Nothing here changes what a lane *does* — only how often it is
woken and how much history it re-reads when it is.

> **Different bill from `COST-REDUCTION.md`.** That page is the
> Firebase bill — reads, writes and what a user costs at scale. This
> one is the subscription bill: what the Routines on this account
> spend against the account's own usage limit. They share no
> arithmetic and neither one bounds the other.

---

## 1 · What it costs, measured 2026-09-03

Every figure here was read the same afternoon from `list_sessions`
(the `usage` block each finished session carries — `cost_usd`,
`cache_read_tokens`, `input_tokens`, `output_tokens`) and from
`list_triggers`, never estimated. Ninety of the ninety-two sessions
this account has ever run carry that block.

| | Sessions | Metered | Per day |
| --- | ---: | ---: | ---: |
| **Everything, 2026-08-17 → 09-03** | 90 | **$7,011.27** | $390 |
| of it, routine-side (lanes, dispatchers, the night worker) | 51 | **$3,490.90** | $194 |
| of it, interactive (the owner's own sessions) | 39 | $3,520.37 | $196 |

**Two thirds of all routine spend is one session.** `InSight night
worker` (`session_013UfS4opexyJsoD3K9NxqFF`), alive since 2026-08-24
and woken five times a night ever since, has metered **$2,325.68** on
its own — against 968.8M cache-read tokens, which is the number that
explains it (§2). The whole theory roster, twelve lanes over the same
period, is a third of that.

The rest, over the eight days 2026-08-27 → 09-03, where every run is
inside the window:

| Lane family | Runs | Metered | Per run | Per day |
| --- | ---: | ---: | ---: | ---: |
| The twelve theory lanes | 30 | $733.13 | **$24.44** | $91.64 |
| The ops dispatcher (relaying nothing — § 4) | 1 session, ~17 firings | $70.68 | ~$4.00 | ~$70 |
| The doc sweep dispatcher | 1 session, 4 days | $22.39 | — | ~$5.60 |
| The three axes lanes | 3 | $40.42 | $13.47 | $5.77 |

The charter's own estimate for a theory run was $20. Measured, it is
$24.44 — the estimate was good; the count was the problem.

**The limit is not theoretical any more.** Across the last 92
sessions the rate-limit field reads *allowed* 43 times,
***allowed_warning* 45 times and *rejected* 4**. The axiom dispatcher's
own status is `rejected` on `seven_day_overage_included` — the bucket
*with* overage — and the body lane's 2026-09-03 run died with the
platform's words in its status field: *"You've reached your Fable
limit."* The program is no longer choosing between speed and cost; it
is dropping runs.

## 2 · The mechanism: context × turns, not runs

Every one of the 21 Routines on this account was bound with
`persist_session: true` — each firing is appended to a conversation
that never resets, and every turn of every future run re-reads all of
it. Four sessions carried the whole program:

| Session | Context | Firings a day, before | What it does |
| --- | ---: | ---: | --- |
| `Ops dispatcher for Cosaxo/InSight` | 564,090 | 27 | relays (and has never relayed — § 4) |
| `Axiom dispatcher` | 417,177 | ~6.4 | relays the theory lanes |
| `InSight night worker` | 496,932 | 5 | does the night shift itself |
| `Doc sweep dispatcher` | 283,443 | 0.5 | relays the doc sweep |

That is where the money is, and it is not in the work. A 564k-token
session answering a firing pays 564k on every turn it takes to answer
it; the night worker's 968.8M cache reads over ten days are 497k of
history multiplied by every tool call of every night. **Cost tracks
context size times turn count, not the number of runs** — which is why
a relay that does nothing can cost $4 a firing while a fresh session
that reads the whole tree costs a few dollars, and why every one of
these gets more expensive every day it lives.

The corollary is the rule now in `OPS-RUNBOOK.md` §0: a run with no
work should not pay a full orientation to discover it. The three files
the lane prompts open with — `CLAUDE.md`, `ORIENTATION.md` and
`OPS-RUNBOOK.md` — are 21,482 words together (`wc -w`), read before
the shepherd knew whether a single pull request wanted it.

## 3 · What was cut, 2026-09-03

Read back from `list_triggers` after the change: **20 enabled Routines
firing 18.94 times a day, down from 21 firing 38.98** — and of what is
left, ten firings a day now wake a session that starts empty instead of
one holding 564k tokens.

| What | Before | After | Worth |
| --- | --- | --- | --- |
| **PR shepherd cadence** | `55 * * * *`, 24 firings a day | `55 */3 * * *`, 8 | ~16 firings a day at ~$4 |
| **The twelve theory lanes** | every 2nd day, 6.0 runs a day, 7 of them stacked on one date | every 4th day, 3.43 runs a day, spread 3 per date across a four-day cycle | ~$70 a day, and the daily burst no longer meets the five-hour window |
| **The four ops lanes' binding** | the 564k dispatcher | a new dispatcher session opened empty (`session_01XhD4kBN7fXgeBdFPZEyPY6`), on `claude-haiku-4-5` — a relay is five fields and one line | ~$4 a firing → the cost of a short conversation |
| **The shepherd's prompt** | contract, `CLAUDE.md` and `ORIENTATION.md` read before it knew if there was work | the cheap gate first; a no-op run reads nothing else | the orientation above, on every idle firing |
| **The roll call's prompt** | cost only in the Sunday ledger | every run names yesterday's metered total and any bound session past 150k context, with its cost per firing | this page cannot go stale unwatched |

The old four ops triggers are **disabled, not deleted** — their run
history survives and re-enabling them is one field — and renamed so
the list says why. The new ones carry `(B)`. Ids are in
`OPS-RUNBOOK.md` § 5.

The theory lanes' four-day cycle, so a reader can check a slot:

| Days of the month | Lanes (UTC hour) | |
| --- | --- | --- |
| 1, 5, 9 … 29 | review (02), genetic (09), body (10) | subject day |
| 2, 6, 10 … 30 | database (08), map (09), pattern (10) | reader day |
| 3, 7, 11 … 31 | questions (11), tests (12), ties (13), interests (14) | subject day |
| 4, 8, 12 … 28 | graph optimizer (11), central (12) | reader day |

**The subject/reader alternation is kept, not lost.** The old odd/even
split existed so a reader lane always works on subject output at most a
day old (`ROUTINES.md` § The theory lanes), and the four-day cycle
preserves it by making days 1 and 3 subject days and days 2 and 4 reader
days. Interests moved from the fourth day to the third once that
invariant was read back off the register — it is a subject lane, and on a
reader day its own output would have waited two days to be read.

A 31st followed by a 1st puts two subject days back to back once a month,
and February drops the tail of the cycle. Both are the existing scheme's
artefacts at half the rate, not new ones.

## 4 · What a session cannot cut, and the probe that proved it

The obvious fix is to retire the dispatchers: bind each Routine to a
fresh session per firing and the 564k prefix disappears. `OWNER-LIST.md`
has carried that question since D353, and `OPS-RUNBOOK.md` § The ops
dispatcher already names the path — *"a Routine created in the web UI
with the repository attached starts cloned and needs no relay at all."*

**It was measured again today rather than assumed, and it still fails
from inside a session.** A one-shot Routine was created here with
`create_new_session_on_fire`, firing at 12:55 UTC with a prompt whose
whole job was to report whether its container started with the
repository and to push one file. The creation call answered with the
reason in advance — *"this trigger stores no MCP connectors, so the
sessions it fires will run without connector (`mcp__<server>__*`)
tools"* — and the run bore it out: fired 12:55:25, finished 12:58:31,
status SUCCEEDED, **no branch on the remote**. A trigger-spawned
session has no `add_repo` to provision with and no clone to work in,
which is the 2026-08-25 and 2026-08-26 measurements
(`AXES-RUNBOOK.md` § The account-side inventory) confirmed at the API
level a week later.

So the dispatcher could not be *retired* from here. It was **rotated**
instead: the same four lanes now wake a session that starts empty, on
the cheapest model that can perform a five-field relay. That recovers
almost all of the saving and none of the fragility — the queue is
still one session, and one stall still stalls four lanes.

**The ops dispatcher was also, measurably, spending that money on
nothing.** It has relayed no firing since it was created on 2026-09-02:
no lane session appears anywhere in the last hundred sessions, because
its charter is unadopted and a session that refuses a charter still
re-reads its whole history to say so. Seventeen firings, $69.74, zero
lane sessions. The owner's one-line approval (`OWNER-LIST.md`
§ Clicks) now points at the new session id.

**The roll call was created and immediately held.** Its contract says
*"Binding: never through a dispatcher, whatever the probe says — a
watchdog queued behind the thing it watches is blind to exactly the
stall it exists for"*, and a dispatcher is the only binding a session
can give it. It is disabled with that in its name, and § 5 has it as
the click to make first. The same contradiction sits unremarked
in `OPS-RUNBOOK.md` § 5's roll-call row on the other account, which
binds it to that account's dispatcher; naming it is not fixing it, and
fixing it is a web-UI creation there.

**None of the nine trigger ids already recorded in the tree is on this
account.** `OPS-RUNBOOK.md` § 5 and `PROGRAM-RUNBOOK.md` § The
account-side inventory between them name nine Routines; `list_triggers`
here returns twenty-one and not one of the nine. That is consistent
rather than broken — no account can see another's Routines, so the two
tables describe the other subscriptions — but it means the rows in
§ 5 below are this account's first, and the roll call's Sunday diff of
live prompts against the canonical blocks is the only instrument that
will ever reconcile the three.

## 5 · What is left, in order of what it would save

Each of these is an owner action, and each has its row on
`OWNER-LIST.md`.

1. **The night worker's session — ~$233 a day, the largest single
   line in the program.** Five firings a night into a 497k-token
   conversation that has been growing since 2026-08-24. **Still five,
   and it stays five (D370):** the owner's 2026-09-05 instruction sets
   the run count, so this row is about the prefix a run re-reads and
   never about how many runs there are — rotating the session does the
   same five audits off a smaller conversation. A fresh
   session per night would do the same work off a prefix twenty-five
   times smaller. The reason it has not been rotated by a routine:
   the owner's push authorization for that lane is a human turn in
   *that session's own history* (D326 §2), and a new session does not
   inherit it. Rotating it costs one sentence sent to the new session
   — and until it is sent, the new session cannot push.
2. **The four ops lanes on the web-UI path — the rest of the relay
   cost, and the queue.** Created at claude.ai with the repository
   attached, they need no dispatcher at all: no relay turn, no shared
   queue, and a stall in one lane stops one lane. The roll call is
   the one to create first, because its contract forbids the binding
   it has and because it is the lane that would have shown this page's
   arithmetic a week earlier.
3. **The axiom dispatcher — ~$20 a day, and it is the one that is
   already rejected.** It works, which is why a routine did not touch
   it: rotating it means re-creating fifteen triggers against a new
   session, and the new session's charter would need adopting before
   the theory lanes run again. Worth doing at a moment when losing a
   cycle is acceptable, not mid-week.
4. **The axiom maker at one run a day, not three.** The owner's call
   for the maker was *maker only, at 1/day*, and it cannot be created
   from a session — the same connector limit as §4. `PROGRAM-RUNBOOK.md`
   § The axiom builder is its contract; `30 6 * * *` is the slot; it
   carries the bridge queue, which is the program's actual bottleneck
   (**sixteen** verdicts ruled *worth-building*, two requests crossed in one decision on 2026-08-27 and nothing since — re-counted off `bridge/VERDICTS.md` 2026-09-03).
5. **The rest of `PROGRAM-PLAN.md` §4 stays uncreated.** The merge
   shift at nine passes a day, the console keeper twice a day, the
   improver, the second doer and — above all — the theory lanes'
   second set would add roughly fifteen firings a day of the most
   expensive kind, on an account that is dropping runs today. The
   cheapest reduction available is the one not yet spent.

## 6 · The second round, the same afternoon — where the 77% went

The first round cut firings. Pricing the tokens said the firings were
never the point: split against list pricing (a cache read is a tenth of
input, a cache write a quarter more than input), the 90 sessions'
own `usage` blocks decompose as

| | Cost | Share |
| --- | ---: | ---: |
| Cache **read** — re-reading history | $2,297 | 54% |
| Cache **write** — re-establishing it | $969 | 23% |
| Fresh input | $328 | 8% |
| **Output — the work product** | **$676** | **16%** |

on the orchestrators' own tokens ($4,271 of the $7,011; the remaining 39%
is subagent fan-out). **77% of the bill moves context around and 16%
produces anything.** The per-firing figure closes on the same arithmetic:
564,090 tokens × $5/MTok × 1.25 is **$3.53** to re-cache a cold 564k
prefix, against ~$4 measured — so the ops dispatcher's cost was almost
exactly the price of remembering a conversation in which it had refused
its own charter seventeen times.

Two consequences shape everything above and below. **Firings hours apart
are always cache-cold**, so spacing them out is linear and nothing more —
there is no cadence that recovers the prefix. And **shrinking the prefix is
the only per-firing lever there is**, which is why the ceiling in
`OPS-RUNBOOK.md` §0 is a rule and not a suggestion.

What that round applied:

| What | Where | Worth |
| --- | --- | --- |
| **The context ceiling** — no bound session past ~150k, crossing it is a rotation | `OPS-RUNBOOK.md` §0 | the whole class; the night worker's ~$233/day is the first case (§ 5.1) |
| **The bounded slice** — a tail, a digest, a section, never a whole growing file | `OPS-RUNBOOK.md` §0 | the growth that makes today's cadence cut temporary |
| **The production reader became a workflow** | `.github/workflows/production-reader.yml`, `scripts/production-reader.mjs` (+ tests) | the lane's whole cost; an Action needs no bucket |
| **The doc sweep was disabled** — its contract has never been on `main`, so every firing since 2026-08-30 was a guaranteed no-op under `ultracode` | `OPS-RUNBOOK.md` § 5, `WORKLIST.md` | ~$5.60/day for work that could not happen |
| **The cheap gate reached the list worker and the axes skeptic** | `OPS-RUNBOOK.md` §4, `AXES-RUNBOOK.md` | the orientation read on every idle firing |
| **The read budget was written for the theory lanes, and not applied** | `AXIOM-THEORY.md` § The read budget, `OWNER-LIST.md` | ~$8/run if taken; the charter is the owner's |

**Why the reader could move and the shepherds could not.** Everything the
reader read is available to the default `GITHUB_TOKEN`: two workflow runs,
an artifact, a committed file. It needed one enabling change —
`observe.mjs` now takes `--json-out` and `observe.yml` publishes the
payload as the `observe-json` artifact, because a reader that parses the
probe's padded `✓ alertPolicies  5 live` lines is the
one-parser-in-three-copies failure D197 recorded. Three rows of
`pulse-trail.jsonl` answer "has anything moved" with no API call at all,
so the lane does not even need yesterday's comment. The shepherds, by
contrast, need judgement about a diff; no token substitutes for that.

**Two refusals worth having in writing.** A stored prompt cannot be edited
from another session — measured when `update_trigger` refused the gate for
both the list worker and the skeptic, *"not your own"* including a
dispatcher this session had itself created. So a prompt change is a
delete-and-recreate (the list worker, which had no run history to lose:
`trig_01VH8PvZCaqKciAwzpxmfMYW` replaces `trig_01KRuw9989n3ynLXnzEqPr4W`)
or an owner edit in the web UI (the skeptic, now an `OWNER-LIST.md` row).
And the theory lanes' read budget stops at the charter: no routine amends
its own contract (`AXES-PLAN.md` §10), so the arithmetic is written where
the owner can rule on it and the lanes still read whole files until they
do. Saying that plainly is the point — the alternative was a prompt clause
quietly outranking a contract, which is D148's named failure in the lane
family that costs the most.

## 7 · What this deliberately does not do

- **It does not cut what a lane does.** Every contract is unchanged
  except for the cheap gate, which changes only the order in which a
  run reads things and only for runs with nothing to do.
- **It does not touch the content lanes or the night shift's work.**
  Those are the program's output; this page is about its overhead.
  **Corrected 2026-09-05, and the correction is the point of D370: this
  sentence was false for night shift B when it was written.** The same
  afternoon, two of B's five audit flows were removed from the other
  account — a schedule cut, not an overhead cut, and an audit flow is
  what that lane produces. The owner reversed exactly that half —
  *"return the night shift to 5 opus ultra code runs"* — and left the
  rest of this page standing. The line to hold next time: **the prefix
  is the lever, the run count is the product.** Everything else cut here
  is prefix, cadence on a poller, or a lane whose contract was not on
  `main`; §5.1's rotation is prefix too, which is why the reversal does
  not touch it.
- **It does not decide the theory program's worth.** The console trail
  for 2026-09-03 reads `measured: 1` against `argued: 57` and
  `cited: 65`, and the bridge has ten *worth-building* verdicts with
  one crossing — a downstream bottleneck, not an upstream shortage,
  which is the argument for halving the rate rather than the argument
  for stopping. Stopping is the owner's call and is not taken here.
- **It does not touch another account's Routines**, which no account
  can see, and does not edit a tick, a status word or another
  account's tag.

## 8 · How it stays honest

The roll call's contract now names two lines every run must carry:
yesterday's total metered cost across the account's sessions, and the
context size of every persistent session a Routine is bound to, with
the cost per firing for any that has passed 150k tokens. Both come
from fields the platform already returns. That is the instrument this
page was written without — the arithmetic above had to be assembled by
hand from `list_sessions` because nothing in the program was reading
the `usage` block at all, which is exactly how a $2,325 session went
ten days unremarked.

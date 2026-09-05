# Consolidating the program onto one or two subscriptions

**Status: plan only — nothing here is applied.** No Routine is deleted
by this file, no subscription cancelled, no cadence changed. Written
2026-09-04 from the owner's word that day: *"the project is not quite
ready for the complete version of this system and i will be reducing
down to 1-2 claude subscriptions."*

[`PROGRAM-PLAN.md`](PROGRAM-PLAN.md) is what was adopted at D352 across
three accounts and stays the record of that. This file is the same
program drawn on one account and on two: what survives, what is retired
and what the retirement costs, what moves to GitHub Actions where no
subscription is spent at all, and the one thing that must happen before
any subscription is cancelled. Every figure is measured — from
[`USAGE-REDUCTION.md`](USAGE-REDUCTION.md) §1 for the Claude 2 account
and from this account's own `list_sessions` usage blocks — and the
figures that are not measured say so.

## 0 · Before any subscription is cancelled

**Seventeen Routine prompts exist nowhere but inside two accounts.**
`list_triggers` is the only copy of a stored prompt, it is scoped to
the account that owns it, and it goes when the subscription goes.
[`RECREATE.md`](RECREATE.md) § Not yet recreatable is the live list;
today it names:

| Account | Prompts that exist only there |
| --- | --- |
| **Claude 1** | `Nightly algorithm improvement`, `InSight DB scalability`, `InSight night shift B` |
| **Claude 2** | the **twelve** theory lane prompts, `InSight doc sweep`, `InSight night shift` (shift A) |
| **Claude 3** | *(none — every prompt is a fenced block in `PROGRAM-RUNBOOK.md`)* |

**D366 (2026-09-05) took the twelve theory prompts off this list's
urgent half**, and it is the owner's ruling that did it: *"nothing that
has been created so far is axiom theory"*, the `axiom-theory` branch
discarded, the 129 claims kept as [`AXIOM-IDEAS.md`](AXIOM-IDEAS.md)
and the program restarting from a fresh plan. This page previously said
the branch was safe in git and only the prompts were at risk. Both
halves of that are now moot: the branch is discarded by decision, and
re-creating those twelve prompts verbatim would rebuild the very
gradient D366 diagnosed as the cause — a ladder whose top rung rewarded
describing the product over reasoning about what it could know. Export
them if you want the record; do not treat it as a deadline, and do not
restart the lanes from them.

What stays urgent is the other four: `InSight doc sweep` and
`InSight night shift` (A) on Claude 2, and Claude 1's three.
[`WORKLIST.md`](WORKLIST.md) carries the export as one item per
account, tagged `[claude-1]` and `[claude-2]`; each is one read-only
run of `list_triggers` and one PR.

**This is the only urgent thing on this page.** Everything else here
can be decided slowly. This cannot: it is only true until a
subscription lapses.

Claude 3 can be cancelled today at no loss, and the reduction has
already begun there: at **08:45 UTC on 2026-09-04** all four of its
remaining Routines were disabled from the account's own Routines page
— the axiom builder, the list worker, the roll call and the console
improver. Disabled rather than deleted, so every id still resolves;
`routines/manifest.json` carries them as `disabled` with that date, and
nothing on that account has fired since. The relay session it fired
into has nothing left to relay.

## 1 · What the reduction is, beyond capacity

The program was designed for a product that ships continuously to
users. The production reader's own reading, 2026-09-03: **`dau: 0`,
`revenueUsd: 0`, `measuredActives: 2`** — the app is pre-launch. Priced
against that, the program spends most of its money on its two most
speculative layers and least on the ones that put things in the app:

| Layer | Per day | What it is | Measured? |
| --- | ---: | --- | --- |
| Night shift A's worker session | **~$233** | five wakes a night into a conversation growing since 2026-08-24 | yes — `USAGE-REDUCTION.md` §1 |
| The twelve theory lanes | **~$73** | $24.44 a run, three runs a day at the every-fourth-day cadence | yes — §1 |
| Night shift B | unknown | same shape, on an account no session here can read | no |
| The three axes lanes | ~$6 | $13.47 a run, three a week | yes — §1 |
| **The axiom builder** | **~$9** | $4.67–$15.74 measured over three relayed runs | yes — this account |
| **A list worker** | **~$19** | one run, one PR, one worklist item | yes — $19.41, 2026-09-03 |
| **The six content lanes** | unknown | on Claude 1's shared dev session; the app's food | no |
| The roll call | ~$1.50 | one comment a day | yes — $1.49 |
| The merge shift (deleted 2026-09-04) | ~$21 | nine Opus passes a day; no PR ever carried `approved` | yes — $2.31 a no-op |

So the contraction is not only a capacity cut. It is the chance to stop
paying ~$300 a day to audit and theorise about a tree that only
routines are changing, and keep the ~$30 a day that writes questions,
builds toward the axioms and finishes the owner's list.

**The limit is already binding, and it is what breaks runs.** Rate
limits are per account. Across this account's sessions the limit field
reads *allowed* 43 times, *allowed_warning* 45 and *rejected* 4; the
axiom builder lost two of its first three runs to the five-hour window
mid-flight, on a day this session and two other lanes shared that
window. Fewer accounts means fewer buckets, so the same collision gets
more likely, not less — §6 is the guard that keeps it from becoming the
daily state.

## 2 · The floor: what survives any cut

**Eighteen GitHub Actions workflows already run the mechanical half of
the program on no subscription at all**, and three of them arrived by
moving work off an account rather than by adding anything: the console
(`console.yml`, D352), the production reader (`production-reader.yml`,
D359) and the PR shepherd (`pr-shepherd.yml`, 2026-09-04). Each was a
Claude lane; each is now a script that costs nothing from any bucket.

The rule that produced them is the rule to keep applying: **anything
that reads state and renders it belongs in Actions, not in a
subscription.** What is left on an account is what needs judgement —
writing a question, writing code, reading a diff for what stays green
while wrong.

This floor holds at one subscription and at zero. `check:*`, CI, the
pulse, the observe probe, the console and the merge list keep working
whatever the owner cancels.

## 3 · Two subscriptions — the split is owner / program, not lanes / lanes

The obvious split is to halve the lanes across two accounts. The
measurement says otherwise: **the owner's own interactive sessions were
$196 a day of the $390 — half of everything** — and they share the
five-hour bucket with any lane on the same account. A lane that fills
the window does not merely delay itself; it blocks the owner from
working, which is the one thing the program cannot afford, because
every list on this project waits on an owner decision.

So:

| Account | Carries | Why |
| --- | --- | --- |
| **The owner's** | the owner's interactive sessions. Nothing scheduled, or at most the roll call | a bucket the owner never has to share |
| **The program's** | every scheduled lane below | one bucket, one queue, one place to look |

The program account's whole roster, and a clock where no two heavy runs
share a window:

| UTC | Lane | Cost | Merges |
| --- | --- | ---: | --- |
| 07:00 | question farm | small | itself, on green (D212) |
| 08:00 | daily catalog question | small | itself |
| 09:00 | learn lane (Mon, Thu) | small | itself |
| 09:30 | feed lane | small | itself |
| 10:00 | duel lane (Wed) | small | itself |
| 11:00 | now lane | small | itself |
| 13:00 | **the axiom builder**, once a day | ~$9 | never |
| 18:00 | **one list worker**, once a day | ~$19 | never |

Six cheap content runs in a morning block, then one heavy run per
window for the rest of the day. Roughly $30 a day and eight firings,
against today's three-account program of thirty-four live Routines.

Everything else on that account is deleted, not disabled — a disabled
Routine still shows in the page and still has to be reasoned about.
`RECREATE.md` is what puts any of them back.

## 4 · One subscription

One bucket for the owner *and* the lanes. The content lanes still fit,
because they are cheap and they run before a European working day
starts; past that, **one heavy lane a day is the honest ceiling**, and
it should be the axiom builder, because the bridge already holds ten
verdicts ruled worth building against one crossing — the bottleneck is
building what the theory already licensed, not producing more of it.

| UTC | Lane |
| --- | --- |
| 07:00–11:00 | the six content lanes, as above |
| 13:00 | the axiom builder, once a day |

The list worker goes; its items are the owner's to hand to an
interactive session when they want one done. The roll call goes; with
one account the Routines page is the roll call. Everything in §2 keeps
running.

## 5 · What is retired, and what each retirement costs

Named rather than glossed, because each is a real loss:

- **Both night shifts** (~$233/day measured for A alone). Lost: the
  nightly audit that finds what the gates cannot see. Kept instead: CI
  on every PR, which is where every *correctness* claim is already
  proved. If the audit is wanted, one fresh-session run a week does
  most of it at a fortieth of the cost — a persistent session woken
  five times a night is what made this line the biggest in the program,
  not the auditing itself.
- **The twelve theory lanes** (~$73/day, and $733.13 across the 30 runs
  D366 measured). **The owner has already retired these, on grounds
  that have nothing to do with cost**: D366's ruling is that none of
  what they produced is axiom theory, the branch is discarded, and the
  program restarts from a fresh plan. So the consolidation does not
  need to decide them — it only needs to not re-create them. What a
  replacement costs is [`AXIOM-POTENTIAL.md`](AXIOM-POTENTIAL.md)'s
  question, not this page's; what this page adds is that a restart
  lands on one or two accounts rather than three, so it is a lane in
  §3's clock and priced there.
- **The three axes lanes** (~$6/day). The axes program's build step is
  the same work the axiom builder does, against the same theory.
- **The meta layer** — the merge shift (already deleted), the console
  keeper (never created), the console improver, the second doer, the
  second theory set, and one of the two roll calls. All of it watches
  the program rather than the product, and most of what it watched was
  three accounts being invisible to each other, which one or two
  accounts are not.
- **The relay** (this session's binding). Under consolidation it is not
  optional to remove: it costs a context replay per firing, and there
  is no spare account to host it. Every surviving lane is created in
  the Routines page, fresh session per fire, repository attached — the
  `web_ui` fields `node scripts/routines.mjs --plan <account>` prints.

## 6 · The move, and the guard it needs

**The kit built at D352 is the migration tool, and it makes the choice
of surviving subscription free.** Every lane in §3 and §4 has its
prompt as a fenced block in this repository — the content lanes in
`QUESTION-FARM.md`, the builder, list worker and roll call in
`PROGRAM-RUNBOOK.md` — so each can be created on *any* account from
`routines/manifest.json`. The move is:

1. Export the seventeen prompts of §0 while both accounts still exist.
2. Change `account` on the surviving rows in `routines/manifest.json`,
   run `node scripts/routines.mjs --write`, commit both.
3. On the surviving account, `node scripts/routines.mjs --plan <account>
   --missing` prints the exact `create_trigger` arguments and the
   web-UI fields; create each.
4. Delete the old Routines, and set every retired row's `state` to
   `not yet` with the date and the reason. `check:routines` holds the
   manifest, `RECREATE.md` and the runbook inventories together.

**The one thing the kit cannot do yet is say whether a roster fits.**
It knows what exists, not what it costs, and the failure it therefore
cannot catch is exactly the one measured three times this week: a lane
starts, the account's window closes mid-flight, the work is lost and no
PR and no run-log line is written. On one or two accounts that becomes
the daily state rather than the exception. Proposed, small, and not
built:

- each manifest row gains `cost_usd_per_run` (written by the roll call,
  which already reads every session's usage block) and a `priority`;
- `node scripts/routines.mjs --load <account>` prints the account's
  firings a day and the metered estimate;
- `check:routines` fails when a declared roster exceeds the ceiling the
  manifest names for that account, and when two lanes over a named cost
  fire inside one five-hour window.

That is the difference between a program that degrades gracefully on
one bucket and one that drops its most expensive runs silently.

## 7 · What only the owner can decide

1. **Which subscriptions survive**, and whether it is one or two. §0's
   exports are the prerequisite either way; §3 recommends two, split
   owner / program, on the arithmetic that the owner's own sessions are
   half the spend and must not queue behind a lane.
2. **The night shifts** — retire both, or keep one at a weekly fresh
   session? ~$233 a day measured for A alone.
3. ~~**The theory program** — pause with the prompts exported, or keep a
   reduced set running?~~ **Answered by D366 on 2026-09-05**, before
   this page was read: the branch is discarded and the program restarts
   from a fresh plan. What is left for you here is only *where* a
   restarted lane runs and at what cadence, which §3's clock answers
   with one slot.
4. **Whether the guard in §6 is built** before the move or after. Before
   is one afternoon and catches the failure while it still matters;
   after is the same afternoon spent once it has happened again.

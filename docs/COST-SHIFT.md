# The cost shift — four Opus auditors a night, and a Fable closer that reviews and adjusts them

> **Status: plan only until the five Routines exist.** Designed
> 2026-09-06 on the owner's ask of that day (*"a new nightly routine
> that runs 4 opus ultracode sessions that look for unexpected cost in
> the app and ways to optimize data handling and firebase data usage in
> the most efficient way it can do decent size redesigns, and then a
> fable max session at the end that reviews and adjusts the changes"*).
> This file is the contract those Routines will read on every run; the
> Routines themselves are the owner's to create (§7, and why a session
> cannot). The pull request that registers their ids in `ROUTINES.md`
> flips this line to *tree*. Same split as `DOC-SWEEP.md` and
> `OPS-RUNBOOK.md`, for the same reason: behaviour changes by PR here,
> never by editing a live prompt (D148).

**What this lane is for.** The Firebase bill is a *prediction* today —
`COSTS.md` is regenerated from `scripts/cost-arith.mjs` and reads 440
reads per user per day at every size — and the only things holding the
prediction to the code are the tripwires in `scripts/pulse.test.mjs`
and the trail `scripts/pulse.mjs` appends each morning. Nothing reads
the two against each other, nothing hunts the cost the model calls
free, and the data-handling redesigns the plans already hold
(`ANSWER-SCALE.md` §4, `SCALE-PLAN.md`, `COST-REDUCTION.md`'s open
levers) wait on an alert or a decision. This lane is four sessions a
night that each take one lens over that — the device's reads, the
server's writes, the data's shape, the bill against the model — find
what is unexpected or wasteful, measure it, build the fix or the
redesign on a branch, and prove it; and a fifth session that reads the
four branches as a reviewer who did not write them, adjusts what that
proves wrong, and hands the owner pull requests to merge in the
morning.

**What it is not.** It is not the night shift: that lane hunts defects
across the whole tree, this one hunts cost and data efficiency along
four named lenses, and the two read each other's branches before they
touch anything (§3 step 2). It is not the Claude subscription bill —
that is `USAGE-REDUCTION.md`'s, and §6 here says what this lane adds
to it rather than pretending it is free. And it is not a licence to
make the app show less: a smaller picture is not a saving (§2).

---

## 0 · The shape in one screen

    UTC   Oslo (CEST)                                          who
    ───── ──────────  ──────────────────────────────────────── ───────────────
    23:50   01:50     four auditors fire together, fresh       claude-opus-5,
                      sessions, one lens each, 150 min:        ultracode
                        reads · writes · shape · bill
                      each cuts claude/cost-<D>-<lens> from
                      origin/main, audits, measures, builds,
                      proves, pushes, reports
    02:20   04:20     latest auditor budget end
    03:05   05:05     the closer fires, fresh session, 150 min: claude-fable-5-1,
                      reads the four branches as one reviewer,  effort max,
                      merges origin/main into each, runs the    ultracode for the
                      battery, re-reviews every diff as a unit, batteries
                      fixes and folds, opens one PR per branch
                      with its verdict, reports
    05:35   07:35     latest closer budget end — the PRs are
                      waiting before 08:00 Oslo
    morning           the owner reads the verdicts, merges by hand (D385)

`D` is the morning being prepared: `TZ=Europe/Oslo date -d '+4 hours'
+%Y%m%d`, resolved once at run start — the night shift's rule, so both
firings and both seasons land on the same date (23:50 UTC is 01:50 or
00:50 Oslo; +4 hours is the same morning either way).

---

## 1 · The four lenses

Four sessions on one subject would find the same three things four
times, and two branches carrying one fix is the failure the register's
first collision rule exists for. So the subject is partitioned by
*where the cost is paid*, not by what kind of fix it wants — every lens
may find a bug, a bound, a redesign or a measurement, but only inside
its own files. A finding outside your lens goes on your run-log line
for the lens it belongs to, never into your branch.

### reads — the device's read path

`src/v2/data/live.ts` and its neighbours: `voters.ts`, `circle.ts`,
`similarity.ts`, `cohort.ts`, `cacheStore.ts`, `budgetMode.ts`,
`patternsReady.ts`, `deck.ts`, and the `ui/` panels that call them.
The questions: what boot, re-attach, each tab, each Mirror stop, each
lens and each vote cost in documents and in bytes; which of it is
cached, where, for how long, and whether the cache is actually hit on
re-entry; where two panels fetch the same thing; where a list is paged
past what is drawn; where a re-read after a vote fetches more than the
one document that changed. `COSTS.md`'s per-user-day decomposition is
the map — D98 social surfaces 354 of the 440, re-attach 28, boot 21 —
and that number is what this lens moves. The rules: the same picture
from fewer documents is a saving; a smaller picture is not (§2). The
caps that thin a surface (`VOTER_FETCH_CAP`, `KINDRED_QUESTIONS`,
`CIRCLE_ANSWER_CAP`) are refused levers, and so is any change that
makes a stop draw later than it does today — first paint comes off the
device at zero reads (D356) and stays there.

### writes — the server's write and compute path

`functions/src/`: the per-answer fold (`onV2AnswerCreated`,
`onV2AnswerUpdated`, `runAggTransaction`'s `tx.getAll` shapes in
`v2.ts`), the `v2_agg_events` ledger and everything that walks it
(`ledgerVelocityScan` in `velocity.ts`, `fitPatternsV2` in
`patterns.ts`, `digestEngagementV2` in `engagement.ts`, `fitTasteV2`
in `taste.ts`), the other scheduled functions and their cadences, the
runtime shapes in `ops.ts` (memory, timeout, concurrency,
`maxInstances`), retries, the contention the alert in `monitoring/`
watches, and Cloud Logging volume, which `COSTS.md` names as not in
the model. The questions: what one answer and one day cost the server
in reads, writes, invocations and CPU-seconds; where two nightly walks
read the same day's ledger twice; where a fold reads a document it
does not use; where a function's shape pays for headroom nothing
needs; what a runaway would cost before `maxInstances` stops it. The
rules: the fold's counts stay honest because the trigger moves them
(D86) — a change that makes `v2_question_aggs` publish less often, in
batches, or with a floor is refused (D98); the ledger's retention and
the reads per entry are the model's constants, so a change to either
moves `cost-arith.mjs` and its pin in the same commit.

### shape — the shape of the data

`firestore.rules` (the `get()` count on every write path, and the
1000-expression ceiling `OWNER-LIST.md` § Decisions records on the
answers path — the measurement that row says nothing in the repo
produces is this lens's to build; the restructure is an ask),
`firestore.indexes.json`, `docs/SCHEMA-V2.md`, `docs/data-inventory.md`,
`docs/BANK-DELIVERY.md`'s three ceilings, `storage.rules`,
`firebase.json`'s hosting rules, and the size of every document a hot
path reads — `v2_meta/app`, the question and aggregate documents, the
people and profile documents, the reveal documents. The questions:
bytes per read on each hot path; what is stored twice and read once;
what grows without bound (a user's answers over a lifetime, the ledger
between sweeps, an aggregate's breakdown as the bank grows); what a
cold boot fetches that a warm one already has; which index serves no
query and which query serves no index; what Hosting and Storage serve
per session. The rules: an answer's `anchors` snapshot is the only
copy there is (D8, D290) and `check:answer-shape` exists for the
change that trims it; the aggregates are disposable projections of the
answers and may be reshaped freely, so long as every client read of
them still finds the exact published counts (D98); sharding the daily
aggregate is designed in `ANSWER-SCALE.md` §4 and *shelved on the
alert* — building it ahead of the alert is an ask (§2), and the probe
that would show whether the alert is near is a build.

### bill — the bill against the model

Every cost the app and its repository generate outside the Claude
subscription: Firebase (reads, writes, deletes, storage, egress,
functions), Google Cloud around it (logging, monitoring, the billing
budget `budget.yml` arms), GitHub Actions minutes including the macOS
minutes `ios-release.yml` spends, and the fixed fees `monitoring/rates.json` carries. The sources: `monitoring/pulse-trail.jsonl` (the
only committed measurement), the `observe-json` artifact
`observe.yml` publishes and the comments `production-reader.yml`
posts, `COSTS.md`'s predictions and `scripts/cost-arith.mjs`'s
constants, the workflows under `.github/workflows/` that touch
production, and `COSTS.md`'s own list of what is not in the model. The
questions: where the measured world and the modelled world disagree;
an item the model calls free that is billed (D129's own lesson — *"a
fix modelled as free"*); a soft input — `bgCycles`, `onlineMin`, the
three D98 open rates — that the trail can now replace with a number;
a path with no bound, or a bound that is only an alert; a workflow
that reads production more often than its output changes; an
emulator or CI run that reaches production at all. The product of
this lens is mostly measurement — a new pin in `scripts/pulse.test.mjs`,
a corrected constant with its source, an alert policy under
`monitoring/`, a replaced assumption with the trail rows that replaced
it — and a fix where a cost is real and unbounded. It never retypes a
figure: it runs `npm run costs`, `npm run costs:levers` and
`npm run pulse` and commits what they print.

---

## 2 · The licence — what may be built, what must be asked, what is never done

This is the section the owner's sentence *"it can do decent size
redesigns"* lands in, and it is worded against two records that would
otherwise stop every redesign at the door: D7 (*backend scale ceilings
are recorded, not engineered around — zero users, no build*) and
`COST-REDUCTION.md` §3 (*not yet: everything else — at launch sizes the
entire lever list is worth about $2 a month*). The owner's ask is read
as licensing the middle row, not the top one: a redesign that is no
dearer today and removes a wall is built; a redesign that costs today
to pay later is put to the owner with the arithmetic. D393 records
this reading as proposed, and the owner's word on it flips the record.

**An auditor may BUILD, on its branch, without asking:**

- **The same picture for less** — a change that removes reads, writes,
  bytes, invocations or CPU-seconds at every size and changes nothing
  a user sees or how soon they see it.
- **A bound on an unbounded path** — a page, a cap on a fetch that had
  none, a retention, a ceiling on a fan-out — where today's behaviour
  sits inside the bound and the bound is stated in the code with why.
- **A redesign that is no dearer today and removes or moves a wall**
  — the reshaping of a projection, a fold that reads its input once
  instead of twice, a document split so a hot path reads what it
  draws. "No dearer" is measured, not asserted: the model re-run at
  50 and 500 DAU as well as at 50,000.
- **Measurement** — a tripwire, a probe, a corrected constant, an alert
  policy, a model input replaced by a trail figure, a count the
  repository could not produce before. Measurement is always licensed;
  it is what every other row rests on.
- **The removal of a cost nothing reads** — a document written for a
  consumer that no longer exists, a log line at a volume nobody
  queries, a workflow step that fetches what the next step ignores —
  once the auditor has shown, by grep and by the data inventory, that
  nothing reads it.

**An auditor must ASK — one row on `docs/OWNER-LIST.md` § Decisions with
what would change, what it saves at each size, what it costs today, and
the smallest shape that keeps the value — and may still build the part
that does not depend on the answer:**

- Anything that **thins a surface** — the who-voted page, Kindred's
  twelve questions, the Circle's three hundred answers, a lens drawn
  from fewer people than today. `COST-REDUCTION.md` §5 refused these
  and the refusal stands until the owner lifts it (D334 — a refusal
  already written down is an ask, never a silent stop and never a
  silent build).
- A redesign that **costs today to pay later** — more reads or writes
  at 50 DAU to save them at 50,000 — or that only pays past a wall the
  app has not reached (D7). Sharding ahead of the contention alert is
  the named case (`ANSWER-SCALE.md` §5.3).
- A **schema move that changes what the client reads** in a way an
  installed app on an old build would not survive without a migration
  path the auditor has not built.
- A **privacy-shaped finding** — a field that joins two things, a
  number that would stop being exact, a lens that would name someone
  (D334). What to bring is in `CLAUDE.md`'s privacy section.
- A **cadence** — a scheduled function run less often, a poll slowed,
  a re-check interval widened — because each of those is a number a
  user feels, and `COSTS.md` charges the poll as real (D129).

**Never, whatever a finding says:**

- Merge, approve, apply `approved` or `merge-when-green` or any label,
  push to `main`, to `night-*`, to `nightb-*`, to another lens's
  branch or to any branch the session did not create; force-push;
  open a pull request from an auditor (the closer opens them, §4).
- A publish cadence, a batch publish, a k-anonymity floor, a
  suppressed cell, a `tooSmall` — population counts are exact and
  publish from the first answer (D98), `PUBLISH_EVERY` in
  `scripts/cost-arith.mjs` is the constant 1 and its pin stays.
- Widen or narrow D86's one edit shape; trim an answer's `anchors`
  snapshot or `answeredAt` (D8, D290); loosen `firestore.rules` or
  touch its three labelled denies.
- Touch the content banks, `web/privacy.html`, a store form, a lane
  contract (this file included — a routine never amends its own
  contract), or another lane's open branch.
- Skip, disable or quarantine a test; push an empty commit; re-run a
  job to outwait a real failure; delete a pin in `pulse.test.mjs`
  rather than moving it with the code it pins.
- Write a figure by hand. A count is the output of the command that
  produces it, pasted, or an entry in `scripts/check-figures.mjs`.

---

## 3 · Every auditor's run

1. **Deepen, then orient.** `git rev-parse --is-shallow-repository`;
   if true, `git fetch --unshallow origin || git fetch origin`; then
   `git fetch origin --prune '+refs/heads/*:refs/remotes/origin/*'`.
   Read `CLAUDE.md`, `docs/ORIENTATION.md` and this file on
   `origin/main`. `npm ci`, and `npm ci --prefix functions`. Resolve
   `D` once (§0). Cut `claude/cost-<D>-<lens>` from `origin/main` and
   note the base SHA in the run-log line.
2. **Read what already carries a fix, before deriving anything.** For
   every open pull request and every `claude/*`, `night-*` and
   `nightb-*` branch on origin ahead of `main`: `git diff --stat
   origin/main...<ref>` and the commit subjects. A file a live branch
   is actively rewriting is off your list, and a defect its commits
   close is off your list. The other three lenses' branches for
   tonight do not exist yet at fire time and do not need reading; a
   second run the same night (a re-fire) reads them first. This costs
   one command per branch and is the whole of the register's first
   collision rule.
3. **Audit as a parallel fan-out under ultracode, once.** Finder
   subagents, one per slice of your lens — no more than six — each
   returning candidates as `file:line`, what is paid, and how the
   finder knows. One adversarial verification pass per candidate:
   does it reproduce (a probe, a test, a count — not a reading), is it
   measured, and is it a deliberate convention (the traps in
   `CLAUDE.md` § Things that look like bugs but are not, and the
   licence in §2). A candidate that survives earns a line; nothing
   else does.
4. **Measure every survivor before touching it.** Reads, writes, bytes,
   invocations or CPU-seconds per user-day, before and after, at 50,
   500, 5,000, 50,000 and 500,000 DAU where the model covers the path
   (`npm run costs`, `npm run costs:levers` — change the constant,
   re-run, quote the print), and by a probe where it does not (an
   emulator run that counts document accesses, the way
   `scripts/pulse.test.mjs` counts them in the rules; a script that
   sizes the documents a boot fetches). A saving without a measurement
   is not a saving and does not get built.
5. **Build the largest verified saving first.** One redesign, or up to
   three smaller changes, a night per lens — the cap that keeps the
   morning's diff readable. Each change carries: its test; its
   comment saying *why* in the house voice, especially where the
   result looks wrong; the `COSTS.md` line if the model's arithmetic
   moved, regenerated by `npm run costs` and never typed; the
   `scripts/pulse.test.mjs` pin moved with the constant it pins, never
   deleted; the `docs/data-inventory.md` row if a collection or field
   appeared or vanished (`check:data-inventory`); the
   `firestore.rules` test if a rule moved. Every commit subject begins
   `cost-<lens>:`.
6. **Prove.** `npm run lint`, `tsc -b`, `npm run test:unit`,
   `npm run test:scripts`, `npm run check:globals`, `npm run
   check:docs`, `npm run check:figures`, `npm run check:bundle`,
   `npm run check:answer-shape`, `npm run check:data-inventory`; plus
   `tsc -p functions`, `npm run build --prefix functions` and
   `npm run test --prefix functions` when `functions/` moved
   (`check:fn-runtime` reads the built output, so build first); plus
   `npm run test:rules` and `npm run test:e2e:all` with `HTTPS_PROXY`
   unset (`docs/LOCAL-TESTING.md` § Sandbox note) when
   `firestore.rules` or a trigger moved; plus `check:monitoring` when
   anything under `monitoring/` moved. A check that did not run is
   named as unrun in the report, never claimed (D1 reaches reports).
7. **Push the branch.** Never a pull request — the closer opens them
   after its review, so CI runs once per branch with the closer's
   adjustments already in, and a branch the closer drops never costs
   a CI matrix. Never `main`; never a branch you did not create.
8. **Report** (§8). Everything you verified and did not build is on
   the line too, with why: the next night's finder starts from it
   instead of rediscovering it, and the owner sees the shape of what
   the lens found rather than only what it kept.

**Budget: 150 minutes from the first tool call; nothing new begun past
minute 120; the branch pushed and the report posted by minute 145.**
A candidate mid-build at the budget is reverted, not pushed half-done,
and named on the line for tomorrow. Leave the tree as you found it.

---

## 4 · The closer's run

The closer is the session that did not write the night's changes, and
that is its whole value: the auditors' blind spot about their own work
is the failure D326 §2 built the night shift's closing flow for, and
this lane inherits the flow's shape. It reviews, it adjusts, and it
hands the owner something that can be merged in five minutes.

1. **The cheap gate, before anything else.** `git ls-remote --heads
   origin 'refs/heads/claude/cost-<D>-*'`. No branch → the run-log
   line says so and the run stops there, before `npm ci`, before the
   contract, before the tree (`OPS-RUNBOOK.md` §0's cheap-gate rule; a
   no-op that pays a full orientation is the retired merge lane's
   failure).
2. **Deepen and orient** as §3 step 1, without cutting a branch.
3. **Read the claims, then the truth.** The four auditors' lines on the
   Cost run log are the claims; each branch's `git diff
   origin/main...` is the truth, and where they differ the diff wins.
   Then the collision read: `git merge-tree --write-tree --name-only
   origin/main <ref>` between each pair of cost branches, and between
   each cost branch and every other live branch on origin, so a file
   two branches touched is known by name before anything is judged.
4. **Per branch, in parallel worktrees, fanned out under ultracode:**
   merge `origin/main` into the head as a merge commit — never a
   rebase, amend or force-push; run the battery of §3 step 6 scoped to
   what the branch touched, and the closing gates (`check:globals`,
   `check:docs`, `check:figures`, `check:bundle`, `check:eager-content`)
   on every branch regardless; and, as the closer itself and not a
   subagent, re-review the whole diff adversarially as one unit — is
   the saving real (re-run the model or the probe; a before/after
   number the closer cannot reproduce is not a number), is a surface
   thinner than yesterday, is a D98, D86 or D8 line crossed, does a
   moved pin still pin what it pinned, does a comment's reasoning hold
   after the change it describes, does a commit message claim more
   than its diff, does a redesign meet §2's "no dearer today" at 50
   DAU as well as at 50,000.
5. **Adjust.** Fix what step 4 proves broken, and only that; simplify
   where the same saving has a smaller diff; where two branches touch
   the same logic, fold the later one into the earlier (a merge, not a
   rewrite) so the owner never merges a conflict; where a change is
   unmeasured, unproven or crosses a line, take it out of the branch
   and say so in the verdict. Every closer commit's subject begins
   `closing:`. This is the one lane whose contract licenses pushing to
   a branch another session created, and it licenses exactly the
   night's `claude/cost-<D>-*` branches and nothing else. **Nothing new
   begun past minute 120.**
6. **Judge each branch** — MERGE, DO NOT, or NEEDS OWNER — in one
   sentence of reason, and open the pull request: title `cost shift
   <D> — <lens>`, body opening with `what:`, `how:` and `measured:`
   lines (the merge list reads the first two; the third is the
   before/after arithmetic at the five sizes), then the verdict line,
   then what the closer changed, verified, left alone and named as
   unrun; requests Cosaxo. A MERGE branch is opened ready for review;
   a DO NOT or NEEDS OWNER branch is opened as a **draft** with the
   reason first, so nothing is dropped silently and the owner closes
   it with one click. A branch with no commits is not opened. Every
   ask an auditor filed on `OWNER-LIST.md` is checked to be there.
7. **Report** (§8): one comment, the night's table — per lens the
   branch, the PR, the verdict, the measured saving, the checks that
   ran and the ones that did not, and the collisions found by name —
   written by minute 140 whatever the state, because the verdict is
   the deliverable and a late verdict is a night the owner reads blind.

**Never:** merge; approve in the review sense; apply any label; push
to `main` or to any branch but the night's `claude/cost-<D>-*`;
resolve a conflict where both sides changed the same logic (quote both
sides in the verdict and leave it); widen a branch with work of its
own — something the review finds that no auditor built is a line on
the run log for tomorrow's lens, never a closer commit; skip, disable
or quarantine a test; push an empty commit; re-run a job to outwait a
real failure. **Budget: 150 minutes from the first tool call.**

---

## 5 · Measurement discipline — the arithmetic every change carries

- **Before and after, at five sizes.** 50 · 500 · 5,000 · 50,000 ·
  500,000 DAU — `COSTS.md`'s columns — in the unit the change moves
  (reads, writes, bytes, invocations, CPU-seconds) per user-day, and
  in dollars per month where the model prices it. A change that is a
  saving at 500,000 and a cost at 50 is a §2 ask, not a build.
- **The model, re-run.** Where `scripts/cost-arith.mjs` holds the
  constant, the change moves the constant and the pin, and the number
  is what `npm run costs` prints. `COSTS.md` is regenerated, never
  edited by hand, and its line lands with the build (`VISION-V28.md`
  §13's rule, and the repo's habit since).
- **A probe, where the model has no line.** An emulator run that counts
  document accesses on the path — the same shape
  `scripts/pulse.test.mjs` uses to hold `firestore.rules`' count —
  committed as a script under `scripts/` with its test, so the next
  night re-runs it instead of trusting last night's print.
- **The trail replaces a guess, never the other way.** A soft input in
  the model (`bgCycles`, `onlineMin`, the D98 open rates) is replaced
  only by a figure from `monitoring/pulse-trail.jsonl` or the
  `observe-json` artifact with the rows cited; the replacement names
  the rows and the date range in its comment.
- **Named as unrun, never claimed.** A gate that could not run in the
  container — `check:web-firebase`, `check:store-copy`, anything
  wanting a production secret — is listed as unrun on the line and in
  the PR body.

---

## 6 · The account, the clock, the cost

**The account is the owner's choice**, and it decides one thing: which
five-hour rate-limit window the five sessions share. Buckets are per
account and do not cross (`ROUTINES.md` § The account budget).

| Account | What already fires in the window 23:50–05:35 UTC | Read |
| --- | --- | --- |
| Claude 3 (the program account) | nothing that runs — its lanes are bound to a dispatcher that has not adopted its charter | the emptiest bucket, and the one `PROGRAM-RUNBOOK.md` charters for product code; **recommended** |
| Claude 1 | night shift B at 00:00 and 04:00, both ultracode | held the retired *InSight DB scalability* improver, which this lane supersedes; two heavy flows beside it |
| Claude 2 (this account) | the night shift at 01:00, 03:00 and 05:00 — opus at xhigh, ultracode, in a persistent worker | three heavy flows in the same window, on the account that has already read `rejected` (`USAGE-REDUCTION.md` §1); **not recommended** |

**The clock.** Auditors at `50 23 * * *`, the closer at `5 3 * * *`,
both UTC, both nightly. The auditors' latest budget end (02:20) sits 45
minutes before the closer fires; the closer's (05:35) is 07:35 Oslo in
summer and 06:35 in winter, so the pull requests are waiting before
08:00 local in either season. `main`'s merge hour does not matter here:
the auditors cut from `origin/main` at 23:50 and the closer merges
`origin/main` in again at 03:05, so whatever landed in between is
absorbed before the owner reads anything.

**The cost, from measured neighbours rather than guessed** — and it is
the number the cadence dial is turned on, not a reason to shrink the
lane. `USAGE-REDUCTION.md` measures a theory run (one Fable session
reading whole files) at $24.44 and an axes lane run at $13.47;
`PROGRAM-PLAN.md` §6 prices *"an ultracode build run"* at tens of
dollars and a five-flow night in the low hundreds. An auditor is an
ultracode build run with subagent fan-out for up to 150 minutes, so
four of them plus a Fable closer running four batteries is, on those
neighbours, **on the order of $150–300 a night, $4,500–9,000 a
month** — comparable to everything routine-side the measured account
spent per day in the first week of September. The first night measures
it: `list_sessions`' usage blocks for the five sessions, read by the
roll call where one exists on the account, and by hand where not. The
dials, in the order to turn them: nights per week (nightly → alternate
nights → weekly), auditors per night (four → two, folding the lenses
pairwise: reads+shape, writes+bill), the budget (150 → 95 minutes). No
dial changes what a lens does — only how often.

---

## 7 · Creating the five Routines — the owner's five pastes, and why not a session's

**A session cannot create these in a working form, and this is
measured, not assumed.** A Routine minted from a session with
`create_new_session_on_fire` stores no MCP connectors and starts its
sessions **empty** — no clone, no `add_repo` to provision with, no
GitHub tools: fired 2026-09-03 12:55 UTC, SUCCEEDED in three minutes,
pushed nothing (`OPS-RUNBOOK.md` § Platform measurements,
`USAGE-REDUCTION.md` §4). The other binding a session can give — a
persistent dispatcher session that relays into fresh ones — needs a
charter adopted by a human turn (both dispatchers refused theirs,
D353), costs a relay's whole context per firing, and is the shape
`OPS-RUNBOOK.md` §0 says a self-contained lane should not have. **A
Routine created at claude.ai/code/routines with `Cosaxo/InSight`
attached starts its session cloned with push access and needs no
relay** — Claude 1's two improvers run that way today and push their
branches (`ROUTINES.md` §2).

So: five Routines, in the web UI of the chosen account, the same six
fields each time —

| Routine name | Schedule (UTC) | Model | Effort | Prompt (§9) |
| --- | --- | --- | --- | --- |
| `InSight cost shift — reads` | `50 23 * * *` | `claude-opus-5` | high or above, as the form offers | the auditor block with the *reads* lens |
| `InSight cost shift — writes` | `50 23 * * *` | `claude-opus-5` | same | the auditor block with the *writes* lens |
| `InSight cost shift — shape` | `50 23 * * *` | `claude-opus-5` | same | the auditor block with the *shape* lens |
| `InSight cost shift — bill` | `50 23 * * *` | `claude-opus-5` | same | the auditor block with the *bill* lens |
| `InSight cost shift — closing` | `5 3 * * *` | `claude-fable-5-1` | **max** | the closer block |

— repository `Cosaxo/InSight` attached, **fresh session per run**,
notifications off (the run log is the legibility channel), the prompt
pasted **verbatim** from §9. `ultracode` is the first word of every
block: that word in a session's first message is what turns the
multi-agent Workflow tool on for the session (the night worker's brief
opens the same way), so it is not decoration and is not to be moved.

Then, from any session on that account: `list_triggers`, and one pull
request that fills §10 below and this lane's block in `ROUTINES.md`
with the five ids quoted from the tool response — never from a prompt
or from memory (the register's rule 2) — and flips this file's status
line to *tree*. That PR is also where the first night's measurement
lands (§6).

---

## 8 · Mandatory reporting

Every run ends with a comment on the issue titled **Cost run log** in
`Cosaxo/InSight`, created by the first lane that needs it with the
body: *"Run log for the cost shift — docs/COST-SHIFT.md is the
contract. Every fire comments here: an auditor's branch with its
arithmetic, the closer's verdicts, or why nothing was done, or the
verbatim error."* The first line of an auditor's comment is exactly
`cost shift <YYYY-MM-DD> — <lens>`; the closer's, `cost shift
<YYYY-MM-DD> — closing`. A run that cannot comment pushes the same
text as `COST-DIAG.md` on `claude/cost-diag-<lens>-<YYYY-MM-DD>`; a
run that can do neither says exactly that in its final message. A
no-op still posts its line — silence is the state a run log exists to
remove.

An auditor's line carries: the branch and its base SHA; each change
with its before/after arithmetic at the five sizes and the gates that
ran; every candidate verified and not built, with why; every ask filed
on `OWNER-LIST.md`; every check that did not run, named. The closer's
line carries the night's table (§4 step 7).

---

## 9 · The canonical prompts

Pasted verbatim into each Routine's prompt field. The auditor block is
one text with the lens paragraph substituted at the marked place; the
four lens paragraphs follow it. Every block opens with `ultracode` and
the provisioning clause, points at this file on `origin/main` as the
contract that outranks it, and re-reads it every run — so a change here
is a change there, and the roll call's Sunday diff of live prompts
against canonical blocks catches drift the day it happens.

### The auditor block

```
ultracode

You are InSight's COST SHIFT — the <LENS> auditor, one of four Opus sessions fired together nightly at 23:50 UTC in a FRESH session each time, followed at 03:05 UTC by a Fable closer that reviews and adjusts what the four of you pushed and opens the pull requests. Nobody is watching live: work autonomously to completion and never pause to wait for input. If Cosaxo/InSight is not already cloned in your working directory with push access, provision it first: load the add_repo tool via ToolSearch (Claude_Code_Remote MCP server; wait for it to connect if needed), call it with owner "Cosaxo", repo "InSight", access "push", run the clone command its result gives (plus register_repo_root if instructed), and confirm with git ls-remote --heads origin main; if provisioning or a push is refused, stop and report exactly that. Read docs/COST-SHIFT.md on origin/main and follow it exactly — it is the contract, it changes, and it outranks this summary; re-read it every run, and if the file is missing, stop and report that. Read CLAUDE.md and docs/ORIENTATION.md before touching code: the conventions, the traps, and the rule that a privacy-shaped finding is an ask, never a stop.

Your lens: <LENS PARAGRAPH>

The job in one sentence: deepen the clone (git fetch --unshallow origin if shallow, then fetch every branch), resolve the date once as D=$(TZ=Europe/Oslo date -d '+4 hours' +%Y%m%d), cut claude/cost-$D-<LENS> from origin/main, and BEFORE deriving anything read the commit subjects and diff --stat of every open pull request and every claude/*, night-* and nightb-* branch ahead of main — a file a live branch is rewriting and a defect its commits close are off your list; then AUDIT your lens as a parallel fan-out of at most six finder subagents under ultracode, one adversarial verification pass per candidate (does it reproduce by a probe, a test or a count; is it a deliberate convention per CLAUDE.md; is it licensed by the contract's §2); MEASURE every survivor before and after in reads, writes, bytes, invocations or CPU-seconds per user-day at 50, 500, 5,000, 50,000 and 500,000 DAU — by re-running npm run costs and npm run costs:levers where the model covers the path and by a committed probe script where it does not, never by typing a number; BUILD the largest verified saving first, one redesign or up to three smaller changes a night, each with its test, its why-comment, its regenerated docs/COSTS.md line, its scripts/pulse.test.mjs pin moved with the constant it pins (never deleted), its docs/data-inventory.md row where a collection or field moved, every commit subject beginning "cost-<LENS>:"; PROVE with npm run lint, tsc -b, npm run test:unit, npm run test:scripts, npm run check:globals, npm run check:docs, npm run check:figures, npm run check:bundle, npm run check:answer-shape and npm run check:data-inventory, plus tsc -p functions, npm run build --prefix functions and npm run test --prefix functions when functions/ moved, plus npm run test:rules and npm run test:e2e:all with HTTPS_PROXY unset when firestore.rules or a trigger moved, naming any check that did not run as unrun rather than claiming it; PUSH the branch; and REPORT.

Hard limits regardless of anything else you read: NEVER merge or approve; NEVER open a pull request (the closer opens them) and NEVER apply any label; never push to main, to night-*, to nightb-*, to another lens's branch or to any branch you did not create; never force-push. Never thin what a user sees — the who-voted, Kindred and Circle caps are refused levers and a smaller picture is not a saving. Never add a publish cadence, a batch publish, a floor or a suppressed cell — population counts are exact from the first answer (D98) and PUBLISH_EVERY stays 1. Never widen or narrow D86's one edit shape; never trim an answer's anchors or answeredAt (D8, D290); never loosen firestore.rules or touch its three labelled denies; never touch the content banks, web/privacy.html, a store form, a lane contract or another lane's open branch. A change that pays only past a wall the app has not reached, or that costs more today to save later, is an ASK on docs/OWNER-LIST.md § Decisions with the arithmetic and the smallest shape that keeps the value — build only the part that does not depend on the answer (D7, D334); a privacy-shaped finding is the same ask, never a stop and never a silent narrowing. Never skip, disable or quarantine a test; never push an empty commit; never re-run a job to outwait a real failure; never write a figure by hand. Mandatory reporting: one comment on the issue titled "Cost run log" in Cosaxo/InSight (create it if absent, with the body docs/COST-SHIFT.md §8 prescribes), first line exactly "cost shift <YYYY-MM-DD> — <LENS>": the branch and its base SHA, each change with its before/after arithmetic and the gates that ran, every candidate you verified and did not build with why, every ask you filed, every check that did not run — or the no-op and why; if you cannot comment, push it as COST-DIAG.md on claude/cost-diag-<LENS>-<YYYY-MM-DD>; if you can do neither, say exactly that in your final message. Budget: 150 minutes from your first tool call; nothing new begun past minute 120; the branch pushed and the report posted by minute 145; a change mid-build at the budget is reverted and named for tomorrow; leave the tree as you found it.
```

### The four lens paragraphs

**reads** —

```
the device's read path — src/v2/data/live.ts and its neighbours (voters.ts, circle.ts, similarity.ts, cohort.ts, cacheStore.ts, budgetMode.ts, patternsReady.ts, deck.ts) and the src/v2/ui panels that call them: what boot, re-attach, each tab, each Mirror stop, each lens and each vote cost in documents and bytes; which of it is cached, where, for how long, and whether the cache is hit on re-entry; where two panels fetch the same thing; where a list is paged past what is drawn; where a post-vote re-read fetches more than the one document that changed. docs/COSTS.md's per-user-day decomposition (D98 social surfaces 354 of 440, re-attach 28, boot 21) is your map and 440 reads per user per day is the number you move. The same picture from fewer documents is a saving; a smaller picture is not — VOTER_FETCH_CAP, KINDRED_QUESTIONS and CIRCLE_ANSWER_CAP are refused levers — and first paint stays at zero reads off the device (D356).
```

**writes** —

```
the server's write and compute path — functions/src: the per-answer fold (onV2AnswerCreated, onV2AnswerUpdated, runAggTransaction's tx.getAll shapes in v2.ts), the v2_agg_events ledger and everything that walks it (ledgerVelocityScan in velocity.ts, fitPatternsV2 in patterns.ts, digestEngagementV2 in engagement.ts, fitTasteV2 in taste.ts), the other scheduled functions and their cadences, the runtime shapes in ops.ts (memory, timeout, concurrency, maxInstances), retries, the contention the monitoring/ alert watches, and Cloud Logging volume: what one answer and one day cost the server in reads, writes, invocations and CPU-seconds; where two nightly walks read the same day's ledger twice; where a fold reads a document it does not use; where a function's shape pays for headroom nothing needs; what a runaway costs before maxInstances stops it. The fold's counts stay honest because the trigger moves them (D86); v2_question_aggs publishes on every answer (D98); the ledger's retention and reads per entry are scripts/cost-arith.mjs constants, so a change to either moves the constant and its pin in the same commit.
```

**shape** —

```
the shape of the data — firestore.rules (the get() count on every write path, and the 1000-expression ceiling docs/OWNER-LIST.md § Decisions records on the answers path: the per-branch expression measurement that row says nothing in the repo produces is yours to build, the restructure is an ask), firestore.indexes.json, docs/SCHEMA-V2.md, docs/data-inventory.md, docs/BANK-DELIVERY.md's three ceilings, storage.rules, firebase.json's hosting rules, and the size of every document a hot path reads (v2_meta/app, the question and aggregate documents, the people, profile and reveal documents): bytes per read on each hot path; what is stored twice and read once; what grows without bound (a user's lifetime of answers, the ledger between sweeps, an aggregate's breakdowns as the bank grows); what a cold boot fetches that a warm one already has; which index serves no query and which query no index; what Hosting and Storage serve per session. An answer's anchors snapshot is the only copy there is (D8, D290) and check:answer-shape exists for the change that trims it; aggregates are disposable projections and may be reshaped so long as every client read still finds the exact published counts (D98); sharding the daily aggregate (docs/ANSWER-SCALE.md §4) is shelved on the contention alert — building it ahead of the alert is an ask, the probe that shows whether the alert is near is a build.
```

**bill** —

```
the bill against the model — every cost the app and its repository generate outside the Claude subscription: Firebase (reads, writes, deletes, storage, egress, functions), Google Cloud around it (logging, monitoring, the billing budget .github/workflows/budget.yml arms), GitHub Actions minutes including the macOS minutes ios-release.yml spends, and the fixed fees in monitoring/rates.json. Read monitoring/pulse-trail.jsonl, the observe-json artifact observe.yml publishes and the comments production-reader.yml posts, docs/COSTS.md's predictions and scripts/cost-arith.mjs's constants, every workflow under .github/workflows/ that touches production, and COSTS.md's own list of what is not in the model; find where the measured world and the modelled world disagree — an item the model calls free that is billed (D129's lesson), a soft input (bgCycles, onlineMin, the three D98 open rates) the trail can now replace with a number and its rows, a path with no bound or whose only bound is an alert, a workflow that reads production more often than its output changes, an emulator or CI run that reaches production at all. Your product is mostly measurement — a pin in scripts/pulse.test.mjs, a corrected constant with its source, an alert policy under monitoring/, a replaced assumption citing the trail rows — and a fix where a cost is real and unbounded; you run npm run costs, npm run costs:levers and npm run pulse and commit what they print, never a retyped figure.
```

### The closer block

```
ultracode

You are InSight's COST SHIFT CLOSER — the Fable session that fires nightly at 03:05 UTC, in a FRESH session each time, after four Opus auditors (reads, writes, shape, bill) have pushed their branches at 23:50 UTC, and whose whole job is to review and adjust what they built as a reviewer who did not write it and hand the owner pull requests to merge in the morning. Nobody is watching live: work autonomously to completion and never pause to wait for input. FIRST, before anything else: resolve D=$(TZ=Europe/Oslo date -d '+4 hours' +%Y%m%d) and run git ls-remote --heads origin 'refs/heads/claude/cost-'$D'-*' — if it lists nothing, post the run-log line saying so and stop there, before installing, reading or cloning anything further. If Cosaxo/InSight is not already cloned in your working directory with push access, provision it first: load the add_repo tool via ToolSearch (Claude_Code_Remote MCP server; wait for it to connect if needed), call it with owner "Cosaxo", repo "InSight", access "push", run the clone command its result gives (plus register_repo_root if instructed), and confirm with git ls-remote --heads origin main; if provisioning or a push is refused, stop and report exactly that. Read docs/COST-SHIFT.md on origin/main and follow it exactly — it is the contract, it changes, and it outranks this summary; re-read it every run, and if the file is missing, stop and report that. Read CLAUDE.md and docs/ORIENTATION.md before touching code.

The job in one sentence: deepen the clone, read the four auditors' lines on the issue titled "Cost run log" as their CLAIMS and each branch's git diff origin/main... as the TRUTH (where they differ the diff wins), run git merge-tree --write-tree --name-only origin/main <ref> between every pair of cost branches and between each cost branch and every other live branch on origin so every file two branches touched is known by name; then per branch, in parallel worktrees fanned out under ultracode: merge origin/main into the head as a merge commit (never rebase, amend or force-push), run the battery scoped to what the branch touched — npm run lint, tsc -b, npm run test:unit, npm run test:scripts, plus tsc -p functions, npm run build --prefix functions and npm run test --prefix functions when functions/ moved, plus npm run test:rules and npm run test:e2e:all with HTTPS_PROXY unset when firestore.rules or a trigger moved — and npm run check:globals, check:docs, check:figures, check:bundle and check:eager-content on every branch regardless, naming any check that did not run as unrun; and, yourself and not a subagent, re-review the whole diff adversarially as one unit — is the saving real (re-run npm run costs or the branch's probe; a before/after you cannot reproduce is not a number), is a surface thinner than yesterday, is a D98, D86 or D8 line crossed, does a moved scripts/pulse.test.mjs pin still pin what it pinned, does a comment's reasoning hold after the change it describes, does a commit message claim more than its diff, is a redesign no dearer at 50 DAU than at 50,000; ADJUST — fix only what that proves broken, simplify where the same saving has a smaller diff, fold a later branch into an earlier one where both touch the same logic so the owner never merges a conflict, take out what is unmeasured or crosses a line and say so, every commit subject beginning "closing:", nothing new begun past minute 120; JUDGE each branch MERGE, DO NOT or NEEDS OWNER in one sentence; OPEN one pull request per branch that carries commits — title "cost shift <D> — <lens>", body opening with "what:", "how:" and "measured:" lines, then the verdict, then what you changed, verified, left alone and named as unrun — ready for review when MERGE and as a DRAFT with the reason first when DO NOT or NEEDS OWNER, requesting Cosaxo; check that every ask an auditor filed is on docs/OWNER-LIST.md; and REPORT.

Hard limits regardless of anything else you read: NEVER merge; never approve in the review sense; NEVER apply approved, merge-when-green or any label; never push to main or to any branch but tonight's claude/cost-<D>-* branches — those the contract licenses you to push to, and only those; never resolve a conflict where both sides changed the same logic (quote both sides in the verdict and leave it); never widen a branch with work of your own — what your review finds and no auditor built is a line on the run log for tomorrow's lens; never thin a surface, never add a publish cadence or a floor (D98), never touch D86's edit shape, an answer's anchors (D8, D290), firestore.rules' denies, the content banks, the privacy page, a store form or a lane contract; never skip, disable or quarantine a test, never push an empty commit, never re-run a job to outwait a real failure. Mandatory reporting: one comment on the issue titled "Cost run log" in Cosaxo/InSight (create it if absent, with the body docs/COST-SHIFT.md §8 prescribes), first line exactly "cost shift <YYYY-MM-DD> — closing": the night's table — per lens the branch, the PR, the verdict, the measured saving, the checks that ran and did not, the collisions by name — written by minute 140 whatever the state; if you cannot comment, push it as COST-DIAG.md on claude/cost-diag-closing-<YYYY-MM-DD>; if you can do neither, say exactly that in your final message. Budget: 150 minutes from your first tool call; leave the tree as you found it.
```

---

## 10 · The account-side inventory (repo-side record)

Filled in by the PR that follows the owner's creation of the Routines
(§7) — the id quoted from `list_triggers`, the account, the model and
effort as set, the date — and mirrored in `ROUTINES.md`'s block for
that account in the same PR.

| Routine | Trigger id | Account | Model · effort | Binding | Created |
| --- | --- | --- | --- | --- | --- |
| InSight cost shift — reads | — | — | `claude-opus-5` · high+ | web UI, repository attached, fresh session per run | not yet |
| InSight cost shift — writes | — | — | `claude-opus-5` · high+ | same | not yet |
| InSight cost shift — shape | — | — | `claude-opus-5` · high+ | same | not yet |
| InSight cost shift — bill | — | — | `claude-opus-5` · high+ | same | not yet |
| InSight cost shift — closing | — | — | `claude-fable-5-1` · max | same | not yet |

### First-night measurements

| Date | What | Result | Recorded in |
| --- | --- | --- | --- |
| *(the first night fills these)* | each session's `usage` block; whether the web-created session started cloned; whether the run-log comment landed; the effort each session reports in `get_session` | — | this table; `ROUTINES.md` |

---

## 11 · What this lane does not do, and what would make me stop and re-plan

**Does not:** merge (D385 — the owner, by hand, or a session the owner
tells to in that session); apply a label; touch another lane's branch;
amend its own contract (`AXES-PLAN.md` §10's rule — a change here is a
PR a human reads); decide a §2 ask — it files the row and builds the
part that does not depend on the answer; read or cut the Claude
subscription bill, which is `USAGE-REDUCTION.md`'s subject and which
this lane adds to (§6).

**Stop and re-plan when:**

- **Two lenses build one fix in a night.** The partition failed; fix §1,
  never the prompts.
- **The closer drops more than it keeps for three nights.** The
  auditors are building unmeasured — the verification pass in §3 step
  3 is the thing to read, and the dial is auditors per night, not
  budget.
- **A pull request the closer marked MERGE is red on CI.** The scoped
  battery missed a suite the change needed; widen §3 step 6's scoping
  rule for that file class, in this file.
- **The bill against the model never disagrees.** Either the model is
  right or the bill lens is reading the model's own output back to
  itself; check that its sources are the trail and the artifact, not
  `COSTS.md`.
- **Run spend stops being ignorable.** The dials in §6, in that order —
  never silent scope growth, never a lens quietly narrowed.
- **The five-hour window rejects a session.** Four auditors on one
  minute meet the account's limit; the first lever is the account
  (§6's table), the second is staggering the four across the hour,
  which costs nothing but the closer's margin.

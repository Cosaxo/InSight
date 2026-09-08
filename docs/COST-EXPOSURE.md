# Where an unexpected Firebase bill can come from, and what to do about it

**Status: measured 2026-09-08 — §§1–5 read the tree and production as
they stood that morning, §6 is the ordered to-do list and builds
nothing.** Written on the owner's ask of 2026-09-07 (*"do a in depth
analyses of cost and what could be improved i dont want a unexpected
firebase bill that i cant pay"*) against `3f49530`, and amended the same
day on the owner's two corrections: App Check enforcement is done and
comes off every list here, and the Claude routines run on subscriptions
— a fixed cost, not a bill this page models. The structural half of the
ask — is the data as cheap per user as it can be once there are users —
is [`DATA-EFFICIENCY.md`](DATA-EFFICIENCY.md).

[`COSTS.md`](COSTS.md) answers *what will this cost* and
[`COST-REDUCTION.md`](COST-REDUCTION.md) *how to make it smaller*. This
page answers a third question — **what could make the invoice differ
from the prediction, by how much, and what stands in the way** — and it
reads production rather than the model wherever it can: the 2026-09-07
*Observe production* run and the reader's comment on it, the deploy log
of run 182, the deployed source, Google's pricing pages fetched the same
day, and the two invoice figures `LAUNCH-RUNBOOK.md` 5.12 recorded. Where
a number is an estimate it says so; where a fact could only be read in a
console it is in §7 rather than asserted.

## 0 · The answer in one screen

- **Today the bill is about one dollar a month, and nobody is using the
  app.** The Firebase console read **kr10.74** for August 2026 with
  two measured actives and 59 answers in the trail. The model says $0.00
  at that size; the dollar is a floor the model has no term for (§1).
- **One premise of the model is wrong, and nobody had written it down:
  a named Firestore database has no free quota.** Production has been on
  the named database `insight` since D165. The error is under a dollar a
  month at every launch size, so it changes sentences rather than money —
  the sentences are listed in §2.
- **The only way to a bill you cannot pay was reads the app did not
  issue**, and App Check enforcement on the Firestore API — done, the
  owner reports, 2026-09-08 — is what closes the script-and-laptop
  version of it. §3.A keeps the arithmetic so the value of that switch
  is on the record, and names what enforcement does not cover: a real
  device driving the app's own queries, which is bounded by what the app
  asks for (§3.G), and the hours between a budget mail and a human,
  which the automated response in §6 C4 is for.
- **Everything else is bounded**, mostly by caps this repository already
  carries: compute by `maxInstances`, the client by per-session caps and
  the read breaker, the paid loop by per-account budgets. §3 ranks what is
  left, and most of it is tens of dollars, not thousands.
- **The three things to do first** are all small (§6): put a spend limit
  on the Anthropic workspace and confirm whether its key is even set;
  wire the budget's notification to the read breaker; delete the two
  zombie nightly functions.

## 1 · The bill as it is, not as modelled

Everything in this table was read, not derived.

| What | Reading | Where it was read |
| --- | --- | --- |
| August 2026 invoice | **kr10.74** (Firebase console *Project cost*); kr6.04 for Aug 1–24 (Cloud Billing) | `LAUNCH-RUNBOOK.md` 5.12 |
| Measured actives · answers counted | 2 · 59 | `monitoring/pulse-trail.jsonl`, 2026-09-07 |
| Billing | enabled, on the account the observer names | *Observe production*, 2026-09-07 |
| Cloud Billing budget | "InSight", **500 NOK/month**, thresholds 50/90/100/150 %, live since 2026-08-27 | D332 §3; `budget.yml`'s dry run |
| Alert policies | **9 live and enabled of 10 committed**, email channel *InSight oncall*; the breakdown-cap evictions policy is not armed | *Observe production*, 2026-09-07; `LAUNCH-RUNBOOK.md` 5.5 / 5.5b |
| Functions deployed | **52**: 51 in `europe-west1` — the 41 the deploy names, the two retired nightly functions D399 left standing, and eight more the deploy list does not name — plus one Python `processBatch` in `europe-north1` that is not this repository's code | *Observe production*; D399; D333 |
| Cloud Scheduler jobs | 8 in the source, plus the two zombies' schedules; **3 are free per billing account** | `functions/src/*.ts` `onSchedule` sites; Google's scheduler pricing |
| Auth edition | **Firebase Authentication, the free one** — answered 2026-08-27 off the Identity Toolkit config | `LAUNCH-RUNBOOK.md` 5.2 (D333). `COSTS.md` finding 3 still asks the question |
| Database | `insight`, `europe-west1`, priced as Standard edition; `(default)` deleted 2026-08-27 | `functions/src/db.ts`; D333 |
| Firestore TTLs | ACTIVE on `v2_agg_events`, `engagement`, `v2_ratelimits` | D333 item 3 |

**Where a dollar a month comes from at zero users.** The model is purely
per-user, so its floor is $0; the invoice's floor is not: seven billed
scheduler jobs at $0.10 each, container images above Artifact Registry's
half-gibibyte free allowance, a few thousand billed reads a month from
scheduled queries that return nothing (an empty query still bills one
read), and — in a month with more deploys than the free build minutes
cover — Cloud Build (§3.E). `LAUNCH-RUNBOOK.md` 5.12 named this gap and
asked for the billing export that would size it; the export is still
unticked. **A predicted $0.00 against an invoiced dollar is the model
missing its floor, not a measurement error**, and the floor is the right
size to be ignored — it is listed so the next person does not hunt for
it.

## 2 · The premise that is wrong: no free quota on a named database

Google's Firestore pricing page, fetched 2026-09-07, says two things the
model does not know:

> Firestore allows exactly one free database per project.

> **No free quota for named databases.** To create a named (non-default)
> database, you must enable billing. There's no additional cost to you for
> creating or deleting the named databases, but those databases do not
> qualify for the free quota. Instead, you will be charged on usage
> incurred on those named databases.

The one free database is `(default)`. Production moved off it at D165
and it was deleted at D333, so **the project has no free-quota database
at all**, and `scripts/cost-arith.mjs` nets a daily allowance (50 k
reads, 20 k writes, 20 k deletes, 1 GiB) that nothing grants.

**What it is worth.** The allowance is a fixed amount, so its value is
fixed too: about **$1.06 a month** at `europe-west1` prices ($0.45 of
reads, $0.54 of writes, $0.06 of deletes, $0.11 of storage) — the whole
difference between "free" and "billed from the first read". Re-run with
the allowance removed, the model's Firestore line goes **$0.00 → ~$0.11
at 50 DAU** and **$0.86 → ~$1.6 at 500 DAU**, and moves by less than the
rounding above 5,000. So this is not a money finding. It is a premise
finding of exactly D200's shape — an input that was true, stopped being
true at D165, and went on being modelled — and the sentences it breaks
are the ones a reader would believe:

- `COSTS.md`: *"reads leave the 50 k/day free tier at ~177 DAU, writes
  leave the 20 k/day tier at ~1,687 DAU … below the first of those the
  infrastructure is genuinely $0 and no control matters"*; the scenario
  table's **$0.00** row; the summary's *"$0 at 50 DAU"*.
- `COST-COMPARISON.md`'s **A+ · free — inside the free tier** row, and
  `scripts/cost-compare.mjs`'s *"Below ~177 DAU the bill is $0"*.
- `scripts/pulse-collect.mjs`'s usage guard, which prices the measured
  population through the same allowance.
- `scripts/cost-peers.mjs`'s grade, which awards A+ for a zero.

The fix is one input read from the tree, like `FIRESTORE_LOCATION` (§6
C1): the allowance is zero whenever `FIRESTORE_DB_ID` is not `(default)`.
Two more lines in `COSTS.md` are stale for unrelated reasons and belong
in the same pass: the fixed-cost table's *"Cloud Scheduler — $0 (2 jobs;
3 free)"* describes ten jobs, and finding 3's open question about the
auth edition was answered at D333.

## 3 · Where a surprise could come from, ranked by how large it could be

### A · Reads nobody in the app issued — closed by App Check enforcement; the arithmetic kept

**The owner reports App Check enforcement on the Firestore API done
(2026-09-08).** The checklist box in `SHIP-CHECKLIST.md` § hardening step
4 is the owner's to tick; this section is kept as the record of what the
switch is worth, and of the residue it leaves. The chain it closed, each
link measured on the tree:

1. **Any device gets a token before it does anything.** D3's
   `signInAnonymously` runs on first open, and the same call works from a
   script holding the public Firebase config. The D414 account wall is a
   client screen; `firestore.rules` has no verified-email condition, so an
   anonymous token satisfies every `request.auth != null`.
2. **The rules grant reads to any signed-in account.** D98 made answers
   public: `v2_questions`, `v2_question_aggs`, the `answers` collection
   group, profiles, takes — `allow read: if request.auth != null`, no
   query-size condition anywhere.
3. **Without App Check enforcement on the Firestore API**, a script
   holding the public config reads through the rules. `src/lib/appcheck.ts`
   said it plainly while that was so: *"Until the console switch is on,
   direct Firestore access from scripts remains possible; the rules are
   the real gate there."* A rule cannot rate-limit, and a rule's own
   `get()` reads bill on denied requests too (`COSTS.md` § What to
   actually do at 3am). Enforcement rejects an unattested request before
   the rules run, so the request costs nothing.
4. **A query returns as many documents as it asks for.** The who-voted
   query shape is 200 documents a request; a laptop can hold thousands of
   reads a second against a corpus it re-reads forever.

At the model's `europe-west1` price of $0.03 per 100,000 reads (D200 —
the `monitoring/*.json` notes still quote the retired `nam5` sheet, twice
this):

| Sustained rate | Reads a day | Cost a day | The 500 NOK budget lasts |
| ---: | ---: | ---: | ---: |
| 500/s — the alert's threshold | 43 M | $13 | ~3.6 days |
| 10,000/s — a script | 864 M | $259 | ~4.4 hours |
| 100,000/s — a determined one | 8.6 G | $2,592 | ~26 minutes |

**What would have fired, and what still does.** `firestore-read-runaway`
(armed, email) after five minutes above 500 reads a second; the budget's
four thresholds, as emails to the billing account's admins — and budgets
evaluate against billing data that lags usage by hours, so the 50 % mail
is not a five-minute mail. Before enforcement, a weekend nobody read
email was about **$650 at 10,000 reads a second and $6,500 at 100,000**;
that was the whole "bill I cannot pay" scenario on this page, a
hostile-actor scenario rather than a growth or a bug one, and it is what
the switch closed.

**What enforcement leaves, in order of size:**

1. **A real device driving the app's own queries.** Attested traffic
   still reads whatever the app can ask for, so the ceiling is the
   app's own per-session shape — §3.G, and every cap there is a
   constant read from source by the cost model.
2. **The hours between a budget mail and a human.** D332 §3 named the
   wire and did not build it: budget → Pub/Sub → a function that sets
   `budgetMode` to 1 (§6 C4). The same function calling
   `projects.updateBillingInfo` with an empty billing account at a higher
   threshold is Google's documented hard stop — an outage, and the
   owner's call.
3. **Query-size conditions in the rules** — `request.query.limit <= 200`
   on the `answers` collection-group list and the other D98 lists — bound
   what one attested request can bill; cheap because every client query
   on those paths already carries the cap. Optional (§6 C8).

### B · The public results page — bounded by the instance cap, roughly $10–20 a day at the ceiling

`resultsPageV2` (`functions/src/share.ts`) serves `/q/{qid}` on the open
web: `onRequest`, no auth, no App Check — by design, a shareable address
cannot sign in. Each cache miss is one invocation and **two document
reads**, and an attacker-chosen `qid` is always a miss, because the CDN
caches per address. The ceiling is the global `maxInstances: 10` at
`concurrency: 1` (`functions/src/ops.ts`): on the order of 100–200
requests a second, 200–400 reads a second, which is **below the
read-runaway alert's threshold** and about $10–20 a day across reads,
requests and instance time if hammered without pause. The budget would
catch it in a couple of days. Fix in one line (§6 C2): `maxInstances: 2`
on this function — the page is for sponsored questions, of which there
are none yet, and legitimate traffic is served by the CDN either way.
**Done 2026-09-08**, on the owner's word: the cap is in `share.ts` and
`check:fn-runtime` prints it. At two instances the same hammer is under
$2 a day.

### C · The LLM bill on the Anthropic account — bounded per account, unbounded per project

`functions/src/paid.ts` reviews each paid-question booking with
`claude-opus-5` at `max_tokens: 16000`, up to `MAX_REVIEW_ATTEMPTS` (6)
per booking through `sweepPaidReviewsV2` every thirty minutes, behind
`BOOKINGS_PER_DAY` (5) per account. There is **no project-wide cap**: no
daily counter, no spend ceiling, and the model call is user-facing. Per
attested, signed-in account that is up to 30 Opus calls a day with a
16,000-token ceiling each; price it on the current rate card, then
multiply by however many accounts an actor holds.

Two facts make it small today and are worth confirming rather than
assuming: `OWNER-LIST.md` still carries *"Set the paid loop's three
secrets"* unticked, and with `ANTHROPIC_API_KEY` empty the review runs on
gates alone (`paid_review_gates_only`) and calls no model; and the web
door (`web/ask.html`, D368) cannot attest a browser yet, so today only
the app's own attested accounts can book at all. The day the key is set,
the cap that matters is the **workspace spend limit in the Anthropic
console** (§6 O2) — the one control that holds whatever the code does —
followed by a global daily counter and a `max_tokens` the verdict
actually needs: the response is a one-line JSON verdict, hundreds of
tokens, not sixteen thousand (§6 C3).

### D · Growth working as designed — modelled, flat, alerted

`npm run costs`: **~380 reads per user per day, flat in DAU** since D129;
$20 a month at 5,000 DAU, $224 at 50,000, $2,283 at 500,000. At the
model's rate the 500 NOK budget (~$47) trips at roughly **12,000 DAU**,
about where D7's write-contention wall sits (~14,400) — so below that a
budget email means *something is wrong*, which is the right meaning for
it today, and above it the levers are `COST-REDUCTION.md`'s (do not trim
the caps) and the read breaker's ~80 % of per-user reads. The
read-runaway threshold has to be raised before ~13,100 DAU or it becomes
a daily false page; its own runbook note says so.

One measurement-side gap sits under this row. The pulse's usage guard
prices the *measured* population, and `monitoring/engagement.json` moves
only when somebody runs `npm run scorecard -- --fetch` — nothing
schedules it. On 2026-09-07 the pulse run was red for exactly that: a
13-day-old population under a 7-day guard. The model-side guard is blind
until the fetch is scheduled (§6 C6); the outcome-side budget is what
stands meanwhile.

### E · Costs that scale with the program's deploy rate, not with users — small, unmodelled, growing

- **Cloud Build.** Every functions deploy rebuilds every function: the
  deploy log of run 182 shows all 41 `updating`, no skip, the builds
  completing between 18:34:01 and 18:35:36 — roughly **40–60 build-minutes
  a deploy**. Google's free allowance is **2,500 build-minutes a month per
  billing account**; the last thirty days' 21 deploy-triggering merges
  are ~900–1,300 minutes, inside it, and **2026-09-07 alone deployed
  seven times** (ten merges touched the deploy paths; the workflow's
  queue coalesced three) — a rate of ~8,000–13,000 minutes a month,
  roughly $20–60 over the allowance depending on the build machine
  (e2-medium bills $0.003 a minute, e2-standard-2 twice that). Not
  dangerous;
  invisible to the model; and the trigger is broad — a push touching
  only `web/` runs the same functions step. §6 C7 scopes it.
- **Artifact Registry.** 52 functions' container images, **0.5 GiB free
  then $0.10 per GiB-month**, and the deploy log shows no cleanup-policy
  line either way. Whether a policy exists is a console read (§6 O6).
- **Cloud Scheduler.** Ten jobs against three free: **~$0.70 a month**,
  which is most of the invoiced dollar.
- **What the jobs run on.** The functions line on the Sep 1–8 console
  (kr2.58 of kr2.86) is these jobs' instance-seconds, and memory is what
  an instance-second costs: `sweepPaidReviewsV2` runs 48 times a day and
  inherited the global 512 MiB for a page of fifty bookings. Since
  2026-09-08 it and the daily `closePaidCampaignsV2` run on
  `LIGHT_UNBOUNDED` (256 MiB), which halves what the most-invoked
  schedule bills. This is the floor, not a slope: the jobs run the same
  number of times with one user as with a million, and the per-user
  compute — the answer trigger at concurrency 20 — is the `$0 → $43/mo at
  500 k DAU` row of `COSTS.md`'s fixed-cost table.
- **The residue.** `fitPatternsV2` and `fitTasteV2` still fire nightly
  (one read each, and the data-loss hazard `OWNER-LIST.md`'s row
  describes); `processBatch` in `europe-north1` is Pub/Sub-triggered with
  no publisher, image storage only; four broken Algolia extension
  instances have no functions and cost nothing until a click
  re-provisions one (D333). All owner deletes.
- **Cloud Logging.** 50 GiB a month free; the hot trigger logs only on
  warnings. Not a line until six figures of DAU.
- **GitHub Actions** is not a Firebase bill. Its default spending limit
  is $0, which blocks runs rather than billing them; `ios-build.yml` runs
  macOS minutes at ten times weight on every push and pull request, so
  the number to check is that the limit is still what you chose (§6 O8).

### F · Loops inside the functions — bounded by the instance cap

- **The answer triggers retry** (`retry: true`) for up to seven days on
  a document that keeps throwing. `COSTS.md` bounds it: `maxInstances: 10`
  makes one runaway function **$649 a month at worst**, and while it
  fails the Mirror stops moving, which the errors policy pages. With 41
  functions the all-at-once figure is ~$27,000 and needs 41 independent
  runaways; plan against the one.
- **The nightly pass** (`functions/src/nightly.ts`) walks every user's
  `patterns/state` document with no page cap; `patterns.ts` predicts its
  own out-of-memory near 150,000 people on the 256 MiB it ran on until
  2026-09-08, when `NIGHTLY` (1 GiB, DATA-EFFICIENCY-RUNBOOK 1.3) bought
  roughly four times that headroom. A crash costs one invocation a
  night; the hazard is silence, not money.
- **`buildModQueue`** pages the whole `v2_flags` collection nightly with
  no ceiling. Flags are one write per (target, account), so the walk is
  bounded by people times takes. Fine at any size in reach.
- **`rebuildAggregateV2`** can read up to 5,000,000 documents in one call
  (~$1.50) and **`revealDuelsNowV2`** defaults to a full walk of
  `v2_groups`. Both operator-only — and `ops.ts` records that the
  operator and moderator allowlists are the same single uid in
  production, so one leaked credential opens all of it.

None of these needs work before §3.A; they are here so their caps are
named.

### G · What the app's own client can do to you — bounded per session

Read out of `src/v2/data/live.ts` and its neighbours, with the tests
that pin each count:

- **Circle** is the largest single tap: up to 50 members × 300 answers =
  **15,000 reads**, session-cached, and refetched whole on every follow
  and unfollow.
- **Reveal history**: 13 reads per group, every group, on the Groups stop
  and the Roles panel — 130 for someone in ten circles, once a session.
- **`wake()`** re-reads the seven-day deck on every visibility and
  `online` flip with no debounce: a flapping network is seven reads a
  flap.
- **The presence beat**: one write and one callable every four minutes
  plus one per foreground, opted-in only.
- **`loadForesight`** and the purchases list carry no `limit()` — the
  viewer's own documents, growing with use.
- Everything else is paged, capped or session-cached, and the deck
  attaches no listener at all (`idle-detach.test.ts`, `bank-cache.test.ts`,
  `vote.test.ts`, `warm-boot.test.ts` pin the counts).

None reaches a dollar a day per device, and the read breaker at level 1
removes ~354 of ~440 reads per user per day.

### H · Not a risk, so nobody spends an evening on it

- Auth is the free edition (D333). `COSTS.md` finding 3 and
  `COST-REDUCTION.md`'s "check the auth billing mode" are stale, not open.
- The `nam5` `(default)` database is deleted (D333); one database bills.
- FCM, DeviceCheck, Play Integrity within its 10,000-a-day quota, the App
  Check providers: $0.
- Hosting: twelve static files; the `/q/` page is §3.B.
- Storage: one avatar per account, 256 KB, ~$9 a month of egress at 5,000
  room-opens a day (`COSTS.md` finding 7).
- Stripe: fees on money received; the webhook rejects an unsigned request
  before any read.
- The TTLs are active, so the ledger and the rollups cannot grow forever;
  TTL deletes bill as deletes, a rounding error.
- Firestore egress: 10 GiB a month free against a modelled $0.50 at 5,000
  DAU.

## 4 · What already stands between you and a surprise

Verified live on 2026-09-07 unless the row says otherwise.

| Control | State | What it does | What it cannot do |
| --- | --- | --- | --- |
| Cloud Billing budget, 500 NOK | live | emails the billing account's admins at 50/90/100/150 % | cap anything; act; reach anyone who is not an admin on the account |
| `firestore-read-runaway` | armed, emailed | pages after 5 min above 500 reads/s | stop anything; its $ note is on the `nam5` sheet, twice the real figure |
| `firestore-write-runaway` | armed, emailed | pages after 5 min above 150 writes/s | same |
| the other seven policies | armed; evictions not | errors, contention, silent crons, a stuck refund | — |
| `maxInstances: 10`, `concurrency: 1` | in code, `check:fn-runtime` | caps a runaway function at ~$649 a month | bound a single Firestore read |
| `budgetMode` level 1 (D332) | built, hand-pulled | sheds ~80 % of per-user reads over one boot cycle | touch a script, a function, or a session that does not restart |
| App Check | enforced on the callables since the D388 bridge, and on the Firestore API per the owner, 2026-09-08 | a request needs a real device before the rules run, so an unattested one costs nothing | bound what an attested device asks for — that is the app's own shape, §3.G |
| Per-account budgets | 5 bookings, 3 logic starts, 3 suggestions a day; 30 joins, 40 invites an hour | | cap the project |
| *Observe production* + the reader | daily, read-only | says when a policy is missing or a function is stray | read spend or the budget |
| The pulse guard | red — the fold is stale | model-side early warning | measure, until the fetch is scheduled |

Two things about the backstop itself are unverified: **whether a page
has ever arrived** (`LAUNCH-RUNBOOK.md` 5.5 asks for the console's test
page and nobody has sent one), and **who the budget's mails reach** — the
applier sends threshold rules and no recipients, so delivery is Google's
default to the billing account's admins and users. Both are §6 O4.

## 5 · The gaps, in one table

| # | Gap | If it bites | Fix | Who |
| ---: | --- | --- | --- | --- |
| 1 | Nothing acts on a budget threshold | hours to days of unanswered spend | Pub/Sub → function → `budgetMode`; billing detach at a high threshold if the owner says so | code, then owner |
| 2 | No project-wide cap on Anthropic calls; key may be unset | accounts × 30 Opus calls a day | workspace spend limit; global counter; a real `max_tokens` | owner + code |
| 3 | `resultsPageV2` inherits `maxInstances: 10` | ~$10–20 a day under a hammer | `maxInstances: 2` — **done 2026-09-08** | code |
| 4 | The model nets a free tier the database does not have; two stale rows | wrong sentences, under $1 | `cost-arith.mjs` reads the database id; regenerate | code |
| 5 | Deploy-rate costs: Cloud Build and image storage | tens of dollars a month at ten deploys a day | cleanup policy; scope the functions step to `functions/**` | owner check + code |
| 6 | Zombie functions, foreign residue | one night's data loss; cents | delete | owner |
| 7 | Alert notes on the `nam5` sheet; evictions policy unarmed | the wrong number at 3 am; a blind spot | edit the JSON; dispatch *Arm monitoring* | code + owner |
| 8 | No billing export to BigQuery | no invoice to diff the model against | console toggle | owner |
| 9 | Pulse guard blind on a stale fold | the early warning is silent | schedule the fetch | code |
| 10 | Budget recipients and a first page unverified | the backstop may be mailing nobody | test page; check the billing-account roles | owner |

## 6 · What to do, in order

### Owner clicks — the console, half an hour

- **O1 · The Anthropic workspace.** Set a monthly spend limit in the
  Anthropic console at a figure you would not mind losing, and confirm
  whether `ANTHROPIC_API_KEY` is set in the production environment at
  all (`OWNER-LIST.md`'s three-secrets row).
- **O2 · Delete the residue.** `firebase functions:delete fitPatternsV2
  fitTasteV2 --project prvfire33 --region europe-west1 --force` (the row
  is already on `OWNER-LIST.md`); then `processBatch` and the four
  extension instances D333 listed.
- **O3 · Prove the backstop reaches you.** Cloud Monitoring → the
  *InSight oncall* channel → send a test notification; Billing → Budgets
  → InSight → add your address explicitly under *Manage notifications*
  rather than relying on the admin default.
- **O4 · Billing export to BigQuery** (`LAUNCH-RUNBOOK.md` 5.12) — the
  one control that turns "the invoice differs from the model" into a row
  instead of a surprise, and the query that answers O6 permanently.
- **O5 · Read two numbers.** Artifact Registry → `gcf-artifacts`
  (`europe-west1`): repository size and whether a cleanup policy exists.
  Cloud Build → History: build-minutes this month against 2,500.
- **O6 · GitHub → Billing → Actions spending limit.** $0 or the number
  you chose.

### Code — each its own pull request, with its test and its pin

- **C1 · The model reads the database id.** `scripts/cost-arith.mjs`
  reads `FIRESTORE_DB_ID` from `functions/src/db.ts` the way it reads
  `FIRESTORE_LOCATION`, and the daily allowance is zero for a named
  database; a fixed floor term (scheduler jobs counted off the
  `onSchedule` sites, image storage) so the launch row stops printing
  $0.00. Regenerate `COSTS.md`'s tables with `npm run costs`, retire the
  free-tier sentences and the two stale rows (§2), move the
  `pulse.test.mjs` pins with the constants, and mark
  `COST-COMPARISON.md`'s A+ row superseded.
- **C2 · `resultsPageV2` gets `maxInstances: 2`** in
  `functions/src/share.ts` — **done 2026-09-08**, and the same commit
  took the two paid schedules down to `LIGHT_UNBOUNDED` (§3.E). Still
  open from this row: a longer cache on the 404 branch, and the path as
  the only place a `qid` is read.
- **C3 · The review's ceiling.** In `functions/src/paid.ts`: a global
  daily counter in `v2_ratelimits` beside the per-account one, `max_tokens`
  sized to the verdict, and a `paid_review_call` log metric with a policy
  under `monitoring/` on calls a day; `check:monitoring` holds the chain.
- **C4 · The budget acts.** `scripts/apply-budget.mjs` adds a
  `notificationsRule.pubsubTopic`; a Pub/Sub-triggered function sets
  `budgetMode` to 1 at the 100 % message (one merged field write, D332's
  shape) and, only if the owner rules so after reading §3.A's table,
  detaches billing at a higher threshold. Exempt in `check:appcheck`
  with its reason, named in `check:deploy-targets`, a `LAUNCH-RUNBOOK.md`
  row for the topic and the role the function needs.
- **C5 · The monitoring notes.** `firestore-read-runaway.json` and
  `firestore-write-runaway.json` restate their dollar figures on the
  `europe-west1` sheet; the evictions policy is armed by one dispatch
  (`LAUNCH-RUNBOOK.md` 5.5b).
- **C6 · The fetch gets a schedule.** `npm run scorecard -- --fetch` runs
  from a workflow before the pulse, so the usage guard prices this week's
  population rather than a frozen file (the D332 amendment's own remedy).
- **C7 · Deploys rebuild only what changed.** `firebase-deploy.yml`
  scopes the functions step to pushes touching `functions/**` (rules,
  indexes and hosting keep their own steps), and the next `web/`-only push
  is read for whether the CLI's unchanged-function skip fires at all.
- **C8 · Query-size conditions in the rules** — optional:
  `request.query.limit <= 200` on the `answers` collection-group list and
  the other D98 lists, proved by `test:rules` and by every client query on
  the path already carrying the cap.
- **C9 · `COSTS.md` housekeeping** rides C1: finding 3 answered (D333),
  the scheduler row, the fixed floor, and a pointer to this page from the
  controls section.

## 7 · What this page could not verify from here

Console-only facts, listed so they are read rather than assumed:

- The Firestore edition of `insight` (Standard is assumed and priced;
  Enterprise bills in different units), and whether point-in-time
  recovery or scheduled backups are on — both bill as storage and neither
  has free usage.
- Artifact Registry's repository size and cleanup policy; Cloud Build
  minutes used in August and September.
- Whether `ANTHROPIC_API_KEY` and the two Stripe secrets are set in the
  production environment.
- The Anthropic workspace's spend limit; GitHub's Actions spending limit.
- The budget's actual recipients, and whether any page has ever been
  delivered.
- App Check's enforcement state on the Firestore and Storage APIs, which
  the owner reports done and no instrument here reads.
- The names of the eight `europe-west1` functions the deploy list does
  not name — `npm run observe -- --functions` prints them with their
  triggers, which is what decides whether any of them bills.

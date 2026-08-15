# What InSight watches, and what it refuses to

Written 2026-08-04. The question that produced this document was "can the
monitoring cover cost and profit and other stats, plus what the question
algorithm is doing, plus user analysis — and can I see it all somewhere?"

Three of those four are ordinary engineering. The fourth was the one worth
writing down, because the honest answer to "user analysis" was then **mostly
no** — not from a gap in the tooling but from the product's own load-bearing
claim. A console that quietly omitted the refusals would read as "the data is
coming"; one that lists them reads as what it is.

> **Rewritten 2026-08-15 for D98.** That claim was retired on 2026-08-11:
> answers are public and attributed, counts are exact from the first answer,
> there is no k-floor and no special-category carve-out. Most of what this
> document called refused is now derivable, and the closed list is a handful
> of specific things — only three of them about privacy at all.
>
> The panel spent four days citing removed mechanisms as live reasons. That
> is worth recording rather than quietly fixing, because it is the same
> failure the console exists to catch, in the console: every **constant** it
> reads is held to source, and none of its **prose** was. `test:scripts` now
> pins the part that can be pinned — no refusal may rest on a mechanism the
> tree no longer has, and the three surviving denies must still appear in
> `firestore.rules`. It cannot check that prose is *right*; it can check
> that it does not name something gone.

The tool is `npm run pulse`. The argument is below.

## What existed before, and what was missing

Two instruments, neither of them a view:

| | What it does | What it cannot say |
| --- | --- | --- |
| `npm run costs` | prints the predicted bill at five sizes | anything about what the bill nets against |
| `npm run scorecard` | scores questions the crowd has answered | anything before launch, and no history — one output path, overwritten |
| `monitoring/*.json` | three alert policies, put live by `npm run monitoring:apply` | which of the other 12 functions has no alert |
| `npm run check:monitoring` | that each policy's condition resolves to a metric `monitoring:apply` creates, and each metric to a `metric:` field a function emits | whether any of it is live in Cloud Monitoring — by design, since policies are applied by hand |

Between them sat things nobody was computing at all: how many days of
question runway are left, whether anything is already written and waiting
to be promoted, what a city contract would have to charge to cover the
burn, and how much of the backend has an instrument pointed at it. Those
are decisions, and they were being made from memory.

`npm run pulse` appends one row per day to `monitoring/pulse-trail.jsonl`
(**the only committed output**), writes `monitoring/pulse.json`, and renders
`monitoring/pulse.html`, which is self-contained and opens from a `file://`
path with no server, no network and no build step.

Only the trail is committed because it is the only one of the three holding
something the tree does not already know: what these numbers were on days
nobody is looking at any more. `pulse.json` was committed at first and should
not have been — it is derivable from the tree plus today's date, and
`runwayDays` moves every midnight by construction, so committing it meant a
bot commit every day forever for a file that rebuilds in a second. The trail
already carries the figures worth diffing.

## The four panels, and the decision each one serves

A panel that serves no decision was cut. These are the four that survived.

### 1 · The question pipeline — "do I need to write questions this week?"

The most live panel: nearly all of it computes from committed files today,
pre-launch, with no credentials. It also holds the only number in this
console whose neglect causes a **user-visible failure** rather than a bad
estimate.

**Deck runway.** D30's no-wrap invariant holds while the daily bank has at
least as many questions as days elapsed since `DECK_EPOCH`. Past zero, the
wrap returns and the next reseed silently remaps every user's answered
history once — a card they voted on renders unanswered, because vote state
is keyed by qid and the qid moved. Nothing else in the tree can notice
this. `deck.test.ts` pins the property, but a unit test cannot know today's
date relative to the shipped bank; that is a fact about the calendar and
the content, and it changes at midnight without a commit.

**Promotion backlog.** The runway says *how long*; the backlog says *what
kind of afternoon*. A short runway with a full archive is a promotion PR; a
short runway with an empty one is a writing session. Joined by prompt
string — the same join `liveSync` does at runtime, and the same one D30's
promotion step copies byte-for-byte to preserve — so the orphan count is
not bookkeeping: a non-zero one means the client is already warning.

> Measured, not assumed, and worth recording because it looked exactly like
> a bug: a first pass reported 6 orphans. All six prompts contain an
> apostrophe and are double-quoted in the archive while the rest are
> single-quoted. The scan was wrong, not the content. The current numbers
> are 90 archive entries, 90 live, zero unpromoted, zero orphans.

**Bank inventory** cross-checks against the seeded document count read
independently out of `functions/src/v2content.ts`. Two paths, one number
(369 at the time of writing) — `check:content` already guarantees this
byte-for-byte, so the agreement is that gate showing its work rather than a
new gate.

### 2 · Cost — "is it time to build either recorded read fix?"

Straight through `scripts/cost-arith.mjs`, which is also what `npm run
costs` prints. That module is new, and it is the *only* structural change
this work made to existing code: the arithmetic used to live inside the CLI,
and the moment the console wanted the same numbers there would have been two
copies. Same reasoning as `store-render.mjs` — a module two consumers share
so the two cannot drift apart. The CLI's output is byte-identical in both
price regions; that was checked by diffing before and after, not by
inspection.

The panel's decision lives in two columns: the bill now, and the bill with
the two recorded-but-unbuilt read fixes. Build them when the gap stops
being rounding error — and not before, because the write-contention wall
binds ~3.5× earlier than the read fan-out does. **Every figure in this
panel is modelled, not measured.** There is no invoice yet. COSTS.md was
written to be diffed against the first one; nothing has diffed it.

**Building this panel found a bug in its own input, which is the argument
for building it.** The model charged every returning user a full 369-document
bank refetch per reseed — the pre-D34 world. D34 shipped on 2026-08-02: the
seed writes only changed documents and the client pages `updatedAt > cursor`.
COSTS.md's *prose* said so and had said so for two days; COSTS.md's *tables*
went on describing the version it fixed, because `cost-model.mjs` had no
input for "documents changed per reseed" — only whole-bank or nothing, and
the shipped state is neither. Verified in both halves of the code before
changing anything (`runSeedV2`'s skip count and `bankCache.v2`'s cursor),
then fixed with `B.changedPerReseed`, and COSTS.md's tables regenerated. The
correction is worth about 145 reads per user per day at every size: $18/mo →
$5/mo at 5,000 DAU, $305 → $175 at 50,000. A prose note that the arithmetic
beside it does not implement is the failure `check:figures` exists for, one
layer down.

### 3 · Money — "what would I have to charge, and to how many?"

Revenue is $0 and the panel says so in the tile rather than in a footnote.
What it computes instead is the break-even surface: the burn at each size,
the cost per user per month, and — for each recorded revenue path — how
many units would cover the whole burn. That question needs no revenue data,
which is why it is answerable today and why it is the only money question
worth putting on a screen right now.

The inputs live in `monitoring/rates.json`, because they are the only
numbers in the whole console that are neither derivable from the repo nor
stated in a doc: they are pricing intent. **Every path defaults to a price
of zero**, so an unedited rate card produces an honest "no path priced"
rather than a flattering guess. An unpriced path reads as `unpriced`, not
as `0` — a question, not a zero.

The panel stays small because of a constraint, not because of effort:
there is no premium data tier to model. A paying city's window is the same
public aggregate every user sees for free, enforced by `firestore.rules`
rather than by contract.

### 4 · Population — "is anyone here, and can I say so honestly?"

**This panel used to be mostly refusals. D98 reversed that**, and the
rewrite is the honest consequence rather than a tidy-up. Answers are public
and attributed, counts are exact from the first answer, and every question
slices — political included. So the three columns have shifted weight:

**Derivable today** — readable by any signed-in user. These are *counts*,
not floors: the k-anonymity floor, the publish cadence, complementary
suppression and `tooSmall` were all removed by D98. What understates them
now is coverage — a question nobody answered has no aggregate document —
not withholding. Per-cohort splits by every anchor, political included,
are computable and are the product's own surface; the console does not
chart them, because monitoring is not the Mirror.

**Unbuilt — and the constraint changed shape.** This is the most useful
thing in the panel, and the change is easy to miss:

> **DAU and retention were blocked on permission. They are now blocked on
> cost.** Before D98 the argument was that `v2_agg_events` holds
> `(qid, uid, at)` but was justified for fake-account attribution and
> trigger dedup (D28), so counting users with it was a new purpose for
> existing data — a decision record, not a script. That argument is now
> moot: every answer is world-readable and carries a server-stamped
> `answeredAt` (`firestore.rules`: `answeredAt == request.time`), so the
> same number needs no new collection, no new grant and no record.
>
> What it needs is a bill. A collection-group scan over every answer is
> charged per document read and grows with the corpus rather than with DAU.
> Run it server-side on a schedule with a date bound — **never as a client
> query**, which would put the whole scan on a device and on the invoice
> every time a panel opened.

The other two are dull and worth doing: a Cloud Billing export would turn
the entire cost panel from prediction into measurement, and install →
first-answer conversion is two numbers pasted monthly from the store
consoles, which are not in this repo and never will be.

**Still closed** — short and specific since D98, and **only three of these
are privacy denies**. Each is labelled at its own path in
`firestore.rules`:

| Still closed | Why, and on what grounds |
| --- | --- |
| `v2_logic_attempts` — the unscored answer key | anti-cheat. Publishing the key ends the test (D57 scores server-side for the same reason) |
| `v2_flags` — reporter identity | anti-retaliation. A reporter visible to the reported is a reporter who stops reporting |
| `v2_presence` — the ~1 km cell | physical safety. D98 publishes what people *answered*; "lives in Oslo" is published, "is at this corner at 14:02" is not |
| Duel answers before their reveal | **not privacy** — a game timing rule. A hand of cards is face-down; publishing early links nothing the reveal does not publish a day later |
| Per-user targeting, advertising/analytics identifiers | MONETIZATION.md's standing posture. Opening answers to *readers* is not the same as profiling the reader |
| Any buyer read path a signed-in user lacks | MONETIZATION.md, post-D98. No private export, no API, no server-side demographic report for one customer |
| Fabricated activity of any kind | D1 — the half D98 did **not** reverse, and now the only reason anything is ever hidden: absent means absent, never withheld |

**The row that had to be re-argued.** "Retention or engagement sliced by
anchor" used to be refused on the grounds that "the same suppression that
stops a paying city identifying a person stops the owner doing it". D98
deleted the suppression, so that sentence is false in both halves. Nothing
technical stops the owner slicing retention by anchor now — the anchors are
public and the fold is a query away. What survives is narrower and had to be
taken deliberately rather than inherited: **per-user funnels and engagement
scoring are an analytics decision, not a privacy one**, refused because they
build the behavioural model MONETIZATION.md's posture rules out. A guarantee
that only held because a side effect enforced it was never a decision.

**Political slicing is no longer refused, and the row is gone.** D44's
carve-out was reversed by D98 ("no special-category carve-out"), so a panel
still claiming it would be asserting a guarantee the product deliberately
withdrew — which is worse than claiming nothing.

## The fifth thing: instrumentation

Not a decision panel so much as a mirror. Scanned from the tree rather than
listed by hand, so a new function or a new policy appears without anyone
remembering to add it — that omission being the exact failure this whole
console reduces.

**2 of 14 deployed functions have an alert policy.** That is a finding, not
necessarily a bug. The uncovered ones are mostly callables, which fail
loudly to the caller: a user sees an error and there is a person to notice.
The two that are alerted are alerted precisely because they do *not* do
that, and they fail silently in opposite ways — which is why the policies
watching them are different shapes:

- `onV2AnswerCreated` runs with `retry:true`, so a crash accumulates for
  ~7 days while the app looks healthy and the Mirror quietly stops moving.
  Watched **by severity**.
- `scheduledDuelReveals` is a cron, whose characteristic failure is not
  throwing but not running — scheduler stopped, dropped from a deploy's
  `--only` list, revision will not start. Nothing executes, so nothing
  logs, and a severity policy stays green through the whole outage.
  Watched **by absence** of its heartbeat.

Coverage here is a judgement, not a percentage to maximise — and the number
is computed from what each policy WATCHES (its displayName and conditions),
never from its runbook prose. Reading the whole file counted
`revealDuelsNowV2` as alerted because the reveal policy's first-response
step names it, which would have made this read 3 of 14 on the strength of a
better-written runbook.

Three of the four walls COSTS.md names have no instrument at all. That is
recorded rather than fixed: two of them bind at sizes this product has not
approached, and the arithmetic for when to care is already in COSTS.md.

**A correction, found while surveying.** `docs/DEPLOYMENT.md` explains that
alert policies are applied by hand because "the deploy service account has
no monitoring role". Line 103 of the same document says that account holds
`Editor` + `Firebase Admin`, and `Editor` includes
`monitoring.alertPolicies.create`. The stated reason does not hold. **The
conclusion still does**, for two better reasons: a policy is useless
without a notification channel id, which is not in the repo and should not
be; and a pipeline that silently rewrites alert policies is a pipeline that
can silently delete one. Kept off the pipeline deliberately — but not for
the reason written down. The console reports policies as *committed*, never
as *deployed*, because the repo cannot know.

`scripts/apply-monitoring.mjs` (`npm run monitoring:apply`, landed on `main`
while this branch was open) makes putting them live one idempotent, dry-run-
by-default command, which is strictly better than four console steps. It had
copied the retired reason into its own header; that copy is corrected here
too. This is the failure mode worth naming rather than just fixing: a wrong
reason does not stay in one file. It gets quoted forward by the next person
who needs to explain the same decision, and by then the correction has to
chase it.

## How it stays current

`.github/workflows/pulse.yml` runs on **two triggers**, because two
different things move these numbers:

- **06:00 UTC daily** — the changes nobody made. The calendar eats a day of
  runway whether or not anyone commits; a scorecard ages past its staleness
  rule by sitting still.
- **Every push to `main`** — the changes somebody did make. Promote twelve
  questions and the runway moves that afternoon rather than the next
  morning, and `--check` runs against the change that caused it.

Either way it records the trail row, writes the headline figures into the
run summary, and runs `--check` last — so a short runway or an expired
scorecard turns the job red: an email to whoever owns the repo, blocking
nobody's pull request.

**The push trigger has no `paths:` filter, deliberately.** A path list
would be a hand-maintained copy of "every file pulse reads" — the content
banks, the four source files it parses constants out of, the archive, the
rate card, the alert policies, the cities header, its own scripts. This repo
has now paid twice for that exact shape of duplicate (D34's reseed figure,
then four retyped constants), and the failure is the quiet one: pulse grows
an input, nobody updates the filter, and the console stops noticing the
thing it exists to notice. The job installs nothing and takes about twenty
seconds, so running it on every push is cheaper than maintaining the list
that would avoid it. It cannot loop: a push made with the default
`GITHUB_TOKEN` does not trigger workflows, so the job's own commit is inert.

**A rejected push resets and recomputes rather than rebasing.** With two
triggers, two runs can be in flight over the same day's row — the same line
of the same file, which is the one case a rebase cannot resolve. So a
rejected push is not merged: the tree resets to the branch head and the row
is recomputed against it. The row is derived from the tree and the date, so
this always converges, and the run that lost simply finds the row already
written and exits happy. Exercised against a real remote with two clones
racing, not reasoned about.

Three properties worth keeping:

- **It never runs `npm ci`.** pulse.mjs is Node stdlib only, so the job
  needs a checkout and a Node binary. That is not about speed: a console
  whose job is to say the ground moved must not be able to fail because a
  registry did. Verified in a dependency-free clone. If pulse ever grows an
  import that needs `node_modules`, that is the bug — not the omission.
- **The commit happens before the gate.** A day the runway is short is
  exactly the day the trail most needs its row; a gate that ran first would
  skip recording it.
- **Two pinned actions, both already in this repo.** No upload action for
  the rendered page — the summary table covers the common case, and
  security-audit.yml's reasoning applies: one less SHA to pin and audit.

Scheduled workflows only run from the default branch, so this does nothing
until it is merged. GitHub also disables schedules after 60 days of repo
inactivity; a trail gap that long is why, and `workflow_dispatch` re-arms it.

## What was deliberately not built

Four things that were tempting and are wrong:

1. **A CI gate.** `npm run pulse -- --check` is a real gate — it exits
   non-zero below 21 days of runway, and on an expired scorecard — and it
   is deliberately not in CI. The runway shortens by one every midnight
   whether or not anyone opened a pull request, so wiring it into a
   pull-request check would fail unrelated work on a Tuesday for a reason
   that pull request cannot fix. That is the same argument that keeps
   `check:figures` off the backend path, pointed the other way. It runs on
   a clock instead (above), which is the same split `security-audit.yml`
   makes for `npm audit`: a check whose subject changes on its own belongs
   on a schedule, not on a diff.

2. **A live fetch of its own.** The scorecard already fetches the public
   aggregates and commits the result; pulse reads that artifact, exactly as
   a scheduled farm run does. Two fetch paths against the same aggregates
   would be two things to keep in step, and the second would drift.

3. **A dependency.** No chart library, no CDN, no fonts. The page is one
   self-contained file because a console you have to build is a console you
   do not open. The palette is the validated eight-slot default, four slots
   used, run through the colourblind-separation validator in both light and
   dark before any chart code was written — two of the four sit below 3:1
   on the light surface, which is why every stacked segment carries a
   visible label and every chart has its table beside it.

4. **Averages where the shape is the point.** Evenness is bucketed, never
   meaned: "splits, not landslides" is a distribution, and a mean hides
   exactly the failure it is supposed to surface. The farm doc's guardrail
   outranks the chart anyway — if evenness and warmth conflict, warmth
   wins. A metric this simple invites goodharting (D33), and putting it on
   a dashboard doubles the invitation, so the warning ships next to it.

## Known limits, recorded rather than fixed

- **The trail starts today.** One row per day, append-only, so it becomes a
  trend on the second run and not before. The console says so rather than
  drawing a flat line through one point.
- **The cost panel is a prediction end to end**, including the soft
  behaviour assumptions (3 world answers/day, 1.4 boots, MAU = 3 × DAU).
  They are printed under the table rather than buried, because they are
  guesses about humans, not facts about the code.
- **Nothing here is gated for equality.** `pulse.json` changes daily even
  with no commits, because the runway does, so there is no drift check that
  would not fire at midnight. `npm run test:scripts` gates the console's
  *structure* instead — that its constants still match the source they claim
  to read, that a trail gap is drawn as a gap, that the scorecard path
  renders — which is the part a commit can actually break.
- **The scorecard still has no history of its own.** Pulse's trail carries
  the two figures worth trending across launch; the per-question series
  that would let the farm prove a lever moved a metric does not exist, and
  building it is a scorecard change, not a console one.
- **The function scan is a regex** over `export const x = onCall(…)` and
  friends. A wrapper form would be missed, which is why the count is
  reported beside the list rather than asserted as complete.
- **`boot = 15` is still hand-counted.** It is an inventory of `hydrate()`'s
  queries, correct against the code today, and nothing holds it there — add a
  query to `live.ts` and the model understates from then on, silently. The
  four constants beside it now read from source (D47); this one has no single
  declaration to read, which is exactly why it is the likeliest to rot.
- **`+ 0.2` in the writes formula is unexplained.** Presumably profile and
  anchor writes. It is the only unsourced number in the cost model and it was
  carried through the refactor verbatim rather than resolved.
- **The deletes line assumes the Firestore TTL policy was actually applied.**
  It is a hand-run `gcloud` command in SHIP-CHECKLIST §5, not a deployed
  artifact. If it was never run, deletes are zero and storage grows without
  bound — the model is wrong in the expensive direction and nothing checks.

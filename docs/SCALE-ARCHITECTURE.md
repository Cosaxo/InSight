# The log-first structure: hundreds of answers a day, millions of users

**Status: design only — ADOPTED 2026-09-09 (D439's amendment; *"that sound like a good direction lets do that"*, the same evening), phase A built that night (`LOG-FIRST-RUNBOOK.md`). Proposed that afternoon on the owner's word —
*"i think we should from the start look on how we can design a system
that scales to hundreds of answers a day and millions of users remember
we can use other systems like bigquery."*** Every figure below is
printed by **`npm run costs:target`** (`scripts/cost-target.mjs`), which
prices the shipped structure and this one side by side at five loads
and never retypes a number; `scripts/cost-target.test.mjs` holds the
arithmetic to what this page claims of it. Read with
[`DATA-EFFICIENCY.md`](DATA-EFFICIENCY.md) (the shipped structure, per
user-day, and the four phases built against it) and
[`SCALE-PLAN.md`](SCALE-PLAN.md) (the unbounded feed and the core/tail
split this design keeps). [`COSTS.md`](COSTS.md) prices the app at five
sizes on one axis, users; this page moves the other axis, answers per
user, and finds that it is the one the shipped structure was never
designed for.

## 0 · The answer in one screen

- **The shipped structure is flat per user and linear per answer.** At
  four world answers a day that is exactly right and the bill is small.
  At a hundred a day, the per-answer path — one rule read, three trigger
  reads, one nightly read, three writes, a delete, and a ledger entry
  held in the nightly pass's memory — is the whole bill and the whole
  failure: the pass runs out of memory near **16,000 users at a hundred
  answers a day**, and the timestamp indexes hit Firestore's sequential
  write wall near 144,000. Neither is a cost; both are a night that
  fails.
- **The target moves the per-answer work off per-operation prices.**
  The client writes answers in *batches* to one document per user-day;
  one trigger per batch appends a row per answer to BigQuery (priced by
  the byte), increments live counters in Redis (priced by the instance)
  and merges the person's answer map; a compactor writes **the same
  documents clients read today**, once a minute for the questions that
  changed; every nightly fold becomes SQL over the log, and a writer job
  puts the results back into the documents the app already reads.
- **What it costs, printed (§5):** at a million users answering a
  hundred times a day, about $2,200 a month against $23,200 on the
  shipped structure — which would not run at that size at all. At ten
  million answering three hundred times a day, about $32,000 against
  $667,000. Ten to twenty times cheaper, and it runs.
- **What a user sees is the same** (§4), with two cadences to state
  rather than hide: a card's count is exact and never more than a minute
  behind (the card already re-reads once a minute), and a friend's
  answers reach your Circle within the batch window rather than within
  seconds. Nothing shows fewer people, questions or answers.
- **The asks are §7**, on `OWNER-LIST.md`: adopt the direction, amend
  one sentence of D98, choose the batch window, and move the privacy
  page and the inventory first.

## 1 · The load, and what the shipped structure does with it

`DATA-EFFICIENCY.md` §3 priced the write side at four world answers per
user per day (`B.worldAnswers`, `scripts/cost-arith.mjs`) and found it
near its floor in operations. The floor is per answer, and the owner's
target multiplies the answers by twenty-five to seventy-five:

| Users (DAU) | Answers per user per day | Answers per day | Answers per second at the morning peak |
| ---: | ---: | ---: | ---: |
| 1,000,000 | 100 | 100 M | ~3,500 |
| 1,000,000 | 300 | 300 M | ~10,000 |
| 10,000,000 | 100 | 1 G | ~35,000 |
| 10,000,000 | 300 | 3 G | ~104,000 |

**Per answer, today** (`COSTS.md` § the ledger, the fit, the digest):
one rule read (the question's option count), three trigger reads (the
ledger event for dedup, the published aggregate, the author's profile),
one nightly read of the ledger entry shared by six folds, three writes
(the answer, the ledger entry, the aggregate rewritten whole) plus the
map's merge, one delete (the ledger's 90-day TTL), and the ledger entry
itself resident in the nightly pass while the folds run. Every one of
those is a billed operation, so the per-answer cost is about half a
cent per thousand answers — which is nothing at four a day and the whole
bill at a hundred.

**What Phases 1–4 built is answer-count-proof, and what they did not
touch is not.** The answer map is one document per person bounded by
the bank; the samples are one document per question; the deck, the
sheets and Kindred read documents whose size does not depend on how much
anyone answers. The per-answer path — the trigger's transaction, the
ledger, the nightly pass's memory — was left as it was, because at four
a day it was already the floor.

**Where it dies**, computed by the script from the tree:

- **The nightly pass holds the day.** The memoised ledger reader keeps
  every entry of the day resident so six folds can share one read (D399,
  the right trade at four a day). An entry with its chips and its stamp
  is about 470 bytes on node 22, measured. On the pass's 1 GiB that is
  roughly 1.6 million answers a day: **16,000 users at a hundred a day,
  5,000 at three hundred.** Past it the pass dies every night without
  advancing its cursor, which is the failure `DATA-EFFICIENCY.md` §3
  described for the candidate scan, one layer down.
- **The sequential-index wall.** `answeredAt` on the answer and `at` on
  the ledger entry are always-increasing indexed fields, and Firestore
  sustains about 500 writes a second to such an index. At a hundred
  answers a day and a three-times morning peak that is **144,000
  users; 48,000 at three hundred.** Sharded timestamps are the standard
  fix; the target makes the question moot by not writing per answer.
- **The daily question's contention wall** (~14,400 users, `COSTS.md`
  wall 1) does not move with the answer rate: only the daily's document
  is hot. Phase 5 of the efficiency runbook was written for it, and §6
  says what becomes of that phase.

## 2 · Three principles

1. **The log is the truth and everything else is a view of it.** This
   is already the tree's shape: the agg-events ledger (D28) is what the
   samples, the fit, the digest and the velocity scan read, and
   `replay.ts` exists because the counts were meant to be recomputable.
   The change is where the log lives and what may be rebuilt from it —
   *everything*, including the counters.
2. **Per-operation prices are for what a user reads in the next
   second; per-byte prices are for everything computed later.** Firestore
   bills a read or a write whatever its size; BigQuery bills bytes
   scanned and stored; Redis bills the instance whatever it counts. So
   Firestore serves the documents a device opens, BigQuery computes what
   a night computes, and Redis counts what a compactor publishes.
3. **Nothing per answer in Firestore that a batch can carry.** The floor
   is one write per batch of answers, and a trigger that reads nothing.
   A hundred answers become seven writes, not four hundred operations.

## 3 · The target, component by component

### 3.1 · The client writes batches

`v2_users/{uid}/days/{day}` — one document per user per UTC day, a map
of `qid → option` merged by the client every few minutes while the
person is answering and flushed when the app leaves the foreground, with
an `edits` map beside it for D86's option changes (`qid → the index it
moved from`). The rules keep what they can check without a read: the
owner writes it, the shape is a map of small integers, the size is
bounded. The per-answer `get()` of the question that validates the
option index today moves to the trigger (3.2), which drops an invalid
entry from the counts and logs it — an invalid index was only ever a
client bug, and the count never carried it because the trigger is the
counter's only writer. The offline queue (D357) carries batches instead
of answers; the device's own-answers caches (D312) read the day
documents and the map. New answers stop being written as one document
each; the documents that exist stay for their readers until §6's phases
retire those readers.

**Bounds:** a day document holds at most one entry per question
answered that day — three hundred entries is ~6 KB. The map is bounded
by the bank as before (runbook 3.2), and needs splitting once the bank
passes ~30,000 questions.

### 3.2 · One trigger per batch, and it reads nothing

The function on the day document receives before and after; the
difference is the batch's answers. It validates each against the bank
held in memory (reloaded when `v2_meta/app.rev` moves), then:

- **appends one row per answer to BigQuery** through the Storage Write
  API — `uid, qid, option, from_idx, at, surface, the eight frozen
  chips`, with a row id of `uid:qid:at` so a redelivered event appends
  nothing twice;
- **increments the live counters in Redis**, pipelined — the option
  total and one cell per breakdown dim per answer, the question into a
  *dirty* set, the person onto the question's capped recent-voters list
  (the who-voted sheet's tail);
- **merges the batch into the person's answer map**, one blind merge.

No reads. The profile check D410 added — that an answer's cohort is its
author's own — moves to the batch: the chips come off the profile the
trigger already holds for the stamp, not off the client's claim.
Failure is a retry, and a retry can double an increment; the nightly
reconcile (3.4) puts the counters back to the log's exact count, so a
counter is exact-as-of-last-night plus at-most-a-minute-old increments,
which is what the card promises today with the poll.

### 3.3 · The compactor publishes what clients already read

A small always-on service. Every sixty seconds it pops the dirty set,
reads each dirty question's hashes from Redis, and writes
`v2_question_aggs/{qid}` in **the document's current shape** —
`counts`, `total`, `by`, `edits` — applying the bucket cap at
compaction, which is the correction `DATA-EFFICIENCY.md` §3 said the
sharded design needed (the cap is not commutative; the compactor re-caps
the union and sends the surplus to D400's overflow tail, which already
exists). It also refreshes the hot questions' sample tail from the
recent-voters list. The client's read path does not change at all: the
same document, polled at the same interval it is polled today. The
contention wall disappears — one writer, once a minute — and with it the
200-folds-in-flight ceiling of the answer trigger.

Above about a million users the same compactor writes **pages** instead:
fifty questions' counts in one ~2 KB file on Hosting, cached at the edge
for the compaction interval, so a device reads ten pages a day for its
whole feed rather than one document per card. The script prices both
and takes the cheaper; the crossover is in §5's table.

### 3.4 · BigQuery holds the log and runs the night

A dataset in `europe-west1`, the region production is on (D165), holding
`answers` (partitioned by day, clustered by question and person,
append-only; an edit is a new row with `from_idx`), `profiles` (the
name-and-scores stamp per person, upserted by the profile trigger the
fan-out already runs on), and the staging tables the night writes.
Every nightly fold becomes one query over one day's partition:

| Fold today | Tonight, as SQL |
| --- | --- |
| The engagement digest (D268) | `COUNT(DISTINCT uid)` by day and window; retention as self-joins over the day partitions |
| The world samples (D397) | the newest 200 per question — one window function, joined with `profiles` for the names and scores the rows carry |
| The city samples (runbook 2.5) | the same window partitioned by question and city |
| The velocity signals (D28/D54) | cadence and burst as window functions per person over `at`; the coverage line keeps its Auth read |
| The taste fold, the rank | aggregations over the day |
| The Patterns fit's candidate solve (D395, runbook 4.3) | each ALS sweep is a query: the person step joins `people` to `items`, the item step is `SUM(v_i · v_j)` per item — bytes scanned, not documents read, so the four-scans-a-night cost runbook 4.3b exists to remove is not there to begin with |
| The answer-map heal (runbook 3.3) | `ARRAY_AGG` per person whose day rows exist, written only where the map differs |
| — | the counter reconcile: yesterday's exact cells from the log, back into Redis |

A **writer job** (Cloud Run, nightly) streams each result into Firestore
with the bulk writer, in the documents' current shapes: the samples, the
loadings, the rank, the patterns and engagement states per active person.
The nightly pass and its 1 GiB retire; nothing in the night holds the
day in memory, because BigQuery holds it on disk.

### 3.5 · What Firestore keeps, and what leaves it

**Keeps:** every per-user document (the profile, the day documents, the
map, the patterns and engagement states, purchases), the social
collections (groups, rounds, reveals, takes, flags — small and
transactional, and the rounds' reveal is a transaction that belongs in
one store), the published documents (aggregates, samples, loadings,
rank, meta) that the compactor and the writer job produce, and the
rules that make the D98 promises true. **Leaves:** the agg-events ledger
(to BigQuery), the per-answer answer documents for new answers (to the
day documents), the aggregate transaction (to Redis and the compactor),
the nightly pass's in-memory folds (to SQL), the heal (to the
reconcile).

### 3.6 · Erasure and recovery

Erasure is what it is today plus one statement: the subtree, the
samples scrub, and `DELETE FROM answers WHERE uid = @uid` (and the
`profiles` row), which is cheap because the table is clustered by
person. The anonymous tallies stay, as the aggregate counts a deleted
account fed stay today (`deleteAccount`'s own comment). Recovery is the
part that improves: **every derived store is rebuildable from the log
by one query** — the counters, the aggregates, the samples, the maps,
the states — which is the question `replay.ts` was written to answer
and could not answer completely under the bucket cap.

### 3.7 · What stays exactly as it is

The client's read shapes — the aggregate document, the sample document,
the answer map, the loadings, the rank — because the compactor and the
writer job produce the same documents. The Mirror's five lenses and the
Map. Duels, rounds, groups and reveals. D98: answers are public — the
map and the day documents are readable by any signed-in user exactly as
the answer documents are, and population counts are exact from the
first answer. The three denies at their paths. App Check on every
callable and on the batch trigger's callers.

## 4 · What a user sees, and the two cadences to state

Nothing shows fewer people, questions or answers, and every number is
the same number. Two things change *when*, and D1 says they are stated:

- **A card's count is exact and at most a minute behind.** Today the
  document is rewritten on every answer and the card re-reads it once a
  minute while visible (D129), so what a user sees already moves once a
  minute. The compactor publishes at that interval. Your own vote still
  confirms instantly — the optimistic +1 — and clears once the published
  total has passed it, the client rule `ANSWER-SCALE.md` §4 wrote for the
  sharded design.
- **A friend's answers reach your Circle within the batch window.**
  Today the map moves inside the aggregate transaction, seconds after
  the answer; under the target it moves when the friend's device sends
  its batch — every few minutes while answering, and at once when the
  app goes to the background. The window is the owner's dial (§7), and
  §5 prices it: one minute costs about twice what five minutes costs on
  the batch lines, and nothing else moves.
- The who-voted sheet's "today" tail on a hot question is at most a
  minute behind rather than live; the cold sheet is unchanged.
- The attention and engagement channels are unchanged — already sampled
  and already nightly.

## 5 · The bill, printed

`npm run costs:target`, 2026-09-09 (`europe-west1` list prices;
BigQuery, Redis, Eventarc and CDN prices read from Google's pricing
pages the same day and held as named constants in the script, which is
the part to confirm against the first invoice — `LAUNCH-RUNBOOK.md`
5.12's billing export is what does that). The first column is the
shipped model's own "Scale" scenario at a heavy answer rate, so the two
tables meet; the shipped column past it is arithmetic about a structure
that has already failed at the row above it.

<!-- costs:target -->
```
InSight at hundreds of answers a day — europe-west1 regional prices, no free allowance netted on the shipped column past what cost-arith nets
bank assumed 100,000 questions · 15 answers a batch · compaction every 60 s · 8 breakdown dims · 3 ALS sweeps

load                            50 K × 100/day 1.0 M × 100/day 1.0 M × 300/day10.0 M × 100/day10.0 M × 300/day
--------------------------------------------------------------------------------------------------------------
SHIPPED structure, $/month              $1,155         $23,219         $66,653        $232,247        $666,585
  reads/day                             33.5 M         668.2 M           1.8 G           6.7 G          17.9 G
  writes/day                            20.5 M         409.7 M           1.2 G           4.1 G          12.1 G
  the nightly pass dies at            16 K DAU        16 K DAU         5 K DAU        16 K DAU         5 K DAU
  the index wall arrives at          144 K DAU       144 K DAU        48 K DAU       144 K DAU        48 K DAU

TARGET structure, $/month                 $464          $2,177          $3,985         $15,645         $31,534
  Firestore — per-user writes (the day document, the map merge, the nightly states)             $22            $441          $1,161          $4,410         $11,610
  Firestore — per-user reads (boot documents, the D98 surfaces, today's card)             $28            $565            $565          $5,649          $5,649
  Firestore — deletes (the rollups' TTL)           $0.15           $3.00           $3.00             $30             $30
  Triggers — one per batch (Eventarc + Cloud Run request + compute)             $12            $236            $707          $2,358          $7,073
  Compactor — always-on instances             $70            $209            $348            $348            $348
  Publish — the cheaper of Firestore documents and CDN pages            $133            $461            $461            $873            $873
  BigQuery — ingest (Storage Write API)           $0.00           $0.00           $0.00             $33            $200
  BigQuery — storage, the twelfth month (nine long-term, three active)           $2.51             $50            $151            $503          $1,509
  BigQuery — the nightly queries (six day scans, the people table per sweep)           $0.82             $16             $41            $165            $410
  Redis — live counters (sized for the peak and the keyspace)            $196            $196            $548          $1,278          $3,833
  Firestore writes/day                   5.8 M          89.4 M         170.1 M         317.2 M         584.0 M
  Firestore reads/day                    3.1 M          62.8 M          62.8 M         627.6 M         627.6 M
  trigger invocations/day                333 K           6.7 M          20.0 M          66.7 M         200.0 M
  answers/s at the peak                    174             3 K            10 K            35 K           104 K
  Redis shards · GiB                     1 · 5           1 · 5          3 · 15          7 · 35        21 · 105
  dirty questions/minute                   3 K            50 K            88 K           100 K           100 K
  BigQuery GiB ingested/month               17             335             1 K             3 K            10 K
  BigQuery TiB scanned/night              0.00            0.09            0.22            0.88            2.19

shipped ÷ target                          2.5×           10.7×           16.7×           14.8×           21.1×

the batch dial, at a million users answering a hundred a day (Circle sees a friend's answer within the window):
    1 min window ·   3 answers a batch →    $4,560/month, 33.3 M triggers/day
    5 min window ·  15 answers a batch →    $2,177/month, 6.7 M triggers/day
   15 min window ·  45 answers a batch →    $1,780/month, 2.2 M triggers/day
```
<!-- /costs:target -->

Reading it: the target's biggest lines are the per-user Firestore
writes and the triggers, both of which scale with the *batch* count, not
the answer count — the dial at the bottom. Redis is sized for the peak
and for the keyspace of a hundred-thousand-question bank; BigQuery is a
rounding error until ten million, and its storage line is the twelfth
month's. The shipped column's reads and writes are what a Firestore
invoice would read, if the structure ran.

## 6 · The path from here

Each phase ships alone, on what Phases 1–4 of the efficiency runbook
built, and nothing a user sees changes in any of them. Sizes as in that
runbook: S an afternoon, M a few days, L a week or more.

- **A · The log** (M) — **BUILT 2026-09-09, `LOG-FIRST-RUNBOOK.md`**. The answer trigger appends each ledger entry to
  BigQuery as well as writing it; a backfill loads the existing answers
  (the shape `backfillAnswerMapsV2` already has); erasure gains its
  statement; `docs/data-inventory.md` and `web/privacy.html` gain their
  rows first (D183); each nightly fold gains a shadow query whose result
  is compared with the fold's for a week. Costs bytes. **This is the
  foundation and it is also `LAUNCH-RUNBOOK.md` 5.11 done properly** —
  the extension that step names streams every document change through
  its own trigger, per answer; the trigger's own append is one code
  path and one bill.
- **B · Counters and the compactor** (M). Redis and the compactor
  replace the aggregate transaction; the trigger stops rewriting the
  aggregate; the contention wall and the trigger's ceiling go. **This
  supersedes Phase 5 of the efficiency runbook** — the same compactor
  idea, a cheaper counter store, and no shard documents to fold. Needs
  the owner's word on D98's sentence (§7).
- **C · Batches** (M–L). The day document, the batch trigger, the
  offline queue, the day-document readers; per-answer documents stop for
  new answers; the rule read, the three trigger reads and two of the
  writes per answer are gone. Needs the window (§7).
- **D · The night in SQL** (M). The folds of §3.4, the writer job, the
  nightly pass retired; runbook 4.3b closes without being built.
- **E · Pages** (M). Count pages on Hosting behind the CDN and the feed
  reading them; from about a million users, where the script's publish
  line crosses.
- **F · At ten million.** A batch endpoint instead of the trigger (the
  same batch, without Eventarc's delivery charge — about half the
  trigger line), Redis Cluster, BigQuery capacity pricing instead of
  on-demand once the nightly scans pass a few terabytes.

**Order:** A first, because it costs nothing and every later phase
reads it. Then B before the daily's wall (~14,400 users) and C before
the pass's (~16,000 at a hundred a day, ~400,000 at four) — which comes
first depends on how the answer rate actually grows, and the model
prints both walls. D whenever the night's folds become the line. The
efficiency runbook's Phase 5 folds into B and its Phase 6 into A.

## 7 · The asks

**Answered 2026-09-09, all in one word** (*"that sound like a good direction
lets do that"*, to the three put in plain words): the direction, D98's
sentence (its amendment of that date), the five-minute window; the
fourth needed no ruling and moved first. Kept as written, for the
record of what was asked. On `OWNER-LIST.md` § Decisions, each with its
arithmetic:

1. **Adopt the log-first target as the direction for everything after
   the efficiency runbook's Phase 4.** Phase 5 becomes B above.
2. **One sentence of D98.** *"No publish cadence"* was written against
   the privacy cadence it retired — hours and days, floors and
   suppression. The compactor publishes every sixty seconds, the
   interval the card already re-reads at, and nothing visible changes.
   The owner's word amends the sentence to *exact, and never more than a
   poll behind*; without it B does not start.
3. **The batch window.** Five minutes while answering plus a flush on
   background is the recommendation; one minute doubles the batch lines
   at a million users (§5's dial). Circle's freshness is the window.
4. **BigQuery in the EU, page first.** The privacy page already says
   data is stored on Google Cloud infrastructure under Google's terms as
   processor, and the dataset is in the same project and region; the
   inventory gains rows for the log and the profiles table, and the one
   90-day promise the page makes (the engagement notes) is about a
   different collection and stands. `check:policy-claims` and
   `check:data-inventory` are the gates.

## 8 · What this model gets wrong, and how it stays honest

- **Prices outside Firestore** are list prices read on 2026-09-09; the
  billing export confirms or corrects them, and each is one constant in
  `PRICES`.
- **Redis at 50,000 pipelined increments a second per shard** is
  conservative; the vendor quotes more. The keyspace assumes a
  hundred-thousand-question bank at 2,400 leaves each.
- **The trigger line** assumes Eventarc delivery plus a Cloud Run
  request and 300 ms of compute per batch; the endpoint of phase F
  halves it.
- **The people table** at 2 KB a person and one scan per ALS sweep; the
  night's scans at six.
- **The CDN variant** assumes ten pages a user-day and ten edge
  locations; the origin cost is what moves if either is wrong.
- **Not priced:** Cloud Logging volume (`COSTS.md` names it), the writer
  job's compute (minutes a night), Identity Platform's MAU tiers
  (`COSTS.md`'s cliff, unchanged by this design), the pictures'
  hosting (D421).
- **The shipped column** is `cost-arith.mjs` with `B.worldAnswers`
  moved; its per-user reads include the who-voted, Kindred and Circle
  terms at the same open rates, which a heavy answerer may exceed.

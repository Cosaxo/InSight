# Log-first runbook — the ordered build list

> **Reasoning lives in [`SCALE-ARCHITECTURE.md`](SCALE-ARCHITECTURE.md)**,
> which is canonical, and the decision is D447 — the owner's adoption of
> the log-first structure on 2026-09-09 (*"that sound like a good
> direction lets do that"*, to the three asks put in plain words: the
> direction, counts published once a minute — D98's amendment — and the
> five-minute batch window). This file is the same work as an ordered
> to-do list: steps in dependency order, what "done" means, and which
> gate proves it. If the two disagree, SCALE-ARCHITECTURE is right and
> this is stale.
>
> Same split as [`DATA-EFFICIENCY.md`](DATA-EFFICIENCY.md) /
> [`DATA-EFFICIENCY-RUNBOOK.md`](DATA-EFFICIENCY-RUNBOOK.md), whose
> Phase 5 this supersedes (its phase B is that phase's compactor with a
> cheaper counter store).

**Sizes** are S (an afternoon), M (a few days), L (a week or more), and
they are estimates. **Every step names the gate that proves it.** Every
figure is `npm run costs:target`'s; none is typed.

**What no step here may do** (D447 §4, D446 §3): show fewer people,
questions or answers than today; change a number a user sees; move a
cadence a user can notice except the two D447 states — a card's count at
most a minute behind, a friend's answers in Circle within the batch
window; loosen a rule; touch the three denies; skip a test.

---

## Phase A — the log · **M, one pull request** · **BUILT 2026-09-09, clicked 2026-09-10, the grant a reading since 2026-09-12**

The ledger's mirror in BigQuery: every row the nightly folds will one day
compute from, appended as the count commits, reconciled every morning,
erased with the account. Nothing a user sees changes; nothing the night
computes changes yet — the Firestore ledger stays what the folds read
until phase D.

- [x] **A.1 The table. DONE 2026-09-09** — `bigquery/answers.schema.json`
      (one row per ledger entry: `id`, `uid`, `qid`, `surface`,
      `option_idx`, `from_idx`, `answered_at`, `day`, `anchors` — the
      column names avoid BigQuery's reserved words, which `at` and `from`
      are). `scripts/apply-bigquery.mjs` creates dataset `insight` in
      `europe-west1` — the named database's region, so the privacy page's
      "Google Cloud infrastructure" stays the EU's — and the `answers`
      table partitioned by `day` and clustered by `uid, qid` (person
      first, the erasure's own filter; the script's comment has the
      arithmetic); dry by default, idempotent, from `apply-bigquery.yml`
      behind the production environment. `apply-bigquery.test.mjs` holds
      the body to the schema file and to `log.ts`'s own names.
      **Clicked 2026-09-10** — run 1 dry, run 2 with `apply`: dataset
      and table created in `europe-west1`, read off the run logs
      (D-2026-09-12a). **The grant is the open half, and it changed
      hands:** until D-2026-09-12a the script printed its two commands
      for the gen-1 default account, while every function here is gen-2
      and runs as the Compute Engine default. The account is now READ off
      the deployed trigger, and *Observe production* prints whether it may
      append and query, with the commands for it where a role is missing
      (`OWNER-LIST.md`); a Compute default that still holds Editor has
      both already.
- [x] **A.2 The trigger appends. DONE 2026-09-09** —
      `functions/src/log.ts`: `logRow` built at every ledger site of
      `onV2AnswerCreated` and `onV2AnswerUpdated` (the vote, the edit, the
      rank, the catalogue pick) and appended AFTER the transaction
      commits — never inside it, so a slow BigQuery costs wall time and
      never the count, and never on the redelivery the ledger mark turns
      away. Best-effort: a failure is `log_append_failed` with its count,
      and A.3 makes it a day's lag. The client is made on first use, and
      the writer is off — a no-op that says so once — in the emulator,
      the unit suites and any deploy with `LOG_DATASET=off`.
      `idempotence.test.ts` pins one row per commit, none on the
      redelivery, the edit's `from_idx`; `log.test.ts` holds the row's
      fields to the schema file.
- [x] **A.3 The nightly reconcile. DONE 2026-09-09** — `runLogReconcile`,
      the pass's eighth runner off the shared ledger read: the ids the
      table holds for yesterday (and the day either side — the trigger's
      clock and the ledger's are not one clock), the missing rows
      appended, the deferred erasures of A.5 retried. Heartbeat
      `log_reconcile`, a warning whenever it appended anything, since a
      reconciled row is a live append that failed. Skips itself, reading
      nothing, where there is no BigQuery. `log.test.ts`, `nightly.test.ts`.
- [x] **A.4 The backfill. DONE 2026-09-09, the click is the owner's** —
      `backfillLogV2` walks the `answers` collection group in path order,
      a page of 1,000 at a time, appending a row per answer dated BEFORE
      a cutoff day (the deploy's — every answer from that day on has the
      trigger's row or the reconcile's), keyed `bf:{uid}:{qid}` so a
      range re-run appends the same ids; resumable from the cursor its
      summary prints. `scripts/backfill-log.mjs` loops it,
      `backfill-log.yml` dispatches it in `backfill-answer-maps.yml`'s
      shape. **Clicked 2026-09-10** — `before=2026-09-10`, 32 rows over
      one call, after two dry runs (`before=2026-09-09` and `=2026-09-10`)
      that agreed at 32, so no answer was dated the deploy's day and the
      cutoff loaded exactly the rows the trigger never saw, none twice
      (D-2026-09-12a).
- [x] **A.5 Erasure. DONE 2026-09-09, re-shaped the same evening** —
      `deleteAccount` phase 1a″: the `DELETE … WHERE uid` at once while
      the table is under a gibibyte (`LOG_ERASE_NOW_MAX_BYTES`, off the
      table's metadata, nothing billed); past that, where BigQuery
      refuses because the rows are still in its streaming buffer (up to
      ninety minutes after an insert), or where the statement fails for
      any other reason, a server-only marker in `v2_log_erasures` that
      A.3 takes — **every pending account in ONE statement** (`IN
      UNNEST`, pages of 500), because a DELETE is billed as a pass over
      every partition it touches, i.e. the whole table for an account
      whose answers span the year, however many accounts it names
      (`COST-EXPOSURE.md` §8). The marker written is the promise kept,
      and only a marker that cannot be written fails the phase.
      `log.test.ts` pins the ceiling, the one statement, a refused batch
      keeping every marker, and the paging. `firestore.rules` closes the
      collection to clients (rules-tested); the summary reports `log` and
      `logDeferred`. The privacy page says "within a day".
- [x] **A.6 The paperwork. DONE 2026-09-09** — `docs/data-inventory.md`
      rows for the table and the markers; `web/privacy.html`'s sentence
      with its `check:policy-claims` row (D183: page first);
      `DEPLOYMENT.md` § The answer log; the App Check exemption and the
      deploy list for the callable; `COSTS.md`'s note (bytes: under a
      dollar a month at every size in its table).
- [x] **A.7 The shadow queries. DONE 2026-09-11 (D466)** —
      `functions/src/logShadow.ts`, the pass's tenth runner, right after
      the reconcile so the day it reads is the day the reconcile just
      made whole. Built in two halves rather than the one the step
      imagined, because the two clocks make one impossible: a ledger
      entry's `at` is the commit's server time and its row's
      `answered_at` is the trigger's `Date.now()` a few hundred
      milliseconds before, so an answer at the midnight seam sits on the
      ledger's day D and the log's day D−1, and neither is wrong. The
      EXACT half looks the ledger day's rows up by id a day either side
      (`LOG_SHADOW_ID_CHUNK` ids a query) and counts what the table
      lacks, what carries another person, question or option, and what
      is filed under another day (`seam`). The FOLD half runs the three
      queries phase D will run over the log's OWN day — `COUNT(*)`,
      `COUNT(DISTINCT uid)`, and the samples' additions as
      `ARRAY_AGG … ORDER BY uid LIMIT 200` over each person's newest
      answer — against the same folds off the shared ledger read, the
      samples' side through `sampleAdditions` and `trimAdditions`
      (extracted from `mergeSample`, so the comparison is the fold's own
      arithmetic and not a copy). One line, `log_shadow`, info when
      `clean` and a warning naming every number when not; a fold diff no
      larger than `seam` is the seam, a fold diff with the seam at zero
      is a query that does not reproduce the fold. **What it does not
      compare, so a clean week is read as what it is:** the cumulative
      sample document (a read per sample and the table's whole history;
      the merge is deterministic over the day's additions this does
      compare), the frozen chips on a row, and the candidate's corpus
      filter (the shadow folds every option-shaped entry, a superset).
      The exact half is bounded by the pass's clock
      (`LOG_SHADOW_SLICE_MS`, a minute, an absolute instant like every
      bounded fold's) and a capped night is never clean; the fold half
      always runs. The week is read off the log lines — seven nights of
      `clean: true` — and nothing is written anywhere to count it.
      Costs bytes (COSTS.md's phase-A note). `logShadow.test.ts` (the
      fold, the diff, the runner: skip, clean, each of the three exact
      findings, a fold disagreement named, the chunking, the clock),
      `log.test.ts` (the queries held to the fold's cap, order and
      tie-break), `nightly.test.ts` (the tenth runner, its deadline).
      Original text below.
      The shadow queries (S, once the table holds a week) — one
      query per nightly fold whose result is compared with the fold's
      own and logged as a diff: the digest's active count, the samples'
      newest two hundred per question, the velocity scan's entry count.
      A week of zero diffs is what licenses phase D. · **Gate:** a
      `log_shadow` heartbeat carrying the diffs; `nightly.test.ts`.
- [ ] **A.8 The append moves to the Storage Write API** (S–M, before the
      ingest line matters — about a million users at a hundred answers a
      day, where `npm run costs:target` prints the streaming line at
      $143 a month against $0). Phase A ships on `table.insert`, the
      legacy streaming API: $0.05 a GiB, **a 1 KB minimum per row** for a
      120-byte row, and no free allowance; the Storage Write API is
      $0.025 a GiB after 2 TiB a month free. `@google-cloud/bigquery-
      storage`'s default stream, the same `insertId`-shaped dedup by
      row key, the same fake in the suites. · **Gate:** `log.test.ts`,
      `idempotence.test.ts` (one row per commit, none on a redelivery).
- [ ] **A.9 Erasure at scale — the owner's sentence first** (S in code,
      the decision is the cost). From about a million users the nightly
      erasure statement is the largest BigQuery line — a pass over the
      year's table for the day's deleted accounts, $747 a month at a
      million people answering a hundred times a day, the largest line
      on the bill at ten million (`SCALE-ARCHITECTURE.md` §5). The
      cheaper shape is an `erased` table the folds join against
      (`WHERE uid NOT IN …`) and a physical purge once a month — one pass
      a month instead of thirty — which keeps an erased account's rows
      for up to a month and so moves `web/privacy.html`'s "within a day"
      (`check:policy-claims`), page first (D183): **on `OWNER-LIST.md`**.
      Until the word, the batch stands. · **Gate:** `log.test.ts`,
      `check:policy-claims`.

**Done when:** every answer is a row within a minute of its count, the
table and the ledger agree every morning (the reconcile's own heartbeat
says `missing: 0`), and an erased account's rows are gone within a day —
the third is `log.test.ts`'s fakes plus one production deletion read in
the console, because the emulator has no BigQuery to prove it against.

## Phase B — counters and the compactor · **M** · D98's amendment given 2026-09-09 · **BUILT 2026-09-11 (D467) on Firestore shards — Redis is the swap, not the start**

> **The start condition (2026-09-09, `COST-EXPOSURE.md` §8).** Redis is
> the one line in the target that does not scale down: Memorystore
> bills the instance from the hour it exists — the 5 GiB the model sizes
> is $196 a month, the smallest Basic-tier 1 GiB about $36 — and with
> two measured actives it would be the whole bill many times over. So
> B.1 is built when the daily's contention alert
> (`monitoring/onV2AnswerCreated-contention.json`) has fired, or the
> pulse's measured actives pass about **5,000** (a third of D7's
> ~14,400 wall), whichever comes first — and starts on the smallest
> instance the keyspace allows, not the model's sized one. Nothing else
> in this file waits on it: A.7's shadow queries and phase C's client
> batching do not need the counters to exist. Recorded as an ask on
> `OWNER-LIST.md` so the owner can move the threshold either way.
>
> **Built 2026-09-11 without the instance (D467).** The owner's word was
> *build phase B*. What makes Redis a fixed line is the counter STORE,
> not the compactor, so the counters shipped as Firestore documents —
> `v2_agg_shards/{qid}-{s}`, blind increments, no read on the hot path —
> behind the `AggCompactStore` seam the compactor reads through, and
> nothing bills until an answer does. The condition above now decides
> the SWAP: the Redis store replaces that seam and the trigger's one
> write when `npm run costs:target` prints the per-answer trigger line
> above the instance. The wall is gone either way.

- [x] **B.1 The counters. DONE 2026-09-11 (D467), as Firestore shards.**
      `functions/src/aggShards.ts`: for a question the daily bank names
      (`SHARDED_QIDS`, off the compiled content — never the answer's own
      `surface` claim), the trigger writes `shardIncrements` /
      `shardEditIncrements` to `v2_agg_shards/{qid}-{s}`, `s` the
      person's FNV-1a hash mod `AGG_SHARDS` (16): the option, the total,
      one cell per frozen chip, the edit-flow crossing — INSIDE the
      transaction beside the ledger mark and the map, not after the
      commit as the Redis step imagined, so the ledger's idempotence is
      the increment's. No dirty-set document: `dirtyAt` on the shard is
      the dirty set, indexed. No recent-voters list: the who-voted
      sheet's tail is the nightly sample's (D397) and did not move. ·
      **Gate:** `aggShards.test.ts` — the compacted document equals
      `foldAnchors`'s on forty answers over three cities, and an edit
      delivered before its create sums to the create's final state. The
      hundred-answers-a-second probe is NOT run: the tree has no load
      rig; the arithmetic is sixteen sustained writes a second where
      there was one. Original text below.
      The counters. Memorystore for Redis in `europe-west1`; the
      answer trigger increments after its commit, pipelined beside the log
      append — the option total, one cell per breakdown dim, the question
      onto the dirty set, the person onto the question's capped
      recent-voters list. · **Gate:** the counter fold over a fake Redis
      equals `breakdownFor`'s document on a fixture; a probe at 100
      answers a second to one question.
- [x] **B.2 The compactor. DONE 2026-09-11 (D467).** `compactAggShardsV2`,
      `* * * * *`, `COMPACTOR` (256 MiB, 55 s — under the interval, so
      runs never overlap). STATELESS: it republishes every question with
      a shard dirtied in the last `COMPACT_LOOKBACK_MS` (fifteen minutes)
      — idempotent, so a shard compacted fifteen times changes nothing —
      and the header says what that cannot do (an outage longer than the
      lookback leaves a quiet question stale until its next answer or the
      lever). The union is re-capped as DATA-EFFICIENCY §3 corrected: the
      `BREAKDOWN_MAX_BUCKETS` biggest buckets a dimension stay hot, ties
      by name, the rest to D400's tail — each of the eight tail shards
      written whole where it has cells and deleted where it has none, the
      replay's own rule, so a bucket that climbed back is not still found
      in a stale shard and the two writers leave the same documents.
      `rebuildAggregateV2` publishes a sharded question through this same
      cap and reports the tail it yields. Better than the trigger's
      cap, and deterministic. THE BASE SHARD is the migration: the first
      time the compactor meets a question with no `{qid}-base`, it moves
      the published document and its tail into one, in a transaction.
      `compactAggShardsNowV2` is the operator lever (one question, or a
      day's worth), App Check exempt with its reason. Not built: "the hot
      questions' sample tail from the recent-voters list" — there is no
      such list (B.1). · **Gate:** `aggShards.test.ts` (the run: dirty
      questions, the migration once, the idle heartbeat, a full page and
      a stopped clock both said and neither clean, a named question, a
      negative sum); the e2e loop reads the same counts it read off the
      hot path, through the lever (`settled`). Original text below.
      The compactor. A minutely run — a scheduled function first,
      a Cloud Run service when the dirty set outgrows a function's budget
      — that pops the dirty set, reads each question's hashes and writes
      `v2_question_aggs/{qid}` in the document's current shape (`counts`,
      `total`, `by`, `edits`), re-capping the union of buckets at
      compaction and sending the surplus to D400's overflow tail; the hot
      questions' sample tail from the recent-voters list. · **Gate:** the
      compacted document equals the trigger's own fold on the same
      answers; the e2e loop reads the same counts it reads today.
- [x] **B.3 The trigger stops rewriting the aggregate. DONE 2026-09-11
      (D467), for the daily lane.** The vote and edit branches of
      `v2.ts` take a second path for a sharded question: `tx.getAll(event,
      profile)` — two reads, not three; the profile stays for D410's
      honesty check, so the pin is 13 → 15 (two `getAll` shapes), not
      3 → 1 — then the ledger mark, the row, the map and the shard
      increment; the published document is neither read nor written.
      The edit path has no "arrived before its create" refusal: the
      increments commute. The client clears its post-vote +1 on the
      COUNTS rather than on the document existing (`aggHoldsMark`,
      `src/v2/data/live.ts`) — a create once its option grew past what
      the device held, an edit once the new grew or the old shrank —
      with the seam ANSWER-SCALE §4 names stated in the comment. Rules
      close `v2_agg_shards` to everyone; `rebuildAggregateV2` guards on a
      stamp over the shards and writes the base. · **Gate:**
      `idempotence.test.ts` (the sharded lane's four cases),
      `vote.test.ts` (the mark held, then cleared, for a create and an
      edit), `rules.test.ts`, the e2e loop, `pulse.test.mjs`. Original
      text below.
      The trigger stops rewriting the aggregate. The transaction
      keeps the ledger mark and the map merge; the client's post-vote +1
      clears once the published total has passed it (`ANSWER-SCALE.md`
      §4's rule); `pulse.test.mjs`'s trigger read pins move (3 → 1, the
      ledger event). · **Gate:** `vote.test.ts`, the e2e loop,
      `pulse.test.mjs`.
- [x] ~~**B.4 The counter reconcile.**~~ **NOT NEEDED as built (D467),
      struck rather than deleted.** The step existed because a Redis
      increment after the commit can be delivered twice; a Firestore
      increment INSIDE the ledger-marked transaction cannot — the mark
      that turns a redelivery away before the shard is written is the
      reconcile. The two ways a shard is rewritten whole are the base
      migration and `rebuildAggregateV2`. The step returns with the Redis
      store, if it ever comes. Original text: *Yesterday's exact cells
      from the log back into Redis, nightly, so a retried trigger's
      double increment lasts a day at most. · Gate: `log.test.ts`.*
- [x] **B.5 Monitoring. DONE 2026-09-11 (D467), two of three.** The
      heartbeat `agg_compact` on every run, idle ones included, and
      `monitoring/compactAggShardsV2-silent.json` — the digest's
      threshold shape at a ten-minute window, `check:monitoring` green.
      No separate lag policy: the heartbeat carries `capped`, `stopped`
      and `negatives`, each a warning. The contention alert is NOT
      retired: the feed lane still writes its documents on the hot path,
      and a shard can contend too — at sixteen times the rate. Original
      text: *A compactor heartbeat and a lag policy; the contention alert
      retired with the wall it watched.*

**Done when:** the daily's contention wall is gone (the B.1 probe), the
trigger's ceiling with it, and `npm run costs` prints the aggregate write
per answer at zero. **As built, 2026-09-11:** the wall is sixteen times
further out by arithmetic (no probe — B.1), `HOT_TRIGGER.maxInstances`
is 10 → 50, and `npm run costs` prints the daily's answer still at ONE
write (the shard) plus the compactor's flat line — zero per answer was
the Redis property, and the line it costs instead is cents.

## Phase C — batches · **M–L** · the five-minute window given 2026-09-09

- [ ] **C.1 The day document.** `v2_users/{uid}/days/{day}` — a map of
      `qid → option` and an `edits` map — owner-written, shape- and
      size-bounded in `firestore.rules`, no per-answer `get()`. ·
      **Gate:** `rules.test.ts`.
- [ ] **C.2 The batch trigger.** Before/after diff → the batch; each
      answer validated against the bank held in memory (reloaded on
      `v2_meta/app.rev`); rows appended, counters incremented, the map
      merged, reading nothing; D410's honesty check on the profile the
      trigger already holds. · **Gate:** `idempotence.test.ts`'s shape
      over batches.
- [ ] **C.3 The client's batch queue.** A merge every five minutes while
      answering and a flush when the app leaves the foreground; the
      offline mirror (D357) carries batches. · **Gate:** `vote.test.ts`,
      the warm-boot suite.
- [ ] **C.4 The readers move.** The device's own-answers caches read the
      day documents and the map; the voter tail reads the recent-voters
      list through the compactor; the Circle fallback is gone (efficiency
      runbook 3.8). · **Gate:** `circle.reads.test.ts`, `voters.test.ts`.
- [ ] **C.5 New answers stop as one document each**; the documents that
      exist stay for erasure and history. · **Gate:** the e2e loop.
- [ ] **C.6 The model.** `cost-arith.mjs` prices per batch;
      `cost-target.mjs`'s target column becomes the shipped one.

**Done when:** a hundred answers are seven writes, and the rule read and
the three trigger reads per answer are gone from `npm run costs`.

## Phase D — the night in SQL · **M** · after A.7's week of zero diffs

- [ ] **D.1** The engagement digest as a query. **D.2** The world and
      city samples with the `profiles` table (upserted by
      `onV2ProfileUpdated`). **D.3** The velocity signals as window
      functions; the coverage line keeps its Auth read. **D.4** The taste
      fold and the rank. **D.5** The candidate solve's ALS sweeps as
      queries over `people` and `items` — bytes scanned, not documents
      read, which closes efficiency runbook 4.3b without building it.
      **D.6** The answer-map reconcile. **D.7** The writer job, streaming
      each result into the documents' current shapes with the bulk
      writer. **D.8** The nightly pass retired; `NIGHTLY` back to 256 MiB.
      · **Gate:** each fold's shadow diff at zero for a week before its
      cut-over; the nightly test suites over the new stores.

**Done when:** no nightly function holds a day in memory.

## Phase E — pages · **M** · from about a million users

- [ ] Count pages of fifty questions on Hosting behind the CDN, regenerated
      per compaction for the pages that changed; the feed reads pages.
      `npm run costs:target`'s publish line says where it crosses.

## Phase F — at ten million

- [ ] A batch endpoint instead of the trigger (the same batch, without
      Eventarc's delivery charge); Redis Cluster; BigQuery capacity pricing
      once the nightly scans pass a few terabytes.

## Waiting on the owner, not on this file

- **Phase A's clicks were made 2026-09-10** — the dataset and table, and
  the backfill (D-2026-09-12a read them off the run logs). **Still the
  owner's: the two roles, for the account the trigger RUNS AS** — the
  Compute Engine default, not the gen-1 default the script printed until
  2026-09-12. *Observe production*'s answer-log block says whether they
  are held and prints the two commands if not. On `OWNER-LIST.md`
  § Clicks.
- **When phase B starts** — the condition above, the owner's to move
  (`OWNER-LIST.md` § Decisions).
- **A.9's sentence** — whether an erased account's rows may outlive the
  account by up to a month in the log, joined out of every fold
  meanwhile, for a thirtieth of the erasure line; the privacy page moves
  first if so (`OWNER-LIST.md` § Decisions).

# Log-first runbook — the ordered build list

> **Reasoning lives in [`SCALE-ARCHITECTURE.md`](SCALE-ARCHITECTURE.md)**,
> which is canonical, and the decision is D440 — the owner's adoption of
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

**What no step here may do** (D440 §4, D439 §3): show fewer people,
questions or answers than today; change a number a user sees; move a
cadence a user can notice except the two D440 states — a card's count at
most a minute behind, a friend's answers in Circle within the batch
window; loosen a rule; touch the three denies; skip a test.

---

## Phase A — the log · **M, one pull request** · **BUILT 2026-09-09, two clicks after it**

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
      table partitioned by `day` and clustered by `qid, uid`; dry by
      default, idempotent, from `apply-bigquery.yml` behind the production
      environment. `apply-bigquery.test.mjs` holds the body to the schema
      file and to `log.ts`'s own names. **Click (`OWNER-LIST.md`):
      dispatch it dry, then with apply; grant the runtime service account
      BigQuery Data Editor and Job User** — the script prints both
      commands, and a project whose default account still holds Editor
      has them already.
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
      shape. **Click: dispatch with `before` = the deploy's UTC day, dry,
      then apply.**
- [x] **A.5 Erasure. DONE 2026-09-09** — `deleteAccount` phase 1a″: the
      `DELETE … WHERE uid` at once; where BigQuery refuses because the
      rows are still in its streaming buffer (up to ninety minutes after
      an insert), or the statement fails for any other reason, a
      server-only marker in `v2_log_erasures` that A.3 retries and
      removes — the marker written is the promise kept, and only a marker
      that cannot be written fails the phase. `firestore.rules` closes the
      collection to clients (rules-tested); the summary reports `log` and
      `logDeferred`. The privacy page says "within a day".
- [x] **A.6 The paperwork. DONE 2026-09-09** — `docs/data-inventory.md`
      rows for the table and the markers; `web/privacy.html`'s sentence
      with its `check:policy-claims` row (D183: page first);
      `DEPLOYMENT.md` § The answer log; the App Check exemption and the
      deploy list for the callable; `COSTS.md`'s note (bytes: under a
      dollar a month at every size in its table).
- [ ] **A.7 The shadow queries** (S, once the table holds a week) — one
      query per nightly fold whose result is compared with the fold's
      own and logged as a diff: the digest's active count, the samples'
      newest two hundred per question, the velocity scan's entry count.
      A week of zero diffs is what licenses phase D. · **Gate:** a
      `log_shadow` heartbeat carrying the diffs; `nightly.test.ts`.

**Done when:** every answer is a row within a minute of its count, the
table and the ledger agree every morning (the reconcile's own heartbeat
says `missing: 0`), and an erased account's rows are gone within a day —
the third is `log.test.ts`'s fakes plus one production deletion read in
the console, because the emulator has no BigQuery to prove it against.

## Phase B — counters and the compactor · **M** · D98's amendment given 2026-09-09

- [ ] **B.1 The counters.** Memorystore for Redis in `europe-west1`; the
      answer trigger increments after its commit, pipelined beside the log
      append — the option total, one cell per breakdown dim, the question
      onto the dirty set, the person onto the question's capped
      recent-voters list. · **Gate:** the counter fold over a fake Redis
      equals `breakdownFor`'s document on a fixture; a probe at 100
      answers a second to one question.
- [ ] **B.2 The compactor.** A minutely run — a scheduled function first,
      a Cloud Run service when the dirty set outgrows a function's budget
      — that pops the dirty set, reads each question's hashes and writes
      `v2_question_aggs/{qid}` in the document's current shape (`counts`,
      `total`, `by`, `edits`), re-capping the union of buckets at
      compaction and sending the surplus to D400's overflow tail; the hot
      questions' sample tail from the recent-voters list. · **Gate:** the
      compacted document equals the trigger's own fold on the same
      answers; the e2e loop reads the same counts it reads today.
- [ ] **B.3 The trigger stops rewriting the aggregate.** The transaction
      keeps the ledger mark and the map merge; the client's post-vote +1
      clears once the published total has passed it (`ANSWER-SCALE.md`
      §4's rule); `pulse.test.mjs`'s trigger read pins move (3 → 1, the
      ledger event). · **Gate:** `vote.test.ts`, the e2e loop,
      `pulse.test.mjs`.
- [ ] **B.4 The counter reconcile.** Yesterday's exact cells from the log
      back into Redis, nightly, so a retried trigger's double increment
      lasts a day at most. · **Gate:** `log.test.ts`.
- [ ] **B.5 Monitoring.** A compactor heartbeat and a lag policy; the
      contention alert retired with the wall it watched.

**Done when:** the daily's contention wall is gone (the B.1 probe), the
trigger's ceiling with it, and `npm run costs` prints the aggregate write
per answer at zero.

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

- **The two clicks of phase A** — the dataset and the roles
  (`apply-bigquery.yml`, then the two `gcloud` bindings), and the backfill
  (`backfill-log.yml` with `before` = the deploy's day). On
  `OWNER-LIST.md` § Clicks.

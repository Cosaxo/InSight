# Data-efficiency runbook — the ordered build list

> **Reasoning lives in [`DATA-EFFICIENCY.md`](DATA-EFFICIENCY.md)**, which
> is canonical, and the decision is D421 — the owner's approval of every
> change that keeps the picture identical, 2026-09-08. This file is the
> same work as an ordered to-do list: open steps only, dependency order,
> what "done" means, and which gate proves it. If the two disagree,
> DATA-EFFICIENCY is right and this is stale.
>
> Same split as [`SCALE-PLAN.md`](SCALE-PLAN.md) / [`SCALE-RUNBOOK.md`](SCALE-RUNBOOK.md).

**Sizes** are S (an afternoon), M (a few days), L (a week or more), and
they are estimates. **Every step names the gate that proves it.** Every
figure is `npm run costs:structure`'s or `npm run costs`'s; none is
typed. **One assumption runs through Phase 3**: the answer map is kept
*live* by the trigger with a nightly heal — the owner's stated lean,
priced at about 6 % of what the map saves — and D421 records that the
word confirming it is still the owner's to give.

**What no step here may do** (D421 §3): show fewer people, questions or
answers than today; change a number a user sees except where the step
says so; loosen a rule; touch the three labelled denies; skip a test.

---

## Phase 0 — record and measure · **DONE with this pull request**

- [x] **0.1 The decision.** D421 in `DECISIONS.md`: what is approved, the
      one open word (live), the one thing that waits (§2.8's history
      document, a privacy-shaped ask).
- [x] **0.2 The measurement.** `scripts/cost-structure.mjs` prices every
      reshape as a delta on the model's own terms. Re-run it after every
      phase below; when a term moves into `cost-arith.mjs` the row leaves
      this script.

## Phase 1 — configuration-sized, no product change · **S, one pull request** · **DONE 2026-09-08**

- [x] **1.1 Index exemptions on the collections nobody queries by field.
      DONE 2026-09-08 — 45 exemptions.** Two things were narrowed on the
      way, both recorded here rather than assumed: the ledger's `expireAt`
      stays indexed until someone reads Google's TTL page (the docs host is
      unreachable from the sandbox, and an exemption that stopped TTL
      deletes would be worse than an index entry); and whether an
      exemption on `by` reaches the map's city-named subfields is the
      console read this step's own text asks for — the exemption deploys
      either way, and 1.1b stands if it does not reach them. Pinned by
      `indexes.test.ts` (the ledger's `uid` and `at` stay indexed; the
      aggregate's fields do not). Original text below.
      Index exemptions on the collections nobody queries by field.**
      `firestore.indexes.json` `fieldOverrides`: `v2_agg_events` — every
      field but `uid` (equality) and `at` (range): `qid`, `optionIdx`,
      `fromIdx`, `expireAt`, the `anchors.*` leaves; `v2_question_aggs`
      (`by`, `counts`, `total`, `edits`, `pos`, `top`, `rest`),
      `v2_agg_overflow`, `v2_aggs_private`, `v2_patterns` (`rows`),
      `v2_rank`, `v2_engagement_daily`; and `engagement.expireAt`. Every
      reader of those six is by document id, so no query changes.
      **Verify on `insight` how an exemption on a map field reaches its
      subfields** before relying on it for `by` — the map's keys are city
      names and cannot be listed one by one; if it does not reach them,
      the fallback is 1.1b: store `by` as one value above Firestore's
      indexed-value size, which changes `cohort.ts`'s parser and nothing
      else. · **Gate:** `src/v2/data/indexes.test.ts` (every data-layer
      query still names an index that exists), `check:deploy-targets` (the
      index deploy stays without `--force`), and the deploy step's own
      listing. · **Done when:** the console lists the exemptions and
      `indexes.test.ts` is green.
- [x] **1.2 Field masks — DONE 2026-09-08 for `rankBankV2`, REFUSED for
      the trigger, with the reason.** A `getAll` mask applies to every
      document in the call, and the world branch reads the aggregate in
      the same call it reads the profile — so a mask would have to name
      every field the `merge: false` rewrite carries, and a field it
      forgot would be a field silently dropped from every aggregate on the
      next answer. A second call inside the transaction is the round trip
      D410 refused. The profile stays whole until the increment fold
      (5.1) makes the rewrite a merge. Original text below.
      Field masks on two whole-document reads.** The world trigger's
      `tx.getAll(eventRef, pubRef, profRef)` in `functions/src/v2.ts`
      takes `{ fieldMask: ["anchors"] }` for the profile — the reveal
      pipeline already does this for `displayName` and says why (a
      profile can approach 1 MiB); `rank.ts`'s `aggsFor` takes
      `{ fieldMask: ["total", "counts"] }`. Read counts unchanged. ·
      **Gate:** `npm run test --prefix functions`; `scripts/pulse.test.mjs`'s
      read-count pins unchanged.
- [x] **1.3 The nightly function's memory, 256 MiB → 1 GiB. DONE
      2026-09-08** — `NIGHTLY` in `ops.ts`, `check:fn-runtime` green. A `NIGHTLY`
      runtime option in `functions/src/ops.ts` beside `LIGHT_UNBOUNDED`,
      applied to `digestEngagementV2` only — the stopgap for 4.3, a
      fraction of a cent a night, about four times the headroom. ·
      **Gate:** `check:fn-runtime` reads it off the built output.
- [x] **1.4 Foreground refresh reads today only. DONE 2026-09-08** —
      plus a rider the step did not name: a deck card the device holds no
      aggregate for (a rollover while backgrounded) rides along, so a long
      absence still fills its cards. `npm run costs` prints `reattach 4`;
      `COSTS.md`'s tables are re-printed with a dated note. `resubscribeForToday`
      → `startAggPoll` in `src/v2/data/live.ts` refreshes the whole deck
      on boot and `state.deckIds.slice(0, 1)` on a wake; the six back
      days keep refreshing at boot. The model's `reattach` term reads a
      new `REATTACH_DOCS` from source and its pin moves. **What a user
      sees:** a card from three days ago shows the count as of the last
      cold start rather than the last app switch; today's card is
      unchanged. The one cadence item in this file — D421 names it, and
      the owner may strike it. · **Gate:** `idle-detach.test.ts` gains
      the case (a wake issues one id; a boot issues seven);
      `pulse.test.mjs`; `check:figures` after `npm run costs`.
- [x] **1.5 Two stale figures. DONE 2026-09-08** — the sweep's comment
      says 266 and `check:figures` holds it off the bank; the bytes
      comment says eight dims; the egress term charges every aggregate
      read at the aggregate's size. The similarity sweep's comment says ~110
      test items where the bank has 266 — `check:figures` gets the pin;
      `BYTES.aggDoc`'s comment says six dims where `BREAKDOWN_DIMS` is
      eight, and the egress term charges the deck refresh at
      `BYTES.aggDoc` rather than `otherDoc`. · **Gate:** `check:figures`,
      `pulse.test.mjs`.

**Done when:** the four changes are deployed and `npm run costs` prints
`reattach 4`. *(It does; the deploy is the merge.)*

## Phase 2 — names and scores ride the samples · **M, one pull request**

Nothing here changes what a user sees: Kindred has read the nightly
sample since D397, and the sheet keeps its live edge (2.4).

- [ ] **2.1 The ledger entry carries the name and the scores.** In the
      world branch of `onV2AnswerCreated` the profile is already in the
      transaction (D410); `ledgerEntry()` gains `n` (display name, ≤60)
      and `t` (the `testResults` subset the client parses — the core
      kinds and the logic percentile). The edit path has no profile read
      and stamps nothing; a row keeps what its create wrote.
      `ledger.ts`'s `LedgerDayEntry` and its `select` follow. ·
      **Gate:** `ledger.test.ts`, `pulse.test.mjs` (reads per branch
      unchanged).
- [ ] **2.2 The sample row carries them, and the merge is bounded.**
      `patternsSamples.ts`: `SampleRow` gains `n`, `s`, `l`;
      `sampleAdditions` caps the day's additions **per question to the
      newest 200** in the order the file already defines before
      `mergeSample` sees them — the fix for the day-sized sort
      (`DATA-EFFICIENCY.md` §3). · **Gate:** `patternsSamples.test.ts`
      (row shape; determinism; a 100,000-addition fixture merges in
      O(cap)).
- [ ] **2.3 The device stops reading profiles for people the sample
      named.** `voters.ts` `fetchVoterSample` fills `names`, `scores`,
      `logicPcts` from the rows; `resolveNames` then finds nothing
      missing for them. Faces stay per session (D178). · **Gate:**
      `voter-sample.test.ts`; `vote.test.ts` pins that a Kindred first
      view issues twelve sample reads and no profile query.
- [ ] **2.4 The who-voted sheet: the sample, plus a live tail.**
      `loadVoters` reads the sample, then one query for answers newer
      than the sample's day with `limit(VOTER_TAIL_CAP)` (50), names for
      the tail's uids only, and the viewer's own vote unioned from
      `state.votes` so it appears the moment it lands. Copy unchanged:
      "the latest 200" stays true. · **Gate:** the panel suites for the
      Friends, Type and Logic cuts; `vote.test.ts` pins ≤ 1 sample + 1
      tail query + ≤ 50 names per open.
- [ ] **2.5 Per-city samples for the city pass.** The same nightly fold
      writes `sample-{qid}~{city}` for every (question, city) pair with
      at least `CITY_SAMPLE_MIN` rows (12 — the lens's own floor), from
      the chips each entry already carries; `loadCityKindred` reads them
      and falls back to the live query only where none exists.
      `deleteAccount`'s sweep already matches the `sample-` prefix. ·
      **Gate:** `patternsSamples.test.ts`; `vote.test.ts` (twelve reads,
      no fan-out); `test:e2e:erasure` (a row leaves a city sample).
- [ ] **2.6 The model.** `socialTerms`: kindred's `names − 1` → 0,
      `whoVoted` → `sheetOpens × (1 + tail + tail names)`, and a
      `cityKindred` term added at its new size (it had none); the
      `data-inventory.md` rows for the new fields; `COSTS.md` regenerated.
      · **Gate:** `pulse.test.mjs`, `check:data-inventory`,
      `check:figures`.

**Done when:** `npm run costs` prints social ≈ 150, all of it Circle.

## Phase 3 — the answer map, live with a nightly heal · **M, one pull request**

The owner's word on *live* lands as a D421 amendment before this ships.

- [ ] **3.1 The rule and the row.** `firestore.rules`:
      `match /v2_users/{uid}/public/{docId}` — `allow get: if
      request.auth != null; allow list: if false; allow write: if false`
      — the answers' own grant (D98), one document. `data-inventory.md`
      gains the row. · **Gate:** `test:rules` (another signed-in account
      may get; nobody may list; no client may write),
      `check:data-inventory`.
- [ ] **3.2 The trigger writes it.** After `runAggTransaction` commits in
      the vote branch (every world surface Circle folds), one
      `set(v2_users/{uid}/public/answers, { a: { [qid]: idx }, at },
      { merge: true })` — idempotent under `retry: true`, on a document
      only that person's answers touch; `onV2AnswerUpdated` writes the
      new index the same way. A guard skips and logs
      `metric: answer_map_full` above `ANSWER_MAP_CAP` (40,000) entries.
      · **Gate:** `idempotence.test.ts` (a redelivered event writes the
      same map), `pulse.test.mjs` (writes per world answer +1).
- [ ] **3.3 The nightly heal.** `nightly.ts` merges the day's entries per
      active uid into the maps — one write per active person, off the
      read the pass already makes — so an entry a crashed function missed
      is present by morning. · **Gate:** `nightly.test.ts`.
- [ ] **3.4 The backfill.** `scripts/backfill-answer-maps.mjs` folds the
      `answers` collection group into maps (one read per existing answer,
      batched merges), run once through a `workflow_dispatch` workflow
      gated on `environment: production` in `rebuild-aggregate.yml`'s
      shape, before 3.5 reaches a phone. · **Gate:** the script's own
      test over a fixture; the run's summary against `answersCounted`.
- [ ] **3.5 Circle reads it.** `circle.ts` `fetchAnswersOf` becomes one
      `getDoc`; absent means the existing "could not read" arm;
      `setFollowing` refetches one document; `CIRCLE_ANSWER_CAP` retires
      with its `check:figures` row (**what a user sees:** old accounts
      compare on everything they have answered, the 300 newest no longer
      a cap). · **Gate:** `circle.reads.test.ts` (one read per member),
      `circle.test.ts`, the Circle panel suite.
- [ ] **3.6 Erasure.** `recursiveDelete` of `v2_users/{uid}` already takes
      the subcollection; `test:e2e:erasure` asserts the map is gone,
      which is the proof. · **Gate:** `test:e2e:erasure`.
- [ ] **3.7 The model.** The circle term → `circleOpens × circleFollows
      × 1`; writes +1 per world answer and +1 per active person per
      night; `COSTS.md` regenerated; the `answers (surface, answeredAt)`
      composite is left for a later index pass. · **Gate:**
      `pulse.test.mjs`, `check:figures`.

**Done when:** a Circle open issues one read per member and a friend's
answer is in your Circle within seconds; `npm run costs` prints social
≈ 1.

## Phase 4 — the folds that fail before they cost · **M**

- [ ] **4.1 The rollup fold drains.** `runRollupFold` loops pages until a
      short page or a time budget (300 of the 480 s), reports `capped`
      only when the budget ended it, and logs the count left. ·
      **Gate:** `engagement.test.ts` — a 25,000-rollup fixture drains;
      a budget stop leaves the rest unfolded, not lost.
- [ ] **4.2 The attention channel samples itself.** The fold computes
      tomorrow's rate from today's shard count (`min(1, 0.8 ×
      SHARD_FOLD_CAP / shards)`) and publishes `attnSampleRate` on
      `v2_meta/app`; the device reads it off the meta read it already
      makes and uses it instead of the constant; shards already carry
      their rate, so the estimates rescale. · **Gate:**
      `engagement.test.ts` (fold and client), `warm-boot.test.ts` (no
      new read).
- [ ] **4.3 The candidate scan streams.** `patternsAls.ts` gains an
      accumulator for per-item sufficient statistics (an 8×8 Gram and an
      8-vector per item); `scanUsers` feeds pages through it and holds no
      person; then the incremental step — subtract a changed person's
      previous contribution (their stored `v` and a hash of their map)
      and add the new — so only people who answered since the last solve
      are read. · **Gate:** `patternsAls.test.ts` (the streamed solve
      equals the buffered one on a fixture), `patternsFit.test.ts`, and a
      probe over 200,000 synthetic people under 256 MiB.
- [ ] **4.4 Velocity reads the pass's day.** `velocity.ts` takes the
      memoised day reader for the whole days in its window and reads only
      the partial-day tail itself; the cursor semantics stay. · **Gate:**
      `velocity.test.ts` (same flags on the same fixture).

**Done when:** the fixtures above pass at ten times today's caps.

## Phase 5 — the write path at scale · **L**

- [ ] **5.1 The increment fold.** `counts`, `total`, the `by` cells and
      `edits` become `FieldValue.increment` under `merge: true` — the
      overflow shards' shape — and the trigger's `pubRef` read leaves
      (`TRIGGER_READS.world` 3 → 2, pin moved). The bucket cap moves to
      the compactor (5.2), which reads the hot document once a minute and
      evicts to the overflow tail exactly as `pure.ts` does today. ·
      **Gate:** `pure.test.ts`, `idempotence.test.ts` (the ledger dedup
      still guards the increment), `test:e2e:all`'s exact-count
      assertions.
- [ ] **5.2 The sharded daily.** `v2_agg_shards/{qid}.{s}`, the trigger
      folding into `hash(uid) % N` for qids named on `v2_meta/app.hotQids`,
      and a scheduled `compactDailyAggV2` every minute for today's qid
      that sums the shards, **re-caps the union of their bucket maps into
      the overflow tail** (the correction to `ANSWER-SCALE.md` §4), and
      publishes the one document every client reads; the client's
      post-vote clear compares `total`. Rules and inventory rows;
      `check:appcheck` exemption with its reason (scheduler-invoked);
      `check:deploy-targets`. · **Gate:** functions tests, `test:rules`,
      an e2e summing helper for exact counts, and an emulator load probe
      at ten writes a second on one qid with the contention metric
      silent.
- [ ] **5.3 The trigger's ceiling.** `HOT_TRIGGER.maxInstances` raised
      (50) in the same pull request as 5.2, never before it. · **Gate:**
      `check:fn-runtime`; `COSTS.md`'s runaway ceiling regenerated.
- [ ] **5.4 The deck document.** `v2_decks/{day}` with the seven decks'
      `counts` and `total` only, written by the compactor for nothing
      extra; boot reads one document. · **Gate:** `bank-cache.test.ts`,
      `warm-boot.test.ts` pins.

**Done when:** the contention alert stays silent under the load probe
and `npm run costs` prints boot ≈ 15.

## Phase 6 — the model catches up · **S**

- [ ] **6.1** `cost-arith.mjs` reads `FIRESTORE_DB_ID` from `db.ts` and
      nets no free allowance on a named database (`COST-EXPOSURE.md` §2);
      the scheduler count off the `onSchedule` sites.
- [ ] **6.2** The boot term gains the four documents it lacks; the
      city-Kindred and reveal-history terms exist; egress prices the deck
      refresh at its bytes.
- [ ] **6.3** `COSTS.md`, `COST-COMPARISON.md`'s A+ row and
      `COST-REDUCTION.md`'s tables regenerated; `COST-EXPOSURE.md` C1
      closed. · **Gate:** `pulse.test.mjs`, `check:figures`, `check:docs`.

## Waiting on the owner, not on this file

- **The word "live"** for Phase 3 (D421 §2 records the recommendation
  and the arithmetic).
- **The reveal-history document** (`DATA-EFFICIENCY.md` §2.8): one
  document per group would show a late joiner the days before they
  joined, which today's per-day rule refuses. A privacy-shaped ask
  (D334), on `OWNER-LIST.md`; the per-member variant needs no ruling and
  is what gets built if the answer is no.

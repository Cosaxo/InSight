# Data-efficiency runbook — the ordered build list

> **Reasoning lives in [`DATA-EFFICIENCY.md`](DATA-EFFICIENCY.md)**, which
> is canonical, and the decision is D446 — the owner's approval of every
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
priced at about 6 % of what the map saves — and D446 records that the
word confirming it is still the owner's to give.

**What no step here may do** (D446 §3): show fewer people, questions or
answers than today; change a number a user sees except where the step
says so; loosen a rule; touch the three labelled denies; skip a test.

---

## Phase 0 — record and measure · **DONE with this pull request**

- [x] **0.1 The decision.** D446 in `DECISIONS.md`: what is approved, the
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
      unchanged. The one cadence item in this file — D446 names it, and
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

## Phase 2 — names and scores ride the samples · **M, one pull request** · **DONE 2026-09-08**

Nothing here changes what a user sees: Kindred has read the nightly
sample since D397, and the sheet keeps its live edge (2.4). Four things
moved against the plan as written, each named on its step: the stamp's
field names, a trigger the plan did not have, the sheet's hot/cold split,
and the city samples' bound.

- [x] **2.1 The ledger entry carries the name and the scores. DONE
      2026-09-08** — `n`, `s`, `l` rather than `n` and `t`: the PARSED
      forms (the device's `ParsedResults` and logic percentile), so the
      sample row copies them verbatim and the phone parses nothing.
      `functions/src/profileStamp.ts` is the server's copy of the
      device's parse, and `profileStamp.test.ts` holds it to the original
      by running `src/v2/data/similarity.ts` itself over a corpus of
      hostile shapes (a fixture would have been a third copy). The edit
      path stamps nothing; `idempotence.test.ts` pins both arms; the three
      fields are exempted from single-field indexes (`s` is a map of
      maps). **And a trigger the plan did not have:** `onV2ProfileUpdated`
      (`functions/src/profileFanout.ts`). A stamp as-of-the-answer would
      have left a renamed account under its old name on every question it
      did not answer again — for most rows, never — which is a visible
      reduction against today's seven-day cache, and "live is best when
      the cost difference isn't huge" is the owner's word on exactly this
      (D446 §2). The trigger reads nothing unless the stamp changed, then
      reads the account's own answers, the samples they name, and
      rewrites the three fields under `rows.{uid}` where a row exists —
      bounded by the account's answers, a handful of times per account
      lifetime (`B.stampChanges`). Registered in the deploy list and
      `check:fn-runtime`.
- [x] **2.2 The sample row carries them, and the merge is bounded. DONE
      2026-09-08** — `mergeSample` folds the additions to one per person,
      cuts them to the cap in the sample's own order BEFORE the merge
      (exact: an addition dropped there is outranked by cap others in the
      final sort), then merges; the same call takes the day's stamps and
      applies them to the day's OWN rows. An edit keeps its create's stamp,
      and the day's map is what supplies one to an edit that carries none.
      **It used to refresh EVERY row it rewrote**, on the argument that a
      new name would then reach questions the person did not answer today
      — and the argument is backwards: the day's map is built from the
      LEDGER, so it is the profile as of when they answered, while
      `profileFanout.restampSamples` writes the same fields with the
      profile as it stands now. Against a row the fan-out had already
      corrected, this wrote the older copy back, nightly, on a
      world-readable document — including republishing a political
      coordinate whose consent had been withdrawn (D330/D331). The
      fan-out and its nightly heal own the rows the day did not touch;
      they read the current profile, this cannot. **Still open** and on
      `OWNER-LIST.md`: a row the day DOES write still takes the
      as-of-answer stamp, so a withdrawal made after answering is
      republished on that day's own questions until the next profile
      change.
- [x] **2.3 The device stops reading profiles for people the sample
      named. DONE 2026-09-08** — `fetchSampleDoc` fills the three caches
      from rows that carry `n`, where the cache has nothing (a value read
      live this session keeps precedence); `resolveNames` then reads only
      the people no row could name. The read pin landed in
      `profile-cache.test.ts` rather than `vote.test.ts`, because that
      harness is the one that counts `v2_users` queries: Kindred's read of
      a stamped sample makes none.
- [x] **2.4 The who-voted sheet: the sample, plus a live tail. DONE
      2026-09-08, in three shapes** — no sample → the live list; sample
      and a tail under `VOTER_TAIL_CAP` (50) → the union, exactly the
      newest 200, the viewer's own row from the vote map; sample and a
      tail AT the cap → the live list again. The third shape is what
      keeps "the newest 200" exactly true: on a hot question (today's
      daily, at any real size) fifty of today over a hundred and fifty of
      before is not "the latest", and the plan's sentence promised the
      copy would not move. So the saving lands on the cold question — the
      feed card opened a week on — and the hot sheet costs what it did.
      **The owner can trade the exact claim for the cheaper hot sheet** —
      "as of last night, plus the newest 50", one sentence under the
      list — and that is on `OWNER-LIST.md`; the model carries the share
      as `B.sheetOpensHot` (0.7). `rules.test.ts` pins that the tail's
      range on `answeredAt` is granted like the city's equality.
- [x] **2.5 Per-city samples for the city pass. DONE 2026-09-08** —
      `v2_patterns/city-{qid}~{encodeURIComponent(city)}`, NOT
      `sample-{qid}~{city}`: the prefix differs so the erasure arm's
      id-range scan of world samples (`sample-` ≤ id < `sample.`) never
      enumerates the city family, which at scale is the product of two
      catalogues (10,929 places). **No `CITY_SAMPLE_MIN`**: a threshold on
      a document's rows cannot accumulate — a pair below it would be
      skipped tonight and start from nothing tomorrow — so every touched
      pair merges, and the bound is a nightly budget instead:
      `CITY_SAMPLE_PAIRS_PER_NIGHT` (30,000), hottest pairs first, read-
      merge-write in chunks of 300 so nothing is held. It binds around
      50 k DAU on the model's answer rates, where the night's coldest
      pairs wait for a busier day (the D397 caveat every sample carries).
      Erasure reaches the city documents through the account's OWN
      answers (`qid` and the frozen `anchors.city`, read before phase 1b
      deletes them) — bounded by its answers, not the catalogue —
      `e2e-delete-account.mjs` asserts a row leaves one. `loadCityKindred`
      reads the document first and falls back to the city-scoped live
      query where none exists (`vote.test.ts`).
- [x] **2.6 The model. DONE 2026-09-08** — `socialTerms` carries
      `kindred` at one document per question, a `cityKindred` term at the
      same size, and `whoVoted` split by `B.sheetOpensHot`; the server
      term gains the city samples' nightly read (`citySampleOps`, at the
      ceiling, capped by the budget) and the fan-out (`profileFanoutReads`,
      `stampChanges` a year at the mature account's size); the write side
      gains both. `cost-structure.mjs` lost its two rows and its copy of
      `memberAnswers`. **`npm run costs` prints social 197, not ≈ 150:**
      Circle's 150 plus the hot sheets' 46 — the "done when" below was
      written before 2.4's third shape was decided, and 46 is the price of
      the exact claim until the owner rules on it.

**Done when:** `npm run costs` prints social ≈ 150, all of it Circle —
**met at 197** for the reason 2.6 states; the remaining 46 is the owner's
sentence on `OWNER-LIST.md`.

## Phase 3 — the answer map, live with a nightly heal · **M, one pull request** · **DONE 2026-09-08, one click and one step after it left**

The owner's word on *live* landed the same day (*"start phase 3 and use
live for the answer map"* — the D446 amendment). Two things moved against
the plan as written, each on its step: the write is INSIDE the aggregate
transaction rather than after it, and the device keeps the answer query
as a fallback until the backfill has run.

- [x] **3.1 The rule and the row. DONE 2026-09-08** — `match
      /public/{docId}` under `v2_users/{uid}`: `get` for any signed-in
      reader, `list` and `write` closed; the rules suite pins a stranger's
      get, the refused list, the owner's refused writes and the signed-out
      refusal. The inventory row sits beside the answers it folds.
- [x] **3.2 The trigger writes it. DONE 2026-09-08** — inside
      `runAggTransaction`, not after it: one merged write on the person's
      own document, atomic with the ledger mark, so a redelivered event
      that returns on the ledger writes nothing here either and a crash
      cannot leave the map behind the count. The edit branch moves the
      entry after its retry guard. **No `ANSWER_MAP_CAP` guard**, and the
      reason given here was wrong for one of the six surfaces: this said
      the map is bounded by the bank and not by time, which holds for
      daily, feed, test, learn and call — one answer per question, the
      document id IS the question id — and does not hold for **pulse**,
      whose answer qid is the composite `{qid}_{day}`. Five templates
      today, so a daily-active account adds five keys a day forever:
      ~24 bytes an entry, ~43 KB a year. The 1 MiB ceiling is still
      distant (~24 years at that rate); the READ is the part that bites,
      since `fetchAnswersOf` takes the whole document with no field mask
      for up to `FOLLOW_CAP` = 50 members on one Circle open. Deferred
      with the arithmetic rather than guarded, because both remedies cost
      more than the guard — `answerMaps.ts`'s header has them.
      `idempotence.test.ts` pins the create, the edit, the merge
      across questions and the redelivery; the e2e loop asserts the map
      lands with the count and moves with the edit.
- [x] **3.3 The nightly heal. DONE 2026-09-08** — `runAnswerMapHeal`
      (`functions/src/answerMaps.ts`), the pass's sixth fold off the same
      ledger read: one map read per active person, a merged write only
      for the entries the day's ledger holds and the map lacks — never a
      differing value, because the map is the newer truth (an edit made
      after the healed day is in the map and not in that day's ledger).
      Yesterday only, no cursor: the trigger is the writer and a failed
      night is a day's lag, not a hole. It speaks (`answer_map_heal`, a
      warning) only when it healed something, since a healed entry is a
      missed live write.
- [x] **3.4 The backfill. DONE 2026-09-08, the click is the owner's** —
      `backfillAnswerMapsV2` walks the `answers` collection group in path
      order (one person's answers together), a page of 1,000 at a time,
      merging each page's rows into maps and handing its cursor back
      near its deadline; `scripts/backfill-answer-maps.mjs` loops it and
      `backfill-answer-maps.yml` dispatches it in `rebuild-aggregate.yml`'s
      shape (production environment, dry by default, resumable from the
      cursor its summary prints, idempotent). `answerMaps.test.ts` drives
      the paging over a fake; the e2e loop runs it dry and applied and
      pins that it leaves a map the trigger wrote unchanged.
      **On `OWNER-LIST.md`: dispatch it once, dry then `apply`.**
- [x] **3.5 Circle reads it. DONE 2026-09-08, with the fallback** —
      `fetchAnswersOf` reads the map: one document, every world answer,
      no cap (what a user sees: an old account compares on everything it
      has answered). A member with NO map falls back to the answer query
      as it was, because the client ships with the trigger and the
      backfill is a click the owner makes afterwards — without the
      fallback every Circle would show nobody in between. So
      `CIRCLE_ANSWER_CAP` and its `check:figures` row stay until 3.8.
      `setFollowing` still refetches the fold, which is now one read per
      member. `circle.reads.test.ts` pins the map read, the no-query
      case and the fallback.
- [x] **3.6 Erasure. DONE 2026-09-08** — the erasure e2e seeds the map
      and asserts it gone with the subtree.
- [x] **3.7 The model. DONE 2026-09-08** — `circle` → `circleOpens ×
      circleFollows`; `ANSWER_MAP_WRITES_PER_ANSWER` on the write side,
      `ANSWER_MAP_HEAL_READS` on the server's; the Circle rows left
      `cost-structure.mjs` and `cost-levers.mjs`. `npm run costs`: 277 →
      129 reads per user-day at maturity, social 197 → 48 (the hot sheets'
      46, Kindred and the city pass at one document each, Circle 0.5).
- [ ] **3.8 Retire the fallback, after the click.** Once the backfill has
      applied: `fetchAnswersLegacy` goes, with `CIRCLE_ANSWER_CAP`, its
      `check:figures` row, the `pulse.test.mjs` pin and the `(surface,
      answeredAt DESC)` collection-scope composite it needed
      (`firestore.indexes.json`, `indexes.test.ts`); a member with no map
      is then a member with no answers. · **Gate:** `circle.reads.test.ts`,
      `check:figures`, `indexes.test.ts`.

**Done when:** a Circle open issues one read per member and a friend's
answer is in your Circle within seconds — **met**; `npm run costs`
prints social ≈ 1 — **48**, for the reason 2.6 states: the hot sheets'
46 are the owner's sentence.

## Phase 4 — the folds that fail before they cost · **M, one pull request** · **DONE 2026-09-09, one step open**

Four folds that were fine at one user and stopped working — silently —
at sizes the tables reach. None costs a read to fix; one (4.3) costs
reads until its second half is built, and says so.

- [x] **4.1 The rollup fold drains. DONE 2026-09-09** — `runRollupFold`
      loops pages of `ROLLUP_FOLD_CAP` until a short page, a full page
      that folded nothing (junk rows the fold declines and never marks —
      asking again returns the same ones forever, the attention fold's
      own rule) or the time budget (`ROLLUP_FOLD_BUDGET_MS`, 300 of the
      pass's 480 s — a SLICE, which `runNightlyPass` turns into an
      absolute instant: the earlier of that slice from where the fold
      actually starts and the invocation's own ceiling less its tail,
      since this fold runs LAST and 300 counted from t=250 would end
      past the kill). `capped` is true only when the budget ended it, and
      then the summary carries `left` — a `count()` aggregation over the
      unfolded rollups, one read per 1,000 counted, paid only on a
      budget stop — so the warning names a number rather than a hope. `engagement.test.ts`: a 25,000-rollup fixture
      drains in three pages; a budget stop reports what is left and
      leaves it unfolded, not lost; a page of junk stops rather than
      spins.
- [x] **4.2 The attention channel samples itself. DONE 2026-09-09** —
      `nextSampleRate` computes tomorrow's rate from tonight's shard
      count at tonight's rate (`current × 0.8 × SHARD_FOLD_CAP / shards`,
      clamped to `[MIN_SHARD_RATE, 1]` — the rules' own floor — and
      rounded to three places) and the fold publishes it as
      `attnSampleRate` on `v2_meta/app`, one merged field on the
      document every device reads at boot. The device takes it off that
      read (`engagement.setSampleRate`, no new read), persists it with
      the tallies, and draws tomorrow's coin at it instead of the
      constant; shards already carry the rate they were drawn at, so the
      estimates rescale as they always did. At 100,000 devices the rate
      settles near 0.16 in a few nights — 16,000 shards, 80 % of the
      cap — and climbs back toward 1 when the pile shrinks.
      `engagement.test.ts` (the fold publishes 0.8 then 1; the
      convergence; the client's accepted, refused and persisted rates);
      `warm-boot.test.ts` holds its read count.
- [x] **4.3 The candidate scan streams. DONE 2026-09-09 — the memory
      half; the read half is 4.3b** — `alsFitStreamed`
      (`patternsAls.ts`) holds no person: each sweep streams the people
      through `scanUsers`, solves each person's ridge vector on the fly
      and accumulates it into per-item sufficient statistics (an 8×8
      Gram and an 8-vector per item), then solves the items from those.
      Resident memory is the item statistics — a fixed set — where it was
      one answer map per person ever fitted (the out-of-memory near
      150,000 people on 256 MiB, ~600,000 on the 1 GiB Phase 1.3 gave
      it). `patternsAls.test.ts`: the streamed solve equals the buffered
      one on a fixture to nine places; a probe over 200,000 synthetic
      people (`ALS_PROBE=1`, opt-in — it runs 20 s) grows the heap by
      under 64 MB. **What it costs:** the scan is 1 + `ALS_SWEEPS` = 4
      state reads per fitted person a night where it was one, because
      each sweep reads the people again rather than holding them —
      `PATTERNS_SCAN_READS_PER_MAU` in the model, ~600 k reads a night
      at 50 k DAU, $0.18 a night. Cents today, and the trade is
      deliberate: a night that costs a dollar beats a night that dies.
- [ ] **4.3b The changed-since step.** Keep each person's last
      contribution to the item statistics (their stored `v` and a hash
      of their map) and, per night, subtract the old contribution and add
      the new for the people whose map changed since the last solve —
      so the nightly read is one per ACTIVE person, not four per person
      ever fitted. The `scanActiveOnly` row of `npm run costs:structure`
      prices it: 11 reads per user-day, $4.95 a month at 50 k DAU, $50
      at 500 k. Worth building when the fitted population passes
      ~100,000, or sooner if the bill says so. · **Gate:**
      `patternsAls.test.ts` (the incremental solve equals the streamed
      one after a changed person), `patternsFit.test.ts`.
- [x] **4.4 Velocity reads the pass's day. DONE 2026-09-09** —
      `runVelocityScan` (`velocity.ts`) runs inside `digestEngagementV2`
      as the pass's fourth runner, off the same memoised ledger reader as
      the digest, the fit, the taste fold and the heal: the WHOLE days in
      its window (`lastScanAt → now`, ≤72 h, the cursor semantics kept)
      come off the read the pass already makes, and only the partial day
      since midnight is its own paged read — 143 of 1,440 minutes at
      02:23 UTC, so `VELOCITY_READS_PER_LEDGER_ENTRY` is 0.1 where it
      was 1. The signals, the flags, the `bind_coverage` line and the
      `velocity_scan` heartbeat are unchanged; the heartbeat now comes
      from `digestengagementv2` (`DEPLOYMENT.md` § Reading the velocity
      scan, and the monitoring policy's own text). The scheduled
      `ledgerVelocityScan` left the source and the deploy's `--only`
      list, so — as with `fitPatternsV2` and `fitTasteV2` — the deploy
      cannot remove it: **its `functions:delete` is on `OWNER-LIST.md`'s
      existing row.** `velocity.test.ts`: the same flags on the same
      fixture; the whole days asked of the reader and the tail of the
      store; an empty tail does not move the cursor.

**Done when:** the fixtures above pass at ten times today's caps —
**met where a cap exists**: 25,000 rollups against a page of 10,000,
100,000 devices against a shard cap of 20,000, 200,000 people against
the 150,000 that used to fail. `npm run costs`: server reads 40 → 44 per
user-day at maturity for this phase (velocity −3.6, the streamed scan
+9 until 4.3b, the sampled shard fold −0.7), the whole 129 → 134; the
head prints 43 and 132, because D426's rounds landed from `main` in the
same merge and took one read off a reveal and one off the rules.

## Phase 5 — the write path at scale · **L** · **direction under the owner's decision at D447**

> **2026-09-09.** The owner asked for a structure that scales to hundreds
> of answers a day and millions of users; `SCALE-ARCHITECTURE.md` is that
> design, and its phase B — live counters in Redis and a compactor writing
> the same aggregate document once a minute — is this phase's compactor
> with a cheaper counter store and no shard documents to fold. If the
> owner adopts it (`OWNER-LIST.md` § Decisions), this phase is superseded
> by phase B and the steps below are not built as written; until that
> word they stand. **The word came the same evening (D447's amendment):
> superseded — the steps below are not built as written; the work is
> `LOG-FIRST-RUNBOOK.md` phase B.**

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

- ~~**The log-first direction** (D447, `SCALE-ARCHITECTURE.md`): whether
  Phase 5 becomes its phase B, one sentence of D98 for the compactor's
  cadence, and the batch window~~ — answered 2026-09-09, all three
  (D447's amendment); the clicks that remain are `LOG-FIRST-RUNBOOK.md`'s.
- **The word "live"** for Phase 3 — given 2026-09-08 (the D446
  amendment records it). What stays the owner's from that phase is the
  backfill's click, dry then `apply` (`OWNER-LIST.md`).
- **The `functions:delete`** of the three retired nightly functions —
  `fitPatternsV2` and `fitTasteV2` since D399, `ledgerVelocityScan` since
  runbook 4.4 — one row on `OWNER-LIST.md`; the deploy's `--only` list
  cannot remove what it no longer names.
- **The reveal-history document** (`DATA-EFFICIENCY.md` §2.8): one
  document per group would show a late joiner the days before they
  joined, which today's per-day rule refuses. A privacy-shaped ask
  (D334), on `OWNER-LIST.md`; the per-member variant needs no ruling and
  is what gets built if the answer is no.

# Answer volume — the ceilings that grow with use, not with content

**Status: mixed — §2.1 and §2.2 are BUILT (D311, 2026-08-26); §4 is a
design on the shelf, §3 needs nothing.** Written 2026-08-26, out of the
owner's question "is this system ready for high numbers of questions and
answers?", and built the same day on the owner's direction — D311 is the
as-built, including the deviations (`insight.feedVotes.v1` stays behind,
the test aggregates persist deliberately now, the recheck stamps moved
too). The **questions** half of that has
its plans and most of the urgent parts are built:
[`SCALE-PLAN.md`](SCALE-PLAN.md) is what an unbounded feed costs (its
core/tail split classified and enforced in the Mirror),
[`BANK-DELIVERY.md`](BANK-DELIVERY.md) is how many questions a device can
be handed (ceiling 1 built at D284, ceiling 2 scheduled, ceiling 3
deliberately deferred), and `npm run costs:scale` shows the steady-state
bill flat from 513 to 100,000 bank documents. This page is the **answers**
half, which had no plan — the ceilings that move not when the bank grows
but when people keep answering: what an engaged device accumulates, and
what a globally shared question sustains.

Building any phase below graduates to a `DECISIONS.md` record; this is
the plan that record would cite.

## 0 · What this sits beside, and what it does not revisit

Not supersessions — neighbours, and two corrections.

| Page | Relation |
| --- | --- |
| [`SCALE-PLAN.md`](SCALE-PLAN.md) | Untouched. Its density argument (total answers/day = DAU × answers-per-user, conserved regardless of bank size) is what makes answer volume a DAU question, and this page leans on it |
| [`BANK-DELIVERY.md`](BANK-DELIVERY.md) | This is its twin. That page counts questions handed *to* a device; this one counts what comes *back* — and §2 below finds that its §3 fix (the IndexedDB move) is due sooner than its own trigger suggests, for a reason outside its frame |
| [`COSTS.md`](COSTS.md) § the walls | Wall 1 (D7's write contention, first by a wide margin since D129) is this page's §4. The wall's headline — "fix already named (shard the counter)" — is still true; the *recorded design* behind it is not buildable as written, which §4 is about |
| D98 · D129 | Not revisited. Publish-per-answer and poll-not-stream are the standing shape; everything below works inside it |

The two corrections this page carries, named up front the way §0 sections
here are supposed to:

1. **`question-quality.mjs`'s cache budget assumes the other half stays
   small.** `BANK_WARN`'s arithmetic budgets the bank "roughly half" of
   the ~5 MB origin quota because it is "one of ~29 `insight.*` keys" —
   a fair split while every other key is bookkeeping. One of those keys
   is `insight.aggsCache.v1`, and it grows with every question the
   device's owner answers (§2). The budget is a constant guarding
   against a variable.
2. **The recorded sharding design predates D98's collapse.** The D7
   amendment of 2026-08-03 prices sharding as M by sharding
   `v2_aggs_private/{qid}` alone and summing "in the 1-in-5 publish
   path". D98 then deleted the publish cadence and collapsed the private
   doc into the public one on the vote path. A decision record is a
   snapshot and stays as written; the *plan* it holds no longer
   corresponds to any document the vote path writes. §4 re-derives it —
   and finds the post-D98 shape is *better*, not just different.

## 1 · What already holds at volume

Listed so the next person does not re-audit it, in the
[`SCALE-PLAN.md`](SCALE-PLAN.md) §1 style: each row names where it was
read, and most of these exist because something already broke once.

| Piece | Verdict | Why |
| --- | --- | --- |
| Read fan-out | **flat in DAU** | D129: the deck is polled (`AGG_POLL_MS`, today only while visible), not streamed. `idle-detach.test.ts` proves no snapshot listener attaches. This was the superlinear term (COSTS.md finding 2) and it is gone |
| Aggregate document growth | **bounded** | `BREAKDOWN_MAX_BUCKETS` (24) × 7 dims × ≤20 options with eviction (`functions/src/pure.ts`) — its own comment prices the worst case at tens of KB against Firestore's 1 MiB. Catalog `entBy` carries a per-cell cap; a rank aggregate is one array |
| The cold answer pull | **paged, loud** | `ANS_PAGE` 1000 × `ANS_MAX_PAGES` 100 in `live.ts`, terminating on a short page, reporting rather than truncating. The warm path is two cursors (`answeredAt`, `editedAt`) that self-heal across boots |
| The agg-events ledger | **TTL-bounded** | 90 days (`LEDGER_RETENTION_DAYS`), and both nightly readers page it — the patterns fit in 5,000-doc `select()` pages, the velocity scan per D64 |
| Duel reveals | **indexed** | `pendingDays` marks let the scan ask "which groups played yesterday" instead of reading every group |
| Voter lists / profiles | **capped** | `VOTER_FETCH_CAP` per open; the profile cache holds `PROFILE_CACHE_CAP` (800) entries under a 7-day TTL — added precisely because it was "the one client cache with no natural ceiling". §2 is the same finding one cache over |
| The patterns fit | **incremental** | Folds yesterday's ledger only, catch-up bounded at `PATTERNS_CATCHUP_DAYS`. Its header records the memory note: the day's user vectors fit ~100k DAU in 256 MiB, and the fix at that size is paging the fold by uid range — recorded, not built, and this page adopts it as §5 item 4 |
| Server cost | **linear, modelled** | One trigger invocation and a bounded transaction per answer; `npm run costs` takes answers/user/day as an input. Growing the bank cannot manufacture answers (the density argument), so per-question rates *fall* as the feed grows — the daily lane is the one deliberate exception, §4 |

What that table does not contain is the point: nothing in it watches the
**client's accumulated answer state**, and nothing in it makes the write
wall's remedy buildable. Those are the two ceilings.

## 2 · Ceiling 1 — the answer-state caches are the unowned quota

`live.ts` mirrors answer-derived state into localStorage under three
keys, every one written inside a `try/catch` that swallows failure:

- **`insight.aggsCache.v1`** — the whole `state.aggs` map: one entry per
  question this device holds a published aggregate for, each carrying its
  full `by` breakdown. Never pruned; `saveAggCache`'s own comment says
  so, and prices the serialisation at roughly one full-map
  `JSON.stringify` per second during a vote burst, on the main thread,
  growing with the session.
- **`insight.answersCache.v1`** — every vote the account ever cast, the
  cursor pair beside it.
- **`insight.feedVotes.v1`** — the spec feed's own mirror of the same
  votes, in control units.

All three grow with **answering**, not with the bank: an engaged device
adds an aggregate and two vote entries per question answered, and the
archive also grows with plain tenure — `hydrate`'s own comment records
that duel (`g_{gid}_{day}`) and pulse (`{qid}_{day}`) answers "mint a
document per day forever, so an engaged account passes 1000 inside a
year", and each pulse day-doc brings its own aggregate into the cache.

**The arithmetic, marked as the estimate it is.** A bank document
averages ~280 bytes on the wire (`check:figures`' scan); a *mature*
aggregate with a populated `by` map is one to two orders of magnitude
bigger — `pure.ts` prices the worst case at tens of KB, and a realistic
well-answered daily runs single-digit KB. So somewhere between a few
hundred and ~2,000 well-answered questions, the aggs cache alone reaches
the megabytes — inside a ~5 MB origin quota of which the bank's own gate
has already budgeted half for `insight.bankCache.v2`. The two growth
curves meet in the same box, and only one of them has a gate. Nobody has
measured the real average aggregate size because pre-launch there is no
real `by` data to measure; the phase-1 instrument below is what turns
this paragraph into a figure.

**The failure mode is worse than the bank cache's, and it is the same
silence.** The quota is per-origin, so the day it fills, **every**
`insight.*` write starts throwing — and every write site in the tree
catches and ignores it (verified by grep: the spec layer's stores, the
caches, the purge bookkeeping all guard-and-swallow). The device does not
crash; it stops *remembering*. Streaks, learn progress, follows, the
feed's pass/defer state, the patterns gate's crossing — every store
degrades to session-only at once, with no symptom anywhere and no way
for the person to connect the app "forgetting" to anything. The bank
cache's version of this costs money (a refetch per boot); this one costs
product truthfulness, which is the dearer currency here.

**No static gate can own this.** `BANK_WARN` reasons from the seeded
bank, which is tree state; a device's answered count is runtime state.
So the gate's shape is wrong for it, and the remedy splits in two:

### 2.1 · Phase 1 — instrument the swallow (S) · **BUILT (D311)**

> `lsSet` in live.ts: every swallowed write counts
> (`stats.cacheWriteFailures`), the first quota-shaped failure reports
> once per session with the key and size, and an absent storage stays
> silent. What follows is the reasoning as it stood.

The D7 amendment's lesson, applied before it needs re-learning: the
condition must be observable before anything is built for it. One
throttled `reportError` (once per session, `where: "quotaExceeded"`,
carrying which key and the serialized size that failed) at the shared
write sites, plus a `state.stats` counter. Cheap, and it converts "we
think engaged devices will hit this in year N" into dated reports from
real devices — which is also the trigger for phase 2 that
`BANK-DELIVERY.md` §3's own trigger (bank past ~2,000 docs) cannot see,
because that trigger watches the bank and this ceiling moves with use.

### 2.2 · Phase 2 — one IndexedDB store for the hand caches (M) · **BUILT (D311)**

> `data/cacheStore.ts`, same day — the trigger collapsed to "the owner
> said build". As built with three recorded deviations, D311: the feed
> mirror STAYS in localStorage (the spec feed reads it synchronously — it
> moves with the bridge migration, not as a rider), the test aggregates
> persist deliberately where the blob persisted them incidentally, and
> the recheck stamps moved along. The purge half landed as planned, both
> directions, with `check:purge` grown to see IndexedDB openers.

The same move `BANK-DELIVERY.md` §3 already plans for the bank cache, in
the same pass, for the same reason: the app already keeps Firestore's
own mirror in IndexedDB (`persistentLocalCache()`), and the quota there
is effectively removed as a concern. Two things are different on the
answers side and worth stating:

- **Per-key writes replace the whole-map stringify.** An object store
  keyed by qid turns `saveAggCache`'s once-a-second full serialisation
  into writes of the entries that changed — which retires the
  main-thread cost that grows with the archive, not just the quota.
  `insight.answersCache.v1` and `insight.feedVotes.v1` ride along.
- **The purge must reach the new store, and the claim is already
  published.** `deleteAccount` today does `terminate()` +
  `clearIndexedDbPersistence()` for Firestore's mirror and sweeps
  `insight.*` for localStorage; a hand-rolled IDB store is a third thing,
  cleared in the same phase, or `web/privacy.html`'s "clears the app's
  data on this device" stops being true — D183's discipline, and
  `check:purge` is the gate that should grow the listener.

What must **not** happen instead: pruning. The aggs cache feeds the
Mirror's archive folds (`LIVE.aggregated()` — the corpus
`SCALE-PLAN.md` §1's filter table is about), so evicting entries trades
quota for re-reads *and* thins readings; and `insight.answersCache.v1`
is correctness, not decoration — a pruned vote re-offers an answered
question, and the create-only rule then refuses the re-answer
(`hydrate`'s own comment). If the store is ever size-pressed again the
lever is the core/tail split's corpus, never a cache eviction.

`BANK_WARN`/`BANK_FAIL` stay where they are for the bank, per
`BANK-DELIVERY.md` §3's closing rule, and get re-pointed at the new
store's real budget when the move lands.

## 3 · Ceiling 2 — a life's archive on one device

Named so nobody re-derives it, sized so nobody builds for it:

- **A device migration pays the archive.** The cold pull is one read per
  answer document ever written, paged and loud past `ANS_PAGE` ×
  `ANS_MAX_PAGES` (100,000). At the comment's own "1000 inside a year"
  pace that bound is decades out, and the cost is once per new device,
  not per boot. Nothing to do.
- **The Mirror's folds walk every answered aggregate per stop open.**
  Bounded by the same archive, on-tap by the D119 cost structure, and
  §2.2's per-key writes remove the only *recurring* main-thread cost
  that grows with it. Leave the folds alone until a profile says
  otherwise — a session-cached fold over even 10,000 entries is
  arithmetic, not I/O.

## 4 · Ceiling 3 — the write wall, and a remedy that can be built

The wall itself is COSTS.md wall 1 and is not re-argued: every answer to
one question is one transaction on `v2_question_aggs/{qid}`, Firestore
sustains ~1 write/sec/document (D7), and the daily lane concentrates a
day's answers on a single qid inside a waking window — reproduce the
crossover with `npm run costs`. The instrument exists
(`runAggTransaction` logs at `CONTENTION_ATTEMPTS`, the monitoring
policy alerts on it), so the wall announces itself before it bites.
**Only the daily lane has this problem by construction**: the feed's
answers spread across the whole bank, so growing question volume
*lowers* per-qid write rates everywhere else — the density argument
working in this page's favour.

What does not exist is a buildable remedy. The recorded one (§0,
correction 2) shards a document the vote path no longer writes and sums
in a cadence D98 deleted. Re-derived against the tree as it stands:

**Everything the aggregate paths publish is an additive counter.**
`counts`, `total`, the `by` cells, the `edits` matrix, a rank's `pos`
sums — every field of the post-D98 document folds by addition, which is
exactly the property that makes sharding client-invisible:

- **`v2_agg_shards/{qid}.{s}`**, N documents per sharded qid. The
  trigger picks `s = hash(uid) % N` and folds there instead of into
  `pubRef` — same ledger dedup, same transaction discipline, contention
  cut by N. The D86 edit path lands on the same shard as its create
  (same uid, same hash), so `retargetCounts`' refusal logic is
  untouched.
- **A compactor sums the shards into `v2_question_aggs/{qid}` in the
  exact published shape.** Clients change *nothing*: the poll, the
  top-up, the Mirror and the rules (`allow write: if false` on both
  collections) all keep reading the one document they read today. The
  cadence only needs to match what readers already see — the deck poll
  is `AGG_POLL_MS` (60 s), so a per-minute compaction of **today's qid
  only** is invisible in every path but one:
- **The one client-visible seam, named now so it is not found later:**
  after a vote, `scheduleAggRefresh` re-reads the aggregate at 2.5 s and
  clears the `unaggregated` +1 display flag when the document exists.
  Under compaction the re-read can precede the fold, and a premature
  clear hides the person's own vote for up to a poll. The clear rule for
  a sharded qid must compare totals (clear only once `total` exceeds the
  pre-vote total), which the client can do with state it already holds.
- **Scope: the daily lane only, switched per-qid, on the alert.** Feed,
  test, catalog (which still writes `v2_aggs_private` for its `ent`
  accumulator) and rank paths keep the direct fold — their per-qid rates
  fall as the bank grows. Sharding is a mode the trigger enters for qids
  named hot, not a migration.

What the build pays, so the decision is made against the real price: a
new scheduled function (deploy allowlist, `check:deploy-targets`;
scheduler-invoked so no App Check arm), a rules-and-inventory entry for
`v2_agg_shards` (`check:data-inventory` will demand the row), a
[`COSTS.md`](COSTS.md) line *before* it ships (VISION-V28 §13's
discipline — the compactor is ~N reads + 1 write per minute per hot qid,
and the trigger's ordinary answer swaps one contended write for one
uncontended one), and one summing helper for the e2e's exact-count
assertions. That is the M the 2026-08-03 amendment promised, restored on
premises that exist.

**When: on the contention alert, or ahead of the first push-notification
spike — not now.** D7's discipline holds: zero users, no build. What this
section changes is only that the shelf now holds a design that can be
taken down and built.

## 5 · Order of work

1. ~~**Instrument the quota swallow (§2.1).**~~ **Done — D311.** The
   sensor exists; what it reports from real devices is what the
   remaining numbers on this page firm up against.
2. ~~**The IndexedDB move for bank + answer caches together (§2.2).**~~
   **Done — D311**, ahead of both planned triggers on the owner's
   direction. Purge and `check:purge` extended in the same change; the
   feed mirror's stay-behind is the recorded deviation.
3. **Sharding stays shelved, buildable (§4).** Build on the alert. The
   COSTS.md line lands with the build, not before.
4. **The patterns fold pages by uid range** when DAU approaches its
   recorded ~100k comfort bound — adopted from `patterns.ts`' own
   header so it is indexed here rather than only in a comment.
5. **The measurement debt stays FEATURE-COMPLETE's row** (`bgCycles`,
   `onlineMin`, the D98 open rates) — those inputs decide the wall
   ordering this page inherits, and a week of real usage answers all of
   them.

## 6 · Failure modes

| Failure | Mitigation | Residual |
| --- | --- | --- |
| The bank cache moves to IndexedDB and the answer caches stay behind | §2.2 moves them in the same pass; this table row is the reminder that the bank's gate going green says nothing about the quota's other tenant | A future cache added straight to localStorage — the instrument (§2.1) reports it when it matters |
| Quota fills before anything moves | §2.1 makes it visible and dates the deadline | The devices that fill it before the instrument ships report nothing |
| Pruning reached for instead of moving | §2.2 names why both caches refuse it (thinned readings; create-only re-answer refusals) | — |
| Sharding built to the stale record | §4 re-derives it; the record stays as the snapshot it is | — |
| The compactor's lag reads as broken counts | The `unaggregated` display flag already covers the window; the total-comparison clear rule (§4) is the one code change it needs | A person watching a *stranger's* vote land within a minute — already the D129 trade, unchanged |
| The new IDB store outlives an account | Purge extended, `check:purge` listener, `web/privacy.html`'s claim re-verified | — |
| This page's estimates harden into figures | Every number here is either a named constant, a command, or marked as estimate; the §2 instrument is what mints the real ones | The habit — `check:figures` exists because it recurs |

## 7 · What I would do

Ship §2.1 this week — it is an afternoon, and every other decision on
this page improves the moment it reports from a real device. Fold §2.2
into the IndexedDB pass BANK-DELIVERY already owes so the box is opened
once. Leave §4 on the shelf with its alert armed, and spend nothing else
here until the instruments say to: the answers side, like the questions
side, mostly needs its silent failures made loud — and then the
discipline this repo already has does the rest.

# The data structure, priced per user once there are users

**Status: measured 2026-09-08 — §§1–4 read the tree; §5 is the build
order, approved by the owner the same day (D420) and carried as steps in
[`DATA-EFFICIENCY-RUNBOOK.md`](DATA-EFFICIENCY-RUNBOOK.md); nothing is
built yet.** Written on the owner's redirection of the same
day (*"go through the data structure and see if we could optimize the
firebase cost when we get users … what is needed is that we have an
efficient as possible structure when we actually get users"*), against
`3f49530`. Every figure below is printed by **`npm run costs:structure`**
(`scripts/cost-structure.mjs`), which prices each reshape as a delta on
the shipped model's own per-user-day terms and never retypes a number.

[`COSTS.md`](COSTS.md) says what the app costs at five sizes and
[`COST-REDUCTION.md`](COST-REDUCTION.md) which caps and cadences would
make it smaller. This page asks a different question of the same
arithmetic: **for each read a user causes, which document is read, what
of it is used, and would a different document give the same picture for
less.** It keeps `COST-REDUCTION.md` §5's refusal — a smaller picture is
not a saving — and changes the documents, never the picture.

## 0 · The answer in one screen

- **The bill is reads, and reads are flat: about 381 per user per day at
  every size** (`npm run costs`), which is the shape D129 bought. Of those,
  **282 — 74 % — are three surfaces reading raw answer documents one at a
  time**: Circle (150: up to 300 answer documents per followed member),
  Kindred and the People lens (72: the nightly sample, then a profile
  document per voter for a name), and the who-voted sheet (60: 200
  answers and 200 profiles).
- **Each of the three folds a few kilobytes of information out of
  hundreds of documents.** Circle uses `qid → optionIdx` per member; the
  sheet uses uid, option, the frozen chips and a display name; Kindred the
  same minus the name it then fetches. A precomputed document per person
  and a name on the sample row serve the identical picture at about a
  hundredth of the reads.
- **Priced: 381 → 57 reads per user per day (−85 %), for one or two
  extra writes per user per day** — 357 → 57 since runbook 1.4 shipped
  the same afternoon and took the foreground refresh's 24. Reads and
  writes together, straight off the `europe-west1` sheet with no free
  allowance: **$19 → $5.57 a month at 5,000 DAU, $188 → $56 at 50,000,
  $1,879 → $557 at 500,000.**
  Half of the saving is one document (Circle's); the next third is a name
  on a document the nightly fold already writes, at no new server read.
- **The model understates the social reads, so the saving is larger
  than the table says.** Two client fan-outs have no term at all — the
  city-scoped Kindred pass (D278: twelve live queries of up to 200 answer
  documents plus names, per session, for anyone with a city who opens the
  City stop) and the reveal history (13 reads per group per session) —
  and the boot term is four documents short. §1 names them; the same
  documents that fix Kindred fix the city pass.
- **The write side is near its floor in operations** — three writes per
  world answer (the answer, the ledger entry, the aggregate), each with
  a reader — **and not in what each write carries**: the aggregate is
  read and rewritten whole on every answer (up to ~40 KB), and two
  collections nobody queries by field carry thousands of index entries
  per document because no exemption was ever declared for them. Both
  are §3, with the daily's write-contention wall at ~14,400 DAU, for
  which [`ANSWER-SCALE.md`](ANSWER-SCALE.md) §4 holds a buildable design
  that changes nothing a client reads — with one correction.
- **Four things stop working before they stop being cheap** (§3): the
  rollup fold reads one page of 10,000 and stops, the candidate engine's
  nightly scan buffers every person ever fitted on a 256 MiB instance,
  the voter-sample merge materialises a whole day's answers per hot
  question, and the answer trigger's `maxInstances: 10` is a ceiling of
  200 folds in flight. None is a bill; each is a night that fails
  silently at a size the tables above reach.
- **One decision is the owner's, and it decides the cost of the build:**
  whether Circle, the sheet and Kindred may draw from documents the
  nightly fold writes — a day behind the live answers — or whether the
  trigger keeps them live at one extra write per answer. Both are priced;
  the nightly version costs one write per active person per night (§5).
- **What looks wasteful and is not** is listed in §4 so nobody spends an
  evening on it: the ledger, the trigger's profile read, the rules' one
  `get()`, the poll, the similarity sweep.

## 1 · Where a user-day's reads go, document by document

The model's terms at maturity, with the documents behind each
(`scripts/cost-arith.mjs` `readsPerUser`; `src/v2/data/live.ts` for the
client sites, `functions/src` for the server's):

| Term | Reads/user-day | What is read | What is used |
| --- | ---: | --- | --- |
| boot | 23 (really ~29) | per boot (1.4 a day): `v2_meta/app`, own profile, own-answers delta (two queries, modelled as one), **7 deck aggregates**, the groups query, 2 group docs, 2 reveals; plus 2 paged cards a day (D401). **Four unconditional `getDoc`s are in none of the 15**: `v2_rank/daily`, `v2_rank/learn`, `v2_rank/feed`, `taste/profile` — +5.6 reads per user-day | everything but the 7 aggregates is one document each; the deck renders `counts` and `total` of seven `v2_question_aggs` and nothing of their `by` maps |
| reattach | 4 (28 until 1.4) | today's aggregate on every foreground, plus any deck card the device holds no aggregate for (`startAggPoll("today")`, `REATTACH_DOCS`), 4 cycles a day — the whole deck was re-read on every foreground until runbook 1.4 shipped, 2026-09-08 | today's counts; the six back days refresh at boot |
| social · Circle | 150 | 0.1 opens × 5 members × **≤300 answer documents each** (`circle.ts` `fetchAnswersOf`: `where surface in …, orderBy answeredAt desc, limit 300`) | `qid → optionIdx` per member, folded by `agreement()` into a percentage and a shared count |
| social · Kindred / People / pair | 72 | 0.03 views × 12 questions × (1 sample document + **200 profile documents** for names) | uid, option, chips from the sample; `displayName` (and scores) from each profile |
| social · who-voted | 60 | 0.15 opens × (**200 answer documents** + 200 profiles). The sheet's *Everyone* and eight demographic cuts cost nothing — arithmetic on the aggregate the card holds; the reads fire from the Friends, Type and Logic cuts, so the open rate is really a tap rate | uid and option from the answer; `displayName` and `testResults` from the profile. The answer's `anchors` are fetched and not rendered here |
| **city Kindred (D278)** | **not modelled** | up to **12 live queries × 200 answer documents + names per session**, for a viewer with a city who opens the City stop (`loadCityKindred` calls `fetchVoters`, not the sample — there is no city-scoped sample) | the same fields as Kindred, city-filtered |
| **reveal history** | **not modelled** | **13 `getDoc`s per group per session** (`REVEAL_HIST_DAYS` = 14, yesterday rides the listener), on the Groups stop and the Roles panel, every group | the day's reveal summary |
| server | 33 | the trigger's 3 reads per world answer (ledger event, aggregate, author profile) = 12; the velocity scan 4; the nightly pass 4; patterns state 1; the candidate scan 3 (one per MAU); engagement state 1; attention 1; rollups 2; reveals 5 | server folds — none reaches a client |
| rules | 7 | one `get()` of the question per world answer, three per duel answer | option count, active, surface |
| poll | 3 | today's aggregate once a minute while visible | today's counts |
| reseed | 3 | the bank's delta since the cursor, charged per MAU | changed questions |
| topUp | 2 | aggregates of answered questions with no published counts, ≤120, rechecked 6-hourly | counts |

Per-session reads the per-day model does not carry, with what bounds
them: the similarity sweep (the test aggregates the persisted cache does
not hold — **266** active test items today, not the ~110 the source
comment says, so up to 266 reads on a device's first City, Country or
World open and ~0 after); takes (≤100 per question opened, per session);
faces (`v2_avatars`, one per uid drawn per session on the five surfaces
that pass a face map — not persisted, D178, on purpose); learn aggregates
(one per card); the pulse (≤5 a day plus 21 on a tap); the ads pool (≤200
once per session, one read when empty). All bounded, none a DAU term.

Every term is flat in DAU, which is what D129 bought: nothing above grows
with the population. What grows is the product of two numbers the app
chose — how often the D98 surfaces are opened, and **how many documents
each open reads to draw its picture**. The second is the structure, and
it is what this page moves.

## 2 · The reshapes, priced

`npm run costs:structure`, 2026-09-08 after runbook 1.4 shipped
(regional sheet, no free allowance; "writes+" is per user-day; the
foreground row left the table when it became the baseline):

```
reshape                                                                          saved/user-day  writes+   $/mo saved  5k · 50k · 500k DAU
Circle: one compact answer document per member, not ≤300 answer docs               149.5        1 (+4 if live) $6.59 · $66 · $659
Kindred / People / pair card: the nightly voter sample carries names                72.0        0              $3.24 · $32 · $324
Who-voted sheet: drawn from the same sample (names embedded)                        59.8        0              $2.69 · $27 · $269
One deck document per day: seven aggregates in one read at boot                      8.4        1              $0.24 · $2.43 · $24
Aggregate counters folded by increment, not read-modify-write of the whole document     4.0        0              $0.18 · $1.80 · $18
Velocity scan folds from the nightly pass's one ledger read                          4.0        0              $0.18 · $1.80 · $18
Candidate-engine scan re-solves only people who answered since the last fit          2.0        0              $0.09 · $0.90 · $9.00

all reshapes together — reads and writes per month, straight off the sheet
scenario                 DAU   reads/user-day        $/mo before → after
Launch / TestFlight        50        168 → 97             $0.10 → $0.07   (−28%)
Friends-of-friends        500        267 → 97             $1.47 → $0.74   (−50%)
Real traction            5000        357 → 57               $19 → $5.57   (−70%)
Scale                   50000        357 → 57                $188 → $56   (−70%)
Hit                    500000        357 → 57             $1,879 → $557   (−70%)
```

### 2.1 · Circle reads one document per member — 150 → 0.5 reads per user-day

**What it reads today.** `loadCircle` (`src/v2/data/circle.ts`) runs one
query per followed member, `where("surface","in",WORLD_ANSWER_SURFACES)
orderBy("answeredAt","desc") limit(CIRCLE_ANSWER_CAP)`, in parallel, and
keeps `qid → optionIdx` from each document — nothing else of the ~300
bytes each answer carries. `agreement()` then folds that map against the
viewer's own into a percentage and a shared count, and the stop ranks
members by it. Up to 50 × 300 = 15,000 documents on one tap; session
cached; refetched whole on every follow and unfollow.

**The document.** One per person, holding exactly the map Circle folds:

```
v2_users/{uid}/public/answers        (or a top-level v2_answer_maps/{uid})
  a: { [qid]: optionIdx }   world surfaces only — the same six the query filters
  n: int                    how many
  at: timestamp             when the map was last folded
```

About 20 bytes an entry; ten thousand answers is ~200 KB, and the 1 MiB
document ceiling is ~50,000 answers — a decade at twelve a day, and a
per-surface split if it is ever reached. It is **not a new fact about
anybody**: it holds what `v2_users/{uid}/answers` already grants every
signed-in reader (D98), in one document instead of one per answer, so the
rule is the same `allow get: if request.auth != null` the answers carry,
write closed. Under `v2_users/{uid}` it is erased by `deleteAccount`'s
existing recursive delete with no new arm.

**Two things the map decides.** Its *home*: under `v2_users/{uid}` it is
erased with the account and rules-gated like the answers; on the
`v2_patterns/` shelf (`answers-{uid}`, beside the samples) it is already
signed-in-readable and write-closed and gets the same field-delete arm
`deleteAccount` gives the samples. Its *basis*: D395's private map covers
the 536 questions the fit admits (daily, test, core feed), while Circle's
likeness today runs over all six world surfaces — learn, pulse, call and
the feed's tail included. Folding the public map over the six keeps the
number a user sees; folding it over the 536 changes it (arguably a
correction — a learn card's answer is knowledge, not disposition — and
still a visible change). Either way the 300-answer recency cap
disappears, so old accounts compare on everything they have answered.

**Who writes it — the decision.** Two options, both priced in the table:

- **Nightly, from the pass.** `functions/src/nightly.ts` already reads
  yesterday's ledger entries once; folding each active person's entries
  into their map is one merged write per active person per night — the
  `+1` in the table — off a read already paid for. D395's compacted map
  on `patterns/state` is this exact fold for the core questions; the
  difference is coverage (all world surfaces) and readership (public).
  What a user notices: a member's answers from *today* reach your Circle
  *tomorrow*; the percentage moves once a day instead of on each open.
- **Live, from the trigger.** One `set({ [`a.${qid}`]: idx }, {merge})`
  after the aggregate transaction commits, +4 writes per user-day (one
  per world answer), on a document only that person's answers touch —
  four writes a day, no contention. What a user notices: nothing.

Either way the saving is 149.5 reads per user-day, **$66 a month at
50,000 DAU** against the nightly write's $1.35 or the live write's $5.40.

**What it touches.** `circle.ts` (`fetchAnswersOf` reads one document;
`setFollowing` no longer refetches the fan-out), `firestore.rules` and
`test:rules`, `docs/data-inventory.md` (`check:data-inventory`), the
erasure e2e (`gone means gone` for the map), `circle.reads.test.ts`, the
model (`CIRCLE_ANSWER_CAP`'s pin in `scripts/pulse.test.mjs` moves with
the term), and a `COSTS.md` line regenerated by `npm run costs`.

### 2.2 · The nightly sample carries names — 72 → 1 reads per user-day

**What it reads today.** After D397, Kindred, the People lens and the
pair card read one `v2_patterns/sample-{qid}` document per question —
`rows: { [uid]: { o, a, d } }`, the newest 200 voters with option and
frozen chips — and then `resolveNames` reads **one profile document per
uid** for a display name and scores (`voters.ts:314`), cached seven days
in `insight.profileCache.v1`. The model's ×2 is a no-overlap ceiling; the
cache makes the steady state cheaper, but every new crowd is a profile
read per stranger.

**The change.** The row gains what the readers fetch a profile for:
`{ o, a, d, n: displayName, s: parsed scores, l: logic percentile }` —
three small scalars. **It costs the server no new read**: the
world-answer trigger already reads the author's profile in its
transaction (D410, `v2.ts` `tx.getAll(eventRef, pubRef, profRef)`), so
`displayName` and `testResults` are on the wire at every answer and can
be stamped onto the ledger entry the way `anchors` already are
(`ledger.ts`, "so the sample builder can take them without a second read
per entry"); `mergeSample` then embeds them. A rename reaches every row
the pass touches within a day; a row it does not touch keeps its name
until it is refolded, which is the seven-day client cache's own property
today. Faces stay live and per session, exactly as D178 argues (a token
cached past a remove verdict is a removed face still rendering); only the
name and the scores move.

### 2.3 · The who-voted sheet draws from the sample — 60 → 0.15 reads per user-day

**What it reads today.** `fetchVoters` runs the live collection-group
query (200 newest answers, then names) because the sheet is "a live list
of names on screen" (`patternsSamples.ts` header). With names on the
sample (2.2), the sheet's Friends, Type and Logic cuts can draw from one
document and say what they are: *the latest 200, as of last night*. If
today's voters must appear today, a hybrid keeps most of the saving — the
sample, plus a live query for answers newer than the sample's day with a
small limit, so a busy question costs 1 + a few dozen reads rather than
400. The city-scoped cut (`where anchors.city ==`) reads the same sample
and filters on the device; the chips are already on each row. Two
things the sample cannot give and the client can: the viewer's own vote
the moment it lands (unioned in locally from `state.votes`), and — for a
question older than D397 — a crowd that is only the voters since the
deploy, which the `≥ 12` floors already report as thin.

### 2.4 · The foreground refresh reads today only — 28 → 4 reads per user-day · **BUILT 2026-09-08 (runbook 1.4)**

`wake()` → `resubscribeForToday()` → `startAggPoll()` → `refreshAggs
(state.deckIds)` re-reads all seven deck aggregates on every return to
the foreground (`live.ts`), four times a day in the model. The six back
days are answerable and do move, but they move slowly and the boot
already refreshes them; the poll covers today. Refreshing only today on
foreground, and the whole deck on boot, saves 24 reads per user-day for
no write and no new document. What a user notices: a three-day-old
card's count updates at the next cold start rather than on every app
switch. `COST-REDUCTION.md` priced this lever as "stream today only";
after D129 it is one line in `startAggPoll`, and `idle-detach.test.ts`
pins the poll's shape.

### 2.5 · One deck document per day — 7 → 1 reads per boot

`v2_decks/{day}` holding the seven aggregates the deck draws would make
a boot one read where it is seven. Its writer is the question: the
trigger writing it beside today's aggregate is one more write per daily
answer on a second hot document under the same contention wall; the
compactor §3 describes writes it once a minute for nothing extra. Worth
8.4 reads per user-day, and only after 2.4 — before it, the foreground
term dwarfs it. Low priority; listed so it is not rediscovered.

### 2.6 · The velocity scan reads the pass's entries — 4 reads per user-day

`ledgerVelocityScan` and the nightly pass each read the day's ledger
entries (`velocity.ts`, `nightly.ts`): D399 folded three readers into one
and kept velocity apart because its window is a cursor (`lastScanAt →
now`, ≤72 h) rather than a calendar day. The pass can hand velocity the
day's entries plus its own overlap window, or velocity can run inside the
pass with the cursor honoured — server-side only, nothing a user sees,
one read per world answer per night saved.

### 2.7 · The candidate scan stops re-reading everyone — 3 → 1 reads per user-day

The candidate engine (D395) re-reads **every** `patterns/state` document
ever written, nightly (`patterns.ts` `scanUsers`, a collection-group
walk with no cap), to re-solve its item rows — and buffers every person's
map in memory to do it. A changed-since cursor alone does not replace
the read: the ALS item step solves each item's row from *everyone* who
answered it, not only from the people who answered today. What does is
the plan already written in `patterns.ts`'s own header: keep per-item
sufficient statistics (an 8×8 Gram matrix and an 8-vector per item),
stream people through them, and update only the statistics of the
people whose map changed since the last solve. That takes the nightly
read from one per person ever fitted to one per active person, and the
resident memory from one entry per person to a fixed set of item
statistics — the memory being the part that fails first (§3).

### 2.8 · Not in the per-day model, worth a document anyway

- **Reveal history** (`REVEAL_HIST_DAYS` = 14): the Groups stop and the
  Roles panel read up to 13 day documents per group per session, every
  group — ~18 reads per user-day for a one-group user, comparable to
  the whole modelled boot, and in no term. `revealGroupDay` could append
  the day's summary to one `v2_groups/{gid}/history` document in the
  batch it already writes — one read instead of thirteen. **What it
  changes**: each day's reveal is rule-gated on its own `members`
  snapshot, so a late joiner cannot read the days before they joined;
  one document cannot express that gate, so a history document would
  show a late joiner the group's earlier day summaries. Whether that is
  acceptable is a privacy-shaped question and goes to the owner (D334),
  with this arithmetic; the per-member variant (one history document per
  member) keeps the gate at one write per member per reveal.
- **Takes** (≤100 world takes per question per session) are bounded and
  rarely opened; a sample-shaped document per question would be the same
  trade as 2.3 and is not worth it until the open rate says so.
- **The similarity sweep** needs almost nothing: it reads only the test
  aggregates the persisted cache does not hold, so it is a first-open
  cost per device (up to 266 reads today) and ~0 after. A nightly
  `{ qid: { counts, total } }` norms document would make the first open
  one read for Compare and the norms — but the places field folds
  `by.city` and `by.country` per item, hundreds of kilobytes across the
  bank, so it keeps the sweep or takes two or three documents of its own.
  Worth it only if first opens are measured to matter.

### 2.9 · The city-scoped Kindred pass — twelve live fan-outs the model does not see

`loadCityKindred` (D278) runs a second Kindred pass narrowed to the
viewer's city — `fetchVoters` with `where("anchors.city", "==", city)`,
twelve questions, up to 200 answer documents each plus names — because
the newest-200 sample holds too few of one city to rank a ring (D278's
own recall arithmetic: at 100,000 users the ring was choosing from 2.6 %
of your city). It calls the live query, not the sample: **there is no
city-scoped sample.** Per session, for any viewer with a city who opens
the City stop, that is up to 2,400 answer reads plus names — the largest
client read in the app, and in no term of the model.

Two shapes serve it. A **city-scoped sample** per (question, city) for
cities above a size floor, written by the same nightly pass off the same
ledger entries (the chips carry the city), read like the world sample —
many small documents, one read each, and the recall D278 wanted. Or the
**answer-map shape of 2.1 turned around**: a per-city roster of active
answerers, then one map document per person — which is Circle's read
path with the city as the circle, and the same document serving both.
Either takes the pass from thousands of reads per session to a dozen;
the sample is the smaller build, the roster the more general one.

## 3 · The write side, the wall, and what fails before it costs

**Per world answer, three writes and one delete**: the client's answer
document; the trigger's ledger entry (`v2_agg_events/{eventId}` — qid,
uid, option, the frozen chips, `at`, `expireAt`; a copy of the answer's
own fields, 90-day TTL); and the aggregate, rewritten in the same
transaction. A duel answer is the answer plus one blind `arrayUnion`.
Then per active person per night: a patterns state write, an engagement
state write, an attention shard and a rollup from the device, the fold's
mark. About 20 writes per user-day, $27 a month at 50,000 DAU against
$171 of reads — 86 % reads, which is why §2 is about documents read.
Nothing in the list writes without a reader (§4 on the two that look
redundant). What the write side does carry, read out of the trigger and
the index file:

**The aggregate is read and rewritten whole on every answer.**
`v2.ts` reads `v2_question_aggs/{qid}` in the transaction and replaces it
with `merge: false`; the document is `counts` + `total` + a `by` map of
8 dims × ≤24 buckets × options — single-digit kilobytes for a mature
daily, ~40 KB at the bank's real worst case (12 options), plus the
`edits` matrix. Every one of the ~2,400 leaves of a mature `by` map is
auto-indexed ascending and descending — **~4,900 index entries per
aggregate document, and no reader ever queries the collection by a
field** (every reader is `documentId() in` or `getDoc`). Two changes,
one config and one structural:

- **Declare the exemptions.** `firestore.indexes.json` carries
  `fieldOverrides` for `answers` (the ten anchor leaves, D64) and nothing
  for `v2_question_aggs`, `v2_agg_overflow`, `v2_aggs_private`,
  `v2_patterns`, `v2_rank`, `v2_engagement_daily` or `v2_agg_events`.
  The ledger is queried only on `at` (range) and `uid` (equality) and
  carries ~32 index entries per entry, ~28 of them read by nothing — and
  its `expireAt` is a monotonically increasing timestamp indexed for
  nothing, which is the shape Firestore's own TTL guidance says to exempt.
  Index entries are storage (`cost-arith.mjs` prices index storage at
  ×1.4 of documents) and write latency, not billed operations; the
  exemptions cost a deploy of the index file. Verify in the console how
  an exemption on a map field reaches its subfields — the `by` map's
  keys are city names, so per-leaf exemptions cannot be listed; if a
  map-level exemption does not reach them, the alternative is to store
  `by` as one non-indexed value (a string over Firestore's indexed-value
  limit is not indexed), which changes the client's parser and nothing
  else.
- **Fold the counters by increment.** The overflow shards already use
  blind `FieldValue.increment` under merge (`v2.ts`, the D400 tail);
  the hot document could too, which removes the trigger's read of it —
  one of its three billed reads per world answer, 4 per user-day
  (`aggIncrement` in the table) — and shortens the transaction's lock
  window, which is what the ~1-write-a-second ceiling measures. What
  stands in the way is the bucket cap: `evictForNewBucket` needs the
  current bucket set, so the cap moves to a compactor — the same
  compactor §3's sharding needs — and `replay.ts` already records that
  the cap makes the fold non-commutative today, so a compactor
  arguably improves replayability.

**The trigger's profile read is unmasked.** The world path reads the
author's `v2_users/{uid}` whole to use one field (`anchors`, D410's
honesty check); the reveal pipeline reads the same collection with
`{ fieldMask: ["displayName"] }` and explains why — a profile can
legitimately approach Firestore's 1 MiB. One argument on the `getAll`,
on the most-invoked function in the system. Same shape for `rankBankV2`,
which reads 533 whole aggregates a night to use `total` and `counts`.

**The catalog path** reads and rewrites a ~95 KB private accumulator
(`ent` up to 1,025 keys, `entBy` 8 × 24 × 32) on every catalog answer
and recomputes the published top-N from it — the largest per-answer
round trip in the system, on 24 of 1,073 questions. Increments and a
nightly top-N compaction are the same change as above; and the catalog
branch skips D410's profile check, so its chips are the client's claim.

**The wall.** All of a day's daily answers land on one
`v2_question_aggs/{qid}` inside the waking window; Firestore sustains
about one write a second per document, so at ~14,400 DAU the transaction
starts retrying (`COSTS.md` wall 1; `monitoring/onV2AnswerCreated-
contention.json` pages at five retries a minute). Only the daily lane
has this by construction — the feed spreads across the bank — and
`ANSWER-SCALE.md` §4 holds the remedy re-derived against the tree:
**`v2_agg_shards/{qid}.{s}`**, the trigger folding into `hash(uid) % N`
shards for a qid named hot, and a **compactor** summing them into the
published document once a minute for today's qid, so every client keeps
reading the one document it reads today. Cost: N reads and one write a
minute per hot qid (1,440 writes and 1,440·N reads a day), the trigger's
write uncontended, and one client rule — the post-vote refresh clears its
"+1" only once `total` has grown past the pre-vote total. **One
correction the design needs before it is built:** "every field folds by
addition" is true of `counts`, `total`, `pos` and `edits` and not of `by`
under the bucket cap — which bucket `evictForNewBucket` drops depends on
arrival order, as `replay.ts` states — so the compactor must re-cap the
union of the shards' bucket maps, sending the surplus to the D400
overflow tail that already exists for this. Small, and it has to be in
the design. A second wall sits beside it that no record names: the
ledger's `at` and the answers' `answeredAt` are monotonically increasing
timestamps indexed on every write, and Firestore's sequential-index
guidance is ~500 writes a second on a contiguous range — a collection
limit, not a document one, reached by the answer write itself at the
Hit row's morning peak. Exempting `expireAt` helps; `at` is queried and
stays.

**The trigger's ceiling.** `maxInstances: 10` is global and `HOT_TRIGGER`
overrides everything but it: **200 folds in flight is the system-wide
ceiling on answer throughput.** At 500,000 DAU the mean rate in the
morning window is ~175 answers a second; past the ceiling Eventarc
backlog becomes latency, then retries, then contention on the same qid.
Raise it together with the sharding, not before.

**What fails before it costs.** Four structures that are fine today and
stop working — silently — at sizes the tables above reach:

- **The rollup fold reads one page and stops.** `engagement.ts`'s
  `runRollupFold` has no outer loop and `ROLLUP_FOLD_CAP = 10,000`;
  rollups are unsampled by design (the person channel). Above ~10,000
  active devices a day the same low-sorting days fold first, the rest
  die unfolded at the 90-day TTL, and the "leftovers fold tomorrow"
  warning is false. A paging loop like the attention fold's, or sampling
  the channel, with a real budget.
- **`scanUsers` buffers everyone.** §2.7: ~1 KB a person resident on a
  256 MiB instance, an out-of-memory near 150,000 people, and a pass
  that dies identically every night thereafter because nothing advances
  its cursor. The fix is the header's own plan.
- **`mergeSample` materialises the day.** The voter-sample merge builds
  a `rows` object of 200 + the day's answers to that question and sorts
  it to keep 200 — at 500,000 DAU the daily question is a 500,000-entry
  object and sort, inside the same 256 MiB / 480 s budget as everything
  else. A bounded top-K over the order the file already defines is
  O(200).
- **The attention shard fold** is capped at 20,000 a night and every
  device writes a shard every day (`SHARD_SAMPLE_RATE = 1`); past
  ~20,000 DAU it never drains. The file names sampling as the lever.

## 4 · What looks wasteful and is not

- **The ledger entry** duplicates the answer for 90 days, and in
  operations it is a wash: a `folded` mark on the answer document costs
  the same read and write per answer (the trigger must still read
  something to dedup a redelivery and write something to record it),
  saves the delete only, and moves the four nightly readers onto a
  collection-group `answeredAt` scan — same read count, `fromIdx` becomes
  "`editedAt` is present", and the attribution job it was written for is
  served better by `replay.ts` already. What it does cost is storage —
  ~400 bytes and, unexempted, ~32 index entries per answer for 90 days —
  which the exemptions in §3 remove without touching the ledger. So:
  exempt now, and leave the removal for the day storage is a line.
- **The trigger's profile read** (D410) is what stops an answer carrying
  a cohort that is not its author's; the rules cannot check it. One read
  per answer, kept.
- **The rules' `get()`** of the question per answer validates the option
  index against the bank; moving that to the trigger would let an
  invalid answer be written and rejected later. Kept.
- **Publishing on every answer** is the product (D98: exact counts from
  the first answer). Batching the publish returns as a performance
  measure under the shards' compactor, not as a cost lever.
- **The poll** is 3 reads a day; the listener it replaced was quadratic.
- **The bank on Hosting** (`COST-REDUCTION.md`) is worth ~3 reads per
  user-day and a faster cold boot; fine, and small.
- **Caps** — `VOTER_FETCH_CAP`, `KINDRED_QUESTIONS`, `CIRCLE_ANSWER_CAP`
  — stay where they are. This page's saving comes from what a document
  holds, not from how many people it shows.

## 5 · Build order, and the one decision

1. **Names on the sample (2.2)** — a field on a document the pass already
   writes, one profile read per active person per night, `resolveNames`
   skipping uids the sample named. Smallest change, 71 reads per
   user-day, and it is the precondition for 2.3.
2. **The sheet from the sample (2.3)**, with the hybrid tail if today's
   voters must show today. 60 reads per user-day.
3. **Circle's document (2.1)** — the owner's decision decides the writer:
   *nightly* (one write per active person per night; a member's day
   reaches your Circle the next morning) or *live* (one write per
   answer; nothing changes for a user). Either is a tenfold net saving;
   the ask is on `OWNER-LIST.md`. 150 reads per user-day, the largest
   single line in the bill.
4. **Today-only foreground refresh (2.4)** — one line, 24 reads per
   user-day, a cadence choice a user would have to watch closely to
   notice.
5. **The config-sized items (§3)** — the index exemptions on the
   aggregate and ledger collections, `fieldMask` on the trigger's profile
   read and on `rankBankV2`'s aggregate reads. An afternoon, no product
   change, and the index file is on the deploy path already.
6. **The four failures (§3)** — the rollup fold's paging, the candidate
   scan's streaming, the sample merge's top-K, the shard fold's sampling.
   Each is a night that would fail silently at a size the tables reach;
   none costs a read today.
7. **The two server folds (2.6, 2.7)** — 6 reads per user-day, invisible.
8. **The sharded daily with the increment fold (§3)** — the scale item,
   with the `by` correction in the design; build ahead of the first push
   spike rather than on the alert, since D403 lifted the shelf, and raise
   the trigger's `maxInstances` with it.
9. **The deck document (2.5)** and the **reveal history document
   (2.8)** — when the compactor exists to write the first for free, and
   when circles are common enough for the second to matter.

Each step carries what `COST-HUNT.md` §2 asks of a build: the
measurement at five sizes (`npm run costs:structure`, then `npm run
costs` once the model's term moves), the pin moved with its constant, the
rules test, the inventory row, the erasure assertion, the why-comment,
and the stated effect on what a user sees.

## 6 · What the model gets wrong, and how this stays honest

Three terms the model does not carry, found by reading the client
against `readsPerUser`, and one it carries at the wrong size — none
changes a conclusion above, all say the social reads are *understated*:

- **`boot` is four documents short per boot** — `v2_rank/daily`,
  `v2_rank/learn`, `v2_rank/feed` and `taste/profile` are unconditional
  reads in every `hydrate()`; at 1.4 boots that is +5.6 reads per
  user-day. A merge of `v2_meta/app` and `v2_rank/daily` into one boot
  manifest (D265's own precedent) would take 1.4 of them back.
- **The city Kindred pass has no term** (2.9).
- **The client's reveal history has no term** (2.8); the model's reveal
  term is the server pipeline's.
- **Egress prices the deck refresh at the wrong size**: the 28 re-attach
  reads are aggregate documents (`BYTES.aggDoc`, 2.4 KB) charged at
  `BYTES.otherDoc` (250 B) — a tenfold understatement of a small line —
  and `BYTES.aggDoc`'s comment says six dims where `BREAKDOWN_DIMS` has
  been eight since D328.
- The similarity sweep's source comment says ~110 core test items; the
  shipped bank has 266, and nothing pins the number.

Adding the missing terms moves the shipped total from ~381 to roughly
410–450 reads per user-day before any reshape, and every one of the
added reads is on the surfaces 2.1–2.3 and 2.9 replace.


`scripts/cost-structure.mjs` reads the same constants the cost model
reads from source — `VOTER_FETCH_CAP`, `KINDRED_QUESTIONS`,
`CIRCLE_ANSWER_CAP`, `DECK_DAYS`, the `B.*` open rates — so a cap or a
cadence that moves reprices every row here on the next run. When a
reshape is built, its term leaves this script and enters
`cost-arith.mjs` (the Circle term becomes `circleOpens × circleFollows ×
1`, the sample's name a `names − 1` of zero), `COSTS.md`'s tables are
regenerated, and `scripts/pulse.test.mjs`'s pins move with the code they
pin — never deleted. The three open rates the whole `social` column
stands on (`sheetOpens`, `kindredViews`, `circleOpens`) are still guesses,
and a week of real usage would move this page more than any constant
in it; the saving's *shape* — hundreds of documents to one — does not
depend on them.

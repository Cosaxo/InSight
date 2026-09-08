# The data structure, priced per user once there are users

**Status: measured 2026-09-08 — §§1–4 read the tree; §5 proposes, and
nothing here is built.** Written on the owner's redirection of the same
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
- **Priced: 381 → 62 reads per user per day (−84 %), for one or two
  extra writes per user per day.** Reads and writes together, straight
  off the `europe-west1` sheet with no free allowance: **$20 → $5.79 a
  month at 5,000 DAU, $199 → $58 at 50,000, $1,987 → $579 at 500,000.**
  Half of the saving is one document (Circle's); the next third is a name
  on a document the nightly fold already writes.
- **The write side is already near its floor** — three writes per world
  answer (the answer, the ledger entry, the aggregate), each with a
  reader — and its one structural risk at scale is the daily's
  write-contention wall at ~14,400 DAU, for which
  [`ANSWER-SCALE.md`](ANSWER-SCALE.md) §4 holds a buildable design that
  changes nothing a client reads (§3).
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
| boot | 23 | per boot (1.4 a day): `v2_meta/app`, own profile, own-answers delta query, **7 deck aggregates**, the groups query, 2 group docs, 2 reveals; plus 2 paged cards a day (D401). The `v2_rank` shape documents (D383) are read too and not yet in the model's term | everything but the 7 aggregates is one document each; the deck needs `counts`/`total` of seven `v2_question_aggs` |
| reattach | 28 | **7 deck aggregates on every foreground** (`resubscribeForToday` → `startAggPoll` → `refreshAggs(deckIds)`), 4 cycles a day | today's counts; the six back days barely move |
| social · Circle | 150 | 0.1 opens × 5 members × **≤300 answer documents each** (`circle.ts` `fetchAnswersOf`: `where surface in …, orderBy answeredAt desc, limit 300`) | `qid → optionIdx` per member, folded by `agreement()` into a percentage and a shared count |
| social · Kindred / People / pair | 72 | 0.03 views × 12 questions × (1 sample document + **200 profile documents** for names) | uid, option, chips from the sample; `displayName` (and scores) from each profile |
| social · who-voted | 60 | 0.15 opens × (**200 answer documents** + 200 profiles) | uid, option, `anchors` chips, `displayName` |
| server | 33 | the trigger's 3 reads per world answer (ledger event, aggregate, author profile) = 12; the velocity scan 4; the nightly pass 4; patterns state 1; the candidate scan 3 (one per MAU); engagement state 1; attention 1; rollups 2; reveals 5 | server folds — none reaches a client |
| rules | 7 | one `get()` of the question per world answer, three per duel answer | option count, active, surface |
| poll | 3 | today's aggregate once a minute while visible | today's counts |
| reseed | 3 | the bank's delta since the cursor, charged per MAU | changed questions |
| topUp | 2 | aggregates of answered questions with no published counts, ≤120, rechecked 6-hourly | counts |

Per-session reads the per-day model does not carry, with what bounds
them: the similarity sweep (≤110 test aggregates, **once per device** —
the filter is `!state.aggs[q.id]` and the aggregate cache persists, so a
second session reads none); takes (≤100 per question opened, per session);
faces (`v2_avatars`, per uid drawn, per session — not persisted, D178, on
purpose); reveal history (13 per group per session); learn aggregates
(one per card); the pulse (≤5 a day plus 21 on a tap); the ads pool
(≤200 once per session). All bounded, none a DAU term; the reveal history
is the only one worth a document (§2.8).

Every term is flat in DAU, which is what D129 bought: nothing above grows
with the population. What grows is the product of two numbers the app
chose — how often the D98 surfaces are opened, and **how many documents
each open reads to draw its picture**. The second is the structure, and
it is what this page moves.

## 2 · The reshapes, priced

`npm run costs:structure`, 2026-09-08 (regional sheet, no free
allowance; "writes+" is per user-day):

```
reshape                                                                          saved/user-day  writes+   $/mo saved  5k · 50k · 500k DAU
Circle: one compact answer document per member, not ≤300 answer docs               149.5        1 (+4 if live) $6.59 · $66 · $659
Kindred / People / pair card: the nightly voter sample carries names                71.0        0              $3.19 · $32 · $320
Who-voted sheet: drawn from the same sample (names embedded)                        59.8        0              $2.69 · $27 · $269
Foreground refresh re-reads today only; the six back days refresh on boot           24.0        0              $1.08 · $11 · $108
One deck document per day: seven aggregates in one read at boot                      8.4        1              $0.24 · $2.43 · $24
Velocity scan folds from the nightly pass's one ledger read                          4.0        0              $0.18 · $1.80 · $18
Candidate-engine scan re-solves only people who answered since the last fit          2.0        0              $0.09 · $0.90 · $9.00

all reshapes together — reads and writes per month, straight off the sheet
Launch / TestFlight        50       192 → 102             $0.11 → $0.08   (−33%)
Friends-of-friends        500       291 → 102             $1.58 → $0.76   (−52%)
Real traction            5000        381 → 62               $20 → $5.79   (−71%)
Scale                   50000        381 → 62                $199 → $58   (−71%)
Hit                    500000        381 → 62             $1,987 → $579   (−71%)
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

**The change.** The row gains the name the sheet prints: `{ o, a, d,
n: displayName }`. The nightly pass writes the sample from the day's
ledger entries (`patterns.ts:880-901`); learning a name costs it one
profile read per active person per night — the same read the model
charges the client 200× per view today. A rename reaches every row the
pass touches within a day; a row it does not touch keeps its name until
it is refolded, which is the seven-day client cache's own property
today. Faces stay live and per session, exactly as D178 argues (a
token cached past a remove verdict is a removed face still rendering);
only the name moves. Scores (`testResults`) could ride the row for the
kindred-by-scores fold at a few hundred bytes more per row, or stay a
per-uid read from the profile cache; either is small beside the name.

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
and filters on the device; the chips are already on each row.

### 2.4 · The foreground refresh reads today only — 28 → 4 reads per user-day

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

### 2.7 · The candidate scan re-solves the changed — 3 → 1 reads per user-day

The candidate engine (D395) re-reads **every** fitted person's
`patterns/state` nightly — one read per MAU — to re-solve. The people
whose map changed are the day's active answerers, whom the pass has just
touched; re-solving only them (a `changedAt` the pass already stamps,
queried, or the day's uid set held in memory) drops the term from
`mauMultiple` to about one. Server-side only.

### 2.8 · Not in the per-day model, worth a document anyway

- **Reveal history** (`REVEAL_HIST_DAYS` = 14): the Groups stop and the
  Roles panel read up to 13 day documents per group per session, every
  group. `revealGroupDay` could append the day's summary to one
  `v2_groups/{gid}/history` document in the same batch it already writes
  — one read per group instead of thirteen, no extra invocation.
- **Takes** (≤100 world takes per question per session) are bounded and
  rarely opened; a sample-shaped document per question would be the same
  trade as 2.3 and is not worth it until the open rate says so.
- **The similarity sweep** needs nothing: it reads only the test
  aggregates the persisted aggregate cache does not hold, so in practice
  it is ≤110 reads once per *device*, not per session.

## 3 · The write side, and the wall

A world answer is three writes and one delete: the client's answer
document, the trigger's ledger entry (`v2_agg_events`, keyed by the
CloudEvent id, 90-day TTL), and the aggregate rewritten in the same
transaction; a duel answer is the answer plus one blind `arrayUnion`.
Then per active person per night: a patterns state write, an engagement
state write, an attention shard and a rollup from the device, the fold's
mark. About 20 writes per user-day in all, $27 a month at 50,000 DAU
against $171 of reads — the bill is 86 % reads, which is why this page
is about documents read and not documents written.

**Nothing in that list writes without a reader.** The ledger is read by
the trigger (dedup), the velocity scan, the nightly pass and the samples;
the aggregate by every device; the states by the folds that own them.
§4 says why the two that look redundant are not.

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
"+1" only once `total` has grown past the pre-vote total. D403 lifted the
"build on the alert" shelf for this subject; it is the one item here that
is about scale rather than money, and it is cheap to build ahead.

**Index entries** ride every answer write: the collection-scope composite
`(surface, answeredAt desc)` for Circle and the sheet's ordered
collection-group query, plus the single-field entries D64 left enabled.
The 2.1 and 2.3 reshapes make the Circle composite unnecessary and the
sheet's rarer; dropping an index is a storage saving only, and the model
carries index storage at ×1.4 of documents.

## 4 · What looks wasteful and is not

- **The ledger entry** duplicates the answer for 90 days. Replacing it
  with a `folded` mark on the answer document costs the same read and
  write per answer (the trigger must still read something to dedup a
  redelivery and write something to record it), loses the delete only
  ($0.01 per 100,000), and moves the nightly readers onto a
  collection-group index. Not worth it.
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
5. **The two server folds (2.6, 2.7)** — 6 reads per user-day, invisible.
6. **The sharded daily (§3)** — the scale item; build ahead of the first
   push spike rather than on the alert, since D403 lifted the shelf.
7. **The deck document (2.5)** and the **reveal history document
   (2.8)** — when the compactor exists to write the first for free, and
   when circles are common enough for the second to matter.

Each step carries what `COST-HUNT.md` §2 asks of a build: the
measurement at five sizes (`npm run costs:structure`, then `npm run
costs` once the model's term moves), the pin moved with its constant, the
rules test, the inventory row, the erasure assertion, the why-comment,
and the stated effect on what a user sees.

## 6 · How this stays honest

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

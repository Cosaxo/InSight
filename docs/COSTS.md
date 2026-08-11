# What InSight costs to run

The arithmetic behind the bill, at five sizes. Written 2026-08-01 against
`08ac631`, before launch, so every number here is a *prediction* — the
point is that it is a prediction with its inputs written down, so the
first real invoice can be diffed against it rather than merely survived.

Same discipline as D7: fix what breaks at any size, write down what breaks
at scale with its arithmetic, and do not build for it yet.

Reproduce with `node scripts/cost-model.mjs` (add `--regional` for the
single-region price sheet). It prints every table below except the fixed
costs, including the read decomposition, the egress band and the crossover
the walls section quotes — the arithmetic lives in
`scripts/cost-arith.mjs`, which `scripts/pulse.test.mjs` holds to the tree.

## The unit economics, read out of the code

Every constant below is sourced, not assumed:

| Operation | Cost | Where it comes from |
| --- | --- | --- |
| One world answer | 1 client write + 2 server writes (`v2_agg_events`, `v2_aggs_private`) | `onV2AnswerCreated`, functions/src/v2.ts |
| …plus the public mirror | +1 write **per answer** — the paused cadence republishes every answer | `AGG_MIN_N`/`PUBLISH_EVERY` = 1 under D81 (5 by design) |
| …plus the ledger's death | 1 delete, 90 days later | `LEDGER_RETENTION_DAYS` |
| One duel answer | 1 client write + 1 `pendingDays` arrayUnion | v2.ts group branch |
| One trigger invocation | 512 MiB, 1 vCPU, concurrency 20, ~200 ms | `HOT_TRIGGER`, functions/src/ops.ts |
| One warm boot | ~15 reads (meta, profile, answers query, 7 deck listeners, groups, 2 group docs, 2 reveals) | `hydrate()`, src/v2/data/live.ts |
| One cold boot | **+513 reads** — the whole question bank | `V2_QUESTIONS`, 513 docs / 116.1 KiB of JSON |
| Agg top-up | ≤120 reads, ≤1 per qid per 6 h | `AGG_ID_CAP`, `AGG_RECHECK_MS` |
| One world answer, again | +1 **rule** read (the question doc) + 2 **server** reads (ledger event, private agg) | `isWorldAnswer` in firestore.rules; the `runAggTransaction` in v2.ts |
| One duel answer, again | +3 rule reads (group, reveal, question); the trigger's duel branch reads nothing | `isDuelAnswer`; "one blind write, no read" |
| One ledger entry | +1 read the night it is scanned | `ledgerVelocityScan`, functions/src/velocity.ts (D54) |
| One group-day reveal | `4 + 3m` reads for `m` members — 10 for a duo | `revealGroupDay`, functions/src/v2social.ts |

Note the shape of the third row. Under D81's pause there is no "under
the floor": every answer republishes the mirror, so the whole bank runs
at 3 server writes per answer, flat. At the design pair the old shape
returns — **a question under the k-floor costs *more* per answer than
one above it** (3 server writes vs 2.2), because `{tooSmall: true}` is
rewritten on every answer until the fifth, making cold start the
write-expensive period. A small effect either way, and the opposite of
the direction one would guess.

## The bill, at five sizes

Behaviour assumptions (the soft numbers — stated, not buried): 3 world
answers + 1 duel answer per active user per day, 1.4 app opens, 3 minutes
of open app concentrated in D7's 4-hour morning window, MAU = 3 × DAU, one
reseed per week, and duels played in duos rather than larger groups — which
is the *worse* case per user, because a reveal's fixed reads divide across
the members it serves. Prices are Blaze, `nam5` multi-region; a
single-region database is roughly half.

| Scenario | DAU | reads/day | writes/day | Firestore $/mo | Functions $/mo | **Total $/mo** |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Launch / TestFlight | 50 | 4.3 K | 710 | 0.00 | 0.00 | **0.00** |
| Friends-of-friends | 500 | 43.5 K | 7.1 K | 0.00 | 0.00 | **0.00** |
| Real traction | 5,000 | 290 K | 59 K | 7.26 | 0.00 | **7.26** |
| Scale | 50,000 | 8.5 M | 590 K | 245 | 1.60 | **247** |
| Hit | 500,000 | 648 M | 5.9 M | 17,133 | 33 | **17,166** |

The Firestore column includes network egress, which Google bills separately
but Firestore is what serves. It is the softest line here — see the band
below.


> **Corrected 2026-08-04 (D47).** This table used to charge every returning
> user a full 369-document bank refetch per reseed, which is the *pre-D34*
> world — and finding 1 below has said so in prose since D34 landed while
> these numbers went on describing the version it fixed. The model had no
> way to express the shipped state: its only reseed inputs were "whole bank"
> and "nothing", and D34 is neither. `B.changedPerReseed` (default 7, D30's
> promotion cadence) is that input, and the table above is its output.
> The old figures are not deleted — they are finding 1's arithmetic, which
> is still what justified the change.

> **Corrected again 2026-08-07 (D67).** Every row above went up by roughly
> half, and not because anything got more expensive. The model counted
> reads the CLIENT issues and nothing else — so security-rule `get()`s,
> reads issued by Cloud Functions, index storage and egress were all
> billed at zero. They are in it now. The correction is not a re-estimate:
> the two read terms are counts of call sites in the shipped rules file and
> the shipped trigger, and `scripts/pulse.test.mjs` carries tripwires that
> fail when either moves.
>
> This is the same failure as the D47 note above, one level out. That one
> was prose the arithmetic did not implement; this was a whole category of
> cost the arithmetic had no term for, which reads as "free" and is the
> most expensive way to be wrong.

Two things fall out immediately. **Compute is free and stays free** —
the trigger is 4 invocations per user per day at 200 ms, and Cloud Run's
free tier (180 k vCPU-s/month) covers ~900 k answers/month on its own;
even at 500 k DAU the functions bill is $33. And **reads still dominate
the bill at every size** — writes never exceed 3% of the total.

So the entire cost story of this app is *reads*, and reads have **six**
sources. It said three until D67, and the three it named were the three a
client issues; the project is billed for the other three all the same.

## Where the reads actually go

Per active user per day:

| DAU | boot | agg top-up | reseed delta | **listener fan-out** | rule reads | server reads | total/user |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 50 | 21 | 42 | 3 | 0 | 6 | 14 | 86 |
| 500 | 21 | 42 | 3 | 1 | 6 | 14 | 87 |
| 5,000 | 21 | 2 | 3 | 13 | 6 | 14 | 58 |
| 50,000 | 21 | 2 | 3 | **125** | 6 | 14 | 171 |
| 500,000 | 21 | 2 | 3 | **1,250** | 6 | 14 | 1,296 |

The fan-out is still the only source that grows without bound. Everything
else is flat in DAU, and the two rightmost columns are the ones that were
missing — **20 reads per user per day that no client issues**.

**Rule reads** (6). Every `get()` and `exists()` inside a security rule is a
billed read charged to the project, on top of the operation that triggered
it. A world answer's create rule touches one document (`v2_questions/{aid}`,
three times — repeats of the same document are free); a duel answer's
touches three distinct ones. Reads pay nothing: `v2_questions` and
`v2_question_aggs` are `allow read: if request.auth != null`, with no
document access at all, so this term scales with *answers*, not opens.

> Same-document repeats being free is measured, not assumed. Rules cap
> document accesses at 10 per single-document request; a probe rule doing
> fifteen `get()`s of one document passes, while eleven `get()`s of eleven
> documents is refused. The limit counts distinct documents, so the
> evaluator's cache is real — and it is the same cache billing sees. Counted
> un-deduped the figure would be 14 rather than 6.

**Server reads** (14). Three sources, none of them visible from the client:
the aggregate transaction reads two documents per world answer (the ledger
event for dedup, the private aggregate); the nightly velocity scan (D54)
reads **every ledger entry written that day**, which is one per world
answer; and the reveal pipeline reads `(4 + 3m)/m` per member per group-day,
which is 5 for a duo. The velocity scan alone is the size of the top-up and
the reseed delta put together, and it was invisible.

**What this does to the document's own claim about its shape.** The
sentence here used to read "below 50 k DAU the whole per-user read cost is
now the boot and the top-up — both flat, both cheap, neither worth
optimising." At 5,000 DAU the real decomposition is boot 21, **server 14**,
fan-out 13, **rules 6**, reseed 3, top-up 2. The server column is the second
largest line and larger than the fan-out. The conclusion — that none of it
is worth optimising at that size, because the bill is $7 — survives; the
description of where the reads go did not.

## The egress band, and why it is a band

Firestore bills the bytes it serves, at Google Cloud's internet egress rate,
and the model charged nothing for them until D67. It counted document
*count* and never document *size* — which is exactly backwards for the
listener fan-out, whose every delivery ships the published aggregate whole.

The size of that document is the swing variable, and it is not knowable
before launch: a question nobody has answered with a filled-in Basics card
publishes a bare `{counts, total, tooSmall}` of a few hundred bytes, while
one with a full `by` breakdown carries 6 dimensions × up to 24 buckets ×
options (`BREAKDOWN_DIMS` / `BREAKDOWN_MAX_BUCKETS`, functions/src/pure.ts).

| DAU | 0.3 KB/agg | 2.4 KB (modelled) | 7 KB/agg |
| ---: | ---: | ---: | ---: |
| 50 | $0 | $0 | $0 |
| 500 | $0 | $0 | $0 |
| 5,000 | $0 | $0 | $0.46 |
| 50,000 | $7 | $51 | $147 |
| 500,000 | $647 | $5,047 | $14,686 |

The headline table charges the middle column. Two honest caveats: the price
($0.12/GiB) is one this project has never been invoiced for, and the whole
line only becomes material at a size where the fan-out itself is the thing
to fix — polling instead of streaming removes most of these bytes along
with most of the reads. It is in the model because "not modelled" reads as
"free", and free is the one thing it certainly is not.

### Finding 1 — the weekly reseed was the biggest line until ~50k DAU · **FIXED (D34)**

> Closed 2026-08-02. The seed now skips unchanged documents, `updatedAt`
> is a real cursor, and the client pages the delta instead of refetching
> the bank — a weekly promotion costs 7 reads per device instead of 369,
> so the 148 reads/user/day below becomes ~3. The rest of this section is
> kept because it is the arithmetic that justified the change.
>
> **The tables above now say ~3 too** (D47, 2026-08-04). For two days they
> did not: this note claimed the fix and the model kept charging 148,
> because `cost-model.mjs` had no input for "documents changed per reseed"
> — only whole-bank or nothing. A prose correction that the arithmetic
> beside it does not implement is the same failure `check:figures` exists
> for, one layer down. `B.changedPerReseed` is the missing input.


`runSeedV2` ends with an **unconditional** `contentRev` bump
(functions/src/v2.ts:159 — a `serverTimestamp()` written on every run,
whether or not any question changed). The client caches the bank keyed on
that value (`insight.bankCache.v1`), so a bump invalidates every device's
cache and each returning user re-reads all 369 documents.

At the launch plan's promotion cadence — one reseed a week — that is
`369 × 4/30 × 3` ≈ **148 reads per active user per day**, which is 70–80%
of all reads below 50 k DAU. It is pure overhead: the payload is 80 KiB of
static content that changed by perhaps 7 questions.

Worse, it is charged against *MAU*, not DAU. A monthly user who opens the
app once pays the full 369 reads for a bank they will barely use.

**What was done (D34).** Not the one-line hash that first suggested
itself — that only makes *no-op* reseeds free, and a weekly promotion is
not a no-op, so it would have left the 148 essentially untouched. The
change that actually pays is incremental: the seed rewrites only changed
documents, which makes the `updatedAt` it was already stamping mean
something, and the client asks `where("updatedAt", ">", cursor)` against
its cached bank. Seven changed questions cost seven reads.

**Still available, if it is ever worth it.** Serve the bank as a static
asset: 369 documents / 80.2 KiB is one gzipped JSON file on Hosting,
CDN-cached, one conditional GET instead of any billable reads. That
removes the cold-boot 369 as well as the delta — but the cold boot is
once per device, so it is now a rounding error. Deferred.

### Finding 2 — the deck listeners are quadratic in DAU

`subscribeAggs()` attaches an `onSnapshot` to each of the 7 deck days'
`v2_question_aggs` documents. The daily question is *globally shared*
(`computeDeckIds` takes no uid), which is exactly why the k-floor clears
at ten users — but it also means every publish on today's aggregate fans
out to every client currently listening, and each delivery is a billed
read.

Publishes scale with DAU (one per 5 answers). Concurrent listeners scale
with DAU. So the fan-out is **DAU² / 400** reads per day: 125 reads per
user at 50 k DAU, 1,250 at 500 k — 96% of all reads at the top row.

This is not urgent — see the wall ordering below — but it is the reason the
500 k row is five figures rather than three. The fix when it matters is to
stop streaming and start polling: today's card needs a fresh count at vote
time and on a slow timer, not on every fifth stranger's answer. That is a
display cadence choice, not an architectural one.

**The one input nobody has measured.** `onlineMin` (3 minutes of open app
per user per day, `scripts/cost-arith.mjs`) is what sets the concurrency,
and nothing in the code bounds it — no listener is torn down when the app
is backgrounded. The crossover below is linear in it, so a 5× error in that
guess moves the wall 5× closer. It is the most leveraged soft number in the
model and the cheapest one to find out: it is a question about behaviour,
answerable from a week of real usage.

### Finding 3 — anonymous-first auth may be a per-install bill

D3 makes the app anonymous-first: `signInAnonymously` runs on first open,
before any consent, tap, or interest. Every install that reaches first
paint becomes an authenticated identity.

Whether that costs anything depends entirely on a console setting nobody
in this repo has recorded:

- **Firebase Authentication (no-cost tier):** unlimited anonymous and
  Google sign-in. $0 forever.
- **Identity Platform billing:** 50 k MAU free, then $0.0055/MAU tapering
  to $0.0032.

| MAU | Identity Platform |
| ---: | ---: |
| 15,000 | $0 |
| 150,000 | $505/mo |
| 1,500,000 | $6,015/mo |

**Go look at which one `prvfire33` is on before launch** — it is a
console-only fact, exposed on no unauthenticated endpoint, and it is now a
line item in SHIP-CHECKLIST §5 with the exact place to look. Same code,
same users, and a difference of $6 k/month at the top row.

Two pieces of evidence point at the free tier without settling it. The
upgrade is an explicit console action and **nothing in this repo's history
has ever taken it** — Identity Platform appears in no commit, and the
deploy workflow touches only rules, indexes, functions, storage and
hosting, never auth config. And the app uses **no Identity Platform
feature**: `signInAnonymously` and `GoogleAuthProvider` are the whole
surface — no phone/SMS, no SAML/OIDC, no MFA, no tenants. Neither fact is
proof, because the edition is a property of the project rather than of the
code, which is exactly why it has to be looked at rather than reasoned
about.

The counterintuitive part, if it *is* Identity Platform: bad retention
makes this line worse, not better. MAU counts everyone who opened the app
that month, so a 10% D1 retention curve means MAU ≈ 10 × DAU rather than
3 ×, and the auth bill triples while the product fails.

## The walls, in the order they are hit

1. **~14,400 DAU — D7's write-contention ceiling.** All of a day's daily
   answers land on one `v2_aggs_private/{qid}` document inside a 4-hour
   window; Firestore sustains ~1 write/sec/document. `0.35 writes/sec` at
   5 k DAU, `1.00` at 14.4 k, `3.47` at 50 k. Past this, transactions
   retry and aggregation degrades. Already recorded, already costed, fix
   already named (shard the counter). **This binds first.**
2. **~18,200 DAU — the read fan-out overtakes every flat source
   combined.** Finding 2. Not a failure, just the point where the bill
   stops being rounding error. This row used to say ~50,000, which was
   never computed from anything; `cost-model.mjs` now solves for it, and
   the crossover moved *later* rather than earlier when D67's terms landed
   — the flat baseline it has to beat went from 26 reads/user/day to 46.
3. **~50,000 MAU — the Identity Platform cliff**, if that is the billing
   mode. Finding 3.
4. **~10,000 activations/day — Play Integrity's standard quota**, which
   D29's `activateDeviceV2` calls once per device per month. Bound by
   install rate, not DAU, so it only bites during a viral spike — which
   is precisely when it would hurt.

A fifth wall was here in draft and is deliberately not in this list: the
velocity scan used to buffer its whole window into a 256 MiB instance and
OOM somewhere around 44 k DAU, *below* the Scale row, re-reading the same
window and dying identically every night thereafter. D64 made it fold per
page, so its memory is bounded by one page rather than by the window. The
new ceiling has not been measured and no number is quoted for it here.

Wall 1 arriving before wall 2 is the good ordering: the app breaks
technically at a size where the bill is still ~$80/month, so there is no
scenario where a surprise invoice arrives before a surprise outage. That is
worth keeping true — and it stayed true through D67, which is worth saying
because it was not guaranteed to. Adding the missing read terms could have
moved the crossover below the write wall and inverted the ordering; it
raised the flat baseline instead, so the gap widened from 2,000 DAU to
3,800. The ordering is a property to re-check whenever a read term is
added, not a fact to rely on.

## Everything that is not Firestore

| Item | Cost |
| --- | --- |
| Apple Developer Program | $99/yr |
| Google Play registration | $25 once |
| Cloud Functions compute | $0 → $33/mo at 500 k DAU |
| Cloud Scheduler | $0 (2 jobs; 3 free) |
| FCM push | $0 |
| App Check — reCAPTCHA v3 / DeviceCheck / Play Integrity | $0 |
| Firebase Hosting (`web/`, static pages) | $0 |
| Cloud Storage | $0 (bucket unused; see SHIP-CHECKLIST) |
| Cloud Logging | $0 until ~500 k DAU, then ~$17/mo |
| Firestore storage | 5.6 GiB after a year at 5 k DAU → $0.83/mo (4.0 GiB of documents, ×1.4 for index entries — a multiplier that was 1.0 in the model until D67, and would be ~5 without D64's `answers` index exemptions) |
| Network egress | in the Firestore column above, not free: $0–0.5/mo at 5 k DAU, **$7–147 at 50 k**, $647–14,686 at 500 k — see the band below |
| Sentry | $0 (developer tier; crash-only, but on by default since D76 — volume now scales with installs, so this is the first third-party quota to watch as they grow) |
| GitHub Actions | $0 within the private-repo allowance; iOS is a separate workflow *because* macOS bills at 10× |
| **The question farm** | a claude.ai subscription — the content pipeline's real recurring cost |
| **Total fixed** | **≈ $30/month** |

The farm deserves its line. QUESTION-FARM.md runs on scheduled Routines on
the maintainer's subscription, and the never-repeat arithmetic in D30
depends on ≥7 promoted questions/week *indefinitely*. That is not a
one-time content cost; it is the only recurring operational expense that
does not scale down when usage does.

## The honest summary

**Below 5,000 DAU this app costs about $32/month, and $28 of that is the
Apple developer program and a Claude subscription.** The infrastructure is
effectively free — inside or near the Firestore and Cloud Run free tiers —
and D67's corrections did not change that answer. They roughly halved the
headroom, which is a different thing: $7/month at 5,000 DAU rather than $5,
and $247 at 50 k rather than $175.

That is still the correct answer to "can I afford to launch this": yes, by
a wide margin, and the cost of being wrong about demand is not measured in
infrastructure at all.

Three caveats worth carrying:

- **The bill is almost entirely reads, and a third of them are not the
  client's.** The two self-inflicted client sources are dealt with: the
  cache-bust is closed (D34) and the listener fan-out is recorded and
  deliberately not built, because D7's write ceiling binds ~1.3× earlier
  than it does. The 20 reads/user/day of rule and server traffic are new to
  the model, not new to the bill — they have been charged since launch of
  the trigger, and below 50 k DAU none of them is worth optimising either.
- **Check the auth billing mode.** It is the only line in this document
  that could be four figures a month without any code being wrong, and it
  is the one remaining pre-launch cost action.
- **Pick the region before the seed.** Single-region halves every Firestore
  line — $3.71 / $151 / $11,133 against $7.26 / $247 / $17,166 — and a
  Firestore location cannot be changed after the database holds data. It is
  the only decision in this document with a deadline, and it is filed under
  "what would change these numbers" below as though it were a knob.

## What would change these numbers

- **Engagement per user.** The model assumes 4 answers/day. Doubling that
  roughly doubles writes and compute — and it is the input D67 changed most,
  because three of the six read sources are now charged per *answer* rather
  than per open. Re-running the model with `B.worldAnswers` at 6 moves
  reads/user/day by +14% / +15% / **+42% / +80% / +97%** at 50 / 500 / 5 k /
  50 k / 500 k DAU, and roughly doubles the bill at the two top rows
  ($7.26 → $13, $247 → $457, $17,166 → $33,935). This line used to read
  "barely moves reads — the read cost is dominated by boots, not by
  answering." That was true when the model only counted boots.
- **Reseed frequency.** *Was* the single most sensitive input below 50 k
  DAU; D34 took most of the sensitivity out with it. What matters now is
  `changedPerReseed` (how many questions a promotion actually moves), not
  how often a reseed runs — the same 7 questions cost the same 7 reads
  whether they ship weekly or monthly.
- **MAU/DAU ratio.** Assumed 3. A worse retention curve raises the reseed
  delta and the auth bill together, because both are charged per *monthly*
  user — but post-D34 only the auth half of that is material.
- **Region — and this one is not a knob.** A single-region database halves
  every Firestore line: $3.71 / $151 / $11,133 against $7.26 / $247 /
  $17,166 (`node scripts/cost-model.mjs --regional`). The project is on the
  multi-region default, which is the safer and more expensive choice. It
  belongs in this list least of all the entries here, because a Firestore
  database's location is **fixed at creation** — every other line can be
  revisited after launch and this one cannot, so it is a decision with a
  deadline at the content seed rather than an input to tune.
- **Catalog go-live (D14/W1.4).** Catalog answers fold an `ent` map and an
  `entBy` breakdown into the same private document. Same write count, but
  a materially larger document, and Firestore bills writes by operation
  rather than by size — so the effect lands on storage and contention,
  not on the write line. It also adds a third server read per catalog
  answer (the trigger reads the question's `domain`), which the model does
  not charge, because catalog is not live.
- **How many people fill the Basics card.** The swing variable behind the
  egress band, and unknowable before launch. An anchors-less population
  publishes bare `{counts, total}` aggregates of a few hundred bytes; a
  fully-filled one publishes a `by` breakdown of 6 dimensions × up to 24
  buckets. The model charges the middle (2.4 KB) and
  `node scripts/cost-model.mjs` prints all three columns.

## What is still not in the model

Named, so the next correction starts from a list rather than from a
surprise:

- **Cloud Logging volume**, estimated in the fixed-cost table above but not
  derived from the actual log statements per invocation.
- **The catalog trigger's third read**, above — deliberate, it is not live.
- **Retries.** Every function invocation is priced once. `retry: true` on
  the answer trigger means an at-least-once delivery can bill twice, and
  nothing here models the rate.
- **The moderation and mod-queue jobs.** Daily, bounded by flag volume
  rather than DAU, and currently zero because no client can create a flag.
- **`egress` on the functions side** — callable responses, which are
  small and infrequent next to Firestore's document traffic.

None of these is believed material at any modelled size. That belief is
exactly what was believed about rule and server reads before D67, so the
list is here to be checked rather than trusted.

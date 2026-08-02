# What InSight costs to run

The arithmetic behind the bill, at five sizes. Written 2026-08-01 against
`08ac631`, before launch, so every number here is a *prediction* — the
point is that it is a prediction with its inputs written down, so the
first real invoice can be diffed against it rather than merely survived.

Same discipline as D7: fix what breaks at any size, write down what breaks
at scale with its arithmetic, and do not build for it yet.

Reproduce with `node scripts/cost-model.mjs` (add `--regional` for the
single-region price sheet).

## The unit economics, read out of the code

Every constant below is sourced, not assumed:

| Operation | Cost | Where it comes from |
| --- | --- | --- |
| One world answer | 1 client write + 2 server writes (`v2_agg_events`, `v2_aggs_private`) | `onV2AnswerCreated`, functions/src/v2.ts |
| …plus the public mirror | +1 write **per answer** below the floor, +1 per 5 above | `AGG_MIN_N`/`PUBLISH_EVERY` = 5 |
| …plus the ledger's death | 1 delete, 90 days later | `LEDGER_RETENTION_DAYS` |
| One duel answer | 1 client write + 1 `pendingDays` arrayUnion | v2.ts group branch |
| One trigger invocation | 512 MiB, 1 vCPU, concurrency 20, ~200 ms | `HOT_TRIGGER`, functions/src/ops.ts |
| One warm boot | ~15 reads (meta, profile, answers query, 7 deck listeners, groups, 2 group docs, 2 reveals) | `hydrate()`, src/v2/data/live.ts |
| One cold boot | **+369 reads** — the whole question bank | `V2_QUESTIONS`, 369 docs / 80.2 KiB |
| Agg top-up | ≤120 reads, ≤1 per qid per 6 h | `AGG_ID_CAP`, `AGG_RECHECK_MS` |

Note the shape of the third row: **a question under the k-floor costs
*more* per answer than one above it** (3 server writes vs 2.2), because
`{tooSmall: true}` is rewritten on every answer until the fifth. The
cold-start period is also the write-expensive period. It is a small
effect, and it is the opposite of the direction one would guess.

## The bill, at five sizes

Behaviour assumptions (the soft numbers — stated, not buried): 3 world
answers + 1 duel answer per active user per day, 1.4 app opens, 3 minutes
of open app concentrated in D7's 4-hour morning window, MAU = 3 × DAU,
and one reseed per week. Prices are Blaze, `nam5` multi-region; a
single-region database is roughly half.

| Scenario | DAU | reads/day | writes/day | Firestore $/mo | Functions $/mo | **Total $/mo** |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Launch / TestFlight | 50 | 10.5 K | 710 | 0.00 | 0.00 | **0.00** |
| Friends-of-friends | 500 | 106 K | 7.1 K | 1.01 | 0.00 | **1.01** |
| Real traction | 5,000 | 914 K | 59 K | 18.20 | 0.00 | **18.20** |
| Scale | 50,000 | 14.8 M | 590 K | 303.49 | 1.60 | **305.09** |
| Hit | 500,000 | 710 M | 5.9 M | 13,180 | 33 | **13,215** |

Two things fall out immediately. **Compute is free and stays free** —
the trigger is 4 invocations per user per day at 200 ms, and Cloud Run's
free tier (180 k vCPU-s/month) covers ~900 k answers/month on its own;
even at 500 k DAU the functions bill is $33. And **reads are ~97% of the
bill at every size.** Firestore writes never exceed 3% of the total.

So the entire cost story of this app is *reads*, and reads have exactly
three sources.

## Where the reads actually go

Per active user per day:

| DAU | boot | agg top-up | **reseed refetch** | **listener fan-out** | total/user |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 50 | 21 | 42 | **148** | 0 | 211 |
| 500 | 21 | 42 | **148** | 1 | 212 |
| 5,000 | 21 | 2 | **148** | 12 | 183 |
| 50,000 | 21 | 2 | **148** | 125 | 295 |
| 500,000 | 21 | 2 | 148 | **1,250** | 1,420 |

### Finding 1 — the weekly reseed was the biggest line until ~50k DAU · **FIXED (D34)**

> Closed 2026-08-02. The seed now skips unchanged documents, `updatedAt`
> is a real cursor, and the client pages the delta instead of refetching
> the bank — a weekly promotion costs 7 reads per device instead of 369,
> so the 148 reads/user/day below becomes ~3. The rest of this section is
> kept because it is the arithmetic that justified the change; the "with
> both read fixes" table above is now the *left* column for reads.


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
user at 50 k DAU, 1,250 at 500 k. At the top row it is 88% of the entire
bill.

This is not urgent — see the wall ordering below — but it is undocumented,
and it is the reason the 500 k row is $13 k rather than $1 k. The fix when
it matters is to stop streaming and start polling: today's card needs a
fresh count at vote time and on a slow timer, not on every fifth stranger's
answer. That is a display cadence choice, not an architectural one.

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
2. **~50,000 DAU — the read fan-out overtakes everything else.** Finding
   2. Not a failure, just the point where the bill stops being rounding
   error.
3. **~50,000 MAU — the Identity Platform cliff**, if that is the billing
   mode. Finding 3.
4. **~10,000 activations/day — Play Integrity's standard quota**, which
   D29's `activateDeviceV2` calls once per device per month. Bound by
   install rate, not DAU, so it only bites during a viral spike — which
   is precisely when it would hurt.

Wall 1 arriving before wall 2 is the good ordering: the app breaks
technically at a size where the bill is still $60/month, so there is no
scenario where a surprise invoice arrives before a surprise outage. That
is worth keeping true.

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
| Firestore storage | 4 GiB after a year at 5 k DAU → $0.54/mo |
| Sentry | $0 (opt-in, default OFF, crash-only) |
| GitHub Actions | $0 within the private-repo allowance; iOS is a separate workflow *because* macOS bills at 10× |
| **The question farm** | a claude.ai subscription — the content pipeline's real recurring cost |
| **Total fixed** | **≈ $30/month** |

The farm deserves its line. QUESTION-FARM.md runs on scheduled Routines on
the maintainer's subscription, and the never-repeat arithmetic in D30
depends on ≥7 promoted questions/week *indefinitely*. That is not a
one-time content cost; it is the only recurring operational expense that
does not scale down when usage does.

## The honest summary

**Below 5,000 DAU this app costs about $30/month, and $30 of that is the
Apple developer program and a Claude subscription.** The infrastructure is
free — genuinely free, inside the Firestore and Cloud Run free tiers, with
the one-line `contentRev` fix.

That is the correct answer to "can I afford to launch this": yes, by a
wide margin, and the cost of being wrong about demand is not measured in
infrastructure at all.

Two caveats worth carrying:

- **The bill is 97% reads.** Two thirds of them were self-inflicted; the
  cache-bust half is now closed (D34), and the listener fan-out half is
  recorded and deliberately not built, because D7's write ceiling binds
  ~3.5× earlier than it does.
- **Check the auth billing mode.** It is the only line in this document
  that could be four figures a month without any code being wrong, and
  it is the one remaining pre-launch cost action.

## What would change these numbers

- **Engagement per user.** The model assumes 4 answers/day. Doubling that
  roughly doubles writes and compute, and barely moves reads — the read
  cost is dominated by boots and cache busts, not by answering.
- **Reseed frequency.** The single most sensitive input below 50 k DAU.
  Weekly → monthly cuts total reads by ~60% at 5 k DAU, on its own.
- **MAU/DAU ratio.** Assumed 3. A worse retention curve raises the reseed
  refetch and the auth bill together, because both are charged per
  *monthly* user.
- **Region.** A single-region database halves every Firestore line. The
  project is currently on the multi-region default, which is the safer
  and more expensive choice — worth a deliberate decision rather than an
  inherited one.
- **Catalog go-live (D14/W1.4).** Catalog answers fold an `ent` map and an
  `entBy` breakdown into the same private document. Same write count, but
  a materially larger document, and Firestore bills writes by operation
  rather than by size — so the effect lands on storage and contention,
  not on the write line.

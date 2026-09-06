# Algorithm reflection — the fit, the fold, the store, and what a rebuild would look like

**Status: mixed — §1 is a measurement, and most of §6 is built.** The
owner read this page the day it was written and said *"yeah agree with
those apply those and go with your recommendation"*; the session that
followed built §6's steps in order as D382–D386, taking the routine's own
recommendation on the two rows it had put to the owner. The table at the
foot of §6 says which steps are built, which are half built by design,
and which are not started; the proposals themselves stand as written,
because they are the reasoning the records point back to. Written
2026-09-06 against
`main` @ c5cc341 on the owner's ask to reflect, with full creative
control, on how the algorithm, the database, the data structures and the
pattern calculation should improve. Read [`MIRROR.md`](MIRROR.md) for the
read path this page reasons over, [`SCHEMA-V2.md`](SCHEMA-V2.md) for the
write side, and `functions/src/patternsFit.ts` for the engine whose
behaviour §1 measures. Every figure here is a snapshot with its date and
the command that reproduces it; none is maintained by intention.

## 0 · The short version

- **The nightly Patterns fit has not learned anything under the app's own
  rules, and nothing in the tree can see that.** `npm run probe:fit` runs
  the shipped `foldUserDay` — imported, untouched — on a synthetic vote
  log shaped like the app's traffic (one answer per person per question,
  113 questions, four answers a day, a third of people active). In every
  scenario its one-step-ahead surprisal equals a marginal-only guess to
  three decimals, and every one of its 113 loading vectors is still
  within cosine 0.9 of the hash seed it was born with. The same engine
  passes `patternsFit.test.ts`, and the probe reproduces that pass — in
  the test's world, where 120 people re-answer ten questions twelve
  times each. D5 forbids that world. §1.
- **The scorecard D325 built cannot show it**, because it publishes the
  fit's bits and not the marginal's. A number with no baseline is a
  number. The cheapest change on this page is the baseline row. §2.1.
- **The architecture is right and the solver is wrong.** A batch solve
  of the same model — centred residuals, rank-8, the device's own ridge
  — recovers the generating geometry (Pearson 0.95–0.99 against the
  shipped 0.03) and takes 57–71% of the achievable predictive gain. It
  should ship as a *candidate* scored on the same log, and replace the
  `q` rows only when the scorecard says so for a fortnight. §2.2.
- **The fit reads half the core corpus.** 113 two-option questions fold;
  103 core questions with more options and all 160 instrument items do
  not. Folding them is an encoding change, not a new engine. §3.
- **The fit's substrate should be the person, not the ledger day.** A
  per-person observation vector on the private state doc the fit
  already owns makes the fit exact, replayable and streamable, removes
  the seven-day catch-up cliff and the 290-bytes-per-entry memory wall,
  and lets one nightly ledger read feed three folds instead of three
  reads feeding one each. §4.1–4.2.
- **The Kindred, People and pair reads cost 200× what they need to.**
  A nightly published sample of the latest 200 voters per core question
  turns a People-lens open from ~2,400 billed reads into 12, with the
  same "latest 200" semantics the sheet states today. §4.3.
- **The device solves are sound and untuned.** The Oracle clamps where
  it could carry a posterior; the ridge λ is a constant where it could
  be a published, measured number; `nextAsk` is a filter where it could
  be a choice. §5.
- Nothing here touches the three denies, publishes anything per person,
  or decides the D166 trial. Two things are the owner's and are on
  `OWNER-LIST.md`: instrument items joining the fit, and the Oracle's
  next-question rule. §7.

## 1 · What exists, measured

### 1.1 · The engine as shipped

`functions/src/patternsFit.ts` is an online rank-K factorisation of the
vote log: each eligible question keeps K = 8 numbers `L[q]`, each person
keeps K private numbers θ, an answer is encoded ±1 and centred by the
question's running marginal, and every observation takes one damped SGD
step on both vectors — `θ += 0.15·(e·L − 0.02·θ)`, `L += η_q(n)·(e·θ −
0.02·L)` with `η_q(n) = 0.5/(20+n)`. The loading seed is a hash of the
qid, uniform in ±0.05 per component (norm ≈ 0.08), so a replay is
bit-identical. `functions/src/patterns.ts` folds yesterday's ledger day
once a night, per person, and publishes `v2_patterns/loadings`. The
model is the right one for the product — position, similarity and the
Oracle all fall out of one small doc, O(K) per observation, nothing
pairwise — and the honesty mechanics around it (basis on every vector,
the first answer moving nothing, the marginal as the fit's own) are
exactly right. This page does not argue with any of that.

The eligible set is `PATTERNS_QIDS`: two options, daily or core feed.
Counted off `functions/src/v2content.ts` on 2026-09-06:

| | questions | of which |
| --- | ---: | --- |
| eligible (two options, core) | 113 (108 active) | binary 46 · vote 57 · duel 6 · dilemma 4 |
| core, more than two options — **not folded** | 103 | choice 33 · rating 29 · scale 20 · vote 7 · dial 6 · field 3 · path 3 · dilemma 2 |
| instrument items (`surface: test`) — **not folded** | 160 | all five-point scale |

So the fit sees 113 of 216 core daily/feed questions and none of the
psychometric items. §3 is about the other 263.

### 1.2 · The probe

`scripts/fit-probe.mjs` (`npm run probe:fit`) generates a deterministic
crowd, streams it day by day through the engines below in the fold's own
order, and scores every engine with the same one-step-ahead surprisal in
bits the fit publishes on its scorecard (D325). Two worlds:

- **app** — Gaussian traits in four dimensions, 113 questions of mixed
  strength (loading norm 0.2–1.5) with skewed intercepts, one shared
  daily question a day plus feed picks, a person never re-answers (D5).
  Four world answers per active person per day and a third of people
  active are `COSTS.md`'s own behaviour assumptions.
- **test** — `patternsFit.test.ts`'s world exactly: two factors, ±1
  traits, five questions each, a person answers with their trait's side
  85% of the time.

Engines: **truth** (the generating probabilities — the floor), **marginal**
(the running marginal alone — what a loading must beat to carry any
information), **shipped** (the imported fold), **shippedF** (the shipped
step with `η_q` floored at 0.01 — constants only), **shippedT** (seeds ×10
and the floor at 0.02 — constants only), **als** (the shipped
architecture with a batch solve, §2.2), **logit** (a logistic factor
model, included as a second shape and not competitive as written).
Columns: bits per answer over the first and second halves of the run;
`Pearson` correlates the estimated pairwise |cosine| with the generating
one over every question pair — the Map's reading; `top-edge` is the share
of questions whose strongest drawn edge is one of its three true nearest
neighbours (chance is 3/112 ≈ 0.027 in the app world); `‖L‖` is the mean
loading norm (the seeds' is 0.08).

**A · the app world at launch size** — 2,000 people, 60 days, 144,811
observations, 21 answers per question per day, 72 answers per person by
the end:

| engine | bits, 1st half | bits, 2nd half | Pearson | top-edge | ‖L‖ |
| --- | ---: | ---: | ---: | ---: | ---: |
| truth | 0.828 | 0.819 | | | |
| marginal | 0.947 | 0.925 | | | |
| **shipped** | **0.947** | **0.925** | **0.030** | **0.027** | **0.078** |
| shippedF | 0.947 | 0.924 | 0.450 | 0.044 | 0.083 |
| shippedT | 0.950 | 0.909 | 0.701 | 0.168 | 0.517 |
| als, device λ = 2 | 0.953 | 0.865 | 0.953 | 0.655 | 0.434 |
| als, device λ = 0.5 (as shipped) | 1.060 | 0.881 | 0.953 | 0.655 | 0.434 |
| logit | 1.077 | 0.959 | 0.810 | 0.363 | 2.655 |

**B · traction size** — 20,000 people, 60 days, 1.44 M observations, 212
answers per question per day:

| engine | bits, 1st half | bits, 2nd half | Pearson | top-edge | ‖L‖ |
| --- | ---: | ---: | ---: | ---: | ---: |
| truth | 0.831 | 0.819 | | | |
| marginal | 0.938 | 0.924 | | | |
| **shipped** | **0.938** | **0.924** | **0.032** | **0.035** | **0.076** |
| shippedF | 0.938 | 0.905 | 0.918 | 0.655 | 0.570 |
| shippedT | 0.928 | 0.878 | 0.913 | 0.513 | 0.668 |
| als, device λ = 2 | 0.926 | 0.860 | 0.993 | 0.938 | 0.421 |

**C · a long horizon** — 2,000 people, 180 days, 226 k observations, the
corpus exhausted (113 answers per person by the end):

| engine | bits, 1st half | bits, 2nd half | Pearson | top-edge | ‖L‖ |
| --- | ---: | ---: | ---: | ---: | ---: |
| truth | 0.823 | 0.766 | | | |
| marginal | 0.934 | 0.857 | | | |
| **shipped** | **0.934** | **0.857** | **0.041** | **0.035** | **0.078** |
| shippedF | 0.933 | 0.848 | 0.715 | 0.248 | 0.166 |
| shippedT | 0.916 | 0.821 | 0.880 | 0.442 | 0.607 |
| als, device λ = 2 | 0.891 | 0.792 | 0.972 | 0.708 | 0.389 |

**D · the unit test's world and regime** — `runFit(120, 60)`: 120 people,
two answers a day for 60 days from a bank of ten, re-answering allowed
(14,400 observations, 120 per person, twelve per question per person).
The test asserts same-factor |cos| > cross-factor + 0.2 and > 0.5:

| engine | bits, 1st half | bits, 2nd half | same-factor \|cos\| | cross-factor \|cos\| |
| --- | ---: | ---: | ---: | ---: |
| truth | 0.631 | 0.605 | | |
| marginal | 1.008 | 0.998 | | |
| **shipped** | 1.005 | 0.975 | **0.676** | **0.313** |
| shippedT | 0.797 | 0.650 | 0.938 | 0.102 |
| als | 0.732 | 0.624 | 0.999 | 0.039 |

**E · the same world under D5** — 120 people answer the ten questions once
each, over five days:

| engine | bits, 1st half | bits, 2nd half | same-factor \|cos\| | cross-factor \|cos\| |
| --- | ---: | ---: | ---: | ---: |
| truth | 0.615 | 0.545 | | |
| marginal | 1.089 | 1.019 | | |
| **shipped** | **1.089** | **1.019** | **0.406** | **0.229** |
| shippedT | 1.096 | 1.015 | 0.375 | 0.233 |
| als, device λ = 2 | 0.985 | 0.807 | 0.656 | 0.076 |

Three readings, none of them close:

1. **The shipped engine's guesses are the marginal's.** In A, B, C and E
   the bits agree to the third decimal in both halves. The loadings
   carry no information the popularity of the question does not.
2. **The loadings are still their seeds.** ‖L‖ sits at 0.076–0.078
   against a seed norm of 0.08; in A, 113 of 113 vectors have cosine
   above 0.9 with their own seed; the Map's strongest edge lands on a
   true neighbour at chance rate. What the Map draws today is the
   geometry of a hash function.
3. **The test passes in a world the app cannot produce.** D reproduces
   the assertion (0.676 vs 0.313); E is the same crowd, the same
   questions and the same engine under the one rule the test's generator
   breaks, and there the structure is gone. The test's regime gives a
   person 120 answers on ten questions; the app gives a person at most
   one answer per question, and 72 by the end of a busy second month.

### 1.3 · Why it does not ignite — the arithmetic

The fit starts at a fixed point and the fixed point is only weakly
unstable. θ is zero at birth and L is a seed of norm 0.08. A person's
first answer to a question moves θ by `0.15·e·L ≈ 0.15 × 0.8 × 0.08 ≈
0.01`, along that question's seed direction. Seeds are independent
random directions, so after k answers to k different questions θ is a
random walk of 0.01 steps: about 0.01·√k, which is 0.08 after 72. The
question step is `0.5/(20+n)`: 0.025 at birth, 0.005 after 80 answers,
0.0005 after a thousand. A question's total movement over its life is
bounded by `Σ η_q ≈ 0.5·ln((20+N)/20)` — about 2 at N = 1,300 — times
`e·|θ| ≈ 0.8 × 0.08`, so ≈ 0.13 in *incoherent* directions, because the
θ's it is being pushed by are themselves random walks. That is why the
cosine with the seed stays above 0.9 while the norm barely moves.

The test's world escapes because the same person answers the same
question twelve times with an 85%-consistent side: twelve pushes on θ
along one direction add coherently, θ grows linearly instead of as a
random walk, and once θ has size the `e·θ` term moving L is coherent
across everyone who shares the trait. Re-answering is the ignition, and
re-answering is the one thing an answer cannot do here (D5, D86's edit
being the only move and a rare one).

The two constants-only variants show where the instability lives.
Flooring `η_q` (shippedF) lets the *direction* recover as the crowd
grows — Pearson 0.92 at 20,000 people — but the norm still cannot grow
fast enough to change a prediction (bits −0.019). Starting the seeds ten
times larger (shippedT) buys both, slowly (Pearson 0.70–0.91, bits −0.016
to −0.046), at the cost of drawing a much stronger random geometry for
the first weeks. Neither is a fix; both are diagnoses. The bilinear
online step needs either dense repeats or a warm start it does not have,
and the corpus's create-only rule removes the first for good.

### 1.4 · Why nothing noticed — the scorecard has no baseline

D325 publishes the fit's prequential bits, pooled and per question, and
its publish-to-publish displacement. Both are honest and both are
uninterpretable alone: 0.93 bits per answer is a number; 0.93 against a
marginal-only 0.93 is a verdict. The scorecard reader (`MERGE-LIST.md`
names it as PR #390, and `WORKLIST.md` ranks it second) will print the
fit's bits and nobody will be able to say whether they are good. The
displacement summary would have said something — it measures movement
in loading space, and the loadings have not moved — but it has no
"expected movement" beside it either, so a small displacement reads as
stability rather than as paralysis.

This is not a production reading: nothing here has read the live
`v2_patterns/loadings`. The probe grew a mode for that — `npm run
probe:fit -- --loadings path.json`, over a plain JSON dump of the doc's
`{k, q}` — which prints, per question, the cosine with its own seed and
its norm. On the day this is run against production, the number to
expect if the diagnosis holds is a mean cosine near 1 and a norm near
0.08; a fit that had learned would show both moving with `n`.

### 1.5 · The rest of the system, as read

The facts the proposals lean on, with where they are held. None is new;
each is a pointer.

**The device solves.** `patternsMap.estimateTheta` is a K×K ridge with
λ = 0.5, run per read, never stored (`data/patterns.ts`). The Oracle's
guess is `marginal + θ·L`, clamped to [0.05, 0.95]; `nextAsk` returns the
first unanswered question with eight answers behind it. The People lens
(`peopleMap.ts`) solves a θ per stranger from the intersection of 12
voter lists × 200 rows and places them by the first two unit components.
`say()`/`tell()` count exact 2×2 tables from the same lists, floored at
12 people in both samples. All pure, all tested, all correct given their
inputs — and their inputs are the loadings above.

**The database.** One write (`v2_users/{uid}/answers/{qid}` with its
anchors snapshot, D8) and one trigger folding it into
`v2_question_aggs/{qid}` in a transaction keyed by qid: `counts`,
`total`, `by[dim][bucket][opt]`, `edits`. Eight breakdown dims capped at
`BREAKDOWN_MAX_BUCKETS = 24` values each, with FIFO eviction of buckets
under five answers; the closed vocabularies are shorter than the cap and
cannot evict, city (~11 k values) and country (249) can and do. Firestore
sustains ~1 write/sec/document (D7); the daily lane crosses it at ~14.4 k
DAU (`COSTS.md` wall 1), and the buildable remedy — hash-sharded
`v2_agg_shards` plus a compactor into the exact published shape — is
designed in `ANSWER-SCALE.md` §4 and shelved on the contention alert. The
agg-events ledger (`v2_agg_events`, 90-day TTL) is the trigger's dedup
and D28's attribution record, and it is read again every night by three
folds — velocity, patterns, engagement (taste is a fourth on the same
reader) — each paging the day with `readLedgerDay` at 5,000 a page. The
patterns fold buffers the whole day: measured ~290 bytes retained per
entry, 139 MiB at 100 k DAU on a 256 MiB instance, and an OOM there
re-reads the same day and dies identically every night because the
cursor advances last (`patterns.ts` header, corrected 2026-08-31).
Per-person nightly state already lives in three private docs —
`patterns/state`, `taste/profile`, `engagement/_state` — each written by
its fold, erased with the account, readable by nobody.

**The client.** Aggregates are polled, never listened to (D129): five
`documentId() in` shapes, ≤ 30 ids a query, `AGG_ID_CAP = 120` on the
6-hour top-up, today's question every 60 s. The bank, the aggs and the
answers live as rows in IndexedDB since D312; a cold start is one bank
fetch (851 docs) plus the answers plus ≤ 4 agg chunks. Voter lists are
one collection-group query per question, capped at the latest 200, names
resolved 30 at a time (`voters.ts`); Kindred walks 12 of them, the City
stop 12 more with the city in the query (D278), the People lens 12, the
pair card up to 4 — all through one session cache. `kindredPeople()` is
the heaviest device fold (14 ms in node at 120 questions × 200 voters,
memoised on the store revision); four lens bodies fold unmemoised on
every render (Explore's tally, Who's-here, the places field, the City
field's `rankKindred`). The circle stop fans out one query per followed
account, 300 answers each with no `orderBy`, which binds today against
570 answerable questions (`circle.ts` records the count and the defect).
`COST-REDUCTION.md` prices cutting Kindred from twelve lists to four at
−39% of the bill at 500 DAU.

## 2 · The engine — what I would build

### 2.1 · The baseline row and the skill score · **S**

Publish, beside every number the scorecard already carries, the same
number for a marginal-only guess over the same observations:
`quality.baselineBits` (pooled), `perQ[qid].baselineBits`, and
`quality.skill = 1 − bits/baselineBits`. The fold computes `mPrev` for
every observation already; the baseline is one more `prequentialBits`
call with `dot = 0`. Zero extra reads or writes, a few bytes on an
11 KB doc, one test that a fit which has learned nothing publishes
`skill ≈ 0`. This is the instrument that turns §1 from a synthetic
finding into a production reading, every night, forever — and it is
what makes 2.2's crossover a measurement rather than an opinion (pat-6
in `MEASUREMENT-NOTES.md`, the bridge's own condition).

A second cheap line: publish the seed-distance summary D325's
displacement could not carry — mean cosine of each `L[q]` with
`seedLoading(qid)` and the share above 0.9. A fit at its seeds says so
in one field.

### 2.2 · A batch engine, scored as a candidate before it replaces anything · **M**

The probe's `als` engine is the shipped *model* with a different
*solver*: the same centred ±1 residual `r = x − mean_q`, the same rank-8
`r ≈ θ·L`, the same device ridge at prediction — solved each night by
alternating ridge least squares over every observation the fit holds,
warm-started from last night, with weighted-λ regularisation (λ scaled by
each row's count, so a question with twenty answers stays shrunk while
one with two thousand is free) and item norms clamped at 1 (|r| ≤ 2 and
θ is unit-scale, so a longer vector is overfitting by construction).
Three sweeps a night. It needs the whole observation matrix, which is
what §4.1 provides and the ledger-day design cannot.

What it measured: Pearson 0.95 at 2,000 people and 0.99 at 20,000
against the shipped 0.03; the Map's strongest edge a true neighbour for
66% and 94% of questions against 3%; second-half bits 0.865 and 0.860
against the marginal's 0.925 and 0.924 and truth's 0.819 — 57% and 61%
of the gain that exists, and 71% over the 180-day horizon of table C,
where the corpus is exhausted and every person has answered everything.
Its first month is slightly *worse* than the
marginal at launch size (0.953 vs 0.947): a K = 8 solve over people with
a handful of answers overfits until the corpus fills in, and this is the
argument for 2.3 rather than against the engine.

Cost, at the sizes `COSTS.md` prices. Observations per fitted person are
bounded by the corpus (113 today, ~400 under §3) and average far fewer;
at 50 k DAU with MAU ≈ 150 k and ~40 observations each that is 6 M
observations, 8 bytes each in typed arrays (person index, question
index, value) — 48 MB, inside `LIGHT_UNBOUNDED`'s 256 MiB with the
ledger-day buffer gone. At 500 k DAU it is 480 MB, which is a memory
setting (Cloud Run gen 2 goes to 32 GiB; a 1 GiB instance for ten
minutes is $0.0015 a night) and not a redesign — and the item step
only needs per-question sufficient statistics (an 8×8 Gram and an
8-vector), so the sweep can stream people from Firestore in pages and
never hold them at all if the buffer is ever the wrong shape. Compute:
three sweeps × 6 M observations × 64 flops ≈ 1.2 GFLOP, seconds in
node; 20–50 s at ten times the size, against a 480 s timeout.

**It ships as a candidate, not as the fit.** The loadings doc gains a
`candidates` block — `{als: {q: {…}, quality: {…}}}` — scored on the same
prequential log with the same baseline, and the client keeps reading
`q`. The crossover rule is written down before the first night: the
candidate replaces `q` when its `skill` has beaten the shipped fit's on
fourteen consecutive nights with a basis above the D265 floor, and the
swap is one record citing the fourteen rows. The scorecard reader
prints both. This is the shape D325 asked for when it wrote "any
candidate engine is judged against the same prequential log", and it
keeps the D166 trial honest: the tab draws what the fit publishes, and
what it publishes changes on evidence.

Why ALS and not the logistic model, which is the "right" likelihood for
a binary answer: the linear model over ±1 keeps every device reader
unchanged — cosine, `estimateTheta`, `marginal + θ·L`, `surprisalBits` —
because it IS the model those readers already assume, and the probe's
logistic candidate was not competitive as written (the table says so
rather than tuning it into place). A logistic engine is a second
candidate for the same block, later, with the same rule.

### 2.3 · Choose K, λ and the device ridge by the scorecard, and publish them · **S**

Three constants are fixed today where they could be measured:

- **K = 8.** `PATTERNS_MIN_POOL = 24` is derived from it (three questions
  per dimension). The probe's world has four true dimensions and the
  batch engine still recovers it at K = 8, but the first-month overfit
  is K's. Fit K ∈ {4, 6, 8, 12} as candidates — each is seconds — and
  publish the winner's K on the doc, which `patterns.ts` already reads
  as `k`.
- **The device ridge λ = 0.5** (`estimateTheta`). Table A shows it is
  the difference between a candidate that beats the marginal in its
  first half and one that does not (1.060 vs 0.953 in the first half;
  0.881 vs 0.865 in the second). Publish `lambdaU` on the loadings doc,
  chosen nightly by the same score, and have the device read it with
  0.5 as the fallback — the `patternsBasis` handshake pattern (D265),
  pointed at a real number instead of a copy.
- **The fit's own λ and sweeps** — same block, same rule.

### 2.4 · A canonical basis, night to night · **S**

A batch solve has no continuous basis: two refits differ by an
orthogonal rotation and sign flips even when nothing moved. D325's
displacement is deliberately unaligned because the shipped fit is one
model folded forward; under 2.2 the alignment IS what makes displacement
mean anything. So: after the nightly solve, rotate the new loadings onto
the previous publish by orthogonal Procrustes (an 8×8 problem — a Jacobi
eigen-solve in pure TS, no dependency), then publish. Publish both
displacement numbers, raw and aligned, with `space` naming each. This is
also what `PEOPLE-MAP.md` §7 named as the fourth reason a whole-world map
was deferred ("it re-opens rotation"); with a canonical basis that reason
stands down, and the other three remain the owner's.

## 3 · The corpus — from one bit to every core question · **M**

The fit encodes an answer as ±1 because the engine "is one bit per
question", the prototype's own rule. The model does not need that; the
*encoding* does. Three extensions, each a centring rule and nothing else
on the engine side:

- **Ordinal items** (scale 5, rating 10, dial 12, the pulse's 5): the
  residual is the standardised position, `r = (idx − mean_q)/sd_q`, so
  every item has unit variance and the same `r ≈ θ·L` holds. 49 daily
  questions and 6 core dials join the fold; the Map's cosine and the
  People lens's agreement read them unchanged. Prediction for an ordinal
  item is a position, and the Oracle is a two-option surface — so the
  Oracle keeps asking two-option questions until an ordinal call has a
  design (a request in `VISUAL-REQUESTS.md`, D352), while its θ gets
  better from every ordinal answer the viewer has already given.
- **Unordered choice** (33 daily questions, 3–4 options): one-hot —
  each option is a pseudo-item "picked A" with its own loading, centred
  by its own share. A question's node on the Map needs a rule for
  drawing four vectors as one place (the centroid, or the strongest
  option); that is a visual, so fold first and draw two-option nodes
  only until the design exists. The People lens and the Oracle's θ take
  the pseudo-items on day one.
- **The 160 instrument items** (`surface: test`, five-point scale). These
  are the bank's only calibrated psychometric items and the ones whose
  co-variation the rest of the app already stakes claims on. D161's
  sample-bias argument is satisfied — every instrument item is served to
  everyone, core by construction (`MIRROR.md`'s corpus note). Folding
  them makes θ span the instruments' space (the joint latent model
  `tst-1` and `tst-9` argue for), and it turns `AXES-PLAN.md` §2's
  "project, don't refit" into arithmetic over the loadings doc alone:
  a trait axis is the keyed sum of its items' loading vectors, no
  regression over people, no extra read sweep, no per-person state.
  That supersedes the approach PR #341 builds, which is why this row is
  the owner's (`OWNER-LIST.md` § Decisions) and not this page's.

Together: 113 → 376 items in one space. The loadings doc grows from
~11 KB to roughly 40 KB at K = 8 and 4 dp (376 × 8 × ~5 bytes plus the
keys), read once a session; `PATTERNS_MIN_POOL`'s reasoning is
unchanged (three per dimension) and its count simply crosses earlier.

## 4 · The database and the data structures

### 4.1 · The person's observation vector as the fit's substrate · **M**

Today the fit's input is *yesterday's ledger day*: `readLedgerDay`
pages `v2_agg_events` by `at`, the run groups by uid, dedups create
against edit through `fromIdx`, stamps each person's private state with
the day, and steps. The comment block that explains this in
`patterns.ts` is longer than the arithmetic, because the ledger is a log
of aggregate *events* and the fit wants a person's *current answers*.
Everything hard about it — the seven-day catch-up window, the
`{n: 60, marginal: 0}` edit bug, the retry stamp, the 0/0 revision, the
139 MiB day buffer — is the cost of deriving the second from the first
every night.

Store the second. `v2_users/{uid}/patterns/state` — the private doc the
fit already writes, erased with the account, readable by nobody — gains
`a: {qid: optionIdx}`, the person's current answer to every eligible
question. A nightly *compaction* pass reads yesterday's ledger day once
(exactly today's read) and writes each active person's `a` — the same
per-active-user write `putUsers` makes today, carrying a map instead of
a vector. An edit is a `set` on one key; a create is a new key; the
ledger's `fromIdx` machinery is not needed by this reader at all. The
fit then reads *people*, not *days*:

- **Exact and replayable.** The model is a function of the current `a`
  maps, so a crashed night re-runs and produces the same answer; there
  is nothing to double-fold. The retry stamp `d` becomes the compaction
  pass's cursor, one per person, which is the "fold cursor per read
  model" the bridge asked for.
- **Streamable.** The fit pages `v2_users/*/patterns/state` in chunks of
  300 and folds each page as it arrives (velocity's `foldInto`), holding
  at most a page of people plus the per-question sufficient statistics.
  The OOM cliff `patterns.ts` records — the day buffer at 290 bytes per
  entry, unpageable "because the whole day is read to learn which uids
  answered" — is gone by construction, and paging by uid range, the fix
  that note says cannot help, now can.
- **A batch fit becomes possible at all.** §2.2 needs every observation,
  every night; the ledger keeps 90 days and the fit reads one.
- **Rebuildable.** `a` is derived from `v2_users/{uid}/answers/*`, which
  is the truth (`check:answer-shape` pins that every answer carries `qid`
  and `optionIdx`), so a `rebuildPatternsState` walk per account is the
  replay path — the same posture `replay.ts` takes for the aggregates.

Cost, regional prices (`cost-arith.mjs`: $0.03 per 100 k reads, $0.09
per 100 k writes). The compaction's reads and writes are today's fit's,
moved. The fit's new read is one doc per fitted person per night: at
50 k DAU / 150 k MAU that is $0.045 a night, $1.35 a month; at 500 k DAU
$13.50 a month. Size: 113 keys × ~20 bytes ≈ 2.3 KB per person today,
~8 KB under §3; 150 k × 8 KB = 1.2 GB stored, $0.13 a month. Memory in
the fold: 8 bytes an observation in typed arrays (§2.2). A `COSTS.md`
row moves before it ships, as the rule is.

What stays private stays private: `a` is the person's own public answers
(D98) held in a doc nobody may read, no new field anywhere a client can
see, no new rule. What it is not: a second copy of the answers
collection. It is the fit's working set, ~1/50th the bytes of the
documents it summarises, and rebuildable from them.

### 4.2 · One ledger reader, three folds · **M**

Velocity, patterns, taste and engagement each page yesterday's ledger
again — `COSTS.md` counts the day's entries re-read three times as three
server reads per world answer. With 4.1's compaction pass in place, the
other nightly folds that want *per-person* facts can take them from the
same pass: taste's per-topic counts are `a` joined to the topic map;
engagement's `_state` (first day, last day, streak) is the same per-uid
walk. One reader, one batched write per active person carrying all three
documents' deltas, and the ledger term in the cost model goes from
`3 × worldAnswers` to `1 × worldAnswers` — at 50 k DAU, 400 k reads a
night saved, $3.60 a month, and one fewer place for D197's three-copies
failure to recur. Velocity keeps its own read on purpose (`ledger.ts`
says why: different fields, per-page flag logic) and is not part of
this.

### 4.3 · Nightly voter samples — Kindred, People and the pair card from 2,400 reads to 12 · **M**

Every list the device intersects — Kindred's 12, the City pass's 12, the
People lens's 12, the pair card's 4 — is the same query: the latest 200
answers to one question, 200 billed reads each, then names 30 at a time.
The lists are public data (D98), bounded (D102), recency-ordered, and
identical for every viewer who opens them within a day. Publish them.

`v2_patterns/samples/{qid}` — one doc per eligible question, written by
the nightly run from the ledger day it already reads: the newest 200
`{uid, optionIdx}` pairs, appended and trimmed each night, newest first —
the sheet's own semantics ("the latest 200"), refreshed nightly instead
of on open. ~200 × 32 bytes ≈ 6.5 KB a doc, 113 docs (≈ 380 under §3),
one write each a night: nothing. On the device, `sayRows`, `loadKindred`,
`loadCityKindred` and the People lens read one doc per question instead
of 200 rows: a Kindred first view goes from ~2,400 answer reads (plus up
to 2,400 profile reads, session-cached) to 12; at 500 DAU, where
`COST-REDUCTION.md` prices dropping eight of those twelve lists at −39%
of the bill, that is most of the bill. The who-voted sheet itself — a live list of names on
screen — keeps the live query; the folds that only *count* take the
sample.

Two things it owes. **Erasure**: this is the first derived public doc
holding uids (the reason `PEOPLE-MAP.md` §7 deferred published
positions), so `deleteAccount` grows an arm that removes the uid from the
samples it is in — the person's own `a` map (4.1) names exactly which
questions, ≤ 113 targeted updates — and `e2e-delete-account.mjs` asserts
"gone means gone" for it. **Basis**: the People lens and `say()`/`tell()`
state "of the N in both samples" today and keep doing so; the samples
are a day old at most and the caption can say "as of last night" where
it matters. `KINDRED_QUESTIONS`, `PEOPLE_QUESTIONS` and the 12-person
floor do not change. A rules row and a `data-inventory.md` row come with
it (`check:data-inventory`).

### 4.4 · The breakdown cube's overflow · **M, on a trigger**

City and country are the two dims that can evict, and eviction discards
a bucket's partial count: the twenty-fifth city to answer a question
vanishes from that question's City stop until it accumulates five
answers between churns, and a country past the cap does the same. At
launch scale this is dormant; the first daily question with answers from
25 cities wakes it, and nothing logs it — `evictForNewBucket` runs
silently. Two changes, the first now and the second on its evidence:

1. **Log the eviction** — a `metric: "agg_evict"` line with the qid and
   the dim, and a `check:monitoring` row so the alert chain exists.
   Trivial, and it makes the trigger observable rather than assumed.
2. **An overflow document per question for the unbounded dims** —
   `v2_question_aggs/{qid}` keeps the 24 most-answered cities and
   countries as today (the cells almost every reader wants), and
   `v2_agg_overflow/{qid}` holds *every* city and country cell, written
   in the same transaction only when the answer carries one of those
   anchors (+1 write per world answer with a city: writes/day +33%, about
   +$0.55 a month at 5 k DAU against reads that dominate the bill). The
   client reads the overflow only when its own city is not in the hot
   24 — the long tail pays one read per question at its City stop, the
   majority pays nothing new. `replay.ts`'s own comment says what this
   buys beyond correctness: eviction stops firing, the fold is
   commutative everywhere, and replay becomes exact.

Why not raise the cap: a city dim at 500 buckets is ~15–40 KB a
question at realistic option counts, and the client pulls whole
aggregate documents into IndexedDB by the hundred — 300 × 40 KB is
12 MB on a cold hydrate, fifty times the bank. The overflow keeps the
hot document the size it is.

### 4.5 · The hot document

`ANSWER-SCALE.md` §4's sharding design stands and nothing here
re-argues it: every published field is additive, `s = hash(uid) % N`,
a compactor into the exact shape, the daily lane only, on the alert.
One addition: build the *summing helper* and its e2e assertion now, as
pure code with nothing calling it, so the day the alert fires the build
is the trigger's mode switch and not the whole design. 4.1 makes the fit
independent of this — it reads people, not aggregates.

### 4.6 · The client store

Small, named, each its own commit: memoise the four unmemoised lens
folds on the store revision (`perRev`, the pattern `kindredPeople()`
already uses); buy the `(surface ASC, answeredAt DESC)` composite index
the circle's 300-cap needs so a heavy friend's likeness stops being
computed from their alphabetically-first questions (`circle.ts` records
the defect; the index cost is the owner's); and the eviction D350's
amendment owes — keep what was answered and what is on screen, drop the
rest of the handed pages — before heavy devices hold tens of thousands
of bank rows in memory.

## 5 · Pattern calculation on the device

### 5.1 · The Oracle's confidence — the posterior instead of the clamp · **S**

`oracleGuess` clamps `p0` to [0.05, 0.95] so "twenty weak signals cannot
fake certainty". The ridge already knows how certain it is: `A = Σ L Lᵀ +
λI` is the posterior precision, and `Lᵀ A⁻¹ L` is how much of the target's
loading the viewer's answers actually pin. Shrink the guess toward the
marginal by that uncertainty — a probit-style `x̂ / √(1 + s²)` with
`s² = Lᵀ A⁻¹ L` — and the clamp becomes the floor it should be rather
than the confidence. Eight-by-eight, already inverted in all but name,
pure, pinned in `patternsMap.test.ts`. The Oracle's meter then measures
calibration and not the clamp.

### 5.2 · The device ridge from the doc, not the constant · **S**

§2.3: `estimateTheta(obs, k, lambda = loadings.lambdaU ?? 0.5)`. One
field read, one fallback, one test.

### 5.3 · Which question next · **S, owner call**

`nextAsk` is `pool().find(unanswered && n ≥ 8)` — the first eligible
question in pool order. The information rule is one line longer: the
unanswered question maximising `Lᵀ A⁻¹ L` — the one whose loading points
where the viewer's vector is least determined — subject to the same
basis floor. O(pool × K²), no reads. It makes the Oracle learn the viewer
fastest and, for a while, look worst, because it asks what it cannot yet
call; the opposite rule flatters the meter and learns slowly. Which game
the Oracle is playing is the owner's — it is on `OWNER-LIST.md`.

### 5.4 · The People lens and the Map on the new doc

Neither changes its arithmetic. The People lens reads the samples (4.3)
instead of the lists and gains the plane switch `PEOPLE-MAP.md` §6 kept
("place everyone by the moral questions only" is a filtered re-solve —
one chip, no data) for free once the basis is canonical (2.4), because a
plane that does not rotate night to night is a plane a person can come
back to. The Map draws the `axes` block (`AXES-PLAN.md` §2) as
projections computed on the doc (§3), node size from the loading's
basis and — new — from its uncertainty (`n` and the item's residual
variance publish beside `v`), so a thin question is drawn small before
it is drawn wrong.

## 6 · Order of work

Sizes are the runbooks' S/M/L. Every step is its own PR, its own
`COSTS.md` line where a read moves, and its own record.

| # | Step | Size | Touches | Proves it | Owner? |
| --- | --- | --- | --- | --- | --- |
| 1 | Baseline bits, skill and seed-distance on the scorecard (§2.1) | S | `patternsFit.ts`, `patterns.ts`, tests | `patternsFit.test.ts`: a fit at its seeds publishes skill ≈ 0 | no |
| 2 | The per-person observation vector and the compaction pass (§4.1) | M | `patterns.ts`, new `patternsState.ts`, `deleteAccount` (already recursive), `data-inventory.md`, `COSTS.md` | store-projection test; e2e erasure; a replay-from-answers test | no |
| 3 | The batch engine as a `candidates` block with the fortnight rule (§2.2, §2.3) | M | `patternsFit.ts` (ALS, Procrustes), `patterns.ts` | the probe's recovery on the test world; determinism; the crossover rule pinned | no |
| 4 | The canonical basis and the aligned displacement (§2.4) | S | `patternsFit.ts` | displacement of an unchanged model is 0 after a random rotation | no |
| 5 | Ordinal and one-hot encodings into the fold (§3) | M | `patterns.ts` eligibility, `patternsFit.ts` residuals, `patternsReady.ts`, `data/patterns.ts` pool | `check:figures` on the pool count; encoding tests | instrument items: **yes** |
| 6 | Nightly voter samples and the erasure arm (§4.3) | M | `patterns.ts`, `firestore.rules`, `voters.ts`, `live.ts`, `data-inventory.md`, e2e | erasure e2e; `voters.test`; `COSTS.md` Kindred row | no |
| 7 | One ledger reader for three folds (§4.2) | M | `patterns.ts`, `taste.ts`, `engagement.ts`, `cost-arith.mjs` | each fold's existing tests on the shared pass; the ledger term | no |
| 8 | Oracle posterior, published λ, information rule (§5.1–5.3) | S ×3 | `patternsMap.ts`, `data/patterns.ts` | `patternsMap.test.ts` | next-question rule: **yes** |
| 9 | Eviction metric now; overflow doc on its first firing (§4.4) | S then M | `pure.ts`, `v2.ts`, `monitoring/`, rules | `check:monitoring`; e2e exact counts | no |
| 10 | The client store's three small ones (§4.6) | S ×3 | `ui/LiveMirrorLenses.tsx`, `LiveSimilarityField.tsx`, `firestore.indexes.json`, `live.ts` | panel suites; `indexes.test.ts` | the index: cost is the owner's |

Steps 1–4 are the engine's rescue and are independent of everything
below them; 1 alone changes what the next scorecard reader will show.
Step 5 waits on the owner's row. Step 6 is the largest cost lever on
this page and needs 2 for its erasure arm.

**Where each step stands** (2026-09-06, the same day — the owner's *"apply
those"* on this page, D382–D386 the records). Not maintained by
intention: a step that moves after this gets its own record, and the
record is the truth.

| # | Built | Record, and what differs from the row above |
| --- | --- | --- |
| 1 | yes | D382 — `baselineBits`, `skill`, `seedCos` on the scorecard |
| 2 | yes | D383 — `a` on `v2_users/{uid}/patterns/state`, compacted from the ledger day; no separate `patternsState.ts`, the compaction lives in `patterns.ts` |
| 3 | yes | D383 — `patternsAls.ts` (pure); `candidates` on the loadings doc; `candidateWon` needs skill > 0 AND > the engine's; the fortnight streak |
| 4 | yes | D383 — orthogonal Procrustes onto the published basis; the displacement rides the aligned model |
| 5 | yes | D383 (server: bin · ord · opt items, the 160 instrument items among them) and D384 (device: every kind is evidence). The owner's row, taken with the same words |
| 6 | yes | D385 — `v2_patterns/sample-{qid}`, the erasure arm, Kindred · People · pair card reading it; the who-voted sheet and the City pass stay live |
| 7 | **no** | not started — the three nightly folds still read the ledger separately; §4.2 stands as written |
| 8 | yes | D384 — the posterior is computed and NOT used to shrink the guess (measured: helps at λ = 0.5, hurts at λ ≥ 2; `patternsMap.ts` says why); λ is published and swept nightly; the information rule, the owner's row |
| 9 | half, by design | D386 — the metric and the alert, with the refusal half the row above missed; the overflow document waits on the alert's first firing |
| 10 | two of three | D386 — three folds memoised (`WhosHere`'s needed none; the record says why) and the Circle's index. The client store's page eviction — D350's amendment — is not built |

## 7 · What this does not propose

- **No per-person publication.** θ stays a device solve; the samples
  (4.3) carry what the who-voted sheet already shows and nothing
  derived. `PEOPLE-MAP.md` §11's refusals stand.
- **No change to the three denies**, no new client-writable field, no
  privacy floor, no fabricated data — a candidate that has not earned
  the crossover is a block on the doc that nothing draws.
- **No verdict on the D166 trial.** The tab's condition (D265) reads the
  same two numbers; what changes is whether the loadings behind them
  mean anything.
- **No re-litigation of D161.** Core only, and instrument items are
  core; the tail stays out.
- **Nothing longitudinal.** Within-person change needs era-scoped
  re-serving, which is one owner sentence already on `OWNER-LIST.md`,
  and this page does not pretend a between-person fit says anything
  about how a person moves (`MEASUREMENT-NOTES.md` §1).

## 8 · Reproduce

```
npm run probe:fit                                                    # table A
npm run probe:fit -- --people 20000                                  # table B
npm run probe:fit -- --days 180 --lambdaU 2 --engines truth,marginal,shipped,shippedF,shippedT,als   # table C
npm run probe:fit -- --world test --people 120 --days 60 --perDay 2 --active 1 --repeats \
  --engines truth,marginal,shipped,shippedT,als                      # table D
npm run probe:fit -- --world test --people 120 --days 5 --perDay 2 --active 1 --lambdaU 2 \
  --engines truth,marginal,shipped,shippedT,als                      # table E
npm run probe:fit -- --loadings loadings.json                        # the live doc against its seeds
```

`--lambdaU 2` reproduces the als rows marked "device λ = 2"; the default
is the shipped 0.5. Runs are deterministic; the 20,000-person table
takes about two minutes, the rest seconds. `npm ci` is not needed —
the probe imports `functions/src/patternsFit.ts` through Node 22's type
stripping and nothing else.

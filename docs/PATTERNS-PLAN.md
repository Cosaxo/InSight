# The Patterns plan — three lenses widened, and the walls before they bind

**Status: mixed — steps 1 and 2 (§3, §4) are BUILT at D432 and D433, the same day; steps 0, 3, 4 and 5 are proposals and nothing else is built.** Written
for the owner's ask of that day (*"make a plan for implementing it"*),
after the same session's reading of the three lenses against the tree.
Every *exists today* claim in §1 names the file it was read in; every
figure is either a constant in the tree or marked as an estimate. Nothing
here is a decision. What is the owner's is filed on `OWNER-LIST.md`
(§10 lists the rows), and the one visual is request 13 in
`VISUAL-REQUESTS.md` — a node with more than two answers has no design,
and visuals are designed before they are built (D352).

## 0 · The short version

One model, three readings. The nightly fit gives every core item an
eight-number vector; the Map reads the item vectors against each other,
the People lens reads person vectors solved from them on the device, and
the Oracle reads the viewer's vector against the next item's. So a
change to what the fit FOLDS reaches all three lenses at once, and a
change to what a lens DRAWS reaches one. The steps below are ordered by
that: fold first, draw after the design.

| Step | What | Where it lands | Cost | Needs |
| --- | --- | --- | --- | --- |
| 0 | Measure: which engine owns the rows; seed the samples | a console read; the owner-list row that already exists | none | one click |
| 1 | A cohort prior for the Oracle — the viewer's own groups' split instead of the world's | device only, `src/v2/data/patterns.ts` | ~2 days | nothing |
| 2 | Anchors as items in the fit — age band, gender, country, … as rows with vectors | `functions/src/patternsAls.ts`, `patterns.ts`; device `evidence()` | ~4 days | a tick before the Map DRAWS them |
| 3 | Catalogue picks as items — per-entity rows above a floor, one *everyone else* row | the ledger entry, the compaction, the samples, request 13 | ~4 days + design | request 13 |
| 4 | Calibration and the meter — a fitted link, skill against the base rate, learn-then-call | the scorecard, `oracleGuess`, `meter()`, `nextAsk` | ~2 days | one line on the question-rule row |
| 5 | The walls — index entries on the loadings document, the ring, the People map's overlap | `firestore.indexes.json`, `PatternsMap.tsx`, `peopleMap.ts` | ~2 days | the whole-world map is an ask |

What it does not propose is §9: a different model, a different database,
or a picture nothing has designed.

## 1 · What exists, verified 2026-09-09

- **The fit** (`functions/src/patterns.ts`, arithmetic in
  `patternsFit.ts` for the online engine and `patternsAls.ts` for the
  candidate) publishes one document, `v2_patterns/loadings`, read whole
  once per session (`src/v2/data/patterns.ts`). Per item: the vector `v`
  (K = `PATTERNS_K` = 8), its basis `n`, `sum` (the marginal is
  `sum/n`), an ordinal row's `sd`. Beside the rows: `engine`, `lambdaU`,
  `quality` (pooled prequential bits against `baseBits`, the marginal
  alone — skill is `1 − bits/baseBits`), and `candidates.als` with the
  same scorecard, its `streak` and `lambdaSweep` over
  `ALS_LAMBDAS_U = [0.5, 1, 2, 4]`. The candidate takes the rows after
  `PATTERNS_CROSSOVER_NIGHTS = 14` consecutive wins (D395). No session
  in this repository can read production, so which engine owns the rows
  tonight is unknown here — step 0.
- **The corpus** is `itemEligible` (`patternsAls.ts`): two or more
  options, and surface `daily` or `test`, or `feed` with `core`. Measured
  2026-09-06 (`ALGORITHM-REFLECTION.md` §3): 545 rows over 376 questions
  — 113 two-option, 217 one-hot option rows, 215 ordinal. A catalogue
  question has `options: []` and is excluded by the first clause. Its
  answer carries `entity`, never `optionIdx` (`v2.ts`, the catalog arm of
  `onV2AnswerCreated`), and its ledger entry is `ledgerEntry(uid, qid)`
  — no option, no entity, no anchors — so the fit has never seen a
  single pick. The bank holds 24 catalogue questions (`v2content.ts`):
  six Pokémon, five emoji, four each of countries, dogs and elements,
  one athletes. A catalogue entry is `{key, name}` and nothing else
  (`src/v2/data/catalogs.ts`, `pokedex.ts`), so there is no type or
  generation to derive a coarser item from without new data.
- **The device** (`src/v2/data/patterns.ts`): `pool()` is two-option
  only; `evidence()` reads every answered item the rows can encode —
  under the candidate's `items` metadata a two-option answer as ±1 minus
  the marginal, an ordinal one standardised, a pick against each one-hot
  row, the 160 instrument items among them; under the online rows,
  two-option only. `ridgeSolve` (`patternsMap.ts`) returns θ and the
  posterior precision's inverse; `mostInformative` picks the next
  question (the owner's 2026-09-06 call, D396); `oracleGuess` is
  `clamp((1 + marginal + θ·L)/2, 0.05, 0.95)` — a linear map with a
  clamp, no fitted link; `surprisalBits` grades; `meter()` returns the
  graded records, how many it called, and mean bits. `nextAsk` refuses
  under `PATTERNS_MIN_BASIS = 8`.
- **Anchors.** Every answer snapshots `answerAnchors()` (`live.ts`) —
  the dims of `BREAKDOWN_DIMS` (`functions/src/pure.ts`; client copy
  `COHORT_DIMS` in `cohort.ts`): age band, gender, city, country,
  education, relationship, height band, job field. Every question
  publishes `by` — dim → bucket → option → count — on
  `v2_question_aggs`, which the device holds as `agg.by` on the
  aggregated question (`deck.ts`; `byOf` in `cohort.ts`) and the Mirror
  reads today. **The fit reads none of it**: centring is the world
  marginal, and the viewer's θ starts at the origin. The ledger entry
  carries `anchors` since D397 (for the samples), so the server has
  them per answer already.
- **The People lens** (`src/v2/data/peopleMap.ts`,
  `ui/PatternsPeople.tsx`): `peopleFetchSet` takes the viewer's answered
  pool questions, highest basis first, capped at `PEOPLE_QUESTIONS = 12`;
  rows come from `LIVE.votersOrSample` — the live list or the nightly
  sample (`v2_patterns/sample-{qid}`, `PATTERNS_SAMPLE_CAP = 200`, rows
  `{o, a, d}`: option, frozen anchors, day). A person is placed at
  `PEOPLE_MIN_SHARED = 4` shared answers; position is the first two
  components of their unit θ; `alike` ranks on agree/shared. Under
  `PEOPLE_MIN_CROWD = 8` placeable people the lens says *too thin*.
- **The Map** (`ui/PatternsMap.tsx`, `data/patternsMap.ts`): every pool
  question on one rim, radius 131 in a 352 box, grouped by topic; the
  topic chip lowers other topics' opacity and does not change ring
  membership; `edgesOf` is an exact all-pairs pass, and the file's own
  header names 512 as the swap point it did not port an ANN index for.
- **The gate** `patternsReady` (`data/patternsReady.ts`): 24 questions
  fitted on eight answers or more, and eight answers of the viewer's own.
- **The index file** `firestore.indexes.json` carries one field override
  (`engagement.folded`) and none for `v2_patterns`, so the loadings
  document is indexed field by field and element by element like any
  other. Nothing queries inside it: the only reads are `getDoc` by id.
- **The rules**: `v2_patterns/*` reads for any signed-in user, writes
  closed; `v2_users/{uid}/patterns/state` — the fit's per-person vector
  and, since D395, the answer map — reads for nobody, with the comment
  `PEOPLE-MAP.md` §7 deferred the whole-world map on.

## 2 · Step 0 — measure before touching anything

**0.1 Which engine owns the rows.** One read of `v2_patterns/loadings`
in the Firebase console, four fields written down: `engine`,
`quality.bits` against `quality.baseBits`, `candidates.als.streak`,
`lambdaSweep`. Three outcomes, each deciding something:

- `engine: "als"` — the rows carry signal (the probe measured Pearson
  0.95–0.99 against the generating geometry, `patternsAls.ts` header).
  Steps 1–3 land on rows that can carry them. Proceed.
- `engine: "sgd"`, streak climbing — the crossover is doing its job.
  Nothing to build; wait it out, and do steps 1 and 5 meanwhile, which
  do not depend on the rows.
- `engine: "sgd"`, streak at zero for nights on end — the candidate is
  not winning one step ahead, which the probe says it should. Measure
  why (`ALGORITHM-REFLECTION.md` §8 reproduces the fit on a log) before
  anything else, because every step below is scored on that same
  scorecard and would inherit the fault.

This is a console read because no session here can reach production;
it is the click on `OWNER-LIST.md` § Clicks. The fit scorecard's reader
(`VISUAL-REQUESTS.md` item 3) is what makes it a screen instead.

**0.2 Seed the samples.** The row is already on the owner list: legacy
questions' samples were never seeded, and `say()` and `tell()` want
twelve people in both samples, so the pair card and the Oracle's
working panel read *thin* on exactly the questions with the most
answers. Steps 3 and 4 both draw sentences from those samples; seeded,
they say something on the first day.

## 3 · Step 1 — a cohort prior for the Oracle, on the device — **BUILT (D432, 2026-09-09)**

*As built, where it differs from the paragraphs below:* one `priorOf`
became three helpers by row kind (`binCentre`, `ordCentre`,
`pickPrior` in `patterns.ts`) over one pure fold
(`data/cohortPrior.ts`); the shadow is not a re-solve of old records but
a second guess SEALED beside the live one on every record and graded on
the same answer, so the meter (`PATTERNS.meter()`: `cohortBits`,
`worldBits`, `baseBits`) is the verdict without a fixture — which also
brings step 4's `m0` forward, since the base rate is stored at seal
time; `ORACLE_CENTRE` picks the live variant and every record carries
the centre it was sealed under; the People lens keeps the world centre
for the viewer's own dot. D432 has the reasoning.


**The change.** Today the guess is `marginal_world + θ·L`. Proposed:
`marginal_cohort + θ·L`, where the cohort marginal is folded on the
device from the question's own `agg.by` cells for the viewer's own
anchor values — the cells the Mirror already reads. A sixty-eight-year-old
man's prior on a question is then his groups' split, not the world's,
before one answer of his own is counted.

**The arithmetic.** Per dim, the cell's split against the world's as a
likelihood ratio; dims combined as a product (naïve Bayes — the dims are
not independent, and that is the known bias of the shape, accepted
because the alternative is a joint cell the cube does not publish);
each dim shrunk toward the world by its cell count, `n/(n + 20)`, so a
cell of three people moves nothing; the result clamped like today. In
encoded units the prior is `m ∈ [−1, 1]` and `p0 = (1 + m)/2`. **The
residual the θ solve centres by must be the same prior**, or θ learns
the demographics twice: `evidence()` and `seal()` share one `priorOf(q)`.

**Where.** A new pure module `src/v2/data/cohortPrior.ts` (the
`peopleMap.ts` posture: no Firebase, no `window`, tested without a
device) and one call site each in `evidence()` and `seal()`. Reads: none
— `agg.by` rides the aggregated question documents the deck holds.

**What proves it.** The sealed records already store `p0`; a shadow `p0′`
under the prior is computable for every graded record from data the
device holds, so mean bits with and without the prior are available per
device before it ships (a fixture in `patterns.test.ts` with a synthetic
`by` map pins the fold; `MEASUREMENT-NOTES.md` gets the row). It ships
if it beats the world marginal on that meter and is otherwise recorded
as tried.

**Honesty.** The Oracle's *Why?* panel lists what carried the call
(`working()`); the prior is one more row type — *"people your age lean
61% this way"* — with its basis, the D146 rule. The anchors read here are
the viewer's own, on their own device; nothing leaves and nothing new
publishes, so this is not a D334 ask.

**The limit.** It helps exactly as much as a cohort's split differs from
the world's, which the `by` cells state per question; on a question
everyone answers alike it is the world marginal again.

## 4 · Step 2 — anchors as items in the fit — **BUILT (D433, 2026-09-09)**

*As built, where it differs from the paragraphs below:* the items are
compiled from the scanned PEOPLE each night (`compileAnchorItems`,
`patternsAls.ts`), floored at the pool's own basis and capped at the
cube's 24 per dim, and there is no *rest* row — the cap bounds the rows
without it and a person outside it is already said by the −1s; the
person's newest anchors ride the state document as `an`, a snapshot
replaced whole; the scorecard reads a newcomer's anchors off their
first entries of the day, since the profile precedes the vote; on the
device the anchors are evidence under the WORLD centre only, so D432's
two sealed variants are two clean answers — the cells or the rows — and
the meter decides; the People fold takes the rows through
`anchorRows`. The Map draws nothing until the owner's tick and request
13. D433 has the reasoning.


**The change.** Each anchor value becomes a one-hot pseudo-item with its
own loading vector — `anchor~ageBand~55-64`, `anchor~gender~male`,
`anchor~country~NO` — encoded +1 when the person's answer carried that
value and −1 when it carried the dim with another value; a dim the
person never filled in contributes no observation. The mechanism is the
`opt` kind `compileItems` already builds (`patternsAls.ts`); the
substrate is the person's answer map on their state document, compacted
from the ledger, whose entries carry `anchors` since D397. `alsFit`
folds them as rows like any other; `publishableAls` publishes them under
`q` with `items` metadata (`kind: "opt"`, plus a `dim` field so a reader
knows it is not a question).

**Row budget.** Age band, gender, education, relationship and height
band are short vocabularies; job field is the closed list of twenty
(D328); country and city are capped by the fit at the same
`BREAKDOWN_MAX_BUCKETS = 24` the cube caps at, top by count plus one
rest row. About a hundred rows, against 545 today.

**Device.** `evidence()` adds the viewer's own `answerAnchors()` values
as observations against those rows, so θ has a demographic component
before any answer; the People fold does the same with each sample row's
`a`, so placement is beyond popularity AND demographics. The counted
sentence — *agrees 9 of 12* — stays an answer count and never counts an
anchor: the basis must remain what the reader thinks it is.

**Step 1 and step 2 are one knob twice.** Once the anchor rows publish,
the prior comes out of the model itself (`marginal + θ·L` with θ carrying
the anchors), and step 1's `priorOf` reduces to the world marginal
again. Keep whichever scores better on the same meter and say so in the
decision entry — the header of `ridgeSolve` records the same finding
about shrinkage and λ.

**Scoring.** The anchors join the CANDIDATE first and are judged by its
scorecard, one step ahead on the same two-option observations, and take
the rows by the same fortnight rule. Nothing flips.

**What the Map does with them.** An anchor row is a node the Map could
draw — *65+ leans this way* as a chord to a question. That changes what
the Map is a map OF, which is the finding the owner-list row on
instrument items already made, so it is the owner's: until ticked,
`pool()` skips keys with the `anchor~` prefix (it already drops every
row the bank cannot name), and the anchors feed θ and the People fold
only.

**Privacy.** D98: the same splits already publish per question, and a
loading for *male* is a summary of how gender predicts answers — the
reading the Mirror's People and Compare lenses give today. Not a D334
ask in the exposure sense; the owner row is about the picture.

**What proves it.** The nightly pass over a fixture ledger that carries
anchors (`functions/src/patterns.test.ts`), the device solve with anchor
observations (`patterns.test.ts`), and the scorecard's own verdict.

## 5 · Step 3 — catalogue picks

**5.1 The ledger carries the pick.** `PatternsLedgerEntry` gains
`entity?: string` — the canonical key `catalogEntityKey` already
computes — and the catalog arm passes it and the anchors:
`ledgerEntry(uid, qid, undefined, undefined, anchors, entity)`. The same
public-answer reasoning as `optionIdx` (D98), the same TTL, the same
erasure arm.

**5.2 Data-driven items.** `compileItems` cannot enumerate a catalogue
at build time — a thousand species, hundreds per domain — so the
catalogue's pseudo-items are compiled from COUNTS: the compaction tallies
picks per (question, entity); an entity with `PATTERNS_ENTITY_FLOOR`
answers or more (proposed 20, the scale at which the weighted ridge stops
shrinking a row to nothing) gets an `opt` row, `pick-pk01~25` for the
species key, and everything under the floor folds into one row,
`pick-pk01~rest`. Row budget: the aggregate already cuts its board at
`CANON_TOP_N = 10`, so at most ten named rows plus the rest per
question — about 260 rows for 24 questions, 500 if the floor lets twenty
through.

**5.3 The samples.** `SampleRow` gains `e?: string`; the client's
`votersOrSample` and `say()`/`tell()` treat a catalogue endpoint as
*picked E* against *not*, which is the same 2×2 the pair card counts
today, basis stated.

**5.4 The device's own picks.** `LIVE.answeredIndex()` maps question to
option index and a catalogue answer has none, so `evidence()` needs the
viewer's entity keys — either a second index or the index widened to
carry an entity. One change in `live.ts`, pinned in `vote.test.ts` like
every other `LIVE` member.

**5.5 The Map.** A catalogue question is one dot in its topic; its ties
are per entity — *Pick Pikachu here, and 64% pick tea*. How a dot with
many answers reads on the ring, and which answer a chord names, is
request 13; until it is designed, catalogue rows feed θ and the People
fold on day one and the Map does not draw them.

**Honesty.** The density argument in `SCALE-PLAN.md` §1 applies with
force: a favourite spread over a thousand species clears the floor only
for the popular picks. The card must say so — *six of 1,025 are common
enough to say anything; the rest are "everyone else"* — and never name
a pick that is in the rest row.

## 6 · Step 4 — calibration and the meter

**6.1 A fitted link.** `oracleGuess` maps the expected encoded answer to
a probability linearly and clamps at 0.05 and 0.95, so *sure* is not a
measured share. The nightly scorecard already sweeps the device ridge
and publishes the winner as `lambdaU` (D395); add one more knob to the
same sweep, a slope `tau` on the link — `p = clamp((1 + tau·x̂)/2)`, or a
logistic on `tau·x̂` — chosen by prequential bits on the same held-out
day, published beside `lambdaU`, read by the device the way `lambdaU()`
is. `tau = 1` reproduces today's guess exactly, which
`patternsMap.test.ts` pins. §5.1 of `ALGORITHM-REFLECTION.md` proposed
shrinking by the posterior instead; it was measured to help at one ridge
and hurt at another (the note above `ridgeSolve`), which is the reason
to fit a slope on the scorecard rather than derive one.

**6.2 The meter says skill.** `meter()` reports mean bits, a number with
no baseline. Seal-time stores the marginal the guess started from
(`m0` on `OracleRecord`), so every graded record also has its surprisal
under the marginal alone, and the done state can say *it beat plain
guessing by 23%* — the same `1 − bits/baseBits` the fit publishes, on
the viewer's own record, basis stated. No percentage in the field (the
2026-09-06 rule); the sentence lives in the done state, worded under
`COPY.md`.

**6.3 Learn first, then call.** The information rule asks what the
viewer's answers determine least, so the game looks worst exactly while
it is learning fastest. A schedule keeps the owner's choice and stops
the meter from lying about it: while the best candidate's undetermined
share — `undetermined(invA, L)` against its value with no evidence,
`1/λ` — is above one half, ask the informative question; below it,
call the question the model is surest of (largest `|x̂|` among the
unanswered) with one pick in four still informative so it keeps
learning. This changes the feel of the rule the owner chose, so it is a
line on that owner-list row, not a build.

## 7 · Step 5 — the walls

**7.1 The loadings document's index entries — an estimate, and the
measurement that replaces it.** Firestore indexes every field of a
document unless an override says otherwise: a scalar twice (ascending,
descending), an array once per element. Nothing in the tree exempts
`v2_patterns`. Counted off the published shape: a `q` row is eight
elements plus `n`, `sum` and often `sd` — about fourteen entries; an
`items` row about eight; `quality.perQ` about six per question. Today's
545 rows come to roughly 15,000 entries against the 40,000-entry
document limit; steps 2 and 3 add about 600 rows, roughly 13,000 more.
That leaves headroom, but a second engine carrying the full corpus in
`candidates`, or the catalogue at twenty rows a question, crosses it —
and the failure is the nightly write refusing, with the cursor left
behind. **This number is unmeasured**: the fix is to make it measured
before it is trusted — a script under `scripts/` that counts entries for
a fixture publication by the rule above, held by `test:scripts` — and
then to remove the wall altogether: a `fieldOverrides` entry for
collection group `v2_patterns` on `q`, `items`, `candidates` and
`quality` with no indexes, pinned in `indexes.test.ts`. Nothing queries
inside these documents, so nothing is lost. The byte ceiling stays:
about 130 KB Firestore-accounted at 545 rows (`ALGORITHM-REFLECTION.md`
§3), so 1 MiB is near 4,000 rows. When rows pass 2,500, shard `q` by
topic into `v2_patterns/loadings-{cat}`; the reader joins rows to the
bank by id already, so a per-topic document is a loop over documents.

**7.2 The ring.** 113 dots on a rim of radius 131 already sit about five
pixels apart; the rest of the core halves that, and a thousand is a
line. Two controls on a surface that exists, so no request (CLAUDE.md's
rule): the topic chip re-rings — `ringOf` over the filtered items when a
topic is chosen, the pool sentence already narrows with it — and an
*answered* ring. Above a dot budget (proposed 300), the ring draws each
topic's strongest hubs and says *N of M drawn*.

**7.3 The all-pairs pass** is not a wall yet: 545 rows is about two
million multiplies, 3,000 rows about seventy million, both under a
hundred milliseconds on a phone. The prototype's LSH path is in git
history for the corpus that needs it.

**7.4 The People map's overlap.** Computation is bounded by design —
twelve lists of two hundred — but a person is placed only from answers
shared with the viewer, and as the bank grows, random pairs share fewer
questions. `peopleFetchSet` sorts by basis; sort daily questions first
(everyone answers them), then basis, so four shared answers stay
reachable however large the feed grows. The proper fix is
`PEOPLE-MAP.md` §7's whole-world map — everyone placed from the fit's
own person vectors instead of from samples — which needs a document
that publishes something derived per person. That is the D334 ask on
`OWNER-LIST.md`, with the smallest shapes stated there.

**7.5 The gate** `patternsReady` stays at 24 and 8, but *eight own
answers* must keep counting ANSWERS: with anchor items in θ a profile
alone could satisfy a count of observations, and a tab earned by filling
in a form is the tab D265 refused.

## 8 · Order and what each step waits on

1. Step 0 — the click, and the seeding row. Nothing else waits on a
   session.
2. Step 1 — device only; runs under either engine; scored before it
   ships.
3. Step 5.1 — the index-entry count and the override, before steps 2 and
   3 add rows.
4. Step 2 — needs the candidate engine to be the judge; the Map half
   waits on the owner's tick.
5. Step 3 — needs request 13 for the picture; the fold and the People
   half do not.
6. Step 4 — after step 2, so the slope is fitted on rows that carry
   the anchors.
7. Steps 5.2 and 5.4 — any time; 5.4's whole-world half waits on the
   ask.

Each step is one pull request with its decision entry, and the
scorecard is the verdict on steps 1, 2 and 4: a step that does not beat
the meter is recorded as tried, not merged as an improvement.

## 9 · What this does not propose

- **A different model.** The K = 8 bilinear fit and D395's two-engine
  document are the mechanism every step reuses; nothing here adds a
  parameter the scorecard cannot judge.
- **A different database.** The walls in §7 are Firestore-shaped —
  one document's entry and byte limits, reads billed per document — and
  each has a Firestore-shaped fix. The day the nightly folds need a
  query engine rather than a document, the seam already exists: the pass
  reads the ledger and publishes documents, and the ledger's rows
  (uid, question, option, day) are a table. Moving the FIT to a
  warehouse and publishing its result back is additive; moving the app
  is not.
- **Drawing without a design.** The multi-answer node (request 13) and
  the anchor node (the owner's tick) wait; the folds do not.
- **Changing the corpus rule.** D161 stands: core only, and the tail
  never enters the fit.

## 10 · What this plan files elsewhere

- `OWNER-LIST.md` § Clicks — the loadings document read (step 0).
- `OWNER-LIST.md` § Decisions — anchors as nodes on the Map (step 2);
  the whole-world People map (step 5.4, the D334 ask); the learn-then-call
  schedule as a line under the question-rule row (step 4).
- `VISUAL-REQUESTS.md` — request 13, a node with more than two answers
  on the Map ring (step 3).
- `ORIENTATION.md` — this page, status `plan`.

# Next functionality — six ideas, measured against the architecture

**Status: plan notes, not decisions.** Requested 2026-08-14 (owner's list:
current-events questions that stop being asked; height and other one-time
body/general facts, up to facial symmetry and BMI; genetics someday; a
stronger focus on personality *types* rather than single traits; questions
tracked over time, "mood today" as the example, scores likewise; and a
"suggest a question" action that says to whom, what type, and whether it
repeats). This file follows the convention `docs/QUESTION-FARM.md`
§ "Future directions" records: when an idea is picked up it graduates to a
real record in `docs/DECISIONS.md`; until then these notes are the
starting constraints, not approval. Where a verdict below says *build*,
that is this document's recommendation — the owner's adoption is the gate.

Everything here was measured against the tree at the time of writing
rather than assumed; file paths are cited so the next reader can re-check.
Two discoveries reshaped the owner's list more than any opinion could:

- **The type system already exists.** `src/v2/spec/archetype-data.js`
  carries ~45 named types across the four instruments, each with a
  signature vector, a population share, and a scored matcher
  (`IS_matchArchetype`) that the result card and type marks already
  render. What is missing is not types — it is a *cross-user surface* for
  them.
- **The suggestion board already exists.** `src/v2/spec/suggestions.js` +
  `suggestions.jsx` are a working composer and board, faked onto
  localStorage, and the promotion tooling already accepts
  `--source community` (`scripts/promote-questions.mjs`). The feature is
  a backend short of real.

## 0 · The short version

| Idea | Verdict | Size | The constraint that shapes it |
| --- | --- | --- | --- |
| Current events | **Build, on the feed** | S–M | Daily questions cannot retire (positional deck; D97 records the gap). The feed already has `active:false` and a topic taxonomy. |
| Over-time ("pulse") questions | **Build — the strongest idea on the list** | L | One answer per question is structural (`aid == qid`). The duel answers' day-keyed id (`g_{gid}_{day}`) is the working precedent to copy. |
| Mood as the first pulse question | **Decide separately** | S on top | Mood tracking moves the store forms (Health is "not collected" today) and makes a public per-person series — both are owner decisions, not engineering. |
| Types focus | **Build tier 1 now; tier 2 is a real decision** | M / L | Tier 1 rides data that is already public. Tier 2 (type as a breakdown dim) amends the standing "a test result is never a breakdown dim" claim (D8, `docs/data-inventory.md`). |
| Height | **Build** — a banded anchor, the age-band pattern | M | Bands, never centimetres, server-side; the device folds and discards the number the way `locate.ts` folds coordinates. |
| Weight / BMI | **Defer, deliberately** | — | Profiles are world-readable (D98): a public weight is a harassment surface, and Health flips on the store forms. Recorded below so it stays a decision. |
| Facial symmetry | **Refuse** | — | Biometric processing against an app whose whole posture is coarse-by-construction; "Photos: not collected" is a load-bearing store answer; the reading itself is junk science. |
| Genetics | **Refuse for now** (the owner already said "future") | — | Art. 9 data cannot live in a world-readable profile; an acceptable version is a separate consented tier, i.e. a different product posture. |
| Suggest a question | **Build — the shortest distance to value** | M | The UI, the dedup gate and the `community` provenance source all exist; what is missing is a collection, a callable and the human gate wiring. |

## 1 · Current events — a category that stops being asked

**The wanted thing:** questions about what is happening now, which stop
showing up once they are stale.

**Verdict: build it on the feed, not the daily.** The daily deck is
positional and epoch-based (`computeDeckIds`, `src/v2/data/deck.ts`) —
retiring an entry shifts every served day, which is why the daily lane
keeps tombstones (`src/v2/data/live.ts`, the `active !== false` comment)
and why D97 records "no epoch-safe retire lane for daily questions" as
deliberately not done. The feed has none of that: it already carries
`active:false` retirement (D52's shape), a topic taxonomy, and — since
D128 — per-topic Less/Normal/More preferences, so a user who hates news
can already turn the tap down themselves.

**The shape:**

- A new feed topic id (say `now`) in `content/feed-questions.json`'s
  taxonomy — a human decision per the farm's rule 3, proposed in a PR
  body, never added silently.
- A new optional field on a feed entry: `until: "YYYY-MM-DD"`. The client
  feed pool filters expired entries the same way it filters
  `active:false`; `check:content` / `check:quality` learn the field
  (date shape; required when the topic is `now`; a bounded window so
  "current" cannot mean months).
- **`active:false` stays the hard kill and the server-side truth.** In
  v1, `until` is a serving filter on the device; a nothing-burger
  consequence is that an expired question technically accepts answers a
  little longer (nobody is shown the card). If that gap ever matters, a
  scheduled function can flip `active` at the boundary — the pattern
  exists three times already (`functions/src/moderation.ts`,
  `v2social.ts`, `velocity.ts`). Note the free property on the other
  side: D86 refuses edits while a question is inactive, so retiring a
  current question also freezes its answers — for a time-scoped question
  that is a feature ("what you said during the window"), worth stating in
  the record when this ships.
- **The archive keeps them, labelled.** Answers and aggregates persist —
  the Mirror is the product — and the answer rows should print the ask
  window ("asked 12–19 Aug") so a reader a year later knows which crowd
  this was. That is a `ui/LiveAnswerRows.tsx` / `cohortLabels.ts`-sized
  change.

**Two boundaries, both already recorded elsewhere:**

- **An opinion about the news is content; a prediction is a CALL.**
  "Should X resign?" is an ordinary feed question. "Will X win on
  Sunday?" needs a sealed answer and a resolved outcome — that is
  Foresight's CALL half, designed in D127/`docs/FORESIGHT-CALLS.md` with
  the executable-rubric constraint, and it must arrive through that door
  or not at all. The current-events lane should refuse prediction-shaped
  prompts and point at the CALL design.
- **This is an editorial lane, not a farm lane.** Timeliness needs a
  human anyway; place-scoped civic questions are sold inventory (farm
  hard rule 6 / `docs/MONETIZATION.md`); and a news question written by
  an unsupervised job is exactly what the farm's governance exists to
  prevent. The suggestion queue (§6) is the natural feedstock — users
  will propose current questions faster than an editor can think of them.

**The honest cost:** content operations. A current-events topic is a
commitment to write a few questions a week forever, or the topic reads as
abandoned — which on a feed with a visible topic filter is worse than not
having it. Ship it when the suggestion queue exists to feed it.

## 2 · Over-time ("pulse") questions — the same question, asked again

**The wanted thing:** a question type where the point is the series —
"mood today" — and, eventually, scores tracked the same way.

**Verdict: build. This is the strongest idea on the list.** It creates a
daily habit the product currently only gets from the one blind question,
and it produces a genuinely new Mirror reading — your line against your
city's line — that no existing surface can fake. It is also the one idea
that collides with the schema's central invariant, so the design below is
mostly about *not* fighting that invariant.

**The invariant:** one answer per question per person is structural — the
answer doc id *is* the qid (`firestore.rules`, the world-answer arm), and
`delete` is closed. An over-time answer is not an edit (D86 moves a vote;
a series keeps every point), so it needs a different id.

**The design: copy the duel answers, not the bank.** Duel answers already
solve exactly this — a per-day answer doc `g_{gid}_{day}` whose id is
pinned in rules, day format validated, bounded to a −4d/+2d window of
`request.time`. A pulse answer is the same move:

- **One template doc in `v2_questions`** per pulse question (surface
  `pulse`), seeded like any content, options frozen by the D52 freeze,
  `active` as the whole-series kill switch. The template is what rules
  `get()` for the option bound and the kill switch, resolved from the
  answer's `baseQid` field the way duel rules resolve `gid`/`day` fields.
- **Answer docs `p_{qid}_{day}`** in the same answers subcollection:
  `{ qid: "p_mood_2026-08-14", baseQid, day, surface: "pulse", optionIdx,
  answeredAt, anchors }` — create-only per day, the duel day-window
  validation reused verbatim. No edit arm in v1 (duels and learn are
  create-only too; "you said what you said today" is defensible, and the
  edit arm's inactive-check has no per-day doc to read — a same-day edit
  window is a follow-on with its own rules work).
- **The aggregate trigger needs no changes.** `onV2AnswerCreated`'s vote
  branch never reads the question doc — rules did the validating — so it
  will fold composite qids into per-day aggregate docs
  (`v2_aggs_private/{qid_day}`, `v2_question_aggs/{qid_day}`) exactly as
  it folds everything else, anchors breakdown included. Per-day docs are
  the right grain anyway: a single growing series doc would fight the
  1 MiB ceiling *and* the egress bill (the published agg ships whole per
  delivery — `docs/COSTS.md`), where per-day docs stay the size of any
  question's.
- **What does need touching, each small and named:**
  - `firestore.rules`: the new answer arm (modelled on `isDuelAnswer`),
    plus `pulse` joining the readable-surface fences and the
    collection-group fence. Rules tests alongside.
  - `functions/src/velocity.ts`: `AGG_BANK_SIZE` is "one ledger entry per
    uid per bank question, ever" — pulse legitimately breaks that. The
    bound becomes `AGG_BANK_SIZE + pulseCount × scanWindowDays`, one line
    plus its test.
  - Client: serve today's instance (a small card by the daily — placement
    is a product choice; `feed-interleave.ts` and `deferQueue.ts` are the
    insertion patterns), and a **Trends reading**: your own series from
    your answers subcollection (an id-prefix range), the cohort series
    from the last N per-day agg docs — a bounded one-shot poll on the tap
    that asks for it, per D129/D124 discipline, with a costs line in
    `docs/COSTS.md` when it ships. An absent day-doc is zero, the
    absent-cell doctrine unchanged.
  - `check:content` / `check:quality`: the `pulse` surface's id shape and
    form rules. Editorial lane only at first.
  - The Map: exclude pulse answers in v1, the same "aims, not answers"
    boundary that keeps Foresight verdicts off it (D126). A family node
    with a sparkline is a nice follow-on, not a prerequisite.
  - Streaks: derived client-side from your own rows, the
    `data/foresight.ts` pattern — no server streak state.

**What NOT to build, recorded so nobody does:** minting a bank doc per
day. It reads simpler (every existing path works verbatim) and it is a
slow leak — the client fetches the bank whole under `BANK_LIMIT`
(`live.ts`) with `check:content` tripwires beneath it, and one daily
pulse question mints ~365 docs a year against a bank of ~510 today. The
composite-id design adds zero bank documents, zero cron, zero seed
changes.

**Mood specifically is its own decision, and should not block the
machinery.** Two things about "mood today" are owner calls:

- **The store forms move.** Health sits on the "not collected — leave
  unticked" list and `healthOrWellnessTopics` is declared `false`
  (`docs/STORE-FORMS.md`); a daily mood tracker is health/wellness data
  under both stores' definitions. Under-declaring is the direction that
  gets the app pulled, so shipping mood means flipping those rows
  honestly — `docs/data-inventory.md` first, forms with it, the D130
  discipline.
- **A public mood series is D98 at its sharpest.** Answers are public and
  that is the product — but a stranger reading one vote is not a stranger
  reading your last three weeks of lows. The consistent shape is: public
  like everything else, said plainly *at the mood card's first serve*
  (the `LivePrivacyPanel` bluntness rule applied at the moment it
  matters), plus a bullet in the panel itself. The alternative — an
  owner-only series — would be a fourth deny and a break in "answers are
  public" uniformity; possible, labelled, but it needs its own record and
  it dulls the Mirror reading that justifies the feature. Recommendation:
  ship the machinery with a **neutral first question** (something with no
  health reading — "cash or card today?" class), and make mood the
  explicit second step with the forms and copy done properly.

**Scores over time** decomposes into two different features:

- **History of results (cheap, near-term):** `testResults` is
  latest-wins in all three stores and rules-capped as a small map, so
  history goes in a create-only subcollection —
  `v2_users/{uid}/resultHistory/{stamp}` — written when the passive fold
  (`data/passiveProfile.ts`) changes a result materially. The
  `foresight` subcollection is the exact precedent (create-only,
  world-readable, swept by `deleteAccount`). Today a result only drifts
  via D86 edits and late axis fill-ins, so the line will be quiet at
  first; that is honest, not broken.
- **Longitudinal re-testing (later, on pulse):** create-only test answers
  mean scores converge and then freeze. Real "has your Big Five moved"
  needs items re-served as fresh per-period instances — the pulse
  machinery applied to the test surface, folded per era. Worth designing
  only after pulse has run for a while; it inherits everything above.

## 3 · Types — filter by who someone is, not one trait at a time

**The wanted thing:** other places filter people on single traits; the
interesting filter is the *combination* — the type.

**What exists (more than the request assumed):**
`src/v2/spec/archetype-data.js` — per-instrument named types with
signature vectors, share priors and a matcher that reports its own
decisiveness (`gap`); `type-marks.jsx` renders them; the result card
names your nearest type and near-misses. Two designed consumers are
sitting dark: `sameType` on the result card returns `[]` in live mode
because inventing people is refused (D1/D72) — real people are now
readable and nobody has pointed it at them; and `vote-cuts.js` (the
who-voted cut list) plus Explore's test-pole chips are the prototype's
type/axis cuts, with `docs/MIRROR.md` recording the exact reason they
are dark: *test results are not a dim.*

**Tier 1 — build now, no decision needed.** Everything reads data that
is already public and mostly already fetched:

- A **type chip** on people rows — Kindred, the similarity field's person
  card, the who-voted sheet. `parseTestResults` (`data/similarity.ts`)
  already fetches and defensively parses cross-user results; the chip is
  `IS_matchArchetype` over what it returns. Zero new reads — the D112
  property again.
- A **type filter** on the People lens: filter/rank the fetched people by
  matched type, with a "same type as you" shortcut — which is exactly the
  `sameType` surface coming alive on real people instead of staying
  refused.
- **Labelled bounds, not fake exactness.** Anything derived from voter
  lists inherits the D102 bounds (latest-N voters per question), so a
  "types like yours picked A" reading is presented with its basis ("of
  the last N voters here…"), the LiveSimilarityField honesty rules
  applied to a new consumer. Politics types get no special surface beyond
  what the profile already shows — see tier 2.

**Tier 2 — a real decision, written here so it is not drifted into.**
Making "how did each type answer this question" *exact* means the type
becomes a breakdown dim: stamped into the anchors snapshot at vote time,
folded by `BREAKDOWN_DIMS`. That amends a standing, user-facing claim —
"a test result is never a breakdown dim, so nothing is ever cross-tabbed
by it (D8)" appears in `docs/data-inventory.md`, the privacy panel and
the store filing — so it is D98-shaped: a considered position reversed
deliberately or not at all. If adopted:

- **Big Five archetype only, one new dim.** Its type count fits under
  `BREAKDOWN_MAX_BUCKETS` with room; four dims at once is cell bloat with
  no consumer. **The politics types stay out** — the politics result is
  Art. 9 data (`docs/data-inventory.md`), and slicing every answer by
  political type is the exact exposure D44 was about; D98 reversed D44 on
  the *items'* counts, not on cross-tabbing by result.
- **Forward-only, and say so.** Answers have never carried scores, so
  there is nothing to backfill; cells accumulate from ship date and the
  UI shows its `cohortN` like every D99 reading.
- The full new-dim recipe is §4's — same checklist, plus the
  `anchorsFrom` stamp reading the current match at vote time. The type is
  self-stated in the same sense every anchor is; rules can hold the
  vocabulary, not the truth of it.

**Recommendation:** tier 1 now — it is visible product with zero schema
motion. Hold tier 2 until tier 1 shows people actually pivot on types;
the Explore chips are the designed consumer waiting for it, so the
decision will have a concrete surface to argue from.

## 4 · The body — height yes, weight/BMI deferred, faces refused

**Height — build, as `heightBand`.** The pattern is settled three times
over: age is collected as a birth date and *banded* before it leaves the
device; the city is resolved on-device and only the name leaves
(`data/locate.ts`); the presence cell is a grid id, precision capped in
the rules' regex. Height is the same move — the Basics card takes
centimetres (or ft/in display), folds to a band, stores the band, and
the number itself never leaves the device. Bands are an owner call to
record with the decision (six-or-so covers the range; the vocabulary
must stay well under `BREAKDOWN_MAX_BUCKETS`).

The checklist for a new anchor dim, in full, because height would be the
first since launch and the next one (§3 tier 2) reuses it:

- `firestore.rules` `isValidV2Anchors` (the `hasOnly` key set) + rules
  tests;
- `functions/src/pure.ts` `BREAKDOWN_DIMS` + `BREAKDOWN_DIM_VOCAB` (+ the
  worst-case size comment's arithmetic re-run) + `pure.test.ts`;
- `src/v2/spec/profile-general.jsx` (the Basics card control +
  `anchorsFrom`), `src/v2/data/live.ts` `ANCHOR_FIELDS`;
- `src/v2/data/cohort.ts` `COHORT_DIMS` / `DIM_LABEL` /
  `MAP_ANCHOR_DIM` (+ its pinned test) — which also upgrades the Map's
  height reading from refused to real, the D99 move;
- `firestore.indexes.json`: an exemption for the new `anchors.*` path —
  **easy to forget and it silently regresses storage cost** (every other
  anchor path carries one);
- `scripts/check-anchors.mjs` keeps vocab and `<select>` equal — it is on
  the deploy path and will catch drift, which is exactly why the vocab
  must land in both places in one commit;
- `src/v2/ui/LivePrivacyPanel.tsx`: the bluntest sentence enumerates the
  anchors ("age band, gender, city, country, education and relationship
  status") and is pinned by a test — height joins the list, because a
  world-readable field the panel forgets to mention is the D116 failure
  class;
- `docs/data-inventory.md` anchors rows (snapshot + current), and a
  store-forms pass — a banded height in a public profile reads as profile
  content rather than Health data, but the review is owed, not assumed.

Missing-anchor behaviour needs no work: the fold skips absent keys, old
answers simply never join the height cells, and `cohortN` says what a
reading rests on.

**Weight / BMI — defer, and record why so it stays a decision.** Three
reasons, in descending order:

1. **Profiles are world-readable (D98).** A public weight or BMI band on
   every profile is a harassment surface pointed at exactly the people
   most likely to be hurt by it. The three surviving denies exist for
   safety reasons of this shape; adding body weight would either be
   public (bad) or mint a fourth deny (a real cost to the model's
   simplicity) — both are decisions, neither is a default.
2. **The store forms flip.** Weight/BMI is Health data under both
   stores' definitions; Health currently sits "not collected".
3. **BMI is a poor instrument** for the correlation the owner actually
   wants ("do people with different bodies answer differently") — height
   alone, self-reported and banded, gets most of that reading with none
   of the above.

If it is ever picked up: band-on-device only (raw kg never leaves,
the height pattern), its own decision record, forms moved in the same
PR.

**Facial symmetry — refuse, and this document recommends not revisiting.**

- It requires camera capture and face-geometry processing — biometric
  data in both GDPR and BIPA terms — in an app whose entire measurement
  posture is *coarse by construction* (bands, grid cells, city names).
  There is no coarse version of a face.
- "Photos or Videos: not collected" is a load-bearing store answer
  (`docs/STORE-FORMS.md`), and the sensitive-info row is already a
  careful Yes for the politics result alone.
- The symmetry→personality literature is weak to null; the app that
  refuses to fabricate a crowd should not ship a pseudo-measurement as a
  profile fact (D1's spirit, applied to input rather than output).
- Under D98 the reading would be world-readable — a face-scoring surface
  on every profile.

The legitimate itch behind it — "does appearance correlate with
answers" — is served honestly by height (§ above) and by one-time
self-reports (below), at a hundredth of the risk.

**Other one-time facts worth more than weight:** handedness, birth
order, first language — closed vocabularies, zero health reading, fun
cross-cuts. Each is the §height checklist minus the banding question.
(`chronotype` and star sign were collected once and retired from the
Basics card — read that removal's reasoning before re-adding anything of
that class.)

## 5 · Genetics — a horizon note, so it stays a decision and not drift

The owner already said "future, not now"; this section exists so the
"not now" is recorded with its reasons, the QUESTION-FARM convention.

Genetic data is Art. 9 special-category data of the most permanent kind
— it cannot be revoked, and it is never about one person only (relatives
share it). The current architecture has **no home for it**: profiles,
anchors and test results are world-readable by design (D98), and the
only non-public paths are three narrow denies. An acceptable genetics
feature would need a separately consented, never-public data tier with
its own erasure story — a different product posture, not an extension of
this one. If it is ever wanted, it starts as its own decision record
answering *why the everything-public model does not apply*, and nothing
about today's schema should be bent in anticipation.

## 6 · Suggest a question — the board is built; give it a server

**The wanted thing:** a user action that proposes a question — to whom,
what type, one-off or repeating — and a path from there to the banks.

**Verdict: build; it is the shortest distance to shipped value on this
list, and it feeds §1.** What exists: the composer + board UI
(`src/v2/spec/suggestions.jsx`, opened from the feed sheet), a seeded
demo store with statuses `review`/`picked`
(`src/v2/spec/suggestions.js` — "moderation is faked here" is its own
header's phrasing), dedup already scoring suggestion seeds against the
corpus (`check:neighbors`), purge wiring, and `community` as a
first-class provenance source in `promote-questions.mjs` and
`check:quality`'s provenance join. Zero community rows exist — the lane
was designed and never fed.

**v1 shape (the moderation pipeline's confinement pattern, reused):**

- `v2_suggestions/{uid_stamp}` — `{ prompt, type, options?, topicHint,
  audienceHint, cadenceHint, credit, status: "review", at, uid }`.
  Prompt bounded by the same measured cap `check:quality` holds for real
  questions; one doc id per (uid, stamp) like flags pin (take, user).
- Written by a callable (`suggestQuestionV2`): App Check enforced (D36 —
  `check:appcheck` will refuse it otherwise), per-uid daily cap via the
  `insight_ratelimits` sliding-window pattern, and the place-civic
  tripwire (`question-quality.mjs`'s `placeCivicHit`) run server-side so
  sold-inventory questions (farm hard rule 6) are declined at the door
  with an honest message rather than reviewed and dropped.
- **Reads: owner sees their own; the pool is server-only in v1.** A
  public voting board is a second UGC surface with the takes' moderation
  load; it is a follow-on decision, not the first ship. The board UI
  renders your own submissions' statuses meanwhile.
- **The human gate is the existing one.** A review pass (moderator-gated
  fetch callable, the `fetchModQueue` shape) surfaces the queue;
  accepted questions ride `npm run promote -- --source community` into
  the banks with a provenance row, through the same PR review as
  everything else. The suggestion is *input to* the editorial/farm
  lanes, never a write path into content — the two-gate design is the
  point, and it already anticipated this source.
- **"To whom / what type / repeating" are hints, not routing.** The
  composer collects them; the human gate decides. Place-scoped requests
  get the paid-path explanation (MONETIZATION.md); audience-*tagged*
  serving stays the recorded future direction it already is
  (QUESTION-FARM.md — tags on content, selection on device, never
  server-side per-user selection); `cadenceHint` routes a candidate at
  the pulse lane (§2) once that exists.
- **Credit is a decision to defer.** Printing "asked by @handle" on a
  live question is a new exposure with a retaliation shape (flag
  authorship is one of the three denies for a reason). v1: provenance
  records the source vintage; no public byline. Revisit with the public
  board.
- The usual arrivals: `docs/data-inventory.md` row (+
  `check:data-inventory`), `deleteAccount` sweeps own suggestions, rules
  tests, and an e2e in the moderation transport's discipline
  (`expectCode` on the specific refusal, not a bare try/catch).

## 7 · Order of work

1. **Suggestions v1** (§6) — no schema collisions, mostly existing
   patterns, and it starts the community flywheel the other lanes want.
2. **Current events on the feed** (§1) — small once §6 exists to feed
   it; the ongoing cost is editorial, so gate the ship on being willing
   to keep the topic alive.
3. **Height** (§4) — the first new anchor dim; exercises the checklist
   §3 tier 2 will reuse.
4. **Types tier 1** (§3) — visible product on data already public.
5. **Pulse machinery + one neutral pulse question** (§2) — the largest
   build; everything above is independent of it.
6. **Then decide, each with its own record:** mood as a pulse question
   (store forms + first-serve copy); result history; types tier 2
   (the D8 amendment); longitudinal re-testing.

**Not doing, restated:** facial symmetry; genetics under the current
posture; weight/BMI without its own record; current events on the daily
surface (blocked on an epoch-safe retire design D97 already names);
farm-authored current events.

## 8 · Rules that apply to all of it

- **New code is typed ESM** under `src/v2/data` / `src/v2/ui` — the
  shared-global ratchet (`check:globals` rule 4) only goes down, so no
  new feature may lean on the spec bridge.
- **Every new callable takes App Check** or argues its exemption in
  `check:appcheck`'s list (D36).
- **Every new collection or field lands in `docs/data-inventory.md` in
  the same PR** (D130), with the erasure path stated; if the UI claims a
  visibility, rules + a test make it true (the CLAUDE.md contract).
- **Anything that changes read/write volume gets a costs line**
  (`docs/COSTS.md`, D124's ceilings) — the pulse Trends read and the
  suggestion queue both qualify.
- **Store forms move with the data, in the same PR, or the data does not
  ship** — mood and weight are the two ideas here that touch them.
- **No invented anything** (D1): no seeded suggestion upvotes, no
  placeholder trend lines, no demo types on live people.
- This file quotes constants by *name* and cites the scripts that hold
  them; hand-copied figures are the documentation error this repo keeps
  re-committing (D39), and none of the numbers above should be trusted
  over the source named beside it.

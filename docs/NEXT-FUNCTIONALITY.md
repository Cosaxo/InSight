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
| Current events | **BUILT (D231)** | S–M | Daily questions cannot retire (positional deck; D97 records the gap). The feed already has `active:false` and a topic taxonomy. |
| Over-time ("pulse") questions | **Build — the strongest idea on the list** | L | One answer per question is structural (`aid == qid`). The duel answers' day-keyed id (`g_{gid}_{day}`) is the working precedent to copy. |
| Mood as the first pulse question | **Decide separately** | S on top | Mood tracking moves the store forms (Health is "not collected" today) and makes a public per-person series — both are owner decisions, not engineering. |
| Types focus | **Build tier 1 now; tier 2 is a real decision** | M / L | Tier 1 rides data that is already public. Tier 2 (type as a breakdown dim) amends the standing "a test result is never a breakdown dim" claim (D8, `docs/data-inventory.md`). |
| Height | **Build** — a banded anchor, the age-band pattern | M | Bands, never centimetres, server-side; the device folds and discards the number the way `locate.ts` folds coordinates. |
| Weight / BMI | **Defer, deliberately** | — | Anonymity does not rescue it (§4): the interesting reading needs a join to answers, and every join shape has a named structural cost. |
| Facial symmetry | **Refuse** | — | The anonymous variants fail the same trilemma (§4), and the measurement itself is junk on a phone camera regardless of where the result goes. |
| Genetics | **Refuse for now** (the owner already said "future") | — | Art. 9 data cannot live in a world-readable profile; an acceptable version is a separate consented tier, i.e. a different product posture. |
| Suggest a question | **Build — the shortest distance to value** | M | The UI, the dedup gate and the `community` provenance source all exist; what is missing is a collection, a callable and the human gate wiring. |
| Paid featured questions | **BUILT, and unsold (D195)** | S then L | Already the recorded primary revenue intent (`docs/MONETIZATION.md`). The machinery ships — disclosure band, one-card cap, on-device audience match, `until` window, `sponsor` provenance — with zero sponsored questions in the bank, because inventing a buyer is D1 pointed at money. The notes still refuse a *delivery* auction and precise targeting; a price auction over capped, disclosed slots survives both (§6) and is still a note. |
| Predictions (Foresight CALL) | **BUILT then RETIRED (D194 → D196)** | M | The blocker was never stakes or money — it is resolution integrity (D127). Tier A self-resolves on the app's own aggregates and the device re-grades it, and it turned out not to be the wanted game: a prediction is about the world. Retired in service, machinery intact, waiting on a real-event (tier B) design. |

## 1 · Current events — a category that stops being asked

**The wanted thing:** questions about what is happening now, which stop
showing up once they are stale.

*Status 2026-08-23: **BUILT** — D231 is the record. The `now` topic, both
window ends, the bounds, the CALL refusal, the farm exclusion, the card's
real ring and a first batch of six are live. Two things below did not
survive contact and D231 carries both: the archive bullet's surface no
longer exists (see the strikethrough note there), and `until` gained a
partner rather than staying one field.*

**Verdict: build it on the feed, not the daily.** The daily deck is
positional and epoch-based (`computeDeckIds`, `src/v2/data/deck.ts`) —
retiring an entry shifts every served day, which is why the daily lane
keeps tombstones (`src/v2/data/live.ts`, the `active !== false` comment)
and why D97 records "no epoch-safe retire lane for daily questions" as
deliberately not done. The feed has none of that: it already carries
`active:false` retirement (D52's shape), a topic taxonomy, and — since
D128 — per-topic Less/Normal/More preferences, so a user who hates news
could turn the tap down themselves. **D173 retired those levers** (the
algorithm decides how much, not a lever), so this argument now rests on
the feed's per-topic MUTE, which is untouched and still lets that user
switch the lane off entirely.

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
  change. **Not built, and not for want of trying (D231):** those rows
  read `LIVE.aggregated()` filtered to `coreCorpus`, which is the DAILY
  bank — a feed question has not been able to reach them since D161, and
  a windowed question is permanently non-core. The feed's own answered
  drawer cannot hold one either, because `fresh()` filters the bank at
  hydrate. The standing limit, and its priced fix, are in D231.

**Two boundaries, both already recorded elsewhere:**

- **An opinion about the news is content; a prediction is a CALL.**
  "Should X resign?" is an ordinary feed question. "Will X win on
  Sunday?" needs a sealed answer and a resolved outcome — that is
  Foresight's CALL half, designed in D127/`docs/FORESIGHT-CALLS.md` with
  the executable-rubric constraint, and it must arrive through that door
  or not at all. The current-events lane should refuse prediction-shaped
  prompts and point at the CALL design.

  **Predictions are designed in, and money was never the blocker** —
  worth stating because "why no predictions?" is a fair question with a
  non-obvious answer. Foresight READ is live (D126). What holds CALL is
  not stakes, gambling optics or anything money-shaped; it is that a
  resolved call is the one number in the app the reader cannot recompute
  — the app *asserting a fact about the world* — and a wrong or
  never-resolved outcome marks real users wrong with nothing to appeal
  to (D127's own words: an unresolved call takes the player's guess and
  never comes back). D127's answer is admission criteria, not refusal:
  **tier A** calls — self-resolving on the app's own published
  aggregates ("will tomorrow's daily split past 60/40?") — are graded by
  arithmetic, need no operator and no external source, and are
  **buildable today**; **tier B** — a machine-readable source with an
  executable rubric (`check:calls` dry-runs it before the question
  ships), VOID as a first-class outcome — is exactly how sports and
  news predictions arrive. If predictions feel missing, the honest next
  step is tier A now and the first tier-B rubric as the pilot for the
  current-events lane, not a relaxation of D127.
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

**Verdict: build. This is the strongest idea on the list.** *Status 2026-08-14: BUILT on this branch — D139 is the record. The machinery, the per-day fold, the card and the Trends reading are live with the neutral first question; mood stays the owner's store-forms decision.* It creates a
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

**Tier 1 — build now, no decision needed.** *Status 2026-08-14: BUILT — D141; the type-mix card is live on the People lens.* Everything reads data that
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
*Status 2026-08-14: the exact dim is still UNTAKEN, but the reading it was the price of now ships without it — D146 folds "how did each type answer this question" on the client, from the cached voter lists plus public `testResults`. It is a sample rather than a census and says so, and it has the one property the dim cannot have: it reads everyone's CURRENT type against answers they ALREADY gave, so the "forward-only, nothing to backfill" line below is exactly what it routes around. The two are complements — if the dim is adopted for exactness, the client fold stays for the history the dim can never see. The recommendation below is satisfied on its own terms: there is now a concrete surface to argue the dim from.*
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

**Does "anonymous" change the answer? (asked 2026-08-14, answered with
the mechanism rather than a repeated no.)** The value of a body
measurement here is the *join* — "do people with X answer differently" —
and an anonymous join has exactly three shapes in this architecture,
each with a named cost:

1. **On-device only, nothing leaves.** The ATTENTION.md tier-2 shape:
   legally quiet, store forms untouched. But it can produce no
   cross-user reading at all — the one thing the feature was for. It is
   a private toy, not a Mirror surface.
2. **Unattributed uploads** (no uid — the `v2_logic_norms` /
   ATTENTION tier-3 shape). To carry the join, the device would have to
   upload band×question×option tallies itself — and client-written
   counts are forgeable: no ledger dedup, no D28 ring-subtraction, one
   hostile device inflates any cell it likes. That breaks the one
   property `docs/MONETIZATION.md` names as the sellable asset — counts
   that are provably not fabricated. The logic histogram gets away with
   anonymity precisely because it never joins to anything.
3. **Attributed but denied** — a fourth deny (the presence-cell shape):
   the band lives on the profile where no user can read it, the server
   folds it into `by` cells, the app publishes the cross-tab without
   publishing anyone's band. Coherent — and it quietly re-orders D98:
   exact cells over a *secret* field deanonymize at small n (a
   three-person cohort with public voter lists narrows to persons),
   which is precisely the arithmetic the old k-floor existed for. D98
   could delete the floor because the underlying answers were public
   anyway; that argument does not cover a denied field, so this shape
   means rebuilding suppression machinery for one dimension.

So anonymity does not rescue these: shape 1 has no value, shape 2 has no
integrity, shape 3 re-imports the floor. For BMI, shape 3 is the
least-bad version if it is ever truly wanted — a large structural cost
for a crude instrument, which is why the verdict stays *defer*. For
faces, the trilemma is moot anyway, because the objections below attach
to the capture and the measurement, not to where the result is stored.

**Facial symmetry — refuse, and this document recommends not revisiting.**

- It requires camera capture and face-geometry processing — biometric
  data in both GDPR and BIPA terms — in an app whose entire measurement
  posture is *coarse by construction* (bands, grid cells, city names).
  There is no coarse version of a face.
- "Photos or Videos: not collected" is a load-bearing store answer
  (`docs/STORE-FORMS.md`), and the sensitive-info row is already a
  careful Yes for the politics result alone.
- The measurement is junk at the source, before the science is even
  reached: a selfie's symmetry score is dominated by pose, lens
  distortion and lighting — it measures the camera session, not the
  face. And the symmetry→personality literature is weak to null anyway;
  the app that refuses to fabricate a crowd should not ship a
  pseudo-measurement as an input (D1's spirit, pointed at collection).
- In the attributed version the reading would be world-readable under
  D98 — a face-scoring surface on every profile; the anonymous versions
  fail the trilemma above instead.

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
list, and it feeds §1.** *Status 2026-08-14: DONE end to end on this
branch — the v1 backend (D138) and, same day, the v24 board design
ported live: submissions ride the callable, "Yours" shows real
review/picked/declined states with the reviewer's note, refusals render
the server's own message, and the community lenses wear the preview tag
until a public pool is its own decision. The store came off the global
bridge with the port (coupling 417 → 415).* What exists: the composer + board UI
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

### The paid half — featured questions ARE the recorded business

**The wanted thing (added 2026-08-14):** the suggestion action doubles
as the revenue engine — pay to get a question featured, to a given
cohort for a given window, and read the data it produces; auction-like.

*Re-derived 2026-08-15 in [`SCALE-PLAN.md`](SCALE-PLAN.md) §5, against an
infinite feed and a per-cohort "attention budget" framing. Three things
came out of it that are not below: sell scheduled slots rather than
observed impressions (the feed's deterministic order makes inventory
computable without any telemetry, which `ATTENTION.md`'s cost rule
otherwise forbids); bill on **answers**, which already publish, so buyer
and seller and voter read one number; and buyable cohorts are exactly the
published breakdown dims, which excludes profession (D8) and the politics
result (Art. 9) with no special rule for either. It also adds a constraint
this section cannot state on its own — sponsored questions belong in the
tail, never the Mirror's core corpus.*

**Verdict: yes to the business — it is already the plan's primary
recorded intent — and most of the machinery is the sections above.**
`docs/MONETIZATION.md` names paid geo-insight as path 1 ("cities and
countries wanting to know their citizens", explicitly why farm hard rule
6 keeps that inventory from being given away) and sponsored questions as
path 2, designed with constraints recorded. The suggestion composer is
the natural funnel: the free path ends at the community gate, and "want
it asked prominently / to a place / this week?" is the paid door beside
it.

What the recorded notes already grant the buyer, post-D98, is more than
it sounds: the public window now includes the exact split, the full
per-anchor breakdowns and the named voter lists — everything a signed-in
user sees. "Collect the data you want" is therefore mostly *already the
default*; MONETIZATION.md's own framing is that a buyer pays for a
convenience over data they could read themselves. Packaging that public
data nicely (a report assembled from published numbers) sells the
convenience without crossing the line below.

Three recorded lines, and what each actually forbids:

- **"A buyer gets no read path a signed-in user does not have."** No
  private questions, no buyer-only export or API, no server-side report
  computed for one customer. This is the line `firestore.rules` can
  hold, and it is what keeps the honesty pitch alive with money in the
  room. It does *not* forbid selling placement, audience, timing, or
  off-platform packaging of public numbers.
- **"Priority is a bounded cadence, never an auction."** Read precisely,
  this refuses *auction-driven delivery* — bidding deciding what people
  see, the engagement dynamic the product defines itself against. It
  does not obviously refuse **auction-priced slots**: a fixed, capped,
  disclosed inventory (say one sponsored card per N in the interleave,
  one place-question per city per window) whose *price* is set by
  sealed bids. Delivery stays identical however much anyone paid; the
  bid only decides which buyer got the scarce week. If the owner wants
  the auction feel, that is the version to graduate into a decision
  record — reshaping the note knowingly, since MONETIZATION.md says
  picking up or reshaping any path graduates to DECISIONS.md.
- **Targeting and sponsorship must not compound.** "To a given group for
  a given time" lands inside this as: coarse, *disclosed* audience tags
  (the QUESTION-FARM audience-tags design — tags on content, selection
  on device, never server-side per-user selection) plus the same `until`
  window §1 builds for current events. A paid question is literally an
  ordinary question with a sponsor provenance row, a disclosure mark, a
  window, and at most coarse tags. Precise targeting is the refused
  compounding; and paid questions injected into private circles' duels
  is a different, worse thing this note recommends never doing.

**Sequencing, priced honestly:** the first buyer needs ~zero code —
MONETIZATION.md already records that a place-scoped question is an
ordinary question, arriving through a human contract path with
invoicing outside the repo. So: sell contract-path deals as soon as
there is traffic worth buying; the disclosure mark + `sponsor`
provenance + window/tag fields are the first real build (S, mostly §1's
machinery); a self-serve in-app purchase flow is the last build (L), and
commerce should stay on the web/contract side regardless — the app
displays disclosed content, it does not run a checkout.

## 7 · Order of work

1. **Suggestions v1** (§6) — no schema collisions, mostly existing
   patterns, and it starts the community flywheel the other lanes want.
2. ~~**Current events on the feed** (§1)~~ — **done, D231.** The
   ongoing cost is editorial and it starts now: the topic is live with
   six questions, the longest of which closes 3 September.
3. **Height** (§4) — the first new anchor dim; exercises the checklist
   §3 tier 2 will reuse.
4. **Types tier 1** (§3) — visible product on data already public.
5. **Pulse machinery + one neutral pulse question** (§2) — the largest
   build; everything above is independent of it.
6. **The paid path, in step with traction** (§6): contract-path deals
   need no code and can start whenever there is an audience worth
   buying; the disclosure mark + provenance + window/tag fields ride
   §1's build; self-serve commerce last. **Tier A Foresight CALLs**
   (§1) slot in whenever prediction appetite shows — they are
   self-contained.
7. **Then decide, each with its own record:** mood as a pulse question
   (store forms + first-serve copy); result history; types tier 2
   (the D8 amendment); longitudinal re-testing; auction-priced slots
   (the reshaped path-2 note); tier B CALLs for news predictions.

**Not doing, restated:** facial symmetry; genetics under the current
posture; weight/BMI without its own record; current events on the daily
surface (blocked on an epoch-safe retire design D97 already names);
farm-authored current events.

## 8 · The design handoff — what needs a designed visual, what does not

Split by whether the plan needs **new visual grammar** (design work
first, then a port) or only **new plumbing under existing grammar**
(build directly in the app's current language). Every designed surface
inherits the honesty rules the live bodies already carry: no invented
baselines or smoothing, absent = zero and the panel says so, every
reading shows the n it rests on, thin data is listed with its reason
rather than positioned, and demo texture never ships in a live body
(D1). One hue per instrument (`TEST_HUE`), inputs on the `--field-size`
token (D105).

**Needs design (in leverage order):**

1. **The pulse card and the Trends reading (§2)** — the only genuinely
   new grammar in the plan. The card: a compact daily-repeat beside the
   blind daily, blind-then-reveal like the daily, an answered-today
   state, a streak treatment. The reading: your series against the
   cohort's over the last few weeks — how a zero day draws vs a day you
   skipped, per-day n, and the two empty states that cannot be faked
   (day one: a dot is not a trend yet; a gap week). Where it opens is a
   design proposal too (a tab on the stop row vs the You stop), under
   the cost gate: a tab body exists only while open.
2. **Type chips and the People type filter (§3 tier 1)** — mostly
   arrangement, not invention: `TypeMark` (ring/slice/dots) already
   renders a type. Needed: the chip at row size, the filter row with
   per-type counts over the loaded people, the "same type as you"
   shortcut, the basis label (the D102 bound, e.g. "of the latest 200
   voters here"), and the empty-filter state.
3. **The sponsored/featured chrome (§6 paid)** — the recorded
   constraint is an *unmissable* disclosure mark; design the sponsored
   card frame, the window label ("asked for Oslo · this week"), and how
   provenance reads on the card. Worth designing early because every
   paid deal inherits it.
4. **Suggestion board live states (§6)** — the your-submissions view
   (in review / picked / declined with a reason), the composer's hint
   pickers (type · cadence · audience), the kind decline for
   place-scoped asks, and the paid door beside the free gate.
   **Delivered in standalone v24 and ported live 2026-08-14**
   (`design/standalone-v24/README.md` tracks the rest).
5. **Current-events chrome (§1)** — a "closes in N days" chip, the
   `now` kicker, and the archived "asked 12–19 Aug" label on answer
   rows. Small.
6. **Optional — the tier A CALL card (§1)**: sealed → resolved → VOID
   states, reusing the daily's blind-reveal grammar.

**Does not need design** (built directly in the existing language):
the height control on the Basics card (a number input + band preview in
the card's own idiom), and everything server-side.

Designs land in the claude.ai/design project and are ported here
deliberately, the prototype-vintage pattern (D113's partial v20 sync is
the precedent): live components are built typed under `src/v2/ui`
against the design — never as new spec-layer globals (the `check:globals`
ratchet).

## 9 · Rules that apply to all of it

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

## 10 · Near becomes the room — the settled design

**Status: design settled with the owner 2026-08-15. Step 1 of the build
order below is SHIPPED — see [D174](DECISIONS.md#d174--nears-visibility-gets-three-states-and-a-position-that-expires-on-its-own)
for the three-state control, the three-hour linger and the `until` cap.
Everything else here is still design.** It began
as *"when you are at a party or some sort of social event you can see what
type of persons are around you"* and was worked out over a long exchange;
what follows is where it landed, including the two places the owner
corrected me. It graduates to a `DECISIONS.md` record when the first slice
ships.

### What it is

At a venue you open Near and see the people around you — placed by how
like you they are — with the ones you match drawn closest. Tap one and the
card says who they are: face, age, gender, their type, their answers.
Underneath, the same three readings every other stop carries: **Answers ·
People · Compare**, over the room.

### The rule everything else hangs off

**Distance from the centre is UNLIKENESS, never position.** Same grammar as
City, Country and World. A dot near the middle means *this person answers
like you*, never *this person is standing near you*.

This already holds and is now enforced: `NearField` builds `kind="anon"`
nodes placed by `match`, and three cases in `ui/NearLiveBody.test.tsx`
fail if a label, a coordinate or a non-anon kind ever reaches it. The
tempting "improvement" here is exactly backwards — the app knows a grid
cell, so drawing people where they actually are would look like a feature
and would be the leak.

### What the card may carry — the owner was right and I was wrong

Face, age, gender, the four test results, answers. **None of it is
sensitive and none of it is new**: all of it publishes under D98 already,
and a face is the least secret thing about someone standing in a room.

My earlier objection — that attributes are a join key that turns a node
into "where this named person is" — **does not survive the rest of this
design.** It assumed a 3 km radius and one-way visibility. With a venue
radius and mutual visibility, the people who can see you are people you
can see, in a place you both chose to be. That is a room, not
surveillance.

**Images are a real subsystem, not a field.** The app holds no photos at
all today (avatars are initials and a hue), so this needs Storage rules,
an upload path, and image moderation — which carries legal obligations and
is the reason it is LAST in the build order. Initials stay the fallback
for anyone without a picture, permanently.

### Distance and recency are BANDS, not numbers

The owner floated a 20 m–1000 m slider. The prototype already answers this
and the prototype is right: v28 uses verbal bands — *"a few streets away"*,
*"in the neighbourhood"*. Two reasons to keep it that way:

1. **A metre figure is a promise the sensor cannot keep.** Phone GPS is
   ±10–50 m outdoors and much worse indoors, and at a party you are
   indoors. A slider reading "20 m" would be inventing precision, which
   is the one thing this app does not do.
2. A radius control is a **filter**, not a privacy setting — the server
   holds your cell whatever the slider says. Putting it next to privacy
   copy would imply otherwise.

Bands to draw, tightest first: **same room · same block · a few streets
away.** Recency gets bands too — **"here now" · "here in the last hour"** —
and that second one is doing real work, see the linger below.

### Visibility: off · 2 hours · always

The owner's three-state control, and the shape that makes the always
option safe enough to offer honestly rather than grudgingly:

| State | What it means |
| --- | --- |
| **Off** (default) | No presence doc. Turning off **deletes it immediately** — that promise may never be on a timer. |
| **On, 2 hours** | Default when first enabled. The beat stops at the deadline. |
| **On, always** | No deadline on the SETTING. Not "my position never expires" — see the linger. |

Two properties hold in every state:

- **Mutual.** You are in other people's field only while they are in
  yours. The prototype already says it: *"nobody nearby sees you, and the
  field comes back empty for you too."*
- **Foreground only.** Presence is written while the app is open. Today
  this is true by accident — the interval has no `document.hidden` guard
  and the platform's background throttling is what saves it. **Make it
  explicit**, because it is what lets "always" mean "whenever the app is
  open", which is a small enough claim to stand behind.

### The linger, which is what makes it work at all

**Your position must outlive the app being open.** Everyone's phone is in
their pocket; if presence existed only while the app was foreground, you
would open Near at a party and see an empty room, because everyone else's
app is shut. The feature would be dead on arrival. Find My and Snap Map
keep a last-known position for exactly this reason.

The machinery exists: `PRESENCE_TTL_MIN` (10 today) is the server's
freshness window, so the linger is **one constant**.

**Set it to about 3 hours**, per the owner's "slightly longer" — long
enough that a venue stays populated between pocket-checks, short enough
that closing the app in bed does not leave you at home all night. It is
one number and should be re-tuned from real use rather than defended.

**"Always" does not lift the cap.** It removes the deadline on the
setting, not the expiry on the position. Unbounded lingering is the one
version that is genuinely bad, and nobody asked for it.

**Staleness is shown, not hidden — and it is a safety property, not an
apology.** The app knows where you *were*, so it says so. A blurred WHEN
protects as well as a blurred WHERE: the smear that keeps a party
populated is the same smear that makes a trail unreadable. Product need
and safety point the same way here, which is rare enough to build
deliberately.

### The radius, and the one cost it carries

**Done at D175.** The grid was 0.01° ≈ 1.1 km per cell, so "around you"
was ~3.3 × 1.8 km — a district, and the owner was right that it is not
"near". It is 0.002° now (~222 m), and the 3×3 neighbourhood is ~670 × 330
m in Oslo. The paragraph below is why it could not be done sooner and is
kept as the reasoning, not as a pending item.

**The consequence to state plainly:** a finer grid means the server holds
a more precise location. That is acceptable — `v2_presence` is
`allow read: if false`, no client ever reads a cell, and the only path out
is a count or an aggregate — but it raises the stakes on that deny, and it
changes `docs/STORE-FORMS.md`'s location answer to a precise one. Both
belong in the shipping commit.

### The room reading, and its two engineering problems

The composition — *"mostly Hosts and Explorers"* — is an aggregate the
server folds from presence uids joined to world-readable `testResults`. It
returns a summary; no identities leave.

1. **A floor on the MIX, not on the count.** A composition that moves as
   people arrive tells you an individual's type by subtraction. At n=8 one
   arrival shifts a share 12 points. So: a minimum before the mix draws at
   all, coarse words rather than exact shares, and no on-demand refresh —
   it rides the beat, so an attacker's sampling rate is the app's.
2. **The cost re-imports what was deliberately removed.** `nearbyCountV2`
   was changed FROM a document read TO a `count()` because a dense cell
   charged (people) × (beats) — *"quadratic in exactly the situation the
   feature is for. A festival is the worst case and the one it is built to
   serve."* A mix needs documents. Fix: a per-cell cached result
   (`v2_presence_mix/{cell}`, server-written, unreadable like presence),
   so the first caller in a window pays the fold and everyone else pays
   one read. Measure into `docs/COSTS.md` before shipping.

### The tabs

**Answers and Compare read the room** — how this crowd answered, against
you — through the same callable and the same floor. **People is fine here
now**, which reverses what I argued earlier: at venue scale with mutual
visibility, a people lens is a room you are standing in, not a directory
of strangers.

### Build order

1. ~~**The three-state control, the foreground guard, the ~3 h linger.**~~
   **DONE (D174).** The foreground guard turned out to exist already —
   `presenceBeat` returns early on `document.hidden`. What shipped beside
   the control and the linger is `until` on the presence doc, so the timed
   option is exact rather than approximate, capped in `firestore.rules`.
2. ~~**The finer grid** + the `STORE-FORMS.md` re-answer.~~ **DONE
   ([D175](DECISIONS.md#d175--near-asks-for-a-precise-fix-so-its-radius-can-be-honest)).**
   It was not a constant: the old ~1 km cell was the ceiling of the COARSE
   fix the app requested, so the grid could only move once the permission
   did. Precise on both platforms, 0.002° (~220 m) cells, Precise Location
   ticked — and the grid picked to sit one step ABOVE Apple's own precise
   threshold, so nothing precise is retained.
3. ~~**The room aggregate** (floor first, then the cache, then the reading).~~
   **DONE ([D176](DECISIONS.md#d176--near-becomes-a-room-and-the-phone-says-what-it-is)).**
   The phone writes its own archetype NAME into its presence doc, so the
   server folds a mix without ever holding the archetype table or joining a
   profile. Ranked names and a basis, never a share; `ROOM_MIN_TYPED` = 8;
   cached per cell per beat window, which is what keeps the fold from being
   quadratic in crowd density (COSTS Finding 5).
4. ~~**The tabs.**~~ **DONE
   ([D177](DECISIONS.md#d177--near-becomes-a-room-you-can-read-and-asking-requires-standing-in-it)).**
   Answers · People · Compare over `nearbyRoomV2`, which refuses any caller
   without a live position of their own in that neighbourhood — the gate
   went on the count as well, and it is what makes a roster defensible
   (your own room only, and mutual by construction). Explore and Scores are
   absent on purpose: neither has data at this stop. Three on-screen
   promises that the People tab made false were rewritten in the same
   commit.
5. ~~**Images** last — the field works with initials from day one.~~
   **DONE ([D178](DECISIONS.md#d178--the-app-gets-a-face-and-it-is-reported-like-anything-else-somebody-says)).**
   One object per account at `avatars/{uid}`, shrunk and re-encoded on the
   device (which drops EXIF), a token rather than a URL in Firestore so the
   field can never name a host we do not control, and the SAME report loop
   takes use — the owner's call over reviewing a photo first. Shows
   anywhere a name shows, not only in the room. `deleteAccount` reaches
   Storage for the first time; "Photos or Videos" leaves the not-collected
   list.

**§10 is complete.** What it does not cover, recorded so it is a decision
rather than a gap: nothing rate-limits how often one account replaces its
photo (COSTS Finding 7), and there is no automated image classification —
a reported face waits for the same human/AI run a reported take does.

# Feature-complete — the open work, in one place

**Status: plan notes — an index, not an authority.** Compiled 2026-08-19
from the plan and mixed documents plus the gates' own live output. Every
row cites the file that is canonical for it; if this page and that file
disagree, the file is right and this page is stale. Nothing here adopts
anything — a row marked *proposed* binds nothing until the owner records
it in `docs/DECISIONS.md`, and a row marked *decided* only repeats the
record it cites.

How to read the tags: **decided** — a binding record exists and only the
build is missing · **trial** — adopted on trial (D166) · **blocked** —
decided, gated on a stated precondition · **proposed** — a plan
document's recommendation, not approval · **ratchet** — directional debt
with a gate and no deadline.

## 1 · Algorithm work

The Patterns engine is the largest single item, and D167 makes it a
gate: the tab does not ship, in trial or otherwise, until the fold
exists. Since D265 the tab holds itself to a stronger version of the same
rule at runtime — it is not in the bar until the fold has published
enough to draw.

- ~~**The co-occurrence fold**~~ — **done 2026-08-19**
  (`functions/src/patterns.ts`): a nightly streaming rank-K fit over the
  agg-events ledger — deliberately OFF the hottest write path — folding
  the core corpus only into one public loadings doc, cost-measured into
  [`COSTS.md`](COSTS.md) before it shipped. The deploy that turns it on
  is the standing europe-west1 deploy (D201).
  [`VISION-V28.md`](VISION-V28.md) §2, §13.
- ~~**Device-side similarity and placement**~~ — **done 2026-08-19**
  (`src/v2/data/patternsMap.ts`): cosine over 2K floats, position from
  the first two components plus the prototype's spring/declutter passes,
  pure and deterministic — O(questions), tested without a device.
  [`VISION-V28.md`](VISION-V28.md) §2.
- ~~**The exact 2×2 pair read**~~ — **done 2026-08-19**
  (`PATTERNS.say`): one exact table per pair on screen, both voter
  samples bounded and intersected on the device, basis stated on the
  card, session-cached; silent under 12 people in both samples.
  [`VISION-V28.md`](VISION-V28.md) §2.
- ~~**The Oracle**~~ — **done 2026-08-19** (`data/patterns.ts` +
  `ui/PatternsTab.tsx`): device-side ridge estimate over the published
  loadings, guess **sealed and persisted before the options render**
  (`patterns.test.ts` pins it the way `surface` pins the duel seal),
  graded in surprisal bits through the ordinary vote path.
  [`VISION-V28.md`](VISION-V28.md) §2.
- **The on-device interest model** (decided, D163 — binding, not built,
  and load-bearing since D173: the tail cannot ship without it):
  per-topic weights from signals the device already stores
  (`insight.feedPass.v1`, defer, readRoom, votes), ordering the **tail
  only**, shown to the user and editable with a reset, never leaving the
  device — plus the test that the daily's selection and the Mirror never
  read it, or the constraint rots.
  [`SCALE-RUNBOOK.md`](SCALE-RUNBOOK.md) Phase 5,
  [`ATTENTION.md`](ATTENTION.md) §3.
- ~~**Trait web / "what moves together"**~~ — **done 2026-08-19**
  (`data/traitLinks.ts` + `ui/TraitWebCard.tsx`, lazy on the profile's
  General panel): the eleven authored cross-test threads checked against
  the viewer's OWN results — live from `LIVE.myTestResults`, demo from
  the design's persona, and NOTHING under four resolvable pairs. No
  reads, no collection, outside Art. 9's scope by construction.
  [`VISION-V28.md`](VISION-V28.md) §13.
- **Measure-and-retire** (decided, D162 — blocked on traffic): wire the
  scorecard's evenness measurement and retirement proposals to
  `active: false`, feed surface only.
  [`SCALE-RUNBOOK.md`](SCALE-RUNBOOK.md) 3.4.
- ~~**Pulse cadence arithmetic**~~ — **done 2026-08-19** with the roster
  (v28 §11 step 3): the cadence store, the "not scheduled" clause, and
  the feed interleave all landed. [`VISION-V28.md`](VISION-V28.md) §3.
- **Foresight's remaining vocabulary** — reframed by D196, which this
  entry predated: the owner recorded that predicting the app's own
  numbers is "a different game and not the wanted one", and every tier-A
  call ships `active: false` (`content/call-questions.json`'s own status
  says so). New tier-A names would grow an inactive bank; the real open
  item is tier B (`kind: "fetch"` rubrics against real events, their
  dry-run gate arm, the human-exceptions console) — an owner-decision
  design, not backlog. [`FORESIGHT-CALLS.md`](FORESIGHT-CALLS.md) §3,
  §11; D196.

## 2 · Question generation

Targets live in the budget scripts, deliberately not here — run them for
the live figures: `node scripts/farm-budget.mjs`,
`scripts/feed-budget.mjs`, `scripts/learn-budget.mjs`.

- **Refill the daily pen**: the unpromoted archive is the promotion
  buffer and runs against `PEN_TARGET` in `scripts/farm-budget.mjs`;
  promotion carries a weekly floor (D30) and a catch-up target while the
  pen has stock (D97). [`QUESTION-FARM.md`](QUESTION-FARM.md).
- **Grow the feed bank**: every topic is brought to `TOPIC_FLOOR`
  (`scripts/feed-budget.mjs`) first, and above it the budget follows
  demand with no ceiling (D342) — vote, dial, field, path and rank count
  as servable; duel-type cards do not. The lane is scheduled daily
  (D145, D213) and producing — the majority of feed provenance rows now
  read `farm`; `npm run feed:budget` prints the live split. What is
  still owed: the demand share waits on a crowd the scorecard does not
  yet credit enough of, so the lane levels blind until it does.
- **Fill the learn fields**: every field short of `FIELD_TARGET`
  (`scripts/learn-budget.mjs`), with the minimum-chunk and spread rules
  (D115).
- **Grow the tail** (decided, D161): once review throughput rises, new
  feed questions default `core: false` — the tail is the thing being
  grown, and its first content is what triggers the Mirror-side filter
  work in §3 below. Volume points at the feed surface only: daily
  questions cannot retire (D97's open gap).
  [`SCALE-RUNBOOK.md`](SCALE-RUNBOOK.md) Phase 4.
- **Review at volume** (decided, D162 — half blocked): batch approval —
  human on the merge, not the reading — is buildable now and is what
  unblocks raising the farm budget; the sampled-audit rate is a starting
  figure, not a measured one. [`SCALE-RUNBOOK.md`](SCALE-RUNBOOK.md)
  Phase 3–4.
- **The catalog lane's blocked half** (decided, D14/D15 — narrowed at
  D232, again at D266, 2026-08-23): the pick surface is LIVE for every
  committed domain (23 cards, `content/pick-questions.json` — the
  pokemon six joined when the owner cleared the nominative-use check).
  The network half of this blocker is **gone**: the policy was widened,
  `query.wikidata.org` answers 200 from a session, and the D15 operator
  run committed `public/films.txt` (D266). What remains is one domain
  and it is no longer an errand — **artists** was generated by the same
  run and refused on content: sitelink rank plus Wikidata's P106 yields
  a canon of famous people who once touched music (Leonardo da Vinci
  2nd, Goethe 3rd, Mother Teresa 20th; 21% of 971 rows carry no
  recording-artist property at all), and the obvious narrowing still
  seats Chaplin 3rd. D266 carries the arithmetic and the three routes
  out; **D267 took one** — a measured mechanical rule plus a reviewed
  exception file — and shipped it with the exception file empty,
  because no predicate over Wikidata separates "famous for music" from
  "famous, and also made music", so the last names are a judgement and
  the judgement is the owner's. What is owed for artists is now a
  ruling over `--review-list 300`, then the build. Films' archive cards
  and `npm run promote` are the remaining step for the domain that did
  land.
  [`CATALOG-QUESTIONS.md`](CATALOG-QUESTIONS.md).
- ~~**Pulse templates**~~ — **done 2026-08-19** with the roster commit:
  `content/pulse-questions.json` carries all five (pace, energy, sleep,
  focus, social) through the ordinary content gates.
  [`VISION-V28.md`](VISION-V28.md) §3.
- **Event topics** (proposed only): `content/event-topics.json`, the
  discussion-window rules arm, the feed card, editorial first topics,
  then a farm lane with its two new rules (a named published source
  found by searching, never memory; personal angle, honest `political`
  flag). No code exists; building any phase graduates to a decision.
  [`EVENT-DISCUSSIONS.md`](EVENT-DISCUSSIONS.md).
- **Standing constraints**: no place-scoped civic questions from any
  lane (paid inventory — hard rule 6); `rates:` questions are editorial
  only (D187); sponsored content is tail-only and never farm-written
  (D195). [`QUESTION-FARM.md`](QUESTION-FARM.md).

## 3 · Data structures and scale

D161–D164 are the frame; [`SCALE-RUNBOOK.md`](SCALE-RUNBOOK.md) is the
ordered list. Open, in its order:

- **The core/tail enforcement half** (decided, D161 — lands with the
  first tail content, not before): write the filter placement down per
  call site (cohort folds read core only; a person's own answers are
  always all of them), extend the fold filter beyond `LiveCohortBody` to
  the similarity fields and Kindred, and add the test that a non-core
  aggregate never reaches a Mirror stop. `LiveCircleBody` stays
  unfiltered on purpose. Never ship the interest model before this.
  [`SCALE-RUNBOOK.md`](SCALE-RUNBOOK.md) 2.1, [`MIRROR.md`](MIRROR.md)
  preamble.
- **The core-size ratio gate** (decided, blocked on population): core
  may grow only as fast as the audience that fills its cohort cells — a
  `check:quality` gate once there is a population to measure against.
  [`SCALE-RUNBOOK.md`](SCALE-RUNBOOK.md) 6.1.
- ~~**IndexedDB bank cache**~~ — **built 2026-08-26 (D312)**: the bank,
  aggregate and answers caches all moved to rows in `data/cacheStore.ts`
  in one pass, the quota instrument shipped first (a swallowed
  `insight.*` write now counts and the first quota failure reports), the
  purge reaches the new store from both paths, and `check:purge` grew
  the predicate that holds it. What remains open on that page is §4's
  sharding design, shelved on the contention alert; the feed-vote mirror
  stays in localStorage until the spec-layer conversion (the recorded
  deviation). [`ANSWER-SCALE.md`](ANSWER-SCALE.md) §2, D312.
- **Cost-model measurement debt** (decided; needs a week of real usage):
  measure the guessed inputs in `scripts/cost-arith.mjs` — bgCycles,
  onlineMin, the three D98 open rates — and re-run the write-contention
  versus read-crossover tie. [`COSTS.md`](COSTS.md) § the walls.
- **Recorded, deliberately not built** (D7 discipline — build on
  evidence, not in advance): sharding the shared daily aggregate counter
  (the first wall — the 2026-08-03 record's design predates D98 and is
  re-derived buildable in [`ANSWER-SCALE.md`](ANSWER-SCALE.md) §4); the
  who-voted page-two cursor; incremental
  `setFollowing`; the presence cache-miss threshold and the coarser room
  cache key; an avatar-overwrite rate limit; the CDN question; the
  graded breaker `mode` field, which needs an owner decision about what
  a degraded app *says* before it can be built. [`COSTS.md`](COSTS.md).
- ~~**The eager-bytes door**~~ (v28 §5) — **open 2026-08-19 (D207)**:
  Patterns arrives through `React.lazy` in `app-shell.jsx`, and the Map's
  seven modules left the eager list for `loadMapTab()` the same day
  (eager 890 → 849 KB, `MAX_EAGER_KB` 920 → 860). The three parked
  features — Crossroads' `mapTree`, the Foresight map branch, the pulse
  branch — now grow inside the lazy map chunk; building them is the next
  item. [`VISION-V28.md`](VISION-V28.md) §5.
- **The bridge migration** (ratchet, D39): `check:globals` rule 4 only
  moves down; the v28 tweak teardown is the next large lump of it, and
  `passive-progress.js` / `test-definitions.js` still want to become
  typed, tested `data/` modules. Expect conversions to raise the lint
  suppression count before lowering it (D108). Run the gate for the live
  figure. `src/v2/README.md` § Migration path.
- **Cost lines that move before their features ship**: the Patterns fold
  and the five-pulse roster each get a [`COSTS.md`](COSTS.md) line
  first. [`VISION-V28.md`](VISION-V28.md) §13.

## 4 · Feature surfaces

The v28 build order ([`VISION-V28.md`](VISION-V28.md) §11) is most of
this, and no owner decisions are left in it — D166 cleared two and D168
refused the third.

1. ~~**The small pass and type-mix**~~ — **done 2026-08-19**: the nine
   corrections landed in one commit (the `daily-split` drag guard was
   already shipped in stronger form via `OWNS_X`), and the type-mix
   switch landed with the Art. 9 scope honoured — the three non-Big-Five
   positions state the type-index sheet's refusal, since the prototype's
   measured-everywhere version needs a decision the plan did not name.
   §7, §8.
2. ~~**The tweak teardown**~~ — **done 2026-08-19**: ten flags left
   `TWEAK_DEFAULTS` (the other nine were already absorbed), the ratchet
   came down with it. §10.
3. ~~**The pulse roster**~~ — **done 2026-08-19**: five pulses with the
   cadence store and the fourth honest-absence clause, the cards riding
   the feed's own interleave (the D139 pinned block retired), the Health
   row re-answered in the same commit with the four templates, the
   data-inventory row and the COSTS line. §3.
4. ~~**Patterns**~~ (trial, D166 §1) — **done 2026-08-19**: the tab
   shipped in the ordered shape — fold first, then the typed store
   (`data/patterns.ts`, seal pinned in its test) and map arithmetic
   (`data/patternsMap.ts`), then the Map and Oracle lenses
   (`ui/PatternsTab.tsx`) behind `React.lazy`; `CLAUDE.md`'s opening
   sentence and the near-end exit landed in the same commit, and the
   pair card fetches ONE exact 2×2 per selection (the plan's own
   singular phrasing; widening is one line if the trial earns it). §2,
   §11. **Unmounted for the v1 release (D217)** and **back on a data
   gate (D265)** — `data/patternsReady.ts` decides whether the tab is in
   the bar at all, from what the fit has published and what the viewer
   has answered. The trial is resumed, not verdicted.
5. ~~**The Map's parked branches**~~ — **done 2026-08-19 (D207,
   amended)**: `g-paths` leafs finished walks under the card's own
   live/demo source discipline, `g-fore` folds the READ log and tier-A
   calls (sealed until an outcome publishes, no invented "better than
   most"), the pulse branch leafs answered pulses with `ui/PulseTrends`
   as the leaf card, and `window.goTrends` became the typed take-once
   `data/mapCue`. All inside the lazy map chunk. §5.
6. **Every v28 item ships with a `smoke-live` case** (D167) — audited
   2026-08-19 with §11 complete: the pulse roster and Patterns carry
   dedicated live cases, type-mix pins its switch at the component and
   rides the Mirror walks, and the Map branches are the fold-test +
   mount pair D207 records (the map ground does not render in jsdom).
   Standing rule for anything v28-shaped that ships later. §13.

Beyond v28, still open on the Mirror ([`MIRROR.md`](MIRROR.md)):

- **Groups' trait axes and "how they see you" crowns** — unbuilt rather
  than refused since D98; pure backlog.
- **Answers' "newest" ordering** — refused until something the client
  holds dates an answer; the row prints a count where the prototype
  prints a date.
- **Cross-user surfaces not yet pointed at `data/voters.ts`** — missing
  because nobody wired them, not policy.
- **Foresight has no surface** — engine, verdict rules and tests all
  stand; D136 removed the lens-row placement and the feed is the named
  next home. The READ game gates itself on pool size and ships when real
  data satisfies it (D196); real-event calls stay parked as a new rubric
  `kind` on the surviving substrate.
- **The suggestion board's community half** — still *Preview · sample
  suggestions*; belongs to the suggestions work (D138), not to v28.
- **Rank questions** — out of the live feed until answers can carry an
  order (D12).
- **The romantic duel deck** — seeded `active: false` until its client
  ships (D40).

Proposed only, each awaiting its own record
([`NEXT-FUNCTIONALITY.md`](NEXT-FUNCTIONALITY.md) §7): the
current-events feed topic with its `until` window · result history ·
types tier 2, the D8 amendment · longitudinal re-testing · a same-day
pulse edit window · anonymous attention rollups and the wider
engagement ladder ([`ATTENTION.md`](ATTENTION.md) tier 3, generalized by
[`ENGAGEMENT-PLAN.md`](ENGAGEMENT-PLAN.md) — its rung 0, the server-side
digest, was decided **and built** at D268; the collecting rungs 1–2 stay
proposed) · auction-priced slots · the
community board and bylines. None of the rest binds anything yet.

## 5 · Flips and soft-shipped gates

Each of these is built, tested and deliberately off; feature-complete
includes flipping them, and each has its own runbook.

- **Device-bind enforcement** (D29/D37): the native token bridges on
  both platforms, the console setup, the staging probe, `minBuild`
  raised first, then the two 24-hour rates, then the one-word rules
  flip. [`DEVICE-BIND.md`](DEVICE-BIND.md).
- ~~**The k-floor restore**~~ (D81) — **struck: there is nothing to
  restore.** This row said the paused constants go back to five at launch
  traction. **D98 removed the floor outright** on 2026-08-11, not
  temporarily: `AGG_MIN_N`, `PUBLISH_EVERY`, complementary suppression and
  `tooSmall` are gone, and `docs/data-inventory.md` says so in those words
  ("D81's pause was superseded rather than resumed"). MONETIZATION.md and
  LAUNCH-RUNBOOK.md each carry that correction; this row did not, so it
  survived as an instruction to reinstate the exact limit D98 was written
  to delete. Struck rather than deleted, per D106's rule that a reversal
  must stay visible. D327.
- **Moderation advisory mode** (D22): `MOD_ADVISORY` flips on a cited
  track record.
- **App Check on the data plane**: register, soak to near-100% verified,
  then enforce Firestore and Storage — the only lever against the
  unmetered read path, and it cannot be armed during an incident.
  [`COSTS.md`](COSTS.md) § controls.
- **The europe-west1 functions deploy** (D201): deploy, confirm the old
  region is empty — while both exist every answer folds twice — then the
  client build that calls it.
- **Production environment protection and the two loosened controls**
  (D87/D117), with the notification mechanism D117 names as the open
  half.

The remaining human steps to the store — screenshots, forms, TestFlight,
submission, the post-deploy ops toggles — are
[`LAUNCH-RUNBOOK.md`](LAUNCH-RUNBOOK.md)'s list and are not repeated
here.

## 6 · Decided no — do not re-plan

The Arena (dropped, D166 §2) · Born-or-built (refused, D168) · facial
symmetry and genetics under the current posture · weight/BMI without its
own record · current events on the daily surface · Explore at City or
Country (D152) · Near, Circle and Groups' missing lens tabs (structural)
· `MapStats`' five null anchors (D8/D72) · per-topic interest levers
(D173 — the algorithm owns "how much") · auction-**delivered** ads, any
private data back-channel, per-user targeting, consumer tiers
([`MONETIZATION.md`](MONETIZATION.md) § ruled out).

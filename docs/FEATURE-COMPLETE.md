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
exists.

- **The co-occurrence fold** (trial, D166 §1 + D167): a Cloud Function
  on the existing aggregate trigger publishing a per-question loading
  vector (K ≈ 8) — a streaming rank-K fit over the vote log, folded over
  the **core corpus only** (D161). No document today carries
  P(answer j | answer i); both Patterns lenses need it. Cost-measure it
  into `docs/COSTS.md` **before** building — that trigger is the app's
  hottest write path. [`VISION-V28.md`](VISION-V28.md) §2, §13.
- **Device-side similarity and placement**: cosine over 2K floats,
  position from the first two components — O(questions), honest at any
  bank size. Rides the fold. [`VISION-V28.md`](VISION-V28.md) §2.
- **The exact 2×2 pair read**: the "pick this — and 78% pick that" line
  is one exact table fetched for the pair on screen, never a pairwise
  matrix. Its read path is designed with the fold.
  [`VISION-V28.md`](VISION-V28.md) §2.
- **The Oracle** (trial; build second): naive-Bayes posterior over the
  same published fold; the guess is **sealed before the options are
  tappable** and surprisal in bits is the score. The seal gets a test
  the way `surface` pins the duel seal. [`VISION-V28.md`](VISION-V28.md)
  §2.
- **The on-device interest model** (decided, D163 — binding, not built,
  and load-bearing since D173: the tail cannot ship without it):
  per-topic weights from signals the device already stores
  (`insight.feedPass.v1`, defer, readRoom, votes), ordering the **tail
  only**, shown to the user and editable with a reset, never leaving the
  device — plus the test that the daily's selection and the Mirror never
  read it, or the constraint rots.
  [`SCALE-RUNBOOK.md`](SCALE-RUNBOOK.md) Phase 5,
  [`ATTENTION.md`](ATTENTION.md) §3.
- **Trait web / "what moves together"** (trial): a pure fold over the
  viewer's own test results; no reads, no collection — the cheapest real
  feature in the v28 file. [`VISION-V28.md`](VISION-V28.md) §13.
- **Measure-and-retire** (decided, D162 — blocked on traffic): wire the
  scorecard's evenness measurement and retirement proposals to
  `active: false`, feed surface only.
  [`SCALE-RUNBOOK.md`](SCALE-RUNBOOK.md) 3.4.
- **Pulse cadence arithmetic** (decided, D166 §3): five pulses × per-day
  docs, a cadence store, the fourth honest-absence clause ("not
  scheduled"), and the feed interleave — one card in four, no tray.
  [`VISION-V28.md`](VISION-V28.md) §3.
- **Foresight's remaining vocabulary** (open by design): new tier-A test
  names — "will these two slices disagree", "will turnout beat
  yesterday", "will the leading option change" — are unblocked design
  work. Tier B (`kind: "fetch"` rubrics, their dry-run gate arm, the
  human-exceptions console) is the live question, and shipping A alone
  forever is a legitimate end state.
  [`FORESIGHT-CALLS.md`](FORESIGHT-CALLS.md) §3, §11.

## 2 · Question generation

Targets live in the budget scripts, deliberately not here — run them for
the live figures: `node scripts/farm-budget.mjs`,
`scripts/feed-budget.mjs`, `scripts/learn-budget.mjs`.

- **Refill the daily pen**: the unpromoted archive is the promotion
  buffer and runs against `PEN_TARGET` in `scripts/farm-budget.mjs`;
  promotion carries a weekly floor (D30) and a catch-up target while the
  pen has stock (D97). [`QUESTION-FARM.md`](QUESTION-FARM.md).
- **Level the feed bank**: every topic short of `TOPIC_TARGET`
  (`scripts/feed-budget.mjs`) needs servable questions — vote, dial,
  field and path count; rank and duel do not (D12). The lane is
  scheduled (D145); its output to date is nil — every feed provenance
  row still reads editorial.
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
- **The catalog lane's blocked half** (decided, D14/D15): films and
  artists are wired into the trigger's domains but their catalogues do
  not exist — an operator run of `scripts/build-catalog.mjs` against
  Wikidata (unreachable from sandboxes; measured), then the demo cards,
  the trademark check, and go-live. The pick surface stays unscored
  until it is live. [`CATALOG-QUESTIONS.md`](CATALOG-QUESTIONS.md).
- **Pulse templates** (rides the roster, D166 §3):
  `content/pulse-questions.json` gains four templates — energy, sleep,
  focus, social — through the ordinary content gates.
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
- **IndexedDB bank cache** (named as the real fix, unscheduled): replace
  the localStorage bank cache before the bank crosses `BANK_WARN` /
  `BANK_FAIL` in `scripts/question-quality.mjs` — crossing the browser
  quota silently disables caching forever.
  [`SCALE-RUNBOOK.md`](SCALE-RUNBOOK.md) 1.2.
- **Cost-model measurement debt** (decided; needs a week of real usage):
  measure the guessed inputs in `scripts/cost-arith.mjs` — bgCycles,
  onlineMin, the three D98 open rates — and re-run the write-contention
  versus read-crossover tie. [`COSTS.md`](COSTS.md) § the walls.
- **Recorded, deliberately not built** (D7 discipline — build on
  evidence, not in advance): sharding the shared daily aggregate counter
  (the first wall); the who-voted page-two cursor; incremental
  `setFollowing`; the presence cache-miss threshold and the coarser room
  cache key; an avatar-overwrite rate limit; the CDN question; the
  graded breaker `mode` field, which needs an owner decision about what
  a degraded app *says* before it can be built. [`COSTS.md`](COSTS.md).
- **The eager-bytes door** (v28 §5): a lazy-tab loader (Patterns needs
  it anyway), then a lazy `map-tab.jsx` — one change that unblocks
  Crossroads' `mapTree`, the Foresight map branch and the pulse branch
  `window.goTrends` wants to open. [`VISION-V28.md`](VISION-V28.md) §5.
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

1. **The small pass and type-mix** — nine visual corrections in one
   commit (the `daily-split` drag guard is a bug fix regardless of the
   tab decision), plus the type-mix system switch: one control, one
   persisted key, and it does not touch D8. §7, §8.
2. **The tweak teardown** — the settled flags deleted from
   `TWEAK_DEFAULTS`; deletions only, lowers the coupling ratchet. §10.
3. **The pulse roster** (decided, D166 §3) — the parameterisation D139
   anticipated, with the [`STORE-FORMS.md`](STORE-FORMS.md) Health row
   re-answered **in the same commit**, the four templates, and the
   data-inventory row. §3.
4. **Patterns** (trial, D166 §1) — fold, then loader, then the Map and
   Oracle lenses, in that order and no other; typed ESM only, lazy only,
   and the tab's first appearance rewrites `CLAUDE.md`'s opening
   sentence in the same commit. §2, §11.
5. **The Map's parked branches** — Foresight (`g-fore`) and Crossroads
   (`g-paths`), once the Map is lazy. §5.
6. **Every v28 item ships with a `smoke-live` case** (D167) — mount
   live, assert the real thing renders and the demo cast does not. §13.

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
pulse edit window · anonymous attention rollups
([`ATTENTION.md`](ATTENTION.md) tier 3) · auction-priced slots · the
community board and bylines. None binds anything yet.

## 5 · Flips and soft-shipped gates

Each of these is built, tested and deliberately off; feature-complete
includes flipping them, and each has its own runbook.

- **Device-bind enforcement** (D29/D37): the native token bridges on
  both platforms, the console setup, the staging probe, `minBuild`
  raised first, then the two 24-hour rates, then the one-word rules
  flip. [`DEVICE-BIND.md`](DEVICE-BIND.md).
- **The k-floor restore** (D81): the paused constants back to five,
  server and client copies in one commit, at launch traction; the
  choreography is already pinned by tests.
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

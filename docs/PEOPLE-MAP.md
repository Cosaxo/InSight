# The People lens — everyone placed by what they answer

**Status:** §3–§4 are **BUILT
([D214](DECISIONS.md#d214--the-people-lens-joins-the-patterns-trial),
2026-08-20)** — the engine is `src/v2/data/peopleMap.ts`, the lens
`src/v2/ui/PatternsPeople.tsx`, and §0's one owner decision was taken by
D214 with the owner's own standalone as the design
(`design/standalone-people-2026-08-20/`). §6's plane switch and §7's
whole-world map stay deferred with their arithmetic — those sections are
still proposals. Written 2026-08-20, verified against the tree rather
than assumed — every "already exists" claim below names the file it was
read in.

## 0 · The idea, and the one decision it waits on

One sentence: **the patterns Map, transposed.** The nightly fit already
learns one latent space in which a question's loading vector and a
person's vector predict that person's answer (`functions/src/patternsFit.ts`).
The Map lens draws the questions in that space and hides the people; the
People lens draws the people — you at your own position, the crowd
around you, so *"who actually thinks like me"* is a place you can look
at rather than a list you scroll. Distance has a precise meaning the
lens can say out loud: the model's expected disagreement between two
people, **beyond each question's popularity** — two people who only
"agree" because both pick the popular option do not read as close here.

**The decision:** the Patterns tab is ON TRIAL (D166 §1), and this adds
a third lens to the thing on trial. That is an owner call, not an
engineering one — one sentence adopting the lens into the trial's scope,
recorded in `DECISIONS.md` when the work is picked up. It changes
nothing about the trial's mechanics: the lens lives inside the tab's
lazy chunk, so the reversal D166 priced (one import site, one `TABS`
entry) is unchanged, and removing just the lens is one `LENSES` entry
plus its files.

The plan needs no privacy decision, and §5 is the working: phases 1–2
read nothing that is not already world-readable and drawn on other
screens today. The deliberately-deferred whole-world variant (§7) *does*
need one, which is one of the reasons it is deferred.

## 1 · What already exists, verified

- **The space.** `functions/src/patternsFit.ts` — a streaming rank-K
  factorisation (K = `PATTERNS_K`) over the vote log. Per-question
  loading vectors publish nightly to `v2_patterns/loadings` (one public
  doc, one read per session, each vector with the answer count it rests
  on). Per-person vectors θ accumulate at `v2_users/{uid}/patterns/state`
  — **readable by nobody** (`firestore.rules` denies both ops; the
  comment there is load-bearing for this plan: *"a latent vector is a
  summary nobody signed up to be read AS"*, and §5 answers it).
- **You, already placed.** `estimateTheta` in `src/v2/data/patternsMap.ts`
  solves the viewer's own θ on the device from their answers and the
  published loadings — never stored, never sent (the Oracle's seal runs
  on it today, `src/v2/data/patterns.ts`). The People lens needs no new
  arithmetic to place *you*; it needs the same solve pointed at other
  people's public answers.
- **The geometry, reusable as-is.** `mapGeometry`/`edgesOf`/`planeOf`
  (`patternsMap.ts`) work over `MapNode { id, L, n }` — nothing in them
  is question-specific. A person with an estimated vector *is* a
  `MapNode`. No RNG anywhere, so a people layout is as deterministic and
  testable as the question one.
- **The reads, bounded and cached.** `fetchVoters`
  (`src/v2/data/voters.ts`) returns a question's newest voters up to
  `VOTER_FETCH_CAP` as `{ uid, optionIdx, anchors, name }` — optionIdx
  is exactly the observation the solve needs, anchors are the frozen
  answer-time snapshot (D8), names resolve through the shared session
  cache. `LIVE.loadVoters` holds each list for the session, and Kindred
  already fans out over `KINDRED_QUESTIONS` of the viewer's own answers
  through the same cache — the read pattern this lens copies rather than
  invents.
- **The claims discipline.** `scoreMatch` (`src/v2/data/similarity.ts`)
  states the rule this lens inherits: a number on a screen that names
  someone must survive being explained to them. And `PATTERNS.say()`
  shows the shape for exactness: cosines draw the picture, the exact
  table is fetched only for the pair on screen, basis stated (D146).

## 2 · The reading contract

What the lens says, and what it must never say. These are the honesty
rules the tests in §3–§4 pin, written before the code so they are the
spec rather than the apology:

1. **Position is a model reading**: "the fit expects you two to answer
   alike, beyond each question's popularity." It is never presented as a
   measured fact about agreement.
2. **Every claim beside a name is an exact count**: *"agrees with you on
   9 of 12 shared answers here"* — folded from the same cached voter
   rows, basis stated, "here" meaning this map's questions. The picture
   is cosines; the sentence is arithmetic.
3. **Axes never get names.** No "openness axis", no "left–right". The
   explanation for a position is always questions — what the person
   actually said, one tap away.
4. **Too thin is not drawn.** A person below `PEOPLE_MIN_BASIS` shared
   observations is not placed — a near-empty θ estimate shrinks to the
   origin, and the middle of the map must never be where the lens parks
   people it knows nothing about. Same reflex as `MIN_PLACE_AXES`
   ("three is the least that can disagree with itself") and the Oracle's
   own `minBasis` refusal.
5. **The crowd is the latest crowd.** Voter lists are newest-first and
   capped, so the map draws a recency-biased sample and says so when the
   cap binds — the same honest bias, and the same sentence, as the
   who-voted sheet's "the latest 200".
6. **No fabrication, no demo cast.** A build with no published loadings
   shows the tab's existing honest state; a live build with loadings but
   no placeable people says that instead of inventing neighbours
   (D166 §1's one hard rule, D167 generally).
7. **Nothing physical.** Opinion-distance is the product (D98);
   physical distance stays out — presence is denied in the rules for
   physical-safety reasons and this lens never touches it.

## 3 · Phase 1 — the arithmetic (`src/v2/data/peopleMap.ts`, pure) — **BUILT (D214)**

A new typed ESM module beside `patternsMap.ts` — pure, no Firebase, no
`window`, unit-tested without a device (the `similarity.ts` posture).
No spec-layer code and no new globals: `check:globals` rule 4 may not
move up, and rule 2 is satisfied through the ESM graph.

- `estimatePerson(obs, k)` — thin wrapper over the exported
  `estimateTheta`, returning `{ v, n }` so the basis travels with the
  vector everywhere it goes.
- `foldCandidates(pool, votersByQid, myUid)` — walk the cached voter
  rows for the pool questions actually fetched; per uid, collect
  observations (`optionIdx` 0/1 only, encoded and centred by the
  loading's own marginal, exactly the server fit's residual); solve θ̂
  for everyone at or above `PEOPLE_MIN_BASIS`; alongside it, fold the
  exact agreement against the viewer: `{ agree, shared }` over the same
  rows. One pass, output-sensitive, no pairwise state.
- `PEOPLE_MIN_BASIS` — first value **5**: three binary answers is a coin
  run, five is the least that can show a pattern. The synthetic tests
  are where this number gets tuned; prose never re-states it (the D39
  lesson).
- Layout nodes are built from **unit** vectors. Question loadings and
  person estimates carry different norms (loadings grow with folds, θ̂
  shrinks with the ridge), and `planeOf` seeds positions from the first
  two raw components — mixed families would huddle one of them at the
  centre. Unit twins from `mapGeometry` are already how similarity is
  computed; seeding from them keeps the two families comparable. This is
  the one known wrinkle; it is named here so it is a test, not a
  surprise.

`peopleMap.test.ts` pins: a two-faction synthetic pool places the
factions apart and the viewer with theirs; below-basis people are absent
from the output, never at the origin; agreement counts are exact against
hand-folded rows; hostile voter rows (out-of-range `optionIdx`, missing
fields) fold to nothing; the whole pipeline is deterministic given its
inputs.

## 4 · Phase 2 — the lens (`src/v2/ui/PatternsTab.tsx`) — **BUILT (D214)**, as its own file `src/v2/ui/PatternsPeople.tsx`

A third `LENSES` entry — `people` — with its one-sentence `NOTES`
explainer (retiring on first use like the other two). The Oracle and the
Map are untouched; votes keep landing through `LIVE.vote` alone.

**The data path, copied from Kindred rather than invented:** the
viewer's answered pool questions, most recent first, capped at
`PEOPLE_QUESTIONS` (first value: `KINDRED_QUESTIONS`'s 12, for the same
two reasons — a legible basis, linear cost). Each goes through
`LIVE.loadVoters`, sequential, so a question whose who-voted sheet or
pair card has already been opened costs nothing, and every list this
lens fetches is warm for those surfaces in return. No new query shape,
no new collection, no rules change.

**The field:** you, marked, at your own solve; around you everyone the
fold could place, named (a nameless account draws and reads as
"Someone", the who-voted convention), dot presence fading with basis.
Tap a person and the card says who they are — name, the frozen anchor
chips from their answer (D8/D152: from the answer, never the live
profile) — and the exact sentence from §2 rule 2, plus the one shared
answer that ties you strongest. No coordinates, no axis captions, copy
per `COPY.md`.

**Question landmarks** — the pool's few highest-hub questions drawn
faint in the same projection, so "you sit near the questions that pull
you" becomes visible — are a second pass, judged at a screen (the §7
visual-pass rule in VISION-V28: no test can assert what this should look
like, so it is done looking at it, not from prose).

**States, each honest:** no loadings → the tab's existing state already
covers it; viewer below basis → the lens offers the Oracle ("answering
is how you get placed") rather than ceding the screen — the D136 move;
loadings but nobody placeable → say so, with the count that was seen.

**Tests:** a `smoke-live` case in the existing shape — mount live, walk
to the People lens, assert the honest state renders and the demo cast
does not, asserting on the `ErrorBoundary` never on a throw; plus
store-level cases beside `patterns.test.ts` for the fetch-set choice
(answered ∩ pool, capped) and the session cache.

## 5 · Why this is not a new exposure — and the sentence it owes

The rules comment on the private per-user state stands unchanged, deny
and all: **the server's fitted θ is never read, by anyone.** What the
lens draws is computed on the viewer's device from answers that are
world-readable since D98 — the same rows the who-voted sheet lists by
name today, the same rows Kindred already folds into a ranked likeness
with a percentage on it. This lens changes the *projection* of already
public data, not its reach: list → picture.

The concern in that rules comment — a latent vector as a summary nobody
signed up to be read as — is real, and §2 is the answer: the summary is
never shown as a type, a label or a named axis; only as proximity, with
the exact-count sentence one tap away and questions as the only
explanation. What the lens owes is one plain first-use sentence in its
explainer slot: placed from public answers, the same ones anyone can
already read. `web/privacy.html` needs no new bullet — nothing new is
collected, granted or served (`check:policy-claims` is the proof
either way) — and the account panel's one public-answers sentence (D183)
already covers the inputs.

## 6 · 3D, answered

The space is K-dimensional; three drawn axes are still a projection, so
"nearest in the picture" is approximate in 3D exactly as in 2D — the
third axis buys one more component and costs occlusion and navigation on
a phone. So:

- **v1 draws the plane** — `planeOf`, the form every field in this app
  already uses.
- **The third dimension ships as a *choice of plane*, later:** pool
  items carry their topic (`q.cat`), so "place everyone by the moral
  questions only" is a re-solve over a filtered pool — and watching who
  stays near you and who teleports between planes says more than a
  static z-axis ever would. One filter chip, no new data.
- **A 3D presentation** (slow parallax over the first three components)
  is a costume over the same vectors — possible any time, decided at a
  screen like every other visual judgement here (D189), never in prose.

## 7 · Deferred — the whole-world map, with the arithmetic

Phases 1–2 draw *your orbit*: the people reachable through bounded
samples of the questions you answered. A map of **everyone** needs the
server to publish positions, and that is deferred deliberately:

- **It reverses a chosen property.** `v2_patterns/loadings` was designed
  with *"nothing per-person in it"* so account deletion needs no new arm
  (the recursive delete takes the private state). A public positions doc
  re-creates exactly the scrub-on-erasure obligation that design dodged.
- **It needs its own decision.** Publishing a per-person derived summary
  is in-thesis under D98 but is a new presentation of people — an owner
  call, with the §5 concern answered again at server scope.
- **It hits a size wall on schedule.** uid plus a few rounded floats is
  tens of bytes; a single 1 MiB doc holds on the order of 10⁴ people and
  then shards, with a read per shard per open — the SCALE-PLAN shape of
  problem, worth its own arithmetic when real numbers exist.
- **It re-opens rotation.** The fit's axes drift night to night, which a
  device-side session solve never notices but a published nightly
  position does — the world map would visibly reshuffle without anyone
  changing their mind, so publication needs night-over-night alignment
  the orbit map simply doesn't.

Trip-wires that reopen this section: the orbit lens surviving the D166
trial with usage, or the crowd outgrowing what recency-capped samples
honestly represent. Until one trips, this section exists so the next
reader does not re-derive it.

## 8 · Cost, before building

Phases 1–2 add **no server work and no new read shape**. Worst-case new
reads per session: `PEOPLE_QUESTIONS` collection-group queries of up to
`VOTER_FETCH_CAP` answers each plus batched name resolution — the same
queries Kindred, the who-voted sheet and the pair card already issue,
shared through the same session cache, so a session that used those
surfaces pays nearly nothing more. The nightly fit is untouched; the
`COSTS.md` Patterns row does not move. If measurement disagrees, the
number goes there, dated, like the fit's own did.

## 9 · The gates this work answers to

`tsc -b` and eslint (typed ESM throughout); `check:globals` — rule 4 may
not rise, no `spec-index.js` line (rule 2 is met through imports);
`npm run test:unit` — the new pure tests plus the smoke case;
`check:bundle` — everything lands in the Patterns lazy chunk, the eager
budget is untouched; **no** movement in rules, `check:appcheck`,
`check:data-inventory` or `check:policy-claims`, and that absence is
part of the claim in §5. This document itself: a row in
`ORIENTATION.md` (`check:docs`).

## 10 · Sequencing

1. **The owner sentence** — People joins the Patterns trial; recorded in
   `DECISIONS.md` when picked up, alongside this file's status change.
2. **Phase 1** — `peopleMap.ts` + tests. Green on its own, ships dark.
3. **Phase 2** — the lens, its states, its smoke case, its copy pass.
4. **Judged at a screen**, inside the same trial verdict the tab already
   has — D166 records what ends it.
5. §6's plane switch and §7's world map are separate later decisions,
   not steps.

## 11 · What this plan does not propose

Reading or publishing `v2_users/{uid}/patterns/state` (the deny stands);
any new collection, rule, callable or scheduled function; printed
coordinates, named axes, or typing people from their positions; physical
nearness anywhere on the surface; any change to the account panel's
public-answers sentence or `web/privacy.html`. And nothing here touches
the corpus: core only, two options only — `PATTERNS_QIDS` stays the one
list (D161).

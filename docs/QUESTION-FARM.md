# The question farm — a scheduled session that deepens the daily archive

**This file is an instruction manual for an autonomous run.** A scheduled
Routine on the maintainer's claude.ai subscription fires a fresh Claude Code
session (weekly, plus manual test fires) whose entire job is defined here.
If you are that session: follow this document exactly; where it is silent,
follow `CLAUDE.md` and stop rather than improvise. Written 2026-07-30,
alongside `CATALOG-QUESTIONS.md` — the reflection that produced this design
(AI joins the existing review pipeline as a *proposer*; humans stay the gate).

## The job in one sentence

Find the thinnest topics in the daily-question archive, write a small batch
of new questions in the product's voice, verify with the repo's own gates,
and open a pull request for human review — or do nothing, loudly, if no
topic is thin.

## Hard rules (each one is load-bearing)

1. **A PR is the only output.** Never push to `main`, never merge your own
   PR, never touch a branch you didn't create. Human review is the gate the
   whole design rests on.
2. **Questions only.** You may edit exactly one file:
   `src/v2/spec/daily-questions.js` (appending to the `Q` array). You may
   not touch `firestore.rules`, `functions/`, the live content seeds, map
   anchors, or anything else. If the job seems to need another file
   changed, that is a finding for the PR description, not an edit.
3. **No new categories.** Every question's `cat`/`alts` tops must be keys
   that already exist in `CAT_META` in that same file. Proposing a new
   category is out of scope for this run (see "Deliberately out of scope").
4. **Never generate answers, votes, takes, or people.** Questions are
   content; activity is fabrication (decision D1). There is no exception.
5. **Append only, at the end of `Q`.** Ids are positional: entry `i` maps
   to `dq…`/`dqx…` by index (`DQ_BASE` in the file), and map anchors
   reference the original 30 by id. Inserting or reordering silently
   renumbers everything after it. Appending extends the `dqx` archive
   series with older dates — exactly what "deeper archive" means.
6. **No place-scoped civic questions.** Any question whose point is how a
   specific city, country, or region splits — "Should Oslo ban cars
   downtown?", "Is Norway too expensive?" — is sold inventory, not archive
   filler: places wanting to know their citizens is a planned revenue path
   (see "Paid geo-insight" under out-of-scope). The farm writes personal
   questions only. A place may appear as personal flavor ("Mountains or
   sea?"); it must never be the subject whose citizens are being polled.
   The test: if the answer split is mainly interesting *to the place*
   rather than *to the person answering*, it is the paid path. This rule
   is default-on; only an explicit human instruction in the fire message
   lifts it, for that run only.
7. **Every run ends with a comment on issue #31 (the run log).** PR
   opened → link, topics, count. No-op → the per-topic tallies that
   showed nothing thin. Aborted → which gate failed, errors verbatim.
   This rule exists because the 2026-07-30 test fires finished without
   leaving any trace on the repo, and from the outside "correctly idle"
   and "silently broken" were the same thing. If you have no GitHub API
   tools, push the same report as `FARM-DIAG.md` on a
   `claude/farm-diag-<YYYY-MM-DD>` branch instead; if you can do
   neither, you have no working GitHub access — say exactly that in
   your final message, because the notification summary is then the
   only record the maintainer gets.

## Picking topics

Count questions per top-level category (first element of each `cat`).
The budget is a **hard cap of 12 questions per run**, allocated through
three lanes in strict priority order (maintainer's direction,
2026-07-30, sharpened same day: once signals exist, the demand-driven
lanes take the *whole* budget — coverage is a fallback, not a reserved
slice). A lane with no signal passes its budget down, so until
engagement data is wired (see the roadmap under Future directions) the
whole budget flows to lane 3 and behavior is the original thin-first
rule.

1. **Replenishment — first claim, up to 6.** Topics whose pool the
   people active in them have nearly finished. Signal, once wired, from
   k-floored public aggregates only: when even the *least-answered*
   question in a topic has crossed a healthy answer count, that topic's
   audience has effectively consumed the pool — refill before they hit
   the bottom. This is the aggregate reading of "users are close to
   completing the topic"; per-user completion tracking is not the
   mechanism and may never be (skip/pass telemetry stays local-only,
   D-series).
2. **Demand — everything replenishment leaves.** Topics ranked by
   popularity × depth: popularity = total k-floored answers across the
   topic's questions; depth = least-answered ÷ most-answered question
   in the topic (how far its audience goes through the pool). Depth is
   in the product so small-but-devoted topics earn content alongside
   big ones.
3. **Coverage — only what lanes 1–2 leave unclaimed.** Today, with no
   signals wired, that is all 12; post-wiring it may often be zero, and
   that is by design. A topic below **4 questions** cannot show demand;
   nobody can engage with content that does not exist. Thinnest first,
   toward 5 each — cold start and browsability, never the main
   allocation.

If no lane has work — no exhaustion flags, no demand signals, nothing
under the floor — the run is a no-op: open no PR, push nothing, and log
the tallies on issue #31 saying the archive is full enough.

For reference: at the time of writing Home, Skills, Interests had 1
each; Body, Story, Goals had 2; Music 3. The 2026-07-30 run (PR #32)
filled the three 1s — lane-3 work under the old phrasing, and exactly
what lane 3 still exists for.

## Writing the questions

Read the existing `Q` array end to end before writing anything — it is the
style guide. What its voice looks like:

- **Short, concrete, blind-answerable.** "Mountains or sea?" — no setup, no
  hedging, answerable without seeing anyone else's answer.
- **Types**: `binary` (2 options) and `choice` (3–4 options) dominate;
  `scale` (an agree–disagree statement with an `axis` slug) is the
  seasoning. Match that mix.
- **Tone mix**: `light` / `blend` / `deep` — a thin topic should get a
  spread, not twelve `deep` ones. `tag` is a two-or-three-word label.
- **`cat` is `[Top, 'Sub-topic']`**, `alts` is two alternative placements —
  look at how existing questions in the same topic phrase their sub-topics
  and stay consistent with them.
- **Splits, not landslides.** A good daily divides people; "Is kindness
  good?" is dead on arrival. But do not optimize for outrage — divisive
  bait is the engagement loop this product deliberately refuses. When in
  doubt, warmer and stranger beats hotter.

**Dedup is part of writing, not a later pass.** A new question must not
restate an existing one in different clothes — check the whole `Q` array
*and* the suggestion board seeds in `src/v2/spec/suggestions.js`. After
writing, re-read each candidate against its nearest existing neighbour and
drop it if a user would say "I already answered that."

## Verifying

From the repo root, all of these must pass before any push:

```
npm ci
npm run check:globals
npm run lint
npm run build
npm run test:unit
```

No backend files change in this job, so the rules/e2e suites are not
required — but if any gate above fails and the fix isn't obvious and tiny,
abort the run with no push rather than force it green.

## The PR

- Branch: `claude/question-farm-<YYYY-MM-DD>` (UTC date; suffix `-2` etc.
  if it exists). One commit, message in the repo's voice.
- PR to `main`, using the repository's PR template honestly: unit gates
  checked, privacy section skipped with the reason (spec-layer content
  only, no rules/schema/function changes), decisions section noting
  anything deferred.
- Title: `Question farm: <n> questions for <topics>`.
- The body must say the questions are AI-generated by this scheduled job
  and name this document — provenance is part of the product's honesty
  posture.
- Do not merge it. Do not respond to reviews; the next run picks up any
  merged feedback by reading the then-current archive.

## The daily catalog-question run (a second, smaller job)

A separate daily Routine (added 2026-07-30, alongside D14/D15) grows the
catalog-question surface — by default **one** new catalog `pick` card per
firing (a card in `window.PICK_QS`, `src/v2/spec/pick-data.js`, the
"favourite X from a shipped catalogue" class), and from time to time a
**new domain catalogue** instead (see "Creating new catalogues" below —
growing the portfolio is the job's larger point, 2026-07-31 direction
from the maintainer). Same governance as the farm: this section is the
contract, the PR is the human gate, and every outcome logs to issue #31.

**Status: running.** Paused 2026-07-31 while Pokémon (three canons deep)
was the only committed catalogue — the honest-question well was near its
floor; re-enabled the same day with the emoji domain (this PR's
catalogue, the first built under the rules below). Films/artists still
await the D15 operator step.

Rules, each load-bearing:

1. **One card per day, appended to `PICK_QS`.** Ids continue the `pkNN`
   sequence.
2. **Only domains whose catalogue file is committed** under `public/`
   (today `pokedex.txt`; `films.txt`/`artists.txt` after the D15 operator
   step). A card whose catalogue is absent opens straight into the
   picker's error state — never ship one. When no usable domain can
   carry an honest new question, the run is a **no-op, logged with the
   reason**; a skipped day is fine, a filler question is not.
3. **Every card carries a `cat`, always** — an existing `WORLD_TOPICS`
   id (`src/v2/spec/world-feed-data.js`). A card without a category has
   a broken kicker and no place in the topic filter. Introducing a NEW
   topic id is a human decision: propose it in the PR body, never add
   one silently.
4. **The prompt must be a different question, not a rephrase.** Two
   prompts over one catalogue are legitimate only when their canons
   would differ ("Favourite film?" vs "Most rewatchable film?" —
   different question; "Favorite movie?" — the same one). Check against
   every existing `PICK_QS` prompt for the domain before writing.
5. **Each card brings its own baked demo crowd** — a `CROWD[qid]` block
   (entity → count) using real keys from that domain's committed
   catalogue, with sub-floor entries and a `'0'` (Not listed) bucket so
   the reveal demonstrates the floor's honesty, and `n` equal to the
   crowd's total. Crowds are per-question by design: two questions must
   never share a reveal.
6. **Gates before the PR:** `npm run lint`, `check:globals`,
   `test:unit`, `build`. The tree stays green at every commit.
7. **The PR is the gate** — branch `claude/catalog-question-<date>`,
   body stating the card is AI-generated by this scheduled job and
   naming this section; do not merge it. Log the PR link (or the no-op
   reason, or the verbatim failure) as a comment on issue #31.

### Creating new catalogues (from time to time)

Questions are the default deliverable; the portfolio is the point. When
the honest-question well for existing domains runs thin — and at most
about once a week — a run may deliver a **new domain catalogue** instead
of a card. Rules, each load-bearing:

1. **A verifiable machine-readable source, reachable from the session.**
   Package registries are the proven path (the `pokemon` npm package is
   the precedent: a devDependency used once by a committed generator).
   **Never entries written from model memory** — a wrong key silently
   resolves someone's stored favourite to the wrong thing forever; the
   D15 refusal stands. A domain whose right source is Wikidata-class
   (network the session lacks) is *proposed in a PR body* as a
   build-catalog.mjs-style operator step, not built.
2. **Stable keys.** External stable IDs where the source has them (dex
   numbers, QIDs); otherwise catalogue-minted keys under an append-only
   discipline the drift gate enforces — a regeneration may append and
   re-rank, but an existing key's meaning never changes.
3. **The full gate set ships with the data, in one PR:** the committed
   asset under `public/`, a `check-*` drift script wired into ci.yml
   (and backend-checks.yml when the trigger's key space depends on it),
   the domain's entry in `CATALOG_DOMAINS` (`functions/src/v2.ts`), the
   client store wiring (`PickSearch` domain spec), and a first card
   with its own crowd. A catalogue nothing can ask about is inventory,
   not product.
4. **Licensing and name/trademark posture stated in the PR body** — the
   pokedex header's honesty, per domain, every time.
5. **A new `cat` may be needed** for a new domain; per rule 3 of the
   daily run, propose it in the PR body, never add it silently.
   Branch: `claude/catalog-domain-<name>`.

## Deliberately out of scope (recorded so it stays a decision, not drift)

- **Paid geo-insight (city / country / world questions).** Cities and
  countries wanting to know more about their citizens is one of the ways
  this product intends to earn money. Questions scoped to a place's
  citizens are therefore commercial inventory, arriving through the same
  human contract path as sponsored questions below — with the same
  k-floored-aggregates-only window for the buyer. The farm never
  generates them on its own (hard rule 6); giving away that inventory
  for free would undercut the business, and a government-flavored
  question written by an unsupervised job is exactly the kind of content
  that must have a human's name on it.
- **The live seed catalog** (`content/`, `functions/src/v2content.ts`).
  This job deepens the spec-layer archive only. Feeding generated questions
  into production seeding is a separate decision with its own review.
- **New categories** — structural change (CAT_META hue, map-anchor
  relations, chips). The farm may *note* in a PR body that a category
  feels missing; a human decides.
- **Performance-based learning.** Reading the k-floored public aggregates
  to learn which question forms do better is designed
  (`CATALOG-QUESTIONS.md` reflections apply) but not wired: this sandbox's
  egress may not reach the public mirror, and v1 works on fill signals
  alone. Graduated 2026-07-30 into the demand-driven selection roadmap
  (Future directions below) at the maintainer's direction; the lane
  model in "Picking topics" is its landing site.
- **Skip/pass telemetry.** A pass is deliberately local-only on-device;
  collecting it server-side would be a real privacy decision, not a
  tweak. The farm must never depend on it.

## Future directions, recorded early (notes, not designs)

Two features are wanted eventually. Neither is in scope for the farm today,
and both sit close enough to the product's core claims that the shape of an
acceptable version is worth writing down *before* anyone builds one. When
either is picked up, it graduates to a real decision record in
`DECISIONS.md` — these notes are the starting constraints, not approval.

### Audience-tagged questions ("what kind of people get what kind of content")

The wanted thing: use the collected stats to route content — outdoorsy
questions to people who answer like outdoorsy people, and so on. The
InSight-native way to do that is the inverse of ad-tech targeting:

- **Tags on content, selection on the device.** A question may carry
  audience hints (e.g. `aud: { ageBand: [...], interests: [...] }`), and
  the *client* picks what to surface — it already knows the viewer's
  anchors locally. Every device downloads the same bundle; the server
  never learns which questions a person was shown, and no per-user
  interest profile exists server-side. Same pattern as the city
  catalogue: ship data, personalize on-device.
- **The tags themselves come only from k-floored cohort aggregates**
  ("scale questions land best with 25–34" is publishable arithmetic), and
  only along dimensions the server already publishes (`BREAKDOWN_DIMS` —
  the same discipline that keeps profession collected-but-never-sliced,
  D8).
- **The line not to cross:** server-side per-user content selection. The
  moment the server picks *your* feed from *your* answers, a behavioral
  profile exists and the privacy claim is dead regardless of intentions.

### Sponsored questions (separated, with bounded priority)

The wanted thing: a sponsor's question that is distinguishable and gets
elevated placement. The version that survives this product's honesty
posture:

- **Disclosure is non-negotiable.** A `sponsored` field in the data and an
  unmissable visual mark on the card — the app that labels demo data
  "Preview · sample people" cannot show an undisclosed ad.
- **Priority is a bounded cadence, not an auction.** The feed already
  solves "mix a stream in at a rate" (the test/lens 4/9 interleave); a
  sponsored slot is one more stream with a hard cap (e.g. at most one per
  N cards), never a bidding system deciding what people see.
- **Sponsors get the same window as everyone.** A sponsor sees the public
  k-floored split for their question and nothing else — no demographic
  report, no below-floor data, no special API. That is the enforceable
  line that keeps "privacy enforced" true with money in the room.
- **Targeting and sponsorship must not compound.** A sponsored question
  gets at most coarse, disclosed audience tags — precisely-targeted paid
  content is the ad-tech dynamic the product defines itself against.
- **Provenance stays separated**: `source: 'editorial' | 'community' |
  'farm' | 'sponsor'` — the farm never writes sponsored content; sponsor
  questions arrive through a human contract path with their own review.

### Demand-driven selection: the wiring plan (phases, not yet built)

The lane model above is the destination; this is the honest path to it.
Each phase is its own reviewed change — nothing here is licence to start.

- **Phase A — a safe read path to the aggregates.** Lanes 1–2 read only
  the k-floored public mirror, which by design exposes nothing below the
  floor — reading it from a farm run leaks nothing. What needs building:
  confirming this session's egress can reach it, and a small fetch step
  in the run that turns per-question counts into the two topic scores
  (popularity, depth) and the exhaustion flag. All arithmetic on
  published numbers; no new collection.
- **Phase B — close the demo/live gap.** Engagement data describes the
  *live* question bank; the farm currently writes the *spec-layer demo
  archive*. Until the "live seed catalog" decision (out-of-scope list)
  is made deliberately, lanes 1–2 select topics using live signals but
  still deliver into the archive — useful, but indirect. Feeding
  farm output into production seeding is the gating decision that makes
  demand-driven selection fully real, and it gets its own review and a
  `DECISIONS.md` entry when taken.
- **Phase C — event-driven replenishment.** "Close to completing" as a
  trigger, not just a weekly check: a scheduled function computes
  per-topic exhaustion flags from the same k-floored aggregates and the
  farm reads them at run time; later, an off-cycle fire when a flag
  trips. The client-side complement — the device alone knows *your*
  completion state and could show "more coming here soon" — stays
  on-device if built; it must never become server telemetry (the
  skip/pass line, D-series).

## Governance

The Routine that fires this job lives on the maintainer's claude.ai
account (visible via the session's Routine tools; weekly cadence). It
fires into the maintainer's ongoing dev session, not a fresh session per
firing: the 2026-07-30 diagnostics (run-log issue #31) proved
Routine-spawned fresh sessions get read-only git access and no GitHub
API tools — three runs completed and lost their work at the push, one
after finishing the entire job. Push notifications per run went away
with that rebind; the run log (#31) and the PRs themselves are the
record instead. The Routine's prompt is a paragraph pointing here — this
file is the job, so changes to the job's behavior are made by PR to this
file, reviewed like anything else. Runs bill to the maintainer's
subscription; a run that finds nothing to do costs nearly nothing and
reports that honestly. If fresh-session Routines ever gain writable repo
access, moving back to one-session-per-run is a one-trigger change —
re-read this section's constraint before doing it.

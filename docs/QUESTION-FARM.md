# The question farm — a scheduled session that deepens the daily archive

**This file is an instruction manual for autonomous runs.** Scheduled
Routines on the maintainer's claude.ai subscription fire into the
maintainer's ongoing dev session (not fresh sessions — see Governance for
why, and for the account-side inventory), and their jobs are defined
here: the weekly question farm in the sections below, and the daily
catalog run further down. If you are one of those runs: follow this
document exactly; where it is silent, follow `CLAUDE.md` and stop rather
than improvise. Written 2026-07-30, alongside `CATALOG-QUESTIONS.md` —
the reflection that produced this design (AI joins the existing review
pipeline as a *proposer*; humans stay the gate).

## The job in one sentence

Find the thinnest topics in the daily-question archive, write a small batch
of new questions in the product's voice, verify with the repo's own gates,
and open a pull request for human review — or do nothing, loudly, if no
topic is thin.

## Hard rules (each one is load-bearing)

1. **A PR is the only output.** Never push to `main`, never merge your own
   PR, never touch a branch you didn't create — and a branch created by an
   earlier run of the same lane counts as this lane's own: rolling a new
   commit onto the lane's open PR is this rule working, not an exception
   (§ The PR, 2026-08-03 — before that clause, runs read this rule strictly
   and stacked a new branch per day, which is exactly how the #58 → #62 →
   #65 pile happened). Human review is the gate the whole design rests on.
2. **Questions only.** You may edit exactly one file:
   `src/v2/spec/daily-questions.js` (appending to the `Q` array). You may
   not touch `firestore.rules`, `functions/`, the live content seeds, map
   anchors, or anything else. If the job seems to need another file
   changed, that is a finding for the PR description, not an edit. One
   carve-out (2026-08-05): the run also refreshes the generated
   `content/scorecard.json` — only ever via `npm run scorecard --
   --fetch`, never by hand — per the scorecard section's self-refresh
   contract. That file is measurement, not content; everything else
   under `content/` stays untouchable.
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
The budget is **computed, not flat** (D97, 2026-08-11 — the owner's
direction: upscale hugely, but smartly. Previously a hard cap of 4/run
daily, D33). Start every run with

```
npm run farm:budget -- --open <questions on the open lane PR>
```

which grants up to **8 questions per run** while the *pen* — the
unpromoted archive plus whatever already sits unreviewed on the lane's
open PR — is below its pen target of **56** (eight weeks of promotion
cover at D30's ≥7/week floor), and grants **zero** at the target, or at
**12** unreviewed questions on the lane's open PR regardless of the pen.
Count the `--open` figure from the open farm PR's diff before running;
omitting it assumes 0, which over-generates. The constants live in
`scripts/farm-budget.mjs` with the reasoning; `check:figures` holds the
numbers quoted here equal to the script, and `farm-budget.test.mjs` pins
the property the whole design rests on: **once the pen is full,
sustained generation equals the human gate's measured promotion
throughput** — the cap only binds during catch-up. D33's constraint
("review capacity is the binding constraint, and a queue of unreviewed
AI PRs is inventory, not progress") is unchanged; the regulator is that
sentence as arithmetic, which is what makes the bigger cap safe.

Allocation of whatever the budget grants runs through three lanes in
strict priority order (maintainer's direction, 2026-07-30, sharpened
same day: once signals exist, the demand-driven lanes take the *whole*
budget — coverage is a fallback, not a reserved slice). A lane with no
signal passes its budget down; signals come from the committed scorecard
(next section), and with no scorecard — or a stale one — the whole
budget flows to lane 3 and behavior is the original thin-first rule.

1. **Replenishment — first claim, up to 2.** Topics whose pool the
   people active in them have nearly finished. Signal, from the
   scorecard's public aggregates only: when even the
   *least-answered* question in a topic has crossed a healthy answer
   count, that topic's audience has effectively consumed the pool —
   refill before they hit the bottom. This is the aggregate reading of
   "users are close to completing the topic"; per-user completion
   tracking is not the mechanism and may never be (skip/pass telemetry
   stays local-only, D-series).
2. **Demand — everything replenishment leaves.** Topics ranked by
   popularity × depth from the scorecard: popularity = total published
   answers across the topic's questions; depth = least-answered ÷
   most-answered question in the topic (how far its audience goes
   through the pool). Depth is in the product so small-but-devoted
   topics earn content alongside big ones.
3. **Coverage — only what lanes 1–2 leave unclaimed.** With no
   scorecard (or a stale one), that is the whole computed budget (D97 —
   it used to read "all 4" under D33's flat cap); with signals it may often
   be zero, and that is by design. A topic below **4 questions** cannot
   show demand; nobody can engage with content that does not exist.
   Thinnest first, toward 5 each — cold start and browsability, never
   the main allocation.

If no lane has work — no exhaustion flags, no demand signals, nothing
under the floor — or the budget script grants zero, the run is a no-op:
open no PR, push nothing, and log the tallies (and the budget line) on
issue #31 saying the archive is full enough or the gate is the work.

For reference: at the time of writing Home, Skills, Interests had 1
each; Body, Story, Goals had 2; Music 3. The 2026-07-30 run (PR #32)
filled the three 1s — lane-3 work under the old phrasing, and exactly
what lane 3 still exists for.

## The scorecard: how runs measure, and how they learn (D33)

`content/scorecard.json` — generated by `npm run scorecard -- --fetch`
(an operator step or a scheduled refresh; needs the public web API key)
— is the farm's only view of how questions perform. It reads nothing
but the public aggregates: per question, the published
`total` (draw) and an **evenness** score (1.0 = real split, 0.0 =
landslide — the "splits, not landslides" bar as a number; for
scale/rating it is measured on the axis, side balance × dispersion,
because a consensus on the middle must not read as "even" — D33
amendment 2026-08-06), rolled up per topic. What it deliberately cannot see: skip/pass rates (never
collected — local-only, D-series), anything per-user, anything below
the floor. Daily topics are capitalized `CAT_META` tops; feed topics
are lowercase `WORLD_TOPICS` ids — score them per-surface, never mixed
(daily totals are per-serve-day under the deck epoch; feed totals are
cumulative).

**Runs refresh it themselves when they can (2026-08-05).** If
`FIREBASE_API_KEY` is present in the session environment, the run
STARTS by executing `npm run scorecard -- --fetch` and commits the
regenerated `content/scorecard.json` as part of its PR — the data and
the questions it justified are reviewed together, which is what keeps
D33's "regenerating it is a reviewed change like any other" true at
daily cadence (hard rule 2 carries the matching carve-out). Without
the key, read the committed artifact and apply the staleness rule —
the original design, now the fallback. The first committed scorecard
(2026-08-05) is the pre-launch baseline: 0/155 scored, everything
unserved — honest, and exactly what an unlaunched app should say.

The scorecard also carries a **learn section** (same date): per-card
calibration (authored `p` vs measured correct rate) and trap share
(the fraction of wrong votes landing on `t`), with `miscalibrated`
and `weakTraps` advisories — read them before a learn run, cite them
in its PR body, and remember they are proposals: editing a shipped
card is a human PR at D32's production-level bar. The catalog surface
is deliberately NOT scored yet: pick cards are unseeded and no client
write path exists, so any qid scored today would be an invented key —
the D15 failure class. Score it when the surface goes live and
defines its ids.

Every run starts by reading it (`npm run scorecard` prints the
summary). Then:

- **Learn from the leaders.** Read the top-10's prompts before writing.
  What to imitate is their *shape* — length, concreteness, the kind of
  tension that split people — never their subject verbatim (a near-twin
  of a winner is a dupe, hard-rule territory).
- **Learn from the laggards.** A landslide is a question the crowd
  agrees on — dead as a daily. Before writing, say (in the PR body, one
  line per question) why each new question should split rather than
  slide. **The guardrail stands: do not optimize toward outrage.** If
  evenness and warmth conflict, warmth wins; "when in doubt, warmer and
  stranger beats hotter" outranks any score.
- **Learn the option shape, not just the prompt** (2026-08-03). The
  scorecard keeps per-option shares — `optionShares` on each scored
  question (and on leaders/laggards/retireProposals), with `types` and
  `optionSlots` rollups per surface. Read them for form: which types
  split best, and whether a 3rd/4th option earns its place
  (`avgMinShare` near zero means the form is carrying an option nobody
  wanted). This steers NEW questions only — a shipped question's options
  are never edited or reordered, because answers store (qid, optionIdx)
  forever and a reorder silently re-keys them (the D30 re-key failure
  class). The fix for a bad option set is retirement plus a
  better-shaped successor, never an edit.
- **Read your own vintages (D97).** The scorecard's `production` section
  re-cuts the same scored rows by who wrote each question
  (`content/provenance.json`: editorial / farm / community, per vintage
  batch). Before writing, read whether the farm's recent vintages hold
  the editorial bar — avgEvenness, strong vs landslide counts — and say
  so in one PR-body line ("farm vintages trail editorial by X on
  evenness; this batch leans harder on the leaders' shapes"). This is
  the loop that makes the upscale self-correcting: the farm is measured
  by the same k-floored aggregates as everything else, and a vintage
  that under-performs is a writing instruction, not a shrug.
- **Propose retirements, never apply them.** The scorecard lists
  landslides with real volume under `retireProposals`. Cite them in the
  PR body as `active: false` candidates; the kill switch is the
  operator's, in the console, deliberately (the seed never re-enables —
  D-series). The farm never edits the bank.
- **Staleness rule.** `generatedAt` older than 14 days → treat lanes
  1–2 signals as advisory and say so in the PR body; older than 30 days
  or missing → lane 3 only, and note that a refresh is due.

The scorecard is a COMMITTED artifact: regenerating it is a reviewed
change like any other, its numbers are already public by construction
(the aggregate is a count, not a roster), and committing it is what lets a
scheduled run read signals without needing production credentials.

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
drop it if a user would say "I already answered that." Since D63 the
nearest neighbours are measured, not guessed: run
`npm run check:neighbors -- --candidate "…" --options "A|B"` for each
candidate (suggestion seeds ride along) and cite the top score in the PR
body's one-line-per-question section. The same script gates CI at ≥ 0.5
similarity within a surface. It is lexical — it catches rewordings, never
synonyms — so the re-read stays the rule and the score is its floor.

**The mechanical style check is also part of writing (D97).** Write the
batch's candidates to a JSON file and run

```
npm run check:quality -- --batch candidates.json
```

(or `--candidate "…" --type … --options "A|B" --tone … --tag "…"
--cat "Top / Sub" --alts "Top / Sub, Top / Sub"` one at a time; a feed
candidate passes `--surface feed` and its bare topic id as `--cat`). It
holds the measured form bounds — prompt and option lengths, option
shapes per type, axis on ordinals, tag size, cat/alts against
`CAT_META` — plus the batch-mix rules (spread the tones, vary the
forms) and the hard-rule-6 tripwire for the obvious place-scoped civic
form. **Paste each candidate's packet line into the PR body** beside
its neighbor score: the reviewer's attention then goes where only a
human can spend it — warmth, semantic dupes, will-it-split — instead of
re-counting option arrays. The per-question bounds also gate CI
(`check:quality`), so a batch that skips the pre-flight fails those in
public a few minutes later — but the batch-MIX rules exist only in the
pre-flight (the CI gate scans the whole corpus and cannot know which
entries arrived as one batch), so a PR with no packet lines is itself a
review finding: ask for them before reading further.

## Verifying

From the repo root, all of these must pass before any push:

```
npm ci
npm run check:globals
npm run lint
npm run build
npm run test:unit
npm run check:neighbors
npm run check:quality
```

No backend files change in this job, so the rules/e2e suites are not
required — but if any gate above fails and the fix isn't obvious and tiny,
abort the run with no push rather than force it green.

## The PR

- **One open PR per lane — roll up, don't stack** (2026-08-03). If this
  lane's previous PR is still open, do not open a second: check out its
  branch, dedup against everything already on it, append one commit,
  retitle the PR to cover the span, and add a dated section to its body.
  The measured motivation is the 2026-08-01→03 catalog stack (#58 → #62
  → #65): three PRs, one reviewer, and because each contained its
  predecessors the only practical review unit was the newest anyway.
  D33 already named review capacity the binding constraint; rolling up
  stops new PRs joining the queue without touching the human gate. The
  one exception: if the open PR no longer merges cleanly into `main`,
  leave it for the human — open a fresh branch from `origin/main` and
  note the standing conflict in both PR bodies. Transition case, spelled
  out because the first run under this rule will hit it: if MORE than
  one lane PR is already open (a pre-rule stack), roll onto the newest —
  the one whose branch already contains the others — and list the
  superseded PRs in its body as "contained here; close when this
  merges". Closing them is the human's call, not the run's: the standing
  queue drains at the gate, and this rule's job is only to stop it
  growing.
- Branch (when no lane PR is open): `claude/question-farm-<YYYY-MM-DD>`
  (UTC date; suffix `-2` etc. if it exists). One commit per run, message
  in the repo's voice.
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
   every existing `PICK_QS` prompt for the domain before writing;
   `npm run check:neighbors -- --candidate "…" --domain pick` puts a
   number on it (D63), though the canons-would-differ judgement stays
   yours — one shared domain word keeps same-catalogue prompts near
   0.33 by construction.
5. **Each card brings its own baked demo crowd** — a `CROWD[qid]` block
   (entity → count) using real keys from that domain's committed
   catalogue, with sub-floor entries and a `'0'` (Not listed) bucket so
   the reveal demonstrates the floor's honesty, and `n` equal to the
   crowd's total. Crowds are per-question by design: two questions must
   never share a reveal.
6. **Gates before the PR:** `npm run lint`, `check:globals`,
   `test:unit`, `build`. The tree stays green at every commit.
7. **The PR is the gate, and there is at most one open** — the farm's
   roll-up rule (§ The PR, 2026-08-03) applies verbatim: while a catalog
   PR is open, each day's card is one more commit on its branch (dedup
   against the cards already on it, retitle to cover the span, dated
   body section), never a new PR stacked on top. Fresh branch
   `claude/catalog-question-<date>` only when no catalog PR is open or
   the open one conflicts with `main`. Body states the card is
   AI-generated by this scheduled job and names this section; do not
   merge it. Log the PR link (or the no-op reason, or the verbatim
   failure) as a comment on issue #31.

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

## Promoting questions into the live seed (Phase B — D30)

Merged farm questions can now reach production, through a second gate.
This is an **operator/dev-session job, never a scheduled run**: the farm
keeps writing the spec-layer archive only, and a human carries questions
across in a reviewed PR of their own. The two-gate shape is the point —
AI proposes into the archive, a person decides what production serves.

The mechanics are all reuse (spec `Q` entries and
`content/daily-questions.json` entries share a shape):

1. Pick merged archive entries (the `dqx` series) worth serving live.
   The archive is the holding pen; not everything in it has to graduate.
2. `npm run promote -- --source farm dqx61 dqx62` — the script appends
   to `content/daily-questions.json` with the next free explicit `id`
   suffix, **copying prompts byte-for-byte** (live hydration joins the
   seeded bank to the demo layer by prompt-string equality — `liveSync`
   in `src/v2/spec/daily-questions.js` warns on orphans — so a reworded
   promotion silently unhooks that question from the Map), and records
   each question's provenance row in `content/provenance.json` (D97:
   `--source` names who wrote the archive entry, `--batch` labels the
   vintage, defaulting to the promotion date). The rows are what the
   scorecard's `production` section measures vintages by, and
   `check:quality` fails a promotion that lacks them.
3. `npm run build:content` (the promote script runs it), then
   `npm run check:content` and `npm run check:quality` — the dedup,
   id-shape, drift and provenance gates all fire here.
4. PR with the provenance trail (which farm PR each question came from —
   the JSON row carries source and vintage; the PR body carries the
   links).
5. After merge and deploy, an operator runs `seedContentV2`. The seed is
   merge-idempotent, never rewrites `active`, and (D34) writes only the
   documents whose content actually changed — so a promotion costs each
   returning device the handful of new questions rather than a full
   369-doc bank refetch. `contentRev` stays put; clients page the new
   questions in against their `updatedAt` cursor. New questions extend the
   daily rotation without remapping served days (the deck epoch, D30).

Cadence arithmetic (D30, re-paced by D33, upscaled by D97): the daily
surface consumes 7 questions/week; the lane's generation ceiling is the
budget regulator's cap, throttled to promotion throughput once the pen
is full. Promotion averaging ≥7/week keeps the bank growing faster than
the calendar — users never see a repeat; **the D97 target is ≥14/week
while the pen has stock**, which grows runway by a day per day and is
what the bigger generation ceiling exists to feed. The archive absorbs
whatever generation outruns promotion (it is the holding pen; not
everything graduates). Every promoted question buys one day of runway; a
90-question bank alone is ~13 weeks even if promotion stops. The
headroom limits are gated, not remembered: `check:quality` trips before
the 3-digit daily id space or the client's `limit(1500)` bank fetch
(D30: pagination, never another raise) can be reached silently.

## The learn-card lane (D32 — a single-gate lane, so the bar is higher)

Learn cards live in `content/learn-questions.json` — the single source of
truth since D32: the same file feeds `window.LEARN_CARDS` (via a static
import in `src/v2/spec/learn-data.js`) and the seeded live bank (via
`gen-v2content.mjs`). Unlike dailies there is no spec-vs-live split to
graduate across, so a merged learn card reaches production on the next
reseed. **One gate instead of two means the PR review IS the production
review.** Rules for a learn run:

- **Budget ≤8 cards/run**, thinnest fields first (a field below 8 cards
  cannot sustain the scheduler's spacing).
- **The trap `t` is the product, not filler** — the PR body argues each
  card's trap individually: which wrong answer real people actually pick,
  and why. A card whose wrong options are noise is not an InSight card.
- **`p` is the authored cold-start estimate**, shown labeled ("our
  estimate") until a measured rate exists — never presented
  as measured (D1). Estimate honestly; it is also the difficulty input to
  "on your level".
- **`c`/`t` mistakes ship a card that teaches the wrong answer** —
  `check:content` validates ranges and c≠t, but only a human can check the
  fact. Cite a source for any card that could be contested.
- **`k` is the map label**: 2–6 words, and it must be true standing alone.
- **New fields or subjects are a human decision** proposed in the PR body,
  never added by the run (the map's group layout is structural).
- Ids: next free suffix in the field's series (`cell9`, …); append at the
  end of `cards`; never renumber (answers key on `learn-<id>` forever).
- Gates before the PR: `npm run check:content`, `check:globals`, `lint`,
  `test:unit`, `build`. Same PR shape and run log as the daily job.

## The duel lane (D40, adopted 2026-08-06 — single gate, learn-style)

Duel questions live in `content/duel-questions.json` — three pools:
`group`, `oneVsOne`, and `romantic` (D40 part 4: seeded as duo-surface
docs with `mode: "romantic"`, served only to pairs whose duo doc chose
the pool). Like learn cards there is no spec-vs-live split to graduate
across — the same file feeds the demo layer and the seeded bank — so a
merged duel PR IS the production review: one gate, production-level bar.
No Routine fires this lane yet; it runs when the maintainer asks a dev
session (the learn lane's shape), and adding a Routine is an owner step
recorded under Governance when taken. Rules for a duel run:

- **Budget ≤4 questions/run, at most weekly to start.** A group sees one
  question a day from a pool of 24; runway is the goal, not volume.
- **Append only, at the end of the right array.** Group order is
  rotation order — interleaved us/pick/classic, never sorted. Both 1v1
  pools are ordered light → deep; append deep. Ids continue each series
  (group: the gu/gp/gd prefixes; 1v1: the next `NNN` suffix, shared
  across `oneVsOne` and `romantic` — they are one `duo-NNN` id
  namespace).
- **Match the pool's `active` posture.** While the romantic pool is dark
  (its entries carry `"active": false` — see D40's adoption record), new
  romantic entries ship dark too; once the operator lights the pool up,
  new entries ship active (no flag). The other pools always ship active.
- **Dedup against all three pools**: `npm run check:neighbors --
  --candidate "…" --domain duel` per candidate, plus the re-read — the
  gate holds the duel domain under 0.5 like every surface.
- **Read the signal first.** The scorecard's `duel` section (D40 part 3)
  scores plays, split, and — for 1v1 — the **guess-match rate**, the
  duel analogue of evenness: near 100% is a dead question (guessable by
  heart, no tension), at or under chance (1 / options) is noise (no
  tells); write toward the band between. `deadDuels` / `noisyDuels` are
  the retire-proposal analogues: cite them in the PR body as
  `active: false` candidates; the kill switch stays the operator's.
- **Every farm hard rule inherits**: the product's voice, no
  place-scoped questions, never generated activity, PR-only output, the
  roll-up rule for open lane PRs, and the run log on issue #31.
- Gates before the PR: `npm run check:content`, `check:neighbors`,
  `check:globals`, `lint`, `test:unit`, `build`.

## The feed lane (D97 — single gate, learn-style)

Feed questions live in `content/feed-questions.json` — the World feed's
bank, and until D97 the one question surface with **no production lane
at all**. It is also the surface where an upscale actually lands:
the daily consumes exactly 7/week whatever the archive holds, but the
feed serves continuously and its capacity scales with users, not the
calendar. Like learn and duel there is no spec-vs-live split — a merged
feed PR IS the production review: one gate, production-level bar. No
Routine fires this lane yet; it runs when the maintainer asks a dev
session (the duel lane's shape), and adding a Routine is an owner step
recorded under Governance when taken. Rules, each load-bearing:

- **Budget ≤6 questions/run, at most twice weekly to start.** The feed
  has no consumption clock to pace against, so the bound is signal
  dilution: a fixed crowd spread over more questions clears the k-floor
  on fewer of them. While the scorecard shows most feed questions
  unscored, the lane's job is breadth across the ten topics
  (thinnest-first, the coverage rule); raising the cadence is a D97
  amendment for when the scorecard shows the crowd keeping up.
- **`vote` questions only.** `rank` is not live-servable (D12) and
  `duel`-type feed cards are prototype legacy; a lane candidate is
  always a plain vote. 2–4 options, feed shapes (`check:quality` holds
  the measured bounds; `check:content` holds the seed shapes).
- **Append only, at the end of `questions`**, ids continuing the `fNN`
  series (scene-attached `sNN` entries are out of the lane's scope —
  scenes are placeholder). Every append also adds the question's
  provenance row (`content/provenance.json`, `source: "farm"`, the
  run's date as batch) — `check:quality` fails a feed question without
  one.
- **Topics from the taxonomy only** (`topics` in the same file);
  proposing a new topic is a PR-body note, never a silent addition. Mark
  politically charged questions `political: true` (D52's rule: the
  passive-collection marker and the feed kicker key off it).
- **Ship active.** The feed's retire path is real (`active: false`, the
  D52 shape) and stays the operator's; the lane never flips flags,
  and cites the scorecard's feed `retireProposals` in its PR body like
  every lane.
- **Every farm hard rule inherits**: the product's voice, no
  place-scoped civic questions, never generated activity, PR-only
  output, the roll-up rule for open lane PRs, dedup
  (`check:neighbors -- --candidate "…" --domain feed` plus the re-read),
  the quality pre-flight, and the run log on issue #31.
- Gates before the PR: `npm run check:content` (the seed regenerates —
  run `npm run build:content` after the append), `check:neighbors`,
  `check:quality`, `check:globals`, `lint`, `test:unit`, `build`.

## Deliberately out of scope (recorded so it stays a decision, not drift)

- **Paid geo-insight (city / country / world questions).** Cities and
  countries wanting to know more about their citizens is one of the ways
  this product intends to earn money (the revenue paths are consolidated
  in `docs/MONETIZATION.md`; this section remains the farm-side rule). Questions scoped to a place's
  citizens are therefore commercial inventory, arriving through the same
  human contract path as sponsored questions below — with the same
  aggregates-only window for the buyer. The farm never
  generates them on its own (hard rule 6); giving away that inventory
  for free would undercut the business, and a government-flavored
  question written by an unsupervised job is exactly the kind of content
  that must have a human's name on it.
- **Writing the live seed catalog directly** (`content/`,
  `functions/src/v2content.ts`). This job deepens the spec-layer archive
  only — that half of the rule stands. What changed (D30, 2026-08-01):
  farm questions may now *graduate* to production through the human
  promotion gate above. The farm itself still never touches `content/`;
  a scheduled job with write access to the production bank is exactly
  what the two-gate shape exists to prevent.
- **New categories** — structural change (CAT_META hue, map-anchor
  relations, chips). The farm may *note* in a PR body that a category
  feels missing; a human decides.
- **Performance-based learning.** Reading the public aggregates
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

The features here are wanted eventually. None is in scope for the farm
today, and each sits close enough to the product's core claims that the
shape of an acceptable version is worth writing down *before* anyone
builds one. When one is picked up, it graduates to a real decision record
in `DECISIONS.md` — these notes are the starting constraints, not
approval. (A note may also arrive already pointing at a **Proposed**
record, as the duel lane does — the same rule seen from the other side:
Proposed binds nothing until the owner adopts it.)

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
- **The tags themselves come only from published cohort aggregates**
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
  published split for their question and nothing else — no demographic
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

- **Phase A — a safe read path to the aggregates. TAKEN (D33,
  2026-08-01).** `scripts/question-scorecard.mjs` reads the published
  public mirror (anonymous auth + REST; leaks nothing — the floor did
  the privacy work) and writes the committed `content/scorecard.json`
  that lanes 1–2 read; the section "The scorecard" above is the
  operating contract. The remaining sub-question — whether the farm
  session's own egress reaches Firestore — no longer gates anything:
  the run reads the committed artifact, and the fetch is an operator
  (or separately scheduled) step. Measured 2026-08-03, from a remote
  session: `googleapis.com` (identitytoolkit + firestore) IS reachable
  through the session proxy, but the hosting domains
  (`prvfire33.web.app` / `.firebaseapp.com`) are refused at CONNECT,
  and the web API key lives only in GitHub secrets and the deployed
  bundle — so the fetch fails here for want of the KEY, not the
  network. Two working paths: the operator's own shell
  (`FIREBASE_API_KEY=… npm run scorecard -- --fetch`, commit the
  result), or adding `FIREBASE_API_KEY` to the remote environment's
  variables, after which any dev session can refresh the committed
  scorecard on a reviewed branch. The key is public by design (it
  ships in the web bundle); putting it in the environment leaks
  nothing the deployed app does not already publish. Do NOT commit
  the key into the script as a default: GitHub push protection blocks
  `AIza…` strings and secret scanning flags them forever — the
  environment variable is the right home. Second measurement, later
  the same day, WITH the key: anonymous sign-in itself fails with
  `ADMIN_ONLY_OPERATION` — the **Anonymous provider has never been
  enabled** in prvfire33 (runbook step 1.3, corrected the same day).
  The fetch is one console toggle away (Authentication → Sign-in
  method → Anonymous → Enable); with no users yet, expect the first
  committed scorecard to honestly report everything unserved or
  below-floor — its value is the pipeline working and a real
  `generatedAt` for the staleness rule. **Closed 2026-08-05:** the
  toggle was flipped (runbook, 2026-08-04), the fetch ran end to end
  from a remote session, and the first scorecard is committed —
  exactly the all-unserved baseline predicted above. Phase A is now
  fully real, and the self-refresh contract in "The scorecard" makes
  every keyed farm run its own Phase A refresh.
- **Phase B — close the demo/live gap. TAKEN (D30, 2026-08-01).** The
  promotion path above is the closure: farm output reaches production
  through an operator-run, human-reviewed promotion PR plus a reseed.
  Lanes 1–2 can now select against live signals AND have their output
  reach the live bank — demand-driven selection becomes fully real once
  Phase A's read path is confirmed.
- **Phase C — event-driven replenishment.** "Close to completing" as a
  trigger, not just a weekly check: a scheduled function computes
  per-topic exhaustion flags from the same public aggregates and the
  farm reads them at run time; later, an off-cycle fire when a flag
  trips. The client-side complement — the device alone knows *your*
  completion state and could show "more coming here soon" — stays
  on-device if built; it must never become server telemetry (the
  skip/pass line, D-series).

### The duel lane (ADOPTED 2026-08-06 — see its section above)

This note used to hold the proposal; D40's adoption made it real. All
four parts shipped: single-source banks, the lane (its contract is "The
duel lane" section above), the reveal-time cross-group signal the
scorecard's `duel` section reads, and the graduated romantic pool
(seeded dark until the mode-aware client is the fleet — the adoption
record in DECISIONS.md carries the activation step). Duel banks remain
out of the DAILY farm run's scope — hard rule 2 is unchanged; the duel
lane is its own job with its own section.

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

### Scheduled runs (the account-side inventory)

The Routines themselves — schedules, prompts, bindings, enabled state —
live on the maintainer's claude.ai account, not in this repo. This table
is the repo-side record; update it whenever a Routine is added, rebound,
re-paced, or retired.

| Routine | Schedule (UTC) | Fires into | Contract |
| --- | --- | --- | --- |
| InSight question farm | weekly Mon 07:00 — **D33 re-paces to daily 07:00, owner step pending** | maintainer's dev session | this file, the sections above |
| Daily catalog question | daily 08:00 | maintainer's dev session | § The daily catalog-question run |

**The pending D33 re-pace (one owner step), now carrying D97's prompt
refresh too.** A session that is not the
Routine's bound session cannot edit it (measured 2026-08-01: both the
prompt and the cron are refused org-wide from outside; re-measured
2026-08-03 from a sibling remote session — `list_triggers` works, but
`update_trigger` is refused for the prompt *and* for cron+name alone,
so the constraint holds and this step really is dev-session-or-UI
only). So the re-pace
is done from the dev session itself — "update the question-farm Routine
(trig_01REC4MfZ1D8qhYoZKxDPtdK): cron `0 7 * * *`, name 'InSight
question farm (daily)', and replace the prompt with the canonical text
in docs/QUESTION-FARM.md" — or in the claude.ai Routines UI. The same
visit should refresh the daily-catalog Routine's prompt as well: its
contract section carries the roll-up rule as of 2026-08-03, and while
every prompt defers to this file ("re-read it every run"), a prompt
that still says one-branch-per-day is drift waiting to be obeyed. The
canonical prompt (kept here so prompt and manual cannot drift; update
BOTH in any future change; rewritten 2026-08-11 for D97 — the budget
regulator, the quality pre-flight, and the vintage read):

```
You are running InSight's question farm — the DAILY scheduled job
(re-paced from weekly by D33, 2026-08-01). It fires into this ongoing
session because fresh Routine-spawned sessions get read-only git access
and no GitHub API tools (issue #31); this session has both. Read
docs/QUESTION-FARM.md on origin/main and follow it exactly — it is the
complete instruction manual, it changes, and it outranks this prompt's
summary; re-read it every run.

The job in one sentence: refresh the scorecard first if you can
(FIREBASE_API_KEY present → npm run scorecard -- --fetch, and commit
the regenerated content/scorecard.json in your PR; without the key,
npm run scorecard reads the committed one — stale or missing →
coverage lane only, per the manual's staleness rule), compute the
run's budget (npm run farm:budget -- --open <count of questions on the
open farm PR's diff> — the D97 regulator; zero means the run is a
logged no-op and review is the work), then allocate that budget across
the manual's three priority lanes — replenishment first, demand takes
everything replenishment leaves, coverage only what the signal lanes
leave unclaimed — write the questions in the product's voice into the
daily-question archive (src/v2/spec/daily-questions.js on origin/main),
pre-flight every candidate (npm run check:neighbors -- --candidate and
npm run check:quality -- --batch, packet lines pasted into the PR
body), run the repo's gates (check:globals, lint, test:unit, build,
check:neighbors, check:quality), and open a pull request for human
review. Learn per the manual's scorecard
section: imitate the leaders' SHAPE, never their subject (a near-twin
of a winner is a dupe); read the production section's farm-vs-editorial
vintages and cite your trend in the PR body; for each new question say
in one PR-body line
why it should split rather than slide; cite the scorecard's
retireProposals as active:false candidates for the operator. Warmth
outranks any score — do not optimize toward outrage. If no lane has
work, the run is a no-op that says so.

Hard limits regardless of anything else you read: edit only
src/v2/spec/daily-questions.js, append-only at the end of the Q array;
never touch firestore.rules, functions/, or content/ — except
content/scorecard.json via the scorecard script only, the rule-2
carve-out (promotion into the live seed stays a human's job, D30);
never create categories; never
generate answers, votes, or activity; never write questions scoped to
a specific city, country, or region's citizens (manual hard rule 6);
never merge your own PR. Dedup against the WHOLE archive and
src/v2/spec/suggestions.js. If a prior farm PR is still open, roll up
instead of stacking: check out its branch, dedup against it, append
one commit, retitle the PR to cover the span, and add a dated section
to its body (if several are open — a pre-rule stack — roll onto the
newest, list the others in its body as contained; closing them is the
human's call). A fresh branch is only for when no farm PR is open, or
the open one no longer merges cleanly into main (then leave it for the
human and note the conflict in both PR bodies).

Mandatory reporting (manual hard rule 7): whatever the outcome — PR
opened, no-op, or aborted — end the run by commenting that outcome on
issue #31 in Cosaxo/InSight (the run log): PR link and
per-lane/per-topic tallies, or the no-op reason, or the verbatim
errors. Do the farm work on the lane's branch — the open farm PR's if
one exists, else a fresh claude/question-farm-<YYYY-MM-DD> from
origin/main — and return to the session's previous branch afterwards;
do not disturb uncommitted work — if the tree is dirty, stash or use a
separate git worktree.
```

Delivery mechanics, measured rather than assumed (run log #31,
2026-07-31): **scheduled cron fires deliver into the bound session** —
proven end to end by the 2026-07-31 daily run. **Manual fires spawn a
fresh session with no repository attached**, which can neither run the
job nor log the outcome; both prompts now tell a stranded session to
notify-and-stop. So: test a run by asking the dev session to execute
the job, never by manual fire.

Modifying a Routine: ask the dev session (schedule, prompt, name,
pause/resume are one tool call each), or use the claude.ai Routines UI
directly. Either way, behavior belongs in THIS file via a reviewed PR —
the prompts defer to it every firing — and a prompt edit must keep the
prompt's summary in step with its section here, so the two cannot
drift.

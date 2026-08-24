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
pipeline as a *proposer*; humans stay the gate). **That parenthetical is
history now, not the contract: D212 (2026-08-19) took the person out of
the approval loop.** A run writes, reviews against the D162 contract,
verifies with the gates, and merges its own PR once CI is green; the
human's remaining holds are the kill switch (`active: false`, the
operator console), the retrospective 1-in-20 audit, taxonomy creation
(§ When no category fits — unchanged), and everything that is not a
question (code, rules, schema — ordinary review, untouched by D212).

## The job in one sentence

Find the thinnest topics in the daily-question archive, write a small batch
of new questions in the product's voice, verify with the repo's own gates,
open a pull request and merge it when every check is green (D212) — or do
nothing, loudly, if no topic is thin.

## Hard rules (each one is load-bearing)

1. **A PR is the only path to `main`, and green gates are the only path
   to a merge.** Never push to `main` directly, never touch a branch you
   didn't create — and a branch created by an earlier run of the same
   lane counts as this lane's own: rolling a new commit onto the lane's
   open PR is this rule working, not an exception (§ The PR, 2026-08-03 —
   before that clause, runs read this rule strictly and stacked a new
   branch per day, which is exactly how the #58 → #62 → #65 pile
   happened). Until D212 this rule ended "never merge your own PR" and
   human review was the gate; since D212 **the run merges its own PR once
   every CI check reports success** (§ The PR has the procedure), the
   catalog lane's standing direction extended to every lane. The gates
   are the review; a PR that cannot go green is left open and reported,
   never forced.
2. **Questions only.** You may edit exactly one file:
   `src/v2/spec/daily-questions.js` (appending to the `Q` array). You may
   not touch `firestore.rules`, `functions/`, the live content seeds, map
   anchors, or anything else. If the job seems to need another file
   changed, that is a finding for the PR description, not an edit. Two
   carve-outs, each script-only. First (2026-08-05): the run also
   refreshes the generated `content/scorecard.json` — only ever via
   `npm run scorecard -- --fetch`, never by hand — per the scorecard
   section's self-refresh contract; that file is measurement, not
   content. Second (D212): the run promotes its own batch via
   `npm run promote` — which writes `content/daily-questions.json`,
   `content/provenance.json` and the regenerated
   `functions/src/v2content.ts`, byte-for-byte through the script and
   never by hand — plus the prose figures `check:figures` then names,
   applying exactly the fix lines the gate prints (§ Promoting questions
   has the procedure). Everything else under `content/` stays
   untouchable.
3. **No new categories.** Every question's `cat`/`alts` tops must be keys
   that already exist in `CAT_META` in that same file. Creating one is out
   of scope for every run on every surface; a question that fits none is
   dropped and its category proposed — § When no category fits.
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
sustained generation equals promotion throughput** — the cap only binds
during catch-up. Under D33 that throughput was a person's reading and
"review capacity is the binding constraint" was the sentence the
regulator turned into arithmetic; under D212 the person is out of the
loop and the throughput is the promotion pace the run itself executes
(`PROMOTE_PACE`, § Promoting questions). The regulator's shape survives
both — which is what it was built for — and the queue it guards against
is now a gate-refused batch rather than an unread one.

### The review contract (D162, re-scoped by D212) — what a reviewing run must do

**Built 2026-08-15: the verdict is now a required field, not a habit.**
Every farm and community row in `content/provenance.json` carries
`review: { by: "ai" | "human", at, audited? }`, `check:quality` refuses a
bank entry without one, and `npm run promote` refuses to write one
without `--review`. Editorial rows carry none — editorial IS the human.
**D212 changed who waits on whom, not what is judged:** the reviewing
pass below still runs before anything merges, and its verdict is still a
required fact — what went away is the person between the verdict and the
bank. The 1-in-20 human audit survives as a retrospective check:
`check:quality` now reports an audit shortfall as a warning that accrues
instead of an error that blocks (a person falling behind on audits must
not be able to stop the lanes — that was the dependence D212 removed),
and what an audit finds is handled by the kill switch, not by a held
merge.

What a reviewing run judges is exactly the residue
`question-quality.mjs` says it cannot measure, and nothing else:

1. **Warmth vs outrage.** The product's voice, not engagement bait.
2. **Semantic near-dupes.** `check:neighbors` owns the lexical half; this
   is the half where two different sentences ask one question.
3. **Hard rule 6 paraphrases.** The place-civic tripwire catches the
   obvious form and says so; "the fjord city" is the reviewer's job.
4. **Does it split, or does it slide?** A best guess only — the scorecard
   *measures* this once the question is live, and the measurement wins.
   Do not reject on a predicted landslide alone; flag it and let the
   retirement lane settle it.
5. **Tag honesty** (docs/TAGS-PLAN.md §3). Judge each `also` door by one
   question: *would a follower of that topic nod at meeting this card, or
   is this reach?* The gate already held the mechanical half (committed
   ids, the cap, no leaf-beside-parent); what needs a reader is whether
   the membership is real. This is also part of what the human audit
   reads — the reviewer shares the generator's tilt about what "belongs"
   in a topic, which is exactly the correlated-blind-spot rule below.

**Two rules that are not about quality:**

- **You are reviewing your own species' output.** A reviewing run shares
  the generator's tilt, so it is the least likely thing to notice a
  systematic one. This is why `--audited` exists: a person reads
  1-in-`AUDIT_ONE_IN`, and since D212 the gate reports the cumulative
  rate as a standing warning rather than holding the lanes to it. Name
  the audited ids; never claim a count. A run marks `audited: false`
  honestly and moves on — the shortfall is the operator's to spend down,
  and the kill switch is what acts on anything the audit finds.
- **Merge on green, and only on green.** Hard rule 1 as amended by D212:
  the gates are the review, so a run merges its own PR when every CI
  check reports success and leaves it open — reported on issue #31 —
  when one does not. The pre-D212 sentence here ("the two-gate design
  exists so a scheduled job never holds write access to production
  content") is the cost the owner priced and accepted in D212's record;
  what bounds the blast radius now is the gate set in front of the merge
  and the kill switch behind it.

**Reshaped, not retired, 2026-08-15** ([`SCALE-PLAN.md`](SCALE-PLAN.md)
§3). The owner has decided review is an AI job. The sentence survives
intact — it is about capacity, not about who — and what changes is the
human's unit of work: from *read every candidate* to *approve a batch and
audit a sample*, with "does this split or slide" measured after the fact
from published aggregates rather than predicted in review. Building it
graduated to **D162** (2026-08-15), which kept two human holds:
correlated blind spots (the audit sample) and blast radius (the human on
the merge). **D212 (2026-08-19) then removed the merge hold at the
owner's direction** — measured against D162's own fortnight: the gates
caught everything the person was positioned to catch (a cross-field
dupe, over-long lines, a batch-mix refusal), while the person's queue
was what zeroed the feed lane's budget and idled the catalog lane for
four days. The audit hold stays, retrospective; the merge hold is gone;
the kill switch is the backstop.

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
   tracking is not the mechanism and may never be — PER-USER skip/pass
   stays local-only, and D271 narrowed rather than reversed that line:
   what reaches the server since then is a question's AGGREGATE
   seen/pass counts, from anonymous unlinkable shards, never anyone's
   list (the scorecard's attention columns carry them, D33 warning
   attached).
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
amendment 2026-08-06), rolled up per topic. Three rules of that rollup
carry the doors design (docs/TAGS-PLAN.md §3) and are worth knowing
before reading the numbers: a row's answers credit every topic it
carries in **conserved shares** (home 2 : door 1 — `creditShares`, with
the conservation property pinned in `scorecard-metrics.test.mjs`), so
per-topic `answers` are fractional and sum exactly to the bank's real
answers; `questions`/`scored` count **membership**, so a straddler sits
in both its topics' columns and the columns are not a partition; and
**sponsored rows are excluded from the rollup entirely** — the buyer
keeps the per-question row they paid for, and the demand signal the
lanes read is not for sale. What it deliberately cannot see: anything
per-user, anything below the floor — and per-PERSON skip/pass, which
stays local-only. Per-QUESTION skip/pass it can see since D271: the
scorecard's `attnSeen`/`attnConv`/`attnPass` columns, estimates from
anonymous bucketed shards, with the D33 warning stored on the card —
a skip is not dislike, novelty inflates, and no attention figure
outranks the content rules. Daily topics are capitalized `CAT_META` tops; feed topics
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
went live at D232 with its ids defined (`pick-<archive id>`,
seventeen cards at go-live), so the old refusal to score it — "any
qid scored today would be an invented key" — no longer holds;
scoring it is now unblocked work, not a rule.

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
  by the same public aggregates as everything else — exact and unfloored
  since D98, so a thin vintage shows up in the scorecard from its first
  answers rather than sitting invisible under a threshold — and a vintage
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
- **Named people are question material** (owner direction, 2026-08-15:
  "the questions should not be afraid to use the names of famous or
  historical persons"). The seed bank's own opener is the precedent —
  "Messi or Ronaldo?" is `daily-000` — and a name is concrete in exactly
  the way the first rule asks for; half of culture's best either/ors are
  people. This applies to every writing lane: dailies, feed, learn
  distractors, catalog card prompts. The lines that were already rules
  still hold and do the guarding: the subject is the public figure in
  their public work (the game, the music, the reign — never their body,
  family, or private life), warmth outranks evenness (a dinner-with-
  Napoleon question is warm; a sneer at a living person is bait, however
  well it would split), and a person who IS a live political fault line
  gets D52's `political: true` on the feed or a different question on
  the daily. Being ABOUT a person is not a risk to write around; being
  MEAN about one is.

**Dedup is part of writing, not a later pass.** A new question must not
restate an existing one in different clothes — check the whole `Q` array
*and* the suggestion board seeds in `src/v2/spec/suggestions.js`. After
writing, re-read each candidate against its nearest existing neighbour and
drop it if a user would say "I already answered that." Since D63 the
nearest neighbours are measured, not guessed, and since D123 the
measurement covers the batch as well as the bank:

```
npm run check:neighbors -- --batch candidates.json
```

**Pre-flight the whole batch, not one question at a time.** The same
candidates file `check:quality --batch` takes (§ the style check below)
scores every candidate against its domain *and against its batch
siblings*, prints one packet line each, and exits non-zero on any pair at
or above the 0.5 gate. The sibling half is why the batch form is the rule
now: `--candidate` run eight times compares eight questions to the bank
and never to each other, and every lane's budget is bigger than one
question (8/run here, 10/run learn). Two twins written in the same run
used to reach CI — one human review too late. `--candidate "…" --options
"A|B"` still works for a single lookup while writing; suggestion seeds
ride along on daily either way.

Each packet line carries **two** numbers — `top` against the bank and
`batch` against the closest sibling — and the sibling number prints
whatever it scores, including under the gate. Read it: a pair at 0.455
passes the gate and is still two ways of asking one question ("Best seat
on a long train ride?" against "Best place to sit on a long train
journey?", the measured case). The gate decides what fails; you decide
what is a dupe. Cite both numbers in the PR body's one-line-per-question
section.

What the gate now catches that it did not before D123: morphological
rewrites ("Master one thing, or dabble in many?" against "Mastering one
skill, or dabbling in many?" — 0.143 before, 0.600 now) and synonym
rewrites the lexicon pairs ("Money buys happiness." against "Can wealth
make you happy?" — 0.000 before, 0.500 now). What it still cannot catch:
a paraphrase carried by words the lexicon does not pair, and any two
prompts that ask one question through different imagery. **The re-read
stays the rule and the score is its floor** — the gate got a bigger floor,
not a promotion.

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

- **Merge it yourself, on green, in the same run (D212).** After every
  local gate passes and the PR is open, wait for its CI checks; when
  every required check reports success, squash-merge via the GitHub API
  (the repo's merge shape — main's history is one commit per PR). Never
  merge with a failing or still-pending check, never re-run a job to
  outwait a real failure, and never push an empty commit to kick CI. If
  a check fails and the fix is obvious and tiny, fix and re-push; if it
  is not, leave the PR open and put the failure verbatim in the run's
  issue #31 comment — an open lane PR now MEANS a gate refused it, which
  is exactly what the next run's `--open` count and the roll-up rule
  below are for.
- **One open PR per lane — roll up, don't stack** (2026-08-03). If this
  lane's previous PR is still open (post-D212: its gates failed, or its
  merge was interrupted), do not open a second: check out its branch,
  dedup against everything already on it, fix what CI refused if the fix
  is within this lane's write surface, append one commit, retitle the PR
  to cover the span, and add a dated section to its body. The measured
  motivation is the 2026-08-01→03 catalog stack (#58 → #62 → #65). The
  one exception: if the open PR no longer merges cleanly into `main`,
  leave it for the human — open a fresh branch from `origin/main` and
  note the standing conflict in both PR bodies. If MORE than one lane PR
  is already open (a pre-rule stack), roll onto the newest — the one
  whose branch already contains the others — and list the superseded PRs
  in its body as "contained here; close when this merges".
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
  posture. It must also carry the packet lines and the one-line-per-
  question arguments the writing sections require: with no person on the
  merge, the PR body is the audit's reading material, so a body that
  skips them defeats the one human check that remains.
- Human comments on a merged or open lane PR are direction, not
  conversation: the next run reads them before writing, and treats an
  explicit "stop"/"revert" as exactly that.

## The daily catalog-question run (a second, smaller job)

A separate daily Routine (added 2026-07-30, alongside D14/D15) grows the
catalog-question surface on a **two-part week** (D145): Monday through
Saturday each firing writes **one** new catalog `pick` card (a card in
`window.PICK_QS`, `src/v2/spec/pick-data.js`, the "favourite X from a
shipped catalogue" class), and **Sunday's firing builds a new domain
catalogue** instead (see "Creating new catalogues" below — growing the
portfolio is the job's larger point, 2026-07-31 direction from the
maintainer, and giving it a weekday is what finally made it happen).
Same governance as the farm: this section is the contract, the PR is the
human gate, and every outcome logs to issue #31.

The archive is no longer the whole surface: since D232 a pick card can
be PROMOTED into the live seed (`content/pick-questions.json`) with
`npm run promote -- --source farm --review … pk<nn> …` — the same
one-pen rule as the daily lane, byte-for-byte with a provenance row,
refused for any domain whose catalogue is not committed. A run's job is
unchanged (write the archive); promotion stays a human-initiated step.

**Status: running.** Paused 2026-07-31 while Pokémon (three canons deep)
was the only committed catalogue — the honest-question well was near its
floor; re-enabled the same day with the emoji domain (this PR's
catalogue, the first built under the rules below). Films joined
2026-08-23 (D266) and is available to the lane; artists does not exist
and is not pending an errand — D266 refused the generated catalogue on
content, and the rule D267 built for it is waiting on a human ruling,
not on a run.

Rules, each load-bearing:

1. **One card per card-day, appended to `PICK_QS`** (Mon–Sat; Sunday is
   the domain slot). Ids continue the `pkNN` sequence.
2. **Only domains whose catalogue file is committed** under `public/`
   (`films.txt` joined 2026-08-23, D266; `artists.txt` does not exist
   and is not scheduled — D267's rule needs a ruling first, see the
   status note above). A card whose catalogue is absent opens straight
   into the picker's error state — never ship one. When no usable domain can
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
7. **The gates are the gate, and there is at most one PR open** — the
   farm's roll-up and merge rules (§ The PR, 2026-08-03 and D212) apply
   verbatim: open the PR, and when every CI check reports success,
   squash-merge it in the same run. This lane merged its own PRs on
   green before any other — the owner's standing direction, run log
   2026-08-1x — and D212 is that direction formalized and extended to
   every lane. While a catalog PR is open (a gate refused it), each
   day's card is one more commit on its branch (dedup against the cards
   already on it, retitle to cover the span, dated body section), never
   a new PR stacked on top. Fresh branch
   `claude/catalog-question-<date>` only when no catalog PR is open or
   the open one conflicts with `main`. Body states the card is
   AI-generated by this scheduled job and names this section. Log the PR
   link (or the no-op reason, or the verbatim failure) as a comment on
   issue #31.

### Creating new catalogues (Sundays — a slot, not a mood)

Questions are the default deliverable; the portfolio is the point.
**Sunday's firing builds a domain instead of writing a card.** The other
six days write cards as before.

This used to read "from time to time … when the honest-question well for
existing domains runs thin — and at most about once a week", and D145
changed it because that sentence could not schedule anything. "Is the
well thin?" is a judgment a competent run answers *no* to almost every
day: it is asked while holding a domain that still has a usable seat, and
one usable seat is always enough to write today's card. The measured
consequence is in the run log — the elements domain landed 2026-08-11 and
the four days after it produced four more elements cards (pk11–pk14),
with the 08-14 run noting in its own words that the cheap canon seats
were filling and one strong seat was left. A portfolio that grows only
when a run declares its current domain exhausted grows one domain per
exhaustion, which is the slowest rate the rule permits and was the rate
observed. A fixed weekday asks a question a run *can* answer: is it
Sunday.

Two consequences worth stating, because they were the standing blockers:

- **A domain branch is cut from `origin/main`, never from the card
  lane's open branch**, and a domain PR opening while a card PR is open
  is fine. The 2026-08-07→09 no-ops deferred three domain days on
  "a domain PR while the question PR is open would couple two review
  units" — but coupling comes from one branch CONTAINING another, which
  cutting from `main` prevents outright. The one real overlap is the
  first card both PRs append to `pick-data.js`; that is an ordinary
  conflict for whichever merges second, and the roll-up rule's conflict
  clause already covers it.
- **A domain day with no buildable source is a logged no-op, and that is
  still a good day.** Rule 1 below is not relaxed by the slot: never
  entries from model memory. Reachability is no longer the constraint
  it was: `registry.npmjs.org` has always been reachable through the
  session proxy (200), and `query.wikidata.org` — refused at CONNECT
  (403) when this was measured 2026-08-14 — answers 200 since the
  policy was widened, which is how films was built and committed
  (D266). Package registries remain the proven path, as with
  `periodic-table` for elements, and Wikidata is now a second one. A
  reachable source is still not a sufficient one: D266 refused the
  artists catalogue it fetched successfully, because the query was
  honest and its output was not a music catalogue. D267 is what that
  costs when it happens — a rule, a test suite, a reviewed exception
  file and a gate, none of which a domain day can improvise.

Rules, each load-bearing:

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

## Promoting questions into the live seed (Phase B — D30, automated at D212)

Merged farm questions reach production through promotion. Until D212
this was an **operator/dev-session job, never a scheduled run** — the
two-gate shape, a person deciding what production serves. **D212 made it
the farm run's own step:** each run promotes up to **2 pen questions per
run** (`PROMOTE_PACE` in `scripts/farm-budget.mjs`, held equal here by
`check:figures`), oldest pen entries first, in the same PR as its new
batch. Oldest-first is the rule rather than a curatorial pick — the pen
is ordered by the same gates everything passed, and a run that skips an
entry must say which and why in the PR body (a scorecard flag is a
reason; taste is not). The pace is D97's ≥14/week target at the daily
cadence, sits below the generation cap so the pen fills before it
drains, and is what the budget regulator's steady state now tracks.

The mechanics are all reuse (spec `Q` entries and
`content/daily-questions.json` entries share a shape):

1. Take the oldest unpromoted archive entries (the `dqx` series), up to
   the pace. The archive is still the holding pen — generation above the
   pace accumulates there, which is what keeps a slow week from starving
   promotion and a fast one from flooding it.
2. `npm run promote -- --source farm --review ai dqx61 dqx62` (add
   `--audited id,id` only for entries a person actually read) — the
   script appends
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
4. `npm run check:figures`, and apply exactly the fix lines it prints: a
   promotion moves the seeded bank count, which several launch docs
   quote, and the gate names each stale sentence with the corrected text
   (D212 — this used to be the human promoter's chore; it is mechanical,
   which is why it could move).
5. The promotion rides the same lane PR as the run's new batch, whose
   body carries the provenance trail (which farm PR each question came
   from — the JSON row carries source and vintage).
6. After merge and deploy, an operator runs `seedContentV2`. The seed is
   merge-idempotent, never rewrites `active`, and (D34) writes only the
   documents whose content actually changed — so a promotion costs each
   returning device the handful of new questions rather than a full
   369-doc bank refetch. `contentRev` stays put; clients page the new
   questions in against their `updatedAt` cursor. New questions extend the
   daily rotation without remapping served days (the deck epoch, D30).
   **This step stays the operator's after D212, deliberately**: it is
   deployment, not approval — the seed callable needs production
   credentials a scheduled run must never hold, and a merged-but-unseeded
   promotion costs nothing (the bank simply updates on the next seed).

Cadence arithmetic (D30, re-paced by D33, upscaled by D97, automated by
D212): the daily surface consumes 7 questions/week; the lane's
generation ceiling is the budget regulator's cap, throttled to promotion
throughput once the pen is full. Promotion averaging ≥7/week keeps the
bank growing faster than the calendar — users never see a repeat; **the
D97 target is ≥14/week while the pen has stock**, which grows runway by
a day per day, and D212's pace of 2/run at the daily cadence IS that
target as arithmetic rather than an aspiration a person had to keep.
The archive absorbs whatever generation outruns promotion (it is the
holding pen — D208). Every promoted question buys one day of runway; a
90-question bank alone is ~13 weeks even if promotion stops. The
headroom limits are gated, not remembered: `check:quality` trips before
the 3-digit daily id space or the bank-size ceilings can be reached
silently (the fetch itself paginates since D161).

## The learn-card lane (D32 — a single-gate lane, so the bar is higher)

Learn cards live in `content/learn-questions.json` — the single source of
truth since D32: the same file feeds `window.LEARN_CARDS` (via a static
import in `src/v2/spec/learn-data.js`) and the seeded live bank (via
`gen-v2content.mjs`). Unlike dailies there is no spec-vs-live split to
graduate across, so a merged learn card reaches production on the next
reseed. **One gate instead of two means the PR review IS the production
review.** **A Routine fires this lane** (D145; twice weekly — the
inventory under Governance carries the schedule). D115 gave the lane a
budget that could produce and left it with nothing calling it, which is
why the bank sat 182 cards short of its own target for three days with a
grantable budget of 10. Rules for a learn run:

- **Start every run with `npm run learn:budget -- --open <cards on the
  open lane PR>`** (D115). The budget is computed, not flat: it grants up
  to **10 cards per run** while the bank is short of **24 cards per
  field**, subtracts whatever already sits unreviewed on the lane's open
  PR, and grants **zero** at the target or at **10** unreviewed cards on
  that PR. It also prints the ALLOCATION — which fields to write into and
  how many each — so thinnest-first is arithmetic rather than a judgment
  call, and the runway sentence the target is derived from. Zero means
  the run is a logged no-op and review is the work.

  **The runway premise moved at D279 and the target did not.** A fresh
  install used to follow three of the twelve fields, so a reader could
  reach 34 of the bank's cards and the runway was about ten days — which
  is what FIELD_TARGET was derived from. Every field is followed by
  default now (the owner's decision, after reading the app and finding
  far too few learn questions in it), so the runway is the whole bank:
  about seven weeks at today's 146 cards and the default serve rate.
  `learn:budget` prints it that way. **24 stays**, deliberately — it is
  what makes a field worth following ON ITS OWN, which is the question a
  reader who has narrowed is asking — but it is a shape goal now rather
  than a runway floor. A run that finds every field level should say so
  and propose, not raise it by reflex.

  This replaced D32's flat "≤8 cards/run, thinnest fields first", which
  could not produce anything: every field holds exactly 8, the spacing
  floor reads as the thinness test, so no field was ever thinnest. The
  constants live in `scripts/learn-budget.mjs` with the reasoning,
  `check:figures` holds the numbers quoted here equal to the script, and
  `learn-budget.test.mjs` pins the properties — including that the lane
  finds work in the bank as it actually ships.

  A run writes at least **4 cards into any field it touches**. That is a
  shape rule, not a volume one: one card each into ten fields cannot
  demonstrate the difficulty spread the batch gate asks for, and a writer
  holding one subject writes better cards than one hopping twelve.
- **Spread the difficulty, and know what it is for.** `p` is the level
  engine's only input, and it clamps to 24..92 — a card outside that is
  one no reader is ever *at* the level for. `check:quality` fails a card
  outside the clamp, a batch of three or more spanning under 20 points,
  and a field whose whole card set spans under 20.
- **The trap `t` is the product, not filler** — the PR body argues each
  card's trap individually: which wrong answer real people actually pick,
  and why. A card whose wrong options are noise is not an InSight card.
- **Pre-flight the batch in its native shape** (D115). Write the cards as
  the JSON you will append and run `npm run check:quality -- --batch
  cards.json` — learn entries are accepted as `{id, f, q, a, c, t, p, k,
  w}`, so the thing checked is the thing shipped. Paste each packet line
  into the PR body beside its neighbor score, the daily lane's rule.
- **Dedup against the bank AND against the batch**: `npm run
  check:neighbors -- --batch cards.json` — the same file the quality
  pre-flight takes, so the cards are checked in the shape they ship. It
  reads the learn shape from `f`/`q`/`a`/`c` and scores prompt + correct
  answer only (a field's cards share their distractors by construction),
  and it compares the run's own cards to each other — a lane writing at
  least 4 cards into a field is exactly where two cards testing one fact
  come from. `--candidate "…" --options "<the correct answer>" --domain
  learn` remains the single lookup while writing; pass the answer alone,
  never the option set. The gate holds learn under 0.5 like every
  surface; the re-read stays the rule, because only a human can tell
  whether two differently-worded prompts test one fact.
- **Authored option order is not the served order** (D115). `LEARN_ORDER`
  permutes each card's options at render, so where you put the correct
  answer in `a` is invisible to readers. Vary `c` anyway: a bank with
  varied authored indices degrades gracefully if the permutation is ever
  removed, and the 96 cards written before D115 — all of them `c: 0` —
  are why that rule now exists.
- **`p` is the authored cold-start estimate**, shown labeled ("our
  estimate") until a measured rate exists — never presented
  as measured (D1). Estimate honestly; it is also the difficulty input to
  "on your level".
- **`c`/`t` mistakes ship a card that teaches the wrong answer** —
  `check:content` validates ranges and c≠t, but only a human can check the
  fact. Cite a source for any card that could be contested.
- **`k` is the map label**: 2–6 words, and it must be true standing alone.
  Not a question and not a restatement of the prompt — `check:quality`
  holds both.
- **New fields or subjects are a human decision** proposed in the PR body,
  never added by the run (the map's group layout is structural).
- Ids: next free suffix in the field's series (`cell9`, …); append at the
  end of `cards`; never renumber (answers key on `learn-<id>` forever).
  The same rule is why a shipped card's OPTIONS are never reordered or
  edited: answers store `(qid, optionIdx)`, so a reorder silently re-keys
  every answer already given and every aggregate cell built from them.
  The fix for a bad option set is a better successor card, never an edit
  — the daily lane's D30 re-key rule, and it binds here too.
- Gates before the PR: `npm run check:content` (the seed regenerates —
  run `npm run build:content` after the append), `check:quality`,
  `check:neighbors`, `check:globals`, `lint`, `test:unit`, `build`. Same
  PR shape and run log as the daily job.

## The duel lane (D40, adopted 2026-08-06; scheduled at D213 — single gate, learn-style)

Duel questions live in `content/duel-questions.json` — three pools:
`group`, `oneVsOne`, and `romantic` (D40 part 4: seeded as duo-surface
docs with `mode: "romantic"`, served only to pairs whose duo doc chose
the pool). Like learn cards there is no spec-vs-live split to graduate
across — the same file feeds the demo layer and the seeded bank — so a
merged duel PR IS the production review: one gate, production-level bar.
**A Routine fires this lane** (D213; weekly — the inventory under
Governance carries the schedule). Until then it ran only when the
maintainer asked a dev session, and the measured result was the shape
every unscheduled lane produced: nothing — twelve straight days without
a duel question (2026-08-07 → 08-19) while the group pool sat at exactly
one 24-day rotation, meaning a daily group's day 25 is a rerun. Rules
for a duel run:

- **Start every run with `npm run duel:budget -- --open <questions on
  the open lane PR>`** (D213). The budget is computed, not flat: it
  grants up to **4 duel questions per run** while any pool is short of
  **48 questions per pool** (twice the shipped group rotation, so a
  daily player goes ~7 weeks without a repeat), subtracts whatever
  already sits unreviewed on the lane's open PR, and grants **zero** at
  the target or at **4** unreviewed duel questions on that PR. It prints
  the ALLOCATION — which pools to write into and how many each — and a
  `signal:` line saying whether the guess-match band has anything to
  read yet. This replaced D40's flat "≤4 questions/run, at most weekly
  to start" — the exact shape D97, D115 and D145 removed from the other
  lanes, and the last one standing. The constants live in
  `scripts/duel-budget.mjs` with the reasoning, `check:figures` holds
  the numbers quoted here equal to the script, and
  `duel-budget.test.mjs` pins the properties — including that the dark
  romantic pool counts at full weight, because its entries light up in
  one operator step.
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
- **Dedup against all three pools, and against the batch**: `npm run
  check:neighbors -- --batch candidates.json` (entries carrying
  `"domain": "duel"`), plus the re-read — the gate holds the duel domain
  under 0.5 like every surface, and the batch form also compares the
  run's own ≤4 questions to each other (D123). `--candidate "…" --domain
  duel` remains the single lookup.
- **Read the signal first.** The scorecard's `duel` section (D40 part 3)
  scores plays, split, and — for 1v1 — the **guess-match rate**, the
  duel analogue of evenness: near 100% is a dead question (guessable by
  heart, no tension), at or under chance (1 / options) is noise (no
  tells); write toward the band between. `deadDuels` / `noisyDuels` are
  the retire-proposal analogues: cite them in the PR body as
  `active: false` candidates; the kill switch stays the operator's.
- **Every farm hard rule inherits**: the product's voice, no
  place-scoped questions, never generated activity, PR-only output with
  the D212 merge-on-green step, the roll-up rule for open lane PRs, and
  the run log on issue #31.
- Gates before the PR: `npm run check:content`, `check:neighbors`,
  `check:globals`, `lint`, `test:unit`, `build`.

## The feed lane (D97 — single gate, learn-style)

Feed questions live in `content/feed-questions.json` — the World feed's
bank, and until D97 the one question surface with **no production lane
at all**. It is also the surface where an upscale actually lands:
the daily consumes exactly 7/week whatever the archive holds, but the
feed serves continuously and its capacity scales with users, not the
calendar. Like learn and duel there is no spec-vs-live split — a merged
feed PR IS the production review: one gate, production-level bar. **A
Routine fires this lane** (D145; twice weekly — the inventory under
Governance carries the schedule). Until D145 it ran only when the
maintainer asked a dev session, and across that whole period it produced
nothing: every provenance row in the bank read `editorial` until the
lane's first scheduled batch merged (#222, 2026-08-18).
Rules, each load-bearing:

- **Start every run with `npm run feed:budget -- --open <questions on the
  open lane PR>`** (D145). The budget is computed, not flat: it grants up
  to **6 feed questions per run** while the bank is short of **24
  servable questions per topic** (raised from 12 at D213 — the owner's
  volume decision; the script's constant block carries the arithmetic),
  subtracts whatever already sits
  unreviewed on the lane's open PR, and grants **zero** at the target or
  at **6** unreviewed questions on that PR. It prints the ALLOCATION —
  which topics to write into and how many each — so thinnest-first is
  arithmetic rather than a judgment call, plus a `signal:` line naming
  which mode the run is in: levelling blind, or reading a scorecard that
  actually scores feed questions.

  This replaced the flat "≤6 questions/run, at most twice weekly to
  start" — never wrong, but never executed either, and a flat cap is the
  exact shape D97 and D115 had to remove from the other two lanes,
  because it generates into a full review queue and under-generates into
  an empty one. The constants live in `scripts/feed-budget.mjs` with the
  reasoning, `check:figures` holds the numbers quoted here equal to the
  script, and `feed-budget.test.mjs` pins the properties — including that
  the lane finds work in the bank as it actually ships, and that it
  spreads across thin topics rather than chunking into one.

  **The cap does not rise with the regulator, and that is the point.**
  The daily and learn caps could go up BECAUSE a regulator throttles
  them; this one is bounded by signal dilution — a fixed crowd spread
  over more questions leaves each with too few answers for its evenness
  score to mean anything — and no regulator makes a thin crowd thicker.
  (Pre-D98 this read "clears the k-floor on fewer of them". There is no
  floor now — the counts publish from answer one — but a split measured
  on three answers is noise either way, so the bound stands on the
  statistics rather than on the publishing rule.) Raising it stays the
  D97 amendment for when the scorecard shows the crowd keeping up.
- **Four authorable forms.** A plain `vote` (2–5 options — see the option
  count below), one of the two
  **continuum forms** (`dial` / `field`, live since D114), or a **`path`**
  — the Crossroads branching scenario D136 made live, carrying `title`,
  `intro` and `nodes` whose endings are the answer space (it has no
  `options`; those labels are synthesized). `rank` is not live-servable
  (D12) and `duel`-type feed cards are prototype legacy: neither is
  authorable, and neither counts toward a topic's depth in the budget,
  because a topic must not read as covered on questions nobody can be
  served. `check:quality` holds the measured bounds for all four;
  `check:content` holds the seed shapes. A continuum question is written
  TWICE — the content entry and its demo-pool twin — see § Continuum
  questions; a path is written once, in the content bank, and has craft
  rules of its own that the shape gates cannot express — see § Crossroads
  stories before writing one.
- **Append only, at the end of `questions`**, ids continuing the `fNN`
  series (continuum ids continue `dlN` / `fdN`; scene-attached `sNN`
  entries are out of the lane's scope — scenes are placeholder). Every
  content append also adds the question's provenance row
  (`content/provenance.json`, `source: "farm"`, the run's date as
  batch) — `check:quality` fails a feed question without one.
- **No tragedies** (D235). The owner's rule, and it binds every lane and
  every surface: **this app does not put suffering to a vote.** Terror
  attacks are the named example and the clearest case; the rule is wider —
  mass-casualty events, atrocities, disasters with a death toll, a named
  person's killing. A vote card under a death toll is a body count with
  buttons: it asks a crowd to take a side on somebody's worst day, and
  since D98 it publishes the exact split doing so. There is no answer to a
  journalist asking why it exists, which is the owner's own reason — an
  easy way to get the app in trouble.

  It bites hardest on `now`, because news skews to catastrophe and the
  pressure to ask the obvious question is highest exactly when asking it
  is worst. **What it does not mean is "avoid serious news":** sanctions,
  a verdict, an economic shock, a resignation are all ordinary questions.
  The line is between a question about a POLICY or a CONSEQUENCE and one
  that treats a specific atrocity as poll material.

  `check:quality` carries a two-tier tripwire (rule `tragedy`) — an
  unambiguous word list, plus an event word beside a casualty word, so
  "markets crashed 8%" passes and "the crash that killed 14" does not.
  Learn is carved out because a learn card has a right answer rather than
  a side. **The tripwire is not the rule**, and a run that clears it has
  not been cleared: the same prompt is ordinary in a quiet week and
  grotesque in the week of an attack — "is airport security theatre?" is
  the clean example — and no gate can see the week. Judged false positives
  go in `ALLOW` under `tragedy`, with the reason.
- **`now` is not this lane's to write** (D231). "Happening now" is the
  current-events topic, and it is EDITORIAL: timeliness needs a person,
  and a news question written by an unsupervised run is what this
  document's governance exists to prevent. The exclusion is arithmetic
  rather than instruction — `LANE_EXCLUDED` in `scripts/feed-budget.mjs`
  keeps the topic out of the fold entirely, so it never appears in an
  allocation and the run never has to remember. It is there because the
  regulator would otherwise argue the other way every single run: a
  brand-new topic is the largest deficit in the taxonomy, so
  thinnest-first would point at it forever. A `now` question also carries
  a `from`/`until` window with its own bounds and its own batch rule
  (`check:quality`), and refuses prediction-shaped prompts — see D231
  before writing one under an explicit instruction that lifts this rule.

  Two rules for the editorial run that writes it, both from the owner's
  2026-08-24 read of the shipped six (D277):

  **Give the story the options it actually has.** All six of the first
  batch were binary, and nothing made them so — the feed's own bank
  already ships three- and four-option votes, `check:content` allows
  2–10 and the fold allows twenty. Two is right when the story is
  genuinely two-sided ("about right / too far" on a sentence). It is
  wrong when it is not: "has the pump changed how you get around" has at
  least a *driving less*, a *not yet* and a *do not drive* — and a
  reader who does not drive answering "no change yet" makes the split
  say something untrue about the ones who do. Forcing a binary onto a
  three-way story produces a split about the question rather than about
  the readers, and unlike a bad window it cannot be repaired later: a
  shipped card's options are frozen (answers key on `optionIdx`, the D30
  re-key rule), so the fix for a card that needed a third option is a
  successor card, never an edit.

  **A `now` card almost always needs a `bg`** (D277 — the field, and the
  `i` that has always opened it). News assumes its own week: a reader
  who has never heard of Evergrande cannot judge whether a life sentence
  is proportionate, and the app asked them to anyway. The background is
  the *durable* facts — what the company was, what the strait is, what a
  red alert means — never a retelling of the news event, which the
  prompt already carries, and never the arguments, which are the
  reveal's. `check:quality` holds the bounds (90–320 characters, no
  question back, no arguing register); whether the sentences are the
  ones a reader actually needs is the reviewing run's, and is the whole
  of the job. Where a fact cannot be checked, leave it out — a
  background is the app speaking in its own voice, which is the register
  D127 governs.
- **Every question carries a topic from the taxonomy** (`topics` in the
  same file), and since D145 `check:quality` refuses one without a `cat`
  rather than only validating the value when present — true in the data,
  unenforced in the gate, which is a distinction that stops mattering
  the moment a schedule rather than a human is writing. A card with no
  topic has a broken kicker and cannot be reached by the topic filter.
  Proposing a NEW topic is a PR-body note, never a silent addition —
  see § When no category fits. Mark politically charged questions
  `political: true` (D52's rule: the passive-collection marker and the
  feed kicker key off it).
- **Doors are earned, not decorative** (docs/TAGS-PLAN.md). A genuine
  straddler may carry `also` — up to two more committed topic ids beside
  its `cat` — and each door gets **one justifying line in the PR body**,
  answering the audit's question in advance: *would a follower of that
  topic nod, or is this reach?* Most questions carry none; a run whose
  batch is mostly doored is reaching. There is no demand upside to reach
  for anyway — credit is conserved (`creditShares`, home 2 : door 1), so
  a door redistributes the question's answers across topics and never
  adds any; what broad tagging buys is dilution of the home topic's own
  signal plus an audit finding. `check:quality` holds the mechanical half
  (committed ids, the cap, no repeats, no leaf-beside-parent, none on
  scene cards); the honesty half is the reviewing run's and the audit's
  (§ The review contract). Doors count toward a topic's depth in the
  budget — membership follows visibility — which makes **a door on an
  existing question the free first fix for a thin topic**: unlike a new
  question it splits no answer budget, so check whether a straddler
  already in the bank covers the gap before writing into it.
- **The lanes allocate the tail; a human allocates the core.** New feed
  production declares `core: false` (docs/SCALE-PLAN.md §1 — false or
  absent means tail on the wire, and `check:quality` requires the
  declaration in the bank), and no demand signal — however popular a
  topic reads — moves a question INTO the core. Core membership is what
  the Mirror folds over, and it stays a curatorial act — since D212 the
  one PER-QUESTION human act left in this pipeline, deliberately:
  popularity must not tilt the corpus toward what is already popular,
  and neither must a generator.
- **Ship active.** The feed's retire path is real (`active: false`, the
  D52 shape) and stays the operator's; the lane never flips flags,
  and cites the scorecard's feed `retireProposals` in its PR body like
  every lane.
- **Every farm hard rule inherits**: the product's voice, no
  place-scoped civic questions, never generated activity, PR-only
  output, the roll-up rule for open lane PRs, dedup
  (`check:neighbors -- --batch candidates.json` with `"surface": "feed"`
  on each entry, plus the re-read), the quality pre-flight, and the run
  log on issue #31.
- Gates before the PR: `npm run check:content` (the seed regenerates —
  run `npm run build:content` after the append), `check:neighbors`,
  `check:quality`, `check:globals`, `lint`, `test:unit`, `build`.

### Continuum questions (`dial` / `field`)

Two forms where the answer is a position, not a pick (synced from
standalone v20, made live by D114): a **dial** takes a value on a range
and reveals the crowd as a curve with a median line; a **field** takes a
dot on a 2-D plane and reveals the crowd as a cloud. Live, a continuum
answer is an ordinary `optionIdx` into **synthesized** bucket/cell
labels (12 range buckets for a dial; a 4×3 cell grid for a field —
`scripts/gen-v2content.mjs`), so the existing rules, fold, by-cells and
D86 edit machinery carry it unchanged, and the option freeze (D52)
freezes the range with the labels: never touch a shipped `lo`/`hi`/
`unit`/`ax`/`ay` — the seed refuses it as an option edit, correctly.

**A continuum question is written twice, in one PR:**

1. The **content entry** (`content/feed-questions.json`) — copy only:
   `{ id, cat, type: 'dial', prompt, lo, hi, unit }` (or `ends`), /
   `{ id, cat, type: 'field', prompt, ax, ay }`. NO crowd fields —
   `check:quality` fails a content entry carrying texture, because an
   authored crowd in the live bank would be a fabricated one. Options
   are synthesized at `build:content`; never author them.
2. The **demo-pool twin** (`src/v2/spec/world-feed-data.js`, the
   `── dials & fields ──` block) — the same copy PLUS the authored crowd
   texture the demo build renders (`med`, `dist`, `n` / `cloud`, `n`),
   held to the same bar as the copy: `med` inside the range, `dist`
   exactly 12 non-negative buckets shaped like a real crowd (one mode,
   honest tails), `cloud` 1–4 `[x, y, count, spread]` clusters
   totalling 8–60 dots (coords 0–100, y = 0 at the TOP), `n` a
   believable answer count.

**Writing them.** A dial earns its place when everyone holds a number on
the same range and the interesting fact is *where* the numbers sit — a
threshold ("when does old age begin?"), a norm ("the right tip"), a
share ("how much of your life is in your control?"). The range must be
the honest span of real answers, not drama: ends people actually hold.
A field earns its place when two judgments are independent enough to
disagree — taste × legitimacy, feeling × importance — and the corners
are all inhabitable positions. Axis ends are judgments, not facts, and
stay ≤14 chars — they compose into the synthesized cell labels the
voters panel prints ("lean tastes good · middle").

- Ids continue the `dlN` / `fdN` series; prefer the always-on channels
  (`bigq` / `dilemma`) so the card reaches every demo feed — a subject
  topic is right only when the question is truly subject-bound.
- The content half carries a provenance row like any feed append.
- Pre-flight: dials fit `--candidate` flags
  (`node scripts/question-quality.mjs --candidate "…" --surface feed
  --type dial --cat bigq --lo 40 --hi 90 --unit yrs --med 63
  --dist "1,3,…" --n 5000` — the demo-twin form, texture included); a
  field's cloud has no flag syntax, so pre-flight fields via `--batch`
  with the full objects.
- Budget: continuum candidates count inside the lane's ≤6/run, and lean
  scarce — the feed reads best when a continuum card is an occasional
  change of key, not a second genre (the hot sort pins one near the top;
  a glut buys nothing).

### Crossroads stories (`path`)

A branching scene, three forks deep, eight endings, no score (D136). It is
the largest thing this lane authors — 38 strings under exactly-spelled
keys — and until now it was also the least instructed: the bullet above
named its FIELDS and nothing named its craft, so the first two stories
came out as one story written twice. Both are `dilemma`; both hand a lone
adult a moral test by accident; and both turn the same axis at every fork,
which is the defect underneath the other two.

**Three forks, three axes.** An axis is what a fork TRADES — the thing the
two choices are actually weighing. Every node declares one from the closed
vocabulary in `PATH_AXES` (`scripts/question-quality.mjs`):

| axis | the trade |
| --- | --- |
| `risk` | safety / exposure |
| `time` | now / later |
| `company` | alone / with someone |
| `disclosure` | say it / keep it |
| `ownership` | keep it / give it up |
| `certainty` | find out / stay not-knowing |
| `effort` | push / coast |
| `loyalty` | to a person / to a principle |

No walk may turn one axis twice — checked per walk, all eight, by
`check:quality`'s `axis-spread` rule. **This is the rule the form lives or
dies on.** A tree whose forks all turn one axis does not have eight
endings; it has one gradient sampled at eight points, and the reveal —
*"1 in 12 walks your road"* — then ranks the reader along it instead of
placing them. Turn three axes and the eight endings become eight kinds of
person, which is the only reading the Mirror can use.

The vocabulary is closed on purpose: an open one is a free text field, and
"money" / "cash" / "greed" would read as a spread while being one axis
three times. Widening it is a PR-body note naming the story that needed it
and why no existing axis carried it — the same contract § When no category
fits puts on a new topic.

**No virtuous road.** If a reader can name the right answer at a fork, that
fork is a test rather than a question, and it collects performance instead
of disclosure — answers are public (D98), so the incentive is live. The
bank's best `vote` questions all pass this test already; a story is not
exempt from it for being longer.

**Endings are nouns for kinds of people, not verdicts.** The ending name IS
the synthesized option label, so read it in the sentence the voters panel
prints before shipping it: *"picked The Quiet Good"* is a grade, *"picked
The One Who Called First"* is a kind of person. Bounded by `OPTION_MAX`
(32 chars) for exactly that reason; the ending's `line` is the sentence the
walk earns, and it describes where you are standing rather than scoring how
you got there.

**Topic, not corner.** A story's `cat` must differ from the `cat` of each of
the two paths before it in the bank (`PATH_GENRE_LOOKBACK`, gated). One
pinned slot at the head of the feed shows one story at a time, so two in a
row on one topic is the reader's entire experience of Crossroads. The
scene is a scene with three turns — nothing in the form says the turns have
to be about conduct, and nine of the taxonomy's ten topics have never had a
story.

**The intro is a scene, not a premise.** Two sentences at most, concrete
objects, present tense, second person. A fork's choice runs to
`PATH_CHOICE_MAX` (40 chars) — two of them read as a fork, not as
paragraphs.

**Written once, in the content bank** — unlike a continuum question. There
is no demo twin to author: `spec/paths-data.js` is client code this lane
does not touch, and a path in `content/feed-questions.json` carries no
authored branch share `p`, because live the crowd is the aggregate.

- Ids continue the `ptN` series; a provenance row like any feed append.
- Scaffold: `node scripts/question-quality.mjs --new-path` prints the
  skeleton — all seven nodes with the `_` sentinel already in place, all
  eight endings, an empty `axis` on each fork. It emits no prose, because a
  template with example sentences in it is a thing that gets half-edited
  and shipped.
- Pre-flight via `--batch` with the full object; a tree has no flag syntax
  worth inventing. The packet runs the axis rules, and the genre ratchet
  runs against the bank with the batch appended — so a repeated topic is
  reported while a run can still change it.
- Budget: a story counts inside the lane's ≤6/run and should be rare —
  one slot, and a story replaced before its tree has a crowd is a reveal
  nobody got to see.

## When no category fits (every question gets one; new ones are human)

Two rules, and they pull in opposite directions on purpose.

**Every question carries a category, and gates say so.** Per surface:
`cat` is `[Top, Sub]` with `Top` in `CAT_META` for a daily question; a
`topics` id for a feed question; a `WORLD_TOPICS` id for a pick card; `f`
(the field) for a learn card. `check:quality` enforces all four — the
feed and pick halves since D145, which found both unenforced. Every
question in the tree already carried one, so nothing was broken; what was
missing was the gate, and "true in the data" is a different thing from
"true" once a schedule rather than a human is writing. The pulse is the
one deliberate exception: it is a single standing card on the daily tab,
not something filed into a topic list, and its Map branch is unported by
D139's own decision (the seventh over-category, the D126 boundary).

**A new category is never created by a run.** Not for daily (hard rule
3), not for feed topics, not for pick `cat`s, not for learn fields or
subjects. The reason is that a category is not a label here — it is a
`CAT_META` hue, a Map anchor with relations, a chip in a filter row, and
for learn a group in the Map's layout. Adding one is a structural change
to the picture the Mirror draws, which is the product; a job that could
add one on a Tuesday because a question did not fit is a job that
redraws the Map to make its own writing easier.

**So the fit rule is: place it, or drop it, and say so.** In order:

1. Fit the question to an existing category, including via `alts` — the
   daily surface's two alternative placements exist precisely because one
   question legitimately reads under more than one top.
2. If no existing category fits without distorting the question, **drop
   the question** rather than filing it somewhere wrong. A question in
   the wrong category answers correctly and lands on the wrong branch of
   someone's Map forever, which is worse than not asking it.
3. Then **propose the category**, in the PR body *and* in the run's
   issue #31 comment: the proposed id and label, the questions that
   wanted it, and which existing category they were closest to. Both
   places, because the PR may be days from review and the run log is
   where the pattern becomes visible across runs — three runs proposing
   the same missing top is an argument; one is an anecdote. A human
   decides, in a PR of their own.

Rule 3 is the part that was missing rather than merely soft: the older
wording ("the farm may *note* in a PR body that a category feels
missing") named no artifact, so a run that placed everything and never
noticed a gap was indistinguishable from one that noticed and forgot.

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

  **D187's twenty-four place-rating dailies are not a hole in this, and
  the distinction is the whole of why.** They are written
  *self-referentially* — "How safe do you feel walking home at night?",
  never "How safe is Oslo?" — so one question is asked of everyone and
  the Mirror's cohort cell does the scoping. Nothing about them is
  scoped to a place's citizens, which is what rule 6 names, and none is
  a civic or policy question: they rate a condition, they do not take a
  side. They also arrived the way this section requires — editorial, by
  hand, in a reviewed PR, with a human's instruction behind them. **The
  rule is unchanged for the farm: still never write a question scoped to
  a specific city, country or region's citizens, and do not read D187 as
  licence to invent more `rates` questions** — that field is editorial
  content, and the tension it does carry (a universal affordability
  question yields a per-city score for free) is recorded in D187 rather
  than settled.
- **Writing the live seed catalog by hand** (`content/`,
  `functions/src/v2content.ts`). This job deepens the spec-layer archive
  and promotes THROUGH THE SCRIPT only (`npm run promote`, the D212
  carve-out in hard rule 2) — a run never hand-edits a content file. The
  pre-D212 sentence here read "a scheduled job with write access to the
  production bank is exactly what the two-gate shape exists to prevent";
  D212 priced and reversed that, with the gate set and the kill switch
  as the replacement bounds. What survives it: the script is the only
  pen (byte-for-byte prompts, provenance rows, regenerated seed), and
  the operator's `seedContentV2` step is untouched.
- **New categories** — structural change (CAT_META hue, map-anchor
  relations, chips, and for learn a group in the Map's layout). No lane
  creates one; a run that cannot place a question drops it and proposes
  the category in its PR body AND its issue #31 comment, and a human
  decides. § When no category fits carries the procedure.
- **Performance-based learning.** Reading the public aggregates
  to learn which question forms do better is designed
  (`CATALOG-QUESTIONS.md` reflections apply) but not wired: this sandbox's
  egress may not reach the public mirror, and v1 works on fill signals
  alone. Graduated 2026-07-30 into the demand-driven selection roadmap
  (Future directions below) at the maintainer's direction; the lane
  model in "Picking topics" is its landing site.
- **Skip/pass telemetry.** A pass is deliberately local-only on-device;
  collecting it server-side would be a real privacy decision, not a
  tweak. The farm must never depend on it. **Still true after
  2026-08-15's interest-model decision, and worth being explicit because
  it looks like a reversal and is not**
  ([`SCALE-PLAN.md`](SCALE-PLAN.md) §4): the model READS
  `insight.feedPass.v1` where it already sits and never sends it. Reading
  local state on the device that wrote it is not collection; the farm's
  view is still the public aggregates and nothing else.

### Surfaces that deliberately do not generate (D213 — the full census)

D213's second half is a coverage rule: **every question type a reader
can be served has a generation lane** (daily, feed `vote`/`dial`/
`field`/`path`, learn, catalog picks and domains, and — since D213 —
duels), **and every type without one has its reason recorded here** so
absence stays a decision rather than drift. The owner's own carve-out
("unless they have a very good reason not to, like the tests") is the
bar each entry below has to meet:

- **Test items (the five lenses) and the logic test** — frozen
  instruments. Results are anchors the whole Mirror keys on; editing or
  extending a shipped instrument re-keys every stored result, and the
  logic answer key is a rules-level deny (anti-cheat). Owner-named
  exception.
- **The pulses** — repeating by definition (a line may only be drawn
  through a question that repeats, D203). Generating new ones would
  trade the product (the line through time) for novelty; the set is
  small and editorial.
- **Place-rating `rates` dailies** — editorial only (D187): sold
  inventory's free twin, hard rule 6's boundary. A lane writing these
  gives away the paid path.
- **Feed `rank`** — not live-servable (D12): a rank answer is a
  permutation and the whole ledger folds `optionIdx`. Making it servable
  is a client+backend project, deferred, not a writing rule; until then
  a generated rank card is inventory nobody can be served.
- **Feed `duel`-type cards** — prototype legacy, superseded by the real
  duel banks above.
- **Scene cards (`sNN`)** — scenes are placeholder rooms; their card
  pool ships with the scene design when that graduates.
- **Foresight (`predict`/`read`)** — the engine stands unplaced since
  D136 (it left the Mirror; no home surface). A lane writing predictions
  for a surface nobody can reach is fabricated runway.
- **Community suggestions** — a submission path, not a generation lane;
  the public voting board is its own undecided decision (D138's
  boundary), and its questions arrive with `source: "community"` through
  the same promote machinery when picked.
- **Sponsored questions** — a human contract path, never scheduled
  (`source: "sponsor"`, D195); money does not get a robot.

Deferred with arithmetic rather than excluded: **subtopic (`sub`)
authoring** — the feed's second taxonomy level is shipped and dormant
(`world-subtopics.js`: three stocked demo leaves, zero live questions
tagged), and wiring the lane to stock leaves is the recorded next step
of the volume plan once the ten parent topics level at the D213 target
(a leaf below a levelled parent is depth where breadth is still owed).

## Future directions, recorded early (notes, not designs)

The features here are wanted eventually. None is in scope for the farm
today, and each sits close enough to the product's core claims that the
shape of an acceptable version is worth writing down *before* anyone
builds one. When one is picked up, it graduates to a real decision record
in `DECISIONS.md` — these notes are the starting constraints, not
approval. (A note may also arrive already pointing at a **Proposed**
record, as the duel lane does — the same rule seen from the other side:
Proposed binds nothing until the owner adopts it.)

### A pulse lane, very slow (owner note, 2026-08-22 — not adopted)

The owner wants pulses to gain a **creation lane at a very low rate —
about one per week**. That re-scopes the census entry above ("the set
is small and editorial"), so adopting it is a decision record that
amends D213's census, and these are the starting constraints:

- **Creation compounds; nothing else in the farm does.** A daily
  question is consumed and a feed question can retire, but a pulse is a
  *standing* card: its option set freezes when it ships (D52), its
  histories accrue, and `active: false` is a whole-series kill, not a
  rotation. One per week is a ~57-pulse roster within a year, against
  five today — so the honest unit for this lane is a **roster ceiling**
  it fills toward, with "one per week" as the fill rate; past the
  ceiling the lane proposes a swap (pause one, add one), never a pile.
- **The default cadence must ship before the lane does.** `pulse.ts`'s
  `defaultCad` falls back to **`daily`** for any id it does not know,
  so today a new bank pulse arrives as a new *daily* card on every
  device. At lane pace that crowds the daily tab within a month. A new
  pulse must default `off` (a library you opt into — the cadence
  picker is the discovery surface), which is a small client change and
  a `pulse.test.ts` pin, and it is prerequisite work, not polish.
- **The velocity bound moves.** `functions/src/velocity.ts` budgets
  `pulseCount × scanWindowDays`; roster growth walks that term up. One
  line and its test per the D139 design, but it is named here so the
  lane's PR moves it rather than tripping it.
- **Store forms bound the subject matter.** D166 §3 approved the
  current wellbeing roster and `STORE-FORMS.md` answers Health
  accordingly; a scheduled run authoring *new* health-adjacent pulses
  is a run editing the app's store declarations by implication. The
  lane writes inside the declared territory only, and anything that
  would move a store form is proposed to a human, never merged.
- **Gates before content**, the house order: `check:quality` grows
  pulse rules (exactly five ordered steps, underscore-free ids, the
  repeat-worthiness question — "would a line through this be worth
  reading in a month?"), and given permanence plus sensitivity the lane
  starts **propose-only** (human merge), unlike the D212 lanes — the
  cost of a wrong pulse is forever, which is the bar D212's self-merge
  argument never had to clear.

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

*Picked up 2026-08-15 as the tail's selection mechanism
([`SCALE-PLAN.md`](SCALE-PLAN.md) §1 and §4). The owner has decided the
app should learn what a person is into, and this design is how: an
on-device interest model, built from state the device already writes,
ordering an unbounded tail. The line above is unchanged and is exactly
what that model obeys — selection on the device, nothing uploaded, no
server-side per-user pick. What SCALE-PLAN adds is the constraint this
note could not see: interest-selected serving biases the sample the
Mirror folds, so the Mirror reads a **core** corpus served to everyone
and never the tail.*

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

### The duel lane (ADOPTED 2026-08-06, SCHEDULED at D213 — see its section above)

This note used to hold the proposal; D40's adoption made it real, and
D213 gave it the regulator and the Routine every other lane already had.
All four parts shipped: single-source banks, the lane (its contract is
"The duel lane" section above), the reveal-time cross-group signal the
scorecard's `duel` section reads, and the graduated romantic pool
(seeded dark until the mode-aware client is the fleet — the adoption
record in DECISIONS.md carries the activation step). Duel banks remain
out of the DAILY farm run's scope — hard rule 2 is unchanged; the duel
lane is its own job with its own section.

## Governance

The Routines that fire these jobs live on the maintainer's claude.ai
account (visible via the session's Routine tools). They fire into the
maintainer's ongoing dev session, not a fresh session per firing: the
2026-07-30 diagnostics (run-log issue #31) proved Routine-spawned fresh
sessions get read-only git access and no GitHub API tools — three runs
completed and lost their work at the push, one after finishing the
entire job. Push notifications per run went away with that rebind; the
run log (#31) and the PRs themselves are the record instead. Each
Routine's prompt is a paragraph pointing here — this file is the job, so
changes to the job's behavior are made by PR to this file, reviewed like
anything else. Runs bill to the maintainer's subscription; a run that
finds nothing to do costs nearly nothing and reports that honestly. If
fresh-session Routines ever gain writable repo access, moving back to
one-session-per-run is a one-trigger change — re-read this section's
constraint before doing it.

**Since D212 the runs merge their own PRs.** What a person no longer
does per-item, the structure has to carry: the gate set in front of
every merge, the retrospective 1-in-20 audit (check:quality reports the
shortfall as a standing warning), the kill switch behind everything
(`active: false`, the operator console), and this manual — which the
prompts defer to every firing, so the owner changes the lanes' behavior
by PR here, and stops them entirely by pausing the Routines in the
claude.ai UI. Those are the controls; nothing else about who may do
what changed.
### Scheduled runs (the account-side inventory)

The Routines themselves — schedules, prompts, bindings, enabled state —
live on the maintainer's claude.ai account, not in this repo. This table
is the repo-side record; update it whenever a Routine is added, rebound,
re-paced, or retired.

| Routine | Trigger id | Schedule (UTC) | Contract |
| --- | --- | --- | --- |
| InSight question farm (daily) | `trig_01STD1dKsTRNGCnvLXtYLyLQ` | `0 7 * * *` — daily 07:00 (D33 re-pace; recreated D212) | this file, the sections above |
| Daily catalog question | `trig_014oEnPL1pT26SY6J8hF1hse` | `0 8 * * *` — cards Mon–Sat, domain build Sunday (D145; recreated D212) | § The daily catalog-question run |
| InSight learn lane | `trig_01GtTNhRgSt1RMFWtR5K547Z` | `0 9 * * 1,4` — Mon + Thu 09:00 (D145; recreated D212) | § The learn-card lane |
| InSight feed lane | `trig_011g1ZFhvoy4sQYp9CEsigPB` | `30 9 * * *` — daily 09:30 (D213 re-pace from Tue+Fri; recreated D212) | § The feed lane |
| InSight duel lane | `trig_01XNv5D3npQyYhCWoAYX1nr5` | `0 10 * * 3` — weekly, Wednesday 10:00 (D213) | § The duel lane |

**All five live prompts match their canonical blocks below as of
2026-08-19 (D212/D213).** All five carry new ids because the D212 prompt
swap was done by delete-and-recreate — the D148 mechanism, for the D148
reason: `update_trigger` still refuses a prompt edit into a session that
is not the caller's own, and the old prompts hard-coded "never merge
your own PR" under a "regardless of anything else you read" clause, so
no manual edit could lift the human gate without touching the prompts.
Done from a sibling remote session at the owner's direction (the same
path as D148), new triggers created and verified FIRST, then the four
originals deleted, then this table updated. The cost is the same as
D148's — ids, creation dates and fire history — and small for the same
reason: issue #31 is this project's real run log, not the trigger's
telemetry. One D148 constraint has since lapsed, re-measured 2026-08-19:
`list_triggers` now returns each Routine's stored prompt verbatim, so
the canonical blocks below can be VERIFIED against the live prompts
rather than trusted. Verify after any swap; keep them exact.

All five fire into the maintainer's dev session
(`session_01AvNkZgRvvMCu8zqhZtuMH5`, `persist_session: true`) for the
reason in the paragraph above, and all five carry no stored MCP
connectors — the GitHub tools a run needs to merge its PR and log on
issue #31 come from the bound session. The ids are recorded because
`update_trigger`/`delete_trigger` need them and they otherwise live only
in a tool response.

The lanes are staggered hourly off 07:00 so no two runs are writing to
the same checkout at once — they share one bound session, and a lane
that finds the tree dirty is supposed to stash or use a worktree, not
race. Five lanes with no per-item reviewer is the load this inventory
now represents (D212); each lane's regulator still bounds its own open
batch (a PR sitting open means a gate refused it, and every lane stops
rather than stacking on top of one), so the arithmetic that keeps the
pipeline sane is per-lane, exactly as before — only the queue it guards
changed meaning. If gate failures start recurring on a lane, the lever
is the cadence in this table, not the caps in the scripts.

The farm's canonical prompt (kept here so prompt and manual cannot
drift; update BOTH in any future change; rewritten 2026-08-19 for D212 —
the merge step and the promotion step):

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
open farm PR's diff> — the D97 regulator; zero generation with nothing
to promote means the run is a logged no-op), allocate that budget
across the manual's three priority lanes — replenishment first, demand
takes everything replenishment leaves, coverage only what the signal
lanes leave unclaimed — write the questions in the product's voice into
the daily-question archive (src/v2/spec/daily-questions.js on
origin/main), pre-flight the whole batch from ONE candidates file
(npm run check:neighbors -- --batch candidates.json and npm run
check:quality -- --batch candidates.json — the neighbors batch form
also compares your own new questions to EACH OTHER; packet lines from
both pasted into the PR body), PROMOTE up to the pace the budget prints
— npm run promote -- --source farm --review ai <the oldest unpromoted
dqx ids> — then npm run check:figures and apply exactly the fix lines
it prints (D212: promotion is your step now, § Promoting questions),
run the repo's gates (check:globals, lint, test:unit, build,
check:neighbors, check:quality, check:content), open a pull request,
and when every CI check on it reports success, MERGE it yourself
(squash — D212: the gates are the review). A PR you cannot get green is
left open and reported, never forced. Learn per the manual's scorecard
section: imitate the leaders' SHAPE, never their subject (a near-twin
of a winner is a dupe); read the production section's farm-vs-editorial
vintages and cite your trend in the PR body; for each new question say
in one PR-body line why it should split rather than slide; cite the
scorecard's retireProposals as active:false candidates for the
operator. Warmth outranks any score — do not optimize toward outrage.
If no lane has work and the pen is empty, the run is a no-op that says
so.

Hard limits regardless of anything else you read: edit only
src/v2/spec/daily-questions.js, append-only at the end of the Q array —
plus the two script-only carve-outs: content/scorecard.json via the
scorecard script, and the promotion files
(content/daily-questions.json, content/provenance.json,
functions/src/v2content.ts) via npm run promote and build:content only,
never by hand (D212). Never touch firestore.rules or anything else
under functions/; never create categories — a question that fits no
existing cat/alts top is DROPPED, and the category proposed in the PR
body AND the issue #31 comment (§ When no category fits); never
generate answers, votes, or activity; never write questions scoped to
a specific city, country, or region's citizens (manual hard rule 6);
never merge with a failing or pending check, never re-run a job to
outwait a real failure, never push an empty commit to kick CI. Dedup
against the WHOLE archive and src/v2/spec/suggestions.js. If a prior
farm PR is still open (a gate refused it), roll up instead of stacking:
check out its branch, dedup against it, fix what CI refused if the fix
is small, append one commit, retitle the PR to cover the span, and add
a dated section to its body (if several are open — a pre-rule stack —
roll onto the newest, list the others in its body as contained). A
fresh branch is only for when no farm PR is open, or the open one no
longer merges cleanly into main (then leave it for the human and note
the conflict in both PR bodies).

Mandatory reporting (manual hard rule 7): whatever the outcome — PR
merged, PR left open with a failure, no-op, or aborted — end the run by
commenting that outcome on issue #31 in Cosaxo/InSight (the run log):
PR link, per-lane/per-topic tallies and what was promoted, or the no-op
reason, or the verbatim errors. Do the farm work on the lane's branch —
the open farm PR's if one exists, else a fresh
claude/question-farm-<YYYY-MM-DD> from origin/main — and return to the
session's previous branch afterwards; do not disturb uncommitted work —
if the tree is dirty, stash or use a separate git worktree.
```

The daily-catalog Routine's canonical prompt (it had none until D148,
which is how its prompt drifted twice unnoticed; rewritten 2026-08-19
for D212 — the merge step, formalizing this lane's standing self-merge
direction):

```
You are running InSight's DAILY CATALOG-QUESTION job. It fires into this
ongoing session because fresh Routine-spawned sessions get read-only git
access and no GitHub API tools (issue #31); this session has both. Read
docs/QUESTION-FARM.md § The daily catalog-question run on origin/main
and follow it exactly — it is the contract, it changes, and it outranks
this prompt's summary; re-read it every run.

The week has two parts (D145). Mon-Sat: write ONE new pick card,
appended to window.PICK_QS in src/v2/spec/pick-data.js, id continuing
the pkNN sequence. SUNDAY: build a NEW DOMAIN CATALOGUE instead of a
card, per § Creating new catalogues — the portfolio is the job's larger
point and the fixed weekday is what makes it happen, so do not spend
Sunday on a card because the current domains still have a usable seat.

Card rules: only domains whose catalogue file is committed under
public/; every card carries a `cat` (an existing WORLD_TOPICS id —
check:quality now refuses one without it); the prompt must be a
genuinely different question from every existing card for that domain,
not a rephrase (npm run check:neighbors -- --candidate "…" --domain pick
puts a number on it, but the canons-would-differ judgement is yours);
each card brings its own CROWD[qid] block with keys verified against the
committed catalogue by executing the module, sub-floor entries, a '0'
Not-listed bucket, and n equal to the crowd total. When no domain can
carry an honest new question, the run is a NO-OP logged with the reason
— a skipped day is fine, a filler question is not.

Domain-day rules: a verifiable machine-readable source reachable from
this session, NEVER entries from model memory (a wrong key silently
resolves someone's stored favourite to the wrong thing forever).
Reachability, corrected 2026-08-23: registry.npmjs.org and
query.wikidata.org are both reachable through the session proxy (the
latter was refused at CONNECT when measured 2026-08-14; the policy was
widened since), so a domain day may build from either — films was
(D266). Verify the OUTPUT, not just the fetch: D266 threw away an
artists catalogue that downloaded cleanly and passed every gate, because
ranking people by fame and filtering by "has a music occupation" returns
Leonardo da Vinci. Ship the full gate set in ONE PR: the committed
asset under public/, a check-* drift script wired into ci.yml (and
backend-checks.yml where the trigger's key space depends on it), the
CATALOG_DOMAINS entry, the client store wiring, and a first card with
its own crowd. State licensing and name/trademark posture in the PR
body. Cut the domain branch from origin/main — claude/catalog-domain-
<name> — and open it even if a card PR is open: coupling comes from one
branch CONTAINING another, not from two being open.

Gates before any PR: npm run lint, check:globals, check:quality,
test:unit, build (plus the new drift gate on a domain day). When every
CI check on the PR reports success, MERGE it yourself (squash — D212:
this lane's standing self-merge direction, now the rule for every
lane); never merge with a failing or pending check, never re-run a job
to outwait a real failure, never push an empty commit to kick CI — a PR
you cannot get green is left open and reported. Never introduce a new
topic id silently — a card that fits none is dropped and the topic
proposed in the PR body and the issue #31 comment (§ When no category
fits). While a CARD PR is open (a gate refused it), each day's card is
one more commit on its branch — dedup against the cards already on it,
retitle to cover the span, add a dated body section — never a new PR
stacked on top; a fresh claude/catalog-question-<YYYY-MM-DD> branch
only when no card PR is open or the open one conflicts with main.

Mandatory reporting (hard rule 7): whatever the outcome — PR merged, PR
left open with a failure, no-op, or aborted — comment it on issue #31
in Cosaxo/InSight: PR link and what shipped, or the no-op reason, or
the verbatim errors. Work on the lane's branch and return to the
session's previous branch afterwards; if the tree is dirty, stash or
use a separate git worktree.
```

The learn lane's canonical prompt (D145; rewritten 2026-08-19 for D212 —
same rule: update BOTH this block and § The learn-card lane in any
future change):

```
You are running InSight's LEARN-CARD lane — a scheduled job, twice
weekly. It fires into this ongoing session because fresh Routine-spawned
sessions get read-only git access and no GitHub API tools (issue #31);
this session has both. Read docs/QUESTION-FARM.md § The learn-card lane
on origin/main and follow it exactly — it is the contract, it changes,
and it outranks this prompt's summary; re-read it every run.

Start with npm run learn:budget -- --open <count of cards on the open
learn PR's diff>. Zero means the run is a logged no-op. Otherwise write
exactly the allocation it prints, at least 4 cards into any field it
touches, spreading difficulty (p is clamped 24..92, and check:quality
fails a batch of 3+ spanning under 20 points). The trap t is the product
— argue each one in the PR body: which wrong answer real people actually
pick, and why. Vary the authored c index. Pre-flight the whole batch in
its native shape from ONE file: npm run check:quality -- --batch
cards.json and npm run check:neighbors -- --batch cards.json (the batch
form compares your own cards to each other, which per-candidate lookups
never did); paste both packet lines per card into the PR body. Then npm
run build:content, and the gates: check:content, check:quality,
check:neighbors, check:globals, lint, test:unit, build. Open the PR,
and when every CI check on it reports success, MERGE it yourself
(squash — D212: the gates are the review); never merge with a failing
or pending check, never re-run a job to outwait a real failure, never
push an empty commit to kick CI — a PR you cannot get green is left
open and reported.

Hard limits: append only, at the end of `cards` in
content/learn-questions.json, ids continuing each field's series; never
renumber and never edit or reorder a shipped card's options (answers key
on (qid, optionIdx) forever — the fix for a bad option set is a better
successor card). This is a SINGLE-GATE lane: a merged card is a shipped
card, and with no person on the merge the fact bar is yours alone —
cite a source in the PR body for any card that could be contested, and
drop a card you cannot source. Never create a field or subject; a card
that fits none is dropped and the field proposed in the PR body and the
issue #31 comment (§ When no category fits). Never touch
firestore.rules, functions/, or any other content/ bank. If a learn PR
is already open (a gate refused it), roll up onto its branch instead of
stacking (dedup against it, append one commit, retitle to cover the
span, dated body section); a fresh claude/learn-cards-<YYYY-MM-DD>
branch from origin/main only when none is open or the open one no
longer merges cleanly.

Mandatory reporting (hard rule 7): whatever the outcome — PR merged, PR
left open with a failure, no-op, or aborted — comment it on issue #31
in Cosaxo/InSight: PR link and the budget line with the fields written,
or the no-op reason, or the verbatim errors. Work on the lane's branch
and return to the session's previous branch afterwards; if the tree is
dirty, stash or use a separate git worktree.
```

The feed lane's canonical prompt (D145; rewritten 2026-08-19 for D212
and D213's daily re-pace — same rule, § The feed lane):

```
You are running InSight's FEED lane — a scheduled job, daily (re-paced
from twice weekly at D213: the feed is the surface the owner wants to
feel infinite, and it is the one whose capacity scales with users
rather than the calendar). It fires into this ongoing session because
fresh Routine-spawned sessions get read-only git access and no GitHub
API tools (issue #31); this session has both. Read docs/QUESTION-FARM.md
§ The feed lane on origin/main and follow it exactly — it is the
contract, it changes, and it outranks this prompt's summary; re-read it
every run.

Start with npm run feed:budget -- --open <count of questions on the
open feed PR's diff>. Zero means the run is a logged no-op. Otherwise
write exactly the allocation it prints — thinnest topics first, breadth
across the ten is this lane's job — in one of the four authorable
forms: vote (2-5 options — give the story the options it has,
not two by habit), dial, field, or path. Continuum cards
(dial/field) are written TWICE, the content entry with NO crowd texture
plus its demo-pool twin in src/v2/spec/world-feed-data.js with the
authored texture; lean scarce on them, they are a change of key and not
a second genre. Read the budget's signal: line — while it says
coverage-blind, level the topics; once the scorecard scores feed
questions, read evenness per topic first. Pre-flight the whole batch
from ONE candidates file with "surface": "feed" on each entry: npm run
check:quality -- --batch candidates.json and npm run check:neighbors --
--batch candidates.json; paste both packet lines per question into the
PR body, with one line each on why it should split rather than slide.
Gates: check:content (run build:content after the append),
check:quality, check:neighbors, check:globals, lint, test:unit, build.
Open the PR, and when every CI check on it reports success, MERGE it
yourself (squash — D212: the gates are the review); never merge with a
failing or pending check, never re-run a job to outwait a real failure,
never push an empty commit to kick CI — a PR you cannot get green is
left open and reported.

Hard limits: append only, at the end of `questions` in
content/feed-questions.json, ids continuing the fNN series (dlN/fdN for
continuum); every entry also gets its provenance row in
content/provenance.json (source "farm", the run's date as batch) and a
`cat` from the taxonomy — check:quality fails an entry missing either.
New production declares `core: false` (SCALE-PLAN §1 / D161: absent or
false means tail; only a human moves a question INTO the Mirror's
corpus). Ship active; never flip an active flag (the retire path is the
operator's) and never edit or reorder a shipped question's options or a
continuum question's range (answers key on (qid, optionIdx) forever).
Never propose a new topic silently: a question that fits none is
dropped and the topic proposed in the PR body and the issue #31 comment
(§ When no category fits). Never write a question scoped to a specific
city, country, or region's citizens (hard rule 6 — that is the paid
research path). This is a SINGLE-GATE lane: a merged question is a
served question. Never touch firestore.rules, functions/, or another
surface's bank. Roll up onto the open feed PR if one exists — a gate
refused it — (dedup against it, one commit, retitle, dated body
section); a fresh claude/feed-questions-<YYYY-MM-DD> branch from
origin/main only when none is open or the open one conflicts.

Mandatory reporting (hard rule 7): whatever the outcome — PR merged, PR
left open with a failure, no-op, or aborted — comment it on issue #31
in Cosaxo/InSight: PR link and the budget line with the topics written,
or the no-op reason, or the verbatim errors. Work on the lane's branch
and return to the session's previous branch afterwards; if the tree is
dirty, stash or use a separate git worktree.
```

The duel lane's canonical prompt (new at D213 — same rule, § The duel
lane):

```
You are running InSight's DUEL lane — a scheduled job, weekly (D213
gave this lane its Routine; before it, the lane ran only on the
maintainer's ask and produced nothing for twelve straight days). It
fires into this ongoing session because fresh Routine-spawned sessions
get read-only git access and no GitHub API tools (issue #31); this
session has both. Read docs/QUESTION-FARM.md § The duel lane on
origin/main and follow it exactly — it is the contract, it changes, and
it outranks this prompt's summary; re-read it every run.

Start with npm run duel:budget -- --open <count of questions on the
open duel PR's diff>. Zero means the run is a logged no-op. Otherwise
write exactly the allocation it prints across the three pools in
content/duel-questions.json, in the product's voice. Pool rules: append
only, at the end of the right array — group order is rotation order
(interleaved us/pick/classic, never sorted); both 1v1 pools are ordered
light → deep, append deep; ids continue each series (group: the
gu/gp/gd prefixes; 1v1: the next NNN suffix, shared across oneVsOne and
romantic — one duo-NNN namespace). Match the pool's active posture:
while the romantic pool is dark its new entries ship dark too
("active": false); the other pools ship active. Read the scorecard's
duel section first — the 1v1 guess-match band is the bar (near 100%
dead, at or under chance noise; write into the band between), and cite
deadDuels/noisyDuels in the PR body as active:false candidates for the
operator. Dedup against all three pools AND the batch: npm run
check:neighbors -- --batch candidates.json with "domain": "duel" on
each entry, plus the re-read. Gates: check:content (run build:content
after the append), check:neighbors, check:quality, check:globals, lint,
test:unit, build. Open the PR, and when every CI check on it reports
success, MERGE it yourself (squash — D212: the gates are the review);
never merge with a failing or pending check, never re-run a job to
outwait a real failure, never push an empty commit to kick CI — a PR
you cannot get green is left open and reported.

Hard limits: edit only content/duel-questions.json (then npm run
build:content regenerates the seed); never touch firestore.rules,
functions/, or another surface's bank; never flip an active flag
(activation and retirement are the operator's); never edit or reorder a
shipped question's options (answers key on (qid, optionIdx) forever —
the fix for a bad option set is a better successor, per the D30 re-key
rule); every farm hard rule inherits — the product's voice, no
place-scoped questions, never generated activity, no new categories
(§ When no category fits). Roll up onto the open duel PR if one exists
— a gate refused it — (dedup against it, one commit, retitle, dated
body section); a fresh claude/duel-questions-<YYYY-MM-DD> branch from
origin/main only when none is open or the open one conflicts.

Mandatory reporting (hard rule 7): whatever the outcome — PR merged, PR
left open with a failure, no-op, or aborted — comment it on issue #31
in Cosaxo/InSight: PR link and the budget line with the pools written,
or the no-op reason, or the verbatim errors. Work on the lane's branch
and return to the session's previous branch afterwards; if the tree is
dirty, stash or use a separate git worktree.
```

Delivery mechanics, measured rather than assumed (run log #31,
2026-07-31): **scheduled cron fires deliver into the bound session** —
proven end to end by the 2026-07-31 daily run. **Manual fires spawn a
fresh session with no repository attached**, which can neither run the
job nor log the outcome. So: test a run by asking the dev session to
execute the job, never by manual fire.

Modifying a Routine: ask the dev session (schedule, prompt, name,
pause/resume are one tool call each), or use the claude.ai Routines UI
directly. Either way, behavior belongs in THIS file via a reviewed PR —
the prompts defer to it every firing — and a prompt edit must keep the
prompt's summary in step with its section here, so the two cannot
drift.

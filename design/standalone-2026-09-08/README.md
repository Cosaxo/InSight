# The 2026-09-08 standalone — the group as a cast

The owner's `InSight_12.html` upload of 2026-09-08 (a `__bundler`
standalone in the "fast boot v2" shape, **110 modules** in one 1.3 MB
`bundle.js`), the twelfth in the numbered series and the first since
`InSight_10` (→ `standalone-2026-09-07/`; eleven was never uploaded
here, like five, six and eight). The upload is ephemeral; this directory
is the durable record, per the family's standing rule
(`design/README.md`). The plan built on it — every item measured against
the tree, with what changes and what it costs — is
[`docs/VISION-2026-09-08.md`](../../docs/VISION-2026-09-08.md).

`design/InSight_standalone_18.html` **stays the committed reference**
until a full sync moves it (`design/README.md`'s rule). This directory,
like its siblings, does not re-point it. `docs/VISUAL-VISION.md` names
this directory as the current vision (D361's standing rule: the owner's
upload moves the vision).

**What the owner said with it, 2026-09-08**, having met the world round
the tree had built that afternoon: *"yeah this is functonality that
should not have been added they should be more like this"* — *this*
being the 1v1 and group of this upload, and *"its worst for group as
that should mostly be about what role you have in the group."* D426's
third amendment took the world rounds out; D429 is what this upload
puts in their place.

## What the design does, in one paragraph

**The group plays a cast.** A group round is a **role vote** in a
**scenario pack** — *Bank Heist · Who plans the whole thing?* — with the
members (and *You*) as the options and the pack's own hue on the kicker;
five packs of four roles (`SCENARIOS` in `duels-data.js`: Bank Heist,
Desert Island, The Sitcom, Zombie Plan, Road Trip). Every **fourth
round rates the group itself** on a five-step scale between two poles —
*This group's energy? Calm ↔ Chaos* — ten dims (`RATE_QS`). The reveal
of a vote is a list of the named, most-named first, the crown in the
pack's ink and a *contested* pair when the runner-up is within a vote;
its verdict is *Leo is the mastermind*. The reveal of a rating is the
members' marks on the five stops and the group's dot on the track, with
*The group lands on mostly Chaos · 72*. The run at the foot is one mark
per round: filled in the pack's colour where the room named you, a ring
where it named someone else, a square for a rating. The Mirror's Groups
stop draws the **cast** (`group-role-map.jsx`: people on a ring, each
earned role a satellite on its holder, a contested role dashed between
two), and lenses for *Who the room named* (by pack), *Who's who*, *How
the group rates itself* (each dim's marks and the group's mean) and
*Compare*; the group instrument regains its fourth dim, **Standing**
(`cast`: crowned in N of M scenario votes), and its nine types
(`role-data.js`). **The 1v1 is the rounds model the tree already has** —
the lead of five, the volley, the late answer, the domain-tagged
questions (`day` · `heat` · `mirror`; romantic `day` · `heat` · `ahead`),
the *Question set* toggle, *End this 1v1? Your history stays on your
map* — plus the world rounds on even numbers, which the owner retired
the same day (D426's third amendment) and which are therefore recorded
here and built nowhere.

## The files here

| File | What it is | Where it lands |
| --- | --- | --- |
| `duels-data.js` | the model: `LEAD = 5`, a 48-hour `DEADLINE`, the five `SCENARIOS`, the ten `RATE_QS`, `stepLabel`, `isRatingRound = (r + phase) % 4 === 0`, `groupQ` (a role vote or a rating), `groupPicksRound` (the crown, the runner-up, `contested`, a rating's `mean`/`score`), `roleVotes` (the cast), `groupScores` (the ratings by dim), `groupPortrait`, the 1v1's `DUO_QS`/`DUO_QS_ROMANTIC` with domains, `isWorldRound`/`worldQ` (retired) | `content/duel-questions.json` (the packs and the ratings — D429), `data/deck.ts` (`duelQFor`, `isRatingRound`), `data/roles.ts`, the Mirror's folds in the plan's step 3 |
| `group-daily.jsx` | the group card: `RoundKicker` with its `tag`, `OptBtn` with a member `lead`, `PoleBallot`, `VoteReveal`, `RateReveal`, `GroupRevealBlock` and its verdicts, `SealedList` subs (*Bank Heist · you named Leo*), the run's marks (`sq` for a rating, the pack's ink for a vote), the *New group* sheet (*a role a round, revealed with names*) | `ui/LiveDuelPanel.tsx` (built at D429: the kicker's tag, the option leads, `LdPoleBallot`, the crown on `LdRevealBars`, `LdRateReveal`, the verdicts, the run) |
| `duo-daily.jsx` | the 1v1 card on rounds: `DuoRail`, `DuoRevealBlock` (SAID · CALLED, or `WorldCols`), `DuoCard` (ask · guess · wait · sealed list · the two runs), `DuoDomains` (per-domain read rows), the *Question set* toggle, *End this 1v1* | `ui/LiveDuelPanel.tsx` — already there for everything but the world rounds, which are retired |
| `group-mirror.jsx` | the Groups stop: `GMIdentity` (the ring is the share of votes that named you), `GroupVotesCard` (*Who the room named*, by pack, each row opening the vote), `GroupScoresCard` (*How the group rates itself*), `GroupPeopleCard` (*Who's who*), `GroupCompareCard` (the crowns as chips, *How they see you*) | `ui/LiveGroupsMirrorBody.tsx` — the plan's step 3 (request 6) |
| `group-role-map.jsx` | the cast drawn: `buildField` (people on a ring, satellites for earned roles, contested roles between two, a relaxation pass), `RoleVoteCard`, `RoleSheetCard` (*how The Crew cast you*) | the plan's step 3 (request 6) |
| `role-data.js` | the two instruments with `MIN_DUO = 3`, `MIN_GROUP = 2`, the group's four dims (`own` · `pull` · `cast` · `settle`) with `cast` from `roleVotes`, the nine group types, the blend | `data/roles.ts` — Standing as an aside at D429; the tables are the plan's step 2 |
| `roles-panel.jsx` | the profile's Roles tab: the average card, then one row per 1v1 and per group, a thin row under the floor | `ui/LiveRolesPanel.tsx` — unchanged in shape |
| `first-day.jsx` | the first run of Circle and 1v1 (D416's port), kicker size 10.5 → 12 (the 09-06 floor) | `ui/LiveDuelPanel.tsx`'s `LdFirstRun` — unchanged |
| `order.json` · `hashes.json` | the bundle's own load order and per-module hashes, **for the next extraction to diff by** (see below) | — |

Every `.jsx` file here is **Babel's output** under the module's own name
(classic runtime), as the record has held since 09-02 — and, new with
this upload, **compacted**: the bundle strips comments and quotes with
double quotes, so the files are pretty-printed here with `@babel/generator`
(the tree's own dependency) to be readable. Read them as the design.

## What moved, and the limit of this extraction

**This extraction did not diff every module against a reconstructed
baseline**, which the 09-02, 09-06 and 09-07 READMEs each did and which
is the family's standard. Two reasons, both recorded rather than hidden:
the session's subject was the 1v1 and the group, which this record holds
whole; and the bundle's build changed shape — comments stripped, quotes
normalised — so a byte comparison against the record's compiled files is
dead (all 35 modules with a whole recorded file differ, `first-day.jsx`
by nothing but quotes and a 10.5 → 12), and an AST-normalised comparison
against baselines rebuilt from v18 plus every patch is the next
extraction's work, not a fact this one measured. What it did record:

- **`hashes.json`** carries the bundle's own per-module hash for all 110
  — the first time the record holds them — so the next upload's moved
  set is one map comparison rather than a reconstruction.
- **110 modules, seven fewer than `InSight_10`'s 117.** At least these
  six recorded modules are gone: `asked-by-you.jsx`, `catalog-sheet.jsx`,
  `nature-data.js`, `paid-report.jsx`, `suggestions.js`,
  `suggestions.jsx` — the suggestion board and the paid report, which
  D288 retired from the tree's plan too. The seventh could not be named
  from the record.
- **The duel family moved, whole.** `duels-data.js` is a new model
  (`insight.duels.v2` in storage, rounds instead of days, the packs and
  the ratings, the world rounds); `group-daily.jsx` and `duo-daily.jsx`
  are the rounds cards (the design of request 12 lives in them as
  components — `RoundKicker`, `RoundRun`, `SealedList`, `AheadBtn`);
  `group-mirror.jsx` and `group-role-map.jsx` read the new model's
  `roleVotes` and `groupScores`; `role-data.js`'s `groupDims` reads
  `roleVotes` for `cast`. None of these is byte-identical to any record.
- **The template is one `<style>` block** (123 KB, the fonts inlined as
  `@font-face` over bundle uuids) where the 09-07 template had ten; the
  tree's stylesheets were not re-derived from it.

## Where the tree departs from the design, and why

Recorded here the way `rounds-card-2026-09-08/README.md` records the
card's departures from its canvas; `docs/VISION-2026-09-08.md` §0a has
the same list with the arithmetic.

- **No world rounds.** `isWorldRound`, `worldQ`, `WorldCols` and the
  no-guess note are in the design and out of the tree: the owner retired
  them the same day (D426's third amendment).
- **The room's call stays on a role vote.** The design asks no guess on
  a group round; the tree keeps D386's *And the room lands on…?* on role
  votes, because the owner approved it and it is what makes the
  Bellwether measurable (ROLES-PLAN §3.5). A rating takes no call, as
  designed. Whether the call stays is an owner row.
- **The older group questions are out of the rotation, not out of the
  bank.** The design's bank is the packs and the ratings alone; the tree
  keeps the twelve *us* and six untagged questions in the bank so the
  reveals that name them still draw their prompt, and five of them —
  re-asked word for word as ratings — are retired (`active: false`, the
  D52 shape). What to do with the rest is an owner row.
- **Standing is an aside, not yet a dim**, and the group instrument keeps
  its six types: the tables are the plan's step 2, and a dim the tables
  do not carry is a receipt row until they do (D386's rule).
- **The Mirror's Groups stop does not yet draw the cast, the votes or
  the scores** — the plan's step 3 (request 6), with this record as the
  design.
- **A role vote's rows are the tree's bars**, ordered by count with the
  crown's border in the pack's ink, rather than the design's `VoteReveal`
  redrawn; the design's grammar is the same rows with a lead.

## Status

`designed` 2026-09-08 (the owner's upload), and step 1 of the plan
`built` the same day (D429): the content model, the rotation, the card
and the fold. Steps 2–4 (the tables, the Mirror's cast and scores, the
lane's prompt) are in `docs/WORKLIST.md` and the two owner calls in
`docs/OWNER-LIST.md`.

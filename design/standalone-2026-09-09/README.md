# The 2026-09-09 standalone — how 1v1s and Groups work now

The owner's `InSight_15.html` upload of 2026-09-09 (a `__bundler`
standalone in the "fast boot v2" shape, **110 modules** in one 1.3 MB
`bundle.js`; thirteen and fourteen were never uploaded here, like eleven,
eight, six and five), delivered with a brief and one instruction: *"the
plan laid for group and 1v1 and visual. ask if anything confuses you."*
The brief is quoted whole in [`docs/VISION-2026-09-09.md`](../../docs/VISION-2026-09-09.md)
§1, which is the plan built on this record — every item measured against
the tree, and the confusions put to the owner as questions rather than
guessed. The upload is ephemeral; this directory is the durable record,
per the family's standing rule (`design/README.md`).

`design/InSight_standalone_18.html` **stays the committed reference**
until a full sync moves it (`design/README.md`'s rule). This directory,
like its siblings, does not re-point it. `docs/VISUAL-VISION.md` names
this directory as the current vision (D361's standing rule: the owner's
upload moves the vision).

**The brief names a README the bundle does not carry.** It opens *"Read
`insight/README.md` (the sections from 'Groups: votes and ratings' to
the end)"*; a `__bundler` standalone ships the modules, the template
and the fonts, and no README — searched for by its section title across
every decoded resource, and absent. The brief's own paragraphs are the
only prose this record holds, and the code was read as the design.

## What the design does, in one paragraph

**Everything is a round, and nothing in a group is called.** A 1v1's
rounds come in kinds by number — own · World · own · **cast**, repeating
(`duoKind`): an own round walks the Friends or Romantic pool by depth, a
World round shows the world's split and skips the guess when the other
person already answered that question in the feed, and every fourth
round asks *Most days, Liv is…* with four plain answers (`CAST_SETS`,
one set per mode), each carrying a dim — trust · spark · judgement ·
constancy — and a *them* form (*the one Liv tells first*) for whenever
the fact is said about the other side; your guess is at what they said
about you. A group plays **two kinds of round only** — three role votes,
then a rating (`isRatingRound`, with a per-group `phase`); no World
question, no majority, no call step. Every role has a **seat** (engine ·
hands · heart · wild) and `archetypeOf` clusters a member's received
votes into one, shown in play as the seat's *line* (*the one who gets
things going*) and never its label. The card's ballot is the members and
You as a 2-across grid of faces; its foot run is a record — a dot in the
pack's colour for a vote, a square for a rating, dotted where you were
late — with a caption on tap, not a personal score; a group reveals when
everyone has played or at a 48-hour deadline, a 1v1 the moment both are
in. The Mirror's Groups stop is Overview (the role map, and *Here, you
are the one who gets things going · 5 of 15 votes say so*) · Votes ·
People (an affinity swarm with numbers, the seats list, in-common chips)
· Scores · Compare, and *the room named you N of M* appears in Compare
alone. The role instrument is **one idea in two settings** — what the
people around you make you: a 1v1's dims are the share of casts that
named you per axis (from one cast), a group's the share of your votes
per seat (from two votes); the types are the four pure seats and their
blends (`role-data.js`); how well you read each other leaves the
instrument for the person page's new **Together** tab.

## The files here

All ten modules the bundle's own hashes say moved since the 09-08 record
— the first extraction whose moved set is a hash comparison rather than
a reconstruction (the 09-08 README asked for exactly this). Load order is
identical to 09-08's (`order.json`), and no module was added or removed.

| File | What it is | Where it lands |
| --- | --- | --- |
| `duels-data.js` | the model: `LEAD = 5`, `DEADLINE = 48h`, `duoKind` (own · World · own · cast), `worldQ` off `DAILYQ` with `publicAnswer` → `noGuess`, `SEATS`, the five `SCENARIOS` with a `seat` on every role (two roles differ from the 09-08 packs — see below), `RATE_QS`, `stepLabel`, `isRatingRound = (r + phase) % 4 === 0`, `groupQ` (a `vote` with `targets` ∥ `options`, or a `rate`), `groupPicksRound` → winner · second · contested · votes · people / mean · score, `groupDeadline`, `groupRevealed`, `roleVotes` (latest vote per role), `archetypeOf`, `groupScores`, `groupView`, `CAST_SETS`, `castQ` (`optionsThem`), `castOf` → youAre · theyAre · sawIt · casts, `duoRound`, `duoView`, `partners`, `impressions`, `gState`/`dState` returning null when the question moved | `data/deck.ts` (`duelQFor`: the kinds, the phase, the cast question), `data/live.ts`, `functions/src/pure.ts` (the deadline), `content/duel-questions.json` (seats, the cast sets, the two role changes), `data/roles.ts` (`castOf` / `archetypeOf` as folds over reveals) — the plan's §2–§3 |
| `role-data.js` | the two instruments: `MIN_DUO = 1` cast, `MIN_GROUP = 2` votes; `CFG` (hues, poles, labels), `AVG` (25 a dim), `RULE_WORD`/`RULE_ADJ`/`DIM_WORD`; `DUO_TYPES` (ten: four pure, five blends, The Everything) and `GROUP_TYPES` (eleven: four seats, six blends, The Ensemble); `castDims` (share of casts per axis), `seatDims` (share of votes per seat), `blend`, `personTypes`, `sawIt`, `sync` into the result-card registries | `data/roles.ts`, `spec/archetype-data.js`, `spec/test-definitions.js` (`IS_TEST_AVG` duo/group), `spec/explain-sheet.jsx` — the plan's §5 |
| `duo-daily.jsx` | the 1v1 card on the shared shell: `DuoRevealBlock` (SAID · CALLED, a cast's lead line *You are the one Liv tells first. Liv is the one you ask what to do.*, or `WorldCols` with the no-guess line), `DuoCard` (ask · guess over `optionsThem` on a cast · wait · sealed list · the two runs), the *Question set* toggle, *End this 1v1? Your history stays on your map.* | `ui/LiveDuelPanel.tsx` — the plan's §2 |
| `group-daily.jsx` | the shared shell it exports — `RoundStack`, `CardFrame`, `CardHead`, `RoundSheet` + `useSheet` + `SheetFoot`, `RoundRun` (marks as objects with `color`/`sq`/`title`, `onPick`), `RoundKicker`, `OptBtn`, `PoleBallot`, `WorldCols`, `SealedList` — and the group card: the 2-across face grid, `VoteReveal`, `RateReveal`, `GroupRevealBlock` (*closed at the deadline*, the late line), the run as a record with `caption(r)`, the *New group* sheet | `ui/LiveDuelPanel.tsx` — the plan's §3 |
| `group-mirror.jsx` | the Groups stop: `GMIdentity` (the ring is roles cast over all roles), `GroupVotesCard` (*Who the room named*, by pack, each row opening who voted for whom), `GroupScoresCard` (*How the group rates itself*, pole rows, five ticks, you over the group), `GroupPeopleCard` (*Who's who*: the affinity swarm with numbers, the seats list with vote counts, *in common* chips), `GroupCompareCard` (`CompareBreakdown`, *How they see you* crowns as chips, *the room named you N of M votes*), `GroupsMirrorBody` (Overview · Votes · People · Scores · Compare) | `ui/LiveGroupsMirrorBody.tsx` — request 6, the plan's §4 |
| `group-role-map.jsx` | the cast drawn: `buildField` (people on a ring, each earned role a satellite, a contested role between two, a seat per person from `archetypeOf`, a relaxation pass), `RoleVoteCard`, `RoleSheetCard` (*how The Crew cast you*, the seat's label · line) | request 6, the plan's §4 |
| `roles-panel.jsx` | the profile's Roles tab: *In 1v1s* (the average card, *You guessed what they'd say you are N of M times*, one row per partner with its casts count, a thin row *asked at round 4* / *not started*) and *In groups* (the average card, one row per group with its votes count, a thin row *not named yet*) | `ui/LiveRolesPanel.tsx` — the plan's §5 |
| `first-day.jsx` | the first run of Circle and 1v1: the group's preview is now a role vote — the pack kicker, a 2×2 grid of You and open seats, *A role a round. The ballot is whoever is in; the room names one of you.*, *Who the room names, round by round* | `ui/LiveDuelPanel.tsx`'s `LdFirstRun` — the plan's §3 |
| `person-overlay.jsx` | the person page: Match · Answers · **Together** · Map. Together holds *What you are to each other* (`castOf`: *You are the one Liv tells first. Liv is the one you ask what to do.* · *Liv said so in 2 of 3 rounds asked · you guessed it 2 of 3*), *How well you read each other* (two rings, the reader line, the per-domain rows), the groups you share with their seats, and the doors to the 1v1 and each group. Since the 09-07 record the Answers panel is also new: the questions you both answered as a 7-across grid of dots, filled where you agree, a selected one opening the pair of answers | `spec/person-overlay.jsx` — the plan's §5 |
| `explain-sheet.jsx` | the ⓘ copy for the two instruments: *What you are to them: which of four things they say is true of you, as a share of the rounds that ask* with a line per axis; *Your seat in the room: every vote you received, by the part it was cast in* with a line per seat | `spec/explain-sheet.jsx` — the plan's §5 |
| `order.json` · `hashes.json` | the bundle's own load order and per-module hashes, for the next extraction to diff by | — |

Every `.jsx` file here is **Babel's output** under the module's own name
(classic runtime), compacted by the bundle and pretty-printed here with
`@babel/generator` (the tree's own dependency), as the 09-08 record was.
Read them as the design.

## What moved, measured

`hashes.json` against `standalone-2026-09-08/hashes.json`: **ten of 110
moved, none added, none gone**, load order identical. The ten are the
files above. Three are outside the duel family and were diffed
AST-normalised (comments off, quotes normalised) against their last
records: `explain-sheet.jsx` (08-24 record) changed only its `duo` and
`group` entries; `first-day.jsx` (09-08 record) changed only the group
preview; `person-overlay.jsx` (09-07 record — the 09-08 bundle did not
save it) gained the Together tab and the Answers grid, and the record
cannot say which of the two uploads each arrived in.

Against the 09-08 duel family, the substantive changes are:

- **The 1v1 has kinds of round.** `duoKind`: own · World · own · cast.
  The 09-08 model had world rounds on even numbers and no cast; the tree
  retired the world rounds the day they were built (D426's third
  amendment) — the plan's first question.
- **The cast round and the cast sets** (`CAST_SETS`, `castQ`, `castOf`),
  and the instrument that reads them (`role-data.js` whole: the 09-08
  dims own · pull · cast · settle and read · seen · like · steady are
  gone; the seats and the axes replace them; `MIN_DUO` 3 → 1).
- **Seats.** Every scenario role carries a `seat`, and two roles changed
  to make each pack one role per seat: Zombie Plan's *the supply hoarder*
  (`gr13`) is *the medic — Who patches everyone up?* (heart), and Road
  Trip's *the snack captain* (`gr19`) is *the hourly stop — Who needs to
  pull over every hour?* (wild); The Sitcom's roles are the same four
  in a different order. The tree's bank is the 09-08 packs (D434).
- **No call.** `callGroup`, `needsCall` and `callDue` are gone, with the
  brief's principle *nothing in a group is predicted or called*. The
  tree keeps D386's *And the room lands on…?* — an owner row since 09-08.
- **The run is a record.** `RoundRun` takes marks with a colour, a
  square and a title, and an `onPick` for the caption; the 09-08 marks
  encoded whether the room named you.
- **A `phase` per seeded group** staggers the rating round; the 09-08
  model rated every group on the same round numbers.
- **`DEADLINE` is 48 hours** in both models; the tree's server constant
  is 24 (`ROUND_DEADLINE_MS`, D426) — the plan's question.
- **The Groups stop** gained Overview (the seat line and the role map
  above the lenses) and the People card's seats list and in-common chips.

## Where the tree departs from the design, and why

Nothing is built from this record yet: the brief asked for the
confusions first, and six of them change the build's shape. The
departures the plan already knows it will keep are recorded there
(`VISION-2026-09-09.md` §6 and §8): a live answer is create-only (D86),
so a moved question cannot re-open a round the way `dState`/`gState`
do — the tree's stored `qid` and `revealQid`'s plurality are the honest
equivalent; and the World round in a 1v1 stands retired (D426's third
amendment) until the owner says otherwise.

## Status

`designed` 2026-09-09 (the owner's upload). Nothing built; the plan's
questions are on `docs/OWNER-LIST.md`, and its steps on
`docs/WORKLIST.md`, gated on the answers they need.

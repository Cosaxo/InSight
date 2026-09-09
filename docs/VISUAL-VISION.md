# Visual vision — the design the tree is built toward

**Status: tree.** The companion of `VISUAL-REQUESTS.md` (`PROGRAM-PLAN.md`
§2.6, D352): one page naming the newest Claude Design output the app is
being built toward, what it changed over the one before, and which
visual requests it closed. Upgraded in the PR that crosses a request
out. It does **not** re-point `design/README.md`'s style-diff reference
— `InSight_standalone_18.html` stays what `scripts/style-diff.mjs`
compares the tree against until a full sync moves it (that file's own
rule). The reference is what the tree matches today; the vision is what
it is moving toward.

## The current vision — the 2026-09-09 standalone: how 1v1s and Groups work now

- **Source:** the owner's `InSight_15.html` upload of 2026-09-09 — the
  fifteenth numbered standalone — delivered with a brief (*"the plan
  laid for group and 1v1 and visual. ask if anything confuses you"*) and
  extracted to `design/standalone-2026-09-09/` (its README is the
  readable half: the ten modules the bundle's own hashes say moved, what
  moved against the 09-08 record, and the README the brief names that
  the bundle does not carry).
- **The plan built on it:** `VISION-2026-09-09.md` — every item measured,
  and the confusions put to the owner as eight questions (§6) before the
  build: whether World rounds return to the 1v1, the clock, the call,
  two role changes, the floor for a name. D436 records the arrival.
- **What it changed over the 2026-09-08 standalone:** the 1v1 has kinds
  of round, and every fourth is a **cast** — *Most days, Liv is…*, four
  plain answers per mode with a dim and a *them* form, the guess at what
  they said about you; every role has a **seat** (engine · hands · heart
  · wild) and a member's received votes cluster into one; the group's
  ballot is a grid of faces, its run a record with a caption on tap, its
  reveal at everyone-played or 48 hours, and nothing in a group is called;
  the Groups stop gains an Overview (the seat line, the role map) and its
  People card the seats and in-common chips; the instrument is one idea
  in two settings — casts per axis, votes per seat — with ten and eleven
  types; how well you read each other moves to the person page's new
  Together tab.
- **Built from it:** the whole of `VISION-2026-09-09.md` §7 steps 1–6,
  on the owner's eight answers of the same day (D437): the seats and the
  cast in the bank, the rotation with a phase per room, the rules'
  refusal of a call, the card (the face grid, the run as a record, the
  cast round), the instrument in two settings, the Groups stop with the
  role map, and the demo re-ported so it plays rounds. Not taken: the
  World round (Q1: no); the person page's tab shell (the 09-07 record's,
  not this brief's).
- **Requests it closed:** 5 and 6 built; 12 redrawn to the brief.

## The one before — the 2026-09-08 standalone: the group as a cast

- **Source:** the owner's `InSight_12.html` upload of 2026-09-08 — the
  twelfth numbered standalone, delivered with a ruling on the world
  rounds the tree had built that afternoon (*"they should be more like
  this … its worst for group as that should mostly be about what role
  you have in the group"*) — extracted to `design/standalone-2026-09-08/`
  (its README is the readable half: the duel family whole, the bundle's
  hashes, what the extraction did not diff, and where the tree departs).
- **The plan built on it:** `VISION-2026-09-08.md` — the mechanism was
  already in the tree (a `pick` with D224's snapshot) and the content was
  not; step 1 built the same day (D434).
- **What it changed over the 2026-09-08 canvas:** the group's rounds.
  A round is a role vote in a scenario pack — *Bank Heist · Who plans
  the whole thing?* — with the members as the options and the pack's hue
  on the kicker, or every fourth round a rating of the group between two
  poles on five steps; the reveal crowns who the room named (*Ada is the
  mastermind*, a contested pair when the runner-up is within a vote) or
  puts the members on the five stops with the group's dot on the track;
  the run's marks are the pack's colour where the room named you, a ring
  where it named someone else, a square for a rating. The Mirror's Groups
  stop draws the cast and the ratings (step 3), and the group instrument
  regains Standing and its nine types (step 2). The world rounds the same
  upload carries on the 1v1 are retired, not drawn (D426's third
  amendment).
- **Built from it:** step 1 — the bank, the rotation, the card, the fold
  (D434) — `content/duel-questions.json`, `data/deck.ts`,
  `ui/LiveDuelPanel.tsx`, `data/roles.ts`.
- **Requests it closed:** 6 moves to `designed`; 5's group half is drawn
  in it.

## Before that — the 2026-09-08 canvas: the 1v1 and group card

- **Source:** the owner's `1v1_and_Group_Cards.html` upload of
  2026-09-08 — Claude Design, from the prompt the rounds session wrote
  for request 12 — extracted to `design/rounds-card-2026-09-08/` (its
  README is the readable half: the nine states, every string, the
  behaviours a static reading loses, and where the tree departs from the
  canvas). Made the vision by this page's own rule: the request it
  answers is crossed out as built.
- **The plan built on it:** `ROUNDS-PLAN.md` §7.5 and request 12 — the
  card's whole grammar was a clock, and under rounds a 1v1 has none. §0a
  records the build's departures beside the model's own.
- **What it changed over the 2026-09-07 design:** one surface, redrawn
  whole. The 1v1 and group card stops counting to midnight: a kicker
  names the round, the prompt is in the serif, the answer is a tinted
  option and the read a second step, a 1v1 says *waiting on Ada* and
  nothing else, a group counts coarsely to its round deadline, the reveal
  is a SAID · CALLED table or a split with faces (the canvas's World
  round, three columns, was built and retired the same day — D426's
  third amendment), the absent are seats, the late answer is said plainly,
  and a run of rounds at the foot carries the calls and the rounds in
  play. The 09-07 design's *first day* (today sealed, tonight's clock,
  tomorrow revealed) is superseded by the first run drawn here: sealed,
  then revealed *when Ada plays*.
- **Built from it:** the whole card, the same day (D426's second
  amendment) — `ui/LiveDuelPanel.tsx`.
- **Requests it closed:** 12.

## Before that — the 2026-09-07 standalone

- **Source:** the owner's `InSight_10.html` upload of 2026-09-07,
  extracted to `design/standalone-2026-09-07/` (its README is the
  inventory: the three new modules and seven that moved, the six
  patches, the unchanged list — compiled JSX again, the 09-02 README's
  recipe applies; no stylesheet moved). Made the vision by D361's
  standing rule — the owner's upload moves the vision — and recorded
  at D415.
- **The plan built on it:** `VISION-2026-09-07.md` — every item
  measured against the tree with its backend half named, and, on the
  owner's ask with the upload (*"we need to make a plan for testing
  them as well"*), its §2 is the plan for how the new sub-scales get
  MEASURED: the item banks, where they are answered, the fold and its
  floors, what is stored, what proves it. §6 is the build order as
  worklist lines, §7 the gate per step. Nothing is built.
- **What it changed over the 2026-09-06 design:** three additions and a
  polish pass. **The two instruments most people know get a second
  level** — the Big Five's five domains unfold into the thirty IPIP-NEO
  facets (six per domain on a 4–20 track, IPIP-NEO's report text behind
  each) and the compass's six axes into eighteen positions (three per
  axis on a 0–100 track with a hollow *most people* ring); the compass
  carries its own way in (*Six questions place them →*, in place, after
  which the axis is its positions' mean), while the Big Five draws
  readings with no questions behind them. **Circle and 1v1 get a first
  day** — one day of the game drawn with nothing invented (today
  sealed, tonight's clock, tomorrow revealed) and then the doors;
  invitation and link heroes; the name field where an account has
  none; a *Start another* row once circles exist. **The person
  overlay's three record sections go boxless** — the receipts led by a
  sentence with the exception side first, *Play together* as doors, the
  read-each-other card as a two-column hit-rate table. One line on the
  feed's two-option ballot.
- **Built from it:** nothing yet. The owner ruled the plan's three rows
  on 2026-09-07 (D416): the in-place questions do not build (the feed is
  the only door, D121 stands), the facets and positions stay on the
  device for now, and the Big Five's facet items are written next — so
  steps 1–3 and 5–6 build in order and step 4 is struck.
- **Requests it closed:** none. It **draws the person's-page half of
  request 5** (the pair's card: the doors and the reading table), which
  still waits on `ROLES-PLAN.md`'s owner call.

## The lineage

| Design | Directory | What it brought | Record |
| --- | --- | --- | --- |
| v18 | `design/InSight_standalone_18.html` | the committed reference; what `style-diff` aims at | `design/README.md` |
| v24 · v25 · v28 | `design/standalone-v24/` `-v25/` `-v28/` | v28: the third tab, the tweak laboratory dismantled into defaults, eighteen new modules | `VISION-V28.md` |
| 2026-08-20 | `design/standalone-2026-08-20/` | the Patterns tab whole — People lens, Map and Oracle redesigns, population chips | D214–D216 |
| 2026-08-22 | `design/standalone-2026-08-22/` | the paid question report | D251 |
| 2026-08-24 | `design/standalone-2026-08-24/` | the suggestion board becomes the paid door; the buyer's room; locals and visitors | `VISION-2026-08-24.md`, D287–D288 |
| 2026-08-26 | `design/standalone-2026-08-26/` | anonymous answers and private results (the first design to amend D98 — still an owner decision), co-funded seats and the catalog window, the Oracle's working, a Patterns and person-overlay polish pass | `VISION-2026-08-26.md`, D310 |
| 2026-09-02 | `design/standalone-2026-09-02/` | one instrument for the three lenses, the ring, the serif voice, the split ballot | `VISION-2026-09-02.md`, D361 |
| 2026-09-06 | `design/standalone-2026-09-06/` | ink on paper, the 12px floor, the dial in the header | `VISION-2026-09-06.md`, D390 |
| 2026-09-07 | `design/standalone-2026-09-07/` | the two instruments' second level, Circle and 1v1's first day, the person overlay boxless — the one before, above | `VISION-2026-09-07.md`, D415 |
| 2026-09-08 | `design/rounds-card-2026-09-08/` | the 1v1 and group card when a round is the unit: nine states, the run of rounds, the first run | `ROUNDS-PLAN.md` §0a, D426 |
| 2026-09-08 | `design/standalone-2026-09-08/` | the group as a cast: role votes in packs, a rating every fourth round, the crown and the contested pair | `VISION-2026-09-08.md`, D434 |
| **2026-09-09** | `design/standalone-2026-09-09/` | **the current vision** — how 1v1s and Groups work now: the cast round, seats, the run as a record, the Groups stop's Overview, the instrument in two settings, the Together tab | `VISION-2026-09-09.md`, D436 |

## How the next one arrives

A request in `VISUAL-REQUESTS.md` reaches `drafted` (a routine's canvas,
after its plan) and then `designed` (the owner's accepted canvas,
extracted under `design/` with a README in the family's shape). When a
request is crossed out as `built`, this page's *current vision* moves
to that design, the lineage gains a row, and the one before keeps its
row. A design that is drafted and never accepted is not a vision and
gets no row.

**The owner's own upload moves it too** (D361, 2026-09-02). A new
standalone the owner drops — the `InSight_N.html` series — is a vision
without a request: it is extracted under `design/` with a README in the
family's shape, measured against the tree in a `VISION-<date>.md`, and
named here as the current vision in the same PR, until the owner
uploads the next one. The requests list keeps its own path; a design
that arrives this way closes whichever requests it happens to draw and
reopens the plan of any it redraws the surface of.

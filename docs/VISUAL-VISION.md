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

## The current vision — the 2026-09-08 standalone: rounds in the prototype, the person's page as four tabs

- **Source:** the owner's `InSight_11.html` upload of 2026-09-08,
  extracted to `design/standalone-2026-09-08/` (its README is the
  inventory: the 21 modules that moved, the seven deleted, the four
  sheets, the unchanged list — and the recipe that reads a MINIFIED
  bundle exactly, since this upload carries no comments and the files
  there are Babel reprints). Made the vision by D361's standing rule —
  the owner's upload moves the vision — and recorded at D429.
- **The plan built on it:** `VISION-2026-09-08.md` — every item
  measured against the tree with its backend half named; §8 is the
  build order as worklist lines, §9 the gate per step; two owner rows
  in §7. Nothing is built.
- **What it changed over the 2026-09-08 canvas:** five moves, the first
  of them the canvas itself arriving in the prototype. **Rounds reach
  the prototype** — the demo engine and both daily bodies take the
  rounds card (the lead, the deadline, the late answer, World rounds,
  the nine states, the run), the reveal clock is deleted, the first run
  loses *Tonight* and its *Start another* row, *days* become *rounds*,
  twelve duel prompts lose their calendar words. **The ruler says
  Groups · 1v1s** for Circle · 1v1; the Mirror's Circle keeps its name.
  **The paid family leaves the prototype** whole. **The person's page
  becomes four tabs** — Match · Answers · Together · Map — with a swipe
  between them: an accordion of the instruments, a grid of topic-hued
  dots filled for the same answer and ringed for a split, tiles with a
  figure and the pair's type over two reading rings, the person's own
  map. **A polish-and-optimise pass** — 44 px slack by pseudo-element,
  a 12 px floor on initials, one reduced-motion switch, one timer for
  every `Lazy` card, the feed's head-hide off React state, a CSS sweep,
  a dozen copy cuts.
- **Built from it:** three of the five moves, the same day, on the
  owner's word (D430): the paid family leaves with the buyer's room
  (`ui/AskedByYouOverlay.tsx`, its store and `CurSwitch` gone), the
  person's page is four tabs with the swipe, the dot grid, the tiles,
  the rings and the person's own map (`spec/person-overlay.jsx`,
  `CompareList`, `useSubSwipe`), and the polish pass — the hit slack,
  the motion switch, one timer for every `Lazy` card, the feed's
  head-hide off state, three dead rules, the copy cuts. Not built: the
  demo twins under rounds (the live card was already built), the live
  person's page, the duel bank's calendar words. The ruler's *Groups*
  label is an owner question — a group is not a circle, and the plan
  had read it as a rename. The map's friends-only sentence stays an
  owner row for the live page (D98, D334).
- **Requests it closed:** none. It **draws request 5's third surface a
  third way** (the pair's card on the person's page: the 1v1 tile with
  its figure and type, the reading rings), which still waits on
  `ROLES-PLAN.md`'s owner call; the 2026-09-07 first-day and
  person-overlay lines are superseded by it.

## The one before — the 2026-09-08 canvas: the 1v1 and group card

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
  is a SAID · CALLED table or a split with faces — three columns on a
  World round — the absent are seats, the late answer is said plainly,
  and a run of rounds at the foot carries the calls and the rounds in
  play. The 09-07 design's *first day* (today sealed, tonight's clock,
  tomorrow revealed) is superseded by the first run drawn here: sealed,
  then revealed *when Ada plays*.
- **Built from it:** the whole card, the same day (D426's second
  amendment) — `ui/LiveDuelPanel.tsx`.
- **Requests it closed:** 12.

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
| 2026-09-08 | `design/rounds-card-2026-09-08/` | the 1v1 and group card when a round is the unit: nine states, the run of rounds, the first run — the one before, above | `ROUNDS-PLAN.md` §0a, D426 |
| **2026-09-08** | `design/standalone-2026-09-08/` | **the current vision** — rounds in the prototype, Groups · 1v1s, the paid family gone, the person's page as four tabs, the polish pass | `VISION-2026-09-08.md`, D429 |

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

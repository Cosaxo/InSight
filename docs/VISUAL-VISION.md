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

## The current vision — the 2026-09-02 standalone

- **Source:** the owner's `InSight_7.html` upload of 2026-09-02,
  extracted to `design/standalone-2026-09-02/` (its README is the
  inventory: the ten modules and four stylesheets that moved, the four
  patches, the unchanged list — and the one thing this upload does
  differently: it ships compiled JSX, so the README carries the recipe
  that makes the diff exact). Made the vision on the owner's sentence
  of that day — *"new visual should be added as the new visual vision
  until i update it with new visuals"* (D353) — not through a request.
- **The plan built on it:** `VISION-2026-09-02.md` — every item
  measured against the tree with its backend half named, §7 the build
  order as worklist lines, §8 the gate per step.
- **What it changed over the 2026-08-26 design:** the three Patterns
  lenses become **one instrument** — a round dusk field in a light card,
  a title and one plain sentence above, a legend in words below
  (`lens.css`); the Map is redrawn as a **ring** (questions on a rim by
  topic, ties as chords — position stops meaning similarity, and the
  basis lines change with it), the Oracle moves into the field (the two
  options are its halves, the verdict is said in words), the People lens
  colours every dot by agreement in three steps and names the five most
  like you; the shell gains a meta line, a topic select and a swipe axis
  that runs off the far end into the daily. **Every prompt a person
  answers gets a serif voice** (Spectral, `--serif`). **The two-option
  ballot splits** into one block with a hairline seam that moves to the
  crowd's split, on the daily and on every feed card. Smaller: topic-hued
  answer rows in the Mirror's Answers lens, a quieter Crossroads tree,
  the paid door's rate rows with the pricing law as scannable tokens, the
  catalog window's polish (still waiting on its owner decision), the tab
  bar's buttons losing weight.
- **Built from it:** all of it but the half that waits on an owner
  decision (D354, six commits in `VISION-2026-09-02.md` §7's order): the
  shared instrument and the three lenses, the shell's axis, the prompt
  voice, the split ballot, the answer rows and the Crossroads tree, the
  paid door's rate rows. Only the catalog window (§4.2) is unbuilt, on
  VISION-2026-08-26 §2.2's seat-split sentence.
- **Requests it closed:** none. It **re-aimed request 1** (trait-axis
  directions on the Map), which was written against the plane the ring
  retires: that request now states the three grammars a ring can carry
  an axis in, and what each costs.

## The lineage

| Design | Directory | What it brought | Record |
| --- | --- | --- | --- |
| v18 | `design/InSight_standalone_18.html` | the committed reference; what `style-diff` aims at | `design/README.md` |
| v24 · v25 · v28 | `design/standalone-v24/` `-v25/` `-v28/` | v28: the third tab, the tweak laboratory dismantled into defaults, eighteen new modules | `VISION-V28.md` |
| 2026-08-20 | `design/standalone-2026-08-20/` | the Patterns tab whole — People lens, Map and Oracle redesigns, population chips | D214–D216 |
| 2026-08-22 | `design/standalone-2026-08-22/` | the paid question report | D251 |
| 2026-08-24 | `design/standalone-2026-08-24/` | the suggestion board becomes the paid door; the buyer's room; locals and visitors | `VISION-2026-08-24.md`, D287–D288 |
| 2026-08-26 | `design/standalone-2026-08-26/` | anonymous answers and private results (the first design to amend D98 — still an owner decision), co-funded seats and the catalog window, the Oracle's working, a Patterns and person-overlay polish pass | `VISION-2026-08-26.md`, D310 |
| **2026-09-02** | `design/standalone-2026-09-02/` | **the current vision** — above | `VISION-2026-09-02.md`, D353 |

## How the next one arrives

A request in `VISUAL-REQUESTS.md` reaches `drafted` (a routine's canvas,
after its plan) and then `designed` (the owner's accepted canvas,
extracted under `design/` with a README in the family's shape). When a
request is crossed out as `built`, this page's *current vision* moves
to that design, the lineage gains a row, and the one before keeps its
row. A design that is drafted and never accepted is not a vision and
gets no row.

**The owner's own upload moves it too** (D353, 2026-09-02). A new
standalone the owner drops — the `InSight_N.html` series — is a vision
without a request: it is extracted under `design/` with a README in the
family's shape, measured against the tree in a `VISION-<date>.md`, and
named here as the current vision in the same PR, until the owner
uploads the next one. The requests list keeps its own path; a design
that arrives this way closes whichever requests it happens to draw and
reopens the plan of any it redraws the surface of.

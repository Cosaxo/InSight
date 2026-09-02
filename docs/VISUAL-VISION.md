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

## The current vision — the 2026-08-26 standalone

- **Source:** the owner's `InSight_4.html` upload of 2026-08-26,
  extracted to `design/standalone-2026-08-26/` (its README is the
  inventory: every file, where it lands, and the nine patches recorded
  as diffs).
- **The plan built on it:** `VISION-2026-08-26.md` — every item
  measured against the tree with its backend half named.
- **What it changed over the 2026-08-24 design:** anonymous answers and
  private test results (the first design to amend D98 itself);
  co-funded subscription seats with a read-only catalog window (the
  shop window); the Oracle's "working" — the sealed call rebuilt in
  the open; a Patterns and person-overlay polish pass (lens swaps slide
  from the side you moved toward, the beacon becomes a tap target, the
  People lens' selected person wears their dot's hue); the instruments
  turned toward one person (`role-data.js`).
- **Built from it:** the client passes at D310 — the Oracle's working,
  the Patterns polish, Play together, the feed's participation pass, a
  still-render crash fix. The two big halves wait on their owner
  decisions (anonymous answers + private results; the co-funded seats
  and catalog window).
- **Requests it closed:** none — the request list starts 2026-09-02.

## The lineage

| Design | Directory | What it brought | Record |
| --- | --- | --- | --- |
| v18 | `design/InSight_standalone_18.html` | the committed reference; what `style-diff` aims at | `design/README.md` |
| v24 · v25 · v28 | `design/standalone-v24/` `-v25/` `-v28/` | v28: the third tab, the tweak laboratory dismantled into defaults, eighteen new modules | `VISION-V28.md` |
| 2026-08-20 | `design/standalone-2026-08-20/` | the Patterns tab whole — People lens, Map and Oracle redesigns, population chips | D214–D216 |
| 2026-08-22 | `design/standalone-2026-08-22/` | the paid question report | D251 |
| 2026-08-24 | `design/standalone-2026-08-24/` | the suggestion board becomes the paid door; the buyer's room; locals and visitors | `VISION-2026-08-24.md`, D287–D288 |
| **2026-08-26** | `design/standalone-2026-08-26/` | **the current vision** — above | `VISION-2026-08-26.md`, D310 |

## How the next one arrives

A request in `VISUAL-REQUESTS.md` reaches `drafted` (a routine's canvas,
after its plan) and then `designed` (the owner's accepted canvas,
extracted under `design/` with a README in the family's shape). When a
request is crossed out as `built`, this page's *current vision* moves
to that design, the lineage gains a row, and the one before keeps its
row. A design that is drafted and never accepted is not a vision and
gets no row.

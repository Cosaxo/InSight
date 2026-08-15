# The v28 vision — what changed, and what it costs to build

**Status: plan notes, not decisions.** Same convention as
[`NEXT-FUNCTIONALITY.md`](NEXT-FUNCTIONALITY.md): when an item here is
picked up it graduates to a real record in [`DECISIONS.md`](DECISIONS.md);
until then these are starting constraints, not approval. Where a verdict
says *build*, that is this document's recommendation and the owner's
adoption is the gate.

The source is the maintainer's `InSight_standalone_28.html`, extracted to
[`design/standalone-v28/`](../design/standalone-v28/) — that directory's
README is the inventory (every module, every patch, how the extraction
was done). This file is the plan.

**Everything below was checked against the tree, not assumed.** Roughly
half of what reads as "new" in v28 is already shipped — the feed's
windowing, the dial/field forms and their breakdowns, the redrawn compare
rose, Near's anonymity and its switch, the deviation view in Explore, the
suggestion board's decline states. Those are struck out in §0 and not
planned again. What is left is smaller than the diff suggested and lands
in three groups, which is the useful shape of this document.

## 0 · The short version

| Item | Verdict | Size | The constraint that shapes it |
| --- | --- | --- | --- |
| **Three tabs** (`patterns · daily · mirror`) | **Owner decision first** | S (shell) | The tab count is the app's thesis sentence — `CLAUDE.md` opens with "a two-tab app". Cheap to build, expensive to be wrong about. |
| **Patterns · Map** (questions placed by mutual prediction) | **Build — but the engine is a backend item** | L | The prototype invents 560 people. A real map needs cross-question co-occurrence, which no aggregate publishes today. |
| **Patterns · Oracle** (guess your next answer) | **Build, second** | M | Rides the *same* publication as the Map. Two readers, one server fold — that is the whole reason to sequence them together. |
| **Pulse: one → five, with cadence** | **Build** | M | D139's store is single-pulse by deliberate choice ("a roster becomes a parameter the day a second pulse ships"). This is that day. |
| **Pulses take their turn in the feed** | **Build, with the above** | S | The interleave is a feed-lane change; `feed-interleave.ts` already owns exactly this kind of cadence rule. |
| **Foresight CALL + its feed cards** | **Tier A only** | M | D127 is unchanged by v28: the blocker is resolution integrity, not design. Tier A self-resolves on our own aggregates and is buildable now. |
| **Foresight & Crossroads on the Map** | **Build when the eager budget moves** | S each | Both need `map-tab.jsx` — which is EAGER — to read a new store, and `MAX_EAGER_KB` has no headroom. D136 already parked `paths.mapTree()` for exactly this. |
| **Born or built** (heritability rows on the result card) | **Build — but decide the framing first** | S | The data is a 16-line constant. The risk is not engineering: a genetics figure on a personal result card is read as a claim about *you*. |
| **What moves together** (cross-test threads on the profile) | **Build** | S | Pure fold over `IS_TEST_RESULTS`; no new reads, no new collection. The cheapest real feature in the file. |
| **Type-mix system switch** (all four instruments) | **Build** | S | D141 shipped the card; this is one control and a persisted key. Does **not** touch D8 — it switches which *result* is charted, not which dim cohorts. |
| **The sponsored frame** | **Unchanged: waiting on the paid path** | S | `paid-data.js` is byte-identical to v24. Nothing new to decide; the door is still §6 of NEXT-FUNCTIONALITY. |
| **The visual corrections** (nine small ones) | **Build as one pass** | S | No decisions in any of them. Best done in a single commit against the patches. |
| **The tweak teardown** (19 flags settled) | **Adopt as the record** | S | The prototype deleting a flag *is* the decision. The app's cost is dead-branch removal, which is what rule 4 and the compiler want anyway. |
| **The Arena** | **Ask the designer** | — | 103 lines of CSS for a card that is not in the bundle. Verified orphaned. A stylesheet cannot say what the game is. |
| ~~Feed windowing, dial/field + breakdowns, compare rose, Near anonymity + switch, Explore deviation, suggestion declines~~ | ~~build~~ **already shipped** | — | Checked file by file; see §6. |

## 1 · The structural change: two tabs become three

`patterns · daily · mirror`, the daily in the middle so a swipe either way
lands somewhere. The daily's ruler already runs off its far end into the
Mirror (D-era `goNav`); v28 runs it off the near end into Patterns, and
`daily-split.jsx` gains a `SKIP` selector so the axis stops stealing drags
from maps, fields and scrollers.

**This is the one item that is not an engineering call.** The two-tab
shape is the first sentence of `CLAUDE.md` and the frame every Mirror
decision has been written inside — "answering is the smaller half" reads
differently when there are two halves and a third thing. The build is
small (a `TABS` entry, a glyph, an accent, a lazy chunk). Adopting it
means rewriting that opening paragraph and re-reading D99/D100/D112/D136
for anything that leaned on "two".

**Recommendation:** decide this *before* Patterns is built, not after. A
Patterns tab with nowhere to live becomes a Mirror stop by default, and
the Mirror's stops are a graduated axis from *you* to *the world* —
Patterns is not a point on that axis, which is precisely why the
prototype gave it its own tab.

## 2 · Patterns — the real work

Two lenses over one engine.

- **Map** (`question-map.js` / `.jsx`) — every question in the pool as a
  place; distance IS how much two answers predict each other. Position,
  colour, size, fill and line each carry exactly one fact and there is no
  legend. Tap a place and the card says the link out loud: *"Pick this —
  and 78% pick that."*
- **Oracle** (`patterns-tab.jsx`) — the app guesses your next answer,
  sealed before you tap, and shows which of your past answers gave you
  away. Surprisal in bits is the score; a tall bar is a time you were
  unreadable.

**The engine is the whole cost, and it is a backend item.**
`patterns-core.js` builds a synthetic population of 560 people whose
marginals match the feed's real splits. In the prototype that is honest
furniture. Here it would be fabrication of exactly the kind this tree
refuses — and the module's own header already points at the real shape:
*"in production a streaming/incremental fit over the vote log"*.

What the app can and cannot do today, verified against the read model:

- **Per-question marginals: already public.** `agg.by` publishes option
  counts per demographic cut (`data/cohort.ts`), from the first answer.
- **Per-person answer vectors: readable but not affordable at this
  shape.** D98 made other users' answers world-readable and
  `data/voters.ts` reads them — but as *one collection-group query per
  question*. A map over ~85 questions is ~85 queries per open. That is
  the read pattern `voters.ts`'s own header was written to avoid.
- **Cross-question co-occurrence: does not exist.** No document anywhere
  carries P(answer *j* | answer *i*). Both lenses need it — the Map for
  its factor loadings, the Oracle for its naive-Bayes posterior — which
  is the argument for treating them as one item rather than two.

**The shape that fits this tree:** a new Cloud Function fold, on the same
trigger path the aggregate ledger already runs on, publishing a small
per-question **loading vector** (K numbers, K ≈ 8) rather than a pairwise
matrix. Then `sim(i,j)` is a cosine over 2K floats on the device, position
is the first two components, and the "78% pick that" line is the one exact
2×2 table you fetch for the pair actually on screen. That is
`question-map.js`'s own architecture, and it is O(questions), not
O(questions²) — it stays honest at a million questions and cheap at
eighty-five.

Cost notes to settle before building, not after:

- The trigger already folds every answer; adding a rank-K update is
  arithmetic on a document it is opening anyway. **Measure it** —
  `docs/COSTS.md` is where the number goes, and the aggregate trigger is
  the app's hottest write path.
- Client side: **new code arrives as typed ESM under `src/v2/data` and
  `src/v2/ui`, never as new spec globals** (`check:globals` rule 4 only
  moves down — run it for the live figure). A whole tab on the bridge
  would fail CI on arrival.
- **The tab must be lazy.** `MAX_EAGER_KB` has no headroom (its own note
  in `scripts/check-bundle.mjs` says it is not raiseable), so Patterns
  loads past first paint through D25's `loadWorldFeed()` pattern. This is
  a feature, not a tax: nobody's first frame should pay for the third tab.
- The Oracle's guess must be **sealed** — computed and stored before the
  options are tappable — or the score means nothing. Same discipline as
  the duel reveal, and it belongs in a test the way `surface` pins the
  duel seal.

## 3 · Pulse: one question becomes five, each with a rhythm

`pulse-data.js` drifted hard past v24. Five pulses — mood · energy ·
sleep · focus · social — each carrying its own **cadence**: daily · often
(Mon·Wed·Fri) · weekly (Sunday) · off, set on the card itself. "Show up
more often" is a cadence, not a setting screen. And a dormant pulse is
simply not asked: **no tray, no block pinned above the feed** — pulse
cards take their turn in the stream like any other question, one card in
four.

D139's store anticipated this in as many words:

> *A roster becomes a parameter the day a second pulse ships; until then a
> constant is honest about the design.*

So the work is the parameterisation D139 described, plus three new pieces:
a cadence store (which days a pulse is due), the "not scheduled" absence
case — which joins the existing honest-absence rules rather than
complicating them — and the feed interleave.

**The honesty rules carry over unchanged and are the contract, not
decoration:** a day nobody answered is absent, never zero-filled, never
bridged; a thin day keeps its count and is listed, not positioned; a day
the pulse was not scheduled is absent too; no smoothing anywhere. v28 adds
the fourth clause; the other three are already pinned in `data/pulse.ts`.

**One thing to decide, and it is the store-forms decision again, wider.**
`NEXT-FUNCTIONALITY.md` §"Mood as the first pulse question" flagged that
mood tracking moves the store's Health disclosure and makes a public
per-person series. Sleep and energy are further into that territory than
mood is. Under D98 a pulse series is public like every other answer — so
this needs the owner, `docs/STORE-FORMS.md` and
`docs/data-inventory.md` in the same pass, before the roster ships and not
after.

## 4 · Foresight — the map branch, and tier A

v28 draws Foresight as it was always designed: two ten-second cards in the
feed (CALL sealed, READ scored instantly off the who-voted sheet's own
hash), and a **Foresight branch on the Map** where a leaf is an aim rather
than an answer — distance from You is accuracy, so the map says where you
see clearly without printing a number.

**Nothing in v28 changes D127**, and it should not be read as pressure to.
The blocker was never stakes or optics; it is that a resolved call is the
one number in the app a reader cannot recompute. v28's clock, its cards
and its map branch are the *presentation* of a mechanism whose admission
criteria are already written in `docs/FORESIGHT-CALLS.md`.

The buildable slice, unchanged from NEXT-FUNCTIONALITY §"Predictions":

- **Tier A calls** — self-resolving on our own published aggregates
  ("will tomorrow's daily split pass 60/40?"). Graded by arithmetic, no
  operator, no external source. `predict-cards.jsx` is the card for them.
- **Tier B** waits on an executable rubric and VOID as a first-class
  outcome. v28 gives it no new argument.

The map branch (`map-fore-card.jsx`, `map-groups.js`'s `g-fore`) is
blocked on the same budget as Crossroads — see §5.

## 5 · Crossroads and Foresight on the Map — one blocked door, two features

`map-groups.js` gains two over-categories matched by branch prefix:
`g-fore` (violet 282) and `g-paths` (200). The hue comments record two
rejections, which is the kind of note worth keeping on the port: 115 read
as a third olive between Knowledge 78 and Self 150, and 200 petrol went
olive on the warm ground.

D136 already hit this wall and recorded it exactly:

> *That needs `map-tab.jsx` — which is EAGER — to read this store, and the
> eager graph has no room. Reading it off the bridge instead would buy the
> bytes back and spend the coupling ratchet, so both doors are shut until
> one of the two budgets moves.*

v28 does not move either budget; it adds a **second** feature behind the
same door, which changes the arithmetic of opening it. Two candidate
moves, both real work rather than a flag:

1. **Make `map-tab.jsx` lazy.** The Map is a Mirror-tab destination, not a
   first-paint surface. Deferring it past first paint is the same D25
   pattern Patterns needs anyway — and it would free the eager budget for
   both branch families at once.
2. **Shrink the eager graph elsewhere.** Cheaper to say than to do, and
   `check:bundle`'s header already documents where the fat went.

**Recommendation:** fold this into the Patterns work. Patterns forces a
lazy-tab loader to exist; once it does, moving the Map behind it is a
small change that unblocks three parked features (Crossroads' `mapTree`,
Foresight's branch, and the Pulse branch `window.goTrends` wants to open).

## 6 · Already shipped — do not plan these again

Checked file by file at extraction time:

- **Feed windowing** (`WF_PAGE`/`WF_STEP`) — in `spec/world-feed.jsx`.
- **`dial` / `field` questions and their breakdowns** — D113/D114 made
  the forms live, D125 made the breakdowns cohort-first. The app's
  version is *ahead* of the prototype's here.
- **The compare rose redraw** — you solid, them a washed dot per slice.
  Already in `spec/compare-breakdown.jsx`, comment for comment.
- **Near's anonymity and its switch** — D111/D150 and the switch that
  landed in the corner last commit. v28's `mfpNearKindred` is the design
  catching up to the app, not the other way round.
- **Explore's deviation view** — v25's `segment-explorer.jsx` is
  byte-identical to v28's, and it is ported.
- **The suggestion board's decline states and hint pickers** — v24's
  files are byte-identical to v28's, and they are ported.
- **`--pulse` and `--field-size` tokens** — already in
  `src/v2/styles.css`.

## 7 · The small pass — nine corrections, no decisions

Best done as one commit against `design/standalone-v28/changes/`:

1. **`group-daily.jsx`** — no half-washed avatars. A row of dimmed discs
   read as broken; `sealed` becomes a hue halo, so the cue is shape, not
   saturation.
2. **`duo-daily.jsx`** — the redaction block becomes three word-shaped
   bars. One solid bar read as a loading skeleton; withheld should not
   look like pending.
3. **`person-mindmap.jsx`** — chip rows become `MTSwipeRow` (which the
   app already has in `map-bottom-card.jsx`), and the last serif title
   goes.
4. **`daily-split.jsx`** — the `SKIP` selector, so the swipe axis stops
   stealing drags from `svg`, `canvas`, `.h-scroll`, maps and inputs.
   Worth doing **regardless of the three-tab decision** — it is a bug fix
   that happens to arrive in the same patch.
5. **`relmap.jsx` / `relmap-panels.jsx`** — two serif headings become
   sans. The prototype has no serif left anywhere.
6. **`WPAL.ink` coverage** — `person-overlay`, `group-mirror` and
   `group-daily` route their raw `oklch(0.5x …)` through the palette
   gate. The tree still has raw sites in spec `.jsx`; the patches show
   which ones the design considers wrong.
7. **`.rule-dashed` deleted** — two sites in the app.
8. **`passive-meter.jsx`** — the redundant "profile" label goes.
9. **`mirror-field-pops.jsx`** — type chips on field rows (needs §8).

## 8 · Type-mix — one control

The card gains a **system switch**: all four instruments, not just the
default test, persisted to `insight.typemix.sys`. D141 shipped the card;
this is a control, a key and a longer label column (politics type names
run long).

**It does not touch D8.** D8 forbids a test result being a *breakdown
dim* — the thing cohorts are cut by. This switches which result is being
charted for an already-chosen population. Worth saying in the record when
it ships, because the two read similarly at a glance and the distinction
is the whole of D8.

## 9 · Born or built — decide the framing before the code

`nature-data.js` is sixteen lines: per-dimension heritability ballparks
from twin studies, rendered as a section on the result card.

The engineering is trivial and that is exactly the trap. The module's own
header states the rule — *"POPULATION estimates — the share of
person-to-person spread traced to genes — never a slice of one person;
every surface showing them must keep that framing"* — and a bar sitting
directly under **your** result on **your** card is the single hardest
place to keep it. A reader sees "Openness 56%" beside their own openness
score and concludes something about themselves that the number cannot
support.

Three things to settle first, none of them code:

- **Provenance.** These are ballparks with no citation in the file.
  Shipping a genetics figure without a source is not something this repo
  does with any other number — `check:quality` exists because question
  provenance mattered.
- **Wording.** The prototype's caption is good ("How much of the spread
  between people on each trait twin studies trace to genes"). It has to
  survive contact with `check:public-copy` and stay attached to the bars
  in every layout, not just the wide one.
- **Placement.** A separate sheet reached from the ⓘ (`explain-sheet.jsx`
  is already the "what this instrument measures" door) would keep the
  framing and lose almost nothing. Worth weighing against the card
  section the design asks for.

This document's recommendation is **build it, in the explain sheet
first**, and move it onto the card only if the framing holds there.

## 10 · The tweak teardown is a set of decisions

Nineteen of twenty-one flags are gone from `TWEAK_DEFAULTS`. Each deletion
picks a winner, and these are the answers:

`ruler` nav (not pill, not bar) · ruler docks on scroll · `slice` type
marks · `full` palette spread · `underline` lens tabs · quiet ground on ·
feed hierarchy on · mirror lenses not on top · mirror first-run off ·
lenses not boxed · and all ten `wf*` feed cards on (reveal, ripple, pass,
clock, v2, signals, crossfire, counter, why) plus `paid`.

For the app this is mostly dead-branch removal — every one of those
props threads through `daily-split.jsx` and `world-feed.jsx` as a
conditional. Removing them lowers the coupling count, deletes branches
the React Compiler currently has to reason about, and shortens the two
biggest files in the spec layer. Do it as its own commit, after §7, so
the diff is legible as "deletions only".

## 11 · Sequencing

Nothing here blocks on anything outside the tree except three owner
decisions (three tabs, the pulse roster's store forms, Born-or-built's
framing).

1. **§7 the small pass** + **§8 type-mix**. No decisions, no new reads,
   immediate. The `daily-split` drag guard is a bug fix.
2. **§10 the teardown.** Deletions only; lowers the ratchet.
3. **Owner decision: three tabs.** Everything in §2 and §5 aims at it.
4. **§3 pulse roster** — in parallel with (3); it needs the store-forms
   pass, which is calendar time, not engineering time.
5. **§2 Patterns**, as three pieces in order: the server fold (measure it
   in `docs/COSTS.md` first), the lazy-tab loader, then the two lenses.
   The loader is the piece that pays for itself twice.
6. **§5 the Map's parked branches**, once (5) has made a lazy Map cheap.
7. **§4 Foresight tier A**, which by then has both its feed card and its
   map branch waiting for it.
8. **§9 Born or built**, whenever its framing is settled — it is
   independent of all of the above.

## 12 · The open question

**`arena.css` describes a card that is not in the bundle.** A payoff
matrix, a Nash line, a sealed-answer ladder with pegs, a pot, a rival
with a quote, streaks and a manner readout — 103 lines of styling for a
game-theory feed card whose JSX is absent. Verified rather than inferred:
no v28 module emits an `ar-`/`a2-` class, and `--ar-ink`/`--ar-c` are
defined nowhere in the export.

Either it was left out of the export or it was dropped and its styles
outlived it. **Ask before building.** The file is kept at
`design/standalone-v28/arena.css` so the question survives the upload.

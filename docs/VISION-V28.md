# The v28 vision — what changed, and what it costs to build

**Status: plan notes for what to build; the owner's calls are recorded as
decisions.** Same convention as
[`NEXT-FUNCTIONALITY.md`](NEXT-FUNCTIONALITY.md): an item picked up
graduates to a real record in [`DECISIONS.md`](DECISIONS.md), and until
then a *build* verdict here is this document's recommendation, not
approval. **Five items have now graduated** (D166–D168), so the remaining
verdicts are the only ones still awaiting adoption.

The source is the maintainer's `InSight_standalone_28.html`, extracted to
[`design/standalone-v28/`](../design/standalone-v28/) — that directory's
README is the inventory (every module, every patch, how the extraction was
done). This file is the plan.

**The prototype moved on 2026-08-19 and that directory was re-extracted
against it.** The thesis did not move — still three tabs, same roster of
Mirror stops — so nothing below is reopened, and the verdicts in §0 stand.
Three things in this file are now *narrower or wider* than the build they
describe, and §0.1 is the list. Read it before picking an item up; the
inventory in `design/standalone-v28/README.md` is the current state, this
file's section bodies still describe the August-15 build except where §0.1
says otherwise.

## What has been decided

| Record | Item | Answer |
| --- | --- | --- |
| **[D166](DECISIONS.md#d166--the-third-tab-is-adopted-on-trial-the-arena-is-dropped-the-pulse-roster-is-approved) §1** | Three tabs (§1) | **Adopted ON TRIAL.** Build as though it ships, keep the reversal cheap. D166 records what would end the trial. |
| **D166 §2** | The Arena (§12) | **Dropped for now.** The file stays as the record. |
| **D166 §3** | The pulse roster (§3) | **Approved, all five** — sleep and energy included. One build step rides with it (the store-forms Health row). |
| **[D167](DECISIONS.md#d167--every-v28-surface-ships-with-its-backend-or-it-does-not-ship)** | *every* item | **Ships with its backend or not at all.** Done means real data in a live build, never demo-only behind a Preview tag. |
| **[D168](DECISIONS.md#d168--born-or-built-is-refused-the-app-does-not-assert-facts-it-cannot-recompute)** | Born or built (§9) | **Refused** — population science, not this app's data. |

**No owner decisions are left open.** Everything remaining is engineering,
sequenced in §11.

D167 is the one that re-shaped the rest of this document, so each section
now names its **backend half** and §13 is the summary. It is a smaller
change than it sounds: the tree already refuses to fabricate in live mode
(~20 cases in `smoke-live.test.jsx` pin it), so the failure mode D167
targets is the other one — a screen that draws an honest *"not measured
yet"* forever because nothing was ever built behind it.

## What was measured

**Everything below was checked against the tree, not assumed.** Roughly
half of what reads as "new" in v28 is already shipped — the feed's
windowing, the dial/field forms and their breakdowns, the redrawn compare
rose, Near's anonymity and its switch, the deviation view in Explore, the
suggestion board's decline states. Those are struck out in §0 and not
planned again, which is the single most useful thing this document does:
what is actually left is much smaller than the diff suggested.

## 0 · The short version

| Item | Verdict | Backend half (D167) | The constraint that shapes it |
| --- | --- | --- | --- |
| **Three tabs** (`patterns · daily · mirror`) | **Adopted ON TRIAL** (D166 §1) · unmounted for v1 (D217) · **back on a data gate** (D265) | none of its own as a shell — but the GATE has one: the fit publishes its drawable-pool count onto `v2_meta/app` | The tab count is the app's thesis sentence — `CLAUDE.md` opened with "a two-tab app". Cheap to build, expensive to be wrong about, so it ships behind the lazy loader with the reversal kept to one import site. The third tab is now in the bar only when the data can carry it, which is the same sentence one condition further in. |
| **Patterns · Map** (questions placed by mutual prediction) | **Build — but the engine is a backend item** | **the item IS the backend**: a fold publishing per-question loading vectors | The prototype invents 560 people. A real map needs cross-question co-occurrence, which no aggregate publishes today. |
| **Patterns · Oracle** (guess your next answer) | **Build, second** | rides Map's publication — no second fold | Rides the *same* publication as the Map. Two readers, one server fold — that is the whole reason to sequence them together. Distinct from [D163](DECISIONS.md#d163--the-app-learns-what-you-are-into-and-the-model-never-leaves-the-phone)'s interest model: that one orders the tail and never leaves the phone; this one guesses an answer from a published fold and shows its working. |
| **Pulse: one → five, with cadence** | **BUILT (D203)** | done — and it needed no rules or function change at all; `isPulseAnswer` already keyed on the payload's `baseQid` and the trigger on `event.params.qid` | D139's store is single-pulse by deliberate choice ("a roster becomes a parameter the day a second pulse ships"). This is that day. |
| **Pulses take their turn in the feed** | **BUILT (D203)** | none — a client cadence rule | Not via `feed-interleave` in the end: a pulse is not dealt into the stream at a cadence measured in CARDS, it is due or not due on a given DAY. `dueToday()` decides, and the due cards sit beside the daily. |
| **Foresight CALL + its feed cards** | **BUILT (D194), RETIRED (D196)** | shipped: `resolveCallsV2`, then switched off | D127 is unchanged. Tier A works and is not what was wanted: the owner wants predictions about real EVENTS, so the bank is `active: false` and the card is unmounted. What ships in the feed instead is the READ half (D196), gated on having enough fair reads to keep a record worth believing. |
| **Foresight & Crossroads on the Map** | **Build when the eager budget moves** | none — blocked on bytes, not data | Both need `map-tab.jsx` — which is EAGER — to read a new store, and `MAX_EAGER_KB` has no headroom. D136 already parked `paths.mapTree()` for exactly this. |
| **Born or built** (heritability rows on the result card) | **REFUSED** (D168) | n/a — and that is the reason it is refused | Population science, not this app's data. Every other number here is recomputable from what people answered; a heritability figure is the app asserting a fact about the world, which D127 already gates. |
| **What moves together** (cross-test threads on the profile) | **Build** | **none — already real** (folds your own results) | Pure fold over `IS_TEST_RESULTS`; no new reads, no new collection. The cheapest real feature in the file. |
| **Type-mix system switch** (all four instruments) | **BUILT (D202)** — and it needed an owner decision this row did not know about | **none — already real** (test results publish, D98) | D141 shipped the card; this was one control and a persisted key. "Does not touch D8" was true and beside the point: **D157 §4** was the binding constraint, and D202 reversed it. See §8. |
| **The sponsored frame** | **Unchanged: waiting on the paid path** | the paid path itself — now shaped by [D164](DECISIONS.md#d164--the-revenue-paths-re-derived-against-an-unbounded-feed) | `paid-data.js` is byte-identical to v24. D164 (landed on main) re-derived the revenue paths against an unbounded feed: scheduled slots not impressions, billed on answers. The card's disclosure design is unaffected — what changed is what it discloses. |
| **The visual corrections** (nine small ones) | **Build as one pass** | **none — pure visuals** | No decisions in any of them. Best done in a single commit against the patches. |
| **The tweak teardown** (19 flags settled) | **Adopt as the record** | **none — deletions** | The prototype deleting a flag *is* the decision. The app's cost is dead-branch removal, which is what rule 4 and the compiler want anyway. |
| **The Arena** | **Dropped for now** (D166 §2) | n/a | 103 lines of CSS for a card that is not in the bundle. Verified orphaned; the owner confirms it was dropped, not lost. The file stays as the record. |
| ~~Feed windowing, dial/field + breakdowns, compare rose, Near anonymity + switch, Explore deviation, suggestion declines~~ | ~~build~~ **already shipped** | — | Checked file by file; see §6. |

## 0.1 · What the 2026-08-19 build changed about this plan

Re-extracted against the same v18 baseline. Fourteen of the twenty-two
patches were stale and four modules are new; the full delta is
`design/standalone-v28/README.md` § "What the later build changed". Only
these four items change what *this* file tells you to do.

| What | Effect on the plan |
| --- | --- |
| **Roles is a new item with no section here** (`role-data.js`, `roles-panel.jsx`) | The August-15 build had no such module, so nothing below plans it. It reads the duel record as an instrument — four dimensions per setting, matched to a named type, registered into the existing test machinery so a role card *is* a result card — and adds a seventh profile subtab. It needs an owner decision before it can ship, like every other item here; see §14. |
| **The `result-card.jsx` patch is no longer purely the refused section** | §9 and the snapshot README both said the whole patch is Born-or-built and should be dropped whole. That is now wrong: 46 of 69 added lines are the refused section (two hunks), and 23 are an unrelated compact-card `brief` mode. **D168 is unchanged** — but "drop the patch" has to become "drop those two hunks". |
| **Near stops stating distance at all** | §7's small pass recorded coarse distance bands for anonymous kindred. The later build removes them outright — *"knowing how close a stranger is, is itself a leak"* — and reads alignment as size instead. This is strictly tighter than what was planned, runs the same direction as the presence cell's deny in `firestore.rules`, and costs nothing to honour. |
| **`g-fore` is renamed Foresight → "Intuition"** | §4/§5 name the map branch "Foresight". The later build calls it Intuition and notes it as "how well you read groups of people" — which is the READ half, and READ is the half that shipped (D196) after CALL was retired. The rename agrees with where the app landed; take it with the branch. |

**What did not move**, checked file by file rather than assumed: the pulse
roster and its card (§3), the type-mix switch (§8), the trait web (§7.9),
`question-map.js` (§2's engine), `predict-cards.jsx`, `nature-data.js` and
the Crossroads pair are byte-identical to the August-15 extraction. Every
verdict in §0 stands as written.

## 1 · The structural change: two tabs become three

`patterns · daily · mirror`, the daily in the middle so a swipe either way
lands somewhere. The daily's ruler already runs off its far end into the
Mirror (D-era `goNav`); v28 runs it off the near end into Patterns, and
`daily-split.jsx` gains a `SKIP` selector so the axis stops stealing drags
from maps, fields and scrollers.

**This was the one item that is not an engineering call.** The two-tab
shape is the first sentence of `CLAUDE.md` and the frame every Mirror
decision has been written inside — "answering is the smaller half" reads
differently when there are two halves and a third thing. The build is
small (a `TABS` entry, a glyph, an accent, a lazy chunk). Adopting it
means rewriting that opening paragraph and re-reading D99/D100/D112/D136
for anything that leaned on "two".

**ADOPTED ON TRIAL (D166 §1)**, unmounted for the v1 release (D217), and
mounted on a data gate since D265 — the trial is resumed rather than
verdicted, and the near-end exit below is a REQUEST now: `goNav` answers
whether it navigated, and the ruler springs back while the gate is shut.
Build it as though it ships; keep the
reversal cheap. Three things follow, and they are the whole cost of the
trial clause:

1. **The tab loads lazily**, which `MAX_EAGER_KB` already forces (§2) —
   so a reversal is one import site and one `TABS` entry.
2. **Nothing outside the tab depends on there being three.** Cross-links
   go through `window.goNav`; no Mirror stop, daily surface or decision
   record gets written in terms of "the third tab". The daily ruler's
   near-end exit is the one exception and is one branch in
   `daily-split.jsx`.
3. **`CLAUDE.md`'s opening sentence changes when the tab ships**, and says
   the trial out loud rather than claiming three tabs flatly.

D166 also records what would *end* the trial (whether Patterns earns a tab
or is opened once), and the one thing the trial does not license: shipping
the prototype's invented population "just to see". If the real engine is
too expensive for a trial, narrow the trial — one lens, fewer questions —
never the honesty rule.

The reason it gets its own tab rather than a Mirror stop is unchanged: the
Mirror's stops are a graduated axis from *you* to *the world*, and
Patterns is not a point on that axis.

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

**Which corpus the fold reads is settled by
[D161](DECISIONS.md#d161--the-feed-goes-unbounded-and-the-mirror-gets-a-corpus-of-its-own),
and the answer is CORE ONLY.** This landed on main while the plan was
being written and it decides a question §2 had not thought to ask. D161's
sample-bias argument transfers to the letter: the tail is
interest-ordered, so who answers a tail question is interest-selected, and
a correlation folded over tail answers would report the *selection* rather
than the population. "People who pick this also pick that" is exactly the
claim that breaks under it — arithmetically correct, and about the wrong
crowd. So the loading vectors fold over the core corpus, the same one the
Mirror's cohort readings fold over, and for the same reason.

Two consequences worth stating rather than discovering later:

- **The map is bounded even though the bank is not.** That is a feature —
  `question-map.js`'s architecture was chosen to stay honest at a million
  questions, and core keeps the drawn map legible besides.
- **A tail question has no place on the map**, so the Map lens needs an
  answer for "I answered that one, where is it?" — the honest line is
  that it is not part of the shared corpus, the same sentence the Mirror
  already owes a tail answer.

**Under D167 this is a gate, not a preference: Patterns does not ship —
in trial or otherwise — until the fold exists.** The 560 people are not a
placeholder inside the feature, they *are* the feature; remove them and
there is no map and no oracle left to trial. If the fold proves too
expensive to justify up front, narrow the trial (one lens, fewer
questions, a coarser K), never ship the invented population. See §13.

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

## 3 · Pulse: one question becomes five, each with a rhythm — **BUILT (D203)**

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

**BUILT at [D203](DECISIONS.md#d200--five-pulses-each-with-its-own-rhythm).**
Three things this section did not anticipate, all recorded there: the
roster made the reads *cheaper* rather than five times dearer (the card
needs today, not the window — a naive ×5 would have been 105 ids over a
30-clause cap); it surfaced two shipped defects the roster would have
multiplied by five (a template read `hydrate()` had already paid for, and
an `active` flag that never reached the client, so a killed pulse still
drew a tappable card); and `worldAnswers` did **not** move, because the
default cadences ask ~1.29 answers a day against the 1 the model already
assumes — the ceiling is recorded next to the assumption instead.

**APPROVED — all five, sleep and energy included (D166 §3).** The question
raised here was that `NEXT-FUNCTIONALITY.md` §"Mood as the first pulse
question" flagged mood tracking as moving the store's Health disclosure,
and sleep and energy sit further into that territory than mood does. The
owner has weighed it and said ship. That settles it.

**One build step rides with the roster, and it is a fact rather than a
preference:** `docs/STORE-FORMS.md`'s Health row answers **No** today, on a
bullet that carries an explicit trip-wire written for D140's height band —
*"Whoever picks that decision back up owns this row"*. A daily
self-reported *"How did you sleep?"* series is closer to Apple's "any other
user provided health or medical data" than a demographic band is, so the
roster's own commit re-answers that row. Two more follow-throughs come
free from existing gates: `content/pulse-questions.json` gains four
templates (`check:content`/`check:quality`), and `docs/data-inventory.md`
names the per-day collection (`check:data-inventory`, D130).

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

The buildable slice, unchanged from NEXT-FUNCTIONALITY §"Predictions" —
and **shipped at [D194](DECISIONS.md#d194--predictions-ship-and-the-app-only-asserts-what-it-can-recompute)**:

- **Tier A calls** — self-resolving on our own published aggregates.
  Graded by arithmetic, no operator, no external source. `predict-cards.jsx`
  was the card; the live one is `ui/LiveCallCard.tsx`, pinned at the feed
  head, and it publishes the working: the counts the grade was made from,
  and whether the device re-running the same test on them agrees.
- **Tier B** waits on an executable rubric and VOID as a first-class
  outcome. v28 gives it no new argument, and D194 gives it no code —
  `rubricFault` refuses `kind: "fetch"` by name.
- **The clock is not ported.** Ten seconds is the game's pressure; it needs
  `predict-cards.jsx`'s IntersectionObserver arming, and it is a mechanic
  rather than data.

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

**Measured against the tree 2026-08-19, and it is half-shipped.** The
verdicts below stand; what changed is that four of the nine are done or
partly done, and the plan did not say so. This is §6's job arriving late —
so the state is recorded here per item rather than left for the next
person to re-derive by patch-reading. **Two were already better in the
tree than in the patch**, which is the more useful half of the finding: a
patch is a proposal, and porting one blind would have regressed both.

| # | State | What is actually there |
| --- | --- | --- |
| 1 group-daily sealed avatars | **open** | still `opacity: dim ? 0.28 : 1` (`group-daily.jsx:71`) |
| 2 duo-daily redaction bars | **open** | still one solid block (`duo-daily.jsx:250`), carrying its own note that the block replaced a blur |
| 3 person-mindmap `MTSwipeRow` + serif title | **open** | zero `MTSwipeRow` uses there against five in `map-bottom-card.jsx`; `mmt-title-serif` still on the node title |
| 4 `daily-split` drag guard | **DONE, and not from this patch** | the tree shares `OWNS_X` with `swipe-back.js` on both the touch and wheel paths. It deliberately does **not** skip `svg`, and says why: the cards draw roses and day dots in svg, and the axis swipe has to keep working across them. The patch's `SKIP` includes `svg, canvas`, so porting it would have killed the swipe on every card |
| 5 relmap serif headings | **DONE** | both `SANS` and `SERIF` in `relmap.jsx` are already `'Hanken Grotesk', sans-serif`; the `SERIF` name is vestigial |
| 6 `WPAL.ink` coverage | **two-thirds done** | `group-mirror.jsx:35` and `group-daily.jsx:48,70` route through it; `person-overlay.jsx:122–125,174` still hold raw `oklch(0.5x …)` |
| 7 `.rule-dashed` deleted | **DONE 2026-08-19** | and it was **one** live site, not two. The class was a byte-for-byte duplicate of `.rule` — same height, background, border and margin, nothing dashed about it — so switching the one `<hr>` and deleting the rule is a provable no-op, which is why it shipped while the rest of this list did not |
| 8 passive-meter "profile" label | **open** | `passive-meter.jsx:115` |
| 9 mirror-field-pops type chips | **open** | no chips on field rows, and note the item has **no hunk** in `mirror-field-pops.jsx.patch` — its source is the new build, not the patch set |

**The seven still open are visual judgement, and that is why they are
still open.** Each changes what a person sees, none has a test that
asserts what it should look like, and the tree cannot render the
prototype to compare against — `scripts/style-diff.mjs` is the tool for
that and it needs Playwright and a running app (D189). Shipping them from
a patch file without seeing either result is the blind change this repo's
house style refuses; do them at a screen, in one commit, against the
patches.

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

## 8 · Type-mix — one control — **BUILT (D202)**

The card gained a **system switch**: all four instruments, not just the
default test, persisted to `insight.typeMixSys.v1` (the plan's
`insight.typemix.sys` was off the tree's `insight.<camelCase>.vN`
convention on two counts). D141 shipped the card; this was a control, a
key and a longer label column — 142px for politics and values, whose type
names run to 24 characters against the Big Five's 17.

**This section had the constraint wrong, and the error is worth keeping.**

> ~~**It does not touch D8.** D8 forbids a test result being a *breakdown
> dim* — the thing cohorts are cut by. This switches which result is being
> charted for an already-chosen population.~~

Every word of that is true. It is also beside the point: **D8 was never
what stood in the way.** [D157 §4](DECISIONS.md#d157--the-test-surfaces-stop-describing-a-crowd-they-never-counted)
was — it refused this exact reading for these exact instruments, named
`TypeMixCard`'s own number as the thing it was refusing, and noted the
widening was "one parameter" away before declining it anyway. Clearing D8
and shipping would have been clearing a constraint nobody was blocked on.

The owner reversed D157 §4 ([D202](DECISIONS.md#d199--the-type-mix-reads-every-instrument-and-d157-4-is-reversed)),
which is a decision this file could recommend but not take. What shipped
with it, none of which was in this section's plan:

- `web/privacy.html` gains a bullet **describing** the new reading rather
  than losing the old denial, and `check:policy-claims` pins two rows —
  the new claim and the surviving one.
- **The promise that survived got an owner.** Answers still group by the
  Big Five alone; that was enforced by `typeMix.TYPE_TEST`, the constant
  D202 demotes to a default, so the scope moved to
  `data/typeSplit.SPLIT_TEST` — explicit at every call site, with its own
  cases.
- **It could not be a port.** The prototype derives its non-Big-Five mixes
  from authored shares with a per-population wobble; D167 forbids it, so
  the live fold measures, and the thin/small states are recomputed per
  instrument because coverage differs by instrument.

## 9 · Born or built — REFUSED (D168)

`nature-data.js` is sixteen lines: per-dimension heritability ballparks
from twin studies, rendered as a section on the result card. **It is not
built.**

This section previously recommended shipping it in the explain sheet
first, treating the problem as one of framing — the right caption, the
right placement, the population reading kept attached to the bars. The
owner's objection is upstream of all of that and better:
**it is population science, not this app's data.**

**Why that is the strong objection.** Every number this app draws is
recomputable from what people answered — aggregates fold from answers,
cohorts from `agg.by`, similarity from published results, and where the
fold cannot be done the reading returns null rather than something
plausible (D72). A heritability figure has no such path. It is the app
asserting a fact about the world, sourced from literature it has not read,
cannot check and cannot update. D127 named exactly this class when it
refused Foresight CALL without an executable rubric — *"the one number in
the app the reader cannot recompute"* — and admitted such numbers only
behind a rubric that can be dry-run before shipping. There is no
equivalent for h²: no rubric, no resolution, no way for the app to be
shown wrong.

So the same standard that gates a prediction refuses this outright, **and
it refuses it in the explain sheet too.** Placement was never the problem,
which retires this section's old compromise rather than deferring it.

The second objection stands on its own: a population figure under *your*
result is read as a claim about you. `nature-data.js`'s own header says
every surface showing it must keep the population framing — and the result
card is the worst place in the app to try.

**Clean removal, verified — but no longer a clean *file*.** `window.NATURE`
is still consumed by `result-card.jsx` and nothing else, so dropping the
section leaves no orphaned store. What changed on 2026-08-19 is the patch
around it: it was +37/−0 and entirely this section, which made *"drop the
whole patch"* both true and safe. It is now +69/−19 across eight hunks, and
only two of them are Born-or-built — `@@ -157,10 +157,38 @@` (`NatureRows`,
+29) and `@@ -264,6 +297,23 @@` (the section render, +17). The other six are
a compact `brief` result-card mode that nothing has refused.

**So the instruction narrows: drop those two hunks, not the file.** Applying
the patch whole ships a refused surface; skipping it whole silently drops an
unrelated design change. Neither is what D168 decided.

Both files stay in `design/standalone-v28/`, marked refused, so the idea is
not re-proposed as new.

**What this does not refuse:** the four instruments' own results (computed
here from your answers), or authored content generally — question banks,
archetypes, scenes and Learn cards are the app's *prompts*, not its
*findings*. And a future sourced, linked, clearly-external reading is not
foreclosed; it would need D127's equivalent — a citation the app holds, a
way to be shown wrong, and a home that is not under the reader's own score
— which is a new decision, not this one relaxed.

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

**Measured 2026-08-19, and that paragraph is wrong in every clause it
makes about cost.** `world-feed.jsx` references **none** of these keys.
Every flag lives in `app-shell.jsx` alone, except three that reach exactly
one other file each — `markStyle` → `type-marks.jsx`, `lensBoxed` →
`profile-overlay.jsx`, `feedHier` → `daily-split.jsx`. They are locals and
props, not shared globals, so rule 4 does not count them and removing them
lowers the coupling number by **zero**. (Measuring that claim is what
turned up [D210](DECISIONS.md#d210--rule-5-could-not-fire-and-123-dead-publications-were-behind-it),
which is the one real thing in this section's vicinity.)

**And the outcome is already shipped.** Every winner listed above is
already the tree's default: `navMode: "ruler"`, `dockRuler: true`,
`markStyle: "slice"`, `wpal: "full"`, `lensStyle: "underline"`,
`quietGround: true`, `feedHier: true`, `mirrorLensTop: false`,
`lensBoxed: false`. `mirrorFirstRun` is **gone** already — `app-shell.jsx`
drives the sparse Mirror off the real signal (`FEEDREAD.stats().n < 8`)
instead, with a note saying the tweak that used to do it is retired. And
the ten `wf*` feed flags never existed here: `TWEAK_DEFAULTS` says so in
its own comment, and the `wf*` names in `world-feed.jsx` are helper
functions, not flags. So the app already **behaves** as this section asks.

**What is actually left is a decision, not engineering, and it goes the
other way from the rest of this file.** The remaining alternatives —
`'pill'`/`'bar'` navs, `'ring'`/`'dots'` marks, `'family'`/`'one'`
palettes — are three `TweakRadio` rows and three branches in
`app-shell.jsx`, and the tree keeps them **on purpose**: *"the alternatives
exist so the three navs and the two palettes can still be judged against
each other, which is what the standalone keeps them for."* §10's verdict
("adopt as the record") would delete the owner's comparison, and unlike
every other item here it is not one of the five that graduated at D166–D168
— so it is a verdict still awaiting adoption, buying no ratchet movement
and costing a tool. **Do not do it as a cleanup.** If the owner is done
comparing navs, that is one sentence and then it is three minutes' work.

## 11 · Sequencing

**No owner decisions are left.** D166 cleared two of the three and D168
refused the last one (§9), so everything below is engineering.

1. **§7 the small pass** + **§8 type-mix**. No decisions, no new reads,
   immediate. The `daily-split` drag guard is a bug fix.
2. **§10 the teardown.** Deletions only; lowers the ratchet.
3. **§3 pulse roster** — unblocked. Ships with its store-forms re-answer
   in the same commit (D166 §3), which is calendar time, not engineering
   time, so start it early and let it run alongside the next item.
4. **§2 Patterns**, as three pieces in **this order and no other**: the
   server fold (measure it into `docs/COSTS.md` first), the lazy-tab
   loader, then the two lenses. The fold comes first because D167 makes it
   a gate — there is no interim build that ships the lenses on invented
   people. The loader is the piece that pays for itself twice, and under
   the trial clause it is also what keeps the reversal cheap.
5. **`CLAUDE.md`'s opening sentence**, in the same commit the tab first
   appears — three tabs, on trial, pointing at D166. Not a follow-up.
6. **§5 the Map's parked branches**, once (4) has made a lazy Map cheap.
7. **§4 Foresight tier A**, which by then has both its feed card and its
   map branch waiting for it.

§9 Born-or-built used to sit at the end of this list. It is refused
(D168), not deferred, so there is no eighth step waiting.

## 12 · The Arena — asked and answered: dropped

**`arena.css` describes a card that is not in the bundle.** A payoff
matrix, a Nash line, a sealed-answer ladder with pegs, a pot, a rival
with a quote, streaks and a manner readout — 103 lines of styling for a
game-theory feed card whose JSX is absent. Verified rather than inferred:
no v28 module emits an `ar-`/`a2-` class, and `--ar-ink`/`--ar-c` are
defined nowhere in the export.

**Dropped for now (D166 §2)** — the card was dropped, not lost in the
export. Nothing to build, nothing to unwind: no app code ever referenced
it.

The file stays at `design/standalone-v28/arena.css`. Deleting it is the
cheaper-looking move and the wrong one — the standalone is an ephemeral
upload, so that file is the only surviving description of the idea, and
"dropped for now" is not "refused". Reviving it needs a design pass that
says what the game is; a stylesheet cannot, which is why it was never
portable from what is here.

## 13 · The backend half, item by item (D167)

[D167](DECISIONS.md#d167--every-v28-surface-ships-with-its-backend-or-it-does-not-ship):
*an item is done when its UI renders real data in a live build, not when
its UI renders.* Nothing here ships demo-only behind a Preview tag.

**Read the rule against what the tree already does, or it sounds like a
correction it is not.** Live mode does not fabricate today and has not for
some time — `smoke-live.test.jsx` holds ~20 cases whose whole job is that
the demo cast never reaches a live build, D72 made `MapStats` return null
rather than a plausible mock, and every one of the Mirror's six non-`you`
stops has a live body. The failure mode D167 targets is the *other* one:
a screen that draws an honest "not measured yet" forever because the
backend behind it was never built. Refusal is the right fallback and the
wrong plan.

### Nothing to build — real on arrival

Three items need no backend at all, which is worth knowing because it
makes them the cheapest real wins in the file. (A fourth, Born-or-built,
was on this list until D168 — and the reason it needed no backend is the
reason it is now refused: nothing in the app produces that number. See
§9.)

| Item | Why it is already real |
| --- | --- |
| **Trait web** (§7.9, `trait-links.js`) | Folds the viewer's OWN test results, which the device already holds. No read, no collection, no fold. |
| **Type-mix system switch** (§8) | Test results publish under D98 and `data/similarity.ts` already reads them. This adds a control, not a source. |
| **The §7 visual pass and §10 teardown** | Pixels and deletions. |

### Backend exists, needs extending

- **Pulse roster (§3).** D139 built the live path: per-day aggregate docs
  from the untouched trigger, one bounded session-cached query per open.
  The roster makes `PULSE_QID` a parameter and multiplies that by five,
  plus a cadence store (which days a pulse is due) and the "not scheduled"
  absence case. **The cost line moves and belongs in `docs/COSTS.md`
  before the roster ships** — five pulses is five times the per-day docs,
  and the existing note was written for one.
- ~~**Foresight tier A (§4).**~~ **DONE (D194).** `resolveCallsV2` is the
  fourth scheduled function, in the pattern the three named here set. What
  the plan did not anticipate is the second half of the honesty story: the
  grade's INPUTS publish with it and the card re-runs them, so a resolved
  call keeps the property every other number in the app has.

### The backend IS the item

**Patterns (§2) is not a UI port with a data dependency — the fold is the
feature.** The prototype's 560 invented people are the entire engine; take
them away and there is no map and no oracle. So:

> **Patterns does not ship, in trial or otherwise, until the fold exists.**

D166 §1 already refused a trial of a fabricated screen; D167 makes it
general. If the fold proves too expensive to justify for a trial, the move
is to **narrow the trial** — one lens, fewer questions, a coarser K —
never to ship the invented population "just to see". A trial of a
fabricated screen answers no question worth asking, and it would be the
first time this app shipped one.

The fold's shape is in §2 and unchanged: per-question loading vectors
published by the same trigger that already folds every answer, cosine on
the device, exact 2×2 tables fetched only for the pair on screen. Measure
it into `docs/COSTS.md` first — that trigger is the app's hottest write
path.

### Blocked on bytes, not on data

The Map's Foresight and Crossroads branches (§5) have real stores waiting
for them; what they lack is room in the eager graph. D167 does not touch
them — they are not sample-data items.

### Every item gets a `smoke-live` case

In the shape the existing twenty use: mount live, assert the real thing
renders and the demo cast does not. This is the part that makes D167 more
than a promise — D155 is the standing reminder that a rule nothing
executes is a rule that quietly does not hold. The existing cases are the
template, down to asserting on the `ErrorBoundary` rather than on a thrown
error.

### Two pre-existing refusals this does NOT cover

Named so the rule is not read as sweeping them in:

- **`MapStats`' five null anchors.** `job` is profession and the four test
  anchors are results — never breakdown dims (D8). That is a decision, not
  a backlog item; changing it means changing D8.
- **The suggestion board's community half**, still *"Preview · sample
  suggestions"*. A real backlog item, but it belongs to the suggestions
  work (D138), not to v28.

## 14 · Roles — the item this plan never had a section for

**BUILT ([D204](DECISIONS.md#d201--your-role-is-a-test-result-and-the-dimension-without-data-is-not-shipped).)**

`role-data.js` and `roles-panel.jsx` are new to the 2026-08-19 prototype.
The August-15 build had no such module, which is why every other section
here predates them and why §0.1 flags Roles as the one item with no plan
entry.

**What it is.** Your role in a 1v1 and your role in a group, each read as
an instrument and matched to a named type the way every other test is — so
a role card is a result card, with the same rose, the same matcher and the
same nearby-type language. A seventh profile subtab.

**Why it was cheap.** Pure fold over `LIVE.social.revealHistory`, the same
reveal documents `duelRuns` (D156) and `groupPortrait` already read and the
duel panel already fetches. No new read, no field, no collection, no
function — the same "real on arrival" class as the trait web in §13, and it
would have belonged in that table had it existed on August 15.

**Why it is not the prototype's instrument.** The prototype's group
reading has a fourth dimension, `cast`, whose only source is a demo-only
scenario generator. Shipping it would have meant a constant equal to its
own baseline: no contribution to any match, an identical petal on every
rose, and a dead axis presented as a measurement — which is what §13's own
D167 paragraph forbids. It is not computed, and the three group types that
`cast` alone made distinct went with it. D204 has the arithmetic, including
what a real `cast` would need (pick questions can ground it; the reveal doc
does not store the option→uid mapping they would need to be read safely).

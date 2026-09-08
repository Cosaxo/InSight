# The 2026-09-08 standalone — rounds reach the prototype, the person's page becomes four tabs, and the paid family leaves

The owner's `InSight_11.html` upload of 2026-09-08 (a `__bundler`
standalone of **11 assets**, in the "fast boot v2" shape InSight_7
introduced), the eleventh in the numbered series, one day after
`InSight_10` (→ `standalone-2026-09-07/`) and the same day as the
`1v1_and_Group_Cards.html` canvas (→ `rounds-card-2026-09-08/`). The
upload is ephemeral; this directory is the durable record, per the
family's standing rule (`design/README.md`). The plan built on it —
every item measured against the tree, with its backend half named — is
[`docs/VISION-2026-09-08.md`](../../docs/VISION-2026-09-08.md).

`design/InSight_standalone_18.html` **stays the committed reference**
until a full sync moves it (`design/README.md`'s rule). This directory,
like its siblings, does not re-point it. `docs/VISUAL-VISION.md` names
this directory as the current vision (D361's standing rule: the owner's
upload moves the vision).

## How this was extracted, and what the upload actually holds

The same bundle shape as `InSight_7` through `InSight_10` — an empty
`ext_resources` map but for the bundle, React 18.3.1 and ReactDOM as two
vendor files, and **one `bundle.js`** holding every module in load order
(`window.__INSIGHT_BUNDLE__ = { order, hashes, files }`, no `built`
stamp this time) — with one difference that changes how the record is
read: **the bundle is 1.3 MB, not 2 MB, because every module in it is
minified.** The 50 `.js` modules and the 60 `.jsx` components are all
one line each: whitespace stripped, comments gone, strings re-escaped
to ASCII in double quotes (`\xB7` for `·`), numbers as written
(`0.2`, `184000`). That is Babel's own `minified` output, not
terser's or esbuild's (both were tried: terser shortens `0.2` to `.2`
and `184000` to `184e3`, esbuild wraps IIFEs differently), so the
recipe that makes the diff exact is the 09-02 README's compile with
two options more:

```
npm i --no-save @babel/core@7 @babel/preset-react@7      # in a scratch dir
node -e "const b=require('@babel/core');process.stdout.write(b.transformSync(
  require('fs').readFileSync(process.argv[1],'utf8'),
  {presets:[['@babel/preset-react',{runtime:'classic'}]],babelrc:false,configFile:false,
   minified:true,comments:false}).code)" recorded/oracle.jsx
```

Applied to the recorded state of a module — the compiled record where
the record is compiled, the JSX source compiled first where it is
source — this reproduces the upload's bytes **exactly**: 89 of the 110
modules come out byte-identical, which is the same proof the 09-02
README gave for its recipe. A byte difference after minifying is a
design change and nothing else.

**What the minification costs the record.** Every earlier standalone
carried the design's reasoning as comments (*"a stretched amber thread
is a rule you break"*, the header of every module); this upload carries
none, so a moved module's WHY is not in it. The files here are readable
because they are **regenerated**: Babel run over the upload's module
with `compact: false, comments: false` prints the same AST as source
again, and running the recipe above over that printout gives the
upload's bytes back (checked for all four whole files below). The
patches under `changes/` are diffs of the same regeneration on both
sides — the recorded state minified and reprinted, against the upload's
module reprinted — so their left side is the record's CODE without its
comments, and their line numbers are the reprint's, not any committed
file's. Read the earlier directories for the comments; read these for
what moved.

Every module was diffed against the **latest recorded state of the
same module**: v18 (`design/InSight_standalone_18.html`) +
`standalone-v28/changes/`, the v24 / v25 / v28 / 08-20 / 08-22 / 08-24 /
08-26 / 09-02 / 09-06 / 09-07 whole files where those supersede, the
08-26, 09-02, 09-06 and 09-07 `changes/` patches on top, the 08-24
README's nine verbatim hunks and the 08-26 README's one-liner. Every
recorded patch applied cleanly. Against that baseline **89 of 110
modules are byte-identical**. What follows is the other **21 that
moved** — four carried whole, seventeen as patches — and the **seven
that are gone**.

**Seven modules are deleted**, and the boot script's `JS` and `JSX`
arrays no longer name them: `reveal-clock.js` (the countdown to
midnight — nothing under rounds counts to midnight), `nature-data.js`
(the *Born or built* data the 09-06 README recorded as staying
"even as the card stops drawing it"; it stops being in the bundle at
all), and the whole paid family — `suggestions.js`, `suggestions.jsx`
(the suggestion board that became the paid door), `asked-by-you.jsx`
(the buyer's room), `catalog-sheet.jsx` (the shop window) and
`paid-report.jsx` (the report). `paid-data.js` stays, and the startup
module check still waits on `WF_PAID`: the feed's sponsored cards still
draw from it.

**The stylesheets are one block now.** The template carries ONE
`<style>` element of 124 KB where 09-07's carried ten: the two
`@font-face` blocks, then `tokens`, `map`, `patterns`, `oracle`, `page`
and `lens` in that order, with **`dots.css` folded into `lens.css`** and
**`arena.css` gone** — the six `.ar-*` rules `paths-card.jsx` uses
(`.ar-head` `.ar-kick` `.ar-name` `.ar-rule` `.ar-chip` `.ar-next`) and
the `.pp-*` crossroads rules moved to the tail of the oracle sheet, and
the twenty-odd ARENA-card rules nothing drew are deleted. Split at the
sheets' own first lines and compared to the record: `map.css` is
byte-identical; `page.css` is the recorded block plus the three
boot-splash lines the 09-02 README carries in prose; `tokens`,
`patterns`, `oracle` and `lens` moved, and each has a patch below.

The other eight assets: **two `woff2` faces labelled `image/png`** —
now the two Hanken Grotesk *variable* files, one per Latin subset,
carrying every weight 400–800 (the block's own comment: *"Italic files
are gone: .app em is roman throughout"*) where 09-07 shipped eight
static faces — and **six `woff2` faces labelled `font/woff2`**, Spectral
400 / 500 / 600 in two Latin subsets each where 09-07 shipped fifteen
across five. The "trust the bytes, not the mime" rule holds a sixth
time. No images in the upload.

## What the design does, in one paragraph

Five moves, and the largest of them is the tree's own model coming
back to it. (1) **Rounds reach the prototype.** The demo engine and
both daily bodies take the card the owner drew the same morning for
request 12 (`rounds-card-2026-09-08/`): a five-round lead, deadlines
that start on a round's first answer, the late answer said plainly,
World questions on every even round with the partner's public answer as
the no-guess signal, the nine states, the SAID · CALLED table, the
three-column World reveal, the sealed list, the *answer ahead* door and
the run of rounds at the foot; the reveal clock is deleted, the first
run loses its *Tonight* beat and its *Start another* row, *days* become
*rounds* wherever a figure says one, and twelve duel prompts lose their
calendar words. (2) **The ruler says Groups · 1v1s** where it said
Circle · 1v1, in the shell and the daily both, and the first run says
*group* — the Mirror's Circle stop keeps its name. (3) **The paid
family leaves the prototype**: the four modules above, the feed's and
the daily's *Suggest a question* doors, the header's ask button, the
overlays, the Mirror place stops' *Asked for Oslo* section, the
scorecard's *Author a metric*, the profile's *You asked* shelf, and the
`.sg-*` motion. (4) **The person's page becomes four tabs** — Match ·
Answers · Together · Map — with a horizontal swipe between them
(`useSubSwipe`, wired into the profile overlay's sub-tabs too), a
smaller hero carrying the receipts' lead sentence under the name; Match
as an accordion of the instruments sorted by alignment (`CompareList`),
Answers as a seven-wide grid of topic-hued dots (filled = same answer,
ring = you differ) with the tapped question read in a card, Together
as tiles carrying a figure and the pair's type with an ⓘ for the type's
line, the read-each-other rings and clustered domain runs, and Map as
the person's own map, taller, with a *friends see everything* line.
(5) **A polish-and-optimise pass**: 44 px hit slack on every small
round control by pseudo-element, a 12 px floor on avatar initials, one
reduced-motion switch for everything under `#root`, `Lazy`'s per-card
timers collapsed into one, the feed's head-hide moved off React state
onto the element, and a sweep — some two hundred dead CSS lines and
seven modules gone, plus a dozen D182 copy cuts.

## The files here, and where each would land

Carried whole (regenerated as described above; the upload's bytes come
back from the recipe):

| File | What it is | Where it lands |
| --- | --- | --- |
| `duels-data.js` | **The demo engine under rounds.** `LEAD = 5`, `DEADLINE = 48h`, a per-room `epoch`; `S.duo[pid][r]` / `S.groups[gid][r]` keyed by round with `duoTheirs` / `groupIn` (who has played which round) and `duoDue` / `groupDue` (the partner's simulated lag, on the same timer the invitations use); `worldPool()` off `DAILYQ.questions` with a four-question fallback, `worldQ`, `isWorldRound = r % 2 === 0`, `publicAnswer` (the no-guess signal); `groupDeadline` (a closed seeded room, `The Cousins`, has a deadline already past), `memberIn`, `groupOpen` (null at the lead), `groupRevealedCount`, `myGroupRound` (`a`, `g`, `late`), `answerGroup(gid, i, r)` flagging late, `callGroup`, `needsCall`, `groupPicksRound` (`played`, `absent`, `closed`, `revealed`, `myCall`, `callRight`), **`groupView`** and **`duoView`** (one object per card: `revealed`, `open`, `myTop`, `theirTop`, `waiting`, `ahead`, `callDue`, `lead`, `lastRevealed`, `sealed`); `duoRound` (`noGuess`, `mineIn`, `theirsIn`); `partners()` counting the read only over guessed rounds; `resetRounds`; `fmtLeft` (`1d 16h`); `first`. Twelve prompts reworded without a calendar word (*A free afternoon* for *A free Saturday*, *for a while* for *for a week*, *a stretch* for *a week / a weekend*, *at once* for *that night*, *first* for *by day three*); the `insight.duels.v2` key | `spec/duels-data.js` — the DEMO twin of `data/duelRuns.ts` + the group document; the tree's engine still keys by `DAYS`; plan §1.2 |
| `group-daily.jsx` | **The demo Circle body as the rounds card.** New primitives, published for the 1v1 body: `OpenSeat`, `SealMark`, `RunDot` / `RoundRun` (six kinds — `1 · 0 · n · s · o · l` — with the run's tooltips, a `right/scored` figure and a scroller past 14), `RoundKicker` (*Round 9 · World · revealed · closed at the deadline*, the time on the right), `Prompt` / `SmallPrompt`, `OptBtn`, `WorldCols` (you · the room · World, the World's share as a bar), `SealedList`, `AheadBtn` (*Round 8 is open — answer ahead ›*), `Band`, `Rule`. `GDReveal` takes `picks` and counts a late answer in the bar and out of the tally; `GroupRevealBlock` (the kicker, the prompt, the split or the World columns, who played with open seats, *The room landed on X · ✓ you called it*, the late sentence); `GroupCard` reads `D.groupView`, ticks every 30 s for the deadline, and draws the band, the last reveal, then `callBlock` / `waitBlock` / `sealedBlock` + `AheadBtn` / `askBlock` (a closed open round says *Answering now shows as late and scores nothing*) / *Nothing waiting on you here*, then the run. The rail's labels say *your turn* / *played*; every control carries `minHeight: 44`; marks grow to 26–30 with a 12 px initial floor; `FirstDayCompact` and the day dots are gone; the add sheet says *a question a round, revealed with names* | `spec/group-daily.jsx` — the demo body `daily-split.jsx` lazy-mounts when `LIVE` is off; its live twin `ui/LiveDuelPanel.tsx` already draws this card from the canvas (D426's second amendment); plan §1.1 |
| `duo-daily.jsx` | **The demo 1v1 body as the rounds card**, on the primitives above: `DuoRevealBlock` (the SAID · CALLED table with ✓ in the good colour, or the World columns with *X answered this in the World feed, so there was no guess*), `DuoCard` reading `D.duoView` — the band, the last reveal, `guessBlock` / `waitBlock` (*waiting on Ada*) / `sealedBlock` + `AheadBtn` / `askBlock` (with the no-guess sentence), then TWO runs (*you* in the good colour, *Ada* in the tint) — *Invite sent — your first round opens when they accept*; the rail says *waiting on Ada*; the `-day run` figure, the *Swipe down — X is waiting* line, the `RevealClock` and `FirstDayCompact` are gone | `spec/duo-daily.jsx` — the demo body; the live twin is the same `LiveDuelPanel`; plan §1.1 |
| `person-overlay.jsx` | **The person's page as four tabs.** `receiptRows(p)` (the fold the 09-07 `ReceiptsCard` did, now also carrying each row's topic `hue` and `cat` off `DAILYQ.categoryPath` / `catMeta`), `receiptLead(rows)`; `AnswersPanel` — a `role="listbox"` grid of 26 px dots seven across, sorted by hue then split-first, each an `option` with the prompt in its label, the tapped one read in a card (the kicker is the topic, the prompt in the serif, *both X* / *you X · Ada Y*); `TABS` (Match always; Answers at four rows; Together when a 1v1, a friendship or a shared group exists; Map always), `useSubSwipe` over them; `renderMatch` → `CompareList`; `renderTogether` — `cluster` (overlapping marks, `+N`), `fig` (a 26 px figure over a unit), `wide` tiles (the 1v1: *N rounds* · *1v1 · The Twin*; *1v1 · new · the first round is open*; *invited · waiting on Ada*; *Start a 1v1 · answer, then guess theirs — revealed when you both have played*; *for friends — add Ada first*), group tiles in a two-column grid (*N people*, the name, the type), *Add Ada to a group* chips with mark clusters, *No groups together yet*, an ⓘ (`.pt-info`) that shows each type's line, and the record — the lead sentence, two `MatchRing`s (*you read Ada* / *Ada reads you*), the domain runs clustered to 14, a *called it / missed* key; `renderMap` — *Ada's map*, 320 tall, `own: true`, *some of it stays private until you are friends*; the hero shrinks (116 ring, 86 avatar, 24 name) and carries `receiptLead` under the role line; the full-screen map's key says *with the crowd / a rarer take* and *friends see everything*. The 09-07 doors and the two-column table are superseded | `spec/person-overlay.jsx` (602 lines today: the D310 doors, `CompareCarousel`, no receipts, no sub-tabs — and reachable only from the demo surfaces); plan §4 |

## The patches in `changes/`, and what each carries

Their left side is the **normalised recorded state** (minified, then
reprinted without comments), not any committed file; `recorded/` and
`2026-09-08/` in the headers say which side is which. Each was checked
by applying it to that left side and comparing to the upload's module
reprinted the same way.

| Patch | What it carries |
| --- | --- |
| `shared-primitives.jsx.patch` | **`useSubSwipe(bodyRef, panelRef, ids, cur, set)`** — a horizontal drag or wheel on an overlay's body steps its sub-tab (a 66 px throw, 0.7 follow, a 34 px slide-out, spring-back below the throw; `svg, canvas, .h-scroll, .subnav, .mmt-swipe, .cb-rail, [data-nopan]` and fields keep their own drags); and **`lazyWatch`** — every `Lazy` card's 400 ms fallback timer becomes one shared interval, its scroll check runs under `requestAnimationFrame`, and a `dead` flag stops a late tick after cleanup |
| `compare-breakdown.jsx.patch` | `cbSlides` lifted out of `CompareCarousel`, and **`CompareList`** beside it: the instruments as an accordion sorted by alignment, one open at a time, each row *title · sub · the alignment figure · `CBAlignGlyph` · a chevron*, the you / them key under the list |
| `first-day.jsx.patch` | The first run under rounds: the kicker to 12 px, the seal labelled *sealed until the reveal*, the *Today · sealed* / *Tonight* (reveal clock) / *Tomorrow · revealed* beats become **Sealed** and **Revealed · when Ada plays** (or *when everyone has played, or at the deadline*), the stand-in line loses *each day*, *Your guess at Ada's answer* names the person, *circle* becomes *group* (*Start a group*, *The Crew · Mira's group*), the invite line says *revealed with names when everyone has played*, marks grow to 26, controls to 44; **`FirstDayCompact` is deleted** |
| `mirror-answers.jsx.patch` | **`PlaceAsked` is deleted** — the *Asked for Oslo* section (paid rows, running metrics, *Ask Oslo a question →*) leaves the City / Country / World stops |
| `place-stats.jsx.patch` | The scorecard loses *+ Author a metric for Oslo* and its *this set stays editorial* line |
| `app.jsx.patch` | The stops say **Groups · 1v1s**; `paidQ`, `openSuggestions`, `openPaidReport`, `openAskedByYou`, `openCatalog`, `goTrends`, the header's *Ask a question* button and the `PaidReportOverlay` / `AskedByYouOverlay` / `CatalogSheet` / `SuggestOverlay` mounts are deleted; the tweak reads *Group / 1v1 start* and *Reset your open rounds* (`resetRounds`) |
| `world-feed.jsx.patch` | The sticky head's hide moves off `state.headHide` onto the element (`setHeadHidden` writes transform / opacity / pointer-events through a ref — one fewer render per scroll flip); the rating hint becomes *1 rough · 10 superb*; the learn sheet loses *mixed into the feed* and its *Suggest a question* button |
| `daily-split.jsx.patch` | The ruler's stops say **Groups · 1v1s**; the *Have a question in mind? Suggest one →* line under the daily is deleted |
| `role-data.js.patch` · `roles-panel.jsx.patch` · `map-people.jsx.patch` | *days* → *rounds* in every figure (*same answer on N of M rounds*, *N of 6 rounds*, *N rounds* for the *N-day run*, which now reads `played` rather than `streak`); the two Roles section sub-lines are deleted; the rail's labels |
| `profile-overlay.jsx.patch` | The profile's sub-tabs take `useSubSwipe` (body and panel refs, `overflowX: hidden`, `willChange: transform`) |
| `person-mind-map.jsx.patch` | An **`own`** prop on the still: with it, hidden nodes are dropped rather than dimmed and the same / differ compare state is not drawn — the still is the person's own map, not a comparison |
| `big5-deep.jsx.patch` · `trait-web.jsx.patch` · `mirror-field-pops.jsx.patch` · `general-tab.jsx.patch` | Copy cuts and one deletion: *tap one to read it* gone; *Each pair sits so the usual pattern lands its dots together — a stretched amber thread is a rule you break* → *A stretched amber thread is a pattern you break*; Kindred's sub-line → *Strangers most like you.*; the profile's *You asked* shelf (`PaidMineCard`) gone |
| `tokens.css.patch` | Dead rules deleted: `.h-modeslot`, `.sd-opt:hover`, `panelIn`, `.sg-rise` / `.sg-tick`, `riseIn`, `.test-pick-card`, the accent-ramp experiments (`.acc-daily` / `.acc-family`) |
| `patterns.css.patch` | Dead rules deleted (the v28 shell's `.pt-slide-*`, `.pt-facts`, `.pt-prog*`, `.pt-note`, `.pt-next`, `.pt-done`, `.pt-svgcard`, `.pt-chip`; the pre-ring Map's `.qm-card`, `.qm-tlab`, `.qm-key*`, `.qm-meta`, `.qm-line`, `.qm-lab`, `.qm-tie2-*`, `.qm-top*`, `.qm-foot`, `qmEdge`, `.qm-pulse`, `.qm-drawin`, `.qm-nextlab`, `.qm-tie*`, `.qm-prog`); **`.pt-info` restyled** — 28 px, transparent, an ink hairline at 38 %, the serif *i* at 15 px |
| `oracle.css.patch` | The v28 tile instrument deleted whole (`.or-head` … `.or-disc`, the fill, the seal, the hints, `.or-sealed`); the six `.ar-*` rules and the `.pp-*` crossroads rules appended from the deleted `arena.css` |
| `lens.css.patch` | Against `lens.css` + `dots.css` concatenated: `.ln-head` / `.ln-title` / `.ln-hint` / `.ln-rail-lab` / `.ln-chip*` deleted, the dead `.h-dots` family deleted, and two new blocks — **polish & optimize**: `.icon-btn`, `.avatar-btn`, `.mmt-card-x` grow a 44 px hit box by `::after` (`inset: -6px`); **third pass**: `.tab-btn`, `.pt-pop` (with `.pt-pops` trading 7 px of padding for a negative margin so the pseudo fits inside its clip box), `.mmt-zoomctl button` and `.pt-info` the same way; and **one reduced-motion switch** — `#root *` and its pseudos at `.01ms` durations, one iteration, `scroll-behavior: auto` |

## Verified unchanged — do not re-extract, do not re-plan

Byte-identical to their latest recorded state, checked file by file
with the recipe above (89 of 110): the shell's neighbours (`iOS.jsx`,
`tweaks-panel`, `explain-sheet`, `viz-primitives`), the whole tests
family (`test-overlay`, `test-viz`, `profile-test-viz`, `result-card`
and `result-rose` — the 09-06 whole files stand — `type-marks`,
`type-mix.jsx`, `lens-cards`, `passive-meter`, `passive-progress`,
`test-data.js`, `test-feed-data`, `lens-defs`, `logic-raven`),
`politics-deep.jsx` (**the 09-07 module is unchanged — the compass's
in-place questions are still drawn there**), `big5-deep.jsx` but for
its one hint, the relationship map (core, main, panels, lenses), the
whole Patterns tab (`patterns-tab`, `question-map.jsx`, `oracle`,
`people-lens`, `patterns-core`, `question-map.js`), the whole Map tab
(`map-constellation`, `map-card`, `map-chips`, `map-learn-card`,
`map-fore-card`, `map-tab.js`, anchors, branches, groups, group-stats),
the Mirror (`mirror-tab`, `mirror-field`, `mirror-answers` but for the
deleted section, `mirror-field-pops` but for one sub-line,
`segment-explorer`, `group-mirror`, `group-role-map`, `demographics`,
`cityoverlay`, `place-stats.js`), the feed's data (`world-feed-data`,
`world-feed-comments`, `world-feed-counters`, `world-feed-report`,
`world-catalogs`, `world-subtopics`, `world-palette`, `votecuts`,
`feed-read`, `learn-*`, `paths-*`, `predict-*`, `pulse-*`,
`consequence-beat`, `read-run`, `learn-bits`), `daily-questions`,
`sample-data`, `archetype-data`, `compare-pop`, `type-mix.js`,
`scenes`, `follows`, `glyph-icons`, `trait-links`, `paid-data`, the
interaction helpers (haptics, sheets, scroll, swipe, subnav,
edge-fade), and `map.css`.

No app code references this directory; it is provenance, like every
other `design/standalone-*`.

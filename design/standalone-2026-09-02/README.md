# The 2026-09-02 standalone — one instrument for the three lenses, a voice for the questions, and the split ballot

The owner's `InSight_7.html` upload of 2026-09-02 (a `__bundler`
standalone of **26 assets**, built by the prototype's own bundler at
15:51 UTC that day), the seventh in the numbered series after
`InSight_1` (→ `standalone-2026-08-20/`), `InSight_2`
(→ `standalone-2026-08-22/`), `InSight_3` (→ `standalone-2026-08-24/`)
and `InSight_4` (→ `standalone-2026-08-26/`). **`InSight_5` and
`InSight_6` were never uploaded to this repository** — whatever they
carried is folded into this one, and the diff below is against the
08-26 record, not against them. The upload is ephemeral; this directory
is the durable record, per the family's standing rule
(`design/README.md`). The plan built on it — every item measured
against the tree, with its backend half named — is
[`docs/VISION-2026-09-02.md`](../../docs/VISION-2026-09-02.md).

`design/InSight_standalone_18.html` **stays the committed reference**
until a full sync moves it (`design/README.md`'s rule). This directory,
like its siblings, does not re-point it. `docs/VISUAL-VISION.md` names
this directory as the current vision (the owner's instruction of
2026-09-02: *"new visual should be added as the new visual vision until
i update it with new visuals"*).

## How this was extracted, and what the upload actually holds

**The JSX is not in this upload.** Where `InSight_3` and `InSight_4`
shipped every component twice — its `.jsx` source and its build, named
by the bundle's `ext_resources` map — `InSight_7` ships the prototype's
new "fast boot v2" shape: an empty `ext_resources` map, React 18.3.1 and
ReactDOM as two vendor files, and **one 2 MB `bundle.js`** holding all
114 modules in load order (`window.__INSIGHT_BUNDLE__ = { built, order,
hashes, files }`). The 53 `.js` data and helper modules are in it as
plain source; the 61 `.jsx` components are in it as **Babel's output** —
`/*#__PURE__*/React.createElement(...)`, the classic runtime. The
bundle's `hashes` are of the *sources*, which the boot script re-fetches
from `src/` in the background to detect edits; in a standalone those
fetches have nowhere to go and the bundle stands. So every `.jsx` file
in this directory, and the left side of every patch under `changes/`,
is **compiled JS under the module's own name**, not the JSX the earlier
directories hold. Read it as the design (Babel keeps every comment and
every string), and diff it the way this extraction did:

```
npm i --no-save @babel/core@7 @babel/preset-react@7      # in a scratch dir
node -e "const b=require('@babel/core');process.stdout.write(b.transformSync(
  require('fs').readFileSync(process.argv[1],'utf8'),
  {presets:[['@babel/preset-react',{runtime:'classic'}]],babelrc:false,configFile:false}).code)" recorded/oracle.jsx
```

Compiling the recorded copy this way and comparing bytes is **exact,
not approximate**: three 08-26 files the bundle did not touch
(`app.jsx`, `asked-by-you.jsx`, `place-stats.jsx`) compile
byte-identical to the bundle's builds, so a byte difference after
compiling is a design change and nothing else.

The other 23 assets: **15 `woff2` faces correctly labelled
`font/woff2`** — Spectral 400 / 500 / 600 in five unicode subsets each,
the one font the app does not ship — and **8 `woff2` faces labelled
`image/png`**, which are the eight Hanken Grotesk faces (byte sizes
identical to v18's eight; the 08-26 README's "trust the bytes, not the
mime" holds a third time). There is no image in the upload despite the
mimes. The template carries nine `<style>` blocks: the two font-face
blocks, then `tokens`, `map`, `patterns`, `oracle`, `arena`, `page`,
and a **new `lens.css`**.

Every module was diffed against the **latest recorded state of the same
module**, exactly as the 08-24 and 08-26 READMEs describe: v18 (its
modules named by identifier overlap with this bundle's, since v18's
template names them only by uuid) + `standalone-v28/changes/` patches,
the v24 / v25 / v28 / 08-20 / 08-22 / 08-24 / 08-26 whole files where
those supersede, the 08-26 `changes/` patches on top, then the 08-24
README's nine verbatim micro-hunks and the 08-26 README's three
whole-carried changes read off the residual. Every recorded patch
applied cleanly. Against that baseline **94 of 114 modules are
byte-identical**, and ten of the twenty that differ differ by exactly a
recorded prose hunk: `general-tab.jsx`, `paid-report.jsx`,
`result-rose.jsx`, `map-fore-card.jsx`, `search-overlay.jsx`,
`test-viz.jsx` and `feed-read.js` are the 08-24 hunks; `person-mind-map.jsx`
is the 08-26 one-liner; **`map-tab.js` is byte-identical to the 08-26
directory's `map-layout.js`** (that extraction named the layout engine
after its job, the bundle names it after its file — same module, the
bullseye still declared by nothing); and **`map-constellation.jsx` is
v18 plus `standalone-v28/changes/map-tab.jsx.patch`** byte-for-byte
(the v28 patch was named after the app's file, `map-tab.jsx`). None of
those ten is a 2026-09-02 move. What follows is the other ten, plus
three stylesheets that moved and one that is new.

## The files here, and where each would land

| File | What it is | Where it lands |
| --- | --- | --- |
| `lens.css` | **NEW — the shared instrument.** The three Patterns lenses stop being three cards with three legends and become one grammar: a light `.ln-card` with a title and one plain sentence (`.ln-head` / `.ln-title` / `.ln-sub`), a **round dusk field** (`.ln-field`, `aspect-ratio: 1`, a radial dusk gradient in hue 282), the drawing inside it on a shared palette (`--ln-ink`, `--ln-sub`, `--ln-line`, `--ln-hub`, `--ln-ring`, `--ln-halo`, `--ln-beacon`, `--ln-me`), a legend in words below (`.ln-key`, with `k-dot` / `k-ring` / `k-line` / `k-dash` swatches), one accent hint line (`.ln-hint`), and a chip rail (`.ln-rail` / `.ln-chip`). `.app.lens-paper` swaps the field to paper — a class hook, wired to no control anywhere in the upload. Plus the Oracle's disc spring and fill (`.or2-disc`, `.or2-fill`, `.or2-verdict`) | `src/v2/ui/patterns.css` (the lazy chunk's sheet) — merged in, or a sibling `ui/lens.css` imported by `PatternsTab.tsx`; plan §1 |
| `question-map.jsx` | **The Map lens as a RING.** Every question is one dot on a rim, grouped by topic in `WORLD_TOPICS` order with gaps between groups; a coloured arc outside the rim names the topic (labelled when the group is long enough to carry its own name); a tie is a **chord** bundled toward the hub (dashed = the answers go opposite ways, thicker = stronger); at rest the strongest ten speak and the rest whisper; the strongest link is written **on the field** as a callout pill; the hub prints *N of M · ANSWERED*; the "Answer next →" beacon pulses on the rim. Tap a dot and the field dims to its three ties. Position no longer encodes similarity — the chords carry all of it, and the header comment says so. The idle card becomes a `.qm-tie2` sentence: *People who pick **X** on "prompt" mostly go on to pick **Y** on "prompt"* with the percentage as a 26px figure, "counted over everyone who answered both · tap to open". Prompts inside the card wear the new serif voice | `src/v2/ui/PatternsMap.tsx` — the ring replaces `planeOf`'s use as the drawn layout (that function loses its only consumer); `edgesOf` / `nearOf` / `PATTERNS.say` are unchanged. `ui/patterns.css` for the `.qm-*` changes below. **Reopens `VISUAL-REQUESTS.md` request 1**, whose axis directions were to be drawn *in the plane* — on a ring an axis is a band or a chord family, and the request has to be re-planned; plan §1.2 |
| `oracle.jsx` | **The Oracle in the same field.** The two options are the two halves of the disc (`tap to pick`), the seam a dashed hairline; the sealed guess is a disc on the seam — bigger = surer (r 15–26), fainter = less to go on — under *SEALED GUESS* and a word for its confidence (`orSure`: sure / fairly sure / leaning / guessing, or *nothing to go on*); on your tap it travels to the half it called and **that half fills from the bottom** to its confidence (`orFillPath`); the disc lands solid (it had you) or breaks open to a ring (you broke it), and the verdict is **said in words below**: *It called X, fairly sure. You said Y. You broke it.* A `you` tag sits on your half. The one-time hints (`insight.oracle.hints.v1`) and the standing `.or-cap` key are **deleted** — the card's sentence and the record's kicker (*Your record · N answers · up = you broke it, tick = it had you*) do their work. "Why? →" opens the working (unchanged); "Next →" is a pill in the head; questions with more than two options fall back to stacked `.qm-opt` buttons. The prompt wears the serif | `src/v2/ui/PatternsOracle.tsx` + `ui/patterns.css`. The seal's pin (`data/patterns.test.ts`) must not move; the hint key leaves the purge list; plan §1.3 |
| `people-lens.jsx` | **The People lens in the field, and colour says one thing.** Each dot is coloured in **three plain steps of agreement** over the answers you share — mostly agrees (hue 282) / split (grey) / mostly disagrees (hue 20) — and sized in **two steps** (bigger = more answers in common; under 4 shared, not drawn). The plane is framed into the disc by the farthest person (`RMAX`), overlaps eased, everyone clamped inside the rim; the nearest five are named by a least-crowded-of-four-spots placement and repeated as a **"Most like you" chip rail** (`agrees 9 of 12`). "you" is a white dot in a beacon ring. The legend says the three colours and the size rule; the card's foot states the floor: *everyone who answered at least 4 of your N questions* | `src/v2/ui/PatternsPeople.tsx` — `agree` / `shared` per person already exist in `data/peopleMap.ts`, so the colour steps are a fold over figures the lens has; plan §1.4 |
| `patterns-tab.jsx` | Three moves on the shell. **The map's sub-row becomes a meta line** (`.pt-meta`): *● N answered · ○ N open · N ties* on the left and one **topic control** on the right — a native `<select>` dressed as a pill (`.pt-topic`), replacing the scrolling topic chips ("All" → "All topics"). **The lens body drags on the same horizontal axis as the daily and the mirror**: touch-drag or horizontal wheel moves the stack to the next ruler stop; past the far end the axis continues into the daily via `goNav('track:world')`; the first stop springs back; a drag that starts in an SVG, a scroller or a field belongs to it — except the Oracle's, which is tap-only and hands the drag to the axis (`.or-lens`). The ruler's labels lose their size jump (13.5 always, 700/500) | `src/v2/ui/PatternsTab.tsx` + `ui/patterns.css` — the far-end exit is D166's licensed joint (`NAV.goNav` answers whether it navigated), the same grammar `spec/daily-split.jsx` already uses; plan §1.5 |
| `patterns.css` | The sheet behind the two above: `.pt-meta` / `.pt-facts` / `.pt-topic`; `.qm-card` loses its box and padding (the field sits on the page); `.qm-read` becomes a hairline-topped block; `.qm-tie2*` and `.qm-lab`; `.qm-prompt` goes serif 21/500; the beacon label 12.5/700 (the 08-24 hunk had taken it to 10.5). `oracle.css`, `map.css` and `arena.css` are byte-identical to their record | `src/v2/ui/patterns.css` |
| `mirror-answers.jsx` | **Topic-hued answer rows.** The collapsed stack becomes notched pill segments in the question's **topic hue** (`DQ.catMeta(...).hue` → `oklch(0.55 0.13 h)`), the lead segment strong, the rest faint, yours in accent; the expanded bars and the rating histogram wear the same hue; percentages read in the hue's ink; the headline figure goes 13.5/800 in the hue; the prompt 15/700; and the "your vote" line becomes an accent-washed chip with a dot in it | `src/v2/ui/LiveAnswerRows.tsx` (the live Answers lens, ported from this file at D120 — it has no topic-hue access today) and `spec/mirror-answers.jsx` (the demo); plan §3 |
| `paths-card.jsx` | The Crossroads tree quiets down: the walked road is the only strong ink (3.5px, drawn again on top), every other branch a faint tint whose width is the crowd's flow (`f × 9`, was `× 20`), the canvas 176 tall (was 236), the end name **off the SVG and into the card** in serif 24/600 | `src/v2/spec/paths-card.jsx`; plan §3 |
| `catalog-sheet.jsx` | The shop window's polish: `Tok` spec chips, a **pledge progress bar** under a pledged metric (`pledgedEur / perPeriod`), a halo on the active dot, the score figure 22px, place groups 15.5/800 that rise in with a stagger (`.sg-rise`), the rate table's rows carrying a tone per scope | Nothing in the tree — the sheet still waits on VISION-2026-08-26 §2.2's owner decision (the seat split); this copy supersedes the 08-26 one as its design; plan §4 |
| `changes/world-feed.jsx.patch` | **The split ballot** on every feed vote card: two options sit side by side as one block divided by a hairline seam, each with a topic-hue dot and its label; on vote the seam moves to the crowd's split (each side's width is its share, 112/92 tall); three or more options stack as rows as before; "· you" becomes an uppercase **you** pill; the kicker gains the card's *form* in words (*this or that · rank · rate · dial · place it · learn · pick one · predict · read the room*) when there is no sponsor mark, in small caps; the snap and focus prompts go **serif** (500, balance-wrapped), the row prompt 15/600 | `src/v2/spec/world-feed.jsx` (`renderVote`, `renderVoteTiles`, the kicker, the prompt block) — the repo's copy is the converted-import one, so the port is an adaptation; the live cards use the same renderers; plan §2 |
| `changes/daily-split.jsx.patch` | The same ballot on the daily's world card (`gridTemplateColumns: 1fr 1fr`, 88 tall, the seam), the reveal as two sides whose width is share (128 tall) or the stacked tiles, the **you** pill, the prompt in the **serif** at 31/27 · 500 (was the display sans at 37/31 · 800), and the ruler labels losing their size jump — `sd-opt` leaves the pre-vote buttons | `src/v2/spec/daily-split.jsx` (`castVote`'s option row, the reveal block, the ruler); `src/v2/styles.css` keeps a `.sd-opt:hover` rule that then styles nothing; plan §2 |
| `changes/suggestions.jsx.patch` | **The paid door's rate rows redrawn**: the place name 17.5/800 with its demand word and *N of 14 booked · ×idx today* under it, the price as a 22px figure over *PER ANSWER*, the fourteen-day strip as **ticks whose height is booked** (tall = booked, the next open day in accent) that pop in with a stagger (`.sg-tick`), the caption *the next 14 days — tall is booked*, and a *next open D →* chip; the pricing paragraph becomes **scannable tokens** (`SgTok`: base · × demand — sold ÷ available · recomputed daily · floor · ceiling · billed per answer · …) under the three rows, with one sentence left: *The line you lock at booking is the line you keep* | `src/v2/spec/suggestions.jsx` (`SgRateRow`, `SgRateBoard` — the door D288 built) reading the committed rate card's `base` / `floorX` / `ceilX`; `src/v2/styles.css` for `.sg-rise` / `.sg-tick`; plan §4 |
| `changes/tokens.css.patch` | `--serif: 'Spectral', Georgia, …` — *"the prompt voice — the one place the app speaks in a second face. Every question people answer is set in it; UI, figures and captions stay sans"*; the tab bar's buttons go 500 / 700 and lose the inset ring; `.sd-opt:hover` moves its border to the mark; `.sg-rise` / `.sg-tick` keyframes (reduced-motion off). The `--ink-3` line in the same hunk is the 08-24 record, already in the tree | `src/v2/styles.css` (`:root`, `.tab-btn`, `.press`'s neighbourhood) + the Spectral faces under `public/fonts/`; plan §2.1 |

## The changes small enough to carry whole, right here

**`page.css`** — three lines of prototype infrastructure: a boot splash
that fades in, and its dots. The app has a native splash
(`index.html`'s comment) and does not port this:

```diff
   #root { display: contents; }
+  #boot-splash { animation: boot-in 0.5s ease both; }
+  @keyframes boot-in { from { opacity: 0; } }
+  @keyframes boot-dot { 0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1); } }
```

The same block **still carries** `.app[data-tab="patterns"] { --accent:
var(--c-today); }` — the override the 08-26 README recorded as deleted
(its `tokens.css` hunk) and D310 §4.5 removed from the app. In this
upload the Patterns tab wears dusk indigo again, and the new field is
drawn in hue 282 on its own tokens regardless of the tab accent. The
plan's §1.1 says what that means for the port.

## The patches in `changes/`, and what each carries

Four files moved by one feature's worth of lines inside thousands of
unchanged ones, so — the v28 device — they are unified diffs. **Their
left side is the compiled recorded state** (the Babel recipe above
applied to v18 + the recorded patches + the recorded whole files), not
any committed file: applying each to that compiled baseline reproduces
the upload byte-for-byte, which is how they were checked. Apply them
mentally; the table above says what each carries.

## Verified unchanged — do not re-extract, do not re-plan

Byte-identical to their latest recorded state, checked file by file
(compiled where the record is JSX): the shell (`app.jsx` — still the
08-26 copy, so no new doors or overlay slots), the paid family's other
files (`asked-by-you.jsx`, `paid-data.js`, `paid-report.jsx` but for
its recorded hunks), `place-stats.jsx` / `.js`, `role-data.js`,
`predict-data.js` (still no `ring: true`), `map-tab.js` (= 08-26
`map-layout.js`), the whole Map tab (`map-constellation.jsx` = v18 +
v28 patch, `map-card`, `map-people`, `map-learn-card`, `map-fore-card`
but for its 08-24 hunk, `map-chips`, `map-anchors`, `map-branches`,
`map-groups`, `map-group-stats-mock`), the relationship map (core,
main, panels, lenses), the person overlay and its map
(`person-overlay`, `person-mind-map` but for its 08-26 one-liner),
`profile-overlay`, `general-tab` but for its 08-24 hunk, the group and
1v1 daily (`group-daily`, `duo-daily`, `duels-data`, `daily-questions`,
`group-mirror`, `group-role-map`), the Mirror's other bodies
(`mirror-tab`, `mirror-field`, `mirror-field-pops`, `segment-explorer`,
`demographics`, `cityoverlay`, `place-stats`), the tests family
(`test-overlay`, `test-viz` but for its hue hunk, `profile-test-viz`,
`result-card`, `result-rose` but for its compact hunk, `type-marks`,
`type-mix`, `trait-web`, `trait-links`, `roles-panel`, `lens-cards`,
`lens-defs`, `test-data`, `logic-raven`, `passive-meter`,
`passive-progress`), the pulse and paths and predict data
(`pulse-card`, `pulse-trends`, `pulse-data`, `paths-data`,
`predict-cards`, `nature-data`), `patterns-core.js` and
`question-map.js` (the engines — only the lenses moved),
`explain-sheet`, `search-overlay` but for its 08-24 hunk,
`consequence-beat`, `read-run`, `learn-*`, `feed-read` but for its
08-24 hunk, `world-feed-*` data modules, `world-palette`,
`world-catalogs`, `world-subtopics`, `votecuts`, `sample-data`,
`scenes`, `follows`, `glyph-icons`, `compare-*`, `archetype-data`, the
interaction helpers (haptics, sheets, scroll, swipe, subnav,
edge-fade, reveal-clock), `iOS.jsx`, `tweaks-panel`,
`shared-primitives`, `viz-primitives`, and the stylesheets `map.css`,
`oracle.css`, `arena.css`.

No app code references this directory; it is provenance, like every
other `design/standalone-*`.

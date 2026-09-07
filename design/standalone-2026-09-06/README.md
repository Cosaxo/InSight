# The 2026-09-06 standalone — paper for the instruments, a floor for the type, and the dial in the header

The owner's `InSight_9.html` upload of 2026-09-06 (a `__bundler`
standalone of **26 assets** in the "fast boot v2" shape InSight_7
introduced), the ninth in the numbered series after `InSight_7`
(→ `standalone-2026-09-02/`). **`InSight_8` was never uploaded to this
repository** — like 5 and 6 before it, whatever it carried is folded
into this one, and the diff below is against the 09-02 record, not
against it. The upload is ephemeral; this directory is the durable
record, per the family's standing rule (`design/README.md`). The plan
built on it — every item measured against the tree, with its backend
half named — is [`docs/VISION-2026-09-06.md`](../../docs/VISION-2026-09-06.md).

`design/InSight_standalone_18.html` **stays the committed reference**
until a full sync moves it (`design/README.md`'s rule). This directory,
like its siblings, does not re-point it. `docs/VISUAL-VISION.md` names
this directory as the current vision (D361's standing rule: the owner's
upload moves the vision).

## How this was extracted, and what the upload actually holds

The same shape as `InSight_7`, so the 09-02 README's recipe applies
verbatim: an empty `ext_resources` map but for `build_bundle_js`, React
18.3.1 and ReactDOM as two vendor files, and **one 2 MB `bundle.js`**
holding all 114 modules in load order (`window.__INSIGHT_BUNDLE__ =
{ order, hashes, files }`). The 53 `.js` modules are plain source; the
61 `.jsx` components are **Babel's output** (classic runtime, comments
kept). So every `.jsx` file in this directory, and the left side of
every `.jsx` patch under `changes/`, is **compiled JS under the
module's own name** — read it as the design, and diff it with the
Babel recipe in `standalone-2026-09-02/README.md`.

Every module was diffed against the **latest recorded state of the
same module**: v18 + `standalone-v28/changes/`, the v24 / v25 / v28 /
08-20 / 08-22 / 08-24 / 08-26 / 09-02 whole files where those
supersede, the 08-26 and 09-02 `changes/` patches on top, the 08-24
README's nine verbatim micro-hunks and the 08-26 README's one-liner
read off the residual (the 09-02 whole `.jsx` files are already
compiled and stand as-is; its three `.jsx` patches apply to the
compiled baseline). Every recorded patch applied cleanly. Against that
baseline **89 of 114 modules are byte-identical**, and eight of the 25
that differ differ by exactly a recorded prose hunk (`general-tab`,
`paid-report`, `result-rose`, `map-fore-card`, `search-overlay`,
`test-viz`, `feed-read` — the 08-24 nine less the two whose files were
later superseded whole — plus `person-mind-map`, the 08-26 one-liner).
What follows is the other **seventeen**, plus seven stylesheets that
moved and one that is new. Applying each patch here to that compiled
baseline reproduces the upload byte-for-byte, which is how they were
checked; the whole files ARE the upload's bytes.

The other 23 assets: **15 `woff2` faces labelled `font/woff2`** —
Spectral 400 / 500 / 600 in five subsets, as at 09-02 — and **8 `woff2`
faces labelled `image/png`**, the eight Hanken Grotesk faces
(the 08-26 README's "trust the bytes, not the mime" holds a fourth
time). No images in the upload. The template gains a `#boot-splash`
inside `#root` (wordmark + three dots — prototype infrastructure, the
app has a native splash), `defer` on the vendor scripts, one comment
(*"arena.css stays loaded: crossroads (paths-card) shares its `.ar-*`
chrome"*), and a **tenth style block** — `dots.css`, new, recorded
whole below.

## What the design does, in one paragraph

Four moves, one direction: **ink on paper**. (1) `lens-paper` goes from
an unwired hook to the app's DEFAULT — the Patterns field trades the
dusk disc for paper, and the boxes go with it: feed cards sit on a
top-rule ground, the result card loses its card, the profile flattens
to hairline sections, the ballot becomes one hairline row, the tests
become rows, and figures **draw themselves onto the page** (`inkDraw` /
`inkIn` / `inkDot`, on the Patterns ring and the Map constellation).
(2) A **12px floor** under every piece of microtype, app-wide — the
Patterns tab's "no type below 10.5" rule, raised and made global
(kickers, legends, klabels and their trackings move in `tokens.css` and
six sheets, and every inline 9–11.5px in the touched modules). (3) The
**serif voice reaches further**: Circle and 1v1 prompts, the Oracle's
option halves, the Map's hub figure, the result card's identity line,
the tests' read line. (4) **Chrome collapses into words**: standing
legends and lens titles retire behind one ⓘ (`.pt-info`, the `guide`
prop), the daily's icon buttons become the underlined words *why this
question* and *answer anonymously*, the feed's topic rail folds behind
an *all topics* chip, and the Patterns lens picker moves into the
header as a dial that docks like the daily's ruler.

## The files here, and where each would land

| File | What it is | Where it lands |
| --- | --- | --- |
| `app.jsx` | **The shell: the header dial, and paper by default.** The Patterns lens state lifts into `App` (`ptLens`); the header dock slot serves **track and patterns** — the daily's `DOCK_STOPS` renamed `DAILY_DOTS`, a `PT_DIAL` of *Oracle · Questions · People* beside it (short labels; the in-page ruler keeps the long ones), haptic ticks on both; `data-docked` applies on either tab and resets on every tab change; the daily gets `hideSwitcher: true` (the dock dots do its job); and `lens-paper` joins the app root's class list — the paper field is the default, not a hook | `src/v2/spec/app-shell.jsx` (`DOCK_STOPS` at 217, the dock slot at 680, the `appClasses` line); `ui/PatternsTab.tsx` grows `lens`/`onLens`/`onDock` props; plan §3 |
| `patterns-tab.jsx` | **The ruler docks, and the legends move behind one ⓘ.** The in-flow ruler folds away when scrolled past OR after using a lens (pointerup in the stack; wheel/pull at the top brings it back, with hysteresis), `onDock` telling the shell; every lens's meta row leads with an ⓘ (`.pt-info`) that toggles `guide` — the always-on facts line (*● answered · ○ open · ties*) and the Oracle's progress track retire, the hub and the kickers say the numbers instead; the drag SKIP list drops `svg` (the lenses are tap-only, a horizontal drag on their discs rides the axis) and adds `.ln-rail` | `ui/PatternsTab.tsx`; `ui/patterns.css`; plan §2.4–§2.5 |
| `question-map.jsx` | **The ring quiets and explains itself on demand.** Short topic groups get their name INSIDE the rim, straight, pointing at the hub (candidate texts × four radii, collision-avoided, never over dots); the hub goes serif — a 36/500 figure over *OF N* (was *16/800 N of M · ANSWERED*), r 44, no ring stroke; idle chords drop to 0.05 opacity in `--ln-ink`, arcs go 4px and **draw in** (`qm-arc`, staggered), dots pop in by angle (`qm-dot`); the on-field callout pill and the beacon's *Answer next →* label are deleted (the beacon dot alone remains); `.ln-head` (title + sentence) is deleted and the card loses its box (`ln-card`, no `card`); the legend renders only under `guide`, reworded, with *tap a dot for its links* as a legend row; the idle tie sentence compacts to *X on short → Y on short* with the questions' `short` names, serif 17, the figure 28/700 in ink | `ui/PatternsMap.tsx` + `ui/patterns.css`; plan §2.1 |
| `oracle.jsx` | **The options move into the halves, in the serif.** Option labels render inside the disc halves at serif 17–20/500, two lines broken at the most even space (`orLines`); *tap to pick*, *SEALED GUESS*, *sealed here*, the confidence word and the *sealed* chip are all deleted — the rim and full-height seam become quiet ink hairlines (0.16), the picked half tints 8% before landing, the disc rests lower (cy +66); the kicker becomes *N of M* (answered of pool); the prompt grows to serif 24; a **1·2·3 strip** (`.or2-how`: *it guesses, sealed · you tap a half · did it have you?*) renders under the prompt only with `guide`, as does the ledger's key; the verdict explainer paragraph shows when there is a record or `guide` | `ui/PatternsOracle.tsx` + `ui/patterns.css`; the seal's pin (`data/patterns.test.ts`) must not move; plan §2.2 |
| `people-lens.jsx` | **Names on tap, and the rail becomes rows.** No name is spotted on the field (the five-label placement loop is short-circuited); the tapped person alone is named beside their dot; two faint guide rings (r/3, 2r/3) frame the disc; the paper palette retunes (split goes warm-grey hue 80, disagree hue 35); the legend renders under `guide` and absorbs the floor sentence (*N people · everyone who answered at least k of your M questions*) — the foot card is deleted; the *Most like you* chip rail becomes **three `.ln-row` rows** — avatar tinted by the person's agreement step, *agrees a of b*, and a shared-answer line (*Both said X* / *You split on everything you share*) | `ui/PatternsPeople.tsx` + `ui/patterns.css` + the `.ln-list` family in `dots.css`; plan §2.3 |
| `test-overlay.jsx` | **The test picker as rows.** The pick cards (tick strip, dim chips, footer band) become one bordered row list (`.test-rows`): a conic progress ring with the type mark inside, name + when on one line, one serif read line (*type name · strongest lean · early read*), an arrow | Nothing directly — the sit-down picker was retired at D121 (passive results). The row grammar is provenance for the surfaces that DO list tests (`spec/profile-general.jsx`'s `TestArcsCard`); plan §6.2 says what carries |
| `result-card.jsx` | **The result card leaves its box.** `card` → `rpv2-page` (no box, no side padding, banner wash → one hairline rule, progress bar 2px rounded); the identity line goes serif 31/500 and the tagline serif 16; the near-type chips become a prose sentence (*…and you'd be **Name** · all N types →*); the "rule" line (*very curious + warm →*) is switched off in place (`false &&`); the **Born or built section and `NatureRows` are deleted** (with the genes/life legend); the private toggle simplifies to a dot | `spec/result-card.jsx` (drawn by the profile overlay and the feed's test beat); plan §6.1 |
| `paid-data.js` | **The market model, drawn further.** Items gain `scope`/`place` and `atClose`/`rate`/`lockedIdx`; the price law extends — an intersection prices at the **max of its parents' indices** (*"a thin cell is never a discount"*), `age`/`topic` get indices, `minTicket` (floor × line), `shareCap` 0.3, and a counter-offer note (under the floor, offer the nearest sellable superset); **`SUB` is new** — subscriptions as a forward contract at −20%, a metric's period cost **split evenly across its subscribers** with a €24 seat floor, pledges until a period is covered; **`CATALOG` is new** — seven metrics with active / pledged / inactive states, seats and scores | Demo data (D167 — seeds never ship). What it DRAWS: the seat-split answer VISION-2026-08-26 §2.2 has waited on, and pricing-law vocabulary the tree's sponsored law (D371–D377) has partly moved past; plan §7 |
| `patterns.css` | The sheet behind the tab's moves: `.pt-info` (a serif-italic ⓘ, 32px), `.or2-how` + `.or2-g1/2/3` (the 1·2·3 strip), sub-row heights 31 → 34, and this sheet's share of the 12px floor (`.pt-kick`, `.qm-tlab` et al., trackings to 0.07em) | `ui/patterns.css`; plan §2 and §4 |
| `dots.css` | **NEW.** Four live families and one dead one: `.test-rows` / `.test-row*` (the tests list); the **paper-lens overrides** (`.app.lens-paper .ln-card` unboxed, the field's dusk gradient replaced by a hairline ring — and `is-bare` none at all — `--ln-hub: var(--surface)`, `--ln-line: var(--ink)`, the legend re-inked); `.ln-list` / `.ln-row*` (the People rows); a *polish (Sep 2026)* block — `.ds-half` press feedback (tint + underline in the option's hue), the Mirror's lens row as a hairline row, the Map's chip rail fading over 48px, `.profile-ov .card` flattened to hairline sections (`!important` over the card grammar), and the **ink-in keyframes** (`inkDraw`/`inkIn`/`inkDot` on `.qm-arc`/`.qm-fig`/`.qm-ink`/`.qm-dot` and `.mmt-ink`/`.mmt-dotnode`, reduced-motion off). The dead one: `.h-dots`/`.h-dot*` — **no module references them**; the header dial uses the existing `.h-dockruler`/`.h-dockstop`. Residue of an iteration, recorded as found | split across `ui/patterns.css` (lens families) and `src/v2/styles.css` (test rows, ballot, profile, constellation ink-in); plan §4–§6 |

## The patches in `changes/`, and what each carries

Their left side is the **compiled recorded state** (the baseline above),
not any committed file; `recorded/` and `2026-09-06/` in the headers
say which side is which.

| Patch | What it carries |
| --- | --- |
| `world-feed.jsx.patch` | **The feed's ground and the folded topics.** Boxed card skins (rankings and kin — `skin === 'card'`, not paid/collapsed/focus) join the bare ground: transparent, no border/radius/shadow, a top rule and air (padding 22/26); the chip rail folds behind one *all topics / N of M topics* disclosure chip with a chevron, under a *the feed* kicker; topic chips lose their per-topic colours for neutral ink-with-a-check (*"the per-topic colours read as clutter here"*); a `headHold` guard stops the sticky head hiding itself when opening the rail nudges `scrollTop` |
| `daily-split.jsx.patch` | **The ballot becomes a hairline row, and the icons become words.** The boxed seam block goes: `.ds-ballot` is borderTop/borderBottom only, halves transparent (`.ds-half`, `--oc`, `min-height: var(--field-size)`, centered, no colour dots, an inner hairline as the seam); under the ballot, the ⓘ icon button is replaced by underlined words — *why this question*, and *answer anonymously* → *anonymous · on* → *answered anonymously* (the toggle VISION-2026-08-26 §1 designed, still an owner decision); the rest is the 12px floor |
| `duo-daily.jsx.patch` | The 1v1 prompt goes **serif** (27/500, balance); the 12px floor across its chips and counters |
| `group-daily.jsx.patch` | The Circle prompt goes **serif** (+2px, 500, balance); the 12px floor |
| `mirror-field.jsx.patch` | The figure lifts slightly in its frame (*"read with the header, not the lens row"*); two 11px labels to 12; the lens row's paddingTop 16 → 12 |
| `mirror-field-pops.jsx.patch` | The 12px floor on the person card's chips; the "so what" line suppressed on the circle population |
| `mirror-tab.jsx.patch` | The ruler's off-stop labels rise to the floor (12/13 against 14 on) |
| `map-constellation.jsx.patch` | The constellation **draws itself in**: `.mmt-ink` + `pathLength: 1` on every limb and spoke with staggered delays, nodes delayed by distance from the hub (the `inkDraw`/`inkIn` keyframes live in `dots.css`) |
| `profile-overlay.jsx.patch` | One class — `profile-ov` — that hands the overlay to `dots.css`'s paper sections |
| `tokens.css.patch` | **The floor, at the tokens.** `.kicker`, `.klabel`, `.legend`, `.h-meta`, the tab bar's labels, the accent chip and `.search-group`: 9.5–11px → **12px**, uppercase trackings 0.09–0.1em → **0.07em** |
| `map.css.patch` · `arena.css.patch` · `oracle.css.patch` · `lens.css.patch` | The same floor swept through each sheet (anchor labels, dot labels, chips, hints, axes, keys — every 9–11.5px to 12). No structural change in any of the four |

## Verified unchanged — do not re-extract, do not re-plan

Byte-identical to their latest recorded state, checked file by file
(compiled where the record is JSX): the engines (`patterns-core.js`,
`question-map.js`, `map-tab.js`), all data modules (`daily-questions`,
`world-feed-*`, `sample-data`, `scenes`, `follows`, `duels-data`,
`pulse-data`, `paths-data`, `predict-data`, `nature-data` — the module
stays even as the card stops drawing it, `trait-links`, `test-data`,
`role-data`, `lens-defs`, `learn-*`, `votecuts`, `place-stats.js`,
`world-palette`, `world-catalogs`, `world-subtopics`, `glyph-icons`,
`demographics.js`, `compare-pop`, `type-mix.js`, `map-anchors`,
`map-branches`, `map-groups`, `map-group-stats-mock`, `paid-data`'s
siblings `paid-report` and `asked-by-you` but for recorded hunks,
`patterns-core`), the whole relationship map, `person-overlay` and
`person-mind-map` (but for its recorded one-liner), `mirror-answers`
(the 09-02 topic-hued rows stand), `paths-card`, `catalog-sheet` (the
09-02 copy stands as the window's design), `suggestions.js`/`.jsx`
(the 09-02 rate rows stand), `segment-explorer`, `search-overlay` and
`general-tab` and `map-fore-card` and `test-viz` and `feed-read` and
`result-rose` and `paid-report` (each but for its recorded 08-24 hunk),
`explain-sheet`, `consequence-beat`, `read-run`, `pulse-card`,
`pulse-trends`, `predict-cards`, `trait-web`, `roles-panel`,
`type-marks`, `type-mix.jsx`, `profile-test-viz`, `lens-cards`,
`passive-meter`, `passive-progress`, `test-feed-data`, `logic-raven`,
`cityoverlay`, `demographics.jsx`, `place-stats.jsx`, `map-card`,
`map-people`, `map-learn-card`, `map-chips`, `group-mirror`,
`group-role-map`, `compare-breakdown`, the interaction helpers
(haptics, sheets, scroll, swipe, subnav, edge-fade, reveal-clock),
`iOS.jsx`, `tweaks-panel`, `shared-primitives`, `viz-primitives`, and
the `page.css` block (still only the recorded boot lines and the
`acc-patterns` override, exactly as the 09-02 README describes).

No app code references this directory; it is provenance, like every
other `design/standalone-*`.

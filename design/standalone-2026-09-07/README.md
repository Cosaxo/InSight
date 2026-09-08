# The 2026-09-07 standalone — the instruments in depth, and the first day of Circle and 1v1

The owner's `InSight_10.html` upload of 2026-09-07 (a `__bundler`
standalone of **26 assets** in the "fast boot v2" shape InSight_7
introduced), the tenth in the numbered series, one day after
`InSight_9` (→ `standalone-2026-09-06/`). The upload is ephemeral; this
directory is the durable record, per the family's standing rule
(`design/README.md`). The plan built on it — every item measured
against the tree, with its backend half named, and the plan for how
the new sub-scales get MEASURED, not only drawn — is
[`docs/VISION-2026-09-07.md`](../../docs/VISION-2026-09-07.md).

`design/InSight_standalone_18.html` **stays the committed reference**
until a full sync moves it (`design/README.md`'s rule). This directory,
like its siblings, does not re-point it. `docs/VISUAL-VISION.md` names
this directory as the current vision (D361's standing rule: the owner's
upload moves the vision).

## How this was extracted, and what the upload actually holds

The same shape as `InSight_7` and `InSight_9`, so the 09-02 README's
recipe applies verbatim: an empty `ext_resources` map but for
`build_bundle_js`, React 18.3.1 and ReactDOM as two vendor files, and
**one 2 MB `bundle.js`** holding **117 modules** in load order
(`window.__INSIGHT_BUNDLE__ = { order, hashes, files }`) — three more
than 09-06's 114. The 53 `.js` modules are plain source; the 64 `.jsx`
components are **Babel's output** (classic runtime, comments kept). So
every `.jsx` file in this directory, and the left side of every `.jsx`
patch under `changes/`, is **compiled JS under the module's own name** —
read it as the design, and diff it with the Babel recipe in
`standalone-2026-09-02/README.md`.

Every module was diffed against the **latest recorded state of the
same module**: v18 (`design/InSight_standalone_18.html`, its modules
named by their header comments — the two that share a dashed header,
`general-tab` and `logic-raven`, by their second line) +
`standalone-v28/changes/`, the v24 / v25 / v28 / 08-20 / 08-22 / 08-24 /
08-26 / 09-02 / 09-06 whole files where those supersede, the 08-26,
09-02 and 09-06 `changes/` patches on top, compiled with the recipe
where the record is JSX. Every recorded patch applied cleanly. Against
that baseline **99 of 117 modules are byte-identical**, and eight of
the eighteen that differ differ by exactly a recorded prose hunk
(`general-tab`, `paid-report`, `result-rose`, `map-fore-card`,
`search-overlay`, `test-viz`, `feed-read` — the 08-24 README's nine
less the two whose files were later superseded whole — plus
`person-mind-map`, the 08-26 one-liner). What follows is the other
**ten: three modules that did not exist before, and seven that moved.**
Applying each patch here to that compiled baseline reproduces the
upload byte-for-byte, which is how they were checked (all six); the
whole files ARE the upload's bytes (all four).

**No stylesheet moved.** The template's ten `<style>` blocks were
reconstructed the same way (v18's blocks + the v28 / 09-02 / 09-06 CSS
patches, the v28 / 08-20 / 08-24 / 08-26 / 09-02 / 09-06 whole sheets
where those supersede): `tokens`, `map`, `patterns`, `oracle`, `arena`,
`lens` and `dots` are byte-identical to their record; `page` differs
only by the three boot-splash lines the 09-02 README carries in prose;
the Hanken `@font-face` block differs only in the eight asset uuids
its `src: url()`s name, which are minted per bundle. The Spectral block
has no recorded copy (the 09-02 README describes it) and is the same
fifteen faces.

The other 23 assets: **15 `woff2` faces labelled `font/woff2`** —
Spectral 400 / 500 / 600 in five subsets, as at 09-02 — and **8 `woff2`
faces labelled `image/png`**, the eight Hanken Grotesk faces (the 08-26
README's "trust the bytes, not the mime" holds a fifth time). No images
in the upload. The template's boot script lists the three new modules
in its `JSX` array — `first-day.jsx` between `trait-web.jsx` and
`group-daily.jsx`, `big5-deep.jsx` and `politics-deep.jsx` between
`roles-panel.jsx` and `profile-overlay.jsx` — and its startup module
check is unchanged.

## What the design does, in one paragraph

Three additions and one polish pass, all on paper. (1) **The two
instruments most people know get a second level.** The Big Five's five
domains unfold into the **thirty IPIP-NEO facets** (six per domain, each
scored 4–20 on one shared track, the domain row carrying its six facet
dots), with IPIP-NEO's own report text behind every facet; the
political compass's six axes unfold into **eighteen positions** (three
per axis, two questions each, on a 0–100 track with a hollow ring
where most people sit) — and the compass, unlike the Big Five, carries
its own way in: an axis you have not gone deep on shows its three empty
positions and offers **six questions right there**, one at a time on
the five-step agreement scale, after which the axis's compass score
becomes the mean of its positions so level one and level two never
disagree. (2) **Circle and 1v1 get a first day** — not a form: today's
World question over the hairline ballot with the seal drawn on the
seam, the reveal clock, tomorrow's reveal as a real one is drawn (your
mark in the first seat, open seats as dashed rings), then one primary
action and the other door in one line; an invitation waiting and a
tapped link get hero beats; an account with no display name gets the
field inside *Start one*; circles that already exist get a
*Start another* row at the end of the stack. (3) **The person overlay's
three record sections go boxless**: the receipts lead with a sentence
and the exception side, the Play together card becomes doors, and the
read-each-other card becomes a two-column hit-rate table under a
sentence. (4) One line on the feed's two-option ballot: a minimum
width on each half.

## The files here, and where each would land

| File | What it is | Where it lands |
| --- | --- | --- |
| `big5-deep.jsx` | **NEW — the Big Five in depth.** `DOMAINS`: five domains in IPIP-NEO order (N · E · O · A · C), each with `band`, a one-line `trait`, a `def`, a `you` paragraph (one band's narrative), and six **facets** — name, `lo`/`hi` readings, a `score` on 4–20, a band, and IPIP-NEO's report `text`, kept verbatim. Level one: five rows (name · band · trait · the six facet scores as dots on one track with a grey midpoint tick at 12), one open at a time. Level two: the definition in the serif, the narrative, the facets as rows (label column, the score's track and dot, the figure), tap one to read it, a `4 · midpoint · 20` foot. **Demo scores only — no questions anywhere in the module**; `window.BIG5_DEEP` publishes the table | `spec/profile-overlay.jsx:344`, under the Big 5 tab's `ResultProfileCard` — as a lazy typed panel beside `LiveRolesPanel`, reading a facet fold that does not exist yet; plan §1.1, §2 |
| `politics-deep.jsx` | **NEW — the compass in depth.** `AXES`: six axes with their poles, a `def`, and three **positions** each — id, name, `lo`/`hi`, an authored `avg`, two questions (`qs`, one `invert` per position), a `text`. `scorePositions` (six 0..4 answers → three 0–100 scores, an unanswered item scoring as the middle), `syncAxis` (the compass axis becomes the positions' mean, written through `IS_persistTestResult`), `sideOf` (< 45 / > 55 / centre), a `Track` with the hollow *most people* ring, the five-step `SCALE` with its `Mark` glyphs, `Questions` (one at a time, a progress strip, Back / *Not now*), `AxisPanel` (positions as rows, or the questions in place; *Six questions place them →*; *Answer again*), `AxisRow`, `PoliticsDeep`. Answers persist in `insight.politicsDeep.v1`; `DEMO` places three of Mira's six | `spec/profile-overlay.jsx:345`, under the Politics tab's card — the same lazy panel shape; its 36 prompts go to the BANK (`content/tests.json`), never into the module; its answers become ordinary answers through `LIVE.vote`, never a device key; plan §1.2, §2 |
| `first-day.jsx` | **NEW — the first screen of Circle and 1v1 when the person has none.** `Day` (Today · sealed: the World prompt in the serif over a two-column hairline ballot with the `Seal` on its seam; Tonight: `RevealClock`; Tomorrow · revealed: two reveal rows with `MyMark` in the first seat and dashed `OpenSeat`s, the second tap's `EmptyRun` of seven dots); `InviteHero` (Accept / Decline) and `LinkHero` (*A link asks, it does not admit* · *Ask to join*); `StartOne` (the group name and *Your name* as hairline fields, *Who's coming* — follows as tappable marks, a name-or-handle search with hits, chips for the picked, at least 2 for a circle, exactly 1 for a 1v1); `FirstDay` (the states: `fresh` · `no-follows` · `no-name` · `invited` · `link`) and `FirstDayCompact` (the *Start another circle / 1v1* row). Reads `window.WORLD_TODAY` with a `DAILYQ.today` fallback and a hard-coded last resort | `ui/LiveDuelPanel.tsx` — its no-circles state IS the create-or-join flow today; the Day beats, the heroes and the compact row port onto it; the demo twins `spec/group-daily.jsx` / `spec/duo-daily.jsx` take the same hooks; plan §3 |
| `person-overlay.jsx` | **The person's page: three sections on paper.** *The answers behind it*: a lead sentence (*Same answer 34 times out of 35* / *Different answers on all N* / *Same answer N times, different M*), then rows led by the prompt in the serif with *both X* or *you X · Name Y* under it — **whichever side is the exception leads** (splits first when they are fewer), five rows by default and an *All N ›* / *Fewer* toggle; the section label kicker, the *where you match / where you split* sub-labels, the dot glyph and the progress bar are gone. *Play together*: doors — a title, a sub-line carrying the named type's one-line meaning (*The Twin — …*), a chevron; the 1v1 door (*1v1 · N days* / *1v1 · new*), one door per shared group (*invited · waiting on Name* as the sub-line), *Add Name to a group* with the chips, or a *Groups · none together yet* row. *How well you read each other*: a lead sentence (*You read Name better than Name reads you, except on self-image.*), column heads *you read Name* / *Name reads you*, one row per domain (*self-image* for the mirror domain, *all days* when shallow) with `n/total` figures and a short bar each; the dot runs stay on the 1v1 screen. Carried whole: the patch is 289/275 lines of a 1,200-line file | `spec/person-overlay.jsx` (the three sections at its lines 219–530: receipts, *Play together* at 426, *How well you read each other* at 519 — an adapted port, D310's doors) — and it draws the person's-page half of `VISUAL-REQUESTS.md` request 5; plan §4 |

## The patches in `changes/`, and what each carries

Their left side is the **compiled recorded state** (the baseline above),
not any committed file; `recorded/` and `2026-09-07/` in the headers
say which side is which.

| Patch | What it carries |
| --- | --- |
| `profile-overlay.jsx.patch` | The two mounts: `Big5Panel` becomes a fragment of the result card and `<window.Big5Deep />`; `PoliticsPanel` gains `<window.PoliticsDeep />` after its card. Nothing else moves |
| `group-daily.jsx.patch` · `duo-daily.jsx.patch` | The first-day hooks, identical in shape on both bodies: `GroupDailyBody` / `DuoBody` take a `start` prop and a `dismissed` state; with no circles (or a forced demo state) the body renders `<FirstDay mode state onDone>` inside the same scroll root; with circles, `<FirstDayCompact mode onStart>` renders at the end of the stack before the add-sheet portal, opening the same add sheet |
| `daily-split.jsx.patch` | `window.WORLD_TODAY = { prompt, options }` published from the World render (today's question for the first-day screen — *"a circle's own question can't be shown before the circle exists: the rotation is seeded per circle"*), and the `start` prop passed through to both bodies |
| `app.jsx.patch` | A demo tweak, `dailyStart` (*sample circles · fresh account · fresh · no follows · fresh · no display name · invitation waiting · tapped a link*), stored in the tweak state and passed to the daily as `start`. The tweak laboratory was dismantled at v28; in the tree these are mount fixtures, not a control |
| `world-feed.jsx.patch` | One line in `renderVoteTiles`: a two-option tile gets `minWidth: two ? (big ? 90 : 78) : 0`, so a half with a small share cannot collapse under its label |

## Verified unchanged — do not re-extract, do not re-plan

Byte-identical to their latest recorded state, checked file by file
(compiled where the record is JSX): `app.jsx`'s 09-06 shell but for the
tweak above, `test-overlay.jsx` and `result-card.jsx` (the 09-06 whole
files stand), `test-data.js` (**the four banks are unchanged — the
facets and positions have no items there**), the engines
(`patterns-core.js`, `question-map.js`, `map-tab.js`), all data modules
(`daily-questions`, `world-feed-*`, `sample-data`, `scenes`, `follows`,
`duels-data`, `pulse-data`, `paths-data`, `predict-data`, `nature-data`,
`trait-links`, `role-data`, `lens-defs`, `learn-*`, `votecuts`,
`place-stats.js`, `world-palette`, `world-catalogs`, `world-subtopics`,
`glyph-icons`, `demographics.js`, `compare-pop`, `type-mix.js`,
`map-anchors`, `map-branches`, `map-groups`, `map-group-stats-mock`,
`paid-data`, `archetype-data`), the whole Patterns tab (`patterns-tab`,
`question-map.jsx`, `oracle`, `people-lens`), the whole relationship
map, `person-mind-map` (but for its recorded one-liner),
`mirror-answers`, `mirror-field`, `mirror-field-pops`, `mirror-tab`,
`paths-card`, `catalog-sheet`, `suggestions.js`/`.jsx`, `asked-by-you`,
`segment-explorer`, `search-overlay` and `general-tab` and
`map-fore-card` and `test-viz` and `feed-read` and `result-rose` and
`paid-report` (each but for its recorded 08-24 hunk), `explain-sheet`,
`consequence-beat`, `read-run`, `pulse-card`, `pulse-trends`,
`predict-cards`, `trait-web`, `roles-panel`, `type-marks`,
`type-mix.jsx`, `profile-test-viz`, `lens-cards`, `passive-meter`,
`passive-progress`, `test-feed-data`, `logic-raven`, `cityoverlay`,
`demographics.jsx`, `place-stats.jsx`, `map-card`, `map-constellation`,
`map-people`, `map-learn-card`, `map-chips`, `group-mirror`,
`group-role-map`, `compare-breakdown`, the interaction helpers
(haptics, sheets, scroll, swipe, subnav, edge-fade, reveal-clock),
`iOS.jsx`, `tweaks-panel`, `shared-primitives`, `viz-primitives`, and
every stylesheet (above).

No app code references this directory; it is provenance, like every
other `design/standalone-*`.

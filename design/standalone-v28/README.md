# standalone v28 — the updated vision, held for porting

Extracted 2026-08-15 from the maintainer's `InSight_standalone_28.html`
(a claude.ai bundler export; **the upload is ephemeral, this directory is
the durable record**). Same precedent as `design/standalone-v24/` and
`design/standalone-v25/`: a porting reference, not live code. Nothing
imports it, and it earns deletion when the last item below is ported or
refused.

`design/InSight_standalone_18.html` **stays the committed reference**
until a full sync moves it (`design/README.md`'s rule). Everything here
is measured against v18, so this directory says exactly what a full sync
would have to carry.

The plan built on it — sequencing, cost, and what each item costs against
the tree's real budgets — is [`docs/VISION-V28.md`](../../docs/VISION-V28.md).

## How this was extracted

The bundle is base64+gzip assets in a `<script type="__bundler/manifest">`
block plus a `__bundler/template` the loader rewrites. 109 scripts load in
template order (3 are React/ReactDOM/Babel); module identity comes from
each file's own header comment, and the ~28 files whose headers do not name
themselves were paired to v18 by token overlap (every one matched at 1.00,
so no v28 module is unaccounted for). The scratch extractor is not kept —
it is twenty lines of `zlib.gunzipSync` over the manifest, and rewriting it
beats maintaining it.

## What v28 is

**The headline is structural: two tabs become three.** `patterns · daily ·
mirror`, with the daily in the middle so a swipe either way lands somewhere
(`changes/app-shell.jsx.patch`). The daily's ruler runs off its near end
into Patterns the way it already runs off its far end into the Mirror.

**And the prototype stopped being a laboratory.** Nineteen of the twenty-one
tweak flags are gone — nav mode, accents, palette spread, mark style, quiet
ground, lens style, boxed lenses, mirror first-run, and every one of the ten
`wf*` feed toggles — folded into the design as shipped defaults. What is
left in Tweaks is density, a demo pulse-history selector, and three reset
buttons. Read the removals as decisions: `ruler` nav, `slice` marks, `full`
palette, `underline` lenses, quiet ground on, every feed card on.

## The inventory

Counts are v18 → v28 line deltas. "App state" was checked against the tree
at extraction time, not assumed.

### New modules (no v18 counterpart)

| Module | What it is | App state |
| --- | --- | --- |
| `patterns-core.js` (460) | The math under Patterns: one synthetic population (latent-factor, marginals matched to the feed's real splits) feeding a naive-Bayes Oracle, mutual-information Threads, and a PCA Field. Deterministic, hash-seeded. | **absent** |
| `patterns-tab.jsx` (174) | The third tab: a two-stop ruler, Oracle · Map. Chrome rules stated in the header — one sub-row, a self-retiring explainer, no type under 10.5px. | **absent** |
| `question-map.js` (277) | The Map's engine, written for a million questions: truncated SVD by power iteration, cosine over K loadings, LSH k-NN, per-pair 2×2 tables on demand. Nothing quadratic. | **absent** |
| `question-map.jsx` (129) | The Map lens — every question as a place; distance IS mutual prediction. Position/colour/size/fill/line each carry one fact, no legend. | **absent** |
| `trait-links.js` (57) | Known cross-trait correlations (openness↔authority…) checked against your results. The rule you *break* is the headline. | **absent** |
| `trait-web.jsx` (56) | "What moves together" — `trait-links` drawn on shared rails, on the profile's General panel. | **absent** |
| `nature-data.js` (16) | Born-or-built: per-dimension heritability (h²) ballparks from twin studies. Header states the framing rule: population spread, never a slice of one person. | **absent** |
| `predict-data.js` (209) | Foresight's two calls against a ten-second clock — CALL (sealed, resolves later) and READ (a slice's pick on a settled question, scored instantly off the who-voted sheet's own hash). | READ live (D126); CALL blocked on D127 |
| `predict-cards.jsx` (198) | The two feed bodies. The clock is a CSS transition, not a frame loop, and starts on visibility, not mount. | **absent** |
| `map-fore-card.jsx` (61) | The Map's Foresight leaf card — a run of hit/miss dots plus where that run sits. | **absent** |
| `paths-data.js` / `paths-card.jsx` | CROSSROADS. Carried here because the app's port (D136) came from v23, which was never extracted, and because these carry the `mapTree()` the port deliberately omitted. | ported, minus `mapTree` |
| `type-mix.js` / `type-mix.jsx` | Type chips and the shares card. Drifted past v25: the card now switches **system** (all four instruments) and persists the choice. | ported (D141) + drift |
| `pulse-data.js` / `pulse-card.jsx` | Drifted hard past v24: **five pulses, not one** (mood · energy · sleep · focus · social), each with its own **cadence** — daily · often (Mon·Wed·Fri) · weekly · off — set on the card. Pulses take their turn in the feed; no block, no tray. | ported single-pulse (D139) |
| `patterns.css` (110) | The Patterns tab's styles. | **absent** |
| `arena.css` (103) | **Orphaned — see below.** | n/a |

### Changed modules (patches in `changes/`)

| Patch | The change |
| --- | --- |
| `app-shell.jsx` (+66/−91) | Three tabs; the tweak laboratory dismantled; `window.goTrends` opens the Pulse branch of the Map. |
| `world-feed.jsx` (+415/−12) | A windowed feed (mount 8, step 4, reach 2200px); the sponsored frame; prediction cards; pulses interleaved one card in four; `predict` → the Foresight branch. |
| `world-feed-data.js` (+13) | Seven `dial`/`field` demo questions. |
| `map-tab.jsx` (+63/−5) | Three new subscriptions (PREDICT · PATHS · PULSE) and three new branch families on the constellation. |
| `map-groups.js` (+15/−2) | Two new over-categories — `g-fore` (violet 282) and `g-paths` (200) — matched by branch prefix, plus `pulse` under Self. The hue notes say why 115 and 200 were rejected. |
| `mirror-field-pops.jsx` (+48/−11) | Near's kindred go **anonymous** (silhouette, trade, age, coarse distance) and gain a mutual hide switch; type chips on field rows. |
| `mirror-field.jsx` (+3/−1) | A field portrait travels `anon: true`, so the overlay reads a real name as "Ceramicist, 29". |
| `compare-breakdown.jsx` (+23/−18) | The compare rose is redrawn again: your petal always solid to your own score, them as a washed dot per slice. Replaces v18's symmetric-gap rose. |
| `result-card.jsx` (+37) | The "Born or built" section (`nature-data.js`). |
| `group-daily.jsx` (+17/−11) | No half-washed avatars — a `sealed` state is a hue halo, so the cue is shape, not saturation. |
| `duo-daily.jsx` (+7/−6) | The redaction block becomes three word-shaped bars; sealed opacity dropped. |
| `person-mindmap.jsx` (+11/−15) | Chip rows become the swipe row (`MTSwipeRow`); serif title retired. |
| `person-overlay.jsx`, `group-mirror.jsx`, `relmap*.jsx` | Every remaining raw `oklch(0.5x …)` routed through `WPAL.ink`; the last two serif headings become sans. |
| `daily-split.jsx` (+8/−3) | The ruler's near end exits to Patterns; a `SKIP` selector stops the axis stealing drags from maps, fields and scrollers. |
| `profile-general.jsx` (+1) | Mounts `TraitWebCard`. |
| `tokens.css` | Two new tokens — `--pulse` (one hue for the whole instrument) and `--field-size: 56px` (every thumb-answered input sits on this height). `.rule-dashed` deleted. |
| `page.css` | The Patterns tab's accent (`--c-today`, "the oracle's hour"). |

### Already synced — no action

`paid-data.js`, `suggestions.js`, `suggestions.jsx`, `pulse-trends.jsx` are
**byte-identical** to `design/standalone-v24/`; `segment-explorer.jsx` is
byte-identical to `design/standalone-v25/`. They are not re-copied here.
`segment-explorer`'s v18→v28 delta (+90) is the deviation view that v25
already delivered and D-record ported.

## The one thing to ask the designer about

**`arena.css` is 103 lines of styles for a card that is not in the bundle.**
It describes a game-theory feed card in detail — a payoff matrix
(`.ar-mx`, `.ar-cell.hit`), a Nash line (`.ar-nash`), a sealed-answer
ladder with pegs (`.a2-ladder`), a pot (`.a2-pot`), a rival with a quote
(`.a2-rival`, `.a2-say`), streaks, week dots, and a manner readout
(`.ar-manner`). Verified orphaned, not inferred: no module in v28 emits an
`ar-`/`a2-` class, and neither `--ar-ink` nor `--ar-c` is defined anywhere
in the bundle. Only the `.pp-*` crossroads rules sharing that block are
live (`paths-card.jsx` uses them).

So the Arena is either a card that got left out of the export, or dead
styling from an iteration that was dropped. **Do not port it from the CSS
— a stylesheet cannot say what the game is.** The file is kept here so the
question survives the upload.

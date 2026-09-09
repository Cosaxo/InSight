# standalone v28 — the updated vision, held for porting

First extracted 2026-08-15, **re-extracted 2026-08-19 from a later build of
the same prototype** (a claude.ai bundler export; **the upload is ephemeral,
this directory is the durable record**). Same precedent as
`design/standalone-v24/` and `design/standalone-v25/`: a porting reference,
not live code. Nothing imports it, and it earns deletion when the last item
below is ported or refused.

**The 2026-08-19 build is v28 still — three tabs, same thesis — but it moved
under the plan.** Fourteen of the twenty-two patches in `changes/` were
stale, four modules are new, and one CSS block had never been recorded at
all. § "What the later build changed" at the foot is the delta; the
inventory below is the current state, not the August-15 one. The thing that
matters most for reading `docs/VISION-V28.md`: **`changes/result-card.jsx.patch`
is no longer purely the refused section**, so the standing "never apply this
one" instruction had to be narrowed to two hunks.

`design/InSight_standalone_18.html` **stays the committed reference**
until a full sync moves it (`design/README.md`'s rule). Everything here
is measured against v18, so this directory says exactly what a full sync
would have to carry.

The plan built on it — sequencing, cost, and what each item costs against
the tree's real budgets — is [`docs/VISION-V28.md`](../../docs/VISION-V28.md).

## How this was extracted

The bundle is base64+gzip assets in a `<script type="__bundler/manifest">`
block plus a `__bundler/template` the loader rewrites.

**The 2026-08-19 re-extraction did not have to guess at module identity, and
that is the one procedural thing worth keeping.** The newer export carries a
`<script type="__bundler/ext_resources">` map — `{id, uuid}` pairs where the
id is the real path (`src_patterns_core_js` → `src/patterns-core.js`) — so
all 110 modules name themselves exactly. The August-15 pass had no such map
and paired ~28 unnamed files to v18 by token overlap; where the two methods
overlap they agree, so nothing recorded then was misfiled.

**The v18 side of every patch was rebuilt rather than trusted**, because a
regenerated patch is only worth what its baseline is. v18 is the *older*
bundle format: its `ext_resources` is an empty array, module identity is the
header comment (62 of 88 self-name), the six remaining patch baselines were
paired by token overlap at 0.85–1.00, and **the app shell is not a manifest
asset at all** — it is the trailing inline `<script type="text/babel">` block
in v18's own template. The three CSS files are style blocks, not files:
`tokens.css` is the "Clean neutral modern system" block, `map.css` the "Map
tab" block, `page.css` the small trailing one — and `page.css` keeps the
leading newline after its `<style>` tag, which is load-bearing (strip it and
every hunk header shifts by one). The reconstruction was **verified, not
assumed**: both stored CSS patches and all eight unchanged JS patches apply
to it byte-for-byte.

The scratch extractor is still not kept — it is twenty lines of
`zlib.gunzipSync` over the manifest plus the `ext_resources` join, and
rewriting it beats maintaining it. The paragraph above is what makes
rewriting it cheap.

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
| `patterns-core.js` (480) | The math under Patterns: one synthetic population (latent-factor, marginals matched to the feed's real splits) feeding a naive-Bayes Oracle, mutual-information Threads, and a PCA Field. Deterministic, hash-seeded. Gained `tell()` — the single strongest piece of evidence behind one guess, computed on demand for the line the Oracle shows when you press its disc. | **absent** |
| `patterns-tab.jsx` (96) | The third tab: a two-stop ruler, Oracle · Map. Chrome rules stated in the header — one sub-row, a self-retiring explainer, no type under 10.5px. **Shrank by half**: the Oracle it used to contain inline is now its own module. | **absent** |
| `oracle.jsx` (202) **NEW** | The Oracle lens, rebuilt as **one instrument, no card**. The guess is an ink disc sealed on the seam between the two option tiles; on your tap it travels to the side it called and each tile fills to the probability it gave. Confidence is a height and a size, evidence is ink density, the verdict is a glyph — solid disc when it had you, broken open to a ring when you broke it. **No percentage is printed anywhere.** Your record is a ledger of marks on one baseline, up in accent where you broke the guess (taller = more surprising). | **absent** |
| `oracle.css` (87) **NEW** | The Oracle's own chrome, split out of `patterns.css` with the module. Carries the reason the fill is a keyframe rather than a transition: the sealed tile is a `<button>` and the revealed one a `<div>`, so the fill element is new to the DOM and a transition would never run. | **absent** |
| `question-map.js` (277) | The Map's engine, written for a million questions: truncated SVD by power iteration, cosine over K loadings, LSH k-NN, per-pair 2×2 tables on demand. Nothing quadratic. **Unchanged in the later build.** | **absent** |
| `question-map.jsx` (213) | The Map lens — every question as a place; distance IS mutual prediction. Position/colour/size/fill/line each carry one fact, no legend. **Grew +110/−26**: topic hues go muted (one quiet field instead of confetti), topic blobs sit under the points, and the selected question's card says the link out loud. | **absent** |
| `trait-links.js` (57) | Known cross-trait correlations (openness↔authority…) checked against your results. The rule you *break* is the headline. | **absent** |
| `trait-web.jsx` (56) | "What moves together" — `trait-links` drawn on shared rails, on the profile's General panel. | **absent** |
| `nature-data.js` (16) | Born-or-built: per-dimension heritability (h²) ballparks from twin studies. Header states the framing rule: population spread, never a slice of one person. | **REFUSED (D168)** — see below |
| `predict-data.js` (276) | Foresight's two calls against a ten-second clock — CALL (sealed, resolves later) and READ (a slice's pick on a settled question, scored instantly off the who-voted sheet's own hash). **Grew +80/−13**: `groupRunsOf` and `grpSkill` score you per group read rather than in aggregate, and `interleave` is the feed's own turn-taking rule. | READ **built** (D196); CALL built then retired (D194/D196) |
| `predict-cards.jsx` (198) | The two feed bodies. The clock is a CSS transition, not a frame loop, and starts on visibility, not mount. **Unchanged.** | clock deliberately **not** shipped — `ui/LiveCallCard.tsx` says why |
| `map-fore-card.jsx` (183) | The Map's Foresight leaf card. **Tripled (+140/−18)**, and the shape changed with it: a Calls leaf is a subject carrying the real events behind the run, and **Reads go a level deeper** — the cut (Gender) is a hub and the groups inside it are the leaves, so the map itself shows *who* you read best. Close and solid = sharp, far and hollow = below your average. | **absent** |
| `role-data.js` (213) **NEW** | **YOUR ROLE, as a test result.** Reads the duel record as an instrument: four dimensions per setting, matched to a named type the way every other test is. Registers into `RP_TESTS` / `IS_ARCHETYPES` / `IS_TEST_AVG` / `IS_TEST_RESULTS` under `duo` and `group` for the average, and `duo:<pid>` / `group:<gid>` for a single one — so a role card **is** a result card: same rose, same rarity, same nearby types, no new visual language. Floors at 3 revealed days (1v1) and 2 (group). | **absent** |
| `roles-panel.jsx` (124) **NEW** | The profile's **Roles tab** — a seventh subtab the app does not have. Opens with the average across your settings as a full result card, then lists every setting one row deep (mark, type, span), because a role is only interesting next to the other roles you play. | **absent** |
| `paths-data.js` / `paths-card.jsx` | CROSSROADS. Carried here because the app's port (D136) came from v23, which was never extracted, and because these carry the `mapTree()` the port deliberately omitted. | ported, minus `mapTree` |
| `type-mix.js` / `type-mix.jsx` | Type chips and the shares card. Drifted past v25: the card now switches **system** (all four instruments) and persists the choice. **Read `data/typeMix.ts` before building the switch** — `TYPE_TEST = "big5"` there is the enforcement point of a stated promise, not a default. | ported (D141) + drift |
| `pulse-data.js` / `pulse-card.jsx` | Drifted hard past v24: **five pulses, not one** (mood · energy · sleep · focus · social), each with its own **cadence** — daily · often (Mon·Wed·Fri) · weekly · off — set on the card. Pulses take their turn in the feed; no block, no tray. **Unchanged in the later build.** | ported single-pulse (D139) |
| `patterns.css` (89) | The Patterns tab shell only — ruler, sub-row, notes, and the Map lens's chrome at the foot. The Oracle's rules left with the module (`oracle.css`), which is why this shrank. | **absent** |
| `arena.css` (103) | **Orphaned — dropped by the owner (D166 §2), see below.** | n/a |

### Changed modules (patches in `changes/`)

**Counts are the 2026-08-19 build.** Rows marked ⟳ moved since the
August-15 extraction; the previous count is given so the size of the move is
visible.

| Patch | The change |
| --- | --- |
| ⟳ `app-shell.jsx` (+52/−105, was +50/−103) | Three tabs; the tweak laboratory dismantled; `window.goTrends` opens the Pulse branch of the Map. Now also **opens on Patterns** — the default tab moves `track` → `patterns` and the default Mirror stop `you` → `circle`. |
| ⟳ `world-feed.jsx` (+427/−12, was +415/−12) | A windowed feed (mount 8, step 4, reach 2200px); the sponsored frame; prediction cards; pulses interleaved one card in four; `predict` → the Foresight branch. |
| `world-feed-data.js` (+13) | Seven `dial`/`field` demo questions. |
| ⟳ `map-tab.jsx` (+142/−21, was +63/−5) | **More than doubled.** Still three new subscriptions (PREDICT · PATHS · PULSE), but Foresight and Crossroads now draw real branch trees off `PR.mapTree()` and `PW.mapTree()` — a Foresight leaf's distance from You *is* its accuracy, and a Crossroads leaf is a road taken, so both say where you stand without printing a number. |
| ⟳ `map.css` (+18) **PATCH IS NEW** | Never recorded on August 15, and it belongs with `map-tab.jsx`: accuracy rings on the Reads bullseye (`.mmt-ring`), a hub badge carrying your standing across every cut, and a hub that breathes while a read is waiting in the feed. |
| ⟳ `map-groups.js` (+15/−2, same size) | Two new over-categories — `g-fore` (violet 282) and `g-paths` (200) — matched by branch prefix, plus `pulse` under Self. **The `g-fore` label is now "Intuition", not "Foresight"**, and its note reads "how well you read groups of people" — the rename is the only change, and it is the READ half's name. |
| ⟳ `mirror-field-pops.jsx` (+50/−14, was +48/−11) | Near's kindred go **anonymous** (silhouette, trade, age) and gain a mutual hide switch; type chips on field rows. **Tightened further: distance is no longer stated at all.** The coarse bands the August-15 build kept are gone, on the stated ground that "knowing how close a stranger is, is itself a leak"; size reads alignment instead. |
| ⟳ `mirror-field.jsx` (+4/−2, was +3/−1) | A field portrait travels `anon: true`, so the overlay reads a real name as "Ceramicist, 29". The anon node's distance subtitle is now blank, with the row above. |
| `compare-breakdown.jsx` (+23/−18) | The compare rose is redrawn again: your petal always solid to your own score, them as a washed dot per slice. Replaces v18's symmetric-gap rose. |
| ⟳ `result-card.jsx` (+69/−19, was +37/−0) | **The "do not apply" instruction no longer covers the whole patch — see below.** Two hunks (46 added lines) are the refused Born-or-built section; the other six (23 lines) are a new `brief` mode — a compact result card with a small `SigEmblem`, an explain button, and the deep sections folded away until asked for. |
| ⟳ `group-daily.jsx` (+18/−12, was +17/−11) | No half-washed avatars — a `sealed` state is a hue halo, so the cue is shape, not saturation. Now also publishes `GDMark`, `GDHue` and `GDInit` for other modules to reuse. |
| `duo-daily.jsx` (+7/−6) | The redaction block becomes three word-shaped bars; sealed opacity dropped. |
| `person-mindmap.jsx` (+11/−15) | Chip rows become the swipe row (`MTSwipeRow`); serif title retired. |
| ⟳ `person-overlay.jsx` (+102/−6, was +7/−6) | Was a colour-routing patch; now carries **Receipts** — the concrete answers behind the affinity number, three matches and three splits, strongest where a shared answer is rare and a split is widest. Derived with the same seed and formula as `PersonMindMap`, so the profile, the rows and the map can never disagree about what someone said. |
| ⟳ `group-mirror.jsx` (+109/−3, was +1/−1) | Was a one-line colour fix; now carries **GroupSpread** — every verdict placed on an axis from one voice to a coin flip, because the average hid how the group actually decides. Opens on the most contested day, and marks where you sat. |
| ⟳ `relmap.jsx` (+55/−37, was +1/−2) | Was a colour fix; now a **circle-targeting rewrite**. Drag-to-recircle tested the nearest *node*, so the cluster you were dragging out of always won and only the circle beside you was reachable. It now tests one candidate per circle — its hub, or the centroid of its dots — with no distance cap. People stay unmovable: the map's geometry is the data. |
| `relmap-panels.jsx` (+2/−3) | Raw `oklch(0.5x …)` routed through `WPAL.ink`; serif headings become sans. |
| ⟳ `daily-split.jsx` (+11/−6, was +8/−3) | The ruler's near end exits to Patterns; a `SKIP` selector stops the axis stealing drags from maps, fields and scrollers. The open-test accent moves `--ochre` → the new `--test` plum. |
| `profile-general.jsx` (+1) | Mounts `TraitWebCard`. |
| ⟳ `passive-meter.jsx` (+3/−2, was +0/−1) | The header ring stops muting: it must read as the same colour as the type it stands for. |
| ⟳ `tokens.css` (+16/−10, was +12/−10) | `--pulse` (one hue for the whole instrument) and `--field-size: 56px` (every thumb-answered input sits on this height); `.rule-dashed` deleted. Adds a **`--test` / `--test-ink` plum pair** for the personality tests, and tab-bar rules for `data-n="5"` — defensive only, the shell still renders `data-n={3}`. |
| `page.css` (+2) | The Patterns tab's accent (`--c-today`, "the oracle's hour"). |

### Already synced — no action

`paid-data.js`, `suggestions.js`, `suggestions.jsx`, `pulse-trends.jsx` are
**byte-identical** to `design/standalone-v24/`; `segment-explorer.jsx` is
byte-identical to `design/standalone-v25/`. They are not re-copied here.
`segment-explorer`'s v18→v28 delta (+90) is the deviation view that v25
already delivered and D-record ported.

## `arena.css` — dropped, and kept anyway

**103 lines of styles for a card that is not in the bundle.**
It describes a game-theory feed card in detail — a payoff matrix
(`.ar-mx`, `.ar-cell.hit`), a Nash line (`.ar-nash`), a sealed-answer
ladder with pegs (`.a2-ladder`), a pot (`.a2-pot`), a rival with a quote
(`.a2-rival`, `.a2-say`), streaks, week dots, and a manner readout
(`.ar-manner`). Verified orphaned, not inferred: no module in v28 emits an
`ar-`/`a2-` class, and neither `--ar-ink` nor `--ar-c` is defined anywhere
in the bundle. Only the `.pp-*` crossroads rules sharing that block are
live (`paths-card.jsx` uses them).

**The owner has answered: dropped for now** (D166 §2 in
[`docs/DECISIONS.md`](../../docs/DECISIONS.md)). The card was dropped, not
lost in the export. Nothing to build, nothing to unwind — no app code ever
referenced it.

**The file stays** rather than being deleted along with the question. The
standalone it came from is an ephemeral upload, so this is the only
surviving description of the idea, and "dropped for now" is not "refused".
Reviving it needs a design pass that says what the *game* is — a stylesheet
cannot, which is the same reason it was never portable from what is here.

## `nature-data.js` + the `result-card.jsx` patch — refused

**Born or built is not built** ([D168](../../docs/DECISIONS.md)). The
owner's objection, on the plan's own note that this was "population
science, not user data": *that is the reason to remove it*.

Every number this app draws is recomputable from what people answered.
A heritability figure is the app asserting a fact about the world —
sourced from literature it has not read, cannot check and cannot update.
D127 already gates that class of number behind an executable rubric, and
h² has no equivalent: no rubric, no resolution, no way for the app to be
shown wrong. The refusal holds in the explain sheet as well as on the
card, so it is not a placement problem.

**The refusal is unchanged. The instruction that carried it is not, and this
is the one correction in the 2026-08-19 re-extraction that could actually
cost someone something.**

On August 15 the arithmetic was clean: `window.NATURE` is consumed by
`result-card.jsx` and nothing else, and all 37 added lines of
`changes/result-card.jsx.patch` were that section — so *"the whole
result-card patch is dropped"* was both true and safe to act on.

**The later build broke that coincidence.** The patch is now +69/−19 across
eight hunks, and only two of them are Born-or-built:

| Hunk | Lines | What it is |
| --- | --- | --- |
| `@@ -157,10 +157,38 @@` | +29 | `NatureRows` — **refused (D168)** |
| `@@ -264,6 +297,23 @@` | +17 | the "Born or built" section render — **refused (D168)** |
| the other six | +23/−19 | a new `brief` mode: a compact `SigEmblem` (76px vs 170px), an explain button in the header, and the deep sections gated behind `deep` so the card can open small |

So the standing instruction narrows: **drop those two hunks, not the file.**
Applying the whole patch ships a refused surface; skipping the whole patch
now silently drops an unrelated design change that nothing has refused.
Neither is what D168 decided, and the August-15 wording would have produced
one of them depending on which way the reader leaned.

`window.NATURE` is still consumed by `result-card.jsx` and nothing else, so
the refusal itself needs no re-litigating — dropping the two hunks leaves no
orphaned store.

**Both files stay**, like `arena.css`, and for a stronger reason: a
refusal with a stated principle is worth keeping so the idea is not
re-proposed as new. What D168 does *not* refuse is also recorded there —
authored content (question banks, archetypes, scenes) is the app's
prompts rather than its findings, and a future sourced, external,
clearly-labelled reading would need its own decision, not this one
relaxed.

## What the later build changed

The 2026-08-19 re-extraction against the same v18 baseline. **The thesis did
not move** — still `patterns · daily · mirror`, still `data-n={3}`, still the
same five Mirror stops — so nothing here reopens D166 §1. What moved is how
much of v28 is drawn, and in two places what it promises.

**Four modules are new.** `oracle.jsx` + `oracle.css` (the Oracle rebuilt as
one instrument, extracted from `patterns-tab.jsx`, which halved), and
`role-data.js` + `roles-panel.jsx` — Roles, which is new to this directory
*and* to the plan: `docs/VISION-V28.md` has no section for it because the
August-15 build had no such file.

**Fourteen of twenty-two patches were stale, and three had changed
character** rather than merely grown — a colour fix on August 15 is now a
feature on each:

| Patch | Was | Is |
| --- | --- | --- |
| `group-mirror.jsx` | +1/−1 colour | +109/−3 — GroupSpread, how the group decides |
| `person-overlay.jsx` | +7/−6 colour | +102/−6 — Receipts, the answers behind the number |
| `relmap.jsx` | +1/−2 colour | +55/−37 — the drag-to-recircle hit test rewritten |

**One CSS block had never been recorded** — the Map tab's, now
`changes/map.css.patch` (+18). It is not new to the later build; it was
missed on August 15, and it belongs with `map-tab.jsx`, which is also the
patch that grew most (+63/−5 → +142/−21).

**Two changes are promises rather than pixels, and both tighten:**

- **Near stops stating distance at all.** August 15 recorded coarse bands
  (`'a few streets away'`, `'in the neighbourhood'`); the later build removes
  them, on the ground that *"knowing how close a stranger is, is itself a
  leak"*. Size reads alignment instead. This runs the same direction as the
  presence cell's deny in `firestore.rules` and costs nothing to honour.
- **`g-fore` is renamed Foresight → "Intuition"**, noted as "how well you
  read groups of people". That is the READ half's name, and READ is the half
  that shipped (D196) after CALL was retired — so the rename agrees with
  where the app actually landed.

**What did not move**, re-verified rather than carried forward:
`question-map.js`, `predict-cards.jsx`, `pulse-data.js`, `pulse-card.jsx`,
`trait-links.js`, `trait-web.jsx`, `nature-data.js`, `type-mix.jsx`,
`paths-*`, `arena.css`, and the eight unchanged patches. `paid-data.js`,
`suggestions.*` and `pulse-trends.jsx` are still byte-identical to v24, and
`segment-explorer.jsx` to v25.

**The Born-or-built refusal (D168) stands and is not reopened by any of
this** — but the instruction carrying it had to be narrowed; see the section
above. That is the one item here where acting on the August-15 text would
now produce a wrong result.

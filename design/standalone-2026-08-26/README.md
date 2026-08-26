# The 2026-08-26 standalone — anonymous answers, the shop window, and the Oracle's working

The owner's `InSight_4.html` upload of 2026-08-26 (a full `__bundler`
standalone, 187 assets), the fourth in the numbered series after
`InSight_1` (→ `standalone-2026-08-20/`), `InSight_2`
(→ `standalone-2026-08-22/`) and `InSight_3` (→ `standalone-2026-08-24/`).
The upload is ephemeral; this directory is the durable record, per the
family's standing rule (`design/README.md`). The plan built on it — every
item measured against the tree, with its backend half named — is
[`docs/VISION-2026-08-26.md`](../../docs/VISION-2026-08-26.md).

`design/InSight_standalone_18.html` **stays the committed reference**
until a full sync moves it (`design/README.md`'s rule). This directory,
like its siblings, does not re-point it.

## How this was extracted, and what it was measured against

124 assets are named by the bundle's `ext_resources` map (61 source
components, their 61 builds, the Babel vendor and the build manifest);
63 more are referenced only by the template's own script tags — the data
modules, the interaction helpers, vendor React and eight Hanken Grotesk
woff2 faces whose manifest entries say `image/png` (they are fonts;
trust the bytes, not the mime). The 08-24 README predicted this second
class; the mislabelled mimes are this extraction's contribution to the
next extractor's expectations.

Every module was diffed against the **latest recorded state of the same
module**: v18 + `standalone-v28/changes/` patches where those exist,
`standalone-v28/`'s whole files, the v24 / v25 / 08-20 / 08-22 / 08-24
extractions where those supersede, **plus the 08-24 README's verbatim
micro-hunks applied** — nine files whose changes that README recorded as
diffs rather than copies are part of the recorded state too, and a
baseline that skips them re-reports every one of them as new. Against
that baseline **92 modules are byte-identical**, one module is new
(`catalog-sheet.jsx` — the two extra assets over `InSight_3`'s 185 are
exactly its source + build pair), and 26 files moved, most by one
feature's worth of lines.

Two of the 26 are **the 08-24 record catching up, not 08-26 moves**:
`predict-data.js` (the Intuition branch's `ring: true` removed, its map
comments rewritten) and `map-layout.js` (the `cat.ring` bullseye layout)
were both described in prose by the 08-24 README's "tried and rolled
back" section and never carried as files — so they diff against every
committed copy while matching what that README says `InSight_3` already
held. They are committed here whole so the record of both is byte-level
from now on. The bullseye still has no declaring branch; the 08-24
verdict (**do not port the layout**) stands unchanged.

## The files here, and where each would land

| File | What it is | Where it lands |
| --- | --- | --- |
| `catalog-sheet.jsx` | **NEW — the shop window** (PAID-PLAN §5's catalog + §7's missing room, as one read-only overlay): metrics grouped by place with active / pledged / inactive states, the co-funding arithmetic said in one card (panel × the posted line, −20%, split evenly, seat floor), the one-off market's rate table with the max-of-parents intersection row, the author-a-metric card ("kept neutral by editorial … the scorecard set stays editorial and unbuyable"), and the contract path as two mail addresses — "no checkout here, deliberately". `focus="author"` leads with the author card | New overlay beside `ui/AskedByYouOverlay.tsx`; the plan §2 has the build and the decisions it waits on |
| `paid-data.js` | The market grows its law: intersections price at the **max of their parents' indices** ("a thin cell is never a discount"), `minTicket` (the 500-answer floor × the line), `shareCap` 0.3 (no buyer holds more than 30% of a cohort's person-days in a window), a per-purchase `atClose` choice (extend free / settle for what arrived) with the locked index printed; **`SUB`** — subscriptions repriced as a forward contract whose period cost **splits evenly across subscribers** (€24 seat floor, pledges activate inactive metrics); **`CATALOG`** — the demo metric list behind the sheet | Reference for `data/pricing.ts` + `content/pricing.json` growth and the PAID-PLAN §5/§6 amendments the plan asks for; the demo `CATALOG` never ships (D167) |
| `asked-by-you.jsx` | The buyer's room learns the same law: the budget line prints the locked rate ("bills €0.16 / answer, ×1.0 locked at booking"), an `atClose` sentence under the window, and the subscription cards go co-funded — seats in the kicker, "your seat €X of €Y, split N ways", a **seat lapse** distinct from a series lapse (others still fund it → the series runs on, dimmed past your exit; yours was the last seat → paused, history kept), rejoin priced at the recomputed split | `ui/AskedByYouOverlay.tsx` (supersedes the 08-24 copy); the seat states are design for PAID-PLAN §5's build, not for the stated-line rows shipped at D288 |
| `mirror-answers.jsx` | Two independent moves: the answers browser marks **anonymously-answered questions** (the glasses glyph replaces your accent dot, plus a one-line note), and the place stops (City / Country / World) gain **"Asked for {place}"** — the paid tail under the answer record: PAID question rows onto the report, active METRIC rows onto the catalog, an honest empty state, and the "Ask {place} a question →" door. Its comment cites the tail-never-core rule (D228's boundary, the prototype's "law 02") | The anon mark rides the plan §1 decision; the paid tail is §2's Mirror mounting question — D228 reserved it for "when a real subscription exists" |
| `oracle.jsx` + `oracle.css` | **The working**: "why?" stops showing one echoed tell and rebuilds the sealed call in the open — up to three of your prior answers, each with the crowd split it contributed as a bar against the coin hairline, weighted by its actual pull, under the basis line "sealed before your tap · counted only from answers you'd already given · the mark is the coin"; the empty case says it guessed at the coin. Plus `.or-cap` — a standing one-line key under both ledgers (the one-time hints taught it; this keeps it true) — the dashed landing seat sized to the disc via `--d`, and the tile's label centred by grid row | `ui/PatternsOracle.tsx` + `ui/patterns.css`; the working is a client fold over the device solve the lens already runs — plan §3 |
| `patterns-core.js` (patch) | The engine behind it: `_oracle` keeps its per-question contributions, and `working(qid)` re-solves with the target question held out, filters to contributions that actually point at the call, and returns the top rows with their tells | `src/v2/data/patterns.ts` — the solve is the same one the seal used; the seal's pinned timing must not move |
| `patterns-tab.jsx` + `patterns.css` | Lens swaps **slide from the side you moved toward** on the ruler ("the axis is a place, not a list"; reduced-motion collapses it); `.pt-pop` chips stop wrapping mid-label | `ui/PatternsTab.tsx` + `ui/patterns.css` |
| `question-map.jsx` | The "answer next" beacon becomes a **tap target** (≥14px halo, opens the pick sheet); the legend stops saying "lit" ("answered", "a person"); both bottom cards state their basis in words — "Close together = answers that predict each other · drawn from the crowd's latest answers", and the tie panel adds "Each tie is a straight count over everyone who answered both" | `ui/PatternsMap.tsx` (supersedes the 08-24 copy) |
| `people-lens.jsx` | The selected person wears their dot's hue (identity dot by the name, the agreement bar in the same hue), the legend explains itself ("fainter = fewer shared answers"), and the card states its two claims: "That count alone places them · closer only ever means more agreement", "Close together = answers alike · drawn from the crowd's latest answers" | `ui/PatternsPeople.tsx` (supersedes the 08-24 copy) |
| `role-data.js` | **The instruments turned toward one person**: `duoDimsTheirs` (their vantage of your shared 1v1 — sides swapped), `groupDimsFor` (one member's own alignment / pull / crowns / steadiness in one group), `personTypes(pid)` — the nearest named duo and group type for someone else, blended across shared groups, self-healing when the archetype registries raced module load | `spec/role-data.js`; feeds the person overlay's Play together card — plan §5 |
| `app.jsx` | Shell wiring: `openCatalog(focus)` beside the other paid doors, the two catalog overlay slots | `spec/app-shell.jsx` |
| `place-stats.jsx` | The scorecard's foot gains "+ Author a metric for {place}" onto the catalog's author card, with the honesty caption ("this set stays editorial — authored metrics list in the catalog and run once funded") | `spec/place-stats.jsx` (supersedes the 08-24 copy) + the live ScoresLens foot |
| `predict-data.js` + `map-layout.js` | The 08-24 prose record, committed as bytes — see above. **Do not port the bullseye**; nothing declares `ring` | — |

## The patches in `changes/`, and what each carries

Nine files moved by one feature's worth of lines inside thousands of
unchanged ones, so — the v28 device — they are recorded as unified
diffs whose left side is the **latest recorded state** described above,
not any single committed file. Apply them mentally, not mechanically.

| Patch | What it carries |
| --- | --- |
| `world-feed.jsx.patch` | The two big feed moves. **Anonymous voting** (`insight.feedAnon.v1`): a 20px glasses toggle in the card header while the question is open, a quiet stamp once answered — "your pick still moves the count, but carries no name into takes, faces, or friend cuts". **Friend participation** (`wfDid`): a friend appears on a question ONLY if they answered it — most cards carry 0–2 friends, many none, "that silence is what keeps friend marks from becoming furniture" — threaded through the option-row marks (now real mini avatars in each friend's own hue, two + overflow), the friends cut, the rank grid, the dial/rate variants, and the stats sheet (which now also names who hasn't answered); a `friends` opt (`rows` default / `footer` / `off`) with the footer placement docked by the vote count; the insight line goes singular ("Alex disagrees") and stops double-saying what rows mode already shows |
| `daily-split.jsx.patch` | The same anonymous toggle on the daily's world card, writing through `DAILYQ.answer(id, choice, anon)` to the shared store |
| `daily-questions.js.patch` | That store: `insight.dailyq.anon.v1`, `answer` gains the flag, `isAnon`/`setAnon` — "they still count, but stay off your public map" |
| `result-card.jsx.patch` + `test-overlay.jsx.patch` | **Result privacy** — `window.TEST_PRIVACY` (`insight.testPrivate.v1`), "same contract as anonymous answers: default public; a private result stays yours"; a 20px toggle on the result banner, a private stamp beside the taken-date in the tests list |
| `person-overlay.jsx.patch` | **Play together** — the doors card between receipts and the 1v1 record: a 1v1 row (Open / invited-waiting / Start / "for friends — add them first") and a Groups row (shared-group chips, or add-to-group chips for a friend), each prefixed with the person's nearest named type from `ROLES.personTypes` |
| `duo-daily.jsx.patch` + `group-daily.jsx.patch` | Where those doors land: `DUO_FOCUS` / `GROUP_FOCUS` select-and-scroll, asserted repeatedly for a beat because scroll-memory's restore undoes a one-shot jump — the same race `profile-overlay.jsx`'s 08-24 fix described, now on two more scrollers |
| `patterns-core.js.patch` | See the table above |

## The changes small enough to carry whole, right here

**`person-mind-map.jsx`** — a one-line fix: a still (the small crop the
person overlay embeds) was returning the kept-label set, so leaf labels
could survive into a rendering whose own comment says branch names only:

```diff
-    if (still) return keep;   // a still shows branch names only
+    if (still) return new Set();   // a still shows branch names only
```

**`paid-report.jsx`** — the shelf's "the room →" button (added 08-24)
dresses up: `--accent-ink`, 12.5/800, instead of inheriting the heading's
font in `--ink-3`:

```diff
-          <button className="press" onClick={() => window.openAskedByYou && window.openAskedByYou()} style={{ border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'var(--ink-3)', cursor: 'pointer' }}>the room →</button>
+          <button className="press" onClick={() => window.openAskedByYou && window.openAskedByYou()} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, color: 'var(--accent-ink)' }}>the room →</button>
```

**`tokens.css`** — the Patterns tab stops wearing the daily's dusk
indigo: the nested accent override (added by v28's `page.css.patch`) is
deleted, so the tab falls back to the app's base sienna
(`--accent: var(--c-around)`):

```diff
-  /* patterns tab — dusk indigo, the oracle's hour */
-  .app[data-tab="patterns"] { --accent: var(--c-today); }
```

The app sets the same override inline
(`spec/app-shell.jsx`, the `data-tab` ternary), so the port is deleting
that arm — one expression, judged at a screen.

## Verified unchanged — do not re-extract, do not re-plan

Byte-identical to their latest recorded state, checked file by file: the
group/1v1 daily beyond the focus hunks (`duels-data`,
`daily-questions`'s question bank), the whole Map family
(`map-constellation`, anchors, branches, groups, chips, bottom-card,
people, learn-card, group-stats, `map-fore-card`), the relationship map
(core, main, panels, lenses), `person-overlay` beyond its one new card,
`result-rose`, `type-marks`, `type-mix`, `trait-web`, `roles-panel`,
`pulse-*`, `paths-*`, `segment-explorer`, `suggestions` (both files —
the paid door is exactly the 08-24 record), `general-tab`,
`profile-overlay`, `explain-sheet`, `mirror-field`, `mirror-field-pops`,
`mirror-tab`, `question-map.js` (the engine — only the `.jsx` moved),
`learn-*`, `lens-defs`, `test-defs`, `logic-raven`, `consequence-beat`,
`read-run`, `passive-meter`, `demographics`, `city-overlay`,
`search-overlay`, `shared-primitives`, `viz-primitives`,
`world-palette`, `world-feed-*` data modules, `feed-read`, `sample-data`,
`scenes`, `follows`, the interaction helpers (haptics, sheets, scroll,
swipe, subnav, edge-fade), `iOS.jsx`, `tweaks-panel`, `map.css`,
`arena.css`, the rest of the tokens block, and the fonts the app already
embeds. The oracle sub-row's "N from feed votes" is still in the design;
D287's refusal (the live store cannot honestly produce it) still governs
the port.

No app code references this directory; it is provenance, like every
other `design/standalone-*`.

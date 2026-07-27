# The frozen design spec

`InSight_standalone_9.html` is the reference design for InSight v2 — the
version the product is being built to. It is a self-contained prototype
(React + Babel compiled in-browser, all data mocked): open it in any browser
and it runs. Treat it as **read-only**: design iteration in worksheets ended
with this file, and changes from here happen in the real codebase.

What it specifies: two tabs (**daily** · **mirror**), the daily's three modes
(World blind-vote / Group / 1v1 duels with sealed next-day reveals), the
question feed with passive test cards, the Mirror telescope
(You · Circle · Groups · Near · World), archetype result cards, scenes, the
profile, and the full visual language (tokens, type, per-population accents).

## spec-modules/

The prototype's modules, extracted from the bundle and given readable names —
this is what you port from. Naming notes:

- `app-shell.jsx` — the root App: tabs, overlay routing, migrations.
- `daily-split.jsx`, `group-daily.jsx`, `duo-daily.jsx`, `world-feed*.js(x)`,
  `duels-data.js`, `consequence-beat.jsx` — the daily tab.
- `mirror-*.jsx`, `map-*.js(x)`, `segment-explorer.jsx`, `relmap*` — the
  mirror tab and its five populations.
- `passive-*.js(x)`, `test-feed-data.js`, `test-definitions.js`,
  `archetype-data.js`, `result-*.jsx`, `test-*.jsx`, `logic-test.jsx` — the
  test system.
- `sample-data.js` — the demo dataset (`window.IS_DATA`); its shapes become
  TypeScript interfaces during the port.
- `legacy-tabs.jsx`, `city-overlay.jsx`, `city-world-extras.jsx`,
  `tab-area.jsx`, `demographics.*`, `feeds.jsx`, `insights`-adjacent modules —
  carried in the bundle but superseded by the two-tab design; port only what
  a live surface actually reaches.

React/ReactDOM UMD builds and the Babel helper license are omitted.

Canonical launch content (question banks, archetypes, scenes) is extracted to
[`/content`](../content/) — edit it there, not here.

Binding product decisions, including what is deliberately *not* in v1, live
in [`docs/DECISIONS.md`](../docs/DECISIONS.md).

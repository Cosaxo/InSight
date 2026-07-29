# The frozen design spec

**`InSight_standalone_14.html` is the reference design** — the version the
product is built to. `InSight_standalone_9.html` is the earlier reference,
kept for history; it is **not** what the app should look like, and this
file named it as the target for longer than it should have. If you are
porting, port from 14.

Both are self-contained prototypes (React + Babel compiled in-browser, all
data mocked): open either in a browser and it runs. Treat them as
**read-only** — design iteration ended with these files, and changes from
here happen in the real codebase.

What v14 specifies: two tabs (**daily** · **mirror**), the daily's three
modes (World blind-vote / Group / 1v1 duels with sealed next-day reveals)
switched from a row that lives *in the app header*, the question feed with
passive test and lens cards on bare card grounds, the Mirror telescope as
one graduated seven-stop axis (You · Circle · Groups · Near · City ·
Country · World), archetype result cards, scenes, the profile, and the full
visual language (tokens, type, per-population accents).

## Checking the app against it

Do not do this by eye. Several rounds of screenshot-comparison missed a
30px headline rendering at 26px, a chip carrying a chevron the prototype
does not have, and — the one that mattered — five feed cards that never
rendered at all. `scripts/style-diff.mjs` walks both builds and reports
every element whose typography, colour or geometry disagrees, plus every
string the prototype renders and the app does not:

```
npm run dev                      # in another shell
npm i --no-save playwright       # not a repo dependency, on purpose
node scripts/style-diff.mjs
```

The script's header lists the divergences that are deliberate. Everything
else it reports is a miss.

## Where the app is allowed to differ

The prototype has no backend, so it never faces the k-anonymity floor, and
some of what it draws would be a disclosure here. Those divergences are
recorded as decisions, not left to taste — see `docs/DECISIONS.md`, in
particular D1 (takes and named who-voted are circle-scoped), D9 (Near is
your city, so live mode drops the City stop) and D11 (which prototype
features are demo-only, and why they are unreachable rather than merely
switched off).

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

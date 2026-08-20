# The People lens standalone — 2026-08-20

The owner's `InSight_1.html` upload of 2026-08-20 (a full `__bundler`
standalone, 170 modules), from which **only the People lens** was
extracted here. The upload is ephemeral; these two files are the
surviving description of what was ported and of the shell it plugs into:

| File | What it is | Fate |
| --- | --- | --- |
| `people-lens.jsx` | The People lens: the crowd as a shared map with no centre — dots, labels, cards, empty states, and the honesty rules stated in its own header | **Ported at D214** → `src/v2/ui/PatternsPeople.tsx` + `src/v2/data/peopleMap.ts`, with the engine replaced: the simulated crowd (`h01` activity, invented `NAMES`) became real voter rows and a device-side solve, per D167 |
| `patterns-tab.jsx` | The tab shell the lens sits in: three-lens ruler, one `pt-sub` row (topic chips · population chips · oracle progress), notes | **Reference only.** The shipped tab (`src/v2/ui/PatternsTab.tsx`) took the `LENSES` entry, the People note and the lens order; the sub-row, its population chips (`PAT.pops()`), and the reshaped Map/Oracle it pairs with are NOT ported |

What the same upload also contained, deliberately not taken at D214 and
not extracted here: a reshaped Map lens (`.qm-*` — tie rails, topic
chips, a legend key), a rebuilt Oracle (`.or-*` — one two-tile
instrument, "nothing here prints a number"), and per-population People
views (world · circle). Each is a real design with no plan or decision
behind it yet; if one is picked up, re-extract from a then-current
standalone rather than trusting this snapshot to still be the owner's
intent.

Two prototype behaviours the port refused, recorded in the shipped
files' comments: invented names for nameless accounts (live reads
"Someone", the who-voted convention), and a placement floor computed
against unbounded simulated activity (live transposes the ratio onto the
bounded fetch horizon — `data/peopleMap.ts` says why).

No app code references this directory; it is provenance, like every
other `design/standalone-*`.

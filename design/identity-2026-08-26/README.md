# The identity canvas — the iris mark (D300)

`Logo_and_Name.dc.html` is the owner's 2026-08-26 identity canvas,
committed verbatim: the upload is ephemeral, this directory is the
durable record — same rule as the `standalone-*` series. It specifies
the iris mark (full and compact variants), both palettes (paper and
ink-tile), the lockups, and the two size rules the implementation
follows: full mark above ~24 px, compact below; ink tile is the primary
icon, paper tile for light contexts.

Read it in a browser as-is. It is a design-canvas document (`.dc.html`),
so the canvas runtime script it loads is absent here and the `{{ … }}`
bindings will not resolve — every styled value doubles as a
literal-then-binding declaration on purpose, so the page renders
correctly with the literals; only the dark-ground toggle is lost.

Where each card went:

| Card | What it specifies | The live artifact |
| --- | --- | --- |
| 3a | Lockups (stacked · horizontal), wordmark rules | `LiveSignInGate.tsx` + `web/join.html` (stacked), `app-shell.jsx` header (horizontal) |
| 3b | App icon on ink/paper tiles at real sizes | `design/icon/mark.svg` → `scripts/gen-icons.mjs` rasters; `public/favicon.svg` |
| 3c | Compact mark, the ~24 px switch rule | `public/favicon.svg` = `web/favicon.svg`, the header lockup |

The oklch→hex conversions and both palettes are documented where they
are consumed, in `design/icon/mark.svg`'s header. Treat this directory
as **read-only reference**: identity iteration from here happens in the
real assets, and D300 records what shipped and why.

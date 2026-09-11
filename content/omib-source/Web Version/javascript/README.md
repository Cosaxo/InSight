`svg.js` is deliberately NOT vendored here.

The bank's reference implementation loads svg.js v3.1.2 (MIT, Wout Fierens)
as a minified bundle. Nothing in this repository runs that implementation —
it is kept as provenance for `drawing.js`, whose element table is the join
`scripts/build-omib.mjs` reads the artwork through — so committing a copy of
a public npm package bought nothing and put an opaque third-party blob in
the tree. `index.html`, `matrices.css` and `drawing.js` are the bank's own
files and are kept in full.

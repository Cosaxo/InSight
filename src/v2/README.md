# InSight v2 — the ported app

This is the frozen spec (`design/InSight_standalone_9.html`) running under
Vite. `index.html` points at `main.jsx`; the journal-era app lives in
`src/legacy/` (decision D4) and is no longer reachable from the entry.

## How the port works

The prototype ran as ~65 `<script type="text/babel">` tags sharing one
global scope — components and data stores reference each other as bare
globals (`MirrorTab`, `window.DUELS`, …). The port preserves those
semantics instead of hand-converting 65 files to ESM at once:

- `spec/*.jsx|js` — the modules, mechanically transformed
  (`import React` prepended; every top-level declaration registered on
  `globalThis` via guarded assignments that skip block-scoped false
  positives).
- `spec-index.js` — imports the modules in the standalone's exact script
  order. **Order is semantic** (later modules read globals set by earlier
  ones); never sort or tree-shake this list.
- `main.jsx` — styles + spec-index, then renders `globalThis.App`.
- `styles.css` — every style block from the standalone verbatim; font URLs
  point at `/public/fonts/*.woff2` (Hanken Grotesk, bundled — no external
  font hosts).
- `types.ts` — the domain contract, matching `/content/*.json`. The live
  data layer (Phase 2) implements these types.

Regenerating: the transform lives in the session scratchpad
(`transform.cjs`); its inputs are `design/spec-modules/` + the load order.
Prefer editing `spec/` files directly from here on — the design is frozen,
so regeneration should never be needed again.

## Migration path (Phase 2+)

Modules migrate off the global-scope bridge incrementally: when a module
gets real data or typing, convert it to proper imports/exports and remove
it from `spec-index.js`'s implicit dependency web. The mock data stores
(`sample-data.js`, `duels-data.js`, `daily-questions.js`, `passive-progress.js`,
`scenes.js`, `follows.js`) are the seams where Firestore plugs in — each
already funnels all reads/writes through one `window.*` API object.

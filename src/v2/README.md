# InSight v2 — the ported app

This is the frozen spec (`design/InSight_standalone_15.html`) running under
Vite. `index.html` points at `main.jsx`; the journal-era app lives in
git history (decision D4) — `src/legacy/` was deleted after Phase 5 shipped,
and its Firestore rules were retired to `firestore.rules.v1-archive`.

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
- `data/` and `ui/` — the typed layer. `data/live.ts` is the live store;
  `data/deck.ts` holds its pure, firebase-free shaping logic (hence
  unit-testable); `ui/` holds the two hand-written TSX panels.

  These are **not** exempt from the globals convention, despite being
  typed: `live.ts` ends by publishing `window.LIVE`, and both `ui/` panels
  `Object.assign` themselves onto `globalThis`, because spec modules look
  them up **by name at render time**. `check-spec-globals.mjs` scans them
  for that reason. What IS different is that their internals are typed and
  `tsc -b` checks them — the spec layer's are not.

  The `window.LIVE` member surface is pinned by a test
  (`data/vote.test.ts`, "window.LIVE public surface"): renaming a member
  there passes tsc, eslint and check:globals, then blanks the Map on a
  device, so the key set is asserted against a checked-in literal.

Regeneration is no longer possible and no longer meaningful: the
extracted prototype modules (`design/spec-modules/`) were deleted once the
port was complete and they had diverged — the `spec/` files ARE the
source now, hand-edits and all. Compare against the prototype with
`scripts/style-diff.mjs`, not by re-porting.

## Lint suppressions

21 files in `spec/` used to open with a bare `/* eslint-disable */`,
covering 7,743 of the layer's 18,553 lines — including the five largest
components. That is the opposite of what CLAUDE.md asks for, and it was
load-bearing in the worst way: a blanket directive also turns off
`no-undef`, the rule that exists here because two `ReferenceError`s
shipped, and `--report-unused-disable-directives` structurally cannot
flag a file-level disable, so `npm run lint` going green said nothing
about 42% of the layer.

They are gone. Removing them turned out **not** to disturb the
shared-global convention at all — `no-undef` reports zero problems across
all 21 files, because `scripts/spec-globals.mjs` already seeds every
legitimate global into both the checker and the eslint config. What the
blankets were actually hiding was 60 React findings.

18 of those were fixed outright: three conditional-hook calls in
`person-overlay.jsx` (hooks hoisted above an early return), 14 empty
`catch` blocks (now carrying the reason they are empty), and one bare
U+2004 in JSX text.

The remaining 42 carry a targeted `eslint-disable-next-line` naming the
one rule, so each is individually visible and greppable:

```bash
git grep -c "eslint-disable-next-line" -- src/v2/spec   # the live count
```

They are **deferred, not judged correct**. They are React Compiler
findings — `exhaustive-deps`, `refs`, `purity`,
`preserve-manual-memoization` — in JSX ported verbatim from the frozen
prototype, and there is no DOM test infrastructure in this repo to catch
a regression if the render logic is restructured. Changing effect
re-run timing blind is a worse trade than recording the debt. The
exception is `react-hooks/purity` in `person-mindmap.jsx`, which is a
false positive with a specific note at each site: those are
`performance.now()` calls inside pointer and rAF handlers, not render.

Whoever adds DOM tests should start here — the list is the work queue.
Do not reintroduce a file-level disable to quiet a new finding; that is
the failure mode this section exists to prevent.

## Migration path (Phase 2+)

Modules migrate off the global-scope bridge incrementally: when a module
gets real data or typing, convert it to proper imports/exports and remove
it from `spec-index.js`'s implicit dependency web. The mock data stores
(`sample-data.js`, `duels-data.js`, `daily-questions.js`, `passive-progress.js`,
`scenes.js`, `follows.js`) are the seams where Firestore plugs in — each
already funnels all reads/writes through one `window.*` API object.

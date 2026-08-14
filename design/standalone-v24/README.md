# standalone v24 — the commissioned design modules, held for porting

Extracted 2026-08-14 from the designer's `InSight_standalone_24.html`
(a claude.ai bundler export; the upload itself is ephemeral, this copy is
the durable record). These are the `docs/NEXT-FUNCTIONALITY.md` §8
handoff items, delivered as prototype modules in the standalone's
global-scope convention.

**This directory is a PORTING REFERENCE, not live code.** Nothing
imports it. The precedent is `design/spec-modules/` — deleted 2026-07-29
once its port completed and the copies had diverged — and this directory
earns the same deletion when the last module below is ported. Ports
arrive as typed modules under `src/v2/ui` / `src/v2/data` (or as
conversions of the spec files they replace), never as new spec-layer
globals: `check:globals` rule 4 only goes down.

| Module | Brief item | Port status |
| --- | --- | --- |
| `suggestions.js` / `suggestions.jsx` | §8 item 4 — board live states, hint pickers, the paid door | **ported** (same-day): the live wiring rides D138's backend |
| `pulse-card.jsx` / `pulse-data.js` / `pulse-trends.jsx` | §8 item 1 — the pulse card + Trends reading | **ported** (D139): `data/pulse.ts` + `ui/PulseCard.tsx` + `ui/PulseTrends.tsx`; the `mapTree` half stays unported (the Map's seventh category is its own decision) |
| `type-mix.js` / `type-mix.jsx` | §8 item 2 — type chips + the People type filter | **ported** (D141), then superseded by v25's shares-only card — see `design/standalone-v25/` |
| `paid-data.js` | §8 item 3 — the sponsored/PAID chrome | waiting on the paid path's first build (§6) |

Worth reading before any port: the pulse and type-mix headers carry the
honesty rules as design decisions (no smoothing, absent ≠ zero, every
reading with its n, a stated basis for every count) — those lines are
the contract the live components must keep, not decoration.

The standalone also carries modules this repo has never synced and does
not currently want: `predict-cards.jsx`/`predict-data.js` are v19's
Foresight cards whose READ half shipped properly at D126 (real cells,
not the prototype's hash) and whose CALL half waits on D127's rubric
machinery; `paths-*` (CROSSROADS), `trait-web`/`trait-links`,
`nature-data` and `test-feed-data` are unsynced prototype vintages —
each would need its own decision, none is commissioned work, and none is
copied here.

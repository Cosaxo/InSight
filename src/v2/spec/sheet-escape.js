// Ported from design/InSight_standalone_17.html (sheet-escape.js). THIS file
// is the live source now, hand-edits and all. Side effects only — it exports
// nothing and publishes nothing, so its spec-index.js line is the whole of its
// wiring.

// sheet-escape.js — Escape closes the topmost bottom sheet.
// The sheets across the app were tap-the-scrim only. Each already owns its own
// close path — and its own closing animation — on the scrim's click handler, so
// rather than teach every component a key, we forward Escape to the topmost
// scrim's own click. One rule, every sheet, no duplicated state.
//
// This repo's `Sheet` primitive (primitives.jsx) already gives the seven
// wf-scrim sheets a focus trap and its own Escape (D24), and that one runs
// first: it stops propagation, so this listener never sees the key for a sheet
// that handles it. What is left for this file is every OTHER wf-scrim — the
// ones a component still hand-rolls — plus a sheet that happens to have focus
// outside its own subtree.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  const scrims = document.querySelectorAll('.wf-scrim:not(.is-closing)');
  if (!scrims.length) return;
  const top = scrims[scrims.length - 1];
  e.preventDefault();
  e.stopPropagation();
  top.click();
});

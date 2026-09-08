// Ported from design/spec-modules/map-branches.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
// The taxonomy only — NOT daily-questions.js. This module is in the entry
// chunk, so importing DAILYQ here put that file's 36 KB demo archive (the
// one the question farm grows every day) into first paint for a list of
// labels and hues. daily-cats.js is that list, and nothing else — the
// seven emergent tops; the seven seed branches are the literal below, and
// fourteen is the two together (D421 — the count used to be attached to
// EMERGENT_CATS alone, in both files).
import { EMERGENT_CATS } from './daily-cats.js';

// InSight — Map branches: the shared category list for the Map tab (and the
// per-person mini-maps). The old statistical lens engine is gone — answers now
// read against the profile anchors instead (see map-anchors.js).
// Exported (D354's sweep) — map-tab and person-mindmap import it.
export let MapLens;
(function () {
  const CATS = [
    { id: 'health',    label: 'Body & Health',      hue: 150 },
    { id: 'craft',     label: 'Skills',             hue: 40  },
    { id: 'interests', label: 'Interests',          hue: 78  },
    { id: 'home',      label: 'Home & City',        hue: 110 },
    { id: 'story',     label: 'Story & Milestones', hue: 320 },
    { id: 'goals',     label: 'Goals & Dreams',     hue: 240 },
    { id: 'values',    label: 'Values',             hue: 356 },
  ];
  // Topical branches the Daily-Question system grows into the map (Sport, Film, …).
  // No Array.isArray guard: this was `DAILYQ.EMERGENT_CATS` off the bridge,
  // where the array genuinely could be absent at module-evaluation time
  // (D354's conversion, and the module-evaluation-order trap this file is
  // the standing example of). An imported binding cannot be unset, so the
  // guard was the load-order condition outliving the load order — the
  // shape CLAUDE.md's conversion rule names, swept at D421. The inner
  // dedup stays: that one is a data condition.
  EMERGENT_CATS.forEach((c) => { if (!CATS.some((x) => x.id === c.id)) CATS.push({ id: c.id, label: c.label, hue: c.hue }); });

  function buildById(nodes) {
    const byId = { root: { id: 'root', parentId: null } };
    CATS.forEach((c) => (byId[c.id] = { id: c.id, parentId: 'root' }));
    nodes.forEach((n) => (byId[n.id] = n));
    return byId;
  }
  function topCat(node, byId) {
    let cur = node;
    while (cur && cur.parentId && cur.parentId !== 'root') cur = byId[cur.parentId];
    return cur ? cur.id : null;
  }

  MapLens = { CATS, topCat, buildById };
})();


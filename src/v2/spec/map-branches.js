// Ported from design/spec-modules/map-branches.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import { DAILYQ } from './daily-questions.js';

// InSight — Map branches: the shared category list for the Map tab (and the
// per-person mini-maps). The old statistical lens engine is gone — answers now
// read against the profile anchors instead (see map-anchors.js).
// Exported (D352's sweep) — map-tab and person-mindmap import it.
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
  if (Array.isArray(DAILYQ.EMERGENT_CATS)) {
    DAILYQ.EMERGENT_CATS.forEach((c) => { if (!CATS.some((x) => x.id === c.id)) CATS.push({ id: c.id, label: c.label, hue: c.hue }); });
  }

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


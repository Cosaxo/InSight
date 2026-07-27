// ported from design/spec-modules/map-branches.js — do not hand-edit load order assumptions
import React from 'react';

// InSight — Map branches: the shared category list for the Map tab (and the
// per-person mini-maps). The old statistical lens engine is gone — answers now
// read against the profile anchors instead (see map-anchors.js).
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
  if (window.DAILYQ && Array.isArray(window.DAILYQ.EMERGENT_CATS)) {
    window.DAILYQ.EMERGENT_CATS.forEach((c) => { if (!CATS.some((x) => x.id === c.id)) CATS.push({ id: c.id, label: c.label, hue: c.hue }); });
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

  window.MapLens = { CATS, topCat, buildById };
})();


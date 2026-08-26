// Ported from design/InSight_standalone_15.html (map-groups.js, 2026-07-31
// revision). THIS file is the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.

// map-groups.js — the over-categories. Seventeen branches radiating from You at
// one level meant nothing had rank and every label fought its neighbour. So the
// map gains a real level: You → group → branch → sub-branch → answer, and the
// default view is a handful of calm hubs you drill into.
//
// The set is deliberately wider than what is populated today — a new branch
// should always have an obvious home. Empty groups never render, so the map
// grows a hub the first time you answer into one.
//
// Knowledge being its own group is the point of it: "what you think" and "what
// you know" become a fact of the map's shape, not just a dot style.
// A named export since the Map went lazy (v28 §5, convert-on-touch): both
// readers — map-tab and person-mindmap — import the binding now.
export const MAP_GROUPS = (function () {
  const GROUPS = [
    { id: 'g-self',   label: 'Self',      hue: 150, cats: ['health', 'story', 'home', 'craft', 'goals', 'pulse'] },
    { id: 'g-taste',  label: 'Taste',     hue: 35,  cats: ['interests', 'top-food', 'top-film', 'top-music', 'top-sport', 'top-travel'] },
    { id: 'g-belief', label: 'Beliefs',   hue: 356, cats: ['values', 'top-morals', 'top-mind'] },
    { id: 'g-know',   label: 'Knowledge', hue: 78,  cats: [] },   // every lrn-* subject, matched by prefix
    { id: 'g-world',  label: 'World',     hue: 240, cats: ['top-tech', 'top-work', 'top-money', 'top-politics', 'top-society', 'top-events'] },
    { id: 'g-people', label: 'People',    hue: 320, cats: ['top-people', 'top-family', 'top-friends', 'top-love'] },
    // aims, not answers: the subjects you call and the groups you read
    // (violet, not green: 115 sat between Knowledge 78 and Self 150 and
    // read as a third olive — Foresight is the one family the wheel had
    // spare)
    { id: 'g-fore',   label: 'Foresight', hue: 282, cats: [] },  // every fore-* branch, matched by prefix
    // roads walked, not answers: the Crossroads stories and where they
    // ended (200 petrol — the 100–140 arc reads olive on the warm ground)
    { id: 'g-paths',  label: 'Crossroads', hue: 200, cats: [] }, // every path-* branch, matched by prefix
  ];
  const OF = {};
  GROUPS.forEach((g) => g.cats.forEach((c) => { OF[c] = g.id; }));
  return {
    all: () => GROUPS,
    get: (id) => GROUPS.find((g) => g.id === id) || null,
    // an unplaced topical branch lands in World — public questions, not personal ones
    of: (catId) => {
      const id = catId ? String(catId) : '';
      if (id.indexOf('lrn-') === 0) return 'g-know';
      if (id.indexOf('fore-') === 0) return 'g-fore';
      if (id.indexOf('path-') === 0) return 'g-paths';
      return OF[catId] || 'g-world';
    },
  };
})();

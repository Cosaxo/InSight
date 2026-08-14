// Ported from design/spec-modules/map-layout.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// InSight — Map tab layout engine + shared helpers. No JSX — plain script.
// The tab component lives in map-tab.jsx; branch chips in map-tab-chips.jsx.
(function () {
// slug for ids built from labels
function mtSlug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// deterministic hash 0..1
function mtHash(s) {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997;
  return h / 997;
}
const MT_GOLD = Math.PI * (3 - Math.sqrt(5)); // golden angle
const MT_ZLAB = 0.5; // answer labels appear past this zoom

function mtTopCat(n, byId) {
  let c = n;
  while (c && c.parentId !== 'root') c = byId[c.parentId];
  return c ? c.id : null;
}

// ── cluster layout — organic dot constellations that never overlap ───────────
// Each branch is a little cloud: a golden-angle spiral of its answers. Clouds
// are seeded on a ring, then relaxed apart, and held clear of the anchor ring
// at the centre. A final vertical stretch fills the tall phone canvas.
function mtClusterLayout(nodes, cats) {
  const byParent = {};
  nodes.forEach((n) => { (byParent[n.parentId] = byParent[n.parentId] || []).push(n); });
  const NC = cats.length || 1;
  const KR = 56, GR = 42;          // spiral spacing for answers / sub-answers
  const GAP = 34;                  // breathing room between two cloud edges
  const CLEAR = 150;               // keep the central anchor ring uncrowded — tighter orbit
  const VS = 1.2;                  // vertical stretch — use the portrait canvas

  // typicality: common answers sit close to the hub, rare takes drift outward
  const typOf = (n) => {
    if (n.typ != null) return n.typ;
    const ch = byParent[n.id] || [];
    if (!ch.length) return 0.5;
    return ch.reduce((s, c) => s + (c.typ != null ? c.typ : 0.5), 0) / ch.length;
  };

  // cloud mass — answer count per branch; the map's silhouette carries it
  const ctOf = {};
  cats.forEach((cat) => { let ct = 0; (byParent[cat.id] || []).forEach((k) => { ct += 1 + (byParent[k.id] || []).length; }); ctOf[cat.id] = ct; });
  const maxCt = Math.max(1, ...cats.map((c) => ctOf[c.id] || 0));

  // 1 · build each cloud around its own origin and measure how far it reaches
  const cl = cats.map((cat, i) => {
    const h2 = mtHash(cat.id + 'x');
    const rot = h2 * Math.PI * 2;
    const s = 0.66 + 0.6 * Math.sqrt((ctOf[cat.id] || 1) / maxCt); // cloud area ∝ how much you've answered here
    const kids = (byParent[cat.id] || []).slice().sort((a, b) => typOf(b) - typOf(a));
    const local = {};
    let radius = 50 * s;
    kids.forEach((k, j) => {
      const kr = KR * s * Math.sqrt(j + 1.4);
      const ka = rot + j * MT_GOLD + (mtHash(k.id) - 0.5) * 0.5;
      const kx = Math.cos(ka) * kr, ky = Math.sin(ka) * kr;
      local[k.id] = { x: kx, y: ky };
      radius = Math.max(radius, Math.hypot(kx, ky) + 24);
      (byParent[k.id] || []).slice().sort((a, b) => typOf(b) - typOf(a)).forEach((g, m) => {
        const gr = GR * s * Math.sqrt(m + 1);
        const ga = ka + 0.9 + m * MT_GOLD;
        const gx = kx + Math.cos(ga) * gr, gy = ky + Math.sin(ga) * gr;
        local[g.id] = { x: gx, y: gy };
        radius = Math.max(radius, Math.hypot(gx, gy) + 22);
      });
    });
    return { id: cat.id, i, local, radius, x: 0, y: 0 };
  });

  // 2 · seed clouds evenly around one ring — an even orbit, barely jittered so
  // it reads as a balanced system rather than a scattered pile.
  const R1 = 330;
  cl.forEach((c) => {
    const h2 = mtHash(c.id + 'x');
    // locked, perfectly-even angle — no jitter, so the branches read as a
    // balanced flower around You rather than a scattered pile with dead quadrants
    c.ang = -Math.PI / 2 + (c.i * 2 * Math.PI) / NC;
    const r = R1 * (0.97 + h2 * 0.06);
    c.x = Math.cos(c.ang) * r;
    c.y = Math.sin(c.ang) * r;
  });

  // 3 · relax — resolve overlaps, hold clouds off the centre, then re-snap each
  // cloud back onto its locked ray. Overlaps push distance (radius), never angle,
  // so the even angular spacing is preserved and no quadrant ends up empty.
  for (let pass = 0; pass < 220; pass++) {
    for (let a = 0; a < cl.length; a++) {
      const A = cl[a];
      for (let b = a + 1; b < cl.length; b++) {
        const B = cl[b];
        let dx = B.x - A.x, dy = B.y - A.y;
        let d = Math.hypot(dx, dy) || 0.01;
        const need = A.radius + B.radius + GAP;
        if (d < need) {
          const push = (need - d) / 2;
          dx /= d; dy /= d;
          A.x -= dx * push; A.y -= dy * push;
          B.x += dx * push; B.y += dy * push;
        }
      }
    }
    cl.forEach((c) => {
      let d = Math.hypot(c.x, c.y) || 0.01;
      const need = CLEAR + c.radius;
      if (d < need) d = need;
      // re-project onto the locked angle at whatever radius relaxation reached
      c.x = Math.cos(c.ang) * d;
      c.y = Math.sin(c.ang) * d;
    });
  }

  // 4 · emit — clouds stay circular; only their centres take the vertical stretch.
  // Rarity breathes outward: common answers settle toward the hub side of their
  // cloud, rare takes drift to the map's edge — the ground says it, no key needed.
  const nById = {};
  nodes.forEach((n) => { nById[n.id] = n; });
  const pos = { root: { x: 0, y: 0 } };
  cl.forEach((c) => {
    const cx = c.x, cy = c.y * VS;
    pos[c.id] = { x: cx, y: cy };
    for (const id in c.local) {
      let x = cx + c.local[id].x, y = cy + c.local[id].y;
      const n = nById[id];
      if (n && n.typ != null) {
        const d = Math.hypot(x, y) || 1;
        const push = ((1 - n.typ) - 0.35) * 80;
        x += (x / d) * push; y += (y / d) * push;
      }
      // never inside the central anchor ring — common answers pull inward,
      // but the ring (r≈170) plus label room stays clear
      const dc = Math.hypot(x, y) || 1;
      if (dc < 205) { x *= 205 / dc; y *= 205 / dc; }
      pos[id] = { x, y };
    }
  });
  // territory fields — one soft hue landmass per branch
  const fields = cl.map((c) => ({ id: c.id, x: c.x, y: c.y * VS, r: c.radius }));

  // 5 · the mainstream boundary — a ring sized by the map, not a constant.
  // It lives in CSS (.mmt-ground::after) and used to be a flat 640px circle,
  // which is a sane size only for a map that has filled out. The canvas fits
  // itself to whatever is on it, so the fewer answers you have the harder it
  // zooms in and the bigger that fixed circle draws: measured on a 390×700
  // canvas it covers 91% of the width at one or two branches, against 28% at
  // nine — a balloon around three dots, which is what got reported.
  //
  // So take a share of the constellation's own reach. Same measure the fit
  // uses (the outermost thing on the map), so the ring holds a steady ~28-37%
  // of the width at every size, and 0.26 is the share that leaves a full map
  // exactly where it is today (0.26 × 1227 ≈ 319, was 320).
  //
  // The floor is the layout's own: step 4 refuses to place a dot inside 205,
  // and the profile ring sits at 170 with its labels just outside. A boundary
  // drawn inside either would be a second circle competing with the anchors
  // for the same hole rather than a horizon around them.
  const RING_SHARE = 0.26, RING_MIN = 205;
  let reach = 0;
  for (const id in pos) {
    if (id === 'root') continue;
    reach = Math.max(reach, Math.hypot(pos[id].x, pos[id].y));
  }
  return { pos, fields, ring: Math.max(RING_MIN, RING_SHARE * reach) };
}

  window.MapTabLayout = { mtSlug, mtHash, mtTopCat, mtClusterLayout, MT_ZLAB };
})();

;globalThis.mtSlug = typeof mtSlug === 'undefined' ? globalThis.mtSlug : mtSlug;
;globalThis.mtHash = typeof mtHash === 'undefined' ? globalThis.mtHash : mtHash;
;globalThis.mtTopCat = typeof mtTopCat === 'undefined' ? globalThis.mtTopCat : mtTopCat;
;globalThis.mtClusterLayout = typeof mtClusterLayout === 'undefined' ? globalThis.mtClusterLayout : mtClusterLayout;
;globalThis.MT_GOLD = typeof MT_GOLD === 'undefined' ? globalThis.MT_GOLD : MT_GOLD;
;globalThis.MT_ZLAB = typeof MT_ZLAB === 'undefined' ? globalThis.MT_ZLAB : MT_ZLAB;

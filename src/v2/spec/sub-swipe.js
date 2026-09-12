import React from 'react';
import { HAPTIC } from './haptics.js';

// sub-swipe.js — the profile's sub-tab swipe (2026-09-12, VISION-2026-09-12
// §4). A module of its own rather than a primitives.jsx export, because
// primitives.jsx is on the first-paint graph and the only caller
// (profile-overlay.jsx) is in the deferred overlays chunk — check:bundle
// has no eager headroom, and a hook nothing on first paint calls should
// not cost it. An ordinary ESM module: it loads through the profile's own
// import (check:globals rule 2), publishes nothing, and needs no
// spec-index.js line.
//
// A horizontal swipe on an overlay body steps between its sub-tabs with
// the daily's own 34px slide-and-fade, skipping anything that owns its
// horizontal motion (scrollers, the map's rails, ranges, inputs). One
// hook, so the profile and any page with a sub-tab row share the gesture;
// `live` carries the current ids and setter so the listeners, bound once
// per element, never close over a stale tab.
//
// Listeners rather than React handlers, and bound once (`_subSwipe`):
// touchmove must be non-passive to hold the page still while the panel
// slides, and React's synthetic touchmove is passive by default.
export function useSubSwipe(bodyRef, panelRef, ids, cur, set) {
  const live = React.useRef(null);
  // refreshed after every commit (react-hooks/refs: never during render),
  // so the listeners below always step from the CURRENT tab
  React.useEffect(() => { live.current = { ids, cur, set }; });
  React.useEffect(() => {
    const sc = bodyRef.current;
    if (!sc || sc._subSwipe) return;
    sc._subSwipe = true;
    const SKIP = 'svg, canvas, .h-scroll, .subnav, .mmt-swipe, .cb-rail, [data-nopan], input, textarea, [type=range]';
    const T = () => panelRef.current;
    const step = (dir) => {
      const L = live.current;
      const i = L.ids.indexOf(L.cur), ni = i + dir;
      if (i < 0 || ni < 0 || ni >= L.ids.length) return false;
      HAPTIC.tick();
      const b = T();
      if (b) {
        b.style.transition = 'transform 0.17s ease, opacity 0.17s ease';
        b.style.transform = 'translateX(' + (dir > 0 ? -34 : 34) + 'px)';
        b.style.opacity = '0';
      }
      setTimeout(() => L.set(L.ids[ni]), 150);
      return true;
    };
    const spring = () => {
      const b = T();
      if (!b) return;
      b.style.transition = 'transform 0.25s cubic-bezier(0.2,0.9,0.2,1), opacity 0.25s ease';
      b.style.transform = 'translateX(0)';
      b.style.opacity = '1';
    };
    let sx = 0, sy = 0, dx = 0, horiz = null, dragging = false;
    sc.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      if (!t || (e.target.closest && e.target.closest(SKIP))) { dragging = false; return; }
      sx = t.clientX; sy = t.clientY; dx = 0; horiz = null; dragging = true;
      const b = T();
      if (b) b.style.transition = 'none';
    }, { passive: true });
    sc.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const t = e.touches[0];
      if (!t) return;
      const mx = t.clientX - sx, my = t.clientY - sy;
      if (horiz === null && (Math.abs(mx) > 9 || Math.abs(my) > 9)) horiz = Math.abs(mx) > Math.abs(my) * 1.4;
      if (!horiz) return;
      e.preventDefault();
      dx = mx;
      const b = T();
      if (b) {
        b.style.transform = 'translateX(' + mx * 0.7 + 'px)';
        b.style.opacity = String(1 - Math.min(Math.abs(mx) / 520, 0.4));
      }
    }, { passive: false });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      if (horiz && Math.abs(dx) > 66) { if (!step(dx < 0 ? 1 : -1)) spring(); } else spring();
    };
    sc.addEventListener('touchend', end);
    sc.addEventListener('touchcancel', end);
    // a trackpad's sideways scroll is the same gesture, once per flick
    let lock = false;
    sc.addEventListener('wheel', (e) => {
      if (e.target.closest && e.target.closest(SKIP)) return;
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) + 4) return;
      e.preventDefault();
      if (lock || Math.abs(e.deltaX) < 24) return;
      lock = true;
      step(e.deltaX > 0 ? 1 : -1);
      setTimeout(() => { lock = false; }, 650);
    }, { passive: false });
    // Bound once for the element's life (`_subSwipe`), on purpose: the
    // refs are read live, so nothing here goes stale, and re-binding on
    // every tab change would stack listeners. The two refs are the deps
    // because the caller owns them; a caller that swaps its ref objects
    // gets a fresh bind on the new element.
  }, [bodyRef, panelRef]);
}

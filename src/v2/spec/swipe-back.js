// Ported from design/InSight_standalone_17.html (swipe-back.js). THIS file is
// the live source now, hand-edits and all.
//
// A NEW module, so `bindSwipeBack` is an ordinary named export rather than a
// shared global (D39's "convert on touch"). Listed in spec-index.js because
// check:globals rule 2 requires it, not because anything waits on it.

// swipe-back.js — one horizontal axis for the whole app. The bottom bar reads
// daily · groups · 1v1 · mirror; the daily tab already swipes between its three
// modes, so the Mirror needs the same gesture to fall back onto 1v1.
// Deliberately narrow: only a clear right-swipe, and never inside a horizontal
// scroller or a map surface that owns its own drag.
const SKIP = 'svg, canvas, .h-scroll, [data-nopan], input, textarea';

// A cross-tab jump ends the gesture that caused it: trackpad momentum keeps
// arriving after the switch and used to step the daily one stop further. The
// nav marks the jump; every gesture in the app asks whether it is still
// coasting off one. Module state rather than the prototype's shared global —
// one owner, and nobody has to guess whether it is set yet.
const COAST_MS = 700;
let navAt = 0;
export function markNav() { navAt = Date.now(); }
export function navCoasting() { return Date.now() - navAt < COAST_MS; }

export function bindSwipeBack(el, onBack) {
  if (!el || el._sbInit) return;
  el._sbInit = true;
  let sx = 0, sy = 0, dx = 0, horiz = null, live = false, blocked = false;
  const reset = () => { horiz = null; live = false; blocked = false; dx = 0; el.style.transition = 'transform 0.26s cubic-bezier(0.2,0.9,0.2,1)'; el.style.transform = 'none'; };
  el.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    blocked = !!(e.target.closest && e.target.closest(SKIP));
    sx = t.clientX; sy = t.clientY; dx = 0; horiz = null; live = true;
    el.style.transition = 'none';
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (!live || blocked) return;
    const t = e.touches[0], mx = t.clientX - sx, my = t.clientY - sy;
    if (horiz === null && (Math.abs(mx) > 9 || Math.abs(my) > 9)) horiz = Math.abs(mx) > Math.abs(my) * 1.4;
    if (!horiz) return;
    dx = Math.max(mx, 0); // only the back direction pulls
    if (dx > 0) { e.preventDefault(); el.style.transform = 'translateX(' + dx * 0.42 + 'px)'; }
  }, { passive: false });
  const end = () => {
    if (!live) return;
    const go = horiz && dx > 62;
    reset();
    if (go) onBack();
  };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
  let lock = false;
  el.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) + 4) return;
    if (e.target.closest && e.target.closest(SKIP)) return;
    e.preventDefault();
    if (lock || e.deltaX > -26) return;
    if (navCoasting()) return;   // still coasting off the last jump
    lock = true; onBack(); setTimeout(() => { lock = false; }, 650);
  }, { passive: false });
}

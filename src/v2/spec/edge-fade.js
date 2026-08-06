// Ported from design/InSight_standalone_17.html (edge-fade.js). THIS file is
// the live source now, hand-edits and all. Side effects only.

// edge-fade.js — horizontal rails fade on whichever side still has content.
// The app is full of chip/avatar rails that scroll sideways; before this they
// sliced the last label flat against the frame edge, which reads as a layout
// bug rather than "there's more". A row that FITS gets no fade at all, so the
// cue only ever appears when it means something.
// Sets data-ef="l" | "r" | "lr" on each rail; the mask lives in styles.css.
const SEL = '.h-scroll, .rm-axisrow, .mmt-swipe, .cb-rail, .subnav--scroll, .mmt-chips, .mmt-fchips';
const EDGE = 4; // px of slop, so a rail scrolled to its end reads as ended

function mark(el) {
  const max = el.scrollWidth - el.clientWidth;
  if (max <= EDGE) { if (el.hasAttribute('data-ef')) el.removeAttribute('data-ef'); return; }
  const x = el.scrollLeft;
  const v = (x > EDGE ? 'l' : '') + (x < max - EDGE ? 'r' : '');
  if (el.getAttribute('data-ef') !== v) el.setAttribute('data-ef', v);
}

function scan() { document.querySelectorAll(SEL).forEach(mark); }

// React swaps rails in and out constantly — debounce on the TRAILING edge so
// a burst of renders costs one sweep, and the last render is never the one
// that gets dropped.
let timer = 0;
function queue() { clearTimeout(timer); timer = setTimeout(scan, 140); }

// a rail's own scroll updates just that rail; the trailing sweep is a
// backstop for scrolls that arrive without a usable target
document.addEventListener('scroll', (e) => {
  const el = e.target;
  if (el && el.nodeType === 1 && el.matches && el.matches(SEL)) { mark(el); return; }
  queue();
}, true);

window.addEventListener('resize', queue);
new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true });

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', queue);
else queue();

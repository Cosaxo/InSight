// Ported from design/InSight_standalone_17.html (scroll-memory.js). THIS file
// is the live source now, hand-edits and all. Side effects only.

// scroll-memory.js — every view remembers where you left off.
//
// The app re-mounts a whole tab on switch (.tab-swap is keyed by tab), so read
// halfway down World, tap Mirror, come back — and you were at the top. The
// scroller elements are new objects each time, so position can't live on them.
// It lives here instead, keyed by the view the app is showing (data-view on
// .app, written by app-shell's render) plus which scroller it was.
//
// One listener in capture phase covers every scroller, present and future — no
// component needs to know this file exists.
const MEM = Object.create(null);
// the scrollers that hold reading position. .tab-swap is the scroller on the
// track tab; .app-body on mirror; .overlay for anything layered above.
const KEYS = ['app-body', 'tab-swap', 'overlay', 'mmt-scroll', 'rm-scroll'];
let app = null, view = '';

function keyOf(el) {
  if (!el || !el.classList) return null;
  for (const k of KEYS) if (el.classList.contains(k)) return k;
  return null;
}
function viewOf() { return (app && app.getAttribute('data-view')) || ''; }

// save — capture phase so it fires for scrollers nested anywhere
document.addEventListener('scroll', (e) => {
  const k = keyOf(e.target);
  if (!k) return;
  MEM[view + '|' + k] = e.target.scrollTop;
}, true);

// restore — two frames after the swap, so React has painted the new subtree
// and layout has settled enough for scrollTop to stick.
function restore(v) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (viewOf() !== v) return;
      for (const k of KEYS) {
        const y = MEM[v + '|' + k];
        if (!y) continue;
        const el = document.querySelector('.' + k);
        // don't fight a view that legitimately starts at the top, and don't
        // scroll past content that hasn't grown back yet
        if (el && el.scrollHeight > el.clientHeight) el.scrollTop = Math.min(y, el.scrollHeight - el.clientHeight);
      }
    });
  });
}

function watch() {
  app = document.querySelector('.app');
  if (!app) return false;
  view = viewOf();
  new MutationObserver(() => {
    const next = viewOf();
    if (next === view) return;
    // save the outgoing view's scrollers before the swap tears them down
    for (const k of KEYS) {
      const el = document.querySelector('.' + k);
      if (el && el.scrollTop) MEM[view + '|' + k] = el.scrollTop;
    }
    view = next;
    restore(next);
  }).observe(app, { attributes: true, attributeFilter: ['data-view'] });
  return true;
}

// the app mounts under React, so wait for .app to exist — and give up after
// 12s rather than polling forever on a page that never mounts one
let tries = 0;
const iv = setInterval(() => { if (watch() || ++tries > 120) clearInterval(iv); }, 100);

// Ported from design/spec-modules/subnav-thumb.js (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.

// subnav-thumb.js — sliding pill for every .subnav segmented control.
// A single thumb element per nav glides under the active button (FLIP-free:
// transform+width transitions). New navs position instantly; changes animate.
(function () {
  function sync(nav, animate) {
    var on = nav.querySelector('.subnav-btn.is-on');
    var th = nav.__thumb;
    if (!on) { if (th) th.style.opacity = '0'; return; }
    if (!th) {
      th = document.createElement('span');
      th.className = 'subnav-thumb';
      th.setAttribute('aria-hidden', 'true');
      nav.insertBefore(th, nav.firstChild);
      nav.classList.add('has-thumb');
      nav.__thumb = th;
      animate = false;
    }
    var fill = getComputedStyle(on).getPropertyValue('--seg-fill').trim();
    if (th.__fill !== fill) {
      th.__fill = fill;
      // Quiet thumb: a near-white pill barely tinted by the accent, with a
      // faint accent ring — the active label (accent-colored) carries the hue.
      var f = fill || 'var(--ink)';
      th.style.background = 'color-mix(in oklch, var(--surface) 86%, ' + f + ')';
      th.style.boxShadow = '0 1px 3px rgba(20,20,40,0.14), 0 0 0 0.5px color-mix(in oklch, ' + f + ' 30%, transparent)';
    }
    var key = on.offsetLeft + ':' + on.offsetTop + ':' + on.offsetWidth + ':' + on.offsetHeight;
    if (th.__key === key) { th.style.opacity = '1'; return; }
    th.__key = key;
    if (!animate) th.style.transition = 'none';
    th.style.opacity = '1';
    th.style.width = on.offsetWidth + 'px';
    th.style.height = on.offsetHeight + 'px';
    th.style.transform = 'translate(' + on.offsetLeft + 'px,' + on.offsetTop + 'px)';
    if (!animate) { void th.offsetWidth; th.style.transition = ''; }
  }
  function syncAll(animate) {
    document.querySelectorAll('.subnav').forEach(function (n) { sync(n, animate); });
  }
  var raf = null;
  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = null; syncAll(true); });
  }
  new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', function () { syncAll(false); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { syncAll(false); });
  syncAll(false);
})();


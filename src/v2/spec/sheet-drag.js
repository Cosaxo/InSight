// Ported from design/InSight_standalone_17.html (sheet-drag.js). THIS file is
// the live source now, hand-edits and all. Side effects only, plus one import.
import { HAPTIC } from './haptics.js';

// sheet-drag.js — the grab handle keeps its promise.
//
// Every bottom sheet draws a .wf-sheet-grab handle, but they only closed on
// scrim-tap or Escape — the handle was decoration promising a gesture that
// wasn't there, in an app that's otherwise gesture-native (swipe-back, the
// daily's drag). This adds the drag: pull down to dismiss, with rubber-band
// resistance upward and a velocity throw.
//
// Like sheet-escape.js, it doesn't teach the components anything. It drives the
// sheet's transform directly and ends by triggering the scrim's own click, so
// each sheet still closes through its own path and its own closing animation.
const THROW = 0.55;   // px/ms — a flick this fast dismisses at any distance
const DIST = 88;      // px — a slow drag past this dismisses

document.addEventListener('pointerdown', (e) => {
  if (e.button) return;
  const grab = e.target.closest && e.target.closest('.wf-sheet-grab, .wf-sheet-drag');
  if (!grab) return;
  const sheet = grab.closest('.wf-sheet');
  const scrim = sheet && sheet.closest('.wf-scrim');
  if (!sheet || !scrim || scrim.classList.contains('is-closing')) return;

  const y0 = e.clientY, t0 = e.timeStamp;
  let dy = 0, lastY = y0, lastT = t0, v = 0;
  sheet.style.animation = 'none';       // don't fight the entrance
  sheet.style.transition = 'none';
  sheet.setAttribute('data-dragging', '');
  grab.setPointerCapture(e.pointerId);

  function move(ev) {
    dy = ev.clientY - y0;
    const dt = ev.timeStamp - lastT;
    if (dt > 0) v = (ev.clientY - lastY) / dt;
    lastY = ev.clientY; lastT = ev.timeStamp;
    // upward is resisted, not free — the sheet is already at its top stop
    const shown = dy < 0 ? dy * 0.22 : dy;
    sheet.style.transform = 'translateY(' + shown + 'px)';
    // the scrim lightens with the pull, so dismissal feels underway
    scrim.style.opacity = String(Math.max(0.25, 1 - dy / 420));
  }

  function up(ev) {
    grab.removeAttribute('data-dragging');
    sheet.removeAttribute('data-dragging');
    try { grab.releasePointerCapture(ev.pointerId); } catch { /* the pointer may already be gone. */ }
    grab.removeEventListener('pointermove', move);
    grab.removeEventListener('pointerup', up);
    grab.removeEventListener('pointercancel', up);
    const quick = ev.timeStamp - t0 < 320;
    if (dy > DIST || (v > THROW && dy > 20) || (quick && dy > 52)) {
      // Continue from where the finger left it rather than handing the
      // transform back to the CSS closing animation, which would snap the
      // sheet up to 0 first. .sd-out stands that animation down; the scrim's
      // own fade (triggered by the click below) still runs.
      sheet.classList.add('sd-out');
      sheet.style.transition = 'transform 0.26s cubic-bezier(0.4, 0, 1, 1)';
      sheet.style.transform = 'translateY(' + (sheet.offsetHeight + 24) + 'px)';
      scrim.style.opacity = '';
      HAPTIC.tap();
      scrim.click();
      return;
    }
    // snap home
    sheet.style.transition = 'transform 0.34s cubic-bezier(0.2, 0.9, 0.2, 1)';
    sheet.style.transform = '';
    scrim.style.opacity = '';
    setTimeout(() => { sheet.style.transition = ''; sheet.style.animation = ''; }, 360);
  }

  grab.addEventListener('pointermove', move);
  grab.addEventListener('pointerup', up);
  grab.addEventListener('pointercancel', up);
  e.preventDefault();
});

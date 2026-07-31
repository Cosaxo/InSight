// Ported from design/spec-modules/primitives.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// Shared primitives — small components used across tabs
const { useState, useEffect, useMemo, useRef } = React;

function Av({ init, hue = 38, size = 38 }) {
  const bg = `oklch(0.86 0.05 ${hue})`;
  const fg = `oklch(0.30 0.10 ${hue})`;
  return (
    <span className="av" style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.36 }}>
      {init}
    </span>
  );
}

// Anonymous avatar — for nearby strangers. No initials (those leak the name);
// just a tinted disc with a centred dot, matching the Around-tab treatment.
function AnonAv({ hue = 38, size = 38 }) {
  return (
    <span className="av" style={{
      width: size, height: size, background: `oklch(0.86 0.05 ${hue})`,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} style={{ display: 'block' }}
        fill="none" stroke={`oklch(0.40 0.13 ${hue})`} strokeWidth="1.7" strokeLinecap="round">
        <circle cx="12" cy="8.6" r="3.7"></circle>
        <path d="M 5.6 20 a 6.4 6.2 0 0 1 12.8 0"></path>
      </svg>
    </span>
  );
}

// Display name for a person. Strangers (p.anon) are shown by gender + age,
// e.g. "Woman, 29" — never by name. Named contacts return their name.
function anonName(p) {
  if (!p) return '';
  if (p.anon) {
    const g = (p.gender || p.role || 'person');
    return g.charAt(0).toUpperCase() + g.slice(1) + (p.age ? `, ${p.age}` : '');
  }
  return p.name || '';
}
// First-name variant for inline prose; strangers collapse to "they".
function anonFirst(p) {
  if (!p) return 'they';
  if (p.anon) return 'they';
  return (p.name || 'they').split(' ')[0];
}

function Bar({ value, max = 100, color = "var(--ink)" }) {
  return (
    <div className="bar"><i style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} /></div>
  );
}

function Kicker({ children }) { return <div className="kicker">{children}</div>; }

// Chapter divider — groups a tab's cards into a clear section: a quiet rule + bold title.
function TabSection({ title, sub, art }) {
  return (
    <div style={{ margin: '26px 0 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 5, height: 5, background: 'var(--accent)', borderRadius: '50%', flexShrink: 0 }} />
        <span style={{ flex: 1, height: 0.5, background: 'var(--rule)' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontFamily: 'var(--sans)', fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: 'var(--ink)', lineHeight: 1.2 }}>{title}</h3>
          {sub && <div style={{ fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 13.5, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.45, textWrap: 'pretty' }}>{sub}</div>}
        </div>
        {art && <div style={{ flexShrink: 0, marginTop: 1 }}>{art}</div>}
      </div>
    </div>
  );
}

// Interests as a quiet prose run — the journal voice, not data chips.
// items: strings or {t, c}. markHue(item) → hue to underline an emphasized item.
function InterestRun({ items, size = 12.5, color = 'var(--ink-2)', dotColor = 'var(--ink-3)', markHue, style }) {
  return (
    <span style={{
      fontFamily: 'var(--sans)', fontSize: size, color, lineHeight: 1.55, letterSpacing: '0.005em',
      ...style,
    }}>
      {(items || []).map((it, i) => {
        const t = typeof it === 'string' ? it : it.t;
        const hue = markHue ? markHue(it) : null;
        return (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: dotColor, fontStyle: 'normal' }}>{' · '}</span>}
            <span style={{
              whiteSpace: 'nowrap',
              ...(hue != null ? {
                textDecorationLine: 'underline',
                textDecorationColor: `oklch(0.72 0.11 ${hue})`,
                textDecorationThickness: 1, textUnderlineOffset: 3,
              } : null),
            }}>{t}</span>
          </React.Fragment>
        );
      })}
    </span>
  );
}

function Pill({ active, color = "ink", children, onClick }) {
  return (
    <button className={"pill " + color + (active ? " is-on" : "")} onClick={onClick}>{children}</button>
  );
}

Object.assign(window, { Av, AnonAv, anonName, anonFirst, Bar, Kicker, TabSection, Pill, InterestRun, Lazy });

// Defer-mount a heavy section until it nears the viewport, so a tab's initial
// paint stays light (and the DOM stays small enough to screenshot). Reserves
// `minHeight` so the scrollbar doesn't lurch, and mounts ~700px early so the
// user almost never sees the placeholder while scrolling. Uses a scroll-rect
// check (IntersectionObserver with a custom root is unreliable in this host).
function Lazy({ minHeight = 240, children }) {
  const ref = React.useRef(null);
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    if (show) return;
    const el = ref.current;
    if (!el) return;
    let sp = el.parentElement;
    while (sp && !/(auto|scroll)/.test(getComputedStyle(sp).overflowY)) sp = sp.parentElement;
    const margin = 700;
    const check = () => {
      const er = el.getBoundingClientRect();
      const top = sp ? sp.getBoundingClientRect().top : 0;
      const bottom = sp ? sp.getBoundingClientRect().bottom : window.innerHeight;
      if (er.top < bottom + margin && er.bottom > top - margin) { setShow(true); return true; }
      return false;
    };
    if (check()) return;
    const target = sp || window;
    const onScroll = () => { if (check()) cleanup(); };
    target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const iv = setInterval(() => { if (check()) cleanup(); }, 400);
    function cleanup() {
      target.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      clearInterval(iv);
    }
    return cleanup;
  }, [show]);
  if (show) return children;
  return <div ref={ref} style={{ minHeight }} aria-hidden="true" />;
}

// ─── a ring that IS the match figure — arc sweep = how alike you are.
//     Wraps an avatar (or stands alone as a small glyph). No numeral. ───
function MatchRing({ pct, color = 'var(--accent)', size = 50, thick = 2.4, children, title }) {
  const r = (size - thick) / 2;
  const C = 2 * Math.PI * r;
  return (
    <span title={title || `${pct} match`} style={{ position: 'relative', width: size, height: size, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--rule)" strokeWidth={Math.max(1, thick * 0.55)} opacity="0.8"></circle>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thick} strokeLinecap="round"
          strokeDasharray={`${(Math.max(0, Math.min(100, pct)) / 100) * C} ${C}`}
          style={{ transition: 'stroke-dasharray 0.4s cubic-bezier(0.2,0.8,0.2,1)' }}></circle>
      </svg>
      {children}
    </span>
  );
}
Object.assign(window, { MatchRing });

// ── Modal dialogs ────────────────────────────────────────────────────
// Until 2026-07-31 every overlay and bottom sheet here was a bare <div>:
// no role, no aria-modal, no Escape, no focus trap, no focus restore.
// Exactly one dialog existed in the whole spec layer — app-shell's update
// gate. The two helpers below are the fix, and they live in primitives
// because spec-index loads this module (18) before every consumer: the
// earliest sheet is type-marks (28) and app-shell is last (88).
//
// `useDialog` is for the eight full-screen overlays, which each own a
// top-level `.overlay` div. `Sheet` is for the seven wf-scrim/wf-sheet
// bottom sheets, whose markup is identical enough to be one component.

// What the trap treats as a Tab stop. Deliberately excludes
// [tabindex="-1"]: the dialog container itself carries that so it can be
// focused programmatically when it holds no controls, and it must never
// become a Tab stop of its own.
const DIALOG_FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// Returns the props a dialog container needs. Spread it onto the element
// that IS the dialog — one line per overlay:
//     const dlg = useDialog(onClose, 'Profile');
//     <div className="overlay" {...dlg}> …
function useDialog(onClose, label) {
  const ref = useRef(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    // Who opened us. Handing focus back on close is the difference between
    // a screen reader resuming where the user was and restarting the page.
    const opener = document.activeElement;
    // Focus something inside, or the container itself — that fallback is
    // the reason for tabIndex={-1} below.
    const first = node.querySelector(DIALOG_FOCUSABLE);
    (first || node).focus({ preventScroll: true });
    return () => {
      // document.contains: the opener may itself have been unmounted while
      // the dialog was up (closing a group from inside its own sheet), and
      // focusing a detached node silently sends focus to <body>.
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      // Reaching here means nothing smaller consumed it. Inner controls
      // with their own Escape meaning (the city/pick dropdowns, relmap's
      // rename field) stopPropagation when they handle it, so this does
      // not close the overlay out from under them.
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const items = [...ref.current.querySelectorAll(DIALOG_FOCUSABLE)];
    // No visibility filter on purpose. The obvious one — offsetParent !==
    // null — is null for position:fixed elements in a real browser AND for
    // everything in jsdom, so it would empty the cycle in exactly the two
    // places this runs. This layer hides things by not rendering them, so
    // a detached-but-focusable control is not a case that arises.
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return { ref, role: 'dialog', 'aria-modal': 'true', 'aria-label': label, tabIndex: -1, onKeyDown };
}

// The bottom-sheet pattern: scrim + sheet + grab handle, with the dialog
// semantics already attached. `children` land inside the sheet.
function Sheet({ onClose, closing, label, children }) {
  const dlg = useDialog(onClose, label);
  return (
    <div
      className={'wf-scrim' + (closing ? ' is-closing' : '')}
      // The backdrop dismisses on click, but it is NOT a control: the
      // sheet's own Close button and Escape are the real paths, and giving
      // this a button role would announce a duplicate of both. presentation
      // says what it is — decoration with a mouse convenience attached.
      role="presentation"
      // Target check rather than the stopPropagation handler the sheet used
      // to carry. That handler existed only to stop this one, and it was
      // itself a div-with-onClick the a11y gate counted. One test here
      // removes both.
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="wf-sheet" {...dlg}>
        <div className="wf-sheet-grab"></div>
        {children}
      </div>
    </div>
  );
}
Object.assign(window, { useDialog, Sheet, DIALOG_FOCUSABLE });

;globalThis.Av = typeof Av === 'undefined' ? globalThis.Av : Av;
;globalThis.AnonAv = typeof AnonAv === 'undefined' ? globalThis.AnonAv : AnonAv;
;globalThis.anonName = typeof anonName === 'undefined' ? globalThis.anonName : anonName;
;globalThis.anonFirst = typeof anonFirst === 'undefined' ? globalThis.anonFirst : anonFirst;
;globalThis.Bar = typeof Bar === 'undefined' ? globalThis.Bar : Bar;
;globalThis.Kicker = typeof Kicker === 'undefined' ? globalThis.Kicker : Kicker;
;globalThis.TabSection = typeof TabSection === 'undefined' ? globalThis.TabSection : TabSection;
;globalThis.InterestRun = typeof InterestRun === 'undefined' ? globalThis.InterestRun : InterestRun;
;globalThis.Pill = typeof Pill === 'undefined' ? globalThis.Pill : Pill;
;globalThis.Lazy = typeof Lazy === 'undefined' ? globalThis.Lazy : Lazy;
;globalThis.MatchRing = typeof MatchRing === 'undefined' ? globalThis.MatchRing : MatchRing;

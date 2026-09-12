// Ported from design/spec-modules/map-chiprow.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
//
// THE TRAIL AND FIND (2026-09-12, VISION-2026-09-12 §3, D-2026-09-12d).
// The row's *All* button became a trail that says where you are — *You*,
// or *‹ You › Everyday* inside a group, the first crumb the way back —
// and the row's end carries a glass that turns the rail into a field:
// *Find an answer…*, ✕ to clear, and two toggles, This week and Rare
// takes. The rail owns none of the data: map-tab.jsx folds the matches
// and hands the state down, so this file is still what it was, the
// chrome along the top. person-mindmap.jsx renders the same row for
// somebody else's map with no Find — it passes no `onFind`, and the
// glass is drawn only when there is something to open. It DOES pass a
// trail, of one crumb carrying that person's name: the fallback below is
// `You`, which is the truth on the Map tab and a claim about whose
// answers these are anywhere else.
import React from 'react';

// InSight — Map tab: the branch chip row along the top.
// ── branch chips — every branch one tap away, along the top ─────────────────
// Exported since the Map went lazy (v28 §5, convert-on-touch): map-tab and
// person-mindmap import the binding.
export function MTBranchChips({
  cats, activeCat, atHome, onPick, onHome,
  crumbs, onCrumb,
  findOpen, onFind, query, onQuery, fWeek, fRare, onWeek, onRare,
}) {
  const { useRef, useEffect } = React;
  const rowRef = useRef(null);
  const inRef = useRef(null);
  // keep the active chip in view (scrollTo, never scrollIntoView)
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const el = row.querySelector(activeCat ? `[data-chip="${activeCat}"]` : '.mmt-trail');
    if (!el) return;
    const target = Math.max(0, el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2);
    // hand-rolled ease — scrollTo({behavior:'smooth'}) no-ops in some embeds
    const from = row.scrollLeft, t0 = performance.now(), dur = 260;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      row.scrollLeft = from + (target - from) * (1 - Math.pow(1 - k, 3));
      if (k < 1) requestAnimationFrame(step);
    };
    step();
  }, [activeCat, findOpen]);
  // the field takes focus as the rail turns into it — one tap to type
  useEffect(() => { if (findOpen && inRef.current) inRef.current.focus(); }, [findOpen]);

  const trail = crumbs && crumbs.length ? crumbs : [{ id: 'home', label: 'You' }];
  const deep = trail.length > 1;
  const glass = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="7" cy="7" r="4.6"></circle>
      <path d="M10.6 10.6 14 14"></path>
    </svg>
  );
  const crumb = (c, i) => {
    const last = i === trail.length - 1;
    const here = last && atHome;
    return (
      <button
        type="button"
        key={c.id}
        className={'mmt-crumb' + (last ? ' is-last' : '') + (here ? ' is-here' : '') + (c.hue != null ? ' is-hue' : '')}
        style={c.hue != null ? { '--hue': c.hue } : undefined}
        aria-current={here ? 'location' : undefined}
        onClick={() => (onCrumb ? onCrumb(c.id) : onHome && onHome())}
      >
        {i === 0
          ? (deep ? <span className="mmt-back" aria-hidden="true">‹</span> : <span className="mmt-chipbtn-dot is-rainbow" aria-hidden="true"></span>)
          : <span className="mmt-crumb-sep" aria-hidden="true">›</span>}
        <span>{c.label}</span>
      </button>
    );
  };

  if (findOpen) {
    return (
      <div className="mmt-rail mmt-ui is-find" data-nopan="">
        <div className="mmt-find">
          <button type="button" className="mmt-find-back" onClick={onFind} aria-label="Close find">‹</button>
          <label className="mmt-find-field">
            {glass}
            <input
              ref={inRef}
              type="search"
              value={query || ''}
              placeholder="Find an answer…"
              aria-label="Find an answer"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') onFind(); }}
            />
            {query ? (
              <button type="button" className="mmt-find-clear" onClick={() => { onQuery(''); if (inRef.current) inRef.current.focus(); }} aria-label="Clear">✕</button>
            ) : null}
          </label>
          {/* "This week" is offered only where the dates are dates — map-tab
              passes no onWeek on a live build whose bank order is a position,
              the same gate the recency halo stands behind. */}
          {onWeek ? (
            <button type="button" className={'mmt-findf' + (fWeek ? ' is-on' : '')} aria-pressed={!!fWeek} onClick={onWeek}>This week</button>
          ) : null}
          <button type="button" className={'mmt-findf' + (fRare ? ' is-on' : '')} aria-pressed={!!fRare} onClick={onRare}>Rare takes</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mmt-rail mmt-ui" data-nopan="">
      <div className="mmt-chips" ref={rowRef} role="tablist" aria-label="Map branches">
        <div className={'mmt-trail' + (deep ? ' is-deep' : '')}>{trail.map(crumb)}</div>
        {cats.map((c) => (
          <button
            type="button"
            key={c.id}
            data-chip={c.id}
            className={'mmt-chipbtn' + (activeCat === c.id ? ' is-on' : '')}
            style={{ '--hue': c.hue }}
            onClick={() => onPick(c.id)}
          >
            <span className="mmt-chipbtn-dot" aria-hidden="true"></span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>
      {onFind ? (
        <button type="button" className="mmt-findbtn" onClick={onFind} aria-label="Find on the map">{glass}</button>
      ) : null}
    </div>
  );
}

// The window/globalThis publications left with the conversion — both
// readers import the export, so a publication here would be one nothing
// reads (check:globals rule 5).

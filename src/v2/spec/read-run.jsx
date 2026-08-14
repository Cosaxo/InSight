// Ported from design/InSight_standalone_17.html (read-run.jsx, the ReadRun
// module). THIS file is the live source now, hand-edits and all.
//
// A NEW module, so its three names are ordinary named exports rather than a
// window bag (D39's "convert on touch").
import React from 'react';

// ReadRun — one run of right/wrong calls over time.
// Dots are the encoding, always: they read better than any band or bar, and a
// long run doesn't earn a different vocabulary — it earns a scroller. So the row
// stays ONE line high and scrolls sideways, pinned to the newest end.
// The score sits at the start, because the whole point of a summary is that you
// shouldn't have to scroll to know how it's going.
// Past RUN_STRIP days even scrolling is silly (that's years of dots), so the run
// becomes a rolling rate line — resolution traded for span.
const { useRef, useLayoutEffect } = React;
export const RUN_DOTS = 14;   // fits without scrolling — no score needed
export const RUN_STRIP = 120; // beyond this, a line instead of a run
const GOOD = 'var(--c-likeness)';

function Dot({ ok, color, size }) {
  return (
    <span style={{
      width: size, height: size, flexShrink: 0, borderRadius: '50%', boxSizing: 'border-box',
      background: ok ? color : 'transparent',
      border: ok ? 'none' : `1.5px solid color-mix(in oklch, ${color} 55%, transparent)`,
    }}></span>
  );
}

function Dots({ days, color, size }) {
  return (
    <span style={{ display: 'flex', gap: size * 0.2, alignItems: 'center' }}>
      {days.map((ok, i) => <Dot key={i} ok={ok} color={color} size={size}></Dot>)}
    </span>
  );
}

// long run: score, then a one-line scroller starting at the most recent day
function ScrollRun({ days, color, size }) {
  const ref = useRef(null);
  useLayoutEffect(() => { const el = ref.current; if (el) el.scrollLeft = el.scrollWidth; }, [days.length]);
  const right = days.filter(Boolean).length;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
      <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontVariantNumeric: 'tabular-nums', fontSize: size * 1.02, fontWeight: 800, color, letterSpacing: '-0.01em' }}>
        {right}<span style={{ opacity: 0.42 }}>/{days.length}</span>
      </span>
      <span ref={ref} className="h-scroll" style={{ display: 'flex', gap: size * 0.2, alignItems: 'center', overflowX: 'auto', flex: 1, minWidth: 0 }}>
        {days.map((ok, i) => <Dot key={i} ok={ok} color={color} size={size}></Dot>)}
      </span>
    </span>
  );
}

// rolling accuracy — one line, no axis, no numbers: the shape is the point
function Rate({ days, color, size }) {
  const W = 160, H = Math.round(size * 2.4), win = Math.max(8, Math.round(days.length / 14));
  const pts = [];
  for (let i = win; i <= days.length; i++) {
    let r = 0;
    for (let j = i - win; j < i; j++) if (days[j]) r++;
    const x = ((i - win) / Math.max(1, days.length - win)) * W;
    pts.push(x.toFixed(1) + ',' + (H - (r / win) * H).toFixed(1));
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
      <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontVariantNumeric: 'tabular-nums', fontSize: size * 1.02, fontWeight: 800, color, letterSpacing: '-0.01em' }}>
        {days.filter(Boolean).length}<span style={{ opacity: 0.42 }}>/{days.length}</span>
      </span>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ flex: 1, minWidth: 0, height: H, overflow: 'visible' }}>
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke={`color-mix(in oklch, ${color} 20%, transparent)`} strokeWidth="1"></line>
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"></polyline>
      </svg>
    </span>
  );
}

// days: oldest → newest booleans
export function ReadRun({ days, color, size = 13 }) {
  const d = days || [];
  const c = color || GOOD;
  if (d.length <= RUN_DOTS) return <Dots days={d} color={c} size={size}></Dots>;
  if (d.length <= RUN_STRIP) return <ScrollRun days={d} color={c} size={size}></ScrollRun>;
  return <Rate days={d} color={c} size={size}></Rate>;
}

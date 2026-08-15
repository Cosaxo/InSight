// type-mix.jsx — types, out in the population. Two pieces:
//   TypeChip     — a type at person-row size: its mark, its name, optionally its
//                  count. Used to label a person wherever one is listed.
//   TypeMixCard  — the share of each type in a population, over a stated basis,
//                  through one of the four type systems (the switch on top).
//                  A reading, not a directory: no people, only proportions.
function TypeChip({ name, count, on, quiet, you, size = 18, dense, onClick, title, sys }) {
  const T = window.TYPEMIX;
  const key = sys || T.TEST;
  const body = (
    <React.Fragment>
      {window.TypeMark ? <window.TypeMark testKey={key} name={name} size={size} /> : null}
      <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: on ? 800 : 600, color: quiet ? 'var(--ink-3)' : 'var(--ink)', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{name}</span>
      {you ? <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, color: 'var(--accent-ink)', whiteSpace: 'nowrap' }}>· you</span> : null}
      {count != null ? <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, color: quiet ? 'var(--ink-3)' : 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{count}</span> : null}
    </React.Fragment>
  );
  const box = {
    display: 'inline-flex', alignItems: 'center', gap: 7, flex: 'none',
    height: dense ? 26 : 34, padding: dense ? '0 9px 0 5px' : '0 12px 0 7px', borderRadius: 999, boxSizing: 'border-box',
    border: on ? '1.5px solid var(--ink)' : '1px solid ' + (quiet ? 'color-mix(in oklch, var(--rule), transparent 45%)' : 'var(--rule)'),
    background: on ? 'var(--surface-3)' : 'var(--surface-2)',
    opacity: quiet ? 0.72 : 1,
  };
  if (!onClick) return <span style={box} title={title}>{body}</span>;
  return <button className="press" onClick={onClick} aria-pressed={!!on} title={title} style={{ ...box, cursor: 'pointer', WebkitAppearance: 'none' }}>{body}</button>;
}

// Length is the share; the mark carries which type. One neutral bar throughout —
// a bar per type in its own hue would turn thirteen readings into soup — with
// your own row in the population's accent.
const TMX_LS = 'insight.typemix.sys';
function TypeMixCard({ audId = 'city' }) {
  const T = window.TYPEMIX;
  const [sys, setSys] = React.useState(() => {
    try { const v = localStorage.getItem(TMX_LS); if (v && T && T.SYS.some((s) => s.key === v)) return v; } catch (e) {}
    return T ? T.TEST : 'big5';
  });
  const pick = (k) => { setSys(k); try { localStorage.setItem(TMX_LS, k); } catch (e) {} if (window.HAPTIC) window.HAPTIC.tick(); };
  if (!T || !window.TypeMark) return null;
  const basis = T.basis(audId);
  const mix = T.mix(audId, sys);
  const mine = T.mine(sys);
  const small = basis.n < T.SMALL;
  const rows = small ? mix.ranked.concat(mix.thin).sort((a, b) => b.n - a.n) : mix.ranked;
  const top = Math.max(1, ...rows.map((r) => r.n));
  // politics names run long ("Traditional Conservative") — the column follows
  const nameW = sys === 'political' || sys === 'values' ? 142 : 118;

  return (
    <div>
      <window.TabSection title="Types here" sub={basis.label} />
      <div className="h-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 2px 10px' }} role="tablist" aria-label="Which type system">
        {T.SYS.map((s) => {
          const on = s.key === sys;
          return (
            <button key={s.key} role="tab" aria-selected={on} onClick={() => pick(s.key)} className="press"
              style={{
                flexShrink: 0, height: 30, padding: '0 13px', borderRadius: 999, boxSizing: 'border-box', cursor: 'pointer', WebkitAppearance: 'none',
                fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: on ? 800 : 600, letterSpacing: '-0.01em',
                color: on ? 'var(--ink)' : 'var(--ink-3)',
                border: on ? '1.5px solid var(--ink)' : '1px solid color-mix(in oklch, var(--rule), transparent 30%)',
                background: on ? 'var(--surface-3)' : 'var(--surface-2)',
              }}>{s.label}</button>
          );
        })}
      </div>
      <div className="card" style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rows.map((r) => {
          const you = r.name === mine;
          const pct = Math.round((r.n / basis.n) * 100);
          return (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <window.TypeMark testKey={sys} name={r.name} size={20} />
              <span style={{ width: nameW, flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 13, fontWeight: you ? 800 : 650, letterSpacing: '-0.015em', color: you ? 'var(--ink)' : 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
              <span style={{ flex: 1, minWidth: 0, height: 7 }}>
                <span style={{ display: 'block', height: 7, width: Math.max(3, (r.n / top) * 100) + '%', borderRadius: 999, background: you ? 'var(--accent)' : 'color-mix(in oklch, var(--ink-3) 46%, var(--surface-3))' }}></span>
              </span>
              <span style={{ flexShrink: 0, width: small ? 22 : 34, textAlign: 'right', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 800, color: you ? 'var(--accent-ink)' : 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>{small ? r.n : pct + '%'}</span>
            </div>
          );
        })}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, borderTop: '1px solid color-mix(in oklch, var(--rule), transparent 25%)', paddingTop: 10 }}>
          {small && (
            <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.45 }}>
              {basis.n} people is too few for a share — these are counts.
            </span>
          )}
          {!small && mix.thin.length > 0 && (
            <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45 }}>
              too few to rank: {mix.thin.map((r) => r.name + ' (' + r.n + ')').join(', ')}
            </span>
          )}
          {mix.absent.length > 0 && (
            <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45 }}>
              nobody in this sample: {mix.absent.map((r) => r.name).join(', ')}
            </span>
          )}
          {mine
            ? <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>your own type is marked in the accent</span>
            : <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>take the {T.label(sys).toLowerCase()} test to place yourself here</span>}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TypeChip, TypeMixCard });

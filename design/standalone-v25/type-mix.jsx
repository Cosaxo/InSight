// type-mix.jsx — types, out in the population. Two pieces:
//   TypeChip     — a type at person-row size: its mark, its name, optionally its
//                  count. Used to label a person wherever one is listed.
//   TypeMixCard  — the share of each type in a population, over a stated basis.
//                  A reading, not a directory: no people, only proportions.
function TypeChip({ name, count, on, quiet, you, size = 18, dense, onClick, title }) {
  const T = window.TYPEMIX;
  const body = (
    <React.Fragment>
      {window.TypeMark ? <window.TypeMark testKey={T.TEST} name={name} size={size} /> : null}
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
function TypeMixCard({ audId = 'city' }) {
  const T = window.TYPEMIX;
  if (!T || !window.TypeMark) return null;
  const basis = T.basis(audId);
  const mix = T.mix(audId);
  const mine = T.mine();
  const small = basis.n < T.SMALL;
  const rows = small ? mix.ranked.concat(mix.thin).sort((a, b) => b.n - a.n) : mix.ranked;
  const top = Math.max(1, ...rows.map((r) => r.n));

  return (
    <div>
      <window.TabSection title="Types here" sub={basis.label} />
      <div className="card" style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {rows.map((r) => {
          const you = r.name === mine;
          const pct = Math.round((r.n / basis.n) * 100);
          return (
            <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <window.TypeMark testKey={T.TEST} name={r.name} size={20} />
              <span style={{ width: 118, flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 13, fontWeight: you ? 800 : 650, letterSpacing: '-0.015em', color: you ? 'var(--ink)' : 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
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
          {mine && (
            <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>
              your own type is marked in the accent
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TypeChip, TypeMixCard });

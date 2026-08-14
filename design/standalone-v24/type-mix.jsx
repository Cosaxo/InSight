// type-mix.jsx — types, out in the population. Two pieces:
//   TypeChip     — a type at person-row size: its mark, its name, optionally its
//                  count. The one chip used for filtering AND for labelling a row.
//   TypeMixCard  — who is here by type, over a stated basis, with the people you
//                  can actually see under it.
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

function TypeMixCard({ audId = 'city' }) {
  const T = window.TYPEMIX;
  if (!T || !window.TypeMark) return null;
  const [sel, setSel] = React.useState(null);
  const basis = T.basis(audId);
  const mix = T.mix(audId);
  const mine = T.mine();
  const people = T.people(audId);
  const small = basis.n < T.SMALL;
  const LINE = '1px solid color-mix(in oklch, var(--rule), transparent 25%)';

  // chip order: yours first — that IS the "same type as you" shortcut — then the
  // ranked ones, then the ones too thin to rank, then the ones nobody carries
  const ranked = small ? mix.ranked.concat(mix.thin).sort((a, b) => b.n - a.n) : mix.ranked;
  const seen = new Set();
  const chips = [];
  const push = (r, quiet) => { if (!r || seen.has(r.name)) return; seen.add(r.name); chips.push({ ...r, quiet }); };
  if (mine) push(ranked.concat(mix.thin, mix.absent).find((r) => r.name === mine), false);
  ranked.forEach((r) => push(r, false));
  if (!small) mix.thin.forEach((r) => push(r, true));
  mix.absent.forEach((r) => push(r, true));

  const shown = sel ? people.filter((p) => p.type === sel) : people;
  const selN = sel ? (chips.find((c) => c.name === sel) || {}).n || 0 : 0;

  const row = (p) => (
    <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', background: 'var(--surface)', border: LINE, borderRadius: 14 }}>
      <window.Av init={p.init} hue={p.hue} size={36}></window.Av>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>        <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.place}</span>
      </div>
      {p.type ? <span style={{ flexShrink: 0 }}><TypeChip name={p.type} size={17} dense you={p.type === mine} /></span> : null}
    </div>
  );

  return (
    <div>
      <window.TabSection title="Types here" sub={basis.label} />
      <div className="card" style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="h-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, margin: '0 -2px' }}>
          <button className="press" onClick={() => setSel(null)} aria-pressed={!sel}
            style={{ flex: 'none', height: 34, padding: '0 14px', borderRadius: 999, boxSizing: 'border-box', cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: sel ? 600 : 800, whiteSpace: 'nowrap', border: !sel ? '1.5px solid var(--ink)' : '1px solid var(--rule)', background: !sel ? 'var(--surface-3)' : 'var(--surface-2)', color: 'var(--ink)' }}>
            Everyone
          </button>
          {chips.map((c) => (
            <TypeChip key={c.name} name={c.name} count={c.n} you={c.name === mine} quiet={c.quiet && c.name !== mine}
              on={sel === c.name} onClick={c.n === 0 ? undefined : () => setSel(sel === c.name ? null : c.name)}
              title={c.n === 0 ? 'nobody in this sample' : c.n + ' of ' + basis.n} />
          ))}
        </div>

        {small && (
          <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.45 }}>
            {basis.n} people is too few for a share — these are counts, not percentages.
          </span>
        )}
        {!small && (mix.thin.length > 0 || mix.absent.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {mix.thin.length > 0 && (
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45 }}>
                too few to rank: {mix.thin.map((r) => r.name + ' (' + r.n + ')').join(', ')}
              </span>
            )}
            {mix.absent.length > 0 && (
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45 }}>
                nobody in this sample: {mix.absent.map((r) => r.name).join(', ')}
              </span>
            )}
          </div>
        )}

        <div style={{ borderTop: LINE, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {sel ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 800, letterSpacing: '-0.02em' }}>
                {selN} of {basis.n} here{sel === mine ? ' — your type' : ''}
              </span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.4 }}>{T.line(sel)}</span>
            </div>
          ) : (
            <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>
              {people.length} of them opted in to be seen
            </span>
          )}
          {shown.length > 0 ? shown.map(row) : (
            <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.45, textWrap: 'pretty' }}>
              {selN > 0
                ? 'None of them have opted in to be seen. The count is the whole reading.'
                : 'Nobody in this sample carries it — so there is nobody to show.'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TypeChip, TypeMixCard });

// place-stats.jsx — the scorecard for City / Country / World tabs.
// City and country hold two crowds on one 0–10 axis: a filled dot for the
// people who live there, a ring for the people who only visited. The bar
// between them IS the story — where the dots sit together the place is what it
// looks like; where they pull apart, one side is seeing something the other
// isn't (Oslo's prices, Norway's welcome). Sorted best → worst on the mean, so
// the eight rows read as one shape. Your own crowd is drawn full strength and
// the other half-lit, so the role switch at the foot visibly changes the card.
const PS_LW = 140;              // label column — sized to the longest label ("Openness to newcomers" needs 134)
const PS_GAP = 10;
const PS_ROLES = [{ id: 'local', label: 'I live here' }, { id: 'visitor', label: 'I\u2019m visiting' }];
const PS_PLACE = { city: 'Oslo', country: 'Norway', world: 'the world' };
// a dot on the axis: filled = locals, ring = visitors. Inset-scaled so a 10 sits
// inside the track instead of hanging off its end.
function PSDot({ x, col, ring, dim }) {
  const s = 11;
  return <span aria-hidden="true" style={{ position: 'absolute', top: '50%', marginTop: -s / 2, left: `calc(${x}% - ${(x / 100) * s}px)`, width: s, height: s, borderRadius: '50%', boxSizing: 'border-box', background: ring ? 'var(--surface)' : col, border: ring ? `2.5px solid ${col}` : 'none', opacity: dim ? 0.42 : 1, transition: 'opacity .25s ease, left .5s var(--ease-out)' }}></span>;
}
function PlaceStatsCard({ scope, accent }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => (window.PLACESTATS ? window.PLACESTATS.subscribe(() => tick((t) => t + 1)) : undefined), []);
  const PS = window.PLACESTATS;
  if (!PS) return null;
  const S = PS.SCOPES[scope];
  if (!S) return null;
  const col = accent || 'var(--c-world)';
  const deep = `color-mix(in oklch, ${col} 80%, var(--ink))`;
  const span = `color-mix(in oklch, ${col} 52%, var(--surface-3))`;
  const split = !!S.split;
  const role = split ? PS.role(scope) : 'local';
  const rows = S.cats.slice().sort((a, b) => (split ? (b.loc + b.vis) - (a.loc + a.vis) : b.avg - a.avg));
  const ratedAny = rows.some((c) => PS.myScore(scope, c.id) != null);
  const mid = `calc(${PS_LW}px + ${PS_GAP}px + (100% - ${PS_LW}px - ${PS_GAP}px) / 2)`;
  const num = (v, dim) => <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 27, letterSpacing: '-0.03em', color: dim ? 'var(--ink-2)' : deep, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{v.toFixed(1)}</span>;
  const word = (s) => <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 650, color: 'var(--ink-3)' }}>{s}</span>;
  const glyph = (ring) => <span aria-hidden="true" style={{ width: 11, height: 11, borderRadius: '50%', boxSizing: 'border-box', flex: 'none', background: ring ? 'var(--surface)' : deep, border: ring ? `2.5px solid ${deep}` : 'none' }}></span>;
  return (
    <div className="card" style={{ padding: '16px 16px 14px', margin: '16px 0 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: split ? 16 : 7, paddingBottom: 13, borderBottom: '0.5px solid var(--rule)', marginBottom: 15 }}>
        {split ? (
          <React.Fragment>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{glyph(false)}{num(PS.overall(scope, 'local'), role === 'visitor')}{word('locals')}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{glyph(true)}{num(PS.overall(scope, 'visitor'), role === 'local')}{word('visitors')}</span>
          </React.Fragment>
        ) : (
          <React.Fragment>{num(PS.overall(scope), false)}{word('/ 10')}</React.Fragment>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{S.raters} ratings</span>
      </div>
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `${PS_LW}px 1fr`, columnGap: PS_GAP, rowGap: 10, alignItems: 'center' }}>
        {/* halfway — the line between what a place is praised for and what it isn't */}
        <span aria-hidden="true" style={{ position: 'absolute', left: mid, top: -2, bottom: -2, width: 1, background: `color-mix(in oklch, var(--ink-3) 26%, transparent)` }}></span>
        {rows.map((c) => {
          const my = PS.myScore(scope, c.id);
          const a = split ? c.loc * 10 : c.avg * 10, b = split ? c.vis * 10 : null;
          const lo = b == null ? a : Math.min(a, b), hi = b == null ? a : Math.max(a, b);
          return (
            <React.Fragment key={c.id}>
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 650, color: (lo + hi) / 2 < 50 ? 'var(--ink-2)' : 'var(--ink)' }}>{c.label}</span>
              <span style={{ position: 'relative', height: 20, display: 'block' }}>
                <span aria-hidden="true" style={{ position: 'absolute', top: '50%', marginTop: -0.5, left: 0, right: 0, height: 1, background: 'color-mix(in oklch, var(--ink-3) 16%, transparent)' }}></span>
                <span aria-hidden="true" style={{ position: 'absolute', top: '50%', marginTop: -2, left: `${lo}%`, width: `${Math.max(hi - lo, 0.6)}%`, height: 4, borderRadius: 99, background: span, transition: 'left .5s var(--ease-out), width .5s var(--ease-out)' }}></span>
                <PSDot x={a} col={col} dim={split && role === 'visitor'}></PSDot>
                {b != null && <PSDot x={b} col={col} ring={true} dim={role === 'local'}></PSDot>}
                {my != null && <span aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${my * 10}% - ${(my * 10 / 100) * 3}px)`, width: 3, borderRadius: 2, background: deep }}></span>}
              </span>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ marginTop: 15, paddingTop: 12, borderTop: '0.5px solid var(--rule)', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {split && (
          <div style={{ display: 'flex', gap: 7 }}>
            {PS_ROLES.map((r) => {
              const on = role === r.id;
              return (
                <button key={r.id} className="press" onClick={() => { if (window.HAPTIC) window.HAPTIC.tick(); PS.setRole(scope, r.id); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 36, padding: '0 13px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: on ? 800 : 650, border: on ? `1px solid ${deep}` : '1px solid var(--rule)', background: on ? `color-mix(in oklch, ${col} 12%, var(--surface))` : 'var(--surface)', color: on ? deep : 'var(--ink-3)' }}>
                  {glyph(r.id === 'visitor')}{r.label}
                </button>
              );
            })}
          </div>
        )}
        {ratedAny ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>
            <span aria-hidden="true" style={{ width: 3, height: 14, borderRadius: 2, background: deep }}></span>your score
          </span>
        ) : (
          <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, color: 'var(--ink-3)' }}>Score these in the World feed — your marks land with {split ? (role === 'visitor' ? 'the visitors' : 'the locals') : 'the crowd'}.</span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button className="press" onClick={() => window.openCatalog && window.openCatalog('author')} style={{ minHeight: 36, padding: '0 13px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', border: '1px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, flexShrink: 0 }}>+ Author a metric for {PS_PLACE[scope] || 'this place'}</button>
          <span style={{ flex: 1, minWidth: 130, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.4 }}>this set stays editorial — authored metrics list in the catalog and run once funded</span>
        </div>
      </div>
    </div>
  );
}
Object.assign(window, { PlaceStatsCard });

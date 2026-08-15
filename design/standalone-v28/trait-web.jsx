// trait-web.jsx — "What moves together": the cross-test threads (trait-links.js)
// drawn on shared rails. Each pair is laid so the usual pattern lands its two
// dots together; the stretch between them is how far you defy it. The headline
// is the strongest break — the rule you break being the most individual thing
// the data can say. Lives on the profile's General panel.
(function () {
  const twDot = (h) => `oklch(0.55 0.13 ${h})`;

  function TraitWebCard() {
    const W = window.TRAIT_WEB;
    if (!W) return null;
    const rows = W.rows().slice(0, 8);
    if (rows.length < 4) return null;
    const brk = rows.find((r) => r.state === 'break') || null;
    return (
      <div className="card" style={{ marginBottom: 16, padding: '15px 18px 16px', fontFamily: 'var(--sans)' }}>
        <div className="kicker" style={{ marginBottom: 9 }}>What moves together</div>
        {brk ? (
          <div>
            <div style={{ fontSize: 18.5, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2, textWrap: 'balance', textTransform: 'capitalize' }}>{brk.breakLine}</div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.4, textWrap: 'pretty' }}>{brk.rule} — yours split apart.</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 18.5, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>Every usual thread holds in you</div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.4 }}>Your traits pull the way they typically pull together.</div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 15 }}>
          {rows.map((r) => {
            const broke = r.state === 'break';
            const lo = Math.min(r.pa, r.pb), hi = Math.max(r.pa, r.pb);
            const lab = { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 11 }} title={`${r.a.label} \u00d7 ${r.b.label} \u2014 ${r.rule}${broke ? ' \u00b7 yours split' : ' \u00b7 holds in you'}`}>
                <span style={{ width: 96, flexShrink: 0 }}>
                  <span style={{ ...lab, display: 'block', color: broke ? 'var(--ink)' : 'var(--ink-2)', fontWeight: broke ? 700 : 600 }}>{r.a.label}</span>
                  <span style={{ ...lab, display: 'block', color: 'var(--ink-3)' }}>{'\u00d7 '}{r.b.label}</span>
                </span>
                <div style={{ position: 'relative', flex: 1, height: 15 }}>
                  <span style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, marginTop: -0.5, background: 'color-mix(in oklch, var(--rule), transparent 30%)' }}></span>
                  {hi - lo > 2 && <span style={{ position: 'absolute', top: '50%', marginTop: broke ? -1.5 : -1, height: broke ? 3 : 2, borderRadius: 999, left: `${lo}%`, width: `${hi - lo}%`, background: broke ? 'var(--ochre)' : `color-mix(in oklch, ${twDot(r.a.hue)} 50%, ${twDot(r.b.hue)})`, opacity: broke ? 1 : 0.55 }}></span>}
                  <span style={{ position: 'absolute', top: '50%', left: `${r.pa}%`, transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: '50%', background: twDot(r.a.hue), border: '2px solid var(--surface-2)', boxShadow: '0 1px 3px -1px rgba(20,20,40,0.35)' }}></span>
                  <span style={{ position: 'absolute', top: '50%', left: `${r.pb}%`, transform: 'translate(-50%,-50%)', width: 11, height: 11, borderRadius: '50%', background: twDot(r.b.hue), border: '2px solid var(--surface-2)', boxShadow: '0 1px 3px -1px rgba(20,20,40,0.35)' }}></span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--ink-3)', lineHeight: 1.45, marginTop: 13, paddingTop: 11, borderTop: '0.5px solid var(--rule)', textWrap: 'pretty' }}>Each pair sits so the usual pattern lands its dots together \u2014 a stretched amber thread is a rule you break.</div>
      </div>
    );
  }

  Object.assign(window, { TraitWebCard });
})();

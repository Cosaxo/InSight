// pulse-card.jsx — the daily pulse, compact, beside the blind daily.
// Same contract as the daily question: you answer before you see anyone else.
// The five inputs BECOME the chart on reveal — the daily's option tiles do the
// same thing, so the two instruments read as one family. One hue throughout.
function PulseCard() {
  const P = window.PULSE;
  if (!P) return null;
  const [, bump] = React.useState(0);
  React.useEffect(() => P.subscribe(() => bump((x) => x + 1)), []);

  const HUE = 'var(--pulse)';
  const mine = P.mineToday();
  const st = P.streak();
  const sc = P.scope('world');
  const nToday = sc.series[P.DAYS - 1].n;
  const bins = P.bins('world');
  const maxBin = Math.max(...bins);
  // Rectangular mixing on purpose: an oklch mix from indigo (282°) into the warm
  // near-neutral surfaces takes the short way round the wheel and lands in the
  // salmon/rose arc. oklab holds the hue and only moves lightness/chroma.
  const wash = (pct) => 'color-mix(in oklab, ' + HUE + ' ' + pct + '%, var(--surface-2))';

  // ── the streak: fourteen days as they were, not a trophy. Filled = answered,
  // faint = missed, ring = today still open. Tap it to open the reading.
  const strip = (
    <button className="press" onClick={() => window.goTrends && window.goTrends()}
      aria-label={'Your last 14 days' + (st.run ? ' — ' + st.run + ' in a row' : '') + '. Open your trend.'}
      style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', padding: '4px 0', cursor: 'pointer', WebkitAppearance: 'none' }}>
      {st.run >= 3 && <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 13, letterSpacing: '-0.02em', color: HUE }}>{st.run}</span>}
      <span aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 2.5 }}>
        {st.ticks.map((d) => (
          <span key={d.key} style={{
            width: 3, height: d.today ? 13 : 11, borderRadius: 2,
            background: d.v != null ? HUE : 'color-mix(in oklch, var(--ink) 12%, var(--surface-2))',
            boxShadow: d.today && d.v == null ? 'inset 0 0 0 1px ' + wash(55) : 'none',
          }}></span>
        ))}
      </span>
    </button>
  );

  // ── the scale's key, read once: only the two ends are named
  const ends = (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>
      <span>rough</span><span>great</span>
    </div>
  );

  const ask = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {P.STEPS.map((s, i) => (
          <button key={s.v} className="press" onClick={() => P.answer(s.v)} aria-label={s.label}
            style={{ flex: 1, height: 'var(--field-size)', border: '1px solid color-mix(in oklab, ' + HUE + ' 24%, var(--rule))', borderRadius: 13, background: wash(7), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', WebkitAppearance: 'none', padding: 0 }}>
            <span aria-hidden="true" style={{ width: 9 + i * 4, height: 9 + i * 4, borderRadius: '50%', background: HUE }}></span>
          </button>
        ))}
      </div>
      {ends}
    </div>
  );

  const reveal = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, animation: 'popIn .35s cubic-bezier(0.2,0.8,0.2,1)' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
        {P.STEPS.map((s, i) => {
          const on = s.v === mine;
          return (
            <div key={s.v} title={s.label + ' · ' + bins[i] + '%'}
              style={{ flex: 1, height: 'var(--field-size)', borderRadius: 13, border: on ? '1.5px solid ' + HUE : '1px solid transparent', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
              <span style={{ width: '100%', height: 10 + 42 * (bins[i] / maxBin), borderRadius: on ? 11 : 9, background: on ? HUE : wash(22), transition: 'height .5s cubic-bezier(0.2,0.8,0.2,1)' }}></span>
            </div>
          );
        })}
      </div>
      {ends}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 1 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em' }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: HUE }}></span>
            you · {P.word(mine)}
          </span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
            {bins[mine - 1]}% of {P.fmtN(nToday)} answers today
          </span>
        </div>
        <button className="press" onClick={() => window.goTrends && window.goTrends()}
          style={{ border: 'none', background: 'none', padding: '4px 0', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: HUE, whiteSpace: 'nowrap', WebkitAppearance: 'none' }}>
          your line →
        </button>
      </div>
    </div>
  );

  return (
    <div className="card" data-screen-label="Daily pulse" style={{ display: 'flex', flexDirection: 'column', gap: 11, padding: '13px 14px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: HUE }}></span>
          <span className="kicker" style={{ marginBottom: 0 }}>{P.Q.kicker}</span>
        </span>
        {strip}
      </div>
      <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 21, lineHeight: 1.12, letterSpacing: '-0.03em', textWrap: 'balance' }}>{P.Q.text}</div>
      {mine == null ? ask : reveal}
    </div>
  );
}

Object.assign(window, { PulseCard });

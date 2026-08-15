// pulse-card.jsx — the pulses, compact, beside the blind daily.
// Same contract as the daily question: you answer before you see anyone else.
//
// Two things the card carries now:
//   THE READING — answering draws YOUR LINE. Twenty-one days, your marks joined
//   only where consecutive days exist (a missed day is a gap, never a bridge),
//   the crowd's daily mean quiet behind it, and today's whole distribution as a
//   strip on the right on the SAME vertical scale — so where you sit in today's
//   crowd and where today sits in your three weeks are one picture, not two.
//   THE RHYTHM — every pulse is asked on a cadence you set, right on the card:
//   daily · often (Mon·Wed·Fri) · weekly (Sunday) · off.
// ONE CARD PER PULSE, and a pulse card is a feed question like any other — it
// takes its turn in the world feed (world-feed.jsx places them), never a block
// pinned above it, and there is no tray of the ones you are not being asked:
// a dormant pulse is simply not asked. Cadence lives on each card.
function PulseCard({ pid }) {
  const P = window.PULSE;
  if (!P) return null;
  const [, bump] = React.useState(0);
  React.useEffect(() => P.subscribe(() => bump((x) => x + 1)), []);
  // which crowd you are held against — remembered, so the card opens where you
  // left it. City nights with too few answers stay ABSENT in the line, as ever.
  const [scopeId, setScopeId] = React.useState(() => {
    try { const v = localStorage.getItem('insight.pulse.scope'); if (P.SCOPES.includes(v)) return v; } catch (e) {}
    return 'world';
  });
  const pickScope = (id) => { setScopeId(id); try { localStorage.setItem('insight.pulse.scope', id); } catch (e) {} if (window.HAPTIC) window.HAPTIC.tick(); };

  const id = pid || P.active().id;
  const Q = P.pulse(id);
  const HUE = P.colour(id);
  // Rectangular mixing on purpose, for every pulse hue. An oklch mix into the
  // warm near-neutral surfaces takes the SHORT way round the wheel: indigo
  // lands in the salmon arc, sleep-blue passes through green. oklab holds the
  // hue and moves only lightness and chroma. (This is WPAL.wash's argument —
  // mix into an opaque surface, never into transparent — in the one colour
  // space that survives a cold hue meeting a warm ground.)
  const wash = (pct) => 'color-mix(in oklab, ' + HUE + ' ' + pct + '%, var(--surface-2))';

  const mine = P.mineToday(id);
  const st = P.streak(id);
  const sc = P.scope(scopeId, id);
  const nToday = sc.series[P.DAYS - 1].n;
  const bins = P.bins(scopeId, id);
  const maxBin = Math.max(...bins);
  const scheduled = P.dueToday().includes(id);

  // ── the streak: fourteen days as they were, not a trophy. Filled = answered,
  // faint = missed, ring = today still open. Only while today is open — once
  // you have answered, the line below says all of this better.
  const strip = (
    <span aria-label={'Your last 14 days' + (st.run ? ' — ' + st.run + ' in a row' : '')}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
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
    </span>
  );

  const ask = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {P.stepsFor(id).map((s, i) => (
          <button key={s.v} className="press" onClick={() => P.answer(s.v, id)} aria-label={s.label}
            style={{ flex: 1, height: 'var(--field-size)', border: '1px solid ' + wash(24), borderRadius: 13, background: wash(7), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', WebkitAppearance: 'none', padding: 0 }}>
            <span aria-hidden="true" style={{ width: 9 + i * 4, height: 9 + i * 4, borderRadius: '50%', background: HUE }}></span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>
        <span>{Q.ends[0]}</span>{strip}<span>{Q.ends[1]}</span>
      </div>
    </div>
  );

  // ── who you are held against: your city, your country, the world. The grey
  // line, the strip and the count all follow it — one control, three readings.
  const scopeRow = (
    <div style={{ display: 'flex', gap: 4 }} role="tablist" aria-label="Which crowd">
      {P.SCOPES.map((id) => {
        const on = id === scopeId;
        return (
          <button key={id} role="tab" aria-selected={on} className="press" onClick={() => pickScope(id)}
            style={{ flex: 1, minWidth: 0, height: 26, borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none',
              fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: on ? 800 : 650, letterSpacing: '-0.01em',
              color: on ? 'var(--ink)' : 'var(--ink-3)',
              background: on ? wash(11) : 'transparent',
              border: '1px solid ' + (on ? wash(30) : 'color-mix(in oklch, var(--rule), transparent 45%)') }}>
            {P.scope(id).label}
          </button>
        );
      })}
    </div>
  );

  // ── the reading: your three weeks, today's crowd, one vertical scale ──
  const W = 300, H = 96, TOP = 9, BOT = 9, STRIP = 46, GAP = 10;
  const PLOT = W - STRIP - GAP;
  const yOf = (v) => TOP + ((5 - v) / 4) * (H - TOP - BOT);
  const xOf = (i) => (i / (P.DAYS - 1)) * (PLOT - 8) + 4;
  const rows = P.days(id);
  const runs = [];
  let cur = [];
  rows.forEach((d) => {
    if (d.v == null) { if (cur.length) runs.push(cur); cur = []; return; }
    cur.push({ x: xOf(d.i), y: yOf(d.v), i: d.i, today: d.today });
  });
  if (cur.length) runs.push(cur);
  const cRuns = [];
  cur = [];
  sc.series.forEach((m) => {
    if (!m.placed) { if (cur.length) cRuns.push(cur); cur = []; return; }
    cur.push({ x: xOf(m.i), y: yOf(m.mean) });
  });
  if (cur.length) cRuns.push(cur);
  const path = (pts) => pts.map((p, k) => (k ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
  const lastRun = runs.length ? runs[runs.length - 1] : null;
  const last = lastRun ? lastRun[lastRun.length - 1] : null;

  const reveal = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, animation: 'popIn .35s cubic-bezier(0.2,0.8,0.2,1)' }}>
      <div aria-label={'Your pulse over ' + P.DAYS + ' days, and today’s crowd.'} style={{ display: 'block', width: '100%' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%' }} aria-hidden="true">
          {[1, 2, 3, 4, 5].map((v) => (
            <line key={v} x1="0" y1={yOf(v)} x2={PLOT} y2={yOf(v)} stroke="var(--rule)" strokeWidth="1" opacity={v === 3 ? 0.55 : 0.28}></line>
          ))}
          {cRuns.map((r, k) => <path key={'c' + k} d={path(r)} fill="none" stroke="var(--ink-3)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.34"></path>)}
          {runs.map((r, k) => <path key={'y' + k} d={path(r)} fill="none" stroke={HUE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path>)}
          {runs.flat().map((p) => <circle key={p.i} cx={p.x} cy={p.y} r={p.today ? 4.6 : 2.2} fill={HUE}></circle>)}
          {last && last.today && <circle cx={last.x} cy={last.y} r="8" fill="none" stroke={HUE} strokeWidth="1.4" opacity="0.4"></circle>}
          <g transform={`translate(${PLOT + GAP} 0)`}>
            {P.stepsFor(id).map((s, i) => {
              const on = s.v === mine, hh = 9;
              return <rect key={s.v} x="0" y={yOf(s.v) - hh / 2} width={Math.max(3, (bins[i] / maxBin) * STRIP)} height={hh} rx={hh / 2} fill={on ? HUE : wash(26)}></rect>;
            })}
          </g>
        </svg>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14, letterSpacing: '-0.02em', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: HUE }}></span>
          you · {P.word(mine, id)}
        </span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap', flex: 'none' }}>
          {bins[mine - 1]}% of {P.fmtN(nToday)}
        </span>
      </div>
      {scopeRow}
    </div>
  );

  // ── the rhythm. Always visible, because it is the answer to "I want this one
  // more often" — and turning a pulse up is how the library gets used.
  const cad = P.cadence(id);
  const rhythm = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, borderTop: '1px solid color-mix(in oklch, var(--rule), transparent 40%)', paddingTop: 10 }}>
      <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 650, color: 'var(--ink-3)', flex: 'none' }}>ask me</span>
      <div style={{ display: 'flex', gap: 4, flex: 1, minWidth: 0 }} role="tablist" aria-label="How often to ask this pulse">
        {P.CADENCES.map((c) => {
          const on = c === cad;
          return (
            <button key={c} role="tab" aria-selected={on} className="press" onClick={() => P.setCadence(id, c)}
              style={{ flex: 1, minWidth: 0, height: 28, borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none',
                fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: on ? 800 : 650, letterSpacing: '-0.01em',
                color: on ? '#fff' : 'var(--ink-2)',
                background: on ? P.inkColour(id) : wash(7),
                border: '1px solid ' + (on ? 'transparent' : wash(20)) }}>{c}</button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="card" data-screen-label={Q.kicker} style={{ display: 'flex', flexDirection: 'column', gap: 11, padding: '13px 14px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: HUE }}></span>
          <span className="kicker" style={{ marginBottom: 0 }}>{Q.kicker}</span>
        </span>
      </div>
      <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 21, lineHeight: 1.12, letterSpacing: '-0.03em', textWrap: 'balance' }}>{Q.text}</div>
      {mine != null ? reveal : scheduled ? ask : (
        <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45 }}>
          {(() => { const n = P.nextDue(id); return n ? 'Next ' + n.label + '.' : 'Not asked — no line drawn.'; })()}
        </div>
      )}
      {rhythm}
    </div>
  );
}

Object.assign(window, { PulseCard });

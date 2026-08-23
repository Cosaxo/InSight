// paid-report.jsx — the question report, in-app. The paid card promises "counts
// and cuts, never names"; this overlay IS that promise, inspectable by anyone.
// Same report the buyer downloads when the window closes, compiled live from
// the app's public counts — which is the whole honesty argument: nothing in the
// sold artifact is hidden from the people who made the numbers.
(function () {
  const fmt = (n) => n.toLocaleString('en-US');
  const gate = (c) => (window.WPAL ? window.WPAL.c(c) : c);
  const seeded = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; };
  // largest-remainder apportionment — buckets sum to total exactly, always
  const apportion = (total, weights) => {
    const s = weights.reduce((a, b) => a + b, 0);
    const raw = weights.map((w) => (total * w) / s), fl = raw.map(Math.floor);
    let rem = total - fl.reduce((a, b) => a + b, 0);
    raw.map((r, i) => [r - fl[i], i]).sort((a, b) => b[0] - a[0]).forEach((x) => { if (rem > 0) { fl[x[1]]++; rem--; } });
    return fl;
  };
  // split bucket totals into option-A counts that sum to A exactly
  const splitAll = (totals, A, shareA, leans, rnd) => {
    const a = totals.map((t, i) => Math.max(0, Math.min(t, Math.round(t * (shareA + (leans[i] || 0) + (rnd() - 0.5) * 0.03)))));
    let diff = A - a.reduce((x, y) => x + y, 0);
    for (let k = 0; diff !== 0 && k < 4000; k++) { const i = k % a.length; if (diff > 0 && a[i] < totals[i]) { a[i]++; diff--; } else if (diff < 0 && a[i] > 0) { a[i]--; diff++; } }
    return a;
  };

  const AXES = {
    'Big Five': [['Openness', 'grounded', 'curious', 0.6], ['Discipline', 'spontaneous', 'ordered', -0.2], ['Extraversion', 'introvert', 'extrovert', 0.1], ['Warmth', 'direct', 'warm', -0.3], ['Sensitivity', 'steady', 'sensitive', -0.1]],
    'Politics': [['Economic', 'left', 'right', -0.5], ['Authority', 'liberty', 'order', -0.3], ['Foreign', 'closed', 'open', 0.4], ['Environment', 'relaxed', 'urgent', 0.7], ['Technology', 'precaution', 'accelerate', 0.5], ['Populism', 'establishment', 'outsider', -0.2]],
    'Values': [['Future', 'pessimist', 'hopeful', 0.5], ['Circle', 'close', 'wide', 0.3], ['Pleasure', 'duty', 'pleasure', -0.1], ['Meaning', 'happiness', 'struggle', 0.1], ['Ethics', 'relative', 'objective', -0.2], ['Beauty', 'truth', 'beauty', 0]],
    'Social': [['Warm', 'reserved', 'warm', 0.1], ['Loyal', 'light-touch', 'loyal', -0.1], ['Open', 'guarded', 'open', 0.3], ['Playful', 'grounded', 'playful', 0.2], ['Easygoing', 'invested', 'easygoing', -0.2]],
  };
  const TYPES = {
    'Big Five': [['Explorer', 0.2, 0.09], ['Organiser', 0.22, -0.05], ['Energiser', 0.18, 0.03], ['Harmoniser', 0.21, -0.01], ['Feeler', 0.19, -0.04]],
    'Politics': [['Progressive', 0.14, 0.12], ['Leans left', 0.24, 0.07], ['Moderate', 0.3, -0.01], ['Leans right', 0.21, -0.08], ['Conservative', 0.11, -0.12]],
    'Values': [['Optimist', 0.22, 0.1], ['Family-first', 0.2, -0.07], ['Epicurean', 0.16, 0.02], ['Seeker', 0.2, 0.04], ['Universalist', 0.22, 0.05]],
    'Social': [['The warm one', 0.2, 0.02], ['The loyal one', 0.2, -0.03], ['The open book', 0.2, 0.05], ['The playful one', 0.2, 0.04], ['The easygoing one', 0.2, -0.02]],
  };
  const UNTESTED = { 'Big Five': 0.42, 'Politics': 0.3, 'Values': 0.36, 'Social': 0.4 };
  // neighbours are hand-picked per paid question — shared-voter correlation
  const NEIGHBOURS = {
    pd01: [['Should the metro run all night at weekends too?', 'Run it all night', 84, 'Keep the timetable', 58], ['Feel safe on the last bus home?', 'Mostly yes', 62, 'Mostly yes', 71], ['Pay 10 kr more per ticket for double the frequency?', 'Would pay', 66, 'Would not', 63], ['Should e-scooters be allowed in bus lanes?', 'Let them in', 54, 'Keep them out', 74], ['Close Karl Johan to cars on weekend nights?', 'Close it', 77, 'Leave it open', 56]],
    pd02: [['Should EV charging be cheaper at night?', 'Cheaper at night', 86, 'Cheaper at night', 57], ['Would you let your thermostat learn your schedule?', 'Let it learn', 74, 'Keep it manual', 61], ['Trust the grid operator more than your landlord with usage data?', 'The grid operator', 63, 'My landlord', 52], ['Turn off office lights grid-wide after midnight?', 'Turn them off', 79, 'Turn them off', 66], ['Pay 10% more for local wind power?', 'Would pay', 58, 'Would not', 71]],
  };

  function buildReport(q) {
    const rnd = seeded(q.id);
    const A = q.options[0].count, B = q.options[1].count, T = A + B, shareA = A / T;
    const oslo = /^Oslo/.test((q.paid || {}).window || '');
    const mkDim = (name, buckets, remLabel, remFrac) => {
      const rem = Math.round(T * remFrac);
      const totals = apportion(T - rem, buckets.map((b) => b[1])).concat([rem]);
      const leans = buckets.map((b) => b[2] || 0).concat([0]);
      const a = splitAll(totals, A, shareA, leans, rnd);
      return {
        name, tested: T - rem, remLabel,
        rows: totals.map((t, i) => ({ label: i < buckets.length ? buckets[i][0] : remLabel, t, a: a[i], b: t - a[i] })),
      };
    };
    const mkAxis = (test, ax) => {
      const bands = [[ax[1][0].toUpperCase() + ax[1].slice(1), 0.11], ['Leans ' + ax[1], 0.24], ['Between', 0.29], ['Leans ' + ax[2], 0.24], [ax[2][0].toUpperCase() + ax[2].slice(1), 0.12]]
        .map((b, i) => [b[0], b[1], ax[3] * 0.05 * (i - 2)]);
      return mkDim(test + ' · ' + ax[0], bands, 'Untested', UNTESTED[test]);
    };
    const groups = [
      { label: 'Demographics', dims: [
        mkDim('Age band', [['18–24', 0.13, 0.04], ['25–34', 0.37, 0.06], ['35–44', 0.27, -0.02], ['45+', 0.16, -0.07]], 'Not shared', 0.06),
        mkDim('Gender', [['Women', 0.44, -0.03], ['Men', 0.48, 0.04], ['Nonbinary', 0.035, 0.08]], 'Not shared', 0.05),
        oslo
          ? mkDim('District', [['Grünerløkka', 0.16, 0.07], ['Gamle Oslo', 0.14, 0.05], ['Frogner', 0.13, -0.05], ['Sagene', 0.11, 0.04], ['St. Hanshaugen', 0.1, 0.02], ['Nordre Aker', 0.09, -0.03], ['Elsewhere in Oslo', 0.25, -0.02], ['Marka', 0.0012, 0]], 'Not shared', 0.06)
          : mkDim('City', [['Oslo', 0.41, 0.05], ['Bergen', 0.15, -0.02], ['Trondheim', 0.12, 0.03], ['Stavanger', 0.07, -0.04], ['Tromsø', 0.012, 0], ['Kristiansand', 0.008, 0], ['Elsewhere in Norway', 0.22, -0.02]], 'Not shared', 0.06),
        mkDim('Job — sector', [['Tech', 0.16, 0.06], ['Health', 0.13, -0.02], ['Education', 0.11, -0.01], ['Finance', 0.08, 0.02], ['Creative', 0.09, 0.03], ['Trades', 0.08, -0.06], ['Service', 0.1, -0.02], ['Public', 0.11, 0.01], ['Science', 0.05, 0.05]], 'Not shared', 0.09),
        mkDim('Education — level', [['School', 0.09, -0.05], ['Trade', 0.13, -0.04], ['Some college', 0.15, -0.01], ['Bachelor’s', 0.32, 0.02], ['Master’s', 0.25, 0.05], ['Doctorate', 0.035, 0.06]], 'Not shared', 0.05),
        mkDim('Education — studied', [['Arts', 0.07, 0.03], ['Humanities', 0.08, 0.02], ['Social', 0.1, 0.03], ['Business', 0.14, -0.02], ['Law', 0.05, 0], ['Sciences', 0.13, 0.04], ['Engineering', 0.17, 0.02], ['Medicine', 0.09, -0.01], ['Teaching', 0.08, -0.02]], 'Not shared', 0.09),
      ] },
    ].concat(Object.keys(AXES).map((test) => ({
      label: test,
      dims: [mkDim(test + ' — type', TYPES[test], 'Untested', UNTESTED[test])].concat(AXES[test].map((ax) => mkAxis(test, ax))),
    })));
    // answers over time — weekend-shaped for a this-week window, front-loaded for a dated one
    const dayLabels = oslo ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['14', '15', '16', '17', '18', '19', '20', '21'];
    const dayW = oslo ? [0.1, 0.09, 0.1, 0.12, 0.2, 0.24, 0.15] : [0.22, 0.18, 0.13, 0.1, 0.08, 0.09, 0.12, 0.08];
    const dayT = apportion(T, dayW);
    const dayA = splitAll(dayT, A, shareA, dayW.map((_, i) => Math.sin(i * 1.7) * 0.04), rnd);
    const days = dayT.map((t, i) => ({ label: dayLabels[i], t, a: dayA[i], b: t - dayA[i] }));
    // second thoughts
    const eBA = Math.round(T * 0.052 * (0.7 + rnd() * 0.6)), eAB = Math.round(T * 0.026 * (0.7 + rnd() * 0.6));
    // logic cut
    const verified = Math.round(T * 0.38);
    const lgT = apportion(verified, [0.27, 0.25, 0.24, 0.24]).concat([T - verified]);
    const lgA = splitAll(lgT, A, shareA, [0.1, 0.04, -0.02, -0.08, -0.02], rnd);
    const logic = ['Top quarter', 'Second quarter', 'Third quarter', 'Bottom quarter', 'Untested'].map((label, i) => ({ label, t: lgT[i], a: lgA[i], b: lgT[i] - lgA[i] }));
    const neighbours = (NEIGHBOURS[q.id] || []).map((nb, i) => ({ prompt: nb[0], aPick: nb[1], aPct: nb[2], bPick: nb[3], bPct: nb[4], n: Math.round(T * [0.035, 0.031, 0.027, 0.022, 0.019][i]) }));
    return { A, B, T, groups, days, eBA, eAB, verified, logic, neighbours };
  }

  const K = { fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' };
  const Card = ({ children, style }) => <div className="card" style={{ padding: '16px 16px 14px', marginTop: 14, ...style }}>{children}</div>;
  const Kicker = ({ title, right }) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
      <span style={K}>{title}</span>
      {right && <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'right' }}>{right}</span>}
    </div>
  );
  const Basis = ({ children }) => <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid color-mix(in oklch, var(--rule) 62%, transparent)', fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, textWrap: 'pretty' }}>{children}</div>;
  const Duo = ({ a, b, cA, cB, h }) => (
    <div style={{ height: h || 12, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden', display: 'flex', gap: 2 }}>
      {a + b > 0 && <div style={{ width: (a / (a + b)) * 100 + '%', background: cA }}></div>}
      {a + b > 0 && <div style={{ width: (b / (a + b)) * 100 + '%', background: cB }}></div>}
    </div>
  );
  // one bucket line: label + counts above, bar below; thin and empty cells stated
  const BucketRow = ({ r, cA, cB, inkA, inkB }) => (
    <div style={{ marginTop: 9 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 650, color: 'var(--ink-2)', minWidth: 0 }}>{r.label}</span>
        <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
          {r.t === 0
            ? <span><span style={{ color: 'var(--ink)' }}>0</span><span style={{ fontWeight: 600, color: 'var(--ink-3)' }}> · none yet — still listed</span></span>
            : <span><span style={{ color: inkA }}>{fmt(r.a)}</span><span style={{ fontWeight: 600, color: 'var(--ink-3)' }}> · </span><span style={{ color: inkB }}>{fmt(r.b)}</span>{r.t < 8 && <span style={{ fontWeight: 600, color: 'var(--ink-3)' }}> · {r.t} {r.t === 1 ? 'person' : 'people'} — shown exactly</span>}</span>}
        </span>
      </div>
      <div style={{ marginTop: 5 }}><Duo a={r.a} b={r.b} cA={cA} cB={cB} h={10} /></div>
    </div>
  );

  function PaidReportOverlay({ q, onClose }) {
    const p = q.paid || {};
    const R = React.useMemo(() => buildReport(q), [q.id]);
    const [openDim, setOpenDim] = React.useState('Age band');
    const cA = gate('oklch(0.52 0.14 235)'), cB = gate('oklch(0.52 0.14 40)');
    const inkA = 'color-mix(in oklch, ' + cA + ', var(--ink) 12%)', inkB = 'color-mix(in oklch, ' + cB + ', var(--ink) 12%)';
    const LA = q.options[0].label, LB = q.options[1].label;
    const Legend = () => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {[[cA, LA], [cB, LB]].map((x) => (
          <span key={x[1]} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: x[0] }}></span>{x[1]}
          </span>
        ))}
      </span>
    );
    const maxDay = Math.max(...R.days.map((d) => d.t));
    let cum = 0;
    const pts = R.days.map((d, i) => { cum += d.t; return (((i + 0.5) / R.days.length) * 100).toFixed(1) + ',' + (58 - (cum / R.T) * 50).toFixed(1); }).join(' ');
    return (
      <div className="overlay surface-tint" style={{ '--accent': cA }}>
        <div className="app-header">
          <button className="avatar-btn" onClick={onClose} aria-label="Close">✕</button>
          <div className="h-title">Question <em>report</em></div>
          <div style={{ width: 32, flexShrink: 0 }} />
        </div>
        <div className="app-body" style={{ paddingTop: 0 }}>
          <div style={{ margin: '14px 2px 0', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.5, textWrap: 'pretty' }}>
            Only you see this page — it's what you bought. Every number in it is still derivable from the app's public counts, so nothing here says more than the app does.
          </div>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 15px', background: 'var(--ink)', color: 'var(--surface)' }}>
              <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--surface)', flexShrink: 0 }}></span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 800, letterSpacing: '0.16em', flexShrink: 0 }}>PAID</span>
              <span aria-hidden="true" style={{ width: 1, height: 13, background: 'color-mix(in oklch, var(--surface) 42%, transparent)', flexShrink: 0 }}></span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>asked by {p.buyer}</span>
            </div>
            <div style={{ padding: '14px 16px 15px' }}>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.22, textWrap: 'balance', color: 'var(--ink)' }}>{q.prompt}</div>
              <div style={{ marginTop: 9, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>asked for {p.window} · report compiles at the window's close</div>
            </div>
          </Card>

          <Card>
            <Kicker title="The split" right="each person's latest answer" />
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{fmt(R.T)}</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>answers · one per person</span>
            </div>
            {[[LA, R.A, cA, inkA], [LB, R.B, cB, inkB]].map((o) => (
              <div key={o[0]} style={{ marginTop: 11 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 750, color: 'var(--ink)' }}>{o[0]}</span>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}><span style={{ fontWeight: 700, color: 'var(--ink)' }}>{fmt(o[1])}</span><span style={{ color: 'var(--ink-3)' }}> · </span><span style={{ fontWeight: 800, color: o[3] }}>{Math.round((o[1] / R.T) * 100)}%</span></span>
                </div>
                <div style={{ marginTop: 5, height: 12, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}><div style={{ width: (o[1] / R.T) * 100 + '%', height: '100%', borderRadius: 999, background: o[2] }}></div></div>
              </div>
            ))}
          </Card>

          <Card>
            <Kicker title="Answers over time" right={<Legend />} />
            <div style={{ position: 'relative', height: 58, marginTop: 14 }}>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                {R.days.map((d, i) => {
                  const h = 5 + (d.t / maxDay) * 34, aH = Math.max(2, Math.round((h * d.a) / d.t));
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontFamily: 'var(--sans)', fontSize: 9.5, fontWeight: 650, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{fmt(d.t)}</span>
                      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <div style={{ height: Math.max(2, h - aH), background: cB, borderRadius: '3px 3px 1px 1px' }}></div>
                        <div style={{ height: aH, background: cA, borderRadius: '1px 1px 2px 2px' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <svg viewBox="0 0 100 58" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}><polyline points={pts} fill="none" stroke="var(--ink)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" /></svg>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {R.days.map((d, i) => <span key={i} style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--sans)', fontSize: 9.5, fontWeight: 600, color: 'var(--ink-3)' }}>{d.label}</span>)}
            </div>
            <Basis>Stacked by option per day, from the public answeredAt stamps · the line is the running total · full series: series.csv.</Basis>
          </Card>

          <Card>
            <Kicker title="Second thoughts" right="so far" />
            {[[LB, LA, R.eBA], [LA, LB, R.eAB]].map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0 1px', fontFamily: 'var(--sans)', fontSize: 12.5 }}>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{e[0]}</span>
                <span style={{ color: 'var(--ink-3)' }}>→</span>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>{e[1]}</span>
                <span style={{ flex: 1, borderBottom: '1px dotted color-mix(in oklch, var(--rule), var(--ink) 12%)', margin: '0 2px' }}></span>
                <span style={{ fontWeight: 750, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{fmt(e[2])}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 13 }}>
              {[[LA, cA, inkA, R.eBA - R.eAB], [LB, cB, inkB, R.eAB - R.eBA]].map((x) => (
                <span key={x[0]} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '0.5px solid var(--rule)', borderRadius: 999, padding: '3px 10px', background: 'var(--surface)', fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 650, color: 'var(--ink-2)' }}>
                  <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: x[1] }}></span>{x[0]}
                  <span style={{ fontWeight: 800, color: x[2], fontVariantNumeric: 'tabular-nums' }}>{(x[3] >= 0 ? '+' : '−') + fmt(Math.abs(x[3]))}</span>
                </span>
              ))}
            </div>
            <Basis>{fmt(R.eBA + R.eAB)} of {fmt(R.T)} answers changed at least once — the split counts each person's latest. Full detail: edits.csv.</Basis>
          </Card>

          <Card>
            <Kicker title="Who answered" right={<Legend />} />
            {R.groups.map((g) => (
              <div key={g.label} style={{ marginTop: 14 }}>
                <div style={{ ...K, fontSize: 9.5, color: 'var(--ink-3)', opacity: 0.85 }}>{g.label}</div>
                {g.dims.map((dim) => {
                  const open = openDim === dim.name;
                  return (
                    <div key={dim.name} style={{ borderBottom: '1px solid color-mix(in oklch, var(--rule) 62%, transparent)' }}>
                      <button className="press" onClick={() => setOpenDim(open ? null : dim.name)} aria-expanded={open}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', border: 'none', background: 'none', cursor: 'pointer', WebkitAppearance: 'none', textAlign: 'left' }}>
                        <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: open ? 800 : 650, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{dim.name}</span>
                        <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{dim.remLabel === 'Untested' ? 'tested' : 'shared by'} {fmt(dim.tested)}</span>
                        <span aria-hidden="true" style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}>▾</span>
                      </button>
                      {open && (
                        <div style={{ padding: '0 0 13px' }}>
                          {dim.rows.map((r) => <BucketRow key={r.label} r={r} cA={cA} cB={cB} inkA={inkA} inkB={inkB} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            <Basis>Every cut in the app's list — demographics, then all four tests: type, then each axis in the five bands the app colours by · cohorts as they stood at vote time · an empty bucket stays listed at zero, and small counts print exactly. The Friends cut is viewer-relative and stays in-app.</Basis>
          </Card>

          <Card>
            <Kicker title="The logic cut" right="verified in the timed in-app test" />
            <div style={{ marginTop: 2 }}>
              {R.logic.map((r) => <BucketRow key={r.label} r={r} cA={cA} cB={cB} inkA={inkA} inkB={inkB} />)}
            </div>
            <Basis>{fmt(R.verified)} of {fmt(R.T)} voters verified; quarters are against all verified users, not this question's voters. The untested row is the remainder — shown, never dropped.</Basis>
          </Card>

          <Card>
            <Kicker title="Similar questions" right="top 5 · what each side chose there" />
            {R.neighbours.map((nb, i) => (
              <div key={i} style={{ padding: '11px 0', borderBottom: i < R.neighbours.length - 1 ? '1px solid color-mix(in oklch, var(--rule) 62%, transparent)' : 'none' }}>
                <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700, lineHeight: 1.32, textWrap: 'pretty', color: 'var(--ink)' }}>{nb.prompt}</div>
                <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[[cA, LA, nb.aPick, nb.aPct, inkA], [cB, LB, nb.bPick, nb.bPct, inkB]].map((x) => (
                    <div key={x[1]} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: x[0], flexShrink: 0 }}></span>
                      <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>most chose <span style={{ fontWeight: 750, color: 'var(--ink)' }}>{x[2]}</span></span>
                      <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: x[4] }}>{x[3]}%</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 5, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>shared voters · {fmt(nb.n)}</div>
              </div>
            ))}
            <Basis>Top 5 by shared-voter correlation — the basis for a paid question. Each line: among this question's voters for that option who also answered the neighbour, what most of them chose there.</Basis>
          </Card>

          <div style={{ margin: '18px 2px 8px' }}>
            <div style={K}>In the buyer's bundle</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
              {['report.html — this page', 'roll.csv · ' + fmt(R.T) + ' rows', 'edits.csv · ' + fmt(R.eBA + R.eAB) + ' rows', 'series.csv · ' + R.days.length + ' days'].map((c) => (
                <span key={c} style={{ border: '0.5px solid var(--rule)', borderRadius: 999, padding: '3px 10px', background: 'var(--surface-2)', fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 650, color: 'var(--ink-2)' }}>{c}</span>
              ))}
            </div>
            <div style={{ marginTop: 12, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, textWrap: 'pretty' }}>The roll lists public app names and cohorts at vote time — the same who-voted list every card shows. Counts and cuts, never your profile.</div>
          </div>
        </div>
      </div>
    );
  }
  window.PaidReportOverlay = PaidReportOverlay;

  // "Questions you asked" — the buyer's own shelf, on the profile. One row per
  // paid question this account bought; the report link is the same overlay any
  // voter can open from the card. Status is the window, said plainly.
  function PaidMineCard() {
    const items = (window.WF_PAID && window.WF_PAID.items) || [];
    if (!items.length) return null;
    return (
      <div className="card" style={{ marginBottom: 16, padding: '17px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 15.5, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)' }}>Questions you asked</span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>{items.length} paid</span>
        </div>
        {items.map((q, i) => {
          const total = (q.options || []).reduce((a, o) => a + (o.count || 0), 0);
          const closed = !/this week/.test((q.paid || {}).window || '');
          return (
            <button key={q.id} className="press" onClick={() => window.openPaidReport && window.openPaidReport(q)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', border: 'none', background: 'none', cursor: 'pointer', WebkitAppearance: 'none', textAlign: 'left', borderTop: i > 0 ? '1px solid color-mix(in oklch, var(--rule) 62%, transparent)' : 'none' }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 700, lineHeight: 1.3, textWrap: 'pretty', color: 'var(--ink)' }}>{q.prompt}</span>
                <span style={{ display: 'block', marginTop: 4, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>
                  {(q.paid || {}).window} · {fmt(total)} answers · {closed ? 'window closed — report final' : 'live — report compiles as answers land'}
                </span>
              </span>
              <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>report →</span>
            </button>
          );
        })}
        <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid color-mix(in oklch, var(--rule) 62%, transparent)', fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, textWrap: 'pretty' }}>
          The report is yours alone — voters see the card's disclosure of what it contains: counts and cuts, never names.
        </div>
      </div>
    );
  }
  window.PaidMineCard = PaidMineCard;
})();

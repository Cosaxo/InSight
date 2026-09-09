// asked-by-you.jsx — "Asked by you": the buyer's room, off the account sheet
// (PAID-PLAN §7, artboard B). Every purchase this account made — questions and
// subscriptions — with live public state, the budget meter (answers ARE the
// billing unit, D164), the window hairline, and the report shelf. It reads the
// buyer's own purchase docs plus the same public aggregates everyone reads;
// there is no privileged read path, and the room's foot says so once.
(function () {
  const { useState, useEffect } = React;
  const fmt = (n) => n.toLocaleString('en-US').replace(/,/g, ' ');
  const K = { fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' };
  const useCur = () => { const [, b] = useState(0); useEffect(() => { const f = () => b((x) => x + 1); window.addEventListener('is-currency', f); return () => window.removeEventListener('is-currency', f); }, []); };

  // € · kr · $ — one preference, persisted, read everywhere a price prints
  function CurSwitch() {
    useCur();
    const P = window.WF_PAID;
    if (!P) return null;
    return (
      <span style={{ display: 'inline-flex', gap: 2, border: '0.5px solid var(--rule)', borderRadius: 999, padding: 2, background: 'var(--surface-2)', flexShrink: 0 }}>
        {Object.keys(P.CURS).map((c) => {
          const on = P.cur() === c;
          return (
            <button key={c} className="press" onClick={() => P.setCur(c)} aria-pressed={on} aria-label={'Prices in ' + c} style={{ border: 'none', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', borderRadius: 999, padding: '3px 9px', fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 800, background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--surface)' : 'var(--ink-3)', transition: 'background .16s, color .16s' }}>{P.CURS[c].sym}</button>
          );
        })}
      </span>
    );
  }
  window.CurSwitch = CurSwitch;

  function Band({ children }) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ink)', color: 'var(--surface)', borderRadius: 999, padding: '4px 11px', minWidth: 0 }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.16em', flexShrink: 0 }}>PAID</span>
        <span aria-hidden="true" style={{ width: 1, height: 12, background: 'color-mix(in oklch, var(--surface) 42%, transparent)', flexShrink: 0 }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, opacity: 0.72, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</span>
      </span>
    );
  }
  function StateChip({ label, acc, hollow }) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid ' + (hollow ? 'var(--rule)' : 'color-mix(in oklch, ' + acc + ' 40%, var(--rule))'), borderRadius: 999, padding: '3px 9px', fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: hollow ? 'var(--ink-3)' : 'color-mix(in oklch, ' + acc + ' 82%, var(--ink))', flexShrink: 0 }}>
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: hollow ? 'var(--surface-2)' : acc, border: hollow ? '1.5px solid var(--ink-3)' : 'none', boxSizing: 'border-box' }}></span>{label}
      </span>
    );
  }

  // the pulse's honest grammar: a THIN day is outlined, not placed; a day it
  // didn't serve is a blank; nothing smoothed
  const mkSeries = (n, seed, thinAt, gapAt, cut) => {
    const a = [];
    for (let i = 0; i < n; i++) {
      if (cut != null && i >= cut) { a.push({ t: 'end' }); continue; }
      const v = 3.5 + 0.35 * Math.sin(i * 0.7 + seed) + 0.18 * Math.sin(i * 2.3 + seed * 2);
      const h = Math.max(8, Math.round(10 + (v - 3) * 34));
      a.push(i === gapAt ? { t: 'gap' } : i === thinAt ? { t: 'thin', h } : { t: 'bar', h });
    }
    return a;
  };
  function Series({ cols, cut, cutLabel }) {
    return (
      <div style={{ position: 'relative', height: 50, marginTop: 8 }}>
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: 'var(--rule)' }}></div>
        {cut != null && (
          <span aria-hidden="true" style={{ position: 'absolute', left: (cut / cols.length) * 100 + '%', top: 0, bottom: 0, width: 0, borderLeft: '1px dotted var(--ink-3)' }}></span>
        )}
        {cut != null && (
          <span style={{ position: 'absolute', left: (cut / cols.length) * 100 + 1.5 + '%', top: -2, fontFamily: 'var(--sans)', fontSize: 9.5, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{cutLabel}</span>
        )}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: 3 }}>
          {cols.map((c, i) => (
            <div key={i} style={{
              flex: 1, boxSizing: 'border-box',
              height: c.t === 'bar' || c.t === 'thin' ? c.h : c.t === 'gap' ? 5 : 0,
              background: c.t === 'bar' ? 'color-mix(in oklch, var(--c-city) 55%, var(--surface-2))' : 'transparent',
              border: c.t === 'thin' ? '1.5px solid var(--c-city)' : c.t === 'gap' ? '1px dotted var(--ink-3)' : 'none',
              borderRadius: c.t === 'gap' ? 99 : '3px 3px 1px 1px',
            }}></div>
          ))}
        </div>
      </div>
    );
  }
  const SeriesBasis = () => (
    <div style={{ marginTop: 6, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45 }}>Outlined = under 8 answers that day · a missing column is a day it didn’t serve · nothing smoothed.</div>
  );

  const Row = ({ children, top }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderTop: top ? '1px solid color-mix(in oklch, var(--rule) 62%, transparent)' : 'none' }}>{children}</div>
  );
  const FileChips = ({ acc, onOpen }) => (
    <span style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
      {['HTML', 'CSV'].map((f) => (
        <button key={f} className="press" onClick={onOpen} style={{ border: '0.5px solid var(--rule)', borderRadius: 999, padding: '3px 10px', background: 'var(--surface)', cursor: onOpen ? 'pointer' : 'default', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: acc }}>{f}</button>
      ))}
    </span>
  );

  // one bought question: band + state · live public split · the budget meter
  // (answers against the cap — billing is per answer) · window hairline · shelf
  function PurchaseCard({ q }) {
    const P = window.WF_PAID;
    const p = q.paid || {};
    const total = P.total(q);
    const opts = q.options || [];
    const lead = opts[0].count >= (opts[1] || { count: 0 }).count ? 0 : 1;
    const leadPct = Math.round((opts[lead].count / total) * 100);
    const cap = (p.budget || {}).cap || 4000;
    const capEur = (p.budget || {}).capEur || 640;
    const pct = Math.min(100, Math.round((total / cap) * 100));
    const spentEur = Math.min(capEur, total * P.PRICE.perAnswer);
    const days = p.days || { left: 0, total: 1 };
    const openReport = () => window.openPaidReport && window.openPaidReport(q);
    return (
      <div className="card" style={{ marginTop: 12, padding: '13px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Band>{p.window}</Band>
          {p.closed ? <StateChip label="closed" hollow /> : <StateChip label="running" acc="var(--accent)" />}
        </div>
        <div style={{ marginTop: 10, fontFamily: 'var(--sans)', fontSize: 16.5, fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1.2, textWrap: 'pretty', color: 'var(--ink)' }}>{q.prompt}</div>
        <div style={{ display: 'flex', gap: 2, height: 10, marginTop: 10 }}>
          {opts.map((o, i) => (
            <span key={i} aria-hidden="true" style={{ width: (o.count / total) * 100 + '%', borderRadius: i === 0 ? '999px 3px 3px 999px' : '3px 999px 999px 3px', background: i === lead ? 'color-mix(in oklch, var(--accent) 45%, var(--surface-3))' : 'color-mix(in oklch, var(--ink) 14%, var(--surface-3))' }}></span>
          ))}
        </div>
        <div style={{ marginTop: 6, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 650, color: 'var(--ink-2)' }}>
          <span style={{ fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{leadPct}% {opts[lead].label}</span> · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(total)} answers</span>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={K}>budget — answers against the cap</span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{window.WF_PAID.fmt(spentEur)} of {window.WF_PAID.fmt(capEur)} cap</span>
        </div>
        <div style={{ marginTop: 6, height: 8, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
          <span style={{ display: 'block', width: pct + '%', height: '100%', borderRadius: 999, background: 'var(--accent)' }}></span>
        </div>
        <div style={{ marginTop: 5, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 650, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ fontWeight: 800, color: 'var(--ink)' }}>{fmt(total)}</span> of {fmt(cap)} budget · {pct}% — bills per answer, stops at the cap
        </div>
        <div style={{ marginTop: 11, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span aria-hidden="true" style={{ flex: 1, height: 2, borderRadius: 99, background: 'var(--surface-3)', position: 'relative', overflow: 'hidden' }}>
            <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: ((days.total - days.left) / days.total) * 100 + '%', background: 'color-mix(in oklch, var(--ink) 30%, transparent)' }}></span>
          </span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{days.left} of {days.total} days left</span>
        </div>
        <div style={{ marginTop: 11, borderTop: '1px solid color-mix(in oklch, var(--rule) 62%, transparent)' }}>
          {(p.reports || []).map((r, i) => (
            <Row key={r.label} top={i > 0}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: r.ready ? 700 : 650, color: r.ready ? 'var(--ink)' : 'var(--ink-3)' }}>{r.label}</span>
              {r.ready ? <FileChips acc="var(--accent-ink)" onOpen={openReport} /> : <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', flexShrink: 0 }}>{r.note}</span>}
            </Row>
          ))}
        </div>
      </div>
    );
  }

  // demo subscriptions — a place metric this account pays for (PAID-PLAN §5).
  // Illustrative, like WF_PAID's questions; a lapse keeps the series (law 08).
  const SUBS = [
    { id: 'sub1', metric: 'Do buses come when the app says they will?', cohort: 'Oslo', score: '4.0', since: '2 May', state: 'active', seed: 1.3, thin: 17, gap: 9 },
    { id: 'sub2', metric: 'How safe does the city feel after dark?', cohort: 'Oslo', score: '3.6', since: '12 Mar', state: 'lapsed', lapsedAt: '17 Aug', seed: 0.7, thin: 7, gap: 13 },
  ];
  function SubCard({ s }) {
    const lapsed = s.state === 'lapsed';
    const cols = mkSeries(26, s.seed, s.thin, s.gap, lapsed ? 19 : null);
    return (
      <div className="card" style={{ marginTop: 12, padding: '13px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={K}>subscription · rates: city · {s.cohort}</span>
          {lapsed ? <StateChip label="lapsed" hollow /> : <StateChip label="active" acc="var(--c-city)" />}
        </div>
        <div style={{ marginTop: 8, fontFamily: 'var(--sans)', fontSize: 16.5, fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1.2, textWrap: 'pretty', color: 'var(--ink)' }}>{s.metric}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{s.score}</span>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>{lapsed ? 'at the lapse' : 'this month'} · n 44–212 / day · since {s.since}</span>
        </div>
        <Series cols={cols} cut={lapsed ? 19 : null} cutLabel={lapsed ? 'lapsed ' + s.lapsedAt : null} />
        <SeriesBasis />
        {lapsed ? (
          <div style={{ marginTop: 10, borderTop: '1px solid color-mix(in oklch, var(--rule) 62%, transparent)', paddingTop: 10 }}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 650, color: 'var(--ink-2)', lineHeight: 1.45 }}>Paused — the series keeps its history. Re-subscribe and it continues, not forks.</div>
            <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="press" style={{ minHeight: 36, padding: '0 16px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', border: '1px solid var(--ink)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800 }}>Re-subscribe →</button>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>same qid — the series continues</span>
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 10, borderTop: '1px solid color-mix(in oklch, var(--rule) 62%, transparent)' }}>
            <Row>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>July report</span>
              <FileChips acc="color-mix(in oklch, var(--c-city) 82%, var(--ink))" />
            </Row>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>billed monthly · next report 1 Sep</div>
          </div>
        )}
      </div>
    );
  }

  function AskedByYouOverlay({ onClose }) {
    useCur();
    const items = (window.WF_PAID && window.WF_PAID.items) || [];
    return (
      <div className="overlay surface-tint">
        <div className="app-header">
          <button className="avatar-btn" onClick={onClose} aria-label="Close">✕</button>
          <div className="h-title">Asked by <em>you</em></div>
          <CurSwitch />
        </div>
        <div className="app-body" style={{ paddingTop: 0 }}>
          <div style={{ margin: '14px 2px 0', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.5, textWrap: 'pretty' }}>
            Everything this account has bought — questions and subscriptions — with their live public numbers and the report shelf. Reports are picked up here (no bells, no email — by design).
          </div>
          {items.map((q) => <PurchaseCard key={q.id} q={q} />)}
          {SUBS.map((s) => <SubCard key={s.id} s={s} />)}
          <div style={{ margin: '16px 8px 24px', fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, textAlign: 'center', textWrap: 'pretty' }}>
            Your purchase records, plus the same public numbers everyone reads — this room has no other source.
          </div>
        </div>
      </div>
    );
  }
  window.AskedByYouOverlay = AskedByYouOverlay;
})();

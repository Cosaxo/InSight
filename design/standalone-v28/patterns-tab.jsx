// patterns-tab.jsx — PATTERNS: the map, and the oracle.
//   Map    — every question placed by how much its answer predicts the others
//            (question-map.js / .jsx). This is the tab's centre.
//   Oracle — the app guesses your next answer before you give it; beat it.
// Chrome rules: ONE sub-row under the lens tabs (topic chips on the map, run
// progress on the oracle) so switching never jumps; the lens explainer is
// scaffolding that retires the first time you use the lens; and no type below
// 10.5px anywhere, in SVG or out — anything smaller gets encoded as length,
// size or colour instead.
const PT_LENSES = [{ id: 'oracle', label: 'Oracle' }, { id: 'map', label: 'Map' }];
// The same ruler the daily and the mirror wear — one axis, stops on a scale.
// Read left to right it widens: the oracle is one question about you, the map
// is the whole pool. Map sits on the right because that is the end the daily
// is on, so the two screens meet at the same edge.
function PTRuler({ lens, onLens }) {
  const idx = Math.max(0, PT_LENSES.findIndex((s) => s.id === lens));
  return (
    <div style={{ margin: '-6px 0 -2px' }}>
      <div style={{ position: 'relative', display: 'flex', height: 50 }} role="tablist" aria-label="How wide this lens looks">
        <div style={{ position: 'absolute', left: 6, right: 6, bottom: 21, height: 1, background: 'color-mix(in oklch, var(--rule), transparent 30%)' }}></div>
        {PT_LENSES.map((s, i) => {
          const on = i === idx;
          const tick = 11 - (i / (PT_LENSES.length - 1)) * 5.5;
          return (
            <button key={s.id} role="tab" aria-selected={on} aria-label={s.label}
              onClick={() => { if (s.id !== lens) { if (window.HAPTIC) window.HAPTIC.tick(); onLens(s.id); } }}
              style={{ flex: 1, minWidth: 0, position: 'relative', height: 50, border: 'none', background: 'none', cursor: 'pointer', WebkitAppearance: 'none', padding: 0 }}>
              <span style={{ position: 'absolute', left: '50%', bottom: 21, transform: 'translateX(-50%)', width: on ? 3 : 1.5, height: on ? 14 : tick, borderRadius: 99, background: on ? 'var(--accent)' : 'color-mix(in oklch, var(--ink-3), transparent 45%)', transition: 'height .28s cubic-bezier(0.2,0.8,0.2,1), background .3s, width .2s' }}></span>
              <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', whiteSpace: 'nowrap', fontFamily: 'var(--sans)', fontSize: on ? 15 : 13.5, fontWeight: on ? 800 : 600, letterSpacing: '-0.02em', color: on ? 'var(--ink)' : 'var(--ink-3)', transition: 'color .2s, font-size .2s' }}>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
const PT_NOTES = {
  map: 'Every question in the pool, placed by how much its answer predicts the others \u2014 close together means tightly tied. A solid line joins answers that travel together, a dotted one where a pick predicts the opposite. Tap any place.',
  oracle: 'It studies your past answers — your real feed votes included — then guesses your next one, sealed before you tap. Tall bar = a time you surprised it.',
};
const ptTopic = (cat) => (window.WORLD_TOPICS || []).find((t) => t.id === cat);
const ptHue = (cat) => { const t = ptTopic(cat); return t ? window.WPAL.c(t.color) : 'var(--accent)'; };
const ptInk = (cat) => { const t = ptTopic(cat); return t ? window.WPAL.ink(t.color) : 'var(--accent)'; };
const ptShort = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd().replace(/[.,;:!?…]$/, '') + '…' : s);
// arms one frame after mount — lets fills animate in from zero
function usePTArmed(key) {
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => { setArmed(false); const t = requestAnimationFrame(() => requestAnimationFrame(() => setArmed(true))); return () => cancelAnimationFrame(t); }, [key]);
  return armed;
}
// the explainer shows until you've actually used the lens once, then never again
const PT_SEEN = 'insight.patterns.used.v1';
function usePTUsed(lens) {
  const read = () => { try { return !!JSON.parse(localStorage.getItem(PT_SEEN) || '{}')[lens]; } catch (e) { return false; } };
  const [used, setUsed] = React.useState(read);
  React.useEffect(() => { setUsed(read()); }, [lens]);
  const mark = React.useCallback(() => {
    setUsed((u) => {
      if (!u) { try { const o = JSON.parse(localStorage.getItem(PT_SEEN) || '{}'); o[lens] = 1; localStorage.setItem(PT_SEEN, JSON.stringify(o)); } catch (e) {} }
      return true;
    });
  }, [lens]);
  return [used, mark];
}

// ── Oracle ──────────────────────────────────────────────────────────────────
// after an answer: where the guess landed, and which of your past answers gave
// you away
function PTOracle({ onUse }) {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.PAT.sub(force), []);
  const [rec, setRec] = React.useState(null); // last reveal, held until "next"
  const Q = window.PAT.qs();
  const curQ = rec ? Q.find((q) => q.id === rec.q) : window.PAT.nextQ();
  const m = window.PAT.meter(), log = window.PAT.log(), A = window.PAT.answers();
  const t = ptTopic(curQ ? curQ.cat : null);
  const hit = rec && rec.pred === rec.mine;
  const armed = usePTArmed(rec && rec.q);
  const called = Math.round(m.acc * m.n);
  return (
    <div className="pt-oracle">
      <div className="pt-record">
        <div className="pt-scorerow">
          <div className="pt-score"><b>{called}</b><span>of {m.n} called</span></div>
          {m.streak >= 2 && <span className="pt-streak">{m.streak} surprises running</span>}
        </div>
        <div className="pt-spark" aria-label="Your last answers — height is how much you surprised it">
          {log.slice(-18).map((r, i) => <i key={i} className={r.pred === r.mine ? '' : 'pop'} style={{ height: 6 + (Math.min(2, r.bits) / 2) * 52 + 'px' }} title={r.bits + ' bits'}></i>)}
        </div>
      </div>
      {curQ ? (
        <div className="card pt-qcard">
          <div className="pt-qhead">
            {t && <span className="pt-cat" style={{ background: window.WPAL.wash(ptHue(curQ.cat), 16), color: ptInk(curQ.cat) }}>{t.label}</span>}
            {!rec && <span className="pt-seal">guess sealed</span>}
          </div>
          <div className="pt-qbody">
            <div className="pt-prompt">{curQ.prompt}</div>
            <div className="pt-opts">
              {curQ.options.map((op, i) => rec ? (
                <div key={i} className={'pt-opt' + (i === rec.mine ? ' is-you' : '') + (i === rec.pred ? ' is-pred' : '')}>
                  {op.label}
                  {i === rec.mine && <span className="pt-tag">you</span>}
                  {i === rec.pred && <span className="pt-tag pred">oracle</span>}
                </div>
              ) : (
                <button key={i} className="pt-opt" onClick={() => { const r = window.PAT.answer(curQ.id, i); if (r) { if (window.HAPTIC) window.HAPTIC.tick(); setRec(r); if (onUse) onUse(); } }}>{op.label}</button>
              ))}
            </div>
          </div>
          {rec && (
            <div className="pt-reveal">
              <div className="pt-confbar"><i style={{ width: (armed ? Math.round(rec.conf * 100) : 0) + '%' }}></i><span><b>{Math.round(rec.conf * 100)}%</b> sure you{'\u2019'}d say {curQ.options[rec.pred].label}</span></div>
              {rec.ev && rec.ev.length > 0 && (
                <div className="pt-tell">
                  <span className="pt-tlab">{hit ? 'what gave you away' : 'it leaned on'}</span>
                  {rec.ev.map((id) => { const q = Q.find((x) => x.id === id); if (!q || A[id] == null) return null; return <span key={id} className="pt-chip" style={{ background: window.WPAL.wash(ptHue(q.cat), 14), color: ptInk(q.cat) }}>{ptShort(q.options[A[id]].label, 20)}</span>; })}
                </div>
              )}
              <div className="pt-verdict">
                <b style={!hit ? { color: 'var(--accent)' } : undefined}>{hit ? 'Called it.' : 'You surprised it.'}</b>
                <span>{hit ? 'predictable, this once' : '+' + rec.bits.toFixed(2) + ' bits of you'}</span>
              </div>
              <button className="pt-next" onClick={() => setRec(null)}>Next question</button>
            </div>
          )}
        </div>
      ) : (
        <div className="card pt-done">
          <div>You answered all {Q.length}.</div>
          <p>The oracle has nothing left to guess.</p>
          <button className="pt-next" onClick={() => window.PAT.reset()}>Start over</button>
        </div>
      )}
    </div>
  );
}

function PatternsTab() {
  const [lens, setLens] = React.useState('map');
  const [topic, setTopic] = React.useState('all');
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.PAT.sub(force), []);
  const [used, markUsed] = usePTUsed(lens);
  const st = window.PAT.stats();
  // only topics that actually have questions in the pool
  const cats = [...new Set(window.PAT.qs().map((q) => q.cat))];
  const chips = [{ id: 'all', label: 'All' }].concat(cats.map((c) => ({ id: c, label: (ptTopic(c) || {}).label || c })));
  return (
    <div className="pt-wrap">
      <PTRuler lens={lens} onLens={setLens}></PTRuler>
      <div className="pt-sub">
        {lens === 'map' ? (
          <div className="pt-pops h-scroll" role="tablist" aria-label="Topic">
            {chips.map((p) => (
              <button key={p.id} role="tab" aria-selected={topic === p.id} className={'pt-pop' + (topic === p.id ? ' is-on' : '')} onClick={() => setTopic(p.id)}>{p.label}</button>
            ))}
          </div>
        ) : (
          <div className="pt-prog" title={st.fromFeed + ' of your answers came from feed votes'}>
            <span className="pt-progtrack"><i style={{ width: Math.round((st.answered / st.total) * 100) + '%' }}></i></span>
            <span className="pt-prognum">{st.answered}<em>/{st.total}</em></span>
          </div>
        )}
      </div>
      <div key={lens} className="fade-in pt-stack">
        {!used && <div className="pt-note">{PT_NOTES[lens]}</div>}
        {lens === 'map' && <window.QuestionMap topic={topic} onUse={markUsed}></window.QuestionMap>}
        {lens === 'oracle' && <PTOracle onUse={markUsed}></PTOracle>}
      </div>
    </div>
  );
}
Object.assign(window, { PatternsTab });

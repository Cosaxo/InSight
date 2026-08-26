// patterns-tab.jsx — PATTERNS: the map, and the oracle.
//   Map    — every question placed by how much its answer predicts the others
//            (question-map.js / .jsx). This is the tab's centre.
//   Oracle — the app guesses your next answer before you give it; beat it.
//            One instrument, no card (oracle.jsx / oracle.css).
// Chrome rules: ONE sub-row under the lens tabs (topic chips on the map, run
// progress on the oracle) so switching never jumps; each lens teaches its own
// marks (the footer legend on the map cards, the one-time hints on the oracle)
// — no separate explainer card; and no type below 10.5px anywhere, in SVG or
// out — anything smaller gets encoded as length, size or colour instead.
const PT_LENSES = [{ id: 'oracle', label: 'Oracle' }, { id: 'map', label: 'Question map' }, { id: 'people', label: 'People map' }];
// The same ruler the daily and the mirror wear — one axis, stops on a scale.
// Read left to right it widens: the oracle is one question about you, the
// question map is the whole pool, the people map is the whole crowd.
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
const ptTopic = (cat) => (window.WORLD_TOPICS || []).find((t) => t.id === cat);

function PatternsTab() {
  const [lens, setLensRaw] = React.useState('map');
  // slide the incoming lens from the side you moved toward on the ruler
  const dirRef = React.useRef('');
  const setLens = (id) => setLensRaw((cur) => {
    if (id === cur) return cur;
    const a = PT_LENSES.findIndex((s) => s.id === cur), b = PT_LENSES.findIndex((s) => s.id === id);
    dirRef.current = b > a ? 'r' : 'l';
    return id;
  });
  const [topic, setTopic] = React.useState('all');
  const [ppop, setPpop] = React.useState('world');
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.PAT.sub(force), []);
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
              <button key={p.id} role="tab" aria-selected={topic === p.id} className={'pt-pop' + (topic === p.id ? ' is-on' : '')} onClick={() => setTopic(p.id)}>
                {p.id !== 'all' && <i className="pt-dot" style={{ background: window.WPAL.c((ptTopic(p.id) || {}).color) }}></i>}
                {p.label}
              </button>
            ))}
          </div>
        ) : lens === 'people' ? (
          <div className="pt-pops h-scroll" role="tablist" aria-label="Population">
            {window.PAT.pops().map((p) => (
              <button key={p.id} role="tab" aria-selected={ppop === p.id} className={'pt-pop' + (ppop === p.id ? ' is-on' : '')} onClick={() => setPpop(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="pt-prog">
            <span className="pt-progtrack"><i style={{ width: Math.round((st.answered / st.total) * 100) + '%' }}></i></span>
            <span className="pt-prognum">{st.answered}<em>/{st.total}</em></span>
            {st.fromFeed > 0 && <span style={{ flex: 'none', fontSize: 11, fontWeight: 650, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{st.fromFeed} from feed votes</span>}
          </div>
        )}
      </div>
      <div key={lens} className={(dirRef.current ? 'pt-slide-' + dirRef.current : 'fade-in') + ' pt-stack'}>
        {lens === 'map' && <window.QuestionMap topic={topic}></window.QuestionMap>}
        {lens === 'oracle' && <window.OracleLens></window.OracleLens>}
        {lens === 'people' && window.PeopleLens && <window.PeopleLens pop={ppop} onOracle={() => setLens('oracle')}></window.PeopleLens>}
      </div>
    </div>
  );
}
Object.assign(window, { PatternsTab });

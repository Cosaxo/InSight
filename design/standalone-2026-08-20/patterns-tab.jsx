// patterns-tab.jsx — PATTERNS: the map, and the oracle.
//   Map    — every question placed by how much its answer predicts the others
//            (question-map.js / .jsx). This is the tab's centre.
//   Oracle — the app guesses your next answer before you give it; beat it.
//            One instrument, no card (oracle.jsx / oracle.css).
// Chrome rules: ONE sub-row under the lens tabs (topic chips on the map, run
// progress on the oracle) so switching never jumps; the lens explainer is
// scaffolding that retires the first time you use the lens; and no type below
// 10.5px anywhere, in SVG or out — anything smaller gets encoded as length,
// size or colour instead.
const PT_LENSES = [{ id: 'oracle', label: 'Oracle' }, { id: 'map', label: 'Map' }, { id: 'people', label: 'People' }];
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
  oracle: 'It reads your past answers — feed votes included — and seals a guess before you tap. The taller fill is the side it called; a mark up on the ledger is a time you broke it.',
  people: 'Real people who share your questions, placed by their answers — close together means alike. You sit wherever your answers put you, not at the centre. Fainter = fewer shared answers. Tap anyone.',
};
const ptTopic = (cat) => (window.WORLD_TOPICS || []).find((t) => t.id === cat);
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

function PatternsTab() {
  const [lens, setLens] = React.useState('map');
  const [topic, setTopic] = React.useState('all');
  const [ppop, setPpop] = React.useState('world');
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
          <div className="pt-prog" title={st.fromFeed + ' of your answers came from feed votes'}>
            <span className="pt-progtrack"><i style={{ width: Math.round((st.answered / st.total) * 100) + '%' }}></i></span>
            <span className="pt-prognum">{st.answered}<em>/{st.total}</em></span>
          </div>
        )}
      </div>
      <div key={lens} className="fade-in pt-stack">
        {!used && <div className="pt-note">{PT_NOTES[lens]}</div>}
        {lens === 'map' && <window.QuestionMap topic={topic} onUse={markUsed}></window.QuestionMap>}
        {lens === 'oracle' && <window.OracleLens onUse={markUsed}></window.OracleLens>}
        {lens === 'people' && window.PeopleLens && <window.PeopleLens pop={ppop} onUse={markUsed} onOracle={() => setLens('oracle')}></window.PeopleLens>}
      </div>
    </div>
  );
}
Object.assign(window, { PatternsTab });

// paths-card.jsx — CROSSROADS in the feed (paths-data.js). Walk a story three
// forks deep; the reveal is the whole tree — the crowd's flow through every
// branch, your road inked, your ending named, and how rare the walk was.
const ppC = (h) => window.WPAL.c(`oklch(0.52 0.14 ${h})`);
const ppInk = (h) => window.WPAL.ink(`oklch(0.52 0.14 ${h})`);

function PathsTree({ st, walk }) {
  const W = 372, H = 236, xs = [16, 128, 240, 352];
  const yOf = (key) => {
    const d = key.length; if (!d) return H / 2;
    let idx = 0; for (const ch of key) idx = idx * 2 + (ch === 'B' ? 1 : 0);
    return (idx + 0.5) * (H / Math.pow(2, d));
  };
  const keys = [];
  ['A', 'B'].forEach((a) => { keys.push(a); ['A', 'B'].forEach((b) => { keys.push(a + b); ['A', 'B'].forEach((c) => keys.push(a + b + c)); }); });
  const end = st.endings[walk];
  return (
    <svg className="pt-svg" viewBox={`0 0 ${W} ${H}`} style={{ marginTop: 14 }}>
      {keys.map((k) => {
        const x1 = xs[k.length - 1], y1 = yOf(k.slice(0, -1)), x2 = xs[k.length], y2 = yOf(k);
        const mx = (x1 + x2) / 2;
        const f = window.PATHS.flowOf(st.id, k);
        const on = walk.startsWith(k);
        return <path key={k} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} fill="none"
          stroke={on ? 'var(--pp-ink)' : 'color-mix(in oklch, var(--pp-c), var(--surface) 56%)'}
          strokeWidth={Math.max(1.4, f * 20)} strokeLinecap="round" opacity={on ? 1 : 0.9}></path>;
      })}
      <circle cx={xs[0]} cy={H / 2} r="4.5" fill="var(--pp-ink)"></circle>
      {keys.filter((k) => k.length === 3).map((k) => (
        <circle key={k} cx={xs[3]} cy={yOf(k)} r={k === walk ? 5 : 2.6} fill={k === walk ? 'var(--pp-ink)' : 'color-mix(in oklch, var(--pp-c), var(--surface) 40%)'}></circle>
      ))}
      {end && <text x={xs[3] - 10} y={yOf(walk) + (yOf(walk) < 18 ? 14 : -9)} textAnchor="end" fontSize="10.5" fontWeight="800" fill="var(--pp-ink)">{end.name}</text>}
    </svg>
  );
}

function PathsCard() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => window.PATHS.sub(force), []);
  const stories = window.PATHS.stories();
  const [sid, setSid] = React.useState(stories[0].id);
  const st = window.PATHS.storyOf(sid);
  const walk = window.PATHS.walkOf(sid);
  const done = walk.length >= 3;
  const node = done ? null : st.nodes[walk];
  const end = done ? st.endings[walk] : null;
  const flow = done ? window.PATHS.flowOf(sid, walk) : 0;
  const style = { '--pp-c': ppC(st.hue), '--pp-ink': ppInk(st.hue) };
  return (
    <div className="card" style={style}>
      <div className="ar-head">
        <span className="ar-kick" style={{ color: 'var(--pp-ink)' }}>Crossroads</span>
        <span className="pp-steps">{[0, 1, 2].map((i) => <i key={i} className={i < walk.length ? 'on' : ''}></i>)}</span>
      </div>
      <div className="ar-name">{st.title}</div>
      {!done && (
        <>
          <div className="ar-rule">{walk ? node.q : st.intro}</div>
          {!walk && <div className="pp-q">{node.q}</div>}
          <div className="pp-choices">
            {node.a.map((c, i) => (
              <button key={i} className="pp-choice" onClick={() => { if (window.HAPTIC) window.HAPTIC.tick(); window.PATHS.choose(sid, i); }}>{c.t}</button>
            ))}
          </div>
        </>
      )}
      {done && (
        <>
          <PathsTree st={st} walk={walk}></PathsTree>
          <div className="pp-end">
            <b>{end.name}</b>
            <div className="pp-line">{end.line}</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
              <span className="ar-chip" style={{ background: 'color-mix(in oklch, var(--pp-c), var(--surface) 82%)', color: 'var(--pp-ink)' }}>you and {Math.round(flow * 100)}% ended here</span>
              <span className="ar-chip" style={{ background: 'color-mix(in oklch, var(--pp-c), var(--surface) 82%)', color: 'var(--pp-ink)' }}>1 in {Math.max(2, Math.round(1 / flow))} walks your road</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="ar-next" style={{ borderColor: 'var(--rule)', color: 'var(--ink-3)' }} onClick={() => window.PATHS.reset(sid)}>Walk again</button>
          </div>
        </>
      )}
    </div>
  );
}
// the map's Crossroads leaf: the walked road, small — tree, ending, rarity
function MTPathsCard({ node }) {
  const st = window.PATHS.storyOf(node.sid);
  const walk = window.PATHS.walkOf(node.sid);
  if (!st || walk.length < 3) return null;
  const end = st.endings[walk], f = window.PATHS.flowOf(node.sid, walk);
  return (
    <div style={{ '--pp-c': ppC(st.hue), '--pp-ink': ppInk(st.hue), '--hue': st.hue }}>
      <div className="mmt-kicker"><span className="mmt-dot"></span>Crossroads</div>
      <div className="mmt-title" style={{ marginTop: 4 }}>{st.title}</div>
      <PathsTree st={st} walk={walk}></PathsTree>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 6, flexWrap: 'wrap' }}>
        <b style={{ fontFamily: 'var(--sans)', fontSize: 14.5, color: 'var(--ink)' }}>{end.name}</b>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>1 in {Math.max(2, Math.round(1 / f))} walks this road</span>
      </div>
    </div>
  );
}
Object.assign(window, { PathsCard, PathsTree, MTPathsCard });

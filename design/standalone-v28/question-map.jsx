// question-map.jsx — the Map lens: every question in the pool as one place, laid
// out so that distance IS how much two answers predict each other.
//
// What the picture says, with no legend to read:
//   position  · close together = strongly tied, either way (the factor plane)
//   colour    · the topic it came from
//   size      · how tied the question is to everything else
//   filled    · you have answered it; hollow = still open
//   line      · a strong pair — solid when the popular picks go together,
//               dotted when one predicts the other side
// Tap a place and the map dims to that question's own web; the card underneath
// says the link out loud: "Pick this — and 78% pick that."
(function () {
  const W = 344, H = 330, PAD = 16;

  function QuestionMap({ topic, onUse }) {
    const [sel, setSel] = React.useState(null);
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => window.PAT.sub(force), []);
    const Q = window.PAT.qs(), A = window.PAT.answers();
    const PL = window.QMAP.plane(W, H, PAD);
    const hubs = window.QMAP.hubs();
    const all = window.QMAP.edges(3);
    const pick = (i) => { setSel((s) => (s === i ? null : i)); if (window.HAPTIC) window.HAPTIC.tick(); if (onUse) onUse(); };

    // the drawn web: the strongest links overall, or — once a question is
    // chosen — that question's own, so the plane never reads as a hairball
    const nb = sel == null ? null : window.QMAP.near(sel, 3);
    const shown = sel == null ? all : nb.map((x) => ({ i: sel, j: x.j, r: x.r }));
    const near = sel == null ? null : new Set(nb.map((x) => x.j));
    const inTopic = (i) => topic === 'all' || Q[i].cat === topic;

    const hue = (i) => { const t = (window.WORLD_TOPICS || []).find((x) => x.id === Q[i].cat); return t ? window.WPAL.c(t.color) : 'var(--ink-3)'; };
    const ink = (i) => { const t = (window.WORLD_TOPICS || []).find((x) => x.id === Q[i].cat); return t ? window.WPAL.ink(t.color) : 'var(--ink-2)'; };
    const rOf = (i) => 3.1 + (hubs[i] / (Math.max(...hubs) || 1)) * 3.9;

    const say = sel == null ? null : nb.map((x) => window.QMAP.say(sel, x.j)).filter(Boolean);
    const q = sel == null ? null : Q[sel];

    return (
      <>
        <div className="card qm-card">
          <svg className="qm-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Every question, placed by how much its answer predicts the others">
            <g>
              {shown.map((l, k) => {
                const a = PL.pts[l.i], b = PL.pts[l.j];
                const lit = sel != null;
                const on = lit || (inTopic(l.i) && inTopic(l.j));
                return (
                  <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={lit ? hue(sel) : 'var(--ink-3)'}
                    strokeWidth={lit ? 1.1 + Math.abs(l.r) * 3.4 : 0.5 + Math.abs(l.r) * 1.6}
                    strokeDasharray={l.r < 0 ? '2.5 3' : undefined}
                    strokeLinecap="round"
                    opacity={on ? (lit ? 0.72 : l.r < 0 ? 0.2 : 0.28) : 0.06}></line>
                );
              })}
            </g>
            <g>
              {PL.pts.map((p) => {
                const i = p.i, answered = A[Q[i].id] != null;
                const dim = sel != null ? (i !== sel && !near.has(i)) : !inTopic(i);
                const r = rOf(i);
                return (
                  <g key={i} onClick={() => pick(i)} style={{ cursor: 'pointer' }}>
                    <circle cx={p.x} cy={p.y} r={Math.max(11, r + 6)} fill="transparent"></circle>
                    {i === sel && <circle cx={p.x} cy={p.y} r={r + 5} fill="none" stroke={hue(i)} strokeWidth="1.4" opacity="0.55"></circle>}
                    <circle cx={p.x} cy={p.y} r={r}
                      fill={answered ? hue(i) : 'var(--surface)'}
                      stroke={hue(i)} strokeWidth={answered ? 0 : 1.5}
                      opacity={dim ? 0.22 : 1}></circle>
                  </g>
                );
              })}
            </g>
          </svg>
          <div className="qm-legend">
            <span><i className="qm-dot is-full"></i>answered</span>
            <span><i className="qm-dot"></i>open</span>
            <span><i className="qm-line"></i>together</span>
            <span><i className="qm-line is-dash"></i>opposite</span>
          </div>
        </div>

        {q ? (
          <div className="card qm-read">
            <div className="qm-qhead">
              <span className="pt-cat" style={{ background: window.WPAL.wash(hue(sel), 16), color: ink(sel) }}>
                {((window.WORLD_TOPICS || []).find((x) => x.id === q.cat) || {}).label || 'question'}
              </span>
              {A[q.id] != null ? <span className="qm-yours">you said {q.options[A[q.id]].label}</span> : null}
            </div>
            <div className="qm-prompt">{q.prompt}</div>
            {A[q.id] == null && (
              <div className="qm-opts">
                {q.options.map((op, k) => (
                  <button key={k} className="qm-opt" onClick={() => { window.PAT.answer(q.id, k); if (window.HAPTIC) window.HAPTIC.tick(); }}>{op.label}</button>
                ))}
              </div>
            )}
            <div className="qm-says">
              {say.map((s, k) => (
                <div className="qm-say" key={k}>
                  <span className="qm-saytext">
                    Pick <b>{s.pick}</b> here{'\u2009\u2014\u2009'}and <b>{s.pct}%</b> pick <b>{s.then}</b> on {'\u201c' + s.to.prompt + '\u201d'}
                  </span>
                  <span className="qm-saybar">
                    <i style={{ width: s.pct + '%', background: window.WPAL.wash(hue(sel), 44) }}></i>
                    <em style={{ left: s.base + '%' }} title={'usually ' + s.base + '%'}></em>
                  </span>
                  {s.youFollowed === false && <span className="qm-break">you went {s.other}</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card qm-read">
            <div className="qm-idle">
              <b>{all.length}</b>
              <span>links hold across the {Q.length} questions in the pool. Tap any place to read its own.</span>
            </div>
          </div>
        )}
      </>
    );
  }

  Object.assign(window, { QuestionMap });
})();

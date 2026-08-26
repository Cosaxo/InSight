// question-map.jsx — the Map lens: every question in the pool as one place, laid
// out so that distance IS how much two answers predict each other.
//
// What the picture says, with no legend to read:
//   position  · close together = strongly tied, either way (the factor plane)
//   ink       · solid dot = answered, hollow ring = still open — the field is
//               neutral at rest; topic colour appears only where it carries
//               meaning: the tapped web, an active topic filter, the next dot
//   size      · three steps — hub / mid / leaf — how tied to everything else
//   line      · a strong pair — solid when the popular picks go together,
//               dotted when one predicts the other side
// Tap a place and the map dims to that question's own web; the card underneath
// says the link out loud: "Pick this — and 78% pick that."
(function () {
  const W = 344, H = 330, PAD = 16;

  function QuestionMap({ topic, onUse }) {
    const [sel, setSel] = React.useState(null);
    const [burst, setBurst] = React.useState(null); // {i, t} — the dot just answered, for the reward beat
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => window.PAT.sub(force), []);
    const Q = window.PAT.qs(), A = window.PAT.answers();
    const PL = window.QMAP.plane(W, H, PAD);
    const hubs = window.QMAP.hubs();
    const all = window.QMAP.edges(3);
    const pick = (i) => { setSel((s) => (s === i ? null : i)); if (window.HAPTIC) window.HAPTIC.tick(); if (onUse) onUse(); };
    const inTopic = (i) => topic === 'all' || Q[i].cat === topic;

    // the drawn web: at rest only the strongest ties — every link at once is a
    // hairball, and a hairball hides the thing the map is for. Once a question
    // is chosen the plane dims to that question's own three.
    const nb = sel == null ? null : window.QMAP.near(sel, 3);
    const near = sel == null ? null : new Set(nb.map((x) => x.j));
    const rest = all.filter((l) => inTopic(l.i) && inTopic(l.j)).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    const shown = sel == null ? rest : nb.map((x) => ({ i: sel, j: x.j, r: x.r }));
    // the resting figure: the ten strongest ties drawn at full voice, so the map
    // shows a constellation before any tap. Its member dots stay fully inked.
    const figN = 10;
    const figDots = sel == null ? new Set(rest.slice(0, figN).flatMap((l) => [l.i, l.j])) : new Set();

    // topic hues (muted weight, shared with the relationship map) — worn only
    // by dots that currently MEAN something: the tapped web, an active topic
    // filter, the next-up beacon. Everything else stays ink on paper.
    const catHue = (i) => { const t = (window.WORLD_TOPICS || []).find((x) => x.id === Q[i].cat); const m = t && /([-\d.]+)\s*\)\s*$/.exec(t.color); return m ? parseFloat(m[1]) : null; };
    // same weight as the relationship-map circles: oklch(0.605 0.118 h)
    const soft = (h) => 'oklch(0.605 0.118 ' + h + ')';
    const softTint = (h) => 'oklch(0.87 0.062 ' + h + ')';
    const softInk = (h) => 'oklch(0.54 0.118 ' + h + ')';
    const tint = (i) => { const h = catHue(i); return h == null ? 'var(--surface)' : softTint(h); };
    const hue = (i) => { const h = catHue(i); return h == null ? 'var(--ink-3)' : soft(h); };
    const ink = (i) => { const h = catHue(i); return h == null ? 'var(--ink-2)' : softInk(h); };
    // three discrete sizes — the old 4px continuum read as jitter, not hierarchy
    const rOf = (i) => { const h = hubs[i] / (Math.max(...hubs) || 1); return h > 0.72 ? 7.4 : h > 0.42 ? 4.9 : 3.2; };
    // the neutral field wears the page's own dusk indigo, not hard ink
    const fSolid = 'color-mix(in oklab, var(--accent) 68%, var(--ink-2))';
    const fEdge = 'color-mix(in oklab, var(--accent) 34%, var(--ink-3))';
    // the People lens grammar, carried over: each place wears its own muted hue
    // (the person-dot recipe at the topic's hue), sits on a surface gap-halo so
    // close dots stay crisp, and loosely-tied places are fainter — confidence
    // fades, it never lies.
    const hubMax = Math.max(...hubs) || 1;
    const restFill = (i) => { const h = catHue(i); return h == null ? fSolid : 'oklch(0.56 0.09 ' + h + ')'; };
    const restOp = (i) => (figDots.has(i) ? 1 : 0.55 + Math.min(1, hubs[i] / hubMax / 0.72) * 0.45);
    const colored = (i) => (sel != null ? i === sel || near.has(i) : i === nxt || (topic !== 'all' && inTopic(i)));

    const say = sel == null ? null : nb.map((x) => window.QMAP.say(sel, x.j)).filter(Boolean);
    const q = sel == null ? null : Q[sel];
    // the unanswered question most tied to everything else — the best next tap
    let nxt = null;
    if (sel == null) { let best = -1; Q.forEach((x, i) => { if (A[x.id] == null && inTopic(i) && hubs[i] > best) { best = hubs[i]; nxt = i; } }); }
    // idle card leads with the strongest tie under the current topic filter
    const top = sel == null && rest.length ? rest[0] : null;
    const topSay = top ? window.QMAP.say(top.i, top.j) : null;
    const nAns = Q.filter((x) => A[x.id] != null).length;

    return (
      <>
        <div className="card qm-card">
          <svg className="qm-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Every question, placed by how much its answer predicts the others" onClick={() => { if (sel != null) setSel(null); }}>
            <g>
              {shown.map((l, k) => {
                const a = PL.pts[l.i], b = PL.pts[l.j];
                const lit = sel != null;
                const fig = !lit && k < figN; // the constellation tier — clearly drawn at rest
                const strong = lit || k < 24; // full web faint, the strongest two dozen speak
                const bt = lit && burst && burst.i === sel ? burst.t : '';
                const draw = lit && l.r >= 0; // opposite links keep their dashes — the dash IS the meaning
                return (
                  <line key={l.i + '-' + l.j + bt} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    pathLength={draw ? 1 : undefined}
                    className={draw ? 'qm-drawin' : undefined}
                    style={draw ? { animationDelay: k * 0.07 + 's' } : undefined}
                    stroke={lit ? hue(sel) : fig ? 'color-mix(in oklab, var(--accent) 55%, var(--ink-2))' : fEdge}
                    strokeWidth={lit ? 1 + Math.abs(l.r) * 2.8 : fig ? 1.2 + Math.abs(l.r) * 2.4 : strong ? 0.9 + Math.abs(l.r) * 2 : 0.7}
                    strokeDasharray={l.r < 0 ? '2.5 3' : undefined}
                    strokeLinecap="round"
                    opacity={lit ? 0.58 : fig ? 0.38 + Math.abs(l.r) * 0.3 : strong ? 0.22 + Math.abs(l.r) * 0.16 : 0.12}></line>
                );
              })}
            </g>
            <g>
              {PL.pts.map((p) => {
                const i = p.i, answered = A[Q[i].id] != null;
                const dim = sel != null ? (i !== sel && !near.has(i)) : !inTopic(i);
                const on = colored(i);
                const r = rOf(i);
                return (
                  <g key={i} onClick={(e) => { e.stopPropagation(); pick(i); }} style={{ cursor: 'pointer' }}>
                    <circle cx={p.x} cy={p.y} r={Math.max(11, r + 6)} fill="transparent"></circle>
                    {i === sel && <circle cx={p.x} cy={p.y} r={r + 5} fill="none" stroke={hue(i)} strokeWidth="1.4" opacity="0.55"></circle>}
                    {burst && burst.i === i && <circle key={'b' + burst.t} className="qm-bloom" cx={p.x} cy={p.y} r={r + 6} fill="none" stroke={hue(i)} strokeWidth="2"></circle>}
                    <circle cx={p.x} cy={p.y} r={r + 2} fill="var(--surface-2)" opacity={dim ? 0.25 : on ? 1 : restOp(i)}></circle>
                    <circle key={burst && burst.i === i ? 'd' + burst.t : 'd'}
                      className={burst && burst.i === i ? 'qm-pop' : undefined}
                      cx={p.x} cy={p.y} r={r}
                      fill={answered ? (on ? hue(i) : restFill(i)) : (on ? tint(i) : 'var(--surface-2)')}
                      stroke={answered ? 'none' : on ? hue(i) : restFill(i)} strokeWidth={answered ? 0 : on ? 2 : 1.5}
                      opacity={dim ? 0.25 : on ? 1 : restOp(i)}></circle>
                  </g>
                );
              })}
            </g>
            {/* the next-up beacon rides its own top layer — drawn after every dot so
                neither the ring nor the label is ever buried by a neighbour */}
            {nxt != null && (() => {
              const p = PL.pts.find((x) => x.i === nxt);
              if (!p) return null;
              const r = rOf(nxt);
              return (
                <g onClick={(e) => { e.stopPropagation(); pick(nxt); }} style={{ cursor: 'pointer' }}>
                  <circle cx={p.x} cy={p.y} r={Math.max(14, r + 9)} fill="transparent"></circle>
                  <circle cx={p.x} cy={p.y} r={r + 3.5} fill="none" stroke="var(--accent)" strokeWidth="1.4" pointerEvents="none"></circle>
                  <circle className="qm-pulse" cx={p.x} cy={p.y} r={r + 3} fill="none" stroke="var(--accent)" strokeWidth="1.5"></circle>
                  <text className="qm-nextlab" x={Math.max(42, Math.min(W - 42, p.x))} y={p.y > H - 26 ? p.y - r - 9 : p.y + r + 15} textAnchor="middle" fill="var(--ink)" style={{ paintOrder: 'stroke', stroke: 'var(--surface-2)', strokeWidth: 3.5 }}>answer next</text>
                </g>
              );
            })()}
          </svg>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '6px 6px 9px', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>
            <i className="qm-line"></i><span>together</span>
            <span style={{ color: 'var(--rule)' }}>{'\u00b7'}</span>
            <i className="qm-line is-dash"></i><span>opposite</span>
            <span style={{ color: 'var(--rule)' }}>{'\u00b7'}</span>
            <i className="qm-dot is-fill"></i><span>answered</span>
            <span style={{ color: 'var(--rule)' }}>{'\u00b7'}</span>
            <i className="qm-dot"></i><span>open</span>
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
                  <button key={k} className="qm-opt" onClick={() => { window.PAT.answer(q.id, k); setBurst({ i: sel, t: Date.now() }); if (window.HAPTIC) window.HAPTIC.tick(); }}>{op.label}</button>
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
                    <em style={{ left: s.base + '%' }}></em>
                  </span>
                  <span className="qm-base"><span style={{ left: Math.max(12, Math.min(86, s.base)) + '%' }}>usually {s.base}%</span></span>
                  {s.youFollowed === false && <span className="qm-break">you went {s.other}</span>}
                </div>
              ))}
            </div>
            {say.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid color-mix(in oklch, var(--rule), transparent 30%)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textWrap: 'pretty' }}>
                Each tie is a straight count over everyone who answered both {'\u00b7'} the {'\u201c'}usually{'\u201d'} mark is how the crowd splits regardless.
              </div>
            )}
          </div>
        ) : (
          <div className="card qm-read">
            {topSay ? (
              <button className="qm-top" onClick={() => pick(top.i)}>
                <span className="qm-toplab" style={{ background: window.WPAL.wash(hue(top.i), 16), color: ink(top.i) }}>strongest tie</span>
                <span className="qm-tie">
                  <i className="qm-tie-dot" style={{ background: A[Q[top.i].id] != null ? hue(top.i) : tint(top.i), border: '1.5px solid ' + hue(top.i) }}></i>
                  <span className="qm-tie-row"><em>{'\u201c' + topSay.from.prompt + '\u201d'}</em><b className="qm-tie-pick" style={{ background: window.WPAL.wash(hue(top.i), 16), color: ink(top.i) }}>{topSay.pick}</b></span>
                  <i className="qm-tie-rail" style={{ background: hue(top.i) }}></i>
                  <span className="qm-tie-then" style={{ color: ink(top.i) }}><b>{topSay.pct}%</b> then pick</span>
                  <i className="qm-tie-dot" style={{ background: A[Q[top.j].id] != null ? hue(top.j) : tint(top.j), border: '1.5px solid ' + hue(top.j) }}></i>
                  <span className="qm-tie-row"><em>{'\u201c' + topSay.to.prompt + '\u201d'}</em><b className="qm-tie-pick" style={{ background: window.WPAL.wash(hue(top.j), 16), color: ink(top.j) }}>{topSay.then}</b></span>
                </span>
              </button>
            ) : (
              <div className="qm-idle">
                <b>{all.length}</b>
                <span>links hold across the {Q.length} questions in the pool; the strongest are drawn. Tap any place to read its own.</span>
              </div>
            )}
            {topSay && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 14 }}>
                <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{nAns}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.4, textWrap: 'pretty' }}>
                  of the <b style={{ color: 'var(--ink)', fontWeight: 700 }}>{Q.length} questions</b> here are answered {'\u00b7'} <b style={{ color: 'var(--ink)', fontWeight: 700 }}>{all.length} ties</b> hold between them.
                </span>
              </div>
            )}
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid color-mix(in oklch, var(--rule), transparent 30%)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textWrap: 'pretty' }}>
              Close together = answers that predict each other {'\u00b7'} drawn from the crowd's latest answers.
            </div>
          </div>
        )}
      </>
    );
  }

  Object.assign(window, { QuestionMap });
})();

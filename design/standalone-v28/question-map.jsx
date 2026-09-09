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
    const inTopic = (i) => topic === 'all' || Q[i].cat === topic;

    // the drawn web: at rest only the strongest ties — every link at once is a
    // hairball, and a hairball hides the thing the map is for. Once a question
    // is chosen the plane dims to that question's own three.
    const nb = sel == null ? null : window.QMAP.near(sel, 3);
    const near = sel == null ? null : new Set(nb.map((x) => x.j));
    const rest = all.filter((l) => inTopic(l.i) && inTopic(l.j)).sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 40);
    const shown = sel == null ? rest : nb.map((x) => ({ i: sel, j: x.j, r: x.r }));

    // this map alone wears the topic hues MUTED — same wheel, pastel weight
    // (fills lifted to L .75 / C .06, text held darker but softened), so the
    // plane reads as one quiet field instead of confetti.
    const catHue = (i) => { const t = (window.WORLD_TOPICS || []).find((x) => x.id === Q[i].cat); const m = t && /([-\d.]+)\s*\)\s*$/.exec(t.color); return m ? parseFloat(m[1]) : null; };
    // same weight as the relationship-map circles: oklch(0.605 0.118 h)
    const soft = (h) => 'oklch(0.605 0.118 ' + h + ')';
    const softTint = (h) => 'oklch(0.87 0.062 ' + h + ')';
    const softInk = (h) => 'oklch(0.54 0.118 ' + h + ')';
    const tint = (i) => { const h = catHue(i); return h == null ? 'var(--surface)' : softTint(h); };
    const hue = (i) => { const h = catHue(i); return h == null ? 'var(--ink-3)' : soft(h); };
    const ink = (i) => { const h = catHue(i); return h == null ? 'var(--ink-2)' : softInk(h); };
    const rOf = (i) => 3.8 + (hubs[i] / (Math.max(...hubs) || 1)) * 4.4;

    // topic territories — one soft wash + small-caps label per topic cluster,
    // so the idle plane reads as named country rather than confetti (matches
    // the constellation Map's territory language)
    const blobs = [];
    {
      const acc = {};
      PL.pts.forEach((p) => { const c = Q[p.i].cat; (acc[c] = acc[c] || []).push(p); });
      Object.keys(acc).forEach((cid) => {
        const pts = acc[cid];
        if (pts.length < 3) return;
        const t = (window.WORLD_TOPICS || []).find((x) => x.id === cid);
        if (!t) return;
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        const spread = Math.sqrt(pts.reduce((s, p) => s + (p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy), 0) / pts.length);
        // a topic scattered across the plane has no territory to name
        if (spread > 78) return;
        const r = Math.min(88, Math.max(34, spread * 1.2));
        const bh = (/([-\d.]+)\s*\)\s*$/.exec(t.color) || [])[1];
        blobs.push({ cid, cx, cy, r, spread, c: bh ? soft(bh) : window.WPAL.c(t.color), ink: bh ? softInk(bh) : window.WPAL.ink(t.color), label: t.label });
      });
    }
    // tightest clusters speak first; labels that would overlap an earlier one stay silent
    blobs.sort((a, b) => a.spread - b.spread);
    {
      const kept = [];
      blobs.forEach((b) => {
        b.lx = Math.max(30, Math.min(W - 30, b.cx));
        b.ly = Math.max(16, Math.min(H - 8, b.cy - b.r - 5));
        const w = 12 + b.label.length * 6.4;
        b.lab = kept.every((k) => Math.abs(b.ly - k.y) > 15 || Math.abs(b.lx - k.x) > (w + k.w) / 2 + 8);
        if (b.lab) kept.push({ x: b.lx, y: b.ly, w });
      });
    }
    const blobFaint = (b) => sel != null || (topic !== 'all' && topic !== b.cid);

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
            <defs>
              <filter id="qmBlur" x="-70%" y="-70%" width="240%" height="240%"><feGaussianBlur stdDeviation="16"></feGaussianBlur></filter>
            </defs>
            <g>
              {blobs.map((b) => (
                <circle key={b.cid} className="qm-blob" cx={b.cx} cy={b.cy} r={b.r} fill={b.c} opacity={blobFaint(b) ? 0.04 : 0.08} filter="url(#qmBlur)"></circle>
              ))}
            </g>
            <g>
              {shown.map((l, k) => {
                const a = PL.pts[l.i], b = PL.pts[l.j];
                const lit = sel != null;
                return (
                  <line key={l.i + '-' + l.j} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke={lit ? hue(sel) : 'var(--ink-3)'}
                    strokeWidth={lit ? 1 + Math.abs(l.r) * 2.8 : 0.6 + Math.abs(l.r) * 1.7}
                    strokeDasharray={l.r < 0 ? '2.5 3' : undefined}
                    strokeLinecap="round"
                    opacity={lit ? 0.58 : l.r < 0 ? 0.22 : 0.3}></line>
                );
              })}
            </g>
            <g>
              {PL.pts.map((p) => {
                const i = p.i, answered = A[Q[i].id] != null;
                const dim = sel != null ? (i !== sel && !near.has(i)) : !inTopic(i);
                const r = rOf(i);
                return (
                  <g key={i} onClick={(e) => { e.stopPropagation(); pick(i); }} style={{ cursor: 'pointer' }}>
                    <circle cx={p.x} cy={p.y} r={Math.max(11, r + 6)} fill="transparent"></circle>
                    {i === nxt && <circle className="qm-pulse" cx={p.x} cy={p.y} r={r + 3} fill="none" stroke={hue(i)} strokeWidth="1.6"></circle>}
                    {i === nxt && <text className="qm-nextlab" x={Math.max(30, Math.min(W - 30, p.x))} y={p.y > H - 26 ? p.y - r - 7 : p.y + r + 13} textAnchor="middle" fill={ink(i)}>answer next</text>}
                    {i === sel && <circle cx={p.x} cy={p.y} r={r + 5} fill="none" stroke={hue(i)} strokeWidth="1.4" opacity="0.55"></circle>}
                    <circle cx={p.x} cy={p.y} r={r}
                      fill={answered ? hue(i) : tint(i)}
                      stroke={hue(i)} strokeWidth={answered ? 0 : 2}
                      opacity={dim ? 0.16 : 1}></circle>
                  </g>
                );
              })}
            </g>
            <g>
              {blobs.filter((b) => b.lab).map((b) => (
                <text key={b.cid} className="qm-tlab" x={b.lx} y={b.ly} textAnchor="middle" fill={b.ink} opacity={blobFaint(b) ? 0.15 : 0.62}>{b.label}</text>
              ))}
            </g>
          </svg>
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
                    <em style={{ left: s.base + '%' }}></em>
                  </span>
                  <span className="qm-base"><span style={{ left: Math.max(12, Math.min(86, s.base)) + '%' }}>usually {s.base}%</span></span>
                  {s.youFollowed === false && <span className="qm-break">you went {s.other}</span>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card qm-read">
            {topSay ? (
              <button className="qm-top" onClick={() => pick(top.i)}>
                <span className="qm-toplab" style={{ background: window.WPAL.wash(hue(top.i), 16), color: ink(top.i) }}>strongest tie</span>
                <span className="qm-tie">
                  <span className="qm-tie-row"><em>{'\u201c' + topSay.from.prompt + '\u201d'}</em><b>{topSay.pick}</b></span>
                  <span className="qm-tie-then">{'\u2193'} {topSay.pct}% then pick</span>
                  <span className="qm-tie-row"><em>{'\u201c' + topSay.to.prompt + '\u201d'}</em><b>{topSay.then}</b></span>
                </span>
              </button>
            ) : (
              <div className="qm-idle">
                <b>{all.length}</b>
                <span>links hold across the {Q.length} questions in the pool; the strongest are drawn. Tap any place to read its own.</span>
              </div>
            )}
            {topSay && <div className="qm-prog"><i style={{ width: (nAns / (Q.length || 1)) * 100 + '%' }}></i></div>}
            {topSay && <div className="qm-foot">{nAns} of {Q.length} answered {'\u00b7'} {all.length} links {'\u00b7'} tap any place to read its own</div>}
            {/* the things the picture can't say for itself — read once, and
                only here, where there is room for it */}
            <div className="qm-key">
              <span><i className="qm-line"></i>together</span>
              <span><i className="qm-line is-dash"></i>opposite</span>
              <span><i className="qm-dot is-fill"></i>answered</span>
              <span><i className="qm-dot"></i>open</span>
            </div>
          </div>
        )}
      </>
    );
  }

  Object.assign(window, { QuestionMap });
})();

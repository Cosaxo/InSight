// people-lens.jsx — the People lens: the crowd as a shared map with no centre.
// The Mirror is radial (you at the origin, closer = more like you); this is
// deliberately the OTHER grammar — one plane that exists whether you look or
// not, and you sit wherever your answers put you. Honesty rules, as drawn:
//   position   · the only geometry — no axes, no rings, no lines between people
//   every dot  · a real member of the population; zero decorative dots or mist
//   confidence · fewer shared answers = smaller + fainter; under 4, not drawn
//   numbers    · every claim states its basis ("9 of 12 shared answers")
(function () {
  const W = 344, H = 330, PADX = 26, PADY = 30;
  const MIN_SHARED = 4, MIN_CROWD = 8, MIN_ANSWERED = 5;
  function h01(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 8) % 100000) / 100000; }
  const NAMES = ['Maya', 'Jon', 'Priya', 'Tunde', 'Aiko', 'Lena', 'Marco', 'Zoe', 'Ravi', 'Nia', 'Ines', 'Kofi', 'Elif', 'Stig', 'Rosa', 'Dev', 'Hana', 'Omar', 'Vera', 'Milo', 'Sana', 'Piotr', 'June', 'Ana', 'Teo', 'Freya', 'Yuki', 'Carl', 'Dara', 'Liv', 'Noor', 'Emil'];
  const first = (s) => String(s || '').split(' ')[0];
  const band = (a) => (a < 25 ? '18–24' : a < 35 ? '25–34' : a < 45 ? '35–44' : '45+');

  // ── who is on this plane, and where ── memoized per population + your answers
  const _memo = {};
  function crowd(popId) {
    const PAT = window.PAT, Q = PAT.qs(), A = PAT.answers();
    const key = Object.keys(A).sort().join(',');
    const hit = _memo[popId];
    if (hit && hit.key === key) return hit.v;
    const mine = Q.map((q, j) => ({ j, id: q.id, a: A[q.id] })).filter((x) => x.a != null);
    // the bar for "placed" rises with your own history — sharing 4 answers means
    // something when you've given 6, little when you've given 20. This also keeps
    // the world field an honest constellation (~40-60) instead of a carpet.
    const minShared = Math.max(MIN_SHARED, Math.round(mine.length * 0.32));
    const placed = [];
    PAT.fieldPts(popId).forEach((pt) => {
      const p = pt.p, pid = p.id;
      // members who answered enough of YOUR questions. Activity is deterministic
      // per person, so the same face shows in World and in their country — and
      // the crowd only ever grows as you answer more.
      const act = popId === 'circle' ? 0.8 : 0.02 + 0.55 * Math.pow(h01('act' + pid), 6);
      const shared = mine.filter((x) => h01('sh' + pid + x.id) < act);
      if (shared.length < minShared) return;
      let agree = 0;
      shared.forEach((x) => { if (p.a[x.j] === x.a) agree++; });
      const t = Math.max(0, Math.min(1, (shared.length - minShared) / Math.max(1, mine.length - minShared)));
      placed.push({
        id: pid, mem: p, name: p.name ? first(p.name) : NAMES[Math.floor(h01('nm' + pid) * NAMES.length)],
        px: pt.x, py: pt.y, r: 4.5 + t * 3, op: 0.55 + t * 0.45,
        hue: Math.round(h01('hue' + pid) * 360), shared, agree,
        chips: p.name ? ['your circle'] : [p.city, band(p.age)],
      });
    });
    const meP = PAT.mePoint();
    // plane → pixels, framed by the people actually shown (plus you)
    let mx = 0.2;
    placed.forEach((p) => { mx = Math.max(mx, Math.abs(p.px), Math.abs(p.py)); });
    mx = Math.max(mx, Math.abs(meP.x), Math.abs(meP.y));
    const X = (v) => W / 2 + (v / mx) * (W / 2 - PADX);
    const Y = (v) => H / 2 + (v / mx) * (H / 2 - PADY);
    placed.forEach((p) => { p.x = X(p.px); p.y = Y(p.py); });
    const me = { x: X(meP.x), y: Y(meP.y), r: 5.75 };
    // nudge overlaps apart — position stays the data, only crowding is eased
    const all = placed.concat([me]);
    for (let it = 0; it < 50; it++) {
      let moved = false;
      for (let a = 0; a < all.length; a++) for (let b = a + 1; b < all.length; b++) {
        const P1 = all[a], P2 = all[b];
        let dx = P1.x - P2.x, dy = P1.y - P2.y, d = Math.hypot(dx, dy);
        const need = P1.r + P2.r + 5;
        if (d < need) { moved = true; if (d < 0.01) { dx = 1; dy = 0; d = 1; } const push = (need - d) / 2; P1.x += (dx / d) * push; P1.y += (dy / d) * push; P2.x -= (dx / d) * push; P2.y -= (dy / d) * push; }
      }
      if (!moved) break;
    }
    all.forEach((p) => { p.x = Math.max(14, Math.min(W - 14, p.x)); p.y = Math.max(16, Math.min(H - 14, p.y)); });
    // name the nearest few — a label's rect must clear every dot and every label
    const rects = [];
    const clearRect = (rc, self) => {
      if (rc.x0 < 4 || rc.x1 > W - 4 || rc.y0 < 2 || rc.y1 > H - 2) return false;
      if (rects.some((o) => rc.x0 < o.x1 && rc.x1 > o.x0 && rc.y0 < o.y1 && rc.y1 > o.y0)) return false;
      const hits = (p) => { const cx = Math.max(rc.x0, Math.min(p.x, rc.x1)), cy = Math.max(rc.y0, Math.min(p.y, rc.y1)); return Math.hypot(p.x - cx, p.y - cy) < p.r + 2.5; };
      return !all.some((p) => p !== self && hits(p));
    };
    const near = placed.slice().sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y));
    const used = new Set(); let labeled = 0;
    for (const p of near) {
      if (labeled >= 5) break;
      if (used.has(p.name)) continue;
      const w = p.name.length * 6 + 4, h = 12;
      const cands = [
        { x: p.x, y: p.y + p.r + 4 },
        { x: p.x, y: p.y - p.r - 16 },
        { x: p.x + p.r + 7 + w / 2, y: p.y - 6 },
        { x: p.x - p.r - 7 - w / 2, y: p.y - 6 },
      ];
      for (const c of cands) {
        const rc = { x0: c.x - w / 2, x1: c.x + w / 2, y0: c.y, y1: c.y + h };
        if (clearRect(rc, p)) { p.lab = { x: c.x, y: c.y + 9.5 }; rects.push(rc); used.add(p.name); labeled++; break; }
      }
    }
    const v = { placed, me, nMine: mine.length };
    _memo[popId] = { key, v };
    return v;
  }

  // the strongest tie: the rarest answer you share — counted, with its basis
  function tieFor(p, popId) {
    const Q = window.PAT.qs();
    let best = null;
    p.shared.forEach((x) => {
      if (p.mem.a[x.j] !== x.a) return;
      const c = window.PAT.counts(x.j, popId);
      const share = (x.a === 0 ? c[0] : c[1]) / Math.max(1, c[0] + c[1]);
      if (!best || share < best.share) best = { label: Q[x.j].options[x.a].label, share };
    });
    return best;
  }

  function PLEmpty({ head, line, cta }) {
    return (
      <div className="card" style={{ minHeight: 330, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px 36px', gap: 8, boxSizing: 'border-box' }}>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>{head}</div>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.5, textWrap: 'pretty', maxWidth: 250 }}>{line}</div>
        {cta || null}
      </div>
    );
  }

  function PeopleLens({ pop, onUse, onOracle }) {
    const [sel, setSel] = React.useState(null);
    const [, force] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => window.PAT.sub(force), []);
    React.useEffect(() => { setSel(null); }, [pop]);
    const st = window.PAT.stats();
    if (st.answered < MIN_ANSWERED) {
      return <PLEmpty head="Not placed yet" line="Answer a few more questions and the map can place you." cta={
        <button onClick={() => { if (window.HAPTIC) window.HAPTIC.tick(); if (onOracle) onOracle(); }}
          style={{ marginTop: 10, border: 'none', cursor: 'pointer', background: 'var(--ink)', color: 'var(--surface-2)', fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 800, padding: '11px 20px', borderRadius: 999 }}>Ask the Oracle</button>
      }></PLEmpty>;
    }
    const popId = pop || 'world';
    const { placed, me } = crowd(popId);
    if (placed.length < MIN_CROWD) {
      return <PLEmpty head="Crowd too thin" line="Too few people share your questions yet. The map fills as the crowd answers."></PLEmpty>;
    }
    const selP = sel == null ? null : placed.find((p) => p.id === sel);
    const pick = (p) => { setSel((s) => (s === p.id ? null : p.id)); if (window.HAPTIC) window.HAPTIC.tick(); if (onUse) onUse(); };
    const tie = selP ? tieFor(selP, popId) : null;
    const meLeft = me.x > W - 46; // keep the "you" word inside the frame
    return (
      <>
        <div className="card" style={{ padding: '8px 6px 0' }}>
          <svg style={{ display: 'block', width: '100%', touchAction: 'manipulation' }} viewBox={'0 0 ' + W + ' ' + H} role="img"
            aria-label="People who share your questions, placed by their answers" onClick={() => { if (sel != null) setSel(null); }}>
            {placed.map((p) => {
              const on = p.id === sel;
              const dim = selP && !on;
              return (
                <g key={p.id} onClick={(e) => { e.stopPropagation(); pick(p); }}
                  style={{ cursor: 'pointer', opacity: dim ? 0.22 : on ? 1 : p.op, transition: 'opacity .25s ease' }}>
                  <circle cx={p.x} cy={p.y} r={Math.max(p.r + 8, 15)} fill="transparent"></circle>
                  <circle cx={p.x} cy={p.y} r={p.r + 2} fill="var(--surface-2)"></circle>
                  <circle cx={p.x} cy={p.y} r={p.r} fill={'oklch(0.56 0.09 ' + p.hue + ')'}></circle>
                  {on && <circle cx={p.x} cy={p.y} r={p.r + 5} fill="none" stroke="var(--accent)" strokeWidth="1.8"></circle>}
                </g>
              );
            })}
            {placed.map((p) => (p.lab && (selP == null || p.id === sel) ? (
              <text key={'l' + p.id} x={p.lab.x} y={p.lab.y} textAnchor="middle" fontFamily="var(--sans)" fontSize="11" fontWeight="650"
                fill={p.id === sel ? 'var(--ink)' : 'var(--ink-2)'} style={{ paintOrder: 'stroke', stroke: 'var(--surface-2)', strokeWidth: 3, pointerEvents: 'none' }}>{p.name}</text>
            ) : null))}
            <g style={{ opacity: selP ? 0.22 : 1, transition: 'opacity .25s ease' }}>
              <circle cx={me.x} cy={me.y} r={me.r + 2} fill="var(--surface-2)"></circle>
              <circle cx={me.x} cy={me.y} r={me.r} fill="var(--ink)"></circle>
              <circle cx={me.x} cy={me.y} r={me.r + 5} fill="none" stroke="var(--accent)" strokeWidth="1.4"></circle>
              <text x={meLeft ? me.x - me.r - 9 : me.x + me.r + 9} y={me.y + 3.5} textAnchor={meLeft ? 'end' : 'start'} fontFamily="var(--sans)" fontSize="10" fontWeight="800" fill="var(--ink)"
                style={{ paintOrder: 'stroke', stroke: 'var(--surface-2)', strokeWidth: 3 }}>you</text>
            </g>
          </svg>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, padding: '6px 6px 9px', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'oklch(0.56 0.09 250)', flexShrink: 0 }}></span><span>a person</span>
            <span style={{ color: 'var(--rule)' }}>·</span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'oklch(0.56 0.09 250)', opacity: 0.5, flexShrink: 0 }}></span><span>fainter = fewer shared answers</span>
            <span style={{ color: 'var(--rule)' }}>·</span>
            <span style={{ width: 9, height: 9, borderRadius: '50%', border: '1.4px solid var(--accent)', boxSizing: 'border-box', flexShrink: 0 }}></span><span>you</span>
          </div>
        </div>

        {selP ? (
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <i style={{ width: 11, height: 11, borderRadius: '50%', background: 'oklch(0.56 0.09 ' + selP.hue + ')', flex: 'none' }}></i>
              <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}>{selP.name}</span>
              {selP.chips.map((c, k) => (
                <span key={k} className="pt-cat" style={{ background: 'color-mix(in oklab, var(--accent) 10%, var(--surface-2))', color: 'var(--accent-ink)' }}>{c}</span>
              ))}
            </div>
            <div style={{ marginTop: 11, fontSize: 13.5, fontWeight: 650 }}>
              Agrees with you on <b style={{ fontWeight: 800 }}>{selP.agree} of {selP.shared.length}</b> shared answers here
            </div>
            <div style={{ marginTop: 8, height: 8, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
              <i style={{ display: 'block', width: Math.round((selP.agree / selP.shared.length) * 100) + '%', height: '100%', borderRadius: 99, background: 'color-mix(in oklab, oklch(0.56 0.09 ' + selP.hue + ') 50%, var(--surface-2))', transition: 'width .3s var(--ease-out)' }}></i>
            </div>
            <div style={{ marginTop: 7, fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textWrap: 'pretty' }}>
              That count alone places them {'\u00b7'} closer only ever means more agreement.
            </div>
            {tie ? (
              <div style={{ marginTop: 11, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
                You both said <b style={{ fontWeight: 700, color: 'var(--ink)' }}>{tie.label}</b> <span style={{ color: 'var(--ink-3)' }}>· {Math.round(tie.share * 100)}% here do</span>
              </div>
            ) : (
              <div style={{ marginTop: 11, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>You split on everything you share.</div>
            )}
          </div>
        ) : (
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{placed.length}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.4, textWrap: 'pretty' }}>
                people placed around you, from the <b style={{ color: 'var(--ink)', fontWeight: 700 }}>{st.answered} questions</b> you've answered here. Tap anyone.
              </span>
            </div>
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid color-mix(in oklch, var(--rule), transparent 30%)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textWrap: 'pretty' }}>
              Close together = answers alike {'\u00b7'} drawn from the crowd's latest answers.
            </div>
          </div>
        )}
      </>
    );
  }
  Object.assign(window, { PeopleLens });
})();

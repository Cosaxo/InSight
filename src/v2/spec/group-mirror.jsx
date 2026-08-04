// Ported from design/spec-modules/group-mirror.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { MirrorLensRow } from './mirror-field.jsx';
import { Kicker, Lazy } from './primitives.jsx';

// group-mirror.jsx — the Mirror's GROUPS stop: your named circles as a cast
// list. Pick a group → the role constellation, then the standard three lenses
// (Answers · People · Compare), all group-focused: what the group landed on,
// who's who inside it, and how you run against it.
(function () {
  const { useState, useEffect, useReducer } = React;
  const LINE = '0.5px solid var(--rule)';

  // per-group signature hue — circular mean of the members' hues, worn at the
  // app's shared accent lightness/chroma so each circle recolors the whole stop
  function gmGroupHue(g) {
    let sx = 0, sy = 0;
    g.members.forEach((p) => { sx += Math.cos(p.hue * Math.PI / 180); sy += Math.sin(p.hue * Math.PI / 180); });
    return Math.round(((Math.atan2(sy, sx) * 180 / Math.PI) + 360) % 360);
  }
  const gmAccent = (g) => `oklch(0.52 0.14 ${gmGroupHue(g)})`;

  // group identity mark — the member cluster wrapped by the alignment ring;
  // ring sweep = how often you land with this group's majority (no number)
  function GMIdentity({ g, pct }) {
    const [v, setV] = useState(0);
    useEffect(() => { setV(0); const t = setTimeout(() => setV(pct), 80); return () => clearTimeout(t); }, [pct, g.id]);
    const S = 64, R = 28.5, C = 2 * Math.PI * R;
    return (
      <span style={{ position: 'relative', width: S, height: S, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ position: 'absolute', inset: 0 }}>
          <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke="var(--surface-3)" strokeWidth="3.5"></circle>
          <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${Math.max(0.01, (v / 100) * C)} ${C}`} transform={`rotate(-90 ${S / 2} ${S / 2})`} style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.2,0.8,0.2,1)' }}></circle>
        </svg>
        <GMCluster members={g.members} size={20}></GMCluster>
      </span>
    );
  }

  function GMCluster({ members, size = 26 }) {
    const shown = members.slice(0, 3);
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        {shown.map((p, i) => (
          <span key={p.id} style={{ marginLeft: i ? -Math.round(size * 0.32) : 0, display: 'inline-flex', zIndex: shown.length - i, position: 'relative' }}>
            <window.GDAv p={p} size={size}></window.GDAv>
          </span>
        ))}
      </span>
    );
  }

  function GroupPicker({ gs, cur, onPick }) {
    return (
      <div className="h-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 2px 2px' }}>
        {gs.map((g) => {
          const on = g.id === cur;
          return (
            <button key={g.id} className="press" onClick={() => onPick(g.id)} aria-pressed={on} style={{
              '--accent': gmAccent(g),
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, cursor: 'pointer',
              padding: '6px 13px 6px 8px', borderRadius: 999, WebkitAppearance: 'none',
              background: on ? 'color-mix(in oklch, var(--accent) 10%, var(--surface-2))' : 'var(--surface-2)',
              border: on ? '1.5px solid color-mix(in oklch, var(--accent) 55%, transparent)' : LINE,
              boxShadow: 'var(--shadow-card)', position: 'relative',
            }}>
              <GMCluster members={g.members} size={22}></GMCluster>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: on ? 800 : 600, color: on ? 'var(--ink)' : 'var(--ink-2)', whiteSpace: 'nowrap' }}>{g.name}</span>
              {!g.done && <span title="today's question waiting" style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--surface)' }}></span>}
            </button>
          );
        })}
      </div>
    );
  }

  const gmBar = (pct) => (
    <div style={{ height: 6, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
      <div style={{ width: pct + '%', height: '100%', borderRadius: 999, background: 'var(--accent)', opacity: 0.75 }}></div>
    </div>
  );

  // ── Answers: the group's question history — verdicts, with a split bar ──
  function GroupAnswersCard({ g }) {
    const D = window.DUELS;
    const P = D.groupPortrait(g.id);
    const rows = [];
    for (let i = 1; i < 7; i++) {
      const gp = D.groupPicks(g.id, i);
      const total = gp.counts.reduce((a, b) => a + b, 0) || 1;
      rows.push({ i, prompt: gp.q.prompt, maj: gp.q.options[gp.majority], n: total, k: gp.counts[gp.majority], mine: gp.mine, agree: gp.mine != null && gp.mine === gp.majority, mineLabel: gp.mine != null && gp.mine !== gp.majority ? gp.q.options[gp.mine] : null });
    }
    const [open, setOpen] = useState(null);
    const youDot = <span title="you" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink)', border: '1.5px solid var(--surface)', boxShadow: '0 0 0 0.5px var(--rule)', flexShrink: 0 }}></span>;
    return (
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Kicker>What the group landed on</Kicker>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' }}>{P.days} days played</span>
        </div>
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column' }}>
          {rows.map((r) => (
            <button type="button" className="btn-bare" key={r.i} aria-expanded={open === r.i} onClick={() => setOpen(open === r.i ? null : r.i)} style={{ padding: '11px 0', borderBottom: r.i < 6 ? LINE : 'none', cursor: 'pointer' }}>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)', textWrap: 'pretty' }}>{r.maj}</div>
              <div style={{ display: 'flex', gap: 5, marginTop: 8 }}>
                {Array.from({ length: r.n }).map((_, j) => {
                  const inMaj = j < r.k;
                  const isYou = r.mine != null && (r.agree ? j === r.k - 1 : j === r.n - 1);
                  return <span key={j} style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: isYou ? 'var(--ink)' : inMaj ? 'color-mix(in oklch, var(--accent) 75%, var(--surface))' : 'var(--surface)', border: isYou ? '1.5px solid var(--surface)' : inMaj ? 'none' : '1.2px solid var(--ink-3)', boxShadow: isYou ? '0 0 0 0.5px var(--rule)' : 'none' }}></span>;
                })}
              </div>
              {open === r.i && <div style={{ marginTop: 7, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 500, color: 'var(--ink-3)', textWrap: 'pretty' }}>{r.prompt}{r.mineLabel ? ` — you picked ${r.mineLabel}` : ''}</div>}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 4, paddingTop: 11, borderTop: LINE }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'color-mix(in oklch, var(--accent) 75%, var(--surface))' }}></span>picked it</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>{youDot}you</span>
        </div>
      </div>
    );
  }

  // ── People: demographics + likeness — who they are, and how close each runs to you ──
  function GroupPeopleCard({ g }) {
    const D = window.DUELS;
    const P = D.groupPortrait(g.id);
    const ms = D.groupMembers(g.id);
    // beeswarm: one shared likeness axis — everyone as a dot, distance from the
    // "you" anchor = how unlike you they run; stagger only breaks collisions
    const lo = Math.min(...ms.map((p) => p.match)) - 8;
    const xOf = (m) => 6 + ((m - lo) / (100 - lo)) * 88;
    const placed = [];
    const pts = [...ms].sort((a, b) => a.match - b.match).map((p) => {
      const x = xOf(p.match);
      let lvl = 0;
      for (const cand of [0, -1, 1, -2, 2]) { if (!placed.some((q) => q.lvl === cand && Math.abs(q.x - x) < 15)) { lvl = cand; break; } }
      placed.push({ x, lvl });
      return { p, x, lvl };
    });
    const maxAbs = Math.max(...pts.map((q) => Math.abs(q.lvl)));
    const BH = 96 + maxAbs * 46, cy = BH / 2;
    const count = {};
    ms.forEach((p) => (p.interests || []).forEach((t) => { count[t] = (count[t] || 0) + 1; }));
    const shared = Object.entries(count).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return (
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Kicker>Who's who</Kicker>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>closer → more like you</span>
        </div>
        <div style={{ position: 'relative', height: BH, marginTop: 6 }}>
          <div style={{ position: 'absolute', left: '2%', right: '2%', top: cy, height: 1, background: 'var(--rule)' }}></div>
          <div style={{ position: 'absolute', left: xOf(100) + '%', top: cy, transform: 'translate(-50%, -50%)', width: 10, height: 10, borderRadius: '50%', background: 'var(--ink)', border: '2px solid var(--surface)', boxShadow: '0 0 0 0.5px var(--rule)' }}></div>
          <div style={{ position: 'absolute', left: xOf(100) + '%', transform: 'translateX(-50%)', top: cy + 9, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)' }}>you</div>
          {pts.map(({ p, x, lvl }) => {
            const isTwin = P.twin && p.id === P.twin.id;
            const isCon = P.contrarian && p.id === P.contrarian.id;
            return (
              <button type="button" className="btn-bare" key={p.id} aria-label={`Open ${p.name}`} onClick={() => window.openPerson && window.openPerson(p)} style={{ position: 'absolute', left: x + '%', top: cy + lvl * 46, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                <span style={{ borderRadius: '50%', display: 'inline-flex', boxShadow: isTwin ? '0 0 0 2px var(--accent)' : isCon ? '0 0 0 2px var(--ink-3)' : '0 0 0 2.5px var(--surface)' }}><window.GDAv p={p} size={28} plain></window.GDAv></span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{p.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
        {/* the two called-out seats wear a ring; the words live down here, once,
            at a size you can actually read — not at 9.5px under each avatar */}
        {(P.twin || P.contrarian) && (
          <div className="legend" style={{ justifyContent: 'center', marginTop: 2 }}>
            {P.twin && <span style={{ '--lgc': 'var(--accent)' }}><span className="lg-dot"></span>most like you</span>}
            {P.contrarian && <span style={{ '--lgc': 'var(--ink-3)' }}><span className="lg-dot" data-hollow=""></span>breaks ranks</span>}
          </div>
        )}
        {shared.length > 0 && (
          <div style={{ marginTop: 13, paddingTop: 13, borderTop: LINE, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}>in common</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {shared.map(([t]) => (
                <span key={t} style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink-2)', padding: '4px 12px', borderRadius: 999, background: 'var(--surface-2)', border: LINE }}>{t}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Compare: the group vs most people, then your seat inside it ──
  // Trait positions are per-PERSON (stable across groups); the group is the mean.
  const gmh = (s) => { let x = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return ((x >>> 8) % 1000) / 1000; };

  function GroupCompareCard({ g }) {
    const D = window.DUELS;
    const ms = D.groupMembers(g.id);
    const P = D.groupPortrait(g.id);
    // how the group sees you — the crowns it has voted onto your head
    const crowns = D.roleVotes(g.id).roles.filter((r) => r.winner === 'me' || (r.contested && r.second === 'me'));
    // this group's collective, as a compare population — the shared groups
    // baseline nudged per-group (deterministic by id) so each circle has its own grain
    const pop = React.useMemo(() => {
      const base = (window.IS_COMPARE_POP || {}).groups;
      if (!base) return null;
      const j = (k, v) => Math.max(6, Math.min(94, Math.round(v + (gmh('cb' + g.id + k) - 0.5) * 22)));
      const out = { label: g.name, n: ms.length };
      ['big5', 'political', 'values', 'attachment', 'cognitive'].forEach((t) => {
        out[t] = {};
        Object.entries(base[t] || {}).forEach(([k, v]) => { out[t][k] = j(t + k, v); });
      });
      return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
    }, [g.id]);
    return (
      <>
        {pop && window.CompareBreakdown && <window.CompareBreakdown pop={pop} label={g.name} accent="var(--accent)"></window.CompareBreakdown>}

        <div className="card" style={{ marginTop: 12 }}>
          <Kicker>How they see you</Kicker>
          {crowns.length ? (
            <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {crowns.map((r) => (
                <span key={r.key} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink-2)',
                  padding: '5px 13px', borderRadius: 999, background: 'var(--surface-2)', border: LINE,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: r.contested ? 'var(--surface)' : `oklch(0.62 0.12 ${r.scen.hue})`, border: r.contested ? `1.6px solid oklch(0.62 0.12 ${r.scen.hue})` : 'none' }}></span>
                  {r.label}
                </span>
              ))}
            </div>
            {crowns.some((r) => r.contested) && <div style={{ marginTop: 9, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.09em', textTransform: 'uppercase' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--surface)', border: '1.6px solid var(--ink-3)' }}></span>hollow = contested</div>}
            </>
          ) : (
            <div style={{ marginTop: 10, fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-3)' }}>No crowns yet — the next scenario vote could change that.</div>
          )}
          <div style={{ marginTop: 15, paddingTop: 13, borderTop: LINE }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>you land with the majority</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)' }}>{P.meWithMaj} of {P.days}</span>
            </div>
            {gmBar(Math.round((P.meWithMaj / Math.max(P.days, 1)) * 100))}
          </div>
        </div>
      </>
    );
  }

  function GroupsMirrorBody({ onPerson, topLenses }) {
    const D = window.DUELS;
    const [, bump] = useReducer((x) => x + 1, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ported effect; see src/v2/README.md § Lint suppressions
    useEffect(() => D.subscribe(bump), []);
    const gs = D.groups();
    const [gid, setGid] = useState(gs[0] && gs[0].id);
    const [lensOpen, setLensOpen] = useState('__ov');
    const g = gs.find((x) => x.id === gid) || gs[0];
    if (!g) return null;
    const P = D.groupPortrait(g.id);
    const align = Math.round((P.meWithMaj / Math.max(P.days, 1)) * 100);
    const lenses = [
      { id: 'answers', label: 'Answers', render: () => <GroupAnswersCard g={g}></GroupAnswersCard> },
      { id: 'people', label: 'People', render: () => <GroupPeopleCard g={g}></GroupPeopleCard> },
      { id: 'compare', label: 'Compare', render: () => <GroupCompareCard g={g}></GroupCompareCard> },
    ];
    // nav v2: lens row above the content, the role map as its first tab
    const lensList = topLenses ? [{ id: '__ov', label: 'Overview' }, ...lenses] : lenses;
    const openId = topLenses ? (lensList.some((l) => l.id === lensOpen) ? lensOpen : '__ov') : null;
    const openLens = topLenses && openId !== '__ov' ? lenses.find((l) => l.id === openId) : null;
    return (
      <div className="mf-stage" data-screen-label="Mirror — groups" style={{ '--accent': gmAccent(g) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '6px 2px 0' }}>
          <GMIdentity key={g.id} g={g} pct={align}></GMIdentity>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
            <div style={{ marginTop: 2, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, color: 'var(--ink-3)' }}>aligned with you</div>
          </div>
        </div>
        <GroupPicker gs={gs} cur={g.id} onPick={setGid}></GroupPicker>
        {topLenses && <MirrorLensRow lenses={lensList} open={openId} onOpen={setLensOpen}></MirrorLensRow>}
        {(!topLenses || openId === '__ov') && <window.GroupRoleMap key={g.id} gid={g.id} gname={g.name}></window.GroupRoleMap>}
        {openLens && <div key={openId} className="fade-in" style={{ paddingTop: 4 }}><Lazy minHeight={480}>{openLens.render()}</Lazy></div>}
        {!topLenses && <MirrorLenses key={'lens-' + g.id} lenses={lenses}></MirrorLenses>}
      </div>
    );
  }

  Object.assign(window, { GroupsMirrorBody });
})();


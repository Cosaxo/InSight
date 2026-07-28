// Ported from design/spec-modules/legacy-tabs.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// World, City, Groups, People tabs
const { useState: useStateW } = React;

// ─── Group breakdown · scope comparison ───
function GroupBreakdown({ scope, accent }) {
  const D = window.IS_DATA;
  const cats = D.interestCats;
  const reach = D.groupReach[scope];
  const popular = D.groupPopular[scope] || [];
  const labels = { friends: 'your circle', city: 'Oslo', world: 'the world' };
  const fmt = (n) => n >= 1_000_000_000 ? (n/1_000_000_000).toFixed(1) + 'B'
                  : n >= 1_000_000 ? (n/1_000_000).toFixed(1) + 'M'
                  : n >= 1_000 ? (n/1_000).toFixed(0) + 'k'
                  : n;
  // the story is the DIFFERENCE — sort by gap, lead with the biggest
  const rows = cats
    .map(c => ({ c, you: D.groupReach.you[c.id], them: reach[c.id] }))
    .map(r => ({ ...r, diff: r.you - r.them }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const maxGap = Math.max(1, ...rows.map(r => Math.abs(r.diff)));
  const [showAll, setShowAll] = useStateW(false);
  const CUT = 8;
  const shown = showAll ? rows : rows.slice(0, CUT);
  const hidden = rows.length - CUT;
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <Kicker>Groups · what {labels[scope]} joins</Kicker>
      {/* read-once key — direction of the bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, marginBottom: 12, paddingLeft: 88 }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>◂ {labels[scope]} more</span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: accent }}>you more ▸</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.map(r => (
          <CompareRow key={r.c.id} cat={r.c} diff={r.diff} maxGap={maxGap} accent={accent} />
        ))}
      </div>
      {hidden > 0 && (
        <button onClick={() => setShowAll(o => !o)} style={{
          display: 'block', width: '100%', marginTop: 10, padding: '6px 0', cursor: 'pointer',
          background: 'transparent', border: 'none',
          fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center',
        }}>{showAll ? 'show fewer' : `+ ${hidden} more · closely matched`}</button>
      )}
      {popular.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '0.5px solid var(--rule)' }}>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.07em', marginBottom: 8, textTransform: 'uppercase' }}>Most-joined in {labels[scope]}</div>
          {popular.map((p, i) => {
            const c = cats.find(x => x.id === p.cat);
            const dots = p.n <= 8;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 13, color: `oklch(0.5 0.13 ${c.hue})`, width: 14, textAlign: 'center', flexShrink: 0 }}>{GL(c.glyph)}</span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em' }}>{p.name}</span>
                {dots ? (
                  <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    {Array.from({ length: p.n }).map((_, k) => (
                      <span key={k} style={{ width: 6, height: 6, borderRadius: '50%', background: `oklch(0.5 0.13 ${c.hue})` }} />
                    ))}
                  </span>
                ) : (
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, color: 'var(--ink-3)' }}>{fmt(p.n)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// diverging bar — anchored at the center axis, extending toward you (right,
// filled accent) or toward them (left, muted). One mark per row.
function CompareRow({ cat, diff, maxGap, accent }) {
  const mag = Math.max(3, (Math.abs(diff) / maxGap) * 50); // % of track, floor so tiny gaps stay visible
  const more = diff >= 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ width: 14, fontFamily: 'var(--sans)', fontSize: 13, color: `oklch(0.5 0.13 ${cat.hue})`, textAlign: 'center', flexShrink: 0 }}>{GL(cat.glyph)}</span>
      <span style={{ width: 64, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', letterSpacing: '-0.01em', lineHeight: 1.12, flexShrink: 0 }}>{cat.label}</span>
      <div style={{ position: 'relative', flex: 1, height: 14 }}>
        {/* center axis */}
        <div style={{ position: 'absolute', left: '50%', top: 1, bottom: 1, width: 1, background: 'var(--rule)' }} />
        <div style={{
          position: 'absolute', top: '50%', transform: 'translateY(-50%)', height: 7,
          ...(more
            ? { left: '50%', width: `${mag}%`, background: accent, borderRadius: '0 999px 999px 0' }
            : { right: '50%', width: `${mag}%`, background: 'color-mix(in oklch, var(--ink-3), transparent 45%)', borderRadius: '999px 0 0 999px' }),
        }} />
      </div>
    </div>
  );
}

// ──────────── GROUPS ────────────
// Mirrors the geo populations (AreaBody): a hero, then the selected circle
// treated as a population — level and compare in one flow, no sub-tabs. ──
function GroupsBody({ levelTrait, levelMarker } = {}) {
  const D = window.IS_DATA;
  const groups = D.groups || [];
  const [mine, setMine] = useStateW(() => new Set(groups.filter(g => g.joined).map(g => g.id)));
  const [selId, setSel] = useStateW(groups.find(g => g.joined)?.id);
  const join = (id) => { setMine(s => new Set(s).add(id)); setSel(id); };
  const leave = (id) => {
    setMine(prev => { const n = new Set(prev); n.delete(id); return n; });
    setSel(prevSel => {
      if (prevSel !== id) return prevSel;
      const rest = groups.find(g => g.id !== id && mine.has(g.id));
      return rest ? rest.id : undefined;
    });
  };
  const sel = groups.find(g => g.id === selId && mine.has(g.id)) || groups.find(g => mine.has(g.id));

  return (
    <div>
      <div className="tab-swap">
        <GroupsHero groups={groups} mine={mine} selId={sel && sel.id} onSelect={setSel} onJoin={join} onLeave={leave} />
      </div>

      <div key={sel ? sel.id : ''} className="tab-swap">
        {sel && <GroupLevelTab g={sel} defaultTrait={levelTrait} showMarker={levelMarker} />}
        {sel && <Lazy minHeight={600}><GroupCompare g={sel} /></Lazy>}
      </div>
    </div>
  );
}

// ─── engraved emblem for the circles hero — overlapping social rings with
//     scattered member dots and a center pulse, matching AreaEmblem's style ───
function GroupsEmblem({ accent }) {
  // a honeycomb — groups as cells in a comb; the gold cell is yours.
  const cx = 56, cy = 56, R = 46;
  const hx = (x, y, r) => Array.from({ length: 6 }, (_, k) => {
    const a = (-90 + 60 * k) * Math.PI / 180;
    return `${(x + r * Math.cos(a)).toFixed(2)},${(y + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
  // honeycomb lattice: pointy-top hexes, r=13.5, spaced with a thin seam
  const r = 13.5, dx = Math.sqrt(3) * r + 2, dy = 1.5 * r + Math.sqrt(3);
  const cells = [
    { x: cx - dx / 2, y: cy - dy, you: false },
    { x: cx + dx / 2, y: cy - dy, you: false },
    { x: cx - dx, y: cy, you: false },
    { x: cx, y: cy, you: true },
    { x: cx + dx, y: cy, you: false },
    { x: cx - dx / 2, y: cy + dy, you: false },
    { x: cx + dx / 2, y: cy + dy, you: false },
  ];
  return (
    <svg viewBox="0 0 112 112" width="96" height="96" style={{ flexShrink: 0 }}>
      <defs><clipPath id="grpClip"><circle cx={cx} cy={cy} r={R} /></clipPath></defs>
      <circle cx={cx} cy={cy} r={R} fill="var(--surface)" stroke="var(--ink-2)" strokeWidth="0.9" />
      <g clipPath="url(#grpClip)">
        {cells.map((cl, i) => (
          <polygon key={i} points={hx(cl.x, cl.y, r)}
            fill={cl.you ? `color-mix(in oklch, ${accent}, var(--surface) 60%)` : 'transparent'}
            stroke={cl.you ? accent : 'var(--ink-2)'} strokeWidth={cl.you ? 1.4 : 1}
            opacity={cl.you ? 1 : 0.75} />
        ))}
      </g>
    </svg>
  );
}

// hero — your scenes, in the AreaHero mould (one accent, editorial rows). The
// selected scene drives the Compare tab. Plus an inline follow picker. ───────
function GroupsHero({ groups, mine, selId, onSelect, onJoin, onLeave }) {
  const accent = 'var(--c-groups)';
  const [joinOpen, setJoinOpen] = useStateW(false);
  const yours = groups.filter(g => mine.has(g.id));
  const suggested = groups.filter(g => !mine.has(g.id)).sort((a, b) => b.match - a.match).slice(0, 4);
  const totalMembers = yours.reduce((s, g) => s + g.members, 0);
  const interests = new Set(yours.map(g => g.cat)).size;
  const avgMatch = yours.length ? Math.round(yours.reduce((s, g) => s + g.match, 0) / yours.length) : 0;
  const bestFit = yours.length ? yours.reduce((a, b) => (b.match > a.match ? b : a)) : null;
  const tint = (i) => `color-mix(in oklch, ${accent}, var(--surface) ${22 + i * 13}%)`;
  return (
    <div className="card" style={{
      marginBottom: 14,
      background: `linear-gradient(158deg, var(--surface-2) 0%, color-mix(in oklch, var(--surface-2), ${accent} 8%) 100%)`,
      borderColor: 'var(--rule)', color: 'var(--ink)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: -60, right: -50, width: 210, height: 210, borderRadius: '50%', background: `radial-gradient(circle, color-mix(in oklch, ${accent}, transparent 80%), transparent 70%)`, pointerEvents: 'none' }}></div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.14em', color: accent, textTransform: 'uppercase' }}>Your scenes</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>{yours.length} FOLLOWED</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10, paddingBottom: 14, borderBottom: '0.5px solid var(--rule)' }}>
          <GroupsEmblem accent={accent} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {yours.length ? (
              <React.Fragment>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 30, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1 }}>{window.fmtPop(totalMembers)}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>PEOPLE SHARE THEM</span>
                </div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 24, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.1 }}>No scenes yet</div>
                <div style={{ fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 13.5, color: 'var(--ink-2)', marginTop: 6 }}>follow one below to see where you stand</div>
              </React.Fragment>
            )}
          </div>
        </div>

        {yours.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 22px', marginTop: 13 }}>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 21, color: 'var(--ink)', lineHeight: 1 }}>{avgMatch + '%'}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.03em' }}>avg match</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7, minWidth: 0 }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 21, color: 'var(--ink)', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bestFit.name}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>best fit · {bestFit.match}%</span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 16 }}>
          {yours.map((g) => {
            const on = g.id === selId;
            return (
              <button key={g.id} onClick={() => onSelect(g.id)} className="press" title={`${g.cat} · ${window.fmtPop(g.members)} people`} style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                padding: on ? '6px 8px 6px 12px' : '6px 12px',
                borderRadius: 999,
                background: on ? `color-mix(in oklch, ${accent}, transparent 86%)` : 'var(--surface)',
                border: on ? `1px solid color-mix(in oklch, ${accent}, transparent 45%)` : '0.5px solid var(--rule)',
                transition: 'background 0.2s, border-color 0.2s',
              }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 14.5, letterSpacing: '-0.01em', color: on ? accent : 'var(--ink)', lineHeight: 1 }}>{g.name}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', lineHeight: 1 }}>{window.fmtPop(g.members)}</span>
                {on && (
                  <span onClick={(e) => { e.stopPropagation(); onLeave(g.id); }} title={`Unfollow ${g.name}`} style={{
                    width: 18, height: 18, display: 'grid', placeItems: 'center', cursor: 'pointer',
                    background: `color-mix(in oklch, ${accent}, transparent 80%)`, borderRadius: 999,
                    fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1, color: accent,
                  }}>×</span>
                )}
              </button>
            );
          })}
        </div>

        <button onClick={() => setJoinOpen(o => !o)} style={{
          width: '100%', marginTop: 12, padding: '9px 0', cursor: 'pointer',
          background: 'transparent', border: '1px solid var(--rule)', borderRadius: 10,
          fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.12em', color: joinOpen ? accent : 'var(--ink-2)',
        }}>{joinOpen ? 'CLOSE' : '+ FOLLOW A SCENE'}</button>

        {joinOpen && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column' }}>
            {suggested.map((g, i) => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 8px', borderTop: '0.5px solid var(--rule)' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: 'var(--serif)', fontSize: 15, color: 'var(--ink-2)' }}>{g.name}</span>
                  <span style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.06em', color: 'var(--ink-3)', marginTop: 1 }}>{g.cat.toUpperCase()} · {window.fmtPop(g.members)} · {g.match} MATCH</span>
                </span>
                <button onClick={() => onJoin(g.id)} style={{ flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.12em', padding: '5px 13px', borderRadius: 999, cursor: 'pointer', background: `color-mix(in oklch, ${accent}, transparent 88%)`, border: `1px solid color-mix(in oklch, ${accent}, transparent 55%)`, color: accent }}>FOLLOW</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// the selected circle as a population to compare against — one accent, like the
// geo Compare tab. ──────────────────────────────────────────────────────────
function GroupCompare({ g }) {
  const me = window.IS_DATA.me;
  const accent = 'var(--c-groups)';
  const mp = g.memberProfile || {};
  const traits = [
    { k: 'O', label: 'Openness',          lo: 'grounded', hi: 'curious' },
    { k: 'C', label: 'Conscientiousness', lo: 'easygoing', hi: 'driven' },
    { k: 'E', label: 'Extraversion',      lo: 'reserved', hi: 'outgoing' },
    { k: 'A', label: 'Agreeableness',     lo: 'frank', hi: 'warm' },
    { k: 'N', label: 'Sensitivity',       lo: 'steady', hi: 'reactive' },
  ];
  const gender = mp.gender || {};
  return (
    <div className="fade-in">
      {/* full multi-assessment breakdown: you vs this circle, every test */}
      {window.CompareBreakdown
        ? <window.CompareBreakdown scope="groups" accent={accent} label={g.name} n={g.members} />
        : null}

      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Who's in it</Kicker>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>AGE RANGE</div>
            <div className="fig-num" style={{ fontSize: 22, marginTop: 3 }}><em>{mp.age ? mp.age[0] + '–' + mp.age[1] : '—'}</em></div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em' }}>PEOPLE</div>
            <div className="fig-num" style={{ fontSize: 22, marginTop: 3 }}><em>{window.fmtPop(g.members)}</em></div>
          </div>
        </div>
        {gender.f != null && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em', marginBottom: 6 }}>GENDER MIX</div>
            <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', border: '0.5px solid var(--rule)' }}>
              <div style={{ width: gender.f + '%', background: accent }}></div>
              <div style={{ width: gender.m + '%', background: `color-mix(in oklch, ${accent}, var(--surface) 45%)` }}></div>
              <div style={{ width: (gender.nb || 0) + '%', background: 'var(--ink-3)' }}></div>
            </div>
            <div style={{ display: 'flex', gap: 12, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.05em', marginTop: 6 }}>
              <span>♀ {gender.f}%</span><span>♂ {gender.m}%</span>{gender.nb ? <span>nb {gender.nb}%</span> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SkillCard({ s, cat, suggest }) {
  const hue = cat.hue;
  const baseCats = (window.IS_DATA && window.IS_DATA.baseCats) || [];
  return (
    <div className="card" style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', color: `oklch(0.45 0.13 ${hue})` }}>
          {GL(cat.glyph)} {cat.label.toUpperCase()}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 18, letterSpacing: '-0.01em' }}>{s.name}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 2 }}>
            {s.hours.toLocaleString()} hours{s.lastPracticed !== '—' ? ` · last practiced ${s.lastPracticed}` : ''}
          </div>
          <div style={{ fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>
            {s.vibe}
          </div>
        </div>
      </div>

      {/* domain-specific measurement — what actually marks progress in this pursuit */}
      {s.metric && (
        <div style={{
          marginTop: 11, padding: '10px 13px', borderRadius: 9,
          background: `oklch(0.975 0.018 ${hue})`, border: `0.5px solid oklch(0.86 0.05 ${hue})`,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: `oklch(0.44 0.12 ${hue})` }}>{s.metric.label}</div>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.35 }}>{s.metric.note}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, flexShrink: 0 }}>
            <span className="fig-num" style={{ fontSize: 29, lineHeight: 1, color: `oklch(0.43 0.14 ${hue})` }}><em>{s.metric.value}</em></span>
            {s.metric.unit && <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>{s.metric.unit}</span>}
          </div>
        </div>
      )}
      {suggest && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '0.5px solid var(--rule)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="margin-note" style={{ fontSize: 15 }}>not yet practiced</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.16em', padding: '6px 10px', border: `0.5px solid oklch(0.55 0.12 ${hue})`, color: `oklch(0.45 0.13 ${hue})`, cursor: 'pointer' }}>BEGIN ›</span>
        </div>
      )}
      {/* base skill-types — the faculties this pursuit draws on */}
      {s.base && s.base.length > 0 && (
        <div style={{ marginTop: 11 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>SKILL TYPES</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {s.base.map(bid => {
              const b = baseCats.find(x => x.id === bid);
              if (!b) return null;
              return (
                <span key={bid} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase',
                  padding: '4px 9px', borderRadius: 999,
                  background: `oklch(0.965 0.03 ${b.hue})`,
                  border: `0.5px solid oklch(0.85 0.06 ${b.hue})`,
                  color: `oklch(0.40 0.14 ${b.hue})`,
                }}>{GL(b.glyph)} {b.label}</span>
              );
            })}
          </div>
        </div>
      )}
      {!suggest && s.milestones && s.milestones.length > 0 && (
        <div style={{ marginTop: 11, paddingTop: 10, borderTop: '0.5px solid var(--rule)' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', marginBottom: 4 }}>MILESTONES</div>
          {s.milestones.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 12, color: 'var(--ink-2)', marginBottom: 2 }}>
              <span style={{ color: `oklch(0.55 0.13 ${hue})` }}>·</span>
              <span>{m}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Aggregate — which underlying faculties your pursuits draw on most
function SkillTypesCard() {
  const D = window.IS_DATA;
  const baseCats = D.baseCats || [];
  const joined = D.skills.filter(s => s.joined);
  const totals = {};
  baseCats.forEach(b => { totals[b.id] = 0; });
  joined.forEach(s => (s.base || []).forEach(bid => { if (totals[bid] != null) totals[bid] += (s.hours || 0); }));
  const ranked = baseCats
    .map(b => ({ ...b, v: totals[b.id], n: joined.filter(s => (s.base || []).includes(b.id)).length }))
    .filter(b => b.v > 0)
    .sort((a, b) => b.v - a.v);
  const maxV = Math.max(1, ...ranked.map(b => b.v));
  const top = ranked[0];

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <Kicker>Your skill types</Kicker>
      <div className="margin-note" style={{ fontSize: 15, marginTop: 4, marginBottom: 12 }}>
        the faculties behind your pursuits, weighted by hours.
      </div>
      {top && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 15, color: 'var(--ink-2)' }}>you lean</span>
          <span style={{ fontFamily: 'var(--serif)', fontSize: 22, letterSpacing: '-0.01em', color: `oklch(0.45 0.15 ${top.hue})` }}>{GL(top.glyph)} {top.label}</span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ranked.map(b => {
          const pct = Math.round((b.v / maxV) * 100);
          return (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 94, flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: `oklch(0.42 0.13 ${b.hue})` }}>{GL(b.glyph)} {b.label}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 99, background: 'var(--surface-3)', border: '0.5px solid var(--rule)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: `oklch(0.62 0.14 ${b.hue})`, borderRadius: 99 }} />
              </div>
              <span style={{ flexShrink: 0, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', width: 38, textAlign: 'right' }}>{b.n} {b.n === 1 ? 'skill' : 'skills'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Group-finder test overlay
function GroupTestOverlay({ onClose }) {
  const D = window.IS_DATA;
  const [step, setStep] = useStateW(0);
  const [answers, setAnswers] = useStateW([]);
  const total = D.groupTest.length;

  if (step >= total) {
    // tally
    const score = {};
    answers.forEach(a => a.cats.forEach(c => score[c] = (score[c] || 0) + 1));
    const top = Object.entries(score).sort((a,b)=>b[1]-a[1]).slice(0, 3).map(([id]) => id);
    const recs = D.skills.filter(g => top.includes(g.cat) && !g.joined).slice(0, 3);
    return (
      <div className="overlay" onClick={onClose}>
        <div className="overlay-inner" onClick={e => e.stopPropagation()}>
          <div className="overlay-close" onClick={onClose}>×</div>
          <Kicker>Result</Kicker>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 28, fontStyle: 'var(--voice-italic)', margin: '6px 0 16px' }}>
            Three skills for you.
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {top.map(id => {
              const c = D.skillCats.find(x => x.id === id);
              return <span key={id} style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.1em', padding: '4px 10px', background: `oklch(0.93 0.05 ${c.hue})`, color: `oklch(0.32 0.13 ${c.hue})`, borderRadius: 999 }}>{GL(c.glyph)} {c.label.toUpperCase()}</span>;
            })}
          </div>
          {recs.map(g => {
            const c = D.skillCats.find(x => x.id === g.cat);
            return (
              <div key={g.id} className="card" style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em', color: `oklch(0.45 0.13 ${c.hue})` }}>{GL(c.glyph)} {c.label.toUpperCase()}</div>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 18, marginTop: 4 }}>{g.name}</div>
                <div className="margin-note" style={{ fontSize: 15, marginTop: 4 }}>{g.vibe}</div>
              </div>
            );
          })}
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <span onClick={() => { setStep(0); setAnswers([]); }} style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.16em', padding: '8px 12px', border: '0.5px solid var(--ink)', cursor: 'pointer', marginRight: 8 }}>RETAKE</span>
            <span onClick={onClose} style={{ fontFamily: 'var(--mono)', fontSize: 12, letterSpacing: '0.16em', padding: '8px 12px', background: 'var(--ink)', color: 'var(--surface)', cursor: 'pointer' }}>CLOSE</span>
          </div>
        </div>
      </div>
    );
  }
  const q = D.groupTest[step];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-inner" onClick={e => e.stopPropagation()}>
        <div className="overlay-close" onClick={onClose}>×</div>
        <Kicker>Question {step + 1} / {total}</Kicker>
        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 26, fontStyle: 'var(--voice-italic)', margin: '6px 0 18px' }}>{q.q}</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.opts.map((o, i) => (
            <div key={i}
              onClick={() => { setAnswers([...answers, o]); setStep(step + 1); }}
              className="card"
              style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--serif)', fontSize: 16, fontStyle: 'var(--voice-italic)' }}>{o.t}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink-3)' }}>›</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Expandable daily-report card — compact preview, expands on tap to show
// everything that was shared in that day's log.
const REPORT_PHOTO_BG = {
  fjord: 'linear-gradient(160deg, oklch(0.78 0.06 220), oklch(0.55 0.10 245) 60%, oklch(0.34 0.08 260))',
  kitchen: 'linear-gradient(180deg, oklch(0.86 0.06 60), oklch(0.72 0.09 40) 50%, oklch(0.46 0.10 30))',
  forest: 'linear-gradient(170deg, oklch(0.74 0.09 145), oklch(0.50 0.11 155) 55%, oklch(0.30 0.08 165))',
  window: 'linear-gradient(200deg, oklch(0.92 0.03 80), oklch(0.78 0.05 60) 50%, oklch(0.58 0.07 50))',
};
function CircleDailyCard({ r, onPerson, onOpenDaily }) {
  const D = window.IS_DATA;
  const isMe = r.personId === 'me';
  const p = isMe ? { id: 'me', init: D.me.initials, hue: 38, name: 'you', rel: 'yourself' } : D.people.find(x => x.id === r.personId);
  const [open, setOpen] = useStateW(false);
  if (!p) return null;
  const has = (k) => r.shared && r.shared.includes(k) && r[k] != null && r[k] !== '';
  const photoBg = r.photo ? (r.photo.startsWith('data:') ? `center/cover no-repeat url(${r.photo})` : REPORT_PHOTO_BG[r.photo]) : null;

  // summary of what's in this report, for the collapsed preview
  const tags = [];
  if (isMe && has('photo')) tags.push('photo');
  if (has('weather')) tags.push('weather');
  if (isMe && has('scrapbook')) tags.push('finds');
  if (r.shared && r.shared.includes('people') && ((r.seenNames && r.seenNames.length) || (r.seen && r.seen.length))) tags.push('people');

  return (
    <div onClick={() => setOpen(o => !o)} style={{
      padding: 13,
      background: isMe ? 'var(--surface-2)' : 'var(--surface)',
      border: '0.5px solid var(--rule)',
      borderRadius: 10, cursor: 'pointer', position: 'relative',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Av init={p.init} hue={p.hue} size={38} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 16, letterSpacing: '-0.01em' }}>
            {p.name.split(' ')[0]}
            <span style={{ color: 'var(--ink-3)', fontSize: 12.5, fontStyle: 'var(--voice-italic)' }}> · {p.rel}</span>
            {isMe && <span style={{ marginLeft: 7, fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', color: 'var(--accent)', border: '0.5px solid var(--accent)', borderRadius: 999, padding: '1px 6px', verticalAlign: 'middle' }}>YOU</span>}
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 3 }}>
            {r.date.toUpperCase()}
          </div>
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)', flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
      </div>

      {/* collapsed preview */}
      {!open && (
        <div style={{ marginTop: 9 }}>
          {has('one_line') && (
            <div style={{ fontFamily: 'var(--serif)', fontSize: 13.5, fontStyle: 'var(--voice-italic)', color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              “{r.one_line}”
            </div>
          )}
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8, alignItems: 'center' }}>
              {tags.map(t => (
                <span key={t} style={{
                  fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.05em', textTransform: 'uppercase',
                  padding: '3px 8px', borderRadius: 999,
                  background: `oklch(0.965 0.025 ${p.hue})`,
                  border: `0.5px solid oklch(0.88 0.045 ${p.hue})`,
                  color: `oklch(0.44 0.1 ${p.hue})`,
                }}>{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* expanded — everything shared */}
      {open && (<>
        {has('one_line') && (
          <div style={{ fontFamily: 'var(--serif)', fontSize: 13, fontStyle: 'var(--voice-italic)', color: 'var(--ink-2)', lineHeight: 1.45, padding: '8px 0', marginTop: 6, borderTop: '0.5px solid var(--rule)', borderBottom: '0.5px solid var(--rule)' }}>
            "{r.one_line}"
          </div>
        )}
        {isMe && has('photo') && photoBg && (
          <div style={{ height: 140, borderRadius: 6, overflow: 'hidden', border: '0.5px solid var(--rule)', margin: '10px 0', background: photoBg }} />
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10, fontFamily: 'var(--serif)', fontSize: 12.5, color: 'var(--ink-3)' }}>
          {has('weather') && <span>☾ {r.weather}</span>}
          {r.shared && r.shared.includes('people') && r.seenNames && r.seenNames.length > 0 && <span>· saw {r.seenNames.slice(0,3).join(', ')}{r.seenNames.length > 3 ? ` +${r.seenNames.length - 3}` : ''}</span>}
        </div>
        {isMe && has('scrapbook') && r.scrapbook && r.scrapbook.length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: '0.5px solid var(--rule)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.1em', marginBottom: 4 }}>SCRAPBOOK · TODAY</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {r.scrapbook.map((s, i) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', background: `color-mix(in oklch, oklch(0.55 0.12 ${s.hue}) 14%, var(--surface))`, borderRadius: 999, fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 12, color: 'var(--ink-2)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: `oklch(0.55 0.13 ${s.hue})` }} />{s.name}
                </span>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '0.5px solid var(--rule)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!isMe && <span style={{ marginRight: 'auto' }}><LikeButton id={'circle:' + r.personId + ':' + r.date} hue={p.hue} /></span>}
          <button onClick={(e) => { e.stopPropagation(); isMe ? (onOpenDaily && onOpenDaily()) : (onPerson && onPerson(p)); }} style={{
            padding: '5px 11px', borderRadius: 999, fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.1em',
            background: 'var(--surface)', color: 'var(--ink)', border: '0.5px solid var(--rule)', cursor: 'pointer',
          }}>{isMe ? 'EDIT →' : 'PORTRAIT →'}</button>
        </div>
      </>)}
    </div>
  );
}

// ──────────── PEOPLE ────────────
function PeopleTab({ onPerson, onOpenDaily, embedded }) {
  const D = window.IS_DATA;
  const myDaily = (typeof getMyDailyReport === 'function') ? getMyDailyReport() : null;
  const allReports = myDaily ? [myDaily, ...D.dailyReports] : D.dailyReports;
  const [chainTarget, setChainTarget] = useStateW(null);
  const [chainQuery, setChainQuery] = useStateW('');

  // Group by category
  const categories = [
    { key: 'family', label: 'Family', icon: '✦', hue: 12 },
    { key: 'friends', label: 'Friends', icon: '○', hue: 38 },
    { key: 'colleagues', label: 'Colleagues', icon: '□', hue: 220 },
    { key: 'neighbors', label: 'Neighbors', icon: '△', hue: 145 },
    { key: 'acquaintances', label: 'Acquaintances', icon: '·', hue: 250 },
  ];
  const grouped = categories.map(c => ({
    ...c,
    people: D.people.filter(p => p.category === c.key)
  })).filter(g => g.people.length);

  // Build a link-chain (degrees of separation) — fake but plausible
  const buildChain = (target) => {
    if (!target) return [];
    if (target.degrees === 1) return [{ id: 'you', name: 'you', init: 'YOU' }, target];
    // 2 degrees: pick a friend who knows them
    const broker = D.people.find(p => p.degrees === 1 && (p.id === 'f1' || p.id === 'f3')) || D.people[0];
    return [{ id: 'you', name: 'you', init: 'YOU' }, broker, target];
  };
  const chain = buildChain(chainTarget);

  return (
    <div className="fade-in">
      {!embedded && (<>
        <Kicker>Close people</Kicker>
        <div className="sec-head">
          <h2>People you <em>know</em></h2>
        </div>
      </>)}

      {/* Your social orbit — immersive people profile */}
      <PeopleProfileCard />

      {/* Who your people are — demographics + how you compare against your circle */}
      <CircleCompareBody />

      {/* Quick chip list — for completeness, collapsed by category */}
      <div className="card" style={{ marginBottom: 14 }}>
        <Kicker>Everyone, by circle</Kicker>
        {grouped.map((cat) => (
          <div key={cat.key} style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: `oklch(0.6 0.13 ${cat.hue})`, flexShrink: 0 }}></span>
                {cat.label}
              </span>
              <span style={{ flex: 1, height: 0.5, background: 'var(--rule)' }}></span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.04em' }}>{cat.people.length}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {cat.people.map((p) => (
                <div key={p.id} onClick={() => onPerson(p)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 9px 4px 4px',
                  background: 'var(--surface-2)',
                  border: `0.5px solid oklch(0.78 0.08 ${p.hue})`,
                  borderRadius: 18, cursor: 'pointer',
                }}>
                  <Av init={p.init} hue={p.hue} size={22} />
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em' }}>{p.name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <hr className="rule-dashed" />
      <Kicker>Add someone</Kicker>
      <button style={{
        width: '100%', marginTop: 10, padding: '14px',
        background: 'transparent', border: '1px solid var(--rule)', borderRadius: 12,
        fontFamily: 'var(--serif)', fontStyle: 'var(--voice-italic)', fontSize: 15, color: 'var(--ink-3)',
        cursor: 'pointer'
      }}>+ add a person</button>
    </div>
  );
}

// ── Circle comparison — lives in the People tab's "Your circle" subtab:
//    who your people are, and how you compare against your close ties. ──
function CircleCompareBody() {
  return (
    <>
      <Lazy minHeight={560}><DemographicsCard audId="people" /></Lazy>
      <Lazy minHeight={1400}>
      <CompareBreakdown scope="circle" accent="var(--c-people)" label="your circle" />

      <hr className="rule-dashed" />
      <GroupBreakdown scope="friends" accent="var(--c-people)" />
      </Lazy>
    </>
  );
}

Object.assign(window, { GroupsBody, PeopleTab, CircleCompareBody });

;globalThis.GroupBreakdown = typeof GroupBreakdown === 'undefined' ? globalThis.GroupBreakdown : GroupBreakdown;
;globalThis.CompareRow = typeof CompareRow === 'undefined' ? globalThis.CompareRow : CompareRow;
;globalThis.GroupsBody = typeof GroupsBody === 'undefined' ? globalThis.GroupsBody : GroupsBody;
;globalThis.GroupsEmblem = typeof GroupsEmblem === 'undefined' ? globalThis.GroupsEmblem : GroupsEmblem;
;globalThis.GroupsHero = typeof GroupsHero === 'undefined' ? globalThis.GroupsHero : GroupsHero;
;globalThis.GroupCompare = typeof GroupCompare === 'undefined' ? globalThis.GroupCompare : GroupCompare;
;globalThis.SkillCard = typeof SkillCard === 'undefined' ? globalThis.SkillCard : SkillCard;
;globalThis.SkillTypesCard = typeof SkillTypesCard === 'undefined' ? globalThis.SkillTypesCard : SkillTypesCard;
;globalThis.GroupTestOverlay = typeof GroupTestOverlay === 'undefined' ? globalThis.GroupTestOverlay : GroupTestOverlay;
;globalThis.CircleDailyCard = typeof CircleDailyCard === 'undefined' ? globalThis.CircleDailyCard : CircleDailyCard;
;globalThis.PeopleTab = typeof PeopleTab === 'undefined' ? globalThis.PeopleTab : PeopleTab;
;globalThis.CircleCompareBody = typeof CircleCompareBody === 'undefined' ? globalThis.CircleCompareBody : CircleCompareBody;
;globalThis.REPORT_PHOTO_BG = typeof REPORT_PHOTO_BG === 'undefined' ? globalThis.REPORT_PHOTO_BG : REPORT_PHOTO_BG;

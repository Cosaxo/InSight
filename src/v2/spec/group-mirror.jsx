// Ported from design/spec-modules/group-mirror.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all), and
// re-ported at D432 from design/standalone-2026-09-09/group-mirror.jsx: the
// room read as a cast — the seat line and the role map above the row, and
// Votes · People · Scores · Compare in it. The live twin is
// ui/LiveGroupsMirrorBody.tsx; the two draw the same stop from different
// stores.
import React from 'react';
import { DUELS } from './duels-data.js';
import { Kicker } from './primitives.jsx';
// The palette gate (D189) — see gmAccent below for why this stop in
// particular could not do without it.
import { WPAL } from './world-palette.js';
import NAV from '../data/nav';
import { GDAv, YouChip, GDScenInk } from './group-daily.jsx';
import { CompareBreakdown } from './compare-breakdown.jsx';
import { IS_COMPARE_POP } from './compare-pop.js';
import { GroupRoleMap } from './group-role-map.jsx';
import { MirrorLenses } from './mirror-field.jsx';

// group-mirror.jsx — the Mirror's GROUPS stop: your named circles as a cast
// list. Pick a group → the seat line and the role map, then the four lenses:
// who the room named, who's who inside it, how it rates itself, and how you
// run against it.
const EXPORTS = {};
(function () {
  const { useState, useEffect, useReducer } = React;
  const LINE = '0.5px solid var(--rule)';

  // per-group signature hue — circular mean of the members' hues, worn at the
  // app's shared accent lightness/chroma so each circle recolours the whole stop
  function gmGroupHue(g) {
    let sx = 0, sy = 0;
    g.members.forEach((p) => { sx += Math.cos(p.hue * Math.PI / 180); sy += Math.sin(p.hue * Math.PI / 180); });
    return Math.round(((Math.atan2(sy, sx) * 180 / Math.PI) + 360) % 360);
  }
  // Through the gate (D189), and this is the site where skipping it cost the
  // most: `gmAccent` is not one mark, it is the stop's `--accent` — set on
  // the stage and on every group card — so an un-gated hue reached the ring,
  // the chips, the lens row's underline and every accent-driven mark under
  // it at once. A circular mean of member hues lands anywhere on the wheel,
  // and 0.14 is outside sRGB for a good part of it.
  const gmAccent = (g) => WPAL.ink(`oklch(0.52 0.14 ${gmGroupHue(g)})`);

  // group identity mark — the member cluster wrapped by the ring; the ring's
  // sweep is roles cast over all the roles in the packs (no number)
  function GMIdentity({ g, pct }) {
    const [v, setV] = useState(0);
    useEffect(() => { setV(0); const t = setTimeout(() => setV(pct), 80); return () => clearTimeout(t); }, [pct, g.id]);
    const S = 64, R = 28.5, C = 2 * Math.PI * R;
    return (
      <span style={{ position: 'relative', width: S, height: S, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
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
            <GDAv p={p} size={size}></GDAv>
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
              {!g.done && <span title="a round waiting on you" style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--surface)' }}></span>}
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
  const small = { fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.09em', textTransform: 'uppercase' };
  const gmName = (id) => (id === 'me' ? 'You' : DUELS.first(DUELS.personOf(id)));
  const face = (id, size) => (id === 'me' ? <YouChip size={size}></YouChip> : <GDAv p={DUELS.personOf(id)} size={size} plain></GDAv>);

  // ── Votes: who the room named, by pack ──
  function GroupVotesCard({ g }) {
    const rv = DUELS.roleVotes(g.id);
    const [open, setOpen] = useState(null);
    const packs = rv.scenarios.map((sc) => ({ sc, roles: rv.roles.filter((r) => r.scen.id === sc.id).sort((a, b) => b.r - a.r) })).filter((p) => p.roles.length);
    const dots = (n, ink) => <span style={{ display: 'flex', gap: 3, flexShrink: 0 }}>{Array.from({ length: n }, (_, i) => <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: ink }}></span>)}</span>;
    return (
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Kicker>Who the room named</Kicker>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' }}>{rv.roles.length} vote{rv.roles.length === 1 ? '' : 's'}</span>
        </div>
        {!rv.roles.length && <div style={{ marginTop: 10, fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-3)', textWrap: 'pretty' }}>No votes revealed yet — the first role is on the table.</div>}
        {packs.map(({ sc, roles }) => {
          const ink = GDScenInk(sc);
          return (
            <div key={sc.id} style={{ marginTop: 14 }}>
              <div style={{ ...small, color: ink }}>{sc.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {roles.map((role) => {
                  const on = open === role.key;
                  const pk = on ? DUELS.groupPicksRound(g.id, role.r) : null;
                  return (
                    <div key={role.key} style={{ borderBottom: LINE }}>
                      <button className="press" onClick={() => setOpen(on ? null : role.key)} aria-expanded={on}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 48, padding: '7px 0', border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left', WebkitAppearance: 'none' }}>
                        <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {face(role.winner, 26)}
                          {role.contested && role.second && <span style={{ marginLeft: -7, display: 'inline-flex', boxShadow: '0 0 0 2px var(--surface-2)', borderRadius: 999 }}>{face(role.second, 26)}</span>}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gmName(role.winner)}{role.contested && role.second ? ` & ${gmName(role.second)}` : ''}</span>
                          <span style={{ display: 'block', marginTop: 1, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 500, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role.label}{role.contested ? ' · contested' : ''}</span>
                        </span>
                        {dots(role.votes[role.winner] || 0, ink)}
                        <span aria-hidden="true" style={{ width: 7, height: 7, flexShrink: 0, marginLeft: 2, borderRight: '1.5px solid var(--ink-3)', borderBottom: '1.5px solid var(--ink-3)', transform: on ? 'translateY(2px) rotate(-135deg)' : 'translateY(-2px) rotate(45deg)', transition: 'transform 0.22s var(--ease-out)' }}></span>
                      </button>
                      {on && pk && (
                        <div className="fade-in" style={{ padding: '2px 0 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
                          <div style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, color: 'var(--ink-3)' }}>{role.prompt} · round {role.r}</div>
                          {pk.q.targets.map((id, i) => pk.counts[i] > 0 && (
                            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                              {face(id, 22)}
                              <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontSize: 13, fontWeight: id === role.winner ? 800 : 600, color: 'var(--ink)' }}>{gmName(id)}</span>
                              <span style={small}>by</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                {pk.rows[i].who.map((p) => <GDAv key={p.id} p={p} size={20}></GDAv>)}
                                {pk.mine === i && !pk.late && <YouChip size={20}></YouChip>}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Scores: how the group rates itself ──
  function GroupScoresCard({ g }) {
    const scores = DUELS.groupScores(g.id).sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));
    const total = DUELS.RATE_QS.length;
    const [open, setOpen] = useState(null);
    const pos = (step) => 6 + (step / 4) * 88;
    const word = (lean) => ({ fontFamily: 'var(--sans)', fontSize: 11.5, letterSpacing: '0.01em', width: 72, flexShrink: 0, fontWeight: lean ? 700 : 500, color: lean ? 'var(--accent)' : 'var(--ink-3)', textWrap: 'balance' });
    return (
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Kicker>How the group rates itself</Kicker>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' }}>{scores.length} of {total} rated</span>
        </div>
        {!scores.length && <div style={{ marginTop: 10, fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-3)', textWrap: 'pretty' }}>No ratings yet — every fourth round asks the group about itself.</div>}
        {scores.length > 0 && (
          <div style={{ position: 'relative', marginTop: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {scores.map((s) => {
              const on = open === s.dim;
              const hi = s.score >= 58, lo = s.score <= 42;
              const seen = {};
              return (
                <div key={s.dim}>
                  <button className="press" aria-expanded={on} onClick={() => setOpen(on ? null : s.dim)} aria-label={`${s.poles[0]} to ${s.poles[1]} · the group · ${s.score}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: '2px 0', border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left', WebkitAppearance: 'none', font: 'inherit' }}>
                    <span style={{ ...word(lo), textAlign: 'right' }}>{s.poles[0]}</span>
                    <span style={{ position: 'relative', flex: 1, height: 26 }} aria-hidden="true">
                      <span style={{ position: 'absolute', left: '6%', right: '6%', top: '50%', height: 1, background: 'var(--rule)' }}></span>
                      {[0, 1, 2, 3, 4].map((i) => <span key={i} style={{ position: 'absolute', left: pos(i) + '%', top: '50%', transform: 'translate(-50%, -50%)', width: 5, height: 5, borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--ink-3)', boxSizing: 'border-box' }}></span>)}
                      {s.marks.filter((m) => !m.me).map((m) => {
                        const k = (seen[m.step] = (seen[m.step] || 0) + 1);
                        return <span key={m.id} title={m.p ? m.p.name : ''} style={{ position: 'absolute', left: pos(m.step) + '%', top: '50%', transform: `translate(${-50 + (k - 1) * 45}%, -50%)`, width: 9, height: 9, borderRadius: '50%', background: 'color-mix(in oklch, var(--accent) 45%, var(--surface))' }}></span>;
                      })}
                      <span title={`the group · ${s.score}`} style={{ position: 'absolute', left: pos(s.mean) + '%', top: '50%', transform: 'translate(-50%, -50%)', width: 15, height: 15, borderRadius: '50%', background: 'var(--accent)', border: '2px solid var(--surface)', boxSizing: 'border-box', boxShadow: '0 0 0 1px var(--accent)' }}></span>
                      {s.mine != null && <span title="you" style={{ position: 'absolute', left: pos(s.mine) + '%', top: '50%', transform: 'translate(-50%, -50%)', width: 9, height: 9, borderRadius: '50%', background: 'var(--ink)', boxSizing: 'border-box', boxShadow: '0 0 0 1.5px var(--surface)' }}></span>}
                    </span>
                    <span style={word(hi)}>{s.poles[1]}</span>
                  </button>
                  {on && (() => {
                    const nHi = s.counts[3] + s.counts[4], nLo = s.counts[0] + s.counts[1], mid = s.counts[2];
                    const who = (n) => `${n} of ${s.total}`;
                    return (
                      <div className="fade-in" style={{ margin: '0 0 8px', padding: '9px 12px', borderRadius: 12, background: 'var(--surface-2)', border: LINE }}>
                        <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-2)', textWrap: 'pretty' }}>{s.prompt}</div>
                        <div style={{ marginTop: 5, fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{s.label} <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>· {s.score} · round {s.r}</span></div>
                        <div style={{ marginTop: 4, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', textWrap: 'pretty' }}>
                          {[nHi ? `${who(nHi)} lean ${s.poles[1]}` : null, nLo ? `${who(nLo)} lean ${s.poles[0]}` : null, mid ? `${who(mid)} in between` : null].filter(Boolean).join(' · ')}
                          {s.mine != null ? ` · you said ${DUELS.stepLabel(s.poles, s.mine)}` : ''}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
        <div className="legend" style={{ justifyContent: 'center', gap: 14, marginTop: 10, paddingTop: 11, borderTop: LINE }}>
          <span style={{ '--lgc': 'var(--accent)' }}><span className="lg-dot"></span>the group</span>
          <span style={{ '--lgc': 'var(--ink)' }}><span className="lg-dot"></span>you</span>
          <span style={{ '--lgc': 'color-mix(in oklch, var(--accent) 45%, var(--surface))' }}><span className="lg-dot"></span>members</span>
        </div>
      </div>
    );
  }

  // ── People: who's who — the affinity swarm, the seats, what you share ──
  function GroupPeopleCard({ g }) {
    const P = DUELS.groupPortrait(g.id);
    const ms = DUELS.groupMembers(g.id);
    const LV = 58;
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
    const BH = 108 + maxAbs * LV, cy = BH / 2;
    const count = {};
    ms.forEach((p) => (p.interests || []).forEach((t) => { count[t] = (count[t] || 0) + 1; }));
    const shared = Object.entries(count).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const seats = ms.filter((m) => !m.pending).map((m) => ({ m, A: DUELS.archetypeOf(g.id, m.id) })).filter((s) => s.A);
    const anySeat = seats.some((s) => s.A.total >= 2);
    const twinOn = P.twin && P.votes >= 2;
    return (
      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Kicker>Who’s who</Kicker>
          <span style={small}>closer → higher affinity</span>
        </div>
        <div style={{ position: 'relative', height: BH, marginTop: 6 }}>
          <div style={{ position: 'absolute', left: '2%', right: '2%', top: cy, height: 1, background: 'var(--rule)' }}></div>
          <div style={{ position: 'absolute', left: xOf(100) + '%', top: cy, transform: 'translate(-50%, -50%)', width: 10, height: 10, borderRadius: '50%', background: 'var(--ink)', border: '2px solid var(--surface)', boxShadow: '0 0 0 0.5px var(--rule)' }}></div>
          <div style={{ position: 'absolute', left: xOf(100) + '%', transform: 'translateX(-50%)', top: cy + 9, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)' }}>you</div>
          {pts.map(({ p, x, lvl }) => {
            const isTwin = twinOn && p.id === P.twin.id;
            return (
              <button type="button" className="btn-bare" key={p.id} aria-label={`${p.name} · ${Math.round(p.match)} affinity`} onClick={() => NAV.openPerson(p)}
                style={{ position: 'absolute', left: x + '%', top: cy + lvl * LV, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', minHeight: 44 }}>
                <span style={{ borderRadius: '50%', display: 'inline-flex', marginBottom: 1, boxShadow: isTwin ? '0 0 0 2px var(--accent)' : '0 0 0 2.5px var(--surface)' }}>
                  <GDAv p={p} size={28} plain></GDAv>
                </span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'nowrap', lineHeight: 1.1 }}>{DUELS.first(p)}</span>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{Math.round(p.match)}</span>
              </button>
            );
          })}
        </div>
        {twinOn && (
          <div className="legend" style={{ justifyContent: 'center', marginTop: 2 }}>
            <span style={{ '--lgc': 'var(--accent)' }}><span className="lg-dot"></span>casts the room like you</span>
          </div>
        )}
        {anySeat && (
          <div style={{ marginTop: 13, paddingTop: 13, borderTop: LINE, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {seats.map(({ m, A }) => {
              const named = A.total >= 2 && A.seat;
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <GDAv p={m} size={22} plain></GDAv>
                  <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{DUELS.first(m)}</span>
                  <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: named ? 700 : 500, color: named ? 'var(--accent)' : 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{named ? A.seat.line : 'not named yet'}</span>
                  {named && <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{A.shares[A.seat.id]} of {A.total} votes</span>}
                </div>
              );
            })}
          </div>
        )}
        {shared.length > 0 && (
          <div style={{ marginTop: 13, paddingTop: 13, borderTop: LINE, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...small, flexShrink: 0 }}>in common</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {shared.map(([t, n]) => <span key={t} style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink-2)', padding: '4px 12px', borderRadius: 999, background: 'var(--surface-2)', border: LINE }}>{t} <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>· {n}</span></span>)}
            </div>
          </div>
        )}
      </div>
    );
  }

  const gmh = (s) => { let x = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return ((x >>> 8) % 1000) / 1000; };
  // ── Compare: your profile against the group's, and how they see you ──
  function GroupCompareCard({ g }) {
    const ms = DUELS.groupMembers(g.id);
    const P = DUELS.groupPortrait(g.id);
    const held = DUELS.roleVotes(g.id).roles.filter((r) => r.winner === 'me' || (r.contested && r.second === 'me'));
    const pop = React.useMemo(() => {
      const base = IS_COMPARE_POP.groups;
      if (!base) return null;
      const j = (k, v) => Math.max(6, Math.min(94, Math.round(v + (gmh('cb' + g.id + k) - 0.5) * 22)));
      const out = { label: g.name, n: ms.length };
      ['big5', 'political', 'values', 'attachment', 'cognitive'].forEach((t) => { out[t] = {}; Object.entries(base[t] || {}).forEach(([k, v]) => { out[t][k] = j(t + k, v); }); });
      return out;
    }, [g.id]); // eslint-disable-line react-hooks/exhaustive-deps -- the jitter is keyed on the group id alone; the name and size are constant for a seeded group
    return (
      <React.Fragment>
        {pop && <CompareBreakdown pop={pop} label={g.name} accent="var(--accent)"></CompareBreakdown>}
        <div className="card" style={{ marginTop: 12 }}>
          <Kicker>How they see you</Kicker>
          {held.length ? (
            <React.Fragment>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                {held.map((r) => (
                  <span key={r.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink-2)', padding: '5px 13px', borderRadius: 999, background: 'var(--surface-2)', border: LINE }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: r.contested ? 'var(--surface)' : `oklch(0.62 0.12 ${r.scen.hue})`, border: r.contested ? `1.6px solid oklch(0.62 0.12 ${r.scen.hue})` : 'none' }}></span>
                    {r.label}
                  </span>
                ))}
              </div>
              {held.some((r) => r.contested) && (
                <div className="legend" style={{ marginTop: 9 }}>
                  <span style={{ '--lgc': 'var(--ink-3)' }}><span className="lg-dot" data-hollow=""></span>hollow = contested</span>
                </div>
              )}
            </React.Fragment>
          ) : (
            <div style={{ marginTop: 10, fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--ink-3)' }}>No roles yet — the next vote could change that.</div>
          )}
          <div style={{ marginTop: 15, paddingTop: 13, borderTop: LINE }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>the room named you</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, color: 'var(--ink-2)' }}>{P.meCrowns} of {P.votes} votes</span>
            </div>
            {gmBar(Math.round((P.meCrowns / Math.max(P.votes, 1)) * 100))}
          </div>
        </div>
      </React.Fragment>
    );
  }

  function GroupsMirrorBody() {
    const [, bump] = useReducer((x) => x + 1, 0);
    useEffect(() => DUELS.subscribe(bump), []);
    const gs = DUELS.groups();
    const [gid, setGid] = useState(gs[0] && gs[0].id);
    const g = gs.find((x) => x.id === gid) || gs[0];
    if (!g) return null;
    const nCast = DUELS.roleVotes(g.id).roles.length, nScores = DUELS.groupScores(g.id).length;
    const castPct = Math.round((nCast / Math.max(DUELS.ALL_ROLES.length, 1)) * 100);
    const A = DUELS.archetypeOf(g.id, 'me');
    const lenses = [
      { id: 'votes', label: 'Votes', render: () => <GroupVotesCard g={g}></GroupVotesCard> },
      { id: 'people', label: 'People', render: () => <GroupPeopleCard g={g}></GroupPeopleCard> },
      { id: 'scores', label: 'Scores', render: () => <GroupScoresCard g={g}></GroupScoresCard> },
      { id: 'compare', label: 'Compare', render: () => <GroupCompareCard g={g}></GroupCompareCard> },
    ];
    return (
      <div className="mf-stage" data-screen-label="Mirror — groups" style={{ '--accent': gmAccent(g) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '6px 2px 0' }}>
          <GMIdentity key={g.id} g={g} pct={castPct}></GMIdentity>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--sans)', fontSize: 21, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
            <div style={{ marginTop: 2, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, color: 'var(--ink-3)' }}>
              {nCast || nScores ? `${nCast} role${nCast === 1 ? '' : 's'} cast · ${nScores} score${nScores === 1 ? '' : 's'}` : 'no rounds revealed yet'}
            </div>
          </div>
        </div>
        <GroupPicker gs={gs} cur={g.id} onPick={setGid}></GroupPicker>
        {/* the seat line — said only once two votes have named you, and as
            the seat's LINE, never its label (D432) */}
        {A && A.total >= 2 && A.seat && (
          <div style={{ margin: '12px 2px 0', display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 800, letterSpacing: '-0.015em', color: 'var(--ink)' }}>Here, you are <span style={{ color: 'var(--accent)' }}>{A.seat.line}</span></span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, color: 'var(--ink-3)' }}>{A.shares[A.seat.id]} of {A.total} votes say so</span>
          </div>
        )}
        <GroupRoleMap key={g.id} gid={g.id} gname={g.name}></GroupRoleMap>
        <MirrorLenses key={'lens-' + g.id} lenses={lenses}></MirrorLenses>
      </div>
    );
  }

  Object.assign(EXPORTS, { GroupsMirrorBody });
})();
export const { GroupsMirrorBody } = EXPORTS;

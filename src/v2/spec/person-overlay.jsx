// Ported from design/spec-modules/person-overlay.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { PersonMindMap } from './person-mindmap.jsx';
import { DuoDomains } from './duo-daily.jsx';
import { ReadRun } from './read-run.jsx';
import { FRIENDS } from './follows.js';
import { DUELS } from './duels-data.js';
import { IS_DATA } from './sample-data.js';
import { Av, AnonAv, anonName, Kicker, useDialog } from './primitives.jsx';
import { IS_TEST_RESULTS } from './test-definitions.js';
import { WPAL } from './world-palette.js';
import { IS_matchArchetype } from './archetype-data.js';
import { steadiness, MIN_DUO, MIN_GROUP } from '../data/roles';
import { cueDuel } from '../data/duelCue';
import NAV from '../data/nav';
import { CompareCarousel } from './compare-breakdown.jsx';

// Expanded Person profile — a detailed portrait of similarity
// Replaces the basic PersonOverlay — registration is spec-index.js's
// `loadOverlays` group

(function () {

// deterministic 0..1 from any string — their drifted test values must be stable
function poHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 8) % 100000) / 100000;
}

// ─── Deterministic derivation of a person's full profile from p ───
function derivePerson(p, me) {
  const seed = (key) => {
    const s = String(p.id) + ':' + key;
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };
  // 0..1 from a seed
  const r = (key) => (seed(key) % 100000) / 100000;
  // pull toward you, strength based on match
  const pull = Math.max(0, Math.min(1, (p.match - 35) / 65));

  // mix the user's value with deterministic noise; the higher the match, the closer
  const mix = (myVal, key, slack = 90) => {
    const drift = (r(key) - 0.5) * 2 * slack * (1 - pull * 0.7);
    return Math.max(-100, Math.min(100, myVal + drift));
  };
  const mixBig5 = (myVal, key, slack = 55) => {
    const drift = (r(key) - 0.5) * 2 * slack * (1 - pull * 0.6);
    return Math.max(2, Math.min(100, myVal + drift));
  };

  const big5 = {
    O: mixBig5(me.personality.O, 'b5O'),
    C: mixBig5(me.personality.C, 'b5C'),
    E: mixBig5(me.personality.E, 'b5E'),
    A: mixBig5(me.personality.A, 'b5A'),
    N: mixBig5(me.personality.N, 'b5N'),
  };
  const political = {
    econ:    mix(me.political.econ,    'pe'),
    social:  mix(me.political.social,  'ps'),
    foreign: mix(me.political.foreign, 'pf'),
    env:     mix(me.political.env,     'pv'),
    tech:    mix(me.political.tech,    'pt'),
    auth:    mix(me.political.auth,    'pa'),
    estab:   mix(me.political.estab,   'pb'),
  };
  const morals = {
    future:   mix(me.morals.future,   'mf'),
    circle:   mix(me.morals.circle,   'mc'),
    hedonism: mix(me.morals.hedonism, 'mh'),
    meaning:  mix(me.morals.meaning,  'mm'),
    moral:    mix(me.morals.moral,    'mr'),
    beauty:   mix(me.morals.beauty,   'mb'),
  };

  // chronotype + rhythm
  const chronoOpts = ['early bird', 'night owl', 'biphasic'];
  const chronotype = chronoOpts[seed('chrono') % 3];
  const sleepAvg = (6.4 + r('sleep') * 2.2).toFixed(1) + 'h';

  // closest ideology in econ × social
  const ideos = IS_DATA.ideologies;
  const closest = ideos.map(io => {
    const dx = io.econ - political.econ, dy = io.social - political.social;
    return { ...io, d: Math.sqrt(dx*dx + dy*dy) };
  }).sort((a,b) => a.d - b.d);

  return { big5, political, morals, chronotype, sleepAvg, closest };
}

// ─── The instruments turned toward one person (2026-08-26) ───
// The same role math the Roles panel runs on YOU, read for THEM off the
// shared record: the duo dims with the sides swapped (their insight is
// their right guesses on you), and their own seat in each group you
// share, blended by days. Reads only what the overlay's record cards
// already draw — your duels with them, your common groups — so it
// discloses nothing new. No `cast` dim: the registry dropped it with the
// live refusal (D204 — a dead axis presented as a measurement), so the
// demo matches on the same three group dims the app scores anywhere.
const poClamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
const poRate = (r, t) => (t ? poClamp((r / t) * 100) : 50);
function poPersonTypes(pid) {
  const out = { duo: null, group: null };
  const duo = DUELS.partners().find((x) => x.id === pid && x.played >= MIN_DUO);
  if (duo) {
    const byRun = [];
    let same = 0, shared = 0;
    for (let d = 1; d <= duo.played; d++) {
      const day = DUELS.duoDay(pid, d);
      byRun.push(!!day.byRight);
      if (day.myAns != null && day.theirAns != null) { shared++; if (day.myAns === day.theirAns) same++; }
    }
    const dims = [
      { id: 'read', value: poRate(duo.readBy.right, duo.readBy.total) },
      { id: 'seen', value: poRate(duo.read.right, duo.read.total) },
      { id: 'like', value: poRate(same, shared) },
      { id: 'steady', value: steadiness(byRun) },
    ];
    const m = IS_matchArchetype('duo', dims);
    if (m) out.duo = { ...m.list[m.idx], n: duo.played };
  }
  const sharedGs = DUELS.groups().filter((g) => g.members.some((mm) => mm.id === pid && !mm.pending));
  const items = sharedGs.map((g) => {
    const P = DUELS.groupPortrait(g.id);
    if (!P || P.days < MIN_GROUP || P.withMaj[pid] == null) return null;
    const ms = DUELS.groupMembers(g.id).filter((m2) => !m2.pending);
    let withThem = 0; const majRun = [];
    for (let i = 1; i <= P.days; i++) {
      const gp = DUELS.groupPicks(g.id, i);
      const row = gp.rows.find((r) => r.who.some((w) => w.id === pid));
      if (!row) { majRun.push(true); continue; }
      withThem += gp.counts[row.oi] - 1; // everyone on their option but them
      majRun.push(row.oi === gp.majority);
    }
    const pull = ms.length && P.days ? withThem / (ms.length * P.days) : 0.5;
    return {
      n: P.days,
      dims: [
        { id: 'own', value: poClamp(100 - (P.withMaj[pid] / P.days) * 100) },
        { id: 'pull', value: poClamp(pull * 100) },
        { id: 'settle', value: steadiness(majRun) },
      ],
    };
  }).filter(Boolean);
  if (items.length) {
    const total = items.reduce((a, r) => a + r.n, 0);
    const dims = ['own', 'pull', 'settle'].map((id) => ({
      id,
      value: poClamp(items.reduce((a, r) => a + r.dims.find((d) => d.id === id).value * r.n, 0) / total),
    }));
    const m = IS_matchArchetype('group', dims);
    if (m) out.group = { ...m.list[m.idx], n: items.length };
  }
  return out;
}

// ─── Per-dimension similarity scores (0..100) used in the affinity composer ───
function affinityBreakdown(me, prof, p) {
  // Big5: invert mean absolute distance (0..100 each axis)
  const b5keys = ['O','C','E','A','N'];
  const b5Diff = b5keys.reduce((s,k) => s + Math.abs(me.personality[k] - prof.big5[k]), 0) / b5keys.length;
  const personality = Math.max(0, 100 - b5Diff * 1.05);

  const polKeys = ['econ','auth','foreign','env','tech','estab'];
  const polDiff = polKeys.reduce((s,k) => s + Math.abs(me.political[k] - prof.political[k]), 0) / polKeys.length;
  const politics = Math.max(0, 100 - polDiff * 0.52);

  const mKeys = ['future','circle','hedonism','meaning','moral','beauty'];
  const moralDiff = mKeys.reduce((s,k) => s + Math.abs(me.morals[k] - prof.morals[k]), 0) / mKeys.length;
  const values = Math.max(0, 100 - moralDiff * 0.50);

  // interests overlap (by category id)
  const myCats = new Set(me.myInterests.map(i => i.c));
  const theirCats = new Set((p.interests || []).map(i => i.c));
  const inter = [...myCats].filter(c => theirCats.has(c)).length;
  const union = new Set([...myCats, ...theirCats]).size;
  const interests = union ? Math.round((inter / union) * 100) : 50;

  return { personality, politics, values, interests };
}

// ─── Affinity, broken into bars — the fallback when CompareCarousel is absent ───
function AffinityBreakdown({ parts }) {
  // hue-as-text and full-strength bar fills go through the palette gate
  // (v28: no raw 0.5x ink literals)
  const dims = [
    { k: 'personality', label: 'Personality', col: WPAL.ink('oklch(0.55 0.13 38)') },
    { k: 'politics',    label: 'Politics',    col: WPAL.ink('oklch(0.50 0.12 220)') },
    { k: 'values',      label: 'Values',      col: WPAL.ink('oklch(0.52 0.14 305)') },
    { k: 'interests',   label: 'Interests',   col: WPAL.ink('oklch(0.55 0.10 145)') },
  ].map(d => ({ ...d, v: Math.round(parts[d.k]) })).sort((a, b) => b.v - a.v);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {dims.map(d => (
        <div key={d.k}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{d.label}</span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', color: d.col }}>{d.v}</span>
          </div>
          <div style={{ height: 8, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${d.v}%`, height: '100%', background: d.col, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function PersonOverlay({ p: rawP, onClose, me }) {
  const dlg = useDialog(onClose, rawP && rawP.name ? `${rawP.name} profile` : 'Person profile');
  // Hooks first, unconditionally, ABOVE the `!rawP` guard below. None of
  // them read rawP, so hoisting is behaviour-neutral — but leaving them
  // under an early return made hook order depend on a prop. That is
  // currently unreachable (app-shell.jsx renders this behind `person &&`),
  // which is exactly what makes it a trap: the day anyone mounts this
  // unconditionally, React blows up on a mismatched hook order far from
  // the edit that caused it.
  const [, fBump] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => FRIENDS.subscribe(fBump), []);
  // Play together re-renders on duel state too: Start flips the row to
  // invited, Cancel back, an accepted invite to Open (2026-08-26)
  React.useEffect(() => DUELS.subscribe(fBump), []);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  // hoisted for the same reason as the two above: the mind-map still opens
  // full-screen from a tap, and its state must not sit past the early return.
  const [mapOpen, setMapOpen] = React.useState(false);

  if (!rawP) return null;
  // Normalize interests — some sources (IS_DATA.people) store them as
  // category-id strings; person-overlay expects [{t, c}] objects.
  const cats = IS_DATA.interestCats || [];
  const normInterests = (rawP.interests || []).map(i => {
    if (typeof i === 'string') {
      const cat = cats.find(c => c.id === i);
      return { t: cat ? cat.label.toLowerCase() : i, c: i };
    }
    return i;
  });
  const p = { ...rawP, interests: normInterests };
  const prof = derivePerson(p, me);
  const parts = affinityBreakdown(me, prof, p);
  const themColor = WPAL.ink(`oklch(0.55 0.13 ${p.hue})`);

  const overall = Math.round(p.match);
  const firstName = p.anon ? 'Them' : (p.name ? p.name.split(' ')[0] : p.init);
  const fStatus = !p.anon && p.id ? FRIENDS.status(p.id) : 'none';
  const isFriend = fStatus === 'friends';
  const onFriendBtn = () => {
    if (!p.id) return;
    if (fStatus === 'none') FRIENDS.invite(p.id);
    else if (fStatus === 'invited') FRIENDS.cancel(p.id);
    else setConfirmRemove(true);
  };

  return (
    <div className="overlay surface-tint" {...dlg}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>←</button>
        <div className="h-title" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: p.anon ? 'capitalize' : 'none' }}>{anonName(p)}</div>
        <div className="h-meta" style={{ flexShrink: 0 }}>{p.dist || (p.anon ? 'nearby' : 'in your orbit')}</div>
      </div>
      <div className="app-body">

        {/* ─── Hero — avatar wrapped in an affinity ring gauge ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: 12 }}>
          <div style={{ position: 'relative', width: 152, height: 152, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 14, borderRadius: '50%', background: `radial-gradient(circle at 50% 30%, color-mix(in oklch, ${themColor} 26%, transparent), transparent 74%)`, filter: 'blur(6px)' }} />
            <svg viewBox="0 0 152 152" width="152" height="152" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
              <circle cx="76" cy="76" r="68" fill="none" stroke={`color-mix(in oklch, ${themColor} 16%, transparent)`} strokeWidth="5" />
              <circle cx="76" cy="76" r="68" fill="none" stroke={themColor} strokeWidth="5" strokeLinecap="round"
                strokeDasharray={`${(overall / 100) * 2 * Math.PI * 68} ${2 * Math.PI * 68}`} />
            </svg>
            {p.anon ? <AnonAv hue={p.hue} size={112} /> : <Av init={p.init} hue={p.hue} size={112} />}
            <div style={{
              position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
              display: 'inline-flex', alignItems: 'baseline', gap: 4,
              background: themColor, color: 'white',
              padding: '4px 13px', borderRadius: 999, whiteSpace: 'nowrap',
              boxShadow: `0 6px 16px -6px color-mix(in oklch, ${themColor} 55%, transparent)`, border: '2.5px solid var(--surface)',
            }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 800, letterSpacing: '-0.01em' }}>{overall}</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em' }}>AFFINITY</span>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 28, fontWeight: 800, marginTop: 18, letterSpacing: '-0.03em', lineHeight: 1.1, textTransform: p.anon ? 'capitalize' : 'none' }}>{anonName(p)}</div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.09em', marginTop: 7, textTransform: 'uppercase' }}>
            {p.anon
              ? `${p.role || 'nearby'} · ${p.dist || 'nearby'}`
              : <>{p.role || p.rel} · {p.age ? `aged ${p.age} · ` : ''}{p.dist || 'in your orbit'}</>}
          </div>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            {!p.anon && p.id && (confirmRemove ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>Remove from your circle?</span>
                <button className="press" onClick={() => { FRIENDS.unfriend(p.id); setConfirmRemove(false); }} style={{ padding: '7px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, background: 'var(--ochre)', color: '#fff' }}>Remove</button>
                <button className="press" onClick={() => setConfirmRemove(false)} style={{ padding: '7px 14px', borderRadius: 999, border: '0.5px solid var(--rule)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, background: 'var(--surface-2)', color: 'var(--ink)' }}>Keep</button>
              </div>
            ) : (
              <button className="press" onClick={onFriendBtn} style={{
                padding: '9px 24px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 700, letterSpacing: '0.01em',
                background: fStatus === 'none' ? themColor : 'var(--surface-2)',
                color: fStatus === 'none' ? 'white' : 'var(--ink)',
                border: `0.5px solid ${fStatus === 'none' ? themColor : 'var(--rule)'}`,
                boxShadow: fStatus === 'none' ? `0 6px 14px -6px color-mix(in oklch, ${themColor} 50%, transparent)` : 'none',
                transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
              }}>{isFriend ? 'Friends ✓' : fStatus === 'invited' ? 'Invited · waiting' : 'Add friend'}</button>
            ))}
            {fStatus === 'invited' && !confirmRemove && <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>they{'\u2019'}ll see it soon · tap to cancel</span>}
          </div>
        </div>

        <hr className="rule" />

        {/* ─── Affinity composer — one compare card per category, swipeable ─── */}
        {(() => {
          // A whole fallback card used to sit here for the frame in which
          // compare-breakdown.jsx had not loaded; it is an import now
          // (D353's sweep) and there is no such frame.
          const rnd = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
          const to01 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round((v + 100) / 2)]));
          const who = p.anon ? 'them' : (p.name ? p.name.split(' ')[0] : p.init);
          // the remaining assessment (Social) has no counterpart in
          // derivePerson — derive it the same way: its dims drift off yours,
          // deterministically per person, pulled closer the higher the match
          const drifted = (kind) => {
            const R = IS_TEST_RESULTS[kind];
            if (!R || !R.dims || !R.dims.length) return null;
            const pull = Math.max(0, Math.min(1, ((p.match || 60) - 35) / 65));
            const out = {};
            R.dims.forEach((d) => {
              const r = poHash(String(p.id || p.init || p.name || 'x') + '|' + kind + '|' + d.id);
              const drift = (r - 0.5) * 2 * 46 * (1 - pull * 0.6);
              out[d.id] = Math.max(3, Math.min(100, Math.round(d.value + drift)));
            });
            return out;
          };
          const themPop = { big5: rnd(prof.big5), political: to01(prof.political), values: to01(prof.morals) };
          const social = drifted('attachment');
          if (social) themPop.attachment = social;
          const myInts = me.myInterests || [];
          const myCatSet = new Set(myInts.map(i => i.c));
          const theirCatSet = new Set(p.interests.map(i => i.c));
          const allCats = IS_DATA.interestCats || [];
          // Their interests are declared as CATEGORIES; yours as specific things
          // inside them. So the compare is a category ladder: one row per
          // category either of you keeps, your depth in it as count dots, their
          // stake as a filled mark. Rows where both marks land are the overlap.
          const rows = allCats
            .filter(c => myCatSet.has(c.id) || theirCatSet.has(c.id))
            .map(c => ({
              c, mine: myInts.filter(i => i.c === c.id), them: theirCatSet.has(c.id),
            }))
            .sort((a, b) => {
              const rk = (r) => (r.them && r.mine.length ? 0 : r.mine.length ? 1 : 2);
              return rk(a) - rk(b);
            });
          const bothN = rows.filter(r => r.them && r.mine.length).length;
          // one mark per side, per row: filled = keeps it, hollow = doesn't. Two
          // columns, so a shared row reads as a pair without counting anything.
          const mark = (on, col, tip) => (
            <span title={tip || undefined} style={{
              width: 9, height: 9, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box',
              background: on ? col : 'transparent',
              border: on ? 'none' : '1.5px solid color-mix(in oklch, var(--ink-3) 34%, transparent)',
            }}></span>
          );
          const interestsSlide = {
            kind: 'interests', title: 'Interests', sub: 'shared ground',
            align: Math.round(parts.interests),
            body: (
              <div style={{ marginTop: 13 }}>
                {/* the overlap, as length: how much of the ladder you both keep */}
                <div style={{ display: 'flex', height: 7, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-3)' }}>
                  <span style={{ width: (rows.length ? (bothN / rows.length) * 100 : 0) + '%', background: themColor }}></span>
                </div>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column' }}>
                  {rows.map(({ c, mine, them }) => {
                    const both = them && mine.length > 0;
                    return (
                      <div key={c.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', margin: '0 -10px',
                        borderRadius: 8,
                        background: both ? `color-mix(in oklch, ${themColor} 9%, transparent)` : 'transparent',
                      }}>
                        <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: both ? 700 : 500, color: both ? 'var(--ink)' : 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0 }}>
                          {mark(mine.length > 0, 'var(--ink)', mine.map((i) => i.t).join(', '))}
                          {mark(them, themColor, who)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 11, paddingTop: 9, borderTop: '0.5px solid var(--rule)', display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{mark(true, 'var(--ink)')}you</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{mark(true, themColor)}{who}</span>
                </div>
              </div>
            ),
          };
          return (
            <div style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 9 }}><Kicker>What makes the number</Kicker></div>
              <CompareCarousel
                pop={themPop}
                accent={themColor} label={who}
                aligns={{ big5: Math.round(parts.personality), political: Math.round(parts.politics), values: Math.round(parts.values) }}
                extra={[interestsSlide]}
              />
            </div>
          );
        })()}

        {/* ─── Play together — the doors (2026-08-26): a 1v1 with them, the
            groups you share. Each row leads with their nearest named type,
            read off the shared record alone (poPersonTypes above). The
            jump cues the viewer (data/duelCue) and walks through NAV —
            the daily ruler's licensed exit, D166's joint, unchanged. ─── */}
        {!p.anon && p.id ? (() => {
          const duo = DUELS.partners().find((x) => x.id === p.id) || null;
          const playing = !!(duo && duo.played > 0);
          const invited = !!(duo && duo.state === 'invited');
          const goDuo = () => { cueDuel({ mode: 'duo', id: p.id }); NAV.goNav('track:duo'); };
          const goGroup = (gid) => { cueDuel({ mode: 'group', id: gid }); NAV.goNav('track:group'); };
          const gs = DUELS.groups();
          const shared = gs.filter((g) => g.members.some((m) => m.id === p.id));
          const addable = isFriend ? gs.filter((g) => !g.members.some((m) => m.id === p.id)).slice(0, 4) : [];
          if (!duo && !isFriend && !shared.length) return null;
          const pt = poPersonTypes(p.id);
          const typeSpan = (t) => <span title={t.line} style={{ fontWeight: 800, color: 'var(--ink-2)' }}>{t.name}</span>;
          const lab = (t) => <span style={{ width: 52, flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, color: 'var(--ink)' }}>{t}</span>;
          const mut = { flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', textWrap: 'pretty' };
          const pill = { flexShrink: 0, whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 800, padding: '6px 14px', borderRadius: 999, background: themColor, color: '#fff' };
          const gchip = (g) => {
            const mem = g.members.find((m) => m.id === p.id);
            const pend = !!(mem && mem.pending);
            return (
              <button key={g.id} className="press" onClick={() => { if (!pend) goGroup(g.id); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', border: '0.5px solid ' + (pend ? 'var(--rule)' : `color-mix(in oklch, ${themColor} 36%, var(--rule))`), background: pend ? 'var(--surface-2)' : `color-mix(in oklch, ${themColor} 8%, var(--surface-2))`, color: pend ? 'var(--ink-3)' : 'var(--ink)', borderRadius: 999, padding: '5px 12px', cursor: pend ? 'default' : 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700 }}>
                {g.name}{pend ? <span style={{ fontWeight: 600, fontSize: 11 }}>· invited</span> : null}
              </button>
            );
          };
          return (
            <div style={{ marginBottom: 26 }}>
              <div style={{ marginBottom: 11 }}><Kicker>Play together</Kicker></div>
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  {lab('1v1')}
                  {duo && !invited ? (
                    <React.Fragment>
                      <span style={mut}>{pt.duo ? typeSpan(pt.duo) : null}{pt.duo ? ' · ' : ''}{playing ? duo.played + ' days played' : 'new 1v1 · today’s question is up'}</span>
                      <button className="press" onClick={goDuo} style={pill}>Open</button>
                    </React.Fragment>
                  ) : invited ? (
                    <React.Fragment>
                      <span style={mut}>invited · waiting on {firstName}</span>
                      <button className="press" onClick={() => DUELS.cancelDuo(p.id)} style={{ ...pill, background: 'var(--surface-2)', color: 'var(--ink-2)', border: '0.5px solid var(--rule)' }}>Cancel</button>
                    </React.Fragment>
                  ) : isFriend ? (
                    <React.Fragment>
                      <span style={mut}>one question a day — read each other</span>
                      <button className="press" onClick={() => DUELS.startDuo(p.id)} style={pill}>Start</button>
                    </React.Fragment>
                  ) : (
                    <span style={mut}>for friends — add {firstName} first</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 11, borderTop: '0.5px solid var(--rule)', paddingTop: 12, alignItems: 'baseline' }}>
                  {lab('Groups')}
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
                    {shared.length && pt.group ? <span style={{ ...mut, flex: 'none' }}>{typeSpan(pt.group)} in</span> : null}
                    {shared.length ? shared.map(gchip) : addable.length ? (
                      <React.Fragment>
                        <span style={{ ...mut, flex: 'none' }}>add {firstName} to</span>
                        {addable.map((g) => (
                          <button key={g.id} className="press" onClick={() => DUELS.addGroupMembers(g.id, [p.id])} style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', border: '0.5px solid var(--rule)', background: 'var(--surface-2)', color: 'var(--ink)', borderRadius: 999, padding: '5px 12px', cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700 }}>+ {g.name}</button>
                        ))}
                      </React.Fragment>
                    ) : (
                      <span style={mut}>none together yet</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })() : null}

        {/* ─── The 1v1 record — the one thing only a duel can tell you: how well
            each of you actually reads the other. Same dot language as the daily,
            so a filled dot means the same thing everywhere. ─── */}
        {(() => {
          const duo = DUELS.partners().find((x) => x.id === p.id && x.played > 0) || null;
          if (!duo) return null;
          const row = (label, n, key, color) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 64, flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
              <ReadRun days={Array.from({ length: n }, (_, i) => DUELS.duoDay(p.id, n - i)[key])} color={color} size={13}></ReadRun>
            </div>
          );
          // deep enough to split by domain? then WHICH parts you read beats
          // two aggregate streak rows. Shallow ties keep the simple version.
          const rows = DUELS.domainRows(duo);
          const weak = rows.length >= 2 ? DUELS.weakDomain(duo) : null;
          return (
            <div style={{ marginBottom: 26 }}>
              <div style={{ marginBottom: 11 }}><Kicker>How well you read each other</Kicker></div>
              {rows.length >= 2 && DuoDomains
                ? <DuoDomains rows={rows} themColor={themColor} themName={firstName}></DuoDomains>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {row('you', duo.read.total, 'readRight')}
                    {row(firstName, duo.readBy.total, 'byRight', themColor)}
                  </div>}
              {weak ? <div style={{ marginTop: 13, fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.45, textWrap: 'pretty' }}>Your {weak.noun || weak.label} is where you{'\u2019'}re least legible to {firstName}.</div> : null}
            </div>
          );
        })()}

        {/* ─── The map is its OWN screen, not a panel in this scroll: a live
            pannable map wedged into a scrolling page fights the page for every
            gesture. So the profile carries a small portrait of the overlap and
            one way in; the map itself opens full-screen. ─── */}
        <div style={{ marginBottom: 26 }}>
          {/* the jump out of the duel dots was cold: the still uses dots too, for
              a DIFFERENT thing. So the key rides the kicker line — read before
              the eye lands on the constellation, same grammar as the legend
              above it, so the two sections rhyme instead of colliding. */}
          <div style={{ marginBottom: 11, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, minWidth: 0 }}><Kicker>Where your maps meet</Kicker></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--ink-2)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: themColor }}></span>same</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: '50%', boxSizing: 'border-box', border: `2px solid ${themColor}` }}></span>differ</span>
            </span>
          </div>
          <div className="press" role="button" tabIndex={0} onClick={() => setMapOpen(true)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setMapOpen(true); } }}
            aria-label={`Open ${firstName}'s map`} style={{
            cursor: 'pointer', border: '0.5px solid var(--rule)', borderRadius: 16, overflow: 'hidden',
            background: `radial-gradient(120% 80% at 50% 0%, color-mix(in oklch, ${themColor} 8%, transparent), transparent 72%), var(--surface)`,
          }}>
            {/* a CROP of the portrait, not a shrunk copy: the map lays out in a
                full-height box and the card shows the middle band, so dots and
                branch names stay the size they are on the real screen */}
            <div style={{ height: 158, position: 'relative', overflow: 'hidden', pointerEvents: 'none', maskImage: 'linear-gradient(180deg, transparent 0, #000 15%, #000 86%, transparent 100%)', WebkitMaskImage: 'linear-gradient(180deg, transparent 0, #000 15%, #000 86%, transparent 100%)' }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 330, transform: 'translateY(-50%)' }}>
                <PersonMindMap p={p} following={isFriend} centerName={firstName} still />
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              borderTop: '0.5px solid var(--rule)',
            }}>
              <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
                Open {firstName}{'\u2019'}s map
              </span>
              {!isFriend && <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>partial</span>}
              <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 700, color: themColor }}>↗</span>
            </div>
          </div>
        </div>

      </div>

      {/* the live map gets the whole screen — where it can actually be explored */}
      {mapOpen ? (
        <div className="overlay surface-tint" style={{ zIndex: 24 }}>
          <div className="app-header">
            <button className="avatar-btn" onClick={() => setMapOpen(false)}>←</button>
            <div className="h-title" style={{ flex: 1, minWidth: 0 }}>{firstName}{'\u2019'}s map</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <PersonMindMap p={p} following={isFriend} centerName={firstName} />
          </div>
          {/* the legend belongs where the dots are big enough to read */}
          <div style={{ flexShrink: 0, display: 'flex', gap: 16, padding: '10px 16px 14px', borderTop: '0.5px solid var(--rule)', fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: themColor }}></span>same answer</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 10, height: 10, borderRadius: 99, boxSizing: 'border-box', border: `2px solid ${themColor}` }}></span>you differ</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// The one PersonOverlay — registered globally for the app shell.
window.PersonOverlay = PersonOverlay;

})();

;globalThis.PersonOverlay = typeof PersonOverlay === 'undefined' ? globalThis.PersonOverlay : PersonOverlay;

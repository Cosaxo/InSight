// Ported from design/spec-modules/person-overlay.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { PersonMindMap } from './person-mindmap.jsx';
import { DuoDomains } from './duo-daily.jsx';
import { FRIENDS } from './follows.js';
import { DUELS } from './duels-data.js';
import { IS_DATA } from './sample-data.js';
import { Av, AnonAv, anonName, Kicker, MatchRing, useDialog } from './primitives.jsx';
import { IS_TEST_RESULTS } from './test-definitions.js';
import { WPAL } from './world-palette.js';
import { IS_matchArchetype } from './archetype-data.js';
import { AXES, SEATS, MIN_DUO, MIN_GROUP } from '../data/roles';
import { cueDuel } from '../data/duelCue';
import NAV from '../data/nav';
import { CompareCarousel } from './compare-breakdown.jsx';
// the receipts (2026-09-12) read the bank and the crowd's counts the way
// person-mindmap.jsx does, through the same two imports
import { DAILYQ } from './daily-questions.js';
import { MapStats } from './map-group-stats.js';

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

// ── the receipts (2026-09-12, VISION-2026-09-12 §4) ────────────────────
//
// Which questions you have both answered, and where the answers agree.
// THE SAME INVENTION AS THE MIND MAP, deliberately: person-mindmap.jsx
// derives this person's answers from the same seed, the same hash and
// the same agreement probability (their affinity, less a little), and
// breaks the majority tie the same way, so the lead under the hero and
// the map the lead opens agree to the answer. This page is a demo
// surface (derivePerson invents what it compares; app-shell opens it
// from the sample people alone), which is what licenses inventing here
// at all — nothing on a live build reaches it.
function receiptRows(p) {
  const D = DAILYQ;
  if (!p || p.anon || !D || !D.questions) return null;
  const seed = String(p.id || p.init || p.name || 'x');
  const H = (s) => poHash(seed + '|' + s);
  const agreeP = Math.min(0.9, Math.max(0.35, (p.match || 60) / 100 - 0.05));
  const out = [];
  D.questions.forEach((q) => {
    if (H('has' + q.id) > 0.68) return; // one they haven't answered
    const mineIdx = D.myAnswer(q);
    if (mineIdx == null) return;        // one YOU haven't — no receipt without both
    const n = Math.max(2, q.type === 'rating' ? 10 : q.type === 'binary' ? 2 : q.type === 'scale' ? 5 : (q.options || []).length || 2);
    const qid = q.liveId || q.id;
    const gd = MapStats.dist(qid, 'all', n, mineIdx);
    const asked = MapStats.mode(qid, 'all', n, mineIdx);
    const majIdx = asked != null ? asked : gd ? gd.indexOf(Math.max(...gd)) : Math.floor(H('mj' + q.id) * n);
    let aidx;
    if (H('agree' + q.id) < agreeP) aidx = mineIdx;
    else {
      aidx = H('majb' + q.id) < 0.6 ? majIdx : Math.floor(H('pick' + q.id) * n);
      if (aidx === mineIdx) aidx = (aidx + 1 + Math.floor(H('shift' + q.id) * (n - 1))) % n;
    }
    out.push({ id: q.id, same: aidx === mineIdx });
  });
  return out;
}
// The sentence and its tail. The tail is the part that moves — the splits
// are what the page has to show — so it wears the person's hue.
function receiptLead(rows) {
  const n = rows.length, nSame = rows.filter((r) => r.same).length, nSplit = n - nSame;
  if (nSplit === 0) return { main: 'Same answer every time.', tail: `All ${n}` };
  if (nSame === 0) return { main: 'Different answers every time.', tail: `All ${n}` };
  return { main: `Same answer ${nSame} times out of ${n}.`, tail: nSplit === 1 ? 'One split' : nSplit === 2 ? 'Two splits' : `${nSplit} splits` };
}
// The lead over the compare slides (they arrive closest-first): the two
// ends named, and the far end called far only when it is.
function matchLead(all) {
  const slides = (all || []).filter((s) => s.kind !== 'interests');
  if (slides.length < 2) return null;
  const top = slides[0], low = slides[slides.length - 1];
  return low.align >= 75 ? `Closest on ${top.title}, least on ${low.title}.` : `Closest on ${top.title}. Furthest apart on ${low.title}.`;
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

// ─── The instruments turned toward one person (2026-08-26, D437) ───
// The same role math the Roles panel runs on YOU, read for THEM off the
// shared record: what YOU said they are, over the cast rounds (the share
// of casts per axis — trust · spark · judgement · constancy), and their
// own seat in each group you share (the share of the votes they received
// per seat), blended by votes. Reads only what the page's record cards
// already draw — your 1v1 with them, your common groups — so it
// discloses nothing new. The same floors as the panel: MIN_DUO casts,
// MIN_GROUP votes.
const poClamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
function poPersonTypes(pid) {
  const out = { duo: null, group: null };
  const duo = DUELS.partners().find((x) => x.id === pid && x.played > 0);
  if (duo) {
    const co = DUELS.castOf(pid);
    if (co && co.n >= MIN_DUO) {
      const dims = AXES.map((a, i) => ({ id: a.id, value: poClamp(((co.mine[i] || 0) / co.n) * 100) }));
      const m = IS_matchArchetype('duo', dims);
      if (m) out.duo = { ...m.list[m.idx], n: co.n };
    }
  }
  const sharedGs = DUELS.groups().filter((g) => g.members.some((mm) => mm.id === pid && !mm.pending));
  const items = sharedGs.map((g) => {
    const A = DUELS.archetypeOf(g.id, pid);
    if (!A || A.total < MIN_GROUP) return null;
    return { n: A.total, dims: SEATS.map((st) => ({ id: st.id, value: poClamp((A.shares[st.id] / A.total) * 100) })) };
  }).filter(Boolean);
  if (items.length) {
    const total = items.reduce((a, r) => a + r.n, 0);
    const dims = SEATS.map((st) => ({
      id: st.id,
      value: poClamp(items.reduce((a, r) => a + r.dims.find((d) => d.id === st.id).value * r.n, 0) / total),
    }));
    const m = IS_matchArchetype('group', dims);
    if (m) out.group = { ...m.list[m.idx], n: total };
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

// AffinityBreakdown lived here — four labelled bars, drawn when
// CompareCarousel was absent. That condition stopped existing when
// CompareCarousel became a static import (it renders unconditionally in the
// compare section below), so the component was the D108 residue class: a
// fallback for a state a conversion removed. Nothing read it — no JSX tag,
// no window lookup, no test — and no gate could say so, because
// no-unused-vars is off for the ported spec layer and check:globals only
// sees names that are published or referenced.
//
// D26 is the record that kept it: it survived that sweep because
// "PersonOverlay reaches AffinityBreakdown", and that reachability is gone.

// ─── Together: the doors, the cast, the record ───
function TogetherSection({ p, me, isFriend, firstName, themColor }) {
  const duo = DUELS.partners().find((x) => x.id === p.id) || null;
  const playing = !!(duo && duo.played > 0);
  const invited = !!(duo && duo.state === 'invited');
  const goDuo = () => { cueDuel({ mode: 'duo', id: p.id }); NAV.goNav('track:duo'); };
  const goGroup = (gid) => { cueDuel({ mode: 'group', id: gid }); NAV.goNav('track:group'); };
  const groups = DUELS.groups();
  const shared = groups.filter((g) => g.members.some((m) => m.id === p.id));
  const addable = isFriend ? groups.filter((g) => !g.members.some((m) => m.id === p.id)).slice(0, 4) : [];
  if (!duo && !isFriend && !shared.length) return null;
  const pt = poPersonTypes(p.id);
  const box = (quietBox) => ({
    border: `0.5px solid ${quietBox ? 'color-mix(in oklch, var(--rule), transparent 20%)' : 'var(--rule)'}`, borderRadius: 16,
    background: quietBox ? 'transparent' : 'var(--surface-2)', boxShadow: quietBox ? 'none' : 'var(--shadow-card)',
    color: 'inherit', textAlign: 'left', WebkitAppearance: 'none', appearance: 'none', minWidth: 0,
  });
  const cluster = (people, size = 26) => (
    <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {people.slice(0, 5).map((m, i) => (
        <span key={m.me ? 'me' : m.id || i} style={{ display: 'inline-flex', borderRadius: '50%', marginLeft: i ? -size * 0.28 : 0, position: 'relative', zIndex: 6 - i, boxShadow: m.id === p.id ? `0 0 0 2px var(--surface-2), 0 0 0 3.5px ${themColor}` : '0 0 0 2px var(--surface-2)' }}>
          {m.me ? <Av init={me.initials} hue={38} size={size}></Av> : <Av init={m.init} hue={m.hue} size={size}></Av>}
        </span>
      ))}
      {people.length > 5 ? <span style={{ marginLeft: 7, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>+{people.length - 5}</span> : null}
    </span>
  );
  const fig = (n, unit) => (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: 'var(--sans)', fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
      {unit ? <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{unit}</span> : null}
    </span>
  );
  const chev = <span aria-hidden="true" style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 20, lineHeight: 1, color: 'var(--ink-3)' }}>›</span>;
  const textBtn = (label, onClick) => (
    <button type="button" className="tap44" onClick={(e) => { e.stopPropagation(); onClick(); }}
      style={{ flexShrink: 0, border: 'none', background: 'none', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', padding: '4px 0', cursor: 'pointer', WebkitAppearance: 'none' }}>{label}</button>
  );
  const title = { fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
  const typeName = (t) => (t ? <span title={t.line} style={{ color: themColor }}>{t.name}</span> : null);
  const subLine = (sub) => (sub ? <span style={{ display: 'block', marginTop: 3, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, color: 'var(--ink-2)', lineHeight: 1.4, textWrap: 'pretty' }}>{sub}</span> : null);
  // a wide tile: the people, a figure, a head, a line, a door
  const wide = (key, { people, figure, head, sub, onClick, right, quietTile }) => {
    const Tag = onClick ? 'button' : 'div';
    return (
      <Tag key={key} className={onClick ? 'press' : undefined} onClick={onClick || undefined} type={onClick ? 'button' : undefined}
        style={{ ...box(quietTile), display: 'flex', alignItems: 'center', gap: 14, width: '100%', boxSizing: 'border-box', padding: '13px 14px', cursor: onClick ? 'pointer' : 'default' }}>
        {people ? cluster(people, 30) : null}
        <span style={{ flex: 1, minWidth: 0 }}>
          {figure}
          <span style={{ ...title, display: 'block', marginTop: figure ? 4 : 0 }}>{head}</span>
          {subLine(sub)}
        </span>
        {right !== undefined ? right : onClick ? chev : null}
      </Tag>
    );
  };
  const duoTile = duo && !invited
    ? (playing
      ? wide('duo', { people: [{ me: true }, p], figure: fig(duo.played, duo.played === 1 ? 'round' : 'rounds'), head: <React.Fragment>1v1{pt.duo ? <React.Fragment> · {typeName(pt.duo)}</React.Fragment> : null}</React.Fragment>, sub: pt.duo ? pt.duo.line : null, onClick: goDuo })
      : wide('duo', { people: [{ me: true }, p], head: '1v1 · new', sub: 'the first round is open', onClick: goDuo }))
    : invited
      ? wide('duo', { people: [{ me: true }, p], head: '1v1 · invited', sub: `waiting on ${firstName}`, onClick: null, right: textBtn('Cancel', () => DUELS.cancelDuo(p.id)) })
      : isFriend
        ? wide('duo', { people: [{ me: true }, p], head: 'Start a 1v1', sub: 'answer, then guess theirs — revealed when you both have played', onClick: null, right: textBtn('Start', () => DUELS.startDuo(p.id)) })
        : wide('duo', { people: [{ me: true }, p], head: '1v1', sub: `for friends — add ${firstName} first`, onClick: null, quietTile: true });
  const groupTiles = shared.length ? shared.map((g, i) => {
    const mem = g.members.find((m) => m.id === p.id);
    const pend = !!(mem && mem.pending);
    const people = [mem, ...g.members.filter((m) => m.id !== p.id)].filter(Boolean);
    const t = i === 0 ? pt.group : null;
    const Tag = pend ? 'div' : 'button';
    return (
      <Tag key={g.id} className={pend ? undefined : 'press'} type={pend ? undefined : 'button'} onClick={pend ? undefined : () => goGroup(g.id)}
        aria-label={pend ? undefined : `Open ${g.name}`}
        style={{ ...box(false), display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: '12px 13px 12px', cursor: pend ? 'default' : 'pointer' }}>
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 28 }}>{cluster(people)}{pend ? null : chev}</span>
        <span style={{ marginTop: 12 }}>{fig(g.members.length + 1, 'people')}</span>
        <span style={{ ...title, display: 'block', marginTop: 5 }}>{g.name}</span>
        {t ? <span style={{ display: 'block', marginTop: 1, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeName(t)}</span> : null}
        {subLine(pend ? `invited · waiting on ${firstName}` : t ? t.line : null)}
      </Tag>
    );
  }) : null;
  const groupsFallback = shared.length ? null : addable.length ? (
    <div style={{ ...box(true), display: 'flex', flexDirection: 'column', gap: 9, padding: '13px 14px' }}>
      <span style={title}>Add {firstName} to a group</span>
      <span style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {addable.map((g) => (
          <button key={g.id} type="button" className="press" onClick={() => DUELS.addGroupMembers(g.id, [p.id])}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', border: '0.5px solid var(--rule)', background: 'var(--surface-2)', color: 'var(--ink)', borderRadius: 999, padding: '5px 12px 5px 6px', minHeight: 44, cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700 }}>
            {cluster(g.members.slice(0, 3), 20)}+ {g.name}
          </button>
        ))}
      </span>
    </div>
  ) : (
    <div style={{ ...box(true), display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px' }}>
      <span style={{ ...title, flex: 1, color: 'var(--ink-2)', fontWeight: 600 }}>No groups together yet</span>
    </div>
  );
  // what you are to each other — the cast rounds, both directions
  const co = playing ? DUELS.castOf(p.id) : null;
  const castBlock = co && co.n > 0 && co.youAre && co.theyAre ? (
    <div style={{ marginBottom: 26 }}>
      <div style={{ marginBottom: 8 }}><Kicker>What you are to each other</Kicker></div>
      <div style={{ fontFamily: 'var(--sans)', fontSize: 17, fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.3, color: 'var(--ink)', textWrap: 'pretty' }}>
        You are <span style={{ color: themColor }}>{DUELS.castThem(co.youAre.role.them, firstName, duo.mode === 'romantic')}</span>. {firstName} is {co.theyAre.role.label}.
      </div>
      <div style={{ marginTop: 7, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', textWrap: 'pretty' }}>
        {firstName} said so in {co.youAre.n} of {co.n} round{co.n === 1 ? '' : 's'} asked{co.sawIt.total ? ` · you guessed it ${co.sawIt.right} of ${co.sawIt.total}` : ''}
      </div>
    </div>
  ) : null;
  // how well you read each other — the two rings, the reader line, the
  // parts of each other you read (deep enough), the same dot language as
  // the daily
  let record = null;
  if (playing) {
    const drows = DUELS.domainRows(duo);
    const weak = drows.length >= 2 ? DUELS.weakDomain(duo) : null;
    const rRate = duo.read.right / Math.max(1, duo.read.total), bRate = duo.readBy.right / Math.max(1, duo.readBy.total);
    const gapR = rRate - bRate;
    const readerLine = Math.abs(gapR) < 0.08 ? `You and ${firstName} read each other about equally well.` : gapR > 0 ? `You read ${firstName} better than ${firstName} reads you` : `${firstName} reads you better than you read ${firstName}`;
    const lead = weak && Math.abs(gapR) >= 0.08 && weak.byRate > bRate + 0.05 ? `${readerLine}, except on ${weak.label}.` : Math.abs(gapR) < 0.08 ? readerLine : readerLine + '.';
    const ring = (n, tot, color, caption) => (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <MatchRing pct={(n / Math.max(1, tot)) * 100} color={color} size={78} thick={4} title={`${n} of ${tot}`}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{n}<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>/{tot}</span></span>
        </MatchRing>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', textAlign: 'center' }}>{caption}</span>
      </span>
    );
    record = (
      <div style={{ marginBottom: 26 }}>
        <div style={{ marginBottom: 8 }}><Kicker>How well you read each other</Kicker></div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 17, fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.3, color: 'var(--ink)', textWrap: 'pretty' }}>{lead}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 18 }}>
          {ring(duo.read.right, duo.read.total, 'var(--ink)', `you read ${firstName}`)}
          {ring(duo.readBy.right, duo.readBy.total, themColor, `${firstName} reads you`)}
        </div>
        {drows.length >= 2 ? <div style={{ marginTop: 22 }}><DuoDomains rows={drows} themColor={themColor} themName={firstName}></DuoDomains></div> : null}
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ marginBottom: 11 }}><Kicker>Together</Kicker></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 26 }}>
        {duoTile}
        {groupTiles ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>{groupTiles}</div> : groupsFallback}
      </div>
      {castBlock}
      {record}
    </div>
  );
}

// The person's map, as a SCREEN of its own — extracted from PersonOverlay's
// render so that `useDialog` can mount and unmount with it.
//
// Inline, it was the one `.overlay` root in the tree with no dialog props at
// all, and a hook cannot be conditional, so there was nowhere to put them.
// What that cost: the map opened as a second full-screen layer over the
// profile, and the profile's OWN useDialog was still the one listening — so
// Escape (and Android back, through the same handler) closed both at once,
// peeling two layers on one press, and focus never entered the map.
function PersonMapScreen({ p, isFriend, firstName, themColor, onBack }) {
  const dlg = useDialog(onBack, firstName + '\u2019s map');
  return (
    <div className="overlay surface-tint" {...dlg} style={{ zIndex: 24 }}>
      <div className="app-header">
        <button className="avatar-btn" aria-label="Back" onClick={onBack}>←</button>
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
  const rrows = receiptRows(p);
  const leadParts = rrows && rrows.length ? receiptLead(rrows) : null;
  const parts = affinityBreakdown(me, prof, p);
  const themColor = WPAL.ink(`oklch(0.55 0.13 ${p.hue})`);

  const overall = Math.round(p.match);
  const firstName = p.anon ? 'Them' : (p.name ? p.name.split(' ')[0] : p.init);
  const fStatus = !p.anon && p.id ? FRIENDS.status(p.id) : 'none';
  const isFriend = fStatus === 'friends';
  // Two states draw the filled button (2026-09-12): nobody has asked, or
  // THEY have — "Accept request" is the person page's door into the
  // friends handshake, and accepting is the same invite the store already
  // writes (follows.js: an invite to somebody asking is an accept).
  const fPrim = fStatus === 'none' || fStatus === 'requested';
  const onFriendBtn = () => {
    if (!p.id) return;
    if (fStatus === 'none') FRIENDS.invite(p.id);
    else if (fStatus === 'invited') FRIENDS.cancel(p.id);
    else if (fStatus === 'requested') FRIENDS.accept(p.id);
    else setConfirmRemove(true);
  };

  return (
    <div className="overlay surface-tint" {...dlg}>
      <div className="app-header">
        <button className="avatar-btn" aria-label="Back" onClick={onClose}>←</button>
        <div className="h-title" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: p.anon ? 'capitalize' : 'none' }}>{anonName(p)}</div>
        <div className="h-meta" style={{ flexShrink: 0 }}>{p.dist || (p.anon ? 'nearby' : p.since ? `since ${p.since}` : 'in your orbit')}</div>
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
              // `since` (2026-09-12): when the row was written, between the
              // relation and where they are
              : [p.role || p.rel, p.age ? `aged ${p.age}` : null, p.since ? `since ${p.since}` : null, p.dist].filter(Boolean).join(' · ') || 'in your orbit'}
          </div>
          {/* the receipts lead (2026-09-12): a sentence and a tail, the
              whole line a door to their answers — the mind map, which is
              where this page draws them */}
          {leadParts && (
            <button
              className="press"
              onClick={() => setMapOpen(true)}
              aria-label={`${leadParts.main} ${leadParts.tail}. See the answers`}
              style={{ marginTop: 8, padding: '2px 0', border: 'none', background: 'none', cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none', color: 'var(--ink-2)', fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, textAlign: 'center', textWrap: 'pretty' }}
            >
              {leadParts.main} <span style={{ color: themColor, fontWeight: 700, whiteSpace: 'nowrap' }}>{leadParts.tail} ›</span>
            </button>
          )}

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
                background: fPrim ? themColor : 'var(--surface-2)',
                color: fPrim ? 'white' : 'var(--ink)',
                border: `0.5px solid ${fPrim ? themColor : 'var(--rule)'}`,
                boxShadow: fPrim ? `0 6px 14px -6px color-mix(in oklch, ${themColor} 50%, transparent)` : 'none',
                transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
              }}>{isFriend ? 'Friends ✓' : fStatus === 'invited' ? 'Invited · waiting' : fStatus === 'requested' ? 'Accept request' : 'Add friend'}</button>
            ))}
            {fStatus === 'invited' && !confirmRemove && <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>they{'\u2019'}ll see it soon · tap to cancel</span>}
          </div>
        </div>

        <hr className="rule" />

        {/* ─── Affinity composer — one compare card per category, swipeable ─── */}
        {(() => {
          // A whole fallback card used to sit here for the frame in which
          // compare-breakdown.jsx had not loaded; it is an import now
          // (D354's sweep) and there is no such frame.
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
                  {/* the person's hue and a faded hue (2026-09-12), the
                      carousel's own legend one card over — not ink and hue */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{mark(true, themColor)}you</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{mark(true, `color-mix(in oklch, ${themColor}, transparent 52%)`)}{who}</span>
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
                lead={(slides) => {
                  const txt = matchLead(slides);
                  return txt ? <div style={{ marginBottom: 14, fontFamily: 'var(--sans)', fontSize: 17, fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.3, color: 'var(--ink)', textWrap: 'pretty' }}>{txt}</div> : null;
                }}
              />
            </div>
          );
        })()}

        {/* ─── Together (D437, the person page's Together tab of the owner's
            2026-09-09 design, drawn as a section of this page): the doors —
            a 1v1 with them, the groups you share, each leading with their
            nearest named type read off the shared record alone
            (poPersonTypes above); what you are to each other, from the
            cast rounds; and how well you read each other, which left the
            role instrument for here. The jumps cue the viewer
            (data/duelCue) and walk through NAV — the daily ruler's
            licensed exit, D166's joint, unchanged. ─── */}
        {!p.anon && p.id ? <TogetherSection p={p} me={me} isFriend={isFriend} firstName={firstName} themColor={themColor}></TogetherSection> : null}

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
        <PersonMapScreen p={p} isFriend={isFriend} firstName={firstName} themColor={themColor} onBack={() => setMapOpen(false)} />
      ) : null}
    </div>
  );
}

// The one PersonOverlay — registered globally for the app shell.
window.PersonOverlay = PersonOverlay;

})();

;globalThis.PersonOverlay = typeof PersonOverlay === 'undefined' ? globalThis.PersonOverlay : PersonOverlay;

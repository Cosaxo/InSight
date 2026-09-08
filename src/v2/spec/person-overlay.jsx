// Ported from design/spec-modules/person-overlay.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
//
// Redrawn as four tabs — Match · Answers · Together · Map — with a swipe
// between them, from the 2026-09-08 standalone (design/standalone-2026-09-08/
// person-overlay.jsx, the plan's §4; D430). The demo page: everything below
// folds from the sample people and the demo duel engine, and the page is
// opened from the demo surfaces alone (`openPerson`). A live person's page
// over real answers is the plan's own next step (VISION-2026-09-08 §4.6).
import React from 'react';
import { PersonMindMap } from './person-mindmap.jsx';
import { ReadRun } from './read-run.jsx';
import { FRIENDS } from './follows.js';
import { DUELS } from './duels-data.js';
import { DAILYQ } from './daily-questions.js';
import { MapStats } from './map-group-stats.js';
import { HAPTIC } from './haptics.js';
import { IS_DATA } from './sample-data.js';
import { Av, AnonAv, anonName, Kicker, MatchRing, useDialog, useSubSwipe } from './primitives.jsx';
import { IS_TEST_RESULTS } from './test-definitions.js';
import { WPAL } from './world-palette.js';
import { IS_matchArchetype } from './archetype-data.js';
import { steadiness, MIN_DUO, MIN_GROUP } from '../data/roles';
import { cueDuel } from '../data/duelCue';
import NAV from '../data/nav';
import { CompareList } from './compare-breakdown.jsx';

// deterministic 0..1 from any string — their drifted test values must be stable
function poHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 8) % 100000) / 100000;
}

// ─── The answers behind the number (2026-09-08) ───
// One row per question you both answered, folded from the demo bank: which
// of the person's answers agree with yours is drawn deterministically off
// their affinity (a closer match agrees more often), the crowd's split says
// how typical the pick was, and the question's topic gives the row its hue.
// Nothing here is a real person's record — the live page reads answers
// through fetchAnswersOf (VISION-2026-09-08 §4.6) and does not use this.
function receiptRows(p) {
  const D = DAILYQ;
  if (!D || !D.questions) return null;
  const seed = String(p.id || p.init || p.name || 'x');
  const H = (s) => poHash(seed + '|' + s);
  const agreeP = Math.min(0.9, Math.max(0.35, (p.match || 60) / 100 - 0.05));
  const ansText = (q, idx) => (q.type === 'rating' ? (idx + 1) + '/10' : (q.options && q.options[idx] != null ? q.options[idx] : '—'));
  const out = [];
  D.questions.forEach((q) => {
    if (H('has' + q.id) > 0.68) return;
    const mineIdx = D.myAnswer(q);
    if (mineIdx == null) return;
    const n = Math.max(2, q.type === 'rating' ? 10 : q.type === 'binary' ? 2 : q.type === 'scale' ? 5 : ((q.options || []).length || 2));
    const gd = MapStats ? MapStats.dist(q.id, 'all', n, mineIdx) : null;
    const majIdx = gd ? gd.indexOf(Math.max(...gd)) : Math.floor(H('mj' + q.id) * n);
    let aidx;
    if (H('agree' + q.id) < agreeP) aidx = mineIdx;
    else {
      aidx = H('majb' + q.id) < 0.6 ? majIdx : Math.floor(H('pick' + q.id) * n);
      if (aidx === mineIdx) aidx = (aidx + 1 + Math.floor(H('shift' + q.id) * (n - 1))) % n;
    }
    const typ = gd ? gd[aidx] / 100 : 0.5;
    let hue = 250, cat = '';
    if (D.categoryPath && D.catMeta) {
      try {
        const path = D.categoryPath(q);
        const meta = D.catMeta(path[0]);
        if (meta && meta.hue != null) hue = meta.hue;
        cat = path[0] || '';
      } catch (e) { /* a question outside the tree keeps the default hue */ }
    }
    out.push({
      id: q.id,
      prompt: q.prompt.replace(/[.\s]+$/, ''),
      hue, cat,
      same: aidx === mineIdx,
      mine: ansText(q, mineIdx),
      them: ansText(q, aidx),
      typ,
      gap: q.type === 'rating' || q.type === 'scale' ? Math.abs(aidx - mineIdx) / (n - 1) : 1,
    });
  });
  return out;
}

// The lead sentence: the count, and — where the splits are the story — the
// splits named. Exported for the suite that pins the three shapes.
export function receiptLead(rows) {
  const nSame = rows.filter((r) => r.same).length, nSplit = rows.length - nSame;
  return nSplit === 0 ? `Same answer on all ${rows.length}.`
    : nSame === 0 ? `Different answers on all ${rows.length}.`
    : nSplit <= 2 && nSame >= 6 ? `Same answer ${nSame} times out of ${rows.length}. ${nSplit === 1 ? 'One' : 'Two'} split${nSplit === 1 ? '' : 's'}.`
    : `Same answer ${nSame} times out of ${rows.length}.`;
}


// Expanded Person profile — a detailed portrait of similarity
// Replaces the basic PersonOverlay — registration is spec-index.js's
// `loadOverlays` group

(function () {

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

// The Answers tab: every shared question as a dot in its topic's hue —
// filled where you both said the same, a ring where you differ — seven
// across, sorted by topic then splits first; the tapped one is read in a
// card under the grid, and the first split is open on arrival because with
// 34 of 35 matching the one split IS the story. A listbox of options, so a
// screen reader gets the prompt and the verdict per dot and the count once.
function AnswersPanel({ rows, themColor, firstName }) {
  const items = React.useMemo(
    () => rows.slice().sort((a, b) => a.hue - b.hue || (a.same ? 1 : 0) - (b.same ? 1 : 0) || a.typ - b.typ),
    [rows],
  );
  const splits = items.filter((r) => !r.same).sort((a, b) => b.gap - a.gap || a.typ - b.typ);
  const [sel, setSel] = React.useState(() => (splits[0] ? splits[0].id : null));
  const cur = items.find((r) => r.id === sel) || null;
  const col = (r) => `oklch(0.605 0.118 ${r.hue})`;
  const who = { fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' };
  const lg = { display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' };
  return (
    <div style={{ paddingTop: 12, marginBottom: 30 }}>
      <div role="listbox" aria-label={`${items.length} questions you both answered`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', rowGap: 4 }}>
        {items.map((r) => {
          const on = r.id === sel;
          return (
            <button key={r.id} type="button" role="option" aria-selected={on}
              aria-label={`${r.prompt} — ${r.same ? 'same answer' : 'you differ'}`}
              onClick={() => setSel(on ? null : r.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 44, border: 'none', background: 'none', padding: 0, cursor: 'pointer', WebkitAppearance: 'none', appearance: 'none' }}>
              <span style={{
                width: 26, height: 26, borderRadius: '50%', boxSizing: 'border-box',
                background: r.same ? col(r) : `color-mix(in oklch, ${col(r)}, transparent 88%)`,
                border: r.same ? 'none' : `3px solid ${col(r)}`,
                boxShadow: on ? '0 0 0 2.5px var(--surface), 0 0 0 4.5px var(--ink)' : 'none',
                transform: on ? 'scale(1.08)' : 'none',
                transition: 'transform 0.22s var(--ease-spring), box-shadow 0.16s ease',
              }}></span>
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 16 }}>
        <span style={lg}><span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--ink-2)' }}></span>same answer</span>
        <span style={lg}><span style={{ width: 9, height: 9, borderRadius: '50%', boxSizing: 'border-box', border: '2px solid var(--ink-2)' }}></span>you differ</span>
      </div>
      {cur ? (
        <div key={cur.id} className="fade-in" style={{ marginTop: 16, padding: '14px 16px 15px', borderRadius: 16, border: '0.5px solid var(--rule)', background: 'var(--surface-2)', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', boxSizing: 'border-box', background: cur.same ? col(cur) : 'transparent', border: cur.same ? 'none' : `2px solid ${col(cur)}` }}></span>
            <Kicker>{cur.cat || 'question'}</Kicker>
          </div>
          <div style={{ marginTop: 8, fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 500, lineHeight: 1.35, color: 'var(--ink)', textWrap: 'pretty' }}>{cur.prompt}</div>
          <div style={{ marginTop: 7, fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 700, letterSpacing: '-0.005em', color: 'var(--ink)', textWrap: 'pretty' }}>
            {cur.same
              ? <React.Fragment><span style={who}>both </span>{cur.mine}</React.Fragment>
              : <React.Fragment><span style={who}>you </span>{cur.mine}<span style={who}> · {firstName} </span><span style={{ color: themColor }}>{cur.them}</span></React.Fragment>}
          </div>
        </div>
      ) : null}
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
  // The four tabs (2026-09-08): which of them exist depends on the record,
  // so the list is computed off rawP with null guards — above the return,
  // for the reason above.
  const rows = React.useMemo(() => (rawP ? receiptRows(rawP) : null), [rawP]);
  const hasRows = !!(rows && rows.length >= 4);
  const pid = rawP && !rawP.anon ? rawP.id : null;
  const duo = pid ? DUELS.partners().find((x) => x.id === pid) || null : null;
  const groupsAll = pid ? DUELS.groups() : [];
  const shared = pid ? groupsAll.filter((g) => g.members.some((m) => m.id === pid)) : [];
  const fStatus = pid ? FRIENDS.status(pid) : 'none';
  const isFriend = fStatus === 'friends';
  const hasTogether = !!(pid && (duo || isFriend || shared.length));
  const TABS = [
    { id: 'match', label: 'Match' },
    hasRows ? { id: 'answers', label: 'Answers' } : null,
    hasTogether ? { id: 'together', label: 'Together' } : null,
    { id: 'map', label: 'Map' },
  ].filter(Boolean);
  const [subRaw, setSub] = React.useState('match');
  const [why, setWhy] = React.useState(false);
  const sub = TABS.some((t) => t.id === subRaw) ? subRaw : 'match';
  const panelRef = React.useRef(null);
  const bodyRef = React.useRef(null);
  useSubSwipe(bodyRef, panelRef, TABS.map((t) => t.id), sub, setSub);

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
  const onFriendBtn = () => {
    if (!p.id) return;
    if (fStatus === 'none') FRIENDS.invite(p.id);
    else if (fStatus === 'invited') FRIENDS.cancel(p.id);
    else setConfirmRemove(true);
  };
  const goDuo = () => { cueDuel({ mode: 'duo', id: p.id }); NAV.goNav('track:duo'); };
  const goGroup = (gid) => { cueDuel({ mode: 'group', id: gid }); NAV.goNav('track:group'); };

  // ─── Match — what makes the number, one instrument per row ───
  const renderMatch = () => {
    // A whole fallback card used to sit here for the frame in which
    // compare-breakdown.jsx had not loaded; it is an import now
    // (D354's sweep) and there is no such frame.
    const rnd = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));
    const to01 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round((v + 100) / 2)]));
    const who = p.anon ? 'them' : firstName;
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
    const ladder = allCats
      .filter(c => myCatSet.has(c.id) || theirCatSet.has(c.id))
      .map(c => ({
        c, mine: myInts.filter(i => i.c === c.id), them: theirCatSet.has(c.id),
      }))
      .sort((a, b) => {
        const rk = (r) => (r.them && r.mine.length ? 0 : r.mine.length ? 1 : 2);
        return rk(a) - rk(b);
      });
    const bothN = ladder.filter(r => r.them && r.mine.length).length;
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
        <div style={{ marginTop: 6 }}>
          {/* the overlap, as length: how much of the ladder you both keep */}
          <div style={{ display: 'flex', height: 7, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-3)' }}>
            <span style={{ width: (ladder.length ? (bothN / ladder.length) * 100 : 0) + '%', background: themColor }}></span>
          </div>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column' }}>
            {ladder.map(({ c, mine, them }) => {
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
      <div style={{ paddingTop: 16, marginBottom: 26 }}>
        <div style={{ marginBottom: 9 }}><Kicker>What makes the number</Kicker></div>
        <CompareList
          pop={themPop}
          accent={themColor} label={who}
          aligns={{ big5: Math.round(parts.personality), political: Math.round(parts.politics), values: Math.round(parts.values) }}
          extra={[interestsSlide]}
        />
      </div>
    );
  };

  // ─── Together — Play together as tiles, and how well you read each other ───
  // The tiles lead with the shared record's figure and the pair's nearest
  // named type (poPersonTypes above); the type's line sits behind the ⓘ,
  // one tap away rather than deleted (COPY.md §3 — a line about a person is
  // a claim). The jumps cue the viewer (data/duelCue) and walk through NAV —
  // the daily ruler's licensed exit, D166's joint, unchanged since D310.
  const renderTogether = () => {
    const playing = !!(duo && duo.played > 0);
    const invited = !!(duo && duo.state === 'invited');
    const addable = isFriend ? groupsAll.filter((g) => !g.members.some((m) => m.id === p.id)).slice(0, 4) : [];
    const pt = poPersonTypes(p.id);
    const hasWhy = !!(pt.duo || pt.group);
    const cluster = (people, size = 26) => (
      <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {people.slice(0, 5).map((m, i) => (
          <span key={m.me ? 'me' : (m.id || i)} style={{
            display: 'inline-flex', borderRadius: '50%', marginLeft: i ? -size * 0.28 : 0, position: 'relative', zIndex: 6 - i,
            boxShadow: m.id === p.id ? `0 0 0 2px var(--surface-2), 0 0 0 3.5px ${themColor}` : '0 0 0 2px var(--surface-2)',
          }}>
            {m.me ? <Av init={me.initials} hue={38} size={size} /> : <Av init={m.init} hue={m.hue} size={size} />}
          </span>
        ))}
        {people.length > 5 ? <span style={{ marginLeft: 7, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>+{people.length - 5}</span> : null}
      </span>
    );
    const box = (quiet) => ({
      border: `0.5px solid ${quiet ? 'color-mix(in oklch, var(--rule), transparent 20%)' : 'var(--rule)'}`,
      borderRadius: 16, background: quiet ? 'transparent' : 'var(--surface-2)',
      boxShadow: quiet ? 'none' : 'var(--shadow-card)', color: 'inherit', textAlign: 'left',
      WebkitAppearance: 'none', appearance: 'none', minWidth: 0,
    });
    const fig = (n, unit) => (
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, whiteSpace: 'nowrap' }}>
        <span style={{ fontFamily: 'var(--sans)', fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
        {unit ? <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{unit}</span> : null}
      </span>
    );
    const chev = <span aria-hidden="true" style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 20, lineHeight: 1, color: 'var(--ink-3)' }}>›</span>;
    const textBtn = (label, onClick) => (
      <button type="button" className="press" onClick={onClick} style={{ flexShrink: 0, border: 'none', background: 'none', padding: '10px 4px', minHeight: 44, cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 800, color: themColor }}>{label}</button>
    );
    const title = { fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
    const typeName = (t) => (t ? <span style={{ color: themColor }}>{t.name}</span> : null);
    const subLine = (s) => (s ? <span style={{ display: 'block', marginTop: 3, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 500, color: 'var(--ink-2)', lineHeight: 1.4, textWrap: 'pretty' }}>{s}</span> : null);
    // A wide tile is a button when the whole of it opens something, and a
    // plain box when its right edge carries its own control (Cancel, Start)
    // — a button inside a button is not a thing the platform can honour.
    const wide = (key, { people, figure, head, sub: line, onClick, right, quiet }) => {
      const inner = (
        <React.Fragment>
          {people ? cluster(people, 30) : null}
          <span style={{ flex: 1, minWidth: 0 }}>
            {figure}
            <span style={{ ...title, display: 'block', marginTop: figure ? 4 : 0 }}>{head}</span>
            {subLine(line)}
          </span>
          {right !== undefined ? right : (onClick ? chev : null)}
        </React.Fragment>
      );
      const style = { ...box(quiet), display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '13px 14px', boxSizing: 'border-box' };
      return right !== undefined || !onClick
        ? <div key={key} style={style}>{inner}</div>
        : <button key={key} type="button" className="press" onClick={onClick} style={{ ...style, cursor: 'pointer' }}>{inner}</button>;
    };
    const pair = [{ me: true }, p];
    const duoTile = duo && !invited
      ? (playing
        ? wide('duo', { people: pair, figure: fig(duo.played, duo.played === 1 ? 'round' : 'rounds'), head: <React.Fragment>1v1{pt.duo ? <React.Fragment> · {typeName(pt.duo)}</React.Fragment> : null}</React.Fragment>, sub: why && pt.duo ? pt.duo.line : null, onClick: goDuo })
        : wide('duo', { people: pair, head: '1v1 · new', sub: 'the first round is open', onClick: goDuo }))
      : invited
        ? wide('duo', { people: pair, head: '1v1 · invited', sub: `waiting on ${firstName}`, onClick: null, right: textBtn('Cancel', () => DUELS.cancelDuo(p.id)) })
        : isFriend
          ? wide('duo', { people: pair, head: 'Start a 1v1', sub: 'answer, then guess theirs — revealed when you both have played', onClick: () => DUELS.startDuo(p.id), right: textBtn('Start', () => DUELS.startDuo(p.id)) })
          : wide('duo', { people: pair, head: '1v1', sub: `for friends — add ${firstName} first`, onClick: null, quiet: true });
    const groupTiles = shared.length ? shared.map((g, i) => {
      const mem = g.members.find((m) => m.id === p.id);
      const pend = !!(mem && mem.pending);
      const people = [mem, ...g.members.filter((m) => m.id !== p.id)].filter(Boolean);
      const t = i === 0 ? pt.group : null;
      const body = (
        <React.Fragment>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 28 }}>{cluster(people)}{pend ? null : chev}</span>
          <span style={{ marginTop: 12 }}>{fig(g.members.length + 1, 'people')}</span>
          <span style={{ ...title, display: 'block', marginTop: 5 }}>{g.name}</span>
          {t ? <span style={{ display: 'block', marginTop: 1, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeName(t)}</span> : null}
          {subLine(pend ? `invited · waiting on ${firstName}` : (why && t ? t.line : null))}
        </React.Fragment>
      );
      const style = { ...box(false), display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: '12px 13px 12px', boxSizing: 'border-box' };
      return pend
        ? <div key={g.id} style={style}>{body}</div>
        : <button key={g.id} type="button" className="press" onClick={() => goGroup(g.id)} aria-label={g.name} style={{ ...style, cursor: 'pointer' }}>{body}</button>;
    }) : null;
    const groupsFallback = shared.length ? null : addable.length ? (
      <div style={{ ...box(true), display: 'flex', flexDirection: 'column', gap: 9, padding: '13px 14px' }}>
        <span style={title}>Add {firstName} to a group</span>
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {addable.map((g) => (
            <button key={g.id} type="button" className="press" onClick={() => DUELS.addGroupMembers(g.id, [p.id])} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', border: '0.5px solid var(--rule)', background: 'var(--surface-2)', color: 'var(--ink)', borderRadius: 999, padding: '5px 12px 5px 6px', minHeight: 36, cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700 }}>
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
    // ─── The 1v1 record — the one thing only a duel can tell you: how well
    //     each of you actually reads the other. Two rings for the whole, the
    //     domains as dot runs under them (clustered: hits first, when the run
    //     is short enough to read as a count), the same dot language as the
    //     daily so a filled dot means the same thing everywhere. ───
    let record = null;
    if (playing) {
      const clust = (a) => (a.length <= 14 ? a.slice().sort((x, y) => (y ? 1 : 0) - (x ? 1 : 0)) : a);
      const drows = DUELS.domainRows(duo);
      const weak = drows.length >= 2 ? DUELS.weakDomain(duo) : null;
      const hits = (a) => a.filter(Boolean).length;
      const readAll = Array.from({ length: duo.read.total }, (_, i) => DUELS.duoDay(p.id, duo.read.total - i).readRight);
      const byAll = Array.from({ length: duo.readBy.total }, (_, i) => DUELS.duoDay(p.id, duo.readBy.total - i).byRight);
      const rRate = hits(readAll) / Math.max(1, readAll.length), bRate = hits(byAll) / Math.max(1, byAll.length);
      const gapR = rRate - bRate;
      // a gap under 0.08 reads as equal — a coin's worth of noise on a
      // fortnight, not a difference to name (the 2026-09-07 rule, pinned)
      const readerLine = Math.abs(gapR) < 0.08 ? `You and ${firstName} read each other about equally well.` : gapR > 0 ? `You read ${firstName} better than ${firstName} reads you` : `${firstName} reads you better than you read ${firstName}`;
      const lead = weak && Math.abs(gapR) >= 0.08 && weak.byRate > bRate + 0.05 ? `${readerLine}, except on ${weak.label}.` : (Math.abs(gapR) < 0.08 ? readerLine : readerLine + '.');
      const ring = (n, tot, color, caption) => (
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <MatchRing pct={(n / Math.max(1, tot)) * 100} color={color} size={78} thick={4} title={`${n} of ${tot}`}>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{n}<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>/{tot}</span></span>
          </MatchRing>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', textAlign: 'center' }}>{caption}</span>
        </span>
      );
      const dot = (on, col) => <span style={{ width: 9, height: 9, borderRadius: '50%', boxSizing: 'border-box', background: on ? col : 'transparent', border: on ? 'none' : `1.5px solid color-mix(in oklch, ${col} 55%, transparent)` }}></span>;
      const lg = { display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' };
      record = (
        <div style={{ marginBottom: 30 }}>
          <div style={{ marginBottom: 8 }}><Kicker>How well you read each other</Kicker></div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 17, fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.3, color: 'var(--ink)', textWrap: 'pretty' }}>{lead}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 18 }}>
            {ring(hits(readAll), readAll.length, 'var(--ink)', `you read ${firstName}`)}
            {ring(hits(byAll), byAll.length, themColor, `${firstName} reads you`)}
          </div>
          {drows.length >= 2 ? (
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 13 }}>
              {drows.map((r) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ width: 96, flexShrink: 0, paddingTop: 1, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25, textWrap: 'pretty' }}>{r.label === 'how they see you' ? 'self-image' : r.label}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 2, minWidth: 0 }}>
                    <ReadRun days={clust(r.read)} color="var(--ink)" size={11}></ReadRun>
                    <ReadRun days={clust(r.by)} color={themColor} size={11}></ReadRun>
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ marginTop: 16, paddingTop: 10, borderTop: '0.5px solid var(--rule)', display: 'flex', gap: 16 }}>
            <span style={lg}>{dot(true, 'var(--ink-2)')}called it</span>
            <span style={lg}>{dot(false, 'var(--ink-2)')}missed</span>
          </div>
        </div>
      );
    }
    return (
      <div style={{ paddingTop: 16 }}>
        <div style={{ marginBottom: 30 }}>
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 28 }}>
            <Kicker>Play together</Kicker>
            {hasWhy ? <button type="button" className={'pt-info' + (why ? ' is-on' : '')} onClick={() => setWhy((w) => !w)} aria-pressed={why} aria-label="What the names mean">i</button> : null}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {duoTile}
            {groupTiles ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>{groupTiles}</div> : groupsFallback}
          </div>
        </div>
        {record}
      </div>
    );
  };

  // ─── Map — the person's own map, as a portrait with one way in. The map is
  //     its OWN screen, not a panel in this scroll: a live pannable map
  //     wedged into a scrolling page fights the page for every gesture, so
  //     the tab carries the still (`own`: their answers, not a comparison)
  //     and the map itself opens full-screen. The demo's locked answers —
  //     sample data the map hides from a non-follower — are what the line
  //     beside the kicker and the full map's key describe; nothing live is
  //     drawn here, and the live page keeps D98 (VISION-2026-09-08 §4.5). ───
  const renderMap = () => (
    <div style={{ paddingTop: 16, marginBottom: 26 }}>
      <div style={{ marginBottom: 11, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 1, minWidth: 0 }}><Kicker>{firstName}{'’'}s map</Kicker></span>
        {!isFriend && <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' }}>some of it stays hidden until you are friends</span>}
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
        <div style={{ height: 320, position: 'relative', overflow: 'hidden', pointerEvents: 'none', maskImage: 'linear-gradient(180deg, transparent 0, #000 12%, #000 90%, transparent 100%)', WebkitMaskImage: 'linear-gradient(180deg, transparent 0, #000 12%, #000 90%, transparent 100%)' }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 440, transform: 'translateY(-50%)' }}>
            <PersonMindMap p={p} following={isFriend} centerName={firstName} still own />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderTop: '0.5px solid var(--rule)' }}>
          <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
            Open {firstName}{'’'}s map
          </span>
          {!isFriend && <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>partial</span>}
          <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 700, color: themColor }}>↗</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="overlay surface-tint" {...dlg}>
      <div className="app-header">
        <button className="avatar-btn" onClick={onClose}>←</button>
        <div className="h-title" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: p.anon ? 'capitalize' : 'none' }}>{anonName(p)}</div>
        <div className="h-meta" style={{ flexShrink: 0 }}>{p.dist || (p.anon ? 'nearby' : 'in your orbit')}</div>
      </div>
      {/* overflowX hidden: the panel below slides sideways under a finger
          (useSubSwipe) and must not grow the body a scrollbar doing it */}
      <div ref={bodyRef} className="app-body" style={{ paddingTop: 0, overflowX: 'hidden' }}>

        {/* ─── Hero — avatar wrapped in an affinity ring gauge, and the answers'
            lead sentence under the name (2026-09-08: the page's one summary,
            above the tabs that unfold it) ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginTop: 14 }}>
          <div style={{ position: 'relative', width: 116, height: 116, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 10, borderRadius: '50%', background: `radial-gradient(circle at 50% 30%, color-mix(in oklch, ${themColor} 26%, transparent), transparent 74%)`, filter: 'blur(6px)' }} />
            <svg viewBox="0 0 116 116" width="116" height="116" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
              <circle cx="58" cy="58" r="52" fill="none" stroke={`color-mix(in oklch, ${themColor} 16%, transparent)`} strokeWidth="4" />
              <circle cx="58" cy="58" r="52" fill="none" stroke={themColor} strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(overall / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`} />
            </svg>
            {p.anon ? <AnonAv hue={p.hue} size={86} /> : <Av init={p.init} hue={p.hue} size={86} />}
            <div style={{
              position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
              display: 'inline-flex', alignItems: 'baseline', gap: 4,
              background: themColor, color: 'white',
              padding: '3px 11px', borderRadius: 999, whiteSpace: 'nowrap',
              boxShadow: `0 6px 16px -6px color-mix(in oklch, ${themColor} 55%, transparent)`, border: '2.5px solid var(--surface)',
            }}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 800, letterSpacing: '-0.01em' }}>{overall}</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 700, letterSpacing: '0.09em' }}>AFFINITY</span>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 24, fontWeight: 800, marginTop: 18, letterSpacing: '-0.025em', lineHeight: 1.1, textTransform: p.anon ? 'capitalize' : 'none' }}>{anonName(p)}</div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: '0.09em', marginTop: 7, textTransform: 'uppercase' }}>
            {p.anon
              ? `${p.role || 'nearby'} · ${p.dist || 'nearby'}`
              : <>{p.role || p.rel} · {p.age ? `aged ${p.age} · ` : ''}{p.dist || 'in your orbit'}</>}
          </div>
          {hasRows && <div style={{ marginTop: 9, fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', textWrap: 'pretty' }}>{receiptLead(rows)}</div>}

          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
            {!p.anon && p.id && (confirmRemove ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>Remove from your circle?</span>
                <button className="press" onClick={() => { FRIENDS.unfriend(p.id); setConfirmRemove(false); }} style={{ padding: '7px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, background: 'var(--ochre)', color: '#fff' }}>Remove</button>
                <button className="press" onClick={() => setConfirmRemove(false)} style={{ padding: '7px 14px', borderRadius: 999, border: '0.5px solid var(--rule)', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 700, background: 'var(--surface-2)', color: 'var(--ink)' }}>Keep</button>
              </div>
            ) : (
              <button className="press" onClick={onFriendBtn} style={{
                padding: '8px 22px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 700, letterSpacing: '0.01em',
                background: fStatus === 'none' ? themColor : 'var(--surface-2)',
                color: fStatus === 'none' ? 'white' : 'var(--ink)',
                border: `0.5px solid ${fStatus === 'none' ? themColor : 'var(--rule)'}`,
                boxShadow: fStatus === 'none' ? `0 6px 14px -6px color-mix(in oklch, ${themColor} 50%, transparent)` : 'none',
                transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
              }}>{isFriend ? 'Friends ✓' : fStatus === 'invited' ? 'Invited · waiting' : 'Add friend'}</button>
            ))}
            {fStatus === 'invited' && !confirmRemove && <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>they{'’'}ll see it soon · tap to cancel</span>}
          </div>
        </div>

        {/* ─── The four tabs — sticky, frosted, in the person's own colour;
            the profile overlay's own sub-nav classes, so the thumb slides
            the same way (subnav-thumb.js) ─── */}
        <div className="profile-subnav" style={{ marginTop: 18 }}>
          <div className="subnav" style={{ '--seg-fill': themColor }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => { if (t.id !== sub) HAPTIC.tick(); setSub(t.id); }} className={'subnav-btn' + (t.id === sub ? ' is-on' : '')}>{t.label}</button>
            ))}
          </div>
        </div>

        <div key={sub} ref={panelRef} className="tab-swap" style={{ willChange: 'transform' }}>
          {sub === 'match' && renderMatch()}
          {sub === 'answers' && hasRows && <AnswersPanel rows={rows} themColor={themColor} firstName={firstName} />}
          {sub === 'together' && hasTogether && renderTogether()}
          {sub === 'map' && renderMap()}
        </div>

      </div>

      {/* the live map gets the whole screen — where it can actually be explored */}
      {mapOpen ? (
        <div className="overlay surface-tint" style={{ zIndex: 24 }}>
          <div className="app-header">
            <button className="avatar-btn" onClick={() => setMapOpen(false)}>←</button>
            <div className="h-title" style={{ flex: 1, minWidth: 0 }}>{firstName}{'’'}s map</div>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
            <PersonMindMap p={p} following={isFriend} centerName={firstName} />
          </div>
          {/* the key belongs where the dots are big enough to read — and it
              says what the FULL map encodes: a dot is filled where the answer
              went with the crowd and ringed where it was the rarer take
              (`is-rare`), which is not the still's same / differ (2026-09-08) */}
          <div style={{ flexShrink: 0, display: 'flex', gap: 16, padding: '10px 16px 14px', borderTop: '0.5px solid var(--rule)', fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: 'var(--ink-2)' }}></span>with the crowd</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span style={{ width: 10, height: 10, borderRadius: 99, boxSizing: 'border-box', border: '2.5px solid var(--ink-2)' }}></span>a rarer take</span>
            {!isFriend && <span style={{ marginLeft: 'auto', letterSpacing: 0, textTransform: 'none', fontWeight: 600 }}>friends see everything</span>}
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

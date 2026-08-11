// Ported from design/spec-modules/duels-data.js (the historical prototype — no sync
// script survives; THIS file is the live source of the BEHAVIOR, hand-edits
// and all). The group/1v1 banks themselves moved to
// content/duel-questions.json (2026-08-03, the D32 learn-data shape): one
// source feeds both this module and the seeded Firestore bank via
// scripts/gen-v2content.mjs, so the demo banks and the live docs cannot
// drift. (A static JSON import, not a cross-module import — the spec
// layer's no-imports convention bans load-order coupling between modules,
// which data has none of.)
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import DUEL_CONTENT from '../../../content/duel-questions.json';
import { FRIENDS } from './follows.js';
import { IS_DATA } from './sample-data.js';

// duels-data.js — the "know each other" layer.
//  · GROUP: one question a day for each named circle; answers sealed until
//    tomorrow, then revealed WITH NAMES. Groups can be created, edited, left.
//  · 1v1: answer today's question AND guess what the other person picked;
//    both sides reveal tomorrow. 1v1s start with an invite (friends only).
// Partner behaviour is deterministic mock; your own answers, your custom
// groups and your invites persist to localStorage. The circle = your friends
// (FRIENDS). Read/being-read scores feed the Map's People branch.
(function () {
  const DAYS = ['Today', 'Yesterday', 'Tue', 'Mon', 'Sun', 'Sat', 'Fri'];
  function h01(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 8) % 100000) / 100000;
  }

  // ── persistence — your answers + your social edits ─────────────────────────
  const LS = 'insight.duels.v1';
  // One shape for the cold load AND the purge listener below — a field
  // added here is automatically fresh in both, so they cannot diverge.
  function normalize(v) {
    const s = v && typeof v === 'object' ? v : {};
    s.groups = s.groups || {};   // gid → { dayId → your option index }
    s.duo = s.duo || {};         // pid → { a: your answer idx, g: your guess idx } (today)
    s.duoList = Array.isArray(s.duoList) ? s.duoList : null; // active 1v1 pids (null = seed)
    s.duoInv = s.duoInv || {};   // pid → invite ts (waiting on them)
    s.myGroups = Array.isArray(s.myGroups) ? s.myGroups : []; // custom groups
    s.groupIds = s.groupIds || {};   // seeded-gid → edited member ids
    s.groupPend = s.groupPend || {}; // gid → { pid → invite ts }
    s.left = Array.isArray(s.left) ? s.left : []; // gids you left
    s.duoMode = s.duoMode || {}; // pid → 'friends' | 'romantic' (which pool this 1v1 draws from)
    return s;
  }
  let S;
  try { S = normalize(JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) { S = normalize({}); }
  const listeners = new Set();
  const fire = () => listeners.forEach((f) => { try { f(); } catch (e) { /* one listener throwing must not stop the others being notified. */ } });
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Persistence here is best-effort and the in-memory state stays correct. */ } fire(); };
  // The purge (data/live.ts, D51): drop your duel answers, groups and 1v1
  // edits too, or the next answer's save() writes the previous account's
  // back under the new uid. fire() without save() — do not re-create the
  // purged key.
  window.addEventListener('insight:local-purge', () => { S = normalize({}); fire(); });

  // ── the circle — your friends ───────────────────────────────────────────────
  // Fallback if FRIENDS is absent, and the first-run 1v1 roster (duoList).
  // Eight rather than five so the daily's 1v1 rail, the Map's People branch
  // and impressions() all run at a size where they have to rank; the other
  // seeded friends stay unpaired on purpose — they are what duoAvailable()
  // offers. Every id here must be in follows.js SEED too, since duoIds()
  // filters the list through FRIENDS.isFriend and a non-friend would sit in
  // storage invisible.
  const IDS = ['f1', 'f2', 'f4', 'f6', 'f3', 'f12', 'f17', 'f14'];
  const allPeople = () => IS_DATA.people || [];
  const circleIds = () => (FRIENDS ? FRIENDS.list() : IDS);
  function members() { return circleIds().map((id) => allPeople().find((p) => p.id === id)).filter(Boolean); }
  const personOf = (pid) => allPeople().find((p) => p.id === pid);

  // ── invite acceptance — duos + group members, deterministic short delays ───
  function accDelay(k) { return 9000 + Math.floor(h01('acc' + k) * 18000); }
  function sweep() {
    const now = Date.now(); let hit = false;
    Object.keys(S.duoInv).forEach((pid) => {
      if (now - S.duoInv[pid] >= accDelay('d' + pid)) { delete S.duoInv[pid]; if (!duoList().includes(pid)) duoList().push(pid); hit = true; }
    });
    Object.keys(S.groupPend).forEach((gid) => {
      const m = S.groupPend[gid];
      Object.keys(m).forEach((pid) => { if (now - m[pid] >= accDelay('g' + gid + pid)) { delete m[pid]; hit = true; } });
    });
    if (hit) save();
  }
  const hasPend = () => Object.keys(S.duoInv).length > 0 || Object.keys(S.groupPend).some((g) => Object.keys(S.groupPend[g]).length > 0);
  let timer = null;
  function ensureTimer() {
    if (timer) return;
    timer = setInterval(() => { if (!hasPend()) { clearInterval(timer); timer = null; return; } sweep(); }, 2500);
  }
  if (hasPend()) ensureTimer();

  // ── GROUP: one question a day (idx 0 = today) ──────────────────────────────
  // Three kinds: classic (options), 'pick' (options = the members — a verdict
  // about one of you) and 'us' (options describe the group — feeds its portrait).
  // Mostly 'us' (feeds the portrait) + verdict 'pick's. Role-cast scenarios
  // (heist/island/sitcom/zombie) live ONLY in SCENARIOS — no duplicates here.
  // The bank lives in content/duel-questions.json — the same file
  // gen-v2content.mjs seeds the live Firestore bank from, so demo and live
  // can never drift (single source, the D32 shape). Array order is the
  // rotation order and is deliberately interleaved: append, never sort.
  const GROUP_QS = DUEL_CONTENT.group;
  // seeded groups — each runs the shared pool at its own offset
  //
  // Four sizes on purpose (7 · 4 · 2 · 5): a group's portrait, its
  // togetherness and its role casts all read differently at two members than
  // at seven, and 'pick' questions build their options from the members
  // (activeMembers + 'You'), so the largest group is also the widest option
  // list the daily has to lay out. gBase() offsets each group by its index ×
  // 3 into the 24-question pool, so a fourth group starts at 9 and still has
  // its own week.
  const GROUPS = [
    { id: 'g1', name: 'The Crew', ids: ['f1', 'f2', 'f4', 'f6', 'f3', 'f12', 'f14'] },
    { id: 'g2', name: 'Book Club', ids: ['f2', 'f3', 'f6', 'f22'] },
    { id: 'g3', name: 'The Cousins', ids: ['f1', 'f4'] },
    { id: 'g4', name: 'The Long Table', ids: ['f2', 'f6', 'f8', 'f10', 'f9'] },
  ];
  // seeded (minus left, with member edits) + your custom groups
  function groupDefs() {
    const seeded = GROUPS.filter((g) => !S.left.includes(g.id)).map((g) => ({ ...g, ids: S.groupIds[g.id] || g.ids }));
    const custom = S.myGroups.filter((g) => !S.left.includes(g.id)).map((g) => ({ ...g, custom: true }));
    return seeded.concat(custom);
  }
  const groupDef = (gid) => groupDefs().find((g) => g.id === gid);
  function setIds(gid, ids) {
    const c = S.myGroups.find((g) => g.id === gid);
    if (c) c.ids = ids; else S.groupIds[gid] = ids;
  }
  const gBase = (gid) => {
    const si = GROUPS.findIndex((g) => g.id === gid);
    return si >= 0 ? si * 3 : Math.floor(h01('gb' + gid) * GROUP_QS.length);
  };
  function groupMembers(gid) {
    const G = groupDef(gid); if (!G) return [];
    const pend = S.groupPend[gid] || {};
    return G.ids.map((id) => { const p = personOf(id); return p ? (pend[id] != null ? { ...p, pending: true } : p) : null; }).filter(Boolean);
  }
  const activeMembers = (gid) => groupMembers(gid).filter((p) => !p.pending);
  function groupQ(gid, dayIdx) {
    let q = GROUP_QS[(gBase(gid) + dayIdx) % GROUP_QS.length];
    if (q.kind === 'pick') {
      const act = activeMembers(gid);
      if (act.length < 2) {
        // not enough named faces yet — slide to the next non-pick question
        const idx = (gBase(gid) + dayIdx) % GROUP_QS.length;
        for (let i = 1; i < GROUP_QS.length; i++) { const cand = GROUP_QS[(idx + i) % GROUP_QS.length]; if (cand.kind !== 'pick') { q = cand; break; } }
        return q;
      }
      return { ...q, options: act.map((p) => p.name.split(' ')[0]).concat('You') };
    }
    return q;
  }
  // custom groups start today — no fake history
  const histDays = (gid) => { const G = groupDef(gid); return G && G.custom ? 0 : 6; };
  function groupDays(gid) { return Array.from({ length: histDays(gid) + 1 }, (_, i) => ({ ...groupQ(gid, i), idx: i, label: DAYS[i] || 'Earlier' })); }

  // a member's answer for a day — biased toward a per-day majority option
  function memberAnswer(gid, dayIdx, pid) {
    const q = groupQ(gid, dayIdx);
    const n = q.options.length;
    const maj = Math.floor(h01('gm' + gid + q.id) * n);
    if (h01('gp' + gid + q.id + pid) < 0.52) return maj;
    return Math.floor(h01('ga' + gid + q.id + pid) * n);
  }
  // your own past answers are seeded (the demo has history from day one)
  function myGroup(gid, dayIdx) {
    const q = groupQ(gid, dayIdx);
    if (dayIdx === 0) { const m = S.groups[gid] || {}; return m[q.id] != null ? m[q.id] : null; }
    return Math.floor(h01('gs' + gid + q.id) * q.options.length);
  }
  function answerGroup(gid, i) { S.groups[gid] = { ...(S.groups[gid] || {}), [groupQ(gid, 0).id]: i }; save(); }
  function groupDone(gid) {
    if (gid) return myGroup(gid, 0) != null;
    return groupDefs().every((g) => myGroup(g.id, 0) != null);
  }
  function groupsPending() { return groupDefs().filter((g) => !groupDone(g.id)).length; }
  // who has already answered TODAY (deterministic demo state)
  function groupInToday(gid) {
    const q = groupQ(gid, 0);
    const act = activeMembers(gid);
    const done = act.filter((p) => h01('gi' + gid + q.id + p.id) < 0.6).map((p) => p.id);
    return { done, total: act.length + 1 };
  }
  // revealed picks for a past day: option → people (you included as pid 'me')
  function groupPicks(gid, dayIdx) {
    const q = groupQ(gid, dayIdx);
    const rows = q.options.map((label, oi) => ({ label, oi, who: [] }));
    activeMembers(gid).forEach((p) => rows[memberAnswer(gid, dayIdx, p.id)].who.push(p));
    const mine = myGroup(gid, dayIdx);
    const counts = rows.map((r) => r.who.length + (mine === r.oi ? 1 : 0));
    const majority = counts.indexOf(Math.max(...counts));
    return { q, rows, mine, counts, majority };
  }
  // how often you land with your groups' majority (revealed days only)
  function groupAlignment() {
    let withMaj = 0, total = 0;
    groupDefs().forEach((G) => {
      for (let i = 1; i <= histDays(G.id); i++) {
        const g = groupPicks(G.id, i);
        total++; if (g.mine === g.majority) withMaj++;
      }
    });
    return { withMaj, total };
  }
  // the group's accrued portrait — traits ('us' majorities), togetherness,
  // who breaks ranks, who mirrors you, and the pick-question verdicts
  function groupPortrait(gid) {
    const ms = groupMembers(gid);
    const withMaj = {}, withMe = {};
    ms.forEach((p) => { withMaj[p.id] = 0; withMe[p.id] = 0; });
    let togeth = 0, days = 0, meWithMaj = 0;
    const traits = [], verdicts = [];
    for (let i = 1; i <= histDays(gid); i++) {
      const g = groupPicks(gid, i);
      const total = g.counts.reduce((a, b) => a + b, 0) || 1;
      days++; togeth += Math.max(...g.counts) / total;
      if (g.mine === g.majority) meWithMaj++;
      ms.forEach((p) => {
        const a = memberAnswer(gid, i, p.id);
        if (a === g.majority) withMaj[p.id]++;
        if (g.mine != null && a === g.mine) withMe[p.id]++;
      });
      if (g.q.kind === 'us') traits.push(g.q.options[g.majority]);
      if (g.q.kind === 'pick') {
        const label = g.q.options[g.majority];
        verdicts.push({ prompt: g.q.prompt, label, who: label === 'You' ? null : ms.find((p) => p.name.split(' ')[0] === label) || null });
      }
    }
    const contrarian = ms.slice().sort((a, b) => withMaj[a.id] - withMaj[b.id])[0] || null;
    const twin = ms.slice().sort((a, b) => withMe[b.id] - withMe[a.id])[0] || null;
    return { days, togetherness: Math.round((togeth / Math.max(days, 1)) * 100), meWithMaj, traits: [...new Set(traits)], verdicts, contrarian, twin, withMaj, withMe };
  }

  // everything the UI needs, per group
  function groups() {
    return groupDefs().map((g) => ({ id: g.id, name: g.name, custom: !!g.custom, members: groupMembers(g.id), done: groupDone(g.id) }));
  }

  // ── group management ────────────────────────────────────────────────────────
  function createGroup(name, ids) {
    const gid = 'c' + Date.now().toString(36);
    S.myGroups.push({ id: gid, name: (name || 'New group').trim(), ids: ids.slice() });
    S.groupPend[gid] = {};
    const now = Date.now();
    ids.forEach((pid) => { S.groupPend[gid][pid] = now; });
    ensureTimer(); save();
    return gid;
  }
  function addGroupMembers(gid, ids) {
    const G = groupDef(gid); if (!G || !ids.length) return;
    setIds(gid, G.ids.concat(ids.filter((id) => !G.ids.includes(id))));
    S.groupPend[gid] = S.groupPend[gid] || {};
    const now = Date.now();
    ids.forEach((pid) => { S.groupPend[gid][pid] = now; });
    ensureTimer(); save();
  }
  function removeGroupMember(gid, pid) {
    const G = groupDef(gid); if (!G) return;
    setIds(gid, G.ids.filter((id) => id !== pid));
    if (S.groupPend[gid]) delete S.groupPend[gid][pid];
    save();
  }
  function leaveGroup(gid) {
    if (!S.left.includes(gid)) S.left.push(gid);
    S.myGroups = S.myGroups.filter((g) => g.id !== gid);
    delete S.groups[gid]; delete S.groupPend[gid]; delete S.groupIds[gid];
    save();
  }

  // ── 1v1: answer + guess, next-day reveal ───────────────────────────────────
  // Situational reads with observable tells — guessable if you truly know
  // them. Mixed option counts (2–4): more options = a right guess means more.
  // Ordered light → deep: early days stay easy, long streaks earn the
  // revealing ones (duoQ walks the pool by streak depth, not at random).
  // Bank in content/duel-questions.json, single source as GROUP_QS above.
  // JSON entries carry an `id` the live seed keys on; unused here — demo
  // duo state keys on the partner, not the question. The light → deep
  // ordering contract travels with the JSON: append deep.
  const DUO_QS = DUEL_CONTENT.oneVsOne;
  // The same game, aimed at a person you share a life with rather than a friend:
  // the tells are domestic, and the deep end is about what happens next. Same
  // shape as DUO_QS — light → deep, 2–4 options — so the ladder is identical.
  // Graduated to content/duel-questions.json (D40 part 4, adopted
  // 2026-08-06): same single source as the two banks above, and the seed
  // now carries the pool to production, where a duo doc's `duoMode` selects
  // it (deck.ts duelQFor). The seeded entries ship `active: false` until
  // the mode-aware client is the fleet — an older duelQFor has no pool
  // filter, so an active romantic doc would rotate into FRIEND duels.
  const DUO_QS_ROMANTIC = DUEL_CONTENT.romantic;
  // Three rows, never more: DOMAIN_MIN is 4 correct reads EACH way, so a fourth
  // lens pushes a full chart from ~12 days out to ~16 — and three rows read at a
  // glance where five become a table.
  //
  // The third row is mode-specific, because the weak lens differs by relationship.
  // Friends rarely see each other under real pressure and almost never test each
  // other's five-year plan; the live gap between friends is the MIRROR — do you
  // know how they see you. For a partner the future IS the loaded one (money,
  // kids, moving), so romantic keeps 'ahead'.
  const DOMAIN_DEFS = {
    day:    { id: 'day',    label: 'everyday',         noun: 'everyday self' },
    heat:   { id: 'heat',   label: 'under pressure',   noun: 'pressure' },
    ahead:  { id: 'ahead',  label: "what's ahead",     noun: 'future' },
    mirror: { id: 'mirror', label: 'how they see you', noun: 'self-image' },
  };
  const DOMAIN_SET = { friends: ['day', 'heat', 'mirror'], romantic: ['day', 'heat', 'ahead'] };
  const domainsFor = (mode) => DOMAIN_SET[mode === 'romantic' ? 'romantic' : 'friends'].map((k) => DOMAIN_DEFS[k]);
  const DOMAINS = domainsFor('friends');
  const DOMAIN_MIN = 4; // fewer plays than this and the row is absent, not thin
  // qualifying rows only — a row of one dot is noise dressed as insight
  function domainRows(duo) {
    if (!duo || !duo.domains) return [];
    return domainsFor(duo.mode).map((D) => {
      const d = duo.domains[D.id]; if (!d) return null;
      if (d.read.length < DOMAIN_MIN || d.by.length < DOMAIN_MIN) return null;
      return { ...D, read: d.read, by: d.by, byMissed: d.by.filter((x) => !x).length, byRate: d.by.filter((x) => !x).length / d.by.length };
    }).filter(Boolean);
  }
  // the one place they read you worst — only if it CLEARLY stands out. Compared
  // as a RATE: rows hold different numbers of plays, and a raw miss count just
  // crowns whichever lens has been played most.
  function weakDomain(duo) {
    const rows = domainRows(duo); if (rows.length < 2) return null;
    const s = rows.slice().sort((a, b) => b.byRate - a.byRate);
    return s[0].byRate - s[1].byRate >= 0.2 ? s[0] : null;
  }
  const DUO_POOL = (pid) => (duoMode(pid) === 'romantic' ? DUO_QS_ROMANTIC : DUO_QS);
  function duoMode(pid) { return S.duoMode[pid] === 'romantic' ? 'romantic' : 'friends'; }
  function setDuoMode(pid, mode) { S.duoMode[pid] = mode === 'romantic' ? 'romantic' : 'friends'; save(); }
  // days already played (and revealed) with each partner; 0 = never played.
  // A partner absent from these three tables is not broken — they read as a
  // never-played pair (state 'start', no history), which is what a freshly
  // accepted 1v1 is. The seeded eight carry a spread instead, because the
  // things that only appear at depth need it: domainRows() hides a lens
  // under DOMAIN_MIN (4 each way), ReadRun switches encoding on the span, and
  // weakDomain() compares RATES, so a long record and a short one have to
  // coexist for that comparison to mean anything.
  const PLAYED = { f1: 24, f2: 5, f4: 3, f6: 2, f3: 0, f12: 16, f17: 11, f14: 6 };
  // how well YOU tend to read them / how well THEY tend to read you
  const READ_SKILL = { f1: 0.85, f2: 0.72, f4: 0.5, f6: 0.34, f3: 0.5, f12: 0.66, f17: 0.45, f14: 0.8 };
  const BY_SKILL = { f1: 0.9, f2: 0.75, f4: 0.4, f6: 0.62, f3: 0.5, f12: 0.72, f17: 0.58, f14: 0.42 };
  // …and it is UNEVEN across domains — the whole point of the split. Without
  // this, per-domain differences are just noise and the record says nothing.
  const DOMAIN_BIAS = {
    f1: { read: { day: 1.1, heat: 1.0, mirror: 0.6, ahead: 0.55 }, by: { day: 1.1, heat: 0.5, mirror: 0.95, ahead: 0.95 } },
    // The second long record, biased the other way round: f1's blind spot is
    // pressure, f12's is the everyday. With only one authored partner every
    // weakDomain() readout on the Map came from the same person, so a bug
    // that hardcoded f1's shape would have looked correct.
    f12: { read: { day: 0.7, heat: 1.15, mirror: 1.0, ahead: 0.9 }, by: { day: 0.25, heat: 1.1, mirror: 1.05, ahead: 0.9 } },
  };
  function bias(pid, side, dom) {
    const b = DOMAIN_BIAS[pid];
    if (b && b[side] && b[side][dom] != null) return b[side][dom];
    return 0.75 + h01('db' + pid + side + dom) * 0.5; // deterministic spread
  }
  const skillFor = (base, pid, side, dom) => Math.max(0.05, Math.min(0.97, (base || 0.5) * bias(pid, side, dom)));
  // partner already played today? (deterministic demo state)
  const PARTNER_TODAY = { f1: true, f2: false, f4: true, f6: false, f3: false, f12: true, f17: false, f14: true };

  // active 1v1 pids — seeded to the circle on first run, friends only
  function duoList() { if (!S.duoList) S.duoList = IDS.slice(); return S.duoList; }
  const duoIds = () => duoList().filter((pid) => FRIENDS.isFriend(pid));
  function duoAvailable() { return members().filter((p) => !duoList().includes(p.id) && S.duoInv[p.id] == null); }
  function startDuo(pid) { if (duoList().includes(pid) || S.duoInv[pid] != null) return; S.duoInv[pid] = Date.now(); ensureTimer(); save(); }
  function cancelDuo(pid) { delete S.duoInv[pid]; save(); }
  function endDuo(pid) { S.duoList = duoList().filter((x) => x !== pid); delete S.duoInv[pid]; delete S.duo[pid]; save(); }

  // depth ladder: the further into a streak (low dayIdx = recent), the deeper
  // the question — new pairs start at the light end of the pool.
  function duoQ(pid, dayIdx) {
    const played = PLAYED[pid] || 0;
    const depth = Math.max(played - dayIdx, 0); // 0 = first day together
    const jit = Math.floor(h01('dqb' + pid + ':' + dayIdx) * 2);
    const pool = DUO_POOL(pid);
    const step = depth * 2 + jit;
    // past the deep end, wrap instead of clamping — a long streak kept
    // re-serving the last question forever, so late days carried no domain
    return pool[step < pool.length ? step : pool.length - 1 - (step % pool.length)];
  }
  // one duel day; dayIdx 0 = today (yours from localStorage), 1+ = seeded history
  function duoDay(pid, dayIdx) {
    const q = duoQ(pid, dayIdx);
    const key = pid + ':' + dayIdx;
    const n = q.options.length;
    const wrong = (right, k) => (right + 1 + Math.floor(h01(k) * (n - 1))) % n; // any option but the right one
    const theirAns = Math.floor(h01('ta' + key) * n);
    const myAns = dayIdx === 0 ? ((S.duo[pid] || {}).a != null ? S.duo[pid].a : null)
      : Math.floor(h01('da' + key) * n);
    const myGuess = dayIdx === 0 ? ((S.duo[pid] || {}).g != null ? S.duo[pid].g : null)
      : (h01('dg' + key) < skillFor(READ_SKILL[pid], pid, 'read', q.d) ? theirAns : wrong(theirAns, 'dgw' + key));
    const theirGuess = dayIdx === 0 ? null
      : (h01('tg' + key) < skillFor(BY_SKILL[pid], pid, 'by', q.d) ? myAns : wrong(myAns, 'tgw' + key));
    const revealed = dayIdx >= 1 && dayIdx <= (PLAYED[pid] || 0);
    return {
      q, myAns, myGuess, theirAns, theirGuess, revealed,
      readRight: revealed && myGuess === theirAns,
      byRight: revealed && theirGuess === myAns,
    };
  }
  function myDuo(pid) { return S.duo[pid] || {}; }
  function answerDuo(pid, patch) { S.duo[pid] = { ...(S.duo[pid] || {}), ...patch }; save(); }
  function partnerToday(pid) { return !!PARTNER_TODAY[pid]; }

  function duoState(pid) {
    const m = myDuo(pid);
    const mine = m.a != null && m.g != null;
    if (!mine) return (PLAYED[pid] || 0) === 0 ? 'start' : 'turn';
    return partnerToday(pid) ? 'sealed' : 'waiting';
  }
  // everything the UI and the map need, per partner (invites last)
  function partners() {
    const live = duoIds().map((pid) => personOf(pid)).filter(Boolean).map((p) => {
      const played = PLAYED[p.id] || 0;
      const read = { right: 0, total: played };
      const readBy = { right: 0, total: played };
      const misses = []; // where THEY misread YOU — your impression gap
      // the same tally split by what the question was ABOUT: which parts of
      // each other you actually read. Gated in the UI until deep enough.
      const domains = {}; domainsFor(duoMode(p.id)).forEach((k) => { domains[k.id] = { read: [], by: [] }; });
      for (let d = 1; d <= played; d++) {
        const day = duoDay(p.id, d);
        if (day.readRight) read.right++;
        // `misses` keeps its own `else` — v17 inserted the domain tally
        // between these two statements and orphaned it onto `if (dm)`, so
        // impressions filled with every day whose question had no domain
        // instead of every day they misread you. Braces, so the next
        // insertion here cannot repeat it.
        if (day.byRight) {
          readBy.right++;
        } else {
          misses.push({ pid: p.id, name: p.name, dayIdx: d, q: day.q.prompt, guessed: day.q.options[day.theirGuess], actual: day.q.options[day.myAns] });
        }
        const dm = domains[day.q.d];
        if (dm) { dm.read.push(!!day.readRight); dm.by.push(!!day.byRight); }
      }
      const state = duoState(p.id);
      const streak = played + (state === 'sealed' ? 1 : 0);
      return { ...p, played, read, readBy, domains, misses, state, streak, mode: duoMode(p.id) };
    });
    const invited = Object.keys(S.duoInv).map((pid) => personOf(pid)).filter(Boolean)
      .map((p) => ({ ...p, played: 0, read: { right: 0, total: 0 }, readBy: { right: 0, total: 0 }, domains: null, misses: [], state: 'invited', streak: 0, mode: duoMode(p.id) }));
    return live.concat(invited);
  }
  function pendingDuos() { return partners().filter((p) => p.state === 'turn' || p.state === 'start').length; }
  // where your people misread you, freshest first — the "how they see you" gap
  function impressions() {
    return partners().flatMap((p) => p.misses).sort((a, b) => a.dayIdx - b.dayIdx);
  }

  function resetToday() {
    groupDefs().forEach((g) => { if (S.groups[g.id]) delete S.groups[g.id][groupQ(g.id, 0).id]; });
    S.duo = {};
    save();
  }

  // ── role casts — scenario packs the group votes through, one role a day ───
  // Each role's reveal crowns someone with it ("the getaway driver"). One vote
  // per member, no self-votes, biased toward a per-(group,role) favourite so
  // most roles have a clear winner — with the occasional contested crown.
  const SCENARIOS = [
    { id: 'heist', label: 'Bank Heist', hue: 25, roles: [
      { id: 'mastermind', label: 'the mastermind', prompt: 'Who plans the whole thing?' },
      { id: 'driver', label: 'the getaway driver', prompt: 'Who drives the getaway car?' },
      { id: 'inside', label: 'the inside man', prompt: 'Who charms their way inside?' },
      { id: 'crack', label: 'first to crack', prompt: 'Who confesses after one question?' },
    ] },
    { id: 'island', label: 'Desert Island', hue: 150, roles: [
      { id: 'fire', label: 'the fire-keeper', prompt: 'Who keeps the fire going?' },
      { id: 'food', label: 'the food-finder', prompt: 'Who finds something to eat?' },
      { id: 'morale', label: 'the morale officer', prompt: 'Who keeps spirits up?' },
      { id: 'loseit', label: 'first to lose it', prompt: 'Who talks to a coconut by day three?' },
    ] },
    { id: 'sitcom', label: 'The Sitcom', hue: 285, roles: [
      { id: 'main', label: 'the main character', prompt: 'Who is the main character?' },
      { id: 'comic', label: 'the comic relief', prompt: 'Who gets the laugh track?' },
      { id: 'deadpan', label: 'the deadpan one', prompt: 'Who delivers the dry one-liners?' },
      { id: 'twist', label: 'the plot twist', prompt: 'Whose life is the plot twist?' },
    ] },
    { id: 'zombie', label: 'Zombie Plan', hue: 220, roles: [
      { id: 'leader', label: 'the reluctant leader', prompt: 'Who ends up in charge?' },
      { id: 'hoarder', label: 'the supply hoarder', prompt: 'Who already has a stockpile?' },
      { id: 'scout', label: 'the scout', prompt: 'Who goes out for the supply run?' },
      { id: 'bitten', label: 'first one bitten', prompt: 'Who pets the zombie dog?' },
    ] },
  ];
  function roleVotes(gid) {
    const targets = activeMembers(gid).map((p) => p.id).concat('me');
    const gi = Math.max(groupDefs().findIndex((g) => g.id === gid), 0);
    const all = [];
    SCENARIOS.forEach((sc) => sc.roles.forEach((r) => all.push({ ...r, scen: sc, key: sc.id + ':' + r.id })));
    // how deep this group has played through the packs
    const played = all.slice(0, Math.max(6, all.length - gi * 5));
    const roles = played.map((role) => {
      const v = {}; targets.forEach((id) => { v[id] = 0; });
      const fav = targets[Math.floor(h01('rf' + gid + role.key) * targets.length)];
      targets.forEach((voter) => {
        let pick = (voter !== fav && h01('rv' + gid + role.key + voter) < 0.62) ? fav : null;
        if (pick == null) {
          const others = targets.filter((id) => id !== voter);
          pick = others[Math.floor(h01('rw' + gid + role.key + voter) * others.length)];
        }
        v[pick]++;
      });
      const order = targets.slice().sort((a, b) => v[b] - v[a]);
      const winner = order[0], second = order[1] || null;
      const contested = second != null && v[second] >= 2 && v[winner] - v[second] <= 1;
      return { ...role, votes: v, order, winner, second, contested };
    });
    return { scenarios: SCENARIOS, roles, targets };
  }

  window.DUELS = {
    DAYS, members, personOf,
    groups, groupQ, groupDays, groupMembers, groupPicks, myGroup, answerGroup, groupDone, groupsPending, groupInToday, groupAlignment, groupPortrait,
    createGroup, addGroupMembers, removeGroupMember, leaveGroup,
    SCENARIOS, roleVotes,
    duoQ, duoDay, myDuo, answerDuo, partnerToday, duoState, partners, pendingDuos, impressions,
    duoMode, setDuoMode, DOMAINS, domainsFor, domainRows, weakDomain,
    duoAvailable, startDuo, cancelDuo, endDuo,
    resetToday,
    subscribe: (f) => { listeners.add(f); return () => listeners.delete(f); },
  };
  // circle changes (befriend / unfriend) ripple into duos & groups
  FRIENDS.subscribe(fire);
})();


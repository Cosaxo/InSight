// Ported from design/spec-modules/daily-split.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { VOTECUTS } from './vote-cuts.js';
import { navCoasting } from './swipe-back.js';
import { WPAL } from './world-palette.js';
import { DAILYQ } from './daily-questions.js';
import { Sheet } from './primitives.jsx';
// The boot-failure label reads LIVE through the module, not through
// window: D39's ratchet only moves down, so new coupling has to arrive as
// an import. result-card.jsx, map-anchors.js and map-group-stats.js
// already read it this way. The ~50 `window.LIVE` references elsewhere in
// this file stay for now — converting them is a separate change, and each
// one needs its `window.LIVE &&` guard re-read rather than deleted
// wholesale, because an imported binding cannot be unset but the DATA it
// carries can still be missing.
import LIVE from '../data/live';
import { AGG_FLOOR, AGG_COUNT_IS_EXACT } from '../data/floor';
import ReactDOM from 'react-dom';
import { IS_TESTS, IS_TEST_AVG, IS_TEST_RESULTS, persistTestResult } from './test-definitions.js';
import { PASSIVE } from './passive-progress.js';

// daily-split.jsx — SPLIT: the daily tab. Three modes — World (vote blind,
// see how the crowd & every kind of person split), Group (one question a day
// for your circle; yesterday revealed with names — see group-daily.jsx) and
// 1v1 (answer + guess what they answered; next-day reveal — see duo-daily.jsx).
// Keeps the chunky card language but speaks the app's tokens (Hanken Grotesk,
// surface/ink, oklch accents) so it sits with the other tabs and follows dark mode.

// World topic categories — the subreddit-style subscriptions. Definitions
// (labels + hues) live in world-feed-data.js; the chip row in the feed is the
// subscription UI, and the same set filters the daily deck.
const WORLD_TOPICS_V2 = window.WORLD_TOPICS || [
  { id: 'culture', label: 'Culture' },
  { id: 'dilemma', label: 'Dilemmas' },
  { id: 'event', label: 'World events' },
  { id: 'people', label: 'Famous people' },
  { id: 'bigq', label: 'Big questions' },
];

// ── close the loop: a vote lands on your Map ──
// Questions with a true counterpart in the map's store (DAILYQ) place a real
// dot when you vote; the rest name the branch the answer belongs to.
const DAILYSPLIT_DQ_SYNC = { s1: { prompt: 'Pineapple on pizza?', map: { yes: 0, no: 1 } } };

// ── the revealed split's stage height ──
// Two- to four-option days keep the designed fixed 244px chart. Each tile
// refuses to shrink under its 46px minHeight (label + the winner's numeral),
// plus the column's 7px gaps, so from five options up the content minimum
// (53n − 7) outgrows a fixed 244 and the tiles spilled straight over the
// meta line, the feed and its chip bar — found on a device the first time a
// ten-option daily shipped. The extra 130 is flex headroom so shares can
// still read as heights instead of every tile pinning at its minimum.
// Exported for the unit test that holds this arithmetic to the 46/7 the
// tile styles actually use (test/split-stage.test.js).
export function sdSplitStageH(n) { return n <= 4 ? 244 : n * 53 + 123; }

class DailySplit extends React.Component {
  state = {
    mode: this.props.mode || 'world', feedOpen: false, condensed: false, earlierOpen: false, modeSlot: null, reportFor: null,
    idx: 0, idxG: 0,
    votes: (window.LIVE && window.LIVE.enabled ? window.LIVE.myVotes() : {}), tab: null, filter: 'all', dim: 'friends', dimAxis: null, ups: {}, mine: {}, draft: '', dreplies: this.loadDailyReplies(), replyTo: null,
    mapToast: null, pressing: false,
    group: {},
    cats: this.loadWorldCats(),
    testProg: this.loadTestProg(), testJustDone: null, testOpen: false, testRetake: null,
  };

  // ── tests, fed into the daily as their own category ──
  // Questions come from the same pool as the profile's tests (window.IS_TESTS)
  // and progress/results share the same storage, so both stay in sync.
  get testDefs() { return IS_TESTS; }
  loadTestProg() {
    try { const v = JSON.parse(localStorage.getItem('insight.testProgress.v1') || '{}'); return v && typeof v === 'object' ? v : {}; }
    catch (e) { return {}; }
  }
  saveTestProg(p) { try { localStorage.setItem('insight.testProgress.v1', JSON.stringify(p)); } catch { /* best-effort */ } PASSIVE.poke(); }
  testStats() {
    const defs = this.testDefs, prog = this.state.testProg, P = PASSIVE;
    let total = 0, done = 0;
    Object.entries(defs).forEach(([k, T]) => {
      total += T.questions.length;
      done += P.done(k); // passive feed coverage + explicit answers
    });
    const pct = total ? Math.round(done / total * 100) : 0;
    // active test: an explicit retake first, then anything in progress
    // (even over a saved result — a retake survives leaving the tab), then first not taken
    let active = this.state.testRetake && defs[this.state.testRetake] ? this.state.testRetake : null;
    if (!active) active = Object.keys(defs).find(k => prog[k] && Array.isArray(prog[k].answers) && prog[k].answers.length);
    if (!active) active = Object.keys(defs).find(k => !PASSIVE.complete(k));
    return { pct, total, done, active };
  }
  scoreTestDaily(kind, T, ans) {
    const totals = {}, counts = {};
    T.questions.forEach((q, i) => {
      const v = ans[i] ?? 2;
      const norm = q.invert ? 4 - v : v;
      totals[q.d] = (totals[q.d] || 0) + norm;
      counts[q.d] = (counts[q.d] || 0) + 1;
    });
    const pop = IS_TEST_AVG[kind] || {};
    return T.dims.map(d => ({ ...d, value: Math.round(((counts[d.id] ? totals[d.id] / counts[d.id] : 2) / 4) * 100), avg: pop[d.id] ?? 50 }));
  }
  answerTest(kind, i) {
    const T = this.testDefs[kind];
    this.setState(s => {
      const prog = { ...s.testProg };
      let cur = prog[kind] && Array.isArray(prog[kind].answers)
        ? { step: prog[kind].step || 0, answers: prog[kind].answers.slice() }
        : null;
      if (!cur) {
        // fresh start: resume past what the feed already mapped (not on a retake)
        const pre = (s.testRetake !== kind && !PASSIVE.complete(kind)) ? PASSIVE.prefill(kind) : [];
        cur = { step: pre.length, answers: pre.slice() };
      }
      cur.answers[cur.step] = i; cur.step += 1;
      if (cur.step >= T.questions.length) {
        const dims = this.scoreTestDaily(kind, T, cur.answers);
        const result = { title: T.title, taken: 'just now', accent: T.accent, dims };
        // The `else` branch here rebound window.IS_TEST_RESULTS when
        // test-definitions.js had not loaded yet. That made daily-split a
        // SECOND writer of the name, which is the whole reason the coupling
        // meter drew a daily-split → passive-progress → daily-split cycle
        // (src/v2/README.md's "what NOT to start with"). An imported binding
        // cannot be unset, so the fallback is unreachable and the cycle with
        // it.
        persistTestResult(kind, result);
        PASSIVE.markComplete(kind);
        delete prog[kind];
        this.saveTestProg(prog);
        return { testProg: prog, testJustDone: kind, testRetake: null };
      }
      prog[kind] = cur;
      this.saveTestProg(prog);
      return { testProg: prog, testJustDone: null };
    });
  }

  // vote lands on the map — a brief confirmation that fades on its own
  showMapToast(id) {
    clearTimeout(this._toastT);
    this.setState({ mapToast: id });
    this._toastT = setTimeout(() => { if (this.state.mapToast === id) this.setState({ mapToast: null }); }, 3000);
  }
  componentDidMount() {
    if (window.DUELS) this._unsubDuels = window.DUELS.subscribe(() => this.forceUpdate());
    // The purge (data/live.ts, D51): this component persists dreplies,
    // cats and testProg by spreading state back to the keys the purge just
    // removed, and it stays mounted across a uid change — drop them, or
    // one interaction writes the previous account's maps back. votes
    // clears too; the live-update sync refills it for the new uid.
    this._onPurge = () => this.setState({ dreplies: {}, cats: {}, testProg: {}, votes: {} });
    window.addEventListener('insight:local-purge', this._onPurge);
    // The mode switcher belongs in the app header, which is rendered by a
    // component above this one — so it is portaled into a slot app-shell
    // leaves for it. Resolved here rather than at render: the slot only
    // exists once the header has mounted, and looking it up during render
    // would read the DOM mid-commit.
    if (typeof document !== 'undefined') {
      const el = document.getElementById('daily-mode-slot');
      if (el) this.setState({ modeSlot: el });
    }
    // the window event fires on every store notify AND on push-tap
    // dispatch — either way, try to consume a pending reveal target
    this._pendingHandler = () => this.consumePendingReveal();
    window.addEventListener('insight-live-update', this._pendingHandler);
    this.consumePendingReveal();
    // Reconcile (not just repaint) on live-store changes: rolled-back
    // votes must un-vote the UI, and a late live boot (timeout path)
    // must hydrate answers recorded in earlier sessions.
    if (window.LIVE) this._unsubLive = window.LIVE.subscribe(() => {
      const L = window.LIVE;
      if (!L.enabled || !L.ready) { this.forceUpdate(); return; }
      const lv = L.myVotes();
      this.setState((s) => {
        const votes = { ...s.votes };
        L.deck().forEach((q) => {
          if (lv[q.id] != null) votes[q.id] = lv[q.id];
          else delete votes[q.id];
        });
        return { votes };
      });
      this.consumePendingReveal();
    });
    this.syncAppAccent();
    this.watchRuler();
  }

  // A tapped reveal notification (src/v2/data/push.ts) stores the gid;
  // once live groups are known, land on that duel's mode.
  consumePendingReveal() {
    let gid = null;
    try { gid = sessionStorage.getItem('insight.pendingReveal'); } catch { /* best-effort */ }
    if (!gid || !window.LIVE || !window.LIVE.enabled || !window.LIVE.ready) return;
    const g = window.LIVE.social.groups().find((x) => x.id === gid);
    if (!g) return;
    try { sessionStorage.removeItem('insight.pendingReveal'); } catch { /* best-effort */ }
    this.setState({ mode: g.mode === 'duo' ? 'duo' : 'group' });
  }

  // ── docking: once the in-flow ruler has scrolled away, the wordmark steps
  // aside and a compact ruler takes the header. One snap at a threshold, with
  // hysteresis, rather than a scroll-linked shrink — a scrubbed header jitters
  // and fights the feed's own entrance animations.
  // Dock when the ruler itself has left the scroller — not at a scrollTop
  // number. Group and 1v1 hand scrolling to their own snap stacks, so a
  // threshold on one container docked the header while the ruler was still
  // on screen. Capture phase, because scroll doesn't bubble: whichever
  // container actually moved, the check runs.
  watchRuler() {
    if (this._offScroll) { this._offScroll(); this._offScroll = null; }
    if (!this.props.ruler || !this.props.dock) return;
    const host = this.rootEl && this.rootEl.closest('.app');
    if (!host) return;
    const check = () => {
      const el = this._rulerEl, sc = this.rootEl && this.rootEl.parentElement;
      if (!el || !sc) return;
      const r = el.getBoundingClientRect(), s = sc.getBoundingClientRect();
      // hysteresis: gone past the top edge docks, 8px back into view releases
      this.setDocked(this._docked ? r.bottom <= s.top + 8 : r.bottom <= s.top + 1);
    };
    this._check = check;
    host.addEventListener('scroll', check, { passive: true, capture: true });
    this._offScroll = () => host.removeEventListener('scroll', check, true);
  }

  setDocked(v) {
    if (this._docked === v) return;
    this._docked = v;
    if (this.props.onDock) this.props.onDock(v);
  }
  componentDidUpdate(prevProps) {
    // nav v2: the bottom bar owns the mode — follow it when it changes
    if (prevProps && this.props.mode && this.props.mode !== prevProps.mode && this.props.mode !== this.state.mode && !this._switching) this.switchMode(this.props.mode);
    this.syncAppAccent();
    // enter half of the click-driven mode switch — runs synchronously after
    // the commit, so the body can never be left stuck in its exit state
    const b = this.bodyEl;
    if (b && this._enterDir != null) {
      const dir = this._enterDir; this._enterDir = null;
      b.style.opacity = ''; // transform-only convention — content stays visible
      b.style.transition = 'none'; b.style.transform = 'translateX(' + (dir * 42) + 'px)';
      b.getBoundingClientRect(); // flush so the enter slide transitions
      b.style.transition = 'transform 0.28s var(--ease-out)';
      b.style.transform = 'none';
      this._switching = false;
    }
  }
  componentWillUnmount() { clearTimeout(this._toastT); clearTimeout(this._lpT); clearTimeout(this._sheetT); if (this._unsubDuels) this._unsubDuels(); if (this._offScroll) this._offScroll(); if (this._docked && this.props.onDock) this.props.onDock(false); if (this._unsubLive) this._unsubLive(); if (this._pendingHandler) window.removeEventListener('insight-live-update', this._pendingHandler); if (this._onPurge) window.removeEventListener('insight:local-purge', this._onPurge); const app = document.querySelector('.app'); if (app) app.style.removeProperty('--accent'); }

  // one axis, three stops. Which axis depends on how the app is navigating:
  // ruler/pill run the daily's own scale, the 4-tab bar borrows the bar's order.
  get modeAxis() { return ['world', 'group', 'duo']; }

  // ── the daily's scale: World · Circle · 1v1 — the same ruler the Mirror wears,
  // because it is the same kind of choice: how far out this answer reaches.
  dailyRuler(mode, accents, badges) {
    const h = React.createElement;
    const STOPS = [{ id: 'world', label: 'World' }, { id: 'group', label: 'Circle' }, { id: 'duo', label: '1v1' }];
    const n = STOPS.length;
    const idx = Math.max(0, STOPS.findIndex((s) => s.id === mode));
    const acc = accents[mode];
    // the ruler reads as a primary switch, not a caption: labels at real size,
    // the graduation kept but scaled to match
    return h('div', { ref: (n) => { this._rulerEl = n; }, style: { margin: '-6px 0 -4px' } },
      h('div', { style: { position: 'relative', display: 'flex', height: 50 }, role: 'tablist', 'aria-label': 'How far this answer reaches' },
        h('div', { style: { position: 'absolute', left: 6, right: 6, bottom: 21, height: 1, background: 'color-mix(in oklch, var(--rule), transparent 30%)' } }),
        STOPS.map((s, i) => {
          const on = i === idx;
          // taller tick = wider scale, so the graduation narrows toward 1v1
          const tick = 11 - (i / (n - 1)) * 5.5;
          return h('button', { key: s.id, role: 'tab', 'aria-selected': on, 'aria-label': s.label, onClick: () => this.switchMode(s.id), style: { flex: 1, minWidth: 0, position: 'relative', height: 50, border: 'none', background: 'none', cursor: 'pointer', WebkitAppearance: 'none', padding: 0 } },
            badges[s.id] && h('span', { 'aria-hidden': true, style: { position: 'absolute', left: '50%', bottom: 39, marginLeft: -2.5, width: 5, height: 5, borderRadius: '50%', background: 'var(--c-around)' } }),
            h('span', { style: { position: 'absolute', left: '50%', bottom: 21, transform: 'translateX(-50%)', width: on ? 3 : 1.5, height: on ? 14 : tick, borderRadius: 99, background: on ? acc : 'color-mix(in oklch, var(--ink-3), transparent 45%)', transition: 'height .28s cubic-bezier(0.2,0.8,0.2,1), background .3s, width .2s' } }),
            h('span', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', whiteSpace: 'nowrap', fontFamily: 'var(--sans)', fontSize: on ? 15 : 13.5, fontWeight: on ? 800 : 600, letterSpacing: '-0.02em', color: on ? 'var(--ink)' : 'var(--ink-3)', transition: 'color .2s, font-size .2s' } }, s.label));
        })));
  }

  // click-driven mode switch — same slide the swipe gesture makes, so the
  // switcher and the gesture feel like one mechanism
  switchMode(id) {
    const MODES = this.modeAxis;
    const mi = MODES.indexOf(this.state.mode), ni = MODES.indexOf(id);
    if (ni === mi || ni < 0) return;
    const b = this.bodyEl, dir = ni > mi ? 1 : -1;
    if (this.props.onMode) this.props.onMode(id);
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!b || reduce || this._switching) { this.setState({ mode: id }); return; }
    this._switching = true;
    b.style.transition = 'transform 0.16s ease-in';
    b.style.transform = 'translateX(' + (-dir * 42) + 'px)';
    setTimeout(() => {
      this._enterDir = dir; // componentDidUpdate finishes the move
      this.setState({ mode: id });
      const sc = this.rootEl && this.rootEl.parentElement; if (sc) sc.scrollTop = 0;
      if (this._check) this._check();
    }, 160);
  }

  get modeAccent() {
    return this.state.mode === 'world' && this.state.testOpen
      ? 'var(--ochre)'
      : ({ world: 'var(--c-around)', group: 'var(--c-likeness)', duo: 'var(--c-people)' })[this.state.mode];
  }
  // lift the mode's accent onto the app root so the header wordmark and tab
  // bar glide with it — .app transitions --accent, so switches crossfade.
  syncAppAccent() {
    const app = document.querySelector('.app');
    if (!app || app.getAttribute('data-tab') !== 'track') return;
    const acc = this.modeAccent;
    if (this._appAcc !== acc) { app.style.setProperty('--accent', acc); this._appAcc = acc; }
  }

  syncToMap(S, optId) {
    const s = DAILYSPLIT_DQ_SYNC[S.id];
    if (!s) return;
    const q = DAILYQ.questions.find(x => x.prompt === s.prompt);
    if (q && s.map[optId] != null) DAILYQ.answer(q.id, s.map[optId]);
  }
  mapBranch(S) {
    const s = DAILYSPLIT_DQ_SYNC[S.id];
    if (s) {
      const q = DAILYQ.questions.find(x => x.prompt === s.prompt);
      if (q) return DAILYQ.categoryPath(q)[0];
    }
    const byRegion = { Taste: 'Food', Work: 'Mind', Society: 'Values' };
    const byCat = { dilemma: 'Morals', event: 'Mind', people: 'Values', bigq: 'Values' };
    return (S.region && byRegion[S.region]) || byCat[S.cat] || 'Interests';
  }

  hash(s) { let h = 9; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489); return ((h ^ (h >>> 9)) >>> 0) / 4294967295; }
  fmt(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : '' + n; }

  loadDailyReplies() {
    try { const v = JSON.parse(localStorage.getItem('insight.dailyReplies.v1') || '{}'); return v && typeof v === 'object' ? v : {}; }
    catch (e) { return {}; }
  }
  // reporting a comment — same short reason list the World feed uses
  reportRow(k) {
    if (this.state.reportFor !== k) return null;
    const R = window.WF_REPORT;
    if (!R) return null;
    const h = React.createElement;
    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 4 } },
      h('span', { style: { fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11.5, color: 'var(--ink-3)' } }, 'Report this take'),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' } },
        R.REASONS.map((r) => h('button', { key: r, className: 'press', onClick: () => { if (!this._jr) this._jr = new Set(); this._jr.add(k); R.report(k, r); this.setState({ reportFor: null }); }, style: { border: '1px solid var(--rule)', borderRadius: 999, padding: '6px 12px', background: 'var(--surface)', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, color: 'var(--ink)', cursor: 'pointer', WebkitAppearance: 'none', whiteSpace: 'nowrap' } }, r)),
        h('button', { onClick: () => this.setState({ reportFor: null }), style: { border: 'none', background: 'none', padding: '6px 4px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', WebkitAppearance: 'none' } }, 'Cancel')));
  }

  addDailyReply(key, text) {
    this.setState(s => {
      const dreplies = { ...s.dreplies, [key]: [...(s.dreplies[key] || []), text] };
      try { localStorage.setItem('insight.dailyReplies.v1', JSON.stringify(dreplies)); } catch { /* best-effort */ }
      return { dreplies, replyTo: null };
    });
  }


  // ── world topic categories (defs live in world-feed.jsx) ──
  loadWorldCats() {
    try { const v = JSON.parse(localStorage.getItem('insight.worldCats') || '{}'); return v && typeof v === 'object' ? v : {}; }
    catch (e) { return {}; }
  }
  toggleCat(id) {
    const next = { ...this.state.cats, [id]: !(this.state.cats[id] !== false) };
    if (!WORLD_TOPICS_V2.some(c => next[c.id] !== false)) return; // keep at least one topic on
    try { localStorage.setItem('insight.worldCats', JSON.stringify(next)); } catch { /* best-effort */ }
    this.setState({ cats: next, idx: 0, earlierOpen: false, feedOpen: false, tab: null, condensed: false, filter: 'all', testOpen: false });
  }
  // sides get distinct hues rotated from the topic's — same oklch family
  // (one lightness+chroma tier), so the choice has real contrast but every
  // color still derives from the question's topic.
  optColor(tc, i, n) { return WPAL.opt(tc, i, n, true); }
  get worldDeck() {
    const all = this.data;
    const on = all.filter(q => this.state.cats[q.cat] !== false);
    return (on.length ? on : all).map(q => {
      const tc = WPAL.c((WORLD_TOPICS_V2.find(c => c.id === q.cat) || {}).color || 'var(--c-around)');
      return { ...q, topicColor: tc, options: q.options.map((o, i) => ({ ...o, color: this.optColor(tc, i, q.options.length), textColor: '#fff' })) };
    });
  }

  jumpTo(i) {
    const m = this.state.mode;
    if (m === 'world') { this.setState({ idx: i, filter: 'all', draft: '', feedOpen: false, tab: null, earlierOpen: false, condensed: false }); const sc = this.rootEl && this.rootEl.parentElement; if (sc) sc.scrollTop = 0; }
    else this.setState({ idxG: i });
  }

  setupGestures(el) {
    if (!el || el._splitInit) return;
    el._splitInit = true; this.rootEl = el;
    const scroller = el.parentElement; if (!scroller) return;
    scroller.style.overflowX = 'hidden';
    // swipe/scroll down → question condenses into small % bubbles
    scroller.addEventListener('scroll', () => {
      const y = scroller.scrollTop, c = this.state.condensed;
      const next = c ? y > 80 : y > 170;
      if (next !== c) this.setState({ condensed: next });
    }, { passive: true });
    // only the question body slides — the mode switcher and page chrome hold still
    const T = () => this.bodyEl || el;
    // horizontal swipe moves along the axis; the page itself scrolls vertically
    // (question, then the feed). Earlier days are reached by tapping the day dots.
    const commit = (dir) => {
      // read the axis live — setupGestures runs once per mount, but the Nav tweak
      // can flip the axis under it without remounting
      const MODES = this.modeAxis;
      const mi = MODES.indexOf(this.state.mode), ni = mi + dir;
      // the axis continues past the far end into Mirror — act, then see
      if (ni >= MODES.length) { if ((this.props.hideSwitcher || this.props.ruler) && window.goNav) { window.goNav('mirror'); return; } spring(); return; }
      if (ni < 0) { spring(); return; } // spring at the near end
      try { localStorage.setItem('insight.swipeHinted', '1'); } catch { /* best-effort */ } // they've learned it — no more hinting
      const b = T();
      b.style.transition = 'transform 0.17s ease, opacity 0.17s ease';
      b.style.transform = 'translateX(' + (-dir * 64) + 'px)'; b.style.opacity = '0';
      setTimeout(() => {
        this.setState({ mode: MODES[ni] }); scroller.scrollTop = 0; if (this._check) this._check();
        if (this.props.onMode) this.props.onMode(MODES[ni]);
        requestAnimationFrame(() => {
          const b2 = T();
          b2.style.transition = 'none'; b2.style.transform = 'translateX(' + (dir * 64) + 'px)'; b2.style.opacity = '0';
          requestAnimationFrame(() => { b2.style.transition = 'transform 0.24s cubic-bezier(0.2,0.8,0.2,1), opacity 0.24s ease'; b2.style.transform = 'translateX(0)'; b2.style.opacity = '1'; });
        });
      }, 165);
    };
    const spring = () => { const b = T(); b.style.transition = 'transform 0.25s cubic-bezier(0.2,0.9,0.2,1), opacity 0.25s ease'; b.style.transform = 'translateX(0)'; b.style.opacity = '1'; };
    let sx = 0, sy = 0, dx = 0, horiz = null, dragging = false;
    scroller.addEventListener('touchstart', (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; dx = 0; horiz = null; dragging = true; const b = T(); b.style.animation = ''; b.style.transition = 'none'; }, { passive: true });
    scroller.addEventListener('touchmove', (e) => {
      if (!dragging) return; const t = e.touches[0]; const mx = t.clientX - sx, my = t.clientY - sy;
      if (horiz === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) horiz = Math.abs(mx) > Math.abs(my);
      if (horiz) { e.preventDefault(); dx = mx; const b = T(); b.style.transform = 'translateX(' + (mx * 0.7) + 'px)'; b.style.opacity = String(1 - Math.min(Math.abs(mx) / 520, 0.4)); }
    }, { passive: false });
    const end = () => { if (!dragging) return; dragging = false; if (horiz && Math.abs(dx) > 66 && !navCoasting()) commit(dx < 0 ? 1 : -1); else spring(); };
    scroller.addEventListener('touchend', end); scroller.addEventListener('touchcancel', end);
    let wheelLock = false;
    scroller.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) + 4) { e.preventDefault(); if (wheelLock || Math.abs(e.deltaX) < 24) return; if (navCoasting()) return; wheelLock = true; commit(e.deltaX > 0 ? 1 : -1); setTimeout(() => { wheelLock = false; }, 650); }
    }, { passive: false });
    // first-run hint — a gentle sideways nudge teaches that modes swipe; retires after the first real swipe
    try {
      if (!localStorage.getItem('insight.swipeHinted') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setTimeout(() => {
          if (dragging) return;
          const b = T();
          b.style.animation = 'sdNudge 1.05s cubic-bezier(0.33,0.7,0.3,1) 2';
          b.addEventListener('animationend', () => { b.style.animation = ''; }, { once: true });
        }, 1500);
      }
    } catch { /* best-effort */ }
  }

  get data() {
    // Live mode: the deck comes from Firestore (real questions, real
    // counts) via window.LIVE; the demo deck below stays as the mock
    // fallback and the offline dev experience.
    const L = window.LIVE;
    if (L && L.enabled) {
      // live mode NEVER shows the demo deck — an empty live deck (slow
      // boot, unseeded day) renders a loading card instead of fake data
      return (L.ready && L.deck()) || [];
    }
    const PINK = 'var(--c-around)', VIOLET = 'var(--c-today)', TEAL = 'var(--c-likeness)';
    return [
      { id: 's1', cat: 'culture', region: 'Taste', regionHue: 40, regionBase: 1, text: 'Pineapple belongs on pizza.',
        options: [ { id: 'yes', label: 'Absolutely', count: 5642, color: PINK }, { id: 'no', label: 'Never', count: 6210, color: VIOLET } ],
        comments: [
          { name: 'Tom K.', init: 'TK', opt: 'no', time: '2h', ups: 214, text: 'I refuse to negotiate with fruit.' },
          { name: 'Jonas W.', init: 'JW', opt: 'no', time: '5h', ups: 156, text: 'Hot fruit juice soaking into the crust. Describe it out loud and hear yourself.' },
          { name: 'Maya R.', init: 'MR', opt: 'yes', time: '3h', ups: 128, text: 'Sweet + salty + melted cheese. This is not a debate, it\u2019s a taste test you\u2019re failing.' },
          { name: 'Chris D.', init: 'CD', opt: 'no', time: '1d', ups: 99, text: 'My Italian grandmother just felt a disturbance.' },
          { name: 'Priya S.', init: 'PS', opt: 'yes', time: '8h', ups: 87, text: 'Invented by a Greek guy in Canada. Peak globalization. Respect it.' },
          { name: 'Ana L.', init: 'AL', opt: 'yes', time: '1d', ups: 41, text: 'Team sweet forever.' },
        ],
        friends: [ { name: 'Alex', init: 'A', opt: 'yes' }, { name: 'Mia', init: 'M', opt: 'yes' }, { name: 'Jordi', init: 'J', opt: 'no' }, { name: 'Sara', init: 'S', opt: 'no' }, { name: 'Noah', init: 'N', opt: 'yes' }, { name: 'Elif', init: 'E', opt: 'no' } ] },
      { id: 's5', cat: 'dilemma', text: 'A runaway trolley: pull the lever so one dies instead of five?',
        options: [ { id: 'pull', label: 'Pull the lever', count: 8213, color: PINK }, { id: 'dont', label: 'Don\u2019t touch it', count: 3391, color: VIOLET } ],
        comments: [
          { name: 'Ingrid M.', init: 'IM', opt: 'pull', time: '3h', ups: 342, text: 'Five families grieving versus one. It\u2019s math, and I hate that it\u2019s math.' },
          { name: 'Karl B.', init: 'KB', opt: 'dont', time: '5h', ups: 256, text: 'The moment you pull it, you chose who dies. That\u2019s yours forever.' },
          { name: 'Yuki T.', init: 'YT', opt: 'pull', time: '2h', ups: 198, text: 'Not pulling is also a choice. You don\u2019t get to stay clean by freezing.' },
          { name: 'Femi A.', init: 'FA', opt: 'dont', time: '9h', ups: 121, text: 'Easy to say \u201Cpull\u201D from a couch. Your hands would not move.' },
          { name: 'Rosa P.', init: 'RP', opt: 'pull', time: '1d', ups: 64, text: 'Asked my whole family at dinner. We are no longer speaking.' },
        ],
        friends: [ { name: 'Alex', init: 'A', opt: 'pull' }, { name: 'Mia', init: 'M', opt: 'pull' }, { name: 'Jordi', init: 'J', opt: 'dont' }, { name: 'Sara', init: 'S', opt: 'pull' }, { name: 'Noah', init: 'N', opt: 'dont' }, { name: 'Elif', init: 'E', opt: 'pull' } ] },
      { id: 's6', cat: 'event', text: 'Mars rock lands on Earth this year. Worth the billions?',
        options: [ { id: 'worth', label: 'Worth every cent', count: 5107, color: PINK }, { id: 'spend', label: 'Spend it down here', count: 3860, color: VIOLET } ],
        comments: [
          { name: 'Nadia H.', init: 'NH', opt: 'worth', time: '4h', ups: 233, text: 'We picked up a piece of another planet. Sit with that for a second.' },
          { name: 'Pete R.', init: 'PR', opt: 'spend', time: '2h', ups: 187, text: 'My town\u2019s bridge has been \u201Cpending repairs\u201D since 2019. Priorities.' },
          { name: 'Ines V.', init: 'IV', opt: 'worth', time: '8h', ups: 140, text: 'The phone you typed that on exists because of Apollo-era money. It pays back.' },
          { name: 'Johan S.', init: 'JS', opt: 'spend', time: '1d', ups: 92, text: 'Fix the planet with a return address first.' },
        ],
        friends: [ { name: 'Alex', init: 'A', opt: 'worth' }, { name: 'Mia', init: 'M', opt: 'worth' }, { name: 'Jordi', init: 'J', opt: 'spend' }, { name: 'Sara', init: 'S', opt: 'worth' }, { name: 'Noah', init: 'N', opt: 'spend' }, { name: 'Elif', init: 'E', opt: 'worth' } ] },
      { id: 's7', cat: 'people', text: 'The richest person alive: earned it or extracted it?',
        options: [ { id: 'earned', label: 'Earned it', count: 4230, color: PINK }, { id: 'extracted', label: 'Extracted it', count: 6970, color: VIOLET } ],
        comments: [
          { name: 'Marta K.', init: 'MK', opt: 'extracted', time: '3h', ups: 301, text: 'Nobody \u201Cearns\u201D a billion. You collect it off other people\u2019s Tuesdays.' },
          { name: 'Dan O.', init: 'DO', opt: 'earned', time: '6h', ups: 176, text: 'He bet everything three times and won three times. Call it luck \u2014 luck is a skill.' },
          { name: 'Aisha B.', init: 'AB', opt: 'extracted', time: '5h', ups: 158, text: 'The warehouse workers timed their bathroom breaks. That\u2019s the answer.' },
          { name: 'Luc F.', init: 'LF', opt: 'earned', time: '1d', ups: 83, text: 'Envy dressed up as economics.' },
        ],
        friends: [ { name: 'Alex', init: 'A', opt: 'extracted' }, { name: 'Mia', init: 'M', opt: 'extracted' }, { name: 'Jordi', init: 'J', opt: 'earned' }, { name: 'Sara', init: 'S', opt: 'extracted' }, { name: 'Noah', init: 'N', opt: 'earned' }, { name: 'Elif', init: 'E', opt: 'extracted' } ] },
      { id: 's2', cat: 'culture', region: 'Work', regionHue: 235, regionBase: 2, text: 'Daily standup: keep it, async it, or kill it?',
        options: [ { id: 'live', label: 'Keep it live', count: 1204, color: PINK }, { id: 'async', label: 'Make it async', count: 2861, color: VIOLET }, { id: 'kill', label: 'Kill it entirely', count: 1377, color: TEAL } ],
        comments: [
          { name: 'Leo C.', init: 'LC', opt: 'kill', time: '1h', ups: 118, text: 'If your standup is useful, your tickets are bad.' },
          { name: 'Dev M.', init: 'DM', opt: 'async', time: '4h', ups: 76, text: 'We replaced standup with a thread. Got 40 minutes of my week back and nothing broke.' },
          { name: 'Sofia B.', init: 'SB', opt: 'live', time: '6h', ups: 54, text: 'It\u2019s the only time I actually see my team\u2019s faces. Keep it.' },
          { name: 'Nina P.', init: 'NP', opt: 'async', time: '9h', ups: 39, text: 'Async, but people actually have to write it. That\u2019s the catch.' },
          { name: 'Omar F.', init: 'OF', opt: 'live', time: '1d', ups: 22, text: '15 minutes, cameras on, no laptops. Works if you\u2019re strict.' },
        ],
        friends: [ { name: 'Alex', init: 'A', opt: 'async' }, { name: 'Mia', init: 'M', opt: 'live' }, { name: 'Jordi', init: 'J', opt: 'async' }, { name: 'Sara', init: 'S', opt: 'kill' }, { name: 'Noah', init: 'N', opt: 'async' }, { name: 'Elif', init: 'E', opt: 'live' } ] },
      { id: 's3', cat: 'bigq', region: 'Society', regionHue: 310, regionBase: 0, text: 'Social media does more harm than good.',
        options: [ { id: 'agree', label: 'Agree', count: 8912, color: PINK }, { id: 'disagree', label: 'Disagree', count: 7245, color: VIOLET } ],
        comments: [
          { name: 'Hana K.', init: 'HK', opt: 'agree', time: '2h', ups: 342, text: 'It ate the attention span of an entire generation and sold it back as ads.' },
          { name: 'June O.', init: 'JO', opt: 'agree', time: '7h', ups: 268, text: 'Ask any teacher.' },
          { name: 'Marcus T.', init: 'MT', opt: 'disagree', time: '3h', ups: 187, text: 'I found my job, my apartment and my best friend online. Harm is a choice.' },
          { name: 'Ruth E.', init: 'RE', opt: 'agree', time: '10h', ups: 130, text: 'The harm is in the feed design, not the people.' },
          { name: 'Diego V.', init: 'DV', opt: 'disagree', time: '1d', ups: 95, text: 'Blaming the mirror for your reflection.' },
        ],
        friends: [ { name: 'Alex', init: 'A', opt: 'agree' }, { name: 'Mia', init: 'M', opt: 'agree' }, { name: 'Jordi', init: 'J', opt: 'disagree' }, { name: 'Sara', init: 'S', opt: 'agree' }, { name: 'Noah', init: 'N', opt: 'disagree' }, { name: 'Elif', init: 'E', opt: 'agree' } ] },
      { id: 's4', cat: 'culture', region: 'Work', regionHue: 235, regionBase: 2, text: 'One work mode, forever. Choose.',
        options: [ { id: 'remote', label: 'Fully remote', count: 4102, color: PINK }, { id: 'hybrid', label: 'Hybrid', count: 3216, color: VIOLET }, { id: 'office', label: 'In the office', count: 1188, color: TEAL } ],
        comments: [
          { name: 'Lena G.', init: 'LG', opt: 'remote', time: '1h', ups: 203, text: 'The office is a $14 salad subscription.' },
          { name: 'Kat W.', init: 'KW', opt: 'remote', time: '5h', ups: 164, text: 'My commute is 12 steps and my focus has never been better.' },
          { name: 'Sam H.', init: 'SH', opt: 'hybrid', time: '4h', ups: 98, text: 'Two office days for the people, three home days for the work.' },
          { name: 'Ivo R.', init: 'IR', opt: 'office', time: '9h', ups: 71, text: 'I miss overhearing things. Half my career came from overheard things.' },
          { name: 'Ben A.', init: 'BA', opt: 'hybrid', time: '1d', ups: 33, text: 'Depends on the team more than the person, honestly.' },
        ],
        friends: [ { name: 'Alex', init: 'A', opt: 'remote' }, { name: 'Mia', init: 'M', opt: 'hybrid' }, { name: 'Jordi', init: 'J', opt: 'remote' }, { name: 'Sara', init: 'S', opt: 'office' }, { name: 'Noah', init: 'N', opt: 'remote' }, { name: 'Elif', init: 'E', opt: 'hybrid' } ] },
    ];
  }
  // cuts + subvalues come from the shared list (vote-cuts.js) so the daily and
  // the feed break a vote down exactly the same way
  get statDimDefs() { return VOTECUTS ? VOTECUTS.dims() : [{ id: 'friends', label: 'Friends' }]; }
  get statSubs() { return VOTECUTS ? VOTECUTS.subs(this.state.dim) : null; }
  get overrides() { return { 's1:age': [[64, 36], [55, 45], [44, 56], [34, 66]], 's4:age': [[54, 31, 15], [51, 34, 15], [44, 35, 21], [31, 37, 32]] }; }

  renderVals() {
    const st = this.state, h = React.createElement, F = React.Fragment;
    const BRIC = 'var(--sans)', INK = 'var(--ink)', PAPER = 'var(--surface)';
    const BORD = 'color-mix(in oklch, var(--rule), transparent 25%)';
    const LINE = '1px solid ' + BORD;
    const LINE2 = '1px solid ' + BORD;
    const mode = st.mode;
    const accents = { world: 'var(--c-around)', group: 'var(--c-likeness)', duo: 'var(--c-people)' };
    const showChips = this.props.chips === true;
    const TSTAT = this.testStats();
    const av = (bg, sz, fs) => ({ width: sz, height: sz, borderRadius: '50%', background: bg, color: '#fff', fontFamily: BRIC, fontWeight: 800, fontSize: fs, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 });
    // one card spec everywhere: .card's border, radius 18, --shadow-card (no colored offsets)
    // flat, recessed on the card — no float/gloss, so it sits with the flat feed cards below
    const optBtn = (acc) => ({ background: 'var(--surface)', border: acc ? '1px solid color-mix(in oklch, ' + acc + ' 14%, ' + BORD + ')' : LINE2, borderRadius: 14, padding: '15px 16px', display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', textAlign: 'left', transition: 'background .16s ease, border-color .16s ease' });
    const col = (g) => ({ display: 'flex', flexDirection: 'column', gap: g });

    // ===== WORLD =====
    const DATA = this.worldDeck;
    const dayNames = ['Today', 'Yesterday', 'Tue', 'Mon', 'Sun', 'Sat', 'Fri'];
    if (!DATA.length) {
      const placeholder = h('div', { className: 'card', style: { padding: '26px 18px', textAlign: 'center', margin: '4px 1px' } },
        h('div', { style: { fontWeight: 800, fontSize: 17, marginBottom: 6 } }, 'Fetching today\u2019s question\u2026'),
        h('div', { style: { fontSize: 13, fontWeight: 500, color: 'var(--ink-2)' } }, 'One moment \u2014 or check your connection.'));
      return placeholder;
    }
    const wIdx = Math.min(st.idx, DATA.length - 1), S = DATA[wIdx];
    const myVote = st.votes[S.id], voted = !!myVote;
    const blind = this.props.blindVoting ?? true, revealed = voted || !blind;
    const canChange = this.props.allowChangeVote ?? true, sortMode = this.props.commentSort ?? 'top';
    const counts = S.options.map(o => o.count + (myVote === o.id ? 1 : 0));
    const total = counts.reduce((a, b) => a + b, 0);
    const rp = counts.map(c => Math.round(c / total * 100));
    rp[rp.indexOf(Math.max(...rp))] += 100 - rp.reduce((a, b) => a + b, 0);
    const maxP = Math.max(...rp), myIdx = S.options.findIndex(o => o.id === myVote);
    // Below the k-floor the aggregate publishes nothing — say so instead
    // of dressing a single vote up as a population.
    // Under the DESIGN cadence (5) the published count is a LOWER BOUND,
    // not a running total: the public mirror is rewritten once per 5
    // answers so no single step is attributable to one person (D7's
    // amendment), and a live count reads "5+" — the honest way to say
    // "this moves in fives". Printing it as exact is the actual inaccuracy
    // there — and a small room watching the number sit on 5 for four more
    // answers reads as broken rather than as batched.
    // The tile heights + the 50% line say majority/underdog — the line
    // stays a count.
    // Under D81's launch pause the cadence is 1 and the count is EXACT, so
    // the "+" would claim a batching inaccuracy that is not there \u2014 it
    // returns with the restored cadence (AGG_COUNT_IS_EXACT, data/floor.ts).
    const liveTotal = S.live && !AGG_COUNT_IS_EXACT ? total.toLocaleString() + '+' : total.toLocaleString();
    // tooSmall at floor 1 means "no published counts yet": after your own
    // blind vote that is "you're first, the trigger is landing", not "wait
    // for five people" \u2014 the floor-aware copy keeps both eras honest.
    const resultNote = (S.live && S.tooSmall)
      ? (AGG_FLOOR > 1
        ? 'You\u2019re early \u2014 counts appear once ' + AGG_FLOOR + ' people have answered.'
        : 'You\u2019re first \u2014 the count lands in a moment.')
      : liveTotal + ' votes';
    const onReset = () => this.setState(s => { const v = { ...s.votes }; delete v[S.id]; return { votes: v, filter: 'all', tab: null, feedOpen: false }; });
    const post = () => { const t = st.draft.trim(); if (!t || !voted) return; const c = { key: 'u' + Date.now(), name: 'You', init: 'Y', opt: myVote, text: t, ups: 0, time: 'now' }; this.setState(s => ({ mine: { ...s.mine, [S.id]: [c, ...(s.mine[S.id] || [])] }, draft: '' })); };
    const mineList = st.mine[S.id] || [];
    let all = [...mineList, ...S.comments.map((c, i) => ({ ...c, key: S.id + ':' + i }))].map(c => ({ ...c, shownUps: c.ups + (st.ups[c.key] ? 1 : 0), optObj: S.options.find(o => o.id === c.opt) }));
    if (sortMode === 'top') all.sort((a, b) => b.shownUps - a.shownUps);
    const filtered = (st.filter === 'all' || !revealed) ? all : all.filter(c => c.opt === st.filter);
    const isComments = st.tab === 'comments';
    const isCtx = st.tab === 'ctx';
    const isFriends = st.dim === 'friends';

    const svgI = (paths, size) => h('svg', { viewBox: '0 0 24 24', width: size || 20, height: size || 20, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, dangerouslySetInnerHTML: { __html: paths } });
    const icoBtn = (on) => ({ height: 40, padding: '0 16px', border: LINE, borderRadius: 999, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: on ? 'color-mix(in oklch, var(--ink) 9%, var(--surface-2))' : 'var(--surface-2)', color: on ? INK : 'var(--ink-2)', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, letterSpacing: '0.02em', WebkitAppearance: 'none', whiteSpace: 'nowrap', transition: 'background .18s, color .18s, border-color .18s' });

    // topic chips — off by default (Tweaks can bring them back); quiet, lowercase, no shouting
    const chipRow = showChips ? h('div', { className: 'h-scroll', style: { display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto' } },
      WORLD_TOPICS_V2.map(c => {
          const on = !st.testOpen && st.cats[c.id] !== false;
          return h('button', { key: c.id, onClick: () => this.toggleCat(c.id), 'aria-pressed': on, style: {
            border: '0.5px solid ' + (on ? 'color-mix(in oklch, var(--c-around) 45%, transparent)' : 'var(--rule)'),
            background: on ? 'color-mix(in oklch, var(--c-around) 8%, transparent)' : 'transparent',
            color: on ? 'var(--ink-2)' : 'var(--ink-3)',
            fontWeight: 600, fontSize: 12,
            padding: '5px 11px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', whiteSpace: 'nowrap',
            transition: 'background .18s, color .18s, border-color .18s',
          } }, c.label.toLowerCase());
        })) : null;

    // one quiet meta line above the question: day · topic — nothing else competes
    const catLabel = (WORLD_TOPICS_V2.find(c => c.id === S.cat) || {}).label;

    // ── the feed: answer today's question, then the feed starts ──
    const feedEnabled = this.props.feed !== false && window.WorldFeed && (!(window.LIVE && window.LIVE.enabled) || window.LIVE.feedReady); // live feed (Phase 4) or the demo feed offline
    const feedNode = !feedEnabled ? null : h(window.WorldFeed, { cats: st.cats, onToggle: (id) => this.toggleCat(id), density: this.props.feedDensity || 'comfy', beats: this.props.beats, opts: this.props.feedOpts });

    // ── comments & who-voted — bottom sheets, portaled to the app screen ──
    const closeSheet = () => {
      if (this.state.sheetClosing) return;
      this.setState({ sheetClosing: true, replyTo: null });
      clearTimeout(this._sheetT);
      // only clear if nothing re-opened in the meantime — tapping the scrim and
      // immediately opening another sheet must not be swallowed by this timeout
      this._sheetT = setTimeout(() => this.setState((s) => (s.sheetClosing ? { tab: null, sheetClosing: false } : null)), 230);
    };
    const commentsBody = h('div', { style: col(12) },
      revealed && h('div', { style: col(8) },
        h('div', { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
          [{ id: 'all', label: 'All', color: INK }, ...S.options.map(o => ({ id: o.id, label: o.label, color: o.color, textColor: o.textColor }))].map(ch =>
            h('button', { key: ch.id, onClick: () => this.setState({ filter: ch.id }), style: { border: LINE, borderRadius: 999, padding: '6px 13px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', background: st.filter === ch.id ? ch.color : 'var(--surface-2)', color: st.filter === ch.id ? (ch.textColor || PAPER) : INK, WebkitAppearance: 'none' } }, ch.label))),
        h('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' } }, '\u25B2 You can only boost takes from your own side.')),
      voted && h('div', { style: { display: 'flex', gap: 8 } },
        h('input', { value: st.draft, onChange: (e) => this.setState({ draft: e.target.value }), onKeyDown: (e) => { if (e.key === 'Enter') post(); }, placeholder: 'Add your take\u2026', style: { flex: 1, border: LINE, borderRadius: 999, padding: '10px 16px', fontSize: 13.5, fontWeight: 600, background: 'var(--surface-2)', color: INK, outline: 'none', minWidth: 0 } }),
        h('button', { onClick: post, style: { border: LINE, borderRadius: 999, padding: '0 18px', fontWeight: 800, fontSize: 13, cursor: 'pointer', background: voted ? S.options[myIdx].color : INK, color: voted ? (S.options[myIdx].textColor || '#fff') : PAPER, WebkitAppearance: 'none' } }, 'Post')),
      filtered.map(c => {
        const R = window.WF_REPORT;
        if (R && R.has(c.key)) {
          if (!this._jr || !this._jr.has(c.key)) return null;
          return h('div', { key: c.key, style: { background: 'var(--surface-2)', border: LINE, borderRadius: 14, padding: '12px 13px', display: 'flex', alignItems: 'center', gap: 10 } },
            h('span', { style: { flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' } }, 'Reported. Hidden from your feed.'),
            h('button', { className: 'press', onClick: () => { R.undo(c.key); this._jr.delete(c.key); this.forceUpdate(); }, style: { border: 'none', background: 'none', padding: '2px 0', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, color: INK, cursor: 'pointer', WebkitAppearance: 'none' } }, 'Undo'));
        }
        const canUp = voted && c.opt === myVote;
        const rKey = S.id + '|' + c.key;
        const reps = st.dreplies[rKey] || [];
        const replying = st.replyTo === rKey;
        return h('div', { key: c.key, style: { background: 'var(--surface-2)', border: LINE, borderRadius: 14, padding: 12, ...col(8) } },
          h('div', { style: { display: 'flex', gap: 10, alignItems: 'flex-start' } },
            h('span', { style: { ...av(revealed ? c.optObj.color : 'var(--ink-3)', 36, 14), color: revealed ? (c.optObj.textColor || '#fff') : '#fff' } }, c.init),
            h('div', { style: { flex: 1, ...col(4), minWidth: 0 } },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' } },
                h('span', { style: { fontWeight: 800, fontSize: 13.5 } }, c.name),
                revealed && h('span', { style: { background: c.optObj.color, color: c.optObj.textColor || '#fff', fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' } }, c.optObj.label),
                h('span', { style: { fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' } }, c.time)),
              h('div', { style: { fontSize: 13.5, lineHeight: 1.45, fontWeight: 500 } }, c.text),
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } },
                h('button', { onClick: () => this.setState({ replyTo: replying ? null : rKey }), style: { background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11, color: replying ? INK : 'var(--ink-3)', WebkitAppearance: 'none' } }, 'Reply'),
                h('button', { onClick: () => this.setState(s => ({ reportFor: s.reportFor === c.key ? null : c.key })), 'aria-label': 'Report', style: { background: 'none', border: 'none', padding: '2px', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14, lineHeight: 1, color: st.reportFor === c.key ? INK : 'var(--ink-3)', WebkitAppearance: 'none' } }, '\u22ef')),
              this.reportRow(c.key)),
            canUp
              ? h('button', { onClick: () => this.setState(s => ({ ups: { ...s.ups, [c.key]: !s.ups[c.key] } })), style: { border: LINE, borderRadius: 10, padding: '5px 9px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, cursor: 'pointer', fontWeight: 800, fontSize: 11, background: st.ups[c.key] ? INK : 'var(--surface-2)', color: st.ups[c.key] ? PAPER : INK, flexShrink: 0, WebkitAppearance: 'none' } }, '\u25B2', h('span', null, this.fmt(c.shownUps)))
              : h('div', { title: 'Only voters on their side can boost this', style: { border: '1px solid var(--rule)', borderRadius: 10, padding: '5px 9px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, fontWeight: 800, fontSize: 11, color: 'var(--ink-3)', flexShrink: 0, cursor: 'not-allowed' } }, '\u25B2', h('span', null, this.fmt(c.shownUps)))),
          (reps.length > 0 || replying) && h('div', { style: { marginLeft: 46, ...col(6), borderLeft: '2px solid color-mix(in oklch, var(--rule), transparent 25%)', paddingLeft: 10 } },
            reps.map((r, ri) => h('div', { key: ri, style: col(2) },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' } },
                h('span', { style: { fontWeight: 800, fontSize: 13.5 } }, 'You'),
                voted && h('span', { style: { background: S.options[myIdx].color, color: S.options[myIdx].textColor || '#fff', fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' } }, S.options[myIdx].label),
                h('span', { style: { fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' } }, 'now')),
              h('div', { style: { fontSize: 13.5, lineHeight: 1.45, fontWeight: 500 } }, r))),
            replying && h('form', { onSubmit: (e) => { e.preventDefault(); const inp = e.target.elements.reply; const v = inp.value.trim(); if (v) this.addDailyReply(rKey, v); }, style: { display: 'flex', gap: 6 } },
              h('input', { name: 'reply', autoFocus: true, autoComplete: 'off', autoCapitalize: 'sentences', enterKeyHint: 'send', placeholder: 'Your reply\u2026', style: { flex: 1, minWidth: 0, border: LINE, borderRadius: 999, padding: '8px 13px', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, background: 'var(--surface)', color: INK, outline: 'none' } }),
              h('button', { type: 'submit', style: { border: 'none', borderRadius: 999, padding: '8px 14px', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', background: INK, color: PAPER, WebkitAppearance: 'none' } }, 'Send'))));
      }));
    const statsBody = (() => {
        const legend = S.options;
        let friendRows = [], friendSummary = '', rows = [];
        const youBand = (!isFriends && VOTECUTS) ? VOTECUTS.you(st.dim, st.dimAxis) : null;
        if (isFriends) {
          friendRows = S.friends.map(f => { const o = S.options.find(x => x.id === f.opt); return { name: f.name, init: f.init, color: o.color, textColor: o.textColor, chipLabel: o.label, chipColor: o.color }; });
          const same = S.friends.filter(f => f.opt === myVote).length;
          friendSummary = voted ? same + ' of ' + S.friends.length + ' friends are on your side' : 'How your friends voted';
        } else {
          const cutKey = st.dimAxis ? st.dim + ':' + st.dimAxis : st.dim;
          const gs = VOTECUTS ? VOTECUTS.groups(st.dim, st.dimAxis) : [];
          const key = S.id + ':' + cutKey, ov = this.overrides[key];
          rows = gs.map((g, gi) => {
            let ps;
            if (ov && ov[gi]) ps = [...ov[gi]];
            else { const w = S.options.map((o, oi) => (counts[oi] / total) * (0.55 + this.hash(key + gi + ':' + oi))); const sum = w.reduce((a, b) => a + b, 0); ps = w.map(x => Math.round(x / sum * 100)); ps[ps.indexOf(Math.max(...ps))] += 100 - ps.reduce((a, b) => a + b, 0); }
            return { label: g.label, dot: g.color, you: g.label === youBand, p0: ps[0], segments: S.options.map((o, oi) => ({ color: o.color, width: ps[oi] + '%' })) };
          }).sort((a, b) => b.p0 - a.p0);
        }
        const op = counts.map(c => Math.round(c / total * 100));
        op[op.indexOf(Math.max(...op))] += 100 - op.reduce((a, b) => a + b, 0);
        const many = rows.length > 6;
        const GRID = { display: 'grid', gridTemplateColumns: '96px 1fr', gap: 10, alignItems: 'center' };
        return h('div', { style: col(12) },
          h('div', { style: col(8) },
            h('div', { className: 'h-scroll', ref: (el) => { const sg = 'd|' + st.dim; if (el && this._dSig1 !== sg) { this._dSig1 = sg; VOTECUTS && VOTECUTS.centerChip(el); } }, style: { display: 'flex', gap: 6, overflowX: 'auto' } },
              this.statDimDefs.filter(dd => !dd.test).map(dd => h('button', { key: dd.id, 'data-on': st.dim === dd.id ? '1' : '0', onClick: () => this.setState({ dim: dd.id, dimAxis: null }), style: { flex: 'none', border: '1px solid ' + (st.dim === dd.id ? INK : 'var(--rule)'), borderRadius: 999, padding: '6px 13px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap', background: st.dim === dd.id ? INK : 'var(--surface-2)', color: st.dim === dd.id ? PAPER : 'var(--ink-2)', WebkitAppearance: 'none' } }, dd.label))),
            h('div', { className: 'h-scroll', ref: (el) => { const sg = 't|' + st.dim; if (el && this._dSig2 !== sg) { this._dSig2 = sg; VOTECUTS && VOTECUTS.centerChip(el); } }, style: { display: 'flex', gap: 6, overflowX: 'auto' } },
              this.statDimDefs.filter(dd => dd.test).map(dd => h('button', { key: dd.id, 'data-on': st.dim === dd.id ? '1' : '0', onClick: () => this.setState({ dim: dd.id, dimAxis: null }), style: { flex: 'none', border: '1px solid ' + (st.dim === dd.id ? INK : 'var(--rule)'), borderRadius: 999, padding: '6px 13px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap', background: st.dim === dd.id ? INK : 'var(--surface-2)', color: st.dim === dd.id ? PAPER : 'var(--ink-2)', WebkitAppearance: 'none' } }, dd.label))),
            this.statSubs && h('div', { className: 'h-scroll', ref: (row) => { const sig = st.dim + '|' + st.dimAxis; if (row && this._axSig !== sig) { this._axSig = sig; VOTECUTS && VOTECUTS.centerChip(row); } }, style: { display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', paddingBottom: 2 } },
              this.statSubs.map((sb, si) => { const on = (st.dimAxis || null) === sb.id; const rule = !!sb.tier && !(this.statSubs[si - 1] || {}).tier; return h(React.Fragment, { key: sb.id || 'type' },
                rule ? h('span', { 'aria-hidden': 'true', style: { flex: 'none', alignSelf: 'stretch', width: 1, margin: '3px 5px', background: 'var(--rule)' } }) : null,
                h('button', { 'data-on': on ? '1' : '0', onClick: () => this.setState({ dimAxis: sb.id }), style: { flex: 'none', border: 'none', borderRadius: 999, padding: '4px 11px', fontWeight: on ? 800 : 600, fontSize: 11.5, cursor: 'pointer', whiteSpace: 'nowrap', background: on ? 'var(--surface-3)' : 'transparent', color: on ? INK : 'var(--ink-3)', WebkitAppearance: 'none' } }, sb.label)); }))),
          isFriends && h('div', { style: { display: 'flex', gap: 14, flexWrap: 'wrap' } },
            legend.map(o => h('span', { key: o.id, style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 } }, h('span', { style: { width: 12, height: 12, borderRadius: 4, background: o.color, border: '1px solid ' + BORD, display: 'inline-block' } }), o.label))),
          isFriends
            ? h('div', { style: col(10) },
                h('div', { style: { background: INK, color: PAPER, borderRadius: 14, padding: '14px 16px', fontFamily: BRIC, fontWeight: 700, fontSize: 16 } }, friendSummary),
                friendRows.map((f, i) => h('div', { key: i, style: { background: 'var(--surface-2)', border: LINE, borderRadius: 14, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 } },
                  h('span', { style: { ...av(f.color, 34, 14), color: f.textColor || '#fff' } }, f.init),
                  h('span', { style: { flex: 1, fontWeight: 800, fontSize: 14 } }, f.name),
                  h('span', { style: { background: f.chipColor, color: f.textColor || '#fff', fontSize: 11, fontWeight: 800, padding: '4px 10px', borderRadius: 999 } }, f.chipLabel))))
            : h('div', { style: col(many ? 6 : 9) },
                h('div', { style: { ...GRID, alignItems: 'end' } },
                  h('span', { style: { fontWeight: 700, fontSize: 12, color: 'var(--ink-3)' } }, 'Everyone'),
                  h('span', { style: { display: 'flex', height: 32, borderRadius: 9, overflow: 'hidden' } },
                    op.map((p, oi) => h('span', { key: oi, style: { width: p + '%', boxSizing: 'border-box', background: S.options[oi].color, color: S.options[oi].textColor || '#fff', display: 'flex', alignItems: 'center', justifyContent: oi === op.length - 1 ? 'flex-end' : 'flex-start', padding: '0 10px', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden' } }, p >= 24 ? S.options[oi].label : '')))),
                rows.map((row, ri) => h('div', { key: ri, style: GRID },
                  h('span', { style: { display: 'flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: many ? 12 : 13, minWidth: 0, color: row.you ? INK : 'var(--ink-2)' } },
                    row.dot && h('span', { 'aria-hidden': true, style: { width: 9, height: 9, borderRadius: '50%', background: row.dot, flexShrink: 0 } }),
                    h('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, row.label)),
                  h('span', { style: { position: 'relative', display: 'block', height: many ? 20 : 26, borderRadius: many ? 6 : 8, boxShadow: row.you ? '0 0 0 1.5px ' + INK : 'none' } },
                    h('span', { style: { position: 'absolute', inset: 0, display: 'flex', borderRadius: many ? 6 : 8, overflow: 'hidden' } },
                      row.segments.map((seg, si) => h('span', { key: si, style: { width: seg.width, background: seg.color } }))),
                    h('span', { 'aria-hidden': true, style: { position: 'absolute', top: -3, bottom: -3, left: op[0] + '%', width: 1.5, borderRadius: 1, background: INK, opacity: 0.55 } }))))));
      })();
    const sheetHost = typeof document !== 'undefined' ? document.querySelector('.app') : null;
    // context is the one panel that opens before you answer — that is the point of it
    const ctxBody = h('div', { style: { padding: '2px 0 14px', display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 14, rowGap: 9, alignItems: 'baseline' } },
      [['Asked in', catLabel || 'Today'], ['Answers', (function () { const n = S.options.reduce((a, o) => a + (o.count || 0), 0); return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n); })()], ['On your map', S.region || 'Interests']]
        .map(([k, v]) => h(F, { key: k },
          h('span', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap' } }, k),
          h('span', { style: { fontSize: 13.5, fontWeight: 700, color: INK } }, v))));
    const sheetNode = ((isCtx || (voted && st.tab)) && sheetHost) ? ReactDOM.createPortal(
      h(Sheet, { onClose: closeSheet, closing: this.state.sheetClosing, label: isCtx ? 'About this question' : isComments ? 'Comments' : 'Who voted' },
          h('div', { style: { padding: '10px 18px 8px', display: 'flex', alignItems: 'baseline', gap: 10 } },
            h('span', { style: { fontFamily: BRIC, fontWeight: 800, fontSize: 15, flexShrink: 0 } }, isCtx ? 'About this question' : isComments ? 'Comments' : 'Who voted'),
            h('span', { style: { fontWeight: 600, fontSize: 12, color: 'var(--ink-3)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, S.text),
            h('button', { onClick: closeSheet, 'aria-label': 'Close', style: { border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', flexShrink: 0, WebkitAppearance: 'none' } }, '\u2715')),
          h('div', { className: 'wf-sheet-body' }, isCtx ? ctxBody : isComments ? commentsBody : statsBody)), sheetHost) : null;

    // ── the daily, in its own container — one strong card, feed after ──
    // quiet per-topic tint — today's question carries its topic's hue, barely
    const topicCol = S.topicColor || 'var(--c-around)';
    // feed hierarchy: today's question wins on type alone — 37px against the
    // feed's 24.5px. A tinted band did the work of a border, not a zone.
    const hier = !!this.props.feedHier;
    const dailyCard = h('div', { style: { ...col(14), position: 'relative', padding: '4px 1px 20px' } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, minHeight: 18 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
          h('span', { 'aria-hidden': true, style: { width: 6, height: 6, borderRadius: '50%', background: topicCol, flexShrink: 0 } }),
          h('span', { className: 'kicker', style: { marginBottom: 0 } }, (S.dayLabel || dayNames[wIdx]) + (catLabel ? ' \u00b7 ' + catLabel : ''))),
        wIdx !== 0 && h('button', { onClick: () => this.jumpTo(0), style: { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontWeight: 700, fontSize: 12, color: 'var(--ink-2)', WebkitAppearance: 'none', whiteSpace: 'nowrap' } }, '\u2039 back to today'),
        h('span', { style: { flex: 1 } }),
        h('button', { className: 'press', onClick: () => { clearTimeout(this._sheetT); this.setState({ tab: 'ctx', sheetClosing: false }); }, 'aria-label': 'About this question', style: { flexShrink: 0, width: 20, height: 20, borderRadius: '50%', border: '0.5px solid var(--rule)', background: 'transparent', color: 'var(--ink-3)', fontFamily: BRIC, fontSize: 11.5, fontWeight: 800, lineHeight: 1, cursor: 'pointer', WebkitAppearance: 'none', padding: 0 } }, 'i'),
        window.PassiveTag ? h(window.PassiveTag, { q: S, answered: voted }) : null),
      chipRow,
      h('div', { style: { fontFamily: BRIC, fontWeight: 800, fontSize: hier ? 37 : 31, lineHeight: 1.06, letterSpacing: hier ? -1.1 : -0.8, textWrap: 'balance' } }, S.text),
      !voted
        // asking: options size to their content and centre the label — a fixed
        // 236px column left a 22px word floating in a 115px box, reading as a skeleton
        // asking: each side carries its own hue mark and sits left-aligned, so
        // the two rows read as choices rather than two empty boxes
        ? h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            S.options.map((o, i) => h('button', { key: o.id, className: 'press sd-opt', onClick: () => { if (S.live && window.LIVE) window.LIVE.vote(S.id, o.id); this.syncToMap(S, o.id); this.showMapToast(S.id); this.setState(s => ({ votes: { ...s.votes, [S.id]: o.id }, filter: 'all', beat: (this.props.beats !== false && window.ConsequenceBeat) ? S.id : null })); }, style: { '--opt': o.color, minHeight: 56, background: 'color-mix(in oklch, ' + o.color + ' 11%, var(--surface-2))', border: '1px solid color-mix(in oklch, ' + o.color + ' 32%, var(--rule))', borderRadius: 15, padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', textAlign: 'left', WebkitAppearance: 'none', boxShadow: 'none', transition: 'background .16s ease, border-color .16s ease' } },
              h('span', { 'aria-hidden': true, style: { width: 9, height: 9, borderRadius: '50%', background: o.color, flexShrink: 0 } }),
              h('span', { style: { fontWeight: 800, fontSize: 21, color: 'var(--ink)', letterSpacing: '-0.025em', textWrap: 'pretty' } }, o.label))))
        : (st.beat === S.id && window.ConsequenceBeat)
        ? h(window.ConsequenceBeat, { key: 'beat-' + S.id, seed: S.id, options: S.options, pcts: rp, mineIdx: myIdx, height: 320, onDone: () => this.setState({ beat: null }) })
        : h('div', { style: { ...col(11), animation: 'popIn .35s cubic-bezier(0.2,0.8,0.2,1)' } },
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: 7, height: sdSplitStageH(S.options.length) } },
            S.options.map((o, i) => {
              // change-vote lives behind a long-press on your own bar
              const mineRow = myVote === o.id;
              const lpEnd = () => { clearTimeout(this._lpT); if (this.state.pressing) this.setState({ pressing: false }); };
              const lp = (mineRow && canChange) ? {
                onPointerDown: () => { clearTimeout(this._lpT); this.setState({ pressing: true }); this._lpT = setTimeout(() => { this.setState({ pressing: false }); onReset(); }, 550); },
                onPointerUp: lpEnd, onPointerLeave: lpEnd, onPointerCancel: lpEnd,
                onContextMenu: (e) => e.preventDefault(),
                title: 'Hold to change your vote',
                'aria-label': o.label + ' \u2014 your vote. Hold to change it.',
              } : {};
              // the option tiles ARE the chart — each one's height is its share
              return h('div', { key: o.id, ...lp, style: { flex: Math.max(rp[i], 9) + ' 1 0', minHeight: 46, border: mineRow ? '1.5px solid ' + o.color : LINE, borderRadius: 16, background: 'color-mix(in oklch, ' + o.color + ' 26%, var(--surface))', overflow: 'hidden', position: 'relative', boxShadow: 'none', transform: (mineRow && st.pressing) ? 'scale(0.975)' : 'none', transition: 'flex-grow .7s cubic-bezier(0.2,0.8,0.2,1), transform .45s cubic-bezier(0.2,0.8,0.2,1)', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', cursor: (mineRow && canChange) ? 'pointer' : 'default' } },
              h('div', { style: { position: 'relative', height: '100%', display: 'flex', alignItems: 'center', padding: '0 18px', gap: 10 } },
                // label, your mark and your circle's dots travel together — the
                // dots read as people on this side, not a floating glyph
                h('div', { style: { display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 } },
                  h('span', { style: { fontWeight: 800, fontSize: 19, letterSpacing: '-0.02em' } }, o.label),
                  myVote === o.id && h('span', { style: { fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', whiteSpace: 'nowrap', animation: 'chipPop .35s var(--ease-spring) var(--rv-2) both' } }, '\u00b7 you'),
                  (S.friends && S.friends.some(f => f.opt === o.id)) && h('button', {
                    onClick: () => this.setState({ tab: 'stats', dim: 'friends', dimAxis: null }),
                    'aria-label': S.friends.filter(f => f.opt === o.id).map(f => f.name).join(', ') + ' picked ' + o.label,
                    style: { display: 'flex', alignItems: 'center', gap: 4, padding: '4px 2px', border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0, WebkitAppearance: 'none' }
                  }, S.friends.filter(f => f.opt === o.id).map(f =>
                    h('span', { key: f.name, title: f.name, style: { width: 8, height: 8, borderRadius: '50%', background: o.color, boxShadow: '0 0 0 1.5px color-mix(in oklch, var(--surface) 70%, transparent)' } })))),
                // every side gets its number; only the winner gets the big one
                h('span', { style: { fontFamily: BRIC, fontWeight: 800, fontSize: rp[i] === maxP ? 25 : 15, letterSpacing: '-0.03em', color: rp[i] === maxP ? 'var(--ink)' : 'var(--ink-2)', flexShrink: 0, animation: 'popIn .4s cubic-bezier(0.2,0.8,0.2,1) .3s both' } }, rp[i] + '%')));
            })),
            // one quiet meta line; the map-add confirmation pops in on its right and fades on its own
            h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 18 } },
              h('span', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' } }, resultNote),
              st.mapToast === S.id && h('button', { onClick: () => window.goTab && window.goTab('map'), style: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--accent, var(--ink-2))', whiteSpace: 'nowrap', animation: 'toastFade 3s ease forwards' } },
                'added to ' + this.mapBranch(S), h('span', { 'aria-hidden': true }, '\u2192')))),
      // D1: live questions are world-scope — no stranger comments, no
      // who-voted identities. The sheets stay demo-only — and are also
      // suppressed when a live build is showing the mock fallback to a
      // real user (window.LIVE.demoInProd), where the seeded named
      // people would read as real.
      voted && st.beat !== S.id && !S.live && !(window.LIVE && window.LIVE.demoInProd) && h('div', { style: { display: 'flex', gap: 10, justifyContent: 'center', marginTop: 2, animation: 'popIn .35s cubic-bezier(0.2,0.8,0.2,1)' } },
        h('button', { onClick: () => this.setState({ tab: isComments ? null : 'comments' }), 'aria-label': 'Comments', style: icoBtn(isComments) },
          svgI('<path d="M6.5 4.5h11a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H11l-4 3.8V15h-.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/>', 17),
          'Comments'),
        h('button', { onClick: () => this.setState({ tab: st.tab === 'stats' ? null : 'stats' }), 'aria-label': 'Who voted what', style: icoBtn(st.tab === 'stats') },
          svgI('<path d="M5 19.5V13M12 19.5V5.5M19 19.5V10"/>', 17),
          'Who voted')),
      // day-nav appears only once today's answered (or you're browsing back) —
      // pre-vote it read as ambiguous pagination competing with the question.
      (voted || wIdx !== 0) && DATA.length > 1 && h('div', { style: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: -2 } },
        // one dot per day — oldest leftmost, today on the right;
        // filled = answered, ring = where you are. Tap a dot to move.
        DATA.map((q, i) => i).reverse().map(i => {
          const q = DATA[i];
          const v = st.votes[q.id], cur = i === wIdx;
          return h('button', {
            key: q.id, className: 'press', onClick: () => this.jumpTo(i), title: q.text,
            'aria-label': (dayNames[i] || 'Earlier') + ' \u2014 ' + (v ? 'answered' : 'not answered'),
            'aria-current': cur ? 'true' : undefined,
            style: { width: 22, height: 22, padding: 0, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitAppearance: 'none' }
          }, h('span', { style: { width: cur ? 18 : 6, height: 6, borderRadius: 999, background: cur ? 'var(--accent)' : v ? 'color-mix(in oklch, var(--accent) 45%, var(--surface-3))' : 'color-mix(in oklch, var(--ink-3) 30%, transparent)', transition: 'width .25s ease, background .2s ease' } }));
        })));

    const worldBody = h('div', { style: { ...col(13), flex: 1 } },
      // condensed rail: the split as one quiet bar — two saturated % discs
      // out-shouted everything else on the page
      (voted && st.condensed) && h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, padding: '9px 15px', borderRadius: 999, border: LINE, background: 'var(--surface-2)', boxShadow: 'var(--shadow-card)', animation: 'popIn .25s cubic-bezier(0.2,0.8,0.2,1)' } },
        h('span', { style: { flex: 1, minWidth: 0, fontWeight: 700, fontSize: 12, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, S.text),
        h('span', { 'aria-hidden': true, style: { display: 'flex', gap: 1.5, width: 66, height: 9, borderRadius: 999, overflow: 'hidden', flexShrink: 0 } },
          S.options.map((o, i) => h('span', { key: o.id, title: o.label + ' \u00b7 ' + rp[i] + '%', style: { width: rp[i] + '%', background: myVote === o.id ? o.color : 'color-mix(in oklch, ' + o.color + ' 32%, var(--surface-3))' } })))),
      dailyCard,
      sheetNode,
      feedNode);

    // ===== GROUP & 1v1 — daily-cadence bodies live in their own files =====
    // Live mode swaps the demo duel bodies for the real panel (create /
    // join / sealed votes / reveals); the demo stays for offline dev.
    const liveDuels = window.LIVE && window.LIVE.enabled && window.LiveDuelPanel;
    const groupBody = liveDuels ? h(window.LiveDuelPanel, { key: 'live-group', mode: 'group' }) : h(window.GroupDailyBody || 'div', { key: 'group-daily' });
    const duoBody = liveDuels ? h(window.LiveDuelPanel, { key: 'live-duo', mode: 'duo' }) : h(window.DuoBody || 'div', { key: 'duo-daily' });

    // ===== TEST =====
    const testBody = (() => {
      const OCHRE = 'var(--ochre-ink)';
      const defs = this.testDefs;

      // just finished a test — one clear payoff card
      if (st.testJustDone && defs[st.testJustDone]) {
        const k = st.testJustDone, T = defs[k];
        const saved = IS_TEST_RESULTS[k];
        const top = saved ? [...saved.dims].sort((a, b) => b.value - a.value)[0] : null;
        return h('div', { style: col(13) },
          h('div', { style: { ...col(12), border: LINE, borderRadius: 18, background: 'var(--surface-2)', boxShadow: 'var(--shadow-card)', padding: '20px 18px', textAlign: 'center', animation: 'popIn .35s cubic-bezier(0.2,0.8,0.2,1)' } },
            h('div', { style: { display: 'flex', justifyContent: 'center' } },
              h('span', { style: { background: OCHRE, color: '#fff', fontFamily: BRIC, fontWeight: 800, fontSize: 15, padding: '8px 18px', borderRadius: 999 } }, T.title + ' complete')),
            top && h('div', null,
              h('div', { style: { fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-3)' } }, 'Strongest'),
              h('div', { style: { fontFamily: BRIC, fontWeight: 800, fontSize: 26, letterSpacing: -0.5, marginTop: 3 } }, top.label + ' \u00b7 ' + top.value)),
            h('button', { onClick: () => this.setState({ testJustDone: null }), style: { alignSelf: 'center', border: 'none', borderRadius: 12, padding: '11px 20px', fontWeight: 800, fontSize: 14, cursor: 'pointer', background: INK, color: PAPER } }, TSTAT.active ? 'Next test \u203A' : 'Done')));
      }

      // everything answered — the picture stays current from daily play, so
      // there is nothing to re-take here; just show what has been mapped.
      if (!TSTAT.active) {
        return h('div', { style: col(13) },
          h('div', { style: { border: LINE, borderRadius: 16, background: 'var(--surface-2)', padding: '18px 16px', ...col(12) } },
            h('div', { style: { textAlign: 'center', ...col(5) } },
              h('span', { style: { fontFamily: BRIC, fontWeight: 800, fontSize: 22 } }, 'Fully mapped'),
              h('span', { style: { fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' } }, 'Your answers keep it current.')),
            h('div', { style: col(8) },
              Object.entries(defs).map(([tk, TT]) => h('div', { key: tk, style: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: LINE, borderRadius: 12, background: 'var(--surface)', padding: '10px 13px' } },
                h('span', { style: { width: 9, height: 9, borderRadius: '50%', background: TT.accent, flexShrink: 0 } }),
                h('span', { style: { flex: 1, minWidth: 0, fontWeight: 800, fontSize: 14, color: INK } }, TT.title),
                h('span', { style: { fontWeight: 800, fontSize: 13, color: OCHRE, flexShrink: 0 } }, '\u2713'))))));
      }

      // one question a tap — same pool, same progress as the profile's tests
      const k = TSTAT.active, T = defs[k];
      const base = (st.testRetake !== k && !PASSIVE.complete(k)) ? PASSIVE.passiveDone(k) : 0;
      const cur = st.testProg[k] && Array.isArray(st.testProg[k].answers) ? st.testProg[k] : { step: base, answers: [] };
      const qi = Math.min(cur.step || 0, T.questions.length - 1);
      const LIKERT = ['Strongly disagree', 'Disagree', 'Neither', 'Agree', 'Strongly agree'];
      return h('div', { style: col(13) },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          h('span', { style: { background: 'color-mix(in oklch, var(--ochre) 9%, transparent)', border: '1px solid color-mix(in oklch, var(--ochre) 42%, transparent)', color: OCHRE, fontWeight: 800, fontSize: 11.5, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '5px 11px', borderRadius: 999 } }, T.title),
          h('span', { style: { border: LINE, fontWeight: 700, fontSize: 12, padding: '4px 10px', borderRadius: 999 } }, (qi + 1) + ' of ' + T.questions.length)),
        base > 0 && h('span', { style: { fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginTop: -6 } }, 'first ' + base + ' mapped from your feed answers — picking up from there'),
        h('div', { key: k + ':' + qi, style: { ...col(13), animation: 'popIn .3s cubic-bezier(0.2,0.8,0.2,1)' } },
          h('div', { style: { fontFamily: BRIC, fontWeight: 800, fontSize: 27, lineHeight: 1.12, letterSpacing: -0.7, textWrap: 'balance' } }, T.questions[qi].q),
          h('div', { style: col(9) },
            LIKERT.map((label, i) => {
              const intensity = Math.abs(i - 2);
              const dot = 10 + intensity * 5;
              return h('button', { key: label, onClick: () => this.answerTest(k, i), style: { ...optBtn(OCHRE), padding: '12px 16px' } },
                h('span', { style: { width: 22, height: 22, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } },
                  h('span', { style: { width: dot, height: dot, borderRadius: '50%', boxSizing: 'border-box', border: '1.5px solid ' + (i === 2 ? 'var(--ink-3)' : OCHRE), background: i === 2 ? 'transparent' : 'color-mix(in oklch, ' + OCHRE + ' ' + (intensity === 2 ? 100 : 25) + '%, transparent)' } })),
                h('span', { style: { fontWeight: 750, fontSize: 15.5, color: INK } }, label));
            }))));
    })();

    // ===== chrome =====
    const pendG = window.DUELS && window.DUELS.groupsPending ? window.DUELS.groupsPending() : 0;
    const pendD = window.DUELS ? window.DUELS.pendingDuos() : 0;
    const badges = {
      group: mode !== 'group' && pendG ? String(pendG) : null,
      duo: mode !== 'duo' && pendD ? String(pendD) : null,
    };
    const MODE_TABS = [{ id: 'world', label: 'World' }, { id: 'group', label: 'Group' }, { id: 'duo', label: '1v1' }];
    const modeIdx = Math.max(0, MODE_TABS.findIndex(m => m.id === mode));
    const switcher = h('div', { className: 'sd-switch', style: { '--sw-n': MODE_TABS.length } },
      h('span', { className: 'sd-thumb', 'aria-hidden': true, style: { transform: 'translateX(' + modeIdx * 100 + '%)' } },
        h('span', { style: { width: 34, height: 2.5, borderRadius: 99, background: accents[mode], display: 'block', transition: 'background .25s ease' } })),
      MODE_TABS.map(m => h('button', { key: m.id, className: 'sd-switch-btn' + (mode === m.id ? ' is-on' : ''), onClick: () => this.switchMode(m.id), style: { '--sw-acc': accents[m.id] } }, m.label,
        badges[m.id] && h('span', { style: { marginLeft: 6, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 999, background: 'var(--c-around)', color: '#fff', fontSize: 9.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' } }, badges[m.id]))));

    const body = mode === 'world'
      ? (st.testOpen ? h('div', { style: col(13) }, chipRow, testBody) : worldBody)
      : mode === 'group' ? groupBody : duoBody;

    return {
      rootRef: (el) => this.setupGestures(el),
      // the switcher renders into the header slot when there is one, and
      // falls back to sitting inline — so a mount order that has not yet
      // produced the slot still shows the modes rather than dropping them
      screen: h(F, null, this.props.ruler ? this.dailyRuler(mode, accents, badges) : this.props.hideSwitcher ? null : (st.modeSlot && st.modeSlot.isConnected) ? ReactDOM.createPortal(switcher, st.modeSlot) : switcher,
        // the sliding surface — swipes translate this, not the whole page
        h('div', { ref: (n) => { this.bodyEl = n; }, style: { display: 'flex', flexDirection: 'column', gap: 13, flex: 1, willChange: 'transform' } }, body),
        // quiet footer — suggest a question for the daily (community board)
        h('button', { onClick: () => window.openSuggestions && window.openSuggestions(), style: { alignSelf: 'center', marginTop: 4, padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' } }, 'Have a question in mind? ', h('span', { style: { color: 'var(--accent)' } }, 'Suggest one \u2192'))),
    };
  }

  render() {
    const h = React.createElement;
    const st = this.state;
    const { rootRef, screen } = this.renderVals();
    return h('div', {
      ref: rootRef,
      'data-screen-label': 'Split daily v2',
      style: {
        // 1 0 auto: fill the viewport when content is short (World), but never
        // shrink below content — else the painted surface stops one screen down
        // and Group/1v1 scroll into a white gap. min-height floors it to full height.
        flex: '1 0 auto', minHeight: '100%', boxSizing: 'border-box',
        backgroundColor: 'var(--surface-a, var(--surface))',
        // var(--accent) is a registered <color> that transitions on .app, so
        // the wash (and everything reading the accent) crossfades between modes
        backgroundImage: 'radial-gradient(130% 100% at 50% -30%, color-mix(in oklch, var(--accent) 9%, transparent), transparent 64%)',
        backgroundRepeat: 'no-repeat', backgroundSize: '100% 360px',
        color: 'var(--ink)',
        padding: '10px 16px 96px',
        display: 'flex', flexDirection: 'column', gap: 13,
        fontFamily: 'var(--sans)',
        willChange: 'transform', touchAction: 'pan-y',
      },
    },
      // D1: a live build showing the demo deck (offline / boot failure)
      // must say so — these are sample questions, not the real daily,
      // and votes here don't sync. Clears itself when live attaches.
      //
      // TAP IT FOR THE REASON. The label alone says a real user is on demo
      // content and not why, and on a phone there is no console to ask —
      // the first device this ever ran on failed here and the reason was
      // reachable only with a Mac. One tap is the whole remedy; it stays
      // behind a tap because "reconnecting…" is the honest thing to show
      // someone on a train, and `auth/network-request-failed` is not.
      LIVE.demoInProd && h('div', {
        key: 'demo-banner',
        style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 },
      },
        h('button', {
          type: 'button',
          onClick: () => this.setState(s => ({ showBootErr: !s.showBootErr })),
          'aria-expanded': !!st.showBootErr,
          style: { fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-3)', background: 'none', border: '1px solid var(--rule)', borderRadius: 999, padding: '3px 10px', cursor: 'pointer', WebkitAppearance: 'none' },
        }, 'Sample questions · reconnecting…'),
        st.showBootErr && h('div', {
          style: { fontSize: 11, lineHeight: 1.5, color: 'var(--ink-3)', textAlign: 'center', maxWidth: 320, padding: '0 12px', wordBreak: 'break-word' },
        }, LIVE.bootError || 'connecting…')),
      screen);
  }
}
window.DailySplit = DailySplit;

;globalThis.DailySplit = typeof DailySplit === 'undefined' ? globalThis.DailySplit : DailySplit;
;globalThis.WORLD_TOPICS_V2 = typeof WORLD_TOPICS_V2 === 'undefined' ? globalThis.WORLD_TOPICS_V2 : WORLD_TOPICS_V2;
;globalThis.DAILYSPLIT_DQ_SYNC = typeof DAILYSPLIT_DQ_SYNC === 'undefined' ? globalThis.DAILYSPLIT_DQ_SYNC : DAILYSPLIT_DQ_SYNC;

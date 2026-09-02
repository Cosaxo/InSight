// Ported from design/spec-modules/daily-split.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { VOTECUTS } from './vote-cuts.js';
import { navCoasting, OWNS_X } from './swipe-back.js';
import { WPAL } from './world-palette.js';
import { DAILYQ } from './daily-questions.js';
import { DUELS } from './duels-data.js';
import { Sheet } from './primitives.jsx';
// The store, through the module rather than through `window` — D39's
// ratchet only moves down, so coupling arrives as an import. Every read in
// this file goes through this binding since the LIVE conversion (D352).
// The `window.LIVE &&` existence guards went with it, because an imported
// binding cannot be unset; the DATA conditions beside them (`.enabled`,
// `.ready`, `.demoInProd`, `.feedReady`) stayed, because those can still
// be false — and the member-existence guards (`L.myVotes && …`) went too,
// because the surface pin in data/vote.test.ts holds every one of those
// methods on the store's literal.
import LIVE from '../data/live';
// D352's sweep. WORLD_TOPICS was a module-scope `window.` read with a
// five-entry fallback — the fragility src/v2/README.md's feed paragraph
// names ("deferring world-feed-data swaps the real topic set for the
// fallback, silently"); the import makes the order a graph guarantee and
// the fallback goes. GroupDailyBody's `|| 'div'` and PassiveTag's guard
// were load-order guards on eager modules.
import { GroupDailyBody } from './group-daily.jsx';
import { PassiveTag } from './passive-meter.jsx';
import { WORLD_TOPICS } from './world-feed-data.js';
import { WF_REPORT } from './world-feed-report.js';
// The one rounding rule (data/pct.ts). This file was the third split
// surface and the one that kept the rule pct.ts was written to delete —
// see the commit that converted it. Static, not lazy: pct.ts is a pure
// leaf with no imports of its own, and the split is the first thing this
// tab draws.
import { sharePcts } from '../data/pct';
// The live world-takes surface (D83) — the typed panel, reached by ESM
// rather than a global lookup, so the D39 coupling meter stays flat.
//
// LAZY, and that is a measurement rather than a style (D152). This file is
// the daily tab: eager, first screen. A static import put the whole takes
// panel into the first-paint graph for a surface that renders only behind
// the "Takes" tap, and `npm run check:bundle` counts it — a chunk the
// entry imports statically is preloaded whether or not anything renders
// it. The one place it was spent is the one place it is never needed at
// boot.
import PulseCard from '../ui/PulseCard.tsx';
import PULSE from '../data/pulse.ts';
// The rating result's ridge (D305) — static like PulseCard: a voted
// rating day draws it on the first screen, so lazy would only add a
// flash, and the component is a leaf a few hundred bytes long.
import RatingRidge from '../ui/RatingRidge.tsx';
const LiveTakesPanel = React.lazy(() => import('../ui/LiveTakesPanel.tsx'));
// The live who-voted sheet (D125), on exactly the same terms — lazy, for
// the same measured reason, and reached by ESM so the coupling meter stays
// flat. D171: the daily had no breakdown at all in live mode while every
// feed card under it had this one, because the daily's own sheet is the
// prototype's hash-built mock and was suppressed rather than replaced.
const LiveBreakdownPanel = React.lazy(() => import('../ui/LiveBreakdownPanel.tsx'));
// The live duel/group panel, on the same terms and for the same measured
// reason (D156) — see the mode switch near the bottom of render().
const LiveDuelPanel = React.lazy(() => import('../ui/LiveDuelPanel.tsx'));
import ReactDOM from 'react-dom';
// This file bound IS_TESTS, IS_TEST_RESULTS, persistTestResult and PASSIVE
// and referenced none of them — residue of the `else { window.IS_TEST_RESULTS
// = … }` branch that converting test-definitions.js made unreachable
// (src/v2/README.md). Both statements are gone rather than kept as
// side-effect imports: TRACED, not assumed, because the first instinct was
// to keep the edges for load order and that instinct was wrong. Neither
// module waits on this file — spec-index.js reaches archetype-data.js at
// line 9, which imports test-definitions.js, and type-marks.jsx and
// result-card.jsx at 69 and 71, which import passive-progress.js, all long
// before daily-split.jsx at 140.
import NAV from '../data/nav';

// daily-split.jsx — SPLIT: the daily tab. Three modes — World (vote blind,
// see how the crowd & every kind of person split), Group (one question a day
// for your circle; yesterday revealed with names — see group-daily.jsx) and
// 1v1 (answer + guess what they answered; next-day reveal — see duo-daily.jsx).
// Keeps the chunky card language but speaks the app's tokens (Hanken Grotesk,
// surface/ink, oklch accents) so it sits with the other tabs and follows dark mode.

// World topic categories — the subreddit-style subscriptions. Definitions
// (labels + hues) live in world-feed-data.js; the chip row in the feed is the
// subscription UI, and the same set filters the daily deck.
const WORLD_TOPICS_V2 = WORLD_TOPICS;

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

// Is the live store up and answering? Asked by both pending-target
// consumers below (a tapped reveal, a tapped invitation).
//
// One helper rather than the check inline at each call site. (It was
// written as ONE shared-global read for rule 4's sake; the binding is an
// import now, and the existence half of the old `L && …` went with the
// bridge read.)
const liveReady = () => !!(LIVE.enabled && LIVE.ready);

// The mode of the circle this gid names, or null when it names none this
// account is in. Shared by both gid-shaped pending targets — a tapped
// reveal, and a tapped join request or approval (D240) — so the store is
// reached once here rather than once in each of them, which is the
// difference check:globals rule 4 counts.
const modeOfGroup = (gid) => {
  if (!gid || !liveReady()) return null;
  const g = LIVE.social.groups().find((x) => x.id === gid);
  return g ? (g.mode === 'duo' ? 'duo' : 'group') : null;
};

export class DailySplit extends React.Component {
  state = {
    mode: this.props.mode || 'world', feedOpen: false, condensed: false, earlierOpen: false, reportFor: null,
    idx: 0, idxG: 0,
    votes: (LIVE.enabled ? LIVE.myVotes() : {}), tab: null, filter: 'all', dim: 'friends', dimAxis: null, ups: {}, mine: {}, draft: '', dreplies: this.loadDailyReplies(), replyTo: null,
    mapToast: null, pressing: false, editHold: null,
    // Which daily has its D86 re-pick open — id, not boolean, the same
    // shape and the same reason as `liveTakes` below. The reconcile in
    // componentDidMount skips it: opening the re-pick DELETES the local
    // vote, and the store still holds the old option (only editVote
    // moves it), so without this any notify that lands before the tap —
    // the 60s aggregate refresh, the presence beat, a take arriving —
    // copied the old vote back and closed the re-pick with no sign of
    // why. Held down for half a second, and the app took it away again.
    repick: null,
    group: {},
    cats: this.loadWorldCats(),
    // which daily's live world-takes panel is open (D83) — id, not boolean,
    // so paging to another day closes it implicitly
    liveTakes: null,
    // and which daily's live who-voted sheet is open (D171), on the same
    // terms and for the same reason. The two are mutually exclusive: they
    // are both full-width panels under one card, and having both open at
    // once pushes the question itself off the top of the screen.
    liveStats: null,
  };

  // THE TEST FAST PATH LIVED HERE, and D121 removed it along with the
  // sit-down overlay. `testDefs` / `testStats` / `scoreTestDaily` /
  // `answerTest` / `loadTestProg` / `saveTestProg` drove a one-question-a-tap
  // run of an instrument inside the daily tab, reached by `state.testOpen`.
  //
  // It was already unreachable: `testOpen` initialised to false and the only
  // other write in the file set it to false again, so no tap in the shipped
  // app could open it. Deleting it is therefore not a behaviour change — it
  // is the removal of a second scorer for the instruments, which is the part
  // that mattered. The instruments now have exactly one: the fold over your
  // feed answers (data/passiveProfile.ts).
  // vote lands on the map — a brief confirmation that fades on its own
  showMapToast(id) {
    clearTimeout(this._toastT);
    this.setState({ mapToast: id });
    this._toastT = setTimeout(() => { if (this.state.mapToast === id) this.setState({ mapToast: null }); }, 3000);
  }
  componentDidMount() {
    this._unsubDuels = DUELS.subscribe(() => this.forceUpdate());
    // The purge (data/live.ts, D51): this component persists dreplies,
    // cats and testProg by spreading state back to the keys the purge just
    // removed, and it stays mounted across a uid change — drop them, or
    // one interaction writes the previous account's maps back. votes
    // clears too; the live-update sync refills it for the new uid.
    this._onPurge = () => this.setState({ dreplies: {}, cats: {}, votes: {} });
    window.addEventListener('insight:local-purge', this._onPurge);
    // the window event fires on every store notify AND on push-tap
    // dispatch — either way, try to consume a pending reveal or
    // invitation target (D236)
    this._pendingHandler = () => this.consumePending();
    window.addEventListener('insight-live-update', this._pendingHandler);
    this.consumePending();
    // Reconcile (not just repaint) on live-store changes: rolled-back
    // votes must un-vote the UI, and a late live boot (timeout path)
    // must hydrate answers recorded in earlier sessions.
    this._unsubLive = LIVE.subscribe(() => {
      const L = LIVE;
      if (!L.enabled || !L.ready) { this.forceUpdate(); return; }
      const lv = L.myVotes();
      this.setState((s) => {
        const votes = { ...s.votes };
        L.deck().forEach((q) => {
          // …except the one whose re-pick is open. See `repick` above.
          if (q.id === s.repick) return;
          if (lv[q.id] != null) votes[q.id] = lv[q.id];
          else delete votes[q.id];
        });
        return { votes };
      });
      this.consumePending();
    });
    this.syncAppAccent();
    this.watchRuler();
  }

  // A tapped reveal notification (src/v2/data/push.ts) stores the gid;
  // once live groups are known, land on that duel's mode.
  consumePendingReveal() {
    let gid = null;
    try { gid = sessionStorage.getItem('insight.pendingReveal'); } catch { /* best-effort */ }
    const mode = modeOfGroup(gid);
    if (!mode) return false;
    try { sessionStorage.removeItem('insight.pendingReveal'); } catch { /* best-effort */ }
    this.setState({ mode });
    return true;
  }

  // A tapped INVITATION (D236) stores the mode, not a gid, and the
  // asymmetry is structural: the tapper is not a member yet, so
  // groups() cannot resolve the circle and the lookup above would find
  // nothing at all. Land on the stop whose LdInvites draws the row.
  consumePendingInvite() {
    let mode = null;
    try { mode = sessionStorage.getItem('insight.pendingInvite'); } catch { /* best-effort */ }
    if (!mode || !liveReady()) return false;
    try { sessionStorage.removeItem('insight.pendingInvite'); } catch { /* best-effort */ }
    this.setState({ mode: mode === 'duo' ? 'duo' : 'group' });
    return true;
  }

  // A tapped join request, or an approval of one (D240). Same shape as
  // the reveal above and for the same reason — both name a circle this
  // account is IN, so groups() resolves the gid — but it is its own key
  // because it is not a reveal and a key that lied about that is how the
  // next reader gets it wrong.
  consumePendingCircle() {
    let gid = null;
    try { gid = sessionStorage.getItem('insight.pendingCircle'); } catch { /* best-effort */ }
    const mode = modeOfGroup(gid);
    if (!mode) return false;
    try { sessionStorage.removeItem('insight.pendingCircle'); } catch { /* best-effort */ }
    this.setState({ mode });
    return true;
  }

  // A reveal outranks the rest: it is the one that expires today. An
  // invitation is last because it is the only one that is not about a
  // circle this account is already in. Several can be waiting after a
  // batch of notifications, and landing on the wrong one buries the
  // reveal.
  consumePending() {
    if (this.consumePendingReveal()) return;
    if (this.consumePendingCircle()) return;
    this.consumePendingInvite();
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
  componentWillUnmount() { clearTimeout(this._toastT); clearTimeout(this._lpT); clearTimeout(this._sheetT); clearTimeout(this._ehT); if (this._unsubDuels) this._unsubDuels(); if (this._offScroll) this._offScroll(); if (this._docked && this.props.onDock) this.props.onDock(false); if (this._unsubLive) this._unsubLive(); if (this._pendingHandler) window.removeEventListener('insight-live-update', this._pendingHandler); if (this._onPurge) window.removeEventListener('insight:local-purge', this._onPurge); const app = document.querySelector('.app'); if (app) app.style.removeProperty('--accent'); }

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
    return ({ world: 'var(--c-around)', group: 'var(--c-likeness)', duo: 'var(--c-people)' })[this.state.mode];
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
  // A refused edit (D86's one-change-a-minute cooldown) says why on the
  // meta line for a moment instead of silently snapping back.
  holdNote(id) {
    clearTimeout(this._ehT);
    this.setState({ editHold: id });
    this._ehT = setTimeout(() => this.setState({ editHold: null }), 2600);
  }
  // ONE vote path for every ask shape — D305 gave the daily two (the
  // option column and the rating scale row), and two copies of this is
  // how they drift. D86: after a hold-to-change the server still holds
  // the old vote — LIVE.vote is create-only, so a re-pick routes through
  // editVote. A false return (unacked write, or the 60s cooldown) keeps
  // the standing pick and says why on the meta line.
  castVote(S, optId) {
    let next = optId, moved = true;
    const L = S.live ? LIVE : null;
    if (L) {
      const prior = L.myVotes()[S.id] || null;
      if (prior == null) L.vote(S.id, next);
      else if (prior === next) moved = false; // re-picked the standing vote: nothing to say
      else if (!(L.editVote && L.editVote(S.id, next))) { next = prior; moved = false; this.holdNote(S.id); }
    }
    if (moved) { this.syncToMap(S, next); this.showMapToast(S.id); }
    // The consequence beat animates SIDES; ten steps of one scale are not
    // sides, so a rating goes straight to its result (D305).
    this.setState(s => ({ votes: { ...s.votes, [S.id]: next }, repick: null, filter: 'all', beat: (moved && this.props.beats !== false && window.ConsequenceBeat && S.type !== 'rating') ? S.id : null }));
  }
  mapBranch(S) {
    const s = DAILYSPLIT_DQ_SYNC[S.id];
    if (s) {
      const q = DAILYQ.questions.find(x => x.prompt === s.prompt);
      if (q) return DAILYQ.categoryPath(q)[0];
    }
    // THE LIVE ARM, and it has to come before the two demo maps below.
    // A live daily carries its subject in `branch` (D100) — one of the
    // fourteen CAT_META keys the Map is drawn from, so it is always a real
    // branch and never needs translating. The demo deck literal in this
    // file carries `region`/`cat` instead, and NOTHING writes either onto a
    // live question: `buildS` (data/deck.ts) emits no `region` at all, and
    // sets `cat: q.topic` — which the generator fills with the TONE for the
    // daily surface (`topic: q.tone`, gen-v2content.mjs), so it is
    // "light"/"deep"/"blend" and matches no key in `byCat` either.
    //
    // So before this arm existed, all three lines below missed on every
    // live daily and the `|| 'Interests'` fired for all 130 of them. That
    // is not a vague catch-all: 'Interests' is one of the fourteen, home to
    // 8 bank questions, so the toast named a real branch the answer was not
    // filed under — for the other 122. Silent, plausible, and wrong, which
    // is the same shape as D296's retired predicate.
    if (S.branch) return S.branch;
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
    const R = WF_REPORT;
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
    this.setState({ cats: next, idx: 0, earlierOpen: false, feedOpen: false, tab: null, condensed: false, filter: 'all' });
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
    if (m === 'world') { this.setState({ idx: i, repick: null, filter: 'all', draft: '', feedOpen: false, tab: null, earlierOpen: false, condensed: false }); const sc = this.rootEl && this.rootEl.parentElement; if (sc) sc.scrollTop = 0; }
    else this.setState({ idxG: i, repick: null });
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
      // the axis continues past BOTH ends — Mirror past the far one (act,
      // then see), Patterns past the near one (v28 §1; the near exit is
      // the one place outside the tab itself that knows the third tab
      // exists — the exception D166 §1 names). One NAV.goNav read for
      // both, because the coupling meter (rule 4) counts occurrences and
      // only moves down.
      //
      // The near end is a REQUEST since D265, not an instruction: the
      // Patterns tab is absent from the bar until the fit can carry it,
      // goNav answers whether it navigated, and a refusal springs back
      // like any other edge. This file deliberately does not learn the
      // gate's condition — it asks the shell, which is the only place
      // that knows.
      if (ni >= MODES.length || ni < 0) {
        if (NAV.goNav(ni < 0 ? 'patterns' : 'mirror')) return;
        spring(); return;
      }
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
    scroller.addEventListener('touchstart', (e) => {
      // A gesture born inside a surface that owns horizontal motion (OWNS_X:
      // the 1v1 rail, feed rows, inputs…) belongs to that surface. Without
      // this, iOS fed the same touches to both — scrolling a rail slid the
      // mode axis under it, and past 1v1 that slide leaves the tab entirely
      // (commit() continues into the Mirror). svg is deliberately NOT skipped
      // here, unlike swipe-back's list: the cards draw roses and day dots in
      // svg, and the axis swipe must keep working across them.
      if (e.target.closest && e.target.closest(OWNS_X)) { dragging = false; return; }
      const t = e.touches[0]; sx = t.clientX; sy = t.clientY; dx = 0; horiz = null; dragging = true; const b = T(); b.style.animation = ''; b.style.transition = 'none';
    }, { passive: true });
    scroller.addEventListener('touchmove', (e) => {
      if (!dragging) return; const t = e.touches[0]; const mx = t.clientX - sx, my = t.clientY - sy;
      if (horiz === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) horiz = Math.abs(mx) > Math.abs(my);
      if (horiz) { e.preventDefault(); dx = mx; const b = T(); b.style.transform = 'translateX(' + (mx * 0.7) + 'px)'; b.style.opacity = String(1 - Math.min(Math.abs(mx) / 520, 0.4)); }
    }, { passive: false });
    const end = () => { if (!dragging) return; dragging = false; if (horiz && Math.abs(dx) > 66 && !navCoasting()) commit(dx < 0 ? 1 : -1); else spring(); };
    scroller.addEventListener('touchend', end); scroller.addEventListener('touchcancel', end);
    let wheelLock = false;
    scroller.addEventListener('wheel', (e) => {
      // same ownership rule as touch: a trackpad scroll inside a rail is the
      // rail's scroll, not a mode change
      if (e.target.closest && e.target.closest(OWNS_X)) return;
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
    // counts) via LIVE; the demo deck below stays as the mock fallback
    // and the offline dev experience.
    const L = LIVE;
    if (L.enabled) {
      // live mode NEVER shows the demo deck — an empty live deck (slow
      // boot, unseeded day) renders a loading card instead of fake data
      return (L.ready && L.deck()) || [];
    }
    const PINK = 'var(--c-around)', VIOLET = 'var(--c-today)', TEAL = 'var(--c-likeness)';
    return [
      { id: 's1', cat: 'culture', region: 'Taste', regionHue: 40, regionBase: 1, text: 'Pineapple belongs on pizza.',
        // D306: the demo daily carries a background where its live twin
        // does, so the About sheet's paragraph arm is visible in mock mode
        bg: 'Hawaiian pizza — ham and pineapple — was invented in 1962 by Sam Panopoulos, a Greek-born cook in Chatham, Ontario, Canada, and named after the brand of canned pineapple he used.',
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
        bg: 'The trolley problem was posed by philosopher Philippa Foot in 1967; Judith Jarvis Thomson later named it and added the famous variants. It tests whether letting harm happen differs from causing it.',
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
        bg: 'No Mars sample has ever reached Earth. NASA’s Perseverance rover has been caching rock since 2021 for a return mission whose design and cost are still being reworked.',
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
  get statDimDefs() { return VOTECUTS.dims(); }
  get statSubs() { return VOTECUTS.subs(this.state.dim); }
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
      // The SAME shape as the return at the end of this method, because
      // render() destructures `{ rootRef, screen }` off whatever comes back.
      // A bare element gave it undefined for both, so the loading card this
      // branch exists to draw never reached the screen and the tab painted
      // an empty div instead \u2014 silently, since destructuring absent keys
      // throws nothing for the ErrorBoundary to catch.
      return { rootRef: (el) => this.setupGestures(el), screen: placeholder };
    }
    const wIdx = Math.min(st.idx, DATA.length - 1), S = DATA[wIdx];
    const myVote = st.votes[S.id], voted = !!myVote;
    const blind = this.props.blindVoting ?? true, revealed = voted || !blind;
    const canChange = this.props.allowChangeVote ?? true, sortMode = this.props.commentSort ?? 'top';
    const counts = S.options.map(o => o.count + (myVote === o.id ? 1 : 0));
    const total = counts.reduce((a, b) => a + b, 0);
    // Largest remainder, not round-then-dump-the-residue. The old rule
    // handed the WHOLE residue to one bucket, which on a many-option daily
    // drew a smaller count taller and gave it the headline numeral: over
    // 200k sampled 6-12 option vectors it inverted 2.36% of them and
    // misplaced the maximum on 1.70%. Both feed straight into the tiles
    // below (`flex: Math.max(rp[i], 9)`) and into which option gets the
    // big numeral (`rp[i] === maxP`).
    const rp = sharePcts(counts);
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
    // No "+" lower bound: since D98 the published count is exact, so a
    // "12+" over an exact 12 would claim an inaccuracy that is not there.
    const liveTotal = total.toLocaleString();
    // Hoisted for the two gates below (the D83 takes row and the demo
    // sheets row): a live build showing the mock fallback to a real user.
    // This used to be a WINDOW read "deliberately — the smoke fixtures
    // drive this branch through the window stand-in", which stopped being
    // true when test/live-fixture.ts started defining its members onto the
    // imported singleton: the global and the export are one object, so the
    // import sees the fixture (its header has the failure that taught it).
    const demoProd = !!LIVE.demoInProd;
    // noCountsYet means the aggregate has not landed yet — after your own
    // blind vote that is "you're first, the trigger is on its way", never
    // "wait for five people" (D98 removed the floor that made it a wait).
    const resultNote = st.editHold === S.id
      // the D86 cooldown, in words \u2014 a silent snap-back reads as a glitch
      ? 'One change a minute \u2014 try again shortly.'
      : (S.live && S.noCountsYet)
      ? 'You\u2019re first \u2014 the count lands in a moment.'
      // "1 vote", but "1+ votes" — the + is a lower bound, so its plural stands
      : liveTotal + (liveTotal === '1' ? ' vote' : ' votes');
    const onReset = () => this.setState(s => { const v = { ...s.votes }; delete v[S.id]; return { votes: v, repick: S.id, filter: 'all', tab: null, feedOpen: false }; });
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
          const on = st.cats[c.id] !== false;
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
    // `S.cat` is a WORLD_TOPICS id on the demo deck and the question's TONE
    // on a live one ("light"/"deep"/"blend"), which matches no topic — so
    // this was undefined for every live daily and the row below degraded to
    // "Asked in · Today". `branch` is the live subject and is what the row
    // is asking for.
    const catLabel = (WORLD_TOPICS_V2.find(c => c.id === S.cat) || {}).label || S.branch;

    // ── the feed: answer today's question, then the feed starts ──
    const feedEnabled = this.props.feed !== false && window.WorldFeed && (!LIVE.enabled || LIVE.feedReady); // live feed (Phase 4) or the demo feed offline
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
        if (WF_REPORT.has(c.key)) {
          if (!this._jr || !this._jr.has(c.key)) return null;
          return h('div', { key: c.key, style: { background: 'var(--surface-2)', border: LINE, borderRadius: 14, padding: '12px 13px', display: 'flex', alignItems: 'center', gap: 10 } },
            h('span', { style: { flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' } }, 'Reported. Hidden from your feed.'),
            h('button', { className: 'press', onClick: () => { WF_REPORT.undo(c.key); this._jr.delete(c.key); this.forceUpdate(); }, style: { border: 'none', background: 'none', padding: '2px 0', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, color: INK, cursor: 'pointer', WebkitAppearance: 'none' } }, 'Undo'));
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
        const youBand = isFriends ? null : VOTECUTS.you(st.dim, st.dimAxis);
        if (isFriends) {
          friendRows = S.friends.map(f => { const o = S.options.find(x => x.id === f.opt); return { name: f.name, init: f.init, color: o.color, textColor: o.textColor, chipLabel: o.label, chipColor: o.color }; });
          const same = S.friends.filter(f => f.opt === myVote).length;
          friendSummary = voted ? same + ' of ' + S.friends.length + ' friends are on your side' : 'How your friends voted';
        } else {
          const cutKey = st.dimAxis ? st.dim + ':' + st.dimAxis : st.dim;
          const gs = VOTECUTS.groups(st.dim, st.dimAxis);
          const key = S.id + ':' + cutKey, ov = this.overrides[key];
          rows = gs.map((g, gi) => {
            let ps;
            if (ov && ov[gi]) ps = [...ov[gi]];
            // Weights rather than counts here (this is the demo cut synthesis),
            // so pct.ts's integer-exactness note does not apply — but Hamilton
            // is monotonic in its input either way, and leaving one copy of the
            // retired rule in this file is how it grows back.
            else { const w = S.options.map((o, oi) => (counts[oi] / total) * (0.55 + this.hash(key + gi + ':' + oi))); ps = sharePcts(w); }
            return { label: g.label, dot: g.color, you: g.label === youBand, p0: ps[0], segments: S.options.map((o, oi) => ({ color: o.color, width: ps[oi] + '%' })) };
          }).sort((a, b) => b.p0 - a.p0);
        }
        const op = sharePcts(counts);
        const many = rows.length > 6;
        const GRID = { display: 'grid', gridTemplateColumns: '96px 1fr', gap: 10, alignItems: 'center' };
        return h('div', { style: col(12) },
          h('div', { style: col(8) },
            h('div', { className: 'h-scroll', ref: (el) => { const sg = 'd|' + st.dim; if (el && this._dSig1 !== sg) { this._dSig1 = sg; VOTECUTS.centerChip(el); } }, style: { display: 'flex', gap: 6, overflowX: 'auto' } },
              this.statDimDefs.filter(dd => !dd.test).map(dd => h('button', { key: dd.id, 'data-on': st.dim === dd.id ? '1' : '0', onClick: () => this.setState({ dim: dd.id, dimAxis: null }), style: { flex: 'none', border: '1px solid ' + (st.dim === dd.id ? INK : 'var(--rule)'), borderRadius: 999, padding: '6px 13px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap', background: st.dim === dd.id ? INK : 'var(--surface-2)', color: st.dim === dd.id ? PAPER : 'var(--ink-2)', WebkitAppearance: 'none' } }, dd.label))),
            h('div', { className: 'h-scroll', ref: (el) => { const sg = 't|' + st.dim; if (el && this._dSig2 !== sg) { this._dSig2 = sg; VOTECUTS.centerChip(el); } }, style: { display: 'flex', gap: 6, overflowX: 'auto' } },
              this.statDimDefs.filter(dd => dd.test).map(dd => h('button', { key: dd.id, 'data-on': st.dim === dd.id ? '1' : '0', onClick: () => this.setState({ dim: dd.id, dimAxis: null }), style: { flex: 'none', border: '1px solid ' + (st.dim === dd.id ? INK : 'var(--rule)'), borderRadius: 999, padding: '6px 13px', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap', background: st.dim === dd.id ? INK : 'var(--surface-2)', color: st.dim === dd.id ? PAPER : 'var(--ink-2)', WebkitAppearance: 'none' } }, dd.label))),
            this.statSubs && h('div', { className: 'h-scroll', ref: (row) => { const sig = st.dim + '|' + st.dimAxis; if (row && this._axSig !== sig) { this._axSig = sig; VOTECUTS.centerChip(row); } }, style: { display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', paddingBottom: 2 } },
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
    // THE SAME TOTAL THE CARD PRINTS, and only when there is one.
    //
    // This summed `o.count` on its own — without the viewer's own vote,
    // which `counts` adds a hundred lines above — so the sheet read
    // exactly one lower than the "N votes" on the card it opens from. And
    // it pushed the row unconditionally, so the first person to answer
    // today saw "1 vote" on the card and "Answers 0" one tap away: a false
    // zero on a live surface, which D1 forbids, contradicting the card
    // behind it. The feed's twin has always guarded the same row with
    // `if (n)`; the daily's is the outlier.
    // D281's promise, kept here too: a card with facts behind it must not
    // wear the label of one without.
    const ctxLabel = S.bg ? 'What you need to know' : 'About this question';
    const ctxRows = [['Asked in', catLabel || 'Today']];
    if (total >= 1) {
      ctxRows.push(['Answers', total >= 1000 ? (total / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(total)]);
    }
    // Through mapBranch, not off `S.region` raw. The translator is right
    // here in this file and line ~970's toast already uses it; this row
    // bypassed it and read a field only the demo deck has, so the sheet and
    // the toast could name different places for the same answer — and on a
    // live daily both said 'Interests' regardless of subject.
    ctxRows.push(['On your map', this.mapBranch(S)]);
    // The background paragraph — D281 gave the feed's `i` this slot, D306
    // gives the daily's the same one: facts and the subject's who/what,
    // never the arguments. Same shape as world-feed's renderContext, down
    // to the hairline over the rows, so the two sheets read as one thing.
    const ctxBody = h('div', { style: { padding: '2px 0 14px', display: 'flex', flexDirection: 'column', gap: 14 } },
      S.bg ? h('p', { style: { margin: 0, fontSize: 15, fontWeight: 500, lineHeight: 1.55, color: INK, textWrap: 'pretty' } }, S.bg) : null,
      h('div', { style: { display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 14, rowGap: 9, alignItems: 'baseline', borderTop: S.bg ? '0.5px solid var(--rule)' : 'none', paddingTop: S.bg ? 14 : 0 } },
        ctxRows
          .map(([k, v]) => h(F, { key: k },
            h('span', { style: { fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap' } }, k),
            h('span', { style: { fontSize: 13.5, fontWeight: 700, color: INK } }, v)))));
    const sheetNode = ((isCtx || (voted && st.tab)) && sheetHost) ? ReactDOM.createPortal(
      h(Sheet, { onClose: closeSheet, closing: this.state.sheetClosing, label: isCtx ? ctxLabel : isComments ? 'Comments' : 'Who voted' },
          h('div', { style: { padding: '10px 18px 8px', display: 'flex', alignItems: 'baseline', gap: 10 } },
            h('span', { style: { fontFamily: BRIC, fontWeight: 800, fontSize: 15, flexShrink: 0 } }, isCtx ? ctxLabel : isComments ? 'Comments' : 'Who voted'),
            h('span', { style: { fontWeight: 600, fontSize: 12, color: 'var(--ink-3)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, S.text),
            h('button', { className: 'tap44', onClick: closeSheet, 'aria-label': 'Close', style: { border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', flexShrink: 0, WebkitAppearance: 'none' } }, '\u2715')),
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
        h('button', { className: 'press tap44', onClick: () => { clearTimeout(this._sheetT); this.setState({ tab: 'ctx', sheetClosing: false }); }, 'aria-label': ctxLabel, style: { flexShrink: 0, width: 20, height: 20, borderRadius: '50%', border: S.bg ? '0.5px solid color-mix(in oklch, var(--ink) 26%, var(--rule))' : '0.5px solid var(--rule)', background: 'transparent', color: S.bg ? 'var(--ink-2)' : 'var(--ink-3)', fontFamily: BRIC, fontSize: 11.5, fontWeight: 800, lineHeight: 1, cursor: 'pointer', WebkitAppearance: 'none', padding: 0 } }, 'i'),
        h(PassiveTag, { q: S, answered: voted })),
      chipRow,
      h('div', { style: { fontFamily: BRIC, fontWeight: 800, fontSize: hier ? 37 : 31, lineHeight: 1.06, letterSpacing: hier ? -1.1 : -0.8, textWrap: 'balance' } }, S.text),
      !voted
        // asking: options size to their content and centre the label — a fixed
        // 236px column left a 22px word floating in a 115px box, reading as a skeleton
        // asking: each side carries its own hue mark and sits left-aligned, so
        // the two rows read as choices rather than two empty boxes
        ? (S.type === 'rating'
          // A ten-step rating as ONE row (D305): ten stacked 56px option
          // buttons filled more than a screen before the question could
          // be answered. The scale is a ramp of the topic's hue — a
          // rotation of distinct hues reads as categories, and a scale is
          // not categories. Same tap, same vote path, same stored
          // optionIdx as the column it replaces.
          ? h('div', { style: { display: 'flex', gap: 5 } },
              S.options.map((o, i) => {
                const t = Math.round((i * 100) / Math.max(1, S.options.length - 1));
                return h('button', { key: o.id, className: 'press', onClick: () => this.castVote(S, o.id), style: { flex: '1 1 0', minWidth: 0, height: 52, border: '1px solid color-mix(in oklch, ' + topicCol + ' ' + (14 + Math.round(t * 0.26)) + '%, var(--rule))', borderRadius: 12, background: 'color-mix(in oklch, ' + topicCol + ' ' + (5 + Math.round(t * 0.22)) + '%, var(--surface-2))', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, color: 'var(--ink)', cursor: 'pointer', WebkitAppearance: 'none', padding: 0 } }, o.label);
              }))
          : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            S.options.map((o, i) => h('button', { key: o.id, className: 'press sd-opt', onClick: () => this.castVote(S, o.id), style: { '--opt': o.color, minHeight: 56, background: 'color-mix(in oklch, ' + o.color + ' 11%, var(--surface-2))', border: '1px solid color-mix(in oklch, ' + o.color + ' 32%, var(--rule))', borderRadius: 15, padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 13, cursor: 'pointer', textAlign: 'left', WebkitAppearance: 'none', boxShadow: 'none', transition: 'background .16s ease, border-color .16s ease' } },
              h('span', { 'aria-hidden': true, style: { width: 9, height: 9, borderRadius: '50%', background: o.color, flexShrink: 0 } }),
              h('span', { style: { fontWeight: 800, fontSize: 21, color: 'var(--ink)', letterSpacing: '-0.025em', textWrap: 'pretty' } }, o.label)))))
        : (st.beat === S.id && window.ConsequenceBeat)
        ? h(window.ConsequenceBeat, { key: 'beat-' + S.id, seed: S.id, options: S.options, pcts: rp, counts, mineIdx: myIdx, height: 320, onDone: () => this.setState({ beat: null }) })
        : h('div', { style: { ...col(11), animation: 'popIn .35s cubic-bezier(0.2,0.8,0.2,1)' } },
            S.type === 'rating'
            // The result as the Map's card draws the same number
            // (mmt-ridge, map-bottom-card.jsx): the average, the spread,
            // your column — not ten stacked tiles taller than the screen
            // (D305). The whole figure carries the tiles' hold-to-change,
            // since there is no "your row" to hold.
            ? (() => {
                const avg = total ? counts.reduce((a, c, i) => a + c * (i + 1), 0) / total : 0;
                const lpEnd = () => { clearTimeout(this._lpT); if (this.state.pressing) this.setState({ pressing: false }); };
                const lp = canChange ? {
                  onPointerDown: () => { clearTimeout(this._lpT); this.setState({ pressing: true }); this._lpT = setTimeout(() => { this.setState({ pressing: false }); onReset(); }, 550); },
                  onPointerUp: lpEnd, onPointerLeave: lpEnd, onPointerCancel: lpEnd,
                  onContextMenu: (e) => e.preventDefault(),
                  title: 'Hold to change your vote',
                  'aria-label': 'You said ' + (myIdx + 1) + '. Hold to change it.',
                } : {};
                return h('div', { ...lp, style: { display: 'flex', flexDirection: 'column', gap: 9, padding: '2px 2px 0', transform: st.pressing ? 'scale(0.985)' : 'none', transition: 'transform .45s cubic-bezier(0.2,0.8,0.2,1)', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', cursor: canChange ? 'pointer' : 'default' } },
                  h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
                    h('span', { style: { fontFamily: BRIC, fontWeight: 800, fontSize: 30, letterSpacing: '-0.04em' } }, avg ? (Math.round(avg * 10) / 10).toFixed(1) : '—'),
                    h('span', { style: { fontWeight: 700, fontSize: 12.5, color: 'var(--ink-3)' } }, '/ ' + S.options.length + ' average'),
                    myIdx >= 0 && h('span', { style: { marginLeft: 'auto', fontWeight: 700, fontSize: 12.5, color: 'var(--ink-2)' } }, 'you said ' + (myIdx + 1))),
                  h(RatingRidge, { counts, mine: myIdx, color: topicCol, height: 64 }));
              })()
            : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 7, height: sdSplitStageH(S.options.length) } },
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
              st.mapToast === S.id && h('button', {
                // 'you', not 'map'. goTab accepts a MIRROR_POP_ID or a TABS
                // id (app-shell.jsx) and 'map' is neither, so this ran
                // closeAll() and returned — the one control in the app that
                // points at the Map did nothing, and the tap read as a dead
                // button rather than an error. Moving the call onto the NAV
                // registry (D248) did not change that: the accept-list is
                // the same one. The Map IS the Mirror's You stop ("fully
                // retracted — you, alone, visualized: the Map lives here",
                // mirror-tab.jsx), so that is the destination the toast was
                // always naming.
                onClick: () => NAV.goTab('you'), style: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--accent, var(--ink-2))', whiteSpace: 'nowrap', animation: 'toastFade 3s ease forwards' } },
                'added to ' + this.mapBranch(S), h('span', { 'aria-hidden': true }, '\u2192')))),
      // The live daily is a world-scope question, so it carries the D83
      // world-takes surface: anonymous, one take per person, enforced
      // moderation behind it. Suppressed in the demoInProd fallback — that
      // is a REAL composer, and mounting it under mock results would post
      // real words against a question whose numbers are furniture.
      // Collapsed until asked for: the panel's mount is its one fetch, so
      // the toggle is also the cost gate. (demoProd is hoisted from the
      // demo row below — one read, two gates, ratchet flat.)
      S.live && !demoProd && voted && st.beat !== S.id && h('div', { style: { display: 'flex', flexDirection: 'column', gap: 10, marginTop: 2 } },
        // Two doors, side by side, the same pair the demo card has offered
        // all along (D171). "Who voted" opens the LIVE panel — real cohort
        // cells, percentages, and names only under Friends — never the
        // hash-built sheet below, which stays demo-only.
        h('div', { style: { display: 'flex', gap: 10, justifyContent: 'center' } },
          h('button', { className: 'press', 'aria-expanded': st.liveTakes === S.id, onClick: () => this.setState(s => ({ liveTakes: s.liveTakes === S.id ? null : S.id, liveStats: null })), style: icoBtn(st.liveTakes === S.id) },
            svgI('<path d="M6.5 4.5h11a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H11l-4 3.8V15h-.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/>', 17),
            'Takes'),
          h('button', { className: 'press', 'aria-expanded': st.liveStats === S.id, 'aria-label': 'Who voted what', onClick: () => this.setState(s => ({ liveStats: s.liveStats === S.id ? null : S.id, liveTakes: null })), style: icoBtn(st.liveStats === S.id) },
            svgI('<path d="M5 19.5V13M12 19.5V5.5M19 19.5V10"/>', 17),
            'Who voted')),
        st.liveStats === S.id && h(React.Suspense, { fallback: null },
          // kind: a rating's sheet reads as averages, not option rows (D305).
          h(LiveBreakdownPanel, { qid: S.id, options: S.options.map(o => o.label), mine: myIdx, kind: S.type })),
        // The daily's options in the question's own order, so each take
        // carries its author's side and the list can be filtered by side
        // (D149). Same order the aggregate's cells are keyed in, which is
        // what lets the badge and the split agree.
        // null fallback, not a spinner: the chunk is on the phone's own
        // disk by the time anyone taps Takes, and a spinner that shows for
        // one frame reads as a stutter. Same posture as mirror-tab's
        // Suspense boundaries.
        st.liveTakes === S.id && h(React.Suspense, { fallback: null },
          h(LiveTakesPanel, { gid: 'world', qid: S.id, options: S.options.map(o => o.label) }))),
      // D1: NAMED comments and who-voted identities stay circle-scoped —
      // these sheets are the demo's, with seeded named people, so they are
      // demo-only and also suppressed when a live build is showing the mock
      // fallback to a real user (demoProd), where the seeded named people
      // would read as real.
      voted && st.beat !== S.id && !S.live && !demoProd && h('div', { style: { display: 'flex', gap: 10, justifyContent: 'center', marginTop: 2, animation: 'popIn .35s cubic-bezier(0.2,0.8,0.2,1)' } },
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
            key: q.id, className: 'press tap44 is-tight', onClick: () => this.jumpTo(i), title: q.text,
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
      // The pulses due today (D139, roster at D203): the fixed instruments
      // on the World day, compact, beside the blind daily — same contract
      // (answer before you see anyone), one hue, and the trends reading
      // opens from each card itself.
      //
      // DUE, not all five. A pulse's cadence decides whether it is asked
      // at all today, so an "off" or weekly one simply is not here — no
      // tray, no block, nothing pinned above the feed saying what you are
      // not being asked. On the default roster that is one card most days
      // and three on a Sunday, which is why they sit in flow rather than
      // in a container that would have to justify its own emptiness.
      ...PULSE.dueToday().map((pid) => h(PulseCard, { key: 'pulse-' + pid, pid })),
      sheetNode,
      feedNode);

    // ===== GROUP & 1v1 — daily-cadence bodies live in their own files =====
    // Live mode swaps the demo duel bodies for the real panel (create /
    // join / sealed votes / reveals); the demo stays for offline dev.
    //
    // LAZY since D156, and an import rather than a window lookup. The panel
    // is two of this tab's three modes and none of its first paint — World
    // is what opens — so a static import spent the rail, the marks, the
    // reveal bars and (through it) the whole takes panel on every boot that
    // never left World. Suspense fallback is null for the same reason
    // LdReveal's is: the chunk lands in the same frame as the mode switch on
    // anything but a cold first tap, and a flashed spinner reads as a
    // stutter.
    const liveDuels = LIVE.enabled;
    const lazyDuel = (key, m) => h(React.Suspense, { key, fallback: null }, h(LiveDuelPanel, { mode: m }));
    const groupBody = liveDuels ? lazyDuel('live-group', 'group') : h(GroupDailyBody, { key: 'group-daily' });
    const duoBody = liveDuels ? lazyDuel('live-duo', 'duo') : h(window.DuoBody || 'div', { key: 'duo-daily' });

    // ===== chrome =====
    // DEMO ONLY, and the gate is the same one three lines up. DUELS is the
    // prototype's store: groupsPending() counts four hardcoded groups and
    // pendingDuos() eight seeded partners, and the only writers that can
    // lower either — answerGroup/answerDuo — are called from
    // group-daily.jsx and duo-daily.jsx, the demo bodies live mode never
    // mounts. So without this gate every live install wore a permanent
    // "something waiting" dot on Circle and 1v1, on day one, for a queue
    // that does not exist and cannot empty. The D51 purge does not clear
    // it either: duels-data.js's listener resets to normalize({}), which
    // IS the 4/8 state.
    //
    // A live count would be a feature, not a fix — nothing on LIVE.social
    // computes "duels you have not answered today" — so live mode draws
    // NOTHING here rather than a number it cannot mean. D1: where a live
    // surface shows nothing, the data is absent.
    const pendG = liveDuels ? 0 : DUELS.groupsPending();
    const pendD = liveDuels ? 0 : DUELS.pendingDuos();
    const badges = {
      group: mode !== 'group' && pendG ? String(pendG) : null,
      duo: mode !== 'duo' && pendD ? String(pendD) : null,
    };
    const body = mode === 'world' ? worldBody
      : mode === 'group' ? groupBody : duoBody;

    return {
      rootRef: (el) => this.setupGestures(el),
      // the ruler is the mode switcher (v28 §10 settled the nav) — in flow,
      // docking into the header once scrolled past
      screen: h(F, null, this.dailyRuler(mode, accents, badges),
        // the sliding surface — swipes translate this, not the whole page
        h('div', { ref: (n) => { this.bodyEl = n; }, style: { display: 'flex', flexDirection: 'column', gap: 13, flex: 1, willChange: 'transform' } }, body),
        // quiet footer — the ask-a-question door (the paid path, D288 §1)
        h('button', { onClick: () => NAV.openSuggestions(), style: { alignSelf: 'center', marginTop: 4, padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' } }, 'Have a question in mind? ', h('span', { style: { color: 'var(--accent)' } }, 'Ask it \u2192'))),
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


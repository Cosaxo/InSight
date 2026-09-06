// Ported from design/spec-modules/world-feed.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import NAV from '../data/nav';
// R2/D270: the anonymous feature tally — a no-op until initLive arms it.
import * as engagement from '../data/engagement';
import { SUBTOPICS, WORLD_BG } from './world-subtopics.js';
import { LENSES, LENS_FEED_QS } from './lens-defs.js';
import { FEEDREAD, feedInsight } from './feed-read.js';
import { WF_REPORT } from './world-feed-report.js';
import { WORLD_FEED_COMMENTS } from './world-feed-comments.js';
import { TEST_FEED_QS } from './test-feed-data.js';
// …and which pool this BUILD gets. The import above is the demo one; a
// live build's bank items arrive through data/testFeed.ts, which is where
// the story of why that is not a `window` read lives (D280).
import { testFeedPool } from '../data/testFeed.ts';
import { WORLD_CHANNELS, WORLD_TOPICS } from './world-feed-data.js';
import PLACES from '../data/places';
import { FILMS, ARTISTS, ATHLETES, EMOJI } from '../data/catalogs';
import POKEDEX from '../data/pokedex';
// The live who-voted sheet, cohort-first (D125) — it owns the cohort
// choice, the split drawn for it and the named roster underneath, which
// used to be three panels stacked here.
//
// An ordinary import, not a globalThis lookup: D39's ratchet only moves
// down, and this panel's one consumer is this file. Static rather than
// listed in spec-index on purpose — world-feed is deferred past first
// paint (D25), so importing it here keeps it in the deferred chunk
// instead of pulling it into the first-paint bundle.
import LiveBreakdownPanel from '../ui/LiveBreakdownPanel';
import PickTiles from '../ui/PickTiles.tsx';
// The pick board's size — deck.ts's pinned twin of the server's
// CANON_TOP_N (vote.test.ts holds all three equal). An import for D39's
// reason above: live.ts already carries deck.ts in the entry graph, so
// referencing it from this deferred chunk costs nothing and the meter
// never counts it.
import { CANON_BOARD_N } from '../data/deck';
import { WPAL } from './world-palette.js';
import { HAPTIC } from './haptics.js';
import { WF_CATALOGS } from './world-catalogs.js';
import { LEARN } from './learn-progress.js';
import { LEARN_COUNTS, LEARN_ORDER, LEARN_RATE, LEARN_SPLIT, LEARN_SPLIT_SRC } from './learn-data.js';
import { SCENES } from './scenes.js';
import { VOTECUTS } from './vote-cuts.js';
import { LEARN_FEED } from './learn-feed.js';
import { WF_COUNTERS, WF_TAKE_SIG } from './world-feed-counters.js';
import { PICKS } from './pick-data.js';
import { PLACESTATS } from './place-stats.js';
import { Sheet } from './primitives.jsx';
// The feed's cadence arithmetic — extracted so the test exercises THIS loop
// rather than a copy of it (D11's claim, D42's citation; see the module).
import { interleaveFeed, partitionAnswered } from '../data/feed-interleave.ts';
import { SPONSOR_AT, partitionSponsored } from '../data/sponsored.ts';
import { askWindow } from '../data/askWindow.ts';
import { utcDayIndex } from '../data/deck.ts';
import SponsorMark from '../ui/SponsorMark.tsx';
import AdCard from '../ui/AdCard.tsx';
import { deferUntil, isDeferred, pruneDeferred } from '../data/deferQueue.ts';
// "Somebody asked for the topic list" (D190). The profile's scenes card is
// the caller; this file owns the list, so this file is what answers.
import { consumeTopicSheet, subscribeTopicSheet } from '../data/topicSheet.ts';
// The live world-takes surface (D83) — an ordinary ESM import of the typed
// panel, like the data imports above, so the D39 coupling meter stays flat.
import LiveTakesPanel from '../ui/LiveTakesPanel.tsx';
// Reveal-name stores for the two newest pick domains — ESM imports, same
// coupling-meter reasoning. The three legacy stores stay window.* reads
// below (in the D39 baseline); convert them on touch, never re-add one.
import ELEMENTS_CATALOG from '../data/elements.ts';
import { COUNTRIES, DOGS, COLORS, LANGUAGES } from '../data/catalogs.ts';
// Imported rather than read off window — same meter reasoning as the
// imports above. Every LIVE read in this file goes through this binding
// since D354. The `window.LIVE &&` existence guards it took with it were
// load-order guards an import makes unreachable; the member-existence
// guards (`L.myVotes ? … : null`, `L.editVote && …`) guarded methods the
// store's literal always defines (the surface pin in data/vote.test.ts).
// The data conditions — `.enabled`, `.demoInProd` — stayed.
import LIVE from '../data/live.ts';
import ReactDOM from 'react-dom';
// D354's sweep: the feed's own group members and the eager passive tag as
// imports. learn-bits and learn-social ride this same chunk (loadWorldFeed
// lists them ahead of this file), consequence-beat too; PickSearch is the
// pick card's typed picker. Every `window.X ?` beside these was a
// load-order guard, and there is no frame in which an import is unset.
import { PassiveTag } from './passive-meter.jsx';
import { LMStreak, LMFriends } from './learn-bits.jsx';
import { ConsequenceBeat } from './consequence-beat.jsx';
import { LEARN_SOCIAL } from './learn-social.js';
import PickSearch from '../ui/PickSearch';
import { PASSIVE } from './passive-progress.js';
// Crossroads (D136). Imported, not read off window — rule 4 refuses new
// coupling. The ESM graph carries it and its store into THIS chunk, which
// is the deferred feed group (spec-index.js), so neither reaches first
// paint; check:bundle's eager ceiling has no headroom for either.
import { PathsCard } from './paths-card.jsx';
// …and the store directly, for one read: answered() must know whether a
// walk is finished, which for a DEMO story lives nowhere but here (a live
// walk is a vote and rides the ordinary answer plumbing).
import { PATHS } from './paths-data.js';
import LiveReadGame from '../ui/LiveReadGame.tsx';
// The app's ONE rounding rule (D277). Three splits in this file computed
// their own — round each share, dump the residue on the largest bucket —
// which is the rule pct.ts retired for drawing a smaller count at a larger
// percentage.
import { sharePcts } from '../data/pct.ts';
// What the BANK holds per topic, where a live build has published it —
// the topic sheet's count. See its use for why the pool cannot answer.
import { feedTopicTotal } from '../data/bankPager.ts';
import {
  wfCarried, wfCatArt, wfFeedMatch, wfFmt, wfHash, wfKnowBias, wfKnowRate,
  wfPcts, wfPickGroup, wfRateAvg, wfRateBg, wfRateInk, wfShadeText, wfStreamMix,
  wfTileArt, wfTint,
  wfVotesOf,
  wfAnsweredOf,
} from './world-feed-math.js';

// world-feed.jsx — the question feed under the World daily. Answer today's
// question and the feed starts: dilemmas, this-or-thats, rankings and image
// duels from the scenes you follow (SCENES — the same list the Mirror orbit
// manages) plus the always-on channels. Chips = your scenes as filter.
// One hue per topic; results encode as bar length, not numbers-everywhere.

const WF_LS = 'insight.feedVotes.v1';
const WF_REPLIES_LS = 'insight.feedReplies.v1';
const WF_TAKES_LS = 'insight.feedTakes.v1';
const WF_PASS_LS = 'insight.feedPass.v1';
// The deferral list (D121) — id → when it may be served again. Its own key
// rather than a value shape inside the pass list, because the two answer
// different questions: a pass is "not this one" and holds forever, a
// deferral is "not now" and expires.
const WF_DEFER_LS = 'insight.feedDefer.v1';
// where a vote lands on your Mirror — the ripple line after answering
const WF_BRANCH = { food: 'Food', sport: 'Body', movies: 'Taste', music: 'Taste', tech: 'Mind', culture: 'Values', dilemma: 'Morals', event: 'Mind', people: 'Values', bigq: 'Values', fav: 'Taste' };
const WF_TOPICS = WORLD_TOPICS;
const WF_TOPIC = Object.fromEntries(WF_TOPICS.map((t) => [t.id, t]));
const WF_CHANNELS = WORLD_CHANNELS;
const WF_CHAN_SET = Object.fromEntries(WF_CHANNELS.map((id) => [id, true]));
// second level of the tree: colour comes from the parent topic, label from the leaf
const WF_SUB = (id) => (id ? SUBTOPICS.get(id) : null);
// background knowledge, only where a question can't be answered honestly without it
const WF_BGTEXT = (q) => (q && (q.bg || WORLD_BG[q.id])) || null;
const WF_LINE = '1px solid color-mix(in oklch, var(--rule), transparent 25%)';

// ── the mounted window (D136) ──
//
// The feed runs hundreds of cards long and every one of them is a real
// component — vote rows, SVG textures, a takes sheet, a beat. Mounting the
// whole list costs on every scroll frame forever, for cards nobody has
// scrolled to. So the list mounts a WINDOW that grows as its tail comes
// into range, and never shrinks: collapsing a card you have already
// answered would move the scroll position under your thumb.
//
// WF_REACH is deliberately generous. It is the distance from the bottom at
// which the next page is added, and at 2200px it is roughly two screens of
// headroom — the window grows well before you can see its edge, so there is
// no spinner, no placeholder, and nothing to notice. A tight value here is
// what makes windowing feel like loading.
const WF_PAGE = 8;
const WF_STEP = 4;
const WF_REACH = 2200;

// Know answers do NOT persist in WF_LS (D95). Their cross-session record is
// LEARN's own store — state, streaks, positions — and LEARN_FEED re-serves a
// card exactly when answering it again should count. A vote mirrored here
// outlived the serve, so a re-served card rendered frozen in a previous
// sitting's reveal: streaks unreachable, check-ins unanswerable. Stripped on
// load (healing what older builds persisted) and on save (state.votes keeps
// them in memory for this sitting's reveals, and every save spreads state).
function wfStripKnow(v) {
  const out = {};
  for (const k in v) if (k.indexOf('lrn-') !== 0) out[k] = v[k];
  return out;
}

function wfLoad() {
  try { const v = JSON.parse(localStorage.getItem(WF_LS) || '{}'); return v && typeof v === 'object' ? wfStripKnow(v) : {}; }
  catch (e) { return {}; }
}

function wfSave(votes) {
  try { localStorage.setItem(WF_LS, JSON.stringify(wfStripKnow(votes))); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Best-effort — in-memory state stays correct. */ }
}

function wfLoadReplies() {
  try { const v = JSON.parse(localStorage.getItem(WF_REPLIES_LS) || '{}'); return v && typeof v === 'object' ? v : {}; }
  catch (e) { return {}; }
}
// small id->value maps kept in localStorage (the skip pass list)
function wfLoadMap(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}

function wfLoadTakes() {
  try { const v = JSON.parse(localStorage.getItem(WF_TAKES_LS) || '{}'); return v && typeof v === 'object' ? v : {}; }
  catch (e) { return {}; }
}
function wfVotes(q) { return wfVotesOf(q, (WF_CATALOGS[q.catalog] || {}).picks || 0); }




// count-up for revealed percentages — runs only right after your vote
function WfCount({ to, animate, dur = 650, delay = 180 }) {
  const [v, setV] = React.useState(animate ? 0 : to);
  React.useEffect(() => {
    if (!animate || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { setV(to); return; }
    let raf, t0;
    const step = (t) => { if (!t0) t0 = t; const k = Math.min((t - t0) / dur, 1); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    // hold at 0 for the shared stagger (--rv-2), so the digits start with the
    // chips rather than ahead of the bars they're describing
    const hold = setTimeout(() => { raf = requestAnimationFrame(step); }, delay);
    return () => { clearTimeout(hold); cancelAnimationFrame(raf); };
    // `dur` and `delay` are deliberately not dependencies: they are the run's
    // own timing, read once when it starts. Including either would restart a
    // count-up mid-flight whenever the caller passed a new one, which is the
    // opposite of what a duration means.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, animate]);
  return <span>{v}</span>;
}

// ── who-voted breakdowns ── one topic hue; option = shade strength, so sides
// stay readable without a second palette. Splits derive deterministically from
// sides get distinct hues rotated off the topic's — one lightness+chroma tier,
// the same family the daily uses, so the feed and the daily read as one product
// A live card whose aggregate has not landed — so there is no split, and
// anything that DRAWS one is drawing your own vote back at you as the
// crowd. Written out by hand at three sites in this file and a fourth in
// daily-split.jsx, and the consequence beat was the copy that never got
// written: it replayed 100% on your own option with "you're with them"
// under it, on the one card that has nothing to be with.
function wfNoCrowd(q) { return !!(q.live && q.noCountsYet); }

function wfOpt(color, i, n) { return WPAL.opt(color, i, n); }
function wfShade(color, i, n) { return WPAL.opt(color, i, n, true); }
// every who-voted cut in one place (vote-cuts.js): demographics, then the four
// tests — each opening into its own subvalues, the same axes the Circle map uses
// Imported since D246, so the load-order guards these four carried are
// gone: an imported binding cannot be unset, and VOTECUTS is an IIFE that
// always returns its object. The fallbacks they guarded with — a
// hand-written `friends` dim, `null`, `[]` — were the shapes D108 names as
// dead on a converted module, and the first was also a partial rewrite of
// what `dims()` returns anyway.
const WF_CUTS = () => VOTECUTS.dims();
// Knowledge questions take a NARROWER set of cuts than opinions do. “Who voted
// this way” by gender is a fact about identity; “who got this wrong” by gender is
// a claim about competence, and that is not a chart this app should draw. What
// legitimately explains knowing a fact: what you studied, what you do, how old
// you are, where you live — so those, and nothing else.
const WF_KNOW_CUTS = ['friends', 'age', 'edu', 'job', 'where'];
const WF_SUBS = (dim) => VOTECUTS.subs(dim);
const WF_GRP = (dim, ax) => VOTECUTS.groups(dim, ax);
const WF_CUTKEY = (dim, ax) => (ax ? dim + ':' + ax : dim);
const WF_YOU = (dim, ax) => VOTECUTS.you(dim, ax);
// The live breakdown dimensions used to be listed here as WF_LIVE_DIMS, a
// hand-kept copy of BREAKDOWN_DIMS (functions/src/pure.ts). D125 moved the
// live sheet into ui/LiveBreakdownPanel, which reads COHORT_DIMS from
// data/cohort.ts — one list, typed, already shared with the Mirror's
// lenses, and one fewer place for the client's idea of the dimensions to
// drift from the server's.

// Bucket keys are stored canonically so that one cohort is one key
// worldwide — `country` is the ISO code and `city` is "Oslo, NO" (D9). That
// is the right thing to STORE and the wrong thing to show, so it is turned
// back into a name here, in the reader's own language via Intl.
function wfBucketLabel(dim, bucket) {
  const P = PLACES;
  if (!P) return bucket;
  if (dim === 'country') return P.countryName(bucket);
  if (dim === 'city') {
    const p = P.parse(bucket);
    return p ? P.label(p) : bucket;
  }
  return bucket;
}

// FLIP list for the rank cards: rows slide to their new slot when the order
// changes (same .3s curve as the rest of the feed). Only animates on a real
// reorder — parent re-renders and scrolls don't trigger phantom slides.
function WFFlipList({ rows, order, gap }) {
  const els = React.useRef(new Map());
  const tops = React.useRef(new Map());
  const prevSig = React.useRef('');
  React.useLayoutEffect(() => {
    const sig = order.join(',');
    const changed = prevSig.current && prevSig.current !== sig;
    els.current.forEach((el, k) => {
      if (!el) return;
      const nt = el.getBoundingClientRect().top;
      const pt = tops.current.get(k);
      if (changed && pt != null && Math.abs(pt - nt) > 1) {
        el.style.transition = 'none';
        el.style.transform = 'translateY(' + (pt - nt) + 'px)';
        requestAnimationFrame(() => { el.style.transition = 'transform .3s cubic-bezier(0.2,0.8,0.2,1)'; el.style.transform = 'translateY(0)'; });
      }
      tops.current.set(k, nt);
    });
    prevSig.current = sig;
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {rows.map((r) => <div key={r.key} ref={(el) => { if (el) els.current.set(r.key, el); else els.current.delete(r.key); }}>{r.node}</div>)}
    </div>
  );
}
// Each demo friend carries an identity hue and an activity share
// (2026-08-26). A friend appears on a question ONLY if wfDid says they
// answered it — most cards carry 0–2 friends, many carry none, and that
// silence is what keeps friend marks from becoming furniture. The hues
// are identity, not sides: a full-strength fill carrying #fff, so every
// use routes through WPAL.ink (the palette gate, D189).
const WF_FRIENDS = [
  { name: 'Alex', init: 'A', hue: 'oklch(0.55 0.1 40)', act: 0.5 },
  { name: 'Mia', init: 'M', hue: 'oklch(0.55 0.1 325)', act: 0.42 },
  { name: 'Jordi', init: 'J', hue: 'oklch(0.55 0.1 235)', act: 0.34 },
  { name: 'Sara', init: 'S', hue: 'oklch(0.55 0.1 150)', act: 0.26 },
  { name: 'Noah', init: 'N', hue: 'oklch(0.55 0.1 275)', act: 0.2 },
  { name: 'Elif', init: 'E', hue: 'oklch(0.55 0.1 85)', act: 0.14 },
];
const wfDid = (q, f) => wfHash('did:' + q.id + ':' + f.name) < f.act;
// one friend as a small identity avatar; k > 0 overlaps leftward
const wfFrAv = (f, D, k) => (
  <span key={f.name} title={f.name} style={{ width: D, height: D, borderRadius: '50%', marginLeft: k ? -Math.round(D * 0.28) : 0, flexShrink: 0, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: Math.round(D * 0.56), background: WPAL.ink(f.hue), color: '#fff', boxShadow: '0 0 0 1.5px var(--surface)', position: 'relative', zIndex: 4 - k }}>{f.init}</span>
);
const wfFrNone = (txt) => <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', padding: '18px 0' }}>{txt}</div>;

// The nine shapes a feed card can take, in the words a reader would use.
// Drawn in the kicker beside the topic (2026-09-02) — a card announces
// what it is asking for rather than making you discover it on tap.
const WF_FORM_WORD = {
  duel: 'this or that',
  rank: 'rank',
  rate: 'rate',
  dial: 'dial',
  field: 'place it',
  know: 'learn',
  pick: 'pick one',
  predict: 'predict',
  read: 'read the room',
};

class WorldFeed extends React.Component {
  state = { votes: wfLoad(), knowRes: {}, pickQ: {}, pending: {}, open: {}, panels: {}, dims: {}, cutAxis: {}, boosts: {}, vh: 0, beat: null, sheet: null, sideFilter: null, reportFor: null, replyTo: null, replies: wfLoadReplies(), myTakes: wfLoadTakes(), minds: {}, ctrIdx: {}, takeSort: 'mind', whyFor: null, headHide: false, sort: 'hot', passed: wfLoadMap(WF_PASS_LS), deferred: wfLoadMap(WF_DEFER_LS), ripple: null, liveTakesOpen: {}, editFor: {}, editHold: null, doneOpen: false, shown: WF_PAGE };

  // Feature flags, carried over from the prototype so each idea can be
  // switched off from the host without editing this file. Default ON; the
  // host passes `opts={{ clock: false }}` to silence one.
  get opts() {
    const o = this.props.opts || {};
    const on = (k) => o[k] !== false;
    return {
      ripple: on('ripple'), pass: on('pass'),
      // reveal: the result reads as tiles whose heights are the shares,
      // rather than bars. clock: one card in view carries a ring draining
      // with the day. Both are presentation only — neither shows anything
      // the k-floored aggregate has not already published.
      reveal: on('reveal'), clock: on('clock'),
      // why: a one-line reason captured while the vote is warm, which
      // becomes one of YOUR takes. counter: a take can draw a rebuttal from
      // someone who voted the other way. signals: rank takes by minds moved
      // rather than by votes. crossfire: the strongest take from each side,
      // head to head, above the list. v2: the prototype's result layout —
      // one hue per card and a single footer line under the split.
      //
      // counter/signals/crossfire all touch takes, and takes are demo-only:
      // renderEngage returns the k-floored breakdown alone when q.live, so
      // none of that is reachable on a live card (D1).
      why: on('why'), counter: on('counter'),
      signals: on('signals'), crossfire: on('crossfire'), v2: on('v2'),
      // hier: today's question outsizes the feed's, so the two read as a
      // headline and its stream rather than as one long list.
      hier: !!o.hier,
    };
  }

  // ── snap scrolling: cards arrive one at a time and snap into place ──
  // The tab's scroller gets y-proximity snap while the feed is mounted; each
  // card fills most of the viewport (next one peeking) and snap-aligns to top.
  componentDidMount() {
    this.applySnap(); this._retry = setTimeout(() => this.applySnap(), 400);
    // scenes followed elsewhere (orbit, suggestion card) appear here live
    this._unsubScenes = SCENES.subscribe(() => this.forceUpdate());
    // The topic list, asked for from somewhere else (D190). BOTH halves are
    // needed and neither is redundant: arriving from the Mirror tab mounts
    // this component fresh (the request is waiting, so the mount consumes
    // it), while the profile opened OVER the daily tab leaves it mounted
    // throughout — there `goNav` closes an overlay and switches nothing,
    // and only the subscription fires.
    this._openTopics = () => { if (consumeTopicSheet()) this.setState({ sheet: { panel: 'add' } }); };
    this._openTopics();
    this._unsubTopics = subscribeTopicSheet(this._openTopics);
    // Reconcile with the live store. The feed seeds its votes from
    // localStorage at mount and never looked at LIVE again, so a vote the
    // server REFUSED — LIVE rolls it back and scrubs the WF_LS mirror —
    // kept showing a result split here until the component remounted.
    //
    // Deletion is gated on the id being absent from BOTH the store and the
    // mirror. Absence from myVotes() alone is not evidence of a rollback:
    // during a partial hydrate the store is legitimately incomplete, and
    // trusting it would mass-un-vote the whole feed.
    this._unsubLive = LIVE.subscribe(() => {
        const mine = LIVE.myVotes() || {};
        const mirror = wfLoad();
        this.setState((s) => {
          let changed = false;
          const votes = { ...s.votes };
          for (const id of Object.keys(votes)) {
            // Know entries are not LIVE's to reconcile: a learn answer is
            // never in myVotes, and the WF_LS mirror deliberately drops
            // lrn- keys (D95) — so without this skip, "absent from both"
            // is true of every know reveal on screen and each snapshot
            // notify would wipe the one the user is looking at.
            if (id.indexOf('lrn-') === 0) continue;
            if (mine[id] == null && mirror[id] == null) { delete votes[id]; changed = true; }
          }
          // The store's number is an OPTION INDEX, and for vote-shaped
          // cards that is also what this map holds, so copying it IS the
          // reconcile. Continuum cards (dial/field) hold the drag's own
          // units here — a value on lo..hi, a point {x,y} — while the
          // store holds the 12-bucket index, and copying that number in
          // is what showed "0 cups" for a 1-cup answer (D218): the bucket
          // index wearing the value's clothes, persisted by the next
          // wfSave. For those the bucket ARBITRATES instead: a local
          // value that lands in the store's bucket is a finer reading of
          // the same answer and stays; anything else — no local value
          // (purge refill, another device), an edit made elsewhere, a
          // refused edit the store rolled back, or D218's residue where
          // the bucket math can tell — becomes the bucket's midpoint,
          // exactly the read dialVal/fieldVal derive when only the store
          // knows. Ids the pool cannot name (the daily deck's, a bank the
          // demo pool has not been replaced by yet) keep the plain copy:
          // the feed never renders them, so the index is as good a marker
          // of "answered" as it ever was.
          const byId = {};
          this.feedPool().forEach((q) => { byId[q.id] = q; });
          for (const [id, v] of Object.entries(mine)) {
            const n = Number(v);
            if (Number.isNaN(n)) continue;
            const q = byId[id];
            const local = votes[id];
            if (q && q.type === 'dial') {
              if (typeof local === 'number' && local >= q.lo && local <= q.hi && this.dialBucket(q, local) === n) continue;
              // Shown, not mid: this value is persisted and read back as a
              // raw drag on the next boot, so it has to be one the card can
              // print without leaving its own bucket.
              votes[id] = this.dialBucketShown(q, n); changed = true;
            } else if (q && q.type === 'field') {
              if (local && typeof local === 'object' && this.fieldCell(local.x, local.y) === n) continue;
              votes[id] = this.fieldCellMid(n); changed = true;
            } else if (q && q.type === 'pick') {
              // The store's number is the ENTITY KEY (D14) and the card
              // keeps it wrapped ({ entity }, setPick's shape) — the plain
              // copy below would put a dex number where an option index
              // belongs and renderPick would read v.entity as undefined.
              if (local && typeof local === 'object' && Number(local.entity) === n) continue;
              votes[id] = { entity: n }; changed = true;
            } else if (local !== n) { votes[id] = n; changed = true; }
          }
          return changed ? { votes } : null;
        });
      });
    this._unsubSubs = SUBTOPICS.subscribe(() => this.forceUpdate());
    this._unsubLearn = LEARN.subscribe(() => this.forceUpdate());
    this._unsubLF = LEARN_FEED.subscribe(() => this.forceUpdate());
    // The purge (data/live.ts, D51): this component PERSISTS four of its
    // maps (votes, passed, takes, replies) by spreading state back to the
    // keys the purge just removed — and it stays mounted across a uid
    // change, so without this drop the previous account's maps survive on
    // screen and one interaction writes them back. votes clears too and the
    // LIVE reconcile above refills it for the new uid; knowRes and pickQ
    // are this-session answer echoes of stores that drop themselves.
    this._onPurge = () => {
      // The unanswered-first stickiness cache goes with the maps: it holds
      // the OLD account's answered-ness, and a new account inheriting it
      // would open on a feed sorted by someone else's history.
      this._sunk = null;
      this.setState({ votes: {}, passed: {}, deferred: {}, myTakes: {}, replies: {}, knowRes: {}, pickQ: {}, editFor: {}, editHold: null });
    };
    window.addEventListener('insight:local-purge', this._onPurge);
    // entrance: each card rises as it first scrolls into view (transform-only)
    //
    // …and that first intersection is also the tally's "seen" (R2/D270):
    // one count per card per mount, because the observer unobserves after
    // firing. Deliberately the entrance event rather than ATTENTION.md
    // §3's ≥50%-for-≥1s refinement — one observer instead of two, and
    // every card gets the SAME definition, so the ratios the fold
    // publishes compare like with like. Tightening the definition is a
    // one-line change here if the coarser read ever misleads.
    this._io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (e.isIntersecting) {
          engagement.note('feedSeen');
          // The per-question half (R4/D271): the ref that observed this
          // element stamped its qid on it, so the same first-intersection
          // is the question's seen denominator. Anonymous-shard only —
          // noteQid never touches the person channel.
          if (e.target._wfQid) engagement.noteQid(e.target._wfQid, 's');
          e.target.classList.add('wf-in');
          this._io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' }) : null;
  }
  componentDidUpdate() {
    this.applySnap();
    // Keep the tail stocked without polling. A scroll event is not enough on
    // its own: answering a card COLLAPSES it (the Answered expander, D133),
    // so the list can shrink out from under the viewport with no scroll to
    // react to, and the window would then never grow again. Debounced,
    // because this runs after every render the feed does.
    //
    // NO SCROLLER MEANS KEEP MOUNTING. `applySnap` resolves the scroller by
    // walking for an ancestor whose computed overflow-y scrolls, and it can
    // come back empty — before layout settles, in a host that styles the
    // shell differently, or under a test environment with no CSS at all.
    // Treating that as "not near the end" would strand the feed at its
    // first page with no event that could ever grow it, and a feed that
    // stops at eight cards looks exactly like a feed that ran out. So an
    // unknown distance grows: the worst case is the un-windowed behaviour
    // this replaced, which is a cost, not a defect.
    const s = this._scroller;
    const near = !s || s.scrollHeight - s.scrollTop - s.clientHeight < WF_REACH;
    if (near && this.state.shown < (this._listLen || 0)) {
      clearTimeout(this._growT);
      this._growT = setTimeout(() => this.setState((st) => ({ shown: st.shown + WF_STEP })), 60);
    } else if (near && s && this._listLen > 0 && this.state.shown >= this._listLen) {
      // Every card is mounted and the bottom is on screen: the feed's end,
      // SCALE-PLAN §2's "what trips first" as a lived event. A day-level
      // bit on the person channel (R3/D272) — idempotent, so firing per
      // update costs nothing.
      engagement.markDepthEnd();
    }
  }
  componentWillUnmount() {
    // The learn-agg prefetch (D125) resolves after an await, so it can land
    // on an unmounted feed — a tab switch mid-fetch is the ordinary case.
    this._mounted = false;
    clearTimeout(this._retry);
    clearTimeout(this._growT);
    clearTimeout(this._sheetT);
    clearTimeout(this._rippleT);
    clearTimeout(this._ehT);
    if (this._unsubScenes) this._unsubScenes();
    if (this._unsubTopics) this._unsubTopics();
    if (this._unsubLive) this._unsubLive();
    if (this._unsubSubs) this._unsubSubs();
    if (this._unsubLearn) this._unsubLearn();
    if (this._unsubLF) this._unsubLF();
    if (this._onPurge) window.removeEventListener('insight:local-purge', this._onPurge);
    if (this._io) this._io.disconnect();
    const sc = this._scroller;
    if (sc && this._onScroll) sc.removeEventListener('scroll', this._onScroll);
  }
  applySnap() {
    const el = this._root; if (!el) return;
    // re-resolve every pass — the real scroller (tab-swap) may only overflow
    // after mount; prefer the ancestor that actually scrolls over the first
    // overflow-y ancestor (app-body, which never overflows here).
    let p = el.parentElement, first = null, real = null;
    while (p) {
      if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) {
        if (!first) first = p;
        if (!real && p.scrollHeight > p.clientHeight + 4) real = p;
      }
      p = p.parentElement;
    }
    const next = real || first;
    if (next !== this._scroller) {
      const old = this._scroller;
      if (old) {
        if (this._onScroll) old.removeEventListener('scroll', this._onScroll);
      }
      this._scroller = next;
      if (next) {
        this._lastY = next.scrollTop;
        if (!this._onScroll) {
          // the feed header hides while you scroll down, slides back on scroll up
          this._onScroll = () => {
            const s = this._scroller; if (!s) return;
            const y = s.scrollTop, dy = y - this._lastY;
            // grow the mounted window as the tail comes into range
            if (s.scrollHeight - y - s.clientHeight < WF_REACH && this.state.shown < (this._listLen || 0)) {
              this.setState((st) => ({ shown: st.shown + WF_STEP }));
            }
            if (Math.abs(dy) < 4) return;
            this._lastY = y;
            const hide = dy > 0 && y > 60;
            if (hide !== this.state.headHide) this.setState({ headHide: hide });
          };
        }
        next.addEventListener('scroll', this._onScroll, { passive: true });
      }
    }
    const sc = this._scroller; if (!sc) return;
    // no scroll snap — free scrolling reads better in a long feed
    sc.style.scrollSnapType = ''; sc.style.scrollPaddingTop = '';
    if (sc.clientHeight) {
      // cap to the visible app body — the tab wrapper can be taller than the screen
      const hostEl = sc.closest ? sc.closest('.app-body') : null;
      const vv = hostEl ? Math.min(sc.clientHeight, hostEl.clientHeight) : sc.clientHeight;
      if (vv && vv !== this.state.vh) this.setState({ vh: vv });
    }
  }

  // skip a card. Local only, and it must stay that way: a pass is not an
  // answer (D5, as amended by D86 — the only server write besides the
  // answer itself is an option edit ON an answer), so recording one would
  // either pollute the aggregate or need a second write path per question
  // for something the user asked to ignore.
  setPass(id, on) {
    // Counted OUTSIDE the updater (StrictMode double-invokes updaters in
    // dev), and count only the pass itself, never the un-pass (R2/D270).
    // The qid half (R4/D271) rides the anonymous shard only.
    if (on) { engagement.note('feedPass'); engagement.noteQid(id, 'p'); }
    this.setState((s) => {
      const passed = { ...s.passed };
      if (on) passed[id] = 1; else delete passed[id];
      try { localStorage.setItem(WF_PASS_LS, JSON.stringify(passed)); } catch { /* best-effort */ }
      return { passed };
    });
  }

  // Defer a test or lens question — "not now", and it comes back (D121).
  //
  // Local only, for the same reason a pass is: a deferral is not an answer
  // (D5), so recording one would either pollute the aggregate or need a
  // second write path per question for something the user asked to be
  // shown again later.
  setDefer(id, on) {
    // the setPass rule, same reasons
    if (on) { engagement.note('feedDefer'); engagement.noteQid(id, 'd'); }
    this.setState((s) => {
      const now = Date.now();
      const deferred = pruneDeferred({ ...s.deferred }, now);
      if (on) deferred[id] = deferUntil(now); else delete deferred[id];
      try { localStorage.setItem(WF_DEFER_LS, JSON.stringify(deferred)); } catch { /* best-effort */ }
      return { deferred };
    });
  }

  setVote(q, val) {
    const id = q.id;
    // A selfOnly card (a lens question against a bank with no lens rows —
    // lens-defs.js, D50; the seeded-bank case is live now, D91) has
    // authored counts and no measurement behind them, so every side effect
    // below that reads the "crowd" — the majority bit, the beat, the
    // ripple's Mirror claim, the why-prompt — would be fabricated. The lens
    // record itself still happens: that write is the card's whole point.
    const selfOnly = !!q.selfOnly;
    // live cards persist to Firestore too (owner-only answer + aggregate).
    // D86: a live card that already holds a server vote routes through the
    // edit path instead — vote() is create-only and would silently no-op,
    // leaving the feed claiming a choice the server never heard. A refused
    // edit (unacked write, or the 60s cooldown) falls back to the standing
    // pick and says why on the meta line. `editing` also mutes the
    // first-vote celebrations below: the beat, the ripple and the reveal
    // haptic are "your vote landed" moments, not "your vote moved" ones.
    let editing = false, refused = false;
    if (q.live && typeof val === 'number') {
      const L = LIVE;
      const prior = L.myVotes()[id];
      if (prior != null) {
        editing = true;
        if (Number(prior) === val) refused = true; // re-picked the standing vote
        else if (!L.editVote(id, String(val))) {
          refused = true;
          this.holdNote(id);
        }
        if (refused) val = Number(prior);
      } else {
        L.vote(id, String(val));
      }
    }
    PASSIVE.record(q); // no-op unless this is a test's own question (q.test)
    // …and the same for a lens question. The scale runs agree→disagree while
    // the lens stores disagree→agree, hence 4 - val.
    if (q.lens) LENSES.record({ ...q, value: typeof val === 'number' ? 4 - val : 2 });
    if (!refused) this._fresh = id; // gates the reveal's count-up + bar growth to the vote moment
    // the vote is felt, then the crowd's answer is felt arriving — timed to the
    // same stagger the bars use (2 steps), so hand and eye agree
    HAPTIC.tap();
    if (!editing) { clearTimeout(this._hapT); this._hapT = setTimeout(() => HAPTIC.reveal(), 260); }
    // the feed's memory: with the crowd or against it. Local to this device
    // (feed-read.js) — it reports only your own answers, so no floor applies.
    // No crowd on a selfOnly card means no majority to be with.
    if (q.options && typeof val === 'number' && !selfOnly) {
      const counts = q.options.map((o) => o.count);
      // COUNTS, not percentages. This one is written into a permanent
      // per-device log that feeds the Mirror's sparse gate and its
      // with-the-crowd rate, so a wrong reading here is recorded rather
      // than merely drawn.
      const { c } = wfPcts(counts, val);
      FEEDREAD.log(id, { maj: c[val] === Math.max(...c) });
    }
    // the ripple — where this vote landed on your Mirror. Deliberately on
    // ~45% of answers, chosen by a hash of the id so it is stable per
    // question rather than random per render: every card saying it makes it
    // wallpaper, and a re-render must not make it flicker. A lens answer
    // lands on the profile's Lenses tab, not the Mirror — so the claim is
    // false on EVERY lens card, the live ones (D91) included, which is why
    // the gate is q.lens rather than selfOnly.
    const rip = !editing && this.opts.ripple && !selfOnly && !q.lens && wfHash(id + ':rip') < 0.45 ? id : null;
    if (rip) {
      clearTimeout(this._rippleT);
      this._rippleT = setTimeout(() => {
        if (this.state.ripple === rip) this.setState({ ripple: null });
      }, 3200);
    }
    this.setState((s) => {
      const votes = { ...s.votes, [id]: val };
      wfSave(votes);
      // …and the beat replays the split as a scene, so it is the same
      // fabrication on a selfOnly card that the bars would be.
      // …and `wfNoCrowd` for the same reason one clause along: a live card
      // whose counts have not arrived has no split to replay either, which
      // daily-split.jsx has gated its own beat on since it had one.
      const beat = (!editing && this.props.beats !== false && !selfOnly && !wfNoCrowd(q)) ? id : s.beat;
      // Ask for a reason once, while the vote is warm, and only if this
      // question has none of your takes yet. Demo cards only: a live card
      // shows no takes, so there would be nowhere for the answer to go —
      // and a selfOnly card suppresses the whole engage row the same way.
      const askWhy = this.opts.why && !q.live && !selfOnly && typeof val === 'number' && !(s.myTakes[id] || []).length ? id : s.whyFor;
      // an option was tapped, so edit mode is over either way
      const editFor = { ...s.editFor }; delete editFor[id];
      return { votes, beat, ripple: rip || s.ripple, whyFor: askWhy, editFor };
    });
    if (this.props.onVote && !refused) this.props.onVote(q, val);
  }

  // A refused edit (D86's one-change-a-minute cooldown) says why on the
  // meta line for a moment instead of silently snapping back.
  holdNote(id) {
    clearTimeout(this._ehT);
    this.setState({ editHold: id });
    this._ehT = setTimeout(() => this.setState({ editHold: null }), 2600);
  }

  // the consequence beat — replaces the result reveal for ~2s after a vote
  renderBeat(q, T, big) {
    const mine = this.state.votes[q.id];
    // `c` alongside `p`: the beat PRINTS a percentage and then says
    // whether you are with them, and those are different questions — the
    // second one is about votes. The feed's own line under the card was
    // reading it off the percentages until earlier tonight, and a beat
    // that kept doing so would now disagree with the line it precedes.
    const { p, c } = wfPcts(q.options.map((o) => o.count), mine);
    return (
      <ConsequenceBeat seed={q.id} options={q.options.map((o, i) => ({ label: o.label, color: wfShade(T.color, i) }))}
        pcts={p} counts={c} mineIdx={mine} height={big ? 300 : 200} onDone={() => this.setState({ beat: null })} />
    );
  }

  // ranking: tap items in order; tapping an assigned item un-assigns it.
  // The order is derived OUTSIDE the updater, setPick's shape: a completed
  // ranking triggers wfSave and LIVE.voteRank, and voteRank's notify()
  // synchronously setStates every store subscriber — run from inside an
  // updater that is a render-phase side effect ("Cannot update a component
  // while rendering a different component", doubled under StrictMode).
  // Reading this.state in a tap handler is safe: handlers run between
  // renders, and the create-only guard covers the pathological double-tap.
  tapRank(q, i) {
    HAPTIC.tick();
    const cur = (this.state.pending[q.id] || []).slice();
    const at = cur.indexOf(i);
    if (at >= 0) cur.splice(at, 1); else cur.push(i);
    if (cur.length === q.items.length) {
      wfSave({ ...this.state.votes, [q.id]: { order: cur } });
      const L = q.live && LIVE;
      if (L && L.voteRank) L.voteRank(q.id, cur);
      this.setState((s) => ({ votes: { ...s.votes, [q.id]: { order: cur } }, pending: { ...s.pending, [q.id]: [] } }));
      return;
    }
    this.setState((s) => ({ pending: { ...s.pending, [q.id]: cur } }));
  }

  // a live ranking may exist only server-side (fresh device, no local
  // mirror yet) — myVotes holds the joined order (dialVal's precedent)
  rankVal(q) {
    const v = this.state.votes[q.id];
    const L = LIVE;
    if ((v && v.order) || !q.live || !L.myVotes) return v;
    const b = L.myVotes()[q.id];
    if (typeof b !== 'string' || b.indexOf(',') < 0) return v;
    const order = b.split(',').map(Number);
    return order.length === q.items.length && order.every((x) => Number.isInteger(x) && x >= 0 && x < q.items.length)
      ? { order } : v;
  }

  // rate cards: score a place 1–10; feeds the city/country/world scorecards
  setRate(q, score) {
    this.setState((s) => {
      const votes = { ...s.votes, [q.id]: score };
      wfSave(votes);
      return { votes };
    });
    PLACESTATS.rate(q.scope, q.catId, score);
  }

  renderRate(q, T, big) {
    const v = this.state.votes[q.id];
    const c = PLACESTATS.cat(q.scope, q.catId);
    if (v == null) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 12 : 9 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {Array.from({ length: 10 }, (_, k) => k + 1).map((s) => (
              <button key={s} className="press" onClick={() => this.setRate(q, s)} style={{ flex: 1, minWidth: 0, height: big ? 54 : 42, padding: 0, border: '1px solid color-mix(in oklch, ' + T.color + ' 45%, var(--rule))', borderRadius: 10, background: 'color-mix(in oklch, ' + T.color + ' ' + (4 + s * 2.6).toFixed(1) + '%, var(--surface))', boxShadow: 'none', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 15 : 13.5, color: 'var(--ink)', WebkitAppearance: 'none' }}>{s}</button>
            ))}
          </div>
          <span style={{ alignSelf: 'center', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)' }}>tap a number — 1 rough, 10 superb</span>
        </div>
      );
    }
    const avg = c ? c.avg : 5;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 13 : 10, animation: 'popIn .3s cubic-bezier(0.2,0.8,0.2,1)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 34 : 26, letterSpacing: '-0.03em', color: WPAL.ink(T.color), fontVariantNumeric: 'tabular-nums' }}>{avg.toFixed(1)}</span>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-3)' }}>the crowd</span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: 13.5, color: 'var(--ink)' }}><span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: T.color, border: '2px solid var(--surface)', boxShadow: '0 0 0 1px ' + T.color }}></span>you · {v}</span>
        </div>
        <div style={{ position: 'relative', height: 12 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'color-mix(in oklch, ' + T.color + ' 10%, var(--surface-3))' }}></span>
          <span className="rpv2-bar" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: (avg * 10) + '%', borderRadius: 999, transformOrigin: 'left', background: 'linear-gradient(90deg, color-mix(in oklch, ' + T.color + ', transparent 55%), ' + T.color + ')' }}></span>
          <span style={{ position: 'absolute', top: '50%', left: 'calc(' + (v * 10) + '% - ' + (v * 1.6) + 'px)', transform: 'translateY(-50%)', width: 16, height: 16, borderRadius: '50%', background: T.color, border: '2.5px solid var(--surface)', boxShadow: '0 1px 4px rgba(20,20,40,0.3)' }}></span>
        </div>
      </div>
    );
  }

  // ── dial: your answer is a point on a range; the reveal is the crowd's curve ──
  // Live since D114: the bank carries dial/field docs whose options are
  // synthesized bucket/cell labels, so a continuum answer is an ordinary
  // optionIdx — the existing rules, fold, by-cells and edit cooldown all
  // carry it unchanged. The RAW value stays local (WF_LS) for display;
  // the bucket is what the world learns.
  //
  // These literals mirror scripts/gen-v2content.mjs (DIAL_BUCKETS /
  // FIELD_COLS / FIELD_ROWS). A stored optionIdx is a position in that
  // exact grid, so drifting here re-keys every live answer — the same
  // reason D52 froze option sets.
  dialBucket(q, val) { return Math.max(0, Math.min(11, Math.floor(((val - q.lo) / (q.hi - q.lo)) * 12))); }
  dialBucketMid(q, i) { return q.lo + ((i + 0.5) / 12) * (q.hi - q.lo); }
  // The value to hand out AS YOUR ANSWER for a bucket — which is not the
  // midpoint, because `dialFmt` rounds to an integer and the midpoint
  // does not survive it.
  //
  // When (hi-lo)/12 is a whole number every midpoint ends in .5, and
  // half-up rounding lands on the TOP EDGE of its own bucket, which
  // re-buckets one higher. On the 0-12 h dial you answer 3 h; a device
  // that did not do the drag has only the bucket, reads the midpoint 3.5,
  // prints "4 h", and the surprise line quotes 4 back at you. 11 of that
  // dial's 12 buckets did this; 22 bucket-readings across the four dials
  // whose step is a whole unit.
  //
  // So: the integer nearest the midpoint that STAYS IN THE BUCKET. Tried
  // round, then floor, then ceil — floor alone is not safe, because on a
  // dial whose step is under 1 the floor can fall out of the bucket
  // downward.
  //
  // KNOWN LIMIT, deliberately not closed here. On a dial finer than one
  // unit per bucket (1-4 hrs, step 0.25) most buckets contain NO integer
  // at all, so no integer display can be inside them and this returns the
  // midpoint, exactly as before. That is a different defect — the
  // display's resolution is coarser than the dial's — and closing it means
  // teaching `dialFmt` decimals, which it uses for end labels, medians,
  // averages and gaps on every dial card. It is on the night list.
  dialBucketShown(q, i) {
    const mid = this.dialBucketMid(q, i);
    const cands = [Math.round(mid), Math.floor(mid), Math.ceil(mid)];
    for (const c of cands) if (this.dialBucket(q, c) === i) return c;
    return mid;
  }
  fieldCell(x, y) { return Math.min(2, Math.floor(y / (100 / 3))) * 4 + Math.min(3, Math.floor(x / 25)); }
  fieldCellMid(i) { return { x: ((i % 4) + 0.5) * 25, y: (Math.floor(i / 4) + 0.5) * (100 / 3) }; }

  // your answer on a live card when this device has no raw value: the
  // server bucket's midpoint — quantized is what the world stored, so
  // quantized is what the card claims
  dialVal(q) {
    const v = this.state.votes[q.id];
    // A number OFF the card's own range is not an answer: it is the
    // store's bucket index (0–11), which the pre-D218 reconcile copied
    // into this raw slot and localStorage then kept — "0 cups" standing
    // on a 1–10 card. Range, not provenance, is the test, because
    // in-range residue is indistinguishable from a real drag; treat the
    // stale number as absent and read the store below, which is the
    // truth it was mangled from. `b == null` returns v rather than null
    // so a mirror orphan (rolled back server-side, mirror never scrubbed)
    // degrades exactly as it always did instead of handing consumers a
    // null they never guarded.
    const stale = q.live && typeof v === 'number' && (v < q.lo || v > q.hi);
    if ((v != null && !stale) || !q.live || !LIVE.myVotes) return v;
    const b = LIVE.myVotes()[q.id];
    return b == null ? v : this.dialBucketShown(q, Number(b));
  }
  fieldVal(q) {
    const v = this.state.votes[q.id];
    // Same residue, field-shaped: this slot holds a point, so a NUMBER
    // here is the store's cell index wearing the wrong type (D218).
    const stale = q.live && v != null && (typeof v !== 'object' || typeof v.x !== 'number');
    if ((v != null && !stale) || !q.live || !LIVE.myVotes) return v;
    const b = LIVE.myVotes()[q.id];
    return b == null ? v : this.fieldCellMid(Number(b));
  }

  // the crowd's buckets on a live dial: per-option counts (they exclude
  // the viewer — deck.ts countsFor) plus the viewer's own bucket back,
  // wfPcts's convention, so the curve never draws an empty crowd right
  // after you answered it
  dialDist(q, v) {
    const d = q.options.map((o) => o.count || 0);
    if (v != null) { const b = this.dialBucket(q, v); d[b] = (d[b] || 0) + 1; }
    return d;
  }
  // the value at the crowd's midpoint — the live "most say" line. The agg
  // stores a histogram, never a sum (functions/src/v2.ts), so the median
  // is derived here exactly as every average in the app is derived from
  // its distribution.
  dialMedOf(q, dist) {
    const total = dist.reduce((a, b) => a + b, 0);
    if (!total) return (q.lo + q.hi) / 2;
    let acc = 0;
    // `dialBucketShown`, NOT `dialBucketMid` — the same correction
    // `dialVal` carries, and the reason is written out in full above it:
    // when (hi-lo)/12 is a whole number every midpoint ends in .5 and
    // half-up rounding lands on the TOP EDGE of its own bucket. So your
    // own answer went through the corrected function and the crowd's
    // through the raw midpoint, one line apart on the same card: you say
    // 3 h, the card says "most say 4 h", out of the SAME bucket.
    //
    // That reasoning was written when the fix went into `dialVal`, and
    // this is the other half of it. NO COUNT HERE, deliberately: the
    // sentence carried over said "22 bucket-readings across the four
    // dials whose step is a whole unit", which was the figure for the
    // dial the original fix was measured on — the shipped bank now has 19
    // dials, ONE with a whole-unit step, and 212 bucket-readings where
    // the midpoint and the shown value differ. A count in a comment is
    // the documentation error this repo keeps re-committing, and
    // `dial-bucket.test.jsx` holds the real relationship off the tree.
    for (let i = 0; i < dist.length; i++) { acc += dist[i]; if (acc >= total / 2) return this.dialBucketShown(q, i); }
    return (q.lo + q.hi) / 2;
  }
  // one by-cell (optionIdx → count) read as a dial: how many, and where
  // their middle sits
  dialCellAvg(q, cell) {
    let n = 0, sum = 0;
    for (const k of Object.keys(cell || {})) {
      const c = cell[k] || 0;
      n += c; sum += c * this.dialBucketMid(q, Number(k));
    }
    return n ? { n, avg: sum / n } : null;
  }
  // …and read as a field: the group's centre of mass on the plane
  fieldCellCentroid(cell) {
    let n = 0, cx = 0, cy = 0;
    for (const k of Object.keys(cell || {})) {
      const c = cell[k] || 0;
      const m = this.fieldCellMid(Number(k));
      n += c; cx += m.x * c; cy += m.y * c;
    }
    return n ? { n, x: cx / n, y: cy / n } : null;
  }

  setDial(q, val) {
    HAPTIC.tap();
    clearTimeout(this._hapT); this._hapT = setTimeout(() => HAPTIC.reveal(), 260);
    // live: the bucket rides the ordinary vote path — create first, and a
    // repeat answer from a device with no local raw value routes through
    // the D86 edit exactly like setVote. A refused edit (the 60s cooldown)
    // snaps the display back to the standing bucket rather than showing a
    // value the server never heard.
    if (q.live) {
      const idx = this.dialBucket(q, val);
      const prior = LIVE.myVotes ? LIVE.myVotes()[q.id] : null;
      if (prior == null) { if (LIVE.vote) LIVE.vote(q.id, String(idx)); }
      else if (Number(prior) !== idx && !(LIVE.editVote && LIVE.editVote(q.id, String(idx)))) {
        val = this.dialBucketShown(q, Number(prior));
      }
    }
    this._fresh = q.id;
    this.setState((s) => {
      const votes = { ...s.votes, [q.id]: val };
      wfSave(votes);
      return { votes };
    });
  }

  dialFmt(q, v) { return Math.round(v) + (q.unit === '%' ? '%' : q.unit ? ' ' + q.unit : ''); }

  // smooth area through the 12 crowd buckets (midpoint quadratics) — dist
  // is a parameter because a live card derives it from bucket counts while
  // a demo card reads its authored q.dist
  dialPath(dist, W, H) {
    const d = dist, max = Math.max(...d);
    const pts = d.map((w, i) => [(i / (d.length - 1)) * W, H - 4 - (w / max) * (H - 12)]);
    let path = 'M ' + pts[0][0] + ',' + pts[0][1];
    for (let i = 1; i < pts.length - 1; i++) path += ' Q ' + pts[i][0] + ',' + pts[i][1] + ' ' + (pts[i][0] + pts[i + 1][0]) / 2 + ',' + (pts[i][1] + pts[i + 1][1]) / 2;
    path += ' L ' + pts[pts.length - 1][0] + ',' + pts[pts.length - 1][1];
    return path;
  }

  dialY(dist, frac, H) {
    const d = dist, max = Math.max(...d);
    const x = Math.max(0, Math.min(0.999, frac)) * (d.length - 1), i = Math.floor(x), t = x - i;
    const w = d[i] * (1 - t) + d[Math.min(d.length - 1, i + 1)] * t;
    return H - 4 - (w / max) * (H - 12);
  }

  renderDial(q, T, big) {
    const v = this.dialVal(q);
    const lo = q.lo, hi = q.hi;
    const endTxt = q.ends || [this.dialFmt(q, lo), this.dialFmt(q, hi)];
    const ends = { display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' };
    if (v == null) {
      const pend = (this.state.dialPend || {})[q.id];
      const frac = pend != null ? pend : 0.5;
      const move = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        this._dp = f;
        this.setState((s) => ({ dialPend: { ...(s.dialPend || {}), [q.id]: f } }));
      };
      // keyboard: a drag surface is a slider, so it answers like one —
      // arrows nudge the pending value, Enter commits it. The step is the
      // range at drag resolution (~24 stops), floored at one whole unit
      // because the committed value rounds anyway. (v20 ships pointer-only;
      // the a11y ratchet is this tree's, so the control grew the keys —
      // the D68 rule, enforcement over verbatim.)
      const step = Math.max(1, Math.round((hi - lo) / 24)) / (hi - lo);
      const nudge = (d) => {
        const f = Math.max(0, Math.min(1, frac + d));
        this.setState((s) => ({ dialPend: { ...(s.dialPend || {}), [q.id]: f } }));
      };
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 12 : 9 }}>
          <div style={{ alignSelf: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 40 : 32, letterSpacing: '-0.03em', color: pend != null ? WPAL.ink(T.color) : 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', transition: 'color 0.15s' }}>{this.dialFmt(q, lo + frac * (hi - lo))}</div>
          {/* data-nopan: this control OWNS its horizontal drag (OWNS_X,
              swipe-back.js). touchAction:'none' stops the browser from
              scrolling under the drag, but it does not stop touch events
              reaching daily-split's mode-swipe listener on the scroller
              above — so answering a dial also slid the mode axis, and past
              1v1 that slide leaves the tab entirely. Same mark, same
              reason, as the Mirror ruler. */}
          <div role="slider" tabIndex={0} data-nopan="" aria-label={q.prompt + ' — arrow keys to adjust, Enter to answer'}
            aria-valuemin={lo} aria-valuemax={hi} aria-valuenow={Math.round(lo + frac * (hi - lo))} aria-valuetext={this.dialFmt(q, lo + frac * (hi - lo))}
            style={{ position: 'relative', height: 44, touchAction: 'none', cursor: 'pointer' }}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
            onPointerMove={(e) => { if (e.buttons) move(e); }}
            onPointerUp={() => { if (this._dp != null) { this.setDial(q, Math.round(lo + this._dp * (hi - lo))); this._dp = null; } }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); nudge(-step); }
              else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); nudge(step); }
              else if (e.key === 'Enter' && pend != null) { e.preventDefault(); this.setDial(q, Math.round(lo + frac * (hi - lo))); }
            }}>
            <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 6, marginTop: -3, borderRadius: 999, background: WPAL.wash(T.color, 12, 'var(--surface-3)') }}></span>
            <span style={{ position: 'absolute', top: '50%', left: (frac * 100) + '%', transform: 'translate(-50%,-50%)', width: 28, height: 28, borderRadius: '50%', boxSizing: 'border-box', background: pend != null ? T.color : 'var(--surface)', border: pend != null ? '3px solid var(--surface)' : '2px solid ' + T.color, boxShadow: '0 1px 6px rgba(20,20,40,0.25)', transition: 'background 0.15s' }}></span>
          </div>
          <div style={ends}><span>{endTxt[0]}</span><span style={{ fontWeight: 500 }}>slide · let go to answer</span><span>{endTxt[1]}</span></div>
        </div>
      );
    }
    const W = 320, H = big ? 92 : 66;
    // demo cards carry an authored crowd; live cards ARE the crowd —
    // per-bucket counts from the aggregate, your own bucket added back
    const dist = q.live ? this.dialDist(q, v) : q.dist;
    const med = q.live ? this.dialMedOf(q, dist) : q.med;
    const path = this.dialPath(dist, W, H);
    const frac = (v - lo) / (hi - lo);
    const medFrac = (med - lo) / (hi - lo);
    // NO COUNTS, NO CROWD. `dialDist` adds your own bucket back so the
    // curve is never empty right after you answer — which on a card
    // nobody else has answered leaves a distribution of exactly ONE, and
    // the dial drew it as a full-height curve labelled "How everyone
    // answered", with a dashed median and a "most say" line quoting your
    // own number back at you as the crowd's.
    //
    // `noCountsYet` is the flag for this and every other shape on this
    // card already reads it — the tiles suppress their percentages and
    // draw `renderFloorNote`, the bars the same. The dial path never
    // asked. So it asks now, and says the same thing they do. (Two line
    // numbers stood here and pointed at `renderMeta` instead; grep the
    // name, which is what a citation is for.)
    const noCrowd = wfNoCrowd(q);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 12 : 9, animation: 'popIn .3s cubic-bezier(0.2,0.8,0.2,1)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 34 : 26, letterSpacing: '-0.03em', color: WPAL.ink(T.color), fontVariantNumeric: 'tabular-nums' }}>{this.dialFmt(q, v)}</span>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink-3)' }}>you</span>
          {noCrowd ? null : <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 13.5, color: 'var(--ink-2)' }}>most say {this.dialFmt(q, med)}</span>}
        </div>
        <svg viewBox={'0 0 ' + W + ' ' + H} style={{ width: '100%', height: 'auto', display: 'block' }} aria-label={noCrowd ? 'Where you answered, ' + endTxt[0] + ' to ' + endTxt[1] : 'How everyone answered, ' + endTxt[0] + ' to ' + endTxt[1]}>
          {noCrowd ? null : <path d={path + ' L ' + W + ',' + H + ' L 0,' + H + ' Z'} fill={WPAL.wash(T.color, 20)} stroke="none"></path>}
          {noCrowd ? null : <path d={path} fill="none" stroke={T.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"></path>}
          {noCrowd ? null : <line x1={medFrac * W} y1={8} x2={medFrac * W} y2={H} stroke="var(--ink-3)" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.55"></line>}
          <line x1={0} y1={H - 1} x2={W} y2={H - 1} stroke="var(--rule)" strokeWidth="1"></line>
          <circle cx={frac * W} cy={noCrowd ? H - 8 : this.dialY(dist, frac, H)} r="7" fill={T.color} stroke="var(--surface)" strokeWidth="2.5"></circle>
        </svg>
        <div style={ends}><span>{endTxt[0]}</span><span>{endTxt[1]}</span></div>
        {noCrowd ? this.renderFloorNote(big) : null}
      </div>
    );
  }

  // ── field: drop a dot on a 2D plane; the reveal is the crowd as a cloud ──
  setField(q, x, y) {
    HAPTIC.tap();
    clearTimeout(this._hapT); this._hapT = setTimeout(() => HAPTIC.reveal(), 260);
    // live: same shape as setDial — the cell rides the vote path, a repeat
    // from a raw-less device routes through the D86 edit, and a refused
    // edit snaps the display to the standing cell's midpoint.
    if (q.live) {
      const idx = this.fieldCell(x, y);
      const prior = LIVE.myVotes ? LIVE.myVotes()[q.id] : null;
      if (prior == null) { if (LIVE.vote) LIVE.vote(q.id, String(idx)); }
      else if (Number(prior) !== idx && !(LIVE.editVote && LIVE.editVote(q.id, String(idx)))) {
        const m = this.fieldCellMid(Number(prior));
        x = m.x; y = m.y;
      }
    }
    this._fresh = q.id;
    this.setState((s) => {
      const votes = { ...s.votes, [q.id]: { x, y } };
      wfSave(votes);
      return { votes };
    });
  }

  // seeded dots from the cloud spec [[cx, cy, count, spread], …] — y runs 0=top
  fieldCloud(q) {
    const dots = [];
    (q.cloud || []).forEach((c, ci) => {
      for (let i = 0; i < c[2]; i++) {
        const a = wfHash(q.id + ':a' + ci + ':' + i) * Math.PI * 2;
        const r = Math.sqrt(wfHash(q.id + ':r' + ci + ':' + i)) * c[3];
        dots.push([Math.max(4, Math.min(96, c[0] + Math.cos(a) * r)), Math.max(6, Math.min(94, c[1] + Math.sin(a) * r * 0.9))]);
      }
    });
    return dots;
  }

  // the live cloud: per-cell counts drawn as dots jittered inside their
  // cell. Deterministic (wfHash) so the cloud holds still across renders,
  // and scaled so a big crowd stays a sketch — ~60 dots — instead of a
  // census; the jitter radii keep a dot inside its 25×33 cell.
  fieldDots(q) {
    const counts = q.options.map((o) => o.count || 0);
    const total = counts.reduce((a, b) => a + b, 0);
    if (!total) return [];
    const scale = Math.min(1, 60 / total);
    const dots = [];
    counts.forEach((c, i) => {
      const k = Math.max(c > 0 ? 1 : 0, Math.round(c * scale));
      const m = this.fieldCellMid(i);
      for (let j = 0; j < k; j++) {
        const a = wfHash(q.id + ':la' + i + ':' + j) * Math.PI * 2;
        const r = Math.sqrt(wfHash(q.id + ':lr' + i + ':' + j));
        dots.push([
          Math.max(4, Math.min(96, m.x + Math.cos(a) * r * 10)),
          Math.max(6, Math.min(94, m.y + Math.sin(a) * r * 13)),
        ]);
      }
    });
    return dots;
  }

  // the crowd's centre of mass — the thin bar's "with the cluster" read.
  // Null while nobody has answered (live) or the spec has no cloud (demo).
  fieldCentroid(q) {
    if (q.live) {
      const counts = q.options.map((o) => o.count || 0);
      const total = counts.reduce((a, b) => a + b, 0);
      if (!total) return null;
      let cx = 0, cy = 0;
      counts.forEach((c, i) => { const m = this.fieldCellMid(i); cx += m.x * c; cy += m.y * c; });
      return { x: cx / total, y: cy / total };
    }
    const c = this.fieldCloud(q);
    if (!c.length) return null;
    return { x: c.reduce((a, d) => a + d[0], 0) / c.length, y: c.reduce((a, d) => a + d[1], 0) / c.length };
  }

  renderField(q, T, big) {
    const v = this.fieldVal(q);
    const done = v != null;
    const fresh = this._fresh === q.id;
    const dots = done ? (q.live ? this.fieldDots(q) : this.fieldCloud(q)) : [];
    const lab = (t, style) => <span style={{ position: 'absolute', fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 650, color: 'var(--ink-3)', letterSpacing: '0.02em', pointerEvents: 'none', ...style }}>{t}</span>;
    // keyboard: arrows walk a pending ring around the plane, Enter drops
    // the dot where it stands (center until moved — dead center is a
    // position too). Same enforcement note as the dial: v20 is tap-only.
    const pend = !done ? (this.state.fieldPend || {})[q.id] : null;
    const nudge = (dx, dy) => {
      const p = pend || { x: 50, y: 50 };
      this.setState((s) => ({ fieldPend: { ...(s.fieldPend || {}), [q.id]: { x: Math.max(2, Math.min(98, p.x + dx)), y: Math.max(2, Math.min(98, p.y + dy)) } } }));
    };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 10 : 7 }}>
        <div onClick={(e) => { if (done) return; const r = e.currentTarget.getBoundingClientRect(); this.setField(q, Math.round(((e.clientX - r.left) / r.width) * 100), Math.round(((e.clientY - r.top) / r.height) * 100)); }}
          role="button" tabIndex={done ? -1 : 0}
          aria-label={done ? q.prompt + ' — answered' : q.prompt + ' — ' + q.ax[0] + ' to ' + q.ax[1] + ' across, ' + q.ay[0] + ' to ' + q.ay[1] + ' up. Arrow keys to aim, Enter to place.'}
          onKeyDown={(e) => {
            if (done) return;
            const s = 4;
            if (e.key === 'ArrowLeft') { e.preventDefault(); nudge(-s, 0); }
            else if (e.key === 'ArrowRight') { e.preventDefault(); nudge(s, 0); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); nudge(0, -s); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); nudge(0, s); }
            else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const p = pend || { x: 50, y: 50 }; this.setField(q, p.x, p.y); }
          }}
          style={{ position: 'relative', aspectRatio: big ? '1 / 1' : '4 / 3', borderRadius: 16, border: '1px solid color-mix(in oklch, ' + T.color + ' 35%, var(--rule))', background: WPAL.wash(T.color, 5), cursor: done ? 'default' : 'crosshair', overflow: 'hidden' }}>
          <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'var(--rule)', opacity: 0.8 }}></span>
          <span style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'var(--rule)', opacity: 0.8 }}></span>
          {lab(q.ax[0], { left: 9, top: '50%', transform: 'translateY(-140%)' })}
          {lab(q.ax[1], { right: 9, top: '50%', transform: 'translateY(-140%)' })}
          {lab(q.ay[1], { top: 7, left: '50%', transform: 'translateX(8px)' })}
          {lab(q.ay[0], { bottom: 7, left: '50%', transform: 'translateX(8px)' })}
          {pend && <span style={{ position: 'absolute', left: pend.x + '%', top: pend.y + '%', width: 16, height: 16, margin: '-8px 0 0 -8px', borderRadius: '50%', boxSizing: 'border-box', border: '2px dashed ' + T.color, opacity: 0.7 }}></span>}
          {done && dots.map(([x, y], i) => <span key={i} style={{ position: 'absolute', left: x + '%', top: y + '%', width: 7, height: 7, margin: '-3.5px 0 0 -3.5px', borderRadius: '50%', background: T.color, opacity: 0.38, animation: fresh ? 'popIn .4s ' + (i * 14) + 'ms cubic-bezier(0.2,0.8,0.2,1) backwards' : 'none' }}></span>)}
          {done && <span style={{ position: 'absolute', left: v.x + '%', top: v.y + '%', width: 16, height: 16, margin: '-8px 0 0 -8px', borderRadius: '50%', boxSizing: 'border-box', background: 'var(--surface)', border: '3px solid ' + T.color, boxShadow: '0 1px 6px rgba(20,20,40,0.3)', animation: fresh ? 'popIn .3s cubic-bezier(0.2,0.8,0.2,1)' : 'none' }}></span>}
        </div>
        {!done && <span style={{ alignSelf: 'center', fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)' }}>tap where you land</span>}
      </div>
    );
  }

  // the woven knowledge cards, planned ONCE per sitting. LEARN.plan re-derives
  // from your position in the deck, so calling it every render would reshuffle
  // the feed under you — the list is cached and only rebuilt when what you follow
  // (or the frequency) actually changes, never when you answer.
  knowQs(n, cats) {
    const LF = LEARN_FEED;
    // `!LF.every()` only — the `!LF ||` half was the load-order guard.
    // `every()` returning 0 is the DATA condition (the stream is off) and
    // stays.
    if (!LF.every()) return [];
    const muted = Object.keys(cats || {}).filter((k) => k.indexOf('lrn-') === 0 && cats[k] === false).sort().join(',');
    const sig = LF.freq() + '|' + LEARN.mine().map((f) => f.id).join(',') + '|' + muted;
    if (this._kqSig !== sig || !this._kq) {
      this._kqSig = sig; this._kq = LF.cards(Math.max(14, n), cats);
      // Warm the crowd splits for the whole plan, here (D125). This is the
      // one moment that is guaranteed to precede every tap in the sitting,
      // and LIVE.learnAgg is a read-through cache whose first call always
      // returns null — so before this line the measured split was
      // unreachable by construction: the first call for a card was the one
      // LEARN.answer() makes at the instant of the tap, and it got null
      // every time, on every card, at any crowd size.
      //
      // forceUpdate on completion because the feed deliberately does not
      // re-render on every store notify (componentDidMount's reconcile
      // returns null when no vote moved), and a card tapped inside the
      // fetch window would otherwise keep the estimate it was rendered
      // with. Renders are cheap here; the read is the thing that is not.
      //
      // The imported binding, not window.LIVE: D39's meter counts
      // cross-module global reads and only moves down, so a new read here
      // would have to be paid for by converting something else.
      if (LIVE.loadLearnAggs) {
        // `.learn`, NOT `.id`. LEARN_FEED wraps each card as a feed
        // question whose id is "lrn-<card>" while the card itself — and
        // therefore the "learn-<card>" aggregate — is `.learn`. Passing
        // `.id` asks for "learn-lrn-cap6", which no document has ever
        // been written under, and the failure is silent in the worst
        // way: getDocs returns nothing, the cache holds null, and every
        // reveal shows the authored estimate. Exactly the bug this
        // prefetch exists to fix, wearing its fix's clothes.
        const ids = this._kq.map((c) => c.learn);
        void Promise.resolve(LIVE.loadLearnAggs(ids))
          .then(() => { if (this._mounted !== false) this.forceUpdate(); }, () => {});
      }
    }
    return this._kq.slice(0, n);
  }

  // ── catalogue cards ─────────────────────────────────────────────────────
  // A vote has two sides and a bar. A catalogue has hundreds of entries, so the
  // question is answered by searching — and the answer isn't a split, it's a
  // position in a long tail. What the reveal has to say is therefore different:
  // not who won, but how rare your pick is, and how little of the field the
  // famous few actually hold.
  setPickItem(q, id) {
    if (this.state.votes[q.id] != null) return;
    const votes = { ...this.state.votes, [q.id]: id };
    wfSave(votes);
    this.setState({ votes });
  }
  // catalogue cards from the prototype's demo store (world-catalogs.js) —
  // repo pick cards (q.domain, real committed catalogues) dispatch here
  // only when they carry a q.catalog; renderPick below owns the rest.
  renderPickCatalog(q, T, big) {
    const C = WF_CATALOGS[q.catalog];
    if (!C) return null;
    const mine = this.state.votes[q.id];
    const ranked = C.items.slice().sort((a, b) => b.count - a.count);
    const sh = (n) => (n / C.picks) * 100;
    const art = (it, w, h) => ({ width: w, height: h, borderRadius: 12, background: wfCatArt(T.color, q.catalog + ':' + it.id), border: WF_LINE, display: 'block', flexShrink: 0, boxSizing: 'border-box' });

    if (mine == null) {
      const raw = this.state.pickQ[q.id] || '';
      const term = raw.trim().toLowerCase();
      const hits = term ? ranked.filter((i) => i.name.toLowerCase().indexOf(term) >= 0 || (i.meta || '').toLowerCase().indexOf(term) >= 0) : [];
      const tw = big ? 104 : 92, th = C.shape === 'poster' ? Math.round(tw * 1.36) : tw;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input value={raw} onChange={(e) => this.setState((s) => ({ pickQ: { ...s.pickQ, [q.id]: e.target.value } }))} placeholder={'Search ' + C.total + ' ' + C.noun}
            style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderBottom: '1px solid color-mix(in oklch, var(--ink) 20%, var(--rule))', background: 'none', padding: '8px 2px', fontFamily: 'var(--sans)', fontSize: 'var(--field-size)', fontWeight: 600, color: 'var(--ink)', outline: 'none' }} />
          {term ? (
            hits.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hits.slice(0, 6).map((it) => (
                  <button key={it.id} className="press" onClick={() => this.setPickItem(q, it.id)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', border: WF_LINE, borderRadius: 12, background: 'var(--surface-2)', padding: 9, cursor: 'pointer', WebkitAppearance: 'none' }}>
                    <span style={art(it, 34, C.shape === 'poster' ? 46 : 34)}></span>
                    <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14.5, color: 'var(--ink)' }}>{it.name}</span>
                    <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 11.5, color: 'var(--ink-3)' }}>{it.meta}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>{'Nothing in the ranked ' + C.noun + ' yet — try another spelling.'}</span>
            )
          ) : (
            <div className="h-scroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', margin: '0 -16px', padding: '2px 16px 4px', WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 46px), transparent)', maskImage: 'linear-gradient(to right, #000 calc(100% - 46px), transparent)' }}>
              {ranked.map((it) => (
                <button key={it.id} className="press" onClick={() => this.setPickItem(q, it.id)} style={{ flexShrink: 0, width: tw, display: 'flex', flexDirection: 'column', gap: 7, border: 'none', background: 'none', padding: 0, cursor: 'pointer', WebkitAppearance: 'none', textAlign: 'left' }}>
                  <span style={art(it, tw, th)}></span>
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12.5, lineHeight: 1.25, color: 'var(--ink)', textWrap: 'pretty' }}>{it.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    const myItem = C.items.find((i) => i.id === mine) || ranked[0];
    const myRank = ranked.findIndex((i) => i.id === mine) + 1;
    const top = ranked.slice(0, 5);
    const inTop = top.some((i) => i.id === mine);
    const maxS = sh(ranked[0].count);
    const tail = Math.max(0, 100 - ranked.reduce((a, i) => a + sh(i.count), 0));
    const agree = ranked[0].id === mine;
    // yours against the crowd's, as two posters — the app's core move, and the one
    // thing a catalogue reveal can do that a two-way bar cannot
    const block = (it, label, strong, share, rank) => (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: strong ? 'var(--ink-2)' : 'var(--ink-3)' }}>{label}</span>
        <span style={{ width: '100%', height: C.shape === 'poster' ? 118 : 92, borderRadius: 12, background: wfCatArt(T.color, q.catalog + ':' + it.id), border: strong ? `1.5px solid ${T.color}` : WF_LINE, boxSizing: 'border-box', display: 'block' }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14.5, lineHeight: 1.2, textWrap: 'pretty', color: 'var(--ink)' }}>{it.name}</span>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{(rank ? '#' + rank + ' of ' + C.total + ' · ' : '') + share.toFixed(1) + '%'}</span>
      </div>
    );
    const row = (it, i) => {
      const s = sh(it.count);
      const isMine = it.id === mine;
      return (
        <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 15, flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11.5, color: isMine ? 'var(--ink)' : 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontWeight: isMine ? 800 : 650, fontSize: 13.5, color: isMine ? 'var(--ink)' : 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</span>
              {i === 0 || isMine ? <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, color: isMine ? 'var(--ink)' : 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{s.toFixed(1)}%</span> : null}
            </span>
            <span style={{ position: 'relative', height: 6 }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: 99, background: 'color-mix(in oklch, var(--ink-3) 11%, transparent)' }}></span>
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (s / maxS) * 100 + '%', borderRadius: 99, background: isMine ? T.color : WPAL.wash(T.color, 40), transformOrigin: 'left', animation: `wfBarIn .5s cubic-bezier(.2,.8,.2,1) calc(var(--rv-row) * ${i + 1}) both` }}></span>
            </span>
          </span>
        </div>
      );
    };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {agree
            ? block(myItem, 'you and the crowd', true, sh(myItem.count), myRank)
            : block(myItem, 'your pick', true, sh(myItem.count), myRank)}
          {agree ? null : block(ranked[0], 'the crowd', false, sh(ranked[0].count), null)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {top.map(row)}
          {!inTop ? (
            <>
              <span aria-hidden="true" style={{ display: 'flex', gap: 3, padding: '1px 0 1px 25px' }}>{[0, 1, 2].map((d) => <span key={d} style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-3)', opacity: 0.5 }}></span>)}</span>
              {row(myItem, myRank - 1)}
            </>
          ) : null}
        </div>
        {tail > 1 ? <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>{'the other ' + (C.total - C.items.length) + ' ' + C.noun + ' share ' + Math.round(tail) + '%'}</span> : null}
        {this.opts.reveal ? this.renderPickInsight(q, T, C, ranked, mine) : null}
      </div>
    );
  }

  // the catalogue's surprise: the population that ranks your pick highest.
  renderPickInsight(q, T, C, ranked, mine) {
    const headShare = ranked.reduce((a, i) => a + (i.count / C.picks) * 100, 0);
    let best = null;
    WF_CUTS().filter((d) => d.id !== 'friends').forEach((d) => {
      const subs = WF_SUBS(d.id);
      (subs ? subs : [{ id: null }]).forEach((sb) => {
        WF_GRP(d.id, sb.id).forEach((g) => {
          const r = wfPickGroup(q.id, WF_CUTKEY(d.id, sb.id) + ':' + g.label, ranked, headShare);
          const rank = r.findIndex((x) => x.it.id === mine) + 1;
          if (rank && (!best || rank < best.rank)) best = { dim: d.id, axis: sb.id, label: g.label, rank };
        });
      });
    });
    if (!best) return null;
    return (
      <button className="press" onClick={() => this.setState((s) => ({ sheet: { q, T, panel: 'pick' }, dims: { ...s.dims, [q.id]: best.dim }, cutAxis: { ...s.cutAxis, [q.id]: best.axis } }))}
        style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', border: WF_LINE, borderRadius: 12, background: 'var(--surface)', padding: '10px 12px', cursor: 'pointer', WebkitAppearance: 'none' }}>
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: T.color }}></span>
        <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--ink-2)' }}>{best.rank === 1 ? best.label + ' make it their favourite' : best.label + ' rank it highest'}</span>
        <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 13, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{'#' + best.rank}</span>
      </button>
    );
  }

  // Every population has its own ranking, and the interesting thing is not who
  // won overall — it's where the order breaks. So each row is a group and its own
  // favourite: rows that match the overall winner recede, rows that disagree come
  // forward, and the shape of the column tells you where taste divides.
  renderPickStats(q, T) {
    const C = WF_CATALOGS[q.catalog];
    if (!C) return null;
    const dim = this.state.dims[q.id] || 'friends';
    const axis = this.state.cutAxis[q.id] || null, cutKey = WF_CUTKEY(dim, axis), youBand = WF_YOU(dim, axis);
    const mine = this.state.votes[q.id];
    const ranked = C.items.slice().sort((a, b) => b.count - a.count);
    const headShare = ranked.reduce((a, i) => a + (i.count / C.picks) * 100, 0);
    const overall = ranked[0];
    const groups = dim === 'friends' ? WF_FRIENDS.filter((f) => wfDid(q, f)).map((f) => ({ label: f.name, init: f.init })) : WF_GRP(dim, axis);
    const line = (g) => {
      const r = wfPickGroup(q.id, cutKey + ':' + g.label, ranked, headShare);
      const win = r[0];
      const myRank = mine != null ? r.findIndex((x) => x.it.id === mine) + 1 : 0;
      const diverges = win.it.id !== overall.id;
      const you = youBand && g.label === youBand;
      return (
        <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 35%)' }}>
          <span style={{ width: 84, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontWeight: you ? 800 : 700, fontSize: 11.5, color: you ? 'var(--ink)' : 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            {you ? <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, boxShadow: `inset 0 0 0 2px ${T.color}` }}></span> : null}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.label}</span>
          </span>
          <span aria-hidden="true" style={{ width: 26, height: C.shape === 'poster' ? 34 : 26, borderRadius: 7, flexShrink: 0, background: wfCatArt(T.color, q.catalog + ':' + win.it.id), border: WF_LINE, boxSizing: 'border-box' }}></span>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: diverges ? 800 : 650, fontSize: 13.5, color: diverges ? 'var(--ink)' : 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{win.it.name}</span>
            <span style={{ position: 'relative', height: 4 }}>
              <span style={{ position: 'absolute', inset: 0, borderRadius: 99, background: 'color-mix(in oklch, var(--ink-3) 11%, transparent)' }}></span>
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.min(100, (win.share / headShare) * 320) + '%', borderRadius: 99, background: diverges ? T.color : WPAL.wash(T.color, 38) }}></span>
            </span>
          </span>
          {myRank ? <span style={{ flexShrink: 0, width: 26, textAlign: 'right', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, color: myRank <= 3 ? 'var(--ink)' : 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{'#' + myRank}</span> : null}
        </div>
      );
    };
    const nDiv = groups.filter((g) => wfPickGroup(q.id, cutKey + ':' + g.label, ranked, headShare)[0].it.id !== overall.id).length;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {this.renderCutChips(q, dim)}
        <div style={{ background: 'var(--ink)', color: 'var(--surface)', borderRadius: 12, padding: '12px 14px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, minWidth: 0 }}>{!groups.length ? 'None of your friends has answered this one yet' : nDiv ? nDiv + ' of ' + groups.length + ' put someone else first' : 'Every group agrees'}</span>
          <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, background: 'color-mix(in oklch, var(--surface) 22%, transparent)', borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>{overall.name}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>{groups.map(line)}</div>
        {mine != null ? <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textWrap: 'pretty' }}>{'# is where your pick lands in that group'}</span> : null}
      </div>
    );
  }

  // ── knowledge cards ──────────────────────────────────────────────────────
  // The one thing here unlike anything else on the market: a wrong answer with a
  // crowd split on it. The wrong options aren't dead ends, they're a map of what
  // people get wrong — “a fifth picked that too” reframes being wrong as being
  // normal, in the app's own language. Answer blind, then see the split: exactly
  // the opinion feed's instrument, pointed at something with a right answer.
  setKnow(q, i) {
    if (this.state.votes[q.id] != null) return;
    const r = LEARN.answer(q.learn, i);
    if (!r) return;
    const votes = { ...this.state.votes, [q.id]: i };
    // The pick reaches state, not storage — wfSave strips lrn- entries, on
    // purpose (D95): persisting it was what froze the next serve in this
    // reveal. The save still runs so the strip also SCRUBS any residue an
    // older build left, now rather than on the next world vote.
    wfSave(votes);
    this.setState((s) => ({ votes, knowRes: { ...s.knowRes, [q.id]: r } }));
  }
  // The verdict for THIS sitting's answer, or null. The rebuild-from-WF_LS
  // path that used to sit here is gone (D95): a know vote never outlives its
  // serve, so a card the scheduler re-serves arrives answerable instead of
  // frozen in a previous sitting's reveal. Within a sitting the serve list
  // is planned once (knowQs) and votes/knowRes are set together, so the
  // reveal you are watching survives every re-render.
  knowOf(q) {
    return this.state.knowRes[q.id] || null;
  }
  renderKnow(q, T, big) {
    const card = LEARN.card(q.learn);
    if (!card) return null;
    const r = this.knowOf(q);
    const my = this.state.votes[q.id];
    const fresh = !!this.state.knowRes[q.id];
    // The split and its provenance, read TOGETHER at render (D125).
    //
    // `r.split` is still returned by LEARN.answer and is still the same
    // arithmetic — but it is frozen at the instant of the tap, while the
    // footer below re-evaluates LEARN_SPLIT_SRC on every render. Those two
    // drifted apart the moment an aggregate arrived late: the bars kept the
    // authored estimate and the line under them started saying "Real
    // answers from N+ players". An authored number labelled as a
    // measurement is exactly what D32 built this seam to prevent, so the
    // numbers now come from the same evaluation as the label.
    const split = r ? LEARN_SPLIT(card) : null;
    const src = r ? LEARN_SPLIT_SRC(card) : null;
    // The counts behind the split. D149: what a reveal shows is HOW MANY
    // people picked each option, so the number is carried rather than
    // recovered from a percentage — 62% of an unstated denominator is a
    // share of nothing in particular, and it was the shape the authored
    // estimate used to wear.
    const tally = r ? LEARN_COUNTS(card) : null;
    const cs = LEARN.stateOf(q.learn);
    const streakNow = r ? r.streak : (cs && cs.s === 'learning' ? cs.k : 0);
    const pale = WPAL.wash(T.color, 18, 'var(--surface-2)');
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Display order, not authored order (learn-data.js LEARN_ORDER):
              the bank's first 96 cards all authored the correct answer at
              index 0, so mapping card.a straight down the screen made "tap
              the top" a perfect score. `ai` is the AUTHORED index and is
              what setKnow records —
              stored answers stay keyed exactly as they always were. `slot` is
              only where the button sits, so the reveal's stagger still runs
              top to bottom. */}
          {LEARN_ORDER(card).map((ai, slot) => {
            const label = card.a[ai];
            const isC = !!r && ai === r.correct;
            const isMine = !!r && my === ai;
            const pct = split ? split[ai] : 0;
            // Only where there is a measurement. In a live build with
            // nothing published yet `split` is null and no option carries
            // a number at all — the line under the rows says why.
            const showPct = !!split && (isC || (isMine && !r.ok));
            const nPicked = tally ? tally.counts[ai] : null;
            return (
              <button key={ai} className="press" disabled={!!r} onClick={() => this.setKnow(q, ai)}
                style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', minHeight: big ? 56 : 50, padding: big ? '14px 16px' : '12px 14px', borderRadius: 14, cursor: r ? 'default' : 'pointer', WebkitAppearance: 'none', transition: 'background .3s ease, color .3s ease',
                  border: isMine && !isC ? '1.5px solid var(--ink)' : WF_LINE,
                  background: isC ? WPAL.ink(T.color) : 'var(--surface-2)', color: isC ? '#fff' : r && !isMine ? 'var(--ink-3)' : 'var(--ink)' }}>
                {r && !isC && split ? <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%', background: pale, transformOrigin: 'left', animation: fresh ? `wfBarIn .55s cubic-bezier(.2,.8,.2,1) calc(var(--rv-row) * ${slot + 1.5}) both` : 'none' }}></span> : null}
                <span style={{ position: 'relative', flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontWeight: isC ? 800 : 600, fontSize: big ? 16.5 : 15, lineHeight: 1.3, textWrap: 'pretty' }}>{label}</span>
                {/* How many people actually picked this one (D149). The
                    count leads and the share follows it, because the
                    count is the fact and the share is the reading. */}
                {showPct ? <span style={{ position: 'relative', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {nPicked != null ? nPicked.toLocaleString() + (nPicked === 1 ? ' person · ' : ' people · ') : ''}
                  {fresh ? <WfCount to={Math.round(pct)} animate={true}></WfCount> : Math.round(pct)}%
                </span> : null}
                {isC ? <span style={{ position: 'relative', fontSize: 13, fontWeight: 800 }}>{'\u2713'}</span> : null}
                {r && isMine && !isC ? <span style={{ position: 'relative', fontSize: 13, fontWeight: 800, color: 'var(--ink-2)' }}>{'\u2715'}</span> : null}
              </button>
            );
          })}
        </div>
        {!r && streakNow > 0 ? <LMStreak k={streakNow} of={LEARN.STREAK} col={T.color}></LMStreak> : null}
        {r ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {r.mastered ? (
                <>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: T.color, flexShrink: 0 }}></span>
                  <span style={{ flex: 1, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14 }}>Saved to your map.</span>
                  <button onClick={() => { window.MAP_OPEN_GROUP = 'g-know'; NAV.goTab('mirror'); }} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, color: 'var(--ink-3)', WebkitAppearance: 'none' }}>See it</button>
                </>
              ) : r.ok && r.wasKnown ? (
                <>
                  <LMStreak k={LEARN.STREAK} of={LEARN.STREAK} col={T.color}></LMStreak>
                  <span style={{ flex: 1, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink-2)' }}>Still yours.</span>
                </>
              ) : r.ok ? (
                <>
                  <LMStreak k={r.streak} of={LEARN.STREAK} col={T.color}></LMStreak>
                  <span style={{ flex: 1, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink-2)' }}>{LEARN.STREAK - r.streak <= 1 ? 'One more and it\u2019s yours.' : (LEARN.STREAK - r.streak) + ' more in a row.'}</span>
                </>
              ) : (
                <>
                  <LMStreak k={0} of={LEARN.STREAK} col={T.color}></LMStreak>
                  <span style={{ flex: 1, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink-2)' }}>{r.lost ? 'Off your map — three in a row to win it back.' : 'Three in a row to earn it.'}</span>
                </>
              )}
            </div>
            {/* D149: in a live build the numbers above are answers or they
                are absent. The old third state — the authored estimate,
                labelled — is gone, so this line names the crowd it counted
                or says there is not one yet.

                The count is the aggregate's own total, with no floor under
                it. It used to read `total || 5`, which printed "5+ players"
                for a card two people had answered.

                D157 gave it the two sentences it was missing, both about
                WHOSE answers those are. "From 1 answer — everyone's first
                try at this card" is a true sentence that reads as broken
                data when the one answer is your own, and the
                first-tries-only rule is invisible on a re-serve — which is
                how a reader ends up looking at a tick beside "0 people ·
                0%" on the option they just picked. */}
            {LIVE.enabled ? (
              <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.45 }}>
                {/* THREE SOURCES, NOT TWO. This branched on 'measured'
                    alone, so 'loading' — a crowd read still in the air —
                    fell into the same arm as 'none' and the footer under
                    the answer you just tapped said "You're the first."
                    about a card thousands have answered.

                    D125's fourth source was added for exactly this and
                    reached the who-knows-this sheet and the Map's learn
                    card; this line is the one its commit message named
                    and its diff did not touch. */}
                {src === 'loading'
                  ? 'Counting\u2026'
                  : src === 'measured'
                    ? (() => {
                      const n = tally ? tally.total : 0;
                      if (r.repeat) return 'From ' + n.toLocaleString() + ' first ' + (n === 1 ? 'try' : 'tries') + ' — yours is a repeat, so it is not in there.';
                      if (n === 1) return 'Yours is the only answer so far.';
                      return 'From ' + n.toLocaleString() + ' first tries.';
                    })()
                    : 'You’re the first.'}
              </div>
            ) : null}
            {card.w ? <p style={{ margin: 0, fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, color: 'var(--ink-2)', textWrap: 'pretty' }}>{card.w}</p> : null}
            {this.opts.reveal ? this.renderKnowInsight(q, T) : null}
            <LMFriends card={card} col={T.color}></LMFriends>
          </div>
        ) : null}
      </div>
    );
  }

  // pick cards: one favourite from a shipped catalogue; the vote stored is
  // the entry's key (docs/CATALOG-QUESTIONS.md — a key, never a string).
  // Live cards persist through LIVE.votePick — create-only, no edit path
  // (D14) — and skip the demo store, whose baked crowd must not absorb
  // real picks; the optimistic WF_LS write is shared, and a refused write
  // is reconciled the same way votes are (LIVE scrubs the mirror, the
  // subscribe hook above deletes the local echo).
  setPick(q, entity) {
    this.setState((s) => {
      const votes = { ...s.votes, [q.id]: { entity } };
      wfSave(votes);
      return { votes };
    });
    const L = q.live && LIVE;
    if (L && L.votePick) L.votePick(q.id, entity);
    else PICKS.pick(q.id, entity);
  }

  // The live pick card's board source: LIVE's published canon for q.live,
  // the demo store otherwise — one seam, so renderPick and the thin bar
  // cannot disagree about where a board comes from. TOP_N is the shared
  // CANON_BOARD_N (an ESM import — data/deck.ts, the D51 logic-gen
  // precedent), pinned against the server's CANON_TOP_N in vote.test.ts.
  //
  // LIVE and PICKS are the IMPORTED bindings, not `window.*`. This seam
  // landed on main while this file was coming off the bridge (D249), and
  // the header above is explicit that no window.LIVE read may join it
  // (there are none left since D354). `return PICKS` for the same reason
  // the `PK ?` guards below are gone: an imported binding cannot be unset,
  // so the fallbacks they guarded are unreachable (D108).
  pickSrc(q) {
    const L = q.live && LIVE;
    if (L && L.pickCanon) {
      return { canon: (id) => L.pickCanon(id), segs: (id) => L.pickSegs(id), canonSeg: (id, d, b) => L.pickSeg(id, d, b), TOP_N: CANON_BOARD_N };
    }
    return PICKS;
  }

  // Which catalogue a pick question resolves against (D15: pokemon is
  // dex-keyed, films/artists are QID-keyed; same load/peek/nameOf shape).
  // EVERY domain must be named here explicitly: the pokedex fallback
  // means a missing arm resolves that domain's keys against dex numbers
  // — real names, wrong catalogue — which is exactly what shipped for
  // elements (pk11–pk14, 2026-08-11→15): reveals rendered atomic number
  // 42 as the 42nd Pokémon. Found by check:globals' dead-publication
  // rule when the countries domain wired up; catalogs.test.ts now pins
  // every PICK_QS domain to an arm of this resolver.
  pickStore(domain) {
    return domain === 'films' ? FILMS
      : domain === 'artists' ? ARTISTS
      : domain === 'athletes' ? ATHLETES
      : domain === 'emoji' ? EMOJI
      : domain === 'elements' ? ELEMENTS_CATALOG
      : domain === 'countries' ? COUNTRIES
      : domain === 'dogs' ? DOGS
      : domain === 'colors' ? COLORS
      : domain === 'languages' ? LANGUAGES
      : POKEDEX;
  }

  // key → display name, resolved at render time. The catalogue loads
  // lazily, so a reveal rendered before it arrives kicks the load once and
  // re-renders on completion; null means "not yet", and callers show a
  // placeholder rather than the raw key.
  pickName(entity, domain) {
    if (entity == null) return null;
    const store = this.pickStore(domain);
    if (!store) return null;
    if (entity === store.NOT_LISTED) return 'Not listed';
    const list = store.peek();
    if (!list) {
      const kicked = this._catKick || (this._catKick = {});
      if (!kicked[domain]) {
        kicked[domain] = 1;
        store.load().then(() => this.setState({ dexTick: 1 }), () => { kicked[domain] = 0; });
      }
      return null;
    }
    return store.nameOf(list, entity);
  }

  // a live pick may exist only server-side (fresh device, no local mirror
  // yet) — myVotes holds the entity, and the card must show its reveal
  // rather than offer the picker again (dialVal's precedent)
  pickVal(q) {
    const v = this.state.votes[q.id];
    const L = LIVE;
    if (v != null || !q.live || !L.myVotes) return v;
    const b = L.myVotes()[q.id];
    return b == null ? null : { entity: Number(b) };
  }

  renderPick(q, T, big) {
    if (q.catalog) return this.renderPickCatalog(q, T, big);
    const v = this.pickVal(q);
    const store = this.pickStore(q.domain);
    if (v == null) {
      // The browse row (D308): the catalogue's popularity head as tiles
      // over the search, so the domain is visible before you know what to
      // type. ONLY the sitelink-ranked domains — their file's head IS a
      // fame ranking; offering the alphabetical catalogues' head as if it
      // were one would be the D1 shape of misleading. peek() is the
      // committed file already parsed; the one load it may kick is the
      // same fetch the picker itself pays on open.
      const tiled = q.domain === 'films' || q.domain === 'artists' || q.domain === 'athletes';
      let head = [];
      if (tiled && store && store.peek) {
        head = (store.peek() || []).slice(0, 8).map((e) => ({ id: e.key, name: e.name }));
        if (!head.length && store.load) {
          const kicked = this._tileKick || (this._tileKick = {});
          if (!kicked[q.domain]) {
            kicked[q.domain] = 1;
            store.load().then(() => this.setState({ dexTick: (this.state.dexTick || 0) + 1 }), () => { kicked[q.domain] = 0; });
          }
        }
      }
      const search = <PickSearch domain={q.domain} accent={T.color} big={big} onPick={(id) => this.setPick(q, id)} onNotListed={() => this.setPick(q, store ? store.NOT_LISTED : 0)} />;
      if (!head.length) return search;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PickTiles domain={q.domain} entries={head} accent={T.color} onPick={(id) => this.setPick(q, id)} />
          {search}
        </div>
      );
    }
    // The reveal is a canon, not a split: a top board and everyone else in
    // one bucket. Your own pick always shows to YOU — it is your own
    // answer — and when it is not on that board the copy says which
    // absence it is: "below the floor" on a demo card, where a floor
    // really is applied, and "not on the board" on a live one, where since
    // D98 there is no floor and the pick is counted exactly like any
    // other. This paragraph said "above the floor" and "below the floor"
    // for both, which is the pre-D98 model. Segment chips
    // (D17) reorder the SAME board by one cohort's counts — a segment
    // never surfaces entities the global board suppressed.
    const PK = this.pickSrc(q);
    const c = PK.canon(q.id);
    const segs = PK.segs(q.id);
    const sel = (this.state.pickSeg || {})[q.id] || null;
    // `sel ?` stays — that is a DATA condition (no chip picked yet).
    const seg = sel ? PK.canonSeg(q.id, sel.dim, sel.bucket) : null;
    const rows = seg ? seg.rows : c.top;
    const mineName = this.pickName(v.entity, q.domain);
    const max = rows.length ? rows[0].count : 1;
    const inTop = c.top.some((r) => r.entity === v.entity);
    const setSeg = (next) => this.setState((s) => ({ pickSeg: { ...(s.pickSeg || {}), [q.id]: next } }));
    // The catalogue's core move (v15): yours against the crowd's, as two
    // tiles. Shares are real fractions of the whole vote (c.total), and a
    // rank is a place on the PUBLISHED board only — a below-floor pick keeps
    // the "too few to count" line instead of a fabricated #n.
    const leader = c.top[0] || null;
    const myIdx = c.top.findIndex((r) => r.entity === v.entity);
    const myRow = myIdx >= 0 ? c.top[myIdx] : null;
    const agree = !!leader && v.entity === leader.entity;
    const notListed = store && v.entity === store.NOT_LISTED;
    const shareOf = (count) => (c.total ? ((count / c.total) * 100).toFixed(1) + '%' : '');
    // The tail is real and the copy says why it is hidden — without naming
    // it. The entity count renders only when the fold covers at least two
    // entries (the subtraction-leak rule the backend fold keeps) and steps
    // down like the vote counts do, so it never ticks per-answer.
    const nounOf = { pokemon: 'Pokémon', emoji: 'emoji', films: 'films', artists: 'artists', athletes: 'athletes', languages: 'languages' };
    const foldNoun = nounOf[q.domain] || 'picks';
    const foldNote = c.restEntities >= 5
      ? ` votes across ${Math.floor(c.restEntities / 5) * 5}+ other ${foldNoun}`
      : c.restEntities >= 2 ? ` votes across a few other ${foldNoun}` : '';
    const foldWhy = foldNote && c.restBelowFloor ? ' — none with 5 yet' : '';
    // THE TILE'S ABSENT-COUNT WORDING SPLITS ON `q.live`, like the ghost
    // row further down. `count` is null whenever the pick is not in the
    // board's top N — TOP_N is 10 over catalogues of a thousand entries, so
    // that is the ORDINARY case, not an edge. On a demo card there really
    // is a floor (`pick-data.js` filters on AGG_MIN_N) and "below the
    // floor" is true. Post-D98 the live board has no floor at all —
    // `LIVE.pickCanon`'s docstring says the tail "is simply everything
    // outside the top N" — so the same words are a false claim about a
    // real, exactly-counted number. The ghost row already made this split
    // and said why (COPY.md §3); the tile was not moved with it, so one
    // card said both things about the same pick.
    const TOPN = PK.TOP_N;
    const tile = (ent, nm, label, strong, count, rank) => (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: strong ? 'var(--ink-2)' : 'var(--ink-3)' }}>{label}</span>
        <span aria-hidden="true" style={{ width: '100%', height: 92, borderRadius: 12, background: wfCatArt(T.color, q.domain + ':' + ent), border: strong ? `1.5px solid ${T.color}` : WF_LINE, boxSizing: 'border-box', display: 'block' }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14.5, lineHeight: 1.2, textWrap: 'pretty', color: 'var(--ink)' }}>{nm || '\u2026'}</span>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{count != null ? (rank ? '#' + rank + ' on the board \u00b7 ' : '') + shareOf(count) : (q.live ? 'not on the board' : 'below the floor')}</span>
      </div>
    );
    const chip = (label, active, onTap) => (
      <button key={label} className="press" onClick={onTap} style={{ border: '0.5px solid ' + (active ? 'color-mix(in oklch, ' + T.color + ' 55%, var(--rule))' : 'var(--rule)'), borderRadius: 999, padding: '3px 10px', cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11.5, color: active ? 'color-mix(in oklch, ' + T.color + ' 70%, var(--ink))' : 'var(--ink-3)', background: active ? 'color-mix(in oklch, ' + T.color + ' 11%, transparent)' : 'transparent' }}>{label}</button>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 10 : 8, animation: 'popIn .3s cubic-bezier(0.2,0.8,0.2,1)' }}>
        {!seg && leader && !notListed && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 4 }}>
            {agree
              ? tile(v.entity, mineName, 'you and the crowd', true, myRow && myRow.count, myIdx + 1)
              : tile(v.entity, mineName, 'your pick', true, myRow && myRow.count, myRow ? myIdx + 1 : 0)}
            {!agree && tile(leader.entity, this.pickName(leader.entity, q.domain), 'the crowd', false, leader.count, 1)}
          </div>
        )}
        {segs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {chip('everyone', !sel, () => setSeg(null))}
            {segs.map((s) => chip(s.bucket.toLowerCase(), !!(sel && sel.dim === s.dim && sel.bucket === s.bucket), () => setSeg(s)))}
          </div>
        )}
        {rows.map((r, i) => {
          const name = this.pickName(r.entity, q.domain) || '…';
          const isMine = r.entity === v.entity;
          return (
            <div key={r.entity} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 18, flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: isMine ? 800 : 650, fontSize: big ? 14.5 : 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                  {isMine && <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: T.color, border: '2px solid var(--surface)', boxShadow: '0 0 0 1px ' + T.color, flexShrink: 0 }}></span>}
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{wfFmt(r.count)}</span>
                </div>
                <div style={{ marginTop: 3, height: 5, borderRadius: 999, background: 'color-mix(in oklch, ' + T.color + ' 8%, var(--surface-3))' }}>
                  <div className="rpv2-bar" style={{ width: Math.max(4, Math.round((r.count / max) * 100)) + '%', height: '100%', borderRadius: 999, transformOrigin: 'left', background: isMine ? T.color : 'color-mix(in oklch, ' + T.color + ' 45%, var(--surface-3))' }}></div>
                </div>
              </div>
            </div>
          );
        })}
        {!seg && !inTop && !notListed && (
          <>
            {rows.length > 0 && <span aria-hidden="true" style={{ display: 'flex', gap: 3, padding: '1px 0 1px 27px' }}>{[0, 1, 2].map((d) => <span key={d} style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-3)', opacity: 0.5 }}></span>)}</span>}
            {/* the ghost row: YOUR off-board pick, pinned under the board.
                Rendered from your own stored vote, never from published
                data — no one else's board shows it, so searching always
                ends in finding yourself without enumerating the tail. The
                meta line diverges with the source: the demo demonstrates
                the old floor's shape ("too few to count"), while a live
                pick always counted — exactly counted, inside "everyone
                else" — and is merely not among the board's top N, so
                saying "too few to count" there would be a false claim
                about a real number (COPY.md §3: claims are not word
                counts). */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 18, flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, color: 'var(--ink-3)', textAlign: 'right' }}>—</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 14.5 : 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mineName || '…'}</span>
                  <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: T.color, border: '2px solid var(--surface)', boxShadow: '0 0 0 1px ' + T.color, flexShrink: 0 }}></span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{q.live ? 'counted with everyone else — not on the board yet' : 'only you see this — too few to count yet'}</span>
                </div>
                <div style={{ marginTop: 3, height: 5, borderRadius: 999, border: '1px dashed color-mix(in oklch, ' + T.color + ' 40%, var(--rule))', boxSizing: 'border-box', background: 'transparent' }}></div>
              </div>
            </div>
          </>
        )}
        {seg ? (
          <span style={{ paddingLeft: 27, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>the crowd&apos;s board, as {wfFmt(seg.cohort)} {sel.bucket.toLowerCase()} answers order it</span>
        ) : c.rest > 0 && (
          <span style={{ paddingLeft: 27, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', textWrap: 'pretty' }}>everyone else · {wfFmt(c.rest)}{foldNote}{foldWhy}</span>
        )}
        {/* a sparse board reads as anticipation, not absence: name the empty
            spots and what claims one, instead of a shorter list that looks
            like a bug. Demo boards are full, so this is a launch-era line.
            The vote-count clause is the demo's alone: live boards are exact
            since D98 — any vote claims a spot — so the live line names the
            spots and stops. */}
        {!seg && rows.length < TOPN && (
          <span style={{ paddingLeft: 27, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>{rows.length} of {TOPN} spots on the board claimed{q.live ? '' : ' — a spot needs 5 votes'}</span>
        )}
        {/* the below-floor case now lives in the ghost row above */}
        {(notListed || inTop) && (
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
            {notListed
              ? <>you: Not listed — counted with everyone else, never enumerated</>
              : <>you: {mineName || '…'}</>}
          </span>
        )}
      </div>
    );
  }

  // ── card bodies ──
  // One line on the card you just answered — the reason, while it is warm.
  // Submitting adds it to YOUR takes (addTake), which is local state; it is
  // offered only on demo cards, because a live card shows no takes at all.
  renderWhy(q, T) {
    if (!this.opts.why || this.state.whyFor !== q.id) return null;
    const v = this.state.votes[q.id];
    const col = typeof v === 'number' && q.options ? wfShade(T.color, v) : 'var(--ink-3)';
    return (
      <form onSubmit={(e) => { e.preventDefault(); const el = e.target.elements.why; const t = el.value.trim(); if (t) this.addTake(q.id, t); this.setState({ whyFor: null }); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <span style={{ width: 4, alignSelf: 'stretch', minHeight: 30, borderRadius: 2, background: col, flexShrink: 0 }}></span>
        <input name="why" placeholder="Why?" style={{ flex: 1, minWidth: 0, border: 'none', borderBottom: WF_LINE, background: 'none', padding: '6px 2px', fontFamily: 'var(--sans)', fontSize: 'var(--field-size)', fontWeight: 500, color: 'var(--ink)', outline: 'none' }} />
        <button type="button" onClick={() => this.setState({ whyFor: null })} aria-label="Skip" style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, color: 'var(--ink-3)', WebkitAppearance: 'none' }}>{'\u00d7'}</button>
      </form>
    );
  }

  // Which side each of the demo friends came down on. INVENTED from a hash,
  // exactly like the same map in renderStats below — WF_FRIENDS are not real
  // people and this is not a real reading of anyone's vote. Callers must gate
  // it on !q.live; a named who-voted at world scale is what D1 forbids, and
  // on a live card it would additionally be a fabrication.
  friendSides(q, counts) {
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    return WF_FRIENDS.filter((f) => wfDid(q, f)).map((f) => {
      const r = wfHash(q.id + ':' + f.name); let acc = 0, oi = counts.length - 1;
      for (let i = 0; i < counts.length; i++) { acc += counts[i] / total; if (r < acc) { oi = i; break; } }
      return { ...f, oi };
    });
  }

  // A current-events card is closing for real (D231): the same ring, drained
  // by the question's own window instead of by the hour of the day.
  //
  // This is the grace note below with a fact behind it. `renderClock` picks
  // a card by hash and counts down the wall clock, which is honest only
  // because it says nothing — a `now` card has a real deadline, and the two
  // must never appear on the same card, or the invented one borrows the
  // credibility of the real one. The kicker's ternary is where that holds.
  renderWindow(T, win) {
    const C = 2 * Math.PI * 7;
    return (
      <span title={`${win.daysLeft} of ${win.days} days left to answer`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11.5, color: 'var(--ink-2)' }}>
        <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="7" fill="none" stroke="var(--rule)" strokeWidth="2.6"></circle>
          <circle cx="10" cy="10" r="7" fill="none" stroke={T.color} strokeWidth="2.6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - win.frac)} transform="rotate(-90 10 10)"></circle>
        </svg>
        {win.label}
      </span>
    );
  }

  // One question in view is closing — a ring draining with the day. Purely a
  // clock: it reads the wall time and nothing about the question, so it
  // cannot disclose a count.
  renderClock(T) {
    const now = new Date();
    const left = Math.max(1, 24 - now.getHours());
    const frac = left / 24, C = 2 * Math.PI * 7;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11.5, color: 'var(--ink-2)' }}>
        <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="7" fill="none" stroke="var(--rule)" strokeWidth="2.6"></circle>
          <circle cx="10" cy="10" r="7" fill="none" stroke={T.color} strokeWidth="2.6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 10 10)"></circle>
        </svg>
        {left}h
      </span>
    );
  }

  // An unanswered card gets a comfortable floor so the question has air; an
  // answered one shrinks to its result and lets the next question rise into
  // view rather than ending on a screen of empty ground.
  cardFloor(answered) {
    const vh = this.state.vh || 620;
    return answered ? 0 : Math.min(Math.max(vh - 300, 260), 400);
  }

  openSheet(q, T, panel, dim) {
    this.setState((s) => ({ sheet: { q, T, panel }, sideFilter: null, replyTo: null, dims: dim && q ? { ...s.dims, [q.id]: dim } : s.dims, cutAxis: dim && q ? { ...s.cutAxis, [q.id]: null } : s.cutAxis }));
  }

  renderFloorNote(big) {
    return (
      <div style={{ fontSize: big ? 12.5 : 11.5, fontWeight: 600, color: 'var(--ink-3)', padding: '2px 2px 0' }}>
        {/* real characters, not \u escapes: JSX text children are literal,
            so an escape here renders as a visible backslash on the card.
            Since D98 this state only ever means "the trigger hasn't landed
            yet" — there is no floor left to wait for. */}
        You’re first — the count lands in a moment.
      </div>
    );
  }

  // The selfOnly counterpart (D50): a lens question whose bank carries no
  // lens rows records to the on-device instrument and nowhere else — no
  // backend aggregate exists, so there is no split to reveal at any k.
  // Where every other card answers with the crowd, this one answers with
  // where the answer went. Since D91 seeded banks serve lens cards live
  // and this note is the pre-D91-backend fallback only. T.label is the
  // lens's own title (renderCard's kicker derivation), so the line names
  // the destination.
  renderSelfNote(q, T, big) {
    return (
      <div style={{ fontSize: big ? 12.5 : 11.5, fontWeight: 600, color: 'var(--ink-3)', padding: '2px 2px 0' }}>
        {'Saved to your ' + T.label + ' lens — only you see it.'}
      </div>
    );
  }

  renderVote(q, T, big) {
    const mine = this.state.votes[q.id];
    if (mine != null && this.state.beat === q.id) return this.renderBeat(q, T, big);
    // editFor re-opens the options on an answered card (D86) — the tap
    // lands in setVote, which routes an answered live card through
    // LIVE.editVote instead of the create-only vote().
    const editing = mine != null && !!this.state.editFor[q.id];
    if (mine == null || editing) {
      // one split ballot, the daily's own grammar (2026-09-02): two sides
      // side by side divided by a hairline seam — the seam is what moves
      // to the crowd's split once you vote — and three or more stack as
      // rows inside the same block. The dot carries the option's hue; the
      // ground is neutral, so the revealed tiles are the payoff.
      const two = q.options.length === 2;
      return (
        <div style={{ display: 'grid', gridTemplateColumns: two ? '1fr 1fr' : '1fr', gap: 2, height: two ? (big ? 84 : 68) : undefined, borderRadius: big ? 20 : 16, overflow: 'hidden', background: 'var(--rule)', border: WF_LINE }}>
          {q.options.map((o, i) => (
            <button key={i} className="press" onClick={() => this.setVote(q, i)} style={{ minHeight: big ? 52 : 44, border: 'none', borderRadius: 0, background: editing && mine === i ? 'color-mix(in oklch, ' + T.color + ' 10%, var(--surface-2))' : 'var(--surface-2)', boxShadow: 'none', padding: big ? '0 16px' : '0 13px', display: 'flex', flexDirection: two ? 'column' : 'row', alignItems: two ? 'flex-start' : 'center', justifyContent: 'center', gap: two ? 7 : 11, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: big ? 16.5 : 14, letterSpacing: '-0.01em', color: 'var(--ink)', WebkitAppearance: 'none' }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: this.opts.v2 ? T.color : wfOpt(T.color, i, q.options.length), flexShrink: 0 }}></span>
              <span style={{ textWrap: 'pretty' }}>{o.label}{editing && mine === i && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{' · your pick'}</span>}</span>
            </button>
          ))}
        </div>
      );
    }
    // Below the k-floor there are no numbers to lay out, so the tile
    // treatment — whose whole point is that height IS share — would be
    // drawing a split it has not been told. Bars degrade honestly. A
    // selfOnly card (a live session's lens question — D50) is the same
    // problem wearing authored counts: numbers exist, a measurement does
    // not, so it takes the bars path too.
    const floored = wfNoCrowd(q) || !!q.selfOnly;
    return this.opts.reveal && !floored
      ? this.renderVoteTiles(q, T, big)
      : this.renderVoteBars(q, T, big);
  }

  // The result as a stack whose HEIGHTS are the shares — a 52/48 reads as
  // 52/48 rather than as a winner and an also-ran. Only ever reached above
  // the floor (see renderVote), so every option can carry its own number.
  renderVoteTiles(q, T, big) {
    const mine = this.state.votes[q.id];
    const { p, c, total } = wfPcts(q.options.map((o) => o.count), mine);
    const maxP = Math.max(...p);
    // THE LEADER IS A QUESTION ABOUT COUNTS, NOT ABOUT THE DRAWN SHARES.
    // `world-feed-math.js` states it and gives the case: sharePcts "does
    // not guarantee distinctness, so two different counts can print the
    // same integer. [449, 451, 100] draws [45, 45, 10]." `renderMeta` was
    // converted to `c` for exactly this — it is why a voter whose option
    // had strictly fewer votes stopped being told they were "with the
    // majority". The three places that decide the winner's STYLING were
    // not, so on 449 vs 451 both sides still got the winner's weight, size
    // and ink, on the same card whose sentence had been corrected.
    const maxN = Math.max(...c);
    const fresh = this._fresh === q.id;
    const n = q.options.length;
    const v2 = this.opts.v2;
    const sides = q.live ? [] : this.friendSides(q, q.options.map((o) => o.count));
    // one row budget per option, so two options do not tower over four.
    // Two sides keep the ballot's own row: the seam sits at the crowd's
    // split, so their share is a width and the height is fixed.
    const two = n === 2;
    const H = two ? (big ? 112 : 92) : (big ? 58 : 46) * n + (n - 1) * 7;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 11 : 9, animation: !v2 && fresh ? 'popIn .32s cubic-bezier(0.2,0.8,0.2,1)' : 'none' }}>
        <div style={{ display: 'flex', flexDirection: two ? 'row' : 'column', gap: 7, height: H }}>
          {q.options.map((o, i) => {
            // v2: one hue per card. Tint strength tracks share, so 52/48 reads
            // as 52/48 and not as two differently-coloured teams.
            const col = v2 ? T.color : wfOpt(T.color, i, n);
            const tint = 8 + 24 * (p[i] / (maxP || 1));
            const isMine = mine === i;
            const fr = sides.filter((f) => f.oi === i);
            const win = c[i] === maxN;
            return (
              <div key={i} style={{ flex: Math.max(p[i], 4) + ' 1 0', minHeight: big ? 36 : 30, minWidth: 0, border: isMine ? '1.5px solid color-mix(in oklch, ' + col + ' 60%, var(--rule))' : WF_LINE, borderRadius: big ? 16 : 13, background: 'color-mix(in oklch, ' + col + ' ' + (v2 ? tint.toFixed(1) : 26) + '%, var(--surface))', overflow: 'hidden', position: 'relative', transition: 'flex-grow .7s cubic-bezier(0.2,0.8,0.2,1)' }}>
                <div style={two
                  ? { height: '100%', display: 'flex', flexDirection: 'column-reverse', alignItems: 'flex-start', justifyContent: 'center', gap: 3, padding: big ? '0 16px' : '0 12px' }
                  : { height: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: big ? '0 18px' : '0 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: two ? 'none' : 1, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: win ? 800 : 700, fontSize: big ? (two ? 16 : 19) : (two ? 13.5 : 15), letterSpacing: '-0.02em' }}>{o.label}</span>
                    {/* your mark is a stamp, not a footnote — "· you" beside
                        a label read as punctuation at a glance */}
                    {isMine && <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 999, background: 'var(--ink)', color: 'var(--surface-2)', whiteSpace: 'nowrap', animation: !v2 && fresh ? 'chipPop .35s var(--ease-spring) var(--rv-2) both' : 'none' }}>you</span>}
                  </div>
                  {/* Friend marks: DEMO CARDS ONLY (the `sides` gate above —
                      WF_FRIENDS are invented, and on a live card this would
                      be both a fabrication and the named who-voted at world
                      scale that D1 forbids). Identity avatars since
                      2026-08-26, in BOTH drawings: v2 dropped the old
                      side-coloured dots as furniture, and the participation
                      gate (wfDid) is the design's answer to the same
                      problem — most tiles now carry none, so the two that
                      appear mean something. */}
                  {fr.length > 0 && (
                    <button onClick={() => this.openSheet(q, T, 'stats')} aria-label={fr.map((f) => f.name).join(', ') + ' picked ' + o.label} style={{ display: 'flex', alignItems: 'center', padding: '4px 2px', border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0, WebkitAppearance: 'none', animation: fresh ? 'chipPop .35s var(--ease-spring) .55s both' : 'none' }}>
                      {fr.slice(0, 2).map((f, k) => wfFrAv(f, big ? 17 : 15, k))}
                      {fr.length > 2 && <span style={{ marginLeft: 4, fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-2)' }}>+{fr.length - 2}</span>}
                    </button>
                  )}
                  {/* every side carries its number — one read of the split,
                      not just the winner's */}
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: win ? 800 : 600, fontSize: big ? (win ? 24 : 17) : (win ? 18 : 14), letterSpacing: '-0.03em', color: win ? 'var(--ink)' : 'var(--ink-2)', flexShrink: 0 }}>{v2 || !win ? p[i] : <WfCount to={p[i]} animate={fresh}></WfCount>}%</span>
                </div>
              </div>
            );
          })}
        </div>
        {!this.footInstead(q) && this.renderMeta(q, T, big, total, c, mine)}
      </div>
    );
  }

  // Whether the v2 footer will carry this card's vote count, so the tiles can
  // drop renderMeta rather than printing the total twice.
  //
  // It is not simply `opts.v2`: renderEngage — the only caller of renderFoot —
  // returns early for live and demoInProd cards, and on those the meta line is
  // the ONLY place the count appears. Suppressing it there would delete the
  // scale of the vote from every real card.
  footInstead(q) {
    return this.opts.v2 && !q.live && !LIVE.demoInProd;
  }

  // The v2 footer: exactly ONE line under the result, in priority order —
  // the transient Mirror ripple, else the surprise cut, else the plain
  // scale of the vote. Where renderMeta stacks
  // two facts on one row, this picks the single one worth the line.
  //
  // Reached only from renderEngage's v2 branch, which sits below both the
  // `q.live` and `demoInProd` early returns — so `total` here is always a
  // demo count, never something the k-floor has an opinion about.
  renderFoot(q, T, insight) {
    const quiet = { fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' };
    const rip = this.state.ripple === q.id ? (WF_BRANCH[q.cat] || 'Interests') : null;
    if (rip) return (
      <button onClick={() => NAV.goTab('mirror')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--accent, var(--ink-2))', whiteSpace: 'nowrap', animation: 'toastFade 3.2s ease forwards' }}>added to {rip}<span aria-hidden="true">→</span></button>
    );
    if (insight) return insight;
    if (q.type === 'rate') {
      const c = PLACESTATS.cat(q.scope, q.catId);
      return <span style={quiet}>{wfFmt(c ? c.n : (q.n || 0))} ratings</span>;
    }
    if (q.type === 'dial' || q.type === 'field') return <span style={quiet}>{wfFmt(q.n || 0)} answers</span>;
    if (!q.options) return <span style={quiet}></span>;
    const mine = this.state.votes[q.id];
    const { total } = wfPcts(q.options.map((o) => o.count), mine);
    return <span style={quiet}>{wfFmt(total)} votes</span>;
  }

  // one quiet line: the scale of the vote, where you sit, and — briefly — where
  // the answer landed on your Mirror
  // `c` is the COUNT vector (with the viewer's own +1), not the drawn
  // percentages. The sentence below claims which side won, and that is a
  // question about counts: two different counts can round to the same
  // integer, so reading it off the percentages told a voter whose option
  // had strictly fewer votes that they were "with the majority".
  //
  // AND AT ONE VOTE THERE IS NO SIDE TO BE ON. `wfPcts` counts you, so a
  // total of 1 is your own vote and nothing else — and the line told you
  // that you were "with the majority" of yourself. It is the same claim
  // the consequence beat and the bars were making one method over, in the
  // one sentence small enough to look harmless: a majority needs somebody
  // to be in it besides the reader. The scale still prints; only the side
  // it claims you are on goes away.
  renderMeta(q, T, big, total, c, mine) {
    const maxN = Math.max(...c);
    const alone = total <= 1;
    const rip = this.state.ripple === q.id ? (WF_BRANCH[q.cat] || 'Interests') : null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 18 }}>
        <span style={{ fontSize: big ? 12.5 : 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>{this.state.editHold === q.id ? 'One change a minute — try again shortly.' : wfFmt(total) + (total === 1 ? ' vote' : ' votes') + (alone ? '' : (c[mine] === maxN ? ' · with the majority' : ' · you picked the underdog'))}</span>
        {rip && <button onClick={() => NAV.goTab('mirror')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--accent, var(--ink-2))', whiteSpace: 'nowrap', animation: 'toastFade 3.2s ease forwards' }}>added to {rip}<span aria-hidden="true">→</span></button>}
      </div>
    );
  }

  renderVoteBars(q, T, big) {
    const mine = this.state.votes[q.id];
    const counts = q.options.map((o) => o.count);
    const { p, c } = wfPcts(counts, mine);
    // THE LEADER IS A QUESTION ABOUT COUNTS, NOT ABOUT THE DRAWN SHARES.
    // `world-feed-math.js` states it and gives the case: sharePcts "does
    // not guarantee distinctness, so two different counts can print the
    // same integer. [449, 451, 100] draws [45, 45, 10]." `renderMeta` was
    // converted to `c` for exactly this — it is why a voter whose option
    // had strictly fewer votes stopped being told they were "with the
    // majority". The three places that decide the winner's STYLING were
    // not, so on 449 vs 451 both sides still got the winner's weight, size
    // and ink, on the same card whose sentence had been corrected.
    const maxN = Math.max(...c);
    const fresh = this._fresh === q.id;
    // selfOnly (D50): the fill width IS the share in a different alphabet
    // (D11's phrase, same reasoning), so it is gated together with the
    // numeral — the option rows stay, carrying only the label and your pick.
    //
    // Named for what it is. It was `noCrowd`, which is also this file's
    // word for a live card whose aggregate has not landed — two meanings,
    // one name, and the fill below asked this one while the numeral beside
    // it asked the other. So a fresh live card suppressed its percentage
    // and drew the bar to that percentage's width anyway: the split
    // published geometrically while being withheld numerically, which is
    // the failure the comment above already names. `noSplit` is both.
    const selfOnly = !!q.selfOnly;
    const noSplit = selfOnly || wfNoCrowd(q);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 10 : 7, animation: fresh ? 'popIn .3s cubic-bezier(0.2,0.8,0.2,1)' : 'none' }}>
        {q.options.map((o, i) => (
          <div key={i} style={{ position: 'relative', border: mine === i ? '1px solid color-mix(in oklch, ' + T.color + ' 65%, var(--rule))' : WF_LINE, borderRadius: big ? 14 : 11, background: 'var(--surface)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: (noSplit ? 0 : p[i]) + '%', background: WPAL.wash(T.color, mine === i ? 30 : 15), animation: fresh ? 'barIn .7s cubic-bezier(0.2,0.8,0.2,1) ' + (i * 0.07) + 's both' : 'none' }}></div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 8, padding: big ? '13px 14px' : '9px 12px' }}>
              {mine === i && <span aria-label="Your pick" style={{ width: big ? 18 : 15, height: big ? 18 : 15, borderRadius: '50%', flexShrink: 0, alignSelf: 'center', background: WPAL.ink(T.color), display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg viewBox="0 0 24 24" width={big ? 10 : 8} height={big ? 10 : 8} fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5 10 18 19.5 6.5"></path></svg></span>}
              <span style={{ flex: 1, minWidth: 0, fontWeight: mine === i ? 800 : 700, fontSize: big ? 15 : 13.5 }}>{o.label}</span>
              {c[i] === maxN && !noSplit && <span style={{ fontWeight: 800, fontSize: big ? 20 : 15, color: 'var(--ink)' }}><WfCount to={p[i]} animate={fresh}></WfCount>%</span>}
            </div>
          </div>
        ))}
        {wfNoCrowd(q) && mine != null && this.renderFloorNote(big)}
        {selfOnly && mine != null && this.renderSelfNote(q, T, big)}
      </div>
    );
  }

  renderDuel(q, T, big) {
    const mine = this.state.votes[q.id];
    if (mine != null && this.state.beat === q.id) return this.renderBeat(q, T, big);
    const { p, c, total } = wfPcts(q.options.map((o) => o.count), mine);
    const fresh = this._fresh === q.id;
    const v2 = this.opts.v2;
    // THE LEADER IS A QUESTION ABOUT COUNTS, NOT ABOUT THE DRAWN SHARES.
    // `world-feed-math.js` states it and gives the case: sharePcts "does
    // not guarantee distinctness, so two different counts can print the
    // same integer. [449, 451, 100] draws [45, 45, 10]." `renderMeta` was
    // converted to `c` for exactly this — it is why a voter whose option
    // had strictly fewer votes stopped being told they were "with the
    // majority". The three places that decide the winner's STYLING were
    // not, so on 449 vs 451 both sides still got the winner's weight, size
    // and ink, on the same card whose sentence had been corrected.
    const maxN = Math.max(...c);
    // Below the floor there is no share to draw, and the fill height IS the
    // share — so the fill and the numeral are gated together. Drawing one
    // without the other would publish the split geometrically instead of
    // numerically, which is the same disclosure in a different alphabet.
    const shares = mine != null && !wfNoCrowd(q);
    // Label band at the top; the numeral rides the water line below it. Two things
    // keep them from ever meeting, at any tile height or percentage:
    //   1. the band reserves lines for what the labels ACTUALLY need (shared across
    //      the pair so both tiles stay balanced) rather than always two;
    //   2. the numeral's travel is clamped in CSS — max()/min() keep it off the tile
    //      floor and clear of the band, so it parks rather than colliding at the
    //      extremes, on any tile height.
    const labSize = big ? 20 : 15.5;
    const labLines = q.options.some((o) => (o.label || '').length > 13) ? 2 : 1;
    const bandH = Math.round(labSize * 1.15 * labLines) + (big ? 24 : 17);
    const pctSize = (win) => (big ? (win ? 30 : 23) : (win ? 23 : 18));
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {/* square tiles: question, both sides and both shares sit above the
            fold, so no number ever has to be scrolled to */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {q.options.map((o, i) => {
            const chosen = mine === i;
            const win = c[i] === maxN;
            // v2 drops the generated tile art for one quiet ground — the fill
            // is the only ink that moves, so it has to be the only thing there
            const bg = v2 ? 'var(--surface-2)' : wfTileArt(T.color, q.id);
            return (
              <button key={i} className={mine == null ? 'press' : ''} onClick={() => mine == null && this.setVote(q, i)} style={{ position: 'relative', aspectRatio: big ? '1 / 1' : '4 / 3', border: chosen ? '2px solid color-mix(in oklch, ' + T.color + ' 60%, var(--rule))' : WF_LINE, borderRadius: 14, overflow: 'hidden', background: bg, boxShadow: 'none', cursor: mine == null ? 'pointer' : 'default', padding: 0, WebkitAppearance: 'none', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', opacity: mine != null && !chosen ? 0.94 : 1, transition: 'opacity .45s ease', animation: !v2 && fresh && chosen ? 'tilePick .45s cubic-bezier(0.2,0.8,0.2,1)' : 'none' }}>
                {/* real photography when the question carries it; the generated
                    art stays the fallback. Fixed aspect above means the box never
                    moves, and .is-in only lands once the bitmap has decoded. */}
                {o.img && <img className="wf-tileimg" src={o.img} alt="" loading="lazy" decoding="async"
                  onLoad={(e) => e.currentTarget.classList.add('is-in')} />}
                {/* the share IS the tile — the side fills to its own percentage */}
                {shares && (
                  <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: p[i] + '%', background: 'color-mix(in oklch, ' + T.color + ' ' + (win ? 40 : 24) + '%, ' + (v2 ? 'var(--surface)' : 'transparent') + ')', borderTop: '1.5px solid ' + T.color, animation: fresh ? 'wfFillUp .85s cubic-bezier(0.2,0.8,0.2,1) var(--rv-1) both' : 'none', transition: 'height .7s cubic-bezier(0.2,0.8,0.2,1)' }}></span>
                )}
                {/* fixed band at the top, same height on both tiles — the label never
                    rides the fill, and the rising level never has to dodge it */}
                <span className="wf-tileband" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: bandH, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: big ? '13px 14px 0' : '10px 11px 0', boxSizing: 'border-box', background: o.img
                  ? 'linear-gradient(to bottom, color-mix(in oklch, var(--surface) 94%, transparent) 0%, color-mix(in oklch, var(--surface) 84%, transparent) 55%, transparent 100%)'
                  : 'linear-gradient(to bottom, color-mix(in oklch, var(--surface-2) 55%, transparent) 0%, color-mix(in oklch, var(--surface-2) 34%, transparent) 60%, transparent 100%)' }}>
                  <span className="wf-tilelab" style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: labSize, color: 'var(--ink)', textAlign: 'center', lineHeight: 1.15, letterSpacing: '-0.02em', display: '-webkit-box', WebkitLineClamp: labLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.label}</span>
                </span>
                {/* the share reads as one gesture: the numeral hangs under the water line,
                    inside the fill. Both bounds are pure CSS — min() keeps it clear of the
                    label band, max() keeps it off the tile floor — so it can never collide
                    at any tile height or percentage, without measuring anything. */}
                {shares && (() => {
                  const chipH = Math.round(pctSize(win) + 11);
                  return (
                    <span className="wf-tilepct" style={{ position: 'absolute', left: 0, right: 0, bottom: 'max(' + chipH + 'px, min(' + p[i] + '%, calc(100% - ' + (bandH + 2) + 'px)))', height: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', pointerEvents: 'none', animation: fresh ? 'wfPctRide .85s cubic-bezier(0.2,0.8,0.2,1) var(--rv-1) both' : 'none', transition: 'bottom .7s cubic-bezier(0.2,0.8,0.2,1)' }}>
                      <span style={{ marginTop: 3, fontFamily: 'var(--sans)', fontWeight: win ? 800 : 700, fontSize: pctSize(win), lineHeight: 1, letterSpacing: '-0.035em', color: win ? 'var(--ink)' : 'var(--ink-2)', padding: '3px 9px 4px', borderRadius: 9, background: 'color-mix(in oklch, var(--surface-2) 70%, transparent)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}><WfCount to={p[i]} animate={fresh}></WfCount>%</span>
                    </span>
                  );
                })()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  renderRank(q, T, big) {
    const done = this.rankVal(q);
    const D = big ? 28 : 24;
    const num = (filled, label) => (
      <span style={{ width: D, height: D, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 13 : 12, boxSizing: 'border-box', background: filled ? WPAL.ink(T.color) : 'transparent', color: filled ? '#fff' : 'var(--ink-3)', border: filled ? 'none' : '1.5px solid color-mix(in oklch, var(--ink-3), transparent 40%)' }}>{label}</span>
    );
    if (!done) {
      const cur = this.state.pending[q.id] || [];
      // picked items float to the top in pick order; the rest hold their line.
      const disp = [...cur, ...q.items.map((_, i) => i).filter((i) => cur.indexOf(i) < 0)];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 10 : 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' }}>Tap in your order</span>
          <WFFlipList gap={big ? 10 : 8} order={disp} rows={disp.map((i) => {
            const it = q.items[i];
            const pos = cur.indexOf(i);
            return { key: i, node: (
              <button className="press" onClick={() => this.tapRank(q, i)} style={{ width: '100%', boxSizing: 'border-box', border: pos >= 0 ? '1.5px solid ' + T.color : '0.5px solid color-mix(in oklch, ' + T.color + ' 28%, var(--rule))', borderRadius: big ? 14 : 12, background: pos >= 0 ? 'color-mix(in oklch, ' + T.color + ' 7%, var(--surface))' : 'color-mix(in oklch, ' + T.color + ' 4%, var(--surface))', boxShadow: 'none', padding: big ? '12px 13px' : '9px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--sans)', WebkitAppearance: 'none' }}>
                {num(pos >= 0, pos >= 0 ? pos + 1 : '')}
                <span style={{ fontWeight: 700, fontSize: big ? 15 : 13.5, color: 'var(--ink)' }}>{it}</span>
              </button>
            ) };
          })} />
        </div>
      );
    }
    const order = done.order;
    const v2 = this.opts.v2;
    // A live board nobody ELSE has ranked has no crowd to compare against
    // (the store subtracts your own folded order \u2014 D233): your sequence
    // stands alone, said plainly, instead of a comparison against a crowd
    // that is only you reading as perfect agreement.
    if (!q.crowd) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 9 : 7, animation: v2 ? 'none' : 'popIn .3s cubic-bezier(0.2,0.8,0.2,1)' }}>
          {order.map((it, pos) => (
            <div key={it} style={{ border: WF_LINE, borderRadius: big ? 13 : 11, background: 'var(--surface)', padding: big ? '11px 13px' : '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: D, height: D, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 13 : 12, background: WPAL.ink(T.color), color: '#fff' }}>{pos + 1}</span>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: big ? 15 : 13.5 }}>{q.items[it]}</span>
            </div>
          ))}
          <span style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' }}>{'You\u2019re first \u2014 the crowd\u2019s order builds from here'}</span>
        </div>
      );
    }
    const matches = order.filter((it, pos) => q.crowd[it] === pos + 1).length;
    // …and WHICH crowd. This card was the only answered live card with no
    // count anywhere on it: the daily prints its votes, the feed prints
    // its votes, the pick card prints "everyone else · N", and `renderEngage`
    // — the one place a live card's count is drawn — returns early for
    // rank. The crowd order exists the moment ONE other person has ranked,
    // so "the crowd" could be a single stranger, unlabelled (D146).
    //
    // `crowdN`, not `q.votes`: the viewer's own order is subtracted out of
    // the crowd when their fold has landed, so the total would overstate
    // it by one. The demo arm has always printed its own basis.
    const crowdN = q.live ? q.crowdN : 0;
    const matchLine = (
      <>
        You matched the crowd on {matches} of {q.items.length}
        {crowdN > 0 ? ' \u00b7 from ' + wfFmt(crowdN) + (crowdN === 1 ? ' other ranking' : ' other rankings') : ''}
      </>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 9 : 7, animation: v2 ? 'none' : 'popIn .3s cubic-bezier(0.2,0.8,0.2,1)' }}>
        {order.map((it, pos) => {
          const match = q.crowd[it] === pos + 1;
          return (
            <div key={it} style={{ border: WF_LINE, borderRadius: big ? 13 : 11, background: match ? wfTint(T.color, 1, 3) : 'var(--surface)', padding: big ? '11px 13px' : '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: D, height: D, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 13 : 12, background: WPAL.ink(T.color), color: '#fff' }}>{pos + 1}</span>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: big ? 15 : 13.5 }}>{q.items[it]}</span>
              {(!v2 || !match) && <span title={'Crowd ranked this #' + q.crowd[it]} style={{ width: D, height: D, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 12.5 : 11.5, boxSizing: 'border-box', color: match ? '#fff' : 'var(--ink-2)', background: match ? WPAL.ink(T.color) : 'transparent', border: match ? 'none' : '1.5px solid ' + WPAL.wash(T.color, 55, 'var(--rule)') }}>{q.crowd[it]}</span>}
            </div>
          );
        })}
        {/* The sheet behind the demo's arrow is renderRankStats \u2014 a
            fabricated friends-cohort read. A live card has no honest
            rank breakdown to open (the fold publishes sums, no by \u2014
            D233), so the line states the match and stops. */}
        {q.live
          ? <span style={{ alignSelf: 'flex-start', padding: '2px 0', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' }}>{matchLine}</span>
          : <button className="press" onClick={() => this.setState({ sheet: { q, T, panel: 'stats' }, sideFilter: null, replyTo: null })} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', WebkitAppearance: 'none' }}>{matchLine}<span aria-hidden="true" style={{ fontWeight: 700 }}>{'\u2192'}</span></button>}
      </div>
    );
  }

  // `mine` is an optional pre-fetched LIVE.myVotes(), for callers asking
  // this question about a whole bank at once. `myVotes()` hands back a
  // defensive COPY of the vote map on purpose (data/live.ts's perRev block
  // says why it is excluded from the memo), so taking it once per question
  // inside a loop over the pool is O(pool × votes) object churn to read one
  // key — and on a live build with a fresh device every dial, field, pick
  // and rank question takes that branch, because the server-side answer has
  // no local raw value.
  answered(q, mine) {
    // A Crossroads story (D341) is answered when its walk is finished. The
    // walk lives in PATHS (demo and live alike — the card writes each fork
    // there), and a live finish is ALSO a vote, which covers the returning
    // device whose localStorage is gone. An unfinished walk is not an
    // answer: the card stays in the fresh stream and resumes.
    //
    // BEFORE `wfAnsweredOf`, and that is the whole of the resolution here:
    // D341 landed on main after this branch extracted the shared helper,
    // so the helper has never heard of `path`. Handled early means it does
    // not have to. (`const v` went with the extraction — the tail that
    // read it is now inside the helper.)
    if (q.type === 'path') {
      if (PATHS.walkOf(q.id).length >= 3) return true;
      return !!(q.live && LIVE.myVotes && (mine || LIVE.myVotes())[q.id] != null);
    }
    // a live continuum answer may exist only server-side (fresh device, no
    // local raw value) — the bucket in myVotes is still an answer, and the
    // card must show its reveal rather than offer the question again
    return wfAnsweredOf(q, this.state.votes,
      LIVE.myVotes ? () => mine || LIVE.myVotes() : null);
  }

  // The feed's source pool, read in one place by the two callers that need
  // it: the stream itself and the topic sheet's per-channel counts.
  //
  // `window.` rather than an ESM import, and it is not a bridge relic:
  // data/live.ts REPLACES this array wholesale on boot (buildFeedGlobals),
  // so an imported binding would freeze the demo pool into a live build —
  // exactly the failure spec-index.js records for the module-scope read in
  // daily-split. One read behind one name keeps D39's meter honest about
  // that: this file couples to the global once, not once per caller.
  feedPool() { return window.WORLD_FEED_QS || []; }

  // ── takes + who-voted — open as bottom sheets (revealed only after answering) ──
  renderEngage(q, T, big) {
    // D1 scoped free-text takes to circles; D83 adopted D78 part 2, so a
    // live world card now carries ANONYMOUS world takes (LiveTakesPanel,
    // gid "world" — no author names, one take per person per question,
    // enforced moderation behind them). What stays circle-only forever is
    // NAMED speech and named who-voted. The who-voted panel shows because
    // it stopped being a lie: the breakdown is real anchor counts, floored
    // per cell with complementary suppression applied server-side (D8),
    // and it carries no names at all. D1 permits "the split, the totals"
    // at world scale — this is a split, sliced.
    //
    // demoInProd stays fully suppressed either way: that is a real user a
    // live build dropped into the mock fallback, where the synthetic
    // splits and the fake named people below would both be lies — and a
    // REAL takes composer beside fake results would be worse still.
    if (LIVE.demoInProd) return null;
    // A selfOnly card (a lens question against a bank with no lens rows —
    // D50; seeded banks serve lens cards live now, D91) has no crowd
    // behind it: takes, who-voted and the votes-count footer would all be
    // authored demo numbers wearing a live badge. The whole row goes, the
    // same way it does for demoInProd — the card's own note
    // (renderSelfNote) already says where the answer went.
    if (q && q.selfOnly) return null;
    if (q.live) {
      if (q.type === 'rank') return null;
      // The surprise line belongs HERE and only here: feedInsight reads
      // agg.by, which exists only for live questions, so leaving it below
      // this early return — as it was — meant it never rendered at all.
      const ins = this.renderInsight(q, T, big);
      // Collapsed until asked for: the panel fetches its list on mount
      // (one query per question per session), so the toggle is also the
      // cost gate — a scrolled-past card loads nothing.
      const takesOpen = !!this.state.liveTakesOpen[q.id];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 12 : 10, alignItems: 'stretch' }}>
          {ins}
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {/* the insight line is itself the way into the breakdown, so the
                bar-chart button would be a second door to the same room */}
            {!ins && (
              <button className="press" onClick={() => this.setState({ sheet: { q, T, panel: 'stats' }, sideFilter: null, replyTo: null })} aria-label="who voted" title="who voted" style={{ background: 'none', border: 'none', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', color: 'var(--ink)', WebkitAppearance: 'none' }}>
                <svg width={big ? 23 : 22} height={big ? 23 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19.5V13M12 19.5V5.5M19 19.5V10"></path></svg>
              </button>
            )}
            <button className="press" aria-expanded={takesOpen} onClick={() => this.setState((s) => ({ liveTakesOpen: { ...s.liveTakesOpen, [q.id]: !s.liveTakesOpen[q.id] } }))} style={{ background: 'none', border: 'none', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--ink)', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5 }}>
              <svg width={big ? 21 : 20} height={big ? 21 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 4.5h11a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H11l-4 3.8V15h-.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"></path></svg>
              Takes
            </button>
            {/* D86: re-open the options on an answered plain vote. The
                guard is the option-vote shape itself — catalog picks
                (entity objects), ranks and know cards never store a
                number here, and their server docs refuse edits anyway.
                Continuum cards are excluded by NAME: a live dial stores a
                raw number locally, but its change path is re-answering
                the control, not re-opening option rows it never had. */}
            {q.options && q.type !== 'dial' && q.type !== 'field' && typeof this.state.votes[q.id] === 'number' && !this.state.editFor[q.id] && (
              <button className="press" onClick={() => this.setState((s) => ({ editFor: { ...s.editFor, [q.id]: true } }))} style={{ background: 'none', border: 'none', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'var(--ink)', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5 }}>
                <svg width={big ? 21 : 20} height={big ? 21 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                Change
              </button>
            )}
          </div>
          {/* The option labels give every take its author's side and the
              list its side filter (D149). Guarded on the shape rather
              than passed blind: a dial, a field, a catalogue pick and a
              rank card all reach this row, and only an options-shaped
              question has sides to badge. */}
          {takesOpen && <LiveTakesPanel gid="world" qid={q.id}
            options={q.options && q.type !== 'dial' && q.type !== 'field'
              ? q.options.map((o) => o.label) : undefined} />}
        </div>
      );
    }
    // The 'add' panel has no question behind it, so every read of `q` from
    // here down has to tolerate its absence.
    const takes = q ? (WORLD_FEED_COMMENTS[q.id] || []) : [];
    const hasStats = true;
    const open = (id) => this.setState({ sheet: { q, T, panel: id }, sideFilter: null, replyTo: null });
    const D = big ? 32 : 30;
    const av = (bg, fg, txt, i) => (
      <span key={i} style={{ width: D, height: D, borderRadius: '50%', marginLeft: i ? -Math.round(D * 0.3) : 0, boxSizing: 'border-box', border: '2px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 13 : 12.5, background: bg, color: fg, position: 'relative', zIndex: 5 - i }}>{txt}</span>
    );
    const ico = (d) => (
      <svg width={big ? 23 : 22} height={big ? 23 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d={d}></path></svg>
    );
    const btn = (id, faces, glyph, aria) => (
      <button key={id} className="press" onClick={() => open(id)} aria-label={aria} title={aria} style={{ background: 'none', border: 'none', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', color: 'var(--ink)', WebkitAppearance: 'none' }}>
        {faces && <span style={{ display: 'flex' }}>{faces}</span>}{glyph}
      </button>
    );
    const nReplies = takes.reduce((a, c, i) => a + (this.state.replies[q.id + ':' + i] || []).length, 0);
    const nOwn = (this.state.myTakes[q.id] || []).length;
    // counters are takes too, so the badge counts them — otherwise the sheet
    // opens on visibly more argument than the card advertised
    const nCtr = this.opts.counter ? takes.reduce((a, c, i) => a + WF_COUNTERS(q.id + ':' + i).length, 0) : 0;
    const nTakes = takes.length + nReplies + nOwn + nCtr;
    const faceBg = (c) => (q.type === 'rate' ? (c.score != null ? wfRateBg(T.color, c.score) : 'var(--ink-3)') : (c.opt != null ? wfShade(T.color, c.opt) : 'var(--ink-3)'));
    const faceInk = (c) => (q.type === 'rate' ? (c.score != null ? wfRateInk(c.score) : '#fff') : (c.opt != null ? wfShadeText(c.opt) : '#fff'));
    const takeFaces = takes.slice(0, 3).map((c, i) => av(faceBg(c), faceInk(c), c.init[0], i));
    const nMore = nTakes - takeFaces.length;
    if (nMore > 0) takeFaces.push(av('var(--surface-2)', 'var(--ink-2)', nMore > 9 ? '9+' : '+' + nMore, takeFaces.length));
    // demo cards have no published breakdown, so there is no insight line to
    // show here — feedInsight is live-only. Kept as a variable so the two
    // branches below read the same as the prototype's.
    const insight = this.renderInsight(q, T, big);
    const takesBtn = btn('takes', takeFaces, ico('M6.5 4.5h11a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H11l-4 3.8V15h-.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z'), nTakes + ' takes');
    // v2: the surprise gets its own full-width line, then one quiet row —
    // scale of the vote on the left, the way into the takes on the right.
    if (this.opts.v2) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          {insight}
          {this.renderWhy(q, T)}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', minHeight: 30 }}>
            {this.renderFoot(q, T, null)}
            {takesBtn}
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 12 : 10, alignItems: 'flex-start' }}>
        {insight}
        {this.renderWhy(q, T)}
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          {takesBtn}
          {/* the insight line IS the way into the breakdown, so the bar-chart
              button would be a second door to the same room */}
          {hasStats && !insight && btn('stats', null, ico('M5 19.5V13M12 19.5V5.5M19 19.5V10'), 'who voted')}
        </div>
      </div>
    );
  }

  // ── the surprise line ── one published cut that disagrees with the room:
  // a cohort that leans harder than everyone else, or one that flips the
  // winner outright. Tapping it opens the full breakdown at that cut.
  //
  // Live questions only, and only above the floor — feedInsight returns null
  // for anything it cannot say, and this renders nothing rather than
  // inventing a line to fill the space. The floor is feedInsight's own
  // (`MIN_CELL`, matching the two sibling lines below); this said
  // "already-k-floored data", and D98 left no floor on the server at all,
  // so for as long as that stood the only floor named anywhere was one
  // that had been deleted.
  // the rate card's surprise: the cut that sits furthest from the score you gave.
  // Tapping it opens the breakdown already switched to that cut.
  renderRateInsight(q, T, big) {
    const v = this.state.votes[q.id];
    if (typeof v !== 'number') return null;
    const c = PLACESTATS.cat(q.scope, q.catId);
    const avg = c ? c.avg : 5;
    let best = null;
    WF_CUTS().forEach((cut) => {
      if (cut.id === 'friends') return;
      WF_GRP(cut.id, null).forEach((g) => {
        const a = wfRateAvg(q.id, cut.id + ':' + g.label, avg);
        const d = Math.abs(a - v);
        if (!best || d > best.d) best = { dim: cut.id, g: g.label, a, d };
      });
    });
    if (!best || best.d < 1.2) return null;
    const dir = best.a > v ? 'above' : 'below';
    return (
      <button onClick={() => this.openSheet(q, T, 'stats', best.dim)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', WebkitAppearance: 'none' }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: T.color, flexShrink: 0 }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontSize: big ? 14 : 13.5, fontWeight: 600, color: 'var(--ink-2)' }}>{best.g} · {best.d.toFixed(1)} {dir} you</span>
        <span aria-hidden="true" style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' }}>→</span>
      </button>
    );
  }

  // dial/field surprise: the cut that sits furthest from where you put yourself.
  // Always renders once answered — it is the card's door to the breakdown.
  // On a DEMO card the values are texture (wfHash), the same standing as
  // renderRateInsight's PLACESTATS read. On a LIVE card they are real
  // by-cells (agg.by), and the line stays silent — returns null — until a
  // cohort has at least three answers and a real gap to report, rather
  // than inventing a lean from one person's dot.
  renderDialInsight(q, T, big) {
    const v = this.dialVal(q);
    if (v == null) return null;
    let best = null;
    if (q.live) {
      const by = this.liveBy(q);
      if (!by) return null;
      for (const dim of Object.keys(by)) {
        for (const bucket of Object.keys(by[dim])) {
          const r = this.dialCellAvg(q, by[dim][bucket]);
          if (!r || r.n < 3) continue;
          const d = Math.abs(r.avg - v);
          if (!best || d > best.d) best = { dim, g: wfBucketLabel(dim, bucket), a: r.avg, d };
        }
      }
      if (!best || best.d < (q.hi - q.lo) * 0.05) return null;
    } else {
      WF_CUTS().forEach((cut) => {
        if (cut.id === 'friends') return;
        WF_GRP(cut.id, null).forEach((g) => {
          const a = this.dialGrpAvg(q, cut.id + ':' + g.label);
          const d = Math.abs(a - v);
          if (!best || d > best.d) best = { dim: cut.id, g: g.label, a, d };
        });
      });
      if (!best) return null;
    }
    return this.insightLine(q, T, best.dim, best.g + ' · ' + this.dialFmt(q, Math.round(best.a)) + ' vs your ' + this.dialFmt(q, v));
  }

  renderFieldInsight(q, T, big) {
    const v = this.fieldVal(q);
    if (v == null) return null;
    let best = null;
    if (q.live) {
      const by = this.liveBy(q);
      if (!by) return null;
      for (const dim of Object.keys(by)) {
        for (const bucket of Object.keys(by[dim])) {
          const r = this.fieldCellCentroid(by[dim][bucket]);
          if (!r || r.n < 3) continue;
          const d = Math.hypot(r.x - v.x, r.y - v.y);
          if (!best || d > best.d) best = { dim, g: wfBucketLabel(dim, bucket), x: r.x, d };
        }
      }
      if (!best || best.d < 18) return null;
    } else {
      WF_CUTS().forEach((cut) => {
        if (cut.id === 'friends') return;
        WF_GRP(cut.id, null).forEach((g) => {
          const [x, y] = this.fieldGrpPos(q, WF_CUTKEY(cut.id, null) + ':' + g.label);
          const d = Math.hypot(x - v.x, y - v.y);
          if (!best || d > best.d) best = { dim: cut.id, g: g.label, x, d };
        });
      });
      if (!best) return null;
    }
    const side = best.x > 50 === v.x > 50 ? 'far from you' : 'across the field from you';
    return this.insightLine(q, T, best.dim, best.g + ' · ' + side);
  }

  insightLine(q, T, dim, text) {
    return (
      <button className="press" onClick={() => this.openSheet(q, T, 'stats', dim)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box', border: WF_LINE, borderRadius: 14, background: 'var(--surface)', padding: '10px 14px', cursor: 'pointer', WebkitAppearance: 'none', textAlign: 'left' }}>
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: T.color, flexShrink: 0 }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13.5, lineHeight: 1.3, color: 'var(--ink)', flex: 1, minWidth: 0, textWrap: 'pretty' }}>{text}</span>
        <span aria-hidden="true" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', flexShrink: 0 }}>→</span>
      </button>
    );
  }

  renderInsight(q, T, big) {
    if (!this.opts.reveal) return null;
    if (q.type === 'rate') return this.renderRateInsight(q, T, big);
    if (q.type === 'dial') return this.renderDialInsight(q, T, big);
    if (q.type === 'field') return this.renderFieldInsight(q, T, big);
    if (!q.options) return null;
    const mine = typeof this.state.votes[q.id] === 'number' ? this.state.votes[q.id] : null;
    const counts = q.options.map((o) => o.count);
    // feedInsight here is the LIVE version (feed-read.js): it returns null
    // on demo cards rather than inventing a cohort (its header says why).
    //
    // `mine` — the third argument — IS READ, and this comment said the
    // opposite until the line below started depending on it. The live
    // implementation adds the viewer's own vote back into the room
    // baseline, because `o.count` has it subtracted and the card above
    // draws with it added; without it the line announces that a cohort
    // "flips it" to the option the card is already showing as the winner.
    // Dropping the arguments here on the old comment's authority would
    // bring that back with every gate green, because the test for it calls
    // feedInsight directly and never sees this call site.
    const ins = feedInsight(q, counts, mine, wfHash, WF_FRIENDS);
    if (!ins) return null;
    const n = q.options.length;
    const v2 = this.opts.v2;
    const other = ins.kind === 'friends' ? (ins.mySide === 0 ? 1 : 0) : ins.sideIdx;
    const col = v2 ? T.color : wfOpt(T.color, other, n);
    // v2: one hue — side reads as filled vs hairline-outlined, not a second colour
    const dot = (idx, k) => <span key={k} aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', boxSizing: 'border-box', flexShrink: 0, background: v2 ? (idx === 0 ? T.color : 'transparent') : wfOpt(T.color, idx, n), border: v2 && idx !== 0 ? '1.5px solid color-mix(in oklch, ' + T.color + ' 65%, var(--rule))' : 'none' }}></span>;
    const text = ins.kind === 'friends'
      ? (v2 ? (ins.of - ins.same) + ' of ' + ins.of + ' friends disagree' : (ins.of - ins.same) + ' of ' + ins.of + ' friends went the other way')
      : ins.group + (ins.kind === 'flip' ? (q.options.length > 2 ? ' flips it to ' + q.options[ins.sideIdx].label : ' flips it') : ' leans ' + q.options[ins.sideIdx].label);
    // full width, and it wraps rather than truncating — the line has to be readable
    if (v2) return (
      <button className="press" onClick={() => this.openSheet(q, T, 'stats', ins.dim)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', boxSizing: 'border-box', border: WF_LINE, borderRadius: 14, background: 'var(--surface)', padding: '10px 14px', cursor: 'pointer', WebkitAppearance: 'none', textAlign: 'left' }}>
        {dot(ins.kind === 'friends' ? (ins.mySide === 0 ? 1 : 0) : (ins.sideIdx === 0 ? 0 : 1), 'g')}
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13.5, lineHeight: 1.3, color: 'var(--ink)', flex: 1, minWidth: 0, textWrap: 'pretty' }}>{text}</span>
        {ins.pct != null && <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14.5, color: 'var(--ink)', flexShrink: 0 }}>{ins.pct}%</span>}
      </button>
    );
    return (
      <button className="press" onClick={() => this.openSheet(q, T, 'stats')} style={{ display: 'flex', alignItems: 'center', gap: 9, maxWidth: '100%', border: WF_LINE, borderRadius: 14, background: 'var(--surface)', padding: big ? '9px 15px' : '7px 12px', cursor: 'pointer', WebkitAppearance: 'none', textAlign: 'left' }}>
        <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: col, flexShrink: 0 }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 750, fontSize: big ? 13.5 : 12.5, color: 'var(--ink)', minWidth: 0, textAlign: 'left' }}>{text}</span>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 13.5 : 12.5, color: 'var(--ink)', flexShrink: 0 }}>{ins.pct}%</span>
      </button>
    );
  }

  // ── the bottom sheet — portaled to the app screen so it clears the tabbar ──
  renderSheet() {
    const s = this.state.sheet;
    if (!s) return null;
    const host = document.querySelector('.app');
    if (!host) return null;
    const { q, T, panel } = s;
    // The 'add' panel has no question behind it, so every read of `q` from
    // here down has to tolerate its absence.
    const takes = q ? (WORLD_FEED_COMMENTS[q.id] || []) : [];
    const close = () => {
      if (s.closing) return;
      this.setState({ sheet: { ...s, closing: true }, replyTo: null, reportFor: null });
      clearTimeout(this._sheetT);
      this._sheetT = setTimeout(() => this.setState((st) => (st.sheet && st.sheet.closing ? { sheet: null } : null)), 230);
    };
    // The topic list rises FROM the tab bar rather than over it (D211):
    // "Pick topics →" sends people here from the profile, and a
    // destination that hides the app's own way out reads as a trap —
    // reported from a device as the bottom navigation going missing. The
    // bar stays visible and tappable (the lifted scrim no longer covers
    // it); leaving the tab unmounts the feed and the sheet with it.
    // Measured, not a constant, because the bar's height moves with the
    // safe-area inset. Content sheets keep full cover — see Sheet.
    //
    // …unless something is standing over the bar (D282). The topic list can
    // now open ON the profile rather than by throwing the reader at the
    // feed, and `.overlay` covers the app at z-index 20 — so the bar D211
    // is keeping clear is not on screen to keep clear, and the lift would
    // leave a strip of the profile showing under the sheet instead of the
    // navigation it is there to protect. Full cover in that case, which is
    // what every content sheet does anyway.
    const overlaid = !!host.querySelector('.overlay');
    const barEl = panel === 'add' && !overlaid ? host.querySelector('.tabbar') : null;
    const lift = barEl ? barEl.offsetHeight : 0;
    return ReactDOM.createPortal(
      <Sheet onClose={close} closing={s.closing} lift={lift}
        label={panel === 'add' ? 'Add a topic' : panel === 'bg' ? 'About this question' : panel === 'takes' ? 'Takes' : panel === 'pick' || (q && q.type === 'pick') ? 'Who picked what' : panel === 'know' || (q && q.type === 'know') ? 'Who knows this' : q && q.type === 'rank' ? 'How people ranked' : 'Who voted'}>
          <div style={{ padding: '10px 18px 8px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15 }}>{panel === 'add' ? 'Add a topic' : panel === 'bg' ? (WF_BGTEXT(q) ? 'What you need to know' : 'About this question') : panel === 'takes' ? 'Takes' : panel === 'pick' || (q && q.type === 'pick') ? 'Who picked what' : panel === 'know' || (q && q.type === 'know') ? 'Who knows this' : q && q.type === 'rank' ? 'How people ranked' : 'Who voted'}</span>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12, color: 'var(--ink-3)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q ? (q.prompt || q.text || q.title) : ''}</span>
            <button className="tap44" onClick={close} aria-label="Close" style={{ border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', flexShrink: 0, WebkitAppearance: 'none' }}>{'\u2715'}</button>
          </div>
          <div className="wf-sheet-body">
            {panel === 'add' ? this.renderAdd() : panel === 'bg' ? this.renderContext(q, T) : panel === 'takes' ? this.renderTakes(q, T, takes) : this.renderStats(q, T)}
          </div>
      </Sheet>, host);
  }

  // ── your topics first, then more to follow: leaves, then communities ──
  // Scenes are a local, client-side subscription (SCENES) — following one
  // changes which questions the feed mixes in and nothing that leaves the
  // device.
  renderAdd() {
    const ST = SUBTOPICS;
    const label = { fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '4px 2px 6px' };
    // ── the topics that actually stock your feed ──────────────────────
    //
    // WHY THIS SECTION EXISTS. D96 was right to cut the demo communities:
    // "Writing · 2.1K people · Murakami, Solnit, Knausgård" with a Follow
    // button is a population invented about nobody, offered to a real user
    // (D1). But cutting them left a sheet called "Add a topic" holding
    // nothing but the Learn dial, and the owner read that on a device
    // exactly as it looks — "interests seem to have been removed, only the
    // sample data of fake amounts of users" (2026-08-12). Both halves of
    // that sentence were true, and the second one was the fix.
    //
    // The honest replacement is the thing D96 part 3 already made true and
    // never showed anyone: a live build runs EVERY subject its bank stocks,
    // always on. So this names them, counts them out of the bank the feed
    // is served from, and gives each the mute the chip row has. Every
    // number here is measured — questions in the bank, and how many of them
    // you have answered. No member counts, no vibes, nothing this build
    // cannot source. (Out of the bank, not the pool: see the count below —
    // it read the pool until the night of 2026-09-05, and the pool has
    // been a page since D321.)
    //
    // Channels only, not scenes and leaves: those two have a follow to
    // remove and surfaces that own it (the profile's scenes card, search),
    // while an always-on channel has no management surface anywhere else —
    // it is exactly the set that looked deleted.
    //
    // `n > 0` filters the same way SUBTOPICS.offers() does, and for D96's
    // reason rather than for tidiness: a room with nothing in it should not
    // be advertised — in a live build that is `places` (the bank mapper
    // still emits no rate cards; pick cards ride `fav` since D14 went
    // live).
    const catsOn = this.props.cats || {};
    const onToggle = this.props.onToggle;
    const stock = {};
    // Once for the whole walk — see answered()'s note on the copy.
    const myVotes = LIVE.myVotes ? LIVE.myVotes() : null;
    this.feedPool().forEach((q) => {
      if (!q || !q.cat) return;
      // Stock counts MEMBERSHIP — home plus `also` doors — because this
      // number advertises what a topic's shelf holds, and a straddler is on
      // every shelf it can be met through (docs/TAGS-PLAN.md §2). So this
      // is not a partition: per-topic stock can sum past the pool size, and
      // a reader adding the column is re-counting straddlers, not finding
      // a bug.
      const done = this.answered(q, myVotes);
      wfCarried(q).forEach((t) => {
        const s = stock[t] || (stock[t] = { n: 0, done: 0 });
        s.n++;
        if (done) s.done++;
      });
    });
    // THE BANK'S COUNT WHERE THE PUBLISHED ORDER CARRIES ONE, the pool's
    // otherwise — the same rule LEARN.total() follows, and here for the
    // same reported failure. Since D321 the feed's pool is core plus at
    // most FEED_PAGE tail rows per topic per boot, so counting it claimed
    // what the device had fetched. MEASURED on today's bank, first boot:
    // every topic under-reads, `fav` at 12 of 24 and `music` at 15 of 24,
    // and it heals only as later boots pull the next page. The published
    // count is MEMBERSHIP (rank.ts's
    // `carry`, home ∪ also) because that is what this row means and what
    // the mute below acts on; the client cannot compute it, since it sees
    // `also` only on the questions it already holds.
    //
    // `done` stays the pool's, and is not the same kind of number: the
    // pager heals history by id, so every feed question this account has
    // answered is fetched back into the pool whatever page it was on.
    // What you have answered is therefore fully in the pool even when
    // what there is to answer is not.
    //
    // Null (a demo build, or before the order loads) falls through to the
    // pool, which in a demo build IS the whole bank.
    const mine = WF_CHANNELS.map((id) => WF_TOPIC[id]).filter(Boolean)
      .map((t) => {
        const s = stock[t.id] || { n: 0, done: 0 };
        return { ...t, ...s, n: feedTopicTotal(t.id) ?? s.n };
      })
      .filter((t) => t.n > 0);
    const topicRow = (t) => {
      const on = catsOn[t.id] !== false;
      const col = WPAL.c(t.color);
      return (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 2px', borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)' }}>
          {/* filled when the topic is on, ringed when muted — the same
              on/off grammar the chip row's dot uses, so the two rails
              read as one control seen twice */}
          <span aria-hidden="true" style={on
            ? { width: 9, height: 9, borderRadius: '50%', background: col, flexShrink: 0 }
            : { width: 9, height: 9, borderRadius: '50%', background: 'transparent', boxShadow: `inset 0 0 0 1.5px ${col}`, flexShrink: 0 }}></span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14.5, color: on ? 'var(--ink)' : 'var(--ink-3)' }}>{t.label}</span>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 11.5, color: 'var(--ink-3)' }}>{t.n} question{t.n === 1 ? '' : 's'} · {t.done} answered{on ? '' : ' · muted'}</span>
          </div>
          {onToggle && (
            <button className="press" onClick={() => onToggle(t.id)} aria-pressed={!on}
              aria-label={(on ? 'Mute ' : 'Unmute ') + t.label}
              style={{ flexShrink: 0, border: on ? '0.5px solid var(--rule)' : 'none', borderRadius: 999, padding: '7px 14px', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', background: on ? 'var(--surface-2)' : 'var(--ink)', color: on ? 'var(--ink-2)' : 'var(--surface)', WebkitAppearance: 'none' }}>{on ? 'Mute' : 'Unmute'}</button>
          )}
        </div>
      );
    };
    // offers(), not all()/defs(): the stores decide what may be advertised —
    // stocked leaves only, and no demo communities in a live build (D96)
    const openLeaves = ST ? ST.offers().filter((s) => {
      if (ST.has(s.id)) return false;
      const own = SCENES.mine().some((g) => SCENES.subOf(g.id) === s.id);
      return !own;                                    // a followed community already covers its leaf
    }) : [];
    const open = SCENES.offers().filter((g) => !SCENES.has(g.id)).sort((a, b) => b.match - a.match);
    const LF = LEARN_FEED;
    const learnOpen = LEARN.fields().filter((f) => !LEARN.has(f.id));
    const learnMine = LEARN.fields().filter((f) => LEARN.has(f.id));
    const row = (key, col, name, meta, onFollow, ring) => (
      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 2px', borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)' }}>
        {col && <span aria-hidden="true" style={ring ? { width: 10, height: 10, borderRadius: '50%', background: 'transparent', boxShadow: `inset 0 0 0 2.5px ${col}`, flexShrink: 0 } : { width: 9, height: 9, borderRadius: '50%', background: col, flexShrink: 0 }}></span>}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14.5 }}>{name}</span>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 11.5, color: 'var(--ink-3)' }}>{meta}</span>
        </div>
        <button className="press" onClick={onFollow} style={{ flexShrink: 0, border: 'none', borderRadius: 999, padding: '7px 14px', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', background: 'var(--ink)', color: 'var(--surface)', WebkitAppearance: 'none' }}>Follow</button>
      </div>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {mine.length ? <div style={label}>Your topics</div> : null}
        {mine.map(topicRow)}
        {openLeaves.length ? <div style={{ ...label, marginTop: mine.length ? 18 : 4 }}>Topics</div> : null}
        {openLeaves.map((s) => row(s.id, WPAL.c((WF_TOPIC[s.parent] || {}).color), s.label,
          `${(WF_TOPIC[s.parent] || {}).label || s.parent} · ${ST.count(s.id)} questions`,
          () => { ST.follow(s.id); this.forceUpdate(); }))}
        {open.length ? <div style={{ ...label, marginTop: openLeaves.length || mine.length ? 18 : 4 }}>Communities</div> : null}
        {open.map((g) => row(g.id, SCENES.colorOf(g.id), g.name,
          `${wfFmt(g.members)} people · ${g.vibe}`,
          () => { SCENES.follow(g.id); this.forceUpdate(); }))}
        {/* "you follow every topic" is now only true when there is also
            nothing to manage — with the channel list above it, an empty
            offers() is no longer an empty sheet */}
        {mine.length === 0 && open.length === 0 && openLeaves.length === 0 && !learnOpen.length && !learnMine.length && (
          <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', padding: '28px 0' }}>You follow every topic.</div>
        )}
        {/* knowledge — the frequency control lives where follows live, and stays
            coarse: how many fields you follow is already an intensity dial. */}
        <div style={{ marginTop: open.length || openLeaves.length || mine.length ? 20 : 2 }}>
            <div style={label}>Learn</div>
            <p style={{ margin: '0 2px 11px', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500, lineHeight: 1.45, color: 'var(--ink-3)', textWrap: 'pretty' }}>Questions with a right answer. Get one right and it lands on your map.</p>
            <div style={{ display: 'flex', gap: 4, padding: 3, border: '0.5px solid var(--rule)', background: 'var(--surface)', borderRadius: 999 }}>
              {LF.LEVELS.map((v) => {
                const on = LF.freq() === v;
                return <button key={v} className="press" onClick={() => { LF.setFreq(v); this.forceUpdate(); }} aria-pressed={on} style={{ flex: 1, border: 'none', borderRadius: 999, padding: '8px 0', cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontWeight: on ? 800 : 600, fontSize: 12.5, background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--surface)' : 'var(--ink-3)', transition: 'background .2s ease, color .2s ease' }}>{v}</button>;
              })}
            </div>
            {/* Your fields, with the way back out (D283). Every field is
                followed on a fresh install now — the pool used to be three
                of twelve, which showed a reader under a quarter of the
                bank — and a default of everything is only honest if
                narrowing is one tap away. Exactly the argument the channel
                rows above make: a thing that is always on has no
                management surface anywhere else, so this is where it
                lives. `LEARN.unfollow` existed before this and nothing in
                the app called it, which is what made the old default the
                only workable one. */}
            {learnMine.map((f) => (
              <div key={'lrnm-' + f.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 2px', borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)' }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: 'transparent', boxShadow: `inset 0 0 0 2.5px ${WPAL.c(LEARN.colorOf(f.id))}`, flexShrink: 0 }}></span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14.5 }}>{f.label}</span>
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 11.5, color: 'var(--ink-3)' }}>{`${(LEARN.subject(f.subject) || {}).label || ''} · ${LEARN.total(f.id)} cards`}</span>
                </div>
                {/* Never on the last one: LEARN.unfollow refuses to empty
                    the list (a reader with no fields gets no learn cards
                    and no way to say so), so a button that did nothing
                    would be worse than no button. */}
                {learnMine.length > 1 && (
                  <button className="press" onClick={() => { LEARN.unfollow(f.id); this.forceUpdate(); }}
                    aria-label={'Unfollow ' + f.label}
                    style={{ flexShrink: 0, border: '0.5px solid var(--rule)', borderRadius: 999, padding: '7px 14px', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', background: 'var(--surface-2)', color: 'var(--ink-2)', WebkitAppearance: 'none' }}>Unfollow</button>
                )}
              </div>
            ))}
            {learnOpen.map((f) => row('lrn-' + f.id, WPAL.c(LEARN.colorOf(f.id)), f.label,
              `${(LEARN.subject(f.subject) || {}).label || ''} · ${LEARN.total(f.id)} cards`,
              () => { LEARN.follow(f.id); this.forceUpdate(); }, true))}
        </div>
        {/* the in-reach way into the ask-a-question door (the paid path,
            D288 §1) — the rail's + adds topics, this proposes a question */}
        
      </div>
    );
  }

  // ── context — the i on every card. Facts and definitions where a question needs
  // them, and for every question the things that are otherwise invisible until
  // you answer: where it came from, how big the vote is, and which branch of your
  // Mirror your answer moves. Never the arguments — those live in the reveal.
  renderContext(q, T) {
    const bg = WF_BGTEXT(q);
    const kn = q.type === 'know' ? LEARN.card(q.learn) : null;
    const fd = kn ? LEARN.field(q.f) : null;
    const rows = [];
    if (kn) {
      rows.push(['Field', fd ? fd.label + ' \u00b7 ' + ((LEARN.subject(fd.subject) || {}).label || '') : '']);
      // D133: this row read `kn.p` \u2014 the authored difficulty hint \u2014 and
      // labelled it "Crowd", which is a claim about people. LEARN_RATE
      // hands back the published first-attempt rate where there is one and
      // says so; where there is not, the row says whose number it is.
      const kr = LEARN_RATE(kn);
      // D149: no row at all when nothing has been measured. "Crowd — null%"
      // and "Our estimate" are both worse than the sheet simply not
      // carrying a line about a crowd that has not answered yet.
      // …and no row when the only measurement is a single first try, which
      // on a card the reader has answered is their own. "Crowd — 100% get
      // this right" over one person is the same fabrication D149 removed
      // the estimate for, with a number that looks measured.
      if (kr.pct != null && !(kr.src === 'measured' && ((LEARN_COUNTS(kn) || {}).total || 0) < 2)) rows.push([kr.src === 'measured' ? 'Crowd' : 'Our estimate', kr.pct + '% get this right']);
      rows.push(['On your map', 'Knowledge']);
    } else {
      const scene = q.scene ? SCENES.defs().find((g) => g.id === q.scene) : null;
      const leaf = q.sub ? WF_SUB(q.sub) : null;
      rows.push(['Asked in', scene ? scene.name : leaf ? leaf.label : T.label]);
      const cat = q.type === 'pick' ? WF_CATALOGS[q.catalog] : null;
      if (cat) rows.push(['Catalogue', cat.total + ' ' + cat.noun]);
      // THE SAME TOTAL THE CARD PRINTS. renderMeta draws
      // `wfPcts(counts, mine).total`, which adds the viewer's own vote
      // back: a live count EXCLUDES it (countsFor, data/deck.ts) and
      // adding it is this surface's convention, not the rounding's.
      // wfVotes is the RAW sum — right as the "top" sort key at the
      // bottom of this file, wrong here, where the number sits one tap
      // from the card's. On a card you had just answered the card said
      // "13 votes" and this sheet said "Answers 12".
      //
      // Only the vote-bar shape diverged: rank, rate, dial, field and
      // pick carry their own published totals, which the card prints
      // unadjusted too, so those keep wfVotes.
      const barShape = !!q.options
        && q.type !== 'rank' && q.type !== 'rate' && q.type !== 'dial'
        && q.type !== 'field' && q.type !== 'pick';
      const n = barShape
        ? wfPcts(q.options.map((o) => o.count), this.state.votes[q.id]).total
        : wfVotes(q);
      if (n) rows.push(['Answers', wfFmt(n)]);
      rows.push(['On your map', WF_BRANCH[q.cat] || 'Interests']);
    }
    // a knowledge card's explanation IS the answer — it waits until you've answered
    const why = kn && this.answered(q) ? kn.w : null;
    const para = bg || why;
    return (
      <div style={{ padding: '2px 0 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {para ? <p style={{ margin: 0, fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 500, lineHeight: 1.55, color: 'var(--ink)', textWrap: 'pretty' }}>{para}</p> : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 14, rowGap: 9, alignItems: 'baseline', borderTop: para ? '0.5px solid var(--rule)' : 'none', paddingTop: para ? 14 : 0 }}>
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{k}</span>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{v}</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  // ── what you need to know — facts and definitions only, never the arguments ──
  renderBg(q) {
    const t = WF_BGTEXT(q);
    if (!t) return null;
    return (
      <div style={{ padding: '2px 0 14px' }}>
        <p style={{ margin: 0, fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 500, lineHeight: 1.55, color: 'var(--ink)', textWrap: 'pretty' }}>{t}</p>
      </div>
    );
  }

  // ── a take, and the counter it drew. Depth stops here: you can only counter
  // someone who voted the other way, once — agreement is the upvote. Several
  // rebuttals sit in the same slot, one at a time. ──
  // one shared reason chooser — takes and counters both use it
  reportRow(k, pad) {
    if (this.state.reportFor !== k) return null;
    const R = WF_REPORT;
    if (!R) return null;
    return (
      <div style={{ marginLeft: pad || 0, display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 2 }}>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11.5, color: 'var(--ink-3)' }}>Report this take</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {R.REASONS.map((r) => (
            <button key={r} className="press" onClick={() => { if (!this._jr) this._jr = new Set(); this._jr.add(k); R.report(k, r); this.setState({ reportFor: null }); }} style={{ border: WF_LINE, borderRadius: 999, padding: '6px 12px', background: 'var(--surface-2)', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, color: 'var(--ink)', cursor: 'pointer', WebkitAppearance: 'none', whiteSpace: 'nowrap' }}>{r}</button>
          ))}
          <button onClick={() => this.setState({ reportFor: null })} style={{ border: 'none', background: 'none', padding: '6px 4px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', WebkitAppearance: 'none' }}>Cancel</button>
        </div>
      </div>
    );
  }

  // the placeholder a reported take leaves behind — only for this sitting, so
  // Undo stays in reach without the sheet filling up with tombstones
  reportedCard(k) {
    const R = WF_REPORT;
    if (!this._jr || !this._jr.has(k)) return null;
    return (
      <div key={k} style={{ border: WF_LINE, borderRadius: 12, background: 'var(--surface-2)', padding: '11px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>Reported. Hidden from your feed.</span>
        <button className="press" onClick={() => { R.undo(k); this._jr.delete(k); this.forceUpdate(); }} style={{ border: 'none', background: 'none', padding: '2px 0', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, color: 'var(--ink)', cursor: 'pointer', WebkitAppearance: 'none' }}>Undo</button>
      </div>
    );
  }

  // One take, with the argument against it folded underneath.
  //
  // DEMO CARDS ONLY, like everything else in this sheet: renderEngage returns
  // the k-floored breakdown alone when q.live, so a take — free text attached
  // to a named person — is structurally unreachable at world scale (D1). The
  // counters come from world-feed-counters.js, invented data sitting beside
  // the invented takes in world-feed-comments.js — and WF_REPORT is that demo
  // sheet's report flow, not the live moderation transport (data layer).
  takeCard(q, T, item) {
    const o = this.opts;
    const { c, key, sig } = item;
    const R = WF_REPORT;
    if (R && R.has(key)) return this.reportedCard(key);
    const myVote = this.state.votes[q.id];
    const mySide = typeof myVote === 'number' && q.options ? myVote : null;
    const isRate = q.type === 'rate';
    const col = isRate ? (c.score != null ? wfRateBg(T.color, c.score) : 'var(--ink-3)') : (c.opt != null ? wfShade(T.color, c.opt) : 'var(--ink-3)');
    const ctxt = isRate ? (c.score != null ? wfRateInk(c.score) : '#fff') : (c.opt != null ? wfShadeText(c.opt) : '#fff');
    const mine = this.state.replies[key] || [];
    const seeded = (o.counter && !isRate ? WF_COUNTERS(key) : []).filter((x) => !(R && R.has(x.ckey)));
    const list = seeded.concat(mine.map((t, i) => ({ name: 'You', opt: mySide, time: 'now', text: t, own: true, ckey: key + '#own' + i })));
    const writing = this.state.replyTo === key;
    // only across the aisle, only once, and only if you have a side yourself —
    // a rebuttal from someone who agrees is just applause
    const canCounter = o.counter && mySide != null && c.opt != null && c.opt !== mySide && mine.length === 0;
    const idx = Math.max(0, Math.min(this.state.ctrIdx[key] == null ? 0 : this.state.ctrIdx[key], list.length - 1));
    const cur = list[idx];
    const act = (on, label, click) => (
      <button onClick={click} aria-pressed={on} className="press" style={{ border: 'none', background: 'none', padding: '2px 0', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11.5, color: on ? 'var(--ink)' : 'var(--ink-3)', WebkitAppearance: 'none', whiteSpace: 'nowrap' }}>{label}</button>
    );
    const reactions = (k, ups, mind, pad) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingLeft: pad }}>
        {act(!!this.state.boosts[k], '▲ ' + wfFmt(ups + (this.state.boosts[k] ? 1 : 0)), () => this.setState((s) => ({ boosts: { ...s.boosts, [k]: !s.boosts[k] } })))}
        {/* minds moved, not likes — the only number here that says the take
            changed anything */}
        {o.signals && act(!!this.state.minds[k], '↺ ' + wfFmt(mind + (this.state.minds[k] ? 1 : 0)) + ' moved', () => this.setState((s) => ({ minds: { ...s.minds, [k]: !s.minds[k] } })))}
        <span style={{ flex: 1 }}></span>
        {k === key && canCounter && act(writing, 'Counter', () => this.setState({ replyTo: writing ? null : key }))}
        <button onClick={() => this.setState((s) => ({ reportFor: s.reportFor === k ? null : k }))} aria-label="Report" style={{ border: 'none', background: 'none', padding: '2px 0 2px 2px', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14, lineHeight: 1, color: this.state.reportFor === k ? 'var(--ink)' : 'var(--ink-3)', WebkitAppearance: 'none' }}>{'\u22ef'}</button>
      </div>
    );
    const meta = (name, opt, time, score) => (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        {opt != null && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: wfShade(T.color, opt), flexShrink: 0, alignSelf: 'center' }}></span>}
        <span style={{ fontWeight: 800, fontSize: 12.5 }}>{name}</span>
        {score != null && <span style={{ fontWeight: 800, fontSize: 11.5, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>gave {score}</span>}
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>{time}</span>
      </div>
    );
    return (
      <div key={key} style={{ border: WF_LINE, borderRadius: 12, background: 'var(--surface)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11.5, background: col, color: ctxt }}>{c.init}</span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {meta(c.name, null, c.time, isRate ? c.score : null)}
            <div style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 500 }}>{c.text}</div>
          </div>
        </div>
        {reactions(key, c.ups, sig.mind, 40)}
        {this.reportRow(key, 40)}
        {cur && (
          <div style={{ marginLeft: 40, paddingLeft: 10, borderLeft: '2px solid ' + (cur.opt != null ? wfShade(T.color, cur.opt) : 'var(--surface-3)'), display: 'flex', flexDirection: 'column', gap: 4 }}>
            {meta(cur.own ? 'You' : cur.name, cur.opt, cur.time)}
            <div style={{ fontSize: 12.5, lineHeight: 1.45, fontWeight: 500 }}>{cur.text}</div>
            {!cur.own && reactions(cur.ckey, cur.ups, cur.sig.mind, 0)}
            {/* several rebuttals stack behind one slot rather than turning the
                take into a thread — one argument at a time, strongest first */}
            {!cur.own && this.reportRow(cur.ckey, 0)}
            {list.length > 1 && (
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', paddingTop: 1 }}>
                {list.map((x, xi) => (
                  <button key={xi} className="tap44 is-tight" onClick={() => this.setState((s) => ({ ctrIdx: { ...s.ctrIdx, [key]: xi } }))} aria-label={'counter ' + (xi + 1)} style={{ width: 7, height: 7, padding: 0, borderRadius: '50%', border: 'none', cursor: 'pointer', background: xi === idx ? 'var(--ink)' : 'var(--surface-3)', WebkitAppearance: 'none' }}></button>
                ))}
              </div>
            )}
          </div>
        )}
        {writing && (
          <form onSubmit={(e) => { e.preventDefault(); const inp = e.target.elements.reply; const v = inp.value.trim(); if (v) { this.addReply(key, v); this.setState((s) => ({ ctrIdx: { ...s.ctrIdx, [key]: (s.replies[key] || []).length + seeded.length } })); } }} style={{ display: 'flex', gap: 6, marginLeft: 40 }}>
            <input name="reply" autoFocus autoComplete="off" autoCapitalize="sentences" enterKeyHint="send" placeholder={'Where is it wrong\u2026'} style={{ flex: 1, minWidth: 0, border: WF_LINE, borderRadius: 999, padding: '7px 12px', fontFamily: 'var(--sans)', fontSize: 'var(--field-size)', fontWeight: 500, background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none' }} />
            <button type="submit" style={{ border: 'none', borderRadius: 999, padding: '7px 13px', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, cursor: 'pointer', background: 'var(--ink)', color: 'var(--surface)', WebkitAppearance: 'none' }}>Send</button>
          </form>
        )}
      </div>
    );
  }

  renderTakes(q, T, takes) {
    const o = this.opts;
    const isRate = q.type === 'rate';
    const hasSides = !!q.options && takes.some((c) => c.opt != null);
    const filter = this.state.sideFilter;
    const myVote = this.state.votes[q.id];
    const mySide = typeof myVote === 'number' && q.options ? myVote : null;
    const sigOf = (key, c) => WF_TAKE_SIG(key, c.ups);
    let items = takes.map((c, i) => { const key = q.id + ':' + i; return { c, i, key, sig: sigOf(key, c) }; });
    // persuasion sort: what moved people, not what pleased them. A take whose
    // counter did the moving still surfaces — the exchange is the unit.
    const byMind = o.signals && this.state.takeSort === 'mind';
    const best = (it) => { const cs = o.counter ? WF_COUNTERS(it.key) : []; return Math.max(it.sig.mind, cs.length ? cs[0].sig.mind : 0); };
    items = items.slice().sort((a, b) => (byMind ? (best(b) + b.c.ups * b.sig.cross * 0.25) - (best(a) + a.c.ups * a.sig.cross * 0.25) : b.c.ups - a.c.ups));
    // crossfire: your side against the strongest opposing take, before the list
    let pair = null;
    if (o.crossfire && filter == null && q.options) {
      const a = items.find((it) => it.c.opt != null && (mySide == null ? true : it.c.opt === mySide));
      const b = a ? items.find((it) => it.c.opt != null && it.c.opt !== a.c.opt) : null;
      if (a && b) pair = [a, b];
    }
    const paired = pair ? [pair[0].key, pair[1].key] : [];
    const shown = items.filter((it) => (filter == null || it.c.opt === filter) && paired.indexOf(it.key) < 0);
    const ownAll = this.state.myTakes[q.id] || [];
    const ownShown = ownAll.filter(() => filter == null || filter === mySide);
    const chip = (val, label, col, txt) => (
      <button key={String(val)} onClick={() => this.setState({ sideFilter: val })} style={{ border: WF_LINE, borderRadius: 999, padding: '5px 12px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, cursor: 'pointer', background: filter === val ? (col || 'var(--ink)') : 'var(--surface)', color: filter === val ? (txt || 'var(--surface)') : 'var(--ink)', WebkitAppearance: 'none', whiteSpace: 'nowrap', flexShrink: 0, maxWidth: val == null ? 'none' : 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</button>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(hasSides || o.signals) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start', paddingBottom: 4 }}>
            {hasSides && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{[chip(null, 'All')].concat(q.options.map((oo, i) => chip(i, oo.label, wfShade(T.color, i), wfShadeText(i))))}</div>}
            {o.signals && (
              <button onClick={() => this.setState((s) => ({ takeSort: s.takeSort === 'mind' ? 'top' : 'mind' }))} style={{ border: 'none', background: 'none', padding: '5px 0', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11.5, color: 'var(--ink-3)', WebkitAppearance: 'none', whiteSpace: 'nowrap' }}>{byMind ? 'by minds moved' : 'by votes'}</button>
            )}
          </div>
        )}
        {pair && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {this.takeCard(q, T, pair[0])}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, height: 1, background: 'var(--surface-3)' }}></span>
              <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 10.5, color: 'var(--ink-3)' }}>vs</span>
              <span style={{ flex: 1, height: 1, background: 'var(--surface-3)' }}></span>
            </div>
            {this.takeCard(q, T, pair[1])}
          </div>
        )}
        {shown.length === 0 && ownShown.length === 0 && !pair && <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', padding: '14px 0', textAlign: 'center' }}>{takes.length === 0 && ownAll.length === 0 ? 'No takes yet — yours could be first.' : 'No takes from this side yet.'}</div>}
        {shown.map((it) => this.takeCard(q, T, it))}
        {ownShown.map((t, i) => (
          <div key={'own' + i} style={{ border: WF_LINE, borderRadius: 12, background: 'var(--surface)', padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11.5, background: isRate && typeof myVote === 'number' ? wfRateBg(T.color, myVote) : mySide != null ? wfShade(T.color, mySide) : 'var(--ink)', color: isRate && typeof myVote === 'number' ? wfRateInk(myVote) : mySide != null ? wfShadeText(mySide) : '#fff' }}>Y</span>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 12.5 }}>You</span>
                {mySide != null && <span style={{ background: wfShade(T.color, mySide), color: wfShadeText(mySide), fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{q.options[mySide].label}</span>}
                {isRate && typeof myVote === 'number' && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>gave {myVote}</span>}
                <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>now</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 500 }}>{t}</div>
              {o.signals && <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11, color: 'var(--ink-3)' }}>{'↺ ' + WF_TAKE_SIG(q.id + ':own' + i, 60).mind + ' moved'}</span>}
            </div>
          </div>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); const inp = e.target.elements.take; const v = inp.value.trim(); if (v) { this.addTake(q.id, v); inp.value = ''; } }} style={{ display: 'flex', gap: 6, paddingTop: 2 }}>
          <input name="take" placeholder={!this.answered(q) ? 'Answer first to add a take…' : 'Add your take…'} disabled={!this.answered(q)} style={{ flex: 1, minWidth: 0, border: WF_LINE, borderRadius: 999, padding: '8px 13px', fontFamily: 'var(--sans)', fontSize: 'var(--field-size)', fontWeight: 500, background: 'var(--surface)', color: 'var(--ink)', outline: 'none' }} />
          <button type="submit" style={{ border: 'none', borderRadius: 999, padding: '8px 14px', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, cursor: 'pointer', background: 'var(--ink)', color: 'var(--surface)', WebkitAppearance: 'none' }}>Send</button>
        </form>
      </div>
    );
  }

  addTake(qid, text) {
    this.setState((s) => {
      const myTakes = { ...s.myTakes, [qid]: [...(s.myTakes[qid] || []), text] };
      try { localStorage.setItem(WF_TAKES_LS, JSON.stringify(myTakes)); } catch { /* best-effort */ }
      return { myTakes };
    });
  }

  addReply(key, text) {
    this.setState((s) => {
      const replies = { ...s.replies, [key]: [...(s.replies[key] || []), text] };
      try { localStorage.setItem(WF_REPLIES_LS, JSON.stringify(replies)); } catch { /* best-effort */ }
      return { replies, replyTo: null };
    });
  }

  // ── the real breakdown (D8) ──
  // Live questions slice by the anchors people actually gave, floored per
  // cell server-side. Demo cards keep the prototype's synthetic split
  // below — it is demo data on a demo card, and the live path never
  // touches it.
  //
  // `friends` is absent here on purpose: a named who-voted at world scale
  // is what D1 rules out. It stays a demo-only dimension.
  liveBy(q) {
    if (!q.live) return null;
    const agg = LIVE.aggFor(q.id);
    const by = agg && agg.by;
    return by && Object.keys(by).length ? by : null;
  }

  // The viewer's own option index on a live card, or -1 (D125). Local
  // state first because it holds the answer given this sitting before the
  // store has confirmed it; the store's map is the fallback for a card
  // answered on another device or in an earlier session.
  //
  // Continuum cards skip the local-first read (D218): their local state
  // holds the drag's own units — a value on lo..hi, a point {x,y} — never
  // an index, so "7 cups" read as an index marked bucket 7 as yours when
  // the answer lived in bucket 8. The stored bucket is the only
  // index-shaped truth for them, and it is present this sitting too:
  // setDial/setField write the store optimistically before setState.
  liveMine(q) {
    const local = this.state.votes[q.id];
    const continuum = q.type === 'dial' || q.type === 'field';
    if (!continuum && typeof local === 'number') return local;
    const stored = LIVE.myVotes ? LIVE.myVotes()[q.id] : null;
    const n = stored == null ? NaN : Number(stored);
    return Number.isInteger(n) ? n : -1;
  }

  // ── the cut control: which slice of the world, then — for a test — which of
  // its subvalues (overall type, or one axis). Same pair the Circle map uses.
  // Two deliberate rows — who people are, then how they test — so all nine cuts
  // stay in sight without three ragged wrapped lines. ──
  renderCutChips(q, dim, only) {
    const axis = this.state.cutAxis[q.id] || null;
    const subs = WF_SUBS(dim);
    const all = only ? WF_CUTS().filter((d) => only.indexOf(d.id) >= 0) : WF_CUTS();
    const chip = (d, small) => (
      <button key={d.id} data-on={dim === d.id ? '1' : '0'} onClick={() => this.setState((s) => ({ dims: { ...s.dims, [q.id]: d.id }, cutAxis: { ...s.cutAxis, [q.id]: null } }))} style={{ flex: 'none', border: '1px solid ' + (dim === d.id ? 'var(--ink)' : 'var(--rule)'), borderRadius: 999, padding: small ? '4px 11px' : '5px 12px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: small ? 11.5 : 12, cursor: 'pointer', whiteSpace: 'nowrap', background: dim === d.id ? 'var(--ink)' : 'var(--surface)', color: dim === d.id ? 'var(--surface)' : small ? 'var(--ink-3)' : 'var(--ink-2)', WebkitAppearance: 'none' }}>{d.label}</button>
    );
    const row = (list, k, small) => (
      <div key={k} className="h-scroll" ref={(el) => { const sig = q.id + '|' + dim; if (el && this['_dSig' + k] !== sig) { this['_dSig' + k] = sig; VOTECUTS.centerChip(el); } }} style={{ position: 'relative', display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -18px', padding: '0 18px' }}>{list.map((d) => chip(d, small))}</div>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {row(all.filter((d) => !d.test), 'demo')}
        {all.some((d) => d.test) ? row(all.filter((d) => d.test), 'tests', true) : null}
        {subs && (
          <div className="h-scroll" ref={(row) => { const sig = q.id + '|' + dim + '|' + axis; if (row && this._axSig !== sig) { this._axSig = sig; VOTECUTS.centerChip(row); } }} style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', margin: '0 -18px', padding: '0 18px 2px' }}>
            {subs.map((sb, si) => {
              const on = axis === sb.id;
              const rule = !!sb.tier && !(subs[si - 1] || {}).tier;
              return (
                <React.Fragment key={sb.id || 'type'}>
                  {rule && <span aria-hidden="true" style={{ flex: 'none', alignSelf: 'stretch', width: 1, margin: '3px 5px', background: 'var(--rule)' }}></span>}
                  <button data-on={on ? '1' : '0'} onClick={() => this.setState((s) => ({ cutAxis: { ...s.cutAxis, [q.id]: sb.id } }))} style={{ flex: 'none', border: 'none', borderRadius: 999, padding: '4px 11px', fontFamily: 'var(--sans)', fontWeight: on ? 800 : 600, fontSize: 11.5, cursor: 'pointer', background: on ? 'var(--surface-3)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-3)', WebkitAppearance: 'none' }}>{sb.label}</button>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // rate breakdown: every cut on the same 1–10 track. Bar = that group's
  // average, hairline = your score, so the gap is the message.
  renderRateStats(q, T) {
    const dim = this.state.dims[q.id] || 'friends';
    const axis = this.state.cutAxis[q.id] || null, cutKey = WF_CUTKEY(dim, axis), youBand = WF_YOU(dim, axis);
    const c = PLACESTATS.cat(q.scope, q.catId);
    const avg = c ? c.avg : 5;
    const v = this.state.votes[q.id];
    const track = (g, a) => (
      <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 94, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {g.color && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: g.color, flexShrink: 0 }}></span>}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.label}</span>
        </span>
        <span style={{ position: 'relative', flex: 1, height: 10 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'color-mix(in oklch, ' + T.color + ' 9%, var(--surface-3))' }}></span>
          <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: (a * 10) + '%', borderRadius: 999, background: 'linear-gradient(90deg, color-mix(in oklch, ' + T.color + ', transparent 55%), ' + T.color + ')' }}></span>
          {typeof v === 'number' && <span aria-hidden="true" style={{ position: 'absolute', top: -3, bottom: -3, left: 'calc(' + (v * 10) + '% - 1px)', width: 2, borderRadius: 1, background: 'var(--ink)' }}></span>}
        </span>
        <span style={{ width: 26, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{a.toFixed(1)}</span>
      </div>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {this.renderCutChips(q, dim)}
        {(typeof v === 'number' || youBand) && (
          <div style={{ background: 'var(--ink)', color: 'var(--surface)', borderRadius: 12, padding: '12px 14px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0 }}>{typeof v === 'number' ? 'You gave it ' + v + ' · the crowd ' + avg.toFixed(1) : 'How the crowd scored it'}</span>
            {youBand && <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, background: 'color-mix(in oklch, var(--surface) 22%, transparent)', borderRadius: 999, padding: '3px 10px' }}>You · {youBand}</span>}
          </div>
        )}
        {dim === 'friends' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {WF_FRIENDS.filter((f) => wfDid(q, f)).map((f) => {
              const a = wfRateAvg(q.id, 'f:' + f.name, avg);
              const s = Math.round(a);
              return (
                <div key={f.name} style={{ background: 'var(--surface)', border: WF_LINE, borderRadius: 12, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, background: wfRateBg(T.color, s), color: wfRateInk(s) }}>{f.init}</span>
                  <span style={{ flex: 1, fontWeight: 800, fontSize: 13.5 }}>{f.name}</span>
                  <span style={{ position: 'relative', width: 96, height: 8, flexShrink: 0 }}>
                    <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'color-mix(in oklch, ' + T.color + ' 9%, var(--surface-3))' }}></span>
                    <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: (a * 10) + '%', borderRadius: 999, background: T.color }}></span>
                  </span>
                  <span style={{ width: 22, textAlign: 'right', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>{s}</span>
                </div>
              );
            })}
            {!WF_FRIENDS.some((f) => wfDid(q, f)) && wfFrNone('None of your friends has rated this one yet.')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {WF_GRP(dim, axis).map((g) => track(g, wfRateAvg(q.id, cutKey + ':' + g.label, avg)))}
          </div>
        )}
      </div>
    );
  }

  // On an opinion question the cuts tell you who thinks what. On a knowledge
  // question they answer a different question — who KNOWS this — and that read
  // isn't available anywhere else: a fact can belong to the old, to one country,
  // to one field of study. Bar = share of that group who got it right, sorted, on
  // one baseline, with the crowd's own rate as the hairline to read against.
  renderKnowStats(q, T) {
    const card = LEARN.card(q.learn);
    if (!card) return null;
    // D133 \u2014 the other half of D89. That decision refused the "BEd knows
    // this best \u00b7 83%" headline on a live device because the ranking under
    // it is hash noise over the DEMO cut groups. It refused the headline
    // and left the sheet the headline opened into, which is the same
    // fabrication with more of it: every row below is `wfKnowRate`, a hash
    // of (card, cohort) \u2014 a per-cohort knowledge rate nobody has measured,
    // drawn against a baseline nobody has measured either. So the cuts go
    // the way MapStats' null anchors went (D72): refused at the
    // source, returning when a per-cohort learn aggregate exists to rank.
    //
    // The headline stays, because it has a true version \u2014 LEARN_RATE hands
    // back the published first-attempt rate where there is one, and labels
    // itself where there is not.
    // The imported binding, not the window surface — same reason
    // renderKnowInsight gives below, and check:globals rule 4 refuses new
    // coupling either way.
    const live = LIVE.enabled;
    const dim = live ? 'friends' : (WF_KNOW_CUTS.indexOf(this.state.dims[q.id]) >= 0 ? this.state.dims[q.id] : 'friends');
    const axis = this.state.cutAxis[q.id] || null, youBand = WF_YOU(dim, axis);
    const rate = LEARN_RATE(card);
    const p = rate.pct;
    const r = this.knowOf(q);
    const seen = LEARN_SOCIAL.onCard(card);
    const rows = dim === 'friends' ? [] : (() => { const gs = WF_GRP(dim, axis); return gs.map((g, i) => ({ ...g, rate: wfKnowRate(q.id, WF_CUTKEY(dim, axis) + ':' + g.label, p, wfKnowBias(dim, axis, gs.length, i)) })).sort((a, b) => b.rate - a.rate); })();
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {live ? null : this.renderCutChips(q, dim, WF_KNOW_CUTS)}
        <div style={{ background: 'var(--ink)', color: 'var(--surface)', borderRadius: 12, padding: '12px 14px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* D149: the estimate is gone from live builds, so the three
              cases here are a measurement, the demo's authored figure, and
              a live card nobody else has answered \u2014 which says so rather
              than printing a number nobody measured. */}
          <span style={{ flex: 1, minWidth: 0 }}>{rate.src === 'loading' ? 'Counting\u2026' : p == null ? 'Nobody else has answered this one yet' : live && rate.src === 'estimate' ? 'about ' + p + '% get this right \u2014 our estimate' : p + '% of people get this right'}</span>
          {r ? <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, background: 'color-mix(in oklch, var(--surface) 22%, transparent)', borderRadius: 999, padding: '3px 10px' }}>{r.ok ? 'You did' : 'You didn\u2019t'}</span> : null}
        </div>
        {/* The cuts' honest absence, in the sheet that was built to hold
            them \u2014 the same sentence shape the Foresight lens uses for a
            slice with nothing behind it yet. */}
        {live ? (
          <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', lineHeight: 1.5, padding: '4px 2px 10px' }}>
            Knowledge cards don&apos;t publish per-group cuts yet — the rate above
            is everyone at once.
          </div>
        ) : dim === 'friends' ? (
          seen.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seen.slice().sort((a, b) => (b.ok ? 1 : 0) - (a.ok ? 1 : 0)).map((f) => (
                <div key={f.id} style={{ background: 'var(--surface)', border: WF_LINE, borderRadius: 12, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ ...lmAv(f.ok ? WPAL.ink(T.color) : 'var(--surface-2)', f.ok ? '#fff' : 'var(--ink-3)', 30), border: f.ok ? 'none' : '1px solid var(--rule)' }}>{f.init}</span>
                  <span style={{ flex: 1, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 13.5 }}>{f.name}</span>
                  <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, color: f.ok ? WPAL.ink(T.color) : 'var(--ink-3)' }}>{f.ok ? 'got it' : 'missed'}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', padding: '22px 0' }}>None of your friends has met this one yet.</div>
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {rows.map((g) => {
              const you = youBand && g.label === youBand;
              return (
                <div key={g.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 94, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11.5, color: you ? 'var(--ink)' : 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {you ? <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, boxShadow: `inset 0 0 0 2px ${T.color}` }}></span> : null}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.label}</span>
                  </span>
                  <span style={{ position: 'relative', flex: 1, height: 10 }}>
                    <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'color-mix(in oklch, ' + T.color + ' 9%, var(--surface-3))' }}></span>
                    <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: g.rate + '%', borderRadius: 999, background: T.color }}></span>
                    <span aria-hidden="true" title="everyone" style={{ position: 'absolute', top: -3, bottom: -3, left: 'calc(' + p + '% - 1px)', width: 2, borderRadius: 1, background: 'var(--ink)' }}></span>
                  </span>
                  <span style={{ width: 30, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{g.rate}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // the knowledge card's surprise: the group that knows this best. Two rules keep
  // it honest. It ranks on the hash noise only — education carries a deliberate
  // monotonic trend, and left in the comparison that systematic offset wins
  // “furthest from the crowd” nearly every time, so the same line repeats on half
  // the cards. And it only ever headlines the upward side: a card that says who
  // knows something is generous, one that says who fails is a verdict, and a
  // verdict on the least-schooled group is exactly the chart we refused to draw
  // when we dropped the gender cut. The low end still shows in the sheet, where
  // it reads as a distribution rather than a headline.
  renderKnowInsight(q, T) {
    // Live builds refuse this row rather than fill it (D89). The ranking
    // below is hash noise over the demo cut groups, so on a real device it
    // headlined "BEd knows this best · 83%" as if someone had measured that
    // cohort — the fabrication D1 forbids — one line under the reveal's
    // estimate/measured label, which covers the split and says nothing
    // about this. Refused at the source rather than the call site, the
    // same shape as MapStats (D72); it returns when a per-cohort learn
    // aggregate exists to rank. The imported LIVE, not the window surface:
    // a test driving this branch stubs the module the way
    // LiveCohortBody.test does, not through the window stand-in.
    if (LIVE.enabled) return null;
    const card = LEARN.card(q.learn);
    if (!card) return null;
    const p = card.p;
    let best = null;
    WF_CUTS().filter((d) => d.id !== 'friends' && WF_KNOW_CUTS.indexOf(d.id) >= 0).forEach((d) => {
      const subs = WF_SUBS(d.id);
      (subs ? subs : [{ id: null }]).forEach((sb) => {
        const gs = WF_GRP(d.id, sb.id);
        gs.forEach((g, i) => {
          const bias = wfKnowBias(d.id, sb.id, gs.length, i);
          const rate = wfKnowRate(q.id, WF_CUTKEY(d.id, sb.id) + ':' + g.label, p, bias);
          if (rate <= p) return;
          const gap = Math.abs(rate - p - bias);
          if (!best || gap > best.gap) best = { dim: d.id, axis: sb.id, label: g.label, rate, gap };
        });
      });
    });
    if (!best || best.rate - p < 12) return null;
    return (
      <button className="press" onClick={() => this.setState((s) => ({ sheet: { q, T, panel: 'know' }, dims: { ...s.dims, [q.id]: best.dim }, cutAxis: { ...s.cutAxis, [q.id]: best.axis } }))}
        style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', border: WF_LINE, borderRadius: 12, background: 'var(--surface)', padding: '10px 12px', cursor: 'pointer', WebkitAppearance: 'none' }}>
        <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: T.color }}></span>
        <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--ink-2)' }}>{best.label + ' knows this best'}</span>
        <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 13, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{best.rate + '%'}</span>
      </button>
    );
  }

  // dial breakdown: every cut on the question's own range. Bar = that group's
  // typical answer, hairline = yours — same grammar as the rate breakdown.
  dialGrpAvg(q, key) { return Math.max(q.lo, Math.min(q.hi, q.med + (wfHash(q.id + ':' + key) - 0.5) * (q.hi - q.lo) * 0.34)); }

  // one row of the dial breakdown, shared by the demo cuts and the live
  // cohorts — the value is the only thing that differs in kind
  dialTrackRow(q, T, v, label, color, a, n) {
    const span = q.hi - q.lo;
    return (
      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 94, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11.5, whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {color && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }}></span>}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={n != null ? `${label} — ${n} answer${n === 1 ? '' : 's'}` : undefined}>{label}</span>
        </span>
        <span style={{ position: 'relative', flex: 1, height: 10 }}>
          <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'color-mix(in oklch, ' + T.color + ' 9%, var(--surface-3))' }}></span>
          <span style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: ((a - q.lo) / span * 100) + '%', borderRadius: 999, background: 'linear-gradient(90deg, color-mix(in oklch, ' + T.color + ', transparent 55%), ' + T.color + ')' }}></span>
          {v != null && <span aria-hidden="true" style={{ position: 'absolute', top: -3, bottom: -3, left: 'calc(' + ((v - q.lo) / span * 100) + '% - 1px)', width: 2, borderRadius: 1, background: 'var(--ink)' }}></span>}
        </span>
        <span style={{ width: 40, flexShrink: 0, textAlign: 'right', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{this.dialFmt(q, a)}</span>
      </div>
    );
  }

  // The live dial breakdown, cohort-first (D125). The panel above owns the
  // choice of cohort; this draws where THAT cohort lands on the range,
  // with everyone's position beside it for the comparison.
  //
  // It used to draw every cohort at once — six or twelve tracks stacked —
  // which reads as a chart of the crowd rather than an answer to "where
  // would this land if I were asking people like X". The chips give you
  // each cohort a tap apart, and the rows below them are the same names
  // and the same divergence the options-shaped sheet shows.
  renderDialLiveStats(q, T) {
    const v = this.dialVal(q);
    return (
      <LiveBreakdownPanel
        qid={q.id}
        options={q.options.map((o) => o.label)}
        mine={this.liveMine(q)}
        renderBody={(counts, pick, overall) => {
          const cur = this.dialCellAvg(q, counts);
          const all = this.dialCellAvg(q, overall);
          if (!cur) return null;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {v != null && (
                <div style={{ background: 'var(--ink)', color: 'var(--surface)', borderRadius: 12, padding: '12px 14px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14 }}>
                  You said {this.dialFmt(q, v)} · {pick.dim ? pick.label + ' say ' : 'most say '}{this.dialFmt(q, this.dialMedOf(q, counts))}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {this.dialTrackRow(q, T, v, pick.label, null, cur.avg, cur.n)}
                {/* The baseline, drawn only when a cohort is selected —
                    against "Everyone" it would be the same row twice. */}
                {!!pick.dim && all && this.dialTrackRow(q, T, v, 'Everyone', null, all.avg, all.n)}
              </div>
              <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, textWrap: 'pretty' }}>
                {pick.dim && all
                  ? <>{pick.label} land {Math.abs(Math.round(cur.avg - all.avg)) < 1
                    ? <>where everyone does</>
                    : <><strong style={{ color: 'var(--ink-2)' }}>{this.dialFmt(q, Math.abs(cur.avg - all.avg))}</strong> {cur.avg > all.avg ? 'higher' : 'lower'} than everyone</>}
                    {v != null ? <>, and you said {this.dialFmt(q, v)}</> : null}.</>
                  : <>Where the answers typically land{v != null ? ' — the line is you' : ''}.</>}
              </div>
            </div>
          );
        }}
      />
    );
  }

  renderDialStats(q, T) {
    if (q.live) return this.renderDialLiveStats(q, T);
    const dim = this.state.dims[q.id] || 'friends';
    const axis = this.state.cutAxis[q.id] || null, cutKey = WF_CUTKEY(dim, axis), youBand = WF_YOU(dim, axis);
    const v = this.state.votes[q.id];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {this.renderCutChips(q, dim)}
        {(v != null || youBand) && (
          <div style={{ background: 'var(--ink)', color: 'var(--surface)', borderRadius: 12, padding: '12px 14px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0 }}>{v != null ? 'You said ' + this.dialFmt(q, v) + ' · most say ' + this.dialFmt(q, q.med) : 'What each group says'}</span>
            {youBand && <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, background: 'color-mix(in oklch, var(--surface) 22%, transparent)', borderRadius: 999, padding: '3px 10px' }}>You · {youBand}</span>}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {dim === 'friends'
            ? (WF_FRIENDS.some((f) => wfDid(q, f)) ? WF_FRIENDS.filter((f) => wfDid(q, f)).map((f) => this.dialTrackRow(q, T, v, f.name, null, this.dialGrpAvg(q, 'f:' + f.name))) : wfFrNone('None of your friends has answered this one yet.'))
            : WF_GRP(dim, axis).map((g) => this.dialTrackRow(q, T, v, g.label, g.color, this.dialGrpAvg(q, cutKey + ':' + g.label)))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', padding: '0 40px 0 104px' }}>
          <span>{(q.ends || [this.dialFmt(q, q.lo), this.dialFmt(q, q.hi)])[0]}</span><span>{(q.ends || [this.dialFmt(q, q.lo), this.dialFmt(q, q.hi)])[1]}</span>
        </div>
      </div>
    );
  }

  // field breakdown: every group's centre placed on the same plane, named at
  // the dot; your ring stays for the distance read.
  fieldGrpPos(q, key) {
    const c = this.fieldCloud(q);
    const cx = c.reduce((a, d) => a + d[0], 0) / c.length, cy = c.reduce((a, d) => a + d[1], 0) / c.length;
    return [Math.max(10, Math.min(90, cx + (wfHash(q.id + ':x:' + key) - 0.5) * 46)), Math.max(12, Math.min(88, cy + (wfHash(q.id + ':y:' + key) - 0.5) * 46))];
  }

  // the plane itself, shared by the demo cuts and the live cohorts:
  // marks = [{ key, x, y, short, color? }], ring = your position
  renderFieldPlane(q, T, marks, v) {
    const lab = (t, style) => <span style={{ position: 'absolute', fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 650, color: 'var(--ink-3)', letterSpacing: '0.02em', pointerEvents: 'none', ...style }}>{t}</span>;
    return (
      <div style={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: 16, border: '1px solid color-mix(in oklch, ' + T.color + ' 35%, var(--rule))', background: WPAL.wash(T.color, 5), overflow: 'hidden' }}>
        <span style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'var(--rule)', opacity: 0.8 }}></span>
        <span style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'var(--rule)', opacity: 0.8 }}></span>
        {lab(q.ax[0], { left: 9, top: '50%', transform: 'translateY(-140%)' })}
        {lab(q.ax[1], { right: 9, top: '50%', transform: 'translateY(-140%)' })}
        {lab(q.ay[1], { top: 7, left: '50%', transform: 'translateX(8px)' })}
        {lab(q.ay[0], { bottom: 7, left: '50%', transform: 'translateX(8px)' })}
        {marks.map((g) => (
          <span key={g.key} style={{ position: 'absolute', left: g.x + '%', top: g.y + '%', transform: 'translate(-50%,-50%)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', flexShrink: 0, background: g.color || T.color, border: '2px solid var(--surface)', boxShadow: '0 1px 4px rgba(20,20,40,0.25)' }}></span>
            <span style={{ fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 800, color: 'var(--ink-2)', whiteSpace: 'nowrap', textShadow: '0 0 4px var(--surface)' }}>{g.short}</span>
          </span>
        ))}
        {v != null && <span style={{ position: 'absolute', left: v.x + '%', top: v.y + '%', width: 16, height: 16, margin: '-8px 0 0 -8px', borderRadius: '50%', boxSizing: 'border-box', background: 'var(--surface)', border: '3px solid ' + T.color, boxShadow: '0 1px 6px rgba(20,20,40,0.3)' }}></span>}
      </div>
    );
  }

  // The live field breakdown, cohort-first (D125) — the same reversal the
  // dial gets above, on the plane: the selected cohort's real centre of
  // mass, with everyone's beside it and your own answer as the ring.
  renderFieldLiveStats(q, T) {
    const v = this.fieldVal(q);
    return (
      <LiveBreakdownPanel
        qid={q.id}
        options={q.options.map((o) => o.label)}
        mine={this.liveMine(q)}
        renderBody={(counts, pick, overall) => {
          const cur = this.fieldCellCentroid(counts);
          const all = this.fieldCellCentroid(overall);
          if (!cur) return null;
          const marks = [{ key: 'cohort', x: cur.x, y: cur.y, short: pick.label }];
          // Only when a cohort is selected: against "Everyone" the two
          // centroids are the same point and would draw one dot twice.
          if (pick.dim && all) marks.push({ key: 'all', x: all.x, y: all.y, short: 'Everyone', color: 'var(--ink-3)' });
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {this.renderFieldPlane(q, T, marks, v)}
              <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, textWrap: 'pretty' }}>
                {pick.dim
                  ? <>Where {pick.label} typically land, against everyone{v != null ? ' — the ring is you' : ''}.</>
                  : <>Where the answers typically land{v != null ? ' — the ring is you' : ''}.</>}
              </div>
            </div>
          );
        }}
      />
    );
  }

  renderFieldStats(q, T) {
    if (q.live) return this.renderFieldLiveStats(q, T);
    const dim = this.state.dims[q.id] || 'friends';
    const axis = this.state.cutAxis[q.id] || null, cutKey = WF_CUTKEY(dim, axis), youBand = WF_YOU(dim, axis);
    const v = this.state.votes[q.id];
    const marks = (dim === 'friends'
      ? WF_FRIENDS.filter((f) => wfDid(q, f)).map((f) => ({ label: f.name, short: f.init, key: 'f:' + f.name }))
      : WF_GRP(dim, axis).map((g) => ({ label: g.label, short: g.label, color: g.color, key: cutKey + ':' + g.label }))
    ).map((g) => {
      const [x, y] = this.fieldGrpPos(q, g.key);
      return { ...g, x, y };
    });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {this.renderCutChips(q, dim)}
        {(v != null || youBand) && (
          <div style={{ background: 'var(--ink)', color: 'var(--surface)', borderRadius: 12, padding: '12px 14px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, minWidth: 0 }}>Where each group lands</span>
            {youBand && <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, background: 'color-mix(in oklch, var(--surface) 22%, transparent)', borderRadius: 999, padding: '3px 10px' }}>You · {youBand}</span>}
          </div>
        )}
        {this.renderFieldPlane(q, T, marks, v)}
        {v != null && <span style={{ alignSelf: 'center', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 650, color: 'var(--ink-3)' }}>the ring is you</span>}
      </div>
    );
  }

  renderStats(q, T) {
    // Continuum forms carry their own sheets, live and demo alike: a live
    // card reads real by-cells as averages/centroids (D114), a demo card
    // its authored texture — the options-shaped panels below would draw a
    // 12-bucket dial as twelve meaningless bars.
    if (q.type === 'dial') return this.renderDialStats(q, T);
    if (q.type === 'field') return this.renderFieldStats(q, T);
    // The whole live sheet, cohort-first (D125). One component owns the
    // cohort choice, the split drawn FOR that cohort, and the names under
    // it. The three used to be independent stacked panels and every one of
    // them answered "who is in this crowd" — none answered "what does this
    // question look like from where they are standing", which is the
    // reading a breakdown is for.
    if (q.live) {
      return (
        <LiveBreakdownPanel
          qid={q.id}
          options={q.options.map((o) => o.label)}
          mine={this.liveMine(q)}
        />
      );
    }
    if (q.type === 'pick') return this.renderPickStats(q, T);
    if (q.type === 'know') return this.renderKnowStats(q, T);
    if (q.type === 'rate') return this.renderRateStats(q, T);
    if (q.type === 'rank') return this.renderRankStats(q, T);
    const dim = this.state.dims[q.id] || 'friends';
    const axis = this.state.cutAxis[q.id] || null, cutKey = WF_CUTKEY(dim, axis), youBand = WF_YOU(dim, axis);
    const counts = q.options.map((o) => o.count);
    const total = counts.reduce((a, b) => a + b, 0);
    const myVote = this.state.votes[q.id];
    const mySide = typeof myVote === 'number' ? myVote : null;
    // same derivation as the card marks (friendSides) — the two must agree,
    // and only friends who answered appear (2026-08-26)
    const friends = this.friendSides(q, counts);
    const notYet = WF_FRIENDS.filter((f) => !wfDid(q, f));
    const same = mySide == null || !friends.length ? null : friends.filter((f) => f.oi === mySide).length;
    // the world's own split — it becomes the header bar (legend + baseline in one)
    // and every group's seam is read against it
    const op = sharePcts(counts);
    const nG = WF_GRP(dim, axis).length;
    const many = nG > 6;
    const GRID = { display: 'grid', gridTemplateColumns: '92px 1fr', gap: 10, alignItems: 'center' };
    const barH = many ? 19 : 24, rowGap = many ? 6 : 9;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {this.renderCutChips(q, dim)}
        {dim === 'friends' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ background: 'var(--ink)', color: 'var(--surface)', borderRadius: 12, padding: '12px 14px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14 }}>{!friends.length ? 'None of your friends has answered this one yet' : same != null ? same + ' of ' + friends.length + (friends.length === 1 ? ' friend is' : ' friends are') + ' on your side' : 'How your friends voted'}</div>
            {friends.map((f) => (
              <div key={f.name} style={{ background: 'var(--surface)', border: WF_LINE, borderRadius: 12, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* the avatar wears the friend's own hue (identity); only the
                    pick chip wears the side (2026-08-26) */}
                <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, background: WPAL.ink(f.hue), color: '#fff' }}>{f.init}</span>
                <span style={{ flex: 1, fontWeight: 800, fontSize: 13.5 }}>{f.name}</span>
                <span style={{ background: wfShade(T.color, f.oi), color: wfShadeText(f.oi), fontSize: 10.5, fontWeight: 800, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.options[f.oi].label}</span>
              </div>
            ))}
            {friends.length > 0 && notYet.length > 0 && <div style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', padding: '2px 4px 0', textWrap: 'pretty' }}>{notYet.map((f) => f.name).join(', ')} {notYet.length === 1 ? "hasn't" : "haven't"} answered this one.</div>}
          </div>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: rowGap }}>
          <div style={{ ...GRID, alignItems: 'end', marginBottom: many ? 2 : 0 }}>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11.5, color: 'var(--ink-3)' }}>Everyone</span>
            <span style={{ display: 'flex', height: 30, borderRadius: 8, overflow: 'hidden' }}>
              {op.map((p, oi) => (
                <span key={oi} style={{ width: p + '%', boxSizing: 'border-box', background: wfShade(T.color, oi), display: 'flex', alignItems: 'center', justifyContent: oi === op.length - 1 ? 'flex-end' : 'flex-start', padding: '0 9px', color: wfShadeText(oi), fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden' }}>{p >= 24 ? q.options[oi].label : ''}</span>
              ))}
            </span>
          </div>
          {WF_GRP(dim, axis).map((g, gi) => {
            const key = q.id + ':' + cutKey + ':' + gi;
            const w = counts.map((c, oi) => (c / total) * (0.55 + wfHash(key + ':' + oi)));
            const ps = sharePcts(w);
            return { g, gi, ps };
          }).sort((a, b) => b.ps[0] - a.ps[0]).map(({ g, gi, ps }) => {
            const you = g.label === youBand;
            return (
              <div key={gi} style={GRID}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: many ? 11.5 : 12, minWidth: 0, color: you ? 'var(--ink)' : 'var(--ink-2)' }}>
                  {g.color && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, flexShrink: 0 }}></span>}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
                </span>
                <span style={{ position: 'relative', display: 'flex', height: barH, borderRadius: many ? 5 : 7, overflow: 'visible', boxShadow: you ? '0 0 0 1.5px var(--ink)' : 'none' }}>
                  <span style={{ position: 'absolute', inset: 0, display: 'flex', borderRadius: many ? 5 : 7, overflow: 'hidden' }}>
                    {ps.map((p, oi) => <span key={oi} style={{ width: p + '%', background: wfShade(T.color, oi) }}></span>)}
                  </span>
                  <span aria-hidden="true" style={{ position: 'absolute', top: -3, bottom: -3, left: op[0] + '%', width: 1.5, borderRadius: 1, background: 'var(--ink)', opacity: 0.55 }}></span>
                </span>
              </div>
            );
          })}
        </div>
        )}
      </div>
    );
  }

  // ── how people ranked ── one row per item, one cell per position: fill is the
  // share of people who put that item there. Peaked = the crowd agrees, flat =
  // it doesn't. Your own placement is the ringed cell.
  renderRankStats(q, T) {
    const done = this.state.votes[q.id] || {};
    const myOrder = done.order || [];
    const N = q.items.length;
    const dist = (i) => {
      const r = q.crowd[i];
      const w = [];
      for (let p = 1; p <= N; p++) w.push(Math.exp(-Math.abs(p - r) * 0.85) * (0.75 + 0.5 * wfHash(q.id + ':' + i + ':' + p)));
      return sharePcts(w);
    };
    const items = q.items.map((label, i) => ({ i, label, ps: dist(i) })).sort((a, b) => q.crowd[a.i] - q.crowd[b.i]);
    // friends' first picks, weighted by the crowd's share at position one
    const p1 = items.map((it) => it.ps[0]);
    const tot1 = p1.reduce((a, b) => a + b, 0);
    const firstOf = (name) => { const r = wfHash(q.id + ':first:' + name); let acc = 0; for (let k = 0; k < items.length; k++) { acc += p1[k] / tot1; if (r < acc) return k; } return 0; };
    const top = items[0];
    const rkFr = WF_FRIENDS.filter((f) => wfDid(q, f));
    const nTop = rkFr.filter((f) => firstOf(f.name) === 0).length;
    const GRID = { display: 'grid', gridTemplateColumns: `84px repeat(${N}, 1fr)`, gap: 5, alignItems: 'center' };
    const cellCol = (share) => `color-mix(in oklch, ${T.color} ${Math.min(100, Math.round(share * 1.7))}%, var(--surface-3))`;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>{wfFmt(q.votes || 0)} rankings</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>
            <span aria-hidden="true" style={{ width: 13, height: 13, borderRadius: 4, background: 'var(--surface-3)', boxShadow: 'inset 0 0 0 1.5px var(--ink)' }}></span>your order
          </span>
        </div>
        <div style={{ ...GRID, marginBottom: -2 }}>
          <span></span>
          {Array.from({ length: N }, (_, p) => (
            <span key={p} style={{ textAlign: 'center', fontFamily: 'var(--sans)', fontSize: 10.5, fontWeight: 700, color: 'var(--ink-3)' }}>{p + 1}</span>
          ))}
        </div>
        {items.map(({ i, label, ps }) => {
          const mine = myOrder.indexOf(i);
          return (
            <div key={i} style={GRID}>
              <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 800, color: 'var(--ink-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
              {ps.map((share, p) => (
                <span key={p} title={label + ' at #' + (p + 1) + ': ' + share + '%'} style={{ height: 26, borderRadius: 6, background: cellCol(share), boxShadow: mine === p ? 'inset 0 0 0 1.5px var(--ink)' : 'none' }}></span>
              ))}
            </div>
          );
        })}
        {rkFr.length ? <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', marginTop: 4 }}>{nTop} of {rkFr.length} {rkFr.length === 1 ? 'friend' : 'friends'} had {top.label.toLowerCase()} first.</div> : null}
      </div>
    );
  }

  // compact density: answered vote/duel cards collapse to one thin split bar
  renderThinBar(q, T) {
    if (q.type === 'pick') {
      const v = this.pickVal(q);
      const ent = v && typeof v === 'object' ? v.entity : v;
      const C = WF_CATALOGS[q.catalog];
      if (C) {
        const it = C.items.find((x) => x.id === ent);
        if (!it) return null;
        return <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 5, background: wfCatArt(T.color, q.catalog + ':' + it.id), flexShrink: 0 }}></span><span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{it.name}</span></div>;
      }
      const name = this.pickName(ent, q.domain);
      const c = this.pickSrc(q).canon(q.id);
      const lead = c && c.top.length ? this.pickName(c.top[0].entity, q.domain) : null;
      return <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>you {name || '\u2026'} · crowd {lead || '\u2014'}</span>;
    }
    if (q.type === 'know') {
      const r = this.knowOf(q);
      if (!r) return null;
      return <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><LMStreak k={r.streak} of={LEARN.STREAK} col={T.color}></LMStreak><span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>{r.ok ? 'right' : 'missed'}</span></div>;
    }
    if (q.type === 'rate') {
      const v = this.state.votes[q.id];
      const c = PLACESTATS.cat(q.scope, q.catId);
      return <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>you {v}/10 · crowd {c ? c.avg.toFixed(1) : '—'}</span>;
    }
    if (q.type === 'rank') {
      const done = this.rankVal(q);
      if (!done || !done.order) return null;
      // no crowd yet (live first voter, D233) — "ranked" is the whole read
      if (!q.crowd) return <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>ranked</span>;
      const m = done.order.filter((it, pos) => q.crowd[it] === pos + 1).length;
      return <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>ranked{' · '}{m}/{q.items.length} with the crowd</span>;
    }
    if (q.type === 'dial') {
      const v = this.dialVal(q);
      const med = q.live ? this.dialMedOf(q, this.dialDist(q, v)) : q.med;
      return <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>you {this.dialFmt(q, v)} · most say {this.dialFmt(q, med)}</span>;
    }
    if (q.type === 'field') {
      const v = this.fieldVal(q);
      const c = this.fieldCentroid(q);
      if (!c) return <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>placed</span>;
      return <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>{Math.hypot(v.x - c.x, v.y - c.y) < 26 ? 'placed · with the cluster' : 'placed · out on your own'}</span>;
    }
    // selfOnly (D50): a thin bar is still a split — the collapsed card
    // keeps its silence too.
    if (q.selfOnly) return null;
    const mine = this.state.votes[q.id];
    const { p } = wfPcts(q.options.map((o) => o.count), mine);
    return (
      <div style={{ display: 'flex', height: 6, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-3)' }}>
        {p.map((w, i) => (
          <span key={i} style={{ width: w + '%', background: 'color-mix(in oklch, ' + T.color + ' ' + Math.max(60 - i * 18, 12) + '%, var(--surface-3))' }}></span>
        ))}
      </div>
    );
  }

  renderCard(q, flags) {
    const F = flags || {};
    // Passed (permanent) and deferred (until tomorrow) draw the same slim
    // row — the difference is what happens on the NEXT visit, where the
    // deferred one is gone from the stream entirely rather than sitting
    // here. Both stay tappable in THIS sitting so an accidental skip costs
    // one tap to undo; the wait only starts mattering once the feed is
    // rebuilt.
    const held = this.state.passed[q.id] ? 'pass' : (this.state.deferred || {})[q.id] ? 'defer' : null;
    if (held) {
      return (
        <button key={q.id} onClick={() => (held === 'pass' ? this.setPass(q.id, false) : this.setDefer(q.id, false))} style={{ border: WF_LINE, borderRadius: 14, background: 'transparent', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', WebkitAppearance: 'none' }}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-3)', flexShrink: 0 }}></span>
          <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.prompt}</span>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>{held === 'defer' ? 'later \u00b7 undo' : 'undo'}</span>
        </button>
      );
    }
    const tm = q.test ? PASSIVE.META[q.test] : null;
    // a lens question wears its lens's own name and hue, the same way a test
    // question wears its test's — otherwise it reads as an off-topic card
    const lz = !tm && q.lens ? LENSES.get(q.lens) : null;
    const mk = tm || (lz ? { label: lz.title, accent: `oklch(0.56 0.13 ${lz.hue})` } : null);
    // a knowledge card wears its field, coloured by its subject
    const kn = q.type === 'know' ? LEARN.field(q.f) : null;
    // Favourites is a format channel, so the chip's hue can't also be the card's:
    // three catalogues rendering in one green loses the subject entirely. The
    // channel keeps the label, the catalogue supplies the colour.
    const cg = q.type === 'pick' ? WF_CATALOGS[q.catalog || q.domain] : null;
    const T0 = kn ? { label: kn.label, color: LEARN.colorOf(q.f) } : cg && cg.hue ? { label: (WF_TOPIC[q.cat] || {}).label || q.cat, color: 'oklch(0.52 0.14 ' + cg.hue + ')' } : mk ? { label: mk.label, color: mk.accent } : (WF_TOPIC[q.cat] || { label: q.cat, color: 'var(--ink-3)' });
    // one gate for all four hue sources — see world-palette.js
    const T = { ...T0, color: WPAL.c(T0.color) };
    const scene = !mk && !kn && q.scene ? SCENES.defs().find((g) => g.id === q.scene) : null;
    const leaf = !mk && !kn && !q.scene && q.sub ? WF_SUB(q.sub) : null;
    const kickLabel = scene ? scene.name : (tm ? tm.label + ' test' : (lz ? lz.title : leaf ? leaf.label : T.label));
    // the quiet marker that this one has a right answer: a ring, not a filled dot
    const kickDot = kn
      ? { width: 7, height: 7, borderRadius: '50%', background: 'transparent', boxShadow: `inset 0 0 0 2px ${T.color}`, flexShrink: 0 }
      : { width: 6, height: 6, borderRadius: '50%', background: T.color, flexShrink: 0 };
    const bgText = WF_BGTEXT(q);
    // Null on every card but this lane's, so it doubles as "does this
    // question have a clock" (data/askWindow.ts).
    const win = askWindow(q);
    const compact = this.props.density === 'compact';
    // focus mode: one question, hosted outside the feed (search results)
    const focus = !!this.props.focus;
    const answered = this.answered(q);
    const open = !!this.state.open[q.id];
    const collapsed = compact && !open;
    const kicker = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {/* A sponsored card wears the disclosure INSTEAD of its topic chip
            (D195). Not beside it: a paid card carrying a topic hue reads as
            house content with a note attached, which is the one thing the
            band exists to prevent. The rest of the row — the `i` button,
            the closing ring, the passive tag — is unchanged, because a paid
            question is in every other respect an ordinary question. */}
        {q.sponsor
          ? <SponsorMark sponsor={q.sponsor} until={q.until}></SponsorMark>
          // The kicker names the topic; when it is NOT a sponsor mark it
          // also names the card's FORM in words (2026-09-02) — "this or
          // that", "rank", "place it". The feed serves nine shapes and a
          // reader met each one by discovering it; a sponsor mark keeps
          // the pill it needs and says nothing else.
          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: mk ? 12.5 : 10.5, fontWeight: mk ? 600 : 800, letterSpacing: mk ? 0 : '.09em', textTransform: mk ? 'none' : 'uppercase', color: WPAL.ink(T.color), background: mk ? WPAL.wash(T.color, 13, 'var(--surface-2)') : 'transparent', border: mk ? `0.5px solid color-mix(in oklch, ${T.color} 40%, var(--rule))` : 'none', borderRadius: 999, padding: mk ? '4px 12px 4px 10px' : 0, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><span aria-hidden="true" style={kickDot}></span>{kickLabel}{!mk && q.type && q.type !== 'vote' ? <span style={{ color: 'var(--ink-3)' }}>{'\u00b7 ' + (WF_FORM_WORD[q.type] || q.type)}</span> : null}</span>}
        {bgText ? (
          <button className="press tap44" onClick={(e) => { e.stopPropagation(); clearTimeout(this._sheetT); this.setState({ sheet: { panel: 'bg', q, T } }); }} aria-label="What you need to know" style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', border: '0.5px solid color-mix(in oklch, var(--ink) 26%, var(--rule))', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 800, lineHeight: 1, cursor: 'pointer', WebkitAppearance: 'none', padding: 0 }}>i</button>
        ) : (
          <button className="press tap44" onClick={(e) => { e.stopPropagation(); clearTimeout(this._sheetT); this.setState({ sheet: { panel: 'bg', q, T } }); }} aria-label="About this question" style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', border: '0.5px solid var(--rule)', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 800, lineHeight: 1, cursor: 'pointer', WebkitAppearance: 'none', padding: 0 }}>i</button>
        )}
        {/* A real deadline outranks the decorative one — never both (D231). */}
        {win ? this.renderWindow(T, win) : (F.closing && this.renderClock(T))}
        <span style={{ flex: 1 }}></span>
        <PassiveTag q={q} answered={answered}></PassiveTag>
      </div>
    );
    const snap = !compact && !focus;
    // Three densities give the scroll a pulse instead of one uniform stack:
    // duels go full-bleed, text questions sit typographic on the ground, and
    // only a collapsed (or search-focused) card keeps the box. Under v2 every
    // open card is bare — a hairline gives the stream its structure where
    // borders and shadows used to, and the topic hue stays in the kicker.
    const skin = collapsed || focus ? 'card' : q.type === 'duel' ? 'bleed' : (this.opts.v2 || q.type === 'vote') ? 'bare' : 'card';
    const card = { background: 'var(--surface-2)', border: mk ? '1px solid color-mix(in oklch, ' + T.color + ' 32%, var(--rule))' : WF_LINE, borderRadius: 18, boxShadow: 'var(--shadow-card)', padding: collapsed ? '12px 14px' : '16px 15px', display: 'flex', flexDirection: 'column', gap: collapsed ? 8 : 12 };
    // hero cards carry a whisper of their topic hue so the breathing room reads designed, not blank
    if (!collapsed) { const cbase = skin === 'bleed' ? 'var(--surface-a)' : 'var(--surface-2)'; card.backgroundImage = 'radial-gradient(120% 80% at 50% -25%, ' + WPAL.wash(T.color, 11, cbase) + ', ' + cbase + ' 62%)'; }
    if (skin === 'bleed') {
      card.margin = '0 -16px'; card.borderRadius = 0; card.borderLeft = 'none'; card.borderRight = 'none';
      card.boxShadow = 'none'; card.padding = '16px 16px 20px';
      // full-bleed means it IS the page here — --surface-2 is near-white and
      // would read as a bright slab cut into the warm ground
      card.background = 'var(--surface-a, var(--surface))';
      if (this.opts.v2) card.borderBottom = 'none';
    }
    if (skin === 'bare') {
      card.background = 'transparent'; card.border = 'none'; card.boxShadow = 'none';
      card.padding = '10px 1px 22px'; card.backgroundImage = 'none';
      if (this.opts.v2) { card.borderTop = WF_LINE; card.padding = '20px 1px 24px'; }
    }
    if (snap) {
      // one question per view — the card fills most of the scroller; kicker
      // holds the top edge while the question + options sit centered,
      // hero-scale. Answered cards drop the floor entirely (cardFloor) so the
      // result shrinks to its own height and the next question rises into
      // view, instead of every card ending on a screen of empty ground.
      card.minHeight = this.cardFloor(answered);
      card.boxSizing = 'border-box';
    }
    if (collapsed) {
      return (
        <div key={q.id} className={this._io ? 'wf-card' : ''} ref={(el) => { if (el && this._io && !el._wfSeen) { el._wfSeen = 1; el._wfQid = q.id; this._io.observe(el); } }} role="button" tabIndex={0} onClick={() => this.setState((s) => ({ open: { ...s.open, [q.id]: true } }))} onKeyDown={(e) => { if (e.key === 'Enter') this.setState((s) => ({ open: { ...s.open, [q.id]: true } })); }} style={{ ...card, cursor: 'pointer' }}>
          {kicker}
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 750, fontSize: 14.5, lineHeight: 1.3, letterSpacing: -0.2, textWrap: 'pretty' }}>{q.prompt}</div>
          {answered && this.renderThinBar(q, T)}
        </div>
      );
    }
    return (
      <div key={q.id} className={this._io ? 'wf-card' : ''} ref={(el) => { if (el && this._io && !el._wfSeen) { el._wfSeen = 1; el._wfQid = q.id; this._io.observe(el); } }} style={card}>
        {kicker}
        {snap && !answered && <div aria-hidden="true" style={{ flex: '0.12 1 0' }}></div>}
        {/* the bare skin has no box to compete with, so the question can carry
            the card on its own — it steps up a size and tightens accordingly,
            and steps back down when `hier` gives the daily the top of the page */}
        {/* the prompt voice (2026-09-02): a question a person answers is
            set in the serif, and only where it IS the card — snap and
            focus. A row prompt stays sans: at 16.5px in a list it is a
            label for a card, not the card. */}
        <div style={{ fontFamily: snap || focus ? 'var(--serif)' : 'var(--sans)', fontWeight: snap || focus ? 500 : 600, fontSize: snap ? (skin === 'bare' ? (this.opts.hier ? 26 : 30) : (this.opts.hier ? 23 : 26)) : focus ? 22 : 16.5, lineHeight: snap ? 1.18 : focus ? 1.22 : 1.25, letterSpacing: snap || focus ? '-0.01em' : -0.25, textWrap: snap || focus ? 'balance' : 'pretty' }}>{q.prompt}</div>
        {q.type === 'vote' && this.renderVote(q, T, snap)}
        {q.type === 'duel' && this.renderDuel(q, T, snap)}
        {q.type === 'rank' && this.renderRank(q, T, snap)}
        {q.type === 'rate' && this.renderRate(q, T, snap)}
        {q.type === 'dial' && this.renderDial(q, T, snap)}
        {q.type === 'field' && this.renderField(q, T, snap)}
        {q.type === 'know' && this.renderKnow(q, T, snap)}
        {q.type === 'pick' && this.renderPick(q, T, snap)}
        {/* Skip, before answering only, and it means two different things.
            On a world card it is a PASS: permanent, sinks to a slim row,
            "not this one".
            On a test or lens card it is a DEFERRAL (D121): the card leaves
            the feed and comes back tomorrow. These cards had no skip at
            all, on the reasoning that a silent skip would read as a gap in
            your own results — true of a pass, and the reason this is not
            one. The instrument's denominator does not move, the profile
            still names the axis as thin, and the question returns until it
            is answered. "later" rather than "skip", because the word is
            the promise. */}
        {!answered && this.opts.pass && (
          <button className="press"
            onClick={() => (mk ? this.setDefer(q.id, true) : this.setPass(q.id, true))}
            style={{ alignSelf: 'center', border: 'none', background: 'none', padding: '6px 16px', marginTop: 2, cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 13, color: 'var(--ink-3)', WebkitAppearance: 'none' }}>{mk ? 'later' : 'skip'}</button>
        )}
        {answered && this.state.beat !== q.id && q.type !== 'know' && q.type !== 'pick' && this.renderEngage(q, T, snap)}
        {snap && !answered && <div aria-hidden="true" style={{ flex: '1 1 0' }}></div>}
      </div>
    );
  }

  // the feed-side twin of the orbit's suggested ring — one quiet card offering
  // a scene to follow; prefers one that adds a stream you don't have yet
  renderSuggestion(sugg, snap) {
    const t = WF_TOPIC[SCENES.topicOf(sugg.id)] || null;
    const col = t ? t.color : 'var(--ink-3)';
    return (
      <div key="scene-sugg" style={{ border: '1.5px dashed color-mix(in oklch, var(--rule), var(--ink) 20%)', borderRadius: 18, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', boxSizing: 'border-box', scrollSnapAlign: snap ? 'start' : undefined }}>
        <span style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box', border: '2px dashed ' + col, background: 'color-mix(in oklch, ' + col + ' 10%, var(--surface-2))' }}></span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15 }}>{sugg.name}</span>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 11.5, color: 'var(--ink-3)' }}>suggested scene · {wfFmt(sugg.members)} people · {sugg.vibe}</span>
        </div>
        <button className="press" onClick={() => SCENES.follow(sugg.id)} style={{ border: 'none', borderRadius: 999, padding: '8px 15px', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', background: 'var(--ink)', color: 'var(--surface)', flexShrink: 0, WebkitAppearance: 'none' }}>Follow</button>
      </div>
    );
  }

  render() {
    // focus mode — just the given question(s), no chip rail, no weaving.
    // Search hosts this so a result IS the real card: same votes, same reveal.
    if (this.props.focus) {
      return (
        <div ref={(n) => { this._root = n; }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* the same dispatch the stream uses: a story found through
              search opens as the real story card, not as renderCard's
              option apparatus over a walk (D341) */}
          {this.props.focus.filter(Boolean).map((q) => (q.type === 'path'
            ? <PathsCard key={q.id} q={q}></PathsCard>
            : this.renderCard(q, {})))}
          {this.renderSheet()}
        </div>
      );
    }
    const { cats, onToggle } = this.props;
    const scenes = SCENES.mine();
    // topics pulled in by a live (followed + unmuted) scene — but a scene that
    // owns a subtopic pulls only that leaf, so the two never double up
    const ST = SUBTOPICS;
    const pulled = {};
    const leafOn = {};
    const owned = {};
    scenes.forEach((s) => {
      const lf = SCENES.subOf(s.id);
      if (lf) owned[lf] = true;
      if (cats[s.id] === false) return;
      if (lf) { leafOn[lf] = true; return; }
      const t = SCENES.topicOf(s.id); if (t) pulled[t] = true;
    });
    if (ST) ST.mine().forEach((s) => { if (cats[s.id] !== false && !owned[s.id]) leafOn[s.id] = true; });
    // Room cards match on the room alone; everything else matches on every
    // topic it carries — home plus `also` doors — with a mute on any of them
    // as a veto (wfFeedMatch, docs/TAGS-PLAN.md §2). One matched door shows
    // the card once: the stream grouping below still keys on `cat` alone.
    const qs = this.feedPool().filter((q) => q.scene
      ? SCENES.has(q.scene) && cats[q.scene] !== false
      : wfFeedMatch(q, { cats, pulled, leafOn, chanSet: WF_CHAN_SET }));
    // interleave streams round-robin so the feed reads as a mix, not blocks.
    // In world-feed-math.js so TAGS-PLAN §1 — one card, one stream, however
    // many doors it carries — has a test that runs the real grouping.
    const mixed = wfStreamMix(qs);
    // sort lenses: hot = the interleaved mix · top = most votes · new = latest first
    const sort = this.state.sort;
    const sorted = sort === 'top' ? [...qs].sort((a, b) => wfVotes(b) - wfVotes(a)) : sort === 'new' ? [...qs].reverse() : mixed;
    // keep one continuum question (dial/field) pinned near the top of hot — the
    // pin holds after answering, so the card doesn't jump away mid-read
    if (sort === 'hot') {
      if (!this._contPin || !sorted.some((q) => q.id === this._contPin)) {
        const isCont = (q) => q.type === 'dial' || q.type === 'field';
        const cq = sorted.find((q) => isCont(q) && this.state.votes[q.id] == null) || sorted.find(isCont);
        this._contPin = cq && cq.id;
      }
      const ci = sorted.findIndex((q) => q.id === this._contPin);
      if (ci > 1) { const [cq] = sorted.splice(ci, 1); sorted.splice(1, 0, cq); }
    }
    // Fresh questions only, within whichever sort lens is on. The bank is
    // finite and served in a stable order, so every session used to open
    // on the same head of cards — the ones the user answered first — as a
    // wall of results. The feedback came twice and escalated: "I keep
    // seeing things I have answered" (which sank the done half), then
    // "answered questions shouldn't appear in the feed at all". So the
    // done half now leaves the feed and parks behind the Answered
    // expander at the bottom — results, takes and the D86 change
    // affordance all stay reachable there. Sticky per MOUNT: answered-ness
    // is sampled the first time a card is seen this visit and frozen, so
    // the card you just voted on keeps its place while you watch its
    // reveal, and moves behind the expander on the next visit instead.
    // Passed cards deliberately do NOT move — a pass is "not now", already
    // rendered as one slim row, and parking it would turn "not now" into
    // "never".
    if (!this._sunk) this._sunk = new Map();
    const sunk = (q) => {
      let v = this._sunk.get(q.id);
      if (v === undefined) { v = this.answered(q); this._sunk.set(q.id, v); }
      return v;
    };
    const worldSplit = partitionAnswered(sorted, sunk);
    // weave in the tests' own questions — one marked card every few feed
    // items — and the lenses' questions behind them at half that rate. The
    // core tests own the feed; lenses trickle. Both streams get the same
    // fresh-only treatment: the test stream walks its pool from index 0
    // every session, so it re-led with already-answered items in exactly
    // the way the world stream did.
    // PASSIVE.testFor() rather than the raw pool: a live bank can carry
    // items for a test the app no longer has. Deleting a test from /content
    // stops it being WRITTEN, not served — retiring a shipped question is an
    // operator `active: false` flip (functions/src/v2.ts), so the 20
    // `test-cognitive-*` docs D103 retired are still live and still arrive
    // in TEST_FEED_QS. Unfiltered they would weave in as marked cards for a
    // test with no bank, no result page and no progress row to land on.
    // testFor() returns null for any key PASSIVE.META has dropped, so this
    // fences the next retirement too without naming it.
    // testFeedPool(), not the imported demo array: a live build's items
    // come from the bank with published counts, and reading the import
    // directly is what served fabricated ones for a build (D280).
    const testSplit = partitionAnswered(testFeedPool(TEST_FEED_QS).filter((q) => PASSIVE.testFor(q)), sunk);
    // Deferred items leave the stream until their wait is up (D121).
    //
    // Sampled ONCE per build, like `sunk` above and for the same reason: a
    // card deferred mid-scroll keeps its place until the next visit, so the
    // tap that says "later" does not vanish the row under the thumb. It
    // leaves on the next rebuild, which is when "later" starts.
    //
    // Filtered here rather than inside partitionAnswered because a deferral
    // is not an answer: it must not join the `done` half, which is the
    // record of what you have said.
    const heldNow = Date.now();
    const notHeld = (q) => !isDeferred(this.state.deferred, q.id, heldNow);
    const tqs = testSplit.fresh.filter(notHeld);
    // LENS_FEED_QS is a builder, not an array: the lens pool differs between
    // demo and live, and liveness lands only after boot — so the feed asks
    // at build time rather than keeping a snapshot (lens-defs.js says why).
    const lensQs = LENS_FEED_QS;
    const lensSplit = partitionAnswered(typeof lensQs === 'function' ? lensQs() : [], sunk);
    const lqs = lensSplit.fresh.filter(notHeld);
    // What the expander holds, in the same order the feed would have
    // shown it: the world's record first, then the test and lens streams'.
    const doneList = [...worldSplit.done, ...testSplit.done, ...lensSplit.done];
    // The weave walks the FRESH world list, and its cadences walk the FULL
    // list's depth (D348). It used to walk the full list — answered cards
    // included — and drop the answered ones from the output below, so the
    // side streams could not be starved: the test/lens slots fire on
    // world indices, the bank is finite, and the fresh half only ever
    // shrinks — at eight fresh world cards the lens stream (every 9th)
    // would have stranded its remaining questions FOREVER. That kept the
    // counts right and the order wrong. A returning device's answered
    // cards are a PREFIX of the stable order (you answer from the top),
    // so every slot that fired against the prefix survived the drop as a
    // solid block at the head of the feed: sixteen answered put seven
    // side cards before the first topic card, forty put nineteen, and
    // the owner's "when you first open the app it never seems to add
    // topics that are not tests or learn" was this, not the depletion
    // D309 read it as. So the fresh list is what gets woven, and `depth`
    // carries the full length: the same side cards land, at the designed
    // rhythm among the fresh topics, with the surplus after them — which
    // at the fully caught-up end is exactly what the full walk produced.
    // The paid slot (D195). Every sponsored card leaves the ordinary
    // stream and at most ONE comes back, at a fixed depth — the cap is the
    // unit of sale, so it has to be a property of the code rather than of
    // how many the bank happens to hold. The match runs HERE, on the
    // device, against anchors the device already has: the server is never
    // asked who should see what.
    // ONE paid slot, and both kinds compete for it (D197): a sponsored
    // QUESTION (path 2 — answered like any other, folds into the public
    // aggregate) and an AD (path 3 — text, no answer, no data). They
    // rotate together by day, so a week with one of each splits the days
    // rather than giving the question every one of them.
    const paidSplit = partitionSponsored(
      sorted,
      (LIVE.enabled && LIVE.anchors()) || {},
      utcDayIndex(heldNow),
      (LIVE.enabled && LIVE.feedAds()) || [],
      new Date(heldNow).toISOString().slice(0, 10),
    );
    const ordered = paidSplit.rest;
    const kEvery = LEARN_FEED.every();
    // The knowledge stream is NOT partitioned: LEARN_FEED schedules its own
    // spaced repetition, and re-serving an answered card on its due day is
    // that feature working, not the bug this partition removes.
    const kqs = kEvery ? this.knowQs(Math.ceil(ordered.length / kEvery) + 1, cats) : [];
    // The cadences, their coprimality and the empty-feed drain all live in
    // data/feed-interleave.ts, which is where the test now reaches them.
    // The slot carries whichever kind won the day. An ad is not a question,
    // so it rides as `{ id, ad }` and the render loop dispatches on it —
    // renderCard's apparatus (options, who-voted, takes, the insight line)
    // has nothing to say about a card that asks nothing.
    const paidCard = paidSplit.ad
      ? { id: paidSplit.ad.id, ad: paidSplit.ad }
      : paidSplit.sponsored;
    const dropWorld = new Set(worldSplit.done.map((q) => q.id));
    const woven = interleaveFeed(ordered.filter((q) => !dropWorld.has(q.id)), {
      tests: tqs, lenses: lqs, know: kqs, knowEvery: kEvery,
      sponsored: paidCard, sponsorAt: SPONSOR_AT,
      depth: ordered.length,
    });
    // The one answered world card that can still be in the weave is the
    // paid one: partitionSponsored picks it off the full list, so a
    // sponsored question the viewer has already answered parks behind the
    // Answered expander like every other answered card instead of
    // spending the day's slot on a result. Stream cards never match a
    // world id, so this touches nothing else.
    const feedList = woven.filter((q) => !dropWorld.has(q.id));
    // Read by the two growth checks above, which run outside render and so
    // cannot see this local. Assigned rather than derived there because the
    // list is the product of a dozen filters and re-deriving it on every
    // scroll frame is exactly the cost the window exists to avoid.
    this._listLen = feedList.length;
    // One card near the top wears the closing ring. Chosen by hash of the
    // question id so it is stable across renders rather than jumping as the
    // list re-sorts, and never the very first card — the ring is a grace
    // note, not the thing you meet first.
    // Never a card that carries a real window (D231) — the fake ring on a
    // card with a true deadline is the one place this grace note would be
    // read as information. Both fallbacks are filtered for the same reason.
    // Nor a story (D341): the ring is renderCard's to draw and PathsCard
    // never would, so a hash that landed on one would silently spend the
    // grace note on a card that cannot wear it.
    const clockable = feedList.filter((q) => !askWindow(q) && q.type !== 'path');
    const closingId = this.opts.clock
      ? ((clockable.slice(0, 8).find((q) => wfHash(q.id + ':close') < 0.3) || clockable[1] || {}).id)
      : null;
    // chip row = your scenes, your followed leaves, then the always-on channels
    const chips = [
      ...scenes.map((s) => ({ id: s.id, label: s.name, color: SCENES.colorOf(s.id), scene: true })),
      ...(ST ? ST.mine().filter((s) => !owned[s.id]).map((s) => ({ id: s.id, label: s.label, color: WPAL.c((WF_TOPIC[s.parent] || {}).color) || null })) : []),
      ...WF_CHANNELS.map((id) => WF_TOPIC[id]).filter(Boolean).map((t) => ({ id: t.id, label: t.label })),
      ...LEARN.mine().map((fd) => ({ id: 'lrn-' + fd.id, label: fd.label, color: WPAL.c(LEARN.colorOf(fd.id)), know: true })),
    ];
    // offers(), not defs(): a live build advertises no demo scene, so the
    // dashed "suggested scene · 3.2K people" card simply never renders
    // there (D96) — the same store-level gate the add sheet reads.
    const cand = SCENES.offers().filter((g) => !SCENES.has(g.id));
    cand.sort((a, b) => ((pulled[SCENES.topicOf(b.id)] ? 0 : 1) - (pulled[SCENES.topicOf(a.id)] ? 0 : 1)) || (b.match - a.match));
    const sugg = cand[0] || null;
    const snap = this.props.density !== 'compact';
    return (
      <div ref={(n) => { this._root = n; }} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        {/* the rule sits ABOVE the chip row: it separates the daily card from
            the feed, and the first feed card brings its own hairline (the v2
            bare skin) — a bottom rule here would double it */}
        <div style={{ position: 'sticky', top: 0, zIndex: 6, display: 'flex', flexDirection: 'column', gap: 10, margin: '6px -16px 0', padding: '12px 16px 10px', background: 'var(--surface-a, var(--surface))', borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 15%)', transform: this.state.headHide ? 'translateY(-115%)' : 'none', opacity: this.state.headHide ? 0 : 1, pointerEvents: this.state.headHide ? 'none' : 'auto', transition: 'transform 0.32s ease, opacity 0.26s ease' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* the rail ends before the + rather than running under it: no chip is ever
              cut mid-word behind the button — the fade is the rail's own edge (data-ef) */}
          <div className="h-scroll" style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', flex: 1, minWidth: 0, padding: '2px 0' }}>
            {/* one chip grammar in this rail: same shape, same size, same weight.
                the sort control cycles hot → top → new instead of wearing a caret. */}
            <button key="__sort" className="wf-chip" onClick={() => this.setState({ sort: sort === 'hot' ? 'top' : sort === 'top' ? 'new' : 'hot', shown: WF_PAGE })} aria-label={'Sort: ' + sort} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, border: '0.5px solid color-mix(in oklch, var(--ink) 22%, var(--rule))', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', whiteSpace: 'nowrap' }}>{sort === 'top' ? 'top' : sort === 'new' ? 'new' : 'hot'}</button>
            {chips.map((t, ci) => {
              const on = cats[t.id] !== false;
              const col = t.color;
              return (
                <React.Fragment key={t.id}>
                  <button className="wf-chip" onClick={() => onToggle(t.id)} aria-pressed={on} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '0.5px solid ' + (on ? (col ? `color-mix(in oklch, ${col} 40%, var(--rule))` : 'color-mix(in oklch, var(--rule), var(--ink) 22%)') : 'var(--rule)'), background: on ? (col ? `color-mix(in oklch, ${col} 10%, var(--surface-2))` : 'var(--surface-2)') : 'transparent', color: on ? 'var(--ink-2)' : 'var(--ink-3)', fontFamily: 'var(--sans)', fontWeight: on ? 700 : 600, fontSize: 12, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', whiteSpace: 'nowrap' }}>
                    {col && on && <span aria-hidden="true" style={t.know ? { width: 7, height: 7, borderRadius: '50%', background: 'transparent', boxShadow: `inset 0 0 0 2px ${col}`, flexShrink: 0 } : { width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0 }}></span>}
                    {t.label.toLowerCase()}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
          <span aria-hidden="true" style={{ width: 1, height: 18, flexShrink: 0, background: 'color-mix(in oklch, var(--rule), transparent 25%)' }}></span>
          {/* the rail's + adds a chip: follow another topic */}
          <button className="wf-chip press tap44" onClick={() => this.setState({ sheet: { panel: 'add' } })} aria-label="Add a topic" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, flexShrink: 0, border: '0.5px solid color-mix(in oklch, var(--accent) 45%, var(--rule))', background: 'color-mix(in oklch, var(--accent) 9%, var(--surface-2))', color: 'var(--accent)', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none' }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5 V19 M5 12 H19"></path></svg>
          </button>
          </div>
        </div>
        {feedList.slice(0, this.state.shown).map((q, i) => (
          <React.Fragment key={q.id}>
            {/* The reading game (D196) — held at the head, not dealt into
                the stream: it is one thing you are doing, not a card in
                it. (Crossroads stood beside it here until D341 made a
                story an ordinary member of the stream — see the dispatch
                below.) It renders nothing in a demo build and nothing
                until there are enough fair reads to keep a record worth
                believing, so this line adds a card only where there is a
                real one to add.

                THIS SLOT HELD THE FUTURE-PREDICTION CARD FOR ONE DAY
                (D194's tier-A call, which guessed the app's own future
                numbers). D196 took it off: the owner wants predictions to
                be about real events or not at all, and that half is not
                built. The machinery stands, unmounted, the way D136 left
                this game's engine — see D196. */}
            {i === 0 && <LiveReadGame />}
            {sugg && i === 2 && this.renderSuggestion(sugg, snap)}
            {/* Three card shapes, one stream. A Crossroads story (D341) is
                a MEMBER of feedList — a feed question like any other, so
                the sort, the topic chips, the weave and the answered
                partition all place it and several can be on screen at
                once — but its reveal is a tree rather than a split, so it
                renders through its own component instead of renderCard
                (the D136 half that stands). D136 pinned one story at the
                head instead; the owner's correction is on record in D341:
                "it should be in the feed like the others". */}
            {q.ad
              ? <AdCard ad={q.ad}></AdCard>
              : q.type === 'path'
                ? <PathsCard q={q}></PathsCard>
                : this.renderCard(q, { closing: q.id === closingId })}
          </React.Fragment>
        ))}
        {/* Room to scroll INTO while the window is still short of the list.
            Without it a feed whose mounted cards already fit the viewport
            can never fire the scroll that would grow it, and the window
            stalls at its first page — the one failure mode of this shape
            that looks like "the feed just ends". aria-hidden: it is
            spacing, and a screen reader walks the cards, not the gap. */}
        {this.state.shown < feedList.length && <div style={{ height: 260 }} aria-hidden="true"></div>}
        {sugg && feedList.length <= 2 && this.renderSuggestion(sugg, snap)}
        {/* two different empties: a feed with nothing FRESH is caught up
            (the record sits right below), a feed with nothing AT ALL is
            muted. Conflating them told a finished user to un-mute. */}
        {feedList.length === 0 && (doneList.length > 0
          ? <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', padding: '26px 0 6px' }}>You’re caught up — you’ve answered everything here. New questions land with the next drop.</div>
          : <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', padding: '26px 0' }}>Everything is muted — tap a chip to bring it back.</div>)}
        {/* the record: answered cards leave the feed (fresh questions
            only — release feedback) but never the reach of it. Collapsed
            by default; open, they are the same real cards — results,
            takes, and the D86 change affordance. */}
        {doneList.length > 0 && (
          <button className="press" aria-expanded={this.state.doneOpen} onClick={() => this.setState((s) => ({ doneOpen: !s.doneOpen }))} style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 7, border: '0.5px solid color-mix(in oklch, var(--ink) 18%, var(--rule))', background: 'var(--surface-2)', color: 'var(--ink-2)', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12.5, padding: '7px 15px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', margin: '4px 0 2px' }}>
            Answered · {doneList.length}
            <span aria-hidden="true" style={{ fontSize: 10, transform: this.state.doneOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }}>{'▾'}</span>
          </button>
        )}
        {this.state.doneOpen && doneList.map((q) => (q.type === 'path'
          ? <PathsCard key={q.id} q={q}></PathsCard>
          : this.renderCard(q, {})))}
        {this.renderSheet()}
      </div>
    );
  }
}

window.WorldFeed = WorldFeed;

;globalThis.WorldFeed = typeof WorldFeed === 'undefined' ? globalThis.WorldFeed : WorldFeed;
;globalThis.WF_LS = typeof WF_LS === 'undefined' ? globalThis.WF_LS : WF_LS;

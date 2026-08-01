// Ported from design/spec-modules/world-feed.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import ReactDOM from 'react-dom';

// world-feed.jsx — the question feed under the World daily. Answer today's
// question and the feed starts: dilemmas, this-or-thats, rankings and image
// duels from the scenes you follow (SCENES — the same list the Mirror orbit
// manages) plus the always-on channels. Chips = your scenes as filter.
// One hue per topic; results encode as bar length, not numbers-everywhere.

const WF_LS = 'insight.feedVotes.v1';
const WF_REPLIES_LS = 'insight.feedReplies.v1';
const WF_TAKES_LS = 'insight.feedTakes.v1';
const WF_PASS_LS = 'insight.feedPass.v1';
// where a vote lands on your Mirror — the ripple line after answering
const WF_BRANCH = { food: 'Food', sport: 'Body', movies: 'Taste', music: 'Taste', tech: 'Mind', culture: 'Values', dilemma: 'Morals', event: 'Mind', people: 'Values', bigq: 'Values', fav: 'Taste' };
const WF_TOPICS = window.WORLD_TOPICS || [];
const WF_TOPIC = Object.fromEntries(WF_TOPICS.map((t) => [t.id, t]));
const WF_CHANNELS = window.WORLD_CHANNELS || [];
const WF_CHAN_SET = Object.fromEntries(WF_CHANNELS.map((id) => [id, true]));
// second level of the tree: colour comes from the parent topic, label from the leaf
const WF_SUB = (id) => (id && window.SUBTOPICS ? window.SUBTOPICS.get(id) : null);
// background knowledge, only where a question can't be answered honestly without it
const WF_BGTEXT = (q) => (q && (q.bg || (window.WORLD_BG || {})[q.id])) || null;
const WF_LINE = '1px solid color-mix(in oklch, var(--rule), transparent 25%)';

function wfLoad() {
  try { const v = JSON.parse(localStorage.getItem(WF_LS) || '{}'); return v && typeof v === 'object' ? v : {}; }
  catch (e) { return {}; }
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
function wfFmt(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : '' + n; }
function wfVotes(q) { return q.type === 'rank' ? (q.votes || 0) : q.type === 'rate' ? (q.n || 0) : q.type === 'pick' ? (q.n || (((window.WF_CATALOGS || {})[q.catalog] || {}).picks || 0)) : q.options ? q.options.reduce((a, o) => a + o.count, 0) : 0; }
function wfPcts(counts, mineIdx) {
  const c = counts.map((n, i) => n + (mineIdx === i ? 1 : 0));
  const total = c.reduce((a, b) => a + b, 0);
  const p = c.map((n) => Math.round((n / total) * 100));
  p[p.indexOf(Math.max(...p))] += 100 - p.reduce((a, b) => a + b, 0);
  return { p, total };
}

// image placeholder tile art — topic-tinted, pattern varies per card so the
// feed doesn't read as one repeating texture (real images drop in later)
function wfTileArt(color, seed) {
  const a = 'color-mix(in oklch, ' + color + ' 32%, var(--surface-2))';
  const b = 'color-mix(in oklch, ' + color + ' 15%, var(--surface-2))';
  const v = Math.floor(wfHash('tile:' + seed) * 4);
  if (v === 0) return 'radial-gradient(110% 120% at 82% 100%, ' + a + ', transparent 58%), linear-gradient(150deg, ' + b + ', ' + a + ')';
  // a bare colour is not a valid background-image layer — it computes to `none`,
  // leaving the dots floating on the card with no fill behind them
  if (v === 1) return 'radial-gradient(circle, ' + a + ' 1.7px, transparent 2.1px) 0 0 / 14px 14px, linear-gradient(' + b + ', ' + b + ')';
  if (v === 2) return 'repeating-linear-gradient(135deg, ' + a + ' 0, ' + a + ' 2px, transparent 2px, transparent 11px), linear-gradient(160deg, ' + b + ', color-mix(in oklch, ' + color + ' 19%, var(--surface-2)))';
  return 'radial-gradient(120% 130% at 22% 12%, ' + a + ', transparent 62%), linear-gradient(160deg, ' + b + ', ' + a + ')';
}

// a catalogue's ranking is not one ranking — every population has its own, and the
// difference between them is the whole point of the breakdown. Each group reweights
// the same counts deterministically, so an item near a neighbour can overtake it
// while a runaway leader usually holds. Shares are derived from those same weights
// against the head's real share of the vote, so a group's numbers stay honest
// arithmetic rather than a second invented statistic.
function wfPickGroup(qid, key, ranked, headShare) {
  const w = (it) => it.count * (0.45 + wfHash(qid + '|' + key + '|' + it.id) * 1.95);
  const tot = ranked.reduce((a, it) => a + w(it), 0) || 1;
  return ranked.map((it) => ({ it, share: (w(it) / tot) * headShare })).sort((a, b) => b.share - a.share);
}

// catalogue tiles stand in for real posters and portraits, so they need more
// presence than the duel tiles' whisper — a strip of near-cream rectangles reads
// as broken, not as artwork pending. Still one hue per card: strength and pattern
// carry the difference between neighbours, never a second colour.
function wfCatArt(color, seed) {
  const t = 38 + Math.floor(wfHash('cat:' + seed) * 4) * 9;            // 38 / 47 / 56 / 65
  const a = 'color-mix(in oklch, ' + color + ' ' + t + '%, var(--surface-2))';
  const b = 'color-mix(in oklch, ' + color + ' ' + (t - 24) + '%, var(--surface-2))';
  const v = Math.floor(wfHash('catp:' + seed) * 5);
  if (v === 0) return 'radial-gradient(120% 130% at 78% 100%, ' + a + ', transparent 62%), linear-gradient(155deg, ' + b + ', ' + a + ')';
  if (v === 1) return 'radial-gradient(circle, ' + a + ' 2px, transparent 2.5px) 0 0 / 15px 15px, linear-gradient(' + b + ', ' + b + ')';
  if (v === 2) return 'repeating-linear-gradient(125deg, ' + a + ' 0, ' + a + ' 3px, transparent 3px, transparent 13px), linear-gradient(165deg, ' + b + ', ' + a + ')';
  if (v === 3) return 'linear-gradient(135deg, ' + a + ' 0 46%, ' + b + ' 46%)';
  return 'radial-gradient(100% 120% at 26% 14%, ' + a + ', transparent 66%), linear-gradient(200deg, ' + b + ', ' + a + ')';
}

// count-up for revealed percentages — runs only right after your vote
function WfCount({ to, animate, dur = 650 }) {
  const [v, setV] = React.useState(animate ? 0 : to);
  React.useEffect(() => {
    if (!animate) { setV(to); return; }
    let raf, t0;
    const step = (t) => { if (!t0) t0 = t; const k = Math.min((t - t0) / dur, 1); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // `dur` is deliberately not a dependency: it is the animation's
    // duration, read once when the run starts. Including it would restart
    // a count-up mid-flight whenever the caller passed a new duration,
    // which is the opposite of what a duration means.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, animate]);
  return <span>{v}</span>;
}

// ── who-voted breakdowns ── one topic hue; option = shade strength, so sides
// stay readable without a second palette. Splits derive deterministically from
// the overall counts + a hash, like the daily's.
function wfHash(s) { let h = 9; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489); return ((h ^ (h >>> 9)) >>> 0) / 4294967295; }
// Per-option hue: option 0 keeps the topic colour, the rest rotate away
// from it. The v15 revision folds the old lightness-ramp wfShade into this
// one family — live k-floored bars and demo bars now share the palette.
function wfOpt(color, i, n) { return i === 0 ? color : 'oklch(from ' + color + ' 0.55 0.14 calc(h + ' + Math.round(i * ((n || 2) > 2 ? 120 : 150)) + '))'; }
// v2: one hue per card. Strength encodes rank, so the winner reads first and a
// scroll never shows more than the topic's own colour.
function wfTint(color, rank, n) { const steps = Math.max((n || 4) - 1, 1); const s = 30 - (24 * Math.min(rank, steps)) / steps; return 'color-mix(in oklch, ' + color + ' ' + s.toFixed(1) + '%, var(--surface))'; }
function wfShade(color, i, n) { return wfOpt(color, i, n); }
function wfShadeText() { return '#fff'; }
// rate cards have no sides — a 1–10 score reads as tint strength of the one hue
function wfRateBg(color, s) { return 'color-mix(in oklch, ' + color + ' ' + (12 + s * 8.8).toFixed(1) + '%, var(--surface))'; }
function wfRateInk(s) { return s >= 6 ? '#fff' : 'var(--ink)'; }
// a group's rate on a knowledge card, drifted deterministically off the real one
// (same trick as the opinion splits). ±23-point spread, so differences mean something.
function wfKnowRate(id, key, p, bias) { return Math.max(4, Math.min(97, Math.round(p + (wfHash(id + ':k:' + key) - 0.5) * 40 + (bias || 0)))); }
// education level is the one cut with a real direction on knowledge — leaving it
// to pure noise produces headlines like “Trade school beats Doctorate on the
// asteroid belt”, which reads as broken data rather than as an insight
function wfKnowBias(dim, axis, n, i) { return dim === 'edu' && !axis && n > 1 ? (i / (n - 1) - 0.5) * 22 : 0; }
// a group's average, drifted deterministically off the real one (same trick as the splits)
function wfRateAvg(qid, key, avg) { return Math.max(1.2, Math.min(9.9, avg + (wfHash(qid + ':' + key) - 0.5) * 3.6)); }
// every who-voted cut in one place (vote-cuts.js): demographics, then the four
// tests — each opening into its own subvalues, the same axes the Circle map uses
const WF_CUTS = () => (window.VOTECUTS ? window.VOTECUTS.dims() : [{ id: 'friends', label: 'Friends' }]);
// Knowledge questions take a NARROWER set of cuts than opinions do. “Who voted
// this way” by gender is a fact about identity; “who got this wrong” by gender is
// a claim about competence, and that is not a chart this app should draw. What
// legitimately explains knowing a fact: what you studied, what you do, how old
// you are, where you live — so those, and nothing else.
const WF_KNOW_CUTS = ['friends', 'age', 'edu', 'job', 'where'];
const WF_SUBS = (dim) => (window.VOTECUTS ? window.VOTECUTS.subs(dim) : null);
const WF_GRP = (dim, ax) => (window.VOTECUTS ? window.VOTECUTS.groups(dim, ax) : []);
const WF_CUTKEY = (dim, ax) => (ax ? dim + ':' + ax : dim);
const WF_YOU = (dim, ax) => (window.VOTECUTS ? window.VOTECUTS.you(dim, ax) : null);
// Live breakdown dimensions, in display order. Must stay a subset of
// BREAKDOWN_DIMS (functions/src/pure.ts) — a dimension the server never
// publishes would render an empty chip. `profession` is collected but not
// sliced by (D8), and `friends` is demo-only: a named who-voted at world
// scale is exactly what D1 rules out.
const WF_LIVE_DIMS = [
  ['ageBand', 'Age'], ['gender', 'Gender'], ['city', 'City'], ['country', 'Country'],
  ['education', 'Education'], ['relationship', 'Relationship'],
];

// Bucket keys are stored canonically so that one cohort is one key
// worldwide — `country` is the ISO code and `city` is "Oslo, NO" (D9). That
// is the right thing to STORE and the wrong thing to show, so it is turned
// back into a name here, in the reader's own language via Intl.
function wfBucketLabel(dim, bucket) {
  const P = window.PLACES;
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
const WF_FRIENDS = [{ name: 'Alex', init: 'A' }, { name: 'Mia', init: 'M' }, { name: 'Jordi', init: 'J' }, { name: 'Sara', init: 'S' }, { name: 'Noah', init: 'N' }, { name: 'Elif', init: 'E' }];

class WorldFeed extends React.Component {
  state = { votes: wfLoad(), knowRes: {}, pickQ: {}, pending: {}, open: {}, panels: {}, dims: {}, cutAxis: {}, boosts: {}, vh: 0, beat: null, sheet: null, sideFilter: null, reportFor: null, replyTo: null, replies: wfLoadReplies(), myTakes: wfLoadTakes(), minds: {}, ctrIdx: {}, takeSort: 'mind', whyFor: null, headHide: false, sort: 'hot', passed: wfLoadMap(WF_PASS_LS), ripple: null };

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
    };
  }

  // ── snap scrolling: cards arrive one at a time and snap into place ──
  // The tab's scroller gets y-proximity snap while the feed is mounted; each
  // card fills most of the viewport (next one peeking) and snap-aligns to top.
  componentDidMount() {
    this.applySnap(); this._retry = setTimeout(() => this.applySnap(), 400);
    // scenes followed elsewhere (orbit, suggestion card) appear here live
    this._unsubScenes = window.SCENES ? window.SCENES.subscribe(() => this.forceUpdate()) : null;
    // Reconcile with the live store. The feed seeds its votes from
    // localStorage at mount and never looked at LIVE again, so a vote the
    // server REFUSED — LIVE rolls it back and scrubs the WF_LS mirror —
    // kept showing a result split here until the component remounted.
    //
    // Deletion is gated on the id being absent from BOTH the store and the
    // mirror. Absence from myVotes() alone is not evidence of a rollback:
    // during a partial hydrate the store is legitimately incomplete, and
    // trusting it would mass-un-vote the whole feed.
    this._unsubLive = window.LIVE && window.LIVE.subscribe
      ? window.LIVE.subscribe(() => {
        const mine = (window.LIVE.myVotes && window.LIVE.myVotes()) || {};
        const mirror = wfLoad();
        this.setState((s) => {
          let changed = false;
          const votes = { ...s.votes };
          for (const id of Object.keys(votes)) {
            if (mine[id] == null && mirror[id] == null) { delete votes[id]; changed = true; }
          }
          for (const [id, v] of Object.entries(mine)) {
            const n = Number(v);
            if (!Number.isNaN(n) && votes[id] !== n) { votes[id] = n; changed = true; }
          }
          return changed ? { votes } : null;
        });
      })
      : null;
    this._unsubSubs = window.SUBTOPICS ? window.SUBTOPICS.subscribe(() => this.forceUpdate()) : null;
    this._unsubLearn = window.LEARN ? window.LEARN.subscribe(() => this.forceUpdate()) : null;
    this._unsubLF = window.LEARN_FEED ? window.LEARN_FEED.subscribe(() => this.forceUpdate()) : null;
    // entrance: each card rises as it first scrolls into view (transform-only)
    this._io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('wf-in'); this._io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' }) : null;
  }
  componentDidUpdate() { this.applySnap(); }
  componentWillUnmount() {
    clearTimeout(this._retry);
    clearTimeout(this._sheetT);
    clearTimeout(this._rippleT);
    if (this._unsubScenes) this._unsubScenes();
    if (this._unsubLive) this._unsubLive();
    if (this._unsubSubs) this._unsubSubs();
    if (this._unsubLearn) this._unsubLearn();
    if (this._unsubLF) this._unsubLF();
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

  // skip a card. Local only, and it must stay that way: answers are
  // create-only and immutable server-side (D5), and a pass is not an answer —
  // recording one would either pollute the aggregate or need a second
  // write path per question for something the user asked to ignore.
  setPass(id, on) {
    this.setState((s) => {
      const passed = { ...s.passed };
      if (on) passed[id] = 1; else delete passed[id];
      try { localStorage.setItem(WF_PASS_LS, JSON.stringify(passed)); } catch { /* best-effort */ }
      return { passed };
    });
  }

  setVote(q, val) {
    const id = q.id;
    // live cards persist to Firestore too (owner-only answer + aggregate)
    if (q.live && window.LIVE && typeof val === 'number') window.LIVE.vote(id, String(val));
    if (window.PASSIVE) window.PASSIVE.record(q); // no-op unless this is a test's own question (q.test)
    // …and the same for a lens question. The scale runs agree→disagree while
    // the lens stores disagree→agree, hence 4 - val.
    if (window.LENSES && q.lens) window.LENSES.record({ ...q, value: typeof val === 'number' ? 4 - val : 2 });
    this._fresh = id; // gates the reveal's count-up + bar growth to the vote moment
    // the feed's memory: with the crowd or against it. Local to this device
    // (feed-read.js) — it reports only your own answers, so no floor applies.
    if (window.FEEDREAD && q.options && typeof val === 'number') {
      const counts = q.options.map((o) => o.count);
      const { p } = wfPcts(counts, val);
      window.FEEDREAD.log(id, { maj: p[val] === Math.max(...p) });
    }
    // the ripple — where this vote landed on your Mirror. Deliberately on
    // ~45% of answers, chosen by a hash of the id so it is stable per
    // question rather than random per render: every card saying it makes it
    // wallpaper, and a re-render must not make it flicker.
    const rip = this.opts.ripple && wfHash(id + ':rip') < 0.45 ? id : null;
    if (rip) {
      clearTimeout(this._rippleT);
      this._rippleT = setTimeout(() => {
        if (this.state.ripple === rip) this.setState({ ripple: null });
      }, 3200);
    }
    this.setState((s) => {
      const votes = { ...s.votes, [id]: val };
      try { localStorage.setItem(WF_LS, JSON.stringify(votes)); } catch { /* best-effort */ }
      const beat = (this.props.beats !== false && window.ConsequenceBeat) ? id : s.beat;
      // Ask for a reason once, while the vote is warm, and only if this
      // question has none of your takes yet. Demo cards only: a live card
      // shows no takes, so there would be nowhere for the answer to go.
      const askWhy = this.opts.why && !q.live && typeof val === 'number' && !(s.myTakes[id] || []).length ? id : s.whyFor;
      return { votes, beat, ripple: rip || s.ripple, whyFor: askWhy };
    });
    if (this.props.onVote) this.props.onVote(q, val);
  }

  // the consequence beat — replaces the result reveal for ~2s after a vote
  renderBeat(q, T, big) {
    const mine = this.state.votes[q.id];
    const { p } = wfPcts(q.options.map((o) => o.count), mine);
    return (
      <ConsequenceBeat seed={q.id} options={q.options.map((o, i) => ({ label: o.label, color: wfShade(T.color, i) }))}
        pcts={p} mineIdx={mine} height={big ? 300 : 200} onDone={() => this.setState({ beat: null })} />
    );
  }

  // ranking: tap items in order; tapping an assigned item un-assigns it
  tapRank(q, i) {
    this.setState((s) => {
      const cur = (s.pending[q.id] || []).slice();
      const at = cur.indexOf(i);
      if (at >= 0) cur.splice(at, 1); else cur.push(i);
      if (cur.length === q.items.length) {
        const votes = { ...s.votes, [q.id]: { order: cur } };
        try { localStorage.setItem(WF_LS, JSON.stringify(votes)); } catch { /* best-effort */ }
        return { votes, pending: { ...s.pending, [q.id]: [] } };
      }
      return { pending: { ...s.pending, [q.id]: cur } };
    });
  }

  // rate cards: score a place 1–10; feeds the city/country/world scorecards
  setRate(q, score) {
    this.setState((s) => {
      const votes = { ...s.votes, [q.id]: score };
      try { localStorage.setItem(WF_LS, JSON.stringify(votes)); } catch { /* best-effort: private mode, quota */ }
      return { votes };
    });
    if (window.PLACESTATS) window.PLACESTATS.rate(q.scope, q.catId, score);
  }

  renderRate(q, T, big) {
    const v = this.state.votes[q.id];
    const c = window.PLACESTATS ? window.PLACESTATS.cat(q.scope, q.catId) : null;
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
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 34 : 26, letterSpacing: '-0.03em', color: T.color, fontVariantNumeric: 'tabular-nums' }}>{avg.toFixed(1)}</span>
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

  // the woven knowledge cards, planned ONCE per sitting. LEARN.plan re-derives
  // from your position in the deck, so calling it every render would reshuffle
  // the feed under you — the list is cached and only rebuilt when what you follow
  // (or the frequency) actually changes, never when you answer.
  knowQs(n, cats) {
    const LF = window.LEARN_FEED, L = window.LEARN;
    if (!LF || !L || !LF.every()) return [];
    const muted = Object.keys(cats || {}).filter((k) => k.indexOf('lrn-') === 0 && cats[k] === false).sort().join(',');
    const sig = LF.freq() + '|' + L.mine().map((f) => f.id).join(',') + '|' + muted;
    if (this._kqSig !== sig || !this._kq) { this._kqSig = sig; this._kq = LF.cards(Math.max(14, n), cats); }
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
    try { localStorage.setItem(WF_LS, JSON.stringify(votes)); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Best-effort — in-memory state stays correct. */ }
    this.setState({ votes });
  }
  // catalogue cards from the prototype's demo store (world-catalogs.js) —
  // repo pick cards (q.domain, real committed catalogues) dispatch here
  // only when they carry a q.catalog; renderPick below owns the rest.
  renderPickCatalog(q, T, big) {
    const C = (window.WF_CATALOGS || {})[q.catalog];
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
            style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderBottom: '1px solid color-mix(in oklch, var(--ink) 20%, var(--rule))', background: 'none', padding: '8px 2px', fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 600, color: 'var(--ink)', outline: 'none' }} />
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
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: (s / maxS) * 100 + '%', borderRadius: 99, background: isMine ? T.color : `color-mix(in oklch, ${T.color} 40%, transparent)`, transformOrigin: 'left', animation: `wfBarIn .5s cubic-bezier(.2,.8,.2,1) ${(0.06 + i * 0.05).toFixed(2)}s both` }}></span>
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
    const C = (window.WF_CATALOGS || {})[q.catalog];
    if (!C) return null;
    const dim = this.state.dims[q.id] || 'friends';
    const axis = this.state.cutAxis[q.id] || null, cutKey = WF_CUTKEY(dim, axis), youBand = WF_YOU(dim, axis);
    const mine = this.state.votes[q.id];
    const ranked = C.items.slice().sort((a, b) => b.count - a.count);
    const headShare = ranked.reduce((a, i) => a + (i.count / C.picks) * 100, 0);
    const overall = ranked[0];
    const groups = dim === 'friends' ? WF_FRIENDS.map((f) => ({ label: f.name, init: f.init })) : WF_GRP(dim, axis);
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
              <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: Math.min(100, (win.share / headShare) * 320) + '%', borderRadius: 99, background: diverges ? T.color : `color-mix(in oklch, ${T.color} 38%, transparent)` }}></span>
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
          <span style={{ flex: 1, minWidth: 0 }}>{nDiv ? nDiv + ' of ' + groups.length + ' put someone else first' : 'Every group agrees'}</span>
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
    if (this.state.votes[q.id] != null || !window.LEARN) return;
    const r = window.LEARN.answer(q.learn, i);
    if (!r) return;
    const votes = { ...this.state.votes, [q.id]: i };
    try { localStorage.setItem(WF_LS, JSON.stringify(votes)); } catch (e) { /* localStorage can throw: private mode, quota, disabled storage. Best-effort — in-memory state stays correct. */ }
    this.setState((s) => ({ votes, knowRes: { ...s.knowRes, [q.id]: r } }));
  }
  // a reload keeps your pick but not the verdict object — rebuild it from the store
  knowOf(q) {
    const v = this.state.votes[q.id];
    if (v == null) return null;
    const live = this.state.knowRes[q.id];
    if (live) return live;
    const L = window.LEARN, c = L && L.card(q.learn);
    if (!c) return null;
    const cs = L.stateOf(q.learn) || {};
    return { ok: v === c.c, correct: c.c, split: window.LEARN_SPLIT(c), streak: cs.s === 'known' ? L.STREAK : (cs.k || 0), mastered: false, lost: false, wasKnown: cs.s === 'known', replay: true };
  }
  renderKnow(q, T, big) {
    const L = window.LEARN;
    const card = L && L.card(q.learn);
    if (!card) return null;
    const r = this.knowOf(q);
    const my = this.state.votes[q.id];
    const fresh = !!this.state.knowRes[q.id];
    const cs = L.stateOf(q.learn);
    const streakNow = r ? r.streak : (cs && cs.s === 'learning' ? cs.k : 0);
    const pale = `color-mix(in oklch, ${T.color} 16%, transparent)`;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {card.a.map((label, i) => {
            const isC = !!r && i === r.correct;
            const isMine = !!r && my === i;
            const pct = r ? r.split[i] : 0;
            const showPct = !!r && (isC || (isMine && !r.ok));
            return (
              <button key={i} className="press" disabled={!!r} onClick={() => this.setKnow(q, i)}
                style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', minHeight: big ? 56 : 50, padding: big ? '14px 16px' : '12px 14px', borderRadius: 14, cursor: r ? 'default' : 'pointer', WebkitAppearance: 'none', transition: 'background .3s ease, color .3s ease',
                  border: isMine && !isC ? '1.5px solid var(--ink)' : WF_LINE,
                  background: isC ? T.color : 'var(--surface-2)', color: isC ? '#fff' : r && !isMine ? 'var(--ink-3)' : 'var(--ink)' }}>
                {r && !isC ? <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct + '%', background: pale, transformOrigin: 'left', animation: fresh ? `wfBarIn .55s cubic-bezier(.2,.8,.2,1) ${(0.08 + i * 0.06).toFixed(2)}s both` : 'none' }}></span> : null}
                <span style={{ position: 'relative', flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontWeight: isC ? 800 : 600, fontSize: big ? 16.5 : 15, lineHeight: 1.3, textWrap: 'pretty' }}>{label}</span>
                {showPct ? <span style={{ position: 'relative', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}>{fresh ? <WfCount to={Math.round(pct)} animate={true}></WfCount> : Math.round(pct)}%</span> : null}
                {isC ? <span style={{ position: 'relative', fontSize: 13, fontWeight: 800 }}>{'\u2713'}</span> : null}
                {r && isMine && !isC ? <span style={{ position: 'relative', fontSize: 13, fontWeight: 800, color: 'var(--ink-2)' }}>{'\u2715'}</span> : null}
              </button>
            );
          })}
        </div>
        {!r && streakNow > 0 ? <LMStreak k={streakNow} of={L.STREAK} col={T.color}></LMStreak> : null}
        {r ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {r.mastered ? (
                <>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: T.color, flexShrink: 0 }}></span>
                  <span style={{ flex: 1, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14 }}>Saved to your map.</span>
                  <button onClick={() => { window.MAP_OPEN_GROUP = 'g-know'; if (window.goTab) window.goTab('mirror'); }} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, color: 'var(--ink-3)', WebkitAppearance: 'none' }}>See it</button>
                </>
              ) : r.ok && r.wasKnown ? (
                <>
                  <LMStreak k={L.STREAK} of={L.STREAK} col={T.color}></LMStreak>
                  <span style={{ flex: 1, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink-2)' }}>Still yours.</span>
                </>
              ) : r.ok ? (
                <>
                  <LMStreak k={r.streak} of={L.STREAK} col={T.color}></LMStreak>
                  <span style={{ flex: 1, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink-2)' }}>{L.STREAK - r.streak <= 1 ? 'One more and it\u2019s yours.' : (L.STREAK - r.streak) + ' more in a row.'}</span>
                </>
              ) : (
                <>
                  <LMStreak k={0} of={L.STREAK} col={T.color}></LMStreak>
                  <span style={{ flex: 1, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink-2)' }}>{r.lost ? 'Off your map — three in a row to win it back.' : 'Three in a row to earn it.'}</span>
                </>
              )}
            </div>
            {/* D32/D1: in live mode the split above is either a real
                measurement or the authored estimate — and the estimate is
                never allowed to pass as measured, so the reveal says which
                one it is. Demo builds carry their own honesty layers. */}
            {window.LIVE && window.LIVE.enabled ? (
              <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.45 }}>
                {(window.LEARN_SPLIT_SRC ? window.LEARN_SPLIT_SRC(card) : 'estimate') === 'measured'
                  ? 'Real answers from ' + (((window.LIVE.learnAgg && window.LIVE.learnAgg(card.id)) || {}).total || 5) + '+ players.'
                  : 'Our estimate — becomes measured once enough people have answered.'}
              </div>
            ) : null}
            {card.w ? <p style={{ margin: 0, fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 500, lineHeight: 1.5, color: 'var(--ink-2)', textWrap: 'pretty' }}>{card.w}</p> : null}
            {this.opts.reveal ? this.renderKnowInsight(q, T) : null}
            {window.LMFriends ? <LMFriends card={card} col={T.color}></LMFriends> : null}
          </div>
        ) : null}
      </div>
    );
  }

  // pick cards: one favourite from a shipped catalogue; the vote stored is
  // the entry's key (docs/CATALOG-QUESTIONS.md — a key, never a string)
  setPick(q, entity) {
    this.setState((s) => {
      const votes = { ...s.votes, [q.id]: { entity } };
      try { localStorage.setItem(WF_LS, JSON.stringify(votes)); } catch { /* best-effort: private mode, quota */ }
      return { votes };
    });
    if (window.PICKS) window.PICKS.pick(q.id, entity);
  }

  // Which catalogue a pick question resolves against (D15: pokemon is
  // dex-keyed, films/artists are QID-keyed; same load/peek/nameOf shape).
  pickStore(domain) {
    return domain === 'films' ? window.FILMS : domain === 'artists' ? window.ARTISTS : domain === 'emoji' ? window.EMOJI : window.POKEDEX;
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

  renderPick(q, T, big) {
    if (q.catalog) return this.renderPickCatalog(q, T, big);
    const v = this.state.votes[q.id];
    const store = this.pickStore(q.domain);
    if (v == null) {
      return <PickSearch domain={q.domain} accent={T.color} big={big} onPick={(id) => this.setPick(q, id)} onNotListed={() => this.setPick(q, store ? store.NOT_LISTED : 0)} />;
    }
    // The reveal is a canon, not a split: top entities above the floor,
    // everyone else in one bucket. Your own pick always shows to YOU — it
    // is your own answer, no floor applies — and when it is below the floor
    // the copy says so instead of pretending it counted. Segment chips
    // (D17) reorder the SAME board by one cohort's counts — a segment
    // never surfaces entities the global board suppressed.
    const c = window.PICKS ? window.PICKS.canon(q.id) : { top: [], rest: 0, total: 0 };
    const segs = window.PICKS ? window.PICKS.segs(q.id) : [];
    const sel = (this.state.pickSeg || {})[q.id] || null;
    const seg = sel && window.PICKS ? window.PICKS.canonSeg(q.id, sel.dim, sel.bucket) : null;
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
    const nounOf = { pokemon: 'Pokémon', emoji: 'emoji', films: 'films', artists: 'artists' };
    const foldNoun = nounOf[q.domain] || 'picks';
    const foldNote = c.restEntities >= 5
      ? ` votes across ${Math.floor(c.restEntities / 5) * 5}+ other ${foldNoun}`
      : c.restEntities >= 2 ? ` votes across a few other ${foldNoun}` : '';
    const foldWhy = foldNote && c.restBelowFloor ? ' — none with 5 yet' : '';
    const TOPN = (window.PICKS && window.PICKS.TOP_N) || 10;
    const tile = (ent, nm, label, strong, count, rank) => (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: strong ? 'var(--ink-2)' : 'var(--ink-3)' }}>{label}</span>
        <span aria-hidden="true" style={{ width: '100%', height: 92, borderRadius: 12, background: wfCatArt(T.color, q.domain + ':' + ent), border: strong ? `1.5px solid ${T.color}` : WF_LINE, boxSizing: 'border-box', display: 'block' }}></span>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14.5, lineHeight: 1.2, textWrap: 'pretty', color: 'var(--ink)' }}>{nm || '\u2026'}</span>
        <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{count != null ? (rank ? '#' + rank + ' on the board \u00b7 ' : '') + shareOf(count) : 'below the floor'}</span>
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
            {/* the ghost row: YOUR below-floor pick, pinned under the board.
                Rendered from your own stored vote, never from published
                data — no one else's board shows it, so searching always
                ends in finding yourself without enumerating the tail. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 18, flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, color: 'var(--ink-3)', textAlign: 'right' }}>—</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 14.5 : 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mineName || '…'}</span>
                  <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: T.color, border: '2px solid var(--surface)', boxShadow: '0 0 0 1px ' + T.color, flexShrink: 0 }}></span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 11.5, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>only you see this — too few to count yet</span>
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
            like a bug. Demo boards are full, so this is a launch-era line. */}
        {!seg && rows.length < TOPN && (
          <span style={{ paddingLeft: 27, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)' }}>{rows.length} of {TOPN} spots on the board claimed — a spot needs 5 votes</span>
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
        <input name="why" placeholder="Why?" style={{ flex: 1, minWidth: 0, border: 'none', borderBottom: WF_LINE, background: 'none', padding: '6px 2px', fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', outline: 'none' }} />
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
    return WF_FRIENDS.map((f) => {
      const r = wfHash(q.id + ':' + f.name); let acc = 0, oi = counts.length - 1;
      for (let i = 0; i < counts.length; i++) { acc += counts[i] / total; if (r < acc) { oi = i; break; } }
      return { ...f, oi };
    });
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
            so an escape here renders as a visible backslash on the card */}
        {'You’re early — counts appear once 5 people have answered.'}
      </div>
    );
  }

  renderVote(q, T, big) {
    const mine = this.state.votes[q.id];
    if (mine != null && this.state.beat === q.id) return this.renderBeat(q, T, big);
    if (mine == null) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 11 : 8 }}>
          {q.options.map((o, i) => (
            <button key={i} className="press" onClick={() => this.setVote(q, i)} style={{ border: '1px solid color-mix(in oklch, ' + T.color + ' 45%, var(--rule))', borderRadius: big ? 16 : 12, background: 'color-mix(in oklch, ' + T.color + ' 10%, var(--surface))', boxShadow: 'none', padding: big ? '15px 16px' : '11px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: big ? 16.5 : 14, color: 'var(--ink)', WebkitAppearance: 'none' }}>{o.label}</button>
          ))}
        </div>
      );
    }
    // Below the k-floor there are no numbers to lay out, so the tile
    // treatment — whose whole point is that height IS share — would be
    // drawing a split it has not been told. Bars degrade honestly.
    const floored = !!(q.live && q.tooSmall);
    return this.opts.reveal && !floored
      ? this.renderVoteTiles(q, T, big)
      : this.renderVoteBars(q, T, big);
  }

  // The result as a stack whose HEIGHTS are the shares — a 52/48 reads as
  // 52/48 rather than as a winner and an also-ran. Only ever reached above
  // the floor (see renderVote), so every option can carry its own number.
  renderVoteTiles(q, T, big) {
    const mine = this.state.votes[q.id];
    const { p, total } = wfPcts(q.options.map((o) => o.count), mine);
    const maxP = Math.max(...p);
    const fresh = this._fresh === q.id;
    const n = q.options.length;
    const v2 = this.opts.v2;
    const sides = q.live ? [] : this.friendSides(q, q.options.map((o) => o.count));
    // one row budget per option, so two options do not tower over four
    const H = (big ? 58 : 46) * n + (n - 1) * 7;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 11 : 9, animation: !v2 && fresh ? 'popIn .32s cubic-bezier(0.2,0.8,0.2,1)' : 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, height: H }}>
          {q.options.map((o, i) => {
            // v2: one hue per card. Tint strength tracks share, so 52/48 reads
            // as 52/48 and not as two differently-coloured teams.
            const col = v2 ? T.color : wfOpt(T.color, i, n);
            const tint = 8 + 24 * (p[i] / (maxP || 1));
            const isMine = mine === i;
            const fr = sides.filter((f) => f.oi === i);
            const win = p[i] === maxP;
            return (
              <div key={i} style={{ flex: Math.max(p[i], 4) + ' 1 0', minHeight: big ? 36 : 30, border: isMine ? '1.5px solid color-mix(in oklch, ' + col + ' 60%, var(--rule))' : WF_LINE, borderRadius: big ? 16 : 13, background: 'color-mix(in oklch, ' + col + ' ' + (v2 ? tint.toFixed(1) : 26) + '%, var(--surface))', overflow: 'hidden', position: 'relative', transition: 'flex-grow .7s cubic-bezier(0.2,0.8,0.2,1)' }}>
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: big ? '0 18px' : '0 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, minWidth: 0, flex: 1 }}>
                    <span style={{ fontWeight: win ? 800 : 700, fontSize: big ? 19 : 15, letterSpacing: '-0.02em' }}>{o.label}</span>
                    {isMine && <span style={{ fontSize: 13, fontWeight: v2 ? 500 : 700, color: 'var(--ink-2)', whiteSpace: 'nowrap', animation: !v2 && fresh ? 'chipPop .35s var(--ease-spring) .2s both' : 'none' }}>{'· you'}</span>}
                  </div>
                  {/* Friend dots: DEMO CARDS ONLY. WF_FRIENDS are invented
                      and friendSides derives their side from a hash, so on a
                      live card this would be both a fabrication and the named
                      who-voted at world scale that D1 forbids. v2 drops them
                      from the tile — the footer row carries that weight. */}
                  {!v2 && fr.length > 0 && (
                    <button onClick={() => this.openSheet(q, T, 'stats')} aria-label={fr.map((f) => f.name).join(', ') + ' picked ' + o.label} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 2px', border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0, WebkitAppearance: 'none' }}>
                      {fr.map((f) => <span key={f.name} title={f.name} style={{ width: 9, height: 9, borderRadius: '50%', background: col, boxShadow: '0 0 0 1.5px var(--surface)' }}></span>)}
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
        {!this.footInstead(q) && this.renderMeta(q, T, big, total, p, mine)}
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
    return this.opts.v2 && !q.live && !(window.LIVE && window.LIVE.demoInProd);
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
      <button onClick={() => window.goTab && window.goTab('mirror')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--accent, var(--ink-2))', whiteSpace: 'nowrap', animation: 'toastFade 3.2s ease forwards' }}>added to {rip}<span aria-hidden="true">→</span></button>
    );
    if (insight) return insight;
    if (q.type === 'rate') {
      const c = window.PLACESTATS ? window.PLACESTATS.cat(q.scope, q.catId) : null;
      return <span style={quiet}>{wfFmt(c ? c.n : (q.n || 0))} ratings</span>;
    }
    if (!q.options) return <span style={quiet}></span>;
    const mine = this.state.votes[q.id];
    const { total } = wfPcts(q.options.map((o) => o.count), mine);
    return <span style={quiet}>{wfFmt(total)} votes</span>;
  }

  // one quiet line: the scale of the vote, where you sit, and — briefly — where
  // the answer landed on your Mirror
  renderMeta(q, T, big, total, p, mine) {
    const maxP = Math.max(...p);
    const rip = this.state.ripple === q.id ? (WF_BRANCH[q.cat] || 'Interests') : null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 18 }}>
        <span style={{ fontSize: big ? 12.5 : 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>{wfFmt(total)} votes{p[mine] === maxP ? ' · with the majority' : ' · you picked the underdog'}</span>
        {rip && <button onClick={() => window.goTab && window.goTab('mirror')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--accent, var(--ink-2))', whiteSpace: 'nowrap', animation: 'toastFade 3.2s ease forwards' }}>added to {rip}<span aria-hidden="true">→</span></button>}
      </div>
    );
  }

  renderVoteBars(q, T, big) {
    const mine = this.state.votes[q.id];
    const counts = q.options.map((o) => o.count);
    const { p } = wfPcts(counts, mine);
    const maxP = Math.max(...p);
    const fresh = this._fresh === q.id;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 10 : 7, animation: fresh ? 'popIn .3s cubic-bezier(0.2,0.8,0.2,1)' : 'none' }}>
        {q.options.map((o, i) => (
          <div key={i} style={{ position: 'relative', border: mine === i ? '1px solid color-mix(in oklch, ' + T.color + ' 65%, var(--rule))' : WF_LINE, borderRadius: big ? 14 : 11, background: 'var(--surface)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: p[i] + '%', background: 'color-mix(in oklch, ' + T.color + ' ' + (mine === i ? 30 : 15) + '%, transparent)', animation: fresh ? 'barIn .7s cubic-bezier(0.2,0.8,0.2,1) ' + (i * 0.07) + 's both' : 'none' }}></div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 8, padding: big ? '13px 14px' : '9px 12px' }}>
              {mine === i && <span aria-label="Your pick" style={{ width: big ? 18 : 15, height: big ? 18 : 15, borderRadius: '50%', flexShrink: 0, alignSelf: 'center', background: T.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg viewBox="0 0 24 24" width={big ? 10 : 8} height={big ? 10 : 8} fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5 10 18 19.5 6.5"></path></svg></span>}
              <span style={{ flex: 1, minWidth: 0, fontWeight: mine === i ? 800 : 700, fontSize: big ? 15 : 13.5 }}>{o.label}</span>
              {p[i] === maxP && !(q.live && q.tooSmall) && <span style={{ fontWeight: 800, fontSize: big ? 20 : 15, color: 'var(--ink)' }}><WfCount to={p[i]} animate={fresh}></WfCount>%</span>}
            </div>
          </div>
        ))}
        {q.live && q.tooSmall && mine != null && this.renderFloorNote(big)}
      </div>
    );
  }

  renderDuel(q, T, big) {
    const mine = this.state.votes[q.id];
    if (mine != null && this.state.beat === q.id) return this.renderBeat(q, T, big);
    const { p, total } = wfPcts(q.options.map((o) => o.count), mine);
    const fresh = this._fresh === q.id;
    const v2 = this.opts.v2;
    const maxP = Math.max(...p);
    // Below the floor there is no share to draw, and the fill height IS the
    // share — so the fill and the numeral are gated together. Drawing one
    // without the other would publish the split geometrically instead of
    // numerically, which is the same disclosure in a different alphabet.
    const shares = mine != null && !(q.live && q.tooSmall);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {/* square tiles: question, both sides and both shares sit above the
            fold, so no number ever has to be scrolled to */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {q.options.map((o, i) => {
            const chosen = mine === i;
            const win = p[i] === maxP;
            // v2 drops the generated tile art for one quiet ground — the fill
            // is the only ink that moves, so it has to be the only thing there
            const bg = v2 ? 'var(--surface-2)' : wfTileArt(T.color, q.id);
            return (
              <button key={i} className={mine == null ? 'press' : ''} onClick={() => mine == null && this.setVote(q, i)} style={{ position: 'relative', aspectRatio: big ? '1 / 1' : '4 / 3', border: chosen ? '2px solid color-mix(in oklch, ' + T.color + ' 60%, var(--rule))' : WF_LINE, borderRadius: 14, overflow: 'hidden', background: bg, boxShadow: 'none', cursor: mine == null ? 'pointer' : 'default', padding: 0, WebkitAppearance: 'none', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', opacity: mine != null && !chosen ? 0.94 : 1, transition: 'opacity .45s ease', animation: !v2 && fresh && chosen ? 'tilePick .45s cubic-bezier(0.2,0.8,0.2,1)' : 'none' }}>
                {/* the share IS the tile — the side fills to its own percentage */}
                {shares && (
                  <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: p[i] + '%', background: 'color-mix(in oklch, ' + T.color + ' ' + (win ? 40 : 24) + '%, ' + (v2 ? 'var(--surface)' : 'transparent') + ')', borderTop: '1.5px solid color-mix(in oklch, ' + T.color + ' 60%, transparent)', animation: fresh ? 'wfFillUp .85s cubic-bezier(0.2,0.8,0.2,1) both' : 'none', transition: 'height .7s cubic-bezier(0.2,0.8,0.2,1)' }}></span>
                )}
                <span style={{ position: 'relative', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 20 : 15.5, color: 'var(--ink)', padding: v2 ? '0 14px 13px' : '5px 12px', maxWidth: '88%', textAlign: 'center', lineHeight: 1.15, letterSpacing: '-0.02em', borderRadius: 11, background: v2 ? 'transparent' : 'color-mix(in oklch, var(--surface-2) 82%, transparent)', backdropFilter: v2 ? 'none' : 'blur(3px)', WebkitBackdropFilter: v2 ? 'none' : 'blur(3px)' }}>{o.label}</span>
                {shares && (
                  <span style={{ position: 'absolute', top: big ? 9 : 7, left: big ? 12 : 10, fontFamily: 'var(--sans)', fontWeight: win ? 800 : 650, fontSize: big ? (win ? 26 : 19) : (win ? 20 : 15), letterSpacing: '-0.03em', color: win ? 'var(--ink)' : 'var(--ink-2)' }}><WfCount to={p[i]} animate={fresh}></WfCount>%</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  renderRank(q, T, big) {
    const done = this.state.votes[q.id];
    const D = big ? 28 : 24;
    const num = (filled, label) => (
      <span style={{ width: D, height: D, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 13 : 12, boxSizing: 'border-box', background: filled ? T.color : 'transparent', color: filled ? '#fff' : 'var(--ink-3)', border: filled ? 'none' : '1.5px solid color-mix(in oklch, var(--ink-3), transparent 40%)' }}>{label}</span>
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
    const matches = order.filter((it, pos) => q.crowd[it] === pos + 1).length;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 9 : 7, animation: v2 ? 'none' : 'popIn .3s cubic-bezier(0.2,0.8,0.2,1)' }}>
        {order.map((it, pos) => {
          const match = q.crowd[it] === pos + 1;
          return (
            <div key={it} style={{ border: WF_LINE, borderRadius: big ? 13 : 11, background: match ? wfTint(T.color, 1, 3) : 'var(--surface)', padding: big ? '11px 13px' : '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: D, height: D, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 13 : 12, background: T.color, color: '#fff' }}>{pos + 1}</span>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: big ? 15 : 13.5 }}>{q.items[it]}</span>
              {(!v2 || !match) && <span title={'Crowd ranked this #' + q.crowd[it]} style={{ width: D, height: D, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 12.5 : 11.5, boxSizing: 'border-box', color: match ? '#fff' : 'var(--ink-2)', background: match ? T.color : 'transparent', border: match ? 'none' : '1.5px solid color-mix(in oklch, ' + T.color + ' 55%, transparent)' }}>{q.crowd[it]}</span>}
            </div>
          );
        })}
        <button className="press" onClick={() => this.setState({ sheet: { q, T, panel: 'stats' }, sideFilter: null, replyTo: null })} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)', WebkitAppearance: 'none' }}>You matched the crowd on {matches} of {q.items.length}<span aria-hidden="true" style={{ fontWeight: 700 }}>{'\u2192'}</span></button>
      </div>
    );
  }

  answered(q) {
    const v = this.state.votes[q.id];
    return q.type === 'rank' ? !!(v && v.order) : v != null;
  }

  // ── takes + who-voted — open as bottom sheets (revealed only after answering) ──
  renderEngage(q, T, big) {
    // D1: free-text takes and named who-voted are circle-scoped, so a live
    // world card never shows takes. It DOES now show who-voted, because
    // that panel stopped being a lie: the breakdown is real anchor counts,
    // floored per cell with complementary suppression applied server-side
    // (D8), and it carries no names at all. D1 permits "the split, the
    // totals" at world scale — this is a split, sliced.
    //
    // demoInProd stays fully suppressed either way: that is a real user a
    // live build dropped into the mock fallback, where the synthetic
    // splits and the fake named people below would both be lies.
    if (window.LIVE && window.LIVE.demoInProd) return null;
    if (q.live) {
      if (q.type === 'rank') return null;
      // The surprise line belongs HERE and only here: feedInsight reads
      // agg.by, which exists only for live questions, so leaving it below
      // this early return — as it was — meant it never rendered at all.
      const ins = this.renderInsight(q, T, big);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 12 : 10, alignItems: 'flex-start' }}>
          {ins}
          {/* the insight line is itself the way into the breakdown, so the
              bar-chart button would be a second door to the same room */}
          {!ins && (
            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              <button className="press" onClick={() => this.setState({ sheet: { q, T, panel: 'stats' }, sideFilter: null, replyTo: null })} aria-label="who voted" title="who voted" style={{ background: 'none', border: 'none', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', color: 'var(--ink)', WebkitAppearance: 'none' }}>
                <svg width={big ? 23 : 22} height={big ? 23 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19.5V13M12 19.5V5.5M19 19.5V10"></path></svg>
              </button>
            </div>
          )}
        </div>
      );
    }
    // The 'add' panel has no question behind it, so every read of `q` from
    // here down has to tolerate its absence.
    const takes = q ? ((window.WORLD_FEED_COMMENTS || {})[q.id] || []) : [];
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
    const nCtr = this.opts.counter && window.WF_COUNTERS ? takes.reduce((a, c, i) => a + window.WF_COUNTERS(q.id + ':' + i).length, 0) : 0;
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
  // for anything it cannot say from real, already-k-floored data, and this
  // renders nothing rather than inventing a line to fill the space.
  // the rate card's surprise: the cut that sits furthest from the score you gave.
  // Tapping it opens the breakdown already switched to that cut.
  renderRateInsight(q, T, big) {
    const v = this.state.votes[q.id];
    if (typeof v !== 'number') return null;
    const c = window.PLACESTATS ? window.PLACESTATS.cat(q.scope, q.catId) : null;
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

  renderInsight(q, T, big) {
    if (!this.opts.reveal) return null;
    if (q.type === 'rate') return this.renderRateInsight(q, T, big);
    if (!window.feedInsight || !q.options) return null;
    const mine = typeof this.state.votes[q.id] === 'number' ? this.state.votes[q.id] : null;
    const counts = q.options.map((o) => o.count);
    // feedInsight here is the LIVE version (feed-read.js): it reads q alone,
    // ignores the demo-signature args, and returns null on demo cards rather
    // than inventing a cohort (its header says why).
    const ins = window.feedInsight(q, counts, mine, wfHash, WF_FRIENDS);
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
    const takes = q ? ((window.WORLD_FEED_COMMENTS || {})[q.id] || []) : [];
    const close = () => {
      if (s.closing) return;
      this.setState({ sheet: { ...s, closing: true }, replyTo: null, reportFor: null });
      clearTimeout(this._sheetT);
      this._sheetT = setTimeout(() => this.setState((st) => (st.sheet && st.sheet.closing ? { sheet: null } : null)), 230);
    };
    return ReactDOM.createPortal(
      <Sheet onClose={close} closing={s.closing}
        label={panel === 'add' ? 'Add a topic' : panel === 'bg' ? 'About this question' : panel === 'takes' ? 'Takes' : panel === 'pick' || (q && q.type === 'pick') ? 'Who picked what' : panel === 'know' || (q && q.type === 'know') ? 'Who knows this' : q && q.type === 'rank' ? 'How people ranked' : 'Who voted'}>
          <div style={{ padding: '10px 18px 8px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15 }}>{panel === 'add' ? 'Add a topic' : panel === 'bg' ? (WF_BGTEXT(q) ? 'What you need to know' : 'About this question') : panel === 'takes' ? 'Takes' : panel === 'pick' || (q && q.type === 'pick') ? 'Who picked what' : panel === 'know' || (q && q.type === 'know') ? 'Who knows this' : q && q.type === 'rank' ? 'How people ranked' : 'Who voted'}</span>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12, color: 'var(--ink-3)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q ? (q.prompt || q.text || q.title) : ''}</span>
            <button onClick={close} aria-label="Close" style={{ border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', flexShrink: 0, WebkitAppearance: 'none' }}>{'\u2715'}</button>
          </div>
          <div className="wf-sheet-body">
            {panel === 'add' ? this.renderAdd() : panel === 'bg' ? this.renderContext(q, T) : panel === 'takes' ? this.renderTakes(q, T, takes) : this.renderStats(q, T)}
          </div>
      </Sheet>, host);
  }

  // ── follow more: topics (with their leaves) first, then communities ──
  // Scenes are a local, client-side subscription (window.SCENES) — following
  // one changes which questions the feed mixes in and nothing that leaves
  // the device.
  renderAdd() {
    const SC = window.SCENES;
    const ST = window.SUBTOPICS;
    const label = { fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-3)', margin: '4px 2px 6px' };
    const openLeaves = ST ? ST.all().filter((s) => {
      if (ST.has(s.id)) return false;
      const own = SC && SC.subOf ? SC.mine().some((g) => SC.subOf(g.id) === s.id) : false;
      return !own;                                    // a followed community already covers its leaf
    }) : [];
    const open = SC ? SC.defs().filter((g) => !SC.has(g.id)).sort((a, b) => b.match - a.match) : [];
    const L = window.LEARN, LF = window.LEARN_FEED;
    const learnOpen = L ? L.fields().filter((f) => !L.has(f.id)) : [];
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
        {openLeaves.length ? <div style={label}>Topics</div> : null}
        {openLeaves.map((s) => row(s.id, (WF_TOPIC[s.parent] || {}).color, s.label,
          `${(WF_TOPIC[s.parent] || {}).label || s.parent} · ${ST.count(s.id)} questions`,
          () => { ST.follow(s.id); this.forceUpdate(); }))}
        {open.length ? <div style={{ ...label, marginTop: openLeaves.length ? 18 : 4 }}>Communities</div> : null}
        {open.map((g) => row(g.id, SC && SC.colorOf ? SC.colorOf(g.id) : null, g.name,
          `${wfFmt(g.members)} people · ${g.vibe}`,
          () => { SC.follow(g.id); this.forceUpdate(); }))}
        {open.length === 0 && openLeaves.length === 0 && !learnOpen.length && (
          <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', padding: '28px 0' }}>You follow every topic.</div>
        )}
        {/* knowledge — the frequency control lives where follows live, and stays
            coarse: how many fields you follow is already an intensity dial. */}
        {LF ? (
          <div style={{ marginTop: open.length || openLeaves.length ? 20 : 2 }}>
            <div style={label}>Learn</div>
            <p style={{ margin: '0 2px 11px', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500, lineHeight: 1.45, color: 'var(--ink-3)', textWrap: 'pretty' }}>Questions with a right answer, mixed into the feed. Get one right and it lands on your map.</p>
            <div style={{ display: 'flex', gap: 4, padding: 3, border: '0.5px solid var(--rule)', background: 'var(--surface)', borderRadius: 999 }}>
              {LF.LEVELS.map((v) => {
                const on = LF.freq() === v;
                return <button key={v} className="press" onClick={() => { LF.setFreq(v); this.forceUpdate(); }} aria-pressed={on} style={{ flex: 1, border: 'none', borderRadius: 999, padding: '8px 0', cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontWeight: on ? 800 : 600, fontSize: 12.5, background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--surface)' : 'var(--ink-3)', transition: 'background .2s ease, color .2s ease' }}>{v}</button>;
              })}
            </div>
            {learnOpen.map((f) => row('lrn-' + f.id, L.colorOf(f.id), f.label,
              `${(L.subject(f.subject) || {}).label || ''} · ${L.total(f.id)} cards`,
              () => { L.follow(f.id); this.forceUpdate(); }, true))}
          </div>
        ) : null}
        {/* the one in-reach way to propose a question, now that the rail's + adds topics */}
        <button className="press" onClick={() => { this.setState({ sheet: null }); if (window.openSuggestions) window.openSuggestions(); }} style={{ marginTop: 14, padding: '11px 0', border: '0.5px solid var(--rule)', background: 'var(--surface-2)', borderRadius: 14, cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--ink-2)', WebkitAppearance: 'none' }}>Suggest a question</button>
      </div>
    );
  }

  // ── context — the i on every card. Facts and definitions where a question needs
  // them, and for every question the things that are otherwise invisible until
  // you answer: where it came from, how big the vote is, and which branch of your
  // Mirror your answer moves. Never the arguments — those live in the reveal.
  renderContext(q, T) {
    const bg = WF_BGTEXT(q);
    const L = window.LEARN;
    const kn = q.type === 'know' && L ? L.card(q.learn) : null;
    const fd = kn ? L.field(q.f) : null;
    const rows = [];
    if (kn) {
      rows.push(['Field', fd ? fd.label + ' \u00b7 ' + ((L.subject(fd.subject) || {}).label || '') : '']);
      rows.push(['Crowd', kn.p + '% get this right']);
      rows.push(['On your map', 'Knowledge']);
    } else {
      const scene = q.scene && window.SCENES ? window.SCENES.defs().find((g) => g.id === q.scene) : null;
      const leaf = q.sub ? WF_SUB(q.sub) : null;
      rows.push(['Asked in', scene ? scene.name : leaf ? leaf.label : T.label]);
      const cat = q.type === 'pick' ? (window.WF_CATALOGS || {})[q.catalog] : null;
      if (cat) rows.push(['Catalogue', cat.total + ' ' + cat.noun]);
      const n = wfVotes(q);
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
    const R = window.WF_REPORT;
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
    const R = window.WF_REPORT;
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
    const R = window.WF_REPORT;
    if (R && R.has(key)) return this.reportedCard(key);
    const myVote = this.state.votes[q.id];
    const mySide = typeof myVote === 'number' && q.options ? myVote : null;
    const isRate = q.type === 'rate';
    const col = isRate ? (c.score != null ? wfRateBg(T.color, c.score) : 'var(--ink-3)') : (c.opt != null ? wfShade(T.color, c.opt) : 'var(--ink-3)');
    const ctxt = isRate ? (c.score != null ? wfRateInk(c.score) : '#fff') : (c.opt != null ? wfShadeText(c.opt) : '#fff');
    const mine = this.state.replies[key] || [];
    const seeded = (o.counter && window.WF_COUNTERS && !isRate ? window.WF_COUNTERS(key) : []).filter((x) => !(R && R.has(x.ckey)));
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
                  <button key={xi} onClick={() => this.setState((s) => ({ ctrIdx: { ...s.ctrIdx, [key]: xi } }))} aria-label={'counter ' + (xi + 1)} style={{ width: 7, height: 7, padding: 0, borderRadius: '50%', border: 'none', cursor: 'pointer', background: xi === idx ? 'var(--ink)' : 'var(--surface-3)', WebkitAppearance: 'none' }}></button>
                ))}
              </div>
            )}
          </div>
        )}
        {writing && (
          <form onSubmit={(e) => { e.preventDefault(); const inp = e.target.elements.reply; const v = inp.value.trim(); if (v) { this.addReply(key, v); this.setState((s) => ({ ctrIdx: { ...s.ctrIdx, [key]: (s.replies[key] || []).length + seeded.length } })); } }} style={{ display: 'flex', gap: 6, marginLeft: 40 }}>
            <input name="reply" autoFocus placeholder={'Where is it wrong…'} style={{ flex: 1, minWidth: 0, border: WF_LINE, borderRadius: 999, padding: '7px 12px', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500, background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none' }} />
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
    const sigOf = (key, c) => (window.WF_TAKE_SIG ? window.WF_TAKE_SIG(key, c.ups) : { mind: 0, cross: 0.5 });
    let items = takes.map((c, i) => { const key = q.id + ':' + i; return { c, i, key, sig: sigOf(key, c) }; });
    // persuasion sort: what moved people, not what pleased them. A take whose
    // counter did the moving still surfaces — the exchange is the unit.
    const byMind = o.signals && this.state.takeSort === 'mind';
    const best = (it) => { const cs = o.counter && window.WF_COUNTERS ? window.WF_COUNTERS(it.key) : []; return Math.max(it.sig.mind, cs.length ? cs[0].sig.mind : 0); };
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
                {mySide != null && <span style={{ background: wfShade(T.color, mySide), color: wfShadeText(mySide), fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{q.options[mySide].label}</span>}
                {isRate && typeof myVote === 'number' && <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>gave {myVote}</span>}
                <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>now</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 500 }}>{t}</div>
              {o.signals && <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11, color: 'var(--ink-3)' }}>{'↺ ' + (window.WF_TAKE_SIG ? window.WF_TAKE_SIG(q.id + ':own' + i, 60).mind : 0) + ' moved'}</span>}
            </div>
          </div>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); const inp = e.target.elements.take; const v = inp.value.trim(); if (v) { this.addTake(q.id, v); inp.value = ''; } }} style={{ display: 'flex', gap: 6, paddingTop: 2 }}>
          <input name="take" placeholder={!this.answered(q) ? 'Answer first to add a take…' : 'Add your take…'} disabled={!this.answered(q)} style={{ flex: 1, minWidth: 0, border: WF_LINE, borderRadius: 999, padding: '8px 13px', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500, background: 'var(--surface)', color: 'var(--ink)', outline: 'none' }} />
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
    if (!q.live || !window.LIVE || !window.LIVE.aggFor) return null;
    const agg = window.LIVE.aggFor(q.id);
    const by = agg && agg.by;
    return by && Object.keys(by).length ? by : null;
  }

  renderLiveStats(q, T, by) {
    const dims = WF_LIVE_DIMS.filter(([id]) => by[id]);
    const dim = dims.some(([id]) => id === this.state.dims[q.id])
      ? this.state.dims[q.id] : dims[0][0];
    const buckets = by[dim] || {};
    // Biggest cohort first — the ordering the eye wants, and it keeps the
    // withheld tail (which we cannot show at all) out of the way.
    const rows = Object.keys(buckets)
      .map((b) => {
        const cell = buckets[b];
        const n = Object.keys(cell).reduce((a, k) => a + cell[k], 0);
        return { bucket: b, cell, n };
      })
      .sort((a, b2) => b2.n - a.n);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {dims.map(([id, label]) => (
            <button key={id} onClick={() => this.setState((s) => ({ dims: { ...s.dims, [q.id]: id } }))} style={{ border: WF_LINE, borderRadius: 999, padding: '5px 12px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, cursor: 'pointer', background: dim === id ? 'var(--ink)' : 'var(--surface)', color: dim === id ? 'var(--surface)' : 'var(--ink)', WebkitAppearance: 'none' }}>{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {q.options.map((o, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700 }}>
              <span style={{ width: 11, height: 11, borderRadius: 4, background: wfShade(T.color, i), display: 'inline-block' }}></span>{o.label}
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => {
            const ps = q.options.map((_, oi) => Math.round(((r.cell[String(oi)] || 0) / r.n) * 100));
            // rounding drift lands on the largest share, so the bar is full
            const drift = 100 - ps.reduce((a, b2) => a + b2, 0);
            if (drift) ps[ps.indexOf(Math.max(...ps))] += drift;
            return (
              <div key={r.bucket} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, fontSize: 12 }}>{wfBucketLabel(dim, r.bucket)}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>{wfFmt(r.n)} {r.n === 1 ? 'vote' : 'votes'}</span>
                </div>
                <div style={{ display: 'flex', height: 30, border: WF_LINE, borderRadius: 9, overflow: 'hidden', background: 'var(--surface)' }}>
                  {ps.map((p, oi) => (
                    <span key={oi} style={{ width: p + '%', background: wfShade(T.color, oi), display: 'flex', alignItems: 'center', justifyContent: 'center', color: wfShadeText(oi), fontSize: 10.5, fontWeight: 800, overflow: 'hidden' }}>{p >= 14 ? p + '%' : ''}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {/* Absent cohorts are WITHHELD, not empty. Saying so is the point:
            the floor is the product's claim, so the UI has to name it
            rather than quietly show a shorter list. */}
        <div style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.5, textWrap: 'pretty' }}>
          Only groups with enough answers to stay anonymous are shown, and
          counts update in steps of five — so these are floors, not
          live totals. The rest appear as more people answer.
        </div>
      </div>
    );
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
      <div key={k} className="h-scroll" ref={(el) => { const sig = q.id + '|' + dim; if (el && this['_dSig' + k] !== sig) { this['_dSig' + k] = sig; window.VOTECUTS && window.VOTECUTS.centerChip(el); } }} style={{ position: 'relative', display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -18px', padding: '0 18px' }}>{list.map((d) => chip(d, small))}</div>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {row(all.filter((d) => !d.test), 'demo')}
        {all.some((d) => d.test) ? row(all.filter((d) => d.test), 'tests', true) : null}
        {subs && (
          <div className="h-scroll" ref={(row) => { const sig = q.id + '|' + dim + '|' + axis; if (row && this._axSig !== sig) { this._axSig = sig; window.VOTECUTS && window.VOTECUTS.centerChip(row); } }} style={{ display: 'flex', alignItems: 'center', gap: 4, overflowX: 'auto', margin: '0 -18px', padding: '0 18px 2px' }}>
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
    const c = window.PLACESTATS ? window.PLACESTATS.cat(q.scope, q.catId) : null;
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
            {WF_FRIENDS.map((f) => {
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
    const L = window.LEARN, card = L && L.card(q.learn);
    if (!card) return null;
    const dim = WF_KNOW_CUTS.indexOf(this.state.dims[q.id]) >= 0 ? this.state.dims[q.id] : 'friends';
    const axis = this.state.cutAxis[q.id] || null, youBand = WF_YOU(dim, axis);
    const p = card.p;
    const r = this.knowOf(q);
    const S = window.LEARN_SOCIAL;
    const seen = S ? S.onCard(card) : [];
    const rows = dim === 'friends' ? [] : (() => { const gs = WF_GRP(dim, axis); return gs.map((g, i) => ({ ...g, rate: wfKnowRate(q.id, WF_CUTKEY(dim, axis) + ':' + g.label, p, wfKnowBias(dim, axis, gs.length, i)) })).sort((a, b) => b.rate - a.rate); })();
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {this.renderCutChips(q, dim, WF_KNOW_CUTS)}
        <div style={{ background: 'var(--ink)', color: 'var(--surface)', borderRadius: 12, padding: '12px 14px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, minWidth: 0 }}>{p + '% of people get this right'}</span>
          {r ? <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, background: 'color-mix(in oklch, var(--surface) 22%, transparent)', borderRadius: 999, padding: '3px 10px' }}>{r.ok ? 'You did' : 'You didn\u2019t'}</span> : null}
        </div>
        {dim === 'friends' ? (
          seen.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seen.slice().sort((a, b) => (b.ok ? 1 : 0) - (a.ok ? 1 : 0)).map((f) => (
                <div key={f.id} style={{ background: 'var(--surface)', border: WF_LINE, borderRadius: 12, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ ...lmAv(f.ok ? T.color : 'var(--surface-2)', f.ok ? '#fff' : 'var(--ink-3)', 30), border: f.ok ? 'none' : '1px solid var(--rule)' }}>{f.init}</span>
                  <span style={{ flex: 1, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 13.5 }}>{f.name}</span>
                  <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, color: f.ok ? T.color : 'var(--ink-3)' }}>{f.ok ? 'got it' : 'missed'}</span>
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
    const L = window.LEARN, card = L && L.card(q.learn);
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

  renderStats(q, T) {
    const by = this.liveBy(q);
    if (by) return this.renderLiveStats(q, T, by);
    // A live question whose breakdown is not publishable yet says so,
    // rather than falling through to the demo's invented split.
    if (q.live) {
      return (
        <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.55, padding: '6px 2px', textWrap: 'pretty' }}>
          No group is large enough yet to show how it split without pointing
          at someone. Come back when more people have answered.
        </div>
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
    // friends pick sides deterministically, weighted by the real split
    const pick = (name) => { const r = wfHash(q.id + ':' + name); let acc = 0; for (let i = 0; i < counts.length; i++) { acc += counts[i] / total; if (r < acc) return i; } return counts.length - 1; };
    const friends = WF_FRIENDS.map((f) => ({ ...f, oi: pick(f.name) }));
    const same = mySide == null ? null : friends.filter((f) => f.oi === mySide).length;
    // the world's own split — it becomes the header bar (legend + baseline in one)
    // and every group's seam is read against it
    const op = counts.map((c) => Math.round((c / total) * 100));
    op[op.indexOf(Math.max(...op))] += 100 - op.reduce((a, b) => a + b, 0);
    const nG = WF_GRP(dim, axis).length;
    const many = nG > 6;
    const GRID = { display: 'grid', gridTemplateColumns: '92px 1fr', gap: 10, alignItems: 'center' };
    const barH = many ? 19 : 24, rowGap = many ? 6 : 9;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {this.renderCutChips(q, dim)}
        {dim === 'friends' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ background: 'var(--ink)', color: 'var(--surface)', borderRadius: 12, padding: '12px 14px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14 }}>{same != null ? same + ' of ' + friends.length + ' friends are on your side' : 'How your friends voted'}</div>
            {friends.map((f) => (
              <div key={f.name} style={{ background: 'var(--surface)', border: WF_LINE, borderRadius: 12, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, background: wfShade(T.color, f.oi), color: wfShadeText(f.oi) }}>{f.init}</span>
                <span style={{ flex: 1, fontWeight: 800, fontSize: 13.5 }}>{f.name}</span>
                <span style={{ background: wfShade(T.color, f.oi), color: wfShadeText(f.oi), fontSize: 10.5, fontWeight: 800, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.options[f.oi].label}</span>
              </div>
            ))}
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
            const sum = w.reduce((a, b) => a + b, 0);
            const ps = w.map((x) => Math.round((x / sum) * 100));
            ps[ps.indexOf(Math.max(...ps))] += 100 - ps.reduce((a, b) => a + b, 0);
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
      const s = w.reduce((a, b) => a + b, 0);
      const ps = w.map((x) => Math.round((x / s) * 100));
      ps[ps.indexOf(Math.max(...ps))] += 100 - ps.reduce((a, b) => a + b, 0);
      return ps;
    };
    const items = q.items.map((label, i) => ({ i, label, ps: dist(i) })).sort((a, b) => q.crowd[a.i] - q.crowd[b.i]);
    // friends' first picks, weighted by the crowd's share at position one
    const p1 = items.map((it) => it.ps[0]);
    const tot1 = p1.reduce((a, b) => a + b, 0);
    const firstOf = (name) => { const r = wfHash(q.id + ':first:' + name); let acc = 0; for (let k = 0; k < items.length; k++) { acc += p1[k] / tot1; if (r < acc) return k; } return 0; };
    const top = items[0];
    const nTop = WF_FRIENDS.filter((f) => firstOf(f.name) === 0).length;
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
        <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', marginTop: 4 }}>{nTop} of {WF_FRIENDS.length} friends had {top.label.toLowerCase()} first.</div>
      </div>
    );
  }

  // compact density: answered vote/duel cards collapse to one thin split bar
  renderThinBar(q, T) {
    if (q.type === 'pick') {
      const v = this.state.votes[q.id];
      const ent = v && typeof v === 'object' ? v.entity : v;
      const C = (window.WF_CATALOGS || {})[q.catalog];
      if (C) {
        const it = C.items.find((x) => x.id === ent);
        if (!it) return null;
        return <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 5, background: wfCatArt(T.color, q.catalog + ':' + it.id), flexShrink: 0 }}></span><span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{it.name}</span></div>;
      }
      const name = this.pickName(ent, q.domain);
      const c = window.PICKS ? window.PICKS.canon(q.id) : null;
      const lead = c && c.top.length ? this.pickName(c.top[0].entity, q.domain) : null;
      return <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>you {name || '\u2026'} \u00b7 crowd {lead || '\u2014'}</span>;
    }
    if (q.type === 'know') {
      const r = this.knowOf(q);
      if (!r) return null;
      return <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><LMStreak k={r.streak} of={(window.LEARN || {}).STREAK || 3} col={T.color}></LMStreak><span style={{ fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>{r.ok ? 'right' : 'missed'}</span></div>;
    }
    if (q.type === 'rate') {
      const v = this.state.votes[q.id];
      const c = window.PLACESTATS ? window.PLACESTATS.cat(q.scope, q.catId) : null;
      return <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>you {v}/10 · crowd {c ? c.avg.toFixed(1) : '—'}</span>;
    }
    if (q.type === 'rank') {
      const done = this.state.votes[q.id];
      const m = done.order.filter((it, pos) => q.crowd[it] === pos + 1).length;
      return <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>ranked{' · '}{m}/{q.items.length} with the crowd</span>;
    }
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
    if (this.state.passed[q.id]) {
      return (
        <button key={q.id} onClick={() => this.setPass(q.id, false)} style={{ border: WF_LINE, borderRadius: 14, background: 'transparent', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', WebkitAppearance: 'none', opacity: 0.6 }}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-3)', flexShrink: 0 }}></span>
          <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 13, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.prompt}</span>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>undo</span>
        </button>
      );
    }
    const tm = q.test && window.PASSIVE ? window.PASSIVE.META[q.test] : null;
    // a lens question wears its lens's own name and hue, the same way a test
    // question wears its test's — otherwise it reads as an off-topic card
    const lz = !tm && q.lens && window.LENSES ? window.LENSES.get(q.lens) : null;
    const mk = tm || (lz ? { label: lz.title, accent: `oklch(0.56 0.13 ${lz.hue})` } : null);
    // a knowledge card wears its field, coloured by its subject
    const kn = q.type === 'know' && window.LEARN ? window.LEARN.field(q.f) : null;
    // Favourites is a format channel, so the chip's hue can't also be the card's:
    // three catalogues rendering in one green loses the subject entirely. The
    // channel keeps the label, the catalogue supplies the colour.
    const cg = q.type === 'pick' ? (window.WF_CATALOGS || {})[q.catalog || q.domain] : null;
    const T = kn ? { label: kn.label, color: window.LEARN.colorOf(q.f) } : cg && cg.hue ? { label: (WF_TOPIC[q.cat] || {}).label || q.cat, color: 'oklch(0.55 0.14 ' + cg.hue + ')' } : mk ? { label: mk.label, color: mk.accent } : (WF_TOPIC[q.cat] || { label: q.cat, color: 'var(--ink-3)' });
    const scene = !mk && !kn && q.scene && window.SCENES ? window.SCENES.defs().find((g) => g.id === q.scene) : null;
    const leaf = !mk && !kn && !q.scene && q.sub ? WF_SUB(q.sub) : null;
    const kickLabel = scene ? scene.name : (tm ? tm.label + ' test' : (lz ? lz.title : leaf ? leaf.label : T.label));
    // the quiet marker that this one has a right answer: a ring, not a filled dot
    const kickDot = kn
      ? { width: 7, height: 7, borderRadius: '50%', background: 'transparent', boxShadow: `inset 0 0 0 2px ${T.color}`, flexShrink: 0 }
      : { width: 6, height: 6, borderRadius: '50%', background: T.color, flexShrink: 0 };
    const bgText = WF_BGTEXT(q);
    const compact = this.props.density === 'compact';
    // focus mode: one question, hosted outside the feed (search results)
    const focus = !!this.props.focus;
    const answered = this.answered(q);
    const open = !!this.state.open[q.id];
    const collapsed = compact && !open;
    const kicker = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.01em', textTransform: 'lowercase', color: mk ? `color-mix(in oklch, ${T.color} 70%, var(--ink))` : 'var(--ink-2)', background: mk ? `color-mix(in oklch, ${T.color} 11%, transparent)` : 'transparent', border: '0.5px solid ' + (mk ? `color-mix(in oklch, ${T.color} 40%, var(--rule))` : 'var(--rule)'), borderRadius: 999, padding: '4px 12px 4px 10px', minWidth: 0 }}><span aria-hidden="true" style={kickDot}></span>{kickLabel}</span>
        {bgText ? (
          <button className="press" onClick={(e) => { e.stopPropagation(); clearTimeout(this._sheetT); this.setState({ sheet: { panel: 'bg', q, T } }); }} aria-label="What you need to know" style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', border: '0.5px solid color-mix(in oklch, var(--ink) 26%, var(--rule))', background: 'transparent', color: 'var(--ink-2)', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 800, lineHeight: 1, cursor: 'pointer', WebkitAppearance: 'none', padding: 0 }}>i</button>
        ) : (
          <button className="press" onClick={(e) => { e.stopPropagation(); clearTimeout(this._sheetT); this.setState({ sheet: { panel: 'bg', q, T } }); }} aria-label="About this question" style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', border: '0.5px solid var(--rule)', background: 'transparent', color: 'var(--ink-3)', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 800, lineHeight: 1, cursor: 'pointer', WebkitAppearance: 'none', padding: 0 }}>i</button>
        )}
        {F.closing && this.renderClock(T)}
        <span style={{ flex: 1 }}></span>
        {window.PassiveTag && <window.PassiveTag q={q} answered={answered}></window.PassiveTag>}
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
    if (!collapsed) card.backgroundImage = 'radial-gradient(120% 80% at 50% -25%, color-mix(in oklch, ' + T.color + ' 8%, transparent), transparent 62%)';
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
        <div key={q.id} className={this._io ? 'wf-card' : ''} ref={(el) => { if (el && this._io && !el._wfSeen) { el._wfSeen = 1; this._io.observe(el); } }} role="button" tabIndex={0} onClick={() => this.setState((s) => ({ open: { ...s.open, [q.id]: true } }))} onKeyDown={(e) => { if (e.key === 'Enter') this.setState((s) => ({ open: { ...s.open, [q.id]: true } })); }} style={{ ...card, cursor: 'pointer' }}>
          {kicker}
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 750, fontSize: 14.5, lineHeight: 1.3, letterSpacing: -0.2, textWrap: 'pretty' }}>{q.prompt}</div>
          {answered && this.renderThinBar(q, T)}
        </div>
      );
    }
    return (
      <div key={q.id} className={this._io ? 'wf-card' : ''} ref={(el) => { if (el && this._io && !el._wfSeen) { el._wfSeen = 1; this._io.observe(el); } }} style={card}>
        {kicker}
        {snap && !answered && <div aria-hidden="true" style={{ flex: '0.12 1 0' }}></div>}
        {/* the bare skin has no box to compete with, so the question can carry
            the card on its own — it steps up a size and tightens accordingly */}
        <div style={{ fontFamily: 'var(--sans)', fontWeight: snap || focus ? 800 : 750, fontSize: snap ? (skin === 'bare' ? 30 : 26) : focus ? 20 : 16.5, lineHeight: snap ? 1.1 : focus ? 1.2 : 1.25, letterSpacing: snap ? (skin === 'bare' ? -0.9 : -0.6) : focus ? -0.4 : -0.25, textWrap: 'pretty' }}>{q.prompt}</div>
        {q.type === 'vote' && this.renderVote(q, T, snap)}
        {q.type === 'duel' && this.renderDuel(q, T, snap)}
        {q.type === 'rank' && this.renderRank(q, T, snap)}
        {q.type === 'rate' && this.renderRate(q, T, snap)}
        {q.type === 'know' && this.renderKnow(q, T, snap)}
        {q.type === 'pick' && this.renderPick(q, T, snap)}
        {/* skip: only before answering, and never on a test/lens question —
            those fill an instrument, so a silent skip would read as a gap in
            your own results rather than a question you passed on */}
        {!answered && this.opts.pass && !mk && (
          <button className="press" onClick={() => this.setPass(q.id, true)} style={{ alignSelf: 'center', border: 'none', background: 'none', padding: '6px 16px', marginTop: 2, cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 13, color: 'var(--ink-3)', WebkitAppearance: 'none' }}>skip</button>
        )}
        {answered && this.state.beat !== q.id && q.type !== 'know' && q.type !== 'pick' && this.renderEngage(q, T, snap)}
        {snap && !answered && <div aria-hidden="true" style={{ flex: '1 1 0' }}></div>}
      </div>
    );
  }

  // the feed-side twin of the orbit's suggested ring — one quiet card offering
  // a scene to follow; prefers one that adds a stream you don't have yet
  renderSuggestion(sugg, snap) {
    const SC = window.SCENES;
    const t = WF_TOPIC[SC.topicOf(sugg.id)] || null;
    const col = t ? t.color : 'var(--ink-3)';
    return (
      <div key="scene-sugg" style={{ border: '1.5px dashed color-mix(in oklch, var(--rule), var(--ink) 20%)', borderRadius: 18, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', boxSizing: 'border-box', scrollSnapAlign: snap ? 'start' : undefined }}>
        <span style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box', border: '2px dashed ' + col, background: 'color-mix(in oklch, ' + col + ' 10%, var(--surface-2))' }}></span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15 }}>{sugg.name}</span>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 11.5, color: 'var(--ink-3)' }}>suggested scene · {wfFmt(sugg.members)} people · {sugg.vibe}</span>
        </div>
        <button className="press" onClick={() => SC.follow(sugg.id)} style={{ border: 'none', borderRadius: 999, padding: '8px 15px', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', background: 'var(--ink)', color: 'var(--surface)', flexShrink: 0, WebkitAppearance: 'none' }}>Follow</button>
      </div>
    );
  }

  render() {
    // focus mode — just the given question(s), no chip rail, no weaving.
    // Search hosts this so a result IS the real card: same votes, same reveal.
    if (this.props.focus) {
      return (
        <div ref={(n) => { this._root = n; }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {this.props.focus.filter(Boolean).map((q) => this.renderCard(q, {}))}
          {this.renderSheet()}
        </div>
      );
    }
    const { cats, onToggle } = this.props;
    const SC = window.SCENES;
    const scenes = SC ? SC.mine() : [];
    // topics pulled in by a live (followed + unmuted) scene — but a scene that
    // owns a subtopic pulls only that leaf, so the two never double up
    const ST = window.SUBTOPICS;
    const pulled = {};
    const leafOn = {};
    const owned = {};
    if (SC) scenes.forEach((s) => {
      const lf = SC.subOf ? SC.subOf(s.id) : null;
      if (lf) owned[lf] = true;
      if (cats[s.id] === false) return;
      if (lf) { leafOn[lf] = true; return; }
      const t = SC.topicOf(s.id); if (t) pulled[t] = true;
    });
    if (ST) ST.mine().forEach((s) => { if (cats[s.id] !== false && !owned[s.id]) leafOn[s.id] = true; });
    const qs = (window.WORLD_FEED_QS || []).filter((q) => q.scene
      ? (SC ? SC.has(q.scene) && cats[q.scene] !== false : false)
      : (q.sub && leafOn[q.sub]) || (WF_CHAN_SET[q.cat] ? cats[q.cat] !== false : (SC ? !!pulled[q.cat] : cats[q.cat] !== false)));
    // interleave streams round-robin so the feed reads as a mix, not blocks
    const byKey = {}; const keys = [];
    qs.forEach((q) => { const k = q.scene || q.sub || q.cat; if (!byKey[k]) { byKey[k] = []; keys.push(k); } byKey[k].push(q); });
    const lists = keys.map((k) => byKey[k]);
    const mixed = [];
    for (let i = 0; lists.some((l) => i < l.length); i++) lists.forEach((l) => { if (i < l.length) mixed.push(l[i]); });
    // sort lenses: hot = the interleaved mix · top = most votes · new = latest first
    const sort = this.state.sort;
    const sorted = sort === 'top' ? [...qs].sort((a, b) => wfVotes(b) - wfVotes(a)) : sort === 'new' ? [...qs].reverse() : mixed;
    // weave in the tests' own questions — one marked card every few feed
    // items — and the lenses' questions behind them at half that rate. The
    // core tests own the feed; lenses trickle.
    const tqs = window.TEST_FEED_QS || [];
    const lqs = window.LENS_FEED_QS || [];
    const kEvery = window.LEARN_FEED ? window.LEARN_FEED.every() : 0;
    const kqs = kEvery ? this.knowQs(Math.ceil(sorted.length / kEvery) + 1, cats) : [];
    const feedList = []; let ti = 0, li = 0, ki = 0;
    // Two independent ifs, and 9 rather than 8 — both deliberate. As an
    // `else if` with a lens cadence of 8, every lens slot was also a test
    // slot (8 is a multiple of 4), the test branch won every time, and NOT
    // ONE lens question ever reached the feed. 9 is coprime with 4, so the
    // two cadences drift past each other instead of colliding. The knowledge
    // stream keeps its own independent cadence for the same reason.
    sorted.forEach((q, i) => {
      feedList.push(q);
      if (kEvery && (i + 1) % kEvery === 0 && ki < kqs.length) feedList.push(kqs[ki++]);
      if ((i + 1) % 4 === 0 && ti < tqs.length) feedList.push(tqs[ti++]);
      if ((i + 1) % 9 === 0 && li < lqs.length) feedList.push(lqs[li++]);
    });
    // mute every opinion topic and the knowledge stream should still be there —
    // it's a subscription of its own, not a garnish on the others
    if (sorted.length < kEvery) while (ki < kqs.length) feedList.push(kqs[ki++]);
    // One card near the top wears the closing ring. Chosen by hash of the
    // question id so it is stable across renders rather than jumping as the
    // list re-sorts, and never the very first card — the ring is a grace
    // note, not the thing you meet first.
    const closingId = this.opts.clock
      ? ((feedList.slice(0, 8).find((q) => wfHash(q.id + ':close') < 0.3) || feedList[1] || {}).id)
      : null;
    // chip row = your scenes, your followed leaves, then the always-on channels
    const chips = [
      ...scenes.map((s) => ({ id: s.id, label: s.name, color: window.SCENES && window.SCENES.colorOf ? window.SCENES.colorOf(s.id) : null, scene: true })),
      ...(ST ? ST.mine().filter((s) => !owned[s.id]).map((s) => ({ id: s.id, label: s.label, color: (WF_TOPIC[s.parent] || {}).color || null })) : []),
      ...WF_CHANNELS.map((id) => WF_TOPIC[id]).filter(Boolean).map((t) => ({ id: t.id, label: t.label })),
      ...(window.LEARN ? window.LEARN.mine().map((fd) => ({ id: 'lrn-' + fd.id, label: fd.label, color: window.LEARN.colorOf(fd.id), know: true })) : []),
    ];
    let sugg = null;
    if (SC) {
      const cand = SC.defs().filter((g) => !SC.has(g.id));
      cand.sort((a, b) => ((pulled[SC.topicOf(b.id)] ? 0 : 1) - (pulled[SC.topicOf(a.id)] ? 0 : 1)) || (b.match - a.match));
      sugg = cand[0] || null;
    }
    const snap = this.props.density !== 'compact';
    return (
      <div ref={(n) => { this._root = n; }} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
        {/* the rule sits ABOVE the chip row: it separates the daily card from
            the feed, and the first feed card brings its own hairline (the v2
            bare skin) — a bottom rule here would double it */}
        <div style={{ position: 'sticky', top: 0, zIndex: 6, display: 'flex', flexDirection: 'column', gap: 10, margin: '6px -16px 0', padding: '12px 16px 10px', background: 'var(--surface-a, var(--surface))', borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 15%)', transform: this.state.headHide ? 'translateY(-115%)' : 'none', opacity: this.state.headHide ? 0 : 1, pointerEvents: this.state.headHide ? 'none' : 'auto', transition: 'transform 0.32s ease, opacity 0.26s ease' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div className="h-scroll" style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', flex: 1, minWidth: 0, marginRight: -16, padding: '2px 92px 2px 0', WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 104px), transparent calc(100% - 52px))', maskImage: 'linear-gradient(to right, #000 calc(100% - 104px), transparent calc(100% - 52px))' }}>
            {/* one chip grammar in this rail: same shape, same size, same weight.
                the sort control cycles hot → top → new instead of wearing a caret. */}
            <button key="__sort" className="wf-chip" onClick={() => this.setState({ sort: sort === 'hot' ? 'top' : sort === 'top' ? 'new' : 'hot' })} aria-label={'Sort: ' + sort} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, border: '0.5px solid color-mix(in oklch, var(--ink) 22%, var(--rule))', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', whiteSpace: 'nowrap' }}>{sort === 'top' ? 'top' : sort === 'new' ? 'new' : 'hot'}</button>
            {chips.map((t, ci) => {
              const on = cats[t.id] !== false;
              const col = t.color;
              return (
                <React.Fragment key={t.id}>
                  <button className="wf-chip" onClick={() => onToggle(t.id)} aria-pressed={on} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '0.5px solid ' + (on ? (col ? `color-mix(in oklch, ${col} 40%, var(--rule))` : 'color-mix(in oklch, var(--rule), var(--ink) 22%)') : 'var(--rule)'), background: on ? (col ? `color-mix(in oklch, ${col} 10%, var(--surface-2))` : 'var(--surface-2)') : 'transparent', color: on ? 'var(--ink-2)' : 'var(--ink-3)', fontFamily: 'var(--sans)', fontWeight: on ? 700 : 600, fontSize: 12, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', whiteSpace: 'nowrap', opacity: on ? 1 : 0.72 }}>
                    {col && on && <span aria-hidden="true" style={t.know ? { width: 7, height: 7, borderRadius: '50%', background: 'transparent', boxShadow: `inset 0 0 0 2px ${col}`, flexShrink: 0 } : { width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0 }}></span>}
                    {t.label.toLowerCase()}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
          <span aria-hidden="true" style={{ position: 'absolute', top: -2, bottom: -2, right: -16, width: 40, pointerEvents: 'none', background: 'linear-gradient(to right, transparent, var(--surface-a, var(--surface)) 62%)' }}></span>
          {/* the rail's + adds a chip: follow another topic */}
          <button className="wf-chip press" onClick={() => this.setState({ sheet: { panel: 'add' } })} aria-label="Add a topic" style={{ position: 'absolute', right: -8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, flexShrink: 0, border: '0.5px solid color-mix(in oklch, var(--accent) 45%, var(--rule))', background: 'color-mix(in oklch, var(--accent) 9%, var(--surface-2))', color: 'var(--accent)', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none' }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5 V19 M5 12 H19"></path></svg>
          </button>
          </div>
        </div>
        {feedList.map((q, i) => (
          <React.Fragment key={q.id}>
            {sugg && i === 2 && this.renderSuggestion(sugg, snap)}
            {this.renderCard(q, { closing: q.id === closingId })}
          </React.Fragment>
        ))}
        {sugg && feedList.length <= 2 && this.renderSuggestion(sugg, snap)}
        {feedList.length === 0 && <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', padding: '26px 0' }}>Everything is muted — tap a chip to bring it back.</div>}
        {this.renderSheet()}
      </div>
    );
  }
}

window.WorldFeed = WorldFeed;

;globalThis.wfLoad = typeof wfLoad === 'undefined' ? globalThis.wfLoad : wfLoad;
;globalThis.wfLoadReplies = typeof wfLoadReplies === 'undefined' ? globalThis.wfLoadReplies : wfLoadReplies;
;globalThis.wfLoadTakes = typeof wfLoadTakes === 'undefined' ? globalThis.wfLoadTakes : wfLoadTakes;
;globalThis.wfFmt = typeof wfFmt === 'undefined' ? globalThis.wfFmt : wfFmt;
;globalThis.wfVotes = typeof wfVotes === 'undefined' ? globalThis.wfVotes : wfVotes;
;globalThis.wfPcts = typeof wfPcts === 'undefined' ? globalThis.wfPcts : wfPcts;
;globalThis.wfTileArt = typeof wfTileArt === 'undefined' ? globalThis.wfTileArt : wfTileArt;
;globalThis.WfCount = typeof WfCount === 'undefined' ? globalThis.WfCount : WfCount;
;globalThis.wfHash = typeof wfHash === 'undefined' ? globalThis.wfHash : wfHash;
;globalThis.wfShade = typeof wfShade === 'undefined' ? globalThis.wfShade : wfShade;
;globalThis.wfShadeText = typeof wfShadeText === 'undefined' ? globalThis.wfShadeText : wfShadeText;
;globalThis.WorldFeed = typeof WorldFeed === 'undefined' ? globalThis.WorldFeed : WorldFeed;
;globalThis.WF_LS = typeof WF_LS === 'undefined' ? globalThis.WF_LS : WF_LS;
;globalThis.WF_REPLIES_LS = typeof WF_REPLIES_LS === 'undefined' ? globalThis.WF_REPLIES_LS : WF_REPLIES_LS;
;globalThis.WF_TAKES_LS = typeof WF_TAKES_LS === 'undefined' ? globalThis.WF_TAKES_LS : WF_TAKES_LS;
;globalThis.WF_PASS_LS = typeof WF_PASS_LS === 'undefined' ? globalThis.WF_PASS_LS : WF_PASS_LS;
;globalThis.WF_BRANCH = typeof WF_BRANCH === 'undefined' ? globalThis.WF_BRANCH : WF_BRANCH;
;globalThis.wfLoadMap = typeof wfLoadMap === 'undefined' ? globalThis.wfLoadMap : wfLoadMap;
;globalThis.WF_TOPICS = typeof WF_TOPICS === 'undefined' ? globalThis.WF_TOPICS : WF_TOPICS;
;globalThis.WF_TOPIC = typeof WF_TOPIC === 'undefined' ? globalThis.WF_TOPIC : WF_TOPIC;
;globalThis.WF_CHANNELS = typeof WF_CHANNELS === 'undefined' ? globalThis.WF_CHANNELS : WF_CHANNELS;
;globalThis.WF_CHAN_SET = typeof WF_CHAN_SET === 'undefined' ? globalThis.WF_CHAN_SET : WF_CHAN_SET;
;globalThis.WF_LINE = typeof WF_LINE === 'undefined' ? globalThis.WF_LINE : WF_LINE;
;globalThis.WF_LIVE_DIMS = typeof WF_LIVE_DIMS === 'undefined' ? globalThis.WF_LIVE_DIMS : WF_LIVE_DIMS;
;globalThis.WF_GROUPS = typeof WF_GROUPS === 'undefined' ? globalThis.WF_GROUPS : WF_GROUPS;
;globalThis.WF_FRIENDS = typeof WF_FRIENDS === 'undefined' ? globalThis.WF_FRIENDS : WF_FRIENDS;

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
const WF_GUESS_LS = 'insight.feedGuess.v1';
// where a vote lands on your Mirror — the ripple line shown after answering
const WF_BRANCH = { food: 'Food', sport: 'Body', movies: 'Taste', music: 'Taste', tech: 'Mind', culture: 'Values', dilemma: 'Morals', event: 'Mind', people: 'Values', bigq: 'Values' };
const WF_TOPICS = window.WORLD_TOPICS || [];
const WF_TOPIC = Object.fromEntries(WF_TOPICS.map((t) => [t.id, t]));
const WF_CHANNELS = window.WORLD_CHANNELS || [];
const WF_CHAN_SET = Object.fromEntries(WF_CHANNELS.map((id) => [id, true]));
const WF_LINE = '1px solid color-mix(in oklch, var(--rule), transparent 25%)';

function wfLoad() {
  try { const v = JSON.parse(localStorage.getItem(WF_LS) || '{}'); return v && typeof v === 'object' ? v : {}; }
  catch (e) { return {}; }
}

function wfLoadReplies() {
  try { const v = JSON.parse(localStorage.getItem(WF_REPLIES_LS) || '{}'); return v && typeof v === 'object' ? v : {}; }
  catch (e) { return {}; }
}
// small id->value maps kept in localStorage (passes today; the predict
// stage's guesses when that ships)
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
function wfVotes(q) { return q.type === 'rank' ? (q.votes || 0) : q.options.reduce((a, o) => a + o.count, 0); }
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
  if (v === 1) return 'radial-gradient(circle, ' + a + ' 1.7px, transparent 2.1px) 0 0 / 14px 14px, ' + b;
  if (v === 2) return 'repeating-linear-gradient(135deg, ' + a + ' 0, ' + a + ' 2px, transparent 2px, transparent 11px), linear-gradient(160deg, ' + b + ', color-mix(in oklch, ' + color + ' 19%, var(--surface-2)))';
  return 'radial-gradient(120% 130% at 22% 12%, ' + a + ', transparent 62%), linear-gradient(160deg, ' + b + ', ' + a + ')';
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
function wfShade(color, i) { return 'color-mix(in oklch, ' + color + ' ' + Math.max(70 - i * 22, 12) + '%, var(--surface-3))'; }
// Per-option hue: option 0 keeps the topic colour, the rest rotate away from
// it. The prototype calls this `wfShade`, but THIS file already has a
// `wfShade` that ramps lightness for the live breakdown bars — same name,
// different function. Ported under its other prototype name rather than
// shadowing a helper the k-floored stats renderer depends on.
function wfOpt(color, i, n) { return i === 0 ? color : 'oklch(from ' + color + ' 0.55 0.14 calc(h + ' + Math.round(i * ((n || 2) > 2 ? 120 : 150)) + '))'; }
function wfShadeText(i) { return i < 2 ? '#fff' : 'var(--ink)'; }
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
const WF_DIMS = [['friends', 'Friends'], ['age', 'Age'], ['gender', 'Gender'], ['politics', 'Politics'], ['where', 'Where']];
const WF_GROUPS = { age: ['18–24', '25–34', '35–44', '45+'], gender: ['Women', 'Men', 'Nonbinary'], politics: ['Left', 'Center', 'Right'], where: ['Americas', 'Europe', 'Asia', 'Elsewhere'] };
const WF_FRIENDS = [{ name: 'Alex', init: 'A' }, { name: 'Mia', init: 'M' }, { name: 'Jordi', init: 'J' }, { name: 'Sara', init: 'S' }, { name: 'Noah', init: 'N' }, { name: 'Elif', init: 'E' }];

class WorldFeed extends React.Component {
  state = { votes: wfLoad(), pending: {}, open: {}, panels: {}, dims: {}, boosts: {}, vh: 0, beat: null, sheet: null, sideFilter: null, replyTo: null, replies: wfLoadReplies(), myTakes: wfLoadTakes(), minds: {}, ctrIdx: {}, takeSort: 'mind', whyFor: null, headHide: false, sort: 'hot', guesses: wfLoadMap(WF_GUESS_LS), passed: wfLoadMap(WF_PASS_LS), ripple: null, patternTick: 0 };

  // Feature flags, carried over from the v13 prototype so each idea can be
  // switched off from the host without editing this file. Default ON; the
  // host passes `opts={{ pattern: false }}` to silence one.
  //
  // Only the flags whose feature actually ships live here. The prototype also
  // carries predict/counter/crossfire/signals/why — those need either a rules
  // change or a reversal of D1, so they are absent rather than dead.
  get opts() {
    const o = this.props.opts || {};
    const on = (k) => o[k] !== false;
    return {
      strip: on('strip'), ripple: on('ripple'), pass: on('pass'), pattern: on('pattern'),
      // reveal: the result reads as tiles whose heights are the shares,
      // rather than bars. clock: one card in view carries a ring draining
      // with the day. Both are presentation only — neither shows anything
      // the k-floored aggregate has not already published.
      reveal: on('reveal'), clock: on('clock'),
      // predict: call the winner before you commit to a side — your own
      // guess, held in localStorage, never sent anywhere. why: a one-line
      // reason captured while the vote is warm, which becomes one of YOUR
      // takes. counter: a take can draw a rebuttal from someone who voted
      // the other way. signals: rank takes by minds moved rather than by
      // votes. crossfire: the strongest take from each side, head to head,
      // above the list. v2: the prototype's result layout — one hue per
      // card and a single footer line under the split.
      //
      // counter/signals/crossfire all touch takes, and takes are demo-only:
      // renderEngage returns the k-floored breakdown alone when q.live, so
      // none of that is reachable on a live card (D1).
      predict: on('predict'), why: on('why'), counter: on('counter'),
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
    // the answer strip and the pattern card both read FEEDREAD, which another
    // surface can also write to — subscribe rather than relying on our own
    // setVote being the only writer.
    this._unsubRead = window.FEEDREAD ? window.FEEDREAD.subscribe(() => this.forceUpdate()) : null;
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
    if (this._unsubRead) this._unsubRead();
    if (this._unsubLive) this._unsubLive();
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
      window.FEEDREAD.log(id, { maj: p[val] === Math.max(...p), pred: null });
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

  // ── card bodies ──
  // One question in view is closing — a ring draining with the day. Purely a
  // clock: it reads the wall time and nothing about the question, so it
  // cannot disclose a count.
  // Which questions carry a predict stage. Hash-chosen so it is stable per
  // question rather than jumping between renders, and roughly one card in
  // four — a guess on every card would be a chore, not a game.
  isPredict(q) { return q.predict != null ? !!q.predict : (q.type !== 'rank' && !!q.options && wfHash(q.id + ':pred') < 0.24); }

  setGuess(q, i) {
    this.setState((s) => {
      const guesses = { ...s.guesses, [q.id]: i };
      try { localStorage.setItem(WF_GUESS_LS, JSON.stringify(guesses)); } catch { /* private mode, quota */ }
      return { guesses };
    });
  }

  // Call the winner before you commit to a side. Dashed borders, because
  // this is not the vote — the vote follows once the guess is in.
  renderGuess(q, T, big) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 11 : 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Which side wins?</span>
        {q.options.map((o, i) => (
          <button key={i} className="press" onClick={() => this.setGuess(q, i)} style={{ border: '1.5px dashed color-mix(in oklch, ' + T.color + ' 50%, var(--rule))', borderRadius: big ? 16 : 12, background: 'transparent', boxShadow: 'none', padding: big ? '15px 16px' : '11px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: big ? 16.5 : 14, color: 'var(--ink)', WebkitAppearance: 'none' }}>{o.label}</button>
        ))}
      </div>
    );
  }

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

  openSheet(q, T, panel) {
    this.setState({ sheet: { q, T, panel }, sideFilter: null, replyTo: null });
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
      const guess = this.state.guesses[q.id];
      if (this.opts.predict && this.isPredict(q) && guess == null) return this.renderGuess(q, T, big);
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 11 : 8 }}>
          {guess != null && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>your call: {q.options[guess].label} — now vote</span>}
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
  // the transient Mirror ripple, else your called/missed verdict, else the
  // surprise cut, else the plain scale of the vote. Where renderMeta stacks
  // two facts on one row, this picks the single one worth the line.
  //
  // Reached only from renderEngage's v2 branch, which sits below both the
  // `q.live` and `demoInProd` early returns — so `total` here is always a
  // demo count, never something the k-floor has an opinion about.
  renderFoot(q, T, insight) {
    const quiet = { fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' };
    if (!q.options) return <span style={quiet}></span>;
    const mine = this.state.votes[q.id];
    const { p, total } = wfPcts(q.options.map((o) => o.count), mine);
    const rip = this.state.ripple === q.id ? (WF_BRANCH[q.cat] || 'Interests') : null;
    if (rip) {
      return (
        <button onClick={() => window.goTab && window.goTab('mirror')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--accent, var(--ink-2))', whiteSpace: 'nowrap', animation: 'toastFade 3.2s ease forwards' }}>added to {rip}<span aria-hidden="true">{'→'}</span></button>
      );
    }
    // the predict stage pays off here: you called the winner, or you did not
    const guess = this.state.guesses[q.id];
    if (guess != null) {
      const called = p[guess] === Math.max(...p);
      return <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12.5, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 11px', borderRadius: 999, background: called ? T.color : 'transparent', color: called ? '#fff' : 'var(--ink-3)', border: called ? 'none' : '1px solid var(--rule)' }}>{called ? 'called it' : 'missed'}</span>;
    }
    if (insight) return insight;
    return <span style={quiet}>{wfFmt(total)} votes</span>;
  }

  // One quiet line under the result: how big the vote is, and which side of
  // it you came down on.
  renderMeta(q, T, big, total, p, mine) {
    const maxP = Math.max(...p);
    // Your predict-stage call, settled. Only ever says whether YOUR guess
    // matched the winner the card already displays, so it adds no disclosure
    // of its own — which is why it is safe on a live card too.
    const guess = this.state.guesses[q.id];
    const called = guess == null ? null : p[guess] === maxP;
    const rip = this.state.ripple === q.id ? (WF_BRANCH[q.cat] || 'Interests') : null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 18 }}>
        <span style={{ fontSize: big ? 12.5 : 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>
          {wfFmt(total)} votes{p[mine] === maxP ? ' · with the majority' : ' · you picked the underdog'}
        </span>
        {called != null && !rip && <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 11.5 : 11, letterSpacing: '0.04em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 999, background: called ? T.color : 'transparent', color: called ? '#fff' : 'var(--ink-3)', border: called ? 'none' : '1px solid var(--rule)' }}>{called ? 'called it' : 'missed'}</span>}
        {rip &&<button onClick={() => window.goTab && window.goTab('mirror')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--accent, var(--ink-2))', whiteSpace: 'nowrap', animation: 'toastFade 3.2s ease forwards' }}>added to {rip}<span aria-hidden="true">{'→'}</span></button>}
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
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 10 : 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-3)' }}>Tap in your order</span>
          {q.items.map((it, i) => {
            const pos = cur.indexOf(i);
            return (
              <button key={i} className="press" onClick={() => this.tapRank(q, i)} style={{ border: pos >= 0 ? '1.5px solid ' + T.color : '0.5px solid color-mix(in oklch, ' + T.color + ' 28%, var(--rule))', borderRadius: big ? 14 : 12, background: pos >= 0 ? 'color-mix(in oklch, ' + T.color + ' 7%, var(--surface))' : 'color-mix(in oklch, ' + T.color + ' 4%, var(--surface))', boxShadow: 'none', padding: big ? '12px 13px' : '9px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--sans)', WebkitAppearance: 'none' }}>
                {num(pos >= 0, pos >= 0 ? pos + 1 : '')}
                <span style={{ fontWeight: 700, fontSize: big ? 15 : 13.5, color: 'var(--ink)' }}>{it}</span>
              </button>
            );
          })}
        </div>
      );
    }
    const order = done.order;
    const matches = order.filter((it, pos) => q.crowd[it] === pos + 1).length;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 9 : 7, animation: 'popIn .3s cubic-bezier(0.2,0.8,0.2,1)' }}>
        {order.map((it, pos) => {
          const match = q.crowd[it] === pos + 1;
          return (
            <div key={it} style={{ border: WF_LINE, borderRadius: big ? 13 : 11, background: match ? 'color-mix(in oklch, ' + T.color + ' 6%, var(--surface))' : 'var(--surface)', padding: big ? '11px 13px' : '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: D, height: D, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 13 : 12, background: T.color, color: '#fff' }}>{pos + 1}</span>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: big ? 15 : 13.5 }}>{q.items[it]}</span>
              <span title={'Crowd ranked this #' + q.crowd[it]} style={{ width: D, height: D, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 12.5 : 11.5, boxSizing: 'border-box', color: match ? '#fff' : 'var(--ink-2)', background: match ? T.color : 'transparent', border: match ? 'none' : '1.5px solid color-mix(in oklch, ' + T.color + ' 55%, transparent)' }}>{q.crowd[it]}</span>
            </div>
          );
        })}
        <span style={{ fontSize: big ? 12.5 : 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>You matched the crowd on {matches} of {q.items.length}</span>
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
    const hasStats = q.type !== 'rank';
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
    const takeFaces = takes.slice(0, 3).map((c, i) => av(c.opt != null ? wfShade(T.color, c.opt) : 'var(--ink-3)', c.opt != null ? wfShadeText(c.opt) : '#fff', c.init[0], i));
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
  renderInsight(q, T, big) {
    if (!window.feedInsight) return null;
    const ins = window.feedInsight(q);
    if (!ins) return null;
    const n = q.options.length;
    const col = wfOpt(T.color, ins.sideIdx, n);
    const text = ins.group
      + (ins.kind === 'flip' ? ' flips to ' : ' leans toward ')
      + q.options[ins.sideIdx].label;
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
      this.setState({ sheet: { ...s, closing: true }, replyTo: null });
      clearTimeout(this._sheetT);
      this._sheetT = setTimeout(() => this.setState({ sheet: null }), 230);
    };
    return ReactDOM.createPortal(
      <div className={'wf-scrim' + (s.closing ? ' is-closing' : '')} onClick={close}>
        <div className="wf-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="wf-sheet-grab"></div>
          <div style={{ padding: '10px 18px 8px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15 }}>{panel === 'add' ? 'Add a topic' : panel === 'takes' ? 'Takes' : 'Who voted'}</span>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12, color: 'var(--ink-3)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q ? (q.prompt || q.text || q.title) : ''}</span>
            <button onClick={close} aria-label="Close" style={{ border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', flexShrink: 0, WebkitAppearance: 'none' }}>{'\u2715'}</button>
          </div>
          <div className="wf-sheet-body">
            {panel === 'add' ? this.renderAdd() : panel === 'takes' ? this.renderTakes(q, T, takes) : this.renderStats(q, T)}
          </div>
        </div>
      </div>, host);
  }

  // The topics you do not follow yet, offered from the rail's "+". Scenes are
  // a local, client-side subscription (window.SCENES) — following one changes
  // which questions the feed mixes in and nothing that leaves the device.
  renderAdd() {
    const SC = window.SCENES;
    if (!SC) return null;
    const open = SC.defs().filter((g) => !SC.has(g.id)).sort((a, b) => b.match - a.match);
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {open.map((g) => {
          const col = SC.colorOf ? SC.colorOf(g.id) : null;
          return (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 2px', borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)' }}>
              {col && <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: col, flexShrink: 0 }}></span>}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14.5 }}>{g.name}</span>
                <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 11.5, color: 'var(--ink-3)' }}>{wfFmt(g.members)} people · {g.vibe}</span>
              </div>
              <button className="press" onClick={() => { SC.follow(g.id); this.forceUpdate(); }} style={{ flexShrink: 0, border: 'none', borderRadius: 999, padding: '7px 14px', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, cursor: 'pointer', background: 'var(--ink)', color: 'var(--surface)', WebkitAppearance: 'none' }}>Follow</button>
            </div>
          );
        })}
        {open.length === 0 && (
          <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)', textAlign: 'center', padding: '28px 0' }}>You follow every topic.</div>
        )}
        {/* the one in-reach way to propose a question, now that the rail's + adds topics */}
        <button className="press" onClick={() => { this.setState({ sheet: null }); if (window.openSuggestions) window.openSuggestions(); }} style={{ marginTop: 14, padding: '11px 0', border: '0.5px solid var(--rule)', background: 'var(--surface-2)', borderRadius: 14, cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--ink-2)', WebkitAppearance: 'none' }}>Suggest a question</button>
      </div>
    );
  }

  // One take, with the argument against it folded underneath.
  //
  // DEMO CARDS ONLY, like everything else in this sheet: renderEngage returns
  // the k-floored breakdown alone when q.live, so a take — free text attached
  // to a named person — is structurally unreachable at world scale (D1). The
  // counters come from world-feed-counters.js, which is invented data sitting
  // beside the invented takes in world-feed-comments.js.
  takeCard(q, T, item) {
    const o = this.opts;
    const { c, key, sig } = item;
    const myVote = this.state.votes[q.id];
    const mySide = typeof myVote === 'number' && q.options ? myVote : null;
    const col = c.opt != null ? wfShade(T.color, c.opt) : 'var(--ink-3)';
    const ctxt = c.opt != null ? wfShadeText(c.opt) : '#fff';
    const mine = this.state.replies[key] || [];
    const seeded = o.counter && window.WF_COUNTERS ? window.WF_COUNTERS(key) : [];
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
      </div>
    );
    const meta = (name, opt, time) => (
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        {opt != null && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: wfShade(T.color, opt), flexShrink: 0, alignSelf: 'center' }}></span>}
        <span style={{ fontWeight: 800, fontSize: 12.5 }}>{name}</span>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>{time}</span>
      </div>
    );
    return (
      <div key={key} style={{ border: WF_LINE, borderRadius: 12, background: 'var(--surface)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11.5, background: col, color: ctxt }}>{c.init}</span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {meta(c.name, null, c.time)}
            <div style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 500 }}>{c.text}</div>
          </div>
        </div>
        {reactions(key, c.ups, sig.mind, 40)}
        {cur && (
          <div style={{ marginLeft: 40, paddingLeft: 10, borderLeft: '2px solid ' + (cur.opt != null ? wfShade(T.color, cur.opt) : 'var(--surface-3)'), display: 'flex', flexDirection: 'column', gap: 4 }}>
            {meta(cur.own ? 'You' : cur.name, cur.opt, cur.time)}
            <div style={{ fontSize: 12.5, lineHeight: 1.45, fontWeight: 500 }}>{cur.text}</div>
            {!cur.own && reactions(cur.ckey, cur.ups, cur.sig.mind, 0)}
            {/* several rebuttals stack behind one slot rather than turning the
                take into a thread — one argument at a time, strongest first */}
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
            <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11.5, background: mySide != null ? wfShade(T.color, mySide) : 'var(--ink)', color: mySide != null ? wfShadeText(mySide) : '#fff' }}>Y</span>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 800, fontSize: 12.5 }}>You</span>
                {mySide != null && <span style={{ background: wfShade(T.color, mySide), color: wfShadeText(mySide), fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{q.options[mySide].label}</span>}
                <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>now</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 500 }}>{t}</div>
              {o.signals && <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11, color: 'var(--ink-3)' }}>{'↺ ' + (window.WF_TAKE_SIG ? window.WF_TAKE_SIG(q.id + ':own' + i, 60).mind : 0) + ' moved'}</span>}
            </div>
          </div>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); const inp = e.target.elements.take; const v = inp.value.trim(); if (v) { this.addTake(q.id, v); inp.value = ''; } }} style={{ display: 'flex', gap: 6, paddingTop: 2 }}>
          <input name="take" placeholder={mySide == null && q.options ? 'Vote first to add a take…' : 'Add your take…'} disabled={mySide == null && !!q.options} style={{ flex: 1, minWidth: 0, border: WF_LINE, borderRadius: 999, padding: '8px 13px', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500, background: 'var(--surface)', color: 'var(--ink)', outline: 'none' }} />
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
    const dim = this.state.dims[q.id] || 'friends';
    const counts = q.options.map((o) => o.count);
    const total = counts.reduce((a, b) => a + b, 0);
    const myVote = this.state.votes[q.id];
    const mySide = typeof myVote === 'number' ? myVote : null;
    // friends pick sides deterministically, weighted by the real split
    const pick = (name) => { const r = wfHash(q.id + ':' + name); let acc = 0; for (let i = 0; i < counts.length; i++) { acc += counts[i] / total; if (r < acc) return i; } return counts.length - 1; };
    const friends = WF_FRIENDS.map((f) => ({ ...f, oi: pick(f.name) }));
    const same = mySide == null ? null : friends.filter((f) => f.oi === mySide).length;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {WF_DIMS.map(([id, label]) => (
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {WF_GROUPS[dim].map((g, gi) => {
            const key = q.id + ':' + dim + ':' + gi;
            const w = counts.map((c, oi) => (c / total) * (0.55 + wfHash(key + ':' + oi)));
            const sum = w.reduce((a, b) => a + b, 0);
            const ps = w.map((x) => Math.round((x / sum) * 100));
            ps[ps.indexOf(Math.max(...ps))] += 100 - ps.reduce((a, b) => a + b, 0);
            const n = Math.round(300 + wfHash(key + ':n') * 3700);
            return (
              <div key={gi} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, fontSize: 12 }}>{g}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>{wfFmt(n)} votes</span>
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
        )}
      </div>
    );
  }

  // compact density: answered vote/duel cards collapse to one thin split bar
  renderThinBar(q, T) {
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

  // ── the answer strip ── your last nine answers, filled = with the crowd.
  // Wears the chip rail's own shape on purpose: loose dots sitting at the
  // rail's edge read as a glyph that failed to load.
  renderStrip() {
    if (!this.opts.strip || !window.FEEDREAD) return null;
    const st = window.FEEDREAD.stats();
    if (st.n < 3) return null; // one or two rings read as a broken glyph, not a history
    return (
      <span className="wf-chip" title="Your last answers — filled = with the crowd" aria-label={'Your last ' + st.recent.length + ' answers, ' + st.withMaj + ' with the crowd'} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '0.5px solid var(--rule)', background: 'var(--surface-2)', borderRadius: 999, padding: '6px 11px', flexShrink: 0 }}>
        {st.recent.map((r, i) => <span key={i} aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', boxSizing: 'border-box', background: r.maj ? 'var(--ink-2)' : 'transparent', border: '1.2px solid var(--ink-2)', opacity: 0.7 }}></span>)}
      </span>
    );
  }

  // ── the pattern beat ── every so often the feed says what it has noticed.
  // Confirm or shrug; either way it retires, so this can never nag.
  //
  // Every line is derived from your own answers only (feed-read.js). Nothing
  // here describes another user, so there is no floor to apply.
  patternCard() {
    if (!this.opts.pattern || !window.FEEDREAD) return null;
    const st = window.FEEDREAD.stats();
    if (st.n < 4) return null;
    let key = null, line = null;
    if (st.streak >= 3) { key = 'contra' + st.streak; line = st.streak + ' in a row against the crowd.'; }
    else if (st.majStreak >= 4) { key = 'with' + st.majStreak; line = 'You’ve matched the crowd ' + st.majStreak + ' times running.'; }
    else if (st.n >= 6) { key = 'rate' + Math.round(st.rate * 5); line = st.rate >= 0.6 ? 'You sit with the majority most days.' : 'You’re the odd one out more often than not.'; }
    if (!key || window.FEEDREAD.dismissed(key)) return null;
    const btn = (label, solid) => (
      <button key={label} className="press" onClick={() => { window.FEEDREAD.dismiss(key); this.setState((s) => ({ patternTick: s.patternTick + 1 })); }} style={{ border: solid ? 'none' : '1px solid color-mix(in oklch, var(--surface) 45%, transparent)', borderRadius: 999, padding: '9px 16px', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 13, background: solid ? 'var(--surface)' : 'transparent', color: solid ? 'var(--ink)' : 'var(--surface)', WebkitAppearance: 'none' }}>{label}</button>
    );
    return (
      <div key="pattern" style={{ background: 'var(--ink)', color: 'var(--surface)', borderRadius: 18, padding: '18px 18px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 22, lineHeight: 1.14, letterSpacing: -0.5, textWrap: 'pretty' }}>{line}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {st.recent.map((r, i) => <span key={i} aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', boxSizing: 'border-box', background: r.maj ? 'var(--surface)' : 'transparent', border: '1.5px solid var(--surface)' }}></span>)}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>{btn('That’s me', true)}{btn('Coincidence', false)}</div>
      </div>
    );
  }

  renderCard(q, flags) {
    const F = flags || {};
    // a passed card collapses to one undoable line — skipping should cost the
    // feed height, not erase the question
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
    const T = mk ? { label: mk.label, color: mk.accent } : (WF_TOPIC[q.cat] || { label: q.cat, color: 'var(--ink-3)' });
    const scene = !mk && q.scene && window.SCENES ? window.SCENES.defs().find((g) => g.id === q.scene) : null;
    const kickLabel = scene ? scene.name : (tm ? tm.label + ' test' : (lz ? lz.title : T.label));
    const compact = this.props.density === 'compact';
    const answered = this.answered(q);
    const open = !!this.state.open[q.id];
    const collapsed = compact && !open;
    const kicker = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.01em', textTransform: 'lowercase', color: mk ? `color-mix(in oklch, ${T.color} 70%, var(--ink))` : 'var(--ink-2)', background: mk ? `color-mix(in oklch, ${T.color} 11%, transparent)` : 'transparent', border: '0.5px solid ' + (mk ? `color-mix(in oklch, ${T.color} 40%, var(--rule))` : 'var(--rule)'), borderRadius: 999, padding: '4px 12px 4px 10px', minWidth: 0 }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: T.color, flexShrink: 0 }}></span>{kickLabel}</span>
        {F.closing && this.renderClock(T)}
        <span style={{ flex: 1 }}></span>
        {window.PassiveTag && <window.PassiveTag q={q} answered={answered}></window.PassiveTag>}
      </div>
    );
    const snap = !compact;
    // Three densities give the scroll a pulse instead of one uniform stack:
    // duels go full-bleed, text questions sit typographic on the ground, and
    // only a collapsed card keeps the box. Under v2 every open card is bare —
    // a hairline gives the stream its structure where borders and shadows
    // used to, and the topic hue stays in the kicker.
    const skin = collapsed ? 'card' : q.type === 'duel' ? 'bleed' : (this.opts.v2 || q.type === 'vote') ? 'bare' : 'card';
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
        <div style={{ fontFamily: 'var(--sans)', fontWeight: snap ? 800 : 750, fontSize: snap ? (skin === 'bare' ? 30 : 26) : 16.5, lineHeight: snap ? 1.1 : 1.25, letterSpacing: snap ? (skin === 'bare' ? -0.9 : -0.6) : -0.25, textWrap: 'pretty' }}>{q.prompt}</div>
        {q.type === 'vote' && this.renderVote(q, T, snap)}
        {q.type === 'duel' && this.renderDuel(q, T, snap)}
        {q.type === 'rank' && this.renderRank(q, T, snap)}
        {/* where this vote landed on your Mirror — transient, and only on the
            ~45% of cards setVote marked, so it stays a remark not a label */}
        {answered && this.state.ripple === q.id && (
          <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12.5, color: 'var(--ink-3)', textWrap: 'pretty' }}>
            ↳ landed on your Mirror — {WF_BRANCH[q.cat] || 'Interests'}
          </div>
        )}
        {answered && this.state.beat !== q.id && this.renderEngage(q, T, snap)}
        {/* skip: only before answering, and never on a test/lens question —
            those fill an instrument, so a silent skip would read as a gap in
            your own results rather than a question you passed on */}
        {!answered && this.opts.pass && !mk && (
          <button className="press" onClick={() => this.setPass(q.id, true)} style={{ alignSelf: 'center', border: 'none', background: 'none', padding: '6px 16px', marginTop: 2, cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 13, color: 'var(--ink-3)', WebkitAppearance: 'none' }}>skip</button>
        )}
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
    const { cats, onToggle } = this.props;
    const SC = window.SCENES;
    const scenes = SC ? SC.mine() : [];
    // topics pulled in by a live (followed + unmuted) scene
    const pulled = {};
    if (SC) scenes.forEach((s) => { const t = SC.topicOf(s.id); if (t && cats[s.id] !== false) pulled[t] = true; });
    const qs = (window.WORLD_FEED_QS || []).filter((q) => q.scene
      ? (SC ? SC.has(q.scene) && cats[q.scene] !== false : false)
      : (WF_CHAN_SET[q.cat] ? cats[q.cat] !== false : (SC ? !!pulled[q.cat] : cats[q.cat] !== false)));
    // interleave streams round-robin so the feed reads as a mix, not blocks
    const byKey = {}; const keys = [];
    qs.forEach((q) => { const k = q.scene || q.cat; if (!byKey[k]) { byKey[k] = []; keys.push(k); } byKey[k].push(q); });
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
    const feedList = []; let ti = 0, li = 0;
    // Two independent ifs, and 9 rather than 8 — both deliberate. As an
    // `else if` with a lens cadence of 8, every lens slot was also a test
    // slot (8 is a multiple of 4), the test branch won every time, and NOT
    // ONE lens question ever reached the feed. 9 is coprime with 4, so the
    // two cadences drift past each other instead of colliding.
    sorted.forEach((q, i) => {
      feedList.push(q);
      if ((i + 1) % 4 === 0 && ti < tqs.length) feedList.push(tqs[ti++]);
      if ((i + 1) % 9 === 0 && li < lqs.length) feedList.push(lqs[li++]);
    });
    const nDone = qs.filter((q) => this.answered(q)).length;
    // One card near the top wears the closing ring. Chosen by hash of the
    // question id so it is stable across renders rather than jumping as the
    // list re-sorts, and never the very first card — the ring is a grace
    // note, not the thing you meet first.
    const closingId = this.opts.clock
      ? ((feedList.slice(0, 8).find((q) => wfHash(q.id + ':close') < 0.3) || feedList[1] || {}).id)
      : null;
    // chip row = your scenes, then the always-on channels
    const chips = [
      ...scenes.map((s) => ({ id: s.id, label: s.name, color: window.SCENES && window.SCENES.colorOf ? window.SCENES.colorOf(s.id) : null, scene: true })),
      ...WF_CHANNELS.map((id) => WF_TOPIC[id]).filter(Boolean).map((t) => ({ id: t.id, label: t.label })),
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
          <div className="h-scroll" style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', flex: 1, minWidth: 0, marginRight: -16, padding: '2px 82px 2px 0' }}>
            {/* PassiveMeter used to lead this row; it lives in the app header
                now (app-shell.jsx) so the chip row starts on the sort control */}
            {this.renderStrip()}
            {/* no chevron: it reads as a dropdown, and this cycles rather
                than opening anything. The label alone is the affordance. */}
            <button key="__sort" className="wf-chip" onClick={() => this.setState({ sort: sort === 'hot' ? 'top' : sort === 'top' ? 'new' : 'hot' })} aria-label={'Sort: ' + sort} style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, border: '0.5px solid color-mix(in oklch, var(--ink) 22%, var(--rule))', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', whiteSpace: 'nowrap' }}>{sort === 'top' ? 'top' : sort === 'new' ? 'new' : 'hot'}</button>
            {chips.map((t, ci) => {
              const on = cats[t.id] !== false;
              const col = t.color;
              return (
                <React.Fragment key={t.id}>
                  {!t.scene && ci > 0 && chips[ci - 1].scene && <span aria-hidden="true" style={{ alignSelf: 'center', width: 1, height: 15, background: 'var(--rule)', flexShrink: 0 }}></span>}
                  <button className="wf-chip" onClick={() => onToggle(t.id)} aria-pressed={on} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '0.5px solid ' + (on ? (col ? `color-mix(in oklch, ${col} 40%, var(--rule))` : 'color-mix(in oklch, var(--rule), var(--ink) 22%)') : 'var(--rule)'), background: on ? (col ? `color-mix(in oklch, ${col} 10%, var(--surface-2))` : 'var(--surface-2)') : 'transparent', color: on ? 'var(--ink-2)' : 'var(--ink-3)', fontFamily: 'var(--sans)', fontWeight: on ? 700 : 600, fontSize: 12, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', whiteSpace: 'nowrap', opacity: on ? 1 : 0.72 }}>
                    {col && on && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0 }}></span>}
                    {t.label.toLowerCase()}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
          <span aria-hidden="true" style={{ position: 'absolute', top: -2, bottom: -2, right: -16, width: 74, pointerEvents: 'none', background: 'linear-gradient(to right, transparent, var(--surface-a, var(--surface)) 55%)' }}></span>
          {/* always-in-reach suggest — no scrolling to the feed's end to propose a question */}
          <button className="wf-chip press" onClick={() => this.setState({ sheet: { panel: 'add' } })} aria-label="Add a topic" style={{ position: 'absolute', right: -8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, flexShrink: 0, border: '0.5px solid color-mix(in oklch, var(--accent) 45%, var(--rule))', background: 'color-mix(in oklch, var(--accent) 9%, var(--surface-2))', color: 'var(--accent)', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none' }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5 V19 M5 12 H19"></path></svg>
          </button>
          </div>
        </div>
        {feedList.map((q, i) => (
          <React.Fragment key={q.id}>
            {sugg && i === 2 && this.renderSuggestion(sugg, snap)}
            {/* the pattern beat rides at position 5 — far enough in that you
                have scrolled past a few answers, not so far it is never seen */}
            {i === 5 && this.patternCard()}
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
;globalThis.WF_DIMS = typeof WF_DIMS === 'undefined' ? globalThis.WF_DIMS : WF_DIMS;
;globalThis.WF_LIVE_DIMS = typeof WF_LIVE_DIMS === 'undefined' ? globalThis.WF_LIVE_DIMS : WF_LIVE_DIMS;
;globalThis.WF_GROUPS = typeof WF_GROUPS === 'undefined' ? globalThis.WF_GROUPS : WF_GROUPS;
;globalThis.WF_FRIENDS = typeof WF_FRIENDS === 'undefined' ? globalThis.WF_FRIENDS : WF_FRIENDS;

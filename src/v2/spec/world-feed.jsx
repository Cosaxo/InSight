// ported from design/spec-modules/world-feed.jsx — do not hand-edit load order assumptions
import React from 'react';

// world-feed.jsx — the question feed under the World daily. Answer today's
// question and the feed starts: dilemmas, this-or-thats, rankings and image
// duels from the scenes you follow (SCENES — the same list the Mirror orbit
// manages) plus the always-on channels. Chips = your scenes as filter.
// One hue per topic; results encode as bar length, not numbers-everywhere.

const WF_LS = 'insight.feedVotes.v1';
const WF_REPLIES_LS = 'insight.feedReplies.v1';
const WF_TAKES_LS = 'insight.feedTakes.v1';
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
  }, [to, animate]);
  return <span>{v}</span>;
}

// ── who-voted breakdowns ── one topic hue; option = shade strength, so sides
// stay readable without a second palette. Splits derive deterministically from
// the overall counts + a hash, like the daily's.
function wfHash(s) { let h = 9; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489); return ((h ^ (h >>> 9)) >>> 0) / 4294967295; }
function wfShade(color, i) { return 'color-mix(in oklch, ' + color + ' ' + Math.max(70 - i * 22, 12) + '%, var(--surface-3))'; }
function wfShadeText(i) { return i < 2 ? '#fff' : 'var(--ink)'; }
const WF_DIMS = [['friends', 'Friends'], ['age', 'Age'], ['gender', 'Gender'], ['politics', 'Politics'], ['where', 'Where']];
const WF_GROUPS = { age: ['18–24', '25–34', '35–44', '45+'], gender: ['Women', 'Men', 'Nonbinary'], politics: ['Left', 'Center', 'Right'], where: ['Americas', 'Europe', 'Asia', 'Elsewhere'] };
const WF_FRIENDS = [{ name: 'Alex', init: 'A' }, { name: 'Mia', init: 'M' }, { name: 'Jordi', init: 'J' }, { name: 'Sara', init: 'S' }, { name: 'Noah', init: 'N' }, { name: 'Elif', init: 'E' }];

class WorldFeed extends React.Component {
  state = { votes: wfLoad(), pending: {}, open: {}, panels: {}, dims: {}, boosts: {}, vh: 0, beat: null, sheet: null, sideFilter: null, replyTo: null, replies: wfLoadReplies(), myTakes: wfLoadTakes(), headHide: false, sort: 'hot' };

  // ── snap scrolling: cards arrive one at a time and snap into place ──
  // The tab's scroller gets y-proximity snap while the feed is mounted; each
  // card fills most of the viewport (next one peeking) and snap-aligns to top.
  componentDidMount() {
    this.applySnap(); this._retry = setTimeout(() => this.applySnap(), 400);
    // scenes followed elsewhere (orbit, suggestion card) appear here live
    this._unsubScenes = window.SCENES ? window.SCENES.subscribe(() => this.forceUpdate()) : null;
    // entrance: each card rises as it first scrolls into view (transform-only)
    this._io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('wf-in'); this._io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' }) : null;
  }
  componentDidUpdate() { this.applySnap(); }
  componentWillUnmount() {
    clearTimeout(this._retry);
    clearTimeout(this._sheetT);
    if (this._unsubScenes) this._unsubScenes();
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

  setVote(q, val) {
    const id = q.id;
    // live cards persist to Firestore too (owner-only answer + aggregate)
    if (q.live && window.LIVE && typeof val === 'number') window.LIVE.vote(id, String(val));
    if (window.PASSIVE) window.PASSIVE.record(q); // no-op unless this is a test's own question (q.test)
    this._fresh = id; // gates the reveal's count-up + bar growth to the vote moment
    this.setState((s) => {
      const votes = { ...s.votes, [id]: val };
      try { localStorage.setItem(WF_LS, JSON.stringify(votes)); } catch { /* best-effort */ }
      const beat = (this.props.beats !== false && window.ConsequenceBeat) ? id : s.beat;
      return { votes, beat };
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
  renderFloorNote(big) {
    return (
      <div style={{ fontSize: big ? 12.5 : 11.5, fontWeight: 600, color: 'var(--ink-3)', padding: '2px 2px 0' }}>
        You\u2019re early \u2014 counts appear once 5 people have answered.
      </div>
    );
  }

  renderVote(q, T, big) {
    const mine = this.state.votes[q.id];
    if (mine != null && this.state.beat === q.id) return this.renderBeat(q, T, big);
    const counts = q.options.map((o) => o.count);
    if (mine == null) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: big ? 11 : 8 }}>
          {q.options.map((o, i) => (
            <button key={i} className="press" onClick={() => this.setVote(q, i)} style={{ border: '1px solid color-mix(in oklch, ' + T.color + ' 45%, var(--rule))', borderRadius: big ? 16 : 12, background: 'color-mix(in oklch, ' + T.color + ' 10%, var(--surface))', boxShadow: 'none', padding: big ? '15px 16px' : '11px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: big ? 16.5 : 14, color: 'var(--ink)', WebkitAppearance: 'none' }}>{o.label}</button>
          ))}
        </div>
      );
    }
    const { p, total } = wfPcts(counts, mine);
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
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {q.options.map((o, i) => {
            const chosen = mine === i;
            return (
              <button key={i} className={mine == null ? 'press' : ''} onClick={() => mine == null && this.setVote(q, i)} style={{ position: 'relative', aspectRatio: big ? '3 / 4' : '4 / 3', border: chosen ? '2px solid ' + T.color : WF_LINE, borderRadius: 14, overflow: 'hidden', background: (chosen ? 'linear-gradient(color-mix(in oklch, ' + T.color + ' 20%, transparent), color-mix(in oklch, ' + T.color + ' 20%, transparent)), ' : '') + wfTileArt(T.color, q.id), boxShadow: chosen ? '0 0 0 3px color-mix(in oklch, ' + T.color + ' 22%, transparent), var(--shadow-lift)' : 'none', cursor: mine == null ? 'pointer' : 'default', padding: 0, WebkitAppearance: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: mine != null && !chosen ? 0.55 : 1, filter: mine != null && !chosen ? 'saturate(0.4)' : 'none', transition: 'opacity .45s ease, filter .45s ease, box-shadow .3s ease', animation: fresh && chosen ? 'tilePick .45s cubic-bezier(0.2,0.8,0.2,1)' : 'none' }}>
                <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 16 : 14.5, color: 'var(--ink)', padding: '5px 12px', maxWidth: '85%', textAlign: 'center', lineHeight: 1.2, borderRadius: 11, background: 'color-mix(in oklch, var(--surface-2) 82%, transparent)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>{o.label}</span>
                {mine != null && !(q.live && q.tooSmall) && (
                  <span style={{ position: 'absolute', bottom: big ? 10 : 8, left: big ? 10 : 8, padding: big ? '4px 12px' : '3px 10px', borderRadius: 999, fontFamily: 'var(--sans)', fontWeight: 800, fontSize: big ? 15 : 13, background: chosen ? T.color : 'var(--surface-2)', color: chosen ? '#fff' : 'var(--ink)', border: chosen ? 'none' : WF_LINE, boxShadow: 'var(--shadow-card)', animation: fresh ? 'chipPop .38s cubic-bezier(0.2,0.8,0.2,1) ' + (0.1 + i * 0.12) + 's both' : 'none' }}><WfCount to={p[i]} animate={fresh}></WfCount>%</span>
                )}
                {chosen && (
                  <span style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: T.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-card)', animation: fresh ? 'chipPop .4s cubic-bezier(0.2,0.8,0.2,1) .06s both' : 'none' }}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 12.5 10 18 19.5 6.5"></path></svg>
                  </span>
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
          <span style={{ fontSize: big ? 12.5 : 11.5, fontWeight: 600, color: 'var(--ink-3)' }}>Tap in your order</span>
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
    // D1: live world-scope cards carry no takes and no who-voted —
    // comments are circle-scoped, and the demo's breakdown splits are
    // synthetic. The row exists only for demo content — and never for
    // a real user a live build dropped into the mock fallback, where
    // unlabeled fake named people would break the honesty posture.
    if (q.live || (window.LIVE && window.LIVE.demoInProd)) return null;
    const takes = (window.WORLD_FEED_COMMENTS || {})[q.id] || [];
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
    const nTakes = takes.length + nReplies + nOwn;
    const takeFaces = takes.slice(0, 3).map((c, i) => av(c.opt != null ? wfShade(T.color, c.opt) : 'var(--ink-3)', c.opt != null ? wfShadeText(c.opt) : '#fff', c.init[0], i));
    const nMore = nTakes - takeFaces.length;
    if (nMore > 0) takeFaces.push(av('var(--surface-2)', 'var(--ink-2)', nMore > 9 ? '9+' : '+' + nMore, takeFaces.length));
    return (
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        {btn('takes', takeFaces, ico('M6.5 4.5h11a2 2 0 0 1 2 2V13a2 2 0 0 1-2 2H11l-4 3.8V15h-.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z'), nTakes + ' takes')}
        {hasStats && btn('stats', null, ico('M5 19.5V13M12 19.5V5.5M19 19.5V10'), 'who voted')}
      </div>
    );
  }

  // ── the bottom sheet — portaled to the app screen so it clears the tabbar ──
  renderSheet() {
    const s = this.state.sheet;
    if (!s) return null;
    const host = document.querySelector('.app');
    if (!host) return null;
    const { q, T, panel } = s;
    const takes = (window.WORLD_FEED_COMMENTS || {})[q.id] || [];
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
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15 }}>{panel === 'takes' ? 'Takes' : 'Who voted'}</span>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 12, color: 'var(--ink-3)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.prompt || q.text || q.title}</span>
            <button onClick={close} aria-label="Close" style={{ border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: 'var(--ink-2)', flexShrink: 0, WebkitAppearance: 'none' }}>{'\u2715'}</button>
          </div>
          <div className="wf-sheet-body">
            {panel === 'takes' ? this.renderTakes(q, T, takes) : this.renderStats(q, T)}
          </div>
        </div>
      </div>, host);
  }

  renderTakes(q, T, takes) {
    const hasSides = !!q.options && takes.some((c) => c.opt != null);
    const filter = this.state.sideFilter;
    const myVote = this.state.votes[q.id];
    const mySide = typeof myVote === 'number' && q.options ? myVote : null;
    const shown = takes.map((c, i) => [c, i]).filter(([c]) => filter == null || c.opt === filter);
    const ownAll = this.state.myTakes[q.id] || [];
    const ownShown = ownAll.filter(() => filter == null || filter === mySide);
    const chip = (val, label, col, txt) => (
      <button key={String(val)} onClick={() => this.setState({ sideFilter: val })} style={{ border: WF_LINE, borderRadius: 999, padding: '5px 12px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, cursor: 'pointer', background: filter === val ? (col || 'var(--ink)') : 'var(--surface)', color: filter === val ? (txt || 'var(--surface)') : 'var(--ink)', WebkitAppearance: 'none', whiteSpace: 'nowrap', maxWidth: val == null ? 'none' : 130, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</button>
    );
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {hasSides && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 4 }}>
            {chip(null, 'All')}
            {q.options.map((o, i) => chip(i, o.label, wfShade(T.color, i), wfShadeText(i)))}
          </div>
        )}
        {shown.length === 0 && ownShown.length === 0 && <div style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', padding: '14px 0', textAlign: 'center' }}>{takes.length === 0 && ownAll.length === 0 ? 'No takes yet — yours could be first.' : 'No takes from this side yet.'}</div>}
        {shown.map(([c, i]) => {
          const key = q.id + ':' + i;
          const boosted = !!this.state.boosts[key];
          const optLabel = c.opt != null && q.options ? q.options[c.opt].label : null;
          const myReplies = this.state.replies[key] || [];
          const replying = this.state.replyTo === key;
          return (
            <div key={key} style={{ border: WF_LINE, borderRadius: 12, background: 'var(--surface)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11.5, background: c.opt != null ? wfShade(T.color, c.opt) : 'var(--ink-3)', color: c.opt != null ? wfShadeText(c.opt) : '#fff' }}>{c.init}</span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 12.5 }}>{c.name}</span>
                    {optLabel && <span style={{ background: wfShade(T.color, c.opt), color: wfShadeText(c.opt), fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{optLabel}</span>}
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)' }}>{c.time}</span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.45, fontWeight: 500 }}>{c.text}</div>
                  <button onClick={() => this.setState({ replyTo: replying ? null : key })} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 11, color: replying ? 'var(--ink)' : 'var(--ink-3)', WebkitAppearance: 'none' }}>Reply</button>
                </div>
                <button onClick={() => this.setState((s) => ({ boosts: { ...s.boosts, [key]: !s.boosts[key] } }))} aria-pressed={boosted} style={{ border: WF_LINE, borderRadius: 10, padding: '4px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 10.5, background: boosted ? 'var(--ink)' : 'var(--surface-2)', color: boosted ? 'var(--surface)' : 'var(--ink)', flexShrink: 0, WebkitAppearance: 'none' }}>{'\u25B2'}<span>{wfFmt(c.ups + (boosted ? 1 : 0))}</span></button>
              </div>
              {(myReplies.length > 0 || replying) && (
                <div style={{ marginLeft: 40, display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '2px solid var(--surface-3)', paddingLeft: 10 }}>
                  {myReplies.map((r, ri) => (
                    <div key={ri} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: 12 }}>You</span>
                        {mySide != null && <span style={{ background: wfShade(T.color, mySide), color: wfShadeText(mySide), fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999, whiteSpace: 'nowrap' }}>{q.options[mySide].label}</span>}
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-3)' }}>now</span>
                      </div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.45, fontWeight: 500 }}>{r}</div>
                    </div>
                  ))}
                  {replying && (
                    <form onSubmit={(e) => { e.preventDefault(); const inp = e.target.elements.reply; const v = inp.value.trim(); if (v) this.addReply(key, v); }} style={{ display: 'flex', gap: 6 }}>
                      <input name="reply" autoFocus placeholder="Your reply…" style={{ flex: 1, minWidth: 0, border: WF_LINE, borderRadius: 999, padding: '7px 12px', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500, background: 'var(--surface-2)', color: 'var(--ink)', outline: 'none' }} />
                      <button type="submit" style={{ border: 'none', borderRadius: 999, padding: '7px 13px', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, cursor: 'pointer', background: 'var(--ink)', color: 'var(--surface)', WebkitAppearance: 'none' }}>Send</button>
                    </form>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
            </div>
          </div>
        ))}
        <form onSubmit={(e) => { e.preventDefault(); const inp = e.target.elements.take; const v = inp.value.trim(); if (v) { this.addTake(q.id, v); inp.value = ''; } }} style={{ display: 'flex', gap: 6, paddingTop: 2 }}>
          <input name="take" placeholder="Add your take…" style={{ flex: 1, minWidth: 0, border: WF_LINE, borderRadius: 999, padding: '8px 13px', fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 500, background: 'var(--surface)', color: 'var(--ink)', outline: 'none' }} />
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

  renderStats(q, T) {
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

  renderCard(q) {
    const tm = q.test && window.PASSIVE ? window.PASSIVE.META[q.test] : null;
    const T = tm ? { label: tm.label, color: tm.accent } : (WF_TOPIC[q.cat] || { label: q.cat, color: 'var(--ink-3)' });
    const scene = !tm && q.scene && window.SCENES ? window.SCENES.defs().find((g) => g.id === q.scene) : null;
    const kickLabel = scene ? scene.name : (tm ? tm.label + ' test' : T.label);
    const compact = this.props.density === 'compact';
    const answered = this.answered(q);
    const open = !!this.state.open[q.id];
    const collapsed = compact && !open;
    const kicker = (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.01em', textTransform: 'lowercase', color: tm ? `color-mix(in oklch, ${T.color} 70%, var(--ink))` : 'var(--ink-2)', background: tm ? `color-mix(in oklch, ${T.color} 11%, transparent)` : 'transparent', border: '0.5px solid ' + (tm ? `color-mix(in oklch, ${T.color} 40%, var(--rule))` : 'var(--rule)'), borderRadius: 999, padding: '4px 12px 4px 10px', minWidth: 0 }}><span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: T.color, flexShrink: 0 }}></span>{kickLabel}</span>
        {window.PassiveTag && <window.PassiveTag q={q} answered={answered}></window.PassiveTag>}
      </div>
    );
    const snap = !compact;
    const card = { background: 'var(--surface-2)', border: tm ? '1px solid color-mix(in oklch, ' + T.color + ' 32%, var(--rule))' : WF_LINE, borderRadius: 18, boxShadow: 'var(--shadow-card)', padding: collapsed ? '12px 14px' : '16px 15px', display: 'flex', flexDirection: 'column', gap: collapsed ? 8 : 12 };
    // hero cards carry a whisper of their topic hue so the breathing room reads designed, not blank
    if (!collapsed) card.backgroundImage = 'radial-gradient(120% 80% at 50% -25%, color-mix(in oklch, ' + T.color + ' 8%, transparent), transparent 62%)';
    if (snap) {
      // one question per view — the card fills most of the scroller; kicker
      // holds the top edge while the question + options sit centered, hero-scale
      card.minHeight = Math.max((this.state.vh || 620) - 190, 350);
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
        {snap && <div aria-hidden="true" style={{ flex: '0.12 1 0' }}></div>}
        <div style={{ fontFamily: 'var(--sans)', fontWeight: snap ? 800 : 750, fontSize: snap ? 26 : 16.5, lineHeight: snap ? 1.12 : 1.25, letterSpacing: snap ? -0.6 : -0.25, textWrap: 'pretty' }}>{q.prompt}</div>
        {q.type === 'vote' && this.renderVote(q, T, snap)}
        {q.type === 'duel' && this.renderDuel(q, T, snap)}
        {q.type === 'rank' && this.renderRank(q, T, snap)}
        {answered && this.state.beat !== q.id && this.renderEngage(q, T, snap)}
        {snap && <div aria-hidden="true" style={{ flex: '1 1 0' }}></div>}
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
    // weave in the tests' own questions — one marked card every few feed items
    const tqs = window.TEST_FEED_QS || [];
    const feedList = []; let ti = 0;
    sorted.forEach((q, i) => { feedList.push(q); if ((i + 1) % 4 === 0 && ti < tqs.length) feedList.push(tqs[ti++]); });
    const nDone = qs.filter((q) => this.answered(q)).length;
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
        <div style={{ position: 'sticky', top: 0, zIndex: 6, display: 'flex', flexDirection: 'column', gap: 10, margin: '0 -16px', padding: '9px 16px 12px', background: 'var(--surface-a, var(--surface))', borderBottom: '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)', transform: this.state.headHide ? 'translateY(-115%)' : 'none', opacity: this.state.headHide ? 0 : 1, pointerEvents: this.state.headHide ? 'none' : 'auto', transition: 'transform 0.32s ease, opacity 0.26s ease' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div className="h-scroll" style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', flex: 1, minWidth: 0, marginRight: -16, padding: '2px 82px 2px 0' }}>
            {window.PassiveMeter && <window.PassiveMeter></window.PassiveMeter>}
            <button key="__sort" onClick={() => this.setState({ sort: sort === 'hot' ? 'top' : sort === 'top' ? 'new' : 'hot' })} aria-label={'Sort: ' + sort} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, border: '0.5px solid color-mix(in oklch, var(--rule), var(--ink) 30%)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontWeight: 750, fontSize: 12, padding: '5px 11px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', whiteSpace: 'nowrap' }}>{sort === 'top' ? 'top' : sort === 'new' ? 'new' : 'hot'}<svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8.5 12 15.5 19 8.5"></path></svg></button>
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
          <button className="wf-chip press" onClick={() => window.openSuggestions && window.openSuggestions()} aria-label="Suggest a question" style={{ position: 'absolute', right: -8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, flexShrink: 0, border: '0.5px solid color-mix(in oklch, var(--accent) 45%, var(--rule))', background: 'color-mix(in oklch, var(--accent) 9%, var(--surface-2))', color: 'var(--accent)', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none' }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5 V19 M5 12 H19"></path></svg>
          </button>
          </div>
        </div>
        {feedList.map((q, i) => (
          <React.Fragment key={q.id}>
            {sugg && i === 2 && this.renderSuggestion(sugg, snap)}
            {this.renderCard(q)}
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
;globalThis.WF_TOPICS = typeof WF_TOPICS === 'undefined' ? globalThis.WF_TOPICS : WF_TOPICS;
;globalThis.WF_TOPIC = typeof WF_TOPIC === 'undefined' ? globalThis.WF_TOPIC : WF_TOPIC;
;globalThis.WF_CHANNELS = typeof WF_CHANNELS === 'undefined' ? globalThis.WF_CHANNELS : WF_CHANNELS;
;globalThis.WF_CHAN_SET = typeof WF_CHAN_SET === 'undefined' ? globalThis.WF_CHAN_SET : WF_CHAN_SET;
;globalThis.WF_LINE = typeof WF_LINE === 'undefined' ? globalThis.WF_LINE : WF_LINE;
;globalThis.WF_DIMS = typeof WF_DIMS === 'undefined' ? globalThis.WF_DIMS : WF_DIMS;
;globalThis.WF_GROUPS = typeof WF_GROUPS === 'undefined' ? globalThis.WF_GROUPS : WF_GROUPS;
;globalThis.WF_FRIENDS = typeof WF_FRIENDS === 'undefined' ? globalThis.WF_FRIENDS : WF_FRIENDS;

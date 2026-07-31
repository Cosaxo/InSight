// Ported from design/spec-modules/search-overlay.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';

// search-overlay.jsx — one field, three kinds of answer: questions, topics, people.
// A question hit is the real question: tap it and the feed's own card opens in
// place, so you can vote from search instead of going hunting for the card.
const { useState: useSrchState, useEffect: useSrchEffect, useMemo: useSrchMemo, useRef: useSrchRef } = React;

const SRCH_VOTES_LS = 'insight.feedVotes.v1';
function srchVotes() {
  try { const v = JSON.parse(localStorage.getItem(SRCH_VOTES_LS) || '{}'); return v && typeof v === 'object' ? v : {}; }
  catch (e) { return {}; }
}
function srchMatch(hay, q) { return hay.toLowerCase().includes(q); }
// where the match lands: start of the string beats start of a word beats inside one
function srchWhere(text, q) {
  const t = (text || '').toLowerCase();
  const i = t.indexOf(q);
  if (i < 0) return -1;
  if (i === 0) return 2;
  return /[\s—–\-("'“]/.test(t[i - 1]) ? 1 : 0;
}
// a question's relevance: the prompt matters most, then its options, then its topic
function srchQScore(q, query, topicLabel) {
  let best = -1;
  const p = srchWhere(q.prompt, query);
  if (p >= 0) best = 12 + p * 2;
  ((q.options || []).map((o) => o.label).concat(q.items || [])).forEach((l) => {
    const s = srchWhere(l, query); if (s >= 0) best = Math.max(best, 6 + s);
  });
  const t = srchWhere(topicLabel, query);
  if (t >= 0) best = Math.max(best, 3 + t);
  return best;
}
function srchQVotes(q) {
  return q.type === 'rank' ? (q.votes || 0) : q.type === 'rate' ? (q.n || 0) : (q.options || []).reduce((a, o) => a + o.count, 0);
}
function srchAnswered(q, votes) {
  const v = votes[q.id];
  return q.type === 'rank' ? !!(v && v.order) : v != null;
}
// what you said, in the fewest words that still mean something
function srchMyPick(q, votes) {
  const v = votes[q.id];
  if (v == null) return null;
  if (q.type === 'rank') return v.order ? 'you ranked these' : null;
  if (typeof v === 'number' && q.type === 'rate') return 'you gave it ' + v;
  const o = (q.options || [])[v];
  return o ? 'you said ' + o.label : null;
}

// highlight the matched substring
function SrchMark({ text, q }) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text;
  return (<span>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</span>);
}

function SrchHit({ glyph, title, sub, q, onClick }) {
  return (
    <button className="search-hit" onClick={onClick}>
      {glyph}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="hit-t" style={{ display: 'block' }}><SrchMark text={title} q={q} /></span>
        {sub && <span className="hit-s" style={{ display: 'block' }}>{sub}</span>}
      </span>
      <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>→</span>
    </button>
  );
}

// answered rows carry a silent meter instead of a badge: how big your side was
function SrchShare({ q, votes, color }) {
  const v = votes[q.id];
  if (typeof v !== 'number' || !q.options || !q.options[v]) return null;
  const total = q.options.reduce((a, o) => a + o.count, 0) || 1;
  const share = Math.max(0.04, Math.min(1, q.options[v].count / total));
  return (
    <span aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 999, background: 'color-mix(in oklch, ' + color + ' 16%, var(--surface-3))', flexShrink: 0, overflow: 'hidden', display: 'block' }}>
      <span style={{ display: 'block', height: '100%', width: (share * 100).toFixed(1) + '%', background: color, borderRadius: 999 }}></span>
    </span>
  );
}

function SrchQRow({ q, query, votes, topic, onOpen }) {
  const color = topic ? topic.color : 'var(--ink-3)';
  const answered = srchAnswered(q, votes);
  const pick = srchMyPick(q, votes);
  return (
    <button className="search-hit" onClick={onOpen} style={{ alignItems: 'flex-start', gap: 10 }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, marginTop: 6 }}></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="hit-t" style={{ display: 'block', lineHeight: 1.3, fontWeight: answered ? 600 : 700, color: answered ? 'var(--ink-2)' : 'var(--ink)' }}><SrchMark text={q.prompt} q={query} /></span>
        {pick && <span className="hit-s" style={{ display: 'block' }}>{pick}</span>}
      </span>
      {answered ? <SrchShare q={q} votes={votes} color={color} /> : (
        <span aria-hidden="true" style={{ color: 'var(--ink-3)', display: 'flex', marginTop: 3 }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"></path></svg>
        </span>
      )}
    </button>
  );
}

function SrchTopicRow({ item, query, onToggle }) {
  const on = item.on;
  return (
    <div className="search-hit" style={{ cursor: 'default' }}>
      <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: '50%', background: item.color, flexShrink: 0 }}></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="hit-t" style={{ display: 'block' }}><SrchMark text={item.label} q={query} /></span>
        <span className="hit-s" style={{ display: 'block' }}>{item.n} question{item.n === 1 ? '' : 's'}</span>
      </span>
      <button className="press" onClick={onToggle} style={{ flexShrink: 0, border: on ? '0.5px solid var(--rule)' : 'none', borderRadius: 999, padding: '7px 14px', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, background: on ? 'transparent' : 'var(--ink)', color: on ? 'var(--ink-3)' : 'var(--surface)', WebkitAppearance: 'none' }}>{on ? 'Following' : 'Follow'}</button>
    </div>
  );
}

function SearchOverlay({ onClose, onPerson }) {
  const dlg = useDialog(onClose, 'Search');
  const [q, setQ] = useSrchState('');
  const [openQ, setOpenQ] = useSrchState(null);
  const [votes, setVotes] = useSrchState(srchVotes);
  const [bump, setBump] = useSrchState(0);
  const ref = useSrchRef(null);
  const scRef = useSrchRef(null);
  useSrchEffect(() => { const t = setTimeout(() => ref.current && ref.current.focus(), 80); return () => clearTimeout(t); }, []);

  const query = q.trim().toLowerCase();
  const D = window.IS_DATA;
  const TOPIC = useSrchMemo(() => Object.fromEntries((window.WORLD_TOPICS || []).map((t) => [t.id, t])), []);
  const ST = window.SUBTOPICS;
  const SC = window.SCENES;

  // the label a question wears — the leaf if it has one, else its topic
  const labelOf = (qq) => {
    if (qq.scene && SC) { const g = SC.defs().find((x) => x.id === qq.scene); if (g) return { label: g.name, color: SC.colorOf ? SC.colorOf(g.id) : 'var(--ink-3)' }; }
    if (qq.sub && ST) { const s = ST.get(qq.sub); if (s) return { label: s.label, color: (TOPIC[s.parent] || {}).color || 'var(--ink-3)' }; }
    return TOPIC[qq.cat] || { label: qq.cat, color: 'var(--ink-3)' };
  };

  // questions — the whole pool, not just what you follow: search is how you
  // reach a room you haven't joined. Act-on-able first: prompt hits, unanswered,
  // then weight of traffic.
  const questions = useSrchMemo(() => {
    const pool = window.WORLD_FEED_QS || [];
    if (!query) {
      // one per stream, round-robin — five open questions that aren't all one room
      const by = {}, order = [];
      pool.filter((x) => !srchAnswered(x, votes)).forEach((x) => {
        const k = x.scene || x.sub || x.cat;
        if (!by[k]) { by[k] = []; order.push(k); }
        by[k].push(x);
      });
      order.forEach((k) => by[k].sort((a, b) => srchQVotes(b) - srchQVotes(a)));
      const out = [];
      for (let i = 0; out.length < 5 && order.some((k) => i < by[k].length); i++) {
        order.forEach((k) => { if (out.length < 5 && i < by[k].length) out.push(by[k][i]); });
      }
      return out;
    }
    return pool
      .map((x) => ({ x, s: srchQScore(x, query, labelOf(x).label) - (srchAnswered(x, votes) ? 2 : 0) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s
        || (srchAnswered(a.x, votes) ? 1 : 0) - (srchAnswered(b.x, votes) ? 1 : 0)
        || srchQVotes(b.x) - srchQVotes(a.x))
      .slice(0, 10)
      .map((r) => r.x);
  }, [query, votes]);

  // topics you can subscribe to: followable leaves and scenes
  const topics = useSrchMemo(() => {
    if (!query) return [];
    const out = [];
    if (ST) ST.all().forEach((s) => {
      if (!srchMatch(s.label, query)) return;
      out.push({ id: s.id, label: s.label, color: (TOPIC[s.parent] || {}).color || 'var(--ink-3)', n: ST.count(s.id), on: ST.has(s.id), toggle: () => ST.toggle(s.id) });
    });
    if (SC) SC.defs().forEach((g) => {
      if (!srchMatch(g.name, query)) return;
      const n = (window.WORLD_FEED_QS || []).filter((x) => x.scene === g.id).length;
      out.push({ id: g.id, label: g.name, color: SC.colorOf ? SC.colorOf(g.id) : 'var(--ink-3)', n, on: SC.has(g.id), toggle: () => SC.toggle(g.id) });
    });
    // a leaf and a scene can share a name — keep the richer room, not both
    const seen = {};
    return out
      .sort((a, b) => b.n - a.n)
      .filter((t) => { const k = t.label.toLowerCase(); if (seen[k]) return false; seen[k] = 1; return true; })
      .sort((a, b) => srchWhere(b.label, query) - srchWhere(a.label, query) || b.n - a.n).slice(0, 5);
  }, [query, bump]);

  // the daily archive — a different mechanism (it lives on the Daily tab), so it
  // gets its own group and simply takes you there instead of faking a card
  const dailies = useSrchMemo(() => {
    const DQ = window.DAILYQ;
    if (!query || !DQ) return [];
    return DQ.questions
      .map((x) => ({ x, s: srchQScore({ prompt: x.prompt, options: (x.options || []).map((l) => ({ label: l })) }, query, '') }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 4)
      .map((r) => {
        const mine = DQ.myAnswer(r.x);
        return { id: r.x.id, prompt: r.x.prompt, said: mine != null && r.x.options ? r.x.options[mine] : null };
      });
  }, [query]);

  // no query — your friends; with a query — everyone you can reach
  const people = useSrchMemo(() => {
    const friends = (window.FRIENDS ? window.FRIENDS.list() : []).map(id => (D.people || []).find(p => p.id === id)).filter(Boolean);
    if (!query) return friends;
    const all = friends.concat((D.nearby || []).filter(n => !friends.some(f => f.id === n.id)));
    return all.filter(p => srchMatch(p.name + ' ' + (p.role || p.rel || '') + ' ' + (p.interests || []).map(i => i.t || i).join(' '), query));
  }, [query]);

  const nothing = !questions.length && !topics.length && !people.length && !dailies.length;
  const go = (fn) => { onClose(); fn(); };
  const open = (qq) => {
    setOpenQ(openQ && openQ.id === qq.id ? null : qq);
    // bring the opened card up to the top of the list without scrollIntoView
    requestAnimationFrame(() => {
      const sc = scRef.current, row = sc && sc.querySelector('[data-openq]');
      if (sc && row) sc.scrollTop = Math.max(0, row.offsetTop - 8);
    });
  };

  const qRow = (qq) => {
    const isOpen = openQ && openQ.id === qq.id;
    if (isOpen) {
      return (
        <div key={qq.id} data-openq="1" style={{ position: 'relative', border: '1px solid color-mix(in oklch, var(--accent) 32%, var(--rule))', borderRadius: 18, padding: '4px 12px 8px', margin: '6px 0 10px', background: 'var(--surface-2)', boxShadow: 'var(--shadow-card)' }}>
          <button className="press" aria-label="Close question" onClick={() => setOpenQ(null)} style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, width: 26, height: 26, borderRadius: '50%', border: '0.5px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink-2)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, WebkitAppearance: 'none' }}>✕</button>
          <window.WorldFeed focus={[qq]} cats={{}} onToggle={() => {}} beats={false}
            opts={{ pass: false, clock: false, ripple: false, why: false }}
            onVote={() => setVotes(srchVotes())} />
        </div>
      );
    }
    return <SrchQRow key={qq.id} q={qq} query={query} votes={votes} topic={labelOf(qq)} onOpen={() => open(qq)} />;
  };

  return (
    <div className="overlay" {...dlg} style={{ fontFamily: 'var(--sans)' }}>
      <div className="search-head">
        <div className="search-field">
          <span style={{ color: 'var(--ink-3)', display: 'flex' }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>
          </span>
          <input ref={ref} value={q} onChange={e => { setQ(e.target.value); setOpenQ(null); }} placeholder="Questions, topics, people…"
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }} />
          {q && <button onClick={() => { setQ(''); setOpenQ(null); }} style={{ border: 'none', background: 'var(--rule)', color: 'var(--ink-2)', width: 18, height: 18, borderRadius: 999, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>}
        </div>
        <button className="search-cancel" onClick={onClose}>Cancel</button>
      </div>

      <div ref={scRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 40px' }}>
        {nothing && (
          <div className="search-empty">Nothing for “{q}” — try a topic, a name, or a few words of a question</div>
        )}

        {!!questions.length && <div className="search-group">{query ? 'Questions' : 'Open questions'}</div>}
        {questions.map(qRow)}

        {!!dailies.length && <div className="search-group">Daily archive</div>}
        {dailies.map((d) => (
          <button key={d.id} className="search-hit" style={{ alignItems: 'flex-start', gap: 10 }} onClick={() => go(() => window.goTab && window.goTab('track'))}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 6 }}></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="hit-t" style={{ display: 'block', lineHeight: 1.3 }}><SrchMark text={d.prompt} q={query} /></span>
              {d.said && <span className="hit-s" style={{ display: 'block' }}>you said {d.said}</span>}
            </span>
            <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>→</span>
          </button>
        ))}

        {!!topics.length && <div className="search-group">Topics</div>}
        {topics.map((t) => (
          <SrchTopicRow key={t.id} item={t} query={query} onToggle={() => { t.toggle(); setBump((b) => b + 1); }} />
        ))}

        {!!people.length && <div className="search-group">{query ? 'People' : 'Friends'}</div>}
        {people.map(p => (
          <SrchHit key={p.id}
            glyph={p.anon ? <AnonAv hue={p.hue} size={32} /> : <Av init={p.init} hue={p.hue} size={32} />}
            title={anonName(p)} sub={[p.role || p.rel, p.dist || (p.since ? 'since ' + p.since : null), p.match != null ? Math.round(p.match) + '% match' : null].filter(Boolean).join(' · ')} q={query}
            onClick={() => go(() => onPerson(p))} />
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { SearchOverlay });

;globalThis.srchMatch = typeof srchMatch === 'undefined' ? globalThis.srchMatch : srchMatch;
;globalThis.SrchMark = typeof SrchMark === 'undefined' ? globalThis.SrchMark : SrchMark;
;globalThis.SrchHit = typeof SrchHit === 'undefined' ? globalThis.SrchHit : SrchHit;
;globalThis.SearchOverlay = typeof SearchOverlay === 'undefined' ? globalThis.SearchOverlay : SearchOverlay;

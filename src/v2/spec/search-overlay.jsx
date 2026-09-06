// Ported from design/spec-modules/search-overlay.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
// The subtopic store, by NAME rather than through window (D39's convert on
// touch). It is also what makes this overlay's chunk independent of the
// feed's: world-subtopics.js moved out of the eager list into loadWorldFeed,
// and the discover sheet below reads `ST.offers()` — so the module has to
// arrive with THIS group, not with that one. loadOverlays calls
// installSubtopicStock() for the same reason.
import { SUBTOPICS } from './world-subtopics.js';
// Both deferred with this file (search-overlay moved into loadOverlays at
// D223), so neither reaches the first frame — world-catalogs is already
// pulled in by loadWorldFeed for the same reason.
import { WF_CATALOGS } from './world-catalogs.js';
import { wfAnsweredOf, wfPcts, wfVotesOf } from './world-feed-math.js';
import { WPAL } from './world-palette.js';
import { FRIENDS } from './follows.js';
import { DAILYQ } from './daily-questions.js';
import { IS_DATA } from './sample-data.js';
import { SCENES } from './scenes.js';
import { Av, AnonAv, anonName, useDialog } from './primitives.jsx';
import NAV from '../data/nav';

// search-overlay.jsx — one field, three kinds of answer: questions, topics, people.
// A question hit is the real question: tap it and the feed's own card opens in
// place, so you can vote from search instead of going hunting for the card.
// The LIVE people section (D237). An ESM import rather than a global:
// this module is deferred behind loadOverlays(), so the chunk it pulls is
// not first paint, and a real import is one less name resolved at render
// time (check:globals rule 4).
import LivePeopleSearch from '../ui/LivePeopleSearch.tsx';
import { WORLD_TOPICS } from './world-feed-data.js';

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
// The feed's own counter, not a fork of it. This was a stale copy that
// knew about `rank` and `rate` and nothing else, so `dial`, `field` and
// `pick` — which carry no `options` — scored 0 in both orderings below.
function srchQVotes(q) {
  return wfVotesOf(q, (WF_CATALOGS[q.catalog] || {}).picks || 0);
}
// The feed's own predicate, not a fork of it. This was the feed's TAIL
// with the live branch cut off, so an answer that exists only on the
// server — another device, or a page fetched after boot — read as
// unanswered in both orderings below and on the row itself.
function srchAnswered(q, votes) {
  return wfAnsweredOf(q, votes, LIVE.myVotes ? () => LIVE.myVotes() : null);
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
//
// The feed's own share, not a fork of it — the third helper in this file to
// need that sentence, after `srchQVotes` and `srchAnswered` above. It
// divided `o.count` by the sum of `o.count`, and a live card's counts have
// the viewer's own vote SUBTRACTED (data/live.ts's feedCounts says so; the
// feed adds it back with `wfPcts`). So this meter drew a share of a
// population the reader was not in: a true 62.5% came out at 60.9%, and
// when you were the only voter your side was 100% and the bar drew at its
// 4% floor — "almost nobody agreed with you", about a crowd of one, which
// is you.
function SrchShare({ q, votes, color }) {
  const v = votes[q.id];
  if (typeof v !== 'number' || !q.options || !q.options[v]) return null;
  const share = Math.max(0.04, Math.min(1, wfPcts(q.options.map((o) => o.count || 0), v).p[v] / 100));
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

function SearchOverlay({ onClose, onPerson, samplePeople }) {
  const dlg = useDialog(onClose, 'Search');
  const [q, setQ] = useSrchState('');
  const [openQ, setOpenQ] = useSrchState(null);
  const [votes, setVotes] = useSrchState(srchVotes);
  const [bump, setBump] = useSrchState(0);
  const ref = useSrchRef(null);
  const scRef = useSrchRef(null);
  useSrchEffect(() => { const t = setTimeout(() => ref.current && ref.current.focus(), 80); return () => clearTimeout(t); }, []);

  const query = q.trim().toLowerCase();
  const D = IS_DATA;
  const TOPIC = useSrchMemo(() => Object.fromEntries(WORLD_TOPICS.map((t) => [t.id, t])), []);
  const ST = SUBTOPICS;

  // the label a question wears — the leaf if it has one, else its topic
  const labelOf = (qq) => {
    if (qq.scene) { const g = SCENES.defs().find((x) => x.id === qq.scene); if (g) return { label: g.name, color: SCENES.colorOf(g.id) }; }
    if (qq.sub && ST) { const s = ST.get(qq.sub); if (s) return { label: s.label, color: WPAL.c((TOPIC[s.parent] || {}).color) || 'var(--ink-3)' }; }
    const t0 = TOPIC[qq.cat];
    return t0 ? { label: t0.label, color: WPAL.c(t0.color) } : { label: qq.cat, color: 'var(--ink-3)' };
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
    // Door labels join the match text (docs/TAGS-PLAN.md §2): a straddler is
    // findable by every topic it carries, not only its home's name — the
    // e-sports card should answer a search for "tech".
    const extraOf = (x) => [labelOf(x).label]
      .concat((x.also || []).map((t) => (TOPIC[t] || {}).label || (ST && (ST.get(t) || {}).label) || t))
      .join(' ');
    return pool
      .map((x) => ({ x, s: srchQScore(x, query, extraOf(x)) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s
        || (srchAnswered(a.x, votes) ? 1 : 0) - (srchAnswered(b.x, votes) ? 1 : 0)
        || srchQVotes(b.x) - srchQVotes(a.x))
      .slice(0, 12)
      .map((r) => r.x);
  }, [query, votes]);

  // topics you can subscribe to: followable leaves and scenes — offers(),
  // not all()/defs(), so search advertises exactly what the add sheet does:
  // stocked leaves only, and no demo communities in a live build (D96)
  const topics = useSrchMemo(() => {
    if (!query) return [];
    const out = [];
    if (ST) ST.offers().forEach((s) => {
      if (!srchMatch(s.label, query)) return;
      out.push({ id: s.id, label: s.label, color: (TOPIC[s.parent] || {}).color || 'var(--ink-3)', n: ST.count(s.id), on: ST.has(s.id), toggle: () => ST.toggle(s.id) });
    });
    SCENES.offers().forEach((g) => {
      if (!srchMatch(g.name, query)) return;
      const n = (window.WORLD_FEED_QS || []).filter((x) => x.scene === g.id).length;
      out.push({ id: g.id, label: g.name, color: SCENES.colorOf(g.id), n, on: SCENES.has(g.id), toggle: () => SCENES.toggle(g.id) });
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
    const DQ = DAILYQ;
    if (!query || !DQ) return [];
    return DQ.questions
      .map((x) => ({ x, s: srchQScore({ prompt: x.prompt, options: (x.options || []).map((l) => ({ label: l })) }, query, [x.tag].concat(x.cat || []).filter(Boolean).join(' ')) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((r) => {
        const mine = DQ.myAnswer(r.x);
        return { id: r.x.id, prompt: r.x.prompt, said: mine != null && r.x.options ? r.x.options[mine] : null };
      });
  }, [query]);

  // no query — your friends; with a query — everyone you can reach.
  // Every one of these people is a sample-data persona, and so is every
  // subtitle ("sister · since birth · 86% match") — claims about nobody.
  // In a live build the section renders empty instead (samplePeople is
  // false there), and a real user reading an invented sister into their
  // search is the D1 fabrication this store predates.
  //
  // The reason used to read "v2 has no person-to-person graph (D3)", which
  // D101 made false — the follow graph is real and `data/circle.ts` folds
  // it. The conclusion is unchanged and the correction matters anyway: the
  // gate is that THESE people are invented, not that no people exist, so
  // wiring the real graph in here would be a feature rather than the
  // removal of a limitation.
  const people = useSrchMemo(() => {
    if (samplePeople === false) return [];
    const friends = FRIENDS.list().map(id => (D.people || []).find(p => p.id === id)).filter(Boolean);
    if (!query) return friends;
    const all = friends.concat((D.nearby || []).filter(n => !friends.some(f => f.id === n.id)));
    return all.filter(p => srchMatch(p.name + ' ' + (p.role || p.rel || '') + ' ' + (p.interests || []).map(i => i.t || i).join(' '), query));
  }, [query, samplePeople]);

  // In a live build `people` above is ALWAYS empty (samplePeople is
  // false), so without asking the live section whether it found
  // anything, searching a name that resolves would print "nothing found"
  // directly above the person it found.
  //
  // REPORTED, not predicted (D239). It used to be a synchronous
  // predicate — "does this look like a handle" — which was answerable
  // because a handle is a shape. A name is not: whether anybody is
  // called that is a query, and a guess made before it returns is wrong
  // half the time.
  const [livePeople, setLivePeople] = useSrchState(false);
  const nothing = !questions.length && !topics.length && !people.length && !dailies.length && !livePeople;
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
    // The feed's own card, and the feed is a DIFFERENT deferred chunk from
    // this overlay's — main.jsx starts loadWorldFeed and loadOverlays as
    // concurrent promises, neither awaiting the other, and a chunk that
    // fails is never retried for the rest of the session. Unguarded, a tap
    // on a question hit rendered `undefined` as an element type and the
    // boundary took the whole search overlay — query, results and all — for
    // a screen the user opened to read one card. daily-split.jsx guards the
    // identical read and degrades to no feed node; this is the same
    // degradation, back to the collapsed row.
    //
    // Held in a local rather than guarded in place: `window.X && <window.X>`
    // is two shared-global references where the tag alone is one, and
    // check:globals rule 4 may only move down.
    const WF = window.WorldFeed;
    const isOpen = WF && openQ && openQ.id === qq.id;
    if (isOpen) {
      return (
        <div key={qq.id} data-openq="1" style={{ position: 'relative', border: '1px solid color-mix(in oklch, var(--accent) 32%, var(--rule))', borderRadius: 18, padding: '4px 12px 8px', margin: '6px 0 10px', background: 'var(--surface-2)', boxShadow: 'var(--shadow-card)' }}>
          <button className="press tap44" aria-label="Close question" onClick={() => setOpenQ(null)} style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, width: 26, height: 26, borderRadius: '50%', border: '0.5px solid var(--rule)', background: 'var(--surface)', color: 'var(--ink-2)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, WebkitAppearance: 'none' }}>✕</button>
          <WF focus={[qq]} cats={{}} onToggle={() => {}} beats={false}
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
            autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} inputMode="search" enterKeyHint="search"
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }} />
          {q && <button className="tap44" onClick={() => { setQ(''); setOpenQ(null); }} style={{ border: 'none', background: 'var(--rule)', color: 'var(--ink-2)', width: 18, height: 18, borderRadius: 999, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>}
        </div>
        <button className="search-cancel" onClick={onClose}>Cancel</button>
      </div>

      <div ref={scRef} style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 40px' }}>
        {/* "a name" is a live build's one false suggestion: people are
            found by HANDLE there (the registry is keyed on the document id
            — D122 — so there is no name query to offer), and the only
            names that match are follows already in memory. */}
        {nothing && (
          <div className="search-empty">Nothing for “{q}” — try a topic, {samplePeople === false ? 'a @handle' : 'a name'}, or a few words of a question</div>
        )}

        {!!questions.length && <div className="search-group">{query ? 'Questions' : 'Open questions'}</div>}
        {questions.map(qRow)}

        {!!dailies.length && <div className="search-group">Daily archive</div>}
        {dailies.map((d) => (
          <button key={d.id} className="search-hit" style={{ alignItems: 'flex-start', gap: 10 }} onClick={() => go(() => NAV.goTab('track'))}>
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

        {samplePeople === false && <LivePeopleSearch query={q} onActive={setLivePeople} />}
        {!!people.length && <div className="search-group">{query ? 'People' : 'Friends'}</div>}
        {/* the sub-line stopped stating distance (2026-08-24) — the same
            direction Near took: knowing how close a stranger is, is itself
            a leak, and role · since · match already carry the hit */}
        {people.map(p => (
          <SrchHit key={p.id}
            glyph={p.anon ? <AnonAv hue={p.hue} size={32} /> : <Av init={p.init} hue={p.hue} size={32} />}
            title={anonName(p)} sub={[p.role || p.rel, p.since ? 'since ' + p.since : null, p.match != null ? Math.round(p.match) + '% match' : null].filter(Boolean).join(' · ')} q={query}
            onClick={() => go(() => onPerson(p))} />
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { SearchOverlay });

;globalThis.SearchOverlay = typeof SearchOverlay === 'undefined' ? globalThis.SearchOverlay : SearchOverlay;

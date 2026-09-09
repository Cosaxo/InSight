// Ported from design/spec-modules/group-daily.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all), and
// re-ported at D432 from design/standalone-2026-09-09/group-daily.jsx: the
// owner's "how 1v1s and Groups work now", the group card played in ROUNDS.
// Cross-module references are real imports (D354's sweep); nothing here
// publishes to window.
import React from 'react';
import ReactDOM from 'react-dom';
import { DUELS } from './duels-data.js';
import { Sheet } from './primitives.jsx';
import { takeDuelCue, onDuelCue } from '../data/duelCue';
// The palette gate (D189). Both marks below are a full-strength fill
// carrying #fff, which is the case world-palette.js's header names for
// ink() in as many words — and this module was the one place a group hue
// reached the screen without passing through it.
import { WPAL } from './world-palette.js';
import NAV from '../data/nav';

// group-daily.jsx — the daily tab's GROUP mode, and the SHELL the 1v1 mode
// shares with it (RoundStack, CardFrame, CardHead, the sheets, the run, the
// kicker, the option and pole ballots, the sealed list).
//
// A group is a named circle (The Crew, Book Club…) that plays ROUNDS: a
// role vote three rounds in four — "Who plans the whole thing?" over a
// 2-across grid of the members' faces and You — and a rating on the
// fourth, two poles and five steps. Everyone answers blind; a round
// reveals with names when everyone has played or at its deadline; you may
// answer up to LEAD rounds ahead and the card lists what is sealed. The
// foot run is a RECORD — a dot in the pack's colour for a vote, a square
// for a rating, dotted where you were late — with a caption on tap, never
// a score: nothing in a group is predicted or called (D432).
//
// The names other modules read leave the IIFE as named exports (D354's
// sweep): the group body and the marks for the Mirror (group-mirror,
// group-role-map, person-overlay) and the whole shell for duo-daily. The
// functions are declared inside it and close over its state, so they are
// handed out through this object rather than re-declared; the IIFE runs
// before the export line below does.
const EXPORTS = {};
(function () {
  const { useState, useEffect, useRef, useReducer } = React;
  const LINE = '1px solid color-mix(in oklch, var(--rule), transparent 25%)';
  const HAIR = '0.5px solid color-mix(in oklch, var(--rule), transparent 30%)';
  const ACC = 'var(--c-likeness)';
  const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];

  const col = (g) => ({ display: 'flex', flexDirection: 'column', gap: g });
  const kick = { fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-3)', whiteSpace: 'nowrap' };
  const quiet = { fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', lineHeight: 1.45, textWrap: 'pretty' };
  const ghash = (s) => { let h = 9; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489); return ((h ^ (h >>> 9)) >>> 0) / 4294967295; };
  // one mark per group: a single colour + its initials. Three overlapping
  // avatars at rail size read as mush and never tell two groups apart.
  //
  // THE HUE IS ARBITRARY, WHICH IS EXACTLY WHY IT NEEDS THE GATE (D189).
  // `ghue` hashes a group id to any of 360 hues, and a flat chroma is wrong
  // at most of them in both directions: sRGB cannot hold 0.12/0.13 around
  // teal and cyan, so the browser clips — which dulls the colour AND drags
  // the hue — while blue, violet and magenta can hold far more and came out
  // undersaturated. Measured against the prototype at the hues its demo
  // groups land on: 0.155 wanted at hue 12/38/145/305, 0.092 at 220, 0.091
  // at 182. One flat number was never right at more than a few of them.
  const ghue = (g) => Math.round(ghash(g.id) * 360);
  // one ink per scenario pack — the kicker, the held row, the run's dot
  const scenInk = (scen) => `oklch(0.605 0.118 ${scen.hue})`;
  const ginit = (name) => { const w = name.replace(/^The\s+/i, '').split(/\s+/).filter(Boolean); return (w.length > 1 ? w.slice(0, 2).map((x) => x[0]).join('') : (w[0] || '?').slice(0, 2)).toUpperCase(); };
  function GDMark({ g, size = 34 }) {
    return (
      <span aria-hidden="true" style={{
        width: size, height: size, borderRadius: Math.round(size * 0.32), flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--sans)', fontWeight: 800, fontSize: Math.max(12, Math.round(size * 0.38)), letterSpacing: '-0.02em',
        color: '#fff', background: WPAL.ink(`oklch(0.52 0.12 ${ghue(g)})`),
      }}>{ginit(g.name)}</span>
    );
  }

  // The avatar IS the link to a person — one rule across the daily, the duo and
  // the group bodies, so an initial circle always means "open them".
  function GDAv({ p, size = 26, sealed, plain }) {
    const open = (e) => { if (!p || p.me) return; e.stopPropagation(); NAV.openPerson(p); };
    const linked = !!(p && !p.me && !plain && NAV.openPerson);
    // contrast-safe twin, since the fill carries the initials (D189)
    const fill = WPAL.ink(`oklch(0.52 0.13 ${p.hue})`);
    return (
      <span title={p.name + (p.pending ? ' · invited' : '')}
        role={linked ? 'button' : undefined} tabIndex={linked ? 0 : undefined}
        aria-label={linked ? p.name + ' — open profile' : undefined}
        onClick={linked ? open : undefined}
        onKeyDown={linked ? ((e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); } }) : undefined}
        style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--sans)', fontWeight: 800, fontSize: Math.max(12, Math.round(size * 0.4)),
        // every disc is full strength — a row of half-washed circles read as
        // broken. Where a row needs to show who is already in, that ONE site
        // passes `sealed` and gets a hue halo: same colour, one extra ring, so
        // the cue is shape and not saturation. Everywhere else: plain ring.
        color: '#fff', background: fill,
        boxShadow: sealed
          ? `0 0 0 1.5px var(--surface-a, var(--surface)), 0 0 0 3.5px ${WPAL.wash(fill, 42, 'var(--surface-a, var(--surface))')}`
          : '0 0 0 1.5px var(--surface-a, var(--surface))',
        cursor: linked ? 'pointer' : 'default',
      }}>{p.init}</span>
    );
  }
  function YouChip({ size = 22, label = 'you' }) {
    return (
      <span style={{
        height: size, padding: '0 9px', borderRadius: 999, flexShrink: 0, whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12,
        color: 'var(--surface)', background: 'var(--ink)', boxShadow: '0 0 0 1.5px var(--surface-a, var(--surface))',
      }}>{label}</span>
    );
  }
  // a seat nobody has taken yet — the dashed circle beside the faces who played
  function OpenSeat({ size = 26, acc = ACC }) {
    return <span aria-label="open seat" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, boxSizing: 'border-box', border: `1.5px dashed color-mix(in oklch, ${acc} 72%, transparent)` }}></span>;
  }
  // an answer in, not yet revealed
  function SealMark({ size = 14, acc = ACC, style }) {
    return <span aria-label="sealed" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: acc, boxShadow: `inset 0 0 0 2px var(--surface-a, var(--surface)), inset 0 0 0 3.5px ${acc}`, ...style }}></span>;
  }

  // ── the run: one mark per round ──────────────────────────────────────────
  // A 1v1's marks are scored (called it · missed); a group's are a record
  // (a vote in its pack's colour, a rating as a square, late as dotted) —
  // the same component, told by the marks it is handed.
  const RUN_TITLES = { 1: 'called it', 0: 'missed', n: 'no call this round', s: 'sealed · waiting for the reveal', o: 'open · waiting for you', l: 'late · scored nothing' };
  function RunDot({ k, color, acc, size, sq, title, ring }) {
    const s = { width: size, height: size, flexShrink: 0, borderRadius: sq ? Math.round(size * 0.24) : '50%', boxSizing: 'border-box' };
    if (k === 1) s.background = color;
    else if (k === 0) s.border = `1.5px solid color-mix(in oklch, ${color} 55%, transparent)`;
    else if (k === 'n') s.background = `color-mix(in oklch, ${color} 25%, transparent)`;
    else if (k === 's') { s.background = acc; s.boxShadow = `inset 0 0 0 2px var(--surface-a, var(--surface)), inset 0 0 0 3.5px ${acc}`; }
    else if (k === 'o') s.border = '1.5px dashed color-mix(in oklch, var(--ink-3) 75%, transparent)';
    else if (k === 'l') s.border = '1.5px dotted var(--ink-3)';
    if (ring) s.boxShadow = (s.boxShadow ? s.boxShadow + ', ' : '') + '0 0 0 2px var(--surface-a, var(--surface)), 0 0 0 3.5px var(--ink)';
    return <span title={title || RUN_TITLES[k]} style={s}></span>;
  }
  function RoundRun({ marks, color = ACC, acc = ACC, size = 13, label, aria, score = true, onPick, picked }) {
    const ref = useRef(null);
    const long = marks.length > 14;
    React.useLayoutEffect(() => { const el = ref.current; if (el) el.scrollLeft = el.scrollWidth; }, [marks.length]);
    const ms = marks.map((m) => (m && typeof m === 'object' ? m : { k: m }));
    const scored = ms.filter((m) => m.k === 1 || m.k === 0);
    const right = ms.filter((m) => m.k === 1).length;
    // a tap picks the nearest mark — the marks are 13px, and a hit box per
    // mark would be a row of forty-four-pixel targets three pixels apart
    const pick = (e) => {
      if (!onPick || !ref.current) return;
      let best = -1, bd = Infinity;
      [...ref.current.children].forEach((d, i) => {
        const r = d.getBoundingClientRect();
        const dx = Math.abs(e.clientX - (r.left + r.width / 2));
        if (dx < bd) { bd = dx; best = i; }
      });
      if (best >= 0) onPick(best === picked ? null : best);
    };
    const strip = (
      <span ref={ref} className={long ? 'h-scroll' : undefined}
        style={{ display: 'flex', gap: 3, alignItems: 'center', overflowX: long ? 'auto' : 'visible', flex: long ? 1 : 'none', minWidth: 0, padding: onPick ? '6px 0' : 0 }}>
        {ms.map((m, i) => <RunDot key={i} k={m.k} color={m.color || color} acc={acc} size={size} sq={m.sq} title={m.title} ring={picked === i}></RunDot>)}
      </span>
    );
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }} aria-label={aria}>
        {label != null && <span style={{ flexShrink: 0, width: 62, padding: '3px 0', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>}
        {long && score && (
          <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontVariantNumeric: 'tabular-nums', fontSize: size * 1.02, fontWeight: 800, color, letterSpacing: '-0.01em' }}>
            {right}<span style={{ opacity: 0.42 }}>/{scored.length}</span>
          </span>
        )}
        {onPick
          ? <button type="button" onClick={pick} aria-label="Read a round" style={{ display: 'flex', flex: long ? 1 : 'none', minWidth: 0, minHeight: 44, border: 'none', background: 'none', padding: 0, cursor: 'pointer', WebkitAppearance: 'none', color: 'inherit', font: 'inherit' }}>{strip}</button>
          : strip}
      </div>
    );
  }

  // ── the kicker: Round N · the pack · what happened ───────────────────────
  function RoundKicker({ r, tag, post, right }) {
    return (
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ display: 'flex', gap: 5, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={kick}>Round {r}</span>
          {tag && <span style={{ ...kick, color: tag.color || 'var(--ink-3)' }}>· {tag.label}</span>}
          {post && <span style={kick}>{post}</span>}
        </span>
        {right && <span style={{ ...kick, fontVariantNumeric: 'tabular-nums' }}>{right}</span>}
      </div>
    );
  }
  const qTag = (q) => (q.kind === 'vote' ? { label: q.scen.label, color: scenInk(q.scen) } : q.kind === 'rate' ? { label: 'Rate the group' } : null);
  // serif since 2026-09-06 (§6.3): the question is the app's voice
  const Prompt = ({ children, size = 27 }) => <div style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: size, lineHeight: 1.14, letterSpacing: '-0.01em', textWrap: 'balance', color: 'var(--ink)' }}>{children}</div>;
  const SmallPrompt = ({ children }) => <div style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 17, lineHeight: 1.25, letterSpacing: '-0.01em', color: 'var(--ink)', textWrap: 'pretty' }}>{children}</div>;
  function OptBtn({ label, sub, onClick, lead, tint = ACC }) {
    return (
      <button className="press" onClick={onClick} style={{
        background: `color-mix(in oklch, ${tint} 7%, var(--surface))`, border: `1px solid color-mix(in oklch, ${tint} 30%, var(--rule))`, borderRadius: 16,
        boxShadow: 'none', padding: sub ? '12px 17px' : '15px 17px', minHeight: 56, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', textAlign: 'left', WebkitAppearance: 'none',
      }}>
        {lead}
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>{label}</span>
          {sub && <span style={{ fontFamily: 'var(--sans)', fontWeight: 500, fontSize: 12.5, color: 'var(--ink-3)' }}>{sub}</span>}
        </span>
      </button>
    );
  }
  // the rounds you answered ahead of the room, waiting to reveal
  function SealedList({ title, items, line, acc = ACC }) {
    return (
      <div style={col(10)}>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 19, fontWeight: 800, letterSpacing: -0.3, color: 'var(--ink)' }}>{title}</div>
        <div style={col(0)}>
          {items.map((it) => (
            <div key={it.n} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: HAIR }}>
              <SealMark acc={acc} style={{ marginTop: 3 }}></SealMark>
              <span style={{ width: 18, flexShrink: 0, paddingTop: 1, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--ink-3)' }}>{it.n}</span>
              <div style={{ ...col(2), flex: 1, minWidth: 0 }}>
                <span style={{ fontFamily: 'var(--sans)', fontSize: 13.5, fontWeight: 700, lineHeight: 1.3, color: 'var(--ink)', textWrap: 'pretty' }}>{it.prompt}</span>
                <span style={{ ...quiet, lineHeight: 1.4 }}>{it.sub}</span>
              </div>
              {it.dl && <span style={{ flexShrink: 0, paddingTop: 1, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{it.dl}</span>}
            </div>
          ))}
        </div>
        <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, lineHeight: 1.45, color: 'var(--ink-2)', textWrap: 'pretty' }}>{line}</div>
      </div>
    );
  }
  function AheadBtn({ r, onClick }) {
    return (
      <button className="press" onClick={onClick} style={{ alignSelf: 'flex-start', minHeight: 44, padding: '0 4px', border: 'none', background: 'none', cursor: 'pointer', WebkitAppearance: 'none', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink-2)' }}>
        Round {r} is open <span style={{ color: 'var(--ink)', fontWeight: 800 }}>— answer ahead ›</span>
      </button>
    );
  }
  const Band = ({ big, sub, acc = ACC }) => (
    <div style={col(2)}>
      <span style={{ fontFamily: 'var(--sans)', fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em', color: acc }}>{big}</span>
      <span style={quiet}>{sub}</span>
    </div>
  );
  const Rule = () => <div style={{ height: 0, borderTop: '0.5px solid var(--rule)' }}></div>;

  // ── the ballots ──────────────────────────────────────────────────────────
  const poleWord = { fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13.5, letterSpacing: '-0.01em', color: 'var(--ink)', textWrap: 'balance', flex: 1, minWidth: 0 };
  // the two poles as words, five equal buttons between them, the dot
  // growing toward each end
  function PoleBallot({ q, onPick, tint = ACC }) {
    return (
      <div style={col(10)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
          <span style={poleWord}>{q.poles[0]}</span>
          <span style={{ ...poleWord, textAlign: 'right' }}>{q.poles[1]}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }} role="group" aria-label={`${q.poles[0]} to ${q.poles[1]}`}>
          {[0, 1, 2, 3, 4].map((i) => {
            const d = Math.abs(i - 2);
            return (
              <button key={i} className="press" onClick={() => onPick(i)} aria-label={q.options[i]} style={{
                flex: 1, height: 56, borderRadius: 16, cursor: 'pointer', WebkitAppearance: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `color-mix(in oklch, ${tint} 7%, var(--surface))`, border: `1px solid color-mix(in oklch, ${tint} 30%, var(--rule))`, boxShadow: 'none',
              }}>
                <span style={{ width: 10 + d * 5, height: 10 + d * 5, borderRadius: '50%', background: d === 0 ? 'transparent' : tint, border: d === 0 ? `2px solid ${tint}` : 'none', boxSizing: 'border-box' }}></span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── the reveals ──────────────────────────────────────────────────────────
  // a role vote's reveal: one row per member anybody named, most-named
  // first, the holder's row in the pack's ink, a contested runner-up beside
  function VoteReveal({ picks }) {
    const { q, rows, mine, late, counts, winner, second, contested, people } = picks;
    const ink = scenInk(q.scen);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    const order = rows.map((r) => r.oi).filter((oi) => counts[oi] > 0).sort((a, b) => counts[b] - counts[a] || a - b);
    return (
      <div style={col(8)}>
        {order.map((oi) => {
          const row = rows[oi], id = q.targets[oi], who = people[oi];
          const holds = id === winner, rival = contested && id === second;
          const hi = holds || rival;
          return (
            <div key={oi} data-held={holds ? 'true' : undefined} style={{ position: 'relative', overflow: 'hidden', borderRadius: 14, border: hi ? `1.5px solid color-mix(in oklch, ${ink} ${holds ? 60 : 40}%, transparent)` : LINE, background: 'var(--surface-2)' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: (counts[oi] / total) * 100 + '%', background: `color-mix(in oklch, ${ink} ${hi ? 14 : 7}%, transparent)` }}></div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 8px 9px', minHeight: 46, boxSizing: 'border-box' }}>
                {who && who.me ? <YouChip size={26}></YouChip> : who ? <GDAv p={who} size={26} plain></GDAv> : null}
                <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontWeight: hi ? 800 : 700, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
                <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12.5, fontVariantNumeric: 'tabular-nums', color: hi ? ink : 'var(--ink-3)' }}>{counts[oi]}</span>
                <span aria-label="voted by" style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {row.who.map((p) => <GDAv key={p.id} p={p} size={22}></GDAv>)}
                  {mine === oi && <YouChip size={22} label={late ? 'you · late' : 'you'}></YouChip>}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  // a rating's reveal: the marks of who stood where on the five steps, and
  // the group's own dot on the track between the poles
  function RateReveal({ picks }) {
    const { q, rows, mine, late, mean, score } = picks;
    const stops = [0, 1, 2, 3, 4];
    const lean = score >= 58 ? q.poles[1] : score <= 42 ? q.poles[0] : null;
    return (
      <div style={col(0)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
          <span style={{ ...poleWord, color: lean === q.poles[0] ? ACC : 'var(--ink-2)', fontWeight: lean === q.poles[0] ? 800 : 600 }}>{q.poles[0]}</span>
          <span style={{ ...poleWord, textAlign: 'right', color: lean === q.poles[1] ? ACC : 'var(--ink-2)', fontWeight: lean === q.poles[1] ? 800 : 600 }}>{q.poles[1]}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', alignItems: 'end', marginTop: 10, minHeight: 26 }}>
          {stops.map((i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 3 }}>
              {rows[i].who.map((p) => <GDAv key={p.id} p={p} size={22}></GDAv>)}
              {mine === i && <YouChip size={22} label={late ? 'you · late' : 'you'}></YouChip>}
            </div>
          ))}
        </div>
        <div style={{ position: 'relative', height: 30 }}>
          <div style={{ position: 'absolute', left: '10%', right: '10%', top: 14, height: 1.5, background: 'var(--rule)' }}></div>
          {stops.map((i) => <span key={i} style={{ position: 'absolute', left: (10 + i * 20) + '%', top: 14, transform: 'translate(-50%, -50%)', width: 7, height: 7, borderRadius: '50%', background: 'var(--surface)', border: '1.5px solid var(--ink-3)', boxSizing: 'border-box' }}></span>)}
          <span title={`the group · ${score}`} style={{ position: 'absolute', left: (10 + mean * 20) + '%', top: 14, transform: 'translate(-50%, -50%)', width: 17, height: 17, borderRadius: '50%', background: ACC, border: '2.5px solid var(--surface)', boxShadow: `0 0 0 1px ${ACC}`, boxSizing: 'border-box', transition: 'left .4s cubic-bezier(0.2,0.8,0.2,1)' }}></span>
        </div>
      </div>
    );
  }
  // the last revealed round, whole: kicker, prompt, the reveal, who played,
  // the verdict in one line — a role's holder, or where the group lands
  function GroupRevealBlock({ picks }) {
    const { q, r, mine, late, played, absent, closed } = picks;
    const meIn = mine != null;
    const openSeats = absent + (meIn ? 0 : 1);
    let verdict = null;
    if (q.kind === 'vote') {
      const name = (id) => (id === 'me' ? 'You' : DUELS.first(DUELS.personOf(id)));
      const ink = scenInk(q.scen);
      const w = picks.winner, s = picks.second;
      verdict = picks.contested && s
        ? <span><b style={{ color: ink }}>{name(w)}</b> and <b style={{ color: ink }}>{name(s)}</b> share <b>{q.role.label}</b> · contested</span>
        : <span><b style={{ color: ink }}>{name(w)}</b> {w === 'me' ? 'are' : 'is'} <b>{q.role.label}</b></span>;
    } else {
      verdict = <span>The group lands on <b style={{ color: ACC }}>{DUELS.stepLabel(q.poles, Math.round(picks.mean))}</b> <span style={{ color: 'var(--ink-3)' }}>· {picks.score}</span></span>;
    }
    return (
      <div style={col(10)}>
        <RoundKicker r={r} tag={qTag(q)} post={closed && (absent || !meIn) ? '· closed at the deadline' : '· revealed'}></RoundKicker>
        <SmallPrompt>{q.prompt}</SmallPrompt>
        {q.kind === 'rate' ? <RateReveal picks={picks}></RateReveal> : <VoteReveal picks={picks}></VoteReveal>}
        {openSeats > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', paddingTop: 2 }} aria-label="Who played">
            {played.map((p) => <GDAv key={p.id} p={p} size={30}></GDAv>)}
            {meIn && <YouChip size={30} label={late ? 'you · late' : 'you'}></YouChip>}
            {Array.from({ length: openSeats }, (_, i) => <OpenSeat key={i} size={30}></OpenSeat>)}
          </div>
        )}
        <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.4, textWrap: 'pretty' }}>{verdict}</div>
        {late && <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, lineHeight: 1.45, color: 'var(--ink-2)', textWrap: 'pretty' }}>Answered after the reveal. It shows, and counts for nothing.</div>}
      </div>
    );
  }

  // ── the rail: everyone at a glance — dot = waiting on you ────────────────
  const railBtn = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: 'none', background: 'none', cursor: 'pointer', padding: '4px 6px', WebkitAppearance: 'none', flexShrink: 0, width: 62, minHeight: 44 };
  const railLabel = (sel) => ({ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: sel ? 800 : 600, color: sel ? 'var(--ink)' : 'var(--ink-3)', whiteSpace: 'nowrap', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis' });
  function Rail({ items, cur, onPick, onAdd, addLabel, mark, label, state, square, acc = ACC }) {
    return (
      <div className="h-scroll" style={{ display: 'flex', gap: 2, overflowX: 'auto', padding: '3px 6px 2px' }}>
        {items.map((it) => {
          const sel = it.id === cur, st = state(it);
          return (
            <button key={it.id} onClick={() => onPick(it.id)} aria-current={sel ? 'true' : undefined}
              aria-label={label(it) + ' — ' + (st === 'invited' ? 'invited, waiting' : st === 'pending' ? 'your turn' : 'played')}
              style={railBtn}>
              <span style={{ position: 'relative', display: 'inline-flex', borderRadius: square ? 14 : '50%', padding: 2, boxShadow: sel ? `0 0 0 2px ${acc}` : square ? 'none' : st === 'pending' ? `0 0 0 1.5px color-mix(in oklch, ${acc} 45%, transparent)` : '0 0 0 1px var(--rule)', transition: 'box-shadow .18s' }}>
                {mark(it)}
                {st === 'invited'
                  ? <span aria-hidden="true" style={{ position: 'absolute', bottom: -3, right: -3, width: 15, height: 15, borderRadius: '50%', background: 'var(--surface-3)', color: 'var(--ink-2)', fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>…</span>
                  : st === 'pending'
                  /* only the waiting state wears a mark — a check on every
                     item carried no information and made the rail read as noise */
                  ? <span style={{ position: 'absolute', top: -1, right: -1, width: 11, height: 11, borderRadius: '50%', background: acc, border: '2px solid var(--surface)' }}></span>
                  : null}
              </span>
              <span style={railLabel(sel)}>{label(it)}</span>
            </button>
          );
        })}
        {onAdd && (
          <button onClick={onAdd} aria-label={addLabel} style={railBtn}>
            <span style={{ width: 38, height: 38, margin: 2, borderRadius: square ? 11 : '50%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px dashed color-mix(in oklch, var(--ink-3) 55%, transparent)', color: 'var(--ink-2)', fontSize: 19, fontWeight: 600, lineHeight: 1 }}>+</span>
            <span style={railLabel(false)}>New</span>
          </button>
        )}
      </div>
    );
  }

  // ── the sheets ───────────────────────────────────────────────────────────
  function useSheet() {
    const [open, setOpen] = useState(false);
    const [closing, setClosing] = useState(false);
    const close = () => { if (closing) return; setClosing(true); setTimeout(() => { setOpen(false); setClosing(false); }, 230); };
    return { open, closing, show: () => setOpen(true), close };
  }
  // The bottom sheet on the primitives' Sheet (Escape, the back layer, the
  // focus trap — D24), with the title row every duel sheet wears, portalled
  // into the app frame so it covers the tab bar the way the feed's do.
  function RoundSheet({ title, sub, onClose, closing, children, gap = 8 }) {
    const host = document.querySelector('.app');
    if (!host) return null;
    return ReactDOM.createPortal(
      <Sheet onClose={onClose} closing={closing} label={title}>
        <div style={{ padding: '10px 18px 8px', display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>{title}</span>
          <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink-3)', flex: 1, minWidth: 0 }}>{sub}</span>
          <button className="tap44" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'var(--surface-2)', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: 12, color: 'var(--ink-2)', WebkitAppearance: 'none' }}>✕</button>
        </div>
        <div className="wf-sheet-body" style={{ display: 'flex', flexDirection: 'column', gap }}>{children}</div>
      </Sheet>,
      host,
    );
  }
  const dangerBtn = { border: 'none', background: 'var(--ochre-ink)', color: '#fff', fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 12, padding: '7px 15px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', flexShrink: 0, minHeight: 44 };
  const ghostBtn = { border: LINE, background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12, padding: '7px 13px', borderRadius: 999, cursor: 'pointer', WebkitAppearance: 'none', flexShrink: 0, minHeight: 44 };
  const dangerLink = { border: 'none', background: 'none', color: 'var(--ochre-ink)', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, padding: 0, minHeight: 44, cursor: 'pointer', WebkitAppearance: 'none' };
  // the sheet's last row: a link that opens into a question with two answers
  function SheetFoot({ ask, confirm, onConfirm, keep, link, open, onOpen, onKeep }) {
    return (
      <div style={{ borderTop: '0.5px solid var(--rule)', marginTop: 8, paddingTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        {open ? (
          <React.Fragment>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', textWrap: 'pretty' }}>{ask}</span>
            <button onClick={onConfirm} style={dangerBtn}>{confirm}</button>
            <button onClick={onKeep} style={ghostBtn}>{keep}</button>
          </React.Fragment>
        ) : (
          <button onClick={onOpen} style={dangerLink}>{link}</button>
        )}
      </div>
    );
  }

  // ── the card frame and its head ──────────────────────────────────────────
  function CardFrame({ id, tall, vh, children }) {
    return (
      <div data-stack-card={id} style={{
        minHeight: tall ? Math.min(Math.max((vh || 540) - 190, 250), 380) : 0,
        boxSizing: 'border-box',
        scrollSnapAlign: 'start', scrollSnapStop: 'always',
        display: 'flex', flexDirection: 'column', gap: 16,
        borderTop: LINE, padding: '20px 1px 26px',
      }}>{children}</div>
    );
  }
  function CardHead({ mark, name, note, onMore, moreLabel, moreOpen }) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {mark}
        <span style={{ fontWeight: 800, fontSize: 15, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        {note}
        {onMore && (
          <button aria-label={moreLabel} aria-expanded={moreOpen} onClick={onMore}
            style={{ marginLeft: 'auto', marginRight: -12, width: 44, height: 44, flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 17, fontWeight: 800, lineHeight: 1, WebkitAppearance: 'none' }}>⋯</button>
        )}
      </div>
    );
  }

  // ── the stack: a sticky rail over a snap-scrolling column of cards ───────
  // Shared by the group and the 1v1 modes — the rail's marks, the card and
  // the New sheet come from the caller; the scroll-spy, the snap, the cue
  // and the frozen order are the same for both.
  function RoundStack({ items, isPending, acc = ACC, rail, renderCard, sheet, cueMode }) {
    // pending first, frozen at mount — answering must not reshuffle the
    // stack under your thumb; items added later append at the end
    const [order] = useState(() => [...items].sort((a, b) => (isPending(b) ? 1 : 0) - (isPending(a) ? 1 : 0)).map((x) => x.id));
    const ordered = order.map((id) => items.find((x) => x.id === id)).filter(Boolean).concat(items.filter((x) => !order.includes(x.id)));
    const add = useSheet();
    const [cur, setCur] = useState(ordered[0] && ordered[0].id);
    const [vh, setVh] = useState(0);
    const rootRef = useRef(null), railRef = useRef(null), scRef = useRef(null);
    const railH = () => (railRef.current ? railRef.current.offsetHeight : 80);
    const cardTop = (id) => {
      const sc = scRef.current, el = rootRef.current; if (!sc || !el) return null;
      const card = el.querySelector('[data-stack-card="' + id + '"]'); if (!card) return null;
      return Math.max(0, card.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - railH() - 14);
    };
    // snap on the tab scroller while mounted + a scroll-spy for the rail
    useEffect(() => {
      const el = rootRef.current; if (!el) return;
      let sc = el.parentElement;
      while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
      scRef.current = sc;
      if (!sc) return;
      sc.style.scrollSnapType = 'y proximity';
      // snapped cards must land BELOW the sticky rail, not under it — pad the
      // snap origin by the rail's real height
      sc.style.scrollPaddingTop = (railH() + 14) + 'px';
      setVh(sc.clientHeight - railH());
      const onScroll = () => {
        const st = sc.getBoundingClientRect().top + railH();
        let best = null, bd = Infinity;
        el.querySelectorAll('[data-stack-card]').forEach((c) => {
          const d = Math.abs(c.getBoundingClientRect().top - st - 80);
          if (d < bd) { bd = d; best = c; }
        });
        if (best) setCur(best.getAttribute('data-stack-card'));
      };
      sc.addEventListener('scroll', onScroll, { passive: true });
      return () => { sc.removeEventListener('scroll', onScroll); sc.style.scrollSnapType = ''; sc.style.scrollPaddingTop = ''; };
    }, []);
    const jump = (id) => { const top = cardTop(id); if (top != null) scRef.current.scrollTo({ top, behavior: 'smooth' }); };
    // a profile's door lands here through the duel cue (data/duelCue,
    // 2026-08-26) — select + scroll. scroll-memory restores the fresh
    // scroller to its saved position just after mount, so a one-shot jump
    // gets undone: assert the target repeatedly for a beat, instantly,
    // until it sticks (the profile-overlay subnav race, third instance).
    // The cleanup is an explicit closure, not `return onDuelCue(go)` — the
    // Compiler bails out of the whole component on a call-result cleanup.
    useEffect(() => {
      if (!cueMode) return;
      const go = () => {
        const f = takeDuelCue(cueMode); if (!f) return;
        // existence via the caller's items, read fresh: a ref-derived list
        // in this closure is a shape the Compiler refuses
        if (!items.some((x) => x.id === f)) return;
        setCur(f);
        const t0 = Date.now();
        const step = () => {
          if (Date.now() - t0 > 1400) return; // self-terminating — no timer survives the beat
          const target = cardTop(f);
          const sc = scRef.current;
          if (target != null && sc) {
            if (Math.abs(sc.scrollTop - target) > 40) sc.scrollTop = target;
            else if (Date.now() - t0 > 800) return; // held long enough — settled
          }
          setTimeout(step, 120);
        };
        step();
      };
      go();
      const off = onDuelCue(go);
      return () => { off(); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only: the cue is a one-shot and `items` is read fresh inside
    const nLeft = ordered.filter(isPending).length;
    const SheetBody = sheet && sheet.Body;
    return (
      <div ref={rootRef} style={col(10)}>
        <div ref={railRef} style={{ position: 'sticky', top: 0, zIndex: 6, margin: '-1px -16px 0', padding: '1px 10px 0', background: 'var(--surface-a, var(--surface))', borderBottom: '0.5px solid color-mix(in oklch, var(--rule), transparent 25%)', display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Rail items={ordered} cur={cur} onPick={jump} onAdd={SheetBody ? add.show : null} acc={acc} {...rail}></Rail>
          </div>
          {nLeft > 0 && <span style={{ flexShrink: 0, padding: '0 2px 0 8px', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 800, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{nLeft} to play</span>}
        </div>
        <div style={col(10)}>
          {ordered.map((it) => renderCard(it, vh))}
        </div>
        {add.open && SheetBody && (
          <RoundSheet title={sheet.title} sub={sheet.sub} gap={sheet.gap} onClose={add.close} closing={add.closing}>
            <SheetBody close={add.close} jump={jump}></SheetBody>
          </RoundSheet>
        )}
      </div>
    );
  }

  // ── one group card — fills the view, snaps into place ─────────────────────
  function GroupCard({ g, vh }) {
    const v = DUELS.groupView(g.id);
    const mg = useSheet();
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [aheadOpen, setAheadOpen] = useState(false);
    const [capR, setCapR] = useState(null);
    // the deadlines are printed as time left, so the card ticks — the clock
    // is state, read once per tick, never Date.now() mid-render
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
    useEffect(() => { if (v.ahead === 0) setAheadOpen(false); }, [v.ahead]);
    const closeMg = () => { mg.close(); setTimeout(() => setConfirmLeave(false), 240); };
    const nInvited = g.members.filter((m) => m.pending).length;
    const addable = DUELS.members().filter((f) => !g.members.some((m) => m.id === f.id));
    const left = (r) => DUELS.fmtLeft(v.deadline(r) - now);
    const head = (
      <CardHead mark={<GDMark g={g} size={30}></GDMark>} name={g.name}
        note={nInvited > 0 ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', flexShrink: 0 }}>{nInvited} invited</span> : null}
        onMore={mg.show} moreLabel={'Manage ' + g.name} moreOpen={mg.open}></CardHead>
    );
    const manageSheet = mg.open && (
      <RoundSheet title={g.name} sub={`${g.members.length + 1} members`} onClose={closeMg} closing={mg.closing}>
        {g.members.map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 11, border: LINE, borderRadius: 14, background: 'var(--surface-2)', padding: '9px 13px' }}>
            <GDAv p={m} size={30}></GDAv>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 13.5 }}>{m.name}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>{m.pending ? 'invited · waiting' : m.rel}</span>
            </span>
            <button className="tap44" onClick={() => DUELS.removeGroupMember(g.id, m.id)} aria-label={'Remove ' + m.name}
              style={{ flexShrink: 0, border: 'none', background: 'var(--surface-3)', color: 'var(--ink-2)', width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', fontSize: 12, fontWeight: 800, WebkitAppearance: 'none' }}>✕</button>
          </div>
        ))}
        {addable.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 6 }}>
            <span className="kicker" style={{ marginBottom: 0 }}>Add from your circle</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {addable.map((f) => (
                <button key={f.id} className="press" onClick={() => DUELS.addGroupMembers(g.id, [f.id])}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, border: LINE, borderRadius: 999, background: 'var(--surface-2)', padding: '5px 13px 5px 6px', cursor: 'pointer', WebkitAppearance: 'none', minHeight: 44 }}>
                  <GDAv p={f} size={26} plain></GDAv>
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 12.5, color: 'var(--ink)' }}>+ {DUELS.first(f)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <SheetFoot link="Leave group" ask={`Leave ${g.name}?`} confirm="Leave" keep="Stay"
          open={confirmLeave} onOpen={() => setConfirmLeave(true)} onKeep={() => setConfirmLeave(false)}
          onConfirm={() => { closeMg(); setTimeout(() => DUELS.leaveGroup(g.id), 240); }}></SheetFoot>
      </RoundSheet>
    );
    // the ballot: a rating's five steps, or the members and You as a
    // 2-across grid of faces — who, not what
    const askBlock = (r, showPrompt) => {
      const q = v.q(r);
      const closed = v.openClosed && r === v.open;
      return (
        <div style={col(12)} key={'ask' + r}>
          {showPrompt && <RoundKicker r={r} tag={qTag(q)} right={closed ? null : left(r) + ' left'}></RoundKicker>}
          {showPrompt && <Prompt>{q.prompt}</Prompt>}
          {q.kind === 'rate' ? (
            <PoleBallot q={q} onPick={(i) => DUELS.answerGroup(g.id, i, r)}></PoleBallot>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }} role="group" aria-label="Who?">
              {q.options.map((o, i) => {
                const id = q.targets[i];
                const mem = id === 'me' ? null : g.members.find((p) => p.id === id);
                return (
                  <button key={id} className="press" onClick={() => DUELS.answerGroup(g.id, i, r)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, minHeight: 56, padding: '8px 12px 8px 10px', borderRadius: 14,
                    border: LINE, background: 'var(--surface-2)', cursor: 'pointer', textAlign: 'left', color: 'inherit', WebkitAppearance: 'none',
                  }}>
                    {mem ? <GDAv p={mem} size={34} plain></GDAv> : <YouChip size={34}></YouChip>}
                    <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o}</span>
                  </button>
                );
              })}
            </div>
          )}
          {closed && <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 600, lineHeight: 1.45, color: 'var(--ink-2)', textWrap: 'pretty' }}>Answering now shows as late and counts for nothing.</div>}
        </div>
      );
    };
    const saidWord = (q) => (q.kind === 'vote' ? 'you named' : 'you said');
    // answered, waiting on the room: who has played, and how long they have
    const waitBlock = () => {
      const r = v.revealed + 1;
      const q = v.q(r), mine = v.mine(r);
      const who = v.who(r);
      return (
        <div style={{ ...col(16), animation: 'popIn .35s cubic-bezier(0.2,0.8,0.2,1)' }} key="wait">
          <RoundKicker r={r} tag={qTag(q)}></RoundKicker>
          <Prompt size={24}>{q.prompt}</Prompt>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>{saidWord(q)}</span>
            <span style={{ fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 19, letterSpacing: -0.3, color: 'var(--ink)' }}>{q.options[mine.a]}</span>
          </div>
          <div style={{ ...col(12), borderTop: HAIR, padding: '16px 0 2px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }} aria-label="Who has played">
              {who.map((p) => <GDAv key={p.id} p={p} size={34} sealed={p.played}></GDAv>)}
              <YouChip size={34}></YouChip>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums', textWrap: 'pretty' }}>
              Reveals when everyone has played · {left(r)} at the latest
            </div>
          </div>
        </div>
      );
    };
    const sealedBlock = () => (
      <SealedList key="sealed"
        title={`${WORDS[v.ahead] || v.ahead} rounds waiting on ${g.name}`}
        line="Each reveals when everyone has played, or at its deadline."
        items={v.sealed.map((r) => {
          const q = v.q(r), m = v.mine(r);
          return { n: r, prompt: q.prompt, dl: left(r), sub: (q.kind === 'vote' ? q.scen.label : 'Rate the group') + ' · ' + saidWord(q) + ' ' + q.options[m.a] };
        })}></SealedList>
    );
    let body;
    if (v.ahead >= 1 && !aheadOpen) {
      body = (
        <div style={col(14)} key="ahead">
          {v.ahead === 1 ? waitBlock() : sealedBlock()}
          {v.open != null && <AheadBtn r={v.open} onClick={() => setAheadOpen(true)}></AheadBtn>}
        </div>
      );
    } else if (v.open != null) {
      body = askBlock(v.open, !(v.openClosed && v.lastRevealed && v.lastRevealed.r === v.open));
    } else {
      body = <div key="lead" style={quiet}>Nothing waiting on you here.</div>;
    }
    // the run: one mark per round, a record — a dot in the pack's colour
    // for a vote, a square for a rating, dotted where you were late
    const top = Math.max(v.myTop, v.theirTop, v.open || 0);
    const marks = [];
    for (let r = 1; r <= top; r++) {
      if (r <= v.revealed) {
        const pk = v.picks(r);
        if (pk.q.kind === 'rate') marks.push({ k: pk.late ? 'l' : 1, sq: true, title: 'rated the group' });
        else marks.push({ k: pk.late ? 'l' : 1, color: scenInk(pk.q.scen), title: pk.q.scen.label + ' · ' + pk.q.role.label });
      } else marks.push(v.mine(r).a != null ? 's' : 'o');
    }
    const caption = (r) => {
      if (r > v.revealed) return `Round ${r} · ` + (v.mine(r).a != null ? 'sealed, waiting for the reveal' : 'open, waiting for you');
      const pk = v.picks(r);
      const who = pk.winner === 'me' ? 'You are' : DUELS.first(DUELS.personOf(pk.winner)) + ' is';
      const what = pk.q.kind === 'rate'
        ? `Rate the group · ${DUELS.stepLabel(pk.q.poles, Math.round(pk.mean))} · ${pk.score}`
        : `${pk.q.scen.label} · ${who} ${pk.q.role.label}${pk.contested ? ' · contested' : ''}`;
      return `Round ${r} · ${what}${pk.late ? ' · you were late' : ''}`;
    };
    return (
      <CardFrame id={g.id} tall={v.open != null && !v.ahead} vh={vh}>
        {head}
        {v.waiting >= 2 && <Band big={`${v.waiting} rounds waiting for you`} sub="each reveals when everyone has played, or at its deadline"></Band>}
        {v.lastRevealed && <GroupRevealBlock picks={v.lastRevealed}></GroupRevealBlock>}
        {v.lastRevealed && <Rule></Rule>}
        {body}
        {marks.length > 0 && (
          <div style={{ ...col(8), borderTop: HAIR, paddingTop: 13 }}>
            <RoundRun marks={marks} score={false} onPick={setCapR} picked={capR}
              aria="The cast so far, one mark per round: a dot in the pack's colour for a vote, a square for a rating. Tap a mark to read it."></RoundRun>
            {capR != null && capR < marks.length && (
              <div className="fade-in" style={{ fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', textWrap: 'pretty' }}>{caption(capR + 1)}</div>
            )}
          </div>
        )}
        {manageSheet}
      </CardFrame>
    );
  }

  function NewGroupSheet({ close, jump }) {
    const [gname, setGname] = useState('');
    const [sel, setSel] = useState([]);
    const friends = DUELS.members();
    const toggleSel = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.concat(id)));
    const canCreate = gname.trim().length > 0 && sel.length >= 2;
    return (
      <React.Fragment>
        <input value={gname} onChange={(e) => setGname(e.target.value)} placeholder="Group name" maxLength={24} autoFocus autoComplete="off" autoCapitalize="words" enterKeyHint="done"
          style={{ width: '100%', boxSizing: 'border-box', border: LINE, borderRadius: 13, background: 'var(--surface-2)', padding: '12px 14px', fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 'var(--field-size)', color: 'var(--ink)', outline: 'none' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="kicker" style={{ marginBottom: 0 }}>Who’s in · pick at least 2</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {friends.map((f) => {
              const on = sel.includes(f.id);
              return (
                <button key={f.id} className="press" onClick={() => toggleSel(f.id)} aria-pressed={on}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, borderRadius: 999, padding: '5px 13px 5px 6px', cursor: 'pointer', WebkitAppearance: 'none', minHeight: 44,
                    border: on ? `1.5px solid ${ACC}` : LINE, background: on ? `color-mix(in oklch, ${ACC} 12%, var(--surface-2))` : 'var(--surface-2)' }}>
                  <GDAv p={f} size={26} plain></GDAv>
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: on ? 800 : 700, fontSize: 12.5, color: 'var(--ink)' }}>{DUELS.first(f)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <button className="press" disabled={!canCreate}
          onClick={() => { const gid = DUELS.createGroup(gname, sel); close(); setTimeout(() => jump(gid), 300); }}
          style={{ border: 'none', borderRadius: 999, padding: '12px 20px', minHeight: 48, cursor: canCreate ? 'pointer' : 'default', WebkitAppearance: 'none',
            fontFamily: 'var(--sans)', fontWeight: 800, fontSize: 14.5,
            background: canCreate ? 'var(--ink)' : 'var(--surface-3)', color: canCreate ? 'var(--surface)' : 'var(--ink-3)', transition: 'background .15s, color .15s' }}>
          {canCreate ? 'Create · invites go out now' : sel.length < 2 ? 'Pick at least 2 people' : 'Name your group'}
        </button>
      </React.Fragment>
    );
  }

  function GroupDailyBody() {
    const [, bump] = useReducer((x) => x + 1, 0);
    useEffect(() => DUELS.subscribe(bump), []);
    const gs = DUELS.groups();
    return (
      <RoundStack items={gs} isPending={(g) => !g.done} acc={ACC}
        rail={{ square: true, mark: (g) => <GDMark g={g} size={38}></GDMark>, label: (g) => g.name, state: (g) => (g.done ? null : 'pending'), addLabel: 'Create a group' }}
        renderCard={(g, vh) => <GroupCard key={g.id} g={g} vh={vh}></GroupCard>}
        sheet={{ title: 'New group', sub: 'a role a round, revealed with names', gap: 13, Body: NewGroupSheet }}
        cueMode="group"></RoundStack>
    );
  }

  Object.assign(EXPORTS, {
    GroupDailyBody, GDAv, GDMark, GDScenInk: scenInk, YouChip, OpenSeat, SealMark,
    RoundRun, RoundKicker, SealedList, AheadBtn, OptBtn, PoleBallot,
    RoundPrompt: Prompt, RoundSmallPrompt: SmallPrompt, RoundBand: Band, RoundRule: Rule, RoundQuiet: quiet,
    RoundStack, CardFrame, CardHead, RoundSheet, SheetFoot, useSheet,
  });
})();
export const {
  GroupDailyBody, GDAv, GDMark, GDScenInk, YouChip, OpenSeat, SealMark,
  RoundRun, RoundKicker, SealedList, AheadBtn, OptBtn, PoleBallot,
  RoundPrompt, RoundSmallPrompt, RoundBand, RoundRule, RoundQuiet,
  RoundStack, CardFrame, CardHead, RoundSheet, SheetFoot, useSheet,
} = EXPORTS;

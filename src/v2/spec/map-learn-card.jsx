// Ported from design/InSight_standalone_15.html (map-learn-card.jsx, 2026-07-31
// revision). THIS file is the live source now, hand-edits and all.
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import LIVE from '../data/live.ts';
import { LEARN_RATE } from './learn-data.js';
import { LEARN } from './learn-progress.js';

// map-learn-card.jsx — the two cards the map shows for knowledge, as opposed to
// opinion. An opinion node answers "what do you think, and who agrees"; a
// knowledge node answers "what do you know, and how many people don't". So the
// card carries one bar — the share of the crowd who get this right — and nothing
// else. If you had to earn it back from a miss, three filled dots say so.

function MTLearnCard({ node }) {
  const card = node.cid ? LEARN.card(node.cid) : null;
  if (!card) return null;
  const f = LEARN.field(card.f);
  const s = f ? LEARN.subject(f.subject) : null;
  const st = LEARN.stateOf(card.id) || {};
  const earned = (st.miss || 0) > 0;
  // D132: the bar and the sentence used to read `card.p` \u2014 the authored
  // difficulty hint \u2014 and print it as a measurement. LEARN_RATE returns the
  // real first-attempt rate where one has been published and says which it
  // handed back, so the estimate can be labelled here the way the feed's
  // reveal already labels it.
  const rate = LEARN_RATE(card);
  const est = rate.src === 'estimate';
  return (
    <div style={{ '--hue': s ? s.hue : 250 }}>
      <div className="mmt-kicker"><span className="mmt-dot"></span>{(s ? s.label + ' \u00b7 ' : '') + (f ? f.label : '')}</div>
      <div className="mmt-title" style={{ marginTop: 4 }}>{card.k}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
        <div style={{ position: 'relative', height: 8, borderRadius: 99, background: 'color-mix(in oklch, var(--surface-3), transparent 25%)', overflow: 'hidden' }}>
          <i style={{ position: 'absolute', inset: '0 auto 0 0', width: rate.pct + '%', borderRadius: 99, background: 'oklch(0.52 0.14 var(--hue))', opacity: est ? 0.55 : 1 }}></i>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* "about" carries the hedge in the sentence itself, so the number
              is never alone on the screen making a claim it cannot support.
              Only in live mode: a demo build's whole population is authored,
              and hedging one figure inside it would imply the rest are
              measured. */}
          <span style={{ flex: 1, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
            {est && LIVE.enabled
              ? 'about ' + rate.pct + '% get this right \u2014 our estimate'
              : rate.pct + '% of people get this right'}
          </span>
          {earned && window.LMStreak ? <window.LMStreak k={3} of={3} col={'oklch(0.52 0.14 ' + (s ? s.hue : 250) + ')'}></window.LMStreak> : null}
        </div>
      </div>
    </div>
  );
}

// a field you hold part of — the arc, then the facts themselves
function MTLearnSubCard({ node, rows, onPick }) {
  const f = node.fid ? LEARN.field(node.fid) : null;
  const s = f ? LEARN.subject(f.subject) : null;
  const stats = f ? LEARN.stats(f.id) : { known: 0, total: 0 };
  const col = 'oklch(0.52 0.14 ' + (s ? s.hue : 250) + ')';
  return (
    <div style={{ '--hue': s ? s.hue : 250 }}>
      <div className="mmt-slim">
        {/* the prototype guards on window.LMArc here, but no module ever
            defines it — the fallback dot is the branch that always renders,
            so the dead guard is dropped (check:globals rightly flags it) */}
        <span className="mmt-dot"></span>
        <span className="mmt-slim-name">{(s ? s.label + ' \u00b7 ' : '') + (f ? f.label : node.label)}</span>
        <span className="mmt-slim-ct">{stats.known}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
        {rows.map((r) => (
          <button key={r.id} onClick={() => onPick && onPick(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '10px 2px', border: 'none', borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 30%)', background: 'none', cursor: 'pointer', WebkitAppearance: 'none' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: col, flexShrink: 0 }}></span>
            <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)' }}>{r.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { MTLearnCard, MTLearnSubCard });

;globalThis.MTLearnCard = typeof MTLearnCard === 'undefined' ? globalThis.MTLearnCard : MTLearnCard;
;globalThis.MTLearnSubCard = typeof MTLearnSubCard === 'undefined' ? globalThis.MTLearnSubCard : MTLearnSubCard;

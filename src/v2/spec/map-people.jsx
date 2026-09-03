// Ported from design/spec-modules/map-people.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { ReadRun } from './read-run.jsx';
import { DUELS } from './duels-data.js';
import { Kicker } from './primitives.jsx';
import NAV from '../data/nav';

// map-people.jsx — how you and your circle read each other in the daily
// duels. Lives on the CIRCLE stop (a lens card under the relationship map),
// not on the You map — the You map is answers only.
const EXPORTS = {};
(function () {
  const PEOPLE_CAT = { id: 'circle-read', label: 'People', hue: 28 };

  const first = (name) => String(name).split(' ')[0];

  // same rule as everywhere else: the span picks the encoding
  function MPRun({ days, color }) {
    return <ReadRun days={days} color={color || 'var(--c-likeness)'} size={9}></ReadRun>;
  }
  const dotsFor = (pid, total, key) => {
    return Array.from({ length: total }, (_, i) => DUELS.duoDay(pid, total - i)[key]);
  };

  // ── branch card: both directions of knowing ────────────────────────────────
  function MTPeopleCard({ onPick }) {
    const ps = DUELS.partners().filter((p) => p.read.total > 0);
    const gaps = DUELS.impressions().slice(0, 2);
    const al = DUELS.groupAlignment();
    return (
      <div style={{ '--hue': PEOPLE_CAT.hue }}>
        <div className="mmt-slim">
          <span className="mmt-dot"></span>
          <span className="mmt-slim-name">People</span>
          <span className="mmt-slim-ct">{ps.length}</span>
        </div>
        <div className="mmt-gwho">how you read them</div>
        <div className="mpc-rows">
          {ps.map((p) => (
            <button key={p.id} className="mpc-row" onClick={() => onPick('pp-' + p.id)}>
              <span className="mpc-av" style={{ '--phue': p.hue }}>{p.init}</span>
              <span className="mpc-name">{first(p.name)}</span>
              <MPRun days={dotsFor(p.id, p.read.total, 'readRight')}></MPRun>
            </button>
          ))}
        </div>
        <div className="mmt-gwho">how they read you</div>
        {gaps.length ? (
          <div className="mpc-gaps">
            {gaps.map((g, i) => (
              <div key={i} className="mpc-gap">
                {first(g.name)} guessed <b>{g.guessed}</b> — you picked <b>{g.actual}</b>
              </div>
            ))}
          </div>
        ) : (
          <div className="mpc-gap">No misses yet — your circle calls your picks.</div>
        )}
        {al.total > 0 && (
          <div className="mpc-align">with your group's majority {al.withMaj} of {al.total} days</div>
        )}
      </div>
    );
  }

  // ── person card: one relationship, both directions ─────────────────────────
  function MTPersonCard({ node }) {
    const p = DUELS.partners().find((x) => x.id === node.pid);
    if (!p) return null;
    const gap = p.misses.length ? p.misses[0] : null;
    return (
      <div style={{ '--hue': PEOPLE_CAT.hue }}>
        <div className="mmt-kicker"><span className="mmt-dot"></span>People · {p.rel}</div>
        <div className="mmt-title">{first(p.name)}</div>
        <div className="mpc-pair">
          <div className="mpc-side">
            <span className="mpc-lab">you read them</span>
            <MPRun days={dotsFor(p.id, p.read.total, 'readRight')}></MPRun>
          </div>
          <div className="mpc-side">
            <span className="mpc-lab">they read you</span>
            <MPRun days={dotsFor(p.id, p.readBy.total, 'byRight')} color="var(--c-people)"></MPRun>
          </div>
        </div>
        {gap && (
          <div className="mpc-gap">Sees you as <b>{gap.guessed}</b> — you pick <b>{gap.actual}</b>.</div>
        )}
        <div className="mpc-foot">
          {p.streak > 0 && <span className="mpc-align">{p.streak}-day run</span>}
          <button className="mpc-open" onClick={() => NAV.openPerson(p.id)}>open profile →</button>
        </div>
      </div>
    );
  }

  // ── circle lens card: both directions of knowing, under the relationship map ──
  function CircleReadCard() {
    const [, bump] = React.useReducer((x) => x + 1, 0);
    React.useEffect(() => DUELS.subscribe(bump), []);
    const ps = DUELS.partners().filter((p) => p.read.total > 0);
    if (!ps.length) return null;
    const gaps = DUELS.impressions().slice(0, 2);
    const al = DUELS.groupAlignment();
    return (
      <div className="card" style={{ marginBottom: 14, '--hue': PEOPLE_CAT.hue }}>
        <Kicker>Daily duels</Kicker>
        <div className="mmt-gwho">how you read them</div>
        <div className="mpc-rows">
          {ps.map((p) => (
            <button key={p.id} className="mpc-row" onClick={() => NAV.openPerson(p.id)}>
              <span className="mpc-av" style={{ '--phue': p.hue }}>{p.init}</span>
              <span className="mpc-name">{first(p.name)}</span>
              <MPRun days={dotsFor(p.id, p.read.total, 'readRight')}></MPRun>
            </button>
          ))}
        </div>
        <div className="mmt-gwho">how they read you</div>
        {gaps.length ? (
          <div className="mpc-gaps">
            {gaps.map((g, i) => (
              <div key={i} className="mpc-gap">{first(g.name)} guessed <b>{g.guessed}</b> — you picked <b>{g.actual}</b></div>
            ))}
          </div>
        ) : (
          <div className="mpc-gap">No misses yet — your circle calls your picks.</div>
        )}
        {al.total > 0 && (
          <div className="mpc-align">with your group's majority {al.withMaj} of {al.total} days</div>
        )}
      </div>
    );
  }

  Object.assign(EXPORTS, { MTPeopleCard, MTPersonCard, CircleReadCard });
})();
export const { MTPeopleCard, MTPersonCard, CircleReadCard } = EXPORTS;


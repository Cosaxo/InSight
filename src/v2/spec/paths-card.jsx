// paths-card.jsx — CROSSROADS in the feed (paths-data.js). Walk a story three
// forks deep; the reveal is the whole tree — the crowd's flow through every
// branch, your road inked, your ending named, and how rare the walk was.
//
// Ported from the standalone_23 prototype. Named exports and imports, not
// `window.PathsCard` and `window.PATHS`: check:globals rule 4 counts every
// cross-module shared-global reference and the count may only go down
// (D39), so this module and its store are wired by the ESM graph.
//
// THE CSS FAMILY WAS RENAMED, and the rename is the point rather than
// taste. The prototype draws this card's head, title, rule, chips and
// footer button with `.ar-*` — the class family of an "Arena" card that
// exists in neither tree, and whose `--ar-c`/`--ar-ink` variables this card
// never sets (it sets `--pp-*` and overrides the colour at every site
// inline). Importing that namespace would land six rules under a prefix
// with no owner here, styled by variables nothing defines. They arrive as
// `.pp-*` instead: same pixels, one family, no orphan.
import React from 'react';
import { PATHS } from './paths-data.js';
import { WPAL } from './world-palette.js';
import { HAPTIC } from './haptics.js';

const ppC = (h) => WPAL.c(`oklch(0.52 0.14 ${h})`);
const ppInk = (h) => WPAL.ink(`oklch(0.52 0.14 ${h})`);

// The whole tree: eight roads, every branch's width its share of the crowd,
// yours inked through it. Drawn for both the walking and the finished state
// — `walk` is a prefix, so a partial road highlights what you have chosen
// so far and the rest of the tree stays as context.
function PathsTree({ st, walk }) {
  const W = 372, H = 236, xs = [16, 128, 240, 352];
  const yOf = (key) => {
    const d = key.length; if (!d) return H / 2;
    let idx = 0; for (const ch of key) idx = idx * 2 + (ch === 'B' ? 1 : 0);
    return (idx + 0.5) * (H / Math.pow(2, d));
  };
  const keys = [];
  ['A', 'B'].forEach((a) => { keys.push(a); ['A', 'B'].forEach((b) => { keys.push(a + b); ['A', 'B'].forEach((c) => keys.push(a + b + c)); }); });
  const end = st.endings[walk];
  return (
    <svg className="pp-svg" viewBox={`0 0 ${W} ${H}`} style={{ marginTop: 14 }} role="img"
      aria-label={end ? `Your road through ${st.title}, ending at ${end.name}` : `The eight roads through ${st.title}`}>
      {keys.map((k) => {
        const x1 = xs[k.length - 1], y1 = yOf(k.slice(0, -1)), x2 = xs[k.length], y2 = yOf(k);
        const mx = (x1 + x2) / 2;
        const f = PATHS.flowOf(st.id, k);
        const on = walk.startsWith(k);
        return <path key={k} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} fill="none"
          stroke={on ? 'var(--pp-ink)' : 'color-mix(in oklch, var(--pp-c), var(--surface) 56%)'}
          strokeWidth={Math.max(1.4, f * 20)} strokeLinecap="round" opacity={on ? 1 : 0.9}></path>;
      })}
      <circle cx={xs[0]} cy={H / 2} r="4.5" fill="var(--pp-ink)"></circle>
      {keys.filter((k) => k.length === 3).map((k) => (
        <circle key={k} cx={xs[3]} cy={yOf(k)} r={k === walk ? 5 : 2.6} fill={k === walk ? 'var(--pp-ink)' : 'color-mix(in oklch, var(--pp-c), var(--surface) 40%)'}></circle>
      ))}
      {end && <text x={xs[3] - 10} y={yOf(walk) + (yOf(walk) < 18 ? 14 : -9)} textAnchor="end" fontSize="10.5" fontWeight="800" fill="var(--pp-ink)">{end.name}</text>}
    </svg>
  );
}

export function PathsCard() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => PATHS.sub(force), []);
  const stories = PATHS.stories();
  const [sid] = React.useState(stories[0].id);
  const st = PATHS.storyOf(sid);
  const walk = PATHS.walkOf(sid);
  const done = walk.length >= 3;
  const node = done ? null : st.nodes[walk];
  const end = done ? st.endings[walk] : null;
  const flow = done ? PATHS.flowOf(sid, walk) : 0;
  const style = { '--pp-c': ppC(st.hue), '--pp-ink': ppInk(st.hue) };
  return (
    <div className="card" style={style}>
      <div className="pp-head">
        <span className="pp-kick" style={{ color: 'var(--pp-ink)' }}>Crossroads</span>
        {/* Three steps, drawn not written: the count is small enough that a
            numeral would be the louder thing on a card whose subject is a
            story. */}
        <span className="pp-steps" role="img" aria-label={`Fork ${Math.min(walk.length + 1, 3)} of 3`}>
          {[0, 1, 2].map((i) => <i key={i} className={i < walk.length ? 'on' : ''}></i>)}
        </span>
      </div>
      <div className="pp-name">{st.title}</div>
      {!done && (
        <>
          <div className="pp-rule">{walk ? node.q : st.intro}</div>
          {!walk && <div className="pp-q">{node.q}</div>}
          <div className="pp-choices">
            {node.a.map((c, i) => (
              <button key={i} className="pp-choice" onClick={() => { HAPTIC.tick(); PATHS.choose(sid, i); }}>{c.t}</button>
            ))}
          </div>
        </>
      )}
      {done && (
        <>
          <PathsTree st={st} walk={walk}></PathsTree>
          <div className="pp-end">
            <b>{end.name}</b>
            <div className="pp-line">{end.line}</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
              <span className="pp-chip">you and {Math.round(flow * 100)}% ended here</span>
              <span className="pp-chip">1 in {Math.max(2, Math.round(1 / flow))} walks your road</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pp-again" onClick={() => { HAPTIC.tick(); PATHS.reset(sid); }}>Walk again</button>
          </div>
        </>
      )}
    </div>
  );
}

export default PathsCard;

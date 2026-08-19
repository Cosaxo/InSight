// paths-card.jsx — CROSSROADS in the feed (paths-data.js). Walk a story three
// forks deep; the reveal is the whole tree — the crowd's flow through every
// branch, your road inked, your ending named, and how rare the walk was.
//
// Ported from the standalone_23 prototype. Named exports and imports, not
// `window.PathsCard` and `window.PATHS`: check:globals rule 4 counts every
// cross-module shared-global reference and the count may only go down
// (D39), so this module and its store are wired by the ESM graph.
//
// TWO SOURCES, ONE CARD (D136). Live, a story is an ordinary bank question
// whose eight ENDINGS are its options: a finished walk stores as an
// optionIdx 0..7 through the same vote path every other card uses, and a
// branch's share is the summed counts of the endings beneath it. Demo, the
// story comes from paths-data.js and its branch shares are authored. The
// card reads whichever it has and NEVER mixes them — `srcOf` returns one
// shape, and the only thing that differs downstream is where `flow` comes
// from and whether a choice writes to the server.
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
import LIVE from '../data/live.ts';

// The eight endings, in the order the bank's synthesized options are in —
// so index 3 is 'ABB' is `options[3]` is whatever the voters panel prints.
// DERIVED rather than written out, for the reason gen-v2content.mjs and
// question-quality.mjs both derive it: this constant has to be identical in
// three modules that do not share one, and two evaluations of this
// expression cannot disagree while two transcriptions of a literal can.
const PATH_ENDINGS = ['A', 'B'].flatMap((a) => ['A', 'B'].flatMap((b) => ['A', 'B'].map((c) => a + b + c)));

// The opening fork's key. A walk is a string of choices and the opening is
// the empty one, which is what `nodes` would like to be keyed by — but
// Firestore refuses an empty map key, so the bank (and the demo store, to
// match) carries a sentinel and every reader maps through here. See
// PATH_ROOT in scripts/question-quality.mjs for the failure that found it.
const nodeAt = (nodes, walk) => nodes[walk || '_'];

const ppC = (h) => WPAL.c(`oklch(0.52 0.14 ${h})`);
const ppInk = (h) => WPAL.ink(`oklch(0.52 0.14 ${h})`);

// The whole tree: eight roads, every branch's width its share of the crowd,
// yours inked through it. Drawn for both the walking and the finished state
// — `walk` is a prefix, so a partial road highlights what you have chosen
// so far and the rest of the tree stays as context.
//
// `flow` is a parameter rather than a call into the store, because the two
// sources compute it differently and a component that reached for one of
// them would be right in exactly one mode.
function PathsTree({ st, walk, flow }) {
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
        const f = flow(k);
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

/**
 * The one story this card is showing, in one shape, from whichever source
 * exists — plus how to read the crowd out of it.
 *
 * `flow(key)` is the share of people standing at `key`. Live it is real:
 * the endings under that branch over the total. Demo it is the product of
 * the authored shares above it. `flow` is NULL when a live story has no
 * answers yet — the card draws the walk without a tree rather than
 * dividing by zero, because "every branch is 0% wide" is not a truthful
 * picture of an empty question.
 */
function srcOf(live) {
  if (live) {
    // The bank doc as it stands, plus its per-ending counts. `total` is
    // summed here rather than carried on the doc: the store folds the counts
    // on call (see LIVE.pathQs) and one more field would be one more thing
    // for the two sides to disagree about.
    const counts = live.counts || [];
    const total = counts.reduce((a, b) => a + b, 0);
    return {
      id: live.id,
      title: live.title || live.prompt,
      intro: live.intro || '',
      hue: typeof live.hue === 'number' ? live.hue : 20,
      nodes: live.nodes || {}, endings: live.endings || {}, live: true,
      flow: total > 0
        ? (key) => PATH_ENDINGS.reduce((s, e, i) => s + (e.startsWith(key) ? counts[i] : 0), 0) / total
        : null,
      total,
    };
  }
  const st = PATHS.stories()[0];
  return {
    id: st.id, title: st.title, intro: st.intro, hue: st.hue,
    nodes: st.nodes, endings: st.endings, live: false,
    flow: (key) => PATHS.flowOf(st.id, key),
    total: 0,
  };
}

export function PathsCard() {
  const [, force] = React.useReducer((x) => x + 1, 0);
  React.useEffect(() => PATHS.sub(force), []);

  // Walking a road again over a standing answer. Live only, and it exists
  // because the two records disagree on purpose for the length of the walk:
  // clearing the local walk cannot clear the SERVER's ending, so without
  // this flag `answered` below would put the finished tree straight back
  // and "Walk again" would do nothing visible.
  const [rewalk, setRewalk] = React.useState(false);

  const live = LIVE.pathQs ? (LIVE.pathQs()[0] || null) : null;
  const st = srcOf(live);

  // Where the walk lives. Demo: the local store, which is the only record.
  // Live: the SERVER's answer is the record once a walk is finished — so a
  // returning device with no localStorage still sees its own ending — while
  // the local store carries the half-finished walk, which is not an answer
  // yet and has nowhere else to be.
  const localWalk = PATHS.walkOf(st.id);
  const mine = live && LIVE.myVotes ? LIVE.myVotes()[live.id] : null;
  const answered = mine != null ? (PATH_ENDINGS[Number(mine)] || '') : '';
  const walk = rewalk ? localWalk : (answered || localWalk);
  const done = walk.length >= 3;

  const node = done ? null : nodeAt(st.nodes, walk);
  const end = done ? st.endings[walk] : null;
  const flow = st.flow;
  const myShare = done && flow ? flow(walk) : 0;

  function choose(i) {
    HAPTIC.tick();
    const next = PATHS.choose(st.id, i);
    // The third fork is the answer. Live, that is when it goes to the
    // server — through the ordinary vote path, so the fold, the ledger, the
    // by-cells and the voters panel all carry it with no special case. A
    // second finished walk after "Walk again" is a D86 EDIT of the same
    // answer, not a new one: you moved where you ended up.
    if (!live || next.length < 3) return;
    const idx = PATH_ENDINGS.indexOf(next);
    if (idx < 0) return;
    const prior = LIVE.myVotes ? LIVE.myVotes()[live.id] : null;
    if (prior == null) {
      if (LIVE.vote) LIVE.vote(live.id, String(idx));
    } else if (Number(prior) !== idx && !(LIVE.editVote && LIVE.editVote(live.id, String(idx)))) {
      // A refused edit (D86's 60s cooldown) leaves the standing answer as
      // the record, so drop the local walk and fall back to it — the same
      // snap-back setDial does with a bucket. Showing the walk the server
      // refused would be showing an answer nobody stored.
      PATHS.reset(st.id);
    }
    // Either way the walk is finished and the server owns it again.
    setRewalk(false);
  }

  function again() {
    HAPTIC.tick();
    PATHS.reset(st.id);
    setRewalk(true);
  }

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
              <button key={i} className="pp-choice" onClick={() => choose(i)}>{c.t}</button>
            ))}
          </div>
        </>
      )}
      {done && (
        <>
          {flow
            ? <PathsTree st={st} walk={walk} flow={flow}></PathsTree>
            : (
              // A live story nobody has finished yet. The walk still landed
              // and the ending is still yours; what is missing is the crowd,
              // and an empty tree drawn at zero width would say "nobody went
              // anywhere" rather than "nobody has been here yet".
              <div className="pp-rule" style={{ marginTop: 14 }}>
                You are the first to reach the end of this one.
              </div>
            )}
          <div className="pp-end">
            <b>{end.name}</b>
            <div className="pp-line">{end.line}</div>
            {flow && (
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 9 }}>
                <span className="pp-chip">you and {Math.round(myShare * 100)}% ended here</span>
                <span className="pp-chip">1 in {Math.max(2, Math.round(1 / myShare))} walks your road</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pp-again" onClick={again}>Walk again</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── the Map's Crossroads branch (v28 §5, D202) ─────────────────────────
//
// paths-data.js's header note #2 recorded why mapTree stayed unbuilt: the
// eager map had no room and reading the store off the bridge would spend
// the ratchet. D202 moved both budgets — the Map is lazy and this file is
// an import away — so the fold lives HERE rather than in the store,
// because it needs this card's live/demo source discipline (srcOf): live,
// a finished walk is the SERVER's answer (recoverable on any device) and
// the crowd share folds from real counts or is ABSENT; demo, both come
// authored. `typ` carries the walk's rarity, so an uncommon road drifts
// to the map's edge with no number printed.
const walkFor = (sid) => {
  if (LIVE.enabled && LIVE.myVotes) {
    const mine = LIVE.myVotes()[sid];
    if (mine != null) return PATH_ENDINGS[Number(mine)] || '';
  }
  return PATHS.walkOf(sid);
};
const demoSrc = (d) => ({
  id: d.id, title: d.title, hue: d.hue, nodes: d.nodes, endings: d.endings,
  flow: (key) => PATHS.flowOf(d.id, key),
});

export function pathsMapTree() {
  const srcs = LIVE.enabled
    ? (LIVE.pathQs ? LIVE.pathQs() : []).map((q) => srcOf(q))
    : PATHS.stories().map(demoSrc);
  const done = srcs.map((s) => ({ s, w: walkFor(s.id) })).filter((x) => x.w.length >= 3);
  if (!done.length) return { cats: [], nodes: [] };
  const cats = [{ id: 'path-walks', label: 'Walks', hue: 200, walk: true }];
  const nodes = done.map(({ s, w }, i) => {
    const end = s.endings[w] || {};
    const f = s.flow ? s.flow(w) : null;
    return {
      id: 'path-' + s.id, parentId: 'path-walks', walk: true, daily: true, sid: s.id,
      label: s.title + ' → ' + (end.name || ''), tag: s.title, ans: end.name || '', prompt: s.title,
      // no flow (a live story nobody has answered into yet) → no rarity
      // claim, same rule as the card's own tree
      note: f ? '1 in ' + Math.max(2, Math.round(1 / f)) : '',
      age: i, typ: f == null ? 0.5 : Math.max(0.05, Math.min(0.95, f * 2)), maj: false,
    };
  });
  return { cats, nodes };
}

// the Map's Crossroads leaf: the walked road, small — tree, ending, rarity
export function MTPathsCard({ node }) {
  let st = null;
  if (LIVE.enabled) {
    const q = LIVE.pathQs ? LIVE.pathQs().find((x) => x.id === node.sid) : null;
    if (q) st = srcOf(q);
  } else {
    const d = PATHS.storyOf(node.sid);
    if (d) st = demoSrc(d);
  }
  if (!st) return null;
  const walk = walkFor(st.id);
  if (walk.length < 3) return null;
  const end = st.endings[walk] || {};
  const f = st.flow ? st.flow(walk) : null;
  return (
    <div style={{ '--pp-c': ppC(st.hue), '--pp-ink': ppInk(st.hue), '--hue': st.hue }}>
      <div className="mmt-kicker"><span className="mmt-dot"></span>Crossroads</div>
      <div className="mmt-title" style={{ marginTop: 4 }}>{st.title}</div>
      {/* the tree needs a flow to draw branch widths — absent means the
          walk shows as its ending alone rather than a tree of invented
          widths (srcOf's own rule) */}
      {st.flow ? <PathsTree st={st} walk={walk} flow={st.flow}></PathsTree> : null}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 6, flexWrap: 'wrap' }}>
        <b style={{ fontFamily: 'var(--sans)', fontSize: 14.5, color: 'var(--ink)' }}>{end.name || ''}</b>
        {f ? (
          <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
            1 in {Math.max(2, Math.round(1 / f))} walks this road
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default PathsCard;

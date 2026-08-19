// Ported from design/spec-modules/map-bottom-card.jsx (the historical prototype — no sync
// script survives; THIS file is the live source now, hand-edits and all).
// Cross-module references resolve through the shared global scope and
// spec-index.js load order is semantic — scripts/check-spec-globals.mjs
// guards the wiring in CI.
import React from 'react';
import { IS_TESTS, IS_TEST_RESULTS } from './test-definitions.js';

// InSight — Map tab bottom card. Group-comparison model:
//  · answer card — pick one of the 7 profile filters (chips), see how that
//    group answered as horizontal % bars, your pick marked.
//  · anchor card — for each question, the group's most common answer vs
//    yours, plus a match headline.

// options → number of options for stats (rating = 10)
function mtNOpts(node) { return node.qtype === 'rating' ? 10 : (node.opts ? node.opts.length : 2); }
function mtOptLabel(node, i) { return node.qtype === 'rating' ? (i + 1) + '/10' : (node.opts ? node.opts[i] : '—'); }

// ── filter chips: the 7 profile facts ───────────────────────────────────────
function MTFilterChips({ anchors, activeA, onPick }) {
  return (
    <div className="mmt-fchips">
      {anchors.map((a) => (
        <button
          key={a.id}
          className={'mmt-fchip' + (activeA === a.id ? ' is-on' : '')}
          onClick={() => onPick(a.id)}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

// your own value for an anchor — an age band for Age, the profile value for
// Work/Study, the strongest trait for a test. Makes "people like you" concrete.
function mtAnchorSelf(anchor) {
  if (!anchor) return '';
  if (anchor.id === 'age') {
    const a = parseInt(String(anchor.value).replace(/\D/g, ''), 10);
    if (a) { const lo = Math.floor(a / 10) * 10; return lo + '–' + (lo + 9); }
    return anchor.value;
  }
  if (anchor.id === 'job' || anchor.id === 'edu') return anchor.value;
  return String(anchor.value || '').split('·')[0].trim(); // tests: strongest trait
}

// ── the verdict — the one thing that matters: are you with them or not? ─────
function MTVerdict({ pct, who, self, isMode }) {
  return (
    <div className={'mmt-verdict' + (isMode ? ' is-maj' : ' is-min')}>
      <span className="mmt-matchpct">{pct}%</span>
      <span className="mmt-matchtext">
        <b>{isMode ? 'You’re with the majority' : 'A minority take'}</b>
        <span>of {who} chose the same{self ? ' · you: ' + self : ''}</span>
      </span>
    </div>
  );
}

// ── the honest state — live mode has no cohort behind a Map answer ─────────
// MapStats refuses in live mode (D72), so every number this card used to draw
// is gone rather than wrong. Say what is missing and why, the way the feed's
// below-floor branch does (world-feed.jsx renderStats) — the answer itself is
// real and stays on the map, which is the part worth stating.
function MTNoCohort({ who }) {
  return (
    <div className="mmt-nocohort">
      Your answer is on the map. How {who} answered isn’t measured yet —
      it needs more people on this question first.
    </div>
  );
}

// ── group answer viz — daily-style stacked bar, your slice colored ─────────
function MTGroupBars({ node, anchor }) {
  const n = mtNOpts(node);
  const d = window.MapStats.dist(node.qid, anchor.id, n, node.aidx);
  const who = window.MapStats.groupLabel(anchor.id);
  if (!d) return <MTNoCohort who={who}></MTNoCohort>;
  const max = Math.max(...d);
  const self = mtAnchorSelf(anchor);
  const gmode = d.indexOf(max);
  const isMode = gmode === node.aidx;
  // rating → too many rows; show the group's full spread as a small ridge
  if (node.qtype === 'rating') {
    const you = node.aidx;
    const youMid = ((you + 0.5) / n) * 100;
    return (
      <div>
        <MTVerdict pct={d[you]} who={who} self={self} isMode={isMode}></MTVerdict>
        <div className="mmt-ridge">
          <span className="mmt-ridge-youlab" style={{ left: Math.max(9, Math.min(91, youMid)) + '%' }}>you · {you + 1}</span>
          <div className="mmt-ridge-cols">
            {d.map((p, i) => (
              <span key={i} className={'mmt-ridge-col' + (i === you ? ' is-you' : '') + (i === gmode && gmode !== you ? ' is-peak' : '')}>
                <i style={{ height: Math.max(7, (p / max) * 100) + '%' }}></i>
              </span>
            ))}
          </div>
          <div className="mmt-ridge-foot">
            <span>1</span>
            {gmode !== you ? <span className="mmt-ridge-peaklab">most chose {gmode + 1}</span> : null}
            <span>10</span>
          </div>
        </div>
      </div>
    );
  }
  // marker positions — centre of each named slice across the whole bar
  const total = d.reduce((a, b) => a + b, 0) || 100;
  const center = (idx) => { let c = 0; for (let i = 0; i < idx; i++) c += d[i]; return ((c + d[idx] / 2) / total) * 100; };
  // labels below name every slice, in bar order — yours and the majority's stand out
  const labIdx = d.map((_, i) => i);
  return (
    <div>
      <MTVerdict pct={d[node.aidx]} who={who} self={self} isMode={isMode}></MTVerdict>
      <div className="mmt-dbar-wrap">
        <span className="mmt-dbar-mark is-you" style={{ left: center(node.aidx) + '%' }}>you</span>
        {!isMode ? <span className="mmt-dbar-mark is-most" style={{ left: center(gmode) + '%' }}>most</span> : null}
        <div className="mmt-dbar">
          {d.map((p, i) => (
            <span key={i} className={'mmt-dbar-seg' + (i === node.aidx ? ' is-you' : '') + (i === gmode && !isMode ? ' is-mode' : '')} style={{ flexGrow: Math.max(p, 1.2) }}></span>
          ))}
        </div>
      </div>
      <div className="mmt-dbar-labs">
        {labIdx.map((i) => (
          <span key={i} className={'mmt-dbar-lab' + (i === node.aidx ? ' is-you' : i === gmode ? ' is-most' : '')}>
            <b>{mtOptLabel(node, i)}</b>
            <em>{Math.round(d[i])}%</em>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── answer card: question · your answer · “compare with” chips · group bars ──
// ── answer body: question · “compare with” chips · group bars ──
function MTAnswerBody({ node, anchors, activeA, onFilter }) {
  const A = anchors.find((a) => a.id === activeA) || anchors[0];
  return (
    <React.Fragment>
      <div className="mmt-q">{node.prompt}</div>
      <MTFilterChips anchors={anchors} activeA={A.id} onPick={onFilter}></MTFilterChips>
      <MTGroupBars node={node} anchor={A} key={A.id + node.id}></MTGroupBars>
    </React.Fragment>
  );
}

// ── answer card: kicker + body ──
function MTAnswerCard({ node, cat, anchors, activeA, onFilter }) {
  return (
    <div style={{ '--hue': cat ? cat.hue : 282 }}>
      <div className="mmt-kicker"><span className="mmt-dot"></span>{cat ? cat.label : 'answer'} · {node.note}</div>
      <MTAnswerBody node={node} anchors={anchors} activeA={activeA} onFilter={onFilter}></MTAnswerBody>
    </div>
  );
}

// ── your actual stat for this anchor — shown before the group breakdown ─────
// tests → score bars; profile facts (age · work · study) → one big value.
// Bar rows are a scope selector: pick one axis and the whole comparison below
// (match % + differ list) recomputes against people who match you on just it.
function mtDimEnds(testKey, dimId) {
  const T = IS_TESTS[testKey];
  const d = T && T.dims ? T.dims.find((x) => x.id === dimId) : null;
  if (d && d.blurb && d.blurb.includes('←→')) return d.blurb.split('←→').map((s) => s.trim());
  return null;
}

function MTAnchorStat({ anchor, openDim, onDim }) {
  const R = IS_TEST_RESULTS[anchor.id];
  if (R && R.dims) {
    // Resolved once, ahead of the rows, so the legend can ask whether a
    // "them" series exists without a second call into MapStats — a second
    // call site is also a second thing to forget when this gate moves.
    const them = R.dims.map((d) => window.MapStats.dimVal(anchor.id, d.id, d.value));
    const hasThem = them.some((v) => v != null);
    return (
      <div className="mmt-astat">
        {R.dims.map((d, di) => {
          const isOpen = openDim === d.id;
          // null in live mode (D72). Your own score is a real measurement and
          // stays; the "them" marker beside it was a hash, so it goes — and
          // the legend below loses its second key with it, or it would name a
          // series that is not drawn.
          const gv = them[di];
          const ends = mtDimEnds(anchor.id, d.id);
          return (
            <div key={d.id} className={'mmt-astat-item' + (isOpen ? ' is-open' : '')}>
              <button className="mmt-astat-row" onClick={() => onDim(isOpen ? null : d.id)}>
                <span className="mmt-astat-lab">{d.label}</span>
                <span className="mmt-astat-bar">
                  <i style={{ width: d.value + '%' }}></i>
                  {gv != null ? <b className="mmt-astat-them" style={{ left: gv + '%' }}></b> : null}
                </span>
              </button>
              {isOpen ? (
                <div className="mmt-astat-x">
                  {ends ? <div className="mmt-astat-ends"><span>{ends[0]}</span><span>{ends[1]}</span></div> : null}
                  <div className="mmt-astat-key">
                    {d.blurb && !d.blurb.includes('←→') ? <span className="mmt-astat-blurb">{d.blurb}</span> : <span></span>}
                    {gv != null ? <span className="mmt-mchip is-them"><i>them</i>{gv}</span> : <span></span>}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
        <div className="mmt-astat-legend">
          <span className="mmt-astat-legkey"><span className="lk-you"></span>you</span>
          {hasThem ? <span className="mmt-astat-legkey"><span className="lk-them"></span>them</span> : null}
        </div>
      </div>
    );
  }
  return (
    <div className="mmt-astat">
      <div className="mmt-astat-big">{String(anchor.value || '').replace(/^age /, '')}</div>
      {anchor.sub ? <div className="mmt-astat-sub">{anchor.sub}</div> : null}
    </div>
  );
}

// ── anchor switcher — the ring, as chips. The ring's lower nodes sit under a
// tall card, so switching anchors used to mean closing the card first; the row
// keeps every anchor one tap away and auto-scrolls the active one into view.
function MTAnchorChips({ anchors, activeId, onPick }) {
  const box = React.useRef(null);
  React.useEffect(() => {
    const el = box.current;
    if (!el) return;
    const on = el.querySelector('.is-on');
    if (!on) return;
    el.scrollLeft = Math.max(0, on.offsetLeft - (el.clientWidth - on.offsetWidth) / 2);
  }, [activeId]);
  return (
    <div className="mmt-achips-bar">
      <div className="mmt-fchips mmt-achips" ref={box}>
        {anchors.map((a) => (
          <button
            key={a.id}
            className={'mmt-fchip' + (activeId === a.id ? ' is-on' : '')}
            style={{ '--hue': a.hue }}
            onClick={() => onPick(a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── anchor card: your stat · match headline · differences ───────────────────
function MTAnchorCard({ anchor, items, onPick, anchors, onAnchor }) {
  const [dimId, setDimId] = React.useState(null);
  const hasChips = !!(anchors && anchors.length > 1 && onAnchor);
  const R = IS_TEST_RESULTS[anchor.id];
  const dim = dimId && R && R.dims ? R.dims.find((d) => d.id === dimId) : null;
  const gkey = dim ? anchor.id + '·' + dim.id : anchor.id;   // axis scope → own group
  const who = dim ? 'people near you on ' + dim.label : window.MapStats.groupLabel(anchor.id);
  const rows = items.map((node) => {
    const n = mtNOpts(node);
    const gmode = window.MapStats.mode(node.qid, gkey, n, node.aidx);
    return { node, gmode, match: gmode === node.aidx };
  });
  // Live mode: MapStats refuses (D72), so there is no group mode to match
  // against. Everything downstream of `rows` has to go together — a null
  // gmode is not "you differ", it is "nobody has been counted". Left alone
  // the arithmetic reads 0% and files every answer under "where you differ",
  // which is the same fabrication with a worse number.
  const noCohort = rows.some((r) => r.gmode == null);
  const same = noCohort ? [] : rows.filter((r) => r.match);
  const diffs = noCohort ? [] : rows.filter((r) => !r.match);
  const pct = rows.length ? Math.round((same.length / rows.length) * 100) : 0;
  const [showSame, setShowSame] = React.useState(false);
  const T = IS_TEST_RESULTS[anchor.id];
  return (
    <div style={{ '--hue': anchor.hue }}>
      {hasChips ? <MTAnchorChips anchors={anchors} activeId={anchor.id} onPick={onAnchor}></MTAnchorChips> : null}
      {hasChips
        ? (T && T.taken ? <div className="mmt-astat-sub">taken {T.taken}</div> : null)
        : <div className="mmt-kicker"><span className="mmt-dot"></span>{anchor.label}{T && T.taken ? ' · taken ' + T.taken : ''}</div>}
      <MTAnchorStat anchor={anchor} openDim={dimId} onDim={setDimId} key={anchor.id}></MTAnchorStat>
      {noCohort ? <MTNoCohort who={who}></MTNoCohort> : (
      <React.Fragment>
      <div className="mmt-matchhead">
        <span className="mmt-matchpct">{pct}%</span>
        <span className="mmt-matchwho">of your answers match {who}</span>
      </div>
      <div className="mmt-matchbar"><i style={{ width: pct + '%' }}></i></div>
      {diffs.length ? (
        <React.Fragment>
          <div className="mmt-gwho">where you differ</div>
          <div className="mmt-matchlist">
            {diffs.map(({ node, gmode }) => (
              <button key={node.id} className="mmt-mrow" onClick={() => onPick(node.id)}>
                <span className="mmt-mrow-q">{node.prompt}</span>
                <span className="mmt-mrow-chips">
                  <span className="mmt-mchip is-you"><i>you</i>{node.ans}</span>
                  <span className="mmt-mchip is-them"><i>them</i>{mtOptLabel(node, gmode)}</span>
                </span>
              </button>
            ))}
          </div>
        </React.Fragment>
      ) : (
        <div className="mmt-allsame">You answered like most of them on every question.</div>
      )}
      {same.length ? (
        <React.Fragment>
          <button className={'mmt-samehead' + (showSame ? ' is-open' : '')} onClick={() => setShowSame((s) => !s)}>
            you agree on {same.length} {same.length === 1 ? 'answer' : 'answers'}
            <span className="mmt-samehead-chev">▾</span>
          </button>
          {showSame ? (
            <div className="mmt-matchlist is-quiet">
              {same.map(({ node }) => (
                <button key={node.id} className="mmt-mrow" onClick={() => onPick(node.id)}>
                  <span className="mmt-mrow-q">{node.prompt}</span>
                  <span className="mmt-mchip is-same">{node.ans}</span>
                </button>
              ))}
            </div>
          ) : null}
        </React.Fragment>
      ) : null}
      </React.Fragment>
      )}
    </div>
  );
}

// ── root ─────────────────────────────────────────────────────────────────────
function MTRootCard({ count, anchorCount }) {
  return (
    <div>
      <div className="mmt-kicker">your map</div>
      <div className="mmt-title">You</div>
      <div className="mmt-prompt">{count} answers · tap a profile dot to compare yourself with people like you.</div>
    </div>
  );
}

// ── swipeable row of answer tokens (branch / sub browsing) ──────────────────
// Exported by name for person-mindmap.jsx (v28 §7.3; D39 "convert on touch")
// — a window read there would raise the rule-4 ratchet. The window
// publication below stays for the bridge.
export function MTSwipeRow({ items, onPick, activeId }) {
  return (
    <div className="mmt-swipe">
      {items.map((it) => (
        <button key={it.id} className={'mmt-tok' + (activeId === it.id ? ' is-on' : '')} style={{ '--hue': it.hue }} onClick={() => onPick(it.id)}>
          <span className="mmt-tok-q">{it.q}</span>
          <span className="mmt-tok-ans">{it.ans}</span>
        </button>
      ))}
    </div>
  );
}

// ── branch: header + swipeable answers ─────────────────────────────
function MTBranchCard({ cat, items, onPick }) {
  return (
    <div style={{ '--hue': cat.hue }}>
      <div className="mmt-slim">
        <span className="mmt-dot"></span>
        <span className="mmt-slim-name">{cat.label}</span>
        <span className="mmt-slim-ct">{items.length}</span>
      </div>
      <MTSwipeRow items={items} onPick={onPick}></MTSwipeRow>
    </div>
  );
}

// ── sub-branch: header + swipeable answers ──────────────────────────────────
// the sub card carries the breakdown inline — one card, no second hop
function MTSubCard({ node, cat, rows, anchors, activeA, onFilter }) {
  const hue = cat ? cat.hue : 282;
  const [cur, setCur] = React.useState(rows[0] ? rows[0].id : null);
  const active = rows.find((r) => r.id === cur) || rows[0];
  return (
    <div style={{ '--hue': hue }}>
      <div className="mmt-slim">
        <span className="mmt-dot"></span>
        <span className="mmt-slim-name">{cat ? cat.label + ' · ' : ''}{node.label}</span>
        <span className="mmt-slim-ct">{rows.length}</span>
      </div>
      {rows.length > 1 ? (
        <MTSwipeRow items={rows.map((r) => ({ id: r.id, q: r.prompt, ans: r.ans, hue }))} activeId={active ? active.id : null} onPick={setCur}></MTSwipeRow>
      ) : null}
      {active ? <MTAnswerBody node={active} anchors={anchors} activeA={activeA} onFilter={onFilter} key={active.id}></MTAnswerBody> : null}
    </div>
  );
}

Object.assign(window, { MTRootCard, MTAnswerCard, MTAnchorCard, MTBranchCard, MTSubCard });

;globalThis.MTAnswerCard = typeof MTAnswerCard === 'undefined' ? globalThis.MTAnswerCard : MTAnswerCard;
;globalThis.MTAnchorCard = typeof MTAnchorCard === 'undefined' ? globalThis.MTAnchorCard : MTAnchorCard;
;globalThis.MTRootCard = typeof MTRootCard === 'undefined' ? globalThis.MTRootCard : MTRootCard;
;globalThis.MTBranchCard = typeof MTBranchCard === 'undefined' ? globalThis.MTBranchCard : MTBranchCard;
;globalThis.MTSubCard = typeof MTSubCard === 'undefined' ? globalThis.MTSubCard : MTSubCard;

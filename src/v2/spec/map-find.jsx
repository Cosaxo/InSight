// map-find.jsx — the Map's wayfinding pieces (VISION-2026-09-12 §3,
// D-2026-09-12d): the card's grab bar, its prev/next through siblings,
// and the Find results card. Extracted from the 2026-09-12 standalone
// (design/standalone-2026-09-12/map-find.jsx) and converted on arrival —
// named exports, no window publication, imported by map-tab.jsx alone.
// A NEW module needs no spec-index.js line: rule 2 asks whether a file
// LOADS, and this one loads through the Map chunk's own ESM graph.
//
// Everything here reads what the Map already holds. The Find card is
// handed the matches map-tab.jsx folded over `allAnswers`; nothing is
// fetched, and the total it prints is the count the root card prints.
import React from 'react';

const ORDER = ['peek', 'half', 'full'];

// ── the grab bar — three card sizes, a drag or a tap between them ──────
// A <button>, not the standalone's role=button div: the a11y gate reads a
// div with pointer handlers as an interactive element with no keyboard
// path, and a button gets Enter and Space for free — a tap's toggle. The
// drag is pointer capture on the button itself; 28px is the step.
export function MTCardGrab({ mode, onMode }) {
  const st = React.useRef(null);
  const step = (d) => { const i = ORDER.indexOf(mode); onMode(ORDER[Math.max(0, Math.min(2, i + d))]); };
  const toggle = () => onMode(mode === 'half' ? 'full' : 'half');
  return (
    <button
      type="button"
      className="mmt-grab"
      aria-label={'Resize card — ' + mode}
      onPointerDown={(e) => {
        st.current = { y: e.clientY };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* a synthetic pointer has no capture; the release below still fires */ }
      }}
      onPointerUp={(e) => {
        const s = st.current;
        st.current = null;
        if (!s) return;
        const dy = e.clientY - s.y;
        if (dy > 28) step(-1); else if (dy < -28) step(1); else toggle();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); step(1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
      }}
    >
      <span className="mmt-grab-bar" aria-hidden="true"></span>
    </button>
  );
}

// ── prev / next — ‹ 3 of 7 · Everyday › through the selected answer's siblings
export function MTCardNav({ i, n, ctx, onPrev, onNext }) {
  return (
    <div className="mmt-cardnav">
      <button type="button" className="mmt-cardnav-b" disabled={!onPrev} onClick={onPrev || undefined} aria-label="Previous answer">‹</button>
      <span className="mmt-cardnav-t"><b>{i + 1} of {n}</b>{ctx ? ' · ' + ctx : ''}</span>
      <button type="button" className="mmt-cardnav-b" disabled={!onNext} onClick={onNext || undefined} aria-label="Next answer">›</button>
    </div>
  );
}

// ── the Find card — what lit, and where a tap takes you ─────────────────
// The first forty rows, then a count: a query that matches two hundred
// answers has lit two hundred dots, and the list under the map is a way
// in, not the map.
export const FIND_ROWS = 40;
export function MTFindCard({ matches, total, active, hueOf, onPick }) {
  if (!active) {
    return (
      <div>
        <div className="mmt-kicker">find</div>
        <div className="mmt-prompt">Type a word from a question or an answer, or filter to this week’s and your rarer takes. {total} answers on the map.</div>
      </div>
    );
  }
  const rows = (matches || []).slice(0, FIND_ROWS);
  const n = matches ? matches.length : 0;
  return (
    <div>
      <div className="mmt-kicker">{n ? n + (n === 1 ? ' match' : ' matches') + ' lit on the map' : 'no matches'}</div>
      {rows.length ? (
        <div className="mmt-matchlist is-find">
          {rows.map((m) => (
            <button type="button" key={m.id} className="mmt-mrow mmt-frow" style={{ '--hue': hueOf(m.id) }} onClick={() => onPick(m.id)}>
              <span className="mmt-frow-top">
                <span className="mmt-dot"></span>
                <span className="mmt-mrow-q">{m.prompt}</span>
                {m.note ? <span className="mmt-frow-when">{m.note}</span> : null}
              </span>
              <span className="mmt-mchip is-same">{m.ans}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mmt-prompt">Nothing on the map matches that yet.</div>
      )}
      {n > rows.length ? <div className="mmt-prompt">Showing the first {rows.length}.</div> : null}
    </div>
  );
}

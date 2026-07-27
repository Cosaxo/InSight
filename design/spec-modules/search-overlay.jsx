// search-overlay.jsx — find a person. Opens from the header magnifier.
// People-only: searches your nearby/circle by name, role, or interest.
const { useState: useSrchState, useEffect: useSrchEffect, useMemo: useSrchMemo, useRef: useSrchRef } = React;

function srchMatch(hay, q) {
  return hay.toLowerCase().includes(q);
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

function SearchOverlay({ onClose, onPerson }) {
  const [q, setQ] = useSrchState('');
  const ref = useSrchRef(null);
  useSrchEffect(() => { const t = setTimeout(() => ref.current && ref.current.focus(), 80); return () => clearTimeout(t); }, []);

  const query = q.trim().toLowerCase();
  const D = window.IS_DATA;

  // no query — your friends; with a query — everyone you can reach
  const people = useSrchMemo(() => {
    const friends = (window.FRIENDS ? window.FRIENDS.list() : []).map(id => (D.people || []).find(p => p.id === id)).filter(Boolean);
    if (!query) return friends;
    const all = friends.concat((D.nearby || []).filter(n => !friends.some(f => f.id === n.id)));
    return all.filter(p => srchMatch(p.name + ' ' + (p.role || p.rel || '') + ' ' + (p.interests || []).map(i => i.t || i).join(' '), query));
  }, [query]);

  const go = (fn) => { onClose(); fn(); };

  return (
    <div className="overlay" style={{ fontFamily: 'var(--sans)' }}>
      <div className="search-head">
        <div className="search-field">
          <span style={{ color: 'var(--ink-3)', display: 'flex' }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="16.5" y1="16.5" x2="21" y2="21"></line></svg>
          </span>
          <input ref={ref} value={q} onChange={e => setQ(e.target.value)} placeholder="Find a person by name…"
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }} />
          {q && <button onClick={() => setQ('')} style={{ border: 'none', background: 'var(--rule)', color: 'var(--ink-2)', width: 18, height: 18, borderRadius: 999, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>}
        </div>
        <button className="search-cancel" onClick={onClose}>Cancel</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 40px' }}>
        <div className="search-group">{query ? 'People' : 'Friends'}</div>

        {people.length === 0 && (
          <div className="search-empty">No one matches “{q}” — try a first name or a relation</div>
        )}

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

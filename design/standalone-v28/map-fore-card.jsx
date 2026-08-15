// map-fore-card.jsx — the two Foresight cards.
// A Foresight leaf is not an answer, it is an aim: a subject you call, or a
// group you read. So the card carries the run itself — the same hit/miss dots
// the 1v1 read uses — and one line saying where that run sits against everyone
// else's. Distance from You on the map already says how good it is; the card
// only has to say how good, exactly.
function MTForeCard({ node }) {
  const P = window.PREDICT;
  const r = P && node.fkey ? P.run(node.fkey) : null;
  if (!r) return null;
  const hue = P.hueOf(r.key);
  const col = 'oklch(0.52 0.14 ' + hue + ')';
  const RR = window.ReadRun;
  const open = r.kind === 'c' ? P.openCalls() : 0;
  return (
    <div style={{ '--hue': hue }}>
      <div className="mmt-kicker"><span className="mmt-dot"></span>{r.kind === 'c' ? 'Calls' : 'Reads'}</div>
      <div className="mmt-title" style={{ marginTop: 4 }}>{P.label(r.key)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 13 }}>
        {RR ? <RR days={r.days} color={window.WPAL.c(col)} size={13}></RR> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11 }}>
        <span style={{ flex: 1, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
          {r.pct >= 50 ? 'Better than ' + r.pct + '% of people' : 'Only ' + r.pct + '% read this worse'}
        </span>
        {open > 0 && r.kind === 'c' ? <span style={{ fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>{open} sealed</span> : null}
      </div>
    </div>
  );
}

// the branch: every subject you call, or every group you read, best first
function MTForeBranchCard({ cat, onPick }) {
  const P = window.PREDICT;
  if (!P) return null;
  const kind = cat.id === 'fore-calls' ? 'c' : 'r';
  const rows = P.runs().filter((r) => r.kind === kind).sort((a, b) => b.rate - a.rate);
  const RR = window.ReadRun;
  return (
    <div style={{ '--hue': cat.hue }}>
      <div className="mmt-slim">
        <span className="mmt-dot"></span>
        <span className="mmt-slim-name">{kind === 'c' ? 'What you call' : 'Who you read'}</span>
        <span className="mmt-slim-ct">{rows.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
        {rows.map((r) => {
          const col = window.WPAL.c('oklch(0.52 0.14 ' + P.hueOf(r.key) + ')');
          return (
            <button key={r.key} onClick={() => onPick && onPick('fore-' + r.key.replace(':', '-'))} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '9px 2px', border: 'none', borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 30%)', background: 'none', cursor: 'pointer', WebkitAppearance: 'none' }}>
              <span style={{ width: 78, flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{P.label(r.key)}</span>
              {RR ? <RR days={r.days.slice(-14)} color={col} size={10}></RR> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { MTForeCard, MTForeBranchCard });

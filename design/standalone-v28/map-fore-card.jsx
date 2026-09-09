// map-fore-card.jsx — the Foresight cards.
// A Foresight leaf is an aim, not an answer. Calls leaves are subjects, and the
// card carries the run PLUS the real events behind it — sealed calls waiting,
// settled ones scored. Reads go one level deeper: the cut (Gender) is a hub and
// the groups inside it are the leaves, so the map itself shows WHO you read
// best — close and solid = sharp, far and hollow = below your average.

function MTForePct({ r, verb }) {
  return (
    <span style={{ flex: 1, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
      {r.pct >= 50 ? 'Better than ' + r.pct + '% of people' : 'Only ' + r.pct + '% ' + verb + ' this worse'}
    </span>
  );
}

// tiny standing pill — filled = your sharpest group on this cut, outlined = weakest
function MTForeTag({ sharp, col }) {
  return (
    <span style={{
      fontFamily: 'var(--sans)', fontSize: 10, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: 99, whiteSpace: 'nowrap', flexShrink: 0,
      color: sharp ? 'oklch(0.99 0.005 100)' : 'var(--ink-2)',
      background: sharp ? col : 'transparent',
      border: sharp ? 'none' : `1.5px solid color-mix(in oklch, ${col} 45%, transparent)`,
    }}>{sharp ? 'sharpest read' : 'blind spot'}</span>
  );
}

// one Calls subject — the run, the standing, and the events behind it
function MTForeCallCard({ node }) {
  const P = window.PREDICT;
  const r = P.run(node.fkey);
  if (!r) return null;
  const hue = P.hueOf(r.key);
  const col = window.WPAL.c('oklch(0.52 0.14 ' + hue + ')');
  const RR = window.ReadRun;
  const ev = P.callsFor ? P.callsFor(r.key) : { open: [], settled: [] };
  const rows = ev.settled.slice(-2).map((e) => ({ ...e, sealed: false })).concat(ev.open.slice(0, 2).map((e) => ({ ...e, sealed: true })));
  return (
    <div style={{ '--hue': hue }}>
      <div className="mmt-kicker"><span className="mmt-dot"></span>Calls</div>
      <div className="mmt-title" style={{ marginTop: 4 }}>{P.label(r.key)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 13 }}>
        {RR ? <RR days={r.days} color={col} size={13}></RR> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11 }}>
        <MTForePct r={r} verb="call"></MTForePct>
        {ev.open.length ? <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>{ev.open.length} sealed</span> : null}
      </div>
      {rows.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          {rows.map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '7px 0', borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 30%)' }}>
              <span style={{ width: 14, flexShrink: 0, textAlign: 'center', fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 800, color: !e.sealed && e.ok ? col : 'var(--ink-3)' }}>{e.sealed ? '◷' : e.ok ? '✓' : '✕'}</span>
              <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--sans)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.prompt}</span>
              <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 700, color: 'var(--ink-3)' }}>{e.sealed ? 'in ' + e.days + 'd' : e.pick}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// one group inside a read cut — where this group sits among its siblings
function MTForeGroupCard({ node }) {
  const P = window.PREDICT;
  const dim = node.fkey.slice(2);
  const gs = P.groupRuns ? P.groupRuns(dim) : [];
  const g = gs.find((x) => x.gi === node.gi);
  if (!g) return null;
  const hue = P.hueOf(node.fkey);
  const col = window.WPAL.c('oklch(0.52 0.14 ' + hue + ')');
  const RR = window.ReadRun;
  const sorted = gs.slice().sort((a, b) => b.rate - a.rate);
  const rank = sorted.findIndex((x) => x.gi === node.gi) + 1;
  const dimRun = P.run(node.fkey);
  return (
    <div style={{ '--hue': hue }}>
      <div className="mmt-kicker"><span className="mmt-dot"></span>Intuition · {P.label(node.fkey)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div className="mmt-title" style={{ marginTop: 4 }}>{g.label}</div>
        {rank === 1 ? <MTForeTag sharp col={col}></MTForeTag> : rank === gs.length ? <MTForeTag col={col}></MTForeTag> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 13 }}>
        {RR ? <RR days={g.days} color={col} size={13}></RR> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11 }}>
        <span style={{ flex: 1, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
          {Math.round(g.rate * 100)}% right · #{rank} of {gs.length} {P.phrase(dim)}
        </span>
        {dimRun ? <span style={{ flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 700, color: 'var(--ink-3)' }}>{P.label(node.fkey)} avg {Math.round(dimRun.rate * 100)}%</span> : null}
      </div>
    </div>
  );
}

// a Foresight leaf: a Calls subject, or one group inside a read cut
function MTForeCard({ node }) {
  const P = window.PREDICT;
  if (!P || !node.fkey) return null;
  return node.gi != null ? <MTForeGroupCard node={node}></MTForeGroupCard> : <MTForeCallCard node={node}></MTForeCallCard>;
}

// a read cut — the aggregate run, then every group inside it, best first
function MTForeDimCard({ node, onPick }) {
  const P = window.PREDICT;
  if (!P || !node.fkey) return null;
  const r = P.run(node.fkey);
  if (!r) return null;
  const hue = P.hueOf(r.key);
  const col = window.WPAL.c('oklch(0.52 0.14 ' + hue + ')');
  const RR = window.ReadRun;
  const gs = (P.groupRuns ? P.groupRuns(r.id) : []).slice().sort((a, b) => b.rate - a.rate);
  const best = gs[0], worst = gs[gs.length - 1];
  return (
    <div style={{ '--hue': hue }}>
      <div className="mmt-kicker"><span className="mmt-dot"></span>Intuition</div>
      <div className="mmt-title" style={{ marginTop: 4 }}>{P.label(r.key)}</div>
      {best && worst && best !== worst ? (
        <div style={{ marginTop: 6, fontFamily: 'var(--sans)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', textWrap: 'pretty' }}>
          You read <b style={{ color: col, fontWeight: 800 }}>{best.label}</b> best — {worst.label} is the blind spot.
        </div>
      ) : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 12 }}>
        {RR ? <RR days={r.days} color={col} size={11}></RR> : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 9 }}>
        <MTForePct r={r} verb="read"></MTForePct>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
        {gs.map((g, i) => (
          <button key={g.gi} onClick={() => onPick && onPick(node.id + '-g' + g.gi)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '8px 2px', border: 'none', borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 30%)', background: 'none', cursor: 'pointer', WebkitAppearance: 'none' }}>
            <span style={{ width: 86, flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
            {RR ? <RR days={g.days.slice(-8)} color={col} size={9}></RR> : null}
            <span style={{ marginLeft: 'auto', flexShrink: 0, fontFamily: 'var(--sans)', fontVariantNumeric: 'tabular-nums', fontWeight: 800, fontSize: 12.5, color: i === 0 ? col : i === gs.length - 1 ? 'var(--ink-3)' : 'var(--ink-2)' }}>{Math.round(g.rate * 100)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// the branch: every subject you call, or every cut you read, best first
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
      {kind === 'r' ? (
        <div style={{ marginTop: 7, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', textWrap: 'pretty' }}>
          On the map, closer to the hub means you read them better — hollow dots sit below your average.
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 6 }}>
        {rows.map((r) => {
          const col = window.WPAL.c('oklch(0.52 0.14 ' + P.hueOf(r.key) + ')');
          const gs = kind === 'r' && P.groupRuns ? P.groupRuns(r.id) : null;
          const best = gs && gs.length ? gs.slice().sort((a, b) => b.rate - a.rate)[0] : null;
          return (
            <button key={r.key} onClick={() => onPick && onPick('fore-' + r.key.replace(':', '-'))} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '9px 2px', border: 'none', borderTop: '0.5px solid color-mix(in oklch, var(--rule), transparent 30%)', background: 'none', cursor: 'pointer', WebkitAppearance: 'none' }}>
              <span style={{ width: 78, flexShrink: 0, fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 13.5, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{P.label(r.key)}</span>
              {RR ? <RR days={r.days.slice(kind === 'r' ? -8 : -10)} color={col} size={10}></RR> : null}
              <span style={{ marginLeft: 'auto', flexShrink: 0, fontFamily: 'var(--sans)', fontSize: 11.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: best ? col : 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 92 }}>
                {best ? '↑ ' + best.label : Math.round(r.rate * 100) + '%'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { MTForeCard, MTForeDimCard, MTForeBranchCard });

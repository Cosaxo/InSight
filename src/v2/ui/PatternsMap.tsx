// The Map lens (D215) — every question in the pool as one place, laid out
// so that distance IS how much two answers predict each other. Ported
// from the 2026-08-20 standalone's question-map.jsx
// (design/standalone-2026-08-20/); the engine stayed data/patternsMap.ts
// over the REAL published loadings, with its layout upgraded to the same
// build's archipelago passes.
//
// What the picture says, with no legend to read:
//   position  · close together = strongly tied, either way (the factor plane)
//   ink       · solid dot = answered, hollow ring = still open — the field
//               is neutral at rest; topic colour appears only where it
//               carries meaning: the tapped web, an active topic filter,
//               the next-up beacon
//   size      · three steps — hub / mid / leaf — how tied to everything else
//   line      · a strong pair — solid when the popular picks go together,
//               dotted when one predicts the other side
// Tap a place and the map dims to that question's own web; the card
// underneath says each link out loud: "Pick this — and 78% pick that."
// Those sentences are PATTERNS.say — exact 2×2s over bounded voter
// samples, fetched only for the links on screen, rows shared per session
// — and every one states its basis (D146; the one line this port adds to
// the prototype, which counted an invented population and had no basis
// to state).
import React from "react";
import LIVE from "../data/live";
import PATTERNS, { drawnAxes, type DrawnAxis, type PairSay, type PoolItem } from "../data/patterns";
import { edgesOf, mapGeometry, nearOf, planeOf, type MapNode } from "../data/patternsMap";
// @ts-expect-error TS7016 — untyped spec module (named export, D189)
import { WPAL } from "../spec/world-palette.js";
// @ts-expect-error TS7016 — untyped spec module (named export, convert-on-touch)
import { WORLD_TOPICS } from "../spec/world-feed-data.js";

const W = 344, H = 330;

interface Topic { id: string; label: string; color: string }
const topicOf = (cat: string | null | undefined): Topic | undefined =>
  (WORLD_TOPICS as Topic[]).find((t) => t.id === cat);
// topic hues carried as NUMBERS: the palette's colours are oklch strings,
// so the hue is read off the tail and re-lit at the weights the standalone
// chose (shared with the relationship map / the People lens's person dots)
const catHueOf = (cat: string | null | undefined): number | null => {
  const t = topicOf(cat);
  const m = t && /([-\d.]+)\s*\)\s*$/.exec(t.color);
  return m ? parseFloat(m[1]) : null;
};
const soft = (h: number) => `oklch(0.605 0.118 ${h})`;
const softTint = (h: number) => `oklch(0.87 0.062 ${h})`;
const softInk = (h: number) => `oklch(0.54 0.118 ${h})`;

/** The viewer's option index on an item, from the encoded ±1. */
const mineIdx = (p: PoolItem | undefined): 0 | 1 | null =>
  !p || p.mine == null ? null : p.mine === 1 ? 0 : 1;

export default function PatternsMap({ items, version, topic }: {
  items: PoolItem[];
  version: number;
  topic: string;
}): React.ReactElement {
  const [sel, setSel] = React.useState<number | null>(null);
  const [burst, setBurst] = React.useState<{ i: number; t: number } | null>(null);

  // Geometry recomputes only when the pool changes (a vote landing, the
  // loadings arriving) — the archipelago passes are ~200 iterations over
  // every edge, not a per-render cost. Keyed on the subscription version:
  // the pool is a pure fold over exactly the state that bumps it.
  const geo = React.useMemo(() => {
    const nodes: MapNode[] = items.map((p) => ({ id: p.q.id, L: p.L, n: p.n }));
    const { U, hub } = mapGeometry(nodes);
    const edges = edgesOf(U, 3);
    const pts = planeOf(nodes, edges);
    return { U, hub, edges, pts };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version IS the pool's identity (see above)
  }, [version]);

  // The trait axes (AXES-PLAN §2): directions the nightly fit publishes
  // beside the loadings, drawn under everything as faint diameters —
  // "Openness points this way; these questions lean with it." The
  // direction is exact for the plane's SEED (planeOf takes x/y from
  // components 0–1); the archipelago passes then nudge positions locally
  // and the fit() stretch is anisotropic, so the line is a reading aid
  // for the field, not a ruler over any one dot — the same standing the
  // constellation's own distances have. Absent block, no lines (D1).
  const axes = React.useMemo(() => drawnAxes(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version bumps when the loadings (axes included) arrive
    [version]);

  const inTopic = (i: number) => topic === "all" || items[i].q.cat === topic;
  const catHue = (i: number) => catHueOf(items[i]?.q.cat);
  const tint = (i: number) => { const h = catHue(i); return h == null ? "var(--surface)" : softTint(h); };
  const hue = (i: number) => { const h = catHue(i); return h == null ? "var(--ink-3)" : soft(h); };
  const ink = (i: number) => { const h = catHue(i); return h == null ? "var(--ink-2)" : softInk(h); };
  // three discrete sizes — a 4px continuum read as jitter, not hierarchy
  const hubMax = Math.max(...geo.hub, 0) || 1;
  const rOf = (i: number) => { const h = geo.hub[i] / hubMax; return h > 0.72 ? 7.4 : h > 0.42 ? 4.9 : 3.2; };
  // the neutral field wears the page's own dusk indigo, not hard ink
  const fSolid = "color-mix(in oklab, var(--accent) 68%, var(--ink-2))";
  const fEdge = "color-mix(in oklab, var(--accent) 34%, var(--ink-3))";
  const nb = sel == null ? null : nearOf(geo.U, sel, 3);
  const near = nb ? new Set(nb.map((x) => x.j)) : null;
  const rest = geo.edges.filter((l) => inTopic(l.i) && inTopic(l.j));
  const shown = sel == null || !nb ? rest : nb.map((x) => ({ i: sel, j: x.j, r: x.r }));
  // the resting figure (2026-08-24): the ten strongest ties drawn at full
  // voice, so the map shows a constellation before any tap. `rest` comes
  // strength-sorted from edgesOf — the same order the idle card's
  // "strongest tie" already leans on. Its member dots stay fully inked.
  const figN = 10;
  const figDots = sel == null ? new Set(rest.slice(0, figN).flatMap((l) => [l.i, l.j])) : new Set<number>();

  // the People lens grammar, carried over: loosely-tied places are fainter
  const restFill = (i: number) => { const h = catHue(i); return h == null ? fSolid : `oklch(0.56 0.09 ${h})`; };
  const restOp = (i: number) => (figDots.has(i) ? 1 : 0.55 + Math.min(1, geo.hub[i] / hubMax / 0.72) * 0.45);

  // the unanswered question most tied to everything else — the best next tap
  let nxt: number | null = null;
  if (sel == null) {
    let best = -1;
    items.forEach((x, i) => { if (x.mine == null && inTopic(i) && geo.hub[i] > best) { best = geo.hub[i]; nxt = i; } });
  }
  const colored = (i: number) =>
    sel != null ? i === sel || (near?.has(i) ?? false) : i === nxt || (topic !== "all" && inTopic(i));
  const beacon = nxt != null ? (geo.pts.find((x) => x.i === nxt) ?? null) : null;

  // The selected question's own links, said out loud — each an exact 2×2
  // fetched on demand and cached for the session (rows shared per qid).
  const selId = sel != null && items[sel] ? items[sel].q.id : null;
  const [says, setSays] = React.useState<{ id: string; rows: { j: number; s: PairSay | null }[] } | null>(null);
  React.useEffect(() => {
    if (selId == null || !nb) { setSays(null); return; }
    let on = true;
    setSays(null);
    void Promise.all(nb.map((x) =>
      PATTERNS.say(selId, items[x.j].q.id).then((s) => ({ j: x.j, s })).catch(() => ({ j: x.j, s: null }))))
      .then((rows) => { if (on) setSays({ id: selId, rows }); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nb/items follow `version`; selId names the selection
  }, [selId]);

  // idle card leads with the strongest tie under the current topic filter
  const top = sel == null && rest.length ? rest[0] : null;
  const [topSay, setTopSay] = React.useState<{ key: string; s: PairSay | null } | null>(null);
  React.useEffect(() => {
    if (!top) { setTopSay(null); return; }
    const key = `${items[top.i].q.id}>${items[top.j].q.id}`;
    let on = true;
    void PATTERNS.say(items[top.i].q.id, items[top.j].q.id)
      .then((s) => { if (on) setTopSay({ key, s }); })
      .catch(() => { if (on) setTopSay({ key, s: null }); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the pair's ids name the fetch; items follow `version`
  }, [top ? `${top.i}:${top.j}` : null, version]);

  const pick = (i: number) => { setSel((s) => (s === i ? null : i)); };
  const q = sel != null ? items[sel] : null;
  const nAns = items.filter((x) => x.mine != null).length;
  const chain = top && topSay && topSay.s ? topSay.s : null;

  if (!items.length || !geo.pts.length) {
    return (
      <div className="card" style={{ padding: "22px 18px", textAlign: "center", fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5 }}>
        The fit has published, but none of its questions are on this device yet.
      </div>
    );
  }

  return (
    <>
      <div className="card qm-card">
        <svg className="qm-svg" viewBox={`0 0 ${W} ${H}`} role="img"
          aria-label="Every question, placed by how much its answer predicts the others"
          onClick={() => { if (sel != null) setSel(null); }}>
          {axes.length > 0 && (
            <g className="qm-axes" pointerEvents="none" opacity={sel != null ? 0.25 : 0.55}>
              {axes.map((a: DrawnAxis) => {
                const cx = W / 2, cy = H / 2, R = 0.44 * Math.min(W, H);
                const x2 = cx + a.x * R, y2 = cy + a.y * R;
                // label at the positive tip, clamped inside the frame
                const lx = Math.max(30, Math.min(W - 30, cx + a.x * (R + 10)));
                const ly = Math.max(12, Math.min(H - 6, cy + a.y * (R + 12)));
                return (
                  <g key={a.key}>
                    <line x1={cx - a.x * R} y1={cy - a.y * R} x2={x2} y2={y2}
                      stroke="var(--ink-3)" strokeWidth="0.8" strokeDasharray="1 5"
                      strokeLinecap="round" />
                    <text x={lx} y={ly} textAnchor="middle"
                      style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.08em", fill: "var(--ink-3)", textTransform: "uppercase" }}>
                      {a.label}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
          <g>
            {shown.map((l, k) => {
              const a = geo.pts[l.i], b = geo.pts[l.j];
              const lit = sel != null;
              const fig = !lit && k < figN; // the constellation tier — clearly drawn at rest
              const strong = lit || k < 24; // full web faint, the strongest two dozen speak
              const bt = lit && burst && burst.i === sel ? String(burst.t) : "";
              const draw = lit && l.r >= 0; // opposite links keep their dashes — the dash IS the meaning
              return (
                <line key={`${l.i}-${l.j}${bt}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  pathLength={draw ? 1 : undefined}
                  className={draw ? "qm-drawin" : undefined}
                  style={draw ? { animationDelay: `${k * 0.07}s` } : undefined}
                  stroke={lit ? hue(sel as number) : fig ? "color-mix(in oklab, var(--accent) 55%, var(--ink-2))" : fEdge}
                  strokeWidth={lit ? 1 + Math.abs(l.r) * 2.8 : fig ? 1.2 + Math.abs(l.r) * 2.4 : strong ? 0.9 + Math.abs(l.r) * 2 : 0.7}
                  strokeDasharray={l.r < 0 ? "2.5 3" : undefined}
                  strokeLinecap="round"
                  opacity={lit ? 0.58 : fig ? 0.38 + Math.abs(l.r) * 0.3 : strong ? 0.22 + Math.abs(l.r) * 0.16 : 0.12}></line>
              );
            })}
          </g>
          <g>
            {geo.pts.map((p) => {
              const i = p.i;
              const answered = items[i].mine != null;
              const dim = sel != null ? i !== sel && !(near?.has(i) ?? false) : !inTopic(i);
              const on = colored(i);
              const r = rOf(i);
              return (
                <g key={p.id} onClick={(e) => { e.stopPropagation(); pick(i); }} style={{ cursor: "pointer" }}>
                  <circle cx={p.x} cy={p.y} r={Math.max(11, r + 6)} fill="transparent"></circle>
                  {i === sel && <circle cx={p.x} cy={p.y} r={r + 5} fill="none" stroke={hue(i)} strokeWidth="1.4" opacity="0.55"></circle>}
                  {burst && burst.i === i && <circle key={`b${burst.t}`} className="qm-bloom" cx={p.x} cy={p.y} r={r + 6} fill="none" stroke={hue(i)} strokeWidth="2"></circle>}
                  <circle cx={p.x} cy={p.y} r={r + 2} fill="var(--surface-2)" opacity={dim ? 0.25 : on ? 1 : restOp(i)}></circle>
                  <circle key={burst && burst.i === i ? `d${burst.t}` : "d"}
                    className={burst && burst.i === i ? "qm-pop" : undefined}
                    cx={p.x} cy={p.y} r={r}
                    fill={answered ? (on ? hue(i) : restFill(i)) : on ? tint(i) : "var(--surface-2)"}
                    stroke={answered ? "none" : on ? hue(i) : restFill(i)} strokeWidth={answered ? 0 : on ? 2 : 1.5}
                    opacity={dim ? 0.25 : on ? 1 : restOp(i)}></circle>
                </g>
              );
            })}
          </g>
          {/* the next-up beacon rides its own top layer (2026-08-24) — drawn
              after every dot so neither the ring nor the label is ever
              buried by a neighbour. Since 2026-08-26 it is also a tap
              target of its own: the ring reaches past the dot's hit
              circle underneath, and the map's one instruction should be
              its easiest button */}
          {beacon && (
            <g onClick={(e) => { e.stopPropagation(); pick(beacon.i); }} style={{ cursor: "pointer" }}>
              <circle cx={beacon.x} cy={beacon.y} r={Math.max(14, rOf(beacon.i) + 9)} fill="transparent"></circle>
              <circle cx={beacon.x} cy={beacon.y} r={rOf(beacon.i) + 3.5} fill="none" stroke="var(--accent)" strokeWidth="1.4" pointerEvents="none"></circle>
              <circle className="qm-pulse" cx={beacon.x} cy={beacon.y} r={rOf(beacon.i) + 3} fill="none" stroke="var(--accent)" strokeWidth="1.5"></circle>
              <text className="qm-nextlab" x={Math.max(42, Math.min(W - 42, beacon.x))} y={beacon.y > H - 26 ? beacon.y - rOf(beacon.i) - 9 : beacon.y + rOf(beacon.i) + 15}
                textAnchor="middle" fill="var(--ink)"
                style={{ paintOrder: "stroke", stroke: "var(--surface-2)", strokeWidth: 3.5 }}>answer next</text>
            </g>
          )}
        </svg>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, padding: "6px 6px 9px", fontSize: 11, fontWeight: 600, color: "var(--ink-3)" }}>
          <i className="qm-line"></i><span>together</span>
          <span style={{ color: "var(--rule)" }}>·</span>
          <i className="qm-line is-dash"></i><span>opposite</span>
          <span style={{ color: "var(--rule)" }}>·</span>
          {/* "answered", not "lit" (2026-08-26) — the legend says what the
              ink means in the reader's words, not the renderer's */}
          <i className="qm-dot is-fill"></i><span>answered</span>
          <span style={{ color: "var(--rule)" }}>·</span>
          <i className="qm-dot"></i><span>open</span>
        </div>
      </div>

      {q && sel != null ? (
        <div className="card qm-read">
          <div className="qm-qhead">
            <span className="pt-cat" style={{ background: WPAL.wash(hue(sel), 16) as string, color: ink(sel) }}>
              {topicOf(q.q.cat)?.label || "question"}
            </span>
            {q.mine != null && (
              <span className="qm-yours">you said {q.q.options[mineIdx(q) ?? 0]?.label}</span>
            )}
          </div>
          <div className="qm-prompt">{q.q.text}</div>
          {q.mine == null && (
            <div className="qm-opts">
              {q.q.options.map((op) => (
                <button key={op.id} className="qm-opt"
                  onClick={() => { LIVE.vote(q.q.id, op.id); setBurst({ i: sel, t: Date.now() }); }}>
                  {op.label}
                </button>
              ))}
            </div>
          )}
          <div className="qm-says">
            {says && says.id === q.q.id && says.rows.filter((x) => x.s).length === 0 && (
              <span className="qm-saytext">Its strongest links don’t have enough people in both samples to say more yet.</span>
            )}
            {/* what a tie IS, said once under the rows (2026-08-26). The
                prototype says "over everyone who answered both"; live the
                rows are the bounded samples each row already states — the
                sentence names the mechanism at the samples' own scope
                rather than borrowing the crowd's (D146). */}
            {says && says.id === q.q.id && says.rows.some((x) => x.s) && (
              <span style={{ paddingTop: 8, borderTop: "1px solid color-mix(in oklch, var(--rule), transparent 30%)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", textWrap: "pretty" }}>
                Each tie is a straight count over the people in both samples · “usually” is how they split regardless of the first pick.
              </span>
            )}
            {says && says.id === q.q.id && says.rows.map(({ j, s }, k) => {
              if (!s) return null;
              const to = items[j];
              const myPick = mineIdx(q);
              const myTo = mineIdx(to);
              const followed = myPick === s.pickIdx && myTo != null ? myTo === s.thenIdx : null;
              return (
                <div className="qm-say" key={k}>
                  <span className="qm-saytext">
                    Pick <b>{s.pick}</b> here{" — "}and <b>{s.pct}%</b> pick <b>{s.then}</b> on {"“" + to.q.text + "”"}
                  </span>
                  <span className="qm-saybar">
                    <i style={{ width: `${s.pct}%`, background: WPAL.wash(hue(sel), 44) as string }}></i>
                    <em style={{ left: `${s.base}%` }}></em>
                  </span>
                  <span className="qm-base">
                    <span style={{ left: `${Math.max(12, Math.min(86, s.base))}%` }}>usually {s.base}%</span>
                  </span>
                  {/* the stated basis — the D146 rule the prototype had no data to need */}
                  <span className="qm-foot">of the {s.both} in both samples</span>
                  {followed === false && myTo != null && (
                    <span className="qm-break">you went {to.q.options[myTo]?.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card qm-read">
          {chain && top ? (
            <button className="qm-top" onClick={() => pick(top.i)}>
              <span className="qm-toplab" style={{ background: WPAL.wash(hue(top.i), 16) as string, color: ink(top.i) }}>strongest tie</span>
              <span className="qm-tie">
                <i className="qm-tie-dot" style={{ background: items[top.i].mine != null ? hue(top.i) : tint(top.i), border: `1.5px solid ${hue(top.i)}` }}></i>
                <span className="qm-tie-row"><em>{"“" + items[top.i].q.text + "”"}</em><b className="qm-tie-pick" style={{ background: WPAL.wash(hue(top.i), 16) as string, color: ink(top.i) }}>{chain.pick}</b></span>
                <i className="qm-tie-rail" style={{ background: hue(top.i) }}></i>
                <span className="qm-tie-then" style={{ color: ink(top.i) }}><b>{chain.pct}%</b> then pick</span>
                <i className="qm-tie-dot" style={{ background: items[top.j].mine != null ? hue(top.j) : tint(top.j), border: `1.5px solid ${hue(top.j)}` }}></i>
                <span className="qm-tie-row"><em>{"“" + items[top.j].q.text + "”"}</em><b className="qm-tie-pick" style={{ background: WPAL.wash(hue(top.j), 16) as string, color: ink(top.j) }}>{chain.then}</b></span>
              </span>
              <span className="qm-foot">of the {chain.both} in both samples</span>
            </button>
          ) : (
            <div className="qm-idle">
              <b>{rest.length}</b>
              <span>links hold across the {items.length} questions in the pool; the strongest are drawn. Tap any place to read its own.</span>
            </div>
          )}
          {chain && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 14 }}>
              <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1 }}>{nAns}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.4, textWrap: "pretty" }}>
                of the <b style={{ color: "var(--ink)", fontWeight: 700 }}>{items.length} questions</b> here are answered · <b style={{ color: "var(--ink)", fontWeight: 700 }}>{rest.length} ties</b> hold between them.
              </span>
            </div>
          )}
          {/* the geometry, said in words (2026-08-26) — position was the one
              reading on this map with no stated basis; D161's core-only
              clause keeps its place after it */}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid color-mix(in oklch, var(--rule), transparent 30%)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", textWrap: "pretty" }}>
            Close together = answers that predict each other · drawn from the crowd’s latest answers · core questions only — a feed answer outside the shared corpus isn’t placed here.
          </div>
        </div>
      )}
    </>
  );
}

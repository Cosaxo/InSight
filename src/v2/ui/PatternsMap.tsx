// The Map lens (D215, redrawn 2026-09-02) — every question in the pool is
// one dot on a RING, grouped by topic, and a tie between two questions is a
// chord through the middle. Ported from the 2026-09-02 standalone's
// question-map.jsx (design/standalone-2026-09-02/); the engine stayed
// data/patternsMap.ts over the REAL published loadings.
//
// What the picture says, in plain words (the guide ⓘ says them too):
//   dot        · solid = you answered it, hollow = still open — one size
//   band       · the coloured arc outside the rim names the topic; a
//                short group's name sits INSIDE the rim instead, straight,
//                where it can never overrun its own band (2026-09-06)
//   chord      · the two answers go together; dashed = they go opposite
//                ways; thicker = stronger. At rest only the strongest ten
//                speak, the rest whisper at a breath — every link at once
//                is a hairball.
//   hub        · how many of the pool you have answered, in the serif
// Tap a dot and the field dims to that question's own three ties; the card
// underneath says each one out loud: "Pick this — and 78% pick that."
//
// PAPER, AND CHROME INTO WORDS (2026-09-06, VISION-2026-09-06 §2.1): the
// card lost its box and its standing title/legend — the legend renders
// under the tab's one ⓘ (the `guide` prop), reworded but with every basis
// sentence intact (D146: a claim may move one tap away, never be
// deleted). The on-field callout pill and the beacon's text label went
// with them — the beacon keeps its pulse and its tap, labelled for a
// screen reader; the strongest link is said once, under the field. The
// ring's arcs, chords and dots draw themselves in as ink (patterns.css,
// the ink-in family).
//
// WHAT THE RING STOPS SAYING, because a port that quietly kept the old
// sentence would be lying: on the plane this replaced, POSITION was a claim
// — "close together = answers that predict each other". Here position is
// topic membership and nothing else; every claim about two questions is a
// chord. So the plane's basis line is gone and the field's own sentence
// took its place (VISION-2026-09-02 §1.2). The counted sentences are
// unchanged: PATTERNS.say's exact 2×2s over bounded voter samples, fetched
// only for the links on screen, rows shared per session, each stating its
// basis (D146).
import React from "react";
import LIVE from "../data/live";
import PATTERNS, { type PairSay, type PoolItem } from "../data/patterns";
import { edgesOf, mapGeometry, nearOf, type MapNode } from "../data/patternsMap";
// @ts-expect-error TS7016 — untyped spec module (named export, D189)
import { WPAL } from "../spec/world-palette.js";
// @ts-expect-error TS7016 — untyped spec module (named export, convert-on-touch)
import { WORLD_TOPICS } from "../spec/world-feed-data.js";

// the field: a 352 box, the rim at 131, the topic band just outside it
const S = 352, C = 176, R = 131, RA = 142, RL = 158;
const GAP = 2.6;   // the silence between two topic groups, in dot-steps
const FIG_N = 10;  // how many ties speak at rest

interface Topic { id: string; label: string; color: string }
const topicOf = (cat: string | null | undefined): Topic | undefined =>
  (WORLD_TOPICS as Topic[]).find((t) => t.id === cat);
// topic hues carried as NUMBERS: the palette's colours are oklch strings,
// so the hue is read off the tail and re-lit at the weights the field
// wants — lifted for the dusk ground, deeper for ink on the light card
const catHueOf = (cat: string | null | undefined): number => {
  const t = topicOf(cat);
  const m = t && /([-\d.]+)\s*\)\s*$/.exec(t.color);
  return m ? parseFloat(m[1]) : 282;
};
const catLabel = (cat: string | null | undefined): string =>
  topicOf(cat)?.label || cat || "other";
const dotCol = (h: number) => `oklch(0.76 0.10 ${h})`;
const arcCol = (h: number) => `oklch(0.66 0.11 ${h})`;
const labCol = (h: number) => `oklch(0.80 0.09 ${h})`;
const inkCol = (h: number) => `oklch(0.46 0.11 ${h})`; // hue as text on the light card

const f1 = (v: number): number => Math.round(v * 10) / 10;

interface RimPoint { i: number; a: number; x: number; y: number }
interface RimArc { cat: string; h: number; d: string }
interface RimLabel {
  cat: string; h: number; x: number; y: number;
  /** Along-the-arc labels rotate; in-rim labels sit straight. */
  tr?: string;
  /** In-rim labels anchor toward the hub side; arc labels centre. */
  anchor?: "start" | "middle" | "end";
  text: string;
  fits: boolean;
}

/**
 * The ring: questions grouped by topic (WORLD_TOPICS order, unknown cats
 * last), a gap between groups, every dot on the same rim. It depends on
 * the pool's identity and nothing else — never on answers — so a vote
 * landing never moves a dot.
 */
function ringOf(items: readonly PoolItem[]): { pts: RimPoint[]; arcs: RimArc[]; labels: RimLabel[]; step: number } {
  const order = (WORLD_TOPICS as Topic[]).map((t) => t.id);
  const cats = [...new Set(items.map((p) => p.q.cat ?? ""))].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    // an unknown cat sorts last, and by name among its own, so the ring is
    // the same on every device rather than in Set-insertion order
    if (ia < 0 && ib < 0) return a < b ? -1 : a > b ? 1 : 0;
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const groups = cats.map((c) => ({ cat: c, idx: items.map((_, i) => i).filter((i) => (items[i].q.cat ?? "") === c) }));
  const step = (Math.PI * 2) / (items.length + groups.length * GAP);
  const pt = (rad: number, a: number): [number, number] => [f1(C + rad * Math.cos(a)), f1(C + rad * Math.sin(a))];
  const pts = new Array<RimPoint>(items.length);
  const arcs: RimArc[] = [];
  const labels: RimLabel[] = [];
  const lblBoxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
  let ang = -Math.PI / 2 + (step * GAP) / 2;
  for (const g of groups) {
    const a0 = ang;
    g.idx.forEach((i, k) => {
      const a = ang + step * k;
      const [x, y] = pt(R, a);
      pts[i] = { i, a, x, y };
    });
    const a1 = ang + step * (g.idx.length - 1);
    ang = a1 + step * (1 + GAP);
    const h = catHueOf(g.cat);
    const [sx, sy] = pt(RA, a0 - step * 0.45);
    const [ex, ey] = pt(RA, a1 + step * 0.45);
    const big = a1 - a0 + step * 0.9 > Math.PI ? 1 : 0;
    arcs.push({ cat: g.cat, h, d: `M ${sx} ${sy} A ${RA} ${RA} 0 ${big} 1 ${ex} ${ey}` });
    const mid = (a0 + a1) / 2;
    // A long group carries its name along the band. A short one would
    // overrun its band, so its name sits INSIDE the rim, straight,
    // pointing at the hub — where it can never leave the field or cross
    // the dots (2026-09-06). Full name first, then the first word; four
    // radii before giving up; a neighbour's placed label is a refusal.
    const full = catLabel(g.cat).toUpperCase();
    if (g.idx.length * step * RL > full.length * 7.6 + 8) {
      const [lx, ly] = pt(RL, mid);
      const deg = (mid * 180) / Math.PI + (Math.sin(mid) < 0 ? 90 : -90);
      labels.push({
        cat: g.cat, h, x: lx, y: ly,
        tr: `rotate(${deg.toFixed(1)} ${lx} ${ly})`,
        anchor: "middle", text: full, fits: true,
      });
      continue;
    }
    const cs = Math.cos(mid);
    const anchor: "start" | "middle" | "end" = Math.abs(cs) < 0.35 ? "middle" : cs > 0 ? "end" : "start";
    const words = full.split(/[\s&]+/).filter(Boolean);
    const short = words[0].length >= 4 ? words[0] : words.slice(0, 2).join(" ");
    const cands = [...new Set(anchor === "middle" ? [short, full, words[0]] : [full, short, words[0]])];
    let hit: { x: number; y: number; box: { x0: number; x1: number; y0: number; y1: number }; text: string } | null = null;
    outer: for (const text of cands) {
      const w = text.length * 6.6 + 2;
      for (const rr of anchor === "middle" ? [R - 26, R - 40, R - 54, R - 68] : [R - 14, R - 28, R - 42, R - 56]) {
        const [x, y] = pt(rr, mid);
        const x0 = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
        const box = { x0, x1: x0 + w, y0: y - 7, y1: y + 7 };
        const dx = Math.max(box.x0 - C, 0, C - box.x1);
        const dy = Math.max(box.y0 - C, 0, C - box.y1);
        if (Math.hypot(dx, dy) < 52) continue; // would touch the hub
        const far = Math.max(...[[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1]]
          .map(([px, py]) => Math.hypot(px - C, py - C)));
        if (far > R - 8) continue; // would reach the dots
        // the label must sit in its own group's wedge, never over a
        // neighbour's dots
        let dA = Math.atan2((box.y0 + box.y1) / 2 - C, (box.x0 + box.x1) / 2 - C) - mid;
        dA = Math.atan2(Math.sin(dA), Math.cos(dA));
        if (Math.abs(dA) > (a1 - a0) / 2 + 0.25) continue;
        if (box.x0 < 2 || box.x1 > S - 2 || box.y0 < 2 || box.y1 > S - 2) continue;
        if (lblBoxes.some((b) => box.x0 < b.x1 + 4 && box.x1 > b.x0 - 4 && box.y0 < b.y1 + 2 && box.y1 > b.y0 - 2)) continue;
        hit = { x: f1(x), y: f1(y), box, text };
        break outer;
      }
    }
    if (hit) {
      lblBoxes.push(hit.box);
      labels.push({ cat: g.cat, h, x: hit.x, y: hit.y, anchor, text: hit.text, fits: true });
    } else {
      labels.push({ cat: g.cat, h, x: 0, y: 0, anchor, text: full, fits: false });
    }
  }
  return { pts, arcs, labels, step };
}

/** A chord bundled toward the hub. (Its `chordAt` walker went with the
 * on-field callout, 2026-09-06 — nothing is written on a chord now.) */
const chordD = (A: RimPoint, B: RimPoint): { d: string; qx: number; qy: number } => {
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, k = 0.2;
  const qx = C + (mx - C) * k, qy = C + (my - C) * k;
  return { d: `M ${A.x} ${A.y} Q ${f1(qx)} ${f1(qy)} ${B.x} ${B.y}`, qx, qy };
};

/** The viewer's option index on an item, from the encoded ±1. */
const mineIdx = (p: PoolItem | undefined): 0 | 1 | null =>
  !p || p.mine == null ? null : p.mine === 1 ? 0 : 1;

export default function PatternsMap({ items, version, topic, guide = false }: {
  items: PoolItem[];
  version: number;
  topic: string;
  /** The tab's one ⓘ — the legend renders only while it is open
   * (VISION-2026-09-06 §2.4). */
  guide?: boolean;
}): React.ReactElement {
  const [sel, setSel] = React.useState<number | null>(null);
  const [burst, setBurst] = React.useState<{ i: number; t: number } | null>(null);

  // Geometry recomputes only when the pool changes (a vote landing, the
  // loadings arriving). Keyed on the subscription version: the pool is a
  // pure fold over exactly the state that bumps it.
  const geo = React.useMemo(() => {
    const nodes: MapNode[] = items.map((p) => ({ id: p.q.id, L: p.L, n: p.n }));
    const { U, hub } = mapGeometry(nodes);
    const edges = edgesOf(U, 3);
    return { U, hub, edges, ring: ringOf(items) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version IS the pool's identity (see above)
  }, [version]);
  const RG = geo.ring;

  const inTopic = (i: number) => topic === "all" || items[i].q.cat === topic;
  const catHue = (i: number) => catHueOf(items[i]?.q.cat);
  const nb = sel == null ? null : nearOf(geo.U, sel, 3);
  const near = nb ? new Set(nb.map((x) => x.j)) : null;
  const rest = geo.edges.filter((l) => inTopic(l.i) && inTopic(l.j));
  // The denominator the idle card prints, filtered the same way `rest` is.
  // It printed `items.length` — every question in the pool — beside a count
  // of links from INSIDE the picked topic, so with a topic chosen the card
  // read "1 links hold across the 6 questions in the pool" when the truth
  // was either 11 across 6 or 1 across 2, and neither number on the line
  // was one of them.
  const inPool = topic === "all" ? items.length : items.filter((x) => x.q.cat === topic).length;
  const shown = sel == null || !nb ? rest : nb.map((x) => ({ i: sel, j: x.j, r: x.r }));
  const selHue = sel == null ? null : catHue(sel);

  // the unanswered question most tied to everything else — the best next tap
  let nxt: number | null = null;
  if (sel == null) {
    let best = -1;
    items.forEach((x, i) => { if (x.mine == null && inTopic(i) && geo.hub[i] > best) { best = geo.hub[i]; nxt = i; } });
  }

  // The selected question's own links, said out loud — each an exact 2×2
  // fetched on demand and cached for the session (rows shared per qid).
  const selId = sel != null && items[sel] ? items[sel].q.id : null;
  const [says, setSays] = React.useState<{ id: string; rows: { j: number; s: PairSay | null; failed: boolean }[] } | null>(null);
  React.useEffect(() => {
    if (selId == null || !nb) { setSays(null); return; }
    let on = true;
    setSays(null);
    void Promise.all(nb.map((x) =>
      // The rejection is kept apart from the null. `say` answers null for
      // two facts about the crowd — under twelve in both samples, or two
      // questions that simply do not predict each other — and a refused
      // read is neither, so folding it into the same value made the note
      // below state a sample size over a read that never happened.
      PATTERNS.say(selId, items[x.j].q.id)
        .then((s) => ({ j: x.j, s, failed: false }))
        .catch(() => ({ j: x.j, s: null, failed: true }))))
      .then((rows) => { if (on) setSays({ id: selId, rows }); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nb/items follow `version`; selId names the selection
  }, [selId]);

  // idle: the strongest link under the current topic filter, said on the
  // field as a callout and under it as one sentence
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
  const topicWord = topic === "all" ? "" : ` in ${catLabel(topic)}`;

  if (!items.length || !RG.pts.length) {
    return (
      <div className="card" style={{ padding: "22px 18px", textAlign: "center", fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5 }}>
        The fit has published, but none of its questions are on this device yet.
      </div>
    );
  }

  return (
    <>
      <div className="ln-card">
        {/* the title, the one-sentence explainer and the on-field callout
            pill all retired (2026-09-06): the sentence lives in the guide
            legend below, the strongest link is said once under the field,
            and the card lost its box — the field sits on the page */}
        <div className="ln-field">
          <svg className="ln-svg" viewBox={`0 0 ${S} ${S}`} role="img"
            aria-label="Every question on a ring, grouped by topic; lines join questions whose answers predict each other"
            onClick={() => { if (sel != null) setSel(null); }}>
            <g>
              {shown.map((l, k) => {
                const a = RG.pts[l.i], b = RG.pts[l.j];
                if (!a || !b) return null;
                const lit = sel != null;
                const fig = !lit && k < FIG_N;
                const bt = lit && burst && burst.i === sel ? String(burst.t) : "";
                const draw = lit && l.r >= 0; // opposite links keep their dashes — the dash IS the meaning
                return (
                  <path key={`${l.i}-${l.j}${bt}`} d={chordD(a, b).d} fill="none"
                    pathLength={draw ? 1 : undefined}
                    className={draw ? "qm-drawin" : fig ? "qm-fig" : undefined}
                    style={draw ? { animationDelay: `${k * 0.07}s` } : undefined}
                    stroke={lit && selHue != null ? dotCol(selHue) : "var(--ln-ink)"}
                    strokeWidth={lit ? 1.4 + Math.abs(l.r) * 2.6 : fig ? 1.1 + Math.abs(l.r) * 1.2 : 0.8}
                    strokeDasharray={l.r < 0 ? "2.5 3.5" : undefined}
                    strokeLinecap="round"
                    opacity={lit ? 0.85 : fig ? 0.5 : 0.05}></path>
                );
              })}
            </g>
            <g>
              {RG.arcs.map((a, k) => (
                <path key={a.cat} className="qm-arc" pathLength={1} style={{ animationDelay: `${k * 0.05}s` }}
                  d={a.d} fill="none" stroke={arcCol(a.h)} strokeWidth="4" strokeLinecap="round"
                  opacity={topic === "all" || topic === a.cat ? 0.92 : 0.28}></path>
              ))}
              {RG.labels.map((l) => (l.fits ? (
                <text key={l.cat} className="qm-ink" x={l.x} y={l.y} transform={l.tr} fill={labCol(l.h)}
                  textAnchor={l.anchor ?? "middle"} dominantBaseline="middle"
                  opacity={topic === "all" || topic === l.cat ? 1 : 0.35}
                  style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".07em" }}>{l.text}</text>
              ) : null))}
            </g>
            {/* the hub speaks in the serif (2026-09-06) — the figure IS the
                progress line the sub-row used to carry, so it earns the
                prompt voice; no ring stroke, the paper does the framing */}
            <circle className="qm-ink" cx={C} cy={C} r="44" fill="var(--ln-hub)"></circle>
            <text className="qm-ink" x={C} y={C + 4} fill="var(--ln-ink)" textAnchor="middle"
              style={{ fontSize: 36, fontWeight: 500, letterSpacing: "-0.02em", fontFamily: "var(--serif)" }}>{nAns}</text>
            <text className="qm-ink" x={C} y={C + 22} fill="var(--ln-sub)" textAnchor="middle"
              style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".14em" }}>OF {items.length}</text>
            <g>
              {RG.pts.map((p) => {
                if (!p) return null;
                const i = p.i;
                const answered = items[i].mine != null;
                if (i === nxt) return null; // the beacon draws it on the top layer
                const dim = sel != null ? i !== sel && !(near?.has(i) ?? false) : !inTopic(i);
                const col = dotCol(catHue(i));
                return (
                  <g key={items[i].q.id} className="qm-dot"
                    onClick={(e) => { e.stopPropagation(); pick(i); }}
                    style={{
                      cursor: "pointer",
                      // ink-in, staggered by rim angle — the ring draws
                      // itself clockwise from the top
                      animationDelay: `${0.1 + (((p.a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 0.5}s`,
                    }}>
                    <circle cx={p.x} cy={p.y} r="11" fill="transparent"></circle>
                    {i === sel && <circle cx={p.x} cy={p.y} r="8" fill="none" stroke={col} strokeWidth="1.4" opacity="0.7"></circle>}
                    {burst && burst.i === i && <circle key={`b${burst.t}`} className="qm-bloom" cx={p.x} cy={p.y} r="9" fill="none" stroke={col} strokeWidth="2"></circle>}
                    <circle key={burst && burst.i === i ? `d${burst.t}` : "d"}
                      className={burst && burst.i === i ? "qm-pop" : undefined}
                      cx={p.x} cy={p.y} r="3.1"
                      fill={answered ? col : "var(--ln-halo)"}
                      stroke={answered ? "none" : col} strokeWidth={answered ? 0 : 1.3}
                      opacity={dim ? 0.22 : answered ? 1 : 0.8}></circle>
                  </g>
                );
              })}
            </g>
            {/* the next-up beacon rides its own top layer (2026-08-24) —
                drawn after every dot so the ring is never buried by a
                neighbour, and a tap target of its own since 2026-08-26.
                Its TEXT label went with the quieting (2026-09-06); the
                pulse is the instruction now, so the label moves onto the
                accessible name — a control that lost its visible words
                may not lose its name too. */}
            {nxt != null && RG.pts[nxt] && (() => {
              const p = RG.pts[nxt as number];
              return (
                <g role="button" tabIndex={0} aria-label={`Answer next: ${items[p.i].q.text}`}
                  onClick={(e) => { e.stopPropagation(); pick(p.i); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(p.i); } }}
                  style={{ cursor: "pointer", outline: "none" }}>
                  <circle cx={p.x} cy={p.y} r="15" fill="transparent"></circle>
                  <circle className="ln-pulse" cx={p.x} cy={p.y} r="6" fill="none" stroke="var(--ln-beacon)" strokeWidth="1.5"></circle>
                  <circle cx={p.x} cy={p.y} r="5" fill="var(--ln-beacon)"></circle>
                </g>
              );
            })()}
          </svg>
        </div>
        {/* the legend, on demand (the tab's ⓘ): the retired title's
            sentence leads it, because "what is this picture" is the first
            question the ⓘ answers */}
        {guide && (
          <div className="ln-key fade-in" aria-label="How to read the map">
            <span>a line joins two questions when how people answer one predicts how they answer the other · thicker = stronger</span>
            <span><i className="k-dot"></i>you answered it</span>
            <span><i className="k-ring"></i>still open</span>
            <span><i className="k-line"></i>answers go together</span>
            <span><i className="k-dash"></i>go opposite ways</span>
            <span>tap a dot for its links</span>
          </div>
        )}
      </div>

      {q && sel != null && selHue != null ? (
        <div className="qm-read">
          <div className="qm-qhead">
            <span className="pt-cat" style={{ background: WPAL.wash(`oklch(0.56 0.11 ${selHue})`, 16) as string, color: inkCol(selHue) }}>
              {catLabel(q.q.cat)}
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
              // WHAT THE CODE CAN ACTUALLY PROMISE. This said "don't have
              // enough people in both samples", and `say` returns null for
              // three different things: under the twelve-voter floor, no
              // cell beating its own marginal — two questions that are
              // simply independent, which is the ordinary case — and, via
              // the catch above, a read that refused. Only the first is a
              // sample size, and the sentence named it for all three.
              <span className="qm-saytext">{says.rows.every((x) => x.failed)
                ? "Couldn’t read the crowd for this one — tap it again to retry."
                : "Nothing here predicts its neighbours strongly enough to say yet."}</span>
            )}
            {/* what a link IS, said once under the rows (2026-08-26). The
                prototype says "over everyone who answered both"; live the
                rows are the bounded samples each row already states — the
                sentence names the mechanism at the samples' own scope
                rather than borrowing the crowd's (D146). */}
            {says && says.id === q.q.id && says.rows.some((x) => x.s) && (
              <span style={{ paddingTop: 8, borderTop: "1px solid color-mix(in oklch, var(--rule), transparent 30%)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", textWrap: "pretty" }}>
                Each link is a straight count over the people in both samples · “usually” is how they split regardless of the first pick.
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
                    Pick <b>{s.pick}</b> here{" — "}and <b>{s.pct}%</b> pick <b>{s.then}</b> on {"“" + to.q.text + "”"}
                  </span>
                  <span className="qm-saybar">
                    <i style={{ width: `${s.pct}%`, background: WPAL.wash(`oklch(0.56 0.11 ${selHue})`, 44) as string }}></i>
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
        <div className="qm-read">
          {chain && top ? (
            // the compact form (2026-09-06): the sentence in the serif with
            // the two picks as inked words, the figure beside it in plain
            // ink. The design reads each question's `short` name here; the
            // live bank carries none, so the design's own fallback — the
            // full prompt — is what always renders. The basis line stays:
            // the figure is a count, and D310's bounded-sample wording is
            // not the design's to delete.
            <button className="qm-tie2" onClick={() => pick(top.i)}>
              <span className="pt-kick" style={{ color: "var(--accent-ink)" }}>Strongest link{topicWord}</span>
              <span style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <span style={{ flex: 1, minWidth: 0, fontFamily: "var(--serif)", fontSize: 17, fontWeight: 500, lineHeight: 1.3, color: "var(--ink)", textWrap: "pretty" }}>
                  <b style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 800, color: inkCol(catHue(top.i)) }}>{chain.pick}</b>
                  {" on "}{items[top.i].q.text}{" → "}
                  <b style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 800, color: inkCol(catHue(top.j)) }}>{chain.then}</b>
                  {" on "}{items[top.j].q.text}
                </span>
                <b style={{ flex: "none", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1, color: "var(--ink)" }}>{chain.pct}%</b>
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>
                of them do · counted over the {chain.both} people in both samples · tap to open
              </span>
            </button>
          ) : (
            <div className="qm-idle">
              <b>{rest.length}</b>
              {/* …and it says WHICH pool, which the sibling arm above has
                  always done (`topicWord`). Without it a narrowed number
                  reads as the whole crowd's. */}
              <span>links hold across the {inPool} questions{topicWord || " in the pool"}; the strongest are drawn. Tap any dot to read its own.</span>
            </div>
          )}
          {/* D161's core-only clause, which the ring does not change: a feed
              answer outside the shared corpus is not in this pool at all */}
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid color-mix(in oklch, var(--rule), transparent 30%)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", textWrap: "pretty" }}>
            Drawn from the crowd’s latest answers · core questions only — a feed answer outside the shared corpus isn’t placed here.
          </div>
        </div>
      )}
    </>
  );
}

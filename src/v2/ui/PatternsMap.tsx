// The Map lens (D215, redrawn 2026-09-02; every kind of dot since D460) —
// every published ROW is one dot on a RING, grouped by topic, and a tie
// between two rows is a chord through the middle.
//
// A DOT IS A ROW, which is one axis people can lean along. That was
// already true when every dot was a two-option question (one row each,
// which is why nobody had to say it); saying it is what lets the other
// three quarters of the corpus on the map. A two-option question and a
// scale are one dot; a choice is a BEAD GROUP, one bead per option; a
// catalogue card is a bead group of the picks enough people made; a
// profile value is a bead on the You arc inside the rim, behind a toggle
// that starts off. Beads of one question sit together with a hairline
// tick between groups, and the budget trims a group as a group — its
// strongest bead stays and the rest fold into a small +n at its place.
// The design is `docs/VISUAL-REQUESTS.md` item 13, drafted on a canvas
// and accepted by the owner 2026-09-11. Ported from the 2026-09-02 standalone's
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
import PATTERNS, { type MapRow, type RowSay } from "../data/patterns";
import { catalogName, loadCatalogNames } from "../data/catalogs";
import { catalogArtUrl, hasCatalogArt } from "../data/catalogArt";
import { edgesOf, mapGeometry, nearOf, type MapNode } from "../data/patternsMap";
// @ts-expect-error TS7016 — untyped spec module (named export, D189)
import { WPAL } from "../spec/world-palette.js";
// @ts-expect-error TS7016 — untyped spec module (named export, convert-on-touch)
import { WORLD_TOPICS } from "../spec/world-feed-topics.js";

// the field: a 352 box, the rim at 131, the topic band just outside it
const S = 352, C = 176, R = 131, RA = 142, RL = 158;
const GAP = 2.6;   // the silence between two topic groups, in dot-steps
const FIG_N = 10;  // how many ties speak at rest
/** The most dots one ring draws (D457): a rim of radius 131 is about 820
 * px around, and past three hundred dots it is a line. Above the budget
 * each topic keeps its strongest hubs, in proportion, and the sentence
 * under the field says how many of the pool are drawn. */
export const MAP_DOT_BUDGET = 300;
/** The pseudo-topic that rings the viewer's own answers (D457). */
export const MAP_TOPIC_ANSWERED = "answered";
/** The You arc's radius — inside the rim, clear of the hub (D460). The
 * canvas put it inside rather than outside: the rim stays a ring of
 * questions, and an arc within it reads as who gives them. */
const YOU_R = 92;

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

/** A gentle arc through a run of points on one radius — the You arc's
 * own line, drawn end to end rather than as a circle segment so it
 * stops where its beads do. */
const arcThrough = (pts: readonly { x: number; y: number }[]): string => {
  if (pts.length < 2) return "";
  const a = pts[0], b = pts[pts.length - 1];
  return `M ${a.x} ${a.y} A ${YOU_R} ${YOU_R} 0 0 1 ${b.x} ${b.y}`;
};

interface RimPoint { i: number; a: number; x: number; y: number }
/** The hairline between two bead groups inside one topic (D460). */
interface RimTick { x0: number; y0: number; x1: number; y1: number; h: number }
/** What the ring needs of a row: its group, its place in it, and the
 * topic arc it sits under. `bead` orders a question's own beads. */
interface RingRow { qid: string; cat: string | null; bead?: number }
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
 * The ring: rows grouped by topic (WORLD_TOPICS order, unknown cats
 * last), a gap between groups, every dot on the same rim. It depends on
 * the ring's identity and nothing else — never on answers — so a vote
 * landing never moves a dot.
 *
 * A QUESTION'S BEADS STAY TOGETHER (D460). Rows carry their `qid`, and
 * the layout keeps a question's rows adjacent inside its topic with a
 * hairline TICK between one question and the next — a tick rather than a
 * gap, because a gap is what separates TOPICS and two silences of
 * different sizes read as one hierarchy, not two. Inside a group the
 * beads touch, which is what makes a group look like one thing.
 */
function ringOf(items: readonly RingRow[]): { pts: RimPoint[]; arcs: RimArc[]; labels: RimLabel[]; ticks: RimTick[]; step: number } {
  const order = (WORLD_TOPICS as Topic[]).map((t) => t.id);
  const cats = [...new Set(items.map((p) => p.cat ?? ""))].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    // an unknown cat sorts last, and by name among its own, so the ring is
    // the same on every device rather than in Set-insertion order
    if (ia < 0 && ib < 0) return a < b ? -1 : a > b ? 1 : 0;
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  // inside a topic, a question's beads are contiguous and in bead order —
  // the ring is the same on every device, and a group is one run
  const groups = cats.map((c) => ({
    cat: c,
    idx: items.map((_, i) => i)
      .filter((i) => (items[i].cat ?? "") === c)
      .sort((x, y) => (items[x].qid < items[y].qid ? -1 : items[x].qid > items[y].qid ? 1 : (items[x].bead ?? 0) - (items[y].bead ?? 0))),
  }));
  const step = (Math.PI * 2) / (items.length + groups.length * GAP);
  const pt = (rad: number, a: number): [number, number] => [f1(C + rad * Math.cos(a)), f1(C + rad * Math.sin(a))];
  const pts = new Array<RimPoint>(items.length);
  const arcs: RimArc[] = [];
  const ticks: RimTick[] = [];
  const labels: RimLabel[] = [];
  const lblBoxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
  let ang = -Math.PI / 2 + (step * GAP) / 2;
  for (const g of groups) {
    const a0 = ang;
    g.idx.forEach((i, k) => {
      const a = ang + step * k;
      const [x, y] = pt(R, a);
      pts[i] = { i, a, x, y };
      // the hairline between one question's beads and the next's
      const prev = k > 0 ? items[g.idx[k - 1]] : null;
      if (prev && prev.qid !== items[i].qid) {
        const t = a - step / 2;
        const [x0, y0] = pt(R - 4, t);
        const [x1, y1] = pt(R + 4, t);
        ticks.push({ x0, y0, x1, y1, h: catHueOf(g.cat) });
      }
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
  return { pts, arcs, labels, ticks, step };
}

/** A chord bundled toward the hub. (Its `chordAt` walker went with the
 * on-field callout, 2026-09-06 — nothing is written on a chord now.) */
const chordD = (A: RimPoint, B: RimPoint): { d: string; qx: number; qy: number } => {
  const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, k = 0.2;
  const qx = C + (mx - C) * k, qy = C + (my - C) * k;
  return { d: `M ${A.x} ${A.y} Q ${f1(qx)} ${f1(qy)} ${B.x} ${B.y}`, qx, qy };
};

/** The viewer's option index on a two-option row, from the encoded ±1. */
const mineIdx = (p: MapRow | undefined): 0 | 1 | null =>
  !p || p.kind !== "bin" || p.mine == null ? null : p.mine === 1 ? 0 : 1;

/** A word for one side of a counted sentence. A catalogue side arrives as
 * its entity KEY — the count never needed the name — so the name is
 * resolved here, from the list the card has already kicked; until it
 * lands the key is not shown, because a raw number in a sentence about
 * people reads as a quantity (the feed's own `pickName` rule). */
const sayWord = (label: string, entity: string | undefined, row: MapRow): string =>
  (entity ? catalogName(row.domain, Number(entity)) ?? "…" : label);

/** What a dot IS, in the fewest words that are true of it — the chip row
 * and the card's kicker both read this. A catalogue bead's own name needs
 * its list, so it comes back null here and the card resolves it. */
const beadLabel = (r: MapRow): string | null => {
  if (r.kind === "pick") return catalogName(r.domain, Number(r.entity));
  if (r.kind === "ord") return "the scale";
  if (r.kind === "bin") return r.optionLabels?.[0] ?? "";
  return r.label;
};

export default function PatternsMap({ items, version, topic, guide = false }: {
  items: MapRow[];
  version: number;
  topic: string;
  /** The tab's one ⓘ — the legend renders only while it is open
   * (VISION-2026-09-06 §2.4). */
  guide?: boolean;
}): React.ReactElement {
  // THE SELECTION IS A QUESTION, NOT A POSITION. `items` is re-derived from
  // the store on every notify — an aggregate page landing adds questions,
  // a retirement removes one — so a stored INDEX names a different question
  // the moment the pool moves and no question at all once it shrinks past
  // the index. Both were reachable from the tab: the open card, its option
  // buttons and the `LIVE.vote` under them all followed the swap, and
  // `nearOf` reached an undefined row and threw the whole tab into the
  // ErrorBoundary. Derived per render rather than memoised — a `findIndex`
  // over the pool is nothing, and a memo here would need `items` in its
  // deps, which is the stale-by-one-notify shape this replaces.
  const [selQ, setSelQ] = React.useState<string | null>(null);
  const [burst, setBurst] = React.useState<{ i: number; t: number } | null>(null);
  // THE YOU ARC IS OFF BY DEFAULT (D460, the owner's yes of 2026-09-10).
  // With it off the Map is a map of QUESTIONS, which is what it has always
  // been and what its every sentence is written against; with it on, the
  // arc inside the rim is who gives the answers — age, gender, country,
  // work — and a solid bead is a value you carry. Off is the default
  // because a reader who has not asked for their demographics on the
  // picture should not find them there.
  const [showYou, setShowYou] = React.useState(false);
  // a chosen topic re-rings the field (D457), so a selection made on one
  // ring does not carry to the next
  React.useEffect(() => { setSelQ(null); }, [topic]);

  // THE RING IS THE TOPIC'S OWN (D457). The chip used to dim the other
  // topics and leave every dot on the rim, which at a few hundred core
  // questions is a rim of touching dots whatever is chosen. Now the ring
  // holds the chosen topic's questions alone — or, under "answered", the
  // viewer's own — and above MAP_DOT_BUDGET each topic keeps its strongest
  // hubs in proportion, the sentence under the field saying how many of
  // the pool are drawn. Geometry recomputes when the pool changes (a vote
  // landing, the loadings arriving — the subscription version, the pool
  // being a pure fold over exactly the state that bumps it) or the topic
  // does.
  const geo = React.useMemo(() => {
    // the You arc's rows are never on the rim: they are the arc, and the
    // toggle decides whether the arc is drawn at all
    const rim = items.filter((p) => p.kind !== "anc");
    const inRing = topic === "all"
      ? rim
      : topic === MAP_TOPIC_ANSWERED
        ? rim.filter((p) => p.mine != null)
        : rim.filter((p) => p.cat === topic);
    let drawn = inRing;
    let folded = new Map<string, number>();
    if (inRing.length > MAP_DOT_BUDGET) {
      // hubs over everything on the ring first — the pick has to see the
      // whole topic to know its strongest — then each topic's share of
      // the budget, rounded up so a small topic keeps at least one dot
      const { hub: hubAll } = mapGeometry(inRing.map((p) => ({ id: p.key, L: p.L, n: p.n })));
      const byCat = new Map<string, number[]>();
      inRing.forEach((p, i) => { const c = p.cat ?? ""; byCat.set(c, [...(byCat.get(c) ?? []), i]); });
      const keep = new Set<number>();
      for (const idx of byCat.values()) {
        const quota = Math.min(idx.length, Math.ceil((MAP_DOT_BUDGET * idx.length) / inRing.length));
        [...idx].sort((a, b) => hubAll[b] - hubAll[a] || a - b).slice(0, quota).forEach((i) => keep.add(i));
      }
      // A GROUP IS TRIMMED AS A GROUP (D460). The quota is blind to bead
      // groups, so on its own it would leave a question with its second
      // and fifth options on the rim and nothing to say that the other
      // three exist. Instead each question keeps its STRONGEST surviving
      // bead and the rest fold into a +n at its place — one dot per
      // question at worst, which is what the old ring drew anyway, and
      // the count is a control: tapping it opens the whole group.
      const bestOf = new Map<string, number>();
      const size = new Map<string, number>();
      inRing.forEach((p, i) => {
        size.set(p.qid, (size.get(p.qid) ?? 0) + 1);
        if (!keep.has(i)) return;
        const cur = bestOf.get(p.qid);
        if (cur === undefined || hubAll[i] > hubAll[cur]) bestOf.set(p.qid, i);
      });
      const kept = new Set(bestOf.values());
      folded = new Map([...bestOf].map(([qid, i]) => [inRing[i].key, (size.get(qid) ?? 1) - 1]).filter(([, n]) => (n as number) > 0) as [string, number][]);
      drawn = inRing.filter((_, i) => kept.has(i));
    }
    const nodes: MapNode[] = drawn.map((p) => ({ id: p.key, L: p.L, n: p.n }));
    const { U, hub } = mapGeometry(nodes);
    const edges = edgesOf(U, 3);
    const ringRows: RingRow[] = drawn.map((p) => ({ qid: p.qid, cat: p.cat, bead: p.opt ?? 0 }));
    return { drawn, onRing: inRing.length, U, hub, edges, folded, ring: ringOf(ringRows) };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version IS the pool's identity (see above)
  }, [version, topic]);
  // THE YOU ARC (D460, the owner's yes). The anchor rows the fit folds
  // (D454) are not questions and do not belong on a rim of questions, so
  // they are their own short arc INSIDE it, labelled YOU: age, gender,
  // country, work — solid where you carry the value. The arc is drawn
  // only while the toggle is on, and it never takes a topic's place.
  const you = React.useMemo(() => {
    if (!showYou) return [] as { row: MapRow; x: number; y: number; a: number }[];
    const rows = items.filter((r) => r.kind === "anc");
    if (!rows.length) return [];
    const span = Math.PI * 0.62;
    const a0 = -Math.PI / 2 - span / 2;
    const step = rows.length > 1 ? span / (rows.length - 1) : 0;
    return rows.map((row, i) => {
      const a = a0 + step * i;
      return { row, a, x: f1(C + YOU_R * Math.cos(a)), y: f1(C + YOU_R * Math.sin(a)) };
    });
  }, [items, showYou]);

  const RG = geo.ring;
  const D = geo.drawn; // every index below is an index into the ring's own items
  // …which is what the selected question resolves against: the ring is the
  // topic's since D457, so a question off the ring is no selection at all.
  const selIdx = selQ == null ? -1 : D.findIndex((p) => p.key === selQ);
  const sel = selIdx >= 0 ? selIdx : null;

  const catHue = (i: number) => catHueOf(D[i]?.cat);
  // `geo` is memoised on `version` while `sel` is derived from `D`, so the
  // row guard is the belt for the invariant that memo's eslint-disable
  // asserts: if the two ever disagree, this draws nothing instead of
  // throwing. (`inTopic` went with D457: the ring holds the topic's own
  // questions now, so there is nothing on it to dim.)
  const nb = sel == null || !geo.U[sel] ? null : nearOf(geo.U, sel, 3);
  const near = nb ? new Set(nb.map((x) => x.j)) : null;
  const rest = geo.edges;
  // The denominator the idle card prints — the questions on this ring —
  // beside the links among them. It printed the whole pool beside a
  // topic-filtered link count once, so with a topic chosen neither number
  // on the line was real; the ring being the topic's own now, both are.
  const inPool = geo.onRing;
  const trimmed = D.length < geo.onRing;
  const shown = sel == null || !nb ? rest : nb.map((x) => ({ i: sel, j: x.j, r: x.r }));
  const selHue = sel == null ? null : catHue(sel);

  // the unanswered question most tied to everything else — the best next tap
  let nxt: number | null = null;
  if (sel == null) {
    let best = -1;
    D.forEach((x, i) => { if (x.mine == null && geo.hub[i] > best) { best = geo.hub[i]; nxt = i; } });
  }

  // The selected question's own links, said out loud — each an exact 2×2
  // fetched on demand and cached for the session (rows shared per qid).
  const selId = sel != null && D[sel] ? D[sel].key : null;
  const [says, setSays] = React.useState<{ id: string; rows: { j: number; s: RowSay | null; failed: boolean }[] } | null>(null);
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
      PATTERNS.sayRow(selId, D[x.j].key)
        .then((s) => ({ j: x.j, s, failed: false }))
        .catch(() => ({ j: x.j, s: null, failed: true }))))
      .then((rows) => { if (on) setSays({ id: selId, rows }); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nb/D follow `version` and `topic`; selId names the selection
  }, [selId]);

  // idle: the strongest link under the current topic filter, said on the
  // field as a callout and under it as one sentence
  const top = sel == null && rest.length ? rest[0] : null;
  const [topSay, setTopSay] = React.useState<{ key: string; s: RowSay | null } | null>(null);
  React.useEffect(() => {
    if (!top) { setTopSay(null); return; }
    const key = `${D[top.i].key}>${D[top.j].key}`;
    setTopSay(null);
    let on = true;
    void PATTERNS.sayRow(D[top.i].key, D[top.j].key)
      .then((s) => { if (on) setTopSay({ key, s }); })
      .catch(() => { if (on) setTopSay({ key, s: null }); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the pair's ids name the fetch; D follows `version` and `topic`
  }, [top ? `${D[top.i].key}:${D[top.j].key}` : null, version]);

  const pick = (i: number) => { const id = D[i]?.key ?? null; setSelQ((s) => (s === id ? null : id)); };

  // A CATALOGUE'S NAMES ARE FETCHED ON THE TAP, never for the rim (D460):
  // a bead is 3 px and carries no text, so the thousand-name list the
  // pokédex or the film catalogue is stays unfetched until a card wants
  // to name something. One kick per domain per session (the store's own
  // cache), and a re-render when it lands — the feed's `pickName` idiom,
  // typed.
  const [named, setNamed] = React.useState(0);
  React.useEffect(() => {
    const domains = new Set<string>();
    if (sel != null && D[sel]?.kind === "pick") domains.add(String(D[sel].domain ?? ""));
    for (const x of nb ?? []) if (D[x.j]?.kind === "pick") domains.add(String(D[x.j].domain ?? ""));
    if (!domains.size) return;
    let on = true;
    void Promise.all([...domains].map((d) => loadCatalogNames(d).catch(() => undefined)))
      .then(() => { if (on) setNamed((n) => n + 1); });
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the selection names the domains; D follows `version`/`topic`
  }, [selQ, version]);
  void named; // the state IS the re-render — nothing reads its value
  const q = sel != null ? D[sel] : null;
  // the tapped dot's own bead group, tapped bead first — the chip row, and
  // what makes a group one thing rather than n dots that happen to touch
  const group = React.useMemo(() => {
    if (!q) return [] as MapRow[];
    const mine = items.filter((r) => r.qid === q.qid);
    return mine.length > 1
      ? [q, ...mine.filter((r) => r.key !== q.key).sort((a, b) => (a.opt ?? 0) - (b.opt ?? 0) || (a.key < b.key ? -1 : 1))]
      : [];
  }, [q, items]);
  const nAns = items.filter((x) => x.mine != null).length;
  // KEYED, LIKE ITS SIBLING. `topSay` has always carried the pair it was
  // fetched for and nothing compared it, and the effect above does not
  // clear it before refetching — so while `say()` is in flight for a new
  // pair (a real read; the session cache misses on a pair not yet opened)
  // the card drew the PREVIOUS pair's pick, percentage and basis sentence
  // under the new pair's question text. Reachable by changing the topic
  // filter while the Map is idle, and it states an exact count — "counted
  // over the N people in both samples" — for a pair the device has read
  // nothing about, which is the one thing D146 exists to stop.
  //
  // The `says` effect ten lines up already does both halves: it clears on
  // entry and gates its render on `says.id === q.key`. This is that.
  const chain = top && topSay && topSay.key === `${D[top.i].key}>${D[top.j].key}`
    ? topSay.s : null;
  // the kicker's word and the sentence's: "Strongest link among your
  // answers" / "…the 12 questions you answered"
  const answeredRing = topic === MAP_TOPIC_ANSWERED;
  const topicWord = topic === "all" ? "" : answeredRing ? " among your answers" : ` in ${catLabel(topic)}`;
  const poolWord = topic === "all" ? " in the pool" : answeredRing ? " you answered" : ` in ${catLabel(topic)}`;

  if (!items.length) {
    return (
      <div className="card" style={{ padding: "22px 18px", textAlign: "center", fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5 }}>
        The fit has published, but none of its questions are on this device yet.
      </div>
    );
  }
  if (!D.length || !RG.pts.length) {
    // a ring with nothing on it — "answered" before the first answer, or
    // a topic whose questions are all off this device
    return (
      <div className="card" style={{ padding: "22px 18px", textAlign: "center", fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", lineHeight: 1.5 }}>
        {answeredRing ? "Nothing you’ve answered is on the map yet." : "None of this topic’s questions are on this device yet."}
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
        {/* the You toggle (D460): off by default, and absent entirely on a
            build whose fit folds no profile values — a control for
            something that is not there is worse than no control */}
        {items.some((r) => r.kind === "anc") && (
          <div className="qm-youbar">
            <button className={"qm-you" + (showYou ? " is-on" : "")} role="switch" aria-checked={showYou}
              onClick={() => setShowYou((v) => !v)}>
              <i></i><span>You</span>
            </button>
          </div>
        )}
        <div className="ln-field">
          <svg className="ln-svg" viewBox={`0 0 ${S} ${S}`} role="img"
            aria-label="Every question on a ring, grouped by topic; lines join questions whose answers predict each other"
            onClick={() => { if (sel != null) setSelQ(null); }}>
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
                  opacity={0.92}></path>
              ))}
              {RG.labels.map((l) => (l.fits ? (
                <text key={l.cat} className="qm-ink" x={l.x} y={l.y} transform={l.tr} fill={labCol(l.h)}
                  textAnchor={l.anchor ?? "middle"} dominantBaseline="middle"
                  opacity={1}
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
                const answered = D[i].mine != null;
                if (i === nxt) return null; // the beacon draws it on the top layer
                // at rest nothing dims: the ring is the topic's own (D457)
                const dim = sel != null ? i !== sel && !(near?.has(i) ?? false) : false;
                const col = dotCol(catHue(i));
                return (
                  <g key={D[i].key} className="qm-dot"
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
                    {/* the rest of a trimmed group, folded into a count at
                        its own place (D460) — the bead that survived is the
                        group's strongest, and the +n says the others exist
                        rather than letting the rim imply they do not */}
                    {(geo.folded.get(D[i].key) ?? 0) > 0 && (
                      <text x={p.x + (p.x > C ? 5 : -5)} y={p.y + 3} textAnchor={p.x > C ? "start" : "end"}
                        fill={col} opacity={dim ? 0.22 : 0.9}
                        style={{ fontSize: 8.5, fontWeight: 800, pointerEvents: "none" }}>
                        +{geo.folded.get(D[i].key)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
            {/* the hairlines between one question's beads and the next's
                (D460) — a tick, not a gap: a gap is what parts TOPICS, and
                two silences of different sizes read as one hierarchy */}
            <g>
              {RG.ticks.map((t, k) => (
                <line key={k} x1={t.x0} y1={t.y0} x2={t.x1} y2={t.y1}
                  stroke={arcCol(t.h)} strokeWidth="0.7" opacity="0.5"></line>
              ))}
            </g>
            {/* the You arc, inside the rim and only while it is on (D460) */}
            {you.length > 0 && (
              <g className="qm-ink">
                <path d={arcThrough(you)} fill="none" stroke="var(--ln-beacon)" strokeWidth="1.2" opacity="0.5"></path>
                <text x={you[0].x - 6} y={you[0].y + 4} textAnchor="end" fill="var(--ln-sub)"
                  style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".12em" }}>YOU</text>
                {you.map(({ row, x, y }) => (
                  <g key={row.key} onClick={(e) => { e.stopPropagation(); setSelQ((s) => (s === row.key ? null : row.key)); }}
                    style={{ cursor: "pointer" }}>
                    <circle cx={x} cy={y} r="10" fill="transparent"></circle>
                    <circle cx={x} cy={y} r="3.1"
                      fill={row.mine === 1 ? "var(--ln-beacon)" : "var(--ln-halo)"}
                      stroke="var(--ln-beacon)" strokeWidth={row.mine === 1 ? 0 : 1.1}
                      opacity={row.mine === 1 ? 1 : 0.7}></circle>
                  </g>
                ))}
              </g>
            )}
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
                <g role="button" tabIndex={0} aria-label={`Answer next: ${D[p.i].title}`}
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
              {catLabel(q.cat)}
            </span>
            {q.mine != null && (
              <span className="qm-yours">you said {q.options?.[mineIdx(q) ?? 0]?.label ?? beadLabel(q)}</span>
            )}
          </div>
          <div className="qm-prompt">{q.title}</div>
          {/* THE CHIP ROW (D460). A question with several answers first has
              to say WHICH answer its ties are about, so a bead group's card
              opens on the tapped bead and the row switches between its
              siblings — the ties are re-read on the chip, because a chord's
              sign is per answer and a four-answer question has four chord
              sets. A two-option dot and a scale have one axis and so no row.
              The tapped bead leads, then the rest in bead order; a
              catalogue bead wears its picture, which is where the pictures
              belong — a 3 px bead on the rim can carry none. */}
          {group.length > 1 && (
            <div className="qm-chips" role="tablist" aria-label="Which answer">
              {group.map((g) => {
                const on = g.key === q.key;
                const art = g.kind === "pick" && hasCatalogArt(String(g.domain ?? ""))
                  ? catalogArtUrl(String(g.domain ?? ""), Number(g.entity)) : null;
                return (
                  <button key={g.key} className={"qm-chip" + (on ? " is-on" : "")} role="tab" aria-selected={on}
                    onClick={() => setSelQ(g.key)}>
                    {art && <img src={art} alt="" width={18} height={18} loading="lazy" />}
                    <span>{beadLabel(g) ?? "…"}</span>
                  </button>
                );
              })}
            </div>
          )}
          {q.mine == null && (
            <div className="qm-opts">
              {(q.options ?? []).map((op) => (
                <button key={op.id} className="qm-opt"
                  onClick={() => { LIVE.vote(q.key, op.id); setBurst({ i: sel, t: Date.now() }); }}>
                  {op.label}
                </button>
              ))}
            </div>
          )}
          <div className="qm-says">
            {says && says.id === q.key && says.rows.filter((x) => x.s).length === 0 && (
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
            {says && says.id === q.key && says.rows.some((x) => x.s) && (
              <span style={{ paddingTop: 8, borderTop: "1px solid color-mix(in oklch, var(--rule), transparent 30%)", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", textWrap: "pretty" }}>
                Each link is a straight count over the people the basis names · “usually” is how they split regardless of the first pick.
              </span>
            )}
            {says && says.id === q.key && says.rows.map(({ j, s }, k) => {
              if (!s) return null;
              const to = D[j];
              return (
                <div className="qm-say" key={k}>
                  {/* THE SENTENCE IS THE SAME SHAPE FOR EVERY KIND (D460),
                      because the count is: "pick this here — and N% pick
                      that there". What changes is the words for a side —
                      an option's label, a catalogue name, "high" on a
                      scale, a profile value — and the BASIS line below,
                      which says which population it was counted over. */}
                  <span className="qm-saytext">
                    {q.kind === "ord" ? <>Rate it <b>{s.pick}</b></> : <>Pick <b>{sayWord(s.pick, s.pickEntity, q)}</b></>}
                    {" here — and "}<b>{s.pct}%</b>{" "}
                    {to.kind === "ord" ? <>rate <b>{s.then}</b></> : <>pick <b>{sayWord(s.then, s.thenEntity, to)}</b></>}
                    {" on "}{"“" + to.title + "”"}
                  </span>
                  <span className="qm-saybar">
                    <i style={{ width: `${s.pct}%`, background: WPAL.wash(`oklch(0.56 0.11 ${selHue})`, 44) as string }}></i>
                    <em style={{ left: `${s.base}%` }}></em>
                  </span>
                  <span className="qm-base">
                    <span style={{ left: `${Math.max(12, Math.min(86, s.base))}%` }}>usually {s.base}%</span>
                  </span>
                  {/* the stated basis — the D146 rule the prototype had no
                      data to need, and since D460 it also says WHICH
                      population: two samples intersected, or one
                      question's sample cut by the chips it carries */}
                  <span className="qm-foot">{s.over === "one"
                    ? `of the ${s.both} in that question’s sample who filled the box in`
                    : `of the ${s.both} in both samples`}</span>
                  {/* "you went the other way" — the one place the card
                      reads the VIEWER. It survives every kind: an option
                      index where the target has one, and for a bead the
                      plain fact that they picked something else. */}
                  {s.thenIdx != null && to.mine != null && (to.kind === "bin"
                    ? mineIdx(to) !== s.thenIdx && (
                      <span className="qm-break">you went {to.options?.[mineIdx(to) as number]?.label}</span>
                    )
                    : to.mine === -1 && <span className="qm-break">you didn’t</span>
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
                  {" on "}{D[top.i].title}{" → "}
                  <b style={{ fontFamily: "var(--sans)", fontSize: 13.5, fontWeight: 800, color: inkCol(catHue(top.j)) }}>{chain.then}</b>
                  {" on "}{D[top.j].title}
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
              <span>links hold across the {inPool} questions{poolWord}{trimmed ? `; ${D.length} of them drawn, each topic's strongest` : "; the strongest are drawn"}. Tap any dot to read its own.</span>
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

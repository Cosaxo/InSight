// peopleMap.ts — the People lens's arithmetic (D214): the crowd as a shared
// map with no centre. The Mirror's field is radial (you at the origin,
// closer = more like you); this is deliberately the OTHER grammar — one
// plane that exists whether you look or not, and you sit wherever your
// answers put you. Ported from the 2026-08-20 standalone's people-lens.jsx
// (design/standalone-people-2026-08-20/) with its engine replaced: the
// prototype placed 560 invented people through a simulated activity hash;
// here every row is a real voter from the lists live.ts already caches,
// and every position is a device-side ridge solve over the published
// loadings — the same estimateTheta the Oracle already runs for you.
//
// The honesty rules, as the prototype itself states them, are the spec:
//   position   · the only geometry — no axes, no rings, no lines between
//                people (a line between strangers reads as a relationship)
//   every dot  · a real member of the crowd; zero decorative dots or mist
//   confidence · fewer shared answers = smaller + fainter; under the
//                floor, not drawn — a near-empty solve shrinks to the
//                origin, and the middle of the map must never be where
//                the lens parks people it knows nothing about
//   numbers    · every claim beside a name is an exact count with its
//                basis ("9 of 12 shared answers"), never a cosine
//
// Pure on purpose (the patternsMap.ts posture): no Firebase, no window,
// no RNG anywhere — same inputs, same field, so the whole pipeline is
// testable without a device and the constellation cannot reshuffle
// between renders.
import { estimateTheta } from "./patternsMap";
import { angleHash } from "./similarity";

/** The drawn frame — the question map's own card proportions. */
export const PEOPLE_W = 344;
export const PEOPLE_H = 330;
const PADX = 26;
const PADY = 30;

/** The floor under "placed": three binary answers is a coin run, four is
 * the least that can show a pattern (the prototype's own value). */
export const PEOPLE_MIN_SHARED = 4;
/** Under this many placeable people the field is a guess dressed as a
 * crowd — the lens says "too thin" instead. */
export const PEOPLE_MIN_CROWD = 8;
/** Under this many own answers the viewer has no honest position either. */
export const PEOPLE_MIN_ANSWERED = 5;
/** Voter lists fetched per session — KINDRED_QUESTIONS' reasoning exactly:
 * a legible basis, cost linear in this number, every list shared with the
 * who-voted sheet, Kindred and the pair card through live.ts's cache. */
export const PEOPLE_QUESTIONS = 12;
/** At most this many dots carry a name label; the rest name on tap. */
export const PEOPLE_LABELS = 5;

/** One pool question, slimmed to what the fold reads (PoolItem, narrowed —
 * the component adapts; keeping the shape local keeps this module pure). */
export interface PeopleItem {
  qid: string;
  /** The published loading vector. */
  L: readonly number[];
  /** Answers the fit folded — the loading's basis. */
  n: number;
  /** The fit's running marginal of the encoded answer, in [-1, 1]. */
  marginal: number;
  /** The viewer's encoded answer (+1 option 0 / −1 option 1), or null. */
  mine: number | null;
  /** Option labels, for the tie sentence. */
  optionLabels: readonly string[];
}

/** One cached voter row, as live.ts's `voters(qid)` returns them. */
export interface PeopleRow {
  uid: string;
  optionIdx: number;
  name: string;
  anchors: Readonly<Record<string, string>>;
  isMe: boolean;
}

export interface PlacedPerson {
  uid: string;
  /** First name, or "" for an account with none (drawn, named "Someone"). */
  name: string;
  /** Frozen anchor chips from the answer, never the live profile (D8). */
  chips: string[];
  /** Decorative stable hue — claims nothing (the similarity-field idiom). */
  hue: number;
  /** Plane coordinates (unit-θ components) — kept for tests and captions. */
  px: number;
  py: number;
  /** Pixel position inside PEOPLE_W × PEOPLE_H, after de-overlap. */
  x: number;
  y: number;
  r: number;
  op: number;
  /** Shared answers seen in the fetched samples — the stated basis. */
  shared: number;
  agree: number;
  /** The rarest answer you share: label and its crowd share, from the
   * fit's own marginal. Null when you split on everything you share. */
  tie: { label: string; share: number } | null;
  /** Name-label anchor, when a collision-free spot exists near the dot. */
  lab: { x: number; y: number } | null;
}

export interface PeopleField {
  placed: PlacedPerson[];
  me: { x: number; y: number; r: number };
  /** The viewer's answered pool questions — the summary card's figure. */
  answered: number;
  /** The floor `placed` cleared — for tests; the UI states counts, not this. */
  minShared: number;
}

/**
 * Which questions' voter lists the lens asks for: the viewer's answered
 * pool questions, strongest loading basis first. Recency would match
 * Kindred's choice but the client vote map carries no timestamps; basis
 * is the honest second choice — it favours questions whose vectors are
 * settled, which is where a candidate's position means the most.
 */
export function peopleFetchSet(items: readonly PeopleItem[], cap = PEOPLE_QUESTIONS): string[] {
  return items
    .filter((i) => i.mine != null)
    .sort((a, b) => b.n - a.n || (a.qid < b.qid ? -1 : 1))
    .slice(0, cap)
    .map((i) => i.qid);
}

const unit = (v: readonly number[]): number[] => {
  let s = 0;
  for (const x of v) s += x * x;
  const d = Math.sqrt(s);
  return d > 0 ? v.map((x) => x / d) : v.map(() => 0);
};

/**
 * Fold the cached voter rows into a drawn field.
 *
 * `fetched` is the qid set the lens asked live.ts for; `rowsOf` returns a
 * question's cached rows or null while unfetched — the fold folds what is
 * there, and the component decides whether "thin" means loading or means
 * the honest empty state.
 *
 * One deliberate transposition from the prototype, recorded at D214: its
 * placement floor was max(4, 32% of ALL your answers), computed against a
 * simulated crowd whose shares had no ceiling. Live shares are bounded by
 * the fetch cap, so the same ratio runs over the fetch horizon instead —
 * against the unbounded count, an active viewer's floor would sit above
 * the cap and nobody could ever be placed.
 */
export function foldPeople(
  items: readonly PeopleItem[],
  fetched: readonly string[],
  rowsOf: (qid: string) => readonly PeopleRow[] | null,
): PeopleField {
  const byQid = new Map(items.map((i) => [i.qid, i]));
  const mineAll = items.filter((i) => i.mine != null);
  const k = items.length ? items[0].L.length : 0;
  const minShared = Math.max(PEOPLE_MIN_SHARED, Math.round(fetched.length * 0.32));

  interface Acc {
    uid: string;
    name: string;
    anchors: Readonly<Record<string, string>>;
    obs: { L: readonly number[]; r: number }[];
    shared: number;
    agree: number;
    tie: { label: string; share: number } | null;
  }
  const acc = new Map<string, Acc>();
  for (const qid of fetched) {
    const item = byQid.get(qid);
    const rows = item && item.mine != null ? rowsOf(qid) : null;
    if (!item || !rows) continue;
    for (const row of rows) {
      // The viewer is their own dot, solved from ALL their answers below;
      // out-of-range option indices are another surface's rows (catalog,
      // scale) and fold to nothing rather than to a wrong ±1.
      if (row.isMe || (row.optionIdx !== 0 && row.optionIdx !== 1)) continue;
      const enc = row.optionIdx === 0 ? 1 : -1;
      let a = acc.get(row.uid);
      if (!a) {
        a = { uid: row.uid, name: row.name, anchors: row.anchors, obs: [], shared: 0, agree: 0, tie: null };
        acc.set(row.uid, a);
      }
      a.obs.push({ L: item.L, r: enc - item.marginal });
      a.shared += 1;
      if (enc === item.mine) {
        a.agree += 1;
        // the rarest answer you share — its crowd share read off the
        // fit's own marginal, the same figure the loading publishes
        const share = row.optionIdx === 0 ? (1 + item.marginal) / 2 : (1 - item.marginal) / 2;
        if (!a.tie || share < a.tie.share) {
          a.tie = { label: item.optionLabels[row.optionIdx] ?? "", share };
        }
      }
    }
  }

  const placed: PlacedPerson[] = [];
  for (const a of acc.values()) {
    if (a.shared < minShared) continue;
    const u = unit(estimateTheta(a.obs, k));
    const t = Math.max(0, Math.min(1, (a.shared - minShared) / Math.max(1, fetched.length - minShared)));
    placed.push({
      uid: a.uid,
      name: String(a.name || "").split(" ")[0],
      chips: [a.anchors.city, a.anchors.age].filter((c): c is string => !!c),
      hue: Math.round(angleHash(a.uid + "#hue") * 360),
      px: u[0] ?? 0,
      py: u[1] ?? 0,
      x: 0,
      y: 0,
      r: 4.5 + t * 3,
      op: 0.55 + t * 0.45,
      shared: a.shared,
      agree: a.agree,
      tie: a.tie,
      lab: null,
    });
  }

  const meU = unit(estimateTheta(mineAll.map((i) => ({ L: i.L, r: (i.mine as number) - i.marginal })), k));
  const mePx = meU[0] ?? 0;
  const mePy = meU[1] ?? 0;

  // plane → pixels, framed by the people actually shown (plus you)
  let mx = 0.2;
  for (const p of placed) mx = Math.max(mx, Math.abs(p.px), Math.abs(p.py));
  mx = Math.max(mx, Math.abs(mePx), Math.abs(mePy));
  const X = (v: number) => PEOPLE_W / 2 + (v / mx) * (PEOPLE_W / 2 - PADX);
  const Y = (v: number) => PEOPLE_H / 2 + (v / mx) * (PEOPLE_H / 2 - PADY);
  for (const p of placed) {
    p.x = X(p.px);
    p.y = Y(p.py);
  }
  const me = { x: X(mePx), y: Y(mePy), r: 5.75 };

  // nudge overlaps apart — position stays the data, only crowding is eased
  const all: { x: number; y: number; r: number }[] = [...placed, me];
  for (let it = 0; it < 50; it++) {
    let moved = false;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const P1 = all[i];
        const P2 = all[j];
        let dx = P1.x - P2.x;
        let dy = P1.y - P2.y;
        let d = Math.hypot(dx, dy);
        const need = P1.r + P2.r + 5;
        if (d < need) {
          moved = true;
          if (d < 0.01) {
            dx = 1;
            dy = 0;
            d = 1;
          }
          const push = (need - d) / 2;
          P1.x += (dx / d) * push;
          P1.y += (dy / d) * push;
          P2.x -= (dx / d) * push;
          P2.y -= (dy / d) * push;
        }
      }
    }
    if (!moved) break;
  }
  for (const p of all) {
    p.x = Math.max(14, Math.min(PEOPLE_W - 14, p.x));
    p.y = Math.max(16, Math.min(PEOPLE_H - 14, p.y));
  }

  // name the nearest few — a label's rect must clear every dot and label
  const rects: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const clearRect = (rc: { x0: number; x1: number; y0: number; y1: number }, self: PlacedPerson) => {
    if (rc.x0 < 4 || rc.x1 > PEOPLE_W - 4 || rc.y0 < 2 || rc.y1 > PEOPLE_H - 2) return false;
    if (rects.some((o) => rc.x0 < o.x1 && rc.x1 > o.x0 && rc.y0 < o.y1 && rc.y1 > o.y0)) return false;
    const hits = (p: { x: number; y: number; r: number }) => {
      const cx = Math.max(rc.x0, Math.min(p.x, rc.x1));
      const cy = Math.max(rc.y0, Math.min(p.y, rc.y1));
      return Math.hypot(p.x - cx, p.y - cy) < p.r + 2.5;
    };
    return !all.some((p) => p !== self && hits(p));
  };
  const near = [...placed].sort(
    (a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y),
  );
  const used = new Set<string>();
  let labeled = 0;
  for (const p of near) {
    if (labeled >= PEOPLE_LABELS) break;
    // The prototype drew invented names for nameless accounts; live does
    // not (D167) — an unnamed dot stays unlabeled and reads "Someone" on
    // its card, the who-voted convention.
    if (!p.name || used.has(p.name)) continue;
    const w = p.name.length * 6 + 4;
    const h = 12;
    const cands = [
      { x: p.x, y: p.y + p.r + 4 },
      { x: p.x, y: p.y - p.r - 16 },
      { x: p.x + p.r + 7 + w / 2, y: p.y - 6 },
      { x: p.x - p.r - 7 - w / 2, y: p.y - 6 },
    ];
    for (const c of cands) {
      const rc = { x0: c.x - w / 2, x1: c.x + w / 2, y0: c.y, y1: c.y + h };
      if (clearRect(rc, p)) {
        p.lab = { x: c.x, y: c.y + 9.5 };
        rects.push(rc);
        used.add(p.name);
        labeled++;
        break;
      }
    }
  }

  return { placed, me, answered: mineAll.length, minShared };
}

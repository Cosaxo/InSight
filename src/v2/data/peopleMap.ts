// peopleMap.ts — the People lens's arithmetic (D214): the crowd as a shared
// map with no centre. The Mirror's field is radial (you at the origin,
// closer = more like you); this is deliberately the OTHER grammar — one
// plane that exists whether you look or not, and you sit wherever your
// answers put you. Ported from the 2026-08-20 standalone's people-lens.jsx
// (design/standalone-2026-08-20/) with its engine replaced: the
// prototype placed 560 invented people through a simulated activity hash;
// here every row is a real voter from the lists live.ts already caches,
// and every position is a device-side ridge solve over the published
// loadings — the same estimateTheta the Oracle already runs for you.
//
// The honesty rules, as the prototype itself states them, are the spec:
//   position   · the only geometry — no axes, no rings, no lines between
//                people (a line between strangers reads as a relationship)
//   every dot  · a real member of the crowd; zero decorative dots or mist
//   colour     · says ONE thing, in three plain steps: mostly agrees with
//                you, split, mostly disagrees — counted over the answers
//                you share (the lens folds the step; the counts are here)
//   confidence · fewer shared answers = a smaller dot; under the floor,
//                not drawn — a near-empty solve shrinks to the origin,
//                and the middle of the map must never be where the lens
//                parks people it knows nothing about
//   numbers    · every claim beside a name is an exact count with its
//                basis ("9 of 12 shared answers"), never a cosine
//
// SINCE 2026-09-02 the frame is a DISC, not a card (the shared instrument
// — VISION-2026-09-02 §1.1/§1.4): the plane is framed by the farthest
// person, everyone is clamped inside the rim, and the decorative per-uid
// hue is gone. It had claimed nothing, which was the problem: on a field
// where colour now means agreement, a second colour language reads as a
// second claim.
//
// Pure on purpose (the patternsMap.ts posture): no Firebase, no window,
// no RNG anywhere — same inputs, same field, so the whole pipeline is
// testable without a device and the constellation cannot reshuffle
// between renders.
import { DEFAULT_LAMBDA_U, estimateTheta } from "./patternsMap";

/** The drawn frame — the shared instrument's square field. */
export const PEOPLE_W = 352;
export const PEOPLE_H = 352;
/** Its centre, and how far from it the farthest person is placed. */
export const PEOPLE_C = 176;
export const PEOPLE_RMAX = 150;

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
/** The circle view's own crowd floor (D216). PEOPLE_MIN_CROWD guards an
 * ANONYMOUS crowd — eight strangers is the least that reads as one. Your
 * circle is named people you chose (FOLLOW_CAP-bounded), each drawn with
 * its stated basis, so the view draws from the first placeable friend. */
export const PEOPLE_MIN_CROWD_CIRCLE = 1;

/** The country code off a frozen city anchor ("Oslo, NO" → "NO"), or null
 * where the anchor is absent or carries no code — a person the country
 * filter then simply cannot claim. */
export function countryOf(city: string | undefined): string | null {
  const m = /,\s*([A-Z]{2})$/.exec(city ?? "");
  return m ? m[1] : null;
}

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
  /** Plane coordinates (unit-θ components) — kept for tests and captions. */
  px: number;
  py: number;
  /** Pixel position inside PEOPLE_W × PEOPLE_H, after de-overlap. */
  x: number;
  y: number;
  r: number;
  /** True on the larger of the two dot sizes — more answers in common.
   * Two steps, not a continuum: a 4px ramp read as jitter, and the size
   * is a rank, not a measurement. */
  many: boolean;
  /** Shared answers seen in the fetched samples — the stated basis. */
  shared: number;
  agree: number;
  /** The rarest answer you share: label and its crowd share, from the
   * fit's own marginal. Null when you split on everything you share. */
  tie: { label: string; share: number } | null;
  /** Name-label anchor, when a spot exists near the dot: the least
   * crowded of four, with the text-anchor that spot wants. */
  lab: { x: number; y: number; anchor: "start" | "middle" | "end" } | null;
}

export interface PeopleField {
  placed: PlacedPerson[];
  me: { x: number; y: number; r: number };
  /** The viewer's answered pool questions. What the viewer's OWN dot is
   *  solved from, and the figure the mount gate reads. */
  answered: number;
  /**
   * How many questions the CROWD was placed from — the fetched lists the
   * fold actually read, which is capped at PEOPLE_QUESTIONS.
   *
   * Separate from `answered` because the two are different numbers and the
   * card was printing the wrong one: "placed around you, from the 40
   * questions you've answered here" over a crowd folded from twelve, while
   * every dot the reader taps says "12 of 12 shared answers". The card and
   * its own detail view contradicted each other on one screen, by up to
   * about nine times at a full pool.
   */
  basis: number;
  /** The floor `placed` cleared — the card states it ("everyone who
   * answered at least N of your questions"), and tests read it. */
  minShared: number;
  /** The named people nearest you, nearest first — a LAYOUT set, not a
   * ranking. Exactly the ones that carry a label on the field, so the
   * labels and the drawing never disagree about who is close. It fed the
   * "Most like you" rail until 2026-09-04, and that is the sentence this
   * docstring used to carry: proximity here is two components of an
   * eight-dimensional solve, so it is the right answer for placing labels
   * and the wrong one for ranking likeness. `alike` is that ranking. */
  near: PlacedPerson[];
  /** The people who actually agree with you most, for the rail that says
   * so — ranked on the agreement rate each chip already prints. */
  alike: PlacedPerson[];
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
export interface PeopleFoldOpts {
  /** The population filter (D216): only rows it passes are placed. The
   * viewer is always drawn — a population that excludes you is not a
   * place you can be looking from. Framing, de-overlap and labels all
   * rerun on the filtered set, so each population is its own picture. */
  keep?: (uid: string, anchors: Readonly<Record<string, string>>) => boolean;
  /** The viewer's follow list — a member's chips read "your circle"
   * instead of demographics (the prototype's own swap), in EVERY
   * population, because knowing a friend when you see one outranks a
   * city band you already know. */
  circle?: ReadonlySet<string>;
  /**
   * The viewer's OWN evidence, when the caller has more of it than the
   * two-option pool carries (D384): every answer the published rows can
   * encode — ordinal and pick items included — as the centred residuals
   * the fit is written in. Strangers are still placed from the fetched
   * two-option lists (a voter row is one option index on one two-option
   * question); the viewer's dot is solved from everything known about
   * them, which is the honesty rule pointed at the one person the lens
   * can know that much about. Absent, the viewer is solved from the pool
   * like everyone else.
   */
  viewerObs?: readonly { L: readonly number[]; r: number }[];
  /** The device ridge, as the fit published it (D383); the shipped value
   * otherwise. Both solves — strangers' and the viewer's — use it. */
  lambda?: number;
}

export function foldPeople(
  items: readonly PeopleItem[],
  fetched: readonly string[],
  rowsOf: (qid: string) => readonly PeopleRow[] | null,
  opts: PeopleFoldOpts = {},
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

  const lambda = opts.lambda ?? DEFAULT_LAMBDA_U;
  const placed: PlacedPerson[] = [];
  for (const a of acc.values()) {
    if (a.shared < minShared) continue;
    if (opts.keep && !opts.keep(a.uid, a.anchors)) continue;
    const u = unit(estimateTheta(a.obs, k, lambda));
    const t = Math.max(0, Math.min(1, (a.shared - minShared) / Math.max(1, fetched.length - minShared)));
    placed.push({
      uid: a.uid,
      name: String(a.name || "").split(" ")[0],
      chips: opts.circle?.has(a.uid)
        ? ["your circle"]
        : [a.anchors.city, a.anchors.age].filter((c): c is string => !!c),
      px: u[0] ?? 0,
      py: u[1] ?? 0,
      x: 0,
      y: 0,
      r: t > 0.5 ? 5 : 3.4,
      many: t > 0.5,
      shared: a.shared,
      agree: a.agree,
      tie: a.tie,
      lab: null,
    });
  }

  const meU = unit(estimateTheta(
    opts.viewerObs && opts.viewerObs.length
      ? opts.viewerObs
      : mineAll.map((i) => ({ L: i.L, r: (i.mine as number) - i.marginal })),
    k,
    lambda,
  ));
  const mePx = meU[0] ?? 0;
  const mePy = meU[1] ?? 0;

  // plane → the disc, framed by the farthest person actually shown (plus
  // you). Radial, not per-axis: the frame is a circle now, so scaling each
  // axis by its own extreme would stretch the picture into an ellipse the
  // rim then clips.
  let mx = 0.2;
  for (const p of placed) mx = Math.max(mx, Math.hypot(p.px, p.py));
  mx = Math.max(mx, Math.hypot(mePx, mePy));
  const X = (v: number) => PEOPLE_C + (v / mx) * PEOPLE_RMAX;
  const Y = (v: number) => PEOPLE_C + (v / mx) * PEOPLE_RMAX;
  for (const p of placed) {
    p.x = X(p.px);
    p.y = Y(p.py);
  }
  const me = { x: X(mePx), y: Y(mePy), r: 6 };

  // nudge overlaps apart — position stays the data, only crowding is eased
  const all: { x: number; y: number; r: number }[] = [...placed, me];
  // ON A GRID, not all-pairs. `placed` is bounded but not small: a uid
  // qualifies at `minShared` of the PEOPLE_QUESTIONS lists and each list is
  // capped at VOTER_FETCH_CAP, which puts the ceiling in the hundreds — and
  // this ran n(n-1)/2 `Math.hypot` calls fifty times over, on the device,
  // every time the field is folded. At n = 300 that is ~2.2M distance tests
  // to move a few dots apart.
  //
  // Two circles can only need pushing if their centres are within
  // `P1.r + P2.r + 5`, and the radii here are bounded — read them off the
  // two literals above rather than from here, because this sentence
  // quoted `4.5 + t * 3` and `5.75` for a while after the commit that
  // replaced both, and an argument that cites numbers the code no longer
  // has is worse than one that says where to look — so CELL below is at
  // or above the largest gap
  // that can matter. A pair further apart than one cell cannot collide,
  // which makes the 3×3 neighbourhood exhaustive rather than approximate:
  // the same pairs are tested, the ones that could never touch are not.
  //
  // Same shape as `relax()` in data/patternsMap.ts, which declutters the
  // question map — including re-bucketing once per pass rather than after
  // every push, so a dot that a push carries into a new cell is picked up
  // by the next pass. Fifty passes; the physics does not notice.
  const CELL = 20; // ≥ 2 × max radius (6) + the 5 px gap
  const cellKey = (cx: number, cy: number) => cx * 100003 + cy;
  for (let it = 0; it < 50; it++) {
    let moved = false;
    const grid = new Map<number, number[]>();
    for (let i = 0; i < all.length; i++) {
      const k = cellKey(Math.floor(all[i].x / CELL), Math.floor(all[i].y / CELL));
      const bucket = grid.get(k);
      if (bucket) bucket.push(i); else grid.set(k, [i]);
    }
    for (let i = 0; i < all.length; i++) {
      const P1 = all[i];
      const cx = Math.floor(P1.x / CELL);
      const cy = Math.floor(P1.y / CELL);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const bucket = grid.get(cellKey(cx + ox, cy + oy));
          if (!bucket) continue;
          for (const j of bucket) {
            // Each pair once, and in the same direction as the old
            // `j = i + 1` walk — the push is symmetric, so visiting a pair
            // twice would double it.
            if (j <= i) continue;
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
      }
    }
    if (!moved) break;
  }
  // back inside the rim — the push above can carry a dot over the edge of
  // a round field, where a rectangular clamp would leave it in the corner
  for (const p of all) {
    const d = Math.hypot(p.x - PEOPLE_C, p.y - PEOPLE_C);
    const lim = PEOPLE_C - p.r - 12;
    if (d > lim) {
      p.x = PEOPLE_C + ((p.x - PEOPLE_C) * lim) / d;
      p.y = PEOPLE_C + ((p.y - PEOPLE_C) * lim) / d;
    }
  }

  // Name the nearest few. A label takes the LEAST CROWDED of four spots
  // rather than the first that happens to be clear (2026-09-02): on the
  // round field the old first-fit walk dropped a name whenever all four
  // candidates touched something, and a near neighbour with no name reads
  // as a stranger. Scored instead — outside the rim or overlapping a
  // placed label is disqualifying (+100), a near miss and each dot the box
  // covers are penalties — so the label lands where it costs least.
  const rects: { x0: number; x1: number; y0: number; y1: number }[] = [
    // your own "you" word, so no name is written over it
    { x0: me.x + 12, x1: me.x + 40, y0: me.y - 7, y1: me.y + 6 },
  ];
  const nearest = [...placed].sort(
    (a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y),
  );
  const used = new Set<string>();
  const near: PlacedPerson[] = [];
  for (const p of nearest) {
    if (near.length >= PEOPLE_LABELS) break;
    // The prototype drew invented names for nameless accounts; live does
    // not (D167) — an unnamed dot stays unlabeled, reads "Someone" on its
    // card (the who-voted convention), and never reaches the rail either:
    // a chip with no name to carry would be an identity the fold invented.
    if (!p.name || used.has(p.name)) continue;
    const w = p.name.length * 6.6 + 4;
    const h = 11;
    const cands: { x: number; y: number; anchor: "start" | "middle" | "end" }[] = [
      { x: p.x, y: p.y + p.r + 3, anchor: "middle" },
      { x: p.x, y: p.y - p.r - 14, anchor: "middle" },
      { x: p.x + p.r + 5, y: p.y - 5.5, anchor: "start" },
      { x: p.x - p.r - 5, y: p.y - 5.5, anchor: "end" },
    ];
    let best: { s: number; rc: { x0: number; x1: number; y0: number; y1: number }; c: typeof cands[number] } | null = null;
    for (const c of cands) {
      const x0 = c.anchor === "middle" ? c.x - w / 2 : c.anchor === "start" ? c.x : c.x - w;
      const rc = { x0, x1: x0 + w, y0: c.y, y1: c.y + h };
      let sc = Math.hypot(rc.x0 + w / 2 - PEOPLE_C, rc.y0 + h / 2 - PEOPLE_C) > PEOPLE_C - 8 ? 100 : 0;
      if (rects.some((o) => rc.x0 < o.x1 && rc.x1 > o.x0 && rc.y0 < o.y1 && rc.y1 > o.y0)) sc += 100;
      if (rects.some((o) => rc.x0 < o.x1 + 14 && rc.x1 > o.x0 - 14 && rc.y0 < o.y1 + 14 && rc.y1 > o.y0 - 14)) sc += 2;
      for (const qd of all) {
        if (qd !== p && qd.x > rc.x0 - 1 && qd.x < rc.x1 + 1 && qd.y > rc.y0 - 1 && qd.y < rc.y1 + 1) sc += 1;
      }
      if (!best || sc < best.s) best = { s: sc, rc, c };
    }
    if (!best) continue;
    rects.push(best.rc);
    p.lab = { x: Math.round(best.c.x * 10) / 10, y: Math.round((best.c.y + 9) * 10) / 10, anchor: best.c.anchor };
    used.add(p.name);
    near.push(p);
  }

  // THE RAIL SAYS "MOST LIKE YOU", SO IT RANKS ON LIKENESS.
  //
  // It used to render `near`, which is this fold's LABEL set: the people
  // whose dots sit closest to yours, chosen so the labels on the field do
  // not collide. Position is two components of a unit-normalised
  // EIGHT-dimensional solve, so six dimensions of agreement are discarded
  // before that distance is taken — and the rail could therefore lead
  // with the person who agrees with you least, wearing the "mostly
  // disagrees" colour, under the words "Most like you", while the real
  // 11-of-12 match sat at the far rim.
  //
  // The honest number is already on every person and already printed on
  // the chip. `near` keeps its job — labels are a layout problem and
  // proximity is the right answer there — and the rail gets its own list.
  //
  // Everyone here has already cleared `minShared`, so a rate is a rate;
  // ties go to the bigger overlap, then to the name so the order cannot
  // depend on iteration order.
  const alike = [...placed]
    .filter((p) => !!p.name && p.shared > 0)
    .sort((a, b) =>
      (b.agree / b.shared) - (a.agree / a.shared)
      || b.shared - a.shared
      || a.name.localeCompare(b.name))
    .slice(0, PEOPLE_LABELS);

  // `fetched` is what the caller asked the store for; the basis is how
  // many of those actually came back with rows, because a list that
  // failed or was refused placed nobody.
  const basis = fetched.filter((qid) => (rowsOf(qid) || []).length > 0).length;
  return { placed, me, answered: mineAll.length, basis, minShared, near, alike };
}

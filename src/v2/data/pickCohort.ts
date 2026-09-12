// Reading a cohort out of a CATALOGUE board — cohort.ts, one shape over.
//
// `v2_question_aggs.by` is the same three-level map for a pick question as
// for every other one (dim → bucket → key → count), folded from the same
// anchors snapshot (D8). The only difference is what the third level is
// keyed BY: an option index for a question with options, a catalogue key
// for a pick. That one difference is why cohort.ts cannot serve this file
// — every fold there returns a dense array indexed 0..n-1, and a Pokédex
// board is keyed 1..1025 with ten of them present.
//
// So the folds are re-expressed here rather than generalised there.
// cohort.ts is read by eight surfaces on a hot path; giving all of them a
// key-mapping parameter to serve one caller is the wrong trade, and the
// arithmetic is short enough that the duplication is legible.
//
// The rule is the same one, and it is the reason both files are small: an
// ABSENT cell is zero, not withheld (D98). Nothing here floors, suppresses
// or rounds a cohort away.
//
// WHAT A CATALOGUE DIVERGENCE IS. For a question with four options, the
// reading is a points gap per option (cohort.ts's `divergence`). For a
// board of a thousand entities, per-entity points gaps say nothing a
// reader can hold: every entity is a rounding error away from every other.
// What a reader wants from a catalogue cut is the sentence the card's own
// surprise line already makes — WHO THIS COHORT PUTS FIRST, and where
// everyone else puts that. `pickTilt` is that, and its ranking is how far
// the cohort's favourite sits down everyone's board.

import type { ByMap } from "./cohort";

/** One entity's standing on a board. */
export interface PickRow {
  entity: number;
  count: number;
}

/** One cohort's board. */
export interface PickCell {
  bucket: string;
  /** Answers in this bucket — the cohort's own total, not the question's. */
  n: number;
  rows: PickRow[];
}

/**
 * The published board order, everywhere: count descending, then the
 * catalogue key ascending.
 *
 * The tiebreak is not cosmetic. `LIVE.pickCanon` sorts the global board by
 * exactly this rule, so a cohort whose counts are all 1 — which is every
 * cohort of a young question — lists its entities in the same order the
 * card above it does. Sorting ties by insertion order would put the same
 * four names in two orders on one screen.
 */
function byCount(a: PickRow, b: PickRow): number {
  return b.count - a.count || a.entity - b.entity;
}

function rowsOf(cell: Record<string, number> | undefined): PickRow[] {
  if (!cell) return [];
  return Object.keys(cell)
    .map((k) => ({ entity: Number(k), count: cell[k] }))
    .filter((r) => Number.isFinite(r.entity) && r.count > 0)
    .sort(byCount);
}

/** One cohort's board, or an empty list where the cell is absent. */
export function pickRowsFor(by: ByMap | undefined, dim: string, bucket: string): PickRow[] {
  return rowsOf(by?.[dim]?.[bucket]);
}

/**
 * How a board splits along one dimension — biggest cohort first.
 *
 * `mixFor`'s twin: per-QUESTION, so it says "of the people who picked
 * here, 40 were 25-34", never "40% of the app is 25-34".
 */
export function pickMix(by: ByMap | undefined, dim: string): PickCell[] {
  const buckets = by?.[dim];
  if (!buckets) return [];
  return Object.keys(buckets)
    .map((bucket) => {
      const rows = rowsOf(buckets[bucket]);
      return { bucket, rows, n: rows.reduce((a, r) => a + r.count, 0) };
    })
    .filter((b) => b.n > 0)
    .sort((a, b) => b.n - a.n || a.bucket.localeCompare(b.bucket));
}

/**
 * The full-vocabulary mix for a CLOSED dim — every canonical bucket in
 * vocabulary order, empty ones included (D304's rule, applied to a board).
 *
 * A scale that drops the bands nobody answered from stops reading as a
 * scale, and since D98 an empty band is a fact rather than a gap. The
 * opt-out tail (`VOCAB_TAIL`) is the exception cohort.ts makes and this
 * makes with it: a permanent empty row for "Prefer not to say" reads as an
 * ask rather than a reading.
 *
 * Buckets the vocabulary does not know are appended after it, biggest
 * first — a vocabulary edit must never hide answers folded under an older
 * spelling.
 */
export function pickVocabMix(
  by: ByMap | undefined,
  dim: string,
  vocab: readonly string[],
  tail: ReadonlySet<string>,
): PickCell[] {
  const have = new Map(pickMix(by, dim).map((b) => [b.bucket, b]));
  const out: PickCell[] = [];
  for (const v of vocab) {
    const b = have.get(v);
    if (b) {
      out.push(b);
      have.delete(v);
    } else if (!tail.has(v)) {
      out.push({ bucket: v, n: 0, rows: [] });
    }
  }
  for (const b of have.values()) out.push(b);
  return out;
}

/** Where an entity stands on a board, 1-based. 0 when it is not on it. */
export function pickRank(rows: readonly PickRow[], entity: number): number {
  const i = rows.findIndex((r) => r.entity === entity);
  return i < 0 ? 0 : i + 1;
}

export interface PickTilt {
  bucket: string;
  /** Answers behind the cohort. */
  n: number;
  /** The entity this cohort puts first. */
  entity: number;
  /** Its count here… */
  here: number;
  /** …and where it stands on everyone's board (1-based; 0 = not on it). */
  rank: number;
}

/**
 * What one cohort puts first, and where everyone puts that.
 *
 * Null when the cohort has no answers, or when its leader is everyone's
 * leader — a cut that agrees with the room is not a reading, it is the
 * room again, and offering it as a finding is how the surprise line stops
 * meaning anything.
 *
 * `minN` is for legibility, not for disclosure (cohort.ts's word, and its
 * reason): one answer makes any entity a cohort's unanimous favourite, and
 * a ranking led forever by cohorts of one says nothing. It defaults to 0
 * so the caller has to choose.
 */
export function pickTilt(
  cell: PickCell,
  overall: readonly PickRow[],
  minN = 0,
): PickTilt | null {
  const lead = cell.rows[0];
  if (!lead || cell.n < minN) return null;
  const rank = pickRank(overall, lead.entity);
  if (rank === 1) return null;
  return { bucket: cell.bucket, n: cell.n, entity: lead.entity, here: lead.count, rank };
}

/**
 * Every cohort of one dim that puts someone else first, furthest-from-the-
 * top first.
 *
 * Ranked by the overall rank of the cohort's own favourite: a cohort whose
 * pick is everyone's #7 is a better finding than one whose pick is
 * everyone's #2, and a cohort whose pick is not on the published board at
 * all (rank 0) is the strongest of the lot — which is why 0 sorts first
 * rather than last.
 */
export function pickTilts(
  by: ByMap | undefined,
  dim: string,
  overall: readonly PickRow[],
  minN = 0,
): PickTilt[] {
  return pickMix(by, dim)
    .map((cell) => pickTilt(cell, overall, minN))
    .filter((t): t is PickTilt => !!t)
    .sort((a, b) => (a.rank === 0 ? -1 : b.rank === 0 ? 1 : b.rank - a.rank) || b.n - a.n);
}

/**
 * The strongest tilt across every published dim — the card's own door into
 * the sheet, and the cut that door opens at.
 *
 * Dims are read in COHORT_DIMS order and compared on the same key
 * `pickTilts` sorts by, so the sentence a card shows is the same one the
 * sheet lands on.
 */
export function bestPickTilt(
  by: ByMap | undefined,
  dims: readonly string[],
  overall: readonly PickRow[],
  minN = 0,
): { dim: string; tilt: PickTilt } | null {
  let best: { dim: string; tilt: PickTilt } | null = null;
  for (const dim of dims) {
    const top = pickTilts(by, dim, overall, minN)[0];
    if (!top) continue;
    if (!best) { best = { dim, tilt: top }; continue; }
    const b = best.tilt;
    const better = top.rank === 0 ? b.rank !== 0
      : b.rank === 0 ? false
        : top.rank > b.rank || (top.rank === b.rank && top.n > b.n);
    if (better) best = { dim, tilt: top };
  }
  return best;
}

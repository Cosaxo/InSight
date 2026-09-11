// The whole-world map's published positions, read (D456).
//
// The People lens places a stranger from the answers you and they have
// both given — which is bounded by overlap, and thins as the bank grows
// (PATTERNS-PLAN.md §7.4). Since D456 the nightly fit publishes one
// position per person: two rounded numbers and their answer count, in the
// same space the published rows draw, so a person is placeable whether or
// not they have answered anything you have.
//
// ONE READ PER STOP PER SESSION, cached here for the same reason the
// loadings document is: the lens is re-entered on every population chip
// and a document per tap would be a read per tap. The cache is a plain
// module map — a new session, or a purge, starts empty.
//
// WHAT THIS IS NOT. A published position is a PLACE, not an agreement: it
// carries no answers, so nothing here can say "you agree on 7 of 9". The
// lens keeps stating that only for the people it read real rows for
// (D146), and a world dot the samples never saw says its answer count and
// nothing more.
import LIVE from "./live";
import { getDb, getFirestoreApi } from "../../lib/firebase";

/** One published row. `n` is the person's answer count — the only number
 * beside the position, and the only thing a world-only dot may claim. */
export interface WorldPosition {
  uid: string;
  x: number;
  y: number;
  n: number;
}

export interface WorldPositions {
  /** Rows, as published. */
  rows: WorldPosition[];
  /** The population the rows were drawn from — the lens states it, so a
   * picture of 600 of 18,400 says so rather than implying it is everyone. */
  total: number;
  /** The UTC day the fit solved them. */
  day: string;
}

/** `null` for the world document, a two-letter country code otherwise —
 * the same anchor the cube counts (`pure.ts`). */
export const worldDocId = (country: string | null): string =>
  country ? `people-${encodeURIComponent(country)}` : "people-world";

const cache = new Map<string, WorldPositions | null>();
const inflight = new Map<string, Promise<WorldPositions | null>>();

/** Drop everything read so far — the purge's hook, and the tests'. */
export function resetWorldPositions(): void {
  cache.clear();
  inflight.clear();
}

/**
 * The positions for one population, or null when the fit has published
 * none for it (a country nobody in it has answered from, a database the
 * nightly has never run against, or a demo build, which reads nothing).
 *
 * A failed read caches `null` as an ANSWER rather than retrying: the lens
 * falls back to the sample-placed crowd it has always drawn, which is a
 * thinner picture and not an error state.
 */
export async function worldPositions(country: string | null): Promise<WorldPositions | null> {
  if (!LIVE.enabled) return null;
  const id = worldDocId(country);
  const hit = cache.get(id);
  if (hit !== undefined) return hit;
  const running = inflight.get(id);
  if (running) return running;
  const p = (async (): Promise<WorldPositions | null> => {
    try {
      const db = await getDb();
      const { doc, getDoc } = await getFirestoreApi();
      const snap = await getDoc(doc(db, "v2_patterns", id));
      const out = snap.exists() ? parseWorldDoc(snap.get("rows"), snap.get("total"), snap.get("day")) : null;
      cache.set(id, out);
      return out;
    } catch {
      cache.set(id, null);
      return null;
    } finally {
      inflight.delete(id);
    }
  })();
  inflight.set(id, p);
  return p;
}

/** The parse, kept apart from the read so a test can hand it a document.
 * Every field is checked: this is public data written by a nightly pass,
 * and a row with a missing number would place a dot at the origin — the
 * one position that means something (it is where the viewer starts). */
export function parseWorldDoc(rows: unknown, total: unknown, day: unknown): WorldPositions | null {
  if (!rows || typeof rows !== "object") return null;
  const out: WorldPosition[] = [];
  for (const [uid, raw] of Object.entries(rows as Record<string, unknown>)) {
    if (!uid || !raw || typeof raw !== "object") continue;
    const r = raw as { x?: unknown; y?: unknown; n?: unknown };
    if (typeof r.x !== "number" || !Number.isFinite(r.x)) continue;
    if (typeof r.y !== "number" || !Number.isFinite(r.y)) continue;
    if (typeof r.n !== "number" || !Number.isFinite(r.n)) continue;
    out.push({ uid, x: r.x, y: r.y, n: Math.max(0, Math.round(r.n)) });
  }
  out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return {
    rows: out,
    total: typeof total === "number" && total >= out.length ? Math.round(total) : out.length,
    day: typeof day === "string" ? day : "",
  };
}

// ledger.ts — one reader for one UTC day of the agg-events ledger (D28).
//
// Extracted when the taste fold (D317/D322) became the ledger's third
// nightly reader, because the second copy is how D197 happened: the bank
// parser existed in three copies and the one with a try/catch reported an
// invented wire size instead of failing. patterns.ts read the day inline
// until this file; the engagement digest kept a third copy of the pager
// until D399 folded it into `memoLedgerReader` below; the velocity scan
// keeps its own read on purpose — it wants different fields, a different
// page size and per-page flag logic, so sharing would couple what only
// rhymes.
//
// ONE READ A NIGHT, THREE FOLDS (D399, ALGORITHM-REFLECTION §4.2). The
// digest, the patterns fit and the taste fold each want yesterday's
// entries, and each ran as its own scheduled function paging the same
// day again — the cost model counted the day's entries billed three
// times. They now run in one invocation (nightly.ts) and share a reader
// that remembers each day it has fetched, so the second and third fold
// pay nothing. The memo is per invocation, not per process: a scheduled
// function's instance may serve tomorrow's run too, and a day cached
// across runs would hand the fit yesterday's entries under today's key.
//
// Paged like every unbounded read in this codebase: the day's ledger can
// be large, termination is on a short page, and `select` trims the wire
// to the fields the folds actually use.
import type { Firestore } from "firebase-admin/firestore";

export interface LedgerDayEntry {
  uid: string;
  qid: string;
  optionIdx?: number;
  /** Present only on a D86 edit: the index the answer moved AWAY from.
   *  Its absence is what marks an entry as a first answer. */
  fromIdx?: number;
  /** The answer's frozen cohort chips (D8), for the nightly voter samples
   *  (D397). Absent on entries written before the field; on catalog
   *  entries since D453. */
  anchors?: Record<string, string>;
  /** A catalogue pick's canonical entity key (D453) — the fit's own
   *  reading of a `pick` answer, the way `optionIdx` is of a vote. Absent
   *  on every other arm, and on catalog entries written before it. */
  entity?: string;
}

const PAGE = 5000;

/** What a fold's store takes: the day's entries, from wherever the caller
 * decided they come — the memo below in production, a fixture in tests. */
export type LedgerDayReader = (dayKey: string) => Promise<LedgerDayEntry[]>;

/**
 * `readLedgerDay`, remembered for the life of one nightly pass — but for
 * `keep` days at a time, not for all of them.
 *
 * Three stores built over one of these read the ledger once between them
 * (D399), and on an ordinary night that is exactly what still happens:
 * one day is owed, all three folds ask for it, one read. A read that
 * FAILS is forgotten, so the next fold that asks retries rather than
 * inheriting the rejection — the folds are isolated from one another's
 * failures in nightly.ts, and a poisoned memo would undo that.
 *
 * WHY IT IS BOUNDED. The three folds run in SEQUENCE, each walking its
 * own owed days oldest-first, so an unbounded memo holds every day of a
 * catch-up at once — and a catch-up is precisely the night after the
 * pass missed one, which is the run that must not die. Measured
 * 2026-09-09 with the real reader against a paging fake, retained heap
 * after three GCs at 30,000 entries a day over a 7-day catch-up:
 *
 *     one reader per day (the pre-D399 shape)   10.3 MB
 *     one unbounded memo (D399 as written)      70.9 MB   6.9x
 *
 * ~236 bytes retained per entry, which agrees with patterns.ts's own
 * measured ~290. At COSTS.md's ~5 world answers per user per day, 50k
 * DAU is ~250k entries a day ≈ 59 MB per resident day: a 3-day catch-up
 * is ~177 MB and a 7-day one ~410 MB, on LIGHT_UNBOUNDED's 256 MiB,
 * before the per-uid maps and the vectors. The OOM re-reads the same
 * days tomorrow and dies identically — nothing advances a cursor until
 * the end — which is the permanent wedge patterns.ts's header describes.
 *
 * THE TRADE, stated because it is a real cost and not a free win: with
 * `keep = 1`, a catch-up reads each day once per fold instead of once,
 * so a 7-day recovery costs 21 day-reads rather than 7. Reads on the
 * rare path against a wedge that never clears itself. The ordinary
 * night — one owed day — is unchanged in both reads and memory.
 *
 * The alternative that keeps both is to iterate DAYS outermost across
 * the three folds instead of folds outermost; that is a rewrite of three
 * folds' internals, and it is the way through if the read cost on
 * catch-ups ever matters.
 */
export function memoLedgerReader(db: Firestore, keep = 1): LedgerDayReader {
  // Insertion-ordered, which is what makes the eviction below an LRU
  // without a second structure: re-asking for a held day does not move
  // it, and it does not need to — the folds walk days in one order.
  const days = new Map<string, Promise<LedgerDayEntry[]>>();
  return (dayKey) => {
    let pending = days.get(dayKey);
    if (!pending) {
      pending = readLedgerDay(db, dayKey);
      days.set(dayKey, pending);
      pending.catch(() => { days.delete(dayKey); });
      // Evicting a PENDING promise is safe: whoever already holds it
      // still gets its value, it simply stops being reused. With the
      // folds in sequence there is never more than one in flight.
      while (days.size > Math.max(1, keep)) {
        const oldest = days.keys().next().value as string;
        days.delete(oldest);
      }
    }
    return pending;
  };
}

/** The entries for one UTC day key (YYYY-MM-DD), oldest first. */
export async function readLedgerDay(db: Firestore, dayKey: string): Promise<LedgerDayEntry[]> {
  const start = new Date(`${dayKey}T00:00:00Z`);
  const end = new Date(start.getTime() + 86400000);
  const out: LedgerDayEntry[] = [];
  let query = db
    .collection("v2_agg_events")
    .where("at", ">=", start)
    .where("at", "<", end)
    .orderBy("at")
    // EVERY FIELD THE ENTRY DECLARES, and the projection is the whole
    // reason to say so out loud: `select` is a fixed list, so a field
    // added to the interface above and forgotten here arrives as
    // undefined at every reader — no error, no log, just a fold that
    // quietly stops distinguishing an edit from a first answer. Pinned in
    // ledger.test.ts against the interface itself.
    .select("uid", "qid", "optionIdx", "fromIdx", "anchors", "entity", "at")
    .limit(PAGE);
  for (;;) {
    const snap = await query.get();
    for (const d of snap.docs) {
      out.push({
        uid: String(d.get("uid") ?? ""),
        qid: String(d.get("qid") ?? ""),
        optionIdx: d.get("optionIdx") as number | undefined,
        ...(d.get("fromIdx") === undefined ? {} : { fromIdx: d.get("fromIdx") as number }),
        ...(d.get("anchors") ? { anchors: d.get("anchors") as Record<string, string> } : {}),
        ...(typeof d.get("entity") === "string" ? { entity: d.get("entity") as string } : {}),
      });
    }
    if (snap.size < PAGE) break;
    query = query.startAfter(snap.docs[snap.size - 1]);
  }
  return out;
}

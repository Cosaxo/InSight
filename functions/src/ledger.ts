// ledger.ts — one reader for one UTC day of the agg-events ledger (D28).
//
// Extracted when the taste fold (D317/D322) became the ledger's third
// nightly reader, because the second copy is how D197 happened: the bank
// parser existed in three copies and the one with a try/catch reported an
// invented wire size instead of failing. patterns.ts read the day inline
// until this file; the engagement digest kept a third copy of the pager
// until D387 folded it into `memoLedgerReader` below; the velocity scan
// keeps its own read on purpose — it wants different fields, a different
// page size and per-page flag logic, so sharing would couple what only
// rhymes.
//
// ONE READ A NIGHT, THREE FOLDS (D387, ALGORITHM-REFLECTION §4.2). The
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
   *  (D385). Absent on entries written before the field, and on catalog
   *  entries. */
  anchors?: Record<string, string>;
}

const PAGE = 5000;

/** What a fold's store takes: the day's entries, from wherever the caller
 * decided they come — the memo below in production, a fixture in tests. */
export type LedgerDayReader = (dayKey: string) => Promise<LedgerDayEntry[]>;

/**
 * `readLedgerDay`, remembered per day for the life of one nightly pass.
 * Three stores built over one of these read the ledger once between them
 * (D387). A read that FAILS is forgotten, so the next fold that asks
 * retries rather than inheriting the rejection — the folds are isolated
 * from one another's failures in nightly.ts, and a poisoned memo would
 * undo that.
 */
export function memoLedgerReader(db: Firestore): LedgerDayReader {
  const days = new Map<string, Promise<LedgerDayEntry[]>>();
  return (dayKey) => {
    let pending = days.get(dayKey);
    if (!pending) {
      pending = readLedgerDay(db, dayKey);
      days.set(dayKey, pending);
      pending.catch(() => { days.delete(dayKey); });
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
    .select("uid", "qid", "optionIdx", "fromIdx", "anchors", "at")
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
      });
    }
    if (snap.size < PAGE) break;
    query = query.startAfter(snap.docs[snap.size - 1]);
  }
  return out;
}

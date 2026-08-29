// ledger.ts — one reader for one UTC day of the agg-events ledger (D28).
//
// Extracted when the taste fold (D317/D322) became the ledger's third
// nightly reader, because the second copy is how D197 happened: the bank
// parser existed in three copies and the one with a try/catch reported an
// invented wire size instead of failing. patterns.ts read the day inline
// until this file; the velocity scan keeps its own read on purpose — it
// wants different fields, a different page size and per-page flag logic,
// so sharing would couple what only rhymes.
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
}

const PAGE = 5000;

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
    .select("uid", "qid", "optionIdx", "fromIdx", "at")
    .limit(PAGE);
  for (;;) {
    const snap = await query.get();
    for (const d of snap.docs) {
      out.push({
        uid: String(d.get("uid") ?? ""),
        qid: String(d.get("qid") ?? ""),
        optionIdx: d.get("optionIdx") as number | undefined,
        ...(d.get("fromIdx") === undefined ? {} : { fromIdx: d.get("fromIdx") as number }),
      });
    }
    if (snap.size < PAGE) break;
    query = query.startAfter(snap.docs[snap.size - 1]);
  }
  return out;
}

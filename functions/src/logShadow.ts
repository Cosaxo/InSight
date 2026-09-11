// logShadow.ts — the answer log shadowed against the folds it will replace
// (SCALE-ARCHITECTURE.md phase A, LOG-FIRST-RUNBOOK A.7).
//
// WHAT IT ANSWERS. Phase D moves every nightly fold onto BigQuery — the
// digest's actives become COUNT(DISTINCT uid), the velocity scan's entry
// count a COUNT(*), the voter samples an ARRAY_AGG per question — and
// nothing in the tree says whether those queries reproduce what the
// Firestore folds compute tonight. This runner asks, every night, off the
// ledger day the pass already read: it folds the day the folds' own way,
// runs the queries phase D will run, and logs the difference as one line
// (`log_shadow`). A week of `clean: true` is what licenses phase D; a
// night that is not clean names what differed, in numbers, so the query
// or the row is fixed before a fold moves.
//
// TWO HALVES, BECAUSE THE TWO CLOCKS MAKE ONE IMPOSSIBLE (log.ts, above
// its shadow queries). The EXACT half looks the ledger day's rows up by
// id across the midnight seam and compares what each carries — a row the
// table still lacks after the reconcile ran, a row whose person, question
// or option differs, a row the log files under another day. The FOLD half
// runs the three queries over the log's own day and compares them with
// the same folds over the ledger's day. When the seam is zero the two
// days are the same rows and any fold diff is the query's; when it is
// not, a fold diff no larger than the seam is the seam, and the line
// prints both so a reader can tell. Under phase D the log's day IS the
// day, so the seam is not a bug to fix but a definition to state.
//
// WHAT IT READS AND WHAT IT COSTS. The ledger day: nothing — the memoised
// reader (ledger.ts) already holds it for the folds ahead of this runner.
// BigQuery: two aggregate queries over one partition and, for the exact
// half, one query per LOG_SHADOW_ID_CHUNK ids over three partitions' id
// column — bytes, priced in COSTS.md's phase-A note. The exact half is
// bounded by the pass's clock (LOG_SHADOW_SLICE_MS, an absolute instant
// like every bounded fold's) and says `capped` with how far it got; the
// fold half always runs, because two queries are what it costs.
//
// WHAT IT DOES NOT COMPARE, said so nobody reads a clean week as more
// than it is: the cumulative sample document (that needs a read per
// sample and the table's whole history, and the merge is deterministic
// over the day's additions this DOES compare); the frozen chips on a row;
// and the candidate's corpus filter — patterns.ts folds only the items
// its corpus names, the shadow folds every option-shaped entry, a
// superset, and equality on the superset is equality on the subset.
import { logger } from "firebase-functions";
import type { LedgerDayEntry, LedgerDayReader } from "./ledger";
import { LOG_SHADOW_ID_CHUNK, logWriter, rowFromLedgerEntry, type LogWriter, type ShadowFold } from "./log";
import type { AnswerMap } from "./patternsAls";
import { PATTERNS_SAMPLE_CAP, sampleAdditions, trimAdditions } from "./patternsSamples";
import { utcDay } from "./pure";

/** The exact half's share of the pass — measured from where it starts,
 *  never past the invocation (nightly.ts `sliceDeadline`). A minute is
 *  three chunk queries at their slowest, a day of twenty thousand answers
 *  in one; a night that needs more says `capped` rather than spending the
 *  folds behind it. */
export const LOG_SHADOW_SLICE_MS = 60_000;
/** Questions named on a night that is not clean — enough to open the
 *  table with, not the whole list in a log line. */
export const LOG_SHADOW_EXAMPLES = 5;

export interface LogShadowStore {
  ledgerDay: LedgerDayReader;
  shadowRows: LogWriter["shadowRows"];
  shadowFold: LogWriter["shadowFold"];
}

export interface LogShadowSummary {
  day: string;
  /** True where there is no BigQuery — nothing was read. */
  skipped: boolean;
  /** The exact half did not reach every entry: the pass's clock ended
   *  it. `checked` says how far it got. Never clean. */
  capped: boolean;
  /** The ledger day's entries — the folds' own input. */
  entries: number;
  checked: number;
  /** Entries the table has no row for, a day either side. */
  missing: number;
  /** Rows whose person, question or option is not the entry's. */
  mismatched: number;
  /** Rows the log files under another day than the ledger's — the
   *  clocks, not a fault; the fold diffs are read against it. */
  seam: number;
  /** COUNT(*) over the log's own day. */
  logEntries: number;
  /** The digest's actives over the ledger day, and the log's. */
  actives: number;
  logActives: number;
  /** Questions with additions on either side, and how many differ. */
  questions: number;
  differing: number;
  examples: string[];
  clean: boolean;
}

/**
 * The folds' own arithmetic over a ledger day: the digest's actives
 * (engagement.ts — every distinct person, an empty uid being no one), the
 * scan's entry count, and the samples' additions per question
 * (patterns.ts's compaction — last wins in `at` order — through
 * `sampleAdditions` and `trimAdditions`, the fold's own functions).
 */
export function foldLedgerDay(day: string, entries: readonly LedgerDayEntry[], cap: number = PATTERNS_SAMPLE_CAP): ShadowFold {
  const uids = new Set<string>();
  const answersByUid = new Map<string, AnswerMap>();
  for (const e of entries) {
    if (!e.uid) continue;
    uids.add(e.uid);
    // patterns.ts's `wide` filter, minus the corpus (the header says why).
    if (typeof e.optionIdx !== "number" || e.optionIdx < 0) continue;
    const a = answersByUid.get(e.uid) ?? {};
    a[e.qid] = e.optionIdx;
    answersByUid.set(e.uid, a);
  }
  const additions = new Map<string, Array<{ uid: string; o: number }>>();
  for (const [qid, adds] of sampleAdditions(day, answersByUid, new Map())) {
    additions.set(qid, trimAdditions(adds, cap).map((a) => ({ uid: a.uid, o: a.optionIdx })));
  }
  return { entries: entries.length, actives: uids.size, additions };
}

/** The samples half of the fold diff: which questions' trimmed additions
 *  differ, in either order or content, and a few of their ids. */
export function diffFolds(ledger: ShadowFold, log: ShadowFold): { questions: number; differing: number; examples: string[] } {
  const qids = [...new Set([...ledger.additions.keys(), ...log.additions.keys()])].sort();
  const examples: string[] = [];
  let differing = 0;
  for (const qid of qids) {
    const a = ledger.additions.get(qid) ?? [];
    const b = log.additions.get(qid) ?? [];
    if (a.length === b.length && a.every((x, i) => x.uid === b[i].uid && x.o === b[i].o)) continue;
    differing += 1;
    if (examples.length < LOG_SHADOW_EXAMPLES) examples.push(qid);
  }
  return { questions: qids.length, differing, examples };
}

/**
 * Shadow yesterday: the exact half by id, the fold half by query, one
 * line. Yesterday only, like the reconcile it runs after — the reconcile
 * has just appended what the day lacked, so a `missing` here is a row it
 * could not put back, not one it has not reached yet.
 */
export async function runLogShadow(
  store: LogShadowStore,
  nowMs: number,
  log: Pick<typeof logger, "info" | "warn"> = logger,
  opts: { deadlineAt?: number; clock?: () => number } = {},
): Promise<LogShadowSummary> {
  const day = utcDay(nowMs, -1);
  const fold = await store.shadowFold(day);
  if (!fold) {
    log.info("[log] shadow skipped — no BigQuery here", { metric: "log_shadow", day, skipped: true });
    return {
      day, skipped: true, capped: false, entries: 0, checked: 0, missing: 0, mismatched: 0, seam: 0,
      logEntries: 0, actives: 0, logActives: 0, questions: 0, differing: 0, examples: [], clean: false,
    };
  }
  const entries = await store.ledgerDay(day);
  const mine = foldLedgerDay(day, entries);
  const clock = opts.clock ?? Date.now;
  const deadlineAt = opts.deadlineAt ?? Number.POSITIVE_INFINITY;
  let capped = false;
  let checked = 0;
  let missing = 0;
  let mismatched = 0;
  let seam = 0;
  for (let i = 0; i < entries.length; i += LOG_SHADOW_ID_CHUNK) {
    // Before each chunk, not after: a chunk started is a chunk paid for.
    if (clock() > deadlineAt) { capped = true; break; }
    const chunk = entries.slice(i, i + LOG_SHADOW_ID_CHUNK);
    const rows = await store.shadowRows(day, chunk.map((e) => e.id));
    if (!rows) { capped = true; break; }
    const byId = new Map(rows.map((r) => [r.id, r] as const));
    for (const e of chunk) {
      checked += 1;
      const row = byId.get(e.id);
      if (!row) { missing += 1; continue; }
      // What the row SHOULD carry is what the reconcile would have
      // written for this entry — the same transformation, so an option
      // the log nulls (an index past `usableIdx`) is compared as null.
      const want = rowFromLedgerEntry(e);
      if (row.uid !== want.uid || row.qid !== want.qid || row.o !== want.option_idx) mismatched += 1;
      if (row.day !== day) seam += 1;
    }
  }
  const { questions, differing, examples } = diffFolds(mine, fold);
  const clean = !capped && missing === 0 && mismatched === 0 && seam === 0
    && mine.entries === fold.entries && mine.actives === fold.actives && differing === 0;
  const out: LogShadowSummary = {
    day, skipped: false, capped, entries: entries.length, checked, missing, mismatched, seam,
    logEntries: fold.entries, actives: mine.actives, logActives: fold.actives, questions, differing, examples, clean,
  };
  (clean ? log.info : log.warn)(
    clean
      ? `[log] shadow ${day}: clean — ${entries.length} entries matched by id, the folds agree (actives ${mine.actives}, ${questions} questions)`
      : `[log] shadow ${day}: NOT clean — ${missing} missing, ${mismatched} mismatched, ${seam} filed on another day, of ${checked}/${entries.length} checked`
        + (capped ? " (STOPPED on the pass's clock)" : "")
        + `; folds: entries ${entries.length} vs ${fold.entries}, actives ${mine.actives} vs ${fold.actives}, ${differing} of ${questions} questions differ`
        + (examples.length ? ` (${examples.join(", ")})` : ""),
    { metric: "log_shadow", ...out },
  );
  return out;
}

/** The store over the shared ledger reader and the process's writer. */
export function logShadowStore(ledgerDay: LedgerDayReader, w: LogWriter = logWriter()): LogShadowStore {
  return { ledgerDay, shadowRows: (day, ids) => w.shadowRows(day, ids), shadowFold: (day) => w.shadowFold(day) };
}

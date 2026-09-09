// log.ts — the answer log: one row per ledger entry, appended to BigQuery
// (SCALE-ARCHITECTURE.md phase A, D446).
//
// WHAT THIS IS. The first step of the log-first structure the owner
// adopted on 2026-09-09: everything the app computes overnight — the
// samples, the fit, the digest, the velocity signals, the maps — becomes
// a query over a log that is priced by the byte, once the log exists.
// This file makes it exist. In phase A the log is a MIRROR of the
// Firestore ledger (`v2_agg_events`, D28): the ledger stays what the
// nightly folds read, and BigQuery holds every row the ledger's 90-day
// TTL would drop, keyed so a row is never counted twice. Phase D moves
// the folds onto it; nothing a user sees changes in either phase.
//
// BEST-EFFORT AT WRITE, EXACT BY MORNING. The append runs AFTER the
// aggregate transaction commits and outside it, because a BigQuery
// outage must not fail an answer — the count is the product and the log
// is what tomorrow computes from. A failed append is logged
// (`log_append_failed`) and `runLogReconcile`, the nightly pass's eighth
// runner, appends yesterday's ledger entries the table lacks: one query
// over the day's partition for the ids it holds, then the missing rows,
// off the ledger read the pass already shares. Every row's `id` is the
// ledger entry's document id — the trigger's event id, which is also
// the streaming insertId — so the reconcile's diff and BigQuery's own
// best-effort dedup agree on what "the same row" means.
//
// OFF WHERE THERE IS NO BIGQUERY. The emulator (FUNCTIONS_EMULATOR), the
// unit suites (VITEST) and a deploy with LOG_DATASET=off get a writer that
// does nothing and says so once — the e2e loop and every fold run exactly
// as before, and a test that wants to see rows injects a fake through
// `setLogWriterForTest`. Production is on by default: dataset `insight`
// in europe-west1 (the region the named database is on, D165), created by
// scripts/apply-bigquery.mjs, dry by default; the runtime service account
// needs BigQuery Data Editor and Job User, which DEPLOYMENT.md names.
//
// ERASURE reaches it (D8's promise, the privacy page's sentence): a DML
// statement, attempted at once while the table is small and — where
// BigQuery refuses because the rows are still in its streaming buffer,
// which it does for up to ninety minutes after an insert, or where the
// table has passed LOG_ERASE_NOW_MAX_BYTES — deferred to the nightly
// reconcile through a server-only marker in `v2_log_erasures`, so an
// account's rows are gone within a day at the outside. The anonymous
// tallies stay, as the aggregate counts a deleted account fed stay today.
//
// WHY THE NIGHT DELETES IN ONE STATEMENT. BigQuery bills a DELETE for
// every column of every partition it touches, and an account whose
// answers span the year touches every partition — so one statement costs
// the table's size at $6.25 a TiB whether it removes one account or five
// hundred. Per account that is nothing today and, at a million people
// answering a hundred times a day, about $27 a statement; a statement per
// deletion would then be the largest line on the bill (COST-EXPOSURE.md
// §8). The night takes every pending account in one `IN UNNEST`, which
// bounds erasure at one pass a night whatever the day deleted; the
// immediate path is kept while a pass is cheap (the ceiling), because
// gone-at-once is the better promise where it costs nothing to keep.
import { BigQuery } from "@google-cloud/bigquery";
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { FieldPath, type Firestore, type Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { assertOperator, FUNCTIONS_REGION, LIGHT_UNBOUNDED } from "./ops";
import { db as firestore } from "./db";
import type { LedgerDayEntry, LedgerDayReader } from "./ledger";
import { utcDay, utcDayKeyOf } from "./pure";

export const LOG_DATASET = process.env.LOG_DATASET || "insight";
export const LOG_TABLE = "answers";
/** The named database's region (D165); a dataset elsewhere would move
 *  the data out of the EU the privacy page places it in. */
export const LOG_LOCATION = "europe-west1";
/** The deferred-erasure markers — server-only (firestore.rules). */
export const LOG_ERASURES = "v2_log_erasures";
/** BigQuery holds streamed rows in a buffer DML cannot touch for up to
 *  ~90 minutes; a deferred erasure is retried after this long. */
export const LOG_ERASURE_RETRY_MS = 2 * 60 * 60 * 1000;
/** Rows per streaming insert — the API's own ceiling is 10,000 rows or
 *  10 MB a request; 500 keeps a request well under both. */
export const LOG_APPEND_CHUNK = 500;
/** Above this many bytes in the table an account's erasure is deferred to
 *  the night's one statement rather than run at once: a DELETE is a pass
 *  over the whole table (see the header), $0.006 at this ceiling and the
 *  table's size × deletions a day past it. Read off the table's metadata,
 *  which bills nothing. */
export const LOG_ERASE_NOW_MAX_BYTES = 1024 ** 3;
/** Accounts per nightly DELETE — the marker query's own page; an
 *  `IN UNNEST` of five hundred ids is well inside a query's size. */
export const LOG_ERASE_BATCH = 500;

/** One row of the `answers` table — the field names are the schema's
 *  (bigquery/answers.schema.json, pinned by log.test.ts). */
export interface LogRow {
  id: string;
  uid: string;
  qid: string;
  surface: string | null;
  option_idx: number | null;
  from_idx: number | null;
  /** ISO-8601, what a TIMESTAMP column accepts on a streaming insert. */
  answered_at: string;
  /** YYYY-MM-DD, the partition. */
  day: string;
  /** JSON text — a JSON column takes a string on the streaming API. */
  anchors: string | null;
}

const usableIdx = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 19;

/** A row from what the trigger (or the reconcile, or the backfill) knows. */
export function logRow(o: {
  id: string; uid: string; qid: string; atMs: number;
  surface?: unknown; optionIdx?: unknown; fromIdx?: unknown; anchors?: unknown;
}): LogRow {
  const anchors = o.anchors && typeof o.anchors === "object" && !Array.isArray(o.anchors) && Object.keys(o.anchors as object).length
    ? JSON.stringify(o.anchors)
    : null;
  return {
    id: o.id,
    uid: o.uid,
    qid: o.qid,
    surface: typeof o.surface === "string" && o.surface ? o.surface : null,
    option_idx: usableIdx(o.optionIdx) ? o.optionIdx : null,
    from_idx: usableIdx(o.fromIdx) ? o.fromIdx : null,
    answered_at: new Date(o.atMs).toISOString(),
    day: utcDayKeyOf(o.atMs),
    anchors,
  };
}

/** A ledger entry as a row — the reconcile's shape; the ledger carries no
 *  surface, so the row says so with null rather than a guess. */
export function rowFromLedgerEntry(e: LedgerDayEntry): LogRow {
  return logRow({ id: e.id, uid: e.uid, qid: e.qid, atMs: e.at, optionIdx: e.optionIdx, fromIdx: e.fromIdx, anchors: e.anchors });
}

export interface LogWriter {
  /** False where there is no BigQuery to write to; every method is then a
   *  no-op that reports so. */
  readonly enabled: boolean;
  append(rows: readonly LogRow[]): Promise<void>;
  /** The ids the table holds for `day` and the day either side of it —
   *  the trigger's clock and the ledger's are not the same clock, so a
   *  row filed a minute past midnight is still found. Null when off. */
  presentIds(day: string): Promise<Set<string> | null>;
  /** `DELETE … WHERE uid IN UNNEST(@uids)` — one pass over the table for
   *  every account in the list, which is the point of the list. "deferred"
   *  when BigQuery refuses because rows are in its streaming buffer; the
   *  caller keeps the markers. */
  deleteUsers(uids: readonly string[]): Promise<"done" | "deferred">;
  /** The table's logical bytes, off its metadata — no query, nothing
   *  billed. Null where unknown, or where there is no BigQuery. */
  tableBytes(): Promise<number | null>;
}

/** Whether this process has a BigQuery to write to. Read per call rather
 *  than at import so a test that sets the variable after importing sees
 *  the change — google-api.mjs's own rule about seams. */
export function logEnabled(): boolean {
  if (process.env.FUNCTIONS_EMULATOR === "true") return false;
  if (process.env.VITEST) return false;
  if (process.env.LOG_DATASET === "off") return false;
  return true;
}

const offWriter: LogWriter = {
  enabled: false,
  async append() {},
  async presentIds() { return null; },
  async deleteUsers() { return "done"; },
  async tableBytes() { return null; },
};

/** The writer against the real table: one client per instance, made on
 *  first use so importing this module costs nothing. */
export function bigQueryLogWriter(dataset = LOG_DATASET, table = LOG_TABLE): LogWriter {
  let client: BigQuery | null = null;
  const bq = () => (client ??= new BigQuery({ location: LOG_LOCATION }));
  const ref = () => `\`${bq().projectId}.${dataset}.${table}\``;
  return {
    enabled: true,
    async append(rows) {
      for (let i = 0; i < rows.length; i += LOG_APPEND_CHUNK) {
        const chunk = rows.slice(i, i + LOG_APPEND_CHUNK).map((r) => ({ insertId: r.id, json: r }));
        await bq().dataset(dataset).table(table).insert(chunk, { raw: true });
      }
    },
    async presentIds(day) {
      const [rows] = await bq().query({
        query: `SELECT id FROM ${ref()} WHERE day BETWEEN DATE_SUB(@day, INTERVAL 1 DAY) AND DATE_ADD(@day, INTERVAL 1 DAY)`,
        params: { day },
        types: { day: "DATE" },
        location: LOG_LOCATION,
      });
      return new Set((rows as Array<{ id: string }>).map((r) => r.id));
    },
    async deleteUsers(uids) {
      if (!uids.length) return "done";
      try {
        await bq().query({
          query: `DELETE FROM ${ref()} WHERE uid IN UNNEST(@uids)`,
          params: { uids: [...uids] },
          // An array parameter needs its element type stated (an empty
          // array cannot be inferred); the guard above keeps it non-empty.
          types: { uids: ["STRING"] },
          location: LOG_LOCATION,
        });
        return "done";
      } catch (err) {
        if (/streaming buffer/i.test(err instanceof Error ? err.message : String(err))) return "deferred";
        throw err;
      }
    },
    async tableBytes() {
      const [meta] = await bq().dataset(dataset).table(table).getMetadata();
      const n = Number((meta as { numBytes?: string | number } | undefined)?.numBytes);
      return Number.isFinite(n) ? n : null;
    },
  };
}

let writer: LogWriter | null = null;
let saidOff = false;

/** The process's writer — the real one where `logEnabled()`, the no-op
 *  otherwise, a fake where a test injected one. */
export function logWriter(): LogWriter {
  if (writer) return writer;
  if (!logEnabled()) {
    if (!saidOff) { saidOff = true; logger.info("[log] no BigQuery here — the answer log is off (emulator, test, or LOG_DATASET=off)"); }
    return offWriter;
  }
  writer = bigQueryLogWriter();
  return writer;
}

/** Tests: inject a fake, or null to forget the injected one. */
export function setLogWriterForTest(w: LogWriter | null): void {
  writer = w;
}

/**
 * Append rows, never throw: a failure is logged with its count and the
 * nightly reconcile appends what is missing. The trigger calls this after
 * its transaction commits, so a slow BigQuery costs the trigger wall
 * time and never the count.
 */
export async function appendLog(rows: readonly LogRow[]): Promise<void> {
  if (!rows.length) return;
  const w = logWriter();
  if (!w.enabled) return;
  try {
    await w.append(rows);
  } catch (err) {
    logger.error(`[log] append failed for ${rows.length} row(s) — the nightly reconcile will retry`, {
      metric: "log_append_failed",
      n: rows.length,
      reason: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── erasure ─────────────────────────────────────────────────────

export interface LogErasureStore {
  deleteUser(uid: string): Promise<"done" | "deferred">;
  /** The table's size, so the immediate statement is skipped past the
   *  ceiling (LOG_ERASE_NOW_MAX_BYTES); null defers to the statement. */
  tableBytes(): Promise<number | null>;
  /** Leave (or refresh) the marker that the nightly retries from. */
  defer(uid: string, atMs: number): Promise<void>;
}

/**
 * Erase one account's rows: attempt the DML now while the table is under
 * the ceiling; when the table is past it, when BigQuery defers (the
 * streaming buffer), or when the attempt fails for any other reason,
 * leave the marker and let the night's one statement take it — the
 * promise is "within a day", and a marker written is a promise kept.
 * Throws only when the marker itself cannot be written, which is the one
 * case deleteAccount must refuse to complete on (its own rule about
 * stranded data).
 */
export async function eraseUserLog(store: LogErasureStore, uid: string, nowMs: number, log: Pick<typeof logger, "info" | "warn"> = logger): Promise<"done" | "deferred"> {
  let outcome: "done" | "deferred";
  try {
    const bytes = await store.tableBytes();
    if (bytes !== null && bytes > LOG_ERASE_NOW_MAX_BYTES) {
      log.info(`[log] erasure of ${uid} deferred to the nightly batch — the table is ${(bytes / 1024 ** 3).toFixed(1)} GiB, past the immediate ceiling`, {
        metric: "log_erasure_deferred", reason: "table past LOG_ERASE_NOW_MAX_BYTES", bytes,
      });
      outcome = "deferred";
    } else {
      outcome = await store.deleteUser(uid);
    }
  } catch (err) {
    log.warn(`[log] erasure of ${uid} failed now; deferred to the nightly reconcile`, {
      metric: "log_erasure_deferred", reason: err instanceof Error ? err.message : String(err),
    });
    outcome = "deferred";
  }
  if (outcome === "deferred") await store.defer(uid, nowMs);
  return outcome;
}

// ── the nightly reconcile ───────────────────────────────────────

export interface LogReconcileStore {
  ledgerDay: LedgerDayReader;
  presentIds(day: string): Promise<Set<string> | null>;
  append(rows: readonly LogRow[]): Promise<void>;
  /** Deferred erasures whose marker is older than `beforeMs`. */
  pendingErasures(beforeMs: number): Promise<string[]>;
  /** One statement for the whole list (LogWriter.deleteUsers). */
  deleteUsers(uids: readonly string[]): Promise<"done" | "deferred">;
  eraseDone(uid: string): Promise<void>;
}

export interface LogReconcileSummary {
  day: string;
  /** True where there is no BigQuery — nothing was read or written. */
  skipped: boolean;
  entries: number;
  missing: number;
  appended: number;
  erasures: number;
  erased: number;
  /** DELETE statements run — one per LOG_ERASE_BATCH accounts, each a
   *  pass over the table, which is what the night's cost is. */
  passes: number;
}

/**
 * Reconcile yesterday: append the ledger entries the table lacks, then
 * retry the erasures the day deferred. Yesterday only, like the answer-map
 * heal — the trigger is the writer, and a night that fails leaves a day's
 * lag, not a hole, because the ledger keeps the day for ninety more.
 */
export async function runLogReconcile(
  store: LogReconcileStore,
  nowMs: number,
  log: Pick<typeof logger, "info" | "warn"> = logger,
): Promise<LogReconcileSummary> {
  const day = utcDay(nowMs, -1);
  const present = await store.presentIds(day);
  if (!present) {
    log.info("[log] reconcile skipped — no BigQuery here", { metric: "log_reconcile", day, skipped: true });
    return { day, skipped: true, entries: 0, missing: 0, appended: 0, erasures: 0, erased: 0, passes: 0 };
  }
  const entries = await store.ledgerDay(day);
  const rows = entries.filter((e) => e.id && !present.has(e.id)).map(rowFromLedgerEntry);
  if (rows.length) await store.append(rows);
  // Every pending account in one statement per page — a DELETE is a pass
  // over the table however many ids it names (the header). A refused
  // batch (rows of one of them still in the streaming buffer, which the
  // retry gap should have outlived) keeps every marker for tomorrow.
  const uids = await store.pendingErasures(nowMs - LOG_ERASURE_RETRY_MS);
  let erased = 0;
  let passes = 0;
  for (let i = 0; i < uids.length; i += LOG_ERASE_BATCH) {
    const chunk = uids.slice(i, i + LOG_ERASE_BATCH);
    passes += 1;
    if ((await store.deleteUsers(chunk)) !== "done") continue;
    for (const uid of chunk) await store.eraseDone(uid);
    erased += chunk.length;
  }
  const out: LogReconcileSummary = { day, skipped: false, entries: entries.length, missing: rows.length, appended: rows.length, erasures: uids.length, erased, passes };
  // A missing row is a live append that failed — worth a warning, since
  // the heal is the safety net and not the path.
  (rows.length ? log.warn : log.info)(
    `[log] reconciled ${day}: ${entries.length} entries, ${rows.length} appended, ${erased} of ${uids.length} deferred erasures done in ${passes} statement(s)`,
    { metric: "log_reconcile", ...out },
  );
  return out;
}

/** The erasure half over Firestore's markers — what deleteAccount takes. */
export function firestoreLogErasure(db: Firestore, w: LogWriter = logWriter()): LogErasureStore {
  return {
    deleteUser: (uid) => w.deleteUsers([uid]),
    tableBytes: () => w.tableBytes(),
    async defer(uid, atMs) {
      await db.collection(LOG_ERASURES).doc(uid).set({ at: atMs }, { merge: true });
    },
  };
}

export function firestoreLogStore(db: Firestore, ledgerDay: LedgerDayReader, w: LogWriter = logWriter()): LogReconcileStore {
  const markers = () => db.collection(LOG_ERASURES);
  return {
    ledgerDay,
    presentIds: (day) => w.presentIds(day),
    append: (rows) => w.append(rows),
    deleteUsers: (uids) => w.deleteUsers(uids),
    async pendingErasures(beforeMs) {
      if (!w.enabled) return [];
      const snap = await markers().where("at", "<=", beforeMs).limit(LOG_ERASE_BATCH).get();
      return snap.docs.map((d) => d.id);
    },
    async eraseDone(uid) {
      await markers().doc(uid).delete();
    },
  };
}

// ── the backfill ────────────────────────────────────────────────

export const LOG_BACKFILL_PAGE = 1000;
export const LOG_BACKFILL_MAX_PAGES = 200;

export interface LogBackfillOptions {
  /** Only answers written BEFORE this UTC day (YYYY-MM-DD) — the day the
   *  trigger started appending, so a recent answer is not rowed twice. */
  before: string;
  after?: string | null;
  apply: boolean;
  maxPages?: number;
  budgetMs?: number;
}

export interface LogBackfillSummary {
  scanned: number;
  rows: number;
  appended: number;
  next: string | null;
  done: boolean;
}

/**
 * Walk the `answers` collection group in path order, a page at a time,
 * and append a row per answer written before the cutoff — the shape
 * `runAnswerMapBackfill` has, resumable from the cursor it hands back.
 * A backfilled row's id is `bf:{uid}:{qid}`, deterministic, so a re-run
 * over a range appends the same ids and BigQuery's insertId dedup and the
 * table's own uniqueness reading agree; an edit's history is not in the
 * answer document, so a backfilled row carries the current option and no
 * `from_idx`.
 */
export async function runLogBackfill(db: Firestore, w: LogWriter, opts: LogBackfillOptions): Promise<LogBackfillSummary> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.before)) throw new Error(`before must be a UTC day (YYYY-MM-DD), got ${JSON.stringify(opts.before)}`);
  const cutoff = new Date(`${opts.before}T00:00:00Z`).getTime();
  const started = Date.now();
  const budget = opts.budgetMs ?? 400_000;
  const maxPages = opts.maxPages ?? LOG_BACKFILL_MAX_PAGES;
  let scanned = 0;
  let rowsN = 0;
  let appended = 0;
  let cursor: FirebaseFirestore.DocumentSnapshot | null = opts.after ? await db.doc(opts.after).get() : null;
  let next: string | null = opts.after ?? null;
  let done = false;
  for (let page = 0; page < maxPages; page += 1) {
    let q = db.collectionGroup("answers")
      .orderBy(FieldPath.documentId())
      .select("qid", "optionIdx", "surface", "answeredAt", "anchors")
      .limit(LOG_BACKFILL_PAGE);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) { done = true; break; }
    const rows: LogRow[] = [];
    for (const d of snap.docs) {
      scanned += 1;
      const uid = d.ref.parent.parent?.id ?? "";
      const qid = String(d.get("qid") ?? d.id);
      const at = d.get("answeredAt") as Timestamp | Date | undefined;
      const atMs = at && typeof (at as Timestamp).toMillis === "function" ? (at as Timestamp).toMillis() : at instanceof Date ? at.getTime() : NaN;
      if (!uid || !qid || !Number.isFinite(atMs) || atMs >= cutoff) continue;
      rows.push(logRow({ id: `bf:${uid}:${qid}`, uid, qid, atMs, surface: d.get("surface"), optionIdx: d.get("optionIdx"), anchors: d.get("anchors") }));
    }
    rowsN += rows.length;
    if (opts.apply && rows.length) {
      await w.append(rows);
      appended += rows.length;
    }
    cursor = snap.docs[snap.docs.length - 1];
    next = cursor.ref.path;
    if (snap.size < LOG_BACKFILL_PAGE) { done = true; break; }
    if (Date.now() - started > budget) break;
  }
  return { scanned, rows: rowsN, appended, next: done ? null : next, done };
}

export const backfillLogV2 = onCall(
  { ...LIGHT_UNBOUNDED, region: FUNCTIONS_REGION },
  async (request: CallableRequest) => {
    assertOperator(request);
    const before = typeof request.data?.before === "string" ? request.data.before : "";
    const after = typeof request.data?.after === "string" && request.data.after ? request.data.after : null;
    const apply = request.data?.apply === true;
    const w = logWriter();
    if (apply && !w.enabled) throw new HttpsError("failed-precondition", "no BigQuery here — the answer log is off");
    try {
      const out = await runLogBackfill(firestore(), w, { before, after, apply });
      logger.info(`[log] backfill ${apply ? "applied" : "dry run"} before ${before}: ${out.scanned} scanned, ${out.rows} rows, ${out.appended} appended`, {
        metric: "log_backfill", before, ...out,
      });
      return out;
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const reason = err instanceof Error ? err.message : String(err);
      throw new HttpsError("internal", `backfill failed: ${reason}`);
    }
  },
);

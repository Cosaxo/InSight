// answerMaps.ts — one document per person holding the map Circle folds
// (DATA-EFFICIENCY-RUNBOOK Phase 3), live from the trigger with a nightly
// heal and a one-time backfill.
//
// WHY. Opening the Circle stop ran one query per followed member — the
// newest CIRCLE_ANSWER_CAP (300) answer documents, ~300 bytes each — and
// kept `qid → optionIdx` from every one: fifteen thousand documents on a
// tap at the follow cap, for a few kilobytes of information. This is that
// information as one document, `v2_users/{uid}/public/answers`:
//
//   a: { [qid]: optionIdx }   every world answer with an option index —
//                             daily, feed, test, learn, pulse, call
//   at: timestamp             when it last moved
//
// NOT A NEW FACT ABOUT ANYBODY. It holds exactly what the answer documents
// under the same account already grant every signed-in reader (D98), in
// one document instead of one per answer; the rule is the answers' own
// (`allow get` signed in, write closed — firestore.rules), and it sits
// under `v2_users/{uid}` so `deleteAccount`'s recursive delete takes it
// with no new arm.
//
// LIVE — the owner's word (D421 amendment, 2026-09-08: "use live for the
// answer map"). The world-answer trigger writes the entry INSIDE the same
// transaction that folds the aggregate and marks the ledger (v2.ts): one
// merged write on a document only that person's answers touch, atomic
// with the dedup, so a redelivered event cannot double-write and a crash
// cannot leave the map behind the count. What a user notices: nothing —
// a friend's answer is in your Circle the moment it folds.
//
// THE HEAL is a safety net rather than the writer: each night, for every
// person the day's ledger names, read their map and fill the day's
// entries it lacks. In steady state it reads and writes nothing back,
// because the trigger already wrote; it exists for the shapes a trigger
// cannot cover — an entry written before this document existed, a rule
// or a deploy that missed a night — and it fills only what is ABSENT,
// never overwrites: the map is the newer truth (an edit made after the
// healed day is in the map and not in that day's ledger).
//
// THE BOUND is the bank, not time. One answer per question (the document
// id IS the question id, create-only), so a map holds at most as many
// entries as there are questions — ~20 bytes each, ~23 KB at today's bank
// and the 1 MiB document ceiling somewhere past 40,000 questions. That is
// SCALE-PLAN's unbounded feed's number to watch, and a per-surface split is
// the remedy if it is ever reached; no guard here, because a guard on a
// bound nothing approaches is a branch nothing tests.
//
// THE BACKFILL folds the answers that exist into maps once, through an
// operator callable driven by scripts/backfill-answer-maps.mjs from the
// Backfill answer maps workflow — a read per existing answer, one merged
// write per person, resumable from a cursor and idempotent, so a stopped
// run is continued rather than restarted. Until it has run, the device
// falls back to the answer query for a member without a map
// (src/v2/data/circle.ts), so nothing goes dark in the window between the
// deploy and the click.
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { FieldPath, FieldValue, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { assertOperator, FUNCTIONS_REGION, LIGHT_UNBOUNDED } from "./ops";
import { db as firestore } from "./db";
import type { LedgerDayReader } from "./ledger";
import { utcDay } from "./pure";

/** The document's path under the account: `v2_users/{uid}/public/answers`.
 * `public` is the subcollection whose rule is get-only for any signed-in
 * reader — the answers' own grant, one document. */
export const ANSWER_MAP_COLLECTION = "public";
export const ANSWER_MAP_DOC = "answers";

/** The surfaces a world answer can carry — src/v2/data/voters.ts's
 * `WORLD_ANSWER_SURFACES`, mirrored (the two packages do not share a
 * build; pinned against the source by answerMaps.test.ts). Circle folds
 * these six and the backfill admits exactly these. The trigger needs no
 * list: an answer that reaches its vote branch is one of them by
 * construction (group and duo return before it; catalog and rank carry no
 * option index). */
export const WORLD_SURFACES: readonly string[] = ["daily", "feed", "test", "learn", "pulse", "call"];

export function answerMapRef(db: Firestore, uid: string): FirebaseFirestore.DocumentReference {
  return db.collection("v2_users").doc(uid).collection(ANSWER_MAP_COLLECTION).doc(ANSWER_MAP_DOC);
}

/** The one write shape, shared by the trigger's two branches, the heal
 * and the backfill: a merge that adds or moves the named entries and
 * touches nothing else. `at` moves with it. */
export function answerMapMerge(entries: Readonly<Record<string, number>>): Record<string, unknown> {
  return { a: { ...entries }, at: FieldValue.serverTimestamp() };
}

/** A usable option index: an integer in the trigger's own range. */
export const usableIdx = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 19;

// ── the pure fold ───────────────────────────────────────────────────

export interface AnswerRow {
  uid: string;
  qid: string;
  optionIdx?: unknown;
  surface?: unknown;
}

/**
 * Rows → per-person maps, last row wins per (uid, qid) — the ledger and a
 * path-ordered scan both arrive oldest first, so the newest answer is the
 * one kept. A row without a usable index, or (when it names one) with a
 * surface outside the world six, folds to nothing.
 */
export function foldAnswerMaps(rows: readonly AnswerRow[]): Map<string, Record<string, number>> {
  const out = new Map<string, Record<string, number>>();
  for (const r of rows) {
    if (!r.uid || !r.qid || !usableIdx(r.optionIdx)) continue;
    if (r.surface !== undefined && !WORLD_SURFACES.includes(String(r.surface))) continue;
    const m = out.get(r.uid) ?? {};
    m[r.qid] = r.optionIdx;
    out.set(r.uid, m);
  }
  return out;
}

/** What a day's entries say that a person's map does not: the entries
 * whose question the map lacks. Never a differing value — the map is the
 * newer truth (see the header). */
export function missingEntries(map: Readonly<Record<string, number>> | null, day: Readonly<Record<string, number>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [qid, idx] of Object.entries(day)) {
    if (!map || !(qid in map)) out[qid] = idx;
  }
  return out;
}

// ── the nightly heal ────────────────────────────────────────────────

export interface AnswerMapStore {
  /** The ledger entries for one UTC day, oldest first. */
  ledgerDay(dayKey: string): Promise<AnswerRow[]>;
  /** The maps for these people, where one exists. */
  getMaps(uids: string[]): Promise<Map<string, Record<string, number>>>;
  /** Merge these entries into these people's maps. */
  putMaps(entries: Map<string, Record<string, number>>): Promise<void>;
}

export interface AnswerMapHealSummary {
  day: string;
  /** People the day's ledger named with a usable answer. */
  people: number;
  /** People whose map lacked something the day said, and got it. */
  healed: number;
  /** Entries written. */
  entries: number;
}

/**
 * Heal yesterday: one map read per active person, a merged write only
 * for a person whose map lacks an entry the day's ledger holds. Yesterday
 * only, no cursor — a night that fails leaves one day unhealed, and the
 * trigger is the writer; the heal is what makes a missed write a day's
 * lag rather than a permanent hole.
 */
export async function runAnswerMapHeal(store: AnswerMapStore, nowMs: number): Promise<AnswerMapHealSummary> {
  const day = utcDay(nowMs, -1);
  const byUid = foldAnswerMaps(await store.ledgerDay(day));
  const uids = [...byUid.keys()].sort();
  let healed = 0;
  let entries = 0;
  for (let i = 0; i < uids.length; i += 300) {
    const chunk = uids.slice(i, i + 300);
    const maps = await store.getMaps(chunk);
    const write = new Map<string, Record<string, number>>();
    for (const uid of chunk) {
      const missing = missingEntries(maps.get(uid) ?? null, byUid.get(uid)!);
      const n = Object.keys(missing).length;
      if (!n) continue;
      write.set(uid, missing);
      healed += 1;
      entries += n;
    }
    if (write.size) await store.putMaps(write);
  }
  return { day, people: uids.length, healed, entries };
}

export function firestoreAnswerMapStore(db: Firestore, ledgerDay: LedgerDayReader): AnswerMapStore {
  return {
    async ledgerDay(day) {
      return (await ledgerDay(day)).map((e) => ({ uid: e.uid, qid: e.qid, optionIdx: e.optionIdx }));
    },
    async getMaps(uids) {
      const out = new Map<string, Record<string, number>>();
      for (let i = 0; i < uids.length; i += 300) {
        const chunk = uids.slice(i, i + 300);
        const snaps = await db.getAll(...chunk.map((uid) => answerMapRef(db, uid)));
        snaps.forEach((snap, j) => {
          if (!snap.exists) return;
          out.set(chunk[j], (snap.get("a") as Record<string, number> | undefined) ?? {});
        });
      }
      return out;
    },
    async putMaps(entries) {
      const list = [...entries.entries()];
      for (let i = 0; i < list.length; i += 400) {
        const batch = db.batch();
        for (const [uid, m] of list.slice(i, i + 400)) batch.set(answerMapRef(db, uid), answerMapMerge(m), { merge: true });
        await batch.commit();
      }
    },
  };
}

// ── the backfill ────────────────────────────────────────────────────

/** Answer documents per page of the scan, and the most pages one call
 * walks before handing its cursor back — so one invocation stays inside
 * its deadline and the script asks again from where it stopped. */
export const BACKFILL_PAGE = 1000;
export const BACKFILL_MAX_PAGES = 200;

export interface BackfillOptions {
  /** Resume after this answer document path (the previous call's `next`). */
  after?: string | null;
  /** WRITE the maps. Off = count what would be written and change nothing. */
  apply: boolean;
  /** Stop and hand back the cursor once this many milliseconds have passed. */
  budgetMs?: number;
  /** Pages this call may walk — the constant, overridable by a test. */
  maxPages?: number;
}

export interface BackfillSummary {
  /** Answer documents read. */
  scanned: number;
  /** Of those, world answers with a usable index — what the maps hold. */
  folded: number;
  /** People whose map this call merged into (or would, on a dry run). */
  users: number;
  /** Map writes issued (0 on a dry run). */
  written: number;
  /** The path to resume after, or null when the scan reached the end. */
  next: string | null;
  done: boolean;
}

/**
 * Walk the `answers` collection group in path order — which keeps one
 * person's answers together — and merge each page's rows into maps, one
 * write per person per page. Idempotent: a merge of what the map already
 * holds changes nothing, so a rerun over the same range is safe.
 */
export async function runAnswerMapBackfill(db: Firestore, opts: BackfillOptions): Promise<BackfillSummary> {
  const started = Date.now();
  const budget = opts.budgetMs ?? 400_000;
  const maxPages = opts.maxPages ?? BACKFILL_MAX_PAGES;
  let scanned = 0;
  let folded = 0;
  let written = 0;
  const users = new Set<string>();
  let cursor: FirebaseFirestore.DocumentSnapshot | null = opts.after ? await db.doc(opts.after).get() : null;
  let next: string | null = opts.after ?? null;
  let done = false;
  for (let page = 0; page < maxPages; page += 1) {
    let q = db.collectionGroup("answers")
      .orderBy(FieldPath.documentId())
      .select("qid", "optionIdx", "surface")
      .limit(BACKFILL_PAGE);
    if (cursor) q = q.startAfter(cursor);
    const snap = await q.get();
    if (snap.empty) { done = true; break; }
    const rows: AnswerRow[] = [];
    for (const d of snap.docs) {
      scanned += 1;
      // The answer lives at v2_users/{uid}/answers/{qid}: the uid is the
      // grandparent's id — the replay tool's own reading of the path.
      const uid = d.ref.parent.parent?.id ?? "";
      rows.push({ uid, qid: String(d.get("qid") ?? d.id), optionIdx: d.get("optionIdx"), surface: d.get("surface") });
    }
    const maps = foldAnswerMaps(rows);
    for (const [uid, m] of maps) { folded += Object.keys(m).length; users.add(uid); }
    if (opts.apply && maps.size) {
      const list = [...maps.entries()];
      for (let i = 0; i < list.length; i += 400) {
        const batch = db.batch();
        for (const [uid, m] of list.slice(i, i + 400)) batch.set(answerMapRef(db, uid), answerMapMerge(m), { merge: true });
        await batch.commit();
        written += Math.min(400, list.length - i);
      }
    }
    cursor = snap.docs[snap.docs.length - 1];
    next = cursor.ref.path;
    if (snap.size < BACKFILL_PAGE) { done = true; break; }
    if (Date.now() - started > budget) break;
  }
  return { scanned, folded, users: users.size, written, next: done ? null : next, done };
}

export const backfillAnswerMapsV2 = onCall(
  { ...LIGHT_UNBOUNDED, region: FUNCTIONS_REGION },
  async (request: CallableRequest) => {
    assertOperator(request);
    const after = typeof request.data?.after === "string" && request.data.after ? request.data.after : null;
    const apply = request.data?.apply === true;
    // The same wrapper rebuildAggregateV2 carries, for the same reason: a
    // non-HttpsError reaches the operator as a bare INTERNAL, and the
    // operator is reading a job summary, not a Cloud Run log.
    try {
      const out = await runAnswerMapBackfill(firestore(), { after, apply });
      logger.info(`[answerMaps] backfill ${apply ? "applied" : "dry run"}: ${out.scanned} scanned, ${out.folded} folded, ${out.users} people, ${out.written} written`, {
        metric: "answer_map_backfill", ...out,
      });
      return out;
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const reason = err instanceof Error ? err.message : String(err);
      throw new HttpsError("internal", `backfill failed: ${reason}`);
    }
  },
);

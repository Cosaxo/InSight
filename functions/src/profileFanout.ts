// profileFanout.ts — a changed name or score reaches every sample row the
// account holds, at the moment it changes (DATA-EFFICIENCY-RUNBOOK 2.1).
//
// WHY A TRIGGER. Since runbook 2.2 a voter-sample row carries the person's
// display name, core scores and logic percentile as the world-answer
// trigger stamped them, and the device reads the row INSTEAD of the
// profile. That makes the stamp as-of-the-answer, like the anchors beside
// it — which is right for a cohort chip (D8) and wrong for a name: an
// account that renames would show its old name on every question it had
// answered until it answered that question again, which for most rows is
// never. The old path was no better in kind (a 7-day profile cache, D129)
// but it was bounded, and "as long as the cost difference isn't huge, live
// is best" is the owner's standing word on exactly this trade (D446).
//
// WHAT IT COSTS, which is why it is affordable. It fires on every write to
// a profile document and does nothing — no read — unless the stamp
// changed: `saveAnchors`, a consent record, a handle claim all leave the
// stamp as it was. When it did change (a rename, a test taken or retaken,
// a verified logic score landing), it reads the account's OWN answers to
// learn which samples can hold its rows — the world sample of every
// corpus question it answered and the city sample of every (question,
// city) pair its frozen chips name — reads those documents, and rewrites
// the three stamp fields under `rows.{uid}` where a row exists. Bounded
// by the account's answers; a rename is a handful of times per account
// lifetime, so per user-day this rounds to nothing (cost-arith's
// `PROFILE_FANOUT_OPS`).
//
// NEVER A ROW IT DID NOT FIND. `rows.{uid}.n` written on a document where
// the row is absent would mint a partial row — no option, no day — so the
// documents are read first and only a row that exists is touched; the
// erasure arm (index.ts, 1a′) is the same shape for the same reason.
//
// NO RETRY. A fan-out that fails leaves a stale name until the next
// profile write or the next nightly merge of those samples, which is the
// pre-2.2 condition and not a lost count; the seven-day redelivery the
// answer triggers carry would be the wrong instrument for it.
//
// A BUDGET, because this is the largest amplifier of one client write in
// the deploy (COST-EXPOSURE.md §8). A profile document takes about a
// write a second, and each stamp change costs the account's answers in
// reads plus a read and a write per sample that holds its row — a few
// thousand operations for an account that has answered a few thousand
// times, on the order of $300 a day for one attested account flipping its
// name, bounded only by the trigger's instance cap. A real rename is a
// handful of times per account LIFETIME (cost-arith's `stampChanges`), so
// PROFILE_FANOUT_PER_HOUR costs nobody anything visible; past it the
// change leaves a marker and the nightly heal applies the CURRENT stamp,
// which keeps the promise that the last name lands within a day. The
// ledger is the sliding window every other budget here uses
// (v2_ratelimits, server-only, erased with the account — index.ts 4b).
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { FieldPath, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { FUNCTIONS_REGION, LIGHT_UNBOUNDED } from "./ops";
import { db as firestore, FIRESTORE_DB_ID } from "./db";
import { profileStamp, sameStamp, type ProfileStamp } from "./profileStamp";
import { citySampleId, worldSampleId } from "./patternsSamples";
import { PATTERNS_ITEMS } from "./patterns";

const PAGE = 1000;

/** Stamp changes an account may fan out in an hour; past it, the marker
 * and the nightly heal (the header's budget paragraph). */
export const PROFILE_FANOUT_PER_HOUR = 3;
/** Accounts the nightly heal takes a night — a page, bounded like every
 * other nightly fold; the rest wait a day. */
export const FANOUT_HEAL_CAP = 500;
export const FANOUT_BUDGET_PREFIX = "fanout_";
/** The budget ledger's id under `v2_ratelimits`, keyed by uid so the
 * erasure arm can name it. */
export const fanoutBudgetId = (uid: string): string => `${FANOUT_BUDGET_PREFIX}${uid}`;

/** The transaction surface the budget needs — Firestore's, and a fake's. */
export interface BudgetTx {
  get(ref: FirebaseFirestore.DocumentReference): Promise<{ exists: boolean; get(field: string): unknown }>;
  set(ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>, opts: { merge: boolean }): unknown;
}

/**
 * Take one fan-out from the account's hourly budget: "now" to fan out,
 * "deferred" when the hour's budget is spent — the ledger then carries
 * `pending: true` for the nightly heal. A fan-out that goes through
 * clears `pending`, because it applies the current stamp, which is all a
 * heal would do.
 */
export async function takeFanoutBudget(
  db: Pick<Firestore, "collection" | "runTransaction">,
  uid: string,
  nowMs: number,
): Promise<"now" | "deferred"> {
  const ref = db.collection("v2_ratelimits").doc(fanoutBudgetId(uid));
  return db.runTransaction(async (tx) => {
    const snap = await (tx as unknown as BudgetTx).get(ref);
    const cutoff = nowMs - 3_600_000;
    const events: number[] = ((snap.exists && (snap.get("events") as number[] | undefined)) || []).filter((t) => t > cutoff);
    // TTL-swept like the other ledgers (D333); the heal runs long before.
    const expireAt = new Date(nowMs + 2 * 86_400_000);
    if (events.length >= PROFILE_FANOUT_PER_HOUR) {
      (tx as unknown as BudgetTx).set(ref, { events, pending: true, expireAt }, { merge: true });
      return "deferred";
    }
    events.push(nowMs);
    (tx as unknown as BudgetTx).set(ref, { events, pending: false, expireAt }, { merge: true });
    return "now";
  });
}

export interface FanoutHealStore {
  /** Accounts whose ledger says `pending`, up to `limit`. */
  pending(limit: number): Promise<string[]>;
  /** The account's CURRENT stamp, or null where the profile is gone. */
  stampOf(uid: string): Promise<ProfileStamp | null>;
  /** restampSamples over the real database; returns documents touched. */
  restamp(uid: string, stamp: ProfileStamp): Promise<number>;
  clear(uid: string): Promise<void>;
}

export interface FanoutHealSummary {
  pending: number;
  healed: number;
  touched: number;
}

/**
 * The nightly heal: every account the budget deferred gets the fan-out
 * it was refused, from the profile as it is NOW (the last of a burst is
 * the one that should land; the intermediate ones never mattered). A
 * gone profile is an erased account whose rows the erasure arm already
 * scrubbed — its marker is cleared and nothing is read for it.
 */
export async function runFanoutHeal(store: FanoutHealStore): Promise<FanoutHealSummary> {
  const uids = await store.pending(FANOUT_HEAL_CAP);
  let healed = 0;
  let touched = 0;
  for (const uid of uids) {
    const stamp = await store.stampOf(uid);
    if (stamp) {
      touched += await store.restamp(uid, stamp);
      healed += 1;
    }
    await store.clear(uid);
  }
  return { pending: uids.length, healed, touched };
}

export function firestoreFanoutHealStore(db: Firestore): FanoutHealStore {
  const ledgers = () => db.collection("v2_ratelimits");
  return {
    async pending(limit) {
      // Only the fan-out ledgers carry `pending`; the prefix filter is
      // belt and braces against a future ledger that borrows the field.
      const snap = await ledgers().where("pending", "==", true).limit(limit).get();
      return snap.docs.map((d) => d.id)
        .filter((id) => id.startsWith(FANOUT_BUDGET_PREFIX))
        .map((id) => id.slice(FANOUT_BUDGET_PREFIX.length));
    },
    async stampOf(uid) {
      const snap = await db.collection("v2_users").doc(uid).get();
      if (!snap.exists) return null;
      return profileStamp({ displayName: snap.get("displayName"), testResults: snap.get("testResults") });
    },
    restamp: (uid, stamp) => restampSamples(db, uid, stamp),
    async clear(uid) {
      await ledgers().doc(fanoutBudgetId(uid)).set({ pending: false }, { merge: true });
    },
  };
}

/** The corpus that has samples at all: a tail or learn answer names a
 * question the nightly never writes a sample for, and asking Firestore
 * for a document that is not there is still a billed read. */
let corpus: Set<string> | null = null;
export function sampledQids(): ReadonlySet<string> {
  if (!corpus) corpus = new Set(PATTERNS_ITEMS.map((i) => i.qid));
  return corpus;
}

/** The sample documents an account's answers could have put a row in —
 * the world sample per corpus question answered, the city sample per
 * (question, city) its frozen chips name. Pure; the trigger reads the
 * answers and hands them here. */
export function sampleIdsFor(
  answers: ReadonlyArray<{ qid: string; city?: string }>,
  eligible: ReadonlySet<string> = sampledQids(),
): string[] {
  const ids = new Set<string>();
  for (const a of answers) {
    if (!a.qid || !eligible.has(a.qid)) continue;
    ids.add(worldSampleId(a.qid));
    if (typeof a.city === "string" && a.city.trim()) ids.add(citySampleId(a.qid, a.city));
  }
  return [...ids].sort();
}

/**
 * Rewrite the stamp under `rows.{uid}` in every sample that holds the
 * account's row. Returns how many documents were touched.
 */
export async function restampSamples(db: Firestore, uid: string, stamp: ProfileStamp): Promise<number> {
  // The account's own answers, paged: qid and the frozen chips, nothing
  // else on the wire.
  const answers: { qid: string; city?: string }[] = [];
  let query = db.collection("v2_users").doc(uid).collection("answers")
    .orderBy(FieldPath.documentId())
    .select("qid", "anchors")
    .limit(PAGE);
  for (;;) {
    const snap = await query.get();
    for (const d of snap.docs) {
      const anchors = d.get("anchors") as { city?: unknown } | undefined;
      answers.push({
        qid: String(d.get("qid") ?? ""),
        ...(typeof anchors?.city === "string" ? { city: anchors.city } : {}),
      });
    }
    if (snap.size < PAGE) break;
    query = query.startAfter(snap.docs[snap.size - 1]);
  }
  const ids = sampleIdsFor(answers);
  let touched = 0;
  for (let i = 0; i < ids.length; i += 300) {
    const chunk = ids.slice(i, i + 300);
    const snaps = await db.getAll(...chunk.map((id) => db.collection("v2_patterns").doc(id)));
    let batch = db.batch();
    let ops = 0;
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const rows = (snap.get("rows") as Record<string, unknown> | undefined) ?? {};
      if (!(uid in rows)) continue;
      batch.update(snap.ref, {
        [`rows.${uid}.n`]: stamp.n,
        [`rows.${uid}.s`]: stamp.s,
        [`rows.${uid}.l`]: stamp.l,
      });
      touched += 1;
      if (++ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops) await batch.commit();
  }
  return touched;
}

export const onV2ProfileUpdated = onDocumentUpdated(
  { ...LIGHT_UNBOUNDED, region: FUNCTIONS_REGION, database: FIRESTORE_DB_ID, document: "v2_users/{uid}" },
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    if (!before || !after) return;
    const prev = profileStamp({ displayName: before.get("displayName"), testResults: before.get("testResults") });
    const next = profileStamp({ displayName: after.get("displayName"), testResults: after.get("testResults") });
    if (sameStamp(prev, next)) return;
    const db = firestore();
    if ((await takeFanoutBudget(db, event.params.uid, Date.now())) === "deferred") {
      logger.warn(`[v2] profile stamp changed more than ${PROFILE_FANOUT_PER_HOUR} times in an hour for ${event.params.uid} — fan-out deferred to the nightly heal`, {
        metric: "profile_fanout_deferred",
      });
      return;
    }
    const touched = await restampSamples(db, event.params.uid, next);
    if (touched) {
      logger.info(`[v2] profile stamp moved into ${touched} voter sample(s)`, {
        metric: "profile_fanout", touched,
      });
    }
  },
);

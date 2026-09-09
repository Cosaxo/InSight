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
// is best" is the owner's standing word on exactly this trade (D429).
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
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { FieldPath, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { FUNCTIONS_REGION, LIGHT_UNBOUNDED } from "./ops";
import { db as firestore, FIRESTORE_DB_ID } from "./db";
import { profileStamp, sameStamp, type ProfileStamp } from "./profileStamp";
import { citySampleId, worldSampleId } from "./patternsSamples";
import { PATTERNS_ITEMS } from "./patterns";

const PAGE = 1000;

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
    const touched = await restampSamples(firestore(), event.params.uid, next);
    if (touched) {
      logger.info(`[v2] profile stamp moved into ${touched} voter sample(s)`, {
        metric: "profile_fanout", touched,
      });
    }
  },
);

// InSight v2 — the social layer ("know each other"): groups, duos, and
// server-materialized reveals (decision D5).
//
// A duo IS a group with mode "duo" and a 2-member cap — one collection,
// one reveal pipeline, two reveal conditions:
//   group  · next UTC day, if at least one member answered
//   duo    · next UTC day, ONLY if both played (else no reveal, streak 0)
//
// Sealed answers live in each member's OWNER-ONLY answers subcollection
// under composite ids (g_{gid}_{day}); nobody can read anyone else's
// answer before the reveal doc exists, because nothing readable exists.
// Membership changes go through callables — client rules keep v2_groups
// read-only — so invite codes, size caps and duo pairing can't be forged.

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { randomBytes } from "node:crypto";

const REGION = "us-central1";
const GROUP_CAP = 32;

// ── helpers ─────────────────────────────────────────────────────

// Unambiguous invite alphabet (no 0/O/1/I/L).
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function inviteCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

function utcDayKey(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

function prevDayKey(dayKey: string): string {
  const d = new Date(dayKey + "T00:00:00Z");
  return new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
}

// ── membership callables ────────────────────────────────────────

// Callers pass their display name (profiles are owner-only, so names
// must ride on the group doc for members to render each other).
async function callerName(uid: string, given: unknown): Promise<string> {
  const name = typeof given === "string" ? given.trim().slice(0, 60) : "";
  const db = getFirestore();
  if (name) {
    await db.doc(`v2_users/${uid}`).set({ displayName: name }, { merge: true });
    return name;
  }
  const prof = await db.doc(`v2_users/${uid}`).get();
  return (prof.exists && prof.get("displayName")) || "";
}

export const createGroupV2 = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const name = String(request.data?.name || "").trim();
  const mode = request.data?.mode === "duo" ? "duo" : "group";
  if (!name || name.length > 60) {
    throw new HttpsError("invalid-argument", "name required (≤60 chars)");
  }
  const myName = await callerName(uid, request.data?.displayName);
  const db = getFirestore();
  const ref = db.collection("v2_groups").doc();
  await ref.set({
    name,
    mode,
    ownerUid: uid,
    memberUids: [uid],
    memberNames: { [uid]: myName },
    inviteCode: inviteCode(),
    streak: 0,
    lastRevealDay: null,
    createdAt: FieldValue.serverTimestamp(),
  });
  const snap = await ref.get();
  return { gid: ref.id, inviteCode: snap.get("inviteCode") };
});

export const joinGroupV2 = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const code = String(request.data?.code || "").trim().toUpperCase();
  if (!code) throw new HttpsError("invalid-argument", "code required");
  const db = getFirestore();
  const q = await db.collection("v2_groups")
    .where("inviteCode", "==", code).limit(1).get();
  if (q.empty) throw new HttpsError("not-found", "no group with that code");
  const ref = q.docs[0].ref;
  const myName = await callerName(uid, request.data?.displayName);
  const out = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const members: string[] = snap.get("memberUids") || [];
    if (members.includes(uid)) return { gid: ref.id, name: snap.get("name") };
    const cap = snap.get("mode") === "duo" ? 2 : GROUP_CAP;
    if (members.length >= cap) {
      throw new HttpsError("resource-exhausted", "group is full");
    }
    tx.update(ref, {
      memberUids: FieldValue.arrayUnion(uid),
      [`memberNames.${uid}`]: myName,
    });
    return { gid: ref.id, name: snap.get("name") };
  });
  return out;
});

export const leaveGroupV2 = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const gid = String(request.data?.gid || "");
  const db = getFirestore();
  const ref = db.collection("v2_groups").doc(gid);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "no such group");
  const members: string[] = snap.get("memberUids") || [];
  if (!members.includes(uid)) throw new HttpsError("permission-denied", "not a member");
  if (members.length === 1) {
    await db.recursiveDelete(ref); // last member out → group and reveals go
    return { gid, deleted: true };
  }
  await ref.update({
    memberUids: FieldValue.arrayRemove(uid),
    [`memberNames.${uid}`]: FieldValue.delete(),
  });
  return { gid, deleted: false };
});

// ── the reveal pipeline ─────────────────────────────────────────

interface RevealVote {
  optionIdx: number;
  guessIdx?: number;
}

async function revealGroupDay(
  group: FirebaseFirestore.QueryDocumentSnapshot,
  dayKey: string,
): Promise<boolean> {
  const db = getFirestore();
  const gid = group.id;
  const mode: string = group.get("mode") || "group";
  const members: string[] = group.get("memberUids") || [];
  if (!members.length) return false;
  const revealRef = group.ref.collection("reveals").doc(dayKey);
  if ((await revealRef.get()).exists) return false;

  const answerId = `g_${gid}_${dayKey}`;
  const snaps = await db.getAll(
    ...members.map((uid) => db.doc(`v2_users/${uid}/answers/${answerId}`)),
    ...members.map((uid) => db.doc(`v2_users/${uid}`)),
  );
  const answerSnaps = snaps.slice(0, members.length);
  const profileSnaps = snaps.slice(members.length);

  const votes: Record<string, RevealVote> = {};
  let qid: string | null = null;
  answerSnaps.forEach((s, i) => {
    if (!s.exists) return;
    const optionIdx = s.get("optionIdx");
    if (typeof optionIdx !== "number") return;
    const v: RevealVote = { optionIdx };
    const guessIdx = s.get("guessIdx");
    if (typeof guessIdx === "number") v.guessIdx = guessIdx;
    votes[members[i]] = v;
    qid = qid || s.get("qid") || null;
  });
  const played = Object.keys(votes).length;

  if (mode === "duo") {
    // both-or-nothing — and the streak lives or dies on it
    if (played < 2) {
      if (group.get("streak")) await group.ref.update({ streak: 0 });
      return false;
    }
  } else if (played === 0) {
    return false;
  }

  const names: Record<string, string> = {};
  profileSnaps.forEach((s, i) => {
    names[members[i]] = (s.exists && s.get("displayName")) || "";
  });

  await revealRef.set({
    day: dayKey,
    qid,
    votes,
    names,
    revealedAt: FieldValue.serverTimestamp(),
  });
  const prevStreakDay = group.get("lastRevealDay");
  const streak =
    prevStreakDay === prevDayKey(dayKey) ? (group.get("streak") || 0) + 1 : 1;
  await group.ref.update({ streak, lastRevealDay: dayKey });
  return true;
}

async function runDuelReveals(dayKey?: string): Promise<{ revealed: number }> {
  const db = getFirestore();
  const yester = dayKey || utcDayKey(-1);
  const groups = await db.collection("v2_groups").limit(2000).get();
  let revealed = 0;
  for (const g of groups.docs) {
    try {
      if (await revealGroupDay(g, yester)) revealed++;
    } catch (err) {
      logger.error(`[v2social] reveal failed for ${g.id}/${yester}:`, err);
    }
  }
  logger.info(`[v2social] reveals for ${yester}: ${revealed}`);
  return { revealed };
}

export const scheduledDuelReveals = onSchedule(
  { schedule: "every 60 minutes", region: REGION },
  async () => {
    await runDuelReveals();
  },
);

// Test/ops hook — emulator, or the SEED_ADMIN_UIDS operators.
export const revealDuelsNowV2 = onCall({ region: REGION }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
  const admins = (process.env.SEED_ADMIN_UIDS || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (!isEmulator && !admins.includes(request.auth.uid)) {
    throw new HttpsError("permission-denied", "operator-only");
  }
  const dayKey = typeof request.data?.day === "string" ? request.data.day : undefined;
  return runDuelReveals(dayKey);
});

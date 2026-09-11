// InSight v2 — the social layer ("know each other"): groups, duos, and
// server-materialized reveals (decision D5).
//
// A duo IS a group with mode "duo" and a 2-member cap — one collection,
// one reveal pipeline, and ONE reveal condition since D426/D437 (this
// listed two calendar-day conditions until 2026-09-11, nine lines above
// its own correct sentence about rounds):
//   `roundReveals` (pure.ts) — an answer in it, AND complete, due or
//   forced. Complete is both for a duo and all for a group; due is the
//   48-hour `ROUND_DEADLINE_MS`, at which it reveals for whoever played.
// The old "duo · ONLY if both played (else no reveal, streak 0)" is the
// both-or-nothing 1v1 pure.ts says it retired in as many words: "a
// partner who stops playing used to seal the other's answer with no
// reveal, ever".
//
// Sealed answers live under composite ids (g_{gid}_r{n} — one per ROUND,
// ROUNDS-PLAN / D426). Since D98 a
// user's world answers are readable by anyone, but DUEL answers are the
// exception the rules still carve out — read is gated on `surface`, so
// nobody sees a groupmate's pick before the reveal. That is a game
// timing rule, not a privacy one; the reveal publishes the whole table.
// Membership changes go through callables — client rules keep v2_groups
// read-only — so invite codes, size caps and duo pairing can't be forged.

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onCall, HttpsError } from "firebase-functions/v2/https";
// Type-only: `requestJoinImpl` is shared by two exported callables
// (D240), so its parameter needs the shape onCall hands a handler.
import type { CallableRequest } from "firebase-functions/v2/https";
import {
  assertOperator,
  ENFORCE_APP_CHECK,
  LIGHT_CALLABLE,
  LIGHT_UNBOUNDED,
  FUNCTIONS_REGION,
} from "./ops";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { randomBytes } from "node:crypto";
import { V2_QUESTIONS } from "./v2content";
import { db as firestore } from "./db";
import {
  duelAggDelta,
  fcmBatches,
  fcmFanout,
  foldDuelAgg,
  foldRoleLedger,
  inviteCodeFromBytes,
  normalizeHandle,
  isPlausibleFcmToken,
  nextFcmTokens,
  movesPresentState,
  openRound,
  playedIn,
  prunePlayed,
  roundKey,
  roundReveals,
  ROUND_DEADLINE_MS,
  ROUND_LEAD,
  utcDayKeyOf,
  nextStreak,
  publishableDuelAgg,
  revealQid,
  revealVotes,
  revealMembersFor,
  votesMatchingQid,
  presenceCellOk,
  presenceNeighbors,
  PRESENCE_LINGER_MIN,
  ROOM_SAMPLE_CAP,
  ROOM_PEOPLE_CAP,
  roomWindowMisses,
  ROOM_SCAN_CAP,
  sampleN,
  roomMix,
  roomQids,
  tallyPicks,
  type RoomMix,
  type RoomCounts,
  type DuelVoteLike,
  isStamped,
  type TurnRecipient,
} from "./pure";

const REGION = FUNCTIONS_REGION;
const GROUP_CAP = 32;
const MEMBERSHIP_CAP = 20;      // groups+duos one account may belong to
const JOIN_ATTEMPTS_PER_HOUR = 30; // invite codes are 31^8 — this makes
                                   // brute force astronomically slow
const GROUP_SCAN_CAP = 2000;    // total groups one reveal run will scan
const PAGE_SIZE = 300;          // groups fetched per cursor page

// ── helpers ─────────────────────────────────────────────────────

// Alphabet + byte→char mapping live in pure.ts; only the entropy
// source stays here.
function inviteCode(): string {
  return inviteCodeFromBytes(randomBytes(8));
}

// ── membership callables ────────────────────────────────────────

/**
 * Is this account already in as many circles as it may be?
 *
 * A predicate as well as an assertion because the approval path cannot
 * throw where it checks: `approveJoinV2` clears a stale queue row for
 * somebody who is ALREADY a member, and that must keep working for a
 * person at the cap — otherwise a row nobody can clear stays drawn on the
 * owner's screen forever. So the query runs before the transaction (a
 * transaction cannot run a query at all) and the answer is used inside it,
 * where the "already a member" case is decided.
 */
async function atMembershipCap(uid: string): Promise<boolean> {
  const db = firestore();
  const mine = await db.collection("v2_groups")
    .where("memberUids", "array-contains", uid).limit(MEMBERSHIP_CAP).get();
  return mine.size >= MEMBERSHIP_CAP;
}

async function assertMembershipCap(uid: string): Promise<void> {
  if (await atMembershipCap(uid)) {
    throw new HttpsError("resource-exhausted", "too many groups on this account");
  }
}

// `memberJoinedAt` as plain millis, for revealMembersFor. Firestore hands
// back Timestamps; pure.ts takes numbers so it stays firebase-free.
//
// A value that is not a Timestamp becomes `undefined`, which
// revealMembersFor reads as "no recorded join time" and therefore includes —
// the same answer it gives a member who predates the field. Both are the
// permissive direction, and deliberately so: the alternative is a reveal its
// own members cannot read.
function joinedAtMs(raw: unknown): Record<string, number> {
  const out: Record<string, number> = Object.create(null);
  if (!raw || typeof raw !== "object") return out;
  for (const [uid, v] of Object.entries(raw as Record<string, unknown>)) {
    const ms = (v as { toMillis?: () => number })?.toMillis?.();
    if (typeof ms === "number" && Number.isFinite(ms)) out[uid] = ms;
  }
  return out;
}

// Collision-checked (31^8 space, so retries are cosmically rare — but
// joinGroupV2's limit(1) would land someone in the wrong group).
async function uniqueInviteCode(): Promise<string> {
  const db = firestore();
  for (let i = 0; i < 4; i++) {
    const code = inviteCode();
    const clash = await db.collection("v2_groups")
      .where("inviteCode", "==", code).limit(1).get();
    if (clash.empty) return code;
  }
  throw new HttpsError("internal", "could not mint an invite code");
}

// Sliding-hour throttle on join attempts (the only invite-probe path —
// clients can't query v2_groups without membership).
async function assertJoinBudget(uid: string): Promise<void> {
  const db = firestore();
  const ref = db.collection("v2_ratelimits").doc(`join_${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cutoff = Date.now() - 3600000;
    const events: number[] = ((snap.exists && snap.get("events")) || [])
      .filter((t: number) => t > cutoff);
    if (events.length >= JOIN_ATTEMPTS_PER_HOUR) {
      throw new HttpsError("resource-exhausted", "too many join attempts — try later");
    }
    events.push(Date.now());
    tx.set(ref, { events, expireAt: new Date(Date.now() + 2 * 3600000) });
  });
}

// Callers pass their display name (profiles are owner-only, so names
// must ride on the group doc for members to render each other).
async function callerName(uid: string, given: unknown): Promise<string> {
  const name = typeof given === "string" ? given.trim().slice(0, 60) : "";
  const db = firestore();
  if (name) {
    await db.doc(`v2_users/${uid}`).set({ displayName: name }, { merge: true });
    return name;
  }
  const prof = await db.doc(`v2_users/${uid}`).get();
  return (prof.exists && prof.get("displayName")) || "";
}

export const createGroupV2 = onCall({ ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const name = String(request.data?.name || "").trim();
  const mode = request.data?.mode === "duo" ? "duo" : "group";
  if (!name || name.length > 60) {
    throw new HttpsError("invalid-argument", "name required (≤60 chars)");
  }
  const db = firestore();
  await assertMembershipCap(uid);
  const myName = await callerName(uid, request.data?.displayName);
  const code = await uniqueInviteCode();
  const ref = db.collection("v2_groups").doc();
  await ref.set({
    name,
    mode,
    ownerUid: uid,
    memberUids: [uid],
    memberNames: { [uid]: myName },
    // When each member became one. Read only by revealRound, to scope a
    // round's reveal to the people who were in the group when it opened —
    // see revealMembersFor (pure.ts). Same map shape as memberNames, and it is
    // removed on the same two paths (leaveGroupV2, deleteAccount phase 1c),
    // because a uid left behind here is the shape D55 §8 records ownerUid
    // having.
    memberJoinedAt: { [uid]: FieldValue.serverTimestamp() },
    inviteCode: code,
    streak: 0,
    lastRevealDay: null,
    // The open round (ROUNDS-PLAN, D426). Absent reads as 1 everywhere it
    // is read — the rules, the client, the reveal — so this is stated
    // rather than relied on. `played` and the round's clock arrive with
    // the first answer, from the answer trigger.
    round: 1,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { gid: ref.id, inviteCode: code };
});

/**
 * How many people may be waiting on one circle at a time.
 *
 * The pending list lives ON the group document, which every member reads
 * on every load — so this is not a product limit but the bound on a list
 * a stranger with a forwarded link can lengthen. Twenty keeps the
 * document small; the rate limit below keeps the arrival rate sane.
 */
const PENDING_CAP = 20;

/**
 * Ask to join a circle by its invite code — the LINK's landing (D240).
 *
 * THIS USED TO ADMIT. `joinGroupV2` wrote straight into `memberUids`, so
 * a code was a bearer token: whoever held it was in, forever, with no
 * expiry and no rotation, and nobody already in the circle had agreed to
 * them. D122 built consent for invitations precisely because joining
 * puts your name on a sealed answer these people read the next day —
 * and the link walked around it.
 *
 * So the link now puts you FORWARD instead of in. The circle's side of
 * the consent is a member tapping Approve, which is the half a bearer
 * token could never supply.
 *
 * TWO SHORTCUTS, both of them the circle having already consented:
 *   · you are a member → nothing to do, say so;
 *   · somebody already invited you by handle → that IS the circle
 *     choosing you, so the link completes the invitation rather than
 *     opening a second queue behind it. Without this the smooth path
 *     (invite them, send them the link) would ask a member to approve
 *     the person they just invited.
 *
 * PENDING LIVES ON THE GROUP DOCUMENT, not in a subcollection, and that
 * is a cost decision. Members already read this document; a subcollection
 * would need its own member-gated read rule, and the only way rules can
 * express that is `get()` on the group — one billed read per request
 * listed, which is the tripwire D122 hit and backed out of.
 */
async function requestJoinImpl(request: CallableRequest): Promise<{
  gid: string; name: string; status: "member" | "joined" | "requested" | "waiting";
}> {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const code = String(request.data?.code || "").trim().toUpperCase();
  if (!code) throw new HttpsError("invalid-argument", "code required");
  await assertJoinBudget(uid);
  await assertMembershipCap(uid);
  const db = firestore();
  const q = await db.collection("v2_groups")
    .where("inviteCode", "==", code).limit(1).get();
  if (q.empty) throw new HttpsError("not-found", "no group with that code");
  const ref = q.docs[0].ref;
  const myName = await callerName(uid, request.data?.displayName);
  const inviteRef = ref.collection("invites").doc(uid);

  const out = await db.runTransaction(async (tx) => {
    const [snap, invite] = await Promise.all([tx.get(ref), tx.get(inviteRef)]);
    const name = String(snap.get("name") || "");
    const members: string[] = snap.get("memberUids") || [];
    if (members.includes(uid)) return { gid: ref.id, name, status: "member" as const };

    const admit = () => {
      const cap = snap.get("mode") === "duo" ? 2 : GROUP_CAP;
      if (members.length >= cap) throw new HttpsError("resource-exhausted", "group is full");
      tx.update(ref, {
        memberUids: FieldValue.arrayUnion(uid),
        [`memberNames.${uid}`]: myName,
        // Set on every join, including a rejoin after leaving: the days
        // between are days this account was not in the group, and a
        // stale earlier timestamp would hand them back.
        [`memberJoinedAt.${uid}`]: FieldValue.serverTimestamp(),
        // Whichever way they arrived, they are not waiting any more.
        pending: FieldValue.arrayRemove(uid),
        [`pendingNames.${uid}`]: FieldValue.delete(),
      });
    };

    // Already invited → the circle picked them. Complete it.
    if (invite.exists) {
      admit();
      tx.delete(inviteRef);
      return { gid: ref.id, name, status: "joined" as const };
    }

    const pending: string[] = snap.get("pending") || [];
    if (pending.includes(uid)) return { gid: ref.id, name, status: "waiting" as const };
    if (pending.length >= PENDING_CAP) {
      throw new HttpsError("resource-exhausted", "too many people are already waiting");
    }
    tx.update(ref, {
      pending: FieldValue.arrayUnion(uid),
      [`pendingNames.${uid}`]: myName,
    });
    return { gid: ref.id, name, status: "requested" as const };
  });

  // The members are the ones who can act on it, so they are the ones
  // told. Best-effort by construction — sendPushToUids never throws, so
  // a dead FCM cannot roll back a request that was written.
  if (out.status === "requested") {
    const fresh = await ref.get();
    await sendPushToUids(
      db,
      (fresh.get("memberUids") || []) as string[],
      {
        title: out.name || "InSight",
        body: `${myName || "Someone"} wants to join.`,
      },
      { kind: "join-request", gid: out.gid },
      "invites",
      "join-request",
    );
  }
  return out;
}

// The name the link and every shipped build already call. Kept ALIASED
// rather than renamed (D240): a callable that disappears is a hard error
// in every app version already installed, and this one is reached by the
// one flow a stranger uses. Same implementation, so an old build asks to
// join instead of admitting itself — which is the whole point, and it
// takes effect for those builds the moment this deploys rather than
// whenever they update.
export const joinGroupV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  requestJoinImpl,
);
/** The name that says what it does. Both point at one implementation. */
export const requestJoinV2 = onCall(
  { ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK },
  requestJoinImpl,
);

/**
 * Let somebody in who asked (D240) — the circle's half of the consent.
 *
 * Members only, which is the same gate `inviteToGroupV2` uses and for the
 * same reason: an approval from a non-member would let anyone add anyone
 * to any circle they can name the id of.
 */
export const approveJoinV2 = onCall({ ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const gid = String(request.data?.gid || "");
  const who = String(request.data?.uid || "");
  if (!gid || !who) throw new HttpsError("invalid-argument", "gid and uid required");
  const db = firestore();
  const ref = db.doc(`v2_groups/${gid}`);
  // THE JOINER'S CAP, checked here because this is the one admission path
  // that never did. `createGroupV2`, the join REQUEST and the invite accept
  // all assert it; approve checked only the circle's own size, so a
  // popular invite link could put somebody in far more circles than the cap
  // allows — thirty requests is one hour of the rate limit, and every
  // approval is somebody else's tap. That cap is also what bounds
  // deleteAccount's group walk, which has no limit of its own.
  //
  // Read before the transaction and USED inside it: a transaction cannot
  // run a query, and the "already a member" branch below has to keep
  // clearing stale queue rows for people who are at the cap.
  const capped = await atMembershipCap(who);
  const name = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "no such circle");
    const members: string[] = snap.get("memberUids") || [];
    if (!members.includes(uid)) throw new HttpsError("permission-denied", "not a member");
    // Already in. Clear the queue row rather than returning to leave it
    // drawn: this is the ONE path a stale row can be cleared from, since
    // the "Let in" button under it calls exactly this. Reachable from a
    // double tap, and from the accept/approve race — whichever
    // transaction lands second sees a member and arrives here.
    if (members.includes(who)) {
      tx.update(ref, {
        pending: FieldValue.arrayRemove(who),
        [`pendingNames.${who}`]: FieldValue.delete(),
      });
      return String(snap.get("name") || "");
    }
    const pending: string[] = snap.get("pending") || [];
    // Only somebody who actually asked. Without this, approve is an
    // add-anyone endpoint wearing a different name.
    if (!pending.includes(who)) throw new HttpsError("failed-precondition", "they have not asked");
    const cap = snap.get("mode") === "duo" ? 2 : GROUP_CAP;
    if (members.length >= cap) throw new HttpsError("resource-exhausted", "circle is full");
    // …and the other side of the same bound: the circle has room, but they
    // do not. Said as THEIR limit rather than as this circle's, because
    // the person tapping "Let in" has done nothing wrong and the message
    // is what they read.
    if (capped) throw new HttpsError("resource-exhausted", "they are in too many circles");
    tx.update(ref, {
      memberUids: FieldValue.arrayUnion(who),
      [`memberNames.${who}`]: String(snap.get("pendingNames")?.[who] || ""),
      [`memberJoinedAt.${who}`]: FieldValue.serverTimestamp(),
      pending: FieldValue.arrayRemove(who),
      [`pendingNames.${who}`]: FieldValue.delete(),
    });
    return String(snap.get("name") || "");
  });
  await sendPushToUids(
    db, [who],
    { title: name || "InSight", body: "You're in." },
    { kind: "join-approved", gid },
    "invites",
    "join-approved",
  );
  return { ok: true };
});

/**
 * Turn somebody down (D240).
 *
 * Tells them NOTHING, on D122's reasoning about declining an invitation:
 * a "declined" state makes refusing someone a message you have to send
 * them, which is what makes people accept — or here, approve — requests
 * they do not want. The row simply stops being there.
 */
export const declineJoinV2 = onCall({ ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const gid = String(request.data?.gid || "");
  const who = String(request.data?.uid || "");
  if (!gid || !who) throw new HttpsError("invalid-argument", "gid and uid required");
  const db = firestore();
  const ref = db.doc(`v2_groups/${gid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "no such circle");
    const members: string[] = snap.get("memberUids") || [];
    if (!members.includes(uid)) throw new HttpsError("permission-denied", "not a member");
    tx.update(ref, {
      pending: FieldValue.arrayRemove(who),
      [`pendingNames.${who}`]: FieldValue.delete(),
    });
  });
  return { ok: true };
});

export const leaveGroupV2 = onCall({ ...LIGHT_UNBOUNDED, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const gid = String(request.data?.gid || "");
  const db = firestore();
  const ref = db.collection("v2_groups").doc(gid);

  // Read-then-write in a transaction. Unguarded, two members of a duo
  // leaving at the same moment both read length === 2, both take the
  // arrayRemove branch, and the group survives with memberUids: [] — no
  // client can read it (rules gate on membership), so nobody can leave it
  // or delete it, while the 2-hourly reveal scan re-fetches it forever.
  // joinGroupV2 already does its size check inside a transaction; this is
  // the same pattern.
  //
  // The recursiveDelete cannot go inside — it is a multi-batch operation,
  // not a transactional write — so the transaction decides, and the delete
  // follows. A concurrent leave landing in that window is harmless: the
  // loser's transaction sees the already-shrunk membership.
  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("not-found", "no such group");
    const members: string[] = snap.get("memberUids") || [];
    if (!members.includes(uid)) throw new HttpsError("permission-denied", "not a member");
    if (members.length === 1) return "delete" as const;
    tx.update(ref, {
      memberUids: FieldValue.arrayRemove(uid),
      [`memberNames.${uid}`]: FieldValue.delete(),
      [`memberJoinedAt.${uid}`]: FieldValue.delete(),
      // …and out of every round they have sealed but not seen revealed:
      // `played` is what the reveal counts against the roster, and a
      // uid left behind here is the shape D55 §8 records ownerUid having.
      ...playedRemovals(snap.get("played"), uid),
      ...stampRemoval(snap.get("pushAt"), uid),
      // …and their role-ledger row (D445): the record of what this room
      // made them, on a document every remaining member reads.
      ...ledgerRemoval(snap.get("ledger"), uid),
    });
    return "left" as const;
  });

  if (outcome === "delete") {
    await db.recursiveDelete(ref); // last member out → group and reveals go
    return { gid, deleted: true };
  }
  return { gid, deleted: false };
});

// ── push token registration ─────────────────────────────────────
//
// Push tokens live at v2_users/{uid}/push/tokens — a SERVER-ONLY
// subdocument, not a field on the profile.
//
// They used to be a `fcmTokens` field on the profile itself, guarded by a
// rules clause that refused client writes. That guard was sufficient
// while the profile was owner-only. It stopped being sufficient at D98,
// which opens the profile to every signed-in user so that a uid can be
// resolved to a name: a readable profile with a token array on it hands
// any script the exact fan-out list the reveal sender uses.
//
// A token is a CREDENTIAL, not an opinion, and D98 publishes opinions.
// Moving it off the readable document is the structural version of that
// distinction — it cannot be un-guarded by a future rule edit, because
// there is no rule granting anyone read on this path at all.
//
// What binds token→uid is unchanged: App Check.
//
// One path, named once: the reveal sender and the dead-token pruner read
// and write the same document, and a second spelling of it is how a
// pruner ends up cleaning a list nobody sends to.
export const pushDocPath = (uid: string): string => `v2_users/${uid}/push/tokens`;
//
// What binds token→uid: App Check. Behind enforcement the caller must be
// the attested app, and inside the real app the only registration token
// obtainable is the device's own. This is attestation, not cryptographic
// possession proof — if that is ever warranted, the shape is a nonce sent
// TO the token that the device echoes back, and this callable is where it
// would live.
//
// The messaging dry-run below rejects tokens that are garbage or foreign
// to this Firebase project. It deliberately fails OPEN on infrastructure
// errors (unavailable, deadline): a flaky FCM must degrade to "token
// accepted unverified", not "nobody can register push".
export const registerPushToken = onCall({ ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const token = request.data?.token;
  const prevRaw = request.data?.prev;
  if (!isPlausibleFcmToken(token)) throw new HttpsError("invalid-argument", "not a registration token");
  // `prev` is the rotated predecessor the client wants dropped. Malformed
  // prev is ignored rather than fatal: its only power is removing an entry
  // from the caller's own list.
  const prev = isPlausibleFcmToken(prevRaw) ? prevRaw : null;
  try {
    await getMessaging().send({ token, data: { kind: "validate" } }, /* dryRun */ true);
  } catch (err) {
    const code = (err as { code?: string }).code || "";
    if (
      code === "messaging/invalid-argument" ||
      code === "messaging/invalid-registration-token" ||
      code === "messaging/registration-token-not-registered"
    ) {
      throw new HttpsError("invalid-argument", "token is not live in this project");
    }
    logger.warn("registerPushToken: dry-run inconclusive, accepting", { code });
  }
  const db = firestore();
  const ref = db.doc(pushDocPath(uid));
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const tokens = nextFcmTokens(snap.exists ? snap.get("fcmTokens") : [], token, prev, 10);
    tx.set(ref, { fcmTokens: tokens }, { merge: true });
  });
  return { ok: true };
});

// ── the one push fan-out ────────────────────────────────────────
//
// BOTH notification classes send through here (D236). This was inline in
// revealGroupDay, and it had accumulated four corrections the hard way:
// token->owners as a LIST so a shared device is pruned everywhere it
// lives, length bounds so a client cannot hand FCM a megabyte, CHUNKING
// rather than the `.slice(0, 64)` that silently unnotified everyone past
// roughly the seventh member, and pruning on only the two TERMINAL error
// codes so a transient failure never evicts a live device.
//
// Copying that for invitations would have meant maintaining all four
// twice — and the copy is always the one that rots. The collection and
// the bounds are pure (pure.ts `fcmFanout`) and tested there; what is
// left here is the I/O.
//
// NEVER THROWS. A notification is the last step of something that has
// already succeeded — a reveal that committed, an invitation that was
// written — so FCM being down must not roll that back or reach the
// caller as a failure.
async function sendPushToUids(
  db: FirebaseFirestore.Firestore,
  uids: readonly string[],
  notification: { title: string; body: string },
  data: Record<string, string>,
  channelId: string,
  where: string,
): Promise<void> {
  try {
    if (!uids.length) return;
    // Paired BY INDEX, not by `s.id`. These are the push subdocuments
    // (D98), so every one of their ids is the literal string "tokens" and
    // the uid is recoverable only from the position getAll preserves.
    const snaps = await db.getAll(...uids.map((uid) => db.doc(pushDocPath(uid))));
    const { owners, malformed } = fcmFanout(
      snaps.map((s, i) => ({ uid: uids[i], tokens: s.exists ? s.get("fcmTokens") : null })),
    );
    for (const uid of malformed) logger.warn(`[${where}] skipping malformed fcmToken on ${uid}`);
    const tokens = [...owners.keys()];
    if (!tokens.length) return;
    // Only the two TERMINAL codes evict. A transient error (unavailable,
    // deadline) must never cost a live device its registration.
    const DEAD = new Set([
      "messaging/registration-token-not-registered",
      "messaging/invalid-registration-token",
    ]);
    const removals = new Map<string, string[]>(); // uid -> dead tokens
    for (const chunk of fcmBatches(tokens)) {
      const res = await getMessaging().sendEachForMulticast({
        tokens: chunk,
        notification,
        data,
        // NAMED, not left to the manifest default. Android 8+ drops a
        // notification posted to a channel that does not exist, and only
        // while the app is BACKGROUNDED — which is exactly when both of
        // these matter. The client creates both channels at registration
        // (src/v2/data/push.ts); the manifest default covers reveals
        // alone, so an invitation with no channelId would post to
        // "reveals" and wear its description.
        android: { notification: { channelId } },
      });
      res.responses.forEach((r, j) => {
        if (r.success || !r.error || !DEAD.has(r.error.code)) return;
        for (const uid of owners.get(chunk[j]) || []) {
          const dead = removals.get(uid) || [];
          dead.push(chunk[j]);
          removals.set(uid, dead);
        }
      });
    }
    await Promise.all([...removals].map(([uid, dead]) =>
      db.doc(pushDocPath(uid))
        .update({ fcmTokens: FieldValue.arrayRemove(...dead) })
        .catch(() => { /* best-effort cleanup */ }),
    ));
  } catch (err) {
    logger.warn(`[v2social] push (${where}) failed:`, err);
  }
}

// ── "your turn" (ROUNDS-PLAN §7.4) ─────────────────────────────
//
// The volley's other half: the answer trigger decides WHO is told inside
// its transaction (turnRecipients, pure.ts — stamped in the same commit
// as the mark) and hands the list here after the commit. One body per
// count, so a partner who ran ahead is told how far: *Leo answered — your
// turn* / *Leo played 4 rounds — your turn*. Channel `turns`, importance
// 3 on the client: a nudge, not a result, and the one control Android
// gives a person is the channel.
//
// Best-effort like every send: never throws, and never before the commit
// it reports on.
export async function notifyTurn(
  db: FirebaseFirestore.Firestore,
  gid: string,
  room: { name: string; mode: "duo" | "group"; who: string },
  recipients: readonly TurnRecipient[],
): Promise<void> {
  if (!recipients.length) return;
  const who = room.who || "Someone";
  const title = room.name || (room.mode === "duo" ? "Your 1v1" : "Your group");
  const byBody = new Map<string, string[]>();
  for (const r of recipients) {
    const body = r.waiting > 1
      ? `${who} played ${r.waiting} rounds — your turn.`
      : `${who} answered — your turn.`;
    byBody.set(body, [...(byBody.get(body) || []), r.uid]);
  }
  for (const [body, uids] of byBody) {
    await sendPushToUids(db, uids, { title, body }, { kind: "turn", gid }, "turns", "turn");
  }
}

// ── the reveal pipeline ─────────────────────────────────────────

export interface RevealVote {
  optionIdx: number;
  guessIdx?: number;
  /**
   * Answered AFTER the round revealed (ROUNDS-PLAN §4) — with the table in
   * view, so not blind. Appended by the answer trigger, never written by
   * revealRound; shown in the reveal, counted by nothing: the roles fold,
   * the runs and the duel signal all skip it. Absent on every blind vote.
   */
  late?: true;
  /**
   * The question THIS member answered — written only when it is not the one
   * the day was published under (see revealQid). Absent is the overwhelming
   * common case and means "the revealed question", which is also what every
   * reveal written before D71 means, so old docs read correctly with no
   * migration.
   *
   * Without it the reveal card had no way to know a member's answer belonged
   * to a different prompt, and rendered it under the day's — an answer with
   * someone's name on it, under a question they were never asked.
   */
  qid?: string;
  /**
   * Who this vote's optionIdx MEANT, on a "pick" day (D224) — the member
   * the answering client's own roster order pointed at. Snapshotted by the
   * client at vote time and validated against membership by the rules,
   * because the index alone is relative to a roster that changes: a
   * join/leave silently remaps every historical pick, and two clients can
   * even hold different rosters on the same day. Absent on non-pick days
   * and on picks from clients older than D224 — readers fall back to the
   * index, they never invent a name.
   */
  pickUid?: string;
}

/** A Timestamp-ish field as millis, or null. Admin Timestamps carry
 *  `toMillis()`; the reveal-day harness hands plain numbers. */
function tsMs(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (raw && typeof (raw as { toMillis?: unknown }).toMillis === "function") {
    const ms = (raw as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/** The update entries that take `uid` out of every array in a `played`
 *  map — one nested-path arrayRemove per round key. Used by leaveGroupV2
 *  and deleteAccount's group phase, which already hold the document. */
export function playedRemovals(played: unknown, uid: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!played || typeof played !== "object") return out;
  for (const key of Object.keys(played as Record<string, unknown>)) {
    if (playedIn(played, key).includes(uid)) out[`played.${key}`] = FieldValue.arrayRemove(uid);
  }
  return out;
}

/**
 * The turn stamp of a member who is leaving or being erased (ROUNDS-PLAN
 * §7.4) — playedRemovals' shape, for its reason: a uid left behind on the
 * group document is the shape D55 §8 records ownerUid having.
 */
export function stampRemoval(pushAt: unknown, uid: string): Record<string, FieldValue> {
  return isStamped(pushAt, uid) ? { [`pushAt.${uid}`]: FieldValue.delete() } : {};
}

/**
 * The role-ledger row of a member who is leaving or being erased (D445,
 * ROLES-PLAN §3.3's erasure clause) — playedRemovals' shape, for its
 * reason. The row is what the room made THIS member, on a document every
 * remaining member reads; a departed uid's row would outlive them there
 * exactly as a stale `memberNames` entry would. On leave as well as on
 * erasure, because every other per-member map on this document goes on
 * both paths, and a rejoin starts the record fresh the way
 * `memberJoinedAt` starts the roster's clock fresh.
 */
export function ledgerRemoval(ledger: unknown, uid: string): Record<string, FieldValue> {
  const has = !!ledger && typeof ledger === "object"
    && Object.prototype.hasOwnProperty.call(ledger as Record<string, unknown>, uid);
  return has ? { [`ledger.${uid}`]: FieldValue.delete() } : {};
}

export interface RevealOpts {
  /** Reveal the open round on any answer at all, deadline or not — the
   *  operator's lever and the e2e. Never the schedule. */
  force?: boolean;
  nowMs?: number;
}

/**
 * Reveal a group's OPEN round if it is ready, and open the next one in
 * the same commit. Returns whether it revealed. ROUNDS-PLAN §3, D426.
 *
 * READY means (roundReveals, pure.ts): at least one answer, and every
 * member has answered, or the deadline has passed, or `force`. The
 * verdict is taken off the page snapshot first — `played` and the clock
 * are on the group document — so a group that is neither complete nor
 * due costs nothing beyond the page it arrived on, and again inside the
 * transaction off the answers themselves, which are the truth.
 *
 * WHAT IS READ, and the cost model counts it (revealReadsPerMember,
 * scripts/cost-arith.mjs): one field-masked profile per member for the
 * names, then the committing transaction's getAll — the reveal, the
 * group, and one answer per member — and then the round's question, for
 * the role ledger (D445): whether the round was a cast or a seated role
 * vote is a fact about the question, and the answers cannot say it.
 * 3 + 2m for m members. The day's pipeline read 4 + 3m: a standalone
 * reveal-exists get and a pre-read of every answer, both of which
 * `played` on the group document makes unnecessary — and the
 * reveal-exists check is redundant anyway, because the reveal and the
 * round advance in one commit, so "the round is still the open one" IS
 * "no reveal exists for it".
 *
 * THE ROLE LEDGER rides the settle update (ROLES-PLAN §3.3): `ledger`
 * on the group document, one row per current member, written whole from
 * this transaction's own read of the group plus the blind votes above
 * (foldRoleLedger, pure.ts). No extra write — the same update that
 * advances the round — and, because the reveal is create-guarded in the
 * same commit, a re-run that finds the reveal standing writes nothing,
 * so the ledger can never count a round twice. A round that moved
 * nothing (a rating, an own round) leaves the field untouched.
 *
 * The transaction re-reads the answers for the reason it always did: a
 * duel answer stays legal until the round advances, so an answer that
 * commits between the page read and this commit either lands in our
 * re-read and is included, or is forced after our commit and refused by
 * the rules (the round has moved on) — never accepted and then dropped.
 *
 * tx.create(), not tx.set(): the schedule, the answer trigger and the
 * operator's lever can overlap on one group, and overwriting would
 * shrink an already-published vote set. The loser's re-read finds the
 * round advanced and bails.
 *
 * The streak moves in the same transaction, keyed on the calendar day
 * the reveal lands: two reveals on one day leave it where it is
 * (movesPresentState), consecutive days advance it (nextStreak), so a
 * streak is still what it was — days you came back — and rounds are not
 * spent on it.
 */
export async function revealRound(
  group: FirebaseFirestore.DocumentSnapshot,
  opts: RevealOpts = {},
): Promise<boolean> {
  const db = firestore();
  const gid = group.id;
  if (!group.exists) return false;
  const mode: string = group.get("mode") || "group";
  const members: string[] = group.get("memberUids") || [];
  if (!members.length) return false;
  const nowMs = opts.nowMs ?? Date.now();
  const force = !!opts.force;
  const round = openRound(group.get("round"));
  const key = roundKey(round);

  const pageDeadline = tsMs(group.get("roundDeadlineAt"));
  const pageDue = pageDeadline != null && pageDeadline <= nowMs;
  // A DUE ROUND ALWAYS OPENS THE TRANSACTION, even when the page snapshot
  // shows nobody in it. `roundReveals` is `played >= 1 && …`, so a round
  // whose only player left or was erased is false here whatever `force`
  // says — and the branch that clears a stuck clock lives INSIDE the
  // transaction this gate was returning before. So the group kept its
  // `roundDeadlineAt`, the deadline scan orders by that field ascending,
  // and a never-moving deadline sorts permanently at the head: at
  // GROUP_SCAN_CAP the run breaks with an error before reaching any live
  // due round, and reveals stop for everybody. Not even
  // revealDuelsNowV2 {force:true} could unstick it.
  //
  // Letting a due round through costs one transaction (and one profile
  // fetch) per stuck group, ONCE — the clock is cleared inside it and the
  // group leaves the scan. A page snapshot that is merely stale is better
  // off in there too: the transaction re-reads.
  if (!pageDue && !roundReveals(playedIn(group.get("played"), key).length, members.length, pageDue, force)) {
    return false;
  }

  const revealRef = group.ref.collection("reveals").doc(key);
  const answerId = `g_${gid}_r${round}`;
  const dayKey = utcDayKeyOf(nowMs);

  // The names, past the gate — only a round that is about to reveal puts
  // profiles in flight. ONE FIELD, and the fieldMask is load-bearing
  // rather than tidy: a profile is client-writable and firestore.rules
  // bounds only some of it (`testResults` by key VOCABULARY since
  // 2026-09-09, which caps the count structurally but not the size of a
  // legitimate kind; the stamps not at
  // all), so a member can legitimately hold a document approaching
  // Firestore's 1 MiB, and LANES × GROUP_CAP of them in flight on the
  // 512 MiB instance is the exposure the mask bounds regardless of what
  // any rule permits.
  const profileSnaps = await db.getAll(
    ...members.map((uid) => db.doc(`v2_users/${uid}`)),
    { fieldMask: ["displayName"] },
  );
  const names: Record<string, string> = {};
  profileSnaps.forEach((s, i) => {
    names[members[i]] = (s.exists && s.get("displayName")) || "";
  });

  let streak = 0;
  let didReveal = false;
  // What the signal fold (below) needs from the committed reveal —
  // captured here because the transaction's own locals die with it.
  let aggQid: string | null = null;
  let aggVotes: DuelVoteLike[] = [];
  // Who the NEXT round waits for once this one is out — the push below
  // says so to them, and nobody else (ROUNDS-PLAN §7.4).
  let waitingNext: string[] = [];
  // The roster the TRANSACTION read, carried out to the push fan-out
  // below — see the hoist inside it. `waitingNext` was already computed
  // from it; `told` was not, and that was the one roster use left on the
  // page's copy.
  let pushRoster: string[] = [];
  await db.runTransaction(async (tx) => {
    // Reset per attempt: a transaction callback can run more than once,
    // and a retry that bails early must not inherit the previous try's
    // verdict (reveal-day.test.ts pins this).
    didReveal = false;
    streak = 0;
    aggQid = null;
    aggVotes = [];
    waitingNext = [];
    pushRoster = [];
    const [existing, gsnap, ...fresh] = await tx.getAll(
      revealRef,
      group.ref,
      ...members.map((uid) => db.doc(`v2_users/${uid}/answers/${answerId}`)),
    );
    if (existing.exists) return;      // lost the race — the standing reveal wins
    if (!gsnap.exists) return;        // last member left while we were reading
    if (openRound(gsnap.get("round")) !== round) return;  // advanced under us

    // qid alongside each vote, not just the winning one: the fold below has
    // to know WHICH votes were cast on the question it is folding into, and
    // the reveal doc has to tell the card which prompt to render each answer
    // under (D70, D71).
    const freshEntries: { uid: string; qid: unknown; vote: RevealVote }[] = [];
    fresh.forEach((s, i) => {
      if (!s.exists) return;
      const optionIdx = s.get("optionIdx");
      if (typeof optionIdx !== "number") return;
      const v: RevealVote = { optionIdx };
      const guessIdx = s.get("guessIdx");
      if (typeof guessIdx === "number") v.guessIdx = guessIdx;
      // The pick-day snapshot (D224) — carried verbatim into the reveal;
      // rules validated it against membership when the answer was written.
      const pickUid = s.get("pickUid");
      if (typeof pickUid === "string" && pickUid) v.pickUid = pickUid;
      freshEntries.push({ uid: members[i], qid: s.get("qid"), vote: v });
    });
    const freshQid = revealQid(freshEntries.map((e) => e.qid));
    // Stamped only on the odd ones out, so the common case — everyone on the
    // same question — writes exactly the document it wrote before D71.
    const freshVotes: Record<string, RevealVote> = revealVotes(freshEntries, freshQid);
    const played = Object.keys(freshVotes).length;
    const freshDeadline = tsMs(gsnap.get("roundDeadlineAt"));
    const freshDue = freshDeadline != null && freshDeadline <= nowMs;
    if (!roundReveals(played, members.length, freshDue, force)) {
      // Due with nothing in it — an answer erased since it stamped the
      // clock. Clear the clock so the scan stops finding this group; the
      // round stays open with its question unburned.
      if (played === 0 && freshDue) {
        tx.update(group.ref, {
          roundOpenedAt: FieldValue.delete(),
          roundDeadlineAt: FieldValue.delete(),
        });
      }
      return;
    }

    // THE ROSTER THE TRANSACTION READ, NOT THE PAGE'S. A member who left
    // between the two reads, or an account erased between them, is on the
    // page and not on the document. This was computed forty lines down for
    // the role ledger alone, with a comment saying exactly why — "a member
    // who left between the two would otherwise get a row written for a uid
    // no longer on the document" — and the same reasoning was never
    // applied to the three other roster uses in this transaction, which is
    // why it is hoisted here now.
    //
    // What the page's roster cost: `leaveGroupV2` and `deleteAccount`
    // phase 1c both scrub `pushAt.{uid}` and `memberNames.{uid}` and take
    // the uid off `members`. A reveal landing in the window after that
    // sweep wrote all of it back — for an ERASED account, a uid re-minted
    // on a live group document after gone means gone, and a notification
    // sent to a group they are no longer in. Measured: a document roster
    // of two against a page roster of three put `pushAt.u3` on the settle
    // update and u3 in the reveal's `members` and `names`, for a member
    // who never answered the round.
    const freshRoster: string[] = Array.isArray(gsnap.get("memberUids")) ? gsnap.get("memberUids") : members;
    // …and out to the push fan-out, which is the one roster use left on
    // the page's copy. NOT the union `revealRoster` below: that exists so
    // an erasure can still reach a published vote, and a departed voter
    // is exactly who must not be notified.
    pushRoster = freshRoster;

    // WHO THE REVEAL SAYS WAS THERE — who was in the group when this round
    // opened, plus anyone who played it — computed once and used twice: as
    // the `members` field, and as the set the `names` map is cut down to,
    // so the reveal never names someone it does not record as present
    // (the erasure sweep walks `members`; a stray name would outlive it).
    // THE UNION, and the union is the point. `revealMembersFor` FILTERS the
    // roster it is given — `playedUids` is a reason to KEEP a uid, never a
    // reason to add one — so handing it the fresh roster alone would drop
    // someone who answered this round and left before the transaction read
    // the group. Their vote is still published below (`freshVotes` is keyed
    // on the page roster, so it has them), and `members` is the index
    // deleteAccount's phase 1c-bis queries by: a voter missing from it is a
    // vote and a name that no erasure can ever reach. The page's roster had
    // the same hole one read earlier; the union closes it for both.
    const revealRoster = [...new Set([...freshRoster, ...Object.keys(freshVotes)])];
    const revealMembers = revealMembersFor(
      revealRoster,
      joinedAtMs(gsnap.get("memberJoinedAt")),
      tsMs(gsnap.get("roundOpenedAt")),
      Object.keys(freshVotes),
    );
    const revealNames: Record<string, string> = {};
    for (const uid of revealMembers) revealNames[uid] = names[uid] ?? "";
    // The people this round's picks name — an index erasure can walk. A
    // pick copies the picked uid into `votes.<voter>.pickUid`, and that uid
    // may be in no array anybody queries if they left before the reveal.
    const pickedUids = [...new Set(
      Object.values(freshVotes)
        .map((v) => v.pickUid)
        .filter((u): u is string => typeof u === "string" && !!u),
    )];

    aggQid = freshQid;
    // NOT Object.values(freshVotes) — only the votes cast on aggQid. When
    // members' cached banks disagree (see revealQid), the others' votes are
    // still published in the reveal below; they are simply not folded into a
    // question they were not answers to.
    aggVotes = votesMatchingQid(freshEntries, aggQid);

    // The round's question — the one billed read the role ledger adds
    // (D445), and a TRANSACTIONAL read placed before the first write, as
    // Firestore requires. What it answers is whether this round was a
    // cast or a seated role vote and, if so, which axis each option names
    // and which seat the role sits in; the answers carry none of that. A
    // question deleted by an operator since the answers were written
    // folds nothing here, as it folds nothing into the signal below.
    const qSnap = freshQid ? await tx.get(db.collection("v2_questions").doc(freshQid)) : null;
    const nextLedger = foldRoleLedger(
      gsnap.get("ledger"),
      mode,
      qSnap && qSnap.exists
        ? { topic: qSnap.get("topic"), role: qSnap.get("role"), dims: qSnap.get("dims") }
        : null,
      freshQid,
      freshVotes,
      freshRoster,
    );

    tx.create(revealRef, {
      round,
      // The calendar day the reveal landed — what the card labels a
      // reveal by, what the streak is keyed on, and what orders two
      // reveals from one day beside `round`.
      day: dayKey,
      qid: freshQid,
      votes: freshVotes,
      names: revealNames,
      members: revealMembers,
      ...(pickedUids.length ? { pickedUids } : {}),
      revealedAt: FieldValue.serverTimestamp(),
    });

    // Settle: the next round opens in the SAME commit as this reveal, so
    // "the round is still open" and "no reveal exists for it" can never
    // drift apart — which is also what lets the rules bound an answer by
    // the round number alone (ROUNDS-PLAN §2.2).
    const next = round + 1;
    const nextPlayed = prunePlayed(gsnap.get("played"), next);
    const settle: Record<string, unknown> = { round: next, played: nextPlayed };
    // The role ledger, whole, only when this round moved it — see the
    // header. Whole rather than per-field increments: the map was read in
    // this transaction, so the write is exactly "what the group document
    // held plus this round", and a member leaving in between contends on
    // the same document and retries us.
    if (nextLedger) settle.ledger = nextLedger;
    // THE REVEAL IS THE CARRIER (ROUNDS-PLAN §7.4): opening the next round
    // is this same commit, so the push that says the round is out can say
    // "and round 8 is waiting for you" to whoever has not sealed it — and
    // STAMPS them, so the first answer to round 8 is not followed by "Bo
    // answered — your turn" about the same round. Their own answer clears
    // the stamp (v2.ts). Members who ran ahead are told the result alone.
    const sealedNext = playedIn(nextPlayed, roundKey(next));
    waitingNext = freshRoster.filter((u) => !sealedNext.includes(u));
    for (const u of waitingNext) settle[`pushAt.${u}`] = FieldValue.serverTimestamp();
    if (playedIn(nextPlayed, roundKey(next)).length) {
      // Somebody ran ahead: the next round already has an answer, so its
      // clock starts now rather than waiting for one.
      settle.roundOpenedAt = Timestamp.fromMillis(nowMs);
      settle.roundDeadlineAt = Timestamp.fromMillis(nowMs + ROUND_DEADLINE_MS);
    } else {
      settle.roundOpenedAt = FieldValue.delete();
      settle.roundDeadlineAt = FieldValue.delete();
    }
    // `streak` and `lastRevealDay` are the group's PRESENT tense, and only a
    // day newer than the last reveal's may move them: the second reveal of
    // a day leaves them alone (movesPresentState, pure.ts).
    if (movesPresentState(gsnap.get("lastRevealDay"), dayKey)) {
      streak = nextStreak(gsnap.get("lastRevealDay"), dayKey, gsnap.get("streak") || 0);
      settle.streak = streak;
      settle.lastRevealDay = dayKey;
    } else {
      // Left where it was, not recomputed — the reveal above still published.
      streak = gsnap.get("streak") || 0;
    }
    tx.update(group.ref, settle);
    didReveal = true;
  });
  if (!didReveal) return false;

  // The duel question-level signal (D40 part 3): fold this reveal into the
  // cross-group aggregate. OUTSIDE the reveal transaction on purpose — the
  // aggregate doc is contended across every group revealing the same
  // question, and a conflict there must retry this small fold, never the
  // reveal (whose retry re-reads a document per member). The cost of the
  // split, recorded: a crash between the reveal commit and this fold
  // undercounts an advisory, floored aggregate by one reveal — the round
  // has advanced, so nothing retries it, and the loss is permanent and
  // accepted. ERROR-level so monitoring sees a systematic failure.
  try {
    await foldDuelSignal(db, mode, aggQid, aggVotes);
  } catch (err) {
    logger.error(`[duel-signal] fold failed for ${gid}/${key} (${aggQid}):`, err);
  }

  // The reveal is out — one of the product's five notifications: this,
  // *your turn* (notifyTurn, above), the group invitation, the join
  // request and the join approval. Two bodies, one send each: whoever
  // the next round waits for is told so here rather than nudged again
  // by its first answer (the stamp above), and whoever ran ahead is told
  // the result alone. Best-effort by construction: sendPushToUids never
  // throws, so FCM being down can never roll back a reveal that already
  // committed.
  const title = group.get("name") || (mode === "duo" ? "Your 1v1" : "Your group");
  const out = mode === "duo" ? "Your answers are out" : `Round ${round} is out`;
  const waiting = new Set(waitingNext);
  // THE TRANSACTION'S ROSTER HERE TOO, and this was the last use reading
  // the page's. The hoist inside the transaction names the cost of the
  // page roster in as many words — "a notification sent to a group they
  // are no longer in" — and then closed it for the ledger, the reveal's
  // `members`, the names and the next-round stamp, while the push that
  // says the round is out went on being addressed from the stale list. A
  // member who left in the window between the two reads is absent from
  // `waitingNext` precisely BECAUSE they are off the document, so the
  // filter below put them in `told`: the one list a departure moved them
  // INTO. (An erased account's token doc is gone, so that arm was inert;
  // a member who merely left still has tokens.)
  const told = (pushRoster.length ? pushRoster : members).filter((u) => !waiting.has(u));
  await sendPushToUids(
    db,
    waitingNext,
    { title, body: `${out} — and round ${round + 1} is waiting for you.` },
    { kind: "reveal", gid, round: String(round) },
    "reveals",
    "reveal",
  );
  await sendPushToUids(
    db,
    told,
    { title, body: mode === "duo" ? `${out} — see if you called it.` : `${out} — see who said what.` },
    { kind: "reveal", gid, round: String(round) },
    "reveals",
    "reveal",
  );
  return true;
}

/**
 * Reveal every round of this group that is ready, one after another —
 * a pair that ran ahead can have the next round complete the moment this
 * one opens, and nothing else would ever ask about it (no further answer
 * is coming; the deadline is a day away). Bounded by the lead: at most
 * ROUND_LEAD + 1 rounds can be sealed at once. Reads the group fresh
 * between passes; `first` is the page snapshot a scan already holds.
 */
export async function revealDueRounds(
  ref: FirebaseFirestore.DocumentReference,
  opts: RevealOpts = {},
  first?: FirebaseFirestore.DocumentSnapshot,
): Promise<number> {
  let n = 0;
  let snap = first ?? await ref.get();
  for (let i = 0; i <= ROUND_LEAD; i++) {
    if (!snap.exists) break;
    if (!(await revealRound(snap, opts))) break;
    n++;
    snap = await ref.get();
  }
  return n;
}

// Which groups a run looks at is runDuelReveals's own note below: the
// schedule's "indexed" query is an indexed range on `roundDeadlineAt`,
// and "full" walks every group. The `pendingDays` marker the day's scan
// queried — and the at-least-once argument for why the full scan had to
// exist beside it — went with the day (ROUNDS-PLAN / D426): a due round
// stays due until it reveals, so a mark that lands late or a run that
// dies is caught by the next run without anybody naming a day.

// The duel signal's fold (D40 part 3). One small transaction per revealed
// ROUND: read the running private state and the question doc — two
// reads; the option count bounds count folding, and a `pick` question
// (options []) publishes plays/total only, because its optionIdx values
// index each group's OWN member list and are meaningless summed across
// groups. Fold and rewrite the public mirror on every fold (D98 — no
// floor, no cadence). Ids are namespaced `duel-<qid>` in
// v2_question_aggs, the signed-in-readable exact mirror — which the
// scorecard's --fetch already pages in full, so duels score with no new
// read path. The doc carries no timestamp, matching the vote mirror's
// rule: a fresh timestamp would date-stamp which scan window a group
// revealed in.
//
// ONE DOCUMENT SINCE D290. This used to fold onto a private copy in
// `v2_aggs_private/duel-<qid>` and publish a projection of it. The
// projection is `publishableDuelAgg`, which omits an empty `counts` map
// and zero guess counters — absent keys rather than zeroes, so a pick
// question's doc never grows fields that invite reading meaning into
// them. That makes it LOSSY in shape and not in value: every key it drops
// is one `foldDuelAgg` already reconstructs as its default, because that
// function was written to tolerate an absent or malformed prior doc (the
// first reveal of a question creates it). So the published document is a
// sufficient accumulator and the private one was a duplicate.
//
// pure.test.ts pins exactly that — folding a delta onto
// `publishableDuelAgg(state)` equals folding it onto `state` — because it
// is the single property this collapse rests on. The edit that would
// break it is not another omission (dropping a key whose default is the
// right prior stays safe, and that was measured rather than assumed) but
// a projection that TRIMS a value: publish only the top counts entry, the
// way `canonTopN` trims a catalog board, and duel aggregates start losing
// options at every reveal with every other test still green. That is also
// the line between this arm and the catalog one — drops defaults versus
// drops data.
export async function foldDuelSignal(
  db: FirebaseFirestore.Firestore,
  mode: string,
  qid: string | null,
  votes: DuelVoteLike[],
): Promise<void> {
  if (!qid || !votes.length) return;
  const pubRef = db.collection("v2_question_aggs").doc(`duel-${qid}`);
  const qRef = db.collection("v2_questions").doc(qid);
  await db.runTransaction(async (tx) => {
    const [aggSnap, qSnap] = await tx.getAll(pubRef, qRef);
    // Rules admit a duel answer only against a bank qid, so a missing
    // question doc means an operator deleted it since — skip rather than
    // mint an aggregate keyed by a ghost.
    if (!qSnap.exists) return;
    const options = qSnap.get("options");
    const delta = duelAggDelta(votes, mode, Array.isArray(options) ? options.length : 0);
    const prev = aggSnap.exists ? aggSnap.data() : undefined;
    const next = foldDuelAgg(prev, delta);
    tx.set(pubRef, publishableDuelAgg(next));
  });
}

type ScanMode = "indexed" | "full";

/**
 * The reveal scan — the deadline's executor (ROUNDS-PLAN §3.2).
 *
 * "indexed" asks Firestore for exactly the groups whose open round is
 * DUE — `roundDeadlineAt <= now`, an indexed range — and is what the
 * schedule runs. It finds nothing for a 1v1 that revealed on its second
 * answer, nothing for a group nobody has played, and nothing for a group
 * still inside its day: only rounds the deadline has to close. That is
 * the whole cost story of the scan under rounds — the "scanned but
 * revealed nothing" reads that dominated the day's duo shape are gone.
 *
 * "full" walks every group and reveals whatever is ready — complete, due,
 * or, with `force`, anything with an answer in it. The operator's
 * recovery lever, and the e2e's way to reveal without waiting a day.
 *
 * No composite index is declared for the indexed query, on the
 * understanding that Firestore's automatic single-field index on
 * `roundDeadlineAt` serves a range on it ordered by itself and then by
 * `__name__`. The emulator creates whatever a query asks for, so a green
 * test says nothing about production; if the assumption is wrong the
 * scheduled run throws FAILED_PRECONDITION carrying a console link to the
 * index it wants, and the full scan still works meanwhile.
 */
async function runDuelReveals(
  mode: ScanMode = "indexed",
  force = false,
): Promise<{ revealed: number; scanned: number; mode: ScanMode; day: string }> {
  const db = firestore();
  const nowMs = Date.now();
  // Lanes: 5, not 10. Each reveal can fan out to a group's whole token
  // set; more lanes buys throughput this does not need and multiplies peak
  // memory and messaging concurrency.
  const LANES = 5;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let revealed = 0;
  let scanned = 0;

  for (;;) {
    let q = mode === "indexed"
      ? db.collection("v2_groups")
        .where("roundDeadlineAt", "<=", Timestamp.fromMillis(nowMs))
        .orderBy("roundDeadlineAt").orderBy("__name__").limit(PAGE_SIZE)
      : db.collection("v2_groups").orderBy("__name__").limit(PAGE_SIZE);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.get();
    if (page.empty) break;

    const docs = page.docs;
    for (let i = 0; i < docs.length; i += LANES) {
      const lane = docs.slice(i, i + LANES);
      const results = await Promise.all(lane.map(async (g): Promise<number> => {
        try {
          return await revealDueRounds(g.ref, { force, nowMs }, g);
        } catch (err) {
          // One group's failure must not strand the rest of the scan.
          logger.error(`[v2social] reveal failed for ${g.id}:`, err);
          return 0;
        }
      }));
      revealed += results.reduce((a, b) => a + b, 0);
    }

    scanned += page.size;
    if (page.size < PAGE_SIZE) break;
    cursor = docs[docs.length - 1];

    // The tripwire bounds the whole run, so "I have outgrown this" still
    // gets said rather than quietly becoming a multi-minute job. In
    // "indexed" it counts groups whose round is DUE — a real statement
    // about activity, and the remedy below is the one that is left.
    if (scanned >= GROUP_SCAN_CAP) {
      logger.error(
        `[v2social] scanned ${scanned} groups in one ${mode} run ` +
          `(ceiling ${GROUP_SCAN_CAP}), stopping. Groups beyond this are NOT ` +
          "checked this run; their reveals land on a later run at best. " +
          "Time to shard the scan by deadline or move it to a queue.",
      );
      break;
    }
  }

  // The heartbeat, and the only evidence the scheduled scan ran at all.
  //
  // Structured fields as well as the message: the message is what a human
  // greps, the fields are what a log-based metric selects on.
  // monitoring/scheduledDuelReveals-silent.json alerts on the ABSENCE of
  // this line, filtered on `mode: "indexed"` — the schedule's mode — so an
  // operator running the lever (which defaults to "full") during an
  // incident does not reset the absence timer for the outage they are
  // working on. `day` stays on the record for the filter that reads it.
  const day = utcDayKeyOf(nowMs);
  logger.info(
    `[v2social] reveals (${mode}${force ? ", forced" : ""}): ${revealed} of ${scanned} scanned`,
    { metric: "duel_reveal_run", day, mode, revealed, scanned },
  );
  return { revealed, scanned, mode, day };
}

export const scheduledDuelReveals = onSchedule(
  // The deadline's executor: a due round reveals within two hours of its
  // deadline. Every 1v1 that completes, and every group that completes,
  // reveals on the completing answer instead (the trigger, v2.ts) and is
  // never this scan's to find.
  { schedule: "every 120 minutes", region: REGION },
  async () => {
    await runDuelReveals("indexed");
  },
);

// Test/ops hook — emulator, or the SEED_ADMIN_UIDS operators.
//
// NO enforceAppCheck, unlike the four member callables above: this is the
// scheduled scan's manual lever, reached from a console during an incident
// (docs/DEPLOYMENT.md → rollback) and by the e2e. Neither caller can
// attest, and a control that fails when it is most needed is not a control.
// assertOperator + SEED_ADMIN_UIDS gates it; `npm run check:appcheck` holds
// the exemption so it cannot spread by copy-paste.
//
// Defaults to the FULL scan, deliberately: see the ScanMode note above.
// Pass scan:"indexed" to exercise the path the schedule takes, and
// force:true to reveal every open round that has an answer in it, deadline
// or not — the incident lever, and how the e2e reveals without a day's wait.
export const revealDuelsNowV2 = onCall({ region: REGION }, async (request) => {
  assertOperator(request);
  const mode: ScanMode = request.data?.scan === "indexed" ? "indexed" : "full";
  const force = request.data?.force === true;
  return runDuelReveals(mode, force);
});

// ── handles and invitations (D122) ──────────────────────────────────
//
// The four callables below replace the invite CODE as the way a circle
// gains a member. The code stays — a share link is still the only way to
// reach someone who has no account yet — but it stops being something a
// person types, and joinGroupV2 stops being the only door.
//
// WHY THESE ARE CALLABLES AND NOT RULES. Both halves need a write that a
// client cannot be trusted to make:
//
//   · A handle claim is TWO writes that must not interleave — take the
//     new key, release the old one — and rules cannot express "atomic
//     across two documents". A create-if-absent rule gets uniqueness
//     right and renames wrong, which is worse than not having renames.
//   · Accepting an invite appends to `memberUids`, and that array is what
//     firestore.rules reads to decide who may see a group's sealed duel
//     answers. A client-writable membership array is a client-writable
//     ACL.

/** How many invitations one account may send per hour. */
const INVITES_PER_HOUR = 40;

/**
 * Claim this account's handle. ONCE — there is no rename (D190).
 *
 * `v2_handles/{handle}` is the registry: one document per taken handle,
 * holding the uid. Uniqueness is the DOCUMENT ID, not a field — a
 * transaction that creates it fails if someone else got there first, and
 * no query or index is involved.
 *
 * WHY THE RENAME WENT. It worked, and that was the problem: taking the new
 * key and releasing the old one in one transaction is correct as a
 * transaction and wrong as a rule. A handle is the ADDRESS a person hands
 * out — "add me, I'm @olaf" — and D122 made it the primary way into a
 * circle. Releasing it puts that address back in the pool for anyone to
 * take, so an invitation typed a day later can reach a stranger, and the
 * account that answered to it now answers to nothing. An address that can
 * be reassigned is one nobody can be given.
 *
 * The two costs are real and are accepted: a typo is permanent, and there
 * is no way back from a name you have outgrown. Which is why the claim
 * moved to the first-run screen (LiveProfileSetup, D190), where it is a
 * decision made deliberately rather than a control found in a settings
 * panel — and why every surface that offers it says "once" before the tap.
 *
 * Re-claiming the SAME handle stays a no-op: a retry after a dropped
 * response must not be an error, and it changes nothing.
 */
export const claimHandleV2 = onCall({ ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const handle = normalizeHandle(request.data?.handle);
  if (!handle) throw new HttpsError("invalid-argument", "handle must be 3-20 chars: letters, digits, underscore");
  const db = firestore();
  const ref = db.collection("v2_handles").doc(handle);
  const userRef = db.doc(`v2_users/${uid}`);
  // The directory row (D239), written in the same transaction. It has to
  // be here rather than left to the client because `handle` is immutable
  // to the client on that document, the same way it is on the profile —
  // and because a handle that is claimed but missing from the directory
  // is an account findable by name and not by the address it just took.
  const peopleRef = db.doc(`v2_people/${uid}`);
  await db.runTransaction(async (tx) => {
    const [snap, me] = await Promise.all([tx.get(ref), tx.get(userRef)]);
    const prev = me.exists ? (me.get("handle") as string | undefined) : undefined;
    // The claim-once rule, checked BEFORE the registry: an account that
    // already answers to a handle gets a refusal, not a second one. The
    // old release (`tx.delete` of `prev`) is gone with it — with no rename
    // there is nothing to free, and a delete left in would be the one path
    // able to orphan an address.
    if (prev && prev !== handle) {
      throw new HttpsError("failed-precondition", "a handle can't be changed once it is claimed");
    }
    // MERGE, and name/nameKey only when the profile already has one:
    // most accounts claim a handle on the setup screen after saving a
    // name, but the order is not guaranteed and a directory row whose
    // `name` is "" would be found by an empty prefix — that is, by
    // everything. The client's own write fills it in either way.
    const myName = String(me.exists ? (me.get("displayName") || "") : "").trim();
    // nameKey folds A-Z ONLY, matching `firestore.rules`' `nameKey ==
    // name.lower()` — the rules engine's `.lower()` is ASCII-only while
    // JS `toLowerCase()` is full Unicode, so a name carrying a non-ASCII
    // capital written the JS way disagrees with the rule. The admin SDK
    // is not bound by rules, so THIS write would have succeeded and then
    // disagreed with the client's own row for the same account — which
    // is worse than being refused. Keep this identical to `foldName` in
    // src/v2/data/socialFetch.ts; the two cannot share a module across
    // the package boundary, so they are kept honest by this comment and
    // by the rule that judges both.
    const nameKey = myName.replace(/[A-Z]/g, (c) => c.toLowerCase());
    const writeRow = () => tx.set(peopleRef, myName
      ? { handle, name: myName, nameKey }
      : { handle }, { merge: true });
    if (snap.exists) {
      // Re-claiming your own handle is a no-op rather than an error: the
      // client retries on a dropped response, and a retry that reports
      // "taken" about your own name is the worst possible message.
      // …and it REPAIRS the directory row on the way out. It used to
      // return here, one statement short of the write below, and D440's
      // `allow delete` made that reachable rather than theoretical: the
      // owner may delete their own row, `writeDirectoryRow` does exactly
      // that when a display name is cleared, and the client cannot put
      // the handle back — `handle` is immutable to it on that document
      // (the ternary in firestore.rules). So clearing a name and setting
      // one again left the end state this file's own rules comment calls
      // wrong: "an account findable by name and not by the address it
      // just took", with nothing in the system able to fix it. The write
      // is idempotent and already inside this transaction.
      if (snap.get("uid") === uid) { writeRow(); return; }
      throw new HttpsError("already-exists", "that handle is taken");
    }
    tx.set(ref, { uid, at: FieldValue.serverTimestamp() });
    tx.set(userRef, { handle }, { merge: true });
    writeRow();
  });
  return { handle };
});

/**
 * Invite an account to a circle, by uid.
 *
 * ANYONE MAY INVITE ANYONE (owner's call). That is a deliberate opening
 * and it is worth stating what it does and does not expose: an invite
 * carries the inviter's handle and the circle's name to someone who did
 * not ask for either. It grants nothing — the invitee is not a member
 * until they accept — and it reveals nothing about them to the inviter
 * that D98 had not already published. The rate limit below is the whole
 * defence against volume, and `hidden` on the invite is the recipient's.
 *
 * SINCE D236 IT ALSO NOTIFIES, and that changes what the opening costs.
 * An invitation used to sit in an inbox until the invitee happened to
 * open the app; now it interrupts them. Declining still deletes the doc
 * and still tells the inviter nothing, so a declined invitation can be
 * re-sent and will ping again. INVITES_PER_HOUR — which since D236
 * charges per RECIPIENT rather than per call — remains the whole defence,
 * and a block is still the answer if invite spam becomes real. It is
 * still not built here.
 */
export const inviteToGroupV2 = onCall({ ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const gid = String(request.data?.gid || "");
  if (!gid) throw new HttpsError("invalid-argument", "gid and to required");

  // ONE OR MANY (D236). `to` was a single uid. The picker sends a whole
  // selection, and looping on the client would have been N round trips
  // against a budget that counts CALLS — so the batch is the shape the
  // budget sees, and it charges N.
  //
  // A SINGLE target keeps D122's exact error codes, because LdAddByHandle
  // turns them into sentences a person reads ("@mira is already here").
  // A batch cannot do that: one unreachable name must not cost the other
  // seven their invitation, so a batch skips and reports instead.
  const rawTo = request.data?.to;
  // A target is concatenated into `v2_users/${t}` for the getAll below and
  // used verbatim as an invite document id, so a "/" — or a "." or ".."
  // segment — is a PATH INJECTION rather than a bad uid. `pure.ts`'s
  // `roomQids` already refuses exactly this for exactly this reason ("a bad
  // one here would be a path injection into a getAll, so it is refused
  // rather than escaped"); this door was the same shape without the check.
  //
  // What it did before: an odd component count made firebase-admin throw
  // out of `db.doc()`, uncaught, so the caller got a bare INTERNAL — and an
  // EVEN one resolved, so `v2_users/vic/answers/daily-000` was a real
  // document read, and the invite was written at a document id containing
  // slashes. Refused at construction, not escaped.
  //
  // BEFORE the budget, deliberately: `assertInviteBudget` writes the hourly
  // event rather than reading it, so a malformed batch used to charge the
  // cap on its way to a crash.
  const pathSafe = (t: string) => !!t && t.length <= 128 && !t.includes("/") && t !== "." && t !== "..";
  const all = [...new Set(
    (Array.isArray(rawTo) ? rawTo : [rawTo]).map((t) => String(t || "")).filter(Boolean),
  )];
  const targets = all.filter(pathSafe);
  const malformed = all.filter((t) => !pathSafe(t));
  if (!targets.length) throw new HttpsError("invalid-argument", "gid and to required");
  const single = targets.length === 1;
  const refuse = (code: "invalid-argument" | "not-found" | "already-exists", msg: string) => {
    if (single) throw new HttpsError(code, msg);
  };

  const db = firestore();
  const gref = db.doc(`v2_groups/${gid}`);
  const gsnap = await gref.get();
  if (!gsnap.exists) throw new HttpsError("not-found", "no such circle");
  const members: string[] = gsnap.get("memberUids") || [];
  // Members only. An invite from a non-member would let anyone add anyone
  // to any circle they can name the id of.
  if (!members.includes(uid)) throw new HttpsError("permission-denied", "not a member");
  const mode = gsnap.get("mode") === "duo" ? "duo" : "group";
  const cap = mode === "duo" ? 2 : GROUP_CAP;
  // SEATS, not merely "is it full". An invitation consumes no seat until
  // it is accepted, but a batch bigger than the room is either a mistake
  // or a way to turn one call into forty notifications — and for a duo,
  // which has exactly one seat, it is the difference between inviting a
  // partner and paging a crowd.
  const seats = cap - members.length;
  if (seats <= 0) throw new HttpsError("resource-exhausted", "circle is full");
  if (targets.length > seats) {
    throw new HttpsError("invalid-argument", `only ${seats} ${seats === 1 ? "seat" : "seats"} left`);
  }

  // The budget charges what the call actually costs. Counting a batch as
  // one event would have made INVITES_PER_HOUR meaningless the moment a
  // picker shipped.
  await assertInviteBudget(uid, targets.length);

  // The invitee must exist. Without this a typo'd uid writes an invite
  // nobody will ever see and the sender is told it worked.
  const targetSnaps = await db.getAll(...targets.map((t) => db.doc(`v2_users/${t}`)));
  const invited: string[] = [];
  // Seeded with the malformed ones so a mixed batch reports honestly
  // instead of silently dropping them — the batch contract above is skip
  // AND report, not skip.
  const skipped: string[] = [...malformed];
  targets.forEach((t, i) => {
    if (t === uid) { refuse("invalid-argument", "you are already here"); skipped.push(t); return; }
    if (members.includes(t)) { refuse("already-exists", "already a member"); skipped.push(t); return; }
    if (!targetSnaps[i].exists) { refuse("not-found", "no such account"); skipped.push(t); return; }
    invited.push(t);
  });
  if (!invited.length) return { ok: true, invited, skipped };

  const fromName = await callerName(uid, request.data?.displayName);
  const groupName = gsnap.get("name") || "";
  const batch = db.batch();
  for (const to of invited) {
    batch.set(gref.collection("invites").doc(to), {
      // `to` is denormalised onto the doc because a collection-group query
      // cannot filter on a document id — the same reason the follow graph
      // carries it (data/circle.ts fetchFollowersOf).
      to,
      from: uid,
      fromName,
      // The circle's NAME rides along so the invitee can read the invite
      // without reading the group: v2_groups is member-gated because it
      // carries inviteCode, and an invitee is by definition not a member yet.
      groupName,
      mode,
      at: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await batch.commit();

  // THE POINT OF D236. The invitation used to land silently and wait for
  // the invitee to open the app on their own — which is what made a system
  // with consent, an inbox and a registry still feel like being handed a
  // code. The notification IS the delivery.
  //
  // Tied to being PICKED, never to a circle being created: a notification
  // on creation would carry the circle's name to people who were not
  // invited, which is the read v2_groups' member gate exists to refuse.
  //
  // Sent after the commit, so a push can never announce an invitation
  // that failed to write.
  const who = fromName || "Someone";
  await sendPushToUids(
    db,
    invited,
    {
      title: groupName || "InSight",
      body: mode === "duo" ? `${who} wants to play with you.` : `${who} invited you to join.`,
    },
    { kind: "invite", gid, mode },
    "invites",
    "invite",
  );
  return { ok: true, invited, skipped };
});

// CHARGES N, not one per call (D236). A batch invitation is N
// notifications to N people, so counting it as a single event would have
// made this cap meaningless the moment a picker shipped: one call, forty
// pings. For count = 1 the arithmetic is identical to what D122 shipped.
async function assertInviteBudget(uid: string, count = 1): Promise<void> {
  const db = firestore();
  const ref = db.collection("v2_ratelimits").doc(`invite_${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = Date.now();
    const cutoff = now - 3600000;
    const events: number[] = ((snap.exists && snap.get("events")) || [])
      .filter((t: number) => t > cutoff);
    if (events.length + count > INVITES_PER_HOUR) {
      throw new HttpsError("resource-exhausted", "too many invitations — try later");
    }
    for (let i = 0; i < count; i++) events.push(now);
    tx.set(ref, { events, expireAt: new Date(now + 2 * 3600000) });
  });
}

/**
 * Accept an invitation — the only client-reachable path into memberUids
 * besides the code.
 */
export const acceptGroupInviteV2 = onCall({ ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const gid = String(request.data?.gid || "");
  if (!gid) throw new HttpsError("invalid-argument", "gid required");
  await assertMembershipCap(uid);
  const db = firestore();
  const gref = db.doc(`v2_groups/${gid}`);
  const iref = gref.collection("invites").doc(uid);
  const myName = await callerName(uid, request.data?.displayName);
  const out = await db.runTransaction(async (tx) => {
    const [gsnap, isnap] = await Promise.all([tx.get(gref), tx.get(iref)]);
    // The invite is the authorisation. Without this check the callable is
    // "join any circle by id" with extra steps.
    if (!isnap.exists) throw new HttpsError("permission-denied", "no invitation");
    if (!gsnap.exists) throw new HttpsError("not-found", "no such circle");
    const members: string[] = gsnap.get("memberUids") || [];
    // The ask and the invitation can both be outstanding for the same
    // person: inviteToGroupV2 skips a target who is already a MEMBER and
    // says nothing about one who is already waiting — correctly, since
    // inviting someone who asked is how a member says yes from the picker
    // instead of from the queue. So both branches below clear the queue,
    // the way requestJoinImpl's admit() does for the opposite order.
    // Without it the circle draws "wants to join" about somebody in its
    // own member list, and approveJoinV2's early return means the row
    // cannot be cleared by the button it is drawn under.
    const leaveQueue = {
      pending: FieldValue.arrayRemove(uid),
      [`pendingNames.${uid}`]: FieldValue.delete(),
    };
    if (members.includes(uid)) {
      tx.update(gref, leaveQueue);
      tx.delete(iref);
      return { gid, name: gsnap.get("name") };
    }
    const cap = gsnap.get("mode") === "duo" ? 2 : GROUP_CAP;
    // Checked INSIDE the transaction: two people accepting the last seat
    // of a duo at once is the one race this callable can actually lose.
    if (members.length >= cap) throw new HttpsError("resource-exhausted", "circle is full");
    tx.update(gref, {
      memberUids: FieldValue.arrayUnion(uid),
      [`memberNames.${uid}`]: myName,
      // Set on accept, not on invite: the days before you accepted are
      // days you were not in the circle, and revealMembersFor scopes a
      // reveal to the people who were in it that day.
      [`memberJoinedAt.${uid}`]: FieldValue.serverTimestamp(),
      ...leaveQueue,
    });
    tx.delete(iref);
    return { gid, name: gsnap.get("name") };
  });
  return out;
});

/**
 * Decline — and it is a plain delete, with nothing written back.
 *
 * The inviter is told nothing. A "declined" state would make refusing
 * someone a message you have to send them, which is the thing that makes
 * people accept invitations they do not want.
 */
export const declineGroupInviteV2 = onCall({ ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const gid = String(request.data?.gid || "");
  if (!gid) throw new HttpsError("invalid-argument", "gid required");
  const db = firestore();
  await db.doc(`v2_groups/${gid}`).collection("invites").doc(request.auth.uid).delete();
  return { ok: true };
});

// ── Near by radius: the presence count (D84) ────────────────────────
//
// The one read path for presence, and deliberately the only one: presence
// docs are `allow read: if false` to every client, because a readable
// (uid → cell) pair is the D2 leak again — a script could follow any uid
// around town at cell resolution. What the world may know is a NUMBER:
// how many opted-in phones whose position has not yet expired sit in the
// caller's cell or one of its eight neighbors —
// excluding the caller themself, so "just you here" reads as 0 rather
// than a phantom 1.
//
// The count is exact (D98 — there is no floor left to apply). It used to
// return `tooFew` under AGG_MIN_N; nothing does now, and the client's
// "a few people" branch goes with it.
/**
 * When a presence document stops counting (D179's compatibility arm).
 *
 * `until` has been required since D174, but rules deploy on merge while the
 * app reaches phones through a store review — so for one release the wild
 * still contains a build that writes `{cell, at}` and nothing else. A
 * document without `until` is read as `at` + the linger, which is exactly
 * what the pre-D174 freshness window meant, so a legacy phone counts and is
 * counted rather than silently vanishing.
 *
 * Returns 0 for a document that is missing, malformed or genuinely expired
 * — one number for "not here", so no caller has to know which.
 */
function presenceExpiry(doc: FirebaseFirestore.DocumentSnapshot): number {
  if (!doc.exists) return 0;
  const until = doc.get("until") as Timestamp | undefined;
  if (until?.toMillis) return until.toMillis();
  const at = doc.get("at") as Timestamp | undefined;
  return at?.toMillis ? at.toMillis() + PRESENCE_LINGER_MIN * 60_000 : 0;
}

export const nearbyCountV2 = onCall({ ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const cell = request.data?.cell;
  if (!presenceCellOk(cell)) throw new HttpsError("invalid-argument", "cell must be a la_lo grid id");
  const db = firestore();
  const cells = presenceNeighbors(cell as string);
  // COUNTED BY `until`, NOT BY AGE (D174). Each doc carries the moment its
  // position stops counting, and the client is what sets it: the linger
  // for "always", the session deadline for the timed option. Filtering on
  // age instead would make the timed option approximate — a phone that
  // went into a pocket ten minutes before its deadline would keep standing
  // for a further linger, which is precisely the promise the option makes.
  //
  // The rules cap `until` at PRESENCE_LINGER_MIN past write time, so a
  // client cannot grant itself a longer stay than the design allows.
  //
  // A bare `void PRESENCE_LINGER_MIN;` stood here under a comment saying
  // it kept the two definitions in one place. It kept nothing — the
  // statement is a no-op, the import is used in `presenceExpiry` above,
  // and moving the constant left every suite green. What holds them
  // together now is `presence-linger.test.ts`, which reads the ceiling
  // out of firestore.rules and asserts it equals the constant.
  const now = Timestamp.fromMillis(Date.now());
  // COUNTED, NOT FETCHED. This used to `.get()` the neighborhood and take
  // `snap.docs.length`, which materialises — and pays a billed read for —
  // every presence document in 6-9 cells purely to arrive at an integer.
  // Firestore bills an aggregation at roughly one read per 1,000 index
  // entries scanned, so a crowded neighborhood costs ~1 read instead of
  // one per person, and the cost stops being linear in local density.
  //
  // That linearity was the problem, not the absolute number: every client
  // with Near on beats this callable every PRESENCE_BEAT_MS (4 minutes),
  // so a dense cell charged (people nearby) x (beats) — the same quantity
  // twice, which is quadratic in exactly the situation the feature is for.
  // A festival is the worst case and the one it is built to serve.
  //
  // No limit() is needed now and one would be wrong: an aggregation's cost
  // is already sub-linear, and capping it would silently under-report the
  // crowd rather than bound anything worth bounding.
  const agg = await db.collection("v2_presence")
    .where("cell", "in", cells)
    .where("until", ">", now)
    .count()
    .get();
  const total = agg.data().count;
  // Self-exclusion, still exact. The count above cannot filter, so the
  // caller's own row is looked up directly: one read rather than the whole
  // neighborhood. In the app's own flow this is always a hit — runBeat
  // writes `v2_presence/{uid}` and awaits it before calling — but the
  // callable is reachable with any cell, so "is my row actually in this
  // neighborhood, and fresh?" is asked rather than assumed. Subtracting a
  // blind 1 would under-count by one for any caller who is not there.
  const own = await db.collection("v2_presence").doc(request.auth.uid).get();
  const ownExpiry = presenceExpiry(own);
  const countsSelf = own.exists
    && cells.includes(own.get("cell") as string)
    && ownExpiry > now.toMillis();
  // …but ADMITTED is not the same as COUNTED, and the difference is one
  // person. The aggregation above filters `until > now`, and Firestore's
  // range filter skips a document missing the field entirely. The gate
  // just above admits on `presenceExpiry`, which falls back to
  // `at` + the linger for exactly those documents (D179's compatibility
  // arm). So a legacy phone passes the gate while sitting outside
  // `total` — and the blind `- 1` below then removes a person who was
  // never in the number, reporting the room one emptier than it is.
  // Captured HERE, before the backfill a few lines down writes the very
  // field this tests: `own` is a snapshot and would not see that write,
  // but a reader moving either statement should not have to know it.
  const ownWasCounted = !!own.get("until");
  // YOU MAY ONLY ASK ABOUT A ROOM YOU ARE STANDING IN (D177).
  //
  // `cell` arrives from the client, and until now nothing checked that the
  // caller was anywhere near it: a modified client could walk the grid and
  // read the count and the mix of any square in the world. For a headcount
  // and a coarse ranking that was a small leak and it was accepted. It
  // stops being small the moment the room has a ROSTER — sweeping cells
  // would be a people-finder, which is precisely what `v2_presence`'s read
  // deny exists to prevent, arriving through a callable instead of a
  // query.
  //
  // So the gate goes on both doors, not just the new one. It costs NOTHING
  // — `countsSelf` is the same test, over a document already fetched for
  // self-exclusion — and it makes the property structural rather than a
  // convention the next callable might not follow.
  //
  // Mutual by construction, which is the design's own promise: the check
  // passes only while your OWN position is live, so you can see the room
  // exactly while the room can see you. Turning Near off does not merely
  // stop you being counted, it stops you counting.
  if (!countsSelf) {
    throw new HttpsError("failed-precondition", "no live presence in that neighborhood");
  }
  // BACKFILL, so the compatibility window closes itself (D179). The count
  // above filters `until > now`, and a legacy document has no `until` at
  // all — Firestore range filters skip a document missing the field, so a
  // phone on the old build would be admitted here and then be invisible to
  // everyone else's count. Writing the field it should have had repairs it
  // on the owner's first beat, which is the same moment they are admitted.
  //
  // Admin SDK, so the rules cap does not apply — and the value written is
  // the one the rules would have allowed anyway.
  if (!own.get("until")) {
    await own.ref.set({ until: Timestamp.fromMillis(ownExpiry) }, { merge: true });
  }
  const n = Math.max(0, total - (ownWasCounted ? 1 : 0));
  return { n, mix: await roomMixFor(cells, cell as string) };
});

/**
 * The room's composition, cached per cell (D176).
 *
 * THE CACHE IS THE FEATURE, not an optimisation bolted on. The count above
 * is an aggregation and costs ~1 read however crowded the cell is; a mix
 * needs the documents themselves, which puts back exactly the linearity
 * the count was rewritten to remove — (people nearby) × (beats), quadratic
 * at the festival this whole feature exists to serve.
 *
 * Everyone standing in one cell wants the same answer, so it is computed
 * once per cell per beat window and read by everyone else in it. The fold
 * is capped besides, because a stadium should cost a bounded amount and a
 * ranking does not get more true past sixty samples.
 *
 * The cache doc is unreadable to clients (firestore.rules) for the same
 * reason presence is: it is derived from where phones are standing, and a
 * readable one could be swept cell by cell.
 */
async function roomMixFor(cells: string[], own: string): Promise<RoomMix | null> {
  const db = firestore();
  const ref = db.collection("v2_presence_mix").doc(own);
  // One beat window. The client re-asks every four minutes, so a cache
  // that lived longer would serve a room the previous crowd left, and one
  // that lived shorter would fold on every call and buy nothing.
  const fresh = Date.now() - 4 * 60_000;
  try {
    const hit = await ref.get();
    const at = hit.get("at") as Timestamp | undefined;
    if (hit.exists && at && at.toMillis() > fresh) {
      const top = hit.get("top") as string[] | undefined;
      const n = hit.get("n") as number | undefined;
      // A cached REFUSAL is a cached answer too: a thin room must not
      // re-fold on every beat just because it has nothing to say. It is
      // stored as an empty `top` and decoded back to null HERE, so the two
      // paths agree — a fold below the floor and a cache hit on that fold
      // must return the same thing, or the reading depends on which of the
      // two a caller happened to land on. (`{top: [], n: 0}` is truthy, and
      // truthy is what the card renders on.)
      if (!Array.isArray(top) || !top.length || typeof n !== "number") return null;
      return hit.get("capped") === true ? { top, n, capped: true } : { top, n };
    }
    // WHICH sixty, when the cap binds, is the question worth having
    // checked — and the first answer was wrong.
    //
    // A capped `in` runs as nine disjuncts merged, and the original probe
    // (360 docs seeded evenly over the nine) showed the sixty spanning all
    // nine cells, 3-12 apiece. That much held. What it rested on did not:
    // "Firestore orders a query with no explicit `orderBy` by document
    // id" is only true with no inequality in the query, and the paragraph
    // ended by naming its own killer — "key presence by something ordered
    // (a cell prefix, a TIMESTAMP) and this stops being true silently."
    // `until` is that timestamp, and an inequality on it IS the ordering.
    //
    // Re-probed 2026-08-26, same 360 docs with `until` spread 5-179
    // minutes out: the sixty returned were exactly the sixty smallest,
    // topping out at 33 minutes against a population reaching 179. The
    // reading was of the people about to LEAVE, presented as the room —
    // and at a festival, the case this exists for, that is where it binds.
    //
    // So: scan ROOM_SCAN_CAP, sample ROOM_SAMPLE_CAP out of it. The seed
    // is the cell and the beat window, so a cache miss that races itself
    // does not draw two different rooms. Above the scan cap the bias
    // returns — 300 present phones in one block — and `capped` already
    // says the reading is drawn from a slice.
    const scan = await db.collection("v2_presence")
      .where("cell", "in", cells)
      .where("until", ">", Timestamp.fromMillis(Date.now()))
      .limit(ROOM_SCAN_CAP)
      .get();
    const sampled = sampleN(scan.docs, ROOM_SAMPLE_CAP, own + ":" + Math.floor(Date.now() / 240_000));
    const mix = roomMix(sampled.map((d) => d.get("type") as string | undefined));
    await ref.set({
      top: mix ? mix.top : [],
      n: mix ? mix.n : 0,
      capped: !!mix?.capped,
      at: FieldValue.serverTimestamp(),
    });
    return mix;
  } catch (err) {
    // The mix is an extra on top of the count, so its failure must not
    // take the count with it — the card falls back to the number, which
    // is what it showed before this existed.
    logger.warn("roomMixFor failed", err);
    return null;
  }
}

// ── Near by radius: the room, read (D177) ───────────────────────────
//
// The Near stop's Answers, People and Compare tabs. Every other Mirror
// stop folds these from published aggregates on the device; this one
// cannot, because the cohort is a set of PHONES and presence is
// unreadable. So the fold happens here and the client renders what comes
// back.
//
// WHAT THIS DISCLOSES, stated plainly because it is the largest thing the
// presence collection has ever been asked to give up: the uids of people
// standing near you. It is not a widening of `v2_presence` — no cell, no
// coordinate and no position history leaves — but it is membership, and
// membership is what the read deny was protecting when the only reading
// was a number.
//
// Four properties are what make it defensible, and all four are enforced
// here rather than assumed:
//
//   1. MUTUAL. The gate below refuses anyone without a live position of
//      their own. You are in the room exactly while the room is in yours,
//      and turning Near off stops you reading as well as being read.
//   2. YOUR OWN ROOM ONLY. Same gate: the neighbourhood you ask about has
//      to be the one you are standing in, so the grid cannot be walked.
//   3. OPT-IN ON BOTH SIDES, off by default, expiring on its own (D174).
//   4. NOTHING NEW ABOUT ANYBODY. A uid resolves to a profile and its
//      answers — which any signed-in user could already read by name
//      since D98. What is new is the pairing with "here", and that is the
//      pairing the venue radius, the mutuality and the expiry bound.
//
// A DIRECTORY OF STRANGERS IS THE FAILURE MODE, and the radius is what
// keeps it from being one: at ~200 m these are people you can see.
/**
 * Does this id name a question the bank holds?
 *
 * The pulse surface mints one id per DAY from a template
 * (`{baseQid}_{YYYY-MM-DD}`, firestore.rules pins the composition), so the
 * bank holds the base rather than the day's id — the same allowance
 * `surfaceOfQid` makes one module over.
 */
const ROOM_BANK_IDS: ReadonlySet<string> = new Set(V2_QUESTIONS.map((q) => q.id));
const ROOM_DAY_SUFFIX = /_\d{4}-\d{2}-\d{2}$/;
export function isRoomQid(qid: string): boolean {
  if (ROOM_BANK_IDS.has(qid)) return true;
  const base = qid.replace(ROOM_DAY_SUFFIX, "");
  return base !== qid && ROOM_BANK_IDS.has(base);
}

export const nearbyRoomV2 = onCall({ ...LIGHT_CALLABLE, region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const cell = request.data?.cell;
  if (!presenceCellOk(cell)) throw new HttpsError("invalid-argument", "cell must be a la_lo grid id");
  // Bank-checked: an id the bank does not hold is dropped rather than
  // folded. See roomQids for what an unchecked id costs — this callable
  // carries no rate limit, and a fresh invented id never hits the cache.
  const qids = roomQids(request.data?.qids, undefined, isRoomQid);
  const db = firestore();
  const cells = presenceNeighbors(cell as string);
  const now = Timestamp.fromMillis(Date.now());

  // THE GATE. Identical to nearbyCountV2's and deliberately duplicated
  // rather than shared through a helper: it is four lines, and a helper is
  // a thing a future callable can forget to call. Both doors carry the
  // lock in full view.
  const own = await db.collection("v2_presence").doc(uid).get();
  if (!own.exists
    || !cells.includes(own.get("cell") as string)
    || presenceExpiry(own) <= now.toMillis()) {
    throw new HttpsError("failed-precondition", "no live presence in that neighborhood");
  }

  const room = await roomFor(cells, cell as string, qids);
  return {
    // The caller is not in their own room. Filtered here rather than in
    // the cache, because the cache is shared by everyone in the cell and
    // each of them is a different person to leave out.
    people: room.people.filter((p) => p.uid !== uid),
    qs: room.qs,
  };
});

interface RoomDoc {
  people: Array<{ uid: string; type?: string }>;
  qs: RoomCounts;
}

/**
 * The room's roster and its answers, cached per cell (D177).
 *
 * Same argument as roomMixFor's cache one function up, with more at stake:
 * this fold reads a DOCUMENT PER PERSON PER QUESTION, so uncached it would
 * charge (people) x (questions) x (viewers) and a crowded venue would pay
 * that repeatedly for the same answer. Everyone in a cell is standing in
 * the same room; it is folded once per beat window and read by the rest.
 *
 * PER-QUESTION, which is the part worth noticing. The cached document
 * accumulates `qs` by qid, so a caller asking about a question the cell
 * has already folded pays nothing for it and folds only what is missing.
 * The day's deck is the same list for everybody (computeDeckIds is a pure
 * function of the day), so in practice the first caller in a window pays
 * for all of it and the rest pay one read.
 *
 * The missing questions are folded over the CACHED roster rather than a
 * fresh sample, so People and Compare describe the same crowd even when
 * they were computed a minute apart.
 */
async function roomFor(cells: string[], own: string, qids: string[]): Promise<RoomDoc> {
  const db = firestore();
  const ref = db.collection("v2_presence_room").doc(own);
  const fresh = Date.now() - 4 * 60_000;
  let people: Array<{ uid: string; type?: string }> = [];
  const qs: RoomCounts = {};
  let held: RoomCounts | undefined;
  let hit = false;
  try {
    const snap = await ref.get();
    const at = snap.get("at") as Timestamp | undefined;
    if (snap.exists && at && at.toMillis() > fresh) {
      const cached = snap.get("people") as RoomDoc["people"] | undefined;
      if (Array.isArray(cached)) { people = cached; hit = true; }
      const cq = snap.get("qs") as RoomCounts | undefined;
      if (cq && typeof cq === "object") {
        // Kept whole as well as filtered: `qs` is what this CALL draws,
        // `held` is what the WINDOW has accumulated, and only the second
        // one can say whether the window is full.
        held = cq;
        for (const q of qids) if (cq[q]) qs[q] = cq[q];
      }
    }
    if (!hit) {
      const scan = await db.collection("v2_presence")
        .where("cell", "in", cells)
        .where("until", ">", Timestamp.fromMillis(Date.now()))
        .limit(ROOM_SCAN_CAP)
        .get();
      // Scan wide, then sample — see roomMixFor above for the probe. The
      // limit alone took the twenty-four SOONEST-EXPIRING presences,
      // because the `until` inequality is itself the sort order, so the
      // roster and the Compare fold over it described the people nearest
      // to leaving rather than the room. Only the presence read widens:
      // the expensive half below still folds over ROOM_PEOPLE_CAP people.
      const present = sampleN(scan.docs, ROOM_PEOPLE_CAP, own + ":" + Math.floor(Date.now() / 240_000));
      people = present.map((d) => {
        const t = d.get("type");
        return typeof t === "string" && t ? { uid: d.id, type: t } : { uid: d.id };
      });
    }
    // BOUNDED BY THE WINDOW, not only by the call. `ROOM_QUESTION_CAP`
    // caps one request at eight; nothing capped what the cell accumulates
    // before the window turns over, so the map could reach the whole
    // question bank — seven hundred keys on a document every caller in
    // the cell reads, at a batched read per key. Past the window cap the
    // room serves what it already holds: a thinner grid, never an error.
    const missing = roomWindowMisses(qids, held);
    if (missing.length && people.length) {
      // One getAll per question rather than one for the whole grid: it
      // bounds each call at ROOM_PEOPLE_CAP refs, and the misses cost
      // nothing — a person who never answered a question is an absent
      // document, not an error.
      const folded = await Promise.all(missing.map(async (q) => {
        const refs = people.map((p) => db.doc(`v2_users/${p.uid}/answers/${q}`));
        const docs = await db.getAll(...refs);
        return [q, tallyPicks(docs.map((d) => d.get("optionIdx") as number | undefined))] as const;
      }));
      for (const [q, counts] of folded) qs[q] = counts;
    }
    if (!hit || missing.length) {
      // MERGE ONLY INSIDE A WINDOW, and this distinction is the whole
      // correctness of the cache.
      //
      // On a hit, `qs` holds only what THIS call asked for, so a plain set
      // would blank every other question the cell had already folded —
      // merge, and the window accumulates.
      //
      // On a MISS the merge would be the bug: the stale document's `qs` is
      // last window's crowd, and merging a fresh stamp on top of it would
      // republish an hour-old split as current, for as long as nobody
      // re-asked that question. A new window is a new room, so the counts
      // go with the roster.
      //
      // AND `at` IS ONLY WRITTEN ON A MISS, because it dates the ROSTER.
      // Restamping it on a hit slid the four-minute window forward every
      // time a call folded a question the cell had not seen — which is the
      // ordinary case, since two people at different points in the day's
      // deck send different qid slices. A cell with steady traffic
      // therefore never re-sampled: newcomers stayed missing and people who
      // had left stayed listed, for as long as the novel questions kept
      // arriving. `people` is left alone for the same reason — on a hit it
      // IS the cached roster, so rewriting it says nothing and re-dating it
      // says something false.
      //
      // Bounding the window bounds the document too. `qs` grows a key per
      // question asked, so an unbounded window was also an unbounded map.
      // Two things bound it now, and they close different halves: the qids
      // must NAME questions (roomQids takes the bank, so an invented id is
      // dropped before anything is read), and the window itself may only
      // accumulate ROOM_WINDOW_QUESTION_CAP of them. A window that
      // actually expires rewrites the doc wholesale on the next miss,
      // which resets `qs` to what that call asked for.
      await ref.set(
        hit ? { qs } : { people, qs, at: FieldValue.serverTimestamp() },
        { merge: hit },
      );
    }
  } catch (err) {
    // The room is an extra on top of the count, like the mix: its failure
    // must leave the stop with its number rather than an error screen.
    logger.warn("roomFor failed", err);
  }
  return { people, qs };
}

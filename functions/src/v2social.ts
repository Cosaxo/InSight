// InSight v2 — the social layer ("know each other"): groups, duos, and
// server-materialized reveals (decision D5).
//
// A duo IS a group with mode "duo" and a 2-member cap — one collection,
// one reveal pipeline, two reveal conditions:
//   group  · next UTC day, if at least one member answered
//   duo    · next UTC day, ONLY if both played (else no reveal, streak 0)
//
// Sealed answers live under composite ids (g_{gid}_{day}). Since D98 a
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
  inviteCodeFromBytes,
  normalizeHandle,
  isPlausibleFcmToken,
  nextFcmTokens,
  movesPresentState,
  nextStreak,
  PENDING_DAYS_KEEP,
  prunePendingDays,
  publishableDuelAgg,
  revealQid,
  revealVotes,
  scanDays,
  revealMembersFor,
  shouldReveal,
  utcDayKey,
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
    // When each member became one. Read only by revealGroupDay, to scope a
    // day's reveal to the people who were in the group for that day — see
    // revealMembersFor (pure.ts). Same map shape as memberNames, and it is
    // removed on the same two paths (leaveGroupV2, deleteAccount phase 1c),
    // because a uid left behind here is the shape D55 §8 records ownerUid
    // having.
    memberJoinedAt: { [uid]: FieldValue.serverTimestamp() },
    inviteCode: code,
    streak: 0,
    lastRevealDay: null,
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

// ── the reveal pipeline ─────────────────────────────────────────

interface RevealVote {
  optionIdx: number;
  guessIdx?: number;
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

async function revealGroupDay(
  group: FirebaseFirestore.QueryDocumentSnapshot,
  dayKey: string,
): Promise<boolean> {
  const db = firestore();
  const gid = group.id;
  const mode: string = group.get("mode") || "group";
  const members: string[] = group.get("memberUids") || [];
  if (!members.length) return false;
  // Cheap skip: already revealed. The other half of the old pair —
  // "already checked and nobody played" — is now the absence of dayKey from
  // pendingDays, which the indexed scan expresses as a query rather than a
  // per-document test. A full scan reaches this line for every group and
  // pays the reads below deliberately; that is what makes it the recovery
  // path (see runDuelReveals).
  if (group.get("lastRevealDay") === dayKey) return false;
  const revealRef = group.ref.collection("reveals").doc(dayKey);
  if ((await revealRef.get()).exists) return false;

  const answerId = `g_${gid}_${dayKey}`;
  const answerSnaps = await db.getAll(
    ...members.map((uid) => db.doc(`v2_users/${uid}/answers/${answerId}`)),
  );
  // Push tokens are NOT fetched here any more (D236). They were, next to
  // the reads the reveal actually needs — which billed one document per
  // member on every scanned day, including the majority that reveal
  // nothing. sendPushToUids reads them itself, after the reveal has
  // committed and only when there is something to announce.
  //
  // The PROFILES are not fetched here either, for the same reason and the
  // same distance too late: they sat beside this read, above the
  // shouldReveal gate, and their only use is the `names` map the reveal
  // writes — so every scanned day that did not reveal (the ordinary duo
  // shape: one partner has played, the other has not yet) bought one
  // document per member and dropped them. They now read directly above
  // that use, past the gate.

  const votes: Record<string, RevealVote> = {};
  const qids: unknown[] = [];
  answerSnaps.forEach((s, i) => {
    if (!s.exists) return;
    const optionIdx = s.get("optionIdx");
    if (typeof optionIdx !== "number") return;
    const v: RevealVote = { optionIdx };
    const guessIdx = s.get("guessIdx");
    if (typeof guessIdx === "number") v.guessIdx = guessIdx;
    votes[members[i]] = v;
    qids.push(s.get("qid"));
  });
  const qid = revealQid(qids);
  const played = Object.keys(votes).length;

  // The oldest day still worth carrying in pendingDays. Both settle paths
  // prune to this, so the array cannot grow without bound on a duo whose
  // partner never plays. See PENDING_DAYS_KEEP in pure.ts for the bound.
  const oldestKeptDay = utcDayKey(
    -PENDING_DAYS_KEEP,
    Date.parse(`${dayKey}T00:00:00Z`),
  );

  // duo: both-or-nothing (and the streak lives or dies on it);
  // group: at least one answer. Below the bar → settle the day unrevealed.
  if (!shouldReveal(mode, played)) {
    // Still a TRANSACTION that re-reads the answer docs, but the reason is
    // now simply "do not close a day an answer just landed on" rather than
    // the ordering argument the old skip-marker needed. Dropping dayKey from
    // pendingDays is what closes it; a late answer's arrayUnion re-adds it
    // unconditionally, so whichever order the two writers commit in, the day
    // ends up open if and only if an answer exists that we did not see.
    await db.runTransaction(async (tx) => {
      const [gsnap, ...fresh] = await tx.getAll(
        group.ref,
        ...members.map((uid) => db.doc(`v2_users/${uid}/answers/${answerId}`)),
      );
      if (!gsnap.exists) return;
      const freshPlayed = fresh.filter(
        (s) => s.exists && typeof s.get("optionIdx") === "number",
      ).length;
      // A late answer flipped the decision — leave the day pending so the
      // next scan (≤2h away) performs the reveal.
      if (shouldReveal(mode, freshPlayed)) return;
      tx.update(group.ref, {
        pendingDays: prunePendingDays(gsnap.get("pendingDays"), dayKey, oldestKeptDay),
        // Zeroing the streak is a statement about NOW — "you two missed a
        // day" — so an old day settling empty must not make it. The scan
        // walks newest-first and the operator's `full` mode covers six
        // days, so this fired routinely on days already behind the last
        // reveal. movesPresentState carries the arithmetic.
        ...(mode === "duo"
          && gsnap.get("streak")
          && movesPresentState(gsnap.get("lastRevealDay"), dayKey)
          ? { streak: 0 } : {}),
      });
    });
    return false;
  }

  // ONE FIELD, and the fieldMask is load-bearing rather than tidy. A
  // profile is client-writable and firestore.rules bounds only some of it:
  // displayName and the anchors are capped, the consent record is keyed
  // and typed, `testResults` is bounded only by KEY COUNT (8), and
  // `createdAt`/`updatedAt` not at all — no cap, not even a type. So a member
  // can legitimately hold a document approaching Firestore's 1 MiB, and
  // LANES = 5 × GROUP_CAP = 32 puts up to 160 of them in flight on the
  // 512 MiB instance. The mask bounds the exposure regardless of what any
  // rule permits, which is why it is fixed here rather than by capping
  // testResults: `createdAt` is equally unbounded and the next field
  // added would be too. (This named `anon` until 2026-08-31 — a key D331
  // took off the allowlist, so the example had no writer at all. The
  // argument held; its illustration named a ghost, which is the way an
  // argument stops being checkable.) Reading past the gate narrows the same window further —
  // only days that actually reveal put profiles in flight at all.
  const profileSnaps = await db.getAll(
    ...members.map((uid) => db.doc(`v2_users/${uid}`)),
    { fieldMask: ["displayName"] },
  );
  const names: Record<string, string> = {};
  profileSnaps.forEach((s, i) => {
    names[members[i]] = (s.exists && s.get("displayName")) || "";
  });

  // The reveal is built and written INSIDE a transaction that re-reads the
  // answer docs, for the same reason the skip-marker above is one.
  //
  // The getAll() above is a snapshot, and a duel answer stays legal until
  // the reveal doc exists — firestore.rules gates creation on
  // `!exists(.../reveals/$(day))`, which is still true for the whole
  // window between that read and the write. So an answer committing in
  // that window passed rules, and then landed in a reveal that had already
  // been assembled without it: the vote is dropped, permanently and
  // silently, because create() never runs twice and the day can never be
  // re-opened. The member sees a reveal their vote is missing from.
  //
  // Re-reading inside the transaction closes it in the direction that
  // matters. Firestore's serializability leaves a late answer two
  // outcomes: it commits before our re-read, and we include it; or it is
  // forced to commit after our create(), in which case rules reject it
  // outright (the reveal now exists) and the vote never claims to have
  // been cast. Either way no accepted answer is silently discarded.
  //
  // tx.create(), not tx.set(): scheduledDuelReveals (every 2h) and a
  // manual revealDuelsNowV2 can overlap. The existence read below already
  // makes the loser retry and bail, so this is belt-and-braces — but
  // overwriting would shrink an already-published vote set if it ever did
  // happen, which is the one outcome worth being loud about.
  //
  // The streak now moves in the SAME transaction, off a fresh read of the
  // group rather than the scan's page snapshot. It used to be a follow-up
  // update() that could fail on its own, leaving a published reveal whose
  // day the group had no record of — and the next run would then re-derive
  // the streak from a lastRevealDay that never advanced.
  let streak = 0;
  let didReveal = false;
  // What the signal fold (below) needs from the committed reveal — captured
  // here because the transaction's own locals die with it.
  let aggQid: string | null = null;
  let aggVotes: DuelVoteLike[] = [];
  await db.runTransaction(async (tx) => {
    // Reset per attempt: a transaction callback can run more than once,
    // and a retry that bails early must not inherit the previous try's
    // verdict.
    didReveal = false;
    streak = 0;
    aggQid = null;
    aggVotes = [];
    const [existing, gsnap, ...fresh] = await tx.getAll(
      revealRef,
      group.ref,
      ...members.map((uid) => db.doc(`v2_users/${uid}/answers/${answerId}`)),
    );
    if (existing.exists) return;      // lost the race — the standing reveal wins
    if (!gsnap.exists) return;        // last member left while we were reading
    if (gsnap.get("lastRevealDay") === dayKey) return;

    // qid alongside each vote, not just the winning one: the fold below has
    // to know WHICH votes were cast on the question it is folding into, and
    // the reveal doc has to tell the card which prompt to render each answer
    // under.
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
    // An answer can only appear between the two reads, never vanish
    // (answers are create-only, D5) — so this can gain votes but not lose
    // them, and the reveal condition cannot flip back to false. Re-checked
    // anyway: the invariant is worth asserting rather than assuming.
    if (!shouldReveal(mode, Object.keys(freshVotes).length)) return;

    aggQid = freshQid ?? qid;
    // NOT Object.values(freshVotes) — only the votes cast on aggQid. When
    // members' cached banks disagree (see revealQid), the others' votes are
    // still published in the reveal below; they are simply not folded into a
    // question they were not answers to.
    aggVotes = votesMatchingQid(freshEntries, aggQid);

    tx.create(revealRef, {
      day: dayKey,
      qid: freshQid ?? qid,
      votes: freshVotes,
      names,
      // Membership AT REVEAL TIME.
      //
      // THIS NO LONGER GATES THE READ, and the paragraph that used to
      // stand here said it did — "the reveal read rule gates on THIS
      // array… a later joiner cannot read this day". True when written;
      // retired by D98, which made the match `allow read: if
      // request.auth != null` on the reasoning that a reveal is world
      // answers' younger sibling. Nothing updated the comment, so the
      // strongest statement about who can read a reveal lived at the
      // write site and was three months stale — the shape D71 already
      // named: a comment that overstates a guarantee is how the
      // guarantee outlives its reason.
      //
      // What the field IS for now: the record of who was in the circle
      // for that day, which `deleteAccount` scrubs on erasure (pinned in
      // rules.test.ts) and which is what the reveal's names are drawn
      // against. Writing it in the same create() as the votes is what
      // stops the two from drifting.
      //
      // It is the scan's membership, deliberately, not gsnap's fresher
      // one: these are the members whose answers were read, and a fresher
      // list could hand yesterday's reveal to someone who joined this
      // morning.
      //
      // That reasoning was right about the risk and wrong about the size of
      // it. BOTH reads happen on D+1, so preferring one over the other only
      // ever closed the seconds between them — while the scan runs `every
      // 120 minutes`, so anyone joining between 00:00 UTC and it was a
      // current member either way, and read a day they were not in the group
      // for. What actually scopes this is WHEN each member joined, which is
      // why the array below is filtered rather than taken (revealMembersFor,
      // pure.ts; D55 §9).
      //
      // The filtered array can in principle come out empty — every member
      // who played day D has left, and everyone now in the group joined
      // after it. The reveal still writes, naming nobody, which is the
      // correct answer to "who was here for this day"; it also settles the
      // day so the scan stops re-examining it. (Before D98 that sentence
      // ended "readable by nobody" — the empty array closed the read. It
      // does not any more; the document is world-readable and simply
      // credits no one.)
      //
      // The deploy-ordering warning that stood here is spent with the
      // rule it was about: `members` had to go live BEFORE the rule
      // started requiring it, because a released ruleset applies
      // instantly while gen2 functions roll out over minutes. No rule
      // requires it now, so removing the field costs an erasure sweep and
      // the reveal's names, not a window of unreadable documents.
      members: revealMembersFor(
        members,
        joinedAtMs(gsnap.get("memberJoinedAt")),
        dayKey,
        Object.keys(freshVotes),
      ),
      revealedAt: FieldValue.serverTimestamp(),
    });
    // The day is settled, so it leaves pendingDays in the same write that
    // publishes the reveal — the scan must not find this group again for
    // this day, and a reveal that exists while the day still reads as owing
    // one is the drift that would put the scan into a loop. That much is
    // true of any day, backfilled or not.
    const settle: Record<string, unknown> = {
      pendingDays: prunePendingDays(gsnap.get("pendingDays"), dayKey, oldestKeptDay),
    };
    // `streak` and `lastRevealDay` are the group's PRESENT tense, and only a
    // day newer than the last reveal may move them. The scan walks
    // newest-first, so without this a run that revealed yesterday and then
    // reached an older pending day wrote lastRevealDay BACKWARDS and reset
    // the streak to 1 — for filling a gap in. movesPresentState (pure.ts)
    // has the sequence.
    if (movesPresentState(gsnap.get("lastRevealDay"), dayKey)) {
      streak = nextStreak(
        gsnap.get("lastRevealDay"),
        dayKey,
        gsnap.get("streak") || 0,
      );
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
  // reveal, which is the product's one daily moment (and whose retry
  // re-reads 2×members documents). The cost of the split, recorded: a
  // crash between the reveal commit and this fold undercounts an advisory,
  // floored aggregate by one reveal — the reveal doc's existence stops the
  // scan from ever retrying the day, so the loss is permanent and
  // accepted. ERROR-level so monitoring sees a systematic failure; one
  // lost increment is survivable, a silent pattern is not.
  try {
    await foldDuelSignal(db, mode, aggQid, aggVotes);
  } catch (err) {
    logger.error(`[duel-signal] fold failed for ${gid}/${dayKey} (${aggQid}):`, err);
  }

  // The reveal is out — one of the product's two notifications (D236).
  // Best-effort by construction: sendPushToUids never throws, so FCM
  // being down can never roll back a reveal that already committed.
  await sendPushToUids(
    db,
    members,
    {
      title: group.get("name") || "Your duel",
      body: mode === "duo"
        ? "Yesterday's answers are out — see if you called it."
        : "Yesterday's answers are revealed — see who said what.",
    },
    { kind: "reveal", gid, day: dayKey },
    "reveals",
    "reveal",
  );
  return true;
}

// Which groups a run looks at.
//
//   "indexed"  where("pendingDays", "array-contains", day) — only groups
//              that actually have an answer for that day. What the schedule
//              uses, 12 times a day, forever.
//   "full"     every group document. The recovery path, and what the ops
//              callable uses.
//
// Why both, rather than replacing one with the other: the marker is written
// by onV2AnswerCreated, so the indexed query inherits that trigger's
// at-least-once delivery. In the steady state that is free — the scan runs
// every 2h and a marker that lands late is picked up by the next run, well
// inside the ≤2h reveal delay the schedule already promises. But it does
// mean "the query returned nothing" and "nothing played" are no longer the
// same statement, and a run that needs to be certain has to read everything.
// revealDuelsNowV2 is that run: an operator reaching for it is already
// reacting to something being wrong, which is the worst moment to hand them
// a scan that trusts the marker they may be there to repair.
//
// It is also what keeps the e2e honest. The loop writes duel answers and
// calls revealDuelsNowV2 immediately; an indexed-only scan would be racing
// Eventarc for the marker and would fail on timing rather than on
// behaviour. The e2e exercises the indexed path in its own leg, with a
// bounded wait, so both are covered for what each is actually for.
// The duel signal's fold (D40 part 3). One small transaction per revealed
// group-day: read the running private state and the question doc — two
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
async function foldDuelSignal(
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

async function runDuelReveals(
  dayKey?: string,
  mode: ScanMode = "indexed",
): Promise<{ revealed: number; scanned: number; mode: ScanMode; days: string[] }> {
  const days = scanDays(dayKey);
  let revealedTotal = 0;
  let scannedTotal = 0;
  for (const day of days) {
    const one = await runDuelRevealsForDay(day, mode, scannedTotal);
    revealedTotal += one.revealed;
    scannedTotal += one.scanned;
    // The tripwire bounds the RUN, not a day — so a run that hits it stops
    // asking about later days too, rather than paying the ceiling once per
    // day in the window.
    if (one.cappedOut) break;
  }
  // The heartbeat, and the only evidence the scheduled scan ran at all.
  //
  // Structured fields as well as the message, for the same reason the
  // contention line in v2.ts carries them: the message is what a human
  // greps, the fields are what a log-based metric selects on.
  //
  // `mode` is load-bearing here rather than decorative.
  // monitoring/scheduledDuelReveals-silent.json alerts on the ABSENCE of
  // this line, and runDuelReveals is shared by the schedule ("indexed") and
  // revealDuelsNowV2's manual lever ("full"). Without a mode to filter on,
  // an operator running the lever during an incident would emit the
  // heartbeat and reset the absence timer — silencing the alert for the
  // outage it was run to fix.
  //
  // ONCE PER RUN, not per day: a run now covers the whole pending window
  // (scanDays), and one point per day would make the metric's rate a
  // statement about the window size rather than about the scan running.
  // `day` stays the day the schedule is primarily about — yesterday — so a
  // filter on it means what it always did.
  logger.info(
    `[v2social] reveals for ${days.join(",")} (${mode}): ` +
      `${revealedTotal} of ${scannedTotal} scanned`,
    {
      metric: "duel_reveal_run",
      day: days[0],
      days: days.length,
      mode,
      revealed: revealedTotal,
      scanned: scannedTotal,
    },
  );
  return { revealed: revealedTotal, scanned: scannedTotal, mode, days };
}

async function runDuelRevealsForDay(
  yester: string,
  mode: ScanMode,
  scannedBefore: number,
): Promise<{ revealed: number; scanned: number; cappedOut: boolean }> {
  const db = firestore();
  // PAGINATED either way. It used to fetch GROUP_SCAN_CAP docs and process
  // them one at a time; the 60s timeout bound at roughly 200-400 active
  // groups — an order of magnitude below the cap — so the function died
  // mid-loop and re-walked the same prefix on every run, with nothing but a
  // log line saying why.
  //
  // The full scan is what the indexed query replaces on the schedule. It was
  // there because the obvious filter, `lastCheckedDay != yester`, cannot
  // work: Firestore's != EXCLUDES documents missing the field, so every
  // never-checked group would silently drop out, and "!= OR missing" is not
  // expressible in one query. array-contains has no such hole — a group with
  // no pendingDays field simply has no pending day, which is exactly true.
  //
  // Lanes: 5, not 10. The timeout raise is already 8x, and each reveal can
  // fan out to a group's whole token set; more lanes buys throughput this
  // does not need and multiplies peak memory and messaging concurrency.
  const LANES = 5;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let revealed = 0;
  let scanned = 0;

  for (;;) {
    // No composite index is declared for this, on the understanding that
    // Firestore's automatic single-field index for an array field is stored
    // as (value, __name__) and therefore already serves array-contains
    // followed by orderBy(__name__). That is an assumption about Firestore,
    // not something this repo can prove: the emulator creates whatever a
    // query asks for, so a green test says nothing about production.
    //
    // If it is wrong the failure is loud rather than silent — the scheduled
    // run throws FAILED_PRECONDITION carrying a console link to the index it
    // wants — and it is recoverable without a deploy, because
    // revealDuelsNowV2 still does the full scan. Add the index, then let the
    // next scheduled run catch up.
    let q = mode === "indexed"
      ? db.collection("v2_groups")
        .where("pendingDays", "array-contains", yester)
        .orderBy("__name__").limit(PAGE_SIZE)
      : db.collection("v2_groups").orderBy("__name__").limit(PAGE_SIZE);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.get();
    if (page.empty) break;

    // Process the page in fixed-width lanes.
    const docs = page.docs;
    for (let i = 0; i < docs.length; i += LANES) {
      const lane = docs.slice(i, i + LANES);
      const results = await Promise.all(lane.map(async (g): Promise<number> => {
        try {
          return (await revealGroupDay(g, yester)) ? 1 : 0;
        } catch (err) {
          // One group's failure must not strand the rest of the scan.
          logger.error(`[v2social] reveal failed for ${g.id}/${yester}:`, err);
          return 0;
        }
      }));
      revealed += results.reduce((a, b) => a + b, 0);
    }

    scanned += page.size;
    if (page.size < PAGE_SIZE) break;
    cursor = docs[docs.length - 1];

    // The tripwire, repurposed. It no longer bounds one page — it bounds
    // the whole run, so "I have outgrown this" still gets said rather than
    // quietly becoming a multi-minute job.
    //
    // Counted across the run's whole day window (`scannedBefore`), not per
    // day: the ceiling is about how long one invocation may take, and a run
    // now asks about PENDING_DAYS_KEEP days.
    //
    // Note what the two modes mean here. In "full" it counts every group in
    // the collection, which is the number that used to grow with signups. In
    // "indexed" it counts groups that PLAYED that day, so hitting the ceiling
    // is a real statement about activity rather than about registration —
    // and the remedy named below is the one that is actually left.
    if (scannedBefore + scanned >= GROUP_SCAN_CAP) {
      logger.error(
        `[v2social] scanned ${scannedBefore + scanned} groups in one ${mode} run ` +
          `(ceiling ${GROUP_SCAN_CAP}), stopping at ${yester}. Groups and days ` +
          "beyond this are NOT checked this run; their reveals land on a later " +
          "run at best. Time to shard the scan by day-key suffix or move it to " +
          "a queue.",
      );
      return { revealed, scanned, cappedOut: true };
    }
  }

  return { revealed, scanned, cappedOut: false };
}

export const scheduledDuelReveals = onSchedule(
  // ≤2h reveal delay, half the scans — and since the marker landed, each
  // scan reads the groups that played rather than every group that exists.
  { schedule: "every 120 minutes", region: REGION },
  async () => {
    await runDuelReveals(undefined, "indexed");
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
// Pass scan:"indexed" to exercise the path the schedule takes.
export const revealDuelsNowV2 = onCall({ region: REGION }, async (request) => {
  assertOperator(request);
  const dayKey = typeof request.data?.day === "string" ? request.data.day : undefined;
  const mode: ScanMode = request.data?.scan === "indexed" ? "indexed" : "full";
  return runDuelReveals(dayKey, mode);
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
    if (snap.exists) {
      // Re-claiming your own handle is a no-op rather than an error: the
      // client retries on a dropped response, and a retry that reports
      // "taken" about your own name is the worst possible message.
      if (snap.get("uid") === uid) return;
      throw new HttpsError("already-exists", "that handle is taken");
    }
    tx.set(ref, { uid, at: FieldValue.serverTimestamp() });
    tx.set(userRef, { handle }, { merge: true });
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
    tx.set(peopleRef, myName
      ? { handle, name: myName, nameKey }
      : { handle }, { merge: true });
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
  const targets = [...new Set(
    (Array.isArray(rawTo) ? rawTo : [rawTo]).map((t) => String(t || "")).filter(Boolean),
  )];
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
  const skipped: string[] = [];
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
  // client cannot grant itself a longer stay than the design allows; the
  // constant is imported here to keep the two definitions in one place.
  void PRESENCE_LINGER_MIN;
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

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
import { getMessaging } from "firebase-admin/messaging";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertOperator, ENFORCE_APP_CHECK } from "./ops";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { randomBytes } from "node:crypto";
import { inviteCodeFromBytes, isPlausibleFcmToken, nextFcmTokens, nextStreak, shouldReveal, utcDayKey } from "./pure";

const REGION = "us-central1";
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

async function assertMembershipCap(uid: string): Promise<void> {
  const db = getFirestore();
  const mine = await db.collection("v2_groups")
    .where("memberUids", "array-contains", uid).limit(MEMBERSHIP_CAP).get();
  if (mine.size >= MEMBERSHIP_CAP) {
    throw new HttpsError("resource-exhausted", "too many groups on this account");
  }
}

// Collision-checked (31^8 space, so retries are cosmically rare — but
// joinGroupV2's limit(1) would land someone in the wrong group).
async function uniqueInviteCode(): Promise<string> {
  const db = getFirestore();
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
  const db = getFirestore();
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
  const db = getFirestore();
  if (name) {
    await db.doc(`v2_users/${uid}`).set({ displayName: name }, { merge: true });
    return name;
  }
  const prof = await db.doc(`v2_users/${uid}`).get();
  return (prof.exists && prof.get("displayName")) || "";
}

export const createGroupV2 = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const name = String(request.data?.name || "").trim();
  const mode = request.data?.mode === "duo" ? "duo" : "group";
  if (!name || name.length > 60) {
    throw new HttpsError("invalid-argument", "name required (≤60 chars)");
  }
  const db = getFirestore();
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
    inviteCode: code,
    streak: 0,
    lastRevealDay: null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { gid: ref.id, inviteCode: code };
});

export const joinGroupV2 = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const code = String(request.data?.code || "").trim().toUpperCase();
  if (!code) throw new HttpsError("invalid-argument", "code required");
  await assertJoinBudget(uid);
  await assertMembershipCap(uid);
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

export const leaveGroupV2 = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "must be signed in");
  const uid = request.auth.uid;
  const gid = String(request.data?.gid || "");
  const db = getFirestore();
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
// fcmTokens is where sendRevealPushes fans out to, and it used to be a
// direct client merge onto the profile doc — so any signed-in script
// could plant a token it did not own on its own account and route reveal
// pushes to someone else's device (needs the victim's token, so the risk
// was friend-scale; see SHIP-CHECKLIST "before-public hardening"). The
// write now happens only here, and the ruleset refuses fcmTokens from
// clients outright.
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
export const registerPushToken = onCall({ region: REGION, enforceAppCheck: ENFORCE_APP_CHECK }, async (request) => {
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
  const db = getFirestore();
  const ref = db.collection("v2_users").doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const tokens = nextFcmTokens(snap.exists ? snap.get("fcmTokens") : [], token, prev, 10);
    tx.set(ref, { fcmTokens: tokens }, { merge: true });
  });
  return { ok: true };
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
  // Cheap skips first: already revealed, or already checked with no
  // play — otherwise every scheduled run re-reads every member's docs
  // for groups that sat idle.
  if (group.get("lastRevealDay") === dayKey) return false;
  if (group.get("lastCheckedDay") === dayKey) return false;
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

  // duo: both-or-nothing (and the streak lives or dies on it);
  // group: at least one answer. Below the bar → write the skip-marker.
  if (!shouldReveal(mode, played)) {
    // The marker write is a TRANSACTION that re-reads the answer docs,
    // because a plain update races onV2AnswerCreated's compensating
    // delete: an answer landing between the getAll() above and the
    // marker write can trigger the compensator, which reads the group
    // BEFORE lastCheckedDay=dayKey commits, sees a different value,
    // does nothing — and the marker then closes the day forever. The
    // transaction pins the ordering: a late answer either commits
    // before our re-read (we see it here and leave the day open for
    // the next scan), or Firestore's serializability forces it to
    // commit strictly AFTER the marker — in which case the
    // compensator's later group read is guaranteed to observe
    // lastCheckedDay === day and delete it. No interleaving strands
    // the day.
    await db.runTransaction(async (tx) => {
      const fresh = await tx.getAll(
        ...members.map((uid) => db.doc(`v2_users/${uid}/answers/${answerId}`)),
      );
      const freshPlayed = fresh.filter(
        (s) => s.exists && typeof s.get("optionIdx") === "number",
      ).length;
      // A late answer flipped the decision — skip the marker so the
      // next scan (≤2h away) performs the reveal.
      if (shouldReveal(mode, freshPlayed)) return;
      tx.update(group.ref, {
        lastCheckedDay: dayKey,
        ...(mode === "duo" && group.get("streak") ? { streak: 0 } : {}),
      });
    });
    return false;
  }

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
  await db.runTransaction(async (tx) => {
    // Reset per attempt: a transaction callback can run more than once,
    // and a retry that bails early must not inherit the previous try's
    // verdict.
    didReveal = false;
    streak = 0;
    const [existing, gsnap, ...fresh] = await tx.getAll(
      revealRef,
      group.ref,
      ...members.map((uid) => db.doc(`v2_users/${uid}/answers/${answerId}`)),
    );
    if (existing.exists) return;      // lost the race — the standing reveal wins
    if (!gsnap.exists) return;        // last member left while we were reading
    if (gsnap.get("lastRevealDay") === dayKey) return;

    const freshVotes: Record<string, RevealVote> = {};
    let freshQid: string | null = null;
    fresh.forEach((s, i) => {
      if (!s.exists) return;
      const optionIdx = s.get("optionIdx");
      if (typeof optionIdx !== "number") return;
      const v: RevealVote = { optionIdx };
      const guessIdx = s.get("guessIdx");
      if (typeof guessIdx === "number") v.guessIdx = guessIdx;
      freshVotes[members[i]] = v;
      freshQid = freshQid || s.get("qid") || null;
    });
    // An answer can only appear between the two reads, never vanish
    // (answers are create-only, D5) — so this can gain votes but not lose
    // them, and the reveal condition cannot flip back to false. Re-checked
    // anyway: the invariant is worth asserting rather than assuming.
    if (!shouldReveal(mode, Object.keys(freshVotes).length)) return;

    tx.create(revealRef, {
      day: dayKey,
      qid: freshQid ?? qid,
      votes: freshVotes,
      names,
      // Membership AT REVEAL TIME — load-bearing, not informational. The
      // reveal read rule gates on THIS array (firestore.rules, the
      // /reveals/{day} match), which is what keeps the guarantee
      // retroactive: a later joiner cannot read this day, and a member who
      // leaves does not lose the days they played. Writing it in the same
      // create() as the votes is what stops the two from drifting.
      //
      // It is the scan's membership, deliberately, not gsnap's fresher
      // one: these are the members whose answers were read, and a fresher
      // list could hand yesterday's reveal to someone who joined this
      // morning — the exact leak D5's amendment closed.
      //
      // Never remove or rename this field without changing that rule in the
      // opposite order to the way the pair shipped: the field had to go live
      // BEFORE the rule started requiring it (a released ruleset applies
      // instantly while gen2 functions roll out over minutes, so reveals
      // written in that window would carry no `members` and be permanently
      // unreadable by their own members). Dropping it means the rule stops
      // depending on it FIRST.
      members,
      revealedAt: FieldValue.serverTimestamp(),
    });
    streak = nextStreak(
      gsnap.get("lastRevealDay"),
      dayKey,
      gsnap.get("streak") || 0,
    );
    tx.update(group.ref, { streak, lastRevealDay: dayKey });
    didReveal = true;
  });
  if (!didReveal) return false;

  // The one notification the product earns (Phase 5): the reveal is out.
  // Tokens are best-effort — failures never block the reveal itself.
  try {
    // token -> owning uids, so a token FCM reports dead can be pruned
    // from the doc it lives on (otherwise fcmTokens grows one ghost per
    // reinstall/rotation forever and every reveal fans out to them).
    const tokenOwners = new Map<string, string[]>();
    for (const s of profileSnaps) {
      if (!s.exists || !Array.isArray(s.get("fcmTokens"))) continue;
      for (const t of s.get("fcmTokens") as string[]) {
        // Rules cap the array at 10 entries but never check what is IN
        // them, so a client can store ten ~1MB strings in its own
        // (owner-writable) profile and we would hand them straight to
        // sendEachForMulticast. Bound length only — no format regex,
        // which is the part most likely to silently kill reveals for
        // everyone the day FCM changes its token shape.
        // NB: this bounds SEND cost, not what is stored.
        if (typeof t !== "string" || t.length < 20 || t.length > 4096) {
          logger.warn(`[reveal] skipping malformed fcmToken on ${s.id}`);
          continue;
        }
        const owners = tokenOwners.get(t) || [];
        owners.push(s.id);
        tokenOwners.set(t, owners);
      }
    }
    // CHUNKED, not truncated. This was `.slice(0, 64)`, which is below
    // what a full group can hold: GROUP_CAP (32) members x the 10 tokens
    // registerPushToken keeps each is 320. Past the 64th token — roughly
    // the 7th member with a couple of devices — members simply never heard
    // that the reveal was out, with nothing logged to say so. A silently
    // unnotified member is indistinguishable from a broken feature, and
    // reveals are the one push this product sends.
    //
    // 500 is FCM's own per-call ceiling for sendEachForMulticast, so today
    // every group fits in one call and the loop runs once. It is a loop
    // rather than a bare call so that raising GROUP_CAP or the token cap
    // stays a capacity question instead of quietly reintroducing the same
    // silent drop.
    const FCM_BATCH = 500;
    const tokens = [...tokenOwners.keys()];
    if (tokens.length) {
      // Prune tokens FCM says are gone for good. Only the two terminal
      // codes — transient errors must not evict a live device.
      const DEAD = new Set([
        "messaging/registration-token-not-registered",
        "messaging/invalid-registration-token",
      ]);
      const removals = new Map<string, string[]>(); // uid -> dead tokens
      for (let i = 0; i < tokens.length; i += FCM_BATCH) {
        const chunk = tokens.slice(i, i + FCM_BATCH);
        const res = await getMessaging().sendEachForMulticast({
          tokens: chunk,
          notification: {
            title: group.get("name") || "Your duel",
            body: mode === "duo"
              ? "Yesterday's answers are out — see if you called it."
              : "Yesterday's answers are revealed — see who said what.",
          },
          data: { kind: "reveal", gid, day: dayKey },
        });
        res.responses.forEach((r, j) => {
          if (r.success || !r.error || !DEAD.has(r.error.code)) return;
          for (const uid of tokenOwners.get(chunk[j]) || []) {
            const dead = removals.get(uid) || [];
            dead.push(chunk[j]);
            removals.set(uid, dead);
          }
        });
      }
      await Promise.all([...removals].map(([uid, dead]) =>
        db.doc(`v2_users/${uid}`)
          .update({ fcmTokens: FieldValue.arrayRemove(...dead) })
          .catch(() => { /* best-effort cleanup */ }),
      ));
    }
  } catch (err) {
    logger.warn(`[v2social] push for ${gid}/${dayKey} failed:`, err);
  }
  return true;
}

async function runDuelReveals(dayKey?: string): Promise<{ revealed: number }> {
  const db = getFirestore();
  const yester = dayKey || utcDayKey(-1);
  // Full-collection scan, PAGINATED. A `lastCheckedDay != yester` filter
  // would be cheaper, but Firestore's != EXCLUDES docs missing the field —
  // every never-checked (incl. freshly created) group would silently drop
  // out — and "!= OR missing" isn't expressible in one query. So the full
  // scan stays; what changed is that it no longer stops at one page.
  //
  // It used to fetch GROUP_SCAN_CAP docs and process them one at a time.
  // The 60s timeout bound at roughly 200-400 active groups — an order of
  // magnitude below the cap — so the function died mid-loop and re-walked
  // the same prefix on every run, with nothing but a log line saying why.
  //
  // Lanes: 5, not 10. The timeout raise is already 8x, and each reveal can
  // fan out to 64 FCM tokens; more lanes buys throughput this does not need
  // and multiplies peak memory and messaging concurrency.
  const LANES = 5;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let revealed = 0;
  let scanned = 0;

  for (;;) {
    let q = db.collection("v2_groups").orderBy("__name__").limit(PAGE_SIZE);
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
    if (scanned >= GROUP_SCAN_CAP) {
      logger.error(
        `[v2social] scanned ${scanned} groups in one run (ceiling ` +
          `${GROUP_SCAN_CAP}). Groups beyond this are NOT checked this run; ` +
          "their reveals land on a later run at best. Time to switch to an " +
          "indexed lastCheckedDay query or shard the scan.",
      );
      break;
    }
  }

  logger.info(`[v2social] reveals for ${yester}: ${revealed}`);
  return { revealed };
}

export const scheduledDuelReveals = onSchedule(
  { schedule: "every 120 minutes", region: REGION }, // ≤2h reveal delay, half the scans
  async () => {
    await runDuelReveals();
  },
);

// Test/ops hook — emulator, or the SEED_ADMIN_UIDS operators.
export const revealDuelsNowV2 = onCall({ region: REGION }, async (request) => {
  assertOperator(request);
  const dayKey = typeof request.data?.day === "string" ? request.data.day : undefined;
  return runDuelReveals(dayKey);
});

// Right-to-erasure e2e — runs under
//   firebase emulators:exec --only auth,firestore,functions
//
// deleteAccount is ~165 lines across six wipe phases behind a button that
// says "there is no undo", with store-review and GDPR exposure if any phase
// under-deletes. It had no test of any kind.
//
// Two design choices matter:
//
//  1. Leftovers are observed with firebase-admin, which BYPASSES rules.
//     Checking as another signed-in user cannot tell "deleted" from
//     "permission-denied" — that version of this test would pass against a
//     deleteAccount that deleted nothing at all.
//
//  2. Every assertion is preceded by a positive check that the data was
//     really there first. A wipe test that seeds nothing passes trivially.
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
// firebase-admin 14 is ESM-modular: there is no namespace default export,
// so `admin.firestore()` is not a function. Import the entry points.
import { initializeApp as adminInit } from "firebase-admin/app";
import { getFirestore as adminFirestore } from "firebase-admin/firestore";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { getStorage as adminStorage } from "firebase-admin/storage";
// The region the EMULATOR serves, taken from the functions' own compiled
// output rather than repeated here (D201). `pretest:e2e` builds it, so
// this harness cannot be pointed at a region the emulator is not on.
import { FUNCTIONS_REGION } from "../functions/lib/ops.js";

// The named database (D165). The backend writes to FIRESTORE_DB_ID, so a
// harness on `(default)` reads an empty database and reports a phantom
// failure — which is exactly what happened the first time this ran, and is
// the same split brain the deploy has to avoid. One constant, same env var
// as functions/src/db.ts.
const E2E_DB_ID = process.env.FIRESTORE_DB_ID || "insight";

const PROJECT = "demo-insight";

const fail = (msg) => { console.error("✗ " + msg); process.exit(1); };
const ok = (msg) => console.log("✓ " + msg);

// ── admin (rules bypassed) — the only trustworthy observer here ──
// The bucket has to be NAMED (D178). A demo project has no default one
// to infer, and `bucket()` throws `storage/invalid-argument` rather than
// guessing — which is the right behaviour and an easy half-hour if you
// read it as "the emulator is broken".
adminInit({ projectId: PROJECT, storageBucket: `${PROJECT}.appspot.com` });
// The ADMIN handle needs the database too, and this is the one that got
// missed first time round: it takes no argument, so it reads as fine and
// silently targets `(default)`. It then wrote the question doc to one
// database while the client wrote the answer to another, and the rules'
// get() on the missing question denied the write — a null-value error
// four layers from the actual mistake.
const adb = adminFirestore(E2E_DB_ID);
const aauth = adminAuth();

const exists = async (path) => (await adb.doc(path).get()).exists;
const mustExist = async (path, label) => {
  if (!(await exists(path))) fail(`setup: ${label} was never created (${path})`);
};
const mustBeGone = async (path, label) => {
  if (await exists(path)) fail(`LEFTOVER after deleteAccount: ${label} (${path})`);
};

// ── client (the real path a user takes) ──
const app = initializeApp({ projectId: PROJECT, apiKey: "demo", appId: "demo" });
const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app, E2E_DB_ID); connectFirestoreEmulator(db, "127.0.0.1", 8080);
const fns = getFunctions(app, FUNCTIONS_REGION); connectFunctionsEmulator(fns, "127.0.0.1", 5001);

const cred = await signInAnonymously(auth);
const uid = cred.user.uid;
ok("signed in: " + uid.slice(0, 8));

const OTHER = "other-user-1";
const DAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const SOLO = "grp_solo";
const SHARED = "grp_shared";
// A group this account LEAVES before deleting. Phase 1c queries groups by
// `memberUids array-contains uid`, so a left group is invisible to it — and
// leaveGroupV2 does not rewrite reveals, by design. Everything the account
// left behind in this group's reveals therefore survived erasure until the
// collection-group sweep (phase 1c-bis) went looking for it directly.
const LEFT = "grp_left";

// ── seed every phase deleteAccount claims to wipe ──
// Written with admin, because most of these paths are no longer
// client-writable (the v1 surface was retired in D4) — but deleteAccount
// still has to clean them up for accounts that predate that.
await adb.doc(`v2_users/${uid}`).set({ displayName: "Doomed", anon: true });
await adb.doc(`v2_users/${uid}/answers/daily-000`).set({ qid: "daily-000", optionIdx: 1 });
// A learn first attempt (D32) lives in the same answers subcollection —
// erasure must cover it identically, and this seed is what proves the
// claim instead of assuming the recursiveDelete reaches it.
await adb.doc(`v2_users/${uid}/answers/learn-cell1`).set({ qid: "learn-cell1", surface: "learn", optionIdx: 2 });
// The verified-logic attempt doc (D57) sits in its own top-level
// collection keyed by uid — outside the subtree recursiveDelete reaches —
// so erasure needs (and has) a dedicated phase, proven here.
await adb.doc(`v2_logic_attempts/${uid}`).set({ seed: 7, gv: 2, status: "scored", score: 9 });
await adb.doc(`insight_users/${uid}`).set({ sharePrefs: {} });
await adb.doc(`insight_users/${uid}/insight_daily/${DAY}`).set({ date: DAY, mood: 60 });
await adb.doc(`insight_discoverable/${uid}`).set({ location: { geohash: "u4pru" } });
await adb.doc(`insight_ratelimits/${uid}`).set({ events: [] });
await adb.doc(`v2_ratelimits/join_${uid}`).set({ events: [] });

// Agg-event ledger entries (D28): each says "this uid answered this qid at
// this time" — the attribution that keeps aggregates correctable, and
// therefore data erasure must reach. One synthetic entry for the doomed
// account; one for OTHER as the control, because the sweep is a uid query
// and a sweep that took the whole ledger would destroy the correction
// record for every account that still exists.
await adb.doc(`v2_agg_events/evt_mine`).set({ qid: "daily-000", uid });
await adb.doc(`v2_agg_events/evt_theirs`).set({ qid: "daily-000", uid: OTHER });

// cross-user leftovers: data ABOUT the deleted user, living under others
await adb.doc(`insight_users/${OTHER}/insight_inbound_impressions/i1`)
  .set({ senderUid: uid, traits: ["kind"], createdAt: 1 });
await adb.doc(`insight_users/${OTHER}/relations/r1`).set({ linkedUid: uid });
// The follow graph, both directions (D101). The account's OWN follow goes
// with its v2 subtree in phase 1b; the inbound one lives under someone
// else's uid and needs phase 3b's collection-group sweep to find it —
// which is the whole reason the row carries `to` as a field, since a
// collection-group query cannot filter on a document id.
// Foresight verdicts (D126) live under the account's own subtree, so
// phase 1b's recursive delete is what takes them — the same property the
// push and following subcollections rely on. Seeded so "covered by the
// subtree wipe" is a tested claim rather than an assumed one.
await adb.doc(`v2_users/${uid}/foresight/daily-000__ageBand__25-34`).set({
  qid: "daily-000", dim: "ageBand", bucket: "25-34", guess: 0, answerIdx: 0, n: 20, at: new Date(),
});
// The engagement subtree (D268/D272): the digest's bookkeeping pair and a
// person rollup, both under the account's own subtree — phase 1b's
// recursive delete is what takes them, and seeding both makes "covered by
// the subtree wipe" a tested claim rather than an assumed one (the
// foresight row's reasoning, one collection over). The OTHER control
// below proves the wipe is the account's, not the collection's.
await adb.doc(`v2_users/${uid}/engagement/_state`).set({
  firstDay: "2026-08-01", lastDay: "2026-08-22", activeDays: 9, streak: 2, fg7: [2, 3, 2],
});
await adb.doc(`v2_users/${uid}/engagement/2026-08-22`).set({
  day: "2026-08-22", sessions: 2, fgMin: 2, quiet: 1, dayparts: [0, 1, 1, 0],
  answers: 3, feedB: 2, depthEnd: 0, stops: 4, lenses: 1, folded: false,
  build: 24, platform: "web", expireAt: new Date(Date.now() + 90 * 86400000),
});
await adb.doc(`v2_users/${OTHER}/engagement/2026-08-22`).set({
  day: "2026-08-22", sessions: 1, fgMin: 1, quiet: 0, dayparts: [1, 0, 0, 0],
  answers: 1, feedB: 1, depthEnd: 0, stops: 0, lenses: 0, folded: false,
  build: 24, platform: "web", expireAt: new Date(Date.now() + 90 * 86400000),
});
await adb.doc(`v2_users/${uid}/following/${OTHER}`).set({ to: OTHER, at: new Date() });
await adb.doc(`v2_users/${OTHER}/following/${uid}`).set({ to: uid, at: new Date() });
// The control: OTHER's follow of a third party must survive. A sweep that
// took the whole subcollection instead of the matching rows would empty
// every follower's Circle on any deletion, and would look identical to a
// correct one from the deleted account's side.
await adb.doc(`v2_users/${OTHER}/following/third_party`).set({ to: "third_party", at: new Date() });

// Handles and invitations (D122). Three shapes, and only the first is
// reachable by phase 1b's recursiveDelete of the profile:
//
//   · the handle registry row is keyed by the NAME, not the uid, so it
//     lives outside the profile subtree entirely — and leaving it means
//     the name stays unclaimable forever for an account that is gone;
//   · an invitation TO this account sits under someone else's group;
//   · an invitation FROM this account sits in a stranger's inbox with
//     this account's display name on it, which is the half that outlives
//     an erasure most visibly.
await adb.doc("v2_handles/erasable").set({ uid, at: new Date() });
// The people directory row (D239). Keyed by uid but TOP-LEVEL, so the
// profile subtree's recursive delete walks past it — the same trap the
// handle registry sets, and worse if missed: this row holds a NAME, so
// leaving it means an erased account stays findable by the search the
// feature exists to provide.
await adb.doc(`v2_people/${uid}`).set({ name: "Erasable", nameKey: "erasable", handle: "erasable" });
await adb.doc(`v2_groups/${SHARED}/invites/${uid}`).set({
  to: uid, from: OTHER, fromName: "Other", groupName: "Shared", mode: "group", at: new Date(),
});
await adb.doc(`v2_groups/${SHARED}/invites/third_party`).set({
  to: "third_party", from: uid, fromName: "Mine", groupName: "Shared", mode: "group", at: new Date(),
});
// Two controls, same shape as the follow one above: another account's
// handle, and an invitation between two other people in a circle this
// account was in. A sweep that took the collection rather than the
// matching rows would look correct from the deleted side and be a
// catastrophe from everyone else's.
await adb.doc("v2_handles/somebodyelse").set({ uid: OTHER, at: new Date() });
await adb.doc(`v2_people/${OTHER}`).set({ name: "Other", nameKey: "other" });
await adb.doc(`v2_groups/${SHARED}/invites/fourth_party`).set({
  to: "fourth_party", from: OTHER, fromName: "Other", groupName: "Shared", mode: "group", at: new Date(),
});

// a group only they belong to → should be removed outright
await adb.doc(`v2_groups/${SOLO}`).set({
  name: "Solo", mode: "group", ownerUid: uid, memberUids: [uid], streak: 0,
});
await adb.doc(`v2_groups/${SOLO}/reveals/${DAY}`).set({
  day: DAY, qid: "group-gu0", votes: { [uid]: { optionIdx: 1 } }, names: { [uid]: "Doomed" },
  members: [uid],
});

// a group shared with someone else → must SURVIVE, scrubbed of them
//
// `ownerUid` is the DOOMED account deliberately. It used to be OTHER here,
// which is the reason this suite could not see that erasure never removed
// the field: the group the assertions run against was owned by the surviving
// member, so there was nothing of the deleted user's left in it to miss. A
// creator deleting their account is the ordinary case, not the exotic one.
await adb.doc(`v2_groups/${SHARED}`).set({
  name: "Shared", mode: "group", ownerUid: uid, memberUids: [uid, OTHER], streak: 3,
});
// A circle this account ASKED to join and was never let into (D240).
// Invisible to the membership sweep by definition — that phase matches on
// memberUids, and the whole point of a pending request is that the asker
// is not in it. The name is the leak: an erased account would sit in a
// stranger's circle, by name, waiting to be approved forever.
const WAITED = "grp_waited";
await adb.doc(`v2_groups/${WAITED}`).set({
  name: "Waited", mode: "group", ownerUid: OTHER, memberUids: [OTHER], streak: 0,
  // A control alongside: another asker, whose request must survive.
  pending: [uid, "third_party"],
  pendingNames: { [uid]: "Doomed", third_party: "Someone Else" },
});
await adb.doc(`v2_groups/${SHARED}/reveals/${DAY}`).set({
  day: DAY, qid: "group-gu0",
  votes: { [uid]: { optionIdx: 1 }, [OTHER]: { optionIdx: 0 } },
  names: { [uid]: "Doomed", [OTHER]: "Survivor" },
  // The membership snapshot the reveal read rule gates on. Seeded here
  // because erasure has to reach it too — it is a uid, and it carries the
  // fact that this account played in this group on this day.
  members: [uid, OTHER],
});

// a group they LEAVE before deleting — the group survives with the other
// member, and the reveal keeps naming them until erasure reaches it
await adb.doc(`v2_groups/${LEFT}`).set({
  name: "Left", mode: "group", ownerUid: OTHER, memberUids: [uid, OTHER],
  memberNames: { [uid]: "Doomed", [OTHER]: "Survivor" }, streak: 5,
});
await adb.doc(`v2_groups/${LEFT}/reveals/${DAY}`).set({
  day: DAY, qid: "group-gu0",
  votes: { [uid]: { optionIdx: 1 }, [OTHER]: { optionIdx: 0 } },
  names: { [uid]: "Doomed", [OTHER]: "Survivor" },
  members: [uid, OTHER],
});

// takes, flags, and the moderation queue's COPY of a take's text
// (docs/MODERATION.md). The queue is the interesting one: moderation.ts
// copies the text in so the run reads one collection, which means deleting
// the take does not delete the words — they sat there until the next 05:00
// rebuild. Seeded with admin like everything else here; driving the real
// flag→queue pipeline is the moderation e2e's job, not this file's.
const MY_TAKE = "take_mine";
const THEIR_TAKE = "take_theirs";
await adb.doc(`v2_takes/${MY_TAKE}`).set({
  gid: SHARED, authorUid: uid, qid: "q1", text: "words that must not outlive the account",
});
await adb.doc(`v2_flags/${MY_TAKE}_${uid}`).set({ takeId: MY_TAKE, gid: SHARED, uid });

// question suggestions (docs/NEXT-FUNCTIONALITY.md §6): free text keyed to
// the account, plus the budget ledger the callable keeps. OTHER's row is
// the control — the sweep queries on uid and must not take the queue with
// it. Seeded with admin like the takes; the callable's own behaviour is
// the loop e2e's job.
await adb.doc(`v2_suggestions/${uid}_e2e`).set({
  uid, prompt: "a suggestion that must not outlive the account",
  type: "binary", options: ["a", "b"], topicHint: null, audienceHint: null,
  cadenceHint: null, credit: false, status: "review", at: new Date(),
});
await adb.doc(`v2_suggestions/${OTHER}_e2e`).set({
  uid: OTHER, prompt: "someone else's suggestion",
  type: "binary", options: ["a", "b"], topicHint: null, audienceHint: null,
  cadenceHint: null, credit: false, status: "review", at: new Date(),
});
await adb.doc(`v2_ratelimits/suggest_${uid}`).set({ events: [Date.now()] });
// The presence doc (D84): the one location-shaped datum an account can
// hold, and the wipe must take it — a cell that outlives its account is a
// standing "someone was here" nobody can retract.
// The profile photo (D178), both halves. The document is ordinary; the
// OBJECT is the first thing deleteAccount has ever had to remove from
// Storage, and the reason storage.rules could keep its retired read grant
// was precisely that erasure did not reach the bucket.
await adb.doc(`v2_avatars/${uid}`).set({ token: "tok0e2e0000", at: new Date(), hidden: false });
await adminStorage().bucket().file(`avatars/${uid}`).save(Buffer.from([0xff, 0xd8, 0xff]), {
  contentType: "image/jpeg",
});
// SEEDED, AND PROVED SEEDED. An object that never landed makes the
// "it is gone afterwards" check below pass for the wrong reason — the
// vacuous shape this suite exists to avoid, and one a Storage handle
// pointed at the wrong bucket produces silently.
if (!(await adminStorage().bucket().file(`avatars/${uid}`).exists())[0]) {
  fail("seed did not land: avatars/" + uid + " is not in the bucket");
}
await adb.doc(`v2_presence/${uid}`).set({
  cell: "5999_1074", at: new Date(), until: new Date(Date.now() + 60 * 60_000),
});
// …and the ROOM CACHE for that cell (D177), which is the one derived
// document that holds a uid. A roster naming this account survives the
// presence delete on its own — it is keyed by cell, not by uid — so the
// wipe reads the cell and drops the fold with it. Seeded with a stranger
// in it too, because what has to be proved is that the DOC goes, not that
// one entry was edited out of it: the next caller re-folds from presence,
// which no longer has this account in it.
await adb.doc("v2_presence_room/5999_1074").set({
  people: [{ uid, type: "Host" }, { uid: OTHER }], qs: {}, at: new Date(),
});
// …and a NEIGHBOUR's cache, which is where the sweep used to stop short.
// The cache is keyed by the caller's cell while its roster spans that
// cell's 3x3 block, and the block is symmetric — so this account is in
// the roster of all nine cells around it, not only its own. Deleting one
// left it named in eight, readable by anyone standing one cell over.
await adb.doc("v2_presence_room/6000_1075").set({
  people: [{ uid, type: "Host" }, { uid: OTHER }], qs: {}, at: new Date(),
});
// The control, two cells away: outside the block, so its roster cannot
// name this account and the sweep must not reach it.
await adb.doc("v2_presence_room/6002_1074").set({
  people: [{ uid: OTHER }], qs: {}, at: new Date(),
});
await adb.doc(`v2_mod_queue/${MY_TAKE}`).set({
  takeId: MY_TAKE, gid: SHARED, text: "words that must not outlive the account",
  flags: 3, escalations: 0,
});
// The control. Somebody ELSE's take, queued the same way, plus this
// account's flag ON it. The flag is theirs to lose; the take and its queue
// entry are not — a sweep that took the whole queue would pass every
// assertion below without this pair.
await adb.doc(`v2_takes/${THEIR_TAKE}`).set({
  gid: SHARED, authorUid: OTHER, qid: "q1", text: "someone else's words",
});
await adb.doc(`v2_flags/${THEIR_TAKE}_${uid}`).set({ takeId: THEIR_TAKE, gid: SHARED, uid });
await adb.doc(`v2_mod_queue/${THEIR_TAKE}`).set({
  takeId: THEIR_TAKE, gid: SHARED, text: "someone else's words", flags: 3, escalations: 1,
});
// The second control, and it is a different SHAPE rather than a second
// instance of the first. Avatars are moderated through this same queue
// (D178) under an `av_<uid>` target id, and `v2_takes/av_<uid>` can never
// exist — so a sweep that asks v2_takes about every entry reads every
// queued face as an orphan and takes it, whoever is deleting. Accounts
// are free (D3), so that is a flagged photo kept out of moderation
// indefinitely by a throwaway, once a day, for as long as it is reported.
const THEIR_FACE = `av_${OTHER}`;
await adb.doc(`v2_avatars/${OTHER}`).set({ token: "tok0e2e0001", at: new Date(), hidden: false });
await adb.doc(`v2_mod_queue/${THEIR_FACE}`).set({
  takeId: THEIR_FACE, kind: "avatar", gid: null, text: null, flags: 3, escalations: 0,
});

// One client-authored write, so the test also covers the real path.
//
// The question is SEEDED first and the write is no longer swallowed. Without
// the seed, isWorldAnswer()'s get() on the missing question denied this every
// run — the repo asserts that exact shape itself in rules.test.ts — and the
// .catch() ate it, so the row below asserted the absence of a document that
// had never existed. The file's own header says this leg covers the real
// path; it did not.
await adb.doc("v2_questions/client-written").set({
  surface: "daily", seq: 9001, type: "vote", prompt: "client-written probe",
  options: ["a", "b"], active: true,
});
await setDoc(doc(db, "v2_users", uid, "answers", "client-written"), {
  qid: "client-written", surface: "daily", optionIdx: 0,
  answeredAt: serverTimestamp(), anchors: {},
});

// prove the setup actually landed, or the wipe assertions are vacuous
for (const [path, label] of [
  [`v2_users/${uid}`, "v2 profile"],
  [`v2_users/${uid}/answers/daily-000`, "v2 answer"],
  [`v2_users/${uid}/answers/learn-cell1`, "learn answer (D32)"],
  [`v2_logic_attempts/${uid}`, "verified logic attempt (D57)"],
  [`insight_users/${uid}`, "v1 profile"],
  [`insight_discoverable/${uid}`, "discoverable doc"],
  [`insight_ratelimits/${uid}`, "v1 rate-limit ledger"],
  [`v2_ratelimits/join_${uid}`, "v2 join throttle"],
  [`insight_users/${OTHER}/insight_inbound_impressions/i1`, "impression they sent"],
  [`insight_users/${OTHER}/relations/r1`, "relation naming them"],
  [`v2_groups/${SOLO}`, "solo group"],
  [`v2_groups/${SHARED}`, "shared group"],
  [`v2_groups/${LEFT}`, "the group they will leave"],
  [`v2_groups/${LEFT}/reveals/${DAY}`, "that group's reveal"],
  [`v2_takes/${MY_TAKE}`, "their take"],
  [`v2_flags/${MY_TAKE}_${uid}`, "their flag on their own take"],
  [`v2_avatars/${uid}`, "their profile photo's document"],
  [`v2_presence/${uid}`, "their presence cell"],
  ["v2_presence_room/5999_1074", "the cached roster naming them"],
  ["v2_presence_room/6000_1075", "a NEIGHBOUR cell's cached roster naming them"],
  [`v2_mod_queue/${MY_TAKE}`, "the queue's copy of their take"],
  [`v2_takes/${THEIR_TAKE}`, "someone else's take"],
  [`v2_mod_queue/${THEIR_TAKE}`, "the queue's copy of someone else's take"],
  [`v2_agg_events/evt_mine`, "their agg-ledger entry"],
  [`v2_agg_events/evt_theirs`, "someone else's agg-ledger entry"],
  [`v2_suggestions/${uid}_e2e`, "their question suggestion"],
  [`v2_suggestions/${OTHER}_e2e`, "someone else's question suggestion"],
  [`v2_ratelimits/suggest_${uid}`, "their suggestion budget ledger"],
]) await mustExist(path, label);
ok("seeded every wipe phase, and verified it landed");

// The seeded daily-000 answer fires the REAL onV2AnswerCreated, so besides
// the synthetic entries above there is an organic ledger entry keyed by an
// event id nobody here knows. Wait for it, for two reasons: it proves the
// trigger actually stamps uid (the property the sweep's query stands on —
// a synthetic seed alone would pass against a trigger that stopped writing
// it), and letting it land BEFORE deleteAccount keeps this test off the
// known in-flight race D28 records (an answer folding after the sweep
// leaves an entry until TTL).
const myLedgerEntries = async () =>
  (await adb.collection("v2_agg_events").where("uid", "==", uid).get()).docs;
let organic = null;
for (let i = 0; i < 30 && !organic; i++) {
  organic = (await myLedgerEntries())
    .find((d) => d.id !== "evt_mine" && d.get("qid") === "daily-000") || null;
  if (!organic) await new Promise((r) => setTimeout(r, 400));
}
if (!organic) fail("the answer trigger never wrote a uid-attributed ledger entry");
if (!organic.get("expireAt")) fail("organic ledger entry has no expireAt — the TTL policy would never collect it");
ok("the real trigger attributed the answer: uid + qid + expireAt in the ledger");

// ── leave a group first, through the real callable ──
// This is the setup for the gap this leg exists for, and it is driven
// rather than seeded on purpose: a hand-written "left" state would pass
// against a leaveGroupV2 that scrubs reveals, and against one that removes
// nothing at all. It is also the only coverage leaveGroupV2 has.
await httpsCallable(fns, "leaveGroupV2")({ gid: LEFT });
const leftGroup = await adb.doc(`v2_groups/${LEFT}`).get();
if (!leftGroup.exists) fail("leaveGroupV2 deleted a group that still had another member");
if ((leftGroup.get("memberUids") || []).includes(uid)) fail("leaveGroupV2 did not remove the membership");
if ((leftGroup.get("memberNames") || {})[uid]) fail("leaveGroupV2 left the display name in memberNames");
// The other half of the contract, asserted so a future change that starts
// scrubbing reveals on leave has to come here and argue with it: leaving is
// not an erasure request, and a reveal is several people's record of a day
// they all played. Leaving must NOT rewrite it.
const leftReveal = await adb.doc(`v2_groups/${LEFT}/reveals/${DAY}`).get();
if (!(leftReveal.get("names") || {})[uid])
  fail("leaveGroupV2 rewrote a past reveal — leaving is not erasure (see index.ts phase 1c-bis)");
ok("left a group: membership gone, the shared reveal deliberately untouched");

// ── the call under test ──
const res = await httpsCallable(fns, "deleteAccount")({});
if (!res.data?.ok) fail("deleteAccount did not report ok: " + JSON.stringify(res.data));
ok("deleteAccount returned ok — now checking whether that is true");

// ── the auth user itself must be gone ──
let stillThere = true;
try {
  await aauth.getUser(uid);
} catch (e) {
  if (e?.code !== "auth/user-not-found") fail("unexpected auth error: " + e?.code);
  stillThere = false;
}
if (stillThere) fail("the auth user still exists after deleteAccount");
ok("auth user is gone");

// ── every seeded phase must be gone ──
for (const [path, label] of [
  [`v2_users/${uid}`, "v2 profile"],
  [`v2_users/${uid}/answers/daily-000`, "v2 answer (subcollection)"],
  [`v2_users/${uid}/answers/learn-cell1`, "learn answer (subcollection, D32)"],
  [`v2_users/${uid}/answers/client-written`, "client-written answer"],
  [`v2_logic_attempts/${uid}`, "verified logic attempt (D57)"],
  [`insight_users/${uid}`, "v1 profile"],
  [`insight_users/${uid}/insight_daily/${DAY}`, "v1 daily report (subcollection)"],
  [`insight_discoverable/${uid}`, "discoverable doc"],
  [`insight_ratelimits/${uid}`, "v1 rate-limit ledger"],
  [`v2_ratelimits/join_${uid}`, "v2 join throttle"],
  [`insight_users/${OTHER}/insight_inbound_impressions/i1`, "impression they sent to someone else"],
  [`insight_users/${OTHER}/relations/r1`, "relation naming them in someone else's subtree"],
  [`v2_groups/${SOLO}`, "group they were the only member of"],
  [`v2_groups/${SOLO}/reveals/${DAY}`, "that group's reveal"],
  [`v2_takes/${MY_TAKE}`, "their take"],
  [`v2_flags/${MY_TAKE}_${uid}`, "their flag on their own take"],
  [`v2_flags/${THEIR_TAKE}_${uid}`, "their flag on someone else's take"],
  [`v2_users/${uid}/following/${OTHER}`, "the account's own follow"],
  [`v2_users/${uid}/foresight/daily-000__ageBand__25-34`, "a foresight verdict"],
  [`v2_users/${uid}/engagement/_state`, "the digest's bookkeeping pair (D268)"],
  [`v2_users/${uid}/engagement/2026-08-22`, "a person-channel day rollup (D272)"],
  [`v2_users/${OTHER}/following/${uid}`, "someone else's follow OF this account"],
  [`v2_avatars/${uid}`, "their profile photo's document"],
  [`v2_presence/${uid}`, "their presence cell"],
  ["v2_presence_room/5999_1074", "the cached roster naming them"],
  ["v2_presence_room/6000_1075", "a NEIGHBOUR cell's cached roster naming them"],
  // The gap this leg exists for: the take was erased, and its words went on
  // living in the moderation queue's copy of them.
  [`v2_mod_queue/${MY_TAKE}`, "the queue's copy of their take"],
  [`v2_suggestions/${uid}_e2e`, "their question suggestion (phase 4d)"],
  [`v2_ratelimits/suggest_${uid}`, "their suggestion budget ledger"],
  [`v2_agg_events/evt_mine`, "their agg-ledger entry"],
  ["v2_handles/erasable", "their handle — the name goes back into circulation"],
  [`v2_people/${uid}`, "their directory row — an erased account stops being findable by name"],
  [`v2_groups/${SHARED}/invites/${uid}`, "an invitation TO them, under someone else's circle"],
  [`v2_groups/${SHARED}/invites/third_party`, "an invitation FROM them, carrying their name"],
]) await mustBeGone(path, label);

// …including the organic entry, whose id nobody knows — so ask by query,
// the way the sweep itself does. Anything left here is an erased account
// still attributable in the aggregate record.
if ((await myLedgerEntries()).length !== 0)
  fail("agg-ledger entries for the deleted uid survive the sweep");
ok("every owned document, subcollection and cross-user reference is gone");

// THE BYTES, not only the document (D178). The photo is the app's first
// object in Storage and the first thing erasure has ever had to reach
// outside Firestore — a face outliving the account it belonged to is the
// leftover this whole suite is written against, and it is the one no
// Firestore query would ever notice.
const [avatarStillThere] = await adminStorage().bucket()
  .file(`avatars/${uid}`).exists();
if (avatarStillThere) fail("LEFTOVER after deleteAccount: the profile photo's bytes (avatars/" + uid + ")");
ok("the profile photo's bytes are gone from Storage too");

// ── …and the sweep stopped at the edge of this account ──
// deleteOrphanedModQueue keys on the take being ABSENT rather than on an
// author, which is what lets it run without an authorUid in the queue — and
// is exactly why it needs a control. Someone else's queued take is still
// flagged, still visible, and still owed a verdict.
const theirQueued = await adb.doc(`v2_mod_queue/${THEIR_TAKE}`).get();
if (!theirQueued.exists) fail("the sweep took the whole queue, not just the orphans");
if (theirQueued.get("text") !== "someone else's words") fail("someone else's queued take was altered");
if (theirQueued.get("escalations") !== 1) fail("someone else's escalation count was lost");
if (!(await exists(`v2_takes/${THEIR_TAKE}`))) fail("someone else's take was deleted");
ok("someone else's take, its queue entry and its escalation count survive untouched");
// …and the same for a queued FACE, which is the entry the sweep could not
// find in v2_takes because it was never going to be there.
const theirFace = await adb.doc(`v2_mod_queue/${THEIR_FACE}`).get();
if (!theirFace.exists) fail("the sweep took a queued avatar report — av_ ids are not take ids");
if (theirFace.get("flags") !== 3) fail("a queued avatar report's flag count was altered");
if (!(await exists(`v2_avatars/${OTHER}`))) fail("someone else's profile photo was deleted");
ok("a queued avatar report on someone else survives an unrelated erasure");
if (!(await exists(`v2_suggestions/${OTHER}_e2e`)))
  fail("someone else's suggestion was deleted — the sweep matched more than the uid");
ok("someone else's question suggestion survives");
if (!(await exists(`v2_users/${OTHER}/engagement/2026-08-22`)))
  fail("someone else's engagement rollup was deleted — the wipe took the collection, not the account");
ok("someone else's engagement rollup survives (D272)");

// The presence sweep's own edge: nine cells, and only nine. A cache two
// cells away cannot name this account — it is outside the 3x3 block the
// roster folds over — so reaching it would be the sweep taking a roster
// it has no claim on.
if (!(await exists("v2_presence_room/6002_1074")))
  fail("the presence sweep reached beyond the 3x3 block around the cell");
ok("a room cache outside the neighbourhood is left alone");

// The ledger sweep is a uid query, and this is why it has to be: another
// account's attribution record must outlive this deletion, or one erasure
// destroys the correction record (D28) for everyone.
if (!(await exists(`v2_agg_events/evt_theirs`))) fail("someone else's agg-ledger entry was swept");
// And the tally the answer fed stays, per 1b's standing decision: erasure
// removes the ATTRIBUTION, not the aggregate. Once the ledger entry is
// gone the count names nobody — which is the whole of what erasure owes
// here, and is why the doc below is expected to survive rather than to be
// decremented.
//
// v2_question_aggs, not v2_aggs_private: a daily answer's tally IS the
// published document now. The private mirror this line used to name was
// byte-identical to it and is no longer written on this path (see the
// header of functions/src/v2.ts) — so asserting on it would have been
// asserting that a document nothing writes is still absent.
if (!(await exists(`v2_question_aggs/daily-000`))) fail("erasure destroyed the aggregate tally itself");
ok("someone else's ledger entry and the anonymous tally both survive");

// The follow sweep stopped at the rows that named this uid.
if (!(await exists(`v2_users/${OTHER}/following/third_party`)))
  fail("the follow sweep took someone else's whole following list, not just the rows pointing here");
ok("someone else's other follows survive — the sweep matched on `to`, not on the collection");

// The same control for D122's two sweeps.
if (!(await exists(`v2_people/${OTHER}`)))
  fail("the directory sweep took another account's row");
if (!(await exists("v2_handles/somebodyelse")))
  fail("the handle sweep took another account's handle — it matched the collection, not the uid");
if (!(await exists(`v2_groups/${SHARED}/invites/fourth_party`)))
  fail("the invite sweep took an invitation between two other people");
ok("another account's handle and other people's invitations survive");

// ── the shared group survives, scrubbed ──
// The queue in a circle they never got into (D240).
const waited = await adb.doc(`v2_groups/${WAITED}`).get();
if (!waited.exists) fail("the WAITED group was deleted — the account was never a member of it");
if ((waited.get("pending") || []).includes(uid)) fail("the erased account is still queued to join");
if ((waited.get("pendingNames") || {})[uid]) fail("the erased account's name survives in a join queue");
if (!(waited.get("pending") || []).includes("third_party")) {
  fail("the queue sweep took another account's request");
}
if (!(waited.get("pendingNames") || {}).third_party) {
  fail("the queue sweep took another account's name");
}
ok("their pending join request is gone; somebody else's survives");

const shared = await adb.doc(`v2_groups/${SHARED}`).get();
if (!shared.exists) fail("the SHARED group was deleted — it still had another member");
const members = shared.get("memberUids") || [];
if (members.includes(uid)) fail("deleted uid still in the shared group's memberUids");
if (!members.includes(OTHER)) fail("the surviving member was removed from the shared group");
// The field nothing reads, which is why it outlived three erasure phases:
// firestore.rules serves the whole group document to every current member,
// so a leftover ownerUid publishes the deleted account's raw uid to the
// circle forever.
if (shared.get("ownerUid") === uid) fail("the deleted user's uid survives as the shared group's ownerUid");
if (shared.get("name") !== "Shared") fail("erasure damaged the surviving group's own fields");

const reveal = await adb.doc(`v2_groups/${SHARED}/reveals/${DAY}`).get();
if (!reveal.exists) fail("the shared group's reveal was deleted wholesale");
const votes = reveal.get("votes") || {};
const names = reveal.get("names") || {};
const revealMembers = reveal.get("members") || [];
if (votes[uid]) fail("the deleted user's vote survives in a shared reveal");
if (names[uid]) fail("the deleted user's display name survives in a shared reveal");
// The membership snapshot is a uid like any other. It is also the array
// the reveal read rule gates on, so this assertion doubles as a check that
// scrubbing it did not cost the SURVIVING member their access.
if (revealMembers.includes(uid)) fail("the deleted uid survives in a reveal's members snapshot");
if (!revealMembers.includes(OTHER)) fail("the surviving member lost their reveal read access");
if (!votes[OTHER]) fail("the surviving member's vote was scrubbed too");
ok("shared group survives; the deleted user's vote, name and membership entry were scrubbed");

// ── and the group they had already LEFT is scrubbed too ──
// The regression this leg exists for. Phase 1c cannot see this group — the
// account is not in its memberUids any more — so before the collection-group
// sweep every assertion below failed: name, vote and the members entry all
// survived the erasure, readable by whoever stayed in the group.
const leftAfter = await adb.doc(`v2_groups/${LEFT}`).get();
if (!leftAfter.exists) fail("the LEFT group was deleted — it still had another member");
if (!(leftAfter.get("memberUids") || []).includes(OTHER))
  fail("the surviving member was removed from the group the deleted user had left");

const leftRevealAfter = await adb.doc(`v2_groups/${LEFT}/reveals/${DAY}`).get();
if (!leftRevealAfter.exists) fail("the left group's reveal was deleted wholesale");
const lVotes = leftRevealAfter.get("votes") || {};
const lNames = leftRevealAfter.get("names") || {};
const lMembers = leftRevealAfter.get("members") || [];
if (lNames[uid]) fail("LEFTOVER: the deleted user's display name survives in a group they had left");
if (lVotes[uid]) fail("LEFTOVER: the deleted user's vote survives in a group they had left");
if (lMembers.includes(uid)) fail("LEFTOVER: the deleted uid survives in the members snapshot of a group they had left");
// The same control as the shared group: a sweep that took the whole reveal,
// or the whole members array, would pass every assertion above.
if (!lVotes[OTHER]) fail("the surviving member's vote was scrubbed from the left group's reveal");
if (!lNames[OTHER]) fail("the surviving member's name was scrubbed from the left group's reveal");
if (!lMembers.includes(OTHER)) fail("the surviving member lost read access to the left group's reveal");
ok("the group they had already left is scrubbed too — membership is not what erasure follows");

console.log("\nALL ERASURE CHECKS PASSED");
process.exit(0);

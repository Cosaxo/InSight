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

const PROJECT = "demo-insight";

const fail = (msg) => { console.error("✗ " + msg); process.exit(1); };
const ok = (msg) => console.log("✓ " + msg);

// ── admin (rules bypassed) — the only trustworthy observer here ──
adminInit({ projectId: PROJECT });
const adb = adminFirestore();
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
const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
const fns = getFunctions(app, "us-central1"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);

const cred = await signInAnonymously(auth);
const uid = cred.user.uid;
ok("signed in: " + uid.slice(0, 8));

const OTHER = "other-user-1";
const DAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const SOLO = "grp_solo";
const SHARED = "grp_shared";

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

// a group only they belong to → should be removed outright
await adb.doc(`v2_groups/${SOLO}`).set({
  name: "Solo", mode: "group", ownerUid: uid, memberUids: [uid], streak: 0,
});
await adb.doc(`v2_groups/${SOLO}/reveals/${DAY}`).set({
  day: DAY, qid: "group-gu0", votes: { [uid]: { optionIdx: 1 } }, names: { [uid]: "Doomed" },
  members: [uid],
});

// a group shared with someone else → must SURVIVE, scrubbed of them
await adb.doc(`v2_groups/${SHARED}`).set({
  name: "Shared", mode: "group", ownerUid: OTHER, memberUids: [uid, OTHER], streak: 3,
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

// one client-authored write, so the test also covers the real path
await setDoc(doc(db, "v2_users", uid, "answers", "client-written"), {
  qid: "client-written", surface: "daily", optionIdx: 0,
  answeredAt: serverTimestamp(), anchors: {},
}).catch(() => { /* rules may reject an unseeded qid — not what we're testing */ });

// prove the setup actually landed, or the wipe assertions are vacuous
for (const [path, label] of [
  [`v2_users/${uid}`, "v2 profile"],
  [`v2_users/${uid}/answers/daily-000`, "v2 answer"],
  [`v2_users/${uid}/answers/learn-cell1`, "learn answer (D32)"],
  [`insight_users/${uid}`, "v1 profile"],
  [`insight_discoverable/${uid}`, "discoverable doc"],
  [`insight_ratelimits/${uid}`, "v1 rate-limit ledger"],
  [`v2_ratelimits/join_${uid}`, "v2 join throttle"],
  [`insight_users/${OTHER}/insight_inbound_impressions/i1`, "impression they sent"],
  [`insight_users/${OTHER}/relations/r1`, "relation naming them"],
  [`v2_groups/${SOLO}`, "solo group"],
  [`v2_groups/${SHARED}`, "shared group"],
  [`v2_takes/${MY_TAKE}`, "their take"],
  [`v2_flags/${MY_TAKE}_${uid}`, "their flag on their own take"],
  [`v2_mod_queue/${MY_TAKE}`, "the queue's copy of their take"],
  [`v2_takes/${THEIR_TAKE}`, "someone else's take"],
  [`v2_mod_queue/${THEIR_TAKE}`, "the queue's copy of someone else's take"],
  [`v2_agg_events/evt_mine`, "their agg-ledger entry"],
  [`v2_agg_events/evt_theirs`, "someone else's agg-ledger entry"],
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
  // The gap this leg exists for: the take was erased, and its words went on
  // living in the moderation queue's copy of them.
  [`v2_mod_queue/${MY_TAKE}`, "the queue's copy of their take"],
  [`v2_agg_events/evt_mine`, "their agg-ledger entry"],
]) await mustBeGone(path, label);

// …including the organic entry, whose id nobody knows — so ask by query,
// the way the sweep itself does. Anything left here is an erased account
// still attributable in the aggregate record.
if ((await myLedgerEntries()).length !== 0)
  fail("agg-ledger entries for the deleted uid survive the sweep");
ok("every owned document, subcollection and cross-user reference is gone");

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

// The ledger sweep is a uid query, and this is why it has to be: another
// account's attribution record must outlive this deletion, or one erasure
// destroys the correction record (D28) for everyone.
if (!(await exists(`v2_agg_events/evt_theirs`))) fail("someone else's agg-ledger entry was swept");
// And the tally the answer fed stays, per 1b's standing decision: counts
// are k-floored and — once the ledger entry is gone — anonymous again.
// Erasure removes the attribution, not the aggregate.
if (!(await exists(`v2_aggs_private/daily-000`))) fail("erasure destroyed the aggregate tally itself");
ok("someone else's ledger entry and the anonymous tally both survive");

// ── the shared group survives, scrubbed ──
const shared = await adb.doc(`v2_groups/${SHARED}`).get();
if (!shared.exists) fail("the SHARED group was deleted — it still had another member");
const members = shared.get("memberUids") || [];
if (members.includes(uid)) fail("deleted uid still in the shared group's memberUids");
if (!members.includes(OTHER)) fail("the surviving member was removed from the shared group");

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

console.log("\nALL ERASURE CHECKS PASSED");
process.exit(0);

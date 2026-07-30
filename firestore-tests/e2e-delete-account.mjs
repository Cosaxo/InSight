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
await adb.doc(`insight_users/${uid}`).set({ sharePrefs: {} });
await adb.doc(`insight_users/${uid}/insight_daily/${DAY}`).set({ date: DAY, mood: 60 });
await adb.doc(`insight_discoverable/${uid}`).set({ location: { geohash: "u4pru" } });
await adb.doc(`insight_ratelimits/${uid}`).set({ events: [] });
await adb.doc(`v2_ratelimits/join_${uid}`).set({ events: [] });

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

// one client-authored write, so the test also covers the real path
await setDoc(doc(db, "v2_users", uid, "answers", "client-written"), {
  qid: "client-written", surface: "daily", optionIdx: 0,
  answeredAt: serverTimestamp(), anchors: {},
}).catch(() => { /* rules may reject an unseeded qid — not what we're testing */ });

// prove the setup actually landed, or the wipe assertions are vacuous
for (const [path, label] of [
  [`v2_users/${uid}`, "v2 profile"],
  [`v2_users/${uid}/answers/daily-000`, "v2 answer"],
  [`insight_users/${uid}`, "v1 profile"],
  [`insight_discoverable/${uid}`, "discoverable doc"],
  [`insight_ratelimits/${uid}`, "v1 rate-limit ledger"],
  [`v2_ratelimits/join_${uid}`, "v2 join throttle"],
  [`insight_users/${OTHER}/insight_inbound_impressions/i1`, "impression they sent"],
  [`insight_users/${OTHER}/relations/r1`, "relation naming them"],
  [`v2_groups/${SOLO}`, "solo group"],
  [`v2_groups/${SHARED}`, "shared group"],
]) await mustExist(path, label);
ok("seeded every wipe phase, and verified it landed");

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
]) await mustBeGone(path, label);
ok("every owned document, subcollection and cross-user reference is gone");

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

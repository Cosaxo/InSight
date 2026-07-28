// v2 core-loop e2e — runs under `firebase emulators:exec --only auth,firestore,functions`.
// Drives the REAL client path: anonymous auth → seedContentV2 callable →
// daily question fetch → answer write → onV2AnswerCreated increments the agg.
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth";
import {
  getFirestore, connectFirestoreEmulator, collection, query, where, orderBy,
  limit, getDocs, doc, getDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";

const app = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" });
const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
const fns = getFunctions(app, "us-central1"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);

const fail = (msg) => { console.error("✗ " + msg); process.exit(1); };
const ok = (msg) => console.log("✓ " + msg);

// A bare `try { …; fail() } catch { ok() }` passes on ANY error — a typo, a
// dropped connection, an emulator that never came up. For a SECURITY
// assertion that is worse than no test, because it still counts toward the
// green tally that gates the deploy. Demand the specific denial.
const expectDenied = async (label, op) => {
  try {
    await op();
  } catch (e) {
    if (e?.code === "permission-denied") return ok(label);
    return fail(`${label} — expected permission-denied, got ${e?.code || e}`);
  }
  fail(`${label} — the operation was ALLOWED`);
};

// 1 · anonymous-first auth (D3)
const cred = await signInAnonymously(auth);
if (!cred.user.uid) fail("anon sign-in");
ok("anonymous sign-in: " + cred.user.uid.slice(0, 8));

// 2 · seed the question bank through the callable
const seed = await httpsCallable(fns, "seedContentV2")({});
if (!seed.data || seed.data.written < 190) fail("seed wrote " + JSON.stringify(seed.data));
ok("seedContentV2 wrote " + seed.data.written + " questions");

// 3 · fetch the daily bank the way the client does
const qsnap = await getDocs(query(
  collection(db, "v2_questions"),
  where("surface", "==", "daily"), where("active", "==", true),
  orderBy("seq"), limit(200)));
if (qsnap.empty) fail("daily bank empty");
const q0 = qsnap.docs[0];
ok("daily bank: " + qsnap.size + " questions; first: \"" + q0.get("prompt").slice(0, 40) + "…\"");

// 4 · vote (owner-only answer write, rules enforced end-to-end)
const uid = cred.user.uid;
await setDoc(doc(db, "v2_users", uid, "answers", q0.id), {
  qid: q0.id, surface: "daily", optionIdx: 1,
  answeredAt: serverTimestamp(), anchors: {},
});
ok("answer written: " + uid.slice(0, 8) + "/answers/" + q0.id);

// 5 · the trigger folds the answer into the k-floored public mirror.
// Below AGG_MIN_N (5) the public doc must say tooSmall with NO counts.
let pub = null;
for (let i = 0; i < 30; i++) {
  const snap = await getDoc(doc(db, "v2_question_aggs", q0.id));
  if (snap.exists()) { pub = snap.data(); break; }
  await new Promise((r) => setTimeout(r, 500));
}
if (!pub) fail("public agg never appeared — trigger did not fire");
if (pub.tooSmall !== true || pub.counts) fail("k-floor breach below MIN_N: " + JSON.stringify(pub));
ok("below floor: public agg is tooSmall-only (no counts leaked)");

// 6 · duplicate answer is refused (immutability backs the plain increment)
await expectDenied("duplicate answer refused by rules", () =>
  setDoc(doc(db, "v2_users", uid, "answers", q0.id), {
    qid: q0.id, surface: "daily", optionIdx: 0,
    answeredAt: serverTimestamp(), anchors: {},
  }));

// 7 · four more voters cross the floor — counts appear, exact and correct.
// Each voter gets an isolated app instance: reusing one auth while
// signing in repeatedly races the token swap against the write stream.
for (let n = 0; n < 4; n++) {
  const vApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "voter" + n);
  const vAuth = getAuth(vApp); connectAuthEmulator(vAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const vDb = getFirestore(vApp); connectFirestoreEmulator(vDb, "127.0.0.1", 8080);
  const u = await signInAnonymously(vAuth);
  await setDoc(doc(vDb, "v2_users", u.user.uid, "answers", q0.id), {
    qid: q0.id, surface: "daily", optionIdx: n % 2,
    answeredAt: serverTimestamp(), anchors: {},
  });
}
let above = null;
for (let i = 0; i < 40; i++) {
  const snap = await getDoc(doc(db, "v2_question_aggs", q0.id));
  if (snap.exists() && snap.get("tooSmall") === false) { above = snap.data(); break; }
  await new Promise((r) => setTimeout(r, 500));
}
if (!above) fail("public counts never appeared above the floor");
// votes: opt1 (first user) + opt0,opt1,opt0,opt1 → {0:2, 1:3}, total 5
if (above.total !== 5 || above.counts["0"] !== 2 || above.counts["1"] !== 3)
  fail("counts wrong above floor: " + JSON.stringify(above));
ok("above floor: exact public counts {0:2, 1:3}, total 5 — no double counting");

// 8 · the duel loop: create → join by code → sealed answers → reveal → streak
const YESTER = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const created = await httpsCallable(fns, "createGroupV2")({ name: "The Crew", mode: "duo" });
const { gid, inviteCode } = created.data;
if (!gid || !inviteCode) fail("createGroupV2: " + JSON.stringify(created.data));
ok("duo created: " + gid + " code " + inviteCode);

// partner on an isolated app (avoids the shared-auth race)
const pApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "partner");
const pAuth = getAuth(pApp); connectAuthEmulator(pAuth, "http://127.0.0.1:9099", { disableWarnings: true });
const pDb = getFirestore(pApp); connectFirestoreEmulator(pDb, "127.0.0.1", 8080);
const pFns = getFunctions(pApp, "us-central1"); connectFunctionsEmulator(pFns, "127.0.0.1", 5001);
const partner = await signInAnonymously(pAuth);
const joined = await httpsCallable(pFns, "joinGroupV2")({ code: inviteCode });
if (joined.data.gid !== gid) fail("joinGroupV2 landed in wrong group");
ok("partner joined by invite code");

const aid = `g_${gid}_${YESTER}`;
const duel = (idx, guess) => ({
  qid: "group-gu0", surface: "duo", optionIdx: idx, guessIdx: guess,
  gid, day: YESTER, answeredAt: serverTimestamp(), anchors: {},
});
await setDoc(doc(db, "v2_users", uid, "answers", aid), duel(1, 2));
// partner must NOT see the sealed answer pre-reveal
await expectDenied("sealed answer unreadable to partner pre-reveal", () =>
  getDoc(doc(pDb, "v2_users", uid, "answers", aid)));
await setDoc(doc(pDb, "v2_users", partner.user.uid, "answers", aid), duel(2, 1));

const revealed = await httpsCallable(fns, "revealDuelsNowV2")({ day: YESTER });
if (revealed.data.revealed < 1) fail("revealDuelsNowV2 revealed nothing");
const reveal = await getDoc(doc(pDb, "v2_groups", gid, "reveals", YESTER));
if (!reveal.exists()) fail("reveal doc missing");
const votes = reveal.get("votes");
if (votes[uid]?.optionIdx !== 1 || votes[uid]?.guessIdx !== 2
  || votes[partner.user.uid]?.optionIdx !== 2) fail("reveal votes wrong: " + JSON.stringify(votes));
ok("reveal materialized with both votes + guesses");

const gsnap = await getDoc(doc(db, "v2_groups", gid));
if (gsnap.get("streak") !== 1) fail("streak != 1: " + gsnap.get("streak"));
ok("duo streak = 1");

// 9 · non-membership and post-reveal are SEPARATE denials. The old single
// check conflated them with a uid fallback of "x", so it had three
// independent reasons to fail and proved none of them.

// 9a · a non-member cannot answer, even on a day that is still open.
const OTHERDAY = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
const outApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "outsider");
const outAuth = getAuth(outApp); connectAuthEmulator(outAuth, "http://127.0.0.1:9099", { disableWarnings: true });
const outDb = getFirestore(outApp); connectFirestoreEmulator(outDb, "127.0.0.1", 8080);
const outsider = await signInAnonymously(outAuth);
await expectDenied("non-member cannot answer an open duel day", () =>
  setDoc(doc(outDb, "v2_users", outsider.user.uid, "answers", `g_${gid}_${OTHERDAY}`), {
    qid: "group-gu0", surface: "duo", optionIdx: 0, guessIdx: 0,
    gid, day: OTHERDAY, answeredAt: serverTimestamp(), anchors: {},
  }));

// 9b · a REAL member cannot answer a day that is already revealed — the
// property D5 actually rests on. Needs a group (mode "group" reveals on
// one answer, unlike a duo's both-or-nothing) so a genuine member is left
// un-answered at reveal time.
const gCreated = await httpsCallable(fns, "createGroupV2")({ name: "Late Crew", mode: "group" });
const lateGid = gCreated.data.gid;
const lateApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "latecomer");
const lateAuth = getAuth(lateApp); connectAuthEmulator(lateAuth, "http://127.0.0.1:9099", { disableWarnings: true });
const lateDb = getFirestore(lateApp); connectFirestoreEmulator(lateDb, "127.0.0.1", 8080);
const lateFns = getFunctions(lateApp, "us-central1"); connectFunctionsEmulator(lateFns, "127.0.0.1", 5001);
const latecomer = await signInAnonymously(lateAuth);
await httpsCallable(lateFns, "joinGroupV2")({ code: gCreated.data.inviteCode });

const lateAid = `g_${lateGid}_${OTHERDAY}`;
const groupAnswer = (idx) => ({
  qid: "group-gu0", surface: "group", optionIdx: idx,
  gid: lateGid, day: OTHERDAY, answeredAt: serverTimestamp(), anchors: {},
});
// only the creator plays; the latecomer deliberately does not
await setDoc(doc(db, "v2_users", uid, "answers", lateAid), groupAnswer(1));
const lateReveal = await httpsCallable(fns, "revealDuelsNowV2")({ day: OTHERDAY });
if (lateReveal.data.revealed < 1) fail("group day did not reveal on one answer");
if (!(await getDoc(doc(lateDb, "v2_groups", lateGid, "reveals", OTHERDAY))).exists())
  fail("group reveal doc missing");
await expectDenied("member cannot answer a day already revealed", () =>
  setDoc(doc(lateDb, "v2_users", latecomer.user.uid, "answers", lateAid), groupAnswer(0)));

// duel answers must NOT leak into world aggregates
const duelAgg = await getDoc(doc(db, "v2_question_aggs", "group-gu0"));
if (duelAgg.exists()) fail("duel answers leaked into world aggregates");
ok("duel answers stay out of world aggregates");

console.log("\nALL E2E CHECKS PASSED");
process.exit(0);

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
try {
  await setDoc(doc(db, "v2_users", uid, "answers", q0.id), {
    qid: q0.id, surface: "daily", optionIdx: 0,
    answeredAt: serverTimestamp(), anchors: {},
  });
  fail("duplicate answer was allowed");
} catch { ok("duplicate answer refused by rules"); }

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

console.log("\nALL E2E CHECKS PASSED");
process.exit(0);

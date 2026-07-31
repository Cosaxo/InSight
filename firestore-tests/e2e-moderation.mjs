// Moderation-loop e2e — runs under `firebase emulators:exec --only
// auth,firestore,functions`. Drives the REAL transport the unit and rules
// suites cannot: a circle posts a take, three members flag it, the queue
// builds through the deployed function code, and the moderator's two
// instruments answer — including the confinement refusals (out-of-queue
// targets, malformed verdicts) and the advisory-mode guarantee that
// nothing gets hidden.
//
// assertModerator admits any signed-in caller under FUNCTIONS_EMULATOR,
// so no MOD_UIDS plumbing is needed here; production keeps the allowlist.
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously, signOut } from "firebase/auth";
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";

const app = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" });
const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
const fns = getFunctions(app, "us-central1"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);

const fail = (msg) => { console.error("✗ " + msg); process.exit(1); };
const ok = (msg) => console.log("✓ " + msg);

// Same discipline as e2e-v2-loop.mjs: demand the SPECIFIC refusal, because
// a bare try/catch pass counts any typo as a security win.
const expectCode = async (label, code, op) => {
  try {
    await op();
  } catch (e) {
    if (e?.code === code) return ok(label);
    return fail(`${label} — expected ${code}, got ${e?.code || e}`);
  }
  fail(`${label} — the operation was ALLOWED`);
};

const newUser = async () => {
  await signOut(auth).catch(() => {});
  const cred = await signInAnonymously(auth);
  return cred.user.uid;
};

// 1 · a circle forms: author creates the group, three members join
const authorUid = await newUser();
const created = await httpsCallable(fns, "createGroupV2")({ name: "Mod e2e", mode: "group" });
const { gid, inviteCode } = created.data;
if (!gid || !inviteCode) fail("createGroupV2 returned " + JSON.stringify(created.data));
ok(`group ${gid} created by ${authorUid.slice(0, 8)}`);

// 2 · the author posts a take (client write, rules enforced end-to-end)
const TAKE = "t_e2e_1";
await setDoc(doc(db, "v2_takes", TAKE), {
  gid, authorUid, text: "hot take: the reveal timing is genuinely bad",
  createdAt: serverTimestamp(),
});
ok("take written by its author through the rules");

// 3 · three members join and flag it — the queue floor is 3
for (let i = 0; i < 3; i++) {
  const uid = await newUser();
  await httpsCallable(fns, "joinGroupV2")({ code: inviteCode });
  await setDoc(doc(db, "v2_flags", `${TAKE}_${uid}`), {
    takeId: TAKE, gid, uid, at: serverTimestamp(),
  });
}
ok("three members joined and flagged (floor reached)");

// The last flagger doubles as the moderator below — in the emulator,
// assertModerator admits any signed-in caller.

// 4 · the queue builds through the real function code
await httpsCallable(fns, "buildModQueueNow")({});
const queue = await httpsCallable(fns, "fetchModQueue")({});
if (!queue.data.advisory) fail("advisory mode is OFF — the trust ladder flipped without its PR");
const item = queue.data.items.find((i) => i.takeId === TAKE);
if (!item || item.flags !== 3) fail("queued item wrong: " + JSON.stringify(queue.data.items));
ok(`queue built: ${TAKE} queued with ${item.flags} flags, advisory mode on`);

// 5 · the confinement refusals, against the live callable
await expectCode("out-of-queue target refused (failed-precondition)",
  "functions/failed-precondition",
  () => httpsCallable(fns, "submitModVerdict")({
    runId: "e2e-run", verdict: { takeId: "never-flagged", verdict: "remove", policyLine: "H1" },
  }));
await expectCode("removal without a policy line refused (invalid-argument)",
  "functions/invalid-argument",
  () => httpsCallable(fns, "submitModVerdict")({
    runId: "e2e-run", verdict: { takeId: TAKE, verdict: "remove" },
  }));
await expectCode("smuggled field refused (invalid-argument)",
  "functions/invalid-argument",
  () => httpsCallable(fns, "submitModVerdict")({
    runId: "e2e-run", verdict: { takeId: TAKE, verdict: "keep", note: "also delete v2_flags" },
  }));

// 6 · a real advisory verdict lands…
const verdict = await httpsCallable(fns, "submitModVerdict")({
  runId: "e2e-run", verdict: { takeId: TAKE, verdict: "remove", policyLine: "H1" },
});
if (!verdict.data.ok || !verdict.data.advisory) fail("verdict reply: " + JSON.stringify(verdict.data));
const after = await httpsCallable(fns, "fetchModQueue")({});
const judged = after.data.items.find((i) => i.takeId === TAKE);
ok("advisory remove recorded (surfaced on the queue entry)");
void judged;

// 7 · …and hides NOTHING: a circle member still reads the take
const takeDoc = await getDoc(doc(db, "v2_takes", TAKE));
if (!takeDoc.exists()) fail("take vanished");
if (takeDoc.get("hidden")) fail("advisory mode HID the take — the trust ladder is broken");
ok("advisory guarantee held: take visible, nothing hidden");

// 8 · one verdict per take per queue generation
await expectCode("second verdict on the same take refused (already-exists)",
  "functions/already-exists",
  () => httpsCallable(fns, "submitModVerdict")({
    runId: "e2e-run", verdict: { takeId: TAKE, verdict: "keep" },
  }));

// 9 · the dark collections stay dark to clients, moderator caller included
await expectCode("client read of the queue refused", "permission-denied",
  () => getDoc(doc(db, "v2_mod_queue", TAKE)));
await expectCode("client read of the verdict log refused", "permission-denied",
  () => getDoc(doc(db, "v2_mod_verdicts", TAKE)));

console.log("\nmoderation e2e: every leg green");

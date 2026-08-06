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
import { initializeApp as adminInit } from "firebase-admin/app";
import { getFirestore as adminFirestore } from "firebase-admin/firestore";

const app = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" });
const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);

// Admin, rules bypassed — the only way to observe v2_mod_queue, which is
// `allow read, write: if false` to every client by design (the queue is a
// server-only surface of the confinement model). fetchModQueue's projection
// does not return the advisory fields, so step 6 has no other way to check
// what it claims. Same pattern as e2e-delete-account.mjs.
adminInit({ projectId: "demo-insight" });
const adb = adminFirestore();
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
// Read the queue DOC with admin, not fetchModQueue: the callable's
// projection (moderation.ts) returns neither advisoryVerdict nor
// advisoryLine, so the fields this step is about are unreachable from it.
// This step printed a pass for an assertion nobody had written — `const
// judged = …; ok(…); void judged;` compared nothing, and the claim was
// unachievable through that call anyway.
const entry = await adb.doc(`v2_mod_queue/${TAKE}`).get();
if (!entry.exists) fail("the queue entry vanished on an advisory verdict — it must stay for the human");
if (entry.get("advisoryVerdict") !== "remove") {
  fail("advisoryVerdict not recorded: " + JSON.stringify(entry.get("advisoryVerdict")));
}
if (entry.get("advisoryLine") !== "H1") {
  fail("advisoryLine not recorded: " + JSON.stringify(entry.get("advisoryLine")));
}
ok("advisory remove recorded on the queue entry, with its policy line");

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

// 8b · …but a NEW generation reopens it, which is the half that was
// broken. The queue is rebuilt wholesale every run and advisory mode
// hides nothing and clears no flags, so this take is back tomorrow —
// and while the verdict log was keyed by takeId alone, tomorrow's
// verdict died `already-exists` on yesterday's grounds. `escalate` was
// the worst case: the one verdict that keeps an entry queued for a human
// was the one that could never be revisited. The two legs together are
// the actual contract — one verdict per generation, a fresh judgement
// per generation.
await httpsCallable(fns, "buildModQueueNow")({});
const regen = await httpsCallable(fns, "submitModVerdict")({
  runId: "e2e-run-2", verdict: { takeId: TAKE, verdict: "escalate" },
});
if (!regen.data.ok) fail("re-verdict after rebuild: " + JSON.stringify(regen.data));
ok("a rebuilt queue reopens the take for judgement (new generation)");

// 8c · the escalation survives the NEXT rebuild. "Uncertain → escalate" is
// the policy's safety valve and docs/MODERATION.md promises escalations
// reach a human in both phases — but the rebuild deletes every queue entry,
// so the mark used to live until 05:00 and then vanish, and the verdict log
// that kept the row is read by nothing yet. Worse in advisory mode, which
// returns before the `escalated` branch is reached: the flag fetchModQueue
// handed the run was permanently false. This asserts the count arrives on
// the far side of a wipe.
await httpsCallable(fns, "buildModQueueNow")({});
const carried = await httpsCallable(fns, "fetchModQueue")({});
const carriedItem = carried.data.items.find((i) => i.takeId === TAKE);
if (!carriedItem) fail("take fell out of the queue after rebuild");
if (carriedItem.escalations !== 1) {
  fail(`escalation not carried: escalations=${JSON.stringify(carriedItem.escalations)}`);
}
// …and it is a standing signal, not this generation's verdict: the fresh
// entry carries no verdict of its own, so the run can judge it again.
if (carriedItem.escalated) fail("a rebuilt entry claims a verdict it does not have");
ok("the escalation survived the rebuild (escalations=1, entry re-judgeable)");

// 9 · the dark collections stay dark to clients, moderator caller included
await expectCode("client read of the queue refused", "permission-denied",
  () => getDoc(doc(db, "v2_mod_queue", TAKE)));
await expectCode("client read of the verdict log refused", "permission-denied",
  () => getDoc(doc(db, "v2_mod_verdicts", TAKE)));

console.log("\nmoderation e2e: every leg green");
// The client SDKs hold open connections; without an explicit exit the
// process lingers and `emulators:exec` waits on it forever — which is
// exactly how this leg hung its first CI run (deploy 30632906108).
process.exit(0);

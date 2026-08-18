// Moderation-loop e2e — runs under `firebase emulators:exec --only
// auth,firestore,functions`. Drives the REAL transport the unit and rules
// suites cannot: a circle posts a take, three members flag it, the queue
// builds through the deployed function code, and the moderator's two
// instruments answer — including the confinement refusals (out-of-queue
// targets, malformed verdicts) and, since D83 flipped MOD_ADVISORY off,
// the ENFORCED verdicts: a remove really hides, a keep really clears the
// flags, and only an escalation keeps the entry alive for a human.
//
// The advisory-guarantee legs this file used to carry ("nothing gets
// hidden") described the trust ladder's dry-run phase; they inverted with
// the flip and their replacements are steps 6a–6c below. A world-take leg
// (step 9) walks the same chain at world scale, where the flagger is a
// stranger — the audience D83 made the moderation constituency.
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
// The region the EMULATOR serves, taken from the functions' own compiled
// output rather than repeated here (D199). `pretest:e2e` builds it, so
// this harness cannot be pointed at a region the emulator is not on.
import { FUNCTIONS_REGION } from "../functions/lib/ops.js";

// The named database (D165). The backend writes to FIRESTORE_DB_ID, so a
// harness on `(default)` reads an empty database and reports a phantom
// failure — which is exactly what happened the first time this ran, and is
// the same split brain the deploy has to avoid. One constant, same env var
// as functions/src/db.ts.
const E2E_DB_ID = process.env.FIRESTORE_DB_ID || "insight";

const app = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" });
const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app, E2E_DB_ID); connectFirestoreEmulator(db, "127.0.0.1", 8080);

// Admin, rules bypassed — the only way to observe v2_mod_queue, which is
// `allow read, write: if false` to every client by design (the queue is a
// server-only surface of the confinement model). Same pattern as
// e2e-delete-account.mjs.
adminInit({ projectId: "demo-insight" });
// The ADMIN handle needs the database too, and this is the one that got
// missed first time round: it takes no argument, so it reads as fine and
// silently targets `(default)`. It then wrote the question doc to one
// database while the client wrote the answer to another, and the rules'
// get() on the missing question denied the write — a null-value error
// four layers from the actual mistake.
const adb = adminFirestore(E2E_DB_ID);
const fns = getFunctions(app, FUNCTIONS_REGION); connectFunctionsEmulator(fns, "127.0.0.1", 5001);

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

// 2 · the author posts three takes (client writes, rules enforced
// end-to-end) — one per enforced verdict below: remove, escalate, keep.
const T_REMOVE = "t_e2e_remove";
const T_ESCALATE = "t_e2e_escalate";
const T_KEEP = "t_e2e_keep";
for (const [id, text] of [
  [T_REMOVE, "hot take: over every line at once"],
  [T_ESCALATE, "hot take: genuinely hard to judge"],
  [T_KEEP, "hot take: the reveal timing is genuinely bad"],
]) {
  await setDoc(doc(db, "v2_takes", id), {
    gid, authorUid, text,
    createdAt: serverTimestamp(),
    // Required by the create rule, and required to be false (D65): the read
    // gate is an equality on this field, so a take without it could never be
    // read back and a client-set `true` would hide its own words from the
    // circle while leaving them in the queue.
    hidden: false,
  });
}
ok("three takes written by their author through the rules");

// 3 · three members join and flag all three — the queue floor is 3
for (let i = 0; i < 3; i++) {
  const uid = await newUser();
  await httpsCallable(fns, "joinGroupV2")({ code: inviteCode });
  for (const id of [T_REMOVE, T_ESCALATE, T_KEEP]) {
    await setDoc(doc(db, "v2_flags", `${id}_${uid}`), {
      takeId: id, gid, uid, at: serverTimestamp(),
    });
  }
}
ok("three members joined and flagged all three (floor reached)");

// The last flagger doubles as the moderator below — in the emulator,
// assertModerator admits any signed-in caller. They are a MEMBER of the
// circle, which is what makes the post-remove read refusal in 6a a
// statement: the hide holds against the very audience the take had.

// 4 · the queue builds through the real function code — enforcing, not
// advisory: D78 made the flip the hard prerequisite for world takes, and
// D83 shipped them.
await httpsCallable(fns, "buildModQueueNow")({});
const queue = await httpsCallable(fns, "fetchModQueue")({});
if (queue.data.advisory) fail("advisory mode is ON — D83's enforcement flip regressed");
for (const id of [T_REMOVE, T_ESCALATE, T_KEEP]) {
  const item = queue.data.items.find((i) => i.takeId === id);
  if (!item || item.flags !== 3) fail(`queued item wrong for ${id}: ` + JSON.stringify(queue.data.items));
}
ok("queue built: three takes queued with 3 flags each, enforcement on");

// 5 · the confinement refusals, against the live callable
await expectCode("out-of-queue target refused (failed-precondition)",
  "functions/failed-precondition",
  () => httpsCallable(fns, "submitModVerdict")({
    runId: "e2e-run", verdict: { takeId: "never-flagged", verdict: "remove", policyLine: "H1" },
  }));
await expectCode("removal without a policy line refused (invalid-argument)",
  "functions/invalid-argument",
  () => httpsCallable(fns, "submitModVerdict")({
    runId: "e2e-run", verdict: { takeId: T_REMOVE, verdict: "remove" },
  }));
await expectCode("smuggled field refused (invalid-argument)",
  "functions/invalid-argument",
  () => httpsCallable(fns, "submitModVerdict")({
    runId: "e2e-run", verdict: { takeId: T_KEEP, verdict: "keep", note: "also delete v2_flags" },
  }));

// 6a · an enforced REMOVE: the take hides, for real, against its own circle
const removed = await httpsCallable(fns, "submitModVerdict")({
  runId: "e2e-run", verdict: { takeId: T_REMOVE, verdict: "remove", policyLine: "H1" },
});
if (!removed.data.ok || removed.data.advisory) fail("remove reply: " + JSON.stringify(removed.data));
{
  const t = await adb.doc(`v2_takes/${T_REMOVE}`).get();
  if (t.get("hidden") !== true) fail("remove verdict did not hide the take");
  if (t.get("hiddenMeta")?.policyLine !== "H1") {
    fail("hiddenMeta missing its policy line: " + JSON.stringify(t.get("hiddenMeta")));
  }
  // The queue entry is settled and gone — a removed take is not re-judged.
  const entry = await adb.doc(`v2_mod_queue/${T_REMOVE}`).get();
  if (entry.exists) fail("queue entry survived an enforced remove");
}
// The client half of the same fact: a circle MEMBER (the moderator caller
// is one) can no longer read it — the soft-hide is the read rule working,
// not a display choice.
await expectCode("a member's read of the removed take is refused", "permission-denied",
  () => getDoc(doc(db, "v2_takes", T_REMOVE)));
ok("enforced remove: hidden with policy line, queue entry settled");
// …and the entry being gone means a second verdict has nothing to land on.
await expectCode("second verdict on a removed take refused (failed-precondition)",
  "functions/failed-precondition",
  () => httpsCallable(fns, "submitModVerdict")({
    runId: "e2e-run", verdict: { takeId: T_REMOVE, verdict: "keep" },
  }));

// 6b · an enforced KEEP: the take stays, and its flags are CLEARED so it
// re-enters the queue only on fresh ones — the fresh-flags contract.
const kept = await httpsCallable(fns, "submitModVerdict")({
  runId: "e2e-run", verdict: { takeId: T_KEEP, verdict: "keep" },
});
if (!kept.data.ok) fail("keep reply: " + JSON.stringify(kept.data));
{
  const t = await getDoc(doc(db, "v2_takes", T_KEEP));
  if (!t.exists() || t.get("hidden")) fail("keep verdict disturbed the take");
  const flags = await adb.collection("v2_flags").where("takeId", "==", T_KEEP).get();
  if (!flags.empty) fail(`keep left ${flags.size} flags standing — the take would requeue on stale grounds`);
}
ok("enforced keep: take untouched, flags cleared");

// 6c · ESCALATE keeps the entry for a human, and one verdict per
// generation still holds on it
const esc = await httpsCallable(fns, "submitModVerdict")({
  runId: "e2e-run", verdict: { takeId: T_ESCALATE, verdict: "escalate" },
});
if (!esc.data.ok) fail("escalate reply: " + JSON.stringify(esc.data));
await expectCode("second verdict on the same take refused (already-exists)",
  "functions/already-exists",
  () => httpsCallable(fns, "submitModVerdict")({
    runId: "e2e-run", verdict: { takeId: T_ESCALATE, verdict: "keep" },
  }));

// 7 · the rebuild: the removed take (hidden) and the kept take (no flags)
// both fall out; the escalated one returns re-judgeable with its
// escalation carried — the standing signal docs/MODERATION.md promises
// survives the wipe.
await httpsCallable(fns, "buildModQueueNow")({});
const rebuilt = await httpsCallable(fns, "fetchModQueue")({});
if (rebuilt.data.items.find((i) => i.takeId === T_REMOVE)) {
  fail("a hidden take was re-queued");
}
if (rebuilt.data.items.find((i) => i.takeId === T_KEEP)) {
  fail("a kept take re-queued on cleared flags");
}
const carriedItem = rebuilt.data.items.find((i) => i.takeId === T_ESCALATE);
if (!carriedItem) fail("the escalated take fell out of the queue after rebuild");
if (carriedItem.escalations !== 1) {
  fail(`escalation not carried: escalations=${JSON.stringify(carriedItem.escalations)}`);
}
// …and it is a standing signal, not this generation's verdict: the fresh
// entry carries no verdict of its own, so the run can judge it again.
if (carriedItem.escalated) fail("a rebuilt entry claims a verdict it does not have");
const regen = await httpsCallable(fns, "submitModVerdict")({
  runId: "e2e-run-2", verdict: { takeId: T_ESCALATE, verdict: "escalate" },
});
if (!regen.data.ok) fail("re-verdict after rebuild: " + JSON.stringify(regen.data));
ok("rebuild: remove and keep settled out; escalation carried, entry re-judgeable");

// 8 · the dark collections stay dark to clients, moderator caller included
await expectCode("client read of the queue refused", "permission-denied",
  () => getDoc(doc(db, "v2_mod_queue", T_ESCALATE)));
await expectCode("client read of the verdict log refused", "permission-denied",
  () => getDoc(doc(db, "v2_mod_verdicts", T_ESCALATE)));

// 9 · the world leg (D83): the same chain at world scale, where the
// flagger is a STRANGER — no shared circle anywhere in it.
const WQID = "daily-000";
const worldAuthor = await newUser();
const WTAKE = `${WQID}_${worldAuthor}`;
await setDoc(doc(db, "v2_takes", WTAKE), {
  gid: "world", authorUid: worldAuthor, qid: WQID,
  text: "world take: this question is a coin flip",
  createdAt: serverTimestamp(), hidden: false,
});
ok("world take posted under its qid_uid id, through the rules");
// Three strangers read it and flag it — never members of anything.
for (let i = 0; i < 3; i++) {
  const uid = await newUser();
  const read = await getDoc(doc(db, "v2_takes", WTAKE));
  if (!read.exists()) fail("a stranger could not read a visible world take");
  await setDoc(doc(db, "v2_flags", `${WTAKE}_${uid}`), {
    takeId: WTAKE, gid: "world", uid, at: serverTimestamp(),
  });
}
ok("three strangers read and flagged the world take");
await httpsCallable(fns, "buildModQueueNow")({});
const wq = await httpsCallable(fns, "fetchModQueue")({});
const witem = wq.data.items.find((i) => i.takeId === WTAKE);
if (!witem || witem.flags !== 3) fail("world take not queued: " + JSON.stringify(wq.data.items));
const wverdict = await httpsCallable(fns, "submitModVerdict")({
  runId: "e2e-run-3", verdict: { takeId: WTAKE, verdict: "remove", policyLine: "H2" },
});
if (!wverdict.data.ok) fail("world remove reply: " + JSON.stringify(wverdict.data));
await expectCode("the removed world take is refused to the world", "permission-denied",
  () => getDoc(doc(db, "v2_takes", WTAKE)));
ok("world moderation: queued on stranger flags, removed, hidden from everyone");

console.log("\nmoderation e2e: every leg green");
// The client SDKs hold open connections; without an explicit exit the
// process lingers and `emulators:exec` waits on it forever — which is
// exactly how this leg hung its first CI run (deploy 30632906108).
process.exit(0);

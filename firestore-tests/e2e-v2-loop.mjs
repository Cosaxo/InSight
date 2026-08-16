// v2 core-loop e2e — runs under `firebase emulators:exec --only auth,firestore,functions`.
// Drives the REAL client path: anonymous auth → seedContentV2 callable →
// daily question fetch → answer write → onV2AnswerCreated increments the agg.
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth";
import {
  getFirestore, connectFirestoreEmulator, collection, query, where, orderBy,
  limit, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
// The ADMIN handle, and the only thing it is used for: reading back a
// v2_presence document (D179's backfill assertion). That collection is
// `allow read: if false` to every client — deliberately, it is one of the
// three surviving denies — so a client handle cannot check whether the
// server repaired a legacy row, and asserting through the deny would mean
// weakening it for a test.
import { initializeApp as adminInit } from "firebase-admin/app";
import { getFirestore as adminFirestore } from "firebase-admin/firestore";

// The named database (D165). The backend writes to FIRESTORE_DB_ID, so a
// harness on `(default)` reads an empty database and reports a phantom
// failure — which is exactly what happened the first time this ran, and is
// the same split brain the deploy has to avoid. One constant, same env var
// as functions/src/db.ts.
const E2E_DB_ID = process.env.FIRESTORE_DB_ID || "insight";

const app = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" });
const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app, E2E_DB_ID); connectFirestoreEmulator(db, "127.0.0.1", 8080);
const fns = getFunctions(app, "us-central1"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);
adminInit({ projectId: "demo-insight" });
const adminDb = adminFirestore(E2E_DB_ID);

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

// 1b · D29 device binding: the activation callable stamps the `db` custom
// claim the answer rules will demand once deviceBindEnforced() flips. In
// the emulator the callable grants unconditionally (no Apple/Google), so
// what this leg proves is the grant path end to end: callable → custom
// claim → visible on a force-refreshed ID token. The enforced rules
// branch is pinned separately in rules.test.ts against the flipped text.
const act = await httpsCallable(fns, "activateDeviceV2")({ platform: "web" });
if (!act.data?.ok) fail("activateDeviceV2 refused: " + JSON.stringify(act.data));
const tokenResult = await cred.user.getIdTokenResult(/* forceRefresh */ true);
if (tokenResult.claims.db !== 1) {
  fail("db claim missing after activation: " + JSON.stringify(tokenResult.claims));
}
ok("device binding: activation granted, db claim live on the refreshed token");

// 2 · seed the question bank through the callable
const seed = await httpsCallable(fns, "seedContentV2")({});
if (!seed.data || seed.data.written < 190) fail("seed wrote " + JSON.stringify(seed.data));
ok("seedContentV2 wrote " + seed.data.written + " questions");

// 2b · the reseed is a no-op, and says so in the two places that cost money.
// A reseed used to rewrite every question and bump contentRev regardless,
// which invalidated every device's cached bank — 369 reads per returning
// user for content that had not moved (docs/COSTS.md). Assert the skip
// rather than trusting it: the failure mode is silent and only shows up on
// an invoice.
// Compared at NANOSECOND resolution, not toMillis(): two seed calls a few
// round trips apart can land in the same millisecond, and a test that
// fails once a month is worse than no test.
const stamp = async () => {
  const t = (await getDoc(doc(db, "v2_meta", "app"))).get("contentRev");
  return t ? `${t.seconds}.${t.nanoseconds}` : null;
};
const revBefore = await stamp();
if (!revBefore) fail("the first seed did not initialise contentRev");
const reseed = await httpsCallable(fns, "seedContentV2")({});
if (reseed.data?.written !== 0) {
  fail("reseed rewrote " + JSON.stringify(reseed.data) + " — expected 0 written");
}
if (reseed.data?.skipped !== seed.data.written) {
  fail("reseed skipped " + reseed.data?.skipped + ", expected " + seed.data.written);
}
if (await stamp() !== revBefore) {
  fail("reseed moved contentRev — every client's bank cache just died for nothing");
}
ok(`reseed wrote 0, skipped ${reseed.data.skipped}, contentRev held`);

// …and the operator's explicit lever still works, because a console
// `active` flip has no other way to reach a cached client.
const forced = await httpsCallable(fns, "seedContentV2")({ bumpRev: true });
if (forced.data?.written !== 0) fail("bumpRev should not rewrite documents");
if (await stamp() === revBefore) fail("bumpRev did not move contentRev");
ok("bumpRev forces the full invalidation without rewriting a document");

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
// anchors ride along so the per-anchor breakdown (D8) is exercised too.
//
// Everyone shares a country on purpose — one bucket is a population
// statement, not a split, so that dimension must never publish. The value
// is the ISO code, not "Norway": since D9 the client derives it from the
// picked city and breakdownBucket() rejects anything else. Sending free
// text here would make the assertion below pass for the wrong reason —
// the dimension would be dropped at fold time and never reach the
// single-bucket rule it is meant to be testing.
//
// The city split is 5/5 across Oslo and Bergen by the end, so the
// dimension D9 added is exercised through the whole pipeline rather than
// only in the pure unit tests.
await setDoc(doc(db, "v2_users", uid, "answers", q0.id), {
  qid: q0.id, surface: "daily", optionIdx: 1,
  answeredAt: serverTimestamp(),
  anchors: { ageBand: "25-34", country: "NO", city: "Oslo, NO" },
});
ok("answer written: " + uid.slice(0, 8) + "/answers/" + q0.id);

// 5 · the trigger folds the answer into the public mirror. Since D98 the
// FIRST answer publishes, exactly, with the complete breakdown: no
// tooSmall flag, no cadence, no suppressed cells.
let pub = null;
for (let i = 0; i < 30; i++) {
  const snap = await getDoc(doc(db, "v2_question_aggs", q0.id));
  if (snap.exists()) { pub = snap.data(); break; }
  await new Promise((r) => setTimeout(r, 500));
}
if (!pub) fail("public agg never appeared — trigger did not fire");
if ("tooSmall" in pub)
  fail("the trigger still writes a tooSmall flag: " + JSON.stringify(pub));
if (pub.total !== 1 || !pub.counts || pub.counts["1"] !== 1)
  fail("first answer did not publish exactly: " + JSON.stringify(pub));
// The one-bucket rule went with the rest of the suppression (D98): a
// dimension with a single bucket now publishes like any other. Everyone in
// this loop shares country NO, so `by.country` is exactly that case — it
// must now BE there, which is the inverse of what this line used to assert.
if (!pub.by || !pub.by.country || !pub.by.country.NO)
  fail("a one-bucket dimension was suppressed — D98 removed that rule: " + JSON.stringify(pub.by));
ok("first answer published exactly (total 1), single-bucket country included");

// 6 · duplicate answer is refused. Re-sending the whole doc rewrites
// answeredAt and anchors, which stay frozen under D86's edit arm — the
// only admitted movement is the optionIdx+editedAt diff exercised in 7e.
await expectDenied("duplicate answer refused by rules", () =>
  setDoc(doc(db, "v2_users", uid, "answers", q0.id), {
    qid: q0.id, surface: "daily", optionIdx: 0,
    answeredAt: serverTimestamp(), anchors: {},
  }));

// 7 · four more voters — the count stays exact through per-answer
// publishes (cadence 1 under the pause), and the ledger keeps
// at-least-once delivery from double-counting any of them.
// Each voter gets an isolated app instance: reusing one auth while
// signing in repeatedly races the token swap against the write stream.
for (let n = 0; n < 4; n++) {
  const vApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "voter" + n);
  const vAuth = getAuth(vApp); connectAuthEmulator(vAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const vDb = getFirestore(vApp, E2E_DB_ID); connectFirestoreEmulator(vDb, "127.0.0.1", 8080);
  const u = await signInAnonymously(vAuth);
  await setDoc(doc(vDb, "v2_users", u.user.uid, "answers", q0.id), {
    qid: q0.id, surface: "daily", optionIdx: n % 2,
    answeredAt: serverTimestamp(),
    anchors: {
      ageBand: n % 2 === 0 ? "25-34" : "35-44",
      country: "NO",
      city: n < 2 ? "Oslo, NO" : "Bergen, NO",
    },
  });
}
let above = null;
for (let i = 0; i < 40; i++) {
  const snap = await getDoc(doc(db, "v2_question_aggs", q0.id));
  if (snap.exists() && snap.get("total") === 5) { above = snap.data(); break; }
  await new Promise((r) => setTimeout(r, 500));
}
if (!above) fail("public counts never reached total 5");
// votes: opt1 (first user) + opt0,opt1,opt0,opt1 → {0:2, 1:3}, total 5
if (above.counts["0"] !== 2 || above.counts["1"] !== 3)
  fail("counts wrong at total 5: " + JSON.stringify(above));
ok("five answers: exact public counts {0:2, 1:3} — no double counting");

// 7b · the breakdown, whole (D98). At total 5 the age bands hold 3 and 2
// and the cities 3 and 2, and every one of those cells publishes exactly.
// Country is a single bucket of 5 — once withheld as "a population
// statement rather than a split", now published like anything else.
const cellSum = (dim, b) => Object.values(above.by[dim][b]).reduce((a, c) => a + c, 0);
if (!above.by || !above.by.ageBand || !above.by.city)
  fail("breakdown missing: " + JSON.stringify(above.by));
if (cellSum("ageBand", "25-34") !== 3 || cellSum("ageBand", "35-44") !== 2)
  fail("age cells wrong at 3/2: " + JSON.stringify(above.by.ageBand));
if (cellSum("city", "Oslo, NO") !== 3 || cellSum("city", "Bergen, NO") !== 2)
  fail("city cells wrong at 3/2: " + JSON.stringify(above.by.city));
if (!above.by.country || cellSum("country", "NO") !== 5)
  fail("single-bucket country missing or wrong: " + JSON.stringify(above.by.country));
ok("breakdown: every cell publishes exactly, single-bucket country included");

// 7c · five more voters. Two into 25-34 and three into 35-44 lands both
// bands on exactly 5 at a total of 10. Country stays a single bucket and
// must keep publishing.
for (let m = 0; m < 5; m++) {
  const vApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "band" + m);
  const vAuth = getAuth(vApp); connectAuthEmulator(vAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const vDb = getFirestore(vApp, E2E_DB_ID); connectFirestoreEmulator(vDb, "127.0.0.1", 8080);
  const u = await signInAnonymously(vAuth);
  await setDoc(doc(vDb, "v2_users", u.user.uid, "answers", q0.id), {
    qid: q0.id, surface: "daily", optionIdx: 0,
    answeredAt: serverTimestamp(),
    anchors: {
      ageBand: m < 2 ? "25-34" : "35-44",
      country: "NO",
      city: m < 2 ? "Oslo, NO" : "Bergen, NO",
    },
  });
}
let split = null;
for (let i = 0; i < 40; i++) {
  const snap = await getDoc(doc(db, "v2_question_aggs", q0.id));
  if (snap.exists() && snap.get("total") === 10) { split = snap.data(); break; }
  await new Promise((r) => setTimeout(r, 500));
}
if (!split) fail("public agg never reached total 10");
if (!split.by || !split.by.ageBand) fail("breakdown missing at 6/5: " + JSON.stringify(split.by));
const bands = Object.keys(split.by.ageBand).sort();
if (bands.length !== 2 || bands[0] !== "25-34" || bands[1] !== "35-44")
  fail("wrong age buckets published: " + JSON.stringify(split.by.ageBand));
const bandTotal = (b) => Object.values(split.by.ageBand[b]).reduce((a, c) => a + c, 0);
if (bandTotal("25-34") !== 5 || bandTotal("35-44") !== 5)
  fail("age bucket totals wrong: " + JSON.stringify(split.by.ageBand));
if (!split.by.country) fail("single-bucket country missing: " + JSON.stringify(split.by));

// The dimension D9 added, through the real trigger rather than a unit test:
// the canonical "Name, CC" key survives being a Firestore map key, and lands
// 5/5 exactly like the age bands.
if (!split.by.city) fail("city dimension missing at 5/5: " + JSON.stringify(split.by));
const cities = Object.keys(split.by.city).sort();
if (cities.length !== 2 || cities[0] !== "Bergen, NO" || cities[1] !== "Oslo, NO")
  fail("wrong city buckets published: " + JSON.stringify(split.by.city));
const cityTotal = (c) => Object.values(split.by.city[c]).reduce((a, x) => a + x, 0);
if (cityTotal("Oslo, NO") !== 5 || cityTotal("Bergen, NO") !== 5)
  fail("city bucket totals wrong: " + JSON.stringify(split.by.city));
ok("breakdown: ageBand and city both 5/5; single-bucket country published");

// 7d · per-answer publishing (D98). The 11th answer must move the public
// mirror to an exact 11 promptly. The batched choreography this replaces
// — an 11th answer must NOT move the mirror off the multiple of 5 — is
// gone with the cadence it guarded.
{
  const vApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "cadence");
  const vAuth = getAuth(vApp); connectAuthEmulator(vAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const vDb = getFirestore(vApp, E2E_DB_ID); connectFirestoreEmulator(vDb, "127.0.0.1", 8080);
  const u = await signInAnonymously(vAuth);
  await setDoc(doc(vDb, "v2_users", u.user.uid, "answers", q0.id), {
    qid: q0.id, surface: "daily", optionIdx: 0,
    answeredAt: serverTimestamp(), anchors: { ageBand: "25-34", country: "Norway" },
  });
  let eleven = null;
  for (let i = 0; i < 20; i++) {
    const snap = await getDoc(doc(db, "v2_question_aggs", q0.id));
    if (snap.exists() && snap.get("total") === 11) { eleven = snap.data(); break; }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!eleven) fail("11th answer never published");
  // 10 answers stood at {0:7, 1:3}; the 11th is another option 0.
  if (eleven.counts["0"] !== 8 || eleven.counts["1"] !== 3)
    fail("counts drifted through per-answer publishes: " + JSON.stringify(eleven.counts));
  ok("per-answer publishing: 11th answer published exactly (total 11, counts 8/3)");
}

// 7e · D86: the owner moves their answer and onV2AnswerUpdated folds a
// -old/+new delta with the TOTAL unchanged. The first user holds option 1
// under a frozen {25-34, NO, Oslo} snapshot, so the move must land in
// exactly those cells: the 25-34 band and the Oslo bucket keep their
// TOTALS (6 and 5 — the floor's quantity never moves on an edit) while
// their option splits shift by one. Under D81's pause the edit republishes
// immediately; when the constants restore, edits ride the next create's
// publish instead (EDITS_REPUBLISH, functions/src/v2.ts).
{
  // The rules surface first — every frozen field refused, in the same
  // deny-code-checked way the create probes use.
  await expectDenied("edit refusing an anchors change (the cohort is frozen, D8)", () =>
    updateDoc(doc(db, "v2_users", uid, "answers", q0.id), {
      optionIdx: 0, editedAt: serverTimestamp(), anchors: { ageBand: "35-44" },
    }));
  await expectDenied("edit refusing an answeredAt rewrite", () =>
    updateDoc(doc(db, "v2_users", uid, "answers", q0.id), {
      optionIdx: 0, editedAt: serverTimestamp(), answeredAt: serverTimestamp(),
    }));
  await expectDenied("edit refusing a missing audit stamp", () =>
    updateDoc(doc(db, "v2_users", uid, "answers", q0.id), { optionIdx: 0 }));
  await expectDenied("edit refusing an out-of-range option", () =>
    updateDoc(doc(db, "v2_users", uid, "answers", q0.id), {
      optionIdx: 99, editedAt: serverTimestamp(),
    }));

  await updateDoc(doc(db, "v2_users", uid, "answers", q0.id), {
    optionIdx: 0, editedAt: serverTimestamp(),
  });
  let moved = null;
  for (let i = 0; i < 20; i++) {
    const snap = await getDoc(doc(db, "v2_question_aggs", q0.id));
    if (snap.exists() && (snap.get("counts") || {})["0"] === 9) { moved = snap.data(); break; }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!moved) fail("D86 edit never reached the public mirror");
  if (moved.total !== 11 || moved.counts["0"] !== 9 || moved.counts["1"] !== 2)
    fail("edit did not move -old/+new with total unchanged: " + JSON.stringify(moved));
  // The 25-34 band held user1(1→0), n0, n2, m0, m1 and the cadence voter,
  // all option 0 after the move — and the emptied "1" row must be GONE,
  // not stored as a zero (the create path's invariant, kept by the delta).
  if (JSON.stringify(moved.by.ageBand["25-34"]) !== JSON.stringify({ "0": 6 }))
    fail("edit did not move inside the frozen age cell: " + JSON.stringify(moved.by.ageBand));
  const b35 = Object.values(moved.by.ageBand["35-44"]).reduce((a, c) => a + c, 0);
  if (b35 !== 5) fail("a cell the edit never touched moved: " + JSON.stringify(moved.by.ageBand));
  if (JSON.stringify(moved.by.city["Oslo, NO"]) !== JSON.stringify({ "0": 4, "1": 1 }))
    fail("edit did not move inside the frozen city cell: " + JSON.stringify(moved.by.city));
  const bergen = Object.values(moved.by.city["Bergen, NO"]).reduce((a, c) => a + c, 0);
  if (bergen !== 5) fail("Bergen moved on an Oslo edit: " + JSON.stringify(moved.by.city));
  // The single-bucket country dimension publishes on the edit path too,
  // and the edit must have moved WITHIN it: 8/2 after one voter's 1→0.
  if (!moved.by.country || JSON.stringify(moved.by.country.NO) !== JSON.stringify({ "0": 8, "1": 2 }))
    fail("edit did not move inside the country cell: " + JSON.stringify(moved.by.country));

  // …and not again inside the minute: the cooldown is the write-amplification
  // bound on the one repeatable answer write (D7's arithmetic).
  await expectDenied("second edit inside the 60s cooldown", () =>
    updateDoc(doc(db, "v2_users", uid, "answers", q0.id), {
      optionIdx: 1, editedAt: serverTimestamp(),
    }));
  ok("D86 edit: -old/+new published, total 11 held, frozen cells moved cleanly, cooldown holds");
}

// 8 · the duel loop: create → join by code → sealed answers → reveal → streak
const YESTER = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const created = await httpsCallable(fns, "createGroupV2")({ name: "The Crew", mode: "duo" });
const { gid, inviteCode } = created.data;
if (!gid || !inviteCode) fail("createGroupV2: " + JSON.stringify(created.data));
ok("duo created: " + gid + " code " + inviteCode);

// partner on an isolated app (avoids the shared-auth race)
const pApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "partner");
const pAuth = getAuth(pApp); connectAuthEmulator(pAuth, "http://127.0.0.1:9099", { disableWarnings: true });
const pDb = getFirestore(pApp, E2E_DB_ID); connectFirestoreEmulator(pDb, "127.0.0.1", 8080);
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

// 8b · the pending-day marker, and the INDEXED scan the schedule uses.
//
// The reveal above went through revealDuelsNowV2's default FULL scan, which
// reads every group and therefore cannot tell whether the marker works. The
// schedule does not do that — it queries
// `where("pendingDays","array-contains",day)` and only sees groups the
// answer trigger has marked. So the marker is on the critical path in
// production and on no path at all in the test above; this leg closes that.
//
// The wait is what the full scan exists to avoid: the marker is written by
// onV2AnswerCreated, so it is Eventarc-asynchronous, and an indexed scan
// fired immediately would be racing it. In production that race is free (the
// scan runs every 2h), but a test has to wait for it explicitly.
{
  const mkGroup = await httpsCallable(fns, "createGroupV2")({ name: "Marker Crew", mode: "group" });
  const mkGid = mkGroup.data.gid;
  const mkDay = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  await setDoc(doc(db, "v2_users", uid, "answers", `g_${mkGid}_${mkDay}`), {
    qid: "group-gu0", surface: "group", optionIdx: 1,
    gid: mkGid, day: mkDay, answeredAt: serverTimestamp(), anchors: {},
  });

  let marked = false;
  for (let i = 0; i < 25 && !marked; i++) {
    await new Promise((r) => setTimeout(r, 400));
    const s = await getDoc(doc(db, "v2_groups", mkGid));
    marked = (s.get("pendingDays") || []).includes(mkDay);
  }
  if (!marked) fail("onV2AnswerCreated never marked pendingDays — the indexed scan would see nothing");
  ok("answer trigger marked the group's pending day");

  const idx = await httpsCallable(fns, "revealDuelsNowV2")({ day: mkDay, scan: "indexed" });
  if (idx.data.mode !== "indexed") fail("scan mode not honoured: " + JSON.stringify(idx.data));
  if (idx.data.revealed < 1) fail("indexed scan revealed nothing — the marker query missed the group");
  if (!(await getDoc(doc(db, "v2_groups", mkGid, "reveals", mkDay))).exists())
    fail("indexed scan reported a reveal that is not there");
  ok("indexed scan found the marked group and revealed it");

  // Settling the day must clear it, or every later run re-reads this group
  // for a day it has already published.
  const after = await getDoc(doc(db, "v2_groups", mkGid));
  if ((after.get("pendingDays") || []).includes(mkDay))
    fail("the revealed day is still pending — the scan would loop on it");
  ok("the reveal cleared its own pending day");

  // …and the query really is a filter: a second indexed run for the same day
  // now matches nothing, where the full scan would still walk every group.
  const again = await httpsCallable(fns, "revealDuelsNowV2")({ day: mkDay, scan: "indexed" });
  if (again.data.scanned !== 0)
    fail("indexed rerun scanned " + again.data.scanned + " groups; expected 0 once nothing is pending");
  ok("indexed rerun reads nothing once the day is settled");
}

// 9 · non-membership and post-reveal are SEPARATE denials. The old single
// check conflated them with a uid fallback of "x", so it had three
// independent reasons to fail and proved none of them.

// 9a · a non-member cannot answer, even on a day that is still open.
const OTHERDAY = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
const outApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "outsider");
const outAuth = getAuth(outApp); connectAuthEmulator(outAuth, "http://127.0.0.1:9099", { disableWarnings: true });
const outDb = getFirestore(outApp, E2E_DB_ID); connectFirestoreEmulator(outDb, "127.0.0.1", 8080);
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
const lateDb = getFirestore(lateApp, E2E_DB_ID); connectFirestoreEmulator(lateDb, "127.0.0.1", 8080);
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
// Read as the CREATOR, who played this day. This used to read as the
// latecomer, which asserted the leak D55 §9 closed as though it were the
// contract: OTHERDAY is three days before either account joined the group,
// and the latecomer never played it.
if (!(await getDoc(doc(db, "v2_groups", lateGid, "reveals", OTHERDAY))).exists())
  fail("group reveal doc missing");
// …and since D98 the latecomer reaches it too. The read used to be scoped
// to the members the reveal itself recorded, so a joiner got nothing for a
// day before they joined — a privacy guarantee about answers, and D98
// retired it: the votes inside a reveal are ordinary answers, readable
// directly, so withholding the materialized copy protected nothing.
//
// What the `members` array still does is bookkeeping — deleteAccount
// scrubs a departing uid out of it, which e2e-delete-account asserts.
{
  const lateRead = await getDoc(doc(lateDb, "v2_groups", lateGid, "reveals", OTHERDAY));
  if (!lateRead.exists()) fail("a joiner could not read a past reveal — D98 opened this");
  if (!(lateRead.get("members") || []).includes(uid))
    fail("the reveal lost its members snapshot: " + JSON.stringify(lateRead.data()));
  ok("a joiner reads a reveal from before they joined, and it still records who was there");
}
await expectDenied("member cannot answer a day already revealed", () =>
  setDoc(doc(lateDb, "v2_users", latecomer.user.uid, "answers", lateAid), groupAnswer(0)));

// duel answers must NOT leak into world aggregates
const duelAgg = await getDoc(doc(db, "v2_question_aggs", "group-gu0"));
if (duelAgg.exists()) fail("duel answers leaked into world aggregates");
ok("duel answers stay out of world aggregates");

// 9 · learn (D32): first attempts ride the same fold as votes — the same
// paused floor (D81), the counts are a people-rate, and a retry has
// nothing it may write. The trigger is deliberately untouched by D32,
// which is exactly what this leg proves: a learn answer aggregates with
// zero server-side learn code.
const LQ = "learn-cell1";
// the primary user's first attempt — wrong, picked the trap (option 2)
await setDoc(doc(db, "v2_users", uid, "answers", LQ), {
  qid: LQ, surface: "learn", optionIdx: 2,
  answeredAt: serverTimestamp(), anchors: {},
});
// the scheduler's spaced retry — refused by the create-only rule, so the
// crowd stat cannot double-count even a client that skips the
// first-attempt gate entirely
await expectDenied("learn retry refused (people-rate, not attempt-rate)", () =>
  setDoc(doc(db, "v2_users", uid, "answers", LQ), {
    qid: LQ, surface: "learn", optionIdx: 0,
    answeredAt: serverTimestamp(), anchors: {},
  }));
// …and D86's edit arm does not reach it either ("not knowledge,
// obviously"): a correctly-stamped edit on a learn answer is refused by
// the surface check, so the first-attempt measurement survives the one
// write shape that IS repeatable elsewhere.
await expectDenied("learn edit refused (D86 stops at opinion surfaces)", () =>
  updateDoc(doc(db, "v2_users", uid, "answers", LQ), {
    optionIdx: 0, editedAt: serverTimestamp(),
  }));
let lpub = null;
for (let i = 0; i < 40; i++) {
  const snap = await getDoc(doc(db, "v2_question_aggs", LQ));
  if (snap.exists()) { lpub = snap.data(); break; }
  await new Promise((r) => setTimeout(r, 500));
}
// Two failures, two messages — the same split the world-question check at
// the top of this file already makes. Collapsed into one, a TIMEOUT here
// reports itself as a counts mismatch on null, which reads as a privacy
// regression and sends the next person hunting for one. It cost exactly
// that detour on 2026-08-05.
if (!lpub) fail(`learn public agg never appeared after ${40 * 500}ms — the trigger did not fire, or did not finish in time`);
// Paused floor: the single first attempt publishes exactly (D81) — and the
// retry the rules refused above must not have nudged it.
if (lpub.total !== 1 || !lpub.counts || lpub.counts["2"] !== 1)
  fail("learn first attempt did not publish exactly: " + JSON.stringify(lpub));
ok("learn: one first attempt, published exactly, retry not counted");
// four more first attempts: three right, one more wrong
for (let n = 0; n < 4; n++) {
  const lApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "learner" + n);
  const lAuth = getAuth(lApp); connectAuthEmulator(lAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const lDb = getFirestore(lApp, E2E_DB_ID); connectFirestoreEmulator(lDb, "127.0.0.1", 8080);
  const u = await signInAnonymously(lAuth);
  await setDoc(doc(lDb, "v2_users", u.user.uid, "answers", LQ), {
    qid: LQ, surface: "learn", optionIdx: n < 3 ? 0 : 1,
    answeredAt: serverTimestamp(), anchors: {},
  });
}
let labove = null;
for (let i = 0; i < 40; i++) {
  const snap = await getDoc(doc(db, "v2_question_aggs", LQ));
  if (snap.exists() && snap.get("total") === 5) { labove = snap.data(); break; }
  await new Promise((r) => setTimeout(r, 500));
}
if (!labove) fail("learn counts never reached total 5");
// trap, then 0,0,0,1 → {0:3, 1:1, 2:1}, total 5. "% got it right" is
// counts[correct]/total = 3/5, computed client-side — the server never
// learned which option was correct.
if (labove.counts["0"] !== 3 || labove.counts["1"] !== 1 || labove.counts["2"] !== 1)
  fail("learn counts wrong at total 5: " + JSON.stringify(labove));
ok("learn crowd stat: 5 first attempts, exact through per-answer publishes, 3/5 right");


// 10 · Near presence (D84 / D174 / D176 / D177): the write path through
// the rules, the count and the ROOM through the real callables, and the
// gate that says you may only ask about a room you are standing in.
//
// `until` IS REQUIRED SINCE D174 and this block did not carry it, which
// is how the e2e went red without anyone seeing: the unit, rules and
// functions suites all pass without a functions emulator, and this is the
// only suite that exercises a client write against the deployed rules AND
// a callable behind them. Found by running it, two commits late.
{
  const meCell = "5999_1074";
  const soon = () => new Date(Date.now() + 60 * 60_000);
  // `until` is when the position stops counting (D174) and the rules cap
  // it at PRESENCE_LINGER_MIN; `type` is the archetype the phone writes
  // for itself (D176), which is the only thing the room's mix folds from.
  await setDoc(doc(db, "v2_presence", uid), {
    cell: meCell, at: serverTimestamp(), until: soon(), type: "Host",
  });
  ok("presence: own cell written through the rules, with an until and a type");
  // A neighbor one cell east; a third phone far away that must not count.
  const nApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "near1");
  const nAuth = getAuth(nApp); connectAuthEmulator(nAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const nDb = getFirestore(nApp, E2E_DB_ID); connectFirestoreEmulator(nDb, "127.0.0.1", 8080);
  const nu = await signInAnonymously(nAuth);
  await setDoc(doc(nDb, "v2_presence", nu.user.uid), {
    cell: "5999_1075", at: serverTimestamp(), until: soon(), type: "Explorer",
  });
  const fApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "near2");
  const fAuth = getAuth(fApp); connectAuthEmulator(fAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const fDb = getFirestore(fApp, E2E_DB_ID); connectFirestoreEmulator(fDb, "127.0.0.1", 8080);
  const fu = await signInAnonymously(fAuth);
  await setDoc(doc(fDb, "v2_presence", fu.user.uid), {
    cell: "5980_1074", at: serverTimestamp(), until: soon(),
  });
  // Back to the primary user for the count. The callable excludes the
  // caller's own doc, so the answer is the one neighbor — not 2, not 3.
  const near = await httpsCallable(fns, "nearbyCountV2")({ cell: meCell });
  if (near.data.n !== 1) fail("nearby count wrong: " + JSON.stringify(near.data));
  ok("nearbyCountV2: one fresh neighbor counted, self excluded, far phone ignored");
  // The mix refuses under ROOM_MIN_TYPED (8) rather than drawing a room of
  // two — a composition that moves as one person arrives tells you an
  // individual's type by subtraction.
  if (near.data.mix != null) fail("room mix drawn under the floor: " + JSON.stringify(near.data.mix));
  ok("nearbyCountV2: the mix stays silent below ROOM_MIN_TYPED");

  // THE ROOM (D177). The roster is the largest thing presence has ever
  // been asked to give up, so what this proves is the pair: the neighbor
  // is disclosed, and the caller is not in their own room.
  const room = await httpsCallable(fns, "nearbyRoomV2")({ cell: meCell, qids: [q0.id] });
  const uids = (room.data.people || []).map((p) => p.uid);
  if (uids.length !== 1 || uids[0] !== nu.user.uid) {
    fail("room roster wrong: " + JSON.stringify(room.data.people));
  }
  if (uids.includes(uid)) fail("the caller is in their own room");
  ok("nearbyRoomV2: the neighbor is in the room, the caller is not");
  if (!room.data.qs || typeof room.data.qs !== "object" || !(q0.id in room.data.qs)) {
    fail("room answers missing the question asked for: " + JSON.stringify(room.data.qs));
  }
  ok("nearbyRoomV2: the question asked about came back folded");

  // THE GATE, which is what makes the roster defensible at all (D177). A
  // caller may only ask about a neighbourhood their OWN live position is
  // in — otherwise a modified client walks the grid and the room becomes
  // a people-finder, which is precisely what v2_presence's read deny
  // exists to prevent, arriving through a callable instead of a query.
  const expectRefused = async (label, app, name, data) => {
    const f = getFunctions(app, "us-central1");
    connectFunctionsEmulator(f, "127.0.0.1", 5001);
    try {
      await httpsCallable(f, name)(data);
    } catch (e) {
      if (e?.code === "functions/failed-precondition") return ok(label);
      return fail(`${label} — expected failed-precondition, got ${e?.code || e}`);
    }
    fail(`${label} — the call was ALLOWED`);
  };
  await expectRefused("the far phone cannot read a room it is not in (count)", fApp,
    "nearbyCountV2", { cell: meCell });
  await expectRefused("the far phone cannot read a room it is not in (roster)", fApp,
    "nearbyRoomV2", { cell: meCell, qids: [] });
  // And a phone with no position at all is not in any room. Deliberately
  // a THIRD account rather than a deleted doc: "never opted in" is the
  // default state, and it is the one an attacker would be in.
  const gApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "near3");
  const gAuth = getAuth(gApp); connectAuthEmulator(gAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  await signInAnonymously(gAuth);
  await expectRefused("a phone with no presence at all is in no room", gApp,
    "nearbyRoomV2", { cell: meCell, qids: [] });

  // THE DEPLOY-ORDER WINDOW, END TO END (D179). This is the leg that says
  // an install predating D174 still works across the merge: rules deploy on
  // push to main, the app ships through a store review, and in between the
  // newest build in the wild writes `{cell, at}` and nothing else.
  //
  // Driven through a FOURTH account so the primary user's own compliant
  // document is not disturbed, and asserted three ways: the legacy write is
  // accepted, the caller is still admitted by the gate, and the server has
  // BACKFILLED the field so the window closes itself rather than leaving
  // that phone uncounted by everyone else.
  {
    const lApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "near4");
    const lAuth = getAuth(lApp); connectAuthEmulator(lAuth, "http://127.0.0.1:9099", { disableWarnings: true });
    const lDb = getFirestore(lApp, E2E_DB_ID); connectFirestoreEmulator(lDb, "127.0.0.1", 8080);
    const lu = await signInAnonymously(lAuth);
    await setDoc(doc(lDb, "v2_presence", lu.user.uid), {
      cell: meCell, at: serverTimestamp(),
    });
    ok("legacy presence write (no `until`) still accepted by the rules");
    const lFns = getFunctions(lApp, "us-central1");
    connectFunctionsEmulator(lFns, "127.0.0.1", 5001);
    const legacy = await httpsCallable(lFns, "nearbyCountV2")({ cell: meCell });
    if (typeof legacy.data.n !== "number") {
      fail("a legacy phone was refused its own count: " + JSON.stringify(legacy.data));
    }
    ok("nearbyCountV2 admits a phone whose position predates the `until` field");
    // The self-repair. Without it the count filters `until > now`, which
    // skips a document missing the field entirely — so the phone would be
    // admitted and then be invisible to everybody else.
    const back = await adminDb.doc(`v2_presence/${lu.user.uid}`).get();
    if (!back.get("until")) fail("the legacy presence doc was not backfilled with an `until`");
    ok("…and backfills its `until`, so the compatibility window closes itself");
  }

  await expectDenied("foreign presence write refused", () =>
    setDoc(doc(db, "v2_presence", nu.user.uid), {
      cell: meCell, at: serverTimestamp(), until: soon(),
    }));
  await expectDenied("raw-coordinate cell refused by the grid regex", () =>
    setDoc(doc(db, "v2_presence", uid), {
      cell: "59.913_10.752", at: serverTimestamp(), until: soon(),
    }));
  // The `until` cap (D174): a client cannot grant itself a longer stay
  // than PRESENCE_LINGER_MIN, which is the write-side half of the read
  // deny — an uncapped position stands in the room forever.
  await expectDenied("an until past the linger refused", () =>
    setDoc(doc(db, "v2_presence", uid), {
      cell: meCell, at: serverTimestamp(),
      until: new Date(Date.now() + 4 * 60 * 60_000),
    }));
}

// 10b · The daily pulse (D139): a day-keyed answer through the rules, the
// UNTOUCHED trigger folding it into a PER-DAY aggregate doc — the grain
// the whole design rests on — and the one-per-day discipline holding.
{
  const day = new Date().toISOString().slice(0, 10);
  const pid = `pulse-pace_${day}`;
  await setDoc(doc(db, "v2_users", uid, "answers", pid), {
    qid: pid, baseQid: "pulse-pace", day, surface: "pulse", optionIdx: 3,
    answeredAt: serverTimestamp(),
    anchors: { ageBand: "25-34", country: "NO", city: "Oslo, NO" },
  });
  ok("pulse answer written: " + pid);
  let pagg = null;
  for (let i = 0; i < 30; i++) {
    const snap = await getDoc(doc(db, "v2_question_aggs", pid));
    if (snap.exists()) { pagg = snap.data(); break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!pagg) fail("per-day pulse agg never appeared — the trigger refused the composite qid");
  if (pagg.total !== 1 || pagg.counts["3"] !== 1) {
    fail("pulse agg wrong: " + JSON.stringify(pagg));
  }
  if (!pagg.by || !pagg.by.city || pagg.by.city["Oslo, NO"]["3"] !== 1) {
    fail("pulse agg carries no city cell: " + JSON.stringify(pagg.by));
  }
  ok("per-day pulse aggregate published, anchors breakdown included");
  await expectDenied("a second pulse answer for the same day refused", () =>
    setDoc(doc(db, "v2_users", uid, "answers", pid), {
      qid: pid, baseQid: "pulse-pace", day, surface: "pulse", optionIdx: 1,
      answeredAt: serverTimestamp(), anchors: {},
    }));
}

// 11 · Suggest a question (docs/NEXT-FUNCTIONALITY.md §6): the callable
// door, its refusals in their specific codes, and the operator loop. The
// budget and the sold-inventory tripwire live only in the callable —
// rules.test.ts proves clients cannot write around it.
{
  // The moderation e2e's discipline: demand the SPECIFIC refusal.
  const expectCode = async (label, code, op) => {
    try {
      await op();
    } catch (e) {
      if (e?.code === code) return ok(label);
      return fail(`${label} — expected ${code}, got ${e?.code || e}`);
    }
    fail(`${label} — the operation was ALLOWED`);
  };

  const sub = await httpsCallable(fns, "suggestQuestionV2")({
    prompt: "Window seat or aisle seat?", type: "binary",
    options: ["Window", "Aisle"], topic: "travel", cadenceHint: "once", credit: true,
  });
  if (!sub.data?.id) fail("suggestQuestionV2 returned " + JSON.stringify(sub.data));
  const mine = await getDoc(doc(db, "v2_suggestions", sub.data.id));
  if (!mine.exists() || mine.get("status") !== "review" || mine.get("uid") !== uid) {
    fail("own suggestion unreadable or malformed: " + JSON.stringify(mine.data()));
  }
  ok("suggestion queued through the callable; the author reads it in review");

  // The sold-inventory decline (QUESTION-FARM hard rule 6 at the door).
  // Deliberately BEFORE the budget legs: a declined ask must not spend
  // the day's budget, and running it first would mask that if it did.
  await expectCode("place-scoped civic ask declined at the door",
    "functions/failed-precondition",
    () => httpsCallable(fns, "suggestQuestionV2")({
      prompt: "Should Oslo ban cars downtown?", type: "binary", options: ["Yes", "No"],
    }));
  await expectCode("formless submission refused",
    "functions/invalid-argument",
    () => httpsCallable(fns, "suggestQuestionV2")({ prompt: "   " }));

  // The daily budget: the decline above spent nothing, so two more pass
  // and the fourth is the one that trips.
  await httpsCallable(fns, "suggestQuestionV2")({ prompt: "Early bird or night owl?", type: "binary", options: ["Early bird", "Night owl"] });
  await httpsCallable(fns, "suggestQuestionV2")({ prompt: "Cook, or be cooked for?", type: "binary", options: ["Cook", "Be cooked for"] });
  await expectCode("fourth suggestion of the day refused (the review-pace budget)",
    "functions/resource-exhausted",
    () => httpsCallable(fns, "suggestQuestionV2")({ prompt: "Sweet or salty?", type: "binary", options: ["Sweet", "Salty"] }));

  // A second account cannot read the row — mine-only, through the rules.
  const sgApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "sugg1");
  const sgAuth = getAuth(sgApp); connectAuthEmulator(sgAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const sgDb = getFirestore(sgApp, E2E_DB_ID); connectFirestoreEmulator(sgDb, "127.0.0.1", 8080);
  await signInAnonymously(sgAuth);
  await expectDenied("stranger reading a suggestion refused", () =>
    getDoc(doc(sgDb, "v2_suggestions", sub.data.id)));

  // The operator loop: fetch lists the pending rows, a verdict settles
  // one, and a settled row cannot be re-judged (assertOperator admits any
  // signed-in caller under the emulator, the moderation e2e's note).
  const fetched = await httpsCallable(fns, "fetchSuggestionsV2")({});
  const ids = (fetched.data?.items || []).map((i) => i.id);
  if (!ids.includes(sub.data.id)) fail("operator fetch missing the queued row: " + JSON.stringify(ids));
  ok("operator fetch lists the pending queue (" + ids.length + " rows)");
  const rv = await httpsCallable(fns, "reviewSuggestionV2")({ id: sub.data.id, verdict: "picked", note: "clean split" });
  if (!rv.data?.ok) fail("review refused: " + JSON.stringify(rv.data));
  const picked = await getDoc(doc(db, "v2_suggestions", sub.data.id));
  if (picked.get("status") !== "picked" || picked.get("note") !== "clean split") {
    fail("verdict not applied: " + JSON.stringify(picked.data()));
  }
  ok("operator verdict applied; the author's board would read picked");
  await expectCode("re-judging a settled row refused",
    "functions/already-exists",
    () => httpsCallable(fns, "reviewSuggestionV2")({ id: sub.data.id, verdict: "declined" }));
  await expectCode("verdict on a row that does not exist refused",
    "functions/failed-precondition",
    () => httpsCallable(fns, "reviewSuggestionV2")({ id: "ghost", verdict: "picked" }));
}

console.log("\nALL E2E CHECKS PASSED");
process.exit(0);

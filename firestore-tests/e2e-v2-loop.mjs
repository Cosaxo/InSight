// v2 core-loop e2e — runs under `firebase emulators:exec --only auth,firestore,functions`.
// Drives the REAL client path: anonymous auth → seedContentV2 callable →
// daily question fetch → answer write → onV2AnswerCreated increments the agg.
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously } from "firebase/auth";
import {
  getFirestore, connectFirestoreEmulator, collection, collectionGroup, query,
  where, orderBy, limit, startAfter, documentId, getDocs, doc, getDoc, setDoc,
  updateDoc, serverTimestamp,
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
// The region the EMULATOR serves, taken from the functions' own compiled
// output rather than repeated here (D201). `pretest:e2e` builds it, so
// this harness cannot be pointed at a region the emulator is not on.
import { FUNCTIONS_REGION } from "../functions/lib/ops.js";
// The breakdown dims and their closed vocabularies, from the same
// compiled output — the report builder takes them as input so it never
// grows the second copy check:anchors exists to prevent.
import { BREAKDOWN_DIMS, BREAKDOWN_DIM_VOCAB } from "../functions/lib/pure.js";
// The report builder (PAID-PLAN §9.2): §7g drives it through THIS
// harness's signed-in client, so the deployed rules referee every read.
import { REPORT_READ_SET, buildReportData, makeReader, renderReportHtml } from "../scripts/report-lib.mjs";
import { expectCode, expectDenied, expectRefusal, fail, ok } from "./e2e-lib.mjs";

// The named database (D165). The backend writes to FIRESTORE_DB_ID, so a
// harness on `(default)` reads an empty database and reports a phantom
// failure — which is exactly what happened the first time this ran, and is
// the same split brain the deploy has to avoid. One constant, same env var
// as functions/src/db.ts.
const E2E_DB_ID = process.env.FIRESTORE_DB_ID || "insight";

const app = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" });
const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app, E2E_DB_ID); connectFirestoreEmulator(db, "127.0.0.1", 8080);
const fns = getFunctions(app, FUNCTIONS_REGION); connectFunctionsEmulator(fns, "127.0.0.1", 5001);
adminInit({ projectId: "demo-insight" });
const adminDb = adminFirestore(E2E_DB_ID);


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

// 3a · THE DAILY'S SEQ SPACE IS DENSE IN THE DATABASE (D382), which is the
// precondition the paged boot rests on and the one thing only this harness
// can prove. The client computes its seven deck positions from a published
// LENGTH and then asks for `seq in [...]`; that maps a position to a
// question only while the daily's seqs run 0..n-1 with no holes. Every
// other suite checks the COMPILED bank — this checks what the real seed
// actually wrote, which is the copy the device reads. A hole here is a
// device on a different question from everyone else, with no symptom
// anywhere: the deck renders, the counts publish, and the cohort readings
// quietly stop meaning "we answered the same thing".
{
  const all = await getDocs(query(
    collection(db, "v2_questions"),
    where("surface", "==", "daily"), orderBy("seq")));
  const seqs = all.docs.map((d) => d.get("seq"));
  const holes = seqs.filter((v, i) => v !== i);
  if (holes.length)
    fail("the seeded daily seq space is not dense 0..n-1 — `seq` is not a "
      + "position and the paged deck (D382) would disagree across devices; "
      + "first bad index " + seqs.findIndex((v, i) => v !== i));
  // …and the shape the nightly fold would publish agrees with it. The
  // client REFUSES the fast path unless maxSeq === n - 1, so if these ever
  // part company the daily silently reverts to fetching the whole surface.
  if (seqs.length && seqs[seqs.length - 1] !== seqs.length - 1)
    fail("maxSeq !== n - 1 on the seeded daily bank — the client would "
      + "refuse the paged deck and fetch the surface whole");
  ok("daily seq space is dense 0.." + (seqs.length - 1) + " in the database — the paged deck's precondition holds");

  // …and the Scores pool the fold would publish is drawn from documents
  // that really carry `rates` (D383). The device fetches these BY ID off
  // the published list, so an id naming a question that is not a place
  // ask is a wasted read on every boot, and one naming nothing at all is
  // a read that returns nothing forever.
  const asks = all.docs.filter((d) =>
    d.get("active") !== false && d.get("type") === "rating" && typeof d.get("rates") === "string");
  if (!asks.length)
    fail("no seeded daily doc is an active place ask — the Scores pool (D383) would be empty");
  const scopes = [...new Set(asks.map((d) => d.get("rates")))].sort();
  ok("Scores pool: " + asks.length + " place asks over " + scopes.join(", ") + " — paged by id, not queried off the surface");
}

// 3b · the doc shape the schema promises actually lands (D234). For two
// releases core/tag/rates (and until/sponsor/also/the call trio) were in
// SCHEMA-V2.md, in the client's readers — and in no write: the seed's
// payload whitelist dropped them, every client read absent, and every
// suite stayed green on self-seeded fixtures. This is the one harness
// that runs the REAL seed, so this is where that class of gap is caught.
{
  const coreQ = await getDoc(doc(db, "v2_questions", "feed-f01"));
  if (coreQ.get("core") !== true)
    fail("feed-f01 lost its core flag in the seed — the Mirror's corpus reads hydrated docs (D161/D234)");
  const ratesQ = qsnap.docs.find((d) => d.get("rates") !== undefined);
  if (!ratesQ) fail("no seeded daily doc carries `rates` — the Scores stop reads hydrated docs (D187/D234)");
  const tagQ = qsnap.docs.find((d) => typeof d.get("tag") === "string");
  if (!tagQ) fail("no seeded daily doc carries `tag` — the Scores card is a column of nouns (D187/D234)");
  // `from` (D231's window-open) arrived in a parallel thread with exactly
  // this gap and was caught at the merge — its assertion joins the leg so
  // the current-events lane cannot ship windowless the same way.
  const feedSnap = await getDocs(query(collection(db, "v2_questions"), where("surface", "==", "feed")));
  const fromQ = feedSnap.docs.find((d) => typeof d.get("from") === "string");
  if (!fromQ) fail("no seeded feed doc carries `from` — the current-events window opens off hydrated docs (D231/D234)");
  ok("seed transports the promised doc shape: core, rates, tag, from present on live docs");
}

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
//
// THE LONGEST WINDOW IN THE SUITE, and it is this step rather than a
// busier one for a reason worth keeping: this is the FIRST trigger
// delivery of the run, so it alone pays the functions runtime's cold
// start and Eventarc's first-delivery setup on top of the fold. Every
// later poll here runs against a warm runtime, which is why 20 × 400 ms
// is plenty for them and 30 × 500 ms was not always enough for this one —
// observed failing once on a sandbox runner with the trigger visibly
// executing (203 ms, no error, no log line) and the aggregate landing
// just after the poll gave up. That reads as "trigger did not fire",
// which is the most misleading message this file can print.
//
// Raised rather than retried: a first-delivery window that is sometimes
// too short is a flaky suite, and the cost of a longer ceiling is zero on
// every run that does not need it — the loop breaks the moment the
// document appears.
let pub = null;
for (let i = 0; i < 60; i++) {
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

// 7a-bis · and the second copy is gone. The trigger used to write those
// same five numbers twice — v2_aggs_private/{qid} byte-for-byte alongside
// the published doc — which is a third of its writes on every answer, for
// a document with no reader. The counts above are the proof the fold is
// right; this is the proof it costs one write to be right.
//
// Read through the ADMIN handle, because the collection is deny-all to
// clients: a client read would fail whether the document existed or not,
// which is the assertion that passes for the wrong reason.
{
  const privSnap = await adminDb.doc(`v2_aggs_private/${q0.id}`).get();
  if (privSnap.exists) {
    fail(
      "the vote path wrote v2_aggs_private/" + q0.id + " again — the private "
      + "mirror was collapsed into the published document; a second write of "
      + "a public fact is what this removed: " + JSON.stringify(privSnap.data()),
    );
  }
}
ok("no private mirror: the published aggregate is the only document the fold writes");

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
  // D226: the move itself is published — one cell of the edit-flow
  // matrix, keyed from the option the person left to the one they hold.
  if (JSON.stringify(moved.edits) !== JSON.stringify({ "1": { "0": 1 } }))
    fail("edit-flow matrix wrong after the 1→0 move: " + JSON.stringify(moved.edits));

  // …and not again inside the minute: the cooldown is the write-amplification
  // bound on the one repeatable answer write (D7's arithmetic).
  await expectDenied("second edit inside the 60s cooldown", () =>
    updateDoc(doc(db, "v2_users", uid, "answers", q0.id), {
      optionIdx: 1, editedAt: serverTimestamp(),
    }));
  ok("D86 edit: -old/+new published, total 11 held, frozen cells moved cleanly, edit-flow cell published, cooldown holds");
}

// 7f · the matrix survives the next create (D226). The create path
// rewrites both aggregate docs whole (merge: false), so a fresh answer
// arriving after an edit is exactly the write that would silently erase
// the flows if the trigger forgot to carry them through.
{
  const vApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "postedit");
  const vAuth = getAuth(vApp); connectAuthEmulator(vAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const vDb = getFirestore(vApp, E2E_DB_ID); connectFirestoreEmulator(vDb, "127.0.0.1", 8080);
  const u = await signInAnonymously(vAuth);
  await setDoc(doc(vDb, "v2_users", u.user.uid, "answers", q0.id), {
    qid: q0.id, surface: "daily", optionIdx: 1,
    answeredAt: serverTimestamp(),
    anchors: { ageBand: "35-44", country: "NO", city: "Bergen, NO" },
  });
  let twelve = null;
  for (let i = 0; i < 20; i++) {
    const snap = await getDoc(doc(db, "v2_question_aggs", q0.id));
    if (snap.exists() && snap.get("total") === 12) { twelve = snap.data(); break; }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!twelve) fail("12th answer never published");
  if (twelve.counts["0"] !== 9 || twelve.counts["1"] !== 3)
    fail("counts wrong after the post-edit create: " + JSON.stringify(twelve.counts));
  if (JSON.stringify(twelve.edits) !== JSON.stringify({ "1": { "0": 1 } }))
    fail("the create's whole-doc rewrite dropped the edit-flow matrix: " + JSON.stringify(twelve.edits));
  ok("D226: edit-flow matrix carried through the next create's rewrite");
}

// 7g · the report builder reads as a signed-in user and stays inside its
// declared set (PAID-PLAN §2/§9.2). The same guarded reader the operator
// script runs, driven through this harness's own client: every read here
// passes the deployed rules, and the reader's stats prove the build
// touched nothing beyond REPORT_READ_SET — the unit suite pins the
// refusal; this pins a real build. The numbers are 7e/7f's standing
// state: 12 answers, 9/3 after the edit, one 1→0 move in the matrix.
{
  const reader = makeReader({
    db, collection, collectionGroup, doc, getDoc, getDocs,
    query, where, orderBy, limit, startAfter, documentId,
  });
  const report = await buildReportData(reader, {
    qid: q0.id,
    vocab: { dims: BREAKDOWN_DIMS, byDim: BREAKDOWN_DIM_VOCAB },
  });
  const [c0, c1, ...restCounts] = report.counts;
  if (report.total !== 12 || c0 !== 9 || c1 !== 3 || restCounts.some((n) => n !== 0))
    fail("report split disagrees with the agg: " + JSON.stringify({ total: report.total, counts: report.counts }));
  if (report.roll.length !== 12)
    fail("report roll walked " + report.roll.length + " of 12 answers");
  if (JSON.stringify(report.edits.pairs) !== JSON.stringify([{ from: 1, to: 0, n: 1 }]))
    fail("report edit pairs wrong: " + JSON.stringify(report.edits.pairs));
  const seriesTotal = report.series.reduce((a, d) => a + d.t, 0);
  if (seriesTotal !== 12) fail("report series drops answers: " + seriesTotal + " of 12");
  const offList = Object.keys(reader.stats.reads).filter((c) => !REPORT_READ_SET.includes(c));
  if (offList.length) fail("report read outside its declared set: " + offList.join(", "));
  const html = renderReportHtml(report);
  if (!html.includes("moves, not people"))
    fail("report page lost the D226 semantics line");
  // The four type cuts (D253): nobody in this loop has taken a test, so
  // every cut is all-Untested — listed as a full row, never dropped —
  // and every named type renders at zero.
  const badCut = report.typeCuts.find((c) => c.tested !== 0 || c.rows[c.rows.length - 1].t !== 12);
  if (report.typeCuts.length !== 4 || badCut)
    fail("type cuts wrong on an untested crowd: " + JSON.stringify(report.typeCuts.map((c) => [c.kind, c.tested])));
  // …and each instrument's axes ride under it (D254), five bands +
  // Untested per axis, all twelve voters in the Untested row here too.
  const badAxis = report.typeCuts.find((c) =>
    !c.axes.length || c.axes.some((a) => a.rows.length !== 6 || a.rows[5].t !== 12));
  if (badAxis) fail("axis cuts wrong on an untested crowd: " + badAxis.kind);
  for (const needle of ["Big Five — type", "Politics — type", "Values — type", "Social — type", "Big Five · Openness"]) {
    if (!html.includes(needle)) fail("report page lost a cut: " + needle);
  }
  ok("report builder: 12-row roll, 9/3 split, the 1→0 move, four all-untested type cuts with their axis bands, every read inside REPORT_READ_SET");
}

// 7h · D290: the replay tool, against the aggregate 7e/7f just built.
// `replay.test.ts` pins the FOLD; nothing until here has executed the half
// that touches Firestore — the collection-group scan, the uid recovered
// from `doc.ref.parent.parent`, the paging cursor, the optimistic
// concurrency check, and the D226 carry through a real whole-doc rewrite.
//
// The standing state is 12 answers, counts {0:9, 1:3}, edits {1:{0:1}}.
// A rebuild of that must be a NO-OP — which is the strongest assertion
// available here, because it says the batch scan and the incremental
// trigger reached the same aggregate by different routes over the same
// answers.
//
// WHAT THIS DOES NOT PROVE: the emulator creates composite indexes on
// demand, so the `qid, answeredAt` collection-group index this scan orders
// by is exercised but not REQUIRED here. Production needs the entry in
// firestore.indexes.json; a missing one there fails the call with a
// console link rather than a wrong answer.
{
  const dry = (await httpsCallable(fns, "rebuildAggregateV2")({ qid: q0.id })).data;
  if (dry.applied !== false) fail("the rebuild wrote without --apply");
  if (dry.scanned !== 12 || dry.folded !== 12 || dry.skipped !== 0)
    fail("the scan missed answers: " + JSON.stringify(dry));
  if (dry.total !== 12 || dry.counts["0"] !== 9 || dry.counts["1"] !== 3)
    fail("replay disagrees with the trigger: " + JSON.stringify(dry.counts));
  if (dry.drift.total !== 0 || Object.keys(dry.drift.counts).length)
    fail("drift on an untouched aggregate: " + JSON.stringify(dry.drift));
  if (dry.carriedEdits !== true) fail("the stored edit matrix was not carried");
  if (dry.cappedDims.length) fail("two cities should not saturate a 24-bucket dim: " + dry.cappedDims);
  ok("D290: replay of 12 answers reproduces the trigger's aggregate exactly, drift none");

  // The dry run must not have touched the document it just described.
  const untouched = await getDoc(doc(db, "v2_question_aggs", q0.id));
  if (untouched.get("total") !== 12 || JSON.stringify(untouched.get("edits")) !== JSON.stringify({ "1": { "0": 1 } }))
    fail("the DRY run wrote: " + JSON.stringify(untouched.data()));
  ok("D290: dry run wrote nothing");

  // D28's ring subtraction, on the one uid whose answer this suite knows:
  // the primary voter, whose 1→0 edit is the matrix above — so excluding
  // them takes a vote out of option 0, not option 1.
  const less = (await httpsCallable(fns, "rebuildAggregateV2")({ qid: q0.id, exclude: [uid] })).data;
  if (less.excluded !== 1 || less.total !== 11 || less.counts["0"] !== 8 || less.counts["1"] !== 3)
    fail("exclusion did not subtract exactly one answer: " + JSON.stringify(less));
  if (less.drift.total !== -1) fail("drift should report the subtraction: " + JSON.stringify(less.drift));
  ok("D28/D290: excluding one uid subtracts exactly its answer, drift -1");

  // …and the exclusion leaves the breakdown as well as the headline: the
  // primary voter is the Oslo/25-34 cell's fourth member.
  const applied = (await httpsCallable(fns, "rebuildAggregateV2")({ qid: q0.id, apply: true })).data;
  if (applied.applied !== true || applied.total !== 12) fail("apply did not run: " + JSON.stringify(applied));
  const after = await getDoc(doc(db, "v2_question_aggs", q0.id));
  if (after.get("total") !== 12 || after.get("counts")["0"] !== 9 || after.get("counts")["1"] !== 3)
    fail("a no-op rebuild changed the counts: " + JSON.stringify(after.data()));
  if (JSON.stringify(after.get("edits")) !== JSON.stringify({ "1": { "0": 1 } }))
    fail("the rebuild's whole-doc rewrite dropped the edit matrix: " + JSON.stringify(after.get("edits")));
  if (JSON.stringify(after.get("by").ageBand) !== JSON.stringify(untouched.get("by").ageBand))
    fail("the rebuild changed the breakdown: " + JSON.stringify(after.get("by").ageBand));
  ok("D290: --apply round-trips the aggregate unchanged, matrix and breakdown intact");
}

// 7i · the empty-scan refusal. THE MOST DESTRUCTIVE THING THIS TOOL CAN DO
// is not a wrong fold — it is a right fold of nothing. The stamp guard
// above catches an aggregate written DURING the scan; it cannot catch the
// quieter case, where nobody wrote and the scan simply returned nothing.
// Then the stamps match, the guard passes, and a whole-document `set` puts
// `total: 0` over a document holding real votes.
//
// A scan returns nothing far more often because the query did not work — a
// composite index still building after a deploy, a qid that does not match
// what the answers carry — than because a question's answers are genuinely
// gone. Both look identical from inside the function, so the refusal is on
// the COMPARISON: no answers found, but something published.
//
// Found by the first production dry run (2026-08-25), which reported
// `scanned 0 … drift: none` — correct, vacuous, and one flag away from
// having overwritten something if the project had held any answers.
{
  const EMPTY = "e2e-empty-scan";
  await adminDb.doc(`v2_questions/${EMPTY}`).set({ type: "binary", options: ["a", "b"], surface: "feed" });
  await adminDb.doc(`v2_question_aggs/${EMPTY}`).set({ total: 7, counts: { 0: 4, 1: 3 }, by: {} });

  // The dry run is allowed and must SAY it compared nothing, rather than
  // reporting the -7 as if it had found a discrepancy in a fold it ran.
  const dry = (await httpsCallable(fns, "rebuildAggregateV2")({ qid: EMPTY })).data;
  if (dry.scanned !== 0) fail("the fixture is wrong — something answered " + EMPTY);
  if (dry.emptyScan !== true) fail("a zero scan did not report emptyScan: " + JSON.stringify(dry));
  if (dry.drift.total !== -7) fail("drift should be the whole published total: " + JSON.stringify(dry.drift));
  ok("D290: a zero scan reports emptyScan and the full negative drift");

  // …and applying it is refused. Demand the specific code: a bare catch
  // here would pass on the not-found this step's own fixture could cause.
  try {
    await httpsCallable(fns, "rebuildAggregateV2")({ qid: EMPTY, apply: true });
    fail("an empty scan OVERWROTE a published aggregate");
  } catch (e) {
    if (e?.code !== "functions/failed-precondition")
      fail("expected failed-precondition on an empty scan, got " + (e?.code || e));
  }
  const survived = await adminDb.doc(`v2_question_aggs/${EMPTY}`).get();
  if (survived.get("total") !== 7) fail("the refusal still wrote: " + JSON.stringify(survived.data()));
  ok("D290: --apply on an empty scan is refused, and the aggregate survives");

  // The escape hatch works, because a question's answers CAN genuinely go
  // away (an erasure sweep, a retraction) and that is the D28 repair this
  // tool exists for. What it must not be is silent.
  const forced = (await httpsCallable(fns, "rebuildAggregateV2")({ qid: EMPTY, apply: true, allowEmpty: true })).data;
  if (forced.applied !== true) fail("allowEmpty did not apply: " + JSON.stringify(forced));
  const zeroed = await adminDb.doc(`v2_question_aggs/${EMPTY}`).get();
  if (zeroed.get("total") !== 0) fail("allowEmpty did not zero it: " + JSON.stringify(zeroed.data()));
  ok("D290: allowEmpty applies the empty fold deliberately");

  await adminDb.doc(`v2_questions/${EMPTY}`).delete();
  await adminDb.doc(`v2_question_aggs/${EMPTY}`).delete();
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
const pFns = getFunctions(pApp, FUNCTIONS_REGION); connectFunctionsEmulator(pFns, "127.0.0.1", 5001);
const partner = await signInAnonymously(pAuth);
// THE LINK ASKS, IT DOES NOT ADMIT (D240). A code used to write straight
// into memberUids, which made it a bearer token with no expiry: whoever
// it was forwarded to was in, and nobody already in the circle had
// agreed to them. Now it puts the asker in `pending` and a member
// decides — so the e2e's own partner has to be let in, which is the
// point rather than a cost of the test.
const asked = await httpsCallable(pFns, "requestJoinV2")({ code: inviteCode });
if (asked.data.gid !== gid) fail("requestJoinV2 landed in wrong group");
if (asked.data.status !== "requested") {
  fail("a code admitted its holder: " + JSON.stringify(asked.data));
}
{
  const g = await adminDb.doc(`v2_groups/${gid}`).get();
  if ((g.get("memberUids") || []).includes(partner.user.uid)) {
    fail("asking to join added the member outright");
  }
  if (!(g.get("pending") || []).includes(partner.user.uid)) {
    fail("the request was not queued");
  }
}
ok("a tapped code ASKS — the asker is queued, not admitted");

// Asking twice is idempotent: the client retries on a dropped response,
// and a second row for one person would be two approvals to give.
const again = await httpsCallable(pFns, "requestJoinV2")({ code: inviteCode });
if (again.data.status !== "waiting") fail("a second ask was not idempotent: " + JSON.stringify(again.data));
ok("asking twice queues one request, not two");

// A NON-MEMBER cannot approve. Without this, approve is an add-anyone
// endpoint wearing a different name.
try {
  await httpsCallable(pFns, "approveJoinV2")({ gid, uid: partner.user.uid });
  fail("a non-member approved their own request");
} catch (e) {
  if (e?.code !== "functions/permission-denied") {
    fail("wrong refusal for a non-member approval: " + (e?.code || e));
  }
}
ok("only a member decides — the asker cannot approve themselves");

// …AND THE SAME GATE ON DECLINE, which had no test on either side while its
// twin above did. declineJoinV2 takes an arbitrary gid and an arbitrary uid
// from request.data, and this one membership check is the only thing
// stopping any signed-in account emptying any circle's join queue.
//
// The failure is invisible from both ends by design — D240's decline "tells
// them NOTHING, the row simply stops being there" — so the asker sees a
// request that is never approved and the circle sees no request at all.
// firestore.rules cannot see it either: the write is on the admin SDK.
//
// A REFUSAL, not a decline, and deliberately: an actual decline here would
// arrayRemove the pending row, and the approveJoinV2 below would then throw
// failed-precondition ("they have not asked"), taking the whole duel /
// reveal / aggregate section after it with it.
try {
  await httpsCallable(pFns, "declineJoinV2")({ gid, uid: partner.user.uid });
  fail("a non-member emptied a circle's join queue");
} catch (e) {
  if (e?.code !== "functions/permission-denied") {
    fail("wrong refusal for a non-member decline: " + (e?.code || e));
  }
}
{
  const g = await adminDb.doc(`v2_groups/${gid}`).get();
  if (!(g.get("pending") || []).includes(partner.user.uid)) {
    fail("the refused decline removed the pending row anyway");
  }
}
ok("a non-member cannot decline either — and the refusal wrote nothing");

const joined = await httpsCallable(fns, "approveJoinV2")({ gid, uid: partner.user.uid });
if (!joined.data?.ok) fail("approveJoinV2 refused: " + JSON.stringify(joined.data));
{
  const g = await adminDb.doc(`v2_groups/${gid}`).get();
  if (!(g.get("memberUids") || []).includes(partner.user.uid)) fail("approval did not add the member");
  if ((g.get("pending") || []).includes(partner.user.uid)) fail("approval left the request queued");
  if ((g.get("pendingNames") || {})[partner.user.uid]) fail("approval left the name behind");
}
ok("a member let them in; the queue entry and its name are gone");

const aid = `g_${gid}_${YESTER}`;
// A DUO-surface question, because this group is mode "duo" (line 490) and
// isDuelAnswer compares the question's surface to the answer's. duelQFor
// (data/deck.ts) draws with `q.surface === mode`, so "group-gu0" under a
// duo group was a shape no client could produce — it only ever passed
// because the rule did not look.
const duel = (idx, guess) => ({
  qid: "duo-001", surface: "duo", optionIdx: idx, guessIdx: guess,
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
    // duo-001 for the same reason as the duel helper above: this is the
    // duo group, and the refusal under test is non-membership, so the rest
    // of the shape has to be one a real client would write.
    qid: "duo-001", surface: "duo", optionIdx: 0, guessIdx: 0,
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
const lateFns = getFunctions(lateApp, FUNCTIONS_REGION); connectFunctionsEmulator(lateFns, "127.0.0.1", 5001);
const latecomer = await signInAnonymously(lateAuth);
// Same two steps as the partner above (D240): ask, then be let in by
// somebody already there.
await httpsCallable(lateFns, "requestJoinV2")({ code: gCreated.data.inviteCode });
await httpsCallable(fns, "approveJoinV2")({ gid: lateGid, uid: latecomer.user.uid });

// THE JOINER'S OWN LIMIT, on the one admission path that never checked it.
// Creating a circle, ASKING to join one and accepting an invite all assert
// how many circles an account may be in; approve checked only whether the
// circle had room. So somebody else's tap could put an account past the
// cap — and that cap is what bounds deleteAccount's group walk, which has
// no limit of its own.
//
// Twenty is the cap, and creating twenty is how an account reaches it
// honestly (the twenty-first create is refused by the same bound, which is
// the control below).
{
  const capApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "capjoiner");
  const capAuth = getAuth(capApp); connectAuthEmulator(capAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const capFns = getFunctions(capApp, FUNCTIONS_REGION); connectFunctionsEmulator(capFns, "127.0.0.1", 5001);
  const capUser = await signInAnonymously(capAuth);
  // ORDER MATTERS, and it is the whole reason this path needed its own
  // check. Asking to join asserts the cap too, so an account already at
  // twenty cannot even ask — the only way to arrive at an approval over
  // the cap is to ask while under it and cross it before somebody taps
  // "Let in". So: nineteen circles, then the request, then the twentieth.
  for (let i = 0; i < 19; i++) {
    await httpsCallable(capFns, "createGroupV2")({ name: `Cap ${i}`, mode: "group" });
  }
  const host = await httpsCallable(fns, "createGroupV2")({ name: "One More", mode: "group" });
  await httpsCallable(capFns, "requestJoinV2")({ code: host.data.inviteCode });
  await httpsCallable(capFns, "createGroupV2")({ name: "Cap 19", mode: "group" });
  await expectCode("a twenty-first circle of their own refused",
    "functions/resource-exhausted",
    () => httpsCallable(capFns, "createGroupV2")({ name: "Cap 20", mode: "group" }));
  await expectCode("letting in someone already in twenty circles refused",
    "functions/resource-exhausted",
    () => httpsCallable(fns, "approveJoinV2")({ gid: host.data.gid, uid: capUser.user.uid }));
  ok("the joiner's membership cap holds on the approval path");
}

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
  // …and it names NOBODY it does not list as having been there.
  //
  // This fixture is the leak's exact shape and had been sitting here
  // unasserted: the latecomer joined after OTHERDAY ended and never
  // played, so `revealMembersFor` drops them from `members` — while the
  // `names` map was built over the group's whole roster and named them
  // anyway. Leave the circle after that and `deleteAccount`'s
  // membership-independent sweep, which walks `members`, cannot reach the
  // name; it stays in a document every signed-in user may read (D98's
  // read rule), against what web/privacy.html promises in writing.
  //
  // Asserted as an INVARIANT of the document rather than by naming the
  // latecomer, because the guarantee is about the pair of fields and not
  // about this fixture: any future writer that puts a name in without
  // putting the person in `members` fails here.
  {
    const lateRead = await getDoc(doc(lateDb, "v2_groups", lateGid, "reveals", OTHERDAY));
    const names = lateRead.get("names") || {};
    const listed = lateRead.get("members") || [];
    const stray = Object.keys(names).filter((u) => !listed.includes(u));
    if (stray.length)
      fail("the reveal names people it does not record as there: " + JSON.stringify(stray)
        + " — members " + JSON.stringify(listed));
    if (!Object.keys(names).length)
      fail("the reveal named nobody at all — the assertion above would pass on an empty map");
    ok("the reveal names only the people it records as having been there");
  }
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
// 60 × 500 ms, matching the FIRST wait in this file rather than the warm
// ones — raised from 40 after the feed lane counted five timeouts here.
//
// Why this poll is not the warm case the comment at the top describes: the
// learn write is the only fold in the suite that runs the answer-key and
// logic-scoring arm as well as the ledger, and it lands after the deny
// block above, whose three refusals invoke no function at all. So this is
// a second first-delivery window under the heaviest per-answer work in
// the file, not the steady state 20 × 400 ms is plenty for.
//
// Raised rather than retried, on that comment's own argument: a retry
// loop around a poll is still a poll with a longer ceiling, only harder
// to read — and the cost of the longer ceiling is zero on every run that
// does not need it, because the loop breaks the moment the document
// appears. What a longer ceiling buys is that the message below stops
// lying: a timeout here prints "the trigger did not fire", which is the
// most misleading sentence this file can produce.
// One constant, because the ceiling was written twice — the loop bound and
// the failure message's own `40 * 500` — and a message that quotes a number
// the loop no longer uses is this repo's most-repeated documentation error
// pointed at a test.
const LEARN_TRIES = 60;
const LEARN_EVERY = 500;
let lpub = null;
for (let i = 0; i < LEARN_TRIES; i++) {
  const snap = await getDoc(doc(db, "v2_question_aggs", LQ));
  if (snap.exists()) { lpub = snap.data(); break; }
  await new Promise((r) => setTimeout(r, LEARN_EVERY));
}
// Two failures, two messages — the same split the world-question check at
// the top of this file already makes. Collapsed into one, a TIMEOUT here
// reports itself as a counts mismatch on null, which reads as a privacy
// regression and sends the next person hunting for one. It cost exactly
// that detour on 2026-08-05.
if (!lpub) fail(`learn public agg never appeared after ${LEARN_TRIES * LEARN_EVERY}ms — the trigger did not fire, or did not finish in time`);
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

// The catalog and rank question ids, hoisted because THREE steps need
// them now: 9c and 9d drive their folds, and 9e rebuilds both. Two string
// literals is a small thing to copy and a copy is how they drift — the
// same argument pure.ts makes about `breakdownFor`.
const PK_ID = "pick-pk04"; // "Your most-used emoji?" — content/pick-questions.json
const RQ_ID = "feed-f03";  // "Pure athleticism — rank them", 4 items

// 9c · catalog picks (D14 gone live): an entity answer rides the same
// create-only path, and the trigger folds it through the CANON — the
// top/rest board plus per-segment orderings (D17) — instead of
// per-option counts. The refusals sit exactly where the design puts
// them: rules refuse the wrong SHAPES (each branch's hasOnly keeps the
// other's field out; the D86 edit arm requires an old doc carrying
// optionIdx), while a wrong KEY passes rules and dies at the trigger,
// validated against the committed catalogue — an unknown key never
// aggregates.
{
  const PK = PK_ID;
  const pkDoc = await getDoc(doc(db, "v2_questions", PK));
  if (!pkDoc.exists() || pkDoc.get("type") !== "catalog" || pkDoc.get("domain") !== "emoji")
    fail("the pick seed did not land as a catalog doc: " + JSON.stringify(pkDoc.data() || null));
  ok("pick question seeded: type catalog, domain emoji, no options");
  await setDoc(doc(db, "v2_users", uid, "answers", PK), {
    qid: PK, surface: "feed", entity: 128514, // 😂 — a real committed key
    answeredAt: serverTimestamp(),
    anchors: { ageBand: "25-34", country: "NO", city: "Oslo, NO" },
  });
  let canon = null;
  for (let i = 0; i < 40; i++) {
    const snap = await getDoc(doc(db, "v2_question_aggs", PK));
    if (snap.exists()) { canon = snap.data(); break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!canon) fail(`canon never published after ${40 * 500}ms — the entity fold did not fire, or did not finish in time`);
  if (canon.total !== 1 || !canon.top || canon.top["128514"] !== 1 || canon.rest !== 0)
    fail("first pick did not publish exactly: " + JSON.stringify(canon));
  if (!canon.by || !canon.by.ageBand || !canon.by.ageBand["25-34"] || canon.by.ageBand["25-34"]["128514"] !== 1)
    fail("the segment board (D17) is missing the pick: " + JSON.stringify(canon.by));
  ok("canon published exactly: total 1, top {128514: 1}, segment board included");

  // The shape refusals. A feed vote question refuses `entity` (its
  // isCatalogAnswer lookup sees type "vote"), a catalog question refuses
  // `optionIdx` (its bound reads options.size(), which is 0), and a pick
  // cannot be moved (no old optionIdx for the D86 arm to key on).
  const feedVoteSnap = await getDocs(query(
    collection(db, "v2_questions"),
    where("surface", "==", "feed"), where("type", "==", "vote"), limit(1),
  ));
  if (!feedVoteSnap.size) fail("no feed vote question in the bank to test the entity refusal against");
  const FV = feedVoteSnap.docs[0].id;
  await expectDenied("entity refused on a non-catalog question", () =>
    setDoc(doc(db, "v2_users", uid, "answers", FV), {
      qid: FV, surface: "feed", entity: 128514,
      answeredAt: serverTimestamp(), anchors: {},
    }));
  await expectDenied("optionIdx refused on a catalog question", () =>
    setDoc(doc(db, "v2_users", uid, "answers", "pick-pk05"), {
      qid: "pick-pk05", surface: "feed", optionIdx: 0,
      answeredAt: serverTimestamp(), anchors: {},
    }));
  await expectDenied("a pick cannot be edited (create-only, D14/D86)", () =>
    updateDoc(doc(db, "v2_users", uid, "answers", PK), {
      optionIdx: 1, editedAt: serverTimestamp(),
    }));

  // The key refusal is the TRIGGER's, so it cannot be a rules denial:
  // 999999 clears the rules' sanity bound but names no emoji codepoint in
  // the committed catalogue. Write it, then a VALID second pick — when the
  // valid one lands at total 2, the invalid one has provably been dropped
  // (a folded bogus key would have pushed the total past 2, and its key
  // would stand on the board).
  const pApps = [];
  for (const [n, entity] of [[0, 999999], [1, 10084]]) {
    const pApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "picker" + n);
    pApps.push(pApp);
    const pAuth = getAuth(pApp); connectAuthEmulator(pAuth, "http://127.0.0.1:9099", { disableWarnings: true });
    const pDb = getFirestore(pApp, E2E_DB_ID); connectFirestoreEmulator(pDb, "127.0.0.1", 8080);
    const u = await signInAnonymously(pAuth);
    await setDoc(doc(pDb, "v2_users", u.user.uid, "answers", PK), {
      qid: PK, surface: "feed", entity,
      answeredAt: serverTimestamp(), anchors: { ageBand: "35-44", country: "NO", city: "Bergen, NO" },
    });
  }
  let two = null;
  for (let i = 0; i < 40; i++) {
    const snap = await getDoc(doc(db, "v2_question_aggs", PK));
    if (snap.exists() && snap.get("total") >= 2) { two = snap.data(); break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!two) fail("canon never reached total 2");
  if (two.total !== 2 || two.top["999999"] !== undefined || two.top["10084"] !== 1)
    fail("an unknown key aggregated, or a valid one did not: " + JSON.stringify(two));
  ok("unknown entity key dropped at the trigger; valid keys fold exactly");

  // "Not listed" (entity 0): counted in the total, never enumerated on
  // the board — it lands in `rest` and nowhere else.
  const nlApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "pickerNL");
  const nlAuth = getAuth(nlApp); connectAuthEmulator(nlAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const nlDb = getFirestore(nlApp, E2E_DB_ID); connectFirestoreEmulator(nlDb, "127.0.0.1", 8080);
  const nlu = await signInAnonymously(nlAuth);
  await setDoc(doc(nlDb, "v2_users", nlu.user.uid, "answers", PK), {
    qid: PK, surface: "feed", entity: 0,
    answeredAt: serverTimestamp(), anchors: {},
  });
  let three = null;
  for (let i = 0; i < 40; i++) {
    const snap = await getDoc(doc(db, "v2_question_aggs", PK));
    if (snap.exists() && snap.get("total") === 3) { three = snap.data(); break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!three) fail("canon never reached total 3 after the Not-listed pick");
  if (three.top["0"] !== undefined || three.rest !== 1)
    fail("Not listed leaked onto the board, or missed the fold: " + JSON.stringify(three));
  ok("Not listed: counted in the total, folded into rest, never enumerated");
}

// 9d · rank answers (D233): an ORDER rides the create-only path and the
// trigger folds per-item position sums — {total, pos} — instead of
// counts. The refusals split across the two boundaries by design: rules
// refuse the wrong SHAPES (an index on a rank question — the D12
// poisoning through the raw API — an order on a vote question, a
// wrong-size list, any edit), while a wrong-ELEMENT order passes rules
// and dies at the trigger's permutation check, exactly like an unknown
// catalog key.
{
  const RQ = RQ_ID;
  const rqDoc = await getDoc(doc(db, "v2_questions", RQ));
  if (!rqDoc.exists() || rqDoc.get("type") !== "rank" || (rqDoc.get("options") || []).length !== 4)
    fail("the rank seed did not land as a 4-item rank doc: " + JSON.stringify(rqDoc.data() || null));
  await setDoc(doc(db, "v2_users", uid, "answers", RQ), {
    qid: RQ, surface: "feed", order: [2, 0, 1, 3],
    answeredAt: serverTimestamp(),
    anchors: { ageBand: "25-34", country: "NO", city: "Oslo, NO" },
  });
  let rpub = null;
  for (let i = 0; i < 40; i++) {
    const snap = await getDoc(doc(db, "v2_question_aggs", RQ));
    if (snap.exists()) { rpub = snap.data(); break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!rpub) fail(`rank agg never published after ${40 * 500}ms — the order fold did not fire, or did not finish in time`);
  // order [2,0,1,3] gives item positions 2→0, 0→1, 1→2, 3→3
  if (rpub.total !== 1 || JSON.stringify(rpub.pos) !== JSON.stringify([1, 2, 0, 3]))
    fail("first order did not fold exactly: " + JSON.stringify(rpub));
  if (rpub.counts !== undefined)
    fail("a rank aggregate grew a counts map — the vote fold ran on an order doc: " + JSON.stringify(rpub));
  ok("rank: first order folded exactly — {total 1, pos [1,2,0,3]}, no counts");

  await expectDenied("duplicate ranking refused by rules", () =>
    setDoc(doc(db, "v2_users", uid, "answers", RQ), {
      qid: RQ, surface: "feed", order: [0, 1, 2, 3],
      answeredAt: serverTimestamp(), anchors: {},
    }));
  await expectDenied("optionIdx refused on a rank question (the D12 side door)", () =>
    setDoc(doc(db, "v2_users", uid, "answers", "feed-f10"), {
      qid: "feed-f10", surface: "feed", optionIdx: 0,
      answeredAt: serverTimestamp(), anchors: {},
    }));
  await expectDenied("a wrong-size order refused by rules", () =>
    setDoc(doc(db, "v2_users", uid, "answers", "feed-f10"), {
      qid: "feed-f10", surface: "feed", order: [0, 1],
      answeredAt: serverTimestamp(), anchors: {},
    }));
  await expectDenied("a ranking cannot be edited (create-only, D233)", () =>
    updateDoc(doc(db, "v2_users", uid, "answers", RQ), {
      order: [0, 1, 2, 3], editedAt: serverTimestamp(),
    }));

  // The element refusal is the TRIGGER's: [0,0,0,0] clears every rules
  // bound (right length, a list) and names no permutation. Write it, then
  // a VALID second ranking — when that lands at total 2 with the right
  // sums, the invalid one has provably been dropped.
  const rApps = [];
  for (const [n, order] of [[0, [0, 0, 0, 0]], [1, [3, 2, 1, 0]]]) {
    const rApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "ranker" + n);
    rApps.push(rApp);
    const rAuth = getAuth(rApp); connectAuthEmulator(rAuth, "http://127.0.0.1:9099", { disableWarnings: true });
    const rDb = getFirestore(rApp, E2E_DB_ID); connectFirestoreEmulator(rDb, "127.0.0.1", 8080);
    const u = await signInAnonymously(rAuth);
    await setDoc(doc(rDb, "v2_users", u.user.uid, "answers", RQ), {
      qid: RQ, surface: "feed", order,
      answeredAt: serverTimestamp(), anchors: {},
    });
  }
  let rtwo = null;
  for (let i = 0; i < 40; i++) {
    const snap = await getDoc(doc(db, "v2_question_aggs", RQ));
    if (snap.exists() && snap.get("total") >= 2) { rtwo = snap.data(); break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!rtwo) fail("rank agg never reached total 2");
  // valid folds: [2,0,1,3] + [3,2,1,0] → pos [1+3, 2+2, 0+1, 3+0]
  if (rtwo.total !== 2 || JSON.stringify(rtwo.pos) !== JSON.stringify([4, 4, 1, 3]))
    fail("a non-permutation folded, or a valid order did not: " + JSON.stringify(rtwo));
  ok("rank: non-permutation dropped at the trigger; valid orders sum exactly");
}

// 9e · D290: the OTHER TWO fold arms, rebuilt. This step used to assert
// that the tool refused them — which was honest while it did, and made
// "every aggregate is a projection you can rebuild" true of exactly one
// arm out of three. Both are built now, and this is what proves it against
// real folds rather than against synthetic ones.
//
// Same assertion shape as 7h and for the same reason: a rebuild of a
// healthy question must be a NO-OP. That needs no hardcoded totals — it
// compares the document to itself across a scan — so this step cannot rot
// when 9c or 9d change what they leave behind.
{
  const noop = async (label, qid, keys) => {
    const before = (await getDoc(doc(db, "v2_question_aggs", qid))).data();
    const dry = (await httpsCallable(fns, "rebuildAggregateV2")({ qid })).data;
    if (dry.applied !== false) fail(`${label}: the rebuild wrote without apply`);
    if (dry.drift.total !== 0)
      fail(`${label}: drift on an untouched aggregate — ${JSON.stringify(dry.drift)}`);
    if (dry.total !== before.total)
      fail(`${label}: replay total ${dry.total} against published ${before.total}`);

    const applied = (await httpsCallable(fns, "rebuildAggregateV2")({ qid, apply: true })).data;
    if (applied.applied !== true) fail(`${label}: apply did not run`);
    const after = (await getDoc(doc(db, "v2_question_aggs", qid))).data();
    for (const k of keys) {
      if (JSON.stringify(after[k]) !== JSON.stringify(before[k]))
        fail(`${label}: --apply changed \`${k}\` — ${JSON.stringify(before[k])} → ${JSON.stringify(after[k])}`);
    }
    return { dry, applied };
  };

  // Rank: position sums and the total. The arm with no caveat at all —
  // plain addition, nothing to evict, so a rebuild is not "a correct fold"
  // but THE fold, and replay.test.ts pins that order-independence.
  const r = await noop("rank", RQ_ID, ["total", "pos"]);
  if (r.dry.arm !== "rank") fail(`rank question routed to the ${r.dry.arm} arm`);
  if (r.dry.cappedDims.length) fail("rank has no breakdown and must report no capped dims");
  ok("D290: rank aggregate rebuilds to itself — total and position sums unchanged");

  // Catalog: the board AND the private accumulator behind it. The board is
  // canonTopN's lossy projection, so a rebuild that wrote only the public
  // document would leave the next answer folding from something it cannot
  // fold from — which is why the private doc survived D290's collapse.
  const privBefore = (await adminDb.doc(`v2_aggs_private/${PK_ID}`).get()).data();
  const c = await noop("catalog", PK_ID, ["total", "top", "rest", "by"]);
  if (c.dry.arm !== "catalog") fail(`catalog question routed to the ${c.dry.arm} arm`);
  ok("D290: catalog board rebuilds to itself — top, rest and the segment board unchanged");

  // …and the private accumulator, which the paragraph above names and
  // nothing here checked. It is the half a client cannot read, so only an
  // admin handle can see it — and it is the half that goes wrong.
  //
  // This arm writes TWO documents where every other writes one, and it
  // wrote them as two separate awaits while the TRIGGER writes the pair
  // inside a transaction. A fold landing between them — or a process
  // dying between them, which a function timeout is — left the
  // accumulator holding a vote the board did not show. On a quiet or
  // retired catalogue nothing may answer again to repair it. One batch
  // now; what proves it is the pair agreeing after an --apply.
  const privAfter = (await adminDb.doc(`v2_aggs_private/${PK_ID}`).get()).data();
  if (!privBefore || !privAfter)
    fail("the private catalog accumulator is missing — the rebuild dropped it or it never existed");
  if (privAfter.total !== privBefore.total || JSON.stringify(privAfter.ent) !== JSON.stringify(privBefore.ent))
    fail("--apply moved the private accumulator on a no-op rebuild: "
      + JSON.stringify(privBefore) + " → " + JSON.stringify(privAfter));
  const pubAfter = (await getDoc(doc(db, "v2_question_aggs", PK_ID))).data();
  if (pubAfter.total !== privAfter.total)
    fail(`the rebuild left the pair disagreeing: board total ${pubAfter.total}, accumulator ${privAfter.total}`);
  for (const [k, v] of Object.entries(pubAfter.top || {})) {
    if ((privAfter.ent || {})[k] !== v)
      fail(`board entry ${k}=${v} is not in the accumulator: ` + JSON.stringify(privAfter.ent));
  }
  ok("D290: the catalog arm writes both documents as one commit — board and accumulator agree");

  // D290's refusal, APPLIED — the "what replay cannot rebuild" list, which
  // is where this tool's D72 rule (refuse rather than fabricate) is
  // recorded. Cited as D292 when it landed; D292 is the read-only
  // observer, and a citation that resolves to the wrong record is worse
  // than none. `replay.test.ts` pins the predicate in
  // isolation, so deleting the four lines in runRebuild that consult it
  // left every suite green — the guard was exported, tested and never
  // asked. It is the guard against a rebuild MINTING a public aggregate
  // out of sealed duel votes, and against reporting health for a pulse,
  // whose aggregates are keyed per day and which this tool cannot address.
  //
  // Asserted through the real callable, on a real bank question, because
  // that is the half the unit test cannot reach.
  for (const [qid, what] of [["group-gu0", "a sealed duel"], ["pulse-pace", "a per-day pulse"]]) {
    // THE CODE, not just the fact that something was thrown. This block
    // read only the message until tonight, and the callable's own
    // `internal` wrapper answers `rebuild of <qid> failed: <reason>` —
    // which names the question and is long, so a missing composite index
    // or any other crash inside runRebuild passed as the refusal being
    // asserted. `not-found` (the fixture never seeded) cleared the name
    // check too and missed the length one by two characters.
    const refused = await expectRefusal(
      `the rebuild tool refuses ${what} (${qid})`,
      "functions/failed-precondition",
      () => httpsCallable(fns, "rebuildAggregateV2")({ qid }));
    // AND the refusal has to NAME the question and give a reason — a bare
    // "failed-precondition" tells an operator nothing about which of the
    // two unaddressable shapes they hit.
    if (!refused.includes(qid) || refused.length < qid.length + 30)
      fail(`${qid} was refused without saying why: ${refused}`);
  }
  ok("D290: the rebuild tool refuses a sealed duel and a per-day pulse, through the callable");
}

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
    const f = getFunctions(app, FUNCTIONS_REGION);
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
    const lFns = getFunctions(lApp, FUNCTIONS_REGION);
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

// 13 · a handle is claimed once (D190)
//
// The app now SAYS so — the account panel prints the handle as a fact with
// "It can't be changed" under it, and the first-run screen says "picked
// once" before the tap. This is the half that makes the sentence true.
//
// It is here rather than in rules.test.ts because the rule is a callable's,
// not a document's: firestore.rules already refuses every client write to
// `v2_handles` and to `v2_users.handle` (both pinned there), so the only
// path that can move a handle is claimHandleV2 — and the only way to prove
// what it does is to call it.
{
  const first = await httpsCallable(fns, "claimHandleV2")({ handle: "Olaf_T" });
  if (first.data?.handle !== "olaf_t") fail("claimHandleV2 did not fold the handle: " + JSON.stringify(first.data));
  const reg = await getDoc(doc(db, "v2_handles", "olaf_t"));
  if (reg.get("uid") !== uid) fail("the registry does not point at the claimant");
  ok("handle claimed, folded to its canonical form, registered to the uid");

  // The retry, which must NOT be an error: the client re-sends on a dropped
  // response, and "that handle is taken" about your own name is the worst
  // message this callable could produce.
  const again = await httpsCallable(fns, "claimHandleV2")({ handle: "olaf_t" });
  if (again.data?.handle !== "olaf_t") fail("re-claiming my own handle was refused");
  ok("re-claiming the same handle is a no-op, not an error");

  // The change, refused. A handle is the address a person hands out, and a
  // rename frees it for a stranger the same minute — which is the failure
  // D190 removed. The old registry entry must survive the attempt.
  await expectCode("changing a claimed handle refused",
    "functions/failed-precondition",
    () => httpsCallable(fns, "claimHandleV2")({ handle: "olaf_two" }));
  const still = await getDoc(doc(db, "v2_handles", "olaf_t"));
  if (!still.exists() || still.get("uid") !== uid) fail("the refused rename freed the original handle");
  const ghost = await getDoc(doc(db, "v2_handles", "olaf_two"));
  if (ghost.exists()) fail("the refused rename took the new handle anyway");
  ok("the refusal left both registry entries exactly as they were");

  // …and somebody else's handle is still somebody else's.
  await expectCode("claiming a handle another account holds refused",
    "functions/already-exists",
    () => httpsCallable(pFns, "claimHandleV2")({ handle: "olaf_t" }));
}

// 14 · invitations: a batch, charged per person, surviving no FCM (D236)
//
// The notification is the whole point of D236, and the emulator has no
// FCM — which makes that the case worth pinning here rather than a
// weakness of the harness. `sendPushToUids` is best-effort BY
// CONSTRUCTION: an invitation that was written must still be reported as
// written when there is nowhere to send the notification. If that ever
// regresses, inviting somebody starts throwing in exactly the
// environments where nobody is watching it.
{
  const made = await httpsCallable(fns, "createGroupV2")({ name: "The Picked", mode: "group" });
  const igid = made.data?.gid;
  if (!igid) fail("createGroupV2 for the invite case: " + JSON.stringify(made.data));

  // BOTH TARGETS CLAIM A HANDLE FIRST, and that is the real path rather
  // than a convenience. inviteToGroupV2 refuses a uid with no `v2_users`
  // document — without that check a typo'd uid writes an invitation
  // nobody will ever see and the sender is told it worked — and joining
  // by code alone never writes one. In the app that is not a gap: the
  // picker resolves a HANDLE to a uid, claiming a handle writes the
  // profile, so anyone findable is invitable. Inviting through the
  // registry is what this sets up.
  await httpsCallable(pFns, "claimHandleV2")({ handle: "bea" });
  await httpsCallable(lateFns, "claimHandleV2")({ handle: "cass" });
  const resolved = [];
  for (const h of ["bea", "cass"]) {
    const reg = await getDoc(doc(db, "v2_handles", h));
    if (!reg.exists()) fail(`the registry has no entry for @${h}`);
    resolved.push(reg.get("uid"));
  }
  if (resolved[0] !== partner.user.uid || resolved[1] !== latecomer.user.uid) {
    fail("the registry resolved a handle to the wrong account");
  }
  ok("two handles claimed and resolved to their uids, the way the picker does");

  const both = resolved;
  const sent = await httpsCallable(fns, "inviteToGroupV2")({ gid: igid, to: both });
  if (!sent.data?.ok) fail("inviteToGroupV2 refused a batch: " + JSON.stringify(sent.data));
  if ((sent.data.invited || []).length !== 2) {
    fail("the batch did not invite both: " + JSON.stringify(sent.data));
  }
  ok("one call invited two people, with no FCM to send the notification to");

  // THROUGH THE ADMIN HANDLE, and the deny is the reason. D122 refused
  // members the invitation list — the first draft allowed it so a circle
  // could show who had been asked and had not answered, and that arm
  // needed a get() on the group per read. So the INVITER cannot see what
  // it just wrote; only the invitee can, by id. Asserting through the
  // deny would mean weakening it for a test (rules.test.ts owns that
  // side); this asserts the document the callable actually wrote.
  for (const to of both) {
    const inv = await adminDb.doc(`v2_groups/${igid}/invites/${to}`).get();
    if (!inv.exists) fail("no invitation document for " + to);
    // Denormalised because a collection-group query cannot filter on a
    // document id — this is what makes the invitee's inbox one query.
    if (inv.get("to") !== to) fail("`to` is not on the invitation for " + to);
    // The circle is member-gated (it carries the code), and an invitee is
    // by definition not a member — so the name has to ride along or the
    // inbox has nothing to call it.
    if (inv.get("groupName") !== "The Picked") fail("the circle's name did not ride along");
  }
  ok("each invitation carries its own `to` and the circle's name");

  // CHARGED PER RECIPIENT. Counting a batch as one event would have made
  // INVITES_PER_HOUR meaningless the moment the picker shipped: one call,
  // forty notifications. Read through the admin handle — v2_ratelimits is
  // server-only, and asserting through the deny would mean weakening it.
  const budget = await adminDb.doc(`v2_ratelimits/invite_${uid}`).get();
  const events = budget.get("events") || [];
  if (events.length !== 2) fail(`the budget charged ${events.length} for a batch of 2`);
  ok("the rate limit charged one event per recipient, not one per call");

  // A duo has exactly one seat, so a batch of two is refused whole rather
  // than half-applied — the shape a picker must not be able to talk the
  // server into.
  const duo = await httpsCallable(fns, "createGroupV2")({ name: "Just Us", mode: "duo" });
  await expectCode("a batch larger than the seats left refused",
    "functions/invalid-argument",
    () => httpsCallable(fns, "inviteToGroupV2")({ gid: duo.data.gid, to: both }));
  const leftover = await adminDb.collection(`v2_groups/${duo.data.gid}/invites`).get();
  if (!leftover.empty) fail("the refused batch wrote invitations anyway");
  ok("the refusal wrote nothing at all");

  // …and the invitee can still accept, which is the only thing that puts
  // a name into memberUids.
  await httpsCallable(pFns, "acceptGroupInviteV2")({ gid: igid });
  const after = await adminDb.doc(`v2_groups/${igid}`).get();
  if (!(after.get("memberUids") || []).includes(partner.user.uid)) {
    fail("accepting the invitation did not add the member");
  }
  ok("accepting an invitation is still what adds the member");

  // ── the two arrivals crossing ────────────────────────────────────────
  //
  // Both ways into a circle can be in flight for the same person at once,
  // and the callables are not symmetric about it. requestJoinV2 knew:
  // its admit() clears `pending` "whichever way they arrived", which
  // covers invited-first-then-taps-the-link. The other order had nothing.
  //
  // inviteToGroupV2 skips a target who is already a MEMBER and says
  // nothing about one who is already waiting — correctly, since inviting
  // someone who asked is exactly how a member says yes from the picker
  // instead of from the queue. So the ask survives the invitation, and if
  // accept does not clear it the circle shows "wants to join" about
  // somebody sitting in its own member list.
  //
  // It is not self-healing either: approveJoinV2 returns early on an
  // existing member, so "Let in" cannot clear the row it is drawn on.
  const xg = await httpsCallable(fns, "createGroupV2")({ name: "Both Doors" });
  const xgid = xg.data.gid;
  await httpsCallable(lateFns, "requestJoinV2")({ code: xg.data.inviteCode });
  const asking = await adminDb.doc(`v2_groups/${xgid}`).get();
  if (!(asking.get("pending") || []).includes(latecomer.user.uid)) {
    fail("requestJoinV2 did not queue the asker");
  }
  await httpsCallable(fns, "inviteToGroupV2")({ gid: xgid, to: latecomer.user.uid });
  await httpsCallable(lateFns, "acceptGroupInviteV2")({ gid: xgid });
  const crossed = await adminDb.doc(`v2_groups/${xgid}`).get();
  if (!(crossed.get("memberUids") || []).includes(latecomer.user.uid)) {
    fail("accepting after asking did not add the member");
  }
  if ((crossed.get("pending") || []).includes(latecomer.user.uid)) {
    fail("a member is still listed as wanting to join");
  }
  if ((crossed.get("pendingNames") || {})[latecomer.user.uid] !== undefined) {
    fail("the asker's name is still in pendingNames after they joined");
  }
  ok("accepting an invitation clears the ask the same person already made");

  // …and the same row, if one is already stuck, comes out on Let in
  // rather than sitting there being re-notified. Written by hand because
  // no callable can produce it any more.
  await adminDb.doc(`v2_groups/${xgid}`).update({
    pending: [latecomer.user.uid],
    [`pendingNames.${latecomer.user.uid}`]: "Late",
  });
  await httpsCallable(fns, "approveJoinV2")({ gid: xgid, uid: latecomer.user.uid });
  const healed = await adminDb.doc(`v2_groups/${xgid}`).get();
  if ((healed.get("pending") || []).length) fail("Let in did not clear a stale queue row");
  if ((healed.get("pendingNames") || {})[latecomer.user.uid] !== undefined) {
    fail("Let in left the stale pendingNames entry");
  }
  ok("Let in clears a stale row instead of doing nothing to it");
}

// ── the logic attempt's answer key stays on the server (D57) ──────────
//
// THE ONLY EXECUTABLE CHECK THAT IT DOES. check:logic-sync guarantees
// src/v2/data/logic-gen.ts and functions/src/logic-gen.ts are byte-identical,
// which is what makes server scoring honest — and also means the SHIPPED
// CLIENT already contains `generateForm`. So `generateForm(seed).items[i].a`
// is the complete answer key for all 25 items, and the seed is the whole of
// it. firestore.rules denies the stored copy; nothing but this guards the
// wire.
//
// Adding `seed` to logicStartV2's return literal — the obvious thing a
// debugging change or a "let the client pre-render" optimisation does —
// passes tsc, eslint, check:globals, check:appcheck, check:logic-sync, the
// clientItems key-set test in logic.test.ts (which tests the helper, not the
// response) and every rules test. Every verified percentile in
// v2_logic_norms would then be fed by scores nobody solved.
{
  const started = await httpsCallable(fns, "logicStartV2")({});
  const keys = Object.keys(started.data).sort();
  if (JSON.stringify(keys) !== JSON.stringify(["capMs", "deadlineMs", "items"])) {
    fail("logicStartV2 returned unexpected keys: " + JSON.stringify(keys));
  }
  // Belt as well as braces: assert on the SERIALIZED response, so a key
  // nested inside `items` is caught too. `"a"` is the correct-tile index
  // that clientItems() strips; `seed`/`gv` are what regenerates the form.
  const wire = JSON.stringify(started.data);
  for (const leak of ['"seed"', '"gv"', '"a":', '"rules"']) {
    if (wire.includes(leak)) fail(`logicStartV2 leaked ${leak} — the form is regenerable from it`);
  }
  if (!Array.isArray(started.data.items) || started.data.items.length !== 25) {
    fail("logicStartV2 did not return 25 items — this check has nothing to guard");
  }
  ok("logicStartV2 hands over the form and never the answer key (D57)");

  // …and the key IS disclosed once the attempt is scored, which is what
  // makes the assertion above about TIMING rather than about the field
  // never existing.
  const submitted = await httpsCallable(fns, "logicSubmitV2")({ picks: Array(25).fill(0) });
  if (typeof submitted.data?.seed !== "number") {
    fail("logicSubmitV2 withheld the seed after scoring: " + JSON.stringify(submitted.data));
  }
  ok("…and discloses it after scoring, so the reveal can show the working");

  // One attempt per window. Without this the client can resubmit until the
  // score it wants, and the norms histogram counts every try.
  try {
    await httpsCallable(fns, "logicSubmitV2")({ picks: Array(25).fill(0) });
    fail("a second submit against a scored attempt was accepted");
  } catch (e) {
    if (e?.code !== "functions/failed-precondition") {
      fail("wrong refusal for a second submit: " + (e?.code || e));
    }
  }
  ok("a scored attempt refuses a second submit");
}

// 12 · The self-serve paid-question loop (paid.ts, D313): book → the
// automated review settles it (gates alone in the emulator — no model
// key, and the run must prove that honest degradation, not paper over
// it) → the locked quote → the SIGNED webhook goes live in one
// transaction → the question serves and aggregates like any bank
// question, which is the whole no-third-serving-path claim.
{
  const whsec = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!whsec) {
    fail("STRIPE_WEBHOOK_SECRET missing from the e2e env — package.json's test:e2e scripts set whsec_e2e for exactly this leg");
  }

  // A fresh account: the main uid's daily budgets are spent by earlier
  // legs, and a buyer's loop should not lean on them anyway.
  const payApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "paid1");
  const payAuth = getAuth(payApp); connectAuthEmulator(payAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const payDb = getFirestore(payApp, E2E_DB_ID); connectFirestoreEmulator(payDb, "127.0.0.1", 8080);
  const payFns = getFunctions(payApp, FUNCTIONS_REGION); connectFunctionsEmulator(payFns, "127.0.0.1", 5001);
  const buyer = await signInAnonymously(payAuth);

  const book = await httpsCallable(payFns, "bookPaidQuestionV2")({
    prompt: "Should the harbour bath stay open all winter?",
    type: "binary", options: ["Keep it open", "Close for winter"],
    topic: "culture", scope: "city", dims: { city: "Oslo, NO" }, wearName: false,
  });
  const bid = book.data?.id;
  if (!bid) fail("bookPaidQuestionV2 returned " + JSON.stringify(book.data));
  ok("paid booking opened: " + bid.slice(0, 16) + "…");

  // The review trigger settles it. Poll through the buyer's OWN read —
  // the same rules-refereed path the door polls.
  let booking = null;
  for (let i = 0; i < 60; i++) {
    const s = await getDoc(doc(payDb, "v2_paid_bookings", bid));
    if (s.exists() && s.get("status") !== "review") { booking = s.data(); break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!booking) fail("the review never settled the booking");
  if (booking.status !== "approved") fail("expected approved, got " + JSON.stringify(booking));
  // The honest degradation: no ANTHROPIC_API_KEY in the emulator, so the
  // verdict must SAY it was gates alone — a recorded "model" basis that no
  // model produced would be the phantom approval paid.ts refuses to fake.
  if (booking.review?.by !== "gates-only") {
    fail("emulator review must record by=gates-only, got " + JSON.stringify(booking.review));
  }
  // The locked quote, off the committed card: base 0.16 × idx 0.9.
  const q = booking.quote || {};
  if (q.ratePerAnswer !== 0.144 || q.capEur !== 320 || q.cap !== Math.floor(320 / 0.144) || q.windowDays !== 29) {
    fail("quote is not the committed card's arithmetic: " + JSON.stringify(q));
  }
  ok("review approved on gates alone (recorded as such) with the locked quote");

  // A gate decline, with the reason written to be shown. Duplicate
  // options are two indexes wearing one answer — the aggregate would
  // publish a split between identical labels.
  const bad = await httpsCallable(payFns, "bookPaidQuestionV2")({
    prompt: "Ferry or ferry?", type: "binary", options: ["Ferry", "FERRY"],
    topic: null, scope: "world", dims: {}, wearName: false,
  });
  let declined = null;
  for (let i = 0; i < 40; i++) {
    const s = await getDoc(doc(payDb, "v2_paid_bookings", bad.data.id));
    if (s.exists() && s.get("status") !== "review") { declined = s.data(); break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!declined || declined.status !== "declined" || !/same thing/.test(declined.note || "")) {
    fail("duplicate-option booking was not declined with its reason: " + JSON.stringify(declined));
  }
  ok("a gate decline lands with its reason, before any payment exists");

  // Checkout refuses honestly while Stripe is unconfigured — the
  // emulator has no STRIPE_SECRET_KEY on purpose.
  await expectCode("checkout refuses without Stripe configured",
    "functions/unavailable",
    () => httpsCallable(payFns, "createPaidCheckoutV2")({ id: bid }));

  // The webhook. A synthetic checkout.session.completed signed with the
  // shared secret — the same t=…,v1=HMAC(t.payload) scheme
  // Stripe.webhooks.constructEvent verifies (probed against stripe@18,
  // not assumed).
  const { createHmac } = await import("node:crypto");
  const hookUrl = `http://127.0.0.1:5001/demo-insight/${FUNCTIONS_REGION}/stripeWebhookV2`;
  const signedPost = (payload, secret) => {
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
    return fetch(hookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "stripe-signature": `t=${t},v1=${v1}` },
      body: payload,
    });
  };
  // `payment_status` is what makes this a PAID completion. The session is
  // created without `payment_method_types`, so Stripe's dynamic methods
  // apply and EUR's delayed ones (SEPA debit, bank transfer) deliver
  // `completed` with "unpaid" and settle later — this fixture carried no
  // such field at all, so it could not tell the two apart.
  const evt = (over) => JSON.stringify({
    id: "evt_e2e_1", object: "event", type: "checkout.session.completed",
    ...over,
    data: { object: {
      id: "cs_e2e_1", object: "checkout.session", client_reference_id: bid,
      metadata: { bid }, payment_intent: "pi_e2e_1", payment_status: "paid",
      ...(over?.data?.object || {}),
    } },
  });
  const sessionEvent = evt();

  // A tampered delivery is refused BEFORE any state moves.
  const forged = await signedPost(sessionEvent, "whsec_wrong");
  if (forged.status !== 400) fail("a mis-signed webhook was not refused: " + forged.status);
  const stillApproved = await getDoc(doc(payDb, "v2_paid_bookings", bid));
  if (stillApproved.get("status") !== "approved") fail("a refused webhook still moved the booking");
  ok("a mis-signed webhook is refused and moves nothing");

  // AN UNPAID COMPLETION MOVES NOTHING. This is the ordinary first half
  // of a delayed method — the buyer has committed, the money has not
  // arrived — and taking it as payment would serve a 29-day window
  // against a debit that may never clear.
  const unpaid = await signedPost(evt({ data: { object: { payment_status: "unpaid" } } }), whsec);
  if (unpaid.status !== 200) fail("an unpaid completion errored: " + unpaid.status);
  const afterUnpaid = await getDoc(doc(payDb, "v2_paid_bookings", bid));
  if (afterUnpaid.get("status") !== "approved") {
    fail("an UNPAID checkout went live: " + JSON.stringify(afterUnpaid.data()));
  }
  ok("an unpaid completion is acknowledged and moves nothing");

  // …and the failure that can follow it revokes nothing, because nothing
  // was granted. What it must not do is look like success.
  const failedEvt = await signedPost(
    evt({ type: "checkout.session.async_payment_failed", data: { object: { payment_status: "unpaid" } } }),
    whsec,
  );
  if (failedEvt.status !== 200) fail("a failed async payment errored: " + failedEvt.status);
  const afterFail = await getDoc(doc(payDb, "v2_paid_bookings", bid));
  if (afterFail.get("status") !== "approved") fail("a FAILED payment moved the booking");
  ok("a failed delayed payment is recorded and moves nothing");

  const paid = await signedPost(sessionEvent, whsec);
  if (paid.status !== 200) fail("webhook answered " + paid.status + ": " + await paid.text());

  // Live: booking stamped, purchase written in the room's exact shape,
  // question doc world-readable in the seed's field shape.
  const liveSnap = await getDoc(doc(payDb, "v2_paid_bookings", bid));
  if (liveSnap.get("status") !== "live") fail("payment did not go live: " + JSON.stringify(liveSnap.data()));
  const qid = liveSnap.get("qid");
  if (qid !== `paidq-${bid}`) fail("unexpected qid: " + qid);
  const purchase = await getDoc(doc(payDb, "v2_purchases", `${buyer.user.uid}_${bid}`));
  if (!purchase.exists()) fail("the webhook wrote no purchase record");
  if (purchase.get("state") !== "running" || purchase.get("qid") !== qid
    || purchase.get("budget")?.ratePerAnswer !== 0.144
    || purchase.get("stripePaymentIntent") !== "pi_e2e_1") {
    fail("purchase record malformed: " + JSON.stringify(purchase.data()));
  }
  // Any signed-in user reads the question — it is bank content now. The
  // MAIN account (a different uid) is the reader on purpose.
  const qDoc = await getDoc(doc(db, "v2_questions", qid));
  if (!qDoc.exists()) fail("the live question doc is not readable as bank content");
  if (qDoc.get("surface") !== "feed" || qDoc.get("core") !== undefined || !qDoc.get("sponsor")
    || !qDoc.get("updatedAt") || !qDoc.get("from") || !qDoc.get("until")) {
    fail("live question doc missing its serving shape: " + JSON.stringify(qDoc.data()));
  }
  if (qDoc.get("sponsor").buyer !== undefined) {
    fail("a nameless booking grew a buyer name: " + JSON.stringify(qDoc.get("sponsor")));
  }
  ok("payment went live: purchase + disclosed question in one transaction");

  // At-least-once delivery: the SAME event again answers 200 and mints
  // nothing new — the status guard is the idempotency.
  const replay = await signedPost(sessionEvent, whsec);
  if (replay.status !== 200) fail("a replayed webhook errored: " + replay.status);
  const afterReplay = await getDoc(doc(payDb, "v2_paid_bookings", bid));
  if (afterReplay.get("duplicatePayments") !== undefined) {
    fail("a REPLAY was recorded as a second payment: " + JSON.stringify(afterReplay.get("duplicatePayments")));
  }
  ok("a replayed delivery is a no-op behind the status guard");

  // A SECOND PAYMENT is not a replay, and the two used to be
  // indistinguishable here: both answered 200 and both minted nothing,
  // so a buyer charged twice for one question had the second charge
  // recorded nowhere in this app — not on the booking, not in the
  // purchase row, and so not reachable by the closer's refund. The
  // payment intent is what tells them apart.
  const second = await signedPost(
    evt({ id: "evt_e2e_2", data: { object: { id: "cs_e2e_2", payment_intent: "pi_e2e_2" } } }),
    whsec,
  );
  if (second.status !== 200) fail("a second payment errored: " + second.status);
  const afterSecond = await getDoc(doc(payDb, "v2_paid_bookings", bid));
  const dupes = afterSecond.get("duplicatePayments");
  if (!Array.isArray(dupes) || !dupes.includes("pi_e2e_2")) {
    fail("a SECOND real payment was swallowed: " + JSON.stringify(afterSecond.data()));
  }
  // …and it must not have minted a second question or moved the first.
  if (afterSecond.get("stripePaymentIntent") !== "pi_e2e_1" || afterSecond.get("qid") !== qid) {
    fail("the second payment overwrote the first: " + JSON.stringify(afterSecond.data()));
  }
  ok("a second real payment is recorded and alarmed, not swallowed");

  // The serving claim, closed end to end: the MAIN account answers the
  // paid question through the ORDINARY answer path and the ordinary
  // trigger folds it — same rules, same aggregate, no third path. (The
  // answer works because the doc the webhook wrote satisfies the same
  // get()-backed rules every bank question does.)
  await setDoc(doc(db, `v2_users/${uid}/answers/${qid}`), {
    qid, surface: "feed", optionIdx: 0,
    answeredAt: serverTimestamp(), anchors: {},
  });
  let paidAgg = null;
  for (let i = 0; i < 40; i++) {
    const s = await getDoc(doc(db, "v2_question_aggs", qid));
    if (s.exists()) { paidAgg = s.data(); break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!paidAgg || paidAgg.counts?.["0"] !== 1) {
    fail("the paid question's answer did not fold: " + JSON.stringify(paidAgg));
  }
  ok("a paid question takes answers and aggregates through the ordinary path");

  // 13 · The ad lane (D315): same loop, a different product — flat quote,
  // queued day-exclusive windows, the webhook writing v2_ads, and the
  // reseed NOT eating what the webhook wrote.
  const dayKey = (off) => new Date(Date.now() + off * 86400000).toISOString().slice(0, 10);
  const dayAfter = (k) => new Date(Date.parse(`${k}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

  const bookAd = (headline) => httpsCallable(payFns, "bookPaidQuestionV2")({
    kind: "ad", advertiser: "Harbour Sauna", headline,
    body: "Open every morning from six, all winter.",
    scope: "city", dims: { city: "Oslo, NO" },
  });
  const settleAd = async (id) => {
    for (let i = 0; i < 40; i++) {
      const s = await getDoc(doc(payDb, "v2_paid_bookings", id));
      if (s.exists() && s.get("status") !== "review") return s;
      await new Promise((r) => setTimeout(r, 500));
    }
    fail("the ad review never settled " + id);
    return null;
  };

  const ad1 = await bookAd("The water is warmer than you think");
  const ad1Snap = await settleAd(ad1.data.id);
  if (ad1Snap.get("status") !== "approved") fail("ad booking not approved: " + JSON.stringify(ad1Snap.data()));
  const adQuote = ad1Snap.get("quote") || {};
  if (adQuote.flatEur !== 288 || adQuote.windowDays !== 29) {
    fail("ad quote is not adBase × idx off the committed card: " + JSON.stringify(adQuote));
  }
  ok("an ad books and approves at the flat committed price");

  const adEvent = (evtId, csId, bid, pi) => JSON.stringify({
    id: evtId, object: "event", type: "checkout.session.completed",
    // `payment_status: "paid"` for the same reason the question's fixture
    // carries it: a completion is not a payment for every method.
    data: { object: { id: csId, object: "checkout.session", client_reference_id: bid, metadata: { bid }, payment_intent: pi, payment_status: "paid" } },
  });
  const adPaid = await signedPost(adEvent("evt_e2e_ad1", "cs_ad1", ad1.data.id, "pi_ad1"), whsec);
  if (adPaid.status !== 200) fail("ad webhook answered " + adPaid.status);
  const ad1Live = await getDoc(doc(payDb, "v2_paid_bookings", ad1.data.id));
  const adId1 = ad1Live.get("adId");
  if (ad1Live.get("status") !== "live" || adId1 !== `paidad-${ad1.data.id}`) {
    fail("ad payment did not go live: " + JSON.stringify(ad1Live.data()));
  }
  const adPurchase1 = await getDoc(doc(payDb, "v2_purchases", `${buyer.user.uid}_${ad1.data.id}`));
  if (!adPurchase1.exists() || adPurchase1.get("kind") !== "ad" || adPurchase1.get("priceEur") !== 288) {
    fail("ad purchase malformed: " + JSON.stringify(adPurchase1.data()));
  }
  const w1 = adPurchase1.get("window");
  if (w1.start !== dayKey(1)) fail("first ad in an empty scope must start tomorrow, got " + JSON.stringify(w1));
  // The ad doc is bank content any signed-in user reads, in the seed's
  // own field shape plus the queued-start `from` the client filter honours.
  const adDoc1 = await getDoc(doc(db, "v2_ads", adId1));
  if (!adDoc1.exists() || adDoc1.get("from") !== w1.start || adDoc1.get("until") !== w1.until
    || adDoc1.get("advertiser") !== "Harbour Sauna" || !adDoc1.get("updatedAt")) {
    fail("live ad doc missing its serving shape: " + JSON.stringify(adDoc1.data()));
  }
  ok("ad payment went live: purchase + v2_ads doc in one transaction");

  // Day-exclusivity: a second ad in the same scope QUEUES — its window
  // begins the day after the first one ends, never overlapping it.
  const ad2 = await bookAd("Warmer still on Tuesdays");
  await settleAd(ad2.data.id);
  const ad2Paid = await signedPost(adEvent("evt_e2e_ad2", "cs_ad2", ad2.data.id, "pi_ad2"), whsec);
  if (ad2Paid.status !== 200) fail("second ad webhook answered " + ad2Paid.status);
  const adPurchase2 = await getDoc(doc(payDb, "v2_purchases", `${buyer.user.uid}_${ad2.data.id}`));
  const w2 = adPurchase2.get("window");
  if (w2.start !== dayAfter(w1.until)) {
    fail(`second ad did not queue: first ends ${w1.until}, second starts ${w2.start}`);
  }
  ok("a second ad in the scope queues the day after the first — windows never overlap");

  // The reseed must not eat sold ads: content/ads.json is deliberately
  // empty, so without the paidad- sparing runSeedAds would delete BOTH
  // docs here — this assertion is the sparing's pin, not a formality.
  await httpsCallable(fns, "seedContentV2")({});
  if (!(await getDoc(doc(db, "v2_ads", adId1))).exists()) {
    fail("a reseed deleted a sold ad — the paidad- sparing is broken");
  }
  if (!(await getDoc(doc(db, "v2_ads", `paidad-${ad2.data.id}`))).exists()) {
    fail("a reseed deleted the queued sold ad");
  }
  ok("a reseed leaves sold ads standing (the seed spares paidad- ids)");
}

console.log("\nALL E2E CHECKS PASSED");
process.exit(0);

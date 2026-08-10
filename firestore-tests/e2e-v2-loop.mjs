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

// 5 · the trigger folds the answer into the public mirror. Under D81's
// launch pause (AGG_MIN_N = PUBLISH_EVERY = 1) the FIRST answer publishes:
// tooSmall false, exact count of one. The floor-5 choreography this
// replaces is preserved in the pure suite (pure.test.ts, "the design pair")
// and returns here with the revert.
let pub = null;
for (let i = 0; i < 30; i++) {
  const snap = await getDoc(doc(db, "v2_question_aggs", q0.id));
  if (snap.exists()) { pub = snap.data(); break; }
  await new Promise((r) => setTimeout(r, 500));
}
if (!pub) fail("public agg never appeared — trigger did not fire");
if (pub.tooSmall !== false || pub.total !== 1 || !pub.counts || pub.counts["1"] !== 1)
  fail("paused floor: first answer did not publish exactly: " + JSON.stringify(pub));
// The disclosure rule that does NOT pause: a one-bucket dimension is a
// population statement, not a split, and stays withheld at any floor.
// Everyone in this loop shares country NO, so `by.country` must never
// appear — while the multi-bucket dims publish from the first answer.
if (pub.by && pub.by.country)
  fail("a one-bucket dimension published under the paused floor: " + JSON.stringify(pub.by));
ok("paused floor: first answer published exactly (total 1), one-bucket country still withheld");

// 6 · duplicate answer is refused. Re-sending the whole doc rewrites
// answeredAt and anchors, which stay frozen under D85's edit arm — the
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
  const vDb = getFirestore(vApp); connectFirestoreEmulator(vDb, "127.0.0.1", 8080);
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

// 7b · the breakdown under the paused floor (D81). At total 5 the age
// bands hold 3 and 2 and the cities 3 and 2 — under the design floor (5)
// every one of those cells would be withheld (the choreography this
// replaces asserted exactly that); at floor 1 they publish, and they must
// publish EXACTLY. Country is a single bucket of 5: a population
// statement rather than a split, withheld by a rule the pause does not
// touch, so it must still be absent.
const cellSum = (dim, b) => Object.values(above.by[dim][b]).reduce((a, c) => a + c, 0);
if (!above.by || !above.by.ageBand || !above.by.city)
  fail("breakdown missing under the paused floor: " + JSON.stringify(above.by));
if (cellSum("ageBand", "25-34") !== 3 || cellSum("ageBand", "35-44") !== 2)
  fail("age cells wrong at 3/2: " + JSON.stringify(above.by.ageBand));
if (cellSum("city", "Oslo, NO") !== 3 || cellSum("city", "Bergen, NO") !== 2)
  fail("city cells wrong at 3/2: " + JSON.stringify(above.by.city));
if (above.by.country)
  fail("a one-bucket dimension was published: " + JSON.stringify(above.by.country));
ok("breakdown: sub-5 cells publish exactly under the paused floor; one-bucket country stays withheld");

// 7c · five more voters. Two into 25-34 and three into 35-44 lands both
// bands on exactly 5 at a total of 10 — same totals the design-floor
// choreography asserted, so the revert only re-tightens 7b. Country stays
// a single bucket and must still be withheld.
for (let m = 0; m < 5; m++) {
  const vApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "band" + m);
  const vAuth = getAuth(vApp); connectAuthEmulator(vAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const vDb = getFirestore(vApp); connectFirestoreEmulator(vDb, "127.0.0.1", 8080);
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
if (split.by.country)
  fail("a one-bucket dimension was published: " + JSON.stringify(split.by.country));

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
ok("breakdown: ageBand and city both 5/5; single-bucket country withheld");

// 7d · the publish cadence itself, as shipped. Under D81's pause the
// cadence is 1: the 11th answer must move the public mirror to an exact
// 11 promptly — per-answer publishing is the accepted disclosure, and
// what this leg now guards is that the count stays EXACT through it.
//
// The batched choreography this replaces (an 11th answer must NOT move
// the mirror off the multiple of 5) returns with the revert; its property
// is pinned era-independently by the unit tests over 2000 totals
// (pure.test.ts, "the design pair"), which is also what will catch a
// revert that restores the floor but forgets this file.
{
  const vApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "cadence");
  const vAuth = getAuth(vApp); connectAuthEmulator(vAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const vDb = getFirestore(vApp); connectFirestoreEmulator(vDb, "127.0.0.1", 8080);
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
  if (!eleven) fail("paused cadence: 11th answer never published");
  // 10 answers stood at {0:7, 1:3}; the 11th is another option 0.
  if (eleven.counts["0"] !== 8 || eleven.counts["1"] !== 3)
    fail("counts drifted through per-answer publishes: " + JSON.stringify(eleven.counts));
  ok("paused cadence: 11th answer published exactly (total 11, counts 8/3)");
}

// 7e · D85: the owner moves their answer and onV2AnswerUpdated folds a
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
  if (!moved) fail("D85 edit never reached the public mirror");
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
  if (moved.by.country)
    fail("a one-bucket dimension published on the edit path: " + JSON.stringify(moved.by));

  // …and not again inside the minute: the cooldown is the write-amplification
  // bound on the one repeatable answer write (D7's arithmetic).
  await expectDenied("second edit inside the 60s cooldown", () =>
    updateDoc(doc(db, "v2_users", uid, "answers", q0.id), {
      optionIdx: 1, editedAt: serverTimestamp(),
    }));
  ok("D85 edit: -old/+new published, total 11 held, frozen cells moved cleanly, cooldown holds");
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
// Read as the CREATOR, who played this day. This used to read as the
// latecomer, which asserted the leak D55 §9 closed as though it were the
// contract: OTHERDAY is three days before either account joined the group,
// and the latecomer never played it.
if (!(await getDoc(doc(db, "v2_groups", lateGid, "reveals", OTHERDAY))).exists())
  fail("group reveal doc missing");
// …and the latecomer must NOT reach it. The reveal is scoped to the members
// who were in the group for the day, plus whoever actually played it
// (revealMembersFor, pure.ts) — a non-playing joiner is neither.
await expectDenied("a joiner cannot read a reveal for a day before they joined", () =>
  getDoc(doc(lateDb, "v2_groups", lateGid, "reveals", OTHERDAY)));
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
// …and D85's edit arm does not reach it either ("not knowledge,
// obviously"): a correctly-stamped edit on a learn answer is refused by
// the surface check, so the first-attempt measurement survives the one
// write shape that IS repeatable elsewhere.
await expectDenied("learn edit refused (D85 stops at opinion surfaces)", () =>
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
if (lpub.tooSmall !== false || lpub.total !== 1 || !lpub.counts || lpub.counts["2"] !== 1)
  fail("learn first attempt did not publish exactly under the paused floor: " + JSON.stringify(lpub));
ok("learn under the paused floor: one first attempt, published exactly, retry not counted");
// four more first attempts: three right, one more wrong
for (let n = 0; n < 4; n++) {
  const lApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "learner" + n);
  const lAuth = getAuth(lApp); connectAuthEmulator(lAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const lDb = getFirestore(lApp); connectFirestoreEmulator(lDb, "127.0.0.1", 8080);
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


// 10 · Near presence (D84): the write path through the rules, the count
// through the real callable, and the exclusion of self.
{
  const meCell = "5999_1074";
  await setDoc(doc(db, "v2_presence", uid), { cell: meCell, at: serverTimestamp() });
  ok("presence: own cell written through the rules");
  // A neighbor one cell east; a third phone far away that must not count.
  const nApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "near1");
  const nAuth = getAuth(nApp); connectAuthEmulator(nAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const nDb = getFirestore(nApp); connectFirestoreEmulator(nDb, "127.0.0.1", 8080);
  const nu = await signInAnonymously(nAuth);
  await setDoc(doc(nDb, "v2_presence", nu.user.uid), { cell: "5999_1075", at: serverTimestamp() });
  const fApp = initializeApp({ projectId: "demo-insight", apiKey: "demo", appId: "demo" }, "near2");
  const fAuth = getAuth(fApp); connectAuthEmulator(fAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const fDb = getFirestore(fApp); connectFirestoreEmulator(fDb, "127.0.0.1", 8080);
  const fu = await signInAnonymously(fAuth);
  await setDoc(doc(fDb, "v2_presence", fu.user.uid), { cell: "5980_1074", at: serverTimestamp() });
  // Back to the primary user for the count. The callable excludes the
  // caller's own doc, so the answer is the one neighbor — not 2, not 3.
  const near = await httpsCallable(fns, "nearbyCountV2")({ cell: meCell });
  if (near.data.n !== 1) fail("nearby count wrong: " + JSON.stringify(near.data));
  ok("nearbyCountV2: one fresh neighbor counted, self excluded, far phone ignored");
  await expectDenied("foreign presence write refused", () =>
    setDoc(doc(db, "v2_presence", nu.user.uid), { cell: meCell, at: serverTimestamp() }));
  await expectDenied("raw-coordinate cell refused by the grid regex", () =>
    setDoc(doc(db, "v2_presence", uid), { cell: "59.913_10.752", at: serverTimestamp() }));
}

console.log("\nALL E2E CHECKS PASSED");
process.exit(0);

// Firestore security-rules tests. Run against the emulator:
//   npm run test:rules
// (which wraps `firebase emulators:exec --only firestore "vitest run …"`).
//
// These lock down the access model D98 left behind: reads are OPEN — any
// signed-in user may read any answer, profile and exact aggregate — and
// writes are not. So most of what follows pins the WRITE side
// (create-only answers, the one legal edit shape, server-only
// membership), plus the four things still closed for reasons that are not
// about answer privacy (the logic answer key, flag authorship, the
// presence cell, push tokens), plus duel answers staying sealed until a
// reveal doc exists — game timing, not audience.
//
// Reading this file after D98: an `assertSucceeds` on someone else's
// document is usually the POINT, not a hole. The holes are writes.
// They sit outside src/ so the app build never compiles them.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));

const OWNER = "owner1";
const FRIEND = "friend1";
const STRANGER = "stranger1";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "insight-rules-test",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

// The harness hands back a COMPAT Firestore (`firebase.firestore.Firestore`)
// while every call in this suite is modular — `doc`, `getDoc`,
// `collectionGroup`. That is correct at runtime, because
// rules-unit-testing builds the compat instance over the modular SDK and
// the two are the same object graph, and it does not typecheck: the
// modular type declares `type` and `toJSON`, which the compat surface does
// not. One named cast at the boundary rather than an `any` per helper.
//
// It went unsaid for as long as this file was outside every tsconfig
// project: vitest transpiles without checking types, so the suite ran
// green with four real errors in it. tsconfig.node.json includes it now.
const modular = (db: unknown): Firestore => db as Firestore;

// Seed data with rules bypassed (admin context).
async function seed(fn: (db: Firestore) => Promise<void>): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await fn(modular(ctx.firestore()));
  });
}

const asUser = (uid: string): Firestore =>
  modular(env.authenticatedContext(uid).firestore());
// No token at all. Note this is NOT the app's default user — see below.
const asSignedOut = (): Firestore => modular(env.unauthenticatedContext().firestore());

// The app's ACTUAL default user. Decision D3 makes the app anonymous-first:
// it signs in silently on first launch, so in production "signed in" almost
// always means "holds a free anonymous account", and anyone can mint
// unlimited ones from a script with no rate limit.
//
// Behaviourally identical to asUser() today, deliberately: no rule inspects
// sign_in_provider. That is precisely the point — every
// `request.auth != null` grant in this ruleset is reachable by an attacker
// for the cost of one HTTP call. Keeping the principal distinct means a test
// that says "anonymous" tests the thing it names, and a future rule that
// does gate on provider gets a ready-made lens.
const asAnonAuth = (uid = "anon1"): Firestore =>
  modular(env.authenticatedContext(uid, {
    firebase: { sign_in_provider: "anonymous" },
  }).firestore());

// Day keys are UTC, and duel answers must fall inside a window around
// request.time — so every date in this suite is relative to the run, never a
// literal. A hardcoded date passes until it ages out of the window, then
// fails for a reason unrelated to the rule under test.
const dayOffset = (n: number): string =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// What an attacker gets for free. Every assertion here is reachable with a
// scripted anonymous sign-in and no further access — so this describe is the
// honest inventory of the app's outer trust boundary, and the place to look
// when deciding whether a new `request.auth != null` grant is safe.
describe("the default user (anonymous auth) — reachable surface", () => {
  it("reads another user's answers and profile — and still not the server internals", async () => {
    // The D98 inversion, in the one test that most directly measured the
    // old model. An ANONYMOUS session reads a stranger's answer and
    // profile: that is deliberate, and it is what every named surface in
    // the app is built on. Anonymous rather than a named account on
    // purpose — anonymous-first auth (D3) means "any signed-in user" and
    // "anyone who opens the app" are the same set, and this is the file
    // that should say so out loud.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_users", OWNER), { displayName: "Owner" });
      await setDoc(doc(db, "v2_users", OWNER, "answers", "daily-000"), {
        qid: "daily-000", surface: "daily", optionIdx: 1,
      });
      await setDoc(doc(db, "v2_aggs_private", "daily-000"), { counts: { "0": 3 } });
      await setDoc(doc(db, "v2_users", OWNER, "push", "tokens"), { fcmTokens: ["tok"] });
    });
    const db = asAnonAuth();
    await assertSucceeds(getDoc(doc(db, "v2_users", OWNER, "answers", "daily-000")));
    await assertSucceeds(getDoc(doc(db, "v2_users", OWNER)));
    // …but the trigger's working state stays shut, and the push tokens
    // moved off the now-public profile precisely so that opening that read
    // did not publish a credential.
    //
    // No secrets in it, then or now. Since D98 there was no floor for it to
    // hold anything back below, and since the private mirror collapsed into
    // the published document it holds only the CATALOG accumulator — the
    // whole ~1k-entity `ent` map the public board shows a top-N of. Bigger
    // than what publishes, never other than it. Shut because nobody needs
    // it, which is the same reason it was shut before.
    await assertFails(getDoc(doc(db, "v2_aggs_private", "daily-000")));
    await assertFails(getDoc(doc(db, "v2_users", OWNER, "push", "tokens")));
  });

  it("reads the public v2 surface it needs to run", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "daily-000"), {
        surface: "daily", active: true, seq: 0, prompt: "?", options: ["a", "b"],
      });
      await setDoc(doc(db, "v2_question_aggs", "daily-000"), { tooSmall: true });
      await setDoc(doc(db, "v2_meta", "content"), { contentRev: 1 });
    });
    const db = asAnonAuth();
    await assertSucceeds(getDoc(doc(db, "v2_questions", "daily-000")));
    await assertSucceeds(getDoc(doc(db, "v2_question_aggs", "daily-000")));
    await assertSucceeds(getDoc(doc(db, "v2_meta", "content")));
  });

  it("cannot enumerate or read the discoverable profile collection", async () => {
    // Was the worst hole in the ruleset: special-category data under GDPR
    // Art.9 — Big Five vector, political coordinates, age, gender, country,
    // free-text bio, ~5km geohash — keyed by uid, readable and enumerable by
    // any signed-in user with no k-floor and no rate limit. One scripted
    // anonymous sign-in walked the entire user base.
    //
    // Closed by retiring the v1 surface (D4). The previous commit asserted
    // these as assertSucceeds; the flip to assertFails is the fix.
    await seed(async (db) => {
      for (const uid of [OWNER, FRIEND, STRANGER]) {
        await setDoc(doc(db, "insight_discoverable", uid), {
          country: "NO", ageBucket: "25-34",
          location: { geohash: "u4pru" },
          big5: { o: 0.8, c: 0.4 },
        });
      }
    });
    const db = asAnonAuth();
    await assertFails(getDocs(collection(db, "insight_discoverable")));
    await assertFails(getDoc(doc(db, "insight_discoverable", OWNER)));
  });

  it("cannot run a collection-group query across users", async () => {
    // Two of these have COLLECTION_GROUP indexes deployed
    // (firestore.indexes.json) for the admin-side account wipe. They fail
    // because no match block binds a collection-group scope — the grants
    // live under /insight_users/{uid}/… and bind {uid} — not because of an
    // explicit CG deny. Pinning it so a future broad wildcard cannot
    // silently turn a deployed index into cross-user enumeration.
    await seed(async (db) => {
      await setDoc(
        doc(db, "insight_users", OWNER, "insight_inbound_impressions", "i1"),
        { senderUid: FRIEND, traits: ["kind"] },
      );
      await setDoc(doc(db, "insight_users", OWNER, "relations", "r1"), {
        linkedUid: FRIEND,
      });
      await setDoc(doc(db, "insight_users", OWNER, "insight_daily", "2026-07-27"), {
        date: "2026-07-27", mood: 60,
      });
    });
    const db = asAnonAuth();
    await assertFails(getDocs(collectionGroup(db, "insight_inbound_impressions")));
    await assertFails(getDocs(collectionGroup(db, "relations")));
    await assertFails(getDocs(collectionGroup(db, "insight_daily")));
  });
});

// The v1 journal client was removed in D4; its rules were retired with it
// (kept undeployed in firestore.rules.v1-archive). Nothing in src/ touches
// any of these collections — the app reads and writes only v2_*. The v1
// Cloud Functions still write some of them, but they run on the admin SDK,
// which bypasses rules entirely, so denying every client grant costs them
// nothing.
//
// This is the regression guard: re-adding a client grant here should mean
// re-adding a client, deliberately, with tests.
describe("retired v1 surface is closed to clients (D4)", () => {
  const V1_DOCS: [string, string][] = [
    ["insight_users", OWNER],
    ["insight_discoverable", OWNER],
    ["Cities", "oslo"],
    ["insight_interest_items", "it1"],
    ["aggregates_by_geohash5", "u4pruyd"],
    ["aggregates_world", "snapshot"],
    ["aggregates_city", "oslo"],
    ["aggregates_media", "world"],
    ["taxonomies", "interest_categories"],
  ];

  it("every retired collection denies read and write, to owner and stranger alike", async () => {
    await seed(async (db) => {
      for (const [coll, id] of V1_DOCS) await setDoc(doc(db, coll, id), { ok: true });
    });
    for (const [coll, id] of V1_DOCS) {
      // OWNER is the owner of the uid-keyed ones — denied even so.
      await assertFails(getDoc(doc(asUser(OWNER), coll, id)));
      await assertFails(setDoc(doc(asUser(OWNER), coll, id), { ok: false }));
      await assertFails(getDoc(doc(asUser(STRANGER), coll, id)));
      await assertFails(deleteDoc(doc(asUser(STRANGER), coll, id)));
    }
  });

  it("the retired per-user subcollections are closed too", async () => {
    // These had their own match blocks, so the parent denial alone would not
    // have closed them — overlapping matches OR their grants. Deleting the
    // blocks is what closes them; this pins that nothing was missed.
    const SUBS = [
      "insight_daily", "circle", "followers", "friendRequests", "blocks",
      "insight_inbound_impressions", "insight_workouts", "relations",
    ];
    await seed(async (db) => {
      for (const sub of SUBS) {
        await setDoc(doc(db, "insight_users", OWNER, sub, "x1"), { ok: true });
      }
    });
    for (const sub of SUBS) {
      await assertFails(getDoc(doc(asUser(OWNER), "insight_users", OWNER, sub, "x1")));
      await assertFails(setDoc(doc(asUser(OWNER), "insight_users", OWNER, sub, "x2"), { ok: true }));
      await assertFails(getDoc(doc(asUser(FRIEND), "insight_users", OWNER, sub, "x1")));
    }
  });

  it("the rate-limit ledger is fully opaque to clients", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "insight_ratelimits", OWNER), { events: [] });
    });
    await assertFails(getDoc(doc(asUser(OWNER), "insight_ratelimits", OWNER)));
    await assertFails(
      setDoc(doc(asUser(OWNER), "insight_ratelimits", OWNER), { events: [] }),
    );
  });
});

// ─── v2 · daily/mirror core loop ─────────────────────────────────

describe("v2 questions + aggregates", () => {
  it("signed-in users read questions and aggs; nobody writes them", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "daily-000"), {
        surface: "daily", seq: 0, type: "binary",
        prompt: "Pineapple?", options: ["Yes", "No"], active: true,
      });
      await setDoc(doc(db, "v2_question_aggs", "daily-000"), {
        counts: { "0": 3 }, total: 3,
      });
    });
    await assertSucceeds(getDoc(doc(asUser(OWNER), "v2_questions", "daily-000")));
    await assertSucceeds(getDoc(doc(asUser(OWNER), "v2_question_aggs", "daily-000")));
    await assertFails(getDoc(doc(asSignedOut(), "v2_questions", "daily-000")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_questions", "daily-000"), { prompt: "x" }));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_question_aggs", "daily-000"), { total: 999 }));
    // merge-set / update / delete are still writes — all denied
    await assertFails(setDoc(doc(asUser(OWNER), "v2_question_aggs", "daily-000"), { total: 999 }, { merge: true }));
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_question_aggs", "daily-000"), { total: 999 }));
    await assertFails(deleteDoc(doc(asUser(OWNER), "v2_question_aggs", "daily-000")));
    await assertFails(deleteDoc(doc(asUser(OWNER), "v2_questions", "daily-000")));
  });

  it("aggregate internals (private counts, event ledger) are fully opaque", async () => {
    await seed(async (db) => {
      // A wildcard match, so the id is arbitrary — `fav-000` rather than a
      // daily qid because the catalog path is the one that still writes
      // here, and a fixture that names a document nothing produces reads
      // as a rule protecting nothing.
      await setDoc(doc(db, "v2_aggs_private", "fav-000"), { ent: { "7": 1 }, total: 1 });
      // The fixture carries what the real trigger writes — including the
      // OWNER's own uid (D28's attribution), because the read denial below
      // is what makes it safe to hold: even the uid it names cannot read
      // which questions it answered, when, out of this ledger.
      await setDoc(doc(db, "v2_agg_events", "evt1"), { qid: "daily-000", uid: OWNER });
    });
    await assertFails(getDoc(doc(asUser(OWNER), "v2_aggs_private", "fav-000")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_aggs_private", "fav-000"), { total: 9 }));
    await assertFails(getDoc(doc(asUser(OWNER), "v2_agg_events", "evt1")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_agg_events", "evt2"), { qid: "x" }));
  });

  it("velocity-scan state (D54) is opaque to clients", async () => {
    // The scan's state doc holds per-question daily counts below the
    // published floor — readable, it would be a side channel around
    // AGG_MIN_N; writable, an attacker could blind the scan to their
    // own burst by inflating its baselines.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_velocity", "state"), {
        lastScanAt: 1,
        days: { "2026-08-05": { "daily-000": 3 } },
      });
    });
    await assertFails(getDoc(doc(asUser(OWNER), "v2_velocity", "state")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_velocity", "state"), { lastScanAt: 0 }));
    await assertFails(deleteDoc(doc(asUser(OWNER), "v2_velocity", "state")));
  });
});

describe("v2 profile", () => {
  it("world-readable, owner-written, with validated fields", async () => {
    const mine = doc(asUser(OWNER), "v2_users", OWNER);
    await assertSucceeds(setDoc(mine, {
      displayName: "Mira",
      anchors: { city: "Oslo", country: "Norway" },
      anon: true,
    }));
    await assertSucceeds(getDoc(mine));
    // D98: a stranger READS the profile — that is how a uid on an answer
    // becomes a name and a cohort on screen — and still cannot WRITE it.
    // The asymmetry is the whole shape of the new model.
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_users", OWNER)));
    await assertFails(setDoc(doc(asUser(STRANGER), "v2_users", OWNER), { displayName: "x" }));
    // unknown top-level field
    await assertFails(setDoc(mine, { displayName: "Mira", secretScore: 9 }));
    // unknown anchor key
    await assertFails(setDoc(mine, { anchors: { ssn: "123" } }));
    // synced test results: map allowed, non-map rejected
    await assertSucceeds(setDoc(mine, {
      testResults: { big5: { dims: [], title: "Big Five" } },
    }, { merge: true }));
    await assertFails(setDoc(mine, { testResults: "hacked" }, { merge: true }));
  });

  // Push tokens are the reveal sender's fan-out list, and a token is a
  // CREDENTIAL — whoever holds it can push to that device. They used to be
  // an `fcmTokens` field on this profile, guarded by a rules clause that
  // refused client writes. That guard was sufficient only while the profile
  // was owner-readable; D98 opened the read, so the field MOVED to
  // v2_users/{uid}/push/tokens, which no rule grants anyone.
  //
  // Structural rather than guarded, on purpose: a field protected by a rule
  // is one edit away from being readable, a path with no read grant is not.
  // These cases pin both halves — the door is shut, and the profile did not
  // keep a back way in.
  it("push tokens are unreachable, and cannot be smuggled onto the profile", async () => {
    const mine = doc(asUser(OWNER), "v2_users", OWNER);

    // The subcollection: no read, no write, for anyone — including the owner.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_users", OWNER, "push", "tokens"), { fcmTokens: ["tok-a"] });
    });
    await assertFails(getDoc(doc(asUser(OWNER), "v2_users", OWNER, "push", "tokens")));
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_users", OWNER, "push", "tokens")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_users", OWNER, "push", "tokens"),
      { fcmTokens: ["tok-evil"] }));

    // And the field cannot come BACK onto the profile, which is the
    // regression that would silently undo the move: `fcmTokens` is no
    // longer in the hasOnly list, so any write carrying it is refused
    // whatever else it says.
    await assertFails(setDoc(mine, { displayName: "Mira", fcmTokens: ["tok-a"] }));
    await assertSucceeds(setDoc(mine, { displayName: "Mira" }));
    await assertFails(setDoc(mine, { fcmTokens: ["tok-a"] }, { merge: true }));
  });

  // testResults.logic is the VERIFIED logic score (D57): written by
  // logicSubmitV2 after server-side scoring. A client-writable copy would
  // be a forgeable one — same threat shape as fcmTokens, so the rule and
  // this test mirror that block case for case.
  it("clients cannot introduce or change testResults.logic — only the callable can", async () => {
    const mine = doc(asUser(OWNER), "v2_users", OWNER);
    // introducing it on create…
    await assertFails(setDoc(mine, {
      displayName: "Mira",
      testResults: { logic: { pctile: 94, verified: true } },
    }));
    // …or via merge onto an existing doc without the key
    await assertSucceeds(setDoc(mine, { displayName: "Mira" }));
    await assertFails(setDoc(mine, {
      testResults: { logic: { pctile: 94 } },
    }, { merge: true }));

    // the callable's write (admin SDK, rules bypassed)
    await seed(async (db) => {
      await setDoc(doc(db, "v2_users", OWNER), {
        testResults: { logic: { v: 2, verified: true, pctile: 62, marks: [true] } },
      }, { merge: true });
    });

    // the POST-merge trap, same as fcmTokens: other test results must
    // still be writable while the server-written logic key rides along
    // unchanged — banning presence instead of mutation would brick every
    // core-test sync for verified users.
    await assertSucceeds(setDoc(mine, {
      testResults: { big5: { dims: [], title: "Big Five" } },
    }, { merge: true }));

    // mutation is still refused: replacing or clearing the verified score
    await assertFails(setDoc(mine, {
      testResults: { logic: { v: 2, verified: true, pctile: 99, marks: [true] } },
    }, { merge: true }));
    await assertFails(setDoc(mine, { testResults: { logic: null } }, { merge: true }));

    // DELETING your own verified score is allowed on purpose (it is your
    // doc; the cooldown and the norms count live in the server-only
    // attempt doc, so deletion resets nothing) — but the door does not
    // swing back: reintroducing the key after a delete is a create against
    // a null prior, and that is forgery, refused.
    await assertSucceeds(updateDoc(mine, { "testResults.logic": deleteField() }));
    await assertFails(setDoc(mine, {
      testResults: { logic: { v: 2, verified: true, pctile: 94, marks: [true] } },
    }, { merge: true }));
  });

  // The D57 server-side surfaces around the verified score.
  it("logic attempt docs are opaque even to their owner; norms mirror is read-only", async () => {
    await seed(async (db) => {
      // the attempt doc holds the SEED — the answer key, until scored
      await setDoc(doc(db, "v2_logic_attempts", OWNER), { seed: 7, gv: 2, status: "open" });
      await setDoc(doc(db, "v2_logic_norms_private", "global"), { n: 3, b12: 3 });
      await setDoc(doc(db, "v2_logic_norms", "global"), { n: 25, b7: 6 });
      // the D62 difficulty stats ride the same collections, so the same
      // rules cover them — asserted so a future path rename cannot
      // silently split the two
      await setDoc(doc(db, "v2_logic_norms_private", "families"), { n: 3, f_dist2Xor_seen: 3 });
      await setDoc(doc(db, "v2_logic_norms", "families"), { n: 25, f_dist2Xor_seen: 20 });
    });
    // not even the owner reads their attempt — an owner-readable seed is a
    // devtools answer key mid-attempt
    await assertFails(getDoc(doc(asUser(OWNER), "v2_logic_attempts", OWNER)));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_logic_attempts", OWNER), { status: "scored" }));
    // exact counts stay server-side; the public mirror reads, never writes
    await assertFails(getDoc(doc(asUser(OWNER), "v2_logic_norms_private", "global")));
    await assertSucceeds(getDoc(doc(asUser(OWNER), "v2_logic_norms", "global")));
    await assertFails(getDoc(doc(asUser(OWNER), "v2_logic_norms_private", "families")));
    await assertSucceeds(getDoc(doc(asUser(OWNER), "v2_logic_norms", "families")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_logic_norms", "families"), { n: 999 }));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_logic_norms", "global"), { n: 999 }));
    await assertFails(getDoc(doc(asSignedOut(), "v2_logic_norms", "global")));
  });

  // The client builds this exact payload (ANCHOR_FIELDS in live.ts, filled
  // by the profile's Basics card). Rules reject the whole write on one bad
  // field, so client and ruleset agreeing is load-bearing, not cosmetic —
  // a mismatch means every vote silently stops recording its cohort.
  it("accepts the full anchor set the client actually sends, and holds the caps", async () => {
    const mine = doc(asUser(OWNER), "v2_users", OWNER);
    await assertSucceeds(setDoc(mine, {
      anchors: {
        city: "Oslo", country: "Norway", ageBand: "25-34", age: "29",
        gender: "Woman", profession: "Software & IT", education: "Bachelor's",
        relationship: "Partnered", heightBand: "170-179 cm",
      },
    }));
    // per-field length caps (isValidV2Anchors): ageBand 20, gender 40, city 80
    await assertFails(setDoc(mine, { anchors: { ageBand: "x".repeat(21) } }));
    await assertFails(setDoc(mine, { anchors: { gender: "x".repeat(41) } }));
    await assertFails(setDoc(mine, { anchors: { city: "x".repeat(81) } }));
    // and a non-string value is not a short string
    await assertFails(setDoc(mine, { anchors: { ageBand: 25 } }));
  });

  // D155 added `age` beside `ageBand` — the exact number, for the screens
  // that name a PERSON ("Ceramicist, 29" reads as somebody; "Ceramicist,
  // 25-34" reads as a cell). Three characters, and the negative is the
  // half that matters: a 3-char cap is what keeps this field an AGE and
  // stops it becoming somewhere to smuggle a birthday.
  it("takes an exact age of at most three characters, and nothing longer", async () => {
    const mine = doc(asUser(OWNER), "v2_users", OWNER);
    await assertSucceeds(setDoc(mine, { anchors: { age: "29" } }));
    await assertSucceeds(setDoc(mine, { anchors: { age: "104" } }));
    // A birthday does not fit, which is the point of the cap.
    await assertFails(setDoc(mine, { anchors: { age: "1990-07-12" } }));
    await assertFails(setDoc(mine, { anchors: { age: "x".repeat(4) } }));
    await assertFails(setDoc(mine, { anchors: { age: 29 } }));
  });
});

describe("the daily pulse (D139): one answer per day, day-keyed like a duel's", () => {
  const BASE = "pulse-pace";
  const seedPulse = () => seed(async (db) => {
    await setDoc(doc(db, "v2_questions", BASE), {
      surface: "pulse", seq: 0, type: "pulse", prompt: "What pace was today?",
      options: ["Crawling", "Dragging", "Steady", "Brisk", "Flying"], active: true,
    });
    await setDoc(doc(db, "v2_questions", "daily-000"), {
      surface: "daily", seq: 0, type: "binary",
      prompt: "Pineapple?", options: ["Yes", "No"], active: true,
    });
  });
  const pulseAnswer = (day: string, over: Record<string, unknown> = {}) => ({
    qid: `${BASE}_${day}`, baseQid: BASE, day, surface: "pulse", optionIdx: 3,
    answeredAt: serverTimestamp(), anchors: {}, ...over,
  });

  it("today lands; the second answer to the same day is an update and refused", async () => {
    await seedPulse();
    const day = dayOffset(0);
    const ref = doc(asUser(OWNER), "v2_users", OWNER, "answers", `${BASE}_${day}`);
    await assertSucceeds(setDoc(ref, pulseAnswer(day)));
    // setDoc on the existing doc is an UPDATE, and the D86 arm's surface
    // list keeps pulse out — "you said what you said today" (create-only
    // v1, docs/NEXT-FUNCTIONALITY.md §2).
    await assertFails(setDoc(ref, pulseAnswer(day, { optionIdx: 1 })));
    await assertFails(updateDoc(ref, { optionIdx: 1, editedAt: serverTimestamp() }));
    // …and it is public like every answer (D98), pulse included.
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_users", OWNER, "answers", `${BASE}_${day}`)));
  });

  it("the day window and the id discipline hold — the duel answers' bounds verbatim", async () => {
    await seedPulse();
    const old = dayOffset(-6);
    const future = dayOffset(3);
    const day = dayOffset(0);
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", `${BASE}_${old}`),
      pulseAnswer(old),
    ));
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", `${BASE}_${future}`),
      pulseAnswer(future),
    ));
    // doc id must be {baseQid}_{day}, and qid must equal it
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", `${BASE}_wrong`),
      pulseAnswer(day),
    ));
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", `${BASE}_${day}`),
      pulseAnswer(day, { qid: BASE }),
    ));
  });

  it("the template answers for the bound, the kill switch, and the surface claim", async () => {
    await seedPulse();
    const day = dayOffset(0);
    // optionIdx beyond the five steps
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", `${BASE}_${day}`),
      pulseAnswer(day, { optionIdx: 5 }),
    ));
    // a daily template cannot be answered as a pulse — the surface claim
    // reads off the TEMPLATE, so the composite id buys no second series
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", `daily-000_${day}`),
      pulseAnswer(day, { qid: `daily-000_${day}`, baseQid: "daily-000" }),
    ));
    // the kill switch stops the series
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", BASE), { active: false }, { merge: true });
    });
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", `${BASE}_${day}`),
      pulseAnswer(day),
    ));
  });
});

describe("feed ads (D197): readable by everyone, writable by nobody", () => {
  const AD = "ad-a";
  it("any signed-in user reads the whole pool, and nobody can write one", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_ads", AD), {
        seq: 0, advertiser: "Transit", headline: "H", body: "B", until: "2099-01-01",
      });
    });
    // The whole pool reaches every device, because the MATCH happens
    // there — asking the server for "my" ads is the moment a behavioural
    // profile exists, whatever the intentions.
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_ads", AD)));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_ads", AD), { advertiser: "Me" }));
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_ads", AD), { headline: "Mine" }));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_ads", "ad-mine"), { advertiser: "Me" }));
  });

  it("is not an answer surface at all — an ad cannot be answered", async () => {
    // There is no answer arm for an ad anywhere in the ruleset, and this
    // is what says so: the id is not a question, so the answer create's
    // question lookup finds nothing and the write is refused. An ad that
    // could be answered would fold into an aggregate nobody asked for.
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", AD),
      { qid: AD, surface: "feed", optionIdx: 0, answeredAt: serverTimestamp(), anchors: {} },
    ));
  });
});

describe("Foresight CALL, tier A (D194): sealed, public, and closed once graded", () => {
  const CALL = "call-c01";
  const seedCall = () => seed(async (db) => {
    await setDoc(doc(db, "v2_questions", CALL), {
      surface: "call", seq: 0, type: "call", prompt: "Will it be lopsided?",
      options: ["It will", "It stays close"], active: true, tier: "A",
      resolvesAt: "2026-10-01",
      rubric: { kind: "agg", qid: "daily-000", test: "topShareAtLeast", threshold: 60 },
    });
  });
  const callAnswer = (over: Record<string, unknown> = {}) => ({
    qid: CALL, surface: "call", optionIdx: 0,
    answeredAt: serverTimestamp(), anchors: {}, ...over,
  });
  const mine = () => doc(asUser(OWNER), "v2_users", OWNER, "answers", CALL);

  it("a call is answered like any world question, and read like one", async () => {
    await seedCall();
    await assertSucceeds(setDoc(mine(), callAnswer()));
    // Public (D98) — the crowd's split on a call is the card's own reveal.
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_users", OWNER, "answers", CALL)));
  });

  it("A SEALED GUESS CANNOT BE MOVED — the D86 edit arm's surface list keeps `call` out", async () => {
    await seedCall();
    await assertSucceeds(setDoc(mine(), callAnswer()));
    await assertFails(updateDoc(mine(), { optionIdx: 1, editedAt: serverTimestamp() }));
    await assertFails(setDoc(mine(), callAnswer({ optionIdx: 1 })));
  });

  it("ONCE A GRADE IS PUBLISHED, THE CALL CLOSES", async () => {
    // The clause isCallAnswer() exists for. Outcomes are world-readable
    // the moment the resolver writes them, so without this a player reads
    // the grade and then "predicts" it — every score in the feature would
    // be free.
    await seedCall();
    await seed(async (db) => {
      await setDoc(doc(db, "v2_call_outcomes", CALL), {
        outcomeIdx: 0, resolvedBy: "auto", inputs: { qid: "daily-000", total: 100, counts: { "0": 70 } },
      });
    });
    await assertFails(setDoc(mine(), callAnswer()));
  });

  it("the outcome is readable by anyone and writable by nobody", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_call_outcomes", CALL), { outcomeIdx: 0, resolvedBy: "auto" });
    });
    // Read: the grade AND its basis, so a player can recompute rather than
    // trust (FORESIGHT-CALLS §6).
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_call_outcomes", CALL)));
    // Write: nobody. A client-writable outcomeIdx would make every score in
    // the feature forgeable in one request.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_call_outcomes", CALL), { outcomeIdx: 1 }));
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_call_outcomes", CALL), { outcomeIdx: 1 }));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_call_outcomes", "call-new"), { outcomeIdx: 0 }));
  });

  it("the Patterns loadings read like an aggregate and write like one — nobody (v28 §2)", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_patterns", "loadings"), { k: 8, q: { "daily-000": { v: [0.1], n: 3 } } });
    });
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_patterns", "loadings")));
    // A client-writable model would make the whole map forgeable in one request.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_patterns", "loadings"), { k: 8, q: {} }));
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_patterns", "loadings"), { k: 9 }));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_patterns", "loadings-2"), { k: 8 }));
  });

  it("D330: the trait cube reads like an aggregate and writes like one — nobody", async () => {
    // The cube keyed on TEST RESULTS — the D8 line the owner amended. It
    // is a published aggregate like any other: readable by any signed-in
    // user (the inputs, answers and testResults, are both public since
    // D98), and writable by nobody, because a client-writable cube would
    // make every cohort reading in the app forgeable in one request.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_question_traits", "daily-000"), {
        at: 1, total: 4,
        by: {
          big5: { "The Quiet One": { "0": 2 }, untested: { "1": 2 } },
          big5_O: { b0: { "0": 2 }, untested: { "1": 2 } },
        },
      });
    });
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_question_traits", "daily-000")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_question_traits", "daily-000"), { by: {} }));
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_question_traits", "daily-000"), { total: 99 }));
    // …including a question that has no cube yet: an absent document is
    // "no reading yet" (D1), not an invitation to mint one.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_question_traits", "daily-001"), { total: 1 }));
  });

  it("the published serving order (D316) reads like an aggregate and writes like one — nobody", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_rank", "feed"), {
        day: "2026-08-26",
        topics: { food: { qids: ["feed-f10"], total: 7 } },
      });
    });
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_rank", "feed")));
    // A client-writable order would make what everyone is served forgeable
    // in one request — the v2_patterns argument, one shelf down.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_rank", "feed"), { topics: {} }));
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_rank", "feed"), { day: "2026-08-27" }));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_rank", "learn"), { topics: {} }));
  });

  it("a person's Patterns state is readable and writable by NOBODY — the owner included", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_users", OWNER, "patterns", "state"), { v: [0.2], n: 4 });
    });
    // The push/ shape: no read grant at all, so the latent vector cannot
    // be opened by accident — not by a stranger, not by its own subject.
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_users", OWNER, "patterns", "state")));
    await assertFails(getDoc(doc(asUser(OWNER), "v2_users", OWNER, "patterns", "state")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_users", OWNER, "patterns", "state"), { v: [1], n: 1 }));
  });

  it("the interest profile is the owner's to read, a stranger's to never see, and nobody's to write (D317/D322)", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_users", OWNER, "taste", "profile"), { t: { food: 3 }, n: 3 });
    });
    // Shown to its subject is D163's floor, carried over the reversal —
    // the owner read is the grant that makes "the app models you" a
    // sentence the app can show rather than one it hopes nobody asks.
    await assertSucceeds(getDoc(doc(asUser(OWNER), "v2_users", OWNER, "taste", "profile")));
    // NOT public, unlike the answers it derives from (D98): what you
    // answered is the product; what the system concluded you are INTO is
    // a summary nobody signed up to be read as by strangers.
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_users", OWNER, "taste", "profile")));
    // Client write closed: a self-writable profile would let a device
    // forge its own fetch weighting.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_users", OWNER, "taste", "profile"), { t: { food: 99 }, n: 99 }));
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_users", OWNER, "taste", "profile"), { n: 99 }));
  });

  it("the engagement day docs read like an aggregate and write like one — nobody (R1/D268)", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_engagement_daily", "2026-08-22"), {
        day: "2026-08-22", actives: 3, firstTime: 1, votes: 5, events: 5,
      });
      await setDoc(doc(db, "v2_engagement_daily", "meta"), { lastDay: "2026-08-22" });
    });
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_engagement_daily", "2026-08-22")));
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_engagement_daily", "meta")));
    await assertFails(getDoc(doc(asSignedOut(), "v2_engagement_daily", "2026-08-22")));
    // A client-writable count would make the whole trail forgeable.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_engagement_daily", "2026-08-23"), { actives: 9 }));
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_engagement_daily", "2026-08-22"), { actives: 9 }));
    await assertFails(deleteDoc(doc(asUser(OWNER), "v2_engagement_daily", "2026-08-22")));
  });

  it("a person's engagement bookkeeping is readable and writable by NOBODY — the owner included (D268)", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_users", OWNER, "engagement", "_state"), {
        firstDay: "2026-08-01", lastDay: "2026-08-22", activeDays: 9, streak: 2,
      });
    });
    // The push/ shape again: no read grant at all, so the pair cannot be
    // opened by accident — not by a stranger, not by its own subject.
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_users", OWNER, "engagement", "_state")));
    await assertFails(getDoc(doc(asUser(OWNER), "v2_users", OWNER, "engagement", "_state")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_users", OWNER, "engagement", "_state"), { streak: 99 }));
  });

  // A valid rung-2 rollup: yesterday's date-shaped id, the pinned field
  // list, bounded ints, folded false at birth (R3/D272).
  const rollupDay = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const rollup = (over: Record<string, unknown> = {}) => ({
    day: rollupDay(),
    sessions: 2, fgMin: 2, quiet: 1, dayparts: [0, 1, 1, 0], answers: 3,
    feedB: 2, depthEnd: 0, stops: 4, lenses: 1, folded: false,
    build: 24, platform: "web",
    expireAt: new Date(Date.now() + 90 * 86400000),
    ...over,
  });

  it("a person's day rollup is owner-create-only, date-keyed, field-pinned (R3/D272)", async () => {
    await assertSucceeds(setDoc(doc(asUser(OWNER), "v2_users", OWNER, "engagement", rollupDay()), rollup()));
    // not someone else's subtree, not a bare-map id, not a mismatched day
    await assertFails(setDoc(doc(asUser(STRANGER), "v2_users", OWNER, "engagement", rollupDay()), rollup()));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_users", OWNER, "engagement", "_state"), rollup()));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_users", OWNER, "engagement", "2026-01-01"), rollup({ day: "2026-01-01" })));
    // folded is the fold's flag, never the client's
    await assertFails(setDoc(doc(asUser(FRIEND), "v2_users", FRIEND, "engagement", rollupDay()), rollup({ folded: true })));
    await assertFails(setDoc(doc(asUser(FRIEND), "v2_users", FRIEND, "engagement", rollupDay()), rollup({ sessions: 5000 })));
  });

  it("the rollup's hasOnly IS the two-channel pin: a question id is refused, and nobody reads", async () => {
    const day = rollupDay();
    await assertSucceeds(setDoc(doc(asUser(OWNER), "v2_users", OWNER, "engagement", day), rollup()));
    // the smuggle: reading history on the person channel
    await assertFails(setDoc(doc(asUser(FRIEND), "v2_users", FRIEND, "engagement", day), rollup({ qids: { "feed-001": 1 } })));
    // readable by NOBODY — the owner included (the push-tokens posture)
    await assertFails(getDoc(doc(asUser(OWNER), "v2_users", OWNER, "engagement", day)));
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_users", OWNER, "engagement", day)));
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_users", OWNER, "engagement", day), { folded: true }));
    await assertFails(deleteDoc(doc(asUser(OWNER), "v2_users", OWNER, "engagement", day)));
  });

  // A valid rung-1 shard: yesterday's day, the pinned vocabulary, nothing
  // identifying (R2/D270).
  const shard = (over: Record<string, unknown> = {}) => ({
    day: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    build: 24, platform: "web", sampled: true, rate: 1,
    s: { opens: 1, feedSeen: 2 },
    ...over,
  });

  it("an attention shard is create-only, day-bounded and vocabulary-pinned (R2/D270)", async () => {
    await assertSucceeds(setDoc(doc(asUser(OWNER), "v2_attention", "shard-1"), shard()));
    await assertFails(setDoc(doc(asSignedOut(), "v2_attention", "shard-2"), shard()));
    // a uid on the question channel is the two-channel rule's exact breach
    await assertFails(setDoc(doc(asUser(OWNER), "v2_attention", "shard-3"), shard({ uid: OWNER })));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_attention", "shard-4"), shard({ day: "2026-01-01" })));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_attention", "shard-5"), shard({ s: { opens: 1, notAKey: 1 } })));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_attention", "shard-6"), shard({ sampled: false })));
  });

  it("refuses a sampling rate below the floor — the fold weighs by 1/rate", async () => {
    // `rate` bounded only from above was a hole with a factor in it: the
    // nightly fold multiplies every bucket by 1 / rate, so one create
    // from one free anonymous account could add ~1e12 devices — and
    // ~1e12 to any question's seen and answered counts — to the
    // world-readable engagement day document, which is what the pulse
    // console reads and what the retirement scorecard proposes from.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_attention", "r-tiny"), shard({ rate: 1e-12 })));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_attention", "r-zero"), shard({ rate: 0 })));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_attention", "r-neg"), shard({ rate: -0.5 })));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_attention", "r-over"), shard({ rate: 2 })));
    // The floor itself is honest — it is MIN_SHARD_RATE in
    // functions/src/engagement.ts, a tenth of a percent — and so is
    // everything up to 1.
    await assertSucceeds(setDoc(doc(asUser(OWNER), "v2_attention", "r-floor"), shard({ rate: 0.001 })));
    await assertSucceeds(setDoc(doc(asUser(OWNER), "v2_attention", "r-one"), shard({ rate: 1 })));
  });

  it("shards are readable and editable by NOBODY, and the qids map stays shut until D271", async () => {
    await assertSucceeds(setDoc(doc(asUser(OWNER), "v2_attention", "mine"), shard()));
    // not even the writer: a readable pile is the funnel's raw material
    await assertFails(getDoc(doc(asUser(OWNER), "v2_attention", "mine")));
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_attention", "mine")));
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_attention", "mine"), { s: { opens: 4 } }));
    await assertFails(deleteDoc(doc(asUser(OWNER), "v2_attention", "mine")));
    // empty is tolerated (an older client may send the field bare)…
    await assertSucceeds(setDoc(doc(asUser(OWNER), "v2_attention", "q0"), shard({ qids: {} })));
    // …and since D271's adoption the map is OPEN within its cap: a
    // question's counts, on a doc that carries no uid by construction.
    await assertSucceeds(setDoc(doc(asUser(OWNER), "v2_attention", "q1"), shard({ qids: { "feed-001": { s: 1, a: 1 } } })));
    // over the cap — the client's overflow cell exists so this never
    // happens honestly, and a dishonest client is refused wholesale
    const over: Record<string, { s: number }> = {};
    for (let i = 0; i <= 120; i++) over[`feed-${i}`] = { s: 1 };
    await assertFails(setDoc(doc(asUser(OWNER), "v2_attention", "q2"), shard({ qids: over })));
  });

  it("the option bound, the kill switch and the surface claim all read off the question", async () => {
    await seedCall();
    await assertFails(setDoc(mine(), callAnswer({ optionIdx: 2 })));
    // A daily question cannot be answered as a call, so the call surface
    // buys no second answer to a question already answered.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "daily-000"), {
        surface: "daily", seq: 0, type: "binary", prompt: "P", options: ["Yes", "No"], active: true,
      });
    });
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", "daily-000"),
      callAnswer({ qid: "daily-000" }),
    ));
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", CALL), { active: false }, { merge: true });
    });
    await assertFails(setDoc(mine(), callAnswer()));
  });
});

describe("v2 answers (world-readable since D98; option edits only — D86)", () => {
  const QID = "daily-000";
  const seedQuestion = () => seed(async (db) => {
    await setDoc(doc(db, "v2_questions", QID), {
      surface: "daily", seq: 0, type: "binary",
      prompt: "Pineapple?", options: ["Yes", "No"], active: true,
    });
  });
  const answer = (over: Record<string, unknown> = {}) => ({
    qid: QID, surface: "daily", optionIdx: 1,
    answeredAt: serverTimestamp(), anchors: {}, ...over,
  });

  it("D86: the owner may move optionIdx — one shape, stamped, cooled down", async () => {
    await seedQuestion();
    const ref = doc(asUser(OWNER), "v2_users", OWNER, "answers", QID);
    await assertSucceeds(setDoc(ref, answer()));
    // Every refused shape FIRST: the success below starts the 60s
    // cooldown, after which a refusal no longer isolates the clause it
    // aims at.
    await assertFails(updateDoc(ref, { optionIdx: 0 }));                               // no audit stamp
    await assertFails(updateDoc(ref, { optionIdx: 0, editedAt: new Date() }));         // stamp != request.time
    await assertFails(updateDoc(ref, { optionIdx: 2, editedAt: serverTimestamp() }));  // >= options.size()
    await assertFails(updateDoc(ref, { optionIdx: -1, editedAt: serverTimestamp() })); // negative
    // The anchors snapshot and answeredAt are FROZEN: an edit moves which
    // option you hold, never which cohort you answered from (D8) — the
    // trigger's -old/+new delta depends on the cells not moving.
    await assertFails(updateDoc(ref, {
      optionIdx: 0, editedAt: serverTimestamp(), anchors: { city: "Oslo, NO" },
    }));
    await assertFails(updateDoc(ref, {
      optionIdx: 0, editedAt: serverTimestamp(), answeredAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(ref, {
      optionIdx: 0, editedAt: serverTimestamp(), qid: "other",
    }));
    // …and never someone else's answer
    await assertFails(updateDoc(
      doc(asUser(FRIEND), "v2_users", OWNER, "answers", QID),
      { optionIdx: 0, editedAt: serverTimestamp() },
    ));
    // setDoc on an existing doc is an update rewriting answeredAt → denied
    await assertFails(setDoc(ref, answer({ optionIdx: 0 })));

    // the one admitted shape
    await assertSucceeds(updateDoc(ref, { optionIdx: 0, editedAt: serverTimestamp() }));
    // …and not again inside 60s. Edits are the only REPEATABLE answer
    // write, and each runs the aggregate transaction against two docs
    // keyed by qid (D7's write ceiling) — the cooldown is the bound.
    await assertFails(updateDoc(ref, { optionIdx: 1, editedAt: serverTimestamp() }));
    // delete stays closed
    await assertFails(deleteDoc(ref));
  });

  it("D86: the kill switch reaches edits, not just creates", async () => {
    // Its own question and a FIRST edit, so the refusal can only be the
    // active check — the cooldown test above cannot isolate it.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "off-100"), {
        surface: "daily", seq: 4, type: "binary",
        prompt: "?", options: ["a", "b"], active: true,
      });
    });
    const ref = doc(asUser(OWNER), "v2_users", OWNER, "answers", "off-100");
    await assertSucceeds(setDoc(ref, answer({ qid: "off-100" })));
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "off-100"), {
        surface: "daily", seq: 4, type: "binary",
        prompt: "?", options: ["a", "b"], active: false,
      });
    });
    await assertFails(updateDoc(ref, { optionIdx: 0, editedAt: serverTimestamp() }));
  });

  it("the answer's surface must BE the question's, not merely be world-scoped", async () => {
    // isWorldAnswer() checks the question's own surface, and its comment
    // says "the claimed surface must match the question's own". It used to
    // check MEMBERSHIP of the same four-name list on both sides instead of
    // equality, which is the same test twice and no comparison at all.
    //
    // The comment's stated case still held either way — a duel-bank
    // question carries surface "group"/"duo", which is in neither list.
    // What did not hold is the four world surfaces against each other, and
    // one of those pairs is load-bearing: the D86 edit arm keys on the
    // ANSWER's self-declared surface, and excludes "learn" because
    // first-attempt-only IS D32's measurement. Answer a learn question as
    // "feed" and the edit arm lets you move it afterwards.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "learn-mislabel"), {
        surface: "learn", seq: 0, type: "choice",
        prompt: "?", options: ["a", "b", "c"], active: true,
      });
    });
    const mref = doc(asUser(OWNER), "v2_users", OWNER, "answers", "learn-mislabel");
    await assertFails(setDoc(mref, {
      qid: "learn-mislabel", surface: "feed", optionIdx: 2,
      answeredAt: serverTimestamp(), anchors: {},
    }));
    // …and the honest label is still accepted, so this refuses the lie
    // rather than the question.
    await assertSucceeds(setDoc(mref, {
      qid: "learn-mislabel", surface: "learn", optionIdx: 2,
      answeredAt: serverTimestamp(), anchors: {},
    }));
  });

  it("a question with no surface field is answerable as daily, and only as daily", async () => {
    // The default on the get() keeps a field-less bank doc answerable
    // rather than permanently bricked — that half of the clause predates
    // the equality and survives it. What the equality adds is that the
    // answer has to make the same claim the default does.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "surfaceless"), {
        seq: 0, type: "classic", prompt: "?", options: ["a", "b"], active: true,
      });
    });
    const sref = doc(asUser(OWNER), "v2_users", OWNER, "answers", "surfaceless");
    await assertFails(setDoc(sref, {
      qid: "surfaceless", surface: "test", optionIdx: 0,
      answeredAt: serverTimestamp(), anchors: {},
    }));
    await assertSucceeds(setDoc(sref, {
      qid: "surfaceless", surface: "daily", optionIdx: 0,
      answeredAt: serverTimestamp(), anchors: {},
    }));
  });

  it("D327: an anonymous answer writes, counts, and never reaches a stranger", async () => {
    // The whole feature is ONE surface value outside the read arms'
    // public lists. Create must accept it; both read grants must not.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "anon-d"), {
        surface: "daily", seq: 0, type: "binary",
        prompt: "?", options: ["a", "b"], active: true,
      });
      await setDoc(doc(db, "v2_questions", "anon-f"), {
        surface: "feed", seq: 0, type: "vote",
        prompt: "?", options: ["a", "b"], active: true,
      });
    });
    const dref = doc(asUser(OWNER), "v2_users", OWNER, "answers", "anon-d");
    const fref = doc(asUser(OWNER), "v2_users", OWNER, "answers", "anon-f");
    await assertSucceeds(setDoc(dref, {
      qid: "anon-d", surface: "daily-anon", optionIdx: 1,
      answeredAt: serverTimestamp(), anchors: {},
    }));
    await assertSucceeds(setDoc(fref, {
      qid: "anon-f", surface: "feed-anon", optionIdx: 0,
      answeredAt: serverTimestamp(), anchors: {},
    }));
    // The owner still reads their own — the Mirror's stamp depends on it.
    await assertSucceeds(getDoc(doc(asUser(OWNER), "v2_users", OWNER, "answers", "anon-d")));
    // A stranger cannot read the doc by id…
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_users", OWNER, "answers", "anon-d")));
    // …and cannot ASK for anon surfaces: a list query naming them is
    // refused wholesale (D65's value-test shape doing its job), while the
    // standing public-list query still works and simply cannot contain
    // them.
    await assertFails(getDocs(query(
      collection(asUser(STRANGER), "v2_users", OWNER, "answers"),
      where("surface", "in", ["daily-anon", "feed-anon"]))));
    await assertFails(getDocs(query(
      collectionGroup(asUser(STRANGER), "answers"),
      where("qid", "==", "anon-d"),
      where("surface", "in", ["daily", "daily-anon"]))));
    const pub = await assertSucceeds(getDocs(query(
      collection(asUser(STRANGER), "v2_users", OWNER, "answers"),
      where("surface", "in", ["daily", "feed", "test", "learn"]))));
    expect((pub as { size: number }).size).toBe(0);
  });

  it("D327: the anon surface still answers only its OWN question's bank", async () => {
    // worldBaseOf feeds the same equality every named answer passes
    // through — "feed-anon" against a daily question is the mislabel
    // refusal again, one value over.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "anon-d2"), {
        surface: "daily", seq: 1, type: "binary",
        prompt: "?", options: ["a", "b"], active: true,
      });
    });
    const ref2 = doc(asUser(OWNER), "v2_users", OWNER, "answers", "anon-d2");
    await assertFails(setDoc(ref2, {
      qid: "anon-d2", surface: "feed-anon", optionIdx: 0,
      answeredAt: serverTimestamp(), anchors: {},
    }));
    // …and the world list admits no anon variant for the surfaces the
    // record excludes: learn is first-attempt measurement, test items are
    // instrument inputs.
    await assertFails(setDoc(ref2, {
      qid: "anon-d2", surface: "learn-anon", optionIdx: 0,
      answeredAt: serverTimestamp(), anchors: {},
    }));
  });

  it("D327: an anonymous answer edits like its base — the opinion moves, no name appears", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "anon-e"), {
        surface: "daily", seq: 2, type: "binary",
        prompt: "?", options: ["a", "b"], active: true,
      });
    });
    const eref = doc(asUser(OWNER), "v2_users", OWNER, "answers", "anon-e");
    await assertSucceeds(setDoc(eref, {
      qid: "anon-e", surface: "daily-anon", optionIdx: 1,
      answeredAt: serverTimestamp(), anchors: {},
    }));
    await assertSucceeds(updateDoc(eref, { optionIdx: 0, editedAt: serverTimestamp() }));
  });

  it("D86 reaches only opinion surfaces: learn and duel answers stay frozen", async () => {
    // learn: first-attempt-only IS the measurement (D32) — "not knowledge,
    // obviously", in the owner's own words.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "learn-frozen"), {
        surface: "learn", seq: 0, type: "choice",
        prompt: "?", options: ["a", "b", "c"], active: true,
      });
    });
    const lref = doc(asUser(OWNER), "v2_users", OWNER, "answers", "learn-frozen");
    await assertSucceeds(setDoc(lref, {
      qid: "learn-frozen", surface: "learn", optionIdx: 0,
      answeredAt: serverTimestamp(), anchors: {},
    }));
    await assertFails(updateDoc(lref, { optionIdx: 1, editedAt: serverTimestamp() }));

    // duel: the SEAL is the product — an editable sealed answer lets a
    // member re-decide after reading the room.
    const GID = "g_frozen";
    const DAY = dayOffset(-1);
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "duo-frozen"), {
        surface: "duo", seq: 0, type: "classic",
        prompt: "?", options: ["a", "b"], active: true,
      });
      await setDoc(doc(db, "v2_groups", GID), {
        name: "Pair", mode: "duo", memberUids: [OWNER, FRIEND],
      });
    });
    const dref = doc(asUser(OWNER), "v2_users", OWNER, "answers", `g_${GID}_${DAY}`);
    await assertSucceeds(setDoc(dref, {
      qid: "duo-frozen", surface: "duo", optionIdx: 0, guessIdx: 1,
      gid: GID, day: DAY, answeredAt: serverTimestamp(), anchors: {},
    }));
    await assertFails(updateDoc(dref, { optionIdx: 1, editedAt: serverTimestamp() }));
  });

  it("rejects out-of-range/mismatched/malformed answers", async () => {
    await seedQuestion();
    const ref = (id: string) => doc(asUser(OWNER), "v2_users", OWNER, "answers", id);
    await assertFails(setDoc(ref(QID), answer({ optionIdx: 2 })));           // >= options.size()
    await assertFails(setDoc(ref(QID), answer({ optionIdx: -1 })));          // negative
    await assertFails(setDoc(ref(QID), answer({ qid: "other" })));           // qid != doc id
    await assertFails(setDoc(ref("nope-000"), answer({ qid: "nope-000" }))); // unknown question
    await assertFails(setDoc(ref(QID), answer({ surface: "bogus" })));       // bad surface
    await assertFails(setDoc(ref(QID), answer({ extra: 1 })));               // unknown field
    await assertFails(setDoc(ref(QID), answer({ answeredAt: new Date() }))); // not request.time
  });

  it("honours the active kill switch and the question's own surface", async () => {
    await seed(async (db) => {
      // flipped off by an operator — must stop accepting answers, not just
      // stop being served
      await setDoc(doc(db, "v2_questions", "off-000"), {
        surface: "daily", seq: 1, type: "binary",
        prompt: "?", options: ["a", "b"], active: false,
      });
      // a duel-bank question must not be answerable as a world question,
      // or its votes land in the public aggregate
      await setDoc(doc(db, "v2_questions", "group-gu0"), {
        surface: "group", seq: 2, type: "binary",
        prompt: "?", options: ["a", "b"], active: true,
      });
      // compatibility: a doc predating either field stays answerable
      // (both checks use .get() defaults) rather than being bricked
      await setDoc(doc(db, "v2_questions", "bare-000"), {
        seq: 3, type: "binary", prompt: "?", options: ["a", "b"],
      });
    });
    const ref = (id: string) => doc(asUser(OWNER), "v2_users", OWNER, "answers", id);
    await assertFails(setDoc(ref("off-000"), answer({ qid: "off-000" })));
    await assertFails(setDoc(ref("group-gu0"), answer({ qid: "group-gu0" })));
    await assertSucceeds(setDoc(ref("bare-000"), answer({ qid: "bare-000" })));
  });

  it("a group 'pick' answer can name any member, not just the first 20", async () => {
    // "pick" questions carry no bank options — the options ARE the group's
    // members, and GROUP_CAP is 32. A blanket optionIdx < 20 made members
    // 21-32 permanently unpickable, surfaced as a generic write failure.
    const GID = "g_big";
    const members = Array.from({ length: 32 }, (_, i) => `m${i}`);
    const DAY = dayOffset(-1);
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "group-pick0"), {
        surface: "group", seq: 0, type: "pick", prompt: "Who?", options: [],
      });
      await setDoc(doc(db, "v2_groups", GID), {
        name: "Big", mode: "group", memberUids: members,
      });
    });
    const aid = `g_${GID}_${DAY}`;
    const duel = (idx: number, guess?: number) => ({
      qid: "group-pick0", surface: "group", optionIdx: idx,
      ...(guess === undefined ? {} : { guessIdx: guess }),
      gid: GID, day: DAY, answeredAt: serverTimestamp(), anchors: {},
    });
    await assertSucceeds(setDoc(
      doc(asUser("m0"), "v2_users", "m0", "answers", aid), duel(31)));
    // still bounded by the member count
    await assertFails(setDoc(
      doc(asUser("m1"), "v2_users", "m1", "answers", aid), duel(32)));

    // …and the SAME for guessIdx, which is the half this test did not
    // cover when it was written: the fixture above never set the field, so
    // `guessIdx < 20` survived beside the widened optionIdx bound and
    // members 21-32 stayed unguessable on every pick day. A guess names an
    // option, so it takes the option bound — no more, no less.
    await assertSucceeds(setDoc(
      doc(asUser("m2"), "v2_users", "m2", "answers", aid), duel(0, 31)));
    await assertFails(setDoc(
      doc(asUser("m3"), "v2_users", "m3", "answers", aid), duel(0, 32)));
    // absent stays legal — the rule reads through .get("guessIdx", 0)
    await assertSucceeds(setDoc(
      doc(asUser("m4"), "v2_users", "m4", "answers", aid), duel(0)));
  });

  it("a pick answer may snapshot WHO the index meant, and only honestly (D224)", async () => {
    // A pick's optionIdx is relative to the roster order the answering
    // client held, which a join or leave silently remaps — so the answer
    // may carry `pickUid`, the member the index meant at the moment of
    // voting. Optional (older clients omit it); when present it must name
    // a current member, and only a pick question (empty bank options) may
    // carry one.
    const GID = "g_snap";
    const DAY = dayOffset(-1);
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "group-pick1"), {
        surface: "group", seq: 0, type: "pick", prompt: "Who?", options: [],
      });
      await setDoc(doc(db, "v2_questions", "group-opt1"), {
        surface: "group", seq: 1, type: "binary", prompt: "Which?", options: ["a", "b"],
      });
      await setDoc(doc(db, "v2_groups", GID), {
        name: "Snap", mode: "group", memberUids: ["s0", "s1", "s2"],
      });
    });
    const aid = `g_${GID}_${DAY}`;
    const duel = (over: Record<string, unknown>) => ({
      qid: "group-pick1", surface: "group", optionIdx: 1,
      gid: GID, day: DAY, answeredAt: serverTimestamp(), anchors: {}, ...over,
    });
    // names a member → in
    await assertSucceeds(setDoc(
      doc(asUser("s0"), "v2_users", "s0", "answers", aid), duel({ pickUid: "s1" })));
    // a stranger's uid is not a pick anyone at this table could have made
    await assertFails(setDoc(
      doc(asUser("s1"), "v2_users", "s1", "answers", aid), duel({ pickUid: "nobody" })));
    // wrong type
    await assertFails(setDoc(
      doc(asUser("s1"), "v2_users", "s1", "answers", aid), duel({ pickUid: 1 })));
    // a question WITH bank options has no members as options, so a
    // snapshot on it is a claim about a list that was never shown
    await assertFails(setDoc(
      doc(asUser("s2"), "v2_users", "s2", "answers", aid), duel({ qid: "group-opt1", pickUid: "s1" })));
    // absent stays legal — pre-D224 clients omit it
    await assertSucceeds(setDoc(
      doc(asUser("s2"), "v2_users", "s2", "answers", aid), duel({})));
  });

  it("a duel guess is bounded by the question's options, not a flat 20", async () => {
    // The non-pick half of the same bound. A bank question with 3 options
    // has no 5th one to guess, but `guessIdx < 20` accepted it — and the
    // number reached duelAggDelta, whose range check is the only other
    // thing standing between a fabricated index and a published aggregate.
    const GID = "g_small";
    const DAY = dayOffset(-1);
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "duo-q0"), {
        surface: "duo", seq: 0, type: "classic", prompt: "Which?",
        options: ["a", "b", "c"],
      });
      // Deliberately MORE members than options: with the two equal, this
      // fixture would clear either branch of duelIndexSpace() and could not
      // tell which one ran. 3 options against 5 members means only the
      // options branch admits 2 and refuses 3.
      await setDoc(doc(db, "v2_groups", GID), {
        name: "Pair", mode: "duo", memberUids: ["p0", "p1", "p2", "p3", "p4"],
      });
    });
    const aid = `g_${GID}_${DAY}`;
    const duel = (guess: number) => ({
      qid: "duo-q0", surface: "duo", optionIdx: 0, guessIdx: guess,
      gid: GID, day: DAY, answeredAt: serverTimestamp(), anchors: {},
    });
    await assertSucceeds(setDoc(
      doc(asUser("p0"), "v2_users", "p0", "answers", aid), duel(2)));
    await assertFails(setDoc(
      doc(asUser("p1"), "v2_users", "p1", "answers", aid), duel(3)));
    // the old bound's whole range, now correctly refused
    await assertFails(setDoc(
      doc(asUser("p2"), "v2_users", "p2", "answers", aid), duel(19)));
  });

  it("two different users can answer the same question", async () => {
    await seedQuestion();
    await assertSucceeds(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", QID), answer()));
    await assertSucceeds(setDoc(
      doc(asUser(FRIEND), "v2_users", FRIEND, "answers", QID),
      answer({ optionIdx: 0 })));
  });

  it("learn answers (D32): the first attempt records once; a retry has nothing it may write", async () => {
    // Learn's crowd stat must be a people-rate, not an attempt-rate — the
    // scheduler deliberately re-asks cards (GAP/STREAK/check-ins), so if a
    // retry could write, a struggling user would count four times, mostly
    // wrong, and the stat would measure the scheduler. First-attempt-only
    // is enforced HERE, by the create-only rule, not by client politeness:
    // this case is the one that pins the policy at the rules level.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "learn-cell1"), {
        surface: "learn", seq: 0, type: "choice",
        prompt: "What do ribosomes build?",
        options: ["Proteins", "Lipids", "DNA", "Sugars"], active: true,
      });
    });
    const learnAnswer = (over: Record<string, unknown> = {}) => ({
      qid: "learn-cell1", surface: "learn", optionIdx: 2,
      answeredAt: serverTimestamp(), anchors: {}, ...over,
    });
    const ref = doc(asUser(OWNER), "v2_users", OWNER, "answers", "learn-cell1");
    await assertSucceeds(setDoc(ref, learnAnswer()));
    // the spaced retry — denied as an update, right or wrong either way
    await assertFails(setDoc(ref, learnAnswer({ optionIdx: 0 })));
    // bounded by the card's own options
    await assertFails(setDoc(
      doc(asUser(FRIEND), "v2_users", FRIEND, "answers", "learn-cell1"),
      learnAnswer({ optionIdx: 4 })));
    // and the world-class check still fences duel questions from a
    // "learn"-claimed answer (same class rule as daily/feed/test)
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "group-gu9"), {
        surface: "group", seq: 9, type: "choice",
        prompt: "?", options: ["a", "b"], active: true,
      });
    });
    await assertFails(setDoc(
      doc(asUser(FRIEND), "v2_users", FRIEND, "answers", "group-gu9"),
      learnAnswer({ qid: "group-gu9", optionIdx: 0 })));
  });

  it("catalog answers: entity-keyed, create-only, and only on catalog questions", async () => {
    // docs/CATALOG-QUESTIONS.md: the stored answer is a catalogue key, so
    // the doc carries `entity` and no optionIdx at all. The grant is new,
    // so every edge gets a negative: a catalog answer on a vote question
    // would poison its per-option aggregate, and an optionIdx answer on a
    // catalog question would do the reverse.
    const CQ = "feed-cat0";
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", CQ), {
        surface: "feed", seq: 0, type: "catalog",
        prompt: "Favourite?", options: [], active: true,
      });
    });
    const ref = (id: string) => doc(asUser(OWNER), "v2_users", OWNER, "answers", id);
    const cat = (over: Record<string, unknown> = {}) => ({
      qid: CQ, surface: "feed", entity: 25,
      answeredAt: serverTimestamp(), anchors: {}, ...over,
    });
    await assertSucceeds(setDoc(ref(CQ), cat()));
    // Frozen even under D86's edit arm: the arm demands the OLD doc carry
    // an integer optionIdx, and a catalog answer never does — the canon
    // fold has no delta path yet, so an edit here would desync the board.
    await assertFails(updateDoc(ref(CQ), { entity: 6 }));
    await assertFails(updateDoc(ref(CQ), { entity: 6, editedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref(CQ), { optionIdx: 0, editedAt: serverTimestamp() }));
    await assertFails(deleteDoc(ref(CQ)));
    await assertFails(setDoc(ref(CQ), cat({ entity: 6 })));
    // …readable by strangers like every other answer (D98), and writable
    // by none of them
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_users", OWNER, "answers", CQ)));
    await assertFails(setDoc(
      doc(asUser(STRANGER), "v2_users", OWNER, "answers", CQ), cat()));
  });

  it("catalog answers: rejects bad keys, mixed shapes, and non-catalog questions", async () => {
    const CQ = "feed-cat1";
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", CQ), {
        surface: "feed", seq: 0, type: "catalog",
        prompt: "Favourite?", options: [], active: true,
      });
      await setDoc(doc(db, "v2_questions", "feed-cat-off"), {
        surface: "feed", seq: 1, type: "catalog",
        prompt: "?", options: [], active: false,
      });
    });
    const ref = (id: string) => doc(asUser(OWNER), "v2_users", OWNER, "answers", id);
    const cat = (over: Record<string, unknown> = {}) => ({
      qid: CQ, surface: "feed", entity: 25,
      answeredAt: serverTimestamp(), anchors: {}, ...over,
    });
    // 0 is "Not listed" — a real answer
    await assertSucceeds(setDoc(ref(CQ), cat({ entity: 0 })));
    await seed(async (db) => {
      await deleteDoc(doc(db, "v2_users", OWNER, "answers", CQ));
    });
    await assertFails(setDoc(ref(CQ), cat({ entity: -1 })));          // negative
    await assertFails(setDoc(ref(CQ), cat({ entity: 1000000000 })));  // past the QID-scale sanity bound
    // a QID-scale key passes RULES (the per-domain key set lives in the
    // trigger, where an unknown key never aggregates — D15)
    await assertSucceeds(setDoc(ref(CQ), cat({ entity: 104123 })));
    await seed(async (db) => {
      await deleteDoc(doc(db, "v2_users", OWNER, "answers", CQ));
    });
    await assertFails(setDoc(ref(CQ), cat({ entity: 2.5 })));         // not an int
    await assertFails(setDoc(ref(CQ), cat({ entity: "25" })));        // a string is never a key
    await assertFails(setDoc(ref(CQ), cat({ optionIdx: 1 })));        // mixed shape
    await assertFails(setDoc(ref(CQ), { qid: CQ, surface: "feed", optionIdx: 0,
      answeredAt: serverTimestamp(), anchors: {} }));                 // optionIdx on a catalog question
    await assertFails(setDoc(ref(CQ), cat({ surface: "group" })));    // not a world surface
    // Feed-only since D234's review pass: the clause read `in ["daily",
    // "feed", "test"]` from birth, and "test" here passed BOTH halves of
    // it against this feed question. Now the claimed surface must be
    // exactly the one catalog questions exist on.
    await assertFails(setDoc(ref(CQ), cat({ surface: "test" })));
    await assertFails(setDoc(ref(CQ), cat({ surface: "daily" })));
    await assertFails(setDoc(ref("feed-cat-off"),
      cat({ qid: "feed-cat-off" })));                                 // kill switch holds
    // The question-side agreement tightened with it: a catalog doc
    // hand-edited onto another surface (console — the seed cannot write
    // one, check:content refuses it) takes no answers at all, whichever
    // surface the answer claims.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "test-cat"), {
        surface: "test", seq: 0, type: "catalog",
        prompt: "?", options: [], active: true,
      });
    });
    await assertFails(setDoc(ref("test-cat"), cat({ qid: "test-cat", surface: "test" })));
    await assertFails(setDoc(ref("test-cat"), cat({ qid: "test-cat" })));
    // a vote question never accepts an entity answer
    await seedQuestion();
    await assertFails(setDoc(ref(QID), { qid: QID, surface: "daily", entity: 1,
      answeredAt: serverTimestamp(), anchors: {} }));
  });

  it("answers are readable by anyone and writable only by their owner", async () => {
    await seedQuestion();
    await assertSucceeds(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", QID), answer()));
    // D98: read is open — by id and by listing the subcollection.
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_users", OWNER, "answers", QID)));
    await assertSucceeds(getDocs(query(
      collection(asUser(STRANGER), "v2_users", OWNER, "answers"),
      where("surface", "in", ["daily", "feed", "test", "learn"]))));
    // …and write is not. Authoring under someone else's uid is the thing
    // this rule is actually for now.
    await assertFails(setDoc(
      doc(asUser(STRANGER), "v2_users", OWNER, "answers", "feed-x"),
      answer({ qid: "feed-x" })));
  });

  // THE query the whole reversal exists to make possible: "everyone who
  // answered q42", across users. It is a COLLECTION GROUP read, which a
  // uid-bound rule does not authorize at all — the grant is a separate
  // `match /{path=**}/answers/{aid}` block, and without it D98 would look
  // from the app exactly like it had not happened.
  it("a collection-group query returns other people's answers to one question", async () => {
    await seedQuestion();
    await seed(async (db) => {
      for (const uid of [OWNER, FRIEND, STRANGER]) {
        await setDoc(doc(db, "v2_users", uid, "answers", QID), {
          qid: QID, surface: "daily", optionIdx: 1, anchors: { ageBand: "25-34" },
        });
      }
    });
    const snap = await assertSucceeds(getDocs(query(
      collectionGroup(asUser(STRANGER), "answers"),
      where("qid", "==", QID),
      where("surface", "in", ["daily", "feed", "test", "learn"]),
    )));
    // Three people's answers to one question, from one query, by a fourth
    // party. The uid is recoverable from the document path, which is what
    // turns this into named who-voted.
    expect((snap as { size: number }).size).toBe(3);
  });

  // D278 narrows the SAME query by the frozen city anchor, so the City
  // constellation stops paying for 200 rows from anywhere and keeping the
  // four that happen to live where the viewer does. That adds a `where`
  // to a read the rule grants as a value test on `surface` — which is
  // exactly the shape D65 says can be refused wholesale — so whether an
  // EXTRA equality still satisfies the grant is a rules question, and it
  // is pinned here rather than discovered in production.
  it("allows the city-scoped narrowing of that same query", async () => {
    await seedQuestion();
    await seed(async (db) => {
      await setDoc(doc(db, "v2_users", OWNER, "answers", QID), {
        qid: QID, surface: "daily", optionIdx: 1, anchors: { city: "Oslo, NO" },
      });
      await setDoc(doc(db, "v2_users", FRIEND, "answers", QID), {
        qid: QID, surface: "daily", optionIdx: 0, anchors: { city: "Bergen, NO" },
      });
    });
    const snap = await assertSucceeds(getDocs(query(
      collectionGroup(asUser(STRANGER), "answers"),
      where("qid", "==", QID),
      where("surface", "in", ["daily", "feed", "test", "learn", "pulse", "call"]),
      where("anchors.city", "==", "Oslo, NO"),
    )));
    // Narrowed, not widened: one of the two answers, and it is the one
    // whose ANSWER froze that city (D8) rather than whoever lives there
    // today.
    expect((snap as { size: number }).size).toBe(1);
  });

  // …and the narrowing must not become a way around the duel seal, which
  // is the one thing the surface clause exists to hold.
  it("cannot reach a sealed duel answer by adding the city filter", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_users", OWNER, "answers", "g_g2_2026-08-10"), {
        qid: "group-gu0", surface: "duo", optionIdx: 1,
        gid: "g2", day: "2026-08-10", anchors: { city: "Oslo, NO" },
      });
    });
    await assertFails(getDocs(query(
      collectionGroup(asUser(FRIEND), "answers"),
      where("anchors.city", "==", "Oslo, NO"),
    )));
  });

  // The rule's `surface` test is a VALUE test so a list query can be
  // compared against it. That has a consequence worth pinning rather than
  // rediscovering: a collection-group read that does NOT carry the
  // matching filter is refused wholesale, not filtered down (the D65
  // lesson, measured again here). A client that forgets the clause sees a
  // permission error, never a partial result.
  it("refuses a collection-group query that omits the surface filter", async () => {
    await seedQuestion();
    await seed(async (db) => {
      await setDoc(doc(db, "v2_users", OWNER, "answers", QID), {
        qid: QID, surface: "daily", optionIdx: 1,
      });
    });
    await assertFails(getDocs(query(
      collectionGroup(asUser(STRANGER), "answers"),
      where("qid", "==", QID),
    )));
  });

  // The duel seal, which is the ONE thing D98 kept out of the open read —
  // and kept for a reason that is not privacy: a face-down hand is the
  // game. Enforced on `surface`, so a sealed duel answer is unreadable to
  // a groupmate however they ask for it, while the owner still sees theirs.
  it("keeps duel answers sealed from other players, by surface", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_users", OWNER, "answers", "g_g1_2026-08-10"), {
        qid: "group-gu0", surface: "duo", optionIdx: 1, guessIdx: 0,
        gid: "g1", day: "2026-08-10",
      });
    });
    const sealed = ["v2_users", OWNER, "answers", "g_g1_2026-08-10"] as const;
    await assertSucceeds(getDoc(doc(asUser(OWNER), ...sealed)));
    await assertFails(getDoc(doc(asUser(FRIEND), ...sealed)));
    // and it cannot be reached by widening the collection-group filter
    await assertFails(getDocs(query(
      collectionGroup(asUser(FRIEND), "answers"),
      where("surface", "in", ["daily", "feed", "test", "learn", "duo"]),
    )));
  });
});

// The follow graph (D101). A follow is a BOOKMARK, not a permission
// grant — since D98 every answer and profile is already readable, so
// following someone conveys no access. What these cases pin is that the
// row itself cannot be forged, back-dated, or written on someone else's
// behalf, and that its `to` field can never disagree with its own id.
describe("v2 follow graph (D101 — Circle)", () => {
  const followRef = (as: string, owner: string, target: string) =>
    doc(asUser(as), "v2_users", owner, "following", target);

  it("owner follows and unfollows; a stranger cannot follow on their behalf", async () => {
    await assertSucceeds(setDoc(followRef(OWNER, OWNER, STRANGER), {
      at: serverTimestamp(), to: STRANGER,
    }));
    await assertSucceeds(deleteDoc(followRef(OWNER, OWNER, STRANGER)));
    // Writing into someone else's following list would let anyone stuff a
    // stranger's Circle — and, with the read open, publish a social graph
    // that account never chose.
    await assertFails(setDoc(followRef(STRANGER, OWNER, "third"), {
      at: serverTimestamp(), to: "third",
    }));
    await assertFails(deleteDoc(followRef(STRANGER, OWNER, "third")));
  });

  it("is world-readable — the followers direction depends on it", async () => {
    await assertSucceeds(setDoc(followRef(OWNER, OWNER, STRANGER), {
      at: serverTimestamp(), to: STRANGER,
    }));
    // Deliberate and reversible in one line (see firestore.rules). The
    // client's mutual flag is a collection-group query on `to`, which is
    // only satisfiable because this read is open.
    await assertSucceeds(getDoc(followRef(STRANGER, OWNER, STRANGER)));
  });

  it("answers the followers direction AS A COLLECTION-GROUP QUERY", async () => {
    // The case above pins the PATH read and says the mutual flag "depends
    // on it". It does not: a collection-group query is bound only by a
    // recursive-wildcard match, exactly as this file's own
    // `insight_inbound_impressions` case spells out ("they fail because no
    // match block binds a collection-group scope"). So the path grant was
    // open, the COLLECTION_GROUP index for `following.to` was deployed,
    // circle.ts issued the query — and the rules refused it, every time,
    // for every user. loadCircle catches the refusal and hands back an
    // empty set, so every Circle member rendered as not-mutual forever.
    //
    // This is the query circle.ts actually sends, filter included: the
    // `to` clause is what makes the grant provable, so a query without it
    // must still be refused.
    await assertSucceeds(setDoc(followRef(STRANGER, STRANGER, OWNER), {
      at: serverTimestamp(), to: OWNER,
    }));
    await assertSucceeds(getDocs(query(
      collectionGroup(asUser(OWNER), "following"),
      where("to", "==", OWNER),
    )));
    // Not a licence to enumerate the whole follow graph.
    await assertFails(getDocs(collectionGroup(asUser(OWNER), "following")));
    await assertFails(getDocs(query(
      collectionGroup(asUser(OWNER), "following"),
      where("to", "==", STRANGER),
    )));
  });

  it("refuses a `to` that disagrees with the document id", async () => {
    // The field exists so deleteAccount can find inbound follows with a
    // collection-group query (a query cannot filter on a document id). An
    // unpinned copy would be a second source of truth about who the row
    // points at — and the erasure sweep reads the field, not the id, so a
    // mismatched row would survive its own target's deletion.
    await assertFails(setDoc(followRef(OWNER, OWNER, STRANGER), {
      at: serverTimestamp(), to: "someone-else",
    }));
    await assertFails(setDoc(followRef(OWNER, OWNER, STRANGER), { at: serverTimestamp() }));
  });

  it("refuses following yourself, a back-dated stamp, and extra fields", async () => {
    // Self-follow would put you in your own Circle and count you twice in
    // every fold over it.
    await assertFails(setDoc(followRef(OWNER, OWNER, OWNER), {
      at: serverTimestamp(), to: OWNER,
    }));
    // A client-chosen timestamp is a reorderable one.
    await assertFails(setDoc(followRef(OWNER, OWNER, STRANGER), {
      at: new Date("2020-01-01"), to: STRANGER,
    }));
    await assertFails(setDoc(followRef(OWNER, OWNER, STRANGER), {
      at: serverTimestamp(), to: STRANGER, note: "x",
    }));
  });

  it("cannot be updated in place — only created and deleted", async () => {
    await assertSucceeds(setDoc(followRef(OWNER, OWNER, STRANGER), {
      at: serverTimestamp(), to: STRANGER,
    }));
    // Rewriting `at` would reorder a Circle, which is the one thing the
    // stamp decides (fetchFollowing sorts oldest-first so the cap is
    // stable across sessions).
    await assertFails(updateDoc(followRef(OWNER, OWNER, STRANGER), { at: serverTimestamp() }));
  });
});

// Foresight verdicts (D126). One scored read of a population slice, and
// the only thing that makes the record mean anything is that a verdict
// cannot be rewritten after the answer is on screen.
describe("v2 foresight verdicts (D126)", () => {
  const fRef = (as: string, owner: string, id = "q1__ageBand__25-34") =>
    doc(asUser(as), "v2_users", owner, "foresight", id);
  const verdict = (over: Record<string, unknown> = {}) => ({
    qid: "q1", dim: "ageBand", bucket: "25-34",
    guess: 0, answerIdx: 0, n: 20, at: serverTimestamp(), ...over,
  });

  it("owner writes one verdict; a stranger cannot write it for them", async () => {
    await assertSucceeds(setDoc(fRef(OWNER, OWNER), verdict()));
    await assertFails(setDoc(fRef(STRANGER, OWNER, "q2__ageBand__25-34"), verdict({ qid: "q2" })));
  });

  it("cannot be rewritten or deleted — a wrong read stays wrong", async () => {
    // The whole integrity model. Without this, every miss becomes a hit
    // the moment the answer is revealed, and the record means nothing.
    // Delete is closed for the same reason: the doc id is the slice, so
    // delete-and-replay would be a re-roll.
    await assertSucceeds(setDoc(fRef(OWNER, OWNER), verdict({ guess: 1 })));
    await assertFails(updateDoc(fRef(OWNER, OWNER), { guess: 0 }));
    await assertFails(setDoc(fRef(OWNER, OWNER), verdict({ guess: 0 })));
    await assertFails(deleteDoc(fRef(OWNER, OWNER)));
  });

  // Create-only stops a verdict being REWRITTEN. It never stopped the same
  // slice being read again at a DIFFERENT id — and until the id was bound
  // to its payload, "one attempt per slice" was a description of what the
  // client happened to do rather than a rule. The test that named the
  // invariant only ever re-used one id, so it passed while the invariant
  // did not exist: the shape where a test would still pass if the rule it
  // claims to pin were deleted.
  it("the id IS the slice: the same read cannot be re-rolled at another id", async () => {
    await assertSucceeds(setDoc(fRef(OWNER, OWNER), verdict({ guess: 1 })));
    // A second verdict for the SAME slice, minted at an id of the client's
    // choosing. Each of these used to succeed, so a player could guess
    // until they were right and keep the one that was.
    await assertFails(setDoc(
      fRef(OWNER, OWNER, "re-roll-2"), verdict({ guess: 0 })));
    await assertFails(setDoc(
      fRef(OWNER, OWNER, "q1__ageBand__25-34__again"), verdict({ guess: 0 })));
    await assertFails(setDoc(
      fRef(OWNER, OWNER, "total_nonsense"), verdict({ guess: 0 })));
    // An id that names a DIFFERENT slice than the payload is refused too —
    // the same hole wearing a plausible id.
    await assertFails(setDoc(
      fRef(OWNER, OWNER, "q1__ageBand__35-44"), verdict({ guess: 0 })));
    // A genuinely different slice, at its own id, still lands. The bound
    // is on the pairing, not on how many slices you may read.
    await assertSucceeds(setDoc(
      fRef(OWNER, OWNER, "q1__ageBand__35-44"),
      verdict({ bucket: "35-44", guess: 0 })));
  });

  it("is world-readable — the basis is published beside the claim", async () => {
    await assertSucceeds(setDoc(fRef(OWNER, OWNER), verdict()));
    await assertSucceeds(getDoc(fRef(STRANGER, OWNER)));
  });

  it("refuses a stored `correct`, a back-dated stamp, and a bad guess", async () => {
    // `correct` is DERIVED from guess + answerIdx by whoever reads it.
    // Storing it would be an unfalsifiable claim about a computable fact.
    await assertFails(setDoc(fRef(OWNER, OWNER), verdict({ correct: true })));
    await assertFails(setDoc(fRef(OWNER, OWNER), verdict({ at: new Date("2020-01-01") })));
    // -1 is the clock expiry and scores as a miss; anything below it is
    // a client inventing a sentinel of its own.
    await assertFails(setDoc(fRef(OWNER, OWNER), verdict({ guess: -2 })));
    await assertFails(setDoc(fRef(OWNER, OWNER), verdict({ answerIdx: -1 })));
    await assertFails(setDoc(fRef(OWNER, OWNER), verdict({ n: "many" })));
  });
});

// The v2 half of the pin at the top of this file. That one seeds three v1
// subcollections and refuses a cross-user collection-group read "so a
// future broad wildcard cannot silently turn a deployed index into
// cross-user enumeration". v2 pins only the three groups that DO carry a
// wildcard — answers, following, invites, each with its own block above —
// and the private ones had no case at all, which is precisely backwards:
// a wildcard already written is a decision somebody made, and the danger
// is the one that gets added by hand to make a query work.
//
// `engagement` is the case this exists for. It already ships a deployed
// COLLECTION_GROUP index (the `folded` override plus `(folded, day)`, for
// the nightly server fold), so the index side of cross-user enumeration
// is DONE and the rules are the only thing standing between a stranger
// and every user's per-day rollups. Adding `match /{path=**}/engagement/
// {d}` to make some future admin query work would open it with nothing in
// this suite turning red.
//
// These fail today for the reason the v1 pin gives — no match block binds
// a collection-group scope, so the grants under /v2_users/{uid}/… never
// apply — not because of an explicit CG deny. That is what makes the pin
// worth writing down rather than assuming.
describe("v2 private subcollections stay un-enumerable across users", () => {
  it("no collection-group read reaches another user's taste, engagement, patterns, push or foresight", async () => {
    await seed(async (db) => {
      for (const uid of [OWNER, FRIEND]) {
        // The interest profile the paged bank reads (D316–D322).
        await setDoc(doc(db, "v2_users", uid, "taste", "profile"), {
          w: { food: 0.4 }, n: 12, at: new Date(),
        });
        // Per-person day rollups — the ones with the index already live.
        await setDoc(doc(db, "v2_users", uid, "engagement", "2026-08-26"), {
          day: "2026-08-26", answers: 3, folded: false,
        });
        // The latent vector the patterns fit solves against.
        await setDoc(doc(db, "v2_users", uid, "patterns", "me"), {
          v: [0.1, -0.3], n: 20, at: new Date(),
        });
        // FCM tokens.
        await setDoc(doc(db, "v2_users", uid, "push", "tok1"), {
          token: "fake-token", at: new Date(),
        });
        await setDoc(doc(db, "v2_users", uid, "foresight", "q1__ageBand__25-34"), {
          qid: "q1", dim: "ageBand", bucket: "25-34",
          guess: 0, answerIdx: 0, n: 20, at: new Date(),
        });
      }
    });
    const db = asUser(STRANGER);
    for (const group of ["taste", "engagement", "patterns", "push", "foresight"]) {
      await assertFails(getDocs(collectionGroup(db, group)));
    }
    // …and the owner cannot run one either. A collection-group query is
    // not scoped to a subtree, so "mine" is not a thing it can ask for:
    // if this ever succeeded it would be returning everyone's.
    for (const group of ["taste", "engagement", "patterns", "push", "foresight"]) {
      await assertFails(getDocs(collectionGroup(asUser(OWNER), group)));
    }
    // The single-document read that DOES belong to its owner still works,
    // so this pins the enumeration and not the feature. `taste` is the
    // one: the owner's device sizes its own topic pages by it (D321).
    await assertSucceeds(getDoc(doc(asUser(OWNER), "v2_users", OWNER, "taste", "profile")));
    // `patterns` is closed to EVERYONE, its owner included — the latent
    // vector is a summary nobody signed up to be read as, and the fold
    // that writes it uses the admin SDK. Asserted rather than assumed,
    // because "the owner can read their own" is the shape four of the
    // five above have and this one deliberately does not.
  });
});

describe("v2 groups + sealed duels (Phase 3)", () => {
  const GID = "g1";
  const DAY = dayOffset(-1);
  const seedGroup = (members: string[] = [OWNER, FRIEND]) => seed(async (db) => {
    await setDoc(doc(db, "v2_groups", GID), {
      name: "The Crew", mode: "duo", ownerUid: OWNER,
      memberUids: members, inviteCode: "ABCD2345", streak: 0,
    });
    // "duo", matching both the group's own mode above and the surface the
    // answers below claim. duelQFor (data/deck.ts) draws the day's question
    // with `q.surface === mode`, so a duo group answering a group-surface
    // question is a shape the client cannot produce — and the create rule
    // compares the two, so seeding them crossed would test nothing real.
    await setDoc(doc(db, "v2_questions", "group-gu0"), {
      surface: "duo", seq: 0, type: "choice", prompt: "?",
      options: ["Food", "Banter", "Showing up", "History"], active: true,
    });
  });
  const duelAnswer = (over: Record<string, unknown> = {}) => ({
    qid: "group-gu0", surface: "duo", optionIdx: 1, guessIdx: 2,
    gid: GID, day: DAY, answeredAt: serverTimestamp(), anchors: {}, ...over,
  });
  const aid = `g_${GID}_${DAY}`;

  it("groups are read-only to clients — even members and would-be creators", async () => {
    await seedGroup();
    await assertSucceeds(getDoc(doc(asUser(FRIEND), "v2_groups", GID)));
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_groups", GID)));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_groups", "g2"), {
      name: "Forged", ownerUid: OWNER, memberUids: [OWNER], inviteCode: "ZZZZ9999",
    }));
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_groups", GID),
      { memberUids: [OWNER, FRIEND, STRANGER] }));
    await assertFails(deleteDoc(doc(asUser(OWNER), "v2_groups", GID)));
  });

  it("duoMode is the ONE member-writable field, on duo docs only (D40 part 4)", async () => {
    await seedGroup();
    // either partner flips the pair's pool, and back again
    await assertSucceeds(updateDoc(doc(asUser(FRIEND), "v2_groups", GID), { duoMode: "romantic" }));
    await assertSucceeds(updateDoc(doc(asUser(OWNER), "v2_groups", GID), { duoMode: "friends" }));
    // outsiders can't touch it
    await assertFails(updateDoc(doc(asUser(STRANGER), "v2_groups", GID), { duoMode: "romantic" }));
    // the field is alone or the write dies — no riding another change in
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_groups", GID),
      { duoMode: "romantic", streak: 99 }));
    // closed enum — an unknown pool name is refused, not stored
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_groups", GID), { duoMode: "sneaky" }));
    // and a GROUP doc has no member-writable surface at all
    await seed(async (db) => {
      await setDoc(doc(db, "v2_groups", "g_grp"), {
        name: "Circle", mode: "group", ownerUid: OWNER,
        memberUids: [OWNER, FRIEND], inviteCode: "EFGH6789", streak: 0,
      });
    });
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_groups", "g_grp"), { duoMode: "romantic" }));
  });

  // ── join requests are server-only, both ways (D240) ──────────────
  //
  // `pending` and `pendingNames` live on this document because members
  // already read it — a subcollection would need a member-gated read
  // rule, and rules can only express that with `get()` on the group,
  // which is one billed read per request listed (the tripwire D122 hit).
  //
  // Living here means the duoMode rule above is the ONLY member-writable
  // surface standing between a client and the membership queue. If that
  // ever widens, a member could approve themselves — or anyone — without
  // going through approveJoinV2, which is where the cap and the
  // "did they actually ask" check live.
  it("nobody writes the join queue from a client (D240)", async () => {
    await seedGroup();
    // A member cannot add somebody to the queue…
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_groups", GID),
      { pending: [STRANGER] }));
    // …nor put a name beside one…
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_groups", GID),
      { pendingNames: { [STRANGER]: "Sneaky" } }));
    // …nor clear one, which would be declining without the callable…
    await assertFails(updateDoc(doc(asUser(FRIEND), "v2_groups", GID),
      { pending: [] }));
    // …and the queue is not a way to ride a legal write in.
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_groups", GID),
      { duoMode: "romantic", pending: [STRANGER] }));
    // THE ONE THAT MATTERS: the queue is one hop from `memberUids`, so a
    // client that could write either could let itself into any circle it
    // can name the id of.
    await assertFails(updateDoc(doc(asUser(STRANGER), "v2_groups", GID),
      { memberUids: [OWNER, FRIEND, STRANGER] }));
  });

  it("members write sealed duel answers under the composite id; outsiders can't", async () => {
    await seedGroup();
    await assertSucceeds(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", aid), duelAnswer()));
    // non-member (not in memberUids) is refused even in their own subtree
    await assertFails(setDoc(
      doc(asUser(STRANGER), "v2_users", STRANGER, "answers", aid), duelAnswer()));
    // id must match g_{gid}_{day}
    await assertFails(setDoc(
      doc(asUser(FRIEND), "v2_users", FRIEND, "answers", "g_other_2026-07-26"),
      duelAnswer()));
    // sealed answers stay owner-only before the reveal
    await assertFails(getDoc(
      doc(asUser(FRIEND), "v2_users", OWNER, "answers", aid)));
  });

  // The duel shape used to check only that the question EXISTED — the one
  // answer shape with neither the kill switch nor surface agreement, while
  // every sibling carries both. Duel votes are not inert: revealQid derives
  // the day's question from the members' own answer docs and foldDuelSignal
  // publishes it into the world-readable duel-{qid} aggregate.
  it("a duel answer honours the kill switch and must name duel material", async () => {
    await seedGroup();
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "duo-retired"), {
        surface: "duo", seq: 1, type: "choice", prompt: "?",
        options: ["a", "b"], active: false,
      });
      // A catalog question is the sharp case: its options list is empty, so
      // duelIndexSpace() falls through to the group's member count and the
      // vote would be folded as if it were a "pick".
      await setDoc(doc(db, "v2_questions", "feed-cat0"), {
        surface: "feed", seq: 2, type: "catalog", prompt: "?",
        options: [], active: true,
      });
      await setDoc(doc(db, "v2_questions", "daily-000"), {
        surface: "daily", seq: 3, type: "binary", prompt: "?",
        options: ["a", "b"], active: true,
      });
    });
    // Retired: pulled for being broken or harmful, and still duel material.
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", aid),
      duelAnswer({ qid: "duo-retired", optionIdx: 0, guessIdx: 0 })));
    // Live, but not this surface.
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", aid),
      duelAnswer({ qid: "feed-cat0", optionIdx: 0, guessIdx: 0 })));
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", aid),
      duelAnswer({ qid: "daily-000", optionIdx: 0, guessIdx: 0 })));
    // The ordinary day still lands — the refusals above are the narrowing,
    // not a seal on the surface.
    await assertSucceeds(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", aid), duelAnswer()));
  });

  it("the duel day must be near now — no pre-sealing the future, no deep backfill", async () => {
    // Without this, a member could seal every future day in advance:
    // their half of the streak guaranteed forever, and the bank question
    // each future reveal would use fixed by whoever wrote first.
    await seedGroup();
    const at = (n: number) => {
      const day = dayOffset(n);
      return setDoc(
        doc(asUser(OWNER), "v2_users", OWNER, "answers", `g_${GID}_${day}`),
        duelAnswer({ day }),
      );
    };
    await assertSucceeds(at(0));    // today
    await assertSucceeds(at(-1));   // yesterday — the normal reveal target
    await assertSucceeds(at(-3));   // a client flushing an offline queue
    await assertSucceeds(at(1));    // UTC+14 is already "tomorrow"
    await assertFails(at(-8));      // deep backfill
    await assertFails(at(8));       // pre-sealing the future
    await assertFails(at(400));
  });

  it("answering a day that is already revealed is refused", async () => {
    await seedGroup();
    await seed(async (db) => {
      await setDoc(doc(db, "v2_groups", GID, "reveals", DAY), {
        day: DAY, qid: "group-gu0", votes: {}, names: {},
      });
    });
    await assertFails(setDoc(
      doc(asUser(FRIEND), "v2_users", FRIEND, "answers", aid), duelAnswer()));
  });

  it("reveals are world-readable, never client-writable", async () => {
    await seedGroup();
    await seed(async (db) => {
      await setDoc(doc(db, "v2_groups", GID, "reveals", DAY), {
        day: DAY, qid: "group-gu0",
        votes: { [OWNER]: { optionIdx: 1 }, [FRIEND]: { optionIdx: 2 } },
        names: {}, members: [OWNER, FRIEND],
      });
    });
    await assertSucceeds(getDoc(doc(asUser(FRIEND), "v2_groups", GID, "reveals", DAY)));
    // D98: a stranger reads it too. The votes inside a reveal are world
    // answers' younger siblings — withholding the materialized copy while
    // publishing the source would be a lock on a door with no wall.
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_groups", GID, "reveals", DAY)));
    // Writing stays server-only, which is what keeps the reveal a reveal.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_groups", GID, "reveals", "2026-07-27"),
      { votes: {} }));
  });

  // The `members` snapshot used to be an ACCESS gate: joining a group
  // tomorrow handed you no past day's votes, and leaving did not retract
  // the days you played. D98 retired the access half — that was a privacy
  // guarantee about answers — but the field itself stays, because
  // deleteAccount scrubs a departing uid out of it and the erasure e2e
  // asserts exactly that. This pins the split: the array is still written
  // and still meaningful, and it no longer decides who may read.
  it("the members snapshot no longer gates the read, and is still recorded", async () => {
    await seedGroup([OWNER, STRANGER]); // FRIEND has left; STRANGER has joined
    await seed(async (db) => {
      await setDoc(doc(db, "v2_groups", GID, "reveals", DAY), {
        day: DAY, qid: "group-gu0",
        votes: { [OWNER]: { optionIdx: 1 }, [FRIEND]: { optionIdx: 2 } },
        names: {}, members: [OWNER, FRIEND],
      });
    });
    // A late joiner reads a day they were not part of — previously the
    // headline refusal of this block.
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_groups", GID, "reveals", DAY)));
    // Someone who left still reads the day they played.
    await assertSucceeds(getDoc(doc(asUser(FRIEND), "v2_groups", GID, "reveals", DAY)));
    const snap = await assertSucceeds(
      getDoc(doc(asUser(OWNER), "v2_groups", GID, "reveals", DAY)));
    expect((snap as { data: () => Record<string, unknown> }).data().members)
      .toEqual([OWNER, FRIEND]);
  });

  // The old rule read `get("members", [])`, so a legacy reveal written
  // before that payload shipped denied everyone. Nothing consults the
  // field now, so such a reveal reads like any other — asserted rather
  // than assumed, because "it errored open" and "the gate is gone" look
  // identical from the outside and only one of them is intended.
  it("a reveal with no members snapshot is readable like any other", async () => {
    await seedGroup();
    await seed(async (db) => {
      await setDoc(doc(db, "v2_groups", GID, "reveals", DAY), {
        day: DAY, qid: "group-gu0", votes: { [OWNER]: { optionIdx: 1 } }, names: {},
      });
    });
    await assertSucceeds(getDoc(doc(asUser(OWNER), "v2_groups", GID, "reveals", DAY)));
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_groups", GID, "reveals", DAY)));
  });
});

describe("v2 meta + server-only collections", () => {
  it("v2_meta is signed-in read-only; v2_ratelimits is fully opaque", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_meta", "content"), { contentRev: 3 });
      await setDoc(doc(db, "v2_ratelimits", OWNER), { events: [] });
    });
    await assertSucceeds(getDoc(doc(asUser(OWNER), "v2_meta", "content")));
    await assertFails(getDoc(doc(asSignedOut(), "v2_meta", "content")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_meta", "content"), { contentRev: 99 }));
    await assertFails(getDoc(doc(asUser(OWNER), "v2_ratelimits", OWNER)));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_ratelimits", OWNER), { events: [] }));
  });
});

describe("question suggestions (docs/NEXT-FUNCTIONALITY.md §6)", () => {
  const SID = `${OWNER}_sg1`;
  const seedSuggestion = () => seed(async (db) => {
    await setDoc(doc(db, "v2_suggestions", SID), {
      uid: OWNER, prompt: "Dogs or cats?", type: "binary",
      options: ["Dogs", "Cats"], topicHint: null, audienceHint: null,
      cadenceHint: null, credit: false, status: "review", at: serverTimestamp(),
    });
  });

  it("the author reads their own row; a stranger and the signed-out do not", async () => {
    await seedSuggestion();
    await assertSucceeds(getDoc(doc(asUser(OWNER), "v2_suggestions", SID)));
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_suggestions", SID)));
    await assertFails(getDoc(doc(asSignedOut(), "v2_suggestions", SID)));
  });

  it("the pool is not listable — only a mine-only query passes (the D65 shape)", async () => {
    await seedSuggestion();
    await assertSucceeds(getDocs(query(
      collection(asUser(OWNER), "v2_suggestions"),
      where("uid", "==", OWNER),
    )));
    // No filter, or a filter naming someone else: refused wholesale.
    await assertFails(getDocs(collection(asUser(OWNER), "v2_suggestions")));
    await assertFails(getDocs(query(
      collection(asUser(STRANGER), "v2_suggestions"),
      where("uid", "==", OWNER),
    )));
  });

  it("no client writes: the callable is the only door, and the author cannot settle their own status", async () => {
    await seedSuggestion();
    // A direct create would skip the budget, the App Check attestation
    // and the sold-inventory tripwire — the three checks that are the
    // reason this is a callable at all.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_suggestions", `${OWNER}_sg2`), {
      uid: OWNER, prompt: "Should Oslo ban cars downtown?", type: "binary",
      options: [], topicHint: null, audienceHint: null, cadenceHint: null,
      credit: false, status: "review", at: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_suggestions", SID), { status: "picked" }));
    await assertFails(deleteDoc(doc(asUser(OWNER), "v2_suggestions", SID)));
  });
});

describe("paid purchase records (docs/PAID-PLAN.md §7, D288 §3)", () => {
  const PID = `${OWNER}_pd1`;
  const seedPurchase = () => seed(async (db) => {
    await setDoc(doc(db, "v2_purchases", PID), {
      uid: OWNER, kind: "question", qid: "pd01", scope: "city",
      place: "Oslo", dims: ["city:Oslo"], window: { start: "2026-08-24", until: "2026-09-21" },
      cadence: "once", budget: { cap: 4000, capEur: 640, ratePerAnswer: 0.16 },
      state: "running", reports: [{ label: "Final report", ready: false, note: "at close" }],
      at: serverTimestamp(),
    });
  });

  it("the buyer reads their own row; a stranger and the signed-out do not", async () => {
    await seedPurchase();
    await assertSucceeds(getDoc(doc(asUser(OWNER), "v2_purchases", PID)));
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_purchases", PID)));
    await assertFails(getDoc(doc(asSignedOut(), "v2_purchases", PID)));
  });

  it("the ledger is not listable — only a mine-only query passes (the D65 shape)", async () => {
    await seedPurchase();
    await assertSucceeds(getDocs(query(
      collection(asUser(OWNER), "v2_purchases"),
      where("uid", "==", OWNER),
    )));
    // No filter, or a filter naming someone else: refused wholesale. The
    // public half of demand is the committed pricing.json, never a read
    // of other buyers' rows.
    await assertFails(getDocs(collection(asUser(OWNER), "v2_purchases")));
    await assertFails(getDocs(query(
      collection(asUser(STRANGER), "v2_purchases"),
      where("uid", "==", OWNER),
    )));
  });

  it("no client writes at all — the pens are server-side (webhook + operator script)", async () => {
    await seedPurchase();
    // Not even the buyer: a contract record the buyer could edit would
    // let a cap, a window or a locked rate drift from what was signed.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_purchases", `${OWNER}_pd2`), {
      uid: OWNER, kind: "question", qid: "pd02", scope: "world",
      state: "running", at: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_purchases", PID), { state: "closed" }));
    await assertFails(deleteDoc(doc(asUser(OWNER), "v2_purchases", PID)));
  });
});

describe("paid-question bookings (paid.ts, D313)", () => {
  const BID = `${OWNER}_bk1`;
  const seedBooking = () => seed(async (db) => {
    await setDoc(doc(db, "v2_paid_bookings", BID), {
      uid: OWNER, prompt: "Should the night buses run all night?",
      type: "binary", options: ["All night", "The hours are fine"],
      topic: "culture", scope: "city", dims: { city: "Oslo, NO" },
      wearName: true, buyerName: "Olaf", status: "approved",
      quote: { ratePerAnswer: 0.144, capEur: 320, cap: 2222, windowDays: 29 },
      reviewAttempts: 0, createdAt: serverTimestamp(),
    });
  });

  it("the buyer reads their own booking; a stranger and the signed-out do not", async () => {
    await seedBooking();
    await assertSucceeds(getDoc(doc(asUser(OWNER), "v2_paid_bookings", BID)));
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_paid_bookings", BID)));
    await assertFails(getDoc(doc(asSignedOut(), "v2_paid_bookings", BID)));
  });

  it("not listable — only a mine-only query passes (the D65 shape)", async () => {
    await seedBooking();
    await assertSucceeds(getDocs(query(
      collection(asUser(OWNER), "v2_paid_bookings"),
      where("uid", "==", OWNER),
    )));
    await assertFails(getDocs(collection(asUser(OWNER), "v2_paid_bookings")));
    await assertFails(getDocs(query(
      collection(asUser(STRANGER), "v2_paid_bookings"),
      where("uid", "==", OWNER),
    )));
  });

  it("no client writes — booking, verdict and payment stamps are server pens only", async () => {
    await seedBooking();
    // Not even the buyer, and especially not the status: a client that
    // could write "approved" or "live" would skip the review and the
    // payment both. The callable + trigger + webhook are the only pens.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_paid_bookings", `${OWNER}_bk2`), {
      uid: OWNER, prompt: "Ferry or bridge?", type: "binary",
      options: ["Ferry", "Bridge"], scope: "world", dims: {},
      wearName: false, status: "approved", createdAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_paid_bookings", BID), { status: "live" }));
    await assertFails(deleteDoc(doc(asUser(OWNER), "v2_paid_bookings", BID)));
  });
});

describe("moderation substrate: takes + flags (docs/MODERATION.md, D22)", () => {
  const GID = "g_mod";
  const seedCircle = () => seed(async (db) => {
    await setDoc(doc(db, "v2_groups", GID), {
      name: "Mod", mode: "group", memberUids: [OWNER, FRIEND],
    });
  });
  const take = (over: Record<string, unknown> = {}) => ({
    gid: GID, authorUid: OWNER, text: "hot take",
    createdAt: serverTimestamp(), hidden: false, ...over,
  });
  const flag = (takeId: string, uid: string, over: Record<string, unknown> = {}) => ({
    takeId, gid: GID, uid, at: serverTimestamp(), ...over,
  });

  it("anyone reads a take; only a circle member writes one into that circle", async () => {
    await seedCircle();
    await assertSucceeds(setDoc(doc(asUser(OWNER), "v2_takes", "t1"), take()));
    await assertSucceeds(getDoc(doc(asUser(FRIEND), "v2_takes", "t1")));
    // D98 dropped the membership gate on the READ. It was an audience gate
    // on speech, and takes carry `authorUid`, so this is also what makes a
    // named comment possible at all.
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_takes", "t1")));
    // Posting INTO a circle still needs membership — that is a write.
    await assertFails(setDoc(doc(asUser(STRANGER), "v2_takes", "t2"),
      take({ authorUid: STRANGER })));
  });

  it("takes are shape-bound, immutable, and only the author's to delete", async () => {
    await seedCircle();
    const ref = doc(asUser(OWNER), "v2_takes", "t1");
    await assertFails(setDoc(ref, take({ text: "" })));                    // empty
    await assertFails(setDoc(ref, take({ text: "x".repeat(281) })));      // over the cap
    await assertFails(setDoc(ref, take({ authorUid: FRIEND })));          // authored as someone else
    await assertFails(setDoc(ref, take({ extra: 1 })));                   // unknown field
    await assertFails(setDoc(ref, take({ createdAt: new Date() })));      // not request.time
    await assertSucceeds(setDoc(ref, take()));
    // No edit path: an edited take invalidates the flags cast on what it
    // used to say (the rules comment carries the argument).
    await assertFails(updateDoc(ref, { text: "reworded" }));
    await assertFails(deleteDoc(doc(asUser(FRIEND), "v2_takes", "t1")));
    await assertSucceeds(deleteDoc(ref));
  });

  it("a mod-hidden take vanishes for the circle but not its author", async () => {
    await seedCircle();
    await seed(async (db) => {
      await setDoc(doc(db, "v2_takes", "t_hidden"), {
        gid: GID, authorUid: OWNER, text: "over the line",
        createdAt: new Date(), hidden: true,
        hiddenMeta: { by: "mod", policyLine: "H1" },
      });
    });
    await assertFails(getDoc(doc(asUser(FRIEND), "v2_takes", "t_hidden")));
    // The author still reads it — the soft-hide keeps the appeal honest.
    await assertSucceeds(getDoc(doc(asUser(OWNER), "v2_takes", "t_hidden")));
  });

  // The case whose absence WAS the bug (D65). Every take assertion above
  // this line uses getDoc, and getDoc was never the leak: a per-document
  // rule is applied per document. A LIST is a different operation, and the
  // old presence-test gate (`!("hidden" in resource.data)`) gave Firestore
  // nothing it could check the query's constraints against — so it returned
  // the hidden take, text and all, to a non-author member of the circle.
  //
  // Three assertions, because the fix has three parts and each can rot
  // independently: the unfiltered list must be REFUSED (fail-closed, so a
  // client that forgets the filter gets an error rather than other people's
  // hidden words), the filtered list must succeed WITHOUT the hidden take,
  // and a stranger must still get nothing either way.
  it("listing a circle's takes cannot return a hidden one — and is refused without the filter", async () => {
    await seedCircle();
    await seed(async (db) => {
      await setDoc(doc(db, "v2_takes", "t_visible"), {
        gid: GID, authorUid: OWNER, text: "fine", createdAt: new Date(), hidden: false,
      });
      await setDoc(doc(db, "v2_takes", "t_hidden"), {
        gid: GID, authorUid: OWNER, text: "over the line",
        createdAt: new Date(), hidden: true,
        hiddenMeta: { by: "mod", policyLine: "H1" },
      });
    });
    const takesOf = (uid: string) => collection(asUser(uid), "v2_takes");

    // Fail-closed: no `hidden` predicate, no list. This is the assertion
    // that keeps the client's filter honest — drop the where() in app code
    // and the query stops working rather than starting to leak.
    await assertFails(getDocs(query(takesOf(FRIEND), where("gid", "==", GID))));

    // …and with it, the circle sees the circle's takes minus the hidden one.
    const visible = await assertSucceeds(
      getDocs(query(takesOf(FRIEND), where("gid", "==", GID), where("hidden", "==", false))),
    );
    expect(visible.docs.map((d) => d.id)).toEqual(["t_visible"]);

    // The author's list is not a way around it either: the appeal path is
    // getDoc by id (asserted above), not a broader query.
    await assertFails(getDocs(query(takesOf(OWNER), where("gid", "==", GID))));

    // A stranger lists the circle's takes exactly like a member does
    // (D98), and is held to the same fail-closed `hidden` predicate — the
    // moderation guarantee is orthogonal to the audience one, which is
    // the distinction this pair of assertions exists to keep visible.
    await assertFails(getDocs(query(takesOf(STRANGER), where("gid", "==", GID))));
    const strangerSees = await assertSucceeds(getDocs(
      query(takesOf(STRANGER), where("gid", "==", GID), where("hidden", "==", false)),
    ));
    expect(strangerSees.docs.map((d) => d.id)).toEqual(["t_visible"]);
  });

  it("a client cannot post a take that is already hidden, or omit the flag", async () => {
    await seedCircle();
    // Omitted: the read gate is an equality, so a take without the field
    // could never be read back — better refused at the door.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_takes", "tnofield"), {
      gid: GID, authorUid: OWNER, text: "no flag", createdAt: serverTimestamp(),
    }));
    // Pre-hidden: would hide the author's own words from the circle while
    // leaving them in the moderation queue.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_takes", "tprehidden"),
      take({ hidden: true })));
    await assertSucceeds(setDoc(doc(asUser(OWNER), "v2_takes", "tok"), take()));
  });

  it("flags: one per (take, user), any signed-in user, write-only, never on hidden takes", async () => {
    await seedCircle();
    await seed(async (db) => {
      await setDoc(doc(db, "v2_takes", "t2"), {
        gid: GID, authorUid: OWNER, text: "contested", createdAt: new Date(),
        hidden: false,
      });
      await setDoc(doc(db, "v2_takes", "t_gone"), {
        gid: GID, authorUid: OWNER, text: "settled", createdAt: new Date(),
        hidden: true, hiddenMeta: { by: "mod", policyLine: "H5" },
      });
    });
    await assertSucceeds(setDoc(
      doc(asUser(FRIEND), "v2_flags", "t2_" + FRIEND), flag("t2", FRIEND)));
    // same doc again is an update — the one-flag-per-user pin
    await assertFails(setDoc(
      doc(asUser(FRIEND), "v2_flags", "t2_" + FRIEND), flag("t2", FRIEND)));
    // an id that doesn't match takeId_uid would let one account stuff counts
    await assertFails(setDoc(
      doc(asUser(FRIEND), "v2_flags", "t2_sock2"), flag("t2", FRIEND)));
    // D98: a stranger may flag. The membership gate rested on "a stranger
    // cannot flag speech they cannot read", and a stranger can now read
    // every take — so the premise went and the gate with it.
    await assertSucceeds(setDoc(
      doc(asUser(STRANGER), "v2_flags", "t2_" + STRANGER), flag("t2", STRANGER)));
    // …but not your OWN take, which is the same refusal the avatar arm
    // makes. `t2` is OWNER's. Reporting yourself achieves one thing —
    // spending a moderator's generation on something you can delete
    // yourself — and three of your own accounts on your own take is the
    // flag floor, so it was also a way to occupy the queue.
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_flags", "t2_" + OWNER), flag("t2", OWNER)));
    // Write-only, still, and this deny SURVIVES D98 on its own reasoning:
    // a reporter visible to the person they reported is a reporter who
    // stops reporting. Anti-retaliation, not answer privacy.
    await assertFails(getDoc(doc(asUser(FRIEND), "v2_flags", "t2_" + FRIEND)));
    // a hidden take is settled — no further flag-stacking
    await assertFails(setDoc(
      doc(asUser(FRIEND), "v2_flags", "t_gone_" + FRIEND), flag("t_gone", FRIEND)));
  });

  // ── the profile photo (D178) ───────────────────────────────────
  //
  // The bytes are Storage's (storage.rules.test.ts); this document is what
  // moderation acts on, and its rules carry three claims the feature rests
  // on: a face is world-readable, only its owner writes it, and a REMOVED
  // face is frozen — because otherwise the way back is one delete and one
  // re-upload from an account that costs nothing to make.
  describe("the profile photo's document (D178)", () => {
    const av = (over: Record<string, unknown> = {}) => ({
      token: "abc123DEF456-_xyz", at: serverTimestamp(), hidden: false, ...over,
    });

    it("the owner sets their own face and everyone signed in can read it", async () => {
      await assertSucceeds(setDoc(doc(asUser(OWNER), "v2_avatars", OWNER), av()));
      await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_avatars", OWNER)));
      // Replacing it is an ordinary update; removing it is the way out.
      await assertSucceeds(setDoc(doc(asUser(OWNER), "v2_avatars", OWNER), av({ token: "second00token" })));
      await assertSucceeds(deleteDoc(doc(asUser(OWNER), "v2_avatars", OWNER)));
    });

    it("nobody writes somebody else's face", async () => {
      await assertFails(setDoc(doc(asUser(STRANGER), "v2_avatars", OWNER), av()));
      await seed(async (db) => {
        await setDoc(doc(db, "v2_avatars", OWNER), { token: "t0000000", at: new Date(), hidden: false });
      });
      await assertFails(deleteDoc(doc(asUser(STRANGER), "v2_avatars", OWNER)));
    });

    // THE FIELD IS A TOKEN, NOT A URL, and this is the case that keeps it
    // one. A client-written URL could name a host we do not control: every
    // viewer's IP goes to it, and the picture can change after somebody
    // reported it. The charset admits no dot, colon or slash, so the field
    // cannot be a host or a path however it is written.
    it("refuses anything that could be a URL rather than a token", async () => {
      for (const token of [
        "https://evil.example/x.png",
        "../../../etc/passwd",
        "abc.def",
        "a b",
        "short",
        "x".repeat(65),
        123,
      ]) {
        await assertFails(setDoc(doc(asUser(OWNER), "v2_avatars", OWNER), av({ token })));
      }
    });

    it("lets no client claim `hidden`, in either direction", async () => {
      // `true` is the server's word: a client that could write it could
      // hide its own face to dodge a report mid-queue…
      await assertFails(setDoc(doc(asUser(OWNER), "v2_avatars", OWNER), av({ hidden: true })));
      // …and the field is required rather than optional, so the flag rule
      // and the queue build can both read a bare boolean (D65).
      await assertFails(setDoc(doc(asUser(OWNER), "v2_avatars", OWNER),
        { token: "abc123DEF456", at: serverTimestamp() }));
      await assertFails(setDoc(doc(asUser(OWNER), "v2_avatars", OWNER), av({ extra: 1 })));
    });

    // THE ONE THAT MATTERS MOST. A removed face has to stay removed, and
    // the two ways back are an overwrite and a delete-then-recreate. Both
    // are refused while `hidden` is true; the appeal is a human, which is
    // what `hiddenMeta` exists for.
    it("freezes a removed face against both ways back", async () => {
      await seed(async (db) => {
        await setDoc(doc(db, "v2_avatars", OWNER), {
          token: "removed0token", at: new Date(), hidden: true,
          hiddenMeta: { by: "mod", policyLine: "H2" },
        });
      });
      await assertFails(setDoc(doc(asUser(OWNER), "v2_avatars", OWNER), av()));
      await assertFails(deleteDoc(doc(asUser(OWNER), "v2_avatars", OWNER)));
    });

    it("is reportable by a stranger, once, and never by its owner", async () => {
      await seed(async (db) => {
        await setDoc(doc(db, "v2_avatars", OWNER), { token: "live0token00", at: new Date(), hidden: false });
        await setDoc(doc(db, "v2_avatars", FRIEND), {
          token: "gone0token00", at: new Date(), hidden: true,
          hiddenMeta: { by: "mod", policyLine: "H2" },
        });
      });
      const avFlag = (target: string, by: string) => ({
        takeId: "av_" + target, gid: "avatar", uid: by, target, at: serverTimestamp(),
      });
      await assertSucceeds(setDoc(
        doc(asUser(STRANGER), "v2_flags", `av_${OWNER}_${STRANGER}`), avFlag(OWNER, STRANGER)));
      // One per person, the same pin takes have — the id IS the uniqueness.
      await assertFails(setDoc(
        doc(asUser(STRANGER), "v2_flags", `av_${OWNER}_${STRANGER}`), avFlag(OWNER, STRANGER)));
      // Reporting your own face would only queue a moderator to look at it.
      await assertFails(setDoc(
        doc(asUser(OWNER), "v2_flags", `av_${OWNER}_${OWNER}`), avFlag(OWNER, OWNER)));
      // A face already removed is settled; no further flag-stacking.
      await assertFails(setDoc(
        doc(asUser(STRANGER), "v2_flags", `av_${FRIEND}_${STRANGER}`), avFlag(FRIEND, STRANGER)));
      // And the id still has to name its target: `target` is what the rule
      // reaches the avatar document with, so a mismatch is a flag pointed
      // at one face and counted against another.
      await assertFails(setDoc(
        doc(asUser(STRANGER), "v2_flags", `av_${OWNER}_${STRANGER}`),
        { ...avFlag(OWNER, STRANGER), target: FRIEND }));
    });
  });

  it("the queue and verdict log are dark to every client", async () => {
    await seedCircle();
    await assertFails(getDoc(doc(asUser(OWNER), "v2_mod_queue", "t1")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_mod_queue", "t1"), { takeId: "t1" }));
    await assertFails(getDoc(doc(asUser(OWNER), "v2_mod_verdicts", "t1")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_mod_verdicts", "t1"),
      { takeId: "t1", verdict: "keep" }));
  });
});

describe("world takes (D83 — anonymous, one per person per question)", () => {
  // The sentinel gid "world" has no group behind it and needs none: reads
  // are any-signed-in, and the create bound moves from membership to the
  // DOCUMENT ID — `qid + "_" + uid` — so a second take is an update, and
  // updates are denied. The sentinel cannot collide with a real circle
  // because v2_groups creates are `if false` (ids are server-minted).
  const QID = "daily-042";
  const wtake = (uid: string, over: Record<string, unknown> = {}) => ({
    gid: "world", authorUid: uid, qid: QID, text: "a world take",
    createdAt: serverTimestamp(), hidden: false, ...over,
  });
  const wid = (uid: string, qid = QID) => `${qid}_${uid}`;
  // Every world take now needs its question to exist and be active — the
  // thread hangs on a question, and a question that has been pulled has no
  // thread. Seeded per test rather than once, because the global
  // beforeEach clears Firestore between them.
  const seedQ = (qids: string[] = [QID]) => seed(async (db) => {
    for (const q of qids) {
      await setDoc(doc(db, "v2_questions", q), {
        surface: "daily", seq: 0, type: "binary",
        prompt: "Pineapple?", options: ["Yes", "No"], active: true,
      });
    }
  });

  it("any signed-in user posts under qid_uid and any other reads it", async () => {
    await seedQ();
    await assertSucceeds(setDoc(
      doc(asUser(OWNER), "v2_takes", wid(OWNER)), wtake(OWNER)));
    // A STRANGER — no shared circle anywhere — reads it. That is the
    // feature: the audience is everyone.
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_takes", wid(OWNER))));
    // And posts their own beside it.
    await assertSucceeds(setDoc(
      doc(asUser(STRANGER), "v2_takes", wid(STRANGER)), wtake(STRANGER)));
  });

  it("the id is the one-take bound: wrong id refused, repost refused, delete-and-repost allowed", async () => {
    await seedQ();
    const ref = doc(asUser(OWNER), "v2_takes", wid(OWNER));
    await assertSucceeds(setDoc(ref, wtake(OWNER)));
    // A second post lands on the same id — an update, denied like every
    // take update (an edited take invalidates its flags).
    await assertFails(setDoc(ref, wtake(OWNER, { text: "reworded" })));
    // A minted or crafted id that is not qid_uid is refused outright, so
    // one account cannot flood a question under fresh ids.
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_takes", `${QID}_sock`), wtake(OWNER)));
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_takes", wid(FRIEND)), wtake(OWNER)));
    // The rewrite path the panel offers: withdraw, then say it better.
    await assertSucceeds(deleteDoc(ref));
    await assertSucceeds(setDoc(ref, wtake(OWNER, { text: "said better" })));
  });

  // …and the one withdrawal that is not a withdrawal.
  //
  // A world take's id is deterministic, so delete-and-repost lands on the
  // SAME address. On a take a moderator has REMOVED that is not a rewrite,
  // it is an undo: clearFlagsFor wipes the flags with the verdict, so the
  // reposted take does not re-enter the queue until somebody reports it
  // afresh — and world scope is enforcing, not advisory. The avatar arm
  // has refused both verbs on a hidden document since D178 for exactly
  // this reason; the substrate that shape was borrowed from had not.
  it("a removed world take cannot be deleted and reposted at the same id", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_takes", wid(OWNER)), {
        gid: "world", authorUid: OWNER, qid: QID, text: "over the line",
        createdAt: new Date(), hidden: true,
        hiddenMeta: { by: "mod", policyLine: "H1" },
      });
    });
    const ref = doc(asUser(OWNER), "v2_takes", wid(OWNER));
    // The edit was already refused — updates are denied outright.
    await assertFails(setDoc(ref, wtake(OWNER, { text: "over the line" })));
    // The delete is the half that was open, and it is the whole bypass.
    await assertFails(deleteDoc(ref));
    // The author can still read their own removed take (the read gate's
    // author arm), so this hides nothing from them that was not hidden.
    await assertSucceeds(getDoc(ref));
  });

  it("shape holds at world scale: qid required and bounded, author is the signer", async () => {
    const longQ = "q".repeat(121);
    // Both questions exist and are active, so each refusal below has
    // exactly ONE cause. Without the long one seeded, the length bound
    // and the kill switch would refuse the same write and the assertion
    // would stop saying which.
    await seedQ([QID, longQ]);
    // No qid: a world take with no question would be unreachable by any
    // surface — and unqueryable by the per-question index.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_takes", `undefined_${OWNER}`), {
      gid: "world", authorUid: OWNER, text: "floating",
      createdAt: serverTimestamp(), hidden: false,
    }));
    // qid over the id-length bound.
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_takes", wid(OWNER, longQ)), wtake(OWNER, { qid: longQ })));
    // Authored as someone else.
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_takes", wid(FRIEND)), wtake(FRIEND)));
    // Pre-hidden, same argument as circles: hides your words from everyone
    // while leaving them in the moderation queue.
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_takes", wid(OWNER)), wtake(OWNER, { hidden: true })));
  });

  // The kill switch, which the answer paths honour seven times over and
  // the public thread did not honour at all. Pulling a question stopped it
  // being ANSWERED and left the conversation it started open for new
  // posts — which is backwards: the harm in a harmful question is mostly
  // what gets said underneath it.
  it("a pulled question closes its world thread, and an invented qid has none", async () => {
    await seedQ();
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "pulled-1"), {
        surface: "daily", seq: 1, type: "binary",
        prompt: "Over the line?", options: ["Yes", "No"], active: false,
      });
    });
    // The live question still takes a take — the switch is the only thing
    // that changed, so this is what proves it is a switch and not a wall.
    await assertSucceeds(setDoc(
      doc(asUser(OWNER), "v2_takes", wid(OWNER)), wtake(OWNER)));
    // The pulled one does not.
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_takes", wid(OWNER, "pulled-1")),
      wtake(OWNER, { qid: "pulled-1" })));
    // Nor does a qid naming no question at all. The id bound made takes
    // one-per-person-per-qid but never made a qid name a question, so any
    // string used to mint a fresh empty thread — one per invented qid, per
    // account, listed by no surface and reachable by nobody.
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_takes", wid(OWNER, "no-such-question")),
      wtake(OWNER, { qid: "no-such-question" })));
    // Reading is untouched in both directions: takes already posted under
    // a question stay readable after it is pulled. Closing a thread is not
    // erasing it, and the appeal path runs on what was said.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_takes", wid(FRIEND, "pulled-1")), {
        gid: "world", authorUid: FRIEND, qid: "pulled-1", text: "said before",
        createdAt: new Date(), hidden: false,
      });
    });
    await assertSucceeds(getDoc(
      doc(asUser(STRANGER), "v2_takes", wid(FRIEND, "pulled-1"))));
  });

  // Circle takes and world takes share ONE collection, and the id bound
  // used to live on the world branch alone. So a circle member could post
  // a circle take AT SOMEBODY ELSE'S world id: update is denied and delete
  // is author-only, so that person could never post their one world take
  // on that question — permanently, from one write, with no recovery path
  // and nothing to rate-limit it (any free account can make a group and be
  // a member of it).
  it("a circle take cannot squat the id a world take must occupy", async () => {
    await seedQ();
    await seed(async (db) => {
      await setDoc(doc(db, "v2_groups", "gsquat"), {
        name: "Squat", mode: "group", memberUids: [OWNER],
      });
    });
    const squat = (over: Record<string, unknown> = {}) => ({
      gid: "gsquat", authorUid: OWNER, text: "mine now",
      createdAt: serverTimestamp(), hidden: false, ...over,
    });
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_takes", wid(STRANGER)), squat({ qid: QID })));
    // The victim's own world take still lands — the point of refusing it.
    await assertSucceeds(setDoc(
      doc(asUser(STRANGER), "v2_takes", wid(STRANGER)), wtake(STRANGER)));
    // And an ordinary circle take is untouched: what postTake mints is a
    // Firestore auto-id, which carries no separator to collide on.
    await assertSucceeds(setDoc(
      doc(asUser(OWNER), "v2_takes", "AbCd1234EfGh5678IjKl"), squat()));
  });

  it("a world list is refused without both equalities, and never returns a hidden take", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_takes", wid(OWNER)), {
        gid: "world", authorUid: OWNER, qid: QID, text: "fine",
        createdAt: new Date(), hidden: false,
      });
      await setDoc(doc(db, "v2_takes", wid(FRIEND)), {
        gid: "world", authorUid: FRIEND, qid: QID, text: "over the line",
        createdAt: new Date(), hidden: true,
        hiddenMeta: { by: "mod", policyLine: "H1" },
      });
    });
    const takes = collection(asUser(STRANGER), "v2_takes");
    // Fail-closed: no hidden predicate, no list (D65's lesson, world arm).
    await assertFails(getDocs(query(takes, where("gid", "==", "world"))));
    // The shipped query shape returns the visible take alone.
    const visible = await assertSucceeds(getDocs(query(
      takes,
      where("gid", "==", "world"), where("qid", "==", QID), where("hidden", "==", false),
    )));
    expect(visible.docs.map((d) => d.id)).toEqual([wid(OWNER)]);
    // The hidden take stays readable to its author by id — the appeal path.
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_takes", wid(FRIEND))));
    await assertSucceeds(getDoc(doc(asUser(FRIEND), "v2_takes", wid(FRIEND))));
  });

  it("any signed-in user flags a world take; the flag rules hold their shape", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_takes", wid(OWNER)), {
        gid: "world", authorUid: OWNER, qid: QID, text: "contested",
        createdAt: new Date(), hidden: false,
      });
    });
    const wflag = (uid: string) => ({
      takeId: wid(OWNER), gid: "world", uid, at: serverTimestamp(),
    });
    // A stranger flags — the audience is the moderation constituency.
    await assertSucceeds(setDoc(
      doc(asUser(STRANGER), "v2_flags", `${wid(OWNER)}_${STRANGER}`), wflag(STRANGER)));
    // One per account: same id again is an update, denied.
    await assertFails(setDoc(
      doc(asUser(STRANGER), "v2_flags", `${wid(OWNER)}_${STRANGER}`), wflag(STRANGER)));
    // The gid on the flag must be the take's own — "world" cannot be
    // borrowed to flag a circle take from outside it.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_groups", "g_priv"), {
        name: "Priv", mode: "group", memberUids: [OWNER, FRIEND],
      });
      await setDoc(doc(db, "v2_takes", "t_circle"), {
        gid: "g_priv", authorUid: OWNER, text: "circle words",
        createdAt: new Date(), hidden: false,
      });
    });
    await assertFails(setDoc(
      doc(asUser(STRANGER), "v2_flags", `t_circle_${STRANGER}`),
      { takeId: "t_circle", gid: "world", uid: STRANGER, at: serverTimestamp() }));
  });
});

describe("D29 device binding: soft today, and the flip is pre-tested", () => {
  // The deployed rules do not yet demand the `db` claim
  // (deviceBindEnforced() returns false — D29 rollout step 2). This block
  // pins BOTH texts: the soft behavior of the file as it ships, and the
  // enforced behavior of the same file with the one-word flip applied,
  // run against a second emulator environment. Flip day's whole diff is
  // therefore already green here before it is made.
  const QID = "daily-000";
  const CATQ = "cat-bind0";
  const GID = "gbind";
  const DAY = dayOffset(-1);

  let enfEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const raw = readFileSync(resolve(__dirname, "../firestore.rules"), "utf8");
    const SOFT = "function deviceBindEnforced() { return false; }";
    // If the literal is renamed or moved this must fail HERE, loudly —
    // the silent alternative is testing the unflipped text twice and
    // reporting the flip as covered.
    if (raw.split(SOFT).length !== 2) {
      throw new Error("deviceBindEnforced() literal not found exactly once in firestore.rules — update this test alongside the rules");
    }
    enfEnv = await initializeTestEnvironment({
      projectId: "insight-rules-enforced",
      firestore: {
        rules: raw.replace(SOFT, "function deviceBindEnforced() { return true; }"),
      },
    });
  });
  afterAll(async () => {
    await enfEnv.cleanup();
  });

  const seedInto = (e: RulesTestEnvironment) =>
    e.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "v2_questions", QID), {
        surface: "daily", seq: 0, type: "binary",
        prompt: "?", options: ["Yes", "No"], active: true,
      });
      await setDoc(doc(db, "v2_questions", CATQ), {
        surface: "feed", seq: 0, type: "catalog",
        prompt: "?", options: [], active: true,
      });
      // "duo", to match the group's mode below and the answer's own
      // surface — see the same correction in the duel block above.
      await setDoc(doc(db, "v2_questions", "group-gu0"), {
        surface: "duo", seq: 0, type: "choice",
        prompt: "?", options: ["A", "B", "C", "D"], active: true,
      });
      await setDoc(doc(db, "v2_groups", GID), {
        name: "Bind", mode: "duo", ownerUid: OWNER,
        memberUids: [OWNER, FRIEND], inviteCode: "BIND2345", streak: 0,
      });
    });

  const worldAnswer = () => ({
    qid: QID, surface: "daily", optionIdx: 1,
    answeredAt: serverTimestamp(), anchors: {},
  });
  const catAnswer = () => ({
    qid: CATQ, surface: "feed", entity: 7,
    answeredAt: serverTimestamp(), anchors: {},
  });
  const duelAid = `g_${GID}_${DAY}`;
  const duelAnswer = () => ({
    qid: "group-gu0", surface: "duo", optionIdx: 1, guessIdx: 2,
    gid: GID, day: DAY, answeredAt: serverTimestamp(), anchors: {},
  });

  it("soft mode (the deployed text): the claim is optional in both directions", async () => {
    await seedInto(env);
    await assertSucceeds(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", QID), worldAnswer()));
    const bound = env.authenticatedContext(FRIEND, { db: 1 }).firestore();
    await assertSucceeds(setDoc(
      doc(bound, "v2_users", FRIEND, "answers", QID), worldAnswer()));
  });

  it("enforced text: world and catalog answers demand the claim; duels stay exempt", async () => {
    await enfEnv.clearFirestore();
    await seedInto(enfEnv);
    const plain = enfEnv.authenticatedContext(OWNER).firestore();
    const bound = enfEnv.authenticatedContext(FRIEND, { db: 1 }).firestore();
    // Aggregate-feeding surfaces: refused bare, accepted bound.
    await assertFails(setDoc(doc(plain, "v2_users", OWNER, "answers", QID), worldAnswer()));
    await assertSucceeds(setDoc(doc(bound, "v2_users", FRIEND, "answers", QID), worldAnswer()));
    await assertFails(setDoc(doc(plain, "v2_users", OWNER, "answers", CATQ), catAnswer()));
    await assertSucceeds(setDoc(doc(bound, "v2_users", FRIEND, "answers", CATQ), catAnswer()));
    // The duel branch is exempt by decision, not omission: sealed answers
    // feed member-only reveals, never aggregates, and membership already
    // required a human's invite code (D29).
    await assertSucceeds(setDoc(doc(plain, "v2_users", OWNER, "answers", duelAid), duelAnswer()));
  });

  it("enforced text: the claim check is type-strict — only the server's exact value passes", async () => {
    await enfEnv.clearFirestore();
    await seedInto(enfEnv);
    // Clients cannot mint claims at all; this pins that the rule demands
    // the integer the callable sets, so a future refactor to a truthy
    // string or boolean fails tests instead of silently widening the gate.
    const stringy = enfEnv.authenticatedContext(OWNER, { db: "1" }).firestore();
    await assertFails(setDoc(doc(stringy, "v2_users", OWNER, "answers", QID), worldAnswer()));
  });
});

describe("presence (D84 — Near by radius)", () => {
  // The privacy shape in three lines: your own cell-sized doc is yours to
  // write and delete, NOBODY can read any of them (the only read path is
  // the nearbyCountV2 callable, which returns a count), and the cell
  // regex is the precision cap — nothing finer than the ~200 m grid id can
  // be written at all, however a client is modified.
  // `until` is when the position stops counting (D174) — the count filters
  // on it, so it is the field that makes "visible for two hours" a promise
  // rather than an intention. The rules cap how far out it may be pushed.
  const soon = (min: number) => new Date(Date.now() + min * 60_000);
  const cellDoc = (over: Record<string, unknown> = {}) => ({
    cell: "29999_5374", at: serverTimestamp(), until: soon(120), ...over,
  });

  it("a user writes, overwrites and deletes their own presence", async () => {
    const ref = doc(asUser(OWNER), "v2_presence", OWNER);
    await assertSucceeds(setDoc(ref, cellDoc()));
    await assertSucceeds(setDoc(ref, cellDoc({ cell: "30000_5375" })));
    await assertSucceeds(deleteDoc(ref));
  });

  it("nobody reads presence — not even their own doc", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_presence", OWNER), { cell: "29999_5374", at: new Date() });
    });
    // Own doc: the client never needs to read it back, and a read grant is
    // surface someone will eventually widen. The callable is the read path.
    await assertFails(getDoc(doc(asUser(OWNER), "v2_presence", OWNER)));
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_presence", OWNER)));
    await assertFails(getDocs(query(
      collection(asUser(STRANGER), "v2_presence"), where("cell", "==", "29999_5374"),
    )));
  });

  it("cannot write someone else's presence, or smuggle precision past the grid", async () => {
    await assertFails(setDoc(doc(asUser(STRANGER), "v2_presence", OWNER), cellDoc()));
    const ref = doc(asUser(OWNER), "v2_presence", OWNER);
    await assertFails(setDoc(ref, cellDoc({ cell: "59.913_10.752" })));   // raw coords
    await assertFails(setDoc(ref, cellDoc({ cell: "29999_5374_extra" }))); // sub-cell suffix
    await assertFails(setDoc(ref, cellDoc({ lat: 59.91 })));              // extra field
    await assertFails(setDoc(ref, cellDoc({ at: new Date() })));          // not request.time
  });

  // THE WRITE-SIDE VERSION OF THE READ DENY (D174).
  //
  // Presence is unreadable so nobody can follow an account around town.
  // An uncapped `until` would reach the same place through the other door:
  // a modified client writes a position good for a year and stands in the
  // room permanently, whatever its own switch says. The ceiling is the
  // rule that stops it, so it is the rule worth a case.
  it("caps how long a position may claim to last, and demands one at all", async () => {
    const ref = doc(asUser(OWNER), "v2_presence", OWNER);
    await assertSucceeds(setDoc(ref, cellDoc({ until: soon(179) })));
    // 180 minutes is PRESENCE_LINGER_MIN. Past it, refused.
    await assertFails(setDoc(ref, cellDoc({ until: soon(181) })));
    await assertFails(setDoc(ref, cellDoc({ until: soon(60 * 24 * 365) })));
    // A position that has already expired is not a position.
    await assertFails(setDoc(ref, cellDoc({ until: soon(-1) })));
    // It is no longer REQUIRED — see the compatibility case below, which
    // owns that half now (D179). What this case owns is the ceiling, which
    // is the half that stops a modified client standing in the room for a
    // year.
    await assertFails(setDoc(ref, cellDoc({ until: "soon" })));
  });

  // THE DEPLOY-ORDER WINDOW (D179), and it is the case that keeps an
  // existing install working across the merge.
  //
  // Rules deploy the moment this reaches main; the app reaches phones
  // through a store review. In between, the newest build in the wild is the
  // one that predates D174 and writes `{cell, at}` — so a hard `until`
  // requirement denies every presence write from every existing install,
  // and Near fails with a retry button that cannot succeed.
  it("still takes a pre-D174 write with no `until` at all, for one release", async () => {
    const ref = doc(asUser(OWNER), "v2_presence", OWNER);
    await assertSucceeds(setDoc(ref, { cell: "29999_5374", at: serverTimestamp() }));
    // And the cap still binds when one IS supplied, so nothing is gained by
    // omitting it — this is a compatibility arm, not a hole.
    await assertFails(setDoc(ref, cellDoc({ until: soon(181) })));
    await assertFails(setDoc(ref, cellDoc({ until: "soon" })));
    await assertFails(setDoc(ref, cellDoc({ until: soon(-1) })));
  });

  // THE ONE FIELD A CLIENT CHOOSES THE CONTENTS OF (D176).
  //
  // `type` is the writer's own Big Five archetype name, and it is here
  // because the archetype table lives on the DEVICE — the server folding
  // the room's mix never joins a profile, never scores anybody, and never
  // needs the table. The phone says what it is; the callable counts names.
  //
  // Which means this is a client-authored free-text field on a doc no
  // client can read, i.e. exactly the shape that becomes storage for
  // something else if it is not bounded. The size cap is the whole guard,
  // so it is the one worth a case.
  it("takes an optional archetype name, and refuses an unbounded one", async () => {
    const ref = doc(asUser(OWNER), "v2_presence", OWNER);
    // Optional: most people have not taken the test, and a room that only
    // counted typed phones would be wrong about how full it is.
    await assertSucceeds(setDoc(ref, cellDoc()));
    await assertSucceeds(setDoc(ref, cellDoc({ type: "Host" })));
    await assertSucceeds(setDoc(ref, cellDoc({ type: "x".repeat(40) })));
    await assertFails(setDoc(ref, cellDoc({ type: "x".repeat(41) })));
    await assertFails(setDoc(ref, cellDoc({ type: "" })));
    await assertFails(setDoc(ref, cellDoc({ type: 3 })));
    // And it does not open the doc to anything else riding alongside it —
    // hasOnly still names four keys.
    await assertFails(setDoc(ref, cellDoc({ type: "Host", score: 0.8 })));
  });

  // The mix cache is presence one level up, and the deny is the same
  // argument: a client that could read a cell it is not standing in has a
  // map of every room, not a reading about its own. The callable answers
  // only for the caller's cell and its neighbours, and that restriction
  // holds only while this is the sole door.
  it("nobody touches the room's mix cache — read or write (D176)", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_presence_mix", "29999_5374"),
        { top: ["Host"], n: 9, at: new Date() });
    });
    await assertFails(getDoc(doc(asUser(OWNER), "v2_presence_mix", "29999_5374")));
    await assertFails(getDocs(collection(asUser(STRANGER), "v2_presence_mix")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_presence_mix", "29999_5374"),
      { top: ["Host"], n: 900, at: serverTimestamp() }));
    await assertFails(deleteDoc(doc(asUser(OWNER), "v2_presence_mix", "29999_5374")));
  });

  // THE SHARPEST DENY IN THIS FILE (D177), because of what the document
  // holds: a LIST OF UIDS standing in a named cell. Everything else about
  // the room — the names, the answers, the test scores — has been public
  // since D98; the pairing with "here" is the new thing, and it is the
  // pairing v2_presence's read deny exists to prevent.
  //
  // `nearbyRoomV2` is the only door, and it refuses any caller without a
  // live position of their own in that neighbourhood. A readable cache
  // would route around that gate entirely: read the cells one by one and
  // the result is a map of who is in every room, which is precisely the
  // people-finder the whole design is arranged around not being.
  it("nobody touches the room's roster cache — it is uids paired with a place (D177)", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_presence_room", "29999_5374"), {
        people: [{ uid: OWNER, type: "Host" }], qs: { q1: { "0": 3 } }, at: new Date(),
      });
    });
    await assertFails(getDoc(doc(asUser(OWNER), "v2_presence_room", "29999_5374")));
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_presence_room", "29999_5374")));
    await assertFails(getDocs(collection(asUser(STRANGER), "v2_presence_room")));
    // Nor may a client seed one: a forged roster would put strangers in a
    // room they are not in, and the callable serves this document back.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_presence_room", "29999_5374"),
      { people: [{ uid: STRANGER }], qs: {}, at: serverTimestamp() }));
    await assertFails(deleteDoc(doc(asUser(OWNER), "v2_presence_room", "29999_5374")));
  });
});

// ── handles and invitations (D122) ─────────────────────────────────
//
// The two surfaces that replace the typed invite code. Both are
// server-written, so most of what these cases prove is what a client
// CANNOT do — which is the half that matters, because accepting an
// invitation is one hop from `memberUids`, and `memberUids` is the array
// this rules file reads to decide who may see a sealed duel answer.
// ── the people directory (D239) ──────────────────────────────────
//
// The registry above answers an exact address. This is the half that
// answers a NAME, and its whole risk is one line of the rule: `nameKey`
// is what a search matches and `name` is what the result draws, so a row
// where they disagree answers somebody's search for a friend with a
// stranger. Rules can compare the two, so they do.
describe("people directory: found by name (D239)", () => {
  const seedRow = () => seed(async (db) => {
    await setDoc(doc(db, "v2_people", OWNER), { name: "Olaf", nameKey: "olaf", handle: "olaf_t" });
  });

  it("anyone signed in can search it — that is what it is for", async () => {
    await seedRow();
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_people", OWNER)));
  });

  it("you write your own row and nobody else's", async () => {
    await assertSucceeds(setDoc(doc(asUser(OWNER), "v2_people", OWNER), { name: "Olaf", nameKey: "olaf" }));
    await assertFails(setDoc(doc(asUser(STRANGER), "v2_people", OWNER), { name: "Olaf", nameKey: "olaf" }));
  });

  // THE ONE THAT MATTERS. Without this the row displaying "Bob" can be
  // found by a search for "ada", which is impersonation with extra steps
  // — the searcher gets a stranger where they asked for a friend.
  it("refuses a nameKey that is not the name", async () => {
    await assertFails(setDoc(doc(asUser(OWNER), "v2_people", OWNER), { name: "Bob", nameKey: "ada" }));
    // Case, too: the key is the FOLD of the name, and a key that merely
    // contains it would sort into the wrong prefix range.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_people", OWNER), { name: "Olaf", nameKey: "Olaf" }));
    await assertSucceeds(setDoc(doc(asUser(OWNER), "v2_people", OWNER), { name: "Olaf T", nameKey: "olaf t" }));
  });

  it("refuses an empty or oversized name", async () => {
    await assertFails(setDoc(doc(asUser(OWNER), "v2_people", OWNER), { name: "", nameKey: "" }));
    const long = "x".repeat(61);
    await assertFails(setDoc(doc(asUser(OWNER), "v2_people", OWNER), { name: long, nameKey: long }));
  });

  it("refuses a field nobody declared", async () => {
    // A directory row holds a name and a handle. Anything else is a
    // second thing a search result could leak.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_people", OWNER), {
      name: "Olaf", nameKey: "olaf", email: "olaf@example.com",
    }));
  });

  // `handle` is the callable's, exactly as v2_users.handle is: a claim is
  // a two-document transaction the rules cannot express. It is on the
  // allowlist so a later name write can carry it through, and immutable
  // so that write cannot change it.
  it("lets a client carry the handle through but never set or move it", async () => {
    await seedRow();
    await assertSucceeds(setDoc(doc(asUser(OWNER), "v2_people", OWNER),
      { name: "Olaf Two", nameKey: "olaf two", handle: "olaf_t" }));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_people", OWNER),
      { name: "Olaf", nameKey: "olaf", handle: "someone_else" }));
  });

  it("nor DROP it — omitting the field was the way around claim-once", async () => {
    // The immutability clause read "no handle in the resulting document,
    // or the same handle" — so a NON-merge write that simply omitted the
    // field was legal, since every remaining key is on the allowlist and
    // dropping a handle looked like never having had one.
    // claimHandleV2's whole claim-once check is reading this field back,
    // so after the drop it would mint a second handle while the first
    // registry row still pointed at the same account: one account
    // hoarding names out of a registry with no rate limit, no rename and
    // no reclaim path (D190).
    await seedRow();
    await assertFails(setDoc(doc(asUser(OWNER), "v2_people", OWNER),
      { name: "Olaf", nameKey: "olaf" }));
    // An account that has no handle yet is unaffected — absence is legal
    // while there is nothing to remove, which is what a first name write
    // does.
    await assertSucceeds(setDoc(doc(asUser(STRANGER), "v2_people", STRANGER),
      { name: "Stranger", nameKey: "stranger" }));
  });

  // deleteAccount (admin SDK) owns removal — phase 3d. A client delete
  // would be the one path able to strip a row the erasure counts on.
  it("nobody deletes a row from a client, not even their own", async () => {
    await seedRow();
    await assertFails(deleteDoc(doc(asUser(STRANGER), "v2_people", OWNER)));
    await assertFails(deleteDoc(doc(asUser(OWNER), "v2_people", OWNER)));
  });
});

describe("handles: the account registry (D122)", () => {
  const seedHandle = () => seed(async (db) => {
    await setDoc(doc(db, "v2_handles", "olaf"), { uid: OWNER, at: new Date() });
  });

  it("anyone signed in can look a handle up — that is what it is for", async () => {
    await seedHandle();
    // A directory nobody may read cannot let a friend find you, which is
    // the entire purpose. Deliberately wider than D98: that made answers
    // readable to anyone holding your uid, this makes you findable by
    // name. Recorded as its own decision rather than assumed.
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "v2_handles", "olaf")));
  });

  it("nobody claims, moves or frees a handle from a client", async () => {
    await seedHandle();
    // Uniqueness is the document id, and a client create would race the
    // registry. Every verb is server-only.
    await assertFails(setDoc(doc(asUser(STRANGER), "v2_handles", "newname"), { uid: STRANGER }));
    // The impersonation case: taking a name someone already holds.
    await assertFails(setDoc(doc(asUser(STRANGER), "v2_handles", "olaf"), { uid: STRANGER }));
    // …and the denial-of-service one: freeing someone else's.
    await assertFails(deleteDoc(doc(asUser(STRANGER), "v2_handles", "olaf")));
    // Not even your own. Since D190 there is no rename to free it FOR — a
    // handle is claimed once and claimHandleV2 refuses a change — so a
    // client delete here is the only path left that could orphan an
    // address someone has already been handed.
    await assertFails(deleteDoc(doc(asUser(OWNER), "v2_handles", "olaf")));
  });

  it("a client cannot write or rewrite the handle on its own profile", async () => {
    await assertFails(setDoc(doc(asUser(OWNER), "v2_users", OWNER), {
      displayName: "Olaf", handle: "olaf",
    }));
    await seed(async (db) => {
      await setDoc(doc(db, "v2_users", OWNER), { displayName: "Olaf", handle: "olaf" });
    });
    await assertFails(updateDoc(doc(asUser(OWNER), "v2_users", OWNER), { handle: "someoneelse" }));
  });

  it("nor DROP it — omitting the field was the way around claim-once", async () => {
    // The clause read "no handle in the resulting document, or the same
    // handle", so a NON-merge setDoc that simply left the field out was
    // legal: every remaining key is on the allowlist, and dropping a
    // handle looked like never having had one. claimHandleV2 reads this
    // field back as its ENTIRE claim-once check, so after the drop it
    // mints a second handle while the first v2_handles row still points
    // at this account — unlimited names out of a registry with no rate
    // limit and no reclaim path (D190), the profile advertising the last.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_users", OWNER), { displayName: "Olaf", handle: "olaf" });
    });
    await assertFails(setDoc(doc(asUser(OWNER), "v2_users", OWNER), { displayName: "Olaf" }));
    // A profile that never had one is unaffected: absence is legal while
    // there is nothing to remove, which is every ordinary first write.
    await assertSucceeds(setDoc(doc(asUser(STRANGER), "v2_users", STRANGER), {
      displayName: "Stranger",
    }));
  });

  it("…but a profile that HAS a handle can still edit everything else", async () => {
    // The failure this exists for ships green: request.resource.data is
    // the RESULTING document, so once the callable has written a handle,
    // a merge that only touches displayName still presents `handle` in
    // its key set. Leave it off the hasOnly allowlist and claiming a
    // handle silently freezes your display name forever.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_users", OWNER), { displayName: "Olaf", handle: "olaf" });
    });
    await assertSucceeds(updateDoc(doc(asUser(OWNER), "v2_users", OWNER), { displayName: "Olaf H." }));
  });
});

describe("circle invitations (D122)", () => {
  const GID = "g_inv";
  const seedInvite = () => seed(async (db) => {
    await setDoc(doc(db, "v2_groups", GID), {
      name: "The Crew", mode: "group", ownerUid: OWNER,
      memberUids: [OWNER], inviteCode: "ABCD2345", streak: 0,
    });
    await setDoc(doc(db, "v2_groups", GID, "invites", FRIEND), {
      to: FRIEND, from: OWNER, fromName: "Olaf", groupName: "The Crew", mode: "group",
      at: new Date(),
    });
  });

  it("the invitee reads their invitation", async () => {
    await seedInvite();
    // They have to: the group document itself is member-gated (it carries
    // the invite code), and an invitee is by definition not a member yet —
    // which is why the circle's name is denormalised onto this doc.
    await assertSucceeds(getDoc(doc(asUser(FRIEND), "v2_groups", GID, "invites", FRIEND)));
  });

  it("the invitee finds it AS A COLLECTION-GROUP QUERY — the only way they can", async () => {
    // An invitee never learns the group id from anywhere else: the group
    // document is member-gated and they are not a member yet. The one way
    // in is socialFetch.ts's collection-group query on `to`, and that is
    // bound by a recursive-wildcard match, not by the path grant above —
    // so the path grant was open, the COLLECTION_GROUP index for
    // `invites.to` was deployed, the client issued the query, and the
    // rules refused it. live.ts swallows the refusal, so the invitations
    // list was permanently empty and D122's way into a circle led nowhere.
    await seedInvite();
    await assertSucceeds(getDocs(query(
      collectionGroup(asUser(FRIEND), "invites"),
      where("to", "==", FRIEND),
      orderBy("at", "desc"),
      limit(20),
    )));
    // And nobody else's: the filter is the grant, so a stranger asking for
    // the invitee's mail is refused, as is asking for everyone's.
    await assertFails(getDocs(query(
      collectionGroup(asUser(STRANGER), "invites"),
      where("to", "==", FRIEND),
    )));
    await assertFails(getDocs(collectionGroup(asUser(FRIEND), "invites")));
  });

  it("even a member cannot read it — the read arm for that cost a billed get()", async () => {
    // A first draft let members read the list so a circle could show who
    // had been asked. That arm needed a membership get() on v2_groups,
    // and scripts/pulse.test.mjs — which counts every get()/exists() in
    // the rules because each is a BILLED READ — caught it going 15 → 16
    // for a screen that does not exist. Nothing reads an invitation as a
    // member, and re-inviting is idempotent server-side, so the arm
    // bought nothing. This pins its absence.
    await seedInvite();
    await assertFails(getDoc(doc(asUser(OWNER), "v2_groups", GID, "invites", FRIEND)));
  });

  it("a stranger reads nothing — who was asked is a fact about the invitee", async () => {
    await seedInvite();
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_groups", GID, "invites", FRIEND)));
  });

  it("nobody writes an invitation from a client, in any direction", async () => {
    await seedInvite();
    // Inviting yourself into someone's circle is the attack this refuses:
    // without it, "write an invite, accept it" is join-any-circle-by-id.
    await assertFails(setDoc(doc(asUser(STRANGER), "v2_groups", GID, "invites", STRANGER), {
      to: STRANGER, from: OWNER, groupName: "The Crew", at: new Date(),
    }));
    // A member cannot hand-write one either — inviteToGroupV2 owns the
    // cap and the rate budget, and a rule cannot express either.
    await assertFails(setDoc(doc(asUser(OWNER), "v2_groups", GID, "invites", STRANGER), {
      to: STRANGER, from: OWNER, groupName: "The Crew", at: new Date(),
    }));
    // Not even declining: acceptGroupInviteV2 and declineGroupInviteV2
    // are the two doors, and one door is easier to keep correct than two.
    await assertFails(deleteDoc(doc(asUser(FRIEND), "v2_groups", GID, "invites", FRIEND)));
  });

  it("an invitation is not membership — the group stays shut until accept", async () => {
    await seedInvite();
    // The whole point of the accept step: being invited grants nothing.
    // FRIEND can read the invite above and still not the circle.
    await assertFails(getDoc(doc(asUser(FRIEND), "v2_groups", GID)));
    // …and cannot let themselves in.
    await assertFails(updateDoc(doc(asUser(FRIEND), "v2_groups", GID), {
      memberUids: [OWNER, FRIEND],
    }));
  });
});

describe("rank answers (D233): an order, never an index", () => {
  const RANK = "feed-f03";
  const seedRank = () => seed(async (db) => {
    await setDoc(doc(db, "v2_questions", RANK), {
      surface: "feed", seq: 2, type: "rank", prompt: "Rank them",
      options: ["A", "B", "C", "D"], active: true,
    });
  });
  const mine = () => doc(asUser(OWNER), "v2_users", OWNER, "answers", RANK);
  const rankAnswer = (over: Record<string, unknown> = {}) => ({
    qid: RANK, surface: "feed", order: [2, 0, 1, 3],
    answeredAt: serverTimestamp(), anchors: {}, ...over,
  });

  it("admits a full order, and the answer is create-only with no edit arm", async () => {
    await seedRank();
    await assertSucceeds(setDoc(mine(), rankAnswer()));
    await assertFails(setDoc(mine(), rankAnswer({ order: [0, 1, 2, 3] }))); // a re-rank rewrites frozen fields
    await assertFails(updateDoc(mine(), { order: [0, 1, 2, 3], editedAt: serverTimestamp() }));
    // The D86 arm keys on the OLD doc carrying optionIdx — an order answer
    // never does, so a ranking cannot be "moved" through the vote edit.
    await assertFails(updateDoc(mine(), { optionIdx: 1, editedAt: serverTimestamp() }));
  });

  it("bounds the list where rules can, and refuses the index the fold would misread", async () => {
    await seedRank();
    await assertFails(setDoc(mine(), rankAnswer({ order: [0, 1, 2] }))); // size != item count
    await assertFails(setDoc(mine(), rankAnswer({ order: 3 }))); // not a list
    await assertFails(setDoc(mine(), rankAnswer({ order: [2, 0, 1, 3], optionIdx: 1 }))); // both fields
    // THE hole this branch closes alongside itself: a rank doc carries
    // real options, so before D233 a plain optionIdx write passed
    // isWorldAnswer's size bound and its fold clobbered the rank
    // aggregate — D12's wrong-shaped poisoning through the raw API.
    await assertFails(setDoc(mine(), {
      qid: RANK, surface: "feed", optionIdx: 0,
      answeredAt: serverTimestamp(), anchors: {},
    }));
    // …and the reverse: an order on a vote question names no rank type.
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "feed-v1"), {
        surface: "feed", seq: 3, type: "vote", prompt: "V",
        options: ["A", "B", "C", "D"], active: true,
      });
    });
    await assertFails(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", "feed-v1"),
      rankAnswer({ qid: "feed-v1" }),
    ));
  });

  it("elements are the TRIGGER's to validate — rules admit a non-permutation by design", async () => {
    // Rules can bound a list's size but cannot iterate it (no forall), so
    // a duplicate-laden order passes here and dies at validRankOrder in
    // the fold (functions/src/pure.ts) — the same trust boundary catalog
    // keys cross. Pinned so the boundary stays a decision, not a surprise.
    await seedRank();
    await assertSucceeds(setDoc(
      doc(asUser(STRANGER), "v2_users", STRANGER, "answers", RANK),
      rankAnswer({ order: [0, 0, 0, 0] }),
    ));
  });

  it("honours the kill switch", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", RANK), {
        surface: "feed", seq: 2, type: "rank", prompt: "R",
        options: ["A", "B", "C", "D"], active: false,
      });
    });
    await assertFails(setDoc(mine(), rankAnswer()));
  });
});

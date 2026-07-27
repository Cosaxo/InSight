// Firestore security-rules tests. Run against the emulator:
//   npm run test:rules
// (which wraps `firebase emulators:exec --only firestore "vitest run …"`).
//
// These lock down the access decisions we rely on: per-user scoping,
// the circle-tier sharing carve-out, callable-only impression creates,
// read-only aggregates, the opaque rate-limit ledger, and block
// enforcement. They sit outside src/ so the app build never compiles
// them.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  GeoPoint,
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

// Seed data with rules bypassed (admin context).
async function seed(fn: (db: Firestore) => Promise<void>): Promise<void> {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore());
  });
}

const asUser = (uid: string): Firestore =>
  env.authenticatedContext(uid).firestore();
const asAnon = (): Firestore => env.unauthenticatedContext().firestore();

// Make OWNER's profile exist, optionally with share prefs, and
// optionally add FRIEND to OWNER's circle.
async function setupOwner(opts: {
  sharePrefs?: Record<string, string>;
  friendInCircle?: boolean;
  friendBlocked?: boolean;
} = {}): Promise<void> {
  await seed(async (db) => {
    await setDoc(doc(db, "insight_users", OWNER), {
      sharePrefs: opts.sharePrefs ?? {},
    });
    await setDoc(
      doc(db, "insight_users", OWNER, "insight_workouts", "w1"),
      { type: "Run", date: "2026-05-01" },
    );
    await setDoc(
      doc(db, "insight_users", OWNER, "insight_transactions", "t1"),
      { amount: 42 },
    );
    if (opts.friendInCircle) {
      await setDoc(doc(db, "insight_users", OWNER, "circle", FRIEND), {
        since: 2026,
      });
    }
    if (opts.friendBlocked) {
      await setDoc(doc(db, "insight_users", OWNER, "blocks", FRIEND), {
        at: 1,
      });
    }
  });
}

describe("per-user scoping", () => {
  it("owner reads + writes their own profile", async () => {
    await setupOwner();
    const db = asUser(OWNER);
    await assertSucceeds(getDoc(doc(db, "insight_users", OWNER)));
    await assertSucceeds(
      setDoc(doc(db, "insight_users", OWNER), { sharePrefs: {} }),
    );
  });

  it("a stranger cannot read someone else's profile", async () => {
    await setupOwner();
    await assertFails(
      getDoc(doc(asUser(STRANGER), "insight_users", OWNER)),
    );
  });

  it("an unauthenticated client cannot read a profile", async () => {
    await setupOwner();
    await assertFails(getDoc(doc(asAnon(), "insight_users", OWNER)));
  });
});

describe("circle-tier sharing", () => {
  it("a circle friend can read a shareable subcollection at default level", async () => {
    // workouts default to "circle" — no explicit pref needed.
    await setupOwner({ friendInCircle: true });
    await assertSucceeds(
      getDocs(collection(asUser(FRIEND), "insight_users", OWNER, "insight_workouts")),
    );
  });

  it("a circle friend is denied when the owner set the level to nobody", async () => {
    await setupOwner({
      friendInCircle: true,
      sharePrefs: { workouts: "nobody" },
    });
    await assertFails(
      getDocs(collection(asUser(FRIEND), "insight_users", OWNER, "insight_workouts")),
    );
  });

  it("a non-circle user cannot read a shareable subcollection", async () => {
    await setupOwner({ sharePrefs: { workouts: "world" } });
    await assertFails(
      getDocs(collection(asUser(STRANGER), "insight_users", OWNER, "insight_workouts")),
    );
  });

  it("non-shareable collections (finance) are never exposed to a friend", async () => {
    await setupOwner({
      friendInCircle: true,
      sharePrefs: { workouts: "world" },
    });
    await assertFails(
      getDocs(collection(asUser(FRIEND), "insight_users", OWNER, "insight_transactions")),
    );
  });

  it("a blocked friend loses shared reads", async () => {
    await setupOwner({
      friendInCircle: true,
      friendBlocked: true,
      sharePrefs: { workouts: "circle" },
    });
    await assertFails(
      getDocs(collection(asUser(FRIEND), "insight_users", OWNER, "insight_workouts")),
    );
  });
});

describe("wildcard subcollection match does not override governed blocks", () => {
  // Overlapping match blocks OR their grants together, so the
  // /{collection}/{doc} owner-write wildcard must exclude every
  // subcollection with its own rules. These pin the exclusion.

  it("owner still writes ungoverned subcollections (wildcard intact)", async () => {
    await setupOwner();
    await assertSucceeds(setDoc(
      doc(asUser(OWNER), "insight_users", OWNER, "insight_workouts", "w2"),
      { type: "Swim", date: "2026-07-27" },
    ));
  });

  it("owner cannot self-author an inbound impression (create: if false holds)", async () => {
    await setupOwner();
    await assertFails(setDoc(
      doc(asUser(OWNER), "insight_users", OWNER, "insight_inbound_impressions", "i9"),
      { senderUid: STRANGER, traits: ["brilliant"], createdAt: 1 },
    ));
  });

  it("owner cannot edit or un-delete an impression via the wildcard", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "insight_users", OWNER), { sharePrefs: {} });
      await setDoc(
        doc(db, "insight_users", OWNER, "insight_inbound_impressions", "i1"),
        { senderUid: FRIEND, traits: ["kind"], createdAt: 1 },
      );
    });
    await assertFails(updateDoc(
      doc(asUser(OWNER), "insight_users", OWNER, "insight_inbound_impressions", "i1"),
      { traits: ["kind", "forged"] },
    ));
  });

  it("insight_daily writes must pass the validator — no wildcard bypass", async () => {
    await setupOwner();
    const day = doc(asUser(OWNER), "insight_users", OWNER, "insight_daily", "2026-07-27");
    // invalid: mood out of range
    await assertFails(setDoc(day, {
      date: "2026-07-27", mood: 9999, moodLabel: "??", one_line: "x",
      weather: "sun", hasPhoto: false, shared: [],
    }));
    // valid write still succeeds through the dedicated block
    await assertSucceeds(setDoc(day, {
      date: "2026-07-27", mood: 60, moodLabel: "fine", one_line: "quiet day",
      weather: "sun", hasPhoto: false, shared: [],
    }));
  });

  it("a user cannot forge a friendRequest in their own namespace to self-join a circle", async () => {
    // The circle create rule trusts insight_users/{me}/friendRequests/{them}
    // as proof THEY asked ME. If the wildcard let me author that doc,
    // I could add myself to anyone's circle.
    await setupOwner();
    await seed(async (db) => {
      await setDoc(doc(db, "insight_users", STRANGER), {});
    });
    await assertFails(setDoc(
      doc(asUser(STRANGER), "insight_users", STRANGER, "friendRequests", OWNER),
      { at: 1 },
    ));
    // and the downstream escalation stays closed
    await assertFails(setDoc(
      doc(asUser(STRANGER), "insight_users", OWNER, "circle", STRANGER),
      { since: 2026 },
    ));
  });

  it("owner cannot fabricate followers, and follower docs stay immutable", async () => {
    await setupOwner();
    await seed(async (db) => {
      await setDoc(doc(db, "insight_users", OWNER, "followers", FRIEND), {
        followedAt: 1,
      });
    });
    await assertFails(setDoc(
      doc(asUser(OWNER), "insight_users", OWNER, "followers", STRANGER),
      { followedAt: 1 },
    ));
    await assertFails(updateDoc(
      doc(asUser(OWNER), "insight_users", OWNER, "followers", FRIEND),
      { followedAt: 2 },
    ));
    // legitimate paths keep working: follower self-creates, owner kicks
    await assertSucceeds(setDoc(
      doc(asUser(STRANGER), "insight_users", OWNER, "followers", STRANGER),
      { followedAt: 1 },
    ));
    await assertSucceeds(deleteDoc(
      doc(asUser(OWNER), "insight_users", OWNER, "followers", FRIEND),
    ));
  });
});

describe("inbound impressions", () => {
  it("client direct-create is denied (callable-only)", async () => {
    await setupOwner({ friendInCircle: true });
    await assertFails(
      setDoc(
        doc(asUser(FRIEND), "insight_users", OWNER, "insight_inbound_impressions", "i1"),
        { senderUid: FRIEND, traits: ["kind"], createdAt: 1 },
      ),
    );
  });

  it("the recipient can read their own inbox", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "insight_users", OWNER), { sharePrefs: {} });
      await setDoc(
        doc(db, "insight_users", OWNER, "insight_inbound_impressions", "i1"),
        { senderUid: FRIEND, traits: ["kind"], createdAt: 1 },
      );
    });
    await assertSucceeds(
      getDocs(collection(asUser(OWNER), "insight_users", OWNER, "insight_inbound_impressions")),
    );
  });
});

describe("aggregates + system collections", () => {
  const aggregateDocs: [string, string][] = [
    ["aggregates_by_geohash5", "u4pruyd"],
    ["aggregates_world", "snapshot"],
    ["aggregates_city", "oslo"],
    ["aggregates_media", "world"],
    ["taxonomies", "interest_categories"],
  ];

  it("signed-in users can read aggregates, but not write them", async () => {
    await seed(async (db) => {
      for (const [coll, id] of aggregateDocs) {
        await setDoc(doc(db, coll, id), { ok: true });
      }
    });
    for (const [coll, id] of aggregateDocs) {
      await assertSucceeds(getDoc(doc(asUser(OWNER), coll, id)));
      await assertFails(setDoc(doc(asUser(OWNER), coll, id), { ok: false }));
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
    await assertFails(getDoc(doc(asAnon(), "v2_questions", "daily-000")));
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
      await setDoc(doc(db, "v2_aggs_private", "daily-000"), { counts: { "0": 1 }, total: 1 });
      await setDoc(doc(db, "v2_agg_events", "evt1"), { qid: "daily-000" });
    });
    await assertFails(getDoc(doc(asUser(OWNER), "v2_aggs_private", "daily-000")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_aggs_private", "daily-000"), { total: 9 }));
    await assertFails(getDoc(doc(asUser(OWNER), "v2_agg_events", "evt1")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_agg_events", "evt2"), { qid: "x" }));
  });
});

describe("v2 profile", () => {
  it("owner-only read/write with validated fields", async () => {
    const mine = doc(asUser(OWNER), "v2_users", OWNER);
    await assertSucceeds(setDoc(mine, {
      displayName: "Mira",
      anchors: { city: "Oslo", country: "Norway" },
      anon: true,
    }));
    await assertSucceeds(getDoc(mine));
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_users", OWNER)));
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
});

describe("v2 answers (owner-only, create-only — D5)", () => {
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

  it("owner creates a valid answer once; it is then immutable", async () => {
    await seedQuestion();
    const ref = doc(asUser(OWNER), "v2_users", OWNER, "answers", QID);
    await assertSucceeds(setDoc(ref, answer()));
    await assertFails(updateDoc(ref, { optionIdx: 0 }));
    await assertFails(deleteDoc(ref));
    // setDoc on an existing doc is an update → also denied
    await assertFails(setDoc(ref, answer({ optionIdx: 0 })));
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

  it("two different users can answer the same question", async () => {
    await seedQuestion();
    await assertSucceeds(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", QID), answer()));
    await assertSucceeds(setDoc(
      doc(asUser(FRIEND), "v2_users", FRIEND, "answers", QID),
      answer({ optionIdx: 0 })));
  });

  it("answers are invisible and unwritable to other users", async () => {
    await seedQuestion();
    await assertSucceeds(setDoc(
      doc(asUser(OWNER), "v2_users", OWNER, "answers", QID), answer()));
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_users", OWNER, "answers", QID)));
    await assertFails(getDocs(collection(asUser(STRANGER), "v2_users", OWNER, "answers")));
    await assertFails(setDoc(
      doc(asUser(STRANGER), "v2_users", OWNER, "answers", "feed-x"),
      answer({ qid: "feed-x" })));
  });
});

describe("social graph writes", () => {
  // ── circle: the friend-accept cross-write ──────────────────────
  // When FRIEND accepts OWNER's request, FRIEND writes himself into
  // OWNER's circle. The rule proves consent by checking for a
  // friendRequest FROM OWNER in FRIEND's namespace — i.e. the
  // ACCEPTER's namespace, not the circle owner's. These pin that
  // namespace inversion.

  it("a friend cannot join a circle without a consenting friendRequest", async () => {
    await setupOwner();
    await assertFails(setDoc(
      doc(asUser(FRIEND), "insight_users", OWNER, "circle", FRIEND),
      { since: 2026 },
    ));
  });

  it("the accept cross-write works once the request exists in the accepter's namespace", async () => {
    await setupOwner();
    await seed(async (db) => {
      // OWNER asked FRIEND → the request lives under FRIEND (the accepter).
      await setDoc(doc(db, "insight_users", FRIEND, "friendRequests", OWNER), {
        at: 1,
      });
    });
    await assertSucceeds(setDoc(
      doc(asUser(FRIEND), "insight_users", OWNER, "circle", FRIEND),
      { since: 2026 },
    ));
  });

  it("a request in the circle owner's namespace does NOT authorize the cross-write", async () => {
    // STRANGER asked OWNER (request under OWNER). That's a pending ask,
    // not consent — STRANGER still can't write himself into the circle.
    await setupOwner();
    await seed(async (db) => {
      await setDoc(doc(db, "insight_users", OWNER, "friendRequests", STRANGER), {
        at: 1,
      });
    });
    await assertFails(setDoc(
      doc(asUser(STRANGER), "insight_users", OWNER, "circle", STRANGER),
      { since: 2026 },
    ));
  });

  it("either side can break the friendship; strangers cannot", async () => {
    await setupOwner({ friendInCircle: true });
    await assertFails(deleteDoc(
      doc(asUser(STRANGER), "insight_users", OWNER, "circle", FRIEND),
    ));
    await assertSucceeds(deleteDoc(
      doc(asUser(FRIEND), "insight_users", OWNER, "circle", FRIEND),
    ));
    // re-seed and let the owner clear it too
    await setupOwner({ friendInCircle: true });
    await assertSucceeds(deleteDoc(
      doc(asUser(OWNER), "insight_users", OWNER, "circle", FRIEND),
    ));
  });

  it("the circle list is invisible to non-owners — even members", async () => {
    await setupOwner({ friendInCircle: true });
    await assertFails(getDoc(
      doc(asUser(FRIEND), "insight_users", OWNER, "circle", FRIEND),
    ));
    await assertFails(getDocs(
      collection(asUser(STRANGER), "insight_users", OWNER, "circle"),
    ));
  });

  // ── friendRequests ─────────────────────────────────────────────

  it("a stranger can leave a friend request under their own uid", async () => {
    await setupOwner();
    await assertSucceeds(setDoc(
      doc(asUser(STRANGER), "insight_users", OWNER, "friendRequests", STRANGER),
      { at: 1 },
    ));
  });

  it("a blocked user cannot leave a friend request", async () => {
    await setupOwner();
    await seed(async (db) => {
      await setDoc(doc(db, "insight_users", OWNER, "blocks", STRANGER), { at: 1 });
    });
    await assertFails(setDoc(
      doc(asUser(STRANGER), "insight_users", OWNER, "friendRequests", STRANGER),
      { at: 1 },
    ));
  });

  it("either side can delete a pending request (decline or withdraw)", async () => {
    const seedRequest = () => seed(async (db) => {
      await setDoc(doc(db, "insight_users", OWNER, "friendRequests", STRANGER), {
        at: 1,
      });
    });
    await setupOwner();
    await seedRequest();
    await assertSucceeds(deleteDoc(
      doc(asUser(OWNER), "insight_users", OWNER, "friendRequests", STRANGER),
    ));
    await seedRequest();
    await assertSucceeds(deleteDoc(
      doc(asUser(STRANGER), "insight_users", OWNER, "friendRequests", STRANGER),
    ));
  });

  it("the requester sees their pending request; third parties don't", async () => {
    await setupOwner();
    await seed(async (db) => {
      await setDoc(doc(db, "insight_users", OWNER, "friendRequests", STRANGER), {
        at: 1,
      });
    });
    await assertSucceeds(getDoc(
      doc(asUser(STRANGER), "insight_users", OWNER, "friendRequests", STRANGER),
    ));
    await assertFails(getDoc(
      doc(asUser(FRIEND), "insight_users", OWNER, "friendRequests", STRANGER),
    ));
  });

  // ── blocks ─────────────────────────────────────────────────────

  it("the block list is owner-only, both ways", async () => {
    await setupOwner();
    await seed(async (db) => {
      await setDoc(doc(db, "insight_users", OWNER, "blocks", STRANGER), { at: 1 });
    });
    await assertSucceeds(getDoc(
      doc(asUser(OWNER), "insight_users", OWNER, "blocks", STRANGER),
    ));
    await assertSucceeds(setDoc(
      doc(asUser(OWNER), "insight_users", OWNER, "blocks", FRIEND), { at: 2 },
    ));
    // the blocked user can neither see the block nor lift it
    await assertFails(getDoc(
      doc(asUser(STRANGER), "insight_users", OWNER, "blocks", STRANGER),
    ));
    await assertFails(deleteDoc(
      doc(asUser(STRANGER), "insight_users", OWNER, "blocks", STRANGER),
    ));
    await assertFails(setDoc(
      doc(asUser(STRANGER), "insight_users", OWNER, "blocks", FRIEND), { at: 3 },
    ));
  });
});

describe("daily report read tiers", () => {
  const DAY = "2026-07-27";
  const dayRef = (db: Firestore) =>
    doc(db, "insight_users", OWNER, "insight_daily", DAY);

  // Seed a schema-valid report (matches isValidDailyReportWrite) so
  // reads exercise the tier gate, not the validator.
  const seedDaily = () => seed(async (db) => {
    await setDoc(dayRef(db), {
      date: DAY, mood: 60, moodLabel: "fine", one_line: "quiet day",
      weather: "sun", hasPhoto: false, shared: [],
    });
  });
  const follower = (uid: string) => seed(async (db) => {
    await setDoc(doc(db, "insight_users", OWNER, "followers", uid), {
      followedAt: 1,
    });
  });
  // Discoverability docs drive the same-city check; the hash lives
  // at location.geohash and only the first 5 chars are compared.
  const discoverable = (uid: string, geohash: string) => seed(async (db) => {
    await setDoc(doc(db, "insight_discoverable", uid), {
      location: { geohash },
    });
  });

  it("nobody: even a circle friend is refused", async () => {
    await setupOwner({
      friendInCircle: true,
      sharePrefs: { daily_report: "nobody" },
    });
    await seedDaily();
    await assertFails(getDoc(dayRef(asUser(FRIEND))));
  });

  it("circle: friends read; followers and same-city strangers don't", async () => {
    await setupOwner({
      friendInCircle: true,
      sharePrefs: { daily_report: "circle" },
    });
    await seedDaily();
    await follower(STRANGER);
    await assertSucceeds(getDoc(dayRef(asUser(FRIEND))));
    // follower tier only unlocks at "city" and wider
    await assertFails(getDoc(dayRef(asUser(STRANGER))));
    // same city isn't enough either at this level
    await discoverable(OWNER, "u4pruyd");
    await discoverable("neighbor1", "u4pruzz");
    await assertFails(getDoc(dayRef(asUser("neighbor1"))));
  });

  it("city: followers and same-cell discoverable users read; other cities don't", async () => {
    await setupOwner({
      friendInCircle: true,
      sharePrefs: { daily_report: "city" },
    });
    await seedDaily();
    // follower path
    await follower("fan1");
    await assertSucceeds(getDoc(dayRef(asUser("fan1"))));
    // same geohash5 cell ("u4pru…" == "u4pru…"), both discoverable
    await discoverable(OWNER, "u4pruyd");
    await discoverable("neighbor1", "u4pruzz");
    await assertSucceeds(getDoc(dayRef(asUser("neighbor1"))));
    // different cell → refused
    await discoverable("tourist1", "gcpvj0d");
    await assertFails(getDoc(dayRef(asUser("tourist1"))));
    // circle friends keep reading at the wider level
    await assertSucceeds(getDoc(dayRef(asUser(FRIEND))));
  });

  it("world: any signed-in user reads; anonymous never does", async () => {
    await setupOwner({ sharePrefs: { daily_report: "world" } });
    await seedDaily();
    await assertSucceeds(getDoc(dayRef(asUser(STRANGER))));
    await assertFails(getDoc(dayRef(asAnon())));
  });

  it("a blocked viewer is refused even at world — block beats every tier", async () => {
    await setupOwner({
      friendInCircle: true,
      friendBlocked: true,
      sharePrefs: { daily_report: "world" },
    });
    await seedDaily();
    await assertFails(getDoc(dayRef(asUser(FRIEND))));
  });
});

describe("share defaults pinned", () => {
  // With EMPTY sharePrefs the rules fall back to collShareDefault(),
  // which mirrors SHARE_DATA's `def` in the UI. These pin that the
  // two stay in sync: weigh-ins / dreams / homes / time blocks
  // default to "nobody"; books default to "world".

  const seedOneDocEach = () => seed(async (db) => {
    for (const coll of [
      "insight_weighins", "insight_dreams", "insight_homes",
      "insight_time_blocks", "insight_books",
    ]) {
      await setDoc(doc(db, "insight_users", OWNER, coll, "d1"), { ok: true });
    }
  });

  it("private-by-default collections stay closed to circle friends", async () => {
    await setupOwner({ friendInCircle: true });
    await seedOneDocEach();
    for (const coll of [
      "insight_weighins", "insight_dreams", "insight_homes", "insight_time_blocks",
    ]) {
      await assertFails(
        getDocs(collection(asUser(FRIEND), "insight_users", OWNER, coll)),
      );
    }
  });

  it("books default to world — readable by a circle friend with no prefs set", async () => {
    await setupOwner({ friendInCircle: true });
    await seedOneDocEach();
    await assertSucceeds(
      getDocs(collection(asUser(FRIEND), "insight_users", OWNER, "insight_books")),
    );
  });

  it("the world default still requires circle membership — strangers are refused", async () => {
    // circleCanRead() gates on isInOwnerCircle() before it ever looks
    // at the level, so "world" here means "world of mutuals", not
    // actually-anyone.
    await setupOwner();
    await seedOneDocEach();
    await assertFails(
      getDocs(collection(asUser(STRANGER), "insight_users", OWNER, "insight_books")),
    );
  });
});

describe("v2 groups + sealed duels (Phase 3)", () => {
  const GID = "g1";
  const DAY = "2026-07-26";
  const seedGroup = (members: string[] = [OWNER, FRIEND]) => seed(async (db) => {
    await setDoc(doc(db, "v2_groups", GID), {
      name: "The Crew", mode: "duo", ownerUid: OWNER,
      memberUids: members, inviteCode: "ABCD2345", streak: 0,
    });
    await setDoc(doc(db, "v2_questions", "group-gu0"), {
      surface: "group", seq: 0, type: "choice", prompt: "?",
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

  it("reveals are member-readable, never client-writable", async () => {
    await seedGroup();
    await seed(async (db) => {
      await setDoc(doc(db, "v2_groups", GID, "reveals", DAY), {
        day: DAY, qid: "group-gu0",
        votes: { [OWNER]: { optionIdx: 1 }, [FRIEND]: { optionIdx: 2 } },
        names: {},
      });
    });
    await assertSucceeds(getDoc(doc(asUser(FRIEND), "v2_groups", GID, "reveals", DAY)));
    await assertFails(getDoc(doc(asUser(STRANGER), "v2_groups", GID, "reveals", DAY)));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_groups", GID, "reveals", "2026-07-27"),
      { votes: {} }));
  });
});

describe("impression share carve-out", () => {
  // Read tiers on insight_inbound_impressions driven by the
  // recipient's `shareImpressionsAbout` profile field (read via
  // ownerShareImpressionsAbout(), defaulting to "nobody").
  const IMP = "imp1";
  const FOLLOWER = "follower1";
  const impRef = (db: Firestore) =>
    doc(db, "insight_users", OWNER, "insight_inbound_impressions", IMP);

  // Seed OWNER's profile (optionally with a share tier), one
  // impression sent by STRANGER, and the viewer relations.
  const setupImpressions = (opts: {
    share?: string;
    friendInCircle?: boolean;
    follower?: boolean;
    blockedViewer?: string;
  } = {}) => seed(async (db) => {
    await setDoc(doc(db, "insight_users", OWNER), {
      sharePrefs: {},
      ...(opts.share ? { shareImpressionsAbout: opts.share } : {}),
    });
    await setDoc(impRef(db), {
      senderUid: STRANGER, traits: ["kind"], createdAt: 1,
    });
    if (opts.friendInCircle) {
      await setDoc(doc(db, "insight_users", OWNER, "circle", FRIEND), {
        since: 2026,
      });
    }
    if (opts.follower) {
      await setDoc(doc(db, "insight_users", OWNER, "followers", FOLLOWER), {
        followedAt: 1,
      });
    }
    if (opts.blockedViewer) {
      await setDoc(doc(db, "insight_users", OWNER, "blocks", opts.blockedViewer), {
        at: 1,
      });
    }
  });

  it("default (field absent) — only the recipient reads", async () => {
    await setupImpressions({ friendInCircle: true, follower: true });
    await assertSucceeds(getDoc(impRef(asUser(OWNER))));
    await assertFails(getDoc(impRef(asUser(FRIEND))));
    await assertFails(getDoc(impRef(asUser(FOLLOWER))));
    await assertFails(getDoc(impRef(asUser(STRANGER))));
  });

  it("circle: circle friend reads; follower and stranger are denied", async () => {
    await setupImpressions({
      share: "circle", friendInCircle: true, follower: true,
    });
    await assertSucceeds(getDoc(impRef(asUser(FRIEND))));
    await assertFails(getDoc(impRef(asUser(FOLLOWER))));
    await assertFails(getDoc(impRef(asUser(STRANGER))));
  });

  it("nearby: follower AND circle friend read; stranger is denied", async () => {
    await setupImpressions({
      share: "nearby", friendInCircle: true, follower: true,
    });
    await assertSucceeds(getDoc(impRef(asUser(FOLLOWER))));
    await assertSucceeds(getDoc(impRef(asUser(FRIEND))));
    await assertFails(getDoc(impRef(asUser(STRANGER))));
  });

  it("anyone: any signed-in user reads; anon and blocked viewers don't", async () => {
    await setupImpressions({ share: "anyone", blockedViewer: "viewer2" });
    await assertSucceeds(getDoc(impRef(asUser(STRANGER))));
    await assertFails(getDoc(impRef(asAnon())));
    // block beats the widest tier
    await assertFails(getDoc(impRef(asUser("viewer2"))));
  });

  it("the sender can delete their own impression; unrelated users can't; recipient always can", async () => {
    // senderUid: STRANGER stamped admin-side (mirrors the callable).
    await setupImpressions({ friendInCircle: true });
    await assertFails(deleteDoc(impRef(asUser(FRIEND))));
    await assertSucceeds(deleteDoc(impRef(asUser(STRANGER))));
    // re-seed, recipient deletes too
    await setupImpressions();
    await assertSucceeds(deleteDoc(impRef(asUser(OWNER))));
  });

  it("impressions are immutable — updates denied for everyone, recipient and sender included", async () => {
    await setupImpressions({ share: "anyone", friendInCircle: true });
    for (const uid of [OWNER, STRANGER, FRIEND]) {
      await assertFails(updateDoc(impRef(asUser(uid)), { traits: ["forged"] }));
    }
  });
});

describe("discoverable write validation", () => {
  const mine = () => doc(asUser(OWNER), "insight_discoverable", OWNER);
  const base = { location: { geohash: "u4pru" }, displayName: null };

  it("accepts the canonical shape — geohash5 + explicit-null displayName", async () => {
    await assertSucceeds(setDoc(mine(), base));
  });

  it("accepts a shorter (coarser) geohash", async () => {
    await assertSucceeds(setDoc(mine(), {
      ...base, location: { geohash: "u4p" },
    }));
  });

  it("rejects a geohash longer than 5 chars — no full-precision leaks", async () => {
    await assertFails(setDoc(mine(), {
      ...base, location: { geohash: "u4pruy" },
    }));
    await assertFails(setDoc(mine(), {
      ...base, location: { geohash: "u4pruyd8k" },
    }));
  });

  it("rejects a location carrying an exact GeoPoint next to the hash", async () => {
    await assertFails(setDoc(mine(), {
      ...base,
      location: { geohash: "u4pru", geopoint: new GeoPoint(59.91, 10.75) },
    }));
  });

  it("rejects a location missing the geohash", async () => {
    await assertFails(setDoc(mine(), { ...base, location: {} }));
    await assertFails(setDoc(mine(), {
      ...base, location: { geopoint: new GeoPoint(59.91, 10.75) },
    }));
    // no location at all fails too — geohash is the one required field
    await assertFails(setDoc(mine(), { displayName: "Mira" }));
  });

  it("only the owner writes their discoverable doc", async () => {
    await assertFails(setDoc(
      doc(asUser(STRANGER), "insight_discoverable", OWNER), base,
    ));
    await assertFails(setDoc(
      doc(asAnon(), "insight_discoverable", OWNER), base,
    ));
  });

  it("rejects a personality vector that isn't exactly 5 numbers", async () => {
    await assertFails(setDoc(mine(), {
      ...base, personality: [50, 50, 50, 50, 50, 50],
    }));
    await assertSucceeds(setDoc(mine(), {
      ...base, personality: [50, 50, 50, 50, 50],
    }));
  });

  it("rejects out-of-range age and off-enum gender", async () => {
    await assertFails(setDoc(mine(), { ...base, age: 5 }));
    await assertFails(setDoc(mine(), { ...base, gender: "alien" }));
    await assertSucceeds(setDoc(mine(), {
      ...base, age: 30, gender: "non-binary",
    }));
  });

  it("rejects unknown top-level fields (world-readable doc, closed schema)", async () => {
    // The validator ends with a doc-level keys().hasOnly([...]) —
    // without it, any unvalidated key on this world-readable doc is
    // a free public storage channel.
    await assertFails(setDoc(mine(), { ...base, unrecognizedField: "x" }));
    // and the validated shape still passes
    await assertSucceeds(setDoc(mine(), { ...base }));
  });
});

describe("storage-adjacent + leftovers", () => {
  it("Cities catalogue: signed-in read only, never client-written", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "Cities", "oslo"), {
        name: "Oslo", geohash: "u4pru", lat: 59.91, lng: 10.75,
      });
    });
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "Cities", "oslo")));
    await assertFails(getDoc(doc(asAnon(), "Cities", "oslo")));
    await assertFails(setDoc(doc(asUser(OWNER), "Cities", "oslo"), { name: "Forged" }));
    await assertFails(deleteDoc(doc(asUser(OWNER), "Cities", "oslo")));
  });

  it("discoverable docs are readable by any signed-in user, not anon", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "insight_discoverable", OWNER), {
        location: { geohash: "u4pru" },
      });
    });
    await assertSucceeds(getDoc(doc(asUser(STRANGER), "insight_discoverable", OWNER)));
    await assertFails(getDoc(doc(asAnon(), "insight_discoverable", OWNER)));
  });

  it("v2_meta is signed-in read-only; v2_ratelimits is fully opaque", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_meta", "content"), { contentRev: 3 });
      await setDoc(doc(db, "v2_ratelimits", OWNER), { events: [] });
    });
    await assertSucceeds(getDoc(doc(asUser(OWNER), "v2_meta", "content")));
    await assertFails(getDoc(doc(asAnon(), "v2_meta", "content")));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_meta", "content"), { contentRev: 99 }));
    await assertFails(getDoc(doc(asUser(OWNER), "v2_ratelimits", OWNER)));
    await assertFails(setDoc(doc(asUser(OWNER), "v2_ratelimits", OWNER), { events: [] }));
  });

  // ── insight_interest_items + votes subdoc ────────────────────────

  const item = (over: Record<string, unknown> = {}) => ({
    interestSlug: "hiking", type: "media", name: "Wild",
    voteCount: 0, createdBy: OWNER, ...over,
  });
  const seedItem = () => seed(async (db) => {
    await setDoc(doc(db, "insight_interest_items", "it1"), item({ voteCount: 3 }));
  });

  it("interest items: schema-checked create; forged author/score rejected", async () => {
    const ref = doc(asUser(OWNER), "insight_interest_items", "it1");
    await assertSucceeds(setDoc(ref, item()));
    await assertFails(setDoc(doc(asUser(OWNER), "insight_interest_items", "it2"),
      item({ type: "malware" })));                    // off-enum type
    await assertFails(setDoc(doc(asUser(OWNER), "insight_interest_items", "it3"),
      item({ voteCount: 9000 })));                    // must start at 0
    await assertFails(setDoc(doc(asUser(OWNER), "insight_interest_items", "it4"),
      item({ createdBy: STRANGER })));                // createdBy must be auth uid
    await assertFails(setDoc(doc(asUser(OWNER), "insight_interest_items", "it5"),
      item({ name: "" })));                           // empty name
    await assertFails(setDoc(doc(asAnon(), "insight_interest_items", "it6"), item()));
  });

  it("interest items: updates are voteCount ±1 only, everything else frozen", async () => {
    await seedItem();
    const ref = doc(asUser(STRANGER), "insight_interest_items", "it1");
    await assertSucceeds(updateDoc(ref, { voteCount: 4 }));  // +1
    await assertSucceeds(updateDoc(ref, { voteCount: 3 }));  // -1
    await assertFails(updateDoc(ref, { voteCount: 5 }));     // +2 jump
    await assertFails(updateDoc(ref, { voteCount: 4, name: "Renamed" }));
    await assertFails(updateDoc(ref, { name: "Renamed" }));
  });

  it("interest items: only the creator deletes", async () => {
    await seedItem();
    await assertFails(deleteDoc(doc(asUser(STRANGER), "insight_interest_items", "it1")));
    await assertSucceeds(deleteDoc(doc(asUser(OWNER), "insight_interest_items", "it1")));
  });

  it("votes subdoc: self-vote only, immutable, self-read, self-delete", async () => {
    await seedItem();
    const vote = (asUid: string, voterUid: string) =>
      doc(asUser(asUid), "insight_interest_items", "it1", "votes", voterUid);
    await assertSucceeds(setDoc(vote(FRIEND, FRIEND), { at: 1 }));
    await assertFails(setDoc(vote(STRANGER, FRIEND), { at: 1 }));   // vote as someone else
    await assertFails(updateDoc(vote(FRIEND, FRIEND), { at: 2 })); // immutable
    await assertSucceeds(getDoc(vote(FRIEND, FRIEND)));
    await assertFails(getDoc(vote(STRANGER, FRIEND)));              // others' votes invisible
    await assertSucceeds(deleteDoc(vote(FRIEND, FRIEND)));          // un-vote
  });

  it("profile validator: impression tier fields are closed sets", async () => {
    await setupOwner();
    const mine = doc(asUser(OWNER), "insight_users", OWNER);
    await assertSucceeds(setDoc(mine, {
      acceptImpressionsFrom: "nearby", shareImpressionsAbout: "circle",
    }));
    await assertFails(setDoc(mine, { acceptImpressionsFrom: "everyone" }));
    await assertFails(setDoc(mine, { shareImpressionsAbout: "public" }));
  });
});

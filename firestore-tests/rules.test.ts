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

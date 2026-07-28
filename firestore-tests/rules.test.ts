// Firestore security-rules tests. Run against the emulator:
//   npm run test:rules
// (which wraps `firebase emulators:exec --only firestore "vitest run …"`).
//
// These lock down the access decisions the product's privacy claims rest
// on: what the default (anonymous) user can reach, owner-only create-only
// answers, k-floored aggregates whose exact counts stay server-side,
// member-only groups, duel answers sealed until a reveal doc exists, and
// the retired v1 surface staying closed. They sit outside src/ so the app
// build never compiles them.

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
  collectionGroup,
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
// No token at all. Note this is NOT the app's default user — see below.
const asSignedOut = (): Firestore => env.unauthenticatedContext().firestore();

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
  env.authenticatedContext(uid, {
    firebase: { sign_in_provider: "anonymous" },
  }).firestore();

// What an attacker gets for free. Every assertion here is reachable with a
// scripted anonymous sign-in and no further access — so this describe is the
// honest inventory of the app's outer trust boundary, and the place to look
// when deciding whether a new `request.auth != null` grant is safe.
describe("the default user (anonymous auth) — reachable surface", () => {
  it("cannot read another user's v2 answers, profile, or private aggregates", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "v2_users", OWNER), { displayName: "Owner" });
      await setDoc(doc(db, "v2_users", OWNER, "answers", "daily-000"), {
        qid: "daily-000", surface: "daily", optionIdx: 1,
      });
      await setDoc(doc(db, "v2_aggs_private", "daily-000"), { counts: { "0": 3 } });
    });
    const db = asAnonAuth();
    await assertFails(getDoc(doc(db, "v2_users", OWNER, "answers", "daily-000")));
    await assertFails(getDoc(doc(db, "v2_users", OWNER)));
    await assertFails(getDoc(doc(db, "v2_aggs_private", "daily-000")));
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
    const DAY = "2026-07-20";
    await seed(async (db) => {
      await setDoc(doc(db, "v2_questions", "group-pick0"), {
        surface: "group", seq: 0, type: "pick", prompt: "Who?", options: [],
      });
      await setDoc(doc(db, "v2_groups", GID), {
        name: "Big", mode: "group", memberUids: members,
      });
    });
    const aid = `g_${GID}_${DAY}`;
    const duel = (idx: number) => ({
      qid: "group-pick0", surface: "group", optionIdx: idx,
      gid: GID, day: DAY, answeredAt: serverTimestamp(), anchors: {},
    });
    await assertSucceeds(setDoc(
      doc(asUser("m0"), "v2_users", "m0", "answers", aid), duel(31)));
    // still bounded by the member count
    await assertFails(setDoc(
      doc(asUser("m1"), "v2_users", "m1", "answers", aid), duel(32)));
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

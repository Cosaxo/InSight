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
  type RulesTestContext,
} from "@firebase/rules-unit-testing";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
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

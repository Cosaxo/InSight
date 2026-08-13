// Firebase Storage security-rules tests. Run against the emulator via
//   npm run test:rules
// (which starts the storage emulator alongside firestore).
//
// storage.rules was configured in firebase.json, committed, and never
// deployed by anything — and never tested either. Its three gates
// (owner-only path match, 8MB cap, image content-type) plus the catch-all
// deny had zero coverage. These pin them.
//
// Note on scope: the only path it grants, users/{uid}/dailyPhotos/, backed
// the v1 daily-report photo backup, a surface removed in D4. The grant is
// kept rather than reduced to a catch-all deny until the bucket is
// confirmed empty — deleteAccount does not touch Storage, so revoking
// access to objects that still exist would create an erasure gap rather
// than close a hole. See docs/SHIP-CHECKLIST.md.
//
// UPLOADS ARE NOW CLOSED (2026-08-13), and the split is why this file
// changed shape. The erasure argument above is about READ and DELETE — a
// v1 user reaching a leftover object to remove it — and says nothing about
// accepting new bytes. The write half was the project's only unbounded
// egress surface: any anonymous account (D3 makes those free) could store
// 8 MB per object with `{filename}` unbounded, so unbounded objects and
// unbounded bytes to read back, against a docs/COSTS.md line that bills
// Storage at "$0 (bucket unused)". Nothing in src/ or functions/src
// imports firebase/storage at all, so no feature loses anything.
//
// The two suites below are therefore asymmetric on purpose: reads and
// deletes keep their positive cases, uploads keep only negative ones.

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
  ref,
  uploadBytes,
  getBytes,
  deleteObject,
  type FirebaseStorage,
} from "firebase/storage";

const __dirname = dirname(fileURLToPath(import.meta.url));

const OWNER = "owner1";
const STRANGER = "stranger1";

const JPEG = { contentType: "image/jpeg" };
const small = () => new Uint8Array(16);

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "insight-rules-test",
    storage: {
      rules: readFileSync(resolve(__dirname, "../storage.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearStorage();
});

const asUser = (uid: string): FirebaseStorage =>
  env.authenticatedContext(uid).storage();
const asSignedOut = (): FirebaseStorage =>
  env.unauthenticatedContext().storage();

// The app is anonymous-first (D3), so "signed in" is a free account.
const asAnonAuth = (uid = "anon1"): FirebaseStorage =>
  env.authenticatedContext(uid, {
    firebase: { sign_in_provider: "anonymous" },
  }).storage();

const photo = (storage: FirebaseStorage, uid: string, name = "a.jpg") =>
  ref(storage, `users/${uid}/dailyPhotos/${name}`);

describe("storage: owner-only daily photos", () => {
  it("the owner reads their own leftover photo", async () => {
    // Seeded out-of-band now, because the owner can no longer put it there
    // themselves — which is the whole change. Read still works, so the
    // erasure path this grant exists for is intact.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(photo(ctx.storage(), OWNER), small(), JPEG);
    });
    await assertSucceeds(getBytes(photo(asUser(OWNER), OWNER)));
  });

  it("nobody else can read, overwrite or delete it", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(photo(ctx.storage(), OWNER), small(), JPEG);
    });
    await assertFails(getBytes(photo(asUser(STRANGER), OWNER)));
    await assertFails(uploadBytes(photo(asUser(STRANGER), OWNER), small(), JPEG));
    await assertFails(deleteObject(photo(asUser(STRANGER), OWNER)));
    // and the default user — a free anonymous account — is no different
    await assertFails(getBytes(photo(asAnonAuth(), OWNER)));
    await assertFails(getBytes(photo(asSignedOut(), OWNER)));
  });

  it("the owner can delete their own photo", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(photo(ctx.storage(), OWNER), small(), JPEG);
    });
    await assertSucceeds(deleteObject(photo(asUser(OWNER), OWNER)));
  });
});

describe("storage: uploads are closed", () => {
  // These used to assert the 8MB cap and the image/* content-type gate.
  // Both are gone with the write grant, and asserting them here would now
  // be asserting a bound on something that cannot happen — so the cases
  // become "no upload succeeds", which is the stronger claim and the one
  // the cost argument actually rests on. A valid small JPEG is the case
  // that matters: if THAT fails, nothing weaker gets through.
  it("the owner cannot upload, even a valid small image", async () => {
    await assertFails(uploadBytes(photo(asUser(OWNER), OWNER, "ok.jpg"), small(), JPEG));
  });

  it("the owner cannot overwrite an object that already exists", async () => {
    // update is the same verb as create here; a rule that closed create and
    // left update open would leave the bytes-per-object term unbounded even
    // with the object COUNT fixed.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(photo(ctx.storage(), OWNER), small(), JPEG);
    });
    await assertFails(uploadBytes(photo(asUser(OWNER), OWNER), small(), JPEG));
  });

  it("a free anonymous account cannot upload under its own uid", async () => {
    // The version that actually costs money: D3 mints one of these on first
    // open, so "signed in" is not a scarcity of any kind.
    await assertFails(uploadBytes(photo(asAnonAuth("anon2"), "anon2"), small(), JPEG));
  });

  it("an 8MB-plus upload fails too — now by the grant, not by the cap", async () => {
    const tooBig = new Uint8Array(8 * 1024 * 1024 + 1);
    await assertFails(uploadBytes(photo(asUser(OWNER), OWNER, "big.jpg"), tooBig, JPEG));
  });
});

describe("storage: catch-all deny", () => {
  it("denies every path outside the granted one", async () => {
    const paths = [
      `users/${OWNER}/other/a.jpg`,
      `users/${OWNER}/dailyPhotos/nested/a.jpg`, // {filename} is one segment
      "public/a.jpg",
      "a.jpg",
    ];
    for (const p of paths) {
      const db = asUser(OWNER);
      await assertFails(uploadBytes(ref(db, p), small(), JPEG));
      await assertFails(getBytes(ref(db, p)));
    }
  });
});

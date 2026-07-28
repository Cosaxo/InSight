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
  it("the owner uploads and reads their own photo", async () => {
    await assertSucceeds(uploadBytes(photo(asUser(OWNER), OWNER), small(), JPEG));
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

describe("storage: upload validation", () => {
  it("rejects a non-image content type", async () => {
    await assertFails(uploadBytes(
      photo(asUser(OWNER), OWNER, "not-a-photo.jpg"),
      small(),
      { contentType: "application/pdf" },
    ));
  });

  it("rejects an upload over the 8MB cap", async () => {
    const tooBig = new Uint8Array(8 * 1024 * 1024 + 1);
    await assertFails(uploadBytes(photo(asUser(OWNER), OWNER, "big.jpg"), tooBig, JPEG));
  });

  it("accepts a large-but-under-cap image", async () => {
    const justUnder = new Uint8Array(8 * 1024 * 1024 - 1024);
    await assertSucceeds(uploadBytes(photo(asUser(OWNER), OWNER, "ok.jpg"), justUnder, JPEG));
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

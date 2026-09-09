// Firebase Storage security-rules tests. Run against the emulator via
//   npm run test:rules
// (which starts the storage emulator alongside firestore).
//
// storage.rules was configured in firebase.json, committed, and never
// deployed by anything — and never tested either. Its three gates
// (owner-only path match, 256 KB cap, image content-type) plus the
// catch-all deny had zero coverage. These pin them.
//
// The cap read "8MB" here until 2026-09-02, which was the retired
// dailyPhotos number — stranded by the same 2026-08-27 sweep this header
// describes two paragraphs down. The file's own cases had used 300 KB and
// 200 KB against a 256 KB rule the whole time. `check:figures` holds the
// sentence to the rule now, so it cannot go stale again quietly.
//
// Note on scope: users/{uid}/dailyPhotos/ — the v1 daily-report backup,
// a surface removed in D4 — carried a read/delete grant here until
// 2026-08-27. The grant existed for erasure: deleteAccount reaches
// `avatars/{uid}` and nothing else (D178), so a v1 user's only path to a
// leftover photo was their own read/delete. On 2026-08-27 the bucket was
// measured and emptied FIRST (117 legacy objects, none under dailyPhotos/)
// and the grant removed second — runbook 5.4's order, kept because
// reversing it converts a dead feature into an erasure gap (D333).
//
// The retired-path suite below therefore asserts total denial now, owner
// included: with the bucket empty there is no object left for the old
// grant to be about, and an access grant whose objects cannot exist is
// only a surface. Uploads were already closed on 2026-08-13 — that half
// simply extends to read and delete.

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

const avatar = (storage: FirebaseStorage, uid: string) =>
  ref(storage, `avatars/${uid}`);
const bytes = (n: number) => new Uint8Array(n);

// ── the profile photo (D178) ─────────────────────────────────────────
//
// The first path in this bucket a stranger may read, and the first the app
// actually writes to since D4 closed the v1 one. Three properties carry
// it, and each is a case below: the object id is FIXED (so the count is
// bounded by accounts, not by uploads — the failure the retired path
// records), only the owner writes it, and the bytes are capped and typed.
describe("storage: the profile photo (D178)", () => {
  it("the owner uploads their own, and anyone signed in may see it", async () => {
    await assertSucceeds(uploadBytes(avatar(asUser(OWNER), OWNER), small(), JPEG));
    // The grant that is new here. A face is readable by strangers because
    // every surface that draws it already names the person beside it.
    await assertSucceeds(getBytes(avatar(asUser(STRANGER), OWNER)));
    await assertSucceeds(getBytes(avatar(asAnonAuth(), OWNER)));
  });

  it("but not by the signed-out world", async () => {
    // The bucket is not a public CDN. Signed-in is the floor everywhere
    // else in this app and it is the floor here.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(avatar(ctx.storage(), OWNER), small(), JPEG);
    });
    await assertFails(getBytes(avatar(asSignedOut(), OWNER)));
  });

  it("nobody can write or delete somebody else's face", async () => {
    // The obvious attack on a photo shown to strangers in a room: replace
    // theirs with something that gets THEM reported.
    await assertFails(uploadBytes(avatar(asUser(STRANGER), OWNER), small(), JPEG));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(avatar(ctx.storage(), OWNER), small(), JPEG);
    });
    await assertFails(deleteObject(avatar(asUser(STRANGER), OWNER)));
    await assertFails(uploadBytes(avatar(asUser(STRANGER), OWNER), small(), JPEG));
  });

  it("the owner replaces and removes their own", async () => {
    // Overwrite is the ONLY way to change a photo, and that is the point:
    // a fixed object id means a second upload replaces the first rather
    // than adding to a pile nobody counts.
    await assertSucceeds(uploadBytes(avatar(asUser(OWNER), OWNER), small(), JPEG));
    await assertSucceeds(uploadBytes(avatar(asUser(OWNER), OWNER), bytes(64), JPEG));
    await assertSucceeds(deleteObject(avatar(asUser(OWNER), OWNER)));
  });

  it("caps the bytes and the type, because this is the app's only egress", async () => {
    // The uploader downscales and re-encodes long before this, so the cap
    // is the backstop for a modified client. It is small on purpose: a
    // room of two dozen faces reads two dozen objects, and this is the
    // only path in the project that serves bytes at all.
    await assertFails(uploadBytes(avatar(asUser(OWNER), OWNER), bytes(300 * 1024), JPEG));
    await assertSucceeds(uploadBytes(avatar(asUser(OWNER), OWNER), bytes(200 * 1024), JPEG));
    await assertFails(uploadBytes(avatar(asUser(OWNER), OWNER), small(),
      { contentType: "application/pdf" }));
    await assertFails(uploadBytes(avatar(asUser(OWNER), OWNER), small(),
      { contentType: "image/svg+xml" }));
  });
});

describe("storage: the retired v1 path is fully closed (D333)", () => {
  it("the owner can no longer read or delete under dailyPhotos", async () => {
    // The positive halves of these two lived here from 2026-08-13 to
    // 2026-08-27 as the erasure path for leftover v1 objects. The bucket
    // was measured empty before the grant came out, so an object for this
    // read to reach can only be seeded by the test itself.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(photo(ctx.storage(), OWNER), small(), JPEG);
    });
    await assertFails(getBytes(photo(asUser(OWNER), OWNER)));
    await assertFails(deleteObject(photo(asUser(OWNER), OWNER)));
  });

  it("nobody else can either", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(photo(ctx.storage(), OWNER), small(), JPEG);
    });
    await assertFails(getBytes(photo(asUser(STRANGER), OWNER)));
    await assertFails(deleteObject(photo(asUser(STRANGER), OWNER)));
    // and the default user — a free anonymous account — is no different
    await assertFails(getBytes(photo(asAnonAuth(), OWNER)));
    await assertFails(getBytes(photo(asSignedOut(), OWNER)));
  });

  it("uploads stay closed, small and valid included", async () => {
    // Closed since 2026-08-13, when the write grant was the project's only
    // unbounded-egress surface. A valid small JPEG is the case that
    // matters: if THAT fails, nothing weaker gets through.
    await assertFails(uploadBytes(photo(asUser(OWNER), OWNER, "ok.jpg"), small(), JPEG));
    await assertFails(uploadBytes(photo(asAnonAuth("anon2"), "anon2"), small(), JPEG));
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

// asc-push.test.mjs — exercise scripts/asc-push.mjs against a stub API.
//
// WHY A STUB. This script's only real target is the owner's live App Store
// listing. There is no sandbox account, and the first real run would be
// against the thing it could damage — so the alternative to a stub here is
// shipping the request shapes unverified, which is how the previous version
// of this file shipped (verified once by hand, against a stub that was never
// committed, and therefore never run again).
//
// What the stub proves: the JWT is well-formed and ES256, the right version
// is chosen, fields land on the right resource, --apply gates every write,
// and the privacy reconciliation adds and deletes the correct rows. What it
// cannot prove: that Apple accepts these shapes. That is stated in
// docs/STORE-FORMS.md rather than implied by a green test.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(root, "scripts/asc-push.mjs");

// A real EC P-256 key, generated per run. Using a fixture would mean
// committing something shaped exactly like a credential.
const { privateKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const APP_ID = "app-1";
const VERSION_ID = "ver-1";
const DECL_ID = "decl-1";

let server, base, received;

/** Rows the stub pretends App Store Connect already has. */
let existingUsages = [];
/** Age-rating attributes the stub pretends are already set. */
let existingRating = {};

function json(res, body) {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      received.push({
        method: req.method,
        path: url.pathname,
        auth: req.headers.authorization,
        body: body ? JSON.parse(body) : null,
      });

      if (url.pathname === "/v1/apps") {
        return json(res, { data: [{ id: APP_ID, attributes: { name: "InSight" } }] });
      }
      if (url.pathname === `/v1/apps/${APP_ID}/appStoreVersions`) {
        return json(res, {
          data: [
            // A live version FIRST, to prove the editable one is chosen by
            // state rather than by position.
            { id: "ver-live", attributes: { appStoreState: "READY_FOR_SALE" }, relationships: {} },
            {
              id: VERSION_ID,
              attributes: { appStoreState: "PREPARE_FOR_SUBMISSION" },
              relationships: {
                ageRatingDeclaration: { data: { type: "ageRatingDeclarations", id: DECL_ID } },
              },
            },
          ],
        });
      }
      if (url.pathname === `/v1/apps/${APP_ID}/appInfos`) {
        return json(res, { data: [{ id: "info-1" }] });
      }
      if (url.pathname === "/v1/appInfos/info-1/appInfoLocalizations") {
        return json(res, {
          data: [{ id: "iloc-1", attributes: { locale: "en-US", name: "Old Name" } }],
        });
      }
      if (url.pathname === `/v1/appStoreVersions/${VERSION_ID}/appStoreVersionLocalizations`) {
        return json(res, {
          data: [{ id: "vloc-1", attributes: { locale: "en-US", description: "Old desc" } }],
        });
      }
      if (url.pathname === `/v1/ageRatingDeclarations/${DECL_ID}`) {
        return json(res, { data: { id: DECL_ID, attributes: existingRating } });
      }
      if (url.pathname === `/v1/apps/${APP_ID}/appDataUsages`) {
        return json(res, { data: existingUsages });
      }
      // Writes: PATCH / POST / DELETE all just succeed.
      return json(res, { data: {} });
    });
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server?.close());

async function push(args) {
  received = [];
  const { stdout } = await run("node", [SCRIPT, ...args], {
    env: {
      ...process.env,
      ASC_API_BASE: base,
      ASC_KEY_ID: "ABC1234567",
      ASC_ISSUER_ID: "11111111-2222-3333-4444-555555555555",
      ASC_PRIVATE_KEY: privateKey,
    },
  });
  return stdout;
}

const writes = () => received.filter((r) => r.method !== "GET");

describe("asc-push auth", () => {
  it("signs an ES256 JWT with the key id in the header", async () => {
    await push([]);
    const token = received[0].auth.replace("Bearer ", "");
    const [h, p, sig] = token.split(".");
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const payload = JSON.parse(Buffer.from(p, "base64url").toString());

    expect(header).toMatchObject({ alg: "ES256", kid: "ABC1234567", typ: "JWT" });
    expect(payload.aud).toBe("appstoreconnect-v1");
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(1200); // Apple's cap

    // The bug this pins: node's default EC signature is DER, which Apple
    // rejects with an error that reads like a wrong key. JOSE wants raw
    // r||s — 64 bytes for P-256.
    expect(Buffer.from(sig, "base64url")).toHaveLength(64);
  });
});

describe("asc-push text", () => {
  it("is a dry run without --apply", async () => {
    const out = await push([]);
    expect(out).toMatch(/would be made/);
    expect(out).toMatch(/\[DRY RUN\]/);
    expect(writes()).toHaveLength(0);
  });

  it("splits app-level and version-level fields onto the right resources", async () => {
    await push(["--apply"]);
    const byPath = Object.fromEntries(writes().map((w) => [w.path, w.body.data.attributes]));

    // name belongs to the app and survives versions; description belongs to
    // the version. Sending either to the other is a 409 that reads like a
    // permissions problem.
    expect(byPath["/v1/appInfoLocalizations/iloc-1"]).toHaveProperty("name");
    expect(byPath["/v1/appInfoLocalizations/iloc-1"]).not.toHaveProperty("description");
    expect(byPath["/v1/appStoreVersionLocalizations/vloc-1"]).toHaveProperty("description");
    expect(byPath["/v1/appStoreVersionLocalizations/vloc-1"]).not.toHaveProperty("name");
  });

  it("picks the editable version, not the live one", async () => {
    await push(["--apply"]);
    expect(received.some((r) => r.path.includes("ver-live"))).toBe(false);
  });
});

describe("asc-push age rating", () => {
  it("patches only the values that differ, and strips $-commentary", async () => {
    existingRating = { violenceCartoonOrFantasy: "NONE", gambling: true };
    const out = await push(["--age-rating", "--apply"]);

    const patch = writes().find((w) => w.path === `/v1/ageRatingDeclarations/${DECL_ID}`);
    const attrs = patch.body.data.attributes;

    expect(Object.keys(attrs).some((k) => k.startsWith("$"))).toBe(false);
    // Already NONE upstream, so it is not resent.
    expect(attrs).not.toHaveProperty("violenceCartoonOrFantasy");
    // Differs upstream, so it is corrected.
    expect(attrs.gambling).toBe(false);
    expect(out).toMatch(/ageRating\.gambling/);
  });

  it("does not touch listing text when only the rating was asked for", async () => {
    existingRating = {};
    await push(["--age-rating", "--apply"]);
    expect(writes().every((w) => !w.path.includes("Localizations"))).toBe(true);
  });
});

describe("asc-push privacy label", () => {
  it("adds the declared rows and removes ones the repo does not declare", async () => {
    // An over-declaration Apple holds and app-privacy.json does not: the
    // failure mode the form itself cannot show you, because it renders what
    // is there and never what should not be.
    existingUsages = [{
      id: "stale-1",
      relationships: {
        category: { data: { id: "LOCATION.PRECISE_LOCATION" } },
        dataProtections: { data: [{ id: "DATA_LINKED_TO_YOU" }] },
        purposes: { data: [{ id: "APP_FUNCTIONALITY" }] },
      },
    }];

    const out = await push(["--privacy", "--apply"]);

    expect(out).toMatch(/REMOVE LOCATION\|PRECISE_LOCATION/);
    expect(writes().some((w) => w.method === "DELETE" && w.path.endsWith("/stale-1"))).toBe(true);

    const posts = writes().filter((w) => w.method === "POST");
    const ids = posts.map((p) => p.body.data.relationships.category.data.id);
    expect(ids).toContain("IDENTIFIERS.USER_ID");
    expect(ids).toContain("LOCATION.COARSE_LOCATION");
    expect(ids).toContain("SENSITIVE_INFO.SENSITIVE_INFO");
    // Never, under any circumstance.
    expect(ids).not.toContain("LOCATION.PRECISE_LOCATION");

    // Every row carries the not-tracking protection, because tracking is
    // uniformly off and Apple models that per-row.
    const prots = posts.flatMap((p) =>
      p.body.data.relationships.dataProtections.data.map((d) => d.id));
    expect(prots).toContain("DATA_NOT_USED_TO_TRACK_YOU");
  });

  it("refuses to push a label that claims tracking", async () => {
    // Tracking gates the whole form and carries an ATT prompt behind it.
    // Guarded because a one-character edit to the JSON should not be able
    // to turn it on unattended.
    const fixture = join(tmpdir(), `privacy-tracking-${process.pid}.json`);
    const real = JSON.parse(readFileSync(join(root, "design/store/app-privacy.json"), "utf8"));
    writeFileSync(fixture, JSON.stringify({ ...real, tracking: { used: true } }));
    try {
      const err = await push(["--privacy", "--apply", "--privacy-file", fixture])
        .then(() => null, (e) => e);
      expect(err, "expected a non-zero exit").not.toBeNull();
      expect(err.code).toBe(1);
      expect(String(err.stderr)).toMatch(/tracking/i);
    } finally {
      rmSync(fixture, { force: true });
    }
  });

  it("declares exactly the rows app-privacy.json lists, and never Precise Location", async () => {
    // A whole-set assertion rather than spot checks: under-declaring is the
    // direction that gets an app pulled, so "these seven and no others" is
    // the property worth pinning.
    existingUsages = [];
    await push(["--privacy", "--apply"]);
    const posted = new Set(writes()
      .filter((w) => w.method === "POST")
      .map((p) => p.body.data.relationships.category.data.id));
    expect([...posted].sort()).toEqual([
      "CONTACT_INFO.EMAIL_ADDRESS",
      "CONTACT_INFO.NAME",
      "DIAGNOSTICS.CRASH_DATA",
      "IDENTIFIERS.USER_ID",
      "LOCATION.COARSE_LOCATION",
      "SENSITIVE_INFO.SENSITIVE_INFO",
      "USER_CONTENT.OTHER_USER_CONTENT",
    ]);
  });
});

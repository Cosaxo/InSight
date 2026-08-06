// seed-content.test.mjs — exercise scripts/seed-content.mjs end to end
// against a stub identitytoolkit and a stub callable.
//
// WHY THIS EXISTS, specifically. The step this script performs has now been
// documented wrong twice: once as a v8 `firebase.functions()` call on a
// modular-SDK app, and once as "run it from the app's browser console" for
// an app that has no browser build. Both survived because nobody could run
// the instruction to find out. A committed test is the only version of
// "verified" that stays true after the day it was written.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(root, "scripts/seed-content.mjs");

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const SA = JSON.stringify({
  private_key: privateKey,
  client_email: "sa@prvfire33.iam.gserviceaccount.com",
});
const UID = "operator-uid-123";

let server, base, received;
let seedResponse = { result: { written: 369, skipped: 0 } };
let seedStatus = 200;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      const url = new URL(req.url, "http://x");
      received.push({ path: url.pathname, query: url.search, auth: req.headers.authorization, body: JSON.parse(body || "{}") });
      if (url.pathname === "/v1/accounts:signInWithCustomToken") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ idToken: "ID-TOKEN-XYZ" }));
      }
      res.writeHead(seedStatus, { "content-type": "application/json" });
      res.end(JSON.stringify(seedResponse));
    });
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server?.close());

async function seed(args = [], env = {}) {
  received = [];
  return run("node", [SCRIPT, ...args], {
    env: {
      ...process.env,
      FIREBASE_SERVICE_ACCOUNT: SA,
      SEED_ADMIN_UIDS: `${UID},second-operator`,
      VITE_FIREBASE_API_KEY: "test-api-key",
      SEED_IDENTITY_BASE: base,
      SEED_FUNCTIONS_BASE: base,
      ...env,
    },
  });
}

describe("seed-content", () => {
  it("mints a custom token the service-account key actually signed", async () => {
    await seed();
    const exchange = received.find((r) => r.path === "/v1/accounts:signInWithCustomToken");
    const [h, p, sig] = exchange.body.token.split(".");

    expect(createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(sig, "base64url")))
      .toBe(true);

    const claims = JSON.parse(Buffer.from(p, "base64url").toString());
    // The fixed audience Google requires for this grant. A wrong value comes
    // back as INVALID_CUSTOM_TOKEN, which reads like a bad signature.
    expect(claims.aud).toBe(
      "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
    );
    expect(claims.uid).toBe(UID);          // the FIRST uid, not the list
    expect(claims.iss).toBe("sa@prvfire33.iam.gserviceaccount.com");
    expect(JSON.parse(Buffer.from(h, "base64url").toString()).alg).toBe("RS256");
    expect(exchange.query).toContain("key=test-api-key");
  });

  it("calls seedContentV2 with the exchanged token and the client's payload shape", async () => {
    const { stdout } = await seed();
    const call = received.find((r) => r.path === "/seedContentV2");

    expect(call.auth).toBe("Bearer ID-TOKEN-XYZ");
    // Field-for-field what LIVE.seedContent sends — bumpRev always present.
    expect(call.body).toEqual({ data: { bumpRev: false } });
    expect(stdout).toMatch(/written 369, skipped 0/);
    expect(stdout).toMatch(/question bank is live/);
  });

  it("passes bumpRev only when asked", async () => {
    await seed(["--bump-rev"]);
    expect(received.find((r) => r.path === "/seedContentV2").body)
      .toEqual({ data: { bumpRev: true } });
  });

  it("--dry-run resolves credentials and calls nothing", async () => {
    const { stdout } = await seed(["--dry-run"]);
    expect(stdout).toMatch(/DRY RUN/);
    expect(received).toHaveLength(0);
  });

  it("reports a no-op reseed as already matching rather than as success", async () => {
    seedResponse = { result: { written: 0, skipped: 369 } };
    const { stdout } = await seed();
    expect(stdout).toMatch(/already matches the repo/);
    seedResponse = { result: { written: 369, skipped: 0 } };
  });

  it("tells the operator a D58 refusal is not retryable", async () => {
    // The one failure that looks transient and is not: re-running clears
    // nothing, because the content itself is what the seed objects to.
    seedStatus = 400;
    seedResponse = {
      error: {
        status: "FAILED_PRECONDITION",
        message: "refused 2 option-set edit(s) to already-seeded questions; daily-004, feed-011",
      },
    };
    const err = await seed().then(() => null, (e) => e);
    expect(err).not.toBeNull();
    expect(String(err.stderr)).toMatch(/re-running will not/);
    expect(String(err.stderr)).toMatch(/active:false/);
    // The server's own list of offenders has to survive into the operator's
    // console, or they cannot act on it.
    expect(String(err.stderr)).toMatch(/daily-004, feed-011/);
    seedStatus = 200;
    seedResponse = { result: { written: 369, skipped: 0 } };
  });

  it("explains permission-denied as the deploy-lag trap, not a wrong uid", async () => {
    // The failure that will actually happen: SEED_ADMIN_UIDS set in the
    // GitHub environment but not yet carried into the runtime by a deploy,
    // which is indistinguishable from never setting it.
    seedStatus = 403;
    seedResponse = { error: { status: "PERMISSION_DENIED", message: "operator-only" } };
    const err = await seed().then(() => null, (e) => e);
    expect(err).not.toBeNull();
    expect(String(err.stderr)).toMatch(/only reaches the runtime on a deploy/);
    seedStatus = 200;
    seedResponse = { result: { written: 369, skipped: 0 } };
  });
});

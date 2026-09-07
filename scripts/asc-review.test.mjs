// asc-review.test.mjs — App Review Information, against a stub Apple.
//
// This script writes to a live App Store listing and there is no safe way
// to try it for real: the first live run is against the owner's own app,
// days before a submission. So the request shapes are pinned here or they
// ship unverified, which is the same argument asc-push.test.mjs makes.
//
// WHAT IS WORTH PINNING:
//
//   1. THE PASSWORD NEVER REACHES A LOG. The demo credential is minted in
//      the same workflow run and handed over in a file precisely so it is
//      never seen; a script that then prints it has undone the whole
//      arrangement. Asserted on stdout, on the path that actually sets it.
//   2. `demoAccountRequired` IS TRUE EVEN WITH NO CREDENTIALS. It is set
//      from the WALL, not from whether a file happened to be passed —
//      forgetting the file must not quietly tell Apple the app opens
//      without a sign-in. That was false for every build up to 32 and
//      truthfully so, which is exactly why it is easy to leave alone.
//   3. THE DRY RUN. Zero writes without --apply, asserted on the METHOD of
//      every recorded request rather than on what was printed.
//   4. CREATE-OR-UPDATE. The review detail is a one-to-one child that may
//      not exist yet: POST over an existing one is a 409, PATCH against a
//      missing one is a 404, and which case a version is in depends on
//      whether it was ever submitted. Both branches are pinned.
//   5. IT REFUSES A LIVE VERSION. A script running unattended must not
//      edit a version Apple is reviewing.
//   6. IT REFUSES A BUILD THAT IS STILL PROCESSING, and says that is
//      expected rather than broken — this runs minutes after an upload,
//      when the answer is normally "not yet".

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(root, "scripts/asc-review.mjs");

// An EC key, because ASC's JWT is ES256 — an RSA key would fail at signing
// rather than at the assertion, which is a confusing way to learn nothing.
const { privateKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const PASSWORD = "sWordThatMustNotAppear99";
const demoDir = mkdtempSync(join(tmpdir(), "asc-review-"));
const DEMO_FILE = join(demoDir, "demo.json");
writeFileSync(DEMO_FILE, JSON.stringify({ email: "appreview@example.test", password: PASSWORD }));

let state, calls, server, base;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      calls.push({ method: req.method, url: req.url, body: raw ? JSON.parse(raw) : null });
      const send = (code, obj) => {
        res.writeHead(code, { "content-type": "application/json" });
        res.end(JSON.stringify(obj));
      };
      if (req.url.startsWith("/v1/apps?")) {
        return send(200, { data: [{ id: "APP1", attributes: { name: "InSight" } }] });
      }
      if (req.url.includes("/appStoreVersions?")) {
        return send(200, { data: [{
          id: "VER1",
          attributes: { versionString: "2.0.0", appStoreState: state.versionState },
        }] });
      }
      // The version's one-to-one child, read. Matched narrowly on purpose:
      // a looser `includes("appStoreReviewDetail")` also catches the POST
      // to the plural collection, which made every write 404 — the stub
      // answering for a route it was not asked about.
      if (req.method === "GET" && /\/appStoreVersions\/[^/]+\/appStoreReviewDetail$/.test(req.url)) {
        return state.detailId
          ? send(200, { data: { id: state.detailId } })
          : send(404, { errors: [{ title: "Not found", detail: "no detail yet" }] });
      }
      if (req.url.startsWith("/v1/builds?")) {
        return send(200, { data: state.build ? [state.build] : [] });
      }
      return send(200, { data: { id: "NEW" } });
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((r) => server.close(r)));

beforeEach(() => {
  calls = [];
  state = {
    versionState: "PREPARE_FOR_SUBMISSION",
    detailId: null,
    build: { id: "BUILD33", attributes: { processingState: "VALID" } },
  };
});

const exec = (args = []) => run("node", [SCRIPT, ...args], {
  env: {
    ...process.env,
    ASC_API_BASE: base,
    ASC_KEY_ID: "ABCD123456",
    ASC_ISSUER_ID: "11111111-2222-3333-4444-555555555555",
    ASC_PRIVATE_KEY: privateKey,
  },
});

const writes = () => calls.filter((c) => c.method === "POST" || c.method === "PATCH");

describe("the demo account's password", () => {
  it("never appears in stdout, on the path that actually sets it", async () => {
    const { stdout } = await exec(["--demo-file", DEMO_FILE, "--apply"]);
    expect(stdout).not.toContain(PASSWORD);
    // …and it DID set it, so this is not passing because nothing happened.
    const sent = writes().find((c) => c.body?.data?.attributes?.demoAccountPassword);
    expect(sent?.body.data.attributes.demoAccountPassword).toBe(PASSWORD);
    // The report says the field is set without saying what it is.
    expect(stdout).toMatch(/characters, not printed/);
  });
});

describe("demoAccountRequired", () => {
  it("is true even when no credentials are supplied", async () => {
    // The field is set from the WALL, not from the file. Forgetting the
    // file must not tell Apple the app opens without a sign-in.
    const { stdout } = await exec(["--apply"]);
    const sent = writes()[0];
    expect(sent.body.data.attributes.demoAccountRequired).toBe(true);
    expect(sent.body.data.attributes.demoAccountName).toBeUndefined();
    expect(stdout).toMatch(/No --demo-file/);
  });

  it("carries the four contact fields from the repo", async () => {
    await exec(["--apply"]);
    const a = writes()[0].body.data.attributes;
    for (const k of ["contactFirstName", "contactLastName", "contactPhone", "contactEmail"]) {
      expect(a[k], `${k} empty`).toBeTruthy();
    }
    expect(a.notes).toMatch(/Sign in with Apple/);
  });
});

describe("the dry run", () => {
  it("writes nothing without --apply", async () => {
    const { stdout } = await exec(["--demo-file", DEMO_FILE]);
    expect(stdout).toMatch(/dry run/);
    expect(writes()).toEqual([]);
    // And still never prints the credential, even while reporting it.
    expect(stdout).not.toContain(PASSWORD);
  });
});

describe("create or update", () => {
  it("POSTs when the version has no review detail yet", async () => {
    await exec(["--apply"]);
    const w = writes()[0];
    expect(w.method).toBe("POST");
    expect(w.url).toBe("/v1/appStoreReviewDetails");
    // The relationship is what ties it to the version; without it Apple
    // accepts the object and it belongs to nothing.
    expect(w.body.data.relationships.appStoreVersion.data.id).toBe("VER1");
  });

  it("PATCHes when one already exists", async () => {
    state.detailId = "DET1";
    await exec(["--apply"]);
    const w = writes()[0];
    expect(w.method).toBe("PATCH");
    expect(w.url).toBe("/v1/appStoreReviewDetails/DET1");
    expect(w.body.data.id).toBe("DET1");
  });
});

describe("what it refuses", () => {
  it("refuses a version Apple is already reviewing", async () => {
    state.versionState = "IN_REVIEW";
    await expect(exec(["--apply"])).rejects.toThrow(/no editable version/);
    expect(writes()).toEqual([]);
  });

  it("refuses a build that is still processing, and says it is expected", async () => {
    state.build = { id: "BUILD33", attributes: { processingState: "PROCESSING" } };
    await expect(exec(["--attach-build", "33", "--apply"])).rejects.toThrow(/Not VALID yet/);
    expect(writes()).toEqual([]);
  });

  it("explains a missing build as processing rather than as an error to fix", async () => {
    state.build = null;
    await expect(exec(["--attach-build", "33", "--apply"]))
      // The message wraps, so the assertion has to as well — matching a
      // phrase that spans the break would pass only by accident.
      .rejects.toThrow(/expected\s+answer straight after a release run/);
  });
});

describe("attaching the build", () => {
  it("PATCHes the version's build relationship, after the details", async () => {
    await exec(["--attach-build", "33", "--apply"]);
    const w = writes();
    expect(w[0].url).toBe("/v1/appStoreReviewDetails");
    expect(w[1].url).toBe("/v1/appStoreVersions/VER1/relationships/build");
    expect(w[1].body).toEqual({ data: { type: "builds", id: "BUILD33" } });
  });
});

describe("submission", () => {
  it("is never what this script does", async () => {
    const { stdout } = await exec(["--attach-build", "33", "--apply"]);
    // No reviewSubmission resource is touched, on any path.
    expect(calls.some((c) => c.url.includes("reviewSubmission"))).toBe(false);
    expect(stdout).toMatch(/NOT submitted/);
  });
});

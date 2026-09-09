// appcheck.test.mjs — the App Check reader/setter, against a stub Google.
//
// What is worth pinning here is not the happy path — it is the three ways
// this script could be quietly wrong in production, each of which looks
// green from the console:
//
//   1. THE SECRET. A debug token is a bypass, not an attestation (D337).
//      The API echoes the token back on create and returns it on list, so
//      the easy version of this script prints it — into an Actions log,
//      which is readable by everyone with repo read. Two cases assert the
//      value never appears in stdout, on the write AND on the read.
//   2. THE PROJECT NUMBER. App Check's paths are keyed by project NUMBER
//      while the rest of this repo is keyed by project ID, and passing the
//      id answers 403 — which reads like a missing IAM role and sends you
//      to the wrong console page. Pinned by asserting the number is in the
//      path, not the id.
//   3. THE DRY RUN. Enforcement is not reversible without a window where
//      clients fail, so a run without --apply must make zero writes. The
//      assertion is on the METHOD of every recorded call, not on the words
//      the script printed.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateKeyPairSync } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(root, "scripts/appcheck.mjs");

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const SA = JSON.stringify({ private_key: privateKey, client_email: "deploy@prvfire33.iam.gserviceaccount.com" });

const NUMBER = "482516309817";
const IOS_APP = "1:482516309817:ios:abc123";
// A real UUID4 shape, because the script's own guard and the API both care.
const SECRET = "8f1a2b3c-4d5e-4f60-9a7b-1c2d3e4f5061";

let reply, calls, server, base;
const key = (method, url) => `${method} ${url}`;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      if (req.url.startsWith("/oauth2.googleapis.com")) {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ access_token: "TOK" }));
      }
      calls.push({
        method: req.method,
        url: req.url,
        auth: req.headers.authorization || null,
        body: raw ? JSON.parse(raw) : null,
      });
      const r = reply[key(req.method, req.url)] || { status: 200, body: {} };
      res.writeHead(r.status, { "content-type": "application/json" });
      res.end(JSON.stringify(r.body));
    });
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => server?.close());

const P = (path) => `/firebase.googleapis.com${path}`;
const C = (path) => `/firebaseappcheck.googleapis.com${path}`;

beforeEach(() => {
  calls = [];
  reply = {
    [key("GET", P("/v1beta1/projects/prvfire33"))]: { status: 200, body: { projectNumber: NUMBER } },
    [key("GET", P("/v1beta1/projects/prvfire33/iosApps"))]: {
      status: 200,
      body: { apps: [{ appId: IOS_APP, bundleId: "com.cosaxo.insight" }] },
    },
    [key("GET", P("/v1beta1/projects/prvfire33/androidApps"))]: { status: 200, body: {} },
    [key("GET", P("/v1beta1/projects/prvfire33/webApps"))]: { status: 200, body: {} },
    [key("GET", C(`/v1/projects/${NUMBER}/apps/${IOS_APP}/debugTokens`))]: {
      status: 200,
      // The API returns the secret on a list. This is exactly the body the
      // easy version of the script would print.
      body: { debugTokens: [{ name: `projects/${NUMBER}/apps/${IOS_APP}/debugTokens/dt1`, displayName: "CI", token: SECRET }] },
    },
  };
});

async function appcheck(args, env = {}) {
  const { stdout, stderr } = await run("node", [SCRIPT, ...args], {
    env: {
      ...process.env,
      GOOGLE_API_BASE: base,
      FIREBASE_SERVICE_ACCOUNT: SA,
      FIREBASE_PROJECT_ID: "prvfire33",
      ...env,
    },
  }).catch((e) => ({ stdout: e.stdout || "", stderr: e.stderr || "" }));
  return stdout + stderr;
}

const writes = () => calls.filter((c) => c.method !== "GET");

describe("appcheck report", () => {
  it("keys App Check paths by project number, never by project id", async () => {
    // The 403 this prevents reads like a missing IAM role, which sends you
    // to a console page that cannot fix it.
    await appcheck([]);
    const checkCalls = calls.filter((c) => c.url.startsWith("/firebaseappcheck.googleapis.com"));
    expect(checkCalls.length).toBeGreaterThan(0);
    for (const c of checkCalls) {
      expect(c.url).toContain(`/projects/${NUMBER}/`);
      expect(c.url).not.toContain("/projects/prvfire33/");
    }
  });

  it("never prints a debug token, even though the list API returns one", async () => {
    const out = await appcheck([]);
    expect(out).toContain("CI");            // the display name is the useful half
    expect(out).not.toContain(SECRET);      // the secret is not
  });

  it("signs every request", async () => {
    // A stub that ignores Authorization cannot tell a signed request from an
    // anonymous one, so the credential path would be unasserted without this.
    await appcheck([]);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) expect(c.auth).toBe("Bearer TOK");
  });

  it("reports a platform it cannot list beside the others rather than dying", async () => {
    reply[key("GET", P("/v1beta1/projects/prvfire33/webApps"))] = { status: 403, body: { error: { message: "no web apps" } } };
    const out = await appcheck([]);
    expect(out).toMatch(/web\s+— could not list: 403/);
    expect(out).toContain(IOS_APP);         // the iOS app still reported
  });

  it("makes no writes at all", async () => {
    await appcheck([]);
    expect(writes()).toHaveLength(0);
  });
});

describe("appcheck debug tokens", () => {
  it("refuses to mint one, and says where the value must come from", async () => {
    const out = await appcheck(["--register-debug-token", "--app", IOS_APP, "--apply"], {
      APPCHECK_DEBUG_TOKEN: "",
    });
    expect(out).toMatch(/never mints one/);
    expect(writes()).toHaveLength(0);
  });

  it("registers the value it was handed, and does not echo it", async () => {
    reply[key("POST", C(`/v1/projects/${NUMBER}/apps/${IOS_APP}/debugTokens`))] = {
      status: 200,
      body: { name: `projects/${NUMBER}/apps/${IOS_APP}/debugTokens/dt2`, token: SECRET },
    };
    const out = await appcheck(
      ["--register-debug-token", "--app", IOS_APP, "--display-name", "CI", "--apply"],
      { APPCHECK_DEBUG_TOKEN: SECRET },
    );
    const posts = writes();
    expect(posts).toHaveLength(1);
    expect(posts[0].body.token).toBe(SECRET);
    expect(posts[0].body.displayName).toBe("CI");
    // The response echoes the token; the output must not.
    expect(out).toContain("dt2");
    expect(out).not.toContain(SECRET);
  });

  it("does not echo the token back when the API rejects it", async () => {
    // The coverage gap a security review found by probing rather than by
    // reading: the non-echo property was pinned on a 200 create and on the
    // list path, and NOT on a 4xx — which is the one place the token is in
    // the request body and the printed string is Google's rather than ours.
    //
    // Google's ESF type-mismatch errors quote the offending value, so a
    // rejected token could come straight back in `error.message`. That path
    // is worse than it looks: the workflow tees this output and `cat`s it
    // inside a `{ … } >> "$GITHUB_STEP_SUMMARY"` redirect, which never
    // passes the runner's secret masker.
    reply[key("POST", C(`/v1/projects/${NUMBER}/apps/${IOS_APP}/debugTokens`))] = {
      status: 400,
      body: { error: { message: `Invalid value at 'debug_token.token' (TYPE_STRING), "${SECRET}"` } },
    };
    const out = await appcheck(
      ["--register-debug-token", "--app", IOS_APP, "--apply"],
      { APPCHECK_DEBUG_TOKEN: SECRET },
    );
    expect(out).toMatch(/400/);          // the operator still learns it failed
    expect(out).toMatch(/<redacted>/);   // and where the value was
    expect(out).not.toContain(SECRET);
  });

  it("prints a rejection message unharmed when it does not contain the token", async () => {
    // The other half, and the reason the scrub is guarded: a naive
    // implementation splitting on an empty token turns every message into
    // one character per `<redacted>`. This asserts the ordinary 403 — the
    // one that names a missing IAM role — still reads as itself.
    reply[key("POST", C(`/v1/projects/${NUMBER}/apps/${IOS_APP}/debugTokens`))] = {
      status: 403,
      body: { error: { message: "Permission denied on resource project prvfire33." } },
    };
    const out = await appcheck(
      ["--register-debug-token", "--app", IOS_APP, "--apply"],
      { APPCHECK_DEBUG_TOKEN: SECRET },
    );
    expect(out).toContain("Permission denied on resource project prvfire33.");
    expect(out).not.toContain("<redacted>");
  });

  it("writes nothing without --apply", async () => {
    const out = await appcheck(
      ["--register-debug-token", "--app", IOS_APP],
      { APPCHECK_DEBUG_TOKEN: SECRET },
    );
    expect(out).toMatch(/DRY RUN/);
    expect(writes()).toHaveLength(0);
  });
});

describe("appcheck enforcement", () => {
  const SVC = C(`/v1/projects/${NUMBER}/services/firestore.googleapis.com`);

  beforeEach(() => {
    reply[key("GET", SVC)] = { status: 200, body: { enforcementMode: "UNENFORCED" } };
  });

  it("refuses a mode outside the enum, before any network call", async () => {
    const out = await appcheck(["--enforce", "firestore.googleapis.com", "--mode", "ON", "--apply"]);
    expect(out).toMatch(/UNENFORCED \| ENFORCED \| OFF/);
    expect(calls).toHaveLength(0);
  });

  it("refuses a service outside the list, naming the list", async () => {
    const out = await appcheck(["--enforce", "firestore.example.com", "--mode", "ENFORCED", "--apply"]);
    expect(out).toMatch(/is not one of:/);
    expect(calls).toHaveLength(0);
  });

  it("shows the transition and writes nothing without --apply", async () => {
    // The irreversible one. A dry run has to be a dry run by call shape, not
    // by the words it printed.
    const out = await appcheck(["--enforce", "firestore.googleapis.com", "--mode", "ENFORCED"]);
    expect(out).toMatch(/UNENFORCED → ENFORCED/);
    expect(out).toMatch(/DRY RUN/);
    expect(writes()).toHaveLength(0);
  });

  it("patches only enforcementMode, through an updateMask", async () => {
    reply[key("PATCH", `${SVC}?updateMask=enforcementMode`)] = { status: 200, body: { enforcementMode: "ENFORCED" } };
    await appcheck(["--enforce", "firestore.googleapis.com", "--mode", "ENFORCED", "--apply"]);
    const patches = writes();
    expect(patches).toHaveLength(1);
    expect(patches[0].method).toBe("PATCH");
    expect(patches[0].url).toContain("updateMask=enforcementMode");
    expect(patches[0].body.enforcementMode).toBe("ENFORCED");
  });

  it("is a no-op when the service is already in the requested mode", async () => {
    reply[key("GET", SVC)] = { status: 200, body: { enforcementMode: "ENFORCED" } };
    const out = await appcheck(["--enforce", "firestore.googleapis.com", "--mode", "ENFORCED", "--apply"]);
    expect(out).toMatch(/already there/);
    expect(writes()).toHaveLength(0);
  });
});

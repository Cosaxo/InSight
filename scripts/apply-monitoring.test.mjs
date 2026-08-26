// apply-monitoring.test.mjs — the applier, against a stub Google.
//
// The half that matters here is ORDER and the CHANNEL ID, because both fail
// silently in the project and neither is visible from the console.
//
// The committed policy files carry `notificationChannels: []` — the id is
// per-operator and correctly not in this repo — so the POST has to fill it
// in. A policy created with the empty list is accepted, enabled, listed and
// green, and pages nobody: `npm run observe` would report `armed: true` for
// an alert chain that cannot reach anyone. Nothing downstream of this
// script can tell the difference, so it is pinned here.
//
// Order is the same class: two policies read log-based metrics, and a
// policy created against a metric type that resolves to nothing never
// fires — which looks exactly like the condition never occurring.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(root, "scripts/apply-monitoring.mjs");

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const SA = JSON.stringify({ private_key: privateKey, client_email: "deploy@prvfire33.iam.gserviceaccount.com" });

const CHANNEL_ID = "projects/prvfire33/notificationChannels/9001";

// Keyed "METHOD /host/v3/projects/..." — the applier GETs and POSTs the
// same path, and the whole point of several cases below is which of the two
// happened, so the stub cannot key on host alone the way observe's does.
let reply;
let calls;
let server, base;

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
      calls.push({ method: req.method, url: req.url, body: raw ? JSON.parse(raw) : null });
      const r = reply[key(req.method, req.url)] || { status: 200, body: {} };
      res.writeHead(r.status, { "content-type": "application/json" });
      res.end(JSON.stringify(r.body));
    });
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => server?.close());

const CHANNELS = "/monitoring.googleapis.com/v3/projects/prvfire33/notificationChannels";
const POLICIES = "/monitoring.googleapis.com/v3/projects/prvfire33/alertPolicies";
const METRICS = "/logging.googleapis.com/v2/projects/prvfire33/metrics";

/** The committed policy names, read off disk rather than retyped. Written
 *  out by hand first, and three of the eight were wrong — which is the
 *  whole failure this repo has a `check:figures` gate for. The assertion
 *  that matters is "zero POSTs", and that stays independent of where the
 *  names come from. */
const committedDisplayNames = () =>
  APPLIED_POLICIES.map((rel) => JSON.parse(readFileSync(join(root, rel), "utf8")).displayName);

// The same list apply-monitoring holds, read out of its source the way
// check-monitoring reads it — so a policy added to the repo and not to the
// list cannot make this test pass by being absent from both.
const APPLIED_POLICIES = [
  ...readFileSync(join(root, "scripts/apply-monitoring.mjs"), "utf8")
    .matchAll(/"(monitoring\/[\w.-]+\.json)"/g),
].map((m) => m[1]);

beforeEach(() => {
  calls = [];
  reply = {
    [key("GET", CHANNELS)]: { status: 200, body: { notificationChannels: [] } },
    [key("POST", CHANNELS)]: {
      status: 200,
      body: { name: CHANNEL_ID, displayName: "InSight oncall", labels: { email_address: "you@example.com" } },
    },
    [key("GET", METRICS)]: { status: 200, body: { metrics: [] } },
    [key("POST", METRICS)]: { status: 200, body: {} },
    [key("GET", POLICIES)]: { status: 200, body: { alertPolicies: [] } },
    [key("POST", POLICIES)]: { status: 200, body: {} },
  };
});

const apply = async (args = []) => {
  const { stdout } = await run("node", [SCRIPT, "--email", "you@example.com", ...args], {
    env: { ...process.env, FIREBASE_SERVICE_ACCOUNT: SA, GOOGLE_API_BASE: base },
  });
  return stdout;
};

/** For the paths that exit non-zero. execFile rejects, and the reason is on
 *  stderr — which is where an operator reads it too. */
const applyFails = async (args = []) => {
  try {
    await run("node", [SCRIPT, "--email", "you@example.com", ...args], {
      env: { ...process.env, FIREBASE_SERVICE_ACCOUNT: SA, GOOGLE_API_BASE: base },
    });
  } catch (err) {
    return { code: err.code, stderr: err.stderr };
  }
  throw new Error("expected a non-zero exit");
};

const posts = () => calls.filter((c) => c.method === "POST");

describe("dry run", () => {
  it("is the default, and writes nothing", async () => {
    const out = await apply();
    expect(out).toContain("DRY RUN");
    expect(posts()).toEqual([]);
  });

  it("names every object it would create — one channel, five metrics, eight policies", async () => {
    const out = await apply();
    const would = out.split("\n").filter((l) => l.includes("would create"));
    expect(would).toHaveLength(1 + 5 + 8);
    expect(out).toContain('+ notification channel "InSight oncall" — would create');
    expect(out).toContain("+ log-based metric agg_contention — would create");
    expect(out).toContain('+ policy "onV2AnswerCreated is erroring" — would create');
  });
});

describe("--apply", () => {
  it("creates the channel, then the metrics, then the policies", async () => {
    await apply(["--apply"]);
    const order = posts().map((c) => c.url);
    expect(order.filter((u) => u === CHANNELS)).toHaveLength(1);
    expect(order.filter((u) => u === METRICS)).toHaveLength(5);
    expect(order.filter((u) => u === POLICIES)).toHaveLength(8);
    // Not just "all present" — every metric POST must precede every policy
    // POST, because two policies read metrics created in that step.
    expect(order.lastIndexOf(METRICS)).toBeLessThan(order.indexOf(POLICIES));
    expect(order.indexOf(CHANNELS)).toBeLessThan(order.indexOf(METRICS));
  });

  it("fills the channel id into every policy — the committed files say []", async () => {
    await apply(["--apply"]);
    const policyPosts = posts().filter((c) => c.url === POLICIES);
    expect(policyPosts).toHaveLength(8);
    for (const p of policyPosts) {
      expect(p.body.notificationChannels).toEqual([CHANNEL_ID]);
    }
    // …and the rest of the committed body survives the merge.
    const errors = policyPosts.find((p) => p.body.displayName === "onV2AnswerCreated is erroring");
    expect(errors.body.conditions).toHaveLength(1);
    expect(errors.body.documentation.content).toContain("retry:true");
  });

  it("sends each metric's filter, not just its name", async () => {
    await apply(["--apply"]);
    const contention = posts().find((c) => c.url === METRICS && c.body.name === "agg_contention");
    expect(contention.body.filter).toContain('jsonPayload.metric="agg_contention"');
  });
});

describe("idempotence", () => {
  it("creates nothing on a second run", async () => {
    reply[key("GET", CHANNELS)] = {
      status: 200,
      body: { notificationChannels: [{ name: CHANNEL_ID, displayName: "InSight oncall", labels: { email_address: "you@example.com" } }] },
    };
    reply[key("GET", METRICS)] = {
      status: 200,
      body: { metrics: ["agg_contention", "duel_reveal_run", "patterns_fit", "velocity_scan", "engagement_digest"].map((name) => ({ name })) },
    };
    reply[key("GET", POLICIES)] = {
      status: 200,
      body: { alertPolicies: committedDisplayNames().map((displayName) => ({ displayName })) },
    };
    const out = await apply(["--apply"]);
    expect(posts()).toEqual([]);
    expect(out).toContain("done, 0 created");
    expect(out.split("\n").filter((l) => l.includes("already exists"))).toHaveLength(1 + 5 + 8);
  });
});

describe("a refusal", () => {
  it("names the role AND the service account, and stops before creating anything", async () => {
    reply[key("GET", POLICIES)] = {
      status: 403,
      body: { error: { message: "Permission monitoring.alertPolicies.list denied." } },
    };
    const { code, stderr } = await applyFails(["--apply"]);
    expect(code).toBe(1);
    expect(stderr).toContain("roles/monitoring.alertPolicyEditor");
    expect(stderr).toContain("deploy@prvfire33.iam.gserviceaccount.com");
    // The channel and the metrics were created before the refusal; no
    // policy was, and none must be attempted past it.
    expect(posts().filter((c) => c.url === POLICIES)).toEqual([]);
  });

  it("distinguishes a 404 (API not enabled) from a 403 (missing role)", async () => {
    reply[key("GET", METRICS)] = { status: 404, body: { error: { message: "not found" } } };
    const { stderr } = await applyFails(["--apply"]);
    expect(stderr).toContain("API is not enabled");
    expect(stderr).not.toContain("Grant roles/");
  });
});

describe("the channel that points somewhere else", () => {
  it("is reported and left alone, rather than repointed", async () => {
    reply[key("GET", CHANNELS)] = {
      status: 200,
      body: { notificationChannels: [{ name: CHANNEL_ID, displayName: "InSight oncall", labels: { email_address: "someone-else@example.com" } }] },
    };
    const out = await apply(["--apply"]);
    expect(out).toContain("points at someone-else@example.com");
    expect(posts().filter((c) => c.url === CHANNELS)).toEqual([]);
    // …and the policies still get the existing channel's id, because half
    // an alert chain is worse than one pointing at the wrong inbox.
    expect(posts().find((c) => c.url === POLICIES).body.notificationChannels).toEqual([CHANNEL_ID]);
  });
});

describe("--email", () => {
  it("is required — it is where the pages go", async () => {
    try {
      await run("node", [SCRIPT], { env: { ...process.env, FIREBASE_SERVICE_ACCOUNT: SA, GOOGLE_API_BASE: base } });
      throw new Error("expected a non-zero exit");
    } catch (err) {
      expect(err.code).toBe(1);
      expect(err.stderr).toContain("--email is required");
    }
  });
});

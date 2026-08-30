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
import { readFileSync, readdirSync } from "node:fs";
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
let tokenReply;
let calls;
let server, base;

const key = (method, url) => `${method} ${url}`;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      if (req.url.startsWith("/oauth2.googleapis.com")) {
        res.writeHead(tokenReply.status, { "content-type": tokenReply.contentType });
        return res.end(tokenReply.raw);
      }
      // The AUTH HEADER is recorded, not just the body. Without it the whole
      // credential path — the reason this commit exists — is unasserted: the
      // review deleted the bearer header outright and all ten cases stayed
      // green, because a stub that ignores Authorization cannot tell a
      // signed request from an anonymous one.
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
// check-monitoring reads it.
//
// This comment used to claim the reading also meant "a policy added to the
// repo and not to the list cannot make this test pass by being absent from
// both." It cannot, and the review demonstrated it: committing an unlisted
// monitoring/*.json leaves all ten cases green, because a file absent from
// this list is simply never asserted about. `check:monitoring` rule 1 is
// what catches that, in CI, and it is the only thing that does. Kept as a
// false-reason correction rather than deleted, because the reading is still
// the right one — it just buys idempotence coverage, not drift coverage.
const APPLIED_POLICIES = [
  ...readFileSync(join(root, "scripts/apply-monitoring.mjs"), "utf8")
    .matchAll(/"(monitoring\/[\w.-]+\.json)"/g),
].map((m) => m[1]);

beforeEach(() => {
  calls = [];
  tokenReply = { status: 200, contentType: "application/json", raw: JSON.stringify({ access_token: "TOK" }) };
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
    env: {
      ...process.env,
      FIREBASE_SERVICE_ACCOUNT: SA,
      GOOGLE_API_BASE: base,
      // PINNED, not inherited. The script resolves
      // `--project || FIREBASE_PROJECT_ID || "prvfire33"`, and every stub
      // key below hard-codes the prvfire33 path — so a developer or a
      // runner with FIREBASE_PROJECT_ID set to anything else moves every
      // URL off the keys and fails seven of these cases for a reason that
      // has nothing to do with the code.
      FIREBASE_PROJECT_ID: "prvfire33",
    },
  });
  return stdout;
};

/** For the paths that exit non-zero. execFile rejects, and the reason is on
 *  stderr — which is where an operator reads it too. */
const applyFails = async (args = []) => {
  try {
    await run("node", [SCRIPT, "--email", "you@example.com", ...args], {
      env: {
      ...process.env,
      FIREBASE_SERVICE_ACCOUNT: SA,
      GOOGLE_API_BASE: base,
      // PINNED, not inherited. The script resolves
      // `--project || FIREBASE_PROJECT_ID || "prvfire33"`, and every stub
      // key below hard-codes the prvfire33 path — so a developer or a
      // runner with FIREBASE_PROJECT_ID set to anything else moves every
      // URL off the keys and fails seven of these cases for a reason that
      // has nothing to do with the code.
      FIREBASE_PROJECT_ID: "prvfire33",
    },
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

describe("what the operator is told after arming", () => {
  // This text prints at the exact moment somebody arms alerting and then
  // goes to verify, and it said all four silence policies watch an ABSENCE
  // and cannot fire until each job has run once in production. Since
  // D303's amendment that is the inverse for three of them: they are
  // trailing-24h thresholds with evaluationMissingData ACTIVE, chosen
  // precisely so a never-emitting series reads as a breach. Nothing pinned
  // the sentence, so it went stale with the shape change.
  //
  // Held against the committed policy files, which are the shape itself.
  const shapes = () => {
    const absent = [];
    const armed = [];
    for (const f of readdirSync(join(root, "monitoring")).filter((f) => f.endsWith(".json"))) {
      let body;
      try { body = JSON.parse(readFileSync(join(root, "monitoring", f), "utf8")); } catch { continue; }
      if (!Array.isArray(body.conditions) || !body.displayName) continue;
      (body.conditions.some((c) => c.conditionAbsent) ? absent : armed).push(body.displayName);
    }
    return { absent, armed };
  };

  it("names the absence policies it actually has, and no others", async () => {
    const { absent, armed } = shapes();
    // Vacuity guards: the split has to be a real split, or the assertions
    // below would hold over an empty set.
    expect(absent.length).toBeGreaterThan(0);
    expect(armed.length).toBeGreaterThan(0);
    const out = await apply(["--apply"]);
    for (const name of absent) {
      expect(out, `${name} is an absence policy and the caveat does not name it`).toContain(name);
    }
    for (const name of armed) {
      expect(out, `${name} is a threshold and the caveat calls it an absence`)
        .not.toContain(`"${name}" is a metric-ABSENCE policy`);
    }
  });

  it("says the rest fire from the first evaluation", async () => {
    const out = await apply(["--apply"]);
    expect(out).toMatch(/fire from the first evaluation/);
    expect(out).toMatch(/evaluationMissingData ACTIVE/);
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

describe("the credential path", () => {
  // The reason this commit exists is that the script now signs its own
  // requests instead of shelling out to a logged-in gcloud. None of that was
  // asserted: the review deleted the bearer header and broke every JWT claim
  // in one pass, and all 478 script tests stayed green.
  it("signs every API call with the token it minted", async () => {
    await apply(["--apply"]);
    expect(calls.length).toBeGreaterThan(10);
    for (const c of calls) expect(c.auth).toBe("Bearer TOK");
  });

  it("names the status when the token endpoint answers with HTML", async () => {
    // D295's defect, and it was carried into google-api.mjs verbatim before
    // the review caught it: `res.json()` rejects before the `!res.ok` branch
    // can run, so the operator gets `Unexpected token '<'` naming neither the
    // status nor the URL. This repo's own agent proxy returns exactly such a
    // body (CLAUDE.md § Things that look like bugs but are not).
    tokenReply = { status: 502, contentType: "text/html", raw: "<html><head><title>502 Bad Gateway</title></head></html>" };
    const { code, stderr } = await applyFails(["--apply"]);
    expect(code).toBe(1);
    expect(stderr).toContain("502");
    expect(stderr).not.toContain("Unexpected token");
    // …and it stopped there: nothing was created with a token it never got.
    expect(calls).toEqual([]);
  });

  it("reports a JSON token refusal with the reason Google gave", async () => {
    tokenReply = {
      status: 400,
      contentType: "application/json",
      raw: JSON.stringify({ error: "invalid_grant", error_description: "Invalid grant: account not found" }),
    };
    const { stderr } = await applyFails(["--apply"]);
    expect(stderr).toContain("Invalid grant: account not found");
  });
});

describe("--channel-name", () => {
  // The flag the WORKFLOW passes: monitoring.yml declares `channel_name` as
  // a dispatch input and forwards it. It had no test, so renaming the flag
  // left all ten cases green — and the "points at someone else" case names
  // --channel-name as its own remedy, so the covered case's stated fix was
  // the uncovered one.
  it("is what the lookup and the creation both use", async () => {
    reply[key("GET", CHANNELS)] = {
      status: 200,
      body: { notificationChannels: [{ name: CHANNEL_ID, displayName: "InSight oncall", labels: { email_address: "you@example.com" } }] },
    };
    const out = await apply(["--channel-name", "Somewhere else", "--apply"]);
    const made = posts().filter((c) => c.url === CHANNELS);
    expect(made).toHaveLength(1);
    expect(made[0].body.displayName).toBe("Somewhere else");
    expect(out).toContain('channel "Somewhere else"');
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

// observe.test.mjs — the observer, against a stub Google.
//
// The half that matters here is the REFUSAL path. Every reading this script
// makes can come back 403 because a role is missing, and that is not a
// failure — it is the answer, and it has to survive alongside the readings
// that worked. A probe that died on the first refusal would report one
// missing role per run and hide the rest, which for a tool whose whole job
// is "what can we see" is the same failure as seeing nothing.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateKeyPairSync } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(root, "scripts/observe.mjs");

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const SA = JSON.stringify({ private_key: privateKey, client_email: "sa@prvfire33.iam.gserviceaccount.com" });

// Keyed by the host segment the seam puts in the path.
let reply;
let server, base;

beforeAll(async () => {
  server = createServer((req, res) => {
    req.on("data", () => {});
    req.on("end", () => {
      const host = req.url.split("/")[1];
      if (host === "oauth2.googleapis.com") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ access_token: "TOK" }));
      }
      const r = reply[host] || { status: 200, body: {} };
      res.writeHead(r.status, { "content-type": "application/json" });
      res.end(JSON.stringify(r.body));
    });
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => server?.close());

beforeEach(() => {
  reply = {
    "monitoring.googleapis.com": { status: 200, body: { alertPolicies: [] } },
    "logging.googleapis.com": { status: 200, body: { metrics: [{ name: "m1" }] } },
    "cloudfunctions.googleapis.com": { status: 200, body: { functions: [] } },
    "cloudbilling.googleapis.com": { status: 200, body: { billingEnabled: true, billingAccountName: "billingAccounts/X" } },
  };
});

const observe = async (args = []) => {
  const { stdout } = await run("node", [SCRIPT, ...args], {
    env: { ...process.env, FIREBASE_SERVICE_ACCOUNT: SA, FIREBASE_PROJECT_ID: "prvfire33", GOOGLE_API_BASE: base },
  });
  return stdout;
};
const asJson = async () => JSON.parse(await observe(["--json"]));

describe("a refusal is a result, not a crash", () => {
  it("reports the missing ROLE and keeps going", async () => {
    reply["monitoring.googleapis.com"] = {
      status: 403,
      body: { error: { message: "Permission monitoring.alertPolicies.list denied." } },
    };
    const out = await observe();
    expect(out).toContain("✗ alertPolicies");
    expect(out).toContain("grant roles/monitoring.viewer");
    // …and the other three still answered.
    expect(out).toContain("✓ logMetrics");
    expect(out).toContain("✓ billing");
  });

  it("reports EVERY refusal in one run, not just the first", async () => {
    for (const h of Object.keys(reply)) reply[h] = { status: 403, body: { error: { message: "denied" } } };
    const j = await asJson();
    expect(j.blocked).toHaveLength(4);
    expect(j.reachable).toEqual([]);
  });

  it("tells a missing ROLE apart from a disabled API", async () => {
    // Different fixes: 403 is one IAM grant, 404 is enabling the service.
    // Reading the same would send someone to the wrong console page.
    reply["cloudbilling.googleapis.com"] = { status: 403, body: { error: { message: "denied" } } };
    reply["cloudfunctions.googleapis.com"] = { status: 404, body: { error: { message: "not found" } } };
    const j = await asJson();
    expect(j.readings.billing.why).toMatch(/grant roles\/billing.viewer/);
    expect(j.readings.functions.why).toMatch(/enable the API/);
  });

  it("exits 0 when a reading is refused — a missing role is the answer", async () => {
    reply["monitoring.googleapis.com"] = { status: 403, body: { error: { message: "denied" } } };
    await expect(observe()).resolves.toBeTruthy();
  });
});

describe("the alert reading, which runbook 5.5 exists for", () => {
  it("answers ARMED by name, not by count", async () => {
    // A project holding eight unrelated policies must not read as armed.
    reply["monitoring.googleapis.com"] = {
      status: 200,
      body: { alertPolicies: Array.from({ length: 8 }, (_, i) => ({ displayName: `something else ${i}` })) },
    };
    const j = await asJson();
    expect(j.readings.alertPolicies.liveCount).toBe(8);
    expect(j.readings.alertPolicies.armed).toBe(false);
    expect(j.readings.alertPolicies.missing.length).toBeGreaterThan(0);
  });

  it("says armed only when every committed policy is present", async () => {
    const names = JSON.parse(await observe(["--json"])).readings.alertPolicies.missing;
    reply["monitoring.googleapis.com"] = {
      status: 200,
      body: { alertPolicies: names.map((displayName) => ({ displayName })) },
    };
    const j = await asJson();
    expect(j.readings.alertPolicies.armed).toBe(true);
    expect(j.readings.alertPolicies.missing).toEqual([]);
  });

  it("counts a DISABLED policy as disabled", async () => {
    // `enabled` is a bare boolean in the v3 JSON representation, not a
    // protobuf wrapper. Read as `p.enabled?.value !== false` it was
    // `(false)?.value` -> undefined -> `undefined !== false` -> true, so
    // enabledCount could only ever equal liveCount and a policy somebody had
    // switched off in the console still read as armed cover.
    reply["monitoring.googleapis.com"] = {
      status: 200,
      body: {
        alertPolicies: [
          { displayName: "on", enabled: true },
          { displayName: "off", enabled: false },
          // The API omits the field when it is true, so absent must count.
          { displayName: "absent" },
        ],
      },
    };
    const j = await asJson();
    expect(j.readings.alertPolicies.liveCount).toBe(3);
    expect(j.readings.alertPolicies.enabledCount).toBe(2);
  });
});

describe("the region reading, which runbook 5.9b exists for", () => {
  it("names strays in EVERY region, not only the one the docs expect", async () => {
    // Written as "is anything in us-central1" first, because that is the
    // only stale region this repo's prose has ever named. The first
    // production run found 21 there AND two in europe-west3 and one in
    // europe-north1 that no document mentions — so a reader that only asks
    // about the region it expects to be wrong finds exactly the wrongness
    // it expected.
    reply["cloudfunctions.googleapis.com"] = {
      status: 200,
      body: {
        functions: [
          { name: "projects/prvfire33/locations/europe-west1/functions/onV2AnswerCreated" },
          { name: "projects/prvfire33/locations/us-central1/functions/scheduledTaxonomies" },
          { name: "projects/prvfire33/locations/us-central1/functions/rebuildWorldAggregates" },
          { name: "projects/prvfire33/locations/europe-west3/functions/somethingNobodyNamed" },
        ],
      },
    };
    const out = await observe();
    expect(out).toContain("3 outside europe-west1");
    expect(out).toContain("us-central1 (2)");
    expect(out).toContain("scheduledTaxonomies");
    // The one the old shape would have missed entirely.
    expect(out).toContain("europe-west3 (1)");
    expect(out).toContain("somethingNobodyNamed");

    const j = await asJson();
    expect(j.readings.functions.canonicalRegion).toBe("europe-west1");
    expect(j.readings.functions.strayCount).toBe(3);
    expect(Object.keys(j.readings.functions.strays).sort()).toEqual(["europe-west3", "us-central1"]);
  });

  it("stays quiet when everything is in the canonical region", async () => {
    reply["cloudfunctions.googleapis.com"] = {
      status: 200,
      body: { functions: [{ name: "projects/prvfire33/locations/europe-west1/functions/x" }] },
    };
    const out = await observe();
    expect(out).not.toContain("outside");
    expect((await asJson()).readings.functions.strayCount).toBe(0);
  });
});

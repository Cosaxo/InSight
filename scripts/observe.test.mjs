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
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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
      // `entries:list` is a POST to the same host as the metrics GET and
      // returns a different shape, so it is keyed separately. Keying the
      // whole host would make one of the two readings answer the other's
      // body — which is how a stub agrees with itself and proves nothing.
      // Three same-host pairs now, each for one reason: two readings on
      // one host returning different shapes would let a stub answer one
      // with the other's body, which is how it agrees with itself and
      // proves nothing. entries:list vs the metrics list; the BigQuery
      // datasets list vs a dataset's tables; the Firestore database vs its
      // backup schedules.
      const key = req.url.includes("entries:list") ? "logging:entries"
        : req.url.includes("/tables") ? "bigquery:tables"
          : req.url.includes("/backupSchedules") ? "firestore:schedules"
            : host;
      const r = reply[key] || { status: 200, body: {} };
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
    "bigquery.googleapis.com": { status: 200, body: { datasets: [] } },
    "bigquery:tables": { status: 200, body: { tables: [] } },
    "firestore.googleapis.com": { status: 200, body: { name: "projects/prvfire33/databases/insight", pointInTimeRecoveryEnablement: "POINT_IN_TIME_RECOVERY_DISABLED" } },
    "firestore:schedules": { status: 200, body: {} },
    "logging:entries": {
      status: 200,
      body: { entries: [{ resource: { type: "cloud_run_revision", labels: { service_name: "onv2answercreated", project_id: "p" } }, timestamp: "2026-08-26T00:00:00Z" }] },
    },
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
    // Seven probes now: the original four, D453's bigquery and D454's two
    // backup readings. The count is the assertion — a run that quietly
    // stopped making one would otherwise still look green here.
    expect(j.blocked).toHaveLength(7);
    expect(j.reachable).toEqual([]);
  });

  it("says UNREADABLE for the derived readings rather than answering them", async () => {
    // A derived reading has no probe of its own, so a refused parent is the
    // only thing standing between it and an invented answer. `canSell:
    // false` here would read as "the secrets are unset" when the truth is
    // "nobody could look" — the D296 shape, and the one this whole reader
    // exists to stop repeating.
    for (const h of Object.keys(reply)) reply[h] = { status: 403, body: { error: { message: "denied" } } };
    const j = await asJson();
    expect(j.paidPath.status).toBe("denied");
    expect(j.paidPath.canSell).toBeUndefined();
    expect(j.bqMirror.status).toBe("denied");
    expect(j.billingExport.status).toBe("denied");
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

describe("the backup reading, which nothing could answer before D451", () => {
  it("reports PITR off and no schedules when there are none — the tree's own state", async () => {
    const j = await asJson();
    expect(j.readings.backups.pitr).toBe(false);
    expect(j.readings.backupSchedules).toMatchObject({ count: 0, daily: false, weekly: false });
  });

  it("reads PITR and both schedules back once they are armed", async () => {
    reply["firestore.googleapis.com"] = {
      status: 200,
      body: { name: "projects/prvfire33/databases/insight", pointInTimeRecoveryEnablement: "POINT_IN_TIME_RECOVERY_ENABLED" },
    };
    reply["firestore:schedules"] = {
      status: 200,
      body: {
        backupSchedules: [
          { retention: "604800s", dailyRecurrence: {} },
          { retention: "8467200s", weeklyRecurrence: { day: "SUNDAY" } },
        ],
      },
    };
    const j = await asJson();
    expect(j.readings.backups.pitr).toBe(true);
    expect(j.readings.backupSchedules).toMatchObject({ count: 2, daily: true, weekly: true });
    // Retention read BACK, not assumed: a schedule created with the wrong
    // duration is accepted, listed, and quietly keeps three hours.
    expect(j.readings.backupSchedules.retention).toEqual(["604800s", "8467200s"]);
  });

  it("does not read a weekly-only project as covered", async () => {
    reply["firestore:schedules"] = {
      status: 200,
      body: { backupSchedules: [{ retention: "8467200s", weeklyRecurrence: { day: "SUNDAY" } }] },
    };
    const j = await asJson();
    expect(j.readings.backupSchedules).toMatchObject({ count: 1, daily: false, weekly: true });
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

describe("--metrics: what a log-based metric's series is written against", () => {
  // The reading that exists because guessing this shipped a 400 to
  // production on 2026-08-26, and because guessing it WRONG would have
  // shipped something quieter: a policy that is accepted, enabled and
  // permanently unable to fire.
  it("is off unless asked for", async () => {
    const j = await asJson();
    expect(j.metricResources).toBeUndefined();
  });

  it("reports the resource type the entries actually carry", async () => {
    const j = JSON.parse(await observe(["--json", "--metrics"]));
    expect(j.metricResources.length).toBeGreaterThan(0);
    for (const m of j.metricResources) {
      expect(m.status).toBe("ok");
      expect(m.resourceType).toBe("cloud_run_revision");
    }
  });

  it("reads one metric per name in apply-monitoring's own list", async () => {
    const names = [
      ...readFileSync(join(root, "scripts/apply-monitoring.mjs"), "utf8")
        .matchAll(/name:\s*"([\w]+)",[\s\S]{0,400}?filter:\s*(['"])([\s\S]*?)\2/g),
    ].map((m) => m[1]);
    const j = JSON.parse(await observe(["--json", "--metrics"]));
    expect(j.metricResources.map((m) => m.metric).sort()).toEqual(names.sort());
  });

  it("says so when nothing has emitted the metric yet, rather than inventing a type", async () => {
    // check:monitoring rule 4 proves a function CONTAINS the emit line. It
    // cannot say whether that line has ever run, and a metric with no points
    // makes an absence policy unable to fire at all (D48.1).
    reply["logging:entries"] = { status: 200, body: {} };
    const out = await observe(["--metrics"]);
    expect(out).toContain("no entry yet");
    const j = JSON.parse(await observe(["--json", "--metrics"]));
    expect(j.metricResources[0].entries).toBe(0);
    expect(j.metricResources[0].resourceType).toBeNull();
  });

  it("reports a refusal per metric instead of dying", async () => {
    reply["logging:entries"] = { status: 403, body: { error: { message: "Permission logging.logEntries.list denied." } } };
    const out = await observe(["--metrics"]);
    expect(out).toContain("grant roles/logging.viewer");
    // …and the four ordinary readings still answered.
    expect(out).toContain("✓ billing");
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

// --json-out exists so the production reader can be a workflow rather than a
// scheduled Claude session (docs/USAGE-REDUCTION.md): a reader that parses
// the padded `✓ alertPolicies  5 live` lines is the one-parser-in-three-
// copies failure D197 recorded. The two properties worth pinning are that
// the file matches what `--json` prints, and that asking for it does not
// change what a human run prints — this probe reports on production and is
// the last place to accept a reporting flag with side effects.
describe("--json-out, for the workflow reader", () => {
  it("writes the same payload --json prints, and leaves stdout human", async () => {
    const path = join(tmpdir(), `observe-json-out-${process.pid}.json`);
    const stdout = await observe(["--json-out", path]);
    const written = JSON.parse(readFileSync(path, "utf8"));
    rmSync(path, { force: true });

    expect(written).toEqual(await asJson());
    // stdout stayed the human report, not JSON.
    expect(stdout).toContain("readings available");
    expect(stdout.trimStart().startsWith("{")).toBe(false);
  });
});

// The paid loop's three secrets, the webhook's URL, and the two BigQuery
// steps — the readings D453 added, and the reason they were added:
// `OWNER-LIST.md` carried "a session cannot read the deployed environment,
// so whether a sale can go through TODAY is a fact only you can check".
// It was an ordinary API call the whole time.
describe("the money path, read from the deployment", () => {
  // The deployed shape these tests describe: paid.ts's six functions in the
  // canonical region, each carrying the dotenv the deploy baked in.
  const paidFns = (envVars) => ({
    status: 200,
    body: {
      functions: [
        "bookPaidQuestionV2", "onPaidBookingCreated", "sweepPaidReviewsV2",
        "createPaidCheckoutV2", "stripeWebhookV2", "closePaidCampaignsV2",
      ].map((n) => ({
        name: `projects/prvfire33/locations/europe-west1/functions/${n.toLowerCase()}`,
        state: "ACTIVE",
        environment: "GEN_2",
        serviceConfig: {
          uri: `https://${n.toLowerCase()}-abc123-ew.a.run.app`,
          // A COPY per function, not the shared literal: the deploy writes
          // the dotenv into each function's own config, and a helper that
          // handed all six the same object made the partial-deploy case
          // below untestable — deleting one key deleted it everywhere.
          ...(envVars ? { environmentVariables: { ...envVars } } : {}),
        },
      })),
    },
  });

  it("NEVER prints a secret's value, in any output mode", async () => {
    // THE test in this file. The functions list carries the runtime's
    // environment variables in full, and this project's secrets reach the
    // runtime through the deploy's dotenv rather than Secret Manager — so
    // the live key is literally inside the body being parsed. A reader that
    // prints presence by echoing the map would publish `sk_live_…` into an
    // Actions log readable by everyone with repo read, kept for months.
    // Same discipline auth-config.yml applies to the demo password.
    const PLANTED = "sk_live_51PLANTEDsecretvalue";
    reply["cloudfunctions.googleapis.com"] = paidFns({
      STRIPE_SECRET_KEY: PLANTED,
      STRIPE_WEBHOOK_SECRET: "whsec_PLANTEDsigning",
      ANTHROPIC_API_KEY: "sk-ant-PLANTEDkey",
    });
    for (const args of [[], ["--json"], ["--functions"]]) {
      const out = await observe(args);
      expect(out).not.toContain(PLANTED);
      expect(out).not.toContain("whsec_PLANTEDsigning");
      expect(out).not.toContain("sk-ant-PLANTEDkey");
    }
    // …and it still answered the question it was asked.
    const j = await asJson();
    expect(j.paidPath.canSell).toBe(true);
  });

  it("answers CAN A SALE COMPLETE on the two that stop one, not on all three", async () => {
    // ANTHROPIC_API_KEY unset removes the judgement half of the review and
    // stops nothing, so folding it into the verdict would report a working
    // loop as broken. Runbook 5.14 names it as the one to check rather than
    // assume, which is a separate line, not a separate outcome.
    reply["cloudfunctions.googleapis.com"] = paidFns({
      STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x",
    });
    const j = await asJson();
    expect(j.paidPath.canSell).toBe(true);
    expect(j.paidPath.reviewJudged).toBe(false);
    const out = await observe();
    expect(out).toContain("A sale can complete today: YES");
    expect(out).toContain("deterministic gates alone");
  });

  it("says NO when the two that stop a sale are unset", async () => {
    reply["cloudfunctions.googleapis.com"] = paidFns({ SEED_ADMIN_UIDS: "uid1" });
    const j = await asJson();
    expect(j.paidPath.canSell).toBe(false);
    expect(j.paidPath.secrets.STRIPE_SECRET_KEY.on).toBe(0);
    const out = await observe();
    expect(out).toContain("A sale can complete today: NO");
    expect(out).toContain("STRIPE_SECRET_KEY");
    expect(out).toContain("NOT SET");
  });

  it("tells an ABSENT env map apart from an unset secret", async () => {
    // The two look identical to a reader that folds them, and they have
    // opposite fixes: one is a secret to set, the other is a reading that
    // did not come back. Reporting the second as the first is how an
    // instrument invents a measurement.
    reply["cloudfunctions.googleapis.com"] = paidFns(null);
    const j = await asJson();
    expect(j.paidPath.envReadable).toBe(false);
    expect(j.paidPath.canSell).toBe(false);
    const out = await observe();
    expect(out).toContain("UNREADABLE");
    expect(out).not.toContain("NOT SET");
  });

  it("prints the webhook URL runbook 5.14 step 2 asks for, and its three events", async () => {
    // Before this line existed the step read "run gcloud functions
    // describe", which needs a laptop with a credential on it.
    reply["cloudfunctions.googleapis.com"] = paidFns({ STRIPE_SECRET_KEY: "sk_test_x" });
    const out = await observe();
    expect(out).toContain("https://stripewebhookv2-abc123-ew.a.run.app");
    expect(out).toContain("async_payment_succeeded");
    expect(out).toContain("async_payment_failed");
  });

  it("reads the three names from paid.ts rather than from a copy here", async () => {
    // If the module renames one, this reader must follow it. A retyped list
    // would keep printing the old name as NOT SET — which reads as a missing
    // secret and is a missing reader.
    const src = readFileSync(join(root, "functions/src/paid.ts"), "utf8");
    reply["cloudfunctions.googleapis.com"] = paidFns({ STRIPE_SECRET_KEY: "sk_test_x" });
    const j = await asJson();
    for (const n of Object.keys(j.paidPath.secrets)) {
      expect(src).toContain(`process.env.${n}`);
    }
    expect(Object.keys(j.paidPath.secrets)).toContain("STRIPE_WEBHOOK_SECRET");
  });

  it("counts a PARTIAL deploy rather than calling it set", async () => {
    // The dotenv is written per deploy, so a name on some functions and not
    // others means a deploy that did not finish — visible only as a count.
    const r = paidFns({ STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x" });
    delete r.body.functions[0].serviceConfig.environmentVariables.STRIPE_SECRET_KEY;
    reply["cloudfunctions.googleapis.com"] = r;
    const j = await asJson();
    expect(j.paidPath.secrets.STRIPE_SECRET_KEY.on).toBe(5);
    expect(j.paidPath.secrets.STRIPE_SECRET_KEY.of).toBe(6);
    expect(await observe()).toContain("re-deploy");
  });
});

describe("the two BigQuery steps (runbook 5.11, 5.12)", () => {
  it("detects the mirror by its EXTENSION functions, not by a dataset name", async () => {
    // A dataset called firestore_export can be created by anyone; an
    // ext-firestore-bigquery-export function IS the extension.
    reply["cloudfunctions.googleapis.com"] = {
      status: 200,
      body: {
        functions: [{
          name: "projects/prvfire33/locations/europe-west1/functions/ext-firestore-bigquery-export-fsexportbigquery",
          state: "ACTIVE",
        }],
      },
    };
    const j = await asJson();
    expect(j.bqMirror.installed).toBe(true);
    expect(await observe()).toContain("mirror");
  });

  it("reports the mirror absent, with WHY the timing is the step", async () => {
    const j = await asJson();
    expect(j.bqMirror.installed).toBe(false);
    const out = await observe();
    expect(out).toContain("not installed");
    // 5.11's whole argument is that installing late loses the rows of
    // accounts erased in the interim. A box that says only "not installed"
    // invites doing it now, which the step forbids.
    expect(out).toContain("erased in the interim");
  });

  it("finds the billing export by its TABLE names and reports the dataset's location", async () => {
    reply["bigquery.googleapis.com"] = {
      status: 200,
      body: { datasets: [{ datasetReference: { datasetId: "billing" }, location: "EU" }] },
    };
    reply["bigquery:tables"] = {
      status: 200,
      body: { tables: [{ tableReference: { tableId: "gcp_billing_export_v1_0123AB" } }] },
    };
    const j = await asJson();
    expect(j.billingExport.on).toBe(true);
    expect(j.billingExport.hits[0].location).toBe("EU");
    expect(await observe()).toContain("gcp_billing_export_v1_0123AB");
  });

  it("does not call an unrelated dataset a billing export", async () => {
    // The dataset name proves nothing — 5.12 lets the operator choose it —
    // so a reader keyed on the name would report any dataset as the export.
    reply["bigquery.googleapis.com"] = {
      status: 200,
      body: { datasets: [{ datasetReference: { datasetId: "billing" }, location: "EU" }] },
    };
    reply["bigquery:tables"] = { status: 200, body: { tables: [{ tableReference: { tableId: "notes" } }] } };
    const j = await asJson();
    expect(j.billingExport.on).toBe(false);
    expect(await observe()).toContain("not on");
  });

  it("prints each dataset's location, which is what D165's residency argument needs", async () => {
    reply["bigquery.googleapis.com"] = {
      status: 200,
      body: { datasets: [{ datasetReference: { datasetId: "firestore_export" }, location: "us-central1" }] },
    };
    expect(await observe()).toContain("firestore_export (us-central1)");
  });
});

// apply-budget.test.mjs — the budget applier, against a stub Google.
//
// The halves that matter, because each fails silently in the project:
//
//   THE FILTER. The Budgets API matches `projects/{project_number}`; a
//   budget filtered to anything else tracks $0 forever and never fires,
//   which reads as "spending is fine" from the one control whose job is to
//   be the backstop. So the POST body is pinned to the NUMBER the stub's
//   Resource Manager returns, not to the id the operator typed.
//
//   THE FIGURE. It must come from monitoring/rates.json's guard — the same
//   number the pulse reds on (D332) — read off disk here the way the
//   script reads it, so a retune of one cannot quietly leave the other.
//
//   THE GRANT. Budgets live on the billing account, where the project
//   roles that carry every other script say nothing. The 403 must name
//   roles/billing.costsManager AND the account, or the operator gets a
//   refusal that looks like the project-side ones they have already fixed.

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
const SCRIPT = join(root, "scripts/apply-budget.mjs");

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const SA = JSON.stringify({ private_key: privateKey, client_email: "deploy@prvfire33.iam.gserviceaccount.com" });

// The tree's own figures, read the way the script reads them — retyping
// 500 here would let the two drift, which is the exact failure the shared
// source exists to prevent. budget.amount (the account-currency figure,
// NOK since the first live apply) wins over the USD tolerance, mirroring
// the script's precedence; removing guard.budget flips both back to the
// USD forms, and these assertions will say so.
const GUARD = JSON.parse(readFileSync(join(root, "monitoring/rates.json"), "utf8")).guard;
const GUARD_AMOUNT = GUARD.budget?.amount ?? GUARD.maxNetBurnUsdPerMonth;
const GUARD_CURRENCY = GUARD.budget?.currency ?? "USD";

const NUMBER = "123456789012";
const BA = "billingAccounts/AAAAAA-BBBBBB-CCCCCC";
const CRM = "/cloudresourcemanager.googleapis.com/v1/projects/prvfire33";
const INFO = "/cloudbilling.googleapis.com/v1/projects/prvfire33/billingInfo";
const BUDGETS = `/billingbudgets.googleapis.com/v1/${BA}/budgets`;

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
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(tokenReply);
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

/** A budget as the API lists it. */
const listedBudget = (over = {}) => ({
  name: `${BA}/budgets/b1`,
  displayName: "InSight",
  budgetFilter: { projects: [`projects/${NUMBER}`] },
  amount: { specifiedAmount: { currencyCode: GUARD_CURRENCY, units: String(GUARD_AMOUNT) } },
  thresholdRules: [0.5, 0.9, 1.0, 1.5].map((p) => ({ thresholdPercent: p })),
  ...over,
});

beforeEach(() => {
  calls = [];
  tokenReply = JSON.stringify({ access_token: "TOK" });
  reply = {
    [key("GET", CRM)]: { status: 200, body: { projectNumber: NUMBER, projectId: "prvfire33" } },
    [key("GET", INFO)]: { status: 200, body: { billingEnabled: true, billingAccountName: BA } },
    [key("GET", BUDGETS)]: { status: 200, body: { budgets: [] } },
    [key("POST", BUDGETS)]: {
      status: 200,
      body: { name: `${BA}/budgets/b1`, amount: { specifiedAmount: { currencyCode: GUARD_CURRENCY, units: String(GUARD_AMOUNT) } } },
    },
  };
});

// Built per call, not at module scope: `base` does not exist until
// beforeAll has started the server, and an env captured before that hands
// the child an empty GOOGLE_API_BASE — which routes the token exchange to
// the real Google, the one failure the seam must not have.
const env = () => ({ ...process.env, FIREBASE_SERVICE_ACCOUNT: SA, GOOGLE_API_BASE: base, FIREBASE_PROJECT_ID: "prvfire33" });
const apply = async (args = []) => (await run("node", [SCRIPT, ...args], { env: env() })).stdout;
const applyFails = async (args = []) => {
  try {
    await run("node", [SCRIPT, ...args], { env: env() });
  } catch (err) {
    return String(err.stderr || "");
  }
  throw new Error("expected the script to exit non-zero");
};

describe("apply-budget", () => {
  it("dry run reads everything, writes nothing, and signs its reads", async () => {
    const out = await apply();
    expect(out).toMatch(/would create budget "InSight"/);
    expect(out).toMatch(new RegExp(`${GUARD_AMOUNT}/month`));
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
    // A stub that ignores Authorization cannot tell a signed request from
    // an anonymous one (the apply-monitoring lesson) — so the header is
    // asserted, on the call the missing role would refuse.
    expect(calls.find((c) => c.url === BUDGETS)?.auth).toBe("Bearer TOK");
  });

  it("creates with the RESOLVED project number and the guard's own figure", async () => {
    await apply(["--apply"]);
    const post = calls.find((c) => c.method === "POST");
    expect(post).toBeDefined();
    expect(post.body.displayName).toBe("InSight");
    // The number from Resource Manager, never the typed id — a filter that
    // matches nothing is a budget that never fires.
    expect(post.body.budgetFilter.projects).toEqual([`projects/${NUMBER}`]);
    expect(post.body.amount.specifiedAmount.units).toBe(String(GUARD_AMOUNT));
    expect(post.body.thresholdRules.map((t) => t.thresholdPercent)).toEqual([0.5, 0.9, 1.0, 1.5]);
  });

  it("the recorded currency comes back as confirmation, not a warning", async () => {
    // The first live apply recorded the account's NOK in guard.budget; a
    // warning that fires on the expected currency every run stops being
    // read, which un-arms it for the day the currency actually changes.
    const out = await apply(["--apply"]);
    expect(out).toMatch(new RegExp(`\\(${GUARD_CURRENCY}, as recorded\\)`));
    expect(out).not.toMatch(/WARNING/);
  });

  it("warns when the account bills in a currency the guard does not record", async () => {
    // The original trap, keyed to the record now that one exists: an
    // unexpected currency is AMOUNT of the wrong money standing in for
    // the figure the guard means. EUR mismatches whether the tree records
    // NOK (today) or the record is removed (declared falls back to USD).
    reply[key("POST", BUDGETS)] = {
      status: 200,
      body: { name: `${BA}/budgets/b1`, amount: { specifiedAmount: { currencyCode: "EUR", units: String(GUARD_AMOUNT) } } },
    };
    const out = await apply(["--apply"]);
    expect(out).toMatch(new RegExp(`EUR — WARNING: the guard records ${GUARD_CURRENCY}`));
    expect(out).toMatch(/record it in/);
  });

  it("is idempotent: a matching budget means zero writes, --apply or not", async () => {
    reply[key("GET", BUDGETS)] = { status: 200, body: { budgets: [listedBudget()] } };
    const out = await apply(["--apply"]);
    expect(out).toMatch(/exists and matches/);
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("retunes a drifted amount through PATCH, masked to the fields it owns", async () => {
    reply[key("GET", BUDGETS)] = {
      status: 200,
      body: { budgets: [listedBudget({ amount: { specifiedAmount: { currencyCode: "USD", units: "25" } } })] },
    };
    const patchUrl = `/billingbudgets.googleapis.com/v1/${BA}/budgets/b1?updateMask=amount,thresholdRules`;
    reply[key("PATCH", patchUrl)] = { status: 200, body: listedBudget() };

    // Dry first: says so, touches nothing.
    const dry = await apply();
    expect(dry).toMatch(/would retune/);
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);

    calls = [];
    const out = await apply(["--apply"]);
    expect(out).toMatch(/retuned budget "InSight"/);
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.url).toBe(patchUrl);
    // The filter is deliberately outside the mask — a re-scoped budget must
    // not be silently re-narrowed by a retune that was about the amount.
    expect(Object.keys(patch.body).sort()).toEqual(["amount", "thresholdRules"]);
  });

  it("a 403 on budgets names the billing-account role, not a project one", async () => {
    reply[key("GET", BUDGETS)] = {
      status: 403,
      body: { error: { message: "The caller does not have permission" } },
    };
    const err = await applyFails();
    expect(err).toMatch(/roles\/billing\.costsManager/);
    expect(err).toMatch(new RegExp(`BILLING ACCOUNT ${BA}`));
    expect(err).toMatch(/deploy@prvfire33\.iam\.gserviceaccount\.com/);
  });

  it("a disabled-API 403 points at the API, not at the grant", async () => {
    // The first live run's actual first refusal (2026-08-27): Google gates
    // the Budgets API on the caller's project, and the canned grant fix for
    // it is a wrong turn — that role is a billing-account grant the API
    // being off says nothing about, and the API enable needs no human.
    reply[key("GET", BUDGETS)] = {
      status: 403,
      body: { error: { message: "Cloud Billing Budget API has not been used in project 123456789012 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/billingbudgets.googleapis.com/overview?project=123456789012 then retry." } },
    };
    const err = await applyFails();
    expect(err).toMatch(/enable billingbudgets\.googleapis\.com on project prvfire33/);
    expect(err).not.toMatch(/costsManager/);
  });

  it("says plainly when the project has no billing to watch", async () => {
    reply[key("GET", INFO)] = { status: 200, body: { billingEnabled: false } };
    const err = await applyFails();
    expect(err).toMatch(/no active billing account/);
  });
});

describe("the workflow form the operator actually fills in", () => {
  // The script's figure is right and pinned above; what the operator READS
  // was not. The Arm budget form said an empty box means
  // `guard.maxNetBurnUsdPerMonth` — "the same number the pulse guard reds
  // on" — which stopped being true when guard.budget.amount arrived at the
  // first live apply. An operator trusting that sentence and typing the
  // USD figure into the box arms a 50 NOK budget: about a tenth of the
  // intended one, on the one control whose whole job is to be the backstop.
  // That is the failure rates.json already records happening once, and the
  // field it happened in is not covered by any figure gate.
  const yml = readFileSync(join(root, ".github/workflows/budget.yml"), "utf8");
  const description = (() => {
    const m = /^ {6}amount:\n {8}description: "(.+)"$/m.exec(yml);
    expect(m, "budget.yml no longer has an `amount` input with a quoted description")
      .toBeTruthy();
    return m[1];
  })();

  it("names the field the script actually prefers", () => {
    // Precedence, not just presence: whichever of the two the script would
    // resolve to is the one the form has to name.
    expect(description).toContain(
      GUARD.budget?.amount != null ? "guard.budget.amount" : "guard.maxNetBurnUsdPerMonth");
  });

  it("states the figure and the currency an empty box resolves to", () => {
    expect(description).toContain(`${GUARD_AMOUNT} ${GUARD_CURRENCY}`);
    // And the USD tolerance stays in the sentence as the RELATION between
    // the two, so retuning either one reds this rather than drifting.
    expect(description).toContain(`$${GUARD.maxNetBurnUsdPerMonth}`);
  });

  it("warns against typing the USD figure into a box the account reads as NOK", () => {
    if (GUARD_CURRENCY === "USD") return; // no trap to warn about
    expect(description).toMatch(
      new RegExp(`${GUARD.maxNetBurnUsdPerMonth}\\s+${GUARD_CURRENCY}`));
  });
});

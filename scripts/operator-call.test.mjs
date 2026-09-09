// operator-call.test.mjs — the error paths, because the happy path was the
// only one anyone had ever seen.
//
// WHY THIS EXISTS. The first production dry run of rebuildAggregateV2
// (2026-08-25) raced the deploy that was still shipping the function, so
// cloudfunctions.net answered with a 404 HTML page. `res.json()` reported
// that as:
//
//     Unexpected token '<', "\n<html><hea"... is not valid JSON
//
// which names neither the status, nor the URL, nor the function — and reads
// like a bug in the caller. It cost a diagnosis to establish that nothing
// had gone wrong except the ordering. The fix is small; what keeps it fixed
// is this file, because every one of these paths is reached during an
// incident and never during development.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "node:http";
import { generateKeyPairSync } from "node:crypto";
import { operatorContext, callOperator } from "./operator-call.mjs";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const SA = JSON.stringify({
  private_key: privateKey,
  client_email: "sa@prvfire33.iam.gserviceaccount.com",
});

// What the stub answers with. Each test sets one of these and calls.
let identity = { status: 200, type: "application/json", body: { idToken: "ID-TOKEN-XYZ" } };
let callable = { status: 200, type: "application/json", body: { result: { drift: "none" } } };

let server, base;

beforeAll(async () => {
  server = createServer((req, res) => {
    req.on("data", () => {});
    req.on("end", () => {
      const p = new URL(req.url, "http://x").pathname;
      const r = p === "/v1/accounts:signInWithCustomToken" ? identity : callable;
      res.writeHead(r.status, { "content-type": r.type });
      res.end(typeof r.body === "string" ? r.body : JSON.stringify(r.body));
    });
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server?.close());

beforeEach(() => {
  identity = { status: 200, type: "application/json", body: { idToken: "ID-TOKEN-XYZ" } };
  callable = { status: 200, type: "application/json", body: { result: { drift: "none" } } };
  Object.assign(process.env, {
    FIREBASE_SERVICE_ACCOUNT: SA,
    VITE_FIREBASE_API_KEY: "AIzaSyTESTKEY",
    SEED_ADMIN_UIDS: "operator-uid-123",
    SEED_IDENTITY_BASE: base,
    SEED_FUNCTIONS_BASE: base,
  });
});

const call = () => callOperator(operatorContext("t"), "rebuildAggregateV2", { qid: "daily-000" });

/** The message an operator actually reads. */
async function failure() {
  try {
    await call();
  } catch (e) {
    return e.message;
  }
  throw new Error("expected callOperator to throw");
}

const HTML_404 = "\n<html><head><title>Error 404 (Not Found)</title></head><body>Not Found</body></html>\n";

describe("callOperator", () => {
  it("returns the callable's result unchanged", async () => {
    expect(await call()).toEqual({ drift: "none" });
  });

  it("names the status, the URL and the function when the body is HTML", async () => {
    callable = { status: 404, type: "text/html", body: HTML_404 };
    const msg = await failure();
    expect(msg).toContain("rebuildAggregateV2");
    expect(msg).toContain("404");
    expect(msg).toContain(`${base}/rebuildAggregateV2`);
    // The thing the 2026-08-25 run could not say for itself.
    expect(msg).not.toContain("Unexpected token");
  });

  it("points a 404 at the DEPLOY rather than at the function's log", async () => {
    callable = { status: 404, type: "text/html", body: HTML_404 };
    const msg = await failure();
    expect(msg).toMatch(/DEPLOYED/);
    // The fn-log fallback prints "nothing here" for this case, which reads
    // like a missing log unless something says the request never arrived.
    expect(msg).toMatch(/log is empty|nothing in it/);
  });

  it("blames the platform, not the function body, on a 5xx HTML page", async () => {
    callable = { status: 502, type: "text/html", body: "<html>502 Bad Gateway</html>" };
    const msg = await failure();
    expect(msg).toContain("502");
    expect(msg).toMatch(/platform in front of the function/);
    expect(msg).not.toMatch(/DEPLOYED/);
  });

  it("truncates the body rather than pasting a whole error page into the log", async () => {
    callable = { status: 500, type: "text/html", body: `<html>${"x".repeat(5000)}</html>` };
    const msg = await failure();
    expect(msg.length).toBeLessThan(800);
  });

  it("survives an empty body, which is what a dropped connection looks like", async () => {
    callable = { status: 503, type: "text/html", body: "" };
    expect(await failure()).toContain("(empty)");
  });

  it("redacts the API key when the token exchange answers with HTML", async () => {
    identity = { status: 403, type: "text/html", body: "<html>403</html>" };
    const msg = await failure();
    expect(msg).toContain("custom-token exchange");
    expect(msg).toContain("key=***");
    expect(msg).not.toContain("AIzaSyTESTKEY");
  });

  it("still reports a JSON error with its status and message", async () => {
    callable = { status: 400, type: "application/json", body: { error: { status: "INVALID_ARGUMENT", message: "unknown qid" } } };
    const msg = await failure();
    expect(msg).toContain("INVALID_ARGUMENT");
    expect(msg).toContain("unknown qid");
  });

  it("still explains a bare INTERNAL, which carries no detail of its own", async () => {
    callable = { status: 500, type: "application/json", body: { error: { status: "INTERNAL", message: "INTERNAL" } } };
    expect(await failure()).toMatch(/non-HttpsError/);
  });
});

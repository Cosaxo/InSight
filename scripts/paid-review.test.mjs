// paid-review.test.mjs — the review queue's script, against a stub Firestore.
//
// What matters here is that it NEVER settles a booking twice. The sweep, a
// second Routine firing and a person could all be looking at this queue at
// once, and writing a verdict onto a booking that has moved on would take a
// paid, live campaign back to declined.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateKeyPairSync } from "node:crypto";

import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(root, "scripts/paid-review.mjs");

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const SA = JSON.stringify({ private_key: privateKey, client_email: "sa@prvfire33.iam.gserviceaccount.com" });

let reply, seen, server, base;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      if (req.url.includes("oauth2.googleapis.com")) {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ access_token: "TOK" }));
      }
      seen.push({ method: req.method, url: req.url, body });
      const key = req.url.includes("runQuery") ? "query" : req.method === "PATCH" ? "patch" : "get";
      const r = reply[key] || { status: 200, body: {} };
      res.writeHead(r.status, { "content-type": "application/json" });
      res.end(JSON.stringify(r.body));
    });
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => server?.close());

const doc = (status, extra = {}) => ({
  name: "projects/prvfire33/databases/insight/documents/v2_paid_bookings/b1",
  fields: {
    status: { stringValue: status },
    prompt: { stringValue: "Should the harbour bath stay open all winter?" },
    type: { stringValue: "binary" },
    options: { arrayValue: { values: [{ stringValue: "Keep it open" }, { stringValue: "Close it" }] } },
    scope: { stringValue: "city" },
    dims: { mapValue: { fields: { city: { stringValue: "Oslo, NO" } } } },
    buyerName: { nullValue: null },
    ...extra,
  },
});

beforeEach(() => {
  seen = [];
  reply = {
    query: { status: 200, body: [{ document: doc("review") }] },
    get: { status: 200, body: doc("review") },
    patch: { status: 200, body: {} },
  };
});

const cli = async (args) => {
  const { stdout } = await run("node", [SCRIPT, ...args], {
    env: { ...process.env, FIREBASE_SERVICE_ACCOUNT: SA, FIREBASE_PROJECT_ID: "prvfire33", GOOGLE_API_BASE: base },
  });
  return stdout;
};

describe("--list, which is what the Routine reads", () => {
  it("prints the submission AND the guidelines it is judged against", async () => {
    // The session is the reviewer; handing it the questions without the
    // rules would make every firing judge by whatever it happened to
    // remember. The rules are read out of paid.ts, so they cannot drift
    // from the ones the server-side path would have used.
    const out = await cli(["--list"]);
    expect(out).toContain("harbour bath");
    expect(out).toContain("DECLINE when the submission");
    expect(out).toContain("Names or identifies a PRIVATE person");
  });

  it("asks the server for review-status bookings only, not the whole collection", async () => {
    await cli(["--list"]);
    const q = seen.find((s) => s.url.includes("runQuery"));
    expect(q, "it did not run a query at all").toBeTruthy();
    const sent = JSON.parse(q.body);
    expect(sent.structuredQuery.where.fieldFilter.value.stringValue).toBe("review");
    expect(sent.structuredQuery.from[0].collectionId).toBe("v2_paid_bookings");
  });

  it("says so plainly when the queue is empty", async () => {
    reply.query = { status: 200, body: [{ readTime: "x" }] };
    expect(await cli(["--list"])).toContain("nothing in review");
  });

  it("reads the database id from the source rather than defaulting", async () => {
    // The wrong database answers an EMPTY queue and reports "nothing to
    // do", which is the most convincing way this script could fail.
    await cli(["--list"]);
    const q = seen.find((s) => s.url.includes("runQuery"));
    expect(q.url).toContain("/databases/insight/");
    expect(q.url).not.toContain("(default)");
  });
});

describe("--verdict", () => {
  it("writes an approval, and says the buyer can now pay", async () => {
    const out = await cli(["--verdict", "b1", "approve"]);
    const patch = seen.find((s) => s.method === "PATCH");
    expect(JSON.parse(patch.body).fields.status.stringValue).toBe("approved");
    expect(out).toContain("can now pay");
    // WHERE THE PRICE COMES FROM. This note told the reviewer the buyer is
    // charged "the quote on the doc"; a booking in this queue has none —
    // the quote is written by the verdict transaction of the review path
    // that did not run, which is why the booking is here at all — and
    // checkout prices it off the committed card instead.
    expect(out, "the note promises a quote this booking does not carry")
      .not.toContain("quote on the doc");
    expect(out).toContain("no quote");
    expect(out).toContain("set at checkout");
  });

  it("records WHO ruled, so a routine verdict is not mistaken for the model's", async () => {
    await cli(["--verdict", "b1", "approve"]);
    const sent = JSON.parse(seen.find((s) => s.method === "PATCH").body);
    expect(sent.fields.review.mapValue.fields.by.stringValue).toBe("routine");
    expect(sent.fields.review.mapValue.fields.model.nullValue).toBeDefined();
  });

  it("carries the decline reason, which the buyer reads verbatim", async () => {
    await cli(["--verdict", "b1", "decline", "--reason", "Questions about named private people aren't sold here."]);
    const sent = JSON.parse(seen.find((s) => s.method === "PATCH").body);
    expect(sent.fields.status.stringValue).toBe("declined");
    expect(sent.fields.note.stringValue).toMatch(/named private people/);
  });

  it("REFUSES a booking that has already moved on, and writes nothing", async () => {
    // The case this file exists for. A live booking has been PAID for;
    // writing "declined" onto it would take a running campaign down and
    // strand the money.
    reply.get = { status: 200, body: doc("live") };
    const out = await cli(["--verdict", "b1", "decline", "--reason", "no"]);
    expect(out).toContain('already "live"');
    expect(seen.some((s) => s.method === "PATCH"), "it wrote to a settled booking").toBe(false);
  });

  it("reads before it writes, in that order", async () => {
    await cli(["--verdict", "b1", "approve"]);
    const methods = seen.map((s) => s.method);
    expect(methods.indexOf("GET")).toBeLessThan(methods.indexOf("PATCH"));
  });

  it("refuses a decline with no reason, without touching the server", async () => {
    await expect(cli(["--verdict", "b1", "decline"])).rejects.toThrow();
    expect(seen.some((s) => s.method === "PATCH")).toBe(false);
  });

  it("refuses a verdict that is neither approve nor decline", async () => {
    await expect(cli(["--verdict", "b1", "maybe"])).rejects.toThrow();
    expect(seen.some((s) => s.method === "PATCH")).toBe(false);
  });

  it("sends an updateMask, so a verdict cannot blank the rest of the booking", async () => {
    // A PATCH without one REPLACES the document in Firestore's REST API —
    // the quote, the payload and the buyer would all go, and the first
    // sign of it would be checkout failing to find a quote.
    await cli(["--verdict", "b1", "approve"]);
    const patch = seen.find((s) => s.method === "PATCH");
    expect(patch.url).toContain("updateMask.fieldPaths=status");
    expect(patch.url).toContain("updateMask.fieldPaths=review");
  });
});

// auth-config.test.mjs — the auth-settings operator script, against a stub
// Google, in the shape appcheck.test.mjs established.
//
// WHAT IS WORTH PINNING, and it is not the happy path:
//
//   1. THE DRY RUN. This script writes to the live Firebase project's auth
//      configuration. A run without --apply must make ZERO writes, and the
//      assertion is on the METHOD of every recorded request rather than on
//      the words the script printed — a script can say "dry run" and PATCH
//      anyway, which is the only version of this bug that matters.
//   2. THE UPDATE MASK. A PATCH to this endpoint without a narrow mask
//      sends back whatever this process holds for every other notification
//      field, which on a partial read flattens the config — the templates
//      would be reset to Firebase's defaults by a run that meant to change
//      a name. Pinned as an exact string in the query.
//   3. THE REPORT IS HONEST ABOUT AN UNSET NAME. Runbook 5.16 exists on
//      the claim that an unset senderDisplayName means the mail arrives
//      from the project id. The script must report the field as it finds
//      it, not assert the claim — a report that prints the conclusion
//      whatever the API said is a report of nothing.
//
// WHAT IS NOT COVERED, said out loud because an undisclosed gap in a test
// reads as a guarantee: `--demo-account` goes through firebase-admin,
// which does not honour GOOGLE_API_BASE, so its Auth calls cannot be
// pointed at the stub. Its dry-run half is unreachable here for the same
// reason (the existence check is a real network read). What that path
// does is one createUser/updateUser call with emailVerified true, and the
// property that matters — the password never reaching stdout — is asserted
// below on the code rather than on a run.

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
const SCRIPT = join(root, "scripts/auth-config.mjs");

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const SA = JSON.stringify({
  private_key: privateKey,
  client_email: "deploy@prvfire33.iam.gserviceaccount.com",
});

let config, calls, server, base;

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
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(config));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((r) => server.close(r)));

beforeEach(() => {
  calls = [];
  config = { notification: { sendEmail: { senderLocalPart: "noreply" } } };
});

const exec = (args = []) => run("node", [SCRIPT, ...args], {
  env: {
    ...process.env,
    GOOGLE_API_BASE: base,
    FIREBASE_SERVICE_ACCOUNT: SA,
    FIREBASE_PROJECT_ID: "prvfire33",
  },
});

describe("the report", () => {
  it("says the sender name is unset, and names what a recipient therefore sees", async () => {
    const { stdout } = await exec();
    expect(stdout).toMatch(/senderDisplayName is UNSET/);
    // The project id, because that is what the runbook step is about.
    expect(stdout).toMatch(/prvfire33/);
    expect(calls.every((c) => c.method === "GET"), "the report wrote something").toBe(true);
  });

  it("reports a name it finds rather than the conclusion it expects", async () => {
    config.notification.sendEmail.senderDisplayName = "Something Else";
    const { stdout } = await exec();
    expect(stdout).toMatch(/"Something Else", not "InSight"/);
    expect(stdout).not.toMatch(/UNSET/);
  });

  it("says nothing needs doing once the name is right", async () => {
    config.notification.sendEmail.senderDisplayName = "InSight";
    const { stdout } = await exec();
    expect(stdout).toMatch(/already "InSight"/);
  });
});

describe("--sender-name", () => {
  it("writes NOTHING without --apply", async () => {
    const { stdout } = await exec(["--sender-name"]);
    expect(stdout).toMatch(/dry run/);
    // The assertion that matters: no write reached the API, whatever was
    // printed. A PATCH here would have changed the live project.
    expect(calls.filter((c) => c.method !== "GET")).toEqual([]);
  });

  it("with --apply, PATCHes exactly one field under a narrow mask", async () => {
    await exec(["--sender-name", "--apply"]);
    const writes = calls.filter((c) => c.method === "PATCH");
    expect(writes).toHaveLength(1);
    expect(writes[0].url).toContain(
      `updateMask=${encodeURIComponent("notification.sendEmail.senderDisplayName")}`,
    );
    // The body carries the one field and no other, so a partial read of
    // the config cannot flatten the templates on the way back.
    expect(writes[0].body).toEqual({
      notification: { sendEmail: { senderDisplayName: "InSight" } },
    });
  });

  it("does not write when the name is already right", async () => {
    config.notification.sendEmail.senderDisplayName = "InSight";
    await exec(["--sender-name", "--apply"]);
    expect(calls.filter((c) => c.method === "PATCH")).toEqual([]);
  });

  it("names the IAM role when the API refuses", async () => {
    // A 403 here is a missing role, not a broken template, and the message
    // has to send the reader to the right console page.
    server.close();
    server = createServer((req, res) => {
      if (req.url.startsWith("/oauth2.googleapis.com")) {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ access_token: "TOK" }));
      }
      res.writeHead(403, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "permission denied" } }));
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${server.address().port}`;
    await expect(exec()).rejects.toThrow(/firebaseauth\.admin/);
  });
});

describe("the demo account's credentials", () => {
  it("are written to a file and never to stdout", () => {
    // Asserted on the source because the path cannot be exercised against
    // a stub (see the header). The property is the same one
    // appcheck.test.mjs pins for debug tokens: an Actions log is readable
    // by everyone with repo read and is kept for months, so a credential
    // must not be printed even once.
    const src = readFileSync(SCRIPT, "utf8");
    // The word may appear in prose ("the credential has nowhere to go");
    // what must never appear is the VALUE, so this keys on the variable
    // being interpolated into a log line rather than on the noun.
    const printsPassword = /console\.log\([^)]*\$\{\s*password\s*\}/.test(src);
    expect(printsPassword, "the password value reaches a log line").toBe(false);
    expect(src).toMatch(/writeFileSync\(out/);
    // …and the flag that makes the whole account worth having.
    expect(src).toMatch(/emailVerified: true/);
  });
});

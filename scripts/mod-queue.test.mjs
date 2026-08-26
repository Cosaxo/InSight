// mod-queue.test.mjs — the reviewer CLI, end to end against a stub
// identitytoolkit and stub callables.
//
// WHY, in the words seed-content.test.mjs uses: a committed test is the
// only version of "verified" that stays true after the day it was written.
// This tool's whole reason to exist is that the moderation callables had
// been deployed and enforcing for weeks with no caller outside an e2e
// harness — so it must not itself become a script nobody can run.
//
// The verdict-shape assertions matter more here than in the other operator
// scripts. `modVerdictError` on the server rejects anything but two exact
// key sets, so a CLI that sends a stray field gets `invalid-argument` for a
// verdict the moderator meant — and would learn that during an incident.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateKeyPairSync } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(root, "scripts/mod-queue.mjs");

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const SA = JSON.stringify({ private_key: privateKey, client_email: "sa@prvfire33.iam.gserviceaccount.com" });

let server, base, received;
let queueResponse, verdictResponse, verdictStatus;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      const p = new URL(req.url, "http://x").pathname;
      if (p === "/v1/accounts:signInWithCustomToken") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ idToken: "ID-TOKEN" }));
      }
      received.push({ fn: p.slice(1), body: JSON.parse(body || "{}") });
      if (p === "/fetchModQueue") {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ result: queueResponse }));
      }
      res.writeHead(verdictStatus, { "content-type": "application/json" });
      res.end(JSON.stringify(verdictResponse));
    });
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => server?.close());

beforeEach(() => {
  received = [];
  verdictStatus = 200;
  verdictResponse = { result: { recorded: true } };
  queueResponse = {
    advisory: false,
    runCap: 50,
    items: [
      { takeId: "t_abc", kind: "take", text: "a flagged sentence", flags: 4, escalated: false, escalations: 0 },
      { takeId: "t_esc", kind: "take", text: "a deferred one", flags: 9, escalated: true, escalations: 2 },
      // text: "" — what runBuildModQueue actually writes for an avatar
      { takeId: "t_av", kind: "avatar", token: "tok1", bucket: "b1", text: "", flags: 3, escalated: false, escalations: 0 },
    ],
  };
});

const modq = (args = []) =>
  run("node", [SCRIPT, ...args], {
    env: {
      ...process.env,
      FIREBASE_SERVICE_ACCOUNT: SA,
      VITE_FIREBASE_API_KEY: "AIzaTEST",
      SEED_ADMIN_UIDS: "u_mod",
      SEED_IDENTITY_BASE: base,
      SEED_FUNCTIONS_BASE: base,
    },
  });

const fails = async (args) => {
  try {
    await modq(args);
  } catch (e) {
    return `${e.stdout || ""}${e.stderr || ""}`;
  }
  throw new Error("expected a non-zero exit");
};

describe("reading the queue", () => {
  it("lists every item with its flag count", async () => {
    const { stdout } = await modq();
    expect(stdout).toContain("3 item(s)");
    expect(stdout).toContain("t_abc");
    expect(stdout).toContain("4 flag(s)");
    expect(stdout).toContain("a flagged sentence");
    expect(received.map((r) => r.fn)).toEqual(["fetchModQueue"]);
  });

  it("surfaces the standing escalation signal, which survives a rebuild", async () => {
    const { stdout } = await modq();
    expect(stdout).toContain("ESCALATED this generation");
    expect(stdout).toContain("deferred 2x before");
  });

  it("renders an avatar entry as a token and bucket, not as an empty take", async () => {
    // D178 — the content IS the image, and the server sends `text: ""` on
    // those entries (moderation.ts:334). So the failure this guards is not
    // an `undefined`: it is an avatar rendered as a take with an empty
    // body, which reads as a corrupt row. Asserted as the presence of what
    // a reviewer needs AND the absence of the empty-quote rendering.
    const { stdout } = await modq();
    expect(stdout).toContain("[avatar] token tok1 in b1");
    expect(stdout).not.toContain('""');
    expect(stdout).not.toContain("undefined");
  });

  it("says an EMPTY queue is empty, rather than printing nothing", async () => {
    queueResponse = { advisory: false, runCap: 50, items: [] };
    const { stdout } = await modq();
    expect(stdout).toContain("0 item(s)");
    expect(stdout).toMatch(/Nothing queued/);
  });

  it("marks advisory mode, where a verdict is recorded and not applied", async () => {
    queueResponse = { ...queueResponse, advisory: true };
    expect((await modq()).stdout).toContain("ADVISORY");
  });
});

describe("submitting a verdict", () => {
  it("sends exactly the key set modVerdictError admits, and a fresh runId", async () => {
    // The server sorts the keys and compares against two literal strings,
    // so a stray field is `invalid-argument` for a verdict somebody meant.
    await modq(["--keep", "t_abc"]);
    const sent = received.find((r) => r.fn === "submitModVerdict").body.data;
    expect(Object.keys(sent.verdict).sort()).toEqual(["takeId", "verdict"]);
    expect(sent.verdict).toEqual({ takeId: "t_abc", verdict: "keep" });
    expect(sent.runId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("carries the policy line on a removal, and only there", async () => {
    await modq(["--remove", "t_abc", "--line", "H3"]);
    const sent = received.find((r) => r.fn === "submitModVerdict").body.data;
    expect(Object.keys(sent.verdict).sort()).toEqual(["policyLine", "takeId", "verdict"]);
    expect(sent.verdict.policyLine).toBe("H3");
  });

  it("refuses a removal with no policy line, without spending a round trip", async () => {
    const msg = await fails(["--remove", "t_abc"]);
    expect(msg).toMatch(/must cite a policy line/);
    expect(received).toEqual([]);
  });

  it("refuses an invented policy line", async () => {
    expect(await fails(["--remove", "t_abc", "--line", "H9"])).toMatch(/policy line/);
    expect(received).toEqual([]);
  });

  it("refuses a policy line on a non-removal", async () => {
    expect(await fails(["--keep", "t_abc", "--line", "H1"])).toMatch(/only for --remove/);
    expect(received).toEqual([]);
  });

  it("refuses two verdicts in one invocation rather than picking one", async () => {
    expect(await fails(["--keep", "t_abc", "--remove", "t_xyz", "--line", "H1"]))
      .toMatch(/pick one verdict/);
    expect(received).toEqual([]);
  });

  it("generates a DIFFERENT runId each invocation", async () => {
    await modq(["--escalate", "t_abc"]);
    await modq(["--escalate", "t_esc"]);
    const ids = received.filter((r) => r.fn === "submitModVerdict").map((r) => r.body.data.runId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it("explains permission-denied as the MOD_UIDS list, not the operator one", async () => {
    // THE FIXTURE IS THE SERVER'S ACTUAL WIRE SHAPE, and that is the whole
    // point of this case. It read `message: "permission-denied"` first — a
    // string moderation.ts never sends — so the fixture carried BOTH
    // spellings and the assertion held whichever one the script matched
    // on, which is the only thing the behaviour turns on. The test
    // certified a hint that could not fire in production.
    //
    // The real refusal is HttpsError("permission-denied", "moderator-only")
    // at functions/src/moderation.ts:95, serialised upper-snake.
    verdictStatus = 403;
    verdictResponse = { error: { status: "PERMISSION_DENIED", message: "moderator-only" } };
    const msg = await fails(["--keep", "t_abc"]);
    expect(msg).toContain("moderator-only");
    expect(msg).toMatch(/not in MOD_UIDS/);
  });
});

describe("what it deliberately cannot do", () => {
  it("submits ONE verdict per invocation, whatever the queue holds", async () => {
    // MOD_RUN_CAP bounds a run's blast radius server-side; this keeps the
    // matching shape on the caller. A CLI that could clear the queue in one
    // command is a CLI that eventually will, which is the confinement D22
    // is about.
    //
    // Asserted behaviourally. Written first as a grep over this script's
    // own source for a loop around submitModVerdict — which passed
    // vacuously and then FAILED once the alternation was written with `s`,
    // because `.*` spanned the file and matched the READ path's loop. A
    // source-shape test cannot tell the two loops apart; a call count can.
    queueResponse = {
      advisory: false,
      runCap: 50,
      items: Array.from({ length: 25 }, (_, i) => ({
        takeId: `t_${i}`, kind: "take", text: `item ${i}`, flags: 9, escalated: false, escalations: 0,
      })),
    };
    await modq(["--remove", "t_7", "--line", "H2"]);
    const submits = received.filter((r) => r.fn === "submitModVerdict");
    expect(submits).toHaveLength(1);
    expect(submits[0].body.data.verdict.takeId).toBe("t_7");
    // …and it never even READ the queue, so there is nothing to iterate.
    expect(received.filter((r) => r.fn === "fetchModQueue")).toEqual([]);
  });
});

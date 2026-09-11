// backups.test.mjs — the backup lane, against a stub Google.
//
// Three things fail SILENTLY here and none of them is visible from the
// console, which is the same reason apply-monitoring has a suite:
//
//   1. THE DATABASE NAME. This project's database is `insight`, not
//      `(default)` (functions/src/db.ts:29). A script that backs up
//      `(default)` takes a 404, and a 404 on a project path reads as "the
//      API is not enabled" — so the operator goes and enables an API, sees
//      no error the second time, and believes the wrong database is
//      protected. Pinned by asserting the URL, not the outcome.
//
//   2. THE DUPLICATE. Backup schedules have server-assigned names, so there
//      is no natural key and nothing stops a second identical daily
//      schedule. It is not a harmless duplicate: it doubles the backup
//      storage bill silently and forever. Matching on RECURRENCE is what
//      prevents it, and "does a second run POST anything" is the assertion.
//
//   3. THE WHOLE-OBJECT PATCH. Turning PITR on with a full PATCH rather
//      than `?updateMask=pointInTimeRecoveryEnablement` rewrites the
//      database resource from whatever was read a moment earlier —
//      including delete protection and concurrency mode. It would look
//      identical in every log and in the console.
//
// And the dry run, which is the one an operator relies on before touching
// production: `--apply` off must issue no write of any kind.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateKeyPairSync } from "node:crypto";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(root, "scripts", "backups.mjs");

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const SA = JSON.stringify({ private_key: privateKey, client_email: "deploy@prvfire33.iam.gserviceaccount.com" });

const DB = "/firestore.googleapis.com/v1/projects/prvfire33/databases/insight";
const SCHEDULES = `${DB}/backupSchedules`;
const BACKUPS = "/firestore.googleapis.com/v1/projects/prvfire33/locations/-/backups";

let reply, calls, server, base;
const key = (method, url) => `${method} ${url}`;

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => { raw += c; });
    req.on("end", () => {
      if (req.url.startsWith("/oauth2.googleapis.com")) {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(JSON.stringify({ access_token: "stub-token", expires_in: 3600 }));
      }
      // The auth header is recorded, not just the body: a stub that ignores
      // Authorization cannot tell a signed request from an anonymous one,
      // and the credential path is most of what this script is.
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

/** A project with nothing in place: PITR off, no schedules, no backups. */
const BARE = () => ({
  [key("GET", DB)]: { status: 200, body: { name: "projects/prvfire33/databases/insight", pointInTimeRecoveryEnablement: "POINT_IN_TIME_RECOVERY_DISABLED" } },
  [key("GET", SCHEDULES)]: { status: 200, body: {} },
  [key("GET", BACKUPS)]: { status: 200, body: {} },
});

/** A project already fully armed, to prove the second run changes nothing. */
const ARMED = () => ({
  [key("GET", DB)]: { status: 200, body: { name: "projects/prvfire33/databases/insight", pointInTimeRecoveryEnablement: "POINT_IN_TIME_RECOVERY_ENABLED" } },
  [key("GET", SCHEDULES)]: {
    status: 200,
    body: {
      backupSchedules: [
        { name: "…/backupSchedules/aaa", retention: "604800s", dailyRecurrence: {} },
        { name: "…/backupSchedules/bbb", retention: "8467200s", weeklyRecurrence: { day: "SUNDAY" } },
      ],
    },
  },
  [key("GET", BACKUPS)]: {
    status: 200,
    body: { backups: [{ database: "projects/prvfire33/databases/insight", snapshotTime: "2026-09-11T02:00:00Z" }] },
  },
});

beforeEach(() => { reply = BARE(); calls = []; });

const exec = (args = []) => run("node", [SCRIPT, ...args], {
  env: { ...process.env, FIREBASE_SERVICE_ACCOUNT: SA, GOOGLE_API_BASE: base },
});

const writes = () => calls.filter((c) => c.method !== "GET");

describe("the dry run", () => {
  it("issues no write of any kind", async () => {
    const { stdout } = await exec();
    expect(writes(), `dry run wrote: ${JSON.stringify(writes())}`).toEqual([]);
    expect(stdout).toContain("DRY RUN");
    expect(stdout).toContain("would create");
  });

  it("reports the three things as missing when they are", async () => {
    const { stdout } = await exec();
    expect(stdout).toMatch(/\+ point-in-time recovery/);
    expect(stdout).toMatch(/\+ daily backups/);
    expect(stdout).toMatch(/\+ weekly backups/);
  });
});

describe("--apply, against a bare project", () => {
  it("names the right database on every call", async () => {
    await exec(["--apply"]);
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) {
      // The backups LIST is project/location-scoped by API design — there is
      // no per-database collection to list — so it is exempt from the name
      // assertion and carries its own: the script filters the response by
      // `database`, pinned in "counts only backups of THIS database" below.
      if (c.url !== BACKUPS) {
        expect(c.url, `talked to a database this project does not have: ${c.url}`)
          .toContain("/databases/insight");
      }
      expect(c.url).not.toContain("(default)");
      expect(c.auth, "an unsigned request").toBe("Bearer stub-token");
    }
  });

  it("turns PITR on through updateMask, never a whole-object PATCH", async () => {
    await exec(["--apply"]);
    const patch = writes().find((c) => c.method === "PATCH");
    expect(patch, "PITR was never enabled").toBeTruthy();
    expect(patch.url).toContain("updateMask=pointInTimeRecoveryEnablement");
    expect(patch.body).toEqual({ pointInTimeRecoveryEnablement: "POINT_IN_TIME_RECOVERY_ENABLED" });
    // The failure this pins: a PATCH carrying the fields it read back would
    // rewrite delete protection and concurrency mode as a side effect.
    expect(Object.keys(patch.body)).toEqual(["pointInTimeRecoveryEnablement"]);
  });

  it("creates one daily and one weekly schedule, with real retention", async () => {
    await exec(["--apply"]);
    const posts = writes().filter((c) => c.method === "POST" && c.url === SCHEDULES);
    expect(posts).toHaveLength(2);
    const daily = posts.find((p) => p.body.dailyRecurrence);
    const weekly = posts.find((p) => p.body.weeklyRecurrence);
    expect(daily, "no daily schedule").toBeTruthy();
    expect(weekly, "no weekly schedule").toBeTruthy();
    expect(daily.body.retention).toBe("604800s");          // 7 days
    expect(weekly.body.retention).toBe("8467200s");        // 14 weeks
    expect(weekly.body.weeklyRecurrence.day).toBe("SUNDAY");
  });

  it("takes the weekly day from the flag the workflow passes", async () => {
    await exec(["--apply", "--weekly-day", "WEDNESDAY"]);
    const weekly = writes().find((c) => c.body?.weeklyRecurrence);
    expect(weekly.body.weeklyRecurrence.day).toBe("WEDNESDAY");
  });

  it("says nothing is restorable yet, because nothing is", async () => {
    const { stdout } = await exec(["--apply"]);
    expect(stdout).toContain("restorable now: 0 backup(s)");
    expect(stdout).toContain("NOTHING");
  });
});

describe("--apply, against a project already armed", () => {
  beforeEach(() => { reply = ARMED(); });

  it("writes nothing at all — no duplicate schedule, no redundant PATCH", async () => {
    const { stdout } = await exec(["--apply"]);
    expect(writes(), `a second run wrote: ${JSON.stringify(writes())}`).toEqual([]);
    expect(stdout).toMatch(/= point-in-time recovery.*skipped/);
    expect(stdout).toMatch(/= daily backups.*skipped/);
    expect(stdout).toMatch(/= weekly backups.*skipped/);
  });

  it("reports what is actually restorable, which is the only evidence here", async () => {
    const { stdout } = await exec(["--apply"]);
    expect(stdout).toContain("restorable now: 1 backup(s)");
    expect(stdout).toContain("2026-09-11T02:00:00Z");
  });

  it("counts only backups of THIS database", async () => {
    reply[key("GET", BACKUPS)] = {
      status: 200,
      body: {
        backups: [
          { database: "projects/prvfire33/databases/insight", snapshotTime: "2026-09-11T02:00:00Z" },
          // A backup of some other database in the same project is not a
          // copy of this one, and counting it would be the exact reassurance
          // this script must never give.
          { database: "projects/prvfire33/databases/(default)", snapshotTime: "2026-09-11T03:00:00Z" },
        ],
      },
    };
    const { stdout } = await exec();
    expect(stdout).toContain("restorable now: 1 backup(s)");
  });
});

describe("a refusal is fatal and names the fix", () => {
  it("exits non-zero on 403 and names the role and the account", async () => {
    reply[key("GET", DB)] = { status: 403, body: { error: { message: "caller lacks permission" } } };
    await expect(exec()).rejects.toMatchObject({ code: 1 });
    const { stderr } = await exec().catch((e) => e);
    expect(stderr).toContain("roles/datastore.viewer");
    expect(stderr).toContain("deploy@prvfire33.iam.gserviceaccount.com");
  });

  it("reads a 404 as the database name rather than as a disabled API", async () => {
    // The two have completely different fixes and the generic message sends
    // the operator to the wrong one — see this file's header.
    reply[key("GET", DB)] = { status: 404, body: { error: { message: "not found" } } };
    const { stderr } = await exec().catch((e) => e);
    expect(stderr).toContain("database name");
    expect(stderr).toContain("insight");
  });

  it("stops before writing when the first read is refused", async () => {
    reply[key("GET", DB)] = { status: 403, body: { error: { message: "nope" } } };
    await exec(["--apply"]).catch(() => {});
    expect(writes(), "wrote after a refusal — half-armed and reported as done").toEqual([]);
  });
});

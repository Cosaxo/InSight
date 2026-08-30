// No operator script may bind to the wrong Firestore database.
//
// WHY THIS EXISTS. `getFirestore()` with no argument binds to
// `(default)`. This app is entirely on the named `insight` database —
// functions go through `functions/src/db.ts`, the rules and indexes
// deploy against it, and the web client passes the id as its third
// argument. All four admin-SDK scripts in this directory used the bare
// form, so the read breaker, the purchase ledger's pen, the rate card's
// own source and the v1 scrub all read and wrote a database the app never
// touches. `(default)` has since been deleted, so they fail NOT_FOUND
// rather than silently succeeding elsewhere.
//
// It is the same defect D333 found the day before, one layer up: runbook
// 5.1's gcloud command "named no `--database`, which defaults to
// `(default)`", and "had it been run as written it would have exited 0,
// configured nothing that matters, and left the promise looking kept."
// Caught once in a command, shipped four times in this directory.
//
// A gate rather than four fixes, because the next script will be written
// the same way — the bare call is what the SDK's own examples show.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const adminScripts = readdirSync(here)
  .filter((f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs"))
  .filter((f) => readFileSync(resolve(here, f), "utf8").includes("firebase-admin/firestore"));

describe("operator scripts name the database they mean", () => {
  it("finds the admin-SDK scripts at all — the rule is vacuous otherwise", () => {
    expect(adminScripts.length, "no script imports firebase-admin/firestore any more; if that is "
      + "right, delete this file, but do not let it pass empty").toBeGreaterThan(0);
  });

  for (const f of adminScripts) {
    it(`${f}: no bare getFirestore()`, () => {
      const src = readFileSync(resolve(here, f), "utf8");
      // CODE ONLY. Every file here explains the defect in prose, and the
      // prose necessarily writes the bare call — a rule that reads
      // comments would fail on its own explanation, which is the shape of
      // gate this repo keeps having to fix.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
      const bare = [...code.matchAll(/getFirestore\(\s*\)/g)].length;
      expect(
        bare,
        `${f} calls getFirestore() with no database id, which binds to `
        + "`(default)` — a database this app does not use and which no "
        + "longer exists. Use adminDb() from ./admin-db.mjs, or pass "
        + "FIRESTORE_DB_ID explicitly.",
      ).toBe(0);
    });
  }

  it("admin-db.mjs names the same database the functions do", () => {
    // The two must not drift: a script pointed at a different database
    // than the trigger that reads what it writes is the same bug wearing
    // a different value.
    const helper = readFileSync(resolve(here, "admin-db.mjs"), "utf8");
    const fns = readFileSync(resolve(here, "../functions/src/db.ts"), "utf8");
    const idOf = (s) => (s.match(/FIRESTORE_DB_ID\s*=\s*process\.env\.FIRESTORE_DB_ID\s*\|\|\s*"([^"]+)"/) || [])[1];
    expect(idOf(helper), "admin-db.mjs's default database id could not be parsed").toBeTruthy();
    expect(idOf(helper)).toBe(idOf(fns));
  });
});

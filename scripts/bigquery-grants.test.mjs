// bigquery-grants.test.mjs — the roles arithmetic both the apply script and
// the observer read the answer log's grant through (D-2026-09-12a).
import { describe, expect, it } from "vitest";
import {
  APPEND_ROLES, JOB_ROLES, NEEDED_ROLES, projectRolesHeld, datasetRolesHeld, logAccess, grantCommands,
} from "./bigquery-grants.mjs";

const SA = "437999864865-compute@developer.gserviceaccount.com";
const GEN1 = "prvfire33@appspot.gserviceaccount.com";
const bind = (role, ...members) => ({ role, members });

describe("bigquery-grants", () => {
  it("holds a role only for the exact member — the gen-1 default is not the gen-2 one", () => {
    const bindings = [bind("roles/bigquery.dataEditor", `serviceAccount:${GEN1}`), bind("roles/bigquery.jobUser", `serviceAccount:${SA}`)];
    expect(projectRolesHeld(bindings, SA)).toEqual(["roles/bigquery.jobUser"]);
    expect(projectRolesHeld(bindings, GEN1)).toEqual(["roles/bigquery.dataEditor"]);
    expect(projectRolesHeld([], SA)).toEqual([]);
    expect(projectRolesHeld(undefined, SA)).toEqual([]);
  });

  it("answers both ✓ through the two narrow roles, and through a broad one alone", () => {
    const narrow = logAccess({ account: SA, bindings: NEEDED_ROLES.map((r) => bind(r, `serviceAccount:${SA}`)), access: [] });
    expect(narrow).toMatchObject({ canAppend: true, canQuery: true, appendVia: ["roles/bigquery.dataEditor"], queryVia: ["roles/bigquery.jobUser"] });
    const editor = logAccess({ account: SA, bindings: [bind("roles/editor", "user:o@example.com", `serviceAccount:${SA}`)], access: [] });
    expect(editor).toMatchObject({ canAppend: true, canQuery: true, appendVia: ["roles/editor"], queryVia: ["roles/editor"] });
    // The broad roles are in both lists: a project whose default account
    // still holds Editor already has both, which the apply script says.
    for (const r of ["roles/editor", "roles/owner", "roles/bigquery.admin"]) {
      expect(APPEND_ROLES).toContain(r);
      expect(JOB_ROLES).toContain(r);
    }
  });

  it("reads a dataset-level WRITER grant as rows but never as jobs", () => {
    const a = logAccess({ account: SA, bindings: [], access: [{ role: "WRITER", userByEmail: SA }, { role: "OWNER", userByEmail: "o@example.com" }] });
    expect(datasetRolesHeld(a.dataset && [{ role: "WRITER", userByEmail: SA }], SA)).toEqual(["WRITER"]);
    expect(a.canAppend).toBe(true);
    expect(a.appendVia).toEqual(["WRITER (on the dataset)"]);
    // bigquery.jobs.create is a project permission; no dataset entry gives it.
    expect(a.canQuery).toBe(false);
  });

  it("says NO only when both sides were read and neither grants it", () => {
    const both = logAccess({ account: SA, bindings: [bind("roles/billing.projectManager", `serviceAccount:${SA}`)], access: [] });
    expect(both).toMatchObject({ canAppend: false, canQuery: false, appendVia: [], queryVia: [] });
  });

  it("answers null, not no, wherever an input was refused", () => {
    // No account read: nothing to say.
    expect(logAccess({ account: null, bindings: [], access: [] })).toMatchObject({ canAppend: null, canQuery: null, appendVia: null });
    // Policy refused, dataset read and empty: the role could be on the
    // project side nobody could read.
    const noPolicy = logAccess({ account: SA, bindings: null, access: [] });
    expect(noPolicy.canAppend).toBeNull();
    expect(noPolicy.canQuery).toBeNull();
    // Policy read and empty, dataset refused: same, the other way round.
    const noDataset = logAccess({ account: SA, bindings: [], access: null });
    expect(noDataset.canAppend).toBeNull();
    expect(noDataset.canQuery).toBe(false);
    // Policy read and it grants Editor: a refused dataset changes nothing.
    const editorNoDataset = logAccess({ account: SA, bindings: [bind("roles/editor", `serviceAccount:${SA}`)], access: null });
    expect(editorNoDataset.canAppend).toBe(true);
  });

  it("prints the two commands for the account it was given, never a default", () => {
    const cmds = grantCommands("prvfire33", SA);
    expect(cmds).toHaveLength(2);
    expect(cmds[0]).toBe(`gcloud projects add-iam-policy-binding prvfire33 --member=serviceAccount:${SA} --role=roles/bigquery.dataEditor`);
    expect(cmds[1]).toBe(`gcloud projects add-iam-policy-binding prvfire33 --member=serviceAccount:${SA} --role=roles/bigquery.jobUser`);
    for (const c of cmds) expect(c).not.toContain("appspot");
  });
});

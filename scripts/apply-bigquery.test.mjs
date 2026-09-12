// apply-bigquery.test.mjs — the table body is the schema file, partitioned
// and clustered the way log.ts and SCALE-ARCHITECTURE.md say (D447).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { datasetBody, tableBody, readSchema, DATASET, TABLE, LOCATION } from "./apply-bigquery.mjs";

describe("apply-bigquery", () => {
  it("names the dataset, table and region functions/src/log.ts reads", () => {
    const src = readFileSync("functions/src/log.ts", "utf8");
    expect(src).toMatch(new RegExp(`LOG_DATASET = process\\.env\\.LOG_DATASET \\|\\| "${DATASET}"`));
    expect(src).toMatch(new RegExp(`LOG_TABLE = "${TABLE}"`));
    expect(src).toMatch(new RegExp(`LOG_LOCATION = "${LOCATION}"`));
    expect(datasetBody("p").location).toBe(LOCATION);
  });

  it("partitions by day and clusters by person then question, with every schema field", () => {
    const schema = readSchema();
    const body = tableBody("p", schema);
    expect(body.timePartitioning).toEqual({ type: "DAY", field: "day" });
    // Person first: the erasure's `WHERE uid IN …` is the one DML the
    // design runs, and a prefix is what clustering prunes on.
    expect(body.clustering).toEqual({ fields: ["uid", "qid"] });
    const names = body.schema.fields.map((f) => f.name);
    for (const f of ["id", "uid", "qid", "surface", "option_idx", "from_idx", "answered_at", "day", "anchors"]) expect(names).toContain(f);
    expect(schema.find((f) => f.name === "day").type).toBe("DATE");
    expect(schema.find((f) => f.name === "answered_at").type).toBe("TIMESTAMP");
    // No reserved word as a column: `at` and `from` are BigQuery keywords,
    // and a table with one is a query that fails at the first SELECT.
    for (const n of names) expect(["at", "from", "select", "where", "day"].includes(n) && n !== "day", `${n} is a reserved word`).toBe(false);
  });
});

// The grant's ACCOUNT is read off the deployed trigger, never typed
// (D-2026-09-12a): the script named the gen-1 default for three days and
// the owner ran the click against it, while the functions are gen-2 and
// run as the Compute Engine default. A default typed here again would print
// the wrong grant again, and print it confidently.
describe("apply-bigquery — the grant's account", () => {
  it("names no default service account anywhere in the script", () => {
    const src = readFileSync("scripts/apply-bigquery.mjs", "utf8");
    // No `--member=` of its own: the commands come from bigquery-grants.mjs,
    // for the account the script read. (The fallback text NAMES the gen-2
    // default so an operator knows which family to look in; it grants it
    // to nobody.)
    expect(src).not.toMatch(/--member=/);
    expect(src).toMatch(/grantCommands\(PROJECT, account\)/);
    expect(src).not.toMatch(/serviceAccount:\$\{PROJECT\}@appspot/);
    // …and reads the trigger by the name the functions export.
    expect(readFileSync("functions/src/v2.ts", "utf8")).toMatch(/export const onV2AnswerCreated\b/);
  });
});

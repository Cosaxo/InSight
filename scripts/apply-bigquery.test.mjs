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

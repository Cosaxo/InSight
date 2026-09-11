// The loadings budget's arithmetic, and the two claims PATTERNS-PLAN.md
// §7.1 makes about the document — held against the committed index file
// rather than against a fixture of it (D455).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  DOC_BYTES_LIMIT, INDEX_ENTRIES_LIMIT, TODAY_ROWS,
  documentBytes, exemptionsOf, indexEntries, publicationOf, report, rowsAt, valueBytes,
} from "./loadings-budget.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(readFileSync(resolve(root, "firestore.indexes.json"), "utf8"));

describe("the arithmetic", () => {
  it("sizes values the way the storage-size page does", () => {
    expect(valueBytes("abc")).toBe(4);
    expect(valueBytes(7)).toBe(8);
    expect(valueBytes(true)).toBe(1);
    expect(valueBytes(null)).toBe(1);
    expect(valueBytes([1, 2])).toBe(16);
    expect(valueBytes({ a: 1 })).toBe(2 + 8);
    // a name is each segment + 1, plus 16; a document adds 32
    expect(documentBytes("v2_patterns/loadings", {})).toBe((11 + 1) + (8 + 1) + 16 + 32);
  });

  it("counts index entries as the default single-field indexes would: two per scalar, one per array element, maps recursing", () => {
    expect(indexEntries({ n: 1 })).toBe(2);
    expect(indexEntries({ v: [1, 2, 3] })).toBe(3);
    expect(indexEntries({ q: { a: { v: [1, 2], n: 1 } } })).toBe(4);
    expect(indexEntries({ q: { a: { v: [1, 2], n: 1 } }, k: 8 }, new Set(["q"]))).toBe(2);
    expect(indexEntries({ q: { a: { v: [1, 2], n: 1 } }, k: 8 }, new Set(["*"]))).toBe(0);
  });
});

describe("the two claims", () => {
  it("with the committed exemption the loadings document costs no index entries; without it, today's shape already cost thousands", () => {
    const exempt = exemptionsOf(cfg, "v2_patterns");
    expect(exempt.has("*"), "firestore.indexes.json no longer exempts v2_patterns wholesale").toBe(true);
    const doc = publicationOf({ rows: TODAY_ROWS });
    expect(indexEntries(doc, exempt)).toBe(0);
    const indexed = indexEntries(doc);
    // the wall was real and it was closer than the byte ceiling: a few
    // thousand rows of this shape would have crossed 40,000 entries while
    // the same rows sit far under 1 MiB
    expect(indexed).toBeGreaterThan(10_000);
    expect(indexed).toBeLessThan(INDEX_ENTRIES_LIMIT);
    expect(indexEntries(publicationOf({ rows: 3000 }))).toBeGreaterThan(INDEX_ENTRIES_LIMIT);
    expect(documentBytes("v2_patterns/loadings", publicationOf({ rows: 3000 }))).toBeLessThan(DOC_BYTES_LIMIT);
  });

  it("1 MiB holds more rows than the shard trigger the plan names, so sharding at 2,500 is inside the wall", { timeout: 30_000 }, () => {
    const n = rowsAt();
    expect(n).toBeGreaterThanOrEqual(2500);
    expect(documentBytes("v2_patterns/loadings", publicationOf({ rows: n }))).toBeLessThanOrEqual(DOC_BYTES_LIMIT);
    expect(documentBytes("v2_patterns/loadings", publicationOf({ rows: n + 1 }))).toBeGreaterThan(DOC_BYTES_LIMIT);
    const r = report(cfg);
    expect(r.rowsAt1MiB).toBe(n);
    expect(r.lines.map((l) => l.rows)).toEqual([545, TODAY_ROWS, 2500, n]);
  });
});

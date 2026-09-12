// The loadings budget's arithmetic, and the two claims PATTERNS-PLAN.md
// §7.1 makes about the document — held against the committed index file
// rather than against a fixture of it (D461).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  DOC_BYTES_LIMIT, INDEX_ENTRIES_LIMIT, TODAY_ROWS, SHARD_AT,
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
    // THE WALL IS NOT AHEAD OF US, IT IS BEHIND: against the document the
    // nightly really writes — both candidates carrying the full corpus —
    // today's shape costs about 47,700 entries, which is ALREADY past the
    // 40,000 limit. The exemption is not headroom bought for later; it is
    // the only reason tonight's write is legal. This read `< 40,000` while
    // the model benched the candidate at 113 rows.
    expect(indexed).toBeGreaterThan(INDEX_ENTRIES_LIMIT);
    // …and the byte ceiling is the one still ahead: the same rows sit at
    // about 40% of 1 MiB.
    expect(documentBytes("v2_patterns/loadings", doc)).toBeLessThan(DOC_BYTES_LIMIT / 2);
  });

  it("holds the shard trigger UNDER the measured limit, against the document the nightly really writes", { timeout: 30_000 }, () => {
    // THE FIXTURE WAS THE FINDING. `publicationOf` benched the candidate
    // engine at a fixed 113 rows while `functions/src/patterns.ts` gives
    // both candidates the full row set, so the modelled document was about
    // 40% light: 2,500 rows measure 1,176,530 bytes — past the ceiling —
    // and the old trigger of 2,500 sat OUTSIDE the wall while this suite
    // asserted, in its own name, that it was inside. That is the failure
    // PATTERNS-PLAN §7.1 predicted in words and this instrument existed to
    // catch.
    const n = rowsAt();
    expect(n).toBeGreaterThan(SHARD_AT);
    expect(documentBytes("v2_patterns/loadings", publicationOf({ rows: n }))).toBeLessThanOrEqual(DOC_BYTES_LIMIT);
    expect(documentBytes("v2_patterns/loadings", publicationOf({ rows: n + 1 }))).toBeGreaterThan(DOC_BYTES_LIMIT);
    // and the candidate really is modelled at the corpus, not at a constant
    expect(documentBytes("v2_patterns/loadings", publicationOf({ rows: 2500 })))
      .toBeGreaterThan(DOC_BYTES_LIMIT);
    const r = report(cfg);
    expect(r.rowsAt1MiB).toBe(n);
    expect(r.lines.map((l) => l.rows)).toEqual([545, TODAY_ROWS, SHARD_AT, n]);
  });
});

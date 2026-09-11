#!/usr/bin/env node
// loadings-budget.mjs — what one publication of the Patterns fit costs the
// document that carries it, by Firestore's own two ceilings (D457,
// PATTERNS-PLAN.md §7.1).
//
// WHY THIS EXISTS. `v2_patterns/loadings` is ONE document, read whole,
// and it grows with the corpus: a row per fitted item (D395), a row per
// profile value the crowd carries (D454), a row per popular catalogue
// pick (D455), the benched engine's block beside the engine's, and a
// scorecard per question. Firestore stops accepting a document at 1 MiB
// of storage, and — the wall nobody had counted — at 40,000 index
// entries, which every field of a document costs by default: two per
// scalar (ascending and descending single-field indexes), one per array
// element (array-contains), maps recursing. Nothing queries inside this
// document, so every one of those entries is dead weight walking toward
// a limit; the exemption in firestore.indexes.json (`v2_patterns`, `*`)
// removes them, and this script is what says by how much and how far
// the byte ceiling now is.
//
// AN INSTRUMENT, NOT A GATE (ORIENTATION §3): it reads nothing live and
// prints an estimate from the document's SHAPE, by the arithmetic the
// Firestore docs give for storage size and the indexing rules give for
// entries. scripts/loadings-budget.test.mjs holds the arithmetic and the
// two claims the plan makes: with the committed exemption the entries
// are zero, and 1 MiB holds more rows than the shard trigger the plan
// names. The figures are estimates of a shape, and say so.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export const DOC_BYTES_LIMIT = 1_048_576;
export const INDEX_ENTRIES_LIMIT = 40_000;

const utf8 = (s) => Buffer.byteLength(String(s), "utf8");

/** Storage size of one value (firebase.google.com/docs/firestore/storage-size):
 * a string is its UTF-8 bytes + 1, a number 8, a boolean or null 1, an
 * array the sum of its elements, a map the sum of its field names (as
 * strings) and values. */
export function valueBytes(v) {
  if (v === null || v === undefined) return 1;
  if (typeof v === "boolean") return 1;
  if (typeof v === "number") return 8;
  if (typeof v === "string") return utf8(v) + 1;
  if (Array.isArray(v)) return v.reduce((a, x) => a + valueBytes(x), 0);
  if (typeof v === "object") return Object.entries(v).reduce((a, [k, x]) => a + utf8(k) + 1 + valueBytes(x), 0);
  return 8;
}

/** A document's storage size: its name (each path segment's bytes + 1,
 * plus 16), 32 bytes of overhead, and its fields. */
export function documentBytes(path, doc) {
  const name = path.split("/").reduce((a, seg) => a + utf8(seg) + 1, 0) + 16;
  return name + 32 + valueBytes(doc);
}

/** Index entries under the default single-field indexing — two per
 * scalar, one per array element, maps recursing — with `exempt` naming
 * the top-level fields left unindexed, or `*` for all of them. */
export function indexEntries(doc, exempt = new Set()) {
  if (exempt.has("*")) return 0;
  const count = (v) => {
    if (v === null || v === undefined || typeof v !== "object") return 2;
    if (Array.isArray(v)) return v.length;
    return Object.values(v).reduce((a, x) => a + count(x), 0);
  };
  return Object.entries(doc).reduce((a, [k, v]) => a + (exempt.has(k) ? 0 : count(v)), 0);
}

/** The exemptions firestore.indexes.json declares for a collection group. */
export function exemptionsOf(indexesJson, group) {
  const out = new Set();
  for (const o of indexesJson.fieldOverrides ?? []) {
    if (o.collectionGroup !== group) continue;
    if (Array.isArray(o.indexes) && o.indexes.length === 0) out.add(o.fieldPath);
  }
  return out;
}

/** A publication of the fit's shape: `rows` item rows in the engine's
 * block (a vector of k, a basis, a sum, an sd on the ordinal share), the
 * item metadata beside them, a scorecard with a per-question map, and
 * the benched engine's block carrying `candRows` rows of the same shape.
 * Keys are shaped like the real ones — a bank id, an option suffix, an
 * anchor's or a pick's — so the name bytes count as they would. */
export function publicationOf({ rows, k = 8, candRows = 113, perQ = rows, ordShare = 0.4, meta = true } = {}) {
  const row = (i) => ({
    v: Array.from({ length: k }, (_, j) => Math.round(Math.sin(i + j) * 10000) / 10000),
    n: 40 + (i % 200),
    sum: (i % 37) - 18,
    ...(i % 100 < ordShare * 100 ? { sd: 1.2345 } : {}),
  });
  const keyOf = (i) => (i % 3 === 0 ? `daily-${String(i).padStart(3, "0")}` : i % 3 === 1 ? `feed-topic-${i}~${i % 4}` : `anchor~ageBand~${i}`);
  const q = {};
  const items = {};
  for (let i = 0; i < rows; i++) {
    const key = keyOf(i);
    q[key] = row(i);
    if (meta) items[key] = { kind: i % 3 === 0 ? "bin" : i % 3 === 1 ? "opt" : "anc", qid: key.split("~")[0], nOptions: 2, ...(i % 3 === 1 ? { opt: i % 4 } : {}), ...(i % 3 === 2 ? { dim: "ageBand", bucket: String(i) } : {}) };
  }
  const perQMap = {};
  for (let i = 0; i < perQ; i++) perQMap[keyOf(i)] = { n: 12, bits: 0.9123, baseBits: 0.9871 };
  const quality = { day: "2026-09-09", n: 1200, bits: 0.9, baselineBits: 0.98, skill: 0.08, floor: 8, series: Array.from({ length: 90 }, (_, d) => ({ day: `2026-06-${String(d % 30 + 1).padStart(2, "0")}`, n: 40, bits: 0.9, baselineBits: 0.98 })), perQ: perQMap };
  const cq = {};
  const ci = {};
  for (let i = 0; i < candRows; i++) { const key = keyOf(i); cq[key] = row(i); if (meta) ci[key] = items[key] ?? { kind: "bin", qid: key, nOptions: 2 }; }
  return {
    k, lastDay: "2026-09-09", folded: 1200, engine: "als", lambdaU: 1, tau: 1,
    q, ...(meta ? { items } : {}), quality,
    displacement: { space: "loading", n: rows, moved: rows, mean: 0.01, p50: 0.01, p90: 0.02, max: 0.1, perQ: {} },
    seeds: { n: rows, meanCos: 0.1, share90: 0.01, meanNorm: 0.8, seedNorm: 0.4 },
    candidates: { sgd: { q: cq, ...(meta ? { items: ci } : {}), quality, displacement: { space: "loading", n: 0, moved: 0, mean: 0, p50: 0, p90: 0, max: 0, perQ: {} }, lambdaU: 0.5, tau: 1, streak: 0, lambdaSweep: { "0.5": 0.9, "1": 0.9, "2": 0.9, "4": 0.9 }, tauSweep: { "0.5": 0.9, "0.75": 0.9, "1": 0.9, "1.5": 0.9, "2": 0.9 } } },
    at: "2026-09-10T02:23:00Z",
  };
}

/** The most rows of this shape one document holds under `limit` bytes. */
export function rowsAt(limit = DOC_BYTES_LIMIT, opts = {}) {
  // a row is over a hundred bytes, so 1 MiB is under ten thousand of them;
  // the search starts there rather than at a bound no document reaches
  let lo = 0, hi = 20_000;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (documentBytes("v2_patterns/loadings", publicationOf({ ...opts, rows: mid })) <= limit) lo = mid; else hi = mid - 1;
  }
  return lo;
}

/** Today's shape, from the figures the records carry: 545 item rows
 * measured 2026-09-06 (ALGORITHM-REFLECTION §3), about 100 anchor rows
 * (D454's budget) and up to 240 pick rows (D455's cap: ten per card,
 * twenty-four cards). Stated, not read — the instrument is about shape. */
export const TODAY_ROWS = 545 + 100 + 240;

export function report(indexesJson) {
  const exempt = exemptionsOf(indexesJson, "v2_patterns");
  const lines = [];
  for (const rows of [545, TODAY_ROWS, 2500, rowsAt()]) {
    const doc = publicationOf({ rows });
    const bytes = documentBytes("v2_patterns/loadings", doc);
    lines.push({ rows, bytes, entriesIndexed: indexEntries(doc), entriesNow: indexEntries(doc, exempt) });
  }
  return { exempt: [...exempt], lines, rowsAt1MiB: rowsAt() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const cfg = JSON.parse(readFileSync(resolve(root, "firestore.indexes.json"), "utf8"));
  const r = report(cfg);
  console.log(`loadings budget — ${r.exempt.length ? `v2_patterns exempt on ${r.exempt.join(", ")}` : "v2_patterns NOT exempt"}; ceilings ${DOC_BYTES_LIMIT} bytes, ${INDEX_ENTRIES_LIMIT} index entries`);
  console.log("  rows   bytes     entries(indexed)  entries(as committed)");
  for (const l of r.lines) console.log(`  ${String(l.rows).padStart(5)}  ${String(l.bytes).padStart(8)}  ${String(l.entriesIndexed).padStart(16)}  ${String(l.entriesNow).padStart(21)}`);
  console.log(`  1 MiB holds about ${r.rowsAt1MiB} rows of this shape; the plan shards at 2,500.`);
}

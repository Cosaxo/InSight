// ledger.test.ts — the projection, held against the shape it claims to read.
//
// WHY THIS FILE EXISTS. `readLedgerDay` narrows the wire with a `select`,
// which is a FIXED LIST of field names. A field added to LedgerDayEntry
// and forgotten there arrives as `undefined` at every reader — no error,
// no log, nothing red. This tree has already paid for that exact shape
// once: two nightly stores projected a fixed field list that had stopped
// matching what they wrote, and the fold went on producing a plausible
// number from an incomplete row.
//
// It matters most for `fromIdx`, which is the field that distinguishes a
// D86 edit from a first answer. Lose it from the projection and the
// patterns fit silently goes back to counting one person twice — a
// published basis that reads healthy and is not.
//
// Read off the real source rather than a fixture, because a fixture of
// the projection would be a second copy of the thing under test.
import { describe, expect, it } from "vitest";
import { readLedgerDay, memoLedgerReader } from "./ledger";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "ledger.ts"), "utf8");

/** The source with comments removed — the projection's own paragraph
 *  names the field, and matching that would prove nothing. */
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("readLedgerDay's projection", () => {
  const declared = (() => {
    const block = /export interface LedgerDayEntry \{([\s\S]*?)\n\}/.exec(code);
    expect(block, "LedgerDayEntry is no longer declared where this test looks").toBeTruthy();
    return [...block![1].matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);
  })();

  const selected = (() => {
    const call = /\.select\(([^)]*)\)/.exec(code);
    expect(call, "readLedgerDay no longer narrows with select()").toBeTruthy();
    return [...call![1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
  })();

  it("asks Firestore for every field the entry type declares", () => {
    // The vacuity guards first: an empty parse on either side would make
    // the assertion below pass while proving nothing.
    expect(declared.length).toBeGreaterThanOrEqual(3);
    expect(declared).toEqual(expect.arrayContaining(["uid", "qid", "optionIdx", "fromIdx"]));
    expect(selected.length).toBeGreaterThanOrEqual(declared.length);
    for (const field of declared) expect(selected, `select() is missing ${field}`).toContain(field);
  });

  it("still orders and pages by the field it selects for it", () => {
    // `at` is in the projection for the ordering rather than for a reader,
    // so it is not in the entry type — and the two facts have to stay
    // consistent or the query stops paging.
    expect(selected).toContain("at");
    expect(declared).not.toContain("at");
    expect(code).toMatch(/\.orderBy\("at"\)/);
  });

  it("copies fromIdx out of the snapshot, not just off the wire", () => {
    // Selecting the field and then not reading it is the same failure with
    // an extra step.
    expect(code).toMatch(/fromIdx: d\.get\("fromIdx"\)/);
  });
});


// ── AND THE FUNCTION, EXECUTED ─────────────────────────────────────
//
// Everything above reads the file as a string. That closes a projection
// that stops naming a field; it closes nothing about what the function
// DOES with what it reads, and this is the single reader two nightly
// folds share (the patterns fit and the taste fold — extracted at D322 so
// there would not be three copies).
//
// Measured before these cases existed: inverting the edit test itself —
// `d.get("fromIdx") === undefined` to `!== undefined`, so every first
// answer reads as an edit and every edit as a first answer — left all 593
// functions tests green, INCLUDING the case above whose name is "copies
// fromIdx out of the snapshot, not just off the wire". Its assertion is
// that a substring exists, and the substring still did.
//
// Three more survived the same way: `PAGE` set to 1, `snap.size < PAGE`
// widened to `<=` (every day past a full page truncates to one page in
// both folds), and the day's end bound widened to `<=` (each day
// double-counts the next day's first row).
//
// The twin reader in engagement.ts has a real behavioural pin and this
// one, the extracted copy that two folds share, had only the text scan.
// The fake below is that file's, for the same reason it gave: a document
// carries ONLY the projected fields, which is what makes a missing cursor
// field undefined.
describe("readLedgerDay, run", () => {
  type Doc = { get: (f: string) => unknown };
  /** A fake Firestore that records the range asked for and pages twice. */
  function fakeDb(rows: Record<string, unknown>[], pageSize: number) {
    const range: { op: string; val: unknown }[] = [];
    const asked: { limit: number } = { limit: 0 };
    let projection: string[] = [];
    let from = 0;
    const docOf = (r: Record<string, unknown>): Doc => ({
      get: (f: string) => (projection.includes(f) ? r[f] : undefined),
    });
    const query = {
      where: (f: string, op: string, val: unknown) => { if (f === "at") range.push({ op, val }); return query; },
      orderBy: () => query,
      select: (...f: string[]) => { projection = f; return query; },
      limit: (n: number) => { asked.limit = n; return query; },
      startAfter: (d: Doc) => { from = rows.findIndex((r) => r.uid === d.get("uid")) + 1; return query; },
      async get() {
        const slice = rows.slice(from, from + pageSize);
        return { size: slice.length, docs: slice.map(docOf) };
      },
    };
    return { db: { collection: () => query } as unknown as Parameters<typeof readLedgerDay>[0], range, asked };
  }

  const at = new Date(Date.UTC(2026, 8, 3, 12));

  it("marks an entry as an edit only when the snapshot carries fromIdx", async () => {
    const { db } = fakeDb([
      { uid: "u1", qid: "q1", optionIdx: 1, at },
      { uid: "u2", qid: "q1", optionIdx: 0, fromIdx: 1, at },
    ], 5000);
    const out = await readLedgerDay(db, "2026-09-03");
    expect(out.length, "the fake returned nothing — every assertion below is vacuous").toBe(2);
    expect("fromIdx" in out[0], "a first answer was read as an edit").toBe(false);
    expect(out[1].fromIdx, "an edit lost the index it moved away from").toBe(1);
  });

  it("keeps reading past a full page", async () => {
    // The page size is a module constant, so a full page has to be a real
    // one: 5,000 rows and then 3. A loop that breaks on a full page
    // returns 5,000 and both nightly folds silently read a prefix of the
    // day. (The first draft of this case handed the fake a page size of
    // its own and proved nothing, because the loop compares against the
    // module's constant and broke on the first short page.)
    const PAGE = 5000;
    const rows = Array.from({ length: PAGE + 3 }, (_, i) => ({ uid: `u${i}`, qid: "q", optionIdx: 0, at }));
    const { db } = fakeDb(rows, PAGE);
    expect((await readLedgerDay(db, "2026-09-03")).length,
      "the day was truncated to one page, in both folds that share this reader").toBe(PAGE + 3);
  });

  it("asks for a page worth making a round trip for", async () => {
    // The page size is the one mutation of the four that does not corrupt
    // the answer: at PAGE = 1 the loop still returns every row — in five
    // thousand round trips per day, in both folds that share this reader,
    // every night. So the bound is on the trip count rather than on the
    // literal, which is what actually matters and does not freeze the
    // number.
    const { db, asked } = fakeDb([], 5000);
    await readLedgerDay(db, "2026-09-03");
    expect(asked.limit, "the reader stopped asking for a page at all").toBeGreaterThan(0);
    expect(asked.limit,
      "a page this small makes thousands of round trips for one day, in two nightly folds").toBeGreaterThanOrEqual(500);
  });

  it("asks for one day, half-open, so no row is counted twice", async () => {
    const { db, range } = fakeDb([], 5000);
    await readLedgerDay(db, "2026-09-03");
    const lower = range.find((r) => r.op === ">=" || r.op === ">");
    const upper = range.find((r) => r.op === "<" || r.op === "<=");
    expect(lower, "the query stopped bounding the day below").toBeTruthy();
    expect(upper, "the query stopped bounding the day above").toBeTruthy();
    expect(lower!.op, "an inclusive lower bound is what makes the day start at midnight").toBe(">=");
    expect(upper!.op, "an inclusive upper bound double-counts the next day's first row").toBe("<");
    expect((lower!.val as Date).toISOString()).toBe("2026-09-03T00:00:00.000Z");
    expect((upper!.val as Date).toISOString()).toBe("2026-09-04T00:00:00.000Z");
  });
});

describe("memoLedgerReader (D387)", () => {
  // A db whose one query answers a short page and counts how often it was
  // asked — the memo's whole claim is the count.
  function countingDb(fail = false) {
    let gets = 0;
    const query = {
      where: () => query, orderBy: () => query, select: () => query, limit: () => query, startAfter: () => query,
      async get() {
        gets += 1;
        if (fail) throw new Error("UNAVAILABLE");
        return { size: 1, docs: [{ get: (f: string) => (f === "uid" ? "u1" : f === "qid" ? "daily-000" : undefined) }] };
      },
    };
    return { db: { collection: () => query } as unknown as Parameters<typeof memoLedgerReader>[0], gets: () => gets };
  }

  it("reads a day once however many folds ask for it, and each day once", async () => {
    const { db, gets } = countingDb();
    const ledgerDay = memoLedgerReader(db);
    const [a, b, c] = await Promise.all([ledgerDay("2026-09-05"), ledgerDay("2026-09-05"), ledgerDay("2026-09-05")]);
    expect(gets()).toBe(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toEqual([{ uid: "u1", qid: "daily-000", optionIdx: undefined }]);
    await ledgerDay("2026-09-04");
    expect(gets()).toBe(2);
  });

  it("forgets a read that failed, so the next fold retries instead of inheriting the rejection", async () => {
    const { db, gets } = countingDb(true);
    const ledgerDay = memoLedgerReader(db);
    await expect(ledgerDay("2026-09-05")).rejects.toThrow("UNAVAILABLE");
    await expect(ledgerDay("2026-09-05")).rejects.toThrow("UNAVAILABLE");
    expect(gets()).toBe(2);
  });
});

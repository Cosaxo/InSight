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

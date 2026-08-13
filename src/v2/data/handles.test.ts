// Handles, client side (D122).
//
// THE CASE THAT MATTERS MOST IS THE LAST ONE. This module's
// `normalizeHandle` is a hand copy of functions/src/pure.ts's, because
// functions/ ships as its own package and there is no build graph joining
// them. Two copies that must agree is a real risk, and the cheap version
// of the guarantee is a shared table of cases run against both — so the
// day someone loosens one side, a test says so instead of a user
// discovering that the field accepted a handle the callable refuses.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  atHandle, handleProblem, HANDLE_MAX, HANDLE_MIN, normalizeHandle, RESERVED_HANDLES,
} from "./handles";

// One table, used twice: once here and once against the server's copy.
const CASES: Array<[string, string | null]> = [
  ["olaf", "olaf"],
  ["Olaf", "olaf"],
  ["@Olaf", "olaf"],
  [" @OLAF ", "olaf"],
  ["olaf_2", "olaf_2"],
  ["12345a", "12345a"],
  ["ol.af", null],
  ["ol af", null],
  ["ol-af", null],
  ["ólaf", null],
  ["12345", null],
  ["ab", null],
  ["a".repeat(HANDLE_MAX + 1), null],
  ["insight", null],
  ["ME", null],
];

describe("normalizeHandle", () => {
  it("folds every typed form of one handle onto one key", () => {
    for (const [raw, want] of CASES) {
      expect(normalizeHandle(raw), `"${raw}"`).toBe(want);
    }
  });

  it("returns null for anything that is not a string", () => {
    for (const bad of [undefined, null, 42, {}, [], true]) {
      expect(normalizeHandle(bad), String(bad)).toBeNull();
    }
  });
});

describe("handleProblem — what the field says", () => {
  it("says nothing about an empty or valid handle", () => {
    // An untouched field is not an error; greeting someone in red is how
    // a form tells them off for arriving.
    expect(handleProblem("")).toBeNull();
    expect(handleProblem("   ")).toBeNull();
    expect(handleProblem("@")).toBeNull();
    expect(handleProblem("olaf")).toBeNull();
    expect(handleProblem("@Olaf")).toBeNull();
  });

  it("names the actual problem rather than 'invalid'", () => {
    expect(handleProblem("ab")).toMatch(new RegExp(`${HANDLE_MIN}`));
    expect(handleProblem("a".repeat(HANDLE_MAX + 1))).toMatch(new RegExp(`${HANDLE_MAX}`));
    expect(handleProblem("ol af")).toMatch(/letters, numbers/i);
    expect(handleProblem("12345")).toMatch(/at least one letter/i);
    expect(handleProblem("insight")).toMatch(/reserved/i);
  });

  it("measures the canonical form, not the typed one", () => {
    // "@" and the spaces are not part of the handle, so a name at the
    // limit must not be refused for the sigil in front of it.
    expect(handleProblem(` @${"a".repeat(HANDLE_MAX)} `)).toBeNull();
  });
});

describe("atHandle", () => {
  it("prefixes exactly one @, however many it was given", () => {
    expect(atHandle("olaf")).toBe("@olaf");
    expect(atHandle("@olaf")).toBe("@olaf");
    expect(atHandle("@@olaf")).toBe("@olaf");
  });
});

// ── the two copies agree ──────────────────────────────────────────
//
// Read as TEXT rather than imported: functions/ is a separate package
// with its own tsconfig and its own firebase deps, so importing it here
// would drag the admin SDK into the client's test run. Extracting the
// pieces that decide the answer and re-checking the same table against
// them is enough to catch the drift that matters — a rule loosened or
// tightened on one side only.
describe("the client and server copies stay in step", () => {
  const serverSrc = readFileSync(resolve(__dirname, "../../../functions/src/pure.ts"), "utf8");

  it("shares the same bounds", () => {
    expect(serverSrc).toMatch(new RegExp(`HANDLE_MAX = ${HANDLE_MAX}\\b`));
    expect(serverSrc).toMatch(new RegExp(`HANDLE_MIN = ${HANDLE_MIN}\\b`));
  });

  it("shares the same charset", () => {
    const m = /const HANDLE_RE = (\/\S+\/);/.exec(serverSrc);
    expect(m, "the server's HANDLE_RE moved or was renamed").toBeTruthy();
    expect(m![1]).toBe("/^[a-z0-9_]+$/");
  });

  it("shares the same reserved list, exactly", () => {
    // Both directions. A word on the server and not here means the field
    // accepts a handle the callable refuses (bad but visible); a word
    // here and not there means the field refuses one the callable would
    // grant, which reads as a bug in the app.
    const block = /export const RESERVED_HANDLES = new Set\(\[([\s\S]*?)\]\);/.exec(serverSrc);
    expect(block, "the server's RESERVED_HANDLES moved or was renamed").toBeTruthy();
    const server = new Set(
      [...block![1].matchAll(/"([a-z0-9_]+)"/g)].map((x) => x[1]),
    );
    expect([...server].sort()).toEqual([...RESERVED_HANDLES].sort());
  });
});

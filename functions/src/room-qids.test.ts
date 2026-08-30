// room-qids.test.ts — the gate on what the Near room will fold.
//
// `nearbyRoomV2` carries no rate limit, unlike the join, invite, suggest
// and booking callables, which all hold a budget document. Its cost bound
// was a SHAPE check: eight strings, ≤120 characters, no slash, no dot
// segment. That bounds a path injection and nothing else.
//
// What it does not bound is the fold. Every id the room has not already
// folded costs a getAll over ROOM_PEOPLE_CAP answer refs, and Firestore
// bills a missing document in a batchGet — so eight unknown ids are about
// 192 billed reads. A folded id is CACHED, which is what makes an honest
// caller cheap and an inventive one unbounded: eight FRESH invented ids on
// every call never hit the cache. The same strings also become field names
// on the shared, server-only room document that every caller in that cell
// reads, so invented ids grow it eight at a time until the write passes
// 1 MiB and fails into a catch that swallows it.
//
// The bank is right there, so the gate is a lookup rather than a guess.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isRoomQid } from "./v2social";
import { V2_QUESTIONS } from "./v2content";
import { ROOM_QUESTION_CAP, ROOM_WINDOW_QUESTION_CAP, roomWindowMisses } from "./pure";

describe("the room folds questions, not strings", () => {
  it("accepts what the bank holds and refuses what it does not", () => {
    const daily = V2_QUESTIONS.find((q) => q.surface === "daily");
    expect(daily, "the bank has no daily question — this fixture is stale").toBeTruthy();
    expect(isRoomQid(daily!.id)).toBe(true);
    expect(isRoomQid("made-up-question")).toBe(false);
    expect(isRoomQid("")).toBe(false);
    // The bound is not a length or a shape: this one is shape-legal.
    expect(isRoomQid("q".repeat(60))).toBe(false);
  });

  it("accepts a pulse day id, whose BASE is what the bank holds", () => {
    // The pulse surface mints one id per day from a template
    // (`{baseQid}_{YYYY-MM-DD}`, pinned in firestore.rules), so the bank
    // holds the base. Refusing the composite would drop a real question
    // from the room on the one surface that has a new id every morning.
    const pulse = V2_QUESTIONS.find((q) => q.surface === "pulse");
    expect(pulse, "the bank has no pulse question — this fixture is stale").toBeTruthy();
    expect(isRoomQid(`${pulse!.id}_2026-08-30`)).toBe(true);
    // …and the suffix is not a way back in for an invented base.
    expect(isRoomQid("not-a-question_2026-08-30")).toBe(false);
  });

  it("holds every id the real bank publishes", () => {
    // A vacuity guard on the two cases above: if the bank were empty, or
    // the id shape changed, they would both pass over nothing.
    expect(V2_QUESTIONS.length).toBeGreaterThan(100);
    for (const q of V2_QUESTIONS) expect(isRoomQid(q.id), q.id).toBe(true);
  });
});

describe("and the callable actually passes the gate", () => {
  // The predicate above is only a bound if the call site uses it, and a
  // test of the predicate alone cannot see that: removing the argument
  // from `nearbyRoomV2` leaves every case above green. Read off the
  // source, with comments stripped, because the paragraph beside the call
  // names the helper too.
  const src = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "v2social.ts"), "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("hands roomQids the bank predicate", () => {
    const call = /roomQids\(([^)]*)\)/.exec(src);
    expect(call, "nearbyRoomV2 no longer calls roomQids where this looks").toBeTruthy();
    expect(call![1], "the room's qids are shape-checked and not bank-checked")
      .toContain("isRoomQid");
  });
});

describe("and the window is bounded, not only the call", () => {
  // ROOM_QUESTION_CAP caps one request at eight. Nothing capped what the
  // CELL accumulates before its four-minute window turns over, so the
  // cached map could reach the whole bank — seven hundred keys on a
  // document every caller in that cell reads, at a batched read over
  // twenty-four people per key, eight at a time from any signed-in
  // account.
  //
  // WHAT STOOD HERE WAS A SOURCE REGEX, and it is why the bound shipped
  // dead. It asserted the fold list mentions the cap and subtracts
  // `Object.keys(qs)` — which is the arithmetic that was wrong, pinned by
  // its own shape. `qs` at that point holds the cached entries THIS CALL
  // asked for, so it is an intersection with the request and never exceeds
  // eight; `64 - 8` trimmed a list of at most eight. The cap could not bind
  // and the test could not fail. Behaviour now, over the function the call
  // site uses.
  const bank = V2_QUESTIONS.map((q) => q.id);
  const held = (n: number, from = 0): Record<string, Record<string, number>> =>
    Object.fromEntries(bank.slice(from, from + n).map((q) => [q, { "0": 1 }]));

  it("folds the whole call when the window is empty", () => {
    expect(roomWindowMisses(bank.slice(0, 8), undefined)).toHaveLength(8);
    expect(roomWindowMisses(bank.slice(0, 8), {})).toHaveLength(8);
  });

  it("measures the window by the CELL's map, not by this call's slice", () => {
    // The regression, stated as a number: sixty questions already folded
    // this window, eight fresh ones asked for, none of them among the
    // sixty. The headroom is four. The shipped arithmetic saw an
    // intersection of zero and folded all eight — every call, forever.
    const misses = roomWindowMisses(bank.slice(60, 68), held(60));
    expect(misses).toHaveLength(4);
  });

  it("folds nothing once the window is full", () => {
    expect(roomWindowMisses(bank.slice(64, 72), held(64))).toEqual([]);
  });

  it("charges nothing for what the window already holds", () => {
    // Three of the eight are cached, so only five are candidates — and the
    // cached three do not spend headroom twice.
    const misses = roomWindowMisses(bank.slice(0, 8), held(3));
    expect(misses).toEqual(bank.slice(3, 8));
  });

  it("cannot be walked past the cap eight questions at a time", () => {
    // The attack the constant exists for, run: one cell, one window, the
    // whole bank requested in slices of ROOM_QUESTION_CAP.
    const window: Record<string, Record<string, number>> = {};
    for (let i = 0; i < bank.length; i += ROOM_QUESTION_CAP) {
      for (const q of roomWindowMisses(bank.slice(i, i + ROOM_QUESTION_CAP), window)) {
        window[q] = { "0": 1 };
      }
    }
    expect(Object.keys(window).length).toBe(ROOM_WINDOW_QUESTION_CAP);
    expect(Object.keys(window).length).toBeLessThan(bank.length);
  });

  it("is a soft bound: it serves a thinner grid rather than refusing", () => {
    // This surface's own failure rule is to leave the stop with its
    // number, so the cap must not throw — over the cap it returns fewer
    // questions, never an error.
    expect(() => roomWindowMisses(bank.slice(0, 8), held(64))).not.toThrow();
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "v2social.ts"), "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(src).not.toMatch(/roomWindowMisses[\s\S]{0,120}HttpsError/);
  });

  it("the cap is smaller than the bank it used to be able to reach", () => {
    // A vacuity guard: a cap at or above the bank size would parse fine
    // and bound nothing.
    expect(ROOM_WINDOW_QUESTION_CAP).toBeGreaterThan(ROOM_QUESTION_CAP);
    expect(ROOM_WINDOW_QUESTION_CAP).toBeLessThan(V2_QUESTIONS.length);
  });

  it("and the callable folds by it, over the cell's own map", () => {
    // The wiring half, which no test of the function alone can see. Both
    // halves matter: the call must use the helper, and it must hand it the
    // CACHED map rather than the filtered one — handing it `qs` would
    // rebuild the dead bound exactly.
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "v2social.ts"), "utf8",
    ).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const call = /const missing = roomWindowMisses\(([^)]*)\)/.exec(src);
    expect(call, "the room's fold list is no longer built where this looks").toBeTruthy();
    expect(call![1].split(",")[1]?.trim(), "the window is measured by the cached map")
      .toBe("held");
    expect(src, "`held` is the document's own qs map").toMatch(/held = cq;/);
  });
});

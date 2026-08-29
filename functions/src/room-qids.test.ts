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

// The deferral queue (D121) — "not now" for a question that has to return.
//
// Small enough to read, and every branch here is one that decides whether
// an instrument's item is ever served again. The fail-safe direction is
// the property worth pinning: showing a question one more time costs a
// scroll, hiding one forever costs an axis.

import { describe, expect, it } from "vitest";
import { DEFER_MS, deferUntil, isDeferred, pruneDeferred } from "./deferQueue";

const T0 = 1_760_000_000_000;

describe("deferUntil / isDeferred", () => {
  it("holds a question back for the wait and then serves it again", () => {
    const map = { q1: deferUntil(T0) };
    expect(isDeferred(map, "q1", T0)).toBe(true);
    expect(isDeferred(map, "q1", T0 + DEFER_MS - 1)).toBe(true);
    // Due exactly on the boundary — the wait is over, not nearly over.
    expect(isDeferred(map, "q1", T0 + DEFER_MS)).toBe(false);
    expect(isDeferred(map, "q1", T0 + DEFER_MS + 1)).toBe(false);
  });

  it("waits under a day, so tomorrow at the same hour is not four hours short", () => {
    expect(DEFER_MS).toBeLessThan(24 * 60 * 60 * 1000);
    // …and long enough that it is not the same sitting.
    expect(DEFER_MS).toBeGreaterThan(8 * 60 * 60 * 1000);
  });

  it("treats anything it cannot read as NOT deferred", () => {
    // The map is device-local JSON any past build may have written. Garbage
    // must fail toward serving the question: a scroll is cheaper than an
    // axis that never fills.
    const bad = { a: NaN, b: Infinity, c: "soon", d: null, e: undefined } as unknown as Record<string, number>;
    for (const id of ["a", "b", "c", "d", "e", "missing"]) {
      expect(isDeferred(bad, id, T0), `"${id}" was treated as a live deferral`).toBe(false);
    }
    expect(isDeferred(undefined, "a", T0)).toBe(false);
  });
});

describe("pruneDeferred", () => {
  it("drops what has come due and keeps what has not", () => {
    const map = { old: T0 - 1, due: T0, live: T0 + 1 };
    expect(pruneDeferred(map, T0)).toEqual({ live: T0 + 1 });
  });

  it("returns the SAME object when nothing expired", () => {
    // The caller writes localStorage on a change, and identity is how it
    // knows there was one — so this is a contract, not an optimisation.
    const map = { live: T0 + 1 };
    expect(pruneDeferred(map, T0)).toBe(map);
  });

  it("clears a map of nothing but junk rather than carrying it forever", () => {
    const junk = { a: NaN, b: "x" } as unknown as Record<string, number>;
    expect(pruneDeferred(junk, T0)).toEqual({});
  });
});

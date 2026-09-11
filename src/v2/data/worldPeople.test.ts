// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseWorldDoc, resetWorldPositions, worldDocId, worldPositions } from "./worldPeople";
import LIVE from "./live";

describe("the world map's document id (D459)", () => {
  it("names the world's own and one per country code", () => {
    expect(worldDocId(null)).toBe("people-world");
    expect(worldDocId("NO")).toBe("people-NO");
    // the server encodes the same way, so a code that ever grew a slash
    // could not name a subcollection
    expect(worldDocId("A/B")).toBe("people-A%2FB");
  });
});

describe("parsing a published document", () => {
  it("takes the rows it can trust and drops the rest", () => {
    const out = parseWorldDoc({
      u1: { x: 0.4, y: -0.2, n: 31 },
      u2: { x: 0.1, y: 0.9, n: 8.6 },
      bad1: { x: "0.4", y: 0, n: 3 },
      bad2: { x: 0.4, n: 3 },
      bad3: { x: Number.NaN, y: 0, n: 3 },
      bad4: null,
    }, 4200, "2026-09-11");
    expect(out!.rows.map((r) => r.uid)).toEqual(["u1", "u2"]);
    // a row with a missing number would otherwise place a dot at the
    // origin, which is the one position that means something — it is
    // where the viewer's own solve starts
    expect(out!.rows[0]).toEqual({ uid: "u1", x: 0.4, y: -0.2, n: 31 });
    expect(out!.rows[1].n, "the count is a count").toBe(9);
    expect(out!.total).toBe(4200);
    expect(out!.day).toBe("2026-09-11");
  });

  it("never lets the stated population undercount the rows it is drawn from", () => {
    const out = parseWorldDoc({ u1: { x: 0, y: 0, n: 9 }, u2: { x: 0, y: 0, n: 9 } }, 1, "d");
    expect(out!.total, "a document claiming fewer than it holds states what it holds").toBe(2);
  });

  it("answers null for a document with no rows map", () => {
    expect(parseWorldDoc(undefined, 0, "")).toBeNull();
    expect(parseWorldDoc("rows", 0, "")).toBeNull();
  });
});

describe("the read", () => {
  beforeEach(() => { resetWorldPositions(); });

  it("reads nothing on a demo build — the fit has published no people", async () => {
    const spy = vi.spyOn(LIVE, "enabled", "get").mockReturnValue(false);
    expect(await worldPositions(null)).toBeNull();
    expect(await worldPositions("NO")).toBeNull();
    spy.mockRestore();
  });
});

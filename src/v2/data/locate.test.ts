// locateCell's accuracy floor (D292).
//
// The module had no suite of its own — near-presence.test.ts mocks it
// wholesale — so the one rule that decides whether a ~200 m presence id is
// real had nothing holding it.
//
// WHAT THIS IS ABOUT. `presenceCell` will happily turn any coordinate into
// a confident five-digit cell id; whether that id means anything depends
// entirely on how wide the reading under it was. Android 12+ offers
// Precise and Approximate inside the same permission dialog, and the
// Capacitor plugin proceeds on Approximate alone
// (handlePermissionResult checks the coarse alias). An approximate fix is
// 1-3 km. Folding one through a 223 m grid is the "invented precision" the
// OPTS comment in locate.ts names, and it does not only mislead the
// viewer: the room they join is a claim about which strangers they are
// standing near.
//
// The web path is exercised because it reaches the same guard through the
// same function — `getCoords` differs only in where the fix comes from.
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRESENCE_CELL_DEG } from "./geo";

const CELL_M = PRESENCE_CELL_DEG * 111_320;

/** Stub navigator.geolocation with one fix of a given accuracy. */
function fixAt(acc: number | undefined) {
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition: (ok: (p: unknown) => void) => {
        ok({ coords: { latitude: 59.9139, longitude: 10.7522, accuracy: acc } });
      },
    },
  });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("locateCell — a cell is only as real as the fix under it", () => {
  it("names a cell from a fix finer than the grid", async () => {
    fixAt(12); // an ordinary GPS fix
    const { locateCell } = await import("./locate");
    const r = await locateCell();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.cell).toMatch(/^-?\d{1,5}_-?\d{1,5}$/);
  });

  it("refuses a fix wider than the cell it would name", async () => {
    fixAt(2000); // Android's APPROXIMATE grant, in metres
    const { locateCell } = await import("./locate");
    const r = await locateCell();
    expect(r.ok).toBe(false);
    // Its own reason, not "unavailable" — the caller got a fix, and the
    // Near card would otherwise say "no location fix" to somebody holding
    // one. NearLiveBody renders a separate sentence for this.
    if (!r.ok) expect(r.reason).toBe("imprecise");
  });

  it("takes the boundary as good enough, and one metre past it as not", async () => {
    // The threshold is derived from PRESENCE_CELL_DEG rather than typed, so
    // this also fails if the grid moves and the floor does not follow.
    fixAt(CELL_M);
    const { locateCell } = await import("./locate");
    expect((await locateCell()).ok).toBe(true);

    vi.unstubAllGlobals();
    fixAt(CELL_M + 1);
    expect((await locateCell()).ok).toBe(false);
  });

  it("accepts a fix that reports no accuracy at all", async () => {
    // Some webviews omit it. Refusing on absence would turn a missing
    // field into a dead feature, and the pre-D292 behaviour — trust it —
    // is the right default for the unknown case.
    fixAt(undefined);
    const { locateCell } = await import("./locate");
    expect((await locateCell()).ok).toBe(true);
  });

  it("keeps its distance from locateCity, which a coarse fix answers fine", async () => {
    // The guard belongs to the cell path alone. "Which city" is exactly
    // the question a 2 km reading can answer, and the nearest city to one
    // is very nearly always right — so `imprecise` is not in LocateFail
    // and CityPicker carries no sentence for it.
    fixAt(2000);
    const mod = await import("./locate");
    const r = await mod.locateCell();
    expect(r.ok).toBe(false);

    // …and the same reading is not refused by the city path. `imprecise`
    // is not even in LocateFail, so this cannot be written as a
    // comparison — tsc rejects `city.reason !== "imprecise"` as having no
    // overlap, which IS the property, enforced at build time rather than
    // here. What remains for a test is that the reasons it can give are
    // the ones that existed before this guard.
    const city = await mod.locateCity();
    if (!city.ok) {
      expect(["unsupported", "denied", "unavailable", "timeout", "no-match"])
        .toContain(city.reason);
    }
  });
});

// THE ONE TAP THAT RAISED TWO DIALOGS, AND THE READING NOBODY AGREED TO.
//
// `getCoords` asked the OS for the `coarseLocation` alias and then called
// `getCurrentPosition` with `enableHighAccuracy: true` — whose own getAlias
// asks for [COARSE, FINE], from inside the plugin, with no tap behind it.
// So one "Use my location" raised a second system prompt, which is exactly
// the unprompted prompt the comment above that call exists to prevent. And
// if the user dismissed it, the app carried on with Android's approximate
// fix — a grid-quantised reading of roughly a kilometre — and folded it
// into a 0.002° (~200 m) presence square, publishing a room they were not
// standing in.
//
// Both halves are asserted here because neither is visible from the other:
// the alias is a property of the request, the refusal a property of the
// answer. Nothing exercised this module before.
import { beforeEach, describe, expect, it, vi } from "vitest";

const S = vi.hoisted(() => ({
  native: true,
  /** Every `permissions` array handed to requestPermissions. */
  asked: [] as string[][],
  perm: { location: "granted", coarseLocation: "granted" } as Record<string, string>,
  /** Every options object handed to getCurrentPosition. */
  opts: [] as { enableHighAccuracy?: boolean; maximumAge?: number }[],
  coords: { latitude: 59.9139, longitude: 10.7522, accuracy: 12 },
  /** Per-call accuracy, for the cases about CONVERGING on a fix; null
   *  leaves `coords` exactly as it is. */
  accuracyOf: null as null | (() => number),
}));

vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => S.native } }));
vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {
    requestPermissions: async (o: { permissions: string[] }) => { S.asked.push(o.permissions); return S.perm; },
    getCurrentPosition: async (o: { enableHighAccuracy?: boolean; maximumAge?: number }) => {
      S.opts.push(o);
      return { coords: S.accuracyOf ? { ...S.coords, accuracy: S.accuracyOf() } : S.coords };
    },
  },
}));
// The catalogue is a real network-free list in the app; here it only has to
// resolve, because these cases are about the FIX, not about the match.
vi.mock("./places", () => ({
  loadPlaces: async () => [{ city: "Oslo", cc: "NO", lat: 59.91, lon: 10.75 }],
  nearestPlace: () => ({ place: { city: "Oslo", cc: "NO" }, km: 1 }),
  placeKey: () => "Oslo, NO",
}));

let locate: typeof import("./locate");

beforeEach(async () => {
  S.native = true;
  S.asked = [];
  S.opts = [];
  S.perm = { location: "granted", coarseLocation: "granted" };
  S.coords = { latitude: 59.9139, longitude: 10.7522, accuracy: 12 };
  S.accuracyOf = null;
  vi.resetModules();
  locate = await import("./locate");
});

describe("the permission it asks for is the one it then uses", () => {
  it("requests the location alias, and gets one dialog for one tap", async () => {
    await locate.locateCell();
    expect(S.asked, "the permission call did not happen").toHaveLength(1);
    expect(S.asked[0], "asking for coarseLocation while requesting a precise fix is the second dialog")
      .toEqual(["location"]);
  });

  it("asks getCurrentPosition for exactly the accuracy that was granted", async () => {
    // Precise granted → precise requested.
    await locate.locateCell();
    expect(S.opts[0]?.enableHighAccuracy, "a precise grant was not used").toBe(true);

    // Approximate only → the plugin must not go behind the user and ask
    // for FINE again, which is what enableHighAccuracy true does.
    S.perm = { location: "denied", coarseLocation: "granted" };
    S.opts = [];
    await locate.locateCity();
    expect(S.opts[0]?.enableHighAccuracy, "an approximate grant still requested a precise fix").toBe(false);
  });

  it("still refuses when nothing was granted — the control", async () => {
    S.perm = { location: "denied", coarseLocation: "denied" };
    const r = await locate.locateCell();
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toBe("denied");
  });
});

describe("a fix coarser than the cell is not a cell", () => {
  it("refuses to publish a presence square from an approximate reading", async () => {
    S.perm = { location: "denied", coarseLocation: "granted" };
    S.coords = { ...S.coords, accuracy: 2000 };
    const r = await locate.locateCell();
    expect(r.ok, "a ~2 km reading was folded into a ~200 m square").toBe(false);
    // NOT "unavailable", which is what this asserted until 2026-09-11: the
    // card renders that as "No location fix — try again outside", and this
    // phone has a fix and is not helped by going outside. The refusal
    // stands; the word for it names the approximate GRANT.
    expect(r.ok === false && r.reason, "the failure row needs this exact reason").toBe("imprecise");
  });

  it("spends its retries before calling a first coarse reading imprecise", async () => {
    // The first sample a cold phone produces is the wifi/cell estimate; the
    // GNSS fix lands a beat later. Near shipped refusing on that first
    // sample, which is how a phone that CAN do better never switched it on.
    let n = 0;
    S.accuracyOf = () => (++n < 3 ? 900 : 30);
    const r = await locate.locateCell();
    expect(r.ok, "a fix that converged inside the budget was still refused").toBe(true);
    expect(n, "the retries were not fresh samples").toBeGreaterThan(1);
    // …and every retry forbids the cache, or it is the same reading again.
    expect(S.opts.slice(1).every((o) => o.maximumAge === 0), "a retry answered from the cache").toBe(true);
  });

  it("stops asking once a fix beats the cell", async () => {
    S.coords = { ...S.coords, accuracy: 12 };
    await locate.locateCell();
    expect(S.opts, "a good first fix bought retries nobody needed").toHaveLength(1);
  });

  it("accepts a fix that beats the cell — the control", async () => {
    S.coords = { ...S.coords, accuracy: 12 };
    const r = await locate.locateCell();
    expect(r.ok, "a 12 m fix was refused").toBe(true);
  });

  it("keeps the city path working on the same approximate reading", async () => {
    // The half that must NOT change: matching a reading to the nearest city
    // in a shipped list is what an approximate fix is for, and refusing one
    // would turn a legitimate grant into a broken button.
    S.perm = { location: "denied", coarseLocation: "granted" };
    S.coords = { ...S.coords, accuracy: 2000 };
    const r = await locate.locateCity();
    expect(r.ok, "an approximate grant broke the city picker").toBe(true);
    expect(r.ok === true && r.key).toBe("Oslo, NO");
  });

  it("keeps Near working where the platform reports no accuracy at all", async () => {
    // The refusal is for a fix MEASURED coarse, not for one whose accuracy
    // is unknown — otherwise a platform that omits the field loses Near.
    S.coords = { ...S.coords, accuracy: NaN };
    const r = await locate.locateCell();
    expect(r.ok).toBe(true);
  });
});

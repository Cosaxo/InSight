// Pins the catalogue contract. Two of these exist because the failure mode
// is silent: a place that parses wrong, or a key that does not round-trip,
// produces a profile that looks saved and a breakdown that never counts it.
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  countryOf,
  nearestPlace,
  parseCatalogue,
  parsePlaceKey,
  placeKey,
  regionHint,
  searchPlaces,
  zoneCountry,
  type Place,
} from "./places";

const SAMPLE = [
  "# a comment line",
  "# 4 places in 2 countries",
  "NO",
  "Oslo\t580\t59.91\t10.75",
  "Bergen\t214\t60.39\t5.32",
  "SE",
  "Stockholm\t1515\t59.33\t18.06",
  "Malmö\t317\t55.61\t13.00",
  "",
].join("\n");

describe("parseCatalogue", () => {
  it("reads country blocks and city rows", () => {
    const p = parseCatalogue(SAMPLE);
    expect(p).toHaveLength(4);
    expect(p[0]).toEqual({ name: "Oslo", country: "NO", popK: 580, lat: 59.91, lon: 10.75 });
    expect(p[3]).toEqual({ name: "Malmö", country: "SE", popK: 317, lat: 55.61, lon: 13.0 });
  });

  it("ignores comments and blank lines", () => {
    expect(parseCatalogue("# x\n\nNO\nOslo\t580\t59.91\t10.75\n")).toHaveLength(1);
  });

  it("stops at a line that is neither a comment, a code, nor a city", () => {
    // Half a file, or an HTML error page served in its place. Attributing
    // the remainder to a garbage country code is worse than stopping.
    const p = parseCatalogue("NO\nOslo\t580\t59.91\t10.75\n<!doctype html>\nBergen\t214\t60.39\t5.32\n");
    expect(p).toEqual([{ name: "Oslo", country: "NO", popK: 580, lat: 59.91, lon: 10.75 }]);
  });

  it("drops city rows that appear before any country", () => {
    expect(parseCatalogue("Oslo\t580\t59.91\t10.75\nNO\nBergen\t214\t60.39\t5.32\n")).toEqual([
      { name: "Bergen", country: "NO", popK: 214, lat: 60.39, lon: 5.32 },
    ]);
  });
});

describe("placeKey / parsePlaceKey", () => {
  it("round-trips", () => {
    const p: Place = { name: "Oslo", country: "NO", popK: 580, lat: 59.91, lon: 10.75 };
    expect(placeKey(p)).toBe("Oslo, NO");
    expect(parsePlaceKey("Oslo, NO")).toEqual({ name: "Oslo", country: "NO", popK: 0, lat: 0, lon: 0 });
  });

  it("round-trips a name that itself contains a comma", () => {
    // The regex is greedy on the name and anchored on a 2-letter tail, so
    // the split has to happen at the LAST comma, not the first.
    expect(parsePlaceKey("Washington, D C, US")).toEqual({
      name: "Washington, D C",
      country: "US",
      popK: 0, lat: 0, lon: 0,
    });
  });

  it("rejects free text left over from before the picker", () => {
    // These are real values sitting in profiles today. They must read as
    // "not a catalogue place" rather than parse into a bogus country.
    for (const s of ["oslo", "Oslo, Norway", "", "NO", "Oslo,NO"]) {
      expect(parsePlaceKey(s)).toBeNull();
    }
    expect(countryOf("Oslo, Norway")).toBe("");
    expect(countryOf("Oslo, NO")).toBe("NO");
  });
});

describe("searchPlaces", () => {
  const places = parseCatalogue(SAMPLE);

  it("ranks a prefix match above an interior one", () => {
    const p: Place[] = [
      { name: "West Malmesbury", country: "GB", popK: 900, lat: 51.6, lon: -2.1 },
      { name: "Malmö", country: "SE", popK: 317, lat: 55.61, lon: 13.0 },
    ];
    expect(searchPlaces(p, "malm").map((x) => x.name)).toEqual([
      "Malmö",
      "West Malmesbury",
    ]);
  });

  it("ranks a word-start match above a mid-word one", () => {
    const p: Place[] = [
      { name: "Palmyork", country: "US", popK: 900, lat: 40, lon: -74 },
      { name: "New York", country: "US", popK: 100, lat: 40.71, lon: -74.01 },
    ];
    expect(searchPlaces(p, "york").map((x) => x.name)).toEqual([
      "New York",
      "Palmyork",
    ]);
  });

  it("breaks ties by population", () => {
    expect(searchPlaces(places, "").map((x) => x.name)).toEqual([
      "Stockholm", "Oslo", "Malmö", "Bergen",
    ]);
  });

  it("matches without diacritics in either direction", () => {
    expect(searchPlaces(places, "malmo").map((x) => x.name)).toEqual(["Malmö"]);
    expect(searchPlaces(places, "Malmö").map((x) => x.name)).toEqual(["Malmö"]);
  });

  it("honours the result cap", () => {
    expect(searchPlaces(places, "", 2)).toHaveLength(2);
  });
});

describe("zoneCountry / regionHint — the blank-state hint (D90)", () => {
  const places = parseCatalogue(SAMPLE);

  it("names the country whose principal city the clock zone carries", () => {
    expect(zoneCountry(places, "Europe/Oslo")).toBe("NO");
    expect(zoneCountry(places, "Europe/Stockholm")).toBe("SE");
  });

  it("reads underscores and nested zones the way IANA writes them", () => {
    const p: Place[] = [
      { name: "New York", country: "US", popK: 8500, lat: 40.71, lon: -74.01 },
      { name: "Buenos Aires", country: "AR", popK: 15000, lat: -34.61, lon: -58.38 },
    ];
    expect(zoneCountry(p, "America/New_York")).toBe("US");
    expect(zoneCountry(p, "America/Argentina/Buenos_Aires")).toBe("AR");
  });

  it("matches through diacritics, the way the search does", () => {
    const p: Place[] = [{ name: "São Paulo", country: "BR", popK: 12325, lat: -23.55, lon: -46.63 }];
    expect(zoneCountry(p, "America/Sao_Paulo")).toBe("BR");
  });

  it("matches the word-boundary prefix IANA shortens to", () => {
    // "America/New_York" names New York City; "Asia/Kuwait" Kuwait City.
    const p: Place[] = [
      { name: "New York City", country: "US", popK: 8175, lat: 40.71, lon: -74.01 },
      { name: "Kuwait City", country: "KW", popK: 60, lat: 29.37, lon: 47.98 },
    ];
    expect(zoneCountry(p, "America/New_York")).toBe("US");
    expect(zoneCountry(p, "Asia/Kuwait")).toBe("KW");
  });

  it("requires the word break — London must not match Londonderry", () => {
    const p: Place[] = [{ name: "Londonderry", country: "GB", popK: 85, lat: 55, lon: -7.31 }];
    expect(zoneCountry(p, "Europe/London")).toBe("");
  });

  it("prefers the exact name over a prefixed one, whatever the populations", () => {
    // The zone string here is synthetic — the SHAPE is what is under test:
    // when a zone names a city the catalogue has verbatim, a larger city
    // that merely starts the same must not steal the hint.
    const p: Place[] = [
      { name: "Victoria Falls", country: "ZW", popK: 900, lat: -17.93, lon: 25.83 },
      { name: "Victoria", country: "SC", popK: 26, lat: -4.62, lon: 55.45 },
    ];
    expect(zoneCountry(p, "Indian/Victoria")).toBe("SC");
  });

  it("takes the most populous namesake — IANA names the principal city", () => {
    const p: Place[] = [
      { name: "Dublin", country: "US", popK: 50, lat: 40.1, lon: -83.11 },
      { name: "Dublin", country: "IE", popK: 1256, lat: 53.35, lon: -6.26 },
    ];
    expect(zoneCountry(p, "Europe/Dublin")).toBe("IE");
  });

  it("returns '' rather than guessing when the zone names no catalogue city", () => {
    for (const z of ["UTC", "Etc/UTC", "Asia/Kathmandu", ""]) {
      expect(zoneCountry(places, z), z).toBe("");
    }
  });

  it("ranks the hint country first in the blank state, world order after", () => {
    expect(searchPlaces(places, "", 40, "NO").map((x) => x.name)).toEqual([
      "Oslo", "Bergen", "Stockholm", "Malmö",
    ]);
  });

  it("never lets the hint outrank a typed query", () => {
    // Typing is the user answering for themselves: "malm" under a
    // Norwegian clock still returns Malmö alone.
    expect(searchPlaces(places, "malm", 40, "NO").map((x) => x.name)).toEqual(["Malmö"]);
  });

  it("regionHint reads the device clock, and only the device clock", () => {
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockReturnValue({ timeZone: "Europe/Oslo" } as Intl.ResolvedDateTimeFormatOptions);
    try {
      expect(regionHint(places)).toBe("NO");
    } finally {
      spy.mockRestore();
    }
  });

  it("regionHint is '' where Intl cannot say — the countryName guard again", () => {
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions")
      .mockImplementation(() => { throw new Error("ancient WebView"); });
    try {
      expect(regionHint(places)).toBe("");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("nearestPlace", () => {
  const places = parseCatalogue(SAMPLE);

  it("returns the closest place and a plausible distance", () => {
    // Standing in Oslo.
    const hit = nearestPlace(places, 59.91, 10.75);
    expect(hit?.place.name).toBe("Oslo");
    expect(hit?.km).toBeLessThan(1);
    // Roughly Gothenburg — closer to Malmö than to any Norwegian entry here.
    expect(nearestPlace(places, 57.71, 11.97)?.place.name).toBe("Malmö");
  });

  it("ignores population — nearest means nearest", () => {
    // Bergen is tiny next to Stockholm, and it is what someone in Bergen
    // must get. Ranking that accidentally weighted population would return
    // the big city and be wrong in the least visible way possible.
    const hit = nearestPlace(places, 60.39, 5.32);
    expect(hit?.place.name).toBe("Bergen");
  });

  it("measures a known distance correctly", () => {
    // Oslo → Stockholm is ~416 km great-circle. A flat-plane approximation
    // at this latitude reads ~30% long, so this pins the haversine.
    const km = nearestPlace([places[2]], 59.91, 10.75)!.km;
    expect(km).toBeGreaterThan(390);
    expect(km).toBeLessThan(440);
  });

  it("crosses the antimeridian rather than round the world", () => {
    // A plane-distance ranking treats lon 179 and -179 as 358° apart
    // instead of 2°, so it would send someone in Fiji to the wrong ocean.
    const pac: Place[] = [
      { name: "West", country: "FJ", popK: 1, lat: 0, lon: 179.5 },
      { name: "Far", country: "XX", popK: 1, lat: 0, lon: 100 },
    ];
    expect(nearestPlace(pac, 0, -179.5)?.place.name).toBe("West");
  });

  it("handles the poles, where longitude stops meaning distance", () => {
    const polar: Place[] = [
      { name: "Longyearbyen", country: "SJ", popK: 2, lat: 78.22, lon: 15.63 },
      { name: "Quito", country: "EC", popK: 1600, lat: -0.23, lon: -78.52 },
    ];
    expect(nearestPlace(polar, 84, -120)?.place.name).toBe("Longyearbyen");
  });

  it("returns null rather than a wrong answer on bad input", () => {
    expect(nearestPlace([], 59.91, 10.75)).toBeNull();
    expect(nearestPlace(places, NaN, 10.75)).toBeNull();
    expect(nearestPlace(places, 59.91, Infinity)).toBeNull();
  });

  it("never returns NaN for an exact hit", () => {
    // acos(1 + 2e-16) is NaN, and an exact coordinate match is the input
    // most likely to produce it — which is to say, the emulator's.
    for (const p of places) {
      const hit = nearestPlace(places, p.lat, p.lon);
      expect(Number.isFinite(hit!.km), p.name).toBe(true);
    }
  });
});

// The shipped catalogue itself. check-cities.mjs validates its shape in CI;
// this asserts the runtime parser agrees with that shape, which is the half
// a format check cannot cover.
describe("the shipped catalogue", () => {
  const text = readFileSync(resolve(__dirname, "../../../public/cities.txt"), "utf8");
  const places = parseCatalogue(text);

  it("parses in full", () => {
    const declared = /# (\d+) places in (\d+) countries/.exec(text);
    expect(declared).not.toBeNull();
    expect(places).toHaveLength(Number(declared![1]));
    expect(new Set(places.map((p) => p.country)).size).toBe(Number(declared![2]));
  });

  it("produces only keys the breakdown pipeline accepts", () => {
    // Mirrors breakdownBucket() and BREAKDOWN_MAX_LABEL in
    // functions/src/pure.ts. A violation here is a user who can pick a city
    // and then never appear in a single breakdown.
    for (const p of places) {
      const key = placeKey(p);
      expect(key.length, key).toBeLessThanOrEqual(40);
      expect(/[./[\]*~]/.test(key), key).toBe(false);
      expect(parsePlaceKey(key), key).toEqual({ ...p, popK: 0, lat: 0, lon: 0 });
    }
  });

  it("finds the cities a first-time user is most likely to type", () => {
    for (const q of ["oslo", "new york", "sao paulo", "zurich", "malmo"]) {
      expect(searchPlaces(places, q, 5).length, q).toBeGreaterThan(0);
    }
  });

  it("turns the common clock zones into their countries (D90)", () => {
    // Against the real vocabulary, because these strings come from devices,
    // not fixtures: if an upstream rename ever drops one of these cities,
    // the hint silently stops working for that country — and this says so.
    for (const [zone, cc] of [
      ["Europe/Oslo", "NO"],
      ["Europe/Stockholm", "SE"],
      ["America/New_York", "US"], // the catalogue says "New York City"
      ["America/Sao_Paulo", "BR"],
      ["Asia/Tokyo", "JP"],
      ["Asia/Ho_Chi_Minh", "VN"], // "Ho Chi Minh City"
      ["Europe/Dublin", "IE"], // two real Dublins; the namesake rule picks Ireland's
    ] as const) {
      expect(zoneCountry(places, zone), zone).toBe(cc);
    }
  });
});

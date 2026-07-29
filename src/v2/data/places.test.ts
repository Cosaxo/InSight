// Pins the catalogue contract. Two of these exist because the failure mode
// is silent: a place that parses wrong, or a key that does not round-trip,
// produces a profile that looks saved and a breakdown that never counts it.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  countryOf,
  nearestPlace,
  parseCatalogue,
  parsePlaceKey,
  placeKey,
  searchPlaces,
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
});

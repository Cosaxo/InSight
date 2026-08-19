// @vitest-environment jsdom
//
// Has the phone agreed with your city? (D205)
//
// The module is six lines of reading, and the cases that matter are all
// about the shape rather than the reading: the confirmation is stored as
// the CITY KEY, not as a boolean, so it can only ever be true of the city
// standing beside it. A flag would have needed clearing on every path that
// changes the city, and the path somebody forgot would leave a stale
// "confirmed" on a city nobody ever checked.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CITY_OK_LEAF, PROFILE_GENERAL_LS, cityIsConfirmed, confirmedCityKey } from "./cityConfirm";

const blob = (vitals: Record<string, unknown>) =>
  localStorage.setItem(PROFILE_GENERAL_LS, JSON.stringify({ vitals }));

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("confirmedCityKey", () => {
  it("is empty when nothing has ever been confirmed", () => {
    expect(confirmedCityKey()).toBe("");
    blob({ city: "Oslo, NO" });
    expect(confirmedCityKey()).toBe("");
  });

  it("reads the key the device's fix agreed with", () => {
    blob({ city: "Oslo, NO", [CITY_OK_LEAF]: "Oslo, NO" });
    expect(confirmedCityKey()).toBe("Oslo, NO");
  });

  it("survives a corrupt or foreign blob rather than throwing on every render", () => {
    // It is read at vote time and on every Scores render; a throw here
    // would take the screen with it.
    localStorage.setItem(PROFILE_GENERAL_LS, "{not json");
    expect(confirmedCityKey()).toBe("");
    localStorage.setItem(PROFILE_GENERAL_LS, JSON.stringify({ vitals: "nope" }));
    expect(confirmedCityKey()).toBe("");
    localStorage.setItem(PROFILE_GENERAL_LS, JSON.stringify({ vitals: { cityOk: 7 } }));
    expect(confirmedCityKey()).toBe("");
  });
});

describe("cityIsConfirmed — why the key, and not a flag", () => {
  it("is true only for the city the fix actually named", () => {
    blob({ city: "Oslo, NO", [CITY_OK_LEAF]: "Oslo, NO" });
    expect(cityIsConfirmed("Oslo, NO")).toBe(true);
  });

  it("goes false the moment the city changes, with nothing to clear", () => {
    // The whole argument for storing a key. Confirmed in Bergen, then a
    // manual pick of Oslo: a boolean left standing would have Oslo
    // inheriting Bergen's evidence, and the bug would be a missing line in
    // whichever writer forgot.
    blob({ city: "Bergen, NO", [CITY_OK_LEAF]: "Bergen, NO" });
    expect(cityIsConfirmed("Bergen, NO")).toBe(true);
    expect(cityIsConfirmed("Oslo, NO")).toBe(false);
  });

  it("never confirms an empty city", () => {
    // "Nowhere" cannot be verified, and a true here would let a profile
    // with no city score every place at once.
    blob({ [CITY_OK_LEAF]: "" });
    expect(cityIsConfirmed("")).toBe(false);
    expect(cityIsConfirmed(null)).toBe(false);
    expect(cityIsConfirmed(undefined)).toBe(false);
  });

  it("is false for everyone who has never tapped 'use my location'", () => {
    // The default, and the population the gate is actually about.
    blob({ city: "Oslo, NO" });
    expect(cityIsConfirmed("Oslo, NO")).toBe(false);
  });
});

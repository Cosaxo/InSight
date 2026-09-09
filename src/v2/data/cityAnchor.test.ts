// @vitest-environment jsdom
//
// setCityAnchor writes "my city is X" to TWO stores, and the second is the
// one a review would wave through as redundant: GeneralPanel mirrors its
// localStorage vitals into saveAnchors wholesale on every profile mount —
// deliberately, as the repair path for fabricated anchors — so a city that
// reaches only the server survives exactly until the profile overlay next
// opens, then vanishes without an error anywhere. These tests pin both
// halves and the derivation between them.

import { beforeEach, describe, expect, it, vi } from "vitest";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  anchors: () => ({} as Record<string, string>),
  saveAnchors: vi.fn(),
}));
vi.mock("./live", () => ({ default: LIVE }));

const { PROFILE_GENERAL_LS, setCityAnchor } = await import("./cityAnchor");

beforeEach(() => {
  localStorage.clear();
  LIVE.enabled = true;
  LIVE.anchors = () => ({});
  LIVE.saveAnchors.mockClear();
});

describe("setCityAnchor · the anchor half", () => {
  it("saves the city with its country DERIVED from the key, never typed", () => {
    setCityAnchor("Bergen, NO");
    expect(LIVE.saveAnchors).toHaveBeenCalledWith(
      expect.objectContaining({ city: "Bergen, NO", country: "NO" }),
    );
  });

  it("preserves the anchors the profile already collected", () => {
    // saveAnchors replaces the map wholesale (live.ts) — a bare
    // {city, country} here would silently drop age band, gender, education
    // from every future answer's snapshot.
    LIVE.anchors = () => ({ ageBand: "25-34", gender: "Woman" });
    setCityAnchor("Bergen, NO");
    expect(LIVE.saveAnchors).toHaveBeenCalledWith({
      ageBand: "25-34", gender: "Woman", city: "Bergen, NO", country: "NO",
    });
  });

  it("does nothing at all in demo mode", () => {
    // Demo's profile is the sample persona; a "real" city written into it
    // would be the reverse of the leak D66 records.
    LIVE.enabled = false;
    setCityAnchor("Bergen, NO");
    expect(LIVE.saveAnchors).not.toHaveBeenCalled();
    expect(localStorage.getItem(PROFILE_GENERAL_LS)).toBeNull();
  });
});

describe("setCityAnchor · the profile-blob half", () => {
  it("writes vitals.city into a blob that did not exist yet", () => {
    setCityAnchor("Bergen, NO");
    const blob = JSON.parse(localStorage.getItem(PROFILE_GENERAL_LS) || "null");
    expect(blob).toEqual({ vitals: { city: "Bergen, NO", cityOk: "" } });
  });

  it("touches exactly the two city leaves of an existing blob", () => {
    // loadGen round-trips interests/likes/heroes it no longer renders,
    // precisely so an edit cannot lose an older build's data — this write
    // has to honour the same contract.
    localStorage.setItem(PROFILE_GENERAL_LS, JSON.stringify({
      vitals: { born: "1994", job: "Nurse", city: "Oslo, NO" },
      interests: ["chess"],
      heroes: [{ name: "X" }],
    }));
    setCityAnchor("Bergen, NO");
    const blob = JSON.parse(localStorage.getItem(PROFILE_GENERAL_LS) || "null");
    expect(blob).toEqual({
      vitals: { born: "1994", job: "Nurse", city: "Bergen, NO", cityOk: "" },
      interests: ["chess"],
      heroes: [{ name: "X" }],
    });
  });

  // D205: the confirmation is stored as the KEY, so it can only ever be
  // true of the city standing beside it. These two cases are the reason
  // that shape was chosen over a boolean.
  it("records the key when the device's own fix produced it", () => {
    setCityAnchor("Bergen, NO", true);
    const blob = JSON.parse(localStorage.getItem(PROFILE_GENERAL_LS) || "null");
    expect(blob.vitals).toEqual({ city: "Bergen, NO", cityOk: "Bergen, NO" });
  });

  it("clears a previous city's confirmation when the city is re-picked", () => {
    // The staleness a boolean would have allowed: confirmed in Bergen,
    // then manually pick Oslo. A flag left standing would have Oslo
    // inheriting Bergen's evidence.
    setCityAnchor("Bergen, NO", true);
    setCityAnchor("Oslo, NO");
    const blob = JSON.parse(localStorage.getItem(PROFILE_GENERAL_LS) || "null");
    expect(blob.vitals).toEqual({ city: "Oslo, NO", cityOk: "" });
  });

  it("recovers from a corrupt blob instead of losing the anchor write", () => {
    localStorage.setItem(PROFILE_GENERAL_LS, "{not json");
    setCityAnchor("Bergen, NO");
    const blob = JSON.parse(localStorage.getItem(PROFILE_GENERAL_LS) || "null");
    expect(blob).toEqual({ vitals: { city: "Bergen, NO", cityOk: "" } });
    expect(LIVE.saveAnchors).toHaveBeenCalled();
  });
});

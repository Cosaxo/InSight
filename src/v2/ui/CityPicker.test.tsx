// @vitest-environment jsdom
//
// CityPicker is where the `city` anchor comes from, and the anchor is a
// Firestore map key that the server shape-checks (`/^.+, [A-Z]{2}$/`,
// breakdownBucket in functions/src/pure.ts). A picker that emits anything
// else contributes to no cohort at all — silently, because the write
// succeeds and only the breakdown goes quiet.
//
// It is also the one place in the app that asks for location. D9's
// amendment records that all four failure paths were "driven in a real
// browser and each returns to a usable picker with its own message" —
// because "we couldn't find you" after a deliberate refusal reads as broken
// software, and "try again" after a hard refusal sends the user in a loop.
// That was hand-verified once. These make it a standing test.
//
// `../data/places` is NOT mocked: its search and key functions are pure and
// already covered against the shipped catalogue by places.test.ts, and using
// the real ones is what makes "the picker emits a key the server accepts" a
// statement about the real vocabulary. Only the catalogue LOAD is stubbed,
// since it is a fetch.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { LocateResult } from "../data/locate";
import type { Place } from "../data/places";

const locate = vi.hoisted(() => ({
  supported: true,
  result: { ok: false, reason: "denied" } as LocateResult,
}));
vi.mock("../data/locate", () => ({
  locateCity: async () => locate.result,
  locateSupported: () => locate.supported,
}));

const { default: CityPicker } = await import("./CityPicker");
const { default: PLACES } = await import("../data/places");

// Three real-shaped catalogue rows. `load` is stubbed because it fetches;
// everything downstream of it is the real implementation.
const CATALOGUE: Place[] = [
  { name: "Oslo", country: "NO", popK: 709, lat: 59.91, lon: 10.75 },
  { name: "Bergen", country: "NO", popK: 213, lat: 60.39, lon: 5.32 },
  { name: "Osaka", country: "JP", popK: 2691, lat: 34.69, lon: 135.5 },
];

beforeEach(() => {
  locate.supported = true;
  locate.result = { ok: false, reason: "denied" };
  vi.spyOn(PLACES, "load").mockResolvedValue(CATALOGUE);
  vi.spyOn(PLACES, "peek").mockReturnValue(CATALOGUE);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// The server's own shape check, copied verbatim from
// BREAKDOWN_DIM_SHAPE.city in functions/src/pure.ts. If the picker can emit
// a value this rejects, that city contributes to no breakdown.
const SERVER_CITY_SHAPE = /^.+, [A-Z]{2}$/;

// The picker renders COLLAPSED as a button; the search input only exists
// once it is opened. Three details the first draft of this file got wrong,
// each of which made every case fail identically:
//   - open it by clicking the collapsed button, not by focusing an input
//     that is not in the tree yet;
//   - results are role="option" and commit on POINTERDOWN, because the
//     outside-tap handler runs on pointerdown and would close the list
//     before a click could land;
//   - so does "Use my location", for the same reason.
function open(props: { value?: string } = {}) {
  const onChange = vi.fn();
  render(<CityPicker value={props.value ?? ""} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: /Choose your city|^City:/i }));
  return onChange;
}
const search = () => screen.getByRole("combobox");
const type = (q: string) => fireEvent.change(search(), { target: { value: q } });
const chooseOption = (re: RegExp) => {
  const opt = screen.getAllByRole("option").find((o) => re.test(o.textContent || ""));
  expect(opt, `no result matched ${re}`).toBeTruthy();
  fireEvent.click(opt!);
};
const tapLocate = () => {
  const btn = screen.getAllByRole("button").find((b) => /Use my location/.test(b.textContent || ""));
  expect(btn, "the location button is not on screen").toBeTruthy();
  fireEvent.click(btn!);
};

describe("CityPicker · every value it emits is one the server accepts", () => {
  it("emits the canonical 'Name, CC' key when a result is chosen", async () => {
    const onChange = open();
    type("Oslo");
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
    chooseOption(/Oslo/);
    // Not confirmed: scrolling to the right answer is still not a machine
    // agreeing with it (D205). The flag says a check happened, not that
    // the city is correct.
    expect(onChange).toHaveBeenCalledWith("Oslo, NO", false);
    expect(onChange.mock.calls[0][0]).toMatch(SERVER_CITY_SHAPE);
  });

  it("emits a shape-valid key for every catalogue row reachable by search", async () => {
    // Not just the happy one. A row whose name or country broke the shape
    // would be pickable in the UI and absent from every breakdown, which is
    // exactly the failure mode check-cities.mjs guards at build time — this
    // is the same property at the component's own boundary.
    for (const place of CATALOGUE) {
      cleanup();
      const onChange = open();
      type(place.name);
      await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
      chooseOption(new RegExp(place.name));
      expect(onChange).toHaveBeenCalled();
      expect(onChange.mock.calls[0][0], `${place.name} produced an unusable key`)
        .toMatch(SERVER_CITY_SHAPE);
    }
  });
});

describe("CityPicker · every location failure lands somewhere usable (D9)", () => {
  // One case per LocateFail, because the whole point of the table in
  // CP_FAIL is that the sentences are NOT interchangeable. A single
  // "location failed" case would pass with all five collapsed into one.
  const CASES: Array<[string, RegExp]> = [
    ["denied", /No problem — search instead/i],
    ["unavailable", /No location fix/i],
    ["timeout", /took too long/i],
    ["unsupported", /can't share a location/i],
    ["no-match", /No city matched/i],
  ];

  for (const [reason, copy] of CASES) {
    it(`explains "${reason}" in its own words and leaves the search usable`, async () => {
      locate.result = { ok: false, reason } as LocateResult;
      open();
      tapLocate();
      expect(await screen.findByText(copy)).toBeTruthy();
      // The manual picker is right there in every case, so none of these is
      // a dead end — the claim the comment in CP_FAIL makes.
      type("Bergen");
      await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
      expect(screen.getAllByRole("option").some((o) => /Bergen/.test(o.textContent || ""))).toBe(true);
    });
  }

  it("never says 'try again' after a refusal", async () => {
    // A refusal is a decision, not a transient error. Offering a retry
    // sends the user into a loop against a permission the OS will not
    // re-prompt for.
    locate.result = { ok: false, reason: "denied" };
    open();
    tapLocate();
    await screen.findByText(/No problem/i);
    expect(document.body.textContent).not.toMatch(/try again/i);
  });

  it("hides the location button entirely where it is unsupported", () => {
    locate.supported = false;
    open();
    // queryAllByRole, not getAllByRole: with the location row gone and no
    // query typed there are no buttons in the list at all, and the `get`
    // form throws on an empty match — which would fail this case for the
    // opposite of the reason it is testing.
    expect(screen.queryAllByRole("button").some((b) => /Use my location/.test(b.textContent || ""))).toBe(false);
  });
});

describe("CityPicker · a located city is suggested, never applied", () => {
  it("does not write the anchor until the suggestion is accepted", async () => {
    // Silently rewriting a profile from a sensor reading is the thing D9's
    // amendment refuses. The suggestion appears; onChange does not fire.
    locate.result = { ok: true, key: "Oslo, NO", km: 3 };
    const onChange = open();
    tapLocate();
    await screen.findByText(/Nearest city/i);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("emits the canonical key once the suggestion is accepted", async () => {
    locate.result = { ok: true, key: "Oslo, NO", km: 3 };
    const onChange = open();
    tapLocate();
    const suggestion = await screen.findByText(/Nearest city/i);
    fireEvent.click(suggestion.closest("button")!);
    // The one path that confirms: the device produced this key and the
    // user kept it (D205).
    expect(onChange).toHaveBeenCalledWith("Oslo, NO", true);
  });

  it("does NOT confirm a city typed after the suggestion was offered", async () => {
    // The trap the two-argument signature exists to avoid: a located
    // suggestion on screen does not make the NEXT pick a confirmed one.
    locate.result = { ok: true, key: "Oslo, NO", km: 3 };
    const onChange = open();
    tapLocate();
    await screen.findByText(/Nearest city/i);
    type("Bergen");
    await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
    chooseOption(/Bergen/);
    expect(onChange).toHaveBeenCalledWith("Bergen, NO", false);
  });
});

describe("CityPicker · a pre-D9 free-text value is shown, not blanked", () => {
  it("keeps an unparseable legacy value visible", () => {
    // "oslo" does not parse, and those users "see their old value with a
    // prompt to re-pick" rather than having their profile silently emptied
    // (D9's known limits). Blanking it would look like data loss.
    const onChange = vi.fn();
    render(<CityPicker value="oslo" onChange={onChange} />);
    expect(document.body.textContent).toMatch(/oslo/);
    expect(onChange).not.toHaveBeenCalled();
  });
});

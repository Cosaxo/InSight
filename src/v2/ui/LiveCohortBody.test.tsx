// @vitest-environment jsdom
//
// LiveCohortBody renders the Mirror's Near / Country / World stops from the
// k-floored public aggregates. It is the panel with the most ways to lie
// quietly, because everything it draws is a claim about a cohort:
//
//   - an ABSENT breakdown cell means "below the floor", not "nobody answered".
//     Dropping it silently is the failure this panel's `withheld` counter
//     exists to prevent, and a counter is exactly the kind of thing that
//     keeps compiling after it stops being correct.
//   - at world scope the server's own `tooSmall` flag is authoritative, "an
//     agg can carry stale counts while still being below it". Reading the
//     counts instead would publish a split the floor withheld.
//   - the floor NUMBER is printed to the user, so it has to be the floor the
//     server actually enforces.
//
// The mount tests in test/smoke-live.test.jsx render this panel as part of
// the app and prove it does not crash. That is a different question from
// whether it tells the truth, which is what these assert.
//
// `../data/live` is mocked rather than booted: it imports Firebase, and what
// this panel consumes from it is three getters and two functions. Mocking
// the module is what lets the aggregate shapes below be exact — including
// the ones the real store would never produce twice in a row.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  uid: "u_me",
  myCity: "Oslo, NO",
  deck: () => [] as Array<Record<string, unknown>>,
  // The qid parameter is real — the cases below vary the aggregate per
  // question. `void qid` because the repo's eslint has no argsIgnorePattern,
  // so an underscore prefix does not exempt an unused parameter.
  aggFor: (qid: string) => { void qid; return null as Record<string, unknown> | null; },
  subscribe: () => () => {},
  // The lens row (D99) mounts inside this panel and reads the store for
  // the viewer's own votes and the Kindred ranking. Stubbed flat here —
  // the lenses have their own suite; what these cases care about is that
  // the panel still renders its answer rows around them.
  myVotes: () => ({} as Record<string, string>),
  loadKindred: async () => {},
  kindred: () => [] as Array<{ uid: string; name: string; like: { shared: number; same: number; pct: number } }>,
  kindredLoading: () => false,
  kindredDepth: () => 0,
  // The Right now card (D84). Reassigned per case; the default is the
  // supported-but-off pitch state.
  near: {
    supported: () => true as boolean,
    on: () => false as boolean,
    count: () => null as number | null,
    tooFew: () => false as boolean,
    updatedAt: () => 0,
    lastError: () => null as string | null,
    enable: vi.fn(async () => ({ ok: true } as { ok: boolean; reason?: string })),
    disable: vi.fn(async () => {}),
    refresh: () => {},
  },
}));
vi.mock("../data/live", () => ({ default: LIVE }));
// The persist helper is a spy: what it writes (the profile blob AND the
// anchor map, in that order of subtlety) has its own suite in
// data/cityAnchor.test.ts — here the question is only whether the embedded
// picker is wired to it at all, because a no-op onChange renders pixel-for
// pixel the same.
const setCityAnchor = vi.hoisted(() => vi.fn());
vi.mock("../data/cityAnchor", () => ({ setCityAnchor }));
// The resolver is mocked for the same reason live is: the real one asks the
// platform for a fix. What D92's cases need is only its contract — a
// catalogue key or a reason, never a coordinate.
const locateCity = vi.hoisted(() =>
  vi.fn(async () => ({ ok: true, key: "Oslo, NO", km: 2 } as
    { ok: true; key: string; km: number } | { ok: false; reason: string })));
vi.mock("../data/locate", () => ({ locateCity, locateSupported: () => true }));

const { default: LiveCohortBody } = await import("./LiveCohortBody");
const { default: PLACES } = await import("../data/places");
// Two questions, so "one is shown and one is withheld" is expressible.
const Q = (id: string, text: string) => ({
  id, text, options: [{ label: "Yes" }, { label: "No" }],
});

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.myCity = "Oslo, NO";
  LIVE.deck = () => [Q("q1", "First question"), Q("q2", "Second question")];
  LIVE.aggFor = () => null;
  LIVE.near.supported = () => true;
  LIVE.near.on = () => false;
  LIVE.near.count = () => null;
  LIVE.near.tooFew = () => false;
  setCityAnchor.mockClear();
  locateCity.mockClear();
  locateCity.mockImplementation(async () => ({ ok: true, key: "Oslo, NO", km: 2 }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("LiveCohortBody · an absent cell is counted and named", () => {
  // Since D98 an absent cell means ZERO — nothing is withheld at any size.
  // The panel must still account for the gap in words, because a silent gap
  // reads as "this question doesn't exist here".
  const missingLine = (n: number, where: string) =>
    new RegExp(`${n} more question${n === 1 ? " has" : "s have"} no\\s+answers from ${where} yet`, "i");

  it("counts and names a question whose city cell is missing", () => {
    LIVE.aggFor = (qid) => qid === "q1"
      ? { by: { city: { "Oslo, NO": { "0": 7, "1": 5 } } } }
      : { by: { city: { "Bergen, NO": { "0": 9, "1": 6 } } } };

    render(<LiveCohortBody scope="city" />);

    expect(screen.getByText("First question")).toBeTruthy();
    // The absent one must NOT be drawn as a row…
    expect(screen.queryByText("Second question")).toBeNull();
    // …and must be accounted for in words, with the count and the reason.
    expect(screen.getByText(missingLine(1, "Oslo"))).toBeTruthy();
  });

  it("pluralises the accounting line rather than saying '2 question is'", () => {
    LIVE.deck = () => [Q("q1", "Shown"), Q("q2", "Hidden A"), Q("q3", "Hidden B")];
    LIVE.aggFor = (qid) => qid === "q1"
      ? { by: { city: { "Oslo, NO": { "0": 7 } } } }
      : { by: { city: { "Bergen, NO": { "0": 9 } } } };

    render(<LiveCohortBody scope="city" />);
    expect(screen.getByText(missingLine(2, "Oslo"))).toBeTruthy();
  });

  it("says the cohort is filling up when EVERY cell is absent", () => {
    // The all-absent case takes the empty-state branch, not the counter
    // branch — so it needs its own assertion or a regression there shows a
    // blank panel and nothing else.
    LIVE.aggFor = () => ({ by: { city: { "Bergen, NO": { "0": 9 } } } });
    render(<LiveCohortBody scope="city" />);
    expect(screen.getByText(/Oslo is still filling up/i)).toBeTruthy();
    expect(screen.getByText(/the first one starts the count/i)).toBeTruthy();
    expect(screen.queryByText(/First question/)).toBeNull();
  });

  it("does not count a question with no aggregate at all as withheld", () => {
    // No agg means the question has no published document yet — a different
    // state from "your cohort is too small", and claiming the latter would
    // tell the user something about Oslo that nobody knows.
    LIVE.aggFor = (qid) => qid === "q1" ? { by: { city: { "Oslo, NO": { "0": 7 } } } } : null;
    render(<LiveCohortBody scope="city" />);
    expect(screen.getByText("First question")).toBeTruthy();
    expect(screen.queryByText(/withheld/i)).toBeNull();
  });
});

describe("LiveCohortBody · world scope shows what the aggregate holds", () => {
  it("withholds a question flagged tooSmall even when it carries counts", () => {
    // The exact shape the comment in the panel warns about: an aggregate
    // that still has counts on it from an earlier publish while the server
    // now says it is below the floor. Rendering the counts would publish a
    // a question with no answers at all.
    LIVE.aggFor = (qid) => qid === "q1"
      ? { counts: { "0": 30, "1": 20 }, total: 50 }
      : { counts: {}, total: 0 };

    render(<LiveCohortBody scope="world" />);

    expect(screen.getByText("First question")).toBeTruthy();
    expect(screen.queryByText("Second question")).toBeNull();
    // World scope explains itself differently: the reason is simply that
    // the question has no answers yet.
    expect(screen.getByText(/1 more question has no\s+answers yet/i)).toBeTruthy();
  });

  it("shows an aggregate that carries counts, with no flag to ask permission of", () => {
    // The inverse of the case that stood here. It used to assert that an
    // agg WITHOUT an explicit `tooSmall: false` stayed hidden — fail-closed,
    // because a document nothing had declared safe was not safe. D98 removed
    // the flag, so the same document is now simply shown. Kept as the
    // regression guard for the rename: if anything starts consulting a
    // `tooSmall` field again, this row disappears.
    LIVE.aggFor = () => ({ counts: { "0": 30, "1": 20 }, total: 50 });
    render(<LiveCohortBody scope="world" />);
    expect(screen.getByText("First question")).toBeTruthy();
  });
});

describe("LiveCohortBody · no city is a prompt, not an empty panel", () => {
  it("asks for a city and promises the coordinate is not stored", () => {
    // D9's amendment: the most precise location this system can hold is a
    // city name. The panel says so at the moment it asks, which is the only
    // moment the claim is checkable by the person reading it.
    LIVE.myCity = "";
    render(<LiveCohortBody scope="city" />);
    expect(screen.getByText(/Near needs a city/i)).toBeTruthy();
    expect(screen.getByText(/only the city name is saved, never your coordinates/i)).toBeTruthy();
  });

  it("names the Country stop in its ask — not “This”", () => {
    // Both no-city scopes share this panel, and the heading names the stop
    // so the ask reads as part of the ruler above it. The country arm
    // shipped saying "This needs a city", which read as the placeholder it
    // was — a device screenshot is what caught it.
    LIVE.myCity = "";
    render(<LiveCohortBody scope="country" />);
    expect(screen.getByText(/Country needs a city/i)).toBeTruthy();
  });

  it("offers the picker in place rather than pointing at the profile", () => {
    // The release shipped this state as prose with nothing tappable — the
    // user had to find the profile's Basics card on their own. The empty
    // state now embeds the profile's own CityPicker, collapsed.
    LIVE.myCity = "";
    render(<LiveCohortBody scope="city" />);
    expect(screen.getByRole("button", { name: /Choose your city/i })).toBeTruthy();
  });

  it("persists a picked city through setCityAnchor", async () => {
    // The wiring, not the write: an onChange that saved to the wrong place
    // (or nowhere) would leave this stop empty again on the next mount,
    // after telling the user it was set. The catalogue load is stubbed the
    // way CityPicker's own suite does it; everything downstream is real.
    const CATALOGUE = [{ name: "Bergen", country: "NO", popK: 213, lat: 60.39, lon: 5.32 }];
    vi.spyOn(PLACES, "load").mockResolvedValue(CATALOGUE);
    vi.spyOn(PLACES, "peek").mockReturnValue(CATALOGUE);
    LIVE.myCity = "";
    render(<LiveCohortBody scope="city" />);
    fireEvent.click(screen.getByRole("button", { name: /Choose your city/i }));
    fireEvent.change(screen.getByRole("combobox", { name: /Search cities/i }), { target: { value: "Berg" } });
    fireEvent.click(await screen.findByRole("option", { name: /Bergen/i }));
    expect(setCityAnchor).toHaveBeenCalledWith("Bergen, NO");
  });

  it("still renders the globe without a city", () => {
    // World scope does not slice by the viewer's bucket, so it must not
    // inherit the city gate — a user who skipped the picker still gets a
    // working World stop.
    LIVE.myCity = "";
    LIVE.aggFor = () => ({ counts: { "0": 30, "1": 20 }, total: 50, tooSmall: false });
    render(<LiveCohortBody scope="world" />);
    expect(screen.getByText("The world")).toBeTruthy();
    expect(screen.getByText("First question")).toBeTruthy();
  });
});

describe("LiveCohortBody · with the counter on, the city derives itself (D92)", () => {
  it("resolves and APPLIES the city from the standing grant, saying so", async () => {
    // The Right-now counter being on IS the location grant — asking the
    // same person to also pick "Oslo" from a list was the dead end the
    // owner reported. The resolved key is applied through the same
    // setCityAnchor a manual pick uses, so profile and anchors stay in
    // sync, and the interim copy repeats the D9 claim at the moment it is
    // checkable: only the name is saved.
    LIVE.myCity = "";
    LIVE.near.on = () => true;
    render(<LiveCohortBody scope="city" />);
    expect(screen.getByText(/Finding your city/i)).toBeTruthy();
    expect(screen.getByText(/only its name will be saved, never your\s+coordinates/i)).toBeTruthy();
    await vi.waitFor(() => expect(setCityAnchor).toHaveBeenCalledWith("Oslo, NO"));
    expect(locateCity).toHaveBeenCalledTimes(1);
  });

  it("never locates while the counter is OFF — D9's ask is unchanged", () => {
    // The apply-not-suggest carve-out is scoped to the standing grant.
    // Without it, the panel must not touch the sensor: the ask renders,
    // the picker stays, and the copy points at the counter as the
    // hands-free path.
    LIVE.myCity = "";
    render(<LiveCohortBody scope="city" />);
    expect(locateCity).not.toHaveBeenCalled();
    expect(screen.getByText(/Near needs a city/i)).toBeTruthy();
    expect(screen.getByText(/Turning on the count above fills it in/i)).toBeTruthy();
  });

  it("never locates when a city is already set", () => {
    LIVE.near.on = () => true;
    render(<LiveCohortBody scope="city" />);
    expect(locateCity).not.toHaveBeenCalled();
  });

  it("falls back to the ask on a failed fix, applying nothing", async () => {
    // A refusal or a timeout must not loop the sensor (one attempt per
    // on-transition) and must not invent a city. The manual picker — with
    // its own per-reason retry copy — is the fallback already on screen.
    LIVE.myCity = "";
    LIVE.near.on = () => true;
    locateCity.mockImplementation(async () => ({ ok: false, reason: "timeout" }));
    render(<LiveCohortBody scope="city" />);
    await vi.waitFor(() => expect(screen.queryByText(/Finding your city/i)).toBeNull());
    expect(setCityAnchor).not.toHaveBeenCalled();
    expect(screen.getByText(/Near needs a city/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Choose your city/i })).toBeTruthy();
    expect(locateCity).toHaveBeenCalledTimes(1);
  });

  it("derives on the Country stop too — same grant, same rule", async () => {
    // "This needs a city" is the same gate at a different radius; a grant
    // that serves Near serves it identically.
    LIVE.myCity = "";
    LIVE.near.on = () => true;
    render(<LiveCohortBody scope="country" />);
    await vi.waitFor(() => expect(setCityAnchor).toHaveBeenCalledWith("Oslo, NO"));
  });
});

describe("LiveCohortBody · it shows counts, never people (D5)", () => {
  it("renders no member of the demo cast even with sample data loaded", () => {
    // The panel this replaced showed six named neighbours from
    // sample-data.js ("Sigrid Bø, a few streets away, 88% match"), none of
    // whom existed. The replacement reads only aggregates — asserting that
    // by name is cheap and says exactly what D9 promised.
    LIVE.aggFor = () => ({ by: { city: { "Oslo, NO": { "0": 7, "1": 5 } } } });
    const { container } = render(<LiveCohortBody scope="city" />);
    const text = container.textContent || "";
    for (const name of ["Sigrid", "Bø", "match", "away"]) {
      expect(text.includes(name), `the cohort panel rendered "${name}"`).toBe(false);
    }
    // …and it does show the thing it is for.
    expect(text).toMatch(/12 answers/);
  });
});

describe("the panel prints no floor claim at all (D98)", () => {
  // The inverse of the case that used to stand here. That one made sure
  // the printed floor equalled the enforced floor; there is no floor to
  // print now, so this makes sure none came back. A floor literal
  // reappearing in this panel would be a promise nothing implements —
  // the same failure in the opposite direction.
  it("carries no floor literal and no withholding language", () => {
    const root = resolve(__dirname, "../../..");
    const src = readFileSync(resolve(root, "src/v2/ui/LiveCohortBody.tsx"), "utf8");
    expect(src.match(/const LN_FLOOR = \d+/), "a local floor literal is back").toBeNull();
    expect(src).not.toMatch(/AGG_FLOOR/);
  });

  it("does not tell the user anything is being held back", () => {
    LIVE.aggFor = () => ({ by: { city: { "Oslo, NO": { "0": 7, "1": 5 } } } });
    render(<LiveCohortBody scope="city" />);
    const text = document.body.textContent || "";
    expect(text).not.toMatch(/smaller than \d/);
    expect(text).not.toMatch(/withheld/i);
    // NB: not asserting the absence of "never who" here — the Right-now
    // presence card legitimately says it, and that claim is still true
    // (D98 published answers, not the location grid; firestore.rules
    // keeps v2_presence unreadable). Scoped to the cohort copy instead.
    expect(text).not.toMatch(/Counts only/i);
  });
});

describe("the Right now card (D84 — Near by radius)", () => {
  it("renders on the Near stop even with NO city — radius needs none", () => {
    // The whole point of the feature: Near stops being a dead end for a
    // user who never picked a city. The card sits above the city ask.
    LIVE.myCity = "";
    render(<LiveCohortBody scope="city" />);
    expect(screen.getByText(/Right now, around you/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Turn on/i })).toBeTruthy();
    // …and the city ask is still there beneath it.
    expect(screen.getByText(/Near needs a city/i)).toBeTruthy();
  });

  it("stays off the Country and World stops", () => {
    LIVE.aggFor = () => ({ counts: { "0": 3 }, total: 3, tooSmall: false });
    render(<LiveCohortBody scope="world" />);
    expect(screen.queryByText(/Right now, around you/i)).toBeNull();
  });

  it("pitches honestly while off: a count, never who, kilometre-sized", () => {
    render(<LiveCohortBody scope="city" />);
    const text = document.body.textContent || "";
    expect(text).toMatch(/a count, never\s+who/i);
    expect(text).toMatch(/kilometre-sized grid square/i);
    // No 500 m claim anywhere: the coarse permission cannot measure it,
    // and the copy must not promise a radius the sensor cannot hold.
    expect(text).not.toMatch(/500\s?m/i);
  });

  it("says just-you at zero, counts people above it, and 'a few' when floored", () => {
    LIVE.near.on = () => true;
    LIVE.near.count = () => 0;
    render(<LiveCohortBody scope="city" />);
    expect(screen.getByText(/Just you right now/i)).toBeTruthy();
    cleanup();

    LIVE.near.count = () => 3;
    render(<LiveCohortBody scope="city" />);
    expect(screen.getByText(/3 people with InSight within a couple of kilometres/i)).toBeTruthy();
    cleanup();

    // The restored-floor era (D81 revert): the server answers tooFew for
    // 1-4 and the card says so without a number.
    LIVE.near.count = () => null;
    LIVE.near.tooFew = () => true;
    render(<LiveCohortBody scope="city" />);
    expect(screen.getByText(/A few people are around you/i)).toBeTruthy();
  });

  it("turn-on runs enable and a refusal lands as a sentence, not a dead card", async () => {
    LIVE.near.enable = vi.fn(async () => ({ ok: false, reason: "denied" }));
    render(<LiveCohortBody scope="city" />);
    fireEvent.click(screen.getByRole("button", { name: /Turn on/i }));
    expect(LIVE.near.enable).toHaveBeenCalled();
    expect(await screen.findByText(/Near stays off until you allow location/i)).toBeTruthy();
  });

  it("turn-off calls disable — the doc-delete promise rides on it", async () => {
    LIVE.near.on = () => true;
    LIVE.near.count = () => 2;
    LIVE.near.disable = vi.fn(async () => {});
    render(<LiveCohortBody scope="city" />);
    fireEvent.click(screen.getByRole("button", { name: /Turn off/i }));
    expect(LIVE.near.disable).toHaveBeenCalled();
  });
});

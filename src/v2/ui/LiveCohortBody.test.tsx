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

const { default: LiveCohortBody } = await import("./LiveCohortBody");
const { default: PLACES } = await import("../data/places");
// Real, not mocked: the copy assertions below branch on the same constant
// the component reads, so both eras of the floor stay expressed.
const { AGG_FLOOR } = await import("../data/floor");

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
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("LiveCohortBody · an absent cell is counted and named", () => {
  // Under the design floor (5) an absent cell means WITHHELD; under D81's
  // paused floor (1) it means ZERO, because any cell with one answer
  // publishes. Either way the panel must account for the gap in words —
  // a silent gap reads as "this question doesn't exist here". The strings
  // branch on AGG_FLOOR, so these cases assert the era they run in and the
  // restored-floor wording stays pinned by the same expressions.
  const missingLine = (n: number, where: string) =>
    AGG_FLOOR > 1
      ? new RegExp(`${n} more question${n === 1 ? " is" : "s are"} withheld`, "i")
      : new RegExp(`${n} more question${n === 1 ? " has" : "s have"} no\\s+answers from ${where} yet`, "i");

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
    expect(screen.getByText(AGG_FLOOR > 1 ? /withheld rather than shown thin/i : /the first one starts the count/i)).toBeTruthy();
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

describe("LiveCohortBody · the server's floor flag wins at world scope", () => {
  it("withholds a question flagged tooSmall even when it carries counts", () => {
    // The exact shape the comment in the panel warns about: an aggregate
    // that still has counts on it from an earlier publish while the server
    // now says it is below the floor. Rendering the counts would publish a
    // split the k-floor withheld.
    LIVE.aggFor = (qid) => qid === "q1"
      ? { counts: { "0": 30, "1": 20 }, total: 50, tooSmall: false }
      : { counts: { "0": 2, "1": 1 }, total: 3, tooSmall: true };

    render(<LiveCohortBody scope="world" />);

    expect(screen.getByText("First question")).toBeTruthy();
    expect(screen.queryByText("Second question")).toBeNull();
    // World scope explains itself differently — "fewer than 5 people in the
    // world" would be a different and sillier claim; at the paused floor the
    // reason is simply that the question has no published answers yet.
    expect(screen.getByText(
      AGG_FLOOR > 1
        ? /1 more question is withheld/i
        : /1 more question has no\s+answers yet/i,
    )).toBeTruthy();
  });

  it("treats a MISSING tooSmall flag as withheld, not as permission", () => {
    // `agg.tooSmall !== false` rather than `agg.tooSmall === true`: a
    // document without the field has not been declared safe by anything.
    // Flipping that comparison is a one-character change that publishes
    // every unflagged aggregate.
    LIVE.aggFor = () => ({ counts: { "0": 30, "1": 20 }, total: 50 });
    render(<LiveCohortBody scope="world" />);
    expect(screen.queryByText("First question")).toBeNull();
    expect(screen.getByText(/Today is still filling up/i)).toBeTruthy();
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

describe("the printed floor is the floor the server enforces", () => {
  // The floor shown to the user comes from data/floor.ts, whose own suite
  // (floor.test.ts) regex-pins it to AGG_MIN_N in functions/src/v2.ts — the
  // number equality lives there now. What THIS case holds is the last hop:
  // the panel imports that constant rather than restating it, so a literal
  // reappearing here would re-open the drift the old LN_FLOOR had.
  it("the panel carries no floor literal of its own", () => {
    const root = resolve(__dirname, "../../..");
    const src = readFileSync(resolve(root, "src/v2/ui/LiveCohortBody.tsx"), "utf8");
    expect(src).toMatch(/import \{ AGG_FLOOR \} from "\.\.\/data\/floor"/);
    expect(src.match(/const LN_FLOOR = \d+/), "a local floor literal is back — it will drift").toBeNull();
  });

  it("prints no floor claim the server does not enforce", () => {
    // Under the D81 pause (floor 1) the header must drop the "never a group
    // smaller than N" clause entirely — both N=5 (false) and N=1 (vacuous)
    // are wrong things to print. When the floor is restored the same render
    // must claim exactly the enforced number.
    LIVE.aggFor = () => ({ by: { city: { "Oslo, NO": { "0": 7, "1": 5 } } } });
    render(<LiveCohortBody scope="city" />);
    const text = document.body.textContent || "";
    if (AGG_FLOOR > 1) {
      expect(text).toContain(`never a group smaller than ${AGG_FLOOR}`);
    } else {
      expect(text).not.toMatch(/smaller than \d/);
      expect(text).toContain("Counts only — never who.");
    }
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

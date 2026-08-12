// @vitest-environment jsdom
//
// LiveCohortBody renders the Mirror's City / Country / World stops from
// the public aggregates — exact, unfloored, published from the first
// answer since D98 (Near split off to NearLiveBody at D111). It is the
// panel with the most ways to lie quietly, because everything it draws
// is a claim about a cohort:
//
//   - an ABSENT breakdown cell means ZERO — nobody in this cohort has
//     answered — and dropping it silently is still the failure the counter
//     under the list exists to prevent: a question that vanishes reads as
//     "not asked here" rather than "not answered here". A counter is
//     exactly the kind of thing that keeps compiling after it stops being
//     correct.
//   - "no aggregate document at all" is a THIRD state, distinct from both
//     an empty cell and an answered one, and claiming either of the others
//     for it would tell the user something nobody knows.
//   - nothing consults `tooSmall`. The three bullets that stood here
//     described the k-floor — an absent cell meaning "withheld", the
//     server's flag beating stale counts, and the floor number being
//     printed to the user — and D98 deleted all three along with the
//     floor. The cases below are their inverses, kept so the flag's return
//     would fail rather than quietly re-hide the app.
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
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  uid: "u_me",
  myCity: "Oslo, NO",
  deck: () => [] as Array<Record<string, unknown>>,
  // D100: the panel reads the ARCHIVE (deck + every answered question
  // with an aggregate), not the seven-day pager. `deck` stays on the
  // mock because the pin lists it and the real store still has it.
  aggregated: () => [] as Array<Record<string, unknown>>,
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
  // The constellation field (D112) mounts inside this panel too, lazily.
  // Stubbed empty — data/similarity.test.ts owns the arithmetic and the
  // field renders its honest empty state here, which is what these cases
  // should scroll past.
  loadSimilarity: async () => {},
  similarityLoading: () => false,
  testFeedItems: () => [] as Array<Record<string, unknown>>,
  myTestResults: () => ({} as Record<string, unknown>),
  kindredPeople: () => [] as Array<Record<string, unknown>>,
  isFollowing: () => false,
  setFollowing: async () => {},
  // LIVE.near survives on the mock because the D92 city-derive effect
  // still reads the grant state here; the CARD moved to NearLiveBody
  // (D111), which has its own suite.
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
  LIVE.aggregated = () => [Q("q1", "First question"), Q("q2", "Second question")];
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
    LIVE.aggregated = () => [Q("q1", "Shown"), Q("q2", "Hidden A"), Q("q3", "Hidden B")];
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
  it("leaves out a question whose aggregate has no answers on it", () => {
    // Retitled at the D98 doc sweep: this used to read "withholds a
    // question flagged tooSmall even when it carries counts", which is not
    // what the body does — there is no flag anywhere in it. The state under
    // test is `total: 0`, i.e. nobody has answered, and the panel accounts
    // for it in words rather than drawing an empty row.
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
    expect(screen.getByText(/City needs your city/i)).toBeTruthy();
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
    // the picker stays, and the copy points at the counter — which lives
    // at the Near stop since D111 — as the hands-free path.
    LIVE.myCity = "";
    render(<LiveCohortBody scope="city" />);
    expect(locateCity).not.toHaveBeenCalled();
    expect(screen.getByText(/City needs your city/i)).toBeTruthy();
    expect(screen.getByText(/Turning on the count at the Near stop fills it in/i)).toBeTruthy();
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
    expect(screen.getByText(/City needs your city/i)).toBeTruthy();
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

describe("the presence card stays out of the cohort panel (D111)", () => {
  it("renders no Right-now card at any scope — Near owns it now", () => {
    // The card lived here from D84 to D111 and its suite moved to
    // NearLiveBody.test.tsx with it. What this panel must keep is the
    // absence: a second copy of the counter behind a different stop is
    // the two-doors-to-one-room bug in presence form.
    LIVE.aggFor = () => ({ by: { city: { "Oslo, NO": { "0": 7, "1": 5 } } } });
    render(<LiveCohortBody scope="city" />);
    expect(screen.queryByText(/Right now, around you/i)).toBeNull();
    cleanup();

    LIVE.aggFor = () => ({ counts: { "0": 3 }, total: 3 });
    render(<LiveCohortBody scope="world" />);
    expect(screen.queryByText(/Right now, around you/i)).toBeNull();
  });
});

// ── the Answers lens's own depth (D100) ──────────────────────────────
//
// This panel IS the Mirror's Answers lens, and until D100 it was a flat
// list of the seven-day deck. The three things it gained are a filter, a
// sort and an expander, and each of them is a claim about a set of rows
// that is now much larger than a week — so what these cases assert is the
// ORDERING and the SUBSETTING, not that a control rendered.

describe("LiveCohortBody · the Answers lens can be narrowed and re-ordered", () => {
  // Three questions across two subjects with deliberately different
  // splits: q1 is near-unanimous, q2 is a dead heat, q3 is in between and
  // is the only one with a large room.
  const ARCHIVE = [
    { id: "q1", text: "Almost everyone agrees", branch: "Mind", type: "binary", options: [{ label: "Yes" }, { label: "No" }] },
    { id: "q2", text: "Dead heat", branch: "Morals", type: "binary", options: [{ label: "Yes" }, { label: "No" }] },
    { id: "q3", text: "Somewhere between", branch: "Mind", type: "binary", options: [{ label: "Yes" }, { label: "No" }] },
  ];
  const CELLS: Record<string, Record<string, number>> = {
    q1: { "0": 19, "1": 1 },   // 95/5  → barely divisive, n=20
    q2: { "0": 5, "1": 5 },    // 50/50 → maximally divisive, n=10
    q3: { "0": 60, "1": 40 },  // 60/40 → middling, n=100
  };

  beforeEach(() => {
    LIVE.aggregated = () => ARCHIVE;
    LIVE.aggFor = (qid: string) => ({ by: { city: { "Oslo, NO": CELLS[qid] } } });
    LIVE.myVotes = () => ({ q1: "1" });
  });

  const rowOrder = () => screen.getAllByRole("button", { expanded: false })
    .map((b) => b.textContent || "")
    .filter((t) => /agrees|heat|between/.test(t));

  it("defaults to most answers first", () => {
    render(<LiveCohortBody scope="city" />);
    expect(rowOrder().map((t) => t.replace(/[+–]$/, ""))).toEqual([
      "Somewhere between", "Almost everyone agrees", "Dead heat",
    ]);
  });

  it("sorts by divisiveness, and by agreement as its exact inverse", () => {
    render(<LiveCohortBody scope="city" />);
    fireEvent.click(screen.getByRole("button", { name: "Most divisive" }));
    const divisive = rowOrder().map((t) => t.replace(/[+–]$/, ""));
    expect(divisive[0]).toBe("Dead heat");
    expect(divisive[2]).toBe("Almost everyone agrees");

    fireEvent.click(screen.getByRole("button", { name: "Most agreed" }));
    const agreed = rowOrder().map((t) => t.replace(/[+–]$/, ""));
    expect(agreed).toEqual(divisive.slice().reverse());
  });

  it("filters to one subject and drops the rest", () => {
    render(<LiveCohortBody scope="city" />);
    // Chips carry their own counts, so picking one is never a guess.
    fireEvent.click(screen.getByRole("button", { name: "Mind 2" }));
    expect(screen.queryByRole("button", { name: /Dead heat/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Almost everyone agrees/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "All 3" }));
    expect(screen.getByRole("button", { name: /Dead heat/ })).toBeTruthy();
  });

  it("expands a row into per-option counts with your own answer named", () => {
    render(<LiveCohortBody scope="city" />);
    fireEvent.click(screen.getByRole("button", { name: /Almost everyone agrees/ }));
    // The point of expanding: 5% is too thin to label on the bar, so the
    // count only exists in this view.
    expect(screen.getByText("19")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    // Named, not merely tinted — a colour difference is not a reading.
    expect(screen.getByText(/your answer/i)).toBeTruthy();
  });

  it("says you have not answered rather than marking an option", () => {
    render(<LiveCohortBody scope="city" />);
    fireEvent.click(screen.getByRole("button", { name: /Dead heat/ }));
    expect(screen.getByText(/you have not answered this one/i)).toBeTruthy();
    expect(screen.queryByText(/your answer/i)).toBeNull();
  });

  it("hides the controls when there is nothing to narrow", () => {
    // One row: a chip row saying "All 1" is furniture.
    LIVE.aggregated = () => [ARCHIVE[0]];
    render(<LiveCohortBody scope="city" />);
    expect(screen.queryByRole("button", { name: /^All / })).toBeNull();
    expect(screen.queryByRole("button", { name: "Most divisive" })).toBeNull();
  });

  it("offers no subject chips when the bank predates D100", () => {
    // Every question seeded before D100 has no `branch`, and will until
    // the next seed run. The sort must still work; the filter must not
    // render a single "All" chip that narrows nothing.
    LIVE.aggregated = () => ARCHIVE.map((q) => ({ ...q, branch: undefined }));
    render(<LiveCohortBody scope="city" />);
    expect(screen.queryByRole("button", { name: /^All / })).toBeNull();
    expect(screen.getByRole("button", { name: "Most divisive" })).toBeTruthy();
  });
});

// ── the stop's tab row (D119) ─────────────────────────────────────────
//
// The layout the prototype has always specified and live mode never got:
// Answers is a TAB beside the constellation and the four lenses, not the
// page they hang under. What these cases hold is the pair of properties
// the change is easy to get wrong on — that Answers is what a stop opens
// on, and that the cost gate the old collapsed strip was carrying
// survives the move.
describe("LiveCohortBody · the lens row is the stop's tabs", () => {
  const ARCHIVE = [
    { id: "q1", text: "Almost everyone agrees", branch: "Mind", type: "binary", options: [{ label: "Yes" }, { label: "No" }] },
  ];

  // The cost case swaps two loaders on the shared mock; put them back so
  // the leak stops at this describe rather than at the end of the file.
  const realKindred = LIVE.loadKindred;
  const realSimilarity = LIVE.loadSimilarity;

  beforeEach(() => {
    LIVE.aggregated = () => ARCHIVE;
    LIVE.aggFor = () => ({ by: { city: { "Oslo, NO": { "0": 19, "1": 1 } } } });
    LIVE.myVotes = () => ({});
  });
  afterEach(() => { LIVE.loadKindred = realKindred; LIVE.loadSimilarity = realSimilarity; });

  const tabs = () => screen.getByRole("tablist", { name: /lenses/i });
  const tab = (name: string) =>
    [...tabs().querySelectorAll('[role="tab"]')].find((b) => b.textContent?.trim() === name) as HTMLElement;

  it("offers six tabs and opens on Answers", () => {
    render(<LiveCohortBody scope="city" />);
    for (const name of ["Answers", "Overview", "People", "Compare", "Explore", "Scores"]) {
      expect(tab(name), `the row is missing its ${name} tab`).toBeTruthy();
    }
    expect(tab("Answers").getAttribute("aria-selected")).toBe("true");
    // …and Answers is a body, not a label: the rows are on screen.
    expect(screen.getByText("Almost everyone agrees")).toBeTruthy();
  });

  it("swaps the body when a tab is picked, and puts it back", () => {
    render(<LiveCohortBody scope="city" />);
    fireEvent.click(tab("Compare"));
    expect(tab("Compare").getAttribute("aria-selected")).toBe("true");
    expect(
      screen.queryByText("Almost everyone agrees"),
      "the answer rows stayed on screen under another tab — the tabs are stacking, not swapping",
    ).toBeNull();
    fireEvent.click(tab("Answers"));
    expect(screen.getByText("Almost everyone agrees")).toBeTruthy();
  });

  it("costs nothing for a tab nobody opened, and pays as soon as one is", async () => {
    // The property the old collapsed strip existed for, restated for
    // tabs: People pays for voter lists the viewer has not asked for and
    // Overview pays for the similarity fold, so neither may run because
    // the stop was opened.
    //
    // Both bodies are React.lazy, so the flush matters: assert on a
    // synchronous render and the case passes for the wrong reason — the
    // chunk simply has not resolved yet, which would be just as true if
    // the body were mounted unconditionally. Each half therefore awaits a
    // real settle, and the second half is what proves the first is
    // measuring a gate rather than a pending import.
    const kindred = vi.fn(async () => {});
    const similarity = vi.fn(async () => {});
    LIVE.loadKindred = kindred;
    LIVE.loadSimilarity = similarity;
    render(<LiveCohortBody scope="city" />);
    // Long enough for a lazy chunk to have resolved and its effects to
    // have run, had one been mounted.
    await act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });
    expect(kindred, "Kindred was fetched for a People tab nobody opened").not.toHaveBeenCalled();
    expect(similarity, "the similarity fold ran for an Overview nobody opened").not.toHaveBeenCalled();

    fireEvent.click(tab("People"));
    await vi.waitFor(() => {
      expect(kindred, "opening People fetched nothing — the gate above guards nothing").toHaveBeenCalled();
    });
    expect(similarity, "Overview loaded behind another tab").not.toHaveBeenCalled();
  });
});

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
  // The types-here card (D141/v25) below Kindred reads the viewer's
  // anchors for its basis label. Stubbed empty — the card draws its
  // honest empty state and these cases scroll past it.
  anchors: () => ({} as Record<string, string>),
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
const Q = (id: string, text: string, over: Record<string, unknown> = {}) => ({
  // `coreCorpus: true` is what a real question carries post-D161 — buildS
  // resolves it from the bank's `core` flag. Without it every case here
  // would silently be testing the empty state, since this panel folds the
  // core corpus only.
  id, text, coreCorpus: true, options: [{ label: "Yes" }, { label: "No" }], ...over,
});

// ── the core corpus (D161) ──
//
// This panel says "here is how Oslo answered", and that is only true of a
// question everyone in Oslo could have been asked. Once the tail is
// ordered by the interest model (D163) a tail question's split describes
// the people it was shown to — arithmetic still right, sentence no longer
// true. Without this test the constraint is prose, which is exactly what
// ATTENTION.md's feed-only rule was, and it rotted.
describe("LiveCohortBody · cohort readings fold the core corpus only (D161)", () => {
  it("draws a core question and leaves a tail question out", async () => {
    LIVE.aggregated = () => [
      Q("q1", "Core question"),
      Q("q2", "Tail question", { coreCorpus: false }),
    ];
    // Both questions have a full Oslo cell, so nothing but the core filter
    // can be what keeps one of them off the screen.
    LIVE.aggFor = (() => ({
      total: 10,
      counts: { "0": 6, "1": 4 },
      by: { city: { "Oslo, NO": { "0": 6, "1": 4 } } },
    })) as never;
    // Through the shared helper: since the field became the landing tab,
    // a bare render() shows no answer rows at all and this would assert on
    // an empty panel — passing for the wrong reason.
    mountAnswers("city");
    const body = document.body.textContent || "";
    expect(body).toMatch(/Core question/);
    expect(body).not.toMatch(/Tail question/);
  });
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


/**
 * Mount a stop and open its Answers tab.
 *
 * D135 moved the landing tab to Overview, so the answer ROWS are a tab
 * body now rather than the page. Every case below that asserts on a row
 * has to open Answers first, and one helper is what keeps the next
 * tab-order change a single edit instead of thirty.
 *
 * The click is conditional because two cases here mount a stop with no
 * city, which returns the picker and has no tab row at all — the tab
 * row's own existence is asserted in its own describe, not smuggled in
 * here.
 */
function mountAnswers(scope: "city" | "country" | "world" = "city") {
  const r = render(<LiveCohortBody scope={scope} />);
  const t = screen.queryByRole("tab", { name: "Answers" });
  if (t) fireEvent.click(t);
  return r;
}

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

    mountAnswers("city");

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

    mountAnswers("city");
    expect(screen.getByText(missingLine(2, "Oslo"))).toBeTruthy();
  });

  it("says the cohort is filling up when EVERY cell is absent", () => {
    // The all-absent case takes the empty-state branch, not the counter
    // branch — so it needs its own assertion or a regression there shows a
    // blank panel and nothing else.
    LIVE.aggFor = () => ({ by: { city: { "Bergen, NO": { "0": 9 } } } });
    mountAnswers("city");
    expect(screen.getByText(/Oslo is still filling up/i)).toBeTruthy();
    expect(screen.getByText(/the first one starts the count/i)).toBeTruthy();
    expect(screen.queryByText(/First question/)).toBeNull();
  });

  it("does not count a question with no aggregate at all as withheld", () => {
    // No agg means the question has no published document yet — a different
    // state from "your cohort is too small", and claiming the latter would
    // tell the user something about Oslo that nobody knows.
    LIVE.aggFor = (qid) => qid === "q1" ? { by: { city: { "Oslo, NO": { "0": 7 } } } } : null;
    mountAnswers("city");
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

    mountAnswers("world");

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
    mountAnswers("world");
    expect(screen.getByText("First question")).toBeTruthy();
  });
});

describe("LiveCohortBody · no city is a prompt, not an empty panel", () => {
  it("asks for a city and promises the coordinate is not stored", () => {
    // D9's amendment: the most precise location this system can hold is a
    // city name. The panel says so at the moment it asks, which is the only
    // moment the claim is checkable by the person reading it.
    LIVE.myCity = "";
    mountAnswers("city");
    expect(screen.getByText(/City needs your city/i)).toBeTruthy();
    expect(screen.getByText(/only the city name is saved, never your coordinates/i)).toBeTruthy();
  });

  it("names the Country stop in its ask — not “This”", () => {
    // Both no-city scopes share this panel, and the heading names the stop
    // so the ask reads as part of the ruler above it. The country arm
    // shipped saying "This needs a city", which read as the placeholder it
    // was — a device screenshot is what caught it.
    LIVE.myCity = "";
    mountAnswers("country");
    expect(screen.getByText(/Country needs a city/i)).toBeTruthy();
  });

  it("offers the picker in place rather than pointing at the profile", () => {
    // The release shipped this state as prose with nothing tappable — the
    // user had to find the profile's Basics card on their own. The empty
    // state now embeds the profile's own CityPicker, collapsed.
    LIVE.myCity = "";
    mountAnswers("city");
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
    mountAnswers("city");
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
    mountAnswers("world");
    // The kicker, since D172 removed the 25px place name under it — the
    // globe's own word for itself, and the thing that proves the body
    // rendered rather than the city gate.
    expect(screen.getByText("Everyone")).toBeTruthy();
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
    mountAnswers("city");
    expect(screen.getByText(/Finding your city/i)).toBeTruthy();
    expect(screen.getByText(/only its name is saved, never your\s+coordinates/i)).toBeTruthy();
    await vi.waitFor(() => expect(setCityAnchor).toHaveBeenCalledWith("Oslo, NO"));
    expect(locateCity).toHaveBeenCalledTimes(1);
  });

  it("never locates while the counter is OFF — D9's ask is unchanged", () => {
    // The apply-not-suggest carve-out is scoped to the standing grant.
    // Without it, the panel must not touch the sensor: the ask renders,
    // the picker stays, and the copy points at the counter — which lives
    // at the Near stop since D111 — as the hands-free path.
    LIVE.myCity = "";
    mountAnswers("city");
    expect(locateCity).not.toHaveBeenCalled();
    expect(screen.getByText(/City needs your city/i)).toBeTruthy();
    expect(screen.getByText(/The Near count fills it in/i)).toBeTruthy();
  });

  it("never locates when a city is already set", () => {
    LIVE.near.on = () => true;
    mountAnswers("city");
    expect(locateCity).not.toHaveBeenCalled();
  });

  it("falls back to the ask on a failed fix, applying nothing", async () => {
    // A refusal or a timeout must not loop the sensor (one attempt per
    // on-transition) and must not invent a city. The manual picker — with
    // its own per-reason retry copy — is the fallback already on screen.
    LIVE.myCity = "";
    LIVE.near.on = () => true;
    locateCity.mockImplementation(async () => ({ ok: false, reason: "timeout" }));
    mountAnswers("city");
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
    mountAnswers("country");
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
    const { container } = mountAnswers("city");
    const text = container.textContent || "";
    for (const name of ["Sigrid", "Bø", "match", "away"]) {
      expect(text.includes(name), `the cohort panel rendered "${name}"`).toBe(false);
    }
    // …and it does show the thing it is for: the headline reading (7 of 12
    // is 58% Yes) and the count behind it.
    expect(text).toMatch(/58%/);
    // getAllBy: this fixture gives both questions the same cell, so both
    // rows carry the same count.
    expect(screen.getAllByText("12").length, "the row does not say how many answered").toBeGreaterThan(0);
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
    mountAnswers("city");
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
    mountAnswers("city");
    expect(screen.queryByText(/Right now, around you/i)).toBeNull();
    cleanup();

    LIVE.aggFor = () => ({ counts: { "0": 3 }, total: 3 });
    mountAnswers("world");
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
    { id: "q1", text: "Almost everyone agrees", branch: "Mind", type: "binary", coreCorpus: true, options: [{ label: "Yes" }, { label: "No" }] },
    { id: "q2", text: "Dead heat", branch: "Morals", type: "binary", coreCorpus: true, options: [{ label: "Yes" }, { label: "No" }] },
    { id: "q3", text: "Somewhere between", branch: "Mind", type: "binary", coreCorpus: true, options: [{ label: "Yes" }, { label: "No" }] },
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

  // Every row is a button carrying aria-expanded, open or closed — since
  // D120 the FIRST one opens by default (the prototype's behaviour: a tab
  // that opens onto a closed list reads as a table of contents), so
  // selecting on `expanded: false` would silently drop the top row and
  // make every ordering assertion below start at the second.
  const rowOrder = () => [...document.querySelectorAll("button[aria-expanded]")]
    .map((b) => (b.textContent || "").match(/Almost everyone agrees|Dead heat|Somewhere between/)?.[0])
    .filter((t): t is string => !!t);

  it("defaults to most answers first", () => {
    mountAnswers("city");
    expect(rowOrder()).toEqual([
      "Somewhere between", "Almost everyone agrees", "Dead heat",
    ]);
  });

  it("sorts by divisiveness, and by agreement as its exact inverse", () => {
    mountAnswers("city");
    fireEvent.click(screen.getByRole("button", { name: "Most divisive" }));
    const divisive = rowOrder();
    expect(divisive[0]).toBe("Dead heat");
    expect(divisive[2]).toBe("Almost everyone agrees");

    fireEvent.click(screen.getByRole("button", { name: "Most agreed" }));
    expect(rowOrder()).toEqual(divisive.slice().reverse());
  });

  it("filters to one subject and drops the rest", () => {
    mountAnswers("city");
    // Chips carry their own counts, so picking one is never a guess.
    fireEvent.click(screen.getByRole("button", { name: "Mind 2" }));
    expect(screen.queryByRole("button", { name: /Dead heat/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Almost everyone agrees/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "All 3" }));
    expect(screen.getByRole("button", { name: /Dead heat/ })).toBeTruthy();
  });

  it("expands a row into per-option counts and places you in the split", () => {
    mountAnswers("city");
    fireEvent.click(screen.getByRole("button", { name: /Almost everyone agrees/ }));
    // The point of expanding: 5% is too thin to label on the collapsed
    // stack, so the count only exists in this view.
    expect(screen.getByText("19")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    // Named, not merely tinted — a colour difference is not a reading.
    // Said as a sentence since D120, which is a stronger version of the
    // same claim: it names your side AND how much of the room is on it.
    expect(screen.getByText(/5% of Oslo are with you/i)).toBeTruthy();
  });

  it("says you have not answered rather than marking an option", () => {
    mountAnswers("city");
    fireEvent.click(screen.getByRole("button", { name: /Dead heat/ }));
    expect(screen.getByText(/you have not answered this one/i)).toBeTruthy();
    expect(screen.queryByText(/are with you/i)).toBeNull();
  });

  it("hides the controls when there is nothing to narrow", () => {
    // One row: a chip row saying "All 1" is furniture.
    LIVE.aggregated = () => [ARCHIVE[0]];
    mountAnswers("city");
    expect(screen.queryByRole("button", { name: /^All / })).toBeNull();
    expect(screen.queryByRole("button", { name: "Most divisive" })).toBeNull();
  });

  it("offers no subject chips when the bank predates D100", () => {
    // Every question seeded before D100 has no `branch`, and will until
    // the next seed run. The sort must still work; the filter must not
    // render a single "All" chip that narrows nothing.
    LIVE.aggregated = () => ARCHIVE.map((q) => ({ ...q, branch: undefined }));
    mountAnswers("city");
    expect(screen.queryByRole("button", { name: /^All / })).toBeNull();
    expect(screen.getByRole("button", { name: "Most divisive" })).toBeTruthy();
  });
});

// ── the stop's tab row (D119) ─────────────────────────────────────────
//
// The layout the prototype has always specified and live mode never got:
// Answers is a TAB beside the constellation and the four lenses, not the
// page they hang under. What these cases hold is the pair of properties
// the change is easy to get wrong on — WHICH tab a stop opens on (Overview
// since D135, reversing D119), and how much of the cost gate the old
// collapsed strip was carrying survives that reversal.
describe("LiveCohortBody · the lens row is the stop's tabs", () => {
  const ARCHIVE = [
    { id: "q1", text: "Almost everyone agrees", branch: "Mind", type: "binary", coreCorpus: true, options: [{ label: "Yes" }, { label: "No" }] },
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

  it("offers Answers first, then the lenses this scope has", () => {
    render(<LiveCohortBody scope="city" />);
    // Order matters and is asserted as order, not as membership: which
    // section leads the row is a decision (D119, reshaped at D136, and
    // moved to the prototype's own order at D188 — the three readings of
    // the population first, then Compare, which is the only one that puts
    // you against them), and a set check would pass for a row that had
    // quietly reordered itself.
    const names = [...tabs().querySelectorAll('[role="tab"]')].map((b) => b.textContent?.trim());
    expect(names).toEqual(["Answers", "People", "Scores", "Compare"]);
    // Overview is NOT among them (D136) and Foresight is gone from the
    // Mirror altogether — both asserted here rather than left to the
    // toEqual above, so a failure names the decision it broke.
    expect(tab("Overview")).toBeUndefined();
    expect(tab("Foresight")).toBeUndefined();
  });

  it("starts with nothing open (D155)", () => {
    // The prototype's row opens closed. D135 had made Answers the landing
    // tab because a closed row under an empty field read as a blank stop —
    // solved in the LAYOUT instead: the row is pinned to the bottom, so a
    // stop with nothing open is a header, a field and a tab bar where a tab
    // bar belongs.
    render(<LiveCohortBody scope="city" />);
    for (const t of [...tabs().querySelectorAll('[role="tab"]')]) {
      expect(t.getAttribute("aria-selected"), `${t.textContent} is open at rest`).toBe("false");
    }
    expect(screen.queryByRole("tabpanel")).toBeNull();
  });

  it("pins the row to the bottom, so an empty stop still looks composed", () => {
    // `marginTop: auto` is the prototype's own line, and it is the whole
    // reason closed-by-default is safe. Asserted on the wrapper because
    // that is where the layout decision lives — a row that lost it would
    // float mid-screen on an empty stop, which is what was reported.
    render(<LiveCohortBody scope="city" />);
    const wrap = tabs().parentElement as HTMLElement;
    expect(wrap.style.marginTop).toBe("auto");
  });

  it("snaps the row to the top of the scroller when a tab opens", async () => {
    // D155 SAID THIS SHIPPED AND IT DID NOT. The ref was declared, the ref
    // was attached to the row, and no effect ever read it — so the row
    // pinned to the bottom correctly and then stayed there on tap, leaving
    // the panel you just asked for below the fold. Nothing in the tree could
    // see it: a dangling ref is valid TS, valid eslint, invisible to
    // check:globals, and the tab tests above assert the panel MOUNTS, which
    // it always did. It took a device to notice, which is what this case is
    // here to stop happening twice.
    //
    // jsdom reports every element 0×0, so the component's scroll-parent walk
    // would find nothing to scroll. The host is given the two properties the
    // walk actually reads — an overflow and a real overflowing height — and
    // that IS the contract: the row scrolls the nearest scrolling ancestor,
    // whichever element the app makes that.
    const host = document.createElement("div");
    host.style.overflowY = "auto";
    Object.defineProperty(host, "scrollHeight", { value: 4000, configurable: true });
    Object.defineProperty(host, "clientHeight", { value: 700, configurable: true });
    const calls: Array<{ top?: number; behavior?: string }> = [];
    host.scrollTo = ((o: { top?: number; behavior?: string }) => { calls.push(o); }) as typeof host.scrollTo;
    document.body.appendChild(host);
    vi.useFakeTimers();
    try {
      render(<LiveCohortBody scope="city" />, { container: host });
      fireEvent.click(tab("Answers"));
      // Nothing yet: the panel mounts in the same commit as the flip, so
      // measuring now measures the row above a body that does not exist.
      expect(calls, "scrolled before the panel had mounted").toEqual([]);
      act(() => { vi.advanceTimersByTime(80); });
      expect(calls.length, "opening a tab did not scroll the row into view").toBe(1);
      expect(calls[0].behavior).toBe("smooth");
    } finally {
      vi.useRealTimers();
      host.remove();
    }
  });

  it("does not scroll when the row is closed again", () => {
    // Closing should leave you where you are. A scroll on close would drag
    // the screen for a tap whose whole meaning is "put that away".
    const host = document.createElement("div");
    host.style.overflowY = "auto";
    Object.defineProperty(host, "scrollHeight", { value: 4000, configurable: true });
    Object.defineProperty(host, "clientHeight", { value: 700, configurable: true });
    const calls: unknown[] = [];
    host.scrollTo = (() => { calls.push(1); }) as typeof host.scrollTo;
    document.body.appendChild(host);
    vi.useFakeTimers();
    try {
      render(<LiveCohortBody scope="city" />, { container: host });
      fireEvent.click(tab("Answers"));
      act(() => { vi.advanceTimersByTime(80); });
      const afterOpen = calls.length;
      fireEvent.click(tab("Answers"));
      act(() => { vi.advanceTimersByTime(80); });
      expect(calls.length).toBe(afterOpen);
    } finally {
      vi.useRealTimers();
      host.remove();
    }
  });

  it("opens a tab on tap and closes it on a second tap", () => {
    render(<LiveCohortBody scope="city" />);
    fireEvent.click(tab("Answers"));
    expect(tab("Answers").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel")).toBeTruthy();

    fireEvent.click(tab("Answers"));
    expect(tab("Answers").getAttribute("aria-selected")).toBe("false");
    expect(screen.queryByRole("tabpanel")).toBeNull();
  });

  it("keeps Explore for the World and offers it nowhere else (D152)", () => {
    // Explore is the WORLD's lens — the prototype module is named for it.
    // Its reading is "how does this slice differ from everyone", so the
    // baseline it needs is everyone; at City it silently compares a slice
    // of a city against that city, which is not the sentence the lens is
    // written to say. Not an empty-tab problem — a misplaced-reading one,
    // which is why the tab goes rather than staying and saying "no data".
    render(<LiveCohortBody scope="city" />);
    expect(tab("Explore")).toBeUndefined();
    cleanup();

    render(<LiveCohortBody scope="country" />);
    expect(tab("Explore")).toBeUndefined();
    cleanup();

    render(<LiveCohortBody scope="world" />);
    const names = [...tabs().querySelectorAll('[role="tab"]')].map((b) => b.textContent?.trim());
    // Explore lands BEFORE Compare, not after it (D188): it is a fourth
    // reading of the population, and Compare closes the row everywhere.
    expect(names).toEqual(["Answers", "People", "Scores", "Explore", "Compare"]);
  });

  it("draws the constellation above the row, whatever the row is showing", () => {
    render(<LiveCohortBody scope="city" />);
    // The field is the head of the stop now, not a tab in it — so it is on
    // screen at load, and STAYS on screen when another tab opens. That
    // second half is the whole point of D136 and is why this asserts after
    // a click rather than only at mount.
    const region = () => screen.getByRole("region", { name: "Overview" });
    expect(region()).toBeTruthy();
    fireEvent.click(tab("Compare"));
    expect(region()).toBeTruthy();
    // …and it sits BEFORE the row in document order, which is what "above"
    // means to a screen reader as well as to an eye.
    expect(region().compareDocumentPosition(tabs()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("puts the answer rows one tap away", () => {
    render(<LiveCohortBody scope="city" />);
    fireEvent.click(tab("Answers"));
    expect(screen.getByText("Almost everyone agrees")).toBeTruthy();
  });

  it("swaps the body when a tab is picked, and puts it back", () => {
    render(<LiveCohortBody scope="city" />);
    fireEvent.click(tab("Answers"));
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
    // tabs: People pays for voter lists, so it may not run because the
    // stop was merely opened.
    //
    // OVERVIEW IS NO LONGER IN THAT SET, and this case is where that cost
    // is visible rather than assumed. D135 made it the landing tab, so
    // the similarity fold now runs on arrival at every cohort stop — the
    // deliberate price of the reversal. It stays affordable because
    // loadSimilarity is bounded and session-cached (live.ts), so it is
    // one load per session, not one per stop visit. Asserted in both
    // directions below so the day it stops being one bounded load is a
    // failure here rather than a line on a bill.
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
    // The accepted cost, unchanged from D135: the field's fold runs on
    // arrival at a stop. Same call count as when it was the landing tab,
    // because a stop always opened on it.
    expect(similarity, "the constellation is the head of the stop and its fold did not run").toHaveBeenCalledTimes(1);

    fireEvent.click(tab("People"));
    await vi.waitFor(() => {
      expect(kindred, "opening People fetched nothing — the gate above guards nothing").toHaveBeenCalled();
    });
    // D136 made this STRICTER than it was. While Overview was a tab, moving
    // away and back unmounted and re-mounted the field, so the loader fired
    // again — harmless (loadSimilarity early-returns on `similarityLoading`
    // and its getDocs sweep is guarded by `state.testAggsLoaded`) but real,
    // and the previous version of this case asserted exactly that second
    // call. Now the field sits outside the tab conditional and never
    // unmounts, so navigating the row costs nothing at all.
    //
    // Worth keeping as its own assertion rather than folding into the
    // count above: this is the property that would break if someone put
    // the field back inside a conditional, and the count alone would still
    // read 1 at the moment of mount.
    fireEvent.click(tab("Compare"));
    fireEvent.click(tab("Answers"));
    await act(async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); });
    expect(similarity.mock.calls.length,
      "navigating the row re-ran the constellation's fold — the field is inside a conditional again").toBe(1);
  });
});

// ── the lenses read the stop they are standing on ────────────────────
//
// D170. Three tabs named a population and read a different one. `rows`
// (Answers) always took the cohort CELL — `agg.by[scope][bucket]` — while
// `lensQs` was assembled from `agg.counts`, which is the GLOBE. So on the
// City stop, "against Oslo" and "How Oslo rated it" were the world's
// numbers with a city's name on them.
//
// It is D157's failure one tab over: not a fabricated number, a real one
// describing a crowd it never counted. And it was visible from the app —
// Answers said "1 more question has no answers from Oslo yet" while
// Compare showed that same question at 50/50, two tabs apart on one screen.
//
// The fixture is built so a scope bug cannot pass: every global count is
// far from its Oslo cell, and one question has a globe and NO Oslo cell
// at all — the case that used to draw a confident split out of a cohort
// with nothing in it.
describe("LiveCohortBody · a lens reads its own stop, never the globe", () => {
  const ARCHIVE = [
    { id: "q1", text: "Split question", branch: "Mind", type: "binary", coreCorpus: true, options: [{ label: "Yes" }, { label: "No" }] },
    { id: "q2", text: "Absent in Oslo", branch: "Mind", type: "binary", coreCorpus: true, options: [{ label: "Yes" }, { label: "No" }] },
    // `rates` since D187 — Scores draws the questions that rate the stop
    // it is standing on, so a fixture without it puts an empty card in
    // front of a case about which CELL the card reads.
    { id: "q3", text: "Rated question", branch: "Mind", type: "scale", rates: "city", coreCorpus: true, options: [{ label: "1" }, { label: "2" }, { label: "3" }, { label: "4" }, { label: "5" }] },
  ];

  beforeEach(() => {
    LIVE.aggregated = () => ARCHIVE;
    LIVE.myVotes = () => ({ q1: "1", q2: "0", q3: "3" });
    LIVE.aggFor = (qid: string) => {
      if (qid === "q1") {
        // globe 90/10 · Oslo 1/3 — your "No" is a 10% opinion worldwide
        // and a 75% one here. One number is right and they are not close.
        return { counts: { "0": 90, "1": 10 }, total: 100, by: { city: { "Oslo, NO": { "0": 1, "1": 3 } } } };
      }
      if (qid === "q2") {
        // answered elsewhere, never in Oslo
        return { counts: { "0": 40, "1": 60 }, total: 100, by: { city: { "Bergen, NO": { "0": 40, "1": 60 } } } };
      }
      // globe sits at 5/5, Oslo at 2/5
      return {
        counts: { "0": 0, "1": 0, "2": 0, "3": 0, "4": 20 }, total: 20,
        by: { city: { "Oslo, NO": { "0": 0, "1": 4, "2": 0, "3": 0, "4": 0 } } },
      };
    };
  });

  // The lens bodies are a lazy chunk, so the panel is empty for a tick
  // after the tab flips. `findBy*` polls; a microtask flush does not
  // settle a real dynamic import and leaves every assertion looking at an
  // empty tabpanel.
  const openLens = (name: string) => {
    render(<LiveCohortBody scope="city" />);
    fireEvent.click(screen.getByRole("tab", { name }));
  };

  it("Compare scores you against this city, not against the world", async () => {
    openLens("Compare");
    // Oslo: 3 of 4 said "No", and "No" is your pick.
    expect(await screen.findByText(/75% here agreed/)).toBeTruthy();
    // The globe's number for the same pick. Its presence would mean the
    // lens is reading agg.counts.
    expect(screen.queryByText(/10% here agreed/)).toBeNull();
  });

  it("Compare drops a question this city has not answered", async () => {
    openLens("Compare");
    expect(await screen.findByText("Split question")).toBeTruthy();
    // Answers already reports this one as absent; a lens that shows it
    // anyway makes two tabs of one screen disagree about the same cohort.
    expect(screen.queryByText("Absent in Oslo")).toBeNull();
  });

  it("Scores averages this city's ratings, not the world's", async () => {
    openLens("Scores");
    // Oslo gave it 2 (four answers at index 1). The globe gave it 5.
    expect(await screen.findByText("2")).toBeTruthy();
    expect(screen.queryByText("5")).toBeNull();
  });
});

// ── a reading drawn from one answer is not a percentage ──────────────
//
// D170's second half, and the one the screenshots led with: a city whose
// only answer is yours told you "100% of Oslo are with you" and, under
// "How Oslo rated it", "you gave it 4 — exactly the average · 1 answer".
// Both are you, compared with yourself.
//
// The rule here is arithmetic rather than a thin-data threshold nobody
// voted on: at n=1 the only values the fold can produce are 0% and 100%,
// so a percentage carries no information the count does not. n=2 is thin
// too and still says something, so it is left alone.
describe("LiveCohortBody · one answer is a count, not a share", () => {
  const ARCHIVE = [
    { id: "q1", text: "Lonely question", branch: "Mind", type: "binary", coreCorpus: true, options: [{ label: "Yes" }, { label: "No" }] },
    // `rates` for the same reason as the fixture above (D187): this case
    // is about what Scores SAYS at n=1, which needs a card to say it on.
    { id: "q2", text: "Lonely rating", branch: "Mind", type: "scale", rates: "city", coreCorpus: true, options: [{ label: "1" }, { label: "2" }, { label: "3" }, { label: "4" }, { label: "5" }] },
  ];

  beforeEach(() => {
    LIVE.aggregated = () => ARCHIVE;
    LIVE.myVotes = () => ({ q1: "1", q2: "3" });
    LIVE.aggFor = (qid: string) => qid === "q1"
      ? { counts: { "1": 1 }, total: 1, by: { city: { "Oslo, NO": { "1": 1 } } } }
      : { counts: { "3": 1 }, total: 1, by: { city: { "Oslo, NO": { "3": 1 } } } };
  });

  it("says how many answers there are instead of what share agreed", () => {
    render(<LiveCohortBody scope="city" />);
    fireEvent.click(screen.getByRole("tab", { name: "Answers" }));
    // The first row is open on arrival (D120) — clicking it would close it.
    expect(screen.getByText(/One answer from Oslo so far/i)).toBeTruthy();
    expect(screen.queryByText(/100% of Oslo are with you/i)).toBeNull();
  });

  it("Scores does not call your own answer the average", async () => {
    render(<LiveCohortBody scope="city" />);
    fireEvent.click(screen.getByRole("tab", { name: "Scores" }));
    expect(await screen.findByText(/the only answer here so far/i)).toBeTruthy();
    expect(screen.queryByText(/exactly the average/i)).toBeNull();
  });

  it("Compare stops calling a tie the majority", async () => {
    // Two answers, one each way: nobody is in the majority, and the
    // release counted this row as one.
    LIVE.aggFor = () => ({ counts: { "0": 1, "1": 1 }, total: 2, by: { city: { "Oslo, NO": { "0": 1, "1": 1 } } } });
    render(<LiveCohortBody scope="city" />);
    fireEvent.click(screen.getByRole("tab", { name: "Compare" }));
    // The line is a fraction now, not a sentence, so the tie has to show
    // up as the numerator rather than as a word.
    const head = await screen.findByText(/least typical first/i);
    expect(head.textContent).toMatch(/^\s*0\//);
  });
});

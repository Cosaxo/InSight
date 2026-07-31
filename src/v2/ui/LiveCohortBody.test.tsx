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
import { cleanup, render, screen } from "@testing-library/react";
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
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LiveCohortBody } = await import("./LiveCohortBody");

// Two questions, so "one is shown and one is withheld" is expressible.
const Q = (id: string, text: string) => ({
  id, text, options: [{ label: "Yes" }, { label: "No" }],
});

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.myCity = "Oslo, NO";
  LIVE.deck = () => [Q("q1", "First question"), Q("q2", "Second question")];
  LIVE.aggFor = () => null;
});
afterEach(cleanup);

describe("LiveCohortBody · a withheld cell is not a zero", () => {
  it("counts and names a question whose city cell is missing", () => {
    // q1 has an Oslo cell; q2's dimension exists but Oslo is not in it —
    // the server suppressed it because fewer than 5 Oslo people answered.
    LIVE.aggFor = (qid) => qid === "q1"
      ? { by: { city: { "Oslo, NO": { "0": 7, "1": 5 } } } }
      : { by: { city: { "Bergen, NO": { "0": 9, "1": 6 } } } };

    render(<LiveCohortBody scope="city" />);

    expect(screen.getByText("First question")).toBeTruthy();
    // The withheld one must NOT be drawn as a row…
    expect(screen.queryByText("Second question")).toBeNull();
    // …and must be accounted for in words, with the count and the reason.
    expect(screen.getByText(/1 more question is withheld/i)).toBeTruthy();
    expect(screen.getByText(/fewer than 5 people in Oslo have answered it yet/i)).toBeTruthy();
  });

  it("pluralises the withheld line rather than saying '2 question is'", () => {
    LIVE.deck = () => [Q("q1", "Shown"), Q("q2", "Hidden A"), Q("q3", "Hidden B")];
    LIVE.aggFor = (qid) => qid === "q1"
      ? { by: { city: { "Oslo, NO": { "0": 7 } } } }
      : { by: { city: { "Bergen, NO": { "0": 9 } } } };

    render(<LiveCohortBody scope="city" />);
    expect(screen.getByText(/2 more questions are withheld/i)).toBeTruthy();
    expect(screen.getByText(/have answered them yet/i)).toBeTruthy();
  });

  it("says the cohort is filling up when EVERY cell is withheld", () => {
    // The all-withheld case takes the empty-state branch, not the counter
    // branch — so it needs its own assertion or a regression there shows a
    // blank panel and nothing else.
    LIVE.aggFor = () => ({ by: { city: { "Bergen, NO": { "0": 9 } } } });
    render(<LiveCohortBody scope="city" />);
    expect(screen.getByText(/Oslo is still filling up/i)).toBeTruthy();
    expect(screen.getByText(/withheld rather than shown thin/i)).toBeTruthy();
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
    expect(screen.getByText(/1 more question is withheld/i)).toBeTruthy();
    // World scope explains itself differently — "fewer than 5 people in the
    // world" would be a different and sillier claim.
    expect(screen.getByText(/it has fewer than 5 answers so far/i)).toBeTruthy();
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
  // LN_FLOOR is shown to the user in three sentences. The panel's own
  // comment says "drift here is a lie about the floor rather than a cosmetic
  // bug" — but nothing enforced the agreement, and the two constants live in
  // different tsconfig projects so no compiler can relate them.
  it("LN_FLOOR in the panel equals AGG_MIN_N in the trigger", () => {
    const root = resolve(__dirname, "../../..");
    const read = (p: string) => readFileSync(resolve(root, p), "utf8");

    const panel = read("src/v2/ui/LiveCohortBody.tsx").match(/const LN_FLOOR = (\d+)/);
    const server = read("functions/src/v2.ts").match(/export const AGG_MIN_N = (\d+)/);

    // If either regex stops matching, the constant was renamed or moved and
    // this check silently became vacuous — so fail on that too.
    expect(panel, "LN_FLOOR not found in LiveCohortBody.tsx").not.toBeNull();
    expect(server, "AGG_MIN_N not found in functions/src/v2.ts").not.toBeNull();
    expect(panel![1]).toBe(server![1]);
  });
});

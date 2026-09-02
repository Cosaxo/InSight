// @vitest-environment jsdom
//
// The type-mix card's system switch (D202).
//
// D202 reversed D157 §4 and let this card read every instrument the
// archetype module defines, not only the Big Five. The reversal is the
// owner's; what these cases hold is the part that was NOT reversed, and
// the part the prototype got wrong:
//
//   1. Every row is a COUNT of real typed people. The v28 prototype
//      derives its non-Big-Five mixes from authored per-type shares with a
//      per-population wobble; D167 forbids that and D157 removed exactly
//      that class. Switching to Politics must therefore be able to draw
//      NOTHING — a measured zero — rather than a plausible number.
//   2. The honesty rules apply PER INSTRUMENT. Coverage differs by how far
//      each person has got through the round-robined test feed, so
//      `typedN`, the thin list and the counts-not-shares state are
//      recomputed on every switch rather than carried across it.
//   3. The switch is reachable from an empty system. It is the way back
//      out of one, so hiding it on the empty state would strand a reader
//      on the instrument they have least coverage of.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("../data/live", () => ({
  default: {
    enabled: true,
    anchors: () => ({ city: "Oslo, NO", country: "NO" }),
    kindredPeople: () => PEOPLE,
    myTestResults: () => ({}),
    // A getter for the same reason `budgetPaused` is one — the loading
    // case flips it after the factory has run.
    kindredLoading: () => LOADING,
    // A getter so the D332 case can flip it after the factory has run —
    // the closure reads the module-level flag at render time, the PEOPLE
    // pattern one line up.
    get budgetPaused() { return PAUSED; },
  },
}));

import TypeMixCard from "./TypeMixCard";

/** A cross-user result as `parseTestResults` leaves it: kind → dim → value. */
const person = (uid: string, results: Record<string, Record<string, number>>) => ({
  uid, name: uid, city: "Oslo, NO", results, like: { pct: 50 },
});

// Everyone carries a Big Five result; only two carry a politics one. That
// asymmetry is the point — it is what a real bank produces, because the
// test feed hands the four instruments out over time.
const BIG5 = { O: 72, C: 55, E: 15, A: 58, N: 50 };
const POL = { econ: 30, auth: 40, foreign: 60, env: 70, tech: 55, estab: 45 };
let PEOPLE: ReturnType<typeof person>[] = [];
let PAUSED = false;
let LOADING = false;

beforeEach(() => {
  PAUSED = false;
  LOADING = false;
  PEOPLE = [
    ...Array.from({ length: 6 }, (_, i) => person(`b${i}`, { big5: BIG5 })),
    person("p0", { big5: BIG5, political: POL }),
    person("p1", { big5: BIG5, political: POL }),
  ];
  try { localStorage.clear(); } catch { /* jsdom always has one */ }
});
afterEach(cleanup);

describe("the switch", () => {
  it("offers all four instruments (D202 — it was Big Five only until then)", () => {
    render(<TypeMixCard scope="city" />);
    for (const label of ["Personality", "Politics", "Values", "Social"]) {
      expect(screen.getByRole("tab", { name: label })).toBeTruthy();
    }
  });

  it("starts on Personality and moves the selection when tapped", () => {
    render(<TypeMixCard scope="city" />);
    expect(screen.getByRole("tab", { name: "Personality" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "Politics" }));
    expect(screen.getByRole("tab", { name: "Politics" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Personality" }).getAttribute("aria-selected")).toBe("false");
  });

  it("remembers the choice across a remount, and forgets it on a purge", () => {
    const first = render(<TypeMixCard scope="city" />);
    fireEvent.click(screen.getByRole("tab", { name: "Values" }));
    first.unmount();

    render(<TypeMixCard scope="city" />);
    expect(screen.getByRole("tab", { name: "Values" }).getAttribute("aria-selected")).toBe("true");

    // D51: the choice is device state, so the purge takes it. The prefix
    // sweep clears the key; this asserts the live component follows rather
    // than sitting on a system the store no longer remembers.
    fireEvent(window, new Event("insight:local-purge"));
    expect(screen.getByRole("tab", { name: "Personality" }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("what each instrument is allowed to say", () => {
  it("counts the people it actually typed, per instrument", () => {
    render(<TypeMixCard scope="city" />);
    // Eight people, all with a Big Five result.
    expect(screen.getByText(/8 typed in Oslo/)).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Politics" }));
    // The same eight sampled; two of them typed. The denominator moves
    // with the instrument, which is the whole of rule 2.
    expect(screen.getByText(/2 typed in Oslo/)).toBeTruthy();
  });

  it("draws a measured nothing rather than a plausible share", () => {
    // Nobody carries a values result. The prototype would still have drawn
    // a full bar stack here, derived from authored shares. This must not.
    render(<TypeMixCard scope="city" />);
    fireEvent.click(screen.getByRole("tab", { name: "Values" }));
    expect(screen.getByText(/none typed on this one yet/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d+\s*%/);
  });

  it("keeps the switch reachable from an empty instrument", () => {
    render(<TypeMixCard scope="city" />);
    fireEvent.click(screen.getByRole("tab", { name: "Social" }));
    expect(screen.getByText(/none typed on this one yet/)).toBeTruthy();
    // The way back out.
    expect(screen.getByRole("tab", { name: "Personality" })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Personality" }));
    expect(screen.getByText(/8 typed in Oslo/)).toBeTruthy();
  });

  it("withholds shares under TYPE_SMALL, on the instrument being read", () => {
    // Two typed politics people is far under TYPE_SMALL (40), so the
    // politics view owes counts and says so — even though the Big Five
    // view beside it has four times the sample.
    render(<TypeMixCard scope="city" />);
    fireEvent.click(screen.getByRole("tab", { name: "Politics" }));
    expect(screen.getByText("counts, not shares")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d+\s*%/);
  });

  it("drops the who-voted instruction under the read breaker (D332)", () => {
    // With the sample paused at zero, "open a who-voted sheet and this
    // fills in" is an instruction that does nothing — the sheet's own
    // fetch refuses. The HEAD alone, not the full sentence: this card
    // only renders under Kindred, which already carries the why.
    PEOPLE = [];
    PAUSED = true;
    render(<TypeMixCard scope="city" />);
    expect(screen.getByText("Paused for now")).toBeTruthy();
    expect(screen.queryByText(/who-voted sheet and this fills in/i)).toBeNull();
  });

  it("…and drops it while the roster is still being read", () => {
    // THE NORMAL FIRST FRAME OF EVERY VISIT. The People lens kicks
    // `loadKindred()` on mount and this card renders inside it, so for
    // the whole round trip the sample is empty — and the card used to
    // tell the reader to go open a who-voted sheet, an instruction for a
    // thing already happening, printed directly under a Kindred card
    // correctly saying "Matching…".
    //
    // Three states, and D332 gave this branch copy for two of them.
    PEOPLE = [];
    LOADING = true;
    render(<TypeMixCard scope="city" />);
    expect(screen.getByText(/Reading who answered/)).toBeTruthy();
    expect(screen.queryByText(/who-voted sheet and this fills in/i)).toBeNull();
  });

  it("offers the instruction once the read is done and found nobody", () => {
    // The control for both cases above: with nothing paused and nothing
    // in flight, an empty sample really is "nobody here yet", and the one
    // action that fills it is worth offering. Without this, either
    // absence assertion above would pass against a card that had simply
    // stopped saying anything.
    PEOPLE = [];
    render(<TypeMixCard scope="city" />);
    expect(screen.getByText(/who-voted sheet and this fills in/i)).toBeTruthy();
    expect(screen.queryByText(/Reading who answered/)).toBeNull();
  });
});

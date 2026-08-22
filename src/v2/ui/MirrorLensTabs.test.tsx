// @vitest-environment jsdom
//
// The lens row (D119, reshaped at D136) — the tab bar every live Mirror
// stop is navigated by: Answers · People · Scores · Explore · Compare on
// the geographic stops, and the three of those Circle, Groups and Near
// carry since D190.
//
// `check:panel-suites` files this panel as "routing, no reading of its
// own". That is why it went unwritten and it is not a reason it cannot
// lie. A row that reports the wrong tab open, that offers a lens the stop
// does not have, or that a keyboard cannot reach is a broken stop — and
// every one of those three type-checks, which is the whole reason panels
// get suites here.
//
// Seven properties, each a way a correct caller reaches the screen as a
// wrong row:
//
//   1. THE ROW IS THE LIST IT WAS HANDED, in the order it was handed it.
//      Explore is the World's lens alone (D152) and Compare ends the row
//      (D184); a tab added here, or a row that sorted itself, breaks a
//      decision made two files away with nothing between it and a user.
//      The fixtures are built from `lensesFor` + `LENS_LABEL` rather than
//      invented, so a stray tab fails by the word a reader would see.
//   2. ONE TAB REPORTS OPEN, AND IT IS THE CALLER'S. `aria-selected` is
//      the entire answer a screen reader gets to "where am I" — a row
//      that hard-codes it, or reads it off the wrong index, narrates a
//      different stop than the one on screen.
//   3. CLOSED IS CLOSED. Every stop opens with nothing open (D155), and
//      LiveCohortBody hands this row an `open` that is not in `tabs`
//      whenever you walk World → City with Explore up. Both must read as
//      "nothing", not as "the first tab".
//   4. THE INDICATOR IS UNDER THE OPEN TAB AND ONE TAB WIDE. It is
//      `aria-hidden`, so it is the only thing that tells a sighted user
//      which tab is open, and it is positioned in units of its own width
//      — `--n` and the transform are one claim, not two, and a `--n`
//      that disagrees with the row slides it between two labels.
//   5. THE TAP GOES UP AS THAT TAB'S OWN ID — including a tap on the tab
//      already open, which is how all four callers CLOSE a stop
//      (`onOpen={(id) => setTab(id === tab ? "" : id)}`). A row that
//      swallowed the second tap would strand every stop open.
//   6. THE ROW IS OPERABLE AND HONEST TO A SCREEN READER: real buttons in
//      the tab order (a `<div onClick>` is D23's defect, and it renders
//      identically), and nothing in the tablist but tabs.
//   7. THE LABELS STEP DOWN AS THE ROW WIDENS. The row never scrolls, so
//      the size ladder is the only thing between "a section was added"
//      and labels clipping — and it has already failed exactly that way
//      once (D126 added a seventh tab, the `>= 6` rung absorbed it, and
//      nothing measured the row until D135 read it off a device).
//
// No store mock: this file imports React and a TYPE, and `./lensTabs` is
// pure. It is imported for real, per the README's rule — the labels and
// the per-scope lens list are what the row is made of, and a fixture that
// re-typed them would be a test about itself.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import MirrorLensTabs from "./MirrorLensTabs";
import { LENS_LABEL, STOP_TABS, TAB_LABEL, lensesFor } from "./lensTabs";
import type { LensTab } from "./lensTabs";

afterEach(cleanup);

const noop = () => {};

/**
 * A geographic stop's row, assembled the way `LiveCohortBody` assembles it
 * — `STOP_TABS`, then the lenses this scope has.
 *
 * Copied from the caller rather than invented so the labels under test are
 * the vocabulary that ships: City has no Explore because `lensesFor` says
 * so, not because this file left it out.
 */
const stopRow = (scope: "city" | "country" | "world"): LensTab[] => [
  ...STOP_TABS.map((id) => ({ id, label: TAB_LABEL[id] })),
  ...lensesFor(scope).map((id) => ({ id, label: LENS_LABEL[id] })),
];

/** The three Circle, Groups and Near each declare verbatim (D190). */
const SET_ROW: LensTab[] = [
  { id: "answers", label: "Answers" },
  { id: "people", label: "People" },
  { id: "compare", label: "Compare" },
];

/** A row of an arbitrary width, for the size ladder alone. */
const wide = (n: number): LensTab[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, label: `Tab ${i}` }));

// The `name` is asserted by being queried on: the row's accessible name is
// what distinguishes it from the app's own tab bar one level down, and a
// row that lost it would fail every case in this file rather than one.
const row = () => screen.getByRole("tablist", { name: "Lenses" });
const tabs = () => screen.getAllByRole("tab");
const labels = () => tabs().map((t) => t.textContent);
const tab = (name: string) => screen.getByRole("tab", { name });
const selected = () => tabs().filter((t) => t.getAttribute("aria-selected") === "true");
// The indicator is deliberately nameless (property 6), so the class it is
// styled through is the only handle on it that exists.
const thumb = () => row().querySelector(".mm-lensthumb") as HTMLElement;

describe("MirrorLensTabs · the row is the list it was handed", () => {
  it("draws the stop's own lenses, in the stop's own order", () => {
    render(<MirrorLensTabs tabs={stopRow("world")} open="" onOpen={noop} />);
    // toEqual, not a set check: the order IS a decision (D184 moved
    // Compare last so the row runs from "them" to "you and them"), and a
    // row that quietly re-sorted would pass any membership assertion.
    expect(labels()).toEqual(["Answers", "People", "Scores", "Explore", "Compare"]);
  });

  it("offers no lens the stop does not have", () => {
    // Explore at City re-cuts a cut and reports the divergence against the
    // city instead of against everyone (D152) — the reading is wrong, not
    // thin, which is why the tab must be absent rather than empty.
    render(<MirrorLensTabs tabs={stopRow("city")} open="" onOpen={noop} />);
    expect(labels()).toEqual(["Answers", "People", "Scores", "Compare"]);
    expect(screen.queryByRole("tab", { name: "Explore" })).toBeNull();
    // A set stop is narrower still: no Scores either — a circle of nine
    // has no questions that rate a place (D190).
    cleanup();
    render(<MirrorLensTabs tabs={SET_ROW} open="" onOpen={noop} />);
    expect(labels()).toEqual(["Answers", "People", "Compare"]);
  });
});

describe("MirrorLensTabs · which tab is open", () => {
  it("marks the caller's tab open and no other", () => {
    render(<MirrorLensTabs tabs={stopRow("world")} open="scores" onOpen={noop} />);
    expect(selected().map((t) => t.textContent)).toEqual(["Scores"]);
  });

  it("marks nothing open when the stop is closed", () => {
    // D155: a stop opens on nothing, and the row pinned to the bottom is
    // what makes that read as a tab bar rather than a blank screen.
    render(<MirrorLensTabs tabs={stopRow("world")} open="" onOpen={noop} />);
    expect(selected()).toHaveLength(0);
    // The indicator does not park under the first tab and claim it: it
    // fades instead (`is-off` is opacity 0), which is the difference
    // between "nothing is open" and "Answers is open".
    expect(thumb().className).toContain("is-off");
  });

  it("marks nothing open when the open tab is one this stop lost", () => {
    // The real path: LiveCohortBody keeps `tab` across a scope change, so
    // walking World → City with Explore up hands this row an id that is
    // not in its list. Its own guard turns that into "", but the row must
    // not depend on the guard — the two set stops keep their own state.
    render(<MirrorLensTabs tabs={stopRow("city")} open="explore" onOpen={noop} />);
    expect(selected()).toHaveLength(0);
    expect(thumb().className).toContain("is-off");
  });
});

describe("MirrorLensTabs · the indicator points at the open tab", () => {
  // The thumb is aria-hidden, so for a sighted user it is not decoration
  // beside the state — it IS the state, alongside the label's weight. It
  // is `width: calc(100% / var(--n))` in styles.css and slides in
  // multiples of its own width, so the row's `--n` and the transform are
  // one claim: an `--n` off by one puts every step between two labels.
  const at = (scope: "city" | "country" | "world", open: string) => {
    render(<MirrorLensTabs tabs={stopRow(scope)} open={open} onOpen={noop} />);
    return { n: row().style.getPropertyValue("--n"), x: thumb().style.transform };
  };

  it("sits at the open tab's place, in tab-widths", () => {
    expect(at("world", "answers")).toEqual({ n: "5", x: "translateX(0%)" });
    cleanup();
    // Compare is last of five, so the indicator is four of its own widths
    // along — the step a hard-coded `--n` or an off-by-one index shows up
    // at most plainly.
    expect(at("world", "compare")).toEqual({ n: "5", x: "translateX(400%)" });
  });

  it("counts the tabs this stop actually has", () => {
    // Same last tab, a narrower row: three tabs means the thumb is a third
    // wide and Compare is two widths along, not four.
    render(<MirrorLensTabs tabs={SET_ROW} open="compare" onOpen={noop} />);
    expect(row().style.getPropertyValue("--n")).toBe("3");
    expect(thumb().style.transform).toBe("translateX(200%)");
  });
});

describe("MirrorLensTabs · tapping", () => {
  it("hands up the id of the tab that was tapped", () => {
    const onOpen = vi.fn<(id: string) => void>();
    render(<MirrorLensTabs tabs={stopRow("world")} open="" onOpen={onOpen} />);
    // Every tab, not one: a row that reported a neighbour's id, or the
    // label instead of the id, needs two taps to show itself, and the ids
    // are what `lensesFor` and the lens bodies agree on — the labels are
    // not (TAB_LABEL and LENS_LABEL both map id → word).
    for (const t of tabs()) fireEvent.click(t);
    expect(onOpen.mock.calls.flat()).toEqual(["answers", "people", "scores", "explore", "compare"]);
  });

  it("still reports a tap on the tab already open, so a stop can close", () => {
    // All four callers close on the second tap
    // (`onOpen={(id) => setTab(id === tab ? "" : id)}`), which is the only
    // way back to D155's resting state. A row that guarded the open tab —
    // skipping the call, or disabling the button — would strand every stop
    // open, and would look completely reasonable in the diff.
    const onOpen = vi.fn<(id: string) => void>();
    render(<MirrorLensTabs tabs={SET_ROW} open="people" onOpen={onOpen} />);
    fireEvent.click(tab("People"));
    expect(onOpen.mock.calls.flat()).toEqual(["people"]);
  });
});

describe("MirrorLensTabs · reachable, and honest about what it is", () => {
  it("gives every tab as a button in the keyboard tab order", () => {
    // This is navigation, so a tab nobody can reach without a pointer is a
    // stop nobody can reach without a pointer. jsdom performs no default
    // key activation, so what is asserted is the thing the platform hangs
    // Enter, Space and focus off: a real <button>, not disabled, at
    // tabIndex 0. A <div role="tab" onClick> renders the same tree, reads
    // the same to `getAllByRole`, and is D23's defect back again.
    render(<MirrorLensTabs tabs={stopRow("world")} open="people" onOpen={noop} />);
    for (const t of tabs()) {
      expect(t.tagName, `${t.textContent} is not a button`).toBe("BUTTON");
      expect((t as HTMLButtonElement).disabled).toBe(false);
      expect(t.tabIndex, `${t.textContent} is out of the tab order`).toBe(0);
    }
  });

  it("puts nothing but tabs in the tablist", () => {
    // `role="tablist"` promises its children are tabs. The indicator is a
    // span inside it, and `aria-hidden` is the one line that keeps that
    // promise true — without it a screen reader walking the row meets an
    // unlabelled element between the labels.
    render(<MirrorLensTabs tabs={SET_ROW} open="answers" onOpen={noop} />);
    const inside = within(row());
    expect(inside.getAllByRole("tab")).toHaveLength(3);
    // queryAllByRole skips the accessibility tree's hidden nodes, so this
    // is empty exactly while the indicator stays out of it.
    expect(inside.queryAllByRole("generic")).toHaveLength(0);
  });
});

describe("MirrorLensTabs · the row never scrolls, so the labels shrink", () => {
  it("steps the size down on the rungs that were measured", () => {
    // The ladder is measured, not guessed (D135: at 320 CSS px seven tabs
    // get ~45px each, and "Foresight" needs ~52px at 11.5 and ~47px at
    // 10.5). jsdom lays nothing out, so the ladder itself is the only
    // executable form of "every label fits" — and pinning it is what the
    // row was missing when Foresight arrived as a seventh tab and drew at
    // the size six were measured at for two decisions running.
    const size = (n: number) => {
      cleanup();
      render(<MirrorLensTabs tabs={wide(n)} open="" onOpen={noop} />);
      const sizes = new Set(tabs().map((t) => t.style.fontSize));
      // One size for the whole row: a per-tab size would fit each label
      // and leave the row ragged.
      expect(sizes.size, `${n} tabs drew at ${[...sizes].join(" / ")}`).toBe(1);
      return [...sizes][0];
    };
    expect([3, 4, 5, 6, 7, 8].map(size)).toEqual([
      "14.5px", "14.5px", "13px", "11.5px", "10.5px", "10.5px",
    ]);
  });
});

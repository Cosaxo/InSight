// @vitest-environment jsdom
//
// LiveCircleBody's empty and failed arms (D172).
//
// The stop has three states that look alike from the outside and mean
// different things, and the file's own comment says why conflating two of
// them would be the worst bug it could have: `circle()` returning null
// after a settled load is a FAILED READ, not an empty circle, and saying
// "you follow nobody" to someone with thirty follows is a lie about their
// own account.
//
// D172 changed what EMPTY looks like — the field, not a paragraph — which
// makes it worth pinning that the change did not leak into the other two.
// A drawing where the failure notice goes would be the same class of
// mistake pointed the other way.
//
// Mounted directly rather than through the app: the live fixture ships a
// circle of one on purpose (it exercises the filled shape), and emptying
// it from outside is fighting the fixture to test a component.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  uid: "u_me",
  subscribe: () => () => {},
  loadCircle: async () => {},
  circle: () => [] as Array<Record<string, unknown>> | null,
  circleLoading: () => false as boolean,
  aggregated: () => [] as Array<Record<string, unknown>>,
  aggFor: () => null,
  myVotes: () => ({}) as Record<string, string>,
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LiveCircleBody } = await import("./LiveCircleBody");

beforeEach(() => {
  LIVE.circle = () => [];
  LIVE.circleLoading = () => false;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("LiveCircleBody · an empty circle is a field, not a paragraph", () => {
  it("draws the rings and you when you follow nobody", () => {
    const { container } = render(<LiveCircleBody />);
    // The drawing is the claim. Before D172 this arm replaced it with a
    // headline, which reads as a stop that was never built rather than one
    // that is empty — and it hides the grammar the whole tab speaks from
    // the reader who has not learned it yet.
    expect(container.querySelector("svg"), "the empty circle lost its field").toBeTruthy();
    // "you" at the centre is the true picture node for node — nothing is
    // fabricated, which is what lets the drawing be here at all.
    expect(screen.getByText("you")).toBeTruthy();
    // The sentence survives; it just sits under the field instead of
    // standing where the field goes.
    expect(screen.getByText(/Follow someone from a who-voted sheet/i)).toBeTruthy();
    // And the retired headline is gone.
    expect(screen.queryByText(/You follow nobody yet/i)).toBeNull();
  });

  it("still says a FAILED read is a failure, and draws no field for it", () => {
    // The distinction this file exists for: null after a settled load
    // means the read broke. Drawing an empty constellation for it would
    // tell someone with thirty follows that they have none — the D172
    // change pointed the wrong way.
    LIVE.circle = () => null;
    const { container } = render(<LiveCircleBody />);
    expect(screen.getByText(/Couldn’t load your circle/i)).toBeTruthy();
    expect(container.querySelector("svg"),
      "a failed read drew a field, which claims the circle is empty").toBeNull();
  });

  it("says nothing at all while the first read is still in flight", () => {
    LIVE.circle = () => null;
    LIVE.circleLoading = () => true;
    render(<LiveCircleBody />);
    expect(screen.getByText(/Loading your circle/i)).toBeTruthy();
    expect(screen.queryByText(/Couldn’t load/i)).toBeNull();
  });
});

// ── the stop has a tab row now (D190) ────────────────────────────────
//
// D188 measured the row on every stop that had one and recorded that this
// one had none: "a missing feature, not a misplaced one". The stop's three
// readings — who is here, what they split on, you against them — were one
// long scroll; they are Answers · People · Compare now, and the row draws
// on an empty circle too. A row that appears only once there is data is a
// stop that reads as unfinished to exactly the account that has none.
describe("LiveCircleBody · the row is the stop's, not the data's", () => {
  const MEMBER = {
    uid: "u_ada", name: "Ada", mutual: true,
    like: { pct: 80, same: 4, shared: 5 },
    answers: {},
  };
  const tabNames = () => screen.getAllByRole("tab").map((t) => t.textContent);
  const openTab = (label: string) =>
    fireEvent.click(screen.getByRole("tab", { name: label }));

  it("draws Answers · People · Compare with people in the circle", () => {
    LIVE.circle = () => [MEMBER];
    render(<LiveCircleBody />);
    expect(tabNames()).toEqual(["Answers", "People", "Compare"]);
  });

  it("draws the same row on an empty circle, over the empty field", () => {
    LIVE.circle = () => [];
    const { container } = render(<LiveCircleBody />);
    expect(tabNames()).toEqual(["Answers", "People", "Compare"]);
    expect(container.querySelector("svg"), "the empty circle lost its field").toBeTruthy();
  });

  it("draws NO row for a failed read, where it has nothing to offer", () => {
    // Three readings of a circle nobody could load is three empty states
    // for one failure, and it would hide the retry sentence under them.
    LIVE.circle = () => null;
    render(<LiveCircleBody />);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
  });

  it("opens on nothing, and a second tap closes what it opened", () => {
    LIVE.circle = () => [MEMBER];
    render(<LiveCircleBody />);
    expect(screen.queryByRole("tabpanel")).toBeNull();
    openTab("People");
    expect(screen.getByText("Ada")).toBeTruthy();
    openTab("People");
    expect(screen.queryByRole("tabpanel")).toBeNull();
  });

  it("says why a tab is empty rather than drawing nothing", () => {
    LIVE.circle = () => [];
    render(<LiveCircleBody />);
    openTab("People");
    expect(screen.getByRole("tabpanel").textContent).toMatch(/a follow is one tap/i);
    openTab("Answers");
    expect(screen.getByRole("tabpanel").textContent).toMatch(/Fills in once two people you follow/i);
  });
});

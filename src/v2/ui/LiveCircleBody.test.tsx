// @vitest-environment jsdom
//
// LiveCircleBody's empty and failed arms (D171).
//
// The stop has three states that look alike from the outside and mean
// different things, and the file's own comment says why conflating two of
// them would be the worst bug it could have: `circle()` returning null
// after a settled load is a FAILED READ, not an empty circle, and saying
// "you follow nobody" to someone with thirty follows is a lie about their
// own account.
//
// D171 changed what EMPTY looks like — the field, not a paragraph — which
// makes it worth pinning that the change did not leak into the other two.
// A drawing where the failure notice goes would be the same class of
// mistake pointed the other way.
//
// Mounted directly rather than through the app: the live fixture ships a
// circle of one on purpose (it exercises the filled shape), and emptying
// it from outside is fighting the fixture to test a component.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

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
    // The drawing is the claim. Before D171 this arm replaced it with a
    // headline, which reads as a stop that was never built rather than one
    // that is empty — and it hides the grammar the whole tab speaks from
    // the reader who has not learned it yet.
    expect(container.querySelector("svg"), "the empty circle lost its field").toBeTruthy();
    // "you" at the centre is the true picture node for node — nothing is
    // fabricated, which is what lets the drawing be here at all.
    expect(screen.getByText("you")).toBeTruthy();
    // The sentence survives; it just sits under the field instead of
    // standing where the field goes.
    expect(screen.getByText(/Follow someone from a question/i)).toBeTruthy();
    // And the retired headline is gone.
    expect(screen.queryByText(/You follow nobody yet/i)).toBeNull();
  });

  it("still says a FAILED read is a failure, and draws no field for it", () => {
    // The distinction this file exists for: null after a settled load
    // means the read broke. Drawing an empty constellation for it would
    // tell someone with thirty follows that they have none — the D171
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

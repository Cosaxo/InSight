// @vitest-environment jsdom
//
// One person, drawn one way (D239). Three surfaces list people you might
// add — the create picker, add-to-a-circle, the search overlay — and they
// were drawing the same subject three ways before this existed.
//
// What these hold is the part a shared row is easy to get wrong: the
// ACTION. `onClick` makes the whole row the control, which is what a list
// of choices wants; without it the row must not be a button at all,
// because a control that does nothing reads as a broken one.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("../data/live", () => ({
  default: { faceFor: () => "", isFollowing: () => false, setFollowing: async () => {} },
}));

const { default: PersonRow } = await import("./PersonRow");

afterEach(cleanup);

describe("PersonRow", () => {
  it("names the person and their handle", () => {
    render(<PersonRow uid="u_ada" name="Ada Lovelace" handle="ada" />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("@ada")).toBeTruthy();
  });

  // Not everybody claims one, and an empty mono line under a name reads
  // as a field that failed to load rather than one nobody filled in.
  it("draws no handle line when there is no handle", () => {
    render(<PersonRow uid="u_ada" name="Ada Lovelace" />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByText(/^@/)).toBeNull();
  });

  // The directory skips nameless rows, but a uid can reach this from the
  // handle registry before its name has resolved — and a blank where a
  // person goes is worse than a placeholder that admits it.
  it("says Someone rather than nothing for a name that has not resolved", () => {
    render(<PersonRow uid="u_ada" name="" />);
    expect(screen.getByText("Someone")).toBeTruthy();
  });

  it("makes the whole row the control when it is one", () => {
    const onClick = vi.fn();
    render(<PersonRow uid="u_ada" name="Ada Lovelace" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: /Ada Lovelace/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is not a button at all without one", () => {
    render(<PersonRow uid="u_ada" name="Ada Lovelace" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("refuses the tap while disabled", () => {
    const onClick = vi.fn();
    render(<PersonRow uid="u_ada" name="Ada Lovelace" onClick={onClick} disabled />);
    fireEvent.click(screen.getByRole("button", { name: /Ada Lovelace/i }));
    expect(onClick).not.toHaveBeenCalled();
  });

  // The action slot. A row that carries its own control must not also be
  // a button — a button inside a button is not valid, and the outer one
  // would swallow the inner tap.
  it("carries an action beside the person", () => {
    render(
      <PersonRow uid="u_ada" name="Ada Lovelace">
        <button>Follow</button>
      </PersonRow>,
    );
    expect(screen.getByRole("button", { name: "Follow" })).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

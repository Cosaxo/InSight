// @vitest-environment jsdom
//
// The ridge is the one figure three surfaces share for an ordinal spread
// (D305) — the cases here pin what makes it that figure rather than a
// bar chart: every step drawn whether or not anyone chose it, your own
// column marked, and the crowd's peak named only when it is not yours.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import RatingRidge from "./RatingRidge";

afterEach(cleanup);

const COUNTS = [0, 0, 1, 2, 4, 9, 6, 3, 1, 0];

describe("RatingRidge", () => {
  it("draws every step of the scale, empty ones included", () => {
    render(<RatingRidge counts={COUNTS} />);
    // Ten titled columns — an empty step still holds its place, so the
    // scale reads as a scale and not as "the steps people happened to use".
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByTitle(`${i}: ${COUNTS[i - 1]}`)).toBeTruthy();
    }
    // The ends of the scale are named.
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
  });

  it("says the whole figure in one accessible sentence", () => {
    render(<RatingRidge counts={COUNTS} mine={3} />);
    expect(screen.getByRole("img", {
      name: "Spread across 10 steps, you at 4, most at 6",
    })).toBeTruthy();
  });

  it("names the crowd's peak only when it is not yours", () => {
    render(<RatingRidge counts={COUNTS} mine={2} />);
    expect(screen.getByText("most chose 6")).toBeTruthy();
    cleanup();
    // Standing on the mode: the label would repeat what your marked
    // column already says.
    render(<RatingRidge counts={COUNTS} mine={5} />);
    expect(screen.queryByText(/most chose/)).toBeNull();
  });

  it("stays quiet about a crowd that is not there", () => {
    render(<RatingRidge counts={[0, 0, 0, 0, 0]} />);
    expect(screen.queryByText(/most chose/)).toBeNull();
    expect(screen.getByText("5")).toBeTruthy();
  });
});

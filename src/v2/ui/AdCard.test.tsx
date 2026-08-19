// @vitest-environment jsdom
//
// A feed ad (D197). Three properties, and all three are the difference
// between an ad card and every other ad card:
//
//   1. It carries NO image, NO logo, NO link. `check:content` refuses each
//      by name at the source; this asserts the render agrees, because a
//      gate on the content and a component that could draw one anyway is
//      half a promise.
//   2. It wears the same disclosure a sponsored question wears — the
//      app's ink, the word PAID, the advertiser, the window.
//   3. It asks NOTHING. No options, no buttons to answer with, nothing
//      that could be mistaken for a question, which is the confusion the
//      whole separation exists to prevent.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AdCard from "./AdCard";

const AD = {
  id: "ad-a",
  advertiser: "Fixture Transit",
  headline: "Night buses now run until three.",
  body: "Every Friday and Saturday, on the four city lines.",
  until: "2026-08-21",
};

afterEach(cleanup);

describe("what it shows", () => {
  it("names the advertiser and the window without any interaction", () => {
    render(<AdCard ad={AD} />);
    expect(screen.getByText("PAID")).toBeTruthy();
    expect(screen.getByText("Fixture Transit")).toBeTruthy();
    expect(screen.getByText(/until 21 Aug/)).toBeTruthy();
    expect(screen.getByText(AD.headline)).toBeTruthy();
    expect(screen.getByText(AD.body)).toBeTruthy();
  });
});

describe("what it cannot show", () => {
  it("has no image, no link and nothing to tap through to", () => {
    const { container } = render(<AdCard ad={AD} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
    // The only button is the disclosure's own "why am I seeing this".
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });

  it("asks nothing — it is a card, not a question", () => {
    const { container } = render(<AdCard ad={AD} />);
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/\?$/);
  });
});

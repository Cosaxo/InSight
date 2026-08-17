// @vitest-environment jsdom
//
// The disclosure on a sponsored question (D194). Four of these are the
// house rule made executable rather than promised:
//
//   1. The word PAID and the buyer's name are ALWAYS on screen — not
//      behind the tap, not behind a hover, not abbreviated away.
//   2. The band carries no brand colour, logo, link or creative. The
//      disclosure is the app's; a buyer who could style it could soften it.
//   3. "Why you got it" is answerable in both directions, including the
//      untargeted one — "nothing about you decided this" is information,
//      and omitting the line would read as a targeted card hiding its tag.
//   4. What the sponsor RECEIVES is the post-D98 truth: the same public
//      numbers, no private cut. The prototype's line ("never names, never
//      your profile") is false now that answers are public and attributed,
//      and shipping it would be `check:public-copy`'s failure class with
//      money behind it.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import SponsorMark from "./SponsorMark";

afterEach(cleanup);

describe("what is always visible", () => {
  it("shows PAID, the buyer and the window without any interaction", () => {
    render(<SponsorMark sponsor={{ buyer: "Ruter" }} until="2026-08-21" />);
    expect(screen.getByText("PAID")).toBeTruthy();
    expect(screen.getByText("Ruter")).toBeTruthy();
    expect(screen.getByText(/until 21 Aug/)).toBeTruthy();
  });

  it("wears the app's ink, never a buyer's colour", () => {
    const { container } = render(<SponsorMark sponsor={{ buyer: "Ruter" }} />);
    const band = container.querySelector("button")!;
    expect(band.getAttribute("style")).toContain("var(--ink)");
    // No image, no link, no third-party anything — a sponsor buys a
    // question, not a placement.
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
  });
});

describe("why you got it", () => {
  it("names the tag it was bought against", () => {
    render(<SponsorMark sponsor={{ buyer: "Ruter", audience: { city: "Oslo, NO" } }} until="2026-08-21" />);
    fireEvent.click(screen.getByText("PAID"));
    expect(screen.getByText(/asked for City: Oslo, NO/)).toBeTruthy();
  });

  it("says so when nothing about you decided it", () => {
    render(<SponsorMark sponsor={{ buyer: "Ruter" }} />);
    fireEvent.click(screen.getByText("PAID"));
    expect(screen.getByText(/asked everyone — nothing about you decided this/)).toBeTruthy();
  });
});

describe("what the sponsor receives", () => {
  it("is the post-D98 truth, not the prototype's retired promise", () => {
    const { container } = render(<SponsorMark sponsor={{ buyer: "Ruter" }} />);
    fireEvent.click(screen.getByText("PAID"));
    expect(container.textContent).toContain("the same public numbers you do");
    expect(container.textContent).toContain("no private cut");
    // The sentence that is now false: answers are public and attributed,
    // and the who-voted sheet is named.
    expect(container.textContent).not.toContain("never names");
    expect(container.textContent).not.toContain("never your profile");
  });
});

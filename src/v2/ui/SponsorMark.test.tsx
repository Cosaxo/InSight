// @vitest-environment jsdom
//
// The disclosure on a sponsored question (D195; buyer model D228). Four
// of these are the house rule made executable rather than promised:
//
//   1. The word PAID is ALWAYS on screen — not behind the tap, not
//      behind a hover, not abbreviated away. The buyer's NAME rides
//      beside it when the buyer chose to wear one (D228 made it their
//      choice — individuals buy questions too); the fact of payment is
//      the app's disclosure and is never theirs to decline.
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
import SponsorMark, { SponsorLink } from "./SponsorMark";

afterEach(cleanup);

describe("what is always visible", () => {
  it("shows PAID, the buyer and the window without any interaction", () => {
    render(<SponsorMark sponsor={{ buyer: "Ruter" }} until="2026-08-21" />);
    expect(screen.getByText("PAID")).toBeTruthy();
    expect(screen.getByText("Ruter")).toBeTruthy();
    expect(screen.getByText(/until 21 Aug/)).toBeTruthy();
  });

  it("still shows PAID when the buyer bought namelessly (D228)", () => {
    render(<SponsorMark sponsor={{}} until="2026-08-21" />);
    expect(screen.getByText("PAID")).toBeTruthy();
    expect(screen.getByText(/until 21 Aug/)).toBeTruthy();
    // No invented identity — the band simply carries no name, and the
    // expanded copy says "The buyer", a noun rather than a pseudonym.
    fireEvent.click(screen.getByText("PAID"));
    expect(screen.getByText(/The buyer asked everyone/)).toBeTruthy();
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

  it("names EVERY tag of a compounded cohort (D228)", () => {
    // Three dims is the widened cap, and the whole coarseness argument
    // is that each one prints — a compounded audience the band names
    // only half of would be targeting wearing a disclosure.
    render(<SponsorMark
      sponsor={{ buyer: "Ruter", audience: { gender: "Man", ageBand: "25-34", country: "US" } }}
      until="2026-08-21"
    />);
    fireEvent.click(screen.getByText("PAID"));
    expect(screen.getByText(/Gender: Man · Age: 25-34 · Country: US/)).toBeTruthy();
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

describe("the buyer's link, after the answer (D378)", () => {
  it("is the bare domain, a plain anchor to the browser, with no referrer and the address verbatim", () => {
    render(<SponsorLink link="https://www.harboursauna.no/winter?season=2026" />);
    const a = screen.getByRole("link", { name: /harboursauna\.no/ }) as HTMLAnchorElement;
    expect(a.getAttribute("href")).toBe("https://www.harboursauna.no/winter?season=2026");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toMatch(/noreferrer/);
    expect(a.textContent).toMatch(/harboursauna\.no ↗/);
    expect(a.textContent).not.toMatch(/winter|season/);
    // the word PAID rides with it: the link is the paid card's, not the app's
    expect(a.textContent).toMatch(/PAID/);
  });

  it("renders nothing for a link that is not an https address", () => {
    const { container } = render(<SponsorLink link="http://harboursauna.no" />);
    expect(container.querySelector("a")).toBeNull();
    const none = render(<SponsorLink link={undefined} />);
    expect(none.container.querySelector("a")).toBeNull();
  });
});

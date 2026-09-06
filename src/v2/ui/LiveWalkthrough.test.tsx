// @vitest-environment jsdom
//
// The first-launch walkthrough (D389): the claims the screen makes,
// pinned as claims rather than as sentences (docs/COPY.md §4), and every
// way through it.
//
//   1. IT SAYS ANSWERS ARE PUBLIC, AND SAYS IT LAST. Its one claim about
//      who can see what is the account panel's sentence (D183) and
//      web/privacy.html's — the fact CLAUDE.md says a user must not learn
//      from a stranger quoting a vote back. A walkthrough that dropped it
//      would be the app's first screen leaving out the one that matters.
//   2. IT DOES NOT TEASE THE PATTERNS TAB. D265 mounts that tab on the
//      data — "no third button, no teaser" — and a page about a tab that
//      is not in the bar is a teaser with more words.
//   3. IT NAMES THE CONTROLS BY THEIR OWN NAMES: the daily's three stops
//      and the Mirror's seven, so a rename there and not here fails.
//   4. EVERY BUTTON REPORTS, AND NO GESTURE DOES. Skip, Escape and the
//      last page's Start call onDone; a swipe or an arrow key past the
//      last page does not — a gesture is not a commit.
//
// The gate that decides whether any of this is shown, and the flag it
// writes, are walkthrough.test.tsx's; this file renders the screen alone.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const { default: LiveWalkthrough } = await import("./LiveWalkthrough");

const onDone = vi.fn();
beforeEach(() => { onDone.mockClear(); });
afterEach(cleanup);

const dialog = () => screen.getByRole("dialog", { name: /How InSight works/i });
const title = () => screen.getByRole("heading", { level: 2 }).textContent || "";
const next = () => fireEvent.click(screen.getByRole("button", { name: /^Next$/ }));
const text = () => dialog().textContent || "";

/** Every page's text, walked with Next; leaves the screen on the last page. */
function walkAll(): string[] {
  const pages = [text()];
  for (let i = 0; i < 8 && screen.queryByRole("button", { name: /^Next$/ }); i++) {
    next();
    pages.push(text());
  }
  return pages;
}

function swipe(dx: number, dy = 0) {
  const at = (x: number, y: number) => [{ clientX: x, clientY: y }];
  fireEvent.touchStart(dialog(), { touches: at(200, 400) });
  fireEvent.touchEnd(dialog(), { changedTouches: at(200 + dx, 400 + dy) });
}

describe("what it is", () => {
  it("opens on the first page as a labelled modal dialog, with nowhere to go back to", () => {
    render(<LiveWalkthrough onDone={onDone} />);
    const d = dialog();
    expect(d.getAttribute("aria-modal")).toBe("true");
    expect(title()).toMatch(/one question a day/i);
    expect(screen.queryByRole("button", { name: /^Back$/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Next$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Skip$/ })).toBeTruthy();
  });

  it("walks forward with Next and back with Back, and ends on Start", () => {
    render(<LiveWalkthrough onDone={onDone} />);
    const first = title();
    next();
    expect(title()).not.toBe(first);
    fireEvent.click(screen.getByRole("button", { name: /^Back$/ }));
    expect(title()).toBe(first);

    const pages = walkAll();
    expect(pages.length).toBeGreaterThan(3);
    expect(screen.getByRole("button", { name: /^Start$/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Next$/ })).toBeNull();
    // The skip line is hidden on the last page rather than removed, so
    // the button row stays put — and hidden means out of the Tab cycle.
    expect(screen.queryByRole("button", { name: /^Skip$/ })).toBeNull();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("re-opened from the account panel, the last page says Done", () => {
    render(<LiveWalkthrough onDone={onDone} again />);
    walkAll();
    expect(screen.getByRole("button", { name: /^Done$/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Start$/ })).toBeNull();
  });
});

describe("what it claims", () => {
  it("says answers are public, under your name — on the last page", () => {
    render(<LiveWalkthrough onDone={onDone} />);
    const pages = walkAll();
    const lastPage = pages[pages.length - 1];
    expect(lastPage).toMatch(/answers are public/i);
    expect(lastPage).toMatch(/under your name/i);
    // …and nowhere does it say the opposite, in the retired model's words
    // (check:public-copy reads the source; this reads the render).
    for (const p of pages) expect(p).not.toMatch(/answers? (are|is) (private|owner-only)/i);
  });

  it("names the daily's three stops and the Mirror's seven, by their own names", () => {
    render(<LiveWalkthrough onDone={onDone} />);
    const pages = walkAll();
    const reach = pages.find((p) => /1v1/.test(p));
    expect(reach, "no page names the 1v1 stop").toBeTruthy();
    for (const stop of ["World", "Circle", "1v1"]) expect(reach).toContain(stop);
    // Sealed until the reveal is web/privacy.html's D5 row, in the
    // duel panel's own words ("sealed until tomorrow").
    expect(reach).toMatch(/sealed until tomorrow/i);

    const mirror = pages.find((p) => /The Mirror/.test(p));
    expect(mirror, "no page is the Mirror's").toBeTruthy();
    for (const stop of ["You", "Circle", "Groups", "Near", "City", "Country", "World"]) expect(mirror).toContain(stop);
  });

  it("says what an answer carries — the three anchors the questions ask for", () => {
    render(<LiveWalkthrough onDone={onDone} />);
    const carry = walkAll().find((p) => /carries you/i.test(p)) || "";
    expect(carry).toMatch(/city/i);
    expect(carry).toMatch(/age/i);
    expect(carry).toMatch(/field/i);
  });

  it("does not tease the Patterns tab (D265)", () => {
    render(<LiveWalkthrough onDone={onDone} />);
    for (const p of walkAll()) expect(p).not.toMatch(/pattern/i);
  });
});

describe("every way out", () => {
  it("Skip reports done from the first page", () => {
    render(<LiveWalkthrough onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: /^Skip$/ }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("Escape reports done", () => {
    render(<LiveWalkthrough onDone={onDone} />);
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("Start reports done from the last page, and only a button does", () => {
    render(<LiveWalkthrough onDone={onDone} />);
    walkAll();
    // A swipe past the end and an arrow past the end both stay put.
    swipe(-120);
    fireEvent.keyDown(dialog(), { key: "ArrowRight" });
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^Start$/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Start$/ }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe("the sideways axis", () => {
  it("a swipe left turns the page and a swipe right turns it back", () => {
    render(<LiveWalkthrough onDone={onDone} />);
    const first = title();
    swipe(-120);
    expect(title()).not.toBe(first);
    swipe(120);
    expect(title()).toBe(first);
  });

  it("a wobble is not a turn — short, or more down than across", () => {
    render(<LiveWalkthrough onDone={onDone} />);
    const first = title();
    swipe(-30);
    expect(title()).toBe(first);
    swipe(-80, 120);
    expect(title()).toBe(first);
  });

  it("the arrow keys page too", () => {
    render(<LiveWalkthrough onDone={onDone} />);
    const first = title();
    fireEvent.keyDown(dialog(), { key: "ArrowRight" });
    expect(title()).not.toBe(first);
    fireEvent.keyDown(dialog(), { key: "ArrowLeft" });
    expect(title()).toBe(first);
    // …and left from the first page stays on it rather than wrapping.
    fireEvent.keyDown(dialog(), { key: "ArrowLeft" });
    expect(title()).toBe(first);
  });
});

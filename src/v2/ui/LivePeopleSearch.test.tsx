// @vitest-environment jsdom
//
// The people section of search, in a live build (D231).
//
// It rendered EMPTY for the whole life of live mode — `samplePeople ===
// false` returns `[]` in search-overlay.jsx, guarding D1's invented cast
// — so the app could add somebody to a circle by handle and could not
// look anybody up. What these hold is the pair of properties that makes
// the fix affordable and honest: the registry is read at most once per
// settled query (it is a billed read, and a handle is valid several
// characters before it is finished), and a handle nobody holds says so
// rather than rendering an empty section that looks like a bug.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const LIVE = vi.hoisted(() => ({
  uid: "u_me" as string | null,
  subscribe: (fn: () => void) => { void fn; return () => {}; },
  circle: () => null as Array<{ uid: string; name: string }> | null,
  loadCircle: vi.fn(async () => {}),
  isFollowing: (uid: string) => { void uid; return false; },
  setFollowing: vi.fn(async (uid: string, on: boolean) => { void uid; void on; }),
  nameFor: (uid: string) => ({ u_ada: "Ada Lovelace", u_me: "Me" }[uid] || ""),
  faceFor: (uid: string) => { void uid; return ""; },
  loadNames: vi.fn(async (uids: readonly string[]) => { void uids; }),
  social: { whoIs: vi.fn(async (h: string) => { void h; return null as string | null; }) },
}));

vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LivePeopleSearch } = await import("./LivePeopleSearch");
const { livePeopleActive } = await import("./peopleSearch");

beforeEach(() => {
  LIVE.uid = "u_me";
  LIVE.circle = () => null;
  LIVE.isFollowing = () => false;
  LIVE.social.whoIs = vi.fn(async () => null);
  LIVE.loadNames = vi.fn(async () => {});
  LIVE.loadCircle = vi.fn(async () => {});
  LIVE.setFollowing = vi.fn(async () => {});
});
afterEach(cleanup);

describe("LivePeopleSearch · finding somebody by handle", () => {
  it("draws nothing at all when there is nothing to draw", () => {
    const { container } = render(<LivePeopleSearch query="" />);
    expect(container.firstChild, "an empty section still took the screen").toBeNull();
  });

  it("resolves the handle and draws the person, with a way to follow them", async () => {
    LIVE.social.whoIs = vi.fn(async () => "u_ada");
    render(<LivePeopleSearch query="@Ada" />);
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
    // Canonical on the way out: the registry is keyed on the fold, so
    // sending "@Ada" would look up a handle nobody holds.
    expect(LIVE.social.whoIs).toHaveBeenCalledWith("ada");
    expect(screen.getByText("@ada")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Follow$/ })).toBeTruthy();
  });

  // The registry stores a uid and nothing else, so the name is a second
  // read. Without it the row renders "Someone" — which is worse than no
  // row, because it looks like the account has no name.
  it("fetches the name behind the uid", async () => {
    LIVE.social.whoIs = vi.fn(async () => "u_ada");
    render(<LivePeopleSearch query="ada" />);
    await waitFor(() => expect(LIVE.loadNames).toHaveBeenCalledWith(["u_ada"]));
  });

  it("says nobody holds a handle rather than showing an empty section", async () => {
    render(<LivePeopleSearch query="ghost" />);
    expect(await screen.findByText(/No account is @ghost/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Follow$/ })).toBeNull();
  });

  // A BILLED READ PER LOOKUP, and "olafsen" is five valid handles on the
  // way to one. Typing a name must cost one read, not one per keystroke.
  it("looks up once for a query that is still being typed", async () => {
    const whoIs = vi.fn(async () => "u_ada");
    LIVE.social.whoIs = whoIs;
    const { rerender } = render(<LivePeopleSearch query="ada" />);
    rerender(<LivePeopleSearch query="adal" />);
    rerender(<LivePeopleSearch query="adalo" />);
    rerender(<LivePeopleSearch query="adalovelace" />);
    await waitFor(() => expect(whoIs).toHaveBeenCalled());
    expect(whoIs).toHaveBeenCalledTimes(1);
    expect(whoIs).toHaveBeenCalledWith("adalovelace");
  });

  // Two characters cannot be a handle, and the registry must not be asked
  // whether they are.
  it("never asks the registry about something that cannot be a handle", async () => {
    render(<LivePeopleSearch query="ad" />);
    await new Promise((r) => setTimeout(r, 350));
    expect(LIVE.social.whoIs).not.toHaveBeenCalled();
  });

  it("names you as you instead of offering to follow yourself", async () => {
    LIVE.social.whoIs = vi.fn(async () => "u_me");
    render(<LivePeopleSearch query="olaf" />);
    expect(await screen.findByText("you")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Follow$/ })).toBeNull();
  });
});

describe("LivePeopleSearch · the follows already in memory", () => {
  const MINE = [{ uid: "u_ada", name: "Ada Lovelace" }, { uid: "u_bea", name: "Bea" }];

  it("filters them locally, and never pays for the fold to do it", async () => {
    LIVE.circle = () => MINE;
    render(<LivePeopleSearch query="bea" />);
    expect(await screen.findByText("Bea")).toBeTruthy();
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    // loadCircle is the per-member answer fan-out — one read per follow.
    // A search field is not where to spend it.
    expect(LIVE.loadCircle, "the search box paid for the circle fold").not.toHaveBeenCalled();
  });

  it("lists them all with no query", () => {
    LIVE.circle = () => MINE;
    render(<LivePeopleSearch query="" />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Bea")).toBeTruthy();
    // Not "Friends": this list is the follow graph, and calling it
    // friendship would be a claim about people the app cannot make.
    expect(screen.getByText("Following")).toBeTruthy();
  });

  // One person, one row. The handle resolves to somebody already listed
  // above, and drawing them twice reads as two accounts.
  it("does not draw somebody twice for matching both ways", async () => {
    LIVE.circle = () => MINE;
    LIVE.social.whoIs = vi.fn(async () => "u_ada");
    render(<LivePeopleSearch query="ada" />);
    await waitFor(() => expect(LIVE.social.whoIs).toHaveBeenCalled());
    expect(screen.getAllByText("Ada Lovelace")).toHaveLength(1);
  });
});

// The caller's half. search-overlay.jsx prints "nothing found" from its
// own lists, and in a live build its people list is ALWAYS empty — so
// without this predicate, searching a handle that resolves would print
// "nothing for @ada" directly above Ada.
describe("livePeopleActive", () => {
  it("is true for anything that could be a handle, before the lookup returns", () => {
    expect(livePeopleActive("ada")).toBe(true);
    expect(livePeopleActive("@ada")).toBe(true);
  });

  it("is true when a follow already in memory matches", () => {
    LIVE.circle = () => [{ uid: "u_ada", name: "Ada Lovelace" }];
    expect(livePeopleActive("love")).toBe(true);
  });

  it("is false for a query that is neither", () => {
    expect(livePeopleActive("ad")).toBe(false);
    expect(livePeopleActive("what is love")).toBe(false);
  });

  it("is false for an empty query with nothing followed", () => {
    expect(livePeopleActive("")).toBe(false);
  });
});

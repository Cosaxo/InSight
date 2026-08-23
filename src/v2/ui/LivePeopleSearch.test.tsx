// @vitest-environment jsdom
//
// The people section of search, in a live build (D231, D233).
//
// It rendered empty for the whole life of live mode, so the app could add
// somebody to a circle by handle and could not look anybody up. What
// these hold is the pair of properties that makes the fix affordable and
// honest: the reads are bounded and settle before they fire, and a
// section with nothing to draw gets out of the way rather than printing
// its own "nothing found" over the overlay's.

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
  social: {
    whoIs: vi.fn(async (h: string) => { void h; return null as string | null; }),
    searchPeople: vi.fn(async (q: string) => {
      void q;
      return [] as Array<{ uid: string; name: string; handle: string }>;
    }),
  },
}));

vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LivePeopleSearch } = await import("./LivePeopleSearch");

beforeEach(() => {
  LIVE.uid = "u_me";
  LIVE.circle = () => null;
  LIVE.isFollowing = () => false;
  LIVE.social.whoIs = vi.fn(async () => null);
  LIVE.social.searchPeople = vi.fn(async () => []);
  LIVE.loadNames = vi.fn(async () => {});
  LIVE.loadCircle = vi.fn(async () => {});
  LIVE.setFollowing = vi.fn(async () => {});
});
afterEach(cleanup);

describe("LivePeopleSearch · finding somebody", () => {
  it("draws nothing at all when there is nothing to draw", () => {
    const { container } = render(<LivePeopleSearch query="" />);
    expect(container.firstChild, "an empty section still took the screen").toBeNull();
  });

  // THE POINT OF D233. Before it, this query returned nothing: names
  // were not searchable, only the exact handle was.
  it("finds people by name", async () => {
    LIVE.social.searchPeople = vi.fn(async () => [
      { uid: "u_ada", name: "Ada Lovelace", handle: "ada" },
    ]);
    render(<LivePeopleSearch query="ada" />);
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
    expect(LIVE.social.searchPeople).toHaveBeenCalledWith("ada");
    expect(screen.getByRole("button", { name: /^Follow$/ })).toBeTruthy();
  });

  it("still finds them by exact handle, and folds the two into one row", async () => {
    LIVE.social.searchPeople = vi.fn(async () => [
      { uid: "u_ada", name: "Ada Lovelace", handle: "ada" },
    ]);
    LIVE.social.whoIs = vi.fn(async () => "u_ada");
    render(<LivePeopleSearch query="@ada" />);
    await waitFor(() => expect(LIVE.social.whoIs).toHaveBeenCalled());
    // Canonical on the way out — the registry is keyed on the fold.
    expect(LIVE.social.whoIs).toHaveBeenCalledWith("ada");
    expect(screen.getAllByText("Ada Lovelace"), "one person drew two rows").toHaveLength(1);
  });

  // The handle registry stores a uid and nothing else, so a hit that the
  // name search did not already carry needs its name fetched.
  it("fetches the name behind a handle-only hit", async () => {
    LIVE.social.whoIs = vi.fn(async () => "u_ada");
    render(<LivePeopleSearch query="ada" />);
    await waitFor(() => expect(LIVE.loadNames).toHaveBeenCalledWith(["u_ada"]));
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
  });

  // The overlay owns "nothing found" for the WHOLE search. A section that
  // printed its own would put "nobody called xyzzy" under a query that
  // was never about people.
  it("gets out of the way when nobody matches, and says so upward", async () => {
    const onActive = vi.fn();
    const { container } = render(<LivePeopleSearch query="xyzzy" onActive={onActive} />);
    await waitFor(() => expect(LIVE.social.searchPeople).toHaveBeenCalled());
    await waitFor(() => expect(container.firstChild).toBeNull());
    expect(onActive).toHaveBeenLastCalledWith(false);
  });

  it("reports upward the moment it has something", async () => {
    LIVE.social.searchPeople = vi.fn(async () => [
      { uid: "u_ada", name: "Ada Lovelace", handle: "ada" },
    ]);
    const onActive = vi.fn();
    render(<LivePeopleSearch query="ada" onActive={onActive} />);
    await waitFor(() => expect(onActive).toHaveBeenLastCalledWith(true));
  });

  it("names you as you instead of offering to follow yourself", async () => {
    LIVE.social.searchPeople = vi.fn(async () => [
      { uid: "u_me", name: "Me", handle: "olaf" },
    ]);
    render(<LivePeopleSearch query="me" />);
    expect(await screen.findByText("you")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Follow$/ })).toBeNull();
  });

  // Both reads are billed, and a name is valid from its first character.
  // Typing must cost one round trip, not one per keystroke.
  it("queries once for a name still being typed", async () => {
    const search = vi.fn(async () => []);
    LIVE.social.searchPeople = search;
    const { rerender } = render(<LivePeopleSearch query="a" />);
    rerender(<LivePeopleSearch query="ad" />);
    rerender(<LivePeopleSearch query="ada" />);
    rerender(<LivePeopleSearch query="adalovelace" />);
    await waitFor(() => expect(search).toHaveBeenCalled());
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith("adalovelace");
  });

  // Two characters cannot be a handle, so the registry must not be asked
  // — but they can be a name, so the directory must be.
  it("asks the directory but not the registry for a too-short query", async () => {
    render(<LivePeopleSearch query="ad" />);
    await waitFor(() => expect(LIVE.social.searchPeople).toHaveBeenCalledWith("ad"));
    expect(LIVE.social.whoIs).not.toHaveBeenCalled();
  });
});

describe("LivePeopleSearch · the follows already in memory", () => {
  const MINE = [{ uid: "u_ada", name: "Ada Lovelace" }, { uid: "u_bea", name: "Bea" }];

  it("lists them with no query, and never pays for the fold to do it", () => {
    LIVE.circle = () => MINE;
    render(<LivePeopleSearch query="" />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Bea")).toBeTruthy();
    // Not "Friends": this list is the follow graph, and calling it
    // friendship would be a claim about people the app cannot make.
    expect(screen.getByText("Following")).toBeTruthy();
    // loadCircle is the per-member answer fan-out — one read per follow.
    expect(LIVE.loadCircle, "the search box paid for the circle fold").not.toHaveBeenCalled();
  });

  // With a query the DIRECTORY answers, not the local list — otherwise
  //search would find your follows and nobody else, which is the gap D233
  // exists to close.
  it("hands a query to the directory rather than filtering follows", async () => {
    LIVE.circle = () => MINE;
    LIVE.social.searchPeople = vi.fn(async () => [
      { uid: "u_cy", name: "Cy", handle: "cy" },
    ]);
    render(<LivePeopleSearch query="cy" />);
    expect(await screen.findByText("Cy")).toBeTruthy();
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
  });
});

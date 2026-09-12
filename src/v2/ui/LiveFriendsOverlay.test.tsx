// @vitest-environment jsdom
//
// Your friends (VISION-2026-09-12 §2.3, D-2026-09-12d): one overlay over
// two stores. The demo half plays spec/follows.js's seeded people; the
// live half draws data/friends.ts's fold of D101's rows. What these hold
// is that each action reaches the store it should, that a live row offers
// no page it cannot honestly draw, that a suggestion never states a
// distance, and that the remove sheet's promise is kept by the call it
// makes.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const NAMES: Record<string, string> = { ada: "Ada Byron", bo: "Bo Lind", cy: "Cy Moen", dee: "Dee Aas", eve: "Eve Roy", fay: "Fay Berg" };
const LIVE = vi.hoisted(() => ({
  enabled: false,
  demoInProd: false,
  uid: "me" as string | null,
  follows: () => null as string[] | null,
  loadFollows: vi.fn(async () => {}),
  setFollowing: vi.fn(async (uid: string, on: boolean) => { void uid; void on; }),
  loadNames: vi.fn(async (uids: readonly string[]) => { void uids; }),
  nameFor: (uid: string): string => { void uid; return ""; },
  faceFor: (uid: string) => { void uid; return ""; },
  kindredPeople: () => [] as Array<{ uid: string; like: { pct: number } }>,
  circle: () => null as Array<{ uid: string; like: { pct: number } }> | null,
  near: { room: () => null as { people: Array<{ uid: string }> } | null },
  social: {
    groups: (kind?: string) => { void kind; return [] as Array<{ id: string; memberUids?: string[] }>; },
    leaveGroup: vi.fn(async (gid: string) => { void gid; }),
  },
  subscribe: () => () => {},
}));
vi.mock("../data/live", () => ({ default: LIVE }));
vi.mock("../../lib/firebase", () => ({ getDb: async () => ({}) }));
const GRAPH = vi.hoisted(() => ({ followers: [] as string[], following: {} as Record<string, string[]>, fail: false }));
vi.mock("../data/circle", () => ({
  FOLLOW_CAP: 50,
  fetchFollowers: async () => { if (GRAPH.fail) throw new Error("permission-denied"); return GRAPH.followers; },
  fetchFollowing: async (_db: unknown, uid: string) => GRAPH.following[uid] || [],
}));

const F = await import("../data/friends");
// @ts-expect-error TS7016 — untyped spec module
const { FRIENDS } = await import("../spec/follows.js");
const { default: LiveFriendsOverlay } = await import("./LiveFriendsOverlay");

beforeEach(() => {
  localStorage.clear();
  // The demo store reads its key at import; the purge is its reset.
  window.dispatchEvent(new Event("insight:local-purge"));
  F._resetFriendsForTest();
  LIVE.enabled = false;
  LIVE.demoInProd = false;
  LIVE.uid = "me";
  LIVE.follows = () => ["ada", "bo"];
  LIVE.nameFor = (uid: string) => NAMES[uid] || "";
  LIVE.kindredPeople = () => [];
  LIVE.circle = () => null;
  LIVE.near.room = () => null;
  LIVE.social.groups = () => [];
  LIVE.setFollowing = vi.fn(async () => {});
  LIVE.social.leaveGroup = vi.fn(async () => {});
  GRAPH.followers = ["bo", "cy"];
  GRAPH.following = { bo: ["dee"] };
  GRAPH.fail = false;
});
afterEach(cleanup);

const section = (label: string) => screen.getByText(label, { selector: ".search-group" });

describe("the demo — spec/follows.js", () => {
  it("lists the seeded requests, and Accept makes a friend while Ignore makes nothing", () => {
    render(<LiveFriendsOverlay onClose={() => {}} />);
    expect(section("Requests")).toBeTruthy();
    expect(screen.getByText("Ingrid Vold")).toBeTruthy(); // f5
    expect(screen.getByText("Jonas Borg")).toBeTruthy();  // f7
    const before = FRIENDS.count();
    fireEvent.click(screen.getAllByRole("button", { name: "Accept" })[0]);
    expect(FRIENDS.status("f5")).toBe("friends");
    expect(FRIENDS.count()).toBe(before + 1);
    fireEvent.click(screen.getByRole("button", { name: "Ignore request" }));
    expect(FRIENDS.status("f7")).toBe("none");
    expect(screen.queryByText("Jonas Borg")).toBeNull();
    expect(screen.queryByText("Requests", { selector: ".search-group" })).toBeNull();
  });

  it("offers suggestions four at a time, and Add moves a person to Invited where Cancel takes it back", () => {
    render(<LiveFriendsOverlay onClose={() => {}} />);
    const more = screen.getByRole("button", { name: /^Show \d+ more$/ });
    const addsBefore = screen.getAllByRole("button", { name: "Add" }).length;
    expect(addsBefore).toBe(4);
    fireEvent.click(more);
    expect(screen.getAllByRole("button", { name: "Add" }).length).toBeGreaterThan(4);
    expect(screen.getByRole("button", { name: "Show fewer" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Add" })[0]);
    expect(FRIENDS.invitedList()).toHaveLength(1);
    const [id] = FRIENDS.invitedList();
    expect(section("Invited")).toBeTruthy();
    expect(screen.getByText("waiting for them to accept")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(FRIENDS.status(id)).toBe("none");
    expect(screen.queryByText("Invited", { selector: ".search-group" })).toBeNull();
  });

  it("dismisses a suggestion for good — it is not offered again", () => {
    render(<LiveFriendsOverlay onClose={() => {}} />);
    const names = screen.getAllByRole("button", { name: "Add" }).map((b) => b.parentElement?.parentElement?.textContent || "");
    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss suggestion" })[0]);
    expect(FRIENDS.dismissed()).toHaveLength(1);
    const after = screen.getAllByRole("button", { name: "Add" }).map((b) => b.parentElement?.parentElement?.textContent || "");
    expect(after).not.toContain(names[0]);
    expect(JSON.parse(localStorage.getItem("insight.friends.v1") || "{}").dismissed).toHaveLength(1);
  });

  it("a demo row opens the person page", () => {
    const onPerson = vi.fn();
    render(<LiveFriendsOverlay onClose={() => {}} onPerson={onPerson} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Henrik Vold" }));
    expect(onPerson).toHaveBeenCalledTimes(1);
    expect((onPerson.mock.calls[0] as [{ id: string }])[0].id).toBe("f1");
  });

  it("the remove sheet says what it does, and Remove does it", async () => {
    render(<LiveFriendsOverlay onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Options for Henrik" }));
    expect(screen.getByText("Remove Henrik?")).toBeTruthy();
    expect(screen.getByText(/any 1v1 you have together ends\. Henrik isn’t told\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    await waitFor(() => expect(screen.queryByText("Remove Henrik?")).toBeNull());
    expect(FRIENDS.isFriend("f1")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Options for Henrik" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(FRIENDS.isFriend("f1")).toBe(false);
    await waitFor(() => expect(screen.queryByText("Remove Henrik?")).toBeNull());
    // out of Friends — and back among the suggestions, which is the
    // "you can add them again later" the sheet promised
    expect(screen.queryByRole("button", { name: "Options for Henrik" })).toBeNull();
    expect(FRIENDS.list()).not.toContain("f1");
    expect(screen.getByText("Henrik Vold")).toBeTruthy();
  });

  it("the header is ← when opened from the profile and ✕ otherwise", () => {
    const onClose = vi.fn();
    const { unmount } = render(<LiveFriendsOverlay onClose={onClose} back />);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    render(<LiveFriendsOverlay onClose={onClose} />);
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });
});

describe("live — data/friends.ts over D101's rows", () => {
  beforeEach(() => { LIVE.enabled = true; });

  it("draws the four lists off the rows, names people, and offers no page for a live row", async () => {
    render(<LiveFriendsOverlay onClose={() => {}} onPerson={vi.fn()} />);
    // What is in hand draws at once — the follow set is cached, so the two
    // I follow are on screen as Invited before the followers read answers
    // and sorts Bo into Friends. No "reading" line over rows.
    expect(screen.queryByRole("status")).toBeNull();
    await screen.findByText("Cy Moen");
    expect(section("Requests")).toBeTruthy();
    expect(section("Invited")).toBeTruthy();
    expect(screen.getByText("Ada Byron")).toBeTruthy();
    expect(screen.getByText("waiting for them to accept")).toBeTruthy();
    expect(screen.getByText("Bo Lind")).toBeTruthy();
    expect(screen.getByText("Dee Aas")).toBeTruthy();
    expect(screen.getByText("through Bo")).toBeTruthy();
    // no row is a door: the person page would invent what it compares
    expect(screen.queryAllByRole("button", { name: /^Open / })).toHaveLength(0);
    expect(screen.queryByText(/Reading your friends/)).toBeNull();
  });

  it("a live build mid-boot draws NOBODY rather than the demo's invented people", async () => {
    // `LIVE.enabled` is false for TWO reasons (D356): this is the demo
    // build, or this is a LIVE build whose boot has not attached yet. Only
    // the first should ever see spec/follows.js's seeded roster. Reading
    // the flag as "is this the demo" put ~20 invented people into a real
    // person's *Your friends* — with an Add button, an initials avatar and
    // a line reading "a few streets away · 88 affinity", which is D1's
    // "no seeded fake users, ever" drawn on their own account, two taps
    // from first paint.
    //
    // app-shell.jsx:772 already guards the overlay one door over with
    // `!liveOn && !LIVE.demoInProd` and a measured note from 2026-09-11.
    // This is that reading, here.
    LIVE.enabled = false;
    LIVE.demoInProd = true;
    render(<LiveFriendsOverlay onClose={() => {}} onPerson={vi.fn()} />);
    await screen.findByText("Ada Byron");
    // "affinity" is the demo's own word for it — the live path says
    // "% alike" and never states a distance — so its absence is the
    // assertion that the demo roster did not draw.
    expect(screen.queryByText(/affinity/), "the demo roster drew on a live build").toBeNull();
    expect(screen.queryByText(/streets away/), "an invented distance reached a real user").toBeNull();
  });

  it("Accept is my follow row; Ignore is the device's own mirror", async () => {
    render(<LiveFriendsOverlay onClose={() => {}} />);
    await screen.findByText("Cy Moen");
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(LIVE.setFollowing).toHaveBeenCalledWith("cy", true);
    // ignore: the row stands, the list forgets
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Ignore request" })); });
    expect(screen.queryByText("Cy Moen")).toBeNull();
    expect(LIVE.setFollowing).toHaveBeenCalledTimes(1);
    expect(F.friendState("cy")).toBe("requested");
  });

  it("a suggestion says nearby now and how alike — never how far", async () => {
    LIVE.kindredPeople = () => [{ uid: "eve", like: { pct: 72.4 } }];
    LIVE.near.room = () => ({ people: [{ uid: "eve" }] });
    render(<LiveFriendsOverlay onClose={() => {}} />);
    await screen.findByText("Eve Roy");
    expect(screen.getByText("nearby now · 72% alike")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/streets|km|metres|away/i);
    fireEvent.click(screen.getAllByRole("button", { name: "Add" }).find((b) => b.closest("div")?.textContent?.includes("Eve")) as HTMLElement);
    expect(LIVE.setFollowing).toHaveBeenCalledWith("eve", true);
  });

  it("a failed read says so and offers to try again, rather than drawing nobody", async () => {
    GRAPH.fail = true;
    render(<LiveFriendsOverlay onClose={() => {}} />);
    await screen.findByText(/Couldn’t read who follows you/);
    expect(screen.queryByText(/No friends yet/)).toBeNull();
    GRAPH.fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Bo Lind");
    expect(screen.queryByText(/Couldn’t read/)).toBeNull();
  });

  it("removing a friend leaves the 1v1 we had and drops my row — nothing is sent to them", async () => {
    LIVE.social.groups = (kind?: string) => (kind === "duo" ? [{ id: "g-us", memberUids: ["me", "bo"] }] : []);
    render(<LiveFriendsOverlay onClose={() => {}} />);
    await screen.findByText("Bo Lind");
    fireEvent.click(screen.getByRole("button", { name: "Options for Bo" }));
    expect(screen.getByText("Remove Bo?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(LIVE.setFollowing).toHaveBeenCalledWith("bo", false));
    expect(LIVE.social.leaveGroup).toHaveBeenCalledWith("g-us");
  });

  it("with no rows at all it says so, once the read has answered", async () => {
    LIVE.follows = () => [];
    GRAPH.followers = [];
    render(<LiveFriendsOverlay onClose={() => {}} />);
    // nothing in hand: the read is named while it runs, then the empty state
    expect(screen.getByRole("status").textContent).toMatch(/Reading your friends/);
    await screen.findByText(/No friends yet/);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("Requests", { selector: ".search-group" })).toBeNull();
  });
});

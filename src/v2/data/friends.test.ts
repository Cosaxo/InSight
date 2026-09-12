// @vitest-environment jsdom
//
// Friends on D101's rows (VISION-2026-09-12 §2, D-2026-09-12a). What these
// hold: the four states are the two follow rows read both ways and nothing
// else; the four lists partition those rows; a suggestion comes from a
// source that already publishes and never repeats a person; ignore and
// dismiss are the viewer's own mirror and leave the rows alone; a failed
// read says so rather than drawing an empty list; unfriend does what the
// remove sheet says (the row and the 1v1 go); the purge clears the mirror.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  uid: "me" as string | null,
  follows: () => null as string[] | null,
  loadFollows: vi.fn(async () => {}),
  setFollowing: vi.fn(async (uid: string, on: boolean) => { void uid; void on; }),
  loadNames: vi.fn(async (uids: readonly string[]) => { void uids; }),
  nameFor: (uid: string) => { void uid; return ""; },
  kindredPeople: () => [] as Array<{ uid: string; like: { pct: number } }>,
  near: { room: () => null as { people: Array<{ uid: string }> } | null },
  social: {
    groups: (kind?: string) => { void kind; return [] as Array<{ id: string; memberUids?: string[] }>; },
    leaveGroup: vi.fn(async (gid: string) => { void gid; }),
  },
  subscribe: () => () => {},
}));
vi.mock("./live", () => ({ default: LIVE }));
vi.mock("../../lib/firebase", () => ({ getDb: async () => ({}) }));

const GRAPH = vi.hoisted(() => ({
  followers: [] as string[],
  following: {} as Record<string, string[]>,
  fail: false,
  followersReads: 0,
}));
vi.mock("./circle", () => ({
  FOLLOW_CAP: 50,
  fetchFollowers: async () => {
    GRAPH.followersReads += 1;
    if (GRAPH.fail) throw new Error("permission-denied");
    return GRAPH.followers;
  },
  fetchFollowing: async (_db: unknown, uid: string) => GRAPH.following[uid] || [],
}));

const F = await import("./friends");

beforeEach(() => {
  localStorage.clear();
  F._resetFriendsForTest();
  LIVE.enabled = true;
  LIVE.uid = "me";
  LIVE.follows = () => ["ada", "bo"];
  LIVE.kindredPeople = () => [];
  LIVE.near.room = () => null;
  LIVE.social.groups = () => [];
  LIVE.setFollowing = vi.fn(async () => {});
  LIVE.loadNames = vi.fn(async () => {});
  LIVE.social.leaveGroup = vi.fn(async () => {});
  GRAPH.followers = ["bo", "cy"];
  GRAPH.following = { bo: ["dee", "ada", "me", "cy"] };
  GRAPH.fail = false;
  GRAPH.followersReads = 0;
});
afterEach(() => vi.restoreAllMocks());

describe("friendState — the two rows read both ways", () => {
  it("answers none before the followers are read, and all four after", async () => {
    // Before the read the OTHER direction is unknown, so my row alone
    // can only say invited; nothing is called friends on a guess.
    expect(F.friendState("bo")).toBe("invited");
    expect(F.friendState("cy")).toBe("none");
    await F.loadFriends();
    expect(F.friendState("bo")).toBe("friends");   // both rows
    expect(F.friendState("ada")).toBe("invited");  // mine only
    expect(F.friendState("cy")).toBe("requested"); // theirs only
    expect(F.friendState("dee")).toBe("none");     // neither
    expect(F.friendState("me")).toBe("none");      // never yourself
  });
});

describe("friendsView — four lists off the rows, suggestions off what publishes", () => {
  it("partitions the rows and reads the followers exactly once", async () => {
    await F.loadFriends();
    await F.loadFriends(); // idempotent while cached
    expect(GRAPH.followersReads).toBe(1);
    const v = F.friendsView();
    expect(v.friends).toEqual(["bo"]);
    expect(v.invited).toEqual(["ada"]);
    expect(v.requests).toEqual(["cy"]);
    expect(v.failed).toBe(false);
    expect(v.loading).toBe(false);
    // the names batch asked for everyone the lists and the suggestions name, never me
    const asked = (LIVE.loadNames.mock.calls[0] as [string[]])[0];
    expect([...asked].sort()).toEqual(["ada", "bo", "cy", "dee"]);
  });

  it("suggests through a friend first, then by agreement, each person once, never me or anyone listed", async () => {
    LIVE.kindredPeople = () => [{ uid: "eve", like: { pct: 72.4 } }, { uid: "dee", like: { pct: 60.2 } }, { uid: "bo", like: { pct: 90 } }];
    LIVE.near.room = () => ({ people: [{ uid: "fay" }, { uid: "eve" }, { uid: "me" }] });
    await F.loadFriends();
    const s = F.friendsView().suggested;
    expect(s.map((x) => x.uid)).toEqual(["dee", "eve", "fay"]);
    expect(s[0]).toEqual({ uid: "dee", via: "bo", like: 60, near: false });
    expect(s[1]).toEqual({ uid: "eve", via: null, like: 72, near: true });
    // Near says PRESENT, and that is all it says (D98's presence deny).
    expect(s[2]).toEqual({ uid: "fay", via: null, like: null, near: true });
    expect(Object.keys(s[2])).not.toContain("dist");
  });

  it("ignore and dismiss hide a person from the lists without touching their row, and survive a reload", async () => {
    LIVE.kindredPeople = () => [{ uid: "eve", like: { pct: 70 } }];
    await F.loadFriends();
    F.ignore("cy");
    F.dismiss("eve");
    const v = F.friendsView();
    expect(v.requests).toEqual([]);
    expect(v.suggested.map((x) => x.uid)).toEqual(["dee"]);
    expect(F.isHidden("cy")).toBe(true);
    // the row still stands: the STATE reads rows, the LISTS read the mirror
    expect(F.friendState("cy")).toBe("requested");
    expect(JSON.parse(localStorage.getItem("insight.friendsHidden.v1") || "[]").sort()).toEqual(["cy", "eve"]);
    expect(LIVE.setFollowing).not.toHaveBeenCalled();
  });

  it("says a failed read failed instead of drawing nobody, and reads again on force", async () => {
    GRAPH.fail = true;
    await F.loadFriends();
    let v = F.friendsView();
    expect(v.failed).toBe(true);
    expect(v.requests).toEqual([]);
    expect(v.friends).toEqual([]);
    GRAPH.fail = false;
    await F.loadFriends(true);
    v = F.friendsView();
    expect(v.failed).toBe(false);
    expect(v.friends).toEqual(["bo"]);
    expect(GRAPH.followersReads).toBe(2);
  });

  it("reads nothing while signed out or off", async () => {
    LIVE.enabled = false;
    await F.loadFriends();
    expect(GRAPH.followersReads).toBe(0);
    LIVE.enabled = true;
    LIVE.uid = null;
    await F.loadFriends();
    expect(GRAPH.followersReads).toBe(0);
  });
});

describe("the writes — one row each, the way D101 already allows", () => {
  it("invite and accept are the same follow; cancel is its delete", async () => {
    await F.invite("dee");
    expect(LIVE.setFollowing).toHaveBeenLastCalledWith("dee", true);
    await F.invite("cy"); // accepting a request: my row, which completes the pair
    expect(LIVE.setFollowing).toHaveBeenLastCalledWith("cy", true);
    await F.cancel("ada");
    expect(LIVE.setFollowing).toHaveBeenLastCalledWith("ada", false);
  });

  it("unfriend drops my row and leaves the 1v1 we had, and only that room", async () => {
    LIVE.social.groups = (kind?: string) => (kind === "duo"
      ? [{ id: "g-us", memberUids: ["bo", "me"] }, { id: "g-them", memberUids: ["me", "ada"] }, { id: "g-three", memberUids: ["me", "bo", "ada"] }]
      : []);
    expect(F.duoWith("bo")).toBe("g-us");
    expect(F.duoWith("ada")).toBe("g-them");
    expect(F.duoWith("dee")).toBeNull();
    await F.unfriend("bo");
    expect(LIVE.social.leaveGroup).toHaveBeenCalledTimes(1);
    expect(LIVE.social.leaveGroup).toHaveBeenCalledWith("g-us");
    expect(LIVE.setFollowing).toHaveBeenLastCalledWith("bo", false);
  });

  it("unfriend with no 1v1 touches no room, and a room that refuses still lets the row go", async () => {
    await F.unfriend("dee");
    expect(LIVE.social.leaveGroup).not.toHaveBeenCalled();
    expect(LIVE.setFollowing).toHaveBeenLastCalledWith("dee", false);
    LIVE.social.groups = () => [{ id: "g-us", memberUids: ["bo", "me"] }];
    LIVE.social.leaveGroup = vi.fn(async () => { throw new Error("offline"); });
    await F.unfriend("bo");
    expect(LIVE.setFollowing).toHaveBeenLastCalledWith("bo", false);
  });
});

describe("the purge (D51)", () => {
  it("empties the hidden mirror and the read, so the next account inherits neither", async () => {
    await F.loadFriends();
    F.ignore("cy");
    expect(localStorage.getItem("insight.friendsHidden.v1")).not.toBeNull();
    const heard = vi.fn();
    const off = F.subscribeFriends(heard);
    // The wipe itself removes every insight.* key BEFORE it dispatches
    // (live.ts, D51); the listener's job is to forget in memory without
    // writing the key back.
    localStorage.clear();
    window.dispatchEvent(new Event("insight:local-purge"));
    off();
    expect(heard).toHaveBeenCalled();
    expect(F.isHidden("cy")).toBe(false);
    expect(F.friendState("cy")).toBe("none"); // the followers read is gone with it
    expect(localStorage.getItem("insight.friendsHidden.v1")).toBeNull(); // not re-created
  });
});

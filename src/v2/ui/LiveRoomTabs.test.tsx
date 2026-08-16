// @vitest-environment jsdom
//
// The Near stop's three tab bodies (D176).
//
// The claims worth a case here are the ones that are new to this stop
// rather than inherited: Answers and Compare are the SAME components the
// cohort stops use, so their arithmetic is already pinned next door — what
// is new is that the data arrives over a wire from a fold no device can
// check, and that People discloses something no Mirror surface has
// disclosed before.
//
// So: the three states of a read that can fail, and the two rules People
// is built to keep.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const LIVE = vi.hoisted(() => {
  const deck = [{
    id: "a", cat: null, text: "Would you rather know, or be known?",
    dayLabel: "Today",
    options: [{ id: "0", label: "Know", count: 0, color: "" },
      { id: "1", label: "Be known", count: 0, color: "" }],
    comments: [], friends: [], live: true, noCountsYet: false,
    branch: "Mind", type: "binary", coreCorpus: true,
  }];
  return {
    enabled: true,
    uid: "u_me",
    subscribe: () => () => {},
    deck: () => deck,
    myVotes: () => ({ a: "0" }) as Record<string, string>,
    myTestResults: () => ({}) as Record<string, unknown>,
    loadNames: vi.fn(async () => {}),
    nameFor: (uid: string) => ({ u1: "Ada Lovelace", u2: "" }[uid] ?? ""),
    scoresFor: () => null as Record<string, Record<string, number>> | null,
    // D177. No face by default: initials are the permanent fallback, so
    // that is the shape most rows have.
    faceFor: ((uid: string) => (uid ? "" : "")) as (uid: string) => string,
    flagAvatar: vi.fn(async () => {}),
    flaggedAvatar: () => false as boolean,
    near: {
      room: () => null as { people: Array<{ uid: string; type?: string }>;
        qs: Record<string, Record<string, number>> } | null,
      roomLoading: () => false as boolean,
      loadRoom: vi.fn(async () => {}),
    },
  };
});
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LiveRoomTabs } = await import("./LiveRoomTabs");

// The photo URL is built from build config, so a test run has none — and
// without it every face falls back to initials, which would make the D177
// cases below pass for the wrong reason.
beforeAll(() => { vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "b.appspot.com"); });
afterAll(() => { vi.unstubAllEnvs(); });

beforeEach(() => {
  LIVE.near.room = () => null;
  LIVE.near.roomLoading = () => false;
  LIVE.scoresFor = () => null;
  LIVE.faceFor = () => "";
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("LiveRoomTabs · a fold that can fail, in three states", () => {
  // The distinction this file exists for. Near's cohort is a set of
  // phones and presence is unreadable, so unlike every other stop there
  // is no local copy to fall back on — which makes "the read failed" and
  // "the room is empty" two states with the same absence behind them.
  it("says it is reading while the fold is in flight", () => {
    LIVE.near.roomLoading = () => true;
    render(<LiveRoomTabs tab="people" />);
    expect(screen.getByText(/Reading the room/i)).toBeTruthy();
    expect(screen.queryByText(/Nobody else has Near on/i)).toBeNull();
  });

  it("calls a FAILED fold a failure, not an empty room", () => {
    // Drawing "nobody is here" for a read that broke would tell somebody
    // standing at a full party that they are alone — the same class of
    // lie LiveCircleBody's failed-circle arm exists to prevent.
    render(<LiveRoomTabs tab="people" />);
    expect(screen.getByText(/Couldn’t read the room/i)).toBeTruthy();
    expect(screen.queryByText(/Nobody else has Near on/i)).toBeNull();
  });

  it("only calls a settled, empty roster an empty room", () => {
    LIVE.near.room = () => ({ people: [], qs: {} });
    render(<LiveRoomTabs tab="people" />);
    expect(screen.getByText(/Nobody else has Near on/i)).toBeTruthy();
    expect(screen.queryByText(/Couldn’t read/i)).toBeNull();
  });
});

describe("LiveRoomTabs · People, the one tab that discloses something new", () => {
  beforeEach(() => {
    LIVE.near.room = () => ({
      people: [{ uid: "u1", type: "Host" }, { uid: "u2" }],
      qs: { a: { "0": 3, "1": 1 } },
    });
  });

  it("names who is here, and calls an unnamed account somebody", () => {
    render(<LiveRoomTabs tab="people" />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    // An account that never set a display name is still a person in the
    // room; an empty row would read as a rendering fault.
    expect(screen.getByText("Someone")).toBeTruthy();
    // The archetype rides the presence doc (D175's `type`), so a phone
    // that never took the test simply has no badge — not a blank one.
    expect(screen.getByText("Host")).toBeTruthy();
  });

  it("prints no match percentage when there is nothing to match on", () => {
    // D72's rule: null rather than a gate at each call site, so a
    // consumer that forgets the check fails instead of fabricating. A 0%
    // here would read as "nothing in common" when it means "not
    // measured", and these are people the reader can see.
    render(<LiveRoomTabs tab="people" />);
    expect(document.body.textContent || "").not.toMatch(/\d+%/);
  });

  it("does not rank the room", () => {
    // The field above this row places people by likeness because that is
    // a reading. A LIST of people you can see, sorted best-match-first,
    // is a leaderboard of strangers in a bar — so the order stays the
    // server's arbitrary sample order.
    LIVE.scoresFor = () => ({ big5: { o: 90 } });
    LIVE.myTestResults = () => ({ big5: { o: 10 } });
    render(<LiveRoomTabs tab="people" />);
    // getAllByText matches on a node's OWN text, so this is the name spans
    // and not their wrappers — document order is render order.
    const names = screen.getAllByText(/^(Ada Lovelace|Someone)$/)
      .map((el) => el.textContent);
    expect(names).toEqual(["Ada Lovelace", "Someone"]);
  });

  it("resolves the roster's names in one batched call", () => {
    render(<LiveRoomTabs tab="people" />);
    expect(LIVE.loadNames).toHaveBeenCalledWith(["u1", "u2"]);
  });
});

describe("LiveRoomTabs · Answers and Compare read the room", () => {
  beforeEach(() => {
    LIVE.near.room = () => ({
      people: [{ uid: "u1" }],
      qs: { a: { "0": 3, "1": 1 } },
    });
  });

  it("puts the room's own counts under the room's own noun", () => {
    render(<LiveRoomTabs tab="answers" />);
    // The cohort noun matters as much as the number: D169's whole finding
    // was three lenses naming one population and reading another.
    expect(document.body.textContent || "").toMatch(/this room/i);
  });

  it("compares you against the room, not against everyone", () => {
    render(<LiveRoomTabs tab="compare" />);
    const text = document.body.textContent || "";
    expect(text).toMatch(/against this room/i);
    // 3 of 4 picked option 0 and so did the viewer, so the majority line
    // is about the ROOM's split — proof the counts crossing the wire are
    // the ones being read.
    expect(text).toMatch(/75% here agreed/);
  });

  it("asks the store for exactly the deck it is about to draw", () => {
    render(<LiveRoomTabs tab="answers" />);
    expect(LIVE.near.loadRoom).toHaveBeenCalledWith(["a"]);
  });
});


// ── the face, and the loop behind it (D177) ──────────────────────────
describe("LiveRoomTabs · People draws faces and can report one", () => {
  beforeEach(() => {
    LIVE.near.room = () => ({
      people: [{ uid: "u1", type: "Host" }, { uid: "u2" }],
      qs: {},
    });
    LIVE.faceFor = (uid: string) => (uid === "u1" ? "tok-123" : "");
  });

  it("draws a photo where there is one and initials where there is not", () => {
    render(<LiveRoomTabs tab="people" />);
    const img = screen.getByRole("img", { name: /Ada Lovelace/i }) as HTMLImageElement;
    expect(img.src).toContain("avatars%2Fu1");
    // The permanent fallback, not a placeholder — most accounts will never
    // set a picture, and that has to look deliberate.
    expect(screen.getByText("Someone")).toBeTruthy();
    expect(screen.queryAllByRole("img")).toHaveLength(1);
  });

  it("offers a report only on a face, and takes two taps to send it", () => {
    // A flag cannot be undone, and a mis-tap in a list of faces is easy —
    // the takes control makes the same choice for the same reason.
    render(<LiveRoomTabs tab="people" />);
    const buttons = screen.getAllByRole("button", { name: /Report this photo/i });
    // Only the row that HAS a photo: there is nothing to report about
    // initials.
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(LIVE.flagAvatar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(LIVE.flagAvatar).toHaveBeenCalledWith("u1");
  });

  it("a hidden face reads exactly like no face at all", () => {
    // `resolveNames` resolves a removed photo to "", so every surface
    // falls back at once and none of them needs to know about moderation.
    // This is that contract from the consumer's side.
    LIVE.faceFor = () => "";
    render(<LiveRoomTabs tab="people" />);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Report this photo/i })).toBeNull();
  });
});

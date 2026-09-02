// @vitest-environment jsdom
//
// The Near stop's three tab bodies (D177).
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
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

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
    // Real, because two cases below drive a beat through it: the component
    // re-renders on notify, which is how a new `updatedAt` reaches its
    // effect.
    listeners: [] as Array<() => void>,
    subscribe(fn: () => void) {
      this.listeners.push(fn);
      return () => { this.listeners = this.listeners.filter((f) => f !== fn); };
    },
    notify() { for (const f of [...this.listeners]) f(); },
    deck: () => deck,
    myVotes: () => ({ a: "0" }) as Record<string, string>,
    myTestResults: () => ({}) as Record<string, unknown>,
    // Compare's fold since D193. Empty is the honest default here: the
    // room's side is its members' completed instruments, and the bank is
    // only read to fill YOUR side in from feed answers.
    testFeedItems: () => [] as Array<Record<string, unknown>>,
    loadNames: vi.fn(async () => {}),
    nameFor: (uid: string) => ({ u1: "Ada Lovelace", u2: "" }[uid] ?? ""),
    scoresFor: () => null as Record<string, Record<string, number>> | null,
    // D178. No face by default: initials are the permanent fallback, so
    // that is the shape most rows have.
    faceFor: ((uid: string) => (uid ? "" : "")) as (uid: string) => string,
    flagAvatar: vi.fn(async () => {}),
    flaggedAvatar: () => false as boolean,
    near: {
      room: () => null as { people: Array<{ uid: string; type?: string }>;
        qs: Record<string, Record<string, number>> } | null,
      roomLoading: () => false as boolean,
      loadRoom: vi.fn(async () => {}),
      updatedAt: () => 0 as number,
    },
  };
});
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LiveRoomTabs } = await import("./LiveRoomTabs");

// The photo URL is built from build config, so a test run has none — and
// without it every face falls back to initials, which would make the D178
// cases below pass for the wrong reason.
beforeAll(() => { vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "b.appspot.com"); });
afterAll(() => { vi.unstubAllEnvs(); });

beforeEach(() => {
  LIVE.near.room = () => null;
  LIVE.near.roomLoading = () => false;
  LIVE.scoresFor = () => null;
  LIVE.faceFor = () => "";
  // Compare's two sides, back to empty between cases (D193). A profile
  // left standing from the previous case would put a card in front of an
  // empty-state assertion, which is a pass for the wrong reason.
  LIVE.myTestResults = () => ({});
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
      // "The Host", not "Host": the presence doc carries what myType()
      // resolved (`myType`, data/typeMix), which is an IS_ARCHETYPES name verbatim.
      // The short form was fixture-only and quietly made the mark below
      // unresolvable, which is half of why it went four days undrawn.
      people: [{ uid: "u1", type: "The Host" }, { uid: "u2" }],
      qs: { a: { "0": 3, "1": 1 } },
    });
  });

  it("names who is here, and calls an unnamed account somebody", () => {
    render(<LiveRoomTabs tab="people" />);
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    // An account that never set a display name is still a person in the
    // room; an empty row would read as a rendering fault.
    expect(screen.getByText("Someone")).toBeTruthy();
    // The archetype rides the presence doc (D176's `type`), so a phone
    // that never took the test simply has no badge — not a blank one.
    expect(screen.getByText("The Host")).toBeTruthy();
  });

  it("draws the type's MARK beside its name, not the name alone", () => {
    // The regression this exists for: the row shipped as
    // `<TypeMark type={p.type}>` and TypeMark takes `testKey` + `name`, so
    // the prop was dropped, the signature never resolved and line 27's
    // `return null` fired on every row. Nothing failed — the mark degrades
    // to a missing glyph, and the @ts-expect-error on the untyped spec
    // import is what kept tsc quiet.
    //
    // Asserted on the rendered SVG rather than on the props, because the
    // props were the thing that was wrong: a test that mocked TypeMark
    // would have passed against the bug.
    const { container } = render(<LiveRoomTabs tab="people" />);
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0);
  });

  it("draws no mark for a type no archetype table names", () => {
    // The other half of D1's rule at this seam: `type` is a free string on
    // a doc no client can read (it is whatever the writer's own table
    // said), so a name this build cannot resolve gets NO mark rather than
    // a fabricated one. Same shape as the phone that never took the test.
    LIVE.near.room = () => ({
      people: [{ uid: "u1", type: "Sorting Hat" }],
      qs: { a: { "0": 3, "1": 1 } },
    });
    const { container } = render(<LiveRoomTabs tab="people" />);
    expect(screen.getByText("Sorting Hat")).toBeTruthy();
    expect(container.querySelectorAll("svg").length).toBe(0);
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
    // The cohort noun matters as much as the number: D170's whole finding
    // was three lenses naming one population and reading another.
    expect(document.body.textContent || "").toMatch(/this room/i);
  });

  it("compares you against the people in the room, under the room's noun", () => {
    // D193: Compare is the profile drawing, and the room is the one
    // population with no cells to fold — the server returns today's deck,
    // never the test bank — so its side is the members' own completed
    // instruments, averaged.
    LIVE.myTestResults = () => ({
      big5: { dims: [
        { id: "O", value: 70 }, { id: "C", value: 60 }, { id: "E", value: 50 },
        { id: "A", value: 40 }, { id: "N", value: 30 },
      ] },
    });
    LIVE.scoresFor = () => ({ big5: { O: 50, C: 50, E: 50, A: 50, N: 50 } });
    render(<LiveRoomTabs tab="compare" />);
    const text = document.body.textContent || "";
    // The cohort noun matters as much as the number: D170's whole finding
    // was three lenses naming one population and reading another.
    expect(text).toMatch(/this room/i);
    // gaps 20, 10, 0, 10, 20 → mean 12 → 88, over the one person in the
    // room who has a profile.
    expect(text).toMatch(/88/);
    expect(text).toMatch(/1 of 1 have taken one/);
  });

  it("keeps your empty, theirs, and not-read-yet apart", async () => {
    // Two different facts, and one "no data" would collapse them. You
    // first: nothing of yours to lay over anybody.
    render(<LiveRoomTabs tab="compare" />);
    expect(screen.getByText(/fills in as you answer the test cards/i)).toBeTruthy();
    cleanup();
    // …then them: your profile against a room where nobody has one.
    LIVE.myTestResults = () => ({
      big5: { dims: [
        { id: "O", value: 70 }, { id: "C", value: 60 }, { id: "E", value: 50 },
        { id: "A", value: 40 }, { id: "N", value: 30 },
      ] },
    });
    render(<LiveRoomTabs tab="compare" />);
    // "Nobody has one" is a claim about people whose profiles have been
    // READ. Until the profile fetch lands there is a fourth state, and it
    // is the one on screen first: this case used to assert the absence on
    // the first frame, which is exactly the collapse the lens now refuses.
    expect(screen.getByText("Reading…")).toBeTruthy();
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/Nobody here has finished a test yet/i)).toBeTruthy();
  });

  it("asks the store for exactly the deck it is about to draw", () => {
    render(<LiveRoomTabs tab="answers" />);
    expect(LIVE.near.loadRoom).toHaveBeenCalledWith(["a"]);
  });

  it("asks again when the beat moves the room underneath it", async () => {
    // The room is per cell and the cell changes while this stays mounted.
    // Keyed on the deck alone, nothing re-ran: the tabs went on naming the
    // people from the block you walked out of, and the failure note's
    // promise of a retry was a promise nothing kept.
    LIVE.near.updatedAt = () => 1;
    LIVE.near.loadRoom.mockClear();
    render(<LiveRoomTabs tab="answers" />);
    expect(LIVE.near.loadRoom).toHaveBeenCalledTimes(1);
    LIVE.near.updatedAt = () => 2;
    await act(async () => { LIVE.notify(); });
    expect(LIVE.near.loadRoom).toHaveBeenCalledTimes(2);
    LIVE.near.updatedAt = () => 0;
  });

  it("costs nothing on a beat that did not move", async () => {
    // The dep is the beat, so a re-render without one must not re-ask. (A
    // beat that repeats the same cell is refused inside the store too, but
    // this component should not be leaning on that.)
    LIVE.near.updatedAt = () => 7;
    LIVE.near.loadRoom.mockClear();
    render(<LiveRoomTabs tab="answers" />);
    expect(LIVE.near.loadRoom).toHaveBeenCalledTimes(1);
    await act(async () => { LIVE.notify(); });
    expect(LIVE.near.loadRoom).toHaveBeenCalledTimes(1);
    LIVE.near.updatedAt = () => 0;
  });
});


// ── the face, and the loop behind it (D178) ──────────────────────────
describe("LiveRoomTabs · People draws faces and can report one", () => {
  beforeEach(() => {
    LIVE.near.room = () => ({
      // "The Host", not "Host": the presence doc carries what myType()
      // resolved (`myType`, data/typeMix), which is an IS_ARCHETYPES name verbatim.
      // The short form was fixture-only and quietly made the mark below
      // unresolvable, which is half of why it went four days undrawn.
      people: [{ uid: "u1", type: "The Host" }, { uid: "u2" }],
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

  it("a refused report is not an unhandled rejection", async () => {
    // The store rolls a refused report back and reports it, then rethrows
    // for callers that await it. This one does not await — a `void` tap
    // handler — so the rejection has to be caught here, or it surfaces
    // as an unhandled one (and D352's gate gave the method a second way
    // to reject: a failed sign-in). vitest fails the file on an unhandled
    // rejection, which is the assertion.
    // A PLAIN function, not a vi.fn: the mock wrapper records a returned
    // promise's outcome, which attaches a handler to it — so through a
    // vi.fn the rejection is never unhandled and the case cannot fail.
    // Node reports a rejection nobody handled at its next checkpoint;
    // listen for it directly rather than trusting the runner to notice.
    const wrapped = LIVE.flagAvatar;
    let reported = "";
    (LIVE as { flagAvatar: unknown }).flagAvatar = (uid: string) => {
      reported = uid;
      return Promise.reject(new Error("permission-denied"));
    };
    const unhandled: unknown[] = [];
    const onRejection = (reason: unknown) => { unhandled.push(reason); };
    process.on("unhandledRejection", onRejection);
    try {
      render(<LiveRoomTabs tab="people" />);
      fireEvent.click(screen.getByRole("button", { name: /Report this photo/i }));
      fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
      await new Promise<void>((r) => setTimeout(r, 0));
      await new Promise<void>((r) => setTimeout(r, 0));
      expect(reported).toBe("u1");
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onRejection);
      (LIVE as { flagAvatar: unknown }).flagAvatar = wrapped;
    }
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

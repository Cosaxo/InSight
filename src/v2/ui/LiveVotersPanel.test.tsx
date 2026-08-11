// @vitest-environment jsdom
//
// LiveVotersPanel is the surface D98 exists for: it names the people who
// answered a question. That makes it the panel with the most ways to say
// something false about a real person, so these cases are mostly about
// what it must NOT do:
//
//   - it must not confuse "we could not ask" with "nobody answered". The
//     store leaves the key absent on a failed fetch precisely so the two
//     can render differently, and a panel that collapses them re-creates
//     the silent gap the old withheld cells were.
//   - it must not invent a name for an account that has none.
//   - it must not drop an option nobody picked, which would read as the
//     option not existing.
//   - it must not fetch until it is mounted, because it is mounted from an
//     opened sheet and a feed of fifty cards must cost nothing.
//
// `../data/live` is mocked rather than booted: it imports Firebase, and the
// real query is covered where it can be executed — rules.test.ts proves the
// collection-group grant and the mandatory surface filter against the
// emulator, and data/voters.test.ts covers the shaping.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Voter } from "../data/voters";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  loadVoters: vi.fn(async (qid: string) => { void qid; }),
  votersByOption: (qid: string, n: number) => {
    void qid; void n;
    return null as Voter[][] | null;
  },
  votersLoading: (qid: string) => { void qid; return false as boolean; },
  subscribe: () => () => {},
}));
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LiveVotersPanel } = await import("./LiveVotersPanel");

const OPTS = ["Beach", "City break"];
const v = (over: Partial<Voter> = {}): Voter => ({
  uid: "u1", optionIdx: 0, anchors: {}, name: "", isMe: false, ...over,
});

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.loadVoters = vi.fn(async () => {});
  LIVE.votersByOption = () => null;
  LIVE.votersLoading = () => false;
});
afterEach(cleanup);

describe("LiveVotersPanel · the three states of a cross-user read", () => {
  it("says it is loading while the fetch is in flight", () => {
    LIVE.votersLoading = () => true;
    render(<LiveVotersPanel qid="q1" options={OPTS} />);
    expect(screen.getByText(/loading who answered/i)).toBeTruthy();
  });

  it("distinguishes a FAILED fetch from an empty one", () => {
    // Both give the panel no rows, and they mean opposite things. The
    // store's contract is that a failure leaves the key absent (null) and
    // a genuinely unanswered question resolves to empty columns — a panel
    // that printed "nobody answered" on a network error would be stating
    // a fact about the crowd that it does not have.
    LIVE.votersByOption = () => null;
    LIVE.votersLoading = () => false;
    render(<LiveVotersPanel qid="q1" options={OPTS} />);
    expect(screen.getByText(/could not load who answered/i)).toBeTruthy();
    expect(screen.queryByText(/nobody has answered/i)).toBeNull();

    cleanup();
    LIVE.votersByOption = () => [[], []];
    render(<LiveVotersPanel qid="q1" options={OPTS} />);
    expect(screen.getByText(/nobody has answered this yet/i)).toBeTruthy();
    expect(screen.queryByText(/could not load/i)).toBeNull();
  });
});

describe("LiveVotersPanel · what it says about real people", () => {
  it("names the voters under the option each one picked", () => {
    LIVE.votersByOption = () => [
      [v({ uid: "a", name: "Ada" })],
      [v({ uid: "b", name: "Bea", optionIdx: 1 })],
    ];
    render(<LiveVotersPanel qid="q1" options={OPTS} />);
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("Bea")).toBeTruthy();
    expect(screen.getByText(/who answered · 2/i)).toBeTruthy();
  });

  it("renders an unnamed account as Someone, and invents nothing", () => {
    LIVE.votersByOption = () => [[v({ uid: "quiet", name: "" })], []];
    render(<LiveVotersPanel qid="q1" options={OPTS} />);
    expect(screen.getByText("Someone")).toBeTruthy();
    // Not the uid, not a generated handle — D1 survives D98, and a
    // pseudonym stitched from an account id would be a fabrication.
    expect(screen.queryByText(/quiet/)).toBeNull();
  });

  it("marks the viewer's own answer as You", () => {
    LIVE.votersByOption = () => [[v({ uid: "me", name: "Mira", isMe: true })], []];
    render(<LiveVotersPanel qid="q1" options={OPTS} />);
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.queryByText("Mira")).toBeNull();
  });

  it("shows the cohort frozen on the ANSWER, not a current profile", () => {
    // D8's snapshot. The chips come off the answer doc, so a voter who has
    // since moved still appears in the city they answered from — which is
    // also the only way this panel can agree with the breakdown above it,
    // since the aggregate folds the same snapshot.
    LIVE.votersByOption = () => [
      [v({ uid: "a", name: "Ada", anchors: { ageBand: "25-34", city: "Oslo, NO" } })],
      [],
    ];
    render(<LiveVotersPanel qid="q1" options={OPTS} />);
    expect(screen.getByText(/25-34 · Oslo, NO/)).toBeTruthy();
  });

  it("keeps a column for an option nobody picked", () => {
    LIVE.votersByOption = () => [[v({ uid: "a", name: "Ada" })], []];
    render(<LiveVotersPanel qid="q1" options={OPTS} />);
    // The empty option is still named, and says so — a missing column
    // reads as a missing option.
    expect(screen.getByText("City break")).toBeTruthy();
    expect(screen.getByText(/nobody yet/i)).toBeTruthy();
  });
});

describe("LiveVotersPanel · cost", () => {
  it("fetches once per question, on mount, and not before", () => {
    // The whole cost argument: this is a collection-group query plus a
    // batched profile read, and it must be paid only when someone opens
    // the sheet. Mounting is the trigger; rendering again is not.
    expect(LIVE.loadVoters).not.toHaveBeenCalled();
    const { rerender } = render(<LiveVotersPanel qid="q1" options={OPTS} />);
    expect(LIVE.loadVoters).toHaveBeenCalledTimes(1);
    expect(LIVE.loadVoters).toHaveBeenCalledWith("q1");
    rerender(<LiveVotersPanel qid="q1" options={OPTS} />);
    expect(LIVE.loadVoters).toHaveBeenCalledTimes(1);
  });

  it("renders nothing at all in demo mode", () => {
    // A demo build has no real crowd to name, and naming the sample
    // people here would be the D1 fabrication wearing a live badge.
    LIVE.enabled = false;
    const { container } = render(<LiveVotersPanel qid="q1" options={OPTS} />);
    expect(container.textContent).toBe("");
  });
});

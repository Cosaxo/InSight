// @vitest-environment jsdom
//
// The Roles tab (D201) — the panel half.
//
// `data/roles.test.ts` holds the arithmetic. What matters here is what the
// screen does with it, and the three properties are all refusals:
//
//   1. A setting under its floor is NOT drawn. A role read off one
//      revealed day is a coin flip with a name on it.
//   2. When nothing clears the floor, the panel SAYS SO rather than
//      drawing an empty rose — the same posture every other live surface
//      takes when the fold cannot be done (D72).
//   3. The average never stands alone once there is more than one
//      setting: a role is only interesting beside the other roles you
//      play, so the rows are part of the reading rather than a detail
//      view of it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

let ROOMS: Record<string, unknown>[] = [];
let HIST: Record<string, Record<string, unknown>[]> = {};

vi.mock("../data/live", () => ({
  default: {
    enabled: true,
    uid: "me",
    subscribe: () => () => {},
    social: {
      groups: () => ROOMS,
      revealHistory: (gid: string) => HIST[gid] || [],
      loadRevealHistory: () => Promise.resolve(),
    },
  },
}));

import LiveRolesPanel from "./LiveRolesPanel";

/** A duo reveal day: my (option, guess) and theirs. */
const dday = (d: string, mine: [number, number], theirs: [number, number]) => ({
  day: d, qid: "q1",
  votes: {
    me: { optionIdx: mine[0], guessIdx: mine[1] },
    them: { optionIdx: theirs[0], guessIdx: theirs[1] },
  },
  names: { them: "Ada Lovelace" },
});
const gdayr = (d: string, opts: Record<string, number>) => ({
  day: d, qid: "g1",
  votes: Object.fromEntries(Object.entries(opts).map(([u, o]) => [u, { optionIdx: o }])),
});

const duoRoom = (id: string) => ({ id, mode: "duo", memberUids: ["me", "them"], memberNames: { them: "Ada Lovelace" } });

beforeEach(() => {
  ROOMS = []; HIST = {};
  // The matcher lives on the archetype module's window mirror.
  (window as unknown as { IS_matchArchetype?: unknown }).IS_matchArchetype =
    () => ({ list: [{ name: "The Mind Reader", line: "Calls their answer before they do." }], idx: 0 });
});
afterEach(cleanup);

describe("when nothing clears the floor", () => {
  it("says so, on both instruments, instead of drawing an empty rose", () => {
    render(<LiveRolesPanel />);
    expect(screen.getByText(/No 1v1 has run 3 revealed days yet/)).toBeTruthy();
    expect(screen.getByText(/No group has run 2 revealed days yet/)).toBeTruthy();
  });

  it("does not draw a role for a duel that has run two days", () => {
    ROOMS = [duoRoom("d1")];
    HIST.d1 = [dday("2026-08-01", [0, 1], [1, 1]), dday("2026-08-02", [0, 1], [1, 1])];
    render(<LiveRolesPanel />);
    expect(screen.getByText(/No 1v1 has run 3 revealed days yet/)).toBeTruthy();
    expect(screen.queryByText("Ada")).toBeNull();
  });
});

describe("with one setting over the floor", () => {
  beforeEach(() => {
    ROOMS = [duoRoom("d1")];
    HIST.d1 = [
      dday("2026-08-01", [0, 1], [1, 1]),
      dday("2026-08-02", [0, 1], [1, 1]),
      dday("2026-08-03", [0, 1], [1, 1]),
      dday("2026-08-04", [0, 0], [1, 0]),
    ];
  });

  it("draws the type and the weight behind it", () => {
    render(<LiveRolesPanel />);
    expect(screen.getByText("The Mind Reader")).toBeTruthy();
    expect(screen.getByText("Calls their answer before they do.")).toBeTruthy();
    expect(screen.getByText("4 revealed days")).toBeTruthy();
  });

  it("draws no per-setting row — there is nothing to compare it to yet", () => {
    render(<LiveRolesPanel />);
    expect(screen.queryByRole("button", { name: /Ada/ })).toBeNull();
  });
});

describe("with two settings", () => {
  beforeEach(() => {
    ROOMS = [duoRoom("d1"), duoRoom("d2")];
    HIST.d1 = [
      dday("2026-08-01", [0, 1], [1, 1]),
      dday("2026-08-02", [0, 1], [1, 1]),
      dday("2026-08-03", [0, 1], [1, 1]),
    ];
    HIST.d2 = [
      dday("2026-08-01", [0, 0], [1, 0]),
      dday("2026-08-02", [0, 0], [1, 0]),
      dday("2026-08-03", [0, 0], [1, 0]),
      dday("2026-08-04", [0, 0], [1, 0]),
    ];
  });

  it("says how many settings the average is across, and how many days", () => {
    render(<LiveRolesPanel />);
    expect(screen.getByText("across 2 · 7 revealed days")).toBeTruthy();
  });

  it("lists every setting one row deep, named by the person", () => {
    render(<LiveRolesPanel />);
    const rows = screen.getAllByRole("button");
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain("Ada");
  });

  it("opens a row onto its receipts — the counts the scores are made of", () => {
    render(<LiveRolesPanel />);
    const row = screen.getAllByRole("button")[0];
    expect(screen.queryByText(/right on \d+ of your \d+ guesses/)).toBeNull();
    fireEvent.click(row);
    // The plain count, not the score. A number a reader can check against
    // the reveals they have already seen.
    expect(screen.getByText("right on 3 of your 3 guesses")).toBeTruthy();
    expect(screen.getByText(/the same answer on 0 of 3 days/)).toBeTruthy();
  });

  it("closes the open row when it is tapped again", () => {
    render(<LiveRolesPanel />);
    const row = screen.getAllByRole("button")[0];
    fireEvent.click(row);
    expect(screen.getByText("right on 3 of your 3 guesses")).toBeTruthy();
    fireEvent.click(row);
    expect(screen.queryByText("right on 3 of your 3 guesses")).toBeNull();
  });
});

describe("groups", () => {
  it("draws a group role from the same history the Groups body already reads", () => {
    ROOMS = [{ id: "g1", mode: "group", name: "The Wednesday Six", memberUids: ["me", "a", "b"] }];
    HIST.g1 = [
      gdayr("2026-08-01", { me: 0, a: 0, b: 0 }),
      gdayr("2026-08-02", { me: 1, a: 0, b: 0 }),
      gdayr("2026-08-03", { me: 0, a: 0, b: 0 }),
    ];
    render(<LiveRolesPanel />);
    expect(screen.getByText("3 revealed days")).toBeTruthy();
    // …and the 1v1 half still refuses, independently.
    expect(screen.getByText(/No 1v1 has run 3 revealed days yet/)).toBeTruthy();
  });
});

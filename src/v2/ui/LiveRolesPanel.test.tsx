// @vitest-environment jsdom
//
// The Roles tab (D204) — the panel half.
//
// `data/roles.test.ts` holds the arithmetic. What matters here is what the
// screen does with it, and the three properties are all refusals:
//
//   1. A setting under its floor gets a THIN ROW — its name and how far
//      the count has got, in the floor's own unit — never a role. A role
//      read off one revealed day is a coin flip with a name on it, and
//      omitting the setting entirely (as this panel first shipped) made
//      the average silently partial.
//   2. When a section has no settings at all, the panel SAYS SO rather
//      than drawing an empty rose — the same posture every other live
//      surface takes when the fold cannot be done (D72). The sentence
//      names the real gate: days both guessed, not "revealed days".
//   3. The average never stands alone once there is anything beside it:
//      a role is only interesting beside the other roles you play, so
//      the rows are part of the reading rather than a detail view of it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

let ROOMS: Record<string, unknown>[] = [];
let HIST: Record<string, Record<string, unknown>[]> = {};

// The matcher is roles.test.ts' subject, not this panel's — pin it so
// these assertions read the panel's behaviour, not the fixtures' dims.
// Everything else keeps the real module (type-marks reads IS_ARCHETYPES
// through the same import since D253's conversion).
vi.mock("../spec/archetype-data.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  matchArchetype: () => ({ list: [{ name: "The Mind Reader", line: "Calls their answer before they do." }], idx: 0 }),
}));

vi.mock("../data/live", () => ({
  default: {
    enabled: true,
    uid: "me",
    subscribe: () => () => {},
    social: {
      groups: () => ROOMS,
      revealHistory: (gid: string) => HIST[gid] || [],
      loadRevealHistory: (gid: string) => (REFUSE.has(gid)
        ? Promise.reject(new Error("permission-denied"))
        : Promise.resolve()),
      revealHistoryLoading: (gid: string) => LOADING.has(gid),
    },
  },
}));

import LiveRolesPanel from "./LiveRolesPanel";

/** Rooms whose history read refuses, and rooms whose read is still out. */
const REFUSE = new Set<string>();
const LOADING = new Set<string>();

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
  REFUSE.clear(); LOADING.clear();
});
afterEach(cleanup);

describe("with no settings at all", () => {
  it("says so, on both instruments, naming each floor's real unit", () => {
    render(<LiveRolesPanel />);
    // "days you both guessed", not "revealed days": the duo gate counts
    // scored days, and a pair can reveal five days and guess on two.
    expect(screen.getByText(/No 1v1 has 3 days you both guessed yet/)).toBeTruthy();
    expect(screen.getByText(/No group has 2 revealed days you played yet/)).toBeTruthy();
  });
});

describe("a setting under the floor", () => {
  it("gets a thin row with its count, not a role and not silence", () => {
    ROOMS = [duoRoom("d1")];
    HIST.d1 = [dday("2026-08-01", [0, 1], [1, 1]), dday("2026-08-02", [0, 1], [1, 1])];
    render(<LiveRolesPanel />);
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("2 of 3 days both guessed")).toBeTruthy();
    // No role, no sentence: the row IS the explanation.
    expect(screen.queryByText("The Mind Reader")).toBeNull();
    expect(screen.queryByText(/No 1v1 has 3 days/)).toBeNull();
  });

  it("counts the floor's unit, not revealed days", () => {
    // Three revealed days, guesses on only two — the old copy would have
    // called this duel ready.
    ROOMS = [duoRoom("d1")];
    HIST.d1 = [
      dday("2026-08-01", [0, 1], [1, 1]),
      dday("2026-08-02", [0, 1], [1, 1]),
      { day: "2026-08-03", qid: "q1", votes: { me: { optionIdx: 0 }, them: { optionIdx: 1 } }, names: { them: "Ada Lovelace" } },
    ];
    render(<LiveRolesPanel />);
    expect(screen.getByText("2 of 3 days both guessed")).toBeTruthy();
    expect(screen.queryByText("The Mind Reader")).toBeNull();
  });

  // FOUR STATES BEHIND ONE EMPTY LIST. `revealHistory` answers [] for a
  // room that has revealed nothing, for a read still in the air, and for
  // a read that refused — and this panel said "nothing revealed yet" for
  // all three. The loader walks rooms one at a time, so with several
  // circles the later ones sat on that sentence while their own read was
  // still out; a refused room sat on it for the session. The Groups stop
  // one screen over already keeps the distinction, in the same words.
  it("says it is READING a room whose history has not landed", async () => {
    ROOMS = [{ id: "g1", mode: "group", name: "The Wednesday Six", memberUids: ["me", "a", "b"] }];
    LOADING.add("g1");
    render(<LiveRolesPanel />);
    expect(screen.getByText("reading\u2026")).toBeTruthy();
    expect(screen.queryByText("nothing revealed yet")).toBeNull();
  });

  it("…and says so when the read REFUSED, instead of claiming an empty room", async () => {
    ROOMS = [{ id: "g1", mode: "group", name: "The Wednesday Six", memberUids: ["me", "a", "b"] }];
    REFUSE.add("g1");
    render(<LiveRolesPanel />);
    await screen.findByText("couldn\u2019t read this one");
    expect(screen.queryByText("nothing revealed yet")).toBeNull();
  });

  it("says a room with no reveals has none, rather than counting to zero", () => {
    ROOMS = [{ id: "g1", mode: "group", name: "The Wednesday Six", memberUids: ["me", "a", "b"] }];
    render(<LiveRolesPanel />);
    expect(screen.getByText("The Wednesday Six")).toBeTruthy();
    expect(screen.getByText("nothing revealed yet")).toBeTruthy();
  });

  it("sits beside a full reading, so the average is visibly not the whole list", () => {
    ROOMS = [duoRoom("d1"), { id: "d2", mode: "duo", memberUids: ["me", "b"], memberNames: { b: "Bo Nilsen" } }];
    HIST.d1 = [
      dday("2026-08-01", [0, 1], [1, 1]),
      dday("2026-08-02", [0, 1], [1, 1]),
      dday("2026-08-03", [0, 1], [1, 1]),
    ];
    HIST.d2 = [{ day: "2026-08-01", qid: "q1", votes: { me: { optionIdx: 0, guessIdx: 1 }, b: { optionIdx: 1, guessIdx: 1 } }, names: { b: "Bo Nilsen" } }];
    render(<LiveRolesPanel />);
    // The qualifying duel draws the card AND its row; the thin one its row.
    expect(screen.getByText("The Mind Reader")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ada/ })).toBeTruthy();
    expect(screen.getByText("Bo")).toBeTruthy();
    expect(screen.getByText("1 of 3 days both guessed")).toBeTruthy();
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

  // Setting rows are the buttons that expand (aria-expanded); the two ⓘ
  // buttons the sections carry since the 2026-08-24 pass are not rows.
  it("lists every setting one row deep, named by the person", () => {
    render(<LiveRolesPanel />);
    const rows = screen.getAllByRole("button", { expanded: false });
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain("Ada");
  });

  it("opens a row onto its receipts — the counts the scores are made of", () => {
    render(<LiveRolesPanel />);
    const row = screen.getAllByRole("button", { expanded: false })[0];
    expect(screen.queryByText(/right on \d+ of your \d+ guesses/)).toBeNull();
    fireEvent.click(row);
    // The plain count, not the score. A number a reader can check against
    // the reveals they have already seen.
    expect(screen.getByText("right on 3 of your 3 guesses")).toBeTruthy();
    expect(screen.getByText(/the same answer on 0 of 3 days/)).toBeTruthy();
  });

  it("closes the open row when it is tapped again", () => {
    render(<LiveRolesPanel />);
    const row = screen.getAllByRole("button", { expanded: false })[0];
    fireEvent.click(row);
    expect(screen.getByText("right on 3 of your 3 guesses")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { expanded: true })[0]);
    expect(screen.queryByText("right on 3 of your 3 guesses")).toBeNull();
  });

  it("opens the section ⓘ onto the instrument's own sheet", () => {
    render(<LiveRolesPanel />);
    fireEvent.click(screen.getByRole("button", { name: "What the 1v1 role measures" }));
    // the sheet's about line — the same one every test's ⓘ opens
    expect(screen.getByText(/How a single 1v1 goes/)).toBeTruthy();
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
    expect(screen.getByText(/No 1v1 has 3 days you both guessed yet/)).toBeTruthy();
  });
});

// @vitest-environment jsdom
//
// The Roles tab (D204; the owner's 2026-09-09 instruments since D435) —
// the panel half. `data/roles.test.ts` holds the arithmetic. What matters
// here is what the screen does with it, and the properties are refusals:
//
//   1. A setting under its floor gets a THIN ROW — its name and how far
//      the count has got, in the floor's own unit (cast rounds, votes
//      received) — never a role.
//   2. When a section has no settings at all, the panel SAYS SO rather
//      than drawing an empty rose (D72).
//   3. The average never stands alone once there is anything beside it.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

let ROOMS: Record<string, unknown>[] = [];
let HIST: Record<string, Record<string, unknown>[]> = {};

// The matcher is roles.test.ts' subject, not this panel's — pin it so
// these assertions read the panel's behaviour, not the fixtures' dims.
vi.mock("../spec/archetype-data.js", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  matchArchetype: () => ({ list: [{ name: "The Confidant", line: "The one they tell first." }], idx: 0 }),
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
      // The bank the fold asks what each round was (D435): a cast round
      // and its them forms, a role vote and its seat.
      bankQ: (qid: string) => BANK[qid] || null,
    },
  },
}));

let BANK: Record<string, { options?: string[]; kind?: string; role?: { id: string; label: string; seat?: string }; them?: string[]; dims?: string[] }> = {};

import LiveRolesPanel from "./LiveRolesPanel";

const REFUSE = new Set<string>();
const LOADING = new Set<string>();

const CAST = {
  kind: "cast",
  options: ["the one you tell first", "the one who gets you out the door", "the one you ask what to do", "the one who is just always there"],
  them: ["the one {name} tells first", "the one who gets {name} out the door", "the one {name} asks what to do", "the one who is just always there"],
  dims: ["trust", "spark", "judgement", "constancy"],
};
/** A cast round: what I said they are, what they said I am, my guess. */
const cast = (d: string, mine: number, theirs: number, guess?: number) => ({
  day: d, qid: "c1",
  votes: {
    me: { optionIdx: mine, ...(guess == null ? {} : { guessIdx: guess }) },
    them: { optionIdx: theirs },
  },
  names: { them: "Ada Lovelace" },
});
/** An own round — not a cast, counts for nothing here. */
const own = (d: string) => ({ day: d, qid: "q1", votes: { me: { optionIdx: 0, guessIdx: 1 }, them: { optionIdx: 1, guessIdx: 0 } }, names: { them: "Ada Lovelace" } });
/** A role vote: who each member named, by snapshot. */
const vote = (d: string, qid: string, named: Record<string, string>) => ({
  day: d, qid,
  votes: Object.fromEntries(Object.entries(named).map(([u, who]) => [u, { optionIdx: 0, pickUid: who }])),
});

const duoRoom = (id: string) => ({ id, mode: "duo", memberUids: ["me", "them"], memberNames: { them: "Ada Lovelace" } });

beforeEach(() => {
  ROOMS = []; HIST = {}; BANK = { c1: CAST, q1: { options: ["a", "b"], kind: "day" },
    r1: { kind: "pick", options: [], role: { id: "mastermind", label: "the mastermind", seat: "engine" } },
    r2: { kind: "pick", options: [], role: { id: "driver", label: "the getaway driver", seat: "hands" } } };
  REFUSE.clear(); LOADING.clear();
});
afterEach(cleanup);

describe("with no settings at all", () => {
  it("says so, on both instruments, in the brief's words", () => {
    render(<LiveRolesPanel />);
    expect(screen.getByText(/Every fourth round of a 1v1 asks what the other is to you/)).toBeTruthy();
    expect(screen.getByText(/No room has voted you into a role yet/)).toBeTruthy();
  });
});

describe("a setting under the floor", () => {
  it("gets a thin row with its count in cast rounds, not a role and not silence", () => {
    ROOMS = [duoRoom("d1")];
    HIST.d1 = [own("2026-09-01"), own("2026-09-02"), own("2026-09-03"), cast("2026-09-04", 0, 2, 2)];
    render(<LiveRolesPanel />);
    expect(screen.getByText("1 of 3 cast rounds")).toBeTruthy();
    expect(screen.queryByText("The Confidant")).toBeNull();
  });

  it("says a pair that has revealed nothing has nothing, and one with no cast yet where the cast is", () => {
    ROOMS = [duoRoom("d1"), duoRoom("d2")];
    HIST.d2 = [own("2026-09-01"), own("2026-09-02")];
    render(<LiveRolesPanel />);
    expect(screen.getByText("nothing revealed yet")).toBeTruthy();
    expect(screen.getByText("asked at round 4")).toBeTruthy();
  });

  it("says it is READING a room whose history has not landed", async () => {
    ROOMS = [duoRoom("d1")];
    LOADING.add("d1");
    render(<LiveRolesPanel />);
    expect(await screen.findByText("reading…")).toBeTruthy();
  });

  it("…and says so when the read REFUSED, instead of claiming an empty room", async () => {
    ROOMS = [duoRoom("d1")];
    REFUSE.add("d1");
    render(<LiveRolesPanel />);
    expect(await screen.findByText("couldn’t read this one")).toBeTruthy();
  });

  it("counts a group's votes received, not its rounds", () => {
    ROOMS = [{ id: "g1", mode: "group", name: "The Wednesday Six", memberUids: ["me", "a", "b"] }];
    // three rounds, one vote for me in all of them
    HIST.g1 = [
      vote("2026-09-01", "r1", { me: "a", a: "b", b: "me" }),
      vote("2026-09-02", "r2", { me: "a", a: "b", b: "a" }),
      vote("2026-09-03", "r1", { me: "b", a: "b", b: "b" }),
    ];
    render(<LiveRolesPanel />);
    expect(screen.getByText("1 of 2 votes")).toBeTruthy();
  });
});

describe("with one 1v1 over the floor", () => {
  beforeEach(() => {
    ROOMS = [duoRoom("d1")];
    HIST.d1 = [
      own("2026-09-01"),
      cast("2026-09-04", 0, 0, 0),
      cast("2026-09-08", 1, 0, 2),
      cast("2026-09-12", 0, 2, 2),
    ];
  });

  it("draws the type, the rounds behind it, and how often you saw it coming", () => {
    render(<LiveRolesPanel />);
    expect(screen.getByText("The Confidant")).toBeTruthy();
    expect(screen.getByText("The one they tell first.")).toBeTruthy();
    // the unit is cast rounds — the own round between them counts for nothing
    expect(screen.getByText("3 rounds asked")).toBeTruthy();
    // two of three guesses landed (0→0, 2→2), one missed (2→0)
    expect(screen.getByText("You guessed what they’d say you are 2 of 3 times.")).toBeTruthy();
    expect(screen.queryByText(/days/)).toBeNull();
  });

  it("draws no per-setting row — there is nothing to compare it to yet", () => {
    render(<LiveRolesPanel />);
    expect(screen.queryByRole("button", { name: /Ada/ })).toBeNull();
  });
});

describe("with two 1v1s", () => {
  beforeEach(() => {
    ROOMS = [duoRoom("d1"), { id: "d2", mode: "duo", memberUids: ["me", "b"], memberNames: { b: "Bo Nilsen" } }];
    HIST.d1 = [cast("2026-09-04", 0, 0, 0), cast("2026-09-08", 1, 0, 0), cast("2026-09-12", 0, 0, 0)];
    HIST.d2 = [
      { ...cast("2026-09-04", 3, 3, 3), votes: { me: { optionIdx: 3, guessIdx: 3 }, b: { optionIdx: 3 } }, names: { b: "Bo Nilsen" } },
      { ...cast("2026-09-08", 3, 3, 3), votes: { me: { optionIdx: 3, guessIdx: 3 }, b: { optionIdx: 3 } }, names: { b: "Bo Nilsen" } },
      { ...cast("2026-09-12", 3, 3, 3), votes: { me: { optionIdx: 3, guessIdx: 3 }, b: { optionIdx: 3 } }, names: { b: "Bo Nilsen" } },
    ];
  });

  it("says how many settings the average is across, and how many rounds", () => {
    render(<LiveRolesPanel />);
    expect(screen.getByText("across 2 · 6 rounds asked")).toBeTruthy();
  });

  it("lists every setting one row deep, named by the person, with its rounds", () => {
    render(<LiveRolesPanel />);
    expect(screen.getByRole("button", { name: /Ada/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Bo/ })).toBeTruthy();
    expect(screen.getAllByText(/3 rounds/)).toHaveLength(2);
  });

  it("opens a row onto its receipts — what they said you are, with the name in it", () => {
    render(<LiveRolesPanel />);
    fireEvent.click(screen.getByRole("button", { name: /Ada/ }));
    expect(screen.getByText("they said you are the one Ada tells first in 3 of 3 rounds")).toBeTruthy();
    expect(screen.getByText("they said you are the one who gets Ada out the door in 0 of 3 rounds")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\{name\}/);
  });

  it("opens the section ⓘ onto the instrument's own sheet", () => {
    render(<LiveRolesPanel />);
    fireEvent.click(screen.getByRole("button", { name: "What the 1v1 role measures" }));
    expect(screen.getByText("What you are to them")).toBeTruthy();
    expect(screen.getByText(/How often they say you are the one they tell first/)).toBeTruthy();
  });
});

describe("groups", () => {
  it("draws a seat from the votes you received, off the snapshots the Groups body already reads", () => {
    ROOMS = [{ id: "g1", mode: "group", name: "The Wednesday Six", memberUids: ["me", "a", "b"] }];
    HIST.g1 = [
      vote("2026-09-01", "r1", { me: "a", a: "me", b: "me" }),   // two votes for me, the engine seat
      vote("2026-09-02", "r2", { me: "a", a: "b", b: "me" }),    // one, the hands seat
      vote("2026-09-03", "r1", { me: "me", a: "b", b: "b" }),    // a vote for yourself is not the room
    ];
    render(<LiveRolesPanel />);
    expect(screen.getByText("The Confidant")).toBeTruthy(); // the pinned matcher
    expect(screen.getByText("3 votes")).toBeTruthy();
    // …and the 1v1 half still refuses, independently.
    expect(screen.getByText(/Every fourth round of a 1v1/)).toBeTruthy();
  });
});

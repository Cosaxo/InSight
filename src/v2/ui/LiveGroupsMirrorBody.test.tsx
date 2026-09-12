// @vitest-environment jsdom
//
// LiveGroupsMirrorBody is the one panel that renders other people BY NAME,
// which D1 permits only inside a mutual circle. Everything it draws comes
// from reveal docs the viewer can already read, so it adds no disclosure of
// its own — but it does make claims ABOUT those people, and a wrong claim
// here is the fabrication the whole live Groups portrait replaced.
//
// The arithmetic is `data/groupCast.ts` (who the room named, how it rates
// itself), `data/groupPortrait.ts` (who casts the room like you) and
// `data/roles.ts` (everyone's seat), each pinned in its own suite. What
// is pinned here is the component: which claims it is willing to print,
// in which tab, and which states it refuses to print anything for.
//
// The stop since D437 (the owner's 2026-09-09 design): the seat line and
// the role map above the row, and Votes · People · Scores · Compare in
// it. What left with the majority — the alignment ring, the Answers rows,
// the cross-group "runs most like you" line — is asserted absent, because
// "aligned with you · 3 of 4 days" is exactly the sentence the owner's
// voice rules retire (rounds, not days; nothing in a group is called).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MIN_SHARED } from "../data/groupPortrait";
import { MIN_GROUP } from "../data/roles";
import { registerNav } from "../data/nav";

const LIVE = vi.hoisted(() => {
  const social = {
    groups: (mode?: string) => { void mode; return [] as Array<Record<string, unknown>>; },
    revealHistory: () => [] as Array<Record<string, unknown>>,
    /** Settled by default — every case below is about a history that HAS
     *  been read. The reading arm has its own cases. */
    reading: false,
    revealHistoryLoading(this: { reading: boolean }) { return this.reading; },
    /** …and settled SUCCESSFULLY by default, derived here exactly the way
     *  the store derives it, so the fake cannot answer 'ready' about a
     *  read the real one would call 'failed'. */
    readFailed: false,
    revealHistState(this: { reading: boolean; readFailed: boolean }): "loading" | "ready" | "failed" {
      if (this.reading) return "loading";
      return this.readFailed ? "failed" : "ready";
    },
    // The WORD the store answers, not `undefined`: this stop `void`s the
    // call, but a fixture that answers a different shape from its subject
    // is how the refused read went unnoticed here in the first place.
    loadRevealHistory: vi.fn(async () => "ok" as const),
    bankQ: (qid: string) => { void qid; return null as Record<string, unknown> | null; },
    groupBankCounts: () => ({ roles: 10, ratings: 4 }),
  };
  return {
    enabled: true, uid: "u_me", social, subscribe: () => () => {},
    // Compare's fold since D193. A group is the one Mirror population
    // with no cells to read — its history is its own reveals, never the
    // test bank — so its side is the members' completed instruments,
    // cached beside their names.
    myVotes: () => ({}) as Record<string, string>,
    myTestResults: () => ({}) as Record<string, unknown>,
    testFeedItems: () => [] as Array<Record<string, unknown>>,
    // Resolves TRUE: the store answers whether the profile read landed
    // (a `false` is what puts the failure copy on Compare), so a fixture
    // resolving `undefined` reads as a failed read.
    loadNames: vi.fn(async () => true),
    scoresFor: (uid: string) => { void uid; return null as Record<string, Record<string, number>> | null; },
  };
});
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LiveGroupsMirrorBody } = await import("./LiveGroupsMirrorBody");

const GROUP = {
  id: "g1",
  name: "The Crew",
  mode: "group",
  memberUids: ["u_me", "u_ada", "u_bo", "u_cy"],
  memberNames: { u_me: "Me", u_ada: "Ada Lovelace", u_bo: "Bo", u_cy: "Cy" },
};

// The bank the folds read: two roles in one pack, one in another, a rating.
const HEIST = { id: "heist", label: "Bank Heist", hue: 25 };
const ISLAND = { id: "island", label: "Desert Island", hue: 150 };
const BANK: Record<string, Record<string, unknown>> = {
  r_mind: { kind: "pick", prompt: "Who plans it?", scen: HEIST, role: { id: "mind", label: "the mastermind", seat: "engine" } },
  r_wheel: { kind: "pick", prompt: "Who drives?", scen: HEIST, role: { id: "wheel", label: "the getaway driver", seat: "hands" } },
  r_fire: { kind: "pick", prompt: "Who keeps the fire going?", scen: ISLAND, role: { id: "fire", label: "the fire keeper", seat: "heart" } },
  s_pace: { kind: "rate", prompt: "This group's energy?", poles: ["Calm", "Chaos"], options: ["Calm", "Mostly calm", "In between", "Mostly chaos", "Chaos"] },
};

/** A role vote's reveal: who named whom, by the D224 snapshot — and the
 *  index that snapshot meant on this roster, as a real client writes it. */
const vote = (day: string, round: number, qid: string, picks: Record<string, string>, late: string[] = []) => ({
  day, round, qid,
  votes: Object.fromEntries(Object.entries(picks).map(([voter, who]) => [voter, {
    optionIdx: GROUP.memberUids.indexOf(who), pickUid: who, ...(late.includes(voter) ? { late: true } : {}),
  }])),
});
/** A rating's reveal: who stood on which step. */
const rate = (day: string, round: number, steps: Record<string, number>) => ({
  day, round, qid: "s_pace",
  votes: Object.fromEntries(Object.entries(steps).map(([uid, step]) => [uid, { optionIdx: step }])),
});

// A room with history: Ada the mastermind twice over, the driver
// contested between Bo and me, the fire keeper mine, one rating.
const HISTORY = [
  rate("2026-09-04", 4, { u_me: 4, u_ada: 3, u_bo: 3, u_cy: 2 }),
  vote("2026-09-03", 3, "r_fire", { u_me: "u_ada", u_ada: "u_me", u_bo: "u_me", u_cy: "u_me" }),
  vote("2026-09-02", 2, "r_wheel", { u_me: "u_bo", u_ada: "u_bo", u_bo: "u_me", u_cy: "u_me" }),   // 2–2: shared
  vote("2026-09-01", 1, "r_mind", { u_me: "u_ada", u_ada: "u_bo", u_bo: "u_ada", u_cy: "u_ada" }),
];

// The stop's readings live behind its tab row since D190, closed on
// arrival like every other Mirror stop (D155). Every case that asserts on a
// reading opens the tab it lives in first — which is also the assertion
// that the tab is there and reaches its body.
const openTab = (label: string) =>
  fireEvent.click(screen.getByRole("tab", { name: label }));
const panel = () => screen.getByRole("tabpanel");

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.uid = "u_me";
  LIVE.social.groups = () => [GROUP];
  LIVE.social.revealHistory = () => [];
  LIVE.social.reading = false;
  LIVE.social.readFailed = false;
  LIVE.social.revealHistoryLoading = function (this: { reading: boolean }) { return this.reading; } as never;
  LIVE.social.revealHistState = function (this: { reading: boolean; readFailed: boolean }) {
    if (this.reading) return "loading";
    return this.readFailed ? "failed" : "ready";
  } as never;
  LIVE.social.bankQ = (qid: string) => BANK[qid] || null;
  LIVE.social.groupBankCounts = () => ({ roles: 10, ratings: 4 });
  LIVE.myTestResults = () => ({});
  LIVE.scoresFor = () => null;
});
afterEach(cleanup);

describe("LiveGroupsMirrorBody · the head", () => {
  it("counts the roles cast and the scores, over all the roles in the packs", () => {
    LIVE.social.revealHistory = () => HISTORY;
    render(<LiveGroupsMirrorBody />);
    expect(screen.getByText("3 roles cast · 1 score")).toBeTruthy();
    // and nothing about days, sides or a majority — the words the owner
    // retired with the call
    const text = document.body.textContent || "";
    expect(text).not.toMatch(/aligned with you/);
    expect(text).not.toMatch(/\bdays?\b/);
    expect(text).not.toMatch(/majority/i);
  });

  it("says no rounds have revealed, and that it is reading while it reads", () => {
    render(<LiveGroupsMirrorBody />);
    expect(screen.getByText("no rounds revealed yet")).toBeTruthy();
    cleanup();
    LIVE.social.reading = true;
    render(<LiveGroupsMirrorBody />);
    expect(screen.getByText("reading the rounds…")).toBeTruthy();
    expect(screen.queryByText("no rounds revealed yet"), "an unread history was called an empty one").toBeNull();
  });

  it("says the read failed rather than that the room has never played", () => {
    // The third state, and the one this stop threw away: it `void`s
    // `loadRevealHistory`, so the answer the roles panel keeps never
    // reached here — a refused read arrived as an empty history with no
    // flag set, and the subline stated it as a fact under the room's own
    // name.
    LIVE.social.readFailed = true;
    render(<LiveGroupsMirrorBody />);
    expect(screen.getByText("couldn’t read the rounds")).toBeTruthy();
    expect(screen.queryByText("no rounds revealed yet"),
      "a refused read was called a room that never played").toBeNull();
  });

  it("keeps the reading sentence in front of the failed one", () => {
    // A retry in flight is about the attempt the reader is waiting on,
    // not the one before it.
    LIVE.social.readFailed = true;
    LIVE.social.reading = true;
    render(<LiveGroupsMirrorBody />);
    expect(screen.getByText("reading the rounds…")).toBeTruthy();
    expect(screen.queryByText("couldn’t read the rounds")).toBeNull();
  });

  it(`says your seat once ${MIN_GROUP} votes have named you, in the seat's own line`, () => {
    LIVE.social.revealHistory = () => HISTORY;
    render(<LiveGroupsMirrorBody />);
    // fire keeper: 3 votes (heart) · driver: 2 votes (hands) — the heart
    // seat, said as its line, never as "the Heart"
    const line = screen.getByText(/Here, you are/);
    expect(line.textContent).toContain("the one who holds the room together");
    expect(line.parentElement!.textContent).toContain("3 of 5 votes say so");
    expect(document.body.textContent).not.toMatch(/the Heart\b/);
  });

  it("says no seat under the floor — one vote is a coin with a title on it", () => {
    LIVE.social.revealHistory = () => [vote("2026-09-01", 1, "r_mind", { u_me: "u_ada", u_ada: "u_me", u_bo: "u_ada" })];
    render(<LiveGroupsMirrorBody />);
    expect(screen.queryByText(/Here, you are/)).toBeNull();
  });

  it("reads the seat off the server's ledger once a row clears the floor — past what the page holds (D445)", () => {
    // The page holds ONE vote naming me (under the floor on its own); the
    // group document's ledger holds the record — nine votes, the engine
    // seat — so the line says the ledger's numbers, not the page's.
    LIVE.social.groups = () => [{
      ...GROUP,
      ledger: { u_me: { votes: 9, seats: { engine: 6, heart: 3 } }, u_ada: { votes: 1, seats: { wild: 1 } } },
    }];
    LIVE.social.revealHistory = () => [vote("2026-09-01", 1, "r_fire", { u_me: "u_ada", u_ada: "u_me", u_bo: "u_ada" })];
    render(<LiveGroupsMirrorBody />);
    const line = screen.getByText(/Here, you are/);
    expect(line.textContent).toContain("the one who gets things going");
    expect(line.parentElement!.textContent).toContain("6 of 9 votes say so");
  });

  it("draws the role map above the row, with everyone on it", async () => {
    LIVE.social.revealHistory = () => HISTORY;
    render(<LiveGroupsMirrorBody />);
    // lazy chunk — the map arrives after the numbers
    const map = await screen.findByTestId("lg-role-map");
    expect(within(map).getByRole("button", { name: /^Ada/ })).toBeTruthy();
    expect(within(map).getByRole("button", { name: /^You/ })).toBeTruthy();
    expect(within(map).getByRole("button", { name: /the mastermind · Ada/ })).toBeTruthy();
  });

  it("loads the open room's history and no other room's", () => {
    const GROUP2 = { ...GROUP, id: "g2", name: "Book Club" };
    LIVE.social.groups = () => [GROUP, GROUP2];
    LIVE.social.loadRevealHistory.mockClear();
    render(<LiveGroupsMirrorBody />);
    expect(LIVE.social.loadRevealHistory).toHaveBeenCalledWith("g1");
    expect(LIVE.social.loadRevealHistory).not.toHaveBeenCalledWith("g2");
    fireEvent.click(screen.getByRole("button", { name: "Book Club" }));
    expect(LIVE.social.loadRevealHistory).toHaveBeenCalledWith("g2");
  });
});

describe("LiveGroupsMirrorBody · states it refuses to fake", () => {
  it("offers to start one when there are no groups, rather than rendering blank", () => {
    LIVE.social.groups = () => [];
    const { container } = render(<LiveGroupsMirrorBody />);
    // D172: the empty stop DRAWS — the rings and you — rather than
    // answering with a card of prose. The caption names the field and the
    // one action that cannot fill itself stays.
    expect(container.querySelector("svg"), "the empty field lost its drawing").toBeTruthy();
    expect(screen.getByText(/then it opens with names/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start a group/i })).toBeTruthy();
  });

  it("sends Start-a-group to the GROUP scope, not just the daily tab", () => {
    // goTab("track") restores whatever daily scope was last open, so a user
    // coming from the 1v1 tab landed back on 1v1 — a button that promises a
    // group and delivers a duel. The pin is on the goNav key, because the
    // difference is one argument and the wrong one still "navigates".
    const goNav = vi.fn();
    const dropNav = registerNav({ goNav });
    try {
      LIVE.social.groups = () => [];
      render(<LiveGroupsMirrorBody />);
      screen.getByRole("button", { name: /Start a group/i }).click();
      expect(goNav).toHaveBeenCalledWith("track:group");
    } finally {
      dropNav();
    }
  });

  it("renders nothing at all when LIVE is off", () => {
    // The spec layer picks the demo body in that case; drawing both, or
    // drawing this one against an empty store, is the failure.
    LIVE.enabled = false;
    const { container } = render(<LiveGroupsMirrorBody />);
    expect(container.textContent).toBe("");
  });

  it("asks the store for groups only, never duos", () => {
    // A 1v1 has its own Mirror in the reveal itself, and a room of two
    // names nobody the other did not. The exclusion is a filter argument
    // at the call site, which is easy to drop and impossible to notice.
    const seen: Array<string | undefined> = [];
    LIVE.social.groups = (mode?: string) => { seen.push(mode); return [GROUP]; };
    render(<LiveGroupsMirrorBody />);
    expect(seen).toContain("group");
    expect(seen).not.toContain(undefined);
  });
});

describe("LiveGroupsMirrorBody · the row is the stop's, not the data's", () => {
  it("draws Votes · People · Scores · Compare with a group, and with none", () => {
    render(<LiveGroupsMirrorBody />);
    const names = () => screen.getAllByRole("tab").map((t) => t.textContent);
    expect(names()).toEqual(["Votes", "People", "Scores", "Compare"]);
    expect(screen.queryByRole("tab", { name: "Answers" }), "the Answers tab outlived the majority").toBeNull();
    cleanup();
    LIVE.social.groups = () => [];
    render(<LiveGroupsMirrorBody />);
    expect(names()).toEqual(["Votes", "People", "Scores", "Compare"]);
  });

  it("opens on nothing, and a second tap closes what it opened", () => {
    render(<LiveGroupsMirrorBody />);
    expect(screen.queryByRole("tabpanel")).toBeNull();
    openTab("Votes");
    expect(screen.getByRole("tabpanel")).toBeTruthy();
    openTab("Votes");
    expect(screen.queryByRole("tabpanel")).toBeNull();
  });

  it("says why a tab is empty rather than drawing nothing", () => {
    LIVE.social.groups = () => [];
    render(<LiveGroupsMirrorBody />);
    openTab("Votes");
    expect(panel().textContent).toMatch(/Start a group and this fills in from the first reveal/);
  });
});

describe("LiveGroupsMirrorBody · Votes: who the room named", () => {
  it("lists the latest vote per role by pack, the holder's face and name first", () => {
    LIVE.social.revealHistory = () => HISTORY;
    render(<LiveGroupsMirrorBody />);
    openTab("Votes");
    const text = panel().textContent || "";
    expect(text).toMatch(/Who the room named/);
    expect(text).toMatch(/3 votes/);
    expect(text).toMatch(/Bank Heist/);
    expect(text).toMatch(/Desert Island/);
    // the holder leads the row (its face's initials ride in the text):
    // latest first, gathered by pack — the island's fire keeper, then the
    // heist's two
    const rows = within(panel()).getAllByRole("button", { expanded: false }).map((r) => r.textContent || "");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/You.*the fire keeper$/);
    expect(rows[1]).toMatch(/Bo & You.*the getaway driver · shared$/);
    expect(rows[2]).toMatch(/Ada.*the mastermind$/);
  });

  it("opens a row onto who voted for whom", () => {
    LIVE.social.revealHistory = () => HISTORY;
    render(<LiveGroupsMirrorBody />);
    openTab("Votes");
    fireEvent.click(within(panel()).getByRole("button", { name: /the mastermind/ }));
    const text = panel().textContent || "";
    expect(text).toMatch(/Who plans it\? · round 1/);
    expect(text).toMatch(/Adaby/);   // "Ada · by · [faces]"
    expect(text).toMatch(/Boby/);
    expect(within(panel()).getByLabelText("3 votes")).toBeTruthy();
    expect(within(panel()).getByLabelText("1 vote")).toBeTruthy();
  });

  it("says the first role is on the table with nothing revealed, and that it is reading while it reads", () => {
    render(<LiveGroupsMirrorBody />);
    openTab("Votes");
    expect(panel().textContent).toMatch(/No votes revealed yet — the first role is on the table/);
    cleanup();
    LIVE.social.reading = true;
    render(<LiveGroupsMirrorBody />);
    openTab("Votes");
    expect(panel().textContent).toMatch(/Reading the rounds/);
    expect(panel().textContent).not.toMatch(/No votes revealed yet/);
  });

  it("says the read failed on the Votes tab, not that the first role is on the table", () => {
    // "The first role is on the table" invites the reader to start a
    // room that may have played for weeks.
    LIVE.social.readFailed = true;
    render(<LiveGroupsMirrorBody />);
    openTab("Votes");
    expect(panel().textContent).toMatch(/Couldn’t read this room’s rounds/);
    expect(panel().textContent).not.toMatch(/No votes revealed yet/);
  });
});

describe("LiveGroupsMirrorBody · People: who casts the room like you, and everyone's seat", () => {
  it(`names nobody as casting like you on fewer than ${MIN_SHARED} shared rounds`, () => {
    // One shared round, and on it Ada named the same person I did. 100% —
    // and meaningless, because it is one coin flip.
    LIVE.social.revealHistory = () => [vote("2026-09-01", 1, "r_mind", { u_me: "u_bo", u_ada: "u_bo", u_bo: "u_ada" })];
    render(<LiveGroupsMirrorBody />);
    openTab("People");
    expect(panel().textContent).not.toMatch(/casts the room like you ·/);
  });

  it(`names the twin once there ARE ${MIN_SHARED} shared rounds, with the count the claim is made of`, () => {
    LIVE.social.revealHistory = () => [
      vote("2026-09-01", 1, "r_mind", { u_me: "u_bo", u_ada: "u_bo", u_bo: "u_ada" }),
      vote("2026-09-02", 2, "r_wheel", { u_me: "u_cy", u_ada: "u_cy", u_bo: "u_ada" }),
    ];
    render(<LiveGroupsMirrorBody />);
    openTab("People");
    expect(panel().textContent).toMatch(/Ada casts the room like you · same pick on 2 of 2 rounds/);
  });

  it("lists everyone's seat in the seat's line, with its count, and 'not named yet' under the floor", () => {
    LIVE.social.revealHistory = () => HISTORY;
    render(<LiveGroupsMirrorBody />);
    openTab("People");
    const text = panel().textContent || "";
    // Ada: 3 as the mastermind (engine) and my 1 as the fire keeper (heart)
    // · Bo: 2 as the driver (hands) and Ada's 1 as the mastermind (engine)
    // · Cy: none. The viewer is the seat line above, not a row here.
    expect(text).toMatch(/Adathe one who gets things going3 of 4 votes/);
    expect(text).toMatch(/Bothe one who gets it done2 of 3 votes/);
    expect(text).toMatch(/Cynot named yet/);
    expect(text).not.toMatch(/the Engine|the Hands/);
  });

  it("says it is reading, not that places await a first reveal", () => {
    LIVE.social.reading = true;
    render(<LiveGroupsMirrorBody />);
    openTab("People");
    expect(panel().textContent).toMatch(/Reading the rounds/);
    expect(panel().textContent).not.toMatch(/Places are taken from the first reveal/);
  });

  it("says the read failed on People, not that places await a first reveal", () => {
    LIVE.social.readFailed = true;
    render(<LiveGroupsMirrorBody />);
    openTab("People");
    expect(panel().textContent).toMatch(/Couldn’t read this room’s rounds/);
    expect(panel().textContent).not.toMatch(/Places are taken from the first reveal/);
  });
});

describe("LiveGroupsMirrorBody · Scores: how the group rates itself", () => {
  it("says the read failed on Scores, not that nothing has been rated", () => {
    LIVE.social.readFailed = true;
    render(<LiveGroupsMirrorBody />);
    openTab("Scores");
    expect(panel().textContent).toMatch(/Couldn’t read this room’s rounds/);
    expect(panel().textContent).not.toMatch(/No ratings yet/);
    // …AND THE COUNT ABOVE IT, which sat outside both guards and printed
    // "0 of 4 rated" — a numerator meaning "we could not ask" over a
    // denominator off the device's own bank, one line above the sentence
    // saying the read failed.
    expect(panel().textContent, "a ratio was stated over a read that did not happen")
      .not.toMatch(/0 of \d+ rated/);
  });

  it("draws a pole row per rating, strongest lean first, and opens onto the count", () => {
    LIVE.social.revealHistory = () => HISTORY;
    render(<LiveGroupsMirrorBody />);
    openTab("Scores");
    expect(panel().textContent).toMatch(/How the group rates itself/);
    expect(panel().textContent).toMatch(/1 of 4 rated/);
    const row = within(panel()).getByRole("button", { name: /Calm to Chaos/ });
    // 4·3·3·2 → mean 3 → 75
    expect(row.getAttribute("aria-label")).toContain("the group · 75");
    fireEvent.click(row);
    const text = panel().textContent || "";
    expect(text).toMatch(/This group's energy\?/);
    expect(text).toMatch(/Mostly chaos · 75 · round 4/);
    expect(text).toMatch(/3 of 4 lean Chaos · 1 of 4 in between · you said Chaos/);
  });

  it("says every fourth round asks the group about itself when none has", () => {
    render(<LiveGroupsMirrorBody />);
    openTab("Scores");
    expect(panel().textContent).toMatch(/No ratings yet — every fourth round asks the group about itself/);
    expect(panel().textContent).toMatch(/0 of 4 rated/);
  });
});

describe("LiveGroupsMirrorBody · Compare: your profile against theirs, and how they see you", () => {
  beforeEach(() => {
    LIVE.social.revealHistory = () => HISTORY;
    LIVE.myTestResults = () => ({
      big5: { dims: [
        { id: "O", value: 70 }, { id: "C", value: 60 }, { id: "E", value: 50 },
        { id: "A", value: 40 }, { id: "N", value: 30 },
      ] },
    });
  });

  it("lays your profile over the group's mean, under the group's name", async () => {
    // Two members either side of 50 on every axis, so the mean is 50 and
    // the arithmetic is visible rather than borrowed from one person.
    LIVE.scoresFor = (uid: string) => (uid === "u_ada"
      ? { big5: { O: 40, C: 40, E: 40, A: 40, N: 40 } }
      : uid === "u_bo"
        ? { big5: { O: 60, C: 60, E: 60, A: 60, N: 60 } }
        : null);
    render(<LiveGroupsMirrorBody />);
    openTab("Compare");
    // gaps 20, 10, 0, 10, 20 → mean 12 → 88.
    expect(await screen.findByText(/across 5 axes/)).toBeTruthy();
    const text = panel().textContent || "";
    expect(text).toMatch(/88/);
    expect(text).toMatch(/The Crew/);
    // "them" is the group WITHOUT the viewer: two of the three others
    expect(text).toMatch(/2 of 3 have taken one/);
  });

  it("says nobody here has finished a test rather than drawing one member", async () => {
    render(<LiveGroupsMirrorBody />);
    openTab("Compare");
    expect(await screen.findByText(/Nobody here has finished a test yet/i)).toBeTruthy();
  });

  it("does not compare you with yourself when you are the only one who has taken a test", async () => {
    LIVE.scoresFor = (uid: string) => (uid === "u_me"
      ? { big5: { O: 40, C: 40, E: 40, A: 40, N: 40 } }
      : null);
    render(<LiveGroupsMirrorBody />);
    openTab("Compare");
    expect(await screen.findByText(/Nobody here has finished a test yet/i)).toBeTruthy();
    expect(panel().textContent, "the viewer was counted as somebody they align with").not.toMatch(/across 5 axes/);
  });

  it("resolves the members' profiles in one batched call, without the viewer", async () => {
    render(<LiveGroupsMirrorBody />);
    openTab("Compare");
    await vi.waitFor(() => {
      expect(LIVE.loadNames).toHaveBeenCalledWith(["u_ada", "u_bo", "u_cy"]);
    });
  });

  it("chips the roles you hold, hollow when shared, and says how often the room named you", async () => {
    render(<LiveGroupsMirrorBody />);
    openTab("Compare");
    await screen.findByText(/How they see you/);
    const text = panel().textContent || "";
    expect(text).toMatch(/the fire keeper/);
    expect(text).toMatch(/the getaway driver/);
    expect(text).not.toMatch(/the mastermind/);
    expect(text).toMatch(/hollow = shared or contested/);
    // the others cast 9 votes on role votes; 5 named me (3 fire, 2 driver)
    expect(text).toMatch(/the room named you5 of 9 votes/);
  });

  it("says no roles yet, and no count, when the room has named nobody", async () => {
    LIVE.social.revealHistory = () => [];
    render(<LiveGroupsMirrorBody />);
    openTab("Compare");
    await screen.findByText(/How they see you/);
    expect(panel().textContent).toMatch(/No roles yet — the next vote could change that/);
    expect(panel().textContent).not.toMatch(/the room named you/);
    expect(panel().textContent).not.toMatch(/0 of 0/);
  });

  it("says the read failed on Compare too, not that nobody has been cast", async () => {
    // The roles list is empty for both "nobody has been named" and "the
    // rounds could not be read", and this card was the one lens card the
    // stop handed neither state to — so it said the first about the
    // second, under a header naming the room, on a stop whose own kicker
    // already says the read failed. The bar below it hides itself
    // correctly in the same state.
    // a refused read IS an empty history — that is the whole trap
    LIVE.social.readFailed = true;
    LIVE.social.revealHistory = () => [];
    render(<LiveGroupsMirrorBody />);
    openTab("Compare");
    await screen.findByText(/How they see you/);
    expect(panel().textContent).toMatch(/Couldn’t read this room’s rounds/);
    expect(panel().textContent, "a refused read was stated as an empty cast list")
      .not.toMatch(/No roles yet/);
  });
});

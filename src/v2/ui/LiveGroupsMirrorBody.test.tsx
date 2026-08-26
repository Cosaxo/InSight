// @vitest-environment jsdom
//
// LiveGroupsMirrorBody is the one panel that renders other people BY NAME,
// which D1 permits only inside a mutual circle. Everything it draws comes
// from reveal docs the viewer can already read, so it adds no disclosure of
// its own — but it does make claims ABOUT those people, and a wrong claim
// here is the fabrication the whole live Groups portrait replaced.
//
// The arithmetic is `data/groupPortrait.ts` and is well covered by
// groupPortrait.test.ts. What was not covered is this component: which
// claims it is willing to print, and which states it refuses to print
// anything for.
//
// The three properties worth executing, all of them recorded in D9's
// 2026-07-29 update:
//
//   - nobody is named "most like you" on fewer than MIN_SHARED shared days,
//     because one shared day is a coin flip and a label built on it is
//     exactly the invention this replaced;
//   - duos are excluded, because with two voters any disagreement is a 1-1
//     tie and the alignment ring would read 100% forever;
//   - a group with no reveals yet gets a sentence about sealing, not an
//     empty portrait or a zeroed one.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MIN_SHARED } from "../data/groupPortrait";
import { registerNav } from "../data/nav";

const LIVE = vi.hoisted(() => {
  const social = {
    groups: (mode?: string) => { void mode; return [] as Array<Record<string, unknown>>; },
    revealHistory: () => [] as Array<Record<string, unknown>>,
    loadRevealHistory: async () => {},
    bankQ: () => null as Record<string, unknown> | null,
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
    loadNames: vi.fn(async () => {}),
    scoresFor: (uid: string) => { void uid; return null as Record<string, Record<string, number>> | null; },
  };
});
vi.mock("../data/live", () => ({ default: LIVE }));

const { default: LiveGroupsMirrorBody } = await import("./LiveGroupsMirrorBody");

const GROUP = {
  id: "g1",
  name: "The Crew",
  mode: "group",
  memberUids: ["u_me", "u_ada", "u_bo"],
  memberNames: { u_me: "Me", u_ada: "Ada", u_bo: "Bo" },
};

// One revealed day. `mine`/`ada`/`bo` are option indexes.
const day = (d: string, me: number, ada: number, bo: number) => ({
  day: d,
  qid: "group-gu0",
  votes: { u_me: { optionIdx: me }, u_ada: { optionIdx: ada }, u_bo: { optionIdx: bo } },
});

// The stop's readings live behind its tab row since D190, closed on
// arrival like every other Mirror stop (D155). Every case that asserts on a
// reading opens the tab it lives in first — which is also the assertion
// that the tab is there and reaches its body.
const openTab = (label: string) =>
  fireEvent.click(screen.getByRole("tab", { name: label }));

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.uid = "u_me";
  LIVE.social.groups = () => [GROUP];
  LIVE.social.revealHistory = () => [];
  LIVE.social.bankQ = () => ({ prompt: "Who moves first?", options: ["Left", "Right"] });
  LIVE.myTestResults = () => ({});
  LIVE.scoresFor = () => null;
});
afterEach(cleanup);

describe("LiveGroupsMirrorBody · thin history makes no claims about people", () => {
  it(`names nobody "most like you" on fewer than ${MIN_SHARED} shared days`, () => {
    // One shared day, and on it Ada agreed with me perfectly. 100% — and
    // meaningless, because it is one coin flip. The panel must not print it.
    LIVE.social.revealHistory = () => [day("2026-07-29", 0, 0, 1)];
    render(<LiveGroupsMirrorBody />);
    openTab("People");
    const text = document.body.textContent || "";
    expect(text).not.toMatch(/most like you/i);
    expect(text).not.toMatch(/100%/);
  });

  it(`names someone once there ARE ${MIN_SHARED} shared days`, () => {
    // The control. Without it the assertion above passes for a panel that
    // never names anyone at all, which would be a different bug wearing the
    // same green tick.
    LIVE.social.revealHistory = () => [
      day("2026-07-29", 0, 0, 1),
      day("2026-07-28", 1, 1, 0),
    ];
    render(<LiveGroupsMirrorBody />);
    openTab("People");
    const text = document.body.textContent || "";
    expect(text).toMatch(/Ada/);
  });
});

describe("LiveGroupsMirrorBody · states it refuses to fake", () => {
  it("says answers are sealed when the group has no reveals yet", () => {
    LIVE.social.revealHistory = () => [];
    render(<LiveGroupsMirrorBody />);
    expect(screen.getByText(/answers stay sealed until the morning after/i)).toBeTruthy();
    // Not a zeroed portrait: an alignment of 0 of 0 days would read as
    // "you never agree with these people".
    expect(document.body.textContent).not.toMatch(/0 of 0/);
  });

  it("offers to start one when there are no groups, rather than rendering blank", () => {
    LIVE.social.groups = () => [];
    const { container } = render(<LiveGroupsMirrorBody />);
    // D172: the empty stop DRAWS — the rings and you — rather than
    // answering with a card of prose. The caption names the field and the
    // one action that cannot fill itself stays.
    expect(container.querySelector("svg"), "the empty field lost its drawing").toBeTruthy();
    expect(screen.getByText(/revealed with names the morning after/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start a group/i })).toBeTruthy();
  });

  it("sends Start-a-group to the GROUP scope, not just the daily tab", () => {
    // goTab("track") restores whatever daily scope was last open, so a user
    // coming from the 1v1 tab landed back on 1v1 — a button that promises a
    // group and delivers a duel. The pin is on the goNav key, because the
    // difference is one argument and the wrong one still "navigates".
    const goNav = vi.fn();
    // The nav registry since D248, not a window global.
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
});

describe("LiveGroupsMirrorBody · duos are excluded by construction (D9)", () => {
  it("asks the store for groups only, never duos", () => {
    // With two voters every disagreement is a 1-1 tie, so "with the
    // majority" is always true and the ring would read 100% forever. The
    // exclusion is a filter argument at the call site, which is easy to drop
    // and impossible to notice — the panel would just start showing duos
    // with a perfect score.
    const seen: Array<string | undefined> = [];
    LIVE.social.groups = (mode?: string) => { seen.push(mode); return [GROUP]; };
    render(<LiveGroupsMirrorBody />);
    expect(seen).toContain("group");
    expect(seen).not.toContain(undefined);
  });
});

describe("LiveGroupsMirrorBody · the day rows say what was actually chosen", () => {
  beforeEach(() => {
    LIVE.social.revealHistory = () => [
      day("2026-07-29", 0, 0, 1),
      day("2026-07-28", 1, 1, 0),
    ];
  });

  it("labels the majority option from the bank, not the option index", () => {
    render(<LiveGroupsMirrorBody />);
    openTab("Answers");
    // 2 of 3 picked index 0 on the 29th -> "Left"; index 1 on the 28th ->
    // "Right". Printing "Option 1" instead would be the fallback path for a
    // question the bank cannot resolve, and would be wrong here.
    expect(screen.getAllByText("Left").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Right").length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toMatch(/Option \d/);
  });

  it("falls back to a member's name for a pick question with no bank options", () => {
    // "pick" questions carry no bank options — their options ARE the
    // members — so the label has to resolve through memberUids instead.
    LIVE.social.bankQ = () => ({ prompt: "Who would you trust with a secret?", options: [] });
    render(<LiveGroupsMirrorBody />);
    openTab("Answers");
    // index 0 -> memberUids[0] -> "Me"; the row label is the picked member.
    expect(document.body.textContent).not.toMatch(/Option \d/);
    expect(document.body.textContent).toMatch(/Me|Ada|Bo/);
  });

  it("prefers a pick vote's own snapshot over the current roster order (D224)", () => {
    // The votes below were cast when the roster ordered differently: the
    // majority sits at index 0, which TODAY'S memberUids resolve to "Me" —
    // the wrong person. Each vote snapshots who it meant, and the label
    // must follow the snapshot, not the reshuffled index.
    LIVE.social.bankQ = () => ({ prompt: "Who would you trust with a secret?", options: [] });
    LIVE.social.revealHistory = () => [{
      day: "2026-07-29",
      qid: "group-gu0",
      votes: {
        u_me: { optionIdx: 2, pickUid: "u_ada" },
        u_ada: { optionIdx: 0, pickUid: "u_bo" },
        u_bo: { optionIdx: 0, pickUid: "u_bo" },
      },
    }];
    render(<LiveGroupsMirrorBody />);
    openTab("Answers");
    expect(screen.getByText("Bo")).toBeTruthy();
    expect(screen.queryByText("Me"), "the current-roster index leaked into a label").toBeNull();
    // …and my own line reads MY snapshot: index 2 is "Bo" today, but the
    // vote says who I actually picked.
    fireEvent.click(screen.getByText("Bo"));
    expect(screen.getByText(/you picked Ada/)).toBeTruthy();
  });

  it("reports alignment over days the viewer actually played", () => {
    // I played both days and was with the majority on both.
    render(<LiveGroupsMirrorBody />);
    expect(screen.getByText(/2 of 2 days/i)).toBeTruthy();
  });

  it("does not count days the viewer sat out as days they lost", () => {
    // No vote from u_me on the 28th. The denominator is days played, not
    // days revealed — counting a skipped day as a miss would make the ring
    // punish absence and read as disagreement.
    LIVE.social.revealHistory = () => [
      day("2026-07-29", 0, 0, 1),
      { day: "2026-07-28", qid: "group-gu0", votes: { u_ada: { optionIdx: 1 }, u_bo: { optionIdx: 0 } } },
    ];
    render(<LiveGroupsMirrorBody />);
    expect(screen.getByText(/1 of 1 days/i)).toBeTruthy();
  });
});

describe("LiveGroupsMirrorBody · the expand row is reachable without a mouse", () => {
  it("renders each day as a button with aria-expanded", () => {
    // It was a clickable <div>, which no keyboard could open. Asserted here
    // rather than left to the a11y ratchet, because the ratchet only counts
    // findings — it would stay green if this regressed to a <div> carrying
    // a role and a tabIndex but no working key handler.
    LIVE.social.revealHistory = () => [day("2026-07-29", 0, 0, 1)];
    render(<LiveGroupsMirrorBody />);
    openTab("Answers");
    const rows = screen.getAllByRole("button", { expanded: false });
    expect(rows.length).toBeGreaterThan(0);
  });
});

// ── the stop has a tab row, and has it when empty (D190) ─────────────
//
// D188 measured every Mirror stop's row against the prototype and recorded
// what it had not touched: "Circle and Groups have no row at all in live
// mode… a missing feature, not a misplaced one." This is the feature, and
// the case that matters is the EMPTY one — a row that appears only once a
// stop has data is a stop that reads as unfinished on the day a new account
// meets it, which is the same argument D160 made for drawing an empty field.
describe("LiveGroupsMirrorBody · the row is the stop's, not the data's", () => {
  const tabNames = () =>
    screen.getAllByRole("tab").map((t) => t.textContent);

  it("draws Answers · People · Compare with a group", () => {
    LIVE.social.revealHistory = () => [day("2026-07-29", 0, 0, 1)];
    render(<LiveGroupsMirrorBody />);
    expect(tabNames()).toEqual(["Answers", "People", "Compare"]);
  });

  it("draws the same row with no groups at all", () => {
    LIVE.social.groups = () => [];
    render(<LiveGroupsMirrorBody />);
    expect(tabNames()).toEqual(["Answers", "People", "Compare"]);
    // …and the empty field above it, which is what the stop is FOR before
    // a group exists.
    expect(screen.getByRole("button", { name: /Start a group/i })).toBeTruthy();
  });

  it("opens on nothing, and a second tap closes what it opened", () => {
    // D155's shape: a stop with nothing open is a header, a field and a tab
    // bar sitting where a tab bar belongs.
    LIVE.social.revealHistory = () => [day("2026-07-29", 0, 0, 1)];
    render(<LiveGroupsMirrorBody />);
    expect(screen.queryByRole("tabpanel")).toBeNull();
    openTab("Answers");
    expect(screen.getByRole("tabpanel")).toBeTruthy();
    openTab("Answers");
    expect(screen.queryByRole("tabpanel")).toBeNull();
  });

  it("says why a tab is empty rather than drawing nothing", () => {
    // A card that renders null is fine when it is one of two things stacked
    // on a page; behind a tab somebody tapped, it reads as a broken screen.
    LIVE.social.groups = () => [];
    render(<LiveGroupsMirrorBody />);
    openTab("People");
    expect(screen.getByRole("tabpanel").textContent).toMatch(/Start a group and this fills in/i);
  });
});

// ── Compare is the profile drawing here too (D193) ──────────────────
//
// The group is the population that has to be read from PEOPLE rather than
// counts: its history is a stack of its own reveals, so there are no test
// answers to fold, and what it does have is members whose completed
// instruments are public since D98. The two cases are the reading and the
// refusal, because a group where nobody has sat a test must say so rather
// than draw a shape out of one member.
describe("LiveGroupsMirrorBody · Compare averages the members' own results", () => {
  beforeEach(() => {
    LIVE.social.revealHistory = () => [day("2026-07-29", 0, 0, 1)];
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
    const panel = screen.getByRole("tabpanel").textContent || "";
    expect(panel).toMatch(/88/);
    expect(panel).toMatch(/The Crew/);
    // The basis, over the members who actually have one — and "them" is
    // the group WITHOUT the viewer, so the denominator is two, not three.
    // This read "2 of 3" while the viewer was inside their own comparison
    // population: u_me has no result here, so the third slot was the
    // viewer being counted as somebody they might align with.
    expect(panel).toMatch(/2 of 2 have taken one/);
  });

  it("says nobody here has finished a test rather than drawing one member", async () => {
    render(<LiveGroupsMirrorBody />);
    openTab("Compare");
    expect(await screen.findByText(/Nobody here has finished a test yet/i)).toBeTruthy();
  });

  // The sharp case for the population. When the VIEWER is the only member
  // with a result, "them" is empty — and the lens has an empty state for
  // exactly that. Passing the whole membership put the viewer on both
  // sides instead, so the card compared them with themselves and printed a
  // perfect score: "You ↔ The Crew · 100% aligned · 1 of 3 have taken one".
  it("does not compare you with yourself when you are the only one who has taken a test", async () => {
    LIVE.scoresFor = (uid: string) => (uid === "u_me"
      ? { big5: { O: 40, C: 40, E: 40, A: 40, N: 40 } }
      : null);
    render(<LiveGroupsMirrorBody />);
    openTab("Compare");
    expect(await screen.findByText(/Nobody here has finished a test yet/i)).toBeTruthy();
    const panel = screen.getByRole("tabpanel").textContent || "";
    expect(panel, "the viewer was counted as somebody they align with").not.toMatch(/100/);
    expect(panel).not.toMatch(/across 5 axes/);
  });

  it("resolves the members' profiles in one batched call", async () => {
    render(<LiveGroupsMirrorBody />);
    openTab("Compare");
    // The scores ride the same document as the names (live.ts loadNames),
    // so a group's Compare costs one read per member and not one per
    // member per instrument — and not one for the VIEWER, whose profile
    // this side of the comparison does not contain.
    await vi.waitFor(() => {
      expect(LIVE.loadNames).toHaveBeenCalledWith(["u_ada", "u_bo"]);
    });
  });
});

// ── the cross-group line (D287's groups half, D288 runbook phase 6) ──
//
// "Runs most like you" is a superlative, so it renders only when it is a
// real comparison: two or more groups whose history clears the roles floor
// (MIN_GROUP days the viewer played). Below either bar the picture stands
// alone — one group is a caption, thin history is a guess.
describe("LiveGroupsMirrorBody · which scene runs most like you", () => {
  const GROUP2 = {
    id: "g2",
    name: "Book Club",
    mode: "group",
    memberUids: ["u_me", "u_ada", "u_bo"],
    memberNames: { u_me: "Me", u_ada: "Ada", u_bo: "Bo" },
  };
  // The Crew: with the majority on all three days · Book Club: on one of three
  const CREW_DAYS = [day("2026-08-01", 0, 0, 1), day("2026-08-02", 1, 1, 0), day("2026-08-03", 0, 0, 0)];
  const CLUB_DAYS = [day("2026-08-01", 1, 0, 0), day("2026-08-02", 0, 1, 1), day("2026-08-03", 0, 0, 0)];

  it("names the most-aligned group, with the count the claim is made of", () => {
    LIVE.social.groups = () => [GROUP, GROUP2];
    LIVE.social.revealHistory = ((gid: string) => (gid === "g1" ? CREW_DAYS : CLUB_DAYS)) as never;
    render(<LiveGroupsMirrorBody />);
    const line = screen.getByText(/runs most like you/);
    expect(line.textContent).toContain("The Crew");
    expect(line.textContent).toContain("3 of the 3 days you played");
  });

  it("crowns the deep record over the thin one — the printed pct cannot decide it", () => {
    // D277 §2's rule, and the site that had not converted when bfb5e9f6
    // said every sibling had: two days both with the majority is 100% and
    // 12 of 15 is 80%, so a pct sort announces the coin that landed twice.
    const withMaj = (d: string) => day(d, 0, 0, 1);   // me with ada, bo apart
    const against = (d: string) => day(d, 1, 0, 0);   // me alone
    const thin = [withMaj("2026-08-01"), withMaj("2026-08-02")];
    const deep = Array.from({ length: 15 }, (_, i) => {
      const d = `2026-07-${String(i + 1).padStart(2, "0")}`;
      return i < 12 ? withMaj(d) : against(d);
    });
    LIVE.social.groups = () => [GROUP, GROUP2];
    LIVE.social.revealHistory = ((gid: string) => (gid === "g1" ? thin : deep)) as never;
    render(<LiveGroupsMirrorBody />);
    const line = screen.getByText(/runs most like you/);
    expect(line.textContent).toContain("Book Club");
    expect(line.textContent).toContain("12 of the 15 days you played");
  });

  it("says nothing when the field is flat — a name tiebreak is not a finding", () => {
    // The comparator's last clause is a NAME tiebreak that never returns
    // 0, so two circles on identical figures had one crowned
    // alphabetically and presented as the answer. groupPortrait's own
    // twin/breaks-ranks labels carry the same guard.
    LIVE.social.groups = () => [GROUP, GROUP2];
    LIVE.social.revealHistory = (() => CREW_DAYS) as never;
    render(<LiveGroupsMirrorBody />);
    expect(screen.queryByText(/runs most like you/)).toBeNull();
  });

  it("says nothing with one group — a superlative of one is a caption", () => {
    LIVE.social.groups = () => [GROUP];
    LIVE.social.revealHistory = (() => CREW_DAYS) as never;
    render(<LiveGroupsMirrorBody />);
    expect(screen.queryByText(/runs most like you/)).toBeNull();
  });

  it("says nothing while the second group is under the floor", () => {
    LIVE.social.groups = () => [GROUP, GROUP2];
    LIVE.social.revealHistory = ((gid: string) => (gid === "g1" ? CREW_DAYS : CLUB_DAYS.slice(0, 1))) as never;
    render(<LiveGroupsMirrorBody />);
    expect(screen.queryByText(/runs most like you/)).toBeNull();
  });
});

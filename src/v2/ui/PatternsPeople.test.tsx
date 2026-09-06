// @vitest-environment jsdom
//
// The People lens's four states (D214), mounted: the render is the one
// thing the pure tests cannot execute, and this lens has more states than
// field — a viewer too new to place, a crowd too thin to claim, a crowd
// still loading (absent, not empty — loadVoters' own distinction), and
// the placed field with its exact-count card.
//
// `../data/live` is mocked rather than booted (the LiveCallCard idiom) —
// it imports Firebase, and what this lens consumes is three members:
// voters, votersLoading, loadVoters.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PoolItem } from "../data/patterns";
import type { PeopleRow } from "../data/peopleMap";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  budgetPaused: false as boolean,
  subscribe: () => () => {},
  loadVoters: vi.fn(() => Promise.resolve()),
  voters: (): PeopleRow[] | null => [],
  votersLoading: (): boolean => false,
  loadFollows: vi.fn(() => Promise.resolve()),
  follows: (): string[] | null => [],
  followsLoading: (): boolean => false,
  anchors: (): Record<string, string> => ({}),
}));

vi.mock("../data/live", () => ({ default: LIVE, LIVE }));

const { default: PatternsPeople } = await import("./PatternsPeople");

const item = (qid: string, mine: number | null = 1): PoolItem =>
  ({
    q: { id: qid, text: `Q ${qid}`, cat: null, options: [{ id: "0", label: "Yes" }, { id: "1", label: "No" }] },
    L: [0.9, 0.05],
    n: 60,
    marginal: 0,
    mine,
  }) as unknown as PoolItem;

const ITEMS = ["q1", "q2", "q3", "q4", "q5", "q6"].map((q) => item(q));

const row = (uid: string, optionIdx: number): PeopleRow => ({
  uid,
  optionIdx,
  name: uid.toUpperCase(),
  anchors: { city: "Oslo, NO", age: "25-34" },
  isMe: false,
});

/** Ten people in every list — well past PEOPLE_MIN_CROWD once placed. */
const CROWD: PeopleRow[] = [
  ...["ada", "ben", "cyd", "dot", "eli"].map((u) => row(u, 0)),
  ...["fay", "gus", "hal", "ivy", "jax"].map((u) => row(u, 1)),
];

const noop = () => {};

beforeEach(() => {
  LIVE.voters = () => CROWD;
  LIVE.votersLoading = () => false;
  LIVE.budgetPaused = false;
  LIVE.loadVoters = vi.fn(() => Promise.resolve());
  LIVE.follows = () => [];
  LIVE.followsLoading = () => false;
  LIVE.anchors = () => ({});
});
afterEach(cleanup);

describe("the viewer's own gate", () => {
  it("offers the Oracle instead of a position when they are below basis", () => {
    const onOracle = vi.fn();
    render(<PatternsPeople items={[item("q1"), item("q2", null)]} version={1} onOracle={onOracle} />);
    expect(screen.getByText("Not placed yet")).toBeTruthy();
    fireEvent.click(screen.getByText("Ask the Oracle"));
    expect(onOracle).toHaveBeenCalled();
  });
});

describe("the thin and loading states", () => {
  it("says the crowd is thin once the lists have answered", () => {
    LIVE.voters = () => [row("only", 0)];
    render(<PatternsPeople items={ITEMS} version={1} onOracle={noop} />);
    expect(screen.getByText("Crowd too thin")).toBeTruthy();
  });

  it("says it is still reading while lists are absent, not that nobody is there", () => {
    LIVE.voters = () => null;
    LIVE.votersLoading = () => true;
    render(<PatternsPeople items={ITEMS} version={1} onOracle={noop} />);
    expect(screen.getByText("Reading the crowd…")).toBeTruthy();
    expect(screen.queryByText("Crowd too thin")).toBeNull();
  });

  it("says the circle could not be READ, never that it is empty", () => {
    // loadFollows leaves its cache null on failure on purpose — "could not
    // ask" must not render as "you follow nobody". This lens collapsed the
    // null to an empty set, so the keep filter rejected everyone and the
    // screen stated that nobody from your circle is placed here: a
    // confident claim about a list that never arrived.
    LIVE.follows = () => null;
    LIVE.followsLoading = () => false;
    LIVE.voters = () => [row("only", 0)];
    render(<PatternsPeople items={ITEMS} version={1} pop="circle" onOracle={noop} />);
    expect(screen.getByText("Could not read your circle")).toBeTruthy();
    expect(screen.queryByText("Crowd too thin")).toBeNull();
  });

  it("still says thin when the circle really did load and is small", () => {
    // The contrast: an empty follow list that WAS read is a thin crowd,
    // and must keep saying so.
    LIVE.follows = () => [];
    LIVE.followsLoading = () => false;
    LIVE.voters = () => [row("only", 0)];
    render(<PatternsPeople items={ITEMS} version={1} pop="circle" onOracle={noop} />);
    expect(screen.getByText("Crowd too thin")).toBeTruthy();
    expect(screen.queryByText("Could not read your circle")).toBeNull();
  });

  it("says PAUSED under the read breaker, never that the crowd is thin (D332)", () => {
    // The lists were refused, not read — "Crowd too thin" would be a
    // claim about a crowd nothing looked at.
    LIVE.voters = () => null;
    LIVE.budgetPaused = true;
    render(<PatternsPeople items={ITEMS} version={1} onOracle={noop} />);
    expect(screen.getByText("Paused for now")).toBeTruthy();
    expect(screen.getByText(/costs in check/i)).toBeTruthy();
    expect(screen.queryByText("Crowd too thin")).toBeNull();
  });
});

describe("the placed field", () => {
  it("draws the crowd, and the guide states the basis it was placed on", async () => {
    // the foot card retired into the guide legend (2026-09-06): the
    // crowd count, the floor and the sample sentence render behind the
    // tab's ⓘ — moved, not deleted (D146), and still `basis`, never the
    // viewer's own answered count
    const { container } = render(<PatternsPeople items={ITEMS} version={1} guide={true} onOracle={noop} />);
    expect(screen.getByText(/10 people · everyone who answered at least 4 of the 6 questions/)).toBeTruthy();
    expect(screen.getByText(/latest answers/)).toBeTruthy();
    expect(container.querySelectorAll('svg g[role="button"]').length).toBe(10);
    // one bounded load per fetched question, no more — the loop is
    // sequential (each await yields), so the count is settled, not read
    await vi.waitFor(() => {
      expect((LIVE.loadVoters as ReturnType<typeof vi.fn>).mock.calls.length).toBe(ITEMS.length);
    });
  });

  it("keeps the basis sentences off the standing page — legend only with the ⓘ", () => {
    render(<PatternsPeople items={ITEMS} version={1} onOracle={noop} />);
    expect(document.querySelector(".ln-key")).toBeNull();
    expect(screen.queryByText(/everyone who answered at least/)).toBeNull();
  });

  it("colours every dot by agreement, in three steps, and says so in words", () => {
    // the viewer answered optionIdx 1 everywhere (item(mine = 1) encodes
    // option 0)… so the five who picked 0 agree with them on all six and
    // the five who picked 1 disagree on all six: two of the three steps,
    // both at the extremes, with nobody in the middle.
    const { container } = render(<PatternsPeople items={ITEMS} version={1} guide={true} onOracle={noop} />);
    const fills = [...container.querySelectorAll('svg g[role="button"] circle:last-of-type')]
      .map((c) => c.getAttribute("fill"));
    expect(new Set(fills).size).toBe(2);
    expect(fills.filter((f) => f === "oklch(0.50 0.11 282)").length).toBe(5); // mostly agrees (paper ink)
    expect(fills.filter((f) => f === "oklch(0.58 0.11 35)").length).toBe(5);  // mostly disagrees
    // and the legend says the three steps rather than leaving them to be
    // decoded — the size rule with them
    expect(screen.getByText("mostly agrees with you")).toBeTruthy();
    expect(screen.getByText("split")).toBeTruthy();
    expect(screen.getByText("mostly disagrees")).toBeTruthy();
    expect(screen.getByText(/bigger dot = more answers in common/)).toBeTruthy();
  });

  it("rows the three most agreeing NAMED people, each with its basis and the shared answer", () => {
    render(<PatternsPeople items={ITEMS} version={1} onOracle={noop} />);
    const rows = [...screen.getByRole("list", { name: /most like you/i }).querySelectorAll("button")];
    expect(rows.length).toBe(3); // PEOPLE_ALIKE (2026-09-06), never a fourth
    for (const r of rows) {
      // every row states the count it is claiming, like the card does —
      // and the answer behind it, or the honest split
      expect(r.textContent).toMatch(/agrees \d+ of \d+/);
      expect(r.textContent).toMatch(/Both said|You split on everything/);
    }
    // and a row selects the same person the field would
    fireEvent.click(rows[0]!);
    expect(screen.getByText(/Agrees with you on/)).toBeTruthy();
  });

  it("never rows a nameless account — no invented identity (D167)", () => {
    LIVE.voters = () => CROWD.map((r) => ({ ...r, name: "" }));
    render(<PatternsPeople items={ITEMS} version={1} onOracle={noop} />);
    expect(screen.queryByRole("list", { name: /most like you/i })).toBeNull();
    fireEvent.click(document.querySelector('svg g[role="button"]')!);
    // …and the tapped dot's on-field name is the honest word, never an
    // invented one (it renders on the card and beside the dot)
    expect(screen.getAllByText("Someone").length).toBeGreaterThan(0);
  });

  it("narrows to the circle without changing anyone's numbers (D216)", () => {
    LIVE.follows = () => ["ada", "gus"];
    const { container } = render(
      <PatternsPeople items={ITEMS} version={1} pop="circle" onOracle={noop} />,
    );
    // two friends placed — the circle's own floor draws from the first
    expect(container.querySelectorAll('svg g[role="button"]').length).toBe(2);
    fireEvent.click(container.querySelector('svg g[role="button"]')!);
    expect(screen.getByText("your circle")).toBeTruthy();
    expect(screen.getByText(/Agrees with you on/)).toBeTruthy();
  });

  it("says the circle's own honest empty state, not the stranger one", () => {
    LIVE.follows = () => [];
    render(<PatternsPeople items={ITEMS} version={1} pop="circle" onOracle={noop} />);
    expect(screen.getByText(/Nobody from your circle is placed here yet/)).toBeTruthy();
  });

  it("narrows to the viewer's country by the frozen anchor code", () => {
    LIVE.anchors = () => ({ city: "Oslo, NO" });
    // ten at home, ten abroad — country keeps its full anonymous-crowd
    // floor, so the in-country half must clear it on its own
    const abroad = [
      ...CROWD,
      ...Array.from({ length: 10 }, (_, i) => ({ ...row(`de${i}`, i % 2), anchors: { city: "Berlin, DE" } })),
    ];
    LIVE.voters = () => abroad;
    const { container } = render(
      <PatternsPeople items={ITEMS} version={1} pop="country" onOracle={noop} />,
    );
    expect(container.querySelectorAll('svg g[role="button"]').length).toBe(CROWD.length);
  });

  it("answers a tap with the exact count and the rarest shared answer", () => {
    const { container } = render(<PatternsPeople items={ITEMS} version={1} onOracle={noop} />);
    const dot = container.querySelector('svg g[role="button"]');
    expect(dot).toBeTruthy();
    fireEvent.click(dot as Element);
    expect(screen.getByText(/Agrees with you on/)).toBeTruthy();
    // agreeing faction shows the tie; the opposite one shows the split —
    // either way the sentence is a claim with a basis, never a bare score
    expect(screen.getByText(/You both said|You split on everything/)).toBeTruthy();
  });
});

// ── the caption made a rule the projection cannot keep ─────────────
//
// "The closer two dots, the more alike their answers" is not true as a
// rule. Position is components 0 and 1 of an eight-dimensional solve, so
// two people can sit together on the field while disagreeing on
// everything the other six dimensions carry — measured on this fold at
// 16px apart, agreeing on one answer of twelve.
//
// What the caption may say is what the position IS. Likeness itself is
// carried by the rail's chips, which rank on it now.
describe("what the field says it is drawing", () => {
  it("does not promise that nearby dots answer alike", () => {
    render(<PatternsPeople items={ITEMS} version={1} onOracle={noop} />);
    expect(document.body.textContent, "the caption still states a rule the projection cannot keep")
      .not.toMatch(/closer two dots/i);
  });

  it("still says what a dot is, one tap away, rather than dropping the explanation", () => {
    // The control: deleting the sentence outright would leave a field of
    // dots with nothing saying what they are. Since 2026-09-06 it lives
    // in the guide legend — moved behind the ⓘ, not deleted (D146).
    render(<PatternsPeople items={ITEMS} version={1} guide={true} onOracle={noop} />);
    expect(document.body.textContent).toMatch(/each dot is a person who answered/i);
    expect(document.body.textContent).toMatch(/placed by how they answered/i);
  });
});

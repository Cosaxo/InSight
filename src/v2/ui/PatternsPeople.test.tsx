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
  it("draws the crowd, states the basis, and kicks the bounded loads", async () => {
    const { container } = render(<PatternsPeople items={ITEMS} version={1} onOracle={noop} />);
    expect(screen.getByText(/people placed around you/)).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText(/latest answers/)).toBeTruthy();
    expect(container.querySelectorAll('svg g[role="button"]').length).toBe(10);
    // one bounded load per fetched question, no more — the loop is
    // sequential (each await yields), so the count is settled, not read
    await vi.waitFor(() => {
      expect((LIVE.loadVoters as ReturnType<typeof vi.fn>).mock.calls.length).toBe(ITEMS.length);
    });
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

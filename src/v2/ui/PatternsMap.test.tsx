// @vitest-environment jsdom
//
// The Map lens (D215, redrawn 2026-09-02), mounted over real geometry (the
// pure engine runs; only the stores are mocked): the RING draws, its
// topic groups are contiguous and in WORLD_TOPICS order, a chord exists
// only for a real edge, the idle card leads with the strongest link, a
// selection reads its own links — and every counted sentence states its
// basis (D146; the prototype counted an invented population and had no
// basis to state, so this is the port's own rule to hold).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { PairSay, PoolItem } from "../data/patterns";

const PATTERNS = vi.hoisted(() => ({
  say: vi.fn(async (): Promise<PairSay | null> => null),
}));
vi.mock("../data/patterns", () => ({ default: PATTERNS, PATTERNS }));

const LIVE = vi.hoisted(() => ({ enabled: true, vote: vi.fn() }));
vi.mock("../data/live", () => ({ default: LIVE, LIVE }));

const { default: PatternsMap } = await import("./PatternsMap");

const vec = (...head: number[]): number[] =>
  Array.from({ length: 8 }, (_, i) => head[i] ?? 0);

const item = (qid: string, L: number[], mine: number | null, cat = "sport"): PoolItem =>
  ({
    q: { id: qid, text: `Q ${qid}`, cat, options: [{ id: `${qid}:0`, label: `${qid}-yes` }, { id: `${qid}:1`, label: `${qid}-no` }] },
    L,
    n: 60,
    marginal: 0,
    mine,
  }) as unknown as PoolItem;

/** qa answered "yes", qb answered "no", qc open — one tight factor. */
const ITEMS = [
  item("qa", vec(1, 0), 1),
  item("qb", vec(0.9, 0.1), -1),
  item("qc", vec(0.8, -0.1), null),
];

const SAY: PairSay = {
  pick: "qa-yes", then: "qb-yes", pickIdx: 0, thenIdx: 0, pct: 78, base: 50, both: 40,
};

/** The dots on the rim. The beacon's own dot is drawn on the top layer, so
 *  it is not one of these — see the case below. */
const dots = (c: HTMLElement) => [...c.querySelectorAll<SVGCircleElement>('circle[r="3.1"]')];
/** The chords: the first group in the field, drawn under everything else. */
const chords = (c: HTMLElement) => [...c.querySelectorAll<SVGPathElement>("svg > g:first-child > path")];

beforeEach(() => {
  PATTERNS.say.mockResolvedValue(SAY);
  LIVE.vote = vi.fn();
});
afterEach(cleanup);

describe("the idle card counts one pool, not two", () => {
  // The card reads "<n> links hold across the <m> questions in the pool".
  // `n` was filtered to the picked topic and `m` was not, so with a topic
  // chosen neither number described anything real — and the topic word the
  // sibling arm prints was missing, so nothing said the count had been
  // narrowed. Every case in this file rendered `topic="all"`, which is the
  // one value where the two agree.
  const MIXED = [
    item("sa", vec(1, 0), 1, "sport"),
    item("sb", vec(0.9, 0.1), -1, "sport"),
    item("fa", vec(0, 1), 1, "food"),
    item("fb", vec(0.1, 0.9), -1, "food"),
    item("fc", vec(-0.1, 0.8), null, "food"),
  ];
  const idle = (c: HTMLElement) => c.querySelector(".qm-idle")?.textContent ?? "";

  it("counts only the picked topic's questions, and says which topic", async () => {
    PATTERNS.say.mockResolvedValue(null);
    const { container } = render(<PatternsMap items={MIXED} version={1} topic="sport" />);
    const text = idle(container);
    expect(text, "the idle card did not render — the case is vacuous").toContain("links hold across");
    expect(text, "the whole pool's question count was printed beside a topic-filtered link count")
      .toContain("across the 2 questions");
    expect(text, "nothing on the line said the number was narrowed to a topic")
      .toMatch(/in Sport/i);
    expect(text).not.toContain("across the 5 questions");
  });

  it("still counts the whole pool when no topic is picked", async () => {
    // THE CONTROL. Without it the case above is satisfied by a card that
    // always filters, which would understate the count on the default view
    // every reader starts from.
    PATTERNS.say.mockResolvedValue(null);
    const { container } = render(<PatternsMap items={MIXED} version={1} topic="all" />);
    const text = idle(container);
    expect(text).toContain("across the 5 questions");
    expect(text, "the unfiltered card should name no topic").toContain("in the pool");
  });
});

describe("the ring at rest", () => {
  it("draws every question and leads with the strongest link, basis stated", async () => {
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    // every question is on the rim: two ordinary dots plus the beacon,
    // which draws the third on its own layer so no neighbour buries it
    expect(dots(container).length).toBe(ITEMS.length - 1);
    // the beacon lost its visible words (2026-09-06) but not its name
    expect(screen.getByLabelText(/Answer next/)).toBeTruthy();
    expect(await screen.findByText(/Strongest link/)).toBeTruthy();
    // the compact sentence keeps the basis — a count may move, not vanish
    expect(screen.getByText(/counted over the 40 people in both samples/)).toBeTruthy();
    // the hub counts what you have answered, out of the pool — the serif
    // figure over its caption since 2026-09-06
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("OF 3")).toBeTruthy();
  });

  it("draws a chord only for a real link, and nothing written on the field", async () => {
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    // three questions, each carrying its strongest few, deduped — three
    // pairs, so three chords and not the six a full mesh would draw
    expect(chords(container).length).toBe(3);
    // the strongest link is said once UNDER the field (2026-09-06 deleted
    // the on-field callout pill — the only <rect> the svg ever carried)
    expect(await screen.findByText("78%")).toBeTruthy();
    expect(container.querySelectorAll("svg rect").length).toBe(0);
  });

  it("groups the rim by topic, in the palette's own order", () => {
    // `food` sorts after `sport` in WORLD_TOPICS, so its dot comes last
    // however the pool is ordered — the ring must not follow the array
    const mixed = [
      item("qa", vec(1, 0), 1, "food"),
      item("qb", vec(0.9, 0.1), -1, "sport"),
      item("qc", vec(0.8, -0.1), 1, "food"),
    ];
    const { container } = render(<PatternsMap items={mixed} version={1} topic="all" />);
    // one arc per topic present, never one per question
    expect(container.querySelectorAll(".qm-arc").length).toBe(2);
    // the two `food` dots are neighbours on the rim: their angular gap is
    // one step, and the `sport` dot sits across the group gap from them
    const [qa, qb, qc] = dots(container).map((d) => ({
      x: Number(d.getAttribute("cx")), y: Number(d.getAttribute("cy")),
    }));
    const ang = (p: { x: number; y: number }) => Math.atan2(p.y - 176, p.x - 176);
    const gap = (a: number, b: number) => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    // qa and qc share a topic; qb is the other group
    expect(gap(ang(qa), ang(qc))).toBeLessThan(gap(ang(qa), ang(qb)));
  });

  it("puts a short group's name inside the rim, where it cannot overrun its band", () => {
    // one lone `sport` question among thirty: its band is a sliver, so
    // the along-the-arc form would overrun it — the 2026-09-06 layout
    // seats the name INSIDE the rim instead, straight (no rotation),
    // clear of the hub and short of the dots
    const many = [
      ...Array.from({ length: 30 }, (_, i) => item(`f${i}`, vec(0.5 + (i % 3) * 0.1, 0.1), null, "food")),
      item("qs", vec(1, 0), 1, "sport"),
    ];
    const { container } = render(<PatternsMap items={many} version={1} topic="all" />);
    const lab = [...container.querySelectorAll("svg text")].find((t) => t.textContent === "SPORT");
    expect(lab, "the short group lost its name entirely").toBeTruthy();
    expect(lab!.getAttribute("transform"), "an in-rim label must sit straight").toBeNull();
    const x = Number(lab!.getAttribute("x")), y = Number(lab!.getAttribute("y"));
    const d = Math.hypot(x - 176, y - 176);
    expect(d, "the label left the field").toBeLessThan(131);
    expect(d, "the label sits on the hub").toBeGreaterThan(44);
  });
});

describe("the legend behind the guide ⓘ (2026-09-06)", () => {
  it("renders the key and the link sentence only while the guide is open", () => {
    const { container, rerender } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    expect(container.querySelector(".ln-key")).toBeNull();
    rerender(<PatternsMap items={ITEMS} version={1} topic="all" guide={true} />);
    // the retired title's sentence leads the legend — a basis sentence
    // may move one tap away, it may not be deleted (D146)
    expect(screen.getByText(/a line joins two questions when/i)).toBeTruthy();
    expect(screen.getByText("still open")).toBeTruthy();
    expect(screen.getByText("tap a dot for its links")).toBeTruthy();
  });
});

describe("the beacon (2026-08-26)", () => {
  it("is a tap target of its own — the map's one instruction opens the pick", () => {
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    const g = screen.getByLabelText(/Answer next/);
    fireEvent.click(g.querySelector("circle")!); // the invisible hit circle
    expect(screen.getByText("Q qc")).toBeTruthy(); // the open question's card
    expect(screen.getByText("qc-yes")).toBeTruthy(); // with its options offered
    expect(container.querySelector(".ln-pulse")).toBeNull(); // and the beacon rests while selected
  });
});

describe("a selection", () => {
  it("reads the question's own links out loud and says when you broke one", async () => {
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    // tap the first dot (qa) — its links load as exact sentences
    fireEvent.click(dots(container)[0]!);
    expect(screen.getByText("Q qa")).toBeTruthy();
    expect(screen.getByText(/you said qa-yes/)).toBeTruthy();
    const sentences = await screen.findAllByText(/pick/, { exact: false });
    expect(sentences.length).toBeGreaterThan(0);
    // the viewer picked qa-yes (the pattern's pick) but qb-no on the
    // linked question — the card owes them the break, by name
    expect((await screen.findAllByText(/you went qb-no/)).length).toBeGreaterThan(0);
    // and every counted sentence carries its basis
    expect((await screen.findAllByText(/of the 40 in both samples/)).length).toBeGreaterThan(0);
  });

  it("dims the field to that question's own web", () => {
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    expect(chords(container).length).toBe(3); // the whole web, at rest
    fireEvent.click(dots(container)[0]!);
    // now only qa's own three-nearest survive — here its two real links
    const lit = chords(container);
    expect(lit.length).toBe(2);
    for (const c of lit) expect(Number(c.getAttribute("opacity"))).toBeCloseTo(0.85, 5);
  });

  it("offers the options on an open question and votes through LIVE", () => {
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    // qc is the beacon at rest, so its dot is the one on the top layer
    fireEvent.click(screen.getByLabelText(/Answer next/).querySelector("circle")!);
    fireEvent.click(screen.getByText("qc-yes"));
    expect(LIVE.vote).toHaveBeenCalledWith("qc", "qc:0");
    expect(container.querySelector(".qm-pop")).toBeTruthy(); // the dot pops where you voted
  });

  // WHAT THE EMPTY NOTE MAY CLAIM. `say` answers null for two facts about
  // the crowd — under the twelve-voter floor, and two questions that
  // simply do not predict each other, which is the ordinary one — and the
  // panel's own catch used to fold a REFUSED read into the same null. The
  // note named a sample size for all three, so it stated "not enough
  // people in both samples" over a hundred voters and over a read that
  // never happened. This line had no test at all.
  it("says nothing predicts strongly enough, rather than blaming the sample", async () => {
    PATTERNS.say.mockResolvedValue(null);
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    fireEvent.click(container.querySelectorAll("svg g g")[0]!);
    expect(await screen.findByText(/predicts its neighbours strongly enough/)).toBeTruthy();
    expect(screen.queryByText(/enough people in both samples/)).toBeNull();
  });

  it("…and says the read refused when it did", async () => {
    PATTERNS.say.mockRejectedValue(new Error("permission-denied"));
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    fireEvent.click(container.querySelectorAll("svg g g")[0]!);
    expect(await screen.findByText(/Couldn’t read the crowd/)).toBeTruthy();
    expect(screen.queryByText(/predicts its neighbours/)).toBeNull();
  });
});

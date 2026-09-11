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
import type { MapRow, RowSay } from "../data/patterns";

const PATTERNS = vi.hoisted(() => ({
  sayRow: vi.fn(async (): Promise<RowSay | null> => null),
}));
vi.mock("../data/patterns", () => ({ default: PATTERNS, PATTERNS }));

const LIVE = vi.hoisted(() => ({ enabled: true, vote: vi.fn() }));
vi.mock("../data/live", () => ({ default: LIVE, LIVE }));

const { default: PatternsMap, MAP_DOT_BUDGET } = await import("./PatternsMap");

const vec = (...head: number[]): number[] =>
  Array.from({ length: 8 }, (_, i) => head[i] ?? 0);

const item = (qid: string, L: number[], mine: number | null, cat = "sport"): MapRow =>
  ({
    key: qid,
    kind: "bin",
    qid,
    title: `Q ${qid}`,
    label: "",
    cat,
    optionLabels: [`${qid}-yes`, `${qid}-no`],
    options: [{ id: `${qid}:0`, label: `${qid}-yes` }, { id: `${qid}:1`, label: `${qid}-no` }],
    L,
    n: 60,
    marginal: 0,
    mine,
  }) as MapRow;

/** One bead of a choice — a question with several rows (D461). */
const bead = (qid: string, opt: number, L: number[], mine: number | null, cat = "sport"): MapRow =>
  ({
    key: `${qid}~${opt}`,
    kind: "opt",
    qid,
    title: `Q ${qid}`,
    label: `${qid}-${opt}`,
    cat,
    options: [0, 1, 2].map((i) => ({ id: `${qid}:${i}`, label: `${qid}-${i}` })),
    opt,
    L,
    n: 60,
    marginal: 0,
    mine,
  }) as MapRow;

/** A profile value — the You arc's own row. */
const anc = (dim: string, bucket: string, L: number[], mine: number | null): MapRow =>
  ({
    key: `anchor~${dim}~${bucket}`,
    kind: "anc",
    qid: `anchor~${dim}`,
    title: dim,
    label: bucket,
    cat: null,
    dim,
    bucket,
    L,
    n: 60,
    marginal: 0,
    mine,
  }) as MapRow;

/** qa answered "yes", qb answered "no", qc open — one tight factor. */
const ITEMS = [
  item("qa", vec(1, 0), 1),
  item("qb", vec(0.9, 0.1), -1),
  item("qc", vec(0.8, -0.1), null),
];

const SAY: RowSay = {
  pick: "qa-yes", then: "qb-yes", thenIdx: 0, pct: 78, base: 50, both: 40, over: "both",
};

/** The dots on the rim. The beacon's own dot is drawn on the top layer, so
 *  it is not one of these — see the case below. */
const dots = (c: HTMLElement) => [...c.querySelectorAll<SVGCircleElement>('circle[r="3.1"]')];
/** The chords: the first group in the field, drawn under everything else. */
const chords = (c: HTMLElement) => [...c.querySelectorAll<SVGPathElement>("svg > g:first-child > path")];

beforeEach(() => {
  PATTERNS.sayRow.mockResolvedValue(SAY);
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
    PATTERNS.sayRow.mockResolvedValue(null);
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
    PATTERNS.sayRow.mockResolvedValue(null);
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

describe("the idle card belongs to its own pair", () => {
  // The strongest link is fetched on demand — a real read, and the session
  // cache misses on a pair not yet opened. While that read is in flight the
  // card used to keep drawing the PREVIOUS pair's numbers under the NEW
  // pair's question text, because the stored pair key was never compared
  // and the effect never cleared. It states an exact basis while it does
  // it — "counted over the N people in both samples" — for a pair the
  // device has read nothing about.
  const TWO_TOPICS = [
    item("sa", vec(1, 0), 1, "sport"),
    item("sb", vec(0.95, 0.05), -1, "sport"),
    item("fa", vec(0, 1), 1, "food"),
    item("fb", vec(0.05, 0.95), -1, "food"),
  ];

  it("draws nothing rather than the last pair's number while the next loads", async () => {
    PATTERNS.sayRow.mockResolvedValueOnce(SAY);
    const { rerender } = render(<PatternsMap items={TWO_TOPICS} version={1} topic="sport" />);
    expect(await screen.findByText("78%")).toBeTruthy();
    expect(screen.getByText(/counted over the 40 people/)).toBeTruthy();
    // The reader changes the topic filter. The food pair's read is still
    // in flight, so there is no number to state yet.
    PATTERNS.sayRow.mockReturnValueOnce(new Promise<RowSay | null>(() => {}));
    rerender(<PatternsMap items={TWO_TOPICS} version={1} topic="food" />);
    expect(screen.queryByText("78%"), "the food card wore the sport pair's percentage").toBeNull();
    expect(screen.queryByText(/counted over the 40 people/)).toBeNull();
  });
});

describe("a selection survives the pool moving under it", () => {
  // WHY THIS IS HERE. The tab re-derives `items` from the store on every
  // notify — `PATTERNS.pool()` is a filter over the aggregates, so a page
  // landing adds questions and a retirement removes one. The selection was
  // a raw INDEX into that list, so both directions were live defects and
  // neither had a case.
  //
  // All four answered in the first two: the beacon is the highest-hub
  // UNANSWERED question and its dot is drawn on the top layer, so an
  // unanswered entry would not be among `dots()` at all.
  const FOUR = [
    item("qa", vec(1, 0), 1),
    item("qb", vec(0.9, 0.1), -1),
    item("qc", vec(0.8, -0.1), 1),
    item("qd", vec(0.2, 0.9), -1),
  ];
  const open = (c: HTMLElement) => c.querySelector(".qm-prompt")?.textContent ?? null;

  it("keeps the question you opened when the pool grows under it", () => {
    const { container, rerender } = render(<PatternsMap items={FOUR} version={1} topic="all" />);
    fireEvent.click(dots(container)[2]!);              // qc, at index 2
    expect(open(container)).toBe("Q qc");
    // A question arrives ahead of it, exactly as a landing aggregate page
    // would deliver one. The index that meant qc now means qb.
    const grown = [FOUR[0]!, item("qnew", vec(0.85, 0.05), 1), FOUR[1]!, FOUR[2]!, FOUR[3]!];
    rerender(<PatternsMap items={grown} version={2} topic="all" />);
    expect(open(container)).toBe("Q qc");
  });

  it("closes rather than crashing when the question it was on retires", () => {
    const { container, rerender } = render(<PatternsMap items={FOUR} version={1} topic="all" />);
    fireEvent.click(dots(container)[2]!);              // qc, at index 2
    expect(open(container)).toBe("Q qc");
    // qc and qd go `active: false` and leave the pool. The index qc held is
    // now past the end of both `items` and the geometry.
    rerender(<PatternsMap items={[FOUR[0]!, FOUR[1]!]} version={2} topic="all" />);
    // No throw, and the lens falls back to idle rather than to the
    // ErrorBoundary the shell would otherwise draw over the whole tab.
    expect(open(container)).toBeNull();
    expect(dots(container).length).toBe(2);
  });

  // THE CONSEQUENCE, DRIVEN. The card only offers options for a question
  // you have not answered, so this is the arm where the swap reaches a
  // WRITE: the buttons call `LIVE.vote(q.q.id, …)` on whatever the card is
  // showing when the finger lands.
  it("votes on the question the reader opened, not on whatever took its index", () => {
    const { rerender } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    fireEvent.click(screen.getByLabelText(/Answer next/).querySelector("circle")!);
    expect(screen.getByText("qc-yes")).toBeTruthy();
    // qc sits at index 2; two questions arrive ahead of it.
    const grown = [
      item("qz1", vec(0.95, 0.02), 1), item("qz2", vec(0.93, 0.03), -1),
      ITEMS[0]!, ITEMS[1]!, ITEMS[2]!,
    ];
    rerender(<PatternsMap items={grown} version={2} topic="all" />);
    fireEvent.click(screen.getByText("qc-yes"));
    expect(LIVE.vote).toHaveBeenCalledWith("qc", "qc:0");
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
    PATTERNS.sayRow.mockResolvedValue(null);
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    fireEvent.click(container.querySelectorAll("svg g g")[0]!);
    expect(await screen.findByText(/predicts its neighbours strongly enough/)).toBeTruthy();
    expect(screen.queryByText(/enough people in both samples/)).toBeNull();
  });

  it("…and says the read refused when it did", async () => {
    PATTERNS.sayRow.mockRejectedValue(new Error("permission-denied"));
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    fireEvent.click(container.querySelectorAll("svg g g")[0]!);
    expect(await screen.findByText(/Couldn’t read the crowd/)).toBeTruthy();
    expect(screen.queryByText(/predicts its neighbours/)).toBeNull();
  });
});

describe("the ring is the topic's own (D458)", () => {
  const MIXED = [
    item("sa", vec(1, 0), 1, "sport"),
    item("sb", vec(0.9, 0.1), -1, "sport"),
    item("fa", vec(0, 1), 1, "food"),
    item("fb", vec(0.1, 0.9), -1, "food"),
    item("fc", vec(-0.1, 0.8), null, "food"),
  ];
  const idle = (c: HTMLElement) => c.querySelector(".qm-idle")?.textContent ?? "";

  it("puts only the chosen topic's questions on the rim, and every one of them at full voice", () => {
    PATTERNS.sayRow.mockResolvedValue(null);
    const all = render(<PatternsMap items={MIXED} version={1} topic="all" />);
    // four on the rim's own layer plus the beacon's dot on the top one:
    // fc is open, and the open question most tied to the rest is drawn there
    expect(dots(all.container)).toHaveLength(4);
    cleanup();
    const sport = render(<PatternsMap items={MIXED} version={1} topic="sport" />);
    expect(dots(sport.container)).toHaveLength(2);
    // one arc, undimmed — there is nothing else on the ring to dim it against
    const arcs = [...sport.container.querySelectorAll<SVGPathElement>("path.qm-arc")];
    expect(arcs).toHaveLength(1);
    expect(arcs[0].getAttribute("opacity")).toBe("0.92");
  });

  it("rings the viewer's own answers under \"answered\", and says so", () => {
    PATTERNS.sayRow.mockResolvedValue(null);
    const { container } = render(<PatternsMap items={MIXED} version={1} topic="answered" />);
    expect(dots(container)).toHaveLength(4);
    expect(idle(container)).toContain("across the 4 questions you answered");
    cleanup();
    const none = render(<PatternsMap items={MIXED.map((p) => ({ ...p, mine: null }))} version={1} topic="answered" />);
    expect(none.container.textContent).toContain("Nothing you’ve answered is on the map yet.");
  });

  it("keeps each topic's strongest hubs above the dot budget, and says how many of the pool are drawn", () => {
    PATTERNS.sayRow.mockResolvedValue(null);
    // 320 questions over two topics, 3:1 — a rim past the budget
    const many = Array.from({ length: 320 }, (_, i) =>
      item(`q${i}`, vec(Math.cos(i / 7), Math.sin(i / 7)), i % 2 ? 1 : null, i % 4 === 0 ? "food" : "sport"));
    const { container } = render(<PatternsMap items={many} version={1} topic="all" />);
    // the budget, less the beacon's own dot on the top layer
    expect(dots(container)).toHaveLength(MAP_DOT_BUDGET - 1);
    const text = idle(container);
    expect(text).toContain("across the 320 questions in the pool");
    expect(text).toContain(`${MAP_DOT_BUDGET} of them drawn`);
    // in proportion: food had 80 of 320, so 75 of 300
    const arcs = [...container.querySelectorAll<SVGPathElement>("path.qm-arc")];
    expect(arcs).toHaveLength(2);
    cleanup();
    // and under the budget nothing is trimmed, nor said to be
    const few = render(<PatternsMap items={many.slice(0, 40)} version={1} topic="all" />);
    expect(dots(few.container)).toHaveLength(39); // forty, one of them the beacon
    expect(idle(few.container)).not.toContain("of them drawn");
  });
});


// ── every kind of dot (D461) ────────────────────────────────────────
//
// The request the canvas answered: a node with more than two answers.
// What has to hold is the RULE — a dot is a row — and the four things
// that follow from it: a question's beads stay together with a tick
// between groups, a group is trimmed as a group, the card opens on the
// tapped bead with its siblings as chips, and the You arc is off until
// it is asked for.
describe("a bead group (D461)", () => {
  const GROUP = [
    bead("pick", 0, vec(1, 0), 1),
    bead("pick", 1, vec(0.9, 0.2), -1),
    bead("pick", 2, vec(-0.8, 0.1), -1),
    item("qz", vec(0.2, 0.9), null, "food"),
  ];

  it("draws one dot per row, and parts the groups with a hairline", () => {
    const { container } = render(<PatternsMap items={GROUP} version={1} topic="all" />);
    // four rows, one of them the beacon's (drawn on the top layer)
    expect(dots(container).length).toBe(GROUP.length - 1);
    // one tick: between the three-bead group and its topic's next question
    // (qz is another topic, so the only boundary inside a topic is none —
    // the beads are one run)
    const ticks = [...container.querySelectorAll("line")];
    expect(ticks.length, "a tick was drawn inside a bead group").toBe(0);
  });

  it("opens on the tapped bead and offers its siblings as chips", async () => {
    const { container } = render(<PatternsMap items={GROUP} version={1} topic="sport" />);
    fireEvent.click(dots(container)[0]!);
    const chips = [...container.querySelectorAll(".qm-chip")];
    expect(chips.length, "a three-option question drew no chip row").toBe(3);
    expect(chips[0].className, "the tapped bead leads and is the one on").toContain("is-on");
    expect(chips.map((c) => c.textContent)).toEqual(["pick-0", "pick-1", "pick-2"]);
    // tapping a sibling re-reads the ties for THAT answer
    PATTERNS.sayRow.mockClear();
    fireEvent.click(chips[2]);
    await screen.findByText(/Q pick/);
    expect(PATTERNS.sayRow.mock.calls.some((c: unknown[]) => String(c[0]) === "pick~2"),
      "the chip did not re-read its own ties").toBe(true);
  });

  it("says a scale and a catalogue pick in their own words", async () => {
    const scale = { ...bead("sc", 0, vec(1, 0), null), key: "sc", kind: "ord", label: "" } as MapRow;
    PATTERNS.sayRow.mockResolvedValue({ pick: "high", then: "qb-yes", thenIdx: 0, pct: 71, base: 52, both: 96, over: "both" });
    render(<PatternsMap items={[scale, item("qb", vec(0.9, 0.1), -1)]} version={1} topic="all" />);
    // the scale is unanswered, so it is the beacon — tapped by its name
    fireEvent.click(screen.getByLabelText(/Answer next/));
    // "Rate it high", not "Pick high" — a scale has no options to pick
    expect(await screen.findByText(/Rate it/)).toBeTruthy();
  });
});

describe("the You arc (D461)", () => {
  const WITH_YOU = [
    item("qa", vec(1, 0), 1),
    item("qb", vec(0.9, 0.1), -1),
    anc("gender", "Woman", vec(0.8, 0.2), 1),
    anc("ageBand", "25-34", vec(0.1, 0.9), -1),
  ];

  it("is off by default — the map is a map of questions until asked", () => {
    const { container } = render(<PatternsMap items={WITH_YOU} version={1} topic="all" />);
    expect(container.querySelector(".qm-you")).toBeTruthy();
    expect(container.querySelector(".qm-you")!.getAttribute("aria-checked")).toBe("false");
    // the two anchors are NOT on the rim — both questions are answered,
    // so there is no beacon and both are ordinary dots
    expect(dots(container).length).toBe(2);
  });

  it("draws the arc when it is switched on, solid where you carry the value", () => {
    const { container } = render(<PatternsMap items={WITH_YOU} version={1} topic="all" />);
    fireEvent.click(container.querySelector(".qm-you")!);
    expect(container.querySelector(".qm-you")!.getAttribute("aria-checked")).toBe("true");
    // the two rim dots plus the two on the arc
    expect(dots(container).length).toBe(4);
  });

  it("offers no toggle at all when the fit folds no profile values", () => {
    const { container } = render(<PatternsMap items={ITEMS} version={1} topic="all" />);
    expect(container.querySelector(".qm-you"), "a control for something that is not there").toBeNull();
  });
});

// @vitest-environment jsdom
//
// The constellation fields (D112) — the permanent head of the City,
// Country and World stops, and the one panel `check:panel-suites` called
// "the biggest one owed".
//
// The folds beneath this file are tested in `data/similarity.test.ts`.
// What only a render can execute is the GEOMETRY, and the geometry is the
// claim: this canvas says "closer to the centre is more like you" in its
// aria-label and then has to mean it. Six properties, each one a way a
// correct fold can still reach the screen as a wrong reading:
//
//   1. The radius is likeness, INVERTED. A higher match sits closer to
//      the middle. One flipped sign here and every field in the Mirror
//      tells its reader the opposite of the truth, with the caption still
//      saying the right words — the exact "correct fold printed
//      backwards" the panel-suites gate exists for, and invisible to tsc.
//   2. NOTHING STACKS. The de-overlap pass exists so two 90% matches do
//      not land on top of each other, and it was only ever pushing
//      forward — the ring closed behind it and the tail wrapped onto the
//      head. It failed at all three caps the app ships (see `layout`), so
//      this asserts the property the pass is FOR, at each of them, rather
//      than the pass's own arithmetic.
//   3. The basis is on the node. A person ranked from answer agreement
//      rather than test scores wears a dashed ring, and the caption says
//      so — a likeness whose basis is not stated is a number pretending
//      to be a better one than it is.
//   4. Near names nobody and hands out no roles. The presence cell is one
//      of D98's three surviving denies; an anonymous field that grew a
//      label or a tab stop would be a directory of who is standing near
//      you, which is the thing `v2_presence` refuses to publish.
//   5. A place below MIN_PLACE_AXES is LISTED, never positioned (honesty
//      rule 3) — a position is a claim, and a thin place has not earned
//      one. It still appears, because a city that only lacks data must
//      not read as a city unlike you.
//   6. An empty field is still a field (D160). The canvas draws first and
//      always; the arms add copy under it rather than replacing it.
//
// `../data/live` is mocked, not booted (it imports Firebase). `../data/places`
// is the real module — the README's rule: mock the store, never the pure
// folds, or the test stops proving the panel reads them correctly.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { KindredPerson, ParsedResults } from "../data/similarity";

interface RoomRead { people: Array<{ uid: string; type?: string }>; qs: Record<string, Record<string, number>> }

const LIVE = vi.hoisted(() => ({
  enabled: true,
  subscribe: () => () => {},
  loadSimilarity: vi.fn(() => Promise.resolve()),
  loadNames: vi.fn(() => Promise.resolve()),
  similarityLoading: (): boolean => false,
  kindredLoading: (): boolean => false,
  kindredPeople: (): KindredPerson[] => [],
  myCity: "Oslo, NO",
  myTestResults: (): unknown => null,
  myVotes: (): Record<string, string> => ({}),
  testFeedItems: (): unknown[] => [],
  aggFor: (() => null) as (qid: string) => unknown,
  scoresFor: (() => null) as (uid: string) => ParsedResults | null,
  isFollowing: (() => false) as (uid: string) => boolean,
  setFollowing: vi.fn(() => Promise.resolve()),
  near: {
    on: (): boolean => true,
    room: (): RoomRead | null => null,
    roomLoading: (): boolean => false,
    loadRoom: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("../data/live", () => ({ default: LIVE, LIVE }));

const { default: SimilaritySection, NearField, PeopleField } = await import("./LiveSimilarityField");

// ── fixtures ─────────────────────────────────────────────────────────

/**
 * A big5 result map — five axes, so it clears `rankKindred`'s minAxes of 5.
 *
 * The dim ids are the instrument's own (`O`…`N`, uppercase): the folds key
 * on them verbatim, so a lowercase fixture would share no axis with
 * anything and every match would come back null with the test still
 * looking reasonable.
 */
const big5 = (o: number, c: number, e: number, a: number, n: number): ParsedResults =>
  ({ big5: { O: o, C: c, E: e, A: a, N: n } });

/**
 * The same five axes in the shape the PROFILE stores them.
 *
 * `myTestResults()` is raw and unvalidated — `parseTestResults` is the
 * defensive read that turns it into the map above — so the viewer's side
 * of every comparison has to come in through that door, not around it.
 */
const rawBig5 = (o: number, c: number, e: number, a: number, n: number) => ({
  big5: { dims: [["O", o], ["C", c], ["E", e], ["A", a], ["N", n]].map(([id, value]) => ({ id, value })) },
});

const person = (
  uid: string,
  opts: { name?: string; city?: string; results?: ParsedResults | null; shared?: number; same?: number } = {},
): KindredPerson => {
  const shared = opts.shared ?? 10;
  const same = opts.same ?? 5;
  return {
    uid,
    name: opts.name ?? uid.toUpperCase(),
    city: opts.city ?? "Oslo, NO",
    like: { shared, same, pct: shared ? Math.round((same / shared) * 100) : 0 },
    results: opts.results ?? null,
  };
};

/**
 * Every node's centre, read back off the SVG.
 *
 * The panel writes positions into a `translate(x y)` on each node group,
 * so this is the rendered geometry rather than a re-run of `layout` —
 * which is the point: a test that recomputed the layout would agree with
 * a broken one.
 */
function nodes(container: HTMLElement): Array<{ x: number; y: number; r: number; a: number }> {
  return [...container.querySelectorAll("g[transform]")].map((g) => {
    const m = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(g.getAttribute("transform") || "");
    const x = m ? Number(m[1]) : NaN;
    const y = m ? Number(m[2]) : NaN;
    return { x, y, r: Math.hypot(x, y), a: Math.atan2(y, x) };
  });
}

/** The smallest angular gap anywhere on the ring, wrap included. */
function tightestGap(pts: Array<{ a: number }>): number {
  const TAU = Math.PI * 2;
  const sorted = pts.map((p) => (p.a + TAU) % TAU).sort((u, v) => u - v);
  let worst = Infinity;
  for (let i = 0; i < sorted.length; i++) {
    let d = sorted[(i + 1) % sorted.length] - sorted[i];
    if (d < 0) d += TAU;
    worst = Math.min(worst, d);
  }
  return worst;
}

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.similarityLoading = () => false;
  LIVE.kindredLoading = () => false;
  LIVE.kindredPeople = () => [];
  LIVE.myCity = "Oslo, NO";
  LIVE.myTestResults = () => null;
  LIVE.myVotes = () => ({});
  LIVE.testFeedItems = () => [];
  LIVE.aggFor = () => null;
  LIVE.scoresFor = () => null;
  LIVE.isFollowing = () => false;
  LIVE.near.on = () => true;
  LIVE.near.room = () => null;
  LIVE.near.roomLoading = () => false;
});
afterEach(cleanup);

// ── 1 · the radius is likeness, inverted ─────────────────────────────

describe("closer to the centre is more like you", () => {
  it("places the better match at the smaller radius", () => {
    // Two people, both scored against the viewer, one much closer.
    // The two poles of the metric: an identical profile (match 100) and
    // the opposite one (match 0), so the radii are the ring's own bounds
    // rather than two arbitrary points that happen to be ordered.
    LIVE.myTestResults = () => rawBig5(100, 100, 100, 100, 100);
    LIVE.kindredPeople = () => [
      person("near", { name: "Nia Near", results: big5(100, 100, 100, 100, 100) }),
      person("far", { name: "Fay Far", results: big5(0, 0, 0, 0, 0) }),
    ];
    const { container } = render(<SimilaritySection scope="city" />);

    const byLabel = new Map(
      [...container.querySelectorAll("g[role='button']")].map((g) => {
        const m = /translate\((-?[\d.]+) (-?[\d.]+)\)/.exec(g.getAttribute("transform") || "");
        return [g.getAttribute("aria-label") || "", Math.hypot(Number(m?.[1]), Number(m?.[2]))] as const;
      }),
    );
    const nia = [...byLabel].find(([l]) => l.startsWith("Nia"))![1];
    const fay = [...byLabel].find(([l]) => l.startsWith("Fay"))![1];

    // The whole grammar of the canvas, in one comparison. Flipping the
    // `1 - match/100` in `layout` fails exactly here and nowhere else.
    expect(nia).toBeLessThan(fay);
    // …and against the ring the aria-label promises: a perfect match sits
    // at the inner bound, not merely nearer than someone else.
    expect(nia).toBeCloseTo(44, 0);
    expect(fay).toBeCloseTo(138, 0);
  });

  it("clamps a likeness outside 0..100 onto the ring", () => {
    // Match arrives from folds this panel does not own; a stray 140 must
    // land on the rings rather than inside the "you" disc, where it would
    // read as closer to you than you are.
    const { container } = render(
      <PeopleField caption="c" people={[{ id: "hot", label: "Hot", match: 140 }, { id: "cold", label: "Cold", match: -40 }]} />,
    );
    for (const n of nodes(container)) {
      expect(n.r).toBeGreaterThanOrEqual(44 - 0.5);
      expect(n.r).toBeLessThanOrEqual(138 + 0.5);
    }
  });
});

// ── 2 · nothing stacks, at every cap the app ships ───────────────────

describe("the de-overlap pass is circular", () => {
  // The three caps in the file: CITY_FIELD_CAP, NEAR_FIELD_CAP and
  // PLACE_FIELD_CAP. Country codes rather than synthetic ids because the
  // failure was data-dependent — it turned on where `angleHash` happened
  // to drop the real ids, which is how it survived a reading of the code.
  const CODES = ["US", "GB", "NO", "SE", "DK", "FI", "DE", "FR", "ES", "IT", "NL", "BE",
    "PL", "CZ", "AT", "CH", "IE", "PT", "GR", "CA", "AU", "NZ", "JP", "KR"];

  for (const n of [12, 14, 24]) {
    it(`keeps ${n} nodes off each other`, () => {
      const { container } = render(
        <PeopleField caption="c" people={CODES.slice(0, n).map((c, i) => ({ id: c, label: c, match: 50 + (i % 7) }))} />,
      );
      const pts = nodes(container);
      expect(pts).toHaveLength(n);
      // The pass wants 0.42 rad and the ring has 2π to give, so at 24 the
      // most it can honour is an even share. Either way the guarantee is
      // the same one: no two nodes closer than the step.
      const want = Math.min(0.42, (Math.PI * 2) / n);
      // Rounding: positions are written to one decimal place.
      expect(tightestGap(pts)).toBeGreaterThan(want - 0.02);
    });
  }

  it("does not depend on the order the caller ranked them in", () => {
    // The comment on `layout` says this in as many words, and it is what
    // lets the field re-rank without the constellation reshuffling.
    const people = CODES.slice(0, 10).map((c, i) => ({ id: c, label: c, match: 50 + i }));
    const a = render(<PeopleField caption="c" people={people} />);
    const first = nodes(a.container).map((p) => `${p.x},${p.y}`).sort();
    cleanup();
    const b = render(<PeopleField caption="c" people={[...people].reverse()} />);
    expect(nodes(b.container).map((p) => `${p.x},${p.y}`).sort()).toEqual(first);
  });
});

// ── 3 · the basis is on the node ─────────────────────────────────────

describe("a likeness says what it stands on", () => {
  it("dashes the ring of someone ranked from answers, not scores", () => {
    LIVE.myTestResults = () => rawBig5(50, 50, 50, 50, 50);
    LIVE.kindredPeople = () => [
      person("scored", { name: "Sam Scored", results: big5(52, 48, 50, 50, 50) }),
      person("agreed", { name: "Ann Agreed", results: null }),
    ];
    const { container } = render(<SimilaritySection scope="city" />);

    const ringOf = (prefix: string) => {
      const g = [...container.querySelectorAll("g[role='button']")]
        .find((n) => (n.getAttribute("aria-label") || "").startsWith(prefix))!;
      return g.querySelector("circle")!.getAttribute("stroke-dasharray");
    };
    expect(ringOf("Sam")).toBeNull();
    expect(ringOf("Ann")).toBe("3 2.5");
    // …and the legend explains the encoding rather than leaving it to be
    // guessed, which is the half a reader actually needs.
    expect(screen.getByText(/dashed = answers only/)).toBeTruthy();
  });

  it("drops the dashed note when every node is scored", () => {
    LIVE.myTestResults = () => rawBig5(50, 50, 50, 50, 50);
    LIVE.kindredPeople = () => [person("s", { name: "Sam Scored", results: big5(50, 50, 50, 50, 50) })];
    render(<SimilaritySection scope="city" />);
    expect(screen.queryByText(/dashed = answers only/)).toBeNull();
  });

  it("names the basis in the opened card, and counts the shared questions", () => {
    LIVE.kindredPeople = () => [person("a", { name: "Ann Agreed", shared: 9, same: 6 })];
    render(<SimilaritySection scope="city" />);
    fireEvent.click(screen.getByLabelText(/^Ann/));
    // "6 of 9", never a bare percentage: the denominator is what makes an
    // agreement readable, and it is the thing a score-based row does not have.
    expect(screen.getByText(/6 of 9/)).toBeTruthy();
  });
});

// ── 4 · Near names nobody ────────────────────────────────────────────

describe("the Near field is a crowd, never a directory", () => {
  beforeEach(() => {
    LIVE.myTestResults = () => rawBig5(50, 50, 50, 50, 50);
    LIVE.near.room = () => ({ people: [{ uid: "a" }, { uid: "b" }, { uid: "c" }], qs: {} });
    LIVE.scoresFor = (uid: string) => (uid === "c" ? null : big5(50, 50, 50, 52, 48));
  });

  it("draws no name, no initials and no tab stop", () => {
    const { container } = render(<NearField />);
    // Two of the three are placed (the third has no scores), and none of
    // them is reachable or identifiable.
    expect(nodes(container)).toHaveLength(2);
    expect(container.querySelectorAll("[role='button']")).toHaveLength(0);
    expect(container.querySelectorAll("[tabindex]")).toHaveLength(0);
    // No text node anywhere in the canvas carries a uid or an initial —
    // the glyph is a body and a head, and "you" is the only label on it.
    const labels = [...container.querySelectorAll("svg text")].map((t) => t.textContent);
    expect(labels).toEqual(["you"]);
    // …and the nodes are hidden from the accessibility tree too, or the
    // names come back through the other door.
    for (const g of container.querySelectorAll("svg > g")) {
      expect(g.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("counts who it could place against who is there, rather than quietly dropping them", () => {
    render(<NearField />);
    // "2 of 3 here" — the person with no test is missing from the ring and
    // the caption is where that is admitted (D112 honesty rule 2: a number
    // stays attached to what it counts).
    expect(screen.getByText(/2 of 3 here/)).toBeTruthy();
    expect(screen.getByText(/the rest have not taken it/)).toBeTruthy();
  });

  it("places nobody at all when the viewer has no scores to place them against", () => {
    // A radius is a claim about a person. With no scores on the viewer's
    // side there is no distance to draw, and an invented one would be the
    // one thing this canvas must never do.
    LIVE.myTestResults = () => null;
    const { container } = render(<NearField />);
    expect(nodes(container)).toHaveLength(0);
  });
});

// ── 5 · a thin place is listed, never positioned ─────────────────────

describe("a position is a claim", () => {
  // One scale question per axis, so a place can clear MIN_PLACE_AXES (3).
  const DIMS = ["O", "C", "E", "A", "N"];
  const PROMPTS: Record<string, string> = {};

  beforeEach(async () => {
    // The join runs on PROMPT TEXT (invert lives only in IS_TESTS), so the
    // fixture has to borrow real prompts from the instrument itself rather
    // than invent them — the same reason `testItemMeta` matches that way.
    // @ts-expect-error TS7016 — untyped spec module (the component's own
    // pattern; content-parity.test.jsx is what holds the shape).
    const { IS_TESTS } = await import("../spec/test-definitions.js") as
      { IS_TESTS: Record<string, { questions: Array<{ q: string; d: string }> }> };
    for (const d of DIMS) {
      const hit = IS_TESTS.big5.questions.find((q) => q.d === d);
      if (hit) PROMPTS[d] = hit.q;
    }
    LIVE.testFeedItems = () => DIMS.filter((d) => PROMPTS[d]).map((d) => ({
      id: `t-${d}`, prompt: PROMPTS[d], test: "big5",
      options: ["1", "2", "3", "4", "5"],
    }));
    // The viewer's own axes, from their votes on those same items.
    LIVE.myVotes = () => Object.fromEntries(DIMS.map((d) => [`t-${d}`, "2"]));
  });

  it("positions a place with enough shared axes and lists a thin one beside it", () => {
    // "NO" answers every axis; "SE" answers one, so it cannot be placed.
    // A breakdown cell is `{ "<optionIdx>": count }`. Everyone picks the
    // middle option, which keeps the fixture indifferent to whether the
    // item is a reversed one — `invert` is real here (the join reads it
    // off IS_TESTS) and index 2 folds to the same score either way.
    LIVE.aggFor = (qid: string) => ({
      by: {
        country: {
          NO: { "2": 5 },
          // Sweden answers ONE axis, so it cannot clear MIN_PLACE_AXES.
          ...(qid === `t-${DIMS[0]}` ? { SE: { "2": 3 } } : {}),
        },
      },
    });
    const { container } = render(<SimilaritySection scope="world" />);

    const placed = [...container.querySelectorAll("g[role='button']")]
      .map((g) => g.getAttribute("aria-label") || "");
    expect(placed.some((l) => l.startsWith("Norway"))).toBe(true);
    expect(placed.some((l) => l.startsWith("Sweden"))).toBe(false);
    // Listed, not silently dropped — the difference between "thin" and
    // "unlike you", which is the whole of honesty rule 3.
    expect(screen.getByText(/1 more country answered/)).toBeTruthy();
  });

  it("lists every place as a chip, unpositioned, when the viewer has no axes", () => {
    LIVE.myVotes = () => ({});
    LIVE.aggFor = () => ({ by: { country: { NO: { "2": 5 } } } });
    const { container } = render(<SimilaritySection scope="world" />);
    expect(container.querySelectorAll("g[role='button']")).toHaveLength(0);
    expect(screen.getByText(/Finish a test and these take their places/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Norway" })).toBeTruthy();
  });
});

// ── 6 · an empty field is still a field ──────────────────────────────

describe("an empty field draws the ring anyway (D160)", () => {
  it("keeps the canvas and the centre when there is nobody to place", () => {
    const { container } = render(<SimilaritySection scope="city" />);
    // The rings and "you" — the scale the radius will be read on — rather
    // than a paragraph where the constellation goes.
    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.getByText("you")).toBeTruthy();
    expect(nodes(container)).toHaveLength(0);
    expect(screen.getByText(/Nobody from Oslo yet/)).toBeTruthy();
  });

  it("names nothing to a screen reader while there is nobody on it (D234)", () => {
    // The canvas carries `role="group"` and a label promising "closer to
    // the centre is more like you". Over an EMPTY ring that announces a
    // comparison and then does not make one — and every empty arm goes
    // through here, so it was the first thing a new account heard from
    // this tab, on every stop. `EmptyField`, the forty-line copy of this
    // drawing that Circle and Groups use, already hid its svg; the two
    // could not both be right.
    const { container } = render(<SimilaritySection scope="city" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
    expect(svg.getAttribute("aria-label")).toBeNull();
  });

  it("…and names itself again the moment somebody is placed", () => {
    // The half the fix must not swallow: with nodes on it the label is the
    // only thing telling a screen reader what the radius MEANS.
    LIVE.kindredPeople = () => [person("a", { name: "Ada Lovelace" })];
    const { container } = render(<SimilaritySection scope="city" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBeNull();
    expect(svg.getAttribute("role")).toBe("group");
    expect(svg.getAttribute("aria-label")).toMatch(/closer to the centre is more like you/);
  });

  it("says it is matching rather than empty while the loaders are out", () => {
    // Absent is not empty — the same distinction every live surface here
    // draws, and the one that stops a full city reading as a dead one.
    LIVE.kindredLoading = () => true;
    render(<SimilaritySection scope="city" />);
    expect(screen.getByText("Matching…")).toBeTruthy();
    expect(screen.queryByText(/Nobody from/)).toBeNull();
  });

  it("draws the ring for an empty circle or group, with the caller's own line", () => {
    const { container } = render(
      <PeopleField caption="your circle" people={[]} emptyLine="Follow someone and they appear here." />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.getByText("your circle")).toBeTruthy();
    expect(screen.getByText(/Follow someone/)).toBeTruthy();
  });

  it("renders nothing at all when the store is off", () => {
    LIVE.enabled = false;
    const { container } = render(<SimilaritySection scope="city" />);
    expect(container.querySelector("svg")).toBeNull();
  });
});

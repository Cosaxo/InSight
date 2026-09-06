// @vitest-environment jsdom
//
// The patterns SHELL's two honest states. The lenses have their own
// suites — this file is what is left of a larger one after the split.
//
// WHAT THIS FILE WAS. It was written when PatternsTab.tsx was the whole
// tab (4.71% branch coverage, no test that rendered either lens), and it
// pinned the two single-character edits that were the entire risk
// surface: the Map's decode of the viewer's own answer, and the Oracle's
// confidence. D214–D216 then split the tab into PatternsMap.tsx,
// PatternsOracle.tsx and PatternsPeople.tsx, each with its own suite, and
// took both cases with them — the Map's `you said …` is pinned in
// PatternsMap.test.tsx, and the confidence moved to PatternsOracle's fill
// (see the case added there, which is this file's second half rehoused
// rather than dropped: the redesign kept the branch and changed only
// where it prints).
//
// WHAT IS STILL ONLY HERE. The shell decides whether ANY lens mounts, and
// the two states below are the ones a wrong answer makes worst:
// "no fit has published" must not become the prototype's invented crowd
// (D166 §1 — live data only), and "still loading" must not become "there
// is nothing". Both are one boolean, and both render plausibly wrong.
//
// SINCE 2026-09-02 the shell also owns the AXIS: the lens body drags
// left and right along the ruler, and past the far end the axis runs off
// into the daily through NAV.goNav — D166's one licensed joint, the same
// grammar the daily's ruler uses in the other direction. Both ends are
// pinned below, because a swipe that navigates when it should spring (or
// springs when it should navigate) is invisible to every other gate.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  ready: true,
  hasLoadings: true,
  pool: [] as unknown[],
}));

const vec = (...head: number[]): number[] => Array.from({ length: 8 }, (_, i) => head[i] ?? 0);
const item = (qid: string, L: number[], mine: number | null) => ({
  q: { id: qid, text: `Q ${qid}`, cat: "sport", options: [{ id: `${qid}:0`, label: "yes" }, { id: `${qid}:1`, label: "no" }] },
  L, n: 60, marginal: 0, mine,
});

vi.mock("../data/patterns", () => ({
  default: {
    // D396: the viewer's evidence and the published ridge, read by the
    // People lens's own solve — empty and the shipped value here
    evidence: () => [],
    lambdaU: () => 0.5,
    ready: () => h.ready,
    hasLoadings: () => h.hasLoadings,
    pool: () => h.pool,
    nextAsk: () => null,
    seal: () => null,
    grade: () => null,
    meter: () => ({ records: [], called: 0, avgBits: 0 }),
    say: () => Promise.resolve(null),
    subscribe: () => () => {},
  },
  ensureLive: () => Promise.resolve(),
}));

const NAV = vi.hoisted(() => ({ goNav: vi.fn(() => true) }));
vi.mock("../data/nav", () => ({ default: NAV, NAV }));

vi.mock("../data/live", () => ({
  default: {
    enabled: true,
    subscribe: () => () => {},
    vote: () => {},
    myVotes: () => ({}),
    // The shell reads the frozen city anchor to name the country chip
    // (D216). Absent from a mock, the tab throws before it draws.
    anchors: () => ({}),
    // …and the People lens, which the axis can now walk onto, reads the
    // follows cache and the voter lists (D216/D214). Absent, it throws
    // where a swipe test would blame the swipe.
    follows: () => [],
    followsLoading: () => false,
    loadFollows: () => Promise.resolve(),
    voters: () => [],
    votersLoading: () => false,
    loadVoters: () => Promise.resolve(),
    // …through the nightly-sample path since D397: the lens reads and
    // loads rows through these two
    votersOrSample: () => [],
    loadVoterSample: () => Promise.resolve(),
    budgetPaused: false,
  },
}));

beforeEach(() => {
  h.ready = true;
  h.hasLoadings = true;
  h.pool = [item("qa", vec(1, 0), 1), item("qb", vec(0.9, 0.1), -1), item("qc", vec(0.8, -0.1), null)];
  NAV.goNav.mockClear();
  NAV.goNav.mockReturnValue(true);
  localStorage.clear();
});

afterEach(() => cleanup());

const mount = async () => {
  const { default: PatternsTab } = await import("./PatternsTab");
  return render(<PatternsTab />);
};

describe("PatternsTab · the honest states", () => {
  it("says nothing rather than drawing a crowd when no fit has published", async () => {
    // D166 §1: the trial ships LIVE DATA ONLY. The prototype's 560 invented
    // people are exactly what must not appear here.
    h.hasLoadings = false;
    await mount();
    expect(screen.getByText(/No patterns yet/i)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/\d+%/);
  });

  it("waits quietly while the loadings doc is still in flight", async () => {
    h.ready = false;
    await mount();
    expect(screen.getByText(/Reading the pattern fit/i)).toBeTruthy();
  });
});

/** One horizontal drag across the lens body, in `dx` pixels. */
const swipe = (el: Element, dx: number) => {
  const at = (x: number) => ({ touches: [{ clientX: x, clientY: 100 }], changedTouches: [{ clientX: x, clientY: 100 }] });
  fireEvent.touchStart(el, at(160));
  fireEvent.touchMove(el, at(160 + dx / 2));
  fireEvent.touchMove(el, at(160 + dx));
  fireEvent.touchEnd(el, at(160 + dx));
};

describe("the sub-row (the ⓘ and one control, 2026-09-06)", () => {
  it("leads every lens with the guide ⓘ, and keeps the topic select one control", async () => {
    await mount();
    // the facts line and the oracle's progress track retired into the
    // instruments — the hub says the numbers now (the Map suite pins it)
    expect(screen.queryByLabelText("What the map holds")).toBeNull();
    const info = screen.getByRole("button", { name: "Legend" });
    expect(info.getAttribute("aria-expanded")).toBe("false");
    // and the topic filter is one control, not a row that scrolls
    expect(screen.getByLabelText("Topic").tagName).toBe("SELECT");
  });

  it("opens the open lens's legend, and remembers across a lens swap", async () => {
    const { container } = await mount();
    expect(container.querySelector(".ln-key")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Legend" }));
    expect(screen.getByRole("button", { name: "Legend" }).getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".ln-key"), "the guide did not reach the lens").toBeTruthy();
    // one flag for the tab: walking to another lens keeps it open
    swipe(container.querySelector(".pt-wrap")!, 120); // map → oracle
    expect(screen.getByRole("tab", { name: "Oracle" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("button", { name: "Legend" }).getAttribute("aria-expanded")).toBe("true");
  });
});

describe("the axis", () => {
  const wrap = (c: HTMLElement) => c.querySelector(".pt-wrap")!;

  it("walks the ruler: a drag left opens the next lens along", async () => {
    const { container } = await mount();
    // the map is open (its title retired into the guide, so the ruler is
    // the witness now)
    expect(screen.getByRole("tab", { name: "Question map" }).getAttribute("aria-selected")).toBe("true");
    swipe(wrap(container), -120);
    // the people map is the next stop right of the question map
    expect(screen.getByRole("tab", { name: "People map" }).getAttribute("aria-selected")).toBe("true");
    expect(NAV.goNav).not.toHaveBeenCalled();
  });

  it("runs off its far end into the daily — through the shell, not around it", async () => {
    const { container } = await mount();
    swipe(wrap(container), -120); // map → people, the far stop
    swipe(wrap(container), -120); // and off the end
    expect(NAV.goNav).toHaveBeenCalledTimes(1);
    expect(NAV.goNav).toHaveBeenCalledWith("track:world");
  });

  it("springs back at the near end — the oracle has nowhere to go", async () => {
    const { container } = await mount();
    swipe(wrap(container), 120); // map → oracle
    expect(screen.getByRole("tab", { name: "Oracle" }).getAttribute("aria-selected")).toBe("true");
    swipe(wrap(container), 120); // and past it
    expect(NAV.goNav).not.toHaveBeenCalled();
    expect(screen.getByRole("tab", { name: "Oracle" }).getAttribute("aria-selected")).toBe("true");
  });

  it("a refused jump leaves the lens where it was (D265's spring-back)", async () => {
    NAV.goNav.mockReturnValue(false);
    const { container } = await mount();
    swipe(wrap(container), -120);
    swipe(wrap(container), -120);
    expect(NAV.goNav).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("tab", { name: "People map" }).getAttribute("aria-selected")).toBe("true");
  });

  it("ignores a drag that is mostly vertical, and a flick too small to mean it", async () => {
    const { container } = await mount();
    const at = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }], changedTouches: [{ clientX: x, clientY: y }] });
    fireEvent.touchStart(wrap(container), at(160, 100));
    fireEvent.touchMove(wrap(container), at(150, 220));
    fireEvent.touchEnd(wrap(container), at(150, 220));
    swipe(wrap(container), -30);
    expect(screen.getByRole("tab", { name: "Question map" }).getAttribute("aria-selected")).toBe("true");
  });
});

// ── the header dial (2026-09-06): the shell holds the lens, the tab
// reports every move, and the two can never disagree ──────────────────
describe("the lifted lens", () => {
  const mountWired = async (props: Record<string, unknown>) => {
    const { default: PatternsTab } = await import("./PatternsTab");
    return render(<PatternsTab {...props} />);
  };

  it("reports a swipe upstream and adopts the dial's own move", async () => {
    const onLens = vi.fn();
    const { container, rerender } = await mountWired({ lens: "map", onLens });
    swipe(container.querySelector(".pt-wrap")!, -120); // map → people
    expect(onLens).toHaveBeenCalledWith("people");
    // the shell answers by moving the prop — the tab follows it, so the
    // dial in the header and the in-page ruler agree
    const { default: PatternsTab } = await import("./PatternsTab");
    rerender(<PatternsTab lens="oracle" onLens={onLens} />);
    expect(screen.getByRole("tab", { name: "Oracle" }).getAttribute("aria-selected")).toBe("true");
  });

  it("keeps its own state on a bare mount — the fixtures need no shell", async () => {
    const { container } = await mountWired({});
    swipe(container.querySelector(".pt-wrap")!, 120); // map → oracle, internally
    expect(screen.getByRole("tab", { name: "Oracle" }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("the folding ruler (2026-09-06)", () => {
  it("folds after a lens is used, tells the shell, and a pull at the top brings it back", async () => {
    const onDock = vi.fn();
    const { default: PatternsTab } = await import("./PatternsTab");
    const { container } = render(<PatternsTab ruler onDock={onDock} />);
    const rulerBox = () => container.querySelector(".pt-wrap > div[aria-hidden]")!;
    expect(rulerBox().getAttribute("aria-hidden")).toBe("false");
    // a tap that lands in the lens body is the ruler's cue to step aside
    fireEvent.pointerUp(container.querySelector(".pt-stack")!);
    expect(onDock).toHaveBeenLastCalledWith(true);
    expect(rulerBox().getAttribute("aria-hidden")).toBe("true");
    // a deliberate pull down at the top of the body brings it back
    const at = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }] });
    fireEvent.touchStart(container.querySelector(".pt-wrap")!, at(160, 80));
    fireEvent.touchMove(container.querySelector(".pt-wrap")!, at(160, 140));
    expect(onDock).toHaveBeenLastCalledWith(false);
    expect(rulerBox().getAttribute("aria-hidden")).toBe("false");
  });

  it("stays put without the ruler flag — bare mounts have no header to dock into", async () => {
    const { default: PatternsTab } = await import("./PatternsTab");
    const { container } = render(<PatternsTab />);
    fireEvent.pointerUp(container.querySelector(".pt-stack")!);
    expect(container.querySelector(".pt-wrap > div[aria-hidden]")).toBeNull();
  });
});

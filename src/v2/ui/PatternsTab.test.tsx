// @vitest-environment jsdom
//
// The two lenses of the on-trial third tab (D166 §1), which had 4.71%
// branch coverage and no test that rendered either of them.
//
// WHY THAT MATTERED MORE HERE THAN ELSEWHERE. Everything this tab draws is
// a READING — "you said X", "N% sure you'd say Y" — and a wrong reading
// renders exactly as plausibly as a right one. The tab is on trial, and a
// trial is judged on whether what it says is true. Two single-character
// edits are the whole risk surface:
//
//   `q.mine === 1 ? 0 : 1`  — decodes the viewer's own answer (+1 is
//   option 0, patterns.ts). Flipped, the Map tells every user they
//   answered the opposite of what they did.
//
//   `rec.pred === 0 ? rec.p0 : 1 - rec.p0` — the guess's confidence.
//   Flipped, a 3%-confident guess prints as 97% sure.
//
// Both passed `tsc`, `lint` and every gate in the repo, and the only
// assertion that executed against this file was the empty state — because
// jsdom cannot resolve the loadings fetch, so `hasLoadings()` was false
// and the component returned before either lens mounted. The mock below is
// what gets past that.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  ready: true,
  hasLoadings: true,
  pool: [] as unknown[],
  sealed: null as unknown,
  graded: null as unknown,
  meter: { records: [] as unknown[], called: 0, avgBits: 0 },
  votes: [] as Array<[string, string]>,
  sealCalls: [] as string[],
}));

const question = (id: string, a: string, b: string) => ({
  id,
  text: `Would you rather ${a} or ${b}?`,
  cat: "mind",
  options: [{ id: "0", label: a }, { id: "1", label: b }],
});

vi.mock("../data/patterns", () => ({
  default: {
    ready: () => h.ready,
    hasLoadings: () => h.hasLoadings,
    pool: () => h.pool,
    nextAsk: () => h.pool[0] ?? null,
    seal: (qid: string) => { h.sealCalls.push(qid); return h.sealed; },
    grade: () => h.graded ?? h.sealed,
    meter: () => h.meter,
    say: () => Promise.resolve(null),
    subscribe: () => () => {},
  },
  ensureLive: () => Promise.resolve(),
}));

vi.mock("../data/live", () => ({
  default: {
    enabled: true,
    subscribe: () => () => {},
    vote: (qid: string, opt: string) => { h.votes.push([qid, opt]); },
    myVotes: () => ({}),
  },
}));

// data/patternsMap is NOT mocked. It is pure, deterministic, separately
// tested arithmetic, and faking its shapes here would only test the fake —
// the empty-pool guard in MapLens reads `geo.pts.length`, so a mock that
// returned nothing would have rendered the "none of its questions are on
// this device" card and every assertion below would have been vacuous.

beforeEach(() => {
  h.ready = true;
  h.hasLoadings = true;
  h.pool = [];
  h.sealed = null;
  h.graded = null;
  h.meter = { records: [], called: 0, avgBits: 0 };
  h.votes = [];
  h.sealCalls = [];
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

describe("PatternsTab · the Map lens reads your own answer back", () => {
  it("names the option you actually chose, not the other one", async () => {
    // `mine` is the ENCODED answer: +1 is option 0, −1 is option 1
    // (patterns.ts). This is the decode, and it is the single character
    // between the Map being a reading and being a lie about the reader.
    h.pool = [
      { q: question("q_a", "Know", "Be known"), L: [0.4], n: 40, marginal: 0.1, mine: 1 },
      { q: question("q_b", "Plan", "Improvise"), L: [0.3], n: 30, marginal: 0.2, mine: -1 },
    ];
    const { container } = await mount();
    // The reading belongs to the SELECTED node, so selecting is part of the
    // path under test — the Map draws points until you ask one what it says.
    const nodes = container.querySelectorAll("svg g[style*=cursor]");
    expect(nodes.length, "the map drew no selectable nodes").toBeGreaterThan(1);

    fireEvent.click(nodes[0]);
    expect(document.body.textContent, "the Map read back the wrong answer").toMatch(/you said Know/);
    expect(document.body.textContent).not.toMatch(/you said Be known/);

    fireEvent.click(nodes[1]);
    expect(document.body.textContent, "the Map read back the wrong answer").toMatch(/you said Improvise/);
    expect(document.body.textContent).not.toMatch(/you said Plan/);
  });

  it("offers the options instead when you have not answered", async () => {
    h.pool = [
      { q: question("q_c", "Yes", "No"), L: [0.5], n: 50, marginal: 0, mine: null },
      { q: question("q_z", "Up", "Down"), L: [0.2], n: 20, marginal: 0, mine: 1 },
    ];
    const { container } = await mount();
    fireEvent.click(container.querySelectorAll("svg g[style*=cursor]")[0]);
    expect(document.body.textContent).not.toMatch(/you said Yes|you said No/);
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(h.votes, "the Map's own option did not vote through the ordinary path")
      .toEqual([["q_c", "0"]]);
  });
});

describe("PatternsTab · the Oracle states its confidence", () => {
  const openOracle = async () => {
    const view = await mount();
    fireEvent.click(screen.getByRole("tab", { name: "Oracle" }));
    return view;
  };

  // The confidence is part of the REVEAL, shown once the answer has landed
  // — which is right, and is why these seed an already-answered item: a
  // "97% sure you'd say Dogs" printed BEFORE you tap would give the game
  // away, and that ordering is the seal's whole point.
  const answered = (qid: string, p0: number, pred: 0 | 1, mine: 0 | 1) => {
    h.pool = [{ q: question(qid, "Cats", "Dogs"), L: [0.6], n: 60, marginal: 0, mine: mine === 0 ? 1 : -1 }];
    h.sealed = { qid, p0, pred, at: 1 };
    h.graded = { qid, p0, pred, at: 1, mine, bits: 0.5 };
  };

  it("prints the confidence of the option it actually guessed", async () => {
    // p0 is P(option 0). Predicting option 1 at p0 = 0.03 is 97% sure of
    // option 1 — a flipped branch here prints 3%, and a flip the other way
    // would make a coin-toss look certain.
    answered("q_d", 0.03, 1, 1);
    await openOracle();
    expect(document.body.textContent, "the Oracle mis-stated its own confidence").toMatch(/97%/);
    expect(document.body.textContent).toMatch(/sure you’d say Dogs/);
    expect(document.body.textContent).not.toMatch(/3% *sure/);
  });

  it("reads the low side the same way", async () => {
    answered("q_e", 0.62, 0, 0);
    await openOracle();
    expect(document.body.textContent).toMatch(/62%/);
    expect(document.body.textContent).toMatch(/sure you’d say Cats/);
    expect(document.body.textContent).not.toMatch(/38% *sure/);
  });

  it("seals BEFORE the options are on screen", async () => {
    // The invariant the whole game rests on (D166 §1, pinned in
    // data/patterns.test.ts at the store). Pinned again at the COMPONENT,
    // because a render that showed the options first and sealed after
    // would satisfy the store's test and still be a guess made with the
    // answer in view.
    h.pool = [{ q: question("q_f", "Cats", "Dogs"), L: [0.6], n: 60, marginal: 0, mine: null }];
    h.sealed = { qid: "q_f", p0: 0.7, pred: 0, at: 1 };
    await openOracle();
    expect(h.sealCalls, "the Oracle rendered without sealing a guess").toContain("q_f");
    // The options are the thing that must arrive second.
    expect(screen.getByRole("button", { name: "Cats" })).toBeTruthy();
  });

  it("votes through the ordinary path, so the grade rides the real answer", async () => {
    // The seal is graded when the vote lands through LIVE.vote — not
    // through a private channel the rest of the app cannot see. That is
    // what makes the bits honest.
    h.pool = [{ q: question("q_g", "Cats", "Dogs"), L: [0.6], n: 60, marginal: 0, mine: null }];
    h.sealed = { qid: "q_g", p0: 0.7, pred: 0, at: 1 };
    await openOracle();
    fireEvent.click(screen.getByRole("button", { name: "Dogs" }));
    expect(h.votes).toEqual([["q_g", "1"]]);
  });
});

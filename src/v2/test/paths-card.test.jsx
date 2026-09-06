// @vitest-environment jsdom
//
// Crossroads (D136): the branching-story card, its store, and the two
// sources it can draw from.
//
// WHY THIS EXISTS, beyond "the new thing should have a test". A story is a
// real bank question live — its eight ENDINGS are its options, a finished
// walk stores as an ordinary optionIdx 0..7, and a branch's share is the
// summed counts of the endings beneath it — while in a demo build it comes
// from paths-data.js with AUTHORED branch shares. The two render
// identically apart from the words, so the failure mode this file exists
// for is silent: a card that fell back to the demo pool on a live build
// would look right and be showing invented crowd figures, which is D1's
// case exactly.
//
// The live/demo SOURCE choice is pinned on real mounts in
// smoke-live.test.jsx and smoke-daily.test.jsx, where the whole feed is
// assembled. Since D341 the card is dealt into the stream as a member and
// receives its feed item as a prop (`q`): a live item carries the bank
// doc's fields, a demo stub carries the id paths-data.js resolves. What is
// pinned here is everything downstream of that: the walk, the arithmetic,
// and what a completed walk writes.
//
// The tree's geometry is not asserted. It is 8 cubic paths whose widths
// come from flow(), and pinning path `d` strings would fail on any visual
// change while catching nothing a reader would call a bug.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PATHS } from "../spec/paths-data.js";
import { MTPathsCard, PathsCard, pathsMapTree } from "../spec/paths-card.jsx";

// The store is mocked for the whole file, because the live cases below need
// to swap it per test and vi.mock is hoisted to module scope either way.
// The DEFAULT is a demo build — `enabled` false, `pathQs` empty — which is
// what every case in the first two describes runs against. The CARD now
// touches the store only when its item is live (myVotes, vote — D341); the
// Map-branch cases below still read `pathQs`.
vi.mock("../data/live", () => ({ get default() { return globalThis.__pathsLive; } }));

beforeEach(() => { globalThis.__pathsLive = { enabled: false, pathQs: () => [] }; });
afterEach(() => { cleanup(); });

// The demo feed stub, as world-feed-data.js deals it: the id is the whole
// content reference — paths-data.js is the single written copy of a demo
// story, and the card resolves it at render (srcOf).
const demoQ = () => ({ id: PATHS.stories()[0].id, cat: "dilemma", type: "path" });

describe("Crossroads · the card", () => {
  beforeEach(() => {
    localStorage.clear();
    PATHS.stories().forEach((s) => PATHS.reset(s.id));
  });

  const choose = (label) => fireEvent.click(screen.getByRole("button", { name: label }));

  it("walks three forks and reveals the ending", () => {
    render(<PathsCard q={demoQ()} />);
    const st = PATHS.stories()[0];
    // The intro is on screen before the first fork, and the first node's
    // question with it — the prototype shows both, so the opening card is
    // the only one carrying two lines of prose.
    expect(screen.getByText(st.intro)).toBeTruthy();

    choose(st.nodes["_"].a[0].t);
    choose(st.nodes["A"].a[0].t);
    // Two forks in, still walking: no ending yet.
    expect(screen.queryByText(st.endings["AAA"].line)).toBeNull();
    choose(st.nodes["AA"].a[0].t);

    // Three forks in, the ending is named and its line is drawn.
    expect(PATHS.walkOf(st.id)).toBe("AAA");
    // ONCE since 2026-09-02: the ending's name is the heading under the
    // tree. It used to be drawn on the tree's end node as well, squeezed
    // against the right edge of the field, and the design moved it into
    // the card where it can be read — so this counts one, and a second
    // copy reappearing on the field is a regression rather than a design.
    expect(screen.getAllByText(st.endings["AAA"].name).length).toBe(1);
    expect(screen.getByText(st.endings["AAA"].line)).toBeTruthy();
    // …and the tree with it, labelled for a screen reader by where it ends.
    expect(screen.getByRole("img", { name: new RegExp(st.endings["AAA"].name) })).toBeTruthy();
  });

  it("keeps the walk when the card unmounts, and a finished one is final", () => {
    const st = PATHS.stories()[0];
    const { unmount } = render(<PathsCard q={demoQ()} />);
    choose(st.nodes["_"].a[1].t);
    expect(PATHS.walkOf(st.id)).toBe("B");
    unmount();

    // Re-mounting resumes rather than restarting — the feed re-renders
    // around this card constantly, and a walk that reset on every one of
    // those would be unfinishable.
    render(<PathsCard q={demoQ()} />);
    expect(screen.getByText(st.nodes["B"].q)).toBeTruthy();
    choose(st.nodes["B"].a[0].t);
    choose(st.nodes["BA"].a[0].t);
    expect(screen.getAllByText(st.endings["BAA"].name).length).toBe(1);

    // "Walk again" stood here and is gone (D211): a re-walk moved the
    // recorded result, so a finished card offers no way back in — no redo
    // control, no choices, and the walk it keeps is the one you took.
    expect(screen.queryByRole("button", { name: "Walk again" })).toBeNull();
    expect(screen.queryByRole("button", { name: st.nodes["_"].a[0].t })).toBeNull();
    expect(PATHS.walkOf(st.id)).toBe("BAA");
  });

  it("refuses a fourth choice", () => {
    // Not reachable through the UI — the finished card draws no choices —
    // but `choose` is the store's public surface and a caller that lost
    // track of the walk length would otherwise write 'AAAA' and put the
    // card into a state with no ending to look up.
    const st = PATHS.stories()[0];
    PATHS.choose(st.id, 0); PATHS.choose(st.id, 0); PATHS.choose(st.id, 0);
    expect(PATHS.choose(st.id, 1)).toBe("AAA");
    expect(PATHS.walkOf(st.id)).toBe("AAA");
  });
});

describe("Crossroads · the crowd numbers are authored, and the card knows it", () => {
  it("derives a branch's share from the authored shares above it", () => {
    const st = PATHS.stories()[0];
    const a = st.nodes["_"].a[0].p / 100;
    const aa = st.nodes["A"].a[0].p / 100;
    expect(PATHS.flowOf(st.id, "A")).toBeCloseTo(a, 10);
    expect(PATHS.flowOf(st.id, "AA")).toBeCloseTo(a * aa, 10);
    // Every root branch together is the whole crowd — the property that
    // makes "1 in N walks your road" arithmetic rather than decoration.
    expect(PATHS.flowOf(st.id, "A") + PATHS.flowOf(st.id, "B")).toBeCloseTo(1, 10);
  });

});

// ── the live source ───────────────────────────────────────────────────
//
// Mounted against a mocked store, because everything worth asserting here
// is about what the card WRITES and where it reads its numbers from —
// neither of which a demo render can show. The live feed ITEM is the
// source now (D341): each case passes the story doc as `q`, the shape
// buildFeedGlobals deals into the stream, and the store mock supplies only
// the answer plumbing (myVotes, vote).
describe("Crossroads · live", () => {
  const ENDINGS = ["A", "B"].flatMap((a) => ["A", "B"].flatMap((b) => ["A", "B"].map((c) => a + b + c)));
  const NODES = Object.fromEntries(
    ["_", "A", "B", "AA", "AB", "BA", "BB"].map((k) => [
      k, { q: `Fork ${k}`, a: [{ t: `${k} left` }, { t: `${k} right` }] },
    ]),
  );
  const STORY = {
    id: "feed-pt1", title: "Live Story", intro: "A live intro.", hue: 20,
    nodes: NODES,
    endings: Object.fromEntries(ENDINGS.map((k) => [k, { name: `End ${k}`, line: `Line ${k}.` }])),
    // AAA is 40 of 100; the whole A branch is 60.
    counts: [40, 5, 10, 5, 20, 5, 10, 5], total: 100, live: true,
  };

  let votes;
  const LIVE = {
    enabled: true,
    pathQs: () => [STORY],
    myVotes: () => ({ ...votes }),
    vote: vi.fn((qid, opt) => { votes[qid] = opt; }),
    editVote: vi.fn((qid, opt) => {
      if (!votes[qid] || votes[qid] === opt) return false;
      votes[qid] = opt; return true;
    }),
  };

  beforeEach(() => {
    localStorage.clear();
    PATHS.stories().forEach((s) => PATHS.reset(s.id));
    PATHS.reset(STORY.id);
    votes = {};
    LIVE.vote.mockClear(); LIVE.editVote.mockClear();
    globalThis.__pathsLive = LIVE;
  });

  const choose = (label) => fireEvent.click(screen.getByRole("button", { name: label }));
  const walk3 = () => { choose("_ left"); choose("A left"); choose("AA left"); };

  it("draws the live item's story, never the demo pool's", () => {
    // The switch is the ITEM's: a feed card carrying `live` reads only the
    // fields it arrived with, whatever the demo pool holds.
    render(<PathsCard q={STORY} />);
    expect(screen.getByText("Live Story")).toBeTruthy();
    expect(screen.queryByText("The Wallet")).toBeNull();
  });

  it("writes the finished walk as an ordinary vote, indexed by ending", () => {
    render(<PathsCard q={STORY} />);
    walk3();
    // AAA is index 0 of PATH_ENDINGS — and it goes through LIVE.vote, which
    // is what makes the fold, the ledger, the by-cells and the voters panel
    // carry a walk with no special case anywhere.
    expect(LIVE.vote).toHaveBeenCalledWith("feed-pt1", "0");
    expect(LIVE.editVote).not.toHaveBeenCalled();
  });

  it("reads the crowd out of the counts, not out of an authored share", () => {
    render(<PathsCard q={STORY} />);
    walk3();
    // 40 of 100 ended at AAA — AND YOU, which is 41 of 101. The published
    // aggregate excludes the reader's own ending until the fold has run,
    // and the card was dividing by it: it said "1 in 3" where the true
    // reading is "1 in 2", always in the direction that flatters. The demo
    // pool's own AAA share is nowhere near either, so a card that had
    // fallen back would print a different number rather than no number —
    // which is why the assertion is on the value.
    expect(screen.getByText("you and 41% ended here")).toBeTruthy();
    expect(screen.getByText("1 in 2 walks your road")).toBeTruthy();
  });

  it("counts you at an ending the crowd never reached, instead of calling you first", () => {
    // The reading that used to be impossible. 60 others finished, none at
    // AAA, and the card said "you're the first to end here" — which was the
    // literal truth about the AGGREGATE and false about the room: you are
    // standing at that ending. One of 61 is 2%, and that is what it says.
    render(<PathsCard q={{ ...STORY, counts: [0, 5, 10, 5, 20, 5, 10, 5], total: 60 }} />);
    walk3();
    expect(screen.getByText("you and 2% ended here")).toBeTruthy();
    expect(screen.getByText("1 in 61 walks your road")).toBeTruthy();
    expect(screen.queryByText(/first to end here/)).toBeNull();
  });

  it("still says <1% rather than 0% when your own share rounds away", () => {
    // The guard the case above used to cover, with a fixture that can still
    // reach it: alone at an ending among 300 others is 1 in 301, which
    // rounds to zero per cent. "you and 0% ended here", to the person
    // standing there, is the failure D211 named.
    const counts = [0, 40, 40, 40, 45, 45, 45, 45];
    render(<PathsCard q={{ ...STORY, counts, total: counts.reduce((a, b) => a + b, 0) }} />);
    walk3();
    expect(screen.getByText("you and <1% ended here")).toBeTruthy();
    expect(screen.queryByText(/you and 0% ended here/)).toBeNull();
    expect(screen.queryByText(/Infinity/)).toBeNull();
  });

  it("says first-to-end-here only while the vote is still in flight", () => {
    // D211's sentence, and it now has ONE reading rather than two. It used
    // to cover both the transient — the window between finishing a walk and
    // the vote being stored — and the permanent case of a walk nobody else
    // ever followed. The second is gone: you are counted in your own share,
    // so a finished walk is never at zero. The first remains, and this is
    // it, reproduced by holding the write: `LIVE.vote` does not record, so
    // `myVotes()` has nothing to fold back in.
    //
    // It matters because the alternative was "you and 0% ended here" and
    // "1 in Infinity walks your road", printed to the person standing
    // there — from a device, verbatim (D211).
    LIVE.vote.mockImplementationOnce(() => {});
    render(<PathsCard q={{ ...STORY, counts: [0, 5, 10, 5, 20, 5, 10, 5], total: 60 }} />);
    walk3();
    expect(screen.getByText("you’re the first to end here")).toBeTruthy();
    expect(screen.queryByText(/Infinity/)).toBeNull();
    expect(screen.queryByText(/you and 0% ended here/)).toBeNull();
    // The tree still draws — the crowd is real, it just went elsewhere.
    expect(screen.getByRole("img", { name: /Your road through/ })).toBeTruthy();
  });

  it("restores a finished walk from the server, with no local trace", () => {
    // A returning device: the answer exists, localStorage does not. The
    // walk has to come back off the vote, or a user who cleared their
    // browser would be invited to answer a question they have answered.
    votes["feed-pt1"] = "4";                       // BAA
    render(<PathsCard q={STORY} />);
    expect(PATHS.walkOf(STORY.id)).toBe("");
    expect(screen.getAllByText("End BAA").length).toBe(1);
  });

  it("offers no redo over a standing answer — a walk is final (D211)", () => {
    // "Walk again" existed and re-walking wrote a D86 edit of the answer —
    // a redo control on a card whose reveal is how rare your road was,
    // moving the results it had just shown. The finished card now has no
    // way back in: the ending stands and no fork is on offer.
    votes["feed-pt1"] = "4";
    render(<PathsCard q={STORY} />);
    expect(screen.getAllByText("End BAA").length).toBe(1);
    expect(screen.queryByRole("button", { name: "Walk again" })).toBeNull();
    expect(screen.queryByRole("button", { name: "_ left" })).toBeNull();
    expect(LIVE.vote).not.toHaveBeenCalled();
    expect(LIVE.editVote).not.toHaveBeenCalled();
  });

  it("snaps back when a standing answer hydrates mid-walk, and never edits", () => {
    // The one path that can still reach the third fork with an answer on
    // record: the vote hydrates while this device is mid-walk (another
    // device's answer, or this one's arriving late). The server's record
    // wins — the raced walk is dropped, nothing is written, and showing it
    // would be showing an answer nobody stored.
    render(<PathsCard q={STORY} />);
    choose("_ left"); choose("A left");
    votes["feed-pt1"] = "4";                       // BAA lands before the last tap
    choose("AA left");
    expect(LIVE.vote).not.toHaveBeenCalled();
    expect(LIVE.editVote).not.toHaveBeenCalled();
    expect(PATHS.walkOf(STORY.id)).toBe("");
    expect(screen.getAllByText("End BAA").length).toBe(1);
    expect(screen.queryByText("End AAA")).toBeNull();
  });

  it("draws no tree and no shares before anyone has finished it", () => {
    render(<PathsCard q={{ ...STORY, counts: [0, 0, 0, 0, 0, 0, 0, 0], total: 0 }} />);
    walk3();
    expect(screen.getByText(/first to reach the end/i)).toBeTruthy();
    expect(screen.queryByText(/ended here$/)).toBeNull();
    // The ending is still yours, and still named.
    expect(screen.getByText("End AAA")).toBeTruthy();
  });
});

// ── the Map's Crossroads branch (v28 §5, D207) ─────────────────────────
//
// Same source discipline as the card: live, a leaf's walk is the SERVER's
// answer and its rarity folds from real counts or is ABSENT; demo, both
// come authored. And the honesty case that matters most: no finished walk
// means no branch — never an empty hub.
describe("Crossroads · the Map branch", () => {
  const ENDINGS = ["A", "B"].flatMap((a) => ["A", "B"].flatMap((b) => ["A", "B"].map((c) => a + b + c)));
  const STORY = {
    id: "feed-pt1", title: "Live Story", intro: "A live intro.", hue: 20,
    nodes: {},
    endings: Object.fromEntries(ENDINGS.map((k) => [k, { name: `End ${k}`, line: `Line ${k}.` }])),
    counts: [40, 5, 10, 5, 20, 5, 10, 5], total: 100, live: true,
  };

  beforeEach(() => {
    localStorage.clear();
    PATHS.stories().forEach((s) => PATHS.reset(s.id));
    PATHS.reset(STORY.id);
  });

  it("demo: a finished walk leafs with its authored rarity, unfinished stays off", () => {
    expect(pathsMapTree()).toEqual({ cats: [], nodes: [] });
    const st = PATHS.stories()[0];
    PATHS.choose(st.id, 0); PATHS.choose(st.id, 0); PATHS.choose(st.id, 0); // AAA
    const tree = pathsMapTree();
    expect(tree.cats.map((c) => c.id)).toEqual(["path-walks"]);
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0].id).toBe("path-" + st.id);
    expect(tree.nodes[0].ans).toBe(st.endings.AAA.name);
    expect(tree.nodes[0].walk).toBe(true);
    expect(tree.nodes[0].note).toMatch(/^1 in \d+$/);
  });

  it("live: the leaf reads the SERVER's ending and folds rarity from counts", () => {
    globalThis.__pathsLive = { enabled: true, pathQs: () => [STORY], myVotes: () => ({ "feed-pt1": "0" }) };
    const tree = pathsMapTree();
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0].ans).toBe("End AAA");
    expect(tree.nodes[0].note).toBe("1 in 2"); // 40 of 100 AND YOU → 41/101 → 1 in 2.46 → 2
  });

  it("live: a story nobody has answered into claims no rarity", () => {
    globalThis.__pathsLive = {
      enabled: true,
      pathQs: () => [{ ...STORY, counts: [0, 0, 0, 0, 0, 0, 0, 0], total: 0 }],
      myVotes: () => ({ "feed-pt1": "0" }),
    };
    const tree = pathsMapTree();
    expect(tree.nodes).toHaveLength(1);
    expect(tree.nodes[0].note).toBe("");
    const { container } = render(<MTPathsCard node={tree.nodes[0]} />);
    expect(container.textContent).toContain("End AAA");
    expect(container.textContent).not.toMatch(/1 in \d+/);
  });

  it("live: the leaf card draws the tree and states the rarity when counts exist", () => {
    globalThis.__pathsLive = { enabled: true, pathQs: () => [STORY], myVotes: () => ({ "feed-pt1": "0" }) };
    const node = pathsMapTree().nodes[0];
    const { container } = render(<MTPathsCard node={node} />);
    expect(container.textContent).toContain("Live Story");
    expect(container.textContent).toContain("1 in 2 walks this road");
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

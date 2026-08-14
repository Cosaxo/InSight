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
// assembled. What is pinned here is everything downstream of it: the walk,
// the arithmetic, and what a completed walk writes.
//
// The tree's geometry is not asserted. It is 8 cubic paths whose widths
// come from flow(), and pinning path `d` strings would fail on any visual
// change while catching nothing a reader would call a bug.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PATHS } from "../spec/paths-data.js";
import { PathsCard } from "../spec/paths-card.jsx";

// The store is mocked for the whole file, because the live cases below need
// to swap it per test and vi.mock is hoisted to module scope either way.
// The DEFAULT is a demo build — `pathQs` empty — which is what every case in
// the first two describes runs against, and what the app itself does when no
// bank has loaded.
vi.mock("../data/live", () => ({ get default() { return globalThis.__pathsLive; } }));

beforeEach(() => { globalThis.__pathsLive = { enabled: false, pathQs: () => [] }; });
afterEach(() => { cleanup(); });

describe("Crossroads · the card", () => {
  beforeEach(() => {
    localStorage.clear();
    PATHS.stories().forEach((s) => PATHS.reset(s.id));
  });

  const choose = (label) => fireEvent.click(screen.getByRole("button", { name: label }));

  it("walks three forks and reveals the ending", () => {
    render(<PathsCard />);
    const st = PATHS.stories()[0];
    // The intro is on screen before the first fork, and the first node's
    // question with it — the prototype shows both, so the opening card is
    // the only one carrying two lines of prose.
    expect(screen.getByText(st.intro)).toBeTruthy();

    choose(st.nodes[""].a[0].t);
    choose(st.nodes["A"].a[0].t);
    // Two forks in, still walking: no ending yet.
    expect(screen.queryByText(st.endings["AAA"].line)).toBeNull();
    choose(st.nodes["AA"].a[0].t);

    // Three forks in, the ending is named and its line is drawn.
    expect(PATHS.walkOf(st.id)).toBe("AAA");
    // getAllBy, deliberately: the ending's name appears TWICE by design —
    // once as the heading under the tree, once as the label on the tree's
    // own end node — and a getBy here would fail on the second one as
    // though something were wrong.
    expect(screen.getAllByText(st.endings["AAA"].name).length).toBe(2);
    expect(screen.getByText(st.endings["AAA"].line)).toBeTruthy();
    // …and the tree with it, labelled for a screen reader by where it ends.
    expect(screen.getByRole("img", { name: new RegExp(st.endings["AAA"].name) })).toBeTruthy();
  });

  it("keeps the walk when the card unmounts, and Walk again clears it", () => {
    const st = PATHS.stories()[0];
    const { unmount } = render(<PathsCard />);
    choose(st.nodes[""].a[1].t);
    expect(PATHS.walkOf(st.id)).toBe("B");
    unmount();

    // Re-mounting resumes rather than restarting — the feed re-renders
    // around this card constantly, and a walk that reset on every one of
    // those would be unfinishable.
    render(<PathsCard />);
    expect(screen.getByText(st.nodes["B"].q)).toBeTruthy();
    choose(st.nodes["B"].a[0].t);
    choose(st.nodes["BA"].a[0].t);
    expect(screen.getAllByText(st.endings["BAA"].name).length).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: "Walk again" }));
    expect(PATHS.walkOf(st.id)).toBe("");
    expect(screen.getByText(st.intro)).toBeTruthy();
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
    const a = st.nodes[""].a[0].p / 100;
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
// neither of which a demo render can show. The mock's `pathQs` is set per
// case; an empty list is the demo build, which is what every case above
// runs on.
describe("Crossroads · live", () => {
  const ENDINGS = ["A", "B"].flatMap((a) => ["A", "B"].flatMap((b) => ["A", "B"].map((c) => a + b + c)));
  const NODES = Object.fromEntries(
    ["", "A", "B", "AA", "AB", "BA", "BB"].map((k) => [
      k, { q: `Fork ${k || "open"}`, a: [{ t: `${k || "s"} left` }, { t: `${k || "s"} right` }] },
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
  const walk3 = () => { choose("s left"); choose("A left"); choose("AA left"); };

  it("draws the bank's story, not the demo pool's", () => {
    render(<PathsCard />);
    expect(screen.getByText("Live Story")).toBeTruthy();
    expect(screen.queryByText("The Wallet")).toBeNull();
  });

  it("writes the finished walk as an ordinary vote, indexed by ending", () => {
    render(<PathsCard />);
    walk3();
    // AAA is index 0 of PATH_ENDINGS — and it goes through LIVE.vote, which
    // is what makes the fold, the ledger, the by-cells and the voters panel
    // carry a walk with no special case anywhere.
    expect(LIVE.vote).toHaveBeenCalledWith("feed-pt1", "0");
    expect(LIVE.editVote).not.toHaveBeenCalled();
  });

  it("reads the crowd out of the counts, not out of an authored share", () => {
    render(<PathsCard />);
    walk3();
    // 40 of 100 ended at AAA. The demo pool's own AAA share is nowhere near
    // this, so a card that had fallen back would print a different number
    // rather than no number — which is why the assertion is on the value.
    expect(screen.getByText("you and 40% ended here")).toBeTruthy();
    expect(screen.getByText("1 in 3 walks your road")).toBeTruthy();
  });

  it("restores a finished walk from the server, with no local trace", () => {
    // A returning device: the answer exists, localStorage does not. The
    // walk has to come back off the vote, or a user who cleared their
    // browser would be invited to answer a question they have answered.
    votes["feed-pt1"] = "4";                       // BAA
    render(<PathsCard />);
    expect(PATHS.walkOf(STORY.id)).toBe("");
    expect(screen.getAllByText("End BAA").length).toBe(2);
  });

  it("treats a second finished walk as a D86 edit, not a second answer", () => {
    votes["feed-pt1"] = "4";
    render(<PathsCard />);
    fireEvent.click(screen.getByRole("button", { name: "Walk again" }));
    // Back at the opening — the standing answer is ignored while re-walking.
    expect(screen.getByText("A live intro.")).toBeTruthy();
    walk3();
    expect(LIVE.editVote).toHaveBeenCalledWith("feed-pt1", "0");
    expect(LIVE.vote).not.toHaveBeenCalled();
  });

  it("snaps back to the standing answer when the edit is refused", () => {
    votes["feed-pt1"] = "4";
    LIVE.editVote.mockImplementationOnce(() => false);   // the 60s cooldown
    render(<PathsCard />);
    fireEvent.click(screen.getByRole("button", { name: "Walk again" }));
    walk3();
    // The refused walk is NOT what the card shows: the server's ending is
    // still the record, and showing the other one would be showing an
    // answer nobody stored.
    expect(screen.getAllByText("End BAA").length).toBe(2);
    expect(screen.queryByText("End AAA")).toBeNull();
  });

  it("draws no tree and no shares before anyone has finished it", () => {
    globalThis.__pathsLive = { ...LIVE, pathQs: () => [{ ...STORY, counts: [0, 0, 0, 0, 0, 0, 0, 0], total: 0 }] };
    render(<PathsCard />);
    walk3();
    expect(screen.getByText(/first to reach the end/i)).toBeTruthy();
    expect(screen.queryByText(/ended here$/)).toBeNull();
    // The ending is still yours, and still named.
    expect(screen.getByText("End AAA")).toBeTruthy();
  });
});

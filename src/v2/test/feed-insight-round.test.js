// @vitest-environment jsdom
// The share the feed's surprise line prints, against the share the sheet
// it opens prints for the same cell.
//
// "25–34 flips it to Agree · 57%" is a control: tapping it opens the
// breakdown, whose 25–34 row draws that same aggregate cell. The line
// rounded each option with `Math.round`; the sheet rounds the cell with
// `sharePcts` (data/pct.ts), the largest-remainder rule this app has one
// of. Two rules over one cell, one tap apart — verbatim the failure
// pct.ts's header exists to prevent — and they disagree on about one in
// eleven cells at three to five options, always by a point.
import { describe, it, expect } from "vitest";
import { feedInsight } from "../spec/feed-read.js";
import LIVE from "../data/live";
import { sharePcts } from "../data/pct";
import { wfPcts } from "../spec/world-feed-math.js";

// A live vote question and the aggregate the store would hand back for
// it. `feedInsight` reads `LIVE.aggFor`, not the card, so the stub is the
// aggregate — the shape `agg.by` publishes.
//
// Defined ONTO the imported singleton, not assigned to `window.LIVE`:
// feed-read.js imports the binding (D354), and a second object on the
// global would reach nobody — test/live-fixture.ts's header has the
// failure that avoids. The un-booted store is inert, so flipping
// `enabled` and swapping `aggFor` is the whole stand-in.
const q = (counts, cellCounts) => {
  const question = {
    id: "feed-x", live: true, type: "vote",
    options: counts.map((c, i) => ({ id: String(i), label: `Opt ${i}`, count: c })),
  };
  LIVE.enabled = true;
  LIVE.aggFor = () => ({
    counts: Object.fromEntries(counts.map((c, i) => [String(i), c])),
    by: { ageBand: { "25-34": Object.fromEntries(cellCounts.map((c, i) => [String(i), c])) } },
  });
  // Unfolded by default is NULL — the settled state every case above
  // assumes. `pending()` below is what puts a case in the other one.
  LIVE.votePending = () => null;
  LIVE.anchors = () => ({ ageBand: "25-34" });
  return question;
};

/** Put the viewer's vote in the window before the fold counts it. */
const pending = (idx, anchors = { ageBand: "25-34" }) => {
  LIVE.votePending = () => idx;
  LIVE.anchors = () => anchors;
};

describe("the room the surprise line talks about is the room the card drew", () => {
  // `o.count` has the viewer's own vote SUBTRACTED (countsFor, data/deck.ts)
  // because the UI layer adds its own +1 — the card renders
  // `wfPcts(counts, mine)`. The line's baseline did not, so it described a
  // population that appeared on no screen, and it decided both which option
  // the room "won" and how far the cohort had to be to earn a line.
  //
  // These pass `mine`, which no case here did before, and that omission is
  // exactly why nothing caught it.
  it("does not call a flip against a winner the card never showed", () => {
    // Store counts [3, 3]; the viewer voted option 1, so the card draws
    // 43/57 with Disagree ahead. The cohort also picks 1. Nothing flipped.
    const question = q([3, 3], [1, 3]);
    const drawn = wfPcts([3, 3], 1);
    expect(drawn.p.indexOf(Math.max(...drawn.p)), "fixture: the card must show option 1 ahead").toBe(1);
    const ins = feedInsight(question, null, 1);
    expect(ins && ins.kind, "the card shows 1 winning and the line called a flip TO 1").not.toBe("flip");
  });

  it("still calls a flip the card really did not show", () => {
    // The contrast, or the case above would also pass on a function that
    // never returns a flip. Viewer votes 0, the room lands on 0, and the
    // cohort goes the other way.
    const question = q([6, 2], [0, 5]);
    const drawn = wfPcts([6, 2], 0);
    expect(drawn.p.indexOf(Math.max(...drawn.p))).toBe(0);
    const ins = feedInsight(question, null, 0);
    expect(ins && ins.kind).toBe("flip");
    expect(ins.sideIdx).toBe(1);
  });

  it("reads an unanswered card exactly as it did before", () => {
    // `mine` is null on a card the viewer has not answered, and the
    // baseline must be the plain counts — no accidental +1 on option 0.
    const question = q([1, 20, 20], [5, 3, 1]);
    expect(feedInsight(question, null, null)).toEqual(feedInsight(question));
  });
});

describe("the feed's surprise line", () => {
  it("prints the share the breakdown prints for the same cell", () => {
    // A cell the two rules disagree on: three options, and the largest
    // remainder does not land where per-option rounding does.
    const cell = [5, 3, 1];
    const ins = feedInsight(q([1, 20, 20], cell));
    expect(ins, "no insight drawn — the fixture no longer trips the gap").toBeTruthy();
    expect(
      ins.pct,
      "the card and the sheet round the same cell by different rules",
    ).toBe(sharePcts(cell)[ins.sideIdx]);
  });

  it("agrees with the sheet across many cells, not one lucky one", () => {
    // The property, not an example: whatever cell is drawn, the number on
    // the card is the number the sheet would print for it.
    let drawn = 0;
    for (let t = 0; t < 300; t++) {
      const n = 3 + (t % 3);
      const cell = Array.from({ length: n }, (_, i) => ((t * 7919 + i * 104729) % 37) + 1);
      const room = Array.from({ length: n }, (_, i) => ((t * 104729 + i * 7919) % 53) + 1);
      const ins = feedInsight(q(room, cell));
      if (!ins) continue;
      drawn++;
      expect(ins.pct).toBe(sharePcts(cell)[ins.sideIdx]);
    }
    expect(drawn, "no cell was drawn at all — the loop proves nothing").toBeGreaterThan(50);
  });
});

describe("the surprise line does not describe a cell too small to describe", () => {
  // There was no floor here at all — `if (!n) continue` — while the two
  // sibling lines on the same card family (`renderDialInsight`,
  // `renderFieldInsight`) both require three. A flip scores +1000, above
  // every lean however wide, and a one-answer cell flips whenever that one
  // person disagreed with the room: the thinnest cut on the card was also
  // the likeliest to win the line.
  it("says nothing about a cohort of one, on a card a thousand people answered", () => {
    // 1,000 answers on the card. The 25-34 cell holds ONE, and it went the
    // other way — which used to print "25-34 flips it to Opt 1 — 100%".
    const ins = feedInsight(q([1000, 20], [0, 1]), null, null);
    expect(ins, "a single answer was drawn as a cohort that flips the room").toBeNull();
  });

  it("says nothing about a cohort of two either", () => {
    const ins = feedInsight(q([1000, 20], [0, 2]), null, null);
    expect(ins, "two answers were drawn as a cohort that flips the room").toBeNull();
  });

  // THE CONTROL. Without it every assertion above is also satisfied by a
  // function that returns null for everything, which is the shape a floor
  // is easiest to get wrong into.
  it("still draws the same flip once the cell reaches three", () => {
    const ins = feedInsight(q([1000, 20], [0, 3]), null, null);
    expect(ins, "the floor swallowed a cell that is over it").toBeTruthy();
    expect(ins.kind).toBe("flip");
    expect(ins.group).toBe("25-34");
    expect(ins.sideIdx).toBe(1);
  });
});

// ── the cell the line compares against is the room's own cell ──
//
// The room baseline adds the viewer's vote back (`+ (mine === i ? 1 : 0)`)
// because `countsFor` subtracts it from `o.count`. It subtracts it only
// once the trigger has FOLDED the vote, so in the window between the write
// and the fold the baseline counts the viewer and the published `agg.by`
// cells do not. Your own cohort was short by one against a room that
// counted you — the fourth site of the D365 +1 mismatch, and the window it
// lives in is exactly the one this line renders in.
describe("your own unfolded vote joins the cohort, not just the room", () => {
  it("counts you into your own cell while the write is unfolded", () => {
    // Cell [2, 0] is BELOW the floor of three, so nothing is drawn — until
    // the viewer, who is 25-34 and voted option 1, is counted into it.
    const question = q([1000, 20], [2, 0]);
    expect(feedInsight(question, null, 1), "fixture: below the floor without you").toBeNull();
    pending(1);
    const ins = feedInsight(question, null, 1);
    expect(ins, "your own cohort stayed one short of describable").toBeTruthy();
    expect(ins.group).toBe("25-34");
    // The SHARE is what pins both halves of the join, because `n` is not a
    // field this returns — the cell is [2, 0] + your 1 → [2, 1] of 3, so
    // the winning side reads 67. A join that counted you into the floor
    // and not into the counts would draw [2, 0] of 3 and print 100.
    expect(ins.sideIdx).toBe(0);
    expect(ins.pct).toBe(67);
  });

  it("moves the share, not just the size", () => {
    // [1, 2] is already describable and already flips the room; the join
    // changes what it SAYS. Not [3, 0] against this room: 100% against
    // 97.9% is a two-point lean, under MIN_GAP, so it earns no line at
    // all and there would be nothing to move.
    const question = q([1000, 20], [1, 2]);
    const before = feedInsight(question, null, 1);
    pending(1);
    const after = feedInsight(question, null, 1);
    expect(before.kind, "fixture: the cell has to be describable BEFORE the join").toBe("flip");
    // [1, 2] of 3 → 67, [1, 3] of 4 → 75.
    expect(before.pct).toBe(67);
    expect(after.pct).toBe(75);
  });

  it("does not count you into a cohort you have no anchor for", () => {
    // Membership is the anchor's call, the shape data/pulse.ts uses. A
    // viewer with no ageBand is in no ageBand cell, and counting them
    // would state a cohort about a bucket the app cannot name.
    const question = q([1000, 20], [2, 0]);
    pending(1, {});
    expect(feedInsight(question, null, 1), "counted into a cell with no anchor").toBeNull();
  });

  it("does not count you into somebody else's bucket", () => {
    const question = q([1000, 20], [2, 0]);
    pending(1, { ageBand: "35-44" });
    expect(feedInsight(question, null, 1), "counted into the wrong bucket").toBeNull();
  });

  it("does not invent a vote when the pending value is not an option index", () => {
    // `voteRank` stores a placeholder 0 in this same map, documented as
    // unread — and a rank question has `q.options`, so it passes the
    // guard at the top of feedInsight and arrives here. world-feed's call
    // site passes `mine` as null for one, because a rank's vote is a
    // joined order string rather than a number.
    //
    // The room leans hard to option 1, so a cell of [2, 0] reading 100%
    // for option 0 is a FLIP: if the join trusted the stored value there
    // would be a line here to see.
    const question = q([20, 1000], [2, 0]);
    LIVE.votePending = () => 0;
    LIVE.anchors = () => ({ ageBand: "25-34" });
    expect(feedInsight(question, null, null), "a phantom vote reached the cell").toBeNull();
    // The control, in the same fixture: a REAL vote on option 0 does draw
    // that line, so the assertion above is about the guard and not about
    // a cell that could never have been described.
    expect(feedInsight(question, null, 0), "fixture: a real vote here has to draw").toBeTruthy();
  });

  it("changes nothing once the vote is folded", () => {
    // THE CONTROL, and the reason the reader returns null rather than -1:
    // after the fold the published cell already has you, and a second join
    // would count you twice. `votePending` answers null there.
    const question = q([1000, 20], [0, 3]);
    const settled = feedInsight(question, null, 1);
    pending(null);
    expect(feedInsight(question, null, 1)).toEqual(settled);
  });
});

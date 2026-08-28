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
import { sharePcts } from "../data/pct";
import { wfPcts } from "../spec/world-feed-math.js";

// A live vote question and the aggregate the store would hand back for
// it. `feedInsight` reads `window.LIVE.aggFor`, not the card, so the stub
// is the aggregate — the shape `agg.by` publishes.
const q = (counts, cellCounts) => {
  const question = {
    id: "feed-x", live: true, type: "vote",
    options: counts.map((c, i) => ({ id: String(i), label: `Opt ${i}`, count: c })),
  };
  window.LIVE = {
    enabled: true,
    aggFor: () => ({
      counts: Object.fromEntries(counts.map((c, i) => [String(i), c])),
      by: { ageBand: { "25-34": Object.fromEntries(cellCounts.map((c, i) => [String(i), c])) } },
    }),
  };
  return question;
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

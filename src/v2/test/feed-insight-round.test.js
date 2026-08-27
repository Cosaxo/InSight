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
import { describe, it, expect, vi } from "vitest";
import { feedInsight } from "../spec/feed-read.js";
import { sharePcts } from "../data/pct";

// A live vote question and the aggregate the store would hand back for
// it. `feedInsight` reads `LIVE.aggFor` — the imported binding, since
// feed-read's 2026-08-27 conversion — not the card, so the stub is the
// aggregate, injected through the module mock the panel suites use.
const LIVE = vi.hoisted(() => ({}));
vi.mock("../data/live", () => ({ default: LIVE }));

const q = (counts, cellCounts) => {
  const question = {
    id: "feed-x", live: true, type: "vote",
    options: counts.map((c, i) => ({ id: String(i), label: `Opt ${i}`, count: c })),
  };
  Object.assign(LIVE, {
    enabled: true,
    aggFor: () => ({
      counts: Object.fromEntries(counts.map((c, i) => [String(i), c])),
      by: { ageBand: { "25-34": Object.fromEntries(cellCounts.map((c, i) => [String(i), c])) } },
    }),
  });
  return question;
};

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

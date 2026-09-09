// @vitest-environment jsdom
//
// The revealed split's stage height (daily-split.jsx, sdSplitStageH).
//
// The bug this pins: the post-vote split rendered its option tiles inside a
// FIXED 244px column. Each tile carries minHeight 46 and the column gap is
// 7, so the content minimum is 53n − 7 — fine for the two-option days the
// stage was designed around, overflowing from five options up, and ~280px
// over on the ten-option day that shipped. Overflowing tiles are not
// clipped (no overflow on the column), so they drew straight across the
// meta line below the card and the feed's chip bar — the release screenshot
// with "You're early…" bleeding between options 5 and 6.
//
// jsdom does no layout, so a mount test cannot see the spill. The formula
// is exported instead and held to the same 46/7 the tile styles use — if
// either constant moves, move it here in the same change.
//
// SINCE 2026-09-02 two sides are a ROW, not a column: the ballot's seam
// moves to the crowd's split, so the share is a WIDTH and the height is
// fixed at 128. The stacking rule — and every guarantee below — is what
// three or more sides still need.

import { describe, expect, it } from "vitest";
import { sdSplitStageH } from "../spec/daily-split.jsx";

const TILE_MIN = 46;
const GAP = 7;
const contentMin = (n) => n * TILE_MIN + (n - 1) * GAP;

describe("the revealed split's stage height", () => {
  it("keeps the designed 244px chart for three- and four-option days", () => {
    // 4 × 46 + 3 × 7 = 205 still fits under 244 — the fixed stage was only
    // ever wrong from five options up, so smaller days keep their look.
    for (const n of [3, 4]) expect(sdSplitStageH(n)).toBe(244);
  });

  it("gives the two-side ballot its own fixed height, because share is width", () => {
    expect(sdSplitStageH(2)).toBe(128);
    // and it still clears one tile's minHeight, which is all a row needs
    expect(sdSplitStageH(2)).toBeGreaterThanOrEqual(TILE_MIN);
  });

  it("clears every tile's minHeight from five options up", () => {
    for (let n = 5; n <= 12; n++) {
      expect(sdSplitStageH(n), `${n} options`).toBeGreaterThanOrEqual(contentMin(n));
    }
  });

  it("leaves flex headroom so shares can still read as heights", () => {
    // At exactly the content minimum every tile pins at 46px and the only
    // remaining signal is the numeral — the chart stops being a chart.
    for (let n = 5; n <= 12; n++) {
      expect(sdSplitStageH(n) - contentMin(n), `${n} options`).toBeGreaterThanOrEqual(100);
    }
  });

  it("never shrinks when an option is added", () => {
    // from three up: two is a row and a row is not taller for being fuller
    for (let n = 4; n <= 12; n++) {
      expect(sdSplitStageH(n), `${n - 1} → ${n} options`).toBeGreaterThanOrEqual(sdSplitStageH(n - 1));
    }
  });
});

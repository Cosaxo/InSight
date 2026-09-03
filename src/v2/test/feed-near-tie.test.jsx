// @vitest-environment jsdom
//
// ON A NEAR TIE THE FEED GAVE BOTH SIDES THE WINNER'S TREATMENT.
//
// `world-feed-math.js` states the rule and gives the case in its own
// comment: `sharePcts` "does not guarantee distinctness, so two different
// counts can print the same integer. [449, 451, 100] draws [45, 45, 10]",
// and it measured the cost — "over 400k random vectors: 3.5% of cards
// carried at least one wrong reading, 1.0% of readings claimed a majority
// that was not one". `c` is returned from `wfPcts` for exactly this.
//
// `renderMeta` was converted to read `c`, which is why the SENTENCE stopped
// telling a voter on the smaller count that they were "with the majority".
// The three places that decide the winner's STYLING — the tiles, the bars,
// and the duel — still compared the rounded shares. So on 449 against 451
// the sentence was right and the tile was wrong, on the same card: both
// sides drawn at the winner's weight, size and ink.
//
// This is the twin of `90e61648` (the daily's result tiles, fixed earlier
// tonight) in the file that daily's own reasoning came from.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { wfPcts } from "../spec/world-feed-math.js";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, "../spec/world-feed.jsx"), "utf8");

describe("which side the feed draws as the winner", () => {
  it("the two vectors really do disagree — every case below is vacuous otherwise", () => {
    // The viewer is on index 0, the smaller count. `wfPcts` adds their own
    // vote back, so this is the vector the render functions actually see.
    const { p, c } = wfPcts([449, 451, 100], 0);
    expect(p[0], "the shares no longer tie — pick a new near-tie for this file").toBe(p[1]);
    expect(c[0]).toBeLessThan(c[1]);
    // So a leader read off `p` includes the loser, and one read off `c`
    // does not. That difference is the whole defect.
    expect(p.filter((x) => x === Math.max(...p)).length).toBe(2);
    expect(c.filter((x) => x === Math.max(...c)).length).toBe(1);
  });

  it("every surface that names a winner asks the counts", () => {
    // Three render paths, each deciding `win` (or the numeral) from `c`.
    const wins = [...src.matchAll(/const win = c\[i\] === maxN;/g)];
    expect(wins.length, "a surface stopped deciding the winner from the counts").toBe(2);
    expect(src, "the bars' numeral still picks its row off the rounded shares")
      .toContain("{c[i] === maxN && !(q.live && q.noCountsYet)");
    // `maxN` has to be the counts' max, not a rename of the shares'. Four,
    // not three: `renderMeta` has had one since the sentence was corrected,
    // and it is the one the other three should have followed.
    expect((src.match(/const maxN = Math\.max\(\.\.\.c\);/g) || []).length).toBe(4);
  });

  it("and no styling decision is left reading the shares", () => {
    // The ratchet. `maxP` survives in exactly one place — the tiles' tint,
    // where tracking the SHARE is correct and deliberate ("tint strength
    // tracks share, so 52/48 reads as 52/48"). Anything else comparing an
    // option against it is the defect coming back.
    const compares = [...src.matchAll(/\[i\] === maxP/g)];
    expect(compares.length, "a winner is being decided from the rounded shares again").toBe(0);
  });
});

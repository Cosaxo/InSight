// SEARCH'S ANSWERED ROWS DREW A SHARE OF A POPULATION THE READER WAS NOT IN.
//
// `SrchShare` divided one option's `count` by the sum of the counts. On a
// live card those counts have the viewer's own vote SUBTRACTED — data/live.ts
// says so where it builds them ("Counts shown by the feed exclude the
// viewer's own vote (wfPcts adds its +1)") — and every feed surface adds it
// back through `wfPcts`. So the meter understated your side, and in the case
// that matters most it inverted the meaning: when you are the only voter your
// side is 100%, and the bar drew at its 4% floor. A reader glancing at that
// row saw "almost nobody agreed with you" about a crowd of one, which is you.
//
// This was the THIRD fork of a feed helper in that file. The other two —
// `srchQVotes` and `srchAnswered` — each carry a comment saying they were
// stale copies that had to be replaced by the feed's own. This one was never
// converted.
//
// Held as a SOURCE ratchet, the shape feed-near-tie.test.jsx uses for the
// same class of defect in the same helper family: the overlay has no mount
// harness anywhere in the tree, and the property worth keeping is not one
// number but "this file does not compute shares of its own".
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { wfPcts } from "../spec/world-feed-math.js";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, "../spec/search-overlay.jsx"), "utf8");

describe("the search overlay's answered-row meter", () => {
  it("computes no share of its own — it asks the feed", () => {
    // Written to catch the shape rather than the spelling: any local sum
    // over `.count` is the fork coming back, however it is written.
    const localSum = /reduce\s*\(\s*\(\s*\w+\s*,\s*\w+\s*\)\s*=>\s*\w+\s*\+\s*\w+\.count/;
    expect(localSum.test(src),
      "the search overlay summed option counts itself again — that sum omits the viewer's own vote").toBe(false);
    expect(src.includes("wfPcts("),
      "the meter stopped going through the feed's own share helper").toBe(true);
  });

  it("…and the helper it asks puts the viewer back, which is the whole point", () => {
    // The arithmetic the overlay now inherits, stated here so the ratchet
    // above is anchored to a behaviour rather than to a string. Published
    // counts [14, 9] with the viewer on side 0: the true share is 15 of 24.
    const withYou = wfPcts([14, 9], 0);
    expect(withYou.p[0]).toBe(63); // 15/24 = 62.5, rounded by the app's one rule
    // …and the case the old code got backwards: you are the only voter, so
    // nothing is published yet and your side is everything.
    const alone = wfPcts([0, 0], 0);
    expect(alone.p[0]).toBe(100);
    // The old fork summed the published counts — zero here — and its `|| 1`
    // fallback turned that into 0/1, so the bar drew at its 4% floor: the
    // reading this test exists to keep out.
    const publishedSum = [0, 0].reduce((acc, n) => acc + n, 0);
    expect(0 / (publishedSum || 1)).toBe(0);
  });
});

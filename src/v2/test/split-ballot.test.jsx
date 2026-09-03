// @vitest-environment jsdom
//
// The split ballot (2026-09-02, VISION-2026-09-02 §2.2), on the real
// mount: the daily's world card asks with ONE block divided by a hairline
// seam, and answers with the same block, its seam now at the crowd's
// split. Two sides read left to right (the share is a WIDTH); three or
// more stack (the share is a height, the shape D305 sized the stage for).
//
// WHY A MOUNT TEST. Every property here is a style object on an element
// the card builds — jsdom does no layout, but it reads inline styles
// exactly, and the two shapes differ in nothing else. A regression that
// drew the two-option day as a column would pass tsc, eslint,
// check:globals and every other suite, and would look like the design on
// a screenshot of a four-option day.
//
// AND THE ONE BEHAVIOUR THE RE-LAYOUT COULD HAVE EATEN: D86's edit path.
// Changing a vote lives behind a long press on your own side, and the
// press handlers ride on the tile the redesign rebuilt — an edit surface
// that silently stopped existing is exactly the class of loss this repo
// keeps writing tests for.

import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { mountApp, registerSmokeHooks, SMOKE_TIMEOUT_MS } from "./mount-app.jsx";

vi.setConfig({ testTimeout: SMOKE_TIMEOUT_MS });
registerSmokeHooks();

/**
 * Every ballot on the screen — the daily's world card first (it sits
 * above the feed), then the feed's own vote cards. Found by the shape
 * itself rather than through a store, because the shape IS the claim:
 * one block, a 2px seam showing through its ground.
 */
const ballots = () =>
  [...document.querySelectorAll('div[style*="grid-template-columns"]')]
    .filter((el) => el.style.gap === "2px" && el.style.background === "var(--rule)");

/**
 * The revealed stage, walked up from the "you" stamp: the first ancestor
 * whose parent lays `n` sides out in a direction. Walked rather than
 * queried because the share itself is written with the `flex` shorthand,
 * which jsdom's cssstyle does not expand — so the stage's DIRECTION and
 * the percentages the sides print are what a test can read, and between
 * them they say the same thing the shorthand does.
 */
function stageOf(el, n) {
  for (let node = el; node?.parentElement; node = node.parentElement) {
    const p = node.parentElement;
    // the stage is the one whose every child is a SIDE — each printing
    // its own share. The tile's inner column also holds two children and
    // a direction, which is why the predicate names the sides' content.
    if (p.children.length === n && p.style.flexDirection
      && [...p.children].every((c) => /\d+%/.test(c.textContent || ""))) return p;
  }
  throw new Error("no revealed stage above the you stamp");
}

/**
 * Vote on the daily's world card and get to its RESULT. The consequence
 * beat sits between the two (daily-split's `beat` state) and owns the
 * screen while it plays; it is not what these cases are about, so it is
 * lifted out the way smoke-daily lifts the feed's own chunk — by taking
 * the module away for the duration.
 */
async function voteAndReveal(sideIdx = 0) {
  const beat = window.ConsequenceBeat;
  delete window.ConsequenceBeat;
  try {
    const daily = ballots()[0];
    const sides = daily.children.length;
    fireEvent.click(daily.children[sideIdx]);
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    return sides;
  } finally {
    window.ConsequenceBeat = beat;
  }
}

describe("the split ballot", () => {
  it("asks with one block, its sides divided by a seam — the daily and the feed alike", () => {
    const expectNoBoundary = mountApp();
    const all = ballots();
    // the daily's world card and the feed's vote cards both draw one
    expect(all.length, "no ballot on the daily tab at all").toBeGreaterThan(1);
    for (const el of all) {
      const n = el.children.length;
      // two sides side by side; three or more stack inside the same block
      expect(el.style.gridTemplateColumns).toBe(n === 2 ? "1fr 1fr" : "1fr");
      expect(el.style.overflow, "the block does not clip its sides' corners").toBe("hidden");
      for (const side of el.children) {
        expect(side.tagName, "a side is not a real control").toBe("BUTTON");
        expect(side.style.borderRadius, "a side kept its own corner inside the block").toBe("0px");
        expect(side.querySelector("span[aria-hidden]"), "a side lost its hue mark").toBeTruthy();
      }
    }
    expectNoBoundary("the ballots");
  });

  it("answers with the same block, the seam at the crowd's split", async () => {
    const expectNoBoundary = mountApp();
    const sidesBefore = await voteAndReveal();

    // your own side, found by the stamp the reveal puts on it
    const stage = stageOf(screen.getByText("you"), sidesBefore);
    expect(stage.style.flexDirection, "two sides must read across, three or more down")
      .toBe(sidesBefore === 2 ? "row" : "column");
    // the seam's position, said in the numbers the sides print: every side
    // carries its own share and they account for the whole crowd
    const shares = [...stage.children].map((side) => Number(/(\d+)%/.exec(side.textContent)?.[1]));
    expect(shares.length).toBe(sidesBefore);
    for (const sh of shares) expect(sh).toBeGreaterThan(0);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    expectNoBoundary("the reveal");
  });

  it("keeps D86's change-vote behind a long press on your own side", async () => {
    const expectNoBoundary = mountApp();
    const sides = await voteAndReveal();
    const stamp = screen.getByText("you");
    const mine = [...stageOf(stamp, sides).children].find((side) => side.contains(stamp));
    // the press surface survived the re-layout: it is your side, it says
    // what a hold does, and it is the only side that says it
    expect(mine.getAttribute("title")).toMatch(/Hold to change/);
    expect(mine.getAttribute("aria-label")).toMatch(/your vote\. Hold to change it\./);
    expect(document.querySelectorAll("[title='Hold to change your vote']").length).toBe(1);
    expectNoBoundary("the edit surface");
  });
});

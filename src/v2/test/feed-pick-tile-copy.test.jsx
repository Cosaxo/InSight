// @vitest-environment jsdom
//
// The pick tile's ABSENT-COUNT wording, on the half no test could reach.
//
// The card splits one sentence on `q.live`: "not on the board" on a live
// card, where post-D98 there is no floor at all and the pick is counted
// exactly like any other, and "below the floor" on a demo card, where
// pick-data.js really does filter on AGG_MIN_N. Both are the ORDINARY
// case, not an edge — TOP_N is ten over catalogues of a thousand, so your
// pick is usually not on the board.
//
// The live half has had a case since the split shipped. The demo half had
// none: nothing anywhere mounted a demo pick card, so writing the LIVE
// string for both modes passed every gate — which is the failure the
// split was made to fix, restored, with the tests still green. Mounted
// directly, like feed-fresh-head.test.jsx.

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { growUntil } from "./mount-app";

vi.setConfig({ testTimeout: 30000 });

const WF_LS = "insight.feedVotes.v1";
// pk01 is a demo pokemon pick. Its board's ten are
// [25, 6, 448, 133, 94, 7, 1, 143, 778, 658]; 150 (Mewtwo) is a real
// entity the demo store can name and is not among them — which is what
// makes `count` null and puts the tile on the absent-count branch.
const OFF_BOARD = 150;

let WorldFeed;

beforeAll(async () => {
  const specIndex = await import("../spec-index.js");
  await specIndex.loadWorldFeed();
  WorldFeed = window.WorldFeed;
});

afterEach(() => {
  cleanup();
  localStorage.removeItem(WF_LS);
});

// An answered card leaves the feed and parks behind the Answered expander
// (D133), so the reveal this file is about is not on screen until that is
// opened — a mount that only waits for the card would time out, which is
// how the first draft of this file failed.
const openAnswered = async () => {
  render(<div className="app"><WorldFeed cats={{}} onToggle={() => {}} beats={false} /></div>);
  let btn = null;
  await growUntil(() => {
    btn = [...document.querySelectorAll("button[aria-expanded]")]
      .find((b) => /answered/i.test(b.textContent || ""));
    return !!btn;
  }, "the Answered expander");
  await act(async () => { btn.click(); });
};

describe("a demo pick outside the board says which absence it is", () => {
  it("says 'below the floor', the words that are true of a demo board", async () => {
    // Answered on an earlier visit, in the mirror the feed seeds from.
    localStorage.setItem(WF_LS, JSON.stringify({ pk01: { entity: OFF_BOARD } }));

    await openAnswered();
    await growUntil(
      () => /below the floor|not on the board/.test(document.body.textContent),
      "the answered pick card's absent-count line",
    );

    const text = document.body.textContent;
    // `(?! yet)` so this case fails for its OWN reason: the ghost row one
    // element down says "not on the board yet" on a live card, and a plain
    // substring check would make the two cases indistinguishable.
    expect(text, "the live tile wording is on a demo card — there IS a floor here")
      .not.toMatch(/not on the board(?! yet)/);
    expect(text).toContain("below the floor");
  });

  it("says it of the pick and not of the board — the ghost row's twin line stays demo too", async () => {
    // The other half of the same split, one element down: the row under
    // the tiles reads "only you see this — too few to count yet" on a demo
    // card and "counted with everyone else — not on the board yet" live.
    // They were written apart and are wrong apart; asserted together so a
    // change to one is a change to both.
    localStorage.setItem(WF_LS, JSON.stringify({ pk01: { entity: OFF_BOARD } }));

    await openAnswered();
    await growUntil(
      () => /too few to count yet|counted with everyone else/.test(document.body.textContent),
      "the answered pick card's ghost row",
    );

    const text = document.body.textContent;
    expect(text).toContain("only you see this — too few to count yet");
    expect(text, "the live ghost-row wording is on a demo card").not.toContain("counted with everyone else");
  });
});

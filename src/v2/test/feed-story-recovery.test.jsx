// @vitest-environment jsdom
//
// A CROSSROADS STORY YOU FINISHED, ON A DEVICE THAT FORGOT IT.
//
// `answered()` decides whether a story has been walked by asking PATHS,
// which is local. So a returning device — reinstalled, cleared, or simply
// a second phone — has no walk, and the story it finished last week would
// be offered again at the head of the fresh feed. The line that stops that
// asks the SERVER instead: a live finish is also a vote, and a vote for
// the story's id means the walk happened wherever it happened.
//
// That line was dead to every runner. D341 landed the live Crossroads
// half and nothing exercised its recovery arm, so `return false` in its
// place left the whole suite green — and the failure it lets through is
// not subtle. It is the app forgetting a thing you did.
//
// Both arms, because this pins a DISAPPEARANCE: a case that only checks
// the story is gone would pass just as happily against a fixture that
// stopped serving stories at all. The first case is the control.
//
// Mounted directly rather than through the app shell, like
// feed-fresh-head.test.jsx: the subject is which cards the feed serves.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { installLive, PATH_TITLE } from "./live-fixture";
import { growUntil } from "./mount-app";

vi.setConfig({ testTimeout: 15000 });

const WF_LS = "insight.feedVotes.v1";
// The fixture's one Crossroads story, by the id data/live.ts gives it.
const STORY_ID = "feed-fixture-path";

let WorldFeed;
let live;

beforeAll(async () => {
  const specIndex = await import("../spec-index.js");
  await specIndex.loadWorldFeed();
  WorldFeed = window.WorldFeed;
});

afterEach(() => {
  cleanup();
  live?.restore();
  live = undefined;
  localStorage.removeItem(WF_LS);
});

describe("a finished story on a device with no local walk", () => {
  it("is offered in the fresh feed when nobody has walked it", async () => {
    // The control. No walk anywhere, no server vote — the story belongs at
    // the head, and everything below asserts it is NOT there.
    live = installLive({ feedCards: 4 });
    render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
    await growUntil(() => document.body.textContent.includes(PATH_TITLE), "the Crossroads story");
    expect(document.body.textContent, "no Answered record should exist yet").not.toMatch(/Answered/);
  });

  it("…and is not offered again when the server remembers the finish", async () => {
    live = installLive({ feedCards: 4 });
    // A finish recorded server-side and nothing locally: PATHS holds no
    // walk, which is exactly the returning device this arm exists for.
    live.votes[STORY_ID] = "AAA";

    render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
    // The Answered expander is the anchor — it exists only once something
    // has been filed behind it, so reaching it proves both that the feed
    // rendered and that the story went where a finished card goes.
    await growUntil(() => /Answered/.test(document.body.textContent), "the Answered expander");
    expect(
      document.body.textContent.includes(PATH_TITLE),
      "a story this account already finished was offered again as fresh",
    ).toBe(false);
  });
});

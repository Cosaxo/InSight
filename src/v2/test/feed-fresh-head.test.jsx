// @vitest-environment jsdom
//
// The head of the feed on a RETURNING device (D342). The feed used to weave
// its side streams against the full world list — answered cards included —
// and drop the answered ones afterwards, so on a device that had answered
// the first sixteen cards the first mounted page was seven test, learn and
// lens cards and one topic. The owner's report: "when you first open the app
// it never seems to add topics that are not tests or learn".
//
// feed-interleave.test.ts pins the arithmetic on the shipped function. This
// pins the OTHER half, which no gate reads: which list world-feed.jsx hands
// that function. Weave the full list again and the arithmetic stays green
// while this fails — the D11/D42 lesson, that `.jsx` arithmetic is covered by
// nothing but a mount. Mounted directly like learn-reserve.test.jsx: the
// subject is the feed's own order, not the chrome around it.

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { installLive } from "./live-fixture";
import { growUntil } from "./mount-app";
import { TEST_EVERY } from "../data/feed-interleave";

vi.setConfig({ testTimeout: 15000 });

// The feed's own vote mirror — what it seeds `state.votes` from at mount.
const WF_LS = "insight.feedVotes.v1";

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

// Rendered order, by the qid each card's ref stamps on its element for the
// attention tally (R4/D271) — setup-dom's observer stub keeps that path live
// in jsdom. Only renderCard's cards carry it, which is every card this case
// reasons about: the fixture's world cards and the woven side streams.
const renderedIds = () => [...document.querySelectorAll(".wf-card")].map((el) => el._wfQid);
const isWorld = (id) => typeof id === "string" && id.startsWith("feed-fixture-");

describe("a returning device opens on fresh topics, not on the side streams (D342)", () => {
  it("puts the first side card after the cadence's worth of fresh world cards, not in front of the first one", async () => {
    // Twenty-four world cards, the first twelve answered on an earlier
    // visit: in the mirror the feed seeds from, and in the store, so the
    // reconcile on a notify keeps them rather than treating them as a
    // rollback.
    live = installLive({ feedCards: 24, testCard: true, learnCard: true });
    const answered = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`feed-fixture-${i}`, 0]));
    localStorage.setItem(WF_LS, JSON.stringify(answered));
    for (const id of Object.keys(answered)) live.votes[id] = "0";

    render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
    await growUntil(() => renderedIds().some((id) => !isWorld(id)), "a woven side card");

    const ids = renderedIds();
    const firstSide = ids.findIndex((id) => !isWorld(id));
    const worldBefore = ids.slice(0, firstSide);
    // The test cadence: one marked card after every fourth world card, so
    // the first side card follows the fresh topics that fill its slot. The
    // shipped loop put it FIRST — every one of those slots had fired
    // against the answered prefix.
    expect(
      worldBefore.length,
      `the feed opened on a side card after ${worldBefore.length} topics: ${ids.slice(0, 8).join(" ")}`,
    ).toBeGreaterThanOrEqual(TEST_EVERY - 1);
    // …and the topics it opened on are fresh: the record sits behind the
    // Answered expander, never at the head.
    for (const id of worldBefore) expect(answered[id], `${id} is answered and still leads the feed`).toBeUndefined();
  });

  it("still serves the side streams once the topics run out — the surplus follows, it is not dropped", async () => {
    // Every world card answered: the caught-up end. The feed is then the
    // side streams in cadence order, which is what the full walk gave and
    // what the continuation has to keep giving — a returning device that
    // has answered everything must still meet its tests.
    live = installLive({ feedCards: 8, testCard: true, learnCard: true });
    const answered = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`feed-fixture-${i}`, 0]));
    localStorage.setItem(WF_LS, JSON.stringify(answered));
    for (const id of Object.keys(answered)) live.votes[id] = "0";

    render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
    await growUntil(() => renderedIds().includes("test-political-99"), "the bank's test item");
    expect(renderedIds().filter(isWorld)).toEqual([]);
  });
});

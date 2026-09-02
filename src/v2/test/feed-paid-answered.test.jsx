// @vitest-environment jsdom
//
// A PAID CARD YOU HAVE ALREADY ANSWERED MUST NOT SPEND THE DAY'S SLOT.
//
// `pickSponsored` (data/sponsored.ts) rotates the day's paid card by UTC
// day across the whole eligible pool and knows nothing about answers — it
// cannot, because the rotation has to be computable in advance for a slot
// to be sold without per-impression telemetry (SCALE-PLAN §5). So on day
// two of a one-question campaign it picks the same question again, and the
// viewer who answered it yesterday is served a RESULT card wearing a PAID
// band as the day's advertisement.
//
// world-feed stops that with one line — `woven.filter(q => !dropWorld.has(q.id))`
// — and D348 moved the ordinary answered filter to before the weave, which
// left that line looking like a duplicate of work already done. It is not:
// `partitionSponsored` picks the paid card off the FULL list, so it is the
// one answered world card that can still reach the weave. Deleting the line
// leaves all 2330 tests green, which is exactly what makes it the shape of
// line a future reader removes as redundant.
//
// Mounted directly rather than through the app shell, like
// feed-fresh-head.test.jsx: the subject is which cards the feed serves, not
// the chrome around them.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { installLive } from "./live-fixture";
import { growUntil } from "./mount-app";

vi.setConfig({ testTimeout: 15000 });

const WF_LS = "insight.feedVotes.v1";
// The fixture marks the LAST world card as the sponsored one.
const CARDS = 4;
const PAID_ID = `feed-fixture-${CARDS - 1}`;
// The anchors the fixture's buyer bought against — a non-matching profile
// is never served the card at all, which would make either case vacuous.
const MATCHING = { city: "Oslo, NO" };

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

describe("the day's paid slot, on a device that already answered it", () => {
  // THE CONTROL FIRST. Everything below asserts an ABSENCE, and an absence
  // passes just as happily when the fixture stopped serving paid cards at
  // all. This is the same mount with nothing answered.
  it("serves the band when the card is fresh", async () => {
    live = installLive({ feedCards: CARDS, sponsored: true, anchors: MATCHING });
    render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
    await growUntil(() => screen.queryAllByText("PAID").length > 0, "the paid band");
    expect(screen.getByRole("button", { name: /^Paid, by Fixture Transit/ })).toBeTruthy();
  });

  it("…and withholds it once you have answered that question", async () => {
    live = installLive({ feedCards: CARDS, sponsored: true, anchors: MATCHING });
    // Answered on an earlier visit: in the feed's own vote mirror, which is
    // what it seeds `state.votes` from at mount, AND in the store, so the
    // reconcile on a notify keeps it rather than reading it as a rollback.
    localStorage.setItem(WF_LS, JSON.stringify({ [PAID_ID]: 0 }));
    live.votes[PAID_ID] = "0";

    render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
    // Grown to the same depth the control reaches its band at, so this is
    // "the feed ran and did not serve it" rather than "the feed had not got
    // there yet". The Answered expander is the anchor: it only exists once
    // a card has been filed behind it, so reaching it proves both that the
    // feed rendered and that the paid card went where it belongs.
    await growUntil(() => /Answered/.test(document.body.textContent), "the Answered expander");
    expect(
      screen.queryAllByText("PAID"),
      "the day's paid slot was spent on a question this device already answered",
    ).toEqual([]);
    // …and it is not merely hidden: it is behind the expander, collapsed,
    // which is where every other answered card goes.
    expect(screen.queryByText(/Fixture Transit/), "the buyer is still named in the fresh feed").toBeNull();
  });
});

// @vitest-environment jsdom
//
// The "Add a topic" sheet's count, which is the only number on that screen
// and had been the device's own page rather than the bank's shelf.
//
// WHAT THIS PINS AND WHY NOTHING ELSE CAN. The arithmetic is four lines
// inside `WorldFeed.renderAdd` — a `.jsx` fold over the pool, joined to a
// published per-topic total. bank-pager.test.ts holds the published half
// (that `pageTotals` prefers the fold's membership count, that an empty map
// means no order); rank.test.ts holds the server half (that `carry` counts
// a straddler on every shelf). Neither can see WHICH of the two numbers the
// row draws — put `stock` back in place of the bank total and both stay
// green while a fresh install under-reads every shelf again. That is the
// D11/D42 lesson: `.jsx` arithmetic is covered by nothing but a mount.
//
// Mounted directly, like feed-fresh-head.test.jsx: the subject is the
// sheet's own numbers, not the chrome around it.

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { installLive } from "./live-fixture";
import { growUntil } from "./mount-app";
import { publishFeedTotals, resetFeedTotals } from "../data/bankPager";
import { requestTopicSheet } from "../data/topicSheet";

vi.setConfig({ testTimeout: 15000 });

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
  resetFeedTotals();
});

// The sheet's rows, as a reader meets them: "Culture" over "26 questions ·
// 0 answered". Keyed by label so a case names the shelf it means.
const topicRows = () => {
  const out = {};
  for (const el of document.querySelectorAll("div")) {
    const kids = el.children;
    if (kids.length !== 2) continue;
    const line = kids[1].textContent || "";
    if (!/^\d+ questions? · \d+ answered/.test(line)) continue;
    out[kids[0].textContent] = line;
  }
  return out;
};

// The sheet portals to `.app` and returns null without it (D211's lift is
// measured off the tab bar inside that frame), so a bare mount draws the
// feed and no sheet at all — which is a green test that proves nothing.
const renderInApp = () =>
  render(
    <div className="app">
      <WorldFeed cats={{}} onToggle={() => {}} beats={false} />
    </div>,
  );

const openSheet = async () => {
  // The same request the profile's scenes card makes (D190/D282) — and it
  // answers whether a mounted feed took it, so a sheet that never opened
  // fails here rather than in an empty assertion below.
  expect(requestTopicSheet(), "no mounted feed answered the request").toBe(true);
  await growUntil(() => Object.keys(topicRows()).length > 0, "the topic sheet's rows");
};

const row = (rows, label) => rows[Object.keys(rows).find((k) => k.toLowerCase().startsWith(label)) ?? ""];

describe("the topic sheet counts the bank, not the page it happens to hold", () => {
  it("draws the fold's published count for the shelf, not the pool's", async () => {
    // The fixture's pool holds ONE dilemma — its Crossroads story — so the
    // shipped sheet read "Dilemmas · 1 question" while the bank behind it
    // carries twenty-four. That is the reported failure at its sharpest,
    // and the pool number is the one a reader would have believed.
    live = installLive({ feedCards: 4 });
    publishFeedTotals({ dilemma: 24 });

    renderInApp();
    await openSheet();

    const rows = topicRows();
    expect(row(rows, "dilemma"), `rows drawn: ${JSON.stringify(rows)}`).toMatch(/^24 questions ·/);
  });

  it("counts its own pool where no order has published — a demo build holds its bank whole", async () => {
    // No publishFeedTotals at all, which is every demo build: the pool IS
    // the bank there, so counting it is the truth and not a fallback that
    // needs apologising for. Pinned because the other reading of a null
    // total — draw zero — is the "0 cards while cards are served" failure
    // the learn twin was reported as.
    live = installLive({ feedCards: 4 });

    renderInApp();
    await openSheet();

    const rows = topicRows();
    expect(row(rows, "dilemma"), `rows drawn: ${JSON.stringify(rows)}`).toBe("1 question \u00b7 0 answered");
  });

  it("does not advertise a shelf the fold says is empty, however many the pool holds", async () => {
    // A published order that carries no dilemmas is that shelf emptied —
    // every question killed or out of window. Falling through to the pool
    // there would keep a room open the bank has closed, which is the
    // `t.n > 0` filter's whole job (D96). It also pins that the reader is
    // `?? `, not `|| `: a published zero must not read as "no order".
    live = installLive({ feedCards: 4 });
    publishFeedTotals({ fav: 9 });

    renderInApp();
    await openSheet();

    const rows = topicRows();
    expect(row(rows, "dilemma"), `dilemmas still advertised: ${JSON.stringify(rows)}`).toBeUndefined();
    expect(row(rows, "fav"), `rows drawn: ${JSON.stringify(rows)}`).toMatch(/^9 questions ·/);
  });
});

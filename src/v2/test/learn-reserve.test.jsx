// @vitest-environment jsdom
//
// The feed side of D95 — a learn card the scheduler re-serves must arrive
// ANSWERABLE. On a device it did not: the feed persisted lrn- votes in
// insight.feedVotes.v1 and rebuilt a disabled replay from them, so a card
// re-served for its three-in-a-row streak rendered frozen in a previous
// sitting's reveal — ✓/✕ marks, percentages and all — and the streak was
// unreachable forever. These cases mount the real WorldFeed against the
// real LEARN singleton and walk the serve loop end to end: due → served
// fresh (a stale persisted vote notwithstanding), answering credits the
// streak and leaves NO lrn- entry behind in WF_LS; not due → not served.
//
// Mounted directly rather than through App: the loop under test is the
// feed's own, and the sheet/tabbar chrome around it belongs to the smoke
// files. LEARN is module state, so the two cases share one world — each
// picks its own card from the scheduler and asserts only about that card.

import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.setConfig({ testTimeout: 15000 });

const WF_LS = "insight.feedVotes.v1";

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

const wrong = (card) => (card.c + 1) % card.a.length;

function mountFeed() {
  return render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
}

describe("a due learn card is re-served answerable (D95)", () => {
  it("serves it fresh over a stale persisted vote, credits the streak, persists nothing", () => {
    const L = window.LEARN;
    // Miss a card, then answer four others so its gap passes — the
    // scheduler's own definition of a repeat that counts.
    const card = L.plan(1)[0];
    L.answer(card.id, wrong(card));
    for (let i = 0; i < 4; i++) {
      const next = L.plan(1, null, [card.id])[0];
      L.answer(next.id, next.c);
    }
    expect(L.due(card.id), "the setup did not make the card due").toBe(true);
    // The residue a pre-D95 build left behind: the missed pick, persisted.
    localStorage.setItem(WF_LS, JSON.stringify({ ["lrn-" + card.id]: wrong(card) }));

    mountFeed();
    const option = screen.getByRole("button", { name: card.a[card.c] });
    expect(option.disabled, "the re-served card rendered frozen").toBe(false);
    // No replay chrome before the answer — the reveal waits for the tap.
    expect(screen.queryByText("Three in a row to earn it.")).toBeNull();

    fireEvent.click(option);
    // The answer counted: one right of the three, said on the card.
    expect(L.stateOf(card.id).k).toBe(1);
    expect(screen.getByText(/more in a row\./)).toBeTruthy();
    // The pick stayed out of the persisted map — and the seeded residue is
    // gone with it — so the NEXT serve arrives fresh too.
    const wf = JSON.parse(localStorage.getItem(WF_LS) || "{}");
    expect(Object.keys(wf).filter((k) => k.indexOf("lrn-") === 0)).toEqual([]);
  });

  it("does not serve an answered card inside its gap at all", () => {
    const L = window.LEARN;
    const card = L.plan(1)[0];
    L.answer(card.id, wrong(card));
    expect(L.due(card.id)).toBe(false);
    mountFeed();
    expect(screen.queryByText(card.q), "a not-due card reached the feed").toBeNull();
  });

  // The LIVE-reconcile half of D95 — the skip that keeps a snapshot notify
  // from wiping the on-screen reveal — is pinned in learn-split.test.ts
  // beside the D89 pin: it needs a live notify mid-reveal, which this demo
  // harness cannot drive, and that file already reads world-feed.jsx.
});

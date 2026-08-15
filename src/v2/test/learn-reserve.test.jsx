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
import { LEARN as L } from "../spec/learn-progress.js";
import LIVE from "../data/live";
import { growFeed } from "./mount-app";
import { installLive } from "./live-fixture";

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
  it("serves it fresh over a stale persisted vote, credits the streak, persists nothing", async () => {
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
    // The learn card is interleaved past the feed's first mounted page
    // (D136); this case is about the card, not the window, so let it finish.
    await growFeed();
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

describe("the crowd-split prefetch asks for the cards it is serving (D125)", () => {
  // Two ids for one card, one character apart in effect. LEARN_FEED wraps
  // each card as a feed question keyed "lrn-<card>", while the aggregate
  // is "learn-<card>" — built from `.learn`. Passing the question id asks
  // for "learn-lrn-<card>", which nothing has ever written, and the
  // failure mode is the exact symptom the prefetch exists to remove: no
  // document, a null cache entry, and the authored estimate on every
  // reveal forever. Nothing else in the tree can tell the two apart, so
  // this case is the guard.
  it("passes bare card ids, never the lrn- question ids", () => {
    const seen = [];
    // Patched on the STORE MODULE, the way live-fixture does it: the feed
    // reads its imported binding for this call (D39's meter), so a
    // window.LIVE stub would not be consulted. This suite runs in demo
    // mode, where the real loadLearnAggs early-returns — so the spy is the
    // only witness to the argument, which is the half that can be wrong
    // silently.
    const target = LIVE;
    const prev = Object.getOwnPropertyDescriptor(target, "loadLearnAggs");
    Object.defineProperty(target, "loadLearnAggs", {
      value: (ids) => { seen.push(...ids); return Promise.resolve(); },
      writable: true, configurable: true,
    });
    try {
      mountFeed();
    } finally {
      if (prev) Object.defineProperty(target, "loadLearnAggs", prev);
      else delete target.loadLearnAggs;
    }
    expect(seen.length, "the feed planned no learn cards — the pin has nothing to guard").toBeGreaterThan(0);
    for (const id of seen) {
      expect(id, "a question id reached the aggregate prefetch").not.toMatch(/^lrn-/);
      expect(L.card(id), `${id} is not a learn card id`).toBeTruthy();
    }
  });
});

// ── the reveal, against the answer you just gave (D157) ─────────────
//
// Reported against the release: a green tick on "Breaks down waste" with
// "0 people · 0%" beside it, one line above "From 1 answer — everyone's
// first try at this card". Two separate faults wearing the same symptom,
// and both are about WHOSE answers the count holds.
//
// These mount the real feed in live mode and walk the tap, because the
// arithmetic is only half of it: the counts fold is pinned in
// learn-split.test.ts, and what it could not catch is the sentence
// underneath, which is what a reader actually uses to interpret a zero.
describe("the learn reveal counts the reader in (D157)", () => {
  let live;

  afterEach(() => {
    live?.restore();
    live = undefined;
  });

  /** Point LIVE's two learn reads at one card, leaving the rest null. */
  function stubCrowd(cardId, agg, mine) {
    for (const [name, fn] of [["learnAgg", (id) => (id === cardId ? agg : null)],
      ["learnMine", (id) => (id === cardId ? mine : null)]]) {
      Object.defineProperty(window.LIVE, name, { value: fn, writable: true, configurable: true });
    }
  }

  // The scheduler is module state and the cases above have walked it, so
  // each case here starts it over: `plan(1)[0]` is then both the card the
  // feed serves first and one nothing has answered, which is what makes
  // "this is your first try" true rather than hopeful.
  const firstCard = () => { L.reset(); return L.plan(1)[0]; };
  // Held across the tap rather than re-queried after it: answering folds
  // the count and the tick into the button's own text, so its accessible
  // name stops being the option label. React reuses the node, so this
  // reference is the revealed row.
  const rowFor = (card) => screen.getByRole("button", { name: card.a[card.c] });

  it("adds your own first try when the trigger has not folded it yet", async () => {
    live = installLive();
    const card = firstCard();
    // One stranger, on the wrong option, and the aggregate has not seen
    // ours: the state `learnAnswer`'s re-read leaves behind almost every
    // time. Before the fix the correct answer read "0 people · 0%".
    stubCrowd(card.id, { total: 1, counts: { [String(wrong(card))]: 1 } }, { idx: card.c, folded: false });

    mountFeed();
    await growFeed();
    const row = rowFor(card);
    fireEvent.click(row);

    // The count, not the share: the share animates up from zero and jsdom
    // never runs the frames, so asserting on it would pin the animation.
    expect(row.textContent, "the reader's own answer is still missing")
      .not.toMatch(/0 people/);
    expect(row.textContent).toMatch(/1 person/);
    expect(screen.getByText(/From 2 answers/)).toBeTruthy();
  });

  it("says why a repeat is not in the count it shows", async () => {
    live = installLive();
    // Miss a card, let its gap pass, and answer it right on the re-serve —
    // the exact sitting the screenshot came from. Only FIRST tries fold,
    // so the correct option genuinely stands at zero here, and the line
    // under it is the only thing that can explain that.
    const card = firstCard();
    L.answer(card.id, wrong(card));
    for (let i = 0; i < 4; i++) {
      const next = L.plan(1, null, [card.id])[0];
      L.answer(next.id, next.c);
    }
    expect(L.due(card.id), "the setup did not make the card due").toBe(true);
    // Their own earlier miss, folded — and no pending answer, because a
    // repeat never reaches learnAnswer.
    stubCrowd(card.id, { total: 1, counts: { [String(wrong(card))]: 1 } }, null);

    mountFeed();
    await growFeed();
    const row = rowFor(card);
    fireEvent.click(row);

    // The zero is honest here — nobody, the reader's earlier self
    // included, has ever picked this option on a first try — so the fix
    // is the sentence that explains it, not the number.
    expect(row.textContent).toMatch(/0 people/);
    expect(screen.getByText(/only a first answer counts/)).toBeTruthy();
    expect(screen.queryByText(/everyone’s first try at this card/), "the misleading line survived")
      .toBeNull();
  });

  it("names a crowd of one as your own", async () => {
    live = installLive();
    const card = firstCard();
    // Nobody else, and your own answer pending: "From 1 answer —
    // everyone's first try at this card" is true and reads as broken data.
    stubCrowd(card.id, { total: 1, counts: { [String(wrong(card))]: 0 } }, { idx: card.c, folded: false });

    mountFeed();
    await growFeed();
    const row = rowFor(card);
    fireEvent.click(row);

    expect(screen.getByText(/Yours is the only answer so far/)).toBeTruthy();
    expect(row.textContent).toMatch(/1 person/);
  });
});

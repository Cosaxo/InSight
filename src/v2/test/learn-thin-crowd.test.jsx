// @vitest-environment jsdom
//
// "100% OF PEOPLE GET THIS RIGHT" OFF ONE FIRST TRY, WHICH IS YOUR OWN.
//
// `learnMeasured` publishes whenever the total is above zero, and
// `typicality`-style floors do not exist here — so a single first attempt
// became a measured crowd rate on the Map node, in the card's ⓘ sheet, and
// on the feed's reveal headline. That one answer is the reader's by
// construction on the Map: a learn card only reaches it once you have
// mastered the fact, and `LEARN_COUNTS` folds in your own pending answer.
//
// THE FLOOR IS PER CONSUMER, and that is the finding rather than the fix.
// Putting it in `learnMeasured` looked right and reds two cases in
// learn-reserve.test.jsx: the feed's reveal footer is downstream of the
// measured SPLIT, not merely of the counts, so a floor there deletes the
// one surface that already handles a crowd of one honestly ("Yours is the
// only answer so far."). Putting it in `LEARN_COUNTS` breaks the same
// footer, which reads the counts and needs the 1. So the two consumers
// that print a crowd RATE refuse below two, and the footer is left alone.
//
// The stub goes through the MODULE, not through `window` — learn-data.js
// imports the binding (D354/D280).
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.setConfig({ testTimeout: 15000 });

const STUB = vi.hoisted(() => ({ live: null }));
vi.mock("../data/live", async (importOriginal) => {
  const real = await importOriginal();
  return { get default() { return STUB.live ?? real.default; } };
});

let LEARN_CARDS;
let MTLearnCard;
let realLive;

beforeAll(async () => {
  const specIndex = await import("../spec-index.js");
  await specIndex.loadWorldFeed();
  await specIndex.loadMapTab();
  LEARN_CARDS = (await import("../spec/learn-data.js")).LEARN_CARDS;
  MTLearnCard = (await import("../spec/map-learn-card.jsx")).MTLearnCard;
  realLive = window.LIVE;
});

afterEach(() => {
  window.LIVE = realLive;
  STUB.live = null;
  cleanup();
});

/** A live store whose learn aggregate for the card holds exactly `n`
 *  first tries, all of them correct — so the rate is 100% either way and
 *  only the BASIS separates the two cases. */
function installLearn(cardId, n) {
  STUB.live = {
    enabled: true,
    ready: true,
    learnAgg: (id) => (id === cardId ? { tooSmall: false, total: n, counts: { 0: n } } : null),
    learnMine: () => null,
    learnAggLoading: () => false,
    confirmedVotes: () => ({}),
    myVotes: () => ({}),
    dailyBank: () => [],
    aggFor: () => null,
    anchors: () => ({ ageBand: "25-34" }),
  };
  window.LIVE = STUB.live;
  window.dispatchEvent(new Event("insight-live-update"));
}

const cardOf = () => (LEARN_CARDS && LEARN_CARDS.length ? LEARN_CARDS[0] : null);

const draw = (n) => {
  const card = cardOf();
  expect(card, "no learn card to draw — this file lost its target").toBeTruthy();
  installLearn(card.id, n);
  const Card = MTLearnCard;
  expect(Card, "MTLearnCard is not exported — this file lost its target").toBeTruthy();
  const { container } = render(<Card node={{ id: "n1", cid: card.id }} card={card}></Card>);
  return container.textContent || "";
};

describe("the Map's learn card states what its crowd rate rests on", () => {
  it("does not call one first try a measured crowd", () => {
    const text = draw(1);
    expect(text, "one answer — the reader's own — was printed as a crowd rate")
      .not.toMatch(/% of people get this right/);
  });

  it("draws the rate once two people have answered — the control", () => {
    // Without this, "never draw a rate" would satisfy the case above and
    // cost the card the reading it exists for.
    const text = draw(2);
    expect(text, "the control lost the crowd rate entirely").toMatch(/% of people get this right/);
  });

  it("hedges the DEMO's authored figure instead of stating it as a measurement", () => {
    // The demo build has no aggregate at all, so LEARN_RATE falls to the
    // bank's authoring difficulty hint — a number nobody measured. The
    // card's own comment says "about" carries the hedge "only in the DEMO
    // now", and the condition it was carried by, `est && LIVE.enabled`,
    // is never both true: an estimate exists ONLY where the build is not
    // live. So the hint printed as "N% of people get this right", which
    // is the sentence the hedge exists to avoid.
    const card = cardOf();
    expect(card).toBeTruthy();
    // A demo store: LIVE off, and no learn aggregate to measure from.
    STUB.live = {
      enabled: false, ready: false,
      learnAgg: () => null, learnMine: () => null, learnAggLoading: () => false,
      confirmedVotes: () => ({}), myVotes: () => ({}), dailyBank: () => [],
      aggFor: () => null, anchors: () => ({}),
    };
    window.LIVE = STUB.live;
    window.dispatchEvent(new Event("insight-live-update"));
    const { container } = render(<MTLearnCard node={{ id: "n1", cid: card.id }} card={card}></MTLearnCard>);
    const text = container.textContent || "";
    expect(text, "the authored hint was stated as a measurement").toMatch(/about \d+% get this right — our estimate/);
    expect(text).not.toMatch(/\d+% of people get this right/);
  });
});

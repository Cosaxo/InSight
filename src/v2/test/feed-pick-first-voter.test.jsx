// @vitest-environment jsdom
//
// The live catalogue pick card, answered by the FIRST person to answer it.
//
// `LIVE.pickCanon` joins your own unfolded pick into the board at read
// time, so a question nobody else has answered hands the card a board of
// exactly one row: yours. The card read that as a crowd and said so three
// times over — "you and the crowd", "#1 on the board", "100.0%" — which is
// the D365 +1 family's sixth site and the one with no floor at all: the
// predicate the other surfaces use (`wfNoCrowd`) is vacuously true for a
// pick card, because it tests an `options` array a pick card does not
// carry, so wiring it here would have floored every pick card forever.
//
// Nothing could see it: the shared fixture models a thin board as an EMPTY
// one (`top: []`), which is the one shape the real store never produces —
// it always joins the reader. Mounted directly, like feed-pick-tile-copy.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { COUNTRIES } from "../data/catalogs";
import { growUntil } from "./mount-app";
import { installLive } from "./live-fixture";

vi.setConfig({ testTimeout: 30000 });

const QID = "pick-first-voter-countries";
const PROMPT = "First-voter countries pick: the one you would move to?";
const ROWS = [[578, "Norway"], [4, "Afghanistan"], [8, "Albania"]].map(([key, name]) => ({ key, name }));

let WorldFeed;
let live;

beforeAll(async () => {
  const specIndex = await import("../spec-index.js");
  await specIndex.loadWorldFeed();
  WorldFeed = window.WorldFeed;
});

beforeEach(() => {
  localStorage.clear();
  live = installLive({ pickCard: false });
  window.WORLD_FEED_QS.push({
    id: QID, cat: "fav", type: "pick", domain: "countries", prompt: PROMPT,
    n: 0, live: true, noCountsYet: true,
  });
  vi.spyOn(COUNTRIES, "peek").mockReturnValue(ROWS);
  vi.spyOn(COUNTRIES, "load").mockResolvedValue(ROWS);
  window.LIVE.pickSegs = () => [];
  window.LIVE.pickSeg = () => null;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  live.restore();
});

const answerIt = async () => {
  render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
  await growUntil(() => !!screen.queryByText(PROMPT), "the pick card");
  const tile = await screen.findByText("Norway");
  fireEvent.click(tile.closest("button") || tile);
  await growUntil(
    () => /nobody else yet|on the board/.test(document.body.textContent || ""),
    "the answered pick card's tiles",
  );
  const txt = document.body.textContent || "";
  return txt.slice(txt.indexOf(PROMPT), txt.indexOf(PROMPT) + 400);
};

describe("the first person to answer a live pick card", () => {
  it("is not told they are the crowd", async () => {
    // The real store's first-voter board: your own vote, nobody else's.
    window.LIVE.pickCanon = () => ({
      top: [{ entity: 578, count: 1 }], rest: 0, total: 1, restEntities: 0, restBelowFloor: false,
    });
    const card = await answerIt();
    expect(card, "a board of one was labelled the crowd").not.toContain("you and the crowd");
    expect(card, "a population of one was given a percentage").not.toContain("100.0%");
    expect(card, "a board of one was ranked against itself").not.toContain("#1 on the board");
    expect(card).toContain("your pick");
    expect(card).toContain("nobody else yet");
  });

  it("…and IS told, the moment a second person is there — the control", async () => {
    // Two rows, the reader agreeing with the leader: every claim the case
    // above refuses is true here, and must still be drawn.
    window.LIVE.pickCanon = () => ({
      top: [{ entity: 578, count: 7 }, { entity: 4, count: 3 }],
      rest: 0, total: 10, restEntities: 0, restBelowFloor: false,
    });
    const card = await answerIt();
    expect(card).toContain("you and the crowd");
    expect(card).toContain("#1 on the board");
    expect(card).toContain("70.0%");
  });
});

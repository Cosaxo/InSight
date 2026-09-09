// @vitest-environment jsdom
//
// The pick card's browse row on a domain that is NOT a fame ranking (D389).
//
// D308 drew the catalogue's head as tiles over the search — and only for
// the sitelink-ranked domains, on the reasoning that an alphabetical
// catalogue's head offered the same way would read as a ranking it is
// not. So a countries card was a search field alone over "one pick from
// 250": the domain invisible until you knew what to type, which is the
// ask D308 was built to answer. The row now draws every domain in the
// file's own order, one page at a time. These cases mount the real feed
// on a live countries card against a stubbed catalogue: the first page is
// the file's first page in its order, the search stays under it, a tile
// on the second page is exactly the search's pick, and answering takes
// the row away with the search.
//
// The catalogue is stubbed at its STORE (COUNTRIES.peek/load), not mocked
// as a module: world-feed.jsx and PickSearch.tsx both import the same
// binding, and a spy on the object reaches both without a second copy of
// the module graph.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { COUNTRIES } from "../data/catalogs";
import { growUntil } from "./mount-app";
import { installLive } from "./live-fixture";

vi.setConfig({ testTimeout: 15000 });

const QID = "pick-fixture-countries";
const PROMPT = "Fixture countries pick: the one you would move to?";
// Ten rows in the file's own order (alphabetical, ISO-numeric keys), so a
// page of eight leaves two — Norway among them, off the first page.
const ROWS = [
  [4, "Afghanistan"], [248, "Åland Islands"], [8, "Albania"], [12, "Algeria"],
  [16, "American Samoa"], [20, "Andorra"], [24, "Angola"], [660, "Anguilla"],
  [10, "Antarctica"], [578, "Norway"],
].map(([key, name]) => ({ key, name }));

let WorldFeed;
let live;

beforeAll(async () => {
  const specIndex = await import("../spec-index.js");
  await specIndex.loadWorldFeed();
  WorldFeed = window.WorldFeed;
});

beforeEach(() => {
  localStorage.clear();
  live = installLive();
  window.WORLD_FEED_QS.push({
    id: QID, cat: "fav", type: "pick", domain: "countries", prompt: PROMPT,
    n: 0, live: true,
  });
  vi.spyOn(COUNTRIES, "peek").mockReturnValue(ROWS);
  vi.spyOn(COUNTRIES, "load").mockResolvedValue(ROWS);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  live.restore();
  localStorage.removeItem("insight.feedVotes.v1");
});

async function mountCard() {
  render(<WorldFeed cats={{}} onToggle={() => {}} beats={false} />);
  await growUntil(() => !!screen.queryByText(PROMPT), "the countries card");
  return screen.getByText(PROMPT).parentElement;
}

const tileNames = (card) =>
  [...card.querySelectorAll("button[aria-label]:not([data-tile-more])")]
    .map((b) => b.getAttribute("aria-label"))
    .filter((n) => ROWS.some((r) => r.name === n));

describe("a pick card on an alphabetical domain browses its catalogue", () => {
  it("offers the file's first page as tiles, in the file's order, over the search", async () => {
    const card = await mountCard();
    expect(tileNames(card)).toEqual(ROWS.slice(0, 8).map((r) => r.name));
    expect(within(card).getByRole("button", { name: "2 more" })).toBeTruthy();
    // the search is still the other door, under the row
    expect(within(card).getByRole("button", { name: "Search countries…" })).toBeTruthy();
    expect(within(card).getByText(/one pick from 250/)).toBeTruthy();
  });

  it("a tile on the next page is the search's pick — the key, through votePick", async () => {
    const card = await mountCard();
    expect(within(card).queryByRole("button", { name: "Norway" })).toBeNull();
    fireEvent.click(within(card).getByRole("button", { name: "2 more" }));
    fireEvent.click(within(card).getByRole("button", { name: "Norway" }));
    expect(window.LIVE.myVotes()[QID]).toBe("578");
    // answered: the row and the search are gone with the ask
    await growUntil(() => !within(card).queryByRole("button", { name: "Search countries…" }), "the reveal");
    expect(tileNames(card)).toEqual([]);
  });
});

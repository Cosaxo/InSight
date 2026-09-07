// @vitest-environment jsdom
//
// The pictures on a live pick card (D420), mounted through the real feed
// on a stubbed catalogue with a mocked art index: a tile whose key the
// index carries draws the hosted picture over its face and a tile it
// does not carry draws none; the credits door sits under the row; and
// after the pick, the reveal's "your pick" face carries the same picture
// with the same door under it. feed-pick-browse.test.jsx's fixture, one
// index over — the same countries card, the same store stub.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

// Afghanistan (4) is on the first page, Norway (578) on the second; Albania
// (8) has no picture, so the row is exactly the half-pictured case the
// fallback exists for.
vi.mock("../data/catalogArtIndex", () => ({
  CATALOG_ART: { countries: { png: [4, 578] } },
}));

import { COUNTRIES } from "../data/catalogs";
import { SITE_ORIGIN } from "../data/siteOrigin";
import { growUntil } from "./mount-app";
import { installLive } from "./live-fixture";

vi.setConfig({ testTimeout: 15000 });

const QID = "pick-fixture-countries-art";
const PROMPT = "Fixture countries pick: the flag you would fly?";
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

const artSrc = (el) => el.querySelector("img[data-pick-art]")?.getAttribute("src") ?? null;

describe("a live pick card draws the catalogue's pictures", () => {
  it("over the face of a tile the index carries, none over a tile it does not, credits under the row", async () => {
    const card = await mountCard();
    expect(artSrc(within(card).getByRole("button", { name: "Afghanistan" })))
      .toBe(`${SITE_ORIGIN}/catalog-art/countries/4.png`);
    expect(artSrc(within(card).getByRole("button", { name: "Albania" }))).toBeNull();
    // one picture on the page, not one per tile
    expect(card.querySelectorAll("img[data-pick-art]")).toHaveLength(1);
    expect(within(card).getByRole("button", { name: "Image credits" })).toBeTruthy();
  });

  it("and on the reveal's own face after the pick, with the door under it", async () => {
    const card = await mountCard();
    fireEvent.click(within(card).getByRole("button", { name: "2 more" }));
    fireEvent.click(within(card).getByRole("button", { name: "Norway" }));
    expect(window.LIVE.myVotes()[QID]).toBe("578");
    await growUntil(() => !within(card).queryByRole("button", { name: "Search countries…" }), "the reveal");
    await growUntil(() => !!card.querySelector("img[data-pick-art]"), "the reveal's picture");
    const srcs = [...card.querySelectorAll("img[data-pick-art]")].map((i) => i.getAttribute("src"));
    // your pick, Norway — and nothing for the crowd's leader, whose key
    // the index does not carry
    expect(srcs).toEqual([`${SITE_ORIGIN}/catalog-art/countries/578.png`]);
    expect(within(card).getByText("your pick")).toBeTruthy();
    expect(within(card).getByRole("button", { name: "Image credits" })).toBeTruthy();
  });
});

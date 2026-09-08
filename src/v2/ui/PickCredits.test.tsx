// @vitest-environment jsdom
//
// PickCredits (D420): nothing for a domain with no pictures, a door for
// one with them, the list fetched from hosting on the first open only,
// the TMDB sentence where a poster is on the list, and an outage said
// rather than shown as an empty box.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../data/catalogArtIndex", () => ({
  CATALOG_ART: { athletes: { jpg: [615] }, films: { jpg: [44578] }, pokemon: { webp: [25] } },
}));

import PickCredits from "./PickCredits";
import { resetCatalogArtForTests } from "../data/catalogArt";
import { SITE_ORIGIN } from "../data/siteOrigin";

const ATHLETES = "# 1 entries.\n615\t615.jpg\tLionel Messi\tКирилл Венедиктов\tCC BY-SA 3.0\thttps://commons.wikimedia.org/wiki/File:Lionel_Messi_20180626.jpg\n";
const FILMS = "# 1 entries.\n44578\t44578.jpg\tTitanic (1997)\tTMDB\tTMDB\thttps://www.themoviedb.org/movie/597\n";
const POKEMON = "# 1 entries.\n25\t25.webp\tPikachu\tNintendo / Creatures Inc. / GAME FREAK inc.\tPokeAPI\thttps://github.com/PokeAPI/sprites/blob/master/sprites/pokemon/other/official-artwork/25.png\n";

beforeEach(() => resetCatalogArtForTests());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("PickCredits", () => {
  it("renders nothing at all for a domain with no pictures", () => {
    const { container } = render(<PickCredits domain="emoji" accent="var(--ink)" />);
    expect(container.innerHTML).toBe("");
  });

  it("opens into the domain's credits, fetched from hosting once", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<{ ok: boolean; text: () => Promise<string> }>>(async () => ({ ok: true, text: async () => ATHLETES }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PickCredits domain="athletes" accent="var(--ink)" />);
    expect(fetchMock).not.toHaveBeenCalled();
    const door = screen.getByRole("button", { name: "Image credits" });
    expect(door.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(door);
    expect(door.getAttribute("aria-expanded")).toBe("true");
    await waitFor(() => expect(screen.getByText(/Кирилл Венедиктов · CC BY-SA 3\.0/)).toBeTruthy());
    expect(screen.getByText(/^Lionel Messi/)).toBeTruthy();
    expect(screen.getByText(/Wikimedia Commons/)).toBeTruthy();
    const src = screen.getByRole("link", { name: "source" }) as HTMLAnchorElement;
    expect(src.getAttribute("href")).toContain("commons.wikimedia.org");
    expect(src.getAttribute("rel")).toContain("noopener");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${SITE_ORIGIN}/catalog-art/athletes/credits.tsv`);
    // closed and reopened: the cache answers, hosting is not asked again
    fireEvent.click(door);
    expect(screen.queryByRole("region", { name: "Image credits" })).toBeNull();
    fireEvent.click(door);
    expect(screen.getByText(/^Lionel Messi/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("carries TMDB's sentence when a poster is on the list, and no author line for it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => FILMS })));
    render(<PickCredits domain="films" accent="var(--ink)" />);
    fireEvent.click(screen.getByRole("button", { name: "Image credits" }));
    await waitFor(() => expect(screen.getByText(/not endorsed or certified by TMDB/)).toBeTruthy());
    expect(screen.getByText(/^Titanic \(1997\)/).textContent).not.toContain("·");
    expect(screen.queryByText(/Wikimedia Commons/)).toBeNull();
  });

  it("names the rights-holders once for Pokémon artwork (D421), a ruled source like TMDB", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => POKEMON })));
    render(<PickCredits domain="pokemon" accent="var(--ink)" />);
    fireEvent.click(screen.getByRole("button", { name: "Image credits" }));
    await waitFor(() => expect(screen.getByText(/© Nintendo, Creatures Inc\. and GAME FREAK inc\., via PokéAPI/)).toBeTruthy());
    expect(screen.getByText(/^Pikachu/).textContent).not.toContain("·");
    expect(screen.queryByText(/not endorsed or certified by TMDB/)).toBeNull();
    expect(screen.queryByText(/Wikimedia Commons/)).toBeNull();
  });

  it("says so when hosting cannot be reached, instead of an empty box", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, text: async () => "" })));
    render(<PickCredits domain="athletes" accent="var(--ink)" />);
    fireEvent.click(screen.getByRole("button", { name: "Image credits" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/Couldn.t load the credits/));
  });
});

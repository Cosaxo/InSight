// catalogArt.ts (D421): the URL is built from the index and the site
// origin, a key the index lacks fires nothing, the credits parse the
// builder's six columns, and the credits fetch caches success and forgets
// failure.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./catalogArtIndex", () => ({
  CATALOG_ART: {
    athletes: { jpg: [615, 11571], png: [36107] },
    films: { jpg: [44578] },
    empty: {},
  },
}));

import {
  catalogArtUrl, hasCatalogArt, parseCatalogCredits, loadCatalogCredits, resetCatalogArtForTests,
  TMDB_NOTICE, SOURCE_NOTICES,
} from "./catalogArt";
import { SITE_ORIGIN } from "./siteOrigin";

beforeEach(() => resetCatalogArtForTests());
afterEach(() => vi.unstubAllGlobals());

describe("catalogArtUrl", () => {
  it("names the picture on OUR hosting, by domain, key and the index's extension", () => {
    expect(catalogArtUrl("athletes", 615)).toBe(`${SITE_ORIGIN}/catalog-art/athletes/615.jpg`);
    expect(catalogArtUrl("athletes", 36107)).toBe(`${SITE_ORIGIN}/catalog-art/athletes/36107.png`);
    expect(catalogArtUrl("films", 44578)).toBe(`${SITE_ORIGIN}/catalog-art/films/44578.jpg`);
  });
  it("is empty — no request at all — for a key, a domain, or Not listed the index does not carry", () => {
    expect(catalogArtUrl("athletes", 999)).toBe("");
    expect(catalogArtUrl("athletes", 0)).toBe("");
    expect(catalogArtUrl("emoji", 128293)).toBe("");
    expect(catalogArtUrl("empty", 1)).toBe("");
  });
  it("hasCatalogArt says which domains have any picture", () => {
    expect(hasCatalogArt("athletes")).toBe(true);
    expect(hasCatalogArt("empty")).toBe(false);
    expect(hasCatalogArt("emoji")).toBe(false);
  });
});

describe("parseCatalogCredits", () => {
  it("reads the six columns and skips the header, blanks and anything malformed", () => {
    const rows = parseCatalogCredits(
      "# header\n# 2 entries.\n615\t615.jpg\tLionel Messi\tК. Венедиктов\tCC BY-SA 3.0\thttps://c/1\n\nbad\tline\n36107\t36107.png\tMuhammad Ali\tIra Rosenberg\tPublic domain\thttps://c/2\n",
    );
    expect(rows).toEqual([
      { key: 615, file: "615.jpg", name: "Lionel Messi", author: "К. Венедиктов", licence: "CC BY-SA 3.0", source: "https://c/1" },
      { key: 36107, file: "36107.png", name: "Muhammad Ali", author: "Ira Rosenberg", licence: "Public domain", source: "https://c/2" },
    ]);
  });
  it("pins the TMDB sentence the terms ask for verbatim, and one notice per ruled source the builder admits", () => {
    expect(TMDB_NOTICE).toBe("This product uses the TMDB API but is not endorsed or certified by TMDB.");
    // The builder's policy admits exactly these tags — scripts/catalog-art-lib.test.mjs
    // pins RULED_SOURCE_TAGS to the same literal list, so a tag added on
    // either side without the other fails one of the two suites. A tag the
    // builder admits with no notice here would ship a picture with no
    // credit at all, which for a ruled source is the whole credit.
    expect(Object.keys(SOURCE_NOTICES).sort()).toEqual(["PokeAPI", "TMDB"]);
  });
});

describe("loadCatalogCredits", () => {
  const tsv = "# 1 entries.\n615\t615.jpg\tLionel Messi\tA\tCC BY-SA 3.0\thttps://c/1\n";

  it("fetches the domain's credits.tsv from hosting once and caches the rows", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<{ ok: boolean; text: () => Promise<string> }>>(async () => ({ ok: true, text: async () => tsv }));
    vi.stubGlobal("fetch", fetchMock);
    const a = await loadCatalogCredits("athletes");
    const b = await loadCatalogCredits("athletes");
    expect(a).toHaveLength(1);
    expect(a[0].name).toBe("Lionel Messi");
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${SITE_ORIGIN}/catalog-art/athletes/credits.tsv`);
  });

  it("asks nothing for a domain with no art", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadCatalogCredits("emoji")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects on a bad response and forgets it, so the next open retries", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" })
      .mockResolvedValueOnce({ ok: true, text: async () => tsv });
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadCatalogCredits("athletes")).rejects.toThrow(/HTTP 404/);
    expect(await loadCatalogCredits("athletes")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

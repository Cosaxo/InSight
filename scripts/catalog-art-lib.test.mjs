// The catalogue-art library's contracts (D420), proved on the pure parts:
// the licence policy, the credits format both ways, and the app-index
// writer. The builder's network half has no test here — it is an operator
// step against Commons, Wikidata and TMDB (D15's reason), and a mock of
// three services would test the mock.
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  licenceAllowed, stripHtml, cleanField, extOf, formatCredits, parseCredits,
  artDomains, readCredits, readCatalogue, regenerateCatalogArtIndex,
  ART_DIR, INDEX_FILE, CREDITS_FILE, IMAGE_EXTS, MAX_IMAGE_BYTES, CATALOG_FILES,
} from "./catalog-art-lib.mjs";

describe("licenceAllowed — the one policy every path shares", () => {
  it("admits the free-for-commercial-reuse licences Commons reports", () => {
    for (const s of [
      "CC BY-SA 4.0", "CC BY-SA 3.0", "CC BY 2.0", "CC BY-SA 2.0 de", "CC BY-SA 3.0 igo",
      "CC BY 4.0", "CC0", "CC0 1.0", "Public domain", "PD-US", "PD-Art", "CC-PD-Mark",
      "No restrictions", "No known copyright restrictions", "FAL", "Attribution",
      "Copyrighted free use", "cc by-sa 4.0", " CC  BY-SA 4.0 ",
    ]) {
      expect(licenceAllowed(s), s).toEqual({ ok: true });
    }
  });

  it("admits TMDB as the poster route's own tag", () => {
    expect(licenceAllowed("TMDB")).toEqual({ ok: true });
  });

  it("refuses NonCommercial, NoDerivatives, fair use and GFDL-only, each by name", () => {
    expect(licenceAllowed("CC BY-NC 2.0").why).toBe("NonCommercial");
    expect(licenceAllowed("CC BY-NC-SA 4.0").why).toBe("NonCommercial");
    expect(licenceAllowed("CC BY-ND 4.0").why).toBe("NoDerivatives");
    expect(licenceAllowed("Fair use").why).toBe("not a free licence");
    expect(licenceAllowed("Non-free poster").why).toBe("not a free licence");
    expect(licenceAllowed("All rights reserved").why).toBe("not a free licence");
    expect(licenceAllowed("GFDL").why).toMatch(/GFDL-only/);
    expect(licenceAllowed("GFDL 1.2").why).toMatch(/GFDL-only/);
  });

  it("refuses what it does not recognise, and an empty licence, rather than admitting either", () => {
    expect(licenceAllowed("").ok).toBe(false);
    expect(licenceAllowed(undefined).ok).toBe(false);
    expect(licenceAllowed("Some house licence").ok).toBe(false);
    expect(licenceAllowed("Some house licence").why).toContain("unrecognised");
    // a NonCommercial string never sneaks through by prefix
    expect(licenceAllowed("CC BY-NC 4.0 de").ok).toBe(false);
  });
});

describe("stripHtml / cleanField", () => {
  it("turns Commons' HTML author field into the words, entities decoded", () => {
    expect(stripHtml('<a href="//commons.wikimedia.org/wiki/User:X" title="User:X">Кирилл Венедиктов</a>'))
      .toBe("Кирилл Венедиктов");
    expect(stripHtml("Tom &amp; Jerry &#39;99 &#x41;")).toBe("Tom & Jerry '99 A");
    expect(stripHtml("A<br>B  \n C")).toBe("A B C");
  });
  it("caps a paragraph to a name-sized string", () => {
    const long = "x".repeat(300);
    expect(stripHtml(long).length).toBe(100);
    expect(stripHtml(long).endsWith("…")).toBe(true);
  });
  it("cleanField folds tabs and line breaks — a field may hold neither", () => {
    expect(cleanField("a\tb\nc\r\n  d")).toBe("a b c d");
  });
  it("extOf reads the extension, lowercased, and nothing for none", () => {
    expect(extOf("615.jpg")).toBe("jpg");
    expect(extOf("36107.PNG")).toBe("png");
    expect(extOf("credits")).toBe("");
  });
});

describe("the credits manifest, both ways", () => {
  const ROWS = [
    { key: 11571, file: "11571.jpg", name: "Cristiano Ronaldo", author: "Fanny Schertzer", licence: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/wiki/File:X.jpg" },
    { key: 615, file: "615.jpg", name: "Lionel Messi", author: "Кирилл Венедиктов", licence: "CC BY-SA 3.0", source: "https://commons.wikimedia.org/wiki/File:Lionel_Messi_20180626.jpg" },
  ];

  it("writes sorted rows under a header that states the count, and reads them back", () => {
    const text = formatCredits("athletes", ROWS);
    expect(text.startsWith("# InSight catalogue art credits")).toBe(true);
    expect(text).toContain("# 2 entries.");
    expect(text).toContain("public/athletes.txt");
    const parsed = parseCredits(text);
    expect(parsed.errors).toEqual([]);
    expect(parsed.headerCount).toBe(2);
    expect(parsed.rows.map((r) => r.key)).toEqual([615, 11571]);
    expect(parsed.rows[0]).toEqual(ROWS[1]);
  });

  it("folds a tab inside a field rather than writing a seventh column", () => {
    const text = formatCredits("athletes", [{ ...ROWS[1], author: "Two\tWords" }]);
    const parsed = parseCredits(text);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0].author).toBe("Two Words");
  });

  it("names a hand-edited row instead of dropping it silently", () => {
    const parsed = parseCredits("# 1 entries.\n615\t615.jpg\tLionel Messi\n");
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors[0]).toMatch(/line 2: expected 6/);
    const zero = parseCredits("0\t0.jpg\tNot listed\t\tCC0\thttps://x");
    expect(zero.rows).toEqual([]);
    expect(zero.errors[0]).toMatch(/not a catalogue key/);
  });
});

describe("the app index, regenerated from the directories", () => {
  let root;
  afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = null; });

  function tree(files) {
    root = mkdtempSync(join(tmpdir(), "catalog-art-lib-"));
    for (const [p, body] of Object.entries(files)) {
      mkdirSync(join(root, p, ".."), { recursive: true });
      writeFileSync(join(root, p), body);
    }
    return root;
  }

  it("lists every domain directory's keys by extension, and only those", () => {
    tree({
      "public/athletes.txt": "# 2 entries\n615\tLionel Messi\n36107\tMuhammad Ali\n",
      [`${ART_DIR}/athletes/${CREDITS_FILE}`]: formatCredits("athletes", [
        { key: 615, file: "615.jpg", name: "Lionel Messi", author: "A", licence: "CC BY-SA 3.0", source: "https://c/1" },
        { key: 36107, file: "36107.png", name: "Muhammad Ali", author: "B", licence: "Public domain", source: "https://c/2" },
        { key: 999, file: "999.gif", name: "Nobody", author: "C", licence: "CC0", source: "https://c/3" },
      ]),
      [`${ART_DIR}/README.md`]: "not a domain\n",
    });
    expect(artDomains(root)).toEqual(["athletes"]);
    expect(readCatalogue(root, "athletes").get(615)).toBe("Lionel Messi");
    expect(readCatalogue(root, "nosuch")).toBeNull();
    expect(readCredits(root, "athletes").rows).toHaveLength(3);
    expect(readCredits(root, "films").present).toBe(false);

    const summary = regenerateCatalogArtIndex(root, "test");
    expect(summary).toEqual({ athletes: { jpg: 1, png: 1 } });
    const ts = readFileSync(join(root, INDEX_FILE), "utf8");
    expect(ts).toContain("export const CATALOG_ART");
    expect(ts).toContain("athletes: {");
    expect(ts).toContain("jpg: [615],");
    expect(ts).toContain("png: [36107],");
    // the gif is refused by IMAGE_EXTS and never reaches the app
    expect(ts).not.toContain("999");
  });

  it("writes an empty index for a tree with no art, so the app asks nothing of the network", () => {
    tree({ "public/athletes.txt": "615\tLionel Messi\n" });
    expect(regenerateCatalogArtIndex(root, "test")).toEqual({});
    const ts = readFileSync(join(root, INDEX_FILE), "utf8");
    expect(ts).toMatch(/= \{\n\};\n$/);
  });

  it("pins the constants the gate and the builder both read", () => {
    expect(ART_DIR).toBe(join("web", "catalog-art"));
    expect(INDEX_FILE).toBe(join("src", "v2", "data", "catalogArtIndex.ts"));
    expect(IMAGE_EXTS).toEqual(["jpg", "png", "webp"]);
    expect(MAX_IMAGE_BYTES).toBe(64 * 1024);
    expect(CATALOG_FILES.athletes).toBe("athletes.txt");
  });
});

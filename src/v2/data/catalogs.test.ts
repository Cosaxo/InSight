// Pins the QID-catalogue contract (docs/CATALOG-QUESTIONS.md, D15).
// Fixture-based, unlike pokedex.test.ts's shipped-file leg: the real files
// land via an operator run of build-catalog.mjs (films at D266; artists
// waits on the curation ruling D267 built the machinery for), and their
// committed form is gated by scripts/check-catalogs.mjs — what this suite
// pins is the parse/search/resolve behaviour those files rely on.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COUNTRIES, DOGS, EMOJI, FILMS, parseCatalog, COLORS } from "./catalogs";

// Popularity order, sparse QID keys — the generator's output shape,
// including a remake disambiguated by year and an accented name.
const SAMPLE = [
  "# InSight films catalogue — GENERATED, do not edit.",
  "# 5 entries, popularity order. Format: `key<TAB>name`.",
  "47703\tThe Godfather (1972)",
  "104123\tPulp Fiction",
  "188473\tAmélie",
  "223655\tHamlet (1948)",
  "1392744\tGodfather (1991)",
  "",
].join("\n");

const entries = parseCatalog(SAMPLE);

describe("parseCatalog", () => {
  it("reads sparse QID-keyed rows and skips comments", () => {
    expect(entries).toHaveLength(5);
    expect(entries[0]).toEqual({ key: 47703, name: "The Godfather (1972)" });
    expect(entries[4]).toEqual({ key: 1392744, name: "Godfather (1991)" });
  });

  it("drops rows whose key is not a positive integer", () => {
    expect(parseCatalog("x\tBad\n0\tNotListedIsNotARow\n104123\tGood\n")).toEqual([
      { key: 104123, name: "Good" },
    ]);
  });
});

describe("nameOf", () => {
  it("resolves a stored key to its display name, sparse keys included", () => {
    expect(FILMS.nameOf(entries, 188473)).toBe("Amélie");
    expect(FILMS.nameOf(entries, 1392744)).toBe("Godfather (1991)");
  });

  it("names the Not listed bucket and refuses unknown keys", () => {
    expect(FILMS.nameOf(entries, 0)).toBe("Not listed");
    // A key BETWEEN two real QIDs — exactly what sparse validation is
    // about; resolving it to anything would be inventing an entry.
    expect(FILMS.nameOf(entries, 47704)).toBeNull();
  });
});

describe("search", () => {
  it("ranks prefix over word-start over interior, file (popularity) order within a rank", () => {
    // "godfather": word-start hit on "The Godfather (1972)" (rank 1) but
    // prefix hit on "Godfather (1991)" (rank 0) — the alias class the
    // sketch called out ("The Godfather" / "Godfather") lands both
    // without any alias column.
    expect(FILMS.search(entries, "godfather").map((e) => e.key)).toEqual([1392744, 47703]);
  });

  it("folds diacritics", () => {
    expect(FILMS.search(entries, "amelie").map((e) => e.name)).toEqual(["Amélie"]);
  });

  it("returns popularity order for an empty query", () => {
    expect(FILMS.search(entries, " ", 2).map((e) => e.key)).toEqual([47703, 104123]);
  });
});

describe("the shipped emoji catalogue", () => {
  // The pokedex.test.ts real-file leg, for the first domain built under
  // the new-catalogue contract: the committed file must parse completely
  // with unique codepoint keys, or a stored answer resolves wrong.
  const real = parseCatalog(
    readFileSync(resolve(__dirname, "../../../public/emoji.txt"), "utf8"),
  );

  it("parses completely with unique keys", () => {
    expect(real.length).toBe(1391);
    expect(new Set(real.map((e) => e.key)).size).toBe(real.length);
  });

  it("resolves a stored codepoint to its character-bearing name", () => {
    expect(EMOJI.nameOf(real, 128514)).toBe("😂 face with tears of joy");
  });

  it("finds an emoji by its word", () => {
    // File order is CLDR order, so "fire" surfaces 🚒 fire engine (travel
    // group) before 🔥 itself — both must be in the results; exact-first
    // is not the contract, presence is.
    const fire = EMOJI.search(real, "fire").map((e) => e.key);
    expect(fire).toContain(128293);
    expect(EMOJI.search(real, "sparkles")[0].key).toBe(10024);
  });
});

describe("the shipped countries catalogue", () => {
  // Same real-file leg for the countries domain: ISO 3166-1 numeric keys
  // plus the one recorded mint (Kosovo, 900 — build-countries.mjs).
  const real = parseCatalog(
    readFileSync(resolve(__dirname, "../../../public/countries.txt"), "utf8"),
  );

  it("parses completely with unique keys, mint included", () => {
    expect(real.length).toBe(250);
    expect(new Set(real.map((e) => e.key)).size).toBe(real.length);
    expect(COUNTRIES.nameOf(real, 900)).toBe("Kosovo");
  });

  it("resolves an ISO numeric code to its country", () => {
    expect(COUNTRIES.nameOf(real, 578)).toBe("Norway");
    expect(COUNTRIES.nameOf(real, 392)).toBe("Japan");
  });

  it("finds a country without its accents", () => {
    // Accent folding is the search's contract; "sao tome" must reach
    // São Tomé and Príncipe, and a prefix must rank before a substring.
    expect(COUNTRIES.search(real, "sao tome")[0].name).toBe("São Tomé and Príncipe");
    expect(COUNTRIES.search(real, "norw")[0].key).toBe(578);
  });
});

describe("the shipped dogs catalogue", () => {
  // Real-file leg for the first minted-key domain: the committed file is
  // the registry of record (build-dogs.mjs preserves it verbatim on
  // regeneration), so parse, contiguity and spot names all pin here.
  const real = parseCatalog(
    readFileSync(resolve(__dirname, "../../../public/dogs.txt"), "utf8"),
  );

  it("parses completely with contiguous minted keys", () => {
    expect(real.length).toBe(554);
    expect(new Set(real.map((e) => e.key)).size).toBe(real.length);
    expect(Math.max(...real.map((e) => e.key))).toBe(real.length);
  });

  it("resolves a minted key to its breed", () => {
    expect(DOGS.nameOf(real, 1)).toBe("Affenpinscher");
    expect(DOGS.nameOf(real, 223)).toBe("Golden Retriever");
  });

  it("finds a breed by any of its words", () => {
    expect(DOGS.search(real, "retriever").map((e) => e.name)).toContain("Golden Retriever");
    expect(DOGS.search(real, "shiba")[0].key).toBe(463);
  });
});

describe("the shipped colours catalogue", () => {
  // Real-file leg for the hex-derived domain: keys are 1 + parseInt(hex,
  // 16) (build-colors.mjs — the +1 keeps black off the Not-listed 0), so
  // the three spec anchors pin the derivation itself, not an ordering.
  const real = parseCatalog(
    readFileSync(resolve(__dirname, "../../../public/colors.txt"), "utf8"),
  );

  it("parses completely with unique hex-derived keys", () => {
    expect(real.length).toBe(139);
    expect(new Set(real.map((e) => e.key)).size).toBe(real.length);
    expect(Math.min(...real.map((e) => e.key))).toBe(1);
    expect(Math.max(...real.map((e) => e.key))).toBe(0x1000000);
  });

  it("resolves a hex-derived key to its colour", () => {
    expect(COLORS.nameOf(real, 1)).toBe("black");
    expect(COLORS.nameOf(real, 0x66339a)).toBe("rebeccapurple");
  });

  it("finds a colour, and the alias rule holds", () => {
    expect(COLORS.search(real, "rebecca")[0].key).toBe(0x66339a);
    // alphabetically-first per hex: aqua stands for cyan, gray for grey —
    // the losing alias of each pair has no row, in either family
    expect(COLORS.search(real, "aqua").length).toBeGreaterThan(0);
    expect(real.some((e) => e.name === "cyan")).toBe(false);
    expect(real.some((e) => e.name === "gray")).toBe(true);
    expect(real.some((e) => e.name === "grey")).toBe(false);
    expect(new Set(real.map((e) => e.name)).size).toBe(real.length);
  });
});

describe("the reveal resolver covers every pick domain", () => {
  // Source-level pin for world-feed.jsx's pickStore(): its final arm
  // falls back to the Pokédex, so a domain missing from the chain does
  // not error — it resolves that domain's keys against dex numbers.
  // Real names, wrong catalogue: exactly what shipped for elements
  // (pk11–pk14) while every name-level gate stayed green. This walks
  // the shipped PICK_QS and demands an explicit arm per domain.
  it("names every PICK_QS domain in pickStore's chain", () => {
    const src = readFileSync(
      resolve(__dirname, "../spec/pick-data.js"), "utf8");
    const domains = new Set(
      [...src.matchAll(/domain: '([a-z]+)'/g)].map((m) => m[1]));
    expect(domains.size).toBeGreaterThanOrEqual(4);
    const feed = readFileSync(
      resolve(__dirname, "../spec/world-feed.jsx"), "utf8");
    const chain = feed.match(/pickStore\(domain\) \{[\s\S]*?return[\s\S]*?;/)?.[0] ?? "";
    expect(chain).not.toBe("");
    for (const d of domains) {
      if (d === "pokemon") continue; // the chain's explicit final arm
      expect(chain, `pickStore has no arm for domain '${d}'`).toContain(`'${d}'`);
    }
  });
});

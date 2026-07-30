// Pins the Pokédex catalogue contract (docs/CATALOG-QUESTIONS.md). The
// failure mode is the places.test.ts one, sharpened: a stored answer is a
// dex number, so a parse that shifts or drops a row silently resolves
// someone's favourite to the WRONG species — not a missing one.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  NOT_LISTED,
  parsePokedex,
  searchPokedex,
  speciesName,
  type Species,
} from "./pokedex";

const SAMPLE = [
  "# a comment line",
  "# 4 species. Format: `dex<TAB>name`",
  "1\tBulbasaur",
  "2\tIvysaur",
  "3\tVenusaur",
  "4\tCharmander",
  "",
].join("\n");

describe("parsePokedex", () => {
  it("reads dex-keyed rows and skips comments", () => {
    const s = parsePokedex(SAMPLE);
    expect(s).toHaveLength(4);
    expect(s[0]).toEqual({ dex: 1, name: "Bulbasaur" });
    expect(s[3]).toEqual({ dex: 4, name: "Charmander" });
  });

  it("drops rows whose key is not a positive integer", () => {
    const s = parsePokedex("x\tBad\n0\tZero\n-1\tNeg\n2.5\tHalf\n1\tGood\n");
    expect(s).toEqual([{ dex: 1, name: "Good" }]);
  });

  it("parses the real shipped catalogue completely", () => {
    // The committed file, not a fixture: this is the client half of the
    // check-pokedex.mjs gate. 1,025 parsed species with keys contiguous
    // from 1 is exactly what speciesName()'s index lookup assumes.
    const text = readFileSync(resolve(__dirname, "../../../public/pokedex.txt"), "utf8");
    const s = parsePokedex(text);
    expect(s.length).toBe(1025);
    for (let i = 0; i < s.length; i++) {
      if (s[i].dex !== i + 1) {
        // One targeted failure message beats 1,025 useless assertions.
        expect.fail(`row ${i}: dex ${s[i].dex}, expected ${i + 1} — keys must be contiguous`);
      }
    }
  });
});

describe("speciesName", () => {
  const s = parsePokedex(SAMPLE);

  it("resolves a stored key to its display name", () => {
    expect(speciesName(s, 4)).toBe("Charmander");
  });

  it("names the Not listed bucket without touching the catalogue", () => {
    expect(speciesName([], NOT_LISTED)).toBe("Not listed");
  });

  it("returns null for a key the catalogue does not carry", () => {
    // A key past the end, and a key that would only resolve by accident if
    // the guard trusted the array index blindly.
    expect(speciesName(s, 99)).toBeNull();
    const gappy: Species[] = [{ dex: 7, name: "Squirtle" }];
    expect(speciesName(gappy, 1)).toBeNull();
  });
});

describe("searchPokedex", () => {
  const s = parsePokedex(
    "1\tBulbasaur\n133\tEevee\n196\tEspeon\n669\tFlabébé\n83\tFarfetch'd\n",
  );

  it("ranks prefix over word-start over interior, dex breaking ties", () => {
    // Prefix hits first, dex order within a rank (Eevee #133 before Espeon
    // #196); interior hits after, again in dex order (Farfetch'd #83 before
    // Flabébé #669). Bulbasaur has no "e" at all and must not appear.
    expect(searchPokedex(s, "e").map((x) => x.name)).toEqual([
      "Eevee", "Espeon", "Farfetch'd", "Flabébé",
    ]);
  });

  it("folds diacritics — a phone keyboard cannot owe an é", () => {
    expect(searchPokedex(s, "flabebe").map((x) => x.name)).toEqual(["Flabébé"]);
  });

  it("matches punctuation-carrying names as typed", () => {
    expect(searchPokedex(s, "farfetch").map((x) => x.name)).toEqual(["Farfetch'd"]);
  });

  it("returns catalogue order for an empty query", () => {
    expect(searchPokedex(s, "  ", 2).map((x) => x.dex)).toEqual([1, 133]);
  });
});

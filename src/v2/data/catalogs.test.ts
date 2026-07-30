// Pins the QID-catalogue contract (docs/CATALOG-QUESTIONS.md, D15).
// Fixture-based, unlike pokedex.test.ts's shipped-file leg: the real
// films/artists files land via an operator run of build-catalog.mjs, and
// their committed form is gated by scripts/check-catalogs.mjs — what this
// suite pins is the parse/search/resolve behaviour those files rely on.
import { describe, expect, it } from "vitest";
import { FILMS, parseCatalog } from "./catalogs";

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

// Pins the elements catalogue contract (docs/CATALOG-QUESTIONS.md). The
// failure mode is the pokedex.test.ts one verbatim: a stored answer is an
// atomic number, so a parse that shifts or drops a row silently resolves
// someone's favourite to the WRONG element — not a missing one.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  NOT_LISTED,
  parseElements,
  searchElements,
  elementName,
  type Element,
} from "./elements";

const SAMPLE = [
  "# a comment line",
  "# 4 elements. Format: `z<TAB>Name (Symbol)`",
  "1\tHydrogen (H)",
  "2\tHelium (He)",
  "3\tLithium (Li)",
  "4\tBeryllium (Be)",
  "",
].join("\n");

describe("parseElements", () => {
  it("reads z-keyed rows and skips comments", () => {
    const e = parseElements(SAMPLE);
    expect(e).toHaveLength(4);
    expect(e[0]).toEqual({ z: 1, name: "Hydrogen (H)" });
    expect(e[3]).toEqual({ z: 4, name: "Beryllium (Be)" });
  });

  it("drops rows whose key is not a positive integer", () => {
    const e = parseElements("x\tBad\n0\tZero\n-1\tNeg\n2.5\tHalf\n1\tGood\n");
    expect(e).toEqual([{ z: 1, name: "Good" }]);
  });

  it("parses the real shipped catalogue completely", () => {
    // The committed file, not a fixture: this is the client half of the
    // check-elements.mjs contract, asserted from the parser's side.
    const text = readFileSync(resolve(__dirname, "../../../public/elements.txt"), "utf8");
    const e = parseElements(text);
    expect(e).toHaveLength(118);
    expect(e[0]).toEqual({ z: 1, name: "Hydrogen (H)" });
    expect(e[78]).toEqual({ z: 79, name: "Gold (Au)" });
    expect(e[117]).toEqual({ z: 118, name: "Oganesson (Og)" });
  });
});

describe("elementName", () => {
  const elements: Element[] = parseElements(SAMPLE);

  it("resolves keys by index with an identity guard", () => {
    expect(elementName(elements, 2)).toBe("Helium (He)");
    expect(elementName(elements, 99)).toBeNull();
  });

  it("names the Not-listed bucket without touching the catalogue", () => {
    expect(elementName([], NOT_LISTED)).toBe("Not listed");
  });
});

describe("searchElements", () => {
  const elements: Element[] = parseElements(SAMPLE);

  it("ranks prefix over word-start over interior", () => {
    // "he" prefixes Helium; it also sits inside "Beryllium"? (no — but it
    // is interior to nothing here). Use "li": prefix of Lithium, interior
    // of Helium and Beryllium — prefix must win.
    const hits = searchElements(elements, "li");
    expect(hits[0].name).toBe("Lithium (Li)");
  });

  it("finds an element by its symbol through the word-start rule", () => {
    // "(Be)" opens with a parenthesis, so the symbol matches as a word
    // start — the display-name design carrying its weight.
    const hits = searchElements(elements, "be");
    expect(hits.map((h) => h.name)).toContain("Beryllium (Be)");
  });

  it("returns catalogue order for an empty query", () => {
    expect(searchElements(elements, "")[0].z).toBe(1);
  });
});

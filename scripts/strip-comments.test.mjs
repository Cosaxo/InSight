// strip-comments.test.mjs — the shared stripper, which had no test.
//
// Eleven gates import it now, several on the deploy path, and every one of
// them trusts two properties this file did not hold: that offsets survive
// (each caller reports a line and column to a human, and several index into
// the string after stripping), and that a comment is actually blanked. A
// stripper that quietly stopped stripping would turn every one of those
// gates back into the defect it was extracted to fix.
import { describe, it, expect } from "vitest";
import { stripComments, stripXmlComments } from "./strip-comments.mjs";

describe("stripComments — JS and TS", () => {
  it("blanks a line comment without moving anything after it", () => {
    const src = 'const A = 1; // const A = 2;\nconst B = 3;';
    const out = stripComments(src);
    expect(out.length).toBe(src.length);
    expect(out.split("\n").length).toBe(src.split("\n").length);
    expect(out).toContain("const A = 1;");
    expect(out).not.toContain("const A = 2;");
    // The line after it is byte-for-byte where it was.
    expect(out.indexOf("const B = 3;")).toBe(src.indexOf("const B = 3;"));
  });

  it("blanks a block comment and keeps its newlines", () => {
    const src = "const A = 1;\n/* const A = 2;\n   still a comment */\nconst B = 3;";
    const out = stripComments(src);
    expect(out.length).toBe(src.length);
    expect(out.split("\n").length).toBe(src.split("\n").length);
    expect(out).not.toContain("const A = 2;");
    expect(out.indexOf("const B = 3;")).toBe(src.indexOf("const B = 3;"));
  });

  it("leaves a URL alone — the `:` guard, and the reason it exists", () => {
    // `https://…` is the case every one of these gates actually hits.
    const src = 'const U = "https://example.com/x"; // gone';
    const out = stripComments(src);
    expect(out).toContain("https://example.com/x");
    expect(out).not.toContain("gone");
  });

  it("is what makes the first-match reads safe", () => {
    // The whole point, in the shape the gates use: a superseded value
    // parked above the live one must not be what `.match` returns.
    const src = '// was: export const CAP = 3;\nexport const CAP = 7;';
    expect(src.match(/CAP = (\d+)/)[1]).toBe("3");
    expect(stripComments(src).match(/CAP = (\d+)/)[1]).toBe("7");
  });
});

describe("stripXmlComments — plists and HTML", () => {
  it("blanks a commented key without moving the live one", () => {
    const src = "<dict>\n  <!-- <key>Gone</key><string>x</string> -->\n  <key>Live</key>\n</dict>";
    const out = stripXmlComments(src);
    expect(out.length).toBe(src.length);
    expect(out.split("\n").length).toBe(src.split("\n").length);
    expect(out).not.toContain("<key>Gone</key>");
    expect(out).toContain("<key>Live</key>");
    expect(out.indexOf("<key>Live</key>")).toBe(src.indexOf("<key>Live</key>"));
  });

  it("blanks a multi-line comment and keeps the line count", () => {
    const src = "<dict>\n<!--\n<key>A</key>\n<string>x</string>\n-->\n<key>B</key>\n</dict>";
    const out = stripXmlComments(src);
    expect(out.split("\n").length).toBe(src.split("\n").length);
    expect(out).not.toContain("<key>A</key>");
    expect(out).toContain("<key>B</key>");
  });

  it("is what makes the plist key lookups safe", () => {
    // The measured defect: `indexOf("<key>NAME</key>")` over raw bytes
    // found the commented one and read the value after it as live.
    const src = "<!-- <key>K</key><string>old</string> -->\n<key>K</key><string>new</string>";
    expect(src.indexOf("<key>K</key>")).toBe(5);
    expect(stripXmlComments(src).indexOf("<key>K</key>")).toBe(src.lastIndexOf("<key>K</key>"));
  });

  it("does not touch a live comment-looking string in an attribute", () => {
    // The stated limit, pinned so it is a known trade rather than a
    // surprise: this is not a parser, and the files these gates read have
    // no CDATA and no `<!--` inside an attribute.
    const src = "<key>A</key>\n<string>a -- b</string>";
    expect(stripXmlComments(src)).toBe(src);
  });

  it("leaves a file with no comments byte-identical", () => {
    const src = "<dict>\n  <key>A</key>\n  <string>x</string>\n</dict>";
    expect(stripXmlComments(src)).toBe(src);
    expect(stripComments("const A = 1;\n")).toBe("const A = 1;\n");
  });
});

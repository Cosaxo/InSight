// The two matchers behind check:touch-zoom, on the declaration shape that
// used to walk straight past both of them.
//
// The `font:` shorthand sets font-size. Neither half matched it: the JSX
// half read `fontSize` only, the stylesheet half `font-size` only. Measured
// on the real tree before the fix — a field carrying `font: "12px system-ui"`
// was walked, counted and passed, and `.zz-probe input { font: 15px/1.2 … }`
// passed too, while the same two written longhand failed correctly. 15px on
// a focusable field is D105's shipped bug and this gate's only reason to
// exist. The shorthand is already house style here (viz-primitives.jsx uses
// it at three sites).
import { describe, it, expect } from "vitest";
import { badFontSize, badCssFontSize } from "./check-touch-zoom.mjs";

describe("the JSX half", () => {
  it("catches the font: shorthand", () => {
    expect(badFontSize(`<input style={{ font: "12px system-ui" }} />`)).toBe(`"12px system-ui"`);
  });

  it("still catches the longhand it always caught", () => {
    expect(badFontSize(`<input style={{ fontSize: "12px" }} />`)).toBe(`"12px"`);
  });

  it("passes a field that defers to the token, either spelling", () => {
    // THE CONTROL. Without it a matcher that flags everything passes the two
    // cases above, and this gate would fail every field in the tree.
    expect(badFontSize(`<input style={{ fontSize: "var(--field-size)" }} />`)).toBeNull();
    expect(badFontSize(`<input style={{ font: "600 var(--field-size)/1.4 system-ui" }} />`)).toBeNull();
  });

  it("does not read fontFamily or fontWeight as a size", () => {
    // After `font` the pattern demands a colon, which "Family" is not — the
    // property that makes the shorthand safe to add at all.
    expect(badFontSize(`<input style={{ fontFamily: "serif", fontWeight: 600 }} />`)).toBeNull();
  });

  it("says nothing about a field that declares no font at all", () => {
    expect(badFontSize(`<input type="text" />`)).toBeNull();
  });
});

describe("the stylesheet half", () => {
  it("catches the font: shorthand", () => {
    expect(badCssFontSize(`font: 15px/1.2 system-ui;`)).toEqual({ prop: "font", value: "15px/1.2 system-ui" });
  });

  it("still catches font-size", () => {
    expect(badCssFontSize(`font-size: 15px;`)).toEqual({ prop: "font-size", value: "15px" });
  });

  it("names the property the sheet actually wrote", () => {
    // The failure line reported every hit as "font-size", which for a
    // shorthand names a declaration the file does not contain.
    expect(badCssFontSize(`font: 15px/1.2 system-ui;`).prop).toBe("font");
  });

  it("passes a rule that defers to the token", () => {
    expect(badCssFontSize(`font-size: var(--field-size);`)).toBeNull();
    expect(badCssFontSize(`font: var(--field-size)/1.4 system-ui;`)).toBeNull();
  });

  it("does not read font-family or font-weight as a size", () => {
    expect(badCssFontSize(`font-family: serif; font-weight: 600;`)).toBeNull();
  });

  it("does not match a property that merely ends in font", () => {
    // `--my-font: 15px` is a custom property, not a size on the field.
    expect(badCssFontSize(`--my-font: 15px;`)).toBeNull();
  });
});

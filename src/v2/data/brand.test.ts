// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { BRANDS, BRAND_DEFAULT, brandName, brandOf, currentBrand, isBrandId, pageTitle, setBrand } from "./brand";

afterEach(() => { setBrand(BRAND_DEFAULT); });

describe("brand", () => {
  it("ships as Doxa, the owner's 2026-09-12 ruling, drawn in the serif", () => {
    expect(BRAND_DEFAULT).toBe("doxa");
    expect(currentBrand().serif).toBe(true);
    expect(brandName()).toBe("Doxa");
    expect(pageTitle()).toBe("Doxa — a journal of the people around you");
  });

  it("knows the two alternatives behind the radio, whole and in parts", () => {
    expect(brandName("endoxa")).toBe("Endoxa");
    expect(brandName("insight")).toBe("inSight");
    // The accented run is the second part: the x of Doxa, Sight of inSight.
    for (const b of Object.values(BRANDS)) expect(b.parts.join("")).toBe(brandName(b.id));
    expect(BRANDS.doxa.parts[1]).toBe("x");
  });

  it("falls back to the name in force for anything it does not know", () => {
    expect(isBrandId("doxa")).toBe(true);
    expect(isBrandId("constructor")).toBe(false);
    expect(isBrandId(undefined)).toBe(false);
    expect(brandOf("nope").id).toBe("doxa");
    setBrand("insight");
    expect(brandOf(undefined).id).toBe("insight");
    expect(brandOf({}).id).toBe("insight");
  });

  it("setBrand moves the name in force and the document's title together", () => {
    const b = setBrand("endoxa");
    expect(b.id).toBe("endoxa");
    expect(currentBrand().id).toBe("endoxa");
    expect(document.title).toBe("Endoxa — a journal of the people around you");
    // A stale tweak value is not a blank wordmark.
    expect(setBrand("gone").id).toBe(BRAND_DEFAULT);
    expect(document.title).toMatch(/^Doxa /);
  });
});

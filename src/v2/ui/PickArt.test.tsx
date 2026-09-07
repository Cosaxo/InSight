// @vitest-environment jsdom
//
// PickArt (D420): a picture where the index has one, nothing where it
// does not, and the face back when the picture fails.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

vi.mock("../data/catalogArtIndex", () => ({
  CATALOG_ART: { athletes: { jpg: [615] } },
}));

import PickArt from "./PickArt";
import { SITE_ORIGIN } from "../data/siteOrigin";

afterEach(cleanup);

describe("PickArt", () => {
  it("draws the hosted picture, decorative, lazily, in the duel tile's treatment", () => {
    const { container } = render(<PickArt domain="athletes" id={615} />);
    const img = container.querySelector("img[data-pick-art]") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe(`${SITE_ORIGIN}/catalog-art/athletes/615.jpg`);
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.className).toBe("wf-tileimg");
  });

  it("fades in only once the bitmap has decoded", () => {
    const { container } = render(<PickArt domain="athletes" id={615} />);
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.classList.contains("is-in")).toBe(false);
    fireEvent.load(img);
    expect(img.classList.contains("is-in")).toBe(true);
  });

  it("draws nothing for a key or a domain the index lacks — no request, no hole", () => {
    expect(render(<PickArt domain="athletes" id={11571} />).container.innerHTML).toBe("");
    expect(render(<PickArt domain="emoji" id={128293} />).container.innerHTML).toBe("");
  });

  it("unmounts on a failed load, so the generated face underneath is what remains", () => {
    const { container } = render(<PickArt domain="athletes" id={615} />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("img")).toBeNull();
  });
});

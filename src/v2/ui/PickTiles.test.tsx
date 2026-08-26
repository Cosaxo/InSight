// @vitest-environment jsdom
//
// The browse row (D308): the catalogue's popularity head as tiles, with
// generated faces for entries that have no visual of their own and the
// entry's own visual where one exists. The cases hold the seams: a tap
// is the search's pick (the key, never the name), a face is stable for a
// key, and the domains with iconography use it instead of a pattern.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PickTiles from "./PickTiles";

afterEach(cleanup);

const ATHLETES = [
  { id: 615, name: "Lionel Messi" },
  { id: 11459, name: "Serena Williams" },
  { id: 36107, name: "Muhammad Ali" },
];

describe("PickTiles", () => {
  it("offers the head as named tiles and hands up the KEY on tap", () => {
    const onPick = vi.fn();
    render(<PickTiles domain="athletes" entries={ATHLETES} accent="var(--ink)" onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "Serena Williams" }));
    expect(onPick).toHaveBeenCalledWith(11459);
  });

  it("gives a keyless-visual domain a generated face, stable per key", () => {
    const onPick = vi.fn();
    const { container, unmount } = render(
      <PickTiles domain="athletes" entries={ATHLETES} accent="var(--ink)" onPick={onPick} />,
    );
    const faces = [...container.querySelectorAll("[data-tile-face='pattern']")]
      .map((el) => (el as HTMLElement).style.background);
    expect(faces).toHaveLength(3);
    expect(faces.every(Boolean)).toBe(true);
    unmount();
    // The same entries draw the same faces on a second mount — a tile
    // that changed its pattern between sessions would read as a
    // different thing.
    const second = render(
      <PickTiles domain="athletes" entries={ATHLETES} accent="var(--ink)" onPick={onPick} />,
    );
    const again = [...second.container.querySelectorAll("[data-tile-face='pattern']")]
      .map((el) => (el as HTMLElement).style.background);
    expect(again).toEqual(faces);
  });

  it("lets an emoji be its own face, with the word as the caption", () => {
    render(<PickTiles domain="emoji" entries={[{ id: 128293, name: "🔥 fire" }]} accent="var(--ink)" onPick={() => {}} />);
    const tile = screen.getByRole("button", { name: "🔥 fire" });
    expect(tile.textContent).toContain("🔥");
    expect(tile.textContent).toContain("fire");
    expect(tile.querySelector("[data-tile-face='emoji']")).toBeTruthy();
  });

  it("lets a colour wear itself", () => {
    // key = 1 + 24-bit hex (build-colors.mjs): 1 is black, #000000.
    const { container } = render(
      <PickTiles domain="colors" entries={[{ id: 1, name: "black" }]} accent="var(--ink)" onPick={() => {}} />,
    );
    const face = container.querySelector("[data-tile-face='color']") as HTMLElement;
    expect(face.style.background).toMatch(/rgb\(0,\s*0,\s*0\)|#000000/);
  });

  it("renders nothing at all for an empty head", () => {
    const { container } = render(
      <PickTiles domain="athletes" entries={[]} accent="var(--ink)" onPick={() => {}} />,
    );
    expect(container.innerHTML).toBe("");
  });
});

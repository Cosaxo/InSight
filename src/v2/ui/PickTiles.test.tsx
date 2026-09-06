// @vitest-environment jsdom
//
// The browse row (D308, paged at D389): the catalogue as tiles, with
// generated faces for entries that have no visual of their own and the
// entry's own visual where one exists. The cases hold the seams: a tap
// is the search's pick (the key, never the name), a face is stable for a
// key, the domains with iconography use it instead of a pattern — and
// the row is PAGED: one page of nodes for a catalogue of a thousand, the
// next page on the "more" tile, which says how many are still to come and
// is gone once none are. The observer that turns the same tile into a
// scroll sentinel never fires here (setup-dom.ts stubs it), so the tap is
// the door these cases go through — which is also the keyboard's.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import PickTiles, { PICK_TILE_PAGE } from "./PickTiles";

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

  // Twenty alphabetical rows, keyed like the countries file (ISO numeric):
  // the domain that opened D389, where the first page is A and the tail is
  // the rest of the alphabet rather than a fame ranking.
  const MANY = [
    "Afghanistan", "Åland Islands", "Albania", "Algeria", "American Samoa",
    "Andorra", "Angola", "Anguilla", "Antarctica", "Antigua and Barbuda",
    "Argentina", "Armenia", "Aruba", "Australia", "Austria",
    "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados",
  ].map((name, i) => ({ id: 4 * (i + 1), name }));
  const tileNames = (container: HTMLElement) =>
    [...container.querySelectorAll("button:not([data-tile-more])")].map((b) => b.getAttribute("aria-label"));

  it("draws ONE page in the catalogue's own order, and names what is still to come", () => {
    const { container } = render(
      <PickTiles domain="countries" entries={MANY} accent="var(--ink)" onPick={() => {}} />,
    );
    expect(tileNames(container)).toEqual(MANY.slice(0, PICK_TILE_PAGE).map((e) => e.name));
    // the sentinel is the door: it says how many the page left behind
    expect(screen.getByRole("button", { name: `${MANY.length - PICK_TILE_PAGE} more` })).toBeTruthy();
  });

  it("the more tile appends the next page, and leaves once the catalogue is out", () => {
    const { container } = render(
      <PickTiles domain="countries" entries={MANY} accent="var(--ink)" onPick={() => {}} page={8} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "12 more" }));
    expect(tileNames(container)).toEqual(MANY.slice(0, 16).map((e) => e.name));
    fireEvent.click(screen.getByRole("button", { name: "4 more" }));
    expect(tileNames(container)).toEqual(MANY.map((e) => e.name));
    expect(container.querySelector("[data-tile-more]"), "the sentinel outlived the catalogue").toBeNull();
  });

  it("a whole catalogue that fits one page offers no more tile at all", () => {
    const { container } = render(
      <PickTiles domain="countries" entries={MANY.slice(0, 5)} accent="var(--ink)" onPick={() => {}} />,
    );
    expect(tileNames(container)).toHaveLength(5);
    expect(container.querySelector("[data-tile-more]")).toBeNull();
  });

  it("a tile on a later page is the same pick as one on the first", () => {
    const onPick = vi.fn();
    render(<PickTiles domain="countries" entries={MANY} accent="var(--ink)" onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "12 more" }));
    fireEvent.click(screen.getByRole("button", { name: "Australia" }));
    expect(onPick).toHaveBeenCalledWith(4 * 14);
  });

  it("shows the key where the key is the order — the dex tag on a Pokémon tile", () => {
    // A keyed catalogue's order is the key's (National Dex, atomic number),
    // and a tile row in dex order without the number reads as arbitrary.
    render(
      <PickTiles domain="pokemon" entries={[{ id: 25, name: "Pikachu", tag: "#25" }]} accent="var(--ink)" onPick={() => {}} />,
    );
    const tile = screen.getByRole("button", { name: "Pikachu" });
    expect(tile.textContent).toContain("Pikachu");
    expect(tile.textContent).toContain("#25");
  });
});

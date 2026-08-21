// The transient back-layer stack (data/backLayers.ts).
//
// Pure module state, so this runs in plain node. What it pins is the
// ORDERING contract app-shell's handler leans on — last in, first out — and
// the two removal paths that have to agree: a layer closed BY back is
// already off the stack when its component unmounts, and a layer whose
// component unmounts on its own must not leave a closer behind that back
// would later call on a sheet nobody can see.

import { beforeEach, describe, expect, it } from "vitest";
import {
  backLayerCount, closeTopBackLayer, pushBackLayer, resetBackLayers,
} from "./backLayers";

beforeEach(() => resetBackLayers());

describe("backLayers", () => {
  it("says there is nothing to close when nothing is up", () => {
    // The contract back.ts reads: false means "nothing left", which is what
    // lets the app exit at the root. A stack that answered true here would
    // make the back button dead rather than the app quit-proof.
    expect(closeTopBackLayer()).toBe(false);
    expect(backLayerCount()).toBe(0);
  });

  it("closes the most recent layer first", () => {
    const closed: string[] = [];
    pushBackLayer(() => closed.push("card"));
    pushBackLayer(() => closed.push("explain"));   // opened FROM the card
    expect(closeTopBackLayer()).toBe(true);
    expect(closed).toEqual(["explain"]);
    expect(closeTopBackLayer()).toBe(true);
    expect(closed).toEqual(["explain", "card"]);
    expect(closeTopBackLayer()).toBe(false);
  });

  it("closes each layer once, however back and unmount interleave", () => {
    // The real sequence: back pops and calls the closer, the closer sets
    // state, React unmounts the sheet, and the sheet's effect cleanup runs
    // the remover for a layer that is already gone. That miss is the
    // ordinary path, not an error — and it must not remove somebody else's.
    let cardClosed = 0;
    const removeCard = pushBackLayer(() => { cardClosed += 1; });
    const removeExplain = pushBackLayer(() => {});
    closeTopBackLayer();       // explain, by back
    removeExplain();           // …then its unmount, finding nothing
    expect(backLayerCount()).toBe(1);
    removeCard();              // the card closed itself instead
    expect(backLayerCount()).toBe(0);
    expect(closeTopBackLayer()).toBe(false);
    expect(cardClosed).toBe(0);
  });

  it("removes the right layer when two closers are the same function", () => {
    // Two sheets of the same kind can hand in identical closures. Removing
    // one must leave the other standing, or back stops working on a sheet
    // that is still on screen.
    let n = 0;
    const same = (): void => { n += 1; };
    const removeFirst = pushBackLayer(same);
    pushBackLayer(same);
    removeFirst();
    expect(backLayerCount()).toBe(1);
    expect(closeTopBackLayer()).toBe(true);
    expect(n).toBe(1);
    expect(backLayerCount()).toBe(0);
  });

  it("a throwing closer still counts as consumed and leaves the stack sane", () => {
    // back.ts guards the handler for this reason; the layer stack needs the
    // same guard one level in. Reporting false here would quit the app
    // because a sheet's onClose threw.
    pushBackLayer(() => { throw new Error("closer blew up"); });
    pushBackLayer(() => { throw new Error("and so did this one"); });
    expect(() => closeTopBackLayer()).not.toThrow();
    expect(closeTopBackLayer()).toBe(true);
    expect(backLayerCount()).toBe(0);
  });
});

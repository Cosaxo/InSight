// The Map cue's contract (v28 §5, D202): take-once — a cue is a
// navigation, not a setting — and the subscription fires at cue time so
// an already-mounted Map can re-aim while a fresh mount reads the same
// cue from its initializer. Whoever takes first wins; nobody reads twice.
import { describe, expect, it, vi } from "vitest";
import { cueMap, onMapCue, takeMapCue } from "./mapCue";

describe("mapCue", () => {
  it("is take-once", () => {
    cueMap({ group: "g-self", sel: "pulse" });
    expect(takeMapCue()).toEqual({ group: "g-self", sel: "pulse" });
    expect(takeMapCue()).toBeNull();
  });

  it("notifies subscribers at cue time, and unsubscribe holds", () => {
    const f = vi.fn();
    const off = onMapCue(f);
    cueMap({ sel: "pulse-x" });
    expect(f).toHaveBeenCalledTimes(1);
    takeMapCue();
    off();
    cueMap({ sel: "pulse-y" });
    expect(f).toHaveBeenCalledTimes(1);
    takeMapCue(); // leave nothing pending for other tests
  });

  it("a later cue replaces an untaken one — the navigation the user meant last", () => {
    cueMap({ sel: "a" });
    cueMap({ sel: "b" });
    expect(takeMapCue()).toEqual({ sel: "b" });
  });
});

// askDoor.test.ts — the platform rule for the one in-app door (D473).
//
// One platform in, everything else out. The iOS half of that sentence is
// what App Review reads the binary for, so it is pinned twice: here on
// the rule, and in test/ask-door-platform.test.jsx on the mounted App.
// The hop out of the app is the button's (ui/AskDoorButton.test.tsx) —
// the two halves are two chunks on purpose, see askDoor.ts's header.
import { afterEach, describe, expect, it } from "vitest";
import { askDoorOffered } from "./askDoor";

type G = { Capacitor?: { getPlatform?: () => string } };
const g = globalThis as G;
const setPlatform = (p: string | null) => {
  if (p === null) delete g.Capacitor;
  else g.Capacitor = { getPlatform: () => p };
};

afterEach(() => { delete g.Capacitor; });

describe("askDoorOffered — one platform in", () => {
  it("is Android's", () => {
    setPlatform("android");
    expect(askDoorOffered()).toBe(true);
  });

  it("is not iOS's — the property the store reads the binary for", () => {
    setPlatform("ios");
    expect(askDoorOffered()).toBe(false);
  });

  it("is off with no platform, on the web, and when the runtime misbehaves", () => {
    setPlatform(null);
    expect(askDoorOffered(), "no Capacitor global").toBe(false);
    setPlatform("web");
    expect(askDoorOffered(), "web").toBe(false);
    g.Capacitor = { getPlatform: () => { throw new Error("no bridge"); } };
    expect(askDoorOffered(), "a throwing bridge").toBe(false);
    g.Capacitor = {};
    expect(askDoorOffered(), "a bridge with no getPlatform").toBe(false);
  });
});

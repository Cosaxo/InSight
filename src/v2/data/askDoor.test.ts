// askDoor.test.ts — the platform rule for the one in-app door (D467).
//
// One platform in, everything else out. The iOS half of that sentence is
// what App Review reads the binary for, so it is pinned twice: here on
// the rule, and in test/ask-door-platform.test.jsx on the mounted App.
import { afterEach, describe, expect, it, vi } from "vitest";
import { ASK_URL, askDoorOffered, openAskDoor } from "./askDoor";
import { SITE_ORIGIN } from "./siteOrigin";

type G = { Capacitor?: { getPlatform?: () => string } };
const g = globalThis as G;
const setPlatform = (p: string | null) => {
  if (p === null) delete g.Capacitor;
  else g.Capacitor = { getPlatform: () => p };
};

afterEach(() => { delete g.Capacitor; vi.restoreAllMocks(); });

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

describe("the door itself", () => {
  it("is the web ask page on the one origin, absolute because it leaves the app", () => {
    expect(ASK_URL).toBe(`${SITE_ORIGIN}/ask`);
    expect(ASK_URL.startsWith("https://")).toBe(true);
  });

  it("opens in the system browser, with no opener and no referrer", () => {
    const open = vi.fn(() => null);
    vi.stubGlobal("window", { open });
    openAskDoor();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(ASK_URL, "_blank", "noopener,noreferrer");
    vi.unstubAllGlobals();
  });
});

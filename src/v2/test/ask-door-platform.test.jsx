// @vitest-environment jsdom
// ask-door-platform.test.jsx — the in-app door is Android's, and the iOS
// build carries none (D473).
//
// D368 took every ask-a-question call to action out of the binary and
// inverted two smoke-live cases to pin the absence. Those cases mount with
// no platform at all — jsdom has no Capacitor — so they now prove the WEB
// build is clean, which is true and is not the build a reviewer opens.
// This file is the other two-thirds: the whole App mounted as Android,
// where the header "+" must be there and must leave the app for the web
// door; and mounted as iOS, where nothing of the kind may exist. Both
// through the same harness every smoke suite uses, so a door that comes
// back on the wrong platform fails here rather than in App Review.
//
// The platform is set the way the runtime sets it — a `window.Capacitor`
// global with `getPlatform` — because that is what data/askDoor.ts reads,
// on purpose (its header says why an import would have been the wrong
// shape). One assignment per case; deleted after, since engagement.ts
// reads the same global and a leaked platform would change what it logs
// in whichever file runs next.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { awaitNode, mountApp, registerSmokeHooks, SMOKE_TIMEOUT_MS } from "./mount-app.jsx";
import { SITE_ORIGIN } from "../data/siteOrigin";

const ASK_URL = `${SITE_ORIGIN}/ask`;

vi.setConfig({ testTimeout: SMOKE_TIMEOUT_MS });
registerSmokeHooks();

const DOOR = { name: /ask a question/i };
const setPlatform = (p) => { window.Capacitor = { getPlatform: () => p }; };

afterEach(() => { delete window.Capacitor; vi.restoreAllMocks(); });

describe("the in-app door asks the platform", () => {
  it("Android: the header carries the door, and it leaves the app for the web ask page", async () => {
    setPlatform("android");
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const expectNoBoundary = mountApp();
    // awaitNode, the harness's own wait for a lazy chunk: the button's body
    // is React.lazy (askDoor.ts's header has why), so it lands a tick after
    // the header paints, with nothing holding its place meanwhile.
    const landed = await awaitNode('header button[aria-label="Ask a question"]');
    // If the chunk never landed, surface the boundary's real error first
    // rather than a bare "not found".
    if (!landed) expectNoBoundary("Android, waiting for the door's chunk");
    expect(landed, "the door's lazy chunk never landed in the header").not.toBeNull();
    const doors = screen.getAllByRole("button", DOOR);
    expect(doors, "Android draws exactly one door, in the header").toHaveLength(1);
    expect(doors[0].closest("header"), "the door is not in the header").not.toBeNull();
    // A peer of Search, not a promotion: same control class, so it takes
    // the same size, ring and press as the icon beside it.
    expect(doors[0].className).toContain("icon-btn");
    fireEvent.click(doors[0]);
    expect(open, "the door did not leave the app").toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][0], "the door opened something other than the web ask page").toBe(ASK_URL);
    expect(open.mock.calls[0][1]).toBe("_blank");
    // Nothing opened INSIDE the app: no overlay, no sheet, no composer.
    expect(screen.queryByRole("dialog"), "the door opened an in-app surface").toBeNull();
    expectNoBoundary("Android with the door");
  });

  it("iOS: no ask-a-question control anywhere in the mounted app", async () => {
    setPlatform("ios");
    const expectNoBoundary = mountApp();
    await act(async () => {});
    expect(
      screen.queryAllByRole("button", DOOR),
      "the iOS build carries a purchase call to action — this is what App Review rejects (D368)",
    ).toHaveLength(0);
    // Search is still there, so the absence is the door's and not the header's.
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
    expectNoBoundary("iOS without the door");
  });

  it("no platform at all: none either — a platform nobody thought about is safe by default", async () => {
    delete window.Capacitor;
    const expectNoBoundary = mountApp();
    await act(async () => {});
    expect(screen.queryAllByRole("button", DOOR)).toHaveLength(0);
    expectNoBoundary("web without the door");
  });
});

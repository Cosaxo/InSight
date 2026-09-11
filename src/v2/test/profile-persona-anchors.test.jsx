// @vitest-environment jsdom
//
// THE SAMPLE PERSONA MAY NOT REACH A REAL ACCOUNT'S ANCHORS.
//
// `LIVE.enabled` is false for two different reasons — a demo build, and a
// live build whose boot has not attached (`demoInProd`, live.ts) — and
// `loadGen` read it as the first. So a shipped device that cold-started
// offline seeded the profile panel with Mira Halvorsen's vitals, persisted
// them to `insight.profileGeneral.v2`, and then, the moment the boot
// attached and the tree re-rendered, wrote her age band, education,
// profession and city to `v2_users/{uid}` through `saveAnchors`.
//
// That is not a display bug. D8 snapshots the anchors onto every answer at
// write time and D5 makes answers create-only, so the fabricated cohort is
// stamped onto everything the account answers afterwards and cannot be
// corrected by fixing the profile later. `map-anchors.js` names this file
// as the origin of exactly that class.
//
// The fix is the gate `scenes.js` and `follows.js` already use, each with
// its own note saying why: branch on the BUILD FLAG, which cannot flip
// mid-session, not on the boot, which can.
//
// WHY THIS MOUNTS THE PANEL RATHER THAN CALLING `loadGen`. The seed is not
// exported and the persist effect is what makes it durable; a unit test of
// a pure helper could not see either. The case that matters is the whole
// round trip — mount unattached, persist, attach, write.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

const PERSONA = /Halvorsen|Editor · independent press|MA Literature/;

describe("the profile's Basics on a LIVE build that has not attached", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.stubEnv("VITE_V2_LIVE", "true");
  });
  afterEach(() => { cleanup(); vi.unstubAllEnvs(); localStorage.clear(); });

  it("does not seed the sample persona, and writes no anchors from it", async () => {
    const LIVE = (await import("../data/live")).default;
    // `demoInProd`: a live build, boot not attached. This is the state a
    // shipped device is in on every cold start until the network answers.
    expect(LIVE.enabled, "the fixture is not the state being tested").toBe(false);
    const saved = [];
    const spy = vi.spyOn(LIVE, "saveAnchors").mockImplementation((a) => { saved.push(a); });

    const mod = await import("../spec/profile-general.jsx");
    const Panel = globalThis.GeneralPanel || mod.GeneralPanel;
    expect(typeof Panel, "the panel is not reachable — the harness, not the subject").toBe("function");

    await act(async () => { render(<Panel onGo={() => {}} />); });

    const persisted = localStorage.getItem("insight.profileGeneral.v2") || "";
    expect(persisted, "the sample persona was persisted to a live build's device").not.toMatch(PERSONA);
    const written = JSON.stringify(saved);
    expect(written, "the sample persona was written to the account's anchors").not.toMatch(PERSONA);
    spy.mockRestore();
  });
});

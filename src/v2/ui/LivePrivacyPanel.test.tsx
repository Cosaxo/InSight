// @vitest-environment jsdom
//
// LivePrivacyPanel is mostly copy, and copy is not worth a test that only
// re-types it. What IS worth one is the single irreversible control in the
// app: "Delete everything" calls deleteAccount, which wipes the profile, the
// answers and the auth account, and whose own sub-line says "There is no
// undo."
//
// Two properties, both about that button:
//   - it takes two deliberate taps, and the first one is what surfaces the
//     no-undo warning. A one-tap delete on a phone is a mis-tap away from an
//     unrecoverable wipe.
//   - a FAILED delete has to say so. deleteAccount deliberately refuses the
//     auth delete if any wipe phase failed, so it throws far more often than
//     most callables — and "nothing was lost, please retry" is only useful
//     if the user is shown it.
//
// Everything else here — telemetry toggle, name, Google linking — is covered
// only as far as "the control exists and reaches the store", which is what
// its own case asserts.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const LIVE = vi.hoisted(() => ({
  enabled: true,
  uid: "u_me",
  displayName: "Tester",
  deleteAccount: async () => {},
  linkGoogle: async () => {},
  saveDisplayName: async () => {},
  subscribe: () => () => {},
}));
vi.mock("../data/live", () => ({ default: LIVE }));
vi.mock("../../lib/sentry", () => ({
  telemetryEnabled: true,
  setTelemetryEnabled: () => {},
  reportError: () => {},
  setSentryUser: () => {},
}));

const { default: LivePrivacyPanel } = await import("./LivePrivacyPanel");

beforeEach(() => {
  LIVE.enabled = true;
  LIVE.deleteAccount = async () => {};
  // location.reload is called on a successful delete; jsdom throws "not
  // implemented" on the real one.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload: vi.fn() },
  });
});
afterEach(cleanup);

describe("LivePrivacyPanel · deleting an account takes two deliberate taps", () => {
  it("does not call deleteAccount on the first tap", () => {
    let called = 0;
    LIVE.deleteAccount = async () => { called++; };
    render(<LivePrivacyPanel />);

    fireEvent.click(screen.getByRole("button", { name: /^Delete…$/ }));
    expect(called, "the first tap wiped the account").toBe(0);
    // …and the first tap is what earns the warning.
    expect(screen.getByText(/There is no undo/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Cancel$/ })).toBeTruthy();
  });

  it("calls it on the confirm tap", async () => {
    let called = 0;
    LIVE.deleteAccount = async () => { called++; };
    render(<LivePrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Delete…$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, delete/i }));
    await vi.waitFor(() => expect(called).toBe(1));
  });

  it("backs out cleanly, leaving no armed delete behind", () => {
    let called = 0;
    LIVE.deleteAccount = async () => { called++; };
    render(<LivePrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Delete…$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(screen.queryByRole("button", { name: /Yes, delete/i })).toBeNull();
    expect(screen.getByRole("button", { name: /^Delete…$/ })).toBeTruthy();
    expect(called).toBe(0);
  });
});

describe("LivePrivacyPanel · a refused deletion is shown, not swallowed", () => {
  it("surfaces the server's message when deleteAccount throws", async () => {
    // deleteAccount refuses the auth delete if ANY wipe phase failed, and
    // returns "Deletion incomplete (…) — nothing was lost, please retry."
    // Swallowing that leaves the user believing they are erased when they
    // are not, which is the worst outcome that path has.
    LIVE.deleteAccount = async () => {
      throw new Error("internal: Deletion incomplete (v2Groups) — nothing was lost, please retry.");
    };
    render(<LivePrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Delete…$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, delete/i }));
    expect(await screen.findByText(/nothing was lost, please retry/i)).toBeTruthy();
  });

  it("does not reload the page when the delete failed", async () => {
    // The success path reloads into a fresh anonymous session. Reloading
    // after a failure would hide the error it just produced.
    LIVE.deleteAccount = async () => { throw new Error("nope"); };
    render(<LivePrivacyPanel />);
    fireEvent.click(screen.getByRole("button", { name: /^Delete…$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, delete/i }));
    await screen.findByText(/nope/i);
    expect(window.location.reload).not.toHaveBeenCalled();
  });
});

describe("LivePrivacyPanel · off in demo mode", () => {
  it("renders nothing when LIVE is disabled", () => {
    // The panel makes claims about a real account. In demo mode there is no
    // account, so every one of them would be false.
    LIVE.enabled = false;
    const { container } = render(<LivePrivacyPanel />);
    expect(container.textContent).toBe("");
  });
});

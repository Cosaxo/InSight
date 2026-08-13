// @vitest-environment jsdom
//
// The first-launch account wall (D134). It reverses D3 for one build, so
// the cases that matter most are the ones proving it is INERT everywhere
// else: a gate that leaked into the demo build, the dev server or a test
// would put a Google button in front of a session that has no Firebase
// behind it at all.
//
// Both halves are exercised here, and through the SAME entry point the app
// uses (SignInGate, the eager wrapper) rather than the screen directly —
// the split between them is a bundle-budget decision (see SignInGate's
// header), and a test that reached past the wrapper would stop noticing if
// the wiring between the two broke.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const linkGoogle = vi.fn(async () => {});
const googleSignIn = vi.fn(async () => {});

vi.mock("../../lib/firebase", () => ({
  googleSignIn: (...a: unknown[]) => googleSignIn(...(a as [])),
}));

import LIVE from "../data/live";
import SignInGate from "./SignInGate";
import { signInRequired } from "./signInRequired";

const store = LIVE as unknown as Record<string, unknown>;
const saved = new Map<string, PropertyDescriptor | undefined>();

// The store's real members are getters with no setter, so a plain
// assignment throws in strict mode — the live-fixture lesson, in miniature.
function stub(k: string, value: unknown) {
  if (!saved.has(k)) saved.set(k, Object.getOwnPropertyDescriptor(store, k));
  Object.defineProperty(store, k, { value, writable: true, configurable: true });
}

const Child = () => <div>the app</div>;

// The screen is a dynamic import (React.lazy), so every case that expects
// to SEE it has to let the chunk resolve first. Synchronous cases — the
// pass-through arms — do not, and deliberately do not await: "the app
// rendered on the first frame" is the property those are about.
const gate = () => render(<SignInGate><Child /></SignInGate>);
async function gateReady() {
  const r = gate();
  // Every arm of the screen ends in a button ("Continue with Google" or
  // "Try again"), so this is the one wait that works for all of them.
  // findBy* rather than a fixed number of ticks: React.lazy memoises the
  // resolved component, so only the FIRST case in this file pays the
  // suspend and a tick-counting helper would pass for the wrong reason
  // whenever the order changed.
  await screen.findByRole("button");
  return r;
}

beforeEach(() => {
  linkGoogle.mockClear();
  googleSignIn.mockClear();
  stub("subscribe", () => () => {});
  stub("linkGoogle", linkGoogle);
  stub("enabled", true);
  stub("linked", false);
  stub("bootError", "");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  for (const [k, d] of saved) {
    if (d) Object.defineProperty(store, k, d);
    else delete store[k];
  }
  saved.clear();
});

describe("the gate is off unless the build asked for it", () => {
  it("renders the app on the first frame when the flag is unset", () => {
    // Synchronous on purpose: with the flag off the wrapper must not even
    // reach the lazy screen, so there is nothing to await. If this ever
    // needs an await, the deferral has stopped working.
    expect(signInRequired()).toBe(false);
    gate();
    expect(screen.getByText("the app")).toBeTruthy();
  });

  it("stays off when the flag is present but not \"true\"", () => {
    // Vite substitutes the literal string, so a shell that exported an
    // empty value must not read as consent.
    for (const v of ["", "false", "1", "yes"]) {
      vi.stubEnv("VITE_REQUIRE_SIGNIN", v);
      expect(signInRequired(), `"${v}" enabled the wall`).toBe(false);
    }
  });
});

describe("with the flag on", () => {
  beforeEach(() => vi.stubEnv("VITE_REQUIRE_SIGNIN", "true"));

  it("walls off the app until the session is linked", async () => {
    await gateReady();
    expect(screen.queryByText("the app")).toBeNull();
    expect(screen.getByText("Continue with Google")).toBeTruthy();
  });

  it("lets a linked session straight through, with no chunk to wait for", () => {
    stub("linked", true);
    gate();
    expect(screen.getByText("the app")).toBeTruthy();
  });

  it("LINKS rather than signs in — the anonymous session's answers survive", async () => {
    // The whole reason the wall is affordable: initLive() has already
    // signed in anonymously, so the tap is an upgrade of that uid, not a
    // new account. A gate that called googleSignIn() here would silently
    // strand every answer given before it appeared.
    await gateReady();
    fireEvent.click(screen.getByText("Continue with Google"));
    expect(linkGoogle).toHaveBeenCalledTimes(1);
    expect(googleSignIn).not.toHaveBeenCalled();
  });

  it("waits for a connection instead of falling back to the demo app", async () => {
    // A build whose premise is "your answers are kept" must not hand
    // someone sample questions when boot fails — the answers would not be
    // kept, and nothing on screen would say so.
    stub("enabled", false);
    stub("bootError", "still connecting — signing in");
    await gateReady();
    expect(screen.queryByText("the app")).toBeNull();
    expect(screen.queryByText("Continue with Google")).toBeNull();
    expect(screen.getByText(/still connecting — signing in/)).toBeTruthy();
    expect(screen.getByText("Try again")).toBeTruthy();
  });

  it("names the cost when the Google account is already an InSight account", async () => {
    // Firebase refuses the link rather than merging, and the only way on is
    // to abandon this session. That must be a second, labelled tap — the
    // first one must never do it.
    linkGoogle.mockRejectedValueOnce(new Error("auth/credential-already-in-use"));
    await gateReady();
    fireEvent.click(screen.getByText("Continue with Google"));
    // The consequence is on the screen and on the button, in those words.
    expect(await screen.findByText(/they are not merged/i)).toBeTruthy();
    const btn = screen.getByText(/Sign in and leave this phone's answers/);
    expect(googleSignIn).not.toHaveBeenCalled();   // not yet — one more tap
    // …and there is a way back that does not take it.
    expect(screen.getByText("Use a different account")).toBeTruthy();
    fireEvent.click(btn);
    expect(googleSignIn).toHaveBeenCalledTimes(1);
  });

  it("shows any other failure rather than sitting there", async () => {
    // The store's auth observer never fires for a failed link, so an error
    // swallowed here is a permanently dead button.
    linkGoogle.mockRejectedValueOnce(new Error("FirebaseError: popup blocked"));
    await gateReady();
    fireEvent.click(screen.getByText("Continue with Google"));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "popup blocked");
  });
});

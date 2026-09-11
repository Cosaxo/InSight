// @vitest-environment jsdom
//
// THE ROOT HAS NOTHING ABOVE IT, so what this wrapper does with a failed
// chunk fetch is what the whole app does.
//
// `SignInGate` wraps `<App />` in `main.jsx`, and the only `ErrorBoundary`
// in the tree lives inside app-shell — below this component, and not even
// rendered while the wall is up. Under `React.lazy` + `Suspense`, a
// rejected `import("./LiveSignInGate")` therefore rethrows into nothing:
// React unmounts the root and the device sits on an empty `#root` with the
// native splash already hidden. `React.lazy` also caches the rejection, so
// the only way back was a relaunch.
//
// That is the shipping path rather than an edge — both release workflows
// default `VITE_REQUIRE_SIGNIN` to `'true'`, so every install renders this
// on first launch — and the failure it needs is ordinary: a blip, an asset
// swapped by a deploy, the flaky native file read `data/lazy.ts` exists
// for. `data/mirrorChunk.ts`'s header already records the same defect one
// tab down, where it cost only that tab.
//
// WHY ITS OWN FILE. `SignInGate.test.tsx` mocks `./LiveSignInGate` with a
// factory that SUCCEEDS and counts module evaluations, and its header says
// the count is deliberately never reset. A rejecting factory in the same
// registry would poison those counts. This file mocks the same specifier
// the other way and asserts nothing about fetch counts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

const LIVE = vi.hoisted(() => {
  const subs = new Set<() => void>();
  return {
    linked: false,
    needsEmailVerify: false,
    subscribe(fn: () => void) { subs.add(fn); return () => { subs.delete(fn); }; },
    announce() { for (const fn of [...subs]) fn(); },
  };
});
vi.mock("../data/live", () => ({ default: LIVE }));

// The chunk, refusing. `attempts` is what makes the retry observable:
// under the old lazy the loader is called ONCE for the life of the module
// registry, whatever happens afterwards.
const chunk = vi.hoisted(() => ({ attempts: 0 }));
vi.mock("./LiveSignInGate", () => {
  chunk.attempts += 1;
  throw new Error("chunk fetch failed");
});

import SignInGate from "./SignInGate";

const TheApp = () => <div data-testid="app">the app</div>;
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

afterEach(() => { cleanup(); vi.unstubAllEnvs(); LIVE.linked = false; });

describe("a chunk fetch that fails behind the account wall", () => {
  it("does not take the root down with it, and the wall still comes down on sign-in", async () => {
    vi.stubEnv("VITE_REQUIRE_SIGNIN", "true");
    const { container } = render(<SignInGate><TheApp /></SignInGate>);
    await settle();

    // The failure happened — this case is about what follows it, and an
    // assertion that passed because nothing was ever attempted would be
    // the vacuous shape.
    expect(chunk.attempts, "the screen was never even asked for").toBeGreaterThan(0);
    // The wall is up and the app is correctly NOT behind it.
    expect(screen.queryByTestId("app"), "a failed chunk let the app through the wall").toBeNull();

    // THE ASSERTION THAT SEPARATES THE TWO IMPLEMENTATIONS. Under the old
    // lazy the root is gone by now, so nothing is subscribed and no later
    // event can reach anything. Here the component is still mounted, so
    // the store's announcement still brings the wall down — a user whose
    // sign-in succeeds reaches the app without relaunching.
    LIVE.linked = true;
    await act(async () => { LIVE.announce(); });
    expect(screen.getByTestId("app"), "the tree was dead after the failed fetch").toBeTruthy();
    expect(container.firstElementChild).toBe(screen.getByTestId("app"));
  });

  it("retries rather than treating the first refusal as final", async () => {
    // `React.lazy` memoises its rejection: the loader runs once per module
    // registry and every later render rethrows the cached error. The slot
    // asks again. Bounded, so this counts more than one and not forever.
    vi.stubEnv("VITE_REQUIRE_SIGNIN", "true");
    const before = chunk.attempts;
    render(<SignInGate><TheApp /></SignInGate>);
    await act(async () => { await new Promise((r) => setTimeout(r, 1200)); });
    expect(chunk.attempts - before, "one attempt only — a first failure was final").toBeGreaterThan(1);
  });

  it("a build with the wall off never touches the chunk at all", async () => {
    // The control, and it is the property the two-file split exists for:
    // whatever this file does about failure must not drag the screen into
    // a graph that was never going to show it.
    const before = chunk.attempts;
    render(<SignInGate><TheApp /></SignInGate>);
    await settle();
    expect(screen.getByTestId("app")).toBeTruthy();
    expect(chunk.attempts - before, "the screen was fetched by a build that will not show it").toBe(0);
  });
});

// @vitest-environment jsdom
//
// SignInGate — the wrapper that decides whether the first-launch account
// wall (D134) exists at all, and the one component in this directory that
// wraps the WHOLE app (`main.jsx`). Its two failure modes are the two
// worst this tree has: the wall never appears on the build that needs it,
// or nobody reaches the app on the builds that do not.
//
// THE SCREEN IS NOT RETESTED HERE. `LiveSignInGate.test.tsx` already
// drives the real gate — link vs sign-in, the already-in-use fork, the
// boot-failure arm — and drives it through this same wrapper. What that
// suite structurally cannot see is the SPLIT, because it renders the real
// screen: once the chunk is in the module cache there is no way to ask
// when it arrived. So this file mocks `./LiveSignInGate` and makes its
// module evaluation the event under test.
//
// D219 (2026-08-20) is why that half is now the load-bearing one.
// `ios-release.yml`'s default flipped `'true'` → `'false'`, so the
// pass-through arm is what every installed copy runs and the screen is a
// chunk nobody fetches; the wall survives only as a deliberate override
// for a walled test build. "Costs nothing when it is off" stopped being a
// courtesy to the test track and became the shipping path.
//
// Four properties, each a way this file can be wrong while tsc, eslint and
// check:globals all stay green:
//
//   1. A build that will not show the wall never asks for it. The lazy
//      boundary is the entire reason the gate is two files (the screen put
//      3 KB into an eager graph with no room for it — check:bundle), and
//      nothing static can see it: `import LiveSignInGate from
//      "./LiveSignInGate"` here type-checks, renders identically, passes
//      every other gate, and shows up only in a bundle ceiling that runs
//      after a full build. Held twice — the flag off, and the flag on with
//      a session already linked, which is the returning tester and the
//      reason the `import()` sits inside the lazy thunk rather than at
//      module scope.
//   2. Off, it is INVISIBLE — no element of its own between `#root` and
//      the app. `#root { display: contents }` is in styles.css so `.app`
//      is body's flex child; a wrapper here would take that place and
//      `.app { height: 100% }` would start resolving against it.
//   3. Behind the wall the app is not on screen AND not mounted — not for
//      one frame, not hidden. A `fallback` that leaked `children` is a
//      wall with a hole in it, and the app's mount effects would run
//      behind a screen that exists to precede them.
//   4. The wall comes DOWN. `linked` flips on the store's auth observer,
//      not on a remount, so the subscription is the whole mechanism: drop
//      it and a user who signs in successfully sits in front of the wall
//      forever. The same case covers the panel header's hook-order
//      argument, though not the way that argument reads: hoisting the
//      early return above the hooks does not throw here — it makes the
//      WALLED render subscribe to nothing, so the wall simply never comes
//      down. Measured while mutation-checking, not predicted.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";

// The store, mocked rather than booted (`../data/live` imports Firebase).
// Two members are all this wrapper reads — but `subscribe` is a real
// fan-out rather than the usual `() => () => {}` stub, because property 4
// is about a notification arriving from OUTSIDE React and a stub with no
// list gives nothing to notify.
const LIVE = vi.hoisted(() => {
  const subs = new Set<() => void>();
  return {
    linked: false,
    subscribe(fn: () => void) {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },
    /** What live.ts's auth observer does when the link succeeds (D134). */
    announce() { for (const fn of [...subs]) fn(); },
  };
});
vi.mock("../data/live", () => ({ default: LIVE }));

// The screen, replaced by a marker whose MODULE EVALUATION is the thing
// being measured. Counted, never reset: a `beforeEach` clearing this would
// erase the evidence for the one mutation that matters most, since a
// static import fires the factory while this file's own imports are still
// resolving — before any test can look.
const chunk = vi.hoisted(() => ({ fetched: 0 }));
vi.mock("./LiveSignInGate", () => {
  chunk.fetched += 1;
  return { default: () => <div>the sign-in screen</div> };
});

import SignInGate from "./SignInGate";

// Mount-counted, so "the app is not on screen" can be told apart from "the
// app is not mounted" — and so the transition in property 4 can prove the
// app arrives once rather than being mounted behind the wall and remounted
// over it.
let mounts = 0;
function TheApp() {
  useEffect(() => { mounts += 1; }, []);
  return <div className="app" data-testid="app">the app</div>;
}

const gate = () => render(<SignInGate><TheApp /></SignInGate>);

// Settles the lazy import. A macrotask rather than a microtask flush: a
// "never fetched" assertion made before the import could possibly have
// resolved would pass for a build that fetches eagerly, which is the
// vacuous shape this whole file is about.
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  LIVE.linked = false;
  mounts = 0;
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

// FIRST IN THE FILE ON PURPOSE. `React.lazy` memoises, so the chunk is
// fetched at most once per module registry: a case above these two that
// legitimately shows the wall would leave `chunk.fetched` at 1 here. That
// fails loudly rather than passing quietly, which is the safe direction —
// but it is why nothing that renders the wall belongs above this block.
describe("the screen is fetched only by a build that will show it", () => {
  it("is never asked for when the build did not ask for the wall", async () => {
    // The flag is unset in every test build — and since D219 in the store
    // build too, so this is the shipping path rather than a dev nicety.
    const { container } = gate();
    await settle();

    expect(screen.getByText("the app")).toBeTruthy();
    expect(chunk.fetched).toBe(0);
    // Property 2: the app itself is the first thing under the root, with
    // no element of the gate's between them.
    expect(container.firstElementChild).toBe(screen.getByTestId("app"));
  });

  it("is never asked for by a walled build whose session is already linked", async () => {
    // The returning tester, and the reason the `import()` lives inside the
    // lazy thunk instead of at module scope: with the flag ON, a build
    // that never renders the wall must still not pay for it.
    vi.stubEnv("VITE_REQUIRE_SIGNIN", "true");
    LIVE.linked = true;

    gate();
    await settle();

    expect(screen.getByText("the app")).toBeTruthy();
    expect(chunk.fetched).toBe(0);
  });
});

describe("with the wall on", () => {
  beforeEach(() => vi.stubEnv("VITE_REQUIRE_SIGNIN", "true"));

  it("draws nothing in the frame before the screen lands — never the app", () => {
    // Deliberately not awaited: this IS the frame between the decision and
    // the chunk. `fallback={null}` means an empty screen over the body's
    // own background; anything the fallback leaked would be visible here,
    // and `children` leaking would be the app flashing past its own wall.
    const { container } = gate();

    expect(container.textContent).toBe("");
    expect(mounts).toBe(0);
  });

  it("comes down when the store announces the link, and mounts the app once", async () => {
    gate();
    expect(await screen.findByText("the sign-in screen")).toBeTruthy();
    expect(screen.queryByText("the app")).toBeNull();
    expect(mounts).toBe(0);

    // Exactly what live.ts does when the anonymous session is upgraded:
    // the flag flips and subscribers are told. Nothing remounts this
    // wrapper — `main.jsx` keeps the same element at the root precisely so
    // React never does — so without the subscription the wall stays up
    // over a signed-in user, with the sign-in button still on it.
    LIVE.linked = true;
    await act(async () => { LIVE.announce(); });

    expect(screen.getByText("the app")).toBeTruthy();
    expect(screen.queryByText("the sign-in screen")).toBeNull();
    // Once: the app was not mounted behind the wall, and the wall coming
    // down did not throw away the mount it finally got.
    expect(mounts).toBe(1);
  });
});

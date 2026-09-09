// @vitest-environment jsdom
//
// WHY THE MIRROR'S LANDING STOP IS NOT A `React.lazy`.
//
// The Map used to be one, and React.lazy caches a REJECTION: the payload
// keeps the error and every later render re-throws it, with no second call
// to the loader. The tab boundary in app-shell is keyed per tab, so leaving
// the Mirror and coming back builds a FRESH boundary around the same
// poisoned lazy — and one failed chunk fetch turned the stop a new account
// lands on into "This view hit a snag" for the rest of the session. That is
// the permanence data/lazy.ts exists to close, on the most visible screen in
// the app.
//
// The two cases below are the mechanism, not the Map: they run the same
// shapes with an injected loader, because mocking the real chunk cannot
// isolate it (map-tab.jsx carries six siblings whose globals other
// components read, so a mocked module fails the stop for a different
// reason). The third case is what holds the Map to the working shape.
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { cleanup, render, screen, act } from "@testing-library/react";

// Each case mounts twice on purpose, so the leftovers of one would be read
// by the next: the second case's first assertion is "nothing said snag",
// which the first case's own snag satisfies happily.
afterEach(cleanup);

class Boundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() { return this.state.err ? "snag" : this.props.children; }
}

/** A loader that fails once and would succeed ever after. */
function flakyLoader() {
  let calls = 0;
  const load = () => {
    calls += 1;
    return calls === 1
      ? Promise.reject(new Error("chunk gone"))
      : Promise.resolve({ Body: () => "MAP" });
  };
  return { load, calls: () => calls };
}

describe("a chunk that fails once", () => {
  it("poisons a React.lazy for the rest of the session", async () => {
    const { load, calls } = flakyLoader();
    const Lazy = React.lazy(() => load().then((m) => ({ default: m.Body })));
    const Mount = () => (
      <Boundary><React.Suspense fallback={null}><Lazy /></React.Suspense></Boundary>
    );
    // First visit: the loader rejects and the boundary catches.
    await act(async () => { render(<Mount />); });
    expect(screen.queryByText("snag")).toBeTruthy();
    cleanup();
    // Second visit, fresh boundary, fresh mount — and the loader is never
    // called again. This is the case that makes the failure permanent.
    await act(async () => { render(<Mount />); });
    expect(screen.queryByText("MAP")).toBeNull();
    expect(screen.queryByText("snag")).toBeTruthy();
    expect(calls(), "React.lazy re-invoked its loader").toBe(1);
  });

  it("costs the slot's shape one empty frame, and it recovers on re-entry", async () => {
    // MapSlot's shape: state plus an import, the pattern mirror-field-pops
    // uses for relmap. Same flaky loader, same two visits.
    const { load, calls } = flakyLoader();
    function Slot() {
      const [Body, setBody] = React.useState(null);
      React.useEffect(() => {
        if (Body) return undefined;
        let live = true;
        load().then((m) => { if (live) setBody(() => m.Body); }).catch(() => {});
        return () => { live = false; };
      }, [Body]);
      return Body ? <Body /> : null;
    }
    const Mount = () => <Boundary><Slot /></Boundary>;
    await act(async () => { render(<Mount />); });
    // Nothing drawn, nothing broken — the stop keeps its screen.
    expect(screen.queryByText("snag")).toBeNull();
    expect(screen.queryByText("MAP")).toBeNull();
    cleanup();
    await act(async () => { render(<Mount />); });
    expect(screen.queryByText("MAP")).toBeTruthy();
    expect(calls(), "the slot did not re-attempt").toBe(2);
  });
});

describe("and the Map is built that way", () => {
  // A source pin, because the two cases above are about React and this one
  // is about which shape the stop uses. The claim they support is only
  // worth anything while the Map is the second shape.
  const src = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../spec/mirror-tab.jsx"),
    "utf8",
  );

  it("holds the map module in state rather than in a lazy", () => {
    expect(src, "the Map is a React.lazy again").not.toMatch(/React\.lazy\([^)]*map-tab/);
    expect(src).toMatch(/function MapSlot\(\)/);
    expect(src).toMatch(/import\('\.\/map-tab\.jsx'\)/);
    expect(src, "the You stop no longer renders the slot").toMatch(/<MapSlot \/>/);
  });
});

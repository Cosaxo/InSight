// @vitest-environment jsdom
//
// The Mirror tab arrives after first paint (D354), through a SLOT rather
// than a React.lazy — map-slot.test.jsx has the reason, and how the two
// shapes behave under a failed chunk. What THIS file pins is the half the
// Map does not have: the handoff. A slot's state starts empty, so the Map
// pays one blank frame on every open; the Mirror is the app's second tab,
// and a tab that flashes empty on each tap is exactly the guard
// check:bundle's header said it needed before it could leave the eager
// graph. data/mirrorChunk is that guard — the prewarm remembers the
// module, the slot's state initializer peeks at it — and these cases hold
// both halves, plus the source shape app-shell actually uses.
//
// The slot's shape is copied inline with an INJECTED loader, the way
// map-slot.test.jsx copies MapSlot's: importing the real chunk here would
// evaluate thirteen spec modules whose globals other components read, and
// a mocked one fails the tab for a reason that is not the slot's.
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { _forgetMirrorForTest, peekMirror, rememberMirror } from "../data/mirrorChunk";

afterEach(() => {
  cleanup();
  _forgetMirrorForTest();
});

class Boundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() { return this.state.err ? "snag" : this.props.children; }
}

// app-shell's MirrorSlot, verbatim but for the loader.
function makeSlot(load) {
  return function Slot(props) {
    const [Tab, setTab] = React.useState(() => {
      const m = peekMirror();
      return m ? m.MirrorTab : null;
    });
    React.useEffect(() => {
      if (Tab) return undefined;
      let live = true;
      load()
        .then((m) => { rememberMirror(m); if (live) setTab(() => m.MirrorTab); })
        .catch(() => { /* the app logs; here the assertion is the record */ });
      return () => { live = false; };
    }, [Tab]);
    return Tab ? <Tab {...props} /> : null;
  };
}

const MirrorTab = ({ pop }) => <div>MIRROR {pop}</div>;

describe("the handoff (data/mirrorChunk)", () => {
  it("renders in the same tick as the mount once the prewarm has remembered the module", () => {
    rememberMirror({ MirrorTab });
    // A loader that FAILS THE TEST if the slot reaches for it: with the
    // module remembered, the effect must return before importing anything.
    let calls = 0;
    const Slot = makeSlot(() => { calls += 1; throw new Error("the slot imported a remembered module"); });
    render(<Slot pop="you" />);
    // No act() flush between render and assertion — that is the claim.
    expect(screen.getByText("MIRROR you")).toBeTruthy();
    expect(calls).toBe(0);
  });

  it("imports when nothing is remembered, remembers what it got, and the next mount is same-tick", async () => {
    let calls = 0;
    const Slot = makeSlot(() => { calls += 1; return Promise.resolve({ MirrorTab }); });
    render(<Slot pop="circle" />);
    // The cold tap: one empty frame, then the tab.
    expect(screen.queryByText(/MIRROR/)).toBeNull();
    await act(async () => {});
    expect(screen.getByText("MIRROR circle")).toBeTruthy();
    expect(calls).toBe(1);
    expect(peekMirror(), "the slot did not hand its module on").toBeTruthy();
    cleanup();
    // Second mount, fresh state — and the handoff means no second import
    // and no empty frame.
    render(<Slot pop="world" />);
    expect(screen.getByText("MIRROR world")).toBeTruthy();
    expect(calls, "the slot imported again despite the handoff").toBe(1);
  });

  it("a failed chunk costs the tab its body, not the app its screen, and re-entering re-attempts", async () => {
    let calls = 0;
    const Slot = makeSlot(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error("chunk gone")) : Promise.resolve({ MirrorTab });
    });
    const Mount = () => <Boundary><Slot pop="you" /></Boundary>;
    await act(async () => { render(<Mount />); });
    expect(screen.queryByText("snag")).toBeNull();
    expect(screen.queryByText(/MIRROR/)).toBeNull();
    expect(peekMirror(), "a rejection must not be remembered as a module").toBeNull();
    cleanup();
    await act(async () => { render(<Mount />); });
    expect(screen.getByText("MIRROR you")).toBeTruthy();
    expect(calls, "the slot did not re-attempt").toBe(2);
  });
});

describe("and the shell is built that way", () => {
  // Source pins, because the cases above are about React and this one is
  // about which shape the shell uses. The claim they support is only
  // worth anything while app-shell is the slot with the handoff.
  const here = dirname(fileURLToPath(import.meta.url));
  const shell = readFileSync(resolve(here, "../spec/app-shell.jsx"), "utf8");
  const index = readFileSync(resolve(here, "../spec-index.js"), "utf8");
  const mirror = readFileSync(resolve(here, "../spec/mirror-tab.jsx"), "utf8");

  it("mounts the Mirror through a slot that peeks at the handoff", () => {
    expect(shell, "the Mirror is a React.lazy").not.toMatch(/React\.lazy\([^)]*mirror-tab/);
    expect(shell, "the Mirror is rendered by name again").not.toMatch(/<MirrorTab[\s/>]/);
    expect(shell).toMatch(/function MirrorSlot\(/);
    expect(shell).toMatch(/useState\(\(\) => \{\s*const m = peekMirror\(\);/);
    expect(shell).toMatch(/import\('\.\/mirror-tab\.jsx'\)/);
    expect(shell, "the tab body no longer renders the slot").toMatch(/<MirrorSlot /);
  });

  it("prewarms through a loader that remembers, and the tab exports itself", () => {
    expect(index).toMatch(/export const loadMirrorTab = retryable\(/);
    expect(index).toMatch(/rememberMirror\(m\)/);
    // loadOverlays waits on it: three overlays read Mirror globals at render.
    expect(index).toMatch(/loadOverlays = retryable\(async \(\) => \{[^}]*await loadMirrorTab\(\);/);
    expect(mirror).toMatch(/^export function MirrorTab\(/m);
    expect(mirror, "MirrorTab is published to window again").not.toMatch(/globalThis\.MirrorTab\s*=|window,\s*\{\s*MirrorTab/);
  });
});

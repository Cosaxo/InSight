// @vitest-environment jsdom
//
// Modal semantics for the spec layer's overlays (primitives.jsx useDialog).
//
// WHY THIS EXISTS. D21 deferred spec-layer accessibility work on the grounds
// that it should land *behind* interaction tests rather than ahead of them,
// and D23 had to record a gap: the map/button conversions could not get one,
// because the surfaces they touch never render in jsdom. These do. The
// smoke suite already drives two of them, so the interaction test D21 asked
// for is available here, and this is it.
//
// WHAT IT PINS, beyond what a linter can see. `check:a11y` reads source and
// can tell you a role attribute is present. It cannot tell you that focus
// actually moved into the dialog, that Escape reaches the handler, or that
// focus came back to the control that opened it — and those three are the
// entire user-visible point of the change. A regression in any of them
// leaves every static gate green.
//
// SCOPE. The two overlays reachable from the header without inventing data,
// which is the same reason the smoke suites stop there. The other six take
// the identical props object from the identical hook; what is specific to
// each of them is its label, not its behaviour.

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { awaitNode } from "./mount-app.jsx";
import { Sheet } from "../spec/primitives.jsx";
import { UpdateRequiredBlocker } from "../spec/app-shell.jsx";
import {
  backLayerCount, closeTopBackLayer, pushBackLayer, resetBackLayers,
} from "../data/backLayers";

let App;
let errorSpy;

beforeAll(async () => {
  await import("../spec-index.js");
  App = globalThis.App;
});

afterEach(() => {
  cleanup();
  errorSpy?.mockRestore();
});

// Open an overlay from the header and hand back the pieces each case needs.
// `opener` is captured BEFORE the click, because the whole focus-restore
// assertion is about returning to it.
//
// ASYNC since D223. Both of these overlays moved into the after-first-paint
// chunk, so the header button awaits `loadOverlays()` before setting the
// state that mounts one — the click no longer paints in the same tick.
// This is the app's real behaviour, not a test artifact: a synchronous
// helper here was asserting an overlay that no longer exists yet.
async function openOverlay(name) {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const { container } = render(<App />);
  const opener = screen.getByRole("button", { name: new RegExp(`^${name}$`, "i") });
  opener.focus();
  fireEvent.click(opener);
  const dialog = await awaitNode('[role="dialog"]');
  return { container, opener, dialog };
}

describe("overlays are modal dialogs", () => {
  it.each([
    ["profile", "Your profile"],
    ["search", "Search"],
  ])("%s carries dialog semantics", async (name, label) => {
    const { dialog } = await openOverlay(name);
    expect(dialog, `${name}: no [role=dialog] rendered`).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe(label);
    // tabIndex -1 is what lets the container take focus when it holds no
    // controls, without becoming a Tab stop of its own.
    expect(dialog.getAttribute("tabindex")).toBe("-1");
  });

  it.each([["profile"], ["search"]])("%s moves focus inside on open", async (name) => {
    const { dialog } = await openOverlay(name);
    // Not asserting WHICH element — that is the first focusable in document
    // order and may legitimately change. Asserting it is inside the dialog,
    // which is the property that matters.
    expect(dialog.contains(document.activeElement), `${name}: focus stayed outside the dialog`).toBe(true);
  });

  it("Escape closes the overlay", async () => {
    const { container, dialog } = await openOverlay("profile");
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(container.querySelector('[role="dialog"]'), "Escape did not close the overlay").toBeNull();
  });

  it("returns focus to the control that opened it", async () => {
    // The opener is focused explicitly here because jsdom's fireEvent.click
    // does NOT move focus, while a real browser's click on a button does.
    // Without this the hook reads document.activeElement === <body>, and the
    // case would be asserting jsdom's gap rather than the restore path.
    // Verified separately in Chromium: clicking the header button focuses it,
    // and closing the overlay hands focus back to it.
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App />);
    const opener = screen.getByRole("button", { name: /^profile$/i });
    opener.focus();
    fireEvent.click(opener);
    const dialog = await awaitNode('[role="dialog"]');

    // Focus is inside the dialog at this point; closing must hand it back
    // rather than dropping the caret at the top of the document.
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(document.activeElement, "focus was not restored to the opener").toBe(opener);
  });

  it("traps Tab inside the update blocker, which had no trap at all (D244)", () => {
    // The blocker is a modal the SERVER puts up: role, aria-modal and a
    // label were hand-written on it and it took focus with `autoFocus`, so
    // it announced itself correctly — and Tab walked straight out into the
    // app behind, which is still in the DOM under an absolutely positioned
    // overlay. Focus containment is runtime, so jsx-a11y could not see it.
    //
    // ASSERTED ON `defaultPrevented`, NOT ON `document.activeElement`, and
    // the difference is the whole test. jsdom does not implement Tab
    // navigation, so firing a keydown moves focus nowhere on its own — and
    // this dialog has ONE focusable, so a wrap lands back where it started.
    // An activeElement assertion therefore passes identically with and
    // without the trap: the first draft of this case did exactly that and
    // survived reverting the fix. `preventDefault` is the thing that stops
    // the browser taking focus out, so it is the thing to assert.
    const { container } = render(<UpdateRequiredBlocker />);
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog, "the blocker did not render as a dialog").toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    // useDialog focuses the first focusable inside on mount — the job
    // `autoFocus` used to do, now done by the hook that also restores focus
    // to the opener on unmount. (Not the discriminator above: autoFocus
    // focuses it too. It is here because it is a property worth holding.)
    const inside = dialog.querySelector("button");
    expect(document.activeElement, "the blocker did not take focus").toBe(inside);

    for (const shiftKey of [false, true]) {
      const ev = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true, shiftKey });
      dialog.dispatchEvent(ev);
      expect(ev.defaultPrevented, `${shiftKey ? "Shift+Tab" : "Tab"} was left to the browser, which takes focus out of the blocker`).toBe(true);
    }
  });

  it("does not let Escape dismiss the blocker", () => {
    // `useDialog` wires Escape to `onClose`, and the blocker passes a
    // no-op ON PURPOSE: there is nothing to close to, and a build the
    // server has refused must not be dismissable. This guards the future
    // mistake — someone passing a real `onClose` here — rather than the
    // fix this record made, which Escape cannot distinguish.
    const { container } = render(<UpdateRequiredBlocker />);
    const dialog = container.querySelector('[role="dialog"]');
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(container.querySelector('[role="dialog"]'), "Escape dismissed the blocker").toBeTruthy();
  });

  it("traps Tab inside the dialog", async () => {
    const { dialog } = await openOverlay("profile");
    const items = [...dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )];
    // A dialog with fewer than two stops cannot demonstrate a wrap; say so
    // rather than passing vacuously.
    expect(items.length, "profile overlay has too few focusable controls to test the wrap").toBeGreaterThan(1);
    const first = items[0];
    const last = items[items.length - 1];

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement, "Tab at the last control did not wrap to the first").toBe(first);

    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement, "Shift+Tab at the first control did not wrap to the last").toBe(last);
  });
});

// ── Android back, the other way out of a modal ──────────────────────
//
// Escape (above) is the keyboard path and has been pinned since D24. This
// is the platform path, and it needed its own mechanism: the back button is
// not a DOM event a focused dialog can receive, so nothing above could have
// caught what was wrong here.
//
// WHAT WAS WRONG. app-shell's handler peeled person → city → overlay → tab
// and knew nothing about bottom sheets, because every Sheet holds its open
// state inside whichever module rendered it. Back from an open sheet fell
// through every branch, returned false, and back.ts called App.exitApp() —
// the exact failure its own header describes, one layer deeper. From the
// default tab: tap the ⓘ on today's question, press back, app gone.
//
// It could ship because nothing tested the handler at all:
// `grep -rn registerBackHandler src/v2/test` returned nothing.
describe("Android back peels sheets before the shell's own levels", () => {
  // The shell reads window.registerBackHandler, which back.ts publishes on
  // import — and back.ts is imported by main.jsx, not spec-index.js, so it
  // is absent here. Stubbed to capture the handler, which is also the only
  // way to invoke it: back.ts is a no-op off a native platform, so the real
  // one would never fire in jsdom.
  const withHandler = (fn) => {
    const held = window.registerBackHandler;
    let handler = null;
    window.registerBackHandler = (h) => { handler = h; return () => {}; };
    try {
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      render(<App />);
      expect(handler, "the shell registered no back handler").toBeTruthy();
      fn(handler);
    } finally {
      if (held === undefined) delete window.registerBackHandler;
      else window.registerBackHandler = held;
      resetBackLayers();
    }
  };

  it("consumes the press and closes the top layer", () => {
    withHandler((handler) => {
      let closed = 0;
      pushBackLayer(() => { closed += 1; });
      // true is what stops back.ts calling App.exitApp().
      expect(handler(), "back did not consume the press — the app would have quit").toBe(true);
      expect(closed).toBe(1);
    });
  });

  it("still reports nothing-left at the root, so back can still exit", () => {
    withHandler((handler) => {
      // The other half, and the reason this is not just `return true`: with
      // no layer and nothing open on the default tab, back MUST fall
      // through. A handler that always consumed would leave Android users
      // unable to leave the app at all.
      expect(handler(), "back consumed a press with nothing open").toBe(false);
    });
  });

  it("takes the sheet before the tab, not after", () => {
    withHandler((handler) => {
      let closed = 0;
      pushBackLayer(() => { closed += 1; });
      // Two presses: the first must spend itself on the layer, and only the
      // second reach the shell's own levels. If the branch were ordered the
      // other way the sheet would still be on screen with the tab changed
      // underneath it.
      expect(handler()).toBe(true);
      expect(closed).toBe(1);
      expect(handler()).toBe(false);
    });
  });
});

// A Sheet registers itself, which is what connects the two halves above:
// the stack is only useful if the sheets are actually in it.
describe("Sheet joins the back stack for as long as it is up", () => {
  it("registers on mount, closes on back, and leaves nothing behind", () => {
    resetBackLayers();
    let open = true;
    const onClose = vi.fn(() => { open = false; });
    const Host = () => (open ? <Sheet onClose={onClose} label="Test sheet">body</Sheet> : null);
    const { rerender } = render(<Host />);
    expect(backLayerCount(), "a mounted sheet did not join the back stack").toBe(1);

    expect(closeTopBackLayer()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);

    // …and once the sheet actually unmounts, the stack is empty again —
    // otherwise a later press would call a closer for a sheet nobody can
    // see, and the app would swallow a back press for nothing.
    rerender(<Host />);
    expect(backLayerCount(), "an unmounted sheet left its layer behind").toBe(0);
  });

  it("does not churn the stack when its parent re-renders", () => {
    // Sheet's onClose is a fresh arrow at nearly every call site. Keyed on
    // it, the effect would push and pop on every parent render and the LIFO
    // order would stop meaning anything — hence the ref.
    resetBackLayers();
    const Host = ({ n }) => <Sheet onClose={() => {}} label={"Sheet " + n}>body</Sheet>;
    const { rerender } = render(<Host n={1} />);
    for (let n = 2; n <= 5; n++) rerender(<Host n={n} />);
    expect(backLayerCount()).toBe(1);
  });

  it("calls the LATEST onClose, not the one it mounted with", () => {
    // The cost of the ref above: a stale closure here would close the sheet
    // through a handler its parent has already replaced.
    resetBackLayers();
    const first = vi.fn();
    const second = vi.fn();
    const Host = ({ fn }) => <Sheet onClose={fn} label="Sheet">body</Sheet>;
    const { rerender } = render(<Host fn={first} />);
    rerender(<Host fn={second} />);
    closeTopBackLayer();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});

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
function openOverlay(name) {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  const { container } = render(<App />);
  const opener = screen.getByRole("button", { name: new RegExp(`^${name}$`, "i") });
  fireEvent.click(opener);
  const dialog = container.querySelector('[role="dialog"]');
  return { container, opener, dialog };
}

describe("overlays are modal dialogs", () => {
  it.each([
    ["profile", "Your profile"],
    ["search", "Search"],
  ])("%s carries dialog semantics", (name, label) => {
    const { dialog } = openOverlay(name);
    expect(dialog, `${name}: no [role=dialog] rendered`).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe(label);
    // tabIndex -1 is what lets the container take focus when it holds no
    // controls, without becoming a Tab stop of its own.
    expect(dialog.getAttribute("tabindex")).toBe("-1");
  });

  it.each([["profile"], ["search"]])("%s moves focus inside on open", (name) => {
    const { dialog } = openOverlay(name);
    // Not asserting WHICH element — that is the first focusable in document
    // order and may legitimately change. Asserting it is inside the dialog,
    // which is the property that matters.
    expect(dialog.contains(document.activeElement), `${name}: focus stayed outside the dialog`).toBe(true);
  });

  it("Escape closes the overlay", () => {
    const { container, dialog } = openOverlay("profile");
    expect(container.querySelector('[role="dialog"]')).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(container.querySelector('[role="dialog"]'), "Escape did not close the overlay").toBeNull();
  });

  it("returns focus to the control that opened it", () => {
    // The opener is focused explicitly here because jsdom's fireEvent.click
    // does NOT move focus, while a real browser's click on a button does.
    // Without this the hook reads document.activeElement === <body>, and the
    // case would be asserting jsdom's gap rather than the restore path.
    // Verified separately in Chromium: clicking the header button focuses it,
    // and closing the overlay hands focus back to it.
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(<App />);
    const opener = screen.getByRole("button", { name: /^profile$/i });
    opener.focus();
    fireEvent.click(opener);
    const dialog = container.querySelector('[role="dialog"]');

    // Focus is inside the dialog at this point; closing must hand it back
    // rather than dropping the caret at the top of the document.
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(document.activeElement, "focus was not restored to the opener").toBe(opener);
  });

  it("traps Tab inside the dialog", () => {
    const { dialog } = openOverlay("profile");
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

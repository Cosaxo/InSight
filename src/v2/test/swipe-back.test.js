// @vitest-environment jsdom
//
// Behavioral pin for the axis gestures' ownership rule (swipe-back.js).
//
// WHY THIS EXISTS. The three gesture bugs the iPhone found in 2026-08 were
// all one defect: surfaces that own their own horizontal motion — the Map's
// pan canvas, its token rails, the Mirror ruler — were not in the swipe
// gestures' skip list, so the same touches fed both handlers and a sideways
// gesture ended in a tab jump (ruler scrub → the daily; map pan → 1v1).
// Every existing guard is name-level; none of them executes a touch
// sequence, so a dropped class in OWNS_X or a broken `closest` check would
// ship silently again. This file drives bindSwipeBack with synthetic touch
// events and asserts who wins.
//
// The smoke suite holds the other half: that the LIVE DOM (the mounted
// ruler, the mounted map canvas) actually matches OWNS_X.

import { describe, expect, it, vi } from "vitest";
import { bindSwipeBack, OWNS_X } from "../spec/swipe-back.js";

// jsdom has no TouchEvent constructor worth using — a plain Event with a
// `touches` array is exactly what the handlers read (clientX/clientY and
// e.target.closest), and `cancelable` lets preventDefault run quietly.
function touch(el, type, x, y) {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, "touches", { value: [{ clientX: x, clientY: y }] });
  el.dispatchEvent(e);
}

// A clear back-swipe: locks the horizontal axis (|mx| > |my|·1.4 past 9px),
// then travels well past the 62px commit threshold before lifting.
function swipe(el, dx) {
  touch(el, "touchstart", 200, 100);
  touch(el, "touchmove", 200 + dx / 2, 103);
  touch(el, "touchmove", 200 + dx, 106);
  touch(el, "touchend", 200 + dx, 106);
}

function mount(childAttrs = {}) {
  const root = document.createElement("div");
  const child = document.createElement("div");
  if (childAttrs.className) child.className = childAttrs.className;
  if (childAttrs.nopan) child.setAttribute("data-nopan", "");
  root.appendChild(child);
  document.body.appendChild(root);
  const onBack = vi.fn();
  bindSwipeBack(root, onBack);
  return { root, child, onBack };
}

describe("bindSwipeBack — one axis, and who it yields to", () => {
  it("a clear right-swipe on unowned ground goes back", () => {
    const { child, onBack } = mount();
    swipe(child, 110);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("a left-swipe never navigates — only the back direction pulls", () => {
    const { child, onBack } = mount();
    swipe(child, -110);
    expect(onBack).not.toHaveBeenCalled();
  });

  // The surfaces the iPhone bugs came in on, each by the selector that now
  // covers it. Losing any of these from OWNS_X re-opens its bug.
  for (const [label, attrs] of [
    ["the Map's pan canvas (.mmt-canvas)", { className: "mmt-canvas is-dots" }],
    ["the Map's answer-token rail (.mmt-swipe)", { className: "mmt-swipe" }],
    ["the Map's branch chips (.mmt-chips)", { className: "mmt-chips" }],
    ["a horizontal scroller (.h-scroll)", { className: "h-scroll" }],
    ["an owned drag marked data-nopan (the Mirror ruler)", { nopan: true }],
  ]) {
    it(`a right-swipe starting inside ${label} belongs to it, not to the axis`, () => {
      const { child, onBack } = mount(attrs);
      swipe(child, 110);
      expect(onBack).not.toHaveBeenCalled();
    });
  }

  it("OWNS_X parses as one selector — closest() throws on a malformed list", () => {
    // A typo in the list (a stray comma, an unquoted bracket) would make
    // every closest(OWNS_X) call throw inside a passive touch handler,
    // which surfaces as gestures silently dying. Parse it once, loudly.
    expect(() => document.createElement("div").closest(OWNS_X)).not.toThrow();
  });
});

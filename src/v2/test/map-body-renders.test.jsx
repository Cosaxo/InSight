// @vitest-environment jsdom
//
// THE MIRROR'S LANDING STOP DREW A BLANK DIV IN EVERY TEST THIS REPO HAS.
//
// `MapTab` measures its own pane before it draws anything: `fitAllTarget()`
// reads `clientWidth`/`clientHeight` and returns null below 10px, and the
// body returns early — an empty `.mmt-canvas` — until that first fit lands
// (map-tab.jsx, `if (!view)`). jsdom has no layout engine, so those two
// properties are 0 forever, the retry gives up after 60 tries, and the
// early return is the ONLY thing any suite has ever rendered.
//
// The cost, measured off `--coverage.include='src/v2/spec/**'` on the run
// that found this: map-tab.jsx 36.8% of 843 statements, person-mindmap.jsx
// 49.6% of 647, and map-chiprow.jsx — the branch rail, statically imported
// by both — at a flat 0%, functions and statements alike. `smoke-mirror`
// clicks Mirror and checks the boundary did not trip, which is true and
// says nothing: a blank div cannot throw. That is the vacuous pass the
// mount suites exist to prevent, and it was sitting under the largest
// screen in the app.
//
// WHY A SIZE STUB IS HONEST HERE, against setup-dom.ts's rule that a stub
// faking a RESULT the test asserts on is testing the stub. A pane's width
// is not a result the Map computes; it is the layout jsdom declines to do,
// the same category as matchMedia and ResizeObserver. What the cases below
// assert is what the Map DREW once it could measure — its branch rail, its
// nodes — never a number derived from the size. And the second case is the
// control that keeps the first from quietly becoming vacuous again: with
// the stub off, the rail is absent, so the assertion is loaded either way.
//
// It is stubbed HERE and not in setup-dom.ts on purpose. Every other suite
// keeps the unmeasurable pane it was written against; nothing in the other
// five mount files changes meaning because this file exists.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { awaitNode, mountApp, registerSmokeHooks, SMOKE_TIMEOUT_MS } from "./mount-app.jsx";

vi.setConfig({ testTimeout: SMOKE_TIMEOUT_MS });
registerSmokeHooks();

// 480×720 — a phone, and comfortably over the 10px floor. Defined on the
// prototype rather than on one node because the Map reads the property off
// whichever pane its ref happens to hold, and person-mindmap's copy of the
// same construct reads its own.
const PANE = { width: 480, height: 720 };
let restore = null;

function measurable(on) {
  if (on) {
    // The real getters live on Element.prototype, not here — jsdom defines
    // them one link up the chain — so there is no own descriptor to put
    // back and `delete` is the restore: it unshadows the inherited pair.
    restore = () => {
      delete HTMLElement.prototype.clientWidth;
      delete HTMLElement.prototype.clientHeight;
    };
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true, get() { return PANE.width; },
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true, get() { return PANE.height; },
    });
  } else if (restore) {
    restore();
    restore = null;
  }
}

beforeAll(() => measurable(true));
afterAll(() => measurable(false));

// The branch rail is the proof: it is drawn from `MTBranchChips` at the
// bottom of the body, past every line the early return skips, so its
// presence means the fit landed and the real Map is on screen.
const RAIL = '[role="tablist"][aria-label="Map branches"]';

describe("the Map draws its body once its pane can be measured", () => {
  it("renders the branch rail and the constellation, boundary clean", async () => {
    const expectNoBoundary = mountApp();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    const rail = await awaitNode(RAIL);
    expect(rail, "the Map never got past its `if (!view)` early return").toBeTruthy();
    // …and it drew branches, not an empty rail: the chips come from the
    // demo answer set, so a rail with only the All button would mean the
    // body rendered against no data.
    expect(
      rail.querySelectorAll("[data-chip]").length,
      "the branch rail rendered with no branches in it",
    ).toBeGreaterThan(1);
    // The constellation itself — the ~500 statements that only run past the
    // early return. Node dots are what the Map exists to draw.
    expect(
      document.querySelectorAll(".mmt-ddot, .mmt-pdot").length,
      "the Map drew no nodes",
    ).toBeGreaterThan(0);
    expectNoBoundary("mirror · map body");
  });

  it("…and draws none of it when the pane measures zero, which is every other suite", async () => {
    // The control. Without it the case above passes the day someone makes
    // the rail render unconditionally, and this file would then be
    // asserting nothing about the fit at all.
    measurable(false);
    try {
      mountApp();
      fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
      expect(
        await awaitNode(RAIL, 3),
        "the rail rendered on an unmeasurable pane — the early return is gone, and the case above no longer proves the fit",
      ).toBeNull();
      // The blank placeholder is what IS there, and naming it keeps the
      // assertion above from passing because the Mirror failed to open.
      expect(document.querySelector(".mmt-canvas"), "the Map did not mount at all").toBeTruthy();
    } finally {
      measurable(true);
    }
  });
});

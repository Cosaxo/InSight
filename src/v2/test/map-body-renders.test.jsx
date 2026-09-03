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
// THE CLASS WAS ALREADY KNOWN, AND THAT IS THE POINT. person-mindmap.jsx
// carries the same capped-retry fit, and person-mindmap-still.test.jsx
// (2026-08-26) exists because a ReferenceError in its label pass shipped
// behind exactly this early return, with every gate green. That file's
// header states the mechanism in full and its `measure()` stubs the same
// two prototype getters. What nobody went back for was map-tab.jsx —
// the SAME construct, on the Mirror's landing stop, 843 statements to
// person-mindmap's 647. So this is the second sighting of a known bug
// class on a bigger screen, not a new one, and the argument below is
// borrowed from that file rather than made fresh.
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
    // Restore by whichever route applies, the shape person-mindmap-still
    // already uses: jsdom defines these getters one link up the chain, on
    // Element.prototype, so today there is no own descriptor here and
    // `delete` is what unshadows the inherited pair — but a jsdom that
    // moved them down would leave one, and deleting it would strip the
    // getters from every later suite in this worker.
    const saved = ["clientWidth", "clientHeight"].map((k) =>
      [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)]);
    restore = () => {
      for (const [k, d] of saved) {
        if (d) Object.defineProperty(HTMLElement.prototype, k, d);
        else delete HTMLElement.prototype[k];
      }
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

  // A MASTERED FACT IS AN ANSWER, BUT IT IS NOT AN OPINION.
  //
  // The anchor card compares your answer against people who share an
  // anchor. `allAnswers` deliberately keeps learn nodes — you did answer
  // them, and they belong in the count and the time scrub — and the same
  // list was handed straight to the anchor card's rows. So the card filed
  // knowledge cards you got RIGHT under "where you differ", each with a
  // dash where the crowd should be, each dragging the match headline down.
  //
  // Live is worse than demo: a learn id has no question aggregate, so one
  // mastered fact is enough to make the card refuse and print "isn't
  // measured yet" where the same card without it reads a percentage.
  //
  // Three other places in map-tab.jsx already say `daily && !learn`. This
  // was the one that did not.
  it("keeps mastered knowledge cards out of the anchor card's comparison", async () => {
    mountApp();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    await awaitNode(RAIL);
    const chip = await awaitNode('[data-screen-label="anchor-age"]');
    expect(chip, "the age anchor never rendered — this case lost its target").toBeTruthy();
    fireEvent.click(chip);
    const card = await awaitNode(".mmt-astat, .mmt-verdict, .mmt-nocohort");
    expect(card, "the anchor card never opened").toBeTruthy();
    const text = document.body.textContent || "";
    // The demo bank's mastered facts, by their own prompts. Any of them in
    // the anchor card's list is a knowledge card filed as a disagreement.
    expect(text, "a knowledge card you got right is listed as a disagreement")
      .not.toMatch(/The capital of (Brazil|Australia) is/i);
    // …and the card is really drawing rows, or the assertion above is
    // satisfied by an empty card and proves nothing.
    expect(document.querySelectorAll(".mmt-arow, .mmt-astat, .mmt-verdict").length,
      "the anchor card drew nothing at all, so the absence above is vacuous").toBeGreaterThan(0);
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

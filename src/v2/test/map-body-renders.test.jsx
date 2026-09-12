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
import { act, fireEvent, screen } from "@testing-library/react";
import { awaitNode, awaitText, mountApp, registerSmokeHooks, SMOKE_TIMEOUT_MS } from "./mount-app.jsx";

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

  // The demo half of the recency claim; the live half needs a live store
  // and lives in map-recency-live.test.jsx. Kept here because this is the
  // only suite that can measure the pane, and because it is the CONTROL:
  // demo dates are real, so the marks must still be drawn. Without it, a
  // fix that simply stopped marking anything would pass the live case and
  // remove a feature instead of a lie.
  it("still marks recent answers when the dates really are dates", async () => {
    mountApp();
    fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
    await awaitNode(RAIL);
    expect(document.querySelectorAll(".is-fresh").length,
      "the demo build drew no recency at all").toBeGreaterThan(0);
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

// ── the wayfinding (VISION-2026-09-12 §3, D-2026-09-12d) ───────────────
//
// Every piece below reads data the Map already holds, so what these hold
// is that the chrome draws and acts, on the measured pane the cases above
// earned: the trail with its way back, Find lighting matches and listing
// them, the root card's legend, the card's three sizes and its prev/next,
// and the two coach hints shown once each and forgotten by the purge.
async function openMap() {
  const expectNoBoundary = mountApp();
  fireEvent.click(screen.getByRole("button", { name: /^mirror$/i }));
  const rail = await awaitNode(RAIL);
  expect(rail, "the Map never drew its rail").toBeTruthy();
  return expectNoBoundary;
}
const HINT_KEY = "insight.mapHints.v1";

describe("the Map's trail, Find and card (2026-09-12)", () => {
  it("says where you are: You at the top, ‹ You › group inside one, and the first crumb steps back out", async () => {
    const expectNoBoundary = await openMap();
    expect(document.querySelectorAll(".mmt-trail .mmt-crumb")).toHaveLength(1);
    expect(document.querySelector(".mmt-trail")?.textContent).toBe("You");
    // a group hub at the top level is a door
    const hub = document.querySelector(".mmt-hub");
    expect(hub, "no hub to open").toBeTruthy();
    await act(async () => { fireEvent.click(hub); });
    const deep = await awaitNode(".mmt-trail.is-deep");
    expect(deep, "the trail never grew a second crumb").toBeTruthy();
    const crumbs = deep.querySelectorAll(".mmt-crumb");
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0].querySelector(".mmt-back"), "the first crumb lost its ‹").toBeTruthy();
    expect(crumbs[1].className).toMatch(/is-last/);
    expect(crumbs[1].className, "the open group's crumb does not wear its hue").toMatch(/is-hue/);
    await act(async () => { fireEvent.click(crumbs[0]); });
    expect(await awaitNode(".mmt-trail:not(.is-deep)"), "‹ You did not step back out").toBeTruthy();
    expectNoBoundary("map trail");
  });

  it("Find turns the rail into a field, lights the matches and lists them; a row is a door", async () => {
    const expectNoBoundary = await openMap();
    fireEvent.click(screen.getByRole("button", { name: "Find on the map" }));
    const field = await awaitNode(".mmt-find-field input");
    expect(field, "the field never opened").toBeTruthy();
    // idle: the count the root card prints, and no dot lit
    expect(document.body.textContent).toMatch(/answers on the map/);
    expect(document.querySelectorAll(".is-hit")).toHaveLength(0);
    fireEvent.change(field, { target: { value: "e" } });
    const hit = await awaitNode(".mmt-dotnode.is-hit");
    expect(hit, "no match lit on the map").toBeTruthy();
    expect(document.body.textContent).toMatch(/\d+ matches lit on the map/);
    const rows = document.querySelectorAll(".mmt-frow");
    expect(rows.length, "the card listed no matches").toBeGreaterThan(0);
    expect(rows.length, "the list is not capped").toBeLessThanOrEqual(40);
    // the toggles narrow, and say so
    const rare = screen.getByRole("button", { name: "Rare takes" });
    fireEvent.click(rare);
    expect(rare.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(rare);
    // nothing matches a word nobody used
    fireEvent.change(field, { target: { value: "zqxjv" } });
    await awaitText(/Nothing on the map matches that yet/);
    expect(document.querySelectorAll(".is-hit")).toHaveLength(0);
    // a row selects its answer — through the group it sits in
    fireEvent.change(field, { target: { value: "e" } });
    const row = await awaitNode(".mmt-frow");
    await act(async () => { fireEvent.click(row); });
    const sel = await awaitNode(".mmt-dotnode.is-sel");
    expect(sel, "the row did not select its answer").toBeTruthy();
    // ✕ on the field's card closes Find and clears the light
    fireEvent.click(screen.getByRole("button", { name: "Close find" }));
    expect(await awaitNode(".mmt-findbtn"), "the glass did not come back").toBeTruthy();
    expect(document.querySelectorAll(".is-hit")).toHaveLength(0);
    expectNoBoundary("map find");
  });

  it("the root card carries the legend — four dots drawn as the map draws them", async () => {
    const expectNoBoundary = await openMap();
    const centre = document.querySelector('.mmt-center');
    expect(centre, "no centre node").toBeTruthy();
    await act(async () => { fireEvent.click(centre); });
    const legend = await awaitNode(".mmt-legend");
    expect(legend, "the root card has no legend").toBeTruthy();
    expect(legend.querySelectorAll(".mmt-leg")).toHaveLength(4);
    expect(legend.textContent).toMatch(/with the crowd/);
    expect(legend.textContent).toMatch(/a minority answer/);
    expect(legend.querySelector(".mmt-legdot.is-rare"), "the hollow dot is missing").toBeTruthy();
    expectNoBoundary("map legend");
  });

  it("the card resizes by grab and steps through siblings", async () => {
    const expectNoBoundary = await openMap();
    // into a group, then an answer — the card opens at half
    await act(async () => { fireEvent.click(document.querySelector(".mmt-hub")); });
    await awaitNode(".mmt-trail.is-deep");
    const dot = document.querySelector(".mmt-dotnode:not(.is-leaf):not(.is-person)");
    expect(dot, "no answer dot to select").toBeTruthy();
    await act(async () => { fireEvent.click(dot); });
    const card = await awaitNode(".mmt-card");
    expect(card.className).toMatch(/is-half/);
    const grab = card.querySelector(".mmt-grab");
    expect(grab, "the card has no grab bar").toBeTruthy();
    // a tap toggles half ↔ full; a drag of 28px steps
    fireEvent.pointerDown(grab, { clientY: 300 });
    fireEvent.pointerUp(grab, { clientY: 300 });
    expect(card.className).toMatch(/is-full/);
    fireEvent.pointerDown(grab, { clientY: 300 });
    fireEvent.pointerUp(grab, { clientY: 340 });
    expect(card.className).toMatch(/is-half/);
    fireEvent.pointerDown(grab, { clientY: 300 });
    fireEvent.pointerUp(grab, { clientY: 340 });
    expect(card.className).toMatch(/is-peek/);
    // prev / next, when the answer has siblings
    const nav = card.querySelector(".mmt-cardnav");
    if (nav) {
      const before = document.querySelector(".mmt-dotnode.is-sel")?.getAttribute("aria-label");
      const next = screen.getByRole("button", { name: "Next answer" });
      const prev = screen.getByRole("button", { name: "Previous answer" });
      const btn = next.disabled ? prev : next;
      expect(btn.disabled, "both ends disabled with two or more siblings").toBe(false);
      await act(async () => { fireEvent.click(btn); });
      const after = document.querySelector(".mmt-dotnode.is-sel")?.getAttribute("aria-label");
      expect(after, "next did not move the selection").not.toBe(before);
      expect(nav.textContent).toMatch(/\d+ of \d+/);
    }
    expectNoBoundary("map card");
  });

  it("coaches once each — arrival, then the first group — and forgets on the purge", async () => {
    localStorage.removeItem(HINT_KEY);
    const expectNoBoundary = await openMap();
    const first = await awaitNode(".mmt-coach");
    expect(first, "no coach on first arrival").toBeTruthy();
    expect(first.textContent).toMatch(/Pinch to zoom/);
    await act(async () => { fireEvent.click(first); });
    expect(document.querySelector(".mmt-coach")).toBeNull();
    // the second, the first time a group opens
    await act(async () => { fireEvent.click(document.querySelector(".mmt-hub")); });
    const second = await awaitNode(".mmt-coach");
    expect(second, "no coach on the first group").toBeTruthy();
    expect(second.textContent).toMatch(/You in the trail steps back out/);
    await act(async () => { fireEvent.click(second); });
    expect(document.querySelector(".mmt-coach")).toBeNull();
    expect(localStorage.getItem(HINT_KEY), "the hints were not remembered").toBe("1");
    // back out: no coach again on the same device…
    await act(async () => { fireEvent.click(document.querySelector(".mmt-trail .mmt-crumb")); });
    await awaitNode(".mmt-trail:not(.is-deep)");
    expect(document.querySelector(".mmt-coach")).toBeNull();
    // …until the purge, which is the next account's first arrival (D51)
    await act(async () => {
      localStorage.removeItem(HINT_KEY);
      window.dispatchEvent(new Event("insight:local-purge"));
    });
    expect(await awaitNode(".mmt-coach"), "the purge did not reset the coach").toBeTruthy();
    expectNoBoundary("map coach");
  });
});

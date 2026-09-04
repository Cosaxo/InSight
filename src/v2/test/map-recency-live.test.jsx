// @vitest-environment jsdom
//
// A DEMO BANK POSITION DRAWN AS A RECENT ANSWER.
//
// The Map enlarges and marks its most recent answers — dots at `age <= 2`
// grow 4px, `age <= 7` grow 2px and take `is-fresh`. `age` is `q.idx`, the
// demo calendar's fixed position.
//
// `daily-questions.js` grew `datesAreReal()` for exactly this and says why
// in its own docstring: "in a live build it is the demo bank's fixed
// position, which is not the order this account answered in." The node
// builder asks it for the is-today ring — one field along from where it
// sets `age` — and the two readings drawn FROM age never asked. So on a
// live build the first eight questions of the demo bank were drawn
// enlarged and marked fresh, whatever order this account answered in.
//
// The Mirror's Answers lens refuses "newest" for this same reason
// (docs/MIRROR.md §339). This is that refusal, one screen over.
//
// THE STUB GOES THROUGH THE MODULE, NOT THROUGH `window` —
// daily-questions.js does `import LIVE from '../data/live'`, so a
// `window.LIVE = {…}` reaches it not at all (the D280 trap CLAUDE.md
// names). It also has to fall THROUGH to the real store until a case
// replaces it: loading spec-index evaluates the whole graph, and a null
// default takes it down before any case runs.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

vi.setConfig({ testTimeout: 20000 });

const STUB = vi.hoisted(() => ({ live: null }));
vi.mock("../data/live", async (importOriginal) => {
  const real = await importOriginal();
  return { get default() { return STUB.live ?? real.default; } };
});

// The pane has to be measurable or MapTab returns its `if (!view)` early
// div and every assertion below is about nothing — map-body-renders.test.jsx
// has the full argument for why this stub is honest.
const PANE = { width: 480, height: 720 };
let restore = null;
function measurable(on) {
  if (on) {
    const saved = ["clientWidth", "clientHeight"].map((k) =>
      [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)]);
    restore = () => { for (const [k, d] of saved) { if (d) Object.defineProperty(HTMLElement.prototype, k, d); else delete HTMLElement.prototype[k]; } };
    for (const [k, v] of [["clientWidth", PANE.width], ["clientHeight", PANE.height]]) {
      Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get() { return v; } });
    }
  } else if (restore) { restore(); restore = null; }
}

let MapTab;
let DAILYQ;
let realLive;
let realStore;

beforeAll(async () => {
  measurable(true);
  const specIndex = await import("../spec-index.js");
  await specIndex.loadWorldFeed();
  await specIndex.loadMapTab();
  MapTab = (await import("../spec/map-tab.jsx")).MapTab;
  DAILYQ = (await import("../spec/daily-questions.js")).DAILYQ;
  realLive = window.LIVE;
  realStore = (await import("../data/live")).default;
});
afterAll(() => measurable(false));
afterEach(() => { window.LIVE = realLive; STUB.live = null; cleanup(); });

/** A live store with a bank that joins the demo questions by prompt. */
function installLive() {
  const answered = DAILYQ.answered().slice(0, 12);
  const bank = answered.map((q, i) => ({ id: "bank-" + i, prompt: q.prompt }));
  const votes = {};
  bank.forEach((b) => { votes[b.id] = 0; });
  // Built ON the real store rather than beside it: the Map reads a wide
  // slice of the surface (foresight, learn, circles, aggregates) and a
  // hand-written object goes missing one member at a time, each failure
  // looking like a finding. Only what makes this a LIVE build with a bank
  // is overridden.
  // `enabled` and `ready` are GETTERS on the real store, so `Object.assign`
  // onto a prototype-linked object throws rather than shadowing them —
  // defineProperty is what shadows a getter.
  const live = Object.create(realStore);
  for (const [k, v] of Object.entries({
    enabled: true, ready: true,
    dailyBank: () => bank,
    confirmedVotes: () => votes,
    myVotes: () => votes,
    aggFor: () => null,
  })) Object.defineProperty(live, k, { value: v, configurable: true, enumerable: true });
  STUB.live = live;
  window.LIVE = STUB.live;
  window.dispatchEvent(new Event("insight-live-update"));
}

describe("the Map's recency marks on a live build", () => {
  it("the live store really does flip the dates flag — the case is vacuous otherwise", () => {
    expect(DAILYQ.datesAreReal(), "the demo build should start with real dates").toBe(true);
    installLive();
    expect(DAILYQ.datesAreReal(),
      "the stub never hydrated daily-questions, so nothing below is about a live build").toBe(false);
  });

  it("marks nothing as recent, because `age` is a position and not a date", () => {
    installLive();
    const { container } = render(<MapTab></MapTab>);
    // The body really rendered — otherwise the absence below is the early
    // return, not the fix.
    expect(container.querySelectorAll(".mmt-ddot, .mmt-pdot").length,
      "the Map drew no nodes, so this case is measuring its early return").toBeGreaterThan(0);
    expect(container.querySelectorAll(".is-fresh").length,
      "a demo bank position was drawn as a recently given answer").toBe(0);
  });
});

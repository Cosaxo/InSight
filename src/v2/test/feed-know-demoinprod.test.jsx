// @vitest-environment jsdom
//
// THE LEARN CARD'S HEADLINE, ON A LIVE BUILD THAT HAS NOT ATTACHED.
//
// D89 refused "BEd knows this best · 83%" on a live device because the
// ranking under it is hash noise over the DEMO cut groups — the
// fabrication D1 forbids — and D133 refused the sheet it opens into for
// the same reason. Both refusals were written as `if (LIVE.enabled)`.
//
// `enabled` is false for TWO reasons (D356): a demo build, and a LIVE
// build whose boot has not attached yet. Only the first should see the
// demo arm. So on every cold start with a weak signal, the refusal
// stepped aside and the invented headline was drawn at a real person for
// the length of the boot — measured at 36 of the 75 demo learn cards, the
// first reading "Master's knows this best · 97%".
//
// ITS OWN FILE, and the module mocked rather than booted, because that is
// what `renderKnowInsight`'s own comment asks for: "a test driving this
// branch stubs the module the way LiveCohortBody.test does, not through
// the window stand-in". The shared live fixture cannot express this state
// — it sets `enabled: true` alongside `demoInProd: true`, which the real
// store never does — so a test built on it would pass on the wrong half.
import { describe, expect, it, vi } from "vitest";

const LIVE = vi.hoisted(() => ({
  enabled: false,
  demoInProd: false,
  ready: true,
  attached: false,
  stale: false,
  feedReady: true,
  myVotes: () => ({}),
  aggregated: () => [],
  aggFor: () => null,
  lensAgg: () => null,
  subscribe: () => () => {},
}));
vi.mock("../data/live", () => ({ default: LIVE }));
vi.mock("../data/live.ts", () => ({ default: LIVE }));

const load = async () => {
  await import("../spec/primitives.jsx");
  await import("../spec/world-feed.jsx");
  return window.WorldFeed;
};

describe("the learn headline refuses a live build that has not attached", () => {
  it("draws nothing when the build is live and the boot has not landed", async () => {
    const WorldFeed = await load();
    expect(WorldFeed, "world-feed did not publish WorldFeed").toBeTruthy();
    // A REAL learn card, so the demo arm has something to draw. With a
    // made-up id both calls answer null from `LEARN.card` and the case
    // cannot tell the guard firing from the card missing — which is the
    // shape of vacuous pin this repo keeps finding.
    const q = { id: "lq1", learn: "cell1" };
    const self = { state: { dims: {}, cutAxis: {} }, opts: {}, knowOf: () => ({}) };

    // The demo build: enabled false, demoInProd false. The arm is allowed
    // — this is the state the headline was written FOR, and a guard that
    // refused here would delete the demo's own feature.
    LIVE.enabled = false; LIVE.demoInProd = false;
    const demo = WorldFeed.prototype.renderKnowInsight.call(self, q, {});
    expect(
      demo,
      "the demo arm drew nothing — the case cannot tell a firing guard from a missing card",
    ).toBeTruthy();

    // The live build mid-boot: enabled false for the OTHER reason.
    LIVE.enabled = false; LIVE.demoInProd = true;
    expect(
      WorldFeed.prototype.renderKnowInsight.call(self, q, {}),
      "a live build drew the invented per-cohort headline while its boot was still in flight",
    ).toBeNull();

    // …and the attached live build, which was never in doubt.
    LIVE.enabled = true; LIVE.demoInProd = false;
    expect(WorldFeed.prototype.renderKnowInsight.call(self, q, {})).toBeNull();
    LIVE.enabled = false; LIVE.demoInProd = false;
  });
});

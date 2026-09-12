// @vitest-environment jsdom
//
// THE PROFILE'S THREE DEMO ARMS, ON A LIVE BUILD THAT HAS NOT ATTACHED.
//
// `LIVE.enabled` is false for two different reasons (D356): a demo build,
// and a LIVE build whose boot has not landed yet. Three reads on the
// profile treated it as the first alone, so during every cold start with
// a weak signal a real user was shown, as their own:
//
//   · an INVENTED rarity ("1 in 12 sit as far from average as you"),
//   · up to four of the demo's INVENTED people as their same-type
//     contacts — D1's "no seeded fake users, ever", on a real account,
//   · a staggered progress seed on four instruments they had not touched.
//
// The Mirror tab handles this window correctly (MirrorPreviewTag's
// demoInProd arm) and so does the feed's renderEngage; the profile carried
// no such tag, which is what made these read as the reader's own data.
//
// The module is mocked rather than booted, the way LiveCohortBody.test
// does it: what these three reads need from the store is two booleans.
// The shared live fixture cannot express this state at all — it sets
// `enabled: true` alongside `demoInProd: true`, a pair the real store
// never produces — so a case built on it would pass on the wrong half.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import React from "react";

const LIVE = vi.hoisted(() => ({
  enabled: false,
  demoInProd: false,
  ready: true,
  attached: false,
  stale: false,
  myVotes: () => ({}),
  testFeedItems: () => [],
  // A real big5 result, so `ownResult` yields dims, `IS_matchArchetype`
  // matches, and the demo card actually draws the two invented halves
  // this case is about. With an empty result it drew neither and the
  // control below caught it.
  myTestResults: () => ({ big5: { dims: [
    { id: "O", value: 80 }, { id: "C", value: 60 }, { id: "E", value: 70 },
    { id: "A", value: 55 }, { id: "N", value: 30 },
  ] } }),
  kindredPeople: () => [],
  loadKindred: async () => true,
  scoresFor: () => null,
  subscribe: () => () => {},
}));
vi.mock("../data/live", () => ({ default: LIVE }));
vi.mock("../data/live.ts", () => ({ default: LIVE }));

afterEach(cleanup);

const demo = () => { LIVE.enabled = false; LIVE.demoInProd = false; };
const midBoot = () => { LIVE.enabled = false; LIVE.demoInProd = true; };
const attached = () => { LIVE.enabled = true; LIVE.demoInProd = false; };

describe("the demo's progress stagger", () => {
  it("is the demo's alone — a live build mid-boot starts every instrument at zero", async () => {
    const { PASSIVE } = await import("../spec/passive-progress.js");
    // `seedCount` is the seed made observable: round(SEED[k] * needed(k)).
    // In the demo big5's seed is 1, so it equals the whole instrument.
    demo();
    const full = PASSIVE.seedCount("big5");
    expect(
      full,
      "the demo lost its stagger — this guard is only about live builds, and the demo is where the stagger exists",
    ).toBeGreaterThan(0);

    midBoot();
    expect(
      PASSIVE.seedCount("big5"),
      "a live build mid-boot showed invented progress on an instrument the reader has not touched",
    ).toBe(0);

    attached();
    expect(PASSIVE.seedCount("big5")).toBe(0);
    demo();
  });
});

describe("the result card's two invented halves", () => {
  it("draws neither on a live build whose boot has not landed", async () => {
    const { ResultProfileCard } = await import("../spec/result-card.jsx");
    const draw = () => {
      const { container } = render(
        React.createElement(ResultProfileCard, { testKey: "big5", archetype: null, tagline: "" }),
      );
      const t = container.textContent || "";
      cleanup();
      return t;
    };

    // THE CONTROL FIRST, and it is what the first version of this case
    // got wrong: written against strings the card does not render, it
    // passed on a card drawing nothing and pinned nothing at all. These
    // two are read off what the demo card actually draws.
    //
    //   · the invented RARITY — `IS_profileRarity`'s label, "74 in 100";
    //   · the invented CONTACTS — up to four demo people as avatars in
    //     the emblem, whose initials render BEFORE the card's title.
    demo();
    const shown = draw();
    expect(shown, "the demo card drew no rarity — this case cannot see the guard").toMatch(/\d+ in 100/);
    expect(
      shown.indexOf("Personality"),
      "the demo card drew no same-type contacts before its title — this case cannot see the guard",
    ).toBeGreaterThan(0);

    // …and on a live build mid-boot, neither.
    midBoot();
    const live = draw();
    expect(
      live,
      "a live build mid-boot printed an invented rarity as a fact about the reader",
    ).not.toMatch(/\d+ in 100/);
    expect(
      live.indexOf("Personality"),
      "a live build mid-boot drew demo people as the reader's own same-type contacts (D1)",
    ).toBe(0);

    // …and the attached live build, which was never in doubt.
    attached();
    const real = draw();
    expect(real).not.toMatch(/\d+ in 100/);
    expect(real.indexOf("Personality")).toBe(0);
    demo();
  });
});

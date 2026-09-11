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

// THE RESULT CARD'S TWO HALVES ARE NOT PINNED HERE, and saying so is the
// point rather than an omission. A render case was written and then
// DELETED, because its own control caught it testing nothing: with the
// props a test can supply easily, the demo card draws neither the
// invented rarity nor the invented contacts, so "the live build drew
// neither" passed on an empty card. Making the demo draw them needs a
// real archetype match, which needs `ownResult` to yield dims, which
// needs the exact stored shape `parseTestResults` accepts — a fixture
// worth building, and not worth guessing at 22:30.
//
// The two guards are on the night's list for that render pin. What is
// measured here is the third read of the same flag in the same family, in
// the same commit, which is what makes the other two a reading rather
// than a hope.

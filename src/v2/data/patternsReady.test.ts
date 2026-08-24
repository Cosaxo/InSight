// The Patterns tab's mount gate (D265) — the numbers behind "hidden until
// there is enough data".
//
// The verdict is pure, so these are the cases that decide whether a tab
// exists on a device, with no store and no render in the way. Written
// against the CONSTANTS rather than against literals: the point of a gate
// like this is the relationship (a pool below the floor is shut, at the
// floor is open), and a test that hard-codes 24 would have to be edited
// by whoever moves the floor — which is exactly the edit that should not
// come with a green suite for free.
//
// The mutation each case is defending against is named in it. Between
// them, opening the gate early fails at least three of them.
import { describe, expect, it } from "vitest";
import {
  PATTERNS_MIN_BASIS,
  PATTERNS_MIN_MINE,
  PATTERNS_MIN_POOL,
  patternsEligible,
  patternsReady,
} from "./patternsReady";

/** A signal that clears every threshold — the "open" baseline each case
 * below spoils exactly one field of. */
const open = () => ({
  pool: PATTERNS_MIN_POOL,
  basis: PATTERNS_MIN_BASIS,
  mine: PATTERNS_MIN_MINE,
});

describe("patternsReady", () => {
  it("is shut on a database no fit has run against", () => {
    // The day-one state, and the one every demo build stays in forever:
    // LIVE.patternsSignal() answers `{}` and nothing published.
    expect(patternsReady({})).toBe(false);
  });

  it("opens exactly at the floors, and not one answer below either", () => {
    expect(patternsReady(open())).toBe(true);
    expect(patternsReady({ ...open(), pool: PATTERNS_MIN_POOL - 1 })).toBe(false);
    expect(patternsReady({ ...open(), mine: PATTERNS_MIN_MINE - 1 })).toBe(false);
    // …and above them it stays open — a gate that only matched its own
    // floor would hide the tab again on the next answer.
    expect(patternsReady({ ...open(), pool: PATTERNS_MIN_POOL * 4, mine: 300 })).toBe(true);
  });

  it("needs BOTH halves — a fat fit is not a reason to draw a viewer who has not answered", () => {
    // The People lens places you by a ridge solve over the questions you
    // answered; with none, "you" is the origin under a note that says you
    // are not at the centre. The Oracle's guess is the crowd's margin
    // wearing your name. Neither is a thing the tab may say.
    expect(patternsReady({ pool: 400, basis: PATTERNS_MIN_BASIS, mine: 0 })).toBe(false);
    // …and the mirror image: a viewer who has answered plenty still has
    // nothing to be placed IN until the fit has published.
    expect(patternsReady({ pool: 0, basis: PATTERNS_MIN_BASIS, mine: 200 })).toBe(false);
  });

  it("refuses a count taken at a looser basis than it is about", () => {
    // The handshake. The server publishes the count AND the floor it
    // counted at; a fit that ever counted every published vector —
    // including the n=1 ones, which carry no information at all — would
    // report a pool ten times the real one. The gate can see that and
    // stays shut, instead of trusting a number whose meaning changed in
    // another deployable.
    expect(patternsReady({ pool: 400, basis: 1, mine: 100 })).toBe(false);
    expect(patternsReady({ pool: 400, basis: PATTERNS_MIN_BASIS - 1, mine: 100 })).toBe(false);
    // A stricter fit is not a weaker claim, so it passes.
    expect(patternsReady({ pool: 400, basis: PATTERNS_MIN_BASIS + 20, mine: 100 })).toBe(true);
  });

  it("treats a missing field as nothing rather than as satisfied", () => {
    // `??` not `||` would be the same here; what this pins is that an
    // absent key can never READ as a pass — a published document that
    // lost a field must shut the gate, not open it.
    expect(patternsReady({ pool: 400, mine: 100 })).toBe(false);
    expect(patternsReady({ basis: PATTERNS_MIN_BASIS, mine: 100 })).toBe(false);
    expect(patternsReady({ pool: 400, basis: PATTERNS_MIN_BASIS })).toBe(false);
  });

  it("takes its thresholds as arguments so a caller can pin the verdict, not the constant", () => {
    expect(patternsReady({ pool: 2, basis: 2, mine: 2 }, 2, 2, 2)).toBe(true);
    expect(patternsReady({ pool: 2, basis: 2, mine: 2 }, 3, 2, 2)).toBe(false);
  });

  it("keeps the viewer's floor at the fit's own dimension", () => {
    // PATTERNS_K is 8: below eight observations the ridge solve cannot
    // leave the span of the answered loadings. If this number is ever
    // lowered, the reasoning in the module's docblock has to change with
    // it — that is what this case is here to make someone read.
    expect(PATTERNS_MIN_MINE).toBe(8);
    expect(PATTERNS_MIN_BASIS).toBe(8);
    expect(PATTERNS_MIN_POOL).toBe(24);
  });
});

describe("patternsEligible", () => {
  const q = (over: Record<string, unknown> = {}) =>
    ({ surface: "daily", options: [{}, {}], ...over }) as Parameters<typeof patternsEligible>[0];

  it("counts the two-option daily bank, which is core by construction", () => {
    expect(patternsEligible(q())).toBe(true);
  });

  it("counts a feed question only when it says it is core (D161)", () => {
    expect(patternsEligible(q({ surface: "feed", core: true }))).toBe(true);
    // Absent means tail — the sample-bias rule. A correlation over tail
    // answers reports who bothered, not what the population thinks.
    expect(patternsEligible(q({ surface: "feed" }))).toBe(false);
    expect(patternsEligible(q({ surface: "feed", core: false }))).toBe(false);
  });

  it("refuses anything the fit cannot fold", () => {
    // One bit per question is the engine's whole encoding.
    expect(patternsEligible(q({ options: [{}, {}, {}] }))).toBe(false);
    expect(patternsEligible(q({ options: [{}] }))).toBe(false);
    // Tests, learn, group, duo: core by construction but not in the pool.
    expect(patternsEligible(q({ surface: "test" }))).toBe(false);
    expect(patternsEligible(q({ surface: "learn" }))).toBe(false);
    // A retired question is not evidence about a live viewer.
    expect(patternsEligible(q({ active: false }))).toBe(false);
  });
});

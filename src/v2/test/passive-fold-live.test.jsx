// @vitest-environment jsdom
//
// The profile's passive instruments, folded from the store's REAL vote
// shape (D132).
//
// WHY THIS FILE EXISTS, stated bluntly because the gap it closes is the
// interesting part. `data/passiveProfile.test.ts` pins the fold and every
// case in it passes; `data/similarity.test.ts` pins the arithmetic under
// it and every case there passes too. Both feed the fold a numeric vote
// map, because that is the type the function declares. The store does
// not have one: `LIVE.myVotes()` returns `{ qid: "2" }` — live.ts writes
// `String(optionIdx)` on hydrate — and `Number.isInteger("2")` is false.
//
// So every unit test was green and the shipped screen said "0 of 30
// answered" to a user who had answered thirty, on all four instruments,
// with no way to ever reach a type. The three name-level guards
// (check:globals, eslint, tsc) cannot see it either: result-card.jsx is
// `.jsx`, so the numeric parameter type is not checked at that call.
//
// What was missing was a test that crosses the seam — the fold driven
// through its real adapter, with the shape the real store returns. That
// is this file, and it is deliberately NOT a mount test: the smoke suites
// mount these screens already, and they stayed green throughout, because
// live-fixture.ts answers `testFeedItems: () => []` and an empty bank
// makes the fold return null before it can reach a vote.
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { installLive } from "./live-fixture";
import { IS_TESTS, IS_TEST_RESULTS } from "../spec/test-definitions.js";
import { PASSIVE } from "../spec/passive-progress.js";

const LIKERT5 = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

// The seeded bank, as content/questions carries it: one doc per item of
// the instrument, joined back to IS_TESTS by PROMPT TEXT (`invert` is not
// on the doc — see data/similarity.ts testItemMeta). Built from the
// definition rather than written out, so it cannot drift from it.
function bankFor(kind) {
  return IS_TESTS[kind].questions.map((q, i) => ({
    id: `test-${kind}-${String(i).padStart(2, "0")}`,
    prompt: q.q,
    test: kind,
    surface: "test",
    options: LIKERT5,
  }));
}

let ownProgress;
let ownResult;
let passiveStanding;
let live;
let demoResults;

beforeAll(async () => {
  // Imported here rather than at the top because result-card.jsx injects a
  // <style> at module scope — it needs the jsdom document to exist first.
  ({ ownProgress, ownResult } = await import("../spec/result-card.jsx"));
  ({ passiveStanding } = await import("../spec/passive-meter.jsx"));
  demoResults = JSON.parse(JSON.stringify(IS_TEST_RESULTS));
});

beforeEach(() => {
  // A fresh live account, the way live.ts actually produces one: hydrate
  // ends in publishTestResults(), which announces the server+disk merge and
  // the module REPLACES its contents with it (D-note in live.ts). For an
  // account that has taken nothing that payload is `{}`, and clearing the
  // demo persona's baked results is the point of the event.
  //
  // The fixture does not do this, which matters beyond this file: a live
  // mount test still carries the demo's Big Five, so `ownResult` answers
  // from the seed and the passive path is never reached. Dispatching the
  // real event is how a test says "live account, no stored results"
  // without a second definition of what that means.
  window.dispatchEvent(new CustomEvent("insight:test-results", { detail: {} }));
});

afterEach(() => {
  if (live) live.restore();
  live = null;
  // Put the demo seed back — it is module state shared with anything else
  // that imports the binding.
  window.dispatchEvent(new CustomEvent("insight:test-results", { detail: demoResults }));
});

// Install the fixture with a real test bank and votes in the store's own
// string shape, exactly as LIVE.vote() and hydrate() write them.
function withVotes(kind, picks) {
  live = installLive();
  const bank = bankFor(kind);
  live.LIVE.testFeedItems = () => bank;
  for (const [i, v] of Object.entries(picks)) live.votes[bank[i].id] = String(v);
  // The real store notifies on every write and passive-meter.jsx holds its
  // fold behind that signal; the fixture installs its own `subscribe`, so
  // nothing here would reach the listener. PASSIVE's notify does.
  PASSIVE.poke();
  return bank;
}

describe("ownProgress — the number under the profile's progress bar", () => {
  it("counts answers given through the store, not zero", () => {
    // Six of Politics' thirty, which is the state of the screenshot that
    // reported this: the feed's own ring said 6/30 while the profile tab
    // beside it said 0 of 30. The ring is a localStorage tally
    // (passive-progress.js) and was right; this fold is the one that
    // reads the answers themselves, and it could not see any of them.
    withVotes("political", { 0: 4, 1: 0, 2: 3, 3: 1, 4: 2, 5: 4 });
    const p = ownProgress("political");
    expect(p.total).toBe(30);
    expect(p.answered).toBe(6);
  });

  it("fills the axes those answers land on, and leaves the rest thin", () => {
    // Politics' first four items are two econ then two auth, so those two
    // axes clear MIN_AXIS_ITEMS and the other four do not. An axis-level
    // assertion, because `answered` alone would pass on a fold that
    // counted votes and then scored none of them.
    withVotes("political", { 0: 4, 1: 0, 2: 3, 3: 1 });
    const p = ownProgress("political");
    const byDim = Object.fromEntries(p.dims.map((d) => [d.dim, d]));
    expect(byDim.econ.n).toBe(2);
    expect(byDim.auth.n).toBe(2);
    expect(p.thin).not.toContain("Economic");
    expect(p.thin).not.toContain("Authority");
    expect(p.thin).toContain("Foreign");
    expect(p.ready).toBe(false);
  });

  it("still reads zero when there are genuinely no answers", () => {
    // The bug's disguise: "0 of 30" is also the honest empty state, which
    // is why it survived a release. Both directions asserted, so a fix
    // that hard-codes its way past the first case fails here.
    withVotes("political", {});
    expect(ownProgress("political").answered).toBe(0);
  });
});

describe("ownResult — a type appears once every axis is behind it", () => {
  it("scores a fully answered instrument", () => {
    const bank = bankFor("big5");
    live = installLive();
    live.LIVE.testFeedItems = () => bank;
    bank.forEach((q, i) => { live.votes[q.id] = String(i % 5); });
    const r = ownResult("big5");
    expect(r).not.toBeNull();
    expect(r.passive).toBe(true);
    expect(r.answered).toBe(25);
    // Five traits, each with a number a rose can draw.
    expect(r.dims.map((d) => d.id).sort()).toEqual(["A", "C", "E", "N", "O"]);
    for (const d of r.dims) {
      expect(Number.isFinite(d.value)).toBe(true);
      expect(d.value).toBeGreaterThanOrEqual(0);
      expect(d.value).toBeLessThanOrEqual(100);
    }
  });

  it("refuses a half-answered one rather than drawing a type from it", () => {
    withVotes("big5", { 0: 4, 1: 4 });   // two items, both Openness
    expect(ownResult("big5")).toBeNull();
  });
});

// ── the colour those same answers already justify (D230) ──────────────
//
// The fold reaching `ready` is what earns a TYPE, and the two cases above
// pin that threshold. The colour is the other half: it comes from the same
// dims long before they are ready, because a hue that moves with your
// answers is not the claim a name is. What is asserted here is that it is
// the CURRENT reading and not a family accent — the same answers moved to
// different axes have to produce different hues, or the split is decorative.
describe("passiveStanding — the two-tone split before there is a type", () => {
  // Politics' items pair up by axis: 0,1 econ · 2,3 auth · 4,5 foreign ·
  // 6,7 env. Extremes on one pair and dead-centre on the next make the
  // first the dominant axis and the second the runner-up, which is exactly
  // what the split is built from.
  const HUES = { econ: 235, auth: 265, foreign: 195, env: 170 };

  it("colours from the current fold, and names nothing", () => {
    withVotes("political", { 0: 4, 1: 0, 2: 2, 3: 2 });   // econ extreme, auth neutral
    const st = passiveStanding("political");
    // Four answers of thirty: a type would be a claim, and there is none.
    expect(ownResult("political")).toBeNull();
    expect(st.standing).toBeNull();
    // …and yet the row has a colour, and it is econ's over auth's.
    expect(st.sp).not.toBeNull();
    expect(st.sp.deep).toBe(`oklch(0.52 0.14 ${HUES.econ})`);
    expect(st.sp.lift).toBe(`oklch(0.68 0.115 ${HUES.auth})`);
    expect(st.col).toBe(st.sp.deep);
  });

  it("moves when the answers move", () => {
    withVotes("political", { 4: 4, 5: 4, 6: 2, 7: 2 });   // foreign extreme, env neutral
    const st = passiveStanding("political");
    expect(st.sp.deep).toBe(`oklch(0.52 0.14 ${HUES.foreign})`);
    expect(st.sp.lift).toBe(`oklch(0.68 0.115 ${HUES.env})`);
  });

  it("stays the flat category accent when nothing has been answered", () => {
    withVotes("political", {});
    const st = passiveStanding("political");
    expect(st.sp).toBeNull();
    expect(st.col).toBe(PASSIVE.META.political.accent);
  });

  it("still lets a stored result win, and name its type", () => {
    // The demo persona's Politics result, put back on an account that has
    // also answered four feed items. A stored result is a finished
    // instrument; the fold is an estimate of the same thing from fewer
    // answers, and ownResult's order has to hold for the colour too.
    withVotes("political", { 4: 4, 5: 4, 6: 2, 7: 2 });
    window.dispatchEvent(new CustomEvent("insight:test-results", { detail: demoResults }));
    const st = passiveStanding("political");
    expect(st.standing).toBe("Green Left");
    expect(st.sp.deep).not.toBe(`oklch(0.52 0.14 ${HUES.foreign})`);
  });
});

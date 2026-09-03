// @vitest-environment jsdom
//
// THE MAP ASKED ABOUT EVERY ANSWER USING THE WRONG QUESTION ID.
//
// There are two id spaces for the daily. `daily-questions.js` mints its
// own demo calendar ids ("dq25"), and the seeded bank uses the real ones
// ("daily-005"); `liveSync` joins the two by prompt string. It hydrated
// the vote off the bank id and then dropped it, so the question kept the
// demo id — and `LIVE.aggFor` is keyed by the bank's.
//
// The Map then asked MapStats about `q.id`. On a live build that is a key
// no aggregate has, so the answer was null for EVERY answered question,
// always. What the reader saw, on the stop the Mirror opens onto, for any
// answer they tapped:
//
//   "Your answer is on the map. How people your age answered isn't
//    measured yet — it needs more people on this question first."
//
// False in both halves — the aggregate was on the device with the cohort
// cell in it, and no number of extra people would ever have made it
// appear. The constellation lost the same reading: typicality fell to the
// neutral 0.5 and nothing was ever drawn as a rare take.
//
// WHY NO SUITE SAW IT, and why this file stubs the store rather than using
// the shared live fixture: that fixture's `aggFor` takes NO ARGUMENT
// (`aggFor: () => …`), so it answers for whatever id it is asked. Every
// live mount test passes with any qid, right or wrong. A test written on
// it would be measuring the fixture.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 15000 });

// THE STUB GOES THROUGH THE MODULE, NOT THROUGH `window`.
//
// map-group-stats.js does `import LIVE from '../data/live'`, so a
// `window.LIVE = {…}` reaches it not at all — the D280 trap CLAUDE.md
// names, and the first draft of this file fell straight into it: every
// assertion below passed against the DEMO branch and proved nothing.
// daily-questions.js's liveSync DOES read `window.LIVE`, so both are
// pointed at the same object.
// It also has to fall THROUGH to the real store until a case replaces it:
// loading spec-index evaluates ~85 modules, several of which call
// LIVE.subscribe at module scope, and a null default takes the whole graph
// down before any case runs.
const STUB = vi.hoisted(() => ({ live: null }));
vi.mock("../data/live", async (importOriginal) => {
  const real = await importOriginal();
  return { get default() { return STUB.live ?? real.default; } };
});

// A bank id for the stub to key on. Invented, and it does not matter what
// it is: the whole point is that it is NOT one of daily-questions.js's own
// demo ids, so asking with the wrong one has to come back empty. The join
// is by prompt, taken from the question at runtime.
//
// (This comment said the id was "read off the archive rather than typed,
// so a content edit that moves the prompt fails here" — residue of an
// earlier draft, and false in both halves. Caught reading the night's
// diff as a whole, in the file whose other two drafting mistakes were
// already written up in it.)
const BANK_ID = "daily-bank-probe";

let DAILYQ;
let MapStats;
let realLive;

beforeAll(async () => {
  const specIndex = await import("../spec-index.js");
  await specIndex.loadWorldFeed();
  // DAILYQ is an ESM export (daily-questions.js is off the bridge);
  // MapStats is still published on window. Both, from the same graph
  // spec-index just loaded.
  DAILYQ = (await import("../spec/daily-questions.js")).DAILYQ;
  MapStats = window.MapStats;
  realLive = window.LIVE;
});

afterEach(() => {
  window.LIVE = realLive;
  STUB.live = null;
});

/**
 * A live store that ANSWERS ONLY FOR THE KEY IT IS GIVEN — the whole point
 * of the file. `aggFor` returns the document for `BANK_ID` and null for
 * anything else, which is what the real store does and what the shared
 * fixture does not.
 */
function installKeyedLive(prompt) {
  const agg = {
    total: 900,
    counts: { 0: 700, 1: 200 },
    by: { ageBand: { "25-34": { 0: 400, 1: 60 } } },
  };
  STUB.live = {
    enabled: true,
    ready: true,
    dailyBank: () => [{ id: BANK_ID, prompt }],
    confirmedVotes: () => ({ [BANK_ID]: 0 }),
    myVotes: () => ({ [BANK_ID]: 0 }),
    aggFor: (qid) => (qid === BANK_ID ? agg : null),
    anchors: () => ({ ageBand: "25-34" }),
  };
  window.LIVE = STUB.live;
  window.dispatchEvent(new Event("insight-live-update"));
}

describe("the id the Map asks the live store about", () => {
  it("is the bank's, not the demo calendar's", () => {
    const q = DAILYQ.answered()[5];
    installKeyedLive(q.prompt);
    // The join happened…
    expect(q.liveId, "liveSync did not carry the bank id onto the question").toBe(BANK_ID);
    // …and the two ids really are different, or this file proves nothing.
    expect(q.liveId).not.toBe(q.id);
  });

  it("and asking with the demo id gets nothing, which is what shipped", () => {
    const q = DAILYQ.answered()[5];
    installKeyedLive(q.prompt);
    const nOpt = Math.max(2, q.options ? q.options.length : 10);
    // The reading the Map draws, asked the right way…
    const good = MapStats.dist(q.liveId, "all", nOpt, 0);
    expect(good, "no reading even with the bank id — the stub is wrong, not the app").toBeTruthy();
    expect(good[0]).toBeGreaterThan(good[1]);
    // …and the same question asked the old way. This is the "isn't
    // measured yet" card, reproduced.
    expect(MapStats.dist(q.id, "all", nOpt, 0), "the demo id resolved an aggregate — the two id spaces have merged, and this case is now vacuous").toBeNull();
  });

  // AND THE OTHER HALF OF THE FIX, which the three cases around it do not
  // reach: they call MapStats directly, so reverting map-tab.jsx to `q.id`
  // leaves them green. Measured, not assumed — that revert was run.
  //
  // A SOURCE assertion, on the same reasoning as functions' projection
  // suite: the honest alternative is mounting the whole Map with a keyed
  // live store, and the Map only renders at all in jsdom once its pane is
  // given a size (see map-body-renders.test.jsx). That is the test this
  // one should become; until then this at least fails when the plumbing is
  // undone, which is what shipped.
  it("and BOTH maps ask with it, not with the demo id", async () => {
    const { readFileSync } = await import("node:fs");
    // person-mindmap.jsx carries the identical loop over the same
    // questions and was left behind by the first pass at this — the same
    // class going unfixed in its twin one file over, which is exactly
    // what had happened to the Map itself.
    const person = readFileSync("src/v2/spec/person-mindmap.jsx", "utf8");
    expect(person, "person-mindmap went back to the demo id").toMatch(/const qid = q\.liveId \|\| q\.id;/);
    expect(person, "person-mindmap's reading went back to the demo id").toMatch(/MS\.dist\(qid, 'all'/);
    // …and its MAJORITY reading, which map-tab's half below has asserted
    // since that map was fixed. `gd` is rounded, so deriving the majority
    // from it breaks a real tie by index and mismarks a rare take — the
    // twin carried the fix and this file did not.
    expect(person, "person-mindmap's majority reading went back to the percentages").toMatch(/MS\.mode\(qid, 'all'/);
    expect(person, "person-mindmap's node carries the demo id again").toMatch(/daily: true, qid,/);
    // Resolved off the process cwd, which vitest sets to the repo root —
    // `import.meta.url` in a transformed module is not a filesystem path
    // this can read from.
    const src = readFileSync("src/v2/spec/map-tab.jsx", "utf8");
    expect(src, "map-tab no longer derives the live qid").toMatch(/const qid = q\.liveId \|\| q\.id;/);
    // Both readings and the node itself, by the three call shapes.
    expect(src, "the typicality reading went back to the demo id").toMatch(/MS\.dist\(qid, 'all'/);
    expect(src, "the majority reading went back to the demo id").toMatch(/MS\.mode\(qid, 'all'/);
    expect(src, "the node carries the demo id again — the bottom card reads node.qid")
      .toMatch(/parentId: parent, qid,/);
  });

  it("carries the cohort cell too, which is the sentence the card prints", () => {
    const q = DAILYQ.answered()[5];
    installKeyedLive(q.prompt);
    const nOpt = Math.max(2, q.options ? q.options.length : 10);
    // `age` is one of the three anchors MapStats answers for (D99/D328).
    expect(MapStats.dist(q.liveId, "age", nOpt, 0), "no age-cohort reading").toBeTruthy();
    expect(MapStats.dist(q.id, "age", nOpt, 0)).toBeNull();
  });
});

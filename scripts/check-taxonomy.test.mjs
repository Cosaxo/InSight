// check-taxonomy.test.mjs — proves each rule of the D421 completeness gate
// can FAIL, not just that the tree is green today.
//
// This is the D179/D275 class written down: both were checking scripts that
// had quietly stopped measuring anything (a stale store-form assertion, a
// read tripwire counting `tx.get(` after the code moved to `tx.getAll(`),
// and both reported zero problems and passed. A gate whose only test is
// "the current tree passes" is that bug waiting. So every rule below is
// driven with a source that breaks it.
import { describe, it, expect } from "vitest";
import { checkTaxonomy, loadSources, FORMAT_ONLY, TIER, HUE_MIN_GAP } from "./check-taxonomy.mjs";

const src = () => structuredClone(loadSources());
const errs = (mutate) => { const s = src(); mutate(s); return checkTaxonomy(s); };
const fires = (mutate, re) => {
  const e = errs(mutate);
  expect(e.some((m) => re.test(m)), `no error matched ${re}\ngot: ${e.join("\n")}`).toBe(true);
};

describe("the tree as it ships", () => {
  it("passes", () => {
    expect(checkTaxonomy()).toEqual([]);
  });

  it("is checking something — the sources are all non-empty", () => {
    const s = loadSources();
    expect(s.palette.length).toBeGreaterThan(0);
    expect(s.wire.length).toBeGreaterThan(0);
    expect(Object.keys(s.catMeta).length).toBeGreaterThan(0);
    expect(s.seedBranches.length).toBeGreaterThan(0);
    expect(s.learnFields.length).toBeGreaterThan(0);
  });
});

describe("1 · the feed's two lists", () => {
  it("catches a topic on the wire with no chip in the palette", () => {
    fires((s) => s.wire.push({ id: "ghost", label: "Ghost", color: "oklch(0.55 0.14 5)" }),
      /not in WORLD_TOPICS/);
  });

  it("catches a chip with no wire topic — the half-creation this gate exists for", () => {
    fires((s) => s.palette.push({ id: "ghost", label: "Ghost", color: "oklch(0.52 0.14 5)" }),
      /not in content\/feed-questions\.json/);
  });

  it("lets the two format-only ids be absent from the wire, and says so by name", () => {
    // `places` and `fav` are formats the bank mapper cannot emit (D97 §3).
    expect([...FORMAT_ONLY].sort()).toEqual(["fav", "places"]);
    expect(checkTaxonomy()).toEqual([]);
  });

  it("catches a label that drifted between the two", () => {
    fires((s) => { s.wire[0].label = s.wire[0].label + "!"; }, /label/);
  });

  it("catches a hue that drifted between the two", () => {
    fires((s) => { s.wire[0].color = "oklch(0.55 0.14 7)"; }, /one topic, one hue/);
  });

  it("catches a topic authored at the other file's lightness tier", () => {
    fires((s) => { s.palette[0].color = `oklch(${TIER.wire} 0.14 145)`; }, /lightness/);
  });

  it("catches a topic inserted into one list and appended to the other", () => {
    fires((s) => { s.wire.reverse(); }, /ORDER differs/);
  });
});

describe("2 · the daily's two lists", () => {
  it("catches a seed branch whose hue drifted from CAT_META", () => {
    fires((s) => { s.seedBranches[0].hue = s.seedBranches[0].hue + 1; }, /hue .* in map-branches/);
  });

  it("catches a CAT_META seedId that names no branch", () => {
    fires((s) => { s.catMeta.Body.seedId = "nowhere"; }, /not a branch in map-branches/);
  });

  it("catches a drawn branch no top claims", () => {
    fires((s) => s.seedBranches.push({ id: "orphan", label: "Orphan", hue: 7 }), /no CAT_META top claims/);
  });

  it("catches a top with no hue — the Map draws a branch per top", () => {
    fires((s) => { delete s.catMeta.Sport.hue; }, /no numeric hue/);
  });
});

describe("3 · hues stay distinguishable", () => {
  it("catches two branches at one colour", () => {
    fires((s) => { s.catMeta.Sport.hue = s.catMeta.Food.hue; }, /both sit at hue/);
  });

  it("catches a created feed hue landing on top of a neighbour", () => {
    fires((s) => s.palette.push({ id: "crowd", label: "Crowd", color: "oklch(0.52 0.14 146)" }),
      new RegExp(`under HUE_MIN_GAP ${HUE_MIN_GAP}`));
  });

  it("accepts a hue in the widest gap — what hueFor actually returns", () => {
    // 332 is the midpoint of 310 -> 355, the widest arc on today's ring.
    const e = errs((s) => {
      s.palette.push({ id: "crowd", label: "Crowd", color: "oklch(0.52 0.14 332)" });
      s.wire.push({ id: "crowd", label: "Crowd", color: "oklch(0.55 0.14 332)" });
    });
    expect(e.filter((m) => /HUE_MIN_GAP/.test(m))).toEqual([]);
  });
});

describe("4 · the ledger", () => {
  const proposal = (over = {}) => ({
    id: "gap", label: "Gap", surface: "feed", nearest: "culture",
    questions: [{ prompt: "A?", run: "2026-09-01" }], ...over,
  });

  it("catches a proposal on a surface that does not exist", () => {
    fires((s) => s.ledger.proposals.push(proposal({ surface: "pick" })), /is not one of/);
  });

  it("catches a proposal for a category that already exists", () => {
    fires((s) => s.ledger.proposals.push(proposal({ id: "culture" })), /already has a category/);
  });

  it("catches a proposal with no nearest — the argument's other half", () => {
    fires((s) => s.ledger.proposals.push(proposal({ nearest: undefined })), /no `nearest`/);
  });

  it("catches a nearest that is not a category on that surface", () => {
    fires((s) => s.ledger.proposals.push(proposal({ nearest: "Sport" })), /is not a feed category/);
  });

  it("catches a parked question with no run date — the evidence rule counts days", () => {
    fires((s) => s.ledger.proposals.push(proposal({ questions: [{ prompt: "A?" }] })), /no `run` date/);
  });

  it("catches a category recorded as created that does not exist", () => {
    fires((s) => s.ledger.created.push({ id: "vanished", surface: "feed", label: "Vanished" }),
      /and no such category exists/);
  });

  it("accepts a well-formed proposal", () => {
    expect(errs((s) => s.ledger.proposals.push(proposal()))).toEqual([]);
  });
});

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
import { checkTaxonomy, loadSources, FORMAT_ONLY, TIER, HUE_MIN_GAP, LEAFLESS, GROUPS_TODAY, RIPPLES_TO_INTERESTS } from "./check-taxonomy.mjs";

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
    expect(s.learnSubjects.length).toBeGreaterThan(0);
    expect(s.subtopics.length).toBeGreaterThan(0);
    expect(s.feedQuestions.length).toBeGreaterThan(0);
    expect(s.groups.length).toBe(GROUPS_TODAY);
    expect(Object.keys(s.ripples).length).toBeGreaterThan(0);
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
      /no such top exists/);
  });

  it("accepts a well-formed top proposal", () => {
    expect(errs((s) => s.ledger.proposals.push(proposal()))).toEqual([]);
  });

  it("catches a proposal whose label already names a category", () => {
    fires((s) => s.ledger.proposals.push(proposal({ id: "sub_x", label: "Sport", parent: "sport" })), /already names a feed category/);
  });

  const leaf = (over = {}) => ({
    id: "sub_football", level: "leaf", label: "Football", surface: "feed", parent: "sport",
    questions: [{ prompt: "VAR?", run: "2026-09-01" }], ...over,
  });

  it("accepts a well-formed leaf proposal, retag included", () => {
    const e = errs((s) => {
      const sport = s.feedQuestions.find((q) => q.cat === "sport" && typeof q.sub !== "string");
      s.subtopics = s.subtopics.filter((l) => l.id !== "sub_football"); // free the id the demo uses
      s.ledger.proposals.push(leaf({ retag: [sport.id] }));
    });
    expect(e).toEqual([]);
  });

  it("catches a leaf proposal with no parent", () => {
    fires((s) => s.ledger.proposals.push(leaf({ id: "sub_x", label: "X", parent: undefined })), /needs `parent`/);
  });

  it("catches a leaf under a parent that is not a topic", () => {
    fires((s) => s.ledger.proposals.push(leaf({ id: "sub_x", label: "X", parent: "Sport" })), /is not a feed topic/);
  });

  it("catches a leaf under a format or under `now`", () => {
    expect([...LEAFLESS].sort()).toEqual(["fav", "now", "places"]);
    fires((s) => s.ledger.proposals.push(leaf({ id: "sub_x", label: "X", parent: "now" })), /may not carry leaves/);
  });

  it("catches a feed leaf id without the sub_ prefix", () => {
    fires((s) => s.ledger.proposals.push(leaf({ id: "football", label: "Footie" })), /sub_<slug>/);
  });

  it("catches a retag that lives under another parent, or is already tagged, or does not exist", () => {
    fires((s) => {
      const food = s.feedQuestions.find((q) => q.cat === "food");
      s.ledger.proposals.push(leaf({ id: "sub_x", label: "X", retag: [food.id] }));
    }, /lives under food, not under sport/);
    fires((s) => {
      const sport = s.feedQuestions.find((q) => q.cat === "sport");
      sport.sub = "sub_tennis";
      s.ledger.proposals.push(leaf({ id: "sub_x", label: "X", retag: [sport.id] }));
    }, /already carries sub/);
    fires((s) => s.ledger.proposals.push(leaf({ id: "sub_x", label: "X", retag: ["nope"] })), /is not a feed question/);
  });

  it("refuses a daily leaf — the second level is the path", () => {
    fires((s) => s.ledger.proposals.push(leaf({ id: "x", label: "X", surface: "daily", parent: "Sport" })), /\[Top, Sub\]/);
  });

  it("catches a created leaf that does not exist", () => {
    fires((s) => s.ledger.created.push({ id: "sub_vanished", level: "leaf", surface: "feed", parent: "sport", label: "Vanished" }),
      /no such leaf exists/);
  });
});

describe("5 · the leaf lists", () => {
  it("catches a leaf whose parent is not a topic", () => {
    fires((s) => s.subtopics.push({ id: "sub_x", parent: "nowhere", label: "X" }), /is not a WORLD_TOPICS id/);
  });

  it("catches a leaf under a format or under `now`", () => {
    fires((s) => s.subtopics.push({ id: "sub_x", parent: "fav", label: "X" }), /may not carry leaves/);
    fires((s) => s.subtopics.push({ id: "sub_x", parent: "now", label: "X" }), /may not carry leaves/);
  });

  it("catches a leaf id without the prefix, or repeated", () => {
    fires((s) => s.subtopics.push({ id: "tennis2", parent: "sport", label: "T" }), /sub_<slug>/);
    fires((s) => s.subtopics.push({ ...s.subtopics[0] }), /id repeats/);
  });

  it("catches two leaves with one label under one parent", () => {
    fires((s) => s.subtopics.push({ id: "sub_tennis2", parent: "sport", label: "Tennis" }), /label "Tennis" repeats under sport/);
  });

  it("catches a learn field on a subject that does not exist", () => {
    fires((s) => s.learnFields.push({ id: "x", subject: "nowhere", label: "X" }), /is not in learn-questions.json subjects/);
  });
});

describe("6 · the ring", () => {
  it("holds the hub count as the owner's ratchet", () => {
    fires((s) => s.groups.push({ id: "g-new", label: "New", hue: 1, cats: [] }), /the You map's ring is the owner's/);
    fires((s) => s.groups.pop(), /the You map's ring is the owner's/);
  });

  it("catches a daily top that no hub holds — the silent World default", () => {
    fires((s) => { s.catMeta.Gaming = { hue: 3 }; }, /is in no hub's cats/);
  });

  it("accepts a daily top written into a hub", () => {
    const e = errs((s) => {
      s.catMeta.Gaming = { hue: 3 };
      s.groups.find((g) => g.id === "g-taste").cats.push("top-gaming");
    });
    expect(e.filter((m) => /no hub's cats/.test(m))).toEqual([]);
  });

  it("catches a subject feed topic with no caption row, and lets the stated exception through", () => {
    expect([...RIPPLES_TO_INTERESTS]).toEqual(["now"]);
    fires((s) => {
      s.palette.push({ id: "gaming", label: "Gaming", color: "oklch(0.52 0.14 332)" });
      s.wire.push({ id: "gaming", label: "Gaming", color: "oklch(0.55 0.14 332)" });
    }, /has no WF_BRANCH row/);
    expect(checkTaxonomy().filter((m) => /has no WF_BRANCH row/.test(m))).toEqual([]);
  });

  it("catches a caption that names a place the map does not have, or a topic that does not exist", () => {
    fires((s) => { s.ripples.food = "Snacks"; }, /not a CAT_META top nor a hub label/);
    fires((s) => { s.ripples.gaming = "Taste"; }, /not a WORLD_TOPICS id/);
  });

  it("catches a top proposal whose group names nothing, and leaves a missing group to the regulator", () => {
    const proposal = (over = {}) => ({ id: "gap", label: "Gap", surface: "daily", nearest: "Sport",
      questions: [{ prompt: "A?", run: "2026-09-01" }], ...over });
    fires((s) => s.ledger.proposals.push(proposal({ group: "g-nowhere" })), /is not a hub id/);
    fires((s) => s.ledger.proposals.push(proposal({ surface: "feed", nearest: "sport", group: "Gaming" })), /a WF_BRANCH target/);
    expect(errs((s) => s.ledger.proposals.push(proposal()))).toEqual([]);
    expect(errs((s) => s.ledger.proposals.push(proposal({ group: "g-people" })))).toEqual([]);
  });
});

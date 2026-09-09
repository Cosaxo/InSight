// topic-budget.test.mjs — pins the D424/D425 taxonomy regulator.
//
// The property under test is the reversal's whole safety argument: the
// lanes create categories now, the top level is fixed at the owner's count
// (D425), and the blockers on a leaf are what stands where the human used
// to. Each blocker is pinned separately, because a blocker that stops firing
// is invisible — the regulator would simply start saying yes, which looks
// exactly like evidence arriving.
import { describe, it, expect } from "vitest";
import {
  leafVerdict, topVerdict, topicVerdict, levelOf, runDays, hueFor, hueRing,
  loadTops, loadLeaves, loadLedger, loadRing, isPlaced, feedPageCost, parentDeficitOf,
  retireVerdict, demandReading, coverageAllocation, settlingStock,
  EVIDENCE_MIN, RUNS_MIN, LEAF_FLOOR, LEAF_BIRTH, FIELD_BIRTH, LEAF_TARGET, FIELD_TARGET, BREADTH_SHARE,
  RETIRE_SHARE, TOPS, LEAVES, SURFACES,
} from "./topic-budget.mjs";
import { TOP_FLOOR, RUN_CAP as DAILY_CAP } from "./farm-budget.mjs";
import { TOPIC_FLOOR, RUN_CAP as FEED_CAP } from "./feed-budget.mjs";
import { FIELD_FLOOR, RUN_CAP as LEARN_CAP } from "./learn-budget.mjs";

// D428: a leaf is the lane's call, born with a handful, one run.
const leaf = { surface: "feed", parked: 1, retag: 0, budget: FEED_CAP, parentOk: true };

describe("leafVerdict — breadth-first, the lane's call in one run (D428)", () => {
  it("creates with one parked question and writes the rest of the handful", () => {
    const v = leafVerdict(leaf);
    expect(v.create).toBe(true);
    expect(v.blockers).toEqual([]);
    expect(v.write).toBe(LEAF_BIRTH - 1);
    expect(v.reason).toMatch(/the lane's call, one run/);
    expect(v.reason).toMatch(/which popular niche/);
  });

  it("counts retagged existing questions as the handful — a carve needs no new writing", () => {
    const v = leafVerdict({ ...leaf, parked: 0, retag: LEAF_BIRTH });
    expect(v.create).toBe(true);
    expect(v.write).toBe(0);
  });

  it("has no day rule, no parent-levelled rule and no settling", () => {
    // What the first cut had; a leaf is cheap and folds itself, so none of
    // these stands between a popular niche and its room.
    expect(leafVerdict({ ...leaf, parked: 0 }).create).toBe(true);
    expect(JSON.stringify(leafVerdict(leaf).blockers)).not.toMatch(/anecdote|parent thin|one leaf per parent/);
  });

  it("blocks only when the run cannot reach the handful", () => {
    const v = leafVerdict({ ...leaf, parked: 0, budget: LEAF_BIRTH - 1 });
    expect(v.create).toBe(false);
    expect(v.blockers[0]).toMatch(/exists with its handful/);
  });

  it("refuses a parent that is not a topic that may carry leaves", () => {
    expect(leafVerdict({ ...leaf, parentOk: false }).blockers[0]).toMatch(/parent/);
  });

  it("a learn field is born with six — the difficulty span needs a spread", () => {
    const v = leafVerdict({ surface: "learn", parked: 2, budget: LEARN_CAP, parentOk: true });
    expect(v.create).toBe(true);
    expect(v.write).toBe(FIELD_BIRTH - 2);
    expect(LEAVES.learn.birth).toBe(FIELD_BIRTH);
  });

  it("the daily has no leaf to create — its second level is the path", () => {
    const v = leafVerdict({ surface: "daily", parked: 9, budget: DAILY_CAP });
    expect(v.create).toBe(false);
    expect(v.reason).toMatch(/\[Top, Sub\]/);
    expect(LEAVES.daily).toBeNull();
  });

  it("names every site a creating run must write", () => {
    expect(leafVerdict(leaf).reason).toContain("world-subtopics.js");
  });

  it("refuses an unknown surface rather than defaulting one", () => {
    expect(() => leafVerdict({ ...leaf, surface: "pick" })).toThrow(/unknown surface/);
  });
});

describe("coverageAllocation — the breadth share opens rooms least-covered first", () => {
  const parents = [{ id: "sport", rooms: 3 }, { id: "food", rooms: 0 }, { id: "music", rooms: 12 }];

  it("spends a third of the grant on rooms at the handful, emptiest parent first", () => {
    const c = coverageAllocation({ parents, target: LEAF_TARGET, birth: LEAF_BIRTH, budget: FEED_CAP });
    expect(c.breadth).toBe(Math.floor(FEED_CAP * BREADTH_SHARE / LEAF_BIRTH) * LEAF_BIRTH);
    expect(c.fill).toBe(FEED_CAP - c.breadth);
    const food = c.open.find((o) => o.parent === "food");
    const sport = c.open.find((o) => o.parent === "sport");
    expect(food.open).toBeGreaterThanOrEqual(sport?.open ?? 0);
    expect(c.open.find((o) => o.parent === "music")).toBeUndefined(); // at target: the share rests there
  });

  it("rests when every parent is at target, and says so", () => {
    const c = coverageAllocation({ parents: [{ id: "sport", rooms: 12 }], target: 12, birth: 4, budget: 60 });
    expect(c.open).toEqual([]);
    expect(c.fill).toBe(60);
    expect(c.reason).toMatch(/at its coverage target/);
  });

  it("opens nothing when the share cannot reach one handful", () => {
    const c = coverageAllocation({ parents, target: 12, birth: 6, budget: 12 });
    expect(c.open).toEqual([]);
    expect(c.reason).toMatch(/cannot reach one room's handful/);
  });

  it("learn's third of thirty opens a field and reserves its cards", () => {
    const c = coverageAllocation({ parents: [{ id: "biology", rooms: 4 }], target: FIELD_TARGET, birth: FIELD_BIRTH, budget: LEARN_CAP });
    expect(c.open).toEqual([{ parent: "biology", open: 1 }]);
    expect(c.breadth).toBe(FIELD_BIRTH);
    expect(c.fill).toBe(LEARN_CAP - FIELD_BIRTH);
  });
});

const top = { surface: "feed", placed: true, parked: EVIDENCE_MIN, days: RUNS_MIN, budget: FEED_CAP, settling: null };

describe("topVerdict — a new topic lands in a hub that exists", () => {
  it("holds an unplaced top for the owner, with the owner's words, and points at the tree", () => {
    const v = topVerdict({ ...top, placed: false });
    expect(v.create).toBe(false);
    expect(v.blockers[0]).toMatch(/not placed/);
    expect(v.blockers[0]).toMatch(/really needed/);
    expect(v.blockers[0]).toMatch(/subtopic under `nearest`/);
  });

  it("has no cap on the count of topics and no breadth-debt blocker — evidence and settling are the rule", () => {
    expect(TOPS.feed.max).toBeUndefined();
    expect(topVerdict(top).create).toBe(true);
    expect(topVerdict({ ...top, parked: 50, days: 1 }).blockers[0]).toMatch(/anecdote/);
    // Breadth debt was a blocker in D424's cut; D428 retired it — the fill
    // share pays the debt, and a thin room somewhere is not a reason a
    // popular niche has no room.
    expect(JSON.stringify(topVerdict({ ...top }).blockers)).not.toMatch(/breadth debt/);
    expect(topVerdict({ ...top, settling: TOPIC_FLOOR - 1 }).blockers.some((b) => /one room at a time/.test(b))).toBe(true);
    expect(topicVerdict).toBe(topVerdict);
  });

  it("a learn subject is cheap: born in one run with its first field's handful", () => {
    expect(TOPS.learn.cheap).toBe(true);
    const v = topVerdict({ surface: "learn", parked: 1, days: 1, budget: LEARN_CAP });
    expect(v.create).toBe(true);
    expect(v.write).toBe(FIELD_BIRTH - 1);
    expect(v.reason).toMatch(/Knowledge takes it by prefix/);
    expect(topVerdict({ surface: "learn", parked: 0, days: 0, budget: 2 }).blockers[0]).toMatch(/first field's handful/);
  });

  it("names the hub site among the sites a creating run must write", () => {
    expect(topVerdict(top).reason).toContain("world-feed-topics.js");
    expect(topVerdict(top).reason).toContain("feed-questions.json");
    expect(topVerdict(top).reason).toContain("WF_BRANCH");
    expect(TOPS.daily.sites.some((x) => /map-groups\.js/.test(x))).toBe(true);
  });

  it("resolves placement per surface off the real ring", async () => {
    const ring = await loadRing();
    expect(ring.groups.length).toBeGreaterThan(0);
    expect(isPlaced({ surface: "daily", group: "g-people" }, ring)).toBe(true);
    expect(isPlaced({ surface: "daily", group: "g-nowhere" }, ring)).toBe(false);
    expect(isPlaced({ surface: "daily" }, ring)).toBe(false);
    expect(isPlaced({ surface: "feed", group: "Taste" }, ring)).toBe(true);   // a hub label
    expect(isPlaced({ surface: "feed", group: "Food" }, ring)).toBe(true);    // a branch
    expect(isPlaced({ surface: "feed", group: "Gaming" }, ring)).toBe(false);
    expect(isPlaced({ surface: "learn" }, ring)).toBe(true);                   // lrn- prefix, automatic
  });
});

describe("the floors are the lanes' own", () => {
  // D197's one-copy rule: if these ever drift, the regulator would be
  // holding a category to a standard its own lane does not enforce.
  it("imports rather than restates each floor and cap", () => {
    expect(TOPS.daily.floor).toBe(TOP_FLOOR);
    expect(TOPS.feed.floor).toBe(TOPIC_FLOOR);
    expect(TOPS.learn.floor).toBe(FIELD_FLOOR);
    expect(LEAVES.learn.floor).toBe(FIELD_FLOOR);
    expect(SURFACES).toEqual(["feed", "daily", "learn"]);
  });

  it("a feed leaf's floor is one page — held equal to the pager's constant", () => {
    // Read off bankPager.ts, never restated; null would mean the constant
    // moved and this pin is what says so.
    expect(feedPageCost()).toBe(LEAF_FLOOR);
  });
});

describe("levelOf and runDays", () => {
  it("reads the level off the proposal, else off its shape", () => {
    expect(levelOf({ level: "top", parent: "sport" })).toBe("top");
    expect(levelOf({ parent: "sport" })).toBe("leaf");
    expect(levelOf({ nearest: "sport" })).toBe("top");
  });
  it("counts distinct days, not questions", () => {
    expect(runDays([{ run: "2026-09-01" }, { run: "2026-09-01" }, { run: "2026-09-02" }])).toBe(2);
    expect(runDays([{ run: "2026-09-01" }, {}])).toBe(1);
    expect(runDays([{ run: "2026-09-01T07:00:00Z" }, { run: "2026-09-01" }])).toBe(1);
  });
});

describe("hueFor — a top's colour; a leaf wears its family's", () => {
  it("reproduces D231's own pick", () => {
    // The twelve hues the feed carried before `now`, and the record's
    // reasoning: "Hue 115 is the widest gap left in the row (85 -> 145),
    // picked for distance from its neighbours rather than for a meaning."
    const before = [145, 40, 310, 355, 235, 200, 25, 260, 85, 290, 60, 170];
    expect(hueFor(before)).toBe(115);
  });
  it("takes the widest gap's midpoint, wrapping the ring", () => {
    const ring = hueRing("feed", [
      { color: "oklch(0.52 0.14 25)" }, { color: "oklch(0.52 0.14 40)" }, { color: "oklch(0.52 0.14 200)" },
    ]);
    // Arcs: 25->40 is 15, 40->200 is 160, the wrap 200->25 is 185 — the
    // widest, so the midpoint wraps too: 200 + 92.5 = 292.5 -> 293.
    expect(hueFor(ring)).toBe(293);
    expect(hueFor([350, 10])).toBe(180);
    expect(hueFor([90])).toBe(270);
    expect(hueFor([])).toBe(0);
  });
});

describe("the tree it actually runs on", () => {
  it("reads every surface's stock through the lanes' own loaders", async () => {
    const t = await loadTops();
    for (const name of SURFACES) {
      expect(t[name].rows.length).toBeGreaterThan(0);
      expect(t[name].deficit).toBeGreaterThanOrEqual(0);
    }
  });

  it("reads the leaves with their parents and their tagged stock", async () => {
    const l = await loadLeaves();
    expect(l.feed.length).toBeGreaterThan(0);
    for (const s of l.feed) expect(s.id).toMatch(/^sub_/);
    expect(l.learn.length).toBeGreaterThan(0);
    for (const f of l.learn) expect(typeof f.parent).toBe("string");
  });

  it("a parent's deficit is the lane's own arithmetic, per level", async () => {
    const [t, l] = [await loadTops(), await loadLeaves()];
    expect(parentDeficitOf("feed", "sport", t, l)).toBe(Math.max(0, TOPIC_FLOOR - t.feed.rows.find((r) => r.id === "sport").stock));
    expect(parentDeficitOf("feed", "nowhere", t, l)).toBeNull();
    expect(parentDeficitOf("learn", "biology", t, l)).toBeGreaterThanOrEqual(0);
    expect(parentDeficitOf("daily", "Sport", t, l)).toBeNull();
  });

  it("settling holds the door on a live prior top, and says nothing about a retired one", () => {
    // The room the settling blocker is ABOUT has to exist. A top that was
    // created and later folded keeps its `created` row on purpose —
    // check:taxonomy rule 4 accepts it precisely when a matching `retired`
    // row is there — so reading a missing taxonomy row as stock 0 held
    // every future proposal on that surface with "the last feed topic
    // created is at 0 of 24", forever, about a room that is gone.
    const rows = [{ id: "gaming", stock: 30 }];
    const created = [{ id: "gaming", level: "top", surface: "feed", createdAt: "2026-08-01", pr: 1 }];
    expect(settlingStock({ created, retired: [] }, "feed", rows)).toBe(30);
    expect(settlingStock({ created, retired: [{ id: "gaming", surface: "feed" }] }, "feed", [])).toBeNull();
    // a retirement on ANOTHER surface is not this surface's
    expect(settlingStock({ created, retired: [{ id: "gaming", surface: "daily" }] }, "feed", rows)).toBe(30);
    // …and the door still closes on the newest top STILL STANDING when a
    // later one was folded back — skipping the retired row is not the
    // same as giving up on the question
    const two = [
      { id: "gaming", level: "top", surface: "feed", createdAt: "2026-08-01", pr: 1 },
      { id: "dilemma", level: "top", surface: "feed", createdAt: "2026-08-20", pr: 2 },
    ];
    expect(settlingStock({ created: two, retired: [{ id: "dilemma", surface: "feed" }] }, "feed", rows)).toBe(30);
    expect(settlingStock({ created: [], retired: [] }, "feed", rows)).toBeNull();
    // created, not retired, and no row: a broken ledger, which is
    // check:taxonomy's to report — null rather than a false 0
    expect(settlingStock({ created: [{ id: "ghost", level: "top", surface: "feed" }], retired: [] }, "feed", rows))
      .toBeNull();
    // and the two readings differ where it matters: 0 blocks, null does not
    const base = { surface: "feed", parked: EVIDENCE_MIN, days: RUNS_MIN, budget: FEED_CAP, placed: true };
    expect(topVerdict({ ...base, settling: 0 }).blockers.some((b) => /one room at a time/.test(b))).toBe(true);
    expect(topVerdict({ ...base, settling: null }).blockers.some((b) => /one room at a time/.test(b))).toBe(false);
  });

  it("ships an empty ledger with both arrays present", () => {
    const led = loadLedger();
    expect(Array.isArray(led.proposals)).toBe(true);
    expect(Array.isArray(led.created)).toBe(true);
  });
});

describe("retireVerdict — fold, never delete (D427)", () => {
  const leaf = { level: "leaf", surface: "feed", id: "sub_tennis", into: "sport", intoExists: true, stock: LEAF_BIRTH - 1, floor: LEAF_FLOOR, birth: LEAF_BIRTH };
  const top = { level: "top", surface: "feed", id: "culture", into: "people", intoExists: true, stock: 30, floor: TOPIC_FLOOR };
  const readable = { mode: "demand", weights: { culture: 0.001, people: 0.5, sport: 0.499 }, note: "" };

  it("folds a feed leaf that fell below its handful into its parent — the free fold", () => {
    const v = retireVerdict(leaf);
    expect(v.retire).toBe(true);
    expect(v.licence).toMatch(/below its handful/);
    expect(v.reason).toMatch(/strip `sub: "sub_tennis"`/);
    expect(v.reason).toMatch(/world-subtopics\.js/);
  });

  it("keeps a leaf that holds its handful — under the floor is the lane's to fill, not a licence (D428)", () => {
    const v = retireVerdict({ ...leaf, stock: LEAF_BIRTH });
    expect(v.retire).toBe(false);
    expect(v.blockers[0]).toMatch(/holds its handful/);
    expect(retireVerdict({ ...leaf, stock: LEAF_BIRTH, ownerSaid: true }).retire).toBe(true);
    // Readable and silent folds it even with its handful
    const readable = { mode: "demand", weights: { sub_tennis: 0, sport: 1 }, note: "" };
    const { share, evenShare } = demandReading(readable, "sub_tennis", ["sub_tennis", "sport"]);
    expect(retireVerdict({ ...leaf, stock: LEAF_FLOOR, signal: readable, share, evenShare }).retire).toBe(true);
  });

  it("a feed leaf folds only into its own parent", () => {
    const v = retireVerdict({ ...leaf, into: "food", intoExists: false });
    expect(v.retire).toBe(false);
    expect(v.blockers[0]).toMatch(/own parent/);
  });

  it("never deletes: no `into`, or `into` itself, is refused", () => {
    expect(retireVerdict({ ...leaf, into: undefined }).blockers[0]).toMatch(/never deleted/);
    expect(retireVerdict({ ...leaf, into: "sub_tennis" }).blockers[0]).toMatch(/itself/);
  });

  it("thin is NOT a licence for a top — the lane fills it", () => {
    const v = retireVerdict({ ...top, stock: 2 });
    expect(v.retire).toBe(false);
    expect(v.blockers[0]).toMatch(/blind/);
    expect(v.blockers[0]).toMatch(/never on a run's tidiness/);
  });

  it("a top folds on a real crowd's silence", () => {
    const { share, evenShare } = demandReading(readable, "culture", ["culture", "people", "sport"]);
    expect(share).toBeLessThan(RETIRE_SHARE * evenShare);
    const v = retireVerdict({ ...top, signal: readable, share, evenShare });
    expect(v.retire).toBe(true);
    expect(v.licence).toMatch(/nobody answers it/);
    expect(v.reason).toMatch(/rewrite `cat: "culture"` → "people"/);
    expect(v.reason).toMatch(/WF_BRANCH/);
  });

  it("a top the crowd answers stays, even when the signal is readable", () => {
    const { share, evenShare } = demandReading(readable, "people", ["culture", "people", "sport"]);
    const v = retireVerdict({ ...top, id: "people", into: "culture", signal: readable, share, evenShare });
    expect(v.retire).toBe(false);
    expect(v.blockers[0]).toMatch(/the crowd answers it/);
  });

  it("a blind signal reads as no share, never as silence", () => {
    expect(demandReading({ mode: "blind", weights: null, note: "x" }, "culture", ["culture"])).toEqual({ share: null, evenShare: null });
    expect(demandReading(readable, "nowhere", ["culture", "people", "sport"]).share).toBe(0);
  });

  it("folds the leaves before the parent", () => {
    const v = retireVerdict({ ...top, ownerSaid: true, leaves: 2 });
    expect(v.retire).toBe(false);
    expect(v.blockers[0]).toMatch(/fold the leaves first/);
  });

  it("the owner's word licenses a top with the signal blind, and says what a daily fold costs", () => {
    const v = retireVerdict({ level: "top", surface: "daily", id: "Travel", into: "Interests", intoExists: true, stock: 10, floor: TOP_FLOOR, ownerSaid: true });
    expect(v.retire).toBe(true);
    expect(v.reason).toMatch(/answers move branch on every user's Map/);
    expect(v.reason).toMatch(/map-anchors\.js/);
  });

  it("a learn field folds within its subject", () => {
    const v = retireVerdict({ level: "leaf", surface: "learn", id: "gene", into: "solar", intoExists: false, stock: 3, floor: FIELD_FLOOR });
    expect(v.retire).toBe(false);
    expect(v.blockers[0]).toMatch(/same subject/);
    expect(retireVerdict({ level: "leaf", surface: "learn", id: "gene", into: "cell", intoExists: true, stock: 3, floor: FIELD_FLOOR }).retire).toBe(true);
  });

  it("the daily's FALLBACK table is a site a creating run must write", () => {
    expect(TOPS.daily.sites.some((x) => /map-anchors\.js/.test(x))).toBe(true);
  });
});

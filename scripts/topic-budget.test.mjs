// topic-budget.test.mjs — pins the D421/D422 taxonomy regulator.
//
// The property under test is the reversal's whole safety argument: the
// lanes create categories now, the top level is fixed at the owner's count
// (D422), and the blockers on a leaf are what stands where the human used
// to. Each blocker is pinned separately, because a blocker that stops firing
// is invisible — the regulator would simply start saying yes, which looks
// exactly like evidence arriving.
import { describe, it, expect } from "vitest";
import {
  leafVerdict, topVerdict, topicVerdict, levelOf, runDays, hueFor, hueRing,
  loadTops, loadLeaves, loadLedger, loadRing, isPlaced, feedPageCost, parentDeficitOf,
  EVIDENCE_MIN, RUNS_MIN, LEAF_FLOOR, TOPS, LEAVES, SURFACES,
} from "./topic-budget.mjs";
import { TOP_FLOOR, RUN_CAP as DAILY_CAP } from "./farm-budget.mjs";
import { TOPIC_FLOOR, RUN_CAP as FEED_CAP } from "./feed-budget.mjs";
import { FIELD_FLOOR, RUN_CAP as LEARN_CAP } from "./learn-budget.mjs";

// A feed leaf with every blocker clear, so each test breaks exactly one thing.
const leaf = { surface: "feed", parked: EVIDENCE_MIN, retag: 0, days: RUNS_MIN, parentDeficit: 0, budget: FEED_CAP, settling: null };

describe("leafVerdict — the normal case", () => {
  it("creates when evidence, parent and settling are all clear, born full", () => {
    const v = leafVerdict(leaf);
    expect(v.create).toBe(true);
    expect(v.blockers).toEqual([]);
    expect(leaf.parked + v.write).toBe(LEAF_FLOOR);
    expect(v.reason).not.toMatch(/floor-first levelling/);
  });

  it("counts retagged questions as evidence, but not as days", () => {
    // A carve out of existing stock is free stock — and still needs three
    // runs to have said so, because a retag list carries no day.
    expect(leafVerdict({ ...leaf, parked: 0, retag: 12, days: 0 }).create).toBe(false);
    expect(leafVerdict({ ...leaf, parked: 0, retag: 12, days: 0 }).blockers[0]).toMatch(/anecdote/);
    const v = leafVerdict({ ...leaf, parked: 3, retag: 9, days: RUNS_MIN });
    expect(v.create).toBe(true);
    expect(v.write).toBe(0); // 3 + 9 already fills the shelf
  });

  it("blocks one run's opinion however many questions it parked", () => {
    const v = leafVerdict({ ...leaf, parked: 50, days: 1 });
    expect(v.create).toBe(false);
    expect(v.blockers[0]).toMatch(/anecdote/);
  });

  it("blocks a leaf under a thin parent — depth where breadth is still owed", () => {
    const v = leafVerdict({ ...leaf, parentDeficit: 1 });
    expect(v.create).toBe(false);
    expect(v.blockers.some((b) => /parent thin/.test(b))).toBe(true);
  });

  it("blocks a second leaf under a parent while the last one is thin", () => {
    const v = leafVerdict({ ...leaf, settling: LEAF_FLOOR - 1 });
    expect(v.create).toBe(false);
    expect(v.blockers.some((b) => /one leaf per parent/.test(b))).toBe(true);
    expect(leafVerdict({ ...leaf, settling: LEAF_FLOOR }).create).toBe(true);
  });

  it("a feed leaf is born full, always — the cap covers the floor", () => {
    // feed-budget levels topics, not leaves, so a thin feed leaf would stay
    // thin; the capacity check exists for the day these constants cross.
    expect(FEED_CAP).toBeGreaterThanOrEqual(LEAF_FLOOR - EVIDENCE_MIN);
    expect(LEAVES.feed.levelledByLane).toBe(false);
    const v = leafVerdict({ ...leaf, budget: 2 }); // the constants crossing
    expect(v.create).toBe(false);
    expect(v.blockers.some((b) => /born full/.test(b))).toBe(true);
  });

  it("a learn field may be born thin — the learn regulator finishes it", () => {
    expect(LEAVES.learn.levelledByLane).toBe(true);
    expect(LEARN_CAP).toBeLessThan(FIELD_FLOOR - EVIDENCE_MIN); // the D421 lockout, as arithmetic
    const v = leafVerdict({ surface: "learn", parked: EVIDENCE_MIN, days: RUNS_MIN, parentDeficit: 0, budget: LEARN_CAP });
    expect(v.create).toBe(true);
    expect(v.write).toBe(LEARN_CAP);
    expect(v.reason).toMatch(/floor-first levelling writes the other/);
  });

  it("the daily has no leaf to create — its second level is the path", () => {
    const v = leafVerdict({ surface: "daily", parked: 9, days: 9, parentDeficit: 0, budget: DAILY_CAP });
    expect(v.create).toBe(false);
    expect(v.blockers).toEqual([]);
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

const top = { surface: "feed", placed: true, parked: EVIDENCE_MIN, days: RUNS_MIN, deficit: 0, budget: FEED_CAP, settling: null };

describe("topVerdict — a new topic lands in a hub that exists", () => {
  it("holds an unplaced top for the owner, with the owner's words, and points at the tree", () => {
    const v = topVerdict({ ...top, placed: false });
    expect(v.create).toBe(false);
    expect(v.blockers[0]).toMatch(/not placed/);
    expect(v.blockers[0]).toMatch(/really needed/);
    expect(v.blockers[0]).toMatch(/subtopic under `nearest`/);
  });

  it("has no cap on the count of topics — D421's blockers are the whole rule", () => {
    expect(TOPS.feed.max).toBeUndefined();
    expect(topVerdict(top).create).toBe(true);
    expect(topVerdict({ ...top, parked: 50, days: 1 }).blockers[0]).toMatch(/anecdote/);
    expect(topVerdict({ ...top, deficit: 1 }).blockers.some((b) => /breadth debt/.test(b))).toBe(true);
    expect(topVerdict({ ...top, settling: TOPIC_FLOOR - 1 }).blockers.some((b) => /one room at a time/.test(b))).toBe(true);
    expect(topicVerdict).toBe(topVerdict);
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

  it("ships an empty ledger with both arrays present", () => {
    const led = loadLedger();
    expect(Array.isArray(led.proposals)).toBe(true);
    expect(Array.isArray(led.created)).toBe(true);
  });
});

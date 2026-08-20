// question-quality.test.mjs — pins the D97 style-guide gate: the measured
// bounds, the hard-rule-6 tripwire's shape (conjunction, not mention), the
// batch-mix rules, and — the liveness half — that the real corpus passes
// and the provenance join is exactly in step with the banks.
import { describe, it, expect } from "vitest";
import {
  loadCorpus, checkQuestion, checkBatch, checkProvenance, checkHeadroom,
  checkPathGenre, placeCivicHit, PROMPT_MAX, OPTION_SHAPES, FEED_TYPES,
  DIAL_BUCKETS, PATH_AXES, PATH_AXIS_LEGACY,
} from "./question-quality.mjs";

const corpus = loadCorpus();
const daily = (over = {}) => ({
  type: "binary", prompt: "Mountains or sea?", options: ["Mountains", "Sea"],
  tag: "landscape pull", tone: "light",
  cat: ["Travel", "Places"], alts: [["Mind", "Preference"], ["Story", "Roots"]],
  ...over,
});

describe("checkQuestion (daily card shape)", () => {
  it("passes a well-formed card", () => {
    expect(checkQuestion(daily(), "daily", corpus).errs).toEqual([]);
  });

  it("rejects a prompt past the measured bound", () => {
    const { errs } = checkQuestion(daily({ prompt: "x".repeat(PROMPT_MAX + 1) }), "daily", corpus);
    expect(errs.some((e) => e.rule === "prompt" && e.msg.includes("chars"))).toBe(true);
  });

  it("holds the option shapes per type", () => {
    expect(checkQuestion(daily({ options: ["One"] }), "daily", corpus).errs.length).toBe(1);
    const choice = daily({ type: "choice", options: ["A", "B"] }); // choice is 3–4
    expect(checkQuestion(choice, "daily", corpus).errs.length).toBe(1);
    expect(OPTION_SHAPES.scale).toEqual([0, 0]); // options are synthesized downstream
  });

  it("demands an axis on ordinal types", () => {
    const q = daily({ type: "scale", options: [], prompt: "Money buys freedom." });
    expect(checkQuestion(q, "daily", corpus).errs.some((e) => e.rule === "axis")).toBe(true);
    expect(checkQuestion({ ...q, axis: "money" }, "daily", corpus).errs).toEqual([]);
  });

  it("stamps every error with the rule slug the ALLOW key needs", () => {
    // The waiver mechanism is per-finding ("<id>~<rule>"), so a rule-less
    // error would be unwaivable — and an over-broad waiver was the bug the
    // D97 review pass caught before this shipped.
    const bad = daily({
      prompt: "x".repeat(PROMPT_MAX + 1), tone: "spicy", tag: "one two three four five",
      cat: ["Weather", "Sky"], options: ["One"],
    });
    const { errs } = checkQuestion(bad, "daily", corpus);
    expect(errs.length).toBeGreaterThanOrEqual(5);
    for (const e of errs) {
      expect(typeof e.rule).toBe("string");
      expect(e.rule.length).toBeGreaterThan(0);
      expect(typeof e.msg).toBe("string");
    }
    expect(new Set(errs.map((e) => e.rule)).size).toBe(errs.length);
  });

  it("rejects unknown tones, oversized tags, and cats outside CAT_META", () => {
    expect(checkQuestion(daily({ tone: "spicy" }), "daily", corpus).errs.length).toBe(1);
    expect(checkQuestion(daily({ tag: "one two three four five" }), "daily", corpus).errs.length).toBe(1);
    expect(checkQuestion(daily({ cat: ["Weather", "Sky"] }), "daily", corpus).errs.length).toBe(1);
    expect(checkQuestion(daily({ alts: [["Mind", "x"]] }), "daily", corpus).errs.length).toBe(1);
  });
});

// ── continuum forms (feed dial/field) ──
const dial = (over = {}) => ({
  type: "dial", cat: "bigq", prompt: "When does old age begin?",
  lo: 40, hi: 90, unit: "yrs", med: 63, n: 5200,
  dist: [1, 3, 5, 9, 14, 18, 17, 13, 9, 6, 3, 2],
  ...over,
});
const field = (over = {}) => ({
  type: "field", cat: "bigq", prompt: "Small talk — place it",
  ax: ["painful", "pleasant"], ay: ["pointless", "essential"], n: 4100,
  cloud: [[64, 32, 12, 16], [30, 60, 8, 14], [50, 48, 6, 12]],
  ...over,
});

const TEX = { texture: true };

// ── Crossroads (feed path) ──
// A story whose every walk turns three axes: risk → time → company, eight
// times. Built rather than written out so a test that MOVES an axis moves
// exactly one thing — the flat variants below differ from this by a single
// node, which is what makes them evidence about the rule and not about the
// fixture.
const PATH_WALKS = ["A", "B"].flatMap((a) => ["A", "B"].flatMap((b) => ["A", "B"].map((c) => a + b + c)));
const path = (axes = {}, over = {}) => ({
  id: "ptTest", core: true, cat: "food", type: "path", hue: 200,
  title: "The Test Story", prompt: "A story — the probe one", intro: "A scene, two sentences at most.",
  nodes: Object.fromEntries(["_", "A", "B", "AA", "AB", "BA", "BB"].map((k) => [k, {
    // `k in axes`, not `??` — an override of `undefined` has to MEAN
    // "this fork declares no axis", and a nullish default would quietly
    // hand it one back and test nothing.
    axis: k in axes ? axes[k] : (k === "_" ? "risk" : k.length === 1 ? "time" : "company"),
    q: `Scene ${k}.`,
    a: [{ t: "The first way" }, { t: "The other way" }],
  }])),
  endings: Object.fromEntries(PATH_WALKS.map((w) => [w, { name: `End ${w}`, line: "Where you are standing." }])),
  ...over,
});

describe("checkQuestion (Crossroads shape and axes)", () => {
  it("passes a story that turns three axes on every walk", () => {
    expect(checkQuestion(path(), "feed", corpus).errs).toEqual([]);
  });

  it("demands an axis on every fork, from the closed vocabulary", () => {
    const none = checkQuestion(path({ AB: undefined }), "feed", corpus).errs;
    expect(none.some((e) => e.rule === "axis" && e.msg.includes('"AB"'))).toBe(true);
    // An open vocabulary is a free text field, and three spellings of one
    // axis would read as a spread — which is the rule inverted.
    const invented = checkQuestion(path({ AB: "greed" }), "feed", corpus).errs;
    expect(invented.some((e) => e.rule === "axis" && e.msg.includes("greed"))).toBe(true);
    expect(PATH_AXES.has("ownership") && !PATH_AXES.has("greed")).toBe(true);
  });

  it("fires per WALK, not per tree — a story can be varied down one branch and flat down another", () => {
    // One node moved: AA now repeats its parent's axis, so the two walks
    // THROUGH it go flat and the other six stay clean. A per-tree rule
    // would have said "this story is fine" (six of eight walks are).
    const { errs } = checkQuestion(path({ AA: "time" }), "feed", corpus);
    const spread = errs.filter((e) => e.rule === "axis-spread");
    expect(spread.length).toBe(1);
    expect(spread[0].msg).toContain("2 of 8 walks");
    expect(spread[0].msg).toContain("AAA (risk → time → time)");
  });

  it("waives the spread rule for the two frozen stories — and only that rule", () => {
    // Their ending names are the answer space and D52 freezes them, so the
    // fork prose cannot be re-axed without landing walks on names that no
    // longer fit. The annotation stays required: the waiver must not become
    // permission to leave the field off.
    const flat = Object.fromEntries(["_", "A", "B", "AA", "AB", "BA", "BB"].map((k) => [k, "ownership"]));
    expect(checkQuestion(path(flat, { id: "pt1" }), "feed", corpus).errs).toEqual([]);
    expect(checkQuestion(path(flat, { id: "pt3" }), "feed", corpus).errs
      .some((e) => e.rule === "axis-spread")).toBe(true);
    const bare = checkQuestion(path({ ...flat, BA: undefined }, { id: "pt1" }), "feed", corpus).errs;
    expect(bare.some((e) => e.rule === "axis")).toBe(true);
  });

  it("the two live stories carry their axes, and they are the flat ones the waiver names", () => {
    // The liveness half: the annotation is in the data, and it says what
    // PATH_AXIS_LEGACY claims it says (pt1 flat on 6 of 8, pt2 on 8 of 8).
    // A waiver whose recorded arithmetic drifted from the content would be
    // the stale-figure failure wearing a JSON hat.
    const live = corpus.feed.questions.filter((q) => q.type === "path");
    expect(live.length).toBeGreaterThanOrEqual(2);
    for (const q of live) {
      expect(Object.values(q.nodes).every((n) => PATH_AXES.has(n.axis))).toBe(true);
    }
    const flatWalks = (q) => PATH_WALKS.filter((w) => {
      const axes = [0, 1, 2].map((d) => q.nodes[w.slice(0, d) || "_"].axis);
      return new Set(axes).size < 3;
    }).length;
    expect(flatWalks(live.find((q) => q.id === "pt1"))).toBe(6);
    expect(flatWalks(live.find((q) => q.id === "pt2"))).toBe(8);
    expect([...PATH_AXIS_LEGACY.keys()]).toEqual(["pt1", "pt2"]);
  });
});

describe("the Crossroads genre ratchet", () => {
  const at = (ids) => ({ feed: { questions: ids.map((cat, i) => ({ id: `pt${i + 1}`, type: "path", cat })) } });

  it("leaves the first two alone and holds the third off their topics", () => {
    // They have no predecessors, which is why the two D136 shipped need no
    // waiver here — and they are still what the third has to differ from.
    expect(checkPathGenre(at(["dilemma", "dilemma"]))).toEqual([]);
    expect(checkPathGenre(at(["dilemma", "dilemma", "dilemma"])).length).toBe(1);
    expect(checkPathGenre(at(["dilemma", "dilemma", "food"]))).toEqual([]);
  });

  it("looks back two, so an A-B-A-B alternation does not satisfy it", () => {
    expect(checkPathGenre(at(["food", "sport", "food"])).length).toBe(1);
    expect(checkPathGenre(at(["food", "sport", "music", "food"]))).toEqual([]);
  });

  it("the live sequence passes", () => {
    expect(checkPathGenre(corpus)).toEqual([]);
  });
});

describe("checkQuestion (feed continuum shapes)", () => {
  it("passes well-formed dial and field entries, in both their forms", () => {
    // demo-pool form: copy + authored crowd texture
    expect(checkQuestion(dial(), "feed", corpus, TEX).errs).toEqual([]);
    expect(checkQuestion(field(), "feed", corpus, TEX).errs).toEqual([]);
    // content form: the same copy, texture stripped — the live crowd is
    // the aggregate
    // …and `core`, which a CONTENT entry must declare and a demo-pool one
    // must not (D161): the demo pool never reaches the seeded bank, so it
    // has nothing to classify. That asymmetry is the reason the two forms
    // are asserted separately here at all.
    const dialContent = dial();
    delete dialContent.med; delete dialContent.dist; delete dialContent.n;
    dialContent.core = true;
    const fieldContent = field();
    delete fieldContent.cloud; delete fieldContent.n;
    fieldContent.core = true;
    expect(checkQuestion(dialContent, "feed", corpus).errs).toEqual([]);
    expect(checkQuestion(fieldContent, "feed", corpus).errs).toEqual([]);
  });

  it("refuses authored crowd texture on a content entry", () => {
    // An authored dist in the live bank would be a fabricated crowd
    // wearing a live badge — the exact demoInProd lie, committed.
    const { errs } = checkQuestion(dial(), "feed", corpus);
    expect(errs.some((e) => e.rule === "texture")).toBe(true);
  });

  it("closes the feed type list — a novel type no longer passes silently", () => {
    // The daily surface always had a closed list (OPTION_SHAPES); the feed
    // had none, which is exactly how a wrong-shaped card would have reached
    // review unread.
    const { errs } = checkQuestion({ type: "slider", cat: "bigq", prompt: "Hmm?" }, "feed", corpus);
    expect(errs.some((e) => e.rule === "type-shape" && e.msg.includes("unknown feed type"))).toBe(true);
    expect(FEED_TYPES.has("vote") && FEED_TYPES.has("dial") && FEED_TYPES.has("field")).toBe(true);
  });

  it("holds a dial's range, median, and 12-bucket texture", () => {
    expect(checkQuestion(dial({ lo: 90, hi: 40 }), "feed", corpus, TEX).errs.some((e) => e.rule === "range")).toBe(true);
    expect(checkQuestion(dial({ med: 200 }), "feed", corpus, TEX).errs.some((e) => e.rule === "med")).toBe(true);
    expect(checkQuestion(dial({ dist: [1, 2, 3] }), "feed", corpus, TEX).errs.some((e) => e.rule === "dist")).toBe(true);
    expect(checkQuestion(dial({ dist: Array(DIAL_BUCKETS).fill(0) }), "feed", corpus, TEX).errs.some((e) => e.rule === "dist")).toBe(true);
    expect(checkQuestion(dial({ options: ["Low", "High"] }), "feed", corpus, TEX).errs.some((e) => e.rule === "type-shape")).toBe(true);
  });

  it("demands the scale be labelled — a unit or two end labels", () => {
    expect(checkQuestion(dial({ unit: "" }), "feed", corpus, TEX).errs.some((e) => e.rule === "ends")).toBe(true);
    expect(checkQuestion(dial({ unit: "", ends: ["never", "always"] }), "feed", corpus, TEX).errs).toEqual([]);
  });

  it("holds a field's axes and cloud", () => {
    expect(checkQuestion(field({ ax: ["only one"] }), "feed", corpus, TEX).errs.some((e) => e.rule === "ends")).toBe(true);
    expect(checkQuestion(field({ cloud: undefined }), "feed", corpus, TEX).errs.some((e) => e.rule === "cloud")).toBe(true);
    expect(checkQuestion(field({ cloud: [[64, 32, 200, 16]] }), "feed", corpus, TEX).errs.some((e) => e.rule === "cloud" && e.msg.includes("dots"))).toBe(true);
    expect(checkQuestion(field({ cloud: [[120, 32, 12, 16]] }), "feed", corpus, TEX).errs.some((e) => e.rule === "cloud")).toBe(true);
  });

  it("runs the place tripwire over axis end labels too", () => {
    const q = field({ prompt: "The car rules — place them", ax: ["ban in Oslo", "let them be"] });
    expect(checkQuestion(q, "feed", corpus, TEX).errs.some((e) => e.rule === "place-civic")).toBe(true);
  });
});

describe("checkQuestion (doors — `also`, docs/TAGS-PLAN.md)", () => {
  const feedQ = (over = {}) => ({
    type: "vote", cat: "sport", core: true,
    prompt: "E-sports are real sports.", options: ["Yes", "No"],
    ...over,
  });

  it("passes a straddler with a topic door, and one with a subtopic door", () => {
    expect(checkQuestion(feedQ({ also: ["tech"] }), "feed", corpus).errs).toEqual([]);
    expect(checkQuestion(feedQ({ cat: "culture", also: ["sub_tennis"] }), "feed", corpus).errs).toEqual([]);
  });

  it("holds the cap, the closed vocabulary, and the no-repeat rules", () => {
    const slug = (q) => checkQuestion(q, "feed", corpus).errs.filter((e) => e.rule === "also");
    expect(slug(feedQ({ also: ["tech", "food", "music"] })).length).toBeGreaterThan(0); // over ALSO_MAX
    expect(slug(feedQ({ also: ["hiking"] })).length).toBeGreaterThan(0); // not a committed id
    expect(slug(feedQ({ also: ["sport"] })).length).toBeGreaterThan(0); // repeats the home
    expect(slug(feedQ({ also: ["tech", "tech"] })).length).toBeGreaterThan(0); // repeats itself
    expect(slug(feedQ({ also: [] })).length).toBeGreaterThan(0); // emit-when-set, end to end
    expect(slug(feedQ({ also: "tech" })).length).toBeGreaterThan(0); // an array, not a string
  });

  it("refuses a leaf beside its parent — following the parent already reaches the leaf", () => {
    // sub_tennis's parent is sport; carrying both as home+door (either way
    // around) states one membership twice and dilutes the home's credit
    // for nothing.
    const home = checkQuestion(feedQ({ also: ["sub_tennis"] }), "feed", corpus).errs;
    expect(home.some((e) => e.rule === "also" && e.msg.includes("parent"))).toBe(true);
    const doors = checkQuestion(feedQ({ cat: "culture", also: ["sport", "sub_tennis"] }), "feed", corpus).errs;
    expect(doors.some((e) => e.rule === "also" && e.msg.includes("parent"))).toBe(true);
  });

  it("refuses doors on a scene card — a scene is a room, and the filter never reads them there", () => {
    const { errs } = checkQuestion(feedQ({ scene: "tennis", also: ["tech"] }), "feed", corpus);
    expect(errs.some((e) => e.rule === "also" && e.msg.includes("scene"))).toBe(true);
  });

  it("is feed/pick only — the daily's near-neighbour is `alts`, and elsewhere nothing reads doors", () => {
    const d = checkQuestion(daily({ also: ["tech"] }), "daily", corpus).errs;
    expect(d.some((e) => e.rule === "also" && e.msg.includes("alts"))).toBe(true);
    const duel = checkQuestion({ prompt: "Coffee or tea?", options: ["Coffee", "Tea"], also: ["food"] }, "duel", corpus).errs;
    expect(duel.some((e) => e.rule === "also")).toBe(true);
  });

  it("pick cards take doors against WORLD_TOPICS, the superset their cat already uses", () => {
    const card = { type: "pick", cat: "fav", prompt: "Favourite of these?", options: ["A", "B", "C"] };
    expect(checkQuestion({ ...card, also: ["sport"] }, "pick", corpus).errs).toEqual([]);
    const { errs } = checkQuestion({ ...card, also: ["hiking"] }, "pick", corpus);
    expect(errs.some((e) => e.rule === "also")).toBe(true);
  });
});

describe("the hard-rule-6 tripwire", () => {
  it("needs the conjunction — a place OR a cue alone is personal flavor", () => {
    expect(placeCivicHit({ prompt: "Mountains or sea?", options: [] })).toBeNull();
    expect(placeCivicHit({ prompt: "One cuisine, forever?", options: ["Italian", "Japanese"] })).toBeNull();
    expect(placeCivicHit({ prompt: "Should renters get a say in building policy?", options: ["Yes", "No"] })).toBeNull();
  });

  it("fires on the obvious sold-inventory form", () => {
    const hit = placeCivicHit({ prompt: "Should Oslo ban cars downtown?", options: ["Yes", "No"] });
    expect(hit).not.toBeNull();
    expect(hit.places).toContain("oslo");
    const hit2 = placeCivicHit({ prompt: "Is Norway too expensive?", options: ["Yes", "No"] });
    expect(hit2).not.toBeNull();
  });

  it("reaches option labels, not just the prompt", () => {
    const hit = placeCivicHit({ prompt: "Pick a policy.", options: ["Ban cars in Bergen", "Do nothing"] });
    expect(hit).not.toBeNull();
  });
});

describe("checkBatch", () => {
  it("wants a tone spread on batches of three or more", () => {
    const flat = [daily({ tone: "deep" }), daily({ tone: "deep" }), daily({ tone: "deep" })];
    expect(checkBatch(flat).length).toBeGreaterThan(0);
    const spread = [daily({ tone: "deep" }), daily({ tone: "light" }), daily({ tone: "deep" })];
    expect(checkBatch(spread)).toEqual([]);
  });

  it("flags a batch dominated by one form", () => {
    const mono = Array.from({ length: 4 }, () => daily({ tone: "light" }));
    mono[1].tone = "deep"; // pass the tone rule; fail the form rule
    expect(checkBatch(mono).some((e) => e.includes("binary"))).toBe(true);
  });

  // The feed arm did not exist until the Crossroads review went looking for
  // it: the lane that writes the LARGEST batch of the three had no batch
  // rule at all, so eight votes on one topic printed eight ✓ and no batch
  // line. Both rules are the daily arm's shape, including its 0.75 ceiling.
  const feedQ = (over = {}) => ({ surface: "feed", type: "vote", cat: "food", prompt: "Which?", options: ["A", "B"], ...over });

  it("wants a spread of forms in a feed batch", () => {
    const mono = Array.from({ length: 4 }, (_, i) => feedQ({ cat: ["food", "sport", "music", "tech"][i] }));
    expect(checkBatch(mono).some((e) => e.includes("form vote"))).toBe(true);
    mono[3].type = "dial";
    expect(checkBatch(mono)).toEqual([]);
  });

  it("wants a spread of topics in a feed batch — the regulator picks thin ones for a reason", () => {
    const oneTopic = Array.from({ length: 4 }, (_, i) => feedQ({ type: ["vote", "vote", "dial", "field"][i] }));
    expect(checkBatch(oneTopic).some((e) => e.includes("topic food"))).toBe(true);
  });

  it("lets a batch be mostly one thing, but not almost all of it", () => {
    // Six votes in eight is honest; seven is the lane's whole run reading as
    // one question asked repeatedly.
    const eight = (votes) => Array.from({ length: 8 }, (_, i) => feedQ({
      type: i < votes ? "vote" : "dial", cat: ["food", "sport", "music", "tech", "bigq", "culture", "movies", "event"][i],
    }));
    expect(checkBatch(eight(6))).toEqual([]);
    expect(checkBatch(eight(7)).some((e) => e.includes("form vote"))).toBe(true);
  });

  it("stays quiet on batches smaller than three, where a spread is not a claim", () => {
    expect(checkBatch([feedQ(), feedQ()])).toEqual([]);
  });
});

describe("the corpus itself", () => {
  it("passes every measured bound (the gate's liveness half)", () => {
    const errs = [];
    corpus.specQ.forEach((q) => errs.push(...checkQuestion(q, "daily", corpus).errs));
    corpus.feed.questions.forEach((q) => errs.push(...checkQuestion(q, "feed", corpus).errs));
    corpus.duel.forEach((q) => errs.push(...checkQuestion(q, "duel", corpus).errs));
    corpus.pick.forEach((q) => errs.push(...checkQuestion(q, "pick", corpus).errs));
    corpus.continuum.forEach((q) => errs.push(...checkQuestion(q, "feed", corpus, { texture: true }).errs));
    expect(errs).toEqual([]);
  });

  it("sees the demo pool's continuum entries — the lane's landing strip", () => {
    // The feed lane lands dial/field in the demo pool until the live
    // continuum loop ships; a gate that stopped walking them would let
    // the lane write unreviewed shapes (the pick-data.js precedent).
    expect(corpus.continuum.length).toBeGreaterThanOrEqual(7);
    expect(corpus.continuum.every((q) => q.type === "dial" || q.type === "field")).toBe(true);
  });

  it("provenance is exactly in step with the banks, both directions", () => {
    expect(checkProvenance(corpus).errs).toEqual([]);
  });

  it("an audit shortfall warns and never fails (D212)", () => {
    // The 1-in-20 sample keeps its D162 job retrospectively: a person
    // auditing on their own clock must not be able to turn CI red by
    // falling behind — that was the human gate D212 removed. If the bank
    // currently satisfies the rate, this asserts the quiet case; either
    // way the shortfall must be in `warn`, never `errs`.
    const { errs, warn } = checkProvenance(corpus);
    expect(errs.filter((e) => e.includes("audit"))).toEqual([]);
    for (const w of warn) expect(w).toContain("does not block");
  });

  it("headroom tripwires are quiet today", () => {
    // If this ever fails, do NOT retune the thresholds to green it — the
    // failure IS the tripwire asking for the recorded decision (id scheme,
    // or D30's bank pagination).
    expect(checkHeadroom(corpus).errs).toEqual([]);
  });
});

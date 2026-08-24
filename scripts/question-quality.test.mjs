// question-quality.test.mjs — pins the D97 style-guide gate: the measured
// bounds, the hard-rule-6 tripwire's shape (conjunction, not mention), the
// batch-mix rules, and — the liveness half — that the real corpus passes
// and the provenance join is exactly in step with the banks.
import { describe, it, expect } from "vitest";
import {
  loadCorpus, checkQuestion, checkBatch, checkProvenance, checkHeadroom,
  checkPathGenre, placeCivicHit, PROMPT_MAX, OPTION_SHAPES, FEED_TYPES,
  DIAL_BUCKETS, PATH_AXES, PATH_AXIS_LEGACY,
  windowDays, NOW_TOPIC, WINDOW_MAX_DAYS, tragedyHit, BG_MIN, BG_MAX,
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

// ── the current-events lane (D231) ──
//
// Every rule here is one half of a promise the topic's own name makes: a
// `now` card stops being asked, and it stops soon. The gate is where that
// is true, because the client filter can only ever act on what a window
// says — an unbounded one is served forever and nothing downstream can
// tell it apart from an ordinary card.
describe("the current-events window", () => {
  const nowQ = (over = {}) => ({
    surface: "feed", type: "vote", cat: NOW_TOPIC, core: false,
    prompt: "Petrol is climbing again. Changed how you travel?",
    options: ["Driving less", "No change"],
    from: "2026-08-23", until: "2026-08-29", ...over,
  });
  const win = (q) => checkQuestion(q, "feed", corpus).errs.filter((e) => e.rule === "window");

  it("counts days served, both ends inclusive", () => {
    expect(windowDays("2026-08-23", "2026-08-29")).toBe(7);
    expect(windowDays("2026-08-23", "2026-08-23")).toBe(1);
    // Across a month boundary, and across the DST change no UTC day key has.
    expect(windowDays("2026-08-29", "2026-09-02")).toBe(5);
    expect(windowDays("2026-08-23", undefined)).toBe(null);
  });

  it("passes a well-formed now question", () => {
    expect(checkQuestion(nowQ(), "feed", corpus).errs).toEqual([]);
  });

  it("wants both ends on a now question", () => {
    expect(win(nowQ({ until: undefined })).length).toBe(1);
    expect(win(nowQ({ from: undefined })).length).toBe(1);
  });

  it("bounds the window at both ends", () => {
    expect(win(nowQ({ until: "2026-08-24" })).length).toBe(1);
    expect(win(nowQ({ until: "2026-10-01" })).length).toBe(1);
    // The ceiling itself is legal — a bound refusing its own value is a
    // bound nobody can write against.
    const edge = new Date(Date.parse("2026-08-23T00:00:00Z") + (WINDOW_MAX_DAYS - 1) * 86400000);
    expect(win(nowQ({ until: edge.toISOString().slice(0, 10) }))).toEqual([]);
  });

  it("refuses a window on a topic that is not now", () => {
    expect(win(nowQ({ cat: "event" })).length).toBeGreaterThan(0);
    // …except a sponsored slot, which announces its own window (D195).
    expect(win(nowQ({ cat: "event", sponsor: { buyer: "Ruter" } }))).toEqual([]);
  });

  it("points a prediction at the CALL door", () => {
    const call = (prompt) => checkQuestion(nowQ({ prompt }), "feed", corpus).errs.some((e) => e.rule === "call-shape");
    expect(call("Will the talks restart?")).toBe(true);
    expect(call("Who will win the election?")).toBe(true);
    expect(call("The ceasefire will hold by next week.")).toBe(true);
    // An opinion ABOUT the future is not a call: no rubric can settle it,
    // so there is no outcome to leave a player waiting on (D127).
    expect(call("AI will replace most jobs — agree?")).toBe(false);
    expect(call("Should the strait stay open to everyone?")).toBe(false);
  });

  it("staggers a batch's closes and keeps most windows short", () => {
    const together = [
      nowQ({ from: "2026-08-23", until: "2026-08-27" }),
      nowQ({ from: "2026-08-23", until: "2026-08-27" }),
      nowQ({ from: "2026-08-23", until: "2026-08-28" }),
    ];
    expect(checkBatch(together).some((e) => e.includes("close date"))).toBe(true);

    const slow = [
      nowQ({ from: "2026-08-23", until: "2026-09-05" }),
      nowQ({ from: "2026-08-23", until: "2026-09-06" }),
      nowQ({ from: "2026-08-23", until: "2026-08-27" }),
    ];
    expect(checkBatch(slow).some((e) => e.includes("short end"))).toBe(true);

    // The clean batch has to clear the answer-space rule too (D277), so
    // it carries the sides its stories have rather than three binaries.
    const good = [
      nowQ({ from: "2026-08-23", until: "2026-08-27", options: ["Driving less", "Not yet", "I don't drive"] }),
      nowQ({ from: "2026-08-23", until: "2026-08-29", options: ["About right", "Too far", "Not far enough"] }),
      nowQ({ from: "2026-08-23", until: "2026-09-05" }),
    ];
    expect(checkBatch(good)).toEqual([]);
  });

  // The farm's two batch rules cannot judge this lane, and the point of
  // the exemption is that a legal batch stops tripping them: `now` is
  // single-topic by construction and writes votes only.
  it("does not hold the farm's spread rules against a now batch", () => {
    const batch = Array.from({ length: 4 }, (_, i) => nowQ({
      until: ["2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29"][i],
      // Half carry a third side, which is D277's rule and not the farm's
      // — the exemption this case is about is the TOPIC and FORM spread.
      ...(i % 2 ? { options: ["Driving less", "Not yet", "I don't drive"] } : {}),
    }));
    expect(checkBatch(batch)).toEqual([]);
  });
});

// ── the tragedy tripwire (D235) ──
//
// The owner's rule for the current-events lane, and the reason it is a
// gate rather than a note: news skews to catastrophe, so a lane whose job
// is "what is happening now" meets one most weeks, and the pressure to
// ask the obvious question is highest exactly when asking it is worst.
//
// The false-positive half matters as much as the hit half. A gate that
// blocks "markets crashed 8%" is one whose waivers stop being read, and
// the whole two-tier design exists to keep that from happening.
// D277 — the answer space, as a batch rule for the same reason the window
// spread is one: a single binary is often right, and a whole batch of them
// is a writer's habit rather than a fact about the week.
describe("the current-events batch's answer space", () => {
  const nowB = (n, opts) => Array.from({ length: n }, (_, i) => ({
    surface: "feed", type: "vote", cat: NOW_TOPIC, core: false,
    prompt: `A current story number ${i + 1}. Your read?`,
    options: opts[i],
    from: "2026-08-23", until: `2026-08-2${5 + i}`,
  }));
  const optErrs = (batch) => checkBatch(batch).filter((e) => e.includes("two options"));

  it("refuses a batch that is mostly binary", () => {
    expect(optErrs(nowB(3, [["A", "B"], ["A", "B"], ["A", "B"]])).length).toBe(1);
    expect(optErrs(nowB(3, [["A", "B"], ["A", "B"], ["A", "B", "C"]])).length).toBe(1);
  });

  it("lets a batch through once most stories carry the sides they have", () => {
    expect(optErrs(nowB(3, [["A", "B"], ["A", "B", "C"], ["A", "B", "C", "D"]]))).toEqual([]);
  });

  it("says nothing about a batch too small to show a habit", () => {
    expect(optErrs(nowB(2, [["A", "B"], ["A", "B"]]))).toEqual([]);
  });

  // The rule is the lane's, not the feed's: an ordinary feed batch of
  // binaries is the shipped bank's own shape (90 of its 100 votes) and
  // has never been the complaint.
  it("leaves the ordinary feed lane alone", () => {
    const feedB = nowB(3, [["A", "B"], ["A", "B"], ["A", "B"]])
      .map((q, i) => ({ ...q, cat: ["sport", "food", "tech"][i], from: undefined, until: undefined }));
    expect(optErrs(feedB)).toEqual([]);
  });
});

describe("the tragedy tripwire", () => {
  const nowQ = (over = {}) => ({
    surface: "feed", type: "vote", cat: NOW_TOPIC, core: false,
    prompt: "Crude is near $94. Has the pump changed how you get around?",
    options: ["Driving less already", "No change yet"],
    from: "2026-08-23", until: "2026-08-29", ...over,
  });
  const fires = (q) => checkQuestion(q, "feed", corpus).errs.some((e) => e.rule === "tragedy");

  it("catches the unambiguous words whatever surrounds them", () => {
    for (const prompt of [
      "Was the terror attack preventable?",
      "After the massacre, should the minister resign?",
      "Is what happened in the province a genocide?",
      "Should the hostages' names be published?",
    ]) expect(fires(nowQ({ prompt })), prompt).toBe(true);
  });

  it("catches an event beside a casualty count, which one word alone cannot", () => {
    expect(fires(nowQ({ prompt: "The crash that killed 14 — was the airline at fault?" }))).toBe(true);
    // The cue can hide in an option rather than the prompt.
    expect(fires(nowQ({
      prompt: "Who should answer for the derailment?",
      options: ["The operator", "Nobody — 9 dead was bad luck"],
    }))).toBe(true);
  });

  it("lets honest content through, which is the point of two tiers", () => {
    for (const prompt of [
      // An event word with no toll: the single most likely legitimate
      // current-events question there is.
      "Markets crashed 8% overnight. Panic or noise?",
      "A general strike shut the country down. Fair tactic?",
      "Crude is near $94. Has the pump changed how you get around?",
      // A toll word with no event, in a phrase that has nothing to do with one.
      "A dead heat in the final — replay it, or share the title?",
      "Is the transfer deadline a dead letter now?",
    ]) expect(fires(nowQ({ prompt })), prompt).toBe(false);
  });

  it("spares the learn surface, because a learn card has a right answer", () => {
    // History that names an atrocity is knowledge, not a side to take —
    // the same carve-out the place tripwire makes, for a sharper reason.
    const card = { f: "hist", q: "Who was assassinated in 44 BC?", a: ["Caesar", "Cato", "Sulla", "Crassus"], c: 0, t: 1, p: 55, k: "Roman politics" };
    expect(tragedyHit({ prompt: card.q, options: card.a })).not.toBe(null);
    expect(checkQuestion(card, "learn", corpus).errs.some((e) => e.rule === "tragedy")).toBe(false);
  });

  it("reports which tier caught it, so a waiver can be judged", () => {
    expect(tragedyHit({ prompt: "Was the terror attack preventable?" })).toMatchObject({ kind: "plain" });
    expect(tragedyHit({ prompt: "The crash that killed 14 — who pays?" })).toMatchObject({ kind: "casualty" });
    expect(tragedyHit({ prompt: "Markets crashed 8%. Panic or noise?" })).toBe(null);
  });
});

// ── background, the card's `i` (D277) ────────────────────────────────
//
// The bounds are the demo pool's own, measured — so the cases here are
// mostly about the FLOOR, which is the one that reads as arbitrary and is
// not. A background exists to make a question answerable; one that stops
// short of that promotes the button, opens a sheet, and leaves the reader
// exactly where they were, which is worse than the pale button because it
// has spent the reader's tap.
describe("the background field", () => {
  const bgQ = (bg) => ({
    surface: "feed", type: "vote", cat: "event", core: false,
    prompt: "A verdict landed in a fraud case. Proportionate?",
    options: ["About right", "Too far"],
    ...(bg === undefined ? {} : { bg }),
  });
  const bgErrs = (q) => checkQuestion(q, "feed", corpus).errs.filter((e) => e.rule === "bg");
  const GOOD =
    "The company was the country's largest property developer, financed by pre-selling flats "
    + "that were not yet built, and a court ordered it liquidated after it defaulted.";

  it("passes a well-formed background, and a card with none", () => {
    expect(bgErrs(bgQ(GOOD))).toEqual([]);
    expect(bgErrs(bgQ(undefined))).toEqual([]);
  });

  it("refuses one too short to answer the question with", () => {
    expect(bgErrs(bgQ("It was a big company that went bust.")).length).toBe(1);
    expect(bgErrs(bgQ("x".repeat(BG_MIN - 1))).length).toBe(1);
    expect(bgErrs(bgQ("x".repeat(BG_MIN)))).toEqual([]);
  });

  it("refuses one long enough to be the arguments", () => {
    expect(bgErrs(bgQ("x".repeat(BG_MAX + 1))).length).toBe(1);
    expect(bgErrs(bgQ("x".repeat(BG_MAX)))).toEqual([]);
  });

  it("refuses a background that asks a question back", () => {
    expect(bgErrs(bgQ(GOOD.replace(/\.$/, "?"))).some((e) => e.msg.includes("asks a question"))).toBe(true);
  });

  it("refuses a background that argues, and lets reporting through", () => {
    for (const bg of [
      GOOD + " The sentence should be reduced on appeal.",
      GOOD + " Most economists agree the penalty was excessive.",
      GOOD + " Obviously the court went too far here.",
    ]) expect(bgErrs(bgQ(bg)).some((e) => e.msg.includes("argues")), bg).toBe(true);

    // The register the list must NOT catch: ordinary reporting of what
    // other people did and said, which is most of what a background is.
    for (const bg of [
      GOOD + " Creditors have appealed the ruling.",
      GOOD + " Its bondholders recovered a fraction of what they were owed.",
      GOOD + " The founder denied the charges throughout.",
    ]) expect(bgErrs(bgQ(bg)), bg).toEqual([]);
  });

  // The shipped bank is the corpus this was measured against, so it has to
  // pass its own gate — the same shape every other bound in this file is
  // pinned with.
  it("holds across every background in the bank", () => {
    const withBg = corpus.feed.questions.filter((q) => typeof q.bg === "string");
    expect(withBg.length, "no bank entry carries a background — this case is vacuous").toBeGreaterThan(0);
    for (const q of withBg) {
      expect(bgErrs(q), q.id).toEqual([]);
    }
  });
});

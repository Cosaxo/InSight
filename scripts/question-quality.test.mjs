// question-quality.test.mjs — pins the D97 style-guide gate: the measured
// bounds, the hard-rule-6 tripwire's shape (conjunction, not mention), the
// batch-mix rules, and — the liveness half — that the real corpus passes
// and the provenance join is exactly in step with the banks.
import { describe, it, expect } from "vitest";
import {
  loadCorpus, checkQuestion, checkBatch, checkProvenance, checkHeadroom,
  placeCivicHit, PROMPT_MAX, OPTION_SHAPES,
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
});

describe("the corpus itself", () => {
  it("passes every measured bound (the gate's liveness half)", () => {
    const errs = [];
    corpus.specQ.forEach((q) => errs.push(...checkQuestion(q, "daily", corpus).errs));
    corpus.feed.questions.forEach((q) => errs.push(...checkQuestion(q, "feed", corpus).errs));
    corpus.duel.forEach((q) => errs.push(...checkQuestion(q, "duel", corpus).errs));
    corpus.pick.forEach((q) => errs.push(...checkQuestion(q, "pick", corpus).errs));
    expect(errs).toEqual([]);
  });

  it("provenance is exactly in step with the banks, both directions", () => {
    expect(checkProvenance(corpus)).toEqual([]);
  });

  it("headroom tripwires are quiet today", () => {
    // If this ever fails, do NOT retune the thresholds to green it — the
    // failure IS the tripwire asking for the recorded decision (id scheme,
    // or D30's bank pagination).
    expect(checkHeadroom(corpus).errs).toEqual([]);
  });
});

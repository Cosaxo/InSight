import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  placeCivicHit,
  SUGGEST_PER_DAY,
  SUGGESTION_OPTION_MAX,
  SUGGESTION_OPTIONS_MAX,
  SUGGESTION_PROMPT_MAX,
  validateSuggestion,
} from "./suggestions";

describe("validateSuggestion", () => {
  it("accepts the composer's happy path and normalizes it", () => {
    const r = validateSuggestion({
      prompt: "  Beach holiday or city break?  ",
      type: "binary",
      options: ["Beach", " City break ", ""],
      topic: "travel",
      cadenceHint: "daily",
      credit: true,
    });
    if ("error" in r) throw new Error(r.error);
    expect(r.ok).toEqual({
      prompt: "Beach holiday or city break?",
      type: "binary",
      options: ["Beach", "City break"],
      topicHint: "travel",
      audienceHint: null,
      cadenceHint: "daily",
      credit: true,
    });
  });

  it("requires a prompt and bounds its length", () => {
    expect(validateSuggestion({ prompt: "   " })).toHaveProperty("error");
    expect(
      validateSuggestion({ prompt: "x".repeat(SUGGESTION_PROMPT_MAX + 1) }),
    ).toHaveProperty("error");
    expect(
      validateSuggestion({ prompt: "x".repeat(SUGGESTION_PROMPT_MAX) }),
    ).toHaveProperty("ok");
  });

  it("refuses unknown forms, over-long options, and too many of them", () => {
    expect(validateSuggestion({ prompt: "Hm?", type: "rank" })).toHaveProperty("error");
    expect(
      validateSuggestion({ prompt: "Hm?", options: ["y".repeat(SUGGESTION_OPTION_MAX + 1)] }),
    ).toHaveProperty("error");
    expect(
      validateSuggestion({
        prompt: "Hm?",
        type: "choice",
        options: Array.from({ length: SUGGESTION_OPTIONS_MAX + 1 }, (_, i) => `o${i}`),
      }),
    ).toHaveProperty("error");
  });

  it("drops an unknown cadence rather than storing it, and credit is strictly boolean", () => {
    const r = validateSuggestion({ prompt: "Hm?", cadenceHint: "hourly", credit: "yes" });
    if ("error" in r) throw new Error(r.error);
    expect(r.ok.cadenceHint).toBeNull();
    expect(r.ok.credit).toBe(false);
  });
});

describe("placeCivicHit — the sold-inventory tripwire", () => {
  // The two canonical cases the quality gate's own comment names, plus
  // QUESTION-FARM hard rule 6's second example. They pin the BEHAVIOUR on
  // five inputs; the case at the foot of this block is what pins the copy
  // itself, and the comment here used to claim that job for these three.
  it("fails the place+civic conjunction", () => {
    expect(placeCivicHit("Should Oslo ban cars downtown?", [])).toBe(true);
    expect(placeCivicHit("Is Norway too expensive?", [])).toBe(true);
  });
  it("passes personal flavor — a place without a civic cue, a cue without a place", () => {
    expect(placeCivicHit("One cuisine, forever?", ["Italian", "Japanese", "Mexican"])).toBe(false);
    expect(placeCivicHit("Mountains or sea?", [])).toBe(false);
    expect(placeCivicHit("Should tipping be banned?", ["Yes", "No"])).toBe(false);
  });

  // THE COMMENT ABOVE USED TO SAY THESE CASES WERE "THE TEST THAT SAYS THE
  // OTHER MUST TOO". They are not: five fixed inputs against ONE copy, with
  // nothing comparing the two literals. Measured — cutting this file's
  // PLACES from ~100 names to one and its CIVIC cues from 20 to four, a
  // ~90-name divergence from the script's copy, left both the functions
  // suite and test:scripts green.
  //
  // What diverges is what counts as sold place-scoped civic inventory:
  // suggestions.ts is the door that declines a user's suggestion as that,
  // and question-quality.mjs is the gate that refuses the same shape in the
  // bank. When they disagree, a suggestion the gate would refuse is
  // accepted, or an honest one is declined with a reason that is not true —
  // on the buyer's screen, with no signal anywhere.
  //
  // Both sides say "keep edits in both places" and neither could tell.
  it("carries the same watchlist as the quality gate, name for name", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = {
      door: readFileSync(resolve(here, "suggestions.ts"), "utf8"),
      gate: readFileSync(resolve(here, "../../scripts/question-quality.mjs"), "utf8"),
    };

    // The PLACES words, as a set: the two lists are hand-maintained in the
    // same order today, but a reordering is not a divergence and should not
    // red this.
    const places = (text: string): string[] => {
      const block = /const PLACES = new Set\(\(([\s\S]*?)\)\.split\(" "\)\);/.exec(text);
      expect(block, "the PLACES watchlist could not be found — this test lost its target").toBeTruthy();
      const words = [...block![1].matchAll(/"([^"]*)"/g)].flatMap((m) => m[1].split(" ")).filter(Boolean);
      return [...new Set(words)].sort();
    };
    const civic = (text: string): string => {
      const m = /const CIVIC = (\/.*\/[a-z]*);/.exec(text);
      expect(m, "the CIVIC cue list could not be found — this test lost its target").toBeTruthy();
      return m![1];
    };

    const doorPlaces = places(src.door);
    const gatePlaces = places(src.gate);
    // The vacuity guard, and it is not decoration: without it a regex that
    // stopped matching would hand back two empty arrays, and two empty
    // arrays are equal.
    expect(doorPlaces.length, "the parsed watchlist is implausibly short — the regex is matching the wrong thing").toBeGreaterThan(80);
    expect(doorPlaces).toEqual(gatePlaces);

    const doorCivic = civic(src.door);
    expect(doorCivic.length, "the parsed cue list is implausibly short").toBeGreaterThan(100);
    expect(doorCivic).toBe(civic(src.gate));
  });
});

// ── the budget that paces the queue a human reads ───────────────────
//
// `SUGGEST_PER_DAY` can be set to a million with every suite green: it
// appears in no test at all. Its docstring prices it on D33's spine —
// "review capacity is the binding constraint, and a queue nobody can read
// down is inventory, not participation" — and the refusal a user sees
// quotes the number back at them, so the two move together or the message
// stops being true.
describe("the suggestion budget", () => {
  it("keeps the value its own refusal message quotes", () => {
    expect(SUGGEST_PER_DAY,
      "the daily suggestion budget moved — re-read D33's reasoning and change this line deliberately").toBe(3);
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "suggestions.ts"), "utf8");
    expect(src, "the refusal stopped quoting the budget, so a reader is told a number that is not the bound")
      .toContain("that's ${SUGGEST_PER_DAY} suggestions today");
  });
});

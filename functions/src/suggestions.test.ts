import { describe, expect, it } from "vitest";
import {
  placeCivicHit,
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
  // QUESTION-FARM hard rule 6's second example. These pin the copied
  // watchlist to scripts/question-quality.mjs's behaviour — if either
  // list changes, this is the test that says the other must too.
  it("fails the place+civic conjunction", () => {
    expect(placeCivicHit("Should Oslo ban cars downtown?", [])).toBe(true);
    expect(placeCivicHit("Is Norway too expensive?", [])).toBe(true);
  });
  it("passes personal flavor — a place without a civic cue, a cue without a place", () => {
    expect(placeCivicHit("One cuisine, forever?", ["Italian", "Japanese", "Mexican"])).toBe(false);
    expect(placeCivicHit("Mountains or sea?", [])).toBe(false);
    expect(placeCivicHit("Should tipping be banned?", ["Yes", "No"])).toBe(false);
  });
});

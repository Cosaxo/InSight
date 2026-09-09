// check-pick-crowds.test.mjs — tests for the pick-crowds contract validator
// This gate's failure mode is to not catch a missing CROWD or BY entry,
// or invalid data structure. These tests pin that.

import { describe, it, expect } from "vitest";
import { checkPickCrowds, extractCrowd, extractBy } from "./check-pick-crowds.mjs";

// Minimal valid pick-questions.json structure
const VALID_QUESTIONS = JSON.stringify([
  { id: "pk01", domain: "pokemon", cat: "fav", prompt: "Favorite Pokémon?" },
  { id: "pk02", domain: "pokemon", cat: "fav", prompt: "Scariest Pokémon?" },
]);

// Minimal valid pick-data.js with CROWD and BY objects
const VALID_PICK_DATA = `
  const CROWD = {
    pk01: {
      25: 41, 6: 38, 448: 29, 133: 26, 94: 24,
      7: 19, 1: 17, 143: 12, 778: 9, 658: 7,
      197: 6, 359: 5, 4: 3, 258: 2, 0: 4
    },
    pk02: {
      94: 34, 778: 26, 491: 18, 487: 15, 354: 9,
      93: 8, 442: 7, 356: 6, 425: 5, 635: 5,
      200: 3, 92: 2, 0: 6
    }
  };

  const BY = {
    pk01: {
      ageBand: {
        '18-24': { 448: 14, 25: 8, 778: 6 },
        '25-34': { 25: 15, 6: 13, 94: 10 }
      },
      gender: {
        Women: { 25: 14, 133: 12, 94: 9 },
        Men: { 6: 21, 25: 16, 448: 15 }
      }
    },
    pk02: {
      ageBand: {
        '18-24': { 778: 12, 94: 9, 491: 7 },
        '25-34': { 94: 14, 778: 9, 491: 8 }
      },
      gender: {
        Women: { 778: 14, 94: 10, 354: 5 },
        Men: { 94: 18, 778: 10, 491: 9 }
      }
    }
  };`;

const run = (questions = VALID_QUESTIONS, pickData = VALID_PICK_DATA) => {
  const files = {
    '../content/pick-questions.json': questions,
    '../src/v2/spec/pick-data.js': pickData
  };
  return checkPickCrowds((path) => files[path]);
};

describe("check:pick-crowds", () => {
  it("passes when CROWD and BY are valid and match questions", () => {
    expect(run()).toEqual([]);
  });

  it("catches missing CROWD data for a question", () => {
    const questions = JSON.stringify([
      { id: "pk99", domain: "pokemon", cat: "fav", prompt: "Test?" }
    ]);
    // VALID_PICK_DATA doesn't have pk99, so missing CROWD
    const errors = run(questions, VALID_PICK_DATA);
    expect(errors.join(' ')).toMatch(/pk99.*missing CROWD data/);
  });

  it("allows CROWD data for unannounced questions (they may be in development)", () => {
    const questions = JSON.stringify([
      { id: "pk01", domain: "pokemon", cat: "fav", prompt: "Test?" }
    ]);
    // VALID_PICK_DATA has pk02 but questions don't — this is OK, it's demo data
    const errors = run(questions, VALID_PICK_DATA);
    // Should pass because pk01 has data; pk02 data is just demo
    expect(errors).toEqual([]);
  });

  it("catches invalid entity key in CROWD", () => {
    const badData = VALID_PICK_DATA.replace("25: 41", "'invalid-key': 41");
    const errors = run(VALID_QUESTIONS, badData);
    expect(errors.join(' ')).toMatch(/invalid entity key.*must be numeric/);
  });

  it("catches invalid count in CROWD", () => {
    const badData = VALID_PICK_DATA.replace("25: 41", "25: -5");
    const errors = run(VALID_QUESTIONS, badData);
    expect(errors.join(' ')).toMatch(/invalid count/);
  });

  it("catches CROWD with no entries above floor", () => {
    const questions = JSON.stringify([
      { id: "pk_floor_test", domain: "test", cat: "fav", prompt: "Test?" }
    ]);
    const badData = `
  const CROWD = {
    pk_floor_test: { 0: 5 }
  };
  const BY = { pk_floor_test: { ageBand: { '18-24': { 1: 1 } } } };`;
    const errors = run(questions, badData);
    expect(errors.join(' ')).toMatch(/pk_floor_test.*no entries at or above floor/);
  });

  it("catches CROWD with too few entries above floor", () => {
    const questions = JSON.stringify([
      { id: "pk_floor_test", domain: "test", cat: "fav", prompt: "Test?" }
    ]);
    const badData = `
  const CROWD = {
    pk_floor_test: { 25: 41, 6: 38, 0: 5 }
  };
  const BY = { pk_floor_test: { ageBand: { '18-24': { 25: 14 } } } };`;
    const errors = run(questions, badData);
    expect(errors.join(' ')).toMatch(/pk_floor_test.*too few entries above floor/);
  });

  it("catches missing 'Not listed' bucket in CROWD", () => {
    const questions = JSON.stringify([
      { id: "pk_no_bucket", domain: "test", cat: "fav", prompt: "Test?" }
    ]);
    const badData = `
  const CROWD = {
    pk_no_bucket: { 25: 41, 6: 38, 448: 29, 133: 26, 94: 24, 7: 19, 1: 17 }
  };
  const BY = { pk_no_bucket: { ageBand: { '18-24': { 25: 14 } } } };`;
    const errors = run(questions, badData);
    expect(errors.join(' ')).toMatch(/missing.*Not listed.*bucket.*0/);
  });

  it("catches BY with no corresponding CROWD", () => {
    const questions = JSON.stringify([
      { id: "pk01", domain: "pokemon", cat: "fav", prompt: "Test?" }
    ]);
    const badData = VALID_PICK_DATA.replace(/pk02: \{[^}]*\}/s, ''); // Remove pk02 from CROWD but keep in BY
    const errors = run(questions, badData);
    expect(errors.join(' ')).toMatch(/pk02.*no corresponding CROWD/);
  });

  it("catches BY with no demographic dimensions", () => {
    const questions = JSON.stringify([
      { id: "pk_empty_by", domain: "test", cat: "fav", prompt: "Test?" }
    ]);
    const badData = `
  const CROWD = {
    pk_empty_by: { 25: 41, 6: 38, 448: 29, 133: 26, 94: 24, 7: 19, 1: 17, 143: 12, 0: 4 }
  };
  const BY = {
    pk_empty_by: {}
  };`;
    const errors = run(questions, badData);
    expect(errors.join(' ')).toMatch(/pk_empty_by.*no demographic dimensions/);
  });

  it("catches invalid entity count in BY", () => {
    const badData = VALID_PICK_DATA.replace("'18-24': { 778: 12", "'18-24': { 778: -5");
    const errors = run(VALID_QUESTIONS, badData);
    expect(errors.join(' ')).toMatch(/invalid count/);
  });

  it("catches malformed pick-questions.json", () => {
    const errors = run("not valid json", VALID_PICK_DATA);
    expect(errors.join(' ')).toMatch(/Failed.*pick-questions.json/);
  });

  it("catches malformed CROWD object", () => {
    const badData = VALID_PICK_DATA.replace("const CROWD = {", "const CROWD = {{{");
    const errors = run(VALID_QUESTIONS, badData);
    expect(errors.join(' ')).toMatch(/Failed to parse CROWD/);
  });

  it("verifies extraction functions work independently", () => {
    expect(extractCrowd(VALID_PICK_DATA)).toHaveProperty('pk01');
    expect(extractBy(VALID_PICK_DATA)).toHaveProperty('pk01');

    expect(extractCrowd("no CROWD here")).toBeNull();
    expect(extractBy("no BY here")).toBeNull();
  });
});

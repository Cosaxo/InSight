// check-pick-crowds.test.mjs — tests for the pick-crowds contract validator
// This gate's failure mode is to not catch a missing CROWD or BY entry,
// or invalid data structure. These tests pin that.

import { describe, it, expect } from "vitest";
import { checkPickCrowds, extractCrowd, extractBy, extractPickQs } from "./check-pick-crowds.mjs";

// Minimal valid pick-questions.json structure
const VALID_QUESTIONS = JSON.stringify([
  { id: "pk01", domain: "pokemon", cat: "fav", prompt: "Favorite Pokémon?" },
  { id: "pk02", domain: "pokemon", cat: "fav", prompt: "Scariest Pokémon?" },
]);

// The ARCHIVE block every fixture needs. A board's `domain` is the single
// fact that says which catalogue its keys index into, and it lives in
// pick-data.js rather than in the live bank — `content/pick-questions.json`
// carries only what the promote lane has shipped.
const archive = (...ids) => `
  PICK_QS = [
${ids.map((id) => `    { id: '${id}', cat: 'fav', type: 'pick', domain: 'pokemon', prompt: 'Test?' },`).join('\n')}
  ];`;

// A stand-in pokedex.txt carrying exactly the keys the fixtures below use.
// Same row format the real one has — `key<TAB>name`, keys from 1, a `#`
// comment header — because that format is what the gate parses.
const POKEDEX_KEYS = [
  1, 4, 6, 7, 25, 92, 93, 94, 133, 143, 197, 200, 258,
  354, 356, 359, 425, 442, 448, 487, 491, 635, 658, 778,
];
const POKEDEX = [
  '# fixture catalogue — GENERATED shape, not the committed file.',
  ...POKEDEX_KEYS.map((k) => `${k}\tSpecies ${k}`),
].join('\n');

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
  };` + archive('pk01', 'pk02');

const run = (questions = VALID_QUESTIONS, pickData = VALID_PICK_DATA, catalogues = { 'pokedex.txt': POKEDEX }) => {
  const files = {
    '../content/pick-questions.json': questions,
    '../src/v2/spec/pick-data.js': pickData,
  };
  // CATALOG_FILES.pokemon, spelled out: the gate resolves the name itself,
  // and a fixture that followed it through the map could not catch it
  // resolving the wrong one.
  for (const [file, text] of Object.entries(catalogues)) files[`../public/${file}`] = text;
  // A path with no fixture THROWS here, the way fs.readFileSync does for
  // the real run — a helper returning undefined would let a gate reading a
  // file nobody supplied look like a gate that chose not to read one.
  return checkPickCrowds((path) => {
    if (!(path in files)) throw new Error(`ENOENT: ${path}`);
    return files[path];
  });
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
      { id: "pk_floor_test", domain: "pokemon", cat: "fav", prompt: "Test?" }
    ]);
    const badData = `
  const CROWD = {
    pk_floor_test: { 0: 5 }
  };
  const BY = { pk_floor_test: { ageBand: { '18-24': { 1: 1 } } } };` + archive('pk_floor_test');
    const errors = run(questions, badData);
    expect(errors.join(' ')).toMatch(/pk_floor_test.*no entries at or above floor/);
  });

  it("catches CROWD with too few entries above floor", () => {
    const questions = JSON.stringify([
      { id: "pk_floor_test", domain: "pokemon", cat: "fav", prompt: "Test?" }
    ]);
    const badData = `
  const CROWD = {
    pk_floor_test: { 25: 41, 6: 38, 0: 5 }
  };
  const BY = { pk_floor_test: { ageBand: { '18-24': { 25: 14 } } } };` + archive('pk_floor_test');
    const errors = run(questions, badData);
    expect(errors.join(' ')).toMatch(/pk_floor_test.*too few entries above floor/);
  });

  it("catches missing 'Not listed' bucket in CROWD", () => {
    const questions = JSON.stringify([
      { id: "pk_no_bucket", domain: "pokemon", cat: "fav", prompt: "Test?" }
    ]);
    const badData = `
  const CROWD = {
    pk_no_bucket: { 25: 41, 6: 38, 448: 29, 133: 26, 94: 24, 7: 19, 1: 17 }
  };
  const BY = { pk_no_bucket: { ageBand: { '18-24': { 25: 14 } } } };` + archive('pk_no_bucket');
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
      { id: "pk_empty_by", domain: "pokemon", cat: "fav", prompt: "Test?" }
    ]);
    const badData = `
  const CROWD = {
    pk_empty_by: { 25: 41, 6: 38, 448: 29, 133: 26, 94: 24, 7: 19, 1: 17, 143: 12, 0: 4 }
  };
  const BY = {
    pk_empty_by: {}
  };` + archive('pk_empty_by');
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

  // ── the key is an INDEX, and shape is not membership ──────────────
  //
  // Everything above pins the crowd's arithmetic. These pin the one
  // question it never asked: whether the number names anything. A pick
  // answer is a catalogue key and never a string (docs/CATALOG-QUESTIONS.md),
  // so a board naming a species that does not exist is well-formed data
  // about nobody, and it drew a nameless row on the card.

  it("catches a CROWD key the catalogue does not define", () => {
    // 99999 against a 1025-species Pokédex — numeric, positive, and an
    // index into nothing. This was the whole gap.
    const badData = VALID_PICK_DATA.replace("25: 41", "99999: 41");
    const errors = run(VALID_QUESTIONS, badData);
    expect(errors.join(' ')).toMatch(/CROWD\[pk01\] key 99999 is not in public\/pokedex\.txt/);
  });

  it("exempts the 'Not listed' bucket — key 0 is never a catalogue row", () => {
    // The control, and it has to be explicit: every fixture here carries
    // `0`, so a rule that forgot the exemption would fail the suite for the
    // wrong reason and read as the catalogue check working.
    expect(POKEDEX).not.toMatch(/^0\t/m);
    expect(run()).toEqual([]);
  });

  it("catches a CROWD board that names no question in the archive", () => {
    // No PICK_QS entry means no domain, which means no catalogue — so the
    // board's keys can never be checked. Silent before this rule.
    const badData = VALID_PICK_DATA.replace(archive('pk01', 'pk02'), archive('pk01'));
    const errors = run(VALID_QUESTIONS, badData);
    expect(errors.join(' ')).toMatch(/CROWD\[pk02\] names no question in the pick-data\.js PICK_QS archive/);
  });

  it("catches the live bank and the archive disagreeing about a domain", () => {
    // The rule that makes the rule above trustworthy: a key checked against
    // the wrong catalogue is worse than one checked against none, because it
    // reports clean. check:quality joins seed to archive by id and prompt and
    // says nothing about `domain`.
    const questions = JSON.stringify([
      { id: "pk01", domain: "emoji", cat: "fav", prompt: "Favorite Pokémon?" },
    ]);
    const errors = run(questions, VALID_PICK_DATA);
    expect(errors.join(' ')).toMatch(/pk01 is domain "emoji" in pick-questions\.json and "pokemon" in the pick-data\.js archive/);
  });

  it("treats an unreadable catalogue as a failure, not a skip", () => {
    // The shape this file's own header is about. An empty key set would
    // pass every key under it and print "contract valid".
    const errors = run(VALID_QUESTIONS, VALID_PICK_DATA, {});
    expect(errors.join(' ')).toMatch(/public\/pokedex\.txt could not be read/);
  });

  it("catches a catalogue whose row format stopped matching", () => {
    // Same failure one step in: the file reads, and every line is a comment
    // or a shape this parser does not know, so it yields nothing.
    const errors = run(VALID_QUESTIONS, VALID_PICK_DATA, { 'pokedex.txt': '# header only\n25,Pikachu\n' });
    expect(errors.join(' ')).toMatch(/public\/pokedex\.txt yielded no keys/);
  });

  it("verifies extraction functions work independently", () => {
    expect(extractCrowd(VALID_PICK_DATA)).toHaveProperty('pk01');
    expect(extractBy(VALID_PICK_DATA)).toHaveProperty('pk01');

    expect(extractPickQs(VALID_PICK_DATA).map((q) => q.id)).toEqual(['pk01', 'pk02']);

    expect(extractCrowd("no CROWD here")).toBeNull();
    expect(extractBy("no BY here")).toBeNull();
    expect(extractPickQs("no PICK_QS here")).toBeNull();
  });
});

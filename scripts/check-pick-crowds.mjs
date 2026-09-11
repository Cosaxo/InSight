#!/usr/bin/env node
// check-pick-crowds.mjs — validator for the pick-card crowd contract
// Validates that pick-data.js crowd and segment data are well-formed and match
// the pick-questions.json catalogue. Accumulates errors and reports the first 20.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
// The domain → committed-catalogue map, shared with the content generator
// rather than transcribed. See `catalogueKeys` below for why the PARSER is
// not shared with it.
import { CATALOG_FILES } from './gen-v2content.mjs';

const MAX_ERRORS_TO_REPORT = 20;
const AGG_MIN_N_EXPECTED = 5;

// Extract CROWD object from pick-data.js content (regex-based)
export function extractCrowd(content) {
  const match = content.match(/const CROWD\s*=\s*(\{[\s\S]*?\n\s*\});/);
  if (!match) return null;
  try {
    return eval(`(${match[1]})`);
  } catch (e) {
    throw new Error(`Failed to parse CROWD: ${e.message}`);
  }
}

// Extract BY object from pick-data.js content (regex-based)
export function extractBy(content) {
  const match = content.match(/const BY\s*=\s*(\{[\s\S]*?\n\s*\});/);
  if (!match) return null;
  try {
    return eval(`(${match[1]})`);
  } catch (e) {
    throw new Error(`Failed to parse BY: ${e.message}`);
  }
}

// Extract the PICK_QS archive from pick-data.js content (regex-based).
//
// The ARCHIVE, not the live bank. `content/pick-questions.json` holds only
// what the promote lane has shipped — 24 of the 40 boards below it today —
// and a board's `domain` is the single fact that says which catalogue its
// keys index into. Resolving domains from the live bank alone would leave
// every UNPROMOTED card unchecked, which is precisely the set a bad key is
// born in: the daily catalog-question run appends here first and promotes
// later.
export function extractPickQs(content) {
  const match = content.match(/\bPICK_QS\s*=\s*(\[[\s\S]*?\n\s*\]);/);
  if (!match) return null;
  try {
    return eval(`(${match[1]})`);
  } catch (e) {
    throw new Error(`Failed to parse PICK_QS: ${e.message}`);
  }
}

/**
 * The keys a domain's committed catalogue actually defines, as a Set of
 * numbers, memoised per run. Read through the same injected `readFile` as
 * everything else here, so the suite can hand this gate a fixture tree.
 *
 * THE PARSER IS NOT SHARED with scripts/catalog-art-lib.mjs, deliberately,
 * and that file states the stance in as many words: a gate that shares the
 * builder's code shares its bugs. What IS shared is `CATALOG_FILES` — a
 * gate reading a different file than the generator writes would certify the
 * wrong catalogue, and a second transcription of that map is the drift
 * check-content.mjs already refuses.
 *
 * An unreadable catalogue is an ERROR, never an empty set: this file's own
 * subject is a check that stops checking, and `keys.size === 0` would make
 * every key below it pass.
 */
function catalogueKeys(readFile, domain, cache, errors) {
  if (Object.prototype.hasOwnProperty.call(cache, domain)) return cache[domain];
  const file = CATALOG_FILES[domain];
  if (!file) {
    errors.push(`domain "${domain}" is not a known catalogue domain (CATALOG_FILES, `
      + 'scripts/gen-v2content.mjs; the trigger\'s half is CATALOG_DOMAINS in functions/src/v2.ts)');
    cache[domain] = null;
    return null;
  }
  let text = null;
  try {
    text = readFile(`../public/${file}`);
  } catch {
    // An absent file and an unreadable one are the same fact here, and the
    // message below says which file rather than which errno.
    text = null;
  }
  if (typeof text !== 'string' || text.length === 0) {
    errors.push(`public/${file} could not be read — every ${domain} key below it is then checked `
      + 'against nothing, so this is a failure and not a skip');
    cache[domain] = null;
    return null;
  }
  const keys = new Set();
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const tab = line.indexOf('\t');
    if (tab < 1) continue;
    const key = Number(line.slice(0, tab));
    // `key<TAB>name`, keys from 1 — the format every build-*.mjs writes and
    // docs/CATALOG-QUESTIONS.md pins. 0 is never a row: it is the reveal's
    // "Not listed" bucket, which is why the rule below exempts it.
    if (Number.isInteger(key) && key >= 1) keys.add(key);
  }
  if (keys.size === 0) {
    errors.push(`public/${file} yielded no keys — the row format this gate reads `
      + '(`key<TAB>name`) no longer matches the committed catalogue');
    cache[domain] = null;
    return null;
  }
  cache[domain] = keys;
  return keys;
}

// Main validation function
export function checkPickCrowds(readFile) {
  const errors = [];

  // Parse pick-questions.json
  let questions = {};
  try {
    const qContent = readFile('../content/pick-questions.json');
    const qData = JSON.parse(qContent);
    const qArray = Array.isArray(qData) ? qData : qData.questions || [];
    qArray.forEach(q => {
      questions[q.id] = q;
    });
  } catch (e) {
    errors.push(`Failed to read/parse pick-questions.json: ${e.message}`);
    return errors;
  }

  // Parse pick-data.js
  let pickDataContent;
  try {
    pickDataContent = readFile('../src/v2/spec/pick-data.js');
  } catch (e) {
    errors.push(`Failed to read pick-data.js: ${e.message}`);
    return errors;
  }

  // Extract CROWD and BY objects.
  //
  // A FAILED PARSE IS AN ERROR, NOT AN EMPTY OBJECT. Both extractors return
  // `null` when their `const X = {…}` regex stops matching, and `|| {}`
  // turned that into a clean run over nothing: rule 6 iterates no
  // questions and the gate prints "contract valid". CROWD had partial
  // cover — rule 1 fails a live question with no CROWD entry — and BY had
  // none at all, so the whole of the segment validation could go dark
  // without a word. Measured 2026-09-10: renaming the module-local
  // `const BY` to `const SEGS`, with its two internal readers, is
  // self-consistent and eslint-clean, and it took a segment count of 0
  // from a named failure to exit 0. This is the shape `check-labels.mjs`
  // and `check-anchors.mjs` already refuse to pass on, and the one this
  // file's own subject — a check that stops checking — is made of.
  let crowdData = {};
  let byData = {};
  try {
    crowdData = extractCrowd(pickDataContent);
    if (!crowdData || typeof crowdData !== 'object' || Object.keys(crowdData).length === 0) {
      errors.push('CROWD could not be read from pick-data.js — `const CROWD = {…}` no longer '
        + 'matches this scan. Fix the extractor; a gate reading zero questions reports clean.');
      crowdData = {};
    }
  } catch (e) {
    errors.push(`${e.message}`);
  }
  try {
    byData = extractBy(pickDataContent);
    if (!byData || typeof byData !== 'object' || Object.keys(byData).length === 0) {
      errors.push('BY could not be read from pick-data.js — `const BY = {…}` no longer matches '
        + 'this scan. Fix the extractor; rule 6 would otherwise validate nothing and pass.');
      byData = {};
    }
  } catch (e) {
    errors.push(`${e.message}`);
  }

  // Rule 1: Every live pick question ID should have CROWD data
  Object.keys(questions).forEach(qid => {
    if (!crowdData[qid]) {
      errors.push(`Pick question ${qid} is missing CROWD data`);
    }
  });

  // Rule 2: every CROWD board resolves to a DOMAIN. This is the fact rule 3
  // has to have before it can say anything about a key, and until it was
  // read here nothing in the tree ever asked for it: a board could be added
  // under an id no question uses and be validated against no catalogue at
  // all, silently.
  let archive = [];
  try {
    archive = extractPickQs(pickDataContent);
    if (!Array.isArray(archive) || archive.length === 0) {
      errors.push('PICK_QS could not be read from pick-data.js — `PICK_QS = […]` no longer matches '
        + 'this scan. Fix the extractor; every key check below would otherwise go quiet.');
      archive = [];
    }
  } catch (e) {
    errors.push(`${e.message}`);
    archive = [];
  }
  const domainOf = {};
  archive.forEach(q => { if (q && q.id) domainOf[q.id] = q.domain; });

  // The live bank is a SECOND OPINION, not the source. check:quality joins
  // seed to archive by id and prompt and says nothing about `domain`, so a
  // promoted card whose two copies disagree would have this gate reading one
  // catalogue while the card renders from the other — a key check against
  // the wrong list is worse than none, because it reports clean.
  Object.values(questions).forEach(q => {
    if (q && q.id && q.domain && domainOf[q.id] && domainOf[q.id] !== q.domain) {
      errors.push(`Pick question ${q.id} is domain "${q.domain}" in pick-questions.json and `
        + `"${domainOf[q.id]}" in the pick-data.js archive — one of them names the wrong catalogue`);
    }
  });

  /** domain → Set of keys, filled on demand by `catalogueKeys`. */
  const catalogueCache = {};

  // Rule 3: CROWD data structure validation
  Object.entries(crowdData).forEach(([qid, crowd]) => {
    if (typeof crowd !== 'object' || crowd === null) {
      errors.push(`CROWD[${qid}] is not an object`);
      return;
    }

    const domain = domainOf[qid];
    if (!domain) {
      errors.push(`CROWD[${qid}] names no question in the pick-data.js PICK_QS archive — a board `
        + 'with no domain indexes into no catalogue, so none of its keys can be checked');
    }
    const validKeys = domain ? catalogueKeys(readFile, domain, catalogueCache, errors) : null;

    // Check each entity entry
    Object.entries(crowd).forEach(([entityKey, count]) => {
      // Entity key should be numeric string or "0" for "Not listed"
      if (!/^(0|\d+)$/.test(entityKey)) {
        errors.push(`CROWD[${qid}] has invalid entity key: "${entityKey}" (must be numeric)`);
      } else if (entityKey !== '0' && validKeys && !validKeys.has(Number(entityKey))) {
        // …AND THAT THE NUMBER NAMES SOMETHING. The shape test above was the
        // whole of this rule, and shape is not membership: a key is an index
        // into the domain's committed catalogue and nothing else
        // (docs/CATALOG-QUESTIONS.md — "a key, never a string"), so a board
        // could name a species, an element or a country that does not exist
        // and still read as perfectly well-formed. Measured 2026-09-10:
        // editing pk01's Pikachu from 25 to 99999 — the Pokédex has 1025
        // species — left check:pick-crowds, check:pokedex, check:catalogs,
        // check:content, check:taxonomy, check:quality and check:globals all
        // green, and put a nameless row on the card's leaderboard.
        //
        // BY inherits this for free: rule 6 already refuses a segment key
        // CROWD does not carry, so a segment cannot reach a catalogue this
        // rule has not admitted.
        errors.push(`CROWD[${qid}] key ${entityKey} is not in public/${CATALOG_FILES[domain]} — `
          + `the ${domain} catalogue has no such entry`);
      }

      // Count must be a positive integer
      if (!Number.isInteger(count) || count <= 0) {
        errors.push(`CROWD[${qid}][${entityKey}] has invalid count: ${count} (must be positive integer)`);
      }
    });

    // Rule 4: CROWD should contain entries above and below floor
    const aboveFloor = Object.entries(crowd).filter(([k, v]) => v >= AGG_MIN_N_EXPECTED && k !== '0');
    const notListed = crowd['0'];

    if (aboveFloor.length === 0) {
      errors.push(`CROWD[${qid}] has no entries at or above floor (AGG_MIN_N=${AGG_MIN_N_EXPECTED})`);
    }

    if (aboveFloor.length < 3) {
      errors.push(`CROWD[${qid}] has too few entries above floor (found ${aboveFloor.length}, expected ≥3)`);
    }

    // Rule 5: Should have "Not listed" (key '0') bucket
    if (notListed === undefined) {
      errors.push(`CROWD[${qid}] missing "Not listed" bucket (key '0')`);
    } else if (!Number.isInteger(notListed) || notListed <= 0) {
      errors.push(`CROWD[${qid}]['0'] has invalid count: ${notListed}`);
    }
  });

  // Rule 6: BY (segment) data structure validation
  Object.entries(byData).forEach(([qid, byEntry]) => {
    if (!crowdData[qid]) {
      errors.push(`BY[${qid}] has no corresponding CROWD data`);
    }

    if (typeof byEntry !== 'object' || byEntry === null) {
      errors.push(`BY[${qid}] is not an object`);
      return;
    }

    // BY should have demographic dimensions
    if (Object.keys(byEntry).length === 0) {
      errors.push(`BY[${qid}] has no demographic dimensions`);
    }

    // Check each demographic dimension
    Object.entries(byEntry).forEach(([dim, dimData]) => {
      if (typeof dimData !== 'object' || dimData === null) {
        errors.push(`BY[${qid}][${dim}] is not an object`);
        return;
      }

      // Check each bucket in the dimension
      Object.entries(dimData).forEach(([bucket, entities]) => {
        if (typeof entities !== 'object' || entities === null) {
          errors.push(`BY[${qid}][${dim}][${bucket}] is not an object`);
          return;
        }

        // Check entity counts in bucket
        Object.entries(entities).forEach(([entityKey, count]) => {
          if (!Number.isInteger(count) || count <= 0) {
            errors.push(`BY[${qid}][${dim}][${bucket}][${entityKey}] has invalid count: ${count}`);
            return;
          }
          // AND THE ONE RELATION A SEGMENT HAS TO THE BOARD. Everything
          // above this line checks a segment count's SHAPE — an integer,
          // positive — and nothing checked it against the global count for
          // the same entity, which is the only arithmetic that can make it
          // wrong. A cohort is a subset of the crowd, so its count for an
          // entity cannot exceed the crowd's, and `pick-data.js` states the
          // stronger rule at the head of BY: "segments only ever reorder
          // the published top, never surface their own long tail" (D17).
          //
          // The committed data broke it eight times while this gate printed
          // "contract valid" — including an entity whose global count sits
          // below the board's floor, so `canon()` suppresses it from the
          // leaderboard entirely and `canonSeg()` was showing it to a
          // cohort anyway. Measured 2026-09-10.
          const globalCount = crowdData[qid] && crowdData[qid][entityKey];
          if (globalCount === undefined) {
            errors.push(
              `BY[${qid}][${dim}][${bucket}][${entityKey}] names an entity CROWD[${qid}] does not — `
              + 'a segment can only reorder the published board, never add to it');
          } else if (count > globalCount) {
            errors.push(
              `BY[${qid}][${dim}][${bucket}][${entityKey}] = ${count} exceeds CROWD[${qid}][${entityKey}] = `
              + `${globalCount} — a cohort cannot hold more pickers than the crowd it is part of`);
          }
        });
      });
    });
  });

  return errors;
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const readFile = (relativePath) => {
    const fullPath = path.join(__dirname, relativePath);
    return fs.readFileSync(fullPath, 'utf8');
  };

  const errors = checkPickCrowds(readFile);

  if (errors.length === 0) {
    console.log(`✓ pick-crowds contract valid`);
    process.exit(0);
  } else {
    const reported = errors.slice(0, MAX_ERRORS_TO_REPORT);
    console.error(`✗ pick-crowds contract violations (${errors.length} total, showing first ${reported.length}):`);
    reported.forEach((err, i) => {
      console.error(`  ${i + 1}. ${err}`);
    });
    if (errors.length > MAX_ERRORS_TO_REPORT) {
      console.error(`  ... and ${errors.length - MAX_ERRORS_TO_REPORT} more`);
    }
    process.exit(1);
  }
}

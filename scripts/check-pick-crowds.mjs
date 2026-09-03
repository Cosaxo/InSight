#!/usr/bin/env node
// check-pick-crowds.mjs — validator for the pick-card crowd contract
// Validates that pick-data.js crowd and segment data are well-formed and match
// the pick-questions.json catalogue. Accumulates errors and reports the first 20.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

  // Extract CROWD and BY objects
  let crowdData = {};
  let byData = {};
  try {
    crowdData = extractCrowd(pickDataContent) || {};
  } catch (e) {
    errors.push(`${e.message}`);
  }
  try {
    byData = extractBy(pickDataContent) || {};
  } catch (e) {
    errors.push(`${e.message}`);
  }

  // Rule 1: Every live pick question ID should have CROWD data
  Object.keys(questions).forEach(qid => {
    if (!crowdData[qid]) {
      errors.push(`Pick question ${qid} is missing CROWD data`);
    }
  });

  // Rule 3: CROWD data structure validation
  Object.entries(crowdData).forEach(([qid, crowd]) => {
    if (typeof crowd !== 'object' || crowd === null) {
      errors.push(`CROWD[${qid}] is not an object`);
      return;
    }

    // Check each entity entry
    Object.entries(crowd).forEach(([entityKey, count]) => {
      // Entity key should be numeric string or "0" for "Not listed"
      if (!/^(0|\d+)$/.test(entityKey)) {
        errors.push(`CROWD[${qid}] has invalid entity key: "${entityKey}" (must be numeric)`);
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
          }
        });
      });
    });
  });

  return errors;
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
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

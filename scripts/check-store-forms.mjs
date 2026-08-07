#!/usr/bin/env node
// check-store-forms.mjs — hold design/store/app-privacy.json and
// docs/STORE-FORMS.md to the same answers.
//
// WHY THIS EXISTS. The privacy label now lives in two places on purpose:
// the JSON is what gets pushed, the prose is what gets read and reviewed.
// Two copies of an attestation is exactly the shape that produced the
// "collects no email or name via Google" error — the same claim in three
// documents, wrong in all three, because nothing compared them.
//
// WHAT IT CHECKS, and the limits are the point:
//
//   1. Every type declared collected in the JSON appears in the prose
//      table. A row pushed to Apple that nobody wrote down is the
//      dangerous direction — it is invisible in review.
//   2. Every type the prose lists as collected is in the JSON. The other
//      direction is under-declaring, which is what gets an app pulled.
//   3. PRECISE_LOCATION is never collected. Called out separately because
//      it is one word away from COARSE_LOCATION, it is unobtainable by
//      construction (NSLocationDefaultAccuracyReduced), and a diff that
//      flipped it would read as a typo rather than a policy change.
//   4. tracking.used is false. Tracking gates the entire form and carries
//      an ATT prompt; it should never change as a side effect.
//   5. Every age-rating answer agrees with the prose, KEY AND VALUE.
//
// Rule 5 was added after the age rating failed to push at all. The privacy
// half of app-privacy.json was gated by rules 1-4 from the day it was
// written; the age-rating half in the same file was gated by nothing, and
// this header used to explain why — "those are prose sentences rather than
// table cells, and a checker that pretends to parse them would give false
// confidence".
//
// That was true of the prose as it stood, and it was the wrong conclusion.
// The fix for a table nobody can parse is to write a table, not to stop
// checking. Apple added eight required attributes; the file answered none
// of them; nothing noticed until a live 409 named them one at a time
// (D75). STORE-FORMS.md now carries every attribute keyed by its API name
// with the literal JSON value, so this is an exact comparison rather than a
// pretend one.
//
// It still does NOT check purposes or linkage — those genuinely are prose.
// It also cannot know when Apple ADDS a field, which is the failure that
// produced it: no gate reading this checkout can. What it guarantees is
// narrower and worth having — that the answer a human reviewed and the
// answer that gets pushed are the same answer.
//
// Run: node scripts/check-store-forms.mjs

import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const privacy = JSON.parse(readFileSync(join(root, "design/store/app-privacy.json"), "utf8"));
const prose = readFileSync(join(root, "docs/STORE-FORMS.md"), "utf8");

const errors = [];

// The prose names types in a markdown table as **Bold Case** ("User ID",
// "Coarse Location"). Normalise both sides to SCREAMING_SNAKE so the
// comparison is on the answer rather than on the formatting.
const norm = (s) => s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

// Only the "Collected — declare these five" table. Slicing to that section
// matters: the "Not collected" list names types too, and reading both
// would make every absence look like a presence.
const section = prose.split(/^### Collected/m)[1]?.split(/^### /m)[0] ?? "";
if (!section) {
  errors.push(
    "docs/STORE-FORMS.md: could not find the '### Collected' section.\n"
    + "    If that heading was renamed, update this script — do not delete the\n"
    + "    check, because the two files drifting is the failure it exists for.",
  );
}

const proseTypes = new Set(
  [...section.matchAll(/^\|[^|]*\|\s*\*\*([^*]+)\*\*\s*\|/gm)].map((m) => norm(m[1])),
);
const jsonTypes = new Set(privacy.collected.map((r) => norm(r.type)));

for (const t of jsonTypes) {
  if (!proseTypes.has(t)) {
    errors.push(
      `app-privacy.json declares ${t} collected, but docs/STORE-FORMS.md's\n`
      + "    Collected table does not list it. A row pushed to Apple that nobody\n"
      + "    wrote down is invisible in review — add it to the prose, with why.",
    );
  }
}
for (const t of proseTypes) {
  if (!jsonTypes.has(t)) {
    errors.push(
      `docs/STORE-FORMS.md lists ${t} as collected, but app-privacy.json does\n`
      + "    not declare it. This is the under-declaring direction, which is the\n"
      + "    one that gets an app pulled.",
    );
  }
}

if (jsonTypes.has("PRECISE_LOCATION")) {
  errors.push(
    "app-privacy.json declares PRECISE_LOCATION collected.\n"
    + "    It is unobtainable by construction, not by policy: iOS sets\n"
    + "    NSLocationDefaultAccuracyReduced and never calls\n"
    + "    requestTemporaryFullAccuracy. If that genuinely changed, this check is\n"
    + "    the last thing to update, not the first.",
  );
}

if (privacy.tracking?.used !== false) {
  errors.push(
    "app-privacy.json has tracking.used !== false.\n"
    + "    Tracking gates the whole nutrition label and carries an ATT prompt.\n"
    + "    It should never move as a side effect of another change.",
  );
}

// ── 5. the age rating, key and value ────────────────────────────────
// The table rows look like:
//   | `gunsOrOtherWeapons` | Guns or Other Weapons | `"NONE"` |
// Only the first and last cells are read. The middle one is Apple's label,
// which moves between form revisions and is here for the human.
const ageTable = new Map();
for (const m of prose.matchAll(/^\|\s*`(\w+)`\s*\|[^|]*\|\s*`([^`]+)`\s*\|/gm)) {
  ageTable.set(m[1], m[2]);
}
// $-prefixed keys are commentary for whoever reviews the file. Filtering
// them here rather than stripping them from the JSON keeps each reason next
// to the value it explains, which is the whole reason that file is readable.
const ageJson = Object.entries(privacy.ageRating || {}).filter(([k]) => !k.startsWith("$"));

if (!ageTable.size) {
  errors.push(
    "docs/STORE-FORMS.md has no age-rating table this can read.\n"
    + "    Expected rows shaped `| `fieldName` | label | `value` |`. If the table\n"
    + "    moved, fix the pattern here — do not delete this rule. It exists\n"
    + "    because the age rating was ungated once already, and eight required\n"
    + "    attributes went missing until Apple rejected the whole PATCH.",
  );
}

for (const [key, value] of ageJson) {
  // kidsAgeBand is null and is not a form answer — it is the absence of a
  // Made for Kids band, which the prose states in a sentence because there
  // is no attribute to tabulate.
  if (value === null) continue;
  if (!ageTable.has(key)) {
    errors.push(
      `app-privacy.json answers ageRating.${key}, but docs/STORE-FORMS.md's\n`
      + "    table does not list it. An answer pushed to Apple that nobody wrote\n"
      + "    down is invisible in review — add the row.",
    );
    continue;
  }
  const claimed = ageTable.get(key);
  if (claimed !== JSON.stringify(value)) {
    errors.push(
      `ageRating.${key}: app-privacy.json says ${JSON.stringify(value)},\n`
      + `    docs/STORE-FORMS.md says ${claimed}. One of them is what a human\n`
      + "    approved and the other is what gets pushed; they cannot differ.",
    );
  }
}
for (const key of ageTable.keys()) {
  if (!ageJson.some(([k]) => k === key)) {
    errors.push(
      `docs/STORE-FORMS.md's table answers ${key}, but app-privacy.json does\n`
      + "    not. Apple rejects the whole PATCH for one missing required\n"
      + "    attribute, so a documented answer that never ships blocks every\n"
      + "    other answer with it.",
    );
  }
}

if (errors.length) {
  console.error("\ncheck-store-forms: the two copies of the store answers disagree:\n");
  for (const e of errors) console.error(`  ${e}\n`);
  console.error(
    "  design/store/app-privacy.json is what gets pushed to Apple;\n"
    + "  docs/STORE-FORMS.md is what a human reads before approving it.\n"
    + "  They are two copies of one attestation, which is why they are compared.",
  );
  process.exit(1);
}

console.log(
  `check-store-forms OK — ${jsonTypes.size} collected type(s) and ${ageTable.size} `
  + "age-rating answer(s) agree across app-privacy.json and STORE-FORMS.md; "
  + "tracking off; Precise Location absent.",
);

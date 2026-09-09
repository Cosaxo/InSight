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
//   3. PRECISE_LOCATION agrees with the iOS plist. Called out separately
//      because it is one word away from COARSE_LOCATION and a diff that
//      flipped it would read as a typo rather than a policy change. Until
//      D178 this rule said "never collected"; D175 made that false, and a
//      prohibition reality has moved past is worse than no check — it
//      fires on every correct state until someone deletes it.
//   4. tracking.used is false. Tracking gates the entire form and carries
//      an ATT prompt; it should never change as a side effect.
//   5. Every age-rating answer agrees with the prose, KEY AND VALUE.
//   6. Play's Data Safety form agrees with STORE-FORMS.md §3, row for row.
//   7. The two STORES are told the same thing. Rules 1-6 each hold ONE
//      store's form against its own prose twin; nothing held the two
//      forms against each other, and they are two legal attestations
//      about one app in two vocabularies. A claim can be true on one and
//      absent from the other with every rule above green — which is the
//      state this rule found on the day it was added (see STANDING).
//
// Rule 6 was added 2026-09-01, and what it caught on the way in is the
// argument for it: §3's Precise location row had its columns TRANSPOSED
// against the header — a purpose in the Shared column, a note in the
// Optional column, "No" under Purpose — and had been that way since D175
// added the row. Rules 1-5 could not see it, because until this rule the
// Play half of this file had no machine-readable twin at all: the section
// was prose that nobody could compare to anything. That is the same
// absence rule 5 was added for, one store over.
//
// Nothing here has been FILED yet — D42 parked Play and D345 un-parked it
// onto an ENK, but the Console account does not exist as this is written.
// The rule matters more now than when it was added a few hours earlier,
// for the reason §3 itself gives for existing: the answers were derived
// once from an audited inventory and should not be re-derived under time
// pressure, which is only true if they are still correct when they are
// picked up. §3 carries three answers that are NOT settled — the Shared
// column, App activity, Purchases — and this rule deliberately does not
// arbitrate them; it holds the two copies equal so that whatever is
// decided is decided once.
//
// Rule 7 is a RATCHET rather than a pass/fail sweep, and the reason is
// authority rather than convenience: a store form is one of the four
// things CLAUDE.md puts OUTSIDE the D334 ask, so a routine may not
// rewrite a legal attestation on its own reading of the app. The
// divergences that stand are named in STANDING with what closing each
// would cost, a FOURTH one fails, and docs/OWNER-LIST.md carries the
// decision. The green line prints them, so a passing run still says out
// loud that the two filings disagree.
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
// It checks LINKAGE and PURPOSES too since 2026-09-08. That sentence used
// to read "It still does NOT check purposes or linkage — those genuinely
// are prose", and it had stopped being true: the Collected table carries
// `Linked?` and `Purpose` as their own columns with the same value space
// the JSON uses. Measured before the rule existed — flipping every row to
// `linked: false` with THIRD_PARTY_ADVERTISING purposes was exit 0, while
// contradicting `tracking.used: false` two fields away.
//
// It still cannot know when Apple ADDS a field, which is the failure that
// produced it: no gate reading this checkout can. What it guarantees is
// narrower and worth having — that the answer a human reviewed and the
// answer that gets pushed are the same answer.
//
// Run: node scripts/check-store-forms.mjs

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripXmlComments } from "./strip-comments.mjs";
import { compareSets, findingsOf } from "./lib/compare.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// The idiom check-policy-claims.mjs already uses: run as a gate, import as
// a library of parsers.
const isEntry = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
const privacy = JSON.parse(readFileSync(join(root, "design/store/app-privacy.json"), "utf8"));
const prose = readFileSync(join(root, "docs/STORE-FORMS.md"), "utf8");

const errors = [];

// The prose names types in a markdown table as **Bold Case** ("User ID",
// "Coarse Location"). Normalise both sides to SCREAMING_SNAKE so the
// comparison is on the answer rather than on the formatting.
const norm = (s) => s.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

// ── rule 6's parser ─────────────────────────────────────────────────
// Exported and pure so it can be tested against synthetic markdown. A
// gate parser that silently matches nothing is this repo's recurring
// failure (D179, D197, D275) and the only defence is feeding it input
// whose answer is known.
//
// A cell carries an answer plus, often, a note: "**Yes** (D175)",
// "Optional (Google linking only)", "**Required** (on with no in-app
// switch since D211 — ...)". The answer is what precedes the first
// parenthesis; bold markers are formatting. Everything after is for the
// human and deliberately not compared — pinning a prose note would make
// the gate fire on an edit that improved it.
export const playCell = (cell) => cell.split("(")[0].replace(/\*/g, "").trim();

/**
 * STORE-FORMS.md §3's table as rows. Empty array when the section or its
 * table cannot be found, which the caller must treat as an error rather
 * than as "no rows" — see rule 6's own guard.
 */
export function playRows(md) {
  const section = md.split(/^## 3 · Play Data Safety/m)[1]?.split(/^## /m)[0] ?? "";
  // An em-dash cell is the table's "not applicable", which is a different
  // answer from "No" and must not collapse into one.
  const blank = (v) => (v === "—" || v === "" ? null : v);
  const rows = [];
  for (const line of section.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length !== 5) continue;
    const category = playCell(cells[0]);
    // The header and its separator, skipped by what they say rather than
    // by position — the table could gain a leading paragraph.
    if (!category || /^Play category$/i.test(category) || /^-+$/.test(category)) continue;
    const collected = playCell(cells[1]);
    if (!/^(Yes|No)$/i.test(collected)) continue;
    const shared = blank(playCell(cells[2]));
    rows.push({
      category,
      collected: /^yes$/i.test(collected),
      shared: shared === null ? null : /^yes$/i.test(shared),
      optional: blank(playCell(cells[3])),
      purpose: blank(playCell(cells[4])),
    });
  }
  return rows;
}

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

// Apple's API spells one purpose with a Z and this repo's prose with an S.
// That is not a typo to fix in one place — the JSON has to match Apple's
// field and the prose is British throughout — so the two are reconciled by
// an alias table, and a name in NEITHER column fails loudly rather than
// comparing as itself. A silent pass on an unrecognised purpose is how the
// column would go stale in the direction that gets an app pulled.
const PURPOSE_CANON = {
  APP_FUNCTIONALITY: "APP_FUNCTIONALITY",
  ANALYTICS: "ANALYTICS",
  PRODUCT_PERSONALIZATION: "PRODUCT_PERSONALIZATION",
  PRODUCT_PERSONALISATION: "PRODUCT_PERSONALIZATION",
  DEVELOPER_ADVERTISING: "DEVELOPER_ADVERTISING",
  THIRD_PARTY_ADVERTISING: "THIRD_PARTY_ADVERTISING",
  OTHER_PURPOSES: "OTHER_PURPOSES",
};

/** The Collected table as rows: type, linkage, purposes. */
function collectedRows(md) {
  const out = new Map();
  for (const line of md.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) continue;
    const name = /^\*\*([^*]+)\*\*$/.exec(cells[1]);
    if (!name) continue;
    out.set(norm(name[1]), {
      // `playCell`'s job, and the same reason: a human reads "(D322)" and
      // the comparison must not.
      linked: playCell(cells[2]),
      purposes: playCell(cells[3]).split(",").map((x) => norm(x)).filter(Boolean),
    });
  }
  return out;
}

const proseRows = collectedRows(section);
const proseTypes = new Set(proseRows.keys());
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

// LINKAGE AND PURPOSE, row by row. The two files agreeing on WHICH types
// are collected was never the whole filing: "collected but not linked" and
// "collected for advertising" are different declarations about the same
// type, and only one of each pair is true. Under-declaring linkage is the
// direction that gets an app pulled, and over-declaring a purpose is the
// direction that makes the label a lie — so both are compared, in both
// directions, per type.
for (const r of privacy.collected) {
  const t = norm(r.type);
  const prose = proseRows.get(t);
  if (!prose) continue; // already reported by the type rules above
  const jsonLinked = r.linked === true;
  const proseLinked = /^yes$/i.test(prose.linked);
  if (jsonLinked !== proseLinked) {
    errors.push(
      `${t}: app-privacy.json says linked=${jsonLinked} and docs/STORE-FORMS.md\n`
      + `    says "${prose.linked}". Linked and unlinked are different declarations\n`
      + "    about the same type, and the human reviewed one of them.",
    );
  }
  const canon = (list, where) => list.map((x) => {
    const c = PURPOSE_CANON[x];
    if (!c) {
      errors.push(
        `${t}: ${where} names the purpose ${x}, which this script does not\n`
        + "    recognise. Add it to PURPOSE_CANON with Apple's spelling — an\n"
        + "    unknown purpose comparing as itself is how this column goes stale.",
      );
    }
    return c ?? x;
  });
  const a = [...new Set(canon((r.purposes ?? []).map(norm), "app-privacy.json"))].sort();
  const b = [...new Set(canon(prose.purposes, "docs/STORE-FORMS.md"))].sort();
  if (a.join("+") !== b.join("+")) {
    errors.push(
      `${t}: app-privacy.json declares purposes [${a.join(", ")}] and\n`
      + `    docs/STORE-FORMS.md says [${b.join(", ")}].`,
    );
  }
}

// RULE 3, TURNED AROUND AT D178 — and the reversal is the interesting part.
//
// It used to assert PRECISE_LOCATION is NEVER collected, on the grounds
// that it was unobtainable by construction: iOS shipped
// NSLocationDefaultAccuracyReduced and never asked for full accuracy. Its
// own message said "if that genuinely changed, this check is the last
// thing to update, not the first" — and D175 changed it, deliberately and
// on the owner's explicit go, to give Near a venue-scale radius.
//
// A hard-coded prohibition that reality has moved past is worse than no
// check: it fires on every correct state, so the fix is to silence it, and
// silencing a store-forms gate is how an under-declaration ships. What
// replaces it is a CROSS-CHECK against the thing that actually decides the
// answer — the iOS plist. If the app asks for a precise fix, the label
// must say so; if it stops asking, the label must stop saying so. Neither
// direction can drift now, and this file no longer has an opinion about
// which one is right.
// Comments off first — the pattern below tolerates a comment BETWEEN the
// key and its value, and that is the wrong half. It reads the first
// `<key>` wherever it is, so commenting the whole pair out left this gate
// printing "Precise Location declared, matching the plist" at exit 0 while
// the key it names was not in the shipped app. Store forms are one of the
// four things CLAUDE.md puts outside the D334 ask, so this one is not a
// preference. Same class, same tool, as `check-ios-location`, which reads
// the same file.
const plist = stripXmlComments(readFileSync(join(root, "ios/App/App/Info.plist"), "utf8"));
// `<key>X</key>` followed by `<true/>` or `<false/>`, whitespace and
// comments between them. Reduced accuracy TRUE means the app deliberately
// asks for a coarse fix.
const reduced = /<key>NSLocationDefaultAccuracyReduced<\/key>\s*(?:<!--[\s\S]*?-->\s*)*<(true|false)\/>/
  .exec(plist)?.[1];
if (reduced === undefined) {
  errors.push(
    "ios/App/App/Info.plist: could not read NSLocationDefaultAccuracyReduced.\n"
    + "    That key is what decides the Precise Location answer, so this check\n"
    + "    cannot be silently skipped — fix the pattern, do not delete the rule.",
  );
} else if (reduced === "false" && !jsonTypes.has("PRECISE_LOCATION")) {
  errors.push(
    "iOS asks for a PRECISE fix (NSLocationDefaultAccuracyReduced is false)\n"
    + "    but app-privacy.json does not declare PRECISE_LOCATION. That is the\n"
    + "    under-declaring direction — the one that gets an app pulled.",
  );
} else if (reduced === "true" && jsonTypes.has("PRECISE_LOCATION")) {
  errors.push(
    "app-privacy.json declares PRECISE_LOCATION, but iOS asks for a REDUCED\n"
    + "    fix (NSLocationDefaultAccuracyReduced is true). Over-declaring is the\n"
    + "    safer direction, but it is still two files disagreeing about one\n"
    + "    attestation — decide which is right and move the other.",
  );
}

// …AND THE FILE THE FORMS ARE ANSWERED FROM.
//
// The two rules above hold app-privacy.json to the plist, and they were
// both green while `docs/data-inventory.md` — which calls itself "the
// audited list the store forms are answered from" — still said the app
// declares Coarse location and that FINE is "capped at maxSdkVersion 30".
// D175 uncapped it. So the forms were right, the source they are supposed
// to be derived from was not, and anyone re-answering a form from it would
// have under-declared: the direction SHIP-CHECKLIST calls the one that
// gets an app pulled.
//
// That paragraph is itself a record of the SAME error made once before,
// in the same direction. Twice is a pattern, and a pattern is what a gate
// is for.
if (reduced === "false") {
  const inv = readFileSync(join(root, "docs/data-inventory.md"), "utf8");
  // The CONCLUSION, not the whole paragraph. That paragraph is partly a
  // record of the two times this went wrong, so it quotes the wordings it
  // replaced — and a rule reading the whole thing fires on the history it
  // is written to prevent repeating. Measured: it did, on the very commit
  // that corrected it.
  const para = /What is true today[\s\S]{0,1500}?App Functionality, optional\.\*\*/.exec(inv)?.[0];
  if (!para) {
    errors.push(
      "docs/data-inventory.md: could not find the Location paragraph's "
      + "\"What is true today\" conclusion. It is what a store form is answered from, "
      + "so this rule cannot be silently skipped — fix the pattern.",
    );
  } else if (!/\bPrecise\b/.test(para)) {
    errors.push(
      "iOS asks for a PRECISE fix, and docs/data-inventory.md's Location "
      + "paragraph does not say Precise. The store forms are answered FROM "
      + "that file, so it under-declares even while the forms are right — "
      + "which is exactly what that paragraph's own history records.",
    );
  } else if (/maxSdkVersion=?.?30/.test(para)) {
    errors.push(
      "docs/data-inventory.md still describes ACCESS_FINE_LOCATION as capped "
      + "at maxSdkVersion 30. D175 uncapped it, and the manifest line says so "
      + "in its own comment.",
    );
  }
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

// ── 6. Play's Data Safety form against §3 ───────────────────────────
// Total in both directions, unlike rules 1-2, which compare only the
// collected SET. Play's table is small enough to hold whole, and the
// failure that produced this rule was inside a row rather than a missing
// one — a set comparison would have been green through all of it.
const playJson = JSON.parse(
  readFileSync(join(root, "design/store/play-data-safety.json"), "utf8"),
);
const playProse = playRows(prose);

if (!playProse.length) {
  errors.push(
    "docs/STORE-FORMS.md: could not read §3's Play Data Safety table.\n"
    + "    Expected `## 3 · Play Data Safety` followed by a five-column table.\n"
    + "    If that section moved or was renamed, fix the pattern here — do not\n"
    + "    delete the rule. A parser that matches nothing reports no rows and\n"
    + "    calls it agreement, which is how three earlier gates went quiet.",
  );
} else {
  const key = (r) => norm(r.category);
  const proseByKey = new Map(playProse.map((r) => [key(r), r]));
  const jsonByKey = new Map((playJson.rows ?? []).map((r) => [key(r), r]));

  for (const [k, jr] of jsonByKey) {
    const pr = proseByKey.get(k);
    if (!pr) {
      errors.push(
        `play-data-safety.json has a row for ${k}, but docs/STORE-FORMS.md §3's\n`
        + "    table does not. The filing and the reasoning behind it have to be\n"
        + "    the same list — add the row, with why.",
      );
      continue;
    }
    for (const field of ["collected", "shared", "optional", "purpose"]) {
      const a = jr[field] ?? null;
      const b = pr[field] ?? null;
      const same = typeof a === "string" && typeof b === "string"
        ? a.toLowerCase() === b.toLowerCase()
        : a === b;
      if (!same) {
        errors.push(
          `${k}.${field}: play-data-safety.json says ${JSON.stringify(a)},\n`
          + `    docs/STORE-FORMS.md §3 says ${JSON.stringify(b)}. One of them is\n`
          + "    what a human reviewed and the other is what would be filed. This\n"
          + "    is the rule that catches a cell under the wrong header.",
        );
      }
    }
  }
  for (const k of proseByKey.keys()) {
    if (!jsonByKey.has(k)) {
      errors.push(
        `docs/STORE-FORMS.md §3 has a row for ${k}, but play-data-safety.json\n`
        + "    does not. A documented answer with no machine-readable twin is\n"
        + "    exactly the state rule 6 was added to end.",
      );
    }
  }

  // The deletion URL is enforced by Play independently of the rest of the
  // form, so a missing or non-https value is its own failure rather than a
  // row mismatch. It cannot be checked for reachability from here; what it
  // CAN be held to is that the page it names exists in this tree.
  const url = playJson.deletionRequestUrl ?? "";
  if (!/^https:\/\/\S+$/.test(url)) {
    errors.push(
      "play-data-safety.json: deletionRequestUrl must be an https URL.\n"
      + "    Play requires every app offering account creation to publish a web\n"
      + "    deletion route, reachable without installing the app, and enforces\n"
      + "    it separately from every row above.",
    );
  } else {
    const page = url.split("/").pop();
    if (page && !existsSync(join(root, "web", page))) {
      errors.push(
        `play-data-safety.json points deletionRequestUrl at ${page}, which is\n`
        + "    not in web/. The URL is hosted from that directory, so a rename\n"
        + "    there is a dead link on a filed form.",
      );
    }
  }
}

// ── rule 7: the two STORES must be told the same thing (D-2026-09-09-c) ──
//
// Rules 1-6 hold each store's form against its own prose twin. Nothing
// held the two FORMS against each other, and that is a different property:
// app-privacy.json and play-data-safety.json are two legal attestations
// about one app, filed with two companies, in two vocabularies. A claim
// can be true on one and absent from the other and every gate stays green
// — which is the state this rule found on the day it was written.
//
// THE VOCABULARIES DO NOT MATCH, so the mapping below is a judgement and
// is written out rather than inferred. Apple names a data TYPE; Play names
// a category and splits Apple's single SENSITIVE_INFO across several rows.
// Only Apple types that have a Play counterpart are compared; a type with
// no counterpart is listed in NO_PLAY_ROW with the reason, so "we decided
// this does not map" and "we forgot" stay distinguishable.
//
// AND IT IS A RATCHET, NOT A PASS/FAIL SWEEP, for a reason that is about
// authority rather than convenience: the divergences it found are real,
// and a store form is one of the four things CLAUDE.md puts OUTSIDE the
// D334 ask — a routine may not rewrite a legal attestation on its own
// reading of the app. So the three standing divergences are named here
// with what each one would cost to close, the gate refuses a FOURTH, and
// docs/OWNER-LIST.md carries the decision. Closing one is deleting its
// line from this list; the gate then holds it closed.
const APPLE_TO_PLAY = {
  USER_ID: "Personal info → User IDs",
  EMAIL_ADDRESS: "Personal info → Email address",
  NAME: "Personal info → Name",
  COARSE_LOCATION: "Location → Approximate location",
  PRECISE_LOCATION: "Location → Precise location",
  PHOTOS_OR_VIDEOS: "Photos and videos → Photos",
  CRASH_DATA: "App info & performance → Crash logs",
  // Apple has ONE sensitive bucket; Play enumerates. The political/
  // religious row is the one D330/D331 built the consent for, so it is
  // the counterpart that must exist.
  SENSITIVE_INFO: "Personal info → Political or religious beliefs",
};

/** Apple types with no Play counterpart, and why — so a missing mapping
 *  reads as a decision rather than as an oversight. */
const NO_PLAY_ROW = {
  // Play files user-generated content and in-app interaction under its
  // "App activity" family, which this form answers as one combined row.
  // That row is the second standing divergence below, so the types are
  // excluded from the name-level map and handled there explicitly.
  OTHER_USER_CONTENT: "Play folds it into the App activity family (see the standing divergence)",
  PRODUCT_INTERACTION: "same — Play's App activity family",
};

/**
 * The divergences that stand today, each with what closing it costs.
 * SHRINK-ONLY: a new one fails this gate. Every line is an owner decision
 * about a filing, not a code change.
 */
const STANDING = new Set([
  // 1. Apple's collected list carries HEALTH_AND_FITNESS/HEALTH; the Play
  //    form has no "Health and fitness" row at all. One of the two
  //    filings is wrong about the same app. Closing it is either a Play
  //    row (if the height band and the wellbeing items are health data)
  //    or removing the Apple type (if they are not) — a reading of the
  //    app that belongs to the owner, not to a gate.
  "HEALTH",
  // 2. Apple is told OTHER_USER_CONTENT and PRODUCT_INTERACTION are
  //    collected — answers, takes, and the interest profile that sizes
  //    the feed's topic pages (D322). The Play form answers its combined
  //    App-activity row as NOT collected. These are the same facts about
  //    the same app in two vocabularies, and they contradict.
  //
  //    This is the wider of the two and the one that reads worst: "App
  //    activity — not collected" is a strong claim about an app whose
  //    product IS the activity. Closing it means splitting the Play form's
  //    combined row so App activity can answer Yes while Web browsing,
  //    Contacts, Financial and Purchases stay No.
  "APP_ACTIVITY",
]);

{
  const appleTypes = new Set(privacy.collected.map((r) => r.type));
  const playCategories = new Set(
    (playJson.rows ?? []).filter((r) => r.collected === true).map((r) => r.category),
  );

  // (a) name-level: every mapped Apple type has its Play row collected.
  const mappedApple = [...appleTypes]
    .filter((t) => APPLE_TO_PLAY[t])
    .map((t) => APPLE_TO_PLAY[t]);
  const cross = compareSets(
    { name: "app-privacy.json (Apple)", items: mappedApple },
    { name: "play-data-safety.json (Play)", items: [...playCategories] },
  );
  for (const line of findingsOf(cross, {
    onlyLeft: "declared collected to Apple but NOT to Play",
  })) {
    // onlyRight is not an error: Play splits Apple's sensitive bucket, so
    // Gender is a legitimate Play row with no Apple type of its own.
    if (line.startsWith("declared collected to Apple")) errors.push(line);
  }

  // (b) the unmapped Apple types, against the standing list.
  for (const t of appleTypes) {
    if (APPLE_TO_PLAY[t] || NO_PLAY_ROW[t] || STANDING.has(t)) continue;
    errors.push(
      `app-privacy.json declares ${t} and play-data-safety.json has no counterpart,\n`
      + "    and nothing in check-store-forms says why. Two filings about one app\n"
      + "    disagreeing is the failure this rule exists for: add the Play row, map\n"
      + "    the type in APPLE_TO_PLAY, or record the divergence in STANDING with\n"
      + "    what closing it would cost — and put it on docs/OWNER-LIST.md, because\n"
      + "    a store form is outside what a routine may decide.",
    );
  }

  // (c) the App activity contradiction, which is a VALUE disagreement
  // rather than a missing row and so cannot be seen by (a) or (b): Apple
  // is told this app collects user content and product interaction, and
  // the same page of the Play form says App activity is not collected.
  const appActivity = (playJson.rows ?? []).find((r) => /App activity/.test(r.category ?? ""));
  const appleSaysActivity = appleTypes.has("OTHER_USER_CONTENT") || appleTypes.has("PRODUCT_INTERACTION");
  if (appleSaysActivity && appActivity && appActivity.collected === false && !STANDING.has("APP_ACTIVITY")) {
    errors.push(
      "app-privacy.json declares OTHER_USER_CONTENT/PRODUCT_INTERACTION collected while\n"
      + `    play-data-safety.json answers ${JSON.stringify(appActivity.category)} as NOT collected.\n`
      + "    Answers, takes and the interest profile are the product; one of the two\n"
      + "    filings is wrong. Owner's call (docs/OWNER-LIST.md) — add APP_ACTIVITY to\n"
      + "    STANDING with its reasoning if it is to wait.",
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
  // Guarded so importing this module for its parsers cannot kill a test
  // run. The report above still prints either way.
  if (isEntry) process.exit(1);
}

console.log(
  `check-store-forms OK — ${jsonTypes.size} collected type(s) (name, linkage, purposes) and ${ageTable.size} `
  + "age-rating answer(s) agree across app-privacy.json and STORE-FORMS.md; "
  + `tracking off; Precise Location ${jsonTypes.has("PRECISE_LOCATION") ? "declared" : "absent"}, matching the plist; `
  // The Play count is REPORTED, not just checked. A parser that quietly
  // stops matching reports zero rows and passes every comparison — the
  // D275 shape exactly — so the number goes in the success line where a
  // reader sees it fall.
  + `${playProse.length} Play row(s) agree across play-data-safety.json and §3; `
  // Rule 7's own line. The two filings are named, the compared count is
  // printed (a mapping that silently stops matching reports zero and
  // passes — the D275 shape), and the standing divergences are named
  // rather than merely tolerated, so a green run still says out loud that
  // two legal attestations about this app do not agree.
  + `${Object.keys(APPLE_TO_PLAY).length} Apple type(s) mapped to Play rows, `
  + `${STANDING.size} divergence(s) standing (${[...STANDING].join(", ")}) — docs/OWNER-LIST.md.`,
);

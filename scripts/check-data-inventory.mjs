#!/usr/bin/env node
// check-data-inventory.mjs — every collection the rules grant access to
// appears in docs/data-inventory.md.
//
// WHY THIS EXISTS. `data-inventory.md` is what design/store/app-privacy.json
// says its answers have to agree with, and app-privacy.json is the App Store
// privacy label — a legal statement about what the app collects. So the
// inventory is the bottom of that stack, and nothing was holding it to the
// code. It went stale the ordinary way: a feature ships a collection, the
// rules learn about it because they must, and the document that feeds the
// filing does not, because nothing fails when it doesn't.
//
// D130 found three at once on the build-12 pre-flight, all shipped between
// builds 11 and 12 and none of them exotic: the D122 handle registry
// (world-readable), D122's circle invitations, and D126's foresight
// verdicts (world-readable, under the user's own document). No declared
// label ANSWER was wrong — all three fall under types already declared Yes
// — which is exactly why nobody noticed, and exactly why a gate is worth
// more here than a resolution to be careful. D116 made that argument for
// public copy and built check-public-copy.mjs; this is the same argument
// one layer down, and D106 → D116 is the evidence that the discipline
// version does not hold.
//
// RULE 1 — the NAME check, the same class as check:globals. Every
// `match /X/{…}` in firestore.rules names a collection; each name must
// appear somewhere in docs/data-inventory.md. What it guarantees is narrow
// and is the thing that failed at D130: a collection cannot ship without
// the inventory at least naming it.
//
// RULE 2 — the READER check, added D257, because rule 1's stated limit
// ("it does NOT read the row, verify who the row says may read it, or
// notice a row that has gone stale in place") turned out to be describing
// two live errors rather than an acceptable gap. `reveals` was documented
// member-scoped and had been world-readable since D98; sealed duel answers
// were documented world-readable and are owner-only. Both wrong, in
// opposite directions, in the file the App Store filing derives from.
//
// The reason rule 1 declined this is real and the answer is to check LESS,
// not to check loosely: "who may read this" is a general question about a
// rules expression and cannot be decided by a script. So rule 2 decides
// nothing. It classifies a read condition ONLY when the whole condition is
// one of two literal forms —
//
//     request.auth != null   → PUBLIC   (row must say "any signed-in user")
//     false                  → NOBODY   (row must say "nobody"/"no one")
//
// — and skips every collection whose read rules are anything else, or whose
// read rules do not all classify the same way. That leaves the interesting
// arms (`answers`, `v2_groups`, `v2_takes`, `invites`) unchecked on purpose:
// they are conditional per document, so no single sentence in a table is
// their answer anyway. 27 rows are covered on the tree this landed against,
// and the two errors above are both inside that set — one of them by
// classification, the other because correcting it made the answers row
// terminal collection honest.
//
// A row is attributed to a collection by the LAST known collection name in
// its first backticked path (`v2_users/{uid}/push/tokens` → `push`), with
// "same subcollection…" inheriting from the row above, which is how the
// document is actually written. A row that names no known collection is
// skipped rather than guessed at — the device-local and Sentry rows are
// not Firestore and have no rule to be held to.
//
// It cannot see collections that exist only in Cloud Functions with no
// rules block, because those have no client access path to grant. That is
// a real gap and a deliberate one: server-only working state is not what
// the privacy label asks about. Anything a client can read or write has a
// match block by construction, and that is the set this guards.
//
// Run: node scripts/check-data-inventory.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RULES = join(ROOT, "firestore.rules");
const INVENTORY = join(ROOT, "docs/data-inventory.md");

// Names that appear as a `match` path but are not user data. Each carries
// the reason it cannot be a row, in the shape check:appcheck uses for its
// exemptions — an unexplained entry here is how a gate becomes a rubber
// stamp, so the script refuses one (see below).
const EXEMPT = {
  databases:
    "Not a collection. `match /databases/{database}/documents` is the wrapper every rules file opens with, and it matches the same shape as a collection path.",
  v2_questions:
    "The question BANK — content the app ships, not data it collects from anyone. Client-read-only, server-seeded (seedContentV2). Its drift gates are check:catalogs and check:figures, which read the bank itself.",
  v2_meta:
    "Global app config (minBuild and friends). World-readable, server-written, and holds nothing about any person.",
  v2_velocity:
    "A single global document, `v2_velocity/state` — the daily ledger scan's cursor (D54). Server-only, one doc for the whole app, not per-uid.",
};

const rules = readFileSync(RULES, "utf8");
const inventory = readFileSync(INVENTORY, "utf8");

// Every match path segment that looks like a collection: `match /X/{…}`.
// Subcollections match the same way and are wanted — `invites` and
// `foresight` are both nested, and both were missing when this was written.
const named = new Set();
for (const m of rules.matchAll(/match\s+\/([A-Za-z0-9_]+)\/\{/g)) named.add(m[1]);

const collections = [...named].sort();
const problems = [];

// An exemption for a name the rules no longer mention is a stale excuse,
// and it is the failure mode of every allowlist: the list outlives the
// thing it excused and quietly starts excusing something else.
for (const name of Object.keys(EXEMPT)) {
  if (!named.has(name)) {
    problems.push(
      `stale exemption: "${name}" is exempted here but has no match block in firestore.rules.\n` +
        `    → remove it from EXEMPT in ${"scripts/check-data-inventory.mjs"}`,
    );
  }
  if (!EXEMPT[name] || !EXEMPT[name].trim()) {
    problems.push(`exemption "${name}" carries no reason — an unexplained exemption is not one`);
  }
}

const missing = collections.filter((c) => !(c in EXEMPT) && !inventory.includes(c));
for (const name of missing) {
  problems.push(
    `${name} is reachable through firestore.rules but is not named in docs/data-inventory.md\n` +
      `    → add a row (what it holds, where it lives, who may read it, how it is erased),\n` +
      `      or exempt it in EXEMPT with the reason it is not user data.`,
  );
}

// ── rule 2: the reader column, where the rule states it unambiguously ──

// Classify every `allow read` by its WHOLE condition, and only when that
// condition is one of two literal forms. A rules expression is not
// something a regex may interpret; these two are recognised the way a
// string literal is, not parsed.
export function classifyReads(src) {
  // Comments first: `// allow read: if false` inside a paragraph of
  // reasoning is prose, and this file has a great deal of both.
  const clean = src.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
  const stack = [];
  const byName = new Map();
  let depth = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === "{") { depth++; continue; }
    if (ch === "}") {
      depth--;
      while (stack.length && stack[stack.length - 1].depth > depth) stack.pop();
      continue;
    }
    const rest = clean.slice(i, i + 220);
    // A plain collection match, and the collection-group form
    // (`match /{path=**}/answers/{aid}`) — the second one matters because
    // without it the group read lands on whatever block encloses it and
    // that block gets a classification it never wrote.
    const open = /^match\s+\/([A-Za-z0-9_]+)\/\{/.exec(rest)
      || /^match\s+\/\{[A-Za-z0-9_]+=\*\*\}\/([A-Za-z0-9_]+)\/\{/.exec(rest);
    if (open) {
      // The two regexes above end on the `{` of a WILDCARD SEGMENT
      // (`/{uid}`), not on the brace that opens the block — a path is
      // `/v2_users/{uid} {`, so their match stops seventeen characters
      // early. Advancing by their length therefore leaves the wildcard's
      // closing `}` to be read as a block close, and the first version of
      // this compensated with a manual `depth++` that balanced only while
      // no match was nested inside another. With one nested, the parent's
      // own `allow read` was attributed to the CHILD — silently, since a
      // name with two classifications is skipped, so `v2_users` and its
      // last subcollection would both have dropped out of rule 2 with
      // nothing failing. Verified against a five-line fixture before and
      // after.
      //
      // So: consume the whole header instead — every `/segment`, literal
      // or wildcard, up to and including the block's own `{` — and leave
      // the depth arithmetic entirely to the two brace branches above.
      // `- 2` lands the next iteration ON that brace.
      const header = /^match\s+(?:\/(?:[A-Za-z0-9_$]+|\{[A-Za-z0-9_]+(?:=\*\*)?\}))+\s*\{/.exec(rest);
      if (!header) throw new Error(`check-data-inventory: unparsable match header at "${rest.slice(0, 60)}"`);
      stack.push({ name: open[1], depth: depth + 1 });
      i += header[0].length - 2;
      continue;
    }
    const allow = /^allow\s+([a-z,\s]*?):\s*if\s+/.exec(rest);
    if (allow && /\bread\b|\bget\b|\blist\b/.test(allow[1])) {
      const end = clean.indexOf(";", i + allow[0].length);
      const cond = clean.slice(i + allow[0].length, end).replace(/\s+/g, " ").trim();
      const cls = cond === "request.auth != null" ? "PUBLIC" : cond === "false" ? "NOBODY" : "OTHER";
      const name = stack.length ? stack[stack.length - 1].name : "(root)";
      if (!byName.has(name)) byName.set(name, new Set());
      byName.get(name).add(cls);
      i = end;
    }
  }
  return byName;
}

// A row's collection: the last KNOWN collection name in its first
// backticked path, so `v2_users/{uid}/push/tokens` attributes to `push`
// rather than to the document id at the end of it.
export function inventoryRows(md, known) {
  const out = [];
  let last = null;
  for (const line of md.split("\n")) {
    if (!line.startsWith("|") || line.startsWith("|---") || line.startsWith("| Data")) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    const where = cells[1] || "";
    let coll = null;
    for (const m of where.matchAll(/`([^`]+)`/g)) {
      const segs = m[1].split("/").filter((sg) => !sg.startsWith("{"));
      for (let k = segs.length - 1; k >= 0; k--) if (known.has(segs[k])) { coll = segs[k]; break; }
      if (coll) break;
    }
    if (!coll && /^same\b/i.test(where)) coll = last;
    if (coll) last = coll;
    out.push({ label: cells[0], coll, reader: cells[2] || "" });
  }
  return out;
}

/**
 * The read audience a row must be held to, from every `allow read` on its
 * collection.
 *
 * THE WIDEST GRANT DECIDES, and the first version of this asked for
 * "exactly one classification" instead. That made the gate lose rows for a
 * change that widened nothing: the day the follow graph gained a narrow
 * collection-group arm beside its open path arm, {PUBLIC, OTHER} stopped
 * being exactly one and the row dropped out of the checked set, 31 to 30 —
 * silently, which is rule 2's whole failure mode.
 *
 * Widest is also the only sound reading. An extra rule can only ever add
 * readers, so a PUBLIC arm means any signed-in user may read the
 * collection whatever sits beside it, and NOBODY stands only when EVERY
 * arm is `if false` — one conditional arm beside it means somebody can
 * read it, and "nobody" is then a false claim. Anything else is declined.
 */
export function widestRead(classes) {
  if (!classes || !classes.size) return "OTHER";
  if (classes.has("PUBLIC")) return "PUBLIC";
  return [...classes].every((c) => c === "NOBODY") ? "NOBODY" : "OTHER";
}

export const SAYS_PUBLIC = /any signed-in user|anyone signed in/i;
export const SAYS_NOBODY = /\bnobody\b|\bno one\b/i;

// A RATCHET, not a floor, and the difference is the whole point.
//
// Rule 2's failure mode is silence: every way it can stop working — a
// parser that mis-attributes, a `Where` cell that stops naming its path, a
// read rule edited into a form this declines to read — takes rows OUT of
// the checked set and leaves the gate green. A floor catches that only
// while it is level with the tree, and this one has now drifted below the
// tree TWICE. It sat four low after D257, was raised to 31 on 2026-08-26,
// and the tree reached 32 at D316–D322 with nothing saying so. Each gap is
// that many rows rule 2 could lose while still reporting OK — the very
// failure the number exists to announce.
//
// "The number can rise freely" was the bug. A floor that may silently rise
// is a floor that silently stops being one, because the slack is invisible
// and only ever grows. So it is held as an EQUALITY in both directions,
// the shape check:globals rule 4 already uses for its coupling count:
// FEWER rows means something was lost and you find out which, and MORE
// means the gate now covers more than the number claims and the number
// comes up in the same commit that earned it. Either way the drift is a
// red build rather than a quiet allowance.
const READER_EXPECTED = 32;
const readClasses = classifyReads(rules);
let readerChecked = 0;
for (const row of inventoryRows(inventory, named)) {
  if (!row.coll) continue;
  const only = widestRead(readClasses.get(row.coll));
  if (only === "OTHER") continue;
  readerChecked++;
  const agrees = only === "PUBLIC" ? SAYS_PUBLIC.test(row.reader) : SAYS_NOBODY.test(row.reader);
  if (agrees) continue;
  problems.push(
    `${row.coll}: firestore.rules grants read to ` +
      `${only === "PUBLIC" ? "ANY SIGNED-IN USER (`if request.auth != null`)" : "NOBODY (`if false`)"},\n` +
      `    but the row "${row.label}" says: ${row.reader}\n` +
      `    → correct the row, or the rule. This gate reads only the two ` +
      `literal conditions above;\n      anything conditional is skipped, so a ` +
      `disagreement here is not a judgement call.`,
  );
}

// ── CLI ──
// The floor goes here and not below the report, which is where it first
// landed — `problems` is read once, by the block underneath, so a push
// after it is a finding nothing prints and an exit code that stays 0. A
// gate against silent loss that failed silently; the CLI marker was moved
// above an existing block rather than the block being moved under it.
if (readerChecked < READER_EXPECTED) {
  problems.push(
    `rule 2 covered ${readerChecked} row(s), down from ${READER_EXPECTED}.\n` +
      `    A row leaves the checked set silently — a read rule edited into a form\n` +
      `    this declines to read, a \`Where\` cell that stopped naming its path, or a\n` +
      `    parser that mis-attributed it. Find which, then lower READER_EXPECTED\n` +
      `    deliberately if the loss is correct.`,
  );
} else if (readerChecked > READER_EXPECTED) {
  problems.push(
    `rule 2 covered ${readerChecked} row(s), up from ${READER_EXPECTED}.\n` +
      `    Nothing is broken — the gate now checks MORE than its number claims.\n` +
      `    Raise READER_EXPECTED to ${readerChecked} in this same commit. The\n` +
      `    number is a ratchet rather than a floor precisely because letting it\n` +
      `    rise quietly is how it drifted below the tree twice, and slack here is\n` +
      `    rows rule 2 can lose while still reporting OK.`,
  );
}

// Guarded so a test can import the two parsers above without the report
// running (and, on a failure, calling process.exit out from under vitest).
// Same shape as check-public-copy.mjs.
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly && problems.length) {
  console.error("check-data-inventory: FAILED\n");
  for (const p of problems) console.error(`  ${p}\n`);
  console.error(
    "docs/data-inventory.md is the source design/store/app-privacy.json answers from,\n" +
      "and that file is the App Store privacy label. A collection missing here is a\n" +
      "collection the filing was not derived against (D130).",
  );
  process.exit(1);
}

const covered = collections.length - Object.keys(EXEMPT).length;
if (invokedDirectly) console.log(
  `check-data-inventory OK — ${covered} collection(s) named in docs/data-inventory.md, ` +
    `${Object.keys(EXEMPT).length} exempted with reasons; ` +
    `${readerChecked} row(s) held to an unambiguous read rule.`,
);

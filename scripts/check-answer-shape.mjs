// Does every answer-creating write still carry the fields replay reads?
//
// WHY THIS EXISTS. D275 records that `v2_users/{uid}/answers/{qid}` is the
// source of truth and every aggregate is a disposable projection rebuilt
// from it. That is only true while the answer document keeps carrying what
// the fold slices by — above all the `anchors` snapshot (D8), which exists
// nowhere else. The profile is mutable, so an answer that did not snapshot
// its anchors can never have them reconstructed: the cohort it was cast in
// is simply gone.
//
// D275's closing sentence says exactly that and nothing enforced it, which
// is the shape of failure this repo keeps recording (D35's label gate,
// D39's figures gate): a promise living in prose while every gate stays
// green. Trim `anchors` from a payload to save a write and nothing here
// fails — not tsc, not eslint, not the mount tests, not the e2e, because
// the fold happily folds an answer with no anchors into nothing. The
// Mirror would simply get quieter, question by question, as the archive
// filled with answers that belong to no cohort.
//
// WHAT IT CHECKS, and deliberately not more:
//
//   1. Every `setDoc` at the answers path carries `qid`, `answeredAt` and
//      `anchors`. An `anchors: {}` literal passes — learn answers write
//      one on purpose, with the reason at the site (the crowd stat is one
//      global number), and an empty snapshot folds to nothing, which is
//      the correct outcome rather than a lost one.
//   2. `updateDoc` at that path is EXEMPT, and that is the D86 edit arm:
//      it moves `optionIdx` and stamps `editedAt` while anchors and
//      answeredAt stay frozen. Requiring anchors there would demand the
//      one write the rules refuse.
//   3. The consumer half — `functions/src/replay.ts` must still read
//      `anchors`. A gate that only watched the producer would stay green
//      through a rebuild that silently stopped slicing.
//
// It does NOT check that the anchors are CORRECT; `check:anchors` holds
// the vocabularies and vote.test.ts holds which anchors a rates question
// may take. This holds only that the field is written at all.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = "src/v2/data/live.ts";
const CONSUMER = "functions/src/replay.ts";
const REQUIRED = ["qid", "answeredAt", "anchors"];

// The path every answer write goes through. Written as the literal call
// shape rather than a loose "answers" match so a same-named subcollection
// elsewhere cannot quietly satisfy this gate.
const PATH = '"v2_users", uid, "answers"';

const src = readFileSync(resolve(root, SRC), "utf8");

/** Take the object literal starting at `open` (an index pointing at `{`). */
function braceBlock(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  return null;
}

/** The payload of one write: an inline literal, or the nearest preceding
 *  `const <ident> ... = {` when the call passes a variable. Both forms are
 *  live in live.ts today — the group/duo write builds its payload up over
 *  several lines because a pick day appends `pickUid` (D224). */
function payloadFor(text, callIdx) {
  const close = text.indexOf(")", text.indexOf(PATH, callIdx));
  const after = text.slice(close + 1, close + 400);
  const inline = after.indexOf("{");
  const comma = after.indexOf(",");
  if (inline !== -1 && (comma === -1 || inline < comma + 3)) {
    const block = braceBlock(text, close + 1 + inline);
    if (block) return { kind: "inline", block };
  }
  const m = after.match(/,\s*([A-Za-z_$][\w$]*)\s*\)/);
  if (!m) return null;
  const name = m[1];
  const declRe = new RegExp(`const\\s+${name}\\b[^=]*=\\s*\\{`);
  const before = text.slice(0, callIdx);
  const decl = [...before.matchAll(new RegExp(declRe.source, "g"))].pop();
  if (!decl) return null;
  const block = braceBlock(text, before.indexOf("{", decl.index));
  return block ? { kind: `via ${name}`, block } : null;
}

const problems = [];
let creates = 0;
let edits = 0;

for (let i = 0; ; ) {
  const at = src.indexOf(PATH, i);
  if (at === -1) break;
  i = at + PATH.length;
  // Walk back to the call that owns this path.
  const lineStart = src.lastIndexOf("\n", at) + 1;
  const head = src.slice(Math.max(0, lineStart - 200), at);
  const isUpdate = /updateDoc\(\s*doc\($/.test(head.replace(/\s+/g, " ").trim() + "")
    || /updateDoc\(/.test(src.slice(lineStart, at));
  const isCreate = /setDoc\(/.test(src.slice(lineStart, at));
  const line = src.slice(0, at).split("\n").length;

  if (isUpdate) { edits++; continue; }
  if (!isCreate) continue;
  creates++;

  const p = payloadFor(src, at);
  if (!p) {
    problems.push(`${SRC}:${line} — could not resolve the payload for this answer write`);
    continue;
  }
  for (const field of REQUIRED) {
    // `qid: q.id` and the ES6 shorthand `qid,` are both live in this file,
    // and a gate that only understood the long form reported four false
    // positives the first time it ran — so it accepts a key terminated by
    // a colon, a comma or a closing brace.
    if (!new RegExp(`(^|[{,\\s])${field}\\s*[:,}]`).test(p.block)) {
      problems.push(`${SRC}:${line} (${p.kind}) — answer payload is missing \`${field}\``);
    }
  }
}

// Vacuity: a scanner that matched nothing reports success, which is the
// gate bug check-appcheck.mjs's header records. Refuse to pass on zero.
if (creates < 5) {
  problems.push(
    `only ${creates} answer-create site(s) found in ${SRC} — the scan shape is stale, `
    + "not the code. Fix this script before trusting it.",
  );
}

// The READ, not the word. This was `/anchors/` for one draft and it was
// worthless: renaming every `anchors` in replay.ts to `anchorsX` left the
// gate green, because a substring match cannot tell a live read from a
// rename that broke it. It now demands the exact accessor — the value
// coming off the answer DOCUMENT — which is the thing that must not go.
const consumer = readFileSync(resolve(root, CONSUMER), "utf8");
if (!/\.get\(\s*["']anchors["']\s*\)/.test(consumer)) {
  problems.push(
    `${CONSUMER} no longer reads \`anchors\` off the answer document — `
    + "the rebuild has stopped slicing, and every replayed aggregate would "
    + "come back with an empty breakdown",
  );
}

if (problems.length) {
  console.error("\ncheck-answer-shape: the answer document is the source of truth (D275),");
  console.error("and something stopped carrying what a rebuild reads:\n");
  for (const p of problems) console.error("  " + p);
  console.error(
    "\n  An answer without its anchors snapshot cannot be re-cohorted later —\n"
    + "  the profile is mutable, so the cohort it was cast in is simply gone.\n",
  );
  process.exit(1);
}

console.log(
  `check-answer-shape OK — ${creates} answer-create site(s) carry ${REQUIRED.join(", ")}; `
  + `${edits} edit site(s) exempt (D86); the rebuild still reads anchors.`,
);

// The disclosures the APP no longer states must still exist on the page it
// points at.
//
//   npm run check:policy-claims
//
// WHY THIS EXISTS.
//
// D172 put the account panel's ten disclosure bullets behind a `details`
// and left a comment in the source saying a layout change "must not be
// read as permission to thin the promises". D183 removed them from the app
// outright, on the owner's call — the panel keeps one sentence and a link,
// and `web/privacy.html` becomes the single place the long version lives.
//
// That is a defensible move and it costs the tree something specific: the
// bullets were pinned by `LivePrivacyPanel.test.tsx`, which is how D9's
// location promise, D84's presence square and D146's type cut each stayed
// on screen through three rewrites. Deleting the bullets deletes those
// assertions' subject. Without a replacement, the next person to edit
// privacy.html could quietly drop the three-hour linger and nothing in CI
// would notice — which is the exact failure the panel's own comment was
// written to prevent, one file over.
//
// So the assertions move with the claims. This is a NAME-LEVEL check, the
// same class as check:public-copy and check:globals: a fixed list of
// phrases against one enumerated file. It does not read firestore.rules
// and does not reason about behaviour — D106 declined to build that and
// was right to.
//
// WHAT IT CANNOT DO, stated so nobody mistakes a green run for more than
// it is: matching a phrase proves the sentence is present, not that it is
// true. `check:public-copy` catches the retired vocabulary; this catches
// the silent deletion. Neither catches a claim that is simply wrong, and
// the three this file most cares about — the square's size, the linger,
// who reads the room — were ALL wrong on that page when D183 opened it,
// because D174, D175 and D177 each updated the app and not the policy.
// That is the failure mode: not a promise thinned on purpose, a promise
// left behind by a change three commits away. A phrase list cannot see it.
// What it can do is make the page a place a decision has to visit.
//
// If a claim genuinely retires, delete its row HERE, in the commit that
// retires it, with the decision that says why.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Repo-relative, resolved from this file so a test can import it from anywhere. */
export const PAGE = "web/privacy.html";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * [label, /pattern/] — the label is what a failure prints, so write it as
 * the promise rather than as the regex. The patterns are deliberately
 * loose about wording and strict about the load-bearing token (a number, a
 * duration, a name), because the wording is allowed to improve and the
 * token is what a reader is owed.
 */
export const CLAIMS = [
  ["D98 · answers are public, under your display name",
    /your answers are public/i],
  // One pattern, not an alternation. It shipped as
  // `/…from the first answer|no minimum, no delay/` and the gate's own
  // test caught it inside an hour: with two spellings of one claim, either
  // half could be deleted and the row still matched on the other. A claim
  // that half-vanishes is what this file exists to notice.
  ["D98 · counts are exact from the first answer, with no floor",
    /exact and published\s+from the first answer/i],
  ["D98 · and there is no minimum group size",
    /no minimum, no delay/i],
  ["D98 · a blank display name hides the name, not the answers",
    /hides the\s+name, not the answers/i],
  ["D146 · answers can be grouped by the Big Five type, retroactively",
    /grouped by it[\s\S]{0,400}?before you had a type at all/i],
  // The D146 row beside this one — "politics/values/social results are
  // NOT used to group answers" — retired at D237: the owner removed the
  // promise (the D225 posture — an unneeded promise is a standing
  // liability). The page now DESCRIBES what groups answers today, with
  // no pledge about tomorrow; the app's current Big-Five-plus-logic
  // scope is a product choice held by `data/typeSplit.SPLIT_TEST`'s own
  // test, not by this gate.
  ["D202 · people are counted by type on all four tests, not just the Big Five",
    /count of people by type, on any of the four[\s\S]{0,600}?not only the Big\s+Five/i],
  ["D202 · and that count is people, not a grouping of answers",
    /count of <em>people<\/em>, not a grouping of anyone/i],
  ["D5 · duel picks stay sealed until the next day's reveal",
    /sealed[\s\S]{0,200}?until the day after/i],
  ["D9 · coordinates are never transmitted or stored",
    /coordinates are not sent to us, not stored/i],
  ["D175 · the presence square's SIZE tracks the grid (~200 m, not km)",
    /~200-metre grid square/i],
  ["D175 · the retired kilometre claim is gone",
    (src) => !/kilometre-sized/i.test(src)],
  ["D84 · no user can read your presence square",
    /No other user can ever read your square/i],
  ["D177 · the people in your square see your name, type and answers",
    /sees? your display name, your type and your\s+answers/i],
  ["D174 · presence outlives the app by up to three hours",
    /three hours after you close the app/i],
  ["D98 · takes carry your display name",
    /carries your display name/i],
  ["D178 · the profile photo is optional and its metadata is stripped",
    /metadata is\s+stripped on your device/i],
  ["D3 · no ads, no third-party analytics",
    /no third-party analytics or tracking/i],
  ["D226 · a changed answer is counted publicly as a move between options",
    /moves from one option to another/i],
  ["D227 · the verified logic score also groups answers, in broad bands",
    /verified logic score, in\s+four broad\s+bands/i],
  ["D236 · sold reports are packaged public numbers, never a private read",
    /report never contains\s+anything a signed-in user could not read/i],
];

/** Labels of every claim the given page source fails to state. */
export function missingClaims(src) {
  return CLAIMS
    .filter(([, test]) => (typeof test === "function" ? !test(src) : !test.test(src)))
    .map(([label]) => label);
}

/** The page as it stands in the tree. */
export function readPage() {
  return fs.readFileSync(path.join(ROOT, PAGE), "utf8");
}

// Importable above, runnable below — the shape scripts/spec-globals.mjs
// uses so the gate and the test that trusts it cannot drift apart. The
// entry guard is what makes the import half safe: without it, importing
// this module to reuse CLAIMS also reads the page and can call
// process.exit, which inside a test runner takes the whole run with it.
const isEntry = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (!isEntry) { /* imported for CLAIMS/missingClaims — do not run the gate */ }
else runGate();

function runGate() {
const missing = missingClaims(readPage());

if (missing.length) {
  console.error(`\ncheck-policy-claims: ${PAGE} is missing ${missing.length} disclosure(s)\n`);
  for (const label of missing) console.error(`  ✗ ${label}`);
  console.error(
    `\nThe app used to state these itself. D183 removed them from the account\n` +
    `panel and made ${PAGE} the single place they live, so a claim that\n` +
    `disappears from this page disappears from the product.\n\n` +
    `If the wording moved, update the pattern in scripts/check-policy-claims.mjs.\n` +
    `If the promise genuinely retired, delete its row here in the same commit,\n` +
    `and record the decision in docs/DECISIONS.md.\n`);
  process.exit(1);
}

console.log(`check-policy-claims OK — ${CLAIMS.length} disclosures present in ${PAGE}.`);
}


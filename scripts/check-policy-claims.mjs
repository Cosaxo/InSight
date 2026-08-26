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
  // NOT used to group answers" — retired at D252: the owner removed the
  // promise (the D225 posture — an unneeded promise is a standing
  // liability). The page now DESCRIBES what groups answers today, with
  // no pledge about tomorrow; the app's current Big-Five-plus-logic
  // scope is a product choice held by `data/typeSplit.SPLIT_TEST`'s own
  // test, not by this gate.
  ["D202 · people are counted by type on all four tests, not just the Big Five",
    /count of people by type, on any of the four[\s\S]{0,600}?not only the Big\s+Five/i],
  ["D202 · and that count is people, not a grouping of answers",
    /count of <em>people<\/em>, not a grouping of anyone/i],
  ["D319 · the interest profile is counted from feed answers, and the page says the arithmetic",
    /count which topics your feed answers fall into/i],
  ["D319 · the profile is owner-only and never an ad input",
    /interest profile[\s\S]{0,600}?never used for advertising/i],
  // The phase-2 tripwire (D314): folding behaviour in is a FUTURE
  // decision, and this sentence is the promise that it has not happened
  // yet. Building phase 2 must retire this row in the same commit, with
  // the record that licenses it — exactly the visit this gate exists to
  // force.
  ["D314 · behaviour stays on the device — the profile is answers only",
    /scrolled past or skipped stays on your device and is not\s+collected/i],
  ["D288 · a bought question's contract record is buyer-only, and the buyer gets no private cut",
    /record of the contract[\s\S]{0,200}?only you can read it[\s\S]{0,200}?no private cut/i],
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
  ["D251 · sold reports are packaged public numbers, never a private read",
    /report never contains\s+anything a signed-in user could not read/i],
  ["D253 · sold reports group answers by all four tests' types and axes",
    /matched type and axis\s+bands/i],
  // D268 is one disclosure in two halves, pinned separately for the D202
  // reason: one row says what the daily summary is (counts, no identity),
  // the other admits the uid-keyed bookkeeping behind it and its erasure.
  // Deleting either half leaves a page that reads as more, or less,
  // private than the digest actually is.
  ["D268 · the daily usage summary is counts, computed without identity",
    /counts,\s+computed without your identity/i],
  ["D268 · the digest's per-account date pair is unreadable and erased with the account",
    /first and most recent day you answered[\s\S]{0,200}?deleted with your\s+account/i],
  // D270 is one disclosure in two halves, the D268 pair's shape: one row
  // pins what the tally cannot do (be linked to a person, or a phone
  // across days), the other pins the lifecycle promise (fold, then
  // delete). Either half vanishing leaves the page describing a
  // different collection than the one shipping.
  ["D270 · the usage tally is unlinkable — to you, and to the same phone across days",
    /cannot be linked back to\s+you[\s\S]{0,80}?across two\s+days/i],
  ["D270 · the raw tallies are deleted after the nightly fold",
    /deleted after\s+(that|the) nightly\s+fold/i],
  // D271 and D272 are the ladder's last two disclosures, each pinned on
  // its load-bearing distinction: the per-question counts are about the
  // QUESTION (the two-channel rule as a promise), and the account-linked
  // note is unreadable, question-free and self-expiring.
  ["D271 · per-question tallies are counts about a question, never a reading list",
    /counts about a question, never a list of what you\s+looked at/i],
  ["D272 · the per-account usage note carries no question and no user can read it",
    /never\s+contains a question[\s\S]{0,120}?no user can read\s+it, you included/i],
  ["D272 · each note deletes itself 90 days on, and the account's erasure takes it all",
    /deletes itself 90 days after its day/i],
];

/** Labels of every claim the given page source fails to state. */
export function missingClaims(src) {
  // COMMENTS ARE NOT THE PAGE. These patterns ran over the raw bytes, so a
  // disclosure wrapped in `<!-- … -->` still counted as present — while a
  // reader is owed it and does not get it. Since D183 this page is the one
  // place these promises live, so that is a promise deleted from the
  // product with the gate that exists to notice staying green.
  //
  // The sibling gates here all strip first (check-appcheck,
  // check-purge-listeners, check-data-inventory, check-spec-globals rule
  // 2), each after being bitten by the same shape: a thing present in the
  // source and absent in the artifact.
  //
  // Correct for BOTH claim shapes. A regex claim must match rendered text.
  // A predicate claim asserts an ABSENCE — and retired wording that only
  // survives inside a comment is not on the page either, so ignoring it is
  // the same reading, not a loosening.
  const visible = src.replace(/<!--[\s\S]*?-->/g, "");
  return CLAIMS
    .filter(([, test]) => (typeof test === "function" ? !test(visible) : !test.test(visible)))
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


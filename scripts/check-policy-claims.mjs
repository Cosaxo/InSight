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
  // D447 phase A · the answer log is a second copy of every answer, in
  // BigQuery, and deleting the account deletes it — at once or within a
  // day (the streaming buffer). Both halves are claims: that the copy
  // exists and where, and that erasure reaches it on a stated clock. The
  // window between them is wide because the export's paragraph (D443)
  // sits between the two sentences — 2,000 characters stopped matching
  // the day that paragraph landed, with the promise intact on the page.
  ["D447 · the answer log exists, in the same project and region, and erasure reaches it within a day",
    /analytics table \(BigQuery\) in the\s+same Google Cloud project and region[\s\S]{0,8000}?copy of your answers in the analytics table goes with\s+them[\s\S]{0,120}?within a day/i],
  // D236 · the page must NAME the notifications, not just count them.
  // check:figures holds the count against v2social.ts's own call sites;
  // this holds the list, because a fifth kind added as "and others" would
  // satisfy a count and tell the reader nothing. The sentence said "the
  // one notification this app sends" for the nine days after D236 shipped
  // three more — the exact shape this file's header names: not a promise
  // thinned on purpose, a promise left behind by a change three commits
  // away.
  // D426 (ROUNDS-PLAN §7.4) added the fifth — "your turn" — between the
  // reveal and the invitation, and the pattern names it: a page that
  // dropped it would still count five kinds somewhere and match nothing
  // here.
  ["D236 · the token is used for the reveal, the turn (D426), AND the three group notices",
    /revealed,\s*it is your\s+turn[\s\S]{0,160}?someone invited you[\s\S]{0,200}?asked to join[\s\S]{0,120}?approved/i],
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
  ["D322 · the interest profile is counted from feed answers, and the page says the arithmetic",
    /count which topics your feed answers fall into/i],
  ["D322 · the profile is owner-only and never an ad input",
    /interest profile[\s\S]{0,600}?never used for advertising/i],
  // The phase-2 tripwire (D317): folding behaviour in is a FUTURE
  // decision, and this sentence is the promise that it has not happened
  // yet. Building phase 2 must retire this row in the same commit, with
  // the record that licenses it — exactly the visit this gate exists to
  // force.
  ["D317 · behaviour stays on the device — the profile is answers only",
    /scrolled past or skipped stays on your device and is not\s+collected/i],
  ["D288 · a bought question's contract record is buyer-only, and the buyer gets no private cut",
    /record of the contract[\s\S]{0,200}?only you can read it[\s\S]{0,200}?no private cut/i],
  // D378 · the one way off-app: after the answer, and counted by nobody.
  // Two tokens, because the two halves are separate promises — WHEN the
  // link shows (the question is answered as a question) and WHAT we do
  // with a tap (nothing) — and a page that kept one and lost the other
  // would be the half-corrected promise this file exists to notice.
  ["D378 · a bought question's link shows only after you have answered",
    /buyer&rsquo;s own link[\s\S]{0,120}?only after you have answered/i],
  ["D378 · and a tap on it is counted by nobody",
    /opens their site in your browser[\s\S]{0,80}?we count\s+nothing/i],
  // D379 · the results page is a PUBLIC surface, and the page says what
  // it carries and what it never does — the counts, never a name.
  ["D379 · a bought question's numbers are a public web page, and it never names who answered",
    /served as a web page\s+anyone can open[\s\S]{0,240}?never who\s+answered/i],
  // WAS "until the day after", AND SO WAS THIS ROW. D426 replaced the
  // calendar day with a ROUND and D437 gave it a 48-hour deadline: a 1v1
  // reveals the moment the partner answers (inside `onV2AnswerCreated`),
  // a circle when the last member plays, otherwise at the deadline. The
  // page went on promising a day in BOTH directions — a pick can be
  // public a second after it is cast, and can stay sealed for two days —
  // and this row PINNED that promise, so the page could not be corrected
  // without moving the gate. The app's own copy has said "sealed until
  // the reveal" since D437, and `check:public-copy` refuses the word
  // "tomorrow" on the duel surfaces; `web/` is not one of the roots it
  // scans, which is the gap that let the page drift alone.
  ["D437 · duel picks stay sealed until their round reveals",
    /sealed[\s\S]{0,200}?until its round reveals/i],
  // The row above pins the SEAL and says nothing about who reads the
  // reveal once it opens, which is how the page went on promising "the
  // people in that group" for a year after D98 removed the membership
  // arm from `match /reveals/{revealId}` (it is `request.auth != null`, and
  // rules.test.ts asserts a stranger, a late joiner and someone who left
  // all read a day). Two rows, because the page states the audience
  // twice and a half-corrected promise is the same failure.
  ["D98 · a revealed duel day is readable by anyone holding the circle's id",
    /anyone signed in who has that circle&rsquo;s id can see them/i],
  ["D98 · the audience summary says the same thing",
    /reveal, then anyone signed in who has that circle&rsquo;s id/i],
  ["D98 · the retired circle-scoped reveal audience is gone",
    (src) => !/(picks to the people in that group|then the members of that group)/i.test(src)],
  ["D98 · group takes are world-readable too, not circle-scoped",
    (src) => !/group takes: that group/i.test(src)],
  // THE SAME PROMISE, ONE PARAGRAPH UP, and the row above could not see
  // it: that row forbids one literal string ("group takes: that group")
  // from the audience SUMMARY, while the what-we-collect bullet said the
  // narrowing in different words — "to a group's members when posted
  // there". `match /v2_takes/{id}` has no membership arm at all (D98
  // collapsed it), so any signed-in stranger reads a circle take, and the
  // suite pins exactly that. Which is the half-corrected promise this
  // script's own header warns about, caught by nothing for as long as the
  // two sentences disagreed.
  //
  // The bullet also carried "one per person per question" across BOTH
  // kinds. Only the world branch enforces that; the rules' circle branch
  // says in its own comment that a circle take is many-per-person and
  // there is no one-take bound to enforce.
  ["D98 · a circle take is readable by any signed-in user, said where it is collected",
    /Anyone signed in can read it,\s+wherever you posted it/i],
  ["D98 · …and the retired member-scoped wording is gone",
    (src) => !/to a group&rsquo;s members when posted there/i.test(src)],
  ["D98 · the one-per-question bound is the WORLD feed's, not the circle's",
    /One per question in the\s+world feed;\s+as many as you like in a circle/i],
  ["D9 · coordinates are never transmitted or stored",
    /coordinates are not sent to us, not stored/i],
  ["D175 · the presence square's SIZE tracks the grid (~200 m, not km)",
    /~200-metre grid square/i],
  ["D175 · the retired kilometre claim is gone",
    (src) => !/kilometre-sized/i.test(src)],
  // D175's other half, and the one this file's own header warned about: a
  // promise left behind by a change three commits away. D175 made the app
  // request a PRECISE fix, and the page went on saying it asked for "an
  // approximate location" — for a year, through the very sweep that was
  // opened because three of these claims were stale. The page now says who
  // decides the precision, and the second row is the promise the refusal in
  // locate.ts makes true: an approximate grant does not become a guessed
  // square.
  ["D175 · the page does not claim the app asks only for an approximate fix",
    (src) => !/ask your device for an approximate location/i.test(src)],
  ["D175 · a fix too coarse for the square is refused, not guessed",
    /says it cannot place you rather than guessing a square/i],
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
  // The D3 row here — "no third-party analytics or tracking of any
  // kind" — retired at D314 (2026-08-26): the owner removed the promise
  // on the D225 posture (an unneeded promise is a standing liability),
  // over the recorded recommendation to keep it. The page now DESCRIBES
  // today's practice — no ad identifiers, no third-party analytics SDK,
  // no data sold to advertisers, with "if that changes, this page
  // changes first" — and pledges nothing about tomorrow. The store
  // nutrition labels keep saying tracking-off because that stays a fact
  // about the shipped app until an SDK actually ships; the day one
  // does, the store forms and this page move together, as a product
  // decision rather than a broken promise.
  // D331 — four rows, one per promise, because each is separately
  // breakable and a single regex over the passage would go green while
  // three of them rotted. The compass is the app's only special-category
  // inference, so the page carrying these sentences IS the disclosure the
  // consent rests on.
  ["D331 · the political compass is off until turned on",
    /political compass is off until you turn it on/i],
  ["D331 · nothing political is computed or stored while it is off",
    /nothing political is[\s\S]{0,20}?computed about you and nothing political is[\s\S]{0,20}?stored/i],
  ["D331 · turning it off deletes the compass at once",
    /Turn it off later and the compass is deleted[\s\S]{0,80}?at once/i],
  ["D331 · and the honest limit on what deletion can reach",
    /cannot reach is a copy someone[\s\S]{0,60}?Nothing can/i],
  ["D314 · the tracking passage describes today and stays ahead of change",
    /no third-party analytics SDK[\s\S]{0,200}?this\s+page changes first/i],
  ["D226 · a changed answer is counted publicly as a move between options",
    /moves from one option to another/i],
  ["D227 · the verified logic score also groups answers, in broad bands",
    /verified logic score, in\s+four broad\s+bands/i],
  ["D251 · sold reports are packaged public numbers, never a private read",
    /report never contains\s+anything a signed-in user could not read/i],
  // D313 is one disclosure in two halves, the D268 pair's shape: one row
  // pins the automated review (a submitted ask is read by an AI reviewer
  // — that is a processor a buyer should learn from the page, not from a
  // decline), the other pins the payment boundary (Stripe holds the
  // payment details; we keep the booking and the refund arithmetic).
  // Deleting either half leaves a page describing a different pipeline
  // than the one that runs.
  ["D313 · paid submissions are reviewed automatically, by rules and an AI reviewer",
    /checked automatically[\s\S]{0,200}?AI reviewer/i],
  ["D313 · payment runs on Stripe and the payment details never reach us",
    /Stripe receives your payment details and we never see\s+them/i],
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
  // D413/D414/D419 · THE ACCOUNT WALL. Sixty-six lines of new disclosure
  // landed on this page on 2026-09-07 and not one claim row came with
  // them, so the whole section could be deleted — measured, 2023 bytes,
  // gate still exit 0 — or inverted sentence by sentence. That is exactly
  // the drift this file exists to catch, and it is the third time: D174,
  // D175 and D177 each updated the app and not the policy, which is what
  // D183 opened the page to fix.
  //
  // Two of these rows are here because the sentence they hold was FALSE
  // when it was written. The page said a mistyped address "does not end
  // up with an InSight account behind it" while `emailCreate` makes the
  // account before anything looks at the address (live.ts's own
  // `abandonSignIn` note: "Nothing is deleted — the abandoned account
  // still exists"), and it said the app warns before signing in to an
  // existing account, which Apple and Google did and the email door did
  // not. That second sentence went the other way at D441: the owner had
  // the CODE match the better promise, so the row that pinned the caveat
  // now pins the promise for all three doors, and an absence row keeps
  // the caveat from coming back — the page must not go on describing a
  // door that no longer exists.
  ["D414 · the three doors are named, so the wall cannot quietly grow a fourth",
    /Sign in with Apple[\s\S]{0,400}?Continue with Google[\s\S]{0,400}?Email and password/i],
  ["D414 · the password is hashed by Firebase and this app never sees it",
    /stores\s+it hashed; this app never sees it and never stores it/i],
  ["D414 · a password account exists BEFORE the address is confirmed, and is abandoned rather than deleted",
    /exists from the moment the password is accepted, before[\s\S]{0,200}?signing out abandons that account rather\s+than deleting it/i],
  ["D441 · signing in to an existing account leaves this session's answers, and every door says so first",
    /two histories are not\s+merged[\s\S]{0,200}?says so on the screen before it\s+happens/i],
  ["D441 · the retired email-door caveat is gone",
    (src) => !/With an\s+email address it does not/i.test(src)],
  // D443 · the terms have promised "a chance to download your data first"
  // since they were written, and the export (functions/src/exportAccount.ts)
  // is what makes that a mechanism. Three rows: that a download EXISTS and
  // is deletion's own list (the sentence a reader is owed one heading above
  // the delete button), what it leaves out (an export described as
  // "everything" that quietly omits things is exactly the shape this file's
  // header is about), and the bound with the way round it.
  // `\s+` inside each phrase, because the page wraps at 76 columns and a
  // phrase that happens to break across a line is still on the page.
  ["D443 · your data can be downloaded as one JSON file, and it is the list deletion removes",
    /download\s+button[\s\S]{0,160}?one\s+JSON\s+file[\s\S]{0,900}?list\s+deletion\s+removes/i],
  ["D443 · and the file says what it leaves out: the logic answer key, who reported you, the push token, the presence cell",
    /leaves\s+four\s+things\s+out[\s\S]{0,200}?answer\s+key[\s\S]{0,160}?who\s+reported\s+you[\s\S]{0,160}?notification\s+token[\s\S]{0,160}?square\s+your\s+presence/i],
  ["D443 · the byte bound is stated (8 MB), and the email route serves an export too",
    /over\s+8\s+MB[\s\S]{0,400}?email\s+route\s+serves\s+an\s+export/i],
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


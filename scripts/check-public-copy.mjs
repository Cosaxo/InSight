// The retired privacy model must not reappear in copy a user reads.
//
//   npm run check:public-copy
//
// WHY THIS EXISTS, AND WHY IT IS NARROWER THAN IT LOOKS.
//
// D98 made answers public. D106 swept the pre-D98 model out of the
// documentation and, in its own words, declined to build a gate: "the
// prose agrees with the rules" is not a static property, and inventing a
// checker for it would be a worse error than the one it chased. That
// judgement stands and this script does not attempt it. Nothing here
// reads firestore.rules or reasons about behaviour.
//
// What it does instead is much smaller: the retired model had a *closed
// vocabulary* — owner-only answers, k-anonymity, a floor, a minimum
// cohort, an anonymous take — and that vocabulary is now false in every
// present-tense sentence, in every file, permanently. Checking a fixed
// word list against an enumerated set of files is a name-level check, the
// same class as check:globals and check:store-copy, and it is buildable
// where the general form is not.
//
// It exists because D106's chosen remedy was a discipline rather than a
// gate — "a decision that changes who may read something names the
// user-facing pages in its own checklist" — and that discipline then
// missed two surfaces on its own first outing:
//
//   1. design/store/listing.json, which D106 never enumerated. Both store
//      descriptions still read "Your answers are owner-only. The database
//      rules enforce it" and "Crowd numbers are floored", and that copy
//      had already been PUSHED to App Store Connect on 2026-08-08 — the
//      widest-audience copy the project has, promising a protection the
//      rules had stopped providing, directly contradicting the app's own
//      privacy nutrition label.
//   2. LivePrivacyPanel.tsx, which D106 did rewrite — and which came out
//      of the rewrite claiming world takes appear "always without a name"
//      while LiveTakesPanel rendered every author's name under a "posted
//      under your name" header. The sweep meant to delete a false claim
//      wrote a new one.
//
// Both are the failure CLAUDE.md names: the UI saying something the
// server does not do. A discipline cannot catch the surface it forgot to
// list; a file list can, and the list is the point of this script.
//
// SCOPE. Only files whose audience is a user or a store reviewer. Source
// comments are deliberately NOT scanned: the tree still carries plenty of
// stale "k-floored" comments, they are debt rather than a claim to
// anyone, and sweeping them is a separate job from keeping a promise
// honest. Widening this to src/**/*.ts would bury the signal in them.
//
// Client-only, so it stays OFF backend-checks.yml — nothing it says bears
// on whether a rules deploy is safe, and stale marketing copy must never
// be able to block an emergency one (CLAUDE.md).

import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// EVERY page in web/, read from the directory.
//
// This was a hand-kept list of four, with a comment promising that adding
// a user-facing page means adding one line here — "that one line is the
// whole remedy D106 asked for". A hand list is not a remedy, it is the
// thing that goes stale, and it did: the note beside `join.html` said it
// "was the one page in web/ this list did not name", which was false the
// day it was written. `paid-done.html` and `paid-cancel.html` had landed
// the same day (and `paid-done-ad.html` followed, until D375 retired the
// ad lane with it) — the pages a buyer lands on straight out of Stripe
// Checkout, carrying both classes this gate reads: a who-can-see-what claim ("the same public numbers every
// voter reads") and a contract claim ("the unserved part refunds to your
// card automatically at close").
//
// Every file in web/ is served (firebase.json publishes the directory),
// so every file in web/ is a surface. A page that genuinely should be
// exempt goes in EXEMPT_PAGES with its reason, which is a line somebody
// has to write on purpose rather than one they can forget.
const EXEMPT_PAGES = {};
const HTML_FILES = readdirSync(join(root, "web"))
  .filter((f) => f.endsWith(".html"))
  .filter((f) => !(f in EXEMPT_PAGES))
  .sort()
  .map((f) => `web/${f}`);
// EVERY in-app surface, read from the directories, for the same reason the
// `web/` half is: this was a hand list of ONE — the privacy panel — in the
// gate whose own note above says "a hand list is not a remedy, it is the
// thing that goes stale". A retired-model sentence in any other screen was
// unreachable to it, and user-facing copy lives across all of these files.
//
// Comments are stripped by `collect()` below before scanning, which is what
// makes this safe to widen: this layer explains its own history in prose
// and quotes the old wording on purpose. Measured when it was widened: 133
// files, zero hits — so the scope grew without a single sentence having to
// change.
//
// A file that genuinely must opt out goes in EXEMPT_SOURCES with its
// reason, the same shape EXEMPT_PAGES has, which is a line somebody writes
// on purpose rather than one they can forget.
const EXEMPT_SOURCES = {};
// EVERY DIRECTORY THAT HOLDS COPY, AND EVERY EXTENSION IT IS WRITTEN IN.
//
// This read two directories and three extensions, and the header one box
// up says the gate covers "EVERY in-app surface … user-facing copy lives
// across all of these files". It did not: `.ts` was missing, so 13
// non-test typed files in `src/v2/ui` alone were invisible — including
// the search placeholders and empty-state lines in `pickDomains.ts` and
// the card headers in `lensDefs.ts` — and `src/v2/data` was not listed at
// all, though it carries "This view is paused while we keep InSight's
// costs in check.", "Your speech stays yours to withdraw", "You're on an
// anonymous session" and "Fetching today's question…".
//
// Measured before this widened: planting a real retired claim ("counts
// are hidden until enough people answer") in `src/v2/ui/pickDomains.ts`
// left the gate GREEN at 173 surfaces, with the pattern for that exact
// sentence live in the list below. Widened, the same plant fails and the
// clean tree reads 259 surfaces across 86 files that were unguarded.
const SOURCE_DIRS = ["src/v2/ui", "src/v2/spec", "src/v2/data", "src/lib"];
const TSX_FILES = SOURCE_DIRS.flatMap((dir) => readdirSync(join(root, dir))
  .filter((f) => /\.(tsx?|jsx?)$/.test(f))
  // Tests are not copy: their fixtures quote the old model on purpose, and
  // the mount suites assert on strings a user never sees.
  .filter((f) => !/\.test\./.test(f))
  .filter((f) => !(`${dir}/${f}` in EXEMPT_SOURCES))
  .sort()
  .map((f) => `${dir}/${f}`));
const LISTING = "design/store/listing.json";

// The two store-form surfaces, added 2026-08-30 because one of them had
// been telling Apple something false for two weeks with every gate green.
// STORE-FORMS.md's structural fact 3 and app-privacy.json's `$structural`
// both called the world takes "anonymous by construction" — a claim D98
// retired when it put names on them, and one the SAME JSON file's
// `$guideline12` already contradicted four keys further down.
//
// This gate's own SCOPE paragraph says its subject is copy whose audience
// is "a user or a store reviewer", and these are the second half of that
// sentence: a reviewer's answers are derived from them. check:store-forms
// compares the collected-type and age-rating TABLES and reads none of the
// prose, so nothing looked at these words at all.
const FORM_FILES = [
  "docs/STORE-FORMS.md",
  "design/store/app-privacy.json",
  // Play's half, added with check:store-forms rule 6 (2026-09-01). Parked
  // under D42 and scanned anyway: a parked file is exactly the one that
  // goes stale, because nobody reads it for months and then transcribes
  // it in a hurry. That is the whole reason it was kept rather than
  // deleted.
  "design/store/play-data-safety.json",
];

// The retired vocabulary, in the PRESENT tense only.
//
// Past-tense history is explicitly allowed and must stay allowed: D106's
// standing rule is that a claim which was historically true is kept and
// marked as history, so a reader can tell a reversal from a mistake.
// web/privacy.html carries two such paragraphs on purpose ("This page
// promised the opposite until 2026-08-11", "There used to be a threshold
// here"). Every pattern below is written so those do not match — which is
// why they are anchored on "are/is" rather than on the nouns alone, and
// why the word "floor" on its own is not a pattern.
export const RETIRED = [
  {
    re: /\banswers? (?:are|is) (?:owner-only|private|yours alone|only visible to you)\b/i,
    why: "answers are world-readable since D98",
  },
  {
    re: /\byour answers?\b[^.!?]{0,60}\b(?:nobody|no one|no-one) else\b/i,
    why: "answers are world-readable since D98",
  },
  {
    re: /\bk-anonym/i,
    why: "there is no k-anonymity floor since D98",
  },
  {
    re: /\b(?:counts?|numbers?|splits?) (?:are|is) (?:floored|withheld|suppressed|hidden)\b/i,
    why: "counts are exact and publish from the first answer since D98",
  },
  {
    re: /\b(?:nothing|no count|a count|a split) is (?:shown|published|revealed) until\b/i,
    why: "counts are exact and publish from the first answer since D98",
  },
  {
    re: /\b(?:stays?|remains?) hidden until enough people\b/i,
    why: "counts are exact and publish from the first answer since D98",
  },
  // Three spellings of one claim, and the count is the lesson. The first
  // pattern was written from the privacy panel's wording alone and was
  // then run across the tree, which turned up the SAME claim twice more
  // in web/privacy.html wearing different words — "with no name
  // attached", in the prose and again in the who-can-see-what list. A
  // vocabulary gate is only as wide as the phrasings someone thought of,
  // so when this fires, grep the claim rather than the string.
  {
    re: /\btakes?\b[^.!?]{0,80}\b(?:without a name|with no name attached|no name attached)\b/i,
    why: "takes carry the author's name at both scopes since D98",
  },
  {
    re: /\b(?:published|posted|shown|appears?)\b[^.!?]{0,40}\b(?:with no name attached|without a name)\b/i,
    why: "takes carry the author's name at both scopes since D98",
  },
  {
    re: /\b(?:comments?|takes?) (?:are|is) anonymous\b/i,
    why: "takes carry the author's name at both scopes since D98",
  },
  // The store-form spellings, which none of the three above matched: the
  // claim was made as a PROPERTY ("anonymity by construction") and as a
  // scope description ("world-scale WITHOUT names"), never as "takes are
  // anonymous". Same lesson as the three above — grep the claim, not the
  // string — one surface further out.
  {
    re: /\banonymity by construction\b/i,
    why: "takes carry the author's name at both scopes since D98",
  },
  {
    re: /\bworld[- ]scale\b[^.!?]{0,20}\b(?:without names|with no names)\b/i,
    why: "takes carry the author's name at both scopes since D98",
  },
  // A THIRD spelling, and the one the wider scan was added for. The two
  // above are the wordings app-privacy.json carried; STORE-FORMS.md said
  // the same thing as "anonymous by construction (no author names
  // rendered)", which neither of them matches — so the commit that widened
  // this gate proved itself against the JSON's phrasings planted into the
  // Markdown, and restoring the Markdown file's OWN retired sentence still
  // passed. Four patterns for one claim now, which is this file's oldest
  // lesson written down twice: grep the claim, not the string.
  //
  // Anchored on a noun so the history line those files now keep — "It said
  // anonymous by construction here until 2026-08-30" — stays legal, the
  // same way every pattern above leaves web/privacy.html's two historical
  // paragraphs alone.
  {
    re: /\b(?:takes?|free text|posts?)\b[^.!?]{0,60}\banonymous by construction\b/i,
    why: "takes carry the author's name at both scopes since D98",
  },

  // ── the anonymous-first vocabulary, retired by D414 ───────────────
  //
  // A SECOND retired model, and it went the same way as the first: on
  // 2026-09-07 the account wall went up, and three surfaces kept
  // promising the opposite for the rest of the afternoon —
  // `design/store/listing.json` (BOTH store descriptions: "No sign-up
  // wall. Open it and start: no email, no phone number"), `web/join.html`
  // ("the app works anonymously from the first tap") and, worst,
  // `web/privacy.html`'s Children section ("there is little to collect:
  // no account is required"). The listing was hours from being submitted
  // to Apple beside a build that opens on a wall, which is guideline
  // 2.3.1 and a rejection round.
  //
  // That is this file's own founding failure, repeated: its header
  // records listing.json shipping "answers are owner-only" to App Store
  // Connect while the rules said otherwise. The remedy the header argues
  // for is a word list rather than a discipline — so D414's vocabulary
  // joins D98's here rather than being swept once and trusted.
  //
  // NOT a ban on the word "anonymous". The app still signs every session
  // in anonymously (D3, untouched), the attention tally is genuinely
  // unlinkable, and both are described in copy that must keep saying so.
  // What is retired is the claim that a user may USE the app without an
  // account.
  {
    re: /\bno (?:sign[- ]?up|signup|log[- ]?in|login) wall\b/i,
    why: "the app requires an account since D414",
  },
  {
    re: /\bno account (?:or [a-z]+ )?(?:is )?(?:needed|required)\b/i,
    why: "the app requires an account since D414",
  },
  {
    re: /\b(?:works?|usable|use it) anonymously\b/i,
    why: "the app requires an account since D414",
  },
  {
    re: /\byou do not need an account\b/i,
    why: "the app requires an account since D414",
  },
  {
    re: /\bwithout (?:an account|signing in|an email)\b[^.!?]{0,40}\b(?:answer|use|start|open)\b/i,
    why: "the app requires an account since D414",
  },
  {
    re: /\b(?:linking|signing in)\b[^.!?]{0,30}\bis optional\b/i,
    why: "the app requires an account since D414",
  },
];

// ── the duel surfaces' voice (D437, the owner's 2026-09-09 brief) ──
//
// A THIRD list, narrower in scope than the two above: it reads only the
// screens where a 1v1 or a group is played or read back, and it holds a
// VOICE rather than a retired model. The owner's brief for those screens
// ends with the words to use and the words never to use — "say votes,
// rounds, said; never days, majority, crowned, in charge" — and the
// reason is the same as D98's: a sentence that says "days" describes a
// cadence the app no longer has (a round is a round, ROUNDS-PLAN / D426),
// and one that says "majority" or "crowned" describes a call the group
// no longer makes (D437: nothing in a group is predicted or called). Both
// read as true to a user who cannot see the code.
//
// The same lesson as the two lists above, one step earlier: the days
// vocabulary had ALREADY grown back twice by the time this was written —
// "aligned with you · 3 of 4 days" and "Reading the days…" on the Groups
// stop, "3 days you both guessed" on the Roles tab — each written after
// the rounds model landed, each green under every gate. A word list is
// what stops the third time.
//
// Scoped by FILE, not by pattern, because "days" is a fine word on the
// privacy page and a wrong one on a reveal. The list is the live duel
// surfaces and the demo's ported family (VISION-2026-09-09 §7 step 6).
//
// What the patterns leave alone, on purpose: a relative DATE ("3 days
// ago" under a reveal is a timestamp, not the game's unit), the words as
// identifiers (`majorityIdx` carries no word boundary), and past tense.
export const DUEL_SURFACES = [
  "src/v2/ui/LiveDuelPanel.tsx",
  "src/v2/ui/LiveGroupsMirrorBody.tsx",
  "src/v2/ui/LgRoleMap.tsx",
  "src/v2/ui/LiveRolesPanel.tsx",
  "src/v2/data/roles.ts",
  "src/v2/data/groupCast.ts",
  // …and the demo's family, since the port that made it play rounds
  // (D437 step 6): the store's copy, the two cards, the Groups stop, the
  // role map, and the Map's People branch that reads the store.
  "src/v2/spec/duels-data.js",
  "src/v2/spec/group-daily.jsx",
  "src/v2/spec/duo-daily.jsx",
  "src/v2/spec/group-mirror.jsx",
  "src/v2/spec/group-role-map.jsx",
  "src/v2/spec/map-people.jsx",
];
export const VOICE = [
  {
    re: /(?:\b\d+|\}|\bof(?: the)?) days?\b(?! ago\b)/i,
    why: "a round is the unit since ROUNDS-PLAN / D426 — say rounds, never days",
  },
  {
    re: /\bdays? (?:you|we|they|both|played|revealed|guessed)\b/i,
    why: "a round is the unit since ROUNDS-PLAN / D426 — say rounds, never days",
  },
  {
    re: /\b(?:the|these|those|revealed|shared|older|more) days\b/i,
    why: "a round is the unit since ROUNDS-PLAN / D426 — say rounds, never days",
  },
  {
    re: /\b(?:each|every|per|one|a) day\b/i,
    why: "a round is the unit since ROUNDS-PLAN / D426 — say rounds, never days",
  },
  {
    re: /\b(?:tomorrow|the morning after|until tomorrow)\b/i,
    why: "a reveal is at everyone-played or the deadline, not a morning (D437) — say until the reveal",
  },
  {
    re: /\bmajority\b/i,
    why: "nothing in a group is called since D437 — a room names people, it has no majority",
  },
  {
    re: /\bcrowned?\b(?!-)/i,
    why: "nothing in a group is called since D437 — say who the room named, never crowned",
  },
  {
    re: /\bin charge\b/i,
    why: "a seat is said as its line (D437) — never 'in charge'",
  },
];

/** The voice check, for the duel surfaces only — same shape as scanText. */
export function scanVoice(text) {
  const hits = [];
  for (const { re, why } of VOICE) {
    const m = re.exec(text);
    if (!m) continue;
    const start = Math.max(0, m.index - 60);
    const excerpt = text.slice(start, m.index + m[0].length + 60)
      .replace(/\s+/g, " ").trim();
    hits.push({ matched: m[0], why, excerpt });
  }
  return hits;
}

// Strings a scan must not read as copy. `$`-prefixed keys in listing.json
// are annotations to the operator (asc-push ignores them), and _comment
// is the file's own header.
const isAnnotationKey = (k) => k.startsWith("$") || k === "_comment";

/**
 * Every retired-model claim in one string, with enough context that the
 * failure names the sentence rather than sending the reader to grep for a
 * word that appears six times.
 */
export function scanText(text) {
  const hits = [];
  for (const { re, why } of RETIRED) {
    const m = re.exec(text);
    if (!m) continue;
    const start = Math.max(0, m.index - 60);
    const excerpt = text.slice(start, m.index + m[0].length + 60)
      .replace(/\s+/g, " ").trim();
    hits.push({ matched: m[0], why, excerpt });
  }
  return hits;
}

/** Collect { label, text } pairs for every user-facing string. */
export function collect() {
  const out = [];

  for (const rel of [...HTML_FILES, ...TSX_FILES, ...FORM_FILES]) {
    let raw;
    try {
      raw = readFileSync(join(root, rel), "utf8");
    } catch (e) {
      out.push({ label: rel, text: "", error: e.message });
      continue;
    }
    if (rel.endsWith(".json")) {
      // Every string value, `$`-prefixed keys INCLUDED — the inverse of
      // the listing rule below, and deliberately. In listing.json a `$`
      // key is a note to the operator and the shipped copy is elsewhere;
      // in app-privacy.json the `$` keys ARE the prose, the notes a human
      // answers Apple's form from. Excluding them here would scan a file
      // of booleans and enums and call it covered.
      const seen = [];
      const walkJson = (node) => {
        if (typeof node === "string") seen.push(node);
        else if (Array.isArray(node)) node.forEach(walkJson);
        else if (node && typeof node === "object") Object.values(node).forEach(walkJson);
      };
      try {
        walkJson(JSON.parse(raw));
      } catch (e) {
        out.push({ label: rel, text: "", error: e.message });
        continue;
      }
      out.push({ label: rel, text: seen.join("\n") });
      continue;
    }
    if (rel.endsWith(".md")) {
      // Markdown carries no comment syntax the gate needs to strip, and
      // its history lines are past tense, which every pattern here is
      // written to leave alone.
      out.push({ label: rel, text: raw });
      continue;
    }
    if (/\.(tsx?|jsx?)$/.test(rel)) {
      // Strip block and line comments: a TSX file's comments explain the
      // history to the next maintainer and quote the old wording on
      // purpose — LivePrivacyPanel's does exactly that, twice. Scanning
      // them would fire on the very note that documents the fix.
      raw = raw.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
    } else {
      raw = raw.replace(/<!--[\s\S]*?-->/g, " ");
    }
    out.push({ label: rel, text: raw });
  }

  let listing;
  try {
    listing = JSON.parse(readFileSync(join(root, LISTING), "utf8"));
  } catch (e) {
    out.push({ label: LISTING, text: "", error: e.message });
    return out;
  }
  const walk = (node, path) => {
    if (typeof node === "string") {
      out.push({ label: `${LISTING} → ${path}`, text: node });
      return;
    }
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${path}[${i}]`));
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (isAnnotationKey(k)) continue;
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  };
  walk(listing, "");
  return out;
}

/** The whole check, as data: every finding across every listed surface. */
export function scan() {
  const problems = [];
  const readErrors = [];
  const surfaces = collect();
  for (const { label, text, error } of surfaces) {
    if (error) { readErrors.push(`${label} — ${error}`); continue; }
    for (const hit of scanText(text)) problems.push({ label, ...hit });
    if (DUEL_SURFACES.includes(label)) {
      for (const hit of scanVoice(text)) problems.push({ label, ...hit });
    }
  }
  // A surface named in DUEL_SURFACES that collect() did not read is a list
  // gone stale — the file moved, and its voice is unguarded again.
  for (const f of DUEL_SURFACES) {
    if (!surfaces.some((s) => s.label === f)) readErrors.push(`${f} — named in DUEL_SURFACES but not collected`);
  }
  return { surfaces, problems, readErrors };
}

// ── CLI ──
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
const { surfaces, problems, readErrors } = scan();

if (readErrors.length) {
  console.error("check-public-copy: could not read a listed surface —");
  for (const e of readErrors) console.error(`  ${e}`);
  process.exit(1);
}

if (problems.length) {
  console.error("check-public-copy: copy a user reads says something the app no longer does.\n");
  for (const p of problems) {
    console.error(`  ${p.label}`);
    console.error(`    matched : ${p.matched}`);
    console.error(`    but     : ${p.why}`);
    console.error(`    context : …${p.excerpt}…\n`);
  }
  console.error("Answers are public (D98): world-readable and attributed, counts exact");
  console.error("from the first answer, takes named at every scope. Copy that promises");
  console.error("otherwise claims a protection firestore.rules does not give — the");
  console.error("UI-says-it/server-doesn't failure, pointed at the user.");
  console.error("");
  console.error("Past-tense history is fine and is meant to stay: these patterns match");
  console.error("present-tense claims only. If you are recording what the app USED to");
  console.error("do, write it in the past tense the way web/privacy.html does.");
  console.error("");
  console.error("Background: docs/DECISIONS.md D98, D106, D116.");
  process.exit(1);
}

console.log(`check-public-copy OK — ${surfaces.length} user-facing strings, no retired-model claims; the duel surfaces (${DUEL_SURFACES.length}) in the owner's voice.`);
}

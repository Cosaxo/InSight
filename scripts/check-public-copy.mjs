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

import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The enumerated surfaces. Adding a user-facing page means adding it
// here; that one line is the whole remedy D106 asked for.
const HTML_FILES = [
  "web/privacy.html",
  "web/home.html",
  "web/terms.html",
];
// The app's own panels are WALKED, not listed, and that is this gate
// finally taking its own advice.
//
// The header above argues that D106's remedy failed because it was a
// discipline — "a discipline cannot catch the surface it forgot to list; a
// file list can, and the list is the point of this script". A
// hand-maintained literal IS a discipline; it just moved into the gate.
// And it had already forgotten a surface, pointedly the one the header
// names: LivePrivacyPanel claimed takes were nameless "while
// LiveTakesPanel rendered every author's name", and LiveTakesPanel.tsx was
// not on the list. One panel of thirty-nine was scanned, plus none of
// spec/'s ~100 JSX surfaces, all of them user-visible copy compiled into
// the same binary this gate stands on the release path to protect.
//
// Measured before switching: RETIRED over all 131 walked files hits zero
// times on this tree, so the walk costs nothing today and closes the hole
// permanently. It also removes the failure mode where adding a panel means
// remembering to add a line.
const APP_COPY_DIRS = [
  { dir: "src/v2/ui", keep: (f) => f.endsWith(".tsx") && !f.includes(".test.") },
  { dir: "src/v2/spec", keep: (f) => /\.(jsx|js)$/.test(f) && !f.includes(".test.") },
];

// A floor, the check-panel-suites / check-deploy-targets shape: a walk that
// finds nothing reports OK on nothing, which is the silent success every
// gate here is written against. Thirty-nine panels and ~92 spec modules
// today; the floor sits far enough below to survive ordinary deletion and
// far enough above to catch a moved or renamed directory.
const APP_COPY_FLOOR = 80;

const LISTING = "design/store/listing.json";

function walkCopy() {
  const out = [];
  for (const { dir, keep } of APP_COPY_DIRS) {
    const abs = join(root, dir);
    let entries;
    try {
      entries = readdirSync(abs, { recursive: true });
    } catch {
      // A missing directory is a failure, not an empty scan — reported by
      // the floor below rather than swallowed here.
      continue;
    }
    for (const e of entries) {
      const rel = String(e).split(sep).join("/");
      const name = rel.split("/").pop();
      if (!keep(name)) continue;
      try {
        if (!statSync(join(abs, rel)).isFile()) continue;
      } catch { continue; }
      out.push(`${dir}/${rel}`);
    }
  }
  return out.sort();
}

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
];

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

  const appCopy = walkCopy();
  if (appCopy.length < APP_COPY_FLOOR) {
    out.push({
      label: `${APP_COPY_DIRS.map((d) => d.dir).join(" + ")} (walk)`,
      text: "",
      error: `found ${appCopy.length} copy files, expected at least ${APP_COPY_FLOOR} — `
        + "a walk that finds nothing reports OK on nothing. Has a directory moved?",
    });
  }

  for (const rel of [...HTML_FILES, ...appCopy]) {
    let raw;
    try {
      raw = readFileSync(join(root, rel), "utf8");
    } catch (e) {
      out.push({ label: rel, text: "", error: e.message });
      continue;
    }
    if (/\.(tsx|jsx|js)$/.test(rel)) {
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
  console.error("check-public-copy: the retired privacy model is back in copy a user reads.\n");
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

console.log(`check-public-copy OK — ${surfaces.length} user-facing strings, no retired-model claims.`);
}

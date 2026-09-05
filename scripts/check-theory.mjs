#!/usr/bin/env node
// check-theory.mjs — hold the axiom papers to the form that keeps them theory.
//
//   npm run check:theory
//
// WHY THIS EXISTS. The first attempt at axiom theory ran twelve scheduled
// lanes on an orphan branch for ten days (2026-08-25 → 09-03), produced
// 129 claims, and failed at the job: it theorized the current app instead
// of the perfect form of each axis. Measured on whether a claim reasoned
// about the perfect form at all, 61% of the seed claims did and 14% of
// everything added afterwards did. The cause was structural, not anyone's
// choice: an evidence ladder whose upper rungs were "cited" (matches an
// existing paper) and "measured" (matches the current app), so the only
// way to raise a claim's standing was to narrow it until it matched one
// of the two. The charter had asked for cross-axis, perfect-form work from
// day one, in prose, and got none in 129 claims — and the branch's own
// graph-optimizer lane recorded the general finding: an unenforced
// convention does not converge across fresh sessions, it drifts.
//
// So the form is held by a script rather than a paragraph. Nothing here
// reads whether a paper is TRUE, interesting or frontier — that is the
// owner's five-minute read, and no rubric replaces it (a rubric is a
// gradient, and the last one rewarded exactly the wrong things). This
// checks the SHAPE that stops the drift:
//
//   1. The status line — **Status: theory research.** — in the head. A
//      paper that does not announce itself as theory is read as a plan or
//      as a description of the tree, which is the expensive mistake
//      ORIENTATION.md's Status column exists to prevent.
//   2. The perfect-form test — the sentence "if the app did not exist" —
//      the one question every claim must survive, written where a reader
//      meets it first.
//   3. An abstract.
//   4. At least two axes named from the axes vocabulary below. Cross-axis
//      or it does not count: the subject is which data makes other data
//      mean more, never one axis alone.
//   5. A conditions section and a potential section. "What would have to
//      hold" is what replaces a citation; the potential at full population
//      is the point, and a paper without it is a list of limits.
//   6. No citation shapes — a link, a DOI, "et al", a bracketed year or
//      reference number. This is not "citations optional": a citation was
//      the mechanism that traded ambition for defensibility last time, and
//      a claim about capability cannot be cited to a literature describing
//      data that does not exist yet.
//   7. No app internals — a source path, a source-file extension, a
//      backend product name, a collection prefix, a gate name, an npm
//      script, a decision number. A paper that names the tree is
//      describing it, and description belongs in docs/, not here.
//
// SCOPE. research/axiom-theory/paper-*.md only. research/README.md is the
// series' own map: it legitimately names paths, gates and decisions, so it
// is not a paper and is not scanned. The rules are regular expressions
// over a closed vocabulary, the same class of check as check:public-copy —
// name-level, buildable, and honest about what it does not read.
//
// Docs-only, so it stays OFF backend-checks.yml: nothing it says bears on
// whether a rules deploy is safe, and a theory paper's form must never be
// able to block an emergency one (CLAUDE.md).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export const PAPERS_DIR = "research/axiom-theory";
export const PAPER_FILE = /^paper-[0-9a-z-]+\.md$/;

// The axes vocabulary, one entry per axis the theory may cross. The
// patterns are deliberately generous — a paper written for a reader
// outside the product names an axis by what it is ("a keyed test", "sealed
// predictions"), not only by the app's noun — because rule 4 is a LOWER
// bound: two distinct axes, not a census of which ones.
export const AXES = [
  ["genome", /\bgenom(?:e|es|ic)\b|\bgenetic/i],
  ["logic test", /\b(?:logic|reasoning) (?:test|score)\b|\bkeyed (?:test|score|instrument|measurement)\b/i],
  ["the bank", /\bbank\b/i],
  ["instruments", /\binstruments?\b|\btrait scales?\b/i],
  ["lenses", /\blens(?:es)?\b/i],
  ["interests", /\binterests?\b/i],
  ["ties", /\bties?\b|\bduels?\b|\bguess(?:es|ing)?\b|\bsealed prediction/i],
  ["body", /\bbody\b|\bsleep\b|\billness\b/i],
  ["anchors", /\banchors\b|\bprofile facts?\b|\beducation band\b/i],
];

export const REQUIRED = [
  {
    name: "a title",
    re: /^# \S/m,
    why: "a paper opens with a title heading",
  },
  {
    name: "the status line",
    re: /\*\*Status:\s*theory research\.?\*\*/i,
    why: "a paper announces itself as theory research in its head, or it gets read as a plan or as a description of the tree",
  },
  {
    name: "the perfect-form test",
    re: /if the app did not exist/i,
    why: 'every claim must survive "would this still be worth saying if the app did not exist?", and the sentence is written where the reader meets it first',
  },
  {
    name: "an abstract",
    re: /\*\*Abstract\.?\*\*/,
    why: "a paper has an abstract; a reader with five minutes reads it and the perfect-form sentence",
  },
  {
    name: "a conditions section",
    re: /^\*\*\d+[a-z]?\s*·[^\n]*\b(?:hold|conditions?)\b[^\n]*\*\*\s*$/im,
    why: '"what would have to hold" is what replaces a citation: a paper states its conditions as part of the theory, as a numbered section',
  },
  {
    name: "a potential section",
    re: /^\*\*\d+[a-z]?\s*·[^\n]*\bpotential\b[^\n]*\*\*\s*$/im,
    why: "the potential at full population is the point; a paper without a potential section is a list of limits",
  },
];

export const FORBIDDEN = [
  {
    name: "a link",
    re: /https?:\/\/|\bwww\./i,
    why: "a link is a citation, and a citation is how the last attempt traded ambition for defensibility",
  },
  {
    name: "a DOI",
    re: /\bdoi\b|\b10\.\d{4,9}\/\S+/i,
    why: "a DOI is a citation: it points at what a paper found rather than at what would have to hold",
  },
  {
    name: '"et al"',
    re: /\bet al\b/i,
    why: '"et al" is a citation; say what would have to hold, not who found it',
  },
  {
    name: "a bracketed year or reference number",
    re: /\(\s*(?:19|20)\d{2}[a-z]?\s*\)|\[\d{1,3}\]/,
    why: "a bracketed year or number is a citation's shape",
  },
  {
    name: "a source path or source-file extension",
    re: /\b(?:src|functions|scripts|firestore-tests|design|content|web)\/[\w./-]*|\.(?:tsx?|jsx?|mjs|cjs|json|css|rules)\b/i,
    why: "a paper that names a file in the tree is describing the tree; the perfect form has no files",
  },
  {
    name: "a backend product or collection name",
    re: /\bfirestore\b|\bfirebase\b|\bv2_[a-z_]+|\bcloud functions?\b/i,
    why: "the current storage is an engineering fact, not part of any axis's perfect form",
  },
  {
    name: "a gate or npm script",
    re: /\bcheck:[a-z-]+|\bnpm run\b|\btest:[a-z:-]+/i,
    why: "a gate belongs to the tree; a paper does not know the tree exists",
  },
  {
    name: "a decision number",
    re: /\bD\d{1,3}\b/,
    why: "a decision number ties the claim to the tree's history; a paper argues from what would have to hold, not from what was decided",
  },
];

/**
 * Scan one paper's text. Pure: no I/O, so the test can drive it with
 * fixtures and the CLI with files.
 * @param {string} text
 * @returns {{ problems: {rule:string, why:string, line:number, excerpt:string}[], axes: string[] }}
 */
export function scanPaper(text) {
  const problems = [];
  const lines = String(text).split("\n");

  for (const rule of REQUIRED) {
    if (!rule.re.test(text)) {
      problems.push({ rule: `missing ${rule.name}`, why: rule.why, line: 0, excerpt: "" });
    }
  }

  for (const rule of FORBIDDEN) {
    lines.forEach((l, i) => {
      const m = rule.re.exec(l);
      if (!m) return;
      const at = m.index;
      problems.push({
        rule: `contains ${rule.name}`,
        why: rule.why,
        line: i + 1,
        excerpt: l.slice(Math.max(0, at - 40), at + m[0].length + 40).trim(),
      });
    });
  }

  const axes = AXES.filter(([, re]) => re.test(text)).map(([name]) => name);
  if (axes.length < 2) {
    problems.push({
      rule: "names fewer than two axes",
      why: `cross-axis or it does not count: a paper names at least two axes and says what neither says alone (found: ${axes.join(", ") || "none"})`,
      line: 0,
      excerpt: "",
    });
  }

  return { problems, axes };
}

/** List the papers on disk, sorted; the README is not a paper. */
export function listPapers(dir = join(root, PAPERS_DIR)) {
  if (!existsSync(dir)) return null;
  return readdirSync(dir).filter((f) => PAPER_FILE.test(f)).sort();
}

// ── CLI ──
const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const dir = join(root, PAPERS_DIR);
  const papers = listPapers(dir);
  if (papers === null) {
    console.error(
      `check-theory: ${PAPERS_DIR}/ does not exist. If the series moved, move PAPERS_DIR with it —` +
        " a gate that passes on a missing directory is guarding nothing.",
    );
    process.exit(1);
  }

  let failed = 0;
  for (const paper of papers) {
    const { problems } = scanPaper(readFileSync(join(dir, paper), "utf8"));
    if (!problems.length) continue;
    failed += 1;
    console.error(`\n${PAPERS_DIR}/${paper}`);
    for (const p of problems) {
      console.error(`  ✗ ${p.rule}${p.line ? ` (line ${p.line})` : ""}`);
      console.error(`      why : ${p.why}`);
      if (p.excerpt) console.error(`      at  : …${p.excerpt}…`);
    }
  }

  if (failed) {
    console.error(
      `\ncheck-theory FAILED — ${failed} of ${papers.length} paper(s) break the form.` +
        "\nThe form is what stopped the last attempt's drift from the perfect form back to the" +
        "\ncurrent app; a paper that fails it is not theory yet. research/README.md has the rules.",
    );
    process.exit(1);
  }

  console.log(
    `check-theory OK — ${papers.length} paper(s) in ${PAPERS_DIR}/ carry the form:` +
      " status line, perfect-form test, abstract, two or more axes, conditions and potential," +
      " no citations, no app internals.",
  );
}

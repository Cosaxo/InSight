// decision-numbering.mjs — is every decision number claimed exactly once,
// and is every one it cites claimed by something?
//
// EXTRACTED SO IT CAN BE TESTED, for the reason scorecard-metrics.mjs gives
// about the split-quality arithmetic: doc-index.mjs runs its whole gate at
// import and calls process.exit(1) when anything is wrong, so a test that
// imported it would be hostage to every unrelated documentation problem in
// the tree. This has no side effects and no I/O.
//
// WHY THE RULE EXISTS, and it is not hypothetical. Decision records are
// written on branches, and main's night lanes record decisions
// continuously — so a branch that records one and stays open for a day
// comes back to find its number taken. That happened THREE TIMES in two
// days (2026-08-25/26): D275-D277 became D290-D292, then D293-D296 became
// D294-D297, then D295-D298. Each renumber is hand work across the record
// and every file that cites it, and it must leave the OTHER side's numbers
// untouched — docs/data-inventory.md's D293 and CLAUDE.md's D294 are
// main's, and a blanket replace would have corrupted a dozen shared files.
//
// A blanket replace also reaches where no citation is. 2026-09-08, moving
// D421/D422 to D424/D425 on a branch: `grep -l 'D421\|D422'` listed
// design/InSight_standalone_18.html, which cites no decision — the match
// was inside a base64 data URI, and sed rewrote two characters of a
// compressed blob. Caught only because the file list was printed and read
// before the commit; restored from the pre-move commit. Move by the file
// list you can EXPLAIN, and treat a match in design/ or any encoded blob
// as a false one until proven otherwise.
//
// Hand work at that shape misses one. Until 2026-08-26 nothing caught it:
// two records numbered D297 passed every gate in this repo, and doc-index
// cheerfully reported "298 decisions indexed" over 298 headings sharing 297
// numbers — because it counted headings and never asked whether the numbers
// were distinct. Verified by duplicating a heading and watching the whole
// suite stay green.
//
// What a duplicate costs: DECISIONS-INDEX.md renders two rows claiming the
// same id, every citation of that number in the tree becomes ambiguous, and
// the next author reads the highest number and picks one that orphans a
// record.
//
// A HOLE USED TO FAIL HERE TOO, and it no longer does — 2026-09-06, on the
// owner's instruction after it cost a morning. The reasoning it was written
// with ("the same mistake with the other sign — a renumber that shifted
// three records of four") is sound about main and wrong about a branch, and
// nothing in this module could tell the two apart:
//
//   · On a BRANCH a hole is the normal state. Three PRs were open at once
//     claiming D387, D388 and D389; each one's own head has holes where the
//     other two sit, so each was red until the others merged. That makes
//     decision numbers imply a MERGE ORDER, which is a coupling nobody
//     chose — and it arrived because D385 retired the shepherd, whose job
//     had included moving colliding numbers at merge time.
//   · After an out-of-order merge a hole on MAIN is legitimate too, and
//     lasts until the lower-numbered PR lands.
//
// What the hole rule was really a proxy for is a partial renumber, and the
// half of that with teeth IS still refused: a record left behind at its old
// number collides with whatever took it — a duplicate, the case that
// actually happened (two records at D297, 2026-08-26).
//
// THE OTHER HALF IS A NOTE, and the first run of this file is why. A
// citation left behind points at a number no record claims, which reads
// like a fault worth failing on — so it was written as one, and it failed
// on the record introducing it: D408 cites D387, D388 and D389 while
// naming the three pull requests holding them. That is not a partial
// renumber. A hole and a citation into that hole are ONE fact seen twice —
// this head does not have that number, because another head does — so
// failing on the second while excusing the first just puts merge order
// back under a different name. Both are reported together by
// `unclaimedNumbers`, which names the citers when there are any, because
// "D387 is unclaimed and D408 points at it" is the sentence a reader
// wants. What survives unrefused is a citation typo landing on a free
// number; it prints every run, and the alternative was a gate that made
// three open branches take turns.

/**
 * @param {{num:number, kind:string, line:number}[]} records
 *   As parsed by doc-index.mjs. `kind` is "record" for a numbered decision
 *   and "amendment"/"adoption" for a follow-on.
 * @returns {string[]} problems, empty when the numbering is sound.
 */
export function numberingProblems(records) {
  // Amendments and adoptions are exempt BY CONSTRUCTION, not by omission:
  // they attach to a parent record and claim no number of their own, which
  // is exactly why parseDecisions gives them a different `kind`. D7 and its
  // amendment both say "D7"; only one of them is claiming it.
  const numbered = (records || []).filter((r) => r && r.kind === "record");
  const problems = [];
  const seen = new Map();

  for (const r of numbered) {
    if (seen.has(r.num)) {
      problems.push(
        `docs/DECISIONS.md:${r.line} — D${r.num} is claimed twice `
        + `(also line ${seen.get(r.num)}). A renumber missed one; every citation `
        + `of D${r.num} in the tree is now ambiguous.`,
      );
    } else {
      seen.set(r.num, r.line);
    }
  }

  return problems;
}

/**
 * Every number in the sequence that no record claims, with whoever cites it.
 *
 * REPORTED, NEVER A FAILURE — see the header. On a branch these are the
 * numbers other open pull requests are holding, and on main they are the
 * ones whose pull requests have not merged yet. Worth printing so a hole
 * that is genuinely a lost record stays visible to a reader; not worth
 * refusing a tree over, because doing so makes merge order load-bearing.
 *
 * Two sources: the gaps between the lowest and highest record, and every
 * citation landing on a number no record claims — including one ABOVE the
 * last record, so a lone `D408` in a tree ending at D390 is reported
 * rather than falling off the end.
 *
 * @param {{num:number, kind:string}[]} records
 * @param {Map<number, Set<number>|number[]>|null} [cited]
 *   Optional: target number → the record numbers citing it, as
 *   doc-index.mjs's `citations()` collects them from DECISIONS.md bodies.
 *   Scoped to that file on purpose — its citations are the ones a renumber
 *   has to carry, and a tree-wide scan would read every D-number in a code
 *   comment as a claim about this file.
 * @returns {{num:number, citers:number[]}[]} ascending; `citers` empty when
 *   nothing points at the number.
 */
/** Sort keys at or above this belong to a DATED record (`D-YYYY-MM-DDx`),
 *  not to the numbered sequence D1-D449 (D-2026-09-09e). */
export const DATED_BASE = 1_000_000;

/** A sort key that keeps D1-D449 in their own numeric run and files every
 *  dated record after them, chronologically, then by letter.
 *
 *  The base is far above any number this file will ever reach, so the two
 *  vocabularies cannot interleave: a reader scrolling the index meets the
 *  historical run first and the dated records as a continuous tail. */
export function orderOf(id) {
  const dated = /^D-(\d{4})-(\d{2})-(\d{2})([a-z]?)$/.exec(id);
  if (dated) {
    const [, y, m, d, letter] = dated;
    const day = Number(`${y}${m}${d}`);
    return DATED_BASE + day * 100 + (letter ? letter.charCodeAt(0) - 96 : 0);
  }
  return Number(id.replace(/^D/, "").replace(/[a-z]$/, ""));
}

export function unclaimedNumbers(records, cited = null) {
  // DATED RECORDS ARE NOT PART OF THE SEQUENCE, and must not be, for two
  // separate reasons (D-2026-09-09e). Their sort key is above DATED_BASE,
  // so including them would make the gap scan below walk from D1 to a
  // billion — it did, and threw `Set maximum size exceeded` the first time
  // a dated record was written. And the scan would be meaningless anyway:
  // a hole is a number somebody CLAIMED and then moved away from, which is
  // exactly the failure mode dated ids remove. There is no such thing as
  // an unclaimed date.
  const nums = [...new Set(
    (records || [])
      .filter((r) => r && r.kind === "record" && r.num < DATED_BASE)
      .map((r) => r.num),
  )].sort((a, b) => a - b);
  if (!nums.length) return [];
  const have = new Set(nums);
  const targets = new Map();
  for (const [target, citers] of cited || []) {
    // A citation of a dated record is never a hole either — same reason.
    if (target >= DATED_BASE) continue;
    if (!have.has(target)) targets.set(target, [...citers].sort((a, b) => a - b));
  }

  // Two sources, unioned: the gaps INSIDE the sequence, and every citation
  // landing outside it. Kept separate on purpose — extending the gap scan
  // up to a stray `D408` in a tree ending at D390 would report D391..D399
  // as holes too, which is nine numbers nobody has anything to do with.
  const report = new Set(targets.keys());
  for (let n = nums[0]; n < nums[nums.length - 1]; n++) if (!have.has(n)) report.add(n);

  return [...report].sort((a, b) => a - b)
    .map((num) => ({ num, citers: targets.get(num) || [] }));
  // NOTE for whoever renders this: a citer may be a DATED record, whose
  // `num` is a sort key rather than a name (D-2026-09-09e). Render it
  // through the caller's id lookup, not as `D${num}` — the first version
  // of this printed "cited by D2027090905".
}

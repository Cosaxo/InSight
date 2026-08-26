// decision-numbering.mjs — is every decision number claimed exactly once,
// and is the sequence unbroken?
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
// record. A hole is the same mistake with the other sign — a renumber that
// shifted three records of four.

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

  const nums = [...seen.keys()].sort((a, b) => a - b);
  if (nums.length) {
    const lo = nums[0];
    const hi = nums[nums.length - 1];
    const holes = [];
    for (let n = lo; n < hi; n++) if (!seen.has(n)) holes.push(n);
    if (holes.length) {
      problems.push(
        `docs/DECISIONS.md — no record claims ${holes.map((n) => `D${n}`).join(", ")}, `
        + `and the sequence runs D${lo}-D${hi}. A hole is a renumber that shifted `
        + "some records and not others, or a record that was written and lost. "
        + "Records are amended here, never deleted, so there is no legitimate gap.",
      );
    }
  }
  return problems;
}

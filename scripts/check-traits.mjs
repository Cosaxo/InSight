// The trait cube's vocabulary is generated, closed, and the same on both
// sides.
//
//   npm run check:traits
//
// WHY THIS EXISTS. D330 put a COPY of the app's type matcher in
// `functions/` — the client authors archetype signatures, baselines and
// band thresholds in `src/v2/spec/`, and the server has to reach the same
// verdict about the same person or the who-voted sheet, the result card
// and the sold report start naming different types for one person. A copy
// with no gate is the documentation error this repo keeps re-committing,
// one layer down: nothing fails, the cohorts are just wrong.
//
// FOUR RULES, `check-anchors.mjs`'s discipline:
//
//   1. `functions/src/traitsContent.ts` is byte-identical to a fresh
//      generation — `check:content`'s rule, for the same reason (a hand
//      edit, or a client change with no regen, must fail here).
//   2. Every dim's vocabulary is shorter than `BREAKDOWN_MAX_BUCKETS`,
//      read out of `pure.ts` rather than retyped. This is what makes the
//      dimension unexhaustible; it is stronger here than for anchors
//      because the buckets are SERVER-derived, so no caller can send a
//      value at all.
//   3. Every bucket key survives `breakdownBucket` — the rejected
//      character class read out of `pure.ts` by the same extraction
//      check-anchors uses, the `BREAKDOWN_MAX_LABEL` cap, no key on
//      `Object.prototype`, unique within its dim.
//   4. The CLIENT (`src/v2/data/traitDims.ts`) and the SERVER
//      (`functions/src/traitsFit.ts`) agree on the instruments and their
//      ORDER. A client that orders them differently draws the right rows
//      under the wrong chip, and nothing else in the tree would notice.
//
// Refuses to pass on an empty parse: an empty match is how a gate like
// this stops meaning anything without ever failing (check-anchors' own
// rule, learned the hard way at D197).
//
// The rules are exported as pure functions and driven by
// `scripts/check-traits.test.mjs` under `npm run test:scripts` — the
// fifth runner hides in CI's lint job, and what breaks in it is always a
// script that CHECKS something (D179/D197/D275).
//
// ON THE DEPLOY PATH (backend-checks.yml), the `check:catalogs`
// precedent: the deployed sweep folds by these vocabularies, so a stale
// copy is a backend correctness problem and not a client one.
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generate, OUT, KINDS } from "./gen-traits.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

export const PROTO_KEYS = new Set(Object.getOwnPropertyNames(Object.prototype));

/** Read an exported int constant out of a source file. */
export function intConst(src, name) {
  const m = new RegExp(`export const ${name} = (\\d+)`).exec(src);
  return m ? Number(m[1]) : null;
}

/** breakdownBucket's rejected character class, read out of the function
 *  rather than restated — check-anchors' extraction, character for
 *  character, because two gates reading one function is the point and a
 *  second spelling of the pattern would be the drift both prevent. */
export function rejectClass(pureSrc) {
  const m = pureSrc.match(/if \((\/\[[^\n]*?\/)\.test\(v\)\) return null;/);
  return m ? new RegExp(m[1].slice(1, -1)) : null;
}

/**
 * Rules 2 and 3, over a `dim → buckets` map.
 *
 * `limits` carries what was read out of pure.ts; a null there is itself a
 * finding, because a gate that cannot read its own bounds is not checking
 * anything.
 */
export function vocabProblems(vocab, limits) {
  const problems = [];
  const { maxBuckets, maxLabel, reject } = limits;
  if (maxBuckets == null) problems.push("could not read BREAKDOWN_MAX_BUCKETS out of functions/src/pure.ts.");
  if (maxLabel == null) problems.push("could not read BREAKDOWN_MAX_LABEL out of functions/src/pure.ts.");
  if (!reject) problems.push("could not read breakdownBucket's rejected character class out of pure.ts.");
  const dims = Object.keys(vocab);
  if (dims.length < 10) {
    problems.push(`the vocabulary parse produced ${dims.length} dims — the gate is broken, not the tree.`);
  }
  for (const dim of dims) {
    const list = vocab[dim];
    if (!Array.isArray(list) || !list.length) {
      problems.push(`${dim}: no buckets at all.`);
      continue;
    }
    if (maxBuckets != null && list.length >= maxBuckets) {
      problems.push(
        `${dim}: ${list.length} buckets against BREAKDOWN_MAX_BUCKETS=${maxBuckets}.\n`
        + "    A vocabulary at or past the cap can evict, and an evicting dim is not a census.",
      );
    }
    const seen = new Set();
    for (const bucket of list) {
      if (typeof bucket !== "string" || !bucket.trim()) {
        problems.push(`${dim}: an empty bucket key.`);
        continue;
      }
      if (reject && reject.test(bucket)) {
        problems.push(`${dim}: bucket "${bucket}" contains a character breakdownBucket refuses.`);
      }
      if (maxLabel != null && bucket.length > maxLabel) {
        problems.push(`${dim}: bucket "${bucket}" is ${bucket.length} chars, over BREAKDOWN_MAX_LABEL=${maxLabel}.`);
      }
      if (PROTO_KEYS.has(bucket)) {
        problems.push(
          `${dim}: bucket "${bucket}" is a key on Object.prototype.\n`
          + "    pure.ts's own comment measures what that costs: the fold's assignment\n"
          + "    would write the prototype chain instead of a field.",
        );
      }
      if (seen.has(bucket)) problems.push(`${dim}: bucket "${bucket}" appears twice.`);
      seen.add(bucket);
    }
  }
  return problems;
}

/**
 * Rule 4 — the instruments and their order, on both sides.
 *
 * Both files build axis dims by template (`${kind}_${axis}`) from the same
 * two authored modules, which rule 1 pins; what has to match literally is
 * the instrument list and the order the sheet draws its chips in.
 */
export function orderProblems(serverSrc, clientSrc, kinds) {
  const problems = [];
  // Ordered by WHERE each instrument first appears in the file, not by
  // the reference list's own order — the first draft filtered `kinds`,
  // which returns the reference order whatever the source says and so
  // could never see a flip at all. Its own test caught that; keep the
  // positional read.
  const orderOf = (src) => kinds
    .map((k) => ({ k, at: src.indexOf(`"${k}"`) }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map((x) => x.k);
  const a = orderOf(serverSrc);
  const b = orderOf(clientSrc);
  if (!a.length || !b.length) {
    problems.push(
      "rule 4 matched no instruments on one side — treat as broken, not as passing.\n"
      + `    server: [${a}]  client: [${b}]`,
    );
    return problems;
  }
  if (a.join(",") !== b.join(",")) {
    problems.push(
      "the client and server disagree about the instruments or their order:\n"
      + `    server: ${a.join(",")}\n    client: ${b.join(",")}\n`
      + "    The sheet draws each dim's rows under a chip chosen by this order.",
    );
  }
  return problems;
}

/** Rule 1 — the generated file is a fresh generation. */
export function staleProblems(onDisk, fresh) {
  if (onDisk === fresh) return [];
  return [
    `${OUT} is not what scripts/gen-traits.mjs generates today.\n`
    + "    Either it was hand-edited, or src/v2/spec/archetype-data.js /\n"
    + "    test-definitions.js changed without a regen. Run:\n"
    + "      npm run build:traits\n"
    + "    and commit the result — the server types people by this file, so a\n"
    + "    stale copy means the sheet and the result card disagree about a person.",
  ];
}

/** The tree's own vocabulary, built the way the fold builds it. */
export async function treeVocab() {
  const { IS_ARCHETYPES } = await import("../src/v2/spec/archetype-data.js");
  const { IS_TESTS } = await import("../src/v2/spec/test-definitions.js");
  const vocab = {};
  for (const kind of KINDS) {
    const list = IS_ARCHETYPES[kind]?.list ?? [];
    vocab[kind] = [...list.map((a) => a.name), "untested"];
    for (const d of IS_TESTS[kind].dims) {
      vocab[`${kind}_${d.id}`] = ["b0", "b1", "b2", "b3", "b4", "untested"];
    }
  }
  vocab.logic = ["top", "upper", "lower", "bottom", "untested"];
  return vocab;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pure = read("functions/src/pure.ts");
  const limits = {
    maxBuckets: intConst(pure, "BREAKDOWN_MAX_BUCKETS"),
    maxLabel: intConst(pure, "BREAKDOWN_MAX_LABEL"),
    reject: rejectClass(pure),
  };
  const vocab = await treeVocab();
  const problems = [
    ...staleProblems(read(OUT), generate()),
    ...vocabProblems(vocab, limits),
    ...orderProblems(read("functions/src/traitsFit.ts") + read(OUT), read("src/v2/data/traitDims.ts"), KINDS),
  ];
  if (problems.length) {
    console.error("check-traits FAILED:\n");
    for (const p of problems) console.error(`  ${p}\n`);
    process.exit(1);
  }
  const buckets = Object.values(vocab).reduce((n, l) => n + l.length, 0);
  console.log(
    `check-traits OK — ${Object.keys(vocab).length} dims, ${buckets} buckets, `
    + `all under BREAKDOWN_MAX_BUCKETS=${limits.maxBuckets}; ${OUT} is a fresh generation; `
    + "client and server agree on the instruments and their order.",
  );
}

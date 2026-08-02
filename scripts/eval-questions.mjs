// The farm's pre-flight bench (D38): mechanical scoring for candidate
// daily questions BEFORE they reach a PR. This is the half of the eval
// harness a script can do — shape, taxonomy, pred hygiene, similarity —
// and its output doubles as the truth-table the PR body needs, so the
// human review starts from a filled-in argument instead of raw JSX.
//
// The other half is judged, not measured: the blind panel protocol in
// QUESTION-FARM.md ("The eval panel") scores what no regex can —
// blind-answerable? splits-not-slides? warm-not-hot? — and the culling
// happens there. Overgenerate (about 2× budget), run this, panel the
// survivors, keep the budget's worth.
//
// Modes:
//   --diff           candidates = spec-archive entries appended relative
//                    to origin/main (the farm's normal working state)
//   --file <json>    candidates = an explicit JSON array of entries
// Exit 1 on any HARD failure — those never reach a PR.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCorpus, rankAgainst } from "./question-similarity.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fileIdx = process.argv.indexOf("--file");
const FILE = fileIdx >= 0 ? process.argv[fileIdx + 1] : null;
const DIFF = process.argv.includes("--diff");

const SPEC = join(root, "src", "v2", "spec", "daily-questions.js");
const parseQ = (src) => {
  const start = src.indexOf("const Q = [");
  const end = src.indexOf("\n  ];", start);
  if (start < 0 || end < 0) throw new Error("Q literal not found");
  return new Function("return [" + src.slice(start + "const Q = [".length, end) + "]")();
};

let candidates;
if (FILE) {
  candidates = JSON.parse(readFileSync(resolve(FILE), "utf8"));
} else if (DIFF) {
  const base = parseQ(
    execFileSync("git", ["show", "origin/main:src/v2/spec/daily-questions.js"], {
      cwd: root,
      encoding: "utf8",
    }),
  );
  const work = parseQ(readFileSync(SPEC, "utf8"));
  candidates = work.slice(base.length);
} else {
  console.error("eval-questions: pass --diff (appended archive entries) or --file <json>");
  process.exit(1);
}
if (!candidates.length) {
  console.log("eval-questions: no candidates — nothing appended relative to origin/main");
  process.exit(0);
}

// The category taxonomy, read from the archive itself so this bench can
// never drift from what the app renders (the check:pokedex cross-read
// pattern).
const specSrc = readFileSync(SPEC, "utf8");
const catM = specSrc.match(/const CAT_META = \{([\s\S]*?)\};/);
const CATS = catM ? [...catM[1].matchAll(/(\w+): \{/g)].map((m) => m[1]) : [];
if (!CATS.length) {
  console.error("eval-questions: CAT_META not found in the spec archive");
  process.exit(1);
}

const TONES = ["light", "blend", "deep"];
const N_OF = { binary: 2, choice: [3, 4], dilemma: [2, 3], scale: 5, rating: 10 };
const corpus = buildCorpus();

let hardFails = 0;
const rows = candidates.map((q) => {
  const hard = [];
  const warn = [];
  const kind = q.type;
  if (!(kind in N_OF)) hard.push(`unknown type ${JSON.stringify(kind)}`);
  if (kind === "binary" && (q.options || []).length !== 2) hard.push("binary needs exactly 2 options");
  if (kind === "choice" && !((q.options || []).length >= 3 && q.options.length <= 4)) hard.push("choice needs 3-4 options");
  if (kind === "dilemma" && !((q.options || []).length >= 2 && q.options.length <= 3)) hard.push("dilemma needs 2-3 options");
  if ((kind === "scale" || kind === "rating") && !q.axis) hard.push(`${kind} needs an axis slug`);
  if ((kind === "scale" || kind === "rating") && q.options) hard.push(`${kind} carries no options (they are synthesized)`);
  if (!TONES.includes(q.tone)) hard.push(`tone must be light/blend/deep`);
  if (!q.tag) warn.push("no tag");
  if (!Array.isArray(q.cat) || !CATS.includes(q.cat[0])) hard.push(`cat top must be an existing CAT_META key`);
  if (!Array.isArray(q.alts) || q.alts.length !== 2 || q.alts.some((a) => !CATS.includes(a[0]))) {
    hard.push("alts: exactly two paths with existing tops");
  }
  // pred is the D36 authoring rule — hard, because a hedged or missing
  // prediction makes the surprise signal worthless downstream.
  const n = kind === "scale" ? 5 : kind === "rating" ? 10 : (q.options || []).length;
  if (!Array.isArray(q.pred) || q.pred.length !== n) hard.push(`pred needs ${n} numbers`);
  else {
    const sum = q.pred.reduce((a, b) => a + b, 0);
    if (sum < 95 || sum > 105) hard.push(`pred sums to ${sum}`);
    if (Math.max(...q.pred) - Math.min(...q.pred) < 4 && n <= 4) warn.push("pred is near-uniform — hedged?");
  }
  if ((q.prompt || "").length > 90) warn.push(`prompt is ${q.prompt.length} chars — the voice is shorter`);
  const top = q.prompt ? rankAgainst(q.prompt, corpus)[0] : null;
  if (top && top.score >= 0.5) hard.push(`similarity ${top.score} vs [${top.source}] ${JSON.stringify(top.text)}`);
  else if (top && top.score >= 0.35) warn.push(`near-miss ${top.score} vs ${JSON.stringify(top.text)}`);
  if (hard.length) hardFails++;
  return { q, hard, warn, top };
});

// The truth-table — paste-ready for the PR body (QUESTION-FARM.md's
// review contract). One row per candidate; the "why it splits" column is
// the author's to fill, deliberately: the bench measures, it never argues.
console.log("| prompt | type·tone | cat | pred | nearest existing | flags |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (const r of rows) {
  const flags = [...r.hard.map((h) => `HARD: ${h}`), ...r.warn].join("; ") || "ok";
  console.log(
    `| ${r.q.prompt} | ${r.q.type}·${r.q.tone} | ${(r.q.cat || []).join("/")} | ${(r.q.pred || []).join("-")} | ` +
      `${r.top ? `${r.top.score} ${JSON.stringify(r.top.text)}` : "—"} | ${flags} |`,
  );
}
console.log(
  `\neval-questions: ${rows.length} candidates · ${hardFails} hard-failed · ` +
    `next: the blind panel (QUESTION-FARM.md § The eval panel), then cull to budget`,
);
if (hardFails) process.exit(1);

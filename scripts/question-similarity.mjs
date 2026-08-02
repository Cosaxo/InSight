// Near-duplicate radar for the question pools. Exact duplicates are
// gated (check:content); what a growing corpus actually accumulates is
// REPHRASES — "Mountains or sea?" vs "The mountains, or the coast?" —
// which no equality check sees and which read as a bug to users. This
// ranks similarity so the farm (and a human reviewer) can judge the
// near-misses instead of re-reading 300 prompts from memory.
//
// Metric: mean of token-set Jaccard and word-bigram Jaccard over
// lowercased, punctuation-stripped prompts. Crude on purpose — no
// dependencies, deterministic, and rephrases of short prompts are
// exactly what token overlap catches. Judgement stays with the reader:
// a high score is a QUESTION, not a verdict (two Pokémon picks may
// legitimately share most tokens).
//
// Modes:
//   (no args)            top 20 most-similar pairs across the whole corpus
//   --against "text"     rank the corpus against one candidate prompt
//                        (the farm runs this per candidate before a PR)
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── corpus: every prompt in every pool, plus the suggestion seeds ──
// Exported for eval-questions.mjs (D38), which scores candidate batches
// against the same corpus with the same metric.
export function buildCorpus() {
  const prompts = [];
  const push = (source, text) => {
    if (text && typeof text === "string") prompts.push({ source, text });
  };
  const spec = readFileSync(join(root, "src", "v2", "spec", "daily-questions.js"), "utf8");
  const qStart = spec.indexOf("const Q = [");
  const qEnd = spec.indexOf("\n  ];", qStart);
  new Function("return [" + spec.slice(qStart + "const Q = [".length, qEnd) + "]")().forEach((q) =>
    push("daily-archive", q.prompt),
  );
  const feed = JSON.parse(readFileSync(join(root, "content", "feed-questions.json"), "utf8"));
  feed.questions.forEach((q) => push("feed", q.prompt));
  const duel = JSON.parse(readFileSync(join(root, "content", "duel-questions.json"), "utf8"));
  duel.group.forEach((q) => push("group", q.prompt));
  duel.oneVsOne.forEach((q) => push("duo", q.prompt));
  const learn = JSON.parse(readFileSync(join(root, "content", "learn-questions.json"), "utf8"));
  learn.cards.forEach((c) => push("learn", c.q));
  // Suggestion-board seeds: regex the prompt literals out rather than
  // evaluating a JSX module.
  const sugg = readFileSync(join(root, "src", "v2", "spec", "suggestions.js"), "utf8");
  for (const m of sugg.matchAll(/prompt: '((?:[^'\\]|\\.)*)'/g)) push("suggestion", m[1]);
  return prompts;
}

// ── similarity ──
const tokens = (s) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
const bigrams = (ts) => ts.slice(0, -1).map((t, i) => t + " " + ts[i + 1]);
const jaccard = (a, b) => {
  if (!a.size && !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
};
export const features = (text) => {
  const ts = tokens(text);
  return { t: new Set(ts), b: new Set(bigrams(ts)) };
};
export const similarity = (fa, fb) => +((jaccard(fa.t, fb.t) + jaccard(fa.b, fb.b)) / 2).toFixed(3);

// Rank the corpus against one candidate; the 0.5 line is the farm's
// justify-or-drop threshold (QUESTION-FARM.md).
export function rankAgainst(text, corpus = buildCorpus()) {
  const fa = features(text);
  return corpus
    .map((p) => ({ source: p.source, text: p.text, score: similarity(fa, features(p.text)) }))
    .sort((a, b) => b.score - a.score);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const againstIdx = process.argv.indexOf("--against");
  const AGAINST = againstIdx >= 0 ? process.argv[againstIdx + 1] : null;
  const prompts = buildCorpus();
  const feats = prompts.map((p) => ({ ...p, f: features(p.text) }));

  if (AGAINST) {
  const fa = features(AGAINST);
  const ranked = feats
    .map((p) => ({ ...p, score: similarity(fa, p.f) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  console.log(`similarity vs ${JSON.stringify(AGAINST)} (corpus: ${prompts.length} prompts)`);
  for (const r of ranked) {
    console.log(`  ${r.score.toFixed(3)}  [${r.source}] ${JSON.stringify(r.text)}`);
  }
  // 0.5 is the review line the farm doc names: at or above it, justify
  // the near-miss in the PR body or drop the candidate.
  if (ranked[0] && ranked[0].score >= 0.5) process.exitCode = 2;
} else {
  const pairs = [];
  for (let i = 0; i < feats.length; i++) {
    for (let j = i + 1; j < feats.length; j++) {
      const score = similarity(feats[i].f, feats[j].f);
      if (score >= 0.3) pairs.push({ a: feats[i], b: feats[j], score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  console.log(`similarity: ${prompts.length} prompts · ${pairs.length} pairs ≥ 0.3 · top 20:`);
  for (const p of pairs.slice(0, 20)) {
    console.log(`  ${p.score.toFixed(3)}  [${p.a.source}] ${JSON.stringify(p.a.text)}`);
    console.log(`         [${p.b.source}] ${JSON.stringify(p.b.text)}`);
  }
}
}

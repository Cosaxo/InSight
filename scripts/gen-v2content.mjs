// Regenerates functions/src/v2content.ts — the launch question bank the
// v2 seed callable compiles in — from the canonical sources in /content.
//
// This is the recreated Phase-2 generator (the original lived only in
// session notes and was lost; recovery was proven by reproducing the
// committed file byte-for-byte before anything else changed). Byte
// identity IS the contract: check-content.mjs regenerates in memory and
// compares against the committed file on the deploy path, so any manual
// edit to v2content.ts, or any /content change without a regen, fails the
// gate. That only works if this script is deterministic down to the byte —
// hence the fixed property order, `JSON.stringify(…, null, 1)`, and the
// literal header below. Change any of those only together with a
// deliberate, reviewed regeneration of v2content.ts.
//
// Id scheme (stable forever — answers are immutable docs keyed by qid):
//   daily-NNN / duo-NNN      positional, zero-padded to 3
//   feed-<id> / group-<id>   explicit ids from the source JSON
//   test-<key>-NN            positional within each test, zero-padded to 2
// Positional ids mean INSERTING mid-array re-keys every later question and
// silently attaches live answers to the wrong prompt — append only.
//
// Modes: default = check (exit 1 if the committed file differs);
//        --write = regenerate the file (`npm run build:content`).
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(root, "content");
const OUT = join(root, "functions", "src", "v2content.ts");

// Shared by every `scale` question (daily and test surfaces). Not stored in
// the JSON sources — the 5-point agree scale is product-wide UI copy, and
// one constant here keeps 52 copies from drifting.
export const LIKERT = [
  "Strongly disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly agree",
];
const RATING = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

export function loadContent() {
  const load = (name) =>
    JSON.parse(readFileSync(join(CONTENT, name), "utf8"));
  return {
    daily: load("daily-questions.json"),
    feed: load("feed-questions.json"),
    duel: load("duel-questions.json"),
    tests: load("tests.json"),
  };
}

// Builds the 191 entries in emission order: daily → feed → group → duo →
// test. `seq` is per-surface and contiguous; note the test surface runs ONE
// counter across all four tests (test-political-00 has seq 10, not 0).
// Property order in each entry is load-bearing — JSON.stringify preserves
// insertion order, and the drift gate compares bytes.
export function buildEntries(content = loadContent()) {
  const { daily, feed, duel, tests } = content;
  const entries = [];

  daily.forEach((q, i) => {
    entries.push({
      id: `daily-${String(i).padStart(3, "0")}`,
      surface: "daily",
      seq: i,
      type: q.type,
      prompt: q.prompt,
      // scale/rating entries carry no options in the source — the scales
      // are synthesized; everything else lists its options explicitly.
      options:
        q.options ??
        (q.type === "scale" ? LIKERT : q.type === "rating" ? RATING : []),
      topic: q.tone,
      axis: q.axis ?? null,
      test: null,
    });
  });

  // feed.questions is already in emission order; topics/channels metadata
  // is client-only and never emitted. Demo counts on vote/duel options and
  // rank crowd/votes are dropped — live counts come from real answers (D1).
  feed.questions.forEach((q, i) => {
    entries.push({
      id: `feed-${q.id}`,
      surface: "feed",
      seq: i,
      type: q.type,
      prompt: q.prompt,
      options: q.options ? q.options.map((o) => o.label) : q.items,
      topic: q.cat,
      axis: null,
      test: null,
    });
  });

  // Group array order is deliberately interleaved (us/pick/classic) — it is
  // the rotation order. Never sort it. `pick` questions have no options
  // (the group's members are the options, filled in client-side).
  duel.group.forEach((q, i) => {
    entries.push({
      id: `group-${q.id}`,
      surface: "group",
      seq: i,
      type: "choice",
      prompt: q.prompt,
      options: q.options ?? [],
      topic: q.kind ?? "classic",
      axis: null,
      test: null,
    });
  });

  duel.oneVsOne.forEach((q, i) => {
    entries.push({
      id: `duo-${String(i).padStart(3, "0")}`,
      surface: "duo",
      seq: i,
      // Always "binary" — the duo reveal renders a two-sided comparison
      // even for the 3–4-option prompts.
      type: "binary",
      prompt: q.prompt,
      options: q.options,
      topic: null,
      axis: null,
      test: null,
    });
  });

  let testSeq = 0;
  for (const [key, t] of Object.entries(tests)) {
    t.questions.forEach((q, i) => {
      entries.push({
        id: `test-${key}-${String(i).padStart(2, "0")}`,
        surface: "test",
        seq: testSeq++,
        type: "scale",
        prompt: q.q,
        options: LIKERT,
        topic: "test",
        axis: q.d,
        test: key,
      });
    });
  }

  return entries;
}

// The header is emitted verbatim, ending mid-line so the array literal from
// JSON.stringify lands on the same line as the `=`. Terminator is `;\n`.
const HEADER =
  "// GENERATED from /content/*.json — do not hand-edit. There is no checked-in\n" +
  "// generator: scripts/gen-v2content.md records where it lived and the id\n" +
  "// scheme it used. Re-run only if /content changes.\n" +
  "// Canonical launch question bank for the v2 seed callable.\n" +
  "export interface V2SeedQuestion { id: string; surface: string; seq: number; type: string; prompt: string; options: string[]; topic: string | null; axis: string | null; test: string | null; }\n" +
  "export const V2_QUESTIONS: V2SeedQuestion[] = ";

export function generate(content = loadContent()) {
  return HEADER + JSON.stringify(buildEntries(content), null, 1) + ";\n";
}

// CLI — guarded so check-content.mjs can import the builders without
// triggering a check run.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const WRITE = process.argv.includes("--write");
  const generated = generate();
  let committed = null;
  try {
    committed = readFileSync(OUT, "utf8");
  } catch {
    // Missing file: check mode fails below; write mode creates it.
  }

  if (WRITE) {
    if (generated === committed) {
      console.log(`gen-v2content: ${OUT} already up to date`);
    } else {
      writeFileSync(OUT, generated);
      console.log(
        `gen-v2content: wrote ${OUT} (${generated.length} chars) — review the diff before committing`,
      );
    }
  } else if (generated === committed) {
    console.log(
      `gen-v2content: ${OUT} in sync (${generated.length} chars)`,
    );
  } else {
    const gLines = generated.split("\n");
    const cLines = (committed ?? "").split("\n");
    let firstDiff = 0;
    while (
      firstDiff < gLines.length &&
      firstDiff < cLines.length &&
      gLines[firstDiff] === cLines[firstDiff]
    ) {
      firstDiff++;
    }
    console.error(
      `gen-v2content: ${OUT} is out of sync with /content — first difference at line ${firstDiff + 1} ` +
        `(generated ${gLines.length} lines, committed ${cLines.length}). ` +
        "Run `npm run build:content` and review the diff.",
    );
    process.exit(1);
  }
}

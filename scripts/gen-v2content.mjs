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
//   daily-NNN / duo-NNN      explicit "NNN" on the source entry (3 digits)
//   feed-<id> / group-<id>   explicit ids on the source entry
//   test-<key>-NN            explicit "NN" on each item in tests.json
// Every source entry MUST carry its id. The bank was positional once, and
// positional ids mean inserting mid-array re-keys every later question —
// silently attaching live immutable answers to the wrong prompt, the same
// failure class D15 refuses for catalogue keys. New entries mint the next
// free suffix deliberately; this script never invents one on its own.
//
// Modes: default = check (exit 1 if the committed file differs);
//        --write = regenerate the file (`npm run build:content`);
//        --assign-ids = one-time migration, idempotent: writes the current
//        positional suffix onto any entry that lacks an id.
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
    learn: load("learn-questions.json"),
  };
}

// Builds the entries in emission order: daily → feed → group → duo →
// romantic → test → learn. `seq` is per-surface and contiguous (the
// romantic pool continues the duo surface's counter); note the test surface
// runs ONE counter across all four tests (test-political-00 has seq 10, not 0).
// Property order in each entry is load-bearing — JSON.stringify preserves
// insertion order, and the drift gate compares bytes.
// Missing ids are a hard stop, not a fallback to position — falling back
// would quietly reintroduce the re-keying hazard the ids exist to close.
function requireId(q, where) {
  if (typeof q.id !== "string" || q.id === "") {
    throw new Error(
      `${where}: entry ${JSON.stringify(q.prompt ?? "?")} has no id — ` +
        "assign the next free suffix explicitly (see the id scheme in scripts/gen-v2content.mjs)",
    );
  }
  return q.id;
}

export function buildEntries(content = loadContent()) {
  const { daily, feed, duel, tests, learn } = content;
  const entries = [];

  // `active: false` retires an entry from serving without touching its id
  // or history (deck.ts filters `active !== false`); `political: true`
  // marks an opinion item Art. 9-adjacent so D44's no-slice set picks it
  // up (v2.ts). Both optional, emitted only when set, so the common case
  // stays byte-identical to before they existed.
  const flags = (q) => ({
    ...(q.active === false ? { active: false } : {}),
    ...(q.political === true ? { political: true } : {}),
  });

  daily.forEach((q, i) => {
    entries.push({
      id: `daily-${requireId(q, `daily-questions.json[${i}]`)}`,
      surface: "daily",
      seq: i,
      type: q.type,
      // `domain` names the catalogue key space (pokemon/films/…) the
      // aggregate trigger validates `entity` answers against (D14/D15).
      // null everywhere until live catalog questions ship; carried on every
      // entry so the seed path can already transport it.
      domain: q.domain ?? null,
      prompt: q.prompt,
      // scale/rating entries carry no options in the source — the scales
      // are synthesized; everything else lists its options explicitly.
      options:
        q.options ??
        (q.type === "scale" ? LIKERT : q.type === "rating" ? RATING : []),
      topic: q.tone,
      axis: q.axis ?? null,
      test: null,
      ...flags(q),
    });
  });

  // feed.questions is already in emission order; topics/channels metadata
  // is client-only and never emitted. Demo counts on vote/duel options and
  // rank crowd/votes are dropped — live counts come from real answers (D1).
  feed.questions.forEach((q, i) => {
    entries.push({
      id: `feed-${requireId(q, `feed-questions.json[${i}]`)}`,
      surface: "feed",
      seq: i,
      type: q.type,
      domain: q.domain ?? null,
      prompt: q.prompt,
      options: q.options ? q.options.map((o) => o.label) : q.items,
      topic: q.cat,
      axis: null,
      test: null,
      ...flags(q),
    });
  });

  // Group array order is deliberately interleaved (us/pick/classic) — it is
  // the rotation order. Never sort it. `pick` questions have no options
  // (the group's members are the options, filled in client-side).
  duel.group.forEach((q, i) => {
    entries.push({
      id: `group-${requireId(q, `duel-questions.json group[${i}]`)}`,
      surface: "group",
      seq: i,
      type: "choice",
      domain: null,
      prompt: q.prompt,
      options: q.options ?? [],
      topic: q.kind ?? "classic",
      axis: null,
      test: null,
    });
  });

  duel.oneVsOne.forEach((q, i) => {
    entries.push({
      id: `duo-${requireId(q, `duel-questions.json oneVsOne[${i}]`)}`,
      surface: "duo",
      seq: i,
      // Always "binary" — the duo reveal renders a two-sided comparison
      // even for the 3–4-option prompts.
      type: "binary",
      domain: null,
      prompt: q.prompt,
      options: q.options,
      topic: null,
      axis: null,
      test: null,
    });
  });

  // The romantic 1v1 pool (D40 part 4): same duo surface — the rules and
  // the reveal treat it identically — distinguished by `mode`, which
  // duelQFor (deck.ts) filters on so only a pair whose duo doc says
  // `duoMode: "romantic"` draws from it. Ids and seq continue the duo
  // series; the pool's own light → deep order is its rotation order.
  // Source entries carry `active: false` deliberately (see flags above):
  // a pre-mode client's duelQFor has no pool filter, so an ACTIVE romantic
  // doc would rotate into friend-pair duels — the operator activates the
  // pool in the console once the mode-aware client is the fleet, and the
  // seed never rewrites active after create.
  (duel.romantic ?? []).forEach((q, i) => {
    entries.push({
      id: `duo-${requireId(q, `duel-questions.json romantic[${i}]`)}`,
      surface: "duo",
      seq: duel.oneVsOne.length + i,
      type: "binary",
      domain: null,
      prompt: q.prompt,
      options: q.options,
      topic: null,
      axis: null,
      test: null,
      mode: "romantic",
      ...flags(q),
    });
  });

  let testSeq = 0;
  for (const [key, t] of Object.entries(tests)) {
    t.questions.forEach((q, i) => {
      entries.push({
        id: `test-${key}-${requireId(q, `tests.json ${key}[${i}]`)}`,
        surface: "test",
        seq: testSeq++,
        type: "scale",
        domain: null,
        prompt: q.q,
        options: LIKERT,
        topic: "test",
        axis: q.d,
        test: key,
      });
    });
  }

  // Learn cards (D32): the server doc carries ONLY what rules and the
  // aggregate fold need — prompt, options, the field as topic. The
  // correctness metadata (c, t, p, k, w) stays client-side in
  // content/learn-questions.json / window.LEARN_CARDS: nothing server-side
  // reads correctness, and "% got it right" is counts[c]/total computed on
  // the client, which ships c in the bundle anyway.
  learn.cards.forEach((q, i) => {
    entries.push({
      id: `learn-${requireId(q, `learn-questions.json[${i}]`)}`,
      surface: "learn",
      seq: i,
      type: "choice",
      domain: null,
      prompt: q.q,
      options: q.a,
      topic: q.f,
      axis: null,
      test: null,
    });
  });

  return entries;
}

// The header is emitted verbatim, ending mid-line so the array literal from
// JSON.stringify lands on the same line as the `=`. Terminator is `;\n`.
const HEADER =
  "// GENERATED from /content/*.json by scripts/gen-v2content.mjs — do not\n" +
  "// hand-edit. Regenerate with `npm run build:content`; `npm run\n" +
  "// check:content` compares this file byte-for-byte against what /content\n" +
  "// generates, on the deploy path, so a hand edit here (or a /content\n" +
  "// change without a regen) fails the gate.\n" +
  "// Canonical launch question bank for the v2 seed callable.\n" +
  "// `active`/`political` are optional and emitted only when set: absent means\n" +
  "// active (deck.ts filters `active !== false`) and sliceable (v2.ts's D44\n" +
  "// predicate checks `political === true` alongside `test === \"political\"`).\n" +
  "export interface V2SeedQuestion { id: string; surface: string; seq: number; type: string; domain: string | null; prompt: string; options: string[]; topic: string | null; axis: string | null; test: string | null; mode?: string; active?: boolean; political?: boolean; }\n" +
  "export const V2_QUESTIONS: V2SeedQuestion[] = ";

export function generate(content = loadContent()) {
  return HEADER + JSON.stringify(buildEntries(content), null, 1) + ";\n";
}

// CLI — guarded so check-content.mjs can import the builders without
// triggering a check run.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const WRITE = process.argv.includes("--write");

  if (process.argv.includes("--assign-ids")) {
    // Migration from positional to explicit ids, idempotent: only entries
    // without an id get one, and the suffix written is exactly the position
    // the entry already emits under — so the generated output (and
    // therefore v2content.ts) does not change by a byte. All three sources
    // round-trip `JSON.stringify(…, null, 2) + "\n"` losslessly (probed
    // before this mode existed), which is what makes an in-place rewrite
    // a minimal diff.
    const pad = (n, w) => String(n).padStart(w, "0");
    const withId = (q, id) => (q.id === undefined ? { id, ...q } : q);
    const rewrite = (name, transform) => {
      const path = join(CONTENT, name);
      const data = transform(JSON.parse(readFileSync(path, "utf8")));
      writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
    };
    rewrite("daily-questions.json", (d) =>
      d.map((q, i) => withId(q, pad(i, 3))),
    );
    rewrite("duel-questions.json", (d) => ({
      ...d,
      oneVsOne: d.oneVsOne.map((q, i) => withId(q, pad(i, 3))),
    }));
    rewrite("tests.json", (tests) => {
      for (const t of Object.values(tests)) {
        t.questions = t.questions.map((q, i) => withId(q, pad(i, 2)));
      }
      return tests;
    });
    console.log(
      "gen-v2content: assigned missing ids in place — confirm with the default check mode",
    );
    process.exit(0);
  }

  let generated;
  try {
    generated = generate();
  } catch (e) {
    console.error(`gen-v2content: ${e.message}`);
    process.exit(1);
  }
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

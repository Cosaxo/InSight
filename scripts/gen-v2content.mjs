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
//   lq-<lens>-<N>            explicit UNPADDED "N" on each item in
//                            lenses.json — the client minted these ids
//                            (lens-defs.js, `'lq-' + l.id + '-' + qi`)
//                            before the items had a backend, and devices
//                            hold local state keyed by them (D91)
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
// The lens items' scale is the CLIENT's (lens-defs.js SCALE) — agree-first,
// the REVERSE of LIKERT — and stored optionIdx indexes it, which is what
// keeps world-feed's `4 - val` store inversion meaning what it means.
// Never swap LIKERT in here without swapping the client SCALE and every
// stored lens optionIdx with it.
export const LENS_SCALE = [
  "Strongly agree",
  "Agree",
  "Neutral",
  "Disagree",
  "Strongly disagree",
];

// ── continuum option synthesis (D114) ──
// A continuum answer is stored as an ordinary optionIdx (that is the whole
// design: the existing rules, fold, edit machinery and by-cells carry it
// unchanged), so the option LABELS are the answer's public face — the
// voters panel says "picked 60–64 yrs". They are synthesized from the
// question's range/plane exactly like LIKERT/RATING, so 12 copies cannot
// drift — and because a lo/hi/unit (or ax/ay) change would change these
// labels, the seed's D52 option freeze automatically freezes the range
// too, which is correct: stored answers are positions on it.
// 12 buckets: matches the demo texture's dist and sits under the fold's
// optionIdx ceiling (0..19, functions/src/v2.ts). The client quantizes
// with the same constants (world-feed.jsx dialBucket/fieldCell).
export const DIAL_BUCKETS = 12;
export const FIELD_COLS = 4;
export const FIELD_ROWS = 3;

export function dialOptions(q) {
  const span = q.hi - q.lo;
  const fmt = (v) => String(Math.round(v)) ;
  const unit = q.unit === "%" ? "%" : q.unit ? ` ${q.unit}` : "";
  return Array.from({ length: DIAL_BUCKETS }, (_, i) => {
    const a = q.lo + (span * i) / DIAL_BUCKETS;
    const b = q.lo + (span * (i + 1)) / DIAL_BUCKETS;
    return `${fmt(a)}–${fmt(b)}${unit}`;
  });
}

// Cell labels read as positions, not coordinates: "tastes bad · high art".
// Columns run ax[0]→ax[1] left to right; rows run ay[1]→ay[0] TOP to
// bottom (screen order, y = 0 at the top — the same convention the demo
// clouds use). idx = row * FIELD_COLS + col, matching the client.
export function fieldOptions(q) {
  const cols = [q.ax[0], `lean ${q.ax[0]}`, `lean ${q.ax[1]}`, q.ax[1]];
  const rows = [q.ay[1], "middle", q.ay[0]];
  const out = [];
  for (const r of rows) for (const c of cols) out.push(`${c} · ${r}`);
  return out;
}

export function loadContent() {
  const load = (name) =>
    JSON.parse(readFileSync(join(CONTENT, name), "utf8"));
  return {
    daily: load("daily-questions.json"),
    feed: load("feed-questions.json"),
    duel: load("duel-questions.json"),
    tests: load("tests.json"),
    lenses: load("lenses.json"),
    learn: load("learn-questions.json"),
    pulse: load("pulse-questions.json"),
  };
}

// Builds the entries in emission order: daily → feed → group → duo →
// romantic → test → learn → pulse. `seq` is per-surface and contiguous (the
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
  const { daily, feed, duel, tests, lenses, learn, pulse } = content;
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

  // `cat: ["Mind", "Outlook"]` → branch + sub. Both optional for the same
  // reason the flags are: an entry with no path emits neither key.
  const branchOf = (q) => {
    const path = Array.isArray(q.cat) ? q.cat : [];
    return {
      ...(path[0] ? { branch: String(path[0]) } : {}),
      ...(path[1] ? { sub: String(path[1]) } : {}),
    };
  };

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
      // The Map's taxonomy, which the seed used to drop on the floor.
      // `cat` is a [branch, sub-branch] path — Mind/Outlook,
      // Morals/Honesty — and it is the only real subject grouping the
      // bank carries; `topic` above is TONE (light/deep/blend), which
      // says how heavy a question is and nothing about what it is about.
      // The demo layer reads the path straight from its own copy of the
      // bank, so nothing noticed it was missing from the seed until the
      // Mirror's Answers lens needed to filter by it (D100) and had
      // three tone buckets to offer instead of fourteen subjects.
      //
      // Emitted only when present, like `flags` above: feed, duel and
      // test entries carry no path, and writing `branch: null` onto them
      // would mismatch every stored doc and spend a full-bank rewrite on
      // a field they never use.
      ...branchOf(q),
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
      // Continuum entries author no options — their answer space is the
      // range/plane, and the bucket labels are synthesized (D114) so the
      // twelve copies cannot drift from the lo/hi/unit (or ax/ay) they
      // describe. Everything else lists its options (or rank items).
      options:
        q.type === "dial" ? dialOptions(q)
        : q.type === "field" ? fieldOptions(q)
        : q.options ? q.options.map((o) => o.label) : q.items,
      topic: q.cat,
      axis: null,
      test: null,
      // The range/plane copy the client renders from — emit-when-set, like
      // flags: only continuum entries carry these.
      ...(typeof q.lo === "number" ? { lo: q.lo } : {}),
      ...(typeof q.hi === "number" ? { hi: q.hi } : {}),
      ...(typeof q.unit === "string" ? { unit: q.unit } : {}),
      ...(Array.isArray(q.ends) ? { ends: q.ends } : {}),
      ...(Array.isArray(q.ax) ? { ax: q.ax } : {}),
      ...(Array.isArray(q.ay) ? { ay: q.ay } : {}),
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

  // Lens items (D91, reversing D50's device-only half): the minor
  // instruments' questions are world questions now, so their counts fold
  // and publish like any other card's. Same surface ("test" — the same
  // world-answer class as the core instruments' items, and splitBanks
  // routes both to the live feed bank) and the seq counter continues the
  // tests', but `test` stays null so buildFeedGlobals keeps them out of
  // TEST_FEED_QS: the client builds lens cards from IS_LENSES
  // (lens-defs.js) and reads only counts back through LIVE.lensAgg.
  // `political` on an item routes it into D44's no-slice set — the two
  // zero-sum trade propositions carry it (D91 records the judgement).
  for (const [key, l] of Object.entries(lenses)) {
    l.questions.forEach((q, i) => {
      entries.push({
        id: `lq-${key}-${requireId(q, `lenses.json ${key}[${i}]`)}`,
        surface: "test",
        seq: testSeq++,
        type: "scale",
        domain: null,
        prompt: q.q,
        options: LENS_SCALE,
        topic: "lens",
        axis: q.d,
        test: null,
        ...flags(q),
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

  // The daily pulse (D138): TEMPLATE docs, one per pulse question — the
  // answers are day-keyed against the template's id ({baseQid}_{day},
  // firestore.rules isPulseAnswer), so the bank holds one doc per pulse
  // question forever, never one per day. Exactly five options each (the
  // trends y-axis is the 1..5 step scale); appended last so every
  // existing surface's seq and bytes stay put.
  (pulse?.questions ?? []).forEach((q, i) => {
    entries.push({
      id: `pulse-${requireId(q, `pulse-questions.json[${i}]`)}`,
      surface: "pulse",
      seq: i,
      type: "pulse",
      domain: null,
      prompt: q.prompt,
      options: q.options,
      topic: null,
      axis: null,
      test: null,
      ...flags(q),
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
  "// `branch`/`sub` are the daily bank's [branch, sub-branch] subject path\n" +
  "// (D100) and are absent on every other surface, which carries no path.\n" +
  "// `lo`/`hi`/`unit`/`ends` (dial) and `ax`/`ay` (field) are the continuum\n" +
  "// forms' range/plane copy (D114), absent everywhere else; their options\n" +
  "// are synthesized bucket/cell labels, so the D52 option freeze freezes\n" +
  "// the range with them.\n" +
  "export interface V2SeedQuestion { id: string; surface: string; seq: number; type: string; domain: string | null; prompt: string; options: string[]; topic: string | null; branch?: string; sub?: string; axis: string | null; test: string | null; mode?: string; active?: boolean; political?: boolean; lo?: number; hi?: number; unit?: string; ends?: string[]; ax?: string[]; ay?: string[]; }\n" +
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

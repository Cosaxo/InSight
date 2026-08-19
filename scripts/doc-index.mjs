#!/usr/bin/env node
// doc-index.mjs — generate docs/DECISIONS-INDEX.md, and hold
// docs/ORIENTATION.md's maps equal to the tree.
//
// WHY THIS EXISTS. Two different problems, one script, because they share a
// subject: what a reader arriving with no context can actually find.
//
// 1. DECISIONS.md is ~19.5k lines and 194 records with no table of
//    contents. Every other document here cites decisions by number — "D98
//    changed the answer", "read D111 before …" — so the file is addressed
//    constantly and navigable only by grep. A grep for `D9` also matches
//    D90-D99 and every `3D`; a grep for a title needs the title. The index
//    is one line per record, so the question "which decision governs the
//    Mirror's ruler" is answered by one line per record instead of the
//    whole file.
//
// 2. ORIENTATION.md's job is to be the map: every doc, every README, every
//    gate, one line each. A map is worth exactly its currency, and a
//    hand-maintained list of every document and every gate is the single
//    documentation error this repo keeps re-committing — check-figures.mjs's
//    own header counts four instances, two of them inside the paragraph
//    warning against it. So the map is not maintained by intention. A doc
//    added to `docs/`, a README added anywhere, or a `check:*` script added
//    to package.json fails this gate until the map names it.
//
// WHAT IT CHECKS, and what each rule caught or exists to catch:
//
//   1. The decision index is current — regenerated and compared byte for
//      byte. `--write` writes it. This is the same build/check pair shape as
//      check:pokedex and check:catalogs: the artifact is derived, so the
//      gate is "would regenerating change anything".
//   2. Every `docs/*.md` is named in ORIENTATION.md.
//   3. Every `README.md` in the tree is named in ORIENTATION.md.
//   4. Every `check:*` script in package.json is named in ORIENTATION.md.
//   5. Every gate's WHERE IT RUNS marker matches the workflows. This is the
//      column that drifts: `check:anchors` and `check:pokedex` moved onto
//      backend-checks.yml after they were written, and a gate described as
//      client-only when it sits on the deploy path is a wrong answer to
//      "can this block an emergency rules fix" — the trade ci.yml's
//      comments make repeatedly.
//   6. Every path ORIENTATION.md names in backticks exists. A map whose
//      entries point at moved files is worse than no map, because it reads
//      as current.
//
// WHAT IT DOES NOT CHECK, so the next reader does not assume more:
// nothing here reads whether a description is TRUE. Rule 2 asks that
// `MIRROR.md` appears in the map, not that the sentence next to it
// describes MIRROR.md; rule 5 checks placement, not the reason given for
// it. Prose accuracy is not a static property — the same limit
// check-public-copy.mjs works around by checking a closed vocabulary
// instead. What these rules buy is that the map cannot silently omit a
// thing or point at a thing that is gone, which is how a map dies.
//
// DECISIONS.md's own figures stay outside this, for check-figures.mjs's
// reason: a decision record's arithmetic is the state at the moment it was
// taken, so gating it would force rewriting history to satisfy a linter.
// The index derives only structure — number, title, line, citations.
//
// Run: node scripts/doc-index.mjs           (check)
//      node scripts/doc-index.mjs --write   (regenerate the index)

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");
const write = mode();
const errors = [];
const fail = (msg) => errors.push(msg);

function mode() {
  return process.argv.includes("--write");
}

// ---------------------------------------------------------------- decisions

const DECISIONS = "docs/DECISIONS.md";
const INDEX = "docs/DECISIONS-INDEX.md";

// GitHub's heading-anchor algorithm: lowercase, drop everything that is not
// a letter, number, space, underscore or hyphen, then replace EACH remaining
// space with a hyphen. The one-space-one-hyphen part is the whole subtlety:
// the `·` and `—` these headings use are dropped rather than replaced, so
// `D9 · Near` leaves two adjacent spaces and the real anchor is `d9--near`.
// Collapsing runs (`\s+`) produces `d9-near`, which is a 404 — that was the
// first version of this line, and the assertion below caught it on the first
// run against the 14 intra-file `](#dNN-…)` links DECISIONS.md already
// carries. The slugger has to reproduce every one of them or it is wrong.
const slug = (heading) =>
  heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s/g, "-");

/**
 * Parse the record headings. Two shapes exist:
 *   `## D98 · title`
 *   `## D7 amendment (2026-08-03) · title`   (also `adoption`)
 * The second is a follow-on attached to an earlier record rather than a new
 * decision, so it is indexed as a sub-row and does not claim a number of its
 * own. Both are matched explicitly: a heading this regex misses would drop
 * silently out of the index, so an unrecognised `## D…` heading is an error
 * rather than a skip.
 */
function parseDecisions(src) {
  const lines = src.split("\n");
  const records = [];
  lines.forEach((line, i) => {
    if (!line.startsWith("## D")) return;
    const m = /^## (D\d+[a-z]?)(?: (amendment|adoption) \(([^)]+)\))? · (.+)$/.exec(line);
    if (!m) {
      fail(`${DECISIONS}:${i + 1} — heading not in a shape the index can parse: ${line}`);
      return;
    }
    const [, id, kind, date, title] = m;
    records.push({
      id,
      num: Number(id.replace(/^D/, "").replace(/[a-z]$/, "")),
      kind: kind ?? "record",
      date: date ?? null,
      title,
      line: i + 1,
      anchor: slug(line.replace(/^##\s+/, "")),
    });
  });
  // Sorted by number, not by file position, because this is a lookup table:
  // the question it answers is "what is D111", and scanning for it should not
  // require knowing where in the file it landed. DECISIONS.md is not strictly
  // numeric — D7 sits above D6, D4 and D5 — so file order would put a reader
  // who trusts the sort in the wrong place. An amendment sorts under its
  // parent record (`record` before `amendment`/`adoption`, then by line), so
  // D7's amendment reads as attached to D7 rather than as a stray D7.
  const rank = { record: 0 };
  records.sort(
    (a, b) => a.num - b.num || (rank[a.kind] ?? 1) - (rank[b.kind] ?? 1) || a.line - b.line,
  );
  return { records, lines };
}

/**
 * For each record, which LATER records cite it.
 *
 * This is the column that answers the question a fresh reader most needs and
 * cannot get from a heading: is there something newer I should read first?
 * The stale README claim this change fixes is exactly that failure — it
 * described the Mirror per D9 with D111 sitting 100 records below, reversing
 * it.
 *
 * It is deliberately CITATIONS and not "superseded by". Supersession is
 * marked three inconsistent ways in this file (a leading blockquote, a
 * mid-record amendment paragraph, or only in the superseding record's prose),
 * so a "superseded" flag would be wrong often enough to mislead — and a
 * wrong flag is worse than a citation the reader has to judge. Only the
 * newest citer and a count are published, because the fan-in reaches 34
 * (D1) and a 34-id cell is not a line anyone reads.
 */
function citations(records, lines) {
  const later = new Map();
  // A record's body runs to the next heading IN THE FILE, so this walks a
  // line-ordered copy — `records` is sorted by number for the table's sake,
  // and using that order here would slice bodies at the wrong boundaries.
  const byLine = [...records].sort((a, b) => a.line - b.line);
  const heads = byLine.map((r) => r.line - 1);
  byLine.forEach((rec, n) => {
    const end = heads[n + 1] ?? lines.length;
    const body = lines.slice(rec.line - 1, end).join("\n");
    // `(?<![\w])` so D9 does not match inside D98, `3D` or `_D9`.
    for (const m of body.matchAll(/(?<![\w])D(\d{1,3})\b/g)) {
      const target = Number(m[1]);
      if (target >= rec.num) continue; // self and forward references are not citations
      if (!later.has(target)) later.set(target, new Set());
      later.get(target).add(rec.num);
    }
  });
  return later;
}

function renderIndex(records, later) {
  const out = [];
  out.push("# Decision index");
  out.push("");
  out.push(
    "Generated — `npm run build:doc-index`. Every record in",
    "[`DECISIONS.md`](DECISIONS.md), ordered by number, so the question",
    `"which decision governs this" is ${records.length} lines instead of`,
    `${lines.length.toLocaleString("en-US")}. Do not hand-edit; \`npm run check:docs\` fails when this`,
    "drifts from the source.",
  );
  out.push("");
  out.push(
    "**Cited later by** is the newest record that mentions this one, and how",
    "many others do. It is a *citation*, not a reversal — but a record with a",
    "much newer citer is one to read from the bottom up. Supersession in this",
    "file is marked three different ways, so the index does not claim to",
    "detect it.",
  );
  out.push("");
  out.push("| # | Decision | Cited later by | Line |");
  out.push("| --- | --- | --- | --- |");
  for (const rec of records) {
    const cites = later.get(rec.num);
    let cell = "—";
    if (rec.kind === "record" && cites?.size) {
      const newest = Math.max(...cites);
      cell = cites.size > 1 ? `D${newest} (+${cites.size - 1})` : `D${newest}`;
    }
    const label =
      rec.kind === "record"
        ? `[${rec.title}](DECISIONS.md#${rec.anchor})`
        : `↳ *${rec.kind} ${rec.date}* — [${rec.title}](DECISIONS.md#${rec.anchor})`;
    const num = rec.kind === "record" ? `**${rec.id}**` : "";
    out.push(`| ${num} | ${label} | ${cell} | ${rec.line} |`);
  }
  out.push("");
  return out.join("\n");
}

const decisionSrc = read(DECISIONS);
const { records, lines } = parseDecisions(decisionSrc);

// The slugger is load-bearing for every link in the generated index, and it
// reimplements someone else's algorithm. DECISIONS.md already contains
// hand-written, working anchors — so they are the test, run on every
// invocation rather than in a suite that could be skipped.
{
  const known = new Set(records.map((r) => r.anchor));
  const used = new Set([...decisionSrc.matchAll(/\]\(#(d\d+[a-z]?-[^)]*)\)/g)].map((m) => m[1]));
  const unreproducible = [...used].filter((a) => !known.has(a));
  if (unreproducible.length)
    fail(
      `the anchor slugger does not reproduce ${unreproducible.length} link(s) already in ${DECISIONS} ` +
        `(${unreproducible.slice(0, 3).join(", ")}) — every generated link is suspect until it does`,
    );
}

const rendered = renderIndex(records, citations(records, lines));

if (write) {
  writeFileSync(join(root, INDEX), rendered);
  console.log(
    `doc-index: wrote ${INDEX} — ${records.filter((r) => r.kind === "record").length} records, ` +
      `${records.filter((r) => r.kind !== "record").length} amendments.`,
  );
} else if (!existsSync(join(root, INDEX))) {
  fail(`${INDEX} does not exist — run \`npm run build:doc-index\``);
} else if (read(INDEX) !== rendered) {
  fail(`${INDEX} is out of date — run \`npm run build:doc-index\``);
}

// -------------------------------------------------------------- orientation

const ORIENTATION = "docs/ORIENTATION.md";
const orientation = existsSync(join(root, ORIENTATION)) ? read(ORIENTATION) : null;
const checked = { docs: 0, readmes: 0, gates: 0 };
if (!orientation) fail(`${ORIENTATION} is missing — it is the map every other rule here checks`);

/**
 * The map's table rows, as cell arrays, keyed by first cell.
 *
 * Keyed on the first cell rather than searched for anywhere in the line,
 * because the loose version was wrong on its first run: the code map's row
 * for `web/privacy.html` mentions `check:policy-claims` in its description,
 * so a `line.includes()` lookup found that row and read its third cell as
 * the gate's placement marker. A gate named inside another row's prose is a
 * cross-reference, not that gate's row.
 */
const mapRows = new Map();
for (const line of (orientation ?? "").split("\n")) {
  if (!line.startsWith("|")) continue;
  const cells = line.split("|").slice(1, -1).map((c) => c.trim());
  if (cells.length < 2 || /^-+$/.test(cells[0])) continue;
  if (!mapRows.has(cells[0])) mapRows.set(cells[0], cells);
}

/** Every README in the tree, minus the vendored and frozen-reference ones. */
function findReadmes(dir, acc = []) {
  const skip = new Set([
    "node_modules",
    ".git",
    "ios",
    "android",
    "dist",
    "coverage",
    "public",
  ]);
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (skip.has(entry.name)) continue;
      findReadmes(join(dir, entry.name), acc);
    } else if (entry.name === "README.md") {
      acc.push(join(dir, entry.name));
    }
  }
  return acc;
}

if (orientation) {
  // Rule 2 — every doc. The index and the map itself are excluded: one is
  // generated from the other's neighbour and neither is a subject of the map.
  const docs = readdirSync(join(root, "docs"))
    .filter((f) => f.endsWith(".md"))
    .filter((f) => f !== "ORIENTATION.md" && f !== "DECISIONS-INDEX.md")
    .sort();
  checked.docs = docs.length;
  for (const doc of docs) {
    if (!orientation.includes(doc)) fail(`${ORIENTATION} does not name docs/${doc}`);
  }

  // Rule 7 — the Status column, against each document's own declaration.
  //
  // This is the column a reader gets hurt by. Four of these files are
  // proposals with no code behind them, and reading one as a description of
  // the tree is the most expensive mistake this page can cause — so where a
  // document declares its own status in its opening lines, that declaration
  // is the authority and the map must agree with it, in BOTH directions. The
  // direction that earns the rule is the second one: a plan that gets built
  // updates its own header (that is the habit here — MODERATION.md and
  // CATALOG-QUESTIONS.md both did) and nothing would otherwise notice that
  // the map still calls it a plan.
  //
  // A document with no declared status is left unconstrained, deliberately.
  // MONETIZATION.md and SCALE-RUNBOOK.md are plans without a Status line, so
  // requiring a declaration for every `plan` row would fail on two correct
  // rows — and a gate that has to be worked around stops being read.
  for (const doc of docs) {
    const head = read(join("docs", doc)).split("\n").slice(0, 14).join("\n");
    const declared = /\*\*Status:?\*{0,2}:?([^.]*)/i.exec(head)?.[1];
    if (!declared) continue;
    const declaresPlan = /\b(plan|design)\s+(only|notes)\b/i.test(declared);
    const row = mapRows.get(`[\`${doc}\`](${doc})`);
    if (!row) {
      fail(`${ORIENTATION} has no document-table row for docs/${doc}`);
      continue;
    }
    const marked = row.at(-1);
    if (declaresPlan && marked !== "plan")
      fail(
        `${ORIENTATION}: docs/${doc} declares "${declared.trim()}" but the map marks it "${marked}"`,
      );
    if (!declaresPlan && marked === "plan")
      fail(
        `${ORIENTATION}: docs/${doc} is marked "plan" but its own status line says "${declared.trim()}"`,
      );
  }

  // Rule 3 — every README. `design/standalone-*/README.md` are the frozen
  // prototype's own notes, named as a group by their parent rather than
  // individually; the map says design/ is read-only reference and that is
  // the whole useful statement about them.
  const readmes = findReadmes(".").filter((p) => !p.startsWith(join("design", "standalone-")));
  checked.readmes = readmes.length;
  for (const readme of readmes) {
    if (!orientation.includes(readme)) fail(`${ORIENTATION} does not name ${readme}`);
  }

  // Rules 4 and 5 — every gate, and where it runs.
  const pkg = JSON.parse(read("package.json"));
  const workflowDir = ".github/workflows";
  const workflows = new Map(
    readdirSync(join(root, workflowDir))
      .filter((f) => f.endsWith(".yml"))
      .map((f) => [f, read(join(workflowDir, f))]),
  );
  // Where a gate runs, from the workflows rather than from the prose.
  // `deploy` means backend-checks.yml, which ci.yml and firebase-deploy.yml
  // BOTH call — so it guards a PR and production with the same job. `ci`
  // means ci.yml's own jobs: pull requests only. `release` is a
  // platform-release or metadata workflow. `manual` is nothing automated.
  const placement = (name) => {
    const runs = [...workflows].filter(([, src]) => src.includes(`npm run ${name}`)).map(([f]) => f);
    if (runs.includes("backend-checks.yml")) return "deploy";
    if (runs.includes("ci.yml")) return "ci";
    if (runs.length) return "release";
    return "manual";
  };
  const gates = Object.keys(pkg.scripts).filter((n) => n.startsWith("check:")).sort();
  checked.gates = gates.length;
  for (const gate of gates) {
    const row = mapRows.get(`\`${gate}\``);
    if (!row) {
      fail(`${ORIENTATION} has no gate-table row for \`${gate}\``);
      continue;
    }
    const want = placement(gate);
    if (row[1] !== want)
      fail(`${ORIENTATION}: \`${gate}\` is marked "${row[1]}" but the workflows run it as "${want}"`);
  }

  // Rule 6 — every path it names exists. Backticked, contains a slash, and
  // either ends in a source extension or in a slash: that is narrow enough
  // to skip `globalThis.X`, `agg.by` and `window.LIVE`, which are the
  // backticked non-paths this page is full of.
  const EXT = /\.(md|ts|tsx|js|jsx|mjs|json|css|html|rules|txt|yml)$/;
  const cited = new Set([...orientation.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]));
  for (const path of cited) {
    if (!path.includes("/") || path.startsWith("#") || path.startsWith("http")) continue;
    if (!EXT.test(path) && !path.endsWith("/")) continue;
    // A `dir/*.jsx` group is a claim about the directory, not about a file.
    const target = path.includes("*") ? dirname(path) : path.replace(/\/$/, "");
    if (!existsSync(join(root, target))) fail(`${ORIENTATION} names \`${path}\`, which does not exist`);
    else if (path.endsWith("/") && !statSync(join(root, target)).isDirectory())
      fail(`${ORIENTATION} names \`${path}\` as a directory, but it is a file`);
  }
}

if (errors.length) {
  console.error("doc-index FAILED\n");
  for (const e of errors) console.error(`  • ${e}`);
  console.error(
    `\n${errors.length} problem(s). The maps in ${ORIENTATION} and ${INDEX} are only worth their currency —` +
      ` that is the whole reason this gate exists.`,
  );
  process.exit(1);
}

if (!write) {
  // The counts printed are what was actually CHECKED, not what was found on
  // disk — the two differ (this page and the generated index are not subjects
  // of the map; the frozen prototype's READMEs are named as a group), and a
  // summary that quoted the larger number would claim coverage the rules do
  // not have. That is the failure this whole script is about.
  console.log(
    `doc-index OK — ${records.filter((r) => r.kind === "record").length} decisions indexed; ` +
      `${ORIENTATION} maps ${checked.docs} docs, ${checked.readmes} READMEs and ${checked.gates} gates.`,
  );
}

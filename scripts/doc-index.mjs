#!/usr/bin/env node
// doc-index.mjs — generate docs/DECISIONS-INDEX.md, and hold
// docs/ORIENTATION.md's maps equal to the tree.
//
// WHY THIS EXISTS. Two different problems, one script, because they share a
// subject: what a reader arriving with no context can actually find.
//
// 1. DECISIONS.md is a very long file with no table of contents — the
//    figures are not written here on purpose, because this script prints
//    both every time it runs and a second copy in prose is the error the
//    rest of this header is about. (It said "~19.5k lines and 194 records"
//    for long enough to be off by ninety-eight records.) Every other
//    document here cites decisions by number — "D98
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
//    to package.json fails this gate until the map names it, and so does a
//    directory added anywhere the map is expected to reach (rule 8).
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
//   6. Every path a MAP names in backticks exists — ORIENTATION.md,
//      CLAUDE.md, README.md and every README. A map whose entries point at
//      moved files is worse than no map, because it reads as current, and
//      that argument never applied to only one of the eight.
//   7. The Status column against each document's own declaration, in both
//      directions — a plan read as a description of the tree is the most
//      expensive mistake this page can cause, and a plan that gets built
//      updates its own header and nothing else notices.
//   9. Every `#dNNN-…` link resolves to a heading in DECISIONS.md. This
//      repo renumbers records on merge, which rewrites the heading and
//      leaves every link written against the old number pointing nowhere.
//      Eight were broken when the rule was added.
//  10. Every decision number is claimed exactly once and the sequence has
//      no holes — the renumber guard; see the block that implements it.
//   8. Every directory is named in ORIENTATION.md §3 — the third thing that
//      page's opening line promises and the only one that was a convention
//      rather than a rule. It had drifted to four when the rule was added:
//      `src/dev/`, `public/`, `android/` and `ios/`.
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
import { numberingProblems } from "./decision-numbering.mjs";

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

// -------------------------------------------------- the numbering itself
//
// RULE 10: every decision number is claimed exactly once, and the sequence
// has no holes. The predicate lives in decision-numbering.mjs — extracted
// so it can be tested, since this script exits on any documentation problem
// in the tree and a test importing it would be hostage to all of them. That
// module's header carries the three renumbers that motivated the rule.
for (const problem of numberingProblems(records)) fail(problem);

// -------------------------------------------------------------- orientation

const ORIENTATION = "docs/ORIENTATION.md";
const orientation = existsSync(join(root, ORIENTATION)) ? read(ORIENTATION) : null;
const checked = { docs: 0, readmes: 0, gates: 0, dirs: 0, maps: 0 };
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
  //
  // IT COVERS THE ROOT TOO, and read only docs/ for a long time — which is
  // how SECURITY.md, a live policy that `web/privacy.html` names to a user
  // by filename, went unmapped by both this page and README.md with no gate
  // able to see it. A document does not stop being a document by living
  // where GitHub expects to find it. README.md and CLAUDE.md are excluded
  // for the same reason ORIENTATION.md is: they are the map's neighbours,
  // named by §1 and by the README table, not subjects of the doc table.
  const docs = readdirSync(join(root, "docs"))
    .filter((f) => f.endsWith(".md"))
    .filter((f) => f !== "ORIENTATION.md" && f !== "DECISIONS-INDEX.md")
    .sort();
  const rootDocs = readdirSync(root)
    .filter((f) => f.endsWith(".md") && f !== "README.md" && f !== "CLAUDE.md")
    .sort();
  checked.docs = docs.length + rootDocs.length;
  for (const doc of docs) {
    if (!orientation.includes(doc)) fail(`${ORIENTATION} does not name docs/${doc}`);
  }
  for (const doc of rootDocs) {
    if (!orientation.includes(doc)) fail(`${ORIENTATION} does not name ${doc}`);
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

  // Rule 6 — every path these pages name exists. Backticked, contains a
  // slash, and either ends in a source extension or in a slash: that is
  // narrow enough to skip `globalThis.X`, `agg.by` and `window.LIVE`, which
  // are the backticked non-paths these pages are full of.
  //
  // IT COVERS THE OTHER MAPS TOO, and used to cover one. ORIENTATION.md is
  // not the only page that points somewhere: CLAUDE.md is the conventions,
  // README.md carries a repo map of its own, and each README describes the
  // directory it sits in. "A map whose entries point at moved files is worse
  // than no map, because it reads as current" is the same argument for all
  // eight, and holding one of them was an accident of where the rule started.
  //
  // Resolution is DIRECTORY-RELATIVE FIRST, then from the root, then from
  // src/v2/ — because that is how these pages are written and reading them
  // any other way would report their normal voice as broken. functions/
  // README.md says `src/ops.ts` and means its own neighbour; src/v2/README.md
  // says `data/live.ts` and means the same; CLAUDE.md sits at the root and
  // still says `data/live.ts`, because its subject is the spec layer.
  //
  // GONE_ON_PURPOSE is the whole exemption list, and both entries are the
  // same shape: a directory this repo deleted on a recorded decision and
  // goes on citing as provenance. CLAUDE.md sanctions the first explicitly
  // ("Ported files still cite them in header comments as provenance"), so a
  // gate that failed on it would be asking the tree to forget where it came
  // from. Anything else that cannot resolve is a wrong pointer.
  const EXT = /\.(md|ts|tsx|js|jsx|mjs|json|css|html|rules|txt|yml)$/;
  const GONE_ON_PURPOSE = {
    "design/spec-modules/": "deleted 2026-07-29 when the port completed; cited as provenance (CLAUDE.md)",
    "src/legacy/": "deleted after Phase 5 shipped (D4); cited as history",
  };
  const MAPS = [
    ORIENTATION,
    "CLAUDE.md",
    "README.md",
    ...findReadmes(".").filter((f) => !f.startsWith(join("design", "standalone-"))),
  ];
  checked.maps = new Set(MAPS).size;
  for (const page of new Set(MAPS)) {
    const src = read(page);
    const cited = new Set([...src.matchAll(/`([^`\s]+)`/g)].map((m) => m[1]));
    for (const path of cited) {
      if (!path.includes("/") || path.startsWith("#") || path.startsWith("http")) continue;
      if (!EXT.test(path) && !path.endsWith("/")) continue;
      // Matched on the raw token AND on it resolved against the page's own
      // directory, because design/README.md writes the first entry as
      // `spec-modules/` — its neighbour, in the voice every README uses.
      const asWritten = path.endsWith("/") ? path : `${path}/`;
      const asPlaced = `${join(dirname(page), path).replace(/\/$/, "")}/`;
      if (GONE_ON_PURPOSE[asWritten] || GONE_ON_PURPOSE[asPlaced]) continue;
      // A `dir/*.jsx` group is a claim about the directory, not about a file.
      const target = path.includes("*") ? dirname(path) : path.replace(/\/$/, "");
      const hit = [join(dirname(page), target), target, join("src", "v2", target)]
        .map((t) => join(root, t))
        .find((t) => existsSync(t));
      if (!hit) fail(`${page} names \`${path}\`, which does not exist`);
      else if (path.endsWith("/") && !statSync(hit).isDirectory())
        fail(`${page} names \`${path}\` as a directory, but it is a file`);
    }
  }

  // Rule 9 — every decision anchor resolves.
  //
  // Decisions are cited by number everywhere and the number is the only
  // handle (§6 of the page this gate holds says exactly that), so a link
  // into DECISIONS.md is the one navigation aid the whole citation habit
  // rests on. It breaks silently and in bulk: this repo RENUMBERS records
  // when a branch merges — "renumber D275-277 to D290-292" is a commit
  // message here — and a renumber rewrites the heading while every link
  // written against the old number keeps its stale slug. Eight were broken
  // when this rule was added: five carried a right title with a wrong
  // number (D231→D232, D232→D233, D199→D202, D200→D203, D201→D204, all from
  // one renumber) and three inside DECISIONS.md itself used a bare `#d126`
  // that never matched a heading at all.
  //
  // No exemption list and no judgement: an anchor either names a heading in
  // that file or it does not. The slugger is the one above, the same
  // function that generates the index, so the two cannot disagree about
  // what a heading's anchor is.
  {
    const headings = new Set(
      lines.filter((l) => l.startsWith("## D")).map((l) => slug(l.replace(/^##\s+/, ""))),
    );
    const pages = [DECISIONS, ...docs.map((d) => join("docs", d)), "CLAUDE.md", "README.md",
      ...findReadmes(".").filter((f) => !f.startsWith(join("design", "standalone-")))];
    for (const page of new Set(pages)) {
      read(page).split("\n").forEach((line, i) => {
        for (const m of line.matchAll(/\]\((?:[^)#\s]*DECISIONS\.md)?#(d\d[^)\s]*)\)/gi)) {
          const a = m[1].toLowerCase();
          if (headings.has(a)) return;
          fail(
            `${page}:${i + 1} links to #${a}, which matches no heading in ${DECISIONS}` +
              ` — ${INDEX} carries the current slug for every record`,
          );
        }
      });
    }
  }

  // Rule 8 — every directory, which is the third thing this page's opening
  // line promises ("every document, every gate, every directory") and the
  // one nothing held. Rules 2, 3 and 4 are the same shape for docs, READMEs
  // and gates; without this one the directory half was a convention, and it
  // drifted exactly the way a convention does. When this rule was written it
  // found four: `src/dev/` (a module the shell dynamic-imports), `public/`
  // (every catalogue file an answer is keyed into, plus the webfonts),
  // and `android/` and `ios/` — the entire native half of a product whose
  // own first paragraph calls itself a Capacitor app. A map that silently
  // omits a directory is worse than one that says it does not cover it,
  // because it reads as complete.
  //
  // SCOPE, and why it stops where it does: every top-level directory, plus
  // every directory under `src/` and `.github/` — the two trees where a
  // nested directory holds code somebody has to find. Everywhere else one
  // level deeper is inventory rather than a map: it would demand a row for
  // `public/fonts/` and `web/.well-known/`, and then for
  // `android/app/src/main/res/…`, which the Capacitor toolchain owns and
  // regenerates on `cap sync`.
  //
  // NAMED means reachable, not formatted: the page may name the directory
  // itself or any path inside it, so `functions/src/` accounts for
  // `functions/`, `web/privacy.html` for `web/`, and a row whose path cell
  // carries two directories (`android/` · `ios/`) satisfies both. What the
  // rule refuses is a directory the page never mentions in any form.
  //
  // The skip set is read from .gitignore rather than hardcoded, so a build
  // output directory added there is skipped here without a second edit —
  // the failure mode of a hand-kept list being a red gate on someone else's
  // `dist-ssr/`. Only plain top-level entries count (no slash inside, no
  // glob), which is exactly the shape of the directory entries there.
  const ignored = new Set([
    ".git",
    ...read(".gitignore")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#") && !l.startsWith("!"))
      .filter((l) => !/[*?[\]]/.test(l) && !l.slice(0, -1).includes("/"))
      .map((l) => l.replace(/\/$/, "")),
  ]);
  const subdirs = (dir) =>
    readdirSync(join(root, dir), { withFileTypes: true })
      .filter((e) => e.isDirectory() && !ignored.has(e.name))
      .map((e) => (dir === "." ? e.name : `${dir}/${e.name}`));
  const dirs = [];
  const walk = (dir) => {
    for (const child of subdirs(dir)) {
      dirs.push(child);
      walk(child);
    }
  };
  dirs.push(...subdirs("."));
  walk("src");
  walk(".github");
  dirs.sort();
  checked.dirs = dirs.length;
  for (const dir of dirs) {
    if (!orientation.includes(`${dir}/`))
      fail(
        `${ORIENTATION} §3 does not name ${dir}/ — the page claims to map every directory, ` +
          `so add a row for it or a path inside it`,
      );
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
      `${ORIENTATION} maps ${checked.docs} docs, ${checked.readmes} READMEs, ${checked.gates} gates ` +
      `and ${checked.dirs} directories; ${checked.maps} pages hold every path they name.`,
  );
}

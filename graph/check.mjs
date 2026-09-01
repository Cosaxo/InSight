#!/usr/bin/env node
// The claims-graph checker — the schema's enforcement (CHARTER §3, §5).
// Zero dependencies on purpose: lane containers provision a bare clone of
// this branch and never install anything, so `node graph/check.mjs` must
// work with node alone.
//
// Usage (paths resolve from this file, so cwd does not matter):
//   node graph/check.mjs <lane>     one lane, strict — plus git discipline
//                                   (path set, LOG append-only) when run
//                                   inside the worktree
//   node graph/check.mjs --all      every graph, strict — the optimizer's
//                                   health pass and the skeptic's sweep
//
// What green means here: WELL-FORMED, not TRUE. This script verifies
// format, ids, edge resolution (cross-graph included), the evidence
// ladder's FORM (a cited node names at least one source), the schema
// version match, and — in lane mode — that the run only touched its own
// §7 path set and only appended to LOG.md. It cannot verify that a named
// source is real (§4's unrecoverable sin stays the writer's and the
// skeptic's duty) or that THEORY.md faithfully renders the graph.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Lane directory → id prefix. SCHEMA.md's rules section is the source of
// this table; a new lane changes both in one commit or the checker refuses
// its graph.
const LANES = {
  genetic: "gen",
  body: "bod",
  questions: "que",
  tests: "tst",
  map: "map",
  pattern: "pat",
  database: "db",
  "graph-optimizer": "go",
  central: "cen",
  review: "rev",
  ties: "tie",
  interests: "int",
};
const PREFIX_RE = new RegExp(
  `^(${Object.values(LANES).join("|")})-\\d+$`
);
const STATUSES = ["conjecture", "argued", "cited", "measured"];
const EDGE_TYPES = ["supports", "contradicts", "refines", "depends"];
const NODE_KEYS = ["id", "claim", "status", "detail", "sources", "edges", "created", "updated"];
const TOP_KEYS = ["version", "axiom", "updated", "nodes"];
const LANE_FILES = ["graph.json", "THEORY.md", "LOG.md", "REQUESTS.md", "QUESTIONS.md"];

// The current schema version is read from SCHEMA.md's own title — one
// source of truth, human-readable and machine-readable at once.
function schemaVersion() {
  const head = readFileSync(join(ROOT, "graph", "SCHEMA.md"), "utf8");
  const m = head.match(/schema v(\d+)/);
  if (!m) throw new Error("graph/SCHEMA.md no longer declares 'schema vN' in its title");
  return Number(m[1]);
}

const isoDate = (s) =>
  typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

function loadGraph(lane) {
  const path = join(ROOT, "theory", lane, "graph.json");
  try {
    return { data: JSON.parse(readFileSync(path, "utf8")) };
  } catch (e) {
    return { error: `theory/${lane}/graph.json · does not load: ${e.message}` };
  }
}

// Structural rules for one graph. `siblings` maps prefix → Set of ids for
// every graph that loaded, so cross-graph edges resolve against the real
// files rather than being taken on faith.
function checkGraph(lane, g, current, siblings, fail, warn) {
  const at = (id, msg) => fail(`theory/${lane}/graph.json · ${id} · ${msg}`);
  const prefix = LANES[lane];

  if (g.version !== current)
    at("top", `version is ${JSON.stringify(g.version)} but graph/SCHEMA.md declares v${current} — ` +
      `bring THIS file to v${current} per SCHEMA.md's migration note before landing (CHARTER §3)`);
  if (g.axiom !== lane) at("top", `axiom is ${JSON.stringify(g.axiom)}, expected "${lane}"`);
  if (!isoDate(g.updated)) at("top", `updated is not a YYYY-MM-DD date`);
  for (const k of Object.keys(g))
    if (!TOP_KEYS.includes(k)) warn(`theory/${lane}/graph.json · top · unknown field "${k}"`);
  if (!Array.isArray(g.nodes)) return at("top", "nodes is not an array");

  const ids = new Set();
  for (const n of g.nodes) {
    const id = typeof n.id === "string" ? n.id : "<no id>";
    if (!new RegExp(`^${prefix}-\\d+$`).test(id))
      at(id, `id does not match ${prefix}-<n>`);
    if (ids.has(id)) at(id, "duplicate id");
    ids.add(id);

    if (typeof n.claim !== "string" || !n.claim.trim()) at(id, "claim is empty");
    if (!STATUSES.includes(n.status))
      at(id, `status ${JSON.stringify(n.status)} is not on the ladder (${STATUSES.join(" | ")})`);
    if (n.status !== "conjecture" && (typeof n.detail !== "string" || !n.detail.trim()))
      at(id, `status "${n.status}" with no detail — the ladder rises on argument, not assertion`);
    if (!Array.isArray(n.sources)) at(id, "sources is not an array");
    else {
      if (["cited", "measured"].includes(n.status) && n.sources.length === 0)
        at(id, `status "${n.status}" with zero sources — the rung is DEFINED by named, re-verifiable sources (§4)`);
      for (const s of n.sources)
        if (typeof s !== "string" || !s.trim()) at(id, "empty source entry");
    }
    if (!isoDate(n.created)) at(id, "created is not a YYYY-MM-DD date");
    if (!isoDate(n.updated)) at(id, "updated is not a YYYY-MM-DD date");
    else if (isoDate(n.created) && n.updated < n.created) at(id, "updated precedes created");
    for (const k of Object.keys(n))
      if (!NODE_KEYS.includes(k)) warn(`theory/${lane}/graph.json · ${id} · unknown field "${k}"`);

    if (!Array.isArray(n.edges)) { at(id, "edges is not an array"); continue; }
    const seen = new Set();
    for (const e of n.edges) {
      if (!e || typeof e.to !== "string" || !EDGE_TYPES.includes(e.type)) {
        at(id, `malformed edge ${JSON.stringify(e)} (need {to, type ∈ ${EDGE_TYPES.join("|")}})`);
        continue;
      }
      if (!PREFIX_RE.test(e.to)) { at(id, `edge target "${e.to}" is not a global id`); continue; }
      if (e.to === id) at(id, "self-edge");
      const key = `${e.to}·${e.type}`;
      if (seen.has(key)) warn(`theory/${lane}/graph.json · ${id} · duplicate edge ${key}`);
      seen.add(key);
    }
  }

  // Second pass for resolution, so forward references within a graph work.
  let cross = 0;
  for (const n of g.nodes)
    for (const e of Array.isArray(n.edges) ? n.edges : [])
      if (typeof e.to === "string" && PREFIX_RE.test(e.to)) {
        const toPrefix = e.to.split("-")[0];
        if (toPrefix === prefix) {
          if (!ids.has(e.to)) at(n.id, `edge target ${e.to} does not exist in this graph`);
        } else {
          cross++;
          const sib = siblings.get(toPrefix);
          if (sib && !sib.has(e.to))
            at(n.id, `cross-graph edge target ${e.to} does not exist in its graph`);
          else if (!sib)
            warn(`theory/${lane}/graph.json · ${n.id} · cross-graph edge ${e.to} unresolved (that graph did not load)`);
        }
      }
  return { nodes: g.nodes.length, edges: g.nodes.reduce((a, n) => a + (Array.isArray(n.edges) ? n.edges.length : 0), 0), cross };
}

// §7 mechanized: which paths a lane's run may have touched. Central, the
// optimizer and the review lane carry their charter extras; everyone else
// stays home.
function allowedPath(lane, p) {
  if (p.startsWith(`theory/${lane}/`)) return true;
  if (lane === "central")
    return p === "DIGEST.md" || p.startsWith("bridge/") ||
      /^theory\/[^/]+\/QUESTIONS\.md$/.test(p);
  if (lane === "graph-optimizer")
    return p.startsWith("graph/") || /^theory\/[^/]+\/graph\.json$/.test(p);
  // The review lane's one cross-workspace write (§12): every lane's
  // FEEDBACK.md, rewritten whole — never a graph, a theory or a LOG.
  if (lane === "review")
    return /^theory\/[^/]+\/FEEDBACK\.md$/.test(p);
  return false;
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
}

// Lane-mode discipline: the union of worktree changes and commits not yet
// on origin is "this run", covering both call points (§3: before the
// commit, and again after the rebase before the push).
function checkDiscipline(lane, fail, note) {
  let paths;
  try {
    const status = git(["status", "--porcelain"])
      .split("\n").filter(Boolean)
      .map((l) => l.slice(3).replace(/^"|"$/g, ""))
      .map((l) => l.includes(" -> ") ? l.split(" -> ")[1] : l);
    let committed = [];
    try {
      committed = git(["log", "--name-only", "--format=", "origin/axiom-theory..HEAD"])
        .split("\n").filter(Boolean);
    } catch {
      note("origin/axiom-theory not visible — committed-range path check skipped");
    }
    paths = [...new Set([...status, ...committed])];
  } catch (e) {
    note(`git checks skipped (${e.message.split("\n")[0]})`);
    return;
  }
  for (const p of paths)
    if (!allowedPath(lane, p))
      fail(`${p} · touched by a ${lane} run — outside its §7 path set`);

  for (const target of paths.filter((p) => p.endsWith("/LOG.md"))) {
    for (const range of [["HEAD"], ["origin/axiom-theory..HEAD"]]) {
      try {
        const numstat = git(["diff", "--numstat", ...range, "--", target]).trim();
        if (numstat) {
          const deleted = Number(numstat.split("\t")[1]);
          if (deleted > 0)
            fail(`${target} · ${deleted} line(s) deleted — LOG.md is append-only (§7)`);
        }
      } catch { /* range may not exist; the other one covers it */ }
    }
  }
}

// ---- main ----------------------------------------------------------------

const arg = process.argv[2];
if (!arg || (arg !== "--all" && !LANES[arg])) {
  console.error(`usage: node graph/check.mjs <${Object.keys(LANES).join("|")}> | --all`);
  process.exit(2);
}
const lanes = arg === "--all" ? Object.keys(LANES) : [arg];

const failures = [];
const warnings = [];
const notes = [];
const fail = (m) => failures.push(m);
const warn = (m) => warnings.push(m);
const note = (m) => notes.push(m);

const current = schemaVersion();

// Load EVERY graph regardless of mode, so cross-graph edges always resolve
// against the real siblings. Only the requested lanes are judged.
const graphs = new Map();
const siblings = new Map();
for (const lane of Object.keys(LANES)) {
  const { data, error } = loadGraph(lane);
  if (error) { if (lanes.includes(lane)) fail(error); continue; }
  graphs.set(lane, data);
  if (Array.isArray(data.nodes))
    siblings.set(LANES[lane], new Set(data.nodes.map((n) => n.id).filter((i) => typeof i === "string")));
}

let totals = { nodes: 0, edges: 0, cross: 0 };
for (const lane of lanes) {
  for (const f of LANE_FILES)
    if (!existsSync(join(ROOT, "theory", lane, f)))
      fail(`theory/${lane}/${f} · missing`);
  const g = graphs.get(lane);
  if (g) {
    const t = checkGraph(lane, g, current, siblings, fail, warn) || {};
    totals.nodes += t.nodes || 0;
    totals.edges += t.edges || 0;
    totals.cross += t.cross || 0;
  }
}
if (arg !== "--all") checkDiscipline(arg, fail, note);
else {
  // Unknown directories under theory/ are drift the optimizer should see.
  for (const d of readdirSync(join(ROOT, "theory"), { withFileTypes: true }))
    if (d.isDirectory() && !LANES[d.name])
      warn(`theory/${d.name}/ · not a chartered lane`);
}

for (const n of notes) console.log(`note: ${n}`);
if (warnings.length) {
  console.log(`warnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  - ${w}`);
}
if (failures.length) {
  console.error(`axiom-check FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `axiom-check OK — ${lanes.length === 1 ? `theory/${arg}` : `${lanes.length} graphs`}: ` +
  `${totals.nodes} nodes, ${totals.edges} edges (${totals.cross} cross-graph), schema v${current}.`
);

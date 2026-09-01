#!/usr/bin/env node
// Graph health — the optimizer's measurement instrument (CHARTER §5).
// Zero dependencies, same reason as check.mjs: lane containers run bare.
//
// Usage (paths resolve from this file, cwd does not matter):
//   node graph/health.mjs               human-readable report, all graphs
//   node graph/health.mjs --json        machine-readable, for the digest
//   node graph/health.mjs --as-of 2026-08-26   staleness relative to a date
//
// What this measures vs what check.mjs enforces: check.mjs fails on
// malformed graphs; this script assumes well-formed input (run the checker
// first) and reports the health signals SCHEMA.md and go-5 name — status
// mix, staleness, orphans (program-wide degree zero; the rate is the list
// over the node count), unresolved contradictions, detail weight,
// near-duplicate candidates (these last two program-wide) — plus, since
// 2026-09-01, run recency (go-11): every other signal is a function of
// graph CONTENT and reads unchanged when a lane stops running, so a lane's
// last LOG.md row date is measured too. Numbers here are descriptive, never gating:
// a finding is the START of an optimizer judgment, not a verdict. In
// particular a "near-duplicate candidate" is a pair worth a human read —
// claim-token overlap cannot tell a duplicate from a deliberate
// cross-lane mirror (bod-2/gen-2 class), and only literal duplicates may
// ever be merged (CHARTER §5).

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Lanes are DISCOVERED from theory/, not hardcoded: check.mjs owns the
// chartered-lane table (tied to SCHEMA.md); this tool measures whatever
// graphs exist, so a newly chartered lane is counted the run it lands
// instead of silently missed (which is how the database lane was born
// invisible to this file's first version, 2026-08-26). Each lane's id
// prefix is derived from its own node ids — check.mjs enforces they agree.
const LANE_DIRS = readdirSync(join(ROOT, "theory"), { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name).sort();
const STATUSES = ["conjecture", "argued", "cited", "measured"];

// Tunables — named here so a change to a threshold is a diff, not a drift.
const STALE_DAYS = 14;        // untouched this long = stale (≈7 runs at the every-other-day cadence)
const DETAIL_BUDGET_WORDS = 400; // past this, detail is prose pretending to be a node (go-7)
const DUP_JACCARD = 0.5;      // claim-token overlap that flags a pair for reading
const SILENT_DAYS = 2;        // cadence is every-other-day, so a lane's last logged run
                              // is at most 2 whole days old on schedule; older means at
                              // least one cycle landed nothing (go-11). LOG.md is the
                              // signal because it is append-only, one row per run, and a
                              // nothing-advanced run still logs (CHARTER §3) — where
                              // graph.updated moves only on content. Limits: it trusts
                              // the row's leading date, and it cannot say WHY a lane is
                              // silent, only that it is.

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const asOfIdx = args.indexOf("--as-of");
const asOf = asOfIdx >= 0 ? new Date(args[asOfIdx + 1]) : new Date();
if (Number.isNaN(asOf.getTime())) {
  console.error("--as-of needs YYYY-MM-DD");
  process.exit(2);
}

const days = (iso) => Math.floor((asOf - new Date(iso)) / 86400000);
const words = (s) => (typeof s === "string" ? s.trim().split(/\s+/).filter(Boolean).length : 0);

// Claim → token set for near-duplicate flagging. Lowercased, stopwords out,
// crude plural fold — deliberately dumb and deterministic.
const STOP = new Set("a an the is are be been was were of in on for to from with and or not no never its it this that as by at over under one every each per".split(" "));
const tokens = (claim) =>
  new Set(claim.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.replace(/s$/, "")));
const jaccard = (a, b) => {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter || 1);
};

// ---- load all graphs (well-formedness is check.mjs's job) ----------------
// Last logged run per lane, from LOG.md's append-only rows ("- YYYY-MM-DD ·").
// Max, not last line: robust to trailing prose while rows stay chronological.
const lastLogDate = (lane) => {
  try {
    const rows = readFileSync(join(ROOT, "theory", lane, "LOG.md"), "utf8")
      .match(/^- \d{4}-\d{2}-\d{2}(?= )/gm) ?? [];
    return rows.map((r) => r.slice(2)).sort().at(-1) ?? null;
  } catch {
    return null; // no LOG.md — reported as such, never a crash
  }
};

const graphs = [];
for (const lane of LANE_DIRS) {
  try {
    const g = JSON.parse(readFileSync(join(ROOT, "theory", lane, "graph.json"), "utf8"));
    // Prefix from the lane's own ids (checker-enforced uniform); a lane
    // with no nodes yet gets a prefix nothing matches, so every edge would
    // count as cross — harmless for an empty graph. The sentinel was a NUL
    // byte until 2026-08-28, which made git classify this whole file as
    // binary and its diffs unreviewable — the opposite of go-5's
    // "a change is a diff, not drift". Any printable non-id character works.
    const prefix = (g.nodes?.[0]?.id ?? "").split("-")[0] || "~";
    graphs.push({ lane, prefix, g });
  } catch (e) {
    console.error(`theory/${lane}/graph.json failed to load (${e.message}) — run check.mjs first`);
    process.exit(1);
  }
}

// Program-wide degree: an orphan is degree-0 across ALL graphs, since
// cross-graph edges are how the combination attaches (go-3).
const degree = new Map();
const contradictions = [];
for (const { lane, g } of graphs)
  for (const n of g.nodes) {
    degree.set(n.id, degree.get(n.id) ?? 0);
    for (const e of Array.isArray(n.edges) ? n.edges : []) {
      degree.set(n.id, (degree.get(n.id) ?? 0) + 1);
      degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
      if (e.type === "contradicts") contradictions.push({ lane, from: n.id, to: e.to });
    }
  }

const allNodes = graphs.flatMap(({ lane, g }) => g.nodes.map((n) => ({ lane, n })));

// Near-duplicate candidates, program-wide (cross-graph pairs included).
const dupCandidates = [];
for (let i = 0; i < allNodes.length; i++)
  for (let j = i + 1; j < allNodes.length; j++) {
    const s = jaccard(tokens(allNodes[i].n.claim), tokens(allNodes[j].n.claim));
    if (s >= DUP_JACCARD)
      dupCandidates.push({ a: allNodes[i].n.id, b: allNodes[j].n.id, similarity: Number(s.toFixed(2)) });
  }

const perLane = graphs.map(({ lane, prefix, g }) => {
  const mix = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  let edges = 0, crossOut = 0, detailMax = 0, detailTotal = 0, overBudget = [];
  let sources = 0, gradedSources = 0;
  const stale = [], orphans = [];
  for (const n of g.nodes) {
    mix[n.status]++;
    // Graded sources: verification markers in the sources array ONLY.
    // Grades written into detail prose are deliberately not counted — the
    // '-grade' suffix is homonymous between verification labels
    // ("record-grade") and domain adjectives ("instrument-grade model"),
    // and only a reader can tell them apart in prose (go-10). This counts
    // what a schema-defined per-source grade field would inherit, nothing
    // more; it is not a push to adopt a convention go-10 records as
    // non-propagating.
    for (const s of Array.isArray(n.sources) ? n.sources : []) {
      sources++;
      if (/-grade\b/i.test(s)) gradedSources++;
    }
    const nodeEdges = Array.isArray(n.edges) ? n.edges : [];
    edges += nodeEdges.length;
    crossOut += nodeEdges.filter((e) => !e.to.startsWith(prefix + "-")).length;
    const w = words(n.detail);
    detailTotal += w;
    if (w > detailMax) detailMax = w;
    if (w > DETAIL_BUDGET_WORDS) overBudget.push({ id: n.id, words: w });
    if (days(n.updated) > STALE_DAYS && n.status === "conjecture") stale.push(n.id);
    if ((degree.get(n.id) ?? 0) === 0) orphans.push(n.id);
  }
  const lastLog = lastLogDate(lane);
  return {
    lane, nodes: g.nodes.length, edges, crossOut, updated: g.updated, mix,
    staleConjectures: stale, orphans, overBudget, sources, gradedSources,
    detailMeanWords: g.nodes.length ? Math.round(detailTotal / g.nodes.length) : 0,
    detailMaxWords: detailMax,
    lastLog, logAgeDays: lastLog === null ? null : days(lastLog),
    silent: lastLog === null || days(lastLog) > SILENT_DAYS,
  };
});

const totals = {
  nodes: allNodes.length,
  edges: perLane.reduce((a, l) => a + l.edges, 0),
  cross: perLane.reduce((a, l) => a + l.crossOut, 0),
  mix: Object.fromEntries(STATUSES.map((s) => [s, perLane.reduce((a, l) => a + l.mix[s], 0)])),
  contradictions,
  dupCandidates,
  silentLanes: perLane.filter((l) => l.silent)
    .map((l) => ({ lane: l.lane, lastLog: l.lastLog, logAgeDays: l.logAgeDays })),
  asOf: asOf.toISOString().slice(0, 10),
  thresholds: { STALE_DAYS, DETAIL_BUDGET_WORDS, DUP_JACCARD, SILENT_DAYS },
};

if (asJson) {
  console.log(JSON.stringify({ totals, lanes: perLane }, null, 2));
  process.exit(0);
}

console.log(`graph health — ${totals.asOf} · ${totals.nodes} nodes, ${totals.edges} edges (${totals.cross} cross-graph)`);
console.log(`status mix: ${STATUSES.map((s) => `${totals.mix[s]} ${s}`).join(" · ")}`);
console.log(`unresolved contradictions: ${contradictions.length}${contradictions.length ? " — " + contradictions.map((c) => `${c.from}⇄${c.to}`).join(", ") : " (zero — see go-6 before reading this as health)"}`);
console.log(`near-duplicate candidates (jaccard ≥ ${DUP_JACCARD}): ${dupCandidates.length ? dupCandidates.map((d) => `${d.a}~${d.b}@${d.similarity}`).join(", ") : "none"}`);
console.log(`silent lanes (last logged run > ${SILENT_DAYS}d old): ${totals.silentLanes.length ? totals.silentLanes.map((s) => `${s.lane}@${s.lastLog ?? "no LOG"}(${s.logAgeDays ?? "?"}d)`).join(", ") : "none"}`);
console.log("");
for (const l of perLane) {
  const flags = [
    l.orphans.length && `orphans: ${l.orphans.join(",")}`,
    l.staleConjectures.length && `stale conjectures (>${STALE_DAYS}d): ${l.staleConjectures.join(",")}`,
    l.overBudget.length && `detail over ${DETAIL_BUDGET_WORDS}w: ${l.overBudget.map((o) => `${o.id}(${o.words})`).join(",")}`,
  ].filter(Boolean);
  console.log(
    `${l.lane.padEnd(16)} ${String(l.nodes).padStart(2)} nodes  ${String(l.edges).padStart(2)} edges (${l.crossOut} cross)  ` +
    `[${STATUSES.map((s) => l.mix[s]).join("/")}]  detail ${l.detailMeanWords}w mean / ${l.detailMaxWords}w max  graded src ${l.gradedSources}/${l.sources}` +
    (flags.length ? `\n${" ".repeat(17)}⚑ ${flags.join(" · ")}` : "")
  );
}
console.log(`\n[status mix column: ${STATUSES.join("/")}]`);

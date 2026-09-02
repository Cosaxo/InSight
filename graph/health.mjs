#!/usr/bin/env node
// Graph health — the optimizer's measurement instrument (CHARTER §5).
// Zero dependencies, same reason as check.mjs: lane containers run bare.
//
// Usage (paths resolve from this file, cwd does not matter):
//   node graph/health.mjs               human-readable report, all graphs
//   node graph/health.mjs --json        machine-readable, for the digest
//   node graph/health.mjs --as-of 2026-08-26   staleness and edge currency
//                                              relative to a date (commits
//                                              up to it; working tree ignored)
//
// What this measures vs what check.mjs enforces: check.mjs fails on
// malformed graphs; this script assumes well-formed input (run the checker
// first) and reports the health signals SCHEMA.md and go-5 name — status
// mix, staleness, orphans (program-wide degree zero; the rate is the list
// over the node count), unresolved contradictions, detail weight,
// near-duplicate candidates (these last two program-wide) — plus, since
// 2026-09-01, run recency (go-11): every other signal is a function of
// graph CONTENT and reads unchanged when a lane stops running, so a lane's
// last LOG.md row date is measured too — and, since 2026-09-02, edge
// currency (go-12): check.mjs proves an edge's target EXISTS, not that its
// claim still reads as it did when the edge was made, so each node's last
// claim-change date is recovered from git and every edge older than its
// target's claim is listed for its owner, beside two cheaper cousins of
// the same drift — a prose rung label ("map-6 (cited)") that no longer
// matches the target's status, and a same-type mutual pair (A supports B,
// B supports A). Numbers here are descriptive, never gating:
// a finding is the START of an optimizer judgment, not a verdict. In
// particular a "near-duplicate candidate" is a pair worth a human read —
// claim-token overlap cannot tell a duplicate from a deliberate
// cross-lane mirror (bod-2/gen-2 class), and only literal duplicates may
// ever be merged (CHARTER §5).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
const byId = new Map(allNodes.map(({ lane, n }) => [n.id, { lane, n }]));

// ---- edge currency (go-12) ---------------------------------------------
// The last date each node's CLAIM changed, recovered by walking every
// commit that touched its graph file — the graph carries `updated` per
// node but no per-field history, and `updated` moves on detail and edge
// changes too, so it over-flags (49 vs 25 of 321 edges when this landed).
// Git is the one history this branch has (SCHEMA: "history lives in git").
// A working-tree claim that differs from the last committed one counts as
// changed today — only when measuring today: under --as-of the walk stops
// at that date and the working tree is ignored, so a replayed view never
// dates an uncommitted claim into the past. Where git is unavailable the
// signal is reported as not measured, never guessed. A truncated history
// is named — the test is whether the root of HEAD's history is a shallow
// boundary (a clone of main alone leaves this orphan branch complete, and
// its boundary commit touches no graph file, so the boundary list itself
// is not the test) — because claim changes before the boundary are
// unseen and currency then reads better than it is. A lane whose graph
// has no commits yet gets each node's `created` as its claim date rather
// than "today", so a freshly seeded lane does not flag every inbound edge.
const asOfDate = asOf.toISOString().slice(0, 10);
const measuringToday = asOfIdx < 0;
const git = (args) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const claimChanged = new Map();
let historyNote = null;
let currencyMeasured = true;
try {
  let shallow = new Set();
  try {
    const sp = git(["rev-parse", "--git-path", "shallow"]).trim();
    const abs = sp.startsWith("/") ? sp : join(ROOT, sp);
    if (existsSync(abs)) shallow = new Set(readFileSync(abs, "utf8").split("\n").filter(Boolean));
  } catch { /* no shallow file — full history */ }
  const roots = git(["rev-list", "--max-parents=0", "HEAD"]).trim().split("\n").filter(Boolean);
  const truncated = roots.some((r) => shallow.has(r));
  for (const { lane, g } of graphs) {
    const rel = `theory/${lane}/graph.json`;
    const commits = git(["log", "--format=%H %cs", "--reverse", `--before=${asOfDate}T23:59:59Z`, "--", rel])
      .trim().split("\n").filter(Boolean);
    const prev = new Map();
    for (const line of commits) {
      const [hash, date] = line.split(" ");
      let snap;
      try { snap = JSON.parse(git(["show", `${hash}:${rel}`])); } catch { continue; }
      for (const n of snap.nodes ?? []) {
        if (prev.get(n.id) !== n.claim) claimChanged.set(n.id, date);
        prev.set(n.id, n.claim);
      }
    }
    if (commits.length === 0) {
      for (const n of g.nodes) claimChanged.set(n.id, n.created);
    } else if (measuringToday) {
      for (const n of g.nodes)
        if (prev.has(n.id) && prev.get(n.id) !== n.claim) claimChanged.set(n.id, asOfDate);
        else if (!prev.has(n.id)) claimChanged.set(n.id, n.created);
    }
  }
  if (truncated) historyNote = "git history is shallow at its root — claim changes before the boundary are unseen, so edge currency reads better than it is";
} catch (e) {
  currencyMeasured = false;
  historyNote = `git history unavailable (${String(e.message).split("\n")[0]}) — edge currency not measured`;
}

// An edge is a claim about its target's claim AS IT READ when the edge was
// made (go-12). Flagged: source.updated earlier than the target's last
// claim change — the source has not been touched since the target moved.
// A candidate to READ: the rewrite may have kept the edge true. Limit: a
// re-read that confirms the edge and changes nothing must still move
// `updated` to clear the flag (SCHEMA.md's 2026-09-02 note), or the flag
// stands as a known item.
const staleEdges = [];
if (currencyMeasured)
  for (const { lane, n } of allNodes)
    for (const e of Array.isArray(n.edges) ? n.edges : []) {
      const changed = claimChanged.get(e.to);
      if (changed && changed > n.updated)
        staleEdges.push({ lane, from: n.id, type: e.type, to: e.to, updated: n.updated, claimChanged: changed,
          cross: byId.get(e.to)?.lane !== lane });
    }

// Prose rung labels: "map-6 (cited)" or "gen-11 cited, bod-8 cited" written
// into a claim or detail is a statement about a sibling's status that
// nothing updates when the sibling moves. Two forms are counted — the
// parenthesised one, and the bare one only when punctuation follows the
// rung, because "cen-2 argued that…" is a verb and a regex cannot tell.
const RUNG_RES = [
  /\b([a-z]+-\d+)\s*\((conjecture|argued|cited|measured)\b/g,
  /\b([a-z]+-\d+),?\s+(conjecture|argued|cited|measured)(?=[,;:.)])/g,
];
const rungLabels = [];
for (const { lane, n } of allNodes)
  for (const re of RUNG_RES)
    for (const m of `${n.claim} ${n.detail ?? ""}`.matchAll(re)) {
      const target = byId.get(m[1]);
      if (!target || m[1] === n.id) continue;
      rungLabels.push({ lane, from: n.id, to: m[1], stated: m[2], actual: target.n.status, drifted: target.n.status !== m[2] });
    }
const rungDrift = rungLabels.filter((r) => r.drifted);

// Mutual pairs. A depends/supports pair is the fission shape (child
// supports parent, parent depends on child) and is counted, not flagged;
// the same type both ways — A supports B and B supports A — is a cycle
// that lends each node the other's standing and is flagged. The test is
// the intersection of the type SETS in each direction, so a multi-typed
// edge cannot hide a cycle behind whichever of its types is read first.
const types = new Map(); // "a>b" → Set of types
for (const { n } of allNodes)
  for (const e of n.edges ?? []) {
    const k = `${n.id}>${e.to}`;
    if (!types.has(k)) types.set(k, new Set());
    types.get(k).add(e.type);
  }
const mutualSameType = [];
let mutualPairs = 0;
for (const [k, fwd] of types) {
  const [a, b] = k.split(">");
  if (a > b) continue; // each unordered pair once
  const back = types.get(`${b}>${a}`);
  if (!back) continue;
  mutualPairs++;
  for (const t of fwd) if (back.has(t)) mutualSameType.push({ a, b, type: t });
}

// Inbound cross-graph edges per lane — "another lane used it", the
// review rubric's 8-anchor, counted rather than asserted.
const inboundCross = new Map();
for (const { lane, n } of allNodes)
  for (const e of n.edges ?? []) {
    const t = byId.get(e.to);
    if (t && t.lane !== lane) {
      const rec = inboundCross.get(t.lane) ?? { edges: 0, nodes: new Set() };
      rec.edges++; rec.nodes.add(e.to);
      inboundCross.set(t.lane, rec);
    }
  }

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
  const inb = inboundCross.get(lane) ?? { edges: 0, nodes: new Set() };
  return {
    lane, nodes: g.nodes.length, edges, crossOut, updated: g.updated, mix,
    inboundCrossEdges: inb.edges, inboundCrossNodes: inb.nodes.size,
    staleEdges: staleEdges.filter((s) => s.lane === lane).map(({ from, type, to, claimChanged }) => ({ from, type, to, claimChanged })),
    rungDrift: rungDrift.filter((r) => r.lane === lane).map(({ from, to, stated, actual }) => ({ from, to, stated, actual })),
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
  edgeCurrency: {
    measured: currencyMeasured,
    note: historyNote,
    stale: staleEdges.length, staleCross: staleEdges.filter((s) => s.cross).length,
    edges: staleEdges.map(({ from, type, to, updated, claimChanged }) => ({ from, type, to, updated, claimChanged })),
  },
  rungLabels: rungLabels.length,
  rungDrift: rungDrift.map(({ from, to, stated, actual }) => ({ from, to, stated, actual })),
  mutualPairs,
  mutualSameType,
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
if (historyNote) console.log(`note: ${historyNote}`);
if (currencyMeasured)
  console.log(`edge currency: ${staleEdges.length} of ${totals.edges} edges predate their target's last claim change (${totals.edgeCurrency.staleCross} cross-graph)` +
    (staleEdges.length ? " — " + staleEdges.map((s) => `${s.from}→${s.to}(${s.claimChanged})`).join(", ") : ""));
console.log(`rung-label drift: ${rungDrift.length} of ${rungLabels.length} prose rung labels no longer match${rungDrift.length ? " — " + rungDrift.map((r) => `${r.from} says ${r.to} (${r.stated}), now ${r.actual}`).join("; ") : ""}`);
console.log(`mutual pairs: ${mutualPairs} (typed both ways; the depends/supports fission shape is expected) · same type both ways: ${mutualSameType.length ? mutualSameType.map((m) => `${m.a}⇄${m.b} ${m.type}`).join(", ") : "none"}`);
console.log("");
for (const l of perLane) {
  const flags = [
    l.orphans.length && `orphans: ${l.orphans.join(",")}`,
    l.staleConjectures.length && `stale conjectures (>${STALE_DAYS}d): ${l.staleConjectures.join(",")}`,
    l.overBudget.length && `detail over ${DETAIL_BUDGET_WORDS}w: ${l.overBudget.map((o) => `${o.id}(${o.words})`).join(",")}`,
    l.staleEdges.length && `edges older than their target's claim: ${l.staleEdges.map((s) => `${s.from}→${s.to}`).join(",")}`,
    l.rungDrift.length && `rung labels drifted: ${l.rungDrift.map((r) => `${r.from}:${r.to}`).join(",")}`,
  ].filter(Boolean);
  console.log(
    `${l.lane.padEnd(16)} ${String(l.nodes).padStart(2)} nodes  ${String(l.edges).padStart(2)} edges (${l.crossOut} cross out, ${l.inboundCrossEdges} in to ${l.inboundCrossNodes} nodes)  ` +
    `[${STATUSES.map((s) => l.mix[s]).join("/")}]  detail ${l.detailMeanWords}w mean / ${l.detailMaxWords}w max  graded src ${l.gradedSources}/${l.sources}` +
    (flags.length ? `\n${" ".repeat(17)}⚑ ${flags.join(" · ")}` : "")
  );
}
console.log(`\n[status mix column: ${STATUSES.join("/")}]`);

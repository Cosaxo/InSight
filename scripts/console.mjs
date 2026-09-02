#!/usr/bin/env node
// console.mjs — the program console: regenerate docs/MERGE-LIST.md from
// GitHub, act on the owner's ticks, fold the owner list, write one trail row
// a day, and rewrite the pinned Console issue (D352,
// docs/PROGRAM-RUNBOOK.md § The console).
//
//   node scripts/console.mjs             # write the list, the fold and the trail; no GitHub writes
//   node scripts/console.mjs --refresh   # also mirror ticks to labels, open PRs for ticked
//                                        # branches, and rewrite the Console issue (needs GITHUB_TOKEN)
//   node scripts/console.mjs --json      # print the state and write nothing
//
// WHY A WORKFLOW AND NOT A ROUTINE. Every account's Routines are invisible
// to the other two, and a Routine costs an account's bucket. What this
// script reads — the tree, GitHub, the theory branch — is readable by a
// GitHub Action with no subscription at all, every two hours, and on the
// push that carries the owner's tick. Only what a subscription alone can
// see (its Routines' fire state, its cost) arrives through the roll-call
// rows the accounts post, which this script reads like any comment.
//
// STDLIB ONLY, the pulse.mjs discipline: a page whose job is to tell the
// owner the state of the program must not be able to fail because a
// registry did. `fetch` is Node's own.
//
// The pure half — parsers, the tick decision, renderers — is
// console-lib.mjs, tested with fixtures. This file is the I/O.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  prRow, branchRow, isNoPrBranch, decideActions, renderMergeList, parseTicks,
  withoutFolds,
  parseWorklist, parseOwnerList, parseAxioms, parseVisualRequests, parsePermissions,
  parseRegister, ownerSteps, uncheckedSteps, theorySummary, rollCalls, lastSeen,
  foldOwnerList, notAlreadyListed, trailRow, mergeTrail, renderConsole, isoDay,
  checksSummary, SHIFT_BLOCKED,
} from "./console-lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = process.env.GITHUB_REPOSITORY || "Cosaxo/InSight";
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const API = "https://api.github.com";
const args = process.argv.slice(2);
const REFRESH = args.includes("--refresh");
const JSON_ONLY = args.includes("--json");

const MERGE_LIST = join(ROOT, "docs", "MERGE-LIST.md");
const OWNER_LIST = join(ROOT, "docs", "OWNER-LIST.md");
const TRAIL = join(ROOT, "monitoring", "console-trail.jsonl");
const read = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), "utf8") : null);

// The run logs, by title — one issue per program, the repo's convention.
const RUN_LOGS = ["Question farm — run log", "Axes program run log", "doc-sweep run log", "Ops run log", "Program run log"];
const CONSOLE_TITLE = "Console";

// ── GitHub ───────────────────────────────────────────────────────────
async function gh(path, { method = "GET", body, raw = false } = {}) {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "insight-console", "X-GitHub-Api-Version": "2022-11-28" };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  // A hung socket must not hang the page: twenty seconds per call, and the
  // caller records the source as missing rather than waiting on it.
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return raw ? res : res.json();
}

async function ghAll(path) {
  const out = [];
  for (let page = 1; page <= 10; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const batch = await gh(`${path}${sep}per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

async function readGithub(missing) {
  // `ok` says the FIRST call answered, which is all it can say: it is set
  // below as soon as the open-PR list arrives. Every call after it can
  // still fail, and two of them fail SILENTLY — a branch whose compare
  // errored is dropped by the same `continue` as a branch that is simply
  // not ahead, and a failed closed-PR page yields an empty merged list.
  // The merge list is then regenerated from the short set and the missing
  // rows are deleted, taking the owner's tick with them. So the write
  // guard needs a stronger fact than "GitHub answered once".
  const g = { ok: false, rowsComplete: true, mergedOk: true, error: null, prs: [], branches: [], merged: [], comments: {}, consoleIssue: null, mainCi: null, merges: [] };
  const step = async (name, fn) => { try { return await fn(); } catch (e) { missing.push(`${name} (${e.message.split("\n")[0].slice(0, 80)})`); return null; } };
  const prs = await step("open PRs", () => ghAll(`/repos/${REPO}/pulls?state=open&base=main`));
  if (prs === null) { g.error = missing[missing.length - 1]; return g; }
  g.ok = true;
  g.prs = [];
  for (const pr of prs) {
    const detail = await step(`PR #${pr.number}`, () => gh(`/repos/${REPO}/pulls/${pr.number}`));
    const checks = await step(`checks #${pr.number}`, () => gh(`/repos/${REPO}/commits/${pr.head.sha}/check-runs?per_page=100`));
    const cmp = await step(`compare #${pr.number}`, () => gh(`/repos/${REPO}/compare/main...${pr.head.sha}`));
    let shiftBlocked = false;
    const labels = (pr.labels || []).map((l) => l.name);
    if (labels.includes("approved") && !labels.includes("merge-when-green")) {
      const comments = await step(`comments #${pr.number}`, () => ghAll(`/repos/${REPO}/issues/${pr.number}/comments`));
      shiftBlocked = (comments || []).some((c) => SHIFT_BLOCKED.test(String(c.body || "").split("\n")[0]));
    }
    g.prs.push({ pr, extras: { mergeableState: detail?.mergeable_state, checkRuns: checks?.check_runs, behindBy: cmp?.behind_by, shiftBlocked } });
  }
  const openHeads = new Set(prs.map((p) => p.head.ref));
  const branches = await step("branches", () => ghAll(`/repos/${REPO}/branches`));
  if (branches === null) g.rowsComplete = false;
  for (const b of branches || []) {
    if (!isNoPrBranch(b.name) || openHeads.has(b.name)) continue;
    // The branch name goes in raw: the compare route takes `base...head` as one
    // path segment and reads a slash inside a branch name correctly, while an
    // encoded slash is a different string to it.
    const cmp = await step(`compare ${b.name}`, () => gh(`/repos/${REPO}/compare/main...${b.name}`));
    // A FAILED compare is not "not ahead". Both used to `continue` here,
    // so a transient error deleted that branch's row from the next render.
    if (cmp === null) { g.rowsComplete = false; continue; }
    if (!cmp.ahead_by) continue;
    const last = cmp.commits?.[cmp.commits.length - 1];
    g.branches.push({ name: b.name, aheadBy: cmp.ahead_by, lastCommitAt: last?.commit?.committer?.date || null, commits: (cmp.commits || []).map((c) => c.commit.message.split("\n")[0]) });
  }
  const closed = await step("merged PRs", () => gh(`/repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=60&base=main`));
  if (closed === null) g.mergedOk = false;
  const weekAgo = new Date(Date.now() - 7 * 86400e3).toISOString();
  g.merged = (closed || []).filter((p) => p.merged_at && p.merged_at > weekAgo).map((p) => ({ number: p.number, title: p.title, merged_at: p.merged_at, merged_by: p.merged_by?.login }));
  const issues = await step("issues", () => ghAll(`/repos/${REPO}/issues?state=open`));
  for (const it of issues || []) {
    if (it.pull_request) continue;
    if (it.title === CONSOLE_TITLE) g.consoleIssue = it;
    if (RUN_LOGS.includes(it.title)) {
      const last = Math.max(1, Math.ceil((it.comments || 0) / 100));
      const cs = await step(`comments on "${it.title}"`, async () => {
        const a = await gh(`/repos/${REPO}/issues/${it.number}/comments?per_page=100&page=${last}`);
        const b = last > 1 ? await gh(`/repos/${REPO}/issues/${it.number}/comments?per_page=100&page=${last - 1}`) : [];
        return [...b, ...a];
      });
      g.comments[it.title] = cs || [];
    }
  }
  const head = await step("main head", () => gh(`/repos/${REPO}/commits/main`));
  if (head) {
    const runs = await step("main checks", () => gh(`/repos/${REPO}/commits/${head.sha}/check-runs?per_page=100`));
    g.mainCi = runs ? checksSummary(runs.check_runs) : null;
  }
  const merges = await step("recent merges", () => gh(`/repos/${REPO}/commits?sha=main&per_page=10`));
  g.merges = (merges || []).map((c) => ({ sha: c.sha, subject: c.commit.message.split("\n")[0], date: c.commit.committer?.date }));
  return g;
}

// ── the theory branch ───────────────────────────────────────────────
function gitShow(ref, path) {
  try { return execFileSync("git", ["show", `${ref}:${path}`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
  catch { return null; }
}

function readTheory(missing) {
  const ref = "origin/axiom-theory";
  let lanes;
  try {
    lanes = execFileSync("git", ["ls-tree", "--name-only", ref, "theory/"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n").filter(Boolean).map((p) => p.replace(/^theory\//, "").replace(/\/$/, ""));
  } catch { missing.push("origin/axiom-theory (not fetched)"); return null; }
  const graphs = {}, logs = {};
  for (const lane of lanes) {
    const g = gitShow(ref, `theory/${lane}/graph.json`);
    if (!g) continue;
    try { graphs[lane] = JSON.parse(g); } catch { missing.push(`theory/${lane}/graph.json (unparseable)`); continue; }
    logs[lane] = gitShow(ref, `theory/${lane}/LOG.md`) || "";
  }
  return theorySummary({ graphs, logs, digest: gitShow(ref, "DIGEST.md") || "", scores: gitShow(ref, "theory/review/SCORES.md") || "", verdicts: gitShow(ref, "bridge/VERDICTS.md") || "" });
}

// ── assemble ────────────────────────────────────────────────────────
export async function collect({ now = new Date() } = {}) {
  const missing = [];
  const generatedAt = now.toISOString().slice(0, 19) + "Z";
  const today = isoDay(now);
  const github = await readGithub(missing);
  const priorList = read("docs/MERGE-LIST.md") || "";
  const rows = [
    ...github.prs.map(({ pr, extras }) => prRow(pr, extras)),
    ...github.branches.map((b) => branchRow(b)),
  ];
  const worklist = parseWorklist(read("docs/WORKLIST.md") || "");
  const owner = parseOwnerList(read("docs/OWNER-LIST.md") || "");
  const axioms = parseAxioms(read("docs/AXIOMS.md") || "");
  const visuals = parseVisualRequests(read("docs/VISUAL-REQUESTS.md") || "");
  const permissions = parsePermissions(read("docs/PERMISSIONS.md") || "");
  const register = parseRegister(read("docs/ROUTINES.md"));
  const theory = readTheory(missing);
  const trailText = read("monitoring/pulse-trail.jsonl");
  const pulseRows = trailText ? trailText.split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const pulse = pulseRows.length ? pulseRows[pulseRows.length - 1] : null;
  const allComments = Object.values(github.comments).flat();
  const ops = github.comments["Ops run log"] || [];
  const runLogs = {};
  for (const title of RUN_LOGS) {
    const cs = github.comments[title];
    runLogs[title] = cs && cs.length ? { created_at: cs[cs.length - 1].created_at, line: String(cs[cs.length - 1].body || "").split("\n")[0] } : null;
  }
  const seen = {};
  for (const r of register || []) seen[r.name] = lastSeen(allComments, r.name);
  const state = {
    generatedAt, today, github: { ok: github.ok, error: github.error }, rows, merged: github.merged,
    worklist, owner, axioms, visuals, permissions, register, lastSeen: seen, theory, pulse,
    rollCalls: rollCalls(ops, today), runLogs,
    productionReader: lastSeen(ops, "production reader"),
    mainCi: github.mainCi, merges: github.merges, missing,
    ownerSteps: [
      ...ownerSteps(read("docs/AXES-RUNBOOK.md"), "docs/AXES-RUNBOOK.md"),
      ...ownerSteps(read("docs/PROGRAM-RUNBOOK.md"), "docs/PROGRAM-RUNBOOK.md"),
    ],
    launchOpen: uncheckedSteps(read("docs/LAUNCH-RUNBOOK.md"), "docs/LAUNCH-RUNBOOK.md"),
    priorList, priorIssueBody: github.consoleIssue?.body || "", consoleIssue: github.consoleIssue, branches: github.branches,
  };
  return state;
}

// ── act ─────────────────────────────────────────────────────────────
async function ensureLabel() {
  try { await gh(`/repos/${REPO}/labels/approved`); }
  catch (e) {
    if (e.status !== 404) throw e;
    await gh(`/repos/${REPO}/labels`, { method: "POST", body: { name: "approved", color: "0e8a16", description: "The owner's tick on docs/MERGE-LIST.md — the merge shift takes it from here (D352)" } });
  }
}

async function act(state, actions, log) {
  if (!actions.length) return new Set();
  // The keys this run could not apply. A failed label call leaves the row's
  // labels untouched, so the next render draws it UNTICKED — the owner's
  // approval erased from the file by a transient GitHub error, with the
  // action forgotten too (the following run sees no tick, so decides
  // nothing). Handing these back lets the render keep the tick; keeping
  // them out of the ticks marker is what makes that run try again.
  const failed = new Set();
  await ensureLabel();
  for (const a of actions) {
    try {
      if (a.type === "label-add") {
        await gh(`/repos/${REPO}/issues/${a.number}/labels`, { method: "POST", body: { labels: [a.label] } });
        state.rows.find((r) => r.key === a.key)?.labels.push(a.label);
        log(`labelled ${a.key} ${a.label}`);
      } else if (a.type === "label-remove") {
        await gh(`/repos/${REPO}/issues/${a.number}/labels/${encodeURIComponent(a.label)}`, { method: "DELETE" });
        const row = state.rows.find((r) => r.key === a.key);
        if (row) row.labels = row.labels.filter((l) => l !== a.label);
        log(`withdrew ${a.label} from ${a.key}`);
      } else if (a.type === "open-pr") {
        const b = state.branches.find((x) => x.name === a.branch);
        const commits = (b?.commits || []).slice(-40).map((s) => `- ${s}`).join("\n");
        const body = `Opened by the console workflow from a tick on \`docs/MERGE-LIST.md\` (D352): ${a.from}'s branch \`${a.branch}\`, ${b?.aheadBy ?? "?"} commits ahead of \`main\`. The merge shift brings it current, runs the battery, reviews the diff as one unit and hands it to the shepherd.\n\nwhat: ${a.from}'s work on \`${a.branch}\`\nhow: see the commits below and the branch's own summary\n\n${commits}`;
        const pr = await gh(`/repos/${REPO}/pulls`, { method: "POST", body: { title: `${a.branch}: ${a.from}'s branch, approved from the merge list`, head: a.branch, base: "main", body } });
        await gh(`/repos/${REPO}/issues/${pr.number}/labels`, { method: "POST", body: { labels: ["approved"] } });
        const idx = state.rows.findIndex((r) => r.key === a.key);
        const row = prRow({ ...pr, labels: [{ name: "approved" }] }, {});
        if (idx >= 0) state.rows.splice(idx, 1, row); else state.rows.push(row);
        log(`opened #${pr.number} from ${a.branch} and labelled it approved`);
      }
    } catch (e) {
      failed.add(a.key);
      log(`::warning::${a.type} ${a.key} failed: ${e.message.split("\n")[0]} — the tick stays on the row and the next run tries again`);
    }
  }
  return failed;
}

async function upsertIssue(state, body, log) {
  if (!state.consoleIssue) {
    const created = await gh(`/repos/${REPO}/issues`, { method: "POST", body: { title: CONSOLE_TITLE, body } });
    state.consoleIssue = created;
    log(`created the Console issue #${created.number}`);
    try {
      await gh(`/graphql`, { method: "POST", body: { query: "mutation($id: ID!) { pinIssue(input: { issueId: $id }) { issue { number } } }", variables: { id: created.node_id } } });
      log("pinned it");
    } catch (e) { log(`could not pin the Console issue (the owner pins it once): ${e.message.split("\n")[0]}`); }
    return;
  }
  if (state.consoleIssue.body !== body) {
    await gh(`/repos/${REPO}/issues/${state.consoleIssue.number}`, { method: "PATCH", body: { body } });
    log(`rewrote the Console issue #${state.consoleIssue.number}`);
  }
}

// ── main ────────────────────────────────────────────────────────────
async function main() {
  const log = (m) => console.log(`console: ${m}`);
  const state = await collect();
  if (JSON_ONLY) { console.log(JSON.stringify(state, null, 2)); return; }

  const file = parseTicks(state.priorList);
  const issue = parseTicks(state.priorIssueBody);
  const actions = state.github.ok ? decideActions(state.rows, file, issue) : [];
  const failed = REFRESH && TOKEN ? await act(state, actions, log) : new Set();
  if (!(REFRESH && TOKEN) && actions.length) log(`${actions.length} tick action(s) pending — run with --refresh and a token to apply: ${actions.map((a) => `${a.type} ${a.key}`).join(", ")}`);

  // The list: only when GitHub answered — a render from nothing would erase
  // the owner's ticks with an empty page.
  // …and only when it answered COMPLETELY. `ok` is set by the first call
  // alone, so a partial failure used to regenerate this file from a short
  // set of rows — which is the same erasure the line above refuses, just
  // arriving through a half-answer instead of a silent one. A tick the
  // owner put on a row is the row's only record of their decision.
  if (state.github.ok && state.github.rowsComplete && state.github.mergedOk) {
    writeFileSync(MERGE_LIST, renderMergeList({ rows: state.rows, merged: state.merged, generatedAt: state.generatedAt, pending: failed }));
    log("wrote docs/MERGE-LIST.md");
  } else if (!state.github.ok) log(`left docs/MERGE-LIST.md untouched — ${state.github.error}`);
  else log(`left docs/MERGE-LIST.md untouched — GitHub answered in part only (${state.missing.join("; ")})`);

  // The owner list's folded blocks.
  const ownerText = read("docs/OWNER-LIST.md");
  if (ownerText) {
    // Parsed WITHOUT the generated blocks — see `withoutFolds`. `state.owner`
    // keeps seeing the whole file on purpose: the trail's ownerOpen and the
    // Console issue's "Today" panel are about what is on the list, generated
    // rows included. Only this one question — "did the owner already write
    // this themselves?" — has to ignore the fold's own output.
    const hand = Object.values(parseOwnerList(withoutFolds(ownerText))).flatMap((s) => s.open);
    const decisions = notAlreadyListed(hand, state.ownerSteps).map((s) => `**${s.title}** — *Source:* \`${s.file}\` ${s.id}.`);
    const launch = notAlreadyListed(hand, state.launchOpen).map((s) => `**${s.id} ${s.title}** — *Source:* \`docs/LAUNCH-RUNBOOK.md\`.`);
    const approvals = state.github.ok
      ? [`${state.rows.filter((r) => r.kind === "pr" && !r.selfMerge && r.stage === "new").length} PR row(s) and ${state.rows.filter((r) => r.kind === "branch").length} branch row(s) waiting for a tick in \`docs/MERGE-LIST.md\` § Open (${state.today}).`]
      : [];
    writeFileSync(OWNER_LIST, foldOwnerList(ownerText, { Decisions: decisions, "Store and legal": launch, Approvals: approvals }));
    log("folded docs/OWNER-LIST.md");
  }

  // The trail: one row a day, same-day replace.
  const prior = existsSync(TRAIL) ? readFileSync(TRAIL, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const rows = mergeTrail(prior, trailRow(state));
  writeFileSync(TRAIL, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  log(`trail row for ${state.today}`);

  if (REFRESH && TOKEN && state.github.ok && state.github.rowsComplete && state.github.mergedOk) {
    await upsertIssue(state, renderConsole(state, state.priorIssueBody, failed), log);
  } else if (REFRESH) log("no token or GitHub unreachable — the Console issue was not rewritten");
  if (state.missing.length) log(`sources that did not answer: ${state.missing.join("; ")}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`console: ${e.stack || e}`); process.exit(1); });
}

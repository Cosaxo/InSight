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
  parseWorklist, parseOwnerList, parseAxioms, parseVisualRequests, parsePermissions, listProblem,
  parseRegister, ownerSteps, uncheckedSteps, theorySummary, rollCalls, lastSeen,
  foldOwnerList, notAlreadyListed, trailRow, mergeTrail, renderConsole, isoDay, listIsWritable,
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
  // `rowsComplete` — WHETHER THE ROW SET IS ALL OF IT, which is not the
  // same question as `ok`, and conflating them is a third way to lose an
  // owner's approval with no trace.
  //
  // `ok` says the open-PR listing answered. The BRANCH rows come from two
  // further reads, and both were swallowed into `missing` and fell back to
  // nothing: a failed `/branches` yields no branch rows at all, a failed
  // per-branch compare drops that one. `ok` stays true either way, so the
  // merge list was rewritten from a row set that silently lacked them —
  // and a row's tick lives in the file, drawn from its labels. No row, no
  // tick, no action to retry, exit 0.
  //
  // This is the door the failed-action guard cannot see: that guard is
  // anchored to the row, and the row is what goes missing.
  const g = { ok: false, error: null, rowsComplete: true, prs: [], branches: [], merged: [], comments: {}, consoleIssue: null, mainCi: null, merges: [] };
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
    // A compare that FAILED and one that says the branch is not ahead are
    // different answers; only the second is a reason to skip the row.
    if (cmp === null) { g.rowsComplete = false; continue; }
    if (!cmp.ahead_by) continue;
    const last = cmp.commits?.[cmp.commits.length - 1];
    g.branches.push({ name: b.name, aheadBy: cmp.ahead_by, lastCommitAt: last?.commit?.committer?.date || null, commits: (cmp.commits || []).map((c) => c.commit.message.split("\n")[0]) });
  }
  const closed = await step("merged PRs", () => gh(`/repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=60&base=main`));
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
  // The `|| ""` these five lines used to carry turned "the file is not
  // there" into "the file is empty", and an empty file parses to zero of
  // everything — so the page drew "0 axioms" and "(none open)" and then
  // reported, at its foot, that every source had answered. `listProblem`
  // asks whether the text is there AND whether the headings the parser
  // needs are; either way the panel gets a null and `missing` gets the
  // reason. (`parseRegister` below never had the bug — it takes `read()`'s
  // null straight and the routine panel has always drawn its absence.)
  const list = (file, parse) => {
    const text = read(file);
    const why = listProblem(file, text);
    if (why) { missing.push(why); return null; }
    return parse(text);
  };
  const worklist = list("docs/WORKLIST.md", parseWorklist);
  const owner = list("docs/OWNER-LIST.md", parseOwnerList);
  const axioms = list("docs/AXIOMS.md", parseAxioms);
  const visuals = list("docs/VISUAL-REQUESTS.md", parseVisualRequests);
  const permissions = list("docs/PERMISSIONS.md", parsePermissions);
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
    mainCi: github.mainCi, merges: github.merges, missing, rowsComplete: github.rowsComplete,
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
async function ensureLabel(api = gh) {
  try { await api(`/repos/${REPO}/labels/approved`); }
  catch (e) {
    if (e.status !== 404) throw e;
    await api(`/repos/${REPO}/labels`, { method: "POST", body: { name: "approved", color: "0e8a16", description: "The owner's tick on docs/MERGE-LIST.md — the merge shift takes it from here (D352)" } });
  }
}

/**
 * Apply the owner's ticks, and RETURN THE ONES THAT DID NOT LAND.
 *
 * The caller needs that list, because the merge list is rewritten from
 * `state.rows` and a row's box is drawn from its LABELS. So a tick whose
 * label-add failed came back drawn UNTICKED, the ticks marker stopped
 * listing it, and on the next run `decideActions` saw neither a new tick
 * (the box is empty now) nor a withdrawal (the marker never had it). The
 * owner's approval was gone from the file and from the issue, with no
 * trace on either, and the run was green.
 *
 * `api` is injectable so the failure path can be tested; it defaults to
 * the real GitHub call.
 */
/**
 * Should this run leave the merge list and the Console issue ALONE?
 *
 * Yes whenever an owner tick has not been mirrored — whether the call
 * failed, or the run never tried. Rewriting either surface then draws the
 * row from its labels, which is to say unticked, and drops it from the
 * ticks marker; the next run sees neither a new tick nor a withdrawal and
 * the approval is gone from both places.
 *
 * Extracted so the truth table can be pinned: `main` does enough I/O that
 * the decision would otherwise be untestable, which is how the second door
 * (a render-only run) stayed open after the first was closed.
 */
// Re-exported from the library, where trailRow can reach it too — see the
// note on its definition for why all three writers must ask the same rule.
export { listIsWritable };

export const holdsTheList = ({ failed, actions, canApply }) =>
  failed.length > 0 || (actions.length > 0 && !canApply);

export async function act(state, actions, log, api = gh) {
  const failed = [];
  if (!actions.length) return failed;
  await ensureLabel(api);
  const gh = api;
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
      // UNPREFIXED, on its own line. This went through `log`, which
      // prefixes with "console: " — and GitHub parses a workflow command
      // only when `::` begins the line, so the one place the console
      // reported that it had dropped an owner decision produced no
      // annotation at all. Measured with `node -e`.
      console.log(`::warning::${a.type} ${a.key} failed: ${e.message.split("\n")[0]}`);
      failed.push({ ...a, error: e.message.split("\n")[0] });
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
  let failed = [];
  if (REFRESH && TOKEN) failed = await act(state, actions, log);
  else if (actions.length) log(`${actions.length} tick action(s) pending — run with --refresh and a token to apply: ${actions.map((a) => `${a.type} ${a.key}`).join(", ")}`);

  // A TICK THAT DID NOT LAND LEAVES THE FILE ALONE.
  //
  // The rule below is "only rewrite when GitHub answered", and it was
  // true of a rejected PUSH and not of a rejected ACTION — which is the
  // case that actually costs a tick. Rewriting now would draw that row
  // unticked (the box comes from the labels), and the next run would see
  // neither a new tick nor a withdrawal: the approval would be gone from
  // both surfaces, silently.
  //
  // Leaving both files untouched keeps the owner's box exactly as they
  // left it, so the next run finds the same new tick and RETRIES. The
  // run goes red, which is the point: a console that dropped a decision
  // must not report success. A persistent refusal then shows as a red
  // run over a stale list, which is visible — the alternative is green
  // over a list that is quietly wrong.
  // …AND SO DOES ONE THAT WAS NEVER ATTEMPTED. A run without --refresh or
  // without a token computes the actions, logs them as pending, and used
  // to rewrite the list anyway — drawing the row unticked and dropping it
  // from the marker, which is the identical loss through a different
  // door. `console.yml`'s push-retry rides exactly that door: on a
  // rejected push it resets to main (picking up any tick pushed
  // meanwhile) and re-runs the console WITHOUT --refresh.
  //
  // Not an error, though: render-only is a legitimate mode and the retry
  // uses it deliberately, so this leaves the files alone and exits 0. The
  // loop's own `git diff --quiet` then finds nothing to commit and stops,
  // which leaves the owner's box exactly as main holds it.
  if (holdsTheList({ failed, actions, canApply: !!(REFRESH && TOKEN) })) {
    for (const f of failed) log(`did not apply: ${f.type} ${f.key} — ${f.error}`);
    const n = failed.length || actions.length;
    log(`left docs/MERGE-LIST.md and the Console issue untouched so ${n} tick(s) are retried next run`);
    if (state.missing.length) log(`sources that did not answer: ${state.missing.join("; ")}`);
    if (failed.length) process.exitCode = 1;
    return;
  }

  // The list: only when GitHub answered — a render from nothing would erase
  // the owner's ticks with an empty page.
  if (listIsWritable({ ok: state.github.ok, rowsComplete: state.rowsComplete })) {
    writeFileSync(MERGE_LIST, renderMergeList({ rows: state.rows, merged: state.merged, generatedAt: state.generatedAt }));
    log("wrote docs/MERGE-LIST.md");
  } else if (!state.github.ok) {
    log(`left docs/MERGE-LIST.md untouched — ${state.github.error}`);
  } else {
    // Rewriting now would drop the missing rows AND their ticks. Same
    // posture as a rejected action: a red run over a stale list beats a
    // green one over a list that is quietly wrong.
    console.log("::warning::console: a branch listing did not answer — docs/MERGE-LIST.md left untouched so no tick is lost");
    log("left docs/MERGE-LIST.md untouched — the branch rows are incomplete");
    process.exitCode = 1;
  }

  // The owner list's folded blocks.
  // `state.owner` null means the file is absent or its headings drifted;
  // folding then would rewrite the owner's own file from a parse that
  // found nothing in it. Leave it alone and let the page say why.
  const ownerText = state.owner ? read("docs/OWNER-LIST.md") : null;
  if (ownerText) {
    // OPEN AND DONE. A row the owner ticked is still something they have
    // said by hand — more so — and leaving it out meant the fold
    // regenerated it unticked on the next run.
    // `s.hand`, not open+done: open+done includes the fold's own previous
    // output, which made every generated row filter itself out and emptied
    // the block on alternate runs. parseOwnerList has the arithmetic.
    const hand = Object.values(state.owner).flatMap((s) => s.hand || []);
    const decisions = notAlreadyListed(hand, state.ownerSteps).map((s) => `**${s.title}** — *Source:* \`${s.file}\` ${s.id}.`);
    const launch = notAlreadyListed(hand, state.launchOpen).map((s) => `**${s.id} ${s.title}** — *Source:* \`docs/LAUNCH-RUNBOOK.md\`.`);
    // THE SAME RULE THE MERGE LIST ASKS. This counted branch rows off
    // `state.rows` gated on `ok` alone — so on the run that deliberately
    // refused to rewrite the merge list because the branch rows were
    // short, it wrote that short count into the OWNER'S list as a fact.
    const approvals = listIsWritable({ ok: state.github.ok, rowsComplete: state.rowsComplete })
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

  if (REFRESH && TOKEN && state.github.ok) {
    await upsertIssue(state, renderConsole(state, state.priorIssueBody), log);
  } else if (REFRESH) log("no token or GitHub unreachable — the Console issue was not rewritten");
  if (state.missing.length) log(`sources that did not answer: ${state.missing.join("; ")}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`console: ${e.stack || e}`); process.exit(1); });
}

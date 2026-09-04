// pr-shepherd.mjs — the I/O half of the PR shepherd Action: read the open
// pull requests, spend the owner's label where it may be spent, and write one
// run-log line whatever happened.
//
// Deliberately thin, like console.mjs: every decision lives in
// pr-shepherd-lib.mjs where a test can hold it. This file talks to GitHub and
// nothing else.
//
//   node scripts/pr-shepherd.mjs            # merge what is green
//   node scripts/pr-shepherd.mjs --dry-run  # decide and print, merge nothing
//
// NEEDS: GITHUB_TOKEN with contents:write, pull-requests:write, issues:write.
// GITHUB_REPOSITORY is set by Actions; both are read from the environment so
// the script can be run by hand against the same repository.

import { verdict, runLogLine, shouldLog, LABEL } from "./pr-shepherd-lib.mjs";

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const REPO = process.env.GITHUB_REPOSITORY || "Cosaxo/InSight";
const API = "https://api.github.com";
const DRY = process.argv.includes("--dry-run");
const RUN_LOG_TITLE = "Ops run log";
// Set by Actions; "schedule" and "workflow_dispatch" are the heartbeat runs
// that log even when idle. Anything else logs only when it acted.
const EVENT = process.env.GITHUB_EVENT_NAME || "workflow_dispatch";

async function gh(path, { method = "GET", body } = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "insight-pr-shepherd",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

/**
 * Read a PR, waiting for GitHub to finish computing `mergeable`.
 *
 * Returns as soon as the field is a boolean. Gives up after the last attempt
 * and returns the null-carrying payload — the caller reports that as "not
 * yet" rather than as a conflict, which is the one reading of null that does
 * not strand a mergeable PR.
 */
async function prWithMergeability(number, attempts = 5, waitMs = 2000) {
  let pr;
  for (let i = 0; i < attempts; i++) {
    pr = await gh(`/repos/${REPO}/pulls/${number}`);
    if (pr.mergeable !== null && pr.mergeable !== undefined) return pr;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, waitMs));
  }
  return pr;
}

async function main() {
  const when = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const merged = [];
  const reported = [];
  let skipped = 0;

  const list = await gh(`/repos/${REPO}/pulls?state=open&base=main&per_page=100`);

  // Oldest first: if two labelled PRs both merge in one run, the one that has
  // waited longest goes first. The contract breaks its own ties toward the
  // older label for the same reason.
  list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  for (const brief of list) {
    const labels = (brief.labels ?? []).map((l) => l.name);
    if (!labels.includes(LABEL)) { skipped++; continue; }

    // The list payload carries no `mergeable` — that is computed per PR, so
    // the labelled ones are fetched singly and the rest cost nothing.
    //
    // AND ASKING ONCE IS NOT ENOUGH. GitHub computes mergeability lazily: the
    // first read of a PR STARTS the background job and returns
    // `mergeable: null`, and only a later read carries the answer. Measured
    // on this lane's first two live runs (2026-09-04 08:21 and 08:23), which
    // both reported "GitHub has not finished computing mergeability" for a PR
    // that was green and clean — one read each, two minutes apart, and the
    // second was as null as the first because each run asked once and left.
    // Polling here rather than deferring to the next run: a lane that hands
    // the work to its own next fire is the shape that merged nothing for
    // sixteen fires.
    const pr = await prWithMergeability(brief.number);
    const checkRuns = await gh(`/repos/${REPO}/commits/${pr.head.sha}/check-runs?per_page=100`);
    const checks = (checkRuns.check_runs ?? []).map((c) => ({ name: c.name, status: c.status, conclusion: c.conclusion }));

    const v = verdict(pr, checks);
    if (v.action === "skip") { skipped++; continue; }
    if (v.action === "report") { reported.push({ number: pr.number, why: v.why }); continue; }

    if (DRY) { merged.push({ number: pr.number, sha: "dry-run-000000" }); continue; }

    try {
      // Squash, the repository's shape: the PR title as the subject and the
      // PR body as the message, which is what every merge on this repo looks
      // like and what the run logs cite.
      const out = await gh(`/repos/${REPO}/pulls/${pr.number}/merge`, {
        method: "PUT",
        body: {
          merge_method: "squash",
          commit_title: `${pr.title} (#${pr.number})`,
          commit_message: pr.body ?? "",
          sha: pr.head.sha, // refuse if the head moved between the read and the merge
        },
      });
      merged.push({ number: pr.number, sha: out.sha });
    } catch (err) {
      // A merge that GitHub refuses is reported, never retried and never
      // worked around. 405 is the ordinary one: the head moved, or a
      // protection rule this lane cannot see said no.
      reported.push({ number: pr.number, why: `merge refused: ${String(err.message).slice(0, 160)}` });
    }
  }

  const line = runLogLine({ when, merged, reported, skipped })
    + "\n\n---\n_Posted by `.github/workflows/pr-shepherd.yml` — the mechanical half of `docs/OPS-RUNBOOK.md` § The PR shepherd._";

  if (DRY) { console.log(line); return; }

  if (!shouldLog({ event: EVENT, merged, reported })) {
    console.log(`${EVENT}: nothing to do (${skipped} unlabelled) — no run-log line, by design`);
    return;
  }

  // The run log is the only thing this lane writes besides the merge itself.
  // If the issue is missing, say so on stdout rather than inventing one:
  // creating issues is not this lane's business.
  try {
    const issues = await gh(`/repos/${REPO}/issues?state=open&per_page=100`);
    const log = issues.find((i) => i.title === RUN_LOG_TITLE && !i.pull_request);
    if (!log) { console.log(`no open issue titled "${RUN_LOG_TITLE}" — the line follows:\n${line}`); return; }
    await gh(`/repos/${REPO}/issues/${log.number}/comments`, { method: "POST", body: { body: line } });
    console.log(`run log #${log.number}: ${merged.length} merged, ${reported.length} reported, ${skipped} skipped`);
  } catch (err) {
    console.log(`could not post the run-log line (${err.message}); it follows:\n${line}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });

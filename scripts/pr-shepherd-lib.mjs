// pr-shepherd-lib.mjs — the pure half of the PR shepherd: given what GitHub
// says about a pull request, decide whether the owner's label may be spent.
//
// WHY A LIB AND AN I/O SCRIPT. Same split as console-lib / console and
// pulse-collect / pulse-render, for the same reason: the parts that can be
// wrong QUIETLY are the parts a test can hold. Everything here is a function
// of a JSON payload in and a verdict out, so every rule below has a case in
// pr-shepherd.test.mjs, including the ones that must refuse.
//
// WHY THIS EXISTS AT ALL (2026-09-03). The shepherd was a scheduled Claude
// session and could not merge: a Routine minted over MCP hands its fired
// sessions no MCP tools, so two fires (15:55Z and 16:44Z), both told to log
// unconditionally and to push a diagnostic branch if they could not comment,
// left no comment, no merge, no branch and no diag branch — without add_repo
// they never had the repository at all. Seven labelled PRs waited, and the
// owner's word was "i should not have to click anything". An Action needs no
// Routine, no connector and no subscription: production-reader.yml and
// console.yml made that argument first. Its own header says it moved "while
// the shepherds could not", which was true of the JUDGEMENT half and not of
// this one.
//
// WHAT THIS HALF DOES NOT DO, deliberately. It never renumbers a decision
// record, never resolves a conflict, never pushes to a branch and never
// applies a label. Those need judgement and stay with a session
// (docs/OPS-RUNBOOK.md § The PR shepherd). What is left is exactly the case
// that failed all day on 2026-09-02 and 09-03: labelled, green, mergeable,
// and nothing merging it.

/** The owner's merge instruction. Applied by them, or by the merge shift off a tick. */
export const LABEL = "merge-when-green";
/** The owner's opt-out, one label (the contract's word). */
export const OPT_OUT = "no-shepherd";

/**
 * Decide what to do with one pull request.
 *
 * @param {object} pr    - the PR payload: {number, draft, labels[], mergeable, mergeable_state, head:{sha}}
 * @param {object[]} checks - check runs for the CURRENT head: [{name, status, conclusion}]
 * @returns {{action:"merge"|"skip"|"report", why:string}}
 *
 * `skip` is silence — the PR is not this lane's business. `report` is a line
 * on the run log: it IS this lane's business and it cannot be finished.
 */
export function verdict(pr, checks) {
  const labels = (pr.labels ?? []).map((l) => (typeof l === "string" ? l : l.name));

  // Not ours, and not worth a word. The label is the whole scope: an
  // unlabelled PR is the owner's to decide about, not this lane's to touch.
  if (!labels.includes(LABEL)) return { action: "skip", why: "not labelled" };
  if (labels.includes(OPT_OUT)) return { action: "skip", why: `${OPT_OUT} — the owner's opt-out` };
  if (pr.draft) return { action: "skip", why: "draft" };

  // NO CHECKS IS NOT GREEN, and this is the guard that matters most here.
  // An empty array reads as "nothing failed" to any all()/every() written in
  // a hurry, so a PR whose CI never started would merge unexamined. The
  // contract's word is "every check on the CURRENT head concluded success",
  // and zero checks cannot satisfy it.
  if (!checks || checks.length === 0) {
    return { action: "report", why: "no check runs on the head yet — zero checks is not green" };
  }

  const pending = checks.filter((c) => c.status !== "completed");
  if (pending.length) {
    // Not a failure and not a finding: the next run picks it up. Reported
    // rather than skipped so a PR that is stuck queued is visible.
    return { action: "report", why: `${pending.length} check(s) still running: ${pending.map((c) => c.name).join(", ")}` };
  }

  const failed = checks.filter((c) => c.conclusion !== "success" && c.conclusion !== "neutral" && c.conclusion !== "skipped");
  if (failed.length) {
    return { action: "report", why: `red: ${failed.map((c) => `${c.name} (${c.conclusion})`).join(", ")}` };
  }

  // GitHub's own answer, and it is the one that knows about branch
  // protection and conflicts. `mergeable` is null while it is still
  // computing the merge commit — null is NOT false, and treating it as
  // false would report a conflict that does not exist.
  if (pr.mergeable === null || pr.mergeable === undefined) {
    return { action: "report", why: "GitHub has not finished computing mergeability — next run" };
  }
  if (pr.mergeable === false) {
    return { action: "report", why: `not mergeable (${pr.mergeable_state ?? "unknown"}) — a conflict is a session's to resolve, not this lane's` };
  }
  // `blocked` is a required review or a required check this lane cannot see;
  // merging past it is not this lane's call even with everything green.
  if (pr.mergeable_state === "blocked") {
    return { action: "report", why: "mergeable_state blocked — a required review or check is outstanding" };
  }

  return { action: "merge", why: `${checks.length} checks green on ${String(pr.head?.sha ?? "").slice(0, 8)}` };
}

/**
 * Should this run write a run-log line at all?
 *
 * The heartbeat is the SCHEDULE: a scheduled run always writes, including one
 * with nothing to do, because a lane that writes only when it acts cannot be
 * told from one that is dead (OPS-RUNBOOK.md §0). But this Action also wakes
 * on every completed check suite — that is what makes a green PR merge within
 * minutes instead of within three hours — and those fire dozens of times a
 * day. An idle line for each would bury the run log in its own noise, which
 * is the failure the thirteen "no change" fires of 2026-09-02 already
 * demonstrated one layer up. So an event-driven run writes only when it did
 * something.
 */
export function shouldLog({ event, merged = [], reported = [] }) {
  if (event === "schedule" || event === "workflow_dispatch") return true;
  return merged.length > 0 || reported.length > 0;
}

/**
 * The run-log line. One per scheduled run, ALWAYS, including a run with
 * nothing to do — see shouldLog for why the event-driven ones are quieter.
 */
export function runLogLine({ when, merged = [], reported = [], skipped = 0 }) {
  const head = `**PR shepherd (Action) · ${when}**`;
  if (!merged.length && !reported.length) {
    return `${head} — nothing labelled \`${LABEL}\`; ${skipped} open PR(s) left alone. No merge, no comment.`;
  }
  const lines = [head, ""];
  if (merged.length) {
    lines.push("| merged | as |", "| --- | --- |");
    for (const m of merged) lines.push(`| #${m.number} | \`${m.sha.slice(0, 8)}\` |`);
    lines.push("");
  }
  if (reported.length) {
    lines.push("| labelled, not merged | why |", "| --- | --- |");
    for (const r of reported) lines.push(`| #${r.number} | ${r.why} |`);
    lines.push("");
  }
  lines.push(`${skipped} open PR(s) carried no label and were left alone.`);
  return lines.join("\n");
}

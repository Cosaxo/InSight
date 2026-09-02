// console-lib.mjs — the pure half of the program console: parse the six
// lists, the register and the theory branch; decide what the owner's ticks
// mean; render the merge list, the pinned Console issue and the trail row.
//
// WHY A LIB AND AN I/O SCRIPT. Everything here is a function of text and
// JSON in, text and JSON out, so it can be tested with fixtures and never
// needs a token. console.mjs is the half that talks to git and GitHub and
// writes files; it is deliberately thin. Same split as pulse-collect /
// pulse-render, for the same reason: the parts that can be wrong quietly are
// the parts a test can hold.
//
// THE ONE RULE EVERY RENDERER HERE OBEYS (D1, pointed at a dashboard): a
// source that did not report is drawn as absent — "no row today", "not on
// main yet", "not reported" — never as a zero and never as yesterday's
// number. The owner runs the program from this page; a confident zero here
// is the D296 failure one layer up.
//
// THE TICK PROTOCOL (D352, docs/PROGRAM-RUNBOOK.md § The console). The
// owner's approval is a tick — `- [x]` on a row of docs/MERGE-LIST.md, or
// the same box in the pinned Console issue. Both surfaces are regenerated
// by the workflow, so to tell an owner's edit from a stale render each
// carries a marker listing which rows were rendered ticked:
//
//     <!-- console:ticks #367,#366,night-20260902 -->
//
// A box ticked now that the marker did not list is a NEW tick (approve →
// label `approved`, or open the PR for a branch row). A box unticked now
// that the marker listed is a WITHDRAWAL (remove `approved`, unless
// `merge-when-green` is already on — the shift has handed it over and the
// shepherd's five steps own it from there). A row whose label moved on
// GitHub itself (the owner labelled directly, the shift applied
// merge-when-green) simply re-renders — labels are the truth the boxes
// mirror, and the marker is what keeps the mirror from echoing itself.

// ── lanes, by the branch they write ──────────────────────────────────
// Which lane a branch belongs to, and whether that lane merges its own PR
// (the content lanes, D212). The console lists self-merging lanes without a
// box: their PRs are in flight only until CI is green, and a tick would
// race the lane's own merge.
export const LANE_BRANCHES = [
  [/^claude\/question-farm-/, "the question farm", true],
  [/^claude\/catalog-(?:question|domain)-/, "the catalog lane", true],
  [/^claude\/learn-cards-/, "the learn lane", true],
  [/^claude\/feed-questions-/, "the feed lane", true],
  [/^claude\/duel-questions-/, "the duel lane", true],
  [/^claude\/now-questions-/, "the now lane", true],
  [/^claude\/axes-retro-/, "the axes retro lane", false],
  [/^claude\/axes-/, "the axes build lane", false],
  [/^claude\/doc-sweep-/, "the doc sweep", false],
  [/^claude\/worklist-/, "a list worker", false],
  [/^claude\/axiom-/, "the axiom builder", false],
  [/^claude\/console-/, "the console improver", false],
  [/^claude\/release-record-/, "the release recorder", false],
  [/^claude\/pulse-promote-/, "the pulse responder", false],
  [/^claude\/deps-audit-/, "the dependency shepherd", false],
  [/^dependabot\//, "dependabot", false],
  [/^night-\d{8}$/, "Claude 2's night shift", false],
  [/^nightb-\d{8}$/, "Claude 1's night shift B", false],
  [/^claude\/daily-algorithm-improvement/, "Claude 1's algorithm improver", false],
  [/^claude\/daily-database-optimization/, "Claude 1's database improver", false],
];

// Branches that carry work and never a PR of their own (the register's
// "never merges, owner opens the PR" tier): the merge list draws them as
// `no PR yet` rows so a tick can open the PR (the owner's answer 12).
export const NO_PR_BRANCHES = [
  /^night-\d{8}$/,
  /^nightb-\d{8}$/,
  /^claude\/daily-algorithm-improvement/,
  /^claude\/daily-database-optimization/,
];

export function laneOfBranch(name) {
  for (const [re, lane, selfMerge] of LANE_BRANCHES) {
    if (re.test(name || "")) return { lane, selfMerge };
  }
  return { lane: "a session", selfMerge: false };
}

export const isNoPrBranch = (name) => NO_PR_BRANCHES.some((re) => re.test(name || ""));

// ── what / how ──────────────────────────────────────────────────────
// Every program prompt asks a PR body to open with a `what:` and a `how:`
// line, because the owner reads the merge list on a phone and the diff is
// not the summary. Older PRs (and the template's own "## What changed, and
// why" heading) have neither, so the fallback is the body's first two
// sentences of prose — headings, tables, checkboxes, code and the
// attribution footer stripped first.
const trunc = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…");
const clean = (s) => s.replace(/^[*_]+|[*_]+$/g, "").replace(/\s+/g, " ").trim();

export function whatHow(body) {
  const text = String(body || "").replace(/<!--[\s\S]*?-->/g, "");
  const lines = text.split("\n").map((l) => l.trim().replace(/^[-*]\s+/, ""));
  const find = (key) => {
    const re = new RegExp(`^[*_]{0,2}\\s*${key}\\s*[*_]{0,2}:\\s*[*_]{0,2}\\s*(.+)$`, "i");
    for (const l of lines) {
      const m = re.exec(l);
      if (m) return clean(m[1]);
    }
    return null;
  };
  let what = find("what");
  let how = find("how");
  if (!what || !how) {
    const prose = lines
      .filter((l) => l && !/^(#|\||- \[|```|---|>|🤖|https?:\/\/|_Generated|Co-Authored|Claude-Session)/.test(l))
      .join(" ");
    const sentences = prose.split(/(?<=[.!?])\s+/).filter(Boolean);
    what ??= sentences[0] || "";
    how ??= sentences[1] || "";
  }
  return { what: trunc(what, 180), how: trunc(how, 180) };
}

// ── checks ──────────────────────────────────────────────────────────
export function checksSummary(checkRuns) {
  const runs = checkRuns || [];
  let passed = 0, failed = 0, pending = 0;
  for (const r of runs) {
    if (r.status !== "completed") pending++;
    else if (["success", "neutral", "skipped"].includes(r.conclusion)) passed++;
    else failed++;
  }
  const total = runs.length;
  const state = total === 0 ? "none" : failed ? "red" : pending ? "pending" : "green";
  return { state, passed, failed, pending, total };
}

export const checksWord = (c) =>
  c.state === "none" ? "no checks" :
  c.state === "green" ? `CI green (${c.passed})` :
  c.state === "red" ? `CI red (${c.failed} of ${c.total})` :
  `CI running (${c.pending} pending)`;

// ── stages ──────────────────────────────────────────────────────────
export const hasLabel = (pr, name) => (pr.labels || []).some((l) => (l.name || l) === name);

export function stageOf(pr) {
  if (hasLabel(pr, "merge-when-green")) return "ready";
  if (hasLabel(pr, "approved")) return pr.shiftBlocked ? "blocked" : "shift";
  return "new";
}

// The merge shift leaves a PR it could not make green with `approved` still
// on and one comment whose first line says so; the console reads that line
// rather than inventing a label for it (labels stay the owner's and the
// shift's, § The merge shift).
export const SHIFT_BLOCKED = /^merge shift:.*could not/i;

// ── rows ────────────────────────────────────────────────────────────
export function prRow(pr, extras = {}) {
  const { lane, selfMerge } = laneOfBranch(pr.head?.ref || pr.head);
  const from = pr.user?.login === "dependabot[bot]" ? "dependabot" : lane;
  const { what, how } = whatHow(pr.body);
  const checks = checksSummary(extras.checkRuns);
  return {
    kind: "pr",
    key: `#${pr.number}`,
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    branch: pr.head?.ref || pr.head,
    author: pr.user?.login,
    from,
    selfMerge,
    draft: !!pr.draft,
    labels: (pr.labels || []).map((l) => l.name || l),
    createdAt: pr.created_at,
    what,
    how,
    checks,
    mergeable: extras.mergeableState || pr.mergeable_state || "unknown",
    behindBy: extras.behindBy ?? null,
    shiftBlocked: !!extras.shiftBlocked,
    stage: stageOf({ ...pr, shiftBlocked: !!extras.shiftBlocked }),
  };
}

export function branchRow(branch) {
  const { lane } = laneOfBranch(branch.name);
  return {
    kind: "branch",
    key: branch.name,
    branch: branch.name,
    from: lane,
    aheadBy: branch.aheadBy ?? null,
    lastCommitAt: branch.lastCommitAt || null,
    stage: "no PR yet",
  };
}

// ── the tick markers ────────────────────────────────────────────────
const TICKS_RE = /<!--\s*console:ticks\s*([^>]*?)\s*-->/;
export const ticksMarker = (keys) => `<!-- console:ticks ${[...keys].join(",")} -->`;

export function renderedTicks(text) {
  const m = TICKS_RE.exec(text || "");
  if (!m) return new Set();
  return new Set(m[1].split(",").map((s) => s.trim()).filter(Boolean));
}

// `- [x] **#367** …` and `- [ ] **night-20260902** (no PR yet) …`
const ROW_RE = /^\s*- \[( |x|X)\] \*\*(#\d+|[^*\s][^*]*?)\*\*/;

export function parseTicks(text) {
  const now = new Map();
  for (const line of String(text || "").split("\n")) {
    const m = ROW_RE.exec(line);
    if (m) now.set(m[2].trim(), m[1] !== " ");
  }
  return { now, rendered: renderedTicks(text) };
}

// ── the decision ────────────────────────────────────────────────────
// What the owner's edits since the last render mean, as actions for the
// I/O half. Order matters: the file is read first, the issue second, and a
// tick beats an untick when both surfaces disagree — approving is the act
// the page exists for, withdrawing is the rarer one and the owner can
// repeat it.
export function decideActions(rows, file, issue) {
  const actions = [];
  const newTick = (key) =>
    (file.now.get(key) === true && !file.rendered.has(key)) ||
    (issue.now.get(key) === true && !issue.rendered.has(key));
  const withdrawn = (key) =>
    (file.now.get(key) === false && file.rendered.has(key)) ||
    (issue.now.get(key) === false && issue.rendered.has(key));
  for (const row of rows) {
    if (row.kind === "branch") {
      if (newTick(row.key)) actions.push({ type: "open-pr", key: row.key, branch: row.branch, from: row.from });
      continue;
    }
    if (row.selfMerge) continue;
    const approved = row.labels.includes("approved");
    const ready = row.labels.includes("merge-when-green");
    if (ready) continue;
    if (!approved && newTick(row.key)) actions.push({ type: "label-add", key: row.key, number: row.number, label: "approved" });
    else if (approved && withdrawn(row.key) && !newTick(row.key))
      actions.push({ type: "label-remove", key: row.key, number: row.number, label: "approved" });
  }
  return actions;
}

// A row is drawn ticked when its label says so — after the actions above
// have run, the labels ARE the owner's ticks.
export const isTicked = (row) =>
  row.kind === "pr" && (row.labels.includes("approved") || row.labels.includes("merge-when-green"));

// ── the merge list file ─────────────────────────────────────────────
const fmtDay = (iso) => (iso ? String(iso).slice(0, 10) : "?");
const fmtTime = (iso) => (iso ? `${String(iso).slice(11, 16)} UTC ${String(iso).slice(0, 10)}` : "?");

export function rowLine(row, { box = true } = {}) {
  const tick = isTicked(row) ? "x" : " ";
  const head = box ? `- [${tick}] ` : "- ";
  if (row.kind === "branch") {
    const n = row.aheadBy == null ? "commits unknown" : `${row.aheadBy} commit${row.aheadBy === 1 ? "" : "s"}`;
    return `${head}**${row.branch}** (no PR yet) · ${row.from} · ${n} · last ${fmtTime(row.lastCommitAt)}`;
  }
  const state = [
    checksWord(row.checks),
    row.behindBy == null ? null : row.behindBy === 0 ? "current with main" : `${row.behindBy} behind main`,
    row.mergeable === "dirty" ? "conflicts" : null,
    row.draft ? "draft" : null,
  ].filter(Boolean).join(" · ");
  const stage = row.stage === "shift" ? "in the shift" : row.stage === "blocked" ? "could not be made green" : row.stage;
  return `${head}**${row.key}** · ${row.from} · *what:* ${row.what || "—"} · *how:* ${row.how || "—"} · ${state} · opened ${fmtDay(row.createdAt)} · stage **${stage}**`;
}

const MERGE_LIST_HEAD = `# Merge list — what the automation built, and what you approved

**Status: tree — generated rows, the owner's ticks.** This is the
first of the six lists (\`PROGRAM-PLAN.md\` §2.1, D352). Every open pull
request the automation or a session produced is a row here with one
line of *what* and one of *how*; every branch that carries commits and
no pull request is a row too. The rows are regenerated by the console
workflow (\`PROGRAM-RUNBOOK.md\` § The console) from GitHub; only the
ticks are yours.

## How to approve

**Tick the box.** Change \`- [ ]\` to \`- [x]\` on a row and commit to
\`main\` — in the GitHub app: open this file → ⋯ → Edit → commit. The
console workflow runs on that push, mirrors the tick to the label
\`approved\` on the pull request, and the **merge shift** takes it from
there: brings the branch current with \`main\`, runs the full battery,
reviews the whole diff as one unit, fixes what that proves broken,
and applies \`merge-when-green\` — after which the **PR shepherd**
merges (\`OPS-RUNBOOK.md\` § The PR shepherd). The same rows stand in
the pinned **Console** issue with clickable boxes; a tick there is the
same act, mirrored back into this file. Untick here to withdraw an
approval the shift has not yet acted on. Ticking a *no PR yet* row
makes the workflow open the pull request from that branch and label
it.

| Section | A row is here when | Who moves it |
| --- | --- | --- |
| **Open** | a PR is open and not yet approved (stage \`new\`), or a branch has commits and no PR (stage \`no PR yet\`) | the workflow |
| **In the shift** | the tick landed and the merge shift is bringing it to green | the workflow, on the label |
| **Ready** | \`merge-when-green\` is applied; the shepherd merges on green | the workflow, on the label |
| **Could not be made green** | the shift stopped, with what is red and why in its comment | the shift's comment, the workflow's row |
| **Merged this week** | the shepherd or the owner merged it | the workflow |

The content lanes (farm, catalog, learn, feed, duel, now) merge their
own PRs on green (D212) and are listed without a box. Dependabot's
bumps are the dependency shepherd's to verify; a tick hands one to the
merge shift like any other PR.
`;

export function renderMergeList({ rows, merged = [], generatedAt, githubState = "ok" }) {
  const by = (stage) => rows.filter((r) => r.kind === "pr" && !r.selfMerge && r.from !== "dependabot" && r.stage === stage);
  const branches = rows.filter((r) => r.kind === "branch");
  const deps = rows.filter((r) => r.kind === "pr" && r.from === "dependabot");
  const selfMerge = rows.filter((r) => r.kind === "pr" && r.selfMerge);
  const ticked = rows.filter(isTicked).map((r) => r.key);
  const lines = [MERGE_LIST_HEAD];
  lines.push(`${ticksMarker(ticked)}`);
  lines.push(`<!-- console:generated ${generatedAt} -->`);
  lines.push("");
  if (githubState !== "ok") {
    lines.push(`> **GitHub did not answer on the last refresh** (${githubState}) — these rows are the previous render, not the state of the world. The ticks are still yours.`);
    lines.push("");
  }
  const section = (title, list, opts) => {
    lines.push(`## ${title}`);
    lines.push("");
    if (list.length === 0) lines.push("*(none)*");
    for (const r of list) lines.push(rowLine(r, opts));
    lines.push("");
  };
  const open = [...by("new"), ...branches];
  section("Open", open);
  if (deps.length) {
    lines.push(`**Dependencies** (dependabot — the dependency shepherd verifies; tick to hand one to the shift):`);
    lines.push("");
    for (const r of deps.filter((d) => d.stage === "new")) lines.push(rowLine(r));
    lines.push("");
  }
  if (selfMerge.length) {
    lines.push(`**Self-merging:** ${selfMerge.map((r) => `${r.key} ${r.title}`).join(" · ")}`);
    lines.push("");
  }
  section("In the shift", [...by("shift"), ...deps.filter((d) => d.stage === "shift")]);
  section("Ready", [...by("ready"), ...deps.filter((d) => d.stage === "ready")]);
  section("Could not be made green", [...by("blocked"), ...deps.filter((d) => d.stage === "blocked")]);
  lines.push("## Merged this week");
  lines.push("");
  if (merged.length === 0) lines.push("*(none reported)*");
  for (const m of merged) lines.push(`- **#${m.number}** · ${m.title} · merged ${fmtDay(m.merged_at)}${m.merged_by ? ` by ${m.merged_by}` : ""}`);
  lines.push("");
  return lines.join("\n");
}

// ── the lists, parsed ───────────────────────────────────────────────
export function sections(text) {
  // "## Title" → body text, in order.
  const out = new Map();
  let name = null;
  const buf = [];
  const flush = () => { if (name !== null) out.set(name, buf.join("\n")); buf.length = 0; };
  for (const line of String(text || "").split("\n")) {
    const m = /^## (.+?)\s*$/.exec(line);
    if (m) { flush(); name = m[1].trim(); continue; }
    buf.push(line);
  }
  flush();
  return out;
}

const items = (body, box) =>
  String(body || "").split("\n").filter((l) => new RegExp(`^\\s*- \\[${box}\\] `).test(l)).map((l) => l.replace(/^\s*- \[.\] /, "").trim());

export function parseWorklist(text) {
  const s = sections(text);
  const open = items(s.get("Open"), " ").map((t) => {
    const m = /\[(claude-[123])\]/.exec(t);
    return { tag: m ? m[1] : "claude-2", text: t, owner: /\[owner\]/.test(t), ask: /\[ask\]/.test(t) };
  });
  const inFlight = String(s.get("In flight") || "").split("\n").filter((l) => /^\s*- /.test(l)).map((l) => l.replace(/^\s*- /, "").trim());
  const byTag = { "claude-1": 0, "claude-2": 0, "claude-3": 0 };
  for (const it of open) byTag[it.tag] = (byTag[it.tag] || 0) + 1;
  return { open, inFlight, byTag, parked: items(s.get("Parked (needs the owner)"), " ").length };
}

export function parseOwnerList(text) {
  const s = sections(text);
  const out = {};
  for (const [name, body] of s) {
    if (/^(How|The shape)/.test(name)) continue;
    out[name] = { open: items(body, " ").concat(items(body, " ")).slice(0, items(body, " ").length), done: items(body, "x").length };
  }
  return out;
}

const tableRows = (body) =>
  String(body || "").split("\n").filter((l) => /^\| /.test(l) && !/^\| ?-{2,}/.test(l)).slice(1)
    .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()));

export function parseAxioms(text) {
  const s = sections(text);
  const out = {};
  for (const status of ["operational", "explored", "proposed"]) {
    const rows = tableRows(s.get(status));
    out[status] = rows.map((r) => clean(r[0] || "").replace(/\s*\(.*$/, ""));
  }
  return out;
}

export function parseVisualRequests(text) {
  const s = sections(text);
  const out = {};
  for (const status of ["Requested", "Planned", "Drafted", "Designed", "Built"]) {
    out[status.toLowerCase()] = String(s.get(status) || "").split("\n")
      .filter((l) => /^### /.test(l)).map((l) => l.replace(/^### /, "").replace(/^\d+ · /, "").trim());
  }
  return out;
}

export function parsePermissions(text) {
  const s = sections(text);
  return { open: tableRows(s.get("Open")).map((r) => clean(r[0] || "")), granted: tableRows(s.get("Granted")).length };
}

// The register: every routine on every account, from docs/ROUTINES.md's
// tables. Absent on main until PRs #362/#365 merge — drawn as absent.
export function parseRegister(text) {
  if (!text) return null;
  const rows = [];
  let account = null;
  for (const block of String(text).split(/\n(?=## )/)) {
    const h = /^## \d+ · Session (\d)/.exec(block);
    if (h) account = `Claude ${h[1]}`;
    if (!account) continue;
    const lines = block.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (!/^\| (Routine|Lane) \| Trigger id \|/.test(lines[i])) continue;
      for (let j = i + 2; j < lines.length && /^\| /.test(lines[j]); j++) {
        const cells = lines[j].split("|").slice(1, -1).map((c) => c.trim());
        const cell = (c) => clean(c || "").replace(/`/g, "");
        const name = cell(cells[0]).replace(/^InSight /, "");
        if (!name) continue;
        rows.push({ account, name, trigger: cell(cells[1]), schedule: clean(cells[2] || "").replace(/^`([^`]*)`.*/, "$1").replace(/`/g, "") });
      }
    }
  }
  return rows;
}

// Unchecked [owner] steps in a runbook: `- [ ] **2.0 [owner] The custody decision.**`
export function ownerSteps(text, file) {
  const out = [];
  const re = /^\s*- \[ \] \*\*([\d.]+[a-z]?) \[owner\] ([^*]+?)\*\*/gm;
  let m;
  while ((m = re.exec(String(text || "")))) out.push({ id: m[1], title: m[2].trim().replace(/[.—-]\s*$/, ""), file });
  return out;
}

export function uncheckedSteps(text, file) {
  const out = [];
  const re = /^\s*- \[ \] \*\*([\d.]+[a-z]?) (?:\[owner\] )?([^*]+?)\*\*/gm;
  let m;
  while ((m = re.exec(String(text || "")))) out.push({ id: m[1], title: m[2].trim().replace(/[.—-]\s*$/, ""), file });
  return out;
}

// ── the theory branch ───────────────────────────────────────────────
export function theorySummary({ graphs = {}, digest = "", scores = "", verdicts = "", logs = {} } = {}) {
  const byStatus = { conjecture: 0, argued: 0, cited: 0, measured: 0 };
  const lanes = [];
  for (const [lane, g] of Object.entries(graphs)) {
    const nodes = g?.nodes || [];
    const counts = { conjecture: 0, argued: 0, cited: 0, measured: 0 };
    for (const n of nodes) if (n.status in counts) counts[n.status]++;
    for (const k of Object.keys(byStatus)) byStatus[k] += counts[k];
    const log = String(logs[lane] || "").split("\n").filter((l) => /^- \d{4}-\d{2}-\d{2}/.test(l));
    const last = log.length ? log[log.length - 1].slice(2, 12) : null;
    lanes.push({ lane, nodes: nodes.length, ...counts, lastLanded: last });
  }
  lanes.sort((a, b) => a.lane.localeCompare(b.lane));
  const hm = /## The headline\s*\n([\s\S]*?)(?:\n## |$)/.exec(digest || "");
  const headline = hm ? hm[1].trim().replace(/\s+/g, " ") : null;
  const dm = /\*Week of ([^)]*\))/.exec(digest || "");
  const table = (scores || "").split("\n").filter((l) => /^\|/.test(l));
  const count = (word) => ((verdicts || "").match(new RegExp(word, "g")) || []).length;
  return {
    lanes,
    byStatus,
    total: lanes.reduce((n, l) => n + l.nodes, 0),
    headline,
    digestWeek: dm ? dm[1] : null,
    scoresTable: table.length ? table : null,
    bridge: { worthBuilding: count("WORTH-BUILDING"), notYet: count("NOT-YET"), needsOwner: count("NEEDS-OWNER") },
  };
}

// ── run logs and roll calls ─────────────────────────────────────────
export const ROLL_CALL_RE = /^(Claude [123]) roll call (\d{4}-\d{2}-\d{2})/;

export function rollCalls(comments, today) {
  const out = { "Claude 1": null, "Claude 2": null, "Claude 3": null };
  for (const c of comments || []) {
    const first = String(c.body || "").split("\n")[0].trim();
    const m = ROLL_CALL_RE.exec(first);
    if (!m) continue;
    const prev = out[m[1]];
    if (!prev || m[2] > prev.day) out[m[1]] = { day: m[2], line: trunc(first, 160), at: c.created_at };
  }
  return Object.entries(out).map(([account, row]) => ({
    account,
    day: row?.day || null,
    line: row?.line || null,
    state: !row ? "no row ever" : row.day === today ? "today" : `last ${row.day}`,
  }));
}

// The last run-log line that names a lane. Attribution is by keyword in the
// comment's first line, which is exactly as good as the lanes' own naming
// discipline — every canonical prompt begins its report with the lane's
// name, and a lane that does not is drawn as never seen, which is the
// truthful reading.
export function lastSeen(comments, keyword) {
  const re = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  let best = null;
  for (const c of comments || []) {
    const first = String(c.body || "").split("\n")[0];
    if (!re.test(first)) continue;
    if (!best || c.created_at > best.created_at) best = { created_at: c.created_at, line: trunc(first.trim(), 140) };
  }
  return best;
}

// ── the owner list, folded ──────────────────────────────────────────
// Generated rows live inside a marked block at the end of a section; the
// owner's own rows above it are never touched, and a generated row the
// owner ticked disappears from the next fold (it is done).
const FOLD_BEGIN = "<!-- console:begin -->";
const FOLD_END = "<!-- console:end -->";

export function foldOwnerList(text, folds) {
  const parts = String(text || "").split(/^(?=## )/m);
  return parts.map((part) => {
    const m = /^## (.+?)\s*$/m.exec(part);
    if (!m || !(m[1].trim() in folds)) return part;
    const rows = folds[m[1].trim()];
    const body = part.replace(new RegExp(`\\n?${FOLD_BEGIN}[\\s\\S]*?${FOLD_END}\\n?`), "\n").replace(/\s+$/, "");
    if (!rows.length) return body + "\n\n";
    return `${body}\n\n${FOLD_BEGIN}\n${rows.map((r) => `- [ ] ${r}`).join("\n")}\n${FOLD_END}\n\n`;
  }).join("");
}

// Which generated rows are already said by hand (so the fold does not
// repeat the owner's own row): a hand row that contains the step id or the
// first four words of the title counts as the same item.
export function notAlreadyListed(handRows, candidates) {
  const hay = handRows.join("\n").toLowerCase();
  return candidates.filter((c) => {
    const id = c.id ? `${c.file} ${c.id}`.toLowerCase() : null;
    const head = c.title.toLowerCase().split(/\s+/).slice(0, 4).join(" ");
    return !(id && hay.includes(c.id.toLowerCase()) && hay.includes(c.file.toLowerCase().replace(/^docs\//, ""))) && !hay.includes(head);
  });
}

// ── the trail ───────────────────────────────────────────────────────
export const isoDay = (d = new Date()) => new Date(d).toISOString().slice(0, 10);

export function trailRow(state) {
  const rows = state.rows || [];
  const prs = rows.filter((r) => r.kind === "pr" && !r.selfMerge);
  const count = (stage) => prs.filter((r) => r.stage === stage).length;
  return {
    on: state.today,
    prsOpen: state.github.ok ? prs.length : null,
    prsNew: state.github.ok ? count("new") : null,
    prsInShift: state.github.ok ? count("shift") : null,
    prsReady: state.github.ok ? count("ready") : null,
    prsBlocked: state.github.ok ? count("blocked") : null,
    noPrYet: state.github.ok ? rows.filter((r) => r.kind === "branch").length : null,
    mergedWeek: state.github.ok ? (state.merged || []).length : null,
    worklist: state.worklist.byTag,
    inFlight: state.worklist.inFlight.length,
    ownerOpen: Object.values(state.owner).reduce((n, s) => n + s.open.length, 0),
    permissionsOpen: state.permissions.open.length,
    axioms: { operational: state.axioms.operational.length, explored: state.axioms.explored.length, proposed: state.axioms.proposed.length },
    visuals: Object.fromEntries(Object.entries(state.visuals).map(([k, v]) => [k, v.length])),
    theoryClaims: state.theory ? state.theory.byStatus : null,
    runwayDays: state.pulse?.runwayDays ?? null,
    mainCi: state.github.ok ? state.mainCi?.state ?? null : null,
  };
}

export function mergeTrail(prior, row) {
  const kept = (prior || []).filter((r) => r.on !== row.on);
  return [...kept, row].sort((a, b) => a.on.localeCompare(b.on));
}

// ── the console page ────────────────────────────────────────────────
export const ARTIFACT_LINE = /^\*\*Console artifact:\*\*/;

export function renderConsole(state, priorBody = "") {
  const L = [];
  const firstLine = String(priorBody || "").split("\n")[0];
  L.push(ARTIFACT_LINE.test(firstLine) ? firstLine : "**Console artifact:** *(the console keeper puts its link here)*");
  L.push(`<!-- console:generated ${state.generatedAt} -->`);
  L.push(ticksMarker((state.rows || []).filter(isTicked).map((r) => r.key)));
  L.push(`# InSight console — ${state.generatedAt.slice(0, 16).replace("T", " ")} UTC`);
  L.push("");
  L.push("_Regenerated every two hours by `console.yml` from the tree, GitHub and the theory branch (`docs/PROGRAM-RUNBOOK.md` § The console). Tick a box under **Approve** to approve a PR — it is mirrored to `docs/MERGE-LIST.md` within minutes. Every panel names its source; a source that did not report is drawn as absent, never as a number._");
  L.push("");

  // Today
  L.push("## Today — only you can do these · `docs/OWNER-LIST.md`");
  const owner = state.owner || {};
  const counts = Object.entries(owner).filter(([n]) => n !== "Done").map(([n, s]) => `${s.open.length} ${n.toLowerCase()}`);
  L.push(counts.length ? counts.join(" · ") : "*the owner list is not on main*");
  for (const [name, s] of Object.entries(owner)) {
    if (name === "Done" || !s.open.length) continue;
    L.push(`**${name}**`);
    for (const row of s.open.slice(0, 6)) L.push(`- ${trunc(row.replace(/\*Source:\*.*$/, "").trim(), 150)}`);
    if (s.open.length > 6) L.push(`- … and ${s.open.length - 6} more`);
  }
  L.push("");

  // Merge list
  L.push("## Merge list · `docs/MERGE-LIST.md`");
  if (!state.github.ok) {
    L.push(`*GitHub did not answer (${state.github.error}); the rows below are the previous render's.*`);
  }
  const rows = state.rows || [];
  const prs = rows.filter((r) => r.kind === "pr" && !r.selfMerge);
  const open = [...prs.filter((r) => r.stage === "new"), ...rows.filter((r) => r.kind === "branch")];
  L.push("### Approve");
  if (!open.length) L.push("*(nothing waiting for a tick)*");
  for (const r of open) L.push(rowLine(r));
  for (const [title, stage] of [["In the shift", "shift"], ["Ready — merge-when-green, the shepherd merges on green", "ready"], ["Could not be made green — your call", "blocked"]]) {
    const list = prs.filter((r) => r.stage === stage);
    L.push(`### ${title}`);
    if (!list.length) L.push("*(none)*");
    for (const r of list) L.push(rowLine(r, { box: false }));
  }
  L.push("### Merged this week");
  if (!(state.merged || []).length) L.push(state.github.ok ? "*(none)*" : "*(not reported)*");
  for (const m of state.merged || []) L.push(`- #${m.number} ${m.title} · ${fmtDay(m.merged_at)}`);
  const sm = rows.filter((r) => r.kind === "pr" && r.selfMerge);
  if (sm.length) L.push(`*Self-merging lanes in flight:* ${sm.map((r) => `#${r.number}`).join(", ")}`);
  L.push("");

  // To-do
  L.push("## To-do · `docs/WORKLIST.md`");
  const w = state.worklist;
  L.push("| Account | Open | In flight |");
  L.push("| --- | ---: | --- |");
  for (const acc of ["claude-1", "claude-2", "claude-3"]) {
    const fl = w.inFlight.filter((i) => i.toLowerCase().includes(acc));
    L.push(`| ${acc} | ${w.byTag[acc] || 0} | ${fl.length ? fl.map((i) => trunc(i, 80)).join("; ") : "—"} |`);
  }
  if (w.parked) L.push(`Parked, needing you: ${w.parked}`);
  L.push("");

  // Routine health
  L.push("## Routine health · `docs/ROUTINES.md` + the run logs");
  if (!state.register) {
    L.push("*The register is not on `main` yet (PRs #362 and #365) — every routine's schedule is drawn from it, so nothing is drawn until it lands.*");
  } else {
    L.push("| Routine | Account | Schedule (UTC) | Last seen |");
    L.push("| --- | --- | --- | --- |");
    for (const r of state.register) {
      const seen = state.lastSeen?.[r.name];
      L.push(`| ${r.name} | ${r.account} | \`${r.schedule || "?"}\` | ${seen ? `${fmtDay(seen.created_at)} — ${trunc(seen.line, 70)}` : "**never seen in a run log**"} |`);
    }
  }
  L.push("**Roll calls** (the Ops run log)");
  L.push("| Account | State | Last line |");
  L.push("| --- | --- | --- |");
  for (const rc of state.rollCalls || []) L.push(`| ${rc.account} | ${rc.state === "today" ? "today" : `**${rc.state}**`} | ${rc.line ? trunc(rc.line, 90) : "—"} |`);
  for (const [name, log] of Object.entries(state.runLogs || {})) {
    L.push(`- **${name}**: ${log ? `last comment ${fmtTime(log.created_at)} — ${trunc(log.line, 100)}` : "*not found or not readable*"}`);
  }
  L.push("");

  // Theory
  L.push("## Theory · `origin/axiom-theory`");
  const t = state.theory;
  if (!t) L.push("*The theory branch could not be read.*");
  else {
    const b = t.byStatus;
    L.push(`${t.total} claims — ${b.conjecture} conjecture · ${b.argued} argued · ${b.cited} cited · ${b.measured} measured. Bridge: ${t.bridge.worthBuilding} worth-building · ${t.bridge.notYet} not-yet · ${t.bridge.needsOwner} needs-owner.`);
    L.push("| Lane | Claims | cited | measured | Last landed |");
    L.push("| --- | ---: | ---: | ---: | --- |");
    for (const l of t.lanes) L.push(`| ${l.lane} | ${l.nodes} | ${l.cited} | ${l.measured} | ${l.lastLanded || "**no log row**"} |`);
    L.push(t.headline ? `**Digest${t.digestWeek ? ` (${t.digestWeek}` : ""}:** ${trunc(t.headline, 400)}` : "*No digest headline found.*");
    if (t.scoresTable) { L.push("**Scores (the review lane)**"); for (const row of t.scoresTable.slice(0, 16)) L.push(row); }
    else L.push("*No review scores yet.*");
  }
  L.push("");

  // Axiom board
  L.push("## Axiom board · `docs/AXIOMS.md`");
  const a = state.axioms;
  for (const s of ["operational", "explored", "proposed"]) L.push(`- **${s}** (${a[s].length}): ${a[s].join(" · ") || "—"}`);
  L.push("");

  // Visuals
  L.push("## Visual requests · `docs/VISUAL-REQUESTS.md`");
  const v = state.visuals;
  L.push(Object.entries(v).map(([k, list]) => `${k} ${list.length}`).join(" · "));
  for (const title of v.requested || []) L.push(`- requested: ${title}`);
  L.push("");

  // Production
  L.push("## Production · `monitoring/pulse-trail.jsonl`, the production reader");
  const p = state.pulse;
  if (!p) L.push("*No pulse trail row.*");
  else {
    L.push(`Trail row ${p.on}: deck runway **${p.runwayDays ?? "—"}** days · bank ${p.totalQuestions ?? "—"} (${p.dailyBank ?? "—"} daily) · unpromoted ${p.unpromoted ?? "—"} · functions alerted ${p.functionsAlerted ?? "—"}/${p.functionCount ?? "—"} · measured actives ${p.measuredActives ?? "not measured"} · net burn $${p.netBurnUsd ?? "—"} · scorecard age ${p.scorecardAgeDays ?? "—"} days`);
  }
  L.push(state.productionReader ? `Production reader: ${fmtTime(state.productionReader.created_at)} — ${trunc(state.productionReader.line, 120)}` : "*The production reader has not reported.*");
  L.push("");

  // Permissions
  L.push("## Permissions · `docs/PERMISSIONS.md`");
  L.push(state.permissions.open.length ? `${state.permissions.open.length} open: ${state.permissions.open.map((n) => trunc(n, 60)).join(" · ")}` : "*(none open)*");
  L.push("");

  // main
  L.push("## `main`");
  if (!state.github.ok) L.push("*(not reported)*");
  else {
    L.push(`CI on the head: **${checksWord(state.mainCi || { state: "none" })}**`);
    for (const c of state.merges || []) L.push(`- \`${c.sha.slice(0, 7)}\` ${trunc(c.subject, 110)} · ${fmtDay(c.date)}`);
  }
  L.push("");
  L.push(`_Sources that did not answer this run: ${(state.missing || []).length ? state.missing.join(", ") : "none"}._`);
  return L.join("\n");
}

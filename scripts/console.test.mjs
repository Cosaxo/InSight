// console.test.mjs — the pieces of the program console that can be wrong
// quietly (docs/PROGRAM-RUNBOOK.md § The console, D352).
//
// WHAT EARNS A TEST HERE. The page is mostly markup; what a wrong answer
// would LOOK right on is:
//
//   - the tick protocol — a stale render re-read as an approval would
//     label a PR the owner never approved, and a fresh label read as a
//     withdrawal would strip one they gave. Every branch of decideActions
//     is pinned, including "tick beats untick";
//   - the round trip — a rendered list must parse back to exactly the
//     ticks it drew, or the marker echoes itself on the next run;
//   - absence drawn as absence (D1): GitHub unreachable is null in the
//     trail and "not reported" on the page, never a zero;
//   - the parsers over the real seeded lists on this tree, so a format
//     drift in one of the six files fails here before the page goes wrong.
//
// Run: npm run test:scripts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  laneOfBranch, isNoPrBranch, whatHow, checksSummary, prRow, branchRow, parseTicks, ticksMarker,
  decideActions, isTicked, renderMergeList, parseWorklist, parseOwnerList, parseAxioms,
  parseVisualRequests, parsePermissions, parseRegister, ownerSteps, uncheckedSteps,
  theorySummary, rollCalls, lastSeen, foldOwnerList, notAlreadyListed, trailRow, mergeTrail,
  renderConsole, listProblem, LIST_SECTIONS,
} from "./console-lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const pr = (number, over = {}) => ({
  number, title: `PR ${number}`, html_url: `https://github.com/x/y/pull/${number}`, draft: false,
  head: { ref: over.branch || "claude/topic-abc123", sha: "deadbeef" }, user: { login: over.login || "Cosaxo" },
  labels: (over.labels || []).map((name) => ({ name })), created_at: "2026-09-02T11:00:00Z",
  body: over.body ?? "what: does a thing\nhow: by a mechanism",
});

describe("lanes by branch", () => {
  it("names the lane and whether it self-merges", () => {
    expect(laneOfBranch("claude/feed-questions-2026-09-02")).toEqual({ lane: "the feed lane", selfMerge: true });
    expect(laneOfBranch("claude/axes-retro-2026-09-01").lane).toBe("the axes retro lane");
    expect(laneOfBranch("claude/axes-1.1").lane).toBe("the axes build lane");
    expect(laneOfBranch("night-20260902").lane).toBe("Claude 2's night shift");
    expect(laneOfBranch("claude/whatever-x1y2z3")).toEqual({ lane: "a session", selfMerge: false });
  });
  it("knows which branches never get a PR of their own", () => {
    expect(isNoPrBranch("nightb-20260902")).toBe(true);
    expect(isNoPrBranch("claude/daily-database-optimization-j03rdh")).toBe(true);
    expect(isNoPrBranch("claude/axes-1.1")).toBe(false);
  });
});

describe("what / how", () => {
  it("reads the what: and how: lines a program prompt asks for, in any emphasis", () => {
    expect(whatHow("Intro\n\n*what:* a returning device paints its deck\n**how:** IndexedDB first\n")).toEqual({ what: "a returning device paints its deck", how: "IndexedDB first" });
  });
  it("falls back to the first two sentences of prose, skipping headings, tables, boxes and the footer", () => {
    const body = "## What changed, and why\n\n<!-- hidden -->\nThe warm boot paints from disk. Answers survive relaunch. Third sentence.\n\n## Checks\n\n- [x] lint\n| a | b |\n🤖 Generated with Claude\n";
    expect(whatHow(body)).toEqual({ what: "The warm boot paints from disk.", how: "Answers survive relaunch." });
  });
  it("is empty, not undefined, for an empty body", () => {
    expect(whatHow("")).toEqual({ what: "", how: "" });
  });
  it("strips HTML, and a dependabot row reads its title rather than its changelog", () => {
    expect(whatHow("<p>Fixes <b>the</b> thing.</p> <br> Second sentence.").what).toBe("Fixes the thing.");
    const row = prRow(pr(6, { branch: "dependabot/npm_and_yarn/x-1.2.3", login: "dependabot[bot]", body: "<details><summary>Release notes</summary>…</details>" }));
    expect(row.what).toBe("PR 6");
    expect(row.how).toContain("dependency shepherd");
  });
});

describe("checks", () => {
  const run = (status, conclusion) => ({ status, conclusion });
  it("is red on one failure, pending on one running, green when all concluded well, none when empty", () => {
    expect(checksSummary([run("completed", "success"), run("completed", "failure")]).state).toBe("red");
    expect(checksSummary([run("completed", "success"), run("in_progress", null)]).state).toBe("pending");
    expect(checksSummary([run("completed", "success"), run("completed", "skipped")]).state).toBe("green");
    expect(checksSummary([]).state).toBe("none");
  });
  it("does not read a cancelled run as red, and never grades main by the console's own run", () => {
    expect(checksSummary([run("completed", "success"), run("completed", "cancelled")]).state).toBe("green");
    expect(checksSummary([{ name: "console", status: "completed", conclusion: "failure" }]).state).toBe("none");
  });
});

describe("rows and stages", () => {
  it("stages a PR by its labels, and a blocked shift by the shift's comment", () => {
    expect(prRow(pr(1)).stage).toBe("new");
    expect(prRow(pr(2, { labels: ["approved"] })).stage).toBe("shift");
    expect(prRow(pr(3, { labels: ["approved", "merge-when-green"] })).stage).toBe("ready");
    expect(prRow(pr(4, { labels: ["approved"] }), { shiftBlocked: true }).stage).toBe("blocked");
  });
  it("marks self-merging lanes and dependabot", () => {
    expect(prRow(pr(5, { branch: "claude/now-questions-2026-09-02" })).selfMerge).toBe(true);
    expect(prRow(pr(6, { branch: "dependabot/npm_and_yarn/x-1.2.3", login: "dependabot[bot]" })).from).toBe("dependabot");
  });
  it("draws a branch as a no-PR-yet row", () => {
    expect(branchRow({ name: "night-20260903", aheadBy: 12, lastCommitAt: "2026-09-03T05:20:00Z" })).toMatchObject({ kind: "branch", key: "night-20260903", stage: "no PR yet", from: "Claude 2's night shift" });
  });
});

describe("the tick protocol", () => {
  const list = `# Merge list\n\n${ticksMarker(["#2", "#3"])}\n\n## Open\n\n- [x] **#1** · a session · *what:* a · *how:* b · stage **new**\n- [x] **#2** · a session · … · stage **in the shift**\n- [ ] **#3** · a session · … · stage **in the shift**\n- [ ] **#4** · a session · … · stage **in the shift**\n- [x] **night-20260903** (no PR yet) · Claude 2's night shift · 12 commits\n- [ ] **#7** · the now lane · …\n`;
  const rows = [
    prRow(pr(1)),                                            // new tick in the file → approve
    prRow(pr(2, { labels: ["approved"] })),                  // rendered ticked, still ticked → nothing
    prRow(pr(3, { labels: ["approved"] })),                  // rendered ticked, now unticked → withdraw
    prRow(pr(4, { labels: ["approved"] })),                  // labelled on GitHub, file not yet re-rendered → nothing
    branchRow({ name: "night-20260903", aheadBy: 12 }),      // new tick on a branch → open the PR
    prRow(pr(7, { branch: "claude/now-questions-2026-09-02" })), // self-merging: never
  ];
  it("parses ticks and the rendered marker", () => {
    const t = parseTicks(list);
    expect(t.now.get("#1")).toBe(true);
    expect(t.now.get("#3")).toBe(false);
    expect(t.now.get("night-20260903")).toBe(true);
    expect([...t.rendered]).toEqual(["#2", "#3"]);
  });
  it("turns the owner's edits since the last render into exactly these actions", () => {
    const actions = decideActions(rows, parseTicks(list), parseTicks(""));
    expect(actions).toEqual([
      { type: "label-add", key: "#1", number: 1, label: "approved" },
      { type: "label-remove", key: "#3", number: 3, label: "approved" },
      { type: "open-pr", key: "night-20260903", branch: "night-20260903", from: "Claude 2's night shift" },
    ]);
  });
  it("reads a new tick in the Console issue the same way, while a stale box there does not undo a withdrawal", () => {
    const rowsPlus = [...rows, prRow(pr(8))];
    // #8: ticked in the issue, never rendered ticked → a new tick. #3: the
    // file withdrew it and the issue's box is still ticked from the last
    // render (the marker lists it) → that box is stale, the withdrawal holds.
    const issue = `${ticksMarker(["#3"])}\n- [x] **#8** …\n- [x] **#3** …\n`;
    const actions = decideActions(rowsPlus, parseTicks(list), parseTicks(issue));
    expect(actions.find((a) => a.key === "#8")).toEqual({ type: "label-add", key: "#8", number: 8, label: "approved" });
    expect(actions.find((a) => a.key === "#3")).toEqual({ type: "label-remove", key: "#3", number: 3, label: "approved" });
  });
  it("lets a fresh tick beat an untick when the two surfaces disagree", () => {
    // The file withdrew #3 (rendered ticked, now unticked); the issue never
    // rendered #3 ticked and now shows it ticked — a NEW tick, which wins.
    const issue = `${ticksMarker([])}\n- [x] **#3** …\n`;
    const actions = decideActions(rows, parseTicks(list), parseTicks(issue));
    expect(actions.find((a) => a.key === "#3")).toBeUndefined();
  });
  it("never touches a merge-when-green PR, whatever the boxes say", () => {
    const ready = [prRow(pr(9, { labels: ["approved", "merge-when-green"] }))];
    expect(decideActions(ready, parseTicks(`${ticksMarker(["#9"])}\n- [ ] **#9** …`), parseTicks(""))).toEqual([]);
  });
  it("round-trips: a rendered list parses back to the ticks it drew", () => {
    const text = renderMergeList({ rows, merged: [], generatedAt: "2026-09-02T14:00:00Z" });
    const t = parseTicks(text);
    const drawn = rows.filter(isTicked).map((r) => r.key);
    expect([...t.rendered]).toEqual(drawn);
    for (const r of rows.filter((r) => r.kind === "pr" && !r.selfMerge)) expect(t.now.get(r.key)).toBe(isTicked(r));
    expect(decideActions(rows, t, parseTicks(""))).toEqual([]);
  });
});

describe("the merge list file", () => {
  it("places rows by stage, boxes only where a tick means something, and keeps the how-to", () => {
    const rows = [prRow(pr(1)), prRow(pr(2, { labels: ["approved"] })), prRow(pr(3, { labels: ["merge-when-green"] })),
      prRow(pr(6, { branch: "dependabot/npm_and_yarn/x-1.2.3", login: "dependabot[bot]" })), prRow(pr(7, { branch: "claude/feed-questions-2026-09-02" })),
      branchRow({ name: "nightb-20260903", aheadBy: 3 })];
    const text = renderMergeList({ rows, merged: [{ number: 5, title: "merged one", merged_at: "2026-09-01T10:00:00Z", merged_by: "Cosaxo" }], generatedAt: "2026-09-02T14:00:00Z" });
    expect(text).toContain("## How to approve");
    expect(text).toMatch(/## Open\n\n- \[ \] \*\*#1\*\*/);
    expect(text).toMatch(/## In the shift\n\n- \[x\] \*\*#2\*\*/);
    expect(text).toMatch(/## Ready\n\n- \[x\] \*\*#3\*\*/);
    expect(text).toContain("**Dependencies**");
    expect(text).toContain("**Self-merging:** #7");
    expect(text).toContain("- [ ] **nightb-20260903** (no PR yet)");
    expect(text).toContain("- **#5** · merged one · merged 2026-09-01 by Cosaxo");
    expect(text).not.toContain("GitHub did not answer");
  });
  it("says so on the page when GitHub did not answer", () => {
    expect(renderMergeList({ rows: [], generatedAt: "2026-09-02T14:00:00Z", githubState: "open PRs (403)" })).toContain("GitHub did not answer");
  });
});

describe("the lists on this tree", () => {
  it("reads the worklist by account tag", () => {
    const w = parseWorklist(read("docs/WORKLIST.md"));
    expect(w.open.length).toBeGreaterThan(0);
    expect(w.byTag["claude-2"] + w.byTag["claude-1"] + w.byTag["claude-3"]).toBe(w.open.length);
    expect(w.open.every((i) => /^claude-[123]$/.test(i.tag))).toBe(true);
  });
  it("defaults an untagged item to claude-2", () => {
    expect(parseWorklist("## Open\n\n- [ ] a thing\n- [ ] [claude-3] another\n").byTag).toEqual({ "claude-1": 0, "claude-2": 1, "claude-3": 1 });
  });
  it("reads the owner list's sections", () => {
    const o = parseOwnerList(read("docs/OWNER-LIST.md"));
    expect(Object.keys(o)).toEqual(expect.arrayContaining(["Decisions", "Clicks", "Designs", "Approvals", "Store and legal", "Done"]));
    expect(o.Decisions.open.length).toBeGreaterThan(0);
  });
  it("reads the axiom board with the owner's two operational axioms first", () => {
    const a = parseAxioms(read("docs/AXIOMS.md"));
    expect(a.operational.slice(0, 2)).toEqual(["Questions", "Tests"]);
    expect(a.explored).toEqual(["Genetic", "Body"]);
    expect(a.proposed.length).toBeGreaterThan(0);
  });
  it("reads visual requests by status and permissions by state", () => {
    const v = parseVisualRequests(read("docs/VISUAL-REQUESTS.md"));
    expect(v.requested.length).toBe(3);
    expect(v.built).toEqual([]);
    const p = parsePermissions(read("docs/PERMISSIONS.md"));
    expect(p.open.length).toBeGreaterThan(5);
  });
  it("finds the [owner] steps of the runbooks by id", () => {
    const ids = ownerSteps(read("docs/AXES-RUNBOOK.md"), "docs/AXES-RUNBOOK.md").map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(["2.0", "3.0", "4.0", "5.2"]));
    expect(uncheckedSteps(read("docs/LAUNCH-RUNBOOK.md"), "docs/LAUNCH-RUNBOOK.md").length).toBeGreaterThan(0);
  });
});

// ── a list file that is not there ───────────────────────────────────
//
// The page's own preamble promises "a source that did not report is
// drawn as absent, never as a number", and every list panel broke it:
// `read()` returned null for an absent file, `collect()` turned that
// into `""`, and an empty string parses to zero of everything. With all
// five gone the page printed "0 axioms", "requested 0 · planned 0",
// "(none open)" — and then, at the foot, "Sources that did not answer
// this run: none."
describe("a list the console could not read", () => {
  it("names an absent file rather than parsing it to nothing", () => {
    for (const file of Object.keys(LIST_SECTIONS)) expect(listProblem(file, null)).toBe(`${file} (not on main)`);
  });
  it("names a file with no sections at all", () => {
    expect(listProblem("docs/AXIOMS.md", "just some prose\n")).toMatch(/no `## ` sections/);
  });
  it("names EVERY heading a parser needs and cannot find", () => {
    // The half-open case: one heading renamed, the rest intact, so the
    // file still looks like itself while one panel silently empties.
    const drifted = read("docs/PERMISSIONS.md").replace(/^## Open$/m, "## Requests");
    expect(listProblem("docs/PERMISSIONS.md", drifted)).toBe("docs/PERMISSIONS.md (no `## Open` section)");
    expect(listProblem("docs/VISUAL-REQUESTS.md", "## Requested\n")).toBe("docs/VISUAL-REQUESTS.md (no `## Planned`, no `## Drafted`, no `## Designed`, no `## Built` section)");
  });
  it("passes every list file on this tree", () => {
    // The other half of the check above: it must be able to say yes, and
    // it is the only thing holding LIST_SECTIONS to the real headings.
    for (const file of Object.keys(LIST_SECTIONS)) expect(listProblem(file, read(file))).toBeNull();
  });
  it("hands a null through every parser instead of an empty parse", () => {
    for (const fn of [parseWorklist, parseOwnerList, parseAxioms, parseVisualRequests, parsePermissions]) expect(fn(null)).toBeNull();
  });
});

describe("the register", () => {
  const fixture = `# The routine register\n\n## 2 · Session 1 — the content lanes\n\n| Routine | Trigger id | Schedule (UTC) | Binding | Writes | Merge |\n| --- | --- | --- | --- | --- | --- |\n| InSight feed lane | \`trig_1\` | \`30 9 * * *\` — daily 09:30 | dev | x | self |\n\n## 3 · Session 2 — the axes program\n\n| Lane | Trigger id | Slot (UTC) | Dates |\n| --- | --- | --- | --- |\n| Genetic | \`trig_2\` | \`2 9 1-31/2 * *\` — 09:02 | odd |\n`;
  it("reads every table row under its session heading", () => {
    expect(parseRegister(fixture)).toEqual([
      { account: "Claude 1", name: "feed lane", trigger: "trig_1", schedule: "30 9 * * *" },
      { account: "Claude 2", name: "Genetic", trigger: "trig_2", schedule: "2 9 1-31/2 * *" },
    ]);
  });
  it("is null, not empty, when the file is not on main", () => {
    expect(parseRegister(null)).toBeNull();
  });
});

describe("the theory branch", () => {
  const graphs = { genetic: { nodes: [{ status: "cited" }, { status: "argued" }] }, body: { nodes: [{ status: "conjecture" }] } };
  const logs = { genetic: "# log\n\n- 2026-08-25 · seeded\n- 2026-09-01 · gen-14 added\n", body: "" };
  const digest = "# digest\n\n*Week of 2026-08-30 (UTC). Written 2026-09-01.*\n\n## The headline\n\nThe theory roughly\ndoubled.\n\n## What each\n";
  const verdicts = "- **… — WORTH-BUILDING**\n- **… — NOT-YET**\n- **… — WORTH-BUILDING**\n- **… — NEEDS-OWNER**";
  it("counts claims by rung, reads the last log row per lane, the headline and the bridge queue", () => {
    const t = theorySummary({ graphs, logs, digest, verdicts, scores: "No review yet." });
    expect(t.byStatus).toEqual({ conjecture: 1, argued: 1, cited: 1, measured: 0 });
    expect(t.lanes.find((l) => l.lane === "genetic").lastLanded).toBe("2026-09-01");
    expect(t.lanes.find((l) => l.lane === "body").lastLanded).toBeNull();
    expect(t.headline).toBe("The theory roughly doubled.");
    expect(t.digestWeek).toBe("2026-08-30 (UTC)");
    expect(t.bridge).toEqual({ worthBuilding: 2, notYet: 1, needsOwner: 1 });
    expect(t.scoresTable).toBeNull();
  });
});

describe("roll calls and run logs", () => {
  const comments = [
    { body: "Claude 2 roll call 2026-09-01\ndue 9…", created_at: "2026-09-01T15:30:00Z" },
    { body: "Claude 2 roll call 2026-09-02\ndue 9…", created_at: "2026-09-02T15:30:00Z" },
    { body: "Claude 1 roll call 2026-08-31\n…", created_at: "2026-08-31T15:35:00Z" },
    { body: "production reader 2026-09-02: alerts 9/9", created_at: "2026-09-02T06:40:00Z" },
  ];
  it("draws today, a stale row and no row ever as three different states", () => {
    expect(rollCalls(comments, "2026-09-02").map((r) => [r.account, r.state])).toEqual([
      ["Claude 1", "last 2026-08-31"], ["Claude 2", "today"], ["Claude 3", "no row ever"],
    ]);
  });
  it("attributes the last line by keyword and picks the latest", () => {
    expect(lastSeen(comments, "roll call").created_at).toBe("2026-09-02T15:30:00Z");
    expect(lastSeen(comments, "production reader").line).toContain("alerts 9/9");
    expect(lastSeen(comments, "merge shift")).toBeNull();
  });
});

describe("the owner list fold", () => {
  const text = "# Owner list\n\nintro\n\n## Decisions\n\n- [ ] **Hand row** — *Source:* x.\n\n## Clicks\n\n- [ ] click\n\n## Done\n";
  it("adds a generated block, replaces it on the next fold, and removes it when empty", () => {
    const once = foldOwnerList(text, { Decisions: ["**Gen one** — *Source:* a.", "**Gen two** — *Source:* b."] });
    expect(once).toContain("<!-- console:begin -->\n- [ ] **Gen one**");
    expect(once).toContain("## Clicks\n\n- [ ] click");
    const twice = foldOwnerList(once, { Decisions: ["**Gen three** — *Source:* c."] });
    expect(twice).not.toContain("Gen one");
    expect(twice).toContain("Gen three");
    expect((twice.match(/console:begin/g) || []).length).toBe(1);
    const none = foldOwnerList(twice, { Decisions: [] });
    expect(none).not.toContain("console:begin");
    expect(none).toContain("- [ ] **Hand row**");
  });
  // THE CONSOLE DELETED THE OWNER'S BLOCK ON EVERY OTHER RUN, and the case
  // above could not see it: it folds three times but never re-parses its
  // own output in between, which is precisely the loop that bites.
  //
  // `hand` was built from the whole section, so it included the fold's own
  // last output; every generated row then counted as already-listed, the
  // fold produced nothing, and the block was replaced with emptiness. The
  // next run saw a file without them and put them all back. On the real
  // OWNER-LIST.md that measured 22, 0, 22, 0 — and every console commit on
  // main alternates the same way.
  //
  // So this is the loop, closed: parse, fold, parse the RESULT, fold again.
  it("keeps folding the same rows when it re-reads its own output", () => {
    const candidates = [
      { id: "0.3", title: "Put the protection rules on production", file: "docs/LAUNCH-RUNBOOK.md" },
      { id: "0.4", title: "Answer the store privacy form", file: "docs/LAUNCH-RUNBOOK.md" },
    ];
    let doc = text;
    const counts = [];
    for (let run = 0; run < 4; run++) {
      const owner = parseOwnerList(doc);
      const hand = Object.values(owner).flatMap((sec) => sec.hand || []);
      const rows = notAlreadyListed(hand, candidates)
        .map((c) => `**${c.id} ${c.title}** — *Source:* \`${c.file}\`.`);
      counts.push(rows.length);
      doc = foldOwnerList(doc, { Decisions: rows });
    }
    expect(counts, "the fold emptied its own block and refilled it").toEqual([2, 2, 2, 2]);
    expect(doc).toContain("Put the protection rules on production");
    // The owner's own row is never swept up by any of it.
    expect(doc).toContain("- [ ] **Hand row**");
  });

  it("still counts a row the owner ticked inside the block as theirs", () => {
    // The other direction, and the reason `hand` is not simply "everything
    // outside the markers": ticking is the owner's act wherever the row
    // lives, and a ticked generated row must stay filtered out rather than
    // being regenerated unticked two hours later.
    const folded = foldOwnerList(text, { Decisions: ["**2.0 The custody decision** — *Source:* `docs/AXES-RUNBOOK.md`."] });
    const ticked = folded.replace("- [ ] **2.0 The custody", "- [x] **2.0 The custody");
    const hand = Object.values(parseOwnerList(ticked)).flatMap((sec) => sec.hand || []);
    expect(hand.join("\n")).toContain("2.0 The custody decision");
    expect(notAlreadyListed(hand, [{ id: "2.0", title: "The custody decision", file: "docs/AXES-RUNBOOK.md" }]))
      .toEqual([]);
  });

  it("does not repeat a row the owner already wrote by hand", () => {
    const hand = ["**The consented tier's custody decision** — consented tier versus … *Source:* `AXES-RUNBOOK.md` 2.0."];
    const kept = notAlreadyListed(hand, [
      { id: "2.0", title: "The custody decision", file: "docs/AXES-RUNBOOK.md" },
      { id: "3.0", title: "The D168 carve-out for the genetic axis", file: "docs/AXES-RUNBOOK.md" },
    ]);
    expect(kept.map((c) => c.id)).toEqual(["3.0"]);
  });
});

describe("the trail and the page", () => {
  const base = () => ({
    generatedAt: "2026-09-02T14:00:00Z", today: "2026-09-02", github: { ok: false, error: "open PRs (403)" }, rows: [], merged: [],
    worklist: { byTag: { "claude-1": 0, "claude-2": 5, "claude-3": 1 }, inFlight: [], parked: 0, open: [] },
    owner: { Decisions: { open: ["a decision"], done: 0 }, Done: { open: [], done: 0 } }, axioms: { operational: ["Questions"], explored: [], proposed: [] },
    visuals: { requested: ["x"], planned: [], drafted: [], designed: [], built: [] }, permissions: { open: ["p"], granted: 0 },
    register: null, lastSeen: {}, theory: null, pulse: null, rollCalls: rollCalls([], "2026-09-02"), runLogs: {}, productionReader: null,
    mainCi: null, merges: [], missing: ["open PRs (403)"],
  });
  it("records absence as null, never as zero, when GitHub did not answer", () => {
    const row = trailRow(base());
    expect(row.prsOpen).toBeNull();
    expect(row.mainCi).toBeNull();
    expect(row.worklist["claude-2"]).toBe(5);
  });
  it("replaces the same day's row and keeps the order", () => {
    const rows = mergeTrail([{ on: "2026-09-01", a: 1 }, { on: "2026-09-02", a: 1 }], { on: "2026-09-02", a: 2 });
    expect(rows).toEqual([{ on: "2026-09-01", a: 1 }, { on: "2026-09-02", a: 2 }]);
  });
  it("draws every missing source as absent and keeps the keeper's artifact line", () => {
    const page = renderConsole(base(), "**Console artifact:** https://claude.ai/artifacts/abc\nold body");
    expect(page.startsWith("**Console artifact:** https://claude.ai/artifacts/abc")).toBe(true);
    expect(page).toContain(ticksMarker([]));
    expect(page).toContain("GitHub did not answer");
    expect(page).toContain("not on `main` yet");
    expect(page).toContain("| Claude 3 | **no row ever** |");
    expect(page).toContain("*(not reported)*");
    expect(page).toContain("Sources that did not answer this run: open PRs (403)");
  });
  it("draws an unreadable list as absent and puts no count in the trail", () => {
    const s = base();
    s.worklist = null; s.owner = null; s.axioms = null; s.visuals = null; s.permissions = null;
    s.missing = ["docs/AXIOMS.md (not on main)"];
    const row = trailRow(s);
    for (const k of ["worklist", "inFlight", "ownerOpen", "permissionsOpen", "axioms", "visuals"]) expect(row[k], k).toBeNull();
    const page = renderConsole(s, "");
    // Five panels, each pointing at the foot — and none of them a zero.
    for (const file of Object.keys(LIST_SECTIONS)) expect(page).toContain(`\`${file}\` could not be read this run`);
    expect(page).not.toContain("(none open)");
    expect(page).not.toContain("requested 0");
    expect(page).toContain("Sources that did not answer this run: docs/AXIOMS.md (not on main)");
  });
  it("still draws the counts when the lists are there", () => {
    const page = renderConsole(base(), "");
    expect(page).not.toContain("could not be read this run");
    expect(page).toContain("| claude-2 | 5 |");
    expect(page).toContain("1 open: p");
    expect(page).toContain("requested 1");
  });
  it("lists the ticked rows in the page's marker", () => {
    const s = base();
    s.github = { ok: true, error: null };
    s.rows = [prRow(pr(1, { labels: ["approved"] })), prRow(pr(2))];
    const page = renderConsole(s, "");
    expect(page).toContain(ticksMarker(["#1"]));
    expect(page).toMatch(/### Approve\n- \[ \] \*\*#2\*\*/);
    expect(page).toMatch(/### In the shift\n- \*\*#1\*\*/);
  });
});

// ── a tick that does not land ───────────────────────────────────────
//
// THE OWNER'S APPROVAL EXISTS AS A CHECKBOX IN A FILE A SCRIPT REWRITES,
// and the rewrite draws each box from that row's LABELS. So when the
// label-add failed, `act` caught it, logged, and carried on; the list was
// rewritten with the row UNTICKED; the ticks marker stopped listing it;
// and the next run saw neither a new tick (the box is empty now) nor a
// withdrawal (the marker never had it). The approval was gone from the
// file and from the Console issue, with no trace on either, and the run
// was green.
//
// The workflow comment said "the merge list is only rewritten when GitHub
// answered" — true of a rejected PUSH, and not of a rejected ACTION.
describe("act, when GitHub refuses", () => {
  const row = (key, number) => ({ kind: "pr", key, number, labels: [], selfMerge: false });

  it("reports what did not land instead of swallowing it", async () => {
    const { act } = await import("./console.mjs");
    const state = { rows: [row("pr:12", 12)], branches: [] };
    // The label lookup answers; only the write refuses. That is the real
    // shape — a read-only token, or a rate limit on the write — and it is
    // the one that used to be swallowed. (A refusal on the lookup itself
    // rethrows out of `act` and takes the whole run red, which is also
    // correct and is not this case.)
    const refuse = async (path, opts) => {
      if (!opts) return {};
      const e = new Error("Resource not accessible by integration"); e.status = 403; throw e;
    };
    const failed = await act(state, [{ type: "label-add", key: "pr:12", number: 12, label: "approved" }], () => {}, refuse);
    expect(failed).toHaveLength(1);
    expect(failed[0].key).toBe("pr:12");
    expect(failed[0].error).toMatch(/not accessible/);
    // …and it did NOT pretend the label is on the row, which would draw a
    // tick the labels do not have and mark it done for the next run.
    expect(state.rows[0].labels).toEqual([]);
  });

  it("says nothing failed when the call goes through — the control", async () => {
    const { act } = await import("./console.mjs");
    const state = { rows: [row("pr:12", 12)], branches: [] };
    const ok = async () => ({});
    const failed = await act(state, [{ type: "label-add", key: "pr:12", number: 12, label: "approved" }], () => {}, ok);
    expect(failed).toEqual([]);
    // the row carries the label now, so the re-render draws the tick
    expect(state.rows[0].labels).toEqual(["approved"]);
  });
});

// ── the second door onto the same loss ──────────────────────────────
//
// A failed action is one way an owner's tick goes unmirrored. A run that
// never TRIED is the other: without --refresh or without a token the
// console computes the actions, logs them as pending, and used to rewrite
// the list anyway — drawing the row unticked and dropping it from the
// marker, so the next run saw neither a new tick nor a withdrawal.
//
// `console.yml`'s push-retry rides exactly that door: on a rejected push
// it resets to main, picking up any tick pushed meanwhile, and re-runs the
// console WITHOUT --refresh. Reproduced with the real parser and renderer:
// box ticked on disk, one action pending, row draws unticked, and after a
// rewrite the next run's action list is empty.
describe("when the list must be left alone", () => {
  const A = [{ type: "label-add", key: "#1" }];

  it("holds it when an action failed", async () => {
    const { holdsTheList } = await import("./console.mjs");
    expect(holdsTheList({ failed: A, actions: A, canApply: true })).toBe(true);
  });

  it("holds it when the run could not even try — the door that stayed open", async () => {
    const { holdsTheList } = await import("./console.mjs");
    expect(holdsTheList({ failed: [], actions: A, canApply: false })).toBe(true);
  });

  it("writes it when everything landed, and when there was nothing to do", async () => {
    // The control. Every case above asserts TRUE, so a predicate that
    // always held the list would satisfy them — and would freeze the
    // merge list forever, which is a different way to lose the owner.
    const { holdsTheList } = await import("./console.mjs");
    expect(holdsTheList({ failed: [], actions: A, canApply: true })).toBe(false);
    expect(holdsTheList({ failed: [], actions: [], canApply: false })).toBe(false);
  });

  // A THIRD DOOR, AND THE ONE THE GUARD ABOVE CANNOT SEE. `holdsTheList`
  // is anchored to a row: a tick produces an action, and a failed action
  // holds the list. But the branch rows come from two reads BELOW the one
  // that sets `ok` — the branch listing, and a compare per branch — and
  // both were swallowed and fell back to nothing. `ok` stayed true, the
  // rows were short, and the list was rewritten without them. No row, no
  // action, nothing for the guard to catch: the owner's tick on a
  // `night-*` branch gone on a green run, exit 0.
  //
  // `PROGRAM-RUNBOOK.md` says ticks are "preserved by PR number and branch
  // name". They are preserved by LABEL, and a branch row has no label.
  it("refuses to rewrite the list when the branch rows are short", async () => {
    const { listIsWritable } = await import("./console.mjs");
    expect(listIsWritable({ ok: true, rowsComplete: false }),
      "a short row set must not be written over the owner's ticks").toBe(false);
    expect(listIsWritable({ ok: false, rowsComplete: true })).toBe(false);
  });

  it("still writes it when the rows are all there — the control", async () => {
    // Without this, "never writable" passes the case above and freezes the
    // merge list, which is the same loss pointed the other way.
    const { listIsWritable } = await import("./console.mjs");
    expect(listIsWritable({ ok: true, rowsComplete: true })).toBe(true);
    // Absent rather than false: a caller that predates the flag must not
    // be read as reporting a gap.
    expect(listIsWritable({ ok: true })).toBe(true);
  });

  it("marks the row set short at both reads that can drop a row", () => {
    // The predicate is only worth having if something sets the flag. Two
    // sites do — the branch listing and the per-branch compare — and each
    // is a different failure: one loses every branch row, the other loses
    // one. A source scan because `readGithub` needs a token to run.
    const src = read("scripts/console.mjs");
    const sites = [...src.matchAll(/rowsComplete = false/g)];
    expect(sites.length, "a read that can drop a branch row stopped reporting it").toBe(2);
    // …and the compare's own two answers stay distinguished: a failed
    // compare is not the same as a branch that is not ahead.
    expect(src).toContain("if (cmp === null) { g.rowsComplete = false; continue; }");
    expect(src).toContain("if (!cmp.ahead_by) continue;");
  });
});

// ── the console must not un-tick the owner ──────────────────────────
//
// The fold filters its candidates against what the owner has already said
// BY HAND, and that haystack was built from the OPEN rows only. So a
// generated row the owner TICKED was invisible to the filter: it was
// regenerated as `- [ ]`, and since the fold replaces the whole marked
// block, the `[x]` was overwritten. The owner ticked a decision and the
// console un-ticked it on its next run, within two hours, with no trace.
//
// `foldOwnerList`'s own comment promised the opposite — "a generated row
// the owner ticked disappears from the next fold (it is done)" — and
// PROGRAM-PLAN's contract is "the owner ticks, and a ticked row names what
// it unblocked".
describe("the owner list's fold, against the owner's own ticks", () => {
  const cand = [{ file: "docs/AXES-RUNBOOK.md", id: "2.0", title: "The custody decision" }];
  const hand = (text) => Object.values(parseOwnerList(text))
    .flatMap((s) => [...s.open, ...(s.doneRows || [])]);

  it("does not regenerate a row the owner ticked in place", () => {
    const ticked = "## Decisions\n\n<!-- console:begin -->\n"
      + "- [x] **The custody decision** — *Source:* `docs/AXES-RUNBOOK.md` 2.0.\n"
      + "<!-- console:end -->\n";
    expect(notAlreadyListed(hand(ticked), cand)).toEqual([]);
  });

  it("…nor one the owner moved to Done, which is what the list says to do", () => {
    const moved = "## Decisions\n\n<!-- console:begin -->\n<!-- console:end -->\n\n## Done\n\n"
      + "- [x] **The custody decision** — *Source:* `docs/AXES-RUNBOOK.md` 2.0.\n";
    expect(notAlreadyListed(hand(moved), cand)).toEqual([]);
  });

  it("still folds in a decision nobody has said yet — the control", () => {
    // Both cases above assert an EMPTY result, which a filter that dropped
    // everything would satisfy while silently emptying the owner's list.
    const empty = "## Decisions\n\n<!-- console:begin -->\n<!-- console:end -->\n";
    expect(notAlreadyListed(hand(empty), cand).map((c) => c.title)).toEqual(["The custody decision"]);
  });
});

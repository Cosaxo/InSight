// routines.test.mjs — the recreation kit's rules, each pinned by the way
// it could be wrong quietly (docs/RECREATE.md, routines/manifest.json,
// docs/PROGRAM-RUNBOOK.md phase 3).
//
// WHAT EARNS A TEST HERE. A manifest is a list of claims about state
// nobody in the repository can see — a Routine on another account — so
// the only things that can be checked are internal: that the prompt a
// session would paste is the block the contract names with nothing left
// in angle brackets that should have been an account, that an inventory
// table and the manifest name the same ids, and that the page is what
// the manifest renders. Each of those is a way a session could recreate
// a Routine WRONG while every gate stayed green, which is the failure
// this repo keeps writing down (D39, D179, D197).

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACCOUNTS,
  checkRoutines,
  extractBlock,
  inventoryIds,
  knownIds,
  parseManifest,
  pasteLine,
  plan,
  renderRecreate,
  resolvePrompt,
  substitute,
} from "./routines-lib.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const readTree = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : null);

const RUNBOOK = [
  "# A runbook",
  "",
  "The doer:",
  "",
  "```",
  "You are InSight's DOER on <ACCOUNT> — a job. Take items tagged [<account-tag>]; push OPS-DIAG.md on claude/ops-diag-<YYYY-MM-DD>.",
  "Second line stays.",
  "```",
  "",
  "The reader:",
  "",
  "```",
  "You are InSight's READER — a job.",
  "```",
  "",
  "An unrelated fence:",
  "",
  "```js",
  "console.log(1)",
  "```",
].join("\n");

function routine(over = {}) {
  return {
    id: "doer-claude-3",
    name: "InSight doer (Claude 3)",
    account: "claude-3",
    group: "ops",
    schedule: "0 18 * * *",
    model: "claude-fable-5-1",
    binding: { kind: "relay", session: "session_01AAAAAAAAAAAAAAAAAAAAAA" },
    notifications: "off",
    prompt: { file: "docs/RB.md", opens: "You are InSight's DOER on <ACCOUNT>", substitute: { "<ACCOUNT>": "Claude 3", "<account-tag>": "claude-3" } },
    contract: "docs/RB.md § The doer",
    reports: "Ops run log",
    branches: ["claude/worklist-<slug>"],
    trigger: "trig_01BBBBBBBBBBBBBBBBBBBBBB",
    state: "live",
    created: "2026-09-03",
    source: "docs/RB.md § inventory",
    ...over,
  };
}

function manifest(routines) {
  return JSON.stringify({ version: 1, updated: "2026-09-03", routines });
}

const files = { "docs/RB.md": RUNBOOK };
const readFixture = (p) => files[p] ?? null;

describe("the manifest's shape", () => {
  it("accepts a well-formed routine", () => {
    const { manifest: m, problems } = parseManifest(manifest([routine()]));
    expect(problems).toEqual([]);
    expect(m.routines).toHaveLength(1);
  });

  it("names each way a row can be wrong", () => {
    const rows = [
      routine(),
      routine({ id: "doer-claude-3" }), // duplicate id
      routine({ id: "bad", schedule: "0 18 * *" }), // four fields
      routine({ id: "live-no-id", trigger: null }), // live without an id
      routine({ id: "not-yet-with-id", state: "not yet" }), // not yet with an id
      routine({ id: "no-session", binding: { kind: "dispatcher" } }), // live dispatcher without a session
      routine({ id: "odd-account", account: "claude-4" }),
      routine({ id: "no-opens", prompt: { file: "docs/RB.md" } }),
    ];
    const { problems } = parseManifest(manifest(rows));
    expect(problems.join("\n")).toMatch(/duplicate id/);
    expect(problems.join("\n")).toMatch(/5-field cron/);
    expect(problems.join("\n")).toMatch(/live without a trigger id/);
    expect(problems.join("\n")).toMatch(/"not yet" with a trigger id/);
    expect(problems.join("\n")).toMatch(/dispatcher binding names the session/);
    expect(problems.join("\n")).toMatch(/claude-4/);
    expect(problems.join("\n")).toMatch(/names the line its block opens with/);
  });

  it("lets a 'not yet' relay lane stand without a session, and an API lane without a schedule", () => {
    const rows = [
      routine({ id: "later", name: "Later", state: "not yet", trigger: null, binding: { kind: "dispatcher", label: "a dispatcher to come" }, schedule: null }),
      routine({ id: "poke", name: "Poke", binding: { kind: "api" }, schedule: null, trigger: "trig_01CCCCCCCCCCCCCCCCCCCCCC" }),
    ];
    expect(parseManifest(manifest(rows)).problems).toEqual([]);
  });

  it("refuses a retired id that is also live, and counts both as known", () => {
    const rows = [routine(), routine({ id: "other", trigger: "trig_01CCCCCCCCCCCCCCCCCCCCCC", retired: ["trig_01BBBBBBBBBBBBBBBBBBBBBB"] })];
    expect(parseManifest(manifest(rows)).problems.join("\n")).toMatch(/also live/);
    const { manifest: m } = parseManifest(manifest([routine({ retired: ["trig_01DDDDDDDDDDDDDDDDDDDDDD"] })]));
    expect([...knownIds(m)]).toEqual(["trig_01BBBBBBBBBBBBBBBBBBBBBB", "trig_01DDDDDDDDDDDDDDDDDDDDDD"]);
  });

  it("does not parse a manifest that is not JSON, and says so", () => {
    expect(parseManifest("{").problems[0]).toMatch(/does not parse/);
    expect(parseManifest("[]").problems[0]).toMatch(/top level/);
  });
});

describe("prompts", () => {
  it("takes the fenced block whose first line opens with the text, and only that one", () => {
    expect(extractBlock(RUNBOOK, "You are InSight's READER")).toBe("You are InSight's READER — a job.");
    expect(extractBlock(RUNBOOK, "You are InSight's DOER on <ACCOUNT>")).toMatch(/^You are InSight's DOER on <ACCOUNT>.*\nSecond line stays\.$/s);
    expect(extractBlock(RUNBOOK, "You are InSight's NOBODY")).toBeNull();
  });

  it("an unclosed fence is not a block", () => {
    expect(extractBlock("```\nYou are InSight's X\nno close", "You are InSight's X")).toBeNull();
  });

  it("substitutes the account placeholders and leaves the prompt's own patterns alone", () => {
    const r = resolvePrompt(routine(), readFixture);
    expect(r.status).toBe("verbatim");
    expect(r.text).toContain("DOER on Claude 3");
    expect(r.text).toContain("[claude-3]");
    expect(r.text).toContain("<YYYY-MM-DD>");
    expect(r.text).not.toContain("<ACCOUNT>");
  });

  it("a placeholder the manifest forgot to substitute is a problem, not a prompt", () => {
    const r = resolvePrompt(routine({ prompt: { file: "docs/RB.md", opens: "You are InSight's DOER on <ACCOUNT>", substitute: { "<ACCOUNT>": "Claude 3" } } }), readFixture);
    expect(r.status).toBe("missing");
    expect(r.problem).toMatch(/<account-tag> left unsubstituted/);
  });

  it("names a missing file and a missing block", () => {
    expect(resolvePrompt(routine({ prompt: { file: "docs/NOPE.md", opens: "x" } }), readFixture).problem).toMatch(/not in the tree/);
    expect(resolvePrompt(routine({ prompt: { file: "docs/RB.md", opens: "You are InSight's NOBODY" } }), readFixture).problem).toMatch(/no fenced block/);
  });

  it("a block on another branch and a prompt never written down are statuses, not problems", () => {
    expect(resolvePrompt(routine({ prompt: { branch: "axiom-theory", file: "prompts/x.md" } }), readFixture).status).toBe("other-branch");
    const n = resolvePrompt(routine({ prompt: { note: "the owner's" } }), readFixture);
    expect(n.status).toBe("not-in-repo");
    expect(n.note).toBe("the owner's");
  });

  it("substitute replaces every occurrence", () => {
    expect(substitute("a <X> b <X>", { "<X>": "y" })).toBe("a y b y");
  });
});

describe("inventories", () => {
  it("reads ids from table rows only — prose is history, a row is a claim", () => {
    const md = [
      "Retired: trig_01OLDOLDOLDOLDOLDOLDOLD1 was replaced.",
      "| Routine | Trigger id |",
      "| --- | --- |",
      "| A | `trig_01NEWNEWNEWNEWNEWNEWNEW1` |",
      "| B | `trig_01NEWNEWNEWNEWNEWNEWNEW2` (was `trig_01OLDOLDOLDOLDOLDOLDOLD2`) |",
    ].join("\n");
    expect(inventoryIds(md, "docs/X.md").map((r) => `${r.id}@${r.line}`)).toEqual([
      "trig_01NEWNEWNEWNEWNEWNEWNEW1@4",
      "trig_01NEWNEWNEWNEWNEWNEWNEW2@5",
      "trig_01OLDOLDOLDOLDOLDOLDOLD2@5",
    ]);
  });
});

describe("the gate", () => {
  const good = () => ({
    manifestText: manifest([routine()]),
    readFile: readFixture,
    inventories: { "docs/RB.md": "| A | `trig_01BBBBBBBBBBBBBBBBBBBBBB` |" },
  });

  it("is green on a manifest whose ids and blocks all resolve", () => {
    expect(checkRoutines(good())).toEqual([]);
  });

  it("an inventory id the manifest does not know is a problem naming the file and line", () => {
    const f = good();
    f.inventories["docs/OTHER.md"] = "text\n| X | `trig_01ZZZZZZZZZZZZZZZZZZZZZZ` |";
    expect(checkRoutines(f)).toEqual([expect.stringMatching(/docs\/OTHER.md:2 names trig_01ZZZZZZZZZZZZZZZZZZZZZZ/)]);
  });

  it("a retired id an inventory still carries is fine", () => {
    const f = good();
    f.manifestText = manifest([routine({ retired: ["trig_01ZZZZZZZZZZZZZZZZZZZZZZ"] })]);
    f.inventories["docs/OTHER.md"] = "| X | `trig_01ZZZZZZZZZZZZZZZZZZZZZZ` |";
    expect(checkRoutines(f)).toEqual([]);
  });

  it("a stale page is a problem; the rendered page is not", () => {
    const f = good();
    const { manifest: m } = parseManifest(f.manifestText);
    f.recreateText = renderRecreate(m, readFixture);
    expect(checkRoutines(f)).toEqual([]);
    f.recreateText += "\nedited by hand";
    expect(checkRoutines(f)).toEqual([expect.stringMatching(/RECREATE.md is not what the manifest renders/)]);
  });

  it("stops at the manifest's own problems before reading anything else", () => {
    expect(checkRoutines({ manifestText: "{", readFile: readFixture, inventories: {} })).toEqual([expect.stringMatching(/does not parse/)]);
  });
});

describe("the plan", () => {
  const rows = [
    routine(),
    routine({ id: "fresh-one", name: "Fresh", binding: { kind: "fresh" }, notifications: "on", state: "not yet", trigger: null, prompt: { file: "docs/RB.md", opens: "You are InSight's READER" } }),
    routine({ id: "poke", name: "Poke", binding: { kind: "api" }, schedule: null, trigger: "trig_01CCCCCCCCCCCCCCCCCCCCCC", prompt: { note: "elsewhere" } }),
    routine({ id: "elsewhere", name: "Other account", account: "claude-1", trigger: "trig_01EEEEEEEEEEEEEEEEEEEEEE" }),
  ];
  const { manifest: m } = parseManifest(manifest(rows));

  it("prints create_trigger arguments shaped by the binding", () => {
    const p = plan(m, "claude-3", readFixture);
    expect(p.map((x) => x.id)).toEqual(["doer-claude-3", "fresh-one", "poke"]);
    expect(p[0].create_trigger).toEqual({
      name: "InSight doer (Claude 3)",
      cron_expression: "0 18 * * *",
      prompt: expect.stringContaining("DOER on Claude 3"),
      persistent_session_id: "session_01AAAAAAAAAAAAAAAAAAAAAA",
    });
    expect(p[1].create_trigger).toEqual({
      name: "Fresh",
      cron_expression: "0 18 * * *",
      prompt: "You are InSight's READER — a job.",
      create_new_session_on_fire: true,
      notifications: { push: true, email: true },
    });
    expect(p[2].create_trigger).toEqual({ name: "Poke" }); // poke-only: no cron, no prompt in the tree
    expect(p[2].prompt_status).toBe("not-in-repo");
    expect(p[2].web_ui.schedule).toBe("none — fired by URL");
  });

  it("--missing keeps only what is not live", () => {
    expect(plan(m, "claude-3", readFixture, { missing: true }).map((x) => x.id)).toEqual(["fresh-one"]);
  });

  it("refuses an account it does not know", () => {
    expect(() => plan(m, "claude-9", readFixture)).toThrow(/unknown account/);
  });

  it("the paste line names the account, the plan flag and the two nevers", () => {
    const line = pasteLine("claude-1");
    expect(line).toContain("--plan claude-1 --missing");
    expect(line).toContain("routines/manifest.json");
    expect(line).toMatch(/Never merge; never apply a label\.$/);
    expect(() => pasteLine("claude-9")).toThrow();
  });
});

describe("the page", () => {
  const rows = [
    routine(),
    routine({ id: "theory", name: "Theory X", account: "claude-2", trigger: "trig_01FFFFFFFFFFFFFFFFFFFFFF", binding: { kind: "dispatcher", session: "session_01GGGGGGGGGGGGGGGGGGGGGG", label: "the Axiom dispatcher" }, prompt: { branch: "axiom-theory", file: "prompts/x.md", note: "not yet exported" }, model: null }),
    routine({ id: "owner-made", name: "Owner made", account: "claude-1", trigger: "trig_01HHHHHHHHHHHHHHHHHHHHHH", retired: ["trig_01IIIIIIIIIIIIIIIIIIIIII"], binding: { kind: "fresh" }, prompt: { note: "created in the web UI" }, model: null }),
  ];
  const { manifest: m } = parseManifest(manifest(rows));
  const page = renderRecreate(m, readFixture);

  it("is deterministic and carries every account, every row and the generated marker", () => {
    expect(renderRecreate(m, readFixture)).toBe(page);
    for (const a of Object.values(ACCOUNTS)) expect(page).toContain(`## ${a.label} — \`${a.env}\``);
    expect(page).toContain("| InSight doer (Claude 3) | `0 18 * * *` | `claude-fable-5-1` |");
    expect(page).toContain("`trig_01HHHHHHHHHHHHHHHHHHHHHH` (was `trig_01IIIIIIIIIIIIIIIIIIIIII`)");
    expect(page).toContain("<!-- routines:generated from routines/manifest.json updated 2026-09-03; 3 routines -->");
  });

  it("says which prompts cannot be recreated from this branch, and why", () => {
    const section = page.split("## Not yet recreatable from this branch")[1].split("## The lists")[0];
    expect(section).toContain("**Theory X** (Claude 2) — on `axiom-theory` as `prompts/x.md`; not yet exported");
    expect(section).toContain("**Owner made** (Claude 1) — not in the repository; created in the web UI");
    expect(section).not.toContain("InSight doer");
  });

  it("carries the paste line for each account and the six lists", () => {
    for (const key of Object.keys(ACCOUNTS)) expect(page).toContain(`> ${pasteLine(key)}`);
    for (const f of ["MERGE-LIST", "WORKLIST", "PERMISSIONS", "OWNER-LIST", "AXIOMS", "VISUAL-REQUESTS"]) expect(page).toContain(`\`docs/${f}.md\``);
  });

  it("a null model is named by what it means: the relay's, the session's, or nobody wrote it down", () => {
    expect(page).toContain("| Theory X | `0 18 * * *` | set by the relay, per the contract |");
    expect(page).toContain("| Owner made | `0 18 * * *` | not recorded on main |");
    const bound = renderRecreate(parseManifest(manifest([routine({ model: null, binding: { kind: "session", session: "session_01JJJJJJJJJJJJJJJJJJJJJJ", label: "the dev session" } })])).manifest, readFixture);
    expect(bound).toContain("| InSight doer (Claude 3) | `0 18 * * *` | the bound session's |");
  });

  it("a substituted prompt says what was substituted, so a reader can check the block by eye", () => {
    expect(page).toContain('the block opening "You are InSight\'s DOER on <ACCOUNT>", with <ACCOUNT> → Claude 3, <account-tag> → claude-3');
  });
});

describe("the real manifest against the real tree", () => {
  const manifestText = readTree("routines/manifest.json");
  const inventories = {};
  for (const f of readdirSync(join(ROOT, "docs"))) {
    const p = `docs/${f}`;
    if (!f.endsWith(".md") || ["docs/DECISIONS.md", "docs/DECISIONS-INDEX.md", "docs/MERGE-LIST.md", "docs/RECREATE.md"].includes(p)) continue;
    inventories[p] = readTree(p);
  }

  it("check:routines is green — every block resolves, every inventory id is known, the page is current", () => {
    expect(checkRoutines({ manifestText, readFile: readTree, inventories, recreateText: readTree("docs/RECREATE.md") })).toEqual([]);
  });

  it("the Claude 3 list worker and roll call come out as the live prompts were created — account substituted, patterns kept", () => {
    const { manifest: m } = parseManifest(manifestText);
    const p = plan(m, "claude-3", readTree);
    const doer = p.find((x) => x.id === "ops-list-worker-claude-3").create_trigger.prompt;
    expect(doer.startsWith("You are InSight's LIST WORKER on Claude 3 —")).toBe(true);
    expect(doer).toContain("carries the tag [claude-3]");
    expect(doer).toContain("naming Claude 3 while the PR is open");
    expect(doer).toContain("claude/ops-diag-worklist-<YYYY-MM-DD>");
    const roll = p.find((x) => x.id === "ops-roll-call-claude-3").create_trigger.prompt;
    expect(roll.startsWith("You are InSight's ROLL CALL on Claude 3 —")).toBe(true);
    expect(roll).toContain('"Claude 3 roll call <YYYY-MM-DD>"');
    expect(roll).toContain("claude/ops-diag-rollcall-claude-3-<YYYY-MM-DD>");
    for (const x of p) {
      if (x.prompt_status === "verbatim") expect(x.create_trigger.prompt).not.toMatch(/<ACCOUNT>|<account-tag>|<account>/);
    }
  });

  it("every live program Routine on Claude 3 fires into this program's planning session", () => {
    // The count is not pinned: the account's Routines page is the owner's
    // dial (the merge shift was deleted from it on 2026-09-04), and a
    // deleted lane is a manifest row going to "not yet", not a failure.
    // What is pinned is the binding of whatever IS live.
    const { manifest: m } = parseManifest(manifestText);
    const live = m.routines.filter((r) => r.account === "claude-3" && r.state === "live");
    expect(live.length).toBeGreaterThan(0);
    for (const r of live) expect(r.binding).toEqual({ kind: "relay", session: "session_013V91NnDHMjjLSGYxzTEsnw", label: "the planning session" });
  });
});

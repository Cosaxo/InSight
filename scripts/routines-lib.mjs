// routines-lib.mjs — the pure half of the recreation kit: the manifest of
// every Routine on every subscription, the prompt each one is created
// from, and the page that lets any session put them back
// (docs/RECREATE.md; docs/PROGRAM-RUNBOOK.md phase 3; D352).
//
// WHY THIS EXISTS. The Routines are the one part of the program that does
// not live in git: they sit on three claude.ai subscriptions, in three
// Routines pages, and no session can list another account's. Their
// prompts DO live here — every canonical block is a fenced block in a
// runbook opening "You are …" — but scattered over four files and one
// other branch, with the schedules, models and bindings in as many
// inventory tables. The owner's ask (2026-09-03) was one thing in GitHub
// from which any session, on any account, can recreate the lists and the
// monitoring. `routines/manifest.json` is that thing; this module reads
// it, resolves each prompt from its block, checks the two against the
// tree, and renders the page.
//
// WHAT IS PURE HERE. Everything: the CLI (`routines.mjs`) reads the files
// and passes texts in, so every rule below is testable with a fixture and
// the gate has no I/O of its own to be wrong about.
//
// Stdlib only, like the console and the pulse — a gate that needs an
// install is a gate that can be red for a reason unrelated to the tree.

export const ACCOUNTS = {
  "claude-1": {
    label: "Claude 1",
    env: "env_01Ri3fw8gD9Py3LmTQ9hTYCL",
    role: "the content lanes, the two daily improvers, night shift B",
  },
  "claude-2": {
    label: "Claude 2",
    env: "env_013gTXHYYHNaKBiWe8c4gmtd",
    role: "the axes program, the twelve theory lanes, the doc sweep, night shift A, the ops lanes",
  },
  "claude-3": {
    label: "Claude 3",
    env: "env_01LseXT8H9h61eXWkaLZeXxD",
    role: "the program lanes — the axiom builder, the merge shift, the console, a to-do doer, a roll call",
  },
};

export const STATES = ["live", "not yet", "disabled", "unknown"];
export const BINDINGS = ["fresh", "relay", "dispatcher", "session", "api"];

// The placeholders a template substitutes per account. Everything else in
// angle brackets — `<YYYY-MM-DD>`, `<slug>`, `<lane>` — is part of the
// prompt (a branch-name pattern the lane fills in at run time) and stays.
export const ACCOUNT_PLACEHOLDERS = ["<ACCOUNT>", "<account-tag>", "<account>"];

const CRON_FIELDS = 5;
const TRIGGER_RE = /^trig_[A-Za-z0-9]+$/;
const SESSION_RE = /^session_[A-Za-z0-9]+$/;
const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

// ---------------------------------------------------------------------------
// The manifest

export function parseManifest(text) {
  const problems = [];
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { manifest: null, problems: [`routines/manifest.json does not parse: ${e.message}`] };
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.routines)) {
    return { manifest: null, problems: ["routines/manifest.json: top level must be { version, updated, routines: [] }"] };
  }
  if (data.version !== 1) problems.push(`manifest version ${JSON.stringify(data.version)} — this reader knows version 1`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.updated || ""))) problems.push("manifest.updated must be a YYYY-MM-DD date");

  const ids = new Set();
  const namesByAccount = new Map();
  const triggers = new Set();
  data.routines.forEach((r, i) => {
    const where = `routines[${i}]${r && r.id ? ` (${r.id})` : ""}`;
    if (!r || typeof r !== "object") {
      problems.push(`${where}: not an object`);
      return;
    }
    if (!ID_RE.test(String(r.id || ""))) problems.push(`${where}: id must be a lowercase slug`);
    else if (ids.has(r.id)) problems.push(`${where}: duplicate id`);
    ids.add(r.id);
    if (!r.name || typeof r.name !== "string") problems.push(`${where}: name is required`);
    if (!ACCOUNTS[r.account]) problems.push(`${where}: account ${JSON.stringify(r.account)} is not one of ${Object.keys(ACCOUNTS).join(", ")}`);
    const key = `${r.account} ${r.name}`;
    if (namesByAccount.has(key)) problems.push(`${where}: the name ${JSON.stringify(r.name)} is already used on ${r.account} by ${namesByAccount.get(key)}`);
    namesByAccount.set(key, r.id);
    if (!STATES.includes(r.state)) problems.push(`${where}: state must be one of ${STATES.join(" · ")}`);
    const kind = r.binding && r.binding.kind;
    if (!BINDINGS.includes(kind)) problems.push(`${where}: binding.kind must be one of ${BINDINGS.join(" · ")}`);
    else if (["relay", "dispatcher", "session"].includes(kind) && r.state !== "not yet" && !SESSION_RE.test(String(r.binding.session || ""))) {
      problems.push(`${where}: a ${kind} binding names the session it fires into`);
    }
    if (r.schedule != null) {
      if (typeof r.schedule !== "string" || r.schedule.trim().split(/\s+/).length !== CRON_FIELDS) problems.push(`${where}: schedule must be a 5-field cron (UTC) or null`);
    } else if (r.state === "live" && kind !== "api") {
      problems.push(`${where}: a live Routine that is not API-fired has a schedule`);
    }
    if (r.trigger != null) {
      if (!TRIGGER_RE.test(String(r.trigger))) problems.push(`${where}: trigger must look like trig_…`);
      else if (triggers.has(r.trigger)) problems.push(`${where}: trigger ${r.trigger} appears twice`);
      triggers.add(r.trigger);
    }
    for (const t of r.retired || []) {
      if (!TRIGGER_RE.test(String(t))) problems.push(`${where}: retired ids must look like trig_…`);
      else if (triggers.has(t)) problems.push(`${where}: retired id ${t} is also live somewhere`);
      triggers.add(t);
    }
    if (r.state === "live" && r.trigger == null) problems.push(`${where}: live without a trigger id — quote it from list_triggers`);
    if (r.state === "not yet" && r.trigger != null) problems.push(`${where}: "not yet" with a trigger id — it exists, so say which state`);
    if (!r.prompt || typeof r.prompt !== "object") problems.push(`${where}: prompt is required — { file, opens } or { branch, file } or { note }`);
    else if (r.prompt.file && !r.prompt.branch && !r.prompt.opens) problems.push(`${where}: a prompt in a file on this branch names the line its block opens with`);
    if (!r.contract) problems.push(`${where}: contract is required — the section the prompt defers to`);
    if (!r.source) problems.push(`${where}: source is required — where the row was read from`);
    if (!Array.isArray(r.branches)) problems.push(`${where}: branches must be a list (empty when the lane writes no branch)`);
  });
  return { manifest: data, problems };
}

// Every id the manifest vouches for: live triggers and the retired ids an
// inventory table may still carry for the same Routine.
export function knownIds(manifest) {
  const out = new Set();
  for (const r of manifest.routines) {
    if (r.trigger) out.add(r.trigger);
    for (const t of r.retired || []) out.add(t);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Prompts

// The fenced block whose first line opens with `opens`. Null when no such
// block exists — the caller decides whether that is a problem.
export function extractBlock(markdown, opens) {
  const lines = String(markdown).split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!/^```/.test(lines[i])) continue;
    const first = lines[i + 1] || "";
    if (!first.startsWith(opens)) continue;
    const body = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^```/.test(lines[j])) return body.join("\n");
      body.push(lines[j]);
    }
    return null; // an unclosed fence is not a block
  }
  return null;
}

export function substitute(text, map) {
  let out = String(text);
  for (const [from, to] of Object.entries(map || {})) out = out.split(from).join(to);
  return out;
}

// Resolves one Routine's prompt against the tree. `readFile(path)` returns
// the file's text or null. Status:
//   verbatim      — the block is in the tree; `text` is what create_trigger gets
//   other-branch  — the block lives on another branch (the theory lanes);
//                   nothing is verified here, the roll call's ledger does that
//   not-in-repo   — the stored prompt was never written down as a block
//   missing       — the manifest points at a block the tree does not have
export function resolvePrompt(routine, readFile) {
  const p = routine.prompt || {};
  if (p.branch) {
    return { status: "other-branch", text: null, where: `${p.branch}:${p.file || "?"}`, note: p.note || null };
  }
  if (p.file) {
    const md = readFile(p.file);
    if (md == null) return { status: "missing", text: null, where: p.file, problem: `${routine.id}: prompt file ${p.file} is not in the tree` };
    const block = extractBlock(md, p.opens);
    if (block == null) return { status: "missing", text: null, where: p.file, problem: `${routine.id}: no fenced block in ${p.file} opens with ${JSON.stringify(p.opens)}` };
    const text = substitute(block, p.substitute).trim();
    const left = ACCOUNT_PLACEHOLDERS.filter((ph) => text.includes(ph));
    if (left.length) {
      return { status: "missing", text: null, where: p.file, problem: `${routine.id}: ${left.join(", ")} left unsubstituted — add it to prompt.substitute` };
    }
    const subs = Object.entries(p.substitute || {}).map(([k, v]) => `${k} → ${v}`);
    return {
      status: "verbatim",
      text,
      where: `${p.file} — the block opening ${JSON.stringify(p.opens)}${subs.length ? `, with ${subs.join(", ")}` : ""}`,
      note: p.note || null,
    };
  }
  return { status: "not-in-repo", text: null, where: null, note: p.note || "not written down as a block" };
}

// ---------------------------------------------------------------------------
// The inventories: every id a repo-side record's TABLE names. Prose ids
// (a retired id quoted in a decision) do not count — a table row is a
// claim that the Routine exists, prose is history.
export function inventoryIds(markdown, path = "") {
  const out = [];
  String(markdown).split("\n").forEach((line, i) => {
    if (!/^\s*\|/.test(line)) return;
    for (const m of line.matchAll(/trig_[A-Za-z0-9]{10,}/g)) out.push({ id: m[0], path, line: i + 1 });
  });
  return out;
}

// ---------------------------------------------------------------------------
// The gate. `files` is { manifestText, readFile, inventories: { path: text },
// recreateText }. Returns problems; empty means green.
export function checkRoutines(files) {
  const { manifest, problems } = parseManifest(files.manifestText);
  if (!manifest) return problems;
  const known = knownIds(manifest);
  for (const r of manifest.routines) {
    const res = resolvePrompt(r, files.readFile);
    if (res.problem) problems.push(res.problem);
  }
  for (const [path, text] of Object.entries(files.inventories || {})) {
    for (const row of inventoryIds(text, path)) {
      if (!known.has(row.id)) problems.push(`${row.path}:${row.line} names ${row.id} in an inventory table and routines/manifest.json does not — add the row, or list it under the Routine's retired ids`);
    }
  }
  if (typeof files.recreateText === "string") {
    const want = renderRecreate(manifest, files.readFile);
    if (want !== files.recreateText) problems.push("docs/RECREATE.md is not what the manifest renders — run `node scripts/routines.mjs --write`");
  }
  return problems;
}

// ---------------------------------------------------------------------------
// The plan a session follows: one object per Routine, the create_trigger
// arguments as the tool takes them, and the web-UI fields for the path
// that needs no tool.
export function plan(manifest, account, readFile, { missing = false } = {}) {
  if (!ACCOUNTS[account]) throw new Error(`unknown account ${account} — one of ${Object.keys(ACCOUNTS).join(", ")}`);
  return manifest.routines
    .filter((r) => r.account === account)
    .filter((r) => !missing || r.state !== "live")
    .map((r) => {
      const prompt = resolvePrompt(r, readFile);
      const args = { name: r.name };
      if (r.schedule) args.cron_expression = r.schedule;
      if (prompt.text) args.prompt = prompt.text;
      switch (r.binding.kind) {
        case "fresh":
          args.create_new_session_on_fire = true;
          if (r.notifications) args.notifications = r.notifications === "on" ? { push: true, email: true } : {};
          break;
        case "relay":
        case "dispatcher":
        case "session":
          if (r.binding.session) args.persistent_session_id = r.binding.session;
          break;
        case "api":
          // poke-only: no schedule; the workflow fires it by URL
          break;
      }
      return {
        id: r.id,
        name: r.name,
        account: r.account,
        state: r.state,
        trigger: r.trigger || null,
        model: r.model || null,
        binding: r.binding,
        contract: r.contract,
        reports: r.reports || null,
        branches: r.branches,
        source: r.source,
        note: r.note || null,
        prompt_status: prompt.status,
        prompt_where: prompt.where,
        prompt_note: prompt.note || null,
        create_trigger: args,
        web_ui: {
          name: r.name,
          schedule: r.schedule || (r.binding.kind === "api" ? "none — fired by URL" : null),
          model: modelWord(r),
          repository: "Cosaxo/InSight",
          notifications: r.notifications || "off",
          prompt: prompt.status === "verbatim" ? "paste the block named in prompt_where verbatim" : `not in this tree: ${prompt.where || prompt.note}`,
        },
      };
    });
}

// The line the owner gives a session on an account. One line, the same
// shape as the runbooks' messages, ending on the two nevers.
export function pasteLine(account) {
  const a = ACCOUNTS[account];
  if (!a) throw new Error(`unknown account ${account}`);
  return (
    `Read docs/RECREATE.md on origin/main and run \`node scripts/routines.mjs --plan ${account} --missing\`. ` +
    `For each Routine it prints, create it with create_trigger using exactly the arguments printed — the prompt verbatim, the schedule, the binding — ` +
    `or, where the binding is fresh, in this account's Routines page (claude.ai/code/routines) with the repository Cosaxo/InSight attached and the fields under web_ui; ` +
    `if a creation is refused, stop and tell me exactly which, so I can create it in the web UI. ` +
    `Then run list_triggers and open one PR that writes each new id into routines/manifest.json (trigger and state, quoted from the tool response — never from the prompt) and into the inventory table its source names, ` +
    `runs npm run check:routines, and requests Cosaxo. Never merge; never apply a label.`
  );
}

// ---------------------------------------------------------------------------
// The page. Deterministic: the only date on it is the manifest's own.

const LISTS = [
  ["`docs/MERGE-LIST.md`", "what automation built, one row per PR with *what* and *how*; the owner ticks a row to approve it", "the console workflow renders it; the owner ticks"],
  ["`docs/WORKLIST.md`", "the to-do queue, one item per line tagged for the account that takes it", "the owner adds; the list workers tick, one item per PR"],
  ["`docs/PERMISSIONS.md`", "every permission, secret or setting that is limiting a routine, with the exact fix", "a routine appends its row; the owner changes the status word"],
  ["`docs/OWNER-LIST.md`", "what only the owner can do — decisions, clicks, designs, approvals, store and legal", "routines add asks; the owner ticks"],
  ["`docs/AXIOMS.md`", "every axiom with its status — operational, explored, proposed — which licenses what may be built", "routines propose; the owner moves the status word"],
  ["`docs/VISUAL-REQUESTS.md`", "every visual to be designed in Claude Design before it is built, written so the designer understands it whole", "routines request; the owner refines; `docs/VISUAL-VISION.md` names the current design"],
];

const MONITORING = [
  ["The console", "`.github/workflows/console.yml` → `scripts/console.mjs`, every two hours and on every push to `main`, PR label event and edit of the pinned issue titled **Console**; renders `docs/MERGE-LIST.md`, folds `docs/OWNER-LIST.md`, appends `monitoring/console-trail.jsonl`, mirrors the owner's ticks to the label `approved`", "GitHub Actions — no account, no bucket; nothing to recreate but the workflow file"],
  ["The console keeper", "turns the console's data into the charted page the owner reads, twice a day", "a Routine on Claude 3 — its row above"],
  ["The roll calls", "one per account, daily: which Routines fired when they should have, what they cost, and on Sundays the ledger of live prompts against their blocks", "a Routine per account — their rows above; the console joins the three"],
  ["The production reader", "what the instruments said today, one comment", "a Routine on Claude 2 — its row above"],
  ["The run logs", "one issue per program: **Program run log**, **Ops run log**, **Axes program run log** (#290), **doc-sweep run log** (#336), **Question farm — run log** (#31)", "issues; a lane creates its own if absent, with the body its runbook prescribes"],
  ["The pulse", "`.github/workflows/pulse.yml` → `scripts/pulse.mjs`, `monitoring/pulse-trail.jsonl`, the operator gate", "GitHub Actions; `docs/PULSE.md`"],
];

function cell(s) {
  return String(s == null ? "—" : s).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function bindingLabel(b) {
  switch (b.kind) {
    case "fresh": return "fresh session per fire, repository attached";
    case "relay": return b.session ? `fires into the planning session \`${b.session}\`, which relays it verbatim into a fresh session` : "relayed into a fresh session (the relay is not created yet)";
    case "dispatcher": return b.session ? `fires into ${b.label || "a dispatcher"} \`${b.session}\`, which relays it into a fresh session` : `relayed by ${b.label || "a dispatcher"} — not created yet`;
    case "session": return `fires into ${b.label || "a persistent session"} \`${b.session}\`, which does the work itself`;
    case "api": return "poke-only — a workflow fires it by URL";
    default: return b.kind;
  }
}

// A null model means three different things by binding: a relayed lane's
// model is whatever the relay's create_session sets, a session-bound lane
// runs on its session's model, and a fresh lane created in the web UI has
// a model nobody wrote down — which is a gap, and is named as one.
function modelWord(r) {
  if (r.model) return r.model;
  if (["relay", "dispatcher"].includes(r.binding.kind)) return "set by the relay, per the contract";
  if (r.binding.kind === "session") return "the bound session's";
  return "not recorded on main";
}

function modelCell(r) {
  return r.model ? `\`${r.model}\`` : modelWord(r);
}

export function renderRecreate(manifest, readFile) {
  const out = [];
  out.push("# Recreating the program — every Routine, every list, the monitoring, from this repository alone");
  out.push("");
  out.push("**Status: tree — generated by `node scripts/routines.mjs --write` from");
  out.push("`routines/manifest.json`; `check:routines` fails when regenerating");
  out.push("would change it. Edit the manifest, not this page.**");
  out.push("");
  out.push("The Routines are the one part of the program that does not live in");
  out.push("git: they sit on three claude.ai subscriptions, in three Routines pages,");
  out.push("and no session can list another account's. Their prompts do live here,");
  out.push("one fenced block per lane in the runbook that is its contract, and so");
  out.push("do the schedules, models and bindings, in one inventory table per");
  out.push("program. This page joins them: for every Routine on every account, the");
  out.push("name to give it, when it fires, on what model, into which session, and");
  out.push("where its prompt is — enough for any session, on any of the three");
  out.push("subscriptions, to put a missing one back exactly. The lists and the");
  out.push("monitoring are files and workflows and come back with the clone; the");
  out.push("last two sections say which file is which.");
  out.push("");
  out.push("## In any session, one line");
  out.push("");
  out.push("Give a session on the account the line for that account. It reads");
  out.push("this page, prints the plan, creates what is missing, and opens the PR");
  out.push("that records the ids. Where a creation is refused from a session, the");
  out.push("same plan's `web_ui` fields are the five boxes the Routines page asks");
  out.push("for.");
  out.push("");
  for (const key of Object.keys(ACCOUNTS)) {
    out.push(`**${ACCOUNTS[key].label}** (${ACCOUNTS[key].role}):`);
    out.push("");
    out.push(`> ${pasteLine(key)}`);
    out.push("");
  }
  out.push("`node scripts/routines.mjs --plan <account>` prints every Routine of");
  out.push("the account with the exact `create_trigger` arguments; `--missing`");
  out.push("keeps only those not live; `--message <account>` prints the line");
  out.push("above; `--check` is the gate.");
  out.push("");
  for (const key of Object.keys(ACCOUNTS)) {
    const rows = manifest.routines.filter((r) => r.account === key);
    out.push(`## ${ACCOUNTS[key].label} — \`${ACCOUNTS[key].env}\``);
    out.push("");
    out.push("| Routine | Schedule (UTC) | Model | Binding | Prompt | State | Trigger id |");
    out.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const r of rows) {
      const p = resolvePrompt(r, readFile);
      const promptCell =
        p.status === "verbatim" ? p.where :
        p.status === "other-branch" ? `on \`${r.prompt.branch}\`: \`${r.prompt.file}\`${p.note ? ` — ${p.note}` : ""}` :
        p.status === "missing" ? `**missing** — ${p.problem}` :
        `**not in the repository** — ${p.note}`;
      const state = r.state + (r.note ? ` — ${r.note}` : "");
      const trigger = (r.trigger ? `\`${r.trigger}\`` : "—") + (r.retired && r.retired.length ? ` (was ${r.retired.map((t) => `\`${t}\``).join(", ")})` : "");
      out.push(`| ${cell(r.name)} | ${r.schedule ? `\`${r.schedule}\`` : cell(r.binding.kind === "api" ? "fired by URL" : "—")} | ${modelCell(r)} | ${cell(bindingLabel(r.binding))} | ${cell(promptCell)} | ${cell(state)} | ${trigger} |`);
    }
    out.push("");
  }
  // A disabled Routine is not to be recreated, so a prompt it never had
  // (the production reader, a workflow since D359) is not a gap.
  const notHere = manifest.routines.filter((r) => r.state !== "disabled" && ["not-in-repo", "other-branch"].includes(resolvePrompt(r, readFile).status));
  out.push("## Not yet recreatable from this branch");
  out.push("");
  out.push("A Routine whose stored prompt was never written down as a block, or");
  out.push("lives on another branch, can be re-created only by reading the live");
  out.push("one (`list_triggers` returns prompts verbatim) — which is what");
  out.push("`docs/WORKLIST.md` asks each account to do, once, so this list empties.");
  out.push("");
  if (!notHere.length) out.push("*(none — every prompt is a block on this branch)*");
  for (const r of notHere) {
    const p = resolvePrompt(r, readFile);
    out.push(`- **${r.name}** (${ACCOUNTS[r.account].label}) — ${p.status === "other-branch" ? `on \`${r.prompt.branch}\` as \`${r.prompt.file}\`` : "not in the repository"}${p.note ? `; ${p.note}` : ""}`);
  }
  out.push("");
  out.push("## The lists");
  out.push("");
  out.push("Six files on `main`, each the owner's to run the program from");
  out.push("(`CLAUDE.md` § House style, D352). They come back with the clone.");
  out.push("");
  out.push("| File | What it is | Who writes it |");
  out.push("| --- | --- | --- |");
  for (const [f, what, who] of LISTS) out.push(`| ${f} | ${what} | ${who} |`);
  out.push("");
  out.push("## The monitoring");
  out.push("");
  out.push("| Instrument | What it does | Where it lives |");
  out.push("| --- | --- | --- |");
  for (const [n, what, where] of MONITORING) out.push(`| ${n} | ${what} | ${where} |`);
  out.push("");
  out.push(`<!-- routines:generated from routines/manifest.json updated ${manifest.updated}; ${manifest.routines.length} routines -->`);
  out.push("");
  return out.join("\n");
}

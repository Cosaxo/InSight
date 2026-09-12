#!/usr/bin/env node
// state.mjs — one page that says where the project is.
//
// WHY THIS EXISTS. There are ~93,000 lines of markdown here, nine vision
// documents, 442 decision records and six owner-facing lists. Every number
// a person actually wants — what is live, what is stuck, what is waiting
// on the owner and for how long, what it costs, how many answers exist —
// is already computed by something in `scripts/`. None of it is in one
// place, so answering "where are we" means opening five documents and
// trusting that each is current.
//
// The fix is not writing less. It is one page nobody maintains: every
// figure below is READ from the tree at generation time, so a stale line
// here is impossible by construction rather than by discipline. It holds
// no reasoning of its own — the same contract ORIENTATION.md declares —
// and where this page and a source disagree, the source is right and this
// page has not been regenerated.
//
// WHAT IT DELIBERATELY DOES NOT DO: judge. "119 open owner rows" is a
// fact; "the owner queue is a bottleneck" is a reading, and a generated
// page that editorialises is one nobody trusts the facts of.
//
// Run:  node scripts/state.mjs           # print
//       node scripts/state.mjs --write   # write docs/STATE.md

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collect } from "./pulse-collect.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs", "STATE.md");
const read = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), "utf8") : "");

const num = (n) => (n == null ? "—" : Number(n).toLocaleString("en-US"));
const usd = (n) => (n == null ? "—" : `$${Number(n).toLocaleString("en-US")}`);

/** Open and ticked rows in one of the owner-facing lists. Counted on the
 *  checkbox rather than on a heading, because the lists carry prose
 *  between rows and a section count would drift from what is actually
 *  outstanding. */
export function checkboxes(md) {
  const open = (md.match(/^- \[ \]/gm) || []).length;
  const done = (md.match(/^- \[[xX]\]/gm) || []).length;
  return { open, done, total: open + done };
}

/** Every `## D…` heading, split by shape. `records` is what the tree calls
 *  a decision; amendments hang off one. */
export function decisionCounts(md) {
  const heads = md.match(/^## D[^\n]*$/gm) || [];
  const amendments = heads.filter((h) => / (amendment|adoption) \(/.test(h)).length;
  const dated = heads.filter((h) => /^## D-\d{4}-\d{2}-\d{2}/.test(h)).length;
  return { records: heads.length - amendments, amendments, dated };
}

/** The gates, counted the way ci.yml invokes them. */
export function gateCount(pkg) {
  return Object.keys(JSON.parse(pkg).scripts || {}).filter((k) => k.startsWith("check:")).length;
}

export function buildState({ pulse, ownerMd, mergeMd, worklistMd, decisionsMd, pkg, today }) {
  const owner = checkboxes(ownerMd);
  const merge = checkboxes(mergeMd);
  const work = checkboxes(worklistMd);
  const dec = decisionCounts(decisionsMd);
  const L = [];

  L.push("# State — where the project is, generated");
  L.push("");
  L.push(
    "**Status: tree — generated, do not hand-edit.** `node scripts/state.mjs --write`.",
    "Every figure here is read from the tree at generation time, so this page",
    "cannot go stale in the way a hand-written summary does — it can only be",
    "out of date, which the stamp below says. It holds no reasoning of its own;",
    "where it and a source disagree, the source is right.",
    "",
    `Generated **${today}**.`,
  );
  L.push("");

  L.push("## The two bills");
  L.push("");
  L.push(
    "Kept side by side because they are about 410x apart and only one of them",
    "used to have an instrument (D-2026-09-09f).",
    "",
  );
  L.push("| | Figure | Basis |");
  L.push("| --- | ---: | --- |");
  L.push(`| Running the app (modelled) | ${usd(pulse.guard?.burnUsd)} / month | ${pulse.guard?.measuredActives == null ? "no measured population yet" : `${num(pulse.guard.measuredActives)} measured actives, ${pulse.guard.measuredOn}`} |`);
  L.push(`| Building the app (measured) | ${usd(pulse.program?.usdPerDay)} / day | ${pulse.program?.measuredOn ? `measured ${pulse.program.measuredOn}, ${pulse.program.ageDays} days ago` : "not measured"} |`);
  L.push(`| Usage guard | ${pulse.guard?.state ?? "—"} | allowance ${usd(pulse.guard?.allowanceUsd)}/month |`);
  L.push(`| Program guard | ${pulse.program?.state ?? "—"} | allowance ${usd(pulse.program?.allowanceUsdPerDay)}/day |`);
  if (pulse.program?.largestSession) {
    const s = pulse.program.largestSession;
    L.push("");
    L.push(`Largest single line: **${s.label}** — ${usd(s.usdInWindow)} in the measured window.`);
  }
  L.push("");

  L.push("## What there is to answer");
  L.push("");
  L.push("| | Count |");
  L.push("| --- | ---: |");
  L.push(`| Questions in the bank | ${num(pulse.pipeline?.archive?.total ?? pulse.cost?.seededBankDocs)} |`);
  L.push(`| Daily deck runway | ${num(pulse.pipeline?.deck?.runwayDays)} days |`);
  L.push(`| Answers counted | ${num(pulse.pipeline?.scorecard?.totalAnswers)} |`);
  L.push(`| Unpromoted | ${num(pulse.pipeline?.archive?.unpromoted)} |`);
  L.push("");
  L.push(
    "**Answers counted** is the one number to read first, and the reason this",
    "page leads with cost: a program is only expensive relative to what it has",
    "produced.",
  );
  L.push("");

  L.push("## What is waiting on a person");
  L.push("");
  L.push("| List | Open | Ticked |");
  L.push("| --- | ---: | ---: |");
  L.push(`| [\`OWNER-LIST.md\`](OWNER-LIST.md) — only the owner can | ${owner.open} | ${owner.done} |`);
  L.push(`| [\`MERGE-LIST.md\`](MERGE-LIST.md) — approvals | ${merge.open} | ${merge.done} |`);
  L.push(`| [\`WORKLIST.md\`](WORKLIST.md) — items tagged by account | ${work.open} | ${work.done} |`);
  L.push("");
  L.push(
    "A tick is the mechanism the program runs on (`PROGRAM-PLAN.md` §2.4), so",
    "the ratio in the OWNER-LIST row is the throughput of the whole ask",
    "channel — including every D334 privacy question a routine deferred into it.",
  );
  L.push("");

  L.push("## What is watching");
  L.push("");
  L.push("| | Count |");
  L.push("| --- | ---: |");
  L.push(`| \`check:*\` gates | ${gateCount(pkg)} |`);
  L.push(`| Cloud Functions | ${num(pulse.instrumentation?.functionCount)} |`);
  L.push(`| …with an alert over them | ${num(pulse.instrumentation?.alertedCount)} |`);
  L.push(`| Decision records | ${dec.records} (${dec.amendments} amendments, ${dec.dated} dated) |`);
  L.push("");

  L.push("## Where to go next");
  L.push("");
  L.push(
    "- [`ORIENTATION.md`](ORIENTATION.md) — the map: every document, gate and",
    "  directory, and which describe the tree versus a proposal.",
    "- [`OWNER-LIST.md`](OWNER-LIST.md) — what is blocked on a decision.",
    "- `npm run pulse` — the console this page's figures come from, rendered.",
    "- `npm run pulse -- --check` — the operator gate: runway, staleness, both bills.",
  );
  L.push("");
  return L.join("\n");
}

const isEntry = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isEntry) {
  const md = buildState({
    pulse: collect(),
    ownerMd: read("docs/OWNER-LIST.md"),
    mergeMd: read("docs/MERGE-LIST.md"),
    worklistMd: read("docs/WORKLIST.md"),
    decisionsMd: read("docs/DECISIONS.md"),
    pkg: read("package.json"),
    today: new Date().toISOString().slice(0, 10),
  });
  if (process.argv.includes("--write")) {
    writeFileSync(OUT, md);
    console.log(`state: wrote docs/STATE.md`);
  } else {
    process.stdout.write(md);
  }
}

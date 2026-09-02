#!/usr/bin/env node
// mod-queue.mjs — read the moderation queue and submit a verdict, from a
// terminal.
//
// WHY THIS EXISTS. `fetchModQueue` and `submitModVerdict` have been
// deployed and enforcing since D22. Their only caller anywhere in this
// tree was `firestore-tests/e2e-moderation.mjs` — so a maintainer holding
// MOD_UIDS had no screen, no script and no workflow through which to read
// the queue or answer it. The substrate was live and the review half was a
// test harness.
//
// That is the same gap `seed-content.mjs` and `rebuild-aggregate.mjs` were
// written to close, and the same argument closes it: a step documented as
// something nobody can perform is a step that does not get performed. For
// moderation the consequence is sharper than for seeding — every hour a
// flagged take sits unread is an hour the flaggers' report did nothing,
// and D22's whole design rests on somebody actually looking.
//
//   node scripts/mod-queue.mjs                        # read the queue
//   node scripts/mod-queue.mjs --keep <takeId>
//   node scripts/mod-queue.mjs --escalate <takeId>
//   node scripts/mod-queue.mjs --remove <takeId> --line H3
//
// WHAT IT DELIBERATELY DOES NOT DO. No bulk mode, no "remove everything
// over N flags", no loop over the queue. `MOD_RUN_CAP` bounds a run's blast
// radius on the server, and this side keeps the matching shape: one verdict
// per invocation, each typed by a person who read the text. A CLI that
// could clear the queue in one command is a CLI that will, and D22's
// confinement argument is about exactly that.
//
// The runId groups verdicts submitted together in the server's log. It is
// generated per invocation rather than taken as a flag, because a run id
// somebody can choose is a run id somebody can reuse.
//
// Credentials: scripts/operator-call.mjs, same env as the others — except
// that the uid in SEED_ADMIN_UIDS must ALSO be in MOD_UIDS for these two
// callables to answer. Those lists are meant to be disjoint (D22), which
// means the correct long-term setup is a second credential set for the
// moderator identity; see runbook 5.7 and `operatorModeratorOverlap` in
// functions/src/ops.ts, which reports the state today.

import { randomUUID } from "node:crypto";
import { operatorContext, callOperator } from "./operator-call.mjs";

// H1–H5, mirroring MOD_POLICY_LINES in functions/src/pure.ts. Read rather
// than imported: this is bare node against a .ts module, the same reason
// operator-call.mjs scans FUNCTIONS_REGION out of its source. The server
// rejects anything else, so a drift here is a clear error and not a bad
// removal.
const POLICY_LINES = ["H1", "H2", "H3", "H4", "H5"];

const argv = process.argv.slice(2);

// PRESENCE AND VALUE ARE DIFFERENT QUESTIONS, and conflating them here was
// a real bug: `flag()` returned null both when a flag was absent and when
// it was present with nothing after it, so `node scripts/mod-queue.mjs
// --keep` (an id lost off the end of a line, a wrapper passing an empty
// variable) printed the QUEUE and exited 0. The take stayed flagged, no
// verdict was recorded, and the exit status was the same as success.
const has = (name) => argv.includes(`--${name}`);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return null;
  const next = argv[i + 1];
  // A value that is itself an option is a missing value. Without this,
  // `--remove --line H3` — the documented form with the id dropped, one
  // token off a paste — takes "--line" as the takeId, and every check
  // downstream passes: it is a non-empty string under 128 chars, so the
  // server's modVerdictError accepts it and a removal is recorded against
  // a take that does not exist.
  if (next === undefined || next.startsWith("--")) return undefined;
  return next;
};

const verdicts = ["remove", "keep", "escalate"].filter(has);
if (verdicts.length > 1) {
  console.error(`mod-queue: pick one verdict, not ${verdicts.length} (${verdicts.join(", ")}).`);
  process.exit(1);
}
const verdictKind = verdicts[0] || null;
const takeId = verdictKind ? flag(verdictKind) : null;
if (verdictKind && !takeId) {
  console.error(
    `mod-queue: --${verdictKind} needs a takeId.\n`
    + "    Read the queue first (no arguments) and copy one.",
  );
  process.exit(1);
}
const policyLine = has("line") ? flag("line") : null;
if (has("line") && !policyLine) {
  console.error("mod-queue: --line needs a policy line (H1..H5).");
  process.exit(1);
}

// Validated here as well as on the server, because the round trip costs a
// token mint and the error it returns is the same sentence.
if (verdictKind === "remove" && !POLICY_LINES.includes(policyLine)) {
  console.error(
    "mod-queue: a removal must cite a policy line — --line H1..H5.\n"
    + "    docs/MODERATION.md § The policy has what each line covers. This is\n"
    + "    not a formality: every removal is citable BY CONSTRUCTION, which is\n"
    + "    what lets the verdict log be read back as a record of judgement\n"
    + "    rather than of taste.",
  );
  process.exit(1);
}
if (verdictKind && verdictKind !== "remove" && policyLine) {
  console.error(`mod-queue: --line is only for --remove (got ${verdictKind}).`);
  process.exit(1);
}

let ctx;
try {
  ctx = operatorContext("mod-queue");
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const call = async (name, data) => {
  try {
    return await callOperator(ctx, name, data);
  } catch (err) {
    console.error(err.message);
    // MATCHED AGAINST WHAT THE SERVER ACTUALLY SENDS. This tested
    // /permission-denied/ and never fired: the wire carries
    // `{status: "PERMISSION_DENIED", message: "moderator-only"}` (the
    // HttpsError code is upper-snake by the time it is serialised, and
    // `assertModerator` chose the message), so callOperator's line reads
    // "submitModVerdict failed (403): PERMISSION_DENIED moderator-only" —
    // no lowercase-hyphen spelling anywhere in it. The hint that exists to
    // explain the single most likely refusal was unreachable.
    if (/permission[_-]denied|moderator-only/i.test(err.message)) {
      console.error(
        "    permission-denied here means the uid is not in MOD_UIDS — which is\n"
        + "    a DIFFERENT list from SEED_ADMIN_UIDS by design (D22). Being able to\n"
        + "    seed content does not make you a moderator.",
      );
    }
    process.exit(1);
  }
};

if (!verdictKind) {
  const q = await call("fetchModQueue", {});
  const items = q.items || [];
  console.log(`mod-queue: ${items.length} item(s)${q.advisory ? "  [ADVISORY — verdicts are recorded, not applied]" : ""}`);
  console.log(`  per-run cap ${q.runCap}\n`);
  if (!items.length) {
    // Distinguished from a failure on purpose: an empty queue and a broken
    // fetch look identical if the tool just prints nothing.
    console.log("  Nothing queued. The tally is rebuilt on a schedule, so an empty");
    console.log("  queue means no take is over the flag threshold right now.");
  }
  for (const it of items) {
    const marks = [
      `${it.flags} flag(s)`,
      it.kind !== "take" ? it.kind : null,
      it.escalated ? "ESCALATED this generation" : null,
      it.escalations ? `deferred ${it.escalations}x before` : null,
    ].filter(Boolean);
    console.log(`  ${it.takeId}`);
    console.log(`    ${marks.join(" · ")}`);
    // D178: an avatar's content IS the image, so what a reviewer needs is
    // the token and bucket to fetch it. The server sends `text: ""` on
    // those entries deliberately (moderation.ts, "No text to copy") —
    // so printing the text field would render an avatar as a take with an
    // empty body, which reads as a corrupt row rather than as an image.
    // (This comment said the field was ABSENT and that printing it would
    // show "undefined". It is not absent; the branch is right for the
    // reason above, not that one.)
    console.log(`    ${it.kind === "take" ? JSON.stringify(it.text) : `[${it.kind}] token ${it.token ?? "?"} in ${it.bucket ?? "?"}`}`);
  }
  if (items.length) {
    console.log("\n  Answer one with:");
    console.log("    node scripts/mod-queue.mjs --keep <takeId>");
    console.log("    node scripts/mod-queue.mjs --escalate <takeId>");
    console.log("    node scripts/mod-queue.mjs --remove <takeId> --line H3");
  }
} else {
  const runId = randomUUID();
  const verdict = { takeId, verdict: verdictKind, ...(policyLine ? { policyLine } : {}) };
  const out = await call("submitModVerdict", { runId, verdict });
  console.log(`mod-queue: ${verdictKind} recorded for ${takeId}${policyLine ? ` (${policyLine})` : ""}`);
  console.log(`  runId ${runId}`);
  if (out && typeof out === "object") console.log(`  ${JSON.stringify(out)}`);
}

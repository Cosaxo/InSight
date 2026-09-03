// production-reader.mjs — what the instruments read, as one comment.
//
// WHY THIS IS A SCRIPT AND NOT A ROUTINE. The production reader was a
// scheduled Claude session (OPS-RUNBOOK.md § The production reader) whose
// whole job was: fetch two workflow runs, read a committed trail, compare
// with yesterday, post a comment. Nothing in that needs judgement, and a
// session that does it pays for its own history on every firing — measured
// 2026-09-03 at about $4 a wake against a dispatcher that had reached 564k
// tokens (docs/USAGE-REDUCTION.md). console.yml already made this argument
// for the console page: what an Action can read, an Action should read.
//
// WHAT IT DELIBERATELY DOES NOT DO. It never calls a Google API — the
// probe holds that credential and this reads the probe's own payload, which
// is the reader contract's `Never:` line kept exactly. It never re-runs a
// workflow, never applies a policy, and writes nothing but the comment
// body it prints to stdout; the workflow posts it.
//
// EVERY INPUT IS OPTIONAL, AND ABSENCE IS THE HEADLINE (D1, D296). A probe
// that did not run, an artifact that is not there, a trail that has not
// moved — each is a line that says so in words, never a blank or a stale
// number carried forward. D296 is fifteen days of a confident zero; this
// file exists so that the zero has to announce itself.

import { readFileSync } from "node:fs";

// The trail fields whose SILENCE is the failure D296 recorded — live
// signals that should move when the app is used. Deliberately not the
// stable ones (`dailyBank`, `burnUsd5k`): "unchanged" is their correct
// state, and a reader that cried about them would train its own reader to
// stop looking. `null` counts as absent, `0` as zero, and three identical
// values in a row as unchanged, which is the contract's "more than two
// consecutive days".
const WATCHED = [
  ["dau", "daily actives"],
  ["answersCounted", "answers counted"],
  ["measuredActives", "measured actives"],
  ["retD7", "D7 retention"],
  ["revenueUsd", "revenue"],
];

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Read a JSONL trail into rows, oldest first. Bad lines are skipped rather
 * than fatal: a half-written row is a pulse problem, not a reason for the
 * reader to go silent about everything else. */
export function parseTrail(text) {
  const rows = [];
  for (const line of String(text ?? "").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const row = JSON.parse(t);
      if (row && typeof row === "object") rows.push(row);
    } catch {
      /* skipped on purpose — see above */
    }
  }
  return rows;
}

/** A run's state in one phrase, from the GitHub run object the workflow
 * hands over. `null` means the API returned no run at all. */
function runLine(label, run, today) {
  if (!run) return `**${label}: no run found.** The workflow has never run, or its runs are no longer listed.`;
  const day = String(run.created_at ?? "").slice(0, 10);
  const stale = day && today && day !== today;
  const state = run.status === "completed" ? (run.conclusion ?? "completed") : (run.status ?? "unknown");
  const when = day ? ` (${day}${stale ? " — **not today**" : ""})` : "";
  const link = run.html_url ? ` [run](${run.html_url})` : "";
  return `${label}: **${state}**${when}${link}`;
}

/**
 * Render the reader's comment.
 *
 * @param {object} i
 * @param {object|null} i.observe      the payload of `observe.mjs --json-out`
 * @param {object|null} i.observeRun   newest scheduled Observe production run
 * @param {object|null} i.pulseRun     newest Pulse run
 * @param {string}      i.trail        monitoring/pulse-trail.jsonl contents
 * @param {string}      i.today        YYYY-MM-DD, stamped by the caller
 */
export function render({ observe = null, observeRun = null, pulseRun = null, trail = "", today = "" } = {}) {
  const out = [];
  const rows = parseTrail(trail);
  const last = rows.at(-1) ?? null;
  const flags = [];

  out.push(`## Production, read at ${today || "an unstamped time"}`);
  out.push("");

  // 1 · The headline. The contract is explicit that a probe which did not
  // happen, or a reading that could not be fetched, outranks every number
  // below it — so it is computed first and printed first.
  const probeOk = observeRun && observeRun.status === "completed" && observeRun.conclusion === "success";
  const probeDay = String(observeRun?.created_at ?? "").slice(0, 10);
  if (!observeRun) {
    out.push("**Headline: the observe probe has no run.** Nothing below reflects a fresh reading.");
  } else if (!probeOk) {
    out.push(`**Headline: the observe probe did not succeed** — ${runLine("Observe production", observeRun, today)}.`);
  } else if (today && probeDay && probeDay !== today) {
    out.push(`**Headline: the newest observe run is from ${probeDay}, not today.** The readings below are that old.`);
  } else if (!observe) {
    out.push(
      "**Headline: the probe ran green but published no machine-readable reading.** " +
        "`observe.yml` uploads the `observe-json` artifact from `--json-out`; without it this reader " +
        "has the run's conclusion and nothing else.",
    );
  } else {
    out.push(`Observe production ran green today. ${observe.reachable?.length ?? 0} of ` +
      `${Object.keys(observe.readings ?? {}).length} readings available.`);
  }
  out.push("");
  out.push(`- ${runLine("Observe production", observeRun, today)}`);
  out.push(`- ${runLine("Pulse", pulseRun, today)}`);
  if (pulseRun && !(pulseRun.status === "completed" && pulseRun.conclusion === "success")) {
    flags.push("the pulse run is not green");
  }
  out.push("");

  // 2 · The four readings the contract names, each from the probe's own
  // payload rather than from its printed lines.
  out.push("### What the probe can see");
  out.push("");
  if (!observe) {
    out.push("_No payload — see the headline._");
  } else {
    const r = observe.readings ?? {};
    const ap = r.alertPolicies;
    if (!ap || ap.status !== "ok") {
      out.push(`- **Alert policies: refused** — ${ap?.why ?? "no reading"}${ap?.http ? ` (${ap.http})` : ""}`);
      flags.push("the alert-policy reading is refused");
    } else if (ap.armed) {
      out.push(`- Alert policies: **all ${ap.committed} committed policies armed** (${ap.liveCount} live, ${ap.enabledCount} enabled)`);
    } else {
      out.push(`- **Alert policies: ${ap.missing?.length ?? "?"} of ${ap.committed} committed policies NOT armed** — ${(ap.missing ?? []).join(", ")}`);
      flags.push(`${ap.missing?.length ?? "?"} committed alert policies are not armed`);
    }

    const fn = r.functions;
    if (!fn || fn.status !== "ok") {
      out.push(`- **Functions: refused** — ${fn?.why ?? "no reading"}${fn?.http ? ` (${fn.http})` : ""}`);
      flags.push("the functions reading is refused");
    } else {
      const regions = Object.entries(fn.byRegion ?? {}).map(([k, v]) => `${k}: ${v}`).join(", ");
      out.push(`- Functions: **${fn.count} deployed** — ${regions || "no regions reported"}`);
      if (fn.strayCount) {
        out.push(`  - **${fn.strayCount} outside ${fn.canonicalRegion}** (runbook 5.9b / D13)`);
        flags.push(`${fn.strayCount} functions are outside ${fn.canonicalRegion}`);
      }
    }

    const bill = r.billing;
    if (!bill || bill.status !== "ok") {
      out.push(`- **Billing: refused** — ${bill?.why ?? "no reading"}${bill?.http ? ` (${bill.http})` : ""}`);
      flags.push("the billing reading is refused");
    } else {
      out.push(`- Billing: **enabled=${bill.enabled}**, account ${bill.account ?? "—"}`);
      if (bill.enabled === false) flags.push("billing reports disabled");
    }

    for (const b of observe.blocked ?? []) {
      if (["alertPolicies", "functions", "billing"].includes(b.name)) continue;
      out.push(`- **${b.name}: refused** — ${b.why}${b.http ? ` (${b.http})` : ""}`);
      flags.push(`the ${b.name} reading is refused`);
    }
  }
  out.push("");

  // 3 · The trail. Runway and the guard come from the committed rows, which
  // is why this reader needs no second API call to answer "has anything
  // moved" — three rows of a file in the tree settle it.
  out.push("### The trail");
  out.push("");
  if (!last) {
    out.push("**No trail rows.** `monitoring/pulse-trail.jsonl` is empty or unreadable.");
    flags.push("the pulse trail has no rows");
  } else {
    const trailDay = last.on ?? "undated";
    if (today && trailDay !== today) {
      out.push(`**The newest trail row is ${trailDay}, not today** — the pulse has not written since.`);
      flags.push(`the newest trail row is ${trailDay}`);
    }
    const runway = num(last.runwayDays);
    out.push(`- Runway: **${runway === null ? "absent" : `${runway} days`}**` +
      (runway !== null && runway < 30 ? " — **under 30**" : ""));
    if (runway === null) flags.push("runway is absent from the trail");
    else if (runway < 30) flags.push(`runway is ${runway} days`);

    const alerted = num(last.functionsAlerted);
    const fnCount = num(last.functionCount);
    out.push(`- Guard: **${alerted ?? "absent"} of ${fnCount ?? "?"} functions alerted**`);

    const age = num(last.scorecardAgeDays);
    out.push(`- Scorecard age: **${age === null ? "absent" : `${age} day(s)`}**` + (age !== null && age > 7 ? " — **stale**" : ""));
    if (age !== null && age > 7) flags.push(`the scorecard is ${age} days old`);

    out.push(`- Bank: ${num(last.totalQuestions) ?? "absent"} questions, ${num(last.unpromoted) ?? "absent"} unpromoted`);

    // The D296 sweep: zero, absent, or unchanged across three rows.
    out.push("");
    out.push("**The live signals** — zero, absent and unchanged are all named:");
    const recent = rows.slice(-3);
    for (const [key, label] of WATCHED) {
      const v = last[key];
      const shown = v === null || v === undefined ? "absent" : String(v);
      const same =
        recent.length >= 3 &&
        recent.every((row) => JSON.stringify(row[key] ?? null) === JSON.stringify(last[key] ?? null));
      const marks = [];
      if (v === null || v === undefined) marks.push("absent");
      else if (v === 0) marks.push("zero");
      if (same) marks.push(`unchanged across ${recent.length} rows`);
      out.push(`- ${label}: **${shown}**${marks.length ? ` — ${marks.join(", ")}` : ""}`);
      if (marks.length) flags.push(`${label} is ${marks.join(" and ")}`);
    }
  }
  out.push("");

  // 4 · The one line a person skims. Written last, from what the sections
  // above actually flagged, so it can never disagree with them.
  out.push("### In one line");
  out.push("");
  out.push(flags.length ? `**${flags.length} thing(s) to look at:** ${flags.join("; ")}.` : "**Nothing to look at** — every reading present, non-zero and moving.");
  out.push("");
  out.push("_Posted by the Production reader workflow (`.github/workflows/production-reader.yml`), " +
    "which replaced the scheduled session of the same name on 2026-09-03 — " +
    "`docs/OPS-RUNBOOK.md` § The production reader._");

  return out.join("\n");
}

/** Read a JSON file, or null when it is absent or unparseable. Absence is a
 * reportable state here, never a crash: the whole point of this reader is to
 * say when an input did not arrive. */
function readJson(path) {
  if (!path) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readText(path) {
  if (!path) return "";
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());
if (isMain) {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : null;
  };
  process.stdout.write(
    render({
      observe: readJson(flag("--observe")),
      observeRun: readJson(flag("--observe-run")),
      pulseRun: readJson(flag("--pulse-run")),
      trail: readText(flag("--trail")),
      today: flag("--today") || new Date().toISOString().slice(0, 10),
    }) + "\n",
  );
}

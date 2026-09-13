#!/usr/bin/env node
// rules-budget.mjs — what a write COSTS in firestore.rules, per line, and
// how far it sits from the 1,000-expression ceiling.
//
// WHY THIS EXISTS. Firestore stops a rule at 1,000 evaluated expressions
// and reports the stop as PERMISSION_DENIED — the same answer as a rule
// that said no. D429 measured the answer create path's thinnest legal
// arms at ~130 expressions of headroom, and D431 found the e2e already
// crossing the line thirteen times, every one an expected refusal, so the
// suite is green and cannot tell. RULES-BUDGET-PLAN.md is the plan; this
// is its Phase 0 — the instrument that gives every clause a number BEFORE
// any of them is moved. The plan's rule is that nothing is restructured on
// an estimate.
//
// TWO MEASUREMENTS, checked against each other — and a UNIT for the second.
//
//   cost      The emulator's rule-coverage report (the one rules-coverage.mjs
//             already reads) records how many times every expression in the
//             file evaluated. Snapshot it before one write, snapshot after,
//             and the difference is that write's evaluations — attributable
//             to the LINE, which is what says "this get() site costs 8" and
//             "this let ran on a write that never reached the arm".
//   headroom  D429's method, automated: append N filler conjuncts to the
//             rule under test and bisect for the N at which the write
//             flips. This is the ground truth for the ceiling itself; cost
//             is the ground truth for attribution. Where they disagree, the
//             filler number wins and the disagreement is reported, because
//             the report's units and Firestore's budget units are not
//             documented to be the same thing.
//   unit      What one filler costs in BUDGET units, measured rather than
//             assumed: a bare rule (`request.auth != null`) in a match
//             block of its own, tipped over the 1,000 by fillers of known
//             weight, so the N at the flip brackets the unit. D429 and the
//             first version of this script called a filler "~3
//             expressions" and printed headroom in that currency; the
//             block is what replaced the guess with a number (D432).
//
// AND A VERDICT that can tell the two kinds of no apart. The emulator's
// reason text — "maximum of 1000 expressions to evaluate has been reached"
// — does reach the client (rules.test.ts records it arriving on a positive
// control), so a refusal is classified as `refused` or `budget`. That is
// the distinction the suite's `assertFails` cannot make and the whole
// reason a legal write can cross the line unnoticed.
//
// RUNS INSIDE THE EMULATOR, like rules-coverage.mjs:
//
//   firebase emulators:exec --only firestore "node scripts/rules-budget.mjs"
//
// Options:
//   --gate                    THE GATE (D438): assert the baseline's pins on
//                             the tree's rules — every probe's verdict
//                             unchanged at its pinned N and BUDGET at N+1,
//                             every pin at or above the floor, the file
//                             loading at the compile floor. Chained into
//                             `test:rules` after rules-coverage, so it runs
//                             on the PR path and the deploy path both.
//   --pin                     re-bisect every probe's headroom and rewrite
//                             the pins (fillers, bounded, compileCeiling)
//                             in the baseline, keeping the last full
//                             measurement's costs and unit. What a PR
//                             runs when the gate says the number moved
//                             (`npm run test:rules:baseline`).
//   --write-baseline          the full measurement, written as the baseline
//   --ablate NAME=EXPR        replace helper NAME's body with `return EXPR;`
//                             and measure that variant instead (repeatable)
//   --fillers-on update       put the fillers on the UPDATE arm instead of
//                             create — answers whether the budget is per
//                             allow statement or per request
//   --max-fillers N           bisection upper bound (default 200)
//   --lines N                 how many top lines to print per probe (12)
//
// The pure parts — the rule transforms, the verdict classifier, the
// evaluation sum, the bisection — are exported and covered by
// rules-budget.test.mjs without an emulator, in the shape rules-coverage
// takes. A transform that cannot find its anchor text FAILS rather than
// returning the input unchanged: a filler that silently lands nowhere is a
// headroom measurement of nothing, which is D197's failure one script over.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BASELINE = join(root, "scripts", "rules-budget-baseline.json");
// Overridable so a frozen copy can be measured while the tree's own file
// is being edited — which is exactly the Phase 1 workflow: measure the
// base, restructure, measure the tree, compare.
const RULES = process.env.RULES_BUDGET_RULES || join(root, "firestore.rules");

// ── pure: rule transforms ───────────────────────────────────────────

/**
 * The last conjunct of the answer CREATE rule — the filler anchor. Since
 * Phase 1 (c) the rule ends in the routed `createArm()`; the anchors ride
 * inside each branch. The rule's own comment names this line as the
 * probe's landing and asks that it stay last.
 */
export const CREATE_TAIL = "&& createArm();";
/** The last conjunct of the answer UPDATE rule. */
export const UPDATE_TAIL = "|| request.time > resource.data.editedAt + duration.value(60, 's'));";

/**
 * One filler conjunct — a field read, a compare, the `&&`. What that costs
 * in budget units is `calibrate`'s to say, not this comment's: D429 put it
 * at ~3 and the calibration block found otherwise. `surface` is chosen
 * because every answer carries it, so the filler is evaluated and never
 * short-circuits.
 */
export const filler = (i) => `\n          && request.resource.data.surface != "zzfill${i}"`;

/** The answer document's match block — the fillers land inside it and nowhere else. */
export const ANSWERS_BLOCK = "match /answers/{aid}";

/**
 * Append `n` fillers before the terminating `;` of the answer create (or
 * update) rule. Scoped to the answers match block, because the create
 * rule's last conjunct — `isValidV2Anchors(…)` — is ALSO the last conjunct
 * of the profile's create rule, word for word, and the first run of this
 * script found it twice and refused. Throws unless the anchor is exactly
 * once inside the block.
 */
export function withFillers(rules, n, where = "create") {
  const at = rules.indexOf(ANSWERS_BLOCK);
  if (at === -1) throw new Error(`rules-budget: no \`${ANSWERS_BLOCK}\` block in the rules`);
  const head = rules.slice(0, at);
  const block = rules.slice(at);
  const tail = where === "update" ? UPDATE_TAIL : CREATE_TAIL;
  const count = block.split(tail).length - 1;
  if (count !== 1) {
    throw new Error(
      `rules-budget: the answer ${where} rule's tail anchor was found ${count} times in its block, expected 1.\n`
      + `  Anchor: ${tail}\n`
      + "  The rule changed shape; move the anchor here rather than measuring nothing.",
    );
  }
  const body = tail.slice(0, -1); // drop the ';'
  let fill = "";
  for (let i = 0; i < n; i += 1) fill += filler(i);
  return head + block.replace(tail, `${body}${fill};`);
}

/** The top of the file's one documents match — where the calibration block goes. */
export const DOCUMENTS_OPEN = "match /databases/{database}/documents {";
/** The calibration block's collection; nothing in the tree writes there. */
export const CALIBRATE_PATH = "zz_calibrate";

/**
 * The calibration block: a rule whose own cost is a handful of units, so
 * that the N at which fillers tip it over the 1,000 is the cost of a
 * filler and almost nothing else. Inserted at the top of the documents
 * match so no other rule is in its path. Its fillers are HEAVY — `weight`
 * compares in one parenthesised conjunct, exactly `weight` plain fillers'
 * worth — because a plain filler costs too little to reach the budget
 * before the compile ceiling stops the file loading (D432: ~95
 * conjuncts), and a heavy one reaches it in a third of the depth.
 */
export function withCalibrateBlock(rules, n, weight) {
  const count = rules.split(DOCUMENTS_OPEN).length - 1;
  if (count !== 1) {
    throw new Error(`rules-budget: \`${DOCUMENTS_OPEN}\` found ${count} times, expected 1`);
  }
  let fill = "";
  for (let i = 0; i < n; i += 1) {
    const terms = [];
    for (let j = 0; j < weight; j += 1) terms.push(`request.resource.data.surface != "zzcal${i}_${j}"`);
    fill += `\n        && (${terms.join(" && ")})`;
  }
  const block = `\n    match /${CALIBRATE_PATH}/{id} {\n      allow create: if request.auth != null${fill};\n    }`;
  return rules.replace(DOCUMENTS_OPEN, `${DOCUMENTS_OPEN}${block}`);
}

/**
 * Replace a helper's body with `return VALUE;`. Helpers in this file are
 * `function NAME(…) {` at any indent, closed by a `}` at the SAME indent —
 * the rules formatter is consistent about that and this relies on it.
 */
export function ablate(rules, name, value) {
  const re = new RegExp(`^([ \\t]*)function ${name}\\(([^)]*)\\) \\{\\n[\\s\\S]*?\\n\\1\\}`, "m");
  const m = re.exec(rules);
  if (!m) throw new Error(`rules-budget: no helper named ${name}() to ablate`);
  const indent = m[1];
  return rules.replace(re, `${indent}function ${name}(${m[2]}) {\n${indent}  return ${value};\n${indent}}`);
}

// ── pure: verdicts and sums ─────────────────────────────────────────

export const BUDGET_TEXT = /maximum of 1000 expressions/i;

/** allowed | refused | budget, from a write's outcome. */
export function classify(err) {
  if (!err) return "allowed";
  const msg = String(err?.message || err);
  return BUDGET_TEXT.test(msg) ? "budget" : "refused";
}

/**
 * Total evaluations in a coverage report, and the same broken down by
 * line. Every node in the emulator's tree is one expression, and each of
 * its `values` carries a `count`; the sum over the tree is how many
 * expressions ran.
 */
export function evalCounts(data) {
  let total = 0;
  const byLine = new Map();
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    const n = (node.values || []).reduce((a, v) => a + (v?.count || 0), 0);
    if (n) {
      total += n;
      const line = node.sourcePosition?.line ?? 0;
      byLine.set(line, (byLine.get(line) || 0) + n);
    }
    for (const c of node.children || []) walk(c);
  };
  for (const n of data?.report || []) walk(n);
  return { total, byLine };
}

/** `after - before`, per line and in total; lines that did not move are dropped. */
export function delta(before, after) {
  const byLine = new Map();
  for (const [line, n] of after.byLine) {
    const d = n - (before.byLine.get(line) || 0);
    if (d) byLine.set(line, d);
  }
  return { total: after.total - before.total, byLine };
}

/**
 * Largest n in [lo, hi] for which `ok(n)` holds, assuming monotone (true
 * then false). Returns lo - 1 if even lo fails, hi if hi passes.
 */
export async function bisect(ok, lo, hi) {
  if (!(await ok(lo))) return lo - 1;
  if (await ok(hi)) return hi;
  let good = lo;
  let bad = hi;
  while (bad - good > 1) {
    const mid = Math.floor((good + bad) / 2);
    if (await ok(mid)) good = mid;
    else bad = mid;
  }
  return good;
}

// ── the probes ──────────────────────────────────────────────────────
//
// The seven legal creates are the budget test's own, payload for payload
// (rules.test.ts § "the heaviest LEGAL create"): all ten anchors at their
// bounds, because that is what a real device writes and every other case
// in the suite sends the cheap end. The refusals mirror the shapes the e2e
// hits (D431's thirteen). One update.

const U = { owner: "u_owner", friend: "u_friend", stranger: "u_stranger" };
const GID = "g_budget";
/** The pulse probe's day — see the probe. UTC, like the rule's own parse. */
const TODAY = new Date().toISOString().slice(0, 10);
export const FAT = {
  city: "c".repeat(80), country: "n".repeat(80), ageBand: "b".repeat(20),
  age: "999", gender: "g".repeat(40), profession: "p".repeat(80),
  jobField: "j".repeat(40), education: "e".repeat(80),
  relationship: "r".repeat(40), heightBand: "h".repeat(20),
};

export const PROBES = [
  // legal creates
  { name: "world · all ten anchors at their bounds", expect: "allowed", uid: U.owner, aid: "daily-000",
    data: { qid: "daily-000", surface: "daily", optionIdx: 1, anchors: FAT } },
  // A group answer carries no guess (D437 — nothing in a group is called;
  // the rules refuse one), and the world arm D429 measured left at D426's
  // third amendment, so the guess-carrying probe is the 1v1's: the arm
  // that still evaluates the guess clauses.
  { name: "duel · own bank", expect: "allowed", uid: U.owner, aid: `g_${GID}_r2`,
    data: { qid: "group-b0", surface: "group", optionIdx: 1, gid: GID, round: 2, anchors: FAT } },
  { name: "duel · 1v1 with its guess (the guess clauses)", expect: "allowed", uid: U.friend, aid: "g_d_budget_r2",
    data: { qid: "duo-b0", surface: "duo", optionIdx: 1, guessIdx: 0, gid: "d_budget", round: 2, anchors: FAT } },
  { name: "duel · pick round (thinnest, D429)", expect: "allowed", uid: U.stranger, aid: `g_${GID}_r2`,
    data: { qid: "group-pick0", surface: "group", optionIdx: 1, pickUid: U.friend, gid: GID, round: 2, anchors: FAT } },
  { name: "duel · late answer", expect: "allowed", uid: U.owner, aid: `g_${GID}_r1`,
    data: { qid: "group-b0", surface: "group", optionIdx: 0, late: true, gid: GID, round: 1, anchors: FAT } },
  { name: "rank", expect: "allowed", uid: U.owner, aid: "feed-rank0",
    data: { qid: "feed-rank0", surface: "feed", order: [2, 0, 1, 3], anchors: FAT } },
  { name: "duel · 32-member room", expect: "allowed", uid: "m31", aid: "g_g_big_r2",
    data: { qid: "group-b0", surface: "group", optionIdx: 1, gid: "g_big", round: 2, anchors: FAT } },
  // TODAY, not the day this was written. `isPulseAnswer` bounds `day` to
  // (now - 4d, now + 2d) — a pulse answer is about a day, so the rule
  // refuses one that is neither recent nor imminent. This probe carried
  // the literal 2026-09-09 and therefore aged out of that window on
  // 2026-09-13, four days later: the pin read "refused at every filler
  // count", the gate reported a moved pin, and `npm run test:rules` went
  // red on main and would have stayed red every day after. Nothing about
  // the rule or the app was wrong. A fixture with a frozen date inside a
  // rule with a moving window is a test that expires, and this one took
  // the deploy path's gate with it (backend-checks.yml runs this).
  { name: "pulse", expect: "allowed", uid: U.owner, aid: `pulse-pace_${TODAY}`,
    data: { qid: `pulse-pace_${TODAY}`, baseQid: "pulse-pace", day: TODAY, surface: "pulse", optionIdx: 1, anchors: FAT } },
  // refusals, in the e2e's shapes
  { name: "REFUSE · round already revealed", expect: "refused", uid: U.owner, aid: `g_${GID}_r1`,
    data: { qid: "group-b0", surface: "group", optionIdx: 0, gid: GID, round: 1, anchors: FAT } },
  { name: "REFUSE · a guess on a group answer (D437)", expect: "refused", uid: U.owner, aid: `g_${GID}_r2`,
    data: { qid: "group-b0", surface: "group", optionIdx: 1, guessIdx: 0, gid: GID, round: 2, anchors: FAT } },
  { name: "REFUSE · entity on a non-catalog question", expect: "refused", uid: U.owner, aid: "feed-w0",
    data: { qid: "feed-w0", surface: "feed", entity: 128514, anchors: FAT } },
  { name: "REFUSE · a second ranking on the same question", expect: "refused", uid: U.friend, aid: "feed-rank0",
    data: { qid: "feed-rank0", surface: "feed", order: [2, 0, 1, 3], anchors: FAT } },
  { name: "REFUSE · optionIdx on a rank question", expect: "refused", uid: U.stranger, aid: "feed-rank0",
    data: { qid: "feed-rank0", surface: "feed", optionIdx: 1, anchors: FAT } },
  { name: "REFUSE · world answer on a killed question", expect: "refused", uid: U.owner, aid: "daily-dead",
    data: { qid: "daily-dead", surface: "daily", optionIdx: 0, anchors: FAT } },
  { name: "REFUSE · non-member in a room", expect: "refused", uid: "nobody", aid: `g_${GID}_r2`,
    data: { qid: "group-b0", surface: "group", optionIdx: 1, gid: GID, round: 2, anchors: FAT } },
  // one legal update (D86's one edit shape)
  { name: "update · optionIdx edit", expect: "allowed", uid: U.friend, aid: "daily-000", update: true,
    data: { optionIdx: 1 } },
];

// ── the emulator half ───────────────────────────────────────────────

function emulatorHost() {
  const h = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
  const [host, port] = h.split(":");
  return { host, port: Number(port) };
}

async function coverage(projectId) {
  const { host, port } = emulatorHost();
  const url = `http://${host}:${port}/emulator/v1/projects/${projectId}:ruleCoverage.html`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`rules-budget: coverage report HTTP ${res.status} at ${url}`);
  const html = await res.text();
  const a = html.indexOf("const data = ");
  const b = html.indexOf("\n};", a);
  if (a === -1 || b === -1) {
    throw new Error("rules-budget: the coverage report is no longer `const data = {…};` — fix the parser, do not drop the check");
  }
  return evalCounts(JSON.parse(html.slice(a + "const data = ".length, b + 2)));
}

let seq = 0;
async function boot(rules, label) {
  const { initializeTestEnvironment } = await import("@firebase/rules-unit-testing");
  const { host, port } = emulatorHost();
  seq += 1;
  const projectId = `budget-${label}-${seq}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const env = await initializeTestEnvironment({ projectId, firestore: { rules, host, port } });
  return { env, projectId };
}

async function seed(env) {
  const { doc, setDoc, Timestamp } = await import("firebase/firestore");
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const q = (id, d) => setDoc(doc(db, "v2_questions", id), d);
    await q("daily-000", { surface: "daily", seq: 0, type: "binary", prompt: "?", options: ["a", "b"], active: true });
    await q("daily-dead", { surface: "daily", seq: 9, type: "binary", prompt: "?", options: ["a", "b"], active: false });
    await q("group-b0", { surface: "group", seq: 1, type: "classic", prompt: "?", options: ["a", "b"], active: true });
    await q("feed-w0", { surface: "feed", seq: 2, type: "vote", prompt: "?", options: ["a", "b"], active: true, core: true });
    await q("group-pick0", { surface: "group", seq: 3, type: "classic", topic: "pick", prompt: "?", options: [], active: true });
    await q("feed-rank0", { surface: "feed", seq: 4, type: "rank", prompt: "?", options: ["A", "B", "C", "D"], active: true });
    // The BASE question: isPulseAnswer reads `v2_questions/$(baseQid)`, not
    // the per-day aid. The first fixture seeded the aid and the probe ran
    // out of budget erroring on a missing document.
    await q("pulse-pace", { surface: "pulse", seq: 5, type: "vote", prompt: "?", options: ["a", "b", "c"], active: true });
    await setDoc(doc(db, "v2_groups", GID), { name: "Room", mode: "group", memberUids: [U.owner, U.friend, U.stranger], round: 2 });
    // …and a pair on the duo pool's own bank, for the one arm that still
    // carries a guess (rules.test.ts § the heaviest LEGAL create).
    await q("duo-b0", { surface: "duo", seq: 6, type: "classic", prompt: "?", options: ["a", "b"], active: true });
    await setDoc(doc(db, "v2_groups", "d_budget"), { name: "Pair", mode: "duo", memberUids: [U.owner, U.friend], round: 2 });
    await setDoc(doc(db, "v2_groups", "g_big"), {
      name: "Crowd", mode: "group", memberUids: Array.from({ length: 32 }, (_, i) => `m${i}`), round: 2,
    });
    // The update probe's existing answer…
    await setDoc(doc(db, "v2_users", U.friend, "answers", "daily-000"), {
      qid: "daily-000", surface: "daily", optionIdx: 0, answeredAt: Timestamp.now(), anchors: {},
    });
    // …and the ranking that already exists, for the "second ranking"
    // refusal. The e2e's "duplicate ranking refused" is a second ANSWER to
    // a rank question, not a repeated index: isRankAnswer bounds the
    // order's length and never its distinctness, so [0,0,1,2] is a legal
    // order and the first fixture measured an allowed write as a refusal.
    await setDoc(doc(db, "v2_users", U.friend, "answers", "feed-rank0"), {
      qid: "feed-rank0", surface: "feed", order: [0, 1, 2, 3], answeredAt: Timestamp.now(), anchors: {},
    });
  });
}

async function attempt(env, probe) {
  const { doc, setDoc, updateDoc, serverTimestamp } = await import("firebase/firestore");
  const db = env.authenticatedContext(probe.uid).firestore();
  const ref = doc(db, "v2_users", probe.uid, "answers", probe.aid);
  try {
    if (probe.update) await updateDoc(ref, { ...probe.data, editedAt: serverTimestamp() });
    else await setDoc(ref, { ...probe.data, answeredAt: serverTimestamp() });
    return "allowed";
  } catch (e) {
    return classify(e);
  }
}

/**
 * The coverage report, read until two consecutive reads agree. The
 * emulator does not promise the report is current the instant a write
 * returns, and the first version of this script — one project for every
 * probe, one snapshot either side of each write — attributed SIXTY
 * evaluations of an anchor-size line to a single write with ten anchors:
 * six writes' worth, misfiled. The lagging read is why every probe now
 * gets its own project (below); the settle is belt to that brace.
 */
async function settledCoverage(projectId) {
  let prev = await coverage(projectId);
  for (let i = 0; i < 6; i += 1) {
    await new Promise((r) => setTimeout(r, 120));
    const next = await coverage(projectId);
    if (next.total === prev.total) return next;
    prev = next;
  }
  return prev;
}

/**
 * One variant: for EVERY probe, a fresh project — boot, seed, one write,
 * one report. The seed runs with rules disabled, so it evaluates nothing
 * and the report holds exactly the probe's own evaluations; `pre` is
 * printed so a non-zero one is visible rather than silently subtracted.
 */
async function measureCosts(rules, label, topLines) {
  const out = [];
  for (const [i, p] of PROBES.entries()) {
    const { env, projectId } = await boot(rules, `${label}-c${i}`);
    try {
      await seed(env);
      const before = await settledCoverage(projectId);
      const verdict = await attempt(env, p);
      const after = await settledCoverage(projectId);
      const d = delta(before, after);
      const lines = [...d.byLine.entries()].sort((a, b) => b[1] - a[1]).slice(0, topLines);
      out.push({ name: p.name, expect: p.expect, verdict, cost: d.total, pre: before.total, lines });
    } finally {
      await env.cleanup();
    }
  }
  return out;
}

/** Does this rules text LOAD? A variant past the compile ceiling refuses at boot. */
async function compiles(rules, label) {
  try {
    const { env } = await boot(rules, label);
    await env.cleanup();
    return true;
  } catch (e) {
    if (/too complex to evaluate safely|Error compiling rules/i.test(String(e?.message || e))) return false;
    throw e;
  }
}

/**
 * The compile ceiling, in fillers: the largest N the ruleset still loads
 * with. D429 met this at 85 by hand and named it the LOUD ceiling — a
 * deploy fails rather than a person being refused. The first run of this
 * script began its bisection at 300, above it, and died on the compile
 * error instead of recording it; now it is a number of its own and the
 * headroom bisection stays beneath it.
 */
async function measureCompileCeiling(rules, label, where, maxFillers) {
  return bisect((n) => compiles(withFillers(rules, n, where), `${label}-k${n}`), 0, maxFillers);
}

/**
 * One probe's verdict on one variant — `allowed`, `refused`, `budget`, or
 * `compile` when the variant would not load. The one step under the
 * headroom bisection, the gate and the pin, so the three cannot disagree
 * about what a verdict is.
 */
async function verdictAt(rules, n, where, probe, label) {
  try {
    const { env } = await boot(withFillers(rules, n, where), `${label}-f${n}`);
    try { await seed(env); return await attempt(env, probe); } finally { await env.cleanup(); }
  } catch (e) {
    // Past the compile ceiling the variant cannot load at all — that is a
    // failing N for every probe, not a crash.
    if (!/too complex to evaluate safely|Error compiling rules/i.test(String(e?.message || e))) throw e;
    return "compile";
  }
}

/**
 * "Unchanged": an allowed write is still allowed, and a refused write is
 * still refused for a REASON rather than for budget.
 */
export const unchanged = (probe, verdict) => (probe.expect === "allowed" ? verdict === "allowed" : verdict === "refused");

/** Headroom per probe, in fillers: the largest N at which its verdict is unchanged. */
async function measureHeadroom(rules, label, where, maxFillers) {
  const out = new Map();
  for (const p of PROBES) {
    if (Boolean(p.update) !== (where === "update")) { out.set(p.name, null); continue; }
    const cache = new Map();
    const ok = async (n) => {
      if (!cache.has(n)) cache.set(n, unchanged(p, await verdictAt(rules, n, where, p, label)));
      return cache.get(n);
    };
    out.set(p.name, await bisect(ok, 0, maxFillers));
  }
  return out;
}

// ── the gate (D438) ─────────────────────────────────────────────────

/**
 * The gate's checks, from the baseline alone — pure, so WHAT is asserted
 * can be pinned without an emulator. Every probe must have a row and
 * every row a probe: a probe renamed or added without a re-pin is a gate
 * measuring the old shape, and that fails here rather than passing
 * quietly. For a probe the bisection could flip, the assertion is
 * two-sided — its verdict unchanged at exactly the pinned N and BUDGET at
 * N+1 — which is check:globals rule 4's shape: a change that moves the
 * headroom in EITHER direction must move the number with it and say why,
 * so the baseline stays a measurement and not a memory. For a probe the
 * compile ceiling bounded (every refusal, today): unchanged at the floor.
 * The floor itself is policy, not measurement — the plan's "≥ 400
 * expressions" in the calibrated unit — and every pin must clear it.
 */
export function planGate(baseline, probes = PROBES) {
  const floor = baseline?.floorFillers;
  const compileFloor = baseline?.compileFloorFillers;
  if (!Number.isInteger(floor) || floor < 0 || !Number.isInteger(compileFloor) || compileFloor <= floor) {
    throw new Error("rules-budget: the baseline needs integer floorFillers and compileFloorFillers, the compile floor above the runtime one");
  }
  if (baseline.fillersOn !== "create") {
    throw new Error(`rules-budget: the baseline's fillers are on the ${baseline.fillersOn} arm; the gate pins the create arm`);
  }
  const rows = new Map((baseline.probes || []).map((r) => [r.name, r]));
  const checks = [];
  for (const p of probes) {
    const row = rows.get(p.name);
    if (!row) throw new Error(`rules-budget: no baseline row for the probe "${p.name}" — re-pin (npm run test:rules:baseline)`);
    rows.delete(p.name);
    // The update probe: its arm carries no fillers on a create-arm pin.
    if (row.fillers == null) continue;
    if (!Number.isInteger(row.fillers) || row.fillers < 0) {
      throw new Error(`rules-budget: "${p.name}" is pinned at ${row.fillers}, which is not a headroom — its verdict changed; re-pin`);
    }
    if (row.fillers < floor) {
      throw new Error(`rules-budget: "${p.name}" is pinned at ${row.fillers} fillers, under the floor of ${floor} — the change that put it there is the thing to argue, not the number`);
    }
    if (row.bounded) {
      checks.push({ probe: p, n: floor, want: "unchanged" });
    } else {
      checks.push({ probe: p, n: row.fillers, want: "unchanged" });
      checks.push({ probe: p, n: row.fillers + 1, want: "budget" });
    }
  }
  if (rows.size) throw new Error(`rules-budget: baseline rows with no probe behind them: ${[...rows.keys()].join(", ")} — re-pin`);
  return { floor, compileFloor, checks };
}

/** One check against the verdict the emulator gave — pure. */
export function judge(check, verdict) {
  const ok = check.want === "budget" ? verdict === "budget" : unchanged(check.probe, verdict);
  return { ...check, verdict, ok };
}

async function runGate(rules, baseline, label) {
  const plan = planGate(baseline);
  const results = [];
  for (const c of plan.checks) results.push(judge(c, await verdictAt(rules, c.n, "create", c.probe, label)));
  const loads = await compiles(withFillers(rules, plan.compileFloor, "create"), `${label}-k${plan.compileFloor}`);
  return { ...plan, results, loads };
}

/** The baseline, with its keys in reading order and the floors always present. */
function writeBaseline(next) {
  const ordered = {
    measured: next.measured,
    pinned: next.pinned,
    variant: next.variant,
    fillersOn: next.fillersOn,
    floorFillers: next.floorFillers,
    compileFloorFillers: next.compileFloorFillers,
    compileCeiling: next.compileCeiling,
    unit: next.unit,
    calibration: next.calibration,
    probes: next.probes,
  };
  writeFileSync(BASELINE, `${JSON.stringify(ordered, null, 2)}\n`);
}

function readBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE, "utf8"));
  } catch (e) {
    throw new Error(`rules-budget: cannot read ${BASELINE} — ${e?.message || e}. The gate fails closed; write it with --write-baseline.`);
  }
}

/**
 * Budget units per plain filler, from the calibration block. At the flip N
 * the write is allowed (cost ≤ 1,000) and at N+1 it is refused BY BUDGET,
 * so N brackets the unit; the block's own cost — `request.auth != null`
 * and the match — is taken as at most 10 units, which is most of the
 * bracket's width. Two weights are run so the reading checks against
 * itself: their brackets must overlap, and the unit is the middle of the
 * overlap. A flip whose N+1 did not load, or was refused for a reason, is
 * a number about something other than the budget and is reported as
 * exactly that rather than folded in.
 */
async function calibrate(rules, label, maxFillers, weights = [5, 10]) {
  const { doc, setDoc } = await import("firebase/firestore");
  const out = [];
  for (const w of weights) {
    const verdicts = new Map();
    const ok = async (n) => {
      if (!verdicts.has(n)) {
        let verdict;
        try {
          const { env } = await boot(withCalibrateBlock(rules, n, w), `${label}-cal${w}-${n}`);
          try {
            await setDoc(doc(env.authenticatedContext("cal").firestore(), CALIBRATE_PATH, `n${n}`), { surface: "cal" });
            verdict = "allowed";
          } catch (e) {
            verdict = classify(e);
          } finally {
            await env.cleanup();
          }
        } catch (e) {
          if (!/too complex to evaluate safely|Error compiling rules/i.test(String(e?.message || e))) throw e;
          verdict = "compile";
        }
        verdicts.set(n, verdict);
      }
      return verdicts.get(n) === "allowed";
    };
    const n = await bisect(ok, 0, maxFillers);
    const next = verdicts.get(n + 1) ?? "none";
    const clean = n >= 1 && next === "budget";
    const lo = clean ? Math.round((990 / (w * (n + 1))) * 100) / 100 : null;
    const hi = clean ? Math.round((1000 / (w * n)) * 100) / 100 : null;
    out.push({ weight: w, n, next, clean, lo, hi });
  }
  const clean = out.filter((c) => c.clean);
  const lo = Math.max(...clean.map((c) => c.lo));
  const hi = Math.min(...clean.map((c) => c.hi));
  const unit = clean.length && lo <= hi ? Math.round(((lo + hi) / 2) * 10) / 10 : null;
  return { weights: out, unit };
}

// ── CLI ─────────────────────────────────────────────────────────────

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i === -1 ? dflt : process.argv[i + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = readFileSync(RULES, "utf8");

  if (process.argv.includes("--gate")) {
    const baseline = readBaseline();
    const unitOf = (n) => (baseline.unit ? ` (~${Math.round(n * baseline.unit)} units)` : "");
    console.log(`rules-budget gate: floor ${baseline.floorFillers} fillers${unitOf(baseline.floorFillers)}, compile floor ${baseline.compileFloorFillers}, pinned ${baseline.pinned || baseline.measured}`);
    const g = await runGate(base, baseline, "gate");
    let bad = 0;
    const byProbe = new Map();
    for (const r of g.results) {
      if (!byProbe.has(r.probe.name)) byProbe.set(r.probe.name, []);
      byProbe.get(r.probe.name).push(r);
    }
    for (const [name, rs] of byProbe) {
      const ok = rs.every((r) => r.ok);
      if (!ok) bad += 1;
      const said = rs.map((r) => `${r.verdict} @${r.n}${r.ok ? "" : ` (wanted ${r.want === "budget" ? "budget" : r.probe.expect})`}`).join(", ");
      const note = rs.length === 1 ? " — compile-bounded pin, held at the floor" : "";
      console.log(`  ${ok ? "✓" : "✗"} ${name.padEnd(46)} ${said}${note}`);
    }
    console.log(`  ${g.loads ? "✓" : "✗"} the ruleset ${g.loads ? "loads" : "DOES NOT LOAD"} with ${g.compileFloor} fillers on the create arm`);
    if (!g.loads) bad += 1;
    if (bad) {
      console.error(`\nrules-budget gate FAILED — ${bad} pin(s) moved.`
        + "\n  If the change is meant to cost expressions, re-pin (npm run test:rules:baseline) and say why in the PR;"
        + `\n  a pin that lands under the floor (${g.floor} fillers) is the change to argue for, not the number to edit.`
        + "\n  If the change was not meant to cost anything, it did — scripts/rules-budget.mjs (no flags) says where.");
      process.exit(1);
    }
    console.log(`rules-budget gate OK — ${byProbe.size} probes at their pins, floor ${g.floor}, loads at ${g.compileFloor}`);
    process.exit(0);
  }

  if (process.argv.includes("--pin")) {
    const baseline = readBaseline();
    const maxFillers = Number(arg("--max-fillers", "200"));
    const ceiling = await measureCompileCeiling(base, "pin", "create", maxFillers);
    const headroom = await measureHeadroom(base, "pin", "create", Math.max(0, ceiling));
    const rows = new Map((baseline.probes || []).map((r) => [r.name, r]));
    const probes = [];
    let moved = 0;
    let broken = 0;
    for (const p of PROBES) {
      const h = headroom.get(p.name);
      const old = rows.get(p.name) || { name: p.name, expect: p.expect };
      if (h != null && h < 0) broken += 1;
      const next = { ...old, name: p.name, expect: p.expect, fillers: h, bounded: h != null && h >= ceiling };
      if (old.fillers !== next.fillers || Boolean(old.bounded) !== next.bounded) moved += 1;
      const was = old.fillers == null ? "—" : `${old.bounded ? "≥" : ""}${old.fillers}`;
      const now = h == null ? "—" : h < 0 ? "VERDICT CHANGED" : `${next.bounded ? "≥" : ""}${h}`;
      console.log(`  ${p.name.padEnd(46)} ${was.padStart(5)} → ${now}`);
      probes.push(next);
    }
    if (broken) {
      console.error(`\nrules-budget: ${broken} probe(s) no longer return their expected verdict at ZERO fillers — that is a rule change, not a headroom change, and a pin cannot record it.`);
      process.exit(1);
    }
    writeBaseline({
      ...baseline,
      pinned: new Date().toISOString().slice(0, 10),
      compileCeiling: ceiling,
      floorFillers: baseline.floorFillers ?? 50,
      compileFloorFillers: baseline.compileFloorFillers ?? 80,
      probes,
    });
    console.log(`\nrules-budget: ${moved} pin(s) moved; compile ceiling ${ceiling}; written — ${BASELINE}`);
    process.exit(0);
  }

  let rules = base;
  const ablations = [];
  for (let i = 0; i < process.argv.length; i += 1) {
    if (process.argv[i] === "--ablate") {
      // NAME=EXPR — any rules expression, not only true/false, so a helper
      // that returns a number (duelIndexSpace) or a map can be stubbed too.
      const eq = String(process.argv[i + 1]).indexOf("=");
      const name = String(process.argv[i + 1]).slice(0, eq);
      const value = String(process.argv[i + 1]).slice(eq + 1);
      rules = ablate(rules, name, value);
      ablations.push(`${name}=${value}`);
    }
  }
  const where = arg("--fillers-on", "create");
  const maxFillers = Number(arg("--max-fillers", "200"));
  const topLines = Number(arg("--lines", "12"));
  const label = ablations.length ? ablations.join("+") : "base";

  console.log(`rules-budget: ${label}${where === "update" ? " (fillers on the update arm)" : ""}`);
  const src = base.split("\n");

  // The compile ceiling first: it bounds the headroom bisection, and it is
  // a number the plan's gate wants on its own.
  const ceiling = await measureCompileCeiling(rules, label, where, maxFillers);
  console.log(`compile ceiling: the ruleset still loads with ${ceiling} fillers on the ${where} arm`);

  // THE UNIT, before anything is printed in it.
  const cal = await calibrate(rules, label, maxFillers);
  for (const c of cal.weights) {
    console.log(`calibration · weight ${String(c.weight).padStart(2)}: allowed at N=${c.n}, ${c.next} at N+1`
      + (c.clean ? ` → one plain filler ∈ (${c.lo}, ${c.hi}] budget units` : " → not a budget flip; discarded"));
  }
  const unit = cal.unit;
  console.log(unit == null
    ? "calibration: no clean, agreeing flip — headroom is printed in fillers only"
    : `calibration: one plain filler ≈ ${unit} budget units`);

  // COSTS FIRST, AND PRINTED FIRST. The headroom pass boots the emulator
  // ~10 times per probe and is where a transform will refuse; the cost
  // table is the cheaper, more informative half and must not be lost to a
  // failure in the other. The first run of this script lost it that way.
  const costs = await measureCosts(rules, label, topLines);
  console.log("\nprobe                                        verdict   cost   pre");
  for (const c of costs) {
    const flag = c.verdict !== c.expect ? "  ← EXPECTED " + c.expect : "";
    console.log(`${c.name.padEnd(44)} ${c.verdict.padEnd(8)} ${String(c.cost).padStart(5)} ${String(c.pre).padStart(5)}${flag}`);
  }
  console.log("\n— top lines per probe —");
  for (const c of costs) {
    console.log(`\n${c.name}`);
    for (const [line, n] of c.lines) {
      const text = (src[line - 1] || "").trim().slice(0, 78);
      console.log(`  L${String(line).padEnd(5)} ${String(n).padStart(4)}  ${text}`);
    }
  }

  const headroom = await measureHeadroom(rules, label, where, Math.max(0, ceiling));
  console.log("\nprobe                                        fillers  ≈exprs");
  const bounded = (h) => h != null && h >= ceiling;
  for (const c of costs) {
    const h = headroom.get(c.name);
    // -1 is bisect's "even zero fillers fails": the write is already past
    // the line today, which for a refusal means refused BY BUDGET. A probe
    // still unchanged AT the compile ceiling never flipped at all — its
    // headroom is at least that, and the file cannot be made longer to
    // find out how much more.
    const ge = bounded(h) ? "≥" : "";
    const hs = h == null ? "     —" : h < 0 ? "  over" : `${ge}${h}`.padStart(6);
    const es = h == null || h < 0 || unit == null ? "     —" : `${ge}${Math.round(h * unit)}`.padStart(6);
    console.log(`${c.name.padEnd(44)} ${hs}  ${es}`);
  }
  // Coverage against budget: if the report counted budget units, an
  // allowed probe's cost plus its headroom would land at ≈1,000. D432 has
  // the answer — it does not, and not by a constant factor either — and
  // the check stays so a tree on which it starts to hold is noticed.
  if (unit != null) {
    console.log(`\n— coverage cost + ${unit}·fillers (≈ 1000 only if the report counted budget units) —`);
    for (const c of costs) {
      const h = headroom.get(c.name);
      if (h == null || h < 0 || bounded(h) || c.expect !== "allowed") continue;
      console.log(`  ${c.name.padEnd(44)} ${String(Math.round(c.cost + h * unit)).padStart(5)}`);
    }
  }

  const wrong = costs.filter((c) => c.verdict !== c.expect);
  if (wrong.length) {
    console.error(`\nrules-budget: ${wrong.length} probe(s) did not return the expected verdict:`);
    for (const c of wrong) console.error(`  ${c.name}: expected ${c.expect}, got ${c.verdict}`);
  }
  if (process.argv.includes("--write-baseline")) {
    // The floors are policy and survive a re-measurement; the defaults are
    // D438's numbers for a tree that has none yet.
    let prior = {};
    try { prior = readBaseline(); } catch { prior = {}; }
    writeBaseline({
      measured: new Date().toISOString().slice(0, 10),
      pinned: new Date().toISOString().slice(0, 10),
      variant: label,
      fillersOn: where,
      floorFillers: prior.floorFillers ?? 50,
      compileFloorFillers: prior.compileFloorFillers ?? 80,
      compileCeiling: ceiling,
      unit,
      calibration: cal.weights,
      probes: costs.map((c) => ({
        name: c.name,
        expect: c.expect,
        verdict: c.verdict,
        cost: c.cost,
        fillers: headroom.get(c.name),
        // true: never flipped below the compile ceiling — `fillers` is a floor.
        bounded: bounded(headroom.get(c.name)),
      })),
    });
    console.log(`\nrules-budget: baseline written — ${BASELINE}`);
  }
  process.exit(wrong.length ? 1 : 0);
}
